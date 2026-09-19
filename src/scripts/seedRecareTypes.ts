import { prisma } from '../config/db';
import { getNextId } from '../utils/opendental-ids.util';

export const defaultRecallTypes = [
  {
    Description: 'Adult Prophy',
    DefaultInterval: 6,
    OffsetDays: 1,
    Procedures: 'D1110',
    triggers: ['D1110'],
  },
  {
    Description: 'Child Prophy',
    DefaultInterval: 6,
    OffsetDays: 1,
    Procedures: 'D1120',
    triggers: ['D1120'],
  },
  {
    Description: 'Periodic Exam',
    DefaultInterval: 6,
    OffsetDays: 0,
    Procedures: 'D0120',
    triggers: ['D0120', 'D0150'],
  },
  {
    Description: 'Bitewings',
    DefaultInterval: 12,
    OffsetDays: 0,
    Procedures: 'D0274',
    triggers: ['D0274'],
  },
  {
    Description: 'Fluoride',
    DefaultInterval: 6,
    OffsetDays: 0,
    Procedures: 'D1206',
    triggers: ['D1206'],
  },
  {
    Description: 'Perio Maintenance',
    DefaultInterval: 3,
    OffsetDays: 0,
    Procedures: 'D4910',
    triggers: ['D4910'],
  },
];

export const seedRecareTypes = async () => {
  try {
    console.log('Seeding Recare (Recall) types and triggers...');

    for (const item of defaultRecallTypes) {
      let recallType = await prisma.recalltype.findFirst({
        where: { Description: item.Description },
      });

      if (!recallType) {
        const nextId = await getNextId('recalltype', 'RecallTypeNum');
        recallType = await prisma.recalltype.create({
          data: {
            RecallTypeNum: nextId,
            Description: item.Description,
            DefaultInterval: item.DefaultInterval,
            OffsetDays: item.OffsetDays,
            Procedures: item.Procedures,
          },
        });
        console.log(`Created RecallType: ${item.Description} (ID: ${recallType.RecallTypeNum})`);
      } else {
        recallType = await prisma.recalltype.update({
          where: { RecallTypeNum: recallType.RecallTypeNum },
          data: {
            DefaultInterval: item.DefaultInterval,
            OffsetDays: item.OffsetDays,
            Procedures: item.Procedures,
          },
        });
        console.log(`Updated RecallType: ${item.Description} (ID: ${recallType.RecallTypeNum})`);
      }

      // Link triggers
      for (const cdtCode of item.triggers) {
        const procCode = await prisma.procedurecode.findFirst({
          where: { ProcCode: cdtCode },
        });

        if (!procCode) {
          console.warn(`Procedure code ${cdtCode} not found for trigger.`);
          continue;
        }

        const existingTrigger = await prisma.recalltrigger.findFirst({
          where: {
            RecallTypeNum: recallType.RecallTypeNum,
            CodeNum: procCode.CodeNum,
          },
        });

        if (!existingTrigger) {
          const triggerId = await getNextId('recalltrigger', 'RecallTriggerNum');
          await prisma.recalltrigger.create({
            data: {
              RecallTriggerNum: triggerId,
              RecallTypeNum: recallType.RecallTypeNum,
              CodeNum: procCode.CodeNum,
            },
          });
          console.log(`Linked trigger for ${item.Description} -> ${cdtCode} (CodeNum: ${procCode.CodeNum})`);
        }
      }
    }

    console.log('Recare types and triggers seeded successfully!');
  } catch (error) {
    console.error('Error seeding recare types:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
};

seedRecareTypes()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));
