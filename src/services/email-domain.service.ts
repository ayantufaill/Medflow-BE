import { randomBytes } from 'node:crypto';
import { promises as dns } from 'node:dns';

/**
 * Email sending-domain verification (Settings → Patient Communication → Email Services).
 *
 * Record generation is provider-specific: with AWS SES the DKIM tokens come from
 * CreateEmailIdentity and only SES can sign with them. Until SES credentials are
 * configured, the 'local' provider generates SES-shaped records so the full
 * flow can be built and tested. Verification never depends on the provider —
 * it resolves the records against live DNS.
 */

export type EmailDomainStatus = 'not_configured' | 'pending' | 'verified' | 'failed';
export type DnsRecordType = 'CNAME' | 'MX' | 'TXT';

export interface DnsRecord {
  type: DnsRecordType;
  /** Host relative to the domain, e.g. "abc._domainkey". */
  name: string;
  value: string;
  hint?: string;
  /** Set after a verification run. */
  found?: boolean;
}

export interface EmailDomainState {
  domain: string | null;
  status: EmailDomainStatus;
  provider: string;
  records: DnsRecord[];
  createdAt: string | null;
  lastCheckedAt: string | null;
}

export const MAIL_FROM_SUBDOMAIN = 'medflow-email-service';
const SES_REGION = process.env.AWS_SES_REGION || 'us-east-1';
const MX_PRIORITY = 10;
/** DNS propagation window before missing records are reported as failed rather than pending. */
const PROPAGATION_WINDOW_MS = 72 * 60 * 60 * 1000;

// Hostname: labels of 1-63 chars, no leading/trailing hyphen, alphabetic TLD.
const DOMAIN_PATTERN = /^(?=.{1,253}$)(?:(?!-)[a-z0-9-]{1,63}(?<!-)\.)+[a-z]{2,63}$/;

export const EMPTY_EMAIL_DOMAIN: EmailDomainState = {
  domain: null,
  status: 'not_configured',
  provider: 'local',
  records: [],
  createdAt: null,
  lastCheckedAt: null,
};

/** Accepts what users paste ("https://www.Practice.com/") and returns "practice.com", or null if invalid. */
export const normalizeDomain = (input: string): string | null => {
  const domain = input
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .replace(/[/?#].*$/, '')
    .replace(/\.$/, '');
  return DOMAIN_PATTERN.test(domain) ? domain : null;
};

const BASE32 = 'abcdefghijklmnopqrstuvwxyz234567';
const generateDkimToken = (): string =>
  Array.from(randomBytes(32), (byte) => BASE32[byte % 32]).join('');

export const buildDnsRecords = (dkimTokens: string[]): DnsRecord[] => [
  ...dkimTokens.map((token) => ({
    type: 'CNAME' as const,
    name: `${token}._domainkey`,
    value: `${token}.dkim.amazonses.com`,
  })),
  {
    type: 'MX',
    name: MAIL_FROM_SUBDOMAIN,
    value: `${MX_PRIORITY} feedback-smtp.${SES_REGION}.amazonses.com`,
    hint: 'If your provider has a Priority field, remove the 10 from Value and enter it in the Priority field.',
  },
  {
    type: 'TXT',
    name: MAIL_FROM_SUBDOMAIN,
    value: '"v=spf1 include:amazonses.com ~all"',
    hint: 'Make sure to include the quotation marks when entering your TXT record.',
  },
];

/** Creates the record set for a newly registered domain. */
export const createDomainIdentity = (domain: string): EmailDomainState => ({
  domain,
  status: 'pending',
  provider: 'local',
  records: buildDnsRecords([generateDkimToken(), generateDkimToken(), generateDkimToken()]),
  createdAt: new Date().toISOString(),
  lastCheckedAt: null,
});

const sameHost = (a: string, b: string) => a.replace(/\.$/, '').toLowerCase() === b.replace(/\.$/, '').toLowerCase();

/** Resolves a single record against live DNS. Any lookup error (NXDOMAIN, timeout) counts as not found. */
export const isRecordPublished = async (domain: string, record: DnsRecord): Promise<boolean> => {
  const host = `${record.name}.${domain}`;
  try {
    if (record.type === 'CNAME') {
      const targets = await dns.resolveCname(host);
      return targets.some((target) => sameHost(target, record.value));
    }
    if (record.type === 'MX') {
      const [priority, exchange] = record.value.split(' ');
      const entries = await dns.resolveMx(host);
      return entries.some((mx) => mx.priority === Number(priority) && sameHost(mx.exchange, exchange));
    }
    const expected = record.value.replace(/^"|"$/g, '');
    const txt = await dns.resolveTxt(host);
    return txt.some((chunks) => chunks.join('') === expected);
  } catch {
    return false;
  }
};

/** Checks every record and derives the overall status. */
export const verifyDomainIdentity = async (state: EmailDomainState): Promise<EmailDomainState> => {
  if (!state.domain) return state;

  const records = await Promise.all(
    state.records.map(async (record) => ({ ...record, found: await isRecordPublished(state.domain!, record) }))
  );

  const allFound = records.length > 0 && records.every((r) => r.found);
  const createdAt = state.createdAt ? new Date(state.createdAt).getTime() : 0;
  const withinPropagationWindow = Date.now() - createdAt < PROPAGATION_WINDOW_MS;

  return {
    ...state,
    records,
    status: allFound ? 'verified' : withinPropagationWindow ? 'pending' : 'failed',
    lastCheckedAt: new Date().toISOString(),
  };
};
