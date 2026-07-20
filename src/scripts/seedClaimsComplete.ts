import { prisma } from '../config/db';
import { getNextId } from '../utils/opendental-ids.util';

const buildJson = (value: Record<string, unknown>) => JSON.stringify(value);

async function seedClaimsComplete() {
  try {
    console.log('Starting Clean Claim Management Seeding...');

    // 1. Locate or create a clean test provider
    let provider = await prisma.provider.findFirst({
      where: { LName: 'SeedBiller' },
    });
    if (!provider) {
      const provNum = await getNextId('provider', 'ProvNum');
      provider = await prisma.provider.create({
        data: {
          ProvNum: provNum,
          FName: 'Claim',
          LName: 'SeedBiller',
          Abbr: 'CSB',
          IsHidden: 0,
        },
      });
      console.log(`Created test provider: ${provider.FName} ${provider.LName}`);
    }

    // 2. Seed 4 Different Carriers
    const carriersData = [
      { name: 'Delta Dental Test PPO', electId: 'ELT999' },
      { name: 'MetLife Test Dental', electId: 'MET888' },
      { name: 'Aetna Test Dental', electId: 'AET777' },
      { name: 'Cigna Test Dental', electId: 'CIG666' },
    ];
    const carrierMap = new Map<string, any>();

    for (const cData of carriersData) {
      let carrier = await prisma.carrier.findFirst({
        where: { CarrierName: cData.name },
      });
      if (!carrier) {
        const carrierNum = await getNextId('carrier', 'CarrierNum');
        carrier = await prisma.carrier.create({
          data: {
            CarrierNum: carrierNum,
            CarrierName: cData.name,
            ElectID: cData.electId,
            Address: '123 Insurance Way',
            City: 'New York',
            State: 'NY',
            Zip: '10001',
            IsHidden: 0,
          },
        });
        console.log(`Created carrier: ${carrier.CarrierName}`);
      }
      carrierMap.set(cData.name, carrier);
    }

    // 3. Seed 7 Different Patients
    const patientsData = [
      { firstName: 'JohnClaim', lastName: 'Test', carrierName: 'Delta Dental Test PPO', subId: 'SUB-99887766' },
      { firstName: 'JaneClaim', lastName: 'Test', carrierName: 'MetLife Test Dental', subId: 'SUB-88776655' },
      { firstName: 'BobClaim', lastName: 'Test', carrierName: 'Aetna Test Dental', subId: 'SUB-77665544' },
      { firstName: 'AliceClaim', lastName: 'Test', carrierName: 'Delta Dental Test PPO', subId: 'SUB-66554433' },
      { firstName: 'CharlieClaim', lastName: 'Test', carrierName: 'MetLife Test Dental', subId: 'SUB-55443322' },
      { firstName: 'DavidClaim', lastName: 'Test', carrierName: 'Cigna Test Dental', subId: 'SUB-44332211' },
      { firstName: 'EmmaClaim', lastName: 'Test', carrierName: 'Cigna Test Dental', subId: 'SUB-33221100' },
    ];

    const patientMap = new Map<string, any>();
    const patientPlanMap = new Map<string, { insPlan: any; insSub: any }>();

    for (const pData of patientsData) {
      let patient = await prisma.patient.findFirst({
        where: { FName: pData.firstName, LName: pData.lastName },
      });
      if (!patient) {
        const patNum = await getNextId('patient', 'PatNum');
        patient = await prisma.patient.create({
          data: {
            PatNum: patNum,
            FName: pData.firstName,
            LName: pData.lastName,
            ChartNumber: `PAT${patNum.toString().padStart(3, '0')}`,
            Birthdate: new Date('1990-05-15'),
            Gender: 1, // Male
            Address: '456 Patient St',
            City: 'Brooklyn',
            State: 'NY',
            Zip: '11201',
            PatStatus: 0, // Active
            Language: 'en',
            PriProv: provider.ProvNum, // Set primary provider
          },
        });
        console.log(`Created test patient: ${patient.FName} ${patient.LName} (Code: ${patient.ChartNumber})`);
      }
      patientMap.set(pData.firstName, patient);

      // Create insurance subscription structure for this patient if not present
      let patPlan = await prisma.patplan.findFirst({
        where: { PatNum: patient.PatNum },
      });

      let insPlan;
      let insSub;
      const carrier = carrierMap.get(pData.carrierName);

      if (!patPlan) {
        const planNum = await getNextId('insplan', 'PlanNum');
        insPlan = await prisma.insplan.create({
          data: {
            PlanNum: planNum,
            CarrierNum: carrier.CarrierNum,
            GroupName: `${pData.firstName} Seed Group`,
            GroupNum: `CSG-${pData.firstName.toUpperCase()}`,
            PlanType: 'p',
          },
        });

        const subNum = await getNextId('inssub', 'InsSubNum');
        insSub = await prisma.inssub.create({
          data: {
            InsSubNum: subNum,
            PlanNum: insPlan.PlanNum,
            Subscriber: patient.PatNum,
            SubscriberID: pData.subId,
          },
        });

        const patPlanNum = await getNextId('patplan', 'PatPlanNum');
        patPlan = await prisma.patplan.create({
          data: {
            PatPlanNum: patPlanNum,
            PatNum: patient.PatNum,
            InsSubNum: insSub.InsSubNum,
            Ordinal: 1, // Primary
            Relationship: 0, // Self
          },
        });
        console.log(`Created insurance sub-structure for ${patient.FName} linked to ${carrier.CarrierName}`);
      } else {
        insSub = await prisma.inssub.findUnique({
          where: { InsSubNum: patPlan.InsSubNum ?? undefined },
        });
        insPlan = await prisma.insplan.findUnique({
          where: { PlanNum: insSub?.PlanNum ?? undefined },
        });
      }

      if (!insPlan || !insSub) {
        throw new Error(`Failed to load or create insurance plan and subscriber details for patient ${patient.FName}.`);
      }

      patientPlanMap.set(pData.firstName, { insPlan, insSub });
    }

    // 4. Ensure CDT procedure codes exist in DB (D0120, D1110, D2391, D7140, D9110)
    const cdtCodes = ['D0120', 'D1110', 'D2391', 'D7140', 'D9110'];
    const codeNumMap = new Map<string, bigint>();

    for (const code of cdtCodes) {
      let procCode = await prisma.procedurecode.findFirst({
        where: { ProcCode: code },
      });
      if (!procCode) {
        const codeNum = await getNextId('procedurecode', 'CodeNum');
        procCode = await prisma.procedurecode.create({
          data: {
            CodeNum: codeNum,
            ProcCode: code,
            Descript: `Procedure ${code}`,
            AbbrDesc: code,
            TreatArea: 'MOUTH',
            NoBillIns: 0,
          },
        });
      }
      codeNumMap.set(code, procCode.CodeNum!);
    }

    // Helper function to create completed procedure logs
    const createProc = async (patNum: bigint, code: string, fee: number) => {
      const procNum = await getNextId('procedurelog', 'ProcNum');
      return prisma.procedurelog.create({
        data: {
          ProcNum: procNum,
          PatNum: patNum,
          CodeNum: codeNumMap.get(code)!,
          ProcFee: fee,
          ProcStatus: 2, // Complete
          ProcDate: new Date(),
          ProvNum: provider.ProvNum,
        },
      });
    };

    // Helper function to create invoice statements
    const createStatement = async (patNum: bigint, procNum: bigint, fee: number, index: number) => {
      const statementNum = await getNextId('statement', 'StatementNum');
      const stmt = await prisma.statement.create({
        data: {
          StatementNum: statementNum,
          PatNum: patNum,
          DateSent: new Date(),
          BalTotal: fee,
          IsInvoice: 1,
          ShortGUID: `INV-SEED-CLEAN-${index}`,
          NoteBold: buildJson({ status: 'sent' }),
        },
      });
      // Link procedure to statement
      await prisma.procedurelog.update({
        where: { ProcNum: procNum },
        data: { StatementNum: stmt.StatementNum },
      });
      return stmt;
    };

    // 5. Seed 15 Claims for different states (3 for each status)
    const states = [
      // Draft (Unsent) Claims
      { status: 'draft', format: 'E-claim', fee: 150.0, code: 'D0120', index: 1, patientKey: 'JohnClaim', carrierKey: 'Delta Dental Test PPO' },
      { status: 'draft', format: 'Paper', fee: 180.0, code: 'D1110', index: 6, patientKey: 'JaneClaim', carrierKey: 'MetLife Test Dental' },
      { status: 'draft', format: 'E-claim', fee: 220.0, code: 'D2391', index: 7, patientKey: 'BobClaim', carrierKey: 'Aetna Test Dental' },

      // Submitted Claims
      { status: 'submitted', format: 'Paper', fee: 200.0, code: 'D1110', index: 2, patientKey: 'JaneClaim', carrierKey: 'MetLife Test Dental' },
      { status: 'submitted', format: 'E-claim', fee: 210.0, code: 'D7140', index: 8, patientKey: 'AliceClaim', carrierKey: 'Delta Dental Test PPO' },
      { status: 'submitted', format: 'Paper', fee: 310.0, code: 'D9110', index: 9, patientKey: 'CharlieClaim', carrierKey: 'MetLife Test Dental' },

      // Pending Claims
      { status: 'pending', format: 'E-claim', fee: 250.0, code: 'D2391', index: 3, patientKey: 'BobClaim', carrierKey: 'Aetna Test Dental' },
      { status: 'pending', format: 'Paper', fee: 140.0, code: 'D0120', index: 10, patientKey: 'DavidClaim', carrierKey: 'Cigna Test Dental' },
      { status: 'pending', format: 'E-claim', fee: 275.0, code: 'D2391', index: 11, patientKey: 'EmmaClaim', carrierKey: 'Cigna Test Dental' },

      // Paid Claims
      { status: 'paid', format: 'E-claim', fee: 300.0, code: 'D7140', index: 4, patientKey: 'AliceClaim', carrierKey: 'Delta Dental Test PPO' },
      { status: 'paid', format: 'Paper', fee: 350.0, code: 'D2391', index: 12, patientKey: 'JohnClaim', carrierKey: 'Delta Dental Test PPO' },
      { status: 'paid', format: 'E-claim', fee: 125.0, code: 'D1110', index: 13, patientKey: 'BobClaim', carrierKey: 'Aetna Test Dental' },

      // Denied Claims
      { status: 'denied', format: 'Paper', fee: 100.0, code: 'D9110', index: 5, patientKey: 'CharlieClaim', carrierKey: 'MetLife Test Dental' },
      { status: 'denied', format: 'E-claim', fee: 195.0, code: 'D7140', index: 14, patientKey: 'DavidClaim', carrierKey: 'Cigna Test Dental' },
      { status: 'denied', format: 'Paper', fee: 230.0, code: 'D2391', index: 15, patientKey: 'EmmaClaim', carrierKey: 'Cigna Test Dental' },
    ];

    for (const state of states) {
      const patient = patientMap.get(state.patientKey);
      const carrier = carrierMap.get(state.carrierKey);
      const { insPlan, insSub } = patientPlanMap.get(state.patientKey)!;

      // Check if we already seeded this specific clean test claim
      const existingClaim = await prisma.claim.findFirst({
        where: {
          PatNum: patient.PatNum,
          ClaimFee: state.fee,
          PreAuthString: `CLM-SEED-${state.index}`,
        },
      });

      if (existingClaim) {
        console.log(`Claim CLM-SEED-${state.index} already exists. Skipping.`);
        continue;
      }

      // Create procedure
      const proc = await createProc(patient.PatNum, state.code, state.fee);

      // Create invoice
      const statement = await createStatement(patient.PatNum, proc.ProcNum, state.fee, state.index);

      // Build Narrative metadata JSON
      const claimMeta: any = {
        invoiceId: statement.StatementNum.toString(),
        insuranceCompanyId: carrier.CarrierNum.toString(),
        insuranceType: 'primary',
        status: state.status,
        claimAmount: state.fee,
        submittedAmount: state.fee,
        totalAmount: state.fee,
        paidAmount: state.status === 'paid' ? state.fee : 0.0,
        patientResponsibility: state.status === 'denied' ? state.fee : 0.0,
        claimFormat: state.format,
        notes: `Seed claim for ${patient.FName} with status: ${state.status}`,
      };

      if (state.status === 'paid') {
        claimMeta.paidDate = new Date().toISOString();
      }
      if (state.status === 'denied') {
        claimMeta.deniedDate = new Date().toISOString();
        claimMeta.denialReason = 'Service not covered under current subscriber policy';
      }

      // Create Claim
      const claimNum = await getNextId('claim', 'ClaimNum');
      const claimStatusMap: Record<string, string> = {
        draft: 'H',
        submitted: 'S',
        pending: 'P',
        paid: 'R',
        denied: 'D',
      };

      const claim = await prisma.claim.create({
        data: {
          ClaimNum: claimNum,
          PatNum: patient.PatNum,
          PlanNum: insPlan.PlanNum,
          InsSubNum: insSub.InsSubNum,
          ProvTreat: provider.ProvNum,
          ProvBill: provider.ProvNum,
          ClaimStatus: claimStatusMap[state.status] ?? 'H',
          ClaimType: 'Primary',
          DateService: new Date(),
          DateSent: state.status !== 'draft' ? new Date() : null,
          ClaimFee: state.fee,
          InsPayEst: state.fee * 0.8, // 80% coverage estimate
          InsPayAmt: state.status === 'paid' ? state.fee : 0.0,
          PreAuthString: `CLM-SEED-${state.index}`,
          PriorAuthorizationNumber: `CLM-SEED-${state.index}`,
          ClaimIdentifier: `CLM-SEED-${state.index}`,
          ClaimNote: `Seed claim ${state.status}`,
          Narrative: buildJson(claimMeta),
        },
      });

      // Link Procedure via ClaimProc
      const claimProcNum = await getNextId('claimproc', 'ClaimProcNum');
      await prisma.claimproc.create({
        data: {
          ClaimProcNum: claimProcNum,
          claim: { connect: { ClaimNum: claim.ClaimNum } },
          patient: { connect: { PatNum: patient.PatNum } },
          procedurelog: { connect: { ProcNum: proc.ProcNum } },
          provider: { connect: { ProvNum: provider.ProvNum } },
          insplan: { connect: { PlanNum: insPlan.PlanNum } },
          inssub: { connect: { InsSubNum: insSub.InsSubNum } },
          ProcDate: new Date(),
          Status: state.status === 'paid' ? 1 : 0, // 1=Received, 0=Not received
          FeeBilled: state.fee,
          InsPayEst: state.fee * 0.8,
          InsPayAmt: state.status === 'paid' ? state.fee : 0.0,
        },
      });

      // Seed tracking log for claim
      const claimTrackingNum = await getNextId('claimtracking', 'ClaimTrackingNum');
      await prisma.claimtracking.create({
        data: {
          ClaimTrackingNum: claimTrackingNum,
          claim: { connect: { ClaimNum: claim.ClaimNum } },
          TrackingType: 'status',
          Note: `Claim status set to: ${state.status}`,
          DateTimeEntry: new Date(),
        },
      });

      console.log(`Successfully seeded claim ${claim.PreAuthString} (${state.status}) for patient ${patient.FName} under carrier ${carrier.CarrierName}`);
    }

    console.log('Clean Claim Management Seeding Complete!');
  } catch (error) {
    console.error('Error during Claims seeding:', error);
  } finally {
    await prisma.$disconnect();
  }
}

seedClaimsComplete()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
