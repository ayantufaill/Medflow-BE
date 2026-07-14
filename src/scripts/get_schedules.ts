import { prisma } from '../config/db';

async function check() {
  const prefs = await prisma.userodpref.findMany({
    where: { FkeyType: 207 }
  });
  console.log('Prefs:', prefs.map(p => ({
    Fkey: p.Fkey?.toString() ?? null,
    FkeyType: p.FkeyType,
    ValueString: p.ValueString
  })));
}

check()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
