const { spawnSync } = require("node:child_process");
const isWin = process.platform === "win32";
const isCI = !!process.env.CI;

if (isWin && !isCI) {
  const res = spawnSync(
    "pwsh",
    ["-NoProfile","-ExecutionPolicy","Bypass","-File","scripts\\enforce-imports.ps1"],
    { stdio: "inherit", shell: true }
  );
  process.exit(res.status ?? 0);
} else {
  console.log("prebuild: skipping on CI/non-Windows");
}
