import dotenv from 'dotenv';

// Load .env BEFORE any module that reads process.env.
// In production (Railway/Render), env vars come from the platform dashboard —
// dotenv is a no-op there, which is correct.
dotenv.config({ path: process.env.DOTENV_CONFIG_PATH || '.env' });

import { createServer } from 'http';
import connectDB, { prisma } from './config/db.js';
import app from './app.js';
import { hashPassword } from './utils/password.util.js';
import { startReminderScheduler } from './jobs/reminderScheduler.js';
import { initSocket } from './sockets/socket.js';


// ── Seed essential data if DB is empty ───────────────────────────────────────
const seedIfEmpty = async (): Promise<void> => {
  try {
    const count = await prisma.userod.count();
    if (count > 0) return;

    console.log('🌱 Empty database — seeding essential data...');

    // Admin user
    const email = process.env.SEED_ADMIN_EMAIL || 'admin@medflow.com';
    const password = process.env.SEED_ADMIN_PASSWORD || 'Admin123!';
    const passwordHash = await hashPassword(password);
    const maxUser = await prisma.$queryRaw<[{ max: bigint | null }]>`SELECT MAX("UserNum") as max FROM "userod"`;
    const userNum = (maxUser[0]?.max ?? 0n) + 1n;
    await prisma.userod.create({ data: { UserNum: userNum, UserName: email, Password: passwordHash, IsHidden: 0 } });
    console.log(`✅ Admin user: ${email}`);

    // Roles
    const roles = ['Admin', 'Provider', 'Staff', 'Patient'];
    for (let i = 0; i < roles.length; i++) {
      const existing = await prisma.usergroup.findFirst({ where: { Description: roles[i] } });
      if (!existing) {
        const maxRole = await prisma.$queryRaw<[{ max: bigint | null }]>`SELECT MAX("UserGroupNum") as max FROM "usergroup"`;
        const id = (maxRole[0]?.max ?? 0n) + 1n;
        await prisma.usergroup.create({ data: { UserGroupNum: id, Description: roles[i] } });
      }
    }
    console.log('✅ Roles seeded');

    // Attach admin role to admin user
    const adminRole = await prisma.usergroup.findFirst({ where: { Description: 'Admin' } });
    if (adminRole) {
      const maxAttach = await prisma.$queryRaw<[{ max: bigint | null }]>`SELECT MAX("UserGroupAttachNum") as max FROM "usergroupattach"`;
      const attachId = (maxAttach[0]?.max ?? 0n) + 1n;
      await prisma.usergroupattach.create({ data: { UserGroupAttachNum: attachId, UserNum: userNum, UserGroupNum: adminRole.UserGroupNum } });
    }

    // Specialties
    const specialties = ['General Dentistry','Orthodontics','Periodontics','Oral Surgery','Endodontics','Pediatric Dentistry','Prosthodontics','Cosmetic Dentistry'];
    for (const name of specialties) {
      const existing = await prisma.definition.findFirst({ where: { ItemName: name, Category: 0 } });
      if (!existing) {
        const maxDef = await prisma.$queryRaw<[{ max: bigint | null }]>`SELECT MAX("DefNum") as max FROM "definition"`;
        const id = (maxDef[0]?.max ?? 0n) + 1n;
        await prisma.definition.create({ data: { DefNum: id, Category: 0, ItemName: name, ItemOrder: Number(id), IsHidden: 0 } });
      }
    }
    console.log('✅ Specialties seeded');

    console.log('🎉 Seed complete!');
  } catch (err) {
    console.error('⚠️  Seed error:', (err as Error).message);
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
  await seedIfEmpty();

  const PORT = Number(process.env.PORT) || 5001;
  const httpServer = createServer(app);
  initSocket(httpServer);

  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log('');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log(` 🚀 MedFlow API  →  port ${PORT}`);
    console.log(` 📦 Environment  →  ${process.env.NODE_ENV || 'development'}`);
    console.log(` 🔗 Health       →  http://localhost:${PORT}/health`);
    console.log(` 📖 Docs         →  http://localhost:${PORT}/api-docs`);
    console.log(` 🔌 Socket.io    →  ready`);
    console.log('═══════════════════════════════════════════════════════════════');
  });

  startReminderScheduler();
};

startServer().catch((err) => {
  console.error('Unhandled startup error:', err);
  process.exit(1);
});

export default app;
