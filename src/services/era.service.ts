import { ERAModel } from '../models/era.model';
import { ERAItemModel } from '../models/era-item.model';
import { ClaimModel } from '../models/claim.model';
import { InvoiceModel } from '../models/invoice.model';
import { NotFoundError, BadRequestError } from '../utils/error.util';
import { paymentService } from './payment.service';

export class EraService {
  async getAllERAs(
    page = 1,
    limit = 10,
    filters: {
      status?: string;
      startDate?: string;
      endDate?: string;
      search?: string;
    } = {}
  ) {
    const skip = (page - 1) * limit;
    const query: any = {};

    if (filters.status) query.status = filters.status;
    if (filters.search) query.fileName = { $regex: filters.search, $options: 'i' };

    if (filters.startDate || filters.endDate) {
      query.createdAt = {};
      if (filters.startDate) {
        const start = new Date(filters.startDate);
        start.setHours(0, 0, 0, 0);
        query.createdAt.$gte = start;
      }
      if (filters.endDate) {
        const end = new Date(filters.endDate);
        end.setHours(23, 59, 59, 999);
        query.createdAt.$lte = end;
      }
    }

    const [eras, total] = await Promise.all([
      ERAModel.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      ERAModel.countDocuments(query),
    ]);

    return {
      eras,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  async getERAById(eraId: string) {
    const era = await ERAModel.findById(eraId).lean();
    if (!era) {
      throw new NotFoundError('ERA not found');
    }
    return era;
  }

  async getERAItems(eraId: string) {
    const era = await ERAModel.findById(eraId).lean();
    if (!era) {
      throw new NotFoundError('ERA not found');
    }
    const items = await ERAItemModel.find({ eraId }).sort({ createdAt: 1 }).lean();
    return { items };
  }

  /**
   * Parse CSV content into rows with patientName, claimNumber, amount, paymentDate.
   * Header row optional; columns can be in any order if first row is header.
   */
  private parseERAContent(buffer: Buffer): { patientName: string; claimNumber: string; amount: number; paymentDate?: Date }[] {
    const text = buffer.toString('utf-8').trim();
    const lines = text.split(/\r?\n/).filter((l) => l.trim());
    if (lines.length === 0) return [];

    const rows: { patientName: string; claimNumber: string; amount: number; paymentDate?: Date }[] = [];
    const first = lines[0].toLowerCase();
    const hasHeader =
      first.includes('patient') ||
      first.includes('claim') ||
      first.includes('amount') ||
      first.includes('date');
    const startIndex = hasHeader ? 1 : 0;

    for (let i = startIndex; i < lines.length; i++) {
      const parts = lines[i].split(',').map((p) => p.trim());
      if (parts.length < 2) continue;
      // Support: patientName, claimNumber, amount, paymentDate (or similar order)
      let patientName = '';
      let claimNumber = '';
      let amount = 0;
      let paymentDate: Date | undefined;
      if (parts.length >= 1) patientName = parts[0] || '';
      if (parts.length >= 2) claimNumber = parts[1] || '';
      if (parts.length >= 3) amount = parseFloat(parts[2]) || 0;
      if (parts.length >= 4 && parts[3]) {
        const d = new Date(parts[3]);
        if (!isNaN(d.getTime())) paymentDate = d;
      }
      rows.push({ patientName, claimNumber, amount, paymentDate });
    }
    return rows;
  }

  async importERAFile(
    body: { fileName?: string },
    file: Express.Multer.File | undefined,
    userId?: string
  ) {
    const fileName = file?.originalname || body?.fileName || 'era-import.txt';

    if (!file?.buffer || file.buffer.length === 0) {
      const era = await ERAModel.create({
        fileName,
        status: 'imported',
        totalRecords: 0,
        matchedCount: 0,
        unmatchedCount: 0,
        importedBy: userId,
      });
      return {
        era,
        message: 'ERA record created (no file content). Upload a CSV with columns: patientName, claimNumber, amount, paymentDate',
        totalRecords: 0,
        unmatchedCount: 0,
      };
    }

    let rows: { patientName: string; claimNumber: string; amount: number; paymentDate?: Date }[];
    try {
      rows = this.parseERAContent(file.buffer);
    } catch (err) {
      const era = await ERAModel.create({
        fileName,
        status: 'failed',
        totalRecords: 0,
        matchedCount: 0,
        unmatchedCount: 0,
        importedBy: userId,
      });
      return {
        era,
        message: 'ERA file import failed: could not parse file.',
        totalRecords: 0,
        unmatchedCount: 0,
      };
    }

    const era = await ERAModel.create({
      fileName,
      status: 'imported',
      totalRecords: rows.length,
      matchedCount: 0,
      unmatchedCount: rows.length,
      importedBy: userId,
    });

    const items = await Promise.all(
      rows.map((row) =>
        ERAItemModel.create({
          eraId: era._id,
          patientName: row.patientName,
          claimNumber: row.claimNumber?.trim() || '',
          amount: row.amount,
          paymentDate: row.paymentDate,
          status: 'unmatched',
        })
      )
    );

    // Auto-match by claim number: find claim in DB and link claimId + invoiceId
    let matchedCount = 0;
    for (const item of items) {
      const claimNumber = (item as any).claimNumber?.trim();
      if (!claimNumber) continue;
      const claim = await ClaimModel.findOne({ claimNumber }).select('_id invoiceId').lean();
      if (claim) {
        (item as any).status = 'matched';
        (item as any).claimId = (claim as any)._id;
        (item as any).invoiceId = (claim as any).invoiceId;
        await item.save();
        matchedCount++;
      }
    }
    const unmatchedCount = rows.length - matchedCount;
    (era as any).matchedCount = matchedCount;
    (era as any).unmatchedCount = unmatchedCount;
    await era.save();

    return {
      era,
      message:
        matchedCount > 0
          ? `ERA file imported. ${rows.length} line(s); ${matchedCount} auto-matched by claim number, ${unmatchedCount} unmatched. Run Auto-Post on ERA detail to post matched payments.`
          : `ERA file imported. ${rows.length} line(s); none matched (no claims found with those claim numbers). Match manually or check claim numbers.`,
      totalRecords: rows.length,
      matchedCount,
      unmatchedCount,
    };
  }

  async autoPostPayments(eraId: string, userId: string) {
    const era = await ERAModel.findById(eraId);
    if (!era) {
      throw new NotFoundError('ERA not found');
    }
    if ((era as any).status === 'processed') {
      throw new BadRequestError('ERA already processed. Auto-post can only run once per import.');
    }

    const matchedItems = await ERAItemModel.find({
      eraId,
      status: 'matched',
      $or: [{ claimId: { $exists: true, $ne: null } }, { invoiceId: { $exists: true, $ne: null } }],
    }).lean();

    let posted = 0;
    for (const item of matchedItems as any[]) {
      const invoiceId = item.invoiceId || null;
      const claimId = item.claimId || null;
      const amount = Number(item.amount) || 0;
      if (amount <= 0 || !invoiceId) continue;

      const invoice = await InvoiceModel.findById(invoiceId).lean();
      if (!invoice) continue;
      const patientId = (invoice as any).patientId;
      if (!patientId) continue;

      try {
        await paymentService.createPayment(
          {
            invoiceId,
            patientId,
            amount,
            paymentMethod: 'insurance',
            paymentSource: 'insurance_company',
            paymentDate: item.paymentDate ? new Date(item.paymentDate) : new Date(),
          },
          userId
        );
        posted++;

        if (claimId) {
          const claim = await ClaimModel.findById(claimId);
          if (claim) {
            const currentPaid = Number(claim.get('paidAmount') ?? 0);
            claim.set('paidAmount', Math.round((currentPaid + amount) * 100) / 100);
            await claim.save();
          }
        }
      } catch (_err) {
        // Skip item on error (e.g. invoice already paid); continue with others
      }
    }

    (era as any).status = 'processed';
    (era as any).matchedCount = matchedItems.length;
    await era.save();

    return {
      success: true,
      message: `Auto-post completed. ${posted} payment(s) applied.`,
      matched: matchedItems.length,
      posted,
    };
  }

  async getUnmatchedItems(
    page = 1,
    limit = 10,
    filters: {
      startDate?: string;
      endDate?: string;
      search?: string;
    } = {}
  ) {
    const skip = (page - 1) * limit;
    const query: any = { status: 'unmatched' };

    if (filters.search) {
      query.$or = [
        { patientName: { $regex: filters.search, $options: 'i' } },
        { claimNumber: { $regex: filters.search, $options: 'i' } },
      ];
    }

    if (filters.startDate || filters.endDate) {
      query.paymentDate = {};
      if (filters.startDate) {
        const start = new Date(filters.startDate);
        start.setHours(0, 0, 0, 0);
        query.paymentDate.$gte = start;
      }
      if (filters.endDate) {
        const end = new Date(filters.endDate);
        end.setHours(23, 59, 59, 999);
        query.paymentDate.$lte = end;
      }
    }

    const [items, total] = await Promise.all([
      ERAItemModel.find(query)
        .populate('eraId', 'fileName')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      ERAItemModel.countDocuments(query),
    ]);

    return {
      items,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  async matchERAItem(
    eraItemId: string,
    claimId?: string,
    invoiceId?: string
  ) {
    const item = await ERAItemModel.findById(eraItemId);
    if (!item) {
      throw new NotFoundError('ERA item not found');
    }

    (item as any).status = 'matched';
    if (claimId) (item as any).claimId = claimId;
    if (invoiceId) (item as any).invoiceId = invoiceId;
    await item.save();

    return {
      item,
      message: 'ERA item matched successfully',
    };
  }
}

export const eraService = new EraService();
