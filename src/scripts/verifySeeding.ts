import { prisma } from '../config/db';

const verify = async () => {
  try {
    const categories = await prisma.clinicalchecklistcategory.findMany({
      where: { IsActive: true },
      include: {
        checklists: {
          where: { IsActive: true },
          include: {
            items: {
              where: { IsActive: true },
            },
          },
        },
      },
    });

    console.log(`Verification: Found ${categories.length} active categories in database.`);
    for (const cat of categories) {
      console.log(`- Category: ${cat.Name} (ID: ${cat.CategoryId})`);
      console.log(`  Number of checklists: ${cat.checklists.length}`);
      for (const cl of cat.checklists) {
        console.log(`    * Checklist: "${cl.Name}" (ShortName: "${cl.ShortName}", Treatment: ${cl.IsTreatment}, Hygiene: ${cl.IsHygiene})`);
        console.log(`      Items count: ${cl.items.length}`);
      }
    }
  } catch (error) {
    console.error('Verification failed:', error);
  } finally {
    await prisma.$disconnect();
  }
};

verify();
