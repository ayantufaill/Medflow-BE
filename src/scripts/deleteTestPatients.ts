import { prisma } from '../config/db';

async function deleteTestPatients() {
  console.log('Finding test patients...');
  const testPatients = await prisma.patient.findMany({
    where: {
      OR: [
        {
          FName: {
            startsWith: 'Test',
          },
        },
        {
          FName: {
            equals: 'Huzaifa',
          },
          LName: {
            equals: 'Rashid',
          },
        },
      ],
    },
  });

  console.log(`Found ${testPatients.length} test patients.`);

  for (const patient of testPatients) {
    const patNum = patient.PatNum;
    const patientName = `${patient.FName} ${patient.LName}`;
    console.log(`Deleting patient: ${patientName} (PatNum: ${patNum})...`);

    try {
      // 1. Delete claimtracking associated with patient's claims
      const claims = await prisma.claim.findMany({
        where: { PatNum: patNum },
      });
      const claimIds = claims.map((c) => c.ClaimNum);
      if (claimIds.length > 0) {
        await prisma.claimtracking.deleteMany({
          where: { ClaimNum: { in: claimIds } },
        });
        await prisma.claimproc.deleteMany({
          where: { ClaimNum: { in: claimIds } },
        });
      }

      // 2. Delete claimproc directly linked to patient
      await prisma.claimproc.deleteMany({
        where: { PatNum: patNum },
      });

      // 3. Delete claims
      await prisma.claim.deleteMany({
        where: { PatNum: patNum },
      });

      // 4. Delete patplan (patient insurance plan mappings)
      await prisma.patplan.deleteMany({
        where: { PatNum: patNum },
      });

      // 5. Delete inssub (insurance subscriber info)
      await prisma.inssub.deleteMany({
        where: { Subscriber: patNum },
      });

      // 6. Delete procedure logs
      await prisma.procedurelog.deleteMany({
        where: { PatNum: patNum },
      });

      // 7. Delete appointments
      await prisma.appointment.deleteMany({
        where: { PatNum: patNum },
      });

      // 8. Delete documents
      await prisma.document.deleteMany({
        where: { PatNum: patNum },
      });

      // 9. Delete vital signs
      await prisma.vitalsign.deleteMany({
        where: { PatNum: patNum },
      });

      // 10. Delete paysplits (payment splits)
      await prisma.paysplit.deleteMany({
        where: { PatNum: patNum },
      });

      // 11. Delete adjustments
      await prisma.adjustment.deleteMany({
        where: { PatNum: patNum },
      });

      // 12. Delete payments
      await prisma.payment.deleteMany({
        where: { PatNum: patNum },
      });

      // 13. Delete statements (invoices)
      await prisma.statement.deleteMany({
        where: { PatNum: patNum },
      });

      // 14. Delete user preference overrides for this patient
      await prisma.userodpref.deleteMany({
        where: { Fkey: patNum, FkeyType: 206 },
      });

      // 14b. Delete rxpat (prescriptions)
      await prisma.rxpat.deleteMany({
        where: { PatNum: patNum },
      });

      // 14c. Delete commlog (communication logs)
      await prisma.commlog.deleteMany({
        where: { PatNum: patNum },
      });

      // 15. Finally, delete the patient record itself
      await prisma.patient.delete({
        where: { PatNum: patNum },
      });

      console.log(`Successfully deleted ${patientName}.`);
    } catch (err) {
      console.error(`Failed to delete patient ${patientName}:`, err);
    }
  }

  console.log('Cleanup finished.');
}

deleteTestPatients()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Error during test patients deletion:', err);
    process.exit(1);
  });
