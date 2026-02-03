import { prisma } from '../config/db';
import { getNextId } from '../utils/opendental-ids.util';

const companies = [
  { name: 'Sample Insurance', phone: '0000000000' },
];

const seedInsuranceCompanies = async () => {
  try {
    for (const company of companies) {
      const existing = await prisma.carrier.findFirst({
        where: { CarrierName: company.name },
      });
      if (!existing) {
        const nextId = await getNextId('carrier', 'CarrierNum');
        await prisma.carrier.create({
          data: {
            CarrierNum: nextId,
            CarrierName: company.name,
            Phone: company.phone,
            IsHidden: 0,
          },
        });
      }
    }
    console.log('Insurance companies seeded successfully!');
  } catch (error) {
    console.error('Error seeding insurance companies:', error);
  } finally {
    await prisma.$disconnect();
  }
};

seedInsuranceCompanies();
