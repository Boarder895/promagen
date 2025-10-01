export type Preset = { id: string; name: string; prompt: string };

export const presets: Preset[] = [
  { id: "short-summary", name: "Short Summary", prompt: "Summarize in 5 bullets + 1 TL;DR." },
  { id: "refactor-react", name: "Refactor React", prompt: "Refactor component to idiomatic TS + a11y." }
];

// Some code imports { Presets }, so export an alias too:
export const Presets = presets;


