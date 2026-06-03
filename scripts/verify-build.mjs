import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";

const outDir = "build";
const indexFile = join(outDir, "index.html");
const assetsDir = join(outDir, "assets");

if (!existsSync(outDir)) {
  console.error(`[verify-build] Missing output directory: ${outDir}`);
  process.exit(1);
}

if (!existsSync(indexFile)) {
  console.error(`[verify-build] Missing ${indexFile}. Build artifacts are incomplete.`);
  process.exit(1);
}

if (!existsSync(assetsDir)) {
  console.error(`[verify-build] Missing ${assetsDir}. Compiled assets were not generated.`);
  process.exit(1);
}

const assets = readdirSync(assetsDir);
if (!assets.length) {
  console.error(`[verify-build] ${assetsDir} is empty. Build did not generate bundled files.`);
  process.exit(1);
}

console.log(`[verify-build] Build output is valid.`);
console.log(`[verify-build] ${outDir}/`);
console.log(`[verify-build] ${outDir}/index.html`);
console.log(`[verify-build] ${outDir}/assets (${assets.length} files)`);
