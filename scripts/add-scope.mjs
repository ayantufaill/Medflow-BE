import { readFileSync, writeFileSync } from 'fs';

const files = [
  "src/routes/admin-finance.routes.ts",
  "src/routes/ai-conversation.routes.ts",
  "src/routes/audience.routes.ts",
  "src/routes/clinical-exam.routes.ts",
  "src/routes/clinical-management.routes.ts",
  "src/routes/document.routes.ts",
  "src/routes/lab-case.routes.ts",
  "src/routes/notification.routes.ts",
  "src/routes/ocr.routes.ts",
  "src/routes/patient-image.route.ts",
  "src/routes/patient-membership.routes.ts",
  "src/routes/patient-referral.routes.ts",
  "src/routes/patient-report.routes.ts",
  "src/routes/payment-terminal.routes.ts",
  "src/routes/productivity.routes.ts",
  "src/routes/progress-note.routes.ts",
  "src/routes/timeclock.routes.ts",
  "src/routes/treatment-plan.routes.ts"
];

for (const file of files) {
  let content = readFileSync(file, 'utf-8');
  
  if (!content.includes('resolveBranchAccess')) {
    // Add import
    content = content.replace(
      /import { authenticate } from '..\/middleware\/auth.middleware';/,
      `import { authenticate } from '../middleware/auth.middleware';\nimport { resolveBranchAccess, enterTenantContext } from '../middleware/tenant.middleware';`
    );
    
    // Replace router.use
    if (content.includes('router.use(authenticate);')) {
      content = content.replace(
        'router.use(authenticate);',
        'router.use(authenticate, resolveBranchAccess, enterTenantContext);'
      );
    } else {
      // For per-route, replace authenticate, with authenticate, resolveBranchAccess, enterTenantContext,
      content = content.replace(
        /authenticate,\n/g,
        'authenticate,\n  resolveBranchAccess,\n  enterTenantContext,\n'
      );
      content = content.replace(
        /authenticate, /g,
        'authenticate, resolveBranchAccess, enterTenantContext, '
      );
    }
    
    writeFileSync(file, content, 'utf-8');
    console.log(`Updated ${file}`);
  }
}
