import { prisma } from '../config/db';
import { getNextId } from '../utils/opendental-ids.util';

const appointmentTypes = [
  { name: 'Consultation', color: 16777215 },
  { name: 'Cleaning', color: 16777215 },
  { name: 'Follow-up', color: 16777215 },
];

const seedAppointmentTypes = async () => {
  try {
    for (const type of appointmentTypes) {
      const existing = await prisma.appointmenttype.findFirst({
        where: { AppointmentTypeName: type.name },
      });
      if (!existing) {
        const nextId = await getNextId('appointmenttype', 'AppointmentTypeNum');
        await prisma.appointmenttype.create({
          data: {
            AppointmentTypeNum: nextId,
            AppointmentTypeName: type.name,
            AppointmentTypeColor: type.color,
            IsHidden: 0,
          },
        });
      }
    }
    console.log('Appointment types seeded successfully!');
  } catch (error) {
    console.error('Error seeding appointment types:', error);
  } finally {
    await prisma.$disconnect();
  }
};

seedAppointmentTypes();
