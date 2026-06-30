import { prisma } from '../config/db';
import { getNextId } from '../utils/opendental-ids.util';

const seedClaims = async () => {
  try {
    console.log('Seeding Claim Management tables...');

    // 1. Fetch prerequisite patient
    const patient = await prisma.patient.findFirst();
    if (!patient) {
      console.log('No patients found. Please seed patients first.');
      return;
    }

    // 2. Fetch prerequisite carrier
    let carrier = await prisma.carrier.findFirst();
    if (!carrier) {
      const carrierNum = await getNextId('carrier', 'CarrierNum');
      carrier = await prisma.carrier.create({
        data: {
          CarrierNum: carrierNum,
          CarrierName: 'Delta Dental PPO',
          Phone: '800-555-1212',
          IsHidden: 0,
        },
      });
      console.log(`Created carrier: ${carrier.CarrierName}`);
    }

    // 3. Fetch prerequisite provider
    const provider = await prisma.provider.findFirst();
    if (!provider) {
      console.log('No providers found. Please seed providers first.');
      return;
    }
    const provNum = provider.ProvNum;

    // 4. Seed insplan (Insurance Plan)
    let insPlan = await prisma.insplan.findFirst();
    if (!insPlan) {
      const planNum = await getNextId('insplan', 'PlanNum');
      insPlan = await prisma.insplan.create({
        data: {
          PlanNum: planNum,
          CarrierNum: carrier.CarrierNum,
          GroupName: 'Delta Premier Group',
          GroupNum: 'DPG-7728',
          PlanType: 'p',
        },
      });
      console.log('Created insurance plan (insplan)');
    }

    // 5. Seed inssub (Insurance Subscriber)
    let insSub = await prisma.inssub.findFirst();
    if (!insSub) {
      const subNum = await getNextId('inssub', 'InsSubNum');
      insSub = await prisma.inssub.create({
        data: {
          InsSubNum: subNum,
          PlanNum: insPlan.PlanNum,
          Subscriber: patient.PatNum,
          SubscriberID: 'SUB-5544321',
        },
      });
      console.log('Created insurance subscriber (inssub)');
    }

    // 6. Seed patplan (Patient Insurance Plan Mapping)
    let patPlan = await prisma.patplan.findFirst();
    if (!patPlan) {
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
      console.log('Created patient plan association (patplan)');
    }

    // 7. Seed claim (Insurance Claims)
    let claim = await prisma.claim.findFirst();
    if (!claim) {
      const claimNum = await getNextId('claim', 'ClaimNum');
      claim = await prisma.claim.create({
        data: {
          ClaimNum: claimNum,
          PatNum: patient.PatNum,
          PlanNum: insPlan.PlanNum,
          InsSubNum: insSub.InsSubNum,
          ProvTreat: provNum,
          ClaimStatus: 'S', // Sent
          ClaimType: 'P', // Primary
          DateService: new Date(),
          DateSent: new Date(),
          ClaimFee: 220.0,
          InsPayEst: 180.0,
          InsPayAmt: 0.0,
        },
      });
      console.log('Created insurance claim (claim)');
    }

    // 8. Seed claimproc (Claim Procedures)
    let claimProc = await prisma.claimproc.findFirst();
    if (!claimProc) {
      const claimProcNum = await getNextId('claimproc', 'ClaimProcNum');
      claimProc = await prisma.claimproc.create({
        data: {
          ClaimProcNum: claimProcNum,
          ClaimNum: claim!.ClaimNum,
          PatNum: patient.PatNum,
          ProvNum: provNum,
          PlanNum: insPlan.PlanNum,
          InsSubNum: insSub.InsSubNum,
          ProcDate: new Date(),
          Status: 0, // Billed/Sent
          FeeBilled: 220.0,
          InsPayEst: 180.0,
          InsPayAmt: 0.0,
        },
      });
      console.log('Created claim procedure (claimproc)');
    }

    // 9. Seed claimpayment (Insurance Payments / Checks)
    let claimPayment = await prisma.claimpayment.findFirst();
    if (!claimPayment) {
      const claimPaymentNum = await getNextId('claimpayment', 'ClaimPaymentNum');
      claimPayment = await prisma.claimpayment.create({
        data: {
          ClaimPaymentNum: claimPaymentNum,
          CheckDate: new Date(),
          CheckAmt: 180.0,
          CheckNum: 'CH-8837182',
          Note: 'Batch insurance payment check',
        },
      });
      console.log('Created claim payment check (claimpayment)');
    }

    // 10. Seed claimtracking (Claim Status Logs)
    let claimTracking = await prisma.claimtracking.findFirst();
    if (!claimTracking) {
      const claimTrackingNum = await getNextId('claimtracking', 'ClaimTrackingNum');
      claimTracking = await prisma.claimtracking.create({
        data: {
          ClaimTrackingNum: claimTrackingNum,
          ClaimNum: claim!.ClaimNum,
          TrackingType: 'Clearinghouse Acknowledgement',
          Note: 'Claim successfully verified and received by Delta Dental clearinghouse.',
          DateTimeEntry: new Date(),
        },
      });
      console.log('Created claim tracking log (claimtracking)');
    }

    console.log('Claim Management tables seeded successfully!');
  } catch (error) {
    console.error('Error seeding claims:', error);
  } finally {
    await prisma.$disconnect();
  }
};

seedClaims();
