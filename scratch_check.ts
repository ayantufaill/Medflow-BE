import { prisma } from './src/config/db';

async function check() {
  const appts = await prisma.appointment.findMany({
    orderBy: { AptNum: 'desc' },
    take: 10,
    include: { patient: true }
  });
  console.log('=== Recent Appointments ===');
  for (const a of appts) {
    console.log({
      AptNum: a.AptNum.toString(),
      PatNum: a.PatNum?.toString(),
      patientName: a.patient ? a.patient.FName + ' ' + a.patient.LName : 'Unknown',
      AptDateTime: a.AptDateTime,
      ProcDescript: a.ProcDescript
    });
  }

  const procs = await prisma.procedurelog.findMany({
    orderBy: { ProcNum: 'desc' },
    take: 10
  });
  console.log('=== Recent Procedures ===');
  for (const p of procs) {
    console.log({
      ProcNum: p.ProcNum.toString(),
      PatNum: p.PatNum?.toString(),
      AptNum: p.AptNum?.toString(),
      StatementNum: p.StatementNum?.toString(),
      ProcFee: p.ProcFee,
      BillingNote: p.BillingNote
    });
  }

  const stmts = await prisma.statement.findMany({
    orderBy: { StatementNum: 'desc' },
    take: 5
  });
  console.log('=== Recent Statements ===');
  for (const s of stmts) {
    console.log({
      StatementNum: s.StatementNum.toString(),
      PatNum: s.PatNum?.toString(),
      ShortGUID: s.ShortGUID,
      BalTotal: s.BalTotal,
      NoteBold: s.NoteBold
    });
  }

  const payments = await prisma.payment.findMany({
    orderBy: { PayNum: 'desc' },
    take: 5,
    include: { paysplit: true }
  });
  console.log('=== Recent Payments ===');
  for (const p of payments) {
    console.log({
      PayNum: p.PayNum.toString(),
      PatNum: p.PatNum?.toString(),
      PayAmt: p.PayAmt,
      PayNote: p.PayNote,
      paysplits: p.paysplit?.map(ps => ({
        SplitNum: ps.SplitNum.toString(),
        ProcNum: ps.ProcNum?.toString(),
        SplitAmt: ps.SplitAmt
      }))
    });
  }
}

check().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
