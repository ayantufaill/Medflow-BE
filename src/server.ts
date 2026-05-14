import dotenv from 'dotenv';

// Load .env BEFORE any module that reads process.env.
// In production (Railway/Render), env vars come from the platform dashboard —
// dotenv is a no-op there, which is correct.
dotenv.config({ path: process.env.DOTENV_CONFIG_PATH || '.env' });

import connectDB, { prisma } from './config/db.js';
import app from './app.js';
import { hashPassword } from './utils/password.util.js';


// ── Seed admin user if DB is empty ───────────────────────────────────────────
const seedAdminIfEmpty = async (): Promise<void> => {
  try {
    const count = await prisma.userod.count();
    if (count > 0) return;

    console.log('🌱 Empty database detected — seeding admin user...');
    const email = process.env.SEED_ADMIN_EMAIL || 'admin@medflow.com';
    const password = process.env.SEED_ADMIN_PASSWORD || 'Admin123!';
    const passwordHash = await hashPassword(password);

    const maxRow = await prisma.$queryRaw<[{ max: bigint | null }]>`SELECT MAX("UserNum") as max FROM "userod"`;
    const nextId = (maxRow[0]?.max ?? 0n) + 1n;

    await prisma.userod.create({
      data: { UserNum: nextId, UserName: email, Password: passwordHash, IsHidden: 0 },
    });
    console.log(`✅ Admin user created: ${email}`);
  } catch (err) {
    console.error('⚠️  Could not seed admin user:', (err as Error).message);
  }
};

// ── Startup validation ────────────────────────────────────────────────────────
const validateEnv = (): boolean => {
  const missing: string[] = [];

  if (!process.env.DATABASE_URL) missing.push('DATABASE_URL');

  if (missing.length > 0) {
    console.error('');
    console.error('═══════════════════════════════════════════════════════════════');
    console.error(' FATAL: Required environment variables are not set');
    console.error('═══════════════════════════════════════════════════════════════');
    for (const k of missing) console.error(`  ✗ ${k}`);
    console.error('');
    console.error(' Set them in your platform:');
    console.error('  Railway  → Project → Variables tab');
    console.error('  Render   → Service → Environment');
    console.error('  Docker   → -e DATABASE_URL=...');
    console.error('');
    console.error(' DATABASE_URL formats:');
    console.error('  PostgreSQL : postgresql://USER:PASS@HOST/DB?sslmode=require');
    console.error('  SQL Server : sqlserver://HOST:1433;database=DB;user=USER;password=PASS;encrypt=true');
    console.error('═══════════════════════════════════════════════════════════════');
    return false;
  }

  // Warn if schema provider doesn't match URL protocol — prevents the most
  // common "URL must start with protocol sqlserver://" crash.
  const url = process.env.DATABASE_URL!;
  const isPgUrl  = url.startsWith('postgresql://') || url.startsWith('postgres://');
  const isSqlUrl = url.startsWith('sqlserver://');
  if (!isPgUrl && !isSqlUrl) {
    console.warn('⚠️  DATABASE_URL has an unrecognized protocol. Expected postgresql:// or sqlserver://');
  }

  if (process.env.NODE_ENV === 'production') {
    const insecureDefault = 'replace-with-a-long-random-secret-at-least-32-chars';
    if (!process.env.JWT_SECRET || process.env.JWT_SECRET === insecureDefault) {
      console.warn('⚠️  JWT_SECRET is not set or is using the insecure default!');
      console.warn('   Generate one: openssl rand -base64 64');
    }
  }

  return true;
};

// ── Main startup ──────────────────────────────────────────────────────────────
const startServer = async (): Promise<void> => {
  if (!validateEnv()) process.exit(1);

  await connectDB();
  await seedAdminIfEmpty();

  const PORT = Number(process.env.PORT) || 5001;
  app.listen(PORT, () => {
    console.log('');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log(` 🚀 MedFlow API  →  port ${PORT}`);
    console.log(` 📦 Environment  →  ${process.env.NODE_ENV || 'development'}`);
    console.log(` 🔗 Health       →  http://localhost:${PORT}/health`);
    console.log(` 📖 Docs         →  http://localhost:${PORT}/api-docs`);
    console.log('═══════════════════════════════════════════════════════════════');
  });
};

startServer().catch((err) => {
  console.error('Unhandled startup error:', err);
  process.exit(1);
});

export default app;
