#!/usr/bin/env node
/**
 * Exercises the 404 page's recovery router against real typos and legacy URLs.
 *
 *   node scripts/test-404-routes.js
 *
 * It runs the ACTUAL script out of 404.html against a fake location, so the
 * tests can't drift from the shipped logic. Add a case whenever you rename a
 * page or find a stale link in the wild.
 */
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');

const html = fs.readFileSync(path.join(ROOT, '404.html'), 'utf8');
const cfg = JSON.parse(
  html.match(/<script id="routes" type="application\/json">([\s\S]*?)<\/script>/)[1]
);
// The router is the last inline <script> on the page. Match block-by-block so a
// lazy quantifier can't run across the theme script that precedes it.
const blocks = [...html.matchAll(/<script>((?:(?!<\/script>)[\s\S])*)<\/script>/g)].map((m) => m[1]);
const src = blocks[blocks.length - 1];

function decide(pathname) {
  let target = null;
  const document = {
    getElementById: (id) =>
      id === 'routes'
        ? { textContent: JSON.stringify(cfg) }
        : { textContent: '', hidden: true, href: '' },
  };
  const location = { pathname, replace: (t) => { target = t; } };
  new Function('document', 'location', 'setTimeout', src)(document, location, (fn) => fn());
  return target;
}

const NONE = null;
const cases = [
  // the typo case that started this
  ['/projects/smat-huddles/',            '/projects/smart-huddles/'],
  ['/projects/smart-hudles/',            '/projects/smart-huddles/'],
  ['/projects/smarthuddles/',            '/projects/smart-huddles/'],
  // renamed URLs (the pre-rename NDA case-study aliases were removed on purpose —
  // they named the client and this repo is public)
  ['/work.html',                         '/portfolio/'],
  ['/experience',                        '/resume/'],
  // ordinary typos
  ['/abut/',                             '/about/'],
  ['/resme/',                            '/resume/'],
  ['/projects/airobe/',                  '/projects/airrobe/'],
  ['/projects/gramcty/',                 '/projects/gramcity/'],
  ['/projects/windo/',                   '/projects/window/'],
  ['/projects/prendaa/',                 '/projects/prenda/'],
  ['/projects/definition/',              '/projects/definitions/'],
  // the Figma-to-Claude case study was merged into /projects/nova/, so its URL
  // and typos of it now land there
  ['/projects/nova-to-claude/',          '/projects/nova/'],
  ['/projects/nova-to/',                 '/projects/nova/'],
  // A typo of the retired slug falls back to the landing page rather than to
  // /projects/nova/: fuzzy matching runs against the live route table, and
  // "nova-to-clade" is too far from "nova" to guess. The exact URL still
  // redirects via the alias, which is the case that matters for shared links.
  ['/projects/nova-to-clade/',           '/portfolio/'],
  ['/projects/bark/',                    '/projects/bark-app/'],
  // normalisation-only differences
  ['/PROJECTS/SMART-HUDDLES/',           '/projects/smart-huddles/'],
  ['/projects/smart_huddles',            '/projects/smart-huddles/'],
  ['/resume/index.html',                 '/resume/'],
  ['/about',                             '/about/'],
  // too vague to guess -> landing page
  ['/projects/n/',                       '/portfolio/'],
  ['/p/',                                '/portfolio/'],
  ['/totally-made-up-page/',             '/portfolio/'],
  ['/xyzzy/',                            '/portfolio/'],
  // must NOT redirect
  ['/assets/images/missing.png',         NONE],
  ['/style.css',                         NONE],
  ['/404.html',                          NONE],
  ['/projects/nova/',                    NONE],
];

let pass = 0, fail = 0;
for (const [input, expected] of cases) {
  const got = decide(input);
  const ok = got === expected;
  ok ? pass++ : fail++;
  if (!ok) {
    console.log(`  FAIL  ${input}\n        got      ${got === null ? '(no redirect)' : got}` +
                `\n        expected ${expected === null ? '(no redirect)' : expected}`);
  }
}
console.log(`  ${pass}/${cases.length} route cases passed`);
process.exit(fail ? 1 : 0);
