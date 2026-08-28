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
        return this.getAdjustmentReport(startDate, endDate, query);

      case 'courtesy-credit':
      case 'courtesy-credit-modifications':
        return this.getCourtesyCreditReport(startDate, endDate, name === 'courtesy-credit-modifications', query);

      case 'credit-accounts':
        return this.getCreditAccountsReport(query);

      case 'modifications':
        return this.getModificationsReport(startDate, endDate, query);

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
    const { startDate, endDate } = this.getRangeDates(query.date, query.range || 'Daily', query.startDate, query.endDate);
    const name = String(reportName).toLowerCase();

    switch (name) {
      case 'recare':
        return this.getRecareReport(startDate, endDate);

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
    let { startDate, endDate } = this.getRangeDates(query.date, query.range || 'Daily');
    
    if (query.startDate) startDate = new Date(query.startDate);
    if (query.endDate) {
      endDate = new Date(query.endDate);
      endDate.setHours(23, 59, 59, 999);
    }
    const name = String(reportName).toLowerCase();

    switch (name) {
      case 'insurance-coverage':
        return this.getPatientInsuranceCoverage(query);

      case 'membership-plan':
        return this.getPatientMembershipPlan(query);

      case 'referral-by-patient':
        return this.getReferralByPatient(startDate, endDate);

      case 'online-scheduling-referral':
        return this.getOnlineSchedulingReferral(startDate, endDate);

      case 'by-flag':
        return this.getPatientByFlag(query.filterBy, query.includeFlags, query.excludeFlags);

      case 'cancelled-appointments':
      case 'no-show-appointments':
        return this.getCancelledOrNoShowAppointments(startDate, endDate, reportName === 'no-show-appointments', query.showInactive === 'true' || query.showInactive === true);

      case 'appointments':
        return this.getAppointmentsReport(startDate, endDate, query);

      case 'duplicate-patients':
        return this.getDuplicatePatients();

      case 'contact-preferences':
        return this.getPatientContactPreferences();

      case 'last-appointment':
      case 'next-appointment':
        return this.getPatientAppointmentMilestones(name === 'next-appointment', query);

      case 'referral-document':
        return this.getReferralDocuments(query);

      case 'lab-case':
        return this.getLabCaseReport(startDate, endDate, query);

      case 'discount-edited-fee':
        return this.getDiscountEditedFeeReport(startDate, endDate);

      case 'review':
        return this.getPatientReviewsReport(startDate, endDate, query);

      case 'notifications':
        return this.getPatientNotificationsReport(startDate, endDate, query);

      case 'procedures':
        return this.getPatientProceduresReport(startDate, endDate, query);

      case 'trackers':
        return this.getPatientTrackers(startDate, endDate, query);

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
    const { startDate, endDate } = this.getRangeDates(query.date, query.range || 'Daily', query.startDate, query.endDate);
    const name = String(reportName).toLowerCase();

    switch (name) {
      case 'login':
        return this.getLoginReport(startDate, endDate, query);

      case 'audit':
        return this.getAuditReport(startDate, endDate, query);

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

    // 1. query.patients (Patient Status)
    if (query.patients === 'active') {
      filters.push(`p."PatStatus" = 0`);
    } else if (query.patients === 'inactive') {
      filters.push(`p."PatStatus" != 0`);
    }

    // 2. query.provider
    if (query.provider && query.provider !== 'all') {
      const provNum = Number(query.provider);
      if (!isNaN(provNum)) {
        filters.push(`p."PriProv" = ${provNum}`);
      }
    }

    // 3. query.balance
    if (query.balance === 'min_total') {
      filters.push(`f."BalTotal" > 0`);
    } else if (query.balance === 'min_patient') {
      filters.push(`(f."BalTotal" - f."InsEst") > 0`);
    } else if (query.balance === 'min_insurance') {
      filters.push(`f."InsEst" > 0`);
    } else if (query.balance === 'over_30') {
      filters.push(`f."BalTotal" > 30`);
    } else if (query.balance === 'over_60') {
      filters.push(`f."BalTotal" > 60`);
    } else if (query.balance === 'over_90') {
      filters.push(`f."BalTotal" > 90`);
    } else {
      filters.push(`(f."BalTotal" != 0 OR f."InsEst" != 0)`);
    }

    // 4. query.claims (Open Claims)
    if (query.claims === 'with') {
      filters.push(`EXISTS (SELECT 1 FROM claim cl WHERE cl."PatNum" = p."PatNum" AND cl."ClaimStatus" IN ('U', 'S', 'W', 'H'))`);
    } else if (query.claims === 'without') {
      filters.push(`NOT EXISTS (SELECT 1 FROM claim cl WHERE cl."PatNum" = p."PatNum" AND cl."ClaimStatus" IN ('U', 'S', 'W', 'H'))`);
    }

    // 5. query.owing (Who Owes)
    if (query.owing === 'pt_individual' || query.owing === 'pt_only') {
      filters.push(`(f."BalTotal" - f."InsEst" > 0 AND f."InsEst" <= 0)`);
    } else if (query.owing === 'pt_insurance' || query.owing === 'insurance_only') {
      filters.push(`(f."InsEst" > 0)`);
    } else if (query.owing === 'pt_both') {
      filters.push(`(f."BalTotal" - f."InsEst" > 0 AND f."InsEst" > 0)`);
    } else if (query.owing === 'pt_payment_plan') {
      filters.push(`f."PayPlanDue" > 0`);
    }

    // 6. query.arRange (Aging Bucket)
    if (query.arRange && query.arRange !== 'any') {
      const normRange = String(query.arRange).toLowerCase().replace(/[\s\-_]/g, '');
      if (normRange === '<30' || normRange === '030' || normRange === '030days' || normRange === '30') {
        filters.push(`f."Bal_0_30" > 0`);
      } else if (normRange === '3160' || normRange === '3160days') {
        filters.push(`f."Bal_31_60" > 0`);
      } else if (normRange === '>60' || normRange === '>60days' || normRange === '60days') {
        filters.push(`(f."Bal_61_90" > 0 OR f."BalOver90" > 0)`);
      } else if (normRange === '6190' || normRange === '6190days') {
        filters.push(`f."Bal_61_90" > 0`);
      } else if (
        normRange === '>90' ||
        normRange === '>90days' ||
        normRange === 'over90' ||
        normRange === '90+' ||
        normRange === '90plus' ||
        normRange === '91120' ||
        normRange === '91120days' ||
        normRange === '121150' ||
        normRange === '121150days' ||
        normRange === '151180' ||
        normRange === '151180days' ||
        normRange === '>180' ||
        normRange === '>180day'
      ) {
        filters.push(`f."BalOver90" > 0`);
      } else if (normRange === 'custom') {
        if (query.startDate && query.endDate) {
          filters.push(`EXISTS (SELECT 1 FROM procedurelog pl WHERE pl."PatNum" = p."PatNum" AND pl."ProcDate" BETWEEN '${query.startDate}' AND '${query.endDate}')`);
        }
      }
    }

    // 7. query.flags (Patient with Flags)
    if (query.flags === 'with') {
      filters.push(`EXISTS (SELECT 1 FROM patfield pf WHERE pf."PatNum" = p."PatNum")`);
    } else if (query.flags === 'without') {
      filters.push(`NOT EXISTS (SELECT 1 FROM patfield pf WHERE pf."PatNum" = p."PatNum")`);
    }

    // 8. query.branch
    if (query.branch && query.branch !== 'all') {
      const branchId = Number(query.branch);
      if (!isNaN(branchId)) {
        filters.push(`p."ClinicNum" = ${branchId}`);
      }
    }

    // 9. query.carrier
    if (query.carrier && query.carrier !== 'all') {
      const carrierId = Number(query.carrier);
      if (!isNaN(carrierId)) {
        filters.push(`c."CarrierNum" = ${carrierId}`);
      } else {
        // Fallback to searching by CarrierName if a string like 'delta' was provided
        filters.push(`c."CarrierName" ILIKE '%${query.carrier}%'`);
      }
    }

    // 10. query.billingDate
    if (query.billingDate === 'pt_last_statement_before') {
      filters.push(`EXISTS (SELECT 1 FROM statement st WHERE st."PatNum" = p."PatNum" AND st."DateSent" IS NOT NULL)`);
    } else if (query.billingDate === 'day_since_last_statement') {
      filters.push(`EXISTS (SELECT 1 FROM statement st WHERE st."PatNum" = p."PatNum" AND st."DateSent" <= CURRENT_DATE - INTERVAL '30 days')`);
    }

    const whereClause = filters.length > 0 ? `WHERE ${filters.join(' AND ')}` : '';

    // 11. query.sortReport (Sorting)
    let orderByClause = 'ORDER BY f."BalTotal" DESC NULLS LAST';
    if (query.sortReport === 'low_to_high') {
      orderByClause = 'ORDER BY f."BalTotal" ASC NULLS LAST';
    } else if (query.sortReport === 'a_to_z' || query.sortReport === 'pt_first_name') {
      orderByClause = 'ORDER BY p."FName" ASC NULLS LAST, p."LName" ASC NULLS LAST';
    } else if (query.sortReport === 'pt_last_name') {
      orderByClause = 'ORDER BY p."LName" ASC NULLS LAST, p."FName" ASC NULLS LAST';
    } else if (query.sortReport === 'carrier') {
      orderByClause = 'ORDER BY c."CarrierName" ASC NULLS LAST';
    } else if (query.sortReport === 'last_billed') {
      orderByClause = 'ORDER BY "LastStatementDate" DESC NULLS LAST';
    } else if (query.sortReport === 'flag') {
      orderByClause = 'ORDER BY p."PatNum" DESC';
    }

    const sql = `
      SELECT 
        p."PatNum", p."FName", p."LName", p."PatStatus", p."PriProv",
        f."Bal_0_30", f."Bal_31_60", f."Bal_61_90", f."BalOver90", f."InsEst", f."BalTotal", f."PayPlanDue",
        c."CarrierName",
        (SELECT MAX(st."DateSent") FROM statement st WHERE st."PatNum" = p."PatNum") AS "LastStatementDate"
      FROM patient p
      LEFT JOIN famaging f ON p."PatNum" = f."PatNum"
      LEFT JOIN patplan pp ON p."PatNum" = pp."PatNum" AND pp."Ordinal" = 1
      LEFT JOIN inssub isub ON pp."InsSubNum" = isub."InsSubNum"
      LEFT JOIN insplan ipl ON isub."PlanNum" = ipl."PlanNum"
      LEFT JOIN carrier c ON ipl."CarrierNum" = c."CarrierNum"
      ${whereClause}
      ${orderByClause}
      LIMIT 200
    `;

    const rawPatients = await prisma.$queryRawUnsafe<any[]>(sql);

    const patNums = rawPatients.map((p) => BigInt(p.PatNum));
    const meta = await getPatientsMeta(patNums);

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

      const pNumStr = p.PatNum.toString();
      const patientFlags = meta[pNumStr]?.patientFlags || [];
      const lastBilledDate = p.LastStatementDate ? new Date(p.LastStatementDate).toLocaleDateString() : '';

      return {
        id: pNumStr,
        flags: patientFlags,
        name: `${p.FName || ''} ${p.LName || ''}`.trim() || 'Unknown Patient',
        insuranceName: p.CarrierName || null,
        buckets,
        total: balance,
        totalOwings: balance + (patientOnly ? 0 : insEst),
        paymentPlan: Number(p.PayPlanDue) || 0,
        credit: balance < 0 ? Math.abs(balance) : 0,
        lastBilled: lastBilledDate
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
      include: { 
        patient: true,
        provider_procedurelog_ProvNumToprovider: true,
        procedurecode_procedurelog_CodeNumToprocedurecode: true 
      }
    });

    const patNums = Array.from(new Set(procs.map(p => p.PatNum).filter(Boolean))) as bigint[];
    const metaMap = await getPatientsMeta(patNums);

    return procs.map(p => {
      const patNumStr = p.PatNum?.toString() || '';
      const meta = metaMap[patNumStr] || {};
      const flags = Array.isArray(meta.patientFlags) ? meta.patientFlags.filter(Boolean) : [];

      let dobStr = '-';
      if (p.patient?.Birthdate) {
        dobStr = new Date(p.patient.Birthdate).toLocaleDateString('en-US', { year: 'numeric', month: '2-digit', day: '2-digit' });
      }

      return {
        procedureId: p.ProcNum.toString(),
        date: p.ProcDate?.toISOString() || '',
        flags: flags,
        patient: p.patient ? `${p.patient.FName} ${p.patient.LName}` : 'Unknown Patient',
        dob: dobStr,
        code: p.procedurecode_procedurelog_CodeNumToprocedurecode?.ProcCode || p.OldCode || 'Unknown Code',
        procedure: p.procedurecode_procedurelog_CodeNumToprocedurecode?.Descript || 'Unknown Procedure',
        provider: p.provider_procedurelog_ProvNumToprovider?.Abbr || p.provider_procedurelog_ProvNumToprovider?.FName || 'Unknown Provider',
        fee: p.ProcFee || 0
      };
    });
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

  private async getAdjustmentReport(start: Date, end: Date, query: any = {}) {
    const where: any = {};

    if (query.filterByProductionDate || query.dateType === 'DateEntry') {
      where.DateEntry = { gte: start, lte: end };
    } else {
      where.AdjDate = { gte: start, lte: end };
    }

    if (query.provider && query.provider !== 'all') {
      const provNum = Number(query.provider);
      if (!isNaN(provNum)) {
        where.ProvNum = provNum;
      }
    }

    if (query.adjustmentType && query.adjustmentType !== 'all') {
      const typeNum = Number(query.adjustmentType);
      if (!isNaN(typeNum)) {
        where.AdjType = typeNum;
      }
    }

    const adjustments = await prisma.adjustment.findMany({
      where,
      include: {
        provider: true,
        patient: true,
        procedurelog: {
          include: {
            procedurecode_procedurelog_CodeNumToprocedurecode: true
          }
        }
      },
      take: 500,
      orderBy: { AdjDate: 'desc' }
    });

    const patNums = Array.from(new Set(adjustments.map(a => a.PatNum).filter(Boolean))) as bigint[];
    const metaMap = await getPatientsMeta(patNums);

    let results = adjustments.map(a => {
      const patNumStr = a.PatNum?.toString() || '';
      const meta = metaMap[patNumStr] || {};
      const flags = Array.isArray(meta.patientFlags) ? meta.patientFlags.filter(Boolean) : [];

      let dobStr = '';
      if (a.patient?.Birthdate) {
        dobStr = new Date(a.patient.Birthdate).toLocaleDateString('en-US', { year: 'numeric', month: '2-digit', day: '2-digit' });
      }

      const procCode = a.procedurelog?.OldCode || a.procedurelog?.procedurecode_procedurelog_CodeNumToprocedurecode?.ProcCode || '';

      return {
        id: a.AdjNum.toString(),
        date: a.AdjDate?.toLocaleDateString() || a.DateEntry?.toLocaleDateString() || '',
        amount: a.AdjAmt ?? 0,
        patient: a.patient ? `${a.patient.FName} ${a.patient.LName}` : 'Patient',
        patientId: patNumStr,
        dob: dobStr,
        flags: flags,
        provider: a.provider ? (a.provider.Abbr || `${a.provider.FName} ${a.provider.LName}`) : 'Provider',
        providerId: a.provider?.ProvNum?.toString() || '',
        typeId: a.AdjType?.toString() || '',
        code: procCode,
        procedure: a.procedurelog?.procedurecode_procedurelog_CodeNumToprocedurecode?.Descript || procCode || 'Adjustment',
        notes: a.AdjNote ?? ''
      };
    });

    if (query.searchText || query.codeText) {
      const term = (query.searchText || query.codeText).toLowerCase();
      results = results.filter(r =>
        r.patient.toLowerCase().includes(term) ||
        r.provider.toLowerCase().includes(term) ||
        r.code.toLowerCase().includes(term) ||
        r.notes.toLowerCase().includes(term)
      );
    }

    return results;
  }

  private async getCourtesyCreditModifications(start: Date, end: Date, query: any = {}) {
    const courtesyDefs = await prisma.definition.findMany({
      where: {
        Category: 1, // AdjTypes
        ItemName: { contains: 'Courtesy', mode: 'insensitive' }
      }
    });
    const courtesyDefNums = courtesyDefs.map(d => d.DefNum);

    if (courtesyDefNums.length === 0) return [];

    const adjWhere: any = { AdjType: { in: courtesyDefNums } };
    if (query.startDate && query.endDate) {
      const sDate = new Date(query.startDate);
      const eDate = new Date(query.endDate);
      adjWhere.AdjDate = { gte: sDate, lte: eDate };
    } else {
      adjWhere.AdjDate = { gte: start, lte: end };
    }

    const adjustments = await prisma.adjustment.findMany({
      where: adjWhere
    });
    const adjNums = adjustments.map(a => a.AdjNum);

    const logWhere: any = {
      PermType: { in: [105, 106, 107] }
    };

    if (adjNums.length > 0) {
      logWhere.FKey = { in: adjNums };
    }

    if (query.startDate && query.endDate) {
      logWhere.LogDateTime = { gte: new Date(query.startDate), lte: new Date(query.endDate) };
    } else {
      logWhere.LogDateTime = { gte: start, lte: end };
    }

    if (query.users && query.users !== 'all') {
      const userNum = Number(query.users);
      if (!isNaN(userNum)) {
        logWhere.UserNum = userNum;
      }
    }

    const logs = await prisma.securitylog.findMany({
      where: logWhere,
      include: {
        userod: true,
        patient: true
      },
      orderBy: { LogDateTime: 'desc' },
      take: 300
    });

    let results = logs.map(log => ({
      id: log.SecurityLogNum.toString(),
      dateModified: log.LogDateTime?.toLocaleDateString() || '',
      timestamp: log.LogDateTime?.toISOString() || '',
      user: log.userod ? (log.userod.UserName || 'System') : 'System',
      action: log.LogText || 'Modified Courtesy Credit',
      type: 'Adjustment',
      patient: log.patient ? `${log.patient.FName} ${log.patient.LName}` : 'Unknown',
      amount: 0
    }));

    if (query.action && query.action !== 'all') {
      const actTerm = query.action.toLowerCase();
      results = results.filter(r => r.action.toLowerCase().includes(actTerm));
    }

    if (query.searchText) {
      const sTerm = query.searchText.toLowerCase();
      results = results.filter(r =>
        r.patient.toLowerCase().includes(sTerm) ||
        r.user.toLowerCase().includes(sTerm) ||
        r.action.toLowerCase().includes(sTerm)
      );
    }

    return results;
  }

  private async getCourtesyCreditReport(start: Date, end: Date, modifications = false, query: any = {}) {
    if (modifications) {
      return this.getCourtesyCreditModifications(start, end, query);
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
      orderBy: { AdjDate: 'desc' },
      take: 300
    });

    const patNums = Array.from(new Set(adjustments.map(a => a.PatNum).filter(Boolean))) as bigint[];
    const metaMap = await getPatientsMeta(patNums);

    let results = adjustments.map(a => {
      const patNumStr = a.patient?.PatNum?.toString() || '0';
      const meta = metaMap[patNumStr] || {};
      const flags = Array.isArray(meta.patientFlags) ? meta.patientFlags.filter(Boolean) : [];

      return {
        flags: flags,
        id: patNumStr,
        name: a.patient ? `${a.patient.FName} ${a.patient.LName}` : 'Unknown Patient',
        amount: Math.abs(a.AdjAmt ?? 0),
        creditAmount: Math.abs(a.AdjAmt ?? 0),
        date: a.AdjDate?.toLocaleDateString() || '',
        notes: a.AdjNote || ''
      };
    });

    if (query.searchText) {
      const term = query.searchText.toLowerCase();
      results = results.filter(r => r.name.toLowerCase().includes(term) || r.notes.toLowerCase().includes(term));
    }

    return results;
  }

  private async getCreditAccountsReport(query: any = {}) {
    const where: any = { BalTotal: { lt: 0 } };

    if (query.includeInactive === false || query.includeInactive === 'false') {
      where.PatStatus = 0;
    } else if (query.filter === 'Active patients') {
      where.PatStatus = 0;
    } else if (query.filter === 'Inactive patients') {
      where.PatStatus = { not: 0 };
    }

    const patients = await prisma.patient.findMany({
      where,
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
      take: 300
    });

    const patNums = patients.map(p => p.PatNum);
    const metaMap = await getPatientsMeta(patNums);

    return patients.map(p => {
      const patNumStr = p.PatNum.toString();
      const meta = metaMap[patNumStr] || {};
      const flags = Array.isArray(meta.patientFlags) ? meta.patientFlags.filter(Boolean) : [];

      return {
        patientId: patNumStr,
        flags: flags,
        name: `${p.FName} ${p.LName}`,
        dob: p.Birthdate?.toLocaleDateString() || '',
        email: p.Email || '',
        phone: p.WirelessPhone || p.HmPhone || '',
        amount: Math.abs(p.BalTotal ?? 0),
        credit: Math.abs(p.BalTotal ?? 0),
        insCredit: Math.abs(p.InsEst && p.InsEst < 0 ? p.InsEst : 0)
      };
    });
  }

  private async getModificationsReport(start: Date, end: Date, query: any = {}) {
    const where: any = {
      LogDateTime: { gte: start, lte: end }
    };

    if (query.category === 'appointments') {
      where.PermType = { in: [25, 26, 27, 49] };
    } else if (query.category === 'fees') {
      where.PermType = { in: [63, 84] };
    } else if (query.category === 'claims') {
      where.PermType = { in: [47, 48] };
    } else if (query.category === 'patient') {
      where.PermType = { in: [1, 2] };
    }

    const logs = await prisma.securitylog.findMany({
      where,
      include: {
        userod: true,
        patient: true
      },
      orderBy: { LogDateTime: 'desc' },
      take: 300
    });

    if (logs.length === 0) {
      return [];
    }

    return logs.map(log => {
      const modifiedBy = log.userod ? (log.userod.UserName || 'System') : 'System';
      const patientName = log.patient ? `${log.patient.FName} ${log.patient.LName}` : 'N/A';
      
      return {
        id: log.SecurityLogNum.toString(),
        timestamp: log.LogDateTime?.toISOString() || new Date().toISOString(),
        modifiedBy,
        field: log.PermType ? `Permission Event #${log.PermType}` : 'General Edit',
        originalValue: '-',
        newValue: log.LogText || 'System Audit Record',
        patient: patientName,
        action: log.LogText || 'Modified system entity'
      };
    });
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
      return [];
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

  private async getRecareReport(startDate?: Date, endDate?: Date) {
    const where: any = { IsDisabled: 0 };
    if (startDate && endDate) {
      where.DateDue = { gte: startDate, lte: endDate };
    } else if (startDate) {
      where.DateDue = { gte: startDate };
    } else if (endDate) {
      where.DateDue = { lte: endDate };
    }

    const recalls = await prisma.recall.findMany({
      where,
      include: { patient: true },
      take: 500
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
        contactCount: 0,
        dentistId: p?.PriProv ? p.PriProv.toString() : '',
        hygienistId: p?.SecProv ? p.SecProv.toString() : ''
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
      return [];
    }

    return report;
  }

  // ==========================================
  // PATIENT REPORTS QUERY HELPERS
  // ==========================================

  private async getPatientInsuranceCoverage(query: any = {}) {
    const { searchQuery, assignmentFilter, apptStartDate, apptEndDate, apptSingleDate, showNoCoverage, apptFilterType } = query;

    let whereClause: any = {};
    whereClause.AND = [];

    if (showNoCoverage === 'true' || showNoCoverage === true) {
      whereClause.inssub = { is: null };
    } else if (showNoCoverage === 'false' || showNoCoverage === false) {
      whereClause.inssub = { isNot: null };
    }

    if (searchQuery) {
      let searchOr: any[] = [
        { patient: { is: { FName: { contains: searchQuery } } } },
        { patient: { is: { LName: { contains: searchQuery } } } },
        { inssub: { is: { insplan: { is: { GroupName: { contains: searchQuery } } } } } },
        { inssub: { is: { insplan: { is: { carrier: { is: { CarrierName: { contains: searchQuery } } } } } } } }
      ];
      if (!isNaN(Number(searchQuery))) {
        searchOr.push({ PatNum: BigInt(searchQuery) });
      }
      whereClause.AND.push({ OR: searchOr });
    }

    if (assignmentFilter === 'assignment') {
      whereClause.inssub = { ...whereClause.inssub, is: { ...whereClause.inssub?.is, AssignBen: 1 } };
    } else if (assignmentFilter === 'non-assignment') {
      whereClause.AND.push({
        OR: [
          { inssub: { is: null } },
          { inssub: { is: { AssignBen: { not: 1 } } } },
          { inssub: { is: { AssignBen: null } } }
        ]
      });
    }

    if (whereClause.AND.length === 0) {
      delete whereClause.AND;
    }

    let apptWhere: any = { AptStatus: { in: [1, 2] } };
    let hasApptFilter = false;

    if (apptFilterType === 'range') {
      hasApptFilter = true;
      apptWhere.AptDateTime = {};
      if (apptStartDate) apptWhere.AptDateTime.gte = new Date(apptStartDate);
      if (apptEndDate) {
        const end = new Date(apptEndDate);
        end.setHours(23, 59, 59, 999);
        apptWhere.AptDateTime.lte = end;
      }
    } else if (apptFilterType === 'before' && apptSingleDate) {
      hasApptFilter = true;
      apptWhere.AptDateTime = { lt: new Date(apptSingleDate) };
    } else if (apptFilterType === 'after' && apptSingleDate) {
      hasApptFilter = true;
      apptWhere.AptDateTime = { gt: new Date(apptSingleDate) };
    }

    if (hasApptFilter) {
      whereClause.patient = {
        ...whereClause.patient,
        is: {
          ...whereClause.patient?.is,
          appointment: { some: apptWhere }
        }
      };
    }

    const plans = await prisma.patplan.findMany({
      where: whereClause,
      include: {
        patient: {
          include: {
            appointment: {
              where: { AptStatus: { in: [1, 2] } },
              orderBy: { AptDateTime: 'desc' },
              take: 1
            }
          }
        },
        inssub: {
          include: {
            insplan: {
              include: {
                carrier: true,
                feesched_insplan_FeeSchedTofeesched: true
              }
            }
          }
        }
      }
    });

    const report = plans.map(p => {
      const patientName = p.patient ? `${p.patient.FName} ${p.patient.LName}` : 'Patient';
      const email = p.patient?.Email || '';
      const planNameVal = p.inssub?.insplan?.GroupName
        ? `${p.inssub.insplan.GroupName} (${p.inssub.insplan.PlanNum?.toString() || ''})`
        : p.inssub?.insplan?.GroupNum
          ? `${p.inssub.insplan.GroupNum} (${p.inssub.insplan.PlanNum?.toString() || ''})`
          : 'Standard Insurance';
      const payer = p.inssub?.insplan?.carrier?.CarrierName || 'Standard Insurance';
      const patientNum = p.PatNum ? p.PatNum.toString() : '';
      const lastAppt = (p.patient as any)?.appointment?.[0]?.AptDateTime;
      const feeSchedDesc = p.inssub?.insplan?.feesched_insplan_FeeSchedTofeesched?.Description || '';
      const isAssignment = p.inssub?.AssignBen === 1;

      return {
        number: patientNum,
        patient: patientName,
        email,
        planName: planNameVal,
        payer,
        lastAppointment: lastAppt ? new Date(lastAppt).toLocaleDateString() : '',
        feeSchedule: feeSchedDesc,
        planRenewalDate: 'January',
        assignmentStatus: isAssignment ? 'Assignment' : 'Non-Assignment'
      };
    });

    return report;
  }

  private async getPatientMembershipPlan(query: any = {}) {
    const { searchQuery, renewalMonth, apptFilterType, apptStartDate, apptEndDate, apptSingleDate, showNoPlan } = query;
    const months = ['January','February','March','April','May','June',
                    'July','August','September','October','November','December'];

    let whereClause: any = { IsClosed: 0 };
    whereClause.AND = [];

    if (showNoPlan === 'true' || showNoPlan === true) {
      whereClause.AND.push({
        OR: [
          { PlanCategory: null },
          { PlanCategory: 0 }
        ]
      });
    } else if (showNoPlan === 'false' || showNoPlan === false) {
      whereClause.AND.push({ PlanCategory: { not: null } });
      whereClause.AND.push({ PlanCategory: { not: 0 } });
    }

    if (searchQuery) {
      let searchOr: any[] = [
        { patient_payplan_PatNumTopatient: { is: { FName: { contains: searchQuery } } } },
        { patient_payplan_PatNumTopatient: { is: { LName: { contains: searchQuery } } } },
        { definition: { is: { ItemName: { contains: searchQuery } } } }
      ];
      if (!isNaN(Number(searchQuery))) {
        searchOr.push({ PatNum: BigInt(searchQuery) });
      }
      whereClause.AND.push({ OR: searchOr });
    }

    let apptWhere: any = { AptStatus: { in: [1, 2] } };
    let hasApptFilter = false;

    if (apptFilterType === 'range') {
      hasApptFilter = true;
      apptWhere.AptDateTime = {};
      if (apptStartDate) apptWhere.AptDateTime.gte = new Date(apptStartDate);
      if (apptEndDate) {
        const end = new Date(apptEndDate);
        end.setHours(23, 59, 59, 999);
        apptWhere.AptDateTime.lte = end;
      }
    } else if (apptFilterType === 'before' && apptSingleDate) {
      hasApptFilter = true;
      apptWhere.AptDateTime = { lt: new Date(apptSingleDate) };
    } else if (apptFilterType === 'after' && apptSingleDate) {
      hasApptFilter = true;
      apptWhere.AptDateTime = { gt: new Date(apptSingleDate) };
    }

    if (hasApptFilter) {
      whereClause.patient_payplan_PatNumTopatient = {
        is: {
          ...whereClause.patient_payplan_PatNumTopatient?.is,
          appointment: { some: apptWhere }
        }
      };
    }

    if (whereClause.AND.length === 0) {
      delete whereClause.AND;
    }

    const plans = await prisma.payplan.findMany({
      where: whereClause,
      include: {
        patient_payplan_PatNumTopatient: {
          include: {
            appointment: { orderBy: { AptDateTime: 'desc' as const }, take: 1 }
          }
        },
        definition: true
      }
    });

    if (plans.length === 0) {
      return [];
    }

    let report = plans.map(p => {
      const pat = p.patient_payplan_PatNumTopatient;
      const lastAppt = pat?.appointment?.[0]?.AptDateTime;
      const renewalDate = p.PayPlanDate as Date | null;
      return {
        number: pat?.PatNum?.toString() || '',
        patient: pat ? `${pat.FName} ${pat.LName}` : 'Patient',
        email: pat?.Email || '',
        planName: p.definition?.ItemName || 'Membership Plan',
        lastAppointment: lastAppt ? new Date(lastAppt).toLocaleDateString() : '',
        renewalMonth: renewalDate ? months[new Date(renewalDate).getMonth()] : ''
      };
    });

    if (renewalMonth) {
      report = report.filter(r => r.renewalMonth === renewalMonth);
    }

    return report;
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
      }
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
    const refAttaches = await prisma.refattach.findMany({
      where: { RefDate: { gte: start, lte: end } },
      include: { referral: true }
    });

    const groups = new Map<string, number>();
    for (const r of refAttaches) {
      const source = r.referral?.BusinessName ||
        `${r.referral?.FName || ''} ${r.referral?.LName || ''}`.trim() || 'Unknown';
      groups.set(source, (groups.get(source) || 0) + 1);
    }

    if (groups.size === 0) {
      return [];
    }

    return Array.from(groups.entries()).map(([source, count]) => ({
      referral: source,
      utmSource: '',
      utmMedium: '',
      utmCampaign: '',
      clicks: count
    }));
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

  private async getCancelledOrNoShowAppointments(start: Date, end: Date, isNoShow = false, showInactive = false) {
    const whereClause: any = {
      AptDateTime: { gte: start, lte: end },
      AptStatus: isNoShow ? 3 : 4
    };

    if (!showInactive) {
      whereClause.patient = { PatStatus: 0 };
    }

    const appointments = await prisma.appointment.findMany({
      where: whereClause,
      include: {
        patient: true,
        provider_appointment_ProvNumToprovider: true,
        procedurelog_procedurelog_AptNumToappointment: {
          where: { ProcStatus: { in: [1, 2] } },
          include: { procedurecode_procedurelog_CodeNumToprocedurecode: true }
        }
      }
    });

    // Get next appointments for these patients
    const patNums = [...new Set(appointments.map(a => a.PatNum).filter(Boolean))] as bigint[];
    const nextAppts = patNums.length > 0 ? await prisma.appointment.findMany({
      where: {
        PatNum: { in: patNums },
        AptDateTime: { gt: new Date() },
        AptStatus: { in: [1, 2] }
      },
      orderBy: { AptDateTime: 'asc' }
    }) : [];
    const nextApptMap = new Map<string, string>();
    for (const na of nextAppts) {
      const key = na.PatNum?.toString() || '';
      if (!nextApptMap.has(key)) {
        nextApptMap.set(key, na.AptDateTime?.toLocaleDateString() || '');
      }
    }

    const days = ['Sun', 'Mon', 'Tues', 'Wed', 'Thurs', 'Fri', 'Sat'];

    return appointments.map(a => {
      const apptDate = a.AptDateTime ? new Date(a.AptDateTime) : null;
      const aAny = a as any;
      const procedures = (aAny.procedurelog_procedurelog_AptNumToappointment || [])
        .map((p: any) => p.procedurecode_procedurelog_CodeNumToprocedurecode?.ProcCode || p.OldCode || '')
        .filter(Boolean).join(', ');
      const provAbbr = a.provider_appointment_ProvNumToprovider?.Abbr ||
        a.provider_appointment_ProvNumToprovider?.FName?.substring(0, 3) || '';
      const patKey = a.PatNum?.toString() || '';

      return {
        patient: a.patient ? `${a.patient.FName} ${a.patient.LName}` : 'Patient',
        type: a.IsNewPatient ? 'New Patient' : 'Recare',
        providers: provAbbr,
        duration: `${a.Pattern?.length ? a.Pattern.length * 5 : 60} mins`,
        prefDay: apptDate ? days[apptDate.getDay()] : '',
        prefTime: apptDate ? apptDate.toLocaleTimeString('en-US',
          { hour: '2-digit', minute: '2-digit', hour12: true }) : '',
        procedures,
        aptDate: apptDate ? apptDate.toLocaleDateString('en-US',
          { month: 'short', day: '2-digit', year: 'numeric' }) : '',
        nextAptDate: nextApptMap.get(patKey) || '',
        reason: a.Note ?? ''
      };
    });
  }

  private async getAppointmentsReport(start: Date, end: Date, query?: any) {
    const where: any = {};
    if (query?.dateType === 'created') {
      where.SecDateTEntry = { gte: start, lte: end };
    } else {
      where.AptDateTime = { gte: start, lte: end };
    }

    if (query?.provider && query.provider !== 'all') {
      const provNum = Number(query.provider);
      if (!isNaN(provNum)) where.ProvNum = provNum;
    }
    if (query?.status && query.status !== 'all') {
      const statusMap: Record<string, number> = {
        scheduled: 1, complete: 2, broken: 3, cancelled: 4
      };
      if (statusMap[query.status]) where.AptStatus = statusMap[query.status];
    }
    if (query?.locationType === 'online') {
      // Mock filter for online location (e.g. specific clinic num if applicable)
      where.ClinicNum = { gt: 0 }; 
    }
    if (query?.includeShortlisted === 'true' || query?.includeShortlisted === true) {
      where.UnschedStatus = { not: null };
    }

    const appointments = await prisma.appointment.findMany({
      where,
      include: {
        patient: true,
        provider_appointment_ProvNumToprovider: true,
        procedurelog_procedurelog_AptNumToappointment: {
          where: { ProcStatus: { in: [1, 2] } },
          include: { procedurecode_procedurelog_CodeNumToprocedurecode: true }
        }
      },
      take: 100
    });

    const patNums = [...new Set(appointments.map(a => a.PatNum).filter(Boolean))] as bigint[];
    const meta = await getPatientsMeta(patNums);

    // Next appointments
    const nextAppts = patNums.length > 0 ? await prisma.appointment.findMany({
      where: {
        PatNum: { in: patNums },
        AptDateTime: { gt: end },
        AptStatus: { in: [1, 2] }
      },
      orderBy: { AptDateTime: 'asc' }
    }) : [];
    const nextApptMap = new Map<string, string>();
    for (const na of nextAppts) {
      const key = na.PatNum?.toString() || '';
      if (!nextApptMap.has(key)) {
        nextApptMap.set(key, na.AptDateTime?.toLocaleDateString('en-US',
          { month: 'short', day: '2-digit', year: 'numeric' }) || '');
      }
    }

    const statusLabels: Record<number, string> = {
      1: 'Scheduled', 2: 'Checked out complete', 3: 'Broken/No Show',
      4: 'Cancelled', 5: 'Cancelled Short Notice', 6: 'Unconfirmed'
    };

    let mappedAppointments = appointments.map(a => {
      const apptDate = a.AptDateTime ? new Date(a.AptDateTime) : null;
      const patKey = a.PatNum?.toString() || '';
      const flags = (meta as any)[patKey]?.patientFlags || [];
      const aAny = a as any;
      const procedures = (aAny.procedurelog_procedurelog_AptNumToappointment || [])
        .map((p: any) => p.procedurecode_procedurelog_CodeNumToprocedurecode?.Descript || p.OldCode || '')
        .filter(Boolean).join(' / ');
      const dayNames = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

      return {
        patient: a.patient ? `${a.patient.FName} ${a.patient.LName}` : 'Patient',
        flags,
        type: a.IsNewPatient ? 'New Patient' : 'Recare',
        status: statusLabels[a.AptStatus ?? 1] || 'Unknown',
        providers: a.provider_appointment_ProvNumToprovider?.Abbr || '',
        operatory: `Operatory ${a.Op || ''}`,
        aptDate: apptDate?.toLocaleDateString('en-US',
          { month: 'short', day: '2-digit', year: 'numeric' }) || '',
        time: apptDate ? `${dayNames[apptDate.getDay()]}, ${apptDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}` : '',
        duration: `${a.Pattern?.length ? a.Pattern.length * 5 : 60} mins`,
        procedures,
        nextAptDate: nextApptMap.get(patKey) || ''
      };
    });

    if (query?.flagFilter === 'withFlags') {
      mappedAppointments = mappedAppointments.filter(a => a.flags.length > 0);
    } else if (query?.flagFilter === 'withoutFlags') {
      mappedAppointments = mappedAppointments.filter(a => a.flags.length === 0);
    }

    return mappedAppointments;
  }

  private async getDuplicatePatients() {
    const duplicates = await prisma.$queryRawUnsafe<any[]>(`
      SELECT p."PatNum", p."FName", p."LName", p."Birthdate", p."PatStatus",
        CASE WHEN p."PatNum" = p."Guarantor" THEN 'True' ELSE 'False' END AS "IsSubscriber"
      FROM patient p
      INNER JOIN (
        SELECT "FName", "LName", "Birthdate"
        FROM patient
        WHERE "Birthdate" IS NOT NULL AND "Birthdate" > '1900-01-01'
        GROUP BY "FName", "LName", "Birthdate"
        HAVING COUNT(*) > 1
      ) dups ON p."FName" = dups."FName"
           AND p."LName" = dups."LName"
           AND p."Birthdate" = dups."Birthdate"
      ORDER BY p."LName", p."FName", p."Birthdate"
      LIMIT 200
    `);

    const statusMap: Record<number, string> = { 0: 'Active', 1: 'Archived', 2: 'Inactive', 3: 'Deceased' };

    if (duplicates.length === 0) {
      return [];
    }

    return duplicates.map((p: any) => ({
      id: p.PatNum?.toString() || '',
      firstName: p.FName || '',
      lastName: p.LName || '',
      dob: p.Birthdate ? new Date(p.Birthdate).toLocaleDateString('en-US',
        { month: 'short', day: '2-digit', year: 'numeric' }) : '',
      status: statusMap[p.PatStatus] || 'Active',
      subscriber: p.IsSubscriber || 'False'
    }));
  }

  private async getPatientContactPreferences() {
    const patients = await prisma.patient.findMany({
      where: { PatStatus: 0 },
      select: {
        PatNum: true, FName: true, LName: true, Email: true,
        WirelessPhone: true, HmPhone: true, WkPhone: true,
        TxtMsgOk: true, PreferContactMethod: true
      },
      take: 500
    });

    return patients.map(p => ({
      firstName: p.FName || '',
      lastName: p.LName || '',
      email: p.Email || '',
      phone: p.WirelessPhone || p.HmPhone || p.WkPhone || '',
      text: p.TxtMsgOk === 1 ? 'Yes' : 'No',
      emailPerm: p.Email ? 'Yes' : 'No',
      review: 'Yes'
    }));
  }

  private async getPatientAppointmentMilestones(nextAppt = false, query?: any) {
    const where: any = { PatStatus: 0 };
    if (query?.filterBy === 'inactive') where.PatStatus = 2;
    else if (query?.filterBy === 'all') delete where.PatStatus;

    const patients = await prisma.patient.findMany({
      where,
      include: {
        appointment: {
          where: nextAppt
            ? { AptDateTime: { gte: new Date() }, AptStatus: { in: [1, 6] } }
            : { AptDateTime: { lte: new Date() }, AptStatus: { in: [1, 2, 3, 4, 5] } },
          orderBy: { AptDateTime: nextAppt ? 'asc' : 'desc' },
          take: 1,
          include: { provider_appointment_ProvNumToprovider: true }
        }
      },
      take: 200
    });

    const filtered = patients.filter(p => p.appointment.length > 0);

    let results = filtered;
    if (query?.startDate || query?.endDate || (query?.provider && query.provider !== 'all') || (query?.appointmentStatus && query.appointmentStatus !== 'all')) {
      const startFilter = query.startDate ? new Date(query.startDate) : null;
      const endFilter = query.endDate ? new Date(query.endDate) : null;
      results = filtered.filter(p => {
        const appt = p.appointment[0];
        if (!appt) return false;
        
        const d = appt.AptDateTime;
        if (d) {
          if (startFilter && d < startFilter) return false;
          if (endFilter && d > endFilter) return false;
        }

        if (query?.provider && query.provider !== 'all') {
          if (appt.ProvNum !== BigInt(query.provider)) return false;
        }

        if (query?.appointmentStatus && query.appointmentStatus !== 'all') {
          if (appt.AptStatus !== Number(query.appointmentStatus)) return false;
        }

        return true;
      });
    }

    // Get next appointments for "Last Appointment" report
    let nextApptMap = new Map<string, string>();
    if (!nextAppt) {
      const patNums = results.map(p => p.PatNum);
      if (patNums.length > 0) {
        const nextAppts = await prisma.appointment.findMany({
          where: {
            PatNum: { in: patNums },
            AptDateTime: { gt: new Date() },
            AptStatus: { in: [1, 6] }
          },
          orderBy: { AptDateTime: 'asc' }
        });
        for (const na of nextAppts) {
          const key = na.PatNum?.toString() || '';
          if (!nextApptMap.has(key)) {
            nextApptMap.set(key, na.AptDateTime?.toLocaleDateString('en-US',
              { month: 'short', day: '2-digit', year: 'numeric' }) || '');
          }
        }
      }
    }

    const statusLabels: Record<number, string> = {
      1: 'Scheduled', 2: 'CheckedoutCompleted', 3: 'Broken',
      4: 'Cancelled', 5: 'CancelledShortNotice', 6: 'Unconfirmed'
    };

    const meta = await getPatientsMeta(results.map(p => p.PatNum));

    let mappedResults = results.map(p => {
      const appt = p.appointment[0];
      const prov = appt?.provider_appointment_ProvNumToprovider;
      const patKey = p.PatNum.toString();
      const flags = (meta as any)[patKey]?.patientFlags || [];

      return {
        id: patKey,
        patient: `${p.FName} ${p.LName}`,
        flags,
        status: p.PatStatus === 0 ? 'Active' : 'Inactive',
        apptDate: appt?.AptDateTime?.toLocaleDateString('en-US',
          { month: 'short', day: '2-digit', year: 'numeric' }) || '',
        type: appt?.IsNewPatient ? 'New Patient' : 'Recare',
        apptStatus: statusLabels[appt?.AptStatus ?? 1] || 'Unknown',
        nextAppt: nextApptMap.get(patKey) || '',
        newPatient: appt?.IsNewPatient ? 'Yes' : 'No',
        provider: prov ? `${prov.FName} ${prov.LName}` : '',
        email: p.Email || '',
        phone: p.WirelessPhone || p.HmPhone || '',
        text: p.TxtMsgOk === 1 ? 'Yes' : 'No',
        emailPerm: p.Email ? 'Yes' : 'No',
        review: 'No'
      };
    });

    if (query?.flagsFilter === 'withFlags') {
      mappedResults = mappedResults.filter(r => r.flags.length > 0);
    } else if (query?.flagsFilter === 'withoutFlags') {
      mappedResults = mappedResults.filter(r => r.flags.length === 0);
    }

    return mappedResults;
  }

  private async getReferralDocuments(query?: any) {
    const refAttaches = await prisma.refattach.findMany({
      include: {
        patient: true,
        referral: true
      },
      orderBy: { ItemOrder: 'desc' },
      take: 100
    });

    if (refAttaches.length === 0) {
      return [];
    }

    return refAttaches.map(r => ({
      patient: r.patient ? `${r.patient.FName} ${r.patient.LName}` : 'Patient',
      provider: r.referral
        ? (r.referral.NotPerson
          ? r.referral.BusinessName
          : `Dr. ${r.referral.LName}`)
        : '',
      created: r.RefDate?.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' }) || '',
      due: '',
      shared: r.DateProcComplete?.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' }) || '',
      status: r.IsTransitionOfCare ? 'Sent Out' : 'New'
    }));
  }

  private async getLabCaseReport(start: Date, end: Date, query?: any) {
    const where: any = {};

    if (query?.dateFilterType === 'Lab Due Date') {
      where.DateTimeDue = { gte: start, lte: end };
    } else if (query?.dateFilterType === 'Shared Date') {
      where.DateTimeSent = { gte: start, lte: end };
    } else if (query?.dateFilterType === 'Appointment Date') {
      where.appointment_labcase_AptNumToappointment = {
        AptDateTime: { gte: start, lte: end }
      };
    } else {
      where.DateTimeCreated = { gte: start, lte: end };
    }

    if (query?.status === 'qc') {
      where.DateTimeRecd = { not: null };
    } else if (query?.status === 'sent') {
      where.DateTimeSent = { not: null };
      where.DateTimeRecd = null;
    } else if (query?.status === 'pending') {
      where.DateTimeSent = null;
      where.DateTimeRecd = null;
    }

    if (query?.includeInactive !== 'true' && query?.includeInactive !== true) {
      where.patient = { PatStatus: 0 };
    }

    const cases = await prisma.labcase.findMany({
      where,
      include: {
        patient: true,
        laboratory: true,
        appointment_labcase_AptNumToappointment: {
          include: {
            procedurelog_procedurelog_AptNumToappointment: {
              include: { procedurecode_procedurelog_CodeNumToprocedurecode: true }
            }
          }
        }
      },
      take: 100
    });

    if (cases.length === 0) {
      return [];
    }

    return cases.map(c => {
      const cAny = c as any;
      const appt = cAny.appointment_labcase_AptNumToappointment;
      const procedures = appt?.procedurelog_procedurelog_AptNumToappointment
        ?.map((p: any) => `${p.procedurecode_procedurelog_CodeNumToprocedurecode?.ProcCode || ''} ${p.procedurecode_procedurelog_CodeNumToprocedurecode?.Descript || ''}`)
        .filter(Boolean).join(', ') || '';

      return {
        patient: c.patient ? `${c.patient.FName} ${c.patient.LName}` : 'Patient',
        provider: c.laboratory?.Description || '',
        procedures: procedures ? `- ${procedures}` : '',
        dueDate: c.DateTimeDue?.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' }) || '',
        apptDate: appt?.AptDateTime?.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' }) || '',
        sharedDate: c.DateTimeSent?.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' }) || '',
        status: c.DateTimeRecd ? 'Quality Checked' : c.DateTimeSent ? 'Sent' : 'Pending'
      };
    });
  }

  private async getDiscountEditedFeeReport(start: Date, end: Date) {
    const adjustments = await prisma.adjustment.findMany({
      where: { AdjDate: { gte: start, lte: end } },
      include: {
        patient: true,
        provider: true,
        procedurelog: {
          include: { procedurecode_procedurelog_CodeNumToprocedurecode: true }
        }
      },
      take: 200
    });

    const linked = adjustments.filter(a => a.procedurelog);

    if (linked.length === 0) {
      return [];
    }

    return linked.map(a => {
      const originalFee = a.procedurelog?.ProcFee ?? 0;
      const adjAmt = Math.abs(a.AdjAmt ?? 0);
      const editedFee = originalFee - adjAmt;

      return {
        patient: a.patient ? `${a.patient.FName} ${a.patient.LName}` : 'Patient',
        date: a.AdjDate?.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' }) || '',
        code: a.procedurelog?.procedurecode_procedurelog_CodeNumToprocedurecode?.ProcCode || a.procedurelog?.OldCode || '',
        description: a.procedurelog?.procedurecode_procedurelog_CodeNumToprocedurecode?.Descript || '',
        fee: `$${originalFee.toFixed(2)}`,
        editedFee: `$${editedFee.toFixed(2)}`,
        discount: `$${adjAmt.toFixed(2)}`,
        provider: a.provider ? `Dr. ${a.provider.LName}` : ''
      };
    });
  }

  private async getPatientReviewsReport(start: Date, end: Date, query?: any) {
    const where: any = { CommDateTime: { gte: start, lte: end } };

    if (query?.status === 'pending') {
      where.SentOrReceived = 1;
    } else if (query?.status === 'completed') {
      where.SentOrReceived = 2;
    }

    const commlogs = await prisma.commlog.findMany({
      where,
      include: { patient: true },
      orderBy: { CommDateTime: 'desc' },
      take: 100
    });

    if (commlogs.length === 0) {
      return [];
    }

    return commlogs.map(c => {
      let actualStatus = 'Published';
      if (c.SentOrReceived === 1) actualStatus = 'Pending';
      if (c.SentOrReceived === 2) actualStatus = 'Completed';

      return {
        patientName: c.patient ? `${c.patient.FName} ${c.patient.LName}` : 'Patient',
        reviewStatus: actualStatus,
        date: c.CommDateTime ? new Date(c.CommDateTime).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' }) : new Date().toLocaleDateString('en-US')
      };
    });
  }

  private async getPatientNotificationsReport(start: Date, end: Date, query?: any) {
    const where: any = {};

    if (query?.sentStart && query?.sentEnd) {
      where.CommDateTime = { 
        gte: new Date(query.sentStart), 
        lte: new Date(query.sentEnd) 
      };
    } else if (start && end) {
      where.CommDateTime = { gte: start, lte: end };
    }

    if (query?.plannedStart && query?.plannedEnd) {
      where.DateTimeEnd = { 
        gte: new Date(query.plannedStart), 
        lte: new Date(query.plannedEnd) 
      };
    }

    if (query?.status && query.status !== 'none') {
      if (query.status === 'sent') where.SentOrReceived = 1;
      else if (query.status === 'failed') where.SentOrReceived = 2;
      else if (query.status === 'pending') where.SentOrReceived = { notIn: [1, 2] };
    }

    if (query?.notificationType === 'patient') {
      where.PatNum = { not: null };
    } else if (query?.notificationType === 'internal') {
      where.PatNum = null;
    }

    if (query?.template && query.template !== 'none') {
      if (query.template === 'welcome') where.definition = { ItemName: { contains: 'Welcome' } };
      else if (query.template === 'save') where.definition = { ItemName: { contains: 'Save' } };
      else if (query.template === 'custom') where.definition = { ItemName: { contains: 'Custom' } };
    }

    const commlogs = await prisma.commlog.findMany({
      where,
      include: {
        patient: true,
        userod: true,
        definition: true
      },
      orderBy: { CommDateTime: 'desc' },
      take: 100
    });

    if (commlogs.length === 0) {
      return [];
    }

    return commlogs.map(c => {
      const cAny = c as any;
      const commDate = c.CommDateTime ? new Date(c.CommDateTime) : null;
      const plannedDate = c.DateTimeEnd ? new Date(c.DateTimeEnd) : commDate;
      
      return {
        sentToPatient: c.patient ? `${c.patient.FName} ${c.patient.LName}` : 'Patient',
        sentToUser: c.userod?.UserName || 'Staff User',
        template: c.definition?.ItemName || 'Standard Reminder',
        status: c.SentOrReceived === 1 ? 'Sent' : c.SentOrReceived === 2 ? 'Failed' : 'Pending',
        plannedOn: plannedDate ? plannedDate.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' }) : '',
        sentOn: commDate ? `${commDate.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' })} ${commDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}` : '',
        info: c.Note || 'Notification delivered successfully',
        sentBy: c.userod?.UserName || 'System',
        reply: ''
      };
    });
  }

  private async getPatientProceduresReport(start: Date, end: Date, query?: any) {
    const where: any = {};

    const isCreatedDate = query?.dateType === 'created';
    const startDateFilter = query?.startDate ? new Date(query.startDate) : start;
    const endDateFilter = query?.endDate ? new Date(query.endDate) : end;

    if (isCreatedDate) {
      where.DateEntryC = { gte: startDateFilter, lte: endDateFilter };
    } else {
      where.ProcDate = { gte: startDateFilter, lte: endDateFilter };
    }

    if (query?.provider && query.provider !== 'all') {
      const provNum = Number(query.provider);
      if (!isNaN(provNum)) where.ProvNum = provNum;
    }

    if (query?.status && query.status !== 'all') {
      const statusMap: Record<string, number> = {
        tp: 1, completed: 2, existingCurrent: 3, existingOther: 4, referredOut: 5, deleted: 6
      };
      if (statusMap[query.status]) {
        where.ProcStatus = statusMap[query.status];
      } else if (!isNaN(Number(query.status))) {
        where.ProcStatus = Number(query.status);
      }
    }

    if (query?.adaCode && query.adaCode !== 'all') {
      where.OR = [
        { OldCode: { contains: query.adaCode } },
        { procedurecode_procedurelog_CodeNumToprocedurecode: { ProcCode: { contains: query.adaCode } } }
      ];
    }

    const procs = await prisma.procedurelog.findMany({
      where,
      include: {
        patient: true,
        provider_procedurelog_ProvNumToprovider: true,
        procedurecode_procedurelog_CodeNumToprocedurecode: true,
        appointment_procedurelog_AptNumToappointment: true
      },
      take: 100
    });

    const procStatusLabels: Record<number, string> = {
      1: 'Treatment Planned',
      2: 'Completed',
      3: 'Existing Current',
      4: 'Existing Other',
      5: 'Referred Out',
      6: 'Deleted'
    };

    if (procs.length === 0) {
      return [];
    }

    return procs.map(p => {
      const pAny = p as any;
      const codeObj = pAny.procedurecode_procedurelog_CodeNumToprocedurecode;
      const appt = pAny.appointment_procedurelog_AptNumToappointment;
      const prov = pAny.provider_procedurelog_ProvNumToprovider;

      return {
        patient: p.patient ? `${p.patient.FName} ${p.patient.LName}` : 'Patient',
        code: codeObj?.ProcCode || p.OldCode || 'D0120',
        description: codeObj?.Descript || 'Dental Procedure',
        status: procStatusLabels[p.ProcStatus ?? 2] || 'Completed',
        provider: prov ? `${prov.FName || ''} ${prov.LName || ''}`.trim() || prov.Abbr || 'Provider' : 'Provider',
        created: p.DateEntryC ? new Date(p.DateEntryC).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' }) : (p.DateTStamp ? new Date(p.DateTStamp).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' }) : ''),
        scheduled: appt?.AptDateTime ? new Date(appt.AptDateTime).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' }) : (p.ProcDate ? new Date(p.ProcDate).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' }) : '')
      };
    });
  }

  private async getPatientTrackers(start?: Date, end?: Date, query?: any) {
    const where: any = { ObjectType: 1 };

    if (start && end) {
      where.DateTimeEntry = { gte: start, lte: end };
    }

    if (query?.patientSearch) {
      where.patient = {
        OR: [
          { FName: { contains: query.patientSearch, mode: 'insensitive' } },
          { LName: { contains: query.patientSearch, mode: 'insensitive' } }
        ]
      };
    } else {
      where.patient = { isNot: null };
    }

    if (query?.status && query.status !== 'all') {
      if (query.status === 'completed') {
        where.TaskStatus = 2;
      } else if (query.status === 'ontrack') {
        where.TaskStatus = { not: 2 };
      }
    }

    if (query?.createdBy === 'admin') {
      where.userod = { UserName: { equals: 'admin', mode: 'insensitive' } };
    }

    const tasks = await prisma.task.findMany({
      where,
      include: { patient: true, userod: true },
      orderBy: { DateTimeEntry: 'desc' },
      take: 100
    });

    if (tasks.length === 0) return [];

    return tasks.map(t => {
      const tStart = t.DateTimeEntry ? new Date(t.DateTimeEntry) : null;
      const tEnd = t.DateTimeFinished ? new Date(t.DateTimeFinished) : null;
      let duration = '--';
      if (tStart && tEnd) {
        const diffDays = Math.ceil(Math.abs(tEnd.getTime() - tStart.getTime()) / (1000 * 60 * 60 * 24));
        duration = `${diffDays} days`;
      }

      return {
        patient: t.patient ? `${t.patient.FName} ${t.patient.LName}` : 'Unknown',
        trackerName: t.Descript?.split('\n')[0] || 'Patient Tracker',
        startDate: tStart ? tStart.toLocaleDateString() : '',
        endDate: tEnd ? tEnd.toLocaleDateString() : 'Active',
        duration,
        description: t.DescriptOverride || t.Descript || '',
        status: t.TaskStatus === 2 ? 'Completed' : 'On Track',
        createdBy: t.userod?.UserName || 'System',
        completedBy: t.TaskStatus === 2 ? (t.userod?.UserName || 'System') : '--',
        deletedBy: '--'
      };
    });
  }

  // ==========================================
  // OTHERS REPORTS QUERY HELPERS
  // ==========================================

  private async getLoginReport(start: Date, end: Date, query: any = {}) {
    const searchParams = query.search || query.searchQuery || '';
    
    const whereClause: any = {
      LogDateTime: { gte: start, lte: end },
      LogText: { contains: 'log', mode: 'insensitive' },
    };

    if (searchParams) {
      whereClause.userod = {
        UserName: { contains: searchParams, mode: 'insensitive' }
      };
    }

    const logs = await prisma.securitylog.findMany({
      where: whereClause,
      include: { userod: true },
      take: 200,
      orderBy: { LogDateTime: 'desc' }
    });

    return logs.map((log) => {
      const dateStr = log.LogDateTime
        ? new Date(log.LogDateTime).toLocaleString('en-US', {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          hour12: true
        })
        : '';
        
      let ip = '127.0.0.1';
      let machine = log.CompName ? `Machine: ${log.CompName}` : 'Unknown';
      let status = 'Success';
      
      const logText = log.LogText || '';
      if (logText.toLowerCase().includes('fail') || logText.toLowerCase().includes('invalid')) {
        status = 'Failure';
      }
      
      try {
        if (logText.startsWith('{')) {
          const parsed = JSON.parse(logText);
          if (parsed.ipAddress && parsed.ipAddress !== 'unknown') ip = parsed.ipAddress;
          if (parsed.userAgent && parsed.userAgent !== 'unknown') machine = parsed.userAgent;
          if (parsed.eventType) status = parsed.eventType.includes('failure') ? 'Failure' : 'Success';
        }
      } catch (e) {
        // Fallback to default values if JSON parsing fails
      }

      return {
        id: log.SecurityLogNum.toString(),
        username: log.userod?.UserName ?? 'Unknown User',
        date: dateStr,
        createdAt: log.LogDateTime ? log.LogDateTime.toISOString() : null,
        status,
        ip,
        machine
      };
    });
  }

  private async getAuditReport(start: Date, end: Date, query: any = {}) {
    const searchUser = query.searchUser || '';
    const searchPatient = query.searchPatient || '';
    const actionFilter = query.action || 'None';
    const categoryFilter = query.category || 'None';

    const whereClause: any = {
      LogDateTime: { gte: start, lte: end },
    };

    if (searchUser) {
      whereClause.userod = {
        UserName: { contains: searchUser, mode: 'insensitive' }
      };
    }

    if (searchPatient) {
      const terms = searchPatient.split(' ').filter(Boolean);
      if (terms.length > 0) {
        if (terms.length === 1) {
           whereClause.patient = {
             OR: [
               { FName: { contains: terms[0], mode: 'insensitive' } },
               { LName: { contains: terms[0], mode: 'insensitive' } }
             ]
           };
        } else {
           whereClause.patient = {
             FName: { contains: terms[0], mode: 'insensitive' },
             LName: { contains: terms[1], mode: 'insensitive' }
           };
        }
      }
    }

    const logs = await prisma.securitylog.findMany({
      where: whereClause,
      include: { userod: true, patient: true },
      take: 200,
      orderBy: { LogDateTime: 'desc' }
    });

    let report = logs.map((log) => {
      const dateStr = log.LogDateTime
        ? new Date(log.LogDateTime).toLocaleString('en-US', {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          hour12: true
        })
        : '';
        
      let parsedAction = 'Action Performed';
      let parsedCategory = 'General';
      let parsedObject = 'System Record';

      const text = log.LogText?.toLowerCase() || '';
      if (text.includes('create') || text.includes('add')) parsedAction = 'Create';
      else if (text.includes('update') || text.includes('edit') || text.includes('change')) parsedAction = 'Update';
      else if (text.includes('delete') || text.includes('remove')) parsedAction = 'Delete';
      else if (text.includes('view') || text.includes('print')) parsedAction = 'View';

      if (text.includes('report')) parsedCategory = 'Report';
      else if (text.includes('patient') || log.PatNum) parsedCategory = 'Patient';
      else if (text.includes('appoint') || text.includes('sched')) parsedCategory = 'Schedule';
      else if (text.includes('claim') || text.includes('bill')) parsedCategory = 'Billing';

      let finalMessage = log.LogText ?? 'Success';
      try {
        const parsed = JSON.parse(finalMessage);
        if (parsed.description) finalMessage = parsed.description;
        else if (parsed.message) finalMessage = parsed.message;
      } catch (e) {
        // Not JSON, leave as is
      }

      return {
        id: log.SecurityLogNum.toString(),
        patient: log.patient ? `${log.patient.FName} ${log.patient.LName}` : '',
        user: log.userod?.UserName ?? 'System',
        category: parsedCategory,
        subcategory: parsedCategory,
        action: parsedAction,
        object: parsedObject,
        date: dateStr,
        message: finalMessage,
        diff: { key: '', old: '', new: '' }
      };
    });

    if (actionFilter !== 'None') {
      report = report.filter(r => r.action.toLowerCase() === actionFilter.toLowerCase());
    }

    if (categoryFilter !== 'None') {
      report = report.filter(r => r.category.toLowerCase() === categoryFilter.toLowerCase());
    }

    return report;
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

  private getRangeDates(dateStr?: string, range = 'Daily', customStart?: string, customEnd?: string): { startDate: Date; endDate: Date } {
    if (customStart && customEnd && customStart !== '' && customEnd !== '') {
      const start = new Date(customStart);
      const end = new Date(customEnd);
      if (!isNaN(start.getTime()) && !isNaN(end.getTime())) {
        start.setHours(0, 0, 0, 0);
        end.setHours(23, 59, 59, 999);
        return { startDate: start, endDate: end };
      }
    }

    const baseDate = dateStr ? new Date(dateStr) : new Date();
    let startDate = new Date(baseDate);
    let endDate = new Date(baseDate);

    if (range === 'Daily' || range === 'today') {
      startDate.setHours(0, 0, 0, 0);
      endDate.setHours(23, 59, 59, 999);
    } else if (range === 'Weekly' || range === 'this_week') {
      const day = baseDate.getDay();
      const diff = baseDate.getDate() - day + (day === 0 ? -6 : 1);
      startDate = new Date(baseDate);
      startDate.setDate(diff);
      startDate.setHours(0, 0, 0, 0);
      endDate = new Date(startDate);
      endDate.setDate(startDate.getDate() + 6);
      endDate.setHours(23, 59, 59, 999);
    } else if (range === 'last_7_days') {
      startDate.setDate(baseDate.getDate() - 6);
      startDate.setHours(0, 0, 0, 0);
      endDate.setHours(23, 59, 59, 999);
    } else if (range === 'last_week') {
      const day = baseDate.getDay();
      const diffToLastWeekStart = baseDate.getDate() - day - 7 + (day === 0 ? -6 : 1);
      startDate = new Date(baseDate);
      startDate.setDate(diffToLastWeekStart);
      startDate.setHours(0, 0, 0, 0);
      endDate = new Date(startDate);
      endDate.setDate(startDate.getDate() + 6);
      endDate.setHours(23, 59, 59, 999);
    } else if (range === 'last_4_weeks') {
      startDate.setDate(baseDate.getDate() - 28);
      startDate.setHours(0, 0, 0, 0);
      endDate.setHours(23, 59, 59, 999);
    } else if (range === 'Monthly' || range === 'this_month') {
      startDate.setDate(1);
      startDate.setHours(0, 0, 0, 0);
      endDate.setMonth(baseDate.getMonth() + 1, 0);
      endDate.setHours(23, 59, 59, 999);
    } else if (range === 'last_month') {
      startDate.setMonth(baseDate.getMonth() - 1, 1);
      startDate.setHours(0, 0, 0, 0);
      endDate.setMonth(baseDate.getMonth(), 0);
      endDate.setHours(23, 59, 59, 999);
    } else if (range === 'last_3_months') {
      startDate.setMonth(baseDate.getMonth() - 3);
      startDate.setHours(0, 0, 0, 0);
      endDate.setHours(23, 59, 59, 999);
    } else if (range === 'last_12_months') {
      startDate.setFullYear(baseDate.getFullYear() - 1);
      startDate.setHours(0, 0, 0, 0);
      endDate.setHours(23, 59, 59, 999);
    } else if (range === 'year_to_date') {
      startDate.setMonth(0, 1);
      startDate.setHours(0, 0, 0, 0);
      endDate.setHours(23, 59, 59, 999);
    } else if (range === 'Yearly') {
      startDate.setMonth(0, 1);
      startDate.setHours(0, 0, 0, 0);
      endDate.setMonth(11, 31);
      endDate.setHours(23, 59, 59, 999);
    } else {
      startDate.setHours(0, 0, 0, 0);
      endDate.setHours(23, 59, 59, 999);
    }

    return { startDate, endDate };
  }
}

export const reportGenerationService = new ReportGenerationService();
