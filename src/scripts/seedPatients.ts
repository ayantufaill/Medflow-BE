import { patientService } from '../services/patient.service';
import { prisma } from '../config/db';

// ---------------------------------------------------------------------------
// Medical history helpers
// ---------------------------------------------------------------------------

import { DEFAULT_MEDICAL_HISTORY } from '../services/patient-history-defaults';

const buildMedicalSections = (
  overrides: Record<string, { answer: string; comment?: string; doctorNote?: string }> = {}
) => {
  const base = DEFAULT_MEDICAL_HISTORY.sections;

  return base.map((s) => {
    const ov = overrides[s.id] ?? {};
    return {
      ...s,
      comment: '',
      doctorNote: '',
      additionalInfo: [],
      ...ov,
      answer: (ov as any).answer ?? 'no',
    };
  });
};

// ---------------------------------------------------------------------------
// Medical history profiles
// ---------------------------------------------------------------------------

const MEDICAL_PROFILES = {

  /** Completely healthy adult — no conditions, no meds, ASA I */
  healthy: {
    generalInfo: {
      healthEstimate: 'Excellent',
      physicianName: 'Dr. Sarah Mitchell',
      physicianSpecialty: 'Internal Medicine',
      lastExamDate: '2025-01-15',
      purpose: 'Annual wellness exam',
      weight: '165',
      weightUnit: 'LBS',
      height: '5\'10"',
      heightUnit: 'FT/IN',
    },
    premed: { requiresPremed: false },
    risk: { asaClass: 'ASA 1', level: 'low' },
    sections: buildMedicalSections(),
    medications: [],
    supplements: [],
    review: { reviewedWithPatient: true, reviewedAt: '2025-03-01T10:00:00Z', signatureUrl: null },
  },

  /** Hypertensive on medication — well-controlled, ASA II */
  hypertensive: {
    generalInfo: {
      healthEstimate: 'Good',
      physicianName: 'Dr. James Patel',
      physicianSpecialty: 'Cardiology',
      lastExamDate: '2024-11-20',
      purpose: 'Blood pressure follow-up',
      weight: '195',
      weightUnit: 'LBS',
      height: '5\'9"',
      heightUnit: 'FT/IN',
    },
    premed: { requiresPremed: false },
    risk: { asaClass: 'ASA 2', level: 'moderate' },
    sections: buildMedicalSections({
      'physician-care':      { answer: 'yes', comment: 'Cardiology - hypertension management' },
      'high-blood-pressure': { answer: 'yes', comment: 'Controlled with lisinopril 10mg daily', doctorNote: 'BP 128/82 at last visit — stable' },
    }),
    medications: [
      { id: '1', drug: 'Lisinopril', dosage: '10mg once daily', purpose: 'High blood pressure' },
      { id: '2', drug: 'Atorvastatin', dosage: '20mg once daily at bedtime', purpose: 'Cholesterol' },
    ],
    supplements: [
      { id: '1', drug: 'Fish Oil', dosage: '1000mg daily', purpose: 'Cardiovascular health' },
    ],
    review: { reviewedWithPatient: true, reviewedAt: '2025-02-15T09:30:00Z', signatureUrl: null },
  },

  /** Type 2 Diabetic — diet and medication controlled, ASA II */
  diabetic: {
    generalInfo: {
      healthEstimate: 'Fair',
      physicianName: 'Dr. Linda Nguyen',
      physicianSpecialty: 'Endocrinology',
      lastExamDate: '2025-02-10',
      purpose: 'Diabetes management',
      weight: '210',
      weightUnit: 'LBS',
      height: '5\'8"',
      heightUnit: 'FT/IN',
    },
    premed: { requiresPremed: false },
    risk: { asaClass: 'ASA 2', level: 'moderate' },
    sections: buildMedicalSections({
      'physician-care':      { answer: 'yes', comment: 'Endocrinology and PCP' },
      'high-blood-pressure': { answer: 'yes', comment: 'Managed with medication' },
      'diabetes':            { answer: 'yes', comment: 'Type 2, diagnosed 2018, HbA1c 7.1%', doctorNote: 'Monitor for delayed healing' },
      'gastric':             { answer: 'yes', comment: 'Mild GERD, on omeprazole' },
    }),
    medications: [
      { id: '1', drug: 'Metformin', dosage: '1000mg twice daily', purpose: 'Type 2 diabetes' },
      { id: '2', drug: 'Lisinopril', dosage: '5mg once daily', purpose: 'High blood pressure' },
      { id: '3', drug: 'Omeprazole', dosage: '20mg once daily', purpose: 'Gastric reflux' },
    ],
    supplements: [
      { id: '1', drug: 'Vitamin D3', dosage: '2000 IU daily', purpose: 'Bone health' },
      { id: '2', drug: 'Magnesium', dosage: '400mg daily', purpose: 'Blood sugar regulation' },
    ],
    review: { reviewedWithPatient: true, reviewedAt: '2025-01-20T14:00:00Z', signatureUrl: null },
  },

  /** Multiple chronic conditions — diabetes + HTN + arthritis, ASA III */
  complex: {
    generalInfo: {
      healthEstimate: 'Fair',
      physicianName: 'Dr. Robert Chen',
      physicianSpecialty: 'Internal Medicine',
      lastExamDate: '2025-03-05',
      purpose: 'Chronic disease management',
      weight: '230',
      weightUnit: 'LBS',
      height: '5\'11"',
      heightUnit: 'FT/IN',
    },
    premed: { requiresPremed: true },
    risk: { asaClass: 'ASA 3', level: 'high' },
    sections: buildMedicalSections({
      'hospitalization':     { answer: 'yes', comment: 'Hip replacement surgery 2021, cardiac stent 2019' },
      'physician-care':      { answer: 'yes', comment: 'Multiple specialists — cardiology, endocrinology, orthopedics' },
      'heart-disease':       { answer: 'yes', comment: 'Coronary artery disease, stent placed 2019', doctorNote: 'Requires premed per cardiologist recommendation' },
      'high-blood-pressure': { answer: 'yes', comment: 'Controlled, multiple medications' },
      'heart-murmur':        { answer: 'yes', comment: 'Mitral valve prolapse, confirmed by echo', doctorNote: 'Amoxicillin 2g 1hr before procedure' },
      'blood-thinner':       { answer: 'yes', comment: 'Aspirin 81mg daily, clopidogrel', doctorNote: 'Do NOT stop anticoagulants without cardiology consult' },
      'diabetes':            { answer: 'yes', comment: 'Type 2, insulin-dependent, HbA1c 8.2%' },
      'arthritis':           { answer: 'yes', comment: 'Osteoarthritis — hips and knees, joint replacement' },
      'sleep-apnea':         { answer: 'yes', comment: 'Uses CPAP nightly' },
      'gastric':             { answer: 'yes', comment: 'GERD on PPI therapy' },
    }),
    medications: [
      { id: '1', drug: 'Aspirin',          dosage: '81mg once daily',         purpose: 'Antiplatelet / cardiac' },
      { id: '2', drug: 'Clopidogrel',      dosage: '75mg once daily',         purpose: 'Antiplatelet / cardiac stent' },
      { id: '3', drug: 'Metoprolol',       dosage: '50mg twice daily',        purpose: 'Heart rate / blood pressure' },
      { id: '4', drug: 'Amlodipine',       dosage: '10mg once daily',         purpose: 'Blood pressure' },
      { id: '5', drug: 'Insulin Glargine', dosage: '30 units at bedtime',     purpose: 'Type 2 diabetes' },
      { id: '6', drug: 'Metformin',        dosage: '500mg twice daily',       purpose: 'Type 2 diabetes' },
      { id: '7', drug: 'Pantoprazole',     dosage: '40mg once daily',         purpose: 'GERD' },
      { id: '8', drug: 'Naproxen',         dosage: '500mg as needed for pain', purpose: 'Arthritis pain' },
    ],
    supplements: [
      { id: '1', drug: 'Vitamin D3', dosage: '4000 IU daily', purpose: 'Bone density' },
      { id: '2', drug: 'Calcium',    dosage: '1200mg daily',  purpose: 'Bone density' },
      { id: '3', drug: 'CoQ10',      dosage: '200mg daily',   purpose: 'Cardiac support' },
    ],
    review: { reviewedWithPatient: true, reviewedAt: '2025-03-10T11:00:00Z', signatureUrl: null },
  },

  /** Respiratory conditions — asthma + sleep apnea, ASA II */
  respiratory: {
    generalInfo: {
      healthEstimate: 'Good',
      physicianName: 'Dr. Angela Torres',
      physicianSpecialty: 'Pulmonology',
      lastExamDate: '2024-12-05',
      purpose: 'Asthma and sleep apnea management',
      weight: '155',
      weightUnit: 'LBS',
      height: '5\'6"',
      heightUnit: 'FT/IN',
    },
    premed: { requiresPremed: false },
    risk: { asaClass: 'ASA 2', level: 'moderate' },
    sections: buildMedicalSections({
      'physician-care': { answer: 'yes', comment: 'Pulmonologist - asthma/sleep apnea' },
      'asthma':         { answer: 'yes', comment: 'Mild persistent asthma, well-controlled', doctorNote: 'Patient should bring rescue inhaler to all appointments' },
      'sleep-apnea':    { answer: 'yes', comment: 'Diagnosed 2022, uses CPAP at 8cmH2O' },
      'allergies':      { answer: 'yes', comment: 'Seasonal allergies — pollen, dust mites' },
    }),
    medications: [
      { id: '1', drug: 'Fluticasone/Salmeterol (Advair)', dosage: '250/50 mcg inhaled twice daily', purpose: 'Asthma maintenance' },
      { id: '2', drug: 'Albuterol (ProAir HFA)',          dosage: '2 puffs as needed',              purpose: 'Asthma rescue' },
      { id: '3', drug: 'Montelukast',                     dosage: '10mg once daily at bedtime',     purpose: 'Allergy / asthma' },
      { id: '4', drug: 'Cetirizine',                      dosage: '10mg once daily',                purpose: 'Seasonal allergies' },
    ],
    supplements: [
      { id: '1', drug: 'Vitamin C', dosage: '1000mg daily', purpose: 'Immune support' },
    ],
    review: { reviewedWithPatient: true, reviewedAt: '2025-02-20T13:00:00Z', signatureUrl: null },
  },

  /** Young/pediatric — minimal history, healthy, ASA I */
  young: {
    generalInfo: {
      healthEstimate: 'Excellent',
      physicianName: 'Dr. Kevin Walsh',
      physicianSpecialty: 'Pediatrics / Family Medicine',
      lastExamDate: '2025-01-08',
      purpose: 'Annual physical',
      weight: '140',
      weightUnit: 'LBS',
      height: '5\'5"',
      heightUnit: 'FT/IN',
    },
    premed: { requiresPremed: false },
    risk: { asaClass: 'ASA 1', level: 'low' },
    sections: buildMedicalSections(),
    medications: [],
    supplements: [
      { id: '1', drug: 'Multivitamin', dosage: '1 tablet daily', purpose: 'General health' },
    ],
    review: { reviewedWithPatient: true, reviewedAt: '2025-03-01T08:30:00Z', signatureUrl: null },
  },
};

// ---------------------------------------------------------------------------
// Dental history helpers
// ---------------------------------------------------------------------------

import { DEFAULT_DENTAL_HISTORY } from '../services/patient-history-defaults';

const buildDentalHistorySections = (
  overrides: Record<string, { answer: string; scale?: string; note?: string; additionalInfo?: string }> = {}
) => {
  const mapSection = (section: any[]) => section.map(s => {
    const ov = overrides[s.id] ?? {};
    return { ...s, ...ov, answer: (ov as any).answer ?? 'No' };
  });

  return {
    personalHistory: mapSection(DEFAULT_DENTAL_HISTORY.personalHistory),
    gumAndBone: mapSection(DEFAULT_DENTAL_HISTORY.gumAndBone),
    toothStructure: mapSection(DEFAULT_DENTAL_HISTORY.toothStructure),
    biteAndJawJoint: mapSection(DEFAULT_DENTAL_HISTORY.biteAndJawJoint),
    smileCharacteristics: mapSection(DEFAULT_DENTAL_HISTORY.smileCharacteristics),
  };
};

// ---------------------------------------------------------------------------
// Dental history profiles
// ---------------------------------------------------------------------------

const DENTAL_PROFILES = {

  /** Excellent oral health — regular 6-month visits, no concerns */
  excellent: {
    generalInfo: {
      mouthCondition: 'Excellent',
      previousDentist: 'Dr. Mark Sullivan, DDS',
      recentExamDate: '2024-09-15',
      recentTreatmentDate: '2024-09-15',
      immediateConcern: 'Routine cleaning and exam',
      patientSince: '2022',
      recentXrayDate: '2024-09-15',
      dentistVisitFrequency: '6mo',
    },
    ...buildDentalHistorySections(),
    review: { reviewedWithPatient: true, reviewedAt: '2025-03-01T10:00:00Z', signatureDataUrl: null },
  },

  /** Bruxism + mild anxiety — grinds teeth, wears nightguard */
  bruxism: {
    generalInfo: {
      mouthCondition: 'Good',
      previousDentist: 'Dr. Priya Sharma, DDS',
      recentExamDate: '2024-10-22',
      recentTreatmentDate: '2024-10-22',
      immediateConcern: 'Jaw soreness and worn enamel on molars',
      patientSince: '2020',
      recentXrayDate: '2024-10-22',
      dentistVisitFrequency: '6mo',
    },
    ...buildDentalHistorySections({
      'fearful-treatment':  { answer: 'Yes', scale: '3', note: 'Mild anxiety — prefers to know what to expect before each step' },
      'clench-grind':       { answer: 'Yes', note: 'Wears custom nightguard, worse during periods of stress', additionalInfo: 'Nightguard made by previous dentist — 2023' },
      'sensitive-teeth':    { answer: 'Yes', scale: '4', note: 'Sensitivity to cold on lower molars' },
      'jaw-joint-pain':     { answer: 'Yes', note: 'Morning jaw stiffness, occasional clicking on right side' },
    }),
    review: { reviewedWithPatient: true, reviewedAt: '2025-02-15T09:30:00Z', signatureDataUrl: null },
  },

  /** Post oral surgery — wisdom teeth removed, occasional sensitivity */
  post_oral_surgery: {
    generalInfo: {
      mouthCondition: 'Good',
      previousDentist: 'Dr. Tom Erikson, DMD',
      recentExamDate: '2024-08-10',
      recentTreatmentDate: '2023-11-05',
      immediateConcern: 'Sensitivity on lower right — possible cracked molar',
      patientSince: '2019',
      recentXrayDate: '2024-08-10',
      dentistVisitFrequency: '1yr',
    },
    ...buildDentalHistorySections({
      'missing-teeth-trauma': { answer: 'Yes', note: 'All 4 wisdom teeth extracted November 2023, uneventful recovery. Upper right #3 extracted due to fracture (2021)' },
      'sensitive-teeth':      { answer: 'Yes', scale: '5', note: 'Cold sensitivity lower right quadrant for past 3 months' },
      'treatment-complications': { answer: 'Yes', note: 'Dry socket after #32 extraction — resolved with irrigation' },
    }),
    review: { reviewedWithPatient: true, reviewedAt: '2025-01-20T14:00:00Z', signatureDataUrl: null },
  },

  /** Complex dental history — implants, partials, significant history */
  complex: {
    generalInfo: {
      mouthCondition: 'Fair',
      previousDentist: 'Dr. Nancy Flores, DDS',
      recentExamDate: '2024-07-18',
      recentTreatmentDate: '2024-11-30',
      immediateConcern: 'Loose lower partial and gum bleeding around implant #19',
      patientSince: '2015',
      recentXrayDate: '2024-07-18',
      dentistVisitFrequency: '6mo',
    },
    ...buildDentalHistorySections({
      'unfavorable-experience':  { answer: 'Yes', note: 'Bad experience with numbing — took multiple injections to get numb' },
      'trouble-getting-numb':    { answer: 'Yes', note: 'Prolonged numbness after block injection approx 2019' },
      'missing-teeth-trauma':    { answer: 'Yes', note: 'Multiple extractions and implant placement #19 (2022). Multiple posterior teeth missing — lower partial denture in place' },
      'bleeding-gums':           { answer: 'Yes', scale: '4', note: 'Bleeding around implant crown and posterior teeth when flossing' },
      'saliva-amount':           { answer: 'Yes', note: 'On multiple medications — xerostomia is a side effect' },
    }),
    review: { reviewedWithPatient: true, reviewedAt: '2025-03-10T11:00:00Z', signatureDataUrl: null },
  },

  /** New/young patient — limited history, good hygiene */
  new_patient: {
    generalInfo: {
      mouthCondition: 'Good',
      previousDentist: 'Dr. Brian Lee, DDS (pediatric)',
      recentExamDate: '2023-05-20',
      recentTreatmentDate: '2022-09-14',
      immediateConcern: 'Establishing care — moved to the area',
      patientSince: '2025',
      recentXrayDate: '2023-05-20',
      dentistVisitFrequency: '1yr',
    },
    ...buildDentalHistorySections({
      'orthodontic-treatment': { answer: 'Yes', note: 'Braces age 13–16, retainer worn nightly' },
      'sensitive-teeth':       { answer: 'Yes', scale: '2', note: 'Mild cold sensitivity upper front teeth' },
    }),
    review: { reviewedWithPatient: true, reviewedAt: '2025-03-01T08:30:00Z', signatureDataUrl: null },
  },
};

// ---------------------------------------------------------------------------
// 25 mock US patients with complete data + history profile assignments
// ---------------------------------------------------------------------------

const patients: Array<{
  data: Parameters<typeof patientService.createPatient>[0];
  medicalProfile: keyof typeof MEDICAL_PROFILES;
  dentalProfile: keyof typeof DENTAL_PROFILES;
}> = [
  {
    medicalProfile: 'hypertensive',
    dentalProfile: 'bruxism',
    data: {
      firstName: 'James', lastName: 'Harrison', middleName: 'Robert', preferredName: 'Jim', title: 'Mr.',
      dateOfBirth: new Date('1978-04-12'), gender: 'male', sexAtBirth: 'male', genderIdentity: 'male',
      ssn: '901-45-6781', phonePrimary: '12145559101', phoneSecondary: '12145559102',
      email: 'james.harrison@example.com',
      address: { line1: '142 Maple Street', line2: 'Apt 3B', city: 'Dallas', state: 'TX', postalCode: '75201' },
      emergencyContact: { name: 'Linda Harrison', relationship: 'Spouse', phone: '12145559103' },
      preferredLanguage: 'en', communicationPreference: 'email', portalAccessEnabled: true,
      maritalStatus: 'married', occupation: 'Software Engineer', employer: 'TechCorp Inc.',
      patientProfileType: 'adult',
      workAddress: { country: 'US', line1: '500 Commerce St', city: 'Dallas', state: 'TX', postalCode: '75202' },
      referralSource: 'Google Search', notes: 'Patient prefers morning appointments.',
    },
  },
  {
    medicalProfile: 'healthy',
    dentalProfile: 'post_oral_surgery',
    data: {
      firstName: 'Maria', lastName: 'Gonzalez', middleName: 'Elena', preferredName: 'Mari', title: 'Ms.',
      dateOfBirth: new Date('1990-07-23'), gender: 'female', sexAtBirth: 'female', genderIdentity: 'female',
      ssn: '902-61-4823', phonePrimary: '13055559201', phoneSecondary: '13055559202',
      email: 'maria.gonzalez@example.com',
      address: { line1: '879 Coral Way', line2: 'Suite 100', city: 'Miami', state: 'FL', postalCode: '33145' },
      emergencyContact: { name: 'Carlos Gonzalez', relationship: 'Brother', phone: '13055559203' },
      preferredLanguage: 'es', communicationPreference: 'phone', portalAccessEnabled: true,
      maritalStatus: 'single', occupation: 'Registered Nurse', employer: 'Miami General Hospital',
      patientProfileType: 'adult',
      workAddress: { country: 'US', line1: '1611 NW 12th Ave', city: 'Miami', state: 'FL', postalCode: '33136' },
      referralSource: 'Physician Referral', notes: 'Spanish preferred for all written communications.',
    },
  },
  {
    medicalProfile: 'healthy',
    dentalProfile: 'excellent',
    data: {
      firstName: 'David', lastName: 'Kim', middleName: 'Sung',
      dateOfBirth: new Date('1985-11-08'), gender: 'male', sexAtBirth: 'male', genderIdentity: 'male',
      ssn: '903-77-5514', phonePrimary: '12125559301',
      email: 'david.kim@example.com',
      address: { line1: '215 E 68th Street', city: 'New York', state: 'NY', postalCode: '10065' },
      emergencyContact: { name: 'Susan Kim', relationship: 'Mother', phone: '12125559302' },
      preferredLanguage: 'en', communicationPreference: 'sms', portalAccessEnabled: false,
      maritalStatus: 'single', occupation: 'Financial Analyst', employer: 'Goldman Partners LLC',
      patientProfileType: 'adult', referralSource: 'Friend Referral',
    },
  },
  {
    medicalProfile: 'hypertensive',
    dentalProfile: 'excellent',
    data: {
      firstName: 'Patricia', lastName: 'Williams', middleName: 'Anne', preferredName: 'Pat', title: 'Mrs.',
      dateOfBirth: new Date('1962-02-14'), gender: 'female', sexAtBirth: 'female', genderIdentity: 'female',
      ssn: '904-32-8876', phonePrimary: '13125559401', phoneSecondary: '13125559402',
      email: 'patricia.williams@example.com',
      address: { line1: '3427 N Clark Street', city: 'Chicago', state: 'IL', postalCode: '60657' },
      emergencyContact: { name: 'Robert Williams', relationship: 'Spouse', phone: '13125559403' },
      preferredLanguage: 'en', communicationPreference: 'portal', portalAccessEnabled: true,
      maritalStatus: 'married', occupation: 'Teacher', employer: 'Chicago Public Schools',
      patientProfileType: 'adult', referralSource: 'Insurance Directory', notes: 'Has latex allergy on file.',
    },
  },
  {
    medicalProfile: 'young',
    dentalProfile: 'new_patient',
    data: {
      firstName: 'Michael', lastName: 'Thompson',
      dateOfBirth: new Date('1995-09-30'), gender: 'male', sexAtBirth: 'male', genderIdentity: 'male',
      ssn: '905-88-2341', phonePrimary: '16025559501',
      email: 'michael.thompson@example.com',
      address: { line1: '4820 E Indian School Rd', city: 'Phoenix', state: 'AZ', postalCode: '85018' },
      emergencyContact: { name: 'Karen Thompson', relationship: 'Mother', phone: '16025559502' },
      preferredLanguage: 'en', communicationPreference: 'email', portalAccessEnabled: true,
      maritalStatus: 'single', occupation: 'Graduate Student', employer: 'Arizona State University',
      patientProfileType: 'adult', referralSource: 'Online Search',
    },
  },
  {
    medicalProfile: 'respiratory',
    dentalProfile: 'bruxism',
    data: {
      firstName: 'Jennifer', lastName: 'Martinez', middleName: 'Rose', title: 'Ms.',
      dateOfBirth: new Date('1988-05-17'), gender: 'female', sexAtBirth: 'female', genderIdentity: 'female',
      ssn: '906-14-7723', phonePrimary: '14045559601', phoneSecondary: '14045559602',
      email: 'jennifer.martinez@example.com',
      address: { line1: '756 Peachtree St NE', line2: 'Apt 12', city: 'Atlanta', state: 'GA', postalCode: '30308' },
      emergencyContact: { name: 'Luis Martinez', relationship: 'Father', phone: '14045559603' },
      preferredLanguage: 'en', communicationPreference: 'phone', portalAccessEnabled: false,
      maritalStatus: 'divorced', occupation: 'Marketing Manager', employer: 'Delta Creative Agency',
      patientProfileType: 'adult', referralSource: 'Yelp Review',
    },
  },
  {
    medicalProfile: 'complex',
    dentalProfile: 'complex',
    data: {
      firstName: 'Robert', lastName: 'Johnson', middleName: 'Lee', title: 'Mr.',
      dateOfBirth: new Date('1955-12-03'), gender: 'male', sexAtBirth: 'male', genderIdentity: 'male',
      ssn: '907-56-3398', phonePrimary: '12675559701', phoneSecondary: '12675559702',
      email: 'robert.johnson@example.com',
      address: { line1: '1820 Fifth Ave N', city: 'Birmingham', state: 'AL', postalCode: '35203' },
      emergencyContact: { name: 'Betty Johnson', relationship: 'Spouse', phone: '12675559703' },
      preferredLanguage: 'en', communicationPreference: 'phone', portalAccessEnabled: false,
      maritalStatus: 'married', occupation: 'Retired', patientProfileType: 'adult',
      referralSource: 'Family Referral', notes: 'Diabetic patient — monitor blood glucose levels.',
    },
  },
  {
    medicalProfile: 'young',
    dentalProfile: 'new_patient',
    data: {
      firstName: 'Ashley', lastName: 'Brown',
      dateOfBirth: new Date('2001-03-25'), gender: 'female', sexAtBirth: 'female', genderIdentity: 'female',
      ssn: '908-23-6614', phonePrimary: '12065559801',
      email: 'ashley.brown@example.com',
      address: { line1: '4321 Aurora Ave N', city: 'Seattle', state: 'WA', postalCode: '98103' },
      emergencyContact: { name: 'Diane Brown', relationship: 'Mother', phone: '12065559802' },
      preferredLanguage: 'en', communicationPreference: 'sms', portalAccessEnabled: true,
      maritalStatus: 'single', occupation: 'Barista', employer: 'Starbucks',
      patientProfileType: 'adult', referralSource: 'Social Media',
    },
  },
  {
    medicalProfile: 'hypertensive',
    dentalProfile: 'excellent',
    data: {
      firstName: 'Christopher', lastName: 'Davis', middleName: 'Alan', title: 'Mr.',
      dateOfBirth: new Date('1972-08-19'), gender: 'male', sexAtBirth: 'male', genderIdentity: 'male',
      ssn: '909-67-1145', phonePrimary: '17135559901', phoneSecondary: '17135559902',
      email: 'christopher.davis@example.com',
      address: { line1: '6201 Richmond Ave', line2: 'Unit 210', city: 'Houston', state: 'TX', postalCode: '77057' },
      emergencyContact: { name: 'Megan Davis', relationship: 'Spouse', phone: '17135559903' },
      preferredLanguage: 'en', communicationPreference: 'email', portalAccessEnabled: true,
      maritalStatus: 'married', occupation: 'Petroleum Engineer', employer: 'Shell Oil Company',
      patientProfileType: 'adult',
      workAddress: { country: 'US', line1: '150 N Dairy Ashford Rd', city: 'Houston', state: 'TX', postalCode: '77079' },
      referralSource: 'Company Benefit Plan',
    },
  },
  {
    medicalProfile: 'healthy',
    dentalProfile: 'bruxism',
    data: {
      firstName: 'Amanda', lastName: 'Wilson', middleName: 'Grace', preferredName: 'Mandy', title: 'Ms.',
      dateOfBirth: new Date('1983-06-27'), gender: 'female', sexAtBirth: 'female', genderIdentity: 'female',
      ssn: '911-34-7782', phonePrimary: '16175551001',
      email: 'amanda.wilson@example.com',
      address: { line1: '29 Commonwealth Ave', city: 'Boston', state: 'MA', postalCode: '02116' },
      emergencyContact: { name: 'Thomas Wilson', relationship: 'Father', phone: '16175551002' },
      preferredLanguage: 'en', communicationPreference: 'portal', portalAccessEnabled: true,
      maritalStatus: 'single', occupation: 'Attorney', employer: 'Sullivan & Cromwell LLP',
      patientProfileType: 'adult',
      workAddress: { country: 'US', line1: '125 Broad St', city: 'Boston', state: 'MA', postalCode: '02110' },
      referralSource: 'Colleague Referral',
    },
  },
  {
    medicalProfile: 'diabetic',
    dentalProfile: 'complex',
    data: {
      firstName: 'Matthew', lastName: 'Anderson', middleName: 'Paul',
      dateOfBirth: new Date('1968-10-05'), gender: 'male', sexAtBirth: 'male', genderIdentity: 'male',
      ssn: '912-78-5523', phonePrimary: '16155551101', phoneSecondary: '16155551102',
      email: 'matthew.anderson@example.com',
      address: { line1: '812 Woodward Ave', city: 'Detroit', state: 'MI', postalCode: '48226' },
      emergencyContact: { name: 'Nancy Anderson', relationship: 'Spouse', phone: '16155551103' },
      preferredLanguage: 'en', communicationPreference: 'phone', portalAccessEnabled: false,
      maritalStatus: 'married', occupation: 'Automotive Technician', employer: 'Ford Motor Company',
      patientProfileType: 'adult', referralSource: 'Union Health Plan',
    },
  },
  {
    medicalProfile: 'young',
    dentalProfile: 'excellent',
    data: {
      firstName: 'Sophia', lastName: 'Taylor',
      dateOfBirth: new Date('1997-01-14'), gender: 'female', sexAtBirth: 'female', genderIdentity: 'female',
      ssn: '913-21-8864', phonePrimary: '19195551201',
      email: 'sophia.taylor@example.com',
      address: { line1: '318 W Morgan St', city: 'Raleigh', state: 'NC', postalCode: '27601' },
      emergencyContact: { name: 'Carol Taylor', relationship: 'Mother', phone: '19195551202' },
      preferredLanguage: 'en', communicationPreference: 'email', portalAccessEnabled: true,
      maritalStatus: 'single', occupation: 'UX Designer', employer: 'Red Hat Inc.',
      patientProfileType: 'adult', referralSource: 'Online Search',
    },
  },
  {
    medicalProfile: 'hypertensive',
    dentalProfile: 'post_oral_surgery',
    data: {
      firstName: 'Daniel', lastName: 'Jackson', middleName: 'Wayne', title: 'Mr.',
      dateOfBirth: new Date('1975-09-11'), gender: 'male', sexAtBirth: 'male', genderIdentity: 'male',
      ssn: '914-53-2297', phonePrimary: '16155551301', phoneSecondary: '16155551302',
      email: 'daniel.jackson@example.com',
      address: { line1: '1540 Main St', line2: 'Floor 3', city: 'Columbus', state: 'OH', postalCode: '43215' },
      emergencyContact: { name: 'Cheryl Jackson', relationship: 'Spouse', phone: '16155551303' },
      preferredLanguage: 'en', communicationPreference: 'sms', portalAccessEnabled: true,
      maritalStatus: 'married', occupation: 'Construction Manager', employer: 'Turner Construction',
      patientProfileType: 'adult', referralSource: 'Insurance Directory',
    },
  },
  {
    medicalProfile: 'healthy',
    dentalProfile: 'new_patient',
    data: {
      firstName: 'Emily', lastName: 'White', middleName: 'Claire', preferredName: 'Em', title: 'Ms.',
      dateOfBirth: new Date('1993-04-02'), gender: 'female', sexAtBirth: 'female', genderIdentity: 'female',
      ssn: '915-86-4431', phonePrimary: '14435551401',
      email: 'emily.white@example.com',
      address: { line1: '901 Light St', city: 'Baltimore', state: 'MD', postalCode: '21230' },
      emergencyContact: { name: 'George White', relationship: 'Father', phone: '14435551402' },
      preferredLanguage: 'en', communicationPreference: 'email', portalAccessEnabled: true,
      maritalStatus: 'single', occupation: 'Pharmacist', employer: 'CVS Health',
      patientProfileType: 'adult', referralSource: 'Colleague Referral',
    },
  },
  {
    medicalProfile: 'diabetic',
    dentalProfile: 'post_oral_surgery',
    data: {
      firstName: 'Joshua', lastName: 'Harris',
      dateOfBirth: new Date('1980-07-07'), gender: 'male', sexAtBirth: 'male', genderIdentity: 'male',
      ssn: '916-42-9953', phonePrimary: '16155551501', phoneSecondary: '16155551502',
      email: 'joshua.harris@example.com',
      address: { line1: '333 W Vine St', city: 'Lexington', state: 'KY', postalCode: '40507' },
      emergencyContact: { name: 'Teresa Harris', relationship: 'Spouse', phone: '16155551503' },
      preferredLanguage: 'en', communicationPreference: 'phone', portalAccessEnabled: false,
      maritalStatus: 'married', occupation: 'Veterinarian', employer: 'Bluegrass Animal Clinic',
      patientProfileType: 'adult', referralSource: 'Friend Referral',
    },
  },
  {
    medicalProfile: 'young',
    dentalProfile: 'excellent',
    data: {
      firstName: 'Olivia', lastName: 'Martin', middleName: 'Jean', title: 'Ms.',
      dateOfBirth: new Date('1999-11-29'), gender: 'female', sexAtBirth: 'female', genderIdentity: 'female',
      ssn: '917-19-3376', phonePrimary: '16155551601',
      email: 'olivia.martin@example.com',
      address: { line1: '222 S 4th St', city: 'Louisville', state: 'KY', postalCode: '40202' },
      emergencyContact: { name: 'Frank Martin', relationship: 'Father', phone: '16155551602' },
      preferredLanguage: 'en', communicationPreference: 'sms', portalAccessEnabled: true,
      maritalStatus: 'single', occupation: 'Dental Hygienist', employer: 'SmileCare Dental',
      patientProfileType: 'adult', referralSource: 'Social Media',
    },
  },
  {
    medicalProfile: 'complex',
    dentalProfile: 'complex',
    data: {
      firstName: 'Andrew', lastName: 'Garcia', middleName: 'Carlos', title: 'Mr.',
      dateOfBirth: new Date('1965-03-18'), gender: 'male', sexAtBirth: 'male', genderIdentity: 'male',
      ssn: '918-65-7718', phonePrimary: '15055551701', phoneSecondary: '15055551702',
      email: 'andrew.garcia@example.com',
      address: { line1: '408 Old Santa Fe Trail', city: 'Santa Fe', state: 'NM', postalCode: '87501' },
      emergencyContact: { name: 'Rosa Garcia', relationship: 'Spouse', phone: '15055551703' },
      preferredLanguage: 'es', communicationPreference: 'phone', portalAccessEnabled: false,
      maritalStatus: 'married', occupation: 'Architect', employer: 'Garcia & Associates Design',
      patientProfileType: 'adult', referralSource: 'Physician Referral',
      notes: 'Hypertension — on lisinopril 10mg daily.',
    },
  },
  {
    medicalProfile: 'healthy',
    dentalProfile: 'bruxism',
    data: {
      firstName: 'Samantha', lastName: 'Lee', middleName: 'Joy', preferredName: 'Sam',
      dateOfBirth: new Date('1991-08-08'), gender: 'female', sexAtBirth: 'female', genderIdentity: 'female',
      ssn: '919-38-5541', phonePrimary: '16155551801',
      email: 'samantha.lee@example.com',
      address: { line1: '600 Nicollet Mall', city: 'Minneapolis', state: 'MN', postalCode: '55402' },
      emergencyContact: { name: 'Peter Lee', relationship: 'Father', phone: '16155551802' },
      preferredLanguage: 'en', communicationPreference: 'email', portalAccessEnabled: true,
      maritalStatus: 'single', occupation: 'Accountant', employer: 'Deloitte',
      patientProfileType: 'adult', referralSource: 'Online Search',
    },
  },
  {
    medicalProfile: 'complex',
    dentalProfile: 'complex',
    data: {
      firstName: 'Kevin', lastName: 'Robinson', middleName: 'James', title: 'Mr.',
      dateOfBirth: new Date('1958-06-15'), gender: 'male', sexAtBirth: 'male', genderIdentity: 'male',
      ssn: '921-74-2289', phonePrimary: '18435551901', phoneSecondary: '18435551902',
      email: 'kevin.robinson@example.com',
      address: { line1: '115 Meeting St', city: 'Charleston', state: 'SC', postalCode: '29401' },
      emergencyContact: { name: 'Dorothy Robinson', relationship: 'Spouse', phone: '18435551903' },
      preferredLanguage: 'en', communicationPreference: 'portal', portalAccessEnabled: true,
      maritalStatus: 'married', occupation: 'Retired Police Officer', patientProfileType: 'adult',
      referralSource: 'Family Referral', notes: 'Knee replacement surgery 2020. Annual x-rays required.',
    },
  },
  {
    medicalProfile: 'young',
    dentalProfile: 'new_patient',
    data: {
      firstName: 'Lauren', lastName: 'Clark',
      dateOfBirth: new Date('2004-12-20'), gender: 'female', sexAtBirth: 'female', genderIdentity: 'female',
      ssn: '922-47-6613', phonePrimary: '16155552001',
      email: 'lauren.clark@example.com',
      address: { line1: '2401 Pennsylvania Ave NW', city: 'Washington', state: 'DC', postalCode: '20037' },
      emergencyContact: { name: 'Sandra Clark', relationship: 'Mother', phone: '16155552002' },
      preferredLanguage: 'en', communicationPreference: 'sms', portalAccessEnabled: true,
      maritalStatus: 'single', occupation: 'College Student', employer: 'Georgetown University',
      patientProfileType: 'adult', referralSource: 'Campus Health Referral',
    },
  },
  {
    medicalProfile: 'healthy',
    dentalProfile: 'post_oral_surgery',
    data: {
      firstName: 'Tyler', lastName: 'Lewis', middleName: 'Grant', title: 'Mr.',
      dateOfBirth: new Date('1987-02-28'), gender: 'male', sexAtBirth: 'male', genderIdentity: 'male',
      ssn: '923-81-3354', phonePrimary: '13035552101', phoneSecondary: '13035552102',
      email: 'tyler.lewis@example.com',
      address: { line1: '1560 Blake St', line2: 'Unit 4', city: 'Denver', state: 'CO', postalCode: '80202' },
      emergencyContact: { name: 'Allison Lewis', relationship: 'Spouse', phone: '13035552103' },
      preferredLanguage: 'en', communicationPreference: 'email', portalAccessEnabled: true,
      maritalStatus: 'married', occupation: 'Data Scientist', employer: 'Palantir Technologies',
      patientProfileType: 'adult',
      workAddress: { country: 'US', line1: '1555 Blake St', city: 'Denver', state: 'CO', postalCode: '80202' },
      referralSource: 'Google Search',
    },
  },
  {
    medicalProfile: 'respiratory',
    dentalProfile: 'excellent',
    data: {
      firstName: 'Natalie', lastName: 'Walker', middleName: 'Anne', preferredName: 'Nat', title: 'Ms.',
      dateOfBirth: new Date('1977-05-10'), gender: 'female', sexAtBirth: 'female', genderIdentity: 'female',
      ssn: '924-16-8877', phonePrimary: '16155552201',
      email: 'natalie.walker@example.com',
      address: { line1: '400 Church St', city: 'Nashville', state: 'TN', postalCode: '37219' },
      emergencyContact: { name: 'Greg Walker', relationship: 'Spouse', phone: '16155552202' },
      preferredLanguage: 'en', communicationPreference: 'phone', portalAccessEnabled: false,
      maritalStatus: 'married', occupation: 'Physical Therapist', employer: 'Vanderbilt University Medical Center',
      patientProfileType: 'adult', referralSource: 'Insurance Directory',
    },
  },
  {
    medicalProfile: 'young',
    dentalProfile: 'new_patient',
    data: {
      firstName: 'Brandon', lastName: 'Hall',
      dateOfBirth: new Date('2010-09-03'), gender: 'male', sexAtBirth: 'male', genderIdentity: 'male',
      ssn: '925-59-4421', phonePrimary: '12255552301',
      email: 'brandon.hall@example.com',
      address: { line1: '701 Poydras St', city: 'New Orleans', state: 'LA', postalCode: '70139' },
      emergencyContact: { name: 'Brenda Hall', relationship: 'Mother', phone: '12255552302' },
      preferredLanguage: 'en', communicationPreference: 'phone', portalAccessEnabled: false,
      maritalStatus: 'single', patientProfileType: 'pediatric', guardianEmployer: 'Tulane University',
      referralSource: 'Pediatrician Referral', notes: 'Minor — parent/guardian consent required for all procedures.',
    },
  },
  {
    medicalProfile: 'healthy',
    dentalProfile: 'excellent',
    data: {
      firstName: 'Rachel', lastName: 'Young', middleName: 'Marie', title: 'Dr.',
      dateOfBirth: new Date('1970-01-22'), gender: 'female', sexAtBirth: 'female', genderIdentity: 'female',
      ssn: '926-92-6658', phonePrimary: '16085552401', phoneSecondary: '16085552402',
      email: 'rachel.young@example.com',
      address: { line1: '222 State St', city: 'Madison', state: 'WI', postalCode: '53703' },
      emergencyContact: { name: 'Mark Young', relationship: 'Spouse', phone: '16085552403' },
      preferredLanguage: 'en', communicationPreference: 'portal', portalAccessEnabled: true,
      maritalStatus: 'married', occupation: 'Physician', employer: 'UW Health',
      patientProfileType: 'adult',
      workAddress: { country: 'US', line1: '600 Highland Ave', city: 'Madison', state: 'WI', postalCode: '53792' },
      referralSource: 'Self Referral',
    },
  },
  {
    medicalProfile: 'diabetic',
    dentalProfile: 'bruxism',
    data: {
      firstName: 'Jason', lastName: 'Allen', middleName: 'Scott', title: 'Mr.',
      dateOfBirth: new Date('1982-12-11'), gender: 'male', sexAtBirth: 'male', genderIdentity: 'male',
      ssn: '927-28-1193', phonePrimary: '19165552501', phoneSecondary: '19165552502',
      email: 'jason.allen@example.com',
      address: { line1: '1415 L Street', city: 'Sacramento', state: 'CA', postalCode: '95814' },
      emergencyContact: { name: 'Monica Allen', relationship: 'Spouse', phone: '19165552503' },
      preferredLanguage: 'en', communicationPreference: 'email', portalAccessEnabled: true,
      maritalStatus: 'married', occupation: 'Civil Engineer', employer: 'California Department of Transportation',
      patientProfileType: 'adult',
      workAddress: { country: 'US', line1: '1120 N Street', city: 'Sacramento', state: 'CA', postalCode: '95814' },
      referralSource: 'Yelp Review', notes: 'Prefers fluoride-free treatments when possible.',
    },
  },
];

// ---------------------------------------------------------------------------
// Seed runner
// ---------------------------------------------------------------------------

const seedPatients = async () => {
  let seedUserId: string | undefined;
  try {
    const adminUser = await prisma.userod.findFirst({ orderBy: { UserNum: 'asc' } });
    if (adminUser) seedUserId = adminUser.UserNum.toString();
  } catch {
    // proceed without userId
  }

  let created = 0;
  let skipped = 0;
  let historyFailed = 0;

  for (const { data, medicalProfile, dentalProfile } of patients) {
    let patient: Awaited<ReturnType<typeof patientService.createPatient>> | null = null;

    // 1. Create patient — on duplicate, look up the existing record instead
    try {
      patient = await patientService.createPatient(data, seedUserId);
      console.log(`  Created: ${data.firstName} ${data.lastName}`);
      created++;
    } catch (error: any) {
      if (error?.statusCode === 409 || error?.message?.includes('already exist')) {
        try {
          const duplicates = await patientService.findDuplicatePatients({
            firstName: data.firstName,
            lastName: data.lastName,
            dateOfBirth: data.dateOfBirth,
            ...(data.phonePrimary ? { phonePrimary: data.phonePrimary } : {}),
            ...(data.email       ? { email: data.email }               : {}),
          });
          if (duplicates.length > 0) {
            patient = await patientService.getPatientByIdWithSSN(duplicates[0]._id);
            console.log(`  Existing: ${data.firstName} ${data.lastName} — updating histories`);
            skipped++;
          }
        } catch {
          console.error(`  Could not resolve existing patient: ${data.firstName} ${data.lastName}`);
          continue;
        }
      } else {
        console.error(`  Failed:  ${data.firstName} ${data.lastName} — ${error?.message}`);
        continue;
      }
    }

    if (!patient) continue;

    // 2. Seed medical history
    try {
      await patientService.updateStructuredMedicalHistory(patient._id, MEDICAL_PROFILES[medicalProfile], seedUserId);
    } catch (err: any) {
      console.warn(`  Medical history failed for ${data.firstName} ${data.lastName}: ${err?.message}`);
      historyFailed++;
    }

    // 3. Seed dental history
    try {
      await patientService.updateDentalHistory(patient._id, DENTAL_PROFILES[dentalProfile], seedUserId);
    } catch (err: any) {
      console.warn(`  Dental history failed for ${data.firstName} ${data.lastName}: ${err?.message}`);
      historyFailed++;
    }
  }

  console.log(`\nPatient seeding complete.`);
  console.log(`  Created: ${created}  |  Skipped: ${skipped}  |  History errors: ${historyFailed}`);
};

seedPatients()
  .catch((err) => {
    console.error('Seed failed:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
