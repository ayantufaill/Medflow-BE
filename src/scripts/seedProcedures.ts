import { prisma } from '../config/db';
import { getNextId } from '../utils/opendental-ids.util';

const procedureCodes = [
  { code: 'D0120', fee: 65.00,  desc: 'Periodic oral evaluation' },
  { code: 'D0210', fee: 180.00, desc: 'Complete series of radiographic images' },
  { code: 'D0274', fee: 75.00,  desc: 'Bitewing radiographic image - four images' },
  { code: 'D1110', fee: 120.00, desc: 'Prophylaxis - adult' },
  { code: 'D1120', fee: 90.00,  desc: 'Prophylaxis - child' },
  { code: 'D2140', fee: 195.00, desc: 'Amalgam restoration - one surface' },
  { code: 'D2330', fee: 220.00, desc: 'Resin-based composite - one surface' },
  { code: 'D2740', fee: 1250.00, desc: 'Crown - porcelain/ceramic substrate' },
  { code: 'D3310', fee: 890.00, desc: 'Endodontic therapy - anterior tooth' },
  { code: 'D4341', fee: 280.00, desc: 'Periodontal scaling and root planing' },
  { code: 'D5110', fee: 1800.00, desc: 'Complete denture - maxillary' },
  { code: 'D7140', fee: 185.00, desc: 'Extraction, erupted tooth' },
];

const seedProcedures = async () => {
  try {
    console.log('🌱 Seeding procedure logs...');

    // Get all patients
    const patients = await prisma.patient.findMany({
      select: { PatNum: true, FName: true, LName: true },
      take: 25,
    });

    if (patients.length === 0) {
      console.error('❌ No patients found. Run seed:patients first.');
      process.exit(1);
    }

    // Get providers
    const providers = await prisma.provider.findMany({
      select: { ProvNum: true, FName: true, LName: true },
      take: 5,
    });

    if (providers.length === 0) {
      console.error('❌ No providers found. Run seed:providers first.');
      process.exit(1);
    }

    console.log(`Found ${patients.length} patients and ${providers.length} providers.`);

    let totalCreated = 0;

    for (const patient of patients) {
      // Each patient gets 3-8 completed procedures
      const numProcs = Math.floor(Math.random() * 6) + 3;

      for (let i = 0; i < numProcs; i++) {
        const proc = procedureCodes[Math.floor(Math.random() * procedureCodes.length)];
        const provider = providers[Math.floor(Math.random() * providers.length)];

        // Random date in the past 12 months
        const daysAgo = Math.floor(Math.random() * 365);
        const procDate = new Date();
        procDate.setDate(procDate.getDate() - daysAgo);
        procDate.setHours(0, 0, 0, 0);

        const procNum = await getNextId('procedurelog', 'ProcNum');

        await prisma.procedurelog.create({
          data: {
            ProcNum: procNum,
            patient: { connect: { PatNum: patient.PatNum } },
            provider_procedurelog_ProvNumToprovider: { connect: { ProvNum: provider.ProvNum } },
            OldCode: proc.code,
            ProcDate: procDate,
            ProcFee: proc.fee,
            ProcStatus: 2, // 2 = Completed
            BillingNote: proc.desc,
          },
        });

        totalCreated++;
      }

      console.log(`  ✓ Created procedures for ${patient.FName} ${patient.LName}`);
    }

    // Verify
    const count = await prisma.procedurelog.count({ where: { ProcStatus: 2 } });

    console.log('\n✅ Procedure seeding complete!');
    console.log(`   Total procedures created: ${totalCreated}`);
    console.log(`   Completed procedures in DB: ${count}`);

  } catch (error) {
    console.error('❌ Error seeding procedures:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
};

seedProcedures();