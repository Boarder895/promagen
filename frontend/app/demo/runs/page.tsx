// App Router page: use named import (Promagen rule: no default exports)
import { RunGrid } from "./run-grid";

const providers = [
  { id: "openai", name: "OpenAI DALL·E/GPT-Image" },
  { id: "stability", name: "Stability AI" },
  { id: "leonardo", name: "Leonardo AI" },
  // Add more as needed; your canonical 20-provider list can be wired later.
];

export default function Page() {
  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">Provider Run Demo</h1>
      <RunGrid providers={providers} defaultPrompt="A whimsical lighthouse at sunset" />
    </div>
  );
}
