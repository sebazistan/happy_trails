#!/usr/bin/env python3
"""
Assemble index.html: the main map page.

WHY THIS EXISTS
  index.html is the one page that carries its artwork inside it — 750 KB of
  drawn map, inlined so that the page can switch layers on and off and light a
  route when you point at its button, none of which is possible with an <img>.

  Inlined by hand it made the file unreadable and unmergeable: 830 KB, one
  line of which was the map. So the page lives in templates/index.html with a
  marker where the map goes, and this puts the two together. The template is
  74 KB and can be opened, read and edited like a normal file.

  It also writes the route-button positions, which are MEASURED from the
  artwork rather than typed — see make_artwork.measure_pins. Move a route in
  Illustrator and its button follows it, with no coordinates to update.
"""

import io, json, os, re, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import paths
import make_artwork

MARKER = "<!--THE MAP GOES HERE — build/make_index.py inlines it-->"


def rewrite_pins(page, pins):
    """Put the measured position into each route's entry.

    The entries themselves stay in the template — a route's label, its address,
    which switches it belongs to and whether it is wishful are all decisions,
    and decisions belong in a file a person edits. Only x and y are measured,
    so only x and y are written."""
    changed = []

    def one(m):
        slug = m.group("slug")
        if slug not in pins:
            return m.group(0)
        x, y = pins[slug]
        was = (int(m.group("x")), int(m.group("y")))
        if was != (x, y):
            changed.append((slug, was, (x, y)))
        return "%sx: %d, y: %d,%s" % (m.group("before"), x, y, m.group("after"))

    pattern = re.compile(
        r'(?P<before>layer:\s*"(?P<slug>[a-z0-9\-]+)",\s*\n?\s*)'
        r'x:\s*(?P<x>\d+),\s*y:\s*(?P<y>\d+),(?P<after>)')
    page = pattern.sub(one, page)
    for slug, was, now in changed:
        print("   %-30s button moved %s → %s" % (slug, list(was), list(now)))
    if not changed:
        print("   route buttons: all %d already where the artwork puts them"
              % len(pins))
    return page


def main():
    paths.make()

    template = os.path.join(paths.TEMPLATES, "index.html")
    art = os.path.join(paths.MAPS, "happy-trails-map.svg")
    page = io.open(template, encoding="utf-8").read()
    if MARKER not in page:
        raise SystemExit(
            "templates/index.html has no place to put the map.\n"
            "  It needs this line, on its own, inside <template id=\"ht-artwork\">:\n"
            "    " + MARKER)

    # the routes the page knows about, so only those are measured
    routes = re.findall(r'layer:\s*"([a-z0-9\-]+)"', page)
    pins = make_artwork.measure_pins(routes)
    page = rewrite_pins(page, pins)

    page = page.replace(MARKER, io.open(art, encoding="utf-8").read(), 1)
    io.open(os.path.join(paths.SITE, "index.html"), "w",
            encoding="utf-8").write(page)
    print("   index.html             %.0f KB, map inlined" %
          (len(page) / 1024))


if __name__ == "__main__":
    main()
