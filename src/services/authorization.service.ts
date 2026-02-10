import { AuthorizationModel } from '../models/authorization.model';
import { NotFoundError } from '../utils/error.util';
import { logActivity } from '../utils/activity-logger.util';

const generateAuthNumber = async (): Promise<string> => {
  const last = await AuthorizationModel.findOne()
    .sort({ authorizationNumber: -1 })
    .select('authorizationNumber')
    .lean();

  if (!last?.authorizationNumber) {
    return 'AUTH000001';
  }

  const match = String(last.authorizationNumber).match(/\d+$/);
  const lastNum = match ? parseInt(match[0], 10) : 0;
  return `AUTH${(lastNum + 1).toString().padStart(6, '0')}`;
};

export class AuthorizationService {
  async getAllAuthorizations(
    page = 1,
    limit = 10,
    filters: {
      patientId?: string;
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
    if (filters.insuranceCompanyId) query.insuranceCompanyId = filters.insuranceCompanyId;
    if (filters.status) query.status = filters.status;

    if (filters.search) {
      query.$or = [
        { authorizationNumber: { $regex: filters.search, $options: 'i' } },
      ];
    }

    if (filters.startDate || filters.endDate) {
      query.requestedDate = {};
      if (filters.startDate) {
        const start = new Date(filters.startDate);
        start.setHours(0, 0, 0, 0);
        query.requestedDate.$gte = start;
      }
      if (filters.endDate) {
        const end = new Date(filters.endDate);
        end.setHours(23, 59, 59, 999);
        query.requestedDate.$lte = end;
      }
    }

    const [authorizations, total] = await Promise.all([
      AuthorizationModel.find(query)
        .populate('patientId', 'firstName lastName')
        .populate('insuranceCompanyId', 'name')
        .populate('serviceId', 'name cptCode')
        .sort({ requestedDate: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      AuthorizationModel.countDocuments(query),
    ]);

    return {
      authorizations,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  async getAuthorizationById(authId: string) {
    const auth = await AuthorizationModel.findById(authId)
      .populate('patientId', 'firstName lastName')
      .populate('insuranceCompanyId', 'name')
      .populate('serviceId', 'name cptCode')
      .lean();

    if (!auth) {
      throw new NotFoundError('Authorization not found');
    }

    return auth;
  }

  async requestAuthorization(
    data: {
      patientId: string;
      insuranceCompanyId: string;
      serviceId: string;
      authorizationNumber?: string;
      requestedDate?: Date;
      expirationDate?: Date;
      unitsAuthorized?: number;
      notes?: string;
    },
    requestedBy: string
  ) {
    const authNumber = data.authorizationNumber || (await generateAuthNumber());
    const requestedDate = data.requestedDate || new Date();

    const auth = await AuthorizationModel.create({
      patientId: data.patientId,
      insuranceCompanyId: data.insuranceCompanyId,
      serviceId: data.serviceId,
      authorizationNumber: authNumber,
      requestedDate,
      expirationDate: data.expirationDate,
      status: 'pending',
      unitsAuthorized: data.unitsAuthorized,
      unitsUsed: 0,
      notes: data.notes,
      requestedBy,
    });

    await logActivity(requestedBy, 'created', 'authorizations', String(auth._id), undefined, auth.toObject(), undefined, undefined, 'low');

    return auth;
  }

  async updateAuthorization(
    authId: string,
    updates: Partial<{
      status: string;
      approvedDate: Date;
      expirationDate: Date;
      unitsAuthorized: number;
      unitsUsed: number;
      notes: string;
    }>,
    _userId: string
  ) {
    const auth = await AuthorizationModel.findById(authId);
    if (!auth) {
      throw new NotFoundError('Authorization not found');
    }

    const oldData = auth.toObject();
    Object.assign(auth, updates);
    await auth.save();

    return auth;
  }

  async getStatusHistory(authId: string) {
    const auth = await AuthorizationModel.findById(authId).lean();
    if (!auth) {
      throw new NotFoundError('Authorization not found');
    }

    const history: { status: string; date: Date }[] = [];
    const a = auth as any;
    if (a.requestedDate) {
      history.push({ status: 'pending', date: a.requestedDate });
    }
    if (a.approvedDate) {
      history.push({ status: 'approved', date: a.approvedDate });
    }
    history.push({ status: a.status || 'pending', date: a.updatedAt || a.createdAt || new Date() });

    return { statusHistory: history };
  }

  async printAuthorizationForm(_authId: string): Promise<Buffer> {
    const auth = await AuthorizationModel.findById(_authId)
      .populate('patientId', 'firstName lastName')
      .populate('insuranceCompanyId', 'name')
      .populate('serviceId', 'name cptCode')
      .lean();

    if (!auth) {
      throw new NotFoundError('Authorization not found');
    }

    const a = auth as any;
    const content = `
Authorization Form
=================
Number: ${a.authorizationNumber}
Patient: ${a.patientId?.firstName || ''} ${a.patientId?.lastName || ''}
Insurance: ${a.insuranceCompanyId?.name || ''}
Service: ${a.serviceId?.name || ''} (${a.serviceId?.cptCode || ''})
Status: ${a.status}
Requested: ${a.requestedDate}
Expires: ${a.expirationDate || 'N/A'}
Units: ${a.unitsAuthorized || 'N/A'}
Notes: ${a.notes || 'N/A'}
    `.trim();

    return Buffer.from(content, 'utf-8');
  }
}

export const authorizationService = new AuthorizationService();
