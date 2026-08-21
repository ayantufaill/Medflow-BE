import { prisma } from '../config/db';
import { getNextId } from '../utils/opendental-ids.util';

const allowedFees = [
  { code: 'D0150', allowed: 90.00 },
  { code: 'D2140', allowed: 140.00 },
  { code: 'D1110', allowed: 85.00 },
  { code: 'D0120', allowed: 45.00 },
  { code: 'D2740', allowed: 950.00 },
  { code: 'D0210', allowed: 110.00 },
  { code: 'D0274', allowed: 50.00 },
  { code: 'D2330', allowed: 160.00 },
  { code: 'D3310', allowed: 700.00 },
  { code: 'D4341', allowed: 210.00 },
  { code: 'D7140', allowed: 130.00 },
];

const seedFees = async () => {
  try {
    console.log('Seeding Allowed Fees...');

    let feeSched = await prisma.feesched.findFirst({
      where: { Description: 'Delta Dental PPO Allowed' },
    });

    if (!feeSched) {
      const feeSchedNum = await getNextId('feesched', 'FeeSchedNum');
      feeSched = await prisma.feesched.create({
        data: {
          FeeSchedNum: feeSchedNum,
          Description: 'Delta Dental PPO Allowed',
          FeeSchedType: 1, // PPO Allowed Fee Schedule
          IsHidden: 0,
          IsGlobal: 1,
        },
      });
      console.log(`Created Fee Schedule: Delta Dental PPO Allowed (ID: ${feeSchedNum})`);
    }

    let createdCount = 0;
    for (const item of allowedFees) {
      const procCode = await prisma.procedurecode.findFirst({
        where: { ProcCode: item.code },
      });

      if (procCode) {
        const existingFee = await prisma.fee.findFirst({
          where: {
            FeeSched: feeSched.FeeSchedNum,
            CodeNum: procCode.CodeNum,
          },
        });

        if (!existingFee) {
          const feeNum = await getNextId('fee', 'FeeNum');
          await prisma.fee.create({
            data: {
              FeeNum: feeNum,
              Amount: item.allowed,
              FeeSched: feeSched.FeeSchedNum,
              CodeNum: procCode.CodeNum,
              UseDefaultFee: 0,
              UseDefaultCov: 0,
            },
          });
          createdCount++;
        } else {
          await prisma.fee.update({
            where: { FeeNum: existingFee.FeeNum },
            data: { Amount: item.allowed },
          });
        }
      }
    }

    console.log(`Seeded ${createdCount} allowed fees for Delta Dental PPO Allowed.`);

    // Assign AllowedFeeSched to all insplan records that don't have one set yet
    const plansUpdated = await prisma.insplan.updateMany({
      where: {
        OR: [
          { AllowedFeeSched: null },
          { AllowedFeeSched: BigInt(0) },
        ],
      },
      data: {
        AllowedFeeSched: feeSched.FeeSchedNum,
      },
    });

    console.log(`Assigned AllowedFeeSched to ${plansUpdated.count} insurance plans.`);
  } catch (error) {
    console.error('Error seeding allowed fees:', error);
  } finally {
    await prisma.$disconnect();
  }
};

seedFees();
