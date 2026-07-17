import { prisma } from '../src/config/db';

async function main() {
  const count = await prisma.provider.count();
  console.log(`Total providers in database: ${count}`);

  const providers = await prisma.provider.findMany({
    select: {
      ProvNum: true,
      FName: true,
      LName: true,
      Abbr: true
    },
    orderBy: {
      ProvNum: 'asc'
    }
  });

  console.log('List of providers:');
  providers.forEach((p) => {
    console.log(`ProvNum: ${p.ProvNum.toString()} - Name: ${p.FName} ${p.LName} (${p.Abbr})`);
  });
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
