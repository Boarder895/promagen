// C:\Users\Proma\Projects\promagen\gateway\lib\types.ts

/**
 * Minimal shape of provider config as read from config/api/providers.registry.json.
 * We only include what the gateway lib actually needs.
 */

export interface ProviderAuthConfig {
  type: 'none' | 'query_api_key';
  location: 'none' | 'query';
  field?: string | null;
  env_var?: string | null;
  key_name?: string | null;
  env?: string | null;
}

export interface ProviderQuotaConfig {
  per_second?: number | null;
  per_minute?: number | null;
  per_day?: number | null;
  per_month?: number | null;
}

export interface ProviderConfig {
  id: string;
  name: string;
  base_url: string | null;
  auth: ProviderAuthConfig;
  quotas?: ProviderQuotaConfig;
  capabilities?: string[];
  adapters: {
    fx_quotes?: string;
    // future domains can be added here
  };
}
