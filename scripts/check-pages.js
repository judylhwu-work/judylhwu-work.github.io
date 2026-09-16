#!/usr/bin/env node
//
// Loads every page in a real browser and asserts it is healthy: no broken
// images, no console errors, no failed requests, and — on case-study pages —
// that clicking an image opens the lightbox with the full-size file.
//
// Complements the other two checks: test-404-routes.js exercises the router's
// logic and verify-gates.js proves the ciphertext decrypts. This one is the
// only check that runs the pages the way a visitor does.
//
// Drives headless Chrome through playwright-core, using the Chrome already
// installed on the machine (channel: 'chrome') — no browser download.
//
//   python3 -m http.server 8000     # in a second terminal, from the repo root
//   node scripts/check-pages.js     # or: npm run check
//   BASE=http://localhost:8080 node scripts/check-pages.js
//
// The page list is derived from scripts/page-meta.json, so a page added there
// is checked here automatically. Exits non-zero if anything fails.

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const BASE = (process.env.BASE || 'http://localhost:8000').replace(/\/$/, '');

let chromium;
try {
  ({ chromium } = require('playwright-core'));
} catch (e) {
  console.error('playwright-core is not installed. Run: npm install');
  process.exit(2);
}

const meta = JSON.parse(fs.readFileSync(path.join(ROOT, 'scripts/page-meta.json'), 'utf8'));
// index.html is a redirect stub — it bounces to /portfolio/, which is checked
// on its own, so visiting it here would just measure the same page twice.
const urls = Object.entries(meta.pages)
  .filter(([file]) => file !== 'index.html')
  .map(([, info]) => info.url);

// The readable NDA sources are git-ignored, so they only exist on a machine
// that has them. They are served from the repo root like any other file.
const ndaSources = fs.existsSync(path.join(ROOT, 'private/projects'))
  ? fs.readdirSync(path.join(ROOT, 'private/projects'))
      .map(slug => `/private/projects/${slug}/index.html`)
  : [];

const pad = (s, n) => String(s).padEnd(n);

async function checkPage(browser, url, { nda = false } = {}) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const problems = [];
  page.on('console', m => { if (m.type() === 'error') problems.push('console: ' + m.text().slice(0, 100)); });
  page.on('pageerror', e => problems.push('pageerror: ' + String(e).slice(0, 100)));
  page.on('requestfailed', r => problems.push('request failed: ' + r.url().slice(-60)));

  const res = await page.goto(BASE + url, { waitUntil: 'networkidle' });
  if (!res || !res.ok()) problems.push(`HTTP ${res ? res.status() : 'no response'}`);

  // Pull lazy-loaded images into view before judging whether they loaded.
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(1200);

  const state = await page.evaluate(() => {
    // #lightbox-img is deliberately empty until an image is opened.
    const imgs = [...document.images].filter(i => i.id !== 'lightbox-img');
    return {
      total: imgs.length,
      broken: imgs.filter(i => !i.complete || i.naturalWidth === 0).map(i => i.getAttribute('src')),
      gated: !!document.querySelector('input[type=password]'),
      zoomable: document.querySelectorAll('.project-image, .project-image-grid img').length,
      lightboxMounted: !!document.getElementById('lightbox'),
    };
  });
  problems.push(...state.broken.map(s => 'broken image: ' + s));

  let note = `imgs=${pad(state.total, 3)}`;

  if (state.gated) {
    note += ' gate=prompt shown';
  } else if (state.zoomable > 0) {
    await page.evaluate(() => {
      const img = document.querySelector('.project-image, .project-image-grid img');
      img.scrollIntoView({ block: 'center' });
      img.click();
    });
    await page.waitForTimeout(1200);
    const lb = await page.evaluate(() => {
      const img = document.getElementById('lightbox-img');
      return {
        open: document.getElementById('lightbox').classList.contains('active'),
        src: img.getAttribute('src') || '',
        naturalWidth: img.naturalWidth,
      };
    });
    if (!lb.open) problems.push('lightbox did not open');
    if (!lb.src.endsWith('-full.webp')) problems.push('lightbox did not load the -full file: ' + lb.src);
    if (lb.naturalWidth < 1000) problems.push(`lightbox image is only ${lb.naturalWidth}px wide`);
    note += ` lightbox=${lb.naturalWidth}px`;
  } else if (nda) {
    // These pages carry no images; the point is that lightbox.js copes with that.
    if (!state.lightboxMounted) problems.push('lightbox.js did not mount');
    note += ' lightbox=mounted, no images';
  }

  await page.close();
  return { url, problems, note };
}

(async () => {
  const browser = await chromium.launch({ channel: 'chrome' });
  const results = [];

  try {
    for (const url of urls) results.push(await checkPage(browser, url));
    for (const url of ndaSources) results.push(await checkPage(browser, url, { nda: true }));
  } finally {
    await browser.close();
  }

  for (const r of results) {
    const ok = r.problems.length === 0;
    console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${pad(r.url, 38)} ${r.note}`);
    for (const p of r.problems) console.log(`         ${p}`);
  }

  const failed = results.filter(r => r.problems.length);
  console.log(failed.length
    ? `\n  ${failed.length} of ${results.length} pages failed.`
    : `\n  All ${results.length} pages OK.`);
  process.exit(failed.length ? 1 : 0);
})().catch(err => {
  const hint = /ECONNREFUSED|net::ERR_CONNECTION_REFUSED/.test(err.message)
    ? `\nNothing is serving ${BASE}. Start one: python3 -m http.server 8000`
    : '';
  console.error('check-pages failed:', err.message + hint);
  process.exit(2);
});
