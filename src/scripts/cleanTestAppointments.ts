import { prisma } from '../config/db';

async function cleanSpecificAppointment(aptNum: number) {
  console.log(`Starting cleanup of appointment ${aptNum}...`);
  
  try {
    // Delete dependent records first if they exist for this specific appointment
    // examperiodontal, procedurelog, labcase etc.
    try {
      await prisma.examperiodontal.deleteMany({ where: { AptNum: BigInt(aptNum) } });
    } catch (e) {}

    try {
      await prisma.procedurelog.deleteMany({ where: { AptNum: BigInt(aptNum) } });
    } catch (e) {}

    try {
      await prisma.labcase.deleteMany({ where: { AptNum: BigInt(aptNum) } });
    } catch (e) {}

    // Finally delete the appointment
    const result = await prisma.appointment.delete({
      where: { AptNum: BigInt(aptNum) }
    });

    console.log(`Successfully deleted appointment ${result.AptNum}.`);
  } catch (error: any) {
    if (error.code === 'P2025') {
      console.log(`Appointment ${aptNum} does not exist. Nothing to delete.`);
    } else {
      console.error(`Error deleting appointment ${aptNum}:`, error);
    }
  } finally {
    await prisma.$disconnect();
  }
}

cleanSpecificAppointment(252);
