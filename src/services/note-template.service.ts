import { NoteTemplateModel } from '../models/note-template.model';
import { NotFoundError, ConflictError, ValidationError } from '../utils/error.util';
import { logActivity } from '../utils/activity-logger.util';

export class NoteTemplateService {
  async getAllNoteTemplates(page = 1, limit = 10, search?: string, specialty?: string, isActive?: boolean) {
    const skip = (page - 1) * limit;
    const query: any = {};

    if (search) {
      const decodedSearch = decodeURIComponent(search.replace(/\+/g, ' '));
      query.$or = [
        { name: { $regex: decodedSearch, $options: 'i' } },
        { description: { $regex: decodedSearch, $options: 'i' } },
        { specialty: { $regex: decodedSearch, $options: 'i' } },
      ];
    }

    if (specialty) {
      query.specialty = specialty;
    }

    if (isActive !== undefined) {
      query.isActive = isActive;
    }

    const [noteTemplates, total] = await Promise.all([
      NoteTemplateModel.find(query)
        .sort({ name: 1 })
        .skip(skip)
        .limit(limit)
        .populate('createdBy', 'firstName lastName email')
        .lean(),
      NoteTemplateModel.countDocuments(query),
    ]);

    return {
      noteTemplates,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  async getNoteTemplateById(noteTemplateId: string) {
    const noteTemplate = await NoteTemplateModel.findById(noteTemplateId)
      .populate('createdBy', 'firstName lastName email')
      .lean();

    if (!noteTemplate) {
      throw new NotFoundError('Note template not found');
    }

    return noteTemplate;
  }

  async createNoteTemplate(
    data: {
      name: string;
      description?: string;
      templateStructure: any;
      defaultContent?: any;
      specialty?: string;
    },
    createdBy: string
  ) {
    const existing = await NoteTemplateModel.findOne({ name: { $regex: `^${data.name}$`, $options: 'i' } }).lean();
    if (existing) {
      throw new ConflictError('Note template with this name already exists');
    }

    if (!data.templateStructure || typeof data.templateStructure !== 'object') {
      throw new ValidationError('Template structure must be a valid object');
    }

    const noteTemplate = await NoteTemplateModel.create({
      name: data.name,
      description: data.description,
      templateStructure: data.templateStructure,
      defaultContent: data.defaultContent,
      specialty: data.specialty,
      isActive: true,
      createdBy,
    });

    await logActivity(
      createdBy,
      'created',
      'note_templates',
      String(noteTemplate._id),
      undefined,
      noteTemplate.toObject(),
      undefined,
      undefined,
      'low'
    );

    return noteTemplate;
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
    updatedBy: string
  ) {
    const noteTemplate = await NoteTemplateModel.findById(noteTemplateId);
    if (!noteTemplate) {
      throw new NotFoundError('Note template not found');
    }

    if (updates.name && updates.name.toLowerCase() !== String(noteTemplate.name).toLowerCase()) {
      const existing = await NoteTemplateModel.findOne({
        name: { $regex: `^${updates.name}$`, $options: 'i' },
        _id: { $ne: noteTemplateId },
      }).lean();
      if (existing) {
        throw new ConflictError('Note template with this name already exists');
      }
    }

    if (updates.templateStructure && typeof updates.templateStructure !== 'object') {
      throw new ValidationError('Template structure must be a valid object');
    }

    const oldData = noteTemplate.toObject();

    Object.assign(noteTemplate, updates);

    await noteTemplate.save();

    await logActivity(
      updatedBy,
      'updated',
      'note_templates',
      noteTemplateId,
      oldData,
      noteTemplate.toObject(),
      undefined,
      undefined,
      'low'
    );

    return noteTemplate;
  }

  async deleteNoteTemplate(noteTemplateId: string, deletedBy: string) {
    const noteTemplate = await NoteTemplateModel.findById(noteTemplateId);
    if (!noteTemplate) {
      throw new NotFoundError('Note template not found');
    }

    const oldData = noteTemplate.toObject();

    await NoteTemplateModel.deleteOne({ _id: noteTemplateId });

    await logActivity(
      deletedBy,
      'deleted',
      'note_templates',
      noteTemplateId,
      oldData,
      undefined,
      undefined,
      undefined,
      'low'
    );

    return { message: 'Note template deleted successfully' };
  }

  async duplicateNoteTemplate(noteTemplateId: string, newName: string, userId: string) {
    const originalTemplate = await NoteTemplateModel.findById(noteTemplateId).lean();
    if (!originalTemplate) {
      throw new NotFoundError('Note template not found');
    }

    const existing = await NoteTemplateModel.findOne({ name: { $regex: `^${newName}$`, $options: 'i' } }).lean();
    if (existing) {
      throw new ConflictError('Note template with this name already exists');
    }

    const newTemplate = await NoteTemplateModel.create({
      name: newName,
      description: originalTemplate.description ? `${originalTemplate.description} (Copy of ${originalTemplate.name})` : `Copy of ${originalTemplate.name}`,
      templateStructure: originalTemplate.templateStructure,
      defaultContent: originalTemplate.defaultContent,
      specialty: originalTemplate.specialty,
      isActive: originalTemplate.isActive,
      createdBy: userId,
    });

    await logActivity(
      userId,
      'created',
      'note_templates',
      String(newTemplate._id),
      undefined,
      newTemplate.toObject(),
      undefined,
      `Duplicated from template: ${originalTemplate.name}`,
      'low'
    );

    return newTemplate;
  }

  async getTemplatesBySpecialty(specialty: string) {
    const noteTemplates = await NoteTemplateModel.find({
      specialty,
      isActive: true,
    })
      .sort({ name: 1 })
      .select('_id name description specialty')
      .lean();

    return noteTemplates;
  }

  async getActiveTemplates() {
    const noteTemplates = await NoteTemplateModel.find({
      isActive: true,
    })
      .sort({ specialty: 1, name: 1 })
      .select('_id name description specialty')
      .lean();

    return noteTemplates;
  }

  async toggleNoteTemplateStatus(noteTemplateId: string, userId: string) {
    const noteTemplate = await NoteTemplateModel.findById(noteTemplateId);
    if (!noteTemplate) {
      throw new NotFoundError('Note template not found');
    }

    const oldData = noteTemplate.toObject();
    (noteTemplate as any).isActive = !noteTemplate.isActive;
    await noteTemplate.save();

    await logActivity(
      userId,
      'updated',
      'note_templates',
      noteTemplateId,
      oldData,
      noteTemplate.toObject(),
      undefined,
      `Toggled template status to ${noteTemplate.isActive ? 'active' : 'inactive'}`,
      'low'
    );

    return noteTemplate;
  }
}

export const noteTemplateService = new NoteTemplateService();
