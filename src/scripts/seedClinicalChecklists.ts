import fs from 'fs';
import path from 'path';
import { prisma } from '../config/db';

const seedClinicalChecklists = async () => {
  try {
    console.log('Reading seeded checklists JSON...');
    const jsonPath = path.join('d:', 'Medflow', 'seeded_checklists.json');
    if (!fs.existsSync(jsonPath)) {
      throw new Error(`Seeded checklists file not found at ${jsonPath}`);
    }
    const categoriesData = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));

    console.log('Clearing existing clinical checklist tables...');
    // Delete in order of child-first to satisfy foreign key constraints
    await prisma.clinicalchecklistitem.deleteMany({});
    await prisma.clinicalchecklist.deleteMany({});
    await prisma.clinicalchecklistcategory.deleteMany({});
    console.log('Checklist tables cleared successfully.');

    let categoryCount = 0;
    let checklistCount = 0;
    let itemCount = 0;

    for (const categoryData of categoriesData) {
      console.log(`Seeding category: ${categoryData.name}...`);
      const category = await prisma.clinicalchecklistcategory.create({
        data: {
          Name: categoryData.name,
          IsActive: true,
        },
      });
      categoryCount++;

      for (const checklistData of categoryData.checklists) {
        const checklist = await prisma.clinicalchecklist.create({
          data: {
            CategoryId: category.CategoryId,
            Name: checklistData.name,
            ShortName: checklistData.shortName,
            IsTreatment: checklistData.isTreatment,
            IsHygiene: checklistData.isHygiene,
            IconId: checklistData.iconId || 'tooth-prep',
            IsActive: true,
          },
        });
        checklistCount++;

        for (const itemData of checklistData.items) {
          await prisma.clinicalchecklistitem.create({
            data: {
              ChecklistId: checklist.ChecklistId,
              Text: itemData.text,
              Choices: JSON.stringify(itemData.choices || []),
              Products: JSON.stringify(itemData.products || []),
              IsActive: true,
            },
          });
          itemCount++;
        }
      }
    }

    console.log(`Clinical Checklists seeding completed successfully!`);
    console.log(`Seeded: ${categoryCount} Categories, ${checklistCount} Checklists, ${itemCount} Items.`);
  } catch (error) {
    console.error('Error seeding clinical checklists:', error);
  } finally {
    await prisma.$disconnect();
  }
};

seedClinicalChecklists();
