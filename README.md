# judylhwu-work.github.io

Judy Wu's personal portfolio — live at [judylhwu-work.github.io](https://judylhwu-work.github.io).

Plain HTML/CSS/JS, no build step, no framework. Deployed via GitHub Pages (legacy Jekyll build) directly from `main`.

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
debug.js               Dev-only inspector overlay — never reference this from a page
assets/images/         Static image assets
assets/og/             Generated 1200x630 social share cards, one per page
scripts/page-meta.json Per-page SEO/social copy (single source of truth)
scripts/apply-meta.py  Injects that meta into each page
scripts/encrypt.sh     StaticCrypt build for the NDA case studies
scripts/verify-gates.js Checks the encrypted pages still decrypt
```

Every page lives at `<name>/index.html` rather than `<name>.html`, so GitHub Pages serves it without the `.html` extension (`/portfolio/`, `/resume/`, `/about/`, `/projects/nova/`, etc.). All internal links and asset references use root-relative paths (e.g. `/style.css`), not relative ones — this matters if you add a new page, since a relative path will break depending on how deep the new page is nested.

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
