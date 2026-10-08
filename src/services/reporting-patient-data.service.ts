import { prisma } from '../config/db';
import { getPatientsMeta, getPatientInsurancesMeta } from '../utils/opendental-auth.util';
import { reportDate, type ReportValue } from '../utils/reporting-fields.util';
import { annualMaximum, benefitPeriodStart, remainingAnnualBenefit } from '../utils/insurance-benefit-usage.util';

export async function patientReportRows(patients: any[], now = new Date()): Promise<Map<string, Record<string, ReportValue>>> {
  const ids = patients.map(p => p.PatNum);
  if (!ids.length) return new Map();
  const metadata = await getPatientsMeta(ids);
  const provIds = new Set<bigint>();
  for (const p of patients) {
    if (p.PriProv) provIds.add(p.PriProv);
    if (p.SecProv) provIds.add(p.SecProv);
    const meta = metadata[String(p.PatNum)];
    if (meta?.preferredDentistId) provIds.add(BigInt(meta.preferredDentistId));
    if (meta?.preferredHygienistId) provIds.add(BigInt(meta.preferredHygienistId));
  }
  const providerIds = [...provIds];
  const [providers, appointments, recalls, policies] = await Promise.all([
    prisma.provider.findMany({ where: { ProvNum: { in: providerIds } }, select: { ProvNum: true, FName: true, LName: true } }),
    prisma.appointment.findMany({ where: { PatNum: { in: ids }, AptStatus: { in: [0, 1] } }, orderBy: { AptDateTime: 'asc' } }),
    prisma.recall.findMany({ where: { PatNum: { in: ids }, IsDisabled: 0 }, orderBy: [{ DateDue: 'asc' }, { RecallNum: 'asc' }] }),
    prisma.patplan.findMany({ where: { PatNum: { in: ids }, OR: [{ IsPending: 0 }, { IsPending: null }] }, include: { inssub: { include: { insplan: { include: { carrier: true } } } } }, orderBy: [{ Ordinal: 'asc' }, { PatPlanNum: 'asc' }] }),
  ]);
  const policyMeta = await getPatientInsurancesMeta(policies.map(p => p.PatPlanNum));
  // Fetch posted insurance usage once for the patient batch, then use each policy's renewal period.
  const periodStarts = policies.map(p => benefitPeriodStart(policyMeta[String(p.PatPlanNum)] ?? {}, now).getTime());
  const usage = policies.length ? await prisma.claimproc.findMany({
    where: { PatNum: { in: ids }, Status: { in: [1, 4] }, DateCP: { gte: new Date(Math.min(...periodStarts)), lte: now } },
    select: { PatNum: true, InsSubNum: true, DateCP: true, InsPayAmt: true },
  }) : [];
  const result = new Map<string, Record<string, ReportValue>>();
  for (const p of patients) {
    const meta = metadata[String(p.PatNum)] ?? {};
    const appts = appointments.filter(a => a.PatNum === p.PatNum);
    const activePolicies = policies.filter(policy => policy.PatNum === p.PatNum && policy.inssub &&
      (!reportDate(policy.inssub.DateEffective) || policy.inssub.DateEffective! <= now) &&
      (!reportDate(policy.inssub.DateTerm) || reportDate(policy.inssub.DateTerm)! >= reportDate(now)!));
    const primary = activePolicies.find(policy => policy.Ordinal === 1) ?? activePolicies[0];
    let remaining: number | null = null;
    if (primary) {
      const pm = policyMeta[String(primary.PatPlanNum)] ?? {};
      const start = benefitPeriodStart(pm, now);
      const used = usage.filter(u => u.PatNum === p.PatNum && u.InsSubNum === primary.InsSubNum && u.DateCP && u.DateCP >= start)
        .reduce((sum, u) => sum + (u.InsPayAmt ?? 0), 0);
      remaining = remainingAnnualBenefit(annualMaximum(pm), used);
    }
    const priProvId = p.PriProv ? p.PriProv : meta.preferredDentistId ? BigInt(meta.preferredDentistId) : null;
    const secProvId = p.SecProv ? p.SecProv : meta.preferredHygienistId ? BigInt(meta.preferredHygienistId) : null;
    const dds = priProvId ? providers.find(v => v.ProvNum === priProvId) : null;
    const hyg = secProvId ? providers.find(v => v.ProvNum === secProvId) : null;
    const next = (hygiene: boolean) => appts.find(a => a.AptStatus === 0 && a.AptDateTime && a.AptDateTime >= now && (a.IsHygiene === 1) === hygiene);
    const last = appts.filter(a => a.AptStatus === 1 && a.AptDateTime && a.AptDateTime <= now).at(-1);
    const recall = recalls.find(r => r.PatNum === p.PatNum && reportDate(r.DateDue) && (!reportDate(r.DisableUntilDate) || reportDate(r.DisableUntilDate)! <= reportDate(now)!));
    const flags = Array.isArray(meta.patientFlags) ? meta.patientFlags.map((f: any) => typeof f === 'string' ? f : f?.name ?? f?.label ?? f?.id).filter(Boolean).join(', ') : null;
    const patientBoolean = (field: string) => typeof meta[field] === 'boolean' ? meta[field] : null;
    result.set(String(p.PatNum), {
      ID: String(p.PatNum), 'First Name': p.FName ?? null, 'Last Name': p.LName ?? null,
      'Middle Name': p.MiddleI ?? null, dob: reportDate(p.Birthdate), email: p.Email ?? null,
      sex: ({ 1: 'Male', 2: 'Female' } as any)[p.Gender] ?? 'Unknown',
      Inactive: p.PatStatus == null ? null : p.PatStatus === 2,
      'Home Phone': p.HmPhone ?? null, 'Mobile Phone': p.WirelessPhone ?? null,
      'street Address': p.Address ?? null, 'additional Address': p.Address2 ?? null,
      city: p.City ?? null, state: p.State ?? null, 'zip code': p.Zip ?? null,
      country: p.Country ?? meta.country ?? meta.address?.country ?? null,
      recallDate: reportDate(recall?.DateDue), payerName: primary?.inssub?.insplan?.carrier?.CarrierName ?? null,
      'patient.PoliciesPayers': activePolicies.map(policy => policy.inssub?.insplan?.carrier?.CarrierName).filter(Boolean).join(', ') || null,
      'Ins Remain': remaining, 'Total Outstanding Balance': p.BalTotal ?? null,
      'Patient Account Credit': p.BalTotal == null ? null : Math.max(0, -p.BalTotal),
      lastAppt: reportDate(last?.AptDateTime), nextTreatmentAppt: reportDate(next(false)?.AptDateTime), nextRecareAppt: reportDate(next(true)?.AptDateTime),
      'IsSubscriber(NonPatient)': p.PatStatus == null ? null : p.PatStatus === 1 && activePolicies.some(policy => policy.inssub?.Subscriber === p.PatNum),
      householdHeadUUID: p.Guarantor ? String(p.Guarantor) : null,
      isHeadOfHousehold: p.Guarantor ? p.Guarantor === p.PatNum : null,
      newPatientDate: reportDate(p.DateFirstVisit), 'Preferred DDS': priProvId ? String(priProvId) : null,
      'Preferred HYG': secProvId ? String(secProvId) : null,
      'Preferred DDS First Name': dds?.FName ?? null, 'Preferred DDS Last Name': dds?.LName ?? null,
      'Preferred HYG First Name': hyg?.FName ?? null, 'Preferred HYG Last Name': hyg?.LName ?? null,
      'Has Mychart Account': patientBoolean('hasMychartAccount') ?? patientBoolean('portalAccessEnabled'), 'Created from mychart': patientBoolean('createdFromMychart'), Flags: flags,
    });
  }
  for (const row of result.values()) for (const [field, value] of Object.entries(row)) {
    if (typeof value === 'string') row[field] = value.trim() || null;
  }
  return result;
}
