import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import app from '../src/app';
import { getAdminAuthHeader } from './helpers/auth';

describe('Clinical Notes', () => {
  let authHeader: { Authorization: string };

  beforeAll(async () => {
    authHeader = await getAdminAuthHeader();
  });

  it('gets all clinical notes', async () => {
    const res = await request(app)
      .get('/api/clinical-notes')
      .set(authHeader);
    expect(res.status).toBe(200);
  });

  it('validates patient clinical notes params', async () => {
    const res = await request(app)
      .get('/api/clinical-notes/patient/1')
      .set(authHeader);
    expect(res.status).toBe(400);
  });

  it('validates patient medical history params', async () => {
    const res = await request(app)
      .get('/api/clinical-notes/patient/1/medical-history')
      .set(authHeader);
    expect(res.status).toBe(400);
  });

  it('validates appointment clinical note params', async () => {
    const res = await request(app)
      .get('/api/clinical-notes/appointment/1')
      .set(authHeader);
    expect(res.status).toBe(400);
  });

  it('validates unsigned notes params', async () => {
    const res = await request(app)
      .get('/api/clinical-notes/unsigned/1')
      .set(authHeader);
    expect(res.status).toBe(400);
  });

  it('validates clinical note id', async () => {
    const res = await request(app)
      .get('/api/clinical-notes/1')
      .set(authHeader);
    expect(res.status).toBe(400);
  });

  it('validates create clinical note payload', async () => {
    const res = await request(app)
      .post('/api/clinical-notes')
      .set(authHeader)
      .send({});
    expect(res.status).toBe(400);
  });

  it('validates create from template payload', async () => {
    const res = await request(app)
      .post('/api/clinical-notes/from-template/1')
      .set(authHeader)
      .send({});
    expect(res.status).toBe(400);
  });

  it('validates update clinical note payload', async () => {
    const res = await request(app)
      .put('/api/clinical-notes/1')
      .set(authHeader)
      .send({});
    expect(res.status).toBe(400);
  });

  it('validates save draft payload', async () => {
    const res = await request(app)
      .put('/api/clinical-notes/1/draft')
      .set(authHeader)
      .send({});
    expect(res.status).toBe(400);
  });

  it('validates sign clinical note params', async () => {
    const res = await request(app)
      .post('/api/clinical-notes/1/sign')
      .set(authHeader);
    expect(res.status).toBe(400);
  });

  it('validates add attachment payload', async () => {
    const res = await request(app)
      .post('/api/clinical-notes/1/attachments')
      .set(authHeader)
      .send({});
    expect(res.status).toBe(400);
  });

  it('validates remove attachment payload', async () => {
    const res = await request(app)
      .delete('/api/clinical-notes/1/attachments')
      .set(authHeader)
      .send({});
    expect(res.status).toBe(400);
  });

  it('validates delete clinical note params', async () => {
    const res = await request(app)
      .delete('/api/clinical-notes/1')
      .set(authHeader);
    expect(res.status).toBe(400);
  });
});
