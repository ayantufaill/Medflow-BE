import { prisma } from '../config/db';
import { getNextId } from '../utils/opendental-ids.util';
import { NotFoundError } from '../utils/error.util';
import { getTopDenialReasons } from '../utils/denial-reasons.util';
import { submittedClaimPredicate } from '../utils/reporting-eligibility.util';
import { reportingClinicIds } from '../utils/reporting-scope.util';
import { runCustomReport } from './report-builder.service';
import { validateReportDefinition } from '../utils/reporting-fields.util';

export class ReportingService {
  async getDenialRates(branchId?: string) {
    const clinicIds = reportingClinicIds(branchId);
    const branchFilter = clinicIds === null ? '' : clinicIds.length
      ? ' AND COALESCE(NULLIF(cl."ClinicNum", 0), ownership."ClinicNum") IN (' + clinicIds.map(String).join(',') + ')'
      : ' AND FALSE';

    const sql = `
      WITH report_claims AS (
        SELECT
          cl."ClaimNum",
          c."CarrierNum" AS "payerId",
          COALESCE(c."CarrierName", 'Unknown Carrier') AS "payerName",
          cl."ClaimStatus" = 'D' AS "isDenied",
          COALESCE(billed."fee", cl."ClaimFee"::numeric, 0) AS "billedValue",
          reasons."rows" AS "reasonRows"
        FROM claim cl
        LEFT JOIN insplan ip ON cl."PlanNum" = ip."PlanNum"
        LEFT JOIN carrier c ON ip."CarrierNum" = c."CarrierNum"
        LEFT JOIN LATERAL (
          -- Older creation paths omitted claim.ClinicNum. Only infer ownership
          -- when EVERY linked line has the same real clinic; never guess from
          -- the selected branch or include all unassigned claims.
          SELECT CASE
            WHEN COUNT(*) = COUNT(NULLIF(cp."ClinicNum", 0))
             AND COUNT(DISTINCT NULLIF(cp."ClinicNum", 0)) = 1
            THEN MIN(NULLIF(cp."ClinicNum", 0))
          END AS "ClinicNum"
          FROM claimproc cp
          WHERE cp."ClaimNum" = cl."ClaimNum"
        ) ownership ON COALESCE(cl."ClinicNum", 0) = 0
        LEFT JOIN LATERAL (
          SELECT SUM(original."FeeBilled"::numeric) AS "fee"
          FROM (
            -- A procedure can have multiple claimproc payment records. Choose
            -- one original billed line, never deduplicate by dollar amount.
            SELECT DISTINCT ON (
              COALESCE('proc:' || NULLIF(cp."ProcNum", 0)::text,
                       'line:' || NULLIF(cp."LineNumber", 0)::text,
                       'row:' || cp."ClaimProcNum"::text)
            ) cp."FeeBilled"
            FROM claimproc cp
            WHERE cp."ClaimNum" = cl."ClaimNum"
              AND cp."Status" IN (0, 1, 5)
              AND COALESCE(cp."PaymentRow", 0) = 0
              AND COALESCE(cp."IsTransfer", 0) = 0
              AND COALESCE(cp."NoBillIns", 0) = 0
            ORDER BY
              COALESCE('proc:' || NULLIF(cp."ProcNum", 0)::text,
                       'line:' || NULLIF(cp."LineNumber", 0)::text,
                       'row:' || cp."ClaimProcNum"::text),
              (cp."FeeBilled" IS NULL), cp."ClaimProcNum"
          ) original
        ) billed ON cl."ClaimStatus" = 'D'
        LEFT JOIN LATERAL (
          SELECT JSONB_AGG(DISTINCT JSONB_BUILD_OBJECT(
            'claimNum', cl."ClaimNum"::text,
            'narrative', cl."Narrative",
            'reasonUnderPaid', cl."ReasonUnderPaid",
            'adjustmentReasonCodes', cp."ClaimAdjReasonCodes"
          )) AS "rows"
          -- Keep a reason row even when a denied claim has no claimproc rows.
          FROM (SELECT 1) anchor
          LEFT JOIN claimproc cp ON cp."ClaimNum" = cl."ClaimNum"
        ) reasons ON cl."ClaimStatus" = 'D'
        -- Document this report as a current-state denial rate based on shared rules
        WHERE ${submittedClaimPredicate}
        ${branchFilter}
      )
      SELECT
        "payerId"::text AS "payerId",
        "payerName",
        COUNT(*) AS "totalSubmitted",
        COUNT(*) FILTER (WHERE "isDenied") AS "deniedCount",
        COALESCE(SUM("billedValue") FILTER (WHERE "isDenied"), 0) AS "deniedValue",
        COALESCE(JSONB_AGG("reasonRows") FILTER (WHERE "isDenied"), '[]'::jsonb) AS "reasonRows"
      FROM report_claims
      GROUP BY "payerId", "payerName"
      ORDER BY "deniedValue" DESC, "totalSubmitted" DESC, "payerName", "payerId"
      LIMIT 50
    `;

    try {
      const rawData = await prisma.$queryRawUnsafe<any[]>(sql);

      return rawData.map(row => {
        const totalSubmitted = Number(row.totalSubmitted) || 0;
        const deniedCount = Number(row.deniedCount) || 0;
        const deniedValue = Number(row.deniedValue) || 0;
        const denialRate = totalSubmitted > 0 ? ((deniedCount / totalSubmitted) * 100).toFixed(1) + '%' : '0.0%';

        const reasons = getTopDenialReasons((row.reasonRows ?? []).flat());
        const topReasons = reasons.length > 0 ? reasons : ['None'];

        return {
          payerId: row.payerId ?? null,
          payerName: row.payerName || 'Unknown Carrier',
          denialRate,
          totalSubmitted,
          deniedCount,
          deniedValue,
          topReasons,
        };
      });
    } catch (err) {
      throw err;
    }
  }

  async getCarriers() {
    const carriers = await prisma.carrier.findMany({
      where: { IsHidden: 0 },
      select: {
        CarrierNum: true,
        CarrierName: true,
      },
      orderBy: { CarrierName: 'asc' },
    });

    return carriers.map(c => ({
      id: c.CarrierNum.toString(),
      name: c.CarrierName || 'Unknown Carrier'
    }));
  }

  async getSavedReports() {
    const docs = await prisma.document.findMany({
      where: {
        Note: { contains: '"documentType":"report_definition"' },
      },
      orderBy: { DateCreated: 'desc' },
    });

    return docs.map((doc) => {
      let meta: any = {};
      try {
        meta = JSON.parse(doc.Note || '{}');
      } catch {
        meta = {};
      }

      return {
        _id: doc.DocNum.toString(),
        name: meta.name ?? doc.Description ?? 'Custom Report',
        kind: meta.kind ?? 'Patient',
        filters: meta.filters ?? [],
        columns: meta.columns ?? [],
      };
    });
  }

  async saveReport(
    data: { name: string; kind: string; filters: any[]; columns: string[] },
    userId?: string
  ) {
    if (data.kind !== 'Financial') validateReportDefinition(data);
    const docNum = await getNextId('document', 'DocNum');
    const meta = {
      documentType: 'report_definition',
      name: data.name,
      kind: data.kind,
      filters: data.filters ?? [],
      columns: data.columns ?? [],
    };

    await prisma.document.create({
      data: {
        DocNum: docNum,
        PatNum: null,
        Description: data.name,
        FileName: 'report_definition.json',
        Note: JSON.stringify(meta),
        DateCreated: new Date(),
        UserNum: userId && /^\d+$/.test(userId) ? BigInt(userId) : null,
      },
    });

    return {
      _id: docNum.toString(),
      name: data.name,
      kind: data.kind,
      filters: data.filters ?? [],
      columns: data.columns ?? [],
    };
  }

  async deleteReport(id: string) {
    const doc = await prisma.document.findUnique({
      where: { DocNum: BigInt(id) },
    });

    if (!doc || !doc.Note?.includes('"documentType":"report_definition"')) {
      throw new NotFoundError('Report definition not found');
    }

    await prisma.document.delete({
      where: { DocNum: BigInt(id) },
    });

    return { success: true };
  }

  async runReport(options: Parameters<typeof runCustomReport>[0]) {
    return runCustomReport(options);
  }

  async archiveReport(type: string, data: any, userId?: string) {
    const createdBy = userId && /^\d+$/.test(userId) ? BigInt(userId) : null;
    const report = await prisma.archivedreport.create({
      data: {
        ReportType: type,
        ReportData: JSON.stringify(data),
        CreatedBy: createdBy,
      },
    });

    return {
      id: report.ReportId.toString(),
      type: report.ReportType,
      snapshotDate: report.SnapshotDate,
      createdBy: report.CreatedBy?.toString() || null,
    };
  }

  async getArchivedReports() {
    const reports = await prisma.archivedreport.findMany({
      orderBy: { SnapshotDate: 'desc' },
      select: {
        ReportId: true,
        ReportType: true,
        SnapshotDate: true,
        CreatedBy: true,
      },
    });

    return reports.map((r) => ({
      id: r.ReportId.toString(),
      type: r.ReportType,
      snapshotDate: r.SnapshotDate,
      createdBy: r.CreatedBy?.toString() || null,
    }));
  }

  async getArchivedReportById(id: string) {
    const report = await prisma.archivedreport.findUnique({
      where: { ReportId: BigInt(id) },
    });

    if (!report) {
      throw new NotFoundError('Archived report not found');
    }

    return {
      id: report.ReportId.toString(),
      type: report.ReportType,
      snapshotDate: report.SnapshotDate,
      createdBy: report.CreatedBy?.toString() || null,
      data: JSON.parse(report.ReportData),
    };
  }
}

export const reportingService = new ReportingService();
