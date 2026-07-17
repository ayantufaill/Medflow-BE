import { prisma } from '../src/config/db';

async function main() {
  const patients = await prisma.patient.findMany({
    select: {
      PatNum: true,
      FName: true,
      LName: true,
      DateTStamp: true,
      PatStatus: true
    },
    orderBy: {
      DateTStamp: 'desc'
    }
  });

  console.log('List of patients sorted by DateTStamp desc:');
  patients.forEach((p) => {
    console.log(`PatNum: ${p.PatNum.toString()} | Name: ${p.FName} ${p.LName} | DateTStamp: ${p.DateTStamp?.toISOString() ?? 'null'} | Status: ${p.PatStatus}`);
  });
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
