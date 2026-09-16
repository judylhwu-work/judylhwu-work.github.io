#!/usr/bin/env node
//
// Contract test between this site and the Supernova design system.
//
// The pages link Supernova live from its own Pages deploy — there is no pinned
// version (see the README). That is a deliberate trade: token fixes land here
// automatically, but a rename or removal upstream would also reach the live site
// untested. This check is what makes that trade safe: it fails if a --sn-* token
// the site relies on no longer exists.
//
//   node scripts/check-tokens.js
//
// Locally it reads the supernova-design-system symlink; in CI, the clone. Exits
// non-zero when a used token is undefined.

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SN = path.join(ROOT, 'supernova-design-system');

if (!fs.existsSync(SN)) {
  console.error('supernova-design-system is not present.\n' +
    'Locally: symlink the sibling repo. In CI: it is cloned into place.');
  process.exit(2);
}

const read = f => fs.readFileSync(f, 'utf8');

function walk(dir, test, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (['node_modules', '.git'].includes(entry.name)) continue;
      walk(full, test, out);
    } else if (test(full)) {
      out.push(full);
    }
  }
  return out;
}

// --- what the site uses -----------------------------------------------------
const siteFiles = [
  path.join(ROOT, 'style.css'),
  path.join(ROOT, 'project.css'),
  ...walk(path.join(ROOT, 'projects'), f => f.endsWith('.html')),
  ...walk(path.join(ROOT, 'private'), f => f.endsWith('.html')),
  ...walk(path.join(ROOT, 'scripts'), f => f.endsWith('.html')),
  ...['about', 'portfolio', 'resume'].map(d => path.join(ROOT, d, 'index.html')),
  path.join(ROOT, '404.html'),
].filter(fs.existsSync);

const used = new Map();   // token -> files referencing it
for (const f of siteFiles) {
  for (const m of read(f).matchAll(/var\((--sn-[a-z0-9-]+)/g)) {
    if (!used.has(m[1])) used.set(m[1], []);
    used.get(m[1]).push(path.relative(ROOT, f));
  }
}

// --- what Supernova defines -------------------------------------------------
const snFiles = [
  ...walk(path.join(SN, 'dist'), f => f.endsWith('.css')),
  ...walk(path.join(SN, 'components'), f => f.endsWith('.css')),
];
const defined = new Set();
for (const f of snFiles) {
  for (const m of read(f).matchAll(/^\s*(--sn-[a-z0-9-]+)\s*:/gm)) defined.add(m[1]);
}

// --- what this repo defines for itself --------------------------------------
// Deliberate overrides (e.g. the solid backing behind transparent screenshots).
// A token defined here still resolves even if Supernova drops it, so these are
// reported separately rather than failing the build.
const local = new Set();
for (const f of [path.join(ROOT, 'style.css'), path.join(ROOT, 'project.css')]) {
  for (const m of read(f).matchAll(/^\s*(--sn-[a-z0-9-]+)\s*:/gm)) local.add(m[1]);
}

const missing = [...used.keys()].filter(t => !defined.has(t) && !local.has(t)).sort();
const masked = [...local].filter(t => !defined.has(t)).sort();

console.log(`  ${used.size} --sn-* tokens used, ${defined.size} defined by Supernova, ${local.size} overridden here`);

if (masked.length) {
  console.log(`\n  note: ${masked.length} token(s) exist only because this repo defines them —`);
  console.log('  Supernova no longer ships them, so the override is now load-bearing:');
  for (const t of masked) console.log(`    ${t}`);
}

if (missing.length) {
  console.log(`\n  ${missing.length} token(s) used but defined nowhere:`);
  for (const t of missing) {
    console.log(`    ${t}`);
    console.log(`      used in: ${[...new Set(used.get(t))].join(', ')}`);
  }
  console.log('\n  Supernova likely renamed or removed them.');
  process.exit(1);
}

console.log('\n  All tokens the site uses are defined. ✓');
