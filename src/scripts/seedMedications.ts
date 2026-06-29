import { prisma } from '../config/db';
import { getNextId } from '../utils/opendental-ids.util';

async function seedMedications() {
  const medications = [
    { MedName: 'Amoxicillin 500mg', RxCui: 308191 },
    { MedName: 'Ibuprofen 200mg', RxCui: 5640 },
    { MedName: 'Lisinopril 10mg', RxCui: 29046 },
    { MedName: 'Metformin 500mg', RxCui: 6809 },
    { MedName: 'Atorvastatin 20mg', RxCui: 83367 },
  ];

  for (const med of medications) {
    const nextId = await getNextId('medication', 'MedicationNum');

    const created = await prisma.medication.create({
      data: {
        MedicationNum: nextId,
        MedName: med.MedName,
        RxCui: BigInt(med.RxCui),
        DateTStamp: new Date(),
        IsHidden: 0,
      }
    });

    console.log(`Created medication: ${created.MedicationNum} - ${created.MedName}`);
  }

  console.log('Done seeding 5 medications.');
}

seedMedications()
  .catch((err) => {
    console.error('Seed failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });