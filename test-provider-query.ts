import { prisma } from './src/config/db';

async function test() {
  const itemProvider = "Sarah Mitchell";
  const nameParts = itemProvider.trim().split(' ');
  const lastName = nameParts[nameParts.length - 1];
  console.log("Searching for LName:", lastName);
  try {
     const prov = await prisma.provider.findFirst({ where: { LName: { contains: lastName, mode: 'insensitive' } } });
     console.log("Found:", prov);
  } catch (e: any) {
     console.error("Error:", e.message);
  }
}

test().catch(console.error).finally(() => prisma.$disconnect());
