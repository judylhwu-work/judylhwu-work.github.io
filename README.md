# judylhwu-work.github.io

Judy Wu's personal portfolio — live at [judylhwu-work.github.io](https://judylhwu-work.github.io).

Plain HTML/CSS/JS, no build step, no framework. Deployed via GitHub Pages (legacy Jekyll build) directly from `main`.

## Structure

```
index.html            redirect stub -> /portfolio/
portfolio/             Portfolio (hero + projects grid) — the site's landing page
resume/                Resume
about/                 About
projects/<slug>/       One folder per case study (e.g. projects/nova/)
style.css              Shared site styles
project.css            Project detail page styles
theme.js               Dark mode toggle
lightbox.js            Image lightbox on project pages
debug.js               Dev-only debug/inspector overlay
supernova/              Vendored copy of the Supernova design system (see below)
assets/images/          Static image assets
```

Every page lives at `<name>/index.html` rather than `<name>.html`, so GitHub Pages serves it without the `.html` extension (`/portfolio/`, `/resume/`, `/about/`, `/projects/nova/`, etc.). All internal links and asset references use root-relative paths (e.g. `/style.css`), not relative ones — this matters if you add a new page, since a relative path will break depending on how deep the new page is nested.

## Design tokens

Colors, spacing, and typography come from [Supernova](https://github.com/judylhwu-work/supernova-design-system), a separate design system repo, as CSS custom properties (`--sn-*`).

**Important:** the compiled Supernova CSS is *vendored* into `supernova/` in this repo, not linked to the sibling `supernova-design-system` folder — GitHub Pages can't reach a sibling repo that only exists locally. Whenever tokens or components change upstream, re-copy the built files:

```bash
cp ../supernova-design-system/dist/tokens.{primitives,light,dark}.css supernova/dist/
cp ../supernova-design-system/components/button/button.css supernova/components/button/
cp ../supernova-design-system/components/badge/badge.css supernova/components/badge/
```

There's no automated sync between the two repos.

## Local development

No build step — just serve the directory and open it:

```bash
python3 -m http.server 8000
```

Then visit `http://localhost:8000/portfolio/`. Serve this repo **in isolation** (not from a parent directory that happens to contain `supernova-design-system` as a sibling) to catch path issues the same way GitHub Pages would.

## Notes

- The LeanTaaS case studies are NDA-protected with real client-side **encryption** (StaticCrypt) — see [NDA-protected case studies](#nda-protected-case-studies) below.
- Dark mode is a `data-theme="dark"` attribute on `<html>`, toggled by `theme.js` and persisted in `localStorage`.

## NDA-protected case studies

The four LeanTaaS case studies (`nova`, `smart-huddles`, `definitions`, `nova-to-claude`) are **encrypted** with [StaticCrypt](https://github.com/robinmoisson/staticrypt), not just visually gated. Only ciphertext is ever served or committed — the readable content never reaches GitHub.

**How it fits together**

- **Source** (the real, editable pages) lives in `private/projects/<slug>/index.html` — git-ignored, on your machine only. *Back this folder up* — it is the only copy of the readable content.
- **Password** lives in `private/.password` — also git-ignored. Change it there.
- **Salt** is in `.staticrypt.json` (committed, not secret) — shared across pages so one "Keep me unlocked" tick opens all four.
- **Prompt styling** is `scripts/staticrypt-template.html` (matches the site's gate design).
- **Encrypted output** is `projects/<slug>/index.html` (committed, published) — gibberish plus the password prompt.

**Editing a case study:** edit the file in `private/projects/<slug>/`, then commit as usual. A git pre-commit hook (`.githooks/pre-commit`) automatically re-encrypts changed pages and stages them — you never run a command by hand. Manual fallback: `npm run encrypt`.

**First-time setup on a new machine** (since `private/` isn't cloned): run `npm install`, recreate the `private/projects/<slug>/index.html` sources and `private/.password`, then `git config core.hooksPath .githooks`.

**Caveats:** security is bounded by password strength (encrypted files can be brute-forced offline), and once decrypted the content can be re-shared. This stops casual decoding, scraping, and source-on-GitHub exposure — it is not airtight access control.
