import { describe, it, expect } from 'vitest';
import { prisma } from '../src/config/db.js';
import { providerResolutionService } from '../src/services/provider-resolution.service.js';
import { getNextId } from '../src/utils/opendental-ids.util.js';
import { uniqueToken } from './helpers/unique.js';
import { createPatientRecord } from './helpers/fixtures.js';

describe('Phase 4: Provider Resolution Service', () => {
  it('resolves treating provider via item provider (Tier 1)', async () => {
    const provNum = await getNextId('provider', 'ProvNum');
    await prisma.provider.create({
      data: { ProvNum: provNum, Abbr: 'T1PROV', FName: 'Tier1', LName: 'Prov' },
    });

    const resolved = await providerResolutionService.resolveClaimProviders({
      itemProvNum: provNum,
    });

    expect(resolved.treatingProvNum).toBe(provNum);
    expect(resolved.billingProvNum).toBe(provNum); // Standard OpenDental treating fallback

    await prisma.provider.delete({ where: { ProvNum: provNum } });
  });

  it('resolves treating provider via appointment provider (Tier 2)', async () => {
    const provNum = await getNextId('provider', 'ProvNum');
    await prisma.provider.create({
      data: { ProvNum: provNum, Abbr: 'T2PROV', FName: 'Tier2', LName: 'Prov' },
    });

    const token = uniqueToken('appt-prov');
    const alphanumeric = token.replace(/[^A-Za-z0-9]/g, '');
    const patient = await createPatientRecord(alphanumeric);

    const aptNum = await getNextId('appointment', 'AptNum');
    await prisma.appointment.create({
      data: {
        AptNum: aptNum,
        PatNum: patient.PatNum,
        ProvNum: provNum,
        AptDateTime: new Date(),
        AptStatus: 1,
      },
    });

    const resolved = await providerResolutionService.resolveClaimProviders({
      patientId: patient.PatNum,
      appointmentId: aptNum,
    });

    expect(resolved.treatingProvNum).toBe(provNum);

    await prisma.appointment.delete({ where: { AptNum: aptNum } });
    await prisma.patient.delete({ where: { PatNum: patient.PatNum } });
    await prisma.provider.delete({ where: { ProvNum: provNum } });
  });

  it('resolves treating provider via patient.PriProv (Tier 3)', async () => {
    const provNum = await getNextId('provider', 'ProvNum');
    await prisma.provider.create({
      data: { ProvNum: provNum, Abbr: 'T3PROV', FName: 'Tier3', LName: 'Prov' },
    });

    const token = uniqueToken('pri-prov');
    const alphanumeric = token.replace(/[^A-Za-z0-9]/g, '');
    const patient = await createPatientRecord(alphanumeric);
    await prisma.patient.update({
      where: { PatNum: patient.PatNum },
      data: { PriProv: provNum },
    });

    const resolved = await providerResolutionService.resolveClaimProviders({
      patientId: patient.PatNum,
    });

    expect(resolved.treatingProvNum).toBe(provNum);

    await prisma.patient.delete({ where: { PatNum: patient.PatNum } });
    await prisma.provider.delete({ where: { ProvNum: provNum } });
  });

  it('resolves treating provider via clinic.DefaultProv (Tier 4)', async () => {
    const provNum = await getNextId('provider', 'ProvNum');
    await prisma.provider.create({
      data: { ProvNum: provNum, Abbr: 'T4PROV', FName: 'Tier4', LName: 'Prov' },
    });

    const clinicNum = await getNextId('clinic', 'ClinicNum');
    await prisma.clinic.create({
      data: {
        ClinicNum: clinicNum,
        Description: 'Test Clinic Default Prov',
        DefaultProv: provNum,
      },
    });

    const resolved = await providerResolutionService.resolveClaimProviders({
      clinicId: clinicNum,
    });

    expect(resolved.treatingProvNum).toBe(provNum);

    await prisma.clinic.delete({ where: { ClinicNum: clinicNum } });
    await prisma.provider.delete({ where: { ProvNum: provNum } });
  });

  it('resolves billing provider via clinic.InsBillingProv override', async () => {
    const treatingProvNum = await getNextId('provider', 'ProvNum');
    await prisma.provider.create({
      data: { ProvNum: treatingProvNum, Abbr: 'TREAT', FName: 'Treating', LName: 'Doctor' },
    });

    const billingProvNum = await getNextId('provider', 'ProvNum');
    await prisma.provider.create({
      data: { ProvNum: billingProvNum, Abbr: 'BILL', FName: 'Billing', LName: 'Entity' },
    });

    const clinicNum = await getNextId('clinic', 'ClinicNum');
    await prisma.clinic.create({
      data: {
        ClinicNum: clinicNum,
        Description: 'Clinic With InsBillingProv',
        InsBillingProv: billingProvNum,
      },
    });

    const resolved = await providerResolutionService.resolveClaimProviders({
      itemProvNum: treatingProvNum,
      clinicId: clinicNum,
    });

    expect(resolved.treatingProvNum).toBe(treatingProvNum);
    expect(resolved.billingProvNum).toBe(billingProvNum);

    await prisma.clinic.delete({ where: { ClinicNum: clinicNum } });
    await prisma.provider.deleteMany({ where: { ProvNum: { in: [treatingProvNum, billingProvNum] } } });
  });

  it('throws specific error when treating provider cannot resolve', async () => {
    await expect(
      providerResolutionService.resolveClaimProviders({})
    ).rejects.toThrow('Unable to resolve treating provider for claim');
  });

  it('throws specific error when billing provider cannot resolve', async () => {
    const treatingProvNum = await getNextId('provider', 'ProvNum');
    await prisma.provider.create({
      data: { ProvNum: treatingProvNum, Abbr: 'NOFALL', FName: 'Treat', LName: 'Prov' },
    });

    await expect(
      providerResolutionService.resolveClaimProviders({
        itemProvNum: treatingProvNum,
        allowTreatingAsBilling: false,
      })
    ).rejects.toThrow('Unable to resolve billing provider for claim');

    await prisma.provider.delete({ where: { ProvNum: treatingProvNum } });
  });
});
