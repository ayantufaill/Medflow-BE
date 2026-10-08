import { reportDate } from './reporting-fields.util';

export function paymentPlanReport(plan: any, now = new Date()) {
  const fmt = (n: number) => `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const date = reportDate;
  const today = date(now)!;
  const patient = plan.patient_payplan_PatNumTopatient;
  const name = patient ? [patient.FName, patient.LName].filter(Boolean).join(' ') : 'Unknown Patient';
  const history = (plan.payplancharge ?? []).filter((c: any) => (c.ChargeType === 0 || c.ChargeType == null)).map((c: any) => {
    const amount = Number(c.Principal ?? 0) + Number(c.Interest ?? 0);
    const splits = c.paysplit ?? [];
    const paid = splits.reduce((sum: number, s: any) => sum + Number(s.SplitAmt ?? 0), 0);
    const balance = Math.max(0, Math.round((amount - paid) * 100) / 100);
    const due = date(c.ChargeDate);
    const paidDates = splits.filter((s: any) => Number(s.SplitAmt) > 0 && s.DatePay).map((s: any) => date(s.DatePay)).sort();
    return {
      id: String(c.PayPlanChargeNum), patientId: patient?.PatNum?.toString() ?? null, patient: name,
      amount: fmt(amount), remainingAmount: balance,
      status: balance === 0 ? 'Paid' : due && due < today ? 'Overdue' : paid > 0 ? 'Partially Paid' : 'Scheduled',
      created: date(c.SecDateTEntry ?? plan.PayPlanDate), dueDate: due,
      downPayment: c.IsDownPayment === 1 ? 'Yes' : 'No',
      chargedOn: paidDates.at(-1) ?? null,
      // Charge schedules and payment allocations do not prove a failed attempt.
      failedOn: null, failedAttempts: null, error: null,
    };
  });
  const remaining = history.filter((h: any) => h.remainingAmount > 0);
  const past = history.filter((h: any) => h.dueDate && h.dueDate <= today);
  const paymentDates = history.map((h: any) => h.chargedOn).filter(Boolean).sort();
  return {
    patient: name, createdOn: date(plan.PayPlanDate ?? plan.DatePayPlanStart), amount: plan.PayAmt == null ? null : fmt(Number(plan.PayAmt)),
    totalPayments: history.length, remainingPayments: remaining.length,
    remainingBalance: fmt(history.reduce((sum: number, h: any) => sum + h.remainingAmount, 0)),
    nextDue: remaining.map((h: any) => h.dueDate).filter(Boolean).sort()[0] ?? null,
    missed: history.filter((h: any) => h.status === 'Overdue').length,
    lastBilled: past.map((h: any) => h.dueDate).sort().at(-1) ?? null, lastPayment: paymentDates.at(-1) ?? null,
    type: plan.definition?.ItemName ?? null, // Use the saved plan category, not payment frequency.
    status: plan.IsClosed === 1 ? 'Closed' : history.length && !remaining.length ? 'Paid' : history.some((h: any) => h.status === 'Overdue') ? 'Overdue' : 'Scheduled',
    history,
  };
}
