import { getBudgetGuardEmoji } from '../emoji';

describe('budget indicator emoji mapping (lock-in)', () => {
  it('matches the canonical mapping ok🛫 / warning🏖️ / blocked🧳', () => {
    expect(getBudgetGuardEmoji('ok')).toBe('🛫');
    expect(getBudgetGuardEmoji('warning')).toBe('🏖️');
    expect(getBudgetGuardEmoji('blocked')).toBe('🧳');
  });
});
