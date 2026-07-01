import { prisma } from '../config/db';
import { NotFoundError, ConflictError } from '../utils/error.util';
import { logActivity } from '../utils/activity-logger.util';
import { getNextId } from '../utils/opendental-ids.util';
import { mapUser } from '../utils/opendental-auth.util';

const parseJson = <T>(value?: string | null): T => {
  if (!value) return {} as T;
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' ? (parsed as T) : ({} as T);
  } catch {
    return {} as T;
  }
};

const buildJson = (value: Record<string, unknown>) => JSON.stringify(value);

type TemplateMeta = {
  description?: string | null;
  templateStructure?: any;
  defaultContent?: any;
  specialty?: string | null;
  isActive?: boolean;
  createdBy?: string | null;
  createdAt?: string | null;
};

export class NoteTemplateService {
  private async mapTemplateRow(row: any) {
    const meta = parseJson<TemplateMeta>(row.MainText);
    const creatorUser = meta.createdBy
      ? await prisma.userod.findUnique({ where: { UserNum: BigInt(meta.createdBy) } })
      : null;
    const mappedCreator = creatorUser ? await mapUser(creatorUser) : null;

    return {
      _id: row.AutoNoteNum.toString(),
      name: row.AutoNoteName ?? '',
      description: meta.description ?? null,
      templateStructure: meta.templateStructure ?? null,
      defaultContent: meta.defaultContent ?? null,
      specialty: meta.specialty ?? null,
      isActive: meta.isActive ?? true,
      createdBy: mappedCreator
        ? {
            _id: mappedCreator._id,
            firstName: mappedCreator.firstName,
            lastName: mappedCreator.lastName,
            email: mappedCreator.email || null,
          }
        : (meta.createdBy ? { _id: meta.createdBy, firstName: '', lastName: '', email: null } : null),
      createdAt: meta.createdAt ?? null,
    };
  }

  async getAllNoteTemplates(
    page = 1,
    limit = 10,
    search?: string,
    isActive?: boolean,
    specialty?: string
  ) {
    const skip = (page - 1) * limit;
    const where: any = {};

    if (search) {
      where.AutoNoteName = { contains: search };
    }

    const [rows, total] = await Promise.all([
      prisma.autonote.findMany({
        where,
        orderBy: { AutoNoteName: 'asc' },
        skip,
        take: limit,
      }),
      prisma.autonote.count({ where }),
    ]);

    let templates = await Promise.all(rows.map((row) => this.mapTemplateRow(row)));

    if (isActive !== undefined) {
      templates = templates.filter((t) => t.isActive === isActive);
    }
    if (specialty) {
      templates = templates.filter((t) => t.specialty === specialty);
    }

    return {
      noteTemplates: templates,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  async getNoteTemplateById(noteTemplateId: string) {
    const row = await prisma.autonote.findUnique({
      where: { AutoNoteNum: BigInt(noteTemplateId) },
    });
    if (!row) {
      throw new NotFoundError('Note template not found');
    }

    return this.mapTemplateRow(row);
  }

  async createNoteTemplate(
    data: {
      name: string;
      description?: string;
      templateStructure: any;
      defaultContent?: any;
      specialty?: string;
      isActive?: boolean;
    },
    createdBy: string
  ) {
    const existing = await prisma.autonote.findFirst({
      where: { AutoNoteName: data.name },
    });
    if (existing) {
      throw new ConflictError('Note template with this name already exists');
    }

    const nextId = await getNextId('autonote', 'AutoNoteNum');
    const payload: TemplateMeta = {
      description: data.description ?? null,
      templateStructure: data.templateStructure,
      defaultContent: data.defaultContent ?? null,
      specialty: data.specialty ?? null,
      isActive: data.isActive ?? true,
      createdBy,
      createdAt: new Date().toISOString(),
    };

    const template = await prisma.autonote.create({
      data: {
        AutoNoteNum: nextId,
        AutoNoteName: data.name,
        MainText: buildJson(payload),
      },
    });

    await logActivity(createdBy, 'created', 'note_templates', template.AutoNoteNum.toString(), undefined, template);

    return this.mapTemplateRow(template);
  }

  async updateNoteTemplate(
    noteTemplateId: string,
    updates: {
      name?: string;
      description?: string;
      templateStructure?: any;
      defaultContent?: any;
      specialty?: string;
      isActive?: boolean;
    },
    userId: string
  ) {
    const row = await prisma.autonote.findUnique({
      where: { AutoNoteNum: BigInt(noteTemplateId) },
    });
    if (!row) {
      throw new NotFoundError('Note template not found');
    }

    if (updates.name && updates.name !== row.AutoNoteName) {
      const existing = await prisma.autonote.findFirst({
        where: { AutoNoteName: updates.name },
      });
      if (existing) {
        throw new ConflictError('Note template with this name already exists');
      }
    }

    const meta = parseJson<TemplateMeta>(row.MainText);
    const nextMeta: TemplateMeta = {
      ...meta,
      description: updates.description ?? meta.description,
      templateStructure: updates.templateStructure ?? meta.templateStructure,
      defaultContent: updates.defaultContent ?? meta.defaultContent,
      specialty: updates.specialty ?? meta.specialty,
      isActive: updates.isActive ?? meta.isActive,
    };

    const updated = await prisma.autonote.update({
      where: { AutoNoteNum: row.AutoNoteNum },
      data: {
        AutoNoteName: updates.name ?? undefined,
        MainText: buildJson(nextMeta),
      },
    });

    await logActivity(userId, 'updated', 'note_templates', noteTemplateId, row, updated);

    return this.mapTemplateRow(updated);
  }

  async deleteNoteTemplate(noteTemplateId: string, userId: string) {
    const row = await prisma.autonote.findUnique({
      where: { AutoNoteNum: BigInt(noteTemplateId) },
    });
    if (!row) {
      throw new NotFoundError('Note template not found');
    }

    await prisma.autonote.delete({ where: { AutoNoteNum: row.AutoNoteNum } });
    await logActivity(userId, 'deleted', 'note_templates', noteTemplateId, row, undefined);

    return { message: 'Note template deleted successfully' };
  }

  async duplicateTemplate(noteTemplateId: string, newName: string, userId: string) {
    const row = await prisma.autonote.findUnique({
      where: { AutoNoteNum: BigInt(noteTemplateId) },
    });
    if (!row) {
      throw new NotFoundError('Note template not found');
    }

    const existing = await prisma.autonote.findFirst({
      where: { AutoNoteName: { equals: newName } },
    });
    if (existing) {
      throw new ConflictError('Note template with this name already exists');
    }

    const nextId = await getNextId('autonote', 'AutoNoteNum');
    const created = await prisma.autonote.create({
      data: {
        AutoNoteNum: nextId,
        AutoNoteName: newName,
        MainText: row.MainText,
      },
    });

    await logActivity(userId, 'created', 'note_templates', created.AutoNoteNum.toString(), undefined, created);

    return this.mapTemplateRow(created);
  }

  async duplicateNoteTemplate(noteTemplateId: string, newName: string, userId: string) {
    return this.duplicateTemplate(noteTemplateId, newName, userId);
  }

  async getTemplatesBySpecialty(specialty: string, page = 1, limit = 10, search?: string) {
    return this.getAllNoteTemplates(page, limit, search, undefined, specialty);
  }

  async getActiveTemplates(page = 1, limit = 10, search?: string) {
    return this.getAllNoteTemplates(page, limit, search, true);
  }

  async toggleNoteTemplateStatus(noteTemplateId: string, isActive: boolean, userId: string) {
    return this.updateNoteTemplate(noteTemplateId, { isActive }, userId);
  }
}

export const noteTemplateService = new NoteTemplateService();
