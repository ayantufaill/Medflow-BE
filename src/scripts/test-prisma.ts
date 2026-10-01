import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  await prisma.role_permission.upsert({
    where: {
      role_id_permission_key: {
        role_id: 1n,
        permission_key: 'test',
      },
    },
    update: {},
    create: {
      role_id: 1n,
      permission_key: 'test',
    },
  });
}
