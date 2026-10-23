import { describe, expect, it, vi } from 'vitest';
const db = vi.hoisted(() => ({
  statement: { findUnique: vi.fn() }, claim: { findFirst: vi.fn(), create: vi.fn() },
  procedurelog: { findMany: vi.fn() }, patplan: { findFirst: vi.fn() },
  // createClaimFromInvoice falls back to the patient's PriProv when provider
  // resolution throws, and picks a default provider when it still has none —
  // so both models have to exist on the mock or the fallback path dies with
  // "Cannot read properties of undefined" instead of reaching claim.create.
  patient: { findUnique: vi.fn() }, provider: { findFirst: vi.fn() },
  claimproc: { create: vi.fn() },
}));
vi.mock('../src/config/db', () => ({ prisma: db }));
vi.mock('../src/utils/opendental-ids.util', () => ({ getNextId: vi.fn().mockResolvedValue(200n) }));
vi.mock('../src/utils/s3.util', () => ({ uploadToS3: vi.fn(), deleteFromS3: vi.fn() }));
vi.mock('../src/utils/activity-logger.util', () => ({ logActivity: vi.fn() }));
vi.mock('../src/services/aging.service', () => ({ agingService: {} }));
vi.mock('../src/services/provider-resolution.service', () => ({ providerResolutionService: { resolveClaimProviders: vi.fn().mockResolvedValue({ treatingProvNum: 1n, billingProvNum: 1n }) } }));
vi.mock('../src/services/invoice.service', () => ({ isPatientPenaltyOrNonIns: () => false }));
import { ClaimService } from '../src/services/claim.service';

describe('invoice-created claim branch persistence', () => {
  it.each([
    { clinics: [1n, 1n], expected: 1n },
    { clinics: [1n, 2n], expected: null },
    { clinics: [1n, null], expected: null },
  ])('passes $expected as ClinicNum for source clinics $clinics', async ({ clinics, expected }) => {
    const service = new ClaimService();
    vi.spyOn(service as any, 'assertInvoiceNotLocked').mockResolvedValue(undefined);
    vi.spyOn(service as any, 'generateClaimNumber').mockResolvedValue('CLM_TEST');
    db.statement.findUnique.mockResolvedValue({ StatementNum: 10n, PatNum: 20n, NoteBold: '{}', BalTotal: 200 });
    db.claim.findFirst.mockResolvedValue(null);
    db.patplan.findFirst.mockResolvedValue(null);
    db.patient.findUnique.mockResolvedValue({ PatNum: 20n, PriProv: 1n });
    db.provider.findFirst.mockResolvedValue({ ProvNum: 1n });
    db.procedurelog.findMany.mockResolvedValue([
      ...clinics.map((ClinicNum, i) => ({ ProcNum: BigInt(i + 1), ClinicNum, ProcFee: 100, BillingNote: '{"insPortion":50,"ptPortion":50}' })),
      // Non-insurable invoice items must not change insurance-claim ownership.
      { ProcNum: 99n, ClinicNum: 99n, NoBillIns: 1 },
    ]);
    const stop = new Error('Stop at mocked persistence boundary');
    db.claim.create.mockReset().mockRejectedValue(stop);
    await expect(service.createClaimFromInvoice('10', {})).rejects.toBe(stop);
    expect(db.claim.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ ClinicNum: expected, PatNum: 20n }) }));
  });
});
