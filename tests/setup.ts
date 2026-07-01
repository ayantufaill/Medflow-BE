import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { afterAll, beforeAll } from 'vitest';
import connectDB, { prisma } from '../src/config/db';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const testEnv = path.join(rootDir, '.env.test');
const dockerEnv = path.join(rootDir, '.env.docker');
const defaultEnv = path.join(rootDir, '.env');
const envPath = fs.existsSync(testEnv)
  ? testEnv
  : fs.existsSync(dockerEnv)
    ? dockerEnv
    : defaultEnv;

process.env.DOTENV_CONFIG_PATH = envPath;
dotenv.config({ path: envPath });

process.env.NODE_ENV = process.env.NODE_ENV || 'test';
process.env.EMAIL_PROVIDER = process.env.EMAIL_PROVIDER || 'console';
process.env.OCR_MOCK = process.env.OCR_MOCK || 'true';

let prismaRef: { $disconnect: () => Promise<void> } | null = null;

beforeAll(async () => {
  prismaRef = prisma;
  await connectDB();
});

afterAll(async () => {
  if (prismaRef) {
    await prismaRef.$disconnect();
  }
});