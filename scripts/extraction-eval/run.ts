// Entry point for `npm run eval:extraction`: the extraction eval against the provider this
// environment names. It calls a real model, so it runs on demand and never in CI. See runner.ts,
// and "Extraction contract version and eval" in docs/intake-schema.md.

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { relative } from "node:path";
import { fileURLToPath } from "node:url";
import { main } from "./runner";

const baselineFile = fileURLToPath(new URL("./baseline.json", import.meta.url));

process.exitCode = await main({
  args: process.argv.slice(2),
  env: (name) => process.env[name],
  log: (line) => console.log(line),
  baselinePath: relative(process.cwd(), baselineFile),
  readBaseline: () => (existsSync(baselineFile) ? readFileSync(baselineFile, "utf8") : null),
  writeBaseline: (text) => writeFileSync(baselineFile, text),
  now: () => new Date(),
});
