import { spawnSync } from 'node:child_process';
import path from 'node:path';

const bin = path.join(
  process.cwd(),
  'node_modules',
  '.bin',
  process.platform === 'win32' ? 'tsx.cmd' : 'tsx'
);

const scripts = [
  'src/scripts/seedRoles.ts',
  'src/scripts/seedUsers.ts',
  'src/scripts/seedSpecialties.ts',
  'src/scripts/seedProviderSpecialties.ts',
  'src/scripts/seedAppointmentTypes.ts',
  'src/scripts/seedLanguages.ts',
  'src/scripts/seedInsuranceCompanies.ts',
  'src/scripts/seedPatients.ts',
  'src/scripts/seedProviders.ts',
  'src/scripts/seedAssistants.ts',
  'src/scripts/seedAppointments.ts',
  'src/scripts/seedProcedureCodes.ts',
  'src/scripts/seedClaims.ts',
  'src/scripts/seedClinicalChecklists.ts',
  'src/scripts/seedMedications.ts',
  'src/scripts/seedOperatories.ts',
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
