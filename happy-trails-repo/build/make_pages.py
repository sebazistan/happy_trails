#!/usr/bin/env python3
"""Write a trail page, its artwork and its placeholder media, for each trail."""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import paths

import io, os, sys, json
from trails_data import ALL_TRAILS, stop_dicts
import make_trails

SITE = paths.SITE
PAPER, INK, ROUTE, PARK, WATER = "#efe8d8", "#3b2f1f", "#c0392b", "#cfd8b8", "#9fc4d0"


def placeholder(name, n, kind):
    """A stand-in picture, plainly labelled as one. Drawn rather than
    photographed so nobody mistakes it for content that is finished."""
    tint = {"river": WATER, "waterfront": WATER, "corridor": PARK}[kind]
    return ('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600">'
            '<rect width="800" height="600" fill="%s"/>'
            '<path d="M0 430 Q200 380 400 415 T800 400 L800 600 L0 600 Z" fill="%s" opacity=".55"/>'
            '<path d="M0 470 Q260 430 520 462 T800 450 L800 600 L0 600 Z" fill="%s" opacity=".5"/>'
            '<circle cx="640" cy="140" r="54" fill="#fff" opacity=".35"/>'
            '<text x="400" y="292" text-anchor="middle" font-family="Georgia,serif" '
            'font-size="40" fill="%s" opacity=".62">%s</text>'
            '<text x="400" y="336" text-anchor="middle" font-family="system-ui,sans-serif" '
            'font-size="19" letter-spacing="3" fill="%s" opacity=".45">PLACEHOLDER %d</text>'
            "</svg>" % (PAPER, tint, PARK, INK, name, INK, n))


def js(text):
    """A JavaScript string literal. Written out rather than trusted to a format
    string, because the Beltline's text contains quotation marks, apostrophes
    and em dashes, and one unescaped quote in a generated page is a blank
    screen with a syntax error nobody sees until they open it."""
    return '"' + (str(text).replace("\\", "\\\\").replace('"', '\\"')
                  .replace("\n", "\\n")) + '"'


def waypoint(s, trail):
    """One stop, written the way a trail page wants it.

    A FINISHED TRAIL SUPPLIES ITS OWN. Where a stop carries real photographs
    and real text, those are used; where it does not, a placeholder picture and
    a paragraph saying so are put in its place. That is the only difference
    between the Beltline and the eleven placeholder trails, and stating it here
    once is what let the Beltline stop being a hand-written page."""
    lines = []
    lines.append("    marker: %s," % js(s["marker"] or ("#wp-%d" % s["i"])))
    lines.append("    title:  %s," % js(s["title"]))
    lines.append("    metres: %d," % s["metres"])
    if s.get("mapLink"):
        lines.append("    mapLink: %s," % js(s["mapLink"]))
    # a wishful stop says so, and says what it would take and how badly it is
    # wanted — the two facts the Wishful thinking page sorts on
    if s["kind"] == "wishful":
        lines.append('    kind:   "wishful",  cost: %s,  priority: %s,'
                     % (js(s["cost"]), js(s["priority"])))

    if s.get("media"):
        pics = ",\n".join("               { src: %s, caption: %s }"
                          % (js(src), js(cap)) for src, cap in s["media"])
        lines.append("    media:  [\n%s ]," % pics)
    else:
        lines.append('    media:  [ { src: "%d-a.svg", caption: %s },\n'
                     '               { src: "%d-b.svg", caption: '
                     '"Placeholder — swap in a real photograph" } ],'
                     % (s["i"], js(s["caption"]), s["i"]))

    if s.get("text"):
        paras = ",\n".join("      %s" % js(t) for t in s["text"])
        lines.append("    text:   [\n%s ]" % paras)
    else:
        lines.append("    text:   %s" % js(
            "Temporary text for %s. This page is a placeholder built so the "
            "trail has somewhere to live and so the layout can be judged with "
            "real proportions — the words, the pictures and the heights all "
            "still need writing." % s["title"]))
    return "  {\n" + "\n".join(lines) + "\n  }"


def page(trail):
    stops = stop_dicts(trail)
    slug, name = trail["slug"], trail["name"]

    wp = [waypoint(s, trail) for s in stops]

    art = io.open("%s/maps/%s-map.svg" % (SITE, slug), encoding="utf-8").read()
    # type and length share one line
    kicker_html = trail["kicker"].replace(" / ", " &nbsp;·&nbsp; ")

    # a wishful trail says so, and the stylesheet turns it purple
    kind_line = ('  trailKind:      "wishful",   // purple throughout\n'
                 if trail.get("wishful") else "")

    # A FINISHED TRAIL WRITES ITS OWN OPENING AND CLOSING WORDS. Where it has
    # not, the generator makes something reasonable out of the trail's name and
    # its one-line description, which is what a placeholder page should say.
    words = trail.get("words", {})

    banner = ("     version 1.5\n\n"
              "     Written, not invented: the words, the photographs and the\n"
              "     heights on this page are real."
              if trail.get("real") else
              "     version 1.5   (PLACEHOLDER)\n\n"
              "     Everything here is temporary except its shape. The map is\n"
              "     drawn, not surveyed; the stops sit at plausible places along\n"
              "     it; the heights and the text are invented.")

    crossing_rows = ",\n".join(
        '  { href: "%s.html", label: "%s" }' % (m[1], m[2])
        for m in trail.get("meets", []))

    return '''<!doctype html>
<html lang="en">
<!-- ═══════════════════════════════════════════════════════════════════════════
     %s — a trail page
%s
     THIS FILE IS GENERATED by make_pages.py from trails_data.py. Editing it
     works until the next build and then stops working, which is the worst kind
     of working. Edit the trail's entry in trails_data.py instead.

     TO FINISH A TRAIL
       1. draw its map into maps/<slug>-map.svg, keeping one <path id="route">
          and one #wp-N circle per stop
       2. give its entry a `waypoints` list: title, height, words, pictures
       3. put the pictures in media/<slug>/
       4. set its length and the page works the rest out
     The Beltline is the worked example of all four.

     How a trail page WORKS is in trail-engine.js, shared by every trail.
     Colours and sizes are in happy-trails.css, shared by every page.
     ═══════════════════════════════════════════════════════════════════════════ -->
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>%s — Happy Trails</title>
<meta name="description" content="%s">
<link rel="stylesheet" href="happy-trails.css">
<!-- SOCIAL_HEAD -->
</head>
<body>

<script>
(function () {
  "use strict";

/* ── WHAT MAKES THIS TRAIL THIS TRAIL ────────────────────────────────────
   Only what differs from the defaults in trail-engine.js.                  */

const SETTINGS = {
  version:        "1.5",
  trailLength:    %s,          // km end to end
  mediaFolder:    "media/%s/",
  mapFile:        "maps/%s-map.svg",   // what the Download button offers
  trailImage:     "trail%%20link%%20images/%s.png",  // behind the opening card
                                       // (the folder is "trail link images";
                                       //  the %%20s are the spaces)
%s};

/* ── WHERE THIS TRAIL MEETS OTHERS ───────────────────────────────────────
   One entry per junction, in the same order as the #link-N circles in the
   drawing at the bottom. The engine puts a button at each circle.          */
const CROSSINGS = [
%s
];

const WORDS = {
  cornerKicker:  %s,
  cornerTitle:   %s,
  openingKicker: %s,
  openingTitle:  %s,
  openingBody:   %s,
  closingTitle:  %s,
  closingBody:   %s,
};

/* ── THE STOPS ───────────────────────────────────────────────────────────
   All placeholder. Each one is anchored to a #wp-N circle in the artwork, so
   redrawing the map moves the stops with it as long as the circles keep their
   names.                                                                    */

const WAYPOINTS = [
%s
];

window.TRAIL_PAGE = { SETTINGS: SETTINGS, WORDS: WORDS, WAYPOINTS: WAYPOINTS,
                      CROSSINGS: CROSSINGS };
})();
</script>

<template id="tm-artwork">
%s
</template>

<script src="trail-engine.js"></script>
</body>
</html>
''' % (name, banner, name,
       trail["lead"].replace('"', "&quot;"),
       trail["length"], slug, slug, slug, kind_line, crossing_rows,
       js(kicker_html), js(name),
       js(words.get("openingKicker", "%s km · Toronto" % trail["length"])),
       js(words.get("openingTitle", "%s, end to end" % name)),
       js(words.get("openingBody", trail["lead"])),
       js(words.get("closingTitle", stops[-1]["title"])),
       js(words.get("closingBody",
                    "A placeholder finish for %s. %s" % (name, trail["lead"]))),
       ",\n".join(wp), art)


def main():
    for t in ALL_TRAILS:
        slug = t["slug"]
        d = "%s/media/%s" % (SITE, slug)
        os.makedirs(d, exist_ok=True)
        for s in stop_dicts(t):
            # A STOP WITH REAL PICTURES DOES NOT GET FAKE ONES. Drawing them
            # anyway would be harmless until the day a placeholder was written
            # over a photograph with the same name.
            if s.get("media"):
                continue
            for suffix in ("a", "b"):
                io.open("%s/%d-%s.svg" % (d, s["i"], suffix), "w", encoding="utf-8").write(
                    placeholder(s["title"], s["i"], t["kind"]))
        io.open("%s/%s.html" % (SITE, slug), "w", encoding="utf-8").write(page(t))
        print(slug.ljust(16), len(stop_dicts(t)), "stops",
              "  (written)" if t.get("real") else "")

main()
