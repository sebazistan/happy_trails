#!/usr/bin/env python3
"""Give every page a description, a favicon and a link preview."""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import paths

import io, os, sys, re
from trails_data import ALL_TRAILS

SITE = paths.SITE

# WHERE THE SITE WILL LIVE. Open Graph wants absolute URLs — a relative one is
# ignored by most scrapers, which is why a preview can look right locally and
# come out blank in Slack. Change this one line if the address changes and
# re-run this script.
BASE = "https://www.huzzahdesign.com/happy-trails/"

PAGES = {
  "index.html": dict(
     title="Happy Trails — every multi-use trail in the GTA",
     desc="A hand-drawn map of every multi-use trail in the Greater Toronto Area, "
          "the routes that connect them, and the gaps that still need closing.",
     img="site.png"),
  "wishful.html": dict(
     title="Wishful thinking — Happy Trails",
     desc="Twelve places where the trail network stops, doubles back, or sends "
          "you onto a road — sorted by what each one would cost to fix and how "
          "badly it is wanted.",
     img="wishful.png"),
  "trails.html": dict(
     title="Trails — Happy Trails",
     desc="Every multi-use trail on the Happy Trails map of the Greater Toronto "
          "Area, grouped by kind.",
     img="site.png"),
  "about.html": dict(
     title="About — Happy Trails",
     desc="Why this map exists, how it is drawn, and what it is for.",
     img="site.png"),
  "contact.html": dict(
     title="Contact — Happy Trails",
     desc="Get in touch about the Happy Trails map — corrections, additions, or "
          "a trail that deserves a page.",
     img="site.png"),
}
for t in ALL_TRAILS:
    PAGES[t["slug"] + ".html"] = dict(
        title="%s — Happy Trails" % t["name"],
        desc=t["lead"], img=t["slug"] + ".png")


def head_for(page, meta):
    url = BASE + page
    img = BASE + "social/" + meta["img"]
    return """<!-- how this page looks when someone shares the link, and in a browser tab.
     The image is 1200x630, which is the shape every one of them crops to.
     The addresses have to be absolute: a relative og:image is ignored by most
     scrapers, so a preview that looks right locally comes out blank in Slack.
     They are all built from BASE in make_meta.py — change it there. -->
<link rel="icon" href="favicon.svg" type="image/svg+xml">
<link rel="alternate icon" href="favicon-32.png" sizes="32x32">
<link rel="apple-touch-icon" href="favicon-180.png">
<meta name="theme-color" content="#1d2124">
<link rel="canonical" href="%s">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Happy Trails">
<meta property="og:title" content="%s">
<meta property="og:description" content="%s">
<meta property="og:url" content="%s">
<meta property="og:image" content="%s">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="%s">
<meta name="twitter:description" content="%s">
<meta name="twitter:image" content="%s">""" % (
      url, meta["title"], meta["desc"], url, img,
      meta["title"], meta["desc"], img)


ANALYTICS = ('<!-- Counting visits. Inert until analytics.js names a provider —\n'
             '     one file, one line, every page. -->\n'
             '<script src="analytics.js" defer></script>')


def sitemap_and_robots():
    """Two small files that tell a search engine what is here.

    Written from the same PAGES list the descriptions come from, so a page
    cannot be added to the site and left out of the sitemap — which is the
    usual way a sitemap goes stale."""
    from datetime import date
    today = date.today().isoformat()
    # the map first, then the two lists, then the trails, then the reading
    # pages: the order is not meaningful to a crawler, but it is meaningful to
    # anyone who opens the file
    order = ["index.html", "trails.html", "wishful.html", "beltline.html"]
    pages = order + sorted(p for p in PAGES if p not in order)

    rows = []
    for p in pages:
        # the front page matters most, the finished trail next, the rest evenly
        weight = "1.0" if p == "index.html" else "0.8" if p in order else "0.6"
        rows.append("  <url>\n    <loc>%s</loc>\n    <lastmod>%s</lastmod>\n"
                    "    <priority>%s</priority>\n  </url>"
                    % (BASE + p, today, weight))
    io.open(os.path.join(SITE, "sitemap.xml"), "w", encoding="utf-8").write(
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
        + "\n".join(rows) + "\n</urlset>\n")

    io.open(os.path.join(SITE, "robots.txt"), "w", encoding="utf-8").write(
        "# Happy Trails — everything here is meant to be found.\n"
        "User-agent: *\n"
        "Allow: /\n"
        "\n"
        "Sitemap: %ssitemap.xml\n" % BASE)
    print("   sitemap.xml    ", len(pages), "pages")
    print("   robots.txt     ", "everything allowed")


def main():
    for page, meta in sorted(PAGES.items()):
        p = os.path.join(SITE, page)
        s = io.open(p, encoding="utf-8").read()

        # a description, if the page has not got one
        if 'name="description"' not in s:
            s = s.replace("<title>", '<meta name="description" content="%s">\n<title>'
                          % meta["desc"].replace('"', "&quot;"), 1)
        else:
            s = re.sub(r'<meta name="description" content="[^"]*">',
                       '<meta name="description" content="%s">' % meta["desc"].replace('"', "&quot;"),
                       s, count=1)

        block = head_for(page, meta)
        if "<!-- SOCIAL_HEAD -->" in s:
            s = s.replace("<!-- SOCIAL_HEAD -->", block)
        elif "og:title" in s:
            s = re.sub(r'<!-- how this page looks.*?name="twitter:image"[^>]*>', block, s, flags=re.S)
        else:
            s = s.replace("</head>", block + "\n</head>", 1)
        # the counter, once per page and never twice
        if 'src="analytics.js"' not in s:
            s = s.replace("</head>", ANALYTICS + "\n</head>", 1)
        io.open(p, "w", encoding="utf-8").write(s)
        print("  ", page.ljust(17), meta["img"])
    sitemap_and_robots()

main()
