#!/usr/bin/env node
//
// The gate every site mode must pass before it ships. For each mode in
// modes/modes.json, on every page, in light and dark:
//
//   boots      ?mode=<id> opens the page in that mode, with its stylesheets
//              loaded and (for a shell mode) its shell mounted
//   healthy    no console errors, page errors or failed requests
//   parity     the page's own content is all still there: every word of #main
//              in Professional is present in the mode (a mode re-presents the
//              content, it never drops it)
//   reversible switching back to Professional in place restores #main exactly
//              and leaves no mode stylesheet behind
//   remembered the choice is saved, so the next visit opens in it
//   accessible axe-core finds no WCAG 2.2 A/AA violations
//
//   python3 -m http.server 8000      # from the repo root
//   node scripts/check-modes.js      # or: npm run check:modes
//   node scripts/check-modes.js ipod # one mode only
//
// Uses the same browser lookup as check-pages.js. Exits non-zero on any failure.

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const BASE = (process.env.BASE || 'http://localhost:8000').replace(/\/$/, '');

let chromium;
try { ({ chromium } = require('playwright-core')); } catch (e) {
  console.error('playwright-core is not installed. Run: npm install'); process.exit(2);
}
let AXE;
try { AXE = fs.readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8'); } catch (e) {
  console.error('axe-core is not installed. Run: npm install'); process.exit(2);
}

const registry = JSON.parse(fs.readFileSync(path.join(ROOT, 'modes/modes.json'), 'utf8'));
const only = process.argv[2];
const modes = registry.modes.filter(m => m.id !== registry['default'] && (!only || m.id === only));
if (!modes.length) { console.error('no modes to check' + (only ? ': ' + only : '')); process.exit(2); }

const meta = JSON.parse(fs.readFileSync(path.join(ROOT, 'scripts/page-meta.json'), 'utf8'));
const isLocal = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:|\/|$)/.test(BASE);
const urls = Object.entries(meta.pages).filter(([f]) => f !== 'index.html').map(([, i]) => i.url)
  .concat(['/404.html'])
  .concat(isLocal && fs.existsSync(path.join(ROOT, 'private/projects'))
    ? fs.readdirSync(path.join(ROOT, 'private/projects')).map(s => `/private/projects/${s}/index.html`)
    : []);

// Third-party requests (fonts, analytics) are not the mode's to answer for.
const ours = u => u.startsWith(BASE);
const words = s => (s || '').replace(/\s+/g, ' ').trim().split(' ').filter(Boolean);

async function launchBrowser() {
  if (process.env.CHROME_PATH) return chromium.launch({ executablePath: process.env.CHROME_PATH });
  for (const channel of ['chrome', 'chromium']) {
    try { return await chromium.launch({ channel }); } catch (e) {
      if (channel === 'chromium') throw new Error('no Chrome or Chromium found. Set CHROME_PATH.\n' + e.message);
    }
  }
}

async function checkPage(browser, mode, url, theme) {
  const problems = [];
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: 'reduce' });
  await ctx.addInitScript(t => { try { localStorage.setItem('theme', t); } catch (e) {} }, theme);
  const page = await ctx.newPage();
  page.on('console', m => { if (m.type() === 'error' && !/ERR_|net::/.test(m.text())) problems.push('console: ' + m.text().slice(0, 100)); });
  page.on('pageerror', e => problems.push('pageerror: ' + String(e).slice(0, 100)));
  page.on('requestfailed', r => { if (ours(r.url())) problems.push('request failed: ' + r.url().slice(-60)); });

  // Professional first: the reference text.
  await page.goto(BASE + url, { waitUntil: 'networkidle' });
  const profText = await page.evaluate(() => (document.getElementById('main') || document.body).textContent);

  // Boot straight into the mode with a ?mode= link.
  await page.goto(BASE + url + (url.includes('?') ? '&' : '?') + 'mode=' + mode.id, { waitUntil: 'networkidle' });
  await page.waitForTimeout(300);
  const booted = await page.evaluate(id => ({
    attr: document.documentElement.getAttribute('data-mode'),
    current: window.SiteModes && window.SiteModes.current(),
    sheets: [...document.querySelectorAll('link[data-mode-asset="' + id + '"]')].filter(l => l.sheet).length,
    stored: (() => { try { return localStorage.getItem('mode'); } catch (e) { return null; } })(),
    query: location.search.includes('mode='),
  }), mode.id);
  if (booted.attr !== mode.id || booted.current !== mode.id) problems.push(`did not boot into ${mode.id} (got ${booted.attr})`);
  if ((mode.css || []).length && booted.sheets !== mode.css.length) problems.push(`${booted.sheets}/${mode.css.length} stylesheets applied`);
  if (booted.stored !== mode.id) problems.push('choice was not saved');
  if (booted.query) problems.push('?mode= left in the address bar');

  // Parity: nothing the page says may go missing.
  const modeText = await page.evaluate(() => (document.getElementById('main') || document.body).textContent);
  const have = new Set(words(modeText));
  const missing = [...new Set(words(profText))].filter(w => !have.has(w));
  if (missing.length) problems.push('content missing in mode: ' + missing.slice(0, 8).join(' '));

  // Accessibility.
  await page.addScriptTag({ content: AXE });
  const v = await page.evaluate(async () => (await axe.run(document, {
    runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] },
  })).violations.map(x => `${x.id} (${x.nodes.length}): ${x.nodes[0].target.join(' ')}`));
  v.forEach(x => problems.push('a11y: ' + x));

  // Reversible: back to Professional in place.
  await page.evaluate(() => window.SiteModes.set('professional'));
  await page.waitForTimeout(200);
  const back = await page.evaluate(id => ({
    attr: document.documentElement.getAttribute('data-mode'),
    left: document.querySelectorAll('link[data-mode-asset="' + id + '"]').length,
    text: (document.getElementById('main') || document.body).textContent,
  }), mode.id);
  if (back.attr !== registry['default']) problems.push('could not switch back to Professional');
  if (back.left) problems.push(`${back.left} ${mode.id} stylesheet(s) left after switching back`);
  if (words(back.text).join(' ') !== words(profText).join(' ')) problems.push('#main differs after switching back');

  await ctx.close();
  return problems;
}

(async () => {
  const browser = await launchBrowser();
  let failed = 0;
  try {
    for (const mode of modes) {
      console.log(`\n${mode.label} (${mode.id})`);
      for (const url of urls) for (const theme of ['light', 'dark']) {
        const problems = await checkPage(browser, mode, url, theme);
        const ok = problems.length === 0;
        if (!ok) failed++;
        console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${theme.padEnd(5)} ${url}`);
        problems.forEach(p => console.log('         - ' + p));
      }
    }
  } finally { await browser.close(); }
  console.log(failed ? `\n${failed} page check(s) failed` : '\nall mode checks passed');
  process.exit(failed ? 1 : 0);
})();
