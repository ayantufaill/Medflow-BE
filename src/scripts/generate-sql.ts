import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();

function escapeString(val: string): string {
  // Escape single quotes for SQL by doubling them
  return "'" + val.replace(/'/g, "''") + "'";
}

function formatValue(val: any): string {
  if (val === null || val === undefined) return 'NULL';
  if (typeof val === 'string') return escapeString(val);
  if (typeof val === 'number' || typeof val === 'bigint') return val.toString();
  if (typeof val === 'boolean') return val ? 'TRUE' : 'FALSE';
  if (val instanceof Date) return escapeString(val.toISOString());
  
  // Convert JSON or objects to string
  if (typeof val === 'object') return escapeString(JSON.stringify(val));
  
  return escapeString(String(val));
}

async function generateTableSql(tableName: string, pkField: string) {
  console.log(`Fetching data for ${tableName}...`);
  // @ts-ignore
  const rows = await prisma[tableName].findMany();
  
  if (rows.length === 0) {
    return `-- No data found for ${tableName}\n\n`;
  }

  let sql = `-- --------------------------------------------------------\n`;
  sql += `-- Insert statements for: ${tableName}\n`;
  sql += `-- --------------------------------------------------------\n`;
  
  for (const row of rows) {
    const keys = Object.keys(row);
    // Double quote column names for PostgreSQL
    const cols = keys.map(k => `"${k}"`).join(', ');
    const vals = keys.map(k => formatValue(row[k])).join(', ');
    
    // Using ON CONFLICT DO NOTHING so it's safe to run multiple times
    sql += `INSERT INTO "${tableName}" (${cols}) VALUES (${vals}) ON CONFLICT ("${pkField}") DO NOTHING;\n`;
  }
  return sql + '\n';
}

async function main() {
  let outputSql = `-- Production Data Sync SQL\n`;
  outputSql += `-- Generated on ${new Date().toISOString()}\n\n`;

  // Define tables in the order of dependencies to avoid FK constraint errors
  outputSql += await generateTableSql('definition', 'DefNum');
  outputSql += await generateTableSql('clinic', 'ClinicNum');
  outputSql += await generateTableSql('provider', 'ProvNum');
  outputSql += await generateTableSql('procedurecode', 'ProcCode');
  outputSql += await generateTableSql('operatory', 'OperatoryNum');

  const outPath = path.join(process.cwd(), 'production-inserts.sql');
  fs.writeFileSync(outPath, outputSql, 'utf-8');
  
  console.log(`\n✅ Successfully generated SQL inserts for ${outPath}`);
  console.log('You can now open this file and copy-paste the queries into your Railway production database console.');
}

main()
  .catch((e) => {
    console.error('Error generating SQL:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
