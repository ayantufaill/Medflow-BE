import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const db = vi.hoisted(() => ({
  patplan: { findUnique: vi.fn() },
  provider: { findUnique: vi.fn(), findFirst: vi.fn() },
  clinic: { findUnique: vi.fn() },
  etransmessagetext: { create: vi.fn() },
  etrans: { create: vi.fn() },
}));
const meta = vi.hoisted(() => ({ get: vi.fn(), set: vi.fn() }));

vi.mock('../src/config/db', () => ({ prisma: db }));
vi.mock('../src/utils/opendental-ids.util', () => ({ getNextId: vi.fn(async () => 900n) }));
vi.mock('../src/utils/opendental-auth.util', () => ({
  getPatientInsuranceMeta: meta.get,
  setPatientInsuranceMeta: meta.set,
}));
vi.mock('../src/services/edi837.service', () => ({ isValidNPI: (npi?: string | null) => /^\d{10}$/.test(npi ?? '') }));

import { eligibilityService } from '../src/services/eligibility.service';
import { buildMockEligibilityResponse } from '../src/services/eligibility-mock';

const subscriber = { PatNum: 10n, FName: 'John', LName: 'Doe', Birthdate: new Date('1980-02-03T00:00:00Z'), PriProv: 1n, ClinicNum: 3n };
const child = { PatNum: 11n, FName: 'Amy', LName: 'Doe', Birthdate: new Date('2015-06-07T00:00:00Z'), PriProv: 1n, ClinicNum: 3n };

const patplanRow = (opts: { patient?: any; relationship?: number; memberId?: string | null } = {}) => ({
  PatPlanNum: 50n,
  PatNum: (opts.patient ?? subscriber).PatNum,
  Relationship: opts.relationship ?? 0,
  InsSubNum: 60n,
  patient: opts.patient ?? subscriber,
  inssub: {
    PlanNum: 70n,
    SubscriberID: opts.memberId === undefined ? 'W123456' : opts.memberId,
    patient: subscriber,
    insplan: { GroupNum: 'GRP1', carrier: { CarrierNum: 80n, CarrierName: 'Delta', ElectID: '07000' } },
  },
});

const fetchMock = vi.fn();
const stediReturns = (memberId = 'W123456', httpStatus = 200) =>
  fetchMock.mockImplementation(async (_url: string, init: any) => {
    const { data } = buildMockEligibilityResponse({ ...JSON.parse(init.body), subscriber: { memberId } });
    return { status: httpStatus, json: async () => data };
  });

const sentRequest = () => JSON.parse(fetchMock.mock.calls[0][1].body);

describe('eligibility service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('fetch', fetchMock);
    vi.stubEnv('STEDI_API_KEY', 'test_key');
    vi.stubEnv('STEDI_MOCK', '');
    db.provider.findUnique.mockResolvedValue({ ProvNum: 1n, FName: 'Sam', LName: 'Smile', NationalProvID: '1999999984', SSN: '12-3456789', IsNotPerson: 0 });
    db.clinic.findUnique.mockResolvedValue({ ClinicNum: 3n, Description: 'Coconut Smiles' });
    meta.get.mockResolvedValue({ autoVerify: true });
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it('sends the subscriber, provider and dental STC to Stedi', async () => {
    db.patplan.findUnique.mockResolvedValue(patplanRow());
    stediReturns();

    await eligibilityService.checkEligibility('10', '50', { dateOfService: '2026-10-23' });

    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe('test_key');
    expect(sentRequest()).toMatchObject({
      tradingPartnerServiceId: '07000',
      provider: { npi: '1999999984', organizationName: 'Coconut Smiles', taxId: '123456789' },
      subscriber: { memberId: 'W123456', firstName: 'John', dateOfBirth: '19800203', groupNumber: 'GRP1' },
      encounter: { serviceTypeCodes: ['35'], dateOfService: '20261023' },
    });
    expect(sentRequest().dependents).toBeUndefined();
  });

  it('sends a dependent patient separately from the subscriber', async () => {
    db.patplan.findUnique.mockResolvedValue(patplanRow({ patient: child, relationship: 2 }));
    stediReturns();

    await eligibilityService.checkEligibility('11', '50');

    expect(sentRequest().subscriber.firstName).toBe('John');
    expect(sentRequest().dependents).toEqual([{ firstName: 'Amy', lastName: 'Doe', dateOfBirth: '20150607' }]);
  });

  it('parses an active response into per-network coinsurance, deductible and max', async () => {
    db.patplan.findUnique.mockResolvedValue(patplanRow());
    stediReturns();

    const result = await eligibilityService.checkEligibility('10', '50');

    expect(result.status).toBe('active');
    const restorativeIn = result.summary.inNetwork.coinsurance.find((c) => c.serviceTypes.includes('Restorative'));
    const restorativeOut = result.summary.outOfNetwork.coinsurance.find((c) => c.serviceTypes.includes('Restorative'));
    expect(restorativeIn).toMatchObject({ patientPercent: 20, insurancePercent: 80 });
    expect(restorativeOut).toMatchObject({ patientPercent: 30, insurancePercent: 70 });
    expect(result.summary.inNetwork.maximums).toContainEqual(expect.objectContaining({ amount: 1180.5, isRemaining: true }));
    expect(result.summary.inNetwork.deductibles).toContainEqual(expect.objectContaining({ coverageLevel: 'Family', amount: 150 }));

    expect(db.etrans.create).toHaveBeenCalledWith({ data: expect.objectContaining({ Etype: 18, AckCode: 'active', PatNum: 10n }) });
    expect(meta.set).toHaveBeenCalledWith(50n, expect.objectContaining({ autoVerify: true, verificationStatus: 'verified' }));
  });

  it.each([
    ['NOTFOUND1', 'error', 'failed'],
    ['INACTIVE1', 'inactive', 'inactive'],
    ['DOWN1', 'error', 'failed'],
  ])('maps payer answer for %s to %s', async (memberId, status, verificationStatus) => {
    db.patplan.findUnique.mockResolvedValue(patplanRow());
    stediReturns(memberId);

    const result = await eligibilityService.checkEligibility('10', '50');

    expect(result.status).toBe(status);
    expect(meta.set).toHaveBeenCalledWith(50n, expect.objectContaining({ verificationStatus }));
  });

  it('rejects before calling Stedi when the member ID is missing', async () => {
    db.patplan.findUnique.mockResolvedValue(patplanRow({ memberId: null }));

    await expect(eligibilityService.checkEligibility('10', '50')).rejects.toThrow(/subscriber member ID/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects an insurance that belongs to another patient', async () => {
    db.patplan.findUnique.mockResolvedValue(patplanRow());

    await expect(eligibilityService.checkEligibility('999', '50')).rejects.toThrow(/not found/);
  });

  it('STEDI_MOCK answers without a key or network call, but never in production', async () => {
    db.patplan.findUnique.mockResolvedValue(patplanRow());
    vi.stubEnv('STEDI_API_KEY', '');
    vi.stubEnv('STEDI_MOCK', 'true');

    const result = await eligibilityService.checkEligibility('10', '50');
    expect(result).toMatchObject({ status: 'active', mock: true });
    expect(fetchMock).not.toHaveBeenCalled();

    vi.stubEnv('NODE_ENV', 'production');
    await expect(eligibilityService.checkEligibility('10', '50')).rejects.toThrow(/production/);
  });
});
