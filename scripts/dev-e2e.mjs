import { spawn } from "node:child_process";
import { config } from "dotenv";

config({ path: ".env.staging.local", override: true, quiet: true });

if (process.env.APP_ENV !== "staging") {
  throw new Error(
    "dev:e2e memerlukan .env.staging.local dengan APP_ENV=staging. Nilai env tidak dicetak.",
  );
}

const command = process.platform === "win32" ? "npx.cmd" : "npx";
const child = spawn(command, ["next", "dev"], {
  stdio: "inherit",
  env: process.env,
  shell: process.platform === "win32",
});

child.on("exit", (code) => process.exit(code ?? 0));

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => child.kill(signal));
}
