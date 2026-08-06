import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import app from '../src/app';
import { getAdminAuthHeader } from './helpers/auth';
import { uniqueToken } from './helpers/unique';
import { createDocumentRecord, createPatientRecord } from './helpers/fixtures';

describe('Documents', () => {
  let authHeader: { Authorization: string };

  beforeAll(async () => {
    authHeader = await getAdminAuthHeader();
  });

  it('gets document types', async () => {
    const res = await request(app)
      .get('/api/documents/types')
      .set(authHeader);
    expect(res.status).toBe(200);
  });

  it('gets all documents', async () => {
    const res = await request(app)
      .get('/api/documents')
      .set(authHeader);
    expect(res.status).toBe(200);
  });

  it('creates a document and fetches it by id', async () => {
    const token = uniqueToken('doc');
    const patient = await createPatientRecord(token);
    const document = await createDocumentRecord({
      patientId: patient.PatNum,
      token,
    });
    const patientId = patient.PatNum.toString();
    const docNum = document.DocNum.toString();

    const getRes = await request(app)
      .get(`/api/documents/${docNum}`)
      .set(authHeader);
    expect(getRes.status).toBe(200);
    // getDocumentById always includes the patient relation, so patientId comes back
    // enriched as { _id, firstName, lastName } rather than a bare PatNum string.
    expect(getRes.body?.data?.document?.patientId?._id).toBe(String(patientId));
    expect(getRes.body?.data?.document?.documentName).toBe(`Test Document ${token}`);

    const listRes = await request(app)
      .get(`/api/documents/patient/${patientId}`)
      .set(authHeader);
    expect(listRes.status).toBe(200);
    const docs = listRes.body?.data?.documents ?? [];
    expect(docs.some((doc: any) => doc._id === String(docNum))).toBe(true);
  });

  it('validates patient documents params', async () => {
    const res = await request(app)
      .get('/api/documents/patient/1')
      .set(authHeader);
    expect(res.status).toBe(200);
  });

  it('validates appointment documents params', async () => {
    const res = await request(app)
      .get('/api/documents/appointment/1')
      .set(authHeader);
    expect(res.status).toBe(200);
  });

  it('validates document id', async () => {
    const res = await request(app)
      .get('/api/documents/1')
      .set(authHeader);
    expect(res.status).toBe(404);
  });

  it('validates create document payload', async () => {
    const res = await request(app)
      .post('/api/documents')
      .set(authHeader)
      .send({});
    expect(res.status).toBe(400);
  });

  it('validates update document payload', async () => {
    const res = await request(app)
      .put('/api/documents/1')
      .set(authHeader)
      .send({});
    expect(res.status).toBe(404);
  });

  it('validates attach-to-note payload', async () => {
    const res = await request(app)
      .post('/api/documents/1/attach-to-note')
      .set(authHeader)
      .send({});
    expect(res.status).toBe(400);
  });

  it('validates delete document params', async () => {
    const res = await request(app)
      .delete('/api/documents/1')
      .set(authHeader);
    expect(res.status).toBe(404);
  });
});
