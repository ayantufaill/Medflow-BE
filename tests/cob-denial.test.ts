/**
 * COB denial detection tests.
 *
 * The behaviour under test is as much about what does NOT raise a flag as
 * what does. A detector that fires on every secondary claim trains staff to
 * ignore it, which is worse than not having it.
 */
import { describe, it, expect } from 'vitest';
import {
  COB_DENIAL_CARCS,
  COB_INFORMATIONAL_CARCS,
  detectCobDenial,
} from '../src/services/cob/denial';

describe('CARC 22', () => {
  it('is detected as a COB denial', () => {
    const result = detectCobDenial([{ groupCode: 'OA', reasonCode: '22', amount: 450 }]);
    expect(result.isCobDenial).toBe(true);
    expect(result.matched[0].reasonCode).toBe('22');
    expect(result.matched[0].text).toContain('coordination of benefits');
  });

  it('tells the biller what to do, and what not to do', () => {
    const result = detectCobDenial([{ groupCode: 'OA', reasonCode: '22', amount: 450 }]);
    expect(result.explanation).toContain('Re-verify eligibility');
    expect(result.explanation).toContain('Do not simply resubmit');
  });

  it('is detected regardless of the group code the payer used', () => {
    for (const groupCode of ['OA', 'CO', 'PI', 'PR']) {
      expect(detectCobDenial([{ groupCode, reasonCode: '22', amount: 1 }]).isCobDenial).toBe(true);
    }
  });

  it('is found among several adjustments', () => {
    const result = detectCobDenial([
      { groupCode: 'CO', reasonCode: '45', amount: 200 },
      { groupCode: 'PR', reasonCode: '1', amount: 50 },
      { groupCode: 'OA', reasonCode: '22', amount: 450 },
    ]);
    expect(result.isCobDenial).toBe(true);
    expect(result.matched).toHaveLength(1);
  });
});

describe('CARC 109', () => {
  it('is treated as a COB order dispute — same action, bill someone else', () => {
    const result = detectCobDenial([{ groupCode: 'CO', reasonCode: '109', amount: 800 }]);
    expect(result.isCobDenial).toBe(true);
    expect(result.matched[0].text).toContain('send to the correct payer');
  });
});

describe('what must NOT raise a flag', () => {
  it('CARC 23 on a properly coordinated secondary claim', () => {
    // 23 is "the impact of prior payer adjudication" and appears on every
    // correctly billed secondary. Flagging it would raise COB_DENIAL on
    // normal, working coordination.
    const result = detectCobDenial([{ groupCode: 'OA', reasonCode: '23', amount: 500 }]);
    expect(result.isCobDenial).toBe(false);
    expect(result.explanation).toBeNull();
  });

  it('an ordinary contractual write-off and patient coinsurance', () => {
    const result = detectCobDenial([
      { groupCode: 'CO', reasonCode: '45', amount: 200 },
      { groupCode: 'PR', reasonCode: '2', amount: 80 },
    ]);
    expect(result.isCobDenial).toBe(false);
  });

  it('an empty remittance', () => {
    expect(detectCobDenial([]).isCobDenial).toBe(false);
    expect(detectCobDenial().isCobDenial).toBe(false);
  });

  it('a non-COB denial such as a code mismatch', () => {
    expect(detectCobDenial([{ groupCode: 'CO', reasonCode: '199', amount: 100 }]).isCobDenial).toBe(
      false
    );
  });

  it('keeps 22/109 and 23 in separate lists', () => {
    expect([...COB_DENIAL_CARCS]).toEqual(['22', '109']);
    expect([...COB_INFORMATIONAL_CARCS]).toEqual(['23']);
  });
});

describe('free-text EOB notes', () => {
  it('catches the phrase payers use when the codes did not parse', () => {
    // A surprising share of denials arrive as a note a biller typed off a
    // paper EOB, with no structured codes at all.
    const result = detectCobDenial(
      [],
      'Denied: this care may be covered by another payer per Coordination of Benefits.'
    );
    expect(result.isCobDenial).toBe(true);
    expect(result.matched[0].text).toContain('coordination of benefits');
  });

  it('catches "other insurance is primary"', () => {
    expect(detectCobDenial([], 'Other insurance is primary for this member').isCobDenial).toBe(
      true
    );
  });

  it('is case-insensitive', () => {
    expect(detectCobDenial([], 'SEND TO CORRECT PAYER').isCobDenial).toBe(true);
  });

  it('does not fire on unrelated remittance text', () => {
    expect(
      detectCobDenial([], 'Paid at the contracted rate. Patient coinsurance applies.').isCobDenial
    ).toBe(false);
  });

  it('prefers the structured codes when both are present', () => {
    const result = detectCobDenial(
      [{ groupCode: 'OA', reasonCode: '22', amount: 10 }],
      'coordination of benefits'
    );
    // One match from the code, not two from code plus text.
    expect(result.matched).toHaveLength(1);
    expect(result.matched[0].reasonCode).toBe('22');
  });
});

describe('malformed input', () => {
  it('tolerates whitespace and non-string codes', () => {
    const result = detectCobDenial([
      { groupCode: ' OA ', reasonCode: ' 22 ', amount: 450 } as any,
    ]);
    expect(result.isCobDenial).toBe(true);
  });

  it('tolerates a missing amount', () => {
    const result = detectCobDenial([{ groupCode: 'OA', reasonCode: '22' } as any]);
    expect(result.isCobDenial).toBe(true);
    expect(result.matched[0].amount).toBe(0);
  });
});
