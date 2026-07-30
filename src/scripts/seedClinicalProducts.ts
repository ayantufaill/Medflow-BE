import { prisma } from '../config/db.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const seedClinicalProducts = async () => {
  try {
    const dataPath = path.join(__dirname, 'clinicalData.json');
    const rawData = fs.readFileSync(dataPath, 'utf8');
    const data = JSON.parse(rawData);

    // Find all 'Products' categories
    const productCategories = data.categories.filter((c: any) => c.name === 'Products');
    
    for (const catData of productCategories) {
      for (const subCatData of catData.subCategories) {
        // Upsert Product Category
        let category = await prisma.clinicalproductcategory.findFirst({
          where: { Name: subCatData.name }
        });

        if (category) {
          category = await prisma.clinicalproductcategory.update({
            where: { CategoryId: category.CategoryId },
            data: { Section: 'top', IsActive: true }
          });
        } else {
          category = await prisma.clinicalproductcategory.create({
            data: { Name: subCatData.name, Section: 'top', IsActive: true }
          });
        }

        for (const itemData of subCatData.items) {
          const codeStr = itemData.code ? itemData.code.toString() : '';
          
          let choice = await prisma.clinicalproductchoice.findFirst({
            where: { Name: itemData.choiceName, CategoryId: category.CategoryId }
          });

          if (choice) {
            await prisma.clinicalproductchoice.update({
              where: { ChoiceId: choice.ChoiceId },
              data: {
                IsDefault: itemData.isDefault || false,
                QuickList: itemData.isQuickList || false,
                IsRecommended: itemData.isRecommended || false,
                Price: itemData.price || 0,
                Code: codeStr,
                IsActive: true
              }
            });
          } else {
            await prisma.clinicalproductchoice.create({
              data: {
                Name: itemData.choiceName,
                CategoryId: category.CategoryId,
                IsDefault: itemData.isDefault || false,
                QuickList: itemData.isQuickList || false,
                IsRecommended: itemData.isRecommended || false,
                Price: itemData.price || 0,
                Code: codeStr,
                IsActive: true
              }
            });
          }
        }
      }
    }

    console.log('Clinical products seeded successfully!');
  } catch (error) {
    console.error('Error seeding clinical products:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
};

seedClinicalProducts();
