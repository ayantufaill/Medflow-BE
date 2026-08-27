import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../src/config/db', () => ({
  prisma: {
    formtemplate: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      upsert: vi.fn(),
    },
  },
}));

import { prisma } from '../src/config/db';
import { FormTemplateService, FORM_FIELD_TYPES } from '../src/services/form-template.service';

const makeTemplateRow = (overrides: Record<string, unknown> = {}) => ({
  id: 1,
  templateId: 'consent-acknowledgement',
  name: 'Consent Acknowledgement',
  description: null,
  fields: [],
  isActive: true,
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
  ...overrides,
});

describe('FORM_FIELD_TYPES', () => {
  it('includes signature', () => {
    expect(FORM_FIELD_TYPES).toContain('signature');
  });
});

describe('FormTemplateService.createTemplate — signature field type', () => {
  let service: FormTemplateService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new FormTemplateService();
  });

  it('accepts a field with type "signature"', async () => {
    vi.mocked(prisma.formtemplate.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.formtemplate.create).mockResolvedValue(
      makeTemplateRow({
        fields: [
          { key: 'signatureName', label: 'Signature', type: 'signature', required: true, options: null, order: 0 },
        ],
      }) as any
    );

    const result = await service.createTemplate({
      templateId: 'consent-acknowledgement',
      name: 'Consent Acknowledgement',
      fields: [{ key: 'signatureName', label: 'Signature', type: 'signature', required: true }],
    });

    expect(result.fields[0].type).toBe('signature');
    expect(prisma.formtemplate.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          fields: [
            expect.objectContaining({ key: 'signatureName', type: 'signature', required: true }),
          ],
        }),
      })
    );
  });

  it('rejects an unknown field type', async () => {
    vi.mocked(prisma.formtemplate.findUnique).mockResolvedValue(null);

    // Matched on message, not `instanceof` — vitest module resolution can load
    // error.util.ts twice across mocked/unmocked paths, which breaks class identity.
    await expect(
      service.createTemplate({
        templateId: 'bad-template',
        name: 'Bad Template',
        fields: [{ key: 'foo', label: 'Foo', type: 'not-a-real-type' }],
      })
    ).rejects.toThrow(/fields\[0\]\.type must be one of/);

    expect(prisma.formtemplate.create).not.toHaveBeenCalled();
  });
});
