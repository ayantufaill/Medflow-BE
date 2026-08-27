import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const users = await prisma.userod.findMany();
  console.log(users.map(u => u.UserName));
}
main();
