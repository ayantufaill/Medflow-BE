import { prisma } from '../config/db';
import { clinicalExamService } from './clinical-exam.service';
import { allergyService } from './allergy.service';
import { getPatientMeta } from '../utils/opendental-auth.util';
import { ExamType } from '../types/clinical-exam.types';
import { NotFoundError } from '../utils/error.util';

// ─── Scoring helpers ────────────────────────────────────────────────

function calculateScore(criticalCount: number, moderateCount: number, minorCount: number): number {
  return Math.max(0, 100 - (criticalCount * 15) - (moderateCount * 8) - (minorCount * 3));
}

function getStatus(score: number): 'good' | 'moderate' | 'concern' {
  if (score >= 80) return 'good';
  if (score >= 60) return 'moderate';
  return 'concern';
}

// ─── Tooth helpers ──────────────────────────────────────────────────

const TOOTH_NUMBERS = Array.from({ length: 32 }, (_, i) => (i + 1).toString());

function hasBleedingOnTooth(toothData: any): boolean {
  if (!toothData?.bleeding) return false;
  const arr = Array.isArray(toothData.bleeding) ? toothData.bleeding : Object.values(toothData.bleeding);
  return arr.some((v: any) => v === 1 || v === true);
}

function hasRecessionOnTooth(toothData: any): boolean {
  if (!toothData?.recession) return false;
  const arr = Array.isArray(toothData.recession) ? toothData.recession : Object.values(toothData.recession);
  return arr.some((v: any) => Number(v) > 0);
}

function hasDeepProbingOnTooth(toothData: any, threshold = 5): boolean {
  if (!toothData?.probing) return false;
  const arr = Array.isArray(toothData.probing) ? toothData.probing : Object.values(toothData.probing);
  return arr.some((v: any) => Number(v) >= threshold);
}

function hasMobility(toothData: any): boolean {
  if (!toothData?.mobility) return false;
  return toothData.mobility !== 'none' && toothData.mobility !== 0 && toothData.mobility !== '0';
}

// ─── Section builders ───────────────────────────────────────────────

function buildPeriodontalHealth(perioExam: any, radioExam: any) {
  const defaultSection = {
    score: 100,
    status: 'good' as const,
    title: 'Gum & Bone Health',
    issues: [] as string[],
    description: 'No significant periodontal concerns detected.',
    explanations: [] as string[],
  };

  if (!perioExam?.examData) return defaultSection;

  const chartData = perioExam.examData.chartData ?? perioExam.examData;
  const bleedingTeeth: string[] = [];
  const recessionTeeth: string[] = [];
  const boneLossTeeth: string[] = [];
  const mobilityTeeth: string[] = [];
  const missingTeeth: string[] = [];

  for (const tooth of TOOTH_NUMBERS) {
    const td = chartData[tooth];
    if (!td) continue;
    if (hasBleedingOnTooth(td)) bleedingTeeth.push(tooth);
    if (hasRecessionOnTooth(td)) recessionTeeth.push(tooth);
    if (hasDeepProbingOnTooth(td)) boneLossTeeth.push(tooth);
    if (hasMobility(td)) mobilityTeeth.push(tooth);
  }

  // Augment with radiographic missing teeth
  if (radioExam?.examData?.missingTeeth) {
    const mt = radioExam.examData.missingTeeth;
    if (Array.isArray(mt)) {
      missingTeeth.push(...mt.map(String));
    }
  }

  const issues: string[] = [];
  const explanations: string[] = [];

  if (bleedingTeeth.length > 0) {
    issues.push(`Bleeding on probing: teeth ${bleedingTeeth.join(', ')}`);
    explanations.push('Bleeding indicates active inflammation in the gum tissue, often a sign of gingivitis or periodontitis.');
  }
  if (recessionTeeth.length > 0) {
    issues.push(`Gum recession: teeth ${recessionTeeth.join(', ')}`);
    explanations.push('Recession exposes the root surface, increasing sensitivity and cavity risk.');
  }
  if (boneLossTeeth.length > 0) {
    issues.push(`Deep pockets (≥5mm): teeth ${boneLossTeeth.join(', ')}`);
    explanations.push('Deep pockets suggest bone loss around the teeth, a hallmark of periodontitis.');
  }
  if (mobilityTeeth.length > 0) {
    issues.push(`Tooth mobility: teeth ${mobilityTeeth.join(', ')}`);
    explanations.push('Mobile teeth may indicate advanced bone loss or trauma.');
  }
  if (missingTeeth.length > 0) {
    issues.push(`Missing teeth: ${missingTeeth.join(', ')}`);
  }

  const critical = boneLossTeeth.length + mobilityTeeth.length;
  const moderate = bleedingTeeth.length;
  const minor = recessionTeeth.length;
  const score = calculateScore(critical, moderate, minor);
  const status = getStatus(score);
  const description = issues.length > 0
    ? 'Periodontal concerns were identified that require attention.'
    : defaultSection.description;

  return { score, status, title: defaultSection.title, issues, description, explanations };
}

function buildToothStructure(toothExam: any, radioExam: any) {
  const defaultSection = {
    score: 100,
    status: 'good' as const,
    title: 'Tooth Structure & Decay',
    issues: [] as string[],
    description: 'No significant tooth structure concerns detected.',
    explanations: [] as string[],
  };

  if (!toothExam?.examData && !radioExam?.examData) return defaultSection;

  const issues: string[] = [];
  const explanations: string[] = [];
  let critical = 0;
  let moderate = 0;
  let minor = 0;

  // Process tooth-structure exam conditions
  const conditions = toothExam?.examData?.conditions ?? toothExam?.examData?.teeth ?? toothExam?.examData;
  if (conditions && typeof conditions === 'object') {
    const decayTeeth: string[] = [];
    const failedTeeth: string[] = [];
    const wornTeeth: string[] = [];
    const fracturedTeeth: string[] = [];

    for (const [tooth, data] of Object.entries(conditions)) {
      const d = data as any;
      if (!d) continue;
      const condition = d.condition?.toLowerCase?.() ?? '';
      if (condition.includes('caries') || condition.includes('decay') || condition.includes('cavity')) {
        decayTeeth.push(tooth);
        if (d.severity === 'severe') critical++;
        else moderate++;
      } else if (condition.includes('fracture') || condition.includes('crack')) {
        fracturedTeeth.push(tooth);
        moderate++;
      } else if (condition.includes('failed') || condition.includes('defective')) {
        failedTeeth.push(tooth);
        moderate++;
      } else if (condition.includes('wear') || condition.includes('attrition') || condition.includes('erosion')) {
        wornTeeth.push(tooth);
        minor++;
      }
    }

    if (decayTeeth.length > 0) {
      issues.push(`Active decay: teeth ${decayTeeth.join(', ')}`);
      explanations.push('Cavities need prompt treatment to prevent pain, infection, and tooth loss.');
    }
    if (fracturedTeeth.length > 0) {
      issues.push(`Fractures/cracks: teeth ${fracturedTeeth.join(', ')}`);
      explanations.push('Cracked or fractured teeth can worsen under biting pressure and may need crowns or other restorations.');
    }
    if (failedTeeth.length > 0) {
      issues.push(`Failed/defective restorations: teeth ${failedTeeth.join(', ')}`);
      explanations.push('Old or failing restorations can leak, harboring bacteria beneath them.');
    }
    if (wornTeeth.length > 0) {
      issues.push(`Wear/attrition: teeth ${wornTeeth.join(', ')}`);
      explanations.push('Tooth wear can be caused by grinding (bruxism), acidic diet, or aggressive brushing.');
    }
  }

  // Process radiographic missing teeth
  if (radioExam?.examData?.missingTeeth?.length > 0) {
    issues.push(`Missing teeth (radiographic): ${radioExam.examData.missingTeeth.join(', ')}`);
    minor += radioExam.examData.missingTeeth.length;
  }

  const score = calculateScore(critical, moderate, minor);
  const status = getStatus(score);
  const description = issues.length > 0
    ? 'Structural issues were found that may require restorative treatment.'
    : defaultSection.description;

  return { score, status, title: defaultSection.title, issues, description, explanations };
}

function buildBiteAlignment(tmjExam: any, morphExam: any) {
  const defaultSection = {
    score: 100,
    status: 'good' as const,
    title: 'Bite & Alignment',
    issues: [] as string[],
    description: 'Bite alignment and TMJ function are within normal limits.',
    explanations: [] as string[],
  };

  if (!tmjExam?.examData && !morphExam?.examData) return defaultSection;

  const issues: string[] = [];
  const explanations: string[] = [];
  let critical = 0;
  let moderate = 0;
  let minor = 0;

  // TMJ findings
  const tmj = tmjExam?.examData;
  if (tmj) {
    if (tmj.jointSymptoms || tmj.clicking || tmj.popping || tmj.locking) {
      issues.push('TMJ joint symptoms detected (clicking, popping, or locking)');
      explanations.push('Joint sounds and locking can indicate disc displacement or joint degeneration.');
      moderate++;
    }
    if (tmj.muscleTenderness || tmj.muscleGuarding) {
      issues.push('Muscle tenderness or guarding noted');
      explanations.push('Muscle tenderness is often related to clenching, grinding, or stress.');
      moderate++;
    }
    if (tmj.limitedOpening) {
      issues.push('Limited jaw opening');
      explanations.push('Restricted opening may indicate acute TMD or muscular dysfunction.');
      critical++;
    }
    if (tmj.bruxism) {
      issues.push('Bruxism (teeth grinding) indicators present');
      explanations.push('Grinding can wear down teeth, cause headaches, and contribute to TMJ disorders.');
      moderate++;
    }
    if (tmj.painLevel && Number(tmj.painLevel) > 3) {
      issues.push(`Reported jaw pain level: ${tmj.painLevel}/10`);
      critical++;
    }
  }

  // Morphological findings (wear patterns, malocclusion)
  const morph = morphExam?.examData;
  if (morph) {
    if (morph.wearPatterns || morph.unevenWear) {
      issues.push('Abnormal wear patterns detected');
      explanations.push('Uneven wear suggests bite imbalance or parafunctional habits.');
      minor++;
    }
    if (morph.malocclusion) {
      issues.push(`Malocclusion: ${morph.malocclusion}`);
      moderate++;
    }
    if (morph.crossbite) {
      issues.push('Crossbite noted');
      moderate++;
    }
  }

  const score = calculateScore(critical, moderate, minor);
  const status = getStatus(score);
  const description = issues.length > 0
    ? 'Bite or TMJ concerns were identified.'
    : defaultSection.description;

  return { score, status, title: defaultSection.title, issues, description, explanations };
}

function buildAppearance(dentofacialExam: any) {
  const defaultSection = {
    score: 100,
    status: 'good' as const,
    title: 'Aesthetics & Appearance',
    issues: [] as string[],
  };

  if (!dentofacialExam?.examData) return defaultSection;

  const d = dentofacialExam.examData;
  const issues: string[] = [];
  let minor = 0;

  if (d.chipped || d.chippedTeeth?.length > 0) {
    const teeth = d.chippedTeeth?.join?.(', ') ?? '';
    issues.push(`Chipped teeth${teeth ? ': ' + teeth : ''}`);
    minor++;
  }
  if (d.discoloration || d.staining) {
    issues.push('Tooth discoloration or staining noted');
    minor++;
  }
  if (d.gaps || d.diastema) {
    issues.push('Spacing/gaps between teeth');
    minor++;
  }
  if (d.crowding) {
    issues.push('Dental crowding present');
    minor++;
  }
  if (d.gummySmile) {
    issues.push('Excessive gingival display (gummy smile)');
    minor++;
  }
  if (d.asymmetry) {
    issues.push('Facial or dental asymmetry noted');
    minor++;
  }

  const score = calculateScore(0, 0, minor);
  const status = getStatus(score);

  return { score, status, title: defaultSection.title, issues };
}

function buildMedicalFactors(
  patientMeta: Record<string, any>,
  allergies: any[]
) {
  const defaultSection = {
    score: 100,
    status: 'good' as const,
    title: 'Medical Factors',
    issues: [] as string[],
  };

  const issues: string[] = [];
  let moderate = 0;
  let minor = 0;

  // Medical history conditions
  const mh = patientMeta.medicalHistory;
  if (mh) {
    const sections = mh.sections;
    if (sections && typeof sections === 'object') {
      for (const [, sectionData] of Object.entries(sections)) {
        const sd = sectionData as any;
        if (sd?.items && Array.isArray(sd.items)) {
          for (const item of sd.items) {
            if (item.selected === true || item.value === true || item.checked === true) {
              issues.push(`Medical condition: ${item.label ?? item.name ?? 'Unspecified'}`);
              minor++;
            }
          }
        }
      }
    }

    // Medications — list as informational items
    const meds = mh.medications;
    if (Array.isArray(meds) && meds.length > 0) {
      const medNames = meds.map((m: any) => m.name ?? m.medication ?? m).filter(Boolean);
      if (medNames.length > 0) {
        issues.push(`Current medications: ${medNames.join(', ')}`);
        moderate++;
      }
    }

    // Supplements
    const supps = mh.supplements;
    if (Array.isArray(supps) && supps.length > 0) {
      const suppNames = supps.map((s: any) => s.name ?? s).filter(Boolean);
      if (suppNames.length > 0) {
        issues.push(`Supplements: ${suppNames.join(', ')}`);
      }
    }

    // Premed required
    if (mh.premed?.required) {
      issues.push('Premedication required');
      moderate++;
    }
  }

  // Allergies
  if (allergies && allergies.length > 0) {
    const allergenNames = allergies.map((a: any) => a.allergen ?? a.name ?? '').filter(Boolean);
    if (allergenNames.length > 0) {
      issues.push(`Known allergies: ${allergenNames.join(', ')}`);
      moderate++;
    }
  }

  const score = calculateScore(0, moderate, minor);
  const status = getStatus(score);

  return { score, status, title: defaultSection.title, issues };
}

function buildHomeCare(perioExam: any) {
  const defaultResult = {
    oralHygiene: { issues: [] as string[], recommendations: [] as string[] },
    flossing: { issues: [] as string[], recommendations: [] as string[] },
    products: { productRecommendations: [] as string[] },
  };

  if (!perioExam?.examData) return defaultResult;

  const chartData = perioExam.examData.chartData ?? perioExam.examData;

  // Calculate bleeding percentage
  let totalSites = 0;
  let bleedingSites = 0;
  let interproximalBleedingSites = 0;

  for (const tooth of TOOTH_NUMBERS) {
    const td = chartData[tooth];
    if (!td?.bleeding) continue;
    const arr = Array.isArray(td.bleeding) ? td.bleeding : Object.values(td.bleeding);
    totalSites += arr.length;
    arr.forEach((v: any, i: number) => {
      if (v === 1 || v === true) {
        bleedingSites++;
        // Interproximal sites are typically indices 0, 2 (mesial/distal)
        if (i === 0 || i === 2) interproximalBleedingSites++;
      }
    });
  }

  const bleedingPct = totalSites > 0 ? Math.round((bleedingSites / totalSites) * 100) : 0;

  // Oral Hygiene assessment
  const oralHygieneIssues: string[] = [];
  const oralHygieneRecs: string[] = [];

  if (bleedingPct > 30) {
    oralHygieneIssues.push(`High bleeding percentage (${bleedingPct}%) — indicative of generalized inflammation`);
    oralHygieneRecs.push('Use a soft-bristled electric toothbrush for at least 2 minutes, twice daily');
    oralHygieneRecs.push('Consider an antimicrobial rinse (chlorhexidine) for 2 weeks');
  } else if (bleedingPct > 10) {
    oralHygieneIssues.push(`Moderate bleeding percentage (${bleedingPct}%) — some areas of inflammation`);
    oralHygieneRecs.push('Focus brushing along the gum line using gentle, circular motions');
  } else if (bleedingPct > 0) {
    oralHygieneIssues.push(`Mild bleeding (${bleedingPct}%) — localized inflammation`);
  }

  // Flossing assessment
  const flossingIssues: string[] = [];
  const flossingRecs: string[] = [];

  if (interproximalBleedingSites > 6) {
    flossingIssues.push('Significant interproximal bleeding detected — inadequate interdental cleaning');
    flossingRecs.push('Floss daily, using proper C-shape technique around each tooth');
    flossingRecs.push('Consider interdental brushes or a water flosser for wider spaces');
  } else if (interproximalBleedingSites > 2) {
    flossingIssues.push('Some interproximal bleeding — room for improvement in flossing routine');
    flossingRecs.push('Ensure flossing reaches below the gum line in all areas');
  }

  // Product recommendations
  const products: string[] = [];
  if (bleedingPct > 10) {
    products.push('Fluoride toothpaste (1000+ ppm)');
    products.push('Antimicrobial mouthwash');
  }
  if (interproximalBleedingSites > 2) {
    products.push('Interdental brushes or floss picks');
  }
  products.push('Soft-bristled toothbrush (replace every 3 months)');

  return {
    oralHygiene: { issues: oralHygieneIssues, recommendations: oralHygieneRecs },
    flossing: { issues: flossingIssues, recommendations: flossingRecs },
    products: { productRecommendations: products },
  };
}

function buildConcerns(riskAssessment: Record<string, any>) {
  const sections = ['gumHealth', 'toothDecay', 'biteAlignment', 'appearance', 'medicalFactors'];
  const labelMap: Record<string, string> = {
    gumHealth: 'Gum & Bone Health',
    toothDecay: 'Tooth Decay',
    biteAlignment: 'Bite Alignment',
    appearance: 'Appearance',
    medicalFactors: 'Medical Factors',
  };
  const typeMap: Record<string, string> = {
    gumHealth: 'periodontal',
    toothDecay: 'caries',
    biteAlignment: 'tmj',
    appearance: 'aesthetic',
    medicalFactors: 'medical',
  };
  const templateMap: Record<string, string> = {
    gumHealth: 'periodontal-risk',
    toothDecay: 'caries-risk',
    biteAlignment: 'tmj-risk',
    appearance: 'aesthetic-concern',
    medicalFactors: 'medical-risk',
  };

  let lowestScore = 100;
  let lowestKey = 'gumHealth';

  for (const key of sections) {
    const section = riskAssessment[key];
    if (section && typeof section.score === 'number' && section.score < lowestScore) {
      lowestScore = section.score;
      lowestKey = key;
    }
  }

  return {
    primaryConcern: labelMap[lowestKey] ?? 'General',
    concernType: typeMap[lowestKey] ?? 'general',
    templateKey: templateMap[lowestKey] ?? 'general-risk',
  };
}

async function buildShowcase(patientId: string) {
  const patNum = BigInt(patientId);

  // Fetch completed procedures (ProcStatus 2 = Completed)
  const completedProcs = await prisma.procedurelog.findMany({
    where: {
      PatNum: patNum,
      ProcStatus: 2,
    },
    include: {
      procedurecode_procedurelog_CodeNumToprocedurecode: {
        select: { ProcCode: true, Descript: true },
      },
    },
    orderBy: { ProcDate: 'desc' },
    take: 20,
  });

  return {
    completedTreatments: completedProcs.map((proc) => ({
      title: proc.procedurecode_procedurelog_CodeNumToprocedurecode?.Descript ?? proc.OldCode ?? 'Procedure',
      date: proc.ProcDate?.toISOString()?.split('T')[0] ?? '',
      description: proc.procedurecode_procedurelog_CodeNumToprocedurecode?.Descript ?? '',
      procedureCode: proc.OldCode ?? proc.procedurecode_procedurelog_CodeNumToprocedurecode?.ProcCode ?? '',
      site: proc.ToothNum ? `#${proc.ToothNum}` : (proc.Surf ?? ''),
    })),
  };
}

// ─── Main service ───────────────────────────────────────────────────

const EXAM_TYPES: ExamType[] = [
  'periodontal',
  'radiographic',
  'tooth-structure',
  'head-neck',
  'tmj',
  'dentofacial',
  'morphological',
  'airway',
];

export class PatientReportService {
  async getReport(patientId: string, appointmentId?: string) {
    const patNum = BigInt(patientId);

    // Verify patient exists
    const patient = await prisma.patient.findUnique({
      where: { PatNum: patNum },
      select: { PatNum: true, FName: true, LName: true },
    });
    if (!patient) {
      throw new NotFoundError(`Patient ${patientId} not found`);
    }

    // Step 1: Find the target appointment
    let aptId = appointmentId;
    let aptDateTime: Date | null = null;

    if (!aptId) {
      // Find most recent appointment that has exam data
      const recentApts = await prisma.appointment.findMany({
        where: { PatNum: patNum },
        orderBy: { AptDateTime: 'desc' },
        take: 10,
        select: { AptNum: true, AptDateTime: true },
      });

      for (const apt of recentApts) {
        const id = apt.AptNum.toString();
        // Check if any exam exists for this appointment
        for (const examType of EXAM_TYPES) {
          try {
            const exam = await clinicalExamService.getExamByAppointment(examType, id);
            if (exam?.examData) {
              aptId = id;
              aptDateTime = apt.AptDateTime;
              break;
            }
          } catch {
            // exam type not found, continue
          }
        }
        if (aptId) break;
      }
    } else {
      // Fetch appointment date for the provided ID
      const apt = await prisma.appointment.findUnique({
        where: { AptNum: BigInt(aptId) },
        select: { AptDateTime: true },
      });
      aptDateTime = apt?.AptDateTime ?? null;
    }

    // Step 2: Fetch all exams in parallel
    let periodontal: any = null;
    let radiographic: any = null;
    let toothStructure: any = null;
    let headNeck: any = null;
    let tmj: any = null;
    let dentofacial: any = null;
    let morphological: any = null;
    let airway: any = null;

    if (aptId) {
      [periodontal, radiographic, toothStructure, headNeck, tmj, dentofacial, morphological, airway] =
        await Promise.all([
          clinicalExamService.getExamByAppointment('periodontal', aptId).catch(() => null),
          clinicalExamService.getExamByAppointment('radiographic', aptId).catch(() => null),
          clinicalExamService.getExamByAppointment('tooth-structure', aptId).catch(() => null),
          clinicalExamService.getExamByAppointment('head-neck', aptId).catch(() => null),
          clinicalExamService.getExamByAppointment('tmj', aptId).catch(() => null),
          clinicalExamService.getExamByAppointment('dentofacial', aptId).catch(() => null),
          clinicalExamService.getExamByAppointment('morphological', aptId).catch(() => null),
          clinicalExamService.getExamByAppointment('airway', aptId).catch(() => null),
        ]);
    }

    // Step 3: Fetch patient meta + allergies for medical factors
    const [patientMeta, allergies] = await Promise.all([
      getPatientMeta(patNum),
      allergyService.getAllergiesByPatient(patientId).catch(() => []),
    ]);

    // Step 4: Resolve provider name
    let providerName: string | null = null;
    if (periodontal?.providerId || radiographic?.providerId) {
      const provId = periodontal?.providerId ?? radiographic?.providerId;
      const prov = await prisma.provider.findUnique({
        where: { ProvNum: BigInt(provId) },
        select: { FName: true, LName: true, Suffix: true },
      });
      if (prov) {
        providerName = `${prov.Suffix ? prov.Suffix + ' ' : 'Dr. '}${prov.FName ?? ''} ${prov.LName ?? ''}`.trim();
      }
    }

    // Step 5: Build report sections
    const gumHealth = buildPeriodontalHealth(periodontal, radiographic);
    const toothDecay = buildToothStructure(toothStructure, radiographic);
    const biteAlignment = buildBiteAlignment(tmj, morphological);
    const appearance = buildAppearance(dentofacial);
    const medicalFactors = buildMedicalFactors(patientMeta, allergies);

    const riskAssessment = { gumHealth, toothDecay, biteAlignment, appearance, medicalFactors };

    const homeCare = buildHomeCare(periodontal);
    const concerns = buildConcerns(riskAssessment);
    const showcase = await buildShowcase(patientId);

    return {
      riskAssessment,
      homeCare,
      concerns,
      showcase,
      metadata: {
        patientId,
        appointmentId: aptId ?? null,
        examDate: aptDateTime?.toISOString() ?? null,
        providerName,
      },
    };
  }
}

export const patientReportService = new PatientReportService();
