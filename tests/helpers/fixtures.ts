import { prisma } from '../../src/config/db';

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
      },
    });
  });

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
}) => {
  const AptNum = nextUniqueId();
  const now = new Date();
  return prisma.appointment.create({
    data: {
      AptNum,
      PatNum: options.patientId,
      ProvNum: options.providerId,
      AptDateTime: now,
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
