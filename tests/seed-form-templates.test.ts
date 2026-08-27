import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../src/config/db', () => ({
  prisma: {
    formtemplate: {
      upsert: vi.fn().mockResolvedValue({}),
    },
    $disconnect: vi.fn(),
  },
}));

import { prisma } from '../src/config/db';
import { seedFormTemplates, SEED_FORM_TEMPLATES } from '../src/scripts/seedFormTemplates';

describe('seedFormTemplates', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('upserts (not create-only) each of the 3 FE-hardcoded templates by templateId', async () => {
    await seedFormTemplates();

    expect(prisma.formtemplate.upsert).toHaveBeenCalledTimes(SEED_FORM_TEMPLATES.length);
    const templateIds = SEED_FORM_TEMPLATES.map((t) => t.templateId);
    expect(templateIds).toEqual([
      'demographics-update',
      'medical-history-update',
      'consent-acknowledgement',
    ]);

    for (const templateId of templateIds) {
      expect(prisma.formtemplate.upsert).toHaveBeenCalledWith(
        expect.objectContaining({ where: { templateId } })
      );
    }
  });

  it('is idempotent — running twice produces the same upsert calls both times', async () => {
    await seedFormTemplates();
    const firstRunArgs = vi.mocked(prisma.formtemplate.upsert).mock.calls.map((call) => call[0]);

    vi.mocked(prisma.formtemplate.upsert).mockClear();

    await seedFormTemplates();
    const secondRunArgs = vi.mocked(prisma.formtemplate.upsert).mock.calls.map((call) => call[0]);

    expect(secondRunArgs).toEqual(firstRunArgs);
  });

  it('makes consent-acknowledgement.signatureName a signature field, not text', () => {
    const consentTemplate = SEED_FORM_TEMPLATES.find((t) => t.templateId === 'consent-acknowledgement');
    const signatureField = consentTemplate?.fields.find((f) => f.key === 'signatureName');

    expect(signatureField?.type).toBe('signature');
  });

  it('matches every other field key/label/type/required against the FE hardcoded copy', () => {
    const demographics = SEED_FORM_TEMPLATES.find((t) => t.templateId === 'demographics-update');
    expect(demographics?.fields).toEqual([
      { key: 'preferredName', label: 'Preferred Name', type: 'text' },
      { key: 'phonePrimary', label: 'Primary Phone', type: 'text' },
      { key: 'email', label: 'Email', type: 'email' },
      { key: 'addressLine1', label: 'Address Line 1', type: 'text' },
      { key: 'city', label: 'City', type: 'text' },
      { key: 'state', label: 'State', type: 'text' },
      { key: 'postalCode', label: 'Postal Code', type: 'text' },
      { key: 'emergencyContactName', label: 'Emergency Contact Name', type: 'text' },
      { key: 'emergencyContactPhone', label: 'Emergency Contact Phone', type: 'text' },
      { key: 'notes', label: 'Additional Notes', type: 'textarea' },
    ]);

    const medicalHistory = SEED_FORM_TEMPLATES.find((t) => t.templateId === 'medical-history-update');
    expect(medicalHistory?.fields).toEqual([
      { key: 'allergies', label: 'Allergies', type: 'textarea' },
      { key: 'medications', label: 'Current Medications', type: 'textarea' },
      { key: 'conditions', label: 'Medical Conditions', type: 'textarea' },
      { key: 'pastSurgeries', label: 'Past Surgeries', type: 'textarea' },
      { key: 'familyHistory', label: 'Family History', type: 'textarea' },
      { key: 'notes', label: 'Additional Notes', type: 'textarea' },
    ]);

    const consent = SEED_FORM_TEMPLATES.find((t) => t.templateId === 'consent-acknowledgement');
    expect(consent?.fields).toEqual([
      { key: 'consentToTreatment', label: 'I consent to treatment', type: 'boolean', required: true },
      { key: 'privacyPolicyAcknowledged', label: 'I acknowledge privacy policy', type: 'boolean', required: true },
      { key: 'communicationConsent', label: 'I agree to communication via phone/email/SMS', type: 'boolean' },
      { key: 'signatureName', label: 'Full Name (Digital Signature)', type: 'signature', required: true },
      { key: 'signedDate', label: 'Signed Date', type: 'date', required: true },
    ]);
  });
});
