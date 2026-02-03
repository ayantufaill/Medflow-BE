import { prisma } from '../config/db';

export class LanguageService {
  async getAllLanguages(search?: string, isActive?: boolean) {
    const where: any = {};
    if (isActive === undefined || isActive === true) {
      where.IsObsolete = 0;
    } else {
      where.IsObsolete = 1;
    }
    if (search) {
      where.OR = [
        { English: { contains: search } },
        { EnglishComments: { contains: search } },
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
      where: { English: { equals: code } },
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
