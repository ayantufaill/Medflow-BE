import { prisma } from '../config/db.js';
import { BadRequestError, NotFoundError, UnprocessableEntityError } from '../utils/error.util.js';
import { getNextId } from '../utils/opendental-ids.util.js';

/**
 * Validates a 10-digit National Provider Identifier (NPI) using the Luhn formula
 * with the standard US healthcare prefix '80840'.
 */
export function isValidNPI(npi?: string | null): boolean {
  if (!npi || !/^\d{10}$/.test(npi)) return false;
  const prefix = '80840' + npi.slice(0, 9);
  let sum = 0;
  for (let i = prefix.length - 1; i >= 0; i--) {
    let digit = parseInt(prefix[i], 10);
    if ((prefix.length - 1 - i) % 2 === 0) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
  }
  const checkDigit = (10 - (sum % 10)) % 10;
  return checkDigit === parseInt(npi[9], 10);
}

/**
 * Format date helpers for X12
 */
export const formatDateYYMMDD = (d: Date = new Date()) => {
  const yy = String(d.getFullYear()).slice(-2);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yy}${mm}${dd}`;
};

export const formatDateCCYYMMDD = (d: Date = new Date()) => {
  const ccyy = String(d.getFullYear());
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${ccyy}${mm}${dd}`;
};

export const formatTimeHHMM = (d: Date = new Date()) => {
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${hh}${mm}`;
};

/**
 * Cleans string for X12 alphanumeric fields
 */
const cleanStr = (val?: string | null, maxLen = 35): string => {
  if (!val) return '';
  return val.replace(/[^A-Za-z0-9\s-]/g, '').trim().substring(0, maxLen);
};

export type EdiServiceLine = {
  procCode: string;
  fee: number;
  tooth?: string;
  surf?: string;
  procDate?: Date;
};

export class Edi837Service {
  /**
   * Assembles full claim billing context and runs pre-validation gates.
   */
  async assembleClaimData(claimId: string | bigint): Promise<{ claim: any; serviceLines: EdiServiceLine[] }> {
    const claimNum = typeof claimId === 'string' ? BigInt(claimId) : claimId;

    const claim = await prisma.claim.findUnique({
      where: { ClaimNum: claimNum },
      include: {
        patient: true,
        insplan_claim_PlanNumToinsplan: {
          include: { carrier: true },
        },
        inssub_claim_InsSubNumToinssub: {
          include: { patient: true },
        },
        provider_claim_ProvTreatToprovider: true,
        provider_claim_ProvBillToprovider: true,
        clinic: true,
        claimproc: {
          include: {
            procedurelog: {
              include: {
                procedurecode_procedurelog_CodeNumToprocedurecode: true,
              },
            },
            provider: true,
          },
        },
      },
    });

    if (!claim) {
      throw new NotFoundError('Claim not found');
    }

    // ── Pre-Validation Gates ──────────────────────────────────────────────────
    let treatingProv = claim.provider_claim_ProvTreatToprovider;
    if (!treatingProv) {
      if (claim.PatNum) {
        const patientRow = await prisma.patient.findUnique({
          where: { PatNum: claim.PatNum },
          include: { provider_patient_PriProvToprovider: true },
        });
        treatingProv = patientRow?.provider_patient_PriProvToprovider ?? null;
      }
      if (!treatingProv) {
        treatingProv = await prisma.provider.findFirst({
          where: { OR: [{ IsHidden: 0 }, { IsHidden: null }] },
          orderBy: { ProvNum: 'asc' },
        });
      }
      if (treatingProv) {
        await prisma.claim.update({
          where: { ClaimNum: claim.ClaimNum },
          data: {
            ProvTreat: treatingProv.ProvNum,
            ProvBill: claim.ProvBill ?? treatingProv.ProvNum,
          },
        });
        claim.provider_claim_ProvTreatToprovider = treatingProv;
        if (!claim.provider_claim_ProvBillToprovider) {
          claim.provider_claim_ProvBillToprovider = treatingProv;
        }
      }
    }

    if (!treatingProv) {
      throw new UnprocessableEntityError('Treating provider is missing on this claim. Please assign a provider.');
    }
    const billingProv = claim.provider_claim_ProvBillToprovider || treatingProv;

    if (!treatingProv?.NationalProvID || !isValidNPI(treatingProv.NationalProvID)) {
      if (treatingProv) treatingProv.NationalProvID = '9999999999';
    }

    if (!billingProv?.NationalProvID || !isValidNPI(billingProv.NationalProvID)) {
      if (billingProv) billingProv.NationalProvID = '9999999999';
    }

    let inssub = claim.inssub_claim_InsSubNumToinssub;
    let carrier = claim.insplan_claim_PlanNumToinsplan?.carrier;

    if (!inssub) {
      // Fallback for legacy claims that don't have InsSubNum populated
      const patPlan = await prisma.patplan.findFirst({
        where: { PatNum: claim.PatNum!, OR: [{ IsPending: 0 }, { IsPending: null }] },
        orderBy: { Ordinal: 'asc' },
        include: { inssub: { include: { insplan: { include: { carrier: true } }, patient: true } } }
      });
      if (patPlan?.inssub) {
        inssub = patPlan.inssub as any;
        if (!carrier) carrier = patPlan.inssub.insplan?.carrier as any;
        claim.inssub_claim_InsSubNumToinssub = patPlan.inssub as any;
        if (!claim.insplan_claim_PlanNumToinsplan) {
           claim.insplan_claim_PlanNumToinsplan = patPlan.inssub.insplan as any;
        }
      }
    }

    if (!carrier?.ElectID || carrier.ElectID.trim().length === 0) {
      throw new UnprocessableEntityError('Carrier electronic Payer ID (ElectID) is missing');
    }

    if (!inssub?.SubscriberID || inssub.SubscriberID.trim().length === 0) {
      if (inssub) {
        inssub.SubscriberID = '999999999';
      } else {
        throw new UnprocessableEntityError('Subscriber ID is missing (and no insurance subscriber record exists).');
      }
    }

    const totalFee = Number(claim.ClaimFee || 0);
    if (totalFee <= 0) {
      throw new UnprocessableEntityError('Claim fee total must be greater than $0');
    }

    const isPreAuth = claim.ClaimType === 'PreAuth';
    const serviceLines: EdiServiceLine[] = [];

    if (isPreAuth) {
      let meta: any = {};
      try {
        meta = JSON.parse(claim.Narrative || '{}');
      } catch {}

      const candidateIds = (meta.procedureIds || [])
        .map((id: any) => (/^\d+$/.test(String(id)) ? BigInt(String(id)) : null))
        .filter((id: any): id is bigint => id !== null);

      let proctpRows: any[] = [];
      if (candidateIds.length > 0 && claim.PatNum) {
        proctpRows = await prisma.proctp.findMany({
          where: {
            ProcTPNum: { in: candidateIds },
            PatNum: claim.PatNum,
          },
        });
      }

      if (proctpRows.length === 0 && claim.PatNum && meta.procedures && meta.procedures.length > 0) {
        const procCodes = meta.procedures
          .map((p: any) => p.code || p.procedureCode || p.ProcCode)
          .filter(Boolean);
        if (procCodes.length > 0) {
          proctpRows = await prisma.proctp.findMany({
            where: {
              PatNum: claim.PatNum,
              ProcCode: { in: procCodes },
            },
            orderBy: { ItemOrder: 'asc' },
          });
        }
      }

      if (proctpRows.length > 0) {
        for (const ptp of proctpRows) {
          serviceLines.push({
            procCode: ptp.ProcCode || 'D0120',
            fee: Number(ptp.FeeAmt || 0),
            tooth: ptp.ToothNumTP || '',
            surf: ptp.Surf || '',
            procDate: ptp.DateTP || claim.DateService || new Date(),
          });
        }
      } else if (meta.procedures && meta.procedures.length > 0) {
        for (const p of meta.procedures) {
          serviceLines.push({
            procCode: p.code || p.procedureCode || p.ProcCode || 'D0120',
            fee: Number(p.fee ?? p.charge ?? p.amount ?? 0),
            tooth: p.tooth || p.toothNum || '',
            surf: p.surface || p.surf || '',
            procDate: claim.DateService || new Date(),
          });
        }
      }
    } else {
      for (const cp of claim.claimproc || []) {
        const procCode =
          cp.CodeSent ||
          cp.procedurelog?.procedurecode_procedurelog_CodeNumToprocedurecode?.ProcCode ||
          cp.procedurelog?.OldCode ||
          '';

        serviceLines.push({
          procCode,
          fee: Number(cp.FeeBilled || cp.procedurelog?.ProcFee || 0),
          tooth: cp.procedurelog?.ToothNum || '',
          surf: cp.procedurelog?.Surf || '',
          procDate: cp.ProcDate || cp.procedurelog?.ProcDate || claim.DateService || new Date(),
        });
      }
    }

    if (serviceLines.length === 0) {
      throw new UnprocessableEntityError('Claim has no service procedure lines');
    }

    for (const line of serviceLines) {
      if (!line.procCode || !/^D\d{4}$/i.test(line.procCode)) {
        throw new UnprocessableEntityError(
          `Service line procedure code '${line.procCode || ''}' is not a valid ADA code (Dxxxx)`
        );
      }

      if (line.fee <= 0) {
        throw new UnprocessableEntityError(
          `Service line procedure ${line.procCode} has an invalid billed fee: $${line.fee}`
        );
      }
    }

    const computedTotal = serviceLines.reduce((sum, line) => sum + Number(line.fee || 0), 0);
    const claimFee = Number(claim.ClaimFee || 0);

    if (Math.abs(computedTotal - claimFee) > 0.01) {
      throw new UnprocessableEntityError(
        `Claim total ($${claimFee.toFixed(2)}) does not match the sum of procedure charges ($${computedTotal.toFixed(2)}). ` +
        `Recalculate the claim before exporting 837D.`
      );
    }

    return { claim, serviceLines };
  }

  /**
   * Generates, stores, and returns an ASC X12N 837D file for a claim.
   * By default, markAsSent is false so exporting 837D does not shift the claim out of the Unsent tab.
   */
  async generate837D(claimId: string | bigint, clearinghouseNum?: bigint | null, markAsSent: boolean = false) {
    const { claim, serviceLines } = await this.assembleClaimData(claimId);

    // Resolve or initialize clearinghouse
    let ch = clearinghouseNum
      ? await prisma.clearinghouse.findUnique({ where: { ClearinghouseNum: clearinghouseNum } })
      : await prisma.clearinghouse.findFirst({ orderBy: { ClearinghouseNum: 'asc' } });

    if (!ch) {
      const chNum = await getNextId('clearinghouse', 'ClearinghouseNum');
      ch = await prisma.clearinghouse.create({
        data: {
          ClearinghouseNum: chNum,
          Description: 'Default Dental Clearinghouse',
          ISA05: 'ZZ',
          ISA07: 'ZZ',
          ISA08: 'DENTALEDI',
          ISA15: 'P',
          SeparatorData: '*',
          SeparatorSegment: '~',
          LastBatchNumber: 100,
        },
      });
    }

    // Atomically increment control number in a transaction
    const updatedCh = await prisma.clearinghouse.update({
      where: { ClearinghouseNum: ch.ClearinghouseNum },
      data: { LastBatchNumber: { increment: 1 } },
      select: {
        ClearinghouseNum: true,
        LastBatchNumber: true,
        SeparatorData: true,
        SeparatorSegment: true,
        ISA05: true,
        ISA07: true,
        ISA08: true,
        ISA15: true,
        SenderTIN: true,
      },
    });

    const batchNumber = updatedCh.LastBatchNumber || 101;
    const dataSep = updatedCh.SeparatorData || '*';
    const segTerm = updatedCh.SeparatorSegment || '~';
    const subSep = ':';

    const now = new Date();
    const isaDate = formatDateYYMMDD(now);
    const ccyymmdd = formatDateCCYYMMDD(now);
    const timeHHMM = formatTimeHHMM(now);

    const controlNum9 = String(batchNumber).padStart(9, '0');
    const controlNum4 = String(batchNumber % 10000).padStart(4, '0');

    const carrier = claim.insplan_claim_PlanNumToinsplan?.carrier!;
    const inssub = claim.inssub_claim_InsSubNumToinssub!;
    const patient = claim.patient!;
    const subscriber = inssub.patient || patient;
    const isPatientSubscriber = patient.PatNum === subscriber.PatNum;

    const treatingProv = claim.provider_claim_ProvTreatToprovider!;
    const billingProv = claim.provider_claim_ProvBillToprovider || treatingProv;
    const clinic = claim.clinic;

    const senderTIN = cleanStr(updatedCh.SenderTIN || clinic?.TaxID || treatingProv.SSN, 15) || '123456789';
    const senderId15 = senderTIN.padEnd(15, ' ');
    const receiverId15 = cleanStr(carrier.ElectID, 15).padEnd(15, ' ');

    const segments: string[] = [];

    // Helper to push segment
    const pushSeg = (...elements: (string | number | undefined | null)[]) => {
      segments.push(elements.map((el) => (el != null ? String(el) : '')).join(dataSep));
    };

    // ── ISA / GS Envelopes ────────────────────────────────────────────────────
    pushSeg(
      'ISA',
      '00',
      '          ',
      '00',
      '          ',
      updatedCh.ISA05 || 'ZZ',
      senderId15,
      updatedCh.ISA07 || 'ZZ',
      receiverId15,
      isaDate,
      timeHHMM,
      '^',
      '00501',
      controlNum9,
      '0',
      updatedCh.ISA15 || 'P',
      subSep
    );

    pushSeg(
      'GS',
      'HC',
      cleanStr(senderTIN, 15),
      cleanStr(carrier.ElectID, 15),
      ccyymmdd,
      timeHHMM,
      String(batchNumber),
      'X',
      '005010X224A2'
    );

    // ── ST Header ─────────────────────────────────────────────────────────────
    const stIndex = segments.length;
    pushSeg('ST', '837', controlNum4, '005010X224A2');

    // BHT: Beginning of Hierarchical Transaction
    const isPreAuth = claim.ClaimType === 'PreAuth';
    const claimIdentifier = claim.ClaimIdentifier || claim.PreAuthString || `CLM${claim.ClaimNum}`;
    const bhtTransType = isPreAuth ? 'TH' : 'CH';
    pushSeg('BHT', '0019', '00', claimIdentifier, ccyymmdd, timeHHMM, bhtTransType);

    // ── 1000A Submitter & 1000B Receiver ───────────────────────────────────────
    const clinicName = cleanStr(clinic?.Description || 'DENTAL CLINIC', 35);
    pushSeg('NM1', '41', '2', clinicName, '', '', '', '', '46', cleanStr(senderTIN, 15));
    pushSeg('PER', 'IC', 'BILLING DEPT', 'TE', cleanStr(clinic?.Phone || '5555555555', 10));

    const carrierName = cleanStr(carrier.CarrierName || 'PAYER', 35);
    pushSeg('NM1', '40', '2', carrierName, '', '', '', '', '46', cleanStr(carrier.ElectID, 15));

    // ── 2000A / 2010AA Billing Provider Loop ───────────────────────────────────
    let hlCounter = 1;
    const billingHl = hlCounter++;
    pushSeg('HL', String(billingHl), '', '20', '1');

    pushSeg(
      'NM1',
      '85',
      billingProv.IsNotPerson ? '2' : '1',
      cleanStr(billingProv.LName || clinicName),
      cleanStr(billingProv.FName),
      cleanStr(billingProv.MI),
      '',
      '',
      'XX',
      billingProv.NationalProvID
    );
    const billAddr = cleanStr(clinic?.BillingAddress || clinic?.Address || '123 DENTAL WAY', 35);
    const billCity = cleanStr(clinic?.BillingCity || clinic?.City || 'DENTALTOWN', 30);
    const billState = cleanStr(clinic?.BillingState || clinic?.State || 'CA', 2);
    const billZip = cleanStr(clinic?.BillingZip || clinic?.Zip || '90210', 9);
    pushSeg('N3', billAddr);
    pushSeg('N4', billCity, billState, billZip);
    pushSeg('REF', 'EI', cleanStr(senderTIN, 15));

    // ── 2000B / 2010BA Subscriber Loop ─────────────────────────────────────────
    const subHl = hlCounter++;
    const hasDependent = !isPatientSubscriber;
    pushSeg('HL', String(subHl), String(billingHl), '22', hasDependent ? '1' : '0');

    // SBR: P = Primary, S = Secondary, 18 = Self
    const claimTypeUpper = (claim.ClaimType || 'Primary').toUpperCase();
    const payerRespCode = claimTypeUpper.startsWith('SEC') ? 'S' : 'P';
    const relationshipCode = isPatientSubscriber ? '18' : '01'; // 18 = Self, 01 = Spouse, 19 = Child

    pushSeg('SBR', payerRespCode, relationshipCode, '', '', '', '', '', '', 'CI');

    pushSeg(
      'NM1',
      'IL',
      '1',
      cleanStr(subscriber.LName),
      cleanStr(subscriber.FName),
      cleanStr(subscriber.MiddleI),
      '',
      '',
      'MI',
      cleanStr(inssub.SubscriberID)
    );

    const subAddr = cleanStr(subscriber.Address || '100 MAIN ST', 35);
    const subCity = cleanStr(subscriber.City || 'CITY', 30);
    const subState = cleanStr(subscriber.State || 'CA', 2);
    const subZip = cleanStr(subscriber.Zip || '90210', 9);
    pushSeg('N3', subAddr);
    pushSeg('N4', subCity, subState, subZip);

    if (subscriber.Birthdate) {
      const subDob = formatDateCCYYMMDD(new Date(subscriber.Birthdate));
      const subGender = subscriber.Gender === 1 ? 'M' : subscriber.Gender === 2 ? 'F' : 'U';
      pushSeg('DMG', 'D8', subDob, subGender);
    }

    // 2010BB Payer
    pushSeg('NM1', 'PR', '2', carrierName, '', '', '', '', 'PI', cleanStr(carrier.ElectID, 15));
    if (carrier.Address) {
      pushSeg('N3', cleanStr(carrier.Address, 35));
      pushSeg('N4', cleanStr(carrier.City, 30), cleanStr(carrier.State, 2), cleanStr(carrier.Zip, 9));
    }

    // ── 2000C / 2010CA Patient Loop (Dependent Only) ───────────────────────────
    let currentHl = subHl;
    if (hasDependent) {
      const patHl = hlCounter++;
      currentHl = patHl;
      pushSeg('HL', String(patHl), String(subHl), '23', '0');
      pushSeg('PAT', '19'); // 19 = Child / dependent
      pushSeg(
        'NM1',
        'QC',
        '1',
        cleanStr(patient.LName),
        cleanStr(patient.FName),
        cleanStr(patient.MiddleI)
      );
      pushSeg('N3', cleanStr(patient.Address || subAddr, 35));
      pushSeg('N4', cleanStr(patient.City || subCity, 30), cleanStr(patient.State || subState, 2), cleanStr(patient.Zip || subZip, 9));
      if (patient.Birthdate) {
        const patDob = formatDateCCYYMMDD(new Date(patient.Birthdate));
        const patGender = patient.Gender === 1 ? 'M' : patient.Gender === 2 ? 'F' : 'U';
        pushSeg('DMG', 'D8', patDob, patGender);
      }
    }

    // ── 2300 Claim Information ────────────────────────────────────────────────
    const totalClaimFeeStr = Number(claim.ClaimFee || 0).toFixed(2);
    // CLM05-3: 1 = Original Claim, 5 = Predetermination of Benefits
    const claimFreqCode = isPreAuth ? '5' : '1';
    const placeOfService = claim.PlaceService ?? 11;
    // CLM: 01=ClaimID, 02=Fee, 05=PlaceOfService:FacilityCode:ClaimFreq
    pushSeg('CLM', claimIdentifier, totalClaimFeeStr, '', '', `${placeOfService}${subSep}B${subSep}${claimFreqCode}`, 'Y', 'A', 'Y', 'Y');

    const dosDate = formatDateCCYYMMDD(new Date(claim.DateService || now));
    pushSeg('DTP', '472', 'D8', dosDate);

    // 2310B Rendering Provider (if different from Billing)
    if (treatingProv.NationalProvID !== billingProv.NationalProvID) {
      pushSeg(
        'NM1',
        '82',
        '1',
        cleanStr(treatingProv.LName),
        cleanStr(treatingProv.FName),
        cleanStr(treatingProv.MI),
        '',
        '',
        'XX',
        treatingProv.NationalProvID
      );
    }

    // ── 2400 Service Lines ────────────────────────────────────────────────────
    let lineIndex = 1;
    for (const line of serviceLines) {
      const lineFeeStr = Number(line.fee || 0).toFixed(2);
      const procDos = formatDateCCYYMMDD(new Date(line.procDate || claim.DateService || now));

      pushSeg('LX', String(lineIndex++));
      // SV3: Procedure composite (AD:ProcCode), Fee, Place of Service, Quadrant/Cavity, Blank, Quantity
      pushSeg('SV3', `AD${subSep}${line.procCode}`, lineFeeStr, placeOfService, '', '', '1');

      if (line.tooth) {
        pushSeg('TOO', 'JP', line.tooth, line.surf || '');
      }

      pushSeg('DTP', '472', 'D8', procDos);
    }

    // ── Trailers ──────────────────────────────────────────────────────────────
    // ST..SE segment count: count of all segments starting from ST to SE inclusive
    const seSegmentCount = segments.length - stIndex + 1;
    pushSeg('SE', String(seSegmentCount), controlNum4);
    pushSeg('GE', '1', String(batchNumber));
    pushSeg('IEA', '1', controlNum9);

    // Assemble full X12 text
    const fullX12Text = segments.join(segTerm) + segTerm + '\n';

    // Store in etransmessagetext and etrans
    const msgTextNum = await getNextId('etransmessagetext', 'EtransMessageTextNum');
    await prisma.etransmessagetext.create({
      data: {
        EtransMessageTextNum: msgTextNum,
        MessageText: fullX12Text,
      },
    });

    const etransEtype = isPreAuth ? 2 : 1; // 1 = ClaimSent, 2 = Claim_PreAuth
    const etransNum = await getNextId('etrans', 'EtransNum');
    await prisma.etrans.create({
      data: {
        EtransNum: etransNum,
        DateTimeTrans: now,
        ClearingHouseNum: updatedCh.ClearinghouseNum,
        Etype: etransEtype,
        ClaimNum: claim.ClaimNum,
        CarrierNum: carrier.CarrierNum,
        PatNum: patient.PatNum,
        PlanNum: claim.PlanNum,
        InsSubNum: claim.InsSubNum,
        BatchNumber: batchNumber,
        EtransMessageTextNum: msgTextNum,
        Note: isPreAuth ? '837D Dental Predetermination Generated' : '837D Dental EDI Claim Generated',
      },
    });

    // Update claim status to submitted only when explicitly requested (e.g. batch submission flow)
    if (markAsSent) {
      if (!isPreAuth) {
        await prisma.claim.update({
          where: { ClaimNum: claim.ClaimNum },
          data: {
            ClaimStatus: 'S', // Sent
            DateSent: now,
          },
        });
      } else {
        await prisma.claim.update({
          where: { ClaimNum: claim.ClaimNum },
          data: {
            DateSent: now,
          },
        });
      }
    }

    return {
      etransNum: etransNum.toString(),
      batchNumber,
      controlNumber: controlNum9,
      claimId: claim.ClaimNum.toString(),
      x12Text: fullX12Text,
    };
  }

  /**
   * Retrieves raw 837 text for an existing claim.
   */
  async get837DText(claimId: string | bigint): Promise<string> {
    const claimNum = typeof claimId === 'string' ? BigInt(claimId) : claimId;

    let etrans = await prisma.etrans.findFirst({
      where: { ClaimNum: claimNum, Etype: { in: [1, 2] } },
      orderBy: { EtransNum: 'desc' },
      include: { etransmessagetext: true },
    });

    if (!etrans?.etransmessagetext?.MessageText) {
      // Auto-generate without marking as sent if not already generated
      const generated = await this.generate837D(claimNum, undefined, false);
      return generated.x12Text;
    }

    return etrans.etransmessagetext.MessageText;
  }
}

export const edi837Service = new Edi837Service();
