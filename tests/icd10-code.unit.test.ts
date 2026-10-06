import { describe, expect, it, vi, beforeEach } from 'vitest';
import fs from 'node:fs';
import express from 'express';
import request from 'supertest';
import { normalizeIcd10Code, validateIcd10Assignments } from '../src/utils/icd10.util';

const mocks = vi.hoisted(() => ({ findMany: vi.fn(), count: vi.fn() }));
vi.mock('../src/config/db', () => ({ prisma: { icd10: mocks } }));
import { icd10CodeService } from '../src/services/icd10-code.service';
vi.mock('../src/middleware/auth.middleware', () => ({ authenticate: (req: any, res: any, next: any) => req.headers.authorization ? next() : res.status(401).json({ message: 'Unauthorized' }) }));
vi.mock('../src/middleware/branchAccess.middleware', () => ({ resolveBranchAccess: (_req: any, _res: any, next: any) => next() }));
vi.mock('../src/middleware/tenantContext.middleware', () => ({ enterTenantContext: (_req: any, _res: any, next: any) => next() }));
import icdRoutes from '../src/routes/icd10-code.routes';
const app = express();
app.use('/icd10-codes', icdRoutes);
app.use((error: any, _req: any, res: any, _next: any) => res.status(error.statusCode || 500).json({ message: error.message }));

beforeEach(() => vi.clearAllMocks());
describe('ICD catalogue and diagnosis assignments', () => {
  it('normalizes codes and explicit clears without accepting malformed values', () => {
    expect(normalizeIcd10Code(' k029 ')).toBe('K02.9');
    expect(normalizeIcd10Code('S025XXA')).toBe('S02.5XXA');
    expect(normalizeIcd10Code('A09')).toBe('A09');
    for (const value of [null, '', ' ', '-']) expect(normalizeIcd10Code(value)).toBeNull();
    for (const value of ['K02..9', 'not a code', 12, ['K02.9']]) expect(() => normalizeIcd10Code(value)).toThrow();
  });
  it('retains all PDF records with complete descriptions and unique valid codes', () => {
    const data = JSON.parse(fs.readFileSync(new URL('../src/data/icd10-pdf-data.json', import.meta.url), 'utf8'));
    expect(data.source.effectiveDate).toBe('2016-10-01');
    expect(data.source.pages).toBe(2966);
    expect(data.entries).toHaveLength(71486);
    const codes = new Set();
    for (const entry of data.entries) {
      expect(normalizeIcd10Code(entry.code)).toBe(entry.code);
      expect(entry.description.length).toBeGreaterThan(0);
      expect(entry.description.length).toBeLessThanOrEqual(255);
      codes.add(entry.code);
    }
    expect(codes.size).toBe(data.entries.length);
    expect(data.entries.find((entry: any) => entry.code === 'K02.9').description).toBe('Dental caries, unspecified');
    expect(data.entries.some((entry: any) => entry.code === 'A00.0')).toBe(true);
    expect(data.entries.some((entry: any) => entry.code.startsWith('Z'))).toBe(true);
  });
  it('validates changed codes against both stored code formats', async () => {
    mocks.findMany.mockResolvedValue([{ Icd10Code: 'K029' }]);
    const result = await validateIcd10Assignments([{ id: '1', icd: 'k029' }], [], { icd10: mocks });
    expect(result[0].icd).toBe('K02.9');
    expect(mocks.findMany.mock.calls[0][0].where.Icd10Code.in).toContain('K029');
  });
  it('rejects a well-formed code missing from the catalogue', async () => {
    mocks.findMany.mockResolvedValue([]);
    await expect(validateIcd10Assignments([{ icd: 'K02.9' }], [], { icd10: mocks })).rejects.toThrow('not in the catalogue');
  });
  it('preserves legacy diagnoses only on the same row and supports explicit clearing', async () => {
    const previous = [{ id: '1', icd: 'D2392' }, { id: '2', icd: 'K02.9' }];
    const result = await validateIcd10Assignments([{ id: '1', icd: 'D2392' }, { id: '2', icd: null }], previous, { icd10: mocks });
    expect(result.map(row => row.icd)).toEqual(['D2392', null]);
    expect(mocks.findMany).not.toHaveBeenCalled();
    mocks.findMany.mockResolvedValue([]);
    await expect(validateIcd10Assignments([{ id: '3', icd: 'D2392' }], previous, { icd10: mocks })).rejects.toThrow();
  });
  it('preserves diagnoses when an update omits the field and does not mutate input', async () => {
    const input = [{ id: '1', description: 'changed' }];
    const result = await validateIcd10Assignments(input, [{ id: '1', icd: 'K02.9' }], { icd10: mocks });
    expect(result[0].icd).toBe('K02.9');
    expect(Object.hasOwn(input[0], 'icd')).toBe(false);
  });
  it('validates diagnoses in visit-shaped payloads', async () => {
    mocks.findMany.mockResolvedValue([{ Icd10Code: 'K02.9' }]);
    const result = await validateIcd10Assignments([{ procedures: [{ icd: 'K029' }] }], [], { icd10: mocks });
    expect(result[0].procedures?.[0].icd).toBe('K02.9');
  });
  it('searches dotted and undotted codes and descriptions with pagination and string IDs', async () => {
    mocks.findMany.mockResolvedValue([{ Icd10Num: 3n, Icd10Code: 'K029', Description: 'Dental caries, unspecified' }]);
    mocks.count.mockResolvedValue(1);
    const result = await icd10CodeService.list({ search: 'K029', page: 2, limit: 10 });
    const query = mocks.findMany.mock.calls[0][0];
    expect(query.skip).toBe(10);
    expect(query.where.OR[1].Icd10Code.contains).toBe('K02.9');
    expect(result.data[0]).toEqual({ id: '3', code: 'K02.9', description: 'Dental caries, unspecified' });
    expect(JSON.stringify(result)).toContain('K02.9');
  });
  it('retrieves a saved code outside the first search page', async () => {
    mocks.findMany.mockResolvedValue([]); mocks.count.mockResolvedValue(0);
    await icd10CodeService.list({ code: 'Z462' });
    expect(mocks.findMany.mock.calls[0][0].where.Icd10Code.in).toEqual(['Z46.2', 'Z462']);
  });
});

describe('ICD HTTP route with isolated authentication and database doubles', () => {
  it('runs authentication before exposing catalogue data', async () => {
    expect((await request(app).get('/icd10-codes')).status).toBe(401);
    expect(mocks.findMany).not.toHaveBeenCalled();
  });
  it('bounds pagination and validates query input before database access', async () => {
    for (const query of ['limit=101', 'limit=0', 'page=-1', 'search=' + 'a'.repeat(256)]) {
      expect((await request(app).get('/icd10-codes?' + query).set('Authorization', 'unit-fixture')).status).toBe(400);
    }
    expect(mocks.findMany).not.toHaveBeenCalled();
  });
  it('returns a paginated JSON response with string IDs', async () => {
    mocks.findMany.mockResolvedValue([{ Icd10Num: 1n, Icd10Code: 'K02.9', Description: 'Dental caries, unspecified' }]);
    mocks.count.mockResolvedValue(1);
    const response = await request(app).get('/icd10-codes?search=caries').set('Authorization', 'unit-fixture');
    expect(response.status).toBe(200);
    expect(response.body.data[0].id).toBe('1');
    expect(response.body.total).toBe(1);
  });
});
