import { prisma } from '../config/db';

export class ProductivityService {
  /**
   * Returns daily production totals for the given date range.
   */
  async getProductionOverTime(startDate: Date, endDate: Date) {
    const data: any[] = await prisma.$queryRaw`
      SELECT 
        CAST("ProcDate" AS DATE) as date,
        SUM("ProcFee") as value
      FROM "procedurelog"
      WHERE "ProcDate" >= ${startDate} 
        AND "ProcDate" <= ${endDate}
        AND "ProcStatus" = 2
      GROUP BY CAST("ProcDate" AS DATE)
      ORDER BY date ASC
    `;
    
    return data.map(item => ({
      label: item.date ? new Date(item.date).toISOString().split('T')[0] : 'Unknown',
      value: Number(item.value) || 0
    }));
  }

  /**
   * Returns total production grouped by Provider.
   */
  async getProductionByProvider(startDate: Date, endDate: Date) {
    const data: any[] = await prisma.$queryRaw`
      SELECT 
        COALESCE(pr."Abbr", 'Unknown') as label,
        SUM(pl."ProcFee") as value
      FROM "procedurelog" pl
      LEFT JOIN "provider" pr ON pl."ProvNum" = pr."ProvNum"
      WHERE pl."ProcDate" >= ${startDate} 
        AND pl."ProcDate" <= ${endDate}
        AND pl."ProcStatus" = 2
      GROUP BY pr."Abbr"
      ORDER BY value DESC
    `;
    
    return data.map(item => ({
      label: item.label,
      value: Number(item.value) || 0
    }));
  }

  /**
   * Returns total production grouped by Operatory.
   */
  async getProductionByOperatory(startDate: Date, endDate: Date) {
    const data: any[] = await prisma.$queryRaw`
      SELECT 
        COALESCE(op."OpName", 'Unassigned') as label,
        SUM(pl."ProcFee") as value
      FROM "procedurelog" pl
      LEFT JOIN "appointment" a ON pl."AptNum" = a."AptNum"
      LEFT JOIN "operatory" op ON a."Op" = op."OperatoryNum"
      WHERE pl."ProcDate" >= ${startDate} 
        AND pl."ProcDate" <= ${endDate}
        AND pl."ProcStatus" = 2
      GROUP BY op."OpName"
      ORDER BY value DESC
    `;
    
    return data.map(item => ({
      label: item.label,
      value: Number(item.value) || 0
    }));
  }
}

export const productivityService = new ProductivityService();
