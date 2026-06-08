import { prisma } from '../config/db';
import { getNextId } from '../utils/opendental-ids.util';
import { NotFoundError } from '../utils/error.util';

export class AudienceService {
  async getAllAudiences() {
    const docs = await prisma.document.findMany({
      where: {
        Note: { contains: '"documentType":"audience_segment"' },
      },
      orderBy: { DateCreated: 'desc' },
    });

    return docs.map((doc) => {
      let meta: any = {};
      try {
        meta = JSON.parse(doc.Note || '{}');
      } catch {
        meta = {};
      }

      return {
        _id: doc.DocNum.toString(),
        name: meta.name ?? doc.Description ?? 'Custom Audience',
        kind: meta.kind ?? 'Patient',
        filters: meta.filters ?? [],
      };
    });
  }

  async saveAudience(
    data: { name: string; kind: string; filters: any[] },
    userId?: string
  ) {
    const docNum = await getNextId('document', 'DocNum');
    const meta = {
      documentType: 'audience_segment',
      name: data.name,
      kind: data.kind,
      filters: data.filters ?? [],
    };

    await prisma.document.create({
      data: {
        DocNum: docNum,
        PatNum: null,
        Description: data.name,
        FileName: 'audience_segment.json',
        Note: JSON.stringify(meta),
        DateCreated: new Date(),
        UserNum: userId && /^\d+$/.test(userId) ? BigInt(userId) : null,
      },
    });

    return {
      _id: docNum.toString(),
      name: data.name,
      kind: data.kind,
      filters: data.filters ?? [],
    };
  }

  async deleteAudience(id: string) {
    const doc = await prisma.document.findUnique({
      where: { DocNum: BigInt(id) },
    });

    if (!doc || !doc.Note?.includes('"documentType":"audience_segment"')) {
      throw new NotFoundError('Audience segment not found');
    }

    await prisma.document.delete({
      where: { DocNum: BigInt(id) },
    });

    return { success: true };
  }
}

export const audienceService = new AudienceService();
