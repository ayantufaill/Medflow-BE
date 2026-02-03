import { prisma } from '../config/db';

const deleteToothPlantingServices = async () => {
  try {
    await prisma.procedurecode.deleteMany({
      where: { Descript: { contains: 'tooth planting', mode: 'insensitive' } },
    });
    console.log('Tooth planting services deleted successfully!');
  } catch (error) {
    console.error('Error deleting services:', error);
  } finally {
    await prisma.$disconnect();
  }
};

deleteToothPlantingServices();
