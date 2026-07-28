import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import app from '../src/app';
import { getAdminAuthHeader } from './helpers/auth';
import { uniqueToken } from './helpers/unique';

describe('Clinical Management APIs', () => {
  let authHeader: { Authorization: string };

  beforeAll(async () => {
    authHeader = await getAdminAuthHeader();
  });

  describe('Products', () => {
    it('creates and fetches products categories and choices', async () => {
      const categoryName = `Category-${uniqueToken('product')}`;
      
      const createCatRes = await request(app)
        .post('/api/clinical-management/products')
        .set(authHeader)
        .send({ name: categoryName, section: 'top' });
      expect(createCatRes.status).toBe(201);
      const catId = createCatRes.body?.data?.id;
      expect(catId).toBeDefined();

      const choiceName = `Choice-${uniqueToken('product')}`;
      const createChoiceRes = await request(app)
        .post(`/api/clinical-management/products/${catId}/choices`)
        .set(authHeader)
        .send({
          name: choiceName,
          isDefault: true,
          quickList: true,
          isRecommended: true,
          price: 99.99,
          code: 'PROD_TEST',
        });
      expect(createChoiceRes.status).toBe(201);
      const choiceId = createChoiceRes.body?.data?.id;
      expect(choiceId).toBeDefined();

      const getRes = await request(app)
        .get('/api/clinical-management/products')
        .set(authHeader);
      expect(getRes.status).toBe(200);
      const category = getRes.body?.data?.find((c: any) => c.id === catId);
      expect(category).toBeDefined();
      expect(category.name).toBe(categoryName);
      expect(category.choices[0].name).toBe(choiceName);

      const updateChoiceRes = await request(app)
        .put(`/api/clinical-management/products/choices/${choiceId}`)
        .set(authHeader)
        .send({ name: `Updated-${choiceName}` });
      expect(updateChoiceRes.status).toBe(200);
      expect(updateChoiceRes.body?.data?.name).toBe(`Updated-${choiceName}`);

      const delChoiceRes = await request(app)
        .delete(`/api/clinical-management/products/choices/${choiceId}`)
        .set(authHeader);
      expect(delChoiceRes.status).toBe(200);

      const delCatRes = await request(app)
        .delete(`/api/clinical-management/products/${catId}`)
        .set(authHeader);
      expect(delCatRes.status).toBe(200);
    });
  });

  describe('Checklists', () => {
    it('creates, updates and deletes checklist categories, checklists, and items', async () => {
      const catName = `ChecklistCat-${uniqueToken('checklist')}`;
      
      const createCatRes = await request(app)
        .post('/api/clinical-management/checklists/categories')
        .set(authHeader)
        .send({ name: catName });
      expect(createCatRes.status).toBe(201);
      
      const checklistName = `Checklist-${uniqueToken('checklist')}`;
      const createChecklistRes = await request(app)
        .post('/api/clinical-management/checklists')
        .set(authHeader)
        .send({
          categoryName: catName,
          name: checklistName,
          shortName: 'ShortName',
          isTreatment: true,
          isHygiene: false,
          iconId: 'mask',
        });
      expect(createChecklistRes.status).toBe(201);
      const checklistId = createChecklistRes.body?.data?.id;
      expect(checklistId).toBeDefined();

      const createItemRes = await request(app)
        .post(`/api/clinical-management/checklists/${checklistId}/items`)
        .set(authHeader)
        .send({ text: 'Do step A' });
      expect(createItemRes.status).toBe(201);
      const itemId = createItemRes.body?.data?.id;
      expect(itemId).toBeDefined();

      const getChecklistsRes = await request(app)
        .get('/api/clinical-management/checklists')
        .set(authHeader);
      expect(getChecklistsRes.status).toBe(200);
      expect(getChecklistsRes.body?.data?.[catName]).toBeDefined();

      const updateChecklistRes = await request(app)
        .put(`/api/clinical-management/checklists/${checklistId}`)
        .set(authHeader)
        .send({ shortName: 'NewShort' });
      expect(updateChecklistRes.status).toBe(200);
      expect(updateChecklistRes.body?.data?.shortName).toBe('NewShort');

      const delItemRes = await request(app)
        .delete(`/api/clinical-management/checklists/items/${itemId}`)
        .set(authHeader);
      expect(delItemRes.status).toBe(200);

      const delChecklistRes = await request(app)
        .delete(`/api/clinical-management/checklists/${checklistId}`)
        .set(authHeader);
      expect(delChecklistRes.status).toBe(200);

      const delCategoryRes = await request(app)
        .delete(`/api/clinical-management/checklists/categories/${encodeURIComponent(catName)}`)
        .set(authHeader);
      expect(delCategoryRes.status).toBe(200);
      expect(delCategoryRes.body?.data?.success).toBe(true);
    });
  });

  describe('Configs & Settings', () => {
    it('saves and fetches clinical settings, recare config, and tp config', async () => {
      const setSettingRes = await request(app)
        .put('/api/clinical-management/settings')
        .set(authHeader)
        .send({ key: 'test_setting_key', value: 'hello' });
      expect(setSettingRes.status).toBe(200);

      const getSettingRes = await request(app)
        .get('/api/clinical-management/settings')
        .set(authHeader);
      expect(getSettingRes.status).toBe(200);
      expect(getSettingRes.body?.data?.test_setting_key).toBe('hello');

      const setRecareRes = await request(app)
        .put('/api/clinical-management/recare-config')
        .set(authHeader)
        .send({ intervalMonths: 9, autoReminder: false });
      expect(setRecareRes.status).toBe(200);

      const getRecareRes = await request(app)
        .get('/api/clinical-management/recare-config')
        .set(authHeader);
      expect(getRecareRes.status).toBe(200);
      expect(getRecareRes.body?.data?.intervalMonths).toBe(9);

      const setTpRes = await request(app)
        .put('/api/clinical-management/treatment-plan-presentations')
        .set(authHeader)
        .send({ showHeader: false, themeColor: '#ff0000' });
      expect(setTpRes.status).toBe(200);

      const getTpRes = await request(app)
        .get('/api/clinical-management/treatment-plan-presentations')
        .set(authHeader);
      expect(getTpRes.status).toBe(200);
      expect(getTpRes.body?.data?.showHeader).toBe(false);
      expect(getTpRes.body?.data?.themeColor).toBe('#ff0000');
    });
  });

  describe('Informed Consents & Pre/Post Ops', () => {
    it('manages consent templates', async () => {
      const consentName = `Consent-${uniqueToken('consent')}`;
      
      const createRes = await request(app)
        .post('/api/clinical-management/consent-templates')
        .set(authHeader)
        .send({ name: consentName, content: 'This is the consent form content.' });
      expect(createRes.status).toBe(201);
      const consentId = createRes.body?.data?.id;

      const getRes = await request(app)
        .get('/api/clinical-management/consent-templates')
        .set(authHeader);
      expect(getRes.status).toBe(200);
      expect(getRes.body?.data?.find((c: any) => c.id === consentId)).toBeDefined();

      const updateRes = await request(app)
        .put(`/api/clinical-management/consent-templates/${consentId}`)
        .set(authHeader)
        .send({ content: 'Updated content.' });
      expect(updateRes.status).toBe(200);

      const delRes = await request(app)
        .delete(`/api/clinical-management/consent-templates/${consentId}`)
        .set(authHeader);
      expect(delRes.status).toBe(200);
    });

    it('manages pre-post ops instruction templates', async () => {
      const opName = `PreOp-${uniqueToken('preop')}`;
      
      const createRes = await request(app)
        .post('/api/clinical-management/instruction-templates')
        .set(authHeader)
        .send({ name: opName, type: 'pre', content: 'Fast for 12 hours.' });
      expect(createRes.status).toBe(201);
      const opId = createRes.body?.data?.id;

      const getRes = await request(app)
        .get('/api/clinical-management/instruction-templates')
        .set(authHeader);
      expect(getRes.status).toBe(200);
      expect(getRes.body?.data?.find((c: any) => c.id === opId)).toBeDefined();

      const delRes = await request(app)
        .delete(`/api/clinical-management/instruction-templates/${opId}`)
        .set(authHeader);
      expect(delRes.status).toBe(200);
    });
  });
});
