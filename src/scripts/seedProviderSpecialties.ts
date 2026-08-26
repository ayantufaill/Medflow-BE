import dotenv from 'dotenv';
import connectDB, { prisma } from '../config/db';
import { getNextId } from '../utils/opendental-ids.util';

dotenv.config();

const PROVIDER_SPECIALTY_CATEGORY = 0;

const providerSpecialties = [
  'General Dentistry',
  'Orthodontics',
  'Endodontics',
  'Periodontics',
  'Oral Surgery',
  'Pediatric Dentistry',
  'Prosthodontics',
  'Cosmetic Dentistry',
];

const seedProviderSpecialties = async () => {
  try {
    await connectDB();

    let toInsert: string[] = [];

    await prisma.$transaction(async (tx) => {
      const existing = await tx.definition.findMany({
        where: {
          ItemName: { in: providerSpecialties },
          OR: [{ Category: PROVIDER_SPECIALTY_CATEGORY }, { Category: null }],
        },
        select: { ItemName: true },
      });

      const existingNames = new Set(existing.map((row) => row.ItemName));
      toInsert = providerSpecialties
        .filter((name) => !existingNames.has(name))
        .sort((a, b) => a.localeCompare(b));

      if (toInsert.length === 0) {
        console.log('Provider specialties already seeded. Nothing to insert.');
        return;
      }
    });

    for (const name of toInsert) {
      const nextDefNum = await getNextId('definition', 'DefNum');
      await prisma.definition.create({
        data: {
          DefNum: nextDefNum,
          Category: PROVIDER_SPECIALTY_CATEGORY,
          ItemOrder: 0,
          ItemName: name,
          ItemValue: null,
          ItemColor: null,
          IsHidden: 0,
        },
      });
      console.log(`Created provider specialty: ${name}`);
    }

    const seededRows = await prisma.definition.findMany({
      where: {
        ItemName: { in: providerSpecialties },
        Category: PROVIDER_SPECIALTY_CATEGORY,
      },
      select: {
        DefNum: true,
        Category: true,
        ItemName: true,
        IsHidden: true,
      },
      orderBy: { ItemName: 'asc' },
    });

    console.log('\nSeeded provider specialties:');
    for (const row of seededRows) {
      console.log(
        `DefNum=${row.DefNum.toString()} Category=${row.Category ?? 'NULL'} ItemName=${row.ItemName} IsHidden=${row.IsHidden}`
      );
    }

    console.log('\nProvider specialties seed completed successfully.');
    process.exit(0);
  } catch (error) {
    console.error('Error seeding provider specialties:', error);
    process.exit(1);
  }
};

seedProviderSpecialties();
