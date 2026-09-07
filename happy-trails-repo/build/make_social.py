#!/usr/bin/env python3
"""
A link preview image per page.

1200x630 is what Facebook, Slack, iMessage, LinkedIn and Twitter all crop to,
so it is what we draw. Each one is the page's own map with the trail's name
over it — a picture of the actual thing, not a logo, because the whole appeal
of these pages is that they look like maps.
"""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import paths

import io, os, sys, re
import cairosvg
from trails_data import ALL_TRAILS

SITE = paths.SITE
OUT = SITE + "/social"
os.makedirs(OUT, exist_ok=True)

W, H = 1200, 630


def card(map_svg_path, title, kicker, out_name, crop=None):
    """Render the map, then lay the title over it in the site's own manner."""
    art = io.open(map_svg_path, encoding="utf-8").read()
    m = re.search(r'viewBox="([\d.\- ]+)"', art)
    vb = [float(v) for v in m.group(1).split()] if m else [0, 0, 3600, 2400]

    # crop to the 1200x630 shape from the middle of the drawing, so the preview
    # is a piece of real map rather than the whole thing shrunk to a smear
    want = W / float(H)
    vw, vh = vb[2], vb[3]
    if vw / vh > want:
        nh = vh
        nw = nh * want
    else:
        nw = vw
        nh = nw / want
    cx, cy = vb[0] + vw / 2.0, vb[1] + vh / 2.0
    if crop:
        cx, cy = crop
    inner = re.sub(r'^<svg[^>]*>', "", art).rsplit("</svg>", 1)[0]

    svg = (
      '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" '
      'width="%d" height="%d" viewBox="0 0 %d %d">'
      '<defs>'
        '<linearGradient id="veil" x1="0" y1="0" x2="0" y2="1">'
          '<stop offset="0" stop-color="#0b0e10" stop-opacity=".08"/>'
          '<stop offset=".55" stop-color="#0b0e10" stop-opacity=".55"/>'
          '<stop offset="1" stop-color="#0b0e10" stop-opacity=".9"/>'
        '</linearGradient>'
        '<clipPath id="frame"><rect width="%d" height="%d"/></clipPath>'
      '</defs>'
      '<g clip-path="url(#frame)">'
        '<g transform="translate(%f,%f) scale(%f)">%s</g>'
        '<rect width="%d" height="%d" fill="url(#veil)"/>'
      '</g>'
      '<text x="64" y="%d" font-family="Georgia,serif" font-size="26" fill="#e8b64c" '
        'letter-spacing="3">%s</text>'
      '<text x="64" y="%d" font-family="Georgia,serif" font-size="76" fill="#ffffff" '
        'font-weight="600">%s</text>'
      '<text x="64" y="%d" font-family="system-ui,Helvetica,sans-serif" font-size="25" '
        'fill="#cfd6da">happytrails</text>'
      "</svg>"
    ) % (W, H, W, H, W, H,
         -(cx - nw / 2.0) * (W / nw), -(cy - nh / 2.0) * (W / nw), W / nw, inner,
         W, H,
         H - 168, kicker.upper(),
         H - 96, title,
         H - 44)
    cairosvg.svg2png(bytestring=svg.encode("utf-8"), write_to=OUT + "/" + out_name,
                     output_width=W, output_height=H)
    return out_name


def main():
    made = []
    for t in ALL_TRAILS:
        made.append(card("%s/maps/%s-map.svg" % (SITE, t["slug"]), t["name"],
                         t["kicker"].replace("TYPE: ", "").replace(" / LENGTH:", " ·").lower(),
                         t["slug"] + ".png"))
    # the site's own card, off the main map
    made.append(card(paths.MAPS + "//happy-trails-map.svg", "Happy Trails",
                     "Every multi-use trail in the GTA", "site.png"))
    # and the Wishful thinking page's, off the same map: what that page is
    # about is the whole network and where it breaks, so the whole network is
    # the right picture for it
    made.append(card(paths.MAPS + "//happy-trails-map.svg", "Wishful thinking",
                     "Twelve gaps, and what each would cost", "wishful.png"))
    for n in made:
        print("  ", n, os.path.getsize(OUT + "/" + n) // 1024, "KB")

main()
