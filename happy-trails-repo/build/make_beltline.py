#!/usr/bin/env python3
"""
Redraw the Beltline's artwork.

The nine placeholder trails are rivers, a shore and two hydro corridors. The
Beltline is none of those — it is a RAILPATH, and a railpath looks different on
a map: a former rail alignment runs almost straight, with long easy curves
instead of meanders, because that is what trains need. It cuts across the street
grid rather than following a valley, and it is interrupted by the roads it once
bridged.

So this one is drawn to its own rules. West to east across midtown, straight and
purposeful, with the three things that actually characterise it: the severance at
Allan Rd, the cemetery it runs through, and the drop into the Don valley at the
eastern end where it meets Mud Creek and the Brick Works.

The thirteen waypoints keep the marker names the page already uses, so nothing
in beltline.html has to change — the words, the photographs and the videos all
still point where they did.
"""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import paths

import io, math, sys
from make_trails import (rounded, W, H, PAPER, WATER, WATER_EDGE, PARK, ROAD_EDGE,
                         ARTERIAL, RAIL, INK, INK_SOFT, ROUTE, WISHFUL)

CEMETERY = "#cbd6bb"
BUILT    = "#e3d9c0"

# where each stop sits along the route, and what the page already calls it.
# Deliberately uneven — a real trail's landmarks are not evenly spaced.
STOPS = [
  ("wp-landing",   0.000, "real"),
  ("wp-shore",     0.062, "real"),
  ("wp-boathouse", 0.125, "wishful"),   # Missing crosswalk
  ("wp-tarn",      0.203, "real"),
  ("wp-pass",      0.281, "real"),
  ("wp-moraine",   0.352, "real"),      # Allan Rd — the severance
  ("wp-bridge",    0.441, "wishful"),   # Old Park crossing
  ("wp-shoulder",  0.523, "real"),
  ("wp-traverse",  0.621, "real"),      # Yonge
  ("wp-steps",     0.719, "real"),      # the cemetery
  ("wp-spur",      0.803, "wishful"),   # Moore crossing
  ("wp-overlook",  0.898, "real"),      # Mud Creek
  ("wp-hut",       1.000, "real"),      # the Brick Works
]

PLACES = [
  (300,  520, "YORK",            54),
  (1180, 430, "FAIRBANK",        46),
  (2020, 560, "FOREST HILL",     50),
  (2760, 470, "DAVISVILLE",      46),
  (3180, 1560, "DON VALLEY",     52),
  (1520, 1880, "MIDTOWN",        48),
]

ROADS = [   # the crossings that matter, west to east
  (620,  "DUFFERIN ST"),
  (1180, "MARLEE AVE"),
  (1460, "ALLAN RD"),
  (2140, "OAKWOOD"),
  (2560, "YONGE ST"),
  (3050, "MOORE AVE"),
]


def alignment():
    """A rail alignment: straight, with two long easy curves, dropping east into
    the valley. Nothing like the meander the river trails get."""
    pts = []
    n = 26
    for i in range(n + 1):
        t = i / float(n)
        x = 240 + t * 3120
        # a shallow S, then a steeper fall into the valley at the eastern end
        y = 1180 - math.sin(t * math.pi * 0.9) * 150
        if t > 0.72:
            drop = (t - 0.72) / 0.28
            y += drop * drop * 620
        pts.append((x, y))
    return pts


def creek(route_pts):
    """Mud Creek, which the trail follows down into the Don valley."""
    tail = route_pts[int(len(route_pts) * 0.74):]
    return [(x + 70, y + 116) for x, y in tail]


def along(pts, t):
    fi = t * (len(pts) - 1)
    lo = int(math.floor(fi)); hi = min(lo + 1, len(pts) - 1); f = fi - lo
    return (pts[lo][0] + (pts[hi][0] - pts[lo][0]) * f,
            pts[lo][1] + (pts[hi][1] - pts[lo][1]) * f)


def build():
    route = alignment()
    body, marks, wish = [], [], []

    # ── streets, cut by nothing: this is built-up city ───────────────────────
    for x in range(90, W, 128):
        body.append('<line x1="%d" y1="0" x2="%d" y2="%d" stroke="%s" stroke-width="6"/>'
                    % (x, x + 14, H, ROAD_EDGE))
    for y in range(96, H, 118):
        body.append('<line x1="0" y1="%d" x2="%d" y2="%d" stroke="%s" stroke-width="6"/>'
                    % (y, W, y + 10, ROAD_EDGE))
    for x, name in ROADS:
        body.append('<line x1="%d" y1="0" x2="%d" y2="%d" stroke="%s" stroke-width="22"/>'
                    % (x, x + 26, H, ARTERIAL))
    for y in (430, 1120, 1810):
        body.append('<line x1="0" y1="%d" x2="%d" y2="%d" stroke="%s" stroke-width="22"/>'
                    % (y, W, y + 14, ARTERIAL))

    # ── the valley at the eastern end, and the creek in it ───────────────────
    valley = [(x + 40, y + 60) for x, y in route[int(len(route) * 0.68):]]
    body.append('<path d="%s" fill="none" stroke="%s" stroke-width="520" '
                'stroke-linecap="round" stroke-linejoin="round" opacity=".9"/>'
                % (rounded(valley), PARK))
    ck = creek(route)
    body.append('<path d="%s" fill="none" stroke="%s" stroke-width="34" '
                'stroke-linecap="round"/>' % (rounded(ck), WATER))
    body.append('<path d="%s" fill="none" stroke="%s" stroke-width="4" '
                'stroke-linecap="round" opacity=".45"/>' % (rounded(ck), WATER_EDGE))

    # ── the cemetery the trail runs through ──────────────────────────────────
    cx, cy = along(route, 0.719)
    body.append('<rect x="%d" y="%d" width="620" height="430" rx="26" fill="%s" '
                'opacity=".95"/>' % (cx - 290, cy - 215, CEMETERY))
    for i in range(1, 6):
        body.append('<line x1="%d" y1="%d" x2="%d" y2="%d" stroke="%s" stroke-width="4" '
                    'opacity=".5"/>' % (cx - 290 + i * 103, cy - 215, cx - 290 + i * 103,
                                        cy + 215, "#ffffff"))

    # ── a scatter of parks, and the live rail corridor it parallels ──────────
    for px, py, rx, ry in ((760, 700, 150, 96), (2280, 1720, 190, 120),
                           (1900, 520, 130, 88), (3260, 700, 160, 104)):
        body.append('<ellipse cx="%d" cy="%d" rx="%d" ry="%d" fill="%s" opacity=".8"/>'
                    % (px, py, rx, ry, PARK))
    body.append('<line x1="0" y1="1980" x2="%d" y2="2040" stroke="%s" stroke-width="12" '
                'stroke-dasharray="36 24" opacity=".7"/>' % (W, RAIL))

    # ── labels ───────────────────────────────────────────────────────────────
    labels = []
    for x, y, text, size in PLACES:
        labels.append('<text x="%d" y="%d" font-family="Georgia,serif" font-size="%d" '
                      'fill="%s" opacity=".5" letter-spacing="2">%s</text>'
                      % (x, y, size, INK_SOFT, text))
    # The crossing names run UP the roads they name. Each has to rotate about
    # its OWN position — rotating them all about one point stacks them in a
    # heap at the left edge, which is what the first attempt did.
    for x, name in ROADS:
        lx, ly = x + 40, 300
        labels.append('<text x="%d" y="%d" font-family="system-ui,sans-serif" '
                      'font-size="26" fill="%s" opacity=".45" letter-spacing="3" '
                      'transform="rotate(90 %d %d)">%s</text>'
                      % (lx, ly, INK_SOFT, lx, ly, name))

    # ── the waypoints, on the alignment, under their existing names ──────────
    for name, t, kind in STOPS:
        x, y = along(route, t)
        marks.append('<circle id="%s" cx="%.1f" cy="%.1f" r="9" fill="#fff" '
                     'stroke="%s" stroke-width="5"/>'
                     % (name, x, y, WISHFUL if kind == "wishful" else ROUTE))

    # ── the routes that do not exist yet ─────────────────────────────────────
    # Each wishful stop on this trail is a crossing that does not work: a
    # missing crosswalk, a severed connection. So each gets a short purple
    # piece of route that would put it right — drawn like the trail, because
    # that is what it would be.
    for name, t, kind in STOPS:
        if kind != "wishful":
            continue
        a = along(route, max(0.0, t - 0.045))
        b = along(route, min(1.0, t + 0.045))
        mx, my = (a[0] + b[0]) / 2.0, (a[1] + b[1]) / 2.0
        dx, dy = b[0] - a[0], b[1] - a[1]
        L = math.hypot(dx, dy) or 1
        qx, qy = mx + (-dy / L) * 150, my + (dx / L) * 150
        wish.append('<path d="M%.1f %.1f Q%.1f %.1f %.1f %.1f" fill="none" stroke="%s" '
                    'stroke-width="15" stroke-linecap="round" opacity=".9"/>'
                    % (a[0], a[1], qx, qy, b[0], b[1], WISHFUL))
        for px, py in (a, b):
            wish.append('<circle cx="%.1f" cy="%.1f" r="11" fill="#fff" stroke="%s" '
                        'stroke-width="6"/>' % (px, py, WISHFUL))

    svg = ['<svg xmlns="http://www.w3.org/2000/svg" width="%d" height="%d" '
           'viewBox="0 0 %d %d">' % (W, H, W, H)]
    svg.append('<g id="background"><rect width="%d" height="%d" fill="%s"/></g>' % (W, H, PAPER))
    svg.append('<g id="topo">')
    svg.append('<g id="roads">' + "".join(body) + "</g>")
    svg.append('<g id="labels">' + "".join(labels) + "</g>")
    svg.append("</g>")
    svg.append('<path id="route" d="%s" fill="none" stroke="%s" stroke-width="10" '
               'stroke-linecap="round" opacity=".25"/>' % (rounded(route), ROUTE))
    svg.append('<g id="wishful">' + "".join(wish) + "</g>")
    svg.append('<g id="waypoints">' + "".join(marks) + "</g>")
    svg.append("</svg>")
    return "".join(svg)


if __name__ == "__main__":
    art = build()
    io.open(os.path.join(paths.MAPS, "beltline-map.svg"), "w", encoding="utf-8").write(art)
    print("beltline-map.svg written:", len(art), "chars")
