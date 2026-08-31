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
    await prisma.claimproc.deleteMany({ where: { ClaimNum: BigInt(createdClaim.id) } });
    await prisma.procedurelog.delete({ where: { ProcNum: procNum } });
    await prisma.claim.delete({ where: { ClaimNum: BigInt(createdClaim.id) } });
    await prisma.statement.delete({ where: { StatementNum: statement.StatementNum } });
    // Claim creation triggers agingService.updatePatientAging(), which upserts a famaging
    // row for the patient (no Prisma model — raw delete, same as aging.service.ts does).
    await prisma.$executeRawUnsafe(`DELETE FROM famaging WHERE "PatNum" = $1`, patient.PatNum);
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
    await prisma.$executeRawUnsafe(`DELETE FROM famaging WHERE "PatNum" = $1`, patient.PatNum);
    await prisma.patient.delete({ where: { PatNum: patient.PatNum } });
  });

  it('correctly filters claims by patientName, carrierName, hasAttachment, and claimFormat', async () => {
    const token = uniqueToken('filtertest');
    const alphanumericToken = token.replace(/[^A-Za-z0-9]/g, '');
    const patient = await createPatientRecord(alphanumericToken);

    // Create an invoice statement
    const statement = await createInvoiceStatement({
      patientId: patient.PatNum,
      token: alphanumericToken,
    });

    // Create an insurance company (carrier)
    const carrierNum = BigInt(Date.now() - Math.floor(Math.random() * 1000000));
    const carrierName = `CarrierName${alphanumericToken}`;
    const uniqueElectId = `EL${Math.floor(100 + Math.random() * 900)}${alphanumericToken.substring(0, 2)}`;
    await prisma.carrier.create({
      data: {
        CarrierNum: carrierNum,
        CarrierName: carrierName,
        ElectID: uniqueElectId,
      },
    });

    // Create a draft claim from invoice manually so it is associated with carrier
    const claimRes = await request(app)
      .post(`/api/claims/from-invoice/${statement.StatementNum}`)
      .set(authHeader)
      .send({
        insuranceType: 'Primary',
        claimAmount: 150,
        submittedAmount: 150,
        insuranceCompanyId: carrierNum.toString(),
      });

    expect(claimRes.status).toBe(201);
    const createdClaim = claimRes.body?.data?.claim;
    expect(createdClaim).toBeDefined();

    // 1. Verify filtering by patientName
    const filterPatNameRes = await request(app)
      .get(`/api/claims?patientName=${patient.FName}`)
      .set(authHeader);
    expect(filterPatNameRes.status).toBe(200);
    expect(filterPatNameRes.body?.data?.claims?.some((c: any) => c.id === createdClaim.id)).toBe(true);

    // 2. Verify filtering by carrierName
    const filterCarrierRes = await request(app)
      .get(`/api/claims?carrierName=${carrierName}`)
      .set(authHeader);
    expect(filterCarrierRes.status).toBe(200);
    expect(filterCarrierRes.body?.data?.claims?.some((c: any) => c.id === createdClaim.id)).toBe(true);

    // 3. Verify filtering by claimFormat (should be E-claim by default)
    const filterFormatRes = await request(app)
      .get(`/api/claims?claimFormat=E-claim`)
      .set(authHeader);
    expect(filterFormatRes.status).toBe(200);
    expect(filterFormatRes.body?.data?.claims?.some((c: any) => c.id === createdClaim.id)).toBe(true);

    // 4. Verify filtering by claimFormat = Paper does not return the E-claim
    const filterFormatPaperRes = await request(app)
      .get(`/api/claims?claimFormat=Paper`)
      .set(authHeader);
    console.log("createdClaim:", createdClaim);
    console.log("filterFormatPaperRes claims:", filterFormatPaperRes.body?.data?.claims);
    expect(filterFormatPaperRes.status).toBe(200);
    expect(filterFormatPaperRes.body?.data?.claims?.some((c: any) => c.id === createdClaim.id)).toBe(false);

    // 5. Verify hasAttachment filtering (no attachment yet, so should be false)
    const filterAttachmentRes = await request(app)
      .get(`/api/claims?hasAttachment=true`)
      .set(authHeader);
    expect(filterAttachmentRes.status).toBe(200);
    expect(filterAttachmentRes.body?.data?.claims?.some((c: any) => c.id === createdClaim.id)).toBe(false);

    // Clean up
    await prisma.claimtracking.deleteMany({ where: { ClaimNum: BigInt(createdClaim.id) } });
    await prisma.claimproc.deleteMany({ where: { ClaimNum: BigInt(createdClaim.id) } });
    await prisma.claim.delete({ where: { ClaimNum: BigInt(createdClaim.id) } });
    await prisma.carrier.delete({ where: { CarrierNum: carrierNum } });
    await prisma.statement.delete({ where: { StatementNum: statement.StatementNum } });
    await prisma.$executeRawUnsafe(`DELETE FROM famaging WHERE "PatNum" = $1`, patient.PatNum);
    await prisma.patient.delete({ where: { PatNum: patient.PatNum } });
  });

  it('returns 404 when updating patient insurance with non-existent carrier ID', async () => {
    const token = uniqueToken('insupdfail');
    const alphanumericToken = token.replace(/[^A-Za-z0-9]/g, '');
    const patient = await createPatientRecord(alphanumericToken);
    
    // Create carrier
    const carrierNum = BigInt(Date.now() - Math.floor(Math.random() * 1000000));
    const uniqueElectId = `EL${Math.floor(100 + Math.random() * 900)}${alphanumericToken.substring(0, 2)}`;
    await prisma.carrier.create({
      data: {
        CarrierNum: carrierNum,
        CarrierName: `Carrier-${alphanumericToken}`,
        ElectID: uniqueElectId,
      },
    });

    // Create patient insurance
    const insRes = await request(app)
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

    expect(insRes.status).toBe(201);
    const insurance = insRes.body?.data?.insurance;
    expect(insurance).toBeDefined();

    // Now try to update the patient insurance with a non-existent carrier ID
    const nonExistentCarrierId = '999999999';
    const updateRes = await request(app)
      .put(`/api/patients/${patient.PatNum}/insurance/${insurance._id}`)
      .set(authHeader)
      .send({
        insuranceCompanyId: nonExistentCarrierId,
      });

    expect(updateRes.status).toBe(404);
    expect(updateRes.body?.error?.message).toContain('Insurance company not found');

    // Clean up
    await prisma.patplan.deleteMany({ where: { PatNum: patient.PatNum } });
    await prisma.inssub.deleteMany({ where: { Subscriber: patient.PatNum } });
    const insPlans = await prisma.insplan.findMany({ where: { CarrierNum: carrierNum } });
    for (const plan of insPlans) {
      await prisma.insplan.delete({ where: { PlanNum: plan.PlanNum } });
    }
    await prisma.carrier.delete({ where: { CarrierNum: carrierNum } });
    await prisma.patient.delete({ where: { PatNum: patient.PatNum } });
  });

  it('generates and retrieves the ADA claim form PDF', async () => {
    const token = uniqueToken('claim-pdf');
    const patient = await createPatientRecord(token);
    
    const carrierNum = BigInt(Date.now() + 10);
    const carrier = await prisma.carrier.create({
      data: {
        CarrierNum: carrierNum,
        CarrierName: `Test Carrier ${token}`,
        Address: '123 Test St',
        City: 'Test City',
        State: 'TS',
        Zip: '12345',
        ElectID: `ELT-${token.substring(0, 10)}`,
      },
    });

    const insPlanNum = BigInt(Date.now() + 20);
    const insPlan = await prisma.insplan.create({
      data: {
        PlanNum: insPlanNum,
        CarrierNum: carrierNum,
      },
    });

    const claimNum = BigInt(Date.now() + 30);
    const claim = await prisma.claim.create({
      data: {
        ClaimNum: claimNum,
        PatNum: patient.PatNum,
        PlanNum: insPlanNum,
        ClaimFee: 150,
        DateService: new Date(),
        ClaimType: 'Manual',
      },
    });

    const res = await request(app)
      .get(`/api/claims/${claimNum}/pdf`)
      .set(authHeader);

    expect(res.status).toBe(200);
    expect(res.header['content-type']).toBe('application/pdf');
    expect(res.header['content-disposition']).toContain(`claim_${claimNum}.pdf`);
    expect(res.body).toBeDefined();

    // Clean up
    await prisma.claim.delete({ where: { ClaimNum: claimNum } });
    await prisma.insplan.delete({ where: { PlanNum: insPlanNum } });
    await prisma.carrier.delete({ where: { CarrierNum: carrierNum } });
    await prisma.patient.delete({ where: { PatNum: patient.PatNum } });
  });

  it('allows uploading multiple attachments for a claim', async () => {
    const token = uniqueToken('claim-attach');
    const patient = await createPatientRecord(token);
    
    const carrierNum = BigInt(Date.now() + 10);
    const carrier = await prisma.carrier.create({
      data: {
        CarrierNum: carrierNum,
        CarrierName: `Test Carrier ${token}`,
        Address: '123 Test St',
        City: 'Test City',
        State: 'TS',
        Zip: '12345',
        ElectID: `ELT-${token.substring(0, 10)}`,
      },
    });

    const insPlanNum = BigInt(Date.now() + 20);
    const insPlan = await prisma.insplan.create({
      data: {
        PlanNum: insPlanNum,
        CarrierNum: carrierNum,
      },
    });

    const claimNum = BigInt(Date.now() + 30);
    const claim = await prisma.claim.create({
      data: {
        ClaimNum: claimNum,
        PatNum: patient.PatNum,
        PlanNum: insPlanNum,
        ClaimFee: 150,
        DateService: new Date(),
        ClaimType: 'Manual',
      },
    });

    const res = await request(app)
      .post(`/api/claims/${claimNum}/attachments`)
      .set(authHeader)
      .attach('attachments', Buffer.from('file contents 1'), 'doc1.pdf')
      .attach('attachments', Buffer.from('file contents 2'), 'doc2.png');

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.attachments).toBeDefined();
    expect(res.body.data.attachments.length).toBe(2);
    expect(res.body.data.attachments[0].documentName).toBe('doc1.pdf');
    expect(res.body.data.attachments[1].documentName).toBe('doc2.png');

    // Verify database entries
    const dbClaimAttaches = await prisma.claimattach.findMany({
      where: { ClaimNum: claimNum },
    });
    expect(dbClaimAttaches.length).toBe(2);

    const dbDocuments = await prisma.document.findMany({
      where: {
        Note: { contains: `\"claimId\":\"${claimNum}\"` },
      },
    });
    expect(dbDocuments.length).toBe(2);

    // Clean up
    for (const doc of dbDocuments) {
      await prisma.document.delete({ where: { DocNum: doc.DocNum } });
    }
    await prisma.claimattach.deleteMany({ where: { ClaimNum: claimNum } });
    await prisma.claim.delete({ where: { ClaimNum: claimNum } });
    await prisma.insplan.delete({ where: { PlanNum: insPlanNum } });
    await prisma.carrier.delete({ where: { CarrierNum: carrierNum } });
    await prisma.patient.delete({ where: { PatNum: patient.PatNum } });
  });

  it('deletes claim attachments from both document and claimattach tables', async () => {
    const token = uniqueToken('claim-del-attach');
    const patient = await createPatientRecord(token);
    
    const carrierNum = BigInt(Date.now() + 10);
    await prisma.carrier.create({
      data: {
        CarrierNum: carrierNum,
        CarrierName: `Test Carrier ${token}`,
        Address: '123 Test St',
        City: 'Test City',
        State: 'TS',
        Zip: '12345',
        ElectID: `ELT-${token.substring(0, 10)}`,
      },
    });

    const insPlanNum = BigInt(Date.now() + 20);
    await prisma.insplan.create({
      data: {
        PlanNum: insPlanNum,
        CarrierNum: carrierNum,
      },
    });

    const claimNum = BigInt(Date.now() + 30);
    await prisma.claim.create({
      data: {
        ClaimNum: claimNum,
        PatNum: patient.PatNum,
        PlanNum: insPlanNum,
        ClaimFee: 150,
        DateService: new Date(),
        ClaimType: 'Manual',
      },
    });

    // Upload an attachment
    const uploadRes = await request(app)
      .post(`/api/claims/${claimNum}/attachments`)
      .set(authHeader)
      .attach('attachments', Buffer.from('file contents'), 'doc1.pdf');

    expect(uploadRes.status).toBe(201);
    const uploadedAttach = uploadRes.body.data.attachments[0];
    const docId = uploadedAttach.id;

    // Verify it is in both tables
    const dbClaimAttachesBefore = await prisma.claimattach.findMany({
      where: { ClaimNum: claimNum },
    });
    expect(dbClaimAttachesBefore.length).toBe(1);

    const dbDocumentsBefore = await prisma.document.findMany({
      where: { DocNum: BigInt(docId) },
    });
    expect(dbDocumentsBefore.length).toBe(1);

    // Call DELETE /api/claims/:claimId/documents/:documentId
    const delRes = await request(app)
      .delete(`/api/claims/${claimNum}/documents/${docId}`)
      .set(authHeader);

    expect(delRes.status).toBe(200);

    // Verify it is removed from both tables
    const dbClaimAttachesAfter = await prisma.claimattach.findMany({
      where: { ClaimNum: claimNum },
    });
    expect(dbClaimAttachesAfter.length).toBe(0);

    const dbDocumentsAfter = await prisma.document.findMany({
      where: { DocNum: BigInt(docId) },
    });
    expect(dbDocumentsAfter.length).toBe(0);

    // Clean up
    await prisma.claim.delete({ where: { ClaimNum: claimNum } });
    await prisma.insplan.delete({ where: { PlanNum: insPlanNum } });
    await prisma.carrier.delete({ where: { CarrierNum: carrierNum } });
    await prisma.patient.delete({ where: { PatNum: patient.PatNum } });
  });

  it('correctly calculates patient coverage (90%) for invoice and claim patbalance / insbalance', async () => {
    const token = uniqueToken('covtest');
    const alphanumericToken = token.replace(/[^A-Za-z0-9]/g, '');
    const patient = await createPatientRecord(alphanumericToken);

    // Create an insurance carrier
    const carrierNum = BigInt(Date.now() - Math.floor(Math.random() * 1000000));
    const uniqueElectId = `EL${Math.floor(100 + Math.random() * 900)}${alphanumericToken.substring(0, 2)}`;
    await prisma.carrier.create({
      data: {
        CarrierNum: carrierNum,
        CarrierName: `Carrier-${alphanumericToken}`,
        ElectID: uniqueElectId,
      },
    });

    // Add primary insurance for patient with 60% diagnostic and 90% restorative coverage
    const insRes = await request(app)
      .post(`/api/patients/${patient.PatNum}/insurance`)
      .set(authHeader)
      .send({
        insuranceType: 'primary',
        insuranceCompanyId: carrierNum.toString(),
        relationshipToPatient: 'self',
        effectiveDate: new Date().toISOString(),
        policyNumber: `POL${alphanumericToken.substring(0, 10)}`,
        subscriberName: 'Test Subscriber',
        subscriberDateOfBirth: '1990-01-01T00:00:00.000Z',
        coverageCategoryTable: [
          {
            category: 'diagnostic',
            coverage: 60,
          },
          {
            category: 'restorative',
            coverage: 90,
          },
        ],
      });

    expect(insRes.status).toBe(201);

    // Create an invoice for patient
    const statement = await createInvoiceStatement({
      patientId: patient.PatNum,
      token: alphanumericToken,
    });

    // Add a $100 Diagnostic procedure (D0120) to invoice
    const diagItemRes = await request(app)
      .post(`/api/invoices/${statement.StatementNum}/items`)
      .set(authHeader)
      .send({
        cptCode: 'D0120',
        description: 'Periodic oral evaluation - established patient',
        quantity: 1,
        unitPrice: 100,
      });

    expect(diagItemRes.status).toBe(201);
    const diagItemData = diagItemRes.body?.data?.item || diagItemRes.body?.data;
    expect(diagItemData.insPortion).toBe(60);
    expect(diagItemData.ptPortion).toBe(40);

    // Add a $100 Restorative procedure (D2140) to invoice
    const restItemRes = await request(app)
      .post(`/api/invoices/${statement.StatementNum}/items`)
      .set(authHeader)
      .send({
        cptCode: 'D2140',
        description: 'Amalgam - one surface, primary or permanent',
        quantity: 1,
        unitPrice: 100,
      });

    expect(restItemRes.status).toBe(201);
    const restItemData = restItemRes.body?.data?.item || restItemRes.body?.data;
    expect(restItemData.insPortion).toBe(90);
    expect(restItemData.ptPortion).toBe(10);

    // Claim generation/update is asynchronous (setImmediate) — adding the second item triggers
    // a background update of the claim's insurance totals. Wait for it before asserting, same
    // pattern used above for the initial async claim generation.
    await new Promise((resolve) => setTimeout(resolve, 500));

    // Fetch the claim generated for invoice
    const claimsRes = await request(app)
      .get(`/api/claims?patientId=${patient.PatNum}`)
      .set(authHeader);

    expect(claimsRes.status).toBe(200);
    const claims = claimsRes.body?.data?.claims || [];
    const claim = claims[0];
    expect(claim).toBeDefined();
    expect(claim.insbalance).toBe(150);
    expect(claim.patbalance).toBe(50);
    expect(claim.patientResponsibility).toBe(50);

    // Clean up all claims for patient
    const patClaims = await prisma.claim.findMany({ where: { PatNum: patient.PatNum } });
    const claimNums = patClaims.map(c => c.ClaimNum);
    if (claimNums.length > 0) {
      await prisma.claimtracking.deleteMany({ where: { ClaimNum: { in: claimNums } } });
      await prisma.claimproc.deleteMany({ where: { ClaimNum: { in: claimNums } } });
      await prisma.claim.deleteMany({ where: { PatNum: patient.PatNum } });
    }
    await prisma.procedurelog.deleteMany({ where: { StatementNum: statement.StatementNum } });
    await prisma.patplan.deleteMany({ where: { PatNum: patient.PatNum } });
    await prisma.inssub.deleteMany({ where: { Subscriber: patient.PatNum } });
    const insPlans = await prisma.insplan.findMany({ where: { CarrierNum: carrierNum } });
    for (const plan of insPlans) {
      await prisma.insplan.delete({ where: { PlanNum: plan.PlanNum } });
    }
    await prisma.carrier.delete({ where: { CarrierNum: carrierNum } });
    await prisma.statement.delete({ where: { StatementNum: statement.StatementNum } });
    await prisma.$executeRawUnsafe(`DELETE FROM famaging WHERE "PatNum" = $1`, patient.PatNum);
    await prisma.patient.delete({ where: { PatNum: patient.PatNum } });
  });

  it('supports uploading and deleting claim-level EOB documents', async () => {
    const token = uniqueToken('claim-eob');
    const patient = await createPatientRecord(token);
    const claimNum = BigInt(Date.now());

    // Create a claim directly
    await prisma.claim.create({
      data: {
        ClaimNum: claimNum,
        PatNum: patient.PatNum,
        ClaimFee: 200,
        ClaimType: 'Manual',
        ClaimStatus: 'W',
        DateService: new Date(),
        Narrative: JSON.stringify({ note: 'EOB test claim' }),
      },
    });

    // 1. Upload EOB PDF
    const uploadRes = await request(app)
      .post(`/api/claims/${claimNum}/eob`)
      .set(authHeader)
      .attach('file', Buffer.from('dummy pdf content'), 'sample_eob.pdf');

    expect(uploadRes.status).toBe(200);
    expect(uploadRes.body?.success).toBe(true);
    expect(uploadRes.body?.data?.eob).toBeDefined();
    expect(uploadRes.body?.data?.eob?.filename).toBe('sample_eob.pdf');
    expect(uploadRes.body?.data?.eobs?.length).toBe(1);

    const uploadedEobId = uploadRes.body.data.eob.id;

    // 2. Fetch claim by ID and verify eobs array
    const getRes = await request(app)
      .get(`/api/claims/${claimNum}`)
      .set(authHeader);

    expect(getRes.status).toBe(200);
    const claimData = getRes.body?.data?.claim;
    expect(claimData?.eobs).toBeDefined();
    expect(claimData.eobs.length).toBe(1);
    expect(claimData.eobs[0].id).toBe(uploadedEobId);
    expect(claimData.eobs[0].filename).toBe('sample_eob.pdf');

    // 3. Delete EOB
    const deleteRes = await request(app)
      .delete(`/api/claims/${claimNum}/eob/${uploadedEobId}`)
      .set(authHeader);

    expect(deleteRes.status).toBe(200);
    expect(deleteRes.body?.success).toBe(true);
    expect(deleteRes.body?.data?.eobs?.length).toBe(0);

    // 4. Verify claim EOBs list is empty after deletion
    const getAfterDeleteRes = await request(app)
      .get(`/api/claims/${claimNum}`)
      .set(authHeader);

    expect(getAfterDeleteRes.status).toBe(200);
    expect(getAfterDeleteRes.body?.data?.claim?.eobs?.length).toBe(0);

    // Clean up
    await prisma.claim.delete({ where: { ClaimNum: claimNum } });
    await prisma.$executeRawUnsafe(`DELETE FROM famaging WHERE "PatNum" = $1`, patient.PatNum);
    await prisma.patient.delete({ where: { PatNum: patient.PatNum } });
  });

  describe('Void and Recreate Claim', () => {
    it('successfully voids a submitted claim, resets dates, and returns it to unsent queue with readyForSubmission status', async () => {
      const token = uniqueToken('void-rec');
      const patient = await createPatientRecord(token);
      const claimNum = BigInt(Date.now() + 1234);

      // Create a submitted claim (ClaimStatus = 'S', DateSent set)
      await prisma.claim.create({
        data: {
          ClaimNum: claimNum,
          PatNum: patient.PatNum,
          ClaimStatus: 'S',
          ClaimType: 'Primary',
          ClaimFee: 300,
          DateService: new Date('2026-03-01'),
          DateSent: new Date('2026-03-02'),
          Narrative: JSON.stringify({
            status: 'submitted',
            submissionDate: new Date('2026-03-02').toISOString(),
          }),
        },
      });

      // Call void-and-recreate endpoint
      const voidRes = await request(app)
        .post(`/api/claims/${claimNum}/void-and-recreate`)
        .set(authHeader)
        .send({ note: 'Voided and recreated test claim' });

      expect(voidRes.status).toBe(200);
      expect(voidRes.body?.success).toBe(true);
      expect(voidRes.body?.message).toBe('Claim voided and recreated successfully');
      
      const voidedClaim = voidRes.body?.data?.claim;
      expect(voidedClaim).toBeDefined();
      expect(voidedClaim.status).toBe('readyForSubmission');
      expect(voidedClaim.dateSent).toBeNull();

      // Check in DB directly
      const dbClaim = await prisma.claim.findUnique({
        where: { ClaimNum: claimNum },
      });
      expect(dbClaim?.ClaimStatus).toBe('W'); // W = readyForSubmission
      expect(dbClaim?.DateSent).toBeNull();

      // Verify it appears in unsent queue
      const unsentRes = await request(app)
        .get(`/api/claims?patientId=${patient.PatNum}&tab=unsent`)
        .set(authHeader);

      expect(unsentRes.status).toBe(200);
      const unsentClaims = unsentRes.body?.data?.claims ?? [];
      const found = unsentClaims.find((c: any) => c.id === claimNum.toString());
      expect(found).toBeDefined();
      expect(found.status).toBe('readyForSubmission');

      // Clean up
      await prisma.claimtracking.deleteMany({ where: { ClaimNum: claimNum } });
      await prisma.claim.delete({ where: { ClaimNum: claimNum } });
      await prisma.$executeRawUnsafe(`DELETE FROM famaging WHERE "PatNum" = $1`, patient.PatNum);
      await prisma.patient.delete({ where: { PatNum: patient.PatNum } });
    });
  });

  describe('Batch Invoices', () => {
    it('creates batch invoices with IsInvoice: 1 and appears in patient composite ledger', async () => {
      const token = uniqueToken('batch-inv');
      const patient = await createPatientRecord(token);

      // Generate batch invoice
      const batchRes = await request(app)
        .post('/api/claims/batch-invoices')
        .set(authHeader)
        .send({
          patientIds: [patient.PatNum.toString()],
          deliveryPreference: 'Email & SMS',
        });

      expect(batchRes.status).toBe(200);
      expect(batchRes.body?.success).toBe(true);
      expect(batchRes.body?.data?.invoicesGenerated).toBe(1);

      const generatedInvoiceId = batchRes.body?.data?.results?.[0]?.invoiceId;
      expect(generatedInvoiceId).toBeDefined();

      // Verify IsInvoice in DB
      const statement = await prisma.statement.findUnique({
        where: { StatementNum: BigInt(generatedInvoiceId) },
      });
      expect(statement).toBeDefined();
      expect(statement?.IsInvoice).toBe(1);

      // Verify it appears in patient composite ledger
      const ledgerRes = await request(app)
        .get(`/api/invoices/patient/${patient.PatNum}/composite`)
        .set(authHeader);

      expect(ledgerRes.status).toBe(200);
      expect(ledgerRes.body?.success).toBe(true);
      const invoices = ledgerRes.body?.data?.invoices ?? [];
      const foundInLedger = invoices.some((inv: any) => inv.id === generatedInvoiceId || inv.invoiceNumber === statement?.ShortGUID);
      expect(foundInLedger).toBe(true);

      // Clean up
      await prisma.statement.deleteMany({ where: { PatNum: patient.PatNum } });
      await prisma.$executeRawUnsafe(`DELETE FROM famaging WHERE "PatNum" = $1`, patient.PatNum);
      await prisma.patient.delete({ where: { PatNum: patient.PatNum } });
    });
  });
});




