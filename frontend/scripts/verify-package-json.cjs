const fs = require("fs");
const p = "package.json";
const raw = fs.readFileSync(p);
let txt = raw.toString("utf8");
if (raw[0] === 0xEF && raw[1] === 0xBB && raw[2] === 0xBF) {
  txt = txt.slice(3);
}
txt = txt.replace(/,(\s*[}\]])/g, "$1"); // strip trailing commas
JSON.parse(txt); // throws if invalid
fs.writeFileSync(p, txt, { encoding: "utf8" });
console.log("package.json verified ✔");
