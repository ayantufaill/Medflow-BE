import dotenv from 'dotenv';
import connectDB from '../config/db';
import { LanguageModel } from '../models/language.model';

dotenv.config();

// Top 10 most spoken languages in the world (by total speakers)
const defaultLanguages = [
  { code: 'en', name: 'English', nativeName: 'English' },
  { code: 'zh', name: 'Mandarin Chinese', nativeName: '中文' },
  { code: 'hi', name: 'Hindi', nativeName: 'हिन्दी' },
  { code: 'es', name: 'Spanish', nativeName: 'Español' },
  { code: 'fr', name: 'French', nativeName: 'Français' },
  { code: 'ar', name: 'Arabic', nativeName: 'العربية' },
  { code: 'bn', name: 'Bengali', nativeName: 'বাংলা' },
  { code: 'pt', name: 'Portuguese', nativeName: 'Português' },
  { code: 'ru', name: 'Russian', nativeName: 'Русский' },
  { code: 'ja', name: 'Japanese', nativeName: '日本語' },
];

const seedLanguages = async () => {
  try {
    await connectDB();

    for (const languageData of defaultLanguages) {
      const existingLanguage = await LanguageModel.findOne({ code: languageData.code });

      if (existingLanguage) {
        console.log(`Language "${languageData.name}" already exists, skipping...`);
        continue;
      }

      await LanguageModel.create({
        ...languageData,
        isActive: true,
      });
      console.log(`✓ Created language: ${languageData.name}`);
    }

    console.log('\n✅ Languages seeded successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error seeding languages:', error);
    process.exit(1);
  }
};

seedLanguages();
