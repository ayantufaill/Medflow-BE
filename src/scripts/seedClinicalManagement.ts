import { prisma } from '../config/db.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const seedClinicalManagement = async () => {
  try {
    const dataPath = path.join(__dirname, 'clinicalData.json');
    const rawData = fs.readFileSync(dataPath, 'utf8');
    const data = JSON.parse(rawData);

    for (const catData of data.categories) {
      // Upsert Category
      const category = await prisma.clinicalcategory.upsert({
        where: { name: catData.name },
        update: {},
        create: {
          name: catData.name,
        },
      });

      for (const subCatData of catData.subCategories) {
        // Upsert SubCategory
        const subCategory = await prisma.clinicalsubcategory.upsert({
          where: {
            name_categoryId: {
              name: subCatData.name,
              categoryId: category.id,
            }
          },
          update: {},
          create: {
            name: subCatData.name,
            categoryId: category.id,
          }
        });

        for (const itemData of subCatData.items) {
          // Find existing item by choiceName and subCategoryId
          const existingItem = await prisma.clinicalitem.findFirst({
            where: {
              choiceName: itemData.choiceName,
              subCategoryId: subCategory.id,
            }
          });

          if (existingItem) {
            await prisma.clinicalitem.update({
              where: { id: existingItem.id },
              data: {
                isDefault: itemData.isDefault,
                instructions: itemData.instructions,
                price: itemData.price,
                code: itemData.code,
                isQuickList: itemData.isQuickList,
                isRecommended: itemData.isRecommended,
              }
            });
          } else {
            await prisma.clinicalitem.create({
              data: {
                choiceName: itemData.choiceName,
                subCategoryId: subCategory.id,
                isDefault: itemData.isDefault || false,
                instructions: itemData.instructions,
                price: itemData.price || 0,
                code: itemData.code,
                isQuickList: itemData.isQuickList,
                isRecommended: itemData.isRecommended,
              }
            });
          }
        }
      }
    }

    console.log('Clinical management data seeded successfully!');
  } catch (error) {
    console.error('Error seeding clinical management data:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
};

seedClinicalManagement();
