/**
 * Eligibility verification — the provider seam.
 *
 * Today there is exactly one way a practice learns what a payer believes:
 * somebody phones them, or logs into their portal, and types in the answer.
 * Tomorrow there is a clearinghouse sending a 270 and parsing the 271 back.
 *
 * The point of this interface is that `cob.service.ts` cannot tell which one
 * it is talking to. It hands over a patient, a coverage and a date, and gets
 * back the same `EligibilityResult` either way — so adding the 270/271
 * provider later is a registration change, not a rewrite of every caller.
 *
 * WHAT THE SHAPE IS FOR
 * ---------------------
 * `EligibilityResult.otherCoverage` is the part that matters for COB. It is
 * the payer telling us about coverage they know of that we may not, and the
 * position they assign to themselves. A 271 carries this in its own
 * segments; a biller on the phone is asked the same two questions. Modelling
 * the phone call and the EDI response identically is deliberate: both are
 * "what the insurer says", and both get the same scepticism.
 */

import type { EligibilitySource } from './types';

export interface EligibilityRequest {
  patientId: string;
  /** patplan number of the coverage being checked. */
  coverageId: string;
  /** ISO YYYY-MM-DD — the date coverage is being checked for. */
  dateOfService: string;
  /** Who is asking; recorded on the resulting payer-reported row. */
  requestedBy?: string;
}

export interface ReportedOtherCoverage {
  /** The payer's name for the other coverage, as they gave it. */
  payerName: string | null;
  /** Our carrier, when we could match the name. */
  carrierId?: string | null;
  /** Position the payer assigns to that other coverage, if they said. */
  reportedOrder?: number | null;
  memberId?: string | null;
}

export interface EligibilityResult {
  /** Is the coverage we asked about active on that date, per the payer? */
  active: boolean | null;
  /** The position THIS payer claims for itself. 1 = "we are primary". */
  reportedSelfOrder: number | null;
  /** Other coverage this payer says the patient has. */
  otherCoverage: ReportedOtherCoverage[];
  /** ISO YYYY-MM-DD — when the payer said it, not when we recorded it. */
  reportedDate: string;
  source: EligibilitySource;
  /** Verbatim payload: 271 segments, or the biller's call notes. */
  raw?: Record<string, unknown> | null;
  note?: string | null;
}

export interface EligibilityProvider {
  /** Stable identifier, stored on the audit trail. */
  readonly name: string;
  /**
   * True when this provider can answer without a human. The manual provider
   * returns false, which is how the API knows to require staff input rather
   * than offering a "check now" button that cannot work.
   */
  readonly isAutomated: boolean;
  check(request: EligibilityRequest): Promise<EligibilityResult>;
}

/**
 * What staff learned from the payer, entered by hand.
 *
 * `check()` on this provider cannot do anything on its own — there is no
 * automated channel — so it throws rather than returning a fabricated
 * "active: true". A silent optimistic default here would be indistinguishable
 * from a real verification downstream, and would let an unverified order
 * claim VERIFIED_WITH_PAYER.
 */
export class ManualEligibilityProvider implements EligibilityProvider {
  readonly name = 'MANUAL';
  readonly isAutomated = false;

  async check(_request: EligibilityRequest): Promise<EligibilityResult> {
    throw new Error(
      'MANUAL eligibility cannot be queried automatically. Record what the payer ' +
        'said with POST /cob/payer-reported-coverage instead.'
    );
  }

  /**
   * Normalizes a staff entry into the same result shape the future 270/271
   * provider will return. The API calls this so the manual path and the EDI
   * path converge before anything is persisted.
   */
  fromStaffEntry(entry: {
    active?: boolean | null;
    reportedSelfOrder?: number | null;
    otherCoverage?: ReportedOtherCoverage[];
    reportedDate: string;
    source: EligibilitySource;
    note?: string | null;
    raw?: Record<string, unknown> | null;
  }): EligibilityResult {
    return {
      active: entry.active ?? null,
      reportedSelfOrder: entry.reportedSelfOrder ?? null,
      otherCoverage: entry.otherCoverage || [],
      reportedDate: entry.reportedDate,
      source: entry.source,
      raw: entry.raw ?? null,
      note: entry.note ?? null,
    };
  }
}

/**
 * Provider registry.
 *
 * Deliberately a registry and not a direct import: the clearinghouse provider
 * will arrive with credentials, timeouts and a per-practice enable flag, and
 * the call site that picks a provider should be one place.
 */
const providers = new Map<string, EligibilityProvider>();

export const registerEligibilityProvider = (provider: EligibilityProvider): void => {
  providers.set(provider.name, provider);
};

export const getEligibilityProvider = (name?: string): EligibilityProvider => {
  const key = name || process.env.ELIGIBILITY_PROVIDER || 'MANUAL';
  const provider = providers.get(key);
  if (!provider) {
    throw new Error(`Unknown eligibility provider: ${key}`);
  }
  return provider;
};

export const listEligibilityProviders = (): EligibilityProvider[] => [...providers.values()];

export const manualEligibilityProvider = new ManualEligibilityProvider();
registerEligibilityProvider(manualEligibilityProvider);
