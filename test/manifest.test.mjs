import assert from "node:assert/strict";
import { test } from "node:test";
import { readFile } from "node:fs/promises";

const manifest = JSON.parse(await readFile(new URL("../manifest.json", import.meta.url), "utf8"));
const pkg = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));

test("manifest v3 with a matching version everywhere", () => {
  assert.equal(manifest.manifest_version, 3);
  assert.equal(manifest.version, pkg.version);
  assert.equal(manifest.version_name, pkg.version);
  assert.match(manifest.version, /^\d+\.\d+\.\d+$/);
});

test("the download naming permission is present", () => {
  assert.ok(manifest.permissions.includes("downloads"));
  });

test("host access is limited to the AI endpoint and YouTube", () => {
  assert.deepEqual(manifest.host_permissions, [
    "https://generativelanguage.googleapis.com/*",
    "https://www.youtube.com/*"
  ]);
  assert.equal(JSON.stringify(manifest).includes("<all_urls>"), false);
  // the only content script is the YouTube on-video quick panel
  assert.equal(manifest.content_scripts.length, 1);
  assert.deepEqual(manifest.content_scripts[0].matches, ["https://www.youtube.com/*"]);
  assert.deepEqual(manifest.content_scripts[0].js, ["src/overlay/yt-controls.js"]);
  assert.equal("web_accessible_resources" in manifest, false);
});

test("the CSP allows no remote code", () => {
  const csp = manifest.content_security_policy.extension_pages;
  assert.match(csp, /script-src 'self' 'wasm-unsafe-eval'/);
  assert.equal(csp.includes("unsafe-eval'"), csp.includes("wasm-unsafe-eval'"));
  assert.equal(csp.includes("http"), false);
});

test("localised manifest strings are wired up", () => {
  assert.equal(manifest.default_locale, "fa");
  assert.match(manifest.name, /^__MSG_\w+__$/);
  assert.match(manifest.description, /^__MSG_\w+__$/);
});

test("no string author key (Chrome warns about it)", () => {
  assert.equal("author" in manifest, false);
});
