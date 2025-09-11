import { Provider } from "./types";
import { echoProvider } from "./providers/echo";
import { openaiProvider } from "./providers/openai";

const all: Provider[] = [
  openaiProvider,
  echoProvider,
];

export function providersAvailable(): Provider[] {
  return all.filter(p => p.available());
}

export function getProvider(id: string): Provider | undefined {
  return all.find(p => p.id === id && p.available());
}
