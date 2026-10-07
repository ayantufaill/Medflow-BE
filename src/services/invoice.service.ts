import { prisma, applyTenantContextToTransaction } from '../config/db';
import type { Prisma } from '@prisma/client';
import { BadRequestError, ConflictError, NotFoundError } from '../utils/error.util';
import { logActivity } from '../utils/activity-logger.util';
import { getNextId } from '../utils/opendental-ids.util';
import { mapPatientToApi, mapProviderToApi } from '../utils/opendental-mappers.util';
import { getPatientInsuranceMeta } from '../utils/opendental-auth.util';
import { adjustmentService } from './adjustment.service';
import { paymentService } from './payment.service';
import { claimService } from './claim.service';
import { patientInsuranceService } from './patient-insurance.service';
import { agingService } from './aging.service';
import { lateFee } from './late-fee.service';
import { LateFeeGuardrails } from './late-fee-guardrails.service';
import {
  DeductibleLedger,
  applyDeductible,
  mapCodeToCategory,
  orderIndexesByDate,
  resolveDeductibleTier,
  splitSecondaryPortion,
  tierKeyFromCoverageCategory,
} from './deductible.service';
import {
  applyDowngradeSplit,
  buildDowngradeMap,
  parseTeethRange,
  resolveDowngrade,
  type DowngradeRule,
} from './downgrade.service';
const roundCurrency = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

/**
 * Everything one insurance plan needs to price a procedure line on its OWN
 * terms: its fee schedules, its coverage percentages, its deductible pools and
 * its alternate-benefit rules.
 *
 * The primary and the secondary are priced through this same shape. That is
 * deliberate — the secondary must never inherit the primary's basis, and the
 * only reliable way to guarantee it is to make both plans go through identical
 * setup code.
 */
type PlanPricingContext = {
  patPlan: any;
  insPlan: any;
  allowedFeeMap: Map<string, number>;
  planFeeMap: Map<string, number>;
  procCodePercentages: Map<string, number>;
  categoryPercentages: Map<string, number>;
  deductibleLedger: DeductibleLedger;
  downgradeMap: Map<string, DowngradeRule>;
  coverageCategoryByCode: Map<string, string>;
};

/** Coverage-percentage lookup tables, keyed by normalized category name. */
type CoveragePercentTables = {
  procCodePercentages: Map<string, number>;
  categoryPercentages: Map<string, number>;
};

type StatementMeta = {
  appointmentId?: string;
  providerId?: string;
  insuranceCompanyId?: string;
  secondaryInsuranceCompanyId?: string;
  copayAmount?: number;
  paidAmount?: number;
  taxAmount?: number;
  discountAmount?: number;
  insurancePortion?: number;
  secondaryInsurancePortion?: number;
  patientPortion?: number;
  totalAmount?: number;
  writeoffAmount?: number;
  adjustmentAmount?: number;
  status?: string;
  claimNumber?: string;
  claimSubmissionDate?: string;
  submissionMethod?: string;
  createdBy?: string;
  dueDate?: string;
  voidReason?: string;
  claimId?: string; // Added to store generated claim ID
  /**
   * Set when the invoice's deductible has been made permanent, i.e. when the
   * fully patient-responsible portion was folded into the plan's `metAmount`.
   * Absent means "not yet posted", which is what lets `finalizeInvoice` stay
   * exactly-once: `recalculateInvoice` runs on every edit and must never repost.
   */
  deductiblePostedAt?: string;
  /** Row key -> amount permanently posted, so a void can reverse exactly. */
  deductiblePostedByRow?: Record<string, number>;
};

type ItemMeta = {
  description?: string;
  unitPrice?: number;
  quantity?: number;
  cptCode?: string;
  serviceId?: string;
};

const parseJson = <T>(value?: string | null): T => {
  if (!value) return {} as T;
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' ? (parsed as T) : ({} as T);
  } catch {
    return {} as T;
  }
};

const buildJson = (value: Record<string, unknown>) => JSON.stringify(value);

const toBigInt = (value?: string | null): bigint | null => {
  if (!value) return null;
  return /^\d+$/.test(value) ? BigInt(value) : null;
};

const getInvoiceNumber = async (db: Prisma.TransactionClient | typeof prisma = prisma): Promise<string> => {
  const recent = await db.statement.findMany({
    where: { ShortGUID: { startsWith: 'INV' } },
    orderBy: { StatementNum: 'desc' },
    take: 50,
  });
  let max = 0;
  for (const stmt of recent) {
    const match = String(stmt.ShortGUID || '').match(/\d+$/);
    const num = match ? parseInt(match[0], 10) : 0;
    if (num > max) max = num;
  }
  const next = max + 1;
  return `INV${next.toString().padStart(6, '0')}`;
};

export const isPatientPenaltyOrNonIns = (item: any): boolean => {
  if (!item) return false;
  if (
    item.isPatientPenalty ||
    item.isAccountPenalty ||
    item.patientOnly ||
    item.noBillIns ||
    item.accountPenalty
  ) {
    return true;
  }
  const code = String(
    item.cptCode || item.code || item.procedureCode || item.procCode || ''
  ).toUpperCase().trim();
  const desc = String(
    item.description || item.Description || item.Descript || ''
  ).toLowerCase().trim();

  if (
    code.startsWith('ACC-') ||
    code.startsWith('PENALTY') ||
    code.startsWith('FEE-') ||
    code.startsWith('LATE-') ||
    code === 'D9986' ||
    code === 'D9987'
  ) {
    return true;
  }
  if (
    desc.includes('cancellation') ||
    desc.includes('broken appt') ||
    desc.includes('broken appointment') ||
    desc.includes('missed appt') ||
    desc.includes('missed appointment') ||
    desc.includes('no show') ||
    desc.includes('no-show') ||
    desc.includes('late payment') ||
    desc.includes('late fee') ||
    desc.includes('penalty')
  ) {
    return true;
  }
  return false;
};

export class InvoiceService {
  /** Attach the completed OpenDental procedures already created by a treatment plan. */
  async createInvoiceFromCompletedProcedures(
    tx: Prisma.TransactionClient,
    patientId: bigint,
    procNums: bigint[],
    createdBy?: string,
    treatmentPlanId?: string,
    manualProcNums: bigint[] = [],
  ) {
    const uniqueNums = [...new Set(procNums.map(String))].map(BigInt);
    if (!uniqueNums.length) return null;
    const procedures = await tx.procedurelog.findMany({
      where: { ProcNum: { in: uniqueNums }, PatNum: patientId, ProcStatus: 2, StatementNum: null },
    });
    if (procedures.length !== uniqueNums.length) {
      throw new ConflictError('A completed procedure is already billed or is not available');
    }
    const now = new Date();
    const dueDate = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const statementNum = await getNextId('statement', 'StatementNum', tx);
    const invoiceNumber = await getInvoiceNumber(tx);
    const pricedItems = await this.calculateInsuranceEstimates(
      patientId,
      procedures.map((proc) => ({
        code: proc.OldCode || undefined,
        procedureCode: proc.OldCode || undefined,
        description: parseJson<any>(proc.BillingNote).description || proc.BillingNote || 'Service',
        charge: Number(proc.ProcFee || 0),
        ProcDate: proc.ProcDate,
        insPortion: parseJson<any>(proc.BillingNote).insPortion,
        ptPortion: parseJson<any>(proc.BillingNote).ptPortion,
      })),
      { db: tx },
    );
    const itemMetaByProc = new Map(procedures.map((proc, index) => [proc.ProcNum.toString(), {
      ...parseJson<any>(proc.BillingNote),
      description: parseJson<any>(proc.BillingNote).description || proc.BillingNote || 'Service',
      cptCode: parseJson<any>(proc.BillingNote).cptCode || proc.OldCode || null,
      serviceId: parseJson<any>(proc.BillingNote).serviceId || proc.CodeNum?.toString() || null,
      charge: Number(proc.ProcFee || 0), unitPrice: Number(proc.ProcFee || 0), quantity: 1,
      ptPortion: Number(pricedItems[index]?.ptPortion || 0),
      insPortion: Number(pricedItems[index]?.insPortion || 0),
      primaryInsPortion: Number(pricedItems[index]?.primaryInsPortion ?? pricedItems[index]?.insPortion ?? 0),
      secondaryInsPortion: Number(pricedItems[index]?.secondaryInsPortion || 0),
      totalInsPortion: Number(pricedItems[index]?.totalInsPortion ?? pricedItems[index]?.insPortion ?? 0),
      writeoff: Number(pricedItems[index]?.writeoff || 0), completed: true,
      coveragePct: pricedItems[index]?.coveragePct ?? parseJson<any>(proc.BillingNote)?.coveragePct ?? null,
      allowedFee: pricedItems[index]?.allowedFee ?? parseJson<any>(proc.BillingNote)?.allowedFee ?? null,
      allowedFeeSource: pricedItems[index]?.allowedFeeSource ?? parseJson<any>(proc.BillingNote)?.allowedFeeSource ?? null,
    }]));
    const totalAmount = roundCurrency(procedures.reduce((sum, proc) => sum + Number(proc.ProcFee || 0), 0));
    const insurancePortion = roundCurrency(procedures.reduce((sum, proc) => sum + Number(itemMetaByProc.get(proc.ProcNum.toString())?.totalInsPortion || 0), 0));
    const patientPortion = roundCurrency(procedures.reduce((sum, proc) => sum + Number(itemMetaByProc.get(proc.ProcNum.toString())?.ptPortion || 0), 0));
    const meta: StatementMeta = {
      status: 'draft', createdBy, dueDate: dueDate.toISOString(), totalAmount,
      insurancePortion, patientPortion, paidAmount: 0, taxAmount: 0,
      discountAmount: 0, writeoffAmount: 0,
      providerId: procedures[0]?.ProvNum?.toString(),
    };
    await tx.statement.create({ data: {
      StatementNum: statementNum, PatNum: patientId, DateSent: now,
      DateRangeFrom: now, DateRangeTo: dueDate,
      Note: treatmentPlanId ? `Treatment Plan ${treatmentPlanId}` : 'Treatment Plan Invoice',
      NoteBold: buildJson(meta), IsInvoice: 1, StatementType: 'draft',
      ShortGUID: invoiceNumber, InsEst: insurancePortion, BalTotal: totalAmount,
    } });
    const manual = new Set(manualProcNums.map(String));
    for (const proc of procedures) {
      const note = parseJson<any>(proc.BillingNote);
      const generatedMeta = itemMetaByProc.get(proc.ProcNum.toString()) || {};
      if (manual.has(proc.ProcNum.toString())) note.isManuallyAdjusted = true;
      const linked = await tx.procedurelog.updateMany({
        where: { ProcNum: proc.ProcNum, PatNum: patientId, ProcStatus: 2, StatementNum: null },
        data: { StatementNum: statementNum, BillingNote: buildJson({ ...generatedMeta, ...note, completed: true }) },
      });
      if (linked.count !== 1) throw new ConflictError('Procedure was billed concurrently');
    }
    await this.recalculateInvoice(statementNum.toString(), undefined, tx);
    return { id: statementNum.toString(), invoiceNumber };
  }

  private mapProcedureLogToInvoiceItem(item: any, invoiceId?: string, code?: any) {
    const meta = parseJson<ItemMeta>(item.BillingNote);
    const quantity = Number(meta.quantity ?? item.UnitQty ?? 1) || 1;
    const unitPrice = Number(meta.unitPrice ?? (item.ProcFee ?? 0) / quantity) || 0;
    const totalPrice = Number(item.ProcFee) || roundCurrency(unitPrice * quantity);
    const isPenalty = isPatientPenaltyOrNonIns(meta) || isPatientPenaltyOrNonIns(item) || item.NoBillIns === 1;

    return {
      _id: item.ProcNum.toString(),
      invoiceId: invoiceId ?? item.StatementNum?.toString() ?? null,
      serviceId: item.CodeNum?.toString() ?? meta.serviceId ?? null,
      cptCode: meta.cptCode ?? code?.ProcCode ?? null,
      description: meta.description ?? code?.Descript ?? 'Service',
      date: item.ProcDate ? new Date(item.ProcDate).toISOString() : null,
      quantity,
      unitPrice,
      totalPrice,
      ptPortion: isPenalty ? totalPrice : Number((meta as any).ptPortion || 0),
      insPortion: isPenalty ? 0 : Number((meta as any).totalInsPortion || (Number((meta as any).insPortion || 0) + Number((meta as any).secondaryInsPortion || 0))),
      primaryInsPortion: isPenalty ? 0 : Number((meta as any).primaryInsPortion || (meta as any).insPortion || 0),
      secondaryInsPortion: isPenalty ? 0 : Number((meta as any).secondaryInsPortion || 0),
      totalInsPortion: isPenalty ? 0 : Number((meta as any).totalInsPortion || (Number((meta as any).insPortion || 0) + Number((meta as any).secondaryInsPortion || 0))),
      writeoff: isPenalty ? 0 : Number((meta as any).writeoff || (meta as any).estimatedWriteOff || 0),
      estimatedWriteOff: isPenalty ? 0 : Number((meta as any).estimatedWriteOff || (meta as any).writeoff || 0),
      allowedFee: isPenalty ? null : ((meta as any).allowedFee ? Number((meta as any).allowedFee) : null),
      coveragePct: isPenalty ? null : ((meta as any).coveragePct !== undefined && (meta as any).coveragePct !== null ? Number((meta as any).coveragePct) : null),
      deductibleApplied: isPenalty ? 0 : Number((meta as any).deductibleApplied || 0),
      paidAmount: Number((meta as any).paidAmount || 0),
      patientPaidAmount: Number((meta as any).patientPaidAmount || 0),
      insurancePaidAmount: Number((meta as any).insurancePaidAmount || 0),
      insuranceExpected: Number((meta as any).insuranceExpected || (meta as any).totalInsPortion || (meta as any).insPortion || 0),
      insuranceBalance: Number((meta as any).insuranceBalance != null ? (meta as any).insuranceBalance : Math.max(0, Number((meta as any).totalInsPortion || (meta as any).insPortion || 0) - Number((meta as any).insurancePaidAmount || 0))),
      dbi: (meta as any).dbi !== undefined ? Boolean((meta as any).dbi) : null,
      site: (meta as any).site || null,
      provider: (meta as any).provider || null,
      completed: (meta as any).completed !== undefined ? Boolean((meta as any).completed) : null,
      isPatientPenalty: isPenalty,
      patientOnly: isPenalty,
      isAccountPenalty: isPenalty,
      noBillIns: isPenalty || item.NoBillIns === 1 ? 1 : null,
    };
  }

  /**
   * Build the coverage-percentage lookup tables from a plan's `coverageCategoryTable`.
   *
   * Extracted so the primary and the secondary build identical tables — the
   * aliases and category normalization below are what make a "Preventative"
   * row on one plan match a `preventive` CDT category on the other.
   */
  private buildCoveragePercentTables(coverageCategoryTable: any): CoveragePercentTables {
    const procCodePercentages = new Map<string, number>();
    const categoryPercentages = new Map<string, number>();

    const normalizeCat = (str: string) => String(str || '').toLowerCase().replace(/[^a-z0-9]/g, '');

    const addCategoryPercentage = (catName: string, cov: number, subLabel?: string) => {
      if (!catName || typeof cov !== 'number') return;
      const norm = normalizeCat(catName);
      const normSub = subLabel ? normalizeCat(subLabel) : '';

      if (normSub) {
        categoryPercentages.set(`${norm}${normSub}`, cov);
      } else {
        categoryPercentages.set(norm, cov);
      }

      // Map common category aliases
      const aliases: string[] = [];
      if (norm.includes('diagnostic')) aliases.push('diagnostic');
      if (norm.includes('prevent') || norm === 'preventative' || norm === 'preventive') {
        aliases.push('preventative', 'preventive');
      }
      if (norm.includes('restor')) aliases.push('restorative');
      if (norm.includes('endo')) aliases.push('endodontics');
      if (norm.includes('perio')) aliases.push('periodontics');
      if (norm.includes('remov')) aliases.push('prosthodonticsremovable');
      if (norm.includes('maxillofac')) aliases.push('maxillofacialprosthetics');
      if (norm.includes('implant')) aliases.push('implantservices');
      if (norm.includes('fixed')) aliases.push('prosthodonticsfixed');
      if (norm.includes('surg') || norm.includes('oral')) aliases.push('oralsurgery');
      if (norm.includes('ortho')) aliases.push('orthodontics');
      if (norm.includes('adjunc') || norm.includes('general')) aliases.push('adjunctgeneral');

      for (const alias of aliases) {
        if (normSub) {
          categoryPercentages.set(`${alias}${normSub}`, cov);
        } else {
          categoryPercentages.set(alias, cov);
        }
      }
    };

    // Process coverageCategoryTable (can be Array or Object)
    if (Array.isArray(coverageCategoryTable)) {
      for (const catEntry of coverageCategoryTable) {
        if (catEntry && typeof catEntry === 'object') {
          const catName = catEntry.category || catEntry.title || catEntry.label || catEntry.name;
          if (catName && typeof catEntry.coverage === 'number') {
            addCategoryPercentage(catName, catEntry.coverage);
          }
          if (Array.isArray(catEntry.items)) {
            for (const subItem of catEntry.items) {
              if (subItem.code && typeof subItem.coverage === 'number') {
                procCodePercentages.set(String(subItem.code).toUpperCase().trim(), subItem.coverage);
              } else if (subItem.label && typeof subItem.coverage === 'number') {
                const subLabel = String(subItem.label);
                const normSub = normalizeCat(subLabel);
                if (!categoryPercentages.has(normSub)) {
                  categoryPercentages.set(normSub, subItem.coverage);
                }
                if (catName) {
                  addCategoryPercentage(catName, subItem.coverage, subLabel);
                  const normCat = normalizeCat(catName);
                  if (!categoryPercentages.has(normCat)) {
                    categoryPercentages.set(normCat, subItem.coverage);
                  }
                }
              }
            }
          }
        }
      }
    } else if (coverageCategoryTable && typeof coverageCategoryTable === 'object') {
      for (const [catKey, value] of Object.entries(coverageCategoryTable)) {
        if (typeof value === 'number') {
          addCategoryPercentage(catKey, value);
        } else if (Array.isArray(value)) {
          for (const subItem of value as any[]) {
            if (subItem.code && typeof subItem.coverage === 'number') {
              procCodePercentages.set(String(subItem.code).toUpperCase().trim(), subItem.coverage);
            } else if (subItem.label && typeof subItem.coverage === 'number') {
              const subLabel = String(subItem.label);
              const normSub = normalizeCat(subLabel);
              if (!categoryPercentages.has(normSub)) {
                categoryPercentages.set(normSub, subItem.coverage);
              }
              addCategoryPercentage(catKey, subItem.coverage, subLabel);
              const normCat = normalizeCat(catKey);
              if (!categoryPercentages.has(normCat)) {
                categoryPercentages.set(normCat, subItem.coverage);
              }
            }
          }
        }
      }
    }

    return { procCodePercentages, categoryPercentages };
  }

  /**
   * Resolve a plan's allowed/contracted fee for a procedure code.
   *
   * `AllowedFeeSched` wins; a PPO plan (`PlanType === 'p'`) falls back to its
   * `FeeSched`, which is the plan that pays off a contracted fee directly.
   *
   * A per-line override on the item still wins over the schedule, and is read
   * by the caller so the primary and the secondary cannot disagree about it.
   */
  private resolvePlanAllowedFee(code: string, ctx: PlanPricingContext): number | undefined {
    return (
      ctx.allowedFeeMap.get(code) ??
      (ctx.insPlan?.PlanType === 'p' ? ctx.planFeeMap.get(code) : undefined)
    );
  }

  /**
   * Resolve the fee a plan pays for an alternate-benefit SUBSTITUTE code.
   *
   * Deliberately broader than `resolvePlanAllowedFee`: a non-PPO plan with no
   * `AllowedFeeSched` still has to price its own substitute, and gating the
   * `FeeSched` fallback on `PlanType === 'p'` here would mark every such
   * downgrade 'no-fee' and quietly bill the patient the full amount.
   */
  private resolveDowngradeFee(code: string, ctx: PlanPricingContext): number | undefined {
    return ctx.allowedFeeMap.get(code) ?? ctx.planFeeMap.get(code);
  }

  /**
   * Load everything one plan needs to price lines on its own terms.
   *
   * Returns null when the plan is not priceable at all (no `insplan` row), which
   * is the only condition under which a plan falls back to a conservative
   * estimate rather than being priced on its own fee schedule and rules.
   */
  private async buildPlanPricingContext(
    patPlan: any,
    opts: {
      excludeInvoiceId?: bigint | string | null;
      covSpans?: any[];
      covCatMap?: Map<string, string>;
      db?: Prisma.TransactionClient | typeof prisma;
    } = {},
  ): Promise<PlanPricingContext | null> {
    const db = opts.db ?? prisma;
    const insPlan = patPlan?.inssub?.insplan;
    if (!patPlan?.PatPlanNum || !insPlan) return null;

    const allowedFeeMap = new Map<string, number>();
    const planFeeMap = new Map<string, number>();

    const loadSchedule = async (feeSched: bigint | null | undefined, into: Map<string, number>) => {
      if (!feeSched || feeSched <= 0n) return;
      const feeRecords = await db.fee.findMany({
        where: { FeeSched: feeSched },
        include: { procedurecode: true },
      });
      for (const f of feeRecords) {
        if (f.procedurecode?.ProcCode && f.Amount !== null && f.Amount !== undefined) {
          into.set(f.procedurecode.ProcCode.toUpperCase().trim(), Number(f.Amount));
        }
      }
    };

    await loadSchedule(insPlan.AllowedFeeSched, allowedFeeMap);
    await loadSchedule(insPlan.FeeSched, planFeeMap);

    const meta: any = await getPatientInsuranceMeta(patPlan.PatPlanNum);
    const { procCodePercentages, categoryPercentages } = this.buildCoveragePercentTables(
      meta?.coverageCategoryTable || [],
    );

    // Map each code's own tier — crowns and other Major Services must never be
    // priced with the Basic sub-row just because the numeric CDT range groups
    // them together.
    const coverageCategoryByCode = new Map<string, string>();
    const procRows = await db.procedurecode.findMany({
      select: { ProcCode: true, CoverageCategory: true },
    });
    for (const r of procRows) {
      if (r.ProcCode && r.CoverageCategory) {
        coverageCategoryByCode.set(r.ProcCode.toUpperCase().trim(), r.CoverageCategory);
      }
    }

    const deductibleTier = resolveDeductibleTier({
      relationship: patPlan.Relationship,
      patientsCovered: meta?.patientsCovered,
    });
    const deductibleLedger = new DeductibleLedger(meta?.deductiblesGrid, deductibleTier, coverageCategoryByCode);

    // Claims that have not reserved yet (deductibleHeld !== true) still own their
    // `deductibleReservedByRow` estimate — reservation happens on the claim's
    // status change, not on creation. Those pools are already spoken for, so a
    // new invoice must not re-spend them or the same deductible is quoted twice
    // across invoices. Keyed by this plan's own InsSubNum so the two plans'
    // pools stay separate.
    const excludedInvoiceId =
      opts.excludeInvoiceId != null ? String(opts.excludeInvoiceId) : null;
    const claimsHoldingPools = await db.claim.findMany({
      where: {
        PatNum: patPlan.PatNum,
        InsSubNum: patPlan.InsSubNum ?? undefined,
        Narrative: { not: null },
      },
      select: { Narrative: true },
    });
    for (const held of claimsHoldingPools) {
      const heldMeta = parseJson<any>(held.Narrative || '{}');
      if (excludedInvoiceId !== null && String(heldMeta.invoiceId ?? '') === excludedInvoiceId) {
        continue;
      }
      if (heldMeta.deductibleHeld === true) continue;
      const reserved = heldMeta.deductibleReservedByRow;
      if (!reserved || typeof reserved !== 'object') continue;
      for (const [rowKey, amount] of Object.entries(reserved)) {
        deductibleLedger.reduceBalance(rowKey, roundCurrency(Number(amount) || 0));
      }
    }

    return {
      patPlan,
      insPlan,
      allowedFeeMap,
      planFeeMap,
      procCodePercentages,
      categoryPercentages,
      deductibleLedger,
      downgradeMap: buildDowngradeMap(meta?.coverageBookData),
      coverageCategoryByCode,
    };
  }

  /**
   * Read a per-line allowance that was present on the item BEFORE this run.
   *
   * Precedence mirrors the long-standing primary behaviour: `allowedFee`, then
   * `originalFee`, then `baseFee`. That last part matters — `recalculateInvoice`
   * re-prices by spreading a stored BillingNote back onto the item, so a
   * `allowedFee` in the input is a real, deliberate value and must keep winning.
   *
   * This MUST be read before the primary loop writes `item.allowedFee` with the
   * allowance it resolved for itself. Called afterwards, the field is
   * indistinguishable between "the user set this" and "the primary just
   * computed this", and the secondary would inherit the primary's contracted fee
   * as if it were an override.
   */
  private readExplicitAllowedFee(item: any): number | undefined {
    // `allowedFee` doubles as the PRIMARY's own derivation target: this loop
    // writes `item.allowedFee = <its resolved fee>` and, on the next
    // re-estimate, the value comes back pinned to 'plan'. Honoring it again
    // would freeze the line at the stale contractual fee forever — the payer's
    // fee would never re-derive, and the secondary would inherit the primary's
    // contracted allowance. Only a value a caller supplied WITHOUT that marker
    // can have been typed in by hand.
    const source = item?.allowedFeeSource;
    if (item?.allowedFee !== undefined && item?.allowedFee !== null && Number(item.allowedFee) > 0 && source !== 'plan') {
      return Number(item.allowedFee);
    }
    for (const key of ['originalFee', 'baseFee'] as const) {
      const value = item?.[key];
      if (value !== undefined && value !== null && Number(value) > 0) {
        return Number(value);
      }
    }
    return undefined;
  }

  /**
   * Resolve the coverage percentage for a procedure code on one plan.
   *
   * The ladder is deliberately identical for both plans: procedure-code
   * override → CDT category → OpenDental CovSpan/CovCat → general/basic → the
   * standard CDT-category default. A secondary plan priced by a different ladder
   * would silently disagree with the primary on the same procedure.
   *
   * Always returns a number; the final fallbacks guarantee a value rather than
   * `undefined`, so callers never have to special-case "no percentage found".
   */
  private resolveCoveragePercent(
    cleanCode: string,
    isCdtCode: boolean,
    ctx: PlanPricingContext,
    covSpans: any[],
    covCatMap: Map<string, string>,
  ): number {
    const { procCodePercentages, categoryPercentages } = ctx;
    let percent: number | undefined;

    // 1. Specific Procedure Code Override (e.g. "D2140" or "2140")
    if (procCodePercentages.has(cleanCode)) {
      percent = procCodePercentages.get(cleanCode);
    } else if (cleanCode.startsWith('D') && procCodePercentages.has(cleanCode.substring(1))) {
      percent = procCodePercentages.get(cleanCode.substring(1));
    }

    // 2. CDT Code Range Category Mapping (12 standard categories)
    // Shared with the deductible engine so the two can never disagree —
    // if they diverge, every estimate silently mis-deducts.
    if (percent === undefined && isCdtCode) {
      const catKey = mapCodeToCategory(cleanCode);
      const tierKey = tierKeyFromCoverageCategory(ctx.coverageCategoryByCode.get(cleanCode));

      // A plan can split one numeric CDT category into Basic and Major tiers.
      // The procedure code's own `CoverageCategory` is the only authoritative
      // arbiter for which side of the split it belongs to — the CDT range alone
      // would price every code in that range off the first sub-row the client
      // happened to list (typically Basic).
      if (catKey && tierKey) {
        const tieredKey = `${catKey}${tierKey}`;
        if (categoryPercentages.has(tieredKey)) {
          percent = categoryPercentages.get(tieredKey);
        }
      }

      const perioBase = catKey?.replace(/basic$|major$/, '');

      // Periodontics splits Basic vs Major and falls back to the base key.
      if (percent === undefined && perioBase === 'periodontics') {
        percent = categoryPercentages.get(catKey!)
          ?? categoryPercentages.get(perioBase)
          ?? categoryPercentages.get(catKey === 'periodonticsbasic' ? 'basic' : 'major');
      } else if (percent === undefined && catKey && categoryPercentages.has(catKey)) {
        percent = categoryPercentages.get(catKey);
      }
    }

    // 3. OpenDental CovSpan / CovCat Fallback
    if (percent === undefined) {
      const span = covSpans.find((s) => s.FromCode && s.ToCode && cleanCode >= s.FromCode && cleanCode <= s.ToCode);
      if (span && span.CovCatNum) {
        const odCategoryName = covCatMap.get(span.CovCatNum.toString());
        if (odCategoryName) {
          const normOdCat = odCategoryName.toLowerCase().replace(/[^a-z0-9]/g, '');
          if (categoryPercentages.has(normOdCat)) {
            percent = categoryPercentages.get(normOdCat);
          }
        }
      }
    }

    // 4. General / Basic Fallback
    if (percent === undefined) {
      if (categoryPercentages.has('general')) {
        percent = categoryPercentages.get('general');
      } else if (categoryPercentages.has('basic')) {
        percent = categoryPercentages.get('basic');
      }
    }

    // 5. Standard CDT Category Default Fallback (matches cdtCategoryHelper)
    if (percent === undefined) {
      if (isCdtCode) {
        const numMatch = cleanCode.match(/\d+/);
        const num = numMatch ? parseInt(numMatch[0], 10) : null;
        if (num !== null) {
          if (num < 2000) percent = 100; // Diagnostic & Preventative
          else if (num < 5000) percent = 80; // Restorative, Endo, Perio
          else if (num < 9000) percent = 50; // Prosthodontics, Implants, Surgery, Ortho
          else percent = 80; // Adjunct General
        } else {
          percent = 100;
        }
      } else {
        // Non-dental custom codes default to 0% insurance coverage
        percent = 0;
      }
    }

    return percent ?? 0;
  }

  /**
   * Price one line against the SECONDARY plan, independently of the primary.
   *
   * Mirrors the primary's arithmetic step for step, against the secondary's own
   * context: its fee schedules, its coverage percentage ladder, its deductible
   * pools and its alternate-benefit rules. Nothing here reads a value the
   * primary computed — in particular the downgrade is re-resolved against the
   * BILLED code rather than the primary's `effectiveCode`, because the two plans
   * can carry completely different rules for the same procedure.
   *
   * Returns the benefit the secondary would pay on its own terms plus the audit
   * fields describing how it got there. The caller applies the coordination-of-
   * benefits cap; this must not, or the plan would be paid more than the balance
   * the primary left.
   */
  private priceSecondaryLine(
    item: any,
    ctx: PlanPricingContext,
    covSpans: any[],
    covCatMap: Map<string, string>,
    serviceIdToProcCodeMap: Map<string, string>,
    manualAllowedFee: number | undefined,
  ): {
    benefit: number;
    billedCode: string | null;
    coveragePct: number | null;
    downgraded: boolean;
    effectiveCode: string | null;
    downgradeSkipped: string | null;
    notEstimated: boolean;
  } {
    let procCodeString = item.cptCode || item.code || item.procedureCode || item.procCode || '';
    if (!procCodeString && item.serviceId) {
      procCodeString = serviceIdToProcCodeMap.get(item.serviceId.toString()) || '';
    }
    if (!procCodeString) {
      return {
        benefit: 0,
        billedCode: null,
        coveragePct: null,
        downgraded: false,
        effectiveCode: null,
        downgradeSkipped: null,
        notEstimated: true,
      };
    }

    const billedCode = String(procCodeString).toUpperCase().trim();
    const isCdtCode = /^D\d{4}/i.test(billedCode) || /^\d{4}$/.test(billedCode);

    // The secondary's own alternate-benefit rule, re-resolved from scratch
    // against the BILLED code. A primary downgrade says nothing about this plan.
    const { rule, skipped: toothSkipped } = resolveDowngrade(
      billedCode,
      ctx.downgradeMap,
      parseTeethRange(item.site)
    );

    const coveragePct = this.resolveCoveragePercent(billedCode, isCdtCode, ctx, covSpans, covCatMap);

    // A manually entered per-line allowance still wins, matching the primary's
    // precedence — but it must be the allowance as it arrived on the item.
    // The primary loop overwrites `item.allowedFee` with the value it resolved
    // for ITSELF plan, so reading the field here would feed the primary's
    // contracted fee back in as though the user had typed it, and the secondary
    // would silently be priced on the primary's allowance. The snapshot taken
    // before the primary loop ran is what makes this value trustworthy.
    const explicitAllowedFee = manualAllowedFee;

    const charge = Number(item.totalPrice ?? item.charge ?? item.ProcFee ?? item.unitPrice ?? 0);
    const resolvedAllowedFee =
      explicitAllowedFee !== undefined
        ? explicitAllowedFee
        : this.resolvePlanAllowedFee(billedCode, ctx);

    // The secondary's basis is the charge less whatever discount already applies
    // to the line. It does NOT reuse the primary's `writeoff`: that is the
    // primary plan's contracted fee, and applying it twice would under-pay the
    // secondary. The primary's discount is applied once, at coordination time.
    // When this plan allows less than the charge, the excess is the secondary's own
    // contractual discount and reduces the basis it prices against.
    let basisFee = charge;
    if (resolvedAllowedFee !== undefined && resolvedAllowedFee > 0 && charge > resolvedAllowedFee) {
      basisFee = resolvedAllowedFee;
    }

    let insuranceBasis = basisFee;
    let downgradeRule = rule;
    let downgradeSkipped: string | null = rule ? null : toothSkipped ?? null;
    if (downgradeRule) {
      const downgradeKey = downgradeRule.downgradeCode.toUpperCase().trim();
      const downgradeFee = this.resolveDowngradeFee(downgradeKey, ctx) ?? downgradeRule.maxAllowed;

      if (downgradeFee !== undefined && downgradeFee > 0) {
        insuranceBasis = downgradeFee;
      } else {
        // The rule matched but the substitute has no fee anywhere on this plan,
        // so it cannot be priced. Skipped rather than priced against $0, and the
        // line is reported as unestimated so the UI can say why.
        downgradeRule = null;
        downgradeSkipped = 'no-fee';
      }
    }

    // The secondary's OWN deductible pool, drained once. `deductibleApplied`
    // from the primary is deliberately not consulted — that deductible is
    // already satisfied and belongs to the patient, not to this plan.
    const priced = applyDeductible(ctx.deductibleLedger, billedCode, insuranceBasis, coveragePct);

    return {
      benefit: roundCurrency(priced.insurancePortion),
      billedCode,
      coveragePct,
      downgraded: !!downgradeRule,
      effectiveCode: downgradeRule ? downgradeRule.downgradeCode : null,
      downgradeSkipped,
      // A rule that matched but could not be priced leaves the secondary genuinely
      // unestimated. A tooth-blocked rule does not: the line is priced normally,
      // just without a downgrade, which is a deliberate exclusion rather than a
      // missing estimate.
      notEstimated: downgradeSkipped === 'no-fee',
    };
  }

  /**
   * Calculate estimated insurance and patient portions for a list of items based on the primary patplan
   */
  public async calculateInsuranceEstimates(
    patientId: bigint,
    items: any[],
    options: { excludeInvoiceId?: bigint | string; db?: Prisma.TransactionClient } = {},
  ) {
    const db = options.db ?? prisma;
    try {
      const patPlan = await db.patplan.findFirst({
        where: { PatNum: patientId, OR: [{ IsPending: 0 }, { IsPending: null }] },
        orderBy: { Ordinal: 'asc' },
        include: {
          inssub: {
            include: {
              insplan: true
            }
          }
        }
      });

      if (!patPlan?.PatPlanNum) {
        // No active insurance plan — preserve manually specified portions if provided, otherwise assign charge (minus writeoff) to patient
        return items.map((item: any) => {
          const charge = roundCurrency(
            Number(item.totalPrice ?? item.charge ?? item.ProcFee ?? item.unitPrice ?? 0)
          );
          const existingWriteoff = roundCurrency(Number(item.writeoff ?? item.estimatedWriteOff ?? 0));
          const ptPortion = item.ptPortion !== undefined && item.ptPortion !== null
            ? roundCurrency(Number(item.ptPortion))
            : roundCurrency(Math.max(0, charge - existingWriteoff));
          const insPortion = item.insPortion !== undefined && item.insPortion !== null
            ? roundCurrency(Number(item.insPortion))
            : 0;
          const secondaryInsPortion = item.secondaryInsPortion !== undefined && item.secondaryInsPortion !== null
            ? roundCurrency(Number(item.secondaryInsPortion))
            : 0;
          return {
            ...item,
            ptPortion,
            insPortion,
            secondaryInsPortion,
            writeoff: existingWriteoff,
            estimatedWriteOff: existingWriteoff,
            coveragePct: item.coveragePct ?? 0,
            balance: charge,
          };
        });
      }

      // Practice-wide category tables, fetched once and shared: they are not
      // per-plan, so both plans must resolve percentages against the same data.
      const covSpans = await db.covspan.findMany();
      const covCats = await db.covcat.findMany();
      const covCatMap = new Map<string, string>();
      for (const cat of covCats) {
        if (cat.Description) {
          covCatMap.set(cat.CovCatNum.toString(), cat.Description.toLowerCase());
        }
      }

      const excludedInvoiceId =
        options.excludeInvoiceId != null ? String(options.excludeInvoiceId) : null;

      // A per-line allowance can be typed in by the user, in which case it is
      // authoritative for BOTH plans. It is snapshotted here, before the
      // primary loop below overwrites `item.allowedFee` with the value it
      // resolved for its own schedule. Without the snapshot the secondary would
      // read the primary's resolved allowance back as a manual override and be
      // priced on the primary's contracted fee — the exact bug this loop is
      // supposed to have fixed.
      const originalAllowedFeeByItem = new Map<any, number | undefined>();
      for (const item of items) {
        const raw = this.readExplicitAllowedFee(item);
        originalAllowedFeeByItem.set(item, raw);
      }

      // The PRIMARY. Null means it carries no `insplan` and therefore has no
      // fee schedule to price against — handled by the early return above, which
      // already fired on `!patPlan?.PatPlanNum`.
      const primaryCtx = await this.buildPlanPricingContext(patPlan, {
        excludeInvoiceId: excludedInvoiceId,
        db,
      });
      if (!primaryCtx) {
        // The secondary audit fields are cleared alongside the money, not left to
        // ride along on the `...item` spread. On a re-estimate the incoming item
        // IS the previous BillingNote, so anything not explicitly nulled here
        // survives as a stale record of a decision this run never made.
        return items.map((item: any) => ({
          ...item,
          insPortion: 0,
          ptPortion: roundCurrency(
            Number(item.totalPrice ?? item.charge ?? item.ProcFee ?? item.unitPrice ?? 0)
          ),
          secondaryInsPortion: 0,
          secondaryNotEstimated: false,
          secondaryDowngraded: false,
          secondaryDowngradedFrom: null,
          secondaryEffectiveCode: null,
          secondaryDowngradeSkipped: null,
          secondaryCoveragePct: null,
        }));
      }
      const { deductibleLedger, downgradeMap } = primaryCtx;

      // The SECONDARY, loaded through the SAME builder so it is priced on its own
      // fee schedules, its own coverage percentages, its own deductible pools and
      // its own alternate-benefit rules. A null context (no `insplan`) is the only
      // thing that forces the conservative fallback further down.
      const secondaryPatPlan = await db.patplan.findFirst({
        where: {
          PatNum: patientId,
          Ordinal: 2,
          OR: [{ IsPending: 0 }, { IsPending: null }],
        },
        include: { inssub: { include: { insplan: true } } },
      });
      const secondaryCtx = secondaryPatPlan
        ? await this.buildPlanPricingContext(secondaryPatPlan, {
            excludeInvoiceId: excludedInvoiceId,
            db,
          })
        : null;

      const pricedOrder = orderIndexesByDate(items);

      // Batch fetch missing procedure codes for serviceIds to avoid N+1 queries
      const missingServiceIds = items
        .filter((item) => !item.cptCode && !item.code && !item.procedureCode && !item.procCode && item.serviceId)
        .map((item) => {
          try {
            return BigInt(item.serviceId);
          } catch {
            return null;
          }
        })
        .filter((id): id is bigint => id !== null);

      const resolvedProcCodes = missingServiceIds.length > 0
        ? await db.procedurecode.findMany({
            where: { CodeNum: { in: missingServiceIds } },
            select: { CodeNum: true, ProcCode: true },
          })
        : [];
      const serviceIdToProcCodeMap = new Map(
        resolvedProcCodes
          .filter((p) => p.CodeNum !== null && p.CodeNum !== undefined)
          .map((p) => [p.CodeNum!.toString(), p.ProcCode])
      );

      for (const itemIndex of pricedOrder) {
        const item = items[itemIndex];
        const charge = Number(item.totalPrice ?? item.charge ?? item.ProcFee ?? item.unitPrice ?? 0);
        if (item.dbi) {
          item.insPortion = 0;
          item.ptPortion = charge;
          item.writeoff = 0;
          item.estimatedWriteOff = 0;
          item.deductibleApplied = 0;
          item.balance = charge;
          continue;
        }

        if (isPatientPenaltyOrNonIns(item)) {
          item.insPortion = 0;
          item.primaryInsPortion = 0;
          item.secondaryInsPortion = 0;
          item.totalInsPortion = 0;
          item.ptPortion = charge;
          item.writeoff = 0;
          item.estimatedWriteOff = 0;
          item.coveragePct = 0;
          item.deductibleApplied = 0;
          item.balance = charge;
          continue;
        }

        let procCodeString = item.cptCode || item.code || item.procedureCode || item.procCode || '';
        if (!procCodeString && item.serviceId) {
          procCodeString = serviceIdToProcCodeMap.get(item.serviceId.toString()) || '';
        }

        if (!procCodeString) continue;

        const cleanCode = String(procCodeString).toUpperCase().trim();
        const isCdtCode = /^D\d{4}/i.test(cleanCode) || /^\d{4}$/.test(cleanCode);
        const percent = this.resolveCoveragePercent(cleanCode, isCdtCode, primaryCtx, covSpans, covCatMap);

        // Alternate benefit (downgrade): the plan may substitute a cheaper
        // procedure for this one, so insurance is priced on the SUBSTITUTE's
        // allowed fee. The billed code is never rewritten — the payer applies
        // the alternate benefit itself at adjudication.
        //
        // The rule is resolved before any fee work so that a rule limited to
        // certain teeth (e.g. posterior-only composite -> amalgam) is honoured
        // for exactly those teeth. A toothless line cannot prove it qualifies,
        // so a tooth-limited rule does not apply to it — and that exclusion is
        // reported distinctly from "this plan has no rule for this code".
        const { rule, skipped: toothSkipped } = resolveDowngrade(
          cleanCode,
          downgradeMap,
          parseTeethRange(item.site)
        );

        // These MUST be assigned unconditionally, not only when a rule matches.
        // `recalculateInvoice` re-prices by spreading the item's existing
        // BillingNote into the estimator input, so a previous run's
        // `downgraded: true` is inherited onto the item and would otherwise
        // survive a re-estimate after the rule was removed — leaving a stale
        // "downgraded" badge on a line that is no longer downgraded.
        item.downgraded = !!rule;
        item.downgradedFrom = rule ? cleanCode : null;
        item.effectiveCode = rule ? rule.downgradeCode : null;
        item.downgradeSkipped = rule ? null : toothSkipped ?? null;

        // Apply Allowed / Contracted Fee logic
        const explicitAllowedFee = originalAllowedFeeByItem.get(item);

        const resolvedAllowedFee =
          explicitAllowedFee !== undefined
            ? explicitAllowedFee
            : this.resolvePlanAllowedFee(cleanCode, primaryCtx);

        let basisFee = charge;
        let estimatedWriteOff = 0;

        if (resolvedAllowedFee !== undefined && resolvedAllowedFee > 0 && charge > resolvedAllowedFee) {
          estimatedWriteOff = roundCurrency(charge - resolvedAllowedFee);
          basisFee = resolvedAllowedFee;
          item.allowedFee = resolvedAllowedFee;
          item.allowedFeeSource = 'plan';
          item.estimatedWriteOff = estimatedWriteOff;
          item.writeoff = estimatedWriteOff;
        } else if (resolvedAllowedFee !== undefined && resolvedAllowedFee > 0) {
          item.allowedFee = resolvedAllowedFee;
          item.allowedFeeSource = 'plan';
          item.estimatedWriteOff = 0;
          item.writeoff = 0;
          basisFee = charge;
        } else {
          const manualWriteoff = roundCurrency(Number(item.writeoff ?? item.estimatedWriteOff ?? 0));
          item.writeoff = manualWriteoff;
          item.estimatedWriteOff = manualWriteoff;
          if (manualWriteoff > 0 && charge > manualWriteoff) {
            basisFee = roundCurrency(charge - manualWriteoff);
          }
        }

        // The insurance basis is the downgrade code's allowed fee when this
        // procedure has an alternate-benefit rule; otherwise the billed code's
        // own allowed fee resolved above.
        //
        // The write-off above is deliberately NOT recomputed: it stays derived
        // from the BILLED code's contracted fee, because that discount is owed
        // on the procedure actually performed.
        let insuranceBasis = basisFee;
        let downgradeRule = rule;
        if (downgradeRule) {
          const downgradeKey = downgradeRule.downgradeCode.toUpperCase().trim();
          const downgradeFee =
            this.resolveDowngradeFee(downgradeKey, primaryCtx) ?? downgradeRule.maxAllowed;

          if (downgradeFee !== undefined && downgradeFee > 0) {
            insuranceBasis = downgradeFee;
          } else {
            // No fee anywhere for the substitute. Skip the downgrade entirely
            // rather than pricing the line against $0, and flag it so the UI
            // can tell the user the rule is unpriced.
            downgradeRule = null;
            item.downgradeSkipped = 'no-fee';
            item.downgraded = false;
            delete item.downgradedFrom;
            delete item.effectiveCode;
          }
        }

        // Price the line against its resolved deductible pool. The deductible is
        // applied to `basisFee` (the ALLOWED fee) BEFORE coinsurance, so it is
        // never capped by the initial patient coinsurance. The write-off above
        // stays entirely outside this calculation.
        //
        // Called exactly ONCE: every invocation drains the shared ledger, so a
        // second call would charge the deductible twice against the same pool.
        // `cleanCode` — the BILLED code — selects the pool, which is the safe
        // default: downgrades almost always stay within one category.
        const priced = applyDeductible(deductibleLedger, cleanCode, insuranceBasis, percent);

        // The line's Allowed fee is the basis the insurance actually priced
        // against: the downgraded procedure's allowed fee when a downgrade
        // applies, otherwise the billed code's contracted allowed fee.
        item.allowedFee = insuranceBasis;
        item.allowedFeeSource = 'plan';
        item.insPortion = priced.insurancePortion;
        item.deductibleApplied = priced.deductibleApplied;
        item.deductibleRowKey = priced.rowKey;
        if (percent !== undefined) {
          item.coveragePct = percent;
        }

        if (downgradeRule) {
          // `applyDeductible` derives the patient share from the basis it was
          // given, and that basis was the downgrade fee. The patient received
          // the real procedure, so their share must be recomputed from the
          // billed charge — otherwise they are silently under-billed by the
          // difference between the two procedures.
          //
          // Write-off double-count trace (verified against the downstream
          // totals, so this is not re-derived on every future change):
          //   - this loop sets item.writeoff ONCE, above, from the BILLED code's
          //     contracted fee; the downgrade never recomputes it.
          //   - the statement's `writeoffAmount` sums BillingNote.writeoff, and
          //     `totalPtPortion` sums BillingNote.ptPortion — two SEPARATE
          //     rollups, so the write-off is not added to the patient share
          //     twice (invoice totals, ~line 1847 and ~line 2187).
          //   - `balanceDue = subtotal - totalPaid` uses the GROSS charge and
          //     deliberately excludes write-offs, which post as their own
          //     payable line (see the comment at ~line 1910).
          //   - therefore ptPortion already excludes the contractual discount,
          //     and `charge - writeoff - insPortion` is the correct patient
          //     share with no further adjustment. Deductible is folded into
          //     ptPortion, and downstream secondary splitting treats
          //     `deductibleApplied` as patient-only.
          const split = applyDowngradeSplit({
            charge,
            contractualWriteOff: Number(item.writeoff ?? 0),
            insurancePortion: priced.insurancePortion,
          });
          item.ptPortion = split.patientPortion;
          item.coinsurance = split.coinsurance;
        } else {
          item.ptPortion = priced.patientPortion;
          item.coinsurance = priced.coinsurance;
        }
        // `balance` is the GROSS charge — what the patient was actually billed
        // for — and is deliberately independent of how the line ends up funded.
        // Deriving it from the downgrade split would report the substitute
        // procedure's share instead of the one performed, which understates
        // the line by the whole downgrade gap.
        item.balance = charge;
        item.secondaryInsPortion = 0;
      }

      // ── Secondary insurance ─────────────────────────────────────────────────
      // The secondary is priced on its OWN terms: its own fee schedules, its own
      // coverage percentages, its own deductible ledger and its own downgrade
      // rules, all resolved through the same helpers the primary used. It never
      // inherits the primary's basis — in particular the downgrade is re-resolved
      // against the BILLED code, because the two plans can carry entirely
      // different alternate-benefit rules for the same procedure.
      if (secondaryCtx) {
        for (const item of items) {
          if (isPatientPenaltyOrNonIns(item) || item.dbi) {
            item.primaryInsPortion = 0;
            item.secondaryInsPortion = 0;
            item.totalInsPortion = 0;
            item.insPortion = 0;
            item.ptPortion = Number(item.totalPrice ?? item.charge ?? item.ProcFee ?? item.unitPrice ?? 0);
            continue;
          }

          item.primaryInsPortion = item.insPortion;

          const secondary = this.priceSecondaryLine(
            item,
            secondaryCtx,
            covSpans,
            covCatMap,
            serviceIdToProcCodeMap,
            originalAllowedFeeByItem.get(item)
          );

          // The floor is not defensive padding: `balance` is the GROSS charge
          // while `writeoff` and `primaryInsPortion` are each derived against
          // their own basis, so on a heavily discounted line the two together can
          // exceed the gross. Without Math.max(0, ...) the negative remainder
          // would flow straight into `secondaryInsPortion`, then into
          // `totalInsPortion`, and post a negative insurance payment to a payer.
          const remainingAfterPrimary = roundCurrency(
            Math.max(0, item.balance - Number(item.writeoff ?? 0) - item.primaryInsPortion)
          );

          item.secondaryInsPortion = roundCurrency(
            Math.min(Math.max(0, secondary.benefit), remainingAfterPrimary)
          );
          // A downgraded secondary rule that matched but had no fee for the
          // substitute cannot be priced, so the line is left unestimated rather
          // than priced against $0. `secondaryNotEstimated` means ONLY "the
          // secondary could not be independently estimated" — a downgraded
          // PRIMARY is no longer a reason to set it.
          item.secondaryNotEstimated = secondary.notEstimated;
          item.secondaryDowngraded = secondary.downgraded;
          item.secondaryDowngradedFrom = secondary.downgraded ? secondary.billedCode : null;
          item.secondaryEffectiveCode = secondary.effectiveCode;
          item.secondaryDowngradeSkipped = secondary.downgradeSkipped;
          item.secondaryCoveragePct = secondary.coveragePct;

          // `ptPortion` is the residual, not the primary's coinsurance split:
          // gross charge minus the contractual discount minus what both plans
          // pay. Deriving it any other way double-counts or drops the write-off.
          item.ptPortion = roundCurrency(
            Math.max(
              0,
              item.balance - Number(item.writeoff ?? 0) - item.primaryInsPortion - item.secondaryInsPortion
            )
          );

          item.totalInsPortion = roundCurrency(
            Number(item.primaryInsPortion || 0) + Number(item.secondaryInsPortion || 0)
          );
          item.insPortion = item.totalInsPortion;
        }
      } else if (secondaryPatPlan) {
        // A secondary patplan exists but carries no `insplan`, so there is no fee
        // schedule to price it against. Fall back to transferring the primary's
        // coinsurance (never its deductible), which is the conservative answer,
        // and flag every line as unestimated.
        for (const item of items) {
          if (isPatientPenaltyOrNonIns(item) || item.dbi) {
            item.primaryInsPortion = 0;
            item.secondaryInsPortion = 0;
            item.totalInsPortion = 0;
            item.insPortion = 0;
            item.ptPortion = Number(item.totalPrice ?? item.charge ?? item.ProcFee ?? item.unitPrice ?? 0);
            continue;
          }
          item.primaryInsPortion = item.insPortion;
          // Only coinsurance is secondary-claimable. The deductible the patient
          // already satisfied must stay with them, otherwise the secondary
          // carrier is over-paid and the patient balance is understated.
          if (item.ptPortion > 0) {
            const split = splitSecondaryPortion(item.ptPortion, item.deductibleApplied ?? 0);
            item.secondaryInsPortion = split.secondaryPortion;
            item.ptPortion = split.patientPortion;
          }
          item.secondaryNotEstimated = true;
          // The fallback is a coinsurance transfer, not a plan quote, so it has
          // no downgrade trail and no percentage to attribute. Nulling them keeps
          // a stale value from a previous independently-priced run from being
          // persisted alongside it.
          item.secondaryDowngraded = false;
          item.secondaryDowngradedFrom = null;
          item.secondaryEffectiveCode = null;
          item.secondaryDowngradeSkipped = null;
          item.secondaryCoveragePct = null;
          item.totalInsPortion = roundCurrency(
            Number(item.primaryInsPortion || 0) + Number(item.secondaryInsPortion || 0)
          );
          item.insPortion = item.totalInsPortion;
        }
      } else {
        // No secondary patplan at all — the primary result stands on its own.
        for (const item of items) {
          if (isPatientPenaltyOrNonIns(item) || item.dbi) {
            item.primaryInsPortion = 0;
            item.secondaryInsPortion = 0;
            item.totalInsPortion = 0;
            item.insPortion = 0;
            item.ptPortion = Number(item.totalPrice ?? item.charge ?? item.ProcFee ?? item.unitPrice ?? 0);
            // Cleared for the same reason as in the priced branch: on a
            // re-estimate these fields arrive from the previous BillingNote, so
            // a line that was not billed to insurance must not keep a stale
            // secondary estimate attached to it.
            item.secondaryNotEstimated = false;
            item.secondaryDowngraded = false;
            item.secondaryDowngradedFrom = null;
            item.secondaryEffectiveCode = null;
            item.secondaryDowngradeSkipped = null;
            item.secondaryCoveragePct = null;
            continue;
          }
          item.primaryInsPortion = item.insPortion;
          item.totalInsPortion = item.insPortion;
          // No secondary plan exists at all, so there is no secondary estimate of
          // any kind to report. Explicitly cleared rather than left to ride along
          // on the incoming BillingNote spread.
          item.secondaryNotEstimated = false;
          item.secondaryDowngraded = false;
          item.secondaryDowngradedFrom = null;
          item.secondaryEffectiveCode = null;
          item.secondaryDowngradeSkipped = null;
          item.secondaryCoveragePct = null;
        }
      }
    } catch (err) {
      console.warn('[InvoiceService] Failed to calculate insurance estimates:', err);
      // Transactional saves must roll back instead of persisting partial estimates.
      if (options.db) throw err;
    }
    return items;
  }

  public async estimateInvoiceItems(patientId: string, items: any[]) {
    return this.calculateInsuranceEstimates(BigInt(patientId), items);
  }

  /**
   * Background task: generate a draft claim for the patient's primary insurance
   * if the invoice has no claim yet and the patient has active insurance.
   * Uses setImmediate to avoid blocking the main thread.
   */
  private triggerClaimGeneration(statementNum: bigint, patNum: bigint | null, createdBy: string) {
    if (!patNum) return;

    setImmediate(async () => {
      try {
        const invoiceId = statementNum.toString();
        const patientId = patNum.toString();

        console.log(`[InvoiceService] Triggering claim generation for invoice ${invoiceId}, patient ${patientId}`);

        // 1. Check if invoice already has a claim attached (in metadata)
        const invoice = await prisma.statement.findUnique({
          where: { StatementNum: statementNum },
          select: { NoteBold: true, PatNum: true },
        });
        if (!invoice) return;

        const meta = parseJson<StatementMeta>(invoice.NoteBold || '{}');

        // Check if invoice has any insurable procedures (skip claim generation if only penalty items or 0 insPortion)
        const allInvoiceProcs = await prisma.procedurelog.findMany({ where: { StatementNum: statementNum } });
        const hasInsurableProcs = allInvoiceProcs.some(proc => {
          if (proc.NoBillIns === 1) return false;
          const bn = parseJson<any>(proc.BillingNote);
          if (isPatientPenaltyOrNonIns(bn) || isPatientPenaltyOrNonIns(proc)) return false;
          const ins = Number(bn.insPortion || 0) + Number(bn.secondaryInsPortion || 0);
          return ins > 0;
        });

        if (!hasInsurableProcs) {
          console.log(`[InvoiceService] Invoice ${invoiceId} has no insurable procedures (only patient penalties/fees), skipping claim generation`);
          return;
        }

        if (meta.claimId) {
          // A claim already exists for this invoice — recalculate its totals from the
          // invoice's current procedures instead of skipping, so procedures added after
          // the claim was first generated (e.g. a second item on the same invoice) are
          // reflected in the claim's insurance/patient balances.
          const existingClaim = await prisma.claim.findUnique({ where: { ClaimNum: BigInt(meta.claimId) } });
          if (!existingClaim) {
            console.log(`[InvoiceService] Invoice ${invoiceId} references missing claim ${meta.claimId}, skipping`);
            return;
          }

          const invoiceProcs = await prisma.procedurelog.findMany({ where: { StatementNum: statementNum } });
          let sumFee = 0;
          let sumIns = 0;
          let sumPt = 0;
          for (const proc of invoiceProcs) {
            sumFee += Number(proc.ProcFee || 0);
            if (proc.BillingNote) {
              const bn = parseJson<any>(proc.BillingNote);
              sumIns += Number(bn.insPortion || 0);
              sumPt += Number(bn.ptPortion || 0);
            }
          }
          const existingMeta = parseJson<any>(existingClaim.Narrative || '{}');
          const updatedMeta = {
            ...existingMeta,
            claimAmount: sumFee,
            submittedAmount: sumIns > 0 ? sumIns : sumFee,
            totalAmount: sumFee,
            patientResponsibility: sumPt,
          };
          await prisma.claim.update({
            where: { ClaimNum: existingClaim.ClaimNum },
            data: {
              ClaimFee: sumFee,
              InsPayEst: sumIns,
              DedApplied: sumPt,
              Narrative: buildJson(updatedMeta),
            },
          });
          console.log(`[InvoiceService] Updated existing claim ${existingClaim.ClaimNum} amounts: fee=${sumFee}, ins=${sumIns}, pt=${sumPt}`);
          return;
        }

        // 2. Fetch active insurances for the patient
        const activeInsurances = await patientInsuranceService.getPatientInsurances(patientId, true);
        if (!activeInsurances.length) {
          console.log(`[InvoiceService] No active insurances for patient ${patientId}, skipping`);
          return;
        }

        // 3. Find primary insurance
        const primaryInsurance = activeInsurances.find(ins => ins.insuranceType === 'primary');
        if (!primaryInsurance) {
          console.log(`[InvoiceService] No primary insurance found for patient ${patientId}, skipping`);
          return;
        }

        const insuranceCompanyId = primaryInsurance.insuranceCompanyId?._id;
        if (!insuranceCompanyId) {
          console.log(`[InvoiceService] Primary insurance has no company ID, skipping`);
          return;
        }

        // 4. Double-check for existing claim via Narrative (fallback)
        const existingClaim = await prisma.claim.findFirst({
          where: {
            ClaimType: { not: 'PreAuth' },
            Narrative: { contains: `"invoiceId":"${invoiceId}"` },
          },
        });
        if (existingClaim) {
          const invoiceProcs = await prisma.procedurelog.findMany({ where: { StatementNum: statementNum } });
          let sumFee = 0;
          let sumIns = 0;
          let sumPt = 0;
          for (const proc of invoiceProcs) {
            const fee = Number(proc.ProcFee || 0);
            sumFee += fee;
            if (proc.BillingNote) {
              const bn = parseJson<any>(proc.BillingNote);
              sumIns += Number(bn.insPortion || 0);
              sumPt += Number(bn.ptPortion || 0);
            }
          }
          const existingMeta = parseJson<any>(existingClaim.Narrative || '{}');
          const updatedMeta = {
            ...existingMeta,
            claimAmount: sumFee,
            submittedAmount: sumIns > 0 ? sumIns : sumFee,
            totalAmount: sumFee,
            patientResponsibility: sumPt,
          };
          await prisma.claim.update({
            where: { ClaimNum: existingClaim.ClaimNum },
            data: {
              ClaimFee: sumFee,
              InsPayEst: sumIns,
              DedApplied: sumPt,
              Narrative: buildJson(updatedMeta),
            },
          });
          console.log(`[InvoiceService] Updated existing claim ${existingClaim.ClaimNum} amounts: fee=${sumFee}, ins=${sumIns}, pt=${sumPt}`);
          return;
        }

        // 5. Generate draft claim
        const claim = await claimService.createClaimFromInvoice(
          invoiceId,
          {
            insuranceCompanyId,
            insuranceType: 'primary',
            policyNumber: primaryInsurance.policyNumber ?? undefined,
          },
          createdBy
        );

        // 6. Store claimId in invoice metadata to prevent duplicates
        const updatedMeta = { ...meta, claimId: claim._id };
        await prisma.statement.update({
          where: { StatementNum: statementNum },
          data: { NoteBold: buildJson(updatedMeta) },
        });

        console.log(`[InvoiceService] Auto-generated claim ${claim._id} for invoice ${invoiceId}`);
      } catch (err: any) {
        console.error('[InvoiceService] Auto-claim generation failed:', err?.message || err);
        console.error(err?.stack);
      }
    });
  }

  private async getDefaultFeeSchedNum(): Promise<bigint> {
    const existing = await prisma.feesched.findFirst({
      where: { IsHidden: 0 },
      orderBy: { FeeSchedNum: 'asc' },
    });
    if (existing?.FeeSchedNum) return existing.FeeSchedNum;
    const nextId = await getNextId('feesched', 'FeeSchedNum');
    const created = await prisma.feesched.create({
      data: {
        FeeSchedNum: nextId,
        Description: 'MedFlow Default',
        FeeSchedType: 0,
        IsHidden: 0,
        IsGlobal: 1,
      },
    });
    return created.FeeSchedNum;
  }

  private async resolveProvider(providerId?: string | null) {
    if (!providerId || !/^\d+$/.test(providerId)) return null;
    const provider = await prisma.provider.findUnique({
      where: { ProvNum: BigInt(providerId) },
      include: { definition: true },
    });
    if (!provider) return null;
    const linkedUser =
      provider.CustomID && /^\d+$/.test(provider.CustomID)
        ? await prisma.userod.findUnique({ where: { UserNum: BigInt(provider.CustomID) } })
        : null;
    return mapProviderToApi(provider, {
      specialtyName: provider.definition?.ItemName ?? null,
      userId: provider.CustomID ?? null,
      user: linkedUser
        ? {
            _id: linkedUser.UserNum.toString(),
            firstName: linkedUser.UserName ?? '',
            lastName: '',
            email: null,
          }
        : null,
    });
  }

  private async resolveAppointment(appointmentId?: string | null) {
    if (!appointmentId || !/^\d+$/.test(appointmentId)) return null;
    const appointment = await prisma.appointment.findUnique({
      where: { AptNum: BigInt(appointmentId) },
    });
    if (!appointment) return null;
    return {
      _id: appointment.AptNum.toString(),
      appointmentDate: appointment.AptDateTime ?? null,
      startTime: appointment.AptDateTime ?? null,
      endTime: appointment.AptDateTime ?? null,
      providerId: appointment.ProvNum?.toString() ?? null,
    };
  }

  private async resolveInsuranceCompany(insuranceCompanyId?: string | null) {
    if (!insuranceCompanyId || !/^\d+$/.test(insuranceCompanyId)) return null;
    const carrier = await prisma.carrier.findUnique({
      where: { CarrierNum: BigInt(insuranceCompanyId) },
    });
    if (!carrier) return null;
    return {
      _id: carrier.CarrierNum.toString(),
      name: carrier.CarrierName ?? '',
      payerId: carrier.ElectID ?? null,
    };
  }

  private async batchResolveProviders(providerIds: (string | null | undefined)[]) {
    const validIds = Array.from(
      new Set(providerIds.filter((id): id is string => typeof id === 'string' && /^\d+$/.test(id)))
    );
    if (validIds.length === 0) return new Map<string, any>();

    const providers = await prisma.provider.findMany({
      where: { ProvNum: { in: validIds.map((id) => BigInt(id)) } },
      include: { definition: true },
    });

    const userIds = Array.from(
      new Set(
        providers
          .map((p) => p.CustomID)
          .filter((id): id is string => typeof id === 'string' && /^\d+$/.test(id))
      )
    );

    const users = userIds.length
      ? await prisma.userod.findMany({
          where: { UserNum: { in: userIds.map((id) => BigInt(id)) } },
        })
      : [];
    const userMap = new Map(users.map((u) => [u.UserNum.toString(), u]));

    const providerMap = new Map<string, any>();
    for (const p of providers) {
      const linkedUser = p.CustomID ? userMap.get(p.CustomID) : null;
      const mapped = mapProviderToApi(p, {
        specialtyName: p.definition?.ItemName ?? null,
        userId: p.CustomID ?? null,
        user: linkedUser
          ? {
              _id: linkedUser.UserNum.toString(),
              firstName: linkedUser.UserName ?? '',
              lastName: '',
              email: null,
            }
          : null,
      });
      providerMap.set(p.ProvNum.toString(), mapped);
    }
    return providerMap;
  }

  private async batchResolveInsuranceCompanies(insuranceCompanyIds: (string | null | undefined)[]) {
    const validIds = Array.from(
      new Set(insuranceCompanyIds.filter((id): id is string => typeof id === 'string' && /^\d+$/.test(id)))
    );
    if (validIds.length === 0) return new Map<string, any>();

    const carriers = await prisma.carrier.findMany({
      where: { CarrierNum: { in: validIds.map((id) => BigInt(id)) } },
    });

    const carrierMap = new Map<string, any>();
    for (const c of carriers) {
      carrierMap.set(c.CarrierNum.toString(), {
        _id: c.CarrierNum.toString(),
        name: c.CarrierName ?? '',
        payerId: c.ElectID ?? null,
      });
    }
    return carrierMap;
  }

  private async batchGetInvoiceItems(statementNums: bigint[]) {
    if (statementNums.length === 0) return new Map<string, any[]>();

    const items = await prisma.procedurelog.findMany({
      where: { StatementNum: { in: statementNums } },
      orderBy: { ProcNum: 'asc' },
    });

    const codeNums = Array.from(
      new Set(
        items
          .map((item) => item.CodeNum)
          .filter((codeNum): codeNum is bigint => codeNum !== null && codeNum !== undefined)
      )
    );

    const codes = codeNums.length
      ? await prisma.procedurecode.findMany({ where: { CodeNum: { in: codeNums } } })
      : [];
    const codeMap = new Map(codes.map((code) => [code.CodeNum?.toString(), code]));

    const itemsByStatementMap = new Map<string, any[]>();
    for (const item of items) {
      if (!item.StatementNum) continue;
      const stmtKey = item.StatementNum.toString();
      const mapped = this.mapProcedureLogToInvoiceItem(
        item,
        stmtKey,
        item.CodeNum ? codeMap.get(item.CodeNum.toString()) : null
      );
      const list = itemsByStatementMap.get(stmtKey) || [];
      list.push(mapped);
      itemsByStatementMap.set(stmtKey, list);
    }
    return itemsByStatementMap;
  }

  private async getStatementById(statementId: string) {
    const statementNum = toBigInt(statementId);
    if (!statementNum) return null;
    return prisma.statement.findUnique({
      where: { StatementNum: statementNum },
    });
  }

  private mapStatementToInvoice(statement: any, meta: StatementMeta) {
    const idStr = statement.StatementNum.toString();
    return {
      _id: idStr,
      id: idStr,
      invoiceNumber: statement.ShortGUID ?? '',
      patientId: statement.PatNum?.toString() ?? null,
      appointmentId: meta.appointmentId ?? null,
      insuranceCompanyId: meta.insuranceCompanyId ?? null,
      providerId: meta.providerId ?? null,
      invoiceDate: statement.DateSent ?? null,
      dueDate: meta.dueDate ? new Date(meta.dueDate) : statement.DateRangeTo ?? null,
      totalAmount: Number(meta.totalAmount) || Number(statement.BalTotal) || 0,
      insurancePortion: (meta.insurancePortion !== undefined && meta.insurancePortion !== null) ? Number(meta.insurancePortion) : (Number(statement.InsEst) || 0),
      secondaryInsPortion: Number(meta.secondaryInsurancePortion) || 0,
      patientPortion: Number(meta.patientPortion) || 0,
      copayAmount: Number(meta.copayAmount) || 0,
      paidAmount: Number(meta.paidAmount) || 0,
      writeoffAmount: Number(meta.writeoffAmount) || 0,
      adjustmentAmount: Number(meta.adjustmentAmount) || 0,
      balanceDue: Number(statement.BalTotal) || 0,
      taxAmount: Number(meta.taxAmount) || 0,
      discountAmount: Number(meta.discountAmount) || 0,
      status: meta.status ?? 'draft',
      claimNumber: meta.claimNumber ?? null,
      claimSubmissionDate: meta.claimSubmissionDate ? new Date(meta.claimSubmissionDate) : null,
      submissionMethod: meta.submissionMethod ?? null,
      createdBy: meta.createdBy ?? null,
      notes: statement.Note ?? null,
      claimId: meta.claimId ?? null, // Include claimId in response
    };
  }

  private async getInvoiceItems(statementNum: bigint) {
    const items = await prisma.procedurelog.findMany({
      where: { StatementNum: statementNum },
      orderBy: { ProcNum: 'asc' },
    });
    const codeNums = items
      .map((item) => item.CodeNum)
      .filter((codeNum): codeNum is bigint => codeNum !== null && codeNum !== undefined);
    const codes = codeNums.length
      ? await prisma.procedurecode.findMany({ where: { CodeNum: { in: codeNums } } })
      : [];
    const codeMap = new Map(codes.map((code) => [code.CodeNum?.toString(), code]));
    return items.map((item) =>
      this.mapProcedureLogToInvoiceItem(
        item,
        statementNum.toString(),
        item.CodeNum ? codeMap.get(item.CodeNum.toString()) : null
      )
    );
  }

  async getAllInvoices(
    page = 1,
    limit = 10,
    filters: {
      patientId?: string;
      appointmentId?: string;
      providerId?: string;
      insuranceCompanyId?: string;
      status?: string;
      startDate?: string;
      endDate?: string;
      search?: string;
    } = {}
  ) {
    const skip = (page - 1) * limit;
    const where: any = { IsInvoice: 1 };
    if (filters.patientId) where.PatNum = BigInt(filters.patientId);
    if (filters.status) where.StatementType = filters.status;
    if (filters.search) where.ShortGUID = { contains: filters.search };
    if (filters.startDate || filters.endDate) {
      where.DateSent = {};
      if (filters.startDate) where.DateSent.gte = new Date(filters.startDate);
      if (filters.endDate) where.DateSent.lte = new Date(filters.endDate);
    }

    const [rows, total] = await Promise.all([
      prisma.statement.findMany({ where, orderBy: { DateSent: 'desc' }, skip, take: limit }),
      prisma.statement.count({ where }),
    ]);

    const mappedInvoices = rows.map((row) => {
      const meta = parseJson<StatementMeta>(row.NoteBold);
      return this.mapStatementToInvoice(row, meta);
    });

    const uniquePatientIds = [...new Set(mappedInvoices.map((i) => i.patientId).filter((id): id is string => typeof id === 'string' && /^\d+$/.test(id)))];
    const uniqueProviderIds = [...new Set(mappedInvoices.map((i) => i.providerId).filter((id): id is string => typeof id === 'string' && /^\d+$/.test(id)))];
    const uniqueInsuranceIds = [...new Set(mappedInvoices.map((i) => i.insuranceCompanyId).filter((id): id is string => typeof id === 'string' && /^\d+$/.test(id)))];

    const [patients, providerMap, insuranceCompanyMap] = await Promise.all([
      uniquePatientIds.length
        ? prisma.patient.findMany({ where: { PatNum: { in: uniquePatientIds.map((id) => BigInt(id)) } } })
        : [],
      this.batchResolveProviders(uniqueProviderIds),
      this.batchResolveInsuranceCompanies(uniqueInsuranceIds),
    ]);

    const patientMap = new Map(patients.map((p) => [p.PatNum.toString(), p]));

    let invoices = mappedInvoices.map((invoice) => {
      const patient = invoice.patientId ? patientMap.get(invoice.patientId) : null;
      const provider = invoice.providerId ? providerMap.get(invoice.providerId) ?? null : null;
      const insuranceCompany = invoice.insuranceCompanyId ? insuranceCompanyMap.get(invoice.insuranceCompanyId) ?? null : null;
      return { ...invoice, patient: patient ? mapPatientToApi(patient) : null, provider, insuranceCompany };
    });

    if (filters.appointmentId || filters.providerId || filters.insuranceCompanyId) {
      invoices = invoices.filter((invoice) => {
        if (filters.appointmentId && invoice.appointmentId !== filters.appointmentId) return false;
        if (filters.providerId && invoice.providerId !== filters.providerId) return false;
        if (filters.insuranceCompanyId && invoice.insuranceCompanyId !== filters.insuranceCompanyId) return false;
        return true;
      });
    }

    return { invoices, pagination: { page, limit, total, pages: Math.ceil(total / limit) } };
  }

  async getInvoiceById(invoiceId: string) {
    const invoice = await this.getStatementById(invoiceId);
    if (!invoice) throw new NotFoundError('Invoice not found');
    const meta = parseJson<StatementMeta>(invoice.NoteBold);

    const [patient, appointment, directProvider, insuranceCompany, secondaryInsuranceCompany, items] = await Promise.all([
      invoice.PatNum
        ? prisma.patient.findUnique({ where: { PatNum: invoice.PatNum } })
        : null,
      this.resolveAppointment(meta.appointmentId ?? null),
      this.resolveProvider(meta.providerId ?? null),
      this.resolveInsuranceCompany(meta.insuranceCompanyId ?? null),
      this.resolveInsuranceCompany(meta.secondaryInsuranceCompanyId ?? null),
      this.getInvoiceItems(invoice.StatementNum),
    ]);

    const provider = directProvider ?? (appointment?.providerId ? await this.resolveProvider(appointment.providerId) : null);

    // The estimators price from the patient's ACTIVE coverage, but
    // `meta.insuranceCompanyId` is only populated when the invoice was created
    // from an appointment that had a carrier explicitly attached. For an invoice
    // built any other way it is null, so the carrier names a display needs have
    // to come from the patient's coverages, ordered by ordinal — ordinal 1 is
    // primary, 2 is secondary, which is exactly the split the line items are
    // priced into.
    let coverages: Array<{ insuranceType: string; name: string | null }> = [];
    if (invoice.PatNum) {
      try {
        const active = await patientInsuranceService.getPatientInsurances(String(invoice.PatNum), true);
        coverages = (active || [])
          .map((ins: any) => ({
            insuranceType: ins.insuranceType,
            // patient-insurance.service returns the resolved carrier under the
            // (confusingly named) `insuranceCompanyId` key, not `insuranceCompany`.
            // Accept either so this does not silently break if that is renamed.
            name: ins.insuranceCompany?.name ?? ins.insuranceCompanyId?.name ?? null,
          }))
          .filter((c) => !!c.name);
      } catch {
        // Coverage names are display-only. A failure here must not stop the
        // invoice from loading.
        coverages = [];
      }
    }

    return {
      invoice: {
        ...this.mapStatementToInvoice(invoice, meta),
        patient: patient ? mapPatientToApi(patient) : null,
        provider,
        insuranceCompany,
        secondaryInsuranceCompany,
        coverages,
        appointment,
        dateOfService: appointment?.appointmentDate ?? null,
      },
      items,
    };
  }

  async createInvoiceFromAppointment(
    appointmentId: string,
    data: {
      dueDate?: Date;
      insuranceCompanyId?: string;
      secondaryInsuranceCompanyId?: string;
      providerId?: string;
      notes?: string;
      copayAmount?: number;
      addClaim?: boolean;
    },
    createdBy: string
  ) {
    const appointment = await prisma.appointment.findUnique({
      where: { AptNum: BigInt(appointmentId) },
    });
    if (!appointment) throw new NotFoundError('Appointment not found');

    const existing = await prisma.statement.findFirst({
      where: { NoteBold: { contains: `"appointmentId":"${appointmentId}"` }, IsInvoice: 1 },
    });
    if (existing) throw new ConflictError('Invoice already exists for this appointment');

    const appointmentType = appointment.AppointmentTypeNum
      ? await prisma.appointmenttype.findUnique({
          where: { AppointmentTypeNum: appointment.AppointmentTypeNum },
        })
      : null;

    const invoiceNumber = await getInvoiceNumber();
    const statementNum = await getNextId('statement', 'StatementNum');
    const dueDate = data.dueDate ?? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    const meta: StatementMeta = {
      appointmentId,
      providerId: data.providerId ?? appointment.ProvNum?.toString(),
      insuranceCompanyId: data.insuranceCompanyId,
      secondaryInsuranceCompanyId: data.secondaryInsuranceCompanyId,
      copayAmount: data.copayAmount ?? 0,
      paidAmount: 0,
      taxAmount: 0,
      discountAmount: 0,
      status: 'draft',
      createdBy,
      dueDate: dueDate.toISOString(),
    };

    const statement = await prisma.statement.create({
      data: {
        StatementNum: statementNum,
        PatNum: appointment.PatNum ?? null,
        DateSent: new Date(),
        DateRangeFrom: appointment.AptDateTime ?? null,
        DateRangeTo: dueDate,
        Note: data.notes ?? null,
        NoteBold: buildJson(meta),
        IsInvoice: 1,
        StatementType: 'draft',
        ShortGUID: invoiceNumber,
        InsEst: 0,
        BalTotal: 0,
      },
    });

    if (appointmentType) {
      const unitPrice = 0;
      if (unitPrice > 0) {
        const procNum = await getNextId('procedurelog', 'ProcNum');
        await prisma.procedurelog.create({
          data: {
            ProcNum: procNum,
            PatNum: appointment.PatNum ?? null,
            AptNum: appointment.AptNum ?? null,
            ProcDate: appointment.AptDateTime ?? new Date(),
            ProcFee: unitPrice,
            UnitQty: 1,
            StatementNum: statement.StatementNum,
            ProcStatus: 1,
            BillingNote: buildJson({
              description: appointmentType.AppointmentTypeName ?? 'Consultation',
              unitPrice,
              quantity: 1,
              cptCode: null,
              serviceId: null,
            }),
          },
        });
        await this.recalculateInvoice(statement.StatementNum.toString());
      }
    }

    await logActivity(
      createdBy,
      'created',
      'invoices',
      statement.StatementNum.toString(),
      undefined,
      this.mapStatementToInvoice(statement, meta),
      undefined,
      undefined,
      'low'
    );

    // GENERATE CLAIM ONLY IF EXPLICITLY REQUESTED
    if (data.addClaim) {
      this.triggerClaimGeneration(statement.StatementNum, statement.PatNum, createdBy);
    }

    return this.mapStatementToInvoice(statement, meta);
  }

  async addInvoiceItem(
    invoiceId: string,
    data: {
      serviceId?: string;
      quantity?: number;
      unitPrice?: number;
      description?: string;
      cptCode?: string;
    },
    userId: string
  ) {
    const invoice = await this.getStatementById(invoiceId);
    if (!invoice) throw new NotFoundError('Invoice not found');

    const meta = parseJson<StatementMeta>(invoice.NoteBold);
    if (String(meta.status) !== 'draft') throw new BadRequestError('Only draft invoices can be modified');

    let service = null;
    if (data.serviceId) {
      service = await prisma.procedurecode.findFirst({
        where: {
          OR: [
            ...(toBigInt(data.serviceId) ? [{ CodeNum: toBigInt(data.serviceId)! }] : []),
            { ProcCode: data.serviceId },
          ],
        },
      });
      if (!service) throw new NotFoundError('Service not found');
    }

    if (!data.serviceId && (!data.description || data.unitPrice === undefined)) {
      throw new BadRequestError('Description and unit price are required for manual line items');
    }

    const quantity = data.quantity ?? 1;
    let unitPrice = data.unitPrice ?? 0;
    if (unitPrice === 0 && service?.CodeNum) {
      const feeSchedNum = await this.getDefaultFeeSchedNum();
      const fee = await prisma.fee.findFirst({ where: { CodeNum: service.CodeNum, FeeSched: feeSchedNum } });
      unitPrice = Number(fee?.Amount) || 0;
    }
    const totalPrice = roundCurrency(unitPrice * quantity);

    const procNum = await getNextId('procedurelog', 'ProcNum');
    const item = await prisma.procedurelog.create({
      data: {
        ProcNum: procNum,
        PatNum: invoice.PatNum ?? null,
        ProcDate: invoice.DateSent ?? new Date(),
        ProcFee: totalPrice,
        UnitQty: quantity,
        CodeNum: service?.CodeNum ?? null,
        StatementNum: invoice.StatementNum,
        ProcStatus: 1,
        BillingNote: buildJson({
          description: data.description ?? service?.Descript ?? 'Manual Item',
          unitPrice,
          quantity,
          cptCode: data.cptCode ?? service?.ProcCode ?? null,
          serviceId: service?.CodeNum?.toString() ?? null,
        }),
      },
    });

    await this.recalculateInvoice(invoiceId);
    const updatedItem = await prisma.procedurelog.findUnique({ where: { ProcNum: procNum } });
    await logActivity(userId, 'created', 'invoice_items', item.ProcNum.toString(), undefined, updatedItem || item, undefined, undefined, 'low');

    // AUTO-GENERATE CLAIM after adding item (if not already generated)
    this.triggerClaimGeneration(invoice.StatementNum, invoice.PatNum, userId);

    return this.mapProcedureLogToInvoiceItem(updatedItem || item, invoiceId, service);
  }

  async updateInvoiceItem(
    invoiceId: string,
    itemId: string,
    updates: Partial<{
      serviceId: string;
      quantity: number;
      unitPrice: number;
      description: string;
      cptCode: string;
      insPortion: number;
      secondaryInsPortion: number;
      ptPortion: number;
      writeoff: number;
      date?: string;
      provider?: string;
      site?: string;
      dbi?: boolean;
    }>,
    userId: string
  ) {
    const invoice = await this.getStatementById(invoiceId);
    if (!invoice) throw new NotFoundError('Invoice not found');

    const meta = parseJson<StatementMeta>(invoice.NoteBold);
    if (String(meta.status) !== 'draft') throw new BadRequestError('Only draft invoices can be modified');

    const procNum = toBigInt(itemId);
    if (!procNum) throw new NotFoundError('Invoice item not found');

    const item = await prisma.procedurelog.findUnique({ where: { ProcNum: procNum } });
    if (!item || item.StatementNum?.toString() !== invoiceId) throw new NotFoundError('Invoice item not found');

    let service = null;
    if (updates.serviceId) {
      service = await prisma.procedurecode.findFirst({
        where: {
          OR: [
            ...(toBigInt(updates.serviceId) ? [{ CodeNum: toBigInt(updates.serviceId)! }] : []),
            { ProcCode: updates.serviceId },
          ],
        },
      });
      if (!service) throw new NotFoundError('Service not found');
    }

    const currentMeta = parseJson<ItemMeta>(item.BillingNote);
    const quantity = updates.quantity ?? currentMeta.quantity ?? item.UnitQty ?? 1;
    let unitPrice = updates.unitPrice ?? currentMeta.unitPrice ?? (Number(item.ProcFee || 0) / (Number(item.UnitQty) || 1));
    if (updates.unitPrice === undefined && service?.CodeNum) {
      const feeSchedNum = await this.getDefaultFeeSchedNum();
      const fee = await prisma.fee.findFirst({ where: { CodeNum: service.CodeNum, FeeSched: feeSchedNum } });
      unitPrice = Number(fee?.Amount) || unitPrice;
    }
    const totalPrice = roundCurrency(unitPrice * quantity);

    const updated = await prisma.procedurelog.update({
      where: { ProcNum: procNum },
      data: {
        CodeNum: service?.CodeNum ?? item.CodeNum ?? null,
        UnitQty: quantity,
        ProcFee: totalPrice,
        ...(updates.date !== undefined && { ProcDate: updates.date ? new Date(updates.date) : null }),
        BillingNote: buildJson({
          ...currentMeta,
          description: updates.description ?? currentMeta.description ?? service?.Descript ?? 'Service',
          unitPrice,
          quantity,
          cptCode: updates.cptCode ?? currentMeta.cptCode ?? service?.ProcCode ?? null,
          serviceId: service?.CodeNum?.toString() ?? currentMeta.serviceId ?? null,
          ...(updates.insPortion !== undefined && {
            insPortion: updates.insPortion,
            // `insPortion` IS the primary portion (see payment.service.ts's
            // note on the two write paths agreeing), and the line-item reader
            // resolves primaryInsPortion as `meta.primaryInsPortion ||
            // meta.insPortion`. payment.service writes both, so a line that has
            // been through an insurance payment already carries an explicit
            // primaryInsPortion. Mirroring the value here keeps the two in step —
            // without this, editing the primary coverage would write insPortion,
            // leave the stale primaryInsPortion winning the read, and silently
            // discard the edit.
            primaryInsPortion: updates.insPortion,
          }),
          ...(updates.secondaryInsPortion !== undefined && { secondaryInsPortion: updates.secondaryInsPortion }),
          ...(updates.ptPortion !== undefined && { ptPortion: updates.ptPortion }),
          ...(updates.writeoff !== undefined && { writeoff: updates.writeoff }),
          ...(updates.provider !== undefined && { provider: updates.provider }),
          ...(updates.site !== undefined && { site: updates.site }),
          ...(updates.dbi !== undefined && { dbi: updates.dbi }),
          // When a caller explicitly writes any portion, treat the item as
          // manually adjusted so recalculateInvoice keeps these splits instead of
          // re-pricing (which would fold the whole balance into the patient portion).
          ...(updates.ptPortion !== undefined ||
          updates.insPortion !== undefined ||
          updates.secondaryInsPortion !== undefined ||
          updates.writeoff !== undefined
            ? { isManuallyAdjusted: true }
            : {}),
        }),
      },
    });

    await this.recalculateInvoice(invoiceId);
    const reFetchedUpdated = await prisma.procedurelog.findUnique({ where: { ProcNum: procNum } });
    await logActivity(userId, 'updated', 'invoice_items', itemId, item, reFetchedUpdated || updated, undefined, undefined, 'low');
    return this.mapProcedureLogToInvoiceItem(reFetchedUpdated || updated, invoiceId, service);
  }

  async deleteInvoiceItem(invoiceId: string, itemId: string, userId: string) {
    const invoice = await this.getStatementById(invoiceId);
    if (!invoice) throw new NotFoundError('Invoice not found');

    const meta = parseJson<StatementMeta>(invoice.NoteBold);
    if (String(meta.status) !== 'draft') throw new BadRequestError('Only draft invoices can be modified');

    const procNum = toBigInt(itemId);
    if (!procNum) throw new NotFoundError('Invoice item not found');

    const item = await prisma.procedurelog.findUnique({ where: { ProcNum: procNum } });
    if (!item || item.StatementNum?.toString() !== invoiceId) throw new NotFoundError('Invoice item not found');

    const linkedPlanItem = await prisma.proctp.findFirst({ where: { ProcNumOrig: procNum } });
    if (linkedPlanItem) {
      await prisma.procedurelog.update({ where: { ProcNum: procNum }, data: { StatementNum: null } });
    } else {
      await prisma.procedurelog.delete({ where: { ProcNum: procNum } });
    }
    await this.recalculateInvoice(invoiceId);
    await logActivity(userId, 'deleted', 'invoice_items', itemId, item, undefined, undefined, undefined, 'low');
    return { message: 'Invoice item deleted successfully' };
  }

  async deleteInvoice(invoiceId: string, userId: string) {
    const invoice = await this.getStatementById(invoiceId);
    if (!invoice) throw new NotFoundError('Invoice not found');

    const meta = parseJson<StatementMeta>(invoice.NoteBold);
    if (String(meta.status) !== 'draft') {
      throw new BadRequestError('Only draft invoices can be deleted. Use void for finalized invoices.');
    }

    await prisma.$transaction(async (tx) => {
      await applyTenantContextToTransaction(tx);
      const items = await tx.procedurelog.findMany({
        where: { StatementNum: invoice.StatementNum }, select: { ProcNum: true },
      });
      const linked = await tx.proctp.findMany({
        where: { ProcNumOrig: { in: items.map((item) => item.ProcNum) } },
        select: { ProcNumOrig: true },
      });
      const linkedNums = linked.map((item) => item.ProcNumOrig).filter((id): id is bigint => id != null);
      if (linkedNums.length) {
        await tx.procedurelog.updateMany({
          where: { ProcNum: { in: linkedNums }, StatementNum: invoice.StatementNum },
          data: { StatementNum: null },
        });
      }
      await tx.procedurelog.deleteMany({ where: { StatementNum: invoice.StatementNum } });
      await tx.statement.delete({ where: { StatementNum: invoice.StatementNum } });
    });
    await logActivity(userId, 'deleted', 'invoices', invoiceId, this.mapStatementToInvoice(invoice, meta), undefined, undefined, undefined, 'medium');
    return { message: 'Invoice deleted successfully' };
  }

  async updateInvoice(
    invoiceId: string,
    updates: Partial<{
      dueDate: Date;
      invoiceDate: Date;
      insuranceCompanyId: string;
      providerId: string;
      notes: string;
      discountAmount: number;
      copayAmount: number;
      status: 'draft' | 'pending' | 'submitted' | 'partially_paid' | 'paid' | 'denied' | 'void';
      insuranceCoveragePercent: number;
      insurancePortion: number;
      patientPortion: number;
    }>,
    userId: string
  ) {
    const invoice = await this.getStatementById(invoiceId);
    if (!invoice) throw new NotFoundError('Invoice not found');

    const meta = parseJson<StatementMeta>(invoice.NoteBold);
    if (String(meta.status) !== 'draft') throw new BadRequestError('Only draft invoices can be modified');

    const coveragePercent = updates.insuranceCoveragePercent;
    delete updates.insuranceCoveragePercent;

    const nextMeta: StatementMeta = {
      ...meta,
      insuranceCompanyId: updates.insuranceCompanyId ?? meta.insuranceCompanyId,
      providerId: updates.providerId ?? meta.providerId,
      discountAmount: updates.discountAmount ?? meta.discountAmount,
      copayAmount: updates.copayAmount ?? meta.copayAmount,
      insurancePortion: updates.insurancePortion ?? meta.insurancePortion,
      patientPortion: updates.patientPortion ?? meta.patientPortion,
      status: updates.status ?? meta.status,
      dueDate: updates.dueDate ? updates.dueDate.toISOString() : meta.dueDate,
    };

    const updated = await prisma.statement.update({
      where: { StatementNum: invoice.StatementNum },
      data: {
        Note: updates.notes ?? undefined,
        DateRangeTo: updates.dueDate ?? undefined,
        DateSent: updates.invoiceDate ?? undefined,
        StatementType: updates.status ?? undefined,
        NoteBold: buildJson(nextMeta),
      },
    });

    await this.recalculateInvoice(invoiceId, coveragePercent);
    await logActivity(userId, 'updated', 'invoices', invoiceId, this.mapStatementToInvoice(invoice, meta), this.mapStatementToInvoice(updated, nextMeta), undefined, undefined, 'low');
    return this.mapStatementToInvoice(updated, nextMeta);
  }

  /**
   * Plan-derived inputs for a coordination-of-benefits estimate.
   *
   * WHY THIS LIVES HERE AND NOT IN THE COB SERVICE
   * ----------------------------------------------
   * Everything below is resolved by this class's own pricing ladder:
   * `resolvePlanAllowedFee` for the contracted amount, `resolveCoveragePercent`
   * for the benefit percentage, and the plan's `DeductibleLedger` for what is
   * left of the deductible. Re-deriving any of them elsewhere would give the
   * COB estimate a second, divergent ladder — the exact failure
   * `resolveCoveragePercent`'s own comment warns about ("a secondary plan
   * priced by a different ladder would silently disagree with the primary on
   * the same procedure").
   *
   * So this is a narrow public read-only seam over the existing machinery
   * rather than new pricing logic.
   *
   * Returns null when the coverage is not priceable at all (no `insplan`),
   * which the caller must surface rather than quietly substituting zero — a
   * 0% benefit and an unknown benefit lead to very different conversations
   * with a patient.
   */
  async getCobEstimateBasis(
    patPlanNum: bigint | string,
    procedureCode: string,
  ): Promise<{
    allowedAmount: number | null;
    coveragePercent: number | null;
    deductibleRemaining: number;
    deductibleRowKey: string | null;
    planType: string | null;
    resolvedFrom: {
      allowedAmount: 'ALLOWED_FEE_SCHEDULE' | 'PPO_PLAN_FEE_SCHEDULE' | 'NOT_ON_SCHEDULE';
      coveragePercent: 'PLAN_COVERAGE_TABLE' | 'NOT_PRICEABLE';
    };
  } | null> {
    const code = String(procedureCode || '').toUpperCase().trim();
    if (!code) return null;

    const patPlan = await prisma.patplan.findUnique({
      where: { PatPlanNum: BigInt(patPlanNum as any) },
      include: { inssub: { include: { insplan: true } } },
    });
    if (!patPlan?.inssub?.insplan) return null;

    const ctx = await this.buildPlanPricingContext(patPlan);
    if (!ctx) return null;

    // Practice-wide, not per-plan — the same tables the invoice loop uses.
    const covSpans = await prisma.covspan.findMany();
    const covCats = await prisma.covcat.findMany();
    const covCatMap = new Map<string, string>();
    for (const cat of covCats) {
      if (cat.Description) {
        covCatMap.set(cat.CovCatNum.toString(), cat.Description.toLowerCase());
      }
    }

    const isCdtCode = /^D\d{4}/i.test(code) || /^\d{4}$/.test(code);
    const allowed = this.resolvePlanAllowedFee(code, ctx);
    const coveragePercent = this.resolveCoveragePercent(code, isCdtCode, ctx, covSpans, covCatMap);

    const { key: deductibleRowKey } = ctx.deductibleLedger.resolve(code);
    const deductibleRemaining = ctx.deductibleLedger.remaining(deductibleRowKey);

    return {
      allowedAmount: allowed ?? null,
      coveragePercent,
      deductibleRemaining,
      deductibleRowKey,
      planType: ctx.insPlan?.PlanType ?? null,
      resolvedFrom: {
        allowedAmount:
          allowed === undefined
            ? 'NOT_ON_SCHEDULE'
            : ctx.allowedFeeMap.has(code)
              ? 'ALLOWED_FEE_SCHEDULE'
              : 'PPO_PLAN_FEE_SCHEDULE',
        coveragePercent: 'PLAN_COVERAGE_TABLE',
      },
    };
  }

  async recalculateInvoice(invoiceId: string, insuranceCoveragePercent?: number, transaction?: Prisma.TransactionClient) {
    const db = transaction ?? prisma;
    const invoice = await db.statement.findUnique({ where: { StatementNum: BigInt(invoiceId) } });
    if (!invoice) throw new NotFoundError('Invoice not found');

    const meta = parseJson<StatementMeta>(invoice.NoteBold);
    const items = await db.procedurelog.findMany({ where: { StatementNum: invoice.StatementNum } });

    const codeNums = items.map((item) => item.CodeNum).filter((codeNum): codeNum is bigint => codeNum !== null && codeNum !== undefined);
    const codes = codeNums.length ? await db.procedurecode.findMany({ where: { CodeNum: { in: codeNums } } }) : [];
    const codeMap = new Map(codes.map((code) => [code.CodeNum?.toString(), code]));

    const totalAmount = items.reduce((sum, item) => sum + (Number(item.ProcFee) || 0), 0);
    const taxAmount = items.reduce((sum, item) => {
      const code = item.CodeNum ? codeMap.get(item.CodeNum.toString()) : null;
      const rate = code?.TaxCode ? Number.parseFloat(code.TaxCode) : 0;
      return sum + (Number(item.ProcFee) || 0) * ((Number.isFinite(rate) ? rate : 0) / 100);
    }, 0);

    const discountAmount = Math.min(Number(meta.discountAmount) || 0, totalAmount);
    const subtotal = totalAmount - discountAmount + taxAmount;

    const procNums = items.map((item) => item.ProcNum).filter((id): id is bigint => id !== null && id !== undefined);
    const invoiceIdStr = invoice.StatementNum.toString();

    // Check existing claimprocs for these procedures to see if any have been adjudicated/received
    const procClaimProcs = procNums.length > 0
      ? await db.claimproc.findMany({ where: { ProcNum: { in: procNums } } })
      : [];
    const claimProcByProcNum = new Map<string, typeof procClaimProcs>();
    procClaimProcs.forEach((cp) => {
      if (cp.ProcNum) {
        const key = cp.ProcNum.toString();
        const list = claimProcByProcNum.get(key) || [];
        list.push(cp);
        claimProcByProcNum.set(key, list);
      }
    });

    let pendingInsEst = 0;
    for (const cp of procClaimProcs) {
      if (cp.Status === 0) {
        pendingInsEst += Number(cp.InsPayEst) || 0;
      }
    }

    let insurancePortion = 0;
    let secondaryInsurancePortion = 0;
    if (insuranceCoveragePercent !== undefined) {
      insurancePortion = roundCurrency((subtotal * insuranceCoveragePercent) / 100);
    } else if (invoice.PatNum) {
      const simulatedItems = items.map(item => {
        const itemMeta = parseJson<any>(item.BillingNote);
        return {
          ...itemMeta,
          ProcFee: item.ProcFee,
          // Required: the deductible is a running balance consumed in
          // date-of-service order, so ProcDate must reach the estimator.
          ProcDate: item.ProcDate,
          serviceId: item.CodeNum?.toString(),
          noBillIns: item.NoBillIns === 1 || isPatientPenaltyOrNonIns(itemMeta) || isPatientPenaltyOrNonIns(item),
        };
      });
      // Exclude this invoice's own claim: it is re-pricing lines it already reserved.
      // Other invoices' claims are what must reduce the remaining pools.
      const enrichedSimulatedItems = await this.calculateInsuranceEstimates(
        invoice.PatNum,
        simulatedItems,
        { excludeInvoiceId: invoice.StatementNum, db: transaction },
      );
      
      for (let i = 0; i < enrichedSimulatedItems.length; i++) {
        const originalItem = items[i];
        const enrichedItem = enrichedSimulatedItems[i];
        const originalMeta = parseJson<any>(originalItem.BillingNote);
        const itemCps = claimProcByProcNum.get(originalItem.ProcNum.toString()) || [];
        const receivedCps = itemCps.filter((cp) => cp.Status === 1);

        const isPenalty = isPatientPenaltyOrNonIns(originalMeta) || isPatientPenaltyOrNonIns(originalItem) || originalItem.NoBillIns === 1;
        if (isPenalty) {
          const fee = Number(originalItem.ProcFee || 0);
          originalMeta.insPortion = 0;
          originalMeta.primaryInsPortion = 0;
          originalMeta.secondaryInsPortion = 0;
          originalMeta.totalInsPortion = 0;
          originalMeta.ptPortion = fee;
          originalMeta.writeoff = 0;
          originalMeta.estimatedWriteOff = 0;
          originalMeta.isPatientPenalty = true;
          originalMeta.patientOnly = true;
          originalMeta.isAccountPenalty = true;
          originalItem.BillingNote = buildJson(originalMeta);
          await db.procedurelog.update({
            where: { ProcNum: originalItem.ProcNum },
            data: { BillingNote: originalItem.BillingNote, NoBillIns: 1 }
          });
          continue;
        }

        if (originalMeta.isManuallyAdjusted) {
          insurancePortion += Number(originalMeta.insPortion || 0);
          secondaryInsurancePortion += Number(originalMeta.secondaryInsPortion || 0);
          continue;
        }

        if (receivedCps.length > 0) {
          // Insurance has adjudicated this item (potentially multiple claims).
          const insPaid = receivedCps.reduce((sum, cp) => sum + Number(cp.InsPayAmt || 0), 0);
          const wo = receivedCps.reduce((sum, cp) => sum + Number(cp.WriteOff || 0), 0);
          const fee = Number(originalItem.ProcFee || 0);

          // Check if patient has already paid in full for this procedure
          const existingSplits = await db.paysplit.findMany({
            where: { ProcNum: originalItem.ProcNum },
            include: { payment: true },
          });
          const ptPaidOnProc = existingSplits
            .filter(ps => {
              const pNote = parseJson<any>(ps.payment?.PayNote);
              const isIns = ps.payment?.PayNote?.includes('"insurance_company"') ||
                String(pNote?.paymentSource || '').toLowerCase() === 'insurance_company' ||
                String(pNote?.method || '').toLowerCase() === 'insurance';
              const st = String(pNote?.status || '').toLowerCase();
              return !isIns && st !== 'void' && st !== 'voided' && st !== 'reversed';
            })
            .reduce((s, ps) => s + (Number(ps.SplitAmt) || 0), 0);

          // Check if this procedure has a partial insurance payment or is linked to an active partial claim
          const hasPartialInsPayment = existingSplits.some(ps => {
            const pNote = parseJson<any>(ps.payment?.PayNote);
            const isIns = ps.payment?.PayNote?.includes('"insurance_company"') ||
              String(pNote?.paymentSource || '').toLowerCase() === 'insurance_company' ||
              String(pNote?.method || '').toLowerCase() === 'insurance';
            return isIns && pNote?.isPartialPayment === true;
          });

          let isClaimPartial = false;
          for (const rCp of receivedCps) {
            if (rCp.ClaimNum) {
              const linkedClaim = await db.claim.findUnique({ where: { ClaimNum: rCp.ClaimNum } });
              if (linkedClaim) {
                const cMeta = parseJson<any>(linkedClaim.Narrative);
                const cStatus = String(cMeta?.status || linkedClaim.ClaimStatus || '').toLowerCase();
                if (cStatus === 'partial' || cMeta?.isPartialPayment === true) {
                  isClaimPartial = true;
                }
              }
            }
          }

          const isPartial = hasPartialInsPayment || isClaimPartial;
          const initialPtPortion = Number(originalMeta.ptPortion || 0);
          const secPortion = Number(originalMeta.secondaryInsPortion || 0);

          let newPt = 0;
          let newIns = 0;

          if (isPartial) {
            // Partial payment:
            // Underpayment remains with insurance. Patient portion is preserved.
            newPt = initialPtPortion;
            newIns = Math.max(0, roundCurrency(fee - wo - initialPtPortion - secPortion));
          } else {
            // Scenario 2 guard: if the patient has already satisfied their
            // ORIGINAL responsibility, the underpayment stays with insurance —
            // keep ptPortion and leave the insurance portion at the expected
            // amount so expected − paid remains an insurance balance.
            const expectedIns = Number(originalMeta.insPortion || 0) > 0
              ? roundCurrency(Number(originalMeta.insPortion))
              : Math.max(0, roundCurrency(fee - wo - initialPtPortion - secPortion));
            const underpayment = Math.max(0, roundCurrency(expectedIns - insPaid));
            const patientAlreadyPaidInFull = ptPaidOnProc >= initialPtPortion - 0.005;

            if (patientAlreadyPaidInFull && underpayment > 0) {
              newPt = initialPtPortion;
              newIns = expectedIns;
            } else {
              // Final payment:
              // Underpayment shifts to patient responsibility. Insurance portion is finalized at insPaid.
              newPt = Math.max(0, roundCurrency(fee - wo - insPaid - secPortion));
              newIns = insPaid;
            }
          }

          insurancePortion += newIns;
          secondaryInsurancePortion += secPortion;
          originalMeta.insPortion = newIns;
          originalMeta.secondaryInsPortion = secPortion;
          originalMeta.writeoff = wo;
          originalMeta.ptPortion = newPt;
          originalMeta.isManuallyAdjusted = true;
          originalItem.BillingNote = buildJson(originalMeta);
          await db.procedurelog.update({
            where: { ProcNum: originalItem.ProcNum },
            data: { BillingNote: originalItem.BillingNote },
          });
          continue;
        }

        if (originalMeta.isManuallyAdjusted) {
          insurancePortion += Number(originalMeta.insPortion || 0);
          secondaryInsurancePortion += Number(originalMeta.secondaryInsPortion || 0);
          continue;
        }

        const enrichedPrim = Number(
          enrichedItem.primaryInsPortion ??
          (enrichedItem.secondaryInsPortion > 0 && enrichedItem.insPortion > enrichedItem.secondaryInsPortion
            ? enrichedItem.insPortion - enrichedItem.secondaryInsPortion
            : enrichedItem.insPortion) ??
          0
        );
        insurancePortion += enrichedPrim;
        secondaryInsurancePortion += Number(enrichedItem.secondaryInsPortion || 0);
        
        const writeoffChanged =
          originalMeta.writeoff !== enrichedItem.writeoff ||
          originalMeta.estimatedWriteOff !== enrichedItem.estimatedWriteOff ||
          originalMeta.allowedFee !== enrichedItem.allowedFee;

        // `deductibleApplied` is the number finalizeInvoice turns into permanent
        // `metAmount`, so it has to be persisted here alongside the portions.
        // Without this, BillingNote keeps a creation-time value while ptPortion
        // reflects the current deductible, and the invoice posts a stale amount.
        const deductibleChanged = Number(originalMeta.deductibleApplied || 0) !== Number(enrichedItem.deductibleApplied || 0);

        // A rule can be added or removed without moving any money — e.g. a plan
        // edits only its teeth limit, or the substitute's fee is identical. The
        // guard must notice the audit fields on their own, otherwise the change
        // is silently never persisted.
        const downgradeChanged =
          Boolean(originalMeta.downgraded) !== Boolean(enrichedItem.downgraded) ||
          (originalMeta.downgradedFrom ?? null) !== (enrichedItem.downgradedFrom ?? null) ||
          (originalMeta.effectiveCode ?? null) !== (enrichedItem.effectiveCode ?? null) ||
          (originalMeta.downgradeSkipped ?? null) !== (enrichedItem.downgradeSkipped ?? null);

        // The secondary is priced independently now, so it carries its own audit
        // trail that can change while every money field stays identical — the two
        // plans routinely disagree about the same procedure. Without these in the
        // guard, adding or removing a SECONDARY downgrade rule would be priced
        // correctly and then silently discarded, leaving BillingNote describing a
        // decision that was never stored.
        const secondaryAuditChanged =
          Boolean(originalMeta.secondaryNotEstimated) !== Boolean(enrichedItem.secondaryNotEstimated) ||
          Boolean(originalMeta.secondaryDowngraded) !== Boolean(enrichedItem.secondaryDowngraded) ||
          (originalMeta.secondaryDowngradedFrom ?? null) !== (enrichedItem.secondaryDowngradedFrom ?? null) ||
          (originalMeta.secondaryEffectiveCode ?? null) !== (enrichedItem.secondaryEffectiveCode ?? null) ||
          (originalMeta.secondaryDowngradeSkipped ?? null) !== (enrichedItem.secondaryDowngradeSkipped ?? null) ||
          (originalMeta.secondaryCoveragePct ?? null) !== (enrichedItem.secondaryCoveragePct ?? null);

        if (
          originalMeta.primaryInsPortion !== enrichedPrim ||
          originalMeta.insPortion !== enrichedPrim ||
          originalMeta.secondaryInsPortion !== enrichedItem.secondaryInsPortion ||
          originalMeta.ptPortion !== enrichedItem.ptPortion ||
          writeoffChanged ||
          deductibleChanged ||
          downgradeChanged ||
          secondaryAuditChanged ||
          (enrichedItem.coveragePct !== undefined && enrichedItem.coveragePct !== null &&
            Number(originalMeta.coveragePct ?? -1) !== Number(enrichedItem.coveragePct))
        ) {
          originalMeta.insPortion = enrichedPrim;
          originalMeta.primaryInsPortion = enrichedPrim;
          originalMeta.secondaryInsPortion = enrichedItem.secondaryInsPortion;
          originalMeta.totalInsPortion = enrichedPrim + Number(enrichedItem.secondaryInsPortion || 0);
          originalMeta.ptPortion = enrichedItem.ptPortion;
          originalMeta.insuranceExpected = originalMeta.totalInsPortion;
          originalMeta.insurancePaidAmount = Number(originalMeta.insurancePaidAmount) || 0;
          originalMeta.patientPaidAmount = Number(originalMeta.patientPaidAmount) || 0;
          originalMeta.insuranceBalance = Math.max(0, roundCurrency(originalMeta.totalInsPortion - originalMeta.insurancePaidAmount));
          // Persist write-off fields — fall back to existing value for non-PPO items
          // (where calculateInsuranceEstimates leaves the field undefined) so we never
          // accidentally zero out a manually-entered adjustment.
          originalMeta.writeoff = enrichedItem.writeoff ?? originalMeta.writeoff ?? 0;
          originalMeta.estimatedWriteOff = enrichedItem.estimatedWriteOff ?? originalMeta.estimatedWriteOff ?? 0;
          originalMeta.allowedFee = enrichedItem.allowedFee ?? originalMeta.allowedFee ?? null;
          originalMeta.allowedFeeSource = enrichedItem.allowedFeeSource === 'plan' ? 'plan' : null;
          originalMeta.coveragePct = enrichedItem.coveragePct !== undefined && enrichedItem.coveragePct !== null ? Number(enrichedItem.coveragePct) : (originalMeta.coveragePct ?? null);
          originalMeta.deductibleApplied = roundCurrency(Number(enrichedItem.deductibleApplied || 0));
          if (enrichedItem.deductibleRowKey) originalMeta.deductibleRowKey = enrichedItem.deductibleRowKey;
          // Persist the downgrade audit fields on re-price. Guarded so a line
          // that no longer has a rule (rule removed, or a tooth fell outside the
          // limit) clears the stale values instead of keeping them forever.
          originalMeta.downgraded = Boolean(enrichedItem.downgraded);
          originalMeta.downgradedFrom = enrichedItem.downgradedFrom ?? null;
          originalMeta.effectiveCode = enrichedItem.effectiveCode ?? null;
          originalMeta.downgradeSkipped = enrichedItem.downgradeSkipped ?? null;
          // The secondary's audit trail, written on exactly the same terms as the
          // primary's above: null rather than the previous value when the rule is
          // gone, so a re-estimate can never leave a stale badge behind.
          originalMeta.secondaryNotEstimated = Boolean(enrichedItem.secondaryNotEstimated);
          originalMeta.secondaryDowngraded = Boolean(enrichedItem.secondaryDowngraded);
          originalMeta.secondaryDowngradedFrom = enrichedItem.secondaryDowngradedFrom ?? null;
          originalMeta.secondaryEffectiveCode = enrichedItem.secondaryEffectiveCode ?? null;
          originalMeta.secondaryDowngradeSkipped = enrichedItem.secondaryDowngradeSkipped ?? null;
          originalMeta.secondaryCoveragePct =
            enrichedItem.secondaryCoveragePct === undefined || enrichedItem.secondaryCoveragePct === null
              ? null
              : Number(enrichedItem.secondaryCoveragePct);
          originalItem.BillingNote = buildJson(originalMeta);
          await db.procedurelog.update({
            where: { ProcNum: originalItem.ProcNum },
            data: { BillingNote: originalItem.BillingNote }
          });
        }
      }
    } else {
      insurancePortion = Number(meta.insurancePortion) || 0;
      secondaryInsurancePortion = Number(meta.secondaryInsurancePortion) || 0;
    }

    const totalWriteOff = items.reduce((sum, item) => {
      const itemMeta = parseJson<any>(item.BillingNote);
      return sum + (Number(itemMeta.writeoff) || 0);
    }, 0);

    const patientPortion = roundCurrency(items.reduce((sum, item) => {
      const itemMeta = parseJson<any>(item.BillingNote);
      return sum + (Number(itemMeta.ptPortion) || 0);
    }, 0));

    // Query actual paysplits for these procedures to ensure paidAmount is completely accurate
    const procPaysplits = procNums.length > 0
      ? await db.paysplit.findMany({
          where: { ProcNum: { in: procNums } },
          include: { payment: true },
        })
      : [];
    const paysplitByProcNum = new Map<string, number>();
    procPaysplits.forEach((ps) => {
      if (ps.ProcNum) {
        const key = ps.ProcNum.toString();
        const pNote = parseJson<any>(ps.payment?.PayNote);
        const st = String(pNote?.status || '').toLowerCase();
        if (st !== 'void' && st !== 'voided' && st !== 'reversed') {
          paysplitByProcNum.set(key, (paysplitByProcNum.get(key) || 0) + (Number(ps.SplitAmt) || 0));
        }
      }
    });

    let totalPaid = 0;
    for (const item of items) {
      const itemMeta = parseJson<any>(item.BillingNote);
      const splitTotal = paysplitByProcNum.get(item.ProcNum.toString());
      const itemPaid = splitTotal !== undefined ? roundCurrency(splitTotal) : (Number(itemMeta.paidAmount) || 0);
      totalPaid += itemPaid;
      if (itemMeta.paidAmount !== itemPaid) {
        itemMeta.paidAmount = itemPaid;
        item.BillingNote = buildJson(itemMeta);
        await db.procedurelog.update({
          where: { ProcNum: item.ProcNum },
          data: { BillingNote: item.BillingNote },
        });
      }
    }
    totalPaid = roundCurrency(totalPaid);

    // Fetch all formally posted adjustments associated with this invoice
    const adjustments = await db.adjustment.findMany({
      where: {
        OR: [
          { StatementNum: invoice.StatementNum },
          ...(procNums.length > 0 ? [{ ProcNum: { in: procNums } }] : []),
          { AdjNote: { contains: `Invoice #${invoiceIdStr}` } },
        ],
      },
    });

    const totalAdjustments = adjustments.reduce((sum, adj) => {
      if (adj.AdjNote && adj.AdjNote.toLowerCase().includes('income transfer')) {
        return sum;
      }
      return sum + Math.abs(Number(adj.AdjAmt) || 0);
    }, 0);

    // Balance due is the gross charge (subtotal) minus payments only.
    // Write-offs/adjustments are tracked separately and shown as a separate payable line item.
    // This shows the gross charge as the balance, with write-offs tracked as a separate payable amount.
    const balanceDue = roundCurrency(Math.max(0, subtotal - totalPaid));
    const nextMeta: StatementMeta = {
      ...meta,
      totalAmount: roundCurrency(totalAmount),
      writeoffAmount: roundCurrency(totalWriteOff),
      adjustmentAmount: roundCurrency(totalAdjustments),
      taxAmount: roundCurrency(taxAmount),
      discountAmount: roundCurrency(discountAmount),
      insurancePortion,
      secondaryInsurancePortion,
      patientPortion,
      paidAmount: totalPaid,
    };

    const totalInsPaid = procClaimProcs
      .filter((cp) => cp.Status === 1)
      .reduce((sum, cp) => sum + (Number(cp.InsPayAmt) || 0), 0);

    const totalExpectedIns = roundCurrency(insurancePortion + secondaryInsurancePortion);
    const hasAnyClaimProc = procClaimProcs.length > 0;
    const unclaimedIns = Math.max(0, roundCurrency(totalExpectedIns - totalInsPaid - pendingInsEst));
    const remainingInsEst = hasAnyClaimProc ? roundCurrency(pendingInsEst + unclaimedIns) : totalExpectedIns;

    const updated = await db.statement.update({
      where: { StatementNum: invoice.StatementNum },
      data: { BalTotal: roundCurrency(balanceDue), InsEst: roundCurrency(remainingInsEst), NoteBold: buildJson(nextMeta) },
    });

    if (invoice.PatNum && !transaction) {
      await agingService.updatePatientAging(invoice.PatNum).catch(() => {});
    }

    return this.mapStatementToInvoice(updated, nextMeta);
  }

  async getInvoicesByPatient(patientId: string, page = 1, limit = 10) {
    return this.getAllInvoices(page, limit, { patientId });
  }

  async getPatientBalance(patientId: string) {
    const rows = await prisma.statement.findMany({
      where: { IsInvoice: 1, PatNum: BigInt(patientId) },
      select: { BalTotal: true },
    });
    const totalBalance = rows.reduce((sum, row) => sum + (Number(row.BalTotal) || 0), 0);
    const openInvoices = rows.filter((row) => Number(row.BalTotal) > 0).length;
    return { patientId, totalBalance: roundCurrency(totalBalance), openInvoices };
  }

  /**
  /**
   * Sum `deductibleApplied` for all procedures, grouped by deductible row.
   *
   * By posting the deductible to `metAmount` immediately upon invoice finalization,
   * subsequent invoices generated for the patient will correctly see the deductible
   * as met, even if the insurance claim for this invoice hasn't been generated
   * or submitted yet.
   * 
   * When a claim is later generated, it will store these estimated amounts in
   * its own `deductibleReservedByRow` for the ERA to reconcile, but the claim
   * lifecycle itself no longer advances `metAmount` (to prevent double-counting).
   */
  private async collectUncoveredDeductibleByRow(
    statementNum: bigint,
  ): Promise<Record<string, number>> {
    const items = await prisma.procedurelog.findMany({
      where: { StatementNum: statementNum },
      select: { BillingNote: true, NoBillIns: true },
    });

    const byRow: Record<string, number> = {};
    for (const item of items) {
      const bn = parseJson<any>(item.BillingNote);
      const applied = roundCurrency(Number(bn.deductibleApplied || 0));
      if (applied <= 0) continue;

      if (isPatientPenaltyOrNonIns(bn) || isPatientPenaltyOrNonIns(item)) continue;

      const key = String(bn.deductibleRowKey || '');
      if (!key) continue;

      byRow[key] = roundCurrency((byRow[key] ?? 0) + applied);
    }
    return byRow;
  }

  async finalizeInvoice(invoiceId: string, userId: string) {
    const invoice = await this.getStatementById(invoiceId);
    if (!invoice) throw new NotFoundError('Invoice not found');

    const meta = parseJson<StatementMeta>(invoice.NoteBold);
    const status = String(meta.status);
    const isDraft = status === 'draft';
    const isUnpostedFinal = status === 'pending' && !meta.deductiblePostedAt;
    if (!isDraft && !isUnpostedFinal) throw new BadRequestError('Only draft invoices can be finalized');

    await this.recalculateInvoice(invoiceId);

    const patPlan = invoice.PatNum ? await prisma.patplan.findFirst({
      where: { PatNum: invoice.PatNum, OR: [{ IsPending: 0 }, { IsPending: null }] },
      orderBy: { Ordinal: 'asc' },
      select: { PatPlanNum: true },
    }) : null;

    let byRow: Record<string, number> = {};
    if (patPlan?.PatPlanNum) {
      byRow = await this.collectUncoveredDeductibleByRow(invoice.StatementNum);
      if (Object.keys(byRow).length > 0) {
        await patientInsuranceService.applyDeductibleMetAmountDelta(
          patPlan.PatPlanNum,
          byRow,
          invoice.DateSent ?? new Date(),
        );
      }
    }

    const nextMeta: StatementMeta = {
      ...meta,
      status: 'pending',
      deductiblePostedAt: new Date().toISOString(),
      deductiblePostedByRow: byRow,
    };

    const updated = await prisma.statement.update({
      where: { StatementNum: invoice.StatementNum },
      data: { StatementType: 'pending', NoteBold: buildJson(nextMeta) },
    });

    await logActivity(userId, 'updated', 'invoices', invoiceId, this.mapStatementToInvoice(invoice, meta), this.mapStatementToInvoice(updated, nextMeta), undefined, undefined, 'low');

    return this.mapStatementToInvoice(updated, nextMeta);
  }

  async voidInvoice(invoiceId: string, reason: string | undefined, userId: string) {
    const invoice = await this.getStatementById(invoiceId);
    if (!invoice) throw new NotFoundError('Invoice not found');

    const meta = parseJson<StatementMeta>(invoice.NoteBold);
    if (String(meta.status) === 'void') throw new BadRequestError('Invoice is already void');

    let nextMeta: StatementMeta = { ...meta, status: 'void', voidReason: reason ?? meta.voidReason };

    if (meta.deductiblePostedAt && meta.deductiblePostedByRow && Object.keys(meta.deductiblePostedByRow).length > 0) {
      const patPlan = invoice.PatNum ? await prisma.patplan.findFirst({
        where: { PatNum: invoice.PatNum, OR: [{ IsPending: 0 }, { IsPending: null }] },
        orderBy: { Ordinal: 'asc' },
        select: { PatPlanNum: true },
      }) : null;

      if (patPlan?.PatPlanNum) {
        const reversed = Object.fromEntries(
          Object.entries(meta.deductiblePostedByRow).map(([key, amount]) => [key, roundCurrency(-amount)])
        );
        await patientInsuranceService.applyDeductibleMetAmountDelta(
          patPlan.PatPlanNum,
          reversed,
          invoice.DateSent ?? new Date(),
        );
      }
      const { deductiblePostedAt: _at, deductiblePostedByRow: _byRow, ...rest } = nextMeta;
      nextMeta = rest;
    } else if (meta.deductiblePostedAt) {
      const { deductiblePostedAt: _at, deductiblePostedByRow: _byRow, ...rest } = nextMeta;
      nextMeta = rest;
    }

    const updated = await prisma.statement.update({
      where: { StatementNum: invoice.StatementNum },
      data: { StatementType: 'void', NoteBold: buildJson(nextMeta) },
    });

    await logActivity(userId, 'updated', 'invoices', invoiceId, this.mapStatementToInvoice(invoice, meta), this.mapStatementToInvoice(updated, nextMeta), undefined, undefined, 'medium');
    return this.mapStatementToInvoice(updated, nextMeta);
  }

  async createStandaloneInvoice(
    data: {
      patientId: string;
      appointmentId?: string | number;
      items: Array<{
        id?: string;        // ProcNum of an existing unbilled record, if present
        code: string;
        description: string;
        date?: string;
        site?: string;
        provider?: string;
        writeoff?: number;
        ptPortion?: number;
        insPortion?: number;
        primaryInsPortion?: number;
        secondaryInsPortion?: number;
        totalInsPortion?: number;
        charge?: number;
        balance?: number;
        dbi?: boolean;
        completed?: boolean;
        // The line's contracted/basis allowed fee (the downgraded code's
        // allowed fee when a downgrade rule applied). Written through to the
        // procedure's BillingNote meta so downstream readers can display it.
        allowedFee?: number;
        coveragePct?: number;
        // Alternate-benefit (downgrade) audit trail, set by the pricing loop.
        downgraded?: boolean;
        downgradedFrom?: string;
        effectiveCode?: string;
        downgradeSkipped?: string | null;
        // Where the line's `allowedFee` came from. 'plan' means the pricing loop
        // derived it from the plan's schedule; null means manual/unknown. Used to
        // stop a previously-saved contracted fee from being treated as a manual
        // override on subsequent estimates.
        allowedFeeSource?: string | null;
        // The secondary payer could not be independently estimated for this line —
        // its plan context was unavailable, or its own downgrade rule matched but
        // had no fee for the substitute. The $0 is a conservative placeholder,
        // not a determination, so the UI must not present it as a real secondary
        // benefit of zero. A downgraded PRIMARY no longer sets this.
        secondaryNotEstimated?: boolean;
        /** The secondary plan's own alternate-benefit audit trail. */
        secondaryDowngraded?: boolean;
        secondaryDowngradedFrom?: string | null;
        secondaryEffectiveCode?: string | null;
        secondaryDowngradeSkipped?: string | null;
        secondaryCoveragePct?: number | null;
        /** Late-fee provenance — see late-fee.service.ts. */
        lateFeeSourceStatement?: string | number | null;
        lateFeeTier?: number | null;
        lateFeeBaseAmount?: number | null;
      }>;
      addClaim?: boolean;
      branchId?: string;
      /** Statement-level note. Defaults to 'Standalone Invoice'. */
      notes?: string;
    },
    createdBy: string
  ) {
    const patientId = BigInt(data.patientId);
    const patient = await prisma.patient.findUnique({ where: { PatNum: patientId } });
    if (!patient) throw new NotFoundError('Patient not found');

    const resolvedAptNum: bigint | null = data.appointmentId != null ? toBigInt(String(data.appointmentId)) : null;

    const invoiceNumber = await getInvoiceNumber();
    const statementNum = await getNextId('statement', 'StatementNum');
    const dueDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    const secondaryPlan = await prisma.patplan.findFirst({
      where: { PatNum: patientId, Ordinal: 2, OR: [{ IsPending: 0 }, { IsPending: null }] }
    });
    const hasSecondary = Boolean(secondaryPlan);

    let totalAmount = 0;
    let totalInsPortion = 0;
    let totalSecondaryInsPortion = 0;
    let totalPtPortion = 0;
    let totalWriteoff = 0;

    for (const item of data.items) {
      const isPenalty = isPatientPenaltyOrNonIns(item);
      let ptPortion = Number(item.ptPortion ?? 0);
      let secPortion = Number(item.secondaryInsPortion ?? 0);
      let totalIns = Number(item.totalInsPortion ?? item.insPortion ?? 0);
      let primPortion = Number(
        item.primaryInsPortion ??
        (totalIns > secPortion && secPortion > 0 ? totalIns - secPortion : totalIns) ??
        0
      );

      if (isPenalty) {
        ptPortion = Number(item.charge ?? 0);
        secPortion = 0;
        primPortion = 0;
        totalIns = 0;
      } else if (hasSecondary) {
        // If patient has secondary insurance: transfer patient portion into secondaryInsPortion and make ptPortion = 0
        if (secPortion === 0 && ptPortion > 0) {
          secPortion = ptPortion;
          ptPortion = 0;
        } else if (secPortion > 0) {
          ptPortion = 0;
        }
      }

      item.ptPortion = ptPortion;
      item.insPortion = primPortion;
      item.primaryInsPortion = primPortion;
      item.secondaryInsPortion = secPortion;
      item.totalInsPortion = primPortion + secPortion;

      totalAmount += Number(item.charge ?? 0);
      totalInsPortion += primPortion;
      totalSecondaryInsPortion += secPortion;
      totalPtPortion += ptPortion;
      totalWriteoff += Number(item.writeoff ?? 0);
    }

    const activePolicy = patient.ClinicNum
      ? await prisma.lateFeePolicy.findFirst({
          where: { clinicId: patient.ClinicNum, isActive: true, enabled: true },
          select: { id: true },
        })
      : null;

    const meta: StatementMeta = {
      appointmentId: resolvedAptNum ? resolvedAptNum.toString() : undefined,
      copayAmount: 0,
      paidAmount: 0,
      taxAmount: 0,
      discountAmount: 0,
      insurancePortion: roundCurrency(totalInsPortion),
      secondaryInsurancePortion: roundCurrency(totalSecondaryInsPortion),
      patientPortion: roundCurrency(totalPtPortion),
      totalAmount: roundCurrency(totalAmount),
      writeoffAmount: roundCurrency(totalWriteoff),
      status: 'draft',
      createdBy,
      dueDate: dueDate.toISOString(),
      lateFeePolicyVersionId: activePolicy?.toString(),
    };

    const statement = await prisma.statement.create({
      data: {
        StatementNum: statementNum,
        PatNum: patientId,
        DateSent: new Date(),
        DateRangeFrom: new Date(),
        DateRangeTo: dueDate,
        Note: data.notes || 'Standalone Invoice',
        NoteBold: buildJson(meta),
        IsInvoice: 1,
        StatementType: 'draft',
        ShortGUID: invoiceNumber,
        InsEst: roundCurrency(totalInsPortion + totalSecondaryInsPortion),
        BalTotal: totalAmount,
        lateFeePolicyVersionId: activePolicy?.id ?? null,
      },
    });

    for (const item of data.items) {
      const service = await prisma.procedurecode.findFirst({ where: { ProcCode: item.code } });

      let provNum: bigint | null = null;
      if (item.provider) {
        if (/^\d+$/.test(item.provider)) {
           const prov = await prisma.provider.findUnique({ where: { ProvNum: BigInt(item.provider) } });
           if (prov) provNum = prov.ProvNum;
        }
        if (!provNum) {
           const nameParts = item.provider.trim().split(' ');
           const lastName = nameParts[nameParts.length - 1];
           const prov = await prisma.provider.findFirst({ where: { LName: { contains: lastName, mode: 'insensitive' } } });
           if (prov) provNum = prov.ProvNum;
        }
      }

      let parsedTooth = '';
      let parsedSurf = '';
      if (item.site && item.site !== 'None') {
        const match = item.site.match(/^([^(]+)(?:\(([^)]+)\))?$/);
        if (match) {
          parsedTooth = match[1].trim();
          if (match[2]) {
            parsedSurf = match[2].trim();
          }
        } else {
          parsedTooth = item.site.trim();
        }
      }

      const toothNum = parsedTooth.length > 0 && parsedTooth.length <= 2 ? parsedTooth : null;
      const toothRange = parsedTooth.length > 2 ? parsedTooth : null;
      const surf = parsedSurf.length > 0 ? parsedSurf : null;

      const isPenalty = isPatientPenaltyOrNonIns(item);
      const billingNote = buildJson({
        description: item.description,
        unitPrice: Number(item.charge ?? 0),
        quantity: 1,
        cptCode: item.code,
        serviceId: service?.CodeNum?.toString() ?? null,
        site: item.site ?? 'None',
        provider: item.provider ?? 'Default',
        writeoff: isPenalty ? 0 : Number(item.writeoff ?? 0),
        ptPortion: isPenalty ? Number(item.charge ?? 0) : Number(item.ptPortion ?? 0),
        insPortion: isPenalty ? 0 : Number(item.insPortion ?? 0),
        primaryInsPortion: isPenalty ? 0 : Number(item.primaryInsPortion ?? item.insPortion ?? 0),
        // Provenance for `allowedFee`: 'plan' when the estimator derived it from
        // the plan's schedule, absent/manual otherwise. Without this marker,
        // every re-estimate treats the previous contracted fee as a manual
        // override and it can never be re-derived.
        allowedFee: isPenalty ? null : (item.allowedFee !== undefined && item.allowedFee !== null && Number(item.allowedFee) > 0 ? Number(item.allowedFee) : null),
        allowedFeeSource: item.allowedFeeSource === 'plan' ? 'plan' : null,
        secondaryInsPortion: isPenalty ? 0 : Number(item.secondaryInsPortion ?? 0),
        secondaryNotEstimated: Boolean(item.secondaryNotEstimated),
        // The secondary's own downgrade trail. Kept separate from the primary's
        // above because the two plans routinely disagree about the same
        // procedure — collapsing them would hide exactly the difference that
        // matters when a claim comes back short.
        secondaryDowngraded: Boolean(item.secondaryDowngraded),
        secondaryDowngradedFrom: item.secondaryDowngradedFrom ?? null,
        secondaryEffectiveCode: item.secondaryEffectiveCode ?? null,
        secondaryDowngradeSkipped: item.secondaryDowngradeSkipped ?? null,
        secondaryCoveragePct:
          item.secondaryCoveragePct === undefined || item.secondaryCoveragePct === null
            ? null
            : Number(item.secondaryCoveragePct),
        totalInsPortion: isPenalty ? 0 : Number(item.totalInsPortion ?? (Number(item.insPortion ?? 0) + Number(item.secondaryInsPortion ?? 0))),
        coveragePct: isPenalty ? null : (item.coveragePct ?? null),
        charge: Number(item.charge ?? 0),
        balance: Number(item.balance ?? 0),
        dbi: Boolean(item.dbi),
        completed: Boolean(item.completed),
        // Alternate-benefit (downgrade) audit trail. The billed code above is
        // unchanged — `effectiveCode` is only the procedure the plan may
        // substitute, and `downgradeSkipped` records a rule that matched but
        // could not be priced.
        downgraded: Boolean(item.downgraded),
        downgradedFrom: item.downgradedFrom ?? null,
        effectiveCode: item.effectiveCode ?? null,
        downgradeSkipped: item.downgradeSkipped ?? null,
        isPatientPenalty: isPenalty,
        patientOnly: isPenalty || Boolean((item as any).patientOnly),
        isAccountPenalty: isPenalty || Boolean((item as any).isAccountPenalty),
        // Late-fee provenance. These three keys are the only record that a
        // given source invoice has already been charged a given tier, so they
        // are what makes the duplicate check in late-fee.service.ts possible.
        // They live in BillingNote rather than in columns because every
        // recalculateInvoice path parses BillingNote, mutates its own keys and
        // re-serializes the whole object (:2291, :2500, :2549) — so unknown
        // keys survive re-estimation instead of being wiped by a whitelist.
        lateFeeSourceStatement: (item as any).lateFeeSourceStatement != null
          ? String((item as any).lateFeeSourceStatement)
          : null,
        lateFeeTier: (item as any).lateFeeTier != null
          ? Number((item as any).lateFeeTier)
          : null,
        lateFeeBaseAmount: (item as any).lateFeeBaseAmount != null
          ? Number((item as any).lateFeeBaseAmount)
          : null,
      });

      // If item carries an existing ProcNum (unbilled product), update it in-place
      // instead of creating a duplicate record.
      const existingProcNum = item.id && /^\d+$/.test(item.id) ? toBigInt(item.id) : null;
      let existingRecord = existingProcNum
        ? await prisma.procedurelog.findUnique({ where: { ProcNum: existingProcNum } })
        : null;

      if (!existingRecord && resolvedAptNum) {
        // First look for unbilled procedure on this appointment
        existingRecord = await prisma.procedurelog.findFirst({
          where: {
            AptNum: resolvedAptNum,
            StatementNum: null,
            ProcStatus: { not: 6 },
            OR: [
              service?.CodeNum ? { CodeNum: service.CodeNum } : undefined,
              { BillingNote: { contains: item.code } },
              { BillingNote: { contains: item.description } },
            ].filter(Boolean) as any,
          },
        });

        // If no unbilled procedure, check if a procedure already exists on this appointment
        // with the same code/description (e.g. from an earlier draft invoice attempt)
        // so we reuse it rather than duplicating procedures on the appointment
        if (!existingRecord) {
          existingRecord = await prisma.procedurelog.findFirst({
            where: {
              AptNum: resolvedAptNum,
              ProcStatus: { not: 6 },
              OR: [
                service?.CodeNum ? { CodeNum: service.CodeNum } : undefined,
                { BillingNote: { contains: item.code } },
                { BillingNote: { contains: item.description } },
              ].filter(Boolean) as any,
            },
            orderBy: { StatementNum: 'asc' },
          });
        }
      }

      if (existingRecord) {
        // Link the existing record to the new invoice — marks it as "billed"
        await prisma.procedurelog.update({
          where: { ProcNum: existingRecord.ProcNum },
          data: {
            StatementNum: statementNum,
            AptNum: resolvedAptNum ?? existingRecord.AptNum,
            ProcStatus: item.completed ? 2 : 1,
            ProvNum: provNum ?? existingRecord.ProvNum,
            BillingNote: billingNote,
            NoBillIns: isPenalty ? 1 : existingRecord.NoBillIns,
          },
        });
      } else {
        // No existing record — create a brand-new procedure log entry
        const procNum = await getNextId('procedurelog', 'ProcNum');
        await prisma.procedurelog.create({
          data: {
            ProcNum: procNum,
            PatNum: patientId,
            AptNum: resolvedAptNum,
            ProvNum: provNum,
            ClinicNum: data.branchId ? BigInt(data.branchId) : null,
            ProcDate: item.date ? new Date(item.date) : new Date(),
            ProcFee: Number(item.charge ?? 0),
            UnitQty: 1,
            CodeNum: service?.CodeNum ?? null,
            StatementNum: statementNum,
            ProcStatus: item.completed ? 2 : 1,
            ToothNum: toothNum,
            ToothRange: toothRange,
            Surf: surf,
            BillingNote: billingNote,
            NoBillIns: isPenalty ? 1 : null,
          },
        });
      }
    }

    // Link any remaining unbilled procedures on the appointment to this statement
    if (resolvedAptNum) {
      await prisma.procedurelog.updateMany({
        where: {
          AptNum: resolvedAptNum,
          StatementNum: null,
          ProcStatus: { not: 6 },
        },
        data: {
          StatementNum: statementNum,
        },
      });
    }

    await this.recalculateInvoice(statementNum.toString());

    const finalStatement = await prisma.statement.findUnique({ where: { StatementNum: statementNum } });
    const finalMeta = parseJson<StatementMeta>(finalStatement?.NoteBold);

    await logActivity(createdBy, 'created', 'invoices', statementNum.toString(), undefined, this.mapStatementToInvoice(finalStatement, finalMeta), undefined, undefined, 'medium');

    // GENERATE CLAIM ONLY IF EXPLICITLY REQUESTED AND THERE IS INSURANCE TO BILL
    if (data.addClaim && totalInsPortion > 0) {
      this.triggerClaimGeneration(statementNum, patientId, createdBy);
    }

    await agingService.updatePatientAging(patientId);

    return this.mapStatementToInvoice(finalStatement, finalMeta);
  }

  /**
   * Invoices eligible for a late-fee tier, for the dialog to render.
   *
   * Uses the same helpers as applyLateFee so the rows the user sees can never
   * disagree with what the charge will accept. `alreadyCharged` is included
   * because the provenance behind it is not exposed by the normal invoice
   * shape, so the frontend has no way to work it out itself.
   */
  async getLateFeeEligibility(patientId: string, tier: number | null) {
    // undefined means the tier was supplied but invalid; null means "any
    // overdue invoice", which is what flat-rate and percentage use.
    const resolved = lateFee.resolveTier(tier);
    if (resolved === undefined) {
      throw new BadRequestError(`Invalid late-fee tier: ${tier}. Expected one of ${lateFee.LATE_FEE_TIERS.join(', ')}.`);
    }

    const patNum = BigInt(patientId);
    const patient = await prisma.patient.findUnique({ where: { PatNum: patNum } });
    if (!patient) throw new NotFoundError('Patient not found');

    const statements = await prisma.statement.findMany({
      where: { PatNum: patNum, IsInvoice: 1 },
      orderBy: { StatementNum: 'desc' },
    });

    const invoices = statements.map((statement) => {
      const meta = parseJson<StatementMeta>(statement.NoteBold);
      const mapped = this.mapStatementToInvoice(statement, meta);
      const split = lateFee.outstandingSplit({
        balTotal: statement.BalTotal,
        insEst: statement.InsEst,
        writeoffAmount: meta.writeoffAmount,
      });
      return {
        ...mapped,
        patientPortion: split.patientRemaining,
        insuranceWriteOff: split.insuranceWriteOff,
        insuranceBalance: split.insuranceRemaining,
        patientRemaining: split.patientRemaining,
        balanceDue: split.totalOwing,
      };
    });

    const charged = await lateFee.findChargedLateFees(patNum);
    const eligible = lateFee.eligibleInvoices(invoices, resolved, charged);

    return {
      tier: resolved,
      // Sent to the dialog so the amount it previews is the amount the server
      // will charge, rather than a second copy of these numbers in the UI.
      defaultRate: lateFee.defaultRateFor(resolved),
      invoices: eligible.map((row) => ({
        id: row.id,
        invoiceNumber: row.invoiceNumber,
        invoiceDate: row.invoiceDate,
        daysOutstanding: row.daysOutstanding,
        tier: row.tier,
        // The four ledger columns: insurance write-off, then what each party
        // still owes, then the total.
        insuranceWriteOff: row.insuranceWriteOff ?? 0,
        patientBalance: row.basisPatient,
        insuranceBalance: row.insuranceBalance ?? 0,
        totalBalance: row.basisTotal,
        alreadyCharged: row.alreadyCharged,
      })),
      // Everything sent, so the dialog can explain why nothing is eligible.
      totalInvoices: invoices.length,
    };
  }

  /**
   * Apply late fees for a tier to a set of source invoices.
   *
   * Everything is recomputed here from the database rather than trusted from the
   * request: ages, buckets, balances and the duplicate check. The dialog is a
   * display convenience, not the enforcement point — otherwise a crafted
   * request could charge a fee for an invoice that isn't 30 days overdue, or
   * charge the same tier twice.
   *
   * All fees land on ONE standalone invoice with a line per source invoice, so
   * the patient gets a single statement instead of N. Each line carries its own
   * provenance so the fees remain independently auditable and individually
   * de-duplicable.
   */
  async applyLateFee(
    params: {
      patientId: string;
      tier: number;
      invoiceIds: string[];
      mode: 'flat' | 'percentage';
      /** Omit to charge the tier's default rate (see late-fee.service.ts). */
      rate?: number;
      basis: 'patient' | 'total';
      branchId?: string;
    },
    createdBy: string,
  ) {
    const {
      invoiceIds, mode, basis, branchId,
    } = params;

    const resolvedTier = lateFee.resolveTier(params.tier);
    if (resolvedTier === undefined) {
      throw new BadRequestError(`Invalid late-fee tier: ${params.tier}. Expected one of ${lateFee.LATE_FEE_TIERS.join(', ')}.`);
    }
    if (!invoiceIds?.length) {
      throw new BadRequestError('Select at least one invoice to charge.');
    }

    const tierDefault = lateFee.defaultRateFor(resolvedTier);
    const requestedRate = params.rate === undefined || params.rate === null ? undefined : Number(params.rate);
    let parsedRate: number;
    if (requestedRate !== undefined) {
      if (!Number.isFinite(requestedRate) || requestedRate <= 0) {
        throw new BadRequestError('Late-fee rate must be a positive number.');
      }
      parsedRate = requestedRate;
    } else if (tierDefault !== null) {
      parsedRate = tierDefault;
    } else {
      throw new BadRequestError(
        'A rate is required for an un-tiered adjustment, because there is no tier default to fall back on.',
      );
    }

    const patientId = BigInt(params.patientId);
    const patient = await prisma.patient.findUnique({ where: { PatNum: patientId } });
    if (!patient) throw new NotFoundError('Patient not found');

    const clinicId = patient.ClinicNum ?? BigInt(0);
    const activePolicy = await LateFeeGuardrails.getActivePolicy(clinicId);
    if (!activePolicy) {
      throw new ConflictError('No active late fee policy for this clinic');
    }
    if (!activePolicy.enabled) {
      throw new ConflictError('Late fees are disabled for this clinic');
    }

    const sourceInvoices = [];
    for (const invoiceId of invoiceIds) {
      const statement = await this.getStatementById(invoiceId);
      if (!statement) throw new NotFoundError(`Invoice ${invoiceId} not found`);
      if (String(statement.PatNum) !== String(patientId)) {
        throw new BadRequestError(`Invoice ${invoiceId} does not belong to this patient.`);
      }
      const meta = parseJson<StatementMeta>(statement.NoteBold);
      const mapped = this.mapStatementToInvoice(statement, meta);
      const split = lateFee.outstandingSplit({
        balTotal: statement.BalTotal,
        insEst: statement.InsEst,
        writeoffAmount: meta.writeoffAmount,
      });
      sourceInvoices.push({
        id: statement.StatementNum,
        invoiceNumber: statement.ShortGUID,
        invoiceDate: statement.DateSent,
        patientPortion: split.patientRemaining,
        patientRemaining: split.patientRemaining,
        balanceDue: split.totalOwing,
        totalAmount: Number(statement.BalTotal ?? 0),
        patientLiabilityFinalizedAt: statement.patientLiabilityFinalizedAt,
        lateFeePolicyVersionId: statement.lateFeePolicyVersionId ? BigInt(statement.lateFeePolicyVersionId) : null,
        patientId,
        clinicId,
      });
    }

    const accepted: Array<{
      sourceStatement: string;
      invoiceNumber: string;
      daysOutstanding: number;
      baseAmount: number;
      feeAmount: number;
    }> = [];
    const rejected: Array<{ invoiceId: string; reason: string }> = [];

    const isCorporate = await LateFeeGuardrails.isCorporateClient(patientId);

    for (const invoice of sourceInvoices) {
      const eligibility = await LateFeeGuardrails.checkEligibility(invoice, activePolicy, new Date());
      if (!eligibility.eligible) {
        rejected.push({ invoiceId: invoice.id.toString(), reason: eligibility.details ?? eligibility.skipReason ?? 'Not eligible' });
        continue;
      }

      const feeCalc = await LateFeeGuardrails.calculateFee(invoice, activePolicy, isCorporate);
      if (feeCalc.feeAmount <= 0) {
        rejected.push({ invoiceId: invoice.id.toString(), reason: 'Calculated fee is zero' });
        continue;
      }

      const capExceeded = await LateFeeGuardrails.wouldExceedCap(
        invoice.id,
        feeCalc.feeAmount,
        activePolicy.capPct,
        invoice.totalAmount
      );
      if (capExceeded) {
        rejected.push({ invoiceId: invoice.id.toString(), reason: `Cap of ${activePolicy.capPct}% reached` });
        continue;
      }

      const periodStart = new Date();
      periodStart.setDate(1);
      periodStart.setHours(0, 0, 0, 0);
      const periodEnd = new Date(periodStart);
      periodEnd.setMonth(periodEnd.getMonth() + 1);
      periodEnd.setDate(0);
      periodEnd.setHours(23, 59, 59, 999);
      
      const alreadyApplied = await LateFeeGuardrails.isFeeAlreadyApplied(invoice.id, periodStart, periodEnd, activePolicy.feeType);
      if (alreadyApplied) {
        rejected.push({ invoiceId: invoice.id.toString(), reason: 'Fee already applied for this period' });
        continue;
      }

      accepted.push({
        sourceStatement: invoice.id.toString(),
        invoiceNumber: invoice.invoiceNumber || invoice.id.toString(),
        daysOutstanding: Math.floor((Date.now() - (invoice.invoiceDate?.getTime() ?? Date.now())) / (24 * 60 * 60 * 1000)),
        baseAmount: feeCalc.baseAmount,
        feeAmount: feeCalc.feeAmount,
      });
    }

    if (accepted.length === 0) {
      throw new ConflictError(
        `No eligible invoices for the requested late fee. ${rejected.map((r) => `${r.invoiceId}: ${r.reason}`).join(' ') || 'None selected.'}`,
      );
    }

    const tierLabel = resolvedTier ? `${resolvedTier} days` : 'overdue';
    const basisLabel = basis === 'patient' ? 'patient balance' : 'total outstanding';
    const rateLabel = mode === 'percentage' ? `${parsedRate}% of ${basisLabel}` : `$${parsedRate} flat`;
    const totalFee = Math.round(accepted.reduce((sum, a) => sum + a.feeAmount, 0) * 100) / 100;

    const created = await this.createStandaloneInvoice(
      {
        patientId: String(patientId),
        branchId,
        notes: `Late fee — ${tierLabel} (${rateLabel})`,
        items: accepted.map((a) => ({
          code: `LATE-${resolvedTier ?? 'ANY'}-${a.sourceStatement}`,
          description: `Late fee ${tierLabel} - invoice ${a.invoiceNumber} (${a.daysOutstanding} days overdue, ${rateLabel})`,
          date: new Date().toISOString(),
          site: 'Office',
          provider: 'Staff',
          writeoff: 0,
          ptPortion: a.feeAmount,
          insPortion: 0,
          primaryInsPortion: 0,
          secondaryInsPortion: 0,
          totalInsPortion: 0,
          charge: a.feeAmount,
          balance: a.feeAmount,
          dbi: false,
          completed: true,
          patientOnly: true,
          isPatientPenalty: true,
          isAccountPenalty: true,
          lateFeeSourceStatement: a.sourceStatement,
          lateFeeTier: resolvedTier,
          lateFeeBaseAmount: a.baseAmount,
        })),
      },
      createdBy,
    );

    return {
      invoice: created,
      tier: resolvedTier,
      basis,
      mode,
      rate: parsedRate,
      totalFee,
      charged: accepted,
      rejected,
    };
  }

  async markItemPaid(invoiceId: string, itemId: string, amount: number, paymentSource?: string) {
    const invoice = await this.getStatementById(invoiceId);
    if (!invoice) throw new NotFoundError('Invoice not found');

    const meta = parseJson<StatementMeta>(invoice.NoteBold);
    if (String(meta.status) === 'void') throw new BadRequestError('Cannot pay a voided invoice');

    const procNum = toBigInt(itemId);
    if (!procNum) throw new NotFoundError('Invoice item not found');

    const item = await prisma.procedurelog.findUnique({ where: { ProcNum: procNum } });
    if (!item || item.StatementNum?.toString() !== invoiceId) throw new NotFoundError('Invoice item not found');

    const itemMeta = parseJson<ItemMeta>(item.BillingNote);
    const currentPaid = Number((itemMeta as any).paidAmount || 0);
    const newPaid = roundCurrency(currentPaid + amount);
    const isInsPayment = String(paymentSource ?? '').toLowerCase() === 'insurance_company' || String(paymentSource ?? '').toLowerCase() === 'insurance';

    await prisma.procedurelog.update({
      where: { ProcNum: procNum },
      data: {
        BillingNote: buildJson({
          ...itemMeta,
          paidAmount: newPaid,
          insurancePaidAmount: isInsPayment
            ? roundCurrency(Number((itemMeta as any).insurancePaidAmount || 0) + amount)
            : Number((itemMeta as any).insurancePaidAmount || 0),
          patientPaidAmount: isInsPayment
            ? Number((itemMeta as any).patientPaidAmount || 0)
            : roundCurrency(Number((itemMeta as any).patientPaidAmount || 0) + amount),
        }),
      },
    });

    await this.recalculateInvoice(invoiceId);
    return { success: true, message: 'Item payment recorded', itemId, paidAmount: newPaid };
  }

  /**
   * Transfer the outstanding insurance estimate for a line item to the patient balance.
   * Sets insPortion = 0 and increases ptPortion by that amount in the procedure's BillingNote,
   * then recalculates the invoice. Also updates the underlying claim (InsPayEst / DedApplied) if one exists.
   */
  async transferOutstandingToPatient(invoiceId: string, itemId: string, performedBy: string) {
    const invoice = await this.getStatementById(invoiceId);
    if (!invoice) throw new NotFoundError('Invoice not found');

    const meta = parseJson<StatementMeta>(invoice.NoteBold);
    if (String(meta.status) === 'void') throw new BadRequestError('Cannot transfer on a voided invoice');

    const procNum = toBigInt(itemId);
    if (!procNum) throw new NotFoundError('Invoice item not found');

    const item = await prisma.procedurelog.findUnique({ where: { ProcNum: procNum } });
    if (!item || item.StatementNum?.toString() !== invoiceId) throw new NotFoundError('Invoice item not found');

    const itemMeta = parseJson<any>(item.BillingNote);

    // ── Compute the true remaining balance ────────────────────────────────────
    // initialIns  = the original insurance estimate stored in BillingNote
    // totalFee    = the gross procedure charge
    // writeoff    = write-off amount already applied
    // paidAmount  = sum of all payments (patient + insurance) already recorded
    // netOwed     = what is actually owed after write-off
    // remaining   = netOwed minus anything already paid
    // outstandingInsurance = min(initialIns, remaining) — never transfer more
    //                        than what is genuinely still outstanding
    const initialIns  = roundCurrency(Number(itemMeta.insPortion || 0));
    const totalFee    = roundCurrency(Number(item.ProcFee || 0));
    const writeoff    = roundCurrency(Number(itemMeta.writeoff || itemMeta.estimatedWriteOff || 0));
    const paidAmount  = roundCurrency(Number(itemMeta.paidAmount || 0));
    const netOwed     = roundCurrency(Math.max(0, totalFee - writeoff));
    const remaining   = roundCurrency(Math.max(0, netOwed - paidAmount));
    const outstandingInsurance = roundCurrency(Math.min(initialIns, remaining));

    if (outstandingInsurance <= 0) {
      throw new BadRequestError('No outstanding insurance estimate to transfer for this item');
    }

    // Shift the amount from insurance portion to patient portion
    const newPtPortion = roundCurrency((Number(itemMeta.ptPortion) || 0) + outstandingInsurance);
    const updatedItemMeta = {
      ...itemMeta,
      insPortion: 0,
      ptPortion: newPtPortion,
      isManuallyAdjusted: true,
    };

    await prisma.procedurelog.update({
      where: { ProcNum: procNum },
      data: { BillingNote: buildJson(updatedItemMeta) },
    });

    // Also update the underlying claim if one is linked to this invoice
    const claimId = meta.claimId;
    if (claimId && /^\d+$/.test(claimId)) {
      const claim = await prisma.claim.findUnique({ where: { ClaimNum: BigInt(claimId) } });
      if (claim) {
        const currentInsPayEst = roundCurrency(Number(claim.InsPayEst) || 0);
        const currentDedApplied = roundCurrency(Number(claim.DedApplied) || 0);

        // Only reduce if the claim value covers what we are transferring
        const reduceBy = Math.min(outstandingInsurance, currentInsPayEst);
        await prisma.claim.update({
          where: { ClaimNum: BigInt(claimId) },
          data: {
            InsPayEst: roundCurrency(currentInsPayEst - reduceBy),
            DedApplied: roundCurrency(currentDedApplied + reduceBy),
          },
        });
      }
    }

    // Create an explicit $0.00 net-zero adjustment record for ledger audit trail
    if (invoice.PatNum) {
      const adjNum = await getNextId('adjustment', 'AdjNum');
      const invoiceNumber = invoice.StatementNum.toString();
      const adjNote = `Invoice #${invoiceNumber} - Income Transfer: $${outstandingInsurance.toFixed(2)} shifted from Insurance to Patient`;
      const userNum = toBigInt(performedBy);

      await prisma.adjustment.create({
        data: {
          AdjNum: adjNum,
          PatNum: invoice.PatNum,
          ProvNum: item.ProvNum ?? undefined,
          ProcNum: procNum,
          StatementNum: invoice.StatementNum,
          AdjAmt: 0,
          AdjDate: new Date(),
          ProcDate: item.ProcDate ?? new Date(),
          DateEntry: new Date(),
          AdjNote: adjNote,
          SecUserNumEntry: userNum ?? undefined,
        },
      });
    }

    // Recalculate invoice totals
    await this.recalculateInvoice(invoiceId);

    if (invoice.PatNum) {
      await agingService.updatePatientAging(invoice.PatNum);
    }

    const updatedInvoice = await this.getStatementById(invoiceId);
    const updatedMeta = parseJson<StatementMeta>(updatedInvoice?.NoteBold);

    await logActivity(
      performedBy,
      'updated',
      'invoices',
      invoiceId,
      undefined,
      { action: 'transfer_outstanding_to_patient', itemId, transferredAmount: outstandingInsurance },
      undefined,
      undefined,
      'medium'
    );

    return {
      success: true,
      message: `$${outstandingInsurance.toFixed(2)} transferred from insurance to patient balance`,
      transferredAmount: outstandingInsurance,
      invoice: this.mapStatementToInvoice(updatedInvoice, updatedMeta),
    };
  }
  /**
   * Reverse of transferOutstandingToPatient: shift what the patient still owes on a
   * line item back onto the insurance estimate. Mirrors the forward calculation so
   * the two directions stay symmetric - the amount moved is always capped by what is
   * genuinely still outstanding after write-offs and payments.
   */
  async transferOutstandingToInsurance(invoiceId: string, itemId: string, performedBy: string) {
    const invoice = await this.getStatementById(invoiceId);
    if (!invoice) throw new NotFoundError('Invoice not found');

    const meta = parseJson<StatementMeta>(invoice.NoteBold);
    if (String(meta.status) === 'void') throw new BadRequestError('Cannot transfer on a voided invoice');

    const procNum = toBigInt(itemId);
    if (!procNum) throw new NotFoundError('Invoice item not found');

    const item = await prisma.procedurelog.findUnique({ where: { ProcNum: procNum } });
    if (!item || item.StatementNum?.toString() !== invoiceId) throw new NotFoundError('Invoice item not found');

    const itemMeta = parseJson<any>(item.BillingNote);

    const initialPt   = roundCurrency(Number(itemMeta.ptPortion || 0));
    const totalFee    = roundCurrency(Number(item.ProcFee || 0));
    const writeoff    = roundCurrency(Number(itemMeta.writeoff || itemMeta.estimatedWriteOff || 0));
    const paidAmount  = roundCurrency(Number(itemMeta.paidAmount || 0));
    const netOwed     = roundCurrency(Math.max(0, totalFee - writeoff));
    const remaining   = roundCurrency(Math.max(0, netOwed - paidAmount));
    const outstandingPatient = roundCurrency(Math.min(initialPt, remaining));

    if (outstandingPatient <= 0) {
      throw new BadRequestError('No outstanding patient balance to transfer for this item');
    }

    // Shift the amount from patient portion to insurance portion
    const newInsPortion = roundCurrency((Number(itemMeta.insPortion) || 0) + outstandingPatient);
    const updatedItemMeta = {
      ...itemMeta,
      insPortion: newInsPortion,
      ptPortion: 0,
      isManuallyAdjusted: true,
    };

    await prisma.procedurelog.update({
      where: { ProcNum: procNum },
      data: { BillingNote: buildJson(updatedItemMeta) },
    });

    // Give the amount back to the linked claim's estimate (mirror image of the
    // forward transfer, which moved it onto DedApplied).
    const claimId = meta.claimId;
    if (claimId && /^\d+$/.test(claimId)) {
      const claim = await prisma.claim.findUnique({ where: { ClaimNum: BigInt(claimId) } });
      if (claim) {
        const currentInsPayEst = roundCurrency(Number(claim.InsPayEst) || 0);
        const currentDedApplied = roundCurrency(Number(claim.DedApplied) || 0);
        const addBack = Math.min(outstandingPatient, currentDedApplied);

        await prisma.claim.update({
          where: { ClaimNum: BigInt(claimId) },
          data: {
            InsPayEst: roundCurrency(currentInsPayEst + outstandingPatient),
            DedApplied: roundCurrency(Math.max(0, currentDedApplied - addBack)),
          },
        });
      }
    }

    // Net-zero audit record, matching the forward transfer
    if (invoice.PatNum) {
      const adjNum = await getNextId('adjustment', 'AdjNum');
      const invoiceNumber = invoice.StatementNum.toString();
      const adjNote = `Invoice #${invoiceNumber} - Income Transfer: $${outstandingPatient.toFixed(2)} shifted from Patient to Insurance`;
      const userNum = toBigInt(performedBy);

      await prisma.adjustment.create({
        data: {
          AdjNum: adjNum,
          PatNum: invoice.PatNum,
          ProvNum: item.ProvNum ?? undefined,
          ProcNum: procNum,
          StatementNum: invoice.StatementNum,
          AdjAmt: 0,
          AdjDate: new Date(),
          ProcDate: item.ProcDate ?? new Date(),
          DateEntry: new Date(),
          AdjNote: adjNote,
          SecUserNumEntry: userNum ?? undefined,
        },
      });
    }

    await this.recalculateInvoice(invoiceId);

    if (invoice.PatNum) {
      await agingService.updatePatientAging(invoice.PatNum);
    }

    const updatedInvoice = await this.getStatementById(invoiceId);
    const updatedMeta = parseJson<StatementMeta>(updatedInvoice?.NoteBold);

    await logActivity(
      performedBy,
      'updated',
      'invoices',
      invoiceId,
      undefined,
      { action: 'transfer_outstanding_to_insurance', itemId, transferredAmount: outstandingPatient },
      undefined,
      undefined,
      'medium'
    );

    return {
      success: true,
      message: `$${outstandingPatient.toFixed(2)} transferred from patient balance to insurance estimate`,
      transferredAmount: outstandingPatient,
      invoice: this.mapStatementToInvoice(updatedInvoice, updatedMeta),
    };
  }

  async transferRejectedClaim(invoiceId: string | undefined, claimId: string) {
    const claimNum = toBigInt(claimId);
    if (!claimNum) throw new BadRequestError('Invalid claim ID');

    const claim = await prisma.claim.findUnique({
      where: { ClaimNum: claimNum },
      include: {
        claimproc: true,
      },
    });
    if (!claim) throw new NotFoundError('Claim not found');

    const claimMeta = parseJson<Record<string, any>>(claim.Narrative) || {};
    const claimType = String(claim.ClaimType || claimMeta.claimType || claimMeta.insuranceType || '').toLowerCase();
    const isSecondaryClaim = claimType.includes('secondary') || claimType === 's';

    // 1. Find all claimprocs attached to this claim
    const claimProcs = claim.claimproc || await prisma.claimproc.findMany({
      where: { ClaimNum: claimNum }
    });

    if (claimProcs.length === 0) {
      throw new BadRequestError('No procedures found for this claim');
    }

    const procNums = claimProcs.map(cp => cp.ProcNum).filter((id): id is bigint => id !== null);

    // 2. Fetch the corresponding procedure logs
    let items = await prisma.procedurelog.findMany({
      where: { ProcNum: { in: procNums } }
    });

    // Resolve invoice either from passed invoiceId or from the procedures
    let invoice: any = null;
    if (invoiceId && invoiceId !== 'undefined') {
      try {
        invoice = await this.getStatementById(invoiceId);
      } catch {
        invoice = null;
      }
    }
    if (!invoice && items.length > 0 && items[0].StatementNum) {
      try {
        invoice = await this.getStatementById(items[0].StatementNum.toString());
      } catch {
        invoice = null;
      }
    }

    let totalTransferred = 0;

    // 3. For each procedure, transfer this claim's expected insurance portion to patient portion
    for (const item of items) {
      const meta = parseJson<any>(item.BillingNote) || {};
      const cp = claimProcs.find(c => c.ProcNum === item.ProcNum);

      const initialPtPortion = Number(meta.ptPortion || 0);
      const initialInsPortion = Number(meta.insPortion || 0);
      const initialPrimPortion = Number(meta.primaryInsPortion || 0);
      const initialSecPortion = Number(meta.secondaryInsPortion || 0);

      let claimPortionToTransfer = 0;
      let newPrimPortion = initialPrimPortion;
      let newSecPortion = initialSecPortion;

      if (isSecondaryClaim) {
        // Secondary claim rejected: transfer secondary expected portion to patient balance
        claimPortionToTransfer = initialSecPortion > 0
          ? initialSecPortion
          : (cp?.InsPayEst ? Number(cp.InsPayEst) : 0);
        newSecPortion = 0;
        newPrimPortion = initialPrimPortion > 0 ? initialPrimPortion : Math.max(0, roundCurrency(initialInsPortion - claimPortionToTransfer));
      } else {
        // Primary claim rejected: transfer primary expected portion to patient balance
        claimPortionToTransfer = initialPrimPortion > 0
          ? initialPrimPortion
          : (initialInsPortion > 0 ? initialInsPortion : (cp?.InsPayEst ? Number(cp.InsPayEst) : 0));
        newPrimPortion = 0;
      }

      if (claimPortionToTransfer > 0) {
        const newPtPortion = roundCurrency(initialPtPortion + claimPortionToTransfer);
        const newTotalInsPortion = roundCurrency(newPrimPortion + newSecPortion);

        meta.primaryInsPortion = newPrimPortion;
        meta.secondaryInsPortion = newSecPortion;
        meta.totalInsPortion = newTotalInsPortion;
        meta.insPortion = newTotalInsPortion;
        meta.ptPortion = newPtPortion;
        meta.isManuallyAdjusted = true;

        await prisma.procedurelog.update({
          where: { ProcNum: item.ProcNum },
          data: { BillingNote: buildJson(meta) }
        });

        totalTransferred = roundCurrency(totalTransferred + claimPortionToTransfer);
      }
    }

    // 4. Update claim status to 'rejected' ('X' in OpenDental)
    const updatedClaimMeta: Record<string, any> = {
      ...claimMeta,
      status: 'rejected',
      denialReason: 'Claim rejected by user',
      deniedDate: new Date().toISOString(),
    };

    await prisma.claim.update({
      where: { ClaimNum: claimNum },
      data: {
        ClaimStatus: 'X', // 'X' = Rejected
        ReasonUnderPaid: 'Claim rejected',
        Narrative: buildJson(updatedClaimMeta),
      }
    });

    // Update claimprocs
    await prisma.claimproc.updateMany({
      where: { ClaimNum: claimNum },
      data: {
        Remarks: 'Claim rejected',
      }
    });

    // 5. Recalculate invoice to update high-level balances (Pt Balance, Ins Balance)
    if (invoice?.StatementNum) {
      await this.recalculateInvoice(invoice.StatementNum.toString());
    }

    return {
      success: true,
      message: `Claim rejected. Transferred $${totalTransferred.toFixed(2)} to patient balance`,
      transferredAmount: totalTransferred,
      claimId: claimId,
      status: 'rejected'
    };
  }

  async getPatientCompositeLedger(patientId: string) {
    const invoiceRows = await prisma.statement.findMany({
      where: { PatNum: BigInt(patientId), IsInvoice: 1 },
      orderBy: { DateSent: 'desc' },
    });

    const patientRow = await prisma.patient.findUnique({ where: { PatNum: BigInt(patientId) } });
    const mappedPatient = patientRow ? mapPatientToApi(patientRow) : null;

    const statementMetas = invoiceRows.map((row) => {
      const meta = parseJson<StatementMeta>(row.NoteBold);
      const mapped = this.mapStatementToInvoice(row, meta);
      return { row, meta, mapped };
    });

    const statementNums = invoiceRows.map((r) => r.StatementNum);
    const providerIds = [...new Set(statementMetas.map((s) => s.meta.providerId).filter((id): id is string => typeof id === 'string' && /^\d+$/.test(id)))];
    const insuranceCompanyIds = [...new Set(statementMetas.map((s) => s.meta.insuranceCompanyId).filter((id): id is string => typeof id === 'string' && /^\d+$/.test(id)))];

    const [providerMap, insuranceCompanyMap, itemsByStatementMap] = await Promise.all([
      this.batchResolveProviders(providerIds),
      this.batchResolveInsuranceCompanies(insuranceCompanyIds),
      this.batchGetInvoiceItems(statementNums),
    ]);

    const invoices = statementMetas.map(({ row, meta, mapped }) => {
      const provider = meta.providerId ? providerMap.get(meta.providerId) ?? null : null;
      const insuranceCompany = meta.insuranceCompanyId ? insuranceCompanyMap.get(meta.insuranceCompanyId) ?? null : null;
      const items = itemsByStatementMap.get(row.StatementNum.toString()) || [];
      return {
        ...mapped,
        patient: mappedPatient,
        provider,
        insuranceCompany,
        lineItems: items,
      };
    });

    const [adjustmentsResult, paymentsResult, claimsResult] = await Promise.all([
      adjustmentService.getAdjustmentsByPatient(patientId, 1, 1000),
      paymentService.getPaymentsByPatient(patientId, 1, 1000),
      claimService.getAllClaims(1, 1000, { patientId }),
    ]);

    return {
      invoices,
      adjustments: adjustmentsResult.adjustments,
      payments: paymentsResult.payments,
      claims: claimsResult.claims,
    };
  }

  async getLateFeeTerms(invoiceId: string): Promise<{ termsText: string; policyVersion: number } | null> {
    const statement = await prisma.statement.findUnique({
      where: { StatementNum: BigInt(invoiceId) },
      select: { lateFeePolicyVersionId: true },
    });
    if (!statement?.lateFeePolicyVersionId) return null;

    const policy = await prisma.lateFeePolicy.findUnique({
      where: { id: BigInt(statement.lateFeePolicyVersionId) },
      select: { termsText: true, version: true },
    });
    if (!policy) return null;

    return { termsText: policy.termsText, policyVersion: policy.version };
  }
}

export const invoiceService = new InvoiceService();
