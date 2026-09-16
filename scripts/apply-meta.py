#!/usr/bin/env python3
"""
Inject (or refresh) the generated blocks in each page.

Three things are generated here, each delimited by its own marker pair so that
re-running replaces the block rather than stacking duplicates:

  SEO   the social/meta block, from scripts/page-meta.json
  NAV   the site nav, from scripts/partials/nav.html
  HEAD  the shared stylesheet/script tail, from scripts/partials/head.html

encrypt.sh calls this for the protected pages after StaticCrypt regenerates them
from the shared template.

The nav and head blocks reach more files than the meta does: page-meta.json lists
published pages, but 404.html, the readable sources in private/projects/, and
scripts/staticrypt-template.html carry the same shell. Those are found by scanning
for the markers, so a new page is covered the moment it has them.

Usage:
  scripts/apply-meta.py              # all pages listed in page-meta.json, plus
                                     # every other file carrying shell markers
  scripts/apply-meta.py a/index.html # only these paths (repo-relative)
"""
import datetime
import json
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
META = json.loads((ROOT / "scripts" / "page-meta.json").read_text())
ORIGIN = META["_origin"]

MARK_START = "  <!-- SEO / social — generated from scripts/page-meta.json; edit there, not here -->"
MARK_END = "  <!-- /SEO -->"

BLOCK_RE = re.compile(
    re.escape(MARK_START) + r".*?" + re.escape(MARK_END) + r"\n",
    re.DOTALL,
)
# A canonical link already exists on the root redirect stub; drop it so we emit one.
CANON_RE = re.compile(r'^[ \t]*<link rel="canonical"[^>]*>\n', re.MULTILINE)
TITLE_RE = re.compile(r"^[ \t]*<title>.*?</title>[ \t]*\n", re.MULTILINE | re.DOTALL)


def esc(s):
    return s.replace("&", "&amp;").replace('"', "&quot;").replace("<", "&lt;").replace(">", "&gt;")


# --- shared shell: nav + head ------------------------------------------------
#
# These blocks used to be hand-copied into all 18 pages, so a nav change meant 18
# edits and any missed copy drifted silently.

PARTIALS = ROOT / "scripts" / "partials"

NAV_START = "  <!-- NAV — generated from scripts/partials/nav.html; edit there, not here -->"
NAV_END = "  <!-- /NAV -->"
HEAD_START = "  <!-- HEAD — generated from scripts/partials/head.html; edit there, not here -->"
HEAD_END = "  <!-- /HEAD -->"


def _block_re(start, end):
    return re.compile(re.escape(start) + r".*?" + re.escape(end) + r"\n", re.DOTALL)


NAV_RE = _block_re(NAV_START, NAV_END)
HEAD_RE = _block_re(HEAD_START, HEAD_END)

# The partials open with a comment explaining how to edit them. That is guidance
# for whoever opens the file, not markup for 18 pages to carry.
LEADING_COMMENT_RE = re.compile(r"\A\s*<!--.*?-->\n", re.DOTALL)

PROJECT_CSS_LINE = '  <link rel="stylesheet" href="/project.css">'


def partial(name):
    text = (PARTIALS / name).read_text()
    return LEADING_COMMENT_RE.sub("", text).rstrip("\n")


def active_link(rel):
    """Which nav link is marked current, decided by where the page lives.

    Every case study — published, private source, or the gate template — sits
    under Portfolio. 404 belongs to no section, so nothing is marked.
    """
    if rel.startswith("about/"):
        return "/about/"
    if rel.startswith("resume/"):
        return "/resume/"
    if rel == "404.html":
        return None
    return "/portfolio/"


def wants_project_css(rel):
    return (
        rel.startswith("projects/")
        or rel.startswith("private/projects/")
        or rel == "scripts/staticrypt-template.html"
    )


def nav_block(rel):
    nav = partial("nav.html")
    active = active_link(rel)
    if active:
        # Only the list links look like this; the logo carries a class already,
        # so it is never the one marked.
        nav = nav.replace(
            f'<a href="{active}"><span>',
            f'<a href="{active}" class="nav-active"><span>',
            1,
        )
    return f"{NAV_START}\n{nav}\n{NAV_END}\n"


def head_block(rel):
    head = partial("head.html")
    if wants_project_css(rel):
        head = head.replace("{{PROJECT_CSS}}", PROJECT_CSS_LINE)
    else:
        head = re.sub(r"[ \t]*\{\{PROJECT_CSS\}\}\n", "", head)
    return f"{HEAD_START}\n{head}\n{HEAD_END}\n"


def apply_shell(rel):
    """Refresh the NAV and HEAD blocks in one page. A page without the markers is
    left alone — index.html is a redirect stub with no nav and no stylesheets."""
    path = ROOT / rel
    if not path.exists():
        return
    original = html = path.read_text()
    if NAV_RE.search(html):
        html = NAV_RE.sub(lambda _: nav_block(rel), html, count=1)
    if HEAD_RE.search(html):
        html = HEAD_RE.sub(lambda _: head_block(rel), html, count=1)
    if html != original:
        path.write_text(html)
        print(f"  shell applied: {rel}")


def shell_targets():
    """Every file carrying shell markers, including those page-meta.json omits."""
    out = []
    for path in sorted(ROOT.rglob("*.html")):
        rel = path.relative_to(ROOT).as_posix()
        if rel.startswith(("node_modules/", "supernova-design-system/")):
            continue
        text = path.read_text()
        if NAV_START in text or HEAD_START in text:
            out.append(rel)
    return out


def build(info):
    url = ORIGIN + info["url"]
    # A redirect stub points its canonical/og:url at the page it forwards to, so
    # ranking and shares consolidate on the real page rather than the stub.
    canon = ORIGIN + info.get("canonical", info["url"])
    img = f"{ORIGIN}/assets/og/{info['image']}.png"
    t, d, a = esc(info["title"]), esc(info["desc"]), esc(info["alt"])
    return "\n".join([
        MARK_START,
        f'  <meta name="description" content="{d}">',
        f'  <link rel="canonical" href="{canon}">',
        f'  <meta name="author" content="Judy Wu">',
        "",
        f'  <meta property="og:type" content="website">',
        f'  <meta property="og:site_name" content="Judy Wu">',
        f'  <meta property="og:title" content="{t}">',
        f'  <meta property="og:description" content="{d}">',
        f'  <meta property="og:url" content="{canon}">',
        f'  <meta property="og:image" content="{img}">',
        f'  <meta property="og:image:width" content="1200">',
        f'  <meta property="og:image:height" content="630">',
        f'  <meta property="og:image:alt" content="{a}">',
        "",
        f'  <meta name="twitter:card" content="summary_large_image">',
        f'  <meta name="twitter:title" content="{t}">',
        f'  <meta name="twitter:description" content="{d}">',
        f'  <meta name="twitter:image" content="{img}">',
        f'  <meta name="twitter:image:alt" content="{a}">',
        MARK_END,
        "",
    ])


def apply(rel, info):
    path = ROOT / rel
    if not path.exists():
        print(f"  skip (missing): {rel}")
        return False
    original = html = path.read_text()
    block = build(info)

    # <title> is owned here too — otherwise it drifts from og:title, and the
    # protected pages would need their titles defined a second time in encrypt.sh.
    html = TITLE_RE.sub(
        lambda m: re.sub(r"<title>.*?</title>", "<title>%s</title>" % esc(info["title"]),
                         m.group(0), flags=re.DOTALL),
        html, count=1)

    # The StaticCrypt gate is public — no password needed to read it — so its
    # heading must not name the client. The template ships a neutral placeholder
    # and each page gets its own project name here.
    html = re.sub(
        r"<h1 data-gate-title>.*?</h1>",
        '<h1 data-gate-title>%s</h1>' % esc(info["title"].replace(" — Judy Wu", "").strip()),
        html, count=1, flags=re.DOTALL,
    )

    if BLOCK_RE.search(html):
        new = BLOCK_RE.sub(lambda _: block, html, count=1)
    else:
        html = CANON_RE.sub("", html)
        m = TITLE_RE.search(html)
        if not m:
            print(f"  FAIL (no <title>): {rel}")
            return False
        new = html[: m.end()] + block + html[m.end():]

    if new != original:
        path.write_text(new)
        print(f"  meta applied: {rel}")
    else:
        print(f"  unchanged: {rel}")
    return True


ROUTES_START = "  <!-- ROUTES — generated from scripts/page-meta.json; edit there, not here -->"
ROUTES_END = "  <!-- /ROUTES -->"


def write_404_routes():
    """Inject the route + alias table the 404 page matches against.

    GitHub Pages has no server-side rewrites, so a mistyped or renamed URL can
    only be recovered client-side, on the 404 page itself. Generating the table
    from page-meta.json means a new page is routable the moment it is added.
    """
    path = ROOT / "404.html"
    if not path.exists():
        return
    routes = []
    for rel, info in META["pages"].items():
        url = info["url"]
        if url == "/":                     # the redirect stub is not a destination
            continue
        label = info["title"].replace(" — Judy Wu", "").strip()
        routes.append({"url": url, "label": label})

    red = META.get("_redirects", {})
    payload = json.dumps(
        {"routes": routes,
         "aliases": red.get("aliases", {}),
         "fallback": red.get("fallback", "/portfolio/")},
        indent=2, ensure_ascii=False,
    )
    block = (ROUTES_START + "\n  <script id=\"routes\" type=\"application/json\">\n"
             + payload + "\n  </script>\n" + ROUTES_END + "\n")

    html = path.read_text()
    pat = re.compile(re.escape(ROUTES_START) + r".*?" + re.escape(ROUTES_END) + r"\n", re.DOTALL)
    if pat.search(html):
        new = pat.sub(lambda _: block, html, count=1)
    else:
        marker = "</head>"
        new = html.replace(marker, block + marker, 1)
    if new != html:
        path.write_text(new)
        print(f"  wrote 404 route table ({len(routes)} routes, {len(red.get('aliases', {}))} aliases)")


def write_site_files():
    """robots.txt + sitemap.xml, derived from the same page list as the meta.

    Uses each page's canonical URL and de-duplicates, so the redirect stub at /
    does not appear alongside the /portfolio/ it points at. 404.html is excluded
    deliberately: it is noindex.
    """
    seen, urls = set(), []
    for rel, info in META["pages"].items():
        url = ORIGIN + info.get("canonical", info["url"])
        if url in seen:
            continue
        seen.add(url)
        path = ROOT / rel
        stamp = ""
        if path.exists():
            stamp = datetime.date.fromtimestamp(path.stat().st_mtime).isoformat()
        urls.append((url, stamp))

    body = "\n".join(
        "  <url>\n    <loc>%s</loc>%s\n  </url>" % (u, f"\n    <lastmod>{d}</lastmod>" if d else "")
        for u, d in urls
    )
    (ROOT / "sitemap.xml").write_text(
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
        f"{body}\n</urlset>\n"
    )
    (ROOT / "robots.txt").write_text(
        "User-agent: *\n"
        "Allow: /\n"
        "\n"
        "# The NDA case studies are encrypted; only the unlock page is\n"
        "# crawlable, which is intended — it carries the title and share card.\n"
        "\n"
        f"Sitemap: {ORIGIN}/sitemap.xml\n"
    )
    print(f"  wrote sitemap.xml ({len(urls)} urls) + robots.txt")


def main():
    targets = sys.argv[1:] or list(META["pages"])
    ok = True
    for rel in targets:
        info = META["pages"].get(rel)
        if info is None:
            print(f"  FAIL (not in page-meta.json): {rel}")
            ok = False
            continue
        ok = apply(rel, info) and ok
        apply_shell(rel)

    # Only on a full run — encrypt.sh calls this per-file and shouldn't rewrite
    # the sitemap four times mid-build.
    if not sys.argv[1:]:
        # The shell reaches files the meta list does not cover: 404.html, the
        # readable NDA sources, and the StaticCrypt template.
        for rel in shell_targets():
            if rel not in META["pages"]:
                apply_shell(rel)
        write_site_files()
        write_404_routes()
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
