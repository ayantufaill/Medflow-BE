import 'dotenv/config';
import fs from 'node:fs';
import { prisma } from '../config/db';
import { normalizeIcd10Code } from '../utils/icd10.util';

interface Entry { code: string; description: string; page: number }
interface Dataset { source: { filename: string; effectiveDate: string; sha256: string; pages: number }; entries: Entry[] }

async function main() {
  const args = new Set(process.argv.slice(2));
  if ([...args].some(arg => !['--apply', '--dry-run'].includes(arg)) || (args.has('--apply') && args.has('--dry-run'))) {
    throw new Error('Usage: npm run seed:icd10 -- [--dry-run | --apply]');
  }
  const dataset: Dataset = JSON.parse(fs.readFileSync(new URL('../data/icd10-pdf-data.json', import.meta.url), 'utf8'));
  const seen = new Set<string>();
  for (const entry of dataset.entries) {
    const code = normalizeIcd10Code(entry.code);
    if (!code || code !== entry.code || !entry.description.trim() || entry.description.length > 255 || seen.has(code)) {
      throw new Error(`Dataset record requires review: ${entry.code} (PDF page ${entry.page})`);
    }
    seen.add(code);
  }
  // Preserve any existing records and descriptions, including newer editions.
  const existing = await prisma.icd10.findMany({ select: { Icd10Code: true, Description: true } });
  const byCode = new Map(existing.filter(row => row.Icd10Code).map(row => [normalizeIcd10Code(row.Icd10Code), row]));
  const pending = dataset.entries.filter(entry => !byCode.has(entry.code));
  const conflicts = dataset.entries.filter(entry => byCode.has(entry.code) && byCode.get(entry.code)?.Description !== entry.description);
  let created = 0;
  if (args.has('--apply')) {
    for (let offset = 0; offset < pending.length; offset += 1000) {
      const batch = pending.slice(offset, offset + 1000);
      created += await prisma.$transaction(async tx => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('medflow:seed:icd10'))`;
        const maximum = await tx.icd10.aggregate({ _max: { Icd10Num: true } });
        const size = BigInt(batch.length);
        const end = (maximum._max.Icd10Num ?? 0n) + size;
        const allocation = await tx.$queryRaw<Array<{ next_id: bigint }>>`
          INSERT INTO medflow_sequences (table_name, next_id) VALUES ('icd10', ${end})
          ON CONFLICT (table_name) DO UPDATE
          SET next_id = GREATEST(medflow_sequences.next_id + ${size}, ${end})
          RETURNING next_id
        `;
        const start = BigInt(allocation[0].next_id) - size + 1n;
        const result = await tx.icd10.createMany({
          data: batch.map((entry, index) => ({ Icd10Num: start + BigInt(index), Icd10Code: entry.code, Description: entry.description })),
          skipDuplicates: true,
        });
        return result.count;
      });
    }
  }
  console.log(JSON.stringify({
    mode: args.has('--apply') ? 'apply' : 'dry-run', source: dataset.source,
    records: dataset.entries.length, existing: dataset.entries.length - pending.length,
    pending: pending.length, created, preservedDescriptionConflicts: conflicts.length,
    conflictCodes: conflicts.slice(0, 20).map(entry => entry.code),
  }, null, 2));
}
main().catch(error => { console.error(error.message); process.exitCode = 1; }).finally(() => prisma.$disconnect());
