import { prisma } from '../src/config/db';

async function main() {
  const count = await prisma.patient.count();
  console.log(`Total patients in database: ${count}`);

  const patients = await prisma.patient.findMany({
    select: {
      PatNum: true,
      FName: true,
      LName: true
    },
    orderBy: {
      PatNum: 'asc'
    }
  });

  console.log('List of patients:');
  patients.forEach((p) => {
    console.log(`PatNum: ${p.PatNum.toString()} - Name: ${p.FName} ${p.LName}`);
  });
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
