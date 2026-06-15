import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import app from '../src/app';
import { getAdminAuthHeader } from './helpers/auth';
import { uniqueToken } from './helpers/unique';

describe('Admin Finance Payment Types Custom Metadata Tests', () => {
  let authHeader: { Authorization: string };

  beforeAll(async () => {
    authHeader = await getAdminAuthHeader();
  });

  it('manages serialized JSON metadata inside ItemValue column for Category 4 (Payment Types)', async () => {
    const typeName = `Pay-${uniqueToken('pay')}`;
    
    // 1. Create a Payment Type with custom settings
    const createRes = await request(app)
      .post('/api/admin-finance/definitions/4')
      .set(authHeader)
      .send({
        name: typeName,
        itemOrder: 1,
        depositSlip: true,
        openEdge: false,
        prosperipay: true,
        smilepay: true,
        note: 'Special custom payment handler',
      });

    expect(createRes.status).toBe(201);
    expect(createRes.body?.success).toBe(true);
    const defId = createRes.body?.data?.id;
    expect(defId).toBeDefined();
    expect(createRes.body?.data?.depositSlip).toBe(true);
    expect(createRes.body?.data?.openEdge).toBe(false);
    expect(createRes.body?.data?.prosperipay).toBe(true);
    expect(createRes.body?.data?.smilepay).toBe(true);
    expect(createRes.body?.data?.note).toBe('Special custom payment handler');

    // 2. Fetch the Payment Types and verify it returns parsed properties
    const getRes = await request(app)
      .get('/api/admin-finance/definitions/4')
      .set(authHeader);

    expect(getRes.status).toBe(200);
    const found = getRes.body?.data?.find((d: any) => d.id === defId);
    expect(found).toBeDefined();
    expect(found.type).toBe(typeName);
    expect(found.depositSlip).toBe(true);
    expect(found.openEdge).toBe(false);
    expect(found.prosperipay).toBe(true);
    expect(found.smilepay).toBe(true);
    expect(found.note).toBe('Special custom payment handler');

    // 3. Update the Payment Type custom properties
    const updateRes = await request(app)
      .put(`/api/admin-finance/definitions/item/${defId}`)
      .set(authHeader)
      .send({
        name: `${typeName}-Updated`,
        depositSlip: false,
        openEdge: true,
        prosperipay: false,
        smilepay: false,
        note: 'Updated notes description',
      });

    expect(updateRes.status).toBe(200);
    expect(updateRes.body?.data?.type).toBe(`${typeName}-Updated`);
    expect(updateRes.body?.data?.depositSlip).toBe(false);
    expect(updateRes.body?.data?.openEdge).toBe(true);
    expect(updateRes.body?.data?.prosperipay).toBe(false);
    expect(updateRes.body?.data?.smilepay).toBe(false);
    expect(updateRes.body?.data?.note).toBe('Updated notes description');

    // 4. Fetch again to confirm serialization persistence
    const getRes2 = await request(app)
      .get('/api/admin-finance/definitions/4')
      .set(authHeader);

    const foundUpdated = getRes2.body?.data?.find((d: any) => d.id === defId);
    expect(foundUpdated).toBeDefined();
    expect(foundUpdated.type).toBe(`${typeName}-Updated`);
    expect(foundUpdated.depositSlip).toBe(false);
    expect(foundUpdated.openEdge).toBe(true);
    expect(foundUpdated.prosperipay).toBe(false);
    expect(foundUpdated.smilepay).toBe(false);
    expect(foundUpdated.note).toBe('Updated notes description');

    // 5. Clean up/delete the definition
    const deleteRes = await request(app)
      .delete(`/api/admin-finance/definitions/item/${defId}`)
      .set(authHeader);
    expect(deleteRes.status).toBe(200);
  });
});
