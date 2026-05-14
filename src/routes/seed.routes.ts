import { Router, type Request, type Response } from 'express';
import { execSync } from 'child_process';

const router = Router();

router.get('/ping', (_req: Request, res: Response) => {
  res.json({ deployed: true, version: 'no-auth-v2', ts: new Date().toISOString() });
});

router.post('/run', (_req: Request, res: Response) => {
  try {
    const output = execSync('node dist/scripts/seedRoles.js && node dist/scripts/seedUsers.js && node dist/scripts/seedSpecialties.js && node dist/scripts/seedProviderSpecialties.js && node dist/scripts/seedAppointmentTypes.js && node dist/scripts/seedLanguages.js && node dist/scripts/seedInsuranceCompanies.js && node dist/scripts/seedPatients.js && node dist/scripts/seedProviders.js && node dist/scripts/seedAssistants.js && node dist/scripts/seedAppointments.js', {
      timeout: 120000,
      encoding: 'utf8',
      env: { ...process.env },
    });
    console.log('[seed-endpoint] output:', output);
    res.json({ success: true, output });
  } catch (err: any) {
    console.error('[seed-endpoint] error:', err.message);
    res.status(500).json({ success: false, error: err.message, stdout: err.stdout, stderr: err.stderr });
  }
});

export default router;
