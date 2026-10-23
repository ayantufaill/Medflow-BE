import { describe, expect, it } from 'vitest';
import { filterOutstandingClaims } from '../src/utils/outstanding-claim-filters.util';

const now = new Date('2026-10-16T12:00:00');
const claims = [
  {
    id: '1', claimNumber: 'CLM001', claimCode: 'CLM001',
    patient: { firstName: 'Ada', lastName: 'Jones' }, insuranceCompany: { name: 'MetLife Dental' },
    claimFormat: 'Paper', insuranceType: 'primary', status: 'accepted',
    createdAt: '2026-10-10T12:00:00', submittedDate: '2026-10-11T12:00:00',
    dateOfService: '2026-10-01', printedDate: '2026-10-12',
    attachments: [{ deliveryStatus: 'pending', deliveryErrorMessage: null }], isNonAssignment: false, isInactivePolicy: false,
    isPredetermination: false,
  },
  {
    id: '2', claimNumber: 'CLM002', claimCode: 'CLM002',
    patient: { firstName: 'Ben', lastName: 'Smith' }, insuranceCompany: { name: 'Aetna Dental' },
    claimFormat: 'E-claim', insuranceType: 'secondary', status: 'pending',
    createdAt: '2026-07-10T12:00:00', submittedDate: '2026-10-12T12:00:00',
    dateOfService: '2026-07-01', printedDate: null,
    attachments: [{ deliveryStatus: 'sent', deliveryErrorMessage: null }], isNonAssignment: true, isInactivePolicy: false,
    isPredetermination: false,
  },
  {
    id: '3', claimNumber: 'CLM003', claimCode: 'CLM003',
    patient: { firstName: 'Cara', lastName: 'White' }, insuranceCompany: { name: 'Delta Dental' },
    claimFormat: 'E-claim', insuranceType: 'other', status: 'eobUploaded',
    createdAt: '2025-10-10T12:00:00', submittedDate: '2026-10-10T12:00:00',
    dateOfService: '2025-10-01', printedDate: null,
    attachments: [{ deliveryStatus: 'error', deliveryErrorMessage: 'Mock clearinghouse error' }], isNonAssignment: false, isInactivePolicy: true,
    isPredetermination: false,
  },
  {
    id: '4', claimNumber: 'PRE004', claimCode: 'PRE004',
    patient: { firstName: 'David', lastName: 'Miller' }, insuranceCompany: { name: 'Cigna Dental' },
    claimFormat: 'Electronic', insuranceType: 'primary', status: 'draft',
    createdAt: '2026-10-14T12:00:00', submittedDate: null,
    dateOfService: '2026-10-14', printedDate: null,
    attachments: [], isNonAssignment: false, isInactivePolicy: true,
    isPredetermination: true,
  },
  {
    id: '5', claimNumber: 'PRE005', claimCode: 'PRE005',
    patient: { firstName: 'Eva', lastName: 'Green' }, insuranceCompany: { name: 'Guardian Life' },
    claimFormat: 'Paper', insuranceType: 'secondary', status: 'readyForSubmission',
    createdAt: '2026-09-15T12:00:00', submittedDate: null,
    dateOfService: '2026-09-15', printedDate: null,
    attachments: [{ deliveryStatus: 'pending' }], isNonAssignment: false, isInactivePolicy: false,
    isPredetermination: true,
  },
];
const ids = (options: Parameters<typeof filterOutstandingClaims>[1]) =>
  filterOutstandingClaims(claims, options, now).map((claim) => claim.id);

describe('claim filter utilities', () => {
  it('uses persisted policy flags and permits each checkbox to include its rows', () => {
    expect(ids({})).toEqual(['1', '5']);
    expect(ids({ includeNonAssignment: true })).toEqual(['1', '2', '5']);
    expect(ids({ includeInactivePolicies: true })).toEqual(['1', '3', '4', '5']);
  });

  it('matches the visible claim type, carrier, status, and attachment option values', () => {
    const all = { includeNonAssignment: true, includeInactivePolicies: true };
    expect(ids({ ...all, claimType: 'Fill Manual Primary' })).toEqual(['1']);
    expect(ids({ ...all, claimType: 'E-claim Secondary' })).toEqual(['2']);
    expect(ids({ ...all, carrier: 'metlife' })).toEqual(['1']);
    expect(ids({ ...all, status: 'Pending At Payor' })).toEqual(['2']);
    expect(ids({ ...all, status: 'Manual Claim' })).toEqual(['1', '5']);
    expect(ids({ ...all, status: 'An error occurred when submitting the claim attachments' })).toEqual(['3']);
    expect(ids({ ...all, attachment: 'withAttachments' })).toEqual(['1', '2', '3', '5']);
    expect(ids({ ...all, attachment: 'withoutAttachments' })).toEqual(['4']);
    expect(ids({ ...all, attachment: 'unsentAttachments' })).toEqual(['1', '5']);
    expect(ids({ ...all, attachment: 'sentAttachments' })).toEqual(['2']);
    expect(ids({ ...all, attachment: 'erroredAttachments' })).toEqual(['3']);
  });

  it('filters predeterminations by preauth claim types and inactive policy toggle', () => {
    const all = { includeNonAssignment: true, includeInactivePolicies: true };
    expect(ids({ ...all, claimType: 'E-preauth Primary' })).toEqual(['4']);
    expect(ids({ ...all, claimType: 'Manual Preauth Secondary' })).toEqual(['5']);

    // When hideInactivePolicies is true, predeterminations with inactive policies are excluded
    expect(ids({ ...all, hideInactivePolicies: true })).toEqual(['1', '2', '5']);
  });

  it('returns empty results when an option has no matching claims', () => {
    const all = { includeNonAssignment: true, includeInactivePolicies: true };
    expect(ids({ ...all, carrier: 'humana' })).toEqual([]);
    expect(ids({ ...all, status: 'Deleted' })).toEqual([]);
    expect(ids({ ...all, claimType: 'Manual Other' })).toEqual([]);
  });

  it('searches names and claim numbers independently and applies combined filters', () => {
    const all = { includeNonAssignment: true, includeInactivePolicies: true };
    expect(ids({ ...all, patient: 'david' })).toEqual(['4']);
    expect(ids({ ...all, claim: 'PRE005' })).toEqual(['5']);
    expect(ids({ ...all, patient: 'david', claim: 'CLM001' })).toEqual([]);
    expect(ids({ ...all, carrier: 'cigna', status: 'Created' })).toEqual(['4']);
  });

  it('sorts by saved dates and names before pagination', () => {
    const all = { includeNonAssignment: true, includeInactivePolicies: true };
    expect(ids({ ...all, filterDate: 'thisMonth' })).toEqual(['1', '4']);
    expect(ids({ ...all, sort: 'sentDate' })).toEqual(['2', '1', '3', '4', '5']);
    expect(ids({ ...all, sort: 'printedDate' })).toEqual(['1', '2', '3', '4', '5']);
    expect(ids({ ...all, sort: 'patientName' })).toEqual(['1', '2', '3', '4', '5']);
    expect(ids({ ...all, sort: 'carrierName' })).toEqual(['2', '4', '3', '5', '1']);
    expect(ids({ ...all, sort: 'dos' })).toEqual(['4', '1', '5', '2', '3']);
    expect(ids({ ...all, sort: 'claimDate' })).toEqual(['4', '1', '5', '2', '3']);
  });
});

