/**
 * Canned Stedi eligibility (v3) responses for STEDI_MOCK=true, so the endpoint
 * can be exercised end to end before we have Stedi API keys. The shapes follow
 * Stedi's documented JSON 271; numbers are made up.
 *
 * The scenario is picked from the subscriber member ID:
 *   contains "NOTFOUND" -> payer AAA error 75 (subscriber not found)
 *   contains "INACTIVE" -> coverage terminated (EB 6)
 *   contains "DOWN"     -> payer unavailable (AAA 42)
 *   anything else       -> active dental PPO, in + out of network
 */

const DENTAL_CATEGORIES: [string, string][] = [
  ['35', 'Dental Care'],
  ['23', 'Diagnostic Dental'],
  ['41', 'Routine (Preventive) Dental'],
  ['25', 'Restorative'],
  ['26', 'Endodontics'],
  ['24', 'Periodontics'],
  ['40', 'Oral Surgery'],
  ['36', 'Dental Crowns'],
  ['39', 'Prosthodontics'],
  ['38', 'Orthodontics'],
];

// Patient coinsurance share (decimal) per category: in-network, out-of-network.
const COINSURANCE: Record<string, [string, string]> = {
  '23': ['0', '0.1'],
  '41': ['0', '0.1'],
  '25': ['0.2', '0.3'],
  '26': ['0.2', '0.3'],
  '24': ['0.2', '0.3'],
  '40': ['0.2', '0.3'],
  '36': ['0.5', '0.6'],
  '39': ['0.5', '0.6'],
  '38': ['0.5', '0.5'],
};

const aaaError = (code: string, description: string, followupAction: string) => ({
  field: 'AAA',
  code,
  description,
  followupAction,
  location: 'Loop 2100C',
  possibleResolutions: '',
});

const envelope = (request: any) => ({
  meta: { applicationMode: 'mock', traceId: `mock-${Date.now()}` },
  controlNumber: '123456789',
  tradingPartnerServiceId: request.tradingPartnerServiceId,
  provider: { providerName: request.provider?.organizationName ?? request.provider?.lastName, npi: request.provider?.npi },
  subscriber: {
    memberId: request.subscriber?.memberId,
    firstName: request.subscriber?.firstName,
    lastName: request.subscriber?.lastName,
    dateOfBirth: request.subscriber?.dateOfBirth,
  },
  payer: { name: 'MOCK DENTAL PAYER', payorIdentification: request.tradingPartnerServiceId },
  errors: [] as any[],
});

const activeResponse = (request: any) => {
  const year = new Date().getFullYear();
  const planBegin = `${year}0101`;
  const benefitsInformation: any[] = [];

  for (const [network, idx] of [['Y', 0], ['N', 1]] as const) {
    for (const [code, name] of DENTAL_CATEGORIES) {
      benefitsInformation.push({
        code: '1',
        name: 'Active Coverage',
        serviceTypeCodes: [code],
        serviceTypes: [name],
        insuranceTypeCode: 'GP',
        insuranceType: 'Group Policy',
        inPlanNetworkIndicatorCode: network,
        inPlanNetworkIndicator: network === 'Y' ? 'Yes' : 'No',
        benefitsDateInformation: { benefitBegin: planBegin },
        ...(code === '25' ? { additionalInformation: [{ description: 'BASIC' }] } : {}),
        ...(code === '36' ? { additionalInformation: [{ description: 'MAJOR' }] } : {}),
      });
      const coins = COINSURANCE[code];
      if (coins) {
        benefitsInformation.push({
          code: 'A',
          name: 'Co-Insurance',
          serviceTypeCodes: [code],
          serviceTypes: [name],
          coverageLevelCode: 'IND',
          coverageLevel: 'Individual',
          inPlanNetworkIndicatorCode: network,
          benefitPercent: coins[idx],
          timeQualifierCode: '23',
          timeQualifier: 'Calendar Year',
          ...(code === '38' ? { authOrCertIndicator: 'Y' } : {}),
        });
      }
    }

    const ded = network === 'Y' ? ['50', '150', '50'] : ['100', '300', '100'];
    benefitsInformation.push(
      { code: 'C', name: 'Deductible', serviceTypeCodes: ['35'], serviceTypes: ['Dental Care'], coverageLevelCode: 'IND', coverageLevel: 'Individual', inPlanNetworkIndicatorCode: network, benefitAmount: ded[0], timeQualifierCode: '23', timeQualifier: 'Calendar Year' },
      { code: 'C', name: 'Deductible', serviceTypeCodes: ['35'], serviceTypes: ['Dental Care'], coverageLevelCode: 'FAM', coverageLevel: 'Family', inPlanNetworkIndicatorCode: network, benefitAmount: ded[1], timeQualifierCode: '23', timeQualifier: 'Calendar Year' },
      { code: 'C', name: 'Deductible', serviceTypeCodes: ['35'], serviceTypes: ['Dental Care'], coverageLevelCode: 'IND', coverageLevel: 'Individual', inPlanNetworkIndicatorCode: network, benefitAmount: ded[2], timeQualifierCode: '29', timeQualifier: 'Remaining' },
      { code: 'F', name: 'Limitations', serviceTypeCodes: ['35'], serviceTypes: ['Dental Care'], coverageLevelCode: 'IND', coverageLevel: 'Individual', inPlanNetworkIndicatorCode: network, benefitAmount: '1500', timeQualifierCode: '23', timeQualifier: 'Calendar Year' },
      { code: 'F', name: 'Limitations', serviceTypeCodes: ['35'], serviceTypes: ['Dental Care'], coverageLevelCode: 'IND', coverageLevel: 'Individual', inPlanNetworkIndicatorCode: network, benefitAmount: '1180.5', timeQualifierCode: '29', timeQualifier: 'Remaining' },
      { code: 'F', name: 'Limitations', serviceTypeCodes: ['38'], serviceTypes: ['Orthodontics'], coverageLevelCode: 'IND', coverageLevel: 'Individual', inPlanNetworkIndicatorCode: network, benefitAmount: '1500', timeQualifierCode: '32', timeQualifier: 'Lifetime' },
    );
  }

  return {
    ...envelope(request),
    planInformation: { groupNumber: 'MOCK-GRP-001', groupDescription: 'MOCK EMPLOYER DENTAL PPO' },
    planDateInformation: { planBegin, eligibilityBegin: planBegin },
    benefitsInformation,
  };
};

export const buildMockEligibilityResponse = (request: any): { httpStatus: number; data: any } => {
  const memberId = String(request?.subscriber?.memberId ?? '').toUpperCase();

  if (memberId.includes('NOTFOUND')) {
    const data = envelope(request);
    data.subscriber = { ...data.subscriber, aaaErrors: [aaaError('75', 'Subscriber/Insured Not Found', 'Please Correct and Resubmit')] } as any;
    return { httpStatus: 200, data };
  }

  if (memberId.includes('DOWN')) {
    const data = envelope(request);
    data.errors = [aaaError('42', 'Unable to Respond at Current Time', 'Resubmission Allowed')];
    return { httpStatus: 200, data };
  }

  if (memberId.includes('INACTIVE')) {
    const year = new Date().getFullYear();
    return {
      httpStatus: 200,
      data: {
        ...envelope(request),
        planDateInformation: { planBegin: `${year - 1}0101`, planEnd: `${year - 1}1231` },
        benefitsInformation: [
          { code: '6', name: 'Inactive', serviceTypeCodes: ['35'], serviceTypes: ['Dental Care'], insuranceType: 'Group Policy' },
        ],
      },
    };
  }

  return { httpStatus: 200, data: activeResponse(request) };
};
