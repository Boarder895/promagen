// Plain Node.js (no TypeScript needed)
// Run with:  node scripts/scaffold-providers.js

const fs = require("fs");
const path = require("path");

// ---- Targets ----
const COPY_PASTE = [
  "midjourney","canva","firefly","bing","nightcafe","pixlr","fotor","a123rf",
  "artistly","openart","myedit","wombo","starryai","craiyon"
];

const API_STUBS = [
  "lexica","novelai","edenai","runware","hive","recraft","flux_bfl","picsart"
];

// ---- Templates ----
const formatterTemplate = (name) => `import { PromptFormatter, GenInput } from "../types";

export const ${name}Formatter: PromptFormatter = {
  name: "${name}",
  format(input: GenInput) {
    const np = input.negativePrompt ? \` (avoid: \${input.negativePrompt})\` : "";
    const sz = (input.width && input.height) ? \` [\${input.width}x\${input.height}]\` : "";
    return {
      prompt: \`\${input.prompt}\${np}\${sz}\`,
      tips: ["Paste into ${name} UI → generate."]
    };
  }
};
`;

const apiStubTemplate = (name) => `import { ImageProvider, GenInput, GenOutput } from "../types";

export const ${toVar(name)}Provider: ImageProvider = {
  name: "${toId(name)}",
  supportsNegative: true,
  supportsSeed: true,
  supportsSize: true,
  supportsModelSelect: true,
  async generate(_input: GenInput): Promise<GenOutput> {
    return {
      ok: false,
      provider: "${toId(name)}",
      code: "NOT_CONFIGURED",
      message: "${pretty(name)} API adapter pending endpoint + auth"
    };
  }
};

function toId(n: string) { return n; } // keep file id as-is
`;

function toVar(n) {
  // make a clean TS identifier for the variable name
  return n.replace(/[^a-zA-Z0-9_]/g, "_");
}

// ---- Write files ----
const root = process.cwd();
const cpOutDir  = path.join(root, "src", "providers", "copypaste");
const apiOutDir = path.join(root, "src", "providers", "api");

fs.mkdirSync(cpOutDir, { recursive: true });
fs.mkdirSync(apiOutDir, { recursive: true });

for (const name of COPY_PASTE) {
  const file = path.join(cpOutDir, `${name}.ts`);
  fs.writeFileSync(file, formatterTemplate(name), "utf8");
  console.log("Wrote", path.relative(root, file));
}

for (const name of API_STUBS) {
  const file = path.join(apiOutDir, `${name}.ts`);
  fs.writeFileSync(file, apiStubTemplate(name), "utf8");
  console.log("Wrote", path.relative(root, file));
}

function pretty(n){ return n.replace(/_/g," ").replace(/\b\w/g, c => c.toUpperCase()); }

