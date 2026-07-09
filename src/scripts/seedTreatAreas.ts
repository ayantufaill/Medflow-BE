import { PrismaClient, TreatmentArea } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding TreatAreas for Procedure Codes...');

  const codes = await prisma.procedurecode.findMany({
    select: { CodeNum: true, ProcCode: true }
  });

  console.log(`Found ${codes.length} procedure codes.`);

  let updatedCount = 0;

  for (const code of codes) {
    let newArea: TreatmentArea = 'MOUTH';
    const procCode = code.ProcCode.toUpperCase();

    // Mapping logic based on general dental codes
    if (procCode.startsWith('D2') || ['D1351', 'D1352', 'D1353'].includes(procCode)) {
      newArea = 'SURFACE';
    } else if (procCode.startsWith('D3') || procCode.startsWith('D7')) {
      newArea = 'TOOTH';
    } else if (procCode.startsWith('D4')) {
      newArea = 'QUADRANT';
    } else if (['D5110', 'D5120', 'D5211', 'D5212', 'D5213', 'D5214'].includes(procCode)) {
      newArea = 'ARCH';
    }

    await prisma.procedurecode.update({
      where: { CodeNum: code.CodeNum },
      data: { TreatArea: newArea }
    });
    
    updatedCount++;
  }

  console.log(`Successfully updated ${updatedCount} procedure codes with TreatArea.`);
}

main()
  .catch((e) => {
    console.error('Error during seeding TreatAreas:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
