import { prisma } from '../src/config/db';

async function main() {
  const count = await prisma.operatory.count();
  console.log(`Total operatories in database: ${count}`);

  const operatories = await prisma.operatory.findMany({
    orderBy: {
      OperatoryNum: 'asc'
    }
  });

  console.log('List of operatories:');
  operatories.forEach((op) => {
    console.log(`OperatoryNum: ${op.OperatoryNum.toString()} - Name: ${op.OpName} - Abbr: ${op.Abbr}`);
  });
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
