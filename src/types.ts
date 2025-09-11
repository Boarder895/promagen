export type GenSize = "512x512" | "768x768" | "1024x1024";

export interface GenRequest {
  provider: string;
  prompt: string;
  model?: string;
  size?: GenSize;
}

export interface GenResponse {
  file: string;       // img-*.png
  url: string;        // /images/...
  localUrl: string;   // same as url for our static server
}

export interface Provider {
  id: string;
  available(): boolean;
  generate(req: GenRequest): Promise<Buffer>; // returns PNG bytes
}
