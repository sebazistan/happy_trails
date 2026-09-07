#!/usr/bin/env python3
"""
Draw placeholder artwork for the trail pages.

These are stand-ins, not maps of anywhere. But they are stand-ins in the right
IDIOM: the trails on this site are urban bike routes, and an urban bike route in
Toronto almost always follows one of three things — a river valley, the lake
shore, or a hydro corridor. Drawing mountain contours under them, as the first
demo did, makes every page look like it belongs to a different site and makes it
hard to judge whether the real thing will read well.

So each map gets a street grid, some parkland, and one of those three spines,
with the route hugging it the way a real one does.

Everything is 3600x2400 so the settings carry across from the Beltline page
unchanged. Each SVG carries:
    #background   the paper
    #topo         everything the satellite layer would hide
    #route        the path the engine walks
    #wp-N         a circle per waypoint, which is what anchors the stops
"""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import paths

import io, math, random, os

W, H = 3600, 2400

PAPER      = "#efe8d8"
WATER      = "#9fc4d0"
WATER_EDGE = "#5c8595"
PARK       = "#cfd8b8"
PARK_EDGE  = "#b3c096"
ROAD       = "#e6dcc6"
ROAD_EDGE  = "#d6c9ad"
ARTERIAL   = "#dccfb0"
RAIL       = "#b9a578"
INK        = "#3b2f1f"
INK_SOFT   = "#7a6a4c"
ROUTE      = "#4ecf4e"   # the trail itself — the SAME green the trails are
                         # drawn in on the main map. It was the red accent
                         # for a while, which made a built trail look like a
                         # warning on its own page and unlike itself on the
                         # map you arrived from.
WISHFUL    = "#e84fff"   # the routes that do not exist yet
LINKMARK   = "#3b6ea8"   # where this trail meets another one


def rounded(points, k=0.34):
    """A smooth path through the points, as cubic segments — the same curve the
    engine uses for routes, so the drawn line and the walked line agree."""
    if len(points) < 2:
        return ""
    d = "M%.1f %.1f" % points[0]
    for i in range(len(points) - 1):
        p0 = points[i - 1] if i > 0 else points[i]
        p1, p2 = points[i], points[i + 1]
        p3 = points[i + 2] if i + 2 < len(points) else p2
        c1 = (p1[0] + (p2[0] - p0[0]) * k, p1[1] + (p2[1] - p0[1]) * k)
        c2 = (p2[0] - (p3[0] - p1[0]) * k, p2[1] - (p3[1] - p1[1]) * k)
        d += " C%.1f %.1f %.1f %.1f %.1f %.1f" % (c1[0], c1[1], c2[0], c2[1], p2[0], p2[1])
    return d


def street_grid(rng, skip_near=None):
    """A grid of residential streets with a few arterials through it. Streets
    stop where they would run into water or parkland, which is what stops the
    drawing looking like graph paper."""
    out = []
    for x in range(120, W, 132):
        jog = rng.uniform(-16, 16)
        out.append('<line x1="%.0f" y1="0" x2="%.0f" y2="%d" stroke="%s" stroke-width="6"/>'
                   % (x, x + jog, H, ROAD_EDGE))
    for y in range(110, H, 124):
        jog = rng.uniform(-14, 14)
        out.append('<line x1="0" y1="%.0f" x2="%d" y2="%.0f" stroke="%s" stroke-width="6"/>'
                   % (y, W, y + jog, ROAD_EDGE))
    for x in range(430, W, 760):
        out.append('<line x1="%d" y1="0" x2="%d" y2="%d" stroke="%s" stroke-width="19"/>'
                   % (x, x + 30, H, ARTERIAL))
    for y in range(360, H, 690):
        out.append('<line x1="0" y1="%d" x2="%d" y2="%d" stroke="%s" stroke-width="19"/>'
                   % (y, W, y + 20, ARTERIAL))
    return out


def river(rng, x0, y0, x1, y1, wobble=210, waves=2.6):
    """A meandering watercourse from one corner to another.

    The meander has to run ACROSS the river's own direction, not along it —
    offsetting x and y by the same wave on a diagonal course mostly cancels
    out and draws a straight line with a slight lean, which is what the first
    attempt did. So the wave is applied along the perpendicular."""
    n = 22
    dx, dy = x1 - x0, y1 - y0
    length = math.hypot(dx, dy) or 1
    px, py = -dy / length, dx / length          # unit vector across the course
    phase = rng.uniform(0, math.pi)
    pts = []
    for i in range(n + 1):
        t = i / n
        # the meander is widest in the middle and settles at both ends, so the
        # river arrives where it was asked to
        taper = math.sin(t * math.pi) ** 0.6
        swing = math.sin(t * math.pi * waves + phase) * wobble * taper
        swing += math.sin(t * math.pi * waves * 2.7 + phase) * wobble * 0.22 * taper
        pts.append((x0 + dx * t + px * swing, y0 + dy * t + py * swing))
    return pts


def park_band(pts, spread):
    """A soft green ribbon following a line — the valley floor."""
    return ('<path d="%s" fill="none" stroke="%s" stroke-width="%d" '
            'stroke-linecap="round" stroke-linejoin="round" opacity=".85"/>'
            % (rounded(pts), PARK, spread))


def labels(items):
    out = []
    for x, y, text, size in items:
        out.append('<text x="%d" y="%d" font-family="Georgia,serif" font-size="%d" '
                   'fill="%s" opacity=".55">%s</text>' % (x, y, size, INK_SOFT, text))
    return out


def along(route_pts, t):
    """The point at t (0-1) along a list of route points."""
    fi = t * (len(route_pts) - 1)
    lo = int(math.floor(fi)); hi = min(lo + 1, len(route_pts) - 1); f = fi - lo
    return (route_pts[lo][0] + (route_pts[hi][0] - route_pts[lo][0]) * f,
            route_pts[lo][1] + (route_pts[hi][1] - route_pts[lo][1]) * f)


def wishful_routes(trail, route_pts):
    """The bits of trail that do not exist yet.

    Every "wishful" stop is a gap — a bridge that would close a fifty-year
    severance, a link that would join two valleys. So each one gets a short
    piece of route drawn beside the real one: same weight and same round ends,
    so it reads as trail, but purple and much shorter, so it reads as trail
    that is only proposed. It leaves the route at the stop and rejoins it a
    little further on, bulging to one side — the shape a bypass or a new bridge
    actually takes on a map.

    They all go in <g id="wishful">, which is the group the Wishful thinking
    switch shows and hides. See SETTINGS.wishfulLayer in trail-engine.js."""
    out = []
    for stop in trail["stops"]:
        kind = stop[4] if len(stop) > 4 else "real"
        if kind != "wishful":
            continue
        t = stop[1]
        a = along(route_pts, max(0.0, t - 0.055))
        b = along(route_pts, min(1.0, t + 0.055))
        mx, my = (a[0] + b[0]) / 2.0, (a[1] + b[1]) / 2.0
        dx, dy = b[0] - a[0], b[1] - a[1]
        L = math.hypot(dx, dy) or 1
        # bulge across the route, so the proposal is visibly a different line
        bulge = 168
        cx, cy = mx + (-dy / L) * bulge, my + (dx / L) * bulge
        out.append('<path d="M%.1f %.1f Q%.1f %.1f %.1f %.1f" fill="none" stroke="%s" '
                   'stroke-width="15" stroke-linecap="round" opacity=".9"/>'
                   % (a[0], a[1], cx, cy, b[0], b[1], WISHFUL))
        # the two ends, so it is clear where it would meet the built trail
        for px, py in (a, b):
            out.append('<circle cx="%.1f" cy="%.1f" r="11" fill="#fff" stroke="%s" '
                       'stroke-width="6"/>' % (px, py, WISHFUL))
    return out


def crossings(trail, route_pts):
    """Small circles marking where this trail meets another.

    Most trails begin and end at another trail — that is what makes a network
    rather than a collection — and a few cross one part way along. Each gets a
    circle in the drawing under a name the page can find (#link-1, #link-2),
    and the page turns it into a button pointing at that trail.

    They are pushed OFF the route, to the side, so they never sit under a
    waypoint button: two buttons in the same place is two things you cannot
    press. Which side alternates, so a pair at the same bend does not overlap
    each other either."""
    out = []
    for n, (t, slug, label) in enumerate(trail.get("meets", []), 1):
        x, y = along(route_pts, t)
        # a normal to the route at this point, so "beside" means beside the
        # trail rather than beside the page
        i = min(int(t * (len(route_pts) - 1)), len(route_pts) - 2)
        dx = route_pts[i + 1][0] - route_pts[i][0]
        dy = route_pts[i + 1][1] - route_pts[i][1]
        L = math.hypot(dx, dy) or 1
        side = 1 if n % 2 else -1
        ox, oy = (-dy / L) * 132 * side, (dx / L) * 132 * side
        out.append('<circle id="link-%d" cx="%.1f" cy="%.1f" r="8" fill="#fff" '
                   'stroke="%s" stroke-width="5"/>' % (n, x + ox, y + oy, LINKMARK))
        # a hairline back to the trail, so it is clear what the marker belongs to
        out.append('<line x1="%.1f" y1="%.1f" x2="%.1f" y2="%.1f" stroke="%s" '
                   'stroke-width="4" opacity=".45"/>' % (x, y, x + ox, y + oy, LINKMARK))
    return out


def build(trail):
    rng = random.Random(trail["seed"])
    kind = trail["kind"]
    body, place = [], []

    # ── the spine, and the line the route follows ────────────────────────────
    if kind == "river":
        spine = river(rng, *trail["from_to"], wobble=trail.get("wobble", 210))
        body.append(park_band(spine, 430))                 # the valley floor
        body.append(park_band(spine, 300))                 # denser near the water
        body.append('<path d="%s" fill="none" stroke="%s" stroke-width="62" '
                    'stroke-linecap="round" stroke-linejoin="round"/>' % (rounded(spine), WATER))
        body.append('<path d="%s" fill="none" stroke="%s" stroke-width="5" '
                    'stroke-linecap="round" opacity=".45"/>' % (rounded(spine), WATER_EDGE))
        # the trail runs along one bank, crossing now and then — which is what a
        # real valley route does, and what makes the bridges worth marking
        off = trail.get("offset", 78)
        route_pts = []
        for i, (x, y) in enumerate(spine):
            side = 1 if math.sin(i * 0.55) > -0.3 else -1
            nx, ny = (spine[min(i + 1, len(spine) - 1)][0] - spine[max(i - 1, 0)][0],
                      spine[min(i + 1, len(spine) - 1)][1] - spine[max(i - 1, 0)][1])
            L = math.hypot(nx, ny) or 1
            route_pts.append((x + (-ny / L) * off * side, y + (nx / L) * off * side))

    elif kind == "waterfront":
        # The shore wanders, and a wander that happens to finish higher than it
        # started makes the one trail on the site that reads bottom-to-top. A
        # gentle drift downwards across the frame settles it, and it is true to
        # the place besides: the lakeshore route runs west to east and very
        # slightly south.
        shore = [(x, trail["shore_y"] + math.sin(x / 620.0 + 1.1) * 78
                     + (x / float(W)) * 150) for x in range(-100, W + 200, 320)]
        lake = rounded(shore) + " L%d %d L-100 %d Z" % (W + 200, H + 100, H + 100)
        body.append('<path d="%s" fill="%s"/>' % (lake, WATER))
        body.append('<path d="%s" fill="none" stroke="%s" stroke-width="6" opacity=".55"/>'
                    % (rounded(shore), WATER_EDGE))
        body.append(park_band([(x, y - 120) for x, y in shore], 210))
        route_pts = [(x, y - 132) for x, y in shore][1:-1]

    else:  # hydro corridor — a straight green ribbon carrying a trail and pylons
        a, bb = trail["from_to"][:2], trail["from_to"][2:]
        spine = [(a[0] + (bb[0] - a[0]) * i / 8.0,
                  a[1] + (bb[1] - a[1]) * i / 8.0 + math.sin(i * 0.8) * 46)
                 for i in range(9)]
        body.append(park_band(spine, 260))
        for i, (x, y) in enumerate(spine):
            if i % 1 == 0:
                body.append('<path d="M%.0f %.0f l-26 64 M%.0f %.0f l26 64 M%.0f %.0f l0 -70" '
                            'stroke="%s" stroke-width="7" fill="none" opacity=".5"/>'
                            % (x, y - 70, x, y - 70, x, y - 70, INK_SOFT))
        route_pts = spine

    # ── a couple of parks and a rail line, for texture ───────────────────────
    # Parks go on LAND. On a waterfront map that means above the shoreline —
    # the first attempt scattered them freely and floated one in the lake.
    top = 300
    bottom = (trail["shore_y"] - 320) if kind == "waterfront" else H - 300
    for _ in range(trail.get("parks", 3)):
        px, py = rng.uniform(300, W - 300), rng.uniform(top, max(top + 1, bottom))
        body.append('<ellipse cx="%.0f" cy="%.0f" rx="%.0f" ry="%.0f" fill="%s" opacity=".8"/>'
                    % (px, py, rng.uniform(120, 250), rng.uniform(90, 190), PARK))
    ry = trail.get("rail_y", 700)
    body.append('<line x1="0" y1="%d" x2="%d" y2="%d" stroke="%s" stroke-width="11" '
                'stroke-dasharray="34 22" opacity=".7"/>' % (ry, W, ry + 60, RAIL))

    # ── waypoints, evenly-ish spread along the route ─────────────────────────
    stops = trail["stops"]
    marks, wp_svg = [], []
    for i, stop in enumerate(stops):
        t = stop[1]                       # (title, position, metres, caption[, kind])
        # sample the smooth route the same way the engine will
        fi = t * (len(route_pts) - 1)
        lo = int(math.floor(fi)); hi = min(lo + 1, len(route_pts) - 1); f = fi - lo
        x = route_pts[lo][0] + (route_pts[hi][0] - route_pts[lo][0]) * f
        y = route_pts[lo][1] + (route_pts[hi][1] - route_pts[lo][1]) * f
        ring = WISHFUL if trail.get("wishful") else ROUTE
        wp_svg.append('<circle id="wp-%d" cx="%.1f" cy="%.1f" r="9" fill="#fff" '
                      'stroke="%s" stroke-width="5"/>' % (i + 1, x, y, ring))
        marks.append((i + 1, x, y))

    place += labels(trail.get("places", []))

    svg = []
    svg.append('<svg xmlns="http://www.w3.org/2000/svg" width="%d" height="%d" '
               'viewBox="0 0 %d %d">' % (W, H, W, H))
    svg.append('<g id="background"><rect width="%d" height="%d" fill="%s"/></g>' % (W, H, PAPER))
    svg.append('<g id="topo">')
    svg.append('<g id="roads">' + "".join(street_grid(rng)) + "</g>")
    svg.append('<g id="water">' + "".join(body) + "</g>")
    svg.append('<g id="labels">' + "".join(place) + "</g>")
    svg.append("</g>")
    # the route itself is drawn faintly: the engine draws the live one on top
    line = WISHFUL if trail.get("wishful") else ROUTE
    svg.append('<path id="route" d="%s" fill="none" stroke="%s" stroke-width="10" '
               'stroke-linecap="round" opacity=".25"/>' % (rounded(route_pts), line))
    # the routes that do not exist yet — one group, which is what the Wishful
    # thinking switch shows and hides
    svg.append('<g id="wishful">' + "".join(wishful_routes(trail, route_pts)) + "</g>")
    svg.append('<g id="crossings">' + "".join(crossings(trail, route_pts)) + "</g>")
    svg.append('<g id="waypoints">' + "".join(wp_svg) + "</g>")
    svg.append("</svg>")
    return "".join(svg)

# ── WRITING THEM OUT ────────────────────────────────────────────────────────
# One drawing per trail, straight into maps/. This used to be done from a
# throwaway script, which meant the drawings on disk could not be rebuilt from
# what is in this repository — change a colour here and there was no single
# command that made it true. Now there is: run this file.
#
# The Beltline is not in this list. It is drawn by make_beltline.py, because a
# railpath does not look like a river, a shore or a hydro corridor and drawing
# it as one made it the odd page out.

def main():
    from trails_data import ALL_TRAILS
    out = paths.MAPS
    os.makedirs(out, exist_ok=True)
    for t in ALL_TRAILS:
        # A trail may say its drawing comes from somewhere else. The Beltline
        # does: a railpath runs straight and cuts across the grid, which is not
        # a river, a shore or a hydro corridor, and drawing it as one made it
        # the odd page out. make_beltline.py draws that one.
        if t.get("artwork"):
            print("  ", t["slug"].ljust(16), "drawn by make_%s.py — left alone"
                  % t["artwork"])
            continue
        art = build(t)
        io.open("%s/%s-map.svg" % (out, t["slug"]), "w", encoding="utf-8").write(art)
        print("  ", t["slug"].ljust(16), len(art) // 1024, "KB")


if __name__ == "__main__":
    main()
