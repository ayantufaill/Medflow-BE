import { prisma } from './src/config/db';
import { patientReportRows } from './src/services/reporting-patient-data.service';

async function run() {
  const patients = await prisma.patient.findMany({ take: 5, orderBy: { PatNum: 'desc' } });
  const rows = await patientReportRows(patients);
  for (const [id, row] of rows.entries()) {
    console.log(id, {
      lastAppt: row.lastAppt,
      nextTreatmentAppt: row.nextTreatmentAppt,
      nextRecareAppt: row.nextRecareAppt,
      'Ins Remain': row['Ins Remain'],
    });
  }
}

run().catch(console.error).finally(() => prisma.$disconnect());
