# judylhwu-work.github.io

Judy Wu's personal portfolio — live at [judylhwu-work.github.io](https://judylhwu-work.github.io).

Plain HTML/CSS/JS, no build step, no framework. Deployed via GitHub Pages (legacy Jekyll build) directly from `main`.

## Structure

```
index.html            redirect stub -> /portfolio/
portfolio/             Portfolio (hero + projects grid) — the site's landing page
resume/                Resume
about/                 About
projects/<slug>/       One folder per case study (e.g. projects/leantaas/)
style.css              Shared site styles
project.css            Project detail page styles
theme.js               Dark mode toggle
lightbox.js            Image lightbox on project pages
debug.js               Dev-only debug/inspector overlay
supernova/              Vendored copy of the Supernova design system (see below)
assets/images/          Static image assets
```

Every page lives at `<name>/index.html` rather than `<name>.html`, so GitHub Pages serves it without the `.html` extension (`/portfolio/`, `/resume/`, `/about/`, `/projects/leantaas/`, etc.). All internal links and asset references use root-relative paths (e.g. `/style.css`), not relative ones — this matters if you add a new page, since a relative path will break depending on how deep the new page is nested.

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

- The LeanTaaS case studies are behind an NDA gate (`projects/leantaas-gate/`) — a client-side password check backed by `sessionStorage`, not real access control.
- Dark mode is a `data-theme="dark"` attribute on `<html>`, toggled by `theme.js` and persisted in `localStorage`.
