import { prisma } from '../config/db';
import { BadRequestError, ConflictError, NotFoundError } from '../utils/error.util';
import { logActivity } from '../utils/activity-logger.util';
import { getNextId } from '../utils/opendental-ids.util';
import { mapPatientToApi, mapProviderToApi } from '../utils/opendental-mappers.util';
import { adjustmentService } from './adjustment.service';
import { paymentService } from './payment.service';
import { claimService } from './claim.service';
import { patientInsuranceService } from './patient-insurance.service';

const roundCurrency = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

type StatementMeta = {
  appointmentId?: string;
  providerId?: string;
  insuranceCompanyId?: string;
  copayAmount?: number;
  paidAmount?: number;
  taxAmount?: number;
  discountAmount?: number;
  insurancePortion?: number;
  patientPortion?: number;
  status?: string;
  claimNumber?: string;
  claimSubmissionDate?: string;
  submissionMethod?: string;
  createdBy?: string;
  dueDate?: string;
  voidReason?: string;
  claimId?: string; // Added to store generated claim ID
};

type ItemMeta = {
  description?: string;
  unitPrice?: number;
  quantity?: number;
  cptCode?: string;
  serviceId?: string;
};

const buildBillingNote = (data: any) => {
  const payload: Record<string, any> = {};
  if (data.cptCode) payload.cptCode = data.cptCode;
  if (data.writeoff && Number(data.writeoff) > 0) payload.writeoff = Number(data.writeoff);
  if (data.ptPortion && Number(data.ptPortion) > 0) payload.ptPortion = Number(data.ptPortion);
  if (data.insPortion && Number(data.insPortion) > 0) payload.insPortion = Number(data.insPortion);
  if (data.dbi !== undefined && data.dbi !== null) payload.dbi = Boolean(data.dbi);
  if (data.paidAmount && Number(data.paidAmount) > 0) payload.paidAmount = Number(data.paidAmount);
  if (data.description) payload.description = data.description.substring(0, 100);
  if (data.unitPrice !== undefined) payload.unitPrice = Number(data.unitPrice);
  if (data.quantity !== undefined) payload.quantity = Number(data.quantity);
  return JSON.stringify(payload);
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

const getInvoiceNumber = async (): Promise<string> => {
  const recent = await prisma.statement.findMany({
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

export class InvoiceService {
  private mapProcedureLogToInvoiceItem(item: any, invoiceId?: string, code?: any) {
    const meta = parseJson<ItemMeta>(item.BillingNote);
    const quantity = Number(meta.quantity ?? item.UnitQty ?? 1) || 1;
    const unitPrice = Number(meta.unitPrice ?? (item.ProcFee ?? 0) / quantity) || 0;
    const totalPrice = Number(item.ProcFee) || roundCurrency(unitPrice * quantity);
    return {
      _id: item.ProcNum.toString(),
      invoiceId: invoiceId ?? item.StatementNum?.toString() ?? null,
      serviceId: item.CodeNum?.toString() ?? meta.serviceId ?? null,
      cptCode: meta.cptCode ?? code?.ProcCode ?? null,
      description: meta.description ?? code?.Descript ?? 'Service',
      quantity,
      unitPrice,
      totalPrice,
      ptPortion: Number((meta as any).ptPortion || 0),
      insPortion: Number((meta as any).insPortion || 0),
      writeoff: Number((meta as any).writeoff || 0),
      paidAmount: Number((meta as any).paidAmount || 0),
      dbi: (meta as any).dbi !== undefined ? Boolean((meta as any).dbi) : null,
    };
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
        if (meta.claimId) {
          console.log(`[InvoiceService] Invoice ${invoiceId} already has claim ${meta.claimId}, skipping`);
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
          console.log(`[InvoiceService] Existing claim found via Narrative, skipping`);
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

  private async getStatementById(statementId: string) {
    return prisma.statement.findUnique({
      where: { StatementNum: BigInt(statementId) },
    });
  }

  private mapStatementToInvoice(statement: any, meta: StatementMeta) {
    return {
      _id: statement.StatementNum.toString(),
      invoiceNumber: statement.ShortGUID ?? '',
      patientId: statement.PatNum?.toString() ?? null,
      appointmentId: meta.appointmentId ?? null,
      insuranceCompanyId: meta.insuranceCompanyId ?? null,
      providerId: meta.providerId ?? null,
      invoiceDate: statement.DateSent ?? null,
      dueDate: meta.dueDate ? new Date(meta.dueDate) : statement.DateRangeTo ?? null,
      totalAmount: Number(statement.BalTotal) || 0,
      insurancePortion: Number(statement.InsEst) || Number(meta.insurancePortion) || 0,
      patientPortion: Number(meta.patientPortion) || 0,
      copayAmount: Number(meta.copayAmount) || 0,
      paidAmount: Number(meta.paidAmount) || 0,
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

    let invoices = rows.map((row) => {
      const meta = parseJson<StatementMeta>(row.NoteBold);
      return this.mapStatementToInvoice(row, meta);
    });

    const uniquePatientIds = [...new Set(invoices.map(i => i.patientId).filter(id => id && /^\d+$/.test(id!)))];
    const patients = uniquePatientIds.length 
      ? await prisma.patient.findMany({ where: { PatNum: { in: uniquePatientIds.map(id => BigInt(id!)) } } })
      : [];
    const patientMap = new Map(patients.map(p => [p.PatNum.toString(), p]));

    invoices = await Promise.all(
      invoices.map(async (invoice) => {
        const patient = invoice.patientId ? patientMap.get(invoice.patientId) : null;
        const [provider, insuranceCompany] = await Promise.all([
          this.resolveProvider(invoice.providerId ?? null),
          this.resolveInsuranceCompany(invoice.insuranceCompanyId ?? null),
        ]);
        return { ...invoice, patient: patient ? mapPatientToApi(patient) : null, provider, insuranceCompany };
      })
    );

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
    const patient = invoice.PatNum
      ? await prisma.patient.findUnique({ where: { PatNum: invoice.PatNum } })
      : null;
    const appointment = await this.resolveAppointment(meta.appointmentId ?? null);
    const provider = await this.resolveProvider(meta.providerId ?? appointment?.providerId ?? null);
    const insuranceCompany = await this.resolveInsuranceCompany(meta.insuranceCompanyId ?? null);
    const items = await this.getInvoiceItems(invoice.StatementNum);
    return {
      invoice: {
        ...this.mapStatementToInvoice(invoice, meta),
        patient: patient ? mapPatientToApi(patient) : null,
        provider,
        insuranceCompany,
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
      providerId?: string;
      notes?: string;
      copayAmount?: number;
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

    // AUTO-GENERATE CLAIM — runs in background
    this.triggerClaimGeneration(statement.StatementNum, statement.PatNum, createdBy);

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
    await logActivity(userId, 'created', 'invoice_items', item.ProcNum.toString(), undefined, item, undefined, undefined, 'low');

    // AUTO-GENERATE CLAIM after adding item (if not already generated)
    this.triggerClaimGeneration(invoice.StatementNum, invoice.PatNum, userId);

    return this.mapProcedureLogToInvoiceItem(item, invoiceId, service);
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
    }>,
    userId: string
  ) {
    const invoice = await this.getStatementById(invoiceId);
    if (!invoice) throw new NotFoundError('Invoice not found');

    const meta = parseJson<StatementMeta>(invoice.NoteBold);
    if (String(meta.status) !== 'draft') throw new BadRequestError('Only draft invoices can be modified');

    const item = await prisma.procedurelog.findUnique({ where: { ProcNum: BigInt(itemId) } });
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
      where: { ProcNum: BigInt(itemId) },
      data: {
        CodeNum: service?.CodeNum ?? item.CodeNum ?? null,
        UnitQty: quantity,
        ProcFee: totalPrice,
        BillingNote: buildJson({
          description: updates.description ?? currentMeta.description ?? service?.Descript ?? 'Service',
          unitPrice,
          quantity,
          cptCode: updates.cptCode ?? currentMeta.cptCode ?? service?.ProcCode ?? null,
          serviceId: service?.CodeNum?.toString() ?? currentMeta.serviceId ?? null,
        }),
      },
    });

    await this.recalculateInvoice(invoiceId);
    await logActivity(userId, 'updated', 'invoice_items', itemId, item, updated, undefined, undefined, 'low');
    return this.mapProcedureLogToInvoiceItem(updated, invoiceId, service);
  }

  async deleteInvoiceItem(invoiceId: string, itemId: string, userId: string) {
    const invoice = await this.getStatementById(invoiceId);
    if (!invoice) throw new NotFoundError('Invoice not found');

    const meta = parseJson<StatementMeta>(invoice.NoteBold);
    if (String(meta.status) !== 'draft') throw new BadRequestError('Only draft invoices can be modified');

    const item = await prisma.procedurelog.findUnique({ where: { ProcNum: BigInt(itemId) } });
    if (!item || item.StatementNum?.toString() !== invoiceId) throw new NotFoundError('Invoice item not found');

    await prisma.procedurelog.delete({ where: { ProcNum: BigInt(itemId) } });
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

    await prisma.procedurelog.deleteMany({ where: { StatementNum: invoice.StatementNum } });
    await prisma.statement.delete({ where: { StatementNum: invoice.StatementNum } });
    await logActivity(userId, 'deleted', 'invoices', invoiceId, this.mapStatementToInvoice(invoice, meta), undefined, undefined, undefined, 'medium');
    return { message: 'Invoice deleted successfully' };
  }

  async updateInvoice(
    invoiceId: string,
    updates: Partial<{
      dueDate: Date;
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
        StatementType: updates.status ?? undefined,
        NoteBold: buildJson(nextMeta),
      },
    });

    await this.recalculateInvoice(invoiceId, coveragePercent);
    await logActivity(userId, 'updated', 'invoices', invoiceId, this.mapStatementToInvoice(invoice, meta), this.mapStatementToInvoice(updated, nextMeta), undefined, undefined, 'low');
    return this.mapStatementToInvoice(updated, nextMeta);
  }

  async recalculateInvoice(invoiceId: string, insuranceCoveragePercent?: number) {
    const invoice = await this.getStatementById(invoiceId);
    if (!invoice) throw new NotFoundError('Invoice not found');

    const meta = parseJson<StatementMeta>(invoice.NoteBold);
    const items = await prisma.procedurelog.findMany({ where: { StatementNum: invoice.StatementNum } });

    const codeNums = items.map((item) => item.CodeNum).filter((codeNum): codeNum is bigint => codeNum !== null && codeNum !== undefined);
    const codes = codeNums.length ? await prisma.procedurecode.findMany({ where: { CodeNum: { in: codeNums } } }) : [];
    const codeMap = new Map(codes.map((code) => [code.CodeNum?.toString(), code]));

    const totalAmount = items.reduce((sum, item) => sum + (Number(item.ProcFee) || 0), 0);
    const taxAmount = items.reduce((sum, item) => {
      const code = item.CodeNum ? codeMap.get(item.CodeNum.toString()) : null;
      const rate = code?.TaxCode ? Number.parseFloat(code.TaxCode) : 0;
      return sum + (Number(item.ProcFee) || 0) * ((Number.isFinite(rate) ? rate : 0) / 100);
    }, 0);

    const discountAmount = Math.min(Number(meta.discountAmount) || 0, totalAmount);
    const subtotal = totalAmount - discountAmount + taxAmount;

    let insurancePortion = Number(meta.insurancePortion) || 0;
    if (insuranceCoveragePercent !== undefined) {
      insurancePortion = roundCurrency((subtotal * insuranceCoveragePercent) / 100);
    }

    const patientPortion = roundCurrency(Math.max(0, subtotal - insurancePortion));
    const totalPaid = items.reduce((sum, item) => {
      const itemMeta = parseJson<any>(item.BillingNote);
      return sum + (Number(itemMeta.paidAmount) || 0);
    }, 0);

    const balanceDue = roundCurrency(Math.max(0, subtotal - totalPaid));
    const nextMeta: StatementMeta = { ...meta, taxAmount: roundCurrency(taxAmount), discountAmount: roundCurrency(discountAmount), insurancePortion, patientPortion, paidAmount: totalPaid };

    const updated = await prisma.statement.update({
      where: { StatementNum: invoice.StatementNum },
      data: { BalTotal: roundCurrency(balanceDue), InsEst: roundCurrency(insurancePortion), NoteBold: buildJson(nextMeta) },
    });

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

  async finalizeInvoice(invoiceId: string, userId: string) {
    const invoice = await this.getStatementById(invoiceId);
    if (!invoice) throw new NotFoundError('Invoice not found');

    const meta = parseJson<StatementMeta>(invoice.NoteBold);
    if (String(meta.status) !== 'draft') throw new BadRequestError('Only draft invoices can be finalized');

    await this.recalculateInvoice(invoiceId);
    const nextMeta: StatementMeta = { ...meta, status: 'pending' };

    const updated = await prisma.statement.update({
      where: { StatementNum: invoice.StatementNum },
      data: { StatementType: 'pending', NoteBold: buildJson(nextMeta) },
    });

    await logActivity(userId, 'updated', 'invoices', invoiceId, this.mapStatementToInvoice(invoice, meta), this.mapStatementToInvoice(updated, nextMeta), undefined, undefined, 'low');

    // AUTO-GENERATE CLAIM after finalization (covers any scenario where items were added later)
    this.triggerClaimGeneration(invoice.StatementNum, invoice.PatNum, userId);

    return this.mapStatementToInvoice(updated, nextMeta);
  }

  async voidInvoice(invoiceId: string, reason: string | undefined, userId: string) {
    const invoice = await this.getStatementById(invoiceId);
    if (!invoice) throw new NotFoundError('Invoice not found');

    const meta = parseJson<StatementMeta>(invoice.NoteBold);
    if (String(meta.status) === 'void') throw new BadRequestError('Invoice is already void');

    const nextMeta: StatementMeta = { ...meta, status: 'void', voidReason: reason ?? meta.voidReason };

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
      items: Array<{
        code: string;
        description: string;
        date?: string;
        site?: string;
        provider?: string;
        writeoff?: number;
        ptPortion?: number;
        insPortion?: number;
        charge?: number;
        balance?: number;
        dbi?: boolean;
        completed?: boolean;
      }>;
    },
    createdBy: string
  ) {
    const patientId = BigInt(data.patientId);
    const patient = await prisma.patient.findUnique({ where: { PatNum: patientId } });
    if (!patient) throw new NotFoundError('Patient not found');

    const invoiceNumber = await getInvoiceNumber();
    const statementNum = await getNextId('statement', 'StatementNum');
    const dueDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    let totalAmount = 0;
    let totalInsPortion = 0;
    let totalPtPortion = 0;

    for (const item of data.items) {
      totalAmount += Number(item.charge ?? 0);
      totalInsPortion += Number(item.insPortion ?? 0);
      totalPtPortion += Number(item.ptPortion ?? 0);
    }

    const meta: StatementMeta = {
      copayAmount: 0,
      paidAmount: 0,
      taxAmount: 0,
      discountAmount: 0,
      insurancePortion: totalInsPortion,
      patientPortion: totalPtPortion,
      status: 'draft',
      createdBy,
      dueDate: dueDate.toISOString(),
    };

    const statement = await prisma.statement.create({
      data: {
        StatementNum: statementNum,
        PatNum: patientId,
        DateSent: new Date(),
        DateRangeFrom: new Date(),
        DateRangeTo: dueDate,
        Note: 'Standalone Invoice',
        NoteBold: buildJson(meta),
        IsInvoice: 1,
        StatementType: 'draft',
        ShortGUID: invoiceNumber,
        InsEst: totalInsPortion,
        BalTotal: totalAmount,
      },
    });

    for (const item of data.items) {
      const procNum = await getNextId('procedurelog', 'ProcNum');
      const service = await prisma.procedurecode.findFirst({ where: { ProcCode: item.code } });

      await prisma.procedurelog.create({
        data: {
          ProcNum: procNum,
          PatNum: patientId,
          ProcDate: item.date ? new Date(item.date) : new Date(),
          ProcFee: Number(item.charge ?? 0),
          UnitQty: 1,
          CodeNum: service?.CodeNum ?? null,
          StatementNum: statementNum,
          ProcStatus: item.completed ? 2 : 1,
          BillingNote: buildJson({
            description: item.description,
            unitPrice: Number(item.charge ?? 0),
            quantity: 1,
            cptCode: item.code,
            serviceId: service?.CodeNum?.toString() ?? null,
            site: item.site ?? 'None',
            provider: item.provider ?? 'Default',
            writeoff: Number(item.writeoff ?? 0),
            ptPortion: Number(item.ptPortion ?? 0),
            insPortion: Number(item.insPortion ?? 0),
            charge: Number(item.charge ?? 0),
            balance: Number(item.balance ?? 0),
            dbi: Boolean(item.dbi),
            completed: Boolean(item.completed),
          }),
        },
      });
    }

    await this.recalculateInvoice(statementNum.toString());

    const finalStatement = await prisma.statement.findUnique({ where: { StatementNum: statementNum } });
    const finalMeta = parseJson<StatementMeta>(finalStatement?.NoteBold);

    await logActivity(createdBy, 'created', 'invoices', statementNum.toString(), undefined, this.mapStatementToInvoice(finalStatement, finalMeta), undefined, undefined, 'medium');

    // AUTO-GENERATE CLAIM — runs in background
    this.triggerClaimGeneration(statementNum, patientId, createdBy);

    return this.mapStatementToInvoice(finalStatement, finalMeta);
  }

  async markItemPaid(invoiceId: string, itemId: string, amount: number) {
    const invoice = await this.getStatementById(invoiceId);
    if (!invoice) throw new NotFoundError('Invoice not found');

    const meta = parseJson<StatementMeta>(invoice.NoteBold);
    if (String(meta.status) === 'void') throw new BadRequestError('Cannot pay a voided invoice');

    const item = await prisma.procedurelog.findUnique({ where: { ProcNum: BigInt(itemId) } });
    if (!item || item.StatementNum?.toString() !== invoiceId) throw new NotFoundError('Invoice item not found');

    const itemMeta = parseJson<ItemMeta>(item.BillingNote);
    const currentPaid = Number((itemMeta as any).paidAmount || 0);
    const newPaid = roundCurrency(currentPaid + amount);

    await prisma.procedurelog.update({
      where: { ProcNum: BigInt(itemId) },
      data: { BillingNote: buildJson({ ...itemMeta, paidAmount: newPaid }) },
    });

    await this.recalculateInvoice(invoiceId);
    return { success: true, message: 'Item payment recorded', itemId, paidAmount: newPaid };
  }

  async getPatientCompositeLedger(patientId: string) {
    const invoiceRows = await prisma.statement.findMany({
      where: { PatNum: BigInt(patientId), IsInvoice: 1 },
      orderBy: { DateSent: 'desc' },
    });

    const patientRow = await prisma.patient.findUnique({ where: { PatNum: BigInt(patientId) } });
    const mappedPatient = patientRow ? mapPatientToApi(patientRow) : null;

    const invoices = await Promise.all(
      invoiceRows.map(async (row) => {
        const meta = parseJson<StatementMeta>(row.NoteBold);
        const [provider, insuranceCompany, items] = await Promise.all([
          this.resolveProvider(meta.providerId ?? null),
          this.resolveInsuranceCompany(meta.insuranceCompanyId ?? null),
          this.getInvoiceItems(row.StatementNum),
        ]);
        return {
          ...this.mapStatementToInvoice(row, meta),
          patient: mappedPatient,
          provider,
          insuranceCompany,
          lineItems: items,
        };
      })
    );

    const adjustmentsResult = await adjustmentService.getAdjustmentsByPatient(patientId, 1, 1000);
    const paymentsResult = await paymentService.getPaymentsByPatient(patientId, 1, 1000);
    const claimsResult = await claimService.getAllClaims(1, 1000, { patientId });

    return {
      invoices,
      adjustments: adjustmentsResult.adjustments,
      payments: paymentsResult.payments,
      claims: claimsResult.claims,
    };
  }
}

export const invoiceService = new InvoiceService();