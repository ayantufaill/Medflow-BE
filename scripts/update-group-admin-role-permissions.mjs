import pg from 'pg';

const permissions = {
  'clinical.cross_branch.view': true,
  'patients.read': true,
  'patients.create': true,
  'patients.update': true,
  'appointments.read': true,
  'appointments.create': true,
  'appointments.update': true,
  'appointments.delete': true,
  'appointments.schedule': true,
  'appointments.cancel': true,
  'clinical-notes.read': true,
  'clinical-notes.create': true,
  'clinical-notes.update': true,
  'clinical-notes.sign': true,
  'vital-signs.read': true,
  'vital-signs.create': true,
  'vital-signs.update': true,
  'prescriptions.read': true,
  'prescriptions.create': true,
  'prescriptions.update': true,
  'treatment-plans.read': true,
  'treatment-plans.create': true,
  'treatment-plans.update': true,
  'documents.read': true,
  'documents.create': true,
  'lab-orders.read': true,
  'lab-orders.create': true,
  'lab-orders.update': true,
  'lab-results.read': true,
  'referrals.read': true,
  'referrals.create': true,
  'referrals.update': true,
  'authorizations.read': true,
  'authorizations.create': true,
  'authorizations.update': true,
  'services.read': true,
  'insurance.read': true,
  'insurance.create': true,
  'insurance.update': true,
  'insurance.delete': true,
  'invoices.read': true,
  'invoices.create': true,
  'invoices.update': true,
  'invoices.delete': true,
  'invoices.process': true,
  'payments.read': true,
  'payments.create': true,
  'payments.update': true,
  'payments.delete': true,
  'payments.process': true,
  'claims.read': true,
  'claims.create': true,
  'claims.update': true,
  'claims.delete': true,
  'claims.process': true,
  'era.read': true,
  'era.create': true,
  'era.update': true,
  'era.delete': true,
  'era.process': true,
  'reports.read': true,
  'reports.financial': true,
  'reports.administrative': true,
  'group:view_analytics': true,
  'group:manage_users': true,
  'group:reassign_providers': true,
  'users.read': true,
  'users.create': true,
  'users.update': true,
  'reports.access': true,
  'reports.prod_income.all_providers': true,
  'security.audit.view': true,
  'sharing.manage': true,
  'branches.read': true,
  'branches.update': true,
  'practice-info.read': true,
  'practice-info.update': true,
};

const meta = {
  description: 'Multi-branch dental group administrator with operational access scoped to its practice group.',
  permissions,
  isSystemRole: true,
  isActive: true,
};

const connectionString =
  process.env.DIRECT_DATABASE_URL ||
  process.env.DATABASE_URL ||
  'postgresql://medflow:MedflowPass123!@localhost:5432/medflow_db';

const client = new pg.Client({ connectionString });

await client.connect();

const roleResult = await client.query(
  'select "UserGroupNum" from usergroup where "Description" = $1',
  ['Group Admin'],
);

if (roleResult.rowCount === 0) {
  throw new Error('Missing Group Admin role');
}

const roleId = roleResult.rows[0].UserGroupNum;
const valueString = JSON.stringify(meta);
const existing = await client.query(
  'select "UserOdPrefNum" from userodpref where "Fkey" = $1 and "FkeyType" = $2',
  [roleId, 200],
);

if (existing.rowCount > 0) {
  await client.query(
    'update userodpref set "ValueString" = $1 where "UserOdPrefNum" = $2',
    [valueString, existing.rows[0].UserOdPrefNum],
  );
} else {
  const nextId = await client.query(
    'select coalesce(max("UserOdPrefNum"), 0) + 1 as next from userodpref',
  );
  await client.query(
    'insert into userodpref ("UserOdPrefNum", "UserNum", "Fkey", "FkeyType", "ValueString") values ($1, null, $2, $3, $4)',
    [nextId.rows[0].next, roleId, 200, valueString],
  );
}

const verify = await client.query(
  'select "ValueString" from userodpref where "Fkey" = $1 and "FkeyType" = $2',
  [roleId, 200],
);
const saved = JSON.parse(verify.rows[0].ValueString);

console.log(JSON.stringify({
  roleId: String(roleId),
  permissionCount: Object.keys(saved.permissions || {}).length,
  hasPatientsRead: saved.permissions?.['patients.read'] === true,
  hasAppointmentsRead: saved.permissions?.['appointments.read'] === true,
  hasInvoicesRead: saved.permissions?.['invoices.read'] === true,
  hasClinicalCrossBranch: saved.permissions?.['clinical.cross_branch.view'] === true,
  hasWildcard: saved.permissions?.['*'] === true,
}, null, 2));

await client.end();
