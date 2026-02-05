import { describe, it, expect, beforeAll, vi } from 'vitest';
import request from 'supertest';
import { ocrService } from '../src/services/ocr.service';

describe('OCR', () => {
  let app: typeof import('../src/app').default;
  let authHeader: { Authorization: string };

  beforeAll(async () => {
    const appModule = await import('../src/app');
    app = appModule.default;

    vi.spyOn(ocrService, 'isAvailable').mockReturnValue(true);
    vi.spyOn(ocrService, 'extractTextFromImage').mockResolvedValue('mock text');

    const res = await request(app)
      .post('/api/auth/login')
      .send({
        email: process.env.SEED_ADMIN_EMAIL || 'admin@example.com',
        password: process.env.SEED_ADMIN_PASSWORD || 'Admin123!',
      });

    const token = res.body?.data?.tokens?.accessToken;
    if (!token) {
      throw new Error('Failed to login for OCR test.');
    }

    authHeader = { Authorization: `Bearer ${token}` };
  });

  it('extracts text from image (mocked)', async () => {
    const res = await request(app)
      .post('/api/ocr/extract-text')
      .set(authHeader)
      .attach('image', Buffer.from('test-image'), 'test.png');

    expect(res.status).toBe(200);
    expect(res.body?.data?.text).toBe('mock text');
  });
});
