import { prisma } from '../config/db.js';
import { BadRequestError, NotFoundError } from '../utils/error.util.js';
import { getNextId } from '../utils/opendental-ids.util.js';
import { agingService } from './aging.service.js';

const roundCurrency = (value: number): number => Math.round((value + Number.EPSILON) * 100) / 100;

const parseJsonSafe = (value: unknown): Record<string, any> => {
  if (typeof value !== 'string' || value.trim() === '') return {};
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
};

/**
 * The deductible this claim's procedures have ALREADY put into the plan's
 * metAmount, grouped by deductible row.
 *
 * Posting is the finalized invoice's job (invoiceService.finalizeInvoice), not
 * the claim's, so the claim's own estimate is not evidence that anything was
 * posted. Only procedures sitting on a statement that actually posted
 * (`deductiblePostedAt` on the statement meta) count here.
 *
 * era835 subtracts this from the payer's actual, so getting it wrong in either
 * direction is a real money bug: too high and the correction goes negative,
 * too low and a finalized invoice's deductible is counted twice.
 */
const collectPostedDeductibleByRow = async (
  claimNum: bigint,
): Promise<Record<string, number>> => {
  const claimProcs = await prisma.claimproc.findMany({
    where: { ClaimNum: claimNum, ProcNum: { not: null } },
    select: { ProcNum: true },
  });

  const procNums = claimProcs
    .map((cp) => cp.ProcNum)
    .filter((procNum): procNum is bigint => procNum !== null);
  if (procNums.length === 0) return {};

  const procs = await prisma.procedurelog.findMany({
    where: { ProcNum: { in: procNums }, StatementNum: { not: null } },
    select: { StatementNum: true, BillingNote: true },
  });
  if (procs.length === 0) return {};

  const statementNums = [
    ...new Set(
      procs
        .map((proc) => proc.StatementNum)
        .filter((statementNum): statementNum is bigint => statementNum !== null)
        .map((statementNum) => statementNum.toString()),
    ),
  ].map((statementNum) => BigInt(statementNum));

  const statements = await prisma.statement.findMany({
    where: { StatementNum: { in: statementNums } },
    select: { StatementNum: true, NoteBold: true },
  });

  const posted = new Set(
    statements
      .filter((statement) => Boolean(parseJsonSafe(statement.NoteBold).deductiblePostedAt))
      .map((statement) => statement.StatementNum.toString()),
  );
  if (posted.size === 0) return {};

  const byRow: Record<string, number> = {};
  for (const proc of procs) {
    if (!proc.StatementNum || !posted.has(proc.StatementNum.toString())) continue;
    const billingNote = parseJsonSafe(proc.BillingNote);
    const applied = roundCurrency(Number(billingNote.deductibleApplied || 0));
    if (applied <= 0) continue;
    const key = String(billingNote.deductibleRowKey || 'unassigned');
    byRow[key] = roundCurrency((byRow[key] ?? 0) + applied);
  }
  return byRow;
};

export type Parsed835Adjustment = {
  groupCode: string; // CO, PR, OA, PI, CR
  reasonCode: string; // 1, 2, 45, 96, etc.
  amount: number;
};

export type Parsed835ServiceLine = {
  procedureCode: string;
  billedAmount: number;
  paidAmount: number;
  serviceDate?: string;
  adjustments: Parsed835Adjustment[];
  writeOff: number;
  deductible: number;
};

export type Parsed835Claim = {
  claimIdentifier: string; // CLP01
  claimStatusCode: string; // CLP02 (1=Primary, 2=Secondary, 4=Denied, etc.)
  totalChargeAmount: number; // CLP03
  totalPaymentAmount: number; // CLP04
  patientResponsibility: number; // CLP05
  payerControlNumber?: string; // CLP07 (ICN)
  patientLastName?: string;
  patientFirstName?: string;
  serviceLines: Parsed835ServiceLine[];
  adjustments: Parsed835Adjustment[];
  writeOff: number;
  deductible: number;
  matchedClaimId?: string;
  status: 'matched' | 'unmatched';
  unmatchedReason?: string;
};

export type Parsed835File = {
  payerName?: string;
  payerId?: string;
  traceNumber?: string; // TRN02 (Check/EFT number)
  checkDate?: string; // BPR16
  paymentMethod?: string; // BPR04 (CHK, ACH, NON)
  totalPaymentAmount: number; // BPR02
  claims: Parsed835Claim[];
};

export class Era835Service {
  /**
   * Parses an ASC X12N 835 (005010X221A1) remittance file content.
   */
  parse835Content(content: string): Parsed835File {
    if (!content || !content.includes('ISA')) {
      throw new BadRequestError('Invalid X12 835 file: missing ISA header');
    }

    // Determine data element separator (character at index 3 of ISA segment)
    const isaIndex = content.indexOf('ISA');
    const dataSep = content[isaIndex + 3] || '*';

    // Determine segment terminator (character right before GS or next segment)
    let segTerm = '~';
    const first106 = content.slice(isaIndex, isaIndex + 110);
    if (first106.includes('~')) segTerm = '~';
    else if (first106.includes('\n')) segTerm = '\n';
    else if (first106.includes('^')) segTerm = '^';

    const rawSegments = content
      .split(segTerm)
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    const result: Parsed835File = {
      totalPaymentAmount: 0,
      claims: [],
    };

    let currentClaim: Parsed835Claim | null = null;
    let currentLine: Parsed835ServiceLine | null = null;

    for (const segStr of rawSegments) {
      const parts = segStr.split(dataSep).map((p) => p.trim());
      const segId = parts[0]?.toUpperCase();

      switch (segId) {
        // Financial Information
        case 'BPR': {
          result.totalPaymentAmount = parseFloat(parts[2]) || 0;
          result.paymentMethod = parts[4] || 'CHK';
          if (parts[16] && parts[16].length === 8) {
            const ccyy = parts[16].slice(0, 4);
            const mm = parts[16].slice(4, 6);
            const dd = parts[16].slice(6, 8);
            result.checkDate = `${ccyy}-${mm}-${dd}`;
          }
          break;
        }

        // Trace / Check Number
        case 'TRN': {
          result.traceNumber = parts[2] || '';
          break;
        }

        // Payer Identification
        case 'N1': {
          if (parts[1] === 'PR') {
            result.payerName = parts[2] || '';
            result.payerId = parts[4] || '';
          }
          break;
        }

        // Claim Payment Loop (CLP)
        case 'CLP': {
          if (currentLine && currentClaim) {
            currentClaim.serviceLines.push(currentLine);
            currentLine = null;
          }
          if (currentClaim) {
            result.claims.push(currentClaim);
          }

          const totalCharge = parseFloat(parts[3]) || 0;
          const totalPaid = parseFloat(parts[4]) || 0;
          const patResp = parseFloat(parts[5]) || 0;

          currentClaim = {
            claimIdentifier: parts[1] || '',
            claimStatusCode: parts[2] || '1',
            totalChargeAmount: totalCharge,
            totalPaymentAmount: totalPaid,
            patientResponsibility: patResp,
            payerControlNumber: parts[7] || '',
            serviceLines: [],
            adjustments: [],
            writeOff: 0,
            deductible: 0,
            status: 'unmatched',
          };
          break;
        }

        // Patient / Member Demographics
        case 'NM1': {
          if (currentClaim && parts[1] === 'QC') {
            currentClaim.patientLastName = parts[3] || '';
            currentClaim.patientFirstName = parts[4] || '';
          }
          break;
        }

        // Service Line Payment (SVC)
        case 'SVC': {
          if (currentLine && currentClaim) {
            currentClaim.serviceLines.push(currentLine);
          }

          // Format: AD:D0120 or HC:D0120 or D0120
          let code = parts[1] || '';
          if (code.includes(':')) {
            code = code.split(':')[1] || code;
          }

          const lineFee = parseFloat(parts[2]) || 0;
          const linePaid = parseFloat(parts[3]) || 0;

          currentLine = {
            procedureCode: code,
            billedAmount: lineFee,
            paidAmount: linePaid,
            adjustments: [],
            writeOff: 0,
            deductible: 0,
          };
          break;
        }

        // Service Date
        case 'DTM': {
          if (currentLine && parts[1] === '472' && parts[2]) {
            const raw = parts[2];
            if (raw.length === 8) {
              currentLine.serviceDate = `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`;
            }
          }
          break;
        }

        // Adjustments (Claim or Service Line level)
        case 'CAS': {
          const groupCode = parts[1] || 'CO';
          // CAS can repeat up to 6 adjustments: (groupCode, reason1, amt1, qty1, reason2, amt2, qty2...)
          for (let i = 2; i < parts.length; i += 3) {
            const reasonCode = parts[i];
            const amtStr = parts[i + 1];
            if (!reasonCode || !amtStr) continue;
            const amt = parseFloat(amtStr) || 0;

            const adj: Parsed835Adjustment = { groupCode, reasonCode, amount: amt };

            if (currentLine) {
              currentLine.adjustments.push(adj);
              if (groupCode === 'CO' && (reasonCode === '45' || reasonCode === '131')) {
                currentLine.writeOff += amt;
              }
              if (groupCode === 'PR' && reasonCode === '1') {
                currentLine.deductible += amt;
              }
            } else if (currentClaim) {
              currentClaim.adjustments.push(adj);
              if (groupCode === 'CO' && (reasonCode === '45' || reasonCode === '131')) {
                currentClaim.writeOff += amt;
              }
              if (groupCode === 'PR' && reasonCode === '1') {
                currentClaim.deductible += amt;
              }
            }
          }
          break;
        }
      }
    }

    if (currentLine && currentClaim) {
      currentClaim.serviceLines.push(currentLine);
    }
    if (currentClaim) {
      result.claims.push(currentClaim);
    }

    return result;
  }

  /**
   * Matches parsed claims to MedFlow database claims.
   */
  async matchClaims(parsed: Parsed835File): Promise<Parsed835File> {
    for (const item of parsed.claims) {
      let matchedClaim = null;

      // 1. Match by claimIdentifier against ClaimNum, ClaimIdentifier, or PreAuthString
      const numericId = /^\d+$/.test(item.claimIdentifier) ? BigInt(item.claimIdentifier) : null;
      if (numericId) {
        matchedClaim = await prisma.claim.findUnique({
          where: { ClaimNum: numericId },
          include: { patient: true, claimproc: true },
        });
      }

      if (!matchedClaim) {
        matchedClaim = await prisma.claim.findFirst({
          where: {
            ClaimType: { not: 'PreAuth' },
            OR: [
              { ClaimIdentifier: item.claimIdentifier },
              { PreAuthString: item.claimIdentifier },
              { PriorAuthorizationNumber: item.claimIdentifier },
            ],
          },
          include: { patient: true, claimproc: true },
        });
      }

      // 2. Fallback match by patient name + service date if not resolved
      if (!matchedClaim && item.patientLastName && item.serviceLines[0]?.serviceDate) {
        const dateObj = new Date(item.serviceLines[0].serviceDate);
        matchedClaim = await prisma.claim.findFirst({
          where: {
            ClaimType: { not: 'PreAuth' },
            patient: {
              LName: { contains: item.patientLastName, mode: 'insensitive' },
            },
            DateService: dateObj,
          },
          include: { patient: true, claimproc: true },
        });
      }

      if (matchedClaim) {
        item.matchedClaimId = matchedClaim.ClaimNum.toString();
        item.status = 'matched';
      } else {
        item.status = 'unmatched';
        item.unmatchedReason = `Claim identifier '${item.claimIdentifier}' not found in database`;
      }
    }

    return parsed;
  }

  /**
   * Auto-posts confident matched claims from an 835 ERA into claimproc, claim,
   * claimpayment, and patient aging.
   */
  async autoPostClaimPayments(
    parsed: Parsed835File,
    eraId?: string | bigint,
    userId?: string
  ): Promise<{ postedCount: number; unmatchedCount: number }> {
    let postedCount = 0;
    let unmatchedCount = 0;

    // Create or retrieve check payment batch in claimpayment
    const checkAmt = parsed.totalPaymentAmount || 0;
    const checkNum = (parsed.traceNumber || `ERA-${Date.now()}`).slice(0, 25);
    const checkDate = parsed.checkDate ? new Date(parsed.checkDate) : new Date();

    const claimPaymentNum = await getNextId('claimpayment', 'ClaimPaymentNum');
    await prisma.claimpayment.create({
      data: {
        ClaimPaymentNum: claimPaymentNum,
        CheckAmt: checkAmt,
        CheckNum: checkNum,
        CheckDate: checkDate,
        CarrierName: (parsed.payerName || 'Insurance Carrier').slice(0, 255),
        DateIssued: checkDate,
      },
    });

    for (const claimItem of parsed.claims) {
      if (claimItem.status !== 'matched' || !claimItem.matchedClaimId) {
        unmatchedCount++;
        continue;
      }

      const claimNum = BigInt(claimItem.matchedClaimId);
      const claim = await prisma.claim.findUnique({
        where: { ClaimNum: claimNum },
        include: {
          claimproc: {
            include: {
              procedurelog: true,
            },
          },
        },
      });

      if (!claim) {
        unmatchedCount++;
        continue;
      }

      // Declared outside the transaction so the reconciliation below can read them.
      let totalDedOnClaim = 0;
      const actualByRow: Record<string, number> = {};
      const isSecondaryClaim = String((claim as any).ClaimType ?? '').toLowerCase() === 'secondary';

      // What this claim currently holds against the plan's metAmount, read from
      // the claim's own Narrative. This - not `claimproc.DedApplied` - is the
      // authority for "already reserved": a claim that never reached
      // `readyForSubmission` holds nothing, while one that was reserved there
      // holds its estimate. Re-posting the same ERA therefore nets to zero.
      let heldByRow: Record<string, number> = {};
      let reconciledNarrative: Record<string, unknown> | null = null;
      try {
        const narrative = (claim as any).Narrative;
        reconciledNarrative = narrative ? JSON.parse(narrative) : null;
        if (
          reconciledNarrative
          && reconciledNarrative.deductibleHeld === true
          && typeof reconciledNarrative.deductibleReservedByRow === 'object'
          && reconciledNarrative.deductibleReservedByRow
        ) {
          // Something actually posted this estimate (today: a re-posted ERA).
          heldByRow = reconciledNarrative.deductibleReservedByRow as Record<string, number>;
        }
      } catch {
        reconciledNarrative = null;
        heldByRow = {};
      }

      // Nothing on the claim is holding the deductible, so fall back to what the
      // finalized invoice posted for these procedures. Submitting a claim does
      // not post any more (see reconcileDeductibleReservation), so the claim's
      // bare estimate must never be treated as money already in metAmount.
      if (Object.keys(heldByRow).length === 0) {
        heldByRow = await collectPostedDeductibleByRow(claimNum);
      }

      // Hoisted out of the transaction below so the COB hook, which runs
      // AFTER the commit, can read what was actually posted.
      let postedPaidAmount = 0;

      await prisma.$transaction(async (tx) => {
        let totalPaidOnClaim = 0;
        let totalWriteOffOnClaim = 0;
        // Deductible this claim had already reserved against the plan's
        // metAmount. Captured before the rows are overwritten with the payer's
        // actual amounts, so the delta below reconciles rather than double-counts.

        // Post line items
        if (claim.claimproc && claim.claimproc.length > 0) {
          for (let i = 0; i < claim.claimproc.length; i++) {
            const cp = claim.claimproc[i];
            const procCode =
              cp.CodeSent ||
              cp.procedurelog?.OldCode ||
              '';

            // Match to 835 service line by code or index
            const matchedLine =
              claimItem.serviceLines.find((l) => l.procedureCode === procCode) ||
              claimItem.serviceLines[i] ||
              null;

            const linePaid = matchedLine ? matchedLine.paidAmount : (i === 0 ? claimItem.totalPaymentAmount : 0);
            const lineWriteOff = matchedLine ? matchedLine.writeOff : (i === 0 ? claimItem.writeOff : 0);
            const lineDed = matchedLine ? matchedLine.deductible : (i === 0 ? claimItem.deductible : 0);

            totalPaidOnClaim += linePaid;
            totalWriteOffOnClaim += lineWriteOff;
            totalDedOnClaim += lineDed;

            // Key the payer's actual deductible by the same `deductibleRowKey`
            // the estimator wrote into BillingNote, so the delta below lands on
            // the right pool instead of a claim-level lump sum.
            const rowKey = (() => {
              try {
                return cp.procedurelog?.BillingNote
                  ? JSON.parse(cp.procedurelog.BillingNote).deductibleRowKey
                  : undefined;
              } catch {
                return undefined;
              }
            })();
            if (lineDed !== 0) {
              const key = rowKey || 'unassigned';
              actualByRow[key] = (actualByRow[key] ?? 0) + lineDed;
            }


            const rawReasons = matchedLine?.adjustments
              .map((a) => `${a.groupCode}-${a.reasonCode}: $${a.amount}`)
              .join('; ') || (claimItem.adjustments.map((a) => `${a.groupCode}-${a.reasonCode}: $${a.amount}`).join('; '));

            const reasonSummary = rawReasons ? rawReasons.slice(0, 255) : null;
            const remarks = (rawReasons || 'Auto-posted via X12 835 ERA').slice(0, 255);

            await tx.claimproc.update({
              where: { ClaimProcNum: cp.ClaimProcNum },
              data: {
                Status: 1, // Received
                InsPayAmt: linePaid,
                WriteOff: lineWriteOff,
                DedApplied: lineDed,
                ClaimPaymentNum: claimPaymentNum,
                DateCP: checkDate,
                Remarks: remarks,
                ClaimAdjReasonCodes: reasonSummary,
              },
            });
          }
        }

        // Update claim record
        await tx.claim.update({
          where: { ClaimNum: claim.ClaimNum },
          data: {
            ClaimStatus: 'R', // Received
            DateReceived: checkDate,
            InsPayAmt: totalPaidOnClaim,
            WriteOff: totalWriteOffOnClaim,
            DedApplied: totalDedOnClaim,
          },
        });
        postedPaidAmount = totalPaidOnClaim;

        // Record patient ledger payment entry
        if (claim.PatNum && totalPaidOnClaim > 0) {
          const payNum = await getNextId('payment', 'PayNum');
          await tx.payment.create({
            data: {
              PayNum: payNum,
              PatNum: claim.PatNum,
              PayAmt: totalPaidOnClaim,
              PayDate: checkDate,
              PayNote: JSON.stringify({
                claimId: claim.ClaimNum.toString(),
                eraId: eraId ? String(eraId) : null,
                checkNum,
                method: 'insurance',
                status: 'completed',
                notes: `Auto-posted from ERA check ${checkNum}`,
              }),
            },
          });
        }
      });

      // COB handling for this posted remittance: detect a coordination-of-
      // benefits denial, write the responsibility-ledger entries (including
      // the contractual adjustments, which are never the patient's money),
      // and finalize patient liability if this was the last payer in the
      // order.
      //
      // Deliberately after the posting transaction and deliberately
      // swallowing its own errors: the money has already been posted
      // correctly, and a ledger or task failure must not unwind a payment
      // the payer has actually made.
      if (claim.PatNum) {
        try {
          const { onRemittancePosted } = await import('./cob/claim-cob.service');
          const claimMeta = (() => {
            try {
              return claim.Narrative ? JSON.parse(claim.Narrative) : null;
            } catch {
              return null;
            }
          })();
          await onRemittancePosted({
            claimNum: claim.ClaimNum,
            patNum: claim.PatNum,
            statementNum: claimMeta?.invoiceId ? BigInt(claimMeta.invoiceId) : null,
            paidAmount: postedPaidAmount,
            // Claim-level adjustments plus every service line's, which is
            // where CARC 22 actually lands on a COB denial.
            adjustments: [
              ...claimItem.adjustments,
              ...claimItem.serviceLines.flatMap((line) => line.adjustments),
            ],
            userNum: userId ? BigInt(userId) : null,
          });
        } catch (err) {
          console.error('COB post-remittance handling failed for claim', claim.ClaimNum, err);
        }
      }

      // Reconcile the deductible against what the payer actually applied.
      // Without this the estimate is never corrected: a payer applying less than
      // we reserved would leave metAmount overstated and suppress the deductible
      // on the patient's next claim.
      if (claim.InsSubNum && !isSecondaryClaim) {
        // Union of keys so a row held but not applied (or vice versa) still nets
        // out to a real signed change rather than being dropped.
        const keys = new Set([...Object.keys(heldByRow), ...Object.keys(actualByRow)]);
        const deltaByRow: Record<string, number> = {};
        for (const key of keys) {
          // `unassigned` is a marker for "this line had no deductibleRowKey".
          // It is not a real pool, so route it to the documented Standard
          // fallback instead of letting it silently vanish.
          const pool = key === 'unassigned' ? 'standard' : key;
          const delta = roundCurrency((actualByRow[key] ?? 0) - (heldByRow[key] ?? 0));
          if (delta === 0) continue;
          deltaByRow[pool] = roundCurrency((deltaByRow[pool] ?? 0) + delta);
        }
        // No row keys anywhere: the payer reported a lump deductible. Attribute
        // it to Standard, the documented fallback pool.
        if (keys.size === 0 && totalDedOnClaim !== 0) {
          deltaByRow.standard = roundCurrency(totalDedOnClaim);
        }

        if (Object.keys(deltaByRow).length > 0) {
          try {
            const patPlan = await prisma.patplan.findFirst({
              where: { InsSubNum: claim.InsSubNum },
              orderBy: { Ordinal: 'asc' },
            });
            if (patPlan?.PatPlanNum) {
              const { patientInsuranceService } = await import('./patient-insurance.service');
              await patientInsuranceService.applyDeductibleMetAmountDelta(
                patPlan.PatPlanNum,
                deltaByRow,
                checkDate,
              );
              // Record what the claim now holds so re-posting this ERA is a no-op
              // and a later status change cannot release the payer's actual.
              await prisma.claim.update({
                where: { ClaimNum: claimNum },
                data: {
                  Narrative: JSON.stringify({
                    ...(reconciledNarrative ?? {}),
                    patPlanNum: patPlan.PatPlanNum.toString(),
                    deductibleReservedByRow: actualByRow,
                    deductibleHeld: true,
                  }),
                },
              });
            }
          } catch (err) {
            console.error('Failed to reconcile deductible metAmount from ERA:', err);
          }
        }
      }

      // Update patient aging outside the transaction
      if (claim.PatNum) {
        await agingService.updatePatientAging(claim.PatNum);
      }

      postedCount++;
    }

    return { postedCount, unmatchedCount };
  }
}

export const era835Service = new Era835Service();
