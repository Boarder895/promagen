// scripts/generate-emoji-icons.ts
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const emojiBankPath = path.join(__dirname, "../src/data/emoji-bank.json");
const outputIconPath = path.join(__dirname, "../src/components/ui/emoji-icons.tsx");
const outputTypePath = path.join(__dirname, "../src/types/emoji-names.d.ts");

const emojiBankRaw = fs.readFileSync(emojiBankPath, "utf8");
const emojiBank = JSON.parse(emojiBankRaw) as Record<string, string>;

// ---- ICONS: generate emoji-icons.tsx
const toPascalCase = (key: string) =>
  key
    .replace(/[^a-zA-Z0-9]/g, " ")
    .split(" ")
    .filter(Boolean)
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join("") + "Icon";

let iconFile = `// AUTO-GENERATED FILE — DO NOT EDIT
// Run: pnpm generate:emoji-icons

"use client";
import { Emoji } from "@/components/ui/emoji";

`;

const iconNames: string[] = [];
for (const name of Object.keys(emojiBank)) {
  const exportName = toPascalCase(name);
  iconNames.push(exportName);
  iconFile += `export const ${exportName} = ({ className }: { className?: string } = {}) => (
  <Emoji name="${name}" className={className} />
);\n`;
}
iconFile += `\nexport const Icons = {\n  ${iconNames.join(",\n  ")}\n};\n`;

fs.writeFileSync(outputIconPath, iconFile, "utf8");

// ---- TYPES: generate emoji-names.d.ts
const emojiNames = Object.keys(emojiBank)
  .map((k) => `"${k}"`)
  .sort()
  .join(" | ");

const typeFile = `// AUTO-GENERATED — DO NOT EDIT
// Run: pnpm generate:emoji-icons

export type EmojiName = ${emojiNames};
`;

fs.mkdirSync(path.dirname(outputTypePath), { recursive: true });
fs.writeFileSync(outputTypePath, typeFile, "utf8");

console.log(`✅ Generated ${iconNames.length} icons and EmojiName type`);
