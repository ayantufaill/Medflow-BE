import { prisma } from '../config/db';

async function check() {
  const schedules = await prisma.feesched.findMany();
  console.log('Schedules:', schedules);
}

check()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
