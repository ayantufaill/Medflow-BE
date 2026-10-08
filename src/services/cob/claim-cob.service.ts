/**
 * COB at the claim and remittance boundary.
 *
 * Three jobs, all of them gates or ledger entries rather than new workflow:
 *
 *  1. A secondary claim may not exist before the primary's remittance is
 *     posted, and must carry the primary's payment detail.
 *  2. A posted remittance writes responsibility-ledger entries, including
 *     contractual adjustments, and finalizes patient liability once the last
 *     payer has paid.
 *  3. A COB-coded denial routes into cobService.handleCobDenial.
 *
 * WHY THE SECONDARY GATE IS NOT OPTIONAL
 * --------------------------------------
 * A secondary payer adjudicates against what the primary did. Without the
 * primary's paid amount, allowed amount, adjustment codes and patient
 * responsibility, the 837's 2320/2430 loops are empty and the payer either
 * denies the claim or — worse — pays it as though it were primary, which the
 * practice then has to refund. So "wait for the remittance" is not a policy
 * choice, it is the only order in which the claim can be constructed.
 */

import type { Request } from 'express';
import { prisma } from '../../config/db';
import { BadRequestError, ConflictError, NotFoundError } from '../../utils/error.util';
import { toIsoDate } from './date.util';
import { isAdjudicated } from '../../constants/claim-status';
import type { AdjustmentCode } from './denial';
import { cobService } from './cob.service';
import type { ResponsibleParty } from './types';

const round = (value: number): number => Math.round((Number(value) || 0) * 100) / 100;

/** Position in the coverage order -> the ledger's party name. */
export const partyForPosition = (position: number): ResponsibleParty => {
  switch (position) {
    case 1:
      return 'PRIMARY';
    case 2:
      return 'SECONDARY';
    case 3:
      return 'TERTIARY';
    default:
      // Beyond tertiary there is no distinct responsible party in the ledger
      // vocabulary. Four payers on one claim is rare enough that collapsing
      // it to TERTIARY is better than inventing a party nothing else reads.
      return 'TERTIARY';
  }
};

export interface PrimaryRemittanceStatus {
  posted: boolean;
  reason: string | null;
  paidAmount: number;
  allowedAmount: number;
  patientResponsibility: number;
  adjustments: AdjustmentCode[];
  remittanceDate: string | null;
}

/**
 * Has the primary's remittance actually been posted?
 *
 * A $0 denial counts. A denial IS a remittance — the payer adjudicated and
 * said no — and the secondary is entitled to see that adjudication. Treating
 * only paid claims as posted would strand every patient whose primary denied,
 * which is exactly the population that needs the secondary billed.
 *
 * What does NOT count is a claim merely marked sent or pending. Nothing has
 * come back, so there is nothing to tell the secondary.
 */
export const getPrimaryRemittanceStatus = async (
  primaryClaimNum: bigint
): Promise<PrimaryRemittanceStatus> => {
  const claim = await prisma.claim.findUnique({
    where: { ClaimNum: primaryClaimNum },
    include: { claimproc: true },
  });
  if (!claim) throw new NotFoundError('Primary claim not found');

  // Paid, partly paid or denied — see ADJUDICATED_CLAIM_STATUS_CODES for why
  // a denial counts. Read from the shared vocabulary rather than spelled out
  // here, so adding a status to claim.service's mapper cannot leave this
  // check silently behind.
  const adjudicated = isAdjudicated(claim.ClaimStatus);
  const hasCheck = claim.claimproc.some((cp) => cp.ClaimPaymentNum != null);
  const hasReceivedDate = claim.DateReceived != null;
  const posted = (adjudicated && hasReceivedDate) || hasCheck;

  // Allowed amount: the contracted amount the payer recognised. We hold it as
  // billed less the contractual write-off, which is how an 835 expresses it
  // (CO-group adjustments are the difference between billed and allowed).
  const paidAmount = round(
    claim.claimproc.reduce((sum, cp) => sum + (Number(cp.InsPayAmt) || 0), 0) ||
      Number(claim.InsPayAmt) ||
      0
  );
  const writeOff = round(
    claim.claimproc.reduce((sum, cp) => sum + (Number(cp.WriteOff) || 0), 0) ||
      Number(claim.WriteOff) ||
      0
  );
  const billed = round(
    claim.claimproc.reduce((sum, cp) => sum + (Number(cp.FeeBilled) || 0), 0) ||
      Number(claim.ClaimFee) ||
      0
  );
  const deductible = round(
    claim.claimproc.reduce((sum, cp) => sum + (Number(cp.DedApplied) || 0), 0) ||
      Number(claim.DedApplied) ||
      0
  );
  const allowedAmount = round(Math.max(0, billed - writeOff));
  const patientResponsibility = round(Math.max(0, allowedAmount - paidAmount));

  // The ERA poster stores the payer's codes as "CO-45: $120; PR-1: $30" in
  // claimproc.ClaimAdjReasonCodes. Parsing them back is less fragile than it
  // looks (the writer is era835.service.ts, one line, one format) and it is
  // the only structured record of the codes we have per claim.
  const adjustments: AdjustmentCode[] = [];
  for (const cp of claim.claimproc) {
    for (const part of String(cp.ClaimAdjReasonCodes || '').split(';')) {
      const match = /^\s*([A-Z]{2})-([A-Za-z0-9]+)\s*:\s*\$?(-?[\d.]+)/.exec(part);
      if (!match) continue;
      adjustments.push({
        groupCode: match[1],
        reasonCode: match[2],
        amount: round(Number(match[3])),
      });
    }
  }

  return {
    posted,
    reason: posted
      ? null
      : `The primary claim ${primaryClaimNum} has no posted remittance yet ` +
        `(status ${claim.ClaimStatus || 'unset'}${hasReceivedDate ? '' : ', no received date'}). ` +
        `A secondary claim has to carry the primary's paid amount, allowed amount, ` +
        `adjustment codes and patient responsibility — none of which exist until the ` +
        `primary adjudicates. Post the primary's ERA or EOB first.`,
    paidAmount,
    allowedAmount,
    patientResponsibility,
    adjustments,
    remittanceDate: toIsoDate(claim.DateReceived),
  };
};

/**
 * The gate itself. Throws with the reason a biller needs to act on.
 *
 * Also runs the coverage-order check for the date of service, because a
 * secondary claim is a claim: if the order is NEEDS_INFO or has an unresolved
 * PAYER_MISMATCH, we do not know this is even the right second payer.
 */
export const assertSecondaryClaimAllowed = async (
  primaryClaimNum: bigint,
  options: { userNum?: bigint | null; req?: Request } = {}
): Promise<PrimaryRemittanceStatus> => {
  const claim = await prisma.claim.findUnique({ where: { ClaimNum: primaryClaimNum } });
  if (!claim) throw new NotFoundError('Primary claim not found');

  if (claim.PatNum) {
    await cobService.assertSubmittable(
      claim.PatNum.toString(),
      toIsoDate(claim.DateService) || new Date().toISOString().slice(0, 10),
      { userNum: options.userNum, claimId: primaryClaimNum.toString(), req: options.req }
    );
  }

  const status = await getPrimaryRemittanceStatus(primaryClaimNum);
  if (!status.posted) {
    throw new ConflictError(status.reason!);
  }
  return status;
};

/**
 * Attaches the primary's adjudication to the secondary claim.
 *
 * Stored as a row rather than folded into the claim's narrative JSON because
 * the 837 builder has to read it field by field, and because "what did the
 * primary actually pay when we billed the secondary" must not change when
 * somebody later edits the primary.
 */
export const recordPrimaryPaymentDetail = async (
  secondaryClaimNum: bigint,
  primaryClaimNum: bigint,
  status: PrimaryRemittanceStatus,
  userNum?: bigint | null
) => {
  const primary = await prisma.claim.findUnique({
    where: { ClaimNum: primaryClaimNum },
    include: { insplan_claim_PlanNumToinsplan: true },
  });

  return prisma.cob_primary_payment_detail.upsert({
    where: { claim_num: secondaryClaimNum },
    create: {
      claim_num: secondaryClaimNum,
      primary_claim_num: primaryClaimNum,
      primary_carrier_num: primary?.insplan_claim_PlanNumToinsplan?.CarrierNum ?? null,
      paid_amount: status.paidAmount,
      allowed_amount: status.allowedAmount,
      patient_responsibility: status.patientResponsibility,
      adjustments: status.adjustments as any,
      remittance_date: status.remittanceDate ? new Date(`${status.remittanceDate}T00:00:00.000Z`) : null,
      created_by: userNum ?? null,
    },
    update: {
      primary_claim_num: primaryClaimNum,
      primary_carrier_num: primary?.insplan_claim_PlanNumToinsplan?.CarrierNum ?? null,
      paid_amount: status.paidAmount,
      allowed_amount: status.allowedAmount,
      patient_responsibility: status.patientResponsibility,
      adjustments: status.adjustments as any,
      remittance_date: status.remittanceDate ? new Date(`${status.remittanceDate}T00:00:00.000Z`) : null,
    },
  });
};

export const getPrimaryPaymentDetail = async (secondaryClaimNum: bigint) => {
  const row = await prisma.cob_primary_payment_detail.findUnique({
    where: { claim_num: secondaryClaimNum },
  });
  if (!row) return null;
  return {
    claimId: row.claim_num.toString(),
    primaryClaimId: row.primary_claim_num.toString(),
    primaryCarrierId: row.primary_carrier_num?.toString() ?? null,
    paidAmount: row.paid_amount,
    allowedAmount: row.allowed_amount,
    patientResponsibility: row.patient_responsibility,
    adjustments: row.adjustments,
    remittanceDate: toIsoDate(row.remittance_date),
  };
};

// ── Responsibility ledger ─────────────────────────────────────────────────

/**
 * Records one posted remittance in the responsibility ledger.
 *
 * Contractual adjustments go in as their own CONTRACTUAL_ADJUSTMENT entries
 * with `billable_to_patient: false`. This is the distinction the spec insists
 * on and it is a real-money one: a contractual write-off is the difference
 * between what we charged and what our contract with the payer allows. It is
 * not a courtesy discount (which would be a patient-facing adjustment) and it
 * can never be billed to the patient — doing so is balance billing.
 *
 * PR-group adjustments are the opposite: they ARE the patient's money
 * (deductible, coinsurance, copay), so they land as a PATIENT charge.
 */
export const recordRemittanceInLedger = async (input: {
  claimNum: bigint;
  patNum: bigint;
  statementNum?: bigint | null;
  position: number;
  paidAmount: number;
  adjustments: AdjustmentCode[];
  source?: string;
  userNum?: bigint | null;
}) => {
  const party = partyForPosition(input.position);
  const entries: Array<{
    entry_type: string;
    responsible_party: ResponsibleParty;
    amount: number;
    group_code: string | null;
    reason_code: string | null;
    billable_to_patient: boolean;
  }> = [];

  if (input.paidAmount !== 0) {
    entries.push({
      entry_type: 'PAYMENT',
      responsible_party: party,
      amount: round(input.paidAmount),
      group_code: null,
      reason_code: null,
      billable_to_patient: false,
    });
  }

  for (const adj of input.adjustments || []) {
    const group = String(adj.groupCode || '').toUpperCase();
    const amount = round(adj.amount);
    if (amount === 0) continue;

    if (group === 'CO' || group === 'CR') {
      // CO = contractual obligation. The provider eats it.
      entries.push({
        entry_type: 'CONTRACTUAL_ADJUSTMENT',
        responsible_party: party,
        amount,
        group_code: group,
        reason_code: adj.reasonCode || null,
        billable_to_patient: false,
      });
    } else if (group === 'PR') {
      // PR = patient responsibility. Deductible, coinsurance, copay.
      entries.push({
        entry_type: 'TRANSFER',
        responsible_party: 'PATIENT',
        amount,
        group_code: group,
        reason_code: adj.reasonCode || null,
        billable_to_patient: true,
      });
    } else {
      // OA / PI and anything unrecognised: recorded, but NOT marked billable.
      // Defaulting an unknown group code to the patient's column is how a
      // practice balance-bills by accident.
      entries.push({
        entry_type: 'TRANSFER',
        responsible_party: party,
        amount,
        group_code: group || null,
        reason_code: adj.reasonCode || null,
        billable_to_patient: false,
      });
    }
  }

  if (entries.length === 0) return [];

  await prisma.cob_responsibility_ledger.createMany({
    data: entries.map((entry) => ({
      statement_num: input.statementNum ?? null,
      pat_num: input.patNum,
      claim_num: input.claimNum,
      entry_type: entry.entry_type,
      responsible_party: entry.responsible_party,
      amount: entry.amount,
      group_code: entry.group_code,
      reason_code: entry.reason_code,
      billable_to_patient: entry.billable_to_patient,
      source: input.source ?? 'REMITTANCE',
      created_by: input.userNum ?? null,
    })),
  });

  return entries;
};

/** Balance by responsible party for an invoice. */
export const getBalanceByResponsibleParty = async (statementNum: bigint) => {
  const rows = await prisma.cob_responsibility_ledger.findMany({
    where: { statement_num: statementNum },
  });

  const byParty: Record<string, { charges: number; payments: number; contractualAdjustments: number }> =
    {};
  const ensure = (party: string) => {
    byParty[party] ??= { charges: 0, payments: 0, contractualAdjustments: 0 };
    return byParty[party];
  };

  for (const row of rows) {
    const bucket = ensure(row.responsible_party);
    if (row.entry_type === 'PAYMENT') bucket.payments = round(bucket.payments + row.amount);
    else if (row.entry_type === 'CONTRACTUAL_ADJUSTMENT')
      bucket.contractualAdjustments = round(bucket.contractualAdjustments + row.amount);
    else if (row.entry_type === 'CHARGE') bucket.charges = round(bucket.charges + row.amount);
    else if (row.entry_type === 'TRANSFER') {
      ensure(row.responsible_party).charges = round(ensure(row.responsible_party).charges + row.amount);
    }
  }

  const liability = await prisma.cob_invoice_liability.findUnique({
    where: { statement_num: statementNum },
  });

  return {
    statementId: statementNum.toString(),
    byParty: Object.entries(byParty).map(([party, totals]) => ({
      responsibleParty: party,
      ...totals,
      balance: round(totals.charges - totals.payments - totals.contractualAdjustments),
    })),
    contractualAdjustmentsTotal: round(
      rows
        .filter((r) => r.entry_type === 'CONTRACTUAL_ADJUSTMENT')
        .reduce((sum, r) => sum + r.amount, 0)
    ),
    /** Never billable to the patient — stated explicitly so a caller cannot miss it. */
    contractualAdjustmentsAreBillableToPatient: false,
    patientLiabilityFinalizedAt: liability?.patient_liability_finalized_at ?? null,
    lastPayerClaimId: liability?.last_payer_claim_num?.toString() ?? null,
  };
};

// ── Patient liability finalization ────────────────────────────────────────

/**
 * Is this the LAST payer's remittance, and if so, freeze patient liability.
 *
 * "Last" is decided from the coverage order in force on the date of service,
 * not from how many claims happen to exist: a patient with three plans whose
 * secondary has paid is not finalized, even though no tertiary claim has been
 * created yet. Finalizing early would hand the patient a bill for money a
 * payer still owes.
 */
export const finalizePatientLiabilityIfLastPayer = async (input: {
  claimNum: bigint;
  userNum?: bigint | null;
}): Promise<{ finalized: boolean; reason: string; statementNum: string | null }> => {
  const claim = await prisma.claim.findUnique({ where: { ClaimNum: input.claimNum } });
  if (!claim?.PatNum) {
    return { finalized: false, reason: 'Claim has no patient', statementNum: null };
  }

  const dos = toIsoDate(claim.DateService) || new Date().toISOString().slice(0, 10);
  const order = await cobService.getOrderForDate(claim.PatNum.toString(), dos);

  // Resolve the invoice from the claim's narrative meta, which is where
  // claim.service stores the link.
  let statementNum: bigint | null = null;
  try {
    const meta = claim.Narrative ? JSON.parse(claim.Narrative) : null;
    if (meta?.invoiceId) statementNum = BigInt(meta.invoiceId);
  } catch {
    statementNum = null;
  }
  if (!statementNum) {
    return { finalized: false, reason: 'Claim is not linked to an invoice', statementNum: null };
  }

  // Only RANKED positions are payers. Excluded coverages are listed on the
  // order but never billed, so counting them would mean the patient's balance
  // was never finalized.
  const payerCount = order
    ? order.positions.filter((p) => p.position !== null).length || 1
    : 1;

  // Which position did this claim bill? From the plan it was sent to.
  let thisPosition = 1;
  if (order && claim.InsSubNum) {
    const patPlan = await prisma.patplan.findFirst({
      where: { PatNum: claim.PatNum, InsSubNum: claim.InsSubNum },
    });
    // `position` is null on an excluded (non-medical) coverage, which takes
    // no part in the claim's coordination. Guarding on it matters: treating a
    // fixed-indemnity policy as payer 1 of 2 would hold the patient's balance
    // open forever waiting for a payer that is never billed.
    const match = patPlan
      ? order.positions.find(
          (p) => p.position !== null && p.coverageId === patPlan.PatPlanNum.toString()
        )
      : null;
    if (match?.position != null) thisPosition = match.position;
  }

  if (thisPosition < payerCount) {
    return {
      finalized: false,
      reason:
        `This was payer ${thisPosition} of ${payerCount} in the coverage order for ` +
        `${dos}. The patient's balance is not final until the last payer's ` +
        `remittance is posted.`,
      statementNum: statementNum.toString(),
    };
  }

  await prisma.cob_invoice_liability.upsert({
    where: { statement_num: statementNum },
    create: {
      statement_num: statementNum,
      patient_liability_finalized_at: new Date(),
      finalized_by: input.userNum ?? null,
      last_payer_claim_num: input.claimNum,
    },
    update: {
      patient_liability_finalized_at: new Date(),
      finalized_by: input.userNum ?? null,
      last_payer_claim_num: input.claimNum,
    },
  });

  return {
    finalized: true,
    reason:
      `Payer ${thisPosition} of ${payerCount} has adjudicated, so this was the last ` +
      `payer and the patient's balance is now final.`,
    statementNum: statementNum.toString(),
  };
};

/**
 * Everything COB needs to do when a remittance is posted, in one call.
 *
 * Called from the ERA poster and from manual EOB entry. Never throws: a
 * remittance that posted successfully must not be rolled back because a
 * ledger write or a task creation failed. Returns what it did so the caller
 * can surface it.
 */
export const onRemittancePosted = async (input: {
  claimNum: bigint;
  patNum: bigint;
  statementNum?: bigint | null;
  paidAmount: number;
  adjustments?: AdjustmentCode[];
  freeText?: string | null;
  userNum?: bigint | null;
  req?: Request;
}) => {
  const outcome: {
    cobDenial: Awaited<ReturnType<typeof cobService.handleCobDenial>> | null;
    ledgerEntries: number;
    finalization: Awaited<ReturnType<typeof finalizePatientLiabilityIfLastPayer>> | null;
    errors: string[];
  } = { cobDenial: null, ledgerEntries: 0, finalization: null, errors: [] };

  try {
    const result = await cobService.handleCobDenial({
      claimNum: input.claimNum,
      adjustments: input.adjustments || [],
      freeText: input.freeText,
      userNum: input.userNum,
      req: input.req,
    });
    outcome.cobDenial = result.handled ? result : null;
  } catch (error: any) {
    outcome.errors.push(`COB denial check failed: ${error?.message ?? error}`);
  }

  try {
    const dos = await prisma.claim.findUnique({
      where: { ClaimNum: input.claimNum },
      select: { DateService: true, InsSubNum: true, PatNum: true },
    });
    let position = 1;
    if (dos?.PatNum && dos.InsSubNum) {
      const order = await cobService.getOrderForDate(
        dos.PatNum.toString(),
        toIsoDate(dos.DateService) || new Date().toISOString().slice(0, 10)
      );
      const patPlan = await prisma.patplan.findFirst({
        where: { PatNum: dos.PatNum, InsSubNum: dos.InsSubNum },
      });
      const match =
        order && patPlan
          ? order.positions.find(
              (p) => p.position !== null && p.coverageId === patPlan.PatPlanNum.toString()
            )
          : null;
      if (match?.position != null) position = match.position;
    }

    const entries = await recordRemittanceInLedger({
      claimNum: input.claimNum,
      patNum: input.patNum,
      statementNum: input.statementNum ?? null,
      position,
      paidAmount: input.paidAmount,
      adjustments: input.adjustments || [],
      userNum: input.userNum,
    });
    outcome.ledgerEntries = entries.length;
  } catch (error: any) {
    outcome.errors.push(`Responsibility ledger write failed: ${error?.message ?? error}`);
  }

  try {
    outcome.finalization = await finalizePatientLiabilityIfLastPayer({
      claimNum: input.claimNum,
      userNum: input.userNum,
    });
  } catch (error: any) {
    outcome.errors.push(`Patient liability finalization failed: ${error?.message ?? error}`);
  }

  if (outcome.errors.length) {
    console.error('COB post-remittance handling had errors:', outcome.errors);
  }

  return outcome;
};
