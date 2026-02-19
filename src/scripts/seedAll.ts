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
];

for (const script of scripts) {
  const result = spawnSync(bin, [script], { stdio: 'inherit' });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}
