type OutstandingFilters = {
  sort?: string;
  claimType?: string;
  carrier?: string;
  attachment?: string;
  status?: string;
  filterDate?: string;
  startDate?: string;
  endDate?: string;
  patient?: string;
  claim?: string;
  search?: string;
  readyOnly?: boolean;
  hideInactivePolicies?: boolean;
  includeNonAssignment?: boolean;
  includeInactivePolicies?: boolean;
};

const carrierNames: Record<string, string> = {
  bcbs: 'blue cross blue shield', metlife: 'metlife', aetna: 'aetna',
  guardian: 'guardian', cigna: 'cigna', delta: 'delta dental',
  uhc: 'united healthcare', humana: 'humana', principal: 'principal',
  anthem: 'anthem', geha: 'geha',
};

const statusNames: Record<string, string[]> = {
  Accepted: ['accepted'],
  'Accepted and Paid': ['acceptedPaid'],
  'Accepted for processing': ['acceptedForProcessing'],
  'Accepted, but a final payment was denied': ['denied'],
  'Additional Info Requested': ['additionalInfoRequested'],
  'An error occurred when submitting the claim attachments': ['attachmentError'],
  'COB Submitted': ['cobSubmitted'],
  'Claim in process': ['inProcess'],
  'Contact Oryx Support': ['contactSupport'],
  Created: ['draft'], Deleted: ['deleted'], 'EOB Received': ['eobReceived'],
  'EOB Uploaded': ['eobUploaded'],
  'Edi Validation Error - Contact Oryx Support': ['validationError'],
  'Error Response Received': ['error'], 'Manual Claim': ['manualClaim'],
  'Payment was Denied': ['denied'], 'Pending At Payor': ['pending'],
};

const dateValue = (value: unknown): number | null => {
  if (!value) return null;
  const time = new Date(value as string | Date).getTime();
  return Number.isFinite(time) ? time : null;
};

const startOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());

const dateBounds = (option: string, start?: string, end?: string, now = new Date()) => {
  if (option !== 'all' && (start || end)) return [dateValue(start), dateValue(end)];
  const today = startOfDay(now);
  const from = (days: number) => new Date(today.getFullYear(), today.getMonth(), today.getDate() - days);
  const month = (offset: number) => new Date(today.getFullYear(), today.getMonth() + offset, 1);
  const year = (offset: number) => new Date(today.getFullYear() + offset, 0, 1);
  const weekStart = from(today.getDay());
  const quarterStart = new Date(today.getFullYear(), Math.floor(today.getMonth() / 3) * 3, 1);
  const endOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
  switch (option) {
    case 'range': return [dateValue(start), end ? dateValue(new Date(new Date(end).getTime() + 86400000)) : null];
    case 'thisWeek': return [weekStart.getTime(), endOfToday.getTime()];
    case 'thisMonth': case 'monthToDate': return [month(0).getTime(), endOfToday.getTime()];
    case 'last7Days': return [from(7).getTime(), endOfToday.getTime()];
    case 'lastWeek': return [from(today.getDay() + 7).getTime(), weekStart.getTime()];
    case 'last4Weeks': return [from(28).getTime(), endOfToday.getTime()];
    case 'lastMonth': return [month(-1).getTime(), month(0).getTime()];
    case 'last3Months': return [month(-3).getTime(), month(0).getTime()];
    case 'last12Months': return [month(-12).getTime(), month(0).getTime()];
    case 'quarterToDate': return [quarterStart.getTime(), endOfToday.getTime()];
    case 'yearToDate': return [year(0).getTime(), endOfToday.getTime()];
    case 'lastYear': return [year(-1).getTime(), year(0).getTime()];
    default: return [null, null];
  }
};

export const filterOutstandingClaims = <T extends Record<string, any>>(
  claims: T[], filters: OutstandingFilters, now = new Date(),
): T[] => {
  const query = (value?: string) => String(value || '').trim().toLowerCase();
  const patientQuery = query(filters.patient);
  const claimQuery = query(filters.claim);
  const searchQuery = query(filters.search);
  const carrierQuery = carrierNames[filters.carrier || ''] || query(filters.carrier);
  const [start, end] = dateBounds(filters.filterDate || 'all', filters.startDate, filters.endDate, now);
  const filtered = claims.filter((item) => {
    if (!filters.includeNonAssignment && item.isNonAssignment === true) return false;
    if (!filters.includeInactivePolicies && item.isInactivePolicy === true) return false;
    if (filters.hideInactivePolicies && item.isInactivePolicy === true) return false;
    if (filters.readyOnly && item.status !== 'readyForSubmission') return false;
    if (patientQuery && !query(`${item.patient?.firstName || ''} ${item.patient?.lastName || ''}`).includes(patientQuery)) return false;
    const claimText = `${item.claimNumber || ''} ${item.claimCode || ''} ${item.submittedDate || ''}`;
    if (claimQuery && !query(claimText).includes(claimQuery)) return false;
    if (searchQuery && !query(`${item.patient?.firstName || ''} ${item.patient?.lastName || ''} ${claimText}`).includes(searchQuery)) return false;
    if (filters.carrier && filters.carrier !== 'all' && !query(item.insuranceCompany?.name).includes(carrierQuery)) return false;
    if (filters.claimType && filters.claimType !== 'all') {
      const expected = query(filters.claimType)
        .replace(/^fill manual /, 'manual ')
        .replace(/^all e-claim /, 'e-claim ');
      const format = query(item.claimFormat);
      const kind = item.isPredetermination ? (format === 'paper' || format === 'manual' ? 'manual preauth' : 'e-preauth')
        : (format === 'paper' || format === 'manual' ? 'manual' : 'e-claim');
      const actual = `${kind} ${query(item.insuranceType || 'primary')}`;
      if (actual !== expected) return false;
    }
    if (filters.status && filters.status !== 'all') {
      if (filters.status === 'Manual Claim') {
        if (!['paper', 'manual'].includes(query(item.claimFormat))) return false;
      } else if (filters.status === 'EOB Received') {
        if (!Array.isArray(item.eobs) || item.eobs.length === 0) return false;
      } else if (filters.status !== 'An error occurred when submitting the claim attachments') {
        const expected = statusNames[filters.status] || [filters.status];
        if (!expected.some((status) => query(status) === query(item.status))) return false;
      }
    }
    const docs = Array.isArray(item.attachments)
      ? item.attachments.filter((doc: any) => !doc.documentType || doc.documentType === 'claim_attachment')
      : [];
    const states = docs.map((doc: any) => query(doc.deliveryStatus || 'pending'));
    if (filters.attachment === 'withAttachments' && !docs.length) return false;
    if (filters.attachment === 'withoutAttachments' && docs.length) return false;
    if (filters.attachment === 'unsentAttachments' && !states.includes('pending')) return false;
    if (filters.attachment === 'sentAttachments' && !states.includes('sent')) return false;
    if (filters.attachment === 'erroredAttachments' && !states.includes('error')) return false;
    if (filters.status === 'An error occurred when submitting the claim attachments' && !states.includes('error')) return false;
    if (start !== null || end !== null) {
      const date = dateValue(item.createdAt);
      if (date === null || (start !== null && date < start) || (end !== null && date >= end)) return false;
    }
    return true;
  });

  const sortField: Record<string, string> = {
    sentDate: 'submittedDate', printedDate: 'printedDate', dos: 'dateOfService', claimDate: 'createdAt',
  };
  const field = sortField[filters.sort || ''];
  if (field) {
    filtered.sort((a, b) => {
      const first = dateValue(a[field]);
      const second = dateValue(b[field]);
      return first === null ? (second === null ? 0 : 1) : second === null ? -1 : second - first;
    });
  } else if (filters.sort === 'patientName' || filters.sort === 'carrierName') {
    filtered.sort((a, b) => {
      const value = (item: T) => filters.sort === 'patientName'
        ? `${item.patient?.firstName || ''} ${item.patient?.lastName || ''}`
        : item.insuranceCompany?.name || '';
      return value(a).localeCompare(value(b), undefined, { sensitivity: 'base' });
    });
  }
  return filtered;
};
