import { prisma } from '../config/db';
import { NotFoundError, BadRequestError, AppError } from '../utils/error.util';
import { getNextId } from '../utils/opendental-ids.util';
import { getPatientInsuranceMeta, setPatientInsuranceMeta } from '../utils/opendental-auth.util';
import { isValidNPI } from './edi837.service';
import { buildMockEligibilityResponse } from './eligibility-mock';

/**
 * Real-time insurance eligibility (X12 270/271) through Stedi's JSON API.
 *
 * Flow: load patplan -> inssub -> insplan -> carrier, build the Stedi request,
 * send it, keep the raw request/response in etrans for audit, normalize the
 * 271 benefit rows, and stamp the verification status on the insurance meta.
 *
 * Docs: https://www.stedi.com/docs/healthcare/api-reference/post-healthcare-eligibility
 */

const STEDI_ELIGIBILITY_URL =
  process.env.STEDI_ELIGIBILITY_URL ||
  'https://healthcare.us.stedi.com/2024-04-01/change/medicalnetwork/eligibility/v3';
const STEDI_TIMEOUT_MS = 60_000;

// Medflow etrans types for eligibility (ClaimSent = 1, Claim_PreAuth = 2, ERA = 5 are already in use).
export const ETYPE_ELIGIBILITY_271 = 18;

// STC 35 = Dental Care; most dental payers return every dental category for it.
const DEFAULT_DENTAL_STCS = ['35'];

// 271 EB01 codes we surface in the summary.
const EB_ACTIVE = '1';
const EB_INACTIVE = '6';
const EB_COINSURANCE = 'A';
const EB_DEDUCTIBLE = 'C';
const EB_LIMITATIONS = 'F';

// EB09/time qualifier "29" = Remaining.
const TIME_REMAINING = '29';

export type EligibilityNetwork = 'in' | 'out' | 'both' | 'unknown';
export type EligibilityStatus = 'active' | 'inactive' | 'error';

export interface EligibilityBenefit {
  code: string;
  name: string | null;
  serviceTypeCodes: string[];
  serviceTypes: string[];
  network: EligibilityNetwork;
  coverageLevel: string | null;
  insuranceType: string | null;
  percent: number | null;
  amount: number | null;
  timePeriod: string | null;
  isRemaining: boolean;
  authRequired: boolean | null;
  notes: string[];
  dates: Record<string, any> | null;
}

export interface EligibilityCheckOptions {
  providerId?: string | number;
  dateOfService?: string;
  serviceTypeCodes?: string[];
}

const toStediDate = (d: Date | string): string => {
  const date = typeof d === 'string' ? new Date(d) : d;
  return date.toISOString().slice(0, 10).replace(/-/g, '');
};

const clean = (s?: string | null) => (s ?? '').trim();

const mapNetwork = (code?: string): EligibilityNetwork => {
  switch (code) {
    case 'Y':
      return 'in';
    case 'N':
      return 'out';
    case 'W':
      return 'both';
    default:
      return 'unknown';
  }
};

const toNumber = (val: any): number | null => {
  if (val === undefined || val === null || val === '') return null;
  const n = Number(val);
  return Number.isNaN(n) ? null : n;
};

const normalizeBenefit = (b: any): EligibilityBenefit => ({
  code: b.code,
  name: b.name ?? null,
  serviceTypeCodes: b.serviceTypeCodes ?? [],
  serviceTypes: b.serviceTypes ?? [],
  network: mapNetwork(b.inPlanNetworkIndicatorCode),
  coverageLevel: b.coverageLevel ?? b.coverageLevelCode ?? null,
  insuranceType: b.insuranceType ?? null,
  // Stedi sends percents as decimal strings ("0.8" = 80%).
  percent: toNumber(b.benefitPercent) !== null ? Math.round(Number(b.benefitPercent) * 100) : null,
  amount: toNumber(b.benefitAmount),
  timePeriod: b.timeQualifier ?? null,
  isRemaining: b.timeQualifierCode === TIME_REMAINING,
  authRequired:
    b.authOrCertIndicator === 'Y' ? true : b.authOrCertIndicator === 'N' ? false : null,
  notes: (b.additionalInformation ?? []).map((i: any) => i.description).filter(Boolean),
  dates: b.benefitsDateInformation ?? null,
});

const collectErrors = (data: any): { code: string; description: string; followupAction?: string }[] => {
  const all = [
    ...(data?.errors ?? []),
    ...(data?.subscriber?.aaaErrors ?? []),
    ...((data?.dependents ?? []).flatMap((d: any) => d.aaaErrors ?? [])),
  ];
  return all.map((e: any) => ({
    code: e.code,
    description: e.description,
    followupAction: e.followupAction,
  }));
};

/**
 * Collapses benefit rows into what the front desk needs at a glance:
 * coinsurance per category, deductible and annual max, per network.
 */
const summarize = (benefits: EligibilityBenefit[]) => {
  const pick = (code: string) => benefits.filter((b) => b.code === code);
  const byNetwork = (rows: EligibilityBenefit[], network: 'in' | 'out') =>
    rows.filter((r) => r.network === network || r.network === 'both' || r.network === 'unknown');

  const coinsurance = (network: 'in' | 'out') =>
    byNetwork(pick(EB_COINSURANCE), network).map((r) => ({
      serviceTypes: r.serviceTypes.length ? r.serviceTypes : r.serviceTypeCodes,
      // 271 coinsurance is the PATIENT share; insurance pays the rest.
      patientPercent: r.percent,
      insurancePercent: r.percent !== null ? 100 - r.percent : null,
      notes: r.notes,
    }));

  const amounts = (code: string, network: 'in' | 'out') =>
    byNetwork(pick(code), network)
      .filter((r) => r.amount !== null)
      .map((r) => ({
        coverageLevel: r.coverageLevel,
        timePeriod: r.timePeriod,
        isRemaining: r.isRemaining,
        amount: r.amount,
        serviceTypes: r.serviceTypes,
      }));

  return {
    inNetwork: {
      coinsurance: coinsurance('in'),
      deductibles: amounts(EB_DEDUCTIBLE, 'in'),
      maximums: amounts(EB_LIMITATIONS, 'in'),
    },
    outOfNetwork: {
      coinsurance: coinsurance('out'),
      deductibles: amounts(EB_DEDUCTIBLE, 'out'),
      maximums: amounts(EB_LIMITATIONS, 'out'),
    },
  };
};

class EligibilityService {
  private getApiKey(): string {
    const key = process.env.STEDI_API_KEY?.trim();
    if (!key) {
      throw new BadRequestError('Eligibility checks are not configured (STEDI_API_KEY is missing)');
    }
    return key;
  }

  private async resolveProvider(patientPriProv: bigint | null | undefined, providerId?: string | number) {
    const provNum = providerId ? BigInt(providerId) : patientPriProv;
    const provider = provNum
      ? await prisma.provider.findUnique({ where: { ProvNum: provNum } })
      : await prisma.provider.findFirst({
          where: { NationalProvID: { not: null }, IsHidden: { not: 1 } },
          orderBy: { ProvNum: 'asc' },
        });
    if (!provider) throw new NotFoundError('Provider not found for eligibility check');
    if (!isValidNPI(provider.NationalProvID)) {
      throw new BadRequestError(`Provider ${provider.FName ?? ''} ${provider.LName ?? ''} has no valid NPI`.trim());
    }
    return provider;
  }

  /** Builds the Stedi request from the patient's plan chain. */
  private async buildRequest(patientId: string, patientInsuranceId: string, opts: EligibilityCheckOptions) {
    const patplan = await prisma.patplan.findUnique({
      where: { PatPlanNum: BigInt(patientInsuranceId) },
      include: {
        patient: true,
        inssub: {
          include: {
            patient: true, // the subscriber
            insplan: { include: { carrier: true } },
          },
        },
      },
    });

    if (!patplan || String(patplan.PatNum) !== String(patientId)) {
      throw new NotFoundError('Patient insurance not found');
    }

    const patient = patplan.patient;
    const inssub = patplan.inssub;
    const carrier = inssub?.insplan?.carrier;
    const subscriber = inssub?.patient ?? (patplan.Relationship === 0 ? patient : null);

    const missing: string[] = [];
    if (!clean(carrier?.ElectID)) missing.push('carrier payer ID (ElectID)');
    if (!clean(inssub?.SubscriberID)) missing.push('subscriber member ID');
    if (!subscriber) missing.push('subscriber');
    if (subscriber && !subscriber.Birthdate) missing.push('subscriber date of birth');
    if (missing.length) {
      throw new BadRequestError(`Cannot check eligibility, missing: ${missing.join(', ')}`);
    }

    const provider = await this.resolveProvider(patient?.PriProv, opts.providerId);
    const clinic = patient?.ClinicNum
      ? await prisma.clinic.findUnique({ where: { ClinicNum: patient.ClinicNum } })
      : null;

    const organizationName =
      provider.IsNotPerson === 1 ? clean(provider.LName) : clean(clinic?.Description);

    const request: Record<string, any> = {
      tradingPartnerServiceId: clean(carrier!.ElectID),
      externalPatientId: String(patient!.PatNum),
      provider: {
        npi: clean(provider.NationalProvID),
        ...(organizationName
          ? { organizationName }
          : { firstName: clean(provider.FName), lastName: clean(provider.LName) }),
        ...(clean(provider.SSN) ? { taxId: clean(provider.SSN).replace(/\D/g, '') } : {}),
      },
      subscriber: {
        memberId: clean(inssub!.SubscriberID),
        firstName: clean(subscriber!.FName),
        lastName: clean(subscriber!.LName),
        dateOfBirth: toStediDate(subscriber!.Birthdate!),
        ...(clean(inssub?.insplan?.GroupNum) ? { groupNumber: clean(inssub!.insplan!.GroupNum) } : {}),
      },
      encounter: {
        serviceTypeCodes: opts.serviceTypeCodes?.length ? opts.serviceTypeCodes : DEFAULT_DENTAL_STCS,
        dateOfService: toStediDate(opts.dateOfService ?? new Date()),
      },
    };

    // Only send the patient as a dependent when they aren't the subscriber.
    if (patplan.Relationship !== 0 && patient && patient.PatNum !== subscriber!.PatNum) {
      if (!patient.Birthdate) throw new BadRequestError('Cannot check eligibility, missing: patient date of birth');
      request.dependents = [
        {
          firstName: clean(patient.FName),
          lastName: clean(patient.LName),
          dateOfBirth: toStediDate(patient.Birthdate),
        },
      ];
    }

    return { request, patplan, carrier: carrier!, patient: patient! };
  }

  private isMockMode(): boolean {
    if (process.env.STEDI_MOCK !== 'true') return false;
    // A canned "active" response must never mark a real patient as verified.
    if (process.env.NODE_ENV === 'production') {
      throw new BadRequestError('STEDI_MOCK cannot be enabled in production');
    }
    return true;
  }

  private async callStedi(request: Record<string, any>) {
    if (this.isMockMode()) return buildMockEligibilityResponse(request);

    let res: Response;
    try {
      res = await fetch(STEDI_ELIGIBILITY_URL, {
        method: 'POST',
        headers: { Authorization: this.getApiKey(), 'Content-Type': 'application/json' },
        body: JSON.stringify(request),
        signal: AbortSignal.timeout(STEDI_TIMEOUT_MS),
      });
    } catch (err: any) {
      throw new AppError(502, `Eligibility service unreachable: ${err?.message ?? 'network error'}`, 'ELIGIBILITY_UNAVAILABLE');
    }

    const data: any = await res.json().catch(() => ({}));
    // 4xx/5xx from Stedi still carry an errors[] body we want to show to staff.
    return { httpStatus: res.status, data };
  }

  async checkEligibility(patientId: string, patientInsuranceId: string, opts: EligibilityCheckOptions = {}, userNum?: bigint) {
    const { request, patplan, carrier, patient } = await this.buildRequest(patientId, patientInsuranceId, opts);
    const isMock = this.isMockMode();
    const { httpStatus, data } = await this.callStedi(request);

    const errors = collectErrors(data);
    const benefits: EligibilityBenefit[] = (data?.benefitsInformation ?? []).map(normalizeBenefit);
    const hasActive = benefits.some((b) => b.code === EB_ACTIVE);
    const hasInactive = benefits.some((b) => b.code === EB_INACTIVE);

    const status: EligibilityStatus =
      httpStatus >= 400 || (errors.length && !hasActive) ? 'error' : hasActive ? 'active' : hasInactive ? 'inactive' : 'error';

    const checkedAt = new Date();

    // Audit trail: raw request + response, same tables the 837/835 flows use.
    const msgTextNum = await getNextId('etransmessagetext', 'EtransMessageTextNum');
    await prisma.etransmessagetext.create({
      data: { EtransMessageTextNum: msgTextNum, MessageText: JSON.stringify({ request, response: data }) },
    });
    const etransNum = await getNextId('etrans', 'EtransNum');
    await prisma.etrans.create({
      data: {
        EtransNum: etransNum,
        DateTimeTrans: checkedAt,
        Etype: ETYPE_ELIGIBILITY_271,
        CarrierNum: carrier.CarrierNum,
        PatNum: patient.PatNum,
        PlanNum: patplan.inssub?.PlanNum ?? null,
        InsSubNum: patplan.InsSubNum ?? null,
        AckCode: status,
        UserNum: userNum ?? null,
        EtransMessageTextNum: msgTextNum,
        Note: `Eligibility check (Stedi${isMock ? ' MOCK' : ''}): ${status}${errors[0] ? ` - ${errors[0].description}` : ''}`,
      },
    });

    const result = {
      status,
      mock: isMock,
      checkedAt: checkedAt.toISOString(),
      etransId: etransNum.toString(),
      dateOfService: request.encounter.dateOfService,
      payer: { id: request.tradingPartnerServiceId, name: data?.payer?.name ?? carrier.CarrierName ?? null },
      plan: {
        groupNumber: data?.planInformation?.groupNumber ?? null,
        groupName: data?.planInformation?.groupDescription ?? null,
        dates: data?.planDateInformation ?? null,
      },
      errors,
      summary: summarize(benefits),
      benefits,
    };

    // Keep the latest result on the insurance record; existing meta fields are preserved.
    const meta = await getPatientInsuranceMeta(patplan.PatPlanNum);
    await setPatientInsuranceMeta(patplan.PatPlanNum, {
      ...meta,
      verificationStatus: status === 'active' ? 'verified' : status === 'inactive' ? 'inactive' : 'failed',
      verificationDate: checkedAt,
      lastEligibilityCheck: result,
    });

    return result;
  }

  async getLatestEligibility(patientId: string, patientInsuranceId: string) {
    const patplan = await prisma.patplan.findUnique({ where: { PatPlanNum: BigInt(patientInsuranceId) } });
    if (!patplan || String(patplan.PatNum) !== String(patientId)) {
      throw new NotFoundError('Patient insurance not found');
    }
    const meta = await getPatientInsuranceMeta(patplan.PatPlanNum);
    return meta?.lastEligibilityCheck ?? null;
  }
}

export const eligibilityService = new EligibilityService();
