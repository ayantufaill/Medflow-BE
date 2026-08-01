import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import app from '../src/app';
import { prisma } from '../src/config/db';
import { getAdminAuthHeader } from './helpers/auth';
import { uniqueToken } from './helpers/unique';

describe('Patient Communication APIs', () => {
  let authHeader: { Authorization: string };

  beforeAll(async () => {
    authHeader = await getAdminAuthHeader();
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
