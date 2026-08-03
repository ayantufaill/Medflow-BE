import { prisma } from '../config/db';
import { getNextId } from '../utils/opendental-ids.util';

const feeSchedules = [
  { name: 'Standard UCR Fee Schedule', type: 0 }, // 0 = Normal
  { name: 'Delta Dental PPO', type: 1 },         // 1 = Copay/PPO
  { name: 'Medicaid State', type: 2 }            // 2 = Allowed
];

const sampleCodesAndFees = [
  { code: 'D0120', ucr: 65.00, ppo: 45.00, medicaid: 25.00 },
  { code: 'D0210', ucr: 180.00, ppo: 110.00, medicaid: 70.00 },
  { code: 'D0274', ucr: 75.00, ppo: 50.00, medicaid: 30.00 },
  { code: 'D1110', ucr: 120.00, ppo: 85.00, medicaid: 55.00 },
  { code: 'D1120', ucr: 90.00, ppo: 65.00, medicaid: 45.00 },
  { code: 'D2140', ucr: 195.00, ppo: 140.00, medicaid: 85.00 },
  { code: 'D2330', ucr: 220.00, ppo: 160.00, medicaid: 100.00 },
  { code: 'D2740', ucr: 1250.00, ppo: 950.00, medicaid: 600.00 },
  { code: 'D3310', ucr: 890.00, ppo: 700.00, medicaid: 450.00 },
  { code: 'D4341', ucr: 280.00, ppo: 210.00, medicaid: 130.00 },
  { code: 'D7140', ucr: 185.00, ppo: 130.00, medicaid: 75.00 },
];

const seedFeeSchedules = async () => {
  try {
    let schedulesCreated = 0;
    let feesCreated = 0;

    console.log('Seeding fee schedules and plan fee guides...');

    for (const fs of feeSchedules) {
      let feeSchedRecord = await prisma.feesched.findFirst({
        where: { Description: fs.name },
      });

      if (!feeSchedRecord) {
        const feeSchedNum = await getNextId('feesched', 'FeeSchedNum');
        feeSchedRecord = await prisma.feesched.create({
          data: {
            FeeSchedNum: feeSchedNum,
            Description: fs.name,
            FeeSchedType: fs.type,
            IsHidden: 0,
            IsGlobal: 1,
          },
        });
        schedulesCreated++;
        console.log(`Created Fee Schedule: ${fs.name}`);
      } else {
        console.log(`Fee Schedule already exists: ${fs.name}`);
      }

      // Now add fees for this schedule if it doesn't already have them
      for (const item of sampleCodesAndFees) {
        // Find the code num
        const procCode = await prisma.procedurecode.findFirst({
          where: { ProcCode: item.code }
        });

        if (procCode) {
          // Check if fee already exists for this schedule and code
          const existingFee = await prisma.fee.findFirst({
            where: {
              FeeSched: feeSchedRecord.FeeSchedNum,
              CodeNum: procCode.CodeNum
            }
          });

          if (!existingFee) {
            let amount = 0;
            if (fs.name.includes('UCR')) amount = item.ucr;
            else if (fs.name.includes('PPO')) amount = item.ppo;
            else if (fs.name.includes('Medicaid')) amount = item.medicaid;

            const feeNum = await getNextId('fee', 'FeeNum');
            await prisma.fee.create({
              data: {
                FeeNum: feeNum,
                Amount: amount,
                FeeSched: feeSchedRecord.FeeSchedNum,
                CodeNum: procCode.CodeNum,
                UseDefaultFee: 0,
                UseDefaultCov: 0,
              }
            });
            feesCreated++;
          }
        }
      }
    }

    console.log(`Seeding complete! Created ${schedulesCreated} fee schedules and ${feesCreated} fee entries.`);
  } catch (error) {
    console.error('Error seeding fee schedules:', error);
  } finally {
    await prisma.$disconnect();
  }
};

seedFeeSchedules();
