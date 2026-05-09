import { prisma } from '../config/db';
import { NotFoundError } from '../utils/error.util';
import { getNextId } from '../utils/opendental-ids.util';

const parseJson = (value?: string | null): any => {
  if (!value) return {};
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
};

const buildJson = (value: any) => JSON.stringify(value);

export class ProgressNoteService {
  async getAllProgressNotes(filters: { patientId?: string; category?: string; tab?: string }, page = 1, limit = 25) {
    const skip = (page - 1) * limit;
    const where: any = {};

    if (filters.patientId) {
      where.PatNum = BigInt(filters.patientId);
    }
    
    // We only fetch notes that have noteType/category
    where.Note = { contains: '"isProgressNote":true' };

    const [rows, total] = await Promise.all([
      prisma.commlog.findMany({
        where,
        orderBy: { CommDateTime: 'desc' },
      }),
      prisma.commlog.count({ where })
    ]);

    // Fetch providers manually to map names since Commlog doesn't have a direct FK to provider in this schema design.
    // Instead, the provider ID is saved in the Note payload.
    const providerIds = new Set<string>();
    rows.forEach(row => {
      const meta = parseJson(row.Note);
      if (meta.providerId) providerIds.add(meta.providerId);
    });

    const providers = providerIds.size > 0 
      ? await prisma.provider.findMany({ where: { ProvNum: { in: Array.from(providerIds).map(id => BigInt(id)) } } })
      : [];
      
    const providerMap = new Map();
    providers.forEach(p => {
      providerMap.set(p.ProvNum.toString(), `${p.FName} ${p.LName}`.trim());
    });

    let notes = rows.map((row: any) => {
      const meta = parseJson(row.Note);
      const providerName = meta.providerId ? providerMap.get(meta.providerId) || 'Unknown Provider' : 'Unknown Provider';
      
      return {
        id: row.CommlogNum.toString(),
        date: row.CommDateTime,
        procedures: meta.procedures || [],
        description: meta.description || '',
        provider: providerName,
        signedBy: meta.signedBy || providerName,
        signedDate: meta.signedDate || row.CommDateTime,
        category: meta.category || 'General Notes',
        isExpanded: false
      };
    });

    if (filters.category && filters.category !== 'All') {
      notes = notes.filter(n => n.category === filters.category);
    }

    if (filters.tab === 'Archived') {
      notes = notes.filter(n => parseJson(rows.find(r => r.CommlogNum.toString() === n.id)?.Note).isArchived);
    } else {
      notes = notes.filter(n => !parseJson(rows.find(r => r.CommlogNum.toString() === n.id)?.Note).isArchived);
    }

    return {
      notes: notes.slice(skip, skip + limit),
      pagination: {
        page,
        limit,
        total: notes.length,
        pages: Math.ceil(notes.length / limit)
      }
    };
  }

  async createProgressNote(data: { patientId: string; category: string; description: string; providerId: string }) {
    const commlogNum = await getNextId('commlog', 'CommlogNum');
    
    // Fetch provider name for signature
    const provider = await prisma.provider.findUnique({
      where: { ProvNum: BigInt(data.providerId) }
    });
    const providerName = provider ? `${provider.FName} ${provider.LName}`.trim() : 'Unknown Provider';

    const meta = {
      isProgressNote: true,
      category: data.category,
      description: data.description,
      providerId: data.providerId,
      procedures: [],
      signedBy: providerName,
      signedDate: new Date().toISOString(),
      isArchived: false
    };

    const row = await prisma.commlog.create({
      data: {
        CommlogNum: commlogNum,
        PatNum: BigInt(data.patientId),
        CommDateTime: new Date(),
        Note: buildJson(meta),
        UserNum: null,
      }
    });

    return {
      id: row.CommlogNum.toString(),
      date: row.CommDateTime,
      procedures: meta.procedures,
      description: meta.description,
      provider: providerName,
      signedBy: meta.signedBy,
      signedDate: meta.signedDate,
      category: meta.category,
      isExpanded: true
    };
  }

  async addProcedureToNote(noteId: string, procedureCode: string) {
    const note = await prisma.commlog.findUnique({
      where: { CommlogNum: BigInt(noteId) }
    });

    if (!note) {
      throw new NotFoundError('Progress note not found');
    }

    const meta = parseJson(note.Note);
    
    if (!meta.procedures) {
      meta.procedures = [];
    }
    meta.procedures.push(procedureCode);

    await prisma.commlog.update({
      where: { CommlogNum: BigInt(noteId) },
      data: { Note: buildJson(meta) }
    });

    return { message: 'Procedure added successfully', procedures: meta.procedures };
  }
}

export const progressNoteService = new ProgressNoteService();
