/**
 * Default structure for a new patient's medical history form.
 * Used as the base when no saved history exists yet.
 */
export const DEFAULT_MEDICAL_HISTORY = {
  generalInfo: {
    healthEstimate: '',
    physicianName: '',
    physicianSpecialty: '',
    lastExamDate: null,
    purpose: '',
    weight: '',
    weightUnit: 'LBS',
    height: '',
    heightUnit: 'FT/IN',
  },
  premed: {
    requiresPremed: false,
  },
  risk: {
    asaClass: 'ASA 1',
    level: 'low',
  },
  review: {
    reviewedWithPatient: false,
    reviewedAt: null,
    signatureUrl: null,
  },
  sections: [
    {
      id: 'hospitalization',
      number: 1,
      group: 'medical',
      question: 'hospitalization for illness or injury',
      answer: 'no',
      comment: '',
      doctorNote: '',
      additionalInfo: [],
    },
    {
      id: 'supplements',
      number: 50,
      group: 'medical',
      question: 'taking any of the following Supplements',
      answer: 'no',
      comment: '',
      doctorNote: '',
      additionalInfo: [],
    },
  ],
  medications: [],
  supplements: [],
};

/**
 * Default structure for a new patient's dental history form.
 * Used as the base when no saved history exists yet.
 */
export const DEFAULT_DENTAL_HISTORY = {
  generalInfo: {
    mouthCondition: '',
    previousDentist: '',
    recentExamDate: null,
    recentTreatmentDate: null,
    immediateConcern: '',
    patientSince: '',
    recentXrayDate: null,
    dentistVisitFrequency: '6mo',
  },
  personalHistory: [
    {
      id: 'fearful-treatment',
      number: 1,
      question: 'Are you fearful of dental treatment?',
      answer: 'No',
      scale: '',
      note: '',
      additionalInfo: '',
      comment: '',
    },
    {
      id: 'unfavorable-experience',
      number: 2,
      question: 'Have you had an unfavorable dental experience?',
      answer: 'No',
      scale: '',
      note: '',
      additionalInfo: '',
      comment: '',
    },
    {
      id: 'treatment-complications',
      number: 3,
      question: 'Have you ever had complications from past dental treatment?',
      answer: 'No',
      scale: '',
      note: '',
      additionalInfo: '',
      comment: '',
    },
    {
      id: 'grind-clench',
      number: 4,
      question: 'Do you grind or clench your teeth?',
      answer: 'No',
      scale: '',
      note: '',
      additionalInfo: '',
      comment: '',
    },
    {
      id: 'oral-surgery',
      number: 5,
      question: 'Have you had any oral surgery?',
      answer: 'No',
      scale: '',
      note: '',
      additionalInfo: '',
      comment: '',
    },
    {
      id: 'missing-teeth-trauma',
      number: 6,
      question: 'Have you had any teeth removed or missing teeth due to trauma?',
      answer: 'No',
      scale: '',
      note: '',
      additionalInfo: '',
      comment: '',
    },
  ],
  review: {
    reviewedWithPatient: false,
    reviewedAt: null,
    signatureDataUrl: null,
  },
};
