import { ProviderAdapter } from "./types";
import { openaiAdapter } from "./openai";
import { stabilityAdapter } from "./stability";
import { leonardoAdapter } from "./leonardo";
import { echoAdapter } from "./echo";
import { httpjsonAdapter } from "./httpjson";

const REGISTRY: Record<string, ProviderAdapter> = {};
function add(a: ProviderAdapter, flag?: string) { if (flag && process.env[flag] === "false") return; REGISTRY[a.name] = a; }

add(openaiAdapter,   "PROVIDER_OPENAI_ENABLE");
add(stabilityAdapter,"PROVIDER_STABILITY_ENABLE");
add(leonardoAdapter, "PROVIDER_LEONARDO_ENABLE");
add(echoAdapter); // local mock
add(httpjsonAdapter, "PROVIDER_HTTPJSON_ENABLE");

export function getAdapter(name: string) { return REGISTRY[name]; }
export function listProviders() { return Object.keys(REGISTRY); }


