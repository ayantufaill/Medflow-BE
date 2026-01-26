import { LanguageModel } from '../models/language.model';

export class LanguageService {
  async getAllLanguages(isActive?: boolean) {
    const query: any = {};
    
    if (isActive !== undefined) {
      query.isActive = isActive;
    }

    const languages = await LanguageModel.find(query)
      .sort({ name: 1 })
      .lean();

    return languages;
  }

  async getLanguageByCode(code: string) {
    const language = await LanguageModel.findOne({ code: code.toLowerCase() }).lean();
    return language;
  }
}

export const languageService = new LanguageService();
