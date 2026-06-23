import { prisma } from '../config/db';

async function printMaxPatNum() {
  const maxPatient = await prisma.patient.findFirst({
    orderBy: {
      PatNum: 'desc',
    },
  });

  if (maxPatient) {
    console.log(`Max PatNum: ${maxPatient.PatNum.toString()}`);
    console.log(`Expected Next Patient Code: PAT${(maxPatient.PatNum + 1n).toString().padStart(3, '0')}`);
  } else {
    console.log('No patients found.');
    console.log('Expected Next Patient Code: PAT001');
  }
}

printMaxPatNum()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
