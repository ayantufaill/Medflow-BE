const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
prisma.procbutton.findMany({ include: { procbuttonitem: true } })
  .then(res => {
    console.log(JSON.stringify(res, null, 2));
    return prisma.$disconnect();
  });
