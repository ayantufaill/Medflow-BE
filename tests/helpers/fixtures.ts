import { prisma } from '../../src/config/db';

/**
 * The seeded Default Clinic (src/scripts/seedDefaultClinic.ts), which every
 * seeded staff account — including the admin the tests log in as — belongs to.
 *
 * Fixtures have to be tagged with it: the branch-scoped services filter on
 * `ClinicNum: { in: callerClinicIds }` (see src/services/patient.service.ts and
 * room.service.ts), so a record created with no clinic is invisible to every
 * caller and the "create it, then find it in the list" tests never see it.
 */
export const DEFAULT_TEST_CLINIC_NUM = 1n;

let defaultClinicGroupNum: number | null | undefined;

/** clinic 1's practicegroup, for patient.GroupNum (group-read visibility). */
const getDefaultClinicGroupNum = async (): Promise<number | null> => {
  if (defaultClinicGroupNum === undefined) {
    const clinic = await prisma.clinic.findUnique({
      where: { ClinicNum: DEFAULT_TEST_CLINIC_NUM },
      select: { GroupNum: true },
    });
    defaultClinicGroupNum = clinic?.GroupNum ?? null;
  }
  return defaultClinicGroupNum;
};

const isUniqueConstraintError = (error: unknown) =>
  Boolean(error && typeof error === 'object' && (error as any).code === 'P2002');

const nextUniqueId = (() => {
  let counter = 0n;
  const pidShard = BigInt(process.pid % 1000);
  return () => {
    counter = (counter + 1n) % 1000n;
    const nowSeconds = BigInt(Math.floor(Date.now() / 1000));
    // Stay within Number.MAX_SAFE_INTEGER to avoid driver precision issues.
    return nowSeconds * 1_000_000n + pidShard * 1_000n + counter;
  };
})();

const withUniqueRetry = async <T>(fn: () => Promise<T>, attempts = 5): Promise<T> => {
  let lastError: unknown;
  for (let i = 0; i < attempts; i += 1) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (!isUniqueConstraintError(error)) {
        throw error;
      }
    }
  }
  throw lastError;
};

export const createPatientRecord = async (token: string) =>
  withUniqueRetry(async () => {
    const PatNum = nextUniqueId();
    return prisma.patient.create({
      data: {
        PatNum,
        FName: `Test${token}`,
        LName: 'User',
        Birthdate: new Date('1990-01-01'),
        PatStatus: 0,
        ClinicNum: DEFAULT_TEST_CLINIC_NUM,
        GroupNum: await getDefaultClinicGroupNum(),
      },
    });
  });

/**
 * Deletes a fixture patient and the rows that hold a foreign key to it.
 *
 * WHY A HELPER AND NOT `prisma.patient.delete`
 * --------------------------------------------
 * Two tables reference `patient` and are written as a SIDE EFFECT of normal
 * API traffic, so a test that merely reads its own patient through the API can
 * no longer delete it:
 *
 *   securitylog   every patient read is audited (PermType 1051, the PHI
 *                 access audit), as are the coordination-of-benefits
 *                 decisions (1060-1069). securityloghash chains off it, so
 *                 that goes first.
 *   famaging      aging rows, written by agingService whenever a balance is
 *                 recalculated.
 *
 * Neither is something a test asks for, which is why the failure shows up in
 * teardown as `fk_securitylog_2_PatNum` / `fk_famaging_1_PatNum` long after
 * the assertions have already passed — the test is green and reported red.
 *
 * This mirrors what src/scripts/deleteTestPatients.ts already does for the
 * same reason (see its step 14d); it is not a new policy, just the same one
 * available to tests.
 *
 * Deleting audit rows is acceptable ONLY because these are fixture patients in
 * a disposable database. Never do this to real patient data: the chain in
 * securityloghash is what makes the audit tamper-evident.
 */
export const deletePatientRecord = async (patNum: bigint) => {
  await prisma.securityloghash.deleteMany({
    where: { securitylog: { PatNum: patNum } },
  });
  await prisma.securitylog.deleteMany({ where: { PatNum: patNum } });
  // Raw SQL: `famaging` is declared in schema.prisma but has no primary key,
  // so Prisma does not expose it on the client (`prisma.famaging` is
  // undefined). aging.service.ts writes it with raw SQL for the same reason.
  await prisma.$executeRawUnsafe(`DELETE FROM famaging WHERE "PatNum" = $1`, patNum);
  await prisma.patient.deleteMany({ where: { PatNum: patNum } });
};

export const createProviderRecord = async (token: string) => {
  const ProvNum = nextUniqueId();
  return prisma.provider.create({
    data: {
      ProvNum,
      FName: 'Test',
      LName: `Provider${token}`,
      Abbr: `TP${token.replace(/[^A-Za-z0-9]/g, '').slice(-4)}`,
      IsHidden: 0,
    },
  });
};

export const createAppointmentRecord = async (options: {
  patientId: bigint;
  providerId: bigint;
  token: string;
  date?: Date;
}) => {
  const AptNum = nextUniqueId();
  const aptDateTime = options.date ?? new Date();
  return prisma.appointment.create({
    data: {
      AptNum,
      PatNum: options.patientId,
      ProvNum: options.providerId,
      AptDateTime: aptDateTime,
      Pattern: '30',
      ProcDescript: `Complaint ${options.token}`,
      Note: `Note ${options.token}`,
      AptStatus: 0,
    },
  });
};

export const createAppointmentTypeRecord = async (token: string) =>
  withUniqueRetry(async () => {
    const AppointmentTypeNum = nextUniqueId();
    return prisma.appointmenttype.create({
      data: {
        AppointmentTypeNum,
        AppointmentTypeName: `AAA Test Appointment ${token}`,
        IsHidden: 0,
        RequiredProcCodesNeeded: 0,
      },
    });
  });

export const createRoomRecord = async (token: string) =>
  withUniqueRetry(async () => {
    const OperatoryNum = nextUniqueId();
    return prisma.operatory.create({
      data: {
        OperatoryNum,
        OpName: `AAA Room ${token}`,
        Abbrev: `AR${token.replace(/[^A-Za-z0-9]/g, '').slice(-4)}`,
        IsHidden: 0,
        ClinicNum: DEFAULT_TEST_CLINIC_NUM,
      },
    });
  });

export const createCarrierRecord = async (token: string) =>
  withUniqueRetry(async () => {
    const CarrierNum = nextUniqueId();
    const electId = `EL-${token}`.replace(/[^A-Za-z0-9]/g, '').slice(0, 20);
    return prisma.carrier.create({
      data: {
        CarrierNum,
        CarrierName: `Test Insurance ${token}`,
        ElectID: electId,
        IsHidden: 0,
      },
    });
  });

export const createNoteTemplateRecord = async (token: string) =>
  withUniqueRetry(async () => {
    const AutoNoteNum = nextUniqueId();
    return prisma.autonote.create({
      data: {
        AutoNoteNum,
        AutoNoteName: `Test Template ${token}`,
        MainText: JSON.stringify({
          description: 'Test template',
          templateStructure: { sections: [] },
          isActive: true,
        }),
      },
    });
  });

export const createProcedureCodeRecord = async (token: string) =>
  withUniqueRetry(async () => {
    const CodeNum = nextUniqueId();
    const cleaned = token.replace(/[^A-Za-z0-9]/g, '');
    const ProcCode = `T${cleaned.slice(-8).toUpperCase() || 'TEST'}`;
    return prisma.procedurecode.create({
      data: {
        CodeNum,
        ProcCode,
        Descript: `Test Service ${token}`,
        AbbrDesc: `Test ${token}`.slice(0, 50),
        BypassGlobalLock: 0,
        NoBillIns: 0,
      },
    });
  });

export const createDocumentRecord = async (options: {
  patientId: bigint;
  token: string;
}) =>
  withUniqueRetry(async () => {
    const DocNum = nextUniqueId();
    return prisma.document.create({
      data: {
        DocNum,
        PatNum: options.patientId,
        Description: `Test Document ${options.token}`,
        Note: JSON.stringify({
          documentType: 'other',
          description: 'Test document description',
        }),
        DateCreated: new Date(),
      },
    });
  });

export const createInvoiceStatement = async (options: {
  patientId: bigint;
  token: string;
}) =>
  withUniqueRetry(async () => {
    const StatementNum = nextUniqueId();
    const now = new Date();
    const shortGuid = `INV-${options.token}`.slice(0, 30);

    return prisma.statement.create({
      data: {
        StatementNum,
        PatNum: options.patientId,
        DateSent: now,
        BalTotal: 100,
        ShortGUID: shortGuid,
        IsInvoice: 1,
        StatementType: 'draft',
        NoteBold: JSON.stringify({ status: 'draft' }),
      },
    });
  });

export const createPaymentRecord = async (options: {
  patientId: bigint;
  token: string;
  invoiceId?: string;
}) =>
  withUniqueRetry(async () => {
    const PayNum = nextUniqueId();
    const now = new Date();

    return prisma.payment.create({
      data: {
        PayNum,
        PatNum: options.patientId,
        PayDate: now,
        PayAmt: 50,
        PayNote: JSON.stringify({
          notes: `Payment ${options.token}`,
          method: 'cash',
          status: 'completed',
          invoiceId: options.invoiceId,
        }),
      },
    });
  });

export const createEstimateRecord = async (options: {
  patientId: bigint;
  token: string;
}) =>
  withUniqueRetry(async () => {
    const ClaimNum = nextUniqueId();
    const now = new Date();
    const estimateNumber = `EST-${options.token}`.slice(0, 40);

    return prisma.claim.create({
      data: {
        ClaimNum,
        PatNum: options.patientId,
        ClaimType: 'PreAuth',
        ClaimStatus: 'D',
        DateService: now,
        ClaimNote: `Estimate ${options.token}`,
        ClaimFee: 200,
        PreAuthString: estimateNumber,
        Narrative: JSON.stringify({}),
      },
    });
  });

export const createVitalSignRecord = async (options: {
  patientId: bigint;
  token: string;
}) =>
  withUniqueRetry(async () => {
    const VitalsignNum = nextUniqueId();
    const now = new Date();

    return prisma.vitalsign.create({
      data: {
        VitalsignNum,
        PatNum: options.patientId,
        DateTaken: now,
        BpSystolic: 120,
        BpDiastolic: 80,
        Documentation: JSON.stringify({
          recordedTime: '09:00',
          notes: `Vitals ${options.token}`,
        }),
      },
    });
  });
