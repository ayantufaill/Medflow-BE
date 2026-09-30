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
  
  content = content.replace(
    "import { resolveBranchAccess, enterTenantContext } from '../middleware/tenant.middleware';",
    "import { resolveBranchAccess } from '../middleware/branchAccess.middleware';\nimport { enterTenantContext } from '../middleware/tenantContext.middleware';"
  );
  
  // also fix if the script missed the import because it searched for 'import { authenticate } from '../middleware/auth.middleware';' which might have been modified.
  if (!content.includes('import { resolveBranchAccess }')) {
    content = content.replace(
      "import { authenticate } from '../middleware/auth.middleware';",
      "import { authenticate } from '../middleware/auth.middleware';\nimport { resolveBranchAccess } from '../middleware/branchAccess.middleware';\nimport { enterTenantContext } from '../middleware/tenantContext.middleware';"
    );
  }
  
  writeFileSync(file, content, 'utf-8');
  console.log(`Updated ${file}`);
}
