/**
 * Minimal contract shared by adapters (enough to satisfy TS & builds).
 * Expand later as you wire real generation calls.
 */
export type ProviderAdapter = {
  /** stable id e.g. "openai" */
  id: string;
  /** human label e.g. "OpenAI" */
  label: string;
  /** optional health check / capability probe */
  test?: () => Promise<{ ok: boolean; message?: string }>;
  /** optional image generation entrypoint */
  generate?: (options: any) => Promise<any>;
};
