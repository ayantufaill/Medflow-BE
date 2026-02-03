import { prisma } from '../config/db';
import { getNextId } from '../utils/opendental-ids.util';

const languages = [
  { name: 'English', code: 'en' },
  { name: 'Spanish', code: 'es' },
  { name: 'French', code: 'fr' },
  { name: 'German', code: 'de' },
  { name: 'Chinese', code: 'zh' },
  { name: 'Hindi', code: 'hi' },
  { name: 'Arabic', code: 'ar' },
];

const seedLanguages = async () => {
  try {
    for (const languageData of languages) {
      const existing = await prisma.language.findFirst({
        where: { English: { equals: languageData.name, mode: 'insensitive' } },
      });
      if (!existing) {
        const nextId = await getNextId('language', 'LanguageNum');
        await prisma.language.create({
          data: {
            LanguageNum: nextId,
            English: languageData.name,
            EnglishComments: languageData.code,
            IsObsolete: 0,
          },
        });
      }
    }
    console.log('Languages seeded successfully!');
  } catch (error) {
    console.error('Error seeding languages:', error);
  } finally {
    await prisma.$disconnect();
  }
};

seedLanguages();
