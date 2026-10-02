import { describe, it, expect, vi, beforeEach } from 'vitest';

const dnsMock = vi.hoisted(() => ({
  resolveCname: vi.fn(),
  resolveMx: vi.fn(),
  resolveTxt: vi.fn(),
}));

vi.mock('node:dns', () => ({ promises: dnsMock }));

import {
  normalizeDomain,
  buildDnsRecords,
  createDomainIdentity,
  verifyDomainIdentity,
  MAIL_FROM_SUBDOMAIN,
} from '../src/services/email-domain.service';

const notFound = () => Promise.reject(Object.assign(new Error('queryA ENOTFOUND'), { code: 'ENOTFOUND' }));

describe('email-domain.service', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe('normalizeDomain', () => {
    it('strips protocol, www, path and casing from pasted URLs', () => {
      expect(normalizeDomain('https://www.SmileCare.com/contact')).toBe('smilecare.com');
      expect(normalizeDomain('  mail.practice.co.uk. ')).toBe('mail.practice.co.uk');
    });

    it('rejects values that are not hostnames', () => {
      expect(normalizeDomain('')).toBeNull();
      expect(normalizeDomain('localhost')).toBeNull();
      expect(normalizeDomain('-bad.com')).toBeNull();
      expect(normalizeDomain('bad-.com')).toBeNull();
      expect(normalizeDomain('has space.com')).toBeNull();
      expect(normalizeDomain('user@practice.com')).toBeNull();
    });
  });

  describe('buildDnsRecords / createDomainIdentity', () => {
    it('builds three DKIM CNAMEs plus the MAIL FROM MX and TXT records', () => {
      const records = buildDnsRecords(['aaa', 'bbb', 'ccc']);
      expect(records.map((r) => r.type)).toEqual(['CNAME', 'CNAME', 'CNAME', 'MX', 'TXT']);
      expect(records[0]).toMatchObject({ name: 'aaa._domainkey', value: 'aaa.dkim.amazonses.com' });
      expect(records[3]).toMatchObject({ name: MAIL_FROM_SUBDOMAIN, value: expect.stringMatching(/^10 feedback-smtp\./) });
      expect(records[4].value).toBe('"v=spf1 include:amazonses.com ~all"');
    });

    it('issues a pending identity with unique 32-char tokens', () => {
      const state = createDomainIdentity('practice.com');
      expect(state.status).toBe('pending');
      const tokens = state.records.filter((r) => r.type === 'CNAME').map((r) => r.name.split('.')[0]);
      expect(new Set(tokens).size).toBe(3);
      tokens.forEach((t) => expect(t).toMatch(/^[a-z2-7]{32}$/));
    });
  });

  describe('verifyDomainIdentity', () => {
    const publishAll = (state: ReturnType<typeof createDomainIdentity>) => {
      dnsMock.resolveCname.mockImplementation(async (host: string) => {
        const rec = state.records.find((r) => r.type === 'CNAME' && host === `${r.name}.${state.domain}`);
        return rec ? [rec.value.toUpperCase() + '.'] : notFound();
      });
      dnsMock.resolveMx.mockResolvedValue([{ priority: 10, exchange: state.records[3].value.split(' ')[1] }]);
      dnsMock.resolveTxt.mockResolvedValue([['v=spf1 include:amazonses.com', ' ~all']]);
    };

    it('marks the domain verified when every record is published', async () => {
      const state = createDomainIdentity('practice.com');
      publishAll(state);

      const result = await verifyDomainIdentity(state);

      expect(result.status).toBe('verified');
      expect(result.records.every((r) => r.found)).toBe(true);
      expect(result.lastCheckedAt).not.toBeNull();
      expect(dnsMock.resolveMx).toHaveBeenCalledWith(`${MAIL_FROM_SUBDOMAIN}.practice.com`);
    });

    it('stays pending inside the propagation window when a record is missing', async () => {
      const state = createDomainIdentity('practice.com');
      publishAll(state);
      dnsMock.resolveTxt.mockImplementation(notFound);

      const result = await verifyDomainIdentity(state);

      expect(result.status).toBe('pending');
      expect(result.records.find((r) => r.type === 'TXT')?.found).toBe(false);
      expect(result.records.find((r) => r.type === 'MX')?.found).toBe(true);
    });

    it('fails once the propagation window has passed', async () => {
      const state = {
        ...createDomainIdentity('practice.com'),
        createdAt: new Date(Date.now() - 73 * 60 * 60 * 1000).toISOString(),
      };
      dnsMock.resolveCname.mockImplementation(notFound);
      dnsMock.resolveMx.mockImplementation(notFound);
      dnsMock.resolveTxt.mockImplementation(notFound);

      const result = await verifyDomainIdentity(state);

      expect(result.status).toBe('failed');
    });

    it('does not accept an MX record with the wrong priority', async () => {
      const state = createDomainIdentity('practice.com');
      publishAll(state);
      dnsMock.resolveMx.mockResolvedValue([{ priority: 20, exchange: state.records[3].value.split(' ')[1] }]);

      const result = await verifyDomainIdentity(state);

      expect(result.records.find((r) => r.type === 'MX')?.found).toBe(false);
    });
  });
});
