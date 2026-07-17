import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import app from '../src/app';
import { getAdminAuthHeader } from './helpers/auth';

describe('Route Registration & Middleware', () => {
  let authHeader: { Authorization: string };

  beforeAll(async () => {
    authHeader = await getAdminAuthHeader();
  });

  // -------------------------------------------------------------------------
  // 1. Health check routes
  // -------------------------------------------------------------------------

  describe('Health check routes', () => {
    it('GET / returns welcome message', async () => {
      const res = await request(app).get('/');
      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Welcome to MedFlow API');
      expect(res.body.status).toBe('success');
    });

    it('GET /health returns health status', async () => {
      const res = await request(app).get('/health');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('healthy');
    });
  });

  // -------------------------------------------------------------------------
  // 2. CORS middleware
  // -------------------------------------------------------------------------

  describe('CORS middleware', () => {
    it('responds to OPTIONS preflight with 200', async () => {
      const res = await request(app)
        .options('/api/rx')
        .set('Origin', 'http://localhost:3000')
        .set('Access-Control-Request-Method', 'GET');

      expect(res.status).toBe(200);
    });

    it('includes Access-Control-Allow-Origin header', async () => {
      const res = await request(app)
        .get('/health')
        .set('Origin', 'http://localhost:3000');

      expect(res.headers['access-control-allow-origin']).toBe('*');
    });

    it('allows Authorization header in CORS', async () => {
      const res = await request(app)
        .options('/api/rx')
        .set('Origin', 'http://localhost:3000')
        .set('Access-Control-Request-Method', 'GET')
        .set('Access-Control-Request-Headers', 'Authorization');

      expect(res.headers['access-control-allow-headers']).toMatch(/authorization/i);
    });

    it('allows Content-Type header in CORS', async () => {
      const res = await request(app)
        .options('/api/rx')
        .set('Origin', 'http://localhost:3000')
        .set('Access-Control-Request-Method', 'POST')
        .set('Access-Control-Request-Headers', 'Content-Type');

      expect(res.headers['access-control-allow-headers']).toMatch(/content-type/i);
    });
  });

  // -------------------------------------------------------------------------
  // 3. JWT authentication middleware
  // -------------------------------------------------------------------------

  describe('JWT authentication middleware', () => {
    it('returns 401 when no Authorization header is provided', async () => {
      const res = await request(app).get('/api/rx');
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.message).toMatch(/no token provided/i);
    });

    it('returns 401 when Authorization header is not Bearer', async () => {
      const res = await request(app)
        .get('/api/rx')
        .set('Authorization', 'Basic sometoken');

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('returns 401 when token is invalid', async () => {
      const res = await request(app)
        .get('/api/rx')
        .set('Authorization', 'Bearer invalid.token.here');

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('passes authentication with a valid admin token', async () => {
      const res = await request(app)
        .get('/api/rx')
        .set(authHeader);

      // Route exists and auth passed — not a 401
      expect(res.status).not.toBe(401);
    });
  });

  // -------------------------------------------------------------------------
  // 4. Error handling middleware
  // -------------------------------------------------------------------------

  describe('Error handling middleware', () => {
    it('returns 404 with structured error for unknown routes', async () => {
      const res = await request(app)
        .get('/api/this-route-does-not-exist-xyz');

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.error.message).toMatch(/not found/i);
    });

    it('includes the requested URL in the 404 message', async () => {
      const res = await request(app)
        .get('/api/unknown-endpoint-xyz');

      expect(res.status).toBe(404);
      expect(res.body.error.message).toContain('/api/unknown-endpoint-xyz');
    });
  });

  // -------------------------------------------------------------------------
  // 5. RX routes registered
  // -------------------------------------------------------------------------

  describe('RX (Prescription) routes registered', () => {
    it('GET /api/rx is registered and reachable', async () => {
      const res = await request(app)
        .get('/api/rx')
        .set(authHeader);

      expect(res.status).not.toBe(404);
      expect(res.status).toBe(200);
    });

    it('POST /api/rx is registered — validates empty payload', async () => {
      const res = await request(app)
        .post('/api/rx')
        .set(authHeader)
        .send({});

      // Route exists — validator rejects empty body with 400
      expect(res.status).not.toBe(404);
      expect(res.status).toBe(400);
    });

    it('GET /api/rx/:id/print is registered — returns 400 or 404 for invalid id', async () => {
      const res = await request(app)
        .get('/api/rx/invalid-id/print')
        .set(authHeader);

      // Route is registered — not a 404 from notFoundHandler
      expect(res.status).not.toBe(404);
    });
  });

  // -------------------------------------------------------------------------
  // 6. Lab Case routes registered
  // -------------------------------------------------------------------------

  describe('Lab Case routes registered', () => {
    it('GET /api/lab-cases is registered and reachable', async () => {
      const res = await request(app)
        .get('/api/lab-cases')
        .set(authHeader);

      expect(res.status).not.toBe(404);
      expect(res.status).toBe(200);
    });

    it('POST /api/lab-cases is registered — validates empty payload', async () => {
      const res = await request(app)
        .post('/api/lab-cases')
        .set(authHeader)
        .send({});

      expect(res.status).not.toBe(404);
      expect(res.status).toBe(400);
    });

    // ✅ FIX: use "invalid-id" so the validator fails and returns 400
    it('PATCH /api/lab-cases/:id is registered — validates invalid id', async () => {
      const res = await request(app)
        .patch('/api/lab-cases/invalid-id')
        .set(authHeader)
        .send({});

      expect(res.status).not.toBe(404);
      expect(res.status).toBe(400);
    });

    it('PATCH /api/lab-cases/:id/status is registered — validates invalid id', async () => {
      const res = await request(app)
        .patch('/api/lab-cases/invalid-id/status')
        .set(authHeader)
        .send({ status: 'completed' });

      expect(res.status).not.toBe(404);
      expect(res.status).toBe(400);
    });

    it('DELETE /api/lab-cases/:id is registered — validates invalid id', async () => {
      const res = await request(app)
        .delete('/api/lab-cases/invalid-id')
        .set(authHeader);

      expect(res.status).not.toBe(404);
      expect(res.status).toBe(400);
    });

    it('GET /api/lab-cases/laboratories is registered and reachable', async () => {
      const res = await request(app)
        .get('/api/lab-cases/laboratories')
        .set(authHeader);

      expect(res.status).not.toBe(404);
      expect(res.status).toBe(200);
    });

    it('POST /api/lab-cases/laboratories is registered — validates empty payload', async () => {
      const res = await request(app)
        .post('/api/lab-cases/laboratories')
        .set(authHeader)
        .send({});

      expect(res.status).not.toBe(404);
    });
  });

  // -------------------------------------------------------------------------
  // 7. Sprint 2 routes all registered in index.ts
  // -------------------------------------------------------------------------

  describe('Sprint 2 routes all registered', () => {
    const sprint2Routes = [
      { method: 'get', path: '/api/waitlist' },
      { method: 'get', path: '/api/rx' },
      { method: 'get', path: '/api/lab-cases' },
      { method: 'get', path: '/api/clinical-exams' },
      { method: 'get', path: '/api/treatment-plans' },
      { method: 'get', path: '/api/progress-notes' },
      { method: 'get', path: '/api/patient-referrals' },
      { method: 'get', path: '/api/medications' },
      { method: 'get', path: '/api/schedule-blocks' },
      { method: 'get', path: '/api/clinical-management' },
      { method: 'get', path: '/api/procedure-codes' },
    ];

    sprint2Routes.forEach(({ method, path }) => {
      it(`${method.toUpperCase()} ${path} does not return 404`, async () => {
        const res = await (request(app) as any)
          [method](path)
          .set(authHeader);

        expect(res.status).not.toBe(404);
      });
    });
  });
});