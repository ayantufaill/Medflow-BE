import dotenv from 'dotenv';

// Load .env BEFORE any other imports that might read process.env.
// In production (Railway/Render), env vars come from the platform dashboard,
// not from a .env file — dotenv is a no-op there and that is correct.
dotenv.config({ path: process.env.DOTENV_CONFIG_PATH || '.env' });

import connectDB from './config/db.js';
import app from './app.js';

// ── Startup env-var validation ────────────────────────────────────────────────
// Check required variables BEFORE trying to connect so the crash message is
// actionable and the restart loop is immediately obvious to the operator.
const REQUIRED_ENV_VARS = ['DATABASE_URL'] as const;

const validateEnv = (): boolean => {
  const missing = REQUIRED_ENV_VARS.filter((k) => !process.env[k]);
  if (missing.length === 0) return true;

  console.error('');
  console.error('═══════════════════════════════════════════════════════════════');
  console.error(' FATAL: Required environment variables are missing');
  console.error('═══════════════════════════════════════════════════════════════');
  for (const key of missing) {
    console.error(`  ✗ ${key}`);
  }
  console.error('');
  console.error(' Fix this in your deployment platform:');
  console.error('  • Railway  → Project → Variables tab');
  console.error('  • Render   → Service → Environment');
  console.error('  • Docker   → docker run -e DATABASE_URL=...');
  console.error('');
  console.error(' DATABASE_URL formats:');
  console.error('  SQL Server: sqlserver://HOST:1433;database=DB;user=USER;password=PASS;encrypt=true;trustServerCertificate=true');
  console.error('  PostgreSQL: postgresql://USER:PASS@HOST/DB?sslmode=require');
  console.error('═══════════════════════════════════════════════════════════════');
  console.error('');
  return false;
};

// ── Main startup ──────────────────────────────────────────────────────────────
const startServer = async (): Promise<void> => {
  // 1. Validate environment
  if (!validateEnv()) {
    process.exit(1);
  }

  // 2. Warn about insecure JWT defaults
  if (
    process.env.NODE_ENV === 'production' &&
    (!process.env.JWT_SECRET || process.env.JWT_SECRET === 'replace-with-a-long-random-secret-at-least-32-chars')
  ) {
    console.warn('⚠️  WARNING: JWT_SECRET is using the default/insecure value in production!');
    console.warn('   Generate a secure secret with: openssl rand -base64 64');
  }

  // 3. Connect to database
  await connectDB();

  // 4. Start HTTP server
  const PORT = Number(process.env.PORT) || 5001;
  app.listen(PORT, () => {
    console.log('');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log(` 🚀 MedFlow API running on port ${PORT}`);
    console.log(` 📦 Environment : ${process.env.NODE_ENV || 'development'}`);
    console.log(` 🔗 Health check: http://localhost:${PORT}/health`);
    console.log(` 📖 API docs    : http://localhost:${PORT}/api-docs`);
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('');
  });
};

startServer().catch((err) => {
  console.error('Unhandled startup error:', err);
  process.exit(1);
});

export default app;
