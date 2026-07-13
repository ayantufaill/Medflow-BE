import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import app from '../src/app';
import { getAdminAuthHeader } from './helpers/auth';
import { uniqueToken } from './helpers/unique';
import { createNoteTemplateRecord } from './helpers/fixtures';

describe('Note Templates', () => {
  let authHeader: { Authorization: string };

  beforeAll(async () => {
    authHeader = await getAdminAuthHeader();
  });

  it('gets all note templates', async () => {
    const res = await request(app)
      .get('/api/note-templates')
      .set(authHeader);
    expect(res.status).toBe(200);
  });

  it('creates a note template and finds it via search', async () => {
    const token = uniqueToken('template');
    const created = await createNoteTemplateRecord(token);
    const name = created.AutoNoteName;

    const listRes = await request(app)
      .get(`/api/note-templates?search=${encodeURIComponent(name)}`)
      .set(authHeader);
    expect(listRes.status).toBe(200);
    const items = listRes.body?.data?.noteTemplates ?? [];
    expect(items.some((item: any) => item.name === name)).toBe(true);
  });

  it('gets active note templates', async () => {
    const res = await request(app)
      .get('/api/note-templates/active')
      .set(authHeader);
    expect(res.status).toBe(200);
  });

  it('gets templates by specialty (empty ok)', async () => {
    const res = await request(app)
      .get('/api/note-templates/specialty/general')
      .set(authHeader);
    expect(res.status).toBe(200);
  });

  it('validates note template id', async () => {
    const res = await request(app)
      .get('/api/note-templates/invalid-id')
      .set(authHeader);
    expect(res.status).toBe(400);
  });

  it('validates create note template payload', async () => {
    const res = await request(app)
      .post('/api/note-templates')
      .set(authHeader)
      .send({});
    expect(res.status).toBe(400);
  });

  it('validates duplicate note template payload', async () => {
    const res = await request(app)
      .post('/api/note-templates/invalid-id/duplicate')
      .set(authHeader)
      .send({});
    expect(res.status).toBe(400);
  });

  it('validates update note template payload', async () => {
    const res = await request(app)
      .put('/api/note-templates/invalid-id')
      .set(authHeader)
      .send({});
    expect(res.status).toBe(400);
  });

  it('validates toggle status params', async () => {
    const res = await request(app)
      .patch('/api/note-templates/invalid-id/status')
      .set(authHeader);
    expect(res.status).toBe(400);
  });

  it('validates delete note template params', async () => {
    const res = await request(app)
      .delete('/api/note-templates/invalid-id')
      .set(authHeader);
    expect(res.status).toBe(400);
  });
});
