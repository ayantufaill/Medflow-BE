import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import app from '../src/app';
import { getAdminAuthHeader } from './helpers/auth';
import { uniqueToken } from './helpers/unique';
import { createRoomRecord } from './helpers/fixtures';

describe('Rooms', () => {
  let authHeader: { Authorization: string };

  beforeAll(async () => {
    authHeader = await getAdminAuthHeader();
  });

  it('gets all rooms', async () => {
    const res = await request(app)
      .get('/api/rooms')
      .set(authHeader);
    expect(res.status).toBe(200);
  });

  it('creates a room and finds it in the list', async () => {
    const token = uniqueToken('room');
    const created = await createRoomRecord(token);
    const name = created.OpName;

    const listRes = await request(app)
      .get('/api/rooms?limit=100')
      .set(authHeader);
    expect(listRes.status).toBe(200);
    const items = listRes.body?.data?.rooms ?? [];
    expect(items.some((item: any) => item.name === name)).toBe(true);
  });

  it('validates room id', async () => {
    const res = await request(app)
      .get('/api/rooms/1')
      .set(authHeader);
    expect(res.status).toBe(400);
  });

  it('validates create room payload', async () => {
    const res = await request(app)
      .post('/api/rooms')
      .set(authHeader)
      .send({});
    expect(res.status).toBe(400);
  });

  it('validates update room payload', async () => {
    const res = await request(app)
      .put('/api/rooms/1')
      .set(authHeader)
      .send({});
    expect(res.status).toBe(400);
  });

  it('validates delete room params', async () => {
    const res = await request(app)
      .delete('/api/rooms/1')
      .set(authHeader);
    expect(res.status).toBe(400);
  });
});
