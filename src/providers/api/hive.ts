import { ImageProvider, GenInput, GenOutput } from "../types";
export const lexicaProvider: ImageProvider = {
  name: "lexica",
  supportsNegative: true, supportsSeed: true, supportsSize: true, supportsModelSelect: true,
  async generate(_input: GenInput): Promise<GenOutput> {
    return { ok: false, provider: "lexica", code: "NOT_CONFIGURED", message: "Adapter pending: add API endpoint + auth" };
  }
};
