import { prisma } from '../config/db';
import { getNextId } from '../utils/opendental-ids.util';

const categories = [
  {
    name: 'Exam',
    items: [
      { code: 'D0150', order: 0 },
      { code: 'D0120', order: 1 },
      { code: 'D0140', order: 3 },
      { code: 'D9310', order: 4 },
      { code: 'D1206', order: 5 },
      { code: 'D0170', order: 6 },
      { code: 'D1120', order: 7 },
      { code: 'D1110', order: 8 },
    ]
  },
  {
    name: 'Xray',
    items: [
      { code: 'D0210', order: 0 },
      { code: 'D0220', order: 1 },
      { code: 'D0230', order: 2 },
      { code: 'D0272', order: 3 },
      { code: 'D0274', order: 4 },
      { code: 'D0330', order: 5 },
    ]
  },
  {
    name: 'Posterior Restorative',
    items: [
      { code: 'D2391', order: 0 },
      { code: 'D2392', order: 1 },
      { code: 'D2393', order: 2 },
      { code: 'D2394', order: 3 },
      { code: 'D2140', order: 4 },
      { code: 'D2150', order: 5 },
      { code: 'D2160', order: 6 },
    ]
  },
  {
    name: 'Ant Composite',
    items: [
      { code: 'D2330', order: 0 },
      { code: 'D2331', order: 1 },
      { code: 'D2332', order: 2 },
      { code: 'D2335', order: 3 },
    ]
  },
  {
    name: 'Appliance',
    items: [
      { code: 'D9944', order: 0 },
    ]
  },
  {
    name: 'Oral Surgery',
    items: [
      { code: 'D7140', order: 0 },
      { code: 'D7210', order: 1 },
    ]
  }
];

async function seedProcButtons() {
  console.log('Seeding Procedure Buttons...');
  
  // Clear existing (optional, but good for idempotency here since it's just categories)
  await prisma.procbuttonitem.deleteMany({});
  await prisma.procbutton.deleteMany({});
  
  let orderCat = 0;
  for (const cat of categories) {
    const btnNum = await getNextId('procbutton', 'ProcButtonNum');
    await prisma.procbutton.create({
      data: {
        ProcButtonNum: btnNum,
        Description: cat.name,
        ItemOrder: orderCat++,
        Category: null,
        ButtonImage: '',
        IsMultiVisit: 0
      }
    });
    
    for (const item of cat.items) {
      // get codenum
      const code = await prisma.procedurecode.findFirst({ where: { ProcCode: item.code } });
      if (code) {
        const itemNum = await getNextId('procbuttonitem', 'ProcButtonItemNum');
        await prisma.procbuttonitem.create({
          data: {
            ProcButtonItemNum: itemNum,
            ProcButtonNum: btnNum,
            CodeNum: code.CodeNum,
            ItemOrder: item.order
          }
        });
      }
    }
  }
  
  console.log('Done Seeding Procedure Buttons!');
}

seedProcButtons()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
