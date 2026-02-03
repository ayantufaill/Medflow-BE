import { prisma } from '../config/db';

export class LanguageService {
  async getAllLanguages(search?: string) {
    const where: any = { IsObsolete: 0 };
    if (search) {
      where.OR = [
        { English: { contains: search, mode: 'insensitive' } },
        { EnglishComments: { contains: search, mode: 'insensitive' } },
      ];
    }

    const languages = await prisma.language.findMany({
      where,
      orderBy: { English: 'asc' },
    });

    return languages.map((lang) => ({
      _id: lang.LanguageNum.toString(),
      code: (lang.English || '').toLowerCase(),
      name: lang.English ?? '',
      isActive: lang.IsObsolete ? false : true,
    }));
  }

  async getLanguageByCode(code: string) {
    const language = await prisma.language.findFirst({
      where: { English: { equals: code, mode: 'insensitive' } },
    });
    return language
      ? {
          _id: language.LanguageNum.toString(),
          code: (language.English || '').toLowerCase(),
          name: language.English ?? '',
          isActive: language.IsObsolete ? false : true,
        }
      : null;
  }
}

export const languageService = new LanguageService();
