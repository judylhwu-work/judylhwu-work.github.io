# judylhwu-work.github.io

Judy Wu's personal portfolio — live at [judylhwu-work.github.io](https://judylhwu-work.github.io).

This portfolio is hand-directed and Claude Code-assisted — every architectural decision is intentional. I built it in plain HTML/CSS/JS deliberately: no framework overhead, no build step, just fast, portable, and something I can fully reason about.

Deployed via GitHub Pages (legacy Jekyll build) directly from `main`.

## Structure

```
index.html             redirect stub -> /portfolio/ (fires an analytics pixel first)
404.html               served by GitHub Pages for any unmatched path
portfolio/             Portfolio (hero + projects grid) — the site's landing page
resume/                Resume
about/                 About
projects/<slug>/       One folder per case study (e.g. projects/nova/)
style.css              Shared site styles
project.css            Project detail page styles
theme.js               Dark mode toggle
lightbox.js            Image lightbox on project pages
assets/images/         Static image assets
assets/images/projects/<slug>/  Case-study images — two WebP sizes each (see below)
assets/og/             Generated 1200x630 social share cards, one per page
scripts/page-meta.json Per-page SEO/social copy (single source of truth)
scripts/apply-meta.py  Injects that meta, plus the shared nav and head, into each page
scripts/partials/      The shared nav and head markup, injected into every page
scripts/check-tokens.js Fails if a --sn-* token the site uses no longer exists
scripts/encrypt.sh     StaticCrypt build for the NDA case studies
scripts/verify-gates.js Checks the encrypted pages still decrypt
scripts/check-pages.js Loads every page in a real browser and checks it works
.github/workflows/checks.yml  Runs those checks on every push and PR
```

Every page lives at `<name>/index.html` rather than `<name>.html`, so GitHub Pages serves it without the `.html` extension (`/portfolio/`, `/resume/`, `/about/`, `/projects/nova/`, etc.). All internal links and asset references use root-relative paths (e.g. `/style.css`), not relative ones — this matters if you add a new page, since a relative path will break depending on how deep the new page is nested.

## Case-study images

Case-study images are **self-hosted WebP** in `assets/images/projects/<slug>/`, numbered in
the order they appear on the page. Each image exists twice:

```
07-side-navigation-bar-redesign.webp        the page loads this (600, 800 or 1200px wide,
                                            matching the slot it renders into)
07-side-navigation-bar-redesign-full.webp   1920px — the lightbox swaps this in
```

The `<img>` carries the display file in `src` and the large one in `data-full`; `lightbox.js`
reads that attribute. An image without `data-full` just reopens its own `src`, so a new image
works before you generate a full size for it.

These were previously hotlinked from `images.spr.so`, the image CDN behind the old Super.so
site, and the lightbox faked a large version by rewriting that CDN's `w=`/`quality=` URL
parameters. That made five case studies depend on an account this site no longer uses — if it
lapsed, the images went with it. They are now in the repo.

Encoded at **quality 82**, which was pixel-indistinguishable from the source PNGs on the
densest screenshot tested, at roughly 40% of the bytes. The 15 images carrying partial
transparency are **composited onto white** during conversion, matching the
`--sn-color-gray-0` backing that `.project-image` already paints — these are screenshots of
light product UI, so they must stay white in dark mode.

To add one: drop the display and `-full` files into the project's folder using the next
number, and point `src`/`data-full` at them.

## Shared nav and head

The nav and the `<head>` stylesheet/script tail are **generated into every page**, the same
way the SEO block is. Edit `scripts/partials/nav.html` or `scripts/partials/head.html` and run
`python3 scripts/apply-meta.py`; never edit the markup inside a page, because the next run
overwrites it.

```html
  <!-- NAV — generated from scripts/partials/nav.html; edit there, not here -->
  …
  <!-- /NAV -->
```

Both blocks are delimited by marker pairs, and `apply-meta.py` finds them by **scanning for the
markers** rather than by consulting `page-meta.json`. That matters: the nav also lives in
`404.html`, in the readable sources under `private/projects/`, and in
`scripts/staticrypt-template.html`, none of which the meta list covers. Before this, those were
hand-copied — 18 copies of the same markup, where a missed copy drifted silently.

Two things vary per page and are filled in, so the partials stay plain markup:

- **`nav-active`** goes on the link matching the page's section. Every case study — published,
  private source, or gate template — counts as Portfolio; `404.html` gets none.
- **`{{PROJECT_CSS}}`** in the head partial becomes `/project.css` on project pages and is
  dropped elsewhere. It sits between `style.css` and the Supernova tokens deliberately: that is
  where it was before, and moving it would change the cascade.

Anything one page needs on top of the shared head — the 404 route table, StaticCrypt's
no-cache meta — goes *after* the closing marker.

Note that `encrypt.sh` treats the partials as staleness inputs, so editing one re-encrypts the
protected pages on the next commit and their gates pick the change up too.

## Design tokens

Colors, spacing, and typography come from [Supernova](https://github.com/judylhwu-work/supernova-design-system), a separate design system repo, as CSS custom properties (`--sn-*`).

**Link, don't copy.** Every page loads Supernova straight from its own GitHub Pages deploy using root-relative paths:

```html
<link rel="stylesheet" href="/supernova-design-system/dist/tokens.primitives.css">
```

Both sites are served from the same `judylhwu-work.github.io` domain, so these resolve with no CORS and no build step, and Supernova changes go live here automatically a minute or two after they're pushed.

There is deliberately **no vendored copy** in this repo. An earlier `supernova/` folder was deleted because it silently went stale — do not reintroduce one, and do not link a `../supernova-design-system/` sibling path.

Locally, `supernova-design-system` is a git-ignored **symlink** to the sibling repo on disk, which is what makes those absolute paths resolve when you serve this folder.

## Local development

No build step — just serve the directory and open it:

```bash
python3 -m http.server 8000
```

Then visit `http://localhost:8000/portfolio/`. Serve **this** directory (not a parent), so `/style.css` and `/supernova-design-system/...` resolve the same way GitHub Pages resolves them. The `supernova-design-system` symlink in this folder is what supplies the tokens locally.

With that server running, `npm run check` loads every page in headless Chrome and fails if an
image is broken, the console logs an error, a request fails, or a case-study lightbox stops
opening its full-size file. It drives the Chrome already installed on the machine, so there is
no browser download, and it takes its page list from `scripts/page-meta.json` — add a page
there and it gets checked automatically.

Every push and PR runs the same checks in GitHub Actions (`.github/workflows/checks.yml`):
the 404 router test, a meta drift check, and the browser check above. CI clones Supernova
into place first, so root-relative token paths resolve there exactly as they do locally and
in production.

The drift check re-runs `apply-meta.py` and fails if it rewrites anything — that means a
page's meta was hand-edited instead of `page-meta.json`, and the next run would overwrite the
edit. `sitemap.xml` is excluded from it, because its `<lastmod>` comes from file mtimes and a
fresh checkout resets those.

`verify-gates.js` is deliberately **not** in CI: it needs the plaintext sources in `private/`
and the password, neither of which exists on a runner. Keep running it locally after touching
the template, `encrypt.sh`, or the meta pipeline.

Optionally, set a `CLIENT_NAME` repository secret and CI will also fail if that name appears
in any committed file. The name never enters the repo — it lives only in the secret, and the
job prints matching paths, never the match itself, since the logs are public too.

## Notes

- Four case studies are NDA-protected with real client-side **encryption** (StaticCrypt) — see [NDA-protected case studies](#nda-protected-case-studies) below.
- Dark mode is a `data-theme="dark"` attribute on `<html>`, toggled by `theme.js` and persisted in `localStorage`.

## SEO & social meta

Page titles, descriptions, canonical URLs and Open Graph / Twitter tags are **generated**, not hand-written. `scripts/page-meta.json` is the single source of truth; `scripts/apply-meta.py` injects the block into each page between `<!-- SEO -->` markers.

```bash
python3 scripts/apply-meta.py                 # refresh every page
python3 scripts/apply-meta.py about/index.html  # or just one
```

It is idempotent — re-running replaces the block rather than stacking duplicates. **Edit `page-meta.json`, not the meta tags in the HTML**, or your change is overwritten the next time it runs.

This matters most for the four encrypted case studies: their shell is regenerated from one shared template that cannot carry per-page meta, so `encrypt.sh` re-runs `apply-meta.py` on each page after StaticCrypt rewrites it. Adding a new page means adding an entry to `page-meta.json` and a card in `assets/og/`.

Share cards in `assets/og/` are 1200x630 PNGs rendered from an HTML template via headless Chrome.

## 404 recovery

GitHub Pages has no server-side rewrites, so a renamed or mistyped URL can only be
recovered on the client. `404.html` carries a small router that, in order:

1. matches an **exact alias** — a URL we know was renamed (e.g. `/work.html` → `/portfolio/`)
2. matches an **exact route** differing only in case, trailing slash or `.html`
3. **fuzzy-matches** the slug (Levenshtein, plus a prefix bonus so a truncated
   `/projects/nova-to/` resolves to `nova-to-claude` rather than `nova`)
4. falls back to `/portfolio/`

Requests for missing *assets* (`.png`, `.css`, …) are left alone — bouncing those
to a page would turn a broken image into a confusing navigation.

Aliases and the fallback live in `scripts/page-meta.json` under `_redirects`; the
route table is generated into `404.html` by `apply-meta.py`. **When you rename a
page, add the old URL to `aliases`** — fuzzy matching is a safety net, not a
substitute for knowing the answer.

```bash
node scripts/test-404-routes.js   # runs the real router from 404.html
```

## NDA-protected case studies

The four NDA case studies (`nova`, `smart-huddles`, `definitions`, `nova-to-claude`) are **encrypted** with [StaticCrypt](https://github.com/robinmoisson/staticrypt), not just visually gated. Only ciphertext is ever served or committed — the readable content never reaches GitHub.

**How it fits together**

- **Source** (the real, editable pages) lives in `private/projects/<slug>/index.html` — git-ignored from *this* repo, but `private/` is its own separate **private** git repo (`portfolio-private-source`) that backs up the readable content. It's auto-pushed there after every commit (see below).
- **Password** lives in `private/.password` — also git-ignored. Change it there.
- **Salt** is in `.staticrypt.json` (committed, not secret) — shared across pages so one "Keep me unlocked" tick opens all four.
- **Prompt styling** is `scripts/staticrypt-template.html` (matches the site's gate design).
- **Encrypted output** is `projects/<slug>/index.html` (committed, published) — gibberish plus the password prompt.

**Editing a case study:** edit the file in `private/projects/<slug>/`, then commit as usual. Two hooks run automatically — you never run a command by hand:
- `.githooks/pre-commit` re-encrypts changed pages into `projects/<slug>/` and stages them (manual fallback: `npm run encrypt`).
- `.githooks/post-commit` commits + pushes the readable `private/` source to the private repo (`portfolio-private-source`). Best-effort — if you're offline it just backs up on the next commit.

So one `git commit` both **publishes** (encrypted, public repo) and **backs up** (readable, private repo).

**Verifying the gate:** `node scripts/verify-gates.js` confirms all four pages still decrypt to their plaintext source and that a wrong password is rejected. Run it after touching the template, `encrypt.sh`, or the meta pipeline.

**First-time setup on a new machine:** `npm install`; clone the private source into place with `git clone git@github.com:judylhwu-work/portfolio-private-source.git private`; then `git config core.hooksPath .githooks`.

**Do not name the client.** This repo is public, and so is the StaticCrypt unlock
page — its heading, `<title>`, and meta are readable without the password. Keep the
client's name out of case-study copy, page meta, share cards, asset filenames, code
comments, and redirect aliases. The résumé is the one intentional exception. When
adding a protected case study, describe the employer generically ("a health-tech
product org"), and remember `assets/og/*.png` bakes text into an image.

**Caveats:** security is bounded by password strength (encrypted files can be brute-forced offline), and once decrypted the content can be re-shared. This stops casual decoding, scraping, and source-on-GitHub exposure — it is not airtight access control.
