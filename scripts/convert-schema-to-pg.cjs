#!/usr/bin/env node
/**
 * Converts Prisma schema from SQL Server to PostgreSQL.
 * Run: node scripts/convert-schema-to-pg.cjs
 * Output: prisma/schema.postgresql.prisma
 */

const fs = require('fs');
const path = require('path');

const INPUT  = path.join(__dirname, '..', 'prisma', 'schema.prisma');
const OUTPUT = path.join(__dirname, '..', 'prisma', 'schema.postgresql.prisma');

if (!fs.existsSync(INPUT)) {
  console.error('schema.prisma not found at', INPUT);
  process.exit(1);
}

let schema = fs.readFileSync(INPUT, 'utf8');

// ── 1. Swap datasource block ─────────────────────────────────────────────────
schema = schema.replace(
  /generator client \{[\s\S]*?\}/,
  `generator client {\n  provider = "prisma-client-js"\n}`
);

schema = schema.replace(
  /datasource db \{[\s\S]*?\}/,
  `datasource db {\n  provider = "postgresql"\n  url      = env("DATABASE_URL")\n}`
);

// ── 2. SQL Server → PostgreSQL @db type decorator mappings ───────────────────
const replacements = [
  // VarChar(Max) / NVarChar(Max) → Text
  [/@db\.VarChar\(Max\)/gi,         '@db.Text'],
  [/@db\.NVarChar\(Max\)/gi,        '@db.Text'],

  // NVarChar(n) → VarChar(n)
  [/@db\.NVarChar\((\d+)\)/gi,      (_, n) => `@db.VarChar(${n})`],

  // TinyInt → remove (Int in PG is 4 bytes, more than enough)
  [/\s*@db\.TinyInt/gi,             ''],

  // SmallInt → keep (PostgreSQL supports it)
  // [/@db\.SmallInt/gi, '@db.SmallInt'],  // leave unchanged

  // Int → remove (Prisma Int maps to integer by default)
  [/\s*@db\.Int\b/gi,               ''],

  // BigInt → remove (Prisma BigInt maps to bigint by default)
  [/\s*@db\.BigInt\b/gi,            ''],

  // DateTime → remove (maps to TIMESTAMP(3) by default in PG)
  [/\s*@db\.DateTime\b/gi,          ''],
  [/\s*@db\.DateTime2\b/gi,         ''],
  [/\s*@db\.SmallDateTime\b/gi,     ''],

  // Date → keep @db.Date (supported in PostgreSQL)
  // [/@db\.Date/gi, '@db.Date'],  // leave unchanged

  // Time → keep @db.Time(x) - supported in PostgreSQL
  // leave unchanged

  // Money → Decimal(19,4)
  [/@db\.Money\b/gi,                '@db.Decimal(19,4)'],
  [/@db\.SmallMoney\b/gi,           '@db.Decimal(10,4)'],

  // Float (SQL Server 64-bit) → DoublePrecision
  [/@db\.Float\b/gi,                '@db.DoublePrecision'],

  // Real (SQL Server 32-bit) → Real (same in PG)
  // leave unchanged

  // Bit → remove (Boolean maps correctly)
  [/\s*@db\.Bit\b/gi,               ''],

  // UniqueIdentifier → Uuid
  [/@db\.UniqueIdentifier\b/gi,     '@db.Uuid'],

  // Binary / VarBinary → ByteA
  [/@db\.Binary\b/gi,               '@db.ByteA'],
  [/@db\.VarBinary\b/gi,            '@db.ByteA'],

  // Image → ByteA
  [/@db\.Image\b/gi,                '@db.ByteA'],

  // Xml → Text
  [/@db\.Xml\b/gi,                  '@db.Text'],

  // NChar(n) → Char(n)
  [/@db\.NChar\((\d+)\)/gi,         (_, n) => `@db.Char(${n})`],

  // Char(n) → keep (supported in PG)
  // leave unchanged

  // Numeric(p,s) → keep as Decimal(p,s)
  [/@db\.Numeric\(([^)]+)\)/gi,     (_, args) => `@db.Decimal(${args})`],

  // Text (SQL Server deprecated) → Text (fine in PG)
  // leave unchanged
];

for (const [pattern, replacement] of replacements) {
  if (typeof replacement === 'string') {
    schema = schema.replace(pattern, replacement);
  } else {
    schema = schema.replace(pattern, replacement);
  }
}

// ── 3. Clean up any double spaces left by removals ───────────────────────────
schema = schema.replace(/  +/g, ' ');

// ── 4. Write output ──────────────────────────────────────────────────────────
fs.writeFileSync(OUTPUT, schema, 'utf8');

console.log('✓ PostgreSQL schema written to:', OUTPUT);
console.log('');
console.log('Next steps:');
console.log('  1. Review the generated schema for any remaining issues');
console.log('  2. Copy it over: cp prisma/schema.postgresql.prisma prisma/schema.prisma');
console.log('  3. Set DATABASE_URL to your Neon/Supabase PostgreSQL URL');
console.log('  4. Run: npx prisma db push   (first time, creates all tables)');
console.log('  5. Run: npm run seed:all     (optional seeding)');
