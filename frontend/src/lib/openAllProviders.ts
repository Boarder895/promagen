// Facade over the canonical list. Named exports only.

export {
  type ProviderId,
  type ProviderKind,
  type ProviderMeta,
  PROVIDERS as openAIProviders,   // legacy alias some UI uses
  PROVIDERS,
  PROVIDER_IDS,
  PROVIDERS_BY_ID,
  API_PROVIDERS,
  UI_ONLY_PROVIDERS,
} from "./openAIProviders";

// Primary alias expected by some components
import { PROVIDERS as _PROVIDERS } from "./openAIProviders";
export const openAllProviders = _PROVIDERS;






