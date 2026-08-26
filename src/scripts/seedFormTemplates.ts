import { prisma } from '../config/db';

type SeedField = {
  key: string;
  label: string;
  type: string;
  required?: boolean;
};

type SeedTemplate = {
  templateId: string;
  name: string;
  description?: string | null;
  fields: SeedField[];
};

// Mirrors Medflow-FE's src/pages/portal/portalFormTemplates.js exactly. The FE
// hardcodes these 3 templateIds and renders whatever `fields` this row has, so if
// this seed doesn't exist in an environment, pending-forms breaks there for every
// patient. signatureName is 'signature' (not 'text') here — the FE copy still says
// text, but this is the real signature-capture field the consent record is signed
// with, so the backend is the source of truth for its type.
export const SEED_FORM_TEMPLATES: SeedTemplate[] = [
  {
    templateId: 'demographics-update',
    name: 'Demographics Update',
    fields: [
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
    ],
  },
  {
    templateId: 'medical-history-update',
    name: 'Medical History Update',
    fields: [
      { key: 'allergies', label: 'Allergies', type: 'textarea' },
      { key: 'medications', label: 'Current Medications', type: 'textarea' },
      { key: 'conditions', label: 'Medical Conditions', type: 'textarea' },
      { key: 'pastSurgeries', label: 'Past Surgeries', type: 'textarea' },
      { key: 'familyHistory', label: 'Family History', type: 'textarea' },
      { key: 'notes', label: 'Additional Notes', type: 'textarea' },
    ],
  },
  {
    templateId: 'consent-acknowledgement',
    name: 'Consent Acknowledgement',
    fields: [
      { key: 'consentToTreatment', label: 'I consent to treatment', type: 'boolean', required: true },
      { key: 'privacyPolicyAcknowledged', label: 'I acknowledge privacy policy', type: 'boolean', required: true },
      { key: 'communicationConsent', label: 'I agree to communication via phone/email/SMS', type: 'boolean' },
      { key: 'signatureName', label: 'Full Name (Digital Signature)', type: 'signature', required: true },
      { key: 'signedDate', label: 'Signed Date', type: 'date', required: true },
    ],
  },
];

/** Upsert by templateId so re-running after a field fix lands it everywhere, not just fresh environments. */
export const seedFormTemplates = async () => {
  for (const template of SEED_FORM_TEMPLATES) {
    const fields = template.fields.map((field, index) => ({
      key: field.key,
      label: field.label,
      type: field.type,
      required: field.required === true,
      options: null,
      order: index,
    }));

    await prisma.formtemplate.upsert({
      where: { templateId: template.templateId },
      update: {
        name: template.name,
        description: template.description ?? null,
        fields: fields as any,
      },
      create: {
        templateId: template.templateId,
        name: template.name,
        description: template.description ?? null,
        fields: fields as any,
        isActive: true,
      },
    });
  }
};

// Guards direct `tsx src/scripts/seedFormTemplates.ts` execution from running when
// this module is instead imported (e.g. by tests exercising seedFormTemplates()
// against a mocked prisma client).
const isMainModule = import.meta.url === `file://${process.argv[1]}`;
if (isMainModule) {
  seedFormTemplates()
    .then(async () => {
      console.log('Form templates seeded successfully!');
      await prisma.$disconnect();
    })
    .catch(async (error) => {
      console.error('Error seeding form templates:', error);
      await prisma.$disconnect();
      process.exit(1);
    });
}
