import { describe, it, expect } from 'vitest';
import { prisma } from '../src/config/db.js';
import { edi837Service, isValidNPI } from '../src/services/edi837.service.js';
import { getNextId } from '../src/utils/opendental-ids.util.js';
import { uniqueToken } from './helpers/unique.js';
import { createPatientRecord } from './helpers/fixtures.js';

describe('Phase 5: 837D Dental EDI Claim Engine', () => {
  describe('NPI Luhn Algorithm Verification', () => {
    it('validates genuine NPIs with check digits and rejects invalid ones', () => {
      // 1234567893 has valid Luhn check digit 3
      expect(isValidNPI('1234567893')).toBe(true);
      // 1234567890 has invalid check digit 0
      expect(isValidNPI('1234567890')).toBe(false);
      // Not 10 digits
      expect(isValidNPI('12345')).toBe(false);
      expect(isValidNPI('')).toBe(false);
      expect(isValidNPI(null)).toBe(false);
    });
  });

  describe('Pre-validation Gates & Segment Generation', () => {
    it('validates gates and generates structurally compliant X12 837D file', async () => {
      const token = uniqueToken('edi-837');
      const alphanumeric = token.replace(/[^A-Za-z0-9]/g, '');
      const patient = await createPatientRecord(alphanumeric);

      // Create provider with valid NPI (1234567893)
      const provNum = await getNextId('provider', 'ProvNum');
      await prisma.provider.create({
        data: {
          ProvNum: provNum,
          Abbr: `E${alphanumeric.slice(-4)}`,
          FName: 'Dental',
          LName: 'Surgeon',
          NationalProvID: '1234567893', // Valid NPI
          SSN: '987654321',
        },
      });

      // Create carrier with valid ElectID
      const carrierNum = await getNextId('carrier', 'CarrierNum');
      await prisma.carrier.create({
        data: {
          CarrierNum: carrierNum,
          CarrierName: `Delta Dental ${alphanumeric}`,
          ElectID: 'PAYER01',
          Address: '100 Payer St',
          City: 'San Francisco',
          State: 'CA',
          Zip: '94105',
        },
      });

      const planNum = await getNextId('insplan', 'PlanNum');
      await prisma.insplan.create({ data: { PlanNum: planNum, CarrierNum: carrierNum } });

      const subNum = await getNextId('inssub', 'InsSubNum');
      await prisma.inssub.create({
        data: {
          InsSubNum: subNum,
          PlanNum: planNum,
          Subscriber: patient.PatNum,
          SubscriberID: `SUB-${alphanumeric}`,
        },
      });

      // Create clinic
      const clinicNum = await getNextId('clinic', 'ClinicNum');
      await prisma.clinic.create({
        data: {
          ClinicNum: clinicNum,
          Description: 'Bright Smile Dental Center',
          Address: '500 Health Ave',
          City: 'Los Angeles',
          State: 'CA',
          Zip: '90001',
          Phone: '2135550199',
        },
      });

      // Create procedurelog
      const procNum = await getNextId('procedurelog', 'ProcNum');
      await prisma.procedurelog.create({
        data: {
          ProcNum: procNum,
          PatNum: patient.PatNum,
          ProvNum: provNum,
          ProcStatus: 2,
          ProcDate: new Date(),
          ProcFee: 850,
          ToothNum: '14',
          Surf: 'MOD',
          OldCode: 'D2750',
        },
      });

      // Create claim
      const claimNum = await getNextId('claim', 'ClaimNum');
      const claim = await prisma.claim.create({
        data: {
          ClaimNum: claimNum,
          PatNum: patient.PatNum,
          PlanNum: planNum,
          InsSubNum: subNum,
          ProvTreat: provNum,
          ProvBill: provNum,
          ClinicNum: clinicNum,
          ClaimFee: 850,
          InsPayEst: 680,
          DedApplied: 170,
          ClaimType: 'Primary',
          ClaimStatus: 'U',
          DateService: new Date(),
          ClaimIdentifier: `CLM${alphanumeric}`,
        },
      });

      // Create claimproc
      const claimProcNum = await getNextId('claimproc', 'ClaimProcNum');
      await prisma.claimproc.create({
        data: {
          ClaimProcNum: claimProcNum,
          ClaimNum: claim.ClaimNum,
          ProcNum: procNum,
          PatNum: patient.PatNum,
          ProvNum: provNum,
          PlanNum: planNum,
          InsSubNum: subNum,
          ClinicNum: clinicNum,
          FeeBilled: 850,
          InsPayEst: 680,
          DedApplied: 170,
          Status: 0,
        },
      });

      // Generate 837D
      const result = await edi837Service.generate837D(claim.ClaimNum);
      expect(result).toBeDefined();
      expect(result.x12Text).toContain('ISA*');
      expect(result.x12Text).toContain('GS*DA*');
      expect(result.x12Text).toContain('ST*837*');
      expect(result.x12Text).toContain('005010X224A2');
      expect(result.x12Text).toContain('BHT*0019*00*');
      expect(result.x12Text).toContain('1234567893'); // NPI in billing provider loop
      expect(result.x12Text).toContain('PAYER01'); // ElectID
      expect(result.x12Text).toContain('SV3*AD:D2750*850.00*'); // Service line
      expect(result.x12Text).toContain('TOO*JP*14*MOD'); // Tooth & surface
      expect(result.x12Text).toContain('SE*');
      expect(result.x12Text).toContain('GE*1*');
      expect(result.x12Text).toContain('IEA*1*');

      // Verify trailer count SE01
      const segments = result.x12Text.split('~').filter((s) => s.trim().length > 0);
      const stIdx = segments.findIndex((s) => s.startsWith('ST*'));
      const seSegment = segments.find((s) => s.startsWith('SE*'));
      const seCount = parseInt(seSegment!.split('*')[1], 10);
      const seIdx = segments.findIndex((s) => s.startsWith('SE*'));
      expect(seCount).toBe(seIdx - stIdx + 1);

      // Verify etrans record created
      const etrans = await prisma.etrans.findUnique({
        where: { EtransNum: BigInt(result.etransNum) },
        include: { etransmessagetext: true },
      });
      expect(etrans).not.toBeNull();
      expect(etrans?.Etype).toBe(1); // ClaimSent
      expect(etrans?.etransmessagetext?.MessageText).toBe(result.x12Text);

      // Verify get837DText retrieval
      const fetchedText = await edi837Service.get837DText(claim.ClaimNum);
      expect(fetchedText).toBe(result.x12Text);

      // Clean up
      await prisma.etrans.delete({ where: { EtransNum: BigInt(result.etransNum) } });
      await prisma.etransmessagetext.delete({ where: { EtransMessageTextNum: etrans!.EtransMessageTextNum! } });
      await prisma.claimproc.delete({ where: { ClaimProcNum: claimProcNum } });
      await prisma.claim.delete({ where: { ClaimNum: claimNum } });
      await prisma.procedurelog.delete({ where: { ProcNum: procNum } });
      await prisma.clinic.delete({ where: { ClinicNum: clinicNum } });
      await prisma.inssub.delete({ where: { InsSubNum: subNum } });
      await prisma.insplan.delete({ where: { PlanNum: planNum } });
      await prisma.carrier.delete({ where: { CarrierNum: carrierNum } });
      await prisma.provider.delete({ where: { ProvNum: provNum } });
      await prisma.patient.delete({ where: { PatNum: patient.PatNum } });
    });

    it('rejects claim generation when provider NPI is invalid', async () => {
      const token = uniqueToken('edi-bad-npi');
      const alphanumeric = token.replace(/[^A-Za-z0-9]/g, '');
      const patient = await createPatientRecord(alphanumeric);

      // Provider with invalid NPI (check digit doesn't match)
      const provNum = await getNextId('provider', 'ProvNum');
      await prisma.provider.create({
        data: {
          ProvNum: provNum,
          Abbr: `X${alphanumeric.slice(-4)}`,
          FName: 'Bad',
          LName: 'Doctor',
          NationalProvID: '1234567890', // Invalid NPI!
        },
      });

      const carrierNum = await getNextId('carrier', 'CarrierNum');
      await prisma.carrier.create({
        data: {
          CarrierNum: carrierNum,
          CarrierName: `Payer-${alphanumeric}`,
          ElectID: 'PAY01',
        },
      });

      const planNum = await getNextId('insplan', 'PlanNum');
      await prisma.insplan.create({ data: { PlanNum: planNum, CarrierNum: carrierNum } });

      const subNum = await getNextId('inssub', 'InsSubNum');
      await prisma.inssub.create({
        data: {
          InsSubNum: subNum,
          PlanNum: planNum,
          Subscriber: patient.PatNum,
          SubscriberID: 'SUB123',
        },
      });

      const claimNum = await getNextId('claim', 'ClaimNum');
      await prisma.claim.create({
        data: {
          ClaimNum: claimNum,
          PatNum: patient.PatNum,
          PlanNum: planNum,
          InsSubNum: subNum,
          ProvTreat: provNum,
          ProvBill: provNum,
          ClaimFee: 500,
        },
      });

      const claimProcNum = await getNextId('claimproc', 'ClaimProcNum');
      await prisma.claimproc.create({
        data: {
          ClaimProcNum: claimProcNum,
          ClaimNum: claimNum,
          PatNum: patient.PatNum,
          CodeSent: 'D0120',
          FeeBilled: 500,
        },
      });

      await expect(edi837Service.generate837D(claimNum)).rejects.toThrow(
        /Treating provider NPI is missing or invalid/
      );

      // Clean up
      await prisma.claimproc.delete({ where: { ClaimProcNum: claimProcNum } });
      await prisma.claim.delete({ where: { ClaimNum: claimNum } });
      await prisma.inssub.delete({ where: { InsSubNum: subNum } });
      await prisma.insplan.delete({ where: { PlanNum: planNum } });
      await prisma.carrier.delete({ where: { CarrierNum: carrierNum } });
      await prisma.provider.delete({ where: { ProvNum: provNum } });
      await prisma.patient.delete({ where: { PatNum: patient.PatNum } });
    });
  });
});
