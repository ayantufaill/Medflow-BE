#!/usr/bin/env node

/**
 * B1.6 — Route-scope CI guard.
 *
 * Text-based check (NOT a real router walk — that's next sprint) that
 * ensures every route file in src/routes/ either:
 *   1. Contains `authenticate`, `resolveBranchAccess`, and
 *      `enterTenantContext` (or equivalent via router.use), OR
 *   2. Is listed in the allow-list with a non-empty reason.
 *
 * Additionally, files on the PHI list must contain `requirePhiAccess`.
 *
 * Limitation: this is a text check. It does NOT prove the middleware
 * is actually applied to every handler, only that it's imported and
 * referenced. A proper Express router-stack walker is next sprint.
 *
 * Usage: node scripts/check-route-scope.mjs
 * CI:    npm run check:routes
 */

import { readFileSync, readdirSync } from 'fs';
import { join, basename } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const ROUTES_DIR = join(__dirname, '..', 'src', 'routes');
const ALLOWLIST_PATH = join(__dirname, 'route-scope-allowlist.json');

// PHI route files that must have requirePhiAccess (from shared contracts §2a)
const PHI_FILES = new Set([
  'patient.routes.ts',
  'patient-image.route.ts',
  'patient-report.routes.ts',
  'patient-referral.routes.ts',
  'patient-membership.routes.ts',
  'patient-insurance.routes.ts',
  'allergy.routes.ts',
  'clinical-note.routes.ts',
  'clinical-exam.routes.ts',
  'clinical-management.routes.ts',
  'vital-sign.routes.ts',
  'rx.routes.ts',
  'treatment-plan.routes.ts',
  'progress-note.routes.ts',
  'lab-case.routes.ts',
  'document.routes.ts',
  'adjunctive-therapy.routes.ts',
]);

// Required middleware tokens in non-allowlisted route files
const REQUIRED_MIDDLEWARE = ['authenticate', 'resolveBranchAccess', 'enterTenantContext'];

function loadAllowlist() {
  try {
    const raw = readFileSync(ALLOWLIST_PATH, 'utf-8');
    return JSON.parse(raw);
  } catch {
    console.error(`⚠️  No allowlist found at ${ALLOWLIST_PATH}. Creating one would remove false positives.`);
    return {};
  }
}

function main() {
  const allowlist = loadAllowlist();
  const files = readdirSync(ROUTES_DIR).filter(
    (f) => f.endsWith('.routes.ts') || f.endsWith('.route.ts')
  );

  let failures = 0;
  let passed = 0;
  const results = { scoped: [], allowlisted: [], missing: [], phiMissing: [] };

  for (const file of files) {
    // Skip index.ts
    if (file === 'index.ts') continue;

    const filePath = join(ROUTES_DIR, file);
    const content = readFileSync(filePath, 'utf-8');

    // Check if file is on the allow-list
    if (allowlist[file]) {
      const reason = allowlist[file];
      if (!reason || reason.trim() === '') {
        console.error(`❌ ${file}: on allow-list but reason is empty`);
        failures++;
      } else {
        results.allowlisted.push({ file, reason });
        passed++;
      }
      continue;
    }

    // Check for required middleware
    const missing = REQUIRED_MIDDLEWARE.filter((mw) => !content.includes(mw));
    if (missing.length > 0) {
      console.error(`❌ ${file}: missing middleware: ${missing.join(', ')}`);
      results.missing.push({ file, missing });
      failures++;
    } else {
      results.scoped.push(file);
      passed++;
    }

    // PHI check
    if (PHI_FILES.has(file) && !content.includes('requirePhiAccess')) {
      // PHI gate may not be merged yet (Person A, ~hr 2.5)
      // Warn but don't fail until it's available
      console.warn(`⚠️  ${file}: PHI route file but missing requirePhiAccess (waiting for Person A)`);
      results.phiMissing.push(file);
    }
  }

  // Summary
  console.log('\n──── Route Scope Check ────');
  console.log(`✅ Scoped:      ${results.scoped.length}`);
  console.log(`📋 Allowlisted: ${results.allowlisted.length}`);
  console.log(`❌ Missing:     ${results.missing.length}`);
  console.log(`⚠️  PHI pending: ${results.phiMissing.length}`);
  console.log(`Total:          ${files.length} route files\n`);

  if (results.allowlisted.length > 0) {
    console.log('Allow-list entries:');
    for (const { file, reason } of results.allowlisted) {
      console.log(`  ${file}: ${reason}`);
    }
    console.log('');
  }

  if (failures > 0) {
    console.error(`\n🚫 ${failures} route file(s) failed the scope check.`);
    process.exit(1);
  } else {
    console.log('✅ All route files pass the scope check.\n');
    process.exit(0);
  }
}

main();
