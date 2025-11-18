import { emojiBankSchema } from '../emoji-bank.schema';
import emojiBank from '../emoji-bank.json';

describe('emoji-bank.json shape', () => {
  it('matches emojiBankSchema and has no duplicate ids', () => {
    const result = emojiBankSchema.safeParse(emojiBank);

    if (!result.success) {
      console.error(
        'emoji-bank.json failed validation:',
        JSON.stringify(result.error.format(), null, 2),
      );
    }

    expect(result.success).toBe(true);
  });
});
