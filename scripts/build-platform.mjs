import { spawnSync } from "node:child_process";

const command = process.env.VERCEL ? "next" : "vinext";
const executable = process.platform === "win32"
  ? `node_modules\\.bin\\${command}.cmd`
  : `node_modules/.bin/${command}`;
const result = spawnSync(executable, ["build"], { stdio: "inherit" });

if (result.error) throw result.error;
process.exit(result.status ?? 1);
