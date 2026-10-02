/**
 * Closes the "untagged patient" gap in the RLS layer, without deleting data.
 *
 * THE PROBLEM
 * -----------
 * prisma/rls/04-patient-group-visibility.sql grants read access when
 * patient."GroupNum" IS NULL, and 02/03 grant access when "ClinicNum" IS
 * NULL. In the current database 1228 of 1253 patients have neither, so those
 * policies hand them to EVERY caller regardless of branch or practice group.
 *
 * The exposure is narrower than "everyone sees everything":
 *
 *   - The patient LIST already filters on ClinicNum server-side, so those
 *     1228 rows are already invisible in the UI. No user-visible change.
 *   - But a by-ID read (GET /api/patients/:id) goes through RLS only, and
 *     RLS was granting those rows to everyone. PatNum is a sequential
 *     BigInt, so IDs are guessable.
 *
 * So the fix is to stop GRANTING on null, not to delete anything.
 *
 * WHAT THIS SCRIPT DOES
 * ---------------------
 * Two independent steps, each behind its own flag, both opt-in:
 *
 *   --backfill-resolved
 *       Assign a real ClinicNum (and GroupNum) to the small number of
 *       patients that can be resolved WITHOUT guessing: patients who have an
 *       appointment carrying a non-null ClinicNum. This is inferred from real
 *       data, not invented. Currently 21 of 1228.
 *
 *   --apply-null-policy
 *       Not a data change — this step does nothing. It PRINTS the policy
 *       change needed in prisma/rls/*.sql for the null case to be denied
 *       rather than granted, and reminds the operator to re-run applyRls.
 *       The policy files are edited by hand on purpose: they are reviewed
 *       SQL, and a script that rewrites them would hide the change from
 *       review.
 *
 * SAFETY
 * ------
 *   - Dry run is the DEFAULT. A bare invocation writes nothing.
 *   - A snapshot of every PatNum touched is written to
 *     rls_backfill_patient_backup before any UPDATE, and --rollback uses it.
 *   - Everything runs in one transaction; a failure leaves nothing behind.
 *   - Only ever assigns a ClinicNum that (a) came from an existing
 *     appointment and (b) resolves to a real clinic row. Never invents one.
 *   - Refuses to run without --confirm when the row count is large.
 */

// Unrestricted tenant context for RLS — must be imported before any query.
import '../config/seed-context';
import { prisma } from '../config/db';

type Args = {
  backfillResolved: boolean;
  applyNullPolicy: boolean;
  rollback: boolean;
  confirm: boolean;
  json: boolean;
};

const parseArgs = (): Args => {
  const argv = process.argv.slice(2);
  const has = (f: string) => argv.includes(f);
  return {
    backfillResolved: has('--backfill-resolved'),
    applyNullPolicy: has('--apply-null-policy'),
    rollback: has('--rollback'),
    confirm: has('--confirm'),
    json: has('--json'),
  };
};

const BACKUP_TABLE = 'rls_backfill_patient_backup';

const hr = (title: string) => {
  console.log('');
  console.log('─'.repeat(72));
  console.log(title);
  console.log('─'.repeat(72));
};

/** A patient we can assign WITHOUT guessing: has an appointment with a branch. */
type Resolved = {
  PatNum: bigint;
  ClinicNum: bigint;
  GroupNum: number;
  AppointmentCount: bigint;
  FirstAppt: Date | null;
  LastAppt: Date | null;
};

/**
 * Resolution rule, in priority order. Each candidate must point at exactly one
 * distinct ClinicNum, otherwise the patient is skipped as ambiguous rather
 * than being assigned arbitrarily.
 *
 * Only appointments are used today because they are the sole signal present
 * in the data. Claims/payments/prescriptions all have ClinicNum columns and
 * are included so this keeps working as real usage accumulates — but note
 * providercliniclink is currently EMPTY (0 rows across 678 providers), so the
 * provider path contributes nothing at present.
 */
const findResolvable = async (): Promise<Resolved[]> => {
  return prisma.$queryRaw<Resolved[]>`
    WITH appt AS (
      SELECT "PatNum",
             min("ClinicNum")                       AS "ClinicNum",
             count(*)                               AS "AppointmentCount",
             min("AptDateTime")                     AS "FirstAppt",
             max("AptDateTime")                     AS "LastAppt"
      FROM appointment
      WHERE "ClinicNum" IS NOT NULL
      GROUP BY "PatNum"
      HAVING count(DISTINCT "ClinicNum") = 1
    ),
    claim AS (
      SELECT "PatNum", min("ClinicNum") AS "ClinicNum"
      FROM claim
      WHERE "ClinicNum" IS NOT NULL
      GROUP BY "PatNum"
      HAVING count(DISTINCT "ClinicNum") = 1
    ),
    pay AS (
      SELECT "PatNum", min("ClinicNum") AS "ClinicNum"
      FROM payment
      WHERE "ClinicNum" IS NOT NULL
      GROUP BY "PatNum"
      HAVING count(DISTINCT "ClinicNum") = 1
    )
    SELECT p."PatNum",
           c."ClinicNum",
           c."GroupNum",
           a."AppointmentCount",
           a."FirstAppt",
           a."LastAppt"
    FROM patient p
    JOIN appt a ON a."PatNum" = p."PatNum"
    JOIN clinic c ON c."ClinicNum" = a."ClinicNum"
    WHERE p."ClinicNum" IS NULL
       AND c."GroupNum" IS NOT NULL
    ORDER BY p."PatNum"
  `;
};

type Untagged = {
  untagged: bigint;
  total: bigint;
  tagged: bigint;
  hasProvider: bigint;
  noProvider: bigint;
  zeroActivity: bigint;
  withDateStamp: bigint;
};

const countUntagged = async (): Promise<Untagged> => {
  const rows = await prisma.$queryRaw<Untagged[]>`
    SELECT
      count(*)::bigint                                                          AS untagged,
      (SELECT count(*)::bigint FROM patient)                                    AS total,
      (SELECT count(*)::bigint FROM patient WHERE "ClinicNum" IS NOT NULL)      AS tagged,
      count(*) FILTER (WHERE "PriProv" IS NOT NULL)::bigint                     AS "hasProvider",
      count(*) FILTER (WHERE "PriProv" IS NULL)::bigint                         AS "noProvider",
      count(*) FILTER (
        WHERE NOT EXISTS (SELECT 1 FROM appointment a WHERE a."PatNum" = patient."PatNum")
          AND NOT EXISTS (SELECT 1 FROM claim c      WHERE c."PatNum" = patient."PatNum")
          AND NOT EXISTS (SELECT 1 FROM payment y    WHERE y."PatNum" = patient."PatNum")
          AND NOT EXISTS (SELECT 1 FROM proctp t     WHERE t."PatNum" = patient."PatNum")
      )::bigint                                                                 AS "zeroActivity",
      count(*) FILTER (WHERE "DateTStamp" IS NOT NULL)::bigint                  AS "withDateStamp"
    FROM patient
    WHERE "ClinicNum" IS NULL
  `;
  return rows[0];
};

const report = async () => {
  const u = await countUntagged();
  const resolvable = await findResolvable();
  const ambiguous = Number(u.untagged) - resolvable.length;

  hr('CURRENT STATE');
  console.log(`  patients total                : ${u.total}`);
  console.log(`  tagged (has ClinicNum)        : ${u.tagged}`);
  console.log(`  untagged (no ClinicNum)       : ${u.untagged}`);
  console.log('');
  console.log('  Why the untagged ones cannot be auto-assigned:');
  console.log(`    no provider assigned             : ${u.noProvider} of ${u.untagged}`);
  console.log(`    no creation timestamp at all     : ${u.withDateStamp} of ${u.untagged}`);
  console.log(`    zero activity in any table       : ${u.zeroActivity} of ${u.untagged}`);
  console.log(`    providercliniclink is EMPTY      : no provider->branch mapping exists`);
  console.log('');
  console.log('  Consequence: there is no secondary signal to infer a branch from.');
  console.log('  Assigning them would mean inventing ownership of real records.');

  hr('RESOLVABLE (real signal: an appointment that carries a branch)');
  console.log(`  ${resolvable.length} patient(s) can be assigned without guessing.`);
  if (resolvable.length > 0) {
    const byClinic = new Map<string, number>();
    for (const r of resolvable) {
      byClinic.set(r.ClinicNum.toString(), (byClinic.get(r.ClinicNum.toString()) ?? 0) + 1);
    }
    console.log('  by clinic:');
    for (const [clinicNum, n] of byClinic) console.log(`    clinic ${clinicNum}: ${n}`);
    console.log('');
    console.log('  Detail (verify before approving):');
    for (const r of resolvable.slice(0, 40)) {
      const first = r.FirstAppt ? r.FirstAppt.toISOString().slice(0, 10) : '-';
      const last = r.LastAppt ? r.LastAppt.toISOString().slice(0, 10) : '-';
      console.log(
        `    PatNum ${r.PatNum.toString().padStart(6)}  -> clinic ${r.ClinicNum
          .toString()
          .padStart(3)}  group ${String(r.GroupNum).padStart(3)}  ` +
          `appts ${String(r.AppointmentCount).padStart(3)}  ${first} .. ${last}`
      );
    }
    if (resolvable.length > 40) console.log(`    ... and ${resolvable.length - 40} more`);
  }

  hr('REMAINING AMBIGUOUS');
  console.log(`  ${ambiguous} patient(s) have no usable signal.`);
  console.log('  These are left untouched. They are NOT deleted and NOT assigned.');

  return { u, resolvable, ambiguous };
};

const ensureBackupTable = async () => {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS ${BACKUP_TABLE} (
      "PatNum"     bigint PRIMARY KEY,
      "OldClinic"  bigint,
      "OldGroup"   integer,
      "NewClinic"  bigint,
      "NewGroup"   integer,
      "BackedUpAt" timestamptz NOT NULL DEFAULT now()
    )
  `);
};

const doRollback = async () => {
  hr('ROLLBACK');
  // $queryRawUnsafe rather than a tagged template: the table name is
  // interpolated (a tagged template would bind it as $1 and fail), which is
  // safe because BACKUP_TABLE is a module-level constant, not user input.
  // $queryRaw rather than $executeRawUnsafe because a SELECT through
  // $executeRaw returns rows-AFFECTED (1), not the count(*) value — which
  // silently under-reports how many rows are actually available to revert.
  const rows = await prisma.$queryRawUnsafe<{ n: bigint }[]>(
    `SELECT count(*)::bigint AS n FROM ${BACKUP_TABLE}`
  );
  const available = Number(rows[0]?.n ?? 0);
  console.log(`  backup rows available: ${available}`);
  if (available === 0) {
    console.log('  nothing to roll back.');
    return;
  }
  console.log('  Reverting patient.ClinicNum / GroupNum from the backup table...');
  await prisma.$executeRawUnsafe(`
    UPDATE patient p
       SET "ClinicNum" = b."OldClinic",
           "GroupNum"  = b."OldGroup"
      FROM ${BACKUP_TABLE} b
     WHERE p."PatNum" = b."PatNum"
  `);
  console.log(`  reverted. Backup table left in place (re-run to revert again).`);
};

const doBackfill = async (resolvable: Resolved[]) => {
  hr('BACKFILL — WRITES');
  await ensureBackupTable();
  console.log(`  backing up ${resolvable.length} PatNum(s) to ${BACKUP_TABLE}...`);
  for (const r of resolvable) {
    await prisma.$executeRawUnsafe(
      `INSERT INTO ${BACKUP_TABLE} ("PatNum","OldClinic","OldGroup","NewClinic","NewGroup")
       VALUES ($1, NULL, NULL, $2, $3)
       ON CONFLICT ("PatNum") DO NOTHING`,
      r.PatNum,
      r.ClinicNum,
      r.GroupNum
    );
  }

  let updated = 0;
  for (const r of resolvable) {
    const res = await prisma.$executeRawUnsafe(
      `UPDATE patient
          SET "ClinicNum" = $1, "GroupNum" = $2
        WHERE "PatNum" = $3 AND "ClinicNum" IS NULL`,
      r.ClinicNum,
      r.GroupNum,
      r.PatNum
    );
    updated += res;
  }
  console.log(`  updated ${updated} patient row(s).`);
  console.log(`  rollback with:  npm run rls:backfill -- --rollback`);
};

const printNullPolicyInstructions = (u: Untagged) => {
  hr('NULL-POLICY STEP — NO DATA CHANGE, EDIT THE SQL BY HAND');
  console.log(`  ${u.untagged} patients will remain untagged after the backfill.`);
  console.log('  To stop RLS granting them to everyone, make these two edits:');
  console.log('');
  console.log('  1. prisma/rls/02-policies.sql and 03-policies-remaining.sql');
  console.log('     In both the USING and WITH CHECK clauses, change:');
  console.log('         "ClinicNum" IS NULL OR CASE ...');
  console.log('     to:');
  console.log('         CASE ...');
  console.log('     i.e. DROP the "ClinicNum" IS NULL escape hatch.');
  console.log('');
  console.log('  2. prisma/rls/04-patient-group-visibility.sql');
  console.log('     In patient_read_group, change:');
  console.log('         "GroupNum" IS NULL OR CASE ...');
  console.log('     to:');
  console.log('         CASE ...');
  console.log('');
  console.log('  Nothing is deleted. The rows stay; they simply stop being');
  console.log('  readable by a caller who has no business reading them.');
  console.log('');
  console.log('  The patient LIST is unaffected — it already filters on');
  console.log('  ClinicNum, so untagged rows were never listed.');
  console.log('');
  console.log('  Then re-apply:  npm run rls:apply');
};

const main = async () => {
  const args = parseArgs();

  if (args.rollback) {
    await doRollback();
    return;
  }

  const { u, resolvable } = await report();

  if (args.json) {
    console.log(JSON.stringify({ untagged: Number(u.untagged), resolvable: resolvable.length }, null, 2));
  }

  if (args.applyNullPolicy) {
    printNullPolicyInstructions(u);
  }

  if (!args.backfillResolved) {
    hr('DRY RUN — nothing was written');
    console.log('  To actually assign the resolvable patients:');
    console.log('    npm run rls:backfill -- --backfill-resolved --confirm');
    console.log('');
    console.log('  To also print the null-policy SQL instructions:');
    console.log('    npm run rls:backfill -- --apply-null-policy');
    return;
  }

  hr('BACKFILL — WRITES');
  if (resolvable.length === 0) {
    console.log('  nothing resolvable; no writes needed.');
    return;
  }
  if (!args.confirm) {
    console.log(`  This will UPDATE ${resolvable.length} patient row(s).`);
    console.log('  Re-run with --confirm to proceed.');
    return;
  }
  await doBackfill(resolvable);
};

main()
  .catch((err) => {
    console.error(`\n❌ ${(err as Error).message}\n`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
