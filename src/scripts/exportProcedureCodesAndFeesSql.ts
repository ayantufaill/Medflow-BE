import { prisma } from '../config/db';
import fs from 'fs';
import path from 'path';

function escapeString(val: string): string {
  return "'" + val.replace(/'/g, "''") + "'";
}

function formatValue(val: any): string {
  if (val === null || val === undefined) return 'NULL';
  if (typeof val === 'string') return escapeString(val);
  if (typeof val === 'number' || typeof val === 'bigint') return val.toString();
  if (typeof val === 'boolean') return val ? 'TRUE' : 'FALSE';
  if (val instanceof Date) return escapeString(val.toISOString());
  if (typeof val === 'object') return escapeString(JSON.stringify(val));
  return escapeString(String(val));
}

async function exportSql() {
  console.log('Generating SQL dump for Procedure Codes and Fees...');

  let sql = `-- ========================================================\n`;
  sql += `-- Medflow: Procedure Codes & Pricing SQL Script for Railway\n`;
  sql += `-- Generated: ${new Date().toISOString()}\n`;
  sql += `-- ========================================================\n\n`;
  sql += `BEGIN;\n\n`;

  // 1. Definition (Category = 1 for Procedure Categories)
  console.log('1. Exporting definition categories...');
  const definitions = await prisma.definition.findMany({
    where: { Category: 1 },
    orderBy: { DefNum: 'asc' },
  });

  sql += `-- --------------------------------------------------------\n`;
  sql += `-- 1. Category Definitions (Category = 1)\n`;
  sql += `-- --------------------------------------------------------\n`;
  for (const def of definitions) {
    sql += `INSERT INTO "definition" ("DefNum", "Category", "ItemOrder", "ItemName", "ItemValue", "ItemColor", "IsHidden")\n`;
    sql += `VALUES (${def.DefNum}, ${def.Category}, ${def.ItemOrder}, ${escapeString(def.ItemName || '')}, ${escapeString(def.ItemValue || '')}, ${def.ItemColor || 0}, ${def.IsHidden || 0})\n`;
    sql += `ON CONFLICT ("DefNum") DO UPDATE SET "ItemName" = EXCLUDED."ItemName", "ItemOrder" = EXCLUDED."ItemOrder";\n`;
  }
  sql += `\n`;

  // 2. Fee Schedules (feesched)
  console.log('2. Exporting fee schedules...');
  const feeScheds = await prisma.feesched.findMany({
    where: { IsHidden: 0 },
    orderBy: { FeeSchedNum: 'asc' },
  });

  sql += `-- --------------------------------------------------------\n`;
  sql += `-- 2. Fee Schedules\n`;
  sql += `-- --------------------------------------------------------\n`;
  for (const fsched of feeScheds) {
    sql += `INSERT INTO "feesched" ("FeeSchedNum", "Description", "FeeSchedType", "IsHidden", "IsGlobal")\n`;
    sql += `VALUES (${fsched.FeeSchedNum}, ${escapeString(fsched.Description || '')}, ${fsched.FeeSchedType || 0}, ${fsched.IsHidden || 0}, ${fsched.IsGlobal || 1})\n`;
    sql += `ON CONFLICT ("FeeSchedNum") DO UPDATE SET "Description" = EXCLUDED."Description", "IsHidden" = EXCLUDED."IsHidden";\n`;
  }
  sql += `\n`;

  // 3. Procedure Codes
  console.log('3. Exporting procedure codes...');
  const procCodes = await prisma.procedurecode.findMany({
    orderBy: { ProcCode: 'asc' },
  });

  sql += `-- --------------------------------------------------------\n`;
  sql += `-- 3. Procedure Codes (843+ CDT Codes)\n`;
  sql += `-- --------------------------------------------------------\n`;
  for (const pc of procCodes) {
    const cols = [
      '"CodeNum"',
      '"ProcCode"',
      '"Descript"',
      '"AbbrDesc"',
      '"ProcCat"',
      '"ProcTime"',
      '"TreatArea"',
      '"NoBillIns"',
      '"IsProsth"',
      '"IsHygiene"',
      '"IsTaxed"',
      '"PaintType"',
      '"IsCanadianLab"',
      '"PreExisting"',
      '"BaseUnits"',
      '"SubstOnlyIf"',
      '"IsMultiVisit"',
      '"CanadaTimeUnits"',
      '"IsRadiology"',
      '"BypassGlobalLock"',
      '"AreaAlsoToothRange"',
      '"LaymanTerm"',
      '"CoverageCategory"',
      '"RequiresXRay"',
      '"RequiresConsent"',
      '"RequiresPerioChart"',
      '"RequiresNarrative"',
      '"RequiresMedicalNecessity"',
      '"RequiresToothImage"',
    ];

    const vals = [
      formatValue(pc.CodeNum),
      formatValue(pc.ProcCode),
      formatValue(pc.Descript),
      formatValue(pc.AbbrDesc),
      formatValue(pc.ProcCat),
      formatValue(pc.ProcTime || '0'),
      formatValue(pc.TreatArea || 'MOUTH'),
      formatValue(pc.NoBillIns || 0),
      formatValue(pc.IsProsth || 0),
      formatValue(pc.IsHygiene || false),
      formatValue(pc.IsTaxed || 0),
      formatValue(pc.PaintType || 0),
      formatValue(pc.IsCanadianLab || 0),
      formatValue(pc.PreExisting || 0),
      formatValue(pc.BaseUnits || 0),
      formatValue(pc.SubstOnlyIf || 0),
      formatValue(pc.IsMultiVisit || 0),
      formatValue(pc.CanadaTimeUnits || 0),
      formatValue(pc.IsRadiology || 0),
      formatValue(pc.BypassGlobalLock || 0),
      formatValue(pc.AreaAlsoToothRange || 0),
      formatValue(pc.LaymanTerm),
      formatValue(pc.CoverageCategory),
      formatValue(pc.RequiresXRay),
      formatValue(pc.RequiresConsent),
      formatValue(pc.RequiresPerioChart),
      formatValue(pc.RequiresNarrative),
      formatValue(pc.RequiresMedicalNecessity),
      formatValue(pc.RequiresToothImage),
    ];

    sql += `INSERT INTO "procedurecode" (${cols.join(', ')}) VALUES (${vals.join(', ')})\n`;
    sql += `ON CONFLICT ("ProcCode") DO UPDATE SET\n`;
    sql += `  "Descript" = EXCLUDED."Descript",\n`;
    sql += `  "AbbrDesc" = EXCLUDED."AbbrDesc",\n`;
    sql += `  "ProcCat" = EXCLUDED."ProcCat",\n`;
    sql += `  "TreatArea" = EXCLUDED."TreatArea",\n`;
    sql += `  "CoverageCategory" = EXCLUDED."CoverageCategory",\n`;
    sql += `  "RequiresXRay" = EXCLUDED."RequiresXRay",\n`;
    sql += `  "RequiresNarrative" = EXCLUDED."RequiresNarrative",\n`;
    sql += `  "RequiresPerioChart" = EXCLUDED."RequiresPerioChart",\n`;
    sql += `  "RequiresConsent" = EXCLUDED."RequiresConsent",\n`;
    sql += `  "RequiresMedicalNecessity" = EXCLUDED."RequiresMedicalNecessity",\n`;
    sql += `  "RequiresToothImage" = EXCLUDED."RequiresToothImage";\n`;
  }
  sql += `\n`;

  // 4. Fees
  console.log('4. Exporting fees...');
  const fees = await prisma.fee.findMany({
    orderBy: { FeeNum: 'asc' },
  });

  sql += `-- --------------------------------------------------------\n`;
  sql += `-- 4. Fees (${fees.length} entries with prices)\n`;
  sql += `-- --------------------------------------------------------\n`;
  for (const fee of fees) {
    sql += `INSERT INTO "fee" ("FeeNum", "Amount", "FeeSched", "CodeNum", "UseDefaultFee", "UseDefaultCov")\n`;
    sql += `VALUES (${fee.FeeNum}, ${fee.Amount || 0}, ${fee.FeeSched}, ${fee.CodeNum}, ${fee.UseDefaultFee || 0}, ${fee.UseDefaultCov || 0})\n`;
    sql += `ON CONFLICT ("FeeNum") DO UPDATE SET "Amount" = EXCLUDED."Amount";\n`;
  }
  sql += `\n`;

  // 5. Sequence sync for medflow_sequences
  sql += `-- --------------------------------------------------------\n`;
  sql += `-- 5. Synchronize Sequences for Medflow\n`;
  sql += `-- --------------------------------------------------------\n`;
  sql += `INSERT INTO medflow_sequences (table_name, next_id)\n`;
  sql += `VALUES\n`;
  sql += `  ('definition', (SELECT COALESCE(MAX("DefNum"), 0) + 1 FROM "definition")),\n`;
  sql += `  ('feesched', (SELECT COALESCE(MAX("FeeSchedNum"), 0) + 1 FROM "feesched")),\n`;
  sql += `  ('procedurecode', (SELECT COALESCE(MAX("CodeNum"), 0) + 1 FROM "procedurecode")),\n`;
  sql += `  ('fee', (SELECT COALESCE(MAX("FeeNum"), 0) + 1 FROM "fee"))\n`;
  sql += `ON CONFLICT (table_name) DO UPDATE\n`;
  sql += `SET next_id = EXCLUDED.next_id;\n\n`;

  sql += `COMMIT;\n`;

  const outPath = path.join(process.cwd(), 'seed-procedure-codes-and-prices.sql');
  fs.writeFileSync(outPath, sql, 'utf-8');

  console.log(`\n🎉 SQL generated successfully at: ${outPath}`);
  console.log(`File size: ${(fs.statSync(outPath).size / (1024 * 1024)).toFixed(2)} MB`);
}

exportSql()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Error exporting SQL:', err);
    process.exit(1);
  });
