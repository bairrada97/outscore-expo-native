import { mkdirSync, writeFileSync } from "node:fs";
import { basename, dirname, resolve } from "node:path";

const args = process.argv.slice(2);
const urlIndex = args.indexOf("--url");
const outIndex = args.indexOf("--out");

const url = urlIndex !== -1 ? args[urlIndex + 1] : null;
if (!url) {
	console.error("Usage: bun ml/data-acquisition/download-historical-data.ts --url <file-url> [--out <path>]");
	process.exit(1);
}

const outPath = outIndex !== -1
	? resolve(args[outIndex + 1])
	: resolve("ml/data/raw", basename(new URL(url).pathname));

mkdirSync(dirname(outPath), { recursive: true });

const response = await fetch(url);
if (!response.ok) {
	throw new Error(`Failed to download ${url}: ${response.status} ${response.statusText}`);
}

const buffer = Buffer.from(await response.arrayBuffer());
writeFileSync(outPath, buffer);
console.log(`✅ Downloaded ${url}`);
console.log(`📁 Saved to ${outPath}`);
