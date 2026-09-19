/**
 * Project lint: no external dependencies, no network.
 *
 * Checks
 *  1. the version string is identical in every file that carries it
 *  2. every path referenced by manifest.json exists
 *  3. every authored .js file parses as an ES module
 *  4. _locales/en and _locales/fa carry the same keys, and every __MSG_ token
 *     used by the manifest exists in both
 *  5. the popup dictionaries (src/i18n.js) carry the same keys in fa and en
 *  6. no unsafe patterns (eval, new Function, innerHTML, remote script URLs)
 *  7. bilingual docs rules: RTL wrapper, matching section count, audit table
 *  8. no third-party project name leaks outside the legally required notice
 */
import { execFile } from "node:child_process";
import { mkdtemp, readdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const run = promisify(execFile);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const problems = [];
const fail = (message) => problems.push(message);
const read = (rel) => readFile(path.join(root, rel), "utf8");

const manifest = JSON.parse(await read("manifest.json"));
const pkg = JSON.parse(await read("package.json"));
const VERSION = manifest.version;

/* 1 ─ version parity ------------------------------------------------------- */
if (pkg.version !== VERSION) fail(`package.json version ${pkg.version} != manifest ${VERSION}`);
if (manifest.version_name && manifest.version_name !== VERSION) {
  fail(`manifest version_name ${manifest.version_name} != version ${VERSION}`);
}
for (const file of ["README.md", "README.fa.md", "CHANGELOG.md", ".github/release-notes.md"]) {
  const text = await read(file);
  if (!text.includes(VERSION)) fail(`${file} never mentions version ${VERSION}`);
  const older = [...text.matchAll(/v(\d+\.\d+\.\d+)/g)].map((m) => m[1]);
  if (older.length && !older.includes(VERSION)) fail(`${file} mentions ${older.join(", ")} but not ${VERSION}`);
}

/* 2 ─ manifest paths ------------------------------------------------------- */
const referenced = new Set([
  manifest.background?.service_worker,
  manifest.action?.default_popup,
  ...Object.values(manifest.icons ?? {}),
  ...Object.values(manifest.action?.default_icon ?? {})
].filter(Boolean));
for (const rel of referenced) {
  if (!existsSync(path.join(root, rel))) fail(`manifest references a missing file: ${rel}`);
}
if (manifest.default_locale && !existsSync(path.join(root, "_locales", manifest.default_locale))) {
  fail(`default_locale "${manifest.default_locale}" has no _locales folder`);
}
const KNOWN_PERMISSIONS = new Set([
  "storage", "activeTab", "scripting", "offscreen", "tabCapture", "downloads",
  ]);
for (const permission of manifest.permissions ?? []) {
  if (!KNOWN_PERMISSIONS.has(permission)) fail(`unexpected permission "${permission}" (document it before shipping)`);
}

if ("author" in manifest && typeof manifest.author !== "object") {
  fail("manifest author must be an object; a plain string makes Chrome show a load warning");
}

/* 3 ─ ES module syntax ----------------------------------------------------- */
async function collect(dir, out = []) {
  for (const entry of await readdir(path.join(root, dir), { withFileTypes: true })) {
    const rel = `${dir}/${entry.name}`;
    if (entry.isDirectory()) {
      if (entry.name === "vendor") continue;             // pre-built bundle, not authored here
      await collect(rel, out);
    } else if (entry.name.endsWith(".js") || entry.name.endsWith(".mjs")) out.push(rel);
  }
  return out;
}
const shipped = await collect("src");                     // code that reaches the browser
const tooling = [...(await collect("scripts")), ...(await collect("test"))];
const sources = [...shipped, ...tooling];
const shippedAssets = [...shipped, "src/popup.html", "src/offscreen.html", "src/popup.css", "manifest.json"];
const scratch = await mkdtemp(path.join(tmpdir(), "doble-parsi-lint-"));
for (const rel of sources) {
  const probe = path.join(scratch, `${rel.replace(/[\\/]/g, "_")}.mjs`);
  await writeFile(probe, await read(rel), "utf8");
  try {
    await run(process.execPath, ["--check", probe]);
  } catch (error) {
    fail(`syntax error in ${rel}: ${String(error.stderr ?? error.message).split("\n")[0]}`);
  }
}

/* 4 ─ locale catalogs ------------------------------------------------------ */
const locales = {};
for (const code of await readdir(path.join(root, "_locales"))) {
  locales[code] = JSON.parse(await read(`_locales/${code}/messages.json`));
}
const localeCodes = Object.keys(locales);
if (!localeCodes.includes("en") || !localeCodes.includes("fa")) fail("_locales must contain both en and fa");
const localeKeys = Object.fromEntries(localeCodes.map((code) => [code, Object.keys(locales[code]).sort()]));
for (const code of localeCodes) {
  for (const key of localeKeys.fa ?? []) {
    if (!localeKeys[code].includes(key)) fail(`_locales/${code} is missing key "${key}"`);
  }
  for (const key of localeKeys[code]) {
    if (!(localeKeys.fa ?? []).includes(key)) fail(`_locales/${code} has extra key "${key}"`);
    if (!locales[code][key]?.message) fail(`_locales/${code}: "${key}" has no message`);
  }
}
for (const token of JSON.stringify(manifest).matchAll(/__MSG_([A-Za-z0-9_]+)__/g)) {
  for (const code of localeCodes) {
    if (!locales[code][token[1]]) fail(`manifest uses __MSG_${token[1]}__ but _locales/${code} lacks it`);
  }
}

/* 5 ─ popup dictionary parity --------------------------------------------- */
const { DICT } = await import(new URL("../src/i18n.js", import.meta.url));
const faKeys = Object.keys(DICT.fa).sort();
const enKeys = Object.keys(DICT.en).sort();
for (const key of faKeys) if (!enKeys.includes(key)) fail(`src/i18n.js: English dictionary is missing "${key}"`);
for (const key of enKeys) if (!faKeys.includes(key)) fail(`src/i18n.js: Persian dictionary is missing "${key}"`);

/* 6 ─ unsafe patterns ------------------------------------------------------ */
const UNSAFE = [
  [/\beval\s*\(/, "eval() is not allowed under the extension CSP"],
  [/new\s+Function\s*\(/, "new Function() is not allowed under the extension CSP"],
  [/\.innerHTML\s*=/, "assign textContent instead of innerHTML"],
  [/document\.write\s*\(/, "document.write() is not allowed"],
  [/<script[^>]+src=["']https?:/i, "remote script tags are not allowed"],
  [/https?:\/\/(?!generativelanguage\.googleapis\.com|github\.com|aistudio\.google\.com|www\.w3\.org|developer\.chrome\.com|chromewebstore\.google\.com|microsoftedge\.microsoft\.com|opensource\.org|img\.shields\.io|ai\.dev|mozilla\.org|nodejs\.org)[^\s"')]+/, "unexpected remote origin"]
];
for (const rel of shippedAssets) {
  const text = await read(rel);
  for (const [pattern, message] of UNSAFE) {
    const hit = pattern.exec(text);
    if (hit) fail(`${rel}: ${message} (${hit[0].slice(0, 60)})`);
  }
}

/* 7 ─ bilingual documentation rules --------------------------------------- */
const readmeEn = await read("README.md");
const readmeFa = await read("README.fa.md");
const notes = await read(".github/release-notes.md");
if (!readmeFa.trimStart().startsWith('<div dir="rtl">')) fail("README.fa.md must open with <div dir=\"rtl\">");
if (!readmeFa.trimEnd().endsWith("</div>")) fail("README.fa.md must close its RTL wrapper");
if (!notes.includes('<div dir="rtl">')) fail(".github/release-notes.md needs an RTL-wrapped Persian section");
const countHeadings = (text) => (text.match(/^##\s/gm) ?? []).length;
if (countHeadings(readmeEn) !== countHeadings(readmeFa)) {
  fail(`README section count differs: en ${countHeadings(readmeEn)} vs fa ${countHeadings(readmeFa)}`);
}
for (const [file, text] of [["README.md", readmeEn], ["README.fa.md", readmeFa], [".github/release-notes.md", notes]]) {
  if (!/\|\s*(Area|بخش)\s*\|/.test(text)) fail(`${file} is missing the security audit table`);
}
for (const [file, text] of [["README.md", readmeEn], ["README.fa.md", readmeFa]]) {
  if (!text.includes("Load unpacked")) fail(`${file} must document the Load unpacked install path`);
}

/* 8 ─ third-party naming --------------------------------------------------- */
const LEAK = /mediabunny/i;
for (const rel of [...shippedAssets, "README.md", "README.fa.md", "CHANGELOG.md",
  ".github/release-notes.md", "SECURITY.md", "package.json", "_locales/en/messages.json",
  "_locales/fa/messages.json"]) {
  if (LEAK.test(await read(rel))) fail(`${rel} still names a third-party project`);
}

/* 9 ─ every referenced runtime resource resolves ------------------------- */
for (const rel of shippedAssets) {
  const text = await read(rel);
  const dir = path.dirname(rel);
  for (const hit of text.matchAll(/chrome\.runtime\.getURL\(\s*["']([^"']+)["']/g)) {
    if (!existsSync(path.join(root, hit[1]))) fail(`${rel}: getURL("${hit[1]}") points nowhere`);
  }
  for (const hit of text.matchAll(/(?:src|href)="(\.[^"]+)"|url\("(\.[^"]+)"\)/g)) {
    const target = (hit[1] ?? hit[2]).split("?")[0];
    if (!existsSync(path.join(root, dir, target))) fail(`${rel}: "${target}" points nowhere`);
  }
}

/* 10 ─ injected stage bundle ---------------------------------------------- */
// اسکریپت صحنه با files: تزریق می‌شود، پس اسکریپت کلاسیک است نه ماژول.
// یک import/export فراموش‌شده در آن، فقط سر ویدئوی کاربر معلوم می‌شود.
const worker = await read("src/service-worker.js");
const listed = /const STAGE_FILES = \[([^\]]+)\]/.exec(worker);
if (!listed) fail("src/service-worker.js no longer declares STAGE_FILES");
else {
  const files = [...listed[1].matchAll(/"([^"]+)"/g)].map((hit) => hit[1]);
  if (!files.length) fail("STAGE_FILES is empty");
  for (const rel of files) {
    if (!existsSync(path.join(root, rel))) {
      fail(`STAGE_FILES references a missing file: ${rel}`);
      continue;
    }
    const text = await read(rel);
    if (/^\s*(export|import)\s/m.test(text)) {
      fail(`${rel} is injected as a classic script, so it must not use import/export`);
    }
  }
}

if (problems.length) {
  console.error(`lint: ${problems.length} problem(s)`);
  for (const problem of problems) console.error(`  - ${problem}`);
  process.exit(1);
}
console.log(`lint: ok (${sources.length} modules, ${localeCodes.length} locales, version ${VERSION})`);
