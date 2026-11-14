# Site modes

A **mode** is a second way to present the same site. The pages, URLs and words never
change; only how they look and how you move through them. Professional is the base.
iPod is the first fun mode. A Spotify, pink or dog mode plugs in the same way.

Think of it like light and dark, one level up. A theme swaps colors. A mode can swap
colors, restyle components, or rebuild the whole layout. Light and dark still work
inside every mode.

## Rules every mode follows

- **One source of content.** A mode reads what's already on the page. It never carries
  copy of its own beyond its own UI labels ("Back", "MENU").
  `scripts/check-modes.js` fails a mode that drops any of a page's words.
- **Professional is the default.** A first visit always opens in Professional. After
  that, the visitor's last mode is restored (`localStorage.mode`).
- **Accessible or it doesn't ship.** WCAG 2.2 AA in light and dark, full keyboard
  path, reduced motion respected. Same gate as the rest of the site.
- **Reversible in place.** Switching modes never reloads the page, and switching back
  leaves nothing behind.
- **Tokens all the way down.** No hex values. Every color is a Supernova token, or a
  mode token that points at one.
- **The NDA gate stays.** A mode re-skins the StaticCrypt prompt but never goes around it.

## How it works

```
modes/modes.json            the registry: which modes exist, their files
      │  python3 scripts/apply-meta.py
      ▼
every page's <head>         the registry as inline JSON + a tiny boot script
      │  while the page is still parsing
      ▼
boot script                 picks the mode: ?mode= link, then saved choice, then default.
                            Sets <html data-mode>, writes that mode's stylesheets
                            (and shell script) into the head. No flash; Professional
                            visitors download none of them.
      │  after parsing
      ▼
modes/modes.js              the nav's ghost button, in-place switching, persistence,
                            GoatCounter events, and the shell lifecycle
      │  SiteModes.register(id, { mount, unmount })
      ▼
modes/<id>/shell.js         (shell modes only) rebuilds the layout from the page's content
```

**Getting in:** the ghost icon in the nav, just before the moon, is a quiet easter egg.
It switches to the mode named by `"toggle"` in `modes.json` (today, iPod). Inside a
mode, its own header carries a ghost too, which switches back to Professional.

**Links:** `?mode=ipod` opens any page in iPod mode and saves the choice;
`?mode=professional` switches back. Handy for a post or an email.

## Token tiers

Three tiers. Each one only points down.

| Tier | Name | Example | Flips with light/dark? |
| --- | --- | --- | --- |
| 1 | Supernova primitives | `--sn-color-pink-40` | never |
| 2 | Supernova semantics | `--sn-surface-brand-pink-3` | yes |
| 3 | Mode tokens | `--ipod-player-surface` | only where the mode says so |

Tier 3 is where a mode says what its parts are *for*. Its atoms, molecules and
organisms read only tier 3. That keeps every design decision for the mode in one file
(`tokens.css`), the same way Supernova keeps the site's in its semantic layer.

A tier-3 token points at tier 2 when the part should follow the theme, and at tier 1
when it must not. The iPod display is a dark screen in both themes, so it's pinned to
primitives. Dark-theme exceptions live in one block at the bottom of `tokens.css`,
never spread through the component files.

A token marked **PROMOTE** has no Supernova equivalent yet, so the mode holds it. When
Supernova adds the token, point the mode at it and remove the note. Modes are where new
tokens get proven before they're promoted into Supernova.

## Mode depths

How far a mode goes. Pick the shallowest one that does the job.

| Depth | What it changes | Files | Example |
| --- | --- | --- | --- |
| token | colors, type, radius: re-points tier-2 semantics, so every Professional component restyles itself | `tokens.css` | pink mode |
| component | the above, plus restyled components and small decorations | `tokens.css` + atomic layers | dog mode (paw-print bullets, rounder cards) |
| shell | the above, plus a new layout built from the page's content | all of the above + `shell.js` | iPod, Spotify |

A token mode is the cheapest test of the semantic layer. If one file of overrides can't
re-color the whole site, a Professional component is reaching past the semantics. Fix
that component; don't patch around it.

## Files in a mode (atomic design)

```
modes/<id>/
  tokens.css      tier-3 tokens (+ tier-2 overrides for token modes)
  atoms.css       one element each: chip, button, label
  molecules.css   small groups that act as one: a list row, a crumb + Back
  organisms.css   sections: player, window, nav skin
  templates.css   page layouts + responsive rules + motion
  shell.js        shell modes only
```

The registry lists the stylesheets in that order, so each layer can build on the one
below it.

Every selector starts with `:root[data-mode="<id>"]`. That's what scopes a mode, and it
also out-ranks Professional's own rules without `!important`. Where a page rule uses
an `#id` (for example `#project-detail .page-card`), add `#main` to the mode's selector
rather than reaching for `!important`.

**Why not `@layer`?** `style.css` is unlayered, and unlayered rules always beat layered
ones. Mode rules inside `@layer` would lose to Professional. The file split gives the
atomic structure; the `:root[data-mode]` prefix gives the scope.

## Add a mode

1. **Pick the depth** (table above) and an `id`: lowercase, one word (`pink`, `dog`,
   `spotify`).
2. **Copy `modes/_starter/` to `modes/<id>/`.** Replace `starter` with the id
   everywhere, in selectors and in `register('starter', …)`. Delete the files the depth
   doesn't need.
3. **Register it in `modes/modes.json`.** Add an entry with `id`, `label` (read out
   as "Switch to <label> mode"), `description` (one short line), `depth`, `css` (in tier
   order) and, for a shell, `shell`. To make it the ghost button's mode, set
   `"toggle"` to its id. A mode that isn't the toggle is reached by its `?mode=` link,
   or by a way in that its own design adds.
4. **Run `python3 scripts/apply-meta.py`.** This puts the new registry into every page,
   including the 404 page, the NDA sources and the gate template. Commit as usual: the
   pre-commit hook re-encrypts the NDA pages with the new head.
5. **Build from tokens up.** Name every decision in `tokens.css` first, then atoms,
   molecules, organisms, templates. Check dark theme as you go.
6. **Serve and check:**
   ```bash
   python3 -m http.server 8000
   npm run check:modes -- <id>   # boots, parity, reversible, remembered, axe
   npm run check:tokens          # every --sn-* the mode uses exists
   npm run check                 # Professional still works
   ```
   Then try it by hand: keyboard only, VoiceOver, a phone in both orientations,
   reduced motion.
7. **Design pass, then polish**, before it merges. See the release plan.

To retire a mode, remove its entry from `modes.json` and run `apply-meta.py`. A visitor
whose saved mode no longer exists lands in Professional.

## Shell lifecycle

```js
window.SiteModes.register('<id>', {
  mount()   { /* read the page, add your DOM, remember what you added */ },
  unmount() { /* remove everything mount() added */ }
});
```

`mount()` runs when the mode becomes active on a page; `unmount()` when it stops. Both
can run many times on one page. Read content from the DOM (the iPod shell reads the
project cards: title, link, tags, description, status, `data-protected`). Never copy
it into the script.

Also available: `SiteModes.set(id)`, `SiteModes.current()`, `SiteModes.modes()`, and a
`sitemode:change` event on `document` with `{ from, to }`.

## iPod mode notes

- **The frame.** In iPod mode the site nav steps aside. The browser header carries the
  address, the ghost (back to Professional) and the moon (theme; it drives the site's
  own toggle, so the choice is shared). Figma 16:20594.
- **The player** is built from `#projects .project-card`. Add a card to the portfolio
  and it appears as a track. `data-protected` on a card shows the lock;
  `.card-status-badge` is read out by screen readers. The hero isn't part of this mode.
- **Opening a track** goes to the real case-study URL. That page opens as a window over
  the player (Figma 9:1248): the player behind is rebuilt from the portfolio's cards
  (fetched from `/portfolio/`) and made inert; the page's own content is moved into the
  window and moved back on exit. The window scrolls on its own with a drawn scrollbar.
  Close, or Esc, returns to `/portfolio/#<slug>` with that track focused.
- **Phones and tablets in portrait**, and short landscape screens, get the window full
  screen (Figma 10:1388).
- **The NDA gate** opens in the window like any page; unlocking re-renders it there.
- **Motion:** cross-document View Transitions keep the player still between pages
  (Chrome, Safari 18.2+); the window grows in. Reduced motion turns both off.
- **Haptics:** Android vibrates. iPhone ticks only on taps, not while dragging the ring
  (an iOS limit).

## Tokens to promote to Supernova

Collected from the `PROMOTE` notes in `modes/ipod/tokens.css`:

- `border/color/brand/green/action` (#26993E): the browser frame's border
- a darker green text (#134C1F) for the header: Figma's `text/brand/green/dark` is
  3.48:1 on `surface/brand/green/logo`, under AA for 18px text
- `border/color/brand/green/3` (#83D994): the notes' border
- a 50% scrim and a 40% light overlay
- radii above `more-rounded`: 32 (window, display) and 64 (player)
- an always-dark surface set: display surface, title, label, crumb (tier 1 pins today)
- a light overlay at 15% (row selection, hover)
- a darker green surface for dark theme (bars and notes)
