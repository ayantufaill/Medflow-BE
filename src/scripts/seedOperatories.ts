import { prisma } from '../config/db';
import { getNextId } from '../utils/opendental-ids.util';
import { tenantContextStorage } from '../config/tenant-context';

async function main() {
  console.log('Seeding Operatories...');

  const operatories = [
    { name: 'Op1', abbrev: 'Op1', order: 1 },
    { name: 'Op2', abbrev: 'Op2', order: 2 },
    { name: 'Op3', abbrev: 'Op3', order: 3 },
    { name: 'Op4', abbrev: 'Op4', order: 4 },
    { name: 'Op5', abbrev: 'Op5', order: 5 },
  ];

  for (const op of operatories) {
    // Try to find if an operatory with this name already exists
    const existingOp = await prisma.operatory.findFirst({
      where: { OpName: op.name }
    });

    if (existingOp) {
      console.log(`Operatory ${op.name} already exists. Skipping...`);
    } else {
      // getNextId (medflow_sequences-backed) rather than a raw MAX(OperatoryNum)+1
      // query — the latter isn't safe against IDs created by other seed/app code
      // between the SELECT and this INSERT and was observed to collide (P2002).
      const nextId = await getNextId('operatory', 'OperatoryNum');
      await prisma.operatory.create({
        data: {
          OperatoryNum: nextId,
          OpName: op.name,
          Abbrev: op.abbrev,
          ItemOrder: op.order,
          IsHidden: 0,
          IsHygiene: 0,
          SetProspective: 0,
          IsWebSched: 0,
          IsNewPatAppt: 0
        }
      });
      console.log(`Created operatory: ${op.name}`);
    }
  }

  console.log('Finished seeding operatories.');
}

// operatory is RLS-scoped by ClinicNum. A standalone script has no
// AsyncLocalStorage tenant context, so without this the existing-row lookup
// above would only ever see NULL-ClinicNum rows (RLS hides the real Op1–5),
// making every run think they don't exist and create duplicates — the '*'
// wildcard is the same bypass a true system Admin gets, not a way around RLS.
tenantContextStorage.run({ clinicIds: '*' }, () => main())
  .catch((e) => {
    console.error('Error seeding operatories:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
