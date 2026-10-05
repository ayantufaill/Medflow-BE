import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../src/app';
import { prisma } from '../src/config/db';
import { getAdminAuthHeader } from './helpers/auth';
import { uniqueToken } from './helpers/unique';

describe('Patient Communication APIs', () => {
  let authHeader: { Authorization: string };

  // These tests write Email & Messaging settings to clinicpref; snapshot and
  // restore them so a local run doesn't leave test domains/numbers behind.
  const SNAPSHOT_PREFS = [
    'medflow.communication.email-domain',
    'medflow.communication.email-preferences',
    'medflow.communication.messaging-service',
    'medflow.communication.messaging-practice-details',
    'medflow.communication.automations',
  ];
  let prefSnapshot: { PrefName: string | null; ValueString: string | null; ClinicNum: bigint | null }[] = [];

  beforeAll(async () => {
    authHeader = await getAdminAuthHeader();
    prefSnapshot = await prisma.clinicpref.findMany({
      where: { PrefName: { in: SNAPSHOT_PREFS } },
      select: { PrefName: true, ValueString: true, ClinicNum: true },
    });
  });

  afterAll(async () => {
    await prisma.clinicpref.deleteMany({ where: { PrefName: { in: SNAPSHOT_PREFS } } });
    for (const pref of prefSnapshot) {
      const { getNextId } = await import('../src/utils/opendental-ids.util');
      await prisma.clinicpref.create({
        data: { ClinicPrefNum: await getNextId('clinicpref', 'ClinicPrefNum'), ...pref },
      });
    }
  });

  describe('Settings', () => {
    it('retrieves general communication settings', async () => {
      const res = await request(app)
        .get('/api/communication/settings')
        .set(authHeader);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeDefined();
      expect(res.body.data.emailConfig).toBeDefined();
      expect(res.body.data.textConfig).toBeDefined();
      expect(Array.isArray(res.body.data.reminders)).toBe(true);
    });

    it('updates general communication settings', async () => {
      const token = uniqueToken('comm-set');
      const updatePayload = {
        socialLinks: {
          facebook: `https://facebook.com/${token}`,
          instagram: `https://instagram.com/${token}`,
          linkedin: '',
          twitter: '',
          googlePlus: '',
        },
        skippedDays: ['2026-12-25'],
      };

      const res = await request(app)
        .put('/api/communication/settings')
        .set(authHeader)
        .send(updatePayload);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.socialLinks.facebook).toBe(updatePayload.socialLinks.facebook);
      expect(res.body.data.skippedDays).toContain('2026-12-25');
    });
  });

  describe('Email Preferences', () => {
    it('returns the sent-from and reply-to addresses', async () => {
      const res = await request(app).get('/api/communication/email-preferences').set(authHeader);
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveProperty('sentFromEmail');
      expect(res.body.data).toHaveProperty('replyToEmail');
    });

    it('rejects an invalid email address', async () => {
      const res = await request(app)
        .put('/api/communication/email-preferences')
        .set(authHeader)
        .send({ sentFromEmail: 'not-an-email', replyToEmail: 'info@example.com' });
      expect(res.status).toBe(400);
      expect(res.body.error.details).toHaveProperty('sentFromEmail');
    });

    it("requires 'Sent From' to use the email domain, then saves", async () => {
      const domain = `${uniqueToken('pref')}.test`;
      await request(app).put('/api/communication/email-domain').set(authHeader).send({ domain }).expect(200);

      const wrong = await request(app)
        .put('/api/communication/email-preferences')
        .set(authHeader)
        .send({ sentFromEmail: 'noreply@gmail.com', replyToEmail: 'info@example.com' });
      expect(wrong.status).toBe(400);
      expect(wrong.body.error.details).toEqual({ field: 'sentFromEmail' });

      const ok = await request(app)
        .put('/api/communication/email-preferences')
        .set(authHeader)
        .send({ sentFromEmail: `Hello@${domain.toUpperCase()}`, replyToEmail: 'Front.Desk@Example.com' });
      expect(ok.status).toBe(200);
      expect(ok.body.data).toEqual({ sentFromEmail: `hello@${domain}`, replyToEmail: 'front.desk@example.com' });
    });
  });

  describe('Messaging Service', () => {
    const details = {
      legalBusinessName: 'Bright Smile Dental Group LLC',
      doingBusinessAs: 'Bright Smile Dental',
      ein: '12-3456789',
      businessType: 'Limited liability company',
      phoneNumber: '(201) 500-6314',
      website: 'https://www.brightsmiledental.com',
      address: '125 East Main Street',
      address2: '',
      city: 'Ramsey',
      state: 'NJ',
      zip: '07446-1926',
    };

    it('returns the messaging service state', async () => {
      const res = await request(app).get('/api/communication/messaging-service').set(authHeader);
      expect(res.status).toBe(200);
      expect(['active', 'pending', 'inactive']).toContain(res.body.data.status);
    });

    it('returns practice details with the signed-in owner', async () => {
      const res = await request(app).get('/api/communication/messaging-service/practice-details').set(authHeader);
      expect(res.status).toBe(200);
      expect(res.body.data.owner.email).toBeTruthy();
      expect(res.body.data).toHaveProperty('legalBusinessName');
    });

    it('returns per-field errors for invalid practice details', async () => {
      const res = await request(app)
        .put('/api/communication/messaging-service/practice-details')
        .set(authHeader)
        .send({ ...details, zip: '123', businessType: 'Pirate ship' });
      expect(res.status).toBe(400);
      expect(Object.keys(res.body.error.details.fields).sort()).toEqual(['businessType', 'zip']);
    });

    it('saves practice details, storing only the EIN last 4', async () => {
      const res = await request(app)
        .put('/api/communication/messaging-service/practice-details')
        .set(authHeader)
        .send(details);
      expect(res.status).toBe(200);
      expect(res.body.data.einLast4).toBe('6789');
      expect(res.body.data.phoneNumber).toBe('2015006314');
      expect(JSON.stringify(res.body.data)).not.toContain('3456789');
    });

    it('searches available numbers and rejects a bad area code', async () => {
      const bad = await request(app)
        .get('/api/communication/messaging-service/available-numbers?areaCode=12')
        .set(authHeader);
      expect(bad.status).toBe(400);

      const res = await request(app)
        .get('/api/communication/messaging-service/available-numbers?areaCode=201')
        .set(authHeader);
      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeGreaterThan(0);
      res.body.data.forEach((n: string) => expect(n).toMatch(/^201\d{7}$/));
    });

    it('selects a number as pending, then refuses the same number again', async () => {
      const res = await request(app)
        .post('/api/communication/messaging-service/number')
        .set(authHeader)
        .send({ phoneNumber: '(201) 555-0142' });
      expect(res.status).toBe(200);
      expect(res.body.data).toMatchObject({ status: 'pending', phoneNumber: '2015550142' });

      const again = await request(app)
        .post('/api/communication/messaging-service/number')
        .set(authHeader)
        .send({ phoneNumber: '2015550142' });
      expect(again.status).toBe(400);
    });
  });

  describe('Automations', () => {
    const recall = {
      category: 'recall-reminders',
      timing: { type: 'offset', amount: 3, unit: 'Days', direction: 'Before', anchor: 'Prophy Due' },
      channel: 'SMS',
      body: 'Hi {Patient: First Name}, your cleaning is due soon.',
    };
    let createdId = '';

    it('lists a category with starter messages and an overview', async () => {
      const res = await request(app).get('/api/communication/automations?category=pre-appointment').set(authHeader);
      expect(res.status).toBe(200);
      expect(res.body.data.category).toBe('pre-appointment');
      expect(Array.isArray(res.body.data.messages)).toBe(true);
      expect(res.body.data.overview.actions).toBe(res.body.data.messages.length);
    });

    it('rejects an unknown category', async () => {
      const res = await request(app).get('/api/communication/automations?category=nope').set(authHeader);
      expect(res.status).toBe(400);
    });

    it('creates a message', async () => {
      const before = await request(app).get('/api/communication/automations?category=recall-reminders').set(authHeader);
      const res = await request(app).post('/api/communication/automations').set(authHeader).send(recall);
      expect(res.status).toBe(201);
      expect(res.body.data).toMatchObject({ active: true, channel: 'SMS', body: recall.body });
      createdId = res.body.data.id;

      const after = await request(app).get('/api/communication/automations?category=recall-reminders').set(authHeader);
      expect(after.body.data.overview.actions).toBe(before.body.data.overview.actions + 1);
    });

    it("rejects timing that doesn't fit the category", async () => {
      const res = await request(app)
        .post('/api/communication/automations')
        .set(authHeader)
        .send({ ...recall, timing: { type: 'event', event: 'When Appointment Created' } });
      expect(res.status).toBe(400);
    });

    it('rejects an empty message', async () => {
      const res = await request(app).post('/api/communication/automations').set(authHeader).send({ ...recall, body: ' ' });
      expect(res.status).toBe(400);
      expect(res.body.error.message).toMatch(/empty/);
    });

    it('updates a message', async () => {
      const res = await request(app)
        .put(`/api/communication/automations/${createdId}`)
        .set(authHeader)
        .send({ ...recall, timing: { ...recall.timing, amount: 5 }, channel: 'Email', subject: 'Due soon' });
      expect(res.status).toBe(200);
      expect(res.body.data).toMatchObject({ id: createdId, channel: 'Email', subject: 'Due soon' });
      expect(res.body.data.timing.amount).toBe(5);
    });

    it('turns a message off and on', async () => {
      const off = await request(app).patch(`/api/communication/automations/${createdId}/active`).set(authHeader).send({ active: false });
      expect(off.status).toBe(200);
      expect(off.body.data.active).toBe(false);

      const bad = await request(app).patch(`/api/communication/automations/${createdId}/active`).set(authHeader).send({ active: 'yes' });
      expect(bad.status).toBe(400);
    });

    it('deletes a message, then 404s for it', async () => {
      const del = await request(app).delete(`/api/communication/automations/${createdId}`).set(authHeader);
      expect(del.status).toBe(200);

      const again = await request(app).delete(`/api/communication/automations/${createdId}`).set(authHeader);
      expect(again.status).toBe(404);
    });
  });

  describe('Email Domain', () => {
    it('returns the email domain state', async () => {
      const res = await request(app)
        .get('/api/communication/email-domain')
        .set(authHeader);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(['not_configured', 'pending', 'verified', 'failed']).toContain(res.body.data.status);
      expect(Array.isArray(res.body.data.records)).toBe(true);
    });

    it('rejects an invalid domain', async () => {
      const res = await request(app)
        .put('/api/communication/email-domain')
        .set(authHeader)
        .send({ domain: 'not a domain' });

      expect(res.status).toBe(400);
    });

    it('sets a domain, normalizing it and issuing pending DNS records', async () => {
      const domain = `${uniqueToken('dom')}.test`;
      const res = await request(app)
        .put('/api/communication/email-domain')
        .set(authHeader)
        .send({ domain: `https://www.${domain.toUpperCase()}/` });

      expect(res.status).toBe(200);
      expect(res.body.data.domain).toBe(domain);
      expect(res.body.data.status).toBe('pending');
      expect(res.body.data.records).toHaveLength(5);

      const again = await request(app)
        .put('/api/communication/email-domain')
        .set(authHeader)
        .send({ domain });
      expect(again.status).toBe(400);
    });

    it('verifies against DNS and reports unpublished records', async () => {
      const res = await request(app)
        .post('/api/communication/email-domain/verify')
        .set(authHeader);

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('pending');
      expect(res.body.data.lastCheckedAt).toBeTruthy();
      expect(res.body.data.records.every((r: { found: boolean }) => r.found === false)).toBe(true);
    });
  });

  describe('Templates', () => {
    it('lists communication templates and seeds defaults if empty', async () => {
      const res = await request(app)
        .get('/api/communication/templates')
        .set(authHeader);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThan(0);
      expect(res.body.data[0]._id).toBeDefined();
    });

    it('manages templates CRUD flow', async () => {
      const token = uniqueToken('tpl');
      const createPayload = {
        description: `Promo Template ${token}`,
        subject: `Discount Offer ${token}`,
        bodyText: 'Get 20% off your next scaling session!',
        templateType: 3, // Email/Text
      };

      // 1. Create
      const createRes = await request(app)
        .post('/api/communication/templates')
        .set(authHeader)
        .send(createPayload);

      expect(createRes.status).toBe(201);
      expect(createRes.body.success).toBe(true);
      expect(createRes.body.data.description).toBe(createPayload.description);
      const templateId = createRes.body.data._id;

      // 2. Read by ID
      const readRes = await request(app)
        .get(`/api/communication/templates/${templateId}`)
        .set(authHeader);

      expect(readRes.status).toBe(200);
      expect(readRes.body.data.subject).toBe(createPayload.subject);

      // 3. Update
      const updatePayload = {
        description: `Updated Template ${token}`,
        bodyText: 'Updated promo content',
        templateType: 3,
      };
      const updateRes = await request(app)
        .put(`/api/communication/templates/${templateId}`)
        .set(authHeader)
        .send(updatePayload);

      expect(updateRes.status).toBe(200);
      expect(updateRes.body.data.description).toBe(updatePayload.description);
      expect(updateRes.body.data.bodyText).toBe(updatePayload.bodyText);

      // 4. Delete
      const deleteRes = await request(app)
        .delete(`/api/communication/templates/${templateId}`)
        .set(authHeader);

      expect(deleteRes.status).toBe(200);

      // 5. Verify deleted
      const verifyRes = await request(app)
        .get(`/api/communication/templates/${templateId}`)
        .set(authHeader);

      expect(verifyRes.status).toBe(404);
    });
  });

  describe('Email Campaigns', () => {
    it('lists campaigns and retrieves metrics summary', async () => {
      const listRes = await request(app)
        .get('/api/communication/campaigns')
        .set(authHeader);

      expect(listRes.status).toBe(200);
      expect(listRes.body.success).toBe(true);
      expect(Array.isArray(listRes.body.data.campaigns)).toBe(true);

      const metricsRes = await request(app)
        .get('/api/communication/campaigns/metrics')
        .set(authHeader);

      expect(metricsRes.status).toBe(200);
      expect(metricsRes.body.success).toBe(true);
      expect(metricsRes.body.data.totalSent).toBeDefined();
      expect(metricsRes.body.data.totalOpened).toBeDefined();
    });

    it('manages campaigns CRUD flow', async () => {
      const token = uniqueToken('cmp');
      const createPayload = {
        subject: `Holiday Botox Campaign ${token}`,
        body: 'Reserve your appointment now to get Botox for just $10/unit.',
        status: 'Draft',
        targetAudienceId: 'aud-123',
      };

      // 1. Create
      const createRes = await request(app)
        .post('/api/communication/campaigns')
        .set(authHeader)
        .send(createPayload);

      expect(createRes.status).toBe(201);
      expect(createRes.body.data.name).toBe(createPayload.subject);
      expect(createRes.body.data.status).toBe('Draft');
      const campaignId = createRes.body.data._id;

      // 2. Read by ID
      const readRes = await request(app)
        .get(`/api/communication/campaigns/${campaignId}`)
        .set(authHeader);

      expect(readRes.status).toBe(200);
      expect(readRes.body.data.opened).toBe('NA');

      // 3. Update (Transition to Sent)
      const updatePayload = {
        subject: `Holiday Botox Campaign ${token}`,
        body: 'Reserve your appointment now to get Botox for just $10/unit.',
        status: 'Sent',
        targetAudienceId: 'aud-123',
      };
      const updateRes = await request(app)
        .put(`/api/communication/campaigns/${campaignId}`)
        .set(authHeader)
        .send(updatePayload);

      expect(updateRes.status).toBe(200);
      expect(updateRes.body.data.status).toBe('Sent');
      expect(updateRes.body.data.opened).not.toBe('NA');

      // 4. Delete
      const deleteRes = await request(app)
        .delete(`/api/communication/campaigns/${campaignId}`)
        .set(authHeader);

      expect(deleteRes.status).toBe(200);
    });
  });

  describe('Questionnaires', () => {
    it('lists custom and system questionnaires', async () => {
      const res = await request(app)
        .get('/api/communication/questionnaires')
        .set(authHeader);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data.custom)).toBe(true);
      expect(Array.isArray(res.body.data.system)).toBe(true);
      expect(res.body.data.system.length).toBe(4); // 4 default system forms
    });

    it('reads system questionnaires by ID', async () => {
      const res = await request(app)
        .get('/api/communication/questionnaires/sys-1')
        .set(authHeader);

      expect(res.status).toBe(200);
      expect(res.body.data.description).toBe('Dental History');
      expect(res.body.data.questions.length).toBeGreaterThan(0);
    });

    it('manages custom questionnaires CRUD flow', async () => {
      const token = uniqueToken('qst');
      const createPayload = {
        description: `COVID-19 Consent Form ${token}`,
        questions: [
          { name: 'Have you had fever in the last 14 days?', type: 'checkbox', choices: [] },
          { name: 'Please detail any contact with travel cases:', type: 'text', choices: [] },
        ],
      };

      // 1. Create
      const createRes = await request(app)
        .post('/api/communication/questionnaires')
        .set(authHeader)
        .send(createPayload);

      expect(createRes.status).toBe(201);
      expect(createRes.body.data.description).toBe(createPayload.description);
      expect(createRes.body.data.questions.length).toBe(2);
      const questionnaireId = createRes.body.data._id;

      // 2. Read
      const readRes = await request(app)
        .get(`/api/communication/questionnaires/${questionnaireId}`)
        .set(authHeader);

      expect(readRes.status).toBe(200);
      expect(readRes.body.data.questions[0].name).toBe(createPayload.questions[0].name);

      // 3. Update
      const updatePayload = {
        description: `Updated COVID-19 Form ${token}`,
        questions: [
          { name: 'Have you had fever in the last 14 days?', type: 'checkbox', choices: [] },
          { name: 'Any difficulty breathing?', type: 'checkbox', choices: [] },
          { name: 'Details:', type: 'text', choices: [] },
        ],
      };
      const updateRes = await request(app)
        .put(`/api/communication/questionnaires/${questionnaireId}`)
        .set(authHeader)
        .send(updatePayload);

      expect(updateRes.status).toBe(200);
      expect(updateRes.body.data.description).toBe(updatePayload.description);
      expect(updateRes.body.data.questions.length).toBe(3);

      // 4. Delete
      const deleteRes = await request(app)
        .delete(`/api/communication/questionnaires/${questionnaireId}`)
        .set(authHeader);

      expect(deleteRes.status).toBe(200);
    });
  });

  describe('Schedule Gap Fills', () => {
    it('manages schedule gap fills workflow', async () => {
      const getRes = await request(app)
        .get('/api/communication/gap-fills')
        .set(authHeader);

      expect(getRes.status).toBe(200);
      expect(Array.isArray(getRes.body.data)).toBe(true);

      const token = uniqueToken('gap');
      const savePayload = {
        triggerType: 'Overdue Recall',
        templateId: `tpl-${token}`,
        isActive: true,
        scheduleOffsetDays: 30,
        maxOffers: 5,
      };

      // Create/Save
      const saveRes = await request(app)
        .post('/api/communication/gap-fills')
        .set(authHeader)
        .send(savePayload);

      expect(saveRes.status).toBe(200);
      expect(saveRes.body.data.triggerType).toBe(savePayload.triggerType);
      const gapFillId = saveRes.body.data.id;

      // Delete
      const deleteRes = await request(app)
        .delete(`/api/communication/gap-fills/${gapFillId}`)
        .set(authHeader);

      expect(deleteRes.status).toBe(200);
    });
  });

  describe('Review Settings', () => {
    it('retrieves and updates review automation settings', async () => {
      const getRes = await request(app)
        .get('/api/communication/reviews/settings')
        .set(authHeader);

      expect(getRes.status).toBe(200);
      expect(getRes.body.data.skipDuplicateDays).toBeDefined();

      const token = uniqueToken('rev');
      const updatePayload = {
        isActive: true,
        skipDuplicateDays: 12,
        includeFacebookReview: true,
        googleReviewLink: `https://g.page/r/${token}`,
      };

      const putRes = await request(app)
        .put('/api/communication/reviews/settings')
        .set(authHeader)
        .send(updatePayload);

      expect(putRes.status).toBe(200);
      expect(putRes.body.data.skipDuplicateDays).toBe(updatePayload.skipDuplicateDays);
      expect(putRes.body.data.googleReviewLink).toBe(updatePayload.googleReviewLink);
    });
  });
});
