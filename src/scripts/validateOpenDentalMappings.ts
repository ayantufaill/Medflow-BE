import { prisma } from '../config/db';

const run = async () => {
  console.log('Validating OpenDental mappings...');

  const [
    statements,
    claims,
    procedureCodes,
    vitals,
    commlogs,
    asap,
    schedules,
    rxpats,
    labPanels,
    labResults,
    documents,
  ] = await Promise.all([
    prisma.statement.count({ where: { IsInvoice: 1 } }),
    prisma.claim.count({ where: { ClaimType: 'PreAuth' } }),
    prisma.procedurecode.count(),
    prisma.vitalsign.count(),
    prisma.commlog.count(),
    prisma.asapcomm.count(),
    prisma.schedule.count(),
    prisma.rxpat.count(),
    prisma.labpanel.count(),
    prisma.labresult.count(),
    prisma.document.count(),
  ]);

  console.log('Counts:');
  console.log({
    statements,
    claims,
    procedureCodes,
    vitals,
    commlogs,
    asap,
    schedules,
    rxpats,
    labPanels,
    labResults,
    documents,
  });

  const sampleStatement = await prisma.statement.findFirst({
    where: { IsInvoice: 1 },
    orderBy: { StatementNum: 'desc' },
  });
  if (sampleStatement) {
    console.log('Sample invoice statement:', {
      StatementNum: sampleStatement.StatementNum.toString(),
      PatNum: sampleStatement.PatNum?.toString() ?? null,
      ShortGUID: sampleStatement.ShortGUID,
      BalTotal: sampleStatement.BalTotal,
      InsEst: sampleStatement.InsEst,
    });
  }

  const sampleClaim = await prisma.claim.findFirst({
    where: { ClaimType: 'PreAuth' },
    orderBy: { ClaimNum: 'desc' },
  });
  if (sampleClaim) {
    console.log('Sample estimate claim:', {
      ClaimNum: sampleClaim.ClaimNum.toString(),
      PatNum: sampleClaim.PatNum?.toString() ?? null,
      ClaimStatus: sampleClaim.ClaimStatus,
      PreAuthString: sampleClaim.PreAuthString,
      ClaimFee: sampleClaim.ClaimFee,
    });
  }

  const sampleProc = await prisma.procedurecode.findFirst({
    orderBy: { ProcCode: 'asc' },
  });
  if (sampleProc) {
    console.log('Sample procedure code:', {
      CodeNum: sampleProc.CodeNum?.toString() ?? null,
      ProcCode: sampleProc.ProcCode,
      Descript: sampleProc.Descript,
    });
  }

  const sampleVital = await prisma.vitalsign.findFirst({
    orderBy: { VitalsignNum: 'desc' },
  });
  if (sampleVital) {
    console.log('Sample vitals:', {
      VitalsignNum: sampleVital.VitalsignNum.toString(),
      PatNum: sampleVital.PatNum?.toString() ?? null,
      DateTaken: sampleVital.DateTaken,
    });
  }

  const sampleCommlog = await prisma.commlog.findFirst({
    orderBy: { CommlogNum: 'desc' },
  });
  if (sampleCommlog) {
    console.log('Sample commlog:', {
      CommlogNum: sampleCommlog.CommlogNum.toString(),
      PatNum: sampleCommlog.PatNum?.toString() ?? null,
      CommDateTime: sampleCommlog.CommDateTime,
    });
  }

  console.log('Validation complete.');
};

run()
  .catch((error) => {
    console.error('Validation failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
