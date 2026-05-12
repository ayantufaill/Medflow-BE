import { prisma } from '../config/db';
import { getNextId } from '../utils/opendental-ids.util';

export class RxService {
  async getPrescriptions(patientId?: string, page = 1, limit = 25) {
    const skip = (page - 1) * limit;
    const where: any = {};
    if (patientId) where.PatNum = BigInt(patientId);

    const [rows, total] = await Promise.all([
      prisma.rxpat.findMany({
        where,
        orderBy: { RxDate: 'desc' },
        skip,
        take: limit
      }),
      prisma.rxpat.count({ where })
    ]);

    // Fetch providers manually to map names
    const providerIds = new Set<string>();
    rows.forEach((row: any) => {
      if (row.ProvNum) providerIds.add(row.ProvNum.toString());
    });

    const providers = providerIds.size > 0 
      ? await prisma.provider.findMany({ where: { ProvNum: { in: Array.from(providerIds).map(id => BigInt(id)) } } })
      : [];
      
    const providerMap = new Map();
    providers.forEach((p: any) => {
      providerMap.set(p.ProvNum.toString(), `${p.FName} ${p.LName}`.trim());
    });

    const prescriptions = rows.map((rx: any) => ({
      id: rx.RxNum.toString(),
      rxNum: rx.RxNum.toString(),
      description: rx.Drug || '',
      startDate: rx.RxDate ? rx.RxDate.toISOString().split('T')[0] : '',
      duration: '', 
      longTerm: '', 
      refills: rx.Refills || '',
      dose: rx.Disp || '',
      prints: '0', 
      provider: rx.ProvNum ? providerMap.get(rx.ProvNum.toString()) || 'Unknown Provider' : 'Unknown Provider',
      notes: rx.Sig || rx.PatientInstruction || ''
    }));

    return {
      prescriptions,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    };
  }

  async createPrescription(data: any) {
    const nextId = await getNextId('rxpat', 'RxNum');
    
    // Construct Sig / Notes from duration and longTerm if passed
    let sigOrNotes = data.notes || '';
    if (data.duration) sigOrNotes += ` | Duration: ${data.duration}`;
    if (data.longTerm) sigOrNotes += ` | Long Term: ${data.longTerm}`;

    let rxDate = null;
    if (data.startDate) {
        rxDate = new Date(data.startDate);
    } else {
        rxDate = new Date();
    }

    const rx = await prisma.rxpat.create({
      data: {
        RxNum: nextId,
        PatNum: BigInt(data.patientId),
        ProvNum: data.providerId ? BigInt(data.providerId) : BigInt(0),
        Drug: data.description || '',
        RxDate: rxDate,
        Disp: data.dose || '',
        Refills: data.refills || '',
        Sig: sigOrNotes,
        PatientInstruction: data.notes || '',
        Notes: '',
      }
    });

    // Fetch provider name for response
    let providerName = 'Unknown Provider';
    if (data.providerId) {
      const provider = await prisma.provider.findUnique({ where: { ProvNum: BigInt(data.providerId) } });
      if (provider) providerName = `${provider.FName} ${provider.LName}`.trim();
    }

    return {
      id: rx.RxNum.toString(),
      rxNum: rx.RxNum.toString(),
      description: rx.Drug,
      startDate: rx.RxDate ? rx.RxDate.toISOString().split('T')[0] : '',
      duration: data.duration || '',
      longTerm: data.longTerm || '',
      refills: rx.Refills,
      dose: rx.Disp,
      prints: '0',
      provider: providerName,
      notes: rx.Sig
    };
  }
}

export const rxService = new RxService();
