import { prisma } from '../config/db';
import { NotFoundError } from '../utils/error.util';
import { getNextId } from '../utils/opendental-ids.util';

export class LabCaseService {
  private deriveStatus(labcase: any): string {
    if (labcase.DateTimeChecked) return 'Quality Checked'; // Or 'Completed' depending on business logic
    if (labcase.DateTimeRecd) return 'Received';
    if (labcase.DateTimeSent) return 'Sent';
    return 'New';
  }

  async getAllLabCases(
    page = 1,
    limit = 25,
    patientId?: string,
    tab?: string,
    status?: string,
    sortBy?: string,
    order?: string,
    startDate?: string,
    endDate?: string
  ) {
    const skip = (page - 1) * limit;
    let where: any = {};

    if (patientId) where.PatNum = BigInt(patientId);

    // Filter by tab grouping logic (Active, Completed, Archived)
    // Assuming 'Quality Checked' acts as Completed for this example,
    // or we use date sent/recd to determine completion.
    // Let's implement Active vs Completed based on DateTimeChecked
    if (tab === 'Active') {
      where.DateTimeChecked = null;
    } else if (tab === 'Completed') {
      where.DateTimeChecked = { not: null };
    }
    // Archived might need a specific flag or convention, leaving out for now or could be a custom where.

    if (startDate && endDate) {
      where.DateTimeDue = {
        gte: new Date(startDate),
        lte: new Date(endDate),
      };
    } else if (startDate) {
      where.DateTimeDue = { gte: new Date(startDate) };
    } else if (endDate) {
      where.DateTimeDue = { lte: new Date(endDate) };
    }

    const [rows, total] = await Promise.all([
      prisma.labcase.findMany({
        where,
        include: {
          patient: true,
          laboratory: true,
          appointment_labcase_AptNumToappointment: true,
          provider: true,
        },
        skip,
        take: limit,
      }),
      prisma.labcase.count({ where }),
    ]);

    let labCases = rows.map((lc: any) => {
      const derivedStatus = this.deriveStatus(lc);
      return {
        _id: lc.LabCaseNum.toString(),
        patient: lc.patient
          ? { id: lc.patient.PatNum.toString(), name: `${lc.patient.FName} ${lc.patient.LName}`.trim() }
          : null,
        laboratory: lc.laboratory
          ? { id: lc.laboratory.LaboratoryNum.toString(), name: lc.laboratory.Description }
          : null,
        appointmentDate: lc.appointment_labcase_AptNumToappointment?.AptDateTime || null,
        dueDate: lc.DateTimeDue || null,
        createdDate: lc.DateTimeCreated || null,
        sentDate: lc.DateTimeSent || null,
        receivedDate: lc.DateTimeRecd || null,
        checkedDate: lc.DateTimeChecked || null,
        status: derivedStatus,
        instructions: lc.Instructions || null,
        labFee: lc.LabFee || null,
        invoiceNum: lc.InvoiceNum || null,
        provider: lc.provider
          ? { id: lc.provider.ProvNum.toString(), name: `${lc.provider.FName} ${lc.provider.LName}`.trim() }
          : null,
      };
    });

    // Apply status filter post-query since it's derived
    if (status && status !== 'All') {
      labCases = labCases.filter(lc => lc.status === status);
    }

    // Apply sorting
    if (sortBy) {
      const sortMultiplier = (order === 'desc' || order === 'Descending') ? -1 : 1;
      labCases.sort((a, b) => {
        let valA: any = a[sortBy as keyof typeof a];
        let valB: any = b[sortBy as keyof typeof b];

        // Specific handling for patient name sorting
        if (sortBy === 'patient') {
          valA = a.patient?.name || '';
          valB = b.patient?.name || '';
        }

        if (valA < valB) return -1 * sortMultiplier;
        if (valA > valB) return 1 * sortMultiplier;
        return 0;
      });
    }

    return {
      labCases,
      pagination: {
        page,
        limit,
        total: status && status !== 'All' ? labCases.length : total,
        pages: status && status !== 'All' ? Math.ceil(labCases.length / limit) : Math.ceil(total / limit),
      },
    };
  }

  async getLabCaseById(planId: string) {
    const lc: any = await prisma.labcase.findUnique({
      where: { LabCaseNum: BigInt(planId) },
      include: {
        patient: true,
        laboratory: true,
        appointment_labcase_AptNumToappointment: true,
        provider: true,
      },
    });

    if (!lc) {
      throw new NotFoundError('Lab case not found');
    }

    return {
      _id: lc.LabCaseNum.toString(),
      patient: lc.patient
        ? { id: lc.patient.PatNum.toString(), name: `${lc.patient.FName} ${lc.patient.LName}`.trim() }
        : null,
      laboratory: lc.laboratory
        ? { id: lc.laboratory.LaboratoryNum.toString(), name: lc.laboratory.Description }
        : null,
      appointmentDate: lc.appointment_labcase_AptNumToappointment?.AptDateTime || null,
      dueDate: lc.DateTimeDue || null,
      createdDate: lc.DateTimeCreated || null,
      sentDate: lc.DateTimeSent || null,
      receivedDate: lc.DateTimeRecd || null,
      checkedDate: lc.DateTimeChecked || null,
      status: this.deriveStatus(lc),
      instructions: lc.Instructions || null,
      labFee: lc.LabFee || null,
      invoiceNum: lc.InvoiceNum || null,
      provider: lc.provider
        ? { id: lc.provider.ProvNum.toString(), name: `${lc.provider.FName} ${lc.provider.LName}`.trim() }
        : null,
    };
  }

  async createLabCase(data: {
    patientId: string;
    laboratoryId: string;
    appointmentId?: string;
    dueDate?: string;
    instructions?: string;
    labFee?: number;
    providerNum?: string;
    sharedOn?: string;
  }) {
    const nextId = await getNextId('labcase', 'LabCaseNum');

    const labcase = await prisma.labcase.create({
      data: {
        LabCaseNum: nextId,
        PatNum: BigInt(data.patientId),
        LaboratoryNum: BigInt(data.laboratoryId),
        AptNum: data.appointmentId ? BigInt(data.appointmentId) : null,
        DateTimeDue: data.dueDate ? new Date(data.dueDate) : null,
        DateTimeCreated: new Date(),
        DateTimeSent: data.sharedOn ? new Date(data.sharedOn) : null,
        Instructions: data.instructions,
        LabFee: data.labFee,
        ProvNum: data.providerNum ? BigInt(data.providerNum) : null,
      },
    });

    return this.getLabCaseById(labcase.LabCaseNum.toString());
  }

  async updateLabCase(planId: string, updates: Partial<{
    laboratoryId: string;
    appointmentId: string;
    dueDate: string;
    dateSent: string;
    dateReceived: string;
    dateChecked: string;
    instructions: string;
    labFee: number;
    invoiceNum: string;
  }>) {
    const lc = await prisma.labcase.findUnique({
      where: { LabCaseNum: BigInt(planId) },
    });
    if (!lc) {
      throw new NotFoundError('Lab case not found');
    }

    const updated = await prisma.labcase.update({
      where: { LabCaseNum: lc.LabCaseNum },
      data: {
        LaboratoryNum: updates.laboratoryId ? BigInt(updates.laboratoryId) : undefined,
        AptNum: updates.appointmentId ? BigInt(updates.appointmentId) : undefined,
        DateTimeDue: updates.dueDate ? new Date(updates.dueDate) : undefined,
        DateTimeSent: updates.dateSent ? new Date(updates.dateSent) : undefined,
        DateTimeRecd: updates.dateReceived ? new Date(updates.dateReceived) : undefined,
        DateTimeChecked: updates.dateChecked ? new Date(updates.dateChecked) : undefined,
        Instructions: updates.instructions !== undefined ? updates.instructions : undefined,
        LabFee: updates.labFee !== undefined ? updates.labFee : undefined,
        InvoiceNum: updates.invoiceNum !== undefined ? updates.invoiceNum : undefined,
      },
    });

    return this.getLabCaseById(updated.LabCaseNum.toString());
  }

  async updateLabCaseStatus(planId: string, status: string) {
    const lc = await prisma.labcase.findUnique({
      where: { LabCaseNum: BigInt(planId) },
    });
    if (!lc) {
      throw new NotFoundError('Lab case not found');
    }

    const updates: any = {};
    if (status === 'Sent') updates.DateTimeSent = new Date();
    if (status === 'Received') updates.DateTimeRecd = new Date();
    if (status === 'Quality Checked' || status === 'Completed') updates.DateTimeChecked = new Date();
    // Assuming 'In Progress' means received by lab but not in office? or Sent. 

    if (Object.keys(updates).length > 0) {
      await prisma.labcase.update({
        where: { LabCaseNum: lc.LabCaseNum },
        data: updates,
      });
    }

    return this.getLabCaseById(planId);
  }

  async deleteLabCase(planId: string) {
    const lc = await prisma.labcase.findUnique({
      where: { LabCaseNum: BigInt(planId) },
    });
    if (!lc) {
      throw new NotFoundError('Lab case not found');
    }

    await prisma.labcase.delete({ where: { LabCaseNum: lc.LabCaseNum } });
    return { message: 'Lab case deleted successfully' };
  }

  async getAllLaboratories(page = 1, limit = 25, includeHidden = false) {
    const skip = (page - 1) * limit;
    const where: any = {};
    
    // In OpenDental schema, 0 typically means false, 1 means true
    if (!includeHidden) {
      where.IsHidden = 0;
    }

    const [rows, total] = await Promise.all([
      prisma.laboratory.findMany({
        where,
        include: {
          labturnaround: true,
        },
        skip,
        take: limit,
      }),
      prisma.laboratory.count({ where }),
    ]);

    const laboratories = rows.map((lab: any) => ({
      _id: lab.LaboratoryNum.toString(),
      name: lab.Description || '',
      phone: lab.Phone || null,
      email: lab.Email || null,
      address: lab.Address || null,
      city: lab.City || null,
      state: lab.State || null,
      zip: lab.Zip || null,
      isHidden: lab.IsHidden === 1,
      turnaroundTimes: lab.labturnaround.map((lt: any) => ({
        description: lt.Description || '',
        daysPublished: lt.DaysPublished || 0,
        daysActual: lt.DaysActual || 0,
      })),
    }));

    return {
      laboratories,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  async createLaboratory(data: {
    description: string;
    phone?: string;
    email?: string;
    address?: string;
    city?: string;
    state?: string;
    zip?: string;
  }) {
    const nextId = await getNextId('laboratory', 'LaboratoryNum');

    const lab = await prisma.laboratory.create({
      data: {
        LaboratoryNum: nextId,
        Description: data.description,
        Phone: data.phone,
        Email: data.email,
        Address: data.address,
        City: data.city,
        State: data.state,
        Zip: data.zip,
        IsHidden: 0,
      },
      include: {
        labturnaround: true,
      }
    });

    return {
      _id: lab.LaboratoryNum.toString(),
      name: lab.Description || '',
      phone: lab.Phone || null,
      email: lab.Email || null,
      address: lab.Address || null,
      city: lab.City || null,
      state: lab.State || null,
      zip: lab.Zip || null,
      isHidden: lab.IsHidden === 1,
      turnaroundTimes: [],
    };
  }
}

export const labCaseService = new LabCaseService();
