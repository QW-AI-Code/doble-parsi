/**
 * Build step: stage the loadable extension into dist/ and produce the
 * "Load unpacked" ZIP plus a SHA-256 checksum file. No dependencies.
 *
 *   dist/doble-parsi/                 ← unpacked folder (load this in Chrome)
 *   dist/doble-parsi-<version>-chrome.zip
 *   dist/checksums.txt
 */
import { createHash } from "node:crypto";
import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createZip } from "./zip.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dist = path.join(root, "dist");
const manifest = JSON.parse(await readFile(path.join(root, "manifest.json"), "utf8"));
const pkg = JSON.parse(await readFile(path.join(root, "package.json"), "utf8"));

if (manifest.version !== pkg.version) {
  throw new Error(`version mismatch: manifest ${manifest.version} vs package ${pkg.version}`);
}

const stageName = "doble-parsi";
const stage = path.join(dist, stageName);
const SHIPPED = ["manifest.json", "src", "_locales", "assets"];

await rm(dist, { recursive: true, force: true });
await mkdir(stage, { recursive: true });
for (const item of SHIPPED) {
  await cp(path.join(root, item), path.join(stage, item), { recursive: true });
}

/** Files inside the staged folder, sorted for a deterministic archive. */
async function walk(dir, prefix = "") {
  const { readdir } = await import("node:fs/promises");
  const found = [];
  for (const entry of (await readdir(dir, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))) {
    const abs = path.join(dir, entry.name);
    const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) found.push(...(await walk(abs, rel)));
    else found.push({ name: rel, abs });
  }
  return found;
}

const files = await walk(stage);
const zipName = `doble-parsi-${manifest.version}-chrome.zip`;
const zipPath = path.join(dist, zipName);
const zip = createZip(await Promise.all(files.map(async (file) => ({ name: file.name, data: await readFile(file.abs) }))));
await writeFile(zipPath, zip);

const sha = createHash("sha256").update(zip).digest("hex");
await writeFile(path.join(dist, "checksums.txt"), `${sha}  ${zipName}\n`, "utf8");

const kb = (zip.length / 1024).toFixed(1);
console.log(`build: ${files.length} files -> dist/${zipName} (${kb} KB)`);
console.log(`build: sha256 ${sha}`);
console.log(`build: unpacked folder ready at dist/${stageName}`);
