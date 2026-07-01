import crypto from 'crypto';
import { prisma } from '../config/db';
import { BadRequestError, NotFoundError } from '../utils/error.util';
import { getNextId } from '../utils/opendental-ids.util';

type EraStatus = 'imported' | 'processing' | 'processed' | 'error' | 'partial';

type EraItemStatus = 'matched' | 'unmatched';

type EraItem = {
  id: string;
  patientName?: string;
  claimNumber?: string;
  invoiceNumber?: string;
  claimId?: string;
  invoiceId?: string;
  amount: number;
  paymentDate?: string;
  insurance?: string;
  status: EraItemStatus;
  posted?: boolean;
};

type EraMeta = {
  eraType: 'imported_file';
  fileName: string;
  status: EraStatus;
  totalRecords: number;
  matchedCount: number;
  unmatchedCount: number;
  postedCount: number;
  totalAmount: number;
  autoPosted?: boolean;
  items: EraItem[];
};

type EraFilters = {
  search?: string;
  status?: string;
  startDate?: string;
  endDate?: string;
};

type UnmatchedFilters = {
  search?: string;
  startDate?: string;
  endDate?: string;
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

const normalizeEraStatus = (value?: string | null): EraStatus => {
  const normalized = String(value || '').toLowerCase();
  switch (normalized) {
    case 'processing':
      return 'processing';
    case 'processed':
      return 'processed';
    case 'error':
      return 'error';
    case 'partial':
      return 'partial';
    default:
      return 'imported';
  }
};

export class EraService {
  private async findClaimIdByNumber(claimNumber: string): Promise<string | null> {
    const numericPk = toBigInt(claimNumber);

    if (numericPk) {
      const byPk = await prisma.claim.findUnique({ where: { ClaimNum: numericPk } });
      if (byPk && byPk.ClaimType !== 'PreAuth') {
        return byPk.ClaimNum.toString();
      }
    }

    const byCode = await prisma.claim.findFirst({
      where: {
        ClaimType: { not: 'PreAuth' },
        OR: [
          { PreAuthString: claimNumber },
          { PriorAuthorizationNumber: claimNumber },
          { ClaimIdentifier: claimNumber },
        ],
      },
      orderBy: { ClaimNum: 'desc' },
    });

    return byCode ? byCode.ClaimNum.toString() : null;
  }

  private async findInvoiceIdByNumber(invoiceNumber: string): Promise<string | null> {
    const numericPk = toBigInt(invoiceNumber);

    if (numericPk) {
      const byPk = await prisma.statement.findUnique({ where: { StatementNum: numericPk } });
      if (byPk) {
        return byPk.StatementNum.toString();
      }
    }

    const byCode = await prisma.statement.findFirst({
      where: { ShortGUID: invoiceNumber },
      orderBy: { StatementNum: 'desc' },
    });

    return byCode ? byCode.StatementNum.toString() : null;
  }

  private parseCsvItems(content: string): EraItem[] {
    const lines = content
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);

    if (!lines.length) return [];

    const maybeHeader = (lines[0] ?? '').toLowerCase();
    const hasHeader =
      maybeHeader.includes('patient') ||
      maybeHeader.includes('claim') ||
      maybeHeader.includes('invoice') ||
      maybeHeader.includes('amount');

    const rows = hasHeader ? lines.slice(1) : lines;

    return rows
      .map((line) => line.split(',').map((value) => value.trim()))
      .filter((parts) => parts.some((value) => value.length > 0))
      .map((parts) => {
        const amount = Number.parseFloat(parts[3] || '0');
        const paymentDate = parts[4] ? new Date(parts[4]) : null;
        return {
          id: crypto.randomUUID(),
          patientName: parts[0] || undefined,
          claimNumber: parts[1] || undefined,
          invoiceNumber: parts[2] || undefined,
          amount: Number.isFinite(amount) ? amount : 0,
          paymentDate: paymentDate && !Number.isNaN(paymentDate.getTime()) ? paymentDate.toISOString() : undefined,
          insurance: parts[5] || undefined,
          status: 'unmatched',
          posted: false,
        } satisfies EraItem;
      });
  }

  private parseTextItems(content: string): EraItem[] {
    const lines = content
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .slice(0, 200);

    const items = lines.map((line) => {
      const claimMatch = line.match(/(?:claim|clm)\s*(?:number|#)?\s*[:#-]?\s*([A-Za-z0-9-]+)/i);
      const invoiceMatch = line.match(/(?:invoice|inv)\s*(?:number|#)?\s*[:#-]?\s*([A-Za-z0-9-]+)/i);
      const amountMatch = line.match(/\$?([0-9]+(?:\.[0-9]{1,2})?)/);
      const patientMatch = line.match(/patient\s*[:#-]?\s*([A-Za-z\s,'-.]+)/i);

      return {
        id: crypto.randomUUID(),
        patientName: patientMatch?.[1]?.trim() || undefined,
        claimNumber: claimMatch?.[1]?.trim() || undefined,
        invoiceNumber: invoiceMatch?.[1]?.trim() || undefined,
        amount: amountMatch?.[1] ? Number.parseFloat(amountMatch[1]) : 0,
        paymentDate: undefined,
        insurance: undefined,
        status: 'unmatched',
        posted: false,
      } satisfies EraItem;
    });

    return items.filter((item) => item.claimNumber || item.invoiceNumber || item.amount > 0 || item.patientName);
  }

  private async enrichMatches(items: EraItem[]): Promise<EraItem[]> {
    const enriched: EraItem[] = [];

    for (const item of items) {
      const next: EraItem = { ...item };

      if (!next.claimId && next.claimNumber) {
        const resolvedClaimId = await this.findClaimIdByNumber(next.claimNumber);
        if (resolvedClaimId) {
          next.claimId = resolvedClaimId;
        }
      }

      if (!next.invoiceId && next.invoiceNumber) {
        const resolvedInvoiceId = await this.findInvoiceIdByNumber(next.invoiceNumber);
        if (resolvedInvoiceId) {
          next.invoiceId = resolvedInvoiceId;
        }
      }

      if (!next.invoiceId && next.claimId) {
        const claim = await prisma.claim.findUnique({ where: { ClaimNum: BigInt(next.claimId) } });
        const meta = parseJson<Record<string, any>>(claim?.Narrative);
        if (meta.invoiceId) {
          next.invoiceId = String(meta.invoiceId);
        }
      }

      next.status = next.claimId || next.invoiceId ? 'matched' : 'unmatched';
      enriched.push(next);
    }

    return enriched;
  }

  private buildEraMeta(fileName: string, items: EraItem[]): EraMeta {
    const matchedCount = items.filter((item) => item.status === 'matched').length;
    const unmatchedCount = items.length - matchedCount;
    const postedCount = items.filter((item) => item.posted).length;
    const totalAmount = items.reduce((sum, item) => sum + Number(item.amount || 0), 0);

    const status: EraStatus = unmatchedCount === 0 ? 'processed' : matchedCount > 0 ? 'partial' : 'imported';

    return {
      eraType: 'imported_file',
      fileName,
      status,
      totalRecords: items.length,
      matchedCount,
      unmatchedCount,
      postedCount,
      totalAmount,
      autoPosted: postedCount > 0,
      items,
    };
  }

  private async getEraRows(filters?: EraFilters) {
    const where: any = {
      Note: {
        contains: '\"eraType\":\"imported_file\"',
      },
    };

    if (filters?.startDate || filters?.endDate) {
      where.DateTimeTrans = {};
      if (filters.startDate) where.DateTimeTrans.gte = new Date(filters.startDate);
      if (filters.endDate) where.DateTimeTrans.lte = new Date(filters.endDate);
    }

    return prisma.etrans.findMany({
      where,
      orderBy: { DateTimeTrans: 'desc' },
    });
  }

  private mapEra(row: any, meta: EraMeta) {
    return {
      _id: row.EtransNum.toString(),
      id: row.EtransNum.toString(),
      fileName: meta.fileName,
      filename: meta.fileName,
      importDate: row.DateTimeTrans ?? null,
      createdAt: row.DateTimeTrans ?? null,
      status: normalizeEraStatus(meta.status),
      totalRecords: meta.totalRecords,
      matchedCount: meta.matchedCount,
      unmatchedCount: meta.unmatchedCount,
      postedCount: meta.postedCount,
      totalAmount: Number(meta.totalAmount || 0),
    };
  }

  private mapEraItem(eraId: string, item: EraItem, fileName?: string) {
    return {
      _id: item.id,
      id: item.id,
      eraId,
      fileName: fileName ?? null,
      patientName: item.patientName ?? null,
      claimNumber: item.claimNumber ?? null,
      invoiceNumber: item.invoiceNumber ?? null,
      claimReference: item.claimNumber ?? item.invoiceNumber ?? null,
      claimId: item.claimId ?? null,
      invoiceId: item.invoiceId ?? null,
      amount: Number(item.amount || 0),
      paymentDate: item.paymentDate ? new Date(item.paymentDate) : null,
      insurance: item.insurance ?? null,
      status: item.status,
      posted: Boolean(item.posted),
    };
  }

  async importERAFile(file: Express.Multer.File, _userId?: string) {
    if (!file) {
      throw new BadRequestError('No file uploaded');
    }

    const content = file.buffer.toString('utf8');
    const ext = file.originalname.split('.').pop()?.toLowerCase();

    let parsedItems: EraItem[] = [];

    if (ext === 'csv') {
      parsedItems = this.parseCsvItems(content);
    } else {
      parsedItems = this.parseTextItems(content);
    }

    if (parsedItems.length === 0) {
      parsedItems = [
        {
          id: crypto.randomUUID(),
          amount: 0,
          status: 'unmatched',
          posted: false,
        },
      ];
    }

    const items = await this.enrichMatches(parsedItems);
    const meta = this.buildEraMeta(file.originalname, items);

    const etransNum = await getNextId('etrans', 'EtransNum');

    await prisma.etrans.create({
      data: {
        EtransNum: etransNum,
        DateTimeTrans: new Date(),
        Etype: 5,
        TranSetId835: `ERA-${etransNum.toString()}`,
        Note: buildJson(meta),
      },
    });

    return {
      eraId: etransNum.toString(),
      message: 'ERA file imported successfully',
      totalRecords: meta.totalRecords,
      matchedCount: meta.matchedCount,
      unmatchedCount: meta.unmatchedCount,
      postedCount: meta.postedCount,
      autoPosted: false,
      totalAmount: meta.totalAmount,
      status: meta.status,
    };
  }

  async getAllERAs(page = 1, limit = 10, filters: EraFilters = {}) {
    const rows = await this.getEraRows(filters);

    let eras = rows.map((row) => {
      const meta = parseJson<EraMeta>(row.Note);
      const normalized = this.buildEraMeta(meta.fileName || `ERA-${row.EtransNum}`, meta.items || []);
      return this.mapEra(row, { ...normalized, ...meta, items: meta.items || normalized.items });
    });

    if (filters.status) {
      const status = normalizeEraStatus(filters.status);
      eras = eras.filter((era) => normalizeEraStatus(era.status) === status);
    }

    if (filters.search) {
      const search = filters.search.toLowerCase();
      eras = eras.filter((era) => {
        return [era.fileName, era.status]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(search));
      });
    }

    const total = eras.length;
    const skip = (page - 1) * limit;
    const paged = eras.slice(skip, skip + limit);

    return {
      eras: paged,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  async getERAById(eraId: string) {
    const row = await prisma.etrans.findUnique({
      where: { EtransNum: BigInt(eraId) },
    });

    if (!row) {
      throw new NotFoundError('ERA not found');
    }

    const meta = parseJson<EraMeta>(row.Note);
    if (meta.eraType !== 'imported_file') {
      throw new NotFoundError('ERA not found');
    }

    const normalized = this.buildEraMeta(meta.fileName || `ERA-${eraId}`, meta.items || []);
    return this.mapEra(row, { ...normalized, ...meta, items: meta.items || normalized.items });
  }

  async getERAItems(eraId: string) {
    const row = await prisma.etrans.findUnique({
      where: { EtransNum: BigInt(eraId) },
    });

    if (!row) {
      throw new NotFoundError('ERA not found');
    }

    const meta = parseJson<EraMeta>(row.Note);
    if (meta.eraType !== 'imported_file') {
      throw new NotFoundError('ERA not found');
    }

    return (meta.items || []).map((item) => this.mapEraItem(eraId, item, meta.fileName));
  }

  async autoPostPayments(eraId: string, _userId?: string) {
    const row = await prisma.etrans.findUnique({
      where: { EtransNum: BigInt(eraId) },
    });

    if (!row) {
      throw new NotFoundError('ERA not found');
    }

    const meta = parseJson<EraMeta>(row.Note);
    if (meta.eraType !== 'imported_file') {
      throw new NotFoundError('ERA not found');
    }

    const items = [...(meta.items || [])];
    let postedNow = 0;

    for (const item of items) {
      if (item.status !== 'matched' || item.posted) {
        continue;
      }

      if (!item.claimId && !item.invoiceId) {
        continue;
      }

      let patientId: string | null = null;

      if (item.claimId) {
        const claim = await prisma.claim.findUnique({
          where: { ClaimNum: BigInt(item.claimId) },
        });

        if (claim?.PatNum) {
          patientId = claim.PatNum.toString();
        }

        if (!item.invoiceId) {
          const claimMeta = parseJson<Record<string, any>>(claim?.Narrative);
          if (claimMeta.invoiceId) {
            item.invoiceId = String(claimMeta.invoiceId);
          }
        }
      }

      if (!patientId && item.invoiceId) {
        const invoice = await prisma.statement.findUnique({
          where: { StatementNum: BigInt(item.invoiceId) },
        });

        if (invoice?.PatNum) {
          patientId = invoice.PatNum.toString();
        }
      }

      if (!patientId) {
        continue;
      }

      const existingPayment = await prisma.payment.findFirst({
        where: {
          PayNote: {
            contains: `\"eraItemId\":\"${item.id}\"`,
          },
        },
      });

      if (!existingPayment) {
        const payNum = await getNextId('payment', 'PayNum');
        const amount = Number(item.amount || 0);

        await prisma.payment.create({
          data: {
            PayNum: payNum,
            PatNum: BigInt(patientId),
            PayAmt: amount,
            PayDate: item.paymentDate ? new Date(item.paymentDate) : new Date(),
            PayNote: buildJson({
              invoiceId: item.invoiceId ?? null,
              method: 'insurance',
              status: 'completed',
              notes: `Auto-posted from ERA ${eraId}`,
              eraId,
              eraItemId: item.id,
            }),
          },
        });
      }

      item.posted = true;
      postedNow += 1;
    }

    const updatedMeta = this.buildEraMeta(meta.fileName || `ERA-${eraId}`, items);
    updatedMeta.postedCount = items.filter((item) => item.posted).length;
    updatedMeta.autoPosted = updatedMeta.postedCount > 0;

    if (updatedMeta.unmatchedCount === 0 && updatedMeta.postedCount >= updatedMeta.matchedCount) {
      updatedMeta.status = 'processed';
    } else if (updatedMeta.postedCount > 0 || updatedMeta.matchedCount > 0) {
      updatedMeta.status = 'partial';
    }

    await prisma.etrans.update({
      where: { EtransNum: row.EtransNum },
      data: { Note: buildJson(updatedMeta) },
    });

    return {
      postedCount: postedNow,
      posted: postedNow,
      totalMatched: updatedMeta.matchedCount,
      totalUnmatched: updatedMeta.unmatchedCount,
      message: postedNow > 0 ? `Successfully posted ${postedNow} payment(s)` : 'No matching items to post',
    };
  }

  async getUnmatchedItems(page = 1, limit = 10, filters: UnmatchedFilters = {}) {
    const rows = await this.getEraRows();

    let items = rows.flatMap((row) => {
      const meta = parseJson<EraMeta>(row.Note);
      if (meta.eraType !== 'imported_file') return [];

      return (meta.items || [])
        .filter((item) => item.status === 'unmatched')
        .map((item) => this.mapEraItem(row.EtransNum.toString(), item, meta.fileName));
    });

    if (filters.startDate || filters.endDate) {
      const start = filters.startDate ? new Date(filters.startDate) : null;
      const end = filters.endDate ? new Date(filters.endDate) : null;

      items = items.filter((item) => {
        if (!item.paymentDate) return true;
        const paymentDate = new Date(item.paymentDate);
        if (start && paymentDate < start) return false;
        if (end && paymentDate > end) return false;
        return true;
      });
    }

    if (filters.search) {
      const search = filters.search.toLowerCase();
      items = items.filter((item) => {
        return [
          item.patientName,
          item.claimNumber,
          item.invoiceNumber,
          item.claimReference,
          item.insurance,
          item.fileName,
        ]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(search));
      });
    }

    const total = items.length;
    const skip = (page - 1) * limit;
    const paged = items.slice(skip, skip + limit);

    return {
      items: paged,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  async matchERAItem(eraItemId: string, claimId?: string | null, invoiceId?: string | null) {
    if (!claimId && !invoiceId) {
      throw new BadRequestError('Either claimId or invoiceId is required');
    }

    const rows = await this.getEraRows();
    const target = rows.find((row) => {
      const meta = parseJson<EraMeta>(row.Note);
      return (meta.items || []).some((item) => item.id === eraItemId);
    });

    if (!target) {
      throw new NotFoundError('ERA item not found');
    }

    const meta = parseJson<EraMeta>(target.Note);
    const items = [...(meta.items || [])];
    const index = items.findIndex((item) => item.id === eraItemId);

    if (index === -1) {
      throw new NotFoundError('ERA item not found');
    }

    if (claimId) {
      const claim = await prisma.claim.findUnique({ where: { ClaimNum: BigInt(claimId) } });
      if (!claim || claim.ClaimType === 'PreAuth') {
        throw new NotFoundError('Claim not found');
      }
    }

    if (invoiceId) {
      const invoice = await prisma.statement.findUnique({ where: { StatementNum: BigInt(invoiceId) } });
      if (!invoice) {
        throw new NotFoundError('Invoice not found');
      }
    }

    const currentItem = items[index];
    if (!currentItem) {
      throw new NotFoundError('ERA item not found');
    }
    const item: EraItem = { ...currentItem };
    item.claimId = claimId ?? item.claimId;
    item.invoiceId = invoiceId ?? item.invoiceId;

    if (!item.invoiceId && item.claimId) {
      const claim = await prisma.claim.findUnique({ where: { ClaimNum: BigInt(item.claimId) } });
      const claimMeta = parseJson<Record<string, any>>(claim?.Narrative);
      if (claimMeta.invoiceId) {
        item.invoiceId = String(claimMeta.invoiceId);
      }
    }

    item.status = item.claimId || item.invoiceId ? 'matched' : 'unmatched';
    items[index] = item;

    const updatedMeta = this.buildEraMeta(meta.fileName || `ERA-${target.EtransNum}`, items);
    updatedMeta.postedCount = meta.postedCount ?? updatedMeta.postedCount;
    updatedMeta.autoPosted = meta.autoPosted ?? updatedMeta.autoPosted;

    if (updatedMeta.unmatchedCount === 0 && updatedMeta.postedCount >= updatedMeta.matchedCount) {
      updatedMeta.status = 'processed';
    } else if (updatedMeta.matchedCount > 0) {
      updatedMeta.status = 'partial';
    }

    await prisma.etrans.update({
      where: { EtransNum: target.EtransNum },
      data: {
        Note: buildJson(updatedMeta),
      },
    });

    return {
      eraId: target.EtransNum.toString(),
      item: this.mapEraItem(target.EtransNum.toString(), item, updatedMeta.fileName),
      matched: item.status === 'matched',
      message: 'ERA item matched successfully',
    };
  }
}

export const eraService = new EraService();
