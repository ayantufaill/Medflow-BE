import { prisma } from '../config/db';
import { NotFoundError, ConflictError, ValidationError } from '../utils/error.util';

export const FORM_FIELD_TYPES = [
  'text',
  'textarea',
  'email',
  'number',
  'phone',
  'date',
  'boolean',
  'select',
  'radio',
  // Value is a base64 PNG string captured at submission time. No schema column —
  // it's stored the same way as any other field, inside the `fields: Json` array.
  'signature',
] as const;
export type FormFieldType = (typeof FORM_FIELD_TYPES)[number];

const OPTION_FIELD_TYPES = new Set<FormFieldType>(['select', 'radio']);

export interface FormFieldOption {
  value: string;
  label: string;
}

export interface FormFieldDefinition {
  key: string;
  label: string;
  type: FormFieldType;
  required: boolean;
  options: FormFieldOption[] | null;
  order: number;
}

export interface FormTemplateSummary {
  id: number;
  templateId: string;
  name: string;
  description: string | null;
  fields: FormFieldDefinition[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const TEMPLATE_ID_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/** Normalizes + structurally validates a raw fields payload before it's stored. */
function normalizeFields(rawFields: unknown): FormFieldDefinition[] {
  if (!Array.isArray(rawFields) || rawFields.length === 0) {
    throw new ValidationError('fields must be a non-empty array');
  }

  const seenKeys = new Set<string>();
  const normalized = rawFields.map((raw, index): FormFieldDefinition => {
    if (!raw || typeof raw !== 'object') {
      throw new ValidationError(`fields[${index}] must be an object`);
    }
    const field = raw as Record<string, unknown>;

    if (typeof field.key !== 'string' || !field.key.trim()) {
      throw new ValidationError(`fields[${index}].key is required`);
    }
    if (seenKeys.has(field.key)) {
      throw new ValidationError(`fields[${index}].key "${field.key}" is duplicated within this template`);
    }
    seenKeys.add(field.key);

    if (typeof field.label !== 'string' || !field.label.trim()) {
      throw new ValidationError(`fields[${index}].label is required`);
    }

    if (typeof field.type !== 'string' || !FORM_FIELD_TYPES.includes(field.type as FormFieldType)) {
      throw new ValidationError(
        `fields[${index}].type must be one of: ${FORM_FIELD_TYPES.join(', ')}`
      );
    }
    const type = field.type as FormFieldType;

    let options: FormFieldOption[] | null = null;
    if (OPTION_FIELD_TYPES.has(type)) {
      if (!Array.isArray(field.options) || field.options.length === 0) {
        throw new ValidationError(`fields[${index}].options is required for type "${type}"`);
      }
      options = field.options.map((opt, optIndex) => {
        if (
          !opt ||
          typeof opt !== 'object' ||
          typeof (opt as any).value !== 'string' ||
          typeof (opt as any).label !== 'string' ||
          !(opt as any).value.trim() ||
          !(opt as any).label.trim()
        ) {
          throw new ValidationError(`fields[${index}].options[${optIndex}] must be { value, label }`);
        }
        return { value: (opt as any).value, label: (opt as any).label };
      });
    }

    return {
      key: field.key,
      label: field.label,
      type,
      required: field.required === true,
      options,
      order: typeof field.order === 'number' ? field.order : index,
    };
  });

  return normalized.sort((a, b) => a.order - b.order);
}

function mapTemplate(row: {
  id: number;
  templateId: string;
  name: string;
  description: string | null;
  fields: unknown;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}): FormTemplateSummary {
  return {
    id: row.id,
    templateId: row.templateId,
    name: row.name,
    description: row.description,
    fields: (row.fields as FormFieldDefinition[]) ?? [],
    isActive: row.isActive,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export class FormTemplateService {
  async getAllTemplates(includeInactive = false): Promise<FormTemplateSummary[]> {
    const templates = await prisma.formtemplate.findMany({
      where: includeInactive ? undefined : { isActive: true },
      orderBy: { name: 'asc' },
    });
    return templates.map(mapTemplate);
  }

  async getTemplateByTemplateId(templateId: string): Promise<FormTemplateSummary> {
    const template = await prisma.formtemplate.findUnique({ where: { templateId } });
    if (!template) {
      throw new NotFoundError(`Form template "${templateId}" not found`);
    }
    return mapTemplate(template);
  }

  async createTemplate(data: {
    templateId: string;
    name: string;
    description?: string | null;
    fields: unknown;
    isActive?: boolean;
  }): Promise<FormTemplateSummary> {
    if (!TEMPLATE_ID_PATTERN.test(data.templateId)) {
      throw new ValidationError('templateId must be lowercase, alphanumeric, hyphen-separated (e.g. "new-patient-intake")');
    }

    const existing = await prisma.formtemplate.findUnique({ where: { templateId: data.templateId } });
    if (existing) {
      throw new ConflictError(`A form template with templateId "${data.templateId}" already exists.`);
    }

    const fields = normalizeFields(data.fields);

    const created = await prisma.formtemplate.create({
      data: {
        templateId: data.templateId,
        name: data.name,
        description: data.description ?? null,
        fields: fields as any,
        isActive: data.isActive ?? true,
      },
    });

    return mapTemplate(created);
  }

  async updateTemplate(
    templateId: string,
    data: {
      name?: string;
      description?: string | null;
      fields?: unknown;
      isActive?: boolean;
    }
  ): Promise<FormTemplateSummary> {
    const existing = await prisma.formtemplate.findUnique({ where: { templateId } });
    if (!existing) {
      throw new NotFoundError(`Form template "${templateId}" not found`);
    }

    const updated = await prisma.formtemplate.update({
      where: { templateId },
      data: {
        name: data.name ?? undefined,
        description: data.description !== undefined ? data.description : undefined,
        fields: data.fields !== undefined ? (normalizeFields(data.fields) as any) : undefined,
        isActive: data.isActive !== undefined ? data.isActive : undefined,
      },
    });

    return mapTemplate(updated);
  }

  /** Soft-disable rather than hard delete — past submissions still reference this templateId. */
  async deactivateTemplate(templateId: string): Promise<FormTemplateSummary> {
    const existing = await prisma.formtemplate.findUnique({ where: { templateId } });
    if (!existing) {
      throw new NotFoundError(`Form template "${templateId}" not found`);
    }
    const updated = await prisma.formtemplate.update({
      where: { templateId },
      data: { isActive: false },
    });
    return mapTemplate(updated);
  }
}

export const formTemplateService = new FormTemplateService();
