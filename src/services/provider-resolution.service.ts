import { prisma } from '../config/db.js';
import { UnprocessableEntityError } from '../utils/error.util.js';

export class ProviderResolutionService {
  /**
   * Resolves both treating (ProvTreat) and billing (ProvBill) providers for a claim.
   *
   * Treating Provider Fallback Chain:
   * 1. proctp.ProvNum / procedurelog.ProvNum
   * 2. appointment.ProvNum
   * 3. patient.PriProv
   * 4. clinic.DefaultProv (only if configured)
   *
   * Billing Provider Fallback Chain:
   * 1. Explicit billing entity on the claim request
   * 2. clinic.InsBillingProv
   * 3. Treating provider's billing profile (provider.ProvNumBillingOverride)
   * 4. Treating provider fallback (standard OpenDental fallback)
   */
  async resolveClaimProviders(params: {
    patientId?: bigint | null;
    clinicId?: bigint | null;
    itemProvNum?: bigint | null;
    appointmentId?: bigint | null;
    explicitBillingProvNum?: bigint | null;
    allowTreatingAsBilling?: boolean;
  }): Promise<{ treatingProvNum: bigint; billingProvNum: bigint }> {
    const {
      patientId,
      clinicId,
      itemProvNum,
      appointmentId,
      explicitBillingProvNum,
      allowTreatingAsBilling = true,
    } = params;

    // ── 1. Treating Provider Resolution ──────────────────────────────────────
    let treatingProvNum: bigint | null = null;

    // Tier 1: Item-level provider (proctp.ProvNum or procedurelog.ProvNum)
    if (itemProvNum) {
      const prov = await prisma.provider.findUnique({
        where: { ProvNum: itemProvNum },
      });
      if (prov && prov.IsHidden !== 1) {
        treatingProvNum = prov.ProvNum;
      }
    }

    // Tier 2: Appointment provider
    if (!treatingProvNum && appointmentId) {
      const appt = await prisma.appointment.findUnique({
        where: { AptNum: appointmentId },
      });
      if (appt?.ProvNum) {
        const prov = await prisma.provider.findUnique({
          where: { ProvNum: appt.ProvNum },
        });
        if (prov && prov.IsHidden !== 1) {
          treatingProvNum = prov.ProvNum;
        }
      }
    }

    // Tier 3: Patient primary provider (patient.PriProv)
    if (!treatingProvNum && patientId) {
      const patient = await prisma.patient.findUnique({
        where: { PatNum: patientId },
      });
      if (patient?.PriProv) {
        const prov = await prisma.provider.findUnique({
          where: { ProvNum: patient.PriProv },
        });
        if (prov && prov.IsHidden !== 1) {
          treatingProvNum = prov.ProvNum;
        }
      }
    }

    // Tier 4: Clinic default provider (clinic.DefaultProv, only if configured)
    if (!treatingProvNum && clinicId) {
      const clinic = await prisma.clinic.findUnique({
        where: { ClinicNum: clinicId },
      });
      if (clinic?.DefaultProv) {
        const prov = await prisma.provider.findUnique({
          where: { ProvNum: clinic.DefaultProv },
        });
        if (prov && prov.IsHidden !== 1) {
          treatingProvNum = prov.ProvNum;
        }
      }
    }

    if (!treatingProvNum) {
      throw new UnprocessableEntityError('Unable to resolve treating provider for claim');
    }

    // ── 2. Billing Provider Resolution ───────────────────────────────────────
    let billingProvNum: bigint | null = null;

    // Tier 1: Explicit billing entity on the claim request
    if (explicitBillingProvNum) {
      const prov = await prisma.provider.findUnique({
        where: { ProvNum: explicitBillingProvNum },
      });
      if (prov && prov.IsHidden !== 1) {
        billingProvNum = prov.ProvNum;
      }
    }

    // Tier 2: clinic.InsBillingProv
    if (!billingProvNum && clinicId) {
      const clinic = await prisma.clinic.findUnique({
        where: { ClinicNum: clinicId },
      });
      if (clinic?.InsBillingProv) {
        const prov = await prisma.provider.findUnique({
          where: { ProvNum: clinic.InsBillingProv },
        });
        if (prov && prov.IsHidden !== 1) {
          billingProvNum = prov.ProvNum;
        }
      }
    }

    // Tier 3: Treating provider's billing profile (provider.ProvNumBillingOverride)
    if (!billingProvNum && treatingProvNum) {
      const treatingProv = await prisma.provider.findUnique({
        where: { ProvNum: treatingProvNum },
      });
      if (treatingProv?.ProvNumBillingOverride) {
        const prov = await prisma.provider.findUnique({
          where: { ProvNum: treatingProv.ProvNumBillingOverride },
        });
        if (prov && prov.IsHidden !== 1) {
          billingProvNum = prov.ProvNum;
        }
      }
    }

    // Tier 4: Fallback to treating provider if allowed
    if (!billingProvNum && allowTreatingAsBilling && treatingProvNum) {
      billingProvNum = treatingProvNum;
    }

    if (!billingProvNum) {
      throw new UnprocessableEntityError('Unable to resolve billing provider for claim');
    }

    return { treatingProvNum, billingProvNum };
  }
}

export const providerResolutionService = new ProviderResolutionService();
