import { prisma } from '../config/db.js';
import { BadRequestError, NotFoundError } from '../utils/error.util.js';
import { getNextId } from '../utils/opendental-ids.util.js';
import { agingService } from './aging.service.js';

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

      await prisma.$transaction(async (tx) => {
        let totalPaidOnClaim = 0;
        let totalWriteOffOnClaim = 0;
        let totalDedOnClaim = 0;

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
