import fs from "fs";
import path from "path";

const targets = [
  "bing","nightcafe","pixlr","fotor","a123rf","artistly",
  "openart","myedit","wombo","starryai","craiyon"
];

const template = fs.readFileSync(
  path.join(__dirname, "formatter.template.ts"), "utf8"
);

const outDir = path.join(__dirname, "..", "src/providers/copypaste");

for (const name of targets) {
  const content = template
    .replace(/__NAME__/g, name);
  const file = path.join(outDir, `${name}.ts`);
  fs.writeFileSync(file, content, "utf8");
  console.log("Wrote", file);
}


