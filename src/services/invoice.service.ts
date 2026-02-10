import { AppointmentModel } from '../models/appointment.model';
import { AppointmentTypeModel } from '../models/appointment-type.model';
import { InvoiceItemModel } from '../models/invoice-item.model';
import { InvoiceModel } from '../models/invoice.model';
import { ServiceModel } from '../models/service.model';
import { BadRequestError, ConflictError, NotFoundError } from '../utils/error.util';
import { logActivity } from '../utils/activity-logger.util';

const roundCurrency = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

const generateInvoiceNumber = async (): Promise<string> => {
  const lastInvoice = await InvoiceModel.findOne()
    .sort({ invoiceNumber: -1 })
    .select('invoiceNumber')
    .lean();

  if (!lastInvoice?.invoiceNumber) {
    return 'INV000001';
  }

  const invoiceNumberStr = String(lastInvoice.invoiceNumber);
  const match = invoiceNumberStr.match(/\d+$/);
  const lastNumber = match ? parseInt(match[0], 10) : 0;
  const nextNumber = lastNumber + 1;
  return `INV${nextNumber.toString().padStart(6, '0')}`;
};

export class InvoiceService {
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
    const query: any = {};

    if (filters.patientId) query.patientId = filters.patientId;
    if (filters.appointmentId) query.appointmentId = filters.appointmentId;
    if (filters.providerId) query.providerId = filters.providerId;
    if (filters.insuranceCompanyId) query.insuranceCompanyId = filters.insuranceCompanyId;
    if (filters.status) query.status = filters.status;

    if (filters.search) {
      query.invoiceNumber = { $regex: filters.search, $options: 'i' };
    }

    if (filters.startDate || filters.endDate) {
      query.invoiceDate = {};
      if (filters.startDate) {
        const start = new Date(filters.startDate);
        start.setHours(0, 0, 0, 0);
        query.invoiceDate.$gte = start;
      }
      if (filters.endDate) {
        const end = new Date(filters.endDate);
        end.setHours(23, 59, 59, 999);
        query.invoiceDate.$lte = end;
      }
    }

    const [invoices, total] = await Promise.all([
      InvoiceModel.find(query)
        .populate('patientId', 'firstName lastName patientCode email phone')
        .populate('appointmentId', 'appointmentDate')
        .sort({ invoiceDate: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      InvoiceModel.countDocuments(query),
    ]);

    return {
      invoices,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  async getInvoiceById(invoiceId: string) {
    const invoice = await InvoiceModel.findById(invoiceId)
      .populate('patientId', 'firstName lastName patientCode email phone')
      .populate({
        path: 'providerId',
        select: 'providerCode specialty title userId',
        populate: {
          path: 'userId',
          select: 'firstName lastName email',
        },
      })
      .populate('appointmentId', 'appointmentDate startTime endTime')
      .populate('insuranceCompanyId', 'name')
      .lean();
      
    if (!invoice) {
      throw new NotFoundError('Invoice not found');
    }

    const items = await InvoiceItemModel.find({ invoiceId })
      .populate('serviceId', 'name cptCode')
      .lean();

    // Transform for frontend - map patientId/providerId to patient/provider
    return {
      invoice: {
        ...invoice,
        patient: invoice.patientId,
        provider: invoice.providerId,
        appointment: invoice.appointmentId,
        insuranceCompany: invoice.insuranceCompanyId,
        dateOfService: (invoice.appointmentId as any)?.appointmentDate,
      },
      items,
    };
  }

  async createInvoiceFromAppointment(
    appointmentId: string,
    data: {
      dueDate: Date;
      insuranceCompanyId?: string;
      providerId?: string;
      notes?: string;
      copayAmount?: number;
    },
    createdBy: string
  ) {
    const appointment = await AppointmentModel.findById(appointmentId).lean();
    if (!appointment) {
      throw new NotFoundError('Appointment not found');
    }

    const existing = await InvoiceModel.findOne({ appointmentId }).lean();
    if (existing) {
      throw new ConflictError('Invoice already exists for this appointment');
    }

    // Get the appointment type to get the fee/price
    let appointmentType = null;
    if (appointment.appointmentTypeId) {
      appointmentType = await AppointmentTypeModel.findById(appointment.appointmentTypeId).lean();
    }

    const invoiceNumber = await generateInvoiceNumber();
    const invoice = await InvoiceModel.create({
      invoiceNumber,
      patientId: appointment.patientId,
      appointmentId,
      insuranceCompanyId: data.insuranceCompanyId,
      providerId: data.providerId || appointment.providerId,
      invoiceDate: new Date(),
      dueDate: data.dueDate,
      totalAmount: 0,
      insurancePortion: 0,
      patientPortion: 0,
      copayAmount: data.copayAmount ?? 0,
      paidAmount: 0,
      balanceDue: 0,
      taxAmount: 0,
      discountAmount: 0,
      status: 'draft',
      createdBy,
      notes: data.notes,
    });

    // Auto-create line item from appointment type fee
    const defaultPriceValue = appointmentType?.defaultPrice as any;
    const defaultPriceNum = Number(defaultPriceValue) || 0;
    if (appointmentType && defaultPriceNum > 0) {
      const unitPrice = defaultPriceNum;
      const quantity = 1;
      const totalPrice = roundCurrency(unitPrice * quantity);

      await InvoiceItemModel.create({
        invoiceId: invoice._id,
        serviceId: null, // No specific service, this is from appointment type
        cptCode: null,
        description: appointmentType.name || 'Consultation',
        quantity,
        unitPrice,
        totalPrice,
      });

      // Recalculate totals
      await this.recalculateInvoice(String(invoice._id));
    }

    await logActivity(
      createdBy,
      'created',
      'invoices',
      String(invoice._id),
      undefined,
      invoice.toObject(),
      undefined,
      undefined,
      'low'
    );

    // Fetch updated invoice with correct totals
    const updatedInvoice = await InvoiceModel.findById(invoice._id).lean();
    return updatedInvoice;
  }

  async addInvoiceItem(
    invoiceId: string,
    data: {
      serviceId?: string; // Optional - allows manual line items
      quantity?: number;
      unitPrice?: number;
      description?: string;
      cptCode?: string;
    },
    userId: string
  ) {
    const invoice = await InvoiceModel.findById(invoiceId);
    if (!invoice) {
      throw new NotFoundError('Invoice not found');
    }

    const invoiceStatus = String(invoice.status);
    if (invoiceStatus !== 'draft') {
      throw new BadRequestError('Only draft invoices can be modified');
    }

    // If serviceId is provided, fetch service details
    let service = null;
    if (data.serviceId) {
      service = await ServiceModel.findById(data.serviceId).lean();
      if (!service) {
        throw new NotFoundError('Service not found');
      }
    }

    // For manual items (no serviceId), description and unitPrice are required
    if (!data.serviceId && (!data.description || data.unitPrice === undefined)) {
      throw new BadRequestError('Description and unit price are required for manual line items');
    }

    const quantity = data.quantity ?? 1;
    const servicePrice = service?.defaultPrice as any;
    const unitPrice = data.unitPrice ?? (Number(servicePrice) || 0);
    const totalPrice = roundCurrency(unitPrice * quantity);

    const item = await InvoiceItemModel.create({
      invoiceId,
      serviceId: data.serviceId || null,
      cptCode: data.cptCode ?? service?.cptCode ?? null,
      description: data.description ?? service?.name ?? 'Manual Item',
      quantity,
      unitPrice,
      totalPrice,
    });

    await this.recalculateInvoice(invoiceId);

    await logActivity(
      userId,
      'created',
      'invoice_items',
      String(item._id),
      undefined,
      item.toObject(),
      undefined,
      undefined,
      'low'
    );

    return item;
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
    const invoice = await InvoiceModel.findById(invoiceId);
    if (!invoice) {
      throw new NotFoundError('Invoice not found');
    }

    if (String(invoice.status) !== 'draft') {
      throw new BadRequestError('Only draft invoices can be modified');
    }

    const item = await InvoiceItemModel.findOne({ _id: itemId, invoiceId });
    if (!item) {
      throw new NotFoundError('Invoice item not found');
    }

    let service = null;
    if (updates.serviceId && updates.serviceId !== item.serviceId) {
      service = await ServiceModel.findById(updates.serviceId).lean();
      if (!service) {
        throw new NotFoundError('Service not found');
      }
    }

    const oldData = item.toObject();
    if (updates.serviceId && service) {
      (item as any).serviceId = updates.serviceId;
      if (!updates.cptCode) (item as any).cptCode = service.cptCode;
      if (!updates.description) (item as any).description = service.name;
      const servicePrice = service.defaultPrice as any;
      if (!updates.unitPrice) (item as any).unitPrice = Number(servicePrice) || 0;
    }

    if (updates.cptCode !== undefined) (item as any).cptCode = updates.cptCode;
    if (updates.description !== undefined) (item as any).description = updates.description;
    if (updates.quantity !== undefined) (item as any).quantity = updates.quantity;
    if (updates.unitPrice !== undefined) (item as any).unitPrice = updates.unitPrice;

    const itemUnitPrice = Number((item as any).unitPrice) || 0;
    const itemQuantity = Number((item as any).quantity) || 0;
    (item as any).totalPrice = roundCurrency(itemUnitPrice * itemQuantity);
    await item.save();

    await this.recalculateInvoice(invoiceId);

    await logActivity(
      userId,
      'updated',
      'invoice_items',
      itemId,
      oldData,
      item.toObject(),
      undefined,
      undefined,
      'low'
    );

    return item;
  }

  async deleteInvoiceItem(invoiceId: string, itemId: string, userId: string) {
    const invoice = await InvoiceModel.findById(invoiceId);
    if (!invoice) {
      throw new NotFoundError('Invoice not found');
    }

    if (String(invoice.status) !== 'draft') {
      throw new BadRequestError('Only draft invoices can be modified');
    }

    const item = await InvoiceItemModel.findOne({ _id: itemId, invoiceId });
    if (!item) {
      throw new NotFoundError('Invoice item not found');
    }

    const oldData = item.toObject();
    await InvoiceItemModel.deleteOne({ _id: itemId });
    await this.recalculateInvoice(invoiceId);

    await logActivity(
      userId,
      'deleted',
      'invoice_items',
      itemId,
      oldData,
      undefined,
      undefined,
      undefined,
      'low'
    );

    return { message: 'Invoice item deleted successfully' };
  }

  async deleteInvoice(invoiceId: string, userId: string) {
    const invoice = await InvoiceModel.findById(invoiceId);
    if (!invoice) {
      throw new NotFoundError('Invoice not found');
    }

    // Only allow deletion of draft invoices
    const invoiceStatus = String(invoice.status);
    if (invoiceStatus !== 'draft') {
      throw new BadRequestError('Only draft invoices can be deleted. Use void for finalized invoices.');
    }

    const oldData = invoice.toObject();

    // Delete all invoice items first
    await InvoiceItemModel.deleteMany({ invoiceId });

    // Delete the invoice
    await InvoiceModel.findByIdAndDelete(invoiceId);

    await logActivity(
      userId,
      'deleted',
      'invoices',
      invoiceId,
      oldData,
      undefined,
      undefined,
      undefined,
      'medium'
    );

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
      status: 'draft' | 'submitted' | 'partially_paid' | 'paid' | 'denied' | 'void';
      insuranceCoveragePercent: number;
      insurancePortion: number;
      patientPortion: number;
    }>,
    userId: string
  ) {
    const invoice = await InvoiceModel.findById(invoiceId);
    if (!invoice) {
      throw new NotFoundError('Invoice not found');
    }

    if (String(invoice.status) !== 'draft') {
      throw new BadRequestError('Only draft invoices can be modified');
    }

    const oldData = invoice.toObject();
    const coveragePercent = updates.insuranceCoveragePercent;
    delete updates.insuranceCoveragePercent;

    Object.assign(invoice, updates);
    await invoice.save();

    await this.recalculateInvoice(invoiceId, coveragePercent);

    await logActivity(
      userId,
      'updated',
      'invoices',
      invoiceId,
      oldData,
      invoice.toObject(),
      undefined,
      undefined,
      'low'
    );

    return invoice;
  }

  async recalculateInvoice(invoiceId: string, insuranceCoveragePercent?: number) {
    const invoice = await InvoiceModel.findById(invoiceId);
    if (!invoice) {
      throw new NotFoundError('Invoice not found');
    }

    const items = await InvoiceItemModel.find({ invoiceId }).lean();
    const serviceIds = items
      .map((item) => item.serviceId)
      .filter((serviceId) => Boolean(serviceId));

    const services = await ServiceModel.find({ _id: { $in: serviceIds } })
      .select('_id taxRate')
      .lean();

    const serviceTaxMap = new Map(services.map((service) => [String(service._id), Number(service.taxRate) || 0]));

    const totalAmount = items.reduce((sum, item) => sum + (Number(item.totalPrice) || 0), 0);
    const taxAmount = items.reduce((sum, item) => {
      const serviceId = String(item.serviceId || '');
      const taxRate = Number(serviceTaxMap.get(serviceId) || 0);
      return sum + (Number(item.totalPrice) || 0) * (taxRate / 100);
    }, 0);

    const discountAmount = Math.min(Number(invoice.discountAmount) || 0, totalAmount);
    const subtotal = totalAmount - discountAmount + taxAmount;

    let insurancePortion = Number(invoice.insurancePortion) || 0;
    if (insuranceCoveragePercent !== undefined) {
      insurancePortion = roundCurrency((subtotal * insuranceCoveragePercent) / 100);
    }

    const patientPortion = roundCurrency(Math.max(0, subtotal - insurancePortion));
    const balanceDue = roundCurrency(Math.max(0, subtotal - (Number(invoice.paidAmount) || 0)));

    (invoice as any).totalAmount = roundCurrency(totalAmount);
    (invoice as any).taxAmount = roundCurrency(taxAmount);
    (invoice as any).discountAmount = roundCurrency(discountAmount);
    (invoice as any).insurancePortion = insurancePortion;
    (invoice as any).patientPortion = patientPortion;
    (invoice as any).balanceDue = balanceDue;

    await invoice.save();
    return invoice;
  }
}

export const invoiceService = new InvoiceService();
