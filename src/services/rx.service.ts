import { prisma } from '../config/db';
import { getNextId } from '../utils/opendental-ids.util';
import { getRxsMeta, setRxMeta } from '../utils/opendental-auth.util';
import { NotFoundError } from '../utils/error.util';

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

  const rxNums = rows.map((r) => r.RxNum);
  const rxsMetaMap = await getRxsMeta(rxNums);

  // Join medication name via RxCui. rxpat and medication both carry RxCui,
  // but there's no FK relation between them in the schema, so we match
  // on this shared code rather than a relational include.
  const rxCuis = Array.from(
    new Set(
      rows
        .map((r: any) => r.RxCui)
        .filter((cui: any): cui is bigint => cui !== null && cui !== undefined)
    )
  );

  const medications = rxCuis.length > 0
    ? await prisma.medication.findMany({ where: { RxCui: { in: rxCuis } } })
    : [];

  const medicationNameByRxCui = new Map<string, string>();
  medications.forEach((med: any) => {
    if (med.RxCui != null && med.MedName) {
      medicationNameByRxCui.set(med.RxCui.toString(), med.MedName);
    }
  });

  const prescriptions = rows.map((rx: any) => {
    const meta = rxsMetaMap[rx.RxNum.toString()] ?? {};
    const medicationName = rx.RxCui
      ? medicationNameByRxCui.get(rx.RxCui.toString()) || rx.Drug || ''
      : rx.Drug || '';

    return {
      id: rx.RxNum.toString(),
      rxNum: rx.RxNum.toString(),
      description: rx.Drug || '',
      medicationName,
      startDate: rx.RxDate ? rx.RxDate.toISOString().split('T')[0] : '',
      duration: meta.duration || '', 
      longTerm: meta.longTerm || '', 
      refills: rx.Refills || '',
      dose: rx.Disp || '',
      prints: meta.prints || '0', 
      provider: rx.ProvNum ? providerMap.get(rx.ProvNum.toString()) || 'Unknown Provider' : 'Unknown Provider',
      notes: rx.Sig || rx.PatientInstruction || ''
    };
  });

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
    
    let rxDate = null;
    if (data.startDate) {
        rxDate = new Date(data.startDate);
    } else {
        rxDate = new Date();
    }
    let drugText = data.description || '';
    let rxCui: bigint | null = null;

  if (data.medicationId) {
    const medication = await prisma.medication.findUnique({
      where: { MedicationNum: BigInt(data.medicationId) }
    });

    if (!medication) {
      throw new NotFoundError('Medication not found');
    }

    rxCui = medication.RxCui ?? null;
    // Prefer the linked medication's canonical name; fall back to free-text
    // description if the caller also supplied additional detail (e.g. dosage form)
    drugText = data.description || medication.MedName || '';
  }
    const rx = await prisma.rxpat.create({
      data: {
        RxNum: nextId,
        PatNum: BigInt(data.patientId),
        ProvNum: data.providerId ? BigInt(data.providerId) : null,
        Drug: drugText,
        RxCui: rxCui,
        RxDate: rxDate,
        Disp: data.dose || '',
        Refills: data.refills || '',
        Sig: data.notes || '',
        PatientInstruction: data.notes || '',
        Notes: '',
      }
    });

    // Save custom metadata
    await setRxMeta(nextId, {
      duration: data.duration || '',
      longTerm: data.longTerm || '',
      prints: data.prints || '0',
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
      medicationId: data.medicationId || null,
      startDate: rx.RxDate ? rx.RxDate.toISOString().split('T')[0] : '',
      duration: data.duration || '',
      longTerm: data.longTerm || '',
      refills: rx.Refills,
      dose: rx.Disp,
      prints: data.prints || '0',
      provider: providerName,
      notes: rx.Sig
    };
  }
  async getPrescriptionPrintData(rxId: string) {
  const rx = await prisma.rxpat.findUnique({
    where: { RxNum: BigInt(rxId) }
  });

  if (!rx) {
    throw new NotFoundError('Prescription not found');
  }

  // Patient details
  let patient: any = null;
  if (rx.PatNum) {
    patient = await prisma.patient.findUnique({ where: { PatNum: rx.PatNum } });
  }

  // Provider details
  let provider: any = null;
  if (rx.ProvNum) {
    provider = await prisma.provider.findUnique({ where: { ProvNum: rx.ProvNum } });
  }

  // Medication name join via RxCui (same approach as getPrescriptions)
  let medicationName = rx.Drug || '';
  if (rx.RxCui) {
    const medication = await prisma.medication.findFirst({ where: { RxCui: rx.RxCui } });
    if (medication?.MedName) {
      medicationName = medication.MedName;
    }
  }

  const rxsMetaMap = await getRxsMeta([rx.RxNum]);
  const meta = rxsMetaMap[rx.RxNum.toString()] ?? {};

  return {
    id: rx.RxNum.toString(),
    rxNum: rx.RxNum.toString(),
    medicationName,
    description: rx.Drug || '',
    dose: rx.Disp || '',
    refills: rx.Refills || '',
    duration: meta.duration || '',
    longTerm: meta.longTerm || '',
    startDate: rx.RxDate ? rx.RxDate.toISOString().split('T')[0] : '',
    notes: rx.Sig || rx.PatientInstruction || '',
    patient: patient ? {
      id: patient.PatNum.toString(),
      name: `${patient.FName || ''} ${patient.LName || ''}`.trim(),
      birthdate: patient.Birthdate ? patient.Birthdate.toISOString().split('T')[0] : '',
      address: [patient.Address, patient.Address2].filter(Boolean).join(', '),
      city: patient.City || '',
      state: patient.State || '',
      zip: patient.Zip || '',
      phone: patient.WirelessPhone || patient.HmPhone || patient.WkPhone || ''
    } : null,
    provider: provider ? {
      id: provider.ProvNum.toString(),
      name: `${provider.FName || ''} ${provider.LName || ''}`.trim()
    } : null,
    printedAt: new Date().toISOString()
  };
}
  
}

export const rxService = new RxService();

