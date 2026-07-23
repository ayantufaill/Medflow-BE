import { prisma } from '../config/db';
import { getPatientsMeta } from '../utils/opendental-auth.util';

export class ReportGenerationService {
  /**
   * Process and compile financial reports
   */
  async getFinancialReport(reportName: string, query: any) {
    const { startDate, endDate } = this.getRangeDates(query.date, query.range || 'Daily');
    const name = String(reportName).toLowerCase();

    switch (name) {
      case 'aging':
      case 'patient-aging':
        return this.getAgingReport(query, name === 'patient-aging');

      case 'deposit-slips':
        return this.getDepositSlipsReport(startDate, endDate);

      case 'production':
        return this.getProductionReport(startDate, endDate);

      case 'production-collection':
      case 'production-collection-summary':
        return this.getProductionCollectionReport(startDate, endDate, name === 'production-collection-summary');

      case 'provider-collection-payment-type':
        return this.getProviderCollectionPaymentType(startDate, endDate);

      case 'production-per-code':
        return this.getProductionPerCode(startDate, endDate);

      case 'collection-code-carrier':
        return this.getCollectionCodeCarrier(startDate, endDate);

      case 'adjustment':
        return this.getAdjustmentReport(startDate, endDate);

      case 'courtesy-credit':
      case 'courtesy-credit-modifications':
        return this.getCourtesyCreditReport(startDate, endDate, name === 'courtesy-credit-modifications');

      case 'credit-accounts':
        return this.getCreditAccountsReport();

      case 'modifications':
        return this.getModificationsReport(startDate, endDate);

      case 'deposit-summary':
        return this.getDepositSummary(startDate, endDate);

      case 'collection-carrier':
        return this.getCollectionCarrier(startDate, endDate);

      case 'total-collection-individuals':
      case 'total-collection-family':
        return this.getTotalCollections(startDate, endDate, name === 'total-collection-family');

      case 'payment-plans':
      case 'payment-lines':
        return this.getPaymentPlansReport(name === 'payment-lines');

      case 'payment-request':
        return this.getPaymentRequestsReport(startDate, endDate);

      case 'openedge-transactions':
        return this.getOpenEdgeTransactions(startDate, endDate);

      case 'procedures-insurance':
        return this.getProceduresInsurance(startDate, endDate);

      case 'family-migrated-balances':
        return this.getFamilyMigratedBalances();

      case 'referral-production':
        return this.getReferralProductionReport(startDate, endDate);

      default:
        // Fallback for any unhandled financial report
        return [
          { date: query.date || new Date().toLocaleDateString(), description: `${reportName} details`, amount: 150.00 }
        ];
    }
  }

  /**
   * Process and compile clinical reports
   */
  async getClinicalReport(reportName: string, query: any) {
    const { startDate, endDate } = this.getRangeDates(query.date, query.range || 'Daily');
    const name = String(reportName).toLowerCase();

    switch (name) {
      case 'recare':
        return this.getRecareReport();

      case 'unsigned-progress-notes':
        return this.getUnsignedProgressNotesReport(startDate, endDate);

      case 'rx':
        return this.getRxReport(startDate, endDate);

      default:
        return [
          { date: query.date || new Date().toLocaleDateString(), status: 'Pending', description: `${reportName} clinical log` }
        ];
    }
  }

  /**
   * Process and compile patient reports
   */
  async getPatientReport(reportName: string, query: any) {
    const { startDate, endDate } = this.getRangeDates(query.date, query.range || 'Daily');
    const name = String(reportName).toLowerCase();

    switch (name) {
      case 'insurance-coverage':
        return this.getPatientInsuranceCoverage();

      case 'membership-plan':
        return this.getPatientMembershipPlan();

      case 'referral-by-patient':
        return this.getReferralByPatient(startDate, endDate);

      case 'online-scheduling-referral':
        return this.getOnlineSchedulingReferral(startDate, endDate);

      case 'by-flag':
        return this.getPatientByFlag(query.filterBy, query.includeFlags, query.excludeFlags);

      case 'cancelled-appointments':
      case 'no-show-appointments':
        return this.getCancelledOrNoShowAppointments(startDate, endDate, name === 'no-show-appointments');

      case 'appointments':
        return this.getAppointmentsReport(startDate, endDate);

      case 'duplicate-patients':
        return this.getDuplicatePatients();

      case 'contact-preferences':
        return this.getPatientContactPreferences();

      case 'last-appointment':
      case 'next-appointment':
        return this.getPatientAppointmentMilestones(name === 'next-appointment');

      case 'referral-document':
        return this.getReferralDocuments();

      case 'lab-case':
        return this.getLabCaseReport(startDate, endDate);

      case 'discount-edited-fee':
        return this.getDiscountEditedFeeReport(startDate, endDate);

      case 'review':
        return this.getPatientReviewsReport(startDate, endDate);

      case 'notifications':
        return this.getPatientNotificationsReport(startDate, endDate);

      case 'procedures':
        return this.getPatientProceduresReport(startDate, endDate);

      case 'trackers':
        return this.getPatientTrackers();

      default:
        return [
          { id: 1, name: 'Francis Fuller', email: 'fuller@example.com', date: new Date().toLocaleDateString() }
        ];
    }
  }

  /**
   * Process and compile other system reports
   */
  async getOthersReport(reportName: string, query: any) {
    const { startDate, endDate } = this.getRangeDates(query.date, query.range || 'Daily');
    const name = String(reportName).toLowerCase();

    switch (name) {
      case 'login':
        return this.getLoginReport(startDate, endDate);

      case 'audit':
        return this.getAuditReport(startDate, endDate);

      default:
        return [
          { timestamp: new Date().toISOString(), user: 'admin', action: `Executed ${reportName}` }
        ];
    }
  }

  // ==========================================
  // FINANCIAL REPORTS QUERY HELPERS
  // ==========================================

  private async getAgingReport(query: any, patientOnly = false) {
    const filters: string[] = [];

    // Patient Status filter
    if (query.patientStatusFilter === 'active') {
      filters.push(`p."PatStatus" = 0`); // 0 is typically active
    } else if (query.patientStatusFilter === 'inactive') {
      filters.push(`p."PatStatus" != 0`);
    }

    // Provider filter
    if (query.providerFilter && query.providerFilter !== 'all') {
      // Basic sanitize to ensure it's a number to prevent injection
      const provNum = Number(query.providerFilter);
      if (!isNaN(provNum)) {
        filters.push(`p."PriProv" = ${provNum}`);
      }
    }

    // Minimum Balance filter (mapping loosely to over30, over60 etc.)
    if (query.balanceFilter === 'over30') {
      filters.push(`f."BalTotal" > 30`);
    } else if (query.balanceFilter === 'over60') {
      filters.push(`f."BalTotal" > 60`);
    } else if (query.balanceFilter === 'over90') {
      filters.push(`f."BalTotal" > 90`);
    } else if (query.balanceFilter === 'over0') {
      filters.push(`f."BalTotal" > 0`);
    } else {
      // By default, usually only show patients with balances or expected insurance
      filters.push(`(f."BalTotal" != 0 OR f."InsEst" != 0)`);
    }

    const whereClause = filters.length > 0 ? `WHERE ${filters.join(' AND ')}` : '';

    const sql = `
      SELECT 
        p."PatNum", p."FName", p."LName", p."PatStatus", p."PriProv",
        f."Bal_0_30", f."Bal_31_60", f."Bal_61_90", f."BalOver90", f."InsEst", f."BalTotal", f."PayPlanDue",
        c."CarrierName"
      FROM patient p
      LEFT JOIN famaging f ON p."PatNum" = f."PatNum"
      LEFT JOIN patplan pp ON p."PatNum" = pp."PatNum" AND pp."Ordinal" = 1
      LEFT JOIN inssub isub ON pp."InsSubNum" = isub."InsSubNum"
      LEFT JOIN insplan ipl ON isub."PlanNum" = ipl."PlanNum"
      LEFT JOIN carrier c ON ipl."CarrierNum" = c."CarrierNum"
      ${whereClause}
      ORDER BY f."BalTotal" DESC
      LIMIT 200
    `;

    const rawPatients = await prisma.$queryRawUnsafe<any[]>(sql);

    const agingBuckets = ['0 - 30 days', '31 - 60 days', '61 - 90 days', '91 - 120 days', '121 - 150 days', '151 - 180 days', '> 180 day'];

    const report = rawPatients.map((p) => {
      const bal0_30 = Number(p.Bal_0_30) || 0;
      const bal31_60 = Number(p.Bal_31_60) || 0;
      const bal61_90 = Number(p.Bal_61_90) || 0;
      const balOver90 = Number(p.BalOver90) || 0;
      const insEst = Number(p.InsEst) || 0;
      const balance = Number(p.BalTotal) || 0;

      const buckets: Record<string, { pt: number; ins: number }> = {};

      agingBuckets.forEach((bucket) => {
        buckets[bucket] = { pt: 0, ins: 0 };
      });

      // Distribute appropriately based on famaging table
      buckets['0 - 30 days'] = { pt: bal0_30, ins: insEst };
      buckets['31 - 60 days'] = { pt: bal31_60, ins: 0 };
      buckets['61 - 90 days'] = { pt: bal61_90, ins: 0 };
      buckets['91 - 120 days'] = { pt: balOver90, ins: 0 };

      return {
        id: p.PatNum.toString(),
        flags: [],
        name: `${p.FName} ${p.LName}`,
        insuranceName: p.CarrierName || null,
        buckets,
        total: balance,
        totalOwings: balance + (patientOnly ? 0 : insEst),
        paymentPlan: Number(p.PayPlanDue) || 0,
        credit: balance < 0 ? Math.abs(balance) : 0,
        lastBilled: ''
      };
    });

    if (report.length === 0) {
      return [];
    }

    return report;
  }

  private async getDepositSlipsReport(start: Date, end: Date) {
    const deposits = await prisma.deposit.findMany({
      where: { DateDeposit: { gte: start, lte: end } },
      take: 20
    });

    return deposits.map(d => ({
      depositId: d.DepositNum.toString(),
      date: d.DateDeposit?.toLocaleDateString() || '',
      amount: d.Amount ?? 0,
      bank: 'Chase Bank',
      status: 'Cleared'
    }));
  }

  private async getProductionReport(start: Date, end: Date) {
    const procs = await prisma.procedurelog.findMany({
      where: { ProcDate: { gte: start, lte: end }, ProcStatus: 2 },
      include: { provider_procedurelog_ProvNumToprovider: true },
      take: 50
    });

    return procs.map(p => ({
      procedureId: p.ProcNum.toString(),
      code: p.OldCode ?? 'D0120',
      fee: p.ProcFee ?? 0,
      date: p.ProcDate?.toLocaleDateString() || '',
      provider: p.provider_procedurelog_ProvNumToprovider ? `${p.provider_procedurelog_ProvNumToprovider.FName} ${p.provider_procedurelog_ProvNumToprovider.LName}` : 'Provider'
    }));
  }

  private async getProductionCollectionReport(start: Date, end: Date, summary = false) {
    // Standard joins of production and collections
    const payments = await prisma.payment.findMany({
      where: { PayDate: { gte: start, lte: end } },
      take: 30
    });

    return payments.map(p => ({
      date: p.PayDate?.toLocaleDateString() || '',
      production: (p.PayAmt ?? 0) * 1.1, // Mock production slightly higher
      collection: p.PayAmt ?? 0,
      paymentMethod: p.PayType ? 'Credit Card' : 'Check'
    }));
  }

  private async getProviderCollectionPaymentType(start: Date, end: Date) {
    // 1. Fetch patient payments via paysplit
    const paySplits = await prisma.paysplit.findMany({
      where: {
        DatePay: { gte: start, lte: end }
      },
      include: {
        patient: true,
        provider: true,
        procedurelog: true,
        payment: {
          include: {
            definition: true
          }
        }
      },
      take: 50
    });

    // 2. Fetch insurance payments via claimproc
    const claimProcs = await prisma.claimproc.findMany({
      where: {
        DateCP: { gte: start, lte: end },
        Status: { in: [1, 4] } // Finalized/Paid or Supplemental
      },
      include: {
        patient: true,
        provider: true,
        procedurelog: true,
        claimpayment: true
      },
      take: 50
    });

    // 3. Fetch adjustments via adjustment
    const adjustments = await prisma.adjustment.findMany({
      where: {
        AdjDate: { gte: start, lte: end }
      },
      include: {
        patient: true,
        provider: true,
        procedurelog: true
      },
      take: 50
    });

    const records: any[] = [];

    // Helper to format provider name/initials
    const getInitials = (prov: any) => {
      if (!prov) return 'MF';
      if (prov.Abbr) return prov.Abbr.trim();
      const f = prov.FName ? prov.FName.trim() : '';
      const l = prov.LName ? prov.LName.trim() : '';
      if (f && l) {
        return (f[0] + l.substring(0, 2)).toUpperCase();
      }
      return (f ? f.substring(0, 3) : 'MF').toUpperCase();
    };

    // Helper to map definition/PayType to paymentType string
    const getPaymentType = (ps: any) => {
      if (ps.payment?.definition?.ItemName) {
        return ps.payment.definition.ItemName;
      }
      return 'Check'; // Fallback
    };

    // Process patient payments
    for (const ps of paySplits) {
      const splitAmt = ps.SplitAmt ?? 0;
      const isRefund = splitAmt < 0;
      records.push({
        date: ps.DatePay?.toLocaleDateString() || ps.DateEntry?.toLocaleDateString() || '',
        flags: splitAmt > 1000 ? ['#e11d48'] : splitAmt > 200 ? ['#4a90e2'] : ['#f5a623'],
        patient: ps.patient ? `${ps.patient.FName} ${ps.patient.LName}` : 'Patient',
        code: ps.procedurelog?.OldCode || 'D0120',
        procedure: ps.procedurelog?.Surf || 'hygiene',
        render: getInitials(ps.provider),
        bill: getInitials(ps.provider),
        ins: 0,
        pt: isRefund ? 0 : splitAmt,
        actual: 0,
        adj: 0,
        ptRef: isRefund ? Math.abs(splitAmt) : 0,
        insRef: 0,
        payFrom: ps.UnearnedType ? splitAmt : 0,
        newCredit: 0,
        paymentType: getPaymentType(ps)
      });
    }

    // Process insurance claim payments and write-offs
    for (const cp of claimProcs) {
      const insPay = cp.InsPayAmt ?? 0;
      const writeOff = cp.WriteOff ?? 0;
      if (insPay === 0 && writeOff === 0) continue;

      const isRefund = insPay < 0;
      records.push({
        date: cp.DateCP?.toLocaleDateString() || cp.DateCP?.toLocaleDateString() || '',
        flags: insPay > 1000 ? ['#e11d48'] : insPay > 200 ? ['#4a90e2'] : ['#f5a623'],
        patient: cp.patient ? `${cp.patient.FName} ${cp.patient.LName}` : 'Patient',
        code: cp.procedurelog?.OldCode || 'D0120',
        procedure: cp.procedurelog?.Surf || 'hygiene',
        render: getInitials(cp.provider),
        bill: getInitials(cp.provider),
        ins: isRefund ? 0 : insPay,
        pt: 0,
        actual: writeOff,
        adj: 0,
        ptRef: 0,
        insRef: isRefund ? Math.abs(insPay) : 0,
        payFrom: 0,
        newCredit: 0,
        paymentType: 'Insurance'
      });
    }

    // Process adjustments
    for (const adj of adjustments) {
      const amount = adj.AdjAmt ?? 0;
      if (amount === 0) continue;
      records.push({
        date: adj.AdjDate?.toLocaleDateString() || adj.DateEntry?.toLocaleDateString() || '',
        flags: ['#4a90e2'],
        patient: adj.patient ? `${adj.patient.FName} ${adj.patient.LName}` : 'Patient',
        code: adj.procedurelog?.OldCode || 'D0120',
        procedure: adj.procedurelog?.Surf || 'Adjustment',
        render: getInitials(adj.provider),
        bill: getInitials(adj.provider),
        ins: 0,
        pt: 0,
        actual: 0,
        adj: amount,
        ptRef: 0,
        insRef: 0,
        payFrom: 0,
        newCredit: 0,
        paymentType: 'Adjustment'
      });
    }

    // If no real records found, return realistic default data for visualization
    if (records.length === 0) {
      const dateStr = start.toLocaleDateString();
      return [
        {
          date: dateStr,
          flags: ['#f5a623'],
          patient: 'Francis Fuller',
          code: 'D0274',
          procedure: 'BW4',
          render: 'SAB',
          bill: 'SAB',
          ins: 0,
          pt: 150.00,
          actual: 0,
          adj: 0,
          ptRef: 0,
          insRef: 0,
          payFrom: 0,
          newCredit: 0,
          paymentType: 'Credit Card'
        },
        {
          date: dateStr,
          flags: ['#f5a623'],
          patient: 'Garry Gilmore',
          code: 'D1110',
          procedure: 'hygiene',
          render: 'SAB',
          bill: 'SAB',
          ins: 0,
          pt: 120.00,
          actual: 0,
          adj: 0,
          ptRef: 0,
          insRef: 0,
          payFrom: 0,
          newCredit: 0,
          paymentType: 'Check'
        },
        {
          date: dateStr,
          flags: ['#f5a623', '#4a90e2', '#e11d48'],
          patient: 'Francis Fuller',
          code: 'D2740',
          procedure: '19 porc Cr',
          render: 'SAB',
          bill: 'SAB',
          ins: 470.00,
          pt: 0,
          actual: 100.00,
          adj: 0,
          ptRef: 0,
          insRef: 0,
          payFrom: 0,
          newCredit: 0,
          paymentType: 'Insurance'
        },
        {
          date: dateStr,
          flags: ['#4a90e2'],
          patient: 'Zoe Niblock',
          code: 'D0120',
          procedure: 'Periodic Exam',
          render: 'NIB',
          bill: 'NIB',
          ins: 0,
          pt: 80.00,
          actual: 0,
          adj: -10.00,
          ptRef: 0,
          insRef: 0,
          payFrom: 0,
          newCredit: 0,
          paymentType: 'Credit Card'
        }
      ];
    }

    return records;
  }

  private async getProductionPerCode(start: Date, end: Date) {
    const procs = await prisma.procedurelog.findMany({
      where: { ProcDate: { gte: start, lte: end }, ProcStatus: 2 },
      take: 50
    });

    const groups: Record<string, { code: string; count: number; totalFee: number }> = {};
    for (const p of procs) {
      const code = p.OldCode || 'D0120';
      if (!groups[code]) {
        groups[code] = { code, count: 0, totalFee: 0 };
      }
      groups[code].count++;
      groups[code].totalFee += p.ProcFee ?? 0;
    }

    return Object.values(groups);
  }

  private async getCollectionCodeCarrier(start: Date, end: Date) {
    return [
      { code: 'D1110', carrier: 'Delta Dental', collection: 120.00 },
      { code: 'D0210', carrier: 'Blue Cross', collection: 250.00 }
    ];
  }

  private async getAdjustmentReport(start: Date, end: Date) {
    const adjustments = await prisma.adjustment.findMany({
      where: { AdjDate: { gte: start, lte: end } },
      include: { provider: true, patient: true },
      take: 30
    });

    return adjustments.map(a => ({
      id: a.AdjNum.toString(),
      date: a.AdjDate?.toLocaleDateString() || '',
      amount: a.AdjAmt ?? 0,
      patient: a.patient ? `${a.patient.FName} ${a.patient.LName}` : 'Patient',
      provider: a.provider ? `${a.provider.FName} ${a.provider.LName}` : 'Provider',
      notes: a.AdjNote ?? ''
    }));
  }

  private async getCourtesyCreditModifications(start: Date, end: Date) {
    const courtesyDefs = await prisma.definition.findMany({
      where: {
        Category: 1, // AdjTypes
        ItemName: { contains: 'Courtesy', mode: 'insensitive' }
      }
    });
    const courtesyDefNums = courtesyDefs.map(d => d.DefNum);

    if (courtesyDefNums.length === 0) return [];

    const adjustments = await prisma.adjustment.findMany({
      where: { 
        AdjDate: { gte: start, lte: end },
        AdjType: { in: courtesyDefNums }
      }
    });
    const adjNums = adjustments.map(a => a.AdjNum);

    if (adjNums.length === 0) return [];

    const logs = await prisma.securitylog.findMany({
      where: {
        FKey: { in: adjNums },
        PermType: 106, // AdjustmentEdit
        LogDateTime: { gte: start, lte: end }
      },
      include: {
        userod: true,
        patient: true
      },
      take: 200
    });

    return logs.map(log => ({
      dateModified: log.LogDateTime?.toLocaleDateString() || '',
      user: log.userod ? log.userod.UserName : 'System',
      action: log.LogText || 'Modified Courtesy Credit',
      type: 'Adjustment',
      patient: log.patient ? `${log.patient.FName} ${log.patient.LName}` : 'Unknown',
      amount: 0
    }));
  }

  private async getCourtesyCreditReport(start: Date, end: Date, modifications = false) {
    if (modifications) {
      return this.getCourtesyCreditModifications(start, end);
    }

    const courtesyDefs = await prisma.definition.findMany({
      where: {
        Category: 1, // AdjTypes
        ItemName: { contains: 'Courtesy', mode: 'insensitive' }
      }
    });
    
    if (courtesyDefs.length === 0) return [];
    
    const courtesyDefNums = courtesyDefs.map(d => d.DefNum);

    const adjustments = await prisma.adjustment.findMany({
      where: { 
        AdjDate: { gte: start, lte: end },
        AdjType: { in: courtesyDefNums } 
      },
      include: {
        patient: true
      },
      take: 200
    });

    return adjustments.map(a => ({
      flags: [],
      id: a.patient?.PatNum?.toString() || '0',
      name: a.patient ? `${a.patient.FName} ${a.patient.LName}` : 'Unknown Patient',
      amount: Math.abs(a.AdjAmt ?? 0)
    }));
  }

  private async getCreditAccountsReport() {
    const patients = await prisma.patient.findMany({
      where: { BalTotal: { lt: 0 } },
      select: { 
        PatNum: true, 
        FName: true, 
        LName: true, 
        Birthdate: true,
        Email: true,
        HmPhone: true,
        WirelessPhone: true,
        BalTotal: true,
        InsEst: true 
      },
      take: 200
    });

    return patients.map(p => ({
      patientId: p.PatNum.toString(),
      name: `${p.FName} ${p.LName}`,
      dob: p.Birthdate?.toLocaleDateString() || '',
      email: p.Email || '',
      phone: p.WirelessPhone || p.HmPhone || '',
      amount: Math.abs(p.BalTotal ?? 0),
      credit: Math.abs(p.BalTotal ?? 0),
      insCredit: Math.abs(p.InsEst && p.InsEst < 0 ? p.InsEst : 0)
    }));
  }

  private async getModificationsReport(start: Date, end: Date) {
    return [
      { timestamp: new Date().toISOString(), modifiedBy: 'Dr. Sabour', field: 'Invoice Fee', originalValue: '150.00', newValue: '120.00' }
    ];
  }

  private async getDepositSummary(start: Date, end: Date) {
    const deposits = await prisma.deposit.findMany({
      where: { DateDeposit: { gte: start, lte: end } },
      take: 20
    });
    return deposits.map(d => ({
      date: d.DateDeposit?.toLocaleDateString() || '',
      amount: d.Amount ?? 0,
      comment: d.Memo ?? ''
    }));
  }

  private async getCollectionCarrier(start: Date, end: Date) {
    const claimProcs = await prisma.claimproc.findMany({
      where: {
        DateCP: { gte: start, lte: end },
        Status: { in: [1, 4] } // 1 = Received/Finalized, 4 = Supplemental
      },
      include: {
        patient: true,
        insplan: {
          include: { carrier: true }
        }
      },
      take: 500
    });

    // Group by carrier, then by patient within each carrier
    const carrierMap = new Map<string, {
      collection: number;
      production: number;
      writeoff: number;
      patients: Map<string, { name: string; collection: number; production: number; writeoff: number }>;
    }>();

    for (const cp of claimProcs) {
      const carrierName = cp.insplan?.carrier?.CarrierName ?? 'Unknown Carrier';
      const patientName = cp.patient
        ? `${cp.patient.FName ?? ''} ${cp.patient.LName ?? ''}`.trim()
        : 'Unknown Patient';

      const insPay = cp.InsPayAmt ?? 0;
      const fee = cp.FeeBilled ?? 0;
      const writeOff = cp.WriteOff ?? 0;

      // Init carrier bucket
      if (!carrierMap.has(carrierName)) {
        carrierMap.set(carrierName, { collection: 0, production: 0, writeoff: 0, patients: new Map() });
      }
      const carrierBucket = carrierMap.get(carrierName)!;
      carrierBucket.collection += insPay;
      carrierBucket.production += fee;
      carrierBucket.writeoff += writeOff;

      // Init patient bucket inside carrier
      if (!carrierBucket.patients.has(patientName)) {
        carrierBucket.patients.set(patientName, { name: patientName, collection: 0, production: 0, writeoff: 0 });
      }
      const patBucket = carrierBucket.patients.get(patientName)!;
      patBucket.collection += insPay;
      patBucket.production += fee;
      patBucket.writeoff += writeOff;
    }

    const fmt = (n: number) =>
      `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    // Fallback dummy data when no real records exist for the period
    if (carrierMap.size === 0) {
      return [
        {
          name: 'Delta Dental',
          collection: '$4,520.00',
          production: '$5,200.00',
          writeoff: '$680.00',
          patients: [
            { name: 'Francis Fuller', collection: '$2,200.00', production: '$2,550.00', writeoff: '$350.00' },
            { name: 'John Doe', collection: '$1,500.00', production: '$1,700.00', writeoff: '$200.00' },
            { name: 'Jane Smith', collection: '$820.00', production: '$950.00', writeoff: '$130.00' }
          ]
        },
        {
          name: 'Aetna',
          collection: '$2,850.00',
          production: '$3,300.00',
          writeoff: '$450.00',
          patients: [
            { name: 'Robert Brown', collection: '$1,500.00', production: '$1,750.00', writeoff: '$250.00' },
            { name: 'Emily Davis', collection: '$1,350.00', production: '$1,550.00', writeoff: '$200.00' }
          ]
        },
        {
          name: 'Cigna',
          collection: '$1,950.00',
          production: '$2,300.00',
          writeoff: '$350.00',
          patients: [
            { name: 'Michael Wilson', collection: '$1,000.00', production: '$1,200.00', writeoff: '$200.00' },
            { name: 'Sarah Johnson', collection: '$950.00', production: '$1,100.00', writeoff: '$150.00' }
          ]
        }
      ];
    }

    return Array.from(carrierMap.entries()).map(([name, data]) => ({
      name,
      collection: fmt(data.collection),
      production: fmt(data.production),
      writeoff: fmt(data.writeoff),
      patients: Array.from(data.patients.values()).map(p => ({
        name: p.name,
        collection: fmt(p.collection),
        production: fmt(p.production),
        writeoff: fmt(p.writeoff)
      }))
    }));
  }

  private async getTotalCollections(start: Date, end: Date, familyMode = false) {
    if (!familyMode) {
      // ── Individual mode: flat list of patient payments ──────────────────────
      const paySplits = await prisma.paysplit.findMany({
        where: { DatePay: { gte: start, lte: end } },
        include: { patient: true },
        take: 200
      });

      const claimProcs = await prisma.claimproc.findMany({
        where: {
          DateCP: { gte: start, lte: end },
          Status: { in: [1, 4] }
        },
        include: { patient: true },
        take: 200
      });

      const fmt = (n: number) =>
        `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

      // Aggregate per patient
      const patMap = new Map<string, { id: string; name: string; ptAmt: number; insAmt: number }>();

      for (const ps of paySplits) {
        const id = ps.PatNum?.toString() ?? '0';
        const name = ps.patient ? `${ps.patient.FName ?? ''} ${ps.patient.LName ?? ''}`.trim() : 'Unknown Patient';
        if (!patMap.has(id)) patMap.set(id, { id, name, ptAmt: 0, insAmt: 0 });
        patMap.get(id)!.ptAmt += ps.SplitAmt ?? 0;
      }
      for (const cp of claimProcs) {
        const id = cp.PatNum?.toString() ?? '0';
        const name = cp.patient ? `${cp.patient.FName ?? ''} ${cp.patient.LName ?? ''}`.trim() : 'Unknown Patient';
        if (!patMap.has(id)) patMap.set(id, { id, name, ptAmt: 0, insAmt: 0 });
        patMap.get(id)!.insAmt += cp.InsPayAmt ?? 0;
      }

      if (patMap.size === 0) {
        return [
          { id: '101', name: 'Francis Fuller', patientCollection: '$150.00', insuranceCollection: '$470.00', totalCollection: '$620.00' },
          { id: '102', name: 'Garry Gilmore', patientCollection: '$120.00', insuranceCollection: '$0.00', totalCollection: '$120.00' },
          { id: '103', name: 'Zoe Niblock', patientCollection: '$80.00', insuranceCollection: '$200.00', totalCollection: '$280.00' }
        ];
      }

      return Array.from(patMap.values()).map(p => ({
        id: p.id,
        name: p.name,
        patientCollection: fmt(p.ptAmt),
        insuranceCollection: fmt(p.insAmt),
        totalCollection: fmt(p.ptAmt + p.insAmt)
      }));
    }

    // ── Family mode: group members by Guarantor ────────────────────────────────
    const paySplits = await prisma.paysplit.findMany({
      where: { DatePay: { gte: start, lte: end } },
      include: {
        patient: {
          select: { PatNum: true, FName: true, LName: true, Guarantor: true }
        }
      },
      take: 500
    });

    const claimProcs = await prisma.claimproc.findMany({
      where: {
        DateCP: { gte: start, lte: end },
        Status: { in: [1, 4] }
      },
      include: {
        patient: {
          select: { PatNum: true, FName: true, LName: true, Guarantor: true }
        }
      },
      take: 500
    });

    // Fetch guarantor names for family labels
    const guarantorIds = new Set<bigint>();
    for (const ps of paySplits) {
      if (ps.patient?.Guarantor) guarantorIds.add(ps.patient.Guarantor);
    }
    for (const cp of claimProcs) {
      if (cp.patient?.Guarantor) guarantorIds.add(cp.patient.Guarantor);
    }

    const guarantors = guarantorIds.size > 0
      ? await prisma.patient.findMany({
        where: { PatNum: { in: Array.from(guarantorIds) } },
        select: { PatNum: true, FName: true, LName: true }
      })
      : [];

    const guarantorNameMap = new Map<string, string>();
    for (const g of guarantors) {
      guarantorNameMap.set(g.PatNum.toString(), `${g.FName ?? ''} ${g.LName ?? ''}`.trim());
    }

    // Structure: familyMap[guarantorId] → { members: Map<patId, {...}> }
    type MemberBucket = { id: string; name: string; ptAmt: number; insAmt: number };
    const familyMap = new Map<string, { members: Map<string, MemberBucket> }>();

    const getOrCreateFamily = (guarantorId: string) => {
      if (!familyMap.has(guarantorId)) {
        familyMap.set(guarantorId, { members: new Map() });
      }
      return familyMap.get(guarantorId)!;
    };

    for (const ps of paySplits) {
      const pat = ps.patient;
      const guarantorId = (pat?.Guarantor ?? pat?.PatNum)?.toString() ?? '0';
      const memberId = pat?.PatNum?.toString() ?? '0';
      const memberName = pat ? `${pat.FName ?? ''} ${pat.LName ?? ''}`.trim() : 'Unknown Patient';
      const family = getOrCreateFamily(guarantorId);

      if (!family.members.has(memberId)) {
        family.members.set(memberId, { id: memberId, name: memberName, ptAmt: 0, insAmt: 0 });
      }
      family.members.get(memberId)!.ptAmt += ps.SplitAmt ?? 0;
    }

    for (const cp of claimProcs) {
      const pat = cp.patient;
      const guarantorId = (pat?.Guarantor ?? pat?.PatNum)?.toString() ?? '0';
      const memberId = pat?.PatNum?.toString() ?? '0';
      const memberName = pat ? `${pat.FName ?? ''} ${pat.LName ?? ''}`.trim() : 'Unknown Patient';
      const family = getOrCreateFamily(guarantorId);

      if (!family.members.has(memberId)) {
        family.members.set(memberId, { id: memberId, name: memberName, ptAmt: 0, insAmt: 0 });
      }
      family.members.get(memberId)!.insAmt += cp.InsPayAmt ?? 0;
    }

    const fmt = (n: number) =>
      `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    // Fallback dummy data
    if (familyMap.size === 0) {
      return [
        {
          id: '196',
          name: 'Fuller Family',
          patientCollection: '$150.00',
          insuranceCollection: '$470.00',
          totalCollection: '$620.00',
          members: [
            { id: '196', name: 'Francis Fuller', patientCollection: '$150.00', insuranceCollection: '$470.00', totalCollection: '$620.00' }
          ]
        },
        {
          id: '298',
          name: 'Gilmore Family',
          patientCollection: '$120.00',
          insuranceCollection: '$0.00',
          totalCollection: '$120.00',
          members: [
            { id: '298', name: 'Garry Gilmore', patientCollection: '$80.00', insuranceCollection: '$0.00', totalCollection: '$80.00' },
            { id: '299', name: 'Linda Gilmore', patientCollection: '$40.00', insuranceCollection: '$0.00', totalCollection: '$40.00' }
          ]
        },
        {
          id: '782',
          name: 'Niblock Family',
          patientCollection: '$0.00',
          insuranceCollection: '$280.00',
          totalCollection: '$280.00',
          members: [
            { id: '782', name: 'Zoe Niblock', patientCollection: '$0.00', insuranceCollection: '$280.00', totalCollection: '$280.00' }
          ]
        }
      ];
    }

    return Array.from(familyMap.entries()).map(([guarantorId, family]) => {
      const familyName = guarantorNameMap.get(guarantorId)
        ? `${guarantorNameMap.get(guarantorId)} Family`
        : 'Family';

      let totalPt = 0;
      let totalIns = 0;

      const members = Array.from(family.members.values()).map(m => {
        totalPt += m.ptAmt;
        totalIns += m.insAmt;
        return {
          id: m.id,
          name: m.name,
          patientCollection: fmt(m.ptAmt),
          insuranceCollection: fmt(m.insAmt),
          totalCollection: fmt(m.ptAmt + m.insAmt)
        };
      });

      return {
        id: guarantorId,
        name: familyName,
        patientCollection: fmt(totalPt),
        insuranceCollection: fmt(totalIns),
        totalCollection: fmt(totalPt + totalIns),
        members
      };
    });
  }

  private async getPaymentPlansReport(linesOnly = false) {
    const plans = await prisma.payplan.findMany({
      include: {
        patient_payplan_PatNumTopatient: {
          select: { PatNum: true, FName: true, LName: true }
        },
        payplancharge: {
          orderBy: { ChargeDate: 'asc' }
        }
      },
      take: 50
    });

    const fmt = (n: number) =>
      `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Fallback dummy data when DB has no plans
    if (plans.length === 0) {
      return [
        {
          patient: 'Francis Fuller',
          createdOn: '09/18/2025',
          amount: '$357.87',
          totalPayments: 6,
          remainingPayments: 3,
          remainingBalance: '$1,073.61',
          nextDue: '12/18/2025',
          missed: 3,
          lastBilled: '11/18/2025',
          lastPayment: '11/18/2025',
          type: 'Regular Invoice',
          status: 'Failed',
          history: [
            { amount: '$357.87', status: 'Paid', created: '09/18/2025', due: '09/18/2025', downPayment: 'No', charged: '09/18/2025', failed: '', error: '' },
            { amount: '$357.87', status: 'Paid', created: '09/18/2025', due: '10/18/2025', downPayment: 'No', charged: '10/18/2025', failed: '', error: '' },
            { amount: '$357.87', status: 'Paid', created: '09/18/2025', due: '11/18/2025', downPayment: 'No', charged: '11/18/2025', failed: '', error: '' },
            { amount: '$357.87', status: 'Failed', created: '09/18/2025', due: '12/18/2025', downPayment: 'No', charged: '', failed: '12/24/2025', error: 'Transaction declined: Insufficient Funds' },
          ]
        },
        {
          patient: 'Garry Gilmore',
          createdOn: '12/15/2025',
          amount: '$42.00',
          totalPayments: 10,
          remainingPayments: 5,
          remainingBalance: '$210.00',
          nextDue: '05/24/2026',
          missed: 0,
          lastBilled: '04/24/2026',
          lastPayment: '04/24/2026',
          type: 'Regular Invoice',
          status: 'Scheduled',
          history: []
        }
      ];
    }

    const results = plans.map(plan => {
      const pat = plan.patient_payplan_PatNumTopatient;
      const patientId = pat ? pat.PatNum.toString() : '';
      const patientName = pat
        ? `${pat.FName ?? ''} ${pat.LName ?? ''}`.trim()
        : 'Unknown Patient';

      const charges = plan.payplancharge ?? [];
      // Only debit-type charges (ChargeType 0 = debit/charge row, 1 = credit/payment row)
      const debitCharges = charges.filter(c => (c.ChargeType ?? 0) === 0);
      const totalPayments = debitCharges.length || plan.NumberOfPayments || 0;

      // Installment amount per charge row; fallback to PayAmt field
      const installmentAmt = debitCharges.length > 0
        ? Number(debitCharges[0]?.Principal ?? 0) + Number(debitCharges[0]?.Interest ?? 0)
        : Number(plan.PayAmt ?? 0);

      // Credit/payment rows represent completed payments
      const creditCharges = charges.filter(c => (c.ChargeType ?? 0) === 1);
      const completedPayments = creditCharges.length;
      const remainingPayments = Math.max(0, totalPayments - completedPayments);

      // Remaining balance = remaining installments × installment amount
      const remainingBalance = remainingPayments * installmentAmt;

      // Next due = earliest future debit charge date
      const futureDue = debitCharges
        .filter(c => c.ChargeDate && c.ChargeDate >= today)
        .map(c => c.ChargeDate as Date);
      const nextDueDate = futureDue.length > 0 ? futureDue[0] : null;
      const nextDue = nextDueDate ? nextDueDate.toLocaleDateString() : '';

      // Missed = past debit charges not covered by credits
      const pastDue = debitCharges.filter(c => c.ChargeDate && c.ChargeDate < today).length;
      const missed = Math.max(0, pastDue - completedPayments);

      // Last billed = latest debit charge date in the past
      const pastDebits = debitCharges.filter(c => c.ChargeDate && c.ChargeDate < today);
      const lastBilledDate = pastDebits.length > 0
        ? pastDebits[pastDebits.length - 1]?.ChargeDate
        : null;
      const lastBilled = lastBilledDate ? (lastBilledDate as Date).toLocaleDateString() : '';

      // Last payment = latest credit date
      const lastCreditDate = creditCharges.length > 0
        ? creditCharges[creditCharges.length - 1]?.ChargeDate
        : null;
      const lastPayment = lastCreditDate ? (lastCreditDate as Date).toLocaleDateString() : '';

      // Plan status
      let status = 'Scheduled';
      if (plan.IsClosed === 1 || remainingPayments === 0) {
        status = 'Paid';
      } else if (missed > 0) {
        status = 'Failed';
      } else if (completedPayments > 0) {
        status = 'Active';
      }

      // Plan type from PaySchedule: 0 = Manual, 1 = Regular Invoice, else Other
      const typeMap: Record<number, string> = { 0: 'Manual Fee', 1: 'Regular Invoice', 2: 'Membership Plan' };
      const type = typeMap[plan.PaySchedule ?? 1] ?? 'Regular Invoice';

      // Plan creation date
      const createdOn = plan.PayPlanDate
        ? (plan.PayPlanDate as Date).toLocaleDateString()
        : plan.DatePayPlanStart
          ? (plan.DatePayPlanStart as Date).toLocaleDateString()
          : '';

      // Build history from debit charge rows
      const history = debitCharges.map((c, idx) => {
        const dueDate = c.ChargeDate ? (c.ChargeDate as Date).toLocaleDateString() : '';
        const created = plan.PayPlanDate ? (plan.PayPlanDate as Date).toLocaleDateString() : dueDate;
        const isPaid = idx < completedPayments;
        const isPast = c.ChargeDate ? c.ChargeDate < today : false;
        const isFailed = isPast && !isPaid;
        const chargeAmt = (c.Principal ?? 0) + (c.Interest ?? 0);

        // Match a credit row to this charge by index order
        const matchedCredit = creditCharges[idx];
        const chargedDate = isPaid && matchedCredit?.ChargeDate
          ? (matchedCredit.ChargeDate as Date).toLocaleDateString()
          : '';
        const failedDate = isFailed ? (c.ChargeDate as Date).toLocaleDateString() : '';

        return {
          id: c.PayPlanChargeNum ? c.PayPlanChargeNum.toString() : plan.PayPlanNum.toString() + '-' + idx,
          patientId,
          patient: patientName,
          amount: fmt(chargeAmt > 0 ? chargeAmt : installmentAmt),
          status: isPaid ? 'Paid' : isFailed ? 'Failed' : 'Scheduled',
          created,
          dueDate,
          downPayment: c.IsDownPayment === 1 ? 'Yes' : 'No',
          chargedOn: chargedDate,
          failedOn: failedDate,
          failedAttempts: isFailed ? 1 : 0,
          error: isFailed ? 'Transaction declined: Insufficient Funds' : ''
        };
      });

      return {
        patient: patientName,
        createdOn,
        amount: fmt(installmentAmt),
        totalPayments,
        remainingPayments,
        remainingBalance: fmt(remainingBalance),
        nextDue,
        missed,
        lastBilled,
        lastPayment,
        type,
        status,
        history
      };
    });

    if (linesOnly) {
      // Flatten all history items to return flat individual payment lines
      const flatLines: any[] = [];
      results.forEach(plan => {
        if (plan.history && plan.history.length > 0) {
          plan.history.forEach(line => {
            flatLines.push({
              id: (line as any).id,
              patientId: (line as any).patientId,
              patient: line.patient,
              amount: line.amount,
              downPayment: line.downPayment,
              dueDate: line.dueDate,
              chargedOn: line.chargedOn,
              failedOn: line.failedOn,
              failedAttempts: (line as any).failedAttempts,
              status: line.status,
              error: line.error
            });
          });
        }
      });

      if (flatLines.length === 0) {
        // Fallback dummy individual lines
        return [
          { id: '966', patient: 'Patient One', amount: '$65.00', downPayment: 'No', dueDate: '05/15/2026', chargedOn: '', failedOn: '', failedAttempts: 0, status: 'Scheduled', error: '' },
          { id: '232', patient: 'Patient Two', amount: '$42.00', downPayment: 'No', dueDate: '05/20/2026', chargedOn: '', failedOn: '', failedAttempts: 0, status: 'Scheduled', error: '' },
          { id: '1247', patient: 'Patient Three', amount: '$599.50', downPayment: 'No', dueDate: '05/22/2026', chargedOn: '', failedOn: '', failedAttempts: 0, status: 'Scheduled', error: '' },
          { id: '856', patient: 'Patient Four', amount: '$266.67', downPayment: 'No', dueDate: '05/22/2026', chargedOn: '', failedOn: '', failedAttempts: 0, status: 'Scheduled', error: '' },
          { id: '986', patient: 'Patient Five', amount: '$1,295.67', downPayment: 'No', dueDate: '05/23/2026', chargedOn: '', failedOn: '', failedAttempts: 0, status: 'Scheduled', error: '' },
        ];
      }
      return flatLines;
    }

    return results;
  }

  private async getPaymentRequestsReport(start: Date, end: Date) {
    return [
      { patient: 'Patient One', created: '05/08/2025', requested: '$358.00', paid: '--------', date: '', status: '' },
      { patient: 'Patient Two', created: '05/08/2025', requested: '$1,000.00', paid: '--------', date: '', status: '' },
      { patient: 'Patient Three', created: '05/08/2025', requested: '$288.00', paid: '$288.00', date: '05/10/2025', status: 'Successful Transaction' },
      { patient: 'Patient Four', created: '05/13/2025', requested: '$69.00', paid: '$69.00', date: '05/13/2025', status: 'Successful Transaction' },
      { patient: 'Patient Five', created: '05/14/2025', requested: '$877.10', paid: '$877.10', date: '05/14/2025', status: 'Successful Transaction' },
    ];
  }

  private async getOpenEdgeTransactions(start: Date, end: Date) {
    return [
      { id: 'Patient A (861)', created: '05/26/2025', type: 'Payment', number: '18381', status: 'Pending' },
      { id: 'Patient B (452)', created: '06/24/2025', type: 'Payment', number: '18891', status: 'Pending' },
      { id: 'Patient C (123)', created: '07/15/2025', type: 'Payment', number: '19282', status: 'Pending' },
      { id: 'Patient D (789)', created: '02/03/2026', type: 'Payment', number: '23110', status: 'Pending' },
      { id: 'Patient E (456)', created: '02/27/2026', type: 'Payment', number: '23519', status: 'Pending' },
      { id: 'Patient F (321)', created: '03/20/2026', type: 'Payment', number: '23987', status: 'Pending' },
      { id: 'Patient G (654)', created: '03/27/2026', type: 'Payment', number: '24171', status: 'Pending' },
      { id: 'Patient H (987)', created: '05/08/2026', type: 'Payment', number: '25200', status: 'Pending' },
      { id: 'Patient I (159)', created: '05/08/2026', type: 'Payment', number: '25214', status: 'Pending' },
      { id: 'Patient J (753)', created: '07/15/2025', type: 'Deposit', number: '19272', status: 'Pending' }
    ];
  }

  private async getProceduresInsurance(start: Date, end: Date) {
    return [
      { code: 'D1110', patient: 'Francis Fuller', insurance: 'Delta Dental', claimStatus: 'Sent' }
    ];
  }

  private async getFamilyMigratedBalances() {
    return [
      { patient: 'Jane Smith', patientOwing: 2500.00, insuranceOwing: 1224.00, totalOwing: 3724.00, migrationDate: '04/10/2026' }
    ];
  }

  // ==========================================
  // CLINICAL REPORTS QUERY HELPERS
  // ==========================================

  private async getRecareReport() {
    const recalls = await prisma.recall.findMany({
      where: { IsDisabled: 0 },
      include: { patient: true },
      take: 50
    });

    const getAge = (birthDate: Date | null) => {
      if (!birthDate) return 40;
      const today = new Date();
      let age = today.getFullYear() - birthDate.getFullYear();
      const m = today.getMonth() - birthDate.getMonth();
      if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
        age--;
      }
      return age;
    };

    return recalls.map((r, idx) => {
      const p = r.patient;
      const patientName = p ? `${p.FName} ${p.LName}` : 'Patient';
      const age = p ? getAge(p.Birthdate) : 40;
      const contact = p ? (p.WirelessPhone || p.HmPhone || p.WkPhone || '(555) 123-4567') : '(555) 123-4567';
      const recallDate = r.DateDue ? (r.DateDue as Date).toLocaleDateString() : '';
      const lastExam = r.DatePrevious ? (r.DatePrevious as Date).toLocaleDateString() : '';
      const lastProphy = r.DatePrevious ? (r.DatePrevious as Date).toLocaleDateString() : '';

      return {
        id: r.RecallNum ? r.RecallNum.toString() : idx.toString(),
        patient: patientName,
        flags: r.Priority === 1 ? 'red' : '',
        age,
        contact,
        recallDate,
        lastExam,
        lastProphy,
        lastMaintenance: '',
        lastComm: '',
        note: r.Note || '',
        contactAgain: 'Y',
        followUp: '',
        apptDate: r.DateScheduled ? (r.DateScheduled as Date).toLocaleDateString() : '',
        contactCount: 0
      };
    });
  }

  private async getUnsignedProgressNotesReport(start: Date, end: Date) {
    const procs = await prisma.procedurelog.findMany({
      where: {
        ProcDate: { gte: start, lte: end },
        ProcStatus: 2
      },
      include: {
        patient: true,
        provider_procedurelog_ProvNumToprovider: true,
        procnote: {
          orderBy: { EntryDateTime: 'desc' },
          take: 1
        }
      },
      take: 50
    });

    const getKindByCpt = (cpt: string) => {
      const code = cpt.toUpperCase();
      if (code.startsWith('D01') || code.startsWith('D02') || code.startsWith('D03') || code.startsWith('D04')) {
        return 'Exam';
      }
      if (code.startsWith('D1')) {
        return 'Recare';
      }
      if (code.startsWith('D2') || code.startsWith('D3') || code.startsWith('D4') || code.startsWith('D5') || code.startsWith('D6') || code.startsWith('D7') || code.startsWith('D8') || code.startsWith('D9')) {
        return 'Treatment';
      }
      return 'General';
    };

    return procs.map((p, idx) => {
      const matchedNote = p.procnote?.[0]?.Note || '';
      const cpt = p.OldCode ?? 'D0120';
      const kind = getKindByCpt(cpt);

      return {
        id: p.ProcNum.toString(),
        patient: p.patient ? `${p.patient.FName} ${p.patient.LName}` : 'Patient',
        date: p.ProcDate ? (p.ProcDate as Date).toLocaleDateString() : '',
        kind,
        provider: p.provider_procedurelog_ProvNumToprovider ? `${p.provider_procedurelog_ProvNumToprovider.FName} ${p.provider_procedurelog_ProvNumToprovider.LName}` : 'Provider',
        note: matchedNote
      };
    });
  }

  private async getRxReport(start: Date, end: Date) {
    const prescriptions = await prisma.rxpat.findMany({
      where: { RxDate: { gte: start, lte: end } },
      include: { patient: true, provider: true },
      take: 50
    });

    const report = prescriptions.map(r => ({
      id: Number(r.RxNum),
      provider: r.provider ? `Dr. ${r.provider.LName}` : 'Dr. Smith',
      patient: r.patient ? `${r.patient.FName} ${r.patient.LName}` : 'Patient',
      startDate: r.RxDate ? (r.RxDate as Date).toLocaleDateString() : '',
      dose: r.Sig ?? '5MG',
      refills: Number(r.Refills) || 0,
      duration: r.DaysOfSupply ? `${r.DaysOfSupply} Days` : '2 Week',
      longTerm: r.IsControlled === 1 ? 'Yes' : 'No',
      prints: 0,
      notes: r.Notes ?? '',
      drugName: r.Drug ?? 'FLEXERIL'
    }));

    if (report.length === 0) {
      return [
        {
          id: 77,
          provider: 'Dr. Smith',
          patient: 'Francis Fuller',
          startDate: '05/07/2026',
          dose: '5MG',
          refills: 0,
          duration: '2 Week',
          longTerm: 'No',
          prints: 0,
          notes: '',
          drugName: 'FLEXERIL'
        }
      ];
    }

    return report;
  }

  // ==========================================
  // PATIENT REPORTS QUERY HELPERS
  // ==========================================

  private async getPatientInsuranceCoverage() {
    const plans = await prisma.patplan.findMany({
      include: {
        patient: true,
        inssub: {
          include: {
            insplan: {
              include: {
                carrier: true
              }
            }
          }
        }
      },
      take: 50
    });

    const report = plans.map(p => {
      const patientName = p.patient ? `${p.patient.FName} ${p.patient.LName}` : 'Patient';
      const email = p.patient?.Email || '';
      const planNameVal = p.inssub?.insplan?.GroupName
        ? `${p.inssub.insplan.GroupName} (${p.inssub.insplan.PlanNum.toString()})`
        : p.inssub?.insplan?.GroupNum
          ? `${p.inssub.insplan.GroupNum} (${p.inssub.insplan.PlanNum.toString()})`
          : 'Standard Insurance';
      const payer = p.inssub?.insplan?.carrier?.CarrierName || 'Standard Insurance';
      const patientNum = p.PatNum ? p.PatNum.toString() : '';

      return {
        number: patientNum,
        patient: patientName,
        email,
        planName: planNameVal,
        payer,
        lastAppointment: p.patient?.DateFirstVisit ? (p.patient.DateFirstVisit as Date).toLocaleDateString() : '',
        feeSchedule: '',
        planRenewalDate: 'January',
        assignmentStatus: 'Assignment'
      };
    });

    if (report.length === 0) {
      return [
        {
          number: '1262',
          patient: 'John Doe',
          email: 'john.doe@example.com',
          planName: 'Standard Insurance (160-173134-1)',
          payer: 'Standard Insurance',
          lastAppointment: '',
          feeSchedule: '',
          planRenewalDate: 'January',
          assignmentStatus: 'Assignment',
        },
        {
          number: '1254',
          patient: 'Jane Smith',
          email: 'jane.smith@example.com',
          planName: 'Walmart (8000-00010000)',
          payer: 'Delta Dental of Arkansas',
          lastAppointment: '05/05/2026',
          feeSchedule: '',
          planRenewalDate: 'January',
          assignmentStatus: 'Assignment',
        },
        {
          number: '1247',
          patient: 'Robert Brown',
          email: 'robert.b@example.com',
          planName: 'Blue Cross Blue Shield of Texas (387291)',
          payer: 'Blue Cross Blue Shield of Texas',
          lastAppointment: '',
          feeSchedule: 'Careington PPO Platinum (directly in network)',
          planRenewalDate: 'January',
          assignmentStatus: 'Assignment',
        }
      ];
    }

    return report;
  }

  private async getPatientMembershipPlan() {
    return [
      {
        number: '1249',
        patient: 'John Doe',
        email: 'john.doe@example.com',
        planName: 'Foundations (Perio) Program - New Patient',
        lastAppointment: '',
        renewalMonth: 'April',
      },
      {
        number: '1210',
        patient: 'Jane Smith',
        email: 'jane.smith@example.com',
        planName: 'Foundations (Perio) Program - New Patient',
        lastAppointment: '',
        renewalMonth: 'February',
      },
      {
        number: '540',
        patient: 'Robert Brown',
        email: 'robert.b@example.com',
        planName: 'Clean + Confident - Existing Patient',
        lastAppointment: '',
        renewalMonth: 'March',
      },
      {
        number: '185',
        patient: 'Michael Johnson',
        email: 'm.johnson@example.com',
        planName: 'Foundations (Perio) Program Existing Patient',
        lastAppointment: '',
        renewalMonth: 'April',
      },
      {
        number: '181',
        patient: 'William Davis',
        email: 'w.davis@example.com',
        planName: 'Foundations (Perio) Program - New Patient',
        lastAppointment: '',
        renewalMonth: 'May',
      },
      {
        number: '62',
        patient: 'Elizabeth Garcia',
        email: 'e.garcia@example.com',
        planName: 'Bright Beginning',
        lastAppointment: '',
        renewalMonth: 'February',
      },
      {
        number: '4',
        patient: 'David Martinez',
        email: 'd.martinez@example.com',
        planName: 'Clean + Confident - Existing Patient',
        lastAppointment: '',
        renewalMonth: 'February',
      }
    ];
  }

  private async getReferralByPatient(start?: Date, end?: Date) {
    const whereClause: any = {};
    if (start && end) {
      whereClause.RefDate = {
        gte: start,
        lte: end
      };
    }

    // Query the relationship table instead of just the referral source
    const refAttaches = await prisma.refattach.findMany({
      where: whereClause,
      include: {
        patient: true, // The referred patient
        referral: true // The referral source
      },
      take: 50 // Increase limit as needed
    });

    return refAttaches.map((r) => ({
      // Name of the referred patient
      referred: r.patient ? `${r.patient.FName} ${r.patient.LName}`.trim() : '',

      // Contact info for the referred patient
      phone: r.patient ? (r.patient.WirelessPhone || r.patient.WkPhone || r.patient.HmPhone || '') : '',
      email: r.patient?.Email || '',

      // Name of the referral source (who referred them)
      referredBy: r.referral
        ? (r.referral.NotPerson ? r.referral.BusinessName : `${r.referral.FName || ''} ${r.referral.LName || ''}`.trim())
        : 'Unknown Referral Source',

      // Date of the referral
      date: r.RefDate ? r.RefDate.toISOString().split('T')[0] : ''
    }));
  }

  private async getOnlineSchedulingReferral(start: Date, end: Date) {
    return [
      { patient: 'Jane Smith', date: new Date().toLocaleDateString(), referralSource: 'Google Search' }
    ];
  }

  private async getPatientByFlag(
    filterBy?: string,
    includeFlagsInput?: string | string[],
    excludeFlagsInput?: string | string[]
  ) {
    const parseFlags = (input: any): string[] => {
      if (!input) return [];
      if (Array.isArray(input)) return input.map(f => String(f).trim().toUpperCase()).filter(Boolean);
      if (typeof input === 'string') {
        return input.split(',').map(f => f.trim().toUpperCase()).filter(Boolean);
      }
      return [];
    };

    const includeFlags = parseFlags(includeFlagsInput);
    const excludeFlags = parseFlags(excludeFlagsInput);

    const where: any = {};
    if (filterBy === 'active') {
      where.PatStatus = 0;
    } else if (filterBy === 'inactive') {
      where.PatStatus = 2;
    } else if (filterBy === 'all') {
      where.PatStatus = { in: [0, 2] };
    }

    const patients = await prisma.patient.findMany({
      where,
      take: 200,
      select: {
        PatNum: true,
        FName: true,
        LName: true,
        appointment: {
          select: {
            AptDateTime: true
          },
          orderBy: {
            AptDateTime: 'desc'
          },
          take: 1
        }
      }
    });

    if (!patients.length) {
      return [];
    }

    const patNums = patients.map(p => p.PatNum);
    const patientsMeta = await getPatientsMeta(patNums);

    const results = patients.map(p => {
      const meta = patientsMeta[p.PatNum.toString()] || {};
      const pFlags: string[] = meta.patientFlags || [];

      // Check inclusion
      if (includeFlags.length > 0) {
        const hasIncluded = pFlags.some(f => includeFlags.includes(f.toUpperCase()));
        if (!hasIncluded) return null;
      }

      // Check exclusion
      if (excludeFlags.length > 0) {
        const hasExcluded = pFlags.some(f => excludeFlags.includes(f.toUpperCase()));
        if (hasExcluded) return null;
      }

      const lastAppt = p.appointment?.[0]?.AptDateTime;

      return {
        number: p.PatNum.toString(),
        patient: `${p.FName} ${p.LName}`,
        flags: pFlags.join(', '),
        lastAppointment: lastAppt ? lastAppt.toLocaleDateString() : ''
      };
    }).filter(Boolean);

    return results;
  }

  private async getCancelledOrNoShowAppointments(start: Date, end: Date, isNoShow = false) {
    const appointments = await prisma.appointment.findMany({
      where: {
        AptDateTime: { gte: start, lte: end },
        AptStatus: isNoShow ? 3 : 4 // 3 = NoShow, 4 = Cancelled
      },
      include: { patient: true, provider_appointment_ProvNumToprovider: true },
      take: 30
    });

    return appointments.map(a => ({
      id: a.AptNum.toString(),
      patient: a.patient ? `${a.patient.FName} ${a.patient.LName}` : 'Patient',
      provider: a.provider_appointment_ProvNumToprovider ? `${a.provider_appointment_ProvNumToprovider.FName} ${a.provider_appointment_ProvNumToprovider.LName}` : 'Provider',
      date: a.AptDateTime?.toLocaleDateString() || '',
      reason: a.Note ?? 'Patient schedule conflict'
    }));
  }

  private async getAppointmentsReport(start: Date, end: Date) {
    const appointments = await prisma.appointment.findMany({
      where: { AptDateTime: { gte: start, lte: end } },
      include: { patient: true, provider_appointment_ProvNumToprovider: true },
      take: 50
    });

    return appointments.map(a => ({
      id: a.AptNum.toString(),
      patient: a.patient ? `${a.patient.FName} ${a.patient.LName}` : 'Patient',
      provider: a.provider_appointment_ProvNumToprovider ? `${a.provider_appointment_ProvNumToprovider.FName} ${a.provider_appointment_ProvNumToprovider.LName}` : 'Provider',
      date: a.AptDateTime?.toLocaleDateString() || '',
      time: a.AptDateTime?.toLocaleTimeString() || '',
      status: a.AptStatus === 1 ? 'Completed' : a.AptStatus === 4 ? 'Cancelled' : 'Scheduled'
    }));
  }

  private async getDuplicatePatients() {
    const duplicates = await prisma.patient.findMany({
      take: 20
    });

    return duplicates.slice(0, 2).map(p => ({
      patientId: p.PatNum.toString(),
      name: `${p.FName} ${p.LName}`,
      dob: p.Birthdate?.toLocaleDateString() || '',
      matchesWith: 'Duplicate Record found'
    }));
  }

  private async getPatientContactPreferences() {
    const patients = await prisma.patient.findMany({
      select: { PatNum: true, FName: true, LName: true, PreferContactMethod: true },
      take: 30
    });

    const getPrefMethod = (val?: number | null) => {
      switch (val) {
        case 1: return 'Email';
        case 2: return 'SMS';
        case 3: return 'Portal';
        default: return 'Phone';
      }
    };

    return patients.map(p => ({
      patientId: p.PatNum.toString(),
      name: `${p.FName} ${p.LName}`,
      preference: getPrefMethod(p.PreferContactMethod)
    }));
  }

  private async getPatientAppointmentMilestones(nextAppt = false) {
    const patients = await prisma.patient.findMany({
      select: { PatNum: true, FName: true, LName: true, DateFirstVisit: true },
      take: 20
    });

    return patients.map(p => ({
      patientId: p.PatNum.toString(),
      name: `${p.FName} ${p.LName}`,
      date: nextAppt ? new Date().toLocaleDateString() : p.DateFirstVisit?.toLocaleDateString() || ''
    }));
  }

  private async getReferralDocuments() {
    return [
      { date: new Date().toLocaleDateString(), patient: 'Francis Fuller', documentName: 'referral_slip.pdf' }
    ];
  }

  private async getLabCaseReport(start: Date, end: Date) {
    const cases = await prisma.labcase.findMany({
      where: { DateTimeCreated: { gte: start, lte: end } },
      include: { patient: true },
      take: 20
    });

    return cases.map(c => ({
      caseId: c.LabCaseNum.toString(),
      patient: c.patient ? `${c.patient.FName} ${c.patient.LName}` : 'Patient',
      dueDate: c.DateTimeDue?.toLocaleDateString() || '',
      instructions: c.Instructions ?? ''
    }));
  }

  private async getDiscountEditedFeeReport(start: Date, end: Date) {
    return [
      { code: 'D1110', originalFee: 150.00, actualFee: 120.00, discount: 30.00, date: new Date().toLocaleDateString() }
    ];
  }

  private async getPatientReviewsReport(start: Date, end: Date) {
    return [
      { date: new Date().toLocaleDateString(), reviewer: 'Francis Fuller', rating: 5, comment: 'Great clinic and doctors!' }
    ];
  }

  private async getPatientNotificationsReport(start: Date, end: Date) {
    return [
      { date: new Date().toLocaleDateString(), patient: 'Francis Fuller', message: 'Appointment reminder sent', channel: 'SMS' }
    ];
  }

  private async getPatientProceduresReport(start: Date, end: Date) {
    const procs = await prisma.procedurelog.findMany({
      where: { ProcDate: { gte: start, lte: end } },
      include: { patient: true },
      take: 30
    });

    return procs.map(p => ({
      code: p.OldCode ?? 'D0120',
      patient: p.patient ? `${p.patient.FName} ${p.patient.LName}` : 'Patient',
      fee: p.ProcFee ?? 0,
      date: p.ProcDate?.toLocaleDateString() || ''
    }));
  }

  private async getPatientTrackers() {
    return [
      { patient: 'John Doe', stage: 'Onboarding Completed', date: new Date().toLocaleDateString() }
    ];
  }

  // ==========================================
  // OTHERS REPORTS QUERY HELPERS
  // ==========================================

  private async getLoginReport(start: Date, end: Date) {
    const instances = await prisma.activeinstance.findMany({
      where: { DateTimeLastActive: { gte: start, lte: end } },
      include: { userod: true, computer: true },
      take: 50
    });

    const report = instances.map((i, idx) => {
      const dateStr = i.DateTimeLastActive
        ? (i.DateTimeLastActive as Date).toLocaleString('en-US', {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          hour12: true
        })
        : '';

      return {
        id: i.ActiveInstanceNum ? Number(i.ActiveInstanceNum) : idx + 1,
        username: i.userod?.UserName ?? 'Unknown User',
        date: dateStr,
        status: 'Success',
        ip: '127.0.0.1',
        machine: i.computer?.CompName ? `Machine: ${i.computer.CompName}` : 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      };
    });

    if (report.length === 0) {
      return [
        { id: 1, username: 'Babar Magsi', date: '05/08/2026 2:20 PM', status: 'Success', ip: '125.209.73.246', machine: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36' },
        { id: 2, username: 'Dr. Smith', date: '05/08/2026 1:07 PM', status: 'Success', ip: '125.209.73.246', machine: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36' },
        { id: 3, username: 'Hygienist A', date: '05/08/2026 1:05 PM', status: 'Success', ip: '182.188.108.206', machine: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36' },
        { id: 4, username: 'Staff B', date: '05/08/2026 1:02 PM', status: 'Success', ip: '162.251.62.66', machine: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36' },
        { id: 5, username: 'Babar Magsi', date: '05/08/2026 12:42 PM', status: 'Success', ip: '182.188.108.206', machine: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36' }
      ];
    }

    return report;
  }

  private async getAuditReport(start: Date, end: Date) {
    return [
      { id: 1, patient: '', user: 'Babar Magsi', category: 'Report', subcategory: 'Report', action: 'Action Performed', object: 'User Login Report', date: '05/08/2026 02:26 PM', message: 'Success, duration=171ms, params=startDate=2026-5-8 & endDate=2026-5-8', diff: { key: '', old: '', new: '' } },
      { id: 2, patient: '', user: 'Babar Magsi', category: 'Report', subcategory: 'Report', action: 'Action Performed', object: 'Recare List Report', date: '05/08/2026 02:25 PM', message: 'Success, duration=40ms, params={"currentPage":1,"pageSize":15,"includeAppointed":false,"patientList":[],"includeFlags":null,"flagIds":null}', diff: { key: '', old: '', new: '' } },
      { id: 3, patient: '', user: 'Babar Magsi', category: 'Report', subcategory: 'Report', action: 'Action Performed', object: 'Recare List Report', date: '05/08/2026 02:25 PM', message: 'Success, duration=38ms, params={"currentPage":1,"pageSize":15,"includeAppointed":false,"patientList":[],"includeFlags":null,"flagIds":null}', diff: { key: '', old: '', new: '' } },
      { id: 4, patient: '', user: 'Babar Magsi', category: 'Report', subcategory: 'Report', action: 'Action Performed', object: 'Rx Report', date: '05/08/2026 02:25 PM', message: 'Success, duration=20ms, params=startDate=2026-5-7 & endDate=2026-5-8', diff: { key: '', old: '', new: '' } },
      { id: 5, patient: '', user: 'Y... S...', category: 'Report', subcategory: 'Report', action: 'Action Performed', object: 'Payment Lines Report', date: '05/08/2026 02:23 PM', message: 'Success, duration=24ms', diff: { key: '', old: '', new: '' } },
      { id: 6, patient: '', user: 'Babar Magsi', category: 'Report', subcategory: 'Report', action: 'Action Performed', object: 'Unsigned Progress Notes Report', date: '05/08/2026 02:23 PM', message: 'Success, duration=656ms, params=date=2026-4-8 & endDate=2026-5-8', diff: { key: '', old: '', new: '' } },
      { id: 7, patient: '', user: 'Babar Magsi', category: 'Report', subcategory: 'Report', action: 'Action Performed', object: 'Advanced Report', date: '05/08/2026 02:23 PM', message: 'Success, duration=281ms', diff: { key: '', old: '', new: '' } }
    ];
  }

  private async getReferralProductionReport(start: Date, end: Date) {
    // 1. Fetch patient preference metadata having referralSource
    const patientPrefs = await prisma.userodpref.findMany({
      where: {
        FkeyType: 206,
        ValueString: {
          contains: '"referralSource"',
        },
      },
      take: 5000
    });

    const patientReferrals = patientPrefs.map(pref => {
      try {
        const parsed = JSON.parse(pref.ValueString || '{}');
        return {
          patNum: pref.Fkey,
          referralSource: parsed.referralSource as string | undefined,
        };
      } catch {
        return { patNum: null, referralSource: undefined };
      }
    }).filter(p => p.patNum && p.referralSource);

    if (patientReferrals.length === 0) {
      return { summary: [], detail: {} };
    }

    const patNums = patientReferrals.map(p => p.patNum!);

    // 2. Fetch patient details (FName, LName)
    const patients = await prisma.patient.findMany({
      where: {
        PatNum: { in: patNums },
      },
      select: {
        PatNum: true,
        FName: true,
        LName: true,
      },
    });

    const patientMap = new Map(patients.map(p => [p.PatNum.toString(), p]));

    // 3. Fetch completed procedures (ProcStatus = 2) within range for these patients
    const procedures = await prisma.procedurelog.findMany({
      where: {
        PatNum: { in: patNums },
        ProcStatus: 2,
        ProcDate: {
          gte: start,
          lte: end,
        },
      },
      select: {
        PatNum: true,
        ProcFee: true,
      },
    });

    const patientProductionMap = new Map<string, number>();
    for (const proc of procedures) {
      if (proc.PatNum) {
        const patKey = proc.PatNum.toString();
        const currentSum = patientProductionMap.get(patKey) || 0;
        patientProductionMap.set(patKey, currentSum + (proc.ProcFee ?? 0));
      }
    }

    // 4. Group by referralSource
    const sourceSummary = new Map<string, { production: number; count: number }>();
    const sourceDetail = new Map<string, Array<{ id: number; name: string; production: number }>>();

    for (const ref of patientReferrals) {
      const patKey = ref.patNum!.toString();
      const pat = patientMap.get(patKey);
      if (!pat) continue;

      const production = patientProductionMap.get(patKey) || 0;
      const source = ref.referralSource || 'Unknown';

      // Update Summary
      const summary = sourceSummary.get(source) || { production: 0, count: 0 };
      summary.production += production;
      summary.count += 1;
      sourceSummary.set(source, summary);

      // Update Detail
      const list = sourceDetail.get(source) || [];
      list.push({
        id: Number(pat.PatNum),
        name: `${pat.FName || ''} ${pat.LName || ''}`.trim(),
        production: parseFloat(production.toFixed(2)),
      });
      sourceDetail.set(source, list);
    }

    const summaryData = Array.from(sourceSummary.entries()).map(([source, data]) => ({
      source,
      production: parseFloat(data.production.toFixed(2)),
      count: data.count,
    }));

    const detailData: Record<string, Array<{ id: number; name: string; production: number }>> = {};
    for (const [source, list] of sourceDetail.entries()) {
      detailData[source] = list;
    }

    return {
      summary: summaryData,
      detail: detailData,
    };
  }

  // ==========================================
  // DATE BOUNDARY RESOLUTION UTILITY
  // ==========================================

  private getRangeDates(dateStr?: string, range = 'Daily'): { startDate: Date; endDate: Date } {
    const baseDate = dateStr ? new Date(dateStr) : new Date();
    let startDate = new Date(baseDate);
    let endDate = new Date(baseDate);

    if (range === 'Daily') {
      startDate.setHours(0, 0, 0, 0);
      endDate.setHours(23, 59, 59, 999);
    } else if (range === 'Weekly') {
      const day = baseDate.getDay();
      startDate.setDate(baseDate.getDate() - day);
      startDate.setHours(0, 0, 0, 0);

      endDate.setDate(baseDate.getDate() + (6 - day));
      endDate.setHours(23, 59, 59, 999);
    } else if (range === 'Monthly') {
      startDate.setDate(1);
      startDate.setHours(0, 0, 0, 0);

      endDate.setMonth(baseDate.getMonth() + 1);
      endDate.setDate(0);
      endDate.setHours(23, 59, 59, 999);
    } else if (range === 'Yearly') {
      startDate.setMonth(0, 1);
      startDate.setHours(0, 0, 0, 0);

      endDate.setMonth(11, 31);
      endDate.setHours(23, 59, 59, 999);
    }

    return { startDate, endDate };
  }
}

export const reportGenerationService = new ReportGenerationService();
