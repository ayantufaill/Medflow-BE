import { prisma } from './src/config/db';

async function test() {
  const provs = await prisma.provider.findMany();
  console.log("All providers:");
  for (const p of provs) {
     console.log(p.ProvNum.toString(), p.FName, p.LName, p.Abbr);
  }
}

test().catch(console.error).finally(() => prisma.$disconnect());
