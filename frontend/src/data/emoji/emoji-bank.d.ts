// frontend/src/data/emoji/emoji-bank.d.ts

export type EmojiEntry = {
  id: string;
  emoji: string;
};

export interface EmojiBank {
  trends: EmojiEntry[];
  core: EmojiEntry[];
  finance: EmojiEntry[];
  currencies: EmojiEntry[];
  weather: EmojiEntry[];
  space: EmojiEntry[];
  sports: EmojiEntry[];
  seasons: EmojiEntry[];
  alerts: EmojiEntry[];
  ui: EmojiEntry[];
  transport: EmojiEntry[];
  science: EmojiEntry[];
  tech: EmojiEntry[];
  food: EmojiEntry[];
  nature: EmojiEntry[];
  music: EmojiEntry[];
  people: EmojiEntry[];
  symbols: EmojiEntry[];
  providers: Record<string, string>;
}

declare module '@/data/emoji/emoji-bank.json' {
  const emojiBank: EmojiBank;
  export default emojiBank;
}
