import { prisma } from '../config/db';
import { NotFoundError, BadRequestError } from '../utils/error.util';
import { logActivity } from '../utils/activity-logger.util';
import { getNextId } from '../utils/opendental-ids.util';
import { mapPatientToApi } from '../utils/opendental-mappers.util';

export class AdjustmentService {
  private mapAdjustmentToApi(row: any) {
    const rawNote = row.AdjNote ?? '';
    const noteLower = String(rawNote).toLowerCase();
    const isVoided =
      noteLower.includes('[voided]') ||
      noteLower.includes('void') ||
      noteLower.includes('voided');
    const status = isVoided ? 'void' : 'completed';

    return {
      _id: row.AdjNum.toString(),
      patientId: row.PatNum?.toString() ?? null,
      amount: Number(row.AdjAmt) || 0,
      date: row.AdjDate ?? null,
      type: row.AdjType?.toString() ?? null,
      providerId: row.ProvNum?.toString() ?? null,
      notes: rawNote ?? null,
      status,
      isVoided,
      createdAt: row.DateEntry ?? null,
      updatedAt: row.SecDateTEdit ?? null,
    };
  }

  private async enrichAdjustment(adjustment: any) {
    const patient = adjustment.patientId
      ? await prisma.patient.findUnique({
          where: { PatNum: BigInt(adjustment.patientId) },
        })
      : null;

    return {
      ...adjustment,
      patient: patient ? mapPatientToApi(patient) : null,
    };
  }

  async getAllAdjustments(
    page = 1,
    limit = 10,
    filters: {
      patientId?: string;
      startDate?: string;
      endDate?: string;
    } = {}
  ) {
    const skip = (page - 1) * limit;
    const where: any = {};

    if (filters.patientId) where.PatNum = BigInt(filters.patientId);

    if (filters.startDate || filters.endDate) {
      where.AdjDate = {};
      if (filters.startDate) where.AdjDate.gte = new Date(filters.startDate);
      if (filters.endDate) where.AdjDate.lte = new Date(filters.endDate);
    }

    const [rows, total] = await Promise.all([
      prisma.adjustment.findMany({
        where,
        orderBy: { AdjDate: 'desc' },
        skip,
        take: limit,
      }),
      prisma.adjustment.count({ where }),
    ]);

    const adjustments = await Promise.all(
      rows.map((row) => this.enrichAdjustment(this.mapAdjustmentToApi(row)))
    );

    return {
      adjustments,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  async getAdjustmentById(adjustmentId: string) {
    const adjustment = await prisma.adjustment.findUnique({
      where: { AdjNum: BigInt(adjustmentId) },
    });
    if (!adjustment) {
      throw new NotFoundError('Adjustment not found');
    }

    return this.enrichAdjustment(this.mapAdjustmentToApi(adjustment));
  }

  async createAdjustment(
    data: {
      patientId: string;
      amount: number;
      date: Date;
      type?: string;
      providerId?: string;
      notes?: string;
      invoiceId?: string;
    },
    userId: string
  ) {
    if (!data.amount) {
      throw new BadRequestError('Adjustment amount is required');
    }

    const adjNum = await getNextId('adjustment', 'AdjNum');
    let statementNum: bigint | undefined =
      data.invoiceId && /^\d+$/.test(data.invoiceId)
        ? BigInt(data.invoiceId)
        : undefined;
    if (!statementNum && data.notes) {
      const match = data.notes.match(/Invoice\s*#\s*(\d+)/i);
      if (match) {
        statementNum = BigInt(match[1]);
      }
    }

    const adjustment = await prisma.adjustment.create({
      data: {
        AdjNum: adjNum,
        PatNum: BigInt(data.patientId),
        AdjAmt: data.amount,
        AdjDate: data.date,
        AdjType: data.type ? BigInt(data.type) : undefined,
        ProvNum: data.providerId ? BigInt(data.providerId) : undefined,
        AdjNote: data.notes,
        StatementNum: statementNum,
        DateEntry: new Date(),
        SecUserNumEntry: BigInt(userId),
      },
    });

    await logActivity(
      userId,
      'created',
      'adjustments',
      adjustment.AdjNum.toString(),
      undefined,
      adjustment
    );

    if (statementNum) {
      const { invoiceService } = await import('./invoice.service');
      await invoiceService
        .recalculateInvoice(statementNum.toString())
        .catch(() => {});
    }

    return this.enrichAdjustment(this.mapAdjustmentToApi(adjustment));
  }

  async updateAdjustment(
    adjustmentId: string,
    updates: Partial<{
      amount: number;
      date: Date;
      type: string;
      providerId: string;
      notes: string;
    }>,
    userId: string
  ) {
    const adjustment = await prisma.adjustment.findUnique({
      where: { AdjNum: BigInt(adjustmentId) },
    });
    if (!adjustment) {
      throw new NotFoundError('Adjustment not found');
    }

    const updated = await prisma.adjustment.update({
      where: { AdjNum: adjustment.AdjNum },
      data: {
        AdjAmt: updates.amount ?? undefined,
        AdjDate: updates.date ?? undefined,
        AdjType: updates.type ? BigInt(updates.type) : undefined,
        ProvNum: updates.providerId ? BigInt(updates.providerId) : undefined,
        AdjNote: updates.notes ?? undefined,
      },
    });

    await logActivity(
      userId,
      'updated',
      'adjustments',
      adjustmentId,
      adjustment,
      updated
    );

    if (updated.StatementNum) {
      const { invoiceService } = await import('./invoice.service');
      await invoiceService
        .recalculateInvoice(updated.StatementNum.toString())
        .catch(() => {});
    }

    return this.enrichAdjustment(this.mapAdjustmentToApi(updated));
  }

  async deleteAdjustment(adjustmentId: string, userId: string) {
    const adjustment = await prisma.adjustment.findUnique({
      where: { AdjNum: BigInt(adjustmentId) },
    });
    if (!adjustment) {
      throw new NotFoundError('Adjustment not found');
    }

    // If this adjustment is an Income Transfer audit record, attempt to revert the
    // transfer: move the amount from patient portion back to insurance portion
    // on the linked procedure's BillingNote, and update any linked claim fields.
    try {
      const note = adjustment.AdjNote || '';
      if (note.includes('Income Transfer')) {
        // Parse the transferred amount from the note (e.g. "$12.34")
        const m = (note.match(/\$([0-9,\.]+)/) || [])[1];
        const transferAmt = m ? parseFloat(m.replace(/,/g, '')) : NaN;
        console.log(
          `Adjustment delete: detected Income Transfer adj ${adjustment.AdjNum}, parsed amount: ${transferAmt}, procNum: ${adjustment.ProcNum}`
        );
        if (!isNaN(transferAmt)) {
          // Try direct ProcNum first
          let proc: any = null;
          if (adjustment.ProcNum)
            proc = await prisma.procedurelog.findUnique({
              where: { ProcNum: adjustment.ProcNum },
            });

          // Fallback: try to find a procedure on the same statement with a matching note or amounts
          if (!proc && adjustment.StatementNum) {
            const candidates = await prisma.procedurelog.findMany({
              where: { StatementNum: adjustment.StatementNum },
            });
            // Prefer proc whose BillingNote contains 'Income Transfer' or whose ptPortion seems >= transferAmt
            proc =
              candidates.find((c: any) =>
                (c.BillingNote || '').includes('Income Transfer')
              ) ||
              candidates.find((c: any) => {
                try {
                  const bn = c.BillingNote ? JSON.parse(c.BillingNote) : {};
                  const pt = Number(
                    bn.ptPortion || bn.ptAmt || bn.patientPortion || 0
                  );
                  return pt >= transferAmt;
                } catch (e) {
                  return false;
                }
              }) ||
              candidates[0];
          }

          if (proc) {
            // parse existing BillingNote
            let bn: any = {};
            try {
              bn = proc.BillingNote ? JSON.parse(proc.BillingNote) : {};
            } catch (e) {
              bn = {};
            }
            console.log('Adjustment delete: proc found', {
              ProcNum: proc.ProcNum,
              BillingNote: bn,
            });

            // Support multiple key names for ins/pt portions
            const insKeys = [
              'insPortion',
              'insAmt',
              'insuranceAmount',
              'insurance',
            ];
            const ptKeys = [
              'ptPortion',
              'ptAmt',
              'patientPortion',
              'patientAmount',
              'ptPart',
            ];

            const currentIns =
              insKeys.reduce((acc, k) => acc || Number(bn[k] || 0), 0) || 0;
            const currentPt =
              ptKeys.reduce((acc, k) => acc || Number(bn[k] || 0), 0) || 0;

            const newPt = Math.max(
              0,
              Math.round((currentPt - transferAmt + Number.EPSILON) * 100) / 100
            );
            const newIns =
              Math.round((currentIns + transferAmt + Number.EPSILON) * 100) / 100;

            // Update primary canonical keys and also any alternative keys that existed
            const updatedBn = { ...bn };
            updatedBn.insPortion = newIns;
            updatedBn.ptPortion = newPt;
            for (const k of insKeys)
              if (bn[k] !== undefined) updatedBn[k] = newIns;
            for (const k of ptKeys)
              if (bn[k] !== undefined) updatedBn[k] = newPt;

            await prisma.procedurelog.update({
              where: { ProcNum: proc.ProcNum },
              data: { BillingNote: JSON.stringify(updatedBn) },
            });
            console.log('Adjustment delete: updated BillingNote', updatedBn);

            // If the invoice/statement meta links a claim, attempt to revert claim changes
            if (adjustment.StatementNum) {
              const statement = await prisma.statement.findUnique({
                where: { StatementNum: adjustment.StatementNum },
              });
              if (statement) {
                let meta: any = {};
                try {
                  meta = statement.NoteBold
                    ? JSON.parse(statement.NoteBold)
                    : {};
                } catch (e) {
                  meta = {};
                }
                const claimId = meta?.claimId;
                if (claimId && /^\d+$/.test(String(claimId))) {
                  const claim = await prisma.claim.findUnique({
                    where: { ClaimNum: BigInt(claimId) },
                  });
                  if (claim) {
                    const currentInsPayEst = Number(claim.InsPayEst) || 0;
                    const currentDedApplied = Number(claim.DedApplied) || 0;
                    const revertAmt = transferAmt;
                    const newInsPayEst =
                      Math.round(
                        (currentInsPayEst + revertAmt + Number.EPSILON) * 100
                      ) / 100;
                    const newDedApplied = Math.max(
                      0,
                      Math.round(
                        (currentDedApplied - revertAmt + Number.EPSILON) * 100
                      ) / 100
                    );
                    await prisma.claim.update({
                      where: { ClaimNum: BigInt(claimId) },
                      data: {
                        InsPayEst: newInsPayEst,
                        DedApplied: newDedApplied,
                      },
                    });
                    console.log('Adjustment delete: reverted claim', {
                      claimId,
                      newInsPayEst,
                      newDedApplied,
                    });
                  }
                }
              }
            }
          } else {
            console.warn(
              'Adjustment delete: could not locate procedure to revert transfer for adjustment',
              adjustment.AdjNum
            );
          }
        }
      }
    } catch (err) {
      // Do not block deletion on revert errors; log and continue
      console.warn(
        'Failed to revert income transfer during adjustment delete:',
        err
      );
    }

    // Instead of deleting the adjustment row (which differs from how payments are voided),
    // mark the adjustment as voided by updating its note and edit timestamp. This mirrors
    // the payment void flow which marks payments as 'void' in their meta rather than removing them.
    const voidMarker = '[VOIDED]';
    const voidNote = `${voidMarker} ${adjustment.AdjNote ?? ''}`.trim();

    const updated = await prisma.adjustment.update({
      where: { AdjNum: adjustment.AdjNum },
      data: {
        AdjNote: voidNote,
        SecDateTEdit: new Date(),
      },
    });

    await logActivity(
      userId,
      'updated',
      'adjustments',
      adjustmentId,
      adjustment,
      updated
    );

    if (adjustment.StatementNum) {
      const { invoiceService } = await import('./invoice.service');
      await invoiceService
        .recalculateInvoice(adjustment.StatementNum.toString())
        .catch(() => {});
    }

    return { message: 'Adjustment voided successfully' };
  }

  async getAdjustmentsByPatient(patientId: string, page = 1, limit = 10) {
    return this.getAllAdjustments(page, limit, { patientId });
  }
}

export const adjustmentService = new AdjustmentService();
