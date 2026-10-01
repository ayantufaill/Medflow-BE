import { spawnSync } from 'node:child_process';
import path from 'node:path';

const bin = path.join(
  process.cwd(),
  'node_modules',
  '.bin',
  process.platform === 'win32' ? 'tsx.cmd' : 'tsx'
);

const scripts = [
  // Must come first: seedUsers attaches every account to ClinicNum 1 and
  // seedBranches links it, but nothing else creates it.
  'src/scripts/seedDefaultClinic.ts',
  'src/scripts/seedRoles.ts',
  'src/scripts/seedNewModelRoles.ts',
  'src/scripts/seedUsers.ts',
  'src/scripts/seedSpecialties.ts',
  'src/scripts/seedProviderSpecialties.ts',
  'src/scripts/seedAppointmentTypes.ts',
  'src/scripts/seedLanguages.ts',
  'src/scripts/seedInsuranceCompanies.ts',
  'src/scripts/seedPatients.ts',
  'src/scripts/seedProviders.ts',
  'src/scripts/seedOperatories.ts',
  'src/scripts/seedBranches.ts',
  'src/scripts/seedAssistants.ts',
  'src/scripts/seedAppointments.ts',
  'src/scripts/seedProcedureCodes.ts',
  'src/scripts/seedClaims.ts',
  'src/scripts/seedClinicalChecklists.ts',
  'src/scripts/seedMedications.ts',
  'src/scripts/seedClinicalManagement.ts',
  'src/scripts/seedClinicalProducts.ts',
  'src/scripts/seedFees.ts',
  'src/scripts/seedFormTemplates.ts',
  'src/scripts/seedRecareTypes.ts',
  // Two independent practice groups (Metro Dental Partners / Pacific Coast
  // Dental Care) with their own branches, staff and patients. Runs last so it
  // builds on the seeded roles; tests/client-demo-multitenant.test.ts asserts
  // directly against these fixtures.
  'src/scripts/seedClientDemoScenario.ts',
];

for (const script of scripts) {
  console.log(`Running seed script: ${script}...`);
  const result = spawnSync(bin, [script], { stdio: ['inherit', 'pipe', 'pipe'], shell: true });
  if (result.status !== 0) {
    console.error(`Script ${script} failed with status ${result.status}`);
    console.error(result.stderr?.toString());
    console.error(result.stdout?.toString());
    process.exit(result.status ?? 1);
  }
}

// Post-seed step: tag the patients that CAN be attributed to a branch, so the
// RLS policies (which key off patient.ClinicNum / GroupNum) can actually
// enforce branch isolation on freshly seeded data. Patients with no usable
// signal are left untagged — the backfill only ever assigns a branch that
// already appears on one of the patient's own appointments, never a guess.
//
// Runs last so it sees the full seeded dataset. Tolerates failure: an
// untagged patient degrades to "hidden behind the group boundary", which is
// the safe direction, whereas a hard failure would block the whole seed.
console.log('Running post-seed step: branch attribution for patients...');
const attribution = spawnSync(
  bin,
  ['src/scripts/backtestBranchPatients.ts', '--backfill-resolved', '--confirm'],
  { stdio: ['inherit', 'pipe', 'pipe'], shell: true }
);
if (attribution.status !== 0) {
  console.warn('⚠️  Branch attribution step did not complete; continuing.');
  console.warn(attribution.stderr?.toString());
}
