// frontend/src/data/providers/presets.ts
// Reserved for prompt/provider presets. Intentionally minimal for now.

export type Preset = {
  id: string;
  name: string;
  params?: Record<string, unknown>;
};

export const PRESETS: Preset[] = [];

export default PRESETS;
