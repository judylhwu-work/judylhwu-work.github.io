#!/usr/bin/env python3
"""
Inject (or refresh) the SEO/social meta block in each page, from scripts/page-meta.json.

Idempotent: the block is delimited by MARK_START/MARK_END, so re-running replaces
it rather than stacking duplicates. encrypt.sh calls this for the protected pages
after StaticCrypt regenerates them from the shared template.

Usage:
  scripts/apply-meta.py              # all pages listed in page-meta.json
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

    # Only on a full run — encrypt.sh calls this per-file and shouldn't rewrite
    # the sitemap four times mid-build.
    if not sys.argv[1:]:
        write_site_files()
        write_404_routes()
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
