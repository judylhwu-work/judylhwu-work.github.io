#!/usr/bin/env node
/**
 * Verifies every StaticCrypt-protected case study still decrypts to its
 * plaintext source, and that a wrong password is still rejected.
 *
 * Run after anything that regenerates the protected pages (scripts/encrypt.sh,
 * template edits, meta changes) to confirm the gate wasn't broken.
 *
 *   node scripts/verify-gates.js
 *
 * Reads the password from private/.password or $STATICRYPT_PASSWORD. Both the
 * password file and the plaintext sources are git-ignored; this script is not.
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const codec = require(path.join(ROOT, "node_modules/staticrypt/lib/codec.js"));
const cryptoEngine = require(path.join(ROOT, "node_modules/staticrypt/lib/cryptoEngine.js"));
const { decode } = codec.init(cryptoEngine);

const ALL_SLUGS = ["nova", "smart-huddles", "definitions", "nova-to-claude"];

// `--quiet <slug>` makes this usable as a predicate: exit 0 only if that page
// decrypts to its current source. encrypt.sh uses it to decide re-encryption,
// which is exact where an mtime comparison was not.
const QUIET = process.argv.includes("--quiet");
const ARG_SLUGS = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const SLUGS = ARG_SLUGS.length ? ARG_SLUGS : ALL_SLUGS;

function password() {
  if (process.env.STATICRYPT_PASSWORD) return process.env.STATICRYPT_PASSWORD;
  const f = path.join(ROOT, "private/.password");
  if (fs.existsSync(f)) return fs.readFileSync(f, "utf8").trim();
  console.error("verify-gates: no password (set STATICRYPT_PASSWORD or create private/.password)");
  process.exit(2);
}

/** Pull the embedded staticryptConfig object out of a published page. */
function extractConfig(html) {
  const start = html.indexOf('{"staticryptEncryptedMsgUniqueVariableName"');
  if (start < 0) return null;
  let depth = 0;
  for (let i = start; i < html.length; i++) {
    if (html[i] === "{") depth++;
    else if (html[i] === "}" && --depth === 0) return JSON.parse(html.slice(start, i + 1));
  }
  return null;
}

(async () => {
  const pw = password();
  let ok = true;

  for (const slug of SLUGS) {
    const pubPath = path.join(ROOT, "projects", slug, "index.html");
    const srcPath = path.join(ROOT, "private/projects", slug, "index.html");

    const cfg = extractConfig(fs.readFileSync(pubPath, "utf8"));
    if (!cfg) { console.log(`  FAIL ${slug}: no encrypted payload found`); ok = false; continue; }

    const salt = cfg.staticryptSaltUniqueVariableName;
    const hashed = await cryptoEngine.hashPassword(pw, salt);
    const res = await decode(cfg.staticryptEncryptedMsgUniqueVariableName, hashed, salt);

    if (!res.success) { console.log(`  FAIL ${slug}: decrypt failed (${res.message})`); ok = false; continue; }

    const matches = fs.existsSync(srcPath) && res.decoded === fs.readFileSync(srcPath, "utf8");
    if (!QUIET) console.log(`  ${matches ? "ok  " : "WARN"} ${slug}: decrypts (${res.decoded.length} bytes)` +
                (matches ? ", matches private source" : ", but does NOT match private source"));
    if (!matches) ok = false;
  }

  if (QUIET) process.exit(ok ? 0 : 1);

  // A wrong password must still be rejected.
  const cfg = extractConfig(fs.readFileSync(path.join(ROOT, "projects/nova/index.html"), "utf8"));
  const salt = cfg.staticryptSaltUniqueVariableName;
  const bad = await decode(
    cfg.staticryptEncryptedMsgUniqueVariableName,
    await cryptoEngine.hashPassword("definitely-not-the-password", salt),
    salt
  );
  console.log(`  ${bad.success === false ? "ok  " : "FAIL"} wrong password is rejected`);
  if (bad.success !== false) ok = false;

  console.log(ok ? "\n  All gates verified." : "\n  GATE VERIFICATION FAILED");
  process.exit(ok ? 0 : 1);
})().catch((e) => { console.error("verify-gates error:", e); process.exit(1); });
