import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import app from '../src/app';
import { prisma } from '../src/config/db';
import { getAdminAuthHeader } from './helpers/auth';
import { uniqueToken } from './helpers/unique';
import { createPatientRecord, createInvoiceStatement } from './helpers/fixtures';

describe('Claims Procedures Fallback', () => {
  let authHeader: { Authorization: string };

  beforeAll(async () => {
    authHeader = await getAdminAuthHeader();
  });

  it('correctly returns procedures of the linked invoice for a draft claim', async () => {
    const token = uniqueToken('claim-proc');
    const patient = await createPatientRecord(token);
    
    // Create an invoice
    const statement = await createInvoiceStatement({
      patientId: patient.PatNum,
      token,
    });

    // Create a procedure linked to the invoice (StatementNum)
    const procNum = BigInt(Date.now()); // Using time to avoid collisions
    const procedure = await prisma.procedurelog.create({
      data: {
        ProcNum: procNum,
        PatNum: patient.PatNum,
        ProcDate: new Date(),
        ProcFee: 150,
        UnitQty: 1,
        StatementNum: statement.StatementNum,
        ProcStatus: 1, // Treatment Planned
        OldCode: 'D0120',
        BillingNote: JSON.stringify({
          description: 'Periodic Oral Evaluation',
          unitPrice: 150,
          quantity: 1,
        }),
      },
    });

    // Create a draft claim from the invoice
    const claimRes = await request(app)
      .post(`/api/claims/from-invoice/${statement.StatementNum}`)
      .set(authHeader)
      .send({
        insuranceType: 'Primary',
        claimAmount: 150,
        submittedAmount: 150,
      });

    expect(claimRes.status).toBe(201);
    const createdClaim = claimRes.body?.data?.claim;
    expect(createdClaim).toBeDefined();
    expect(createdClaim.invoiceRefId).toBe(statement.StatementNum.toString());
    expect(createdClaim.procedures).toBeDefined();
    expect(createdClaim.procedures.length).toBe(1);
    expect(createdClaim.procedures[0].id).toBe(procedure.ProcNum.toString());
    expect(createdClaim.procedures[0].code).toBe('D0120');

    // Test getAllClaims returns it with procedures
    const allClaimsRes = await request(app)
      .get(`/api/claims?patientId=${patient.PatNum}&status=draft`)
      .set(authHeader);

    expect(allClaimsRes.status).toBe(200);
    const claims = allClaimsRes.body?.data?.claims ?? [];
    const claimInList = claims.find((c: any) => c.id === createdClaim.id);
    expect(claimInList).toBeDefined();
    expect(claimInList.procedures).toBeDefined();
    expect(claimInList.procedures.length).toBe(1);
    expect(claimInList.procedures[0].code).toBe('D0120');

    // Test getClaimById returns it with procedures
    const singleClaimRes = await request(app)
      .get(`/api/claims/${createdClaim.id}`)
      .set(authHeader);

    expect(singleClaimRes.status).toBe(200);
    const claimFetched = singleClaimRes.body?.data?.claim;
    expect(claimFetched).toBeDefined();
    expect(claimFetched.procedures).toBeDefined();
    expect(claimFetched.procedures.length).toBe(1);
    expect(claimFetched.procedures[0].code).toBe('D0120');

    // Clean up
    await prisma.claimtracking.deleteMany({ where: { ClaimNum: BigInt(createdClaim.id) } });
    await prisma.procedurelog.delete({ where: { ProcNum: procNum } });
    await prisma.claim.delete({ where: { ClaimNum: BigInt(createdClaim.id) } });
    await prisma.statement.delete({ where: { StatementNum: statement.StatementNum } });
    await prisma.patient.delete({ where: { PatNum: patient.PatNum } });
  });

  it('automatically generates a draft claim for an unbilled invoice when new insurance is added', async () => {
    const token = uniqueToken('autoclaim');
    const alphanumericToken = token.replace(/[^A-Za-z0-9]/g, '');
    const patient = await createPatientRecord(alphanumericToken);
    
    // Create an invoice statement
    const statement = await createInvoiceStatement({
      patientId: patient.PatNum,
      token: alphanumericToken,
    });

    // Create an insurance company (carrier)
    const carrierNum = BigInt(Date.now() - Math.floor(Math.random() * 1000000));
    await prisma.carrier.create({
      data: {
        CarrierNum: carrierNum,
        CarrierName: `Carrier-${alphanumericToken}`,
        ElectID: `EL${alphanumericToken.substring(0, 3)}`,
      },
    });

    // Add insurance to patient
    const res = await request(app)
      .post(`/api/patients/${patient.PatNum}/insurance`)
      .set(authHeader)
      .send({
        insuranceType: 'primary',
        insuranceCompanyId: carrierNum.toString(),
        relationshipToPatient: 'self',
        effectiveDate: new Date().toISOString(),
        policyNumber: `POL${alphanumericToken.substring(0, 10)}`,
        subscriberName: `SubName`,
        subscriberDateOfBirth: new Date(1990, 0, 1).toISOString(),
      });

    expect(res.status).toBe(201);
    const createdInsurance = res.body?.data;
    expect(createdInsurance).toBeDefined();

    // Since claim generation is asynchronous (uses Promise.resolve().then),
    // wait briefly for the claim to be generated
    await new Promise((resolve) => setTimeout(resolve, 500));

    // Query for draft claims for this patient
    const allClaimsRes = await request(app)
      .get(`/api/claims?patientId=${patient.PatNum}&status=draft`)
      .set(authHeader);

    expect(allClaimsRes.status).toBe(200);
    const claims = allClaimsRes.body?.data?.claims ?? [];
    const claim = claims.find((c: any) => c.invoiceRefId === statement.StatementNum.toString());

    expect(claim).toBeDefined();
    expect(claim.status).toBe('draft');
    expect(claim.insuranceCompanyRefId).toBe(carrierNum.toString());

    // Clean up
    await prisma.claimtracking.deleteMany({ where: { ClaimNum: BigInt(claim.id) } });
    await prisma.claimproc.deleteMany({ where: { ClaimNum: BigInt(claim.id) } });
    await prisma.claim.delete({ where: { ClaimNum: BigInt(claim.id) } });
    await prisma.patplan.deleteMany({ where: { PatNum: patient.PatNum } });
    await prisma.inssub.deleteMany({ where: { Subscriber: patient.PatNum } });
    // Find and delete the insplan created for the patplan
    const insPlans = await prisma.insplan.findMany({ where: { CarrierNum: carrierNum } });
    for (const plan of insPlans) {
      await prisma.insplan.delete({ where: { PlanNum: plan.PlanNum } });
    }
    await prisma.carrier.delete({ where: { CarrierNum: carrierNum } });
    await prisma.statement.delete({ where: { StatementNum: statement.StatementNum } });
    await prisma.patient.delete({ where: { PatNum: patient.PatNum } });
  });
});

