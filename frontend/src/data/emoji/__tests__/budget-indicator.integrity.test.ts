import { getBudgetGuardEmoji } from '../emoji';

describe('budget guard emoji mapping (SSOT)', () => {
  it('returns the SSOT emoji for ok / warning / blocked', () => {
    expect(getBudgetGuardEmoji('ok')).toBe('🛫');
    expect(getBudgetGuardEmoji('warning')).toBe('🏖️');
    expect(getBudgetGuardEmoji('blocked')).toBe('🧳');
  });
});
