#!/usr/bin/env python3
"""
Every icon on the site, drawn into one folder: icons/

WHY ONE FOLDER
  The legend's drawings lived in legend/ because at the time they were the only
  drawings there were. Now there are the cost coins and the priority gauges as
  well, and a site with legend/ and icons/ side by side makes anyone adding a
  third kind guess which one it belongs in. There is one answer now: icons/.
  The legend's files keep their names, so nothing about the legend changes
  except where it looks.

THE COST COINS — what a wishful thing would cost to build
  Canadian coins, because the reader knows them by sight and by value without
  a key: a penny is small change, a loonie is real money.

    low     the penny,   copper   — paint, a sign, a curb cut
    medium  the quarter, silver   — a signal, a short path, a ramp
    high    the loonie,  gold     — a bridge, a tunnel, land

  They are drawn as coins rather than as one coin repeated in three colours:
  the penny is smallest, the loonie largest and eleven-sided, so the three can
  be told apart in grey, at a glance, and by someone who cannot see colour.

THE PRIORITY GAUGES — how badly it is needed
  A dial with three zones. The needle points left into the green for low, up
  into the white for medium, right into the red for high, which is the same
  gesture every gauge in a car makes: right is more, and red is trouble.

  Colour again does not carry it alone. The needle's ANGLE is the reading, and
  a gauge at 8 o'clock is a different shape from one at 4 o'clock even in a
  black-and-white printout.

Each is drawn at 48x48 in a square viewBox so it scales to whatever the page
asks for, and each is a plain <svg> file with no script and no external
reference, so it can be dropped into an <img> or inlined without changing.
"""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import paths

import io, math, os, shutil

OUT = paths.ICONS
# the hand-drawn swatches are sources; they are copied to the site with
# the rest of static/, and this script only ADDS the drawn ones
SOURCE_ICONS = os.path.join(paths.STATIC, "icons")

# ── the coins ───────────────────────────────────────────────────────────────
# outer colour, inner colour, rim colour, radius, and how many sides the rim
# has: the loonie is an eleven-sided coin and that shape is most of how it is
# recognised, so it is drawn rather than smoothed away.
COINS = {
    "cost-low":    dict(name="penny",   r=17, sides=0,
                        face="#c8804a", edge="#8d4f24", shine="#e8a874"),
    "cost-medium": dict(name="quarter", r=20, sides=0,
                        face="#c9ccd2", edge="#8a8f98", shine="#eef1f5"),
    "cost-high":   dict(name="loonie",  r=22, sides=11,
                        face="#d9ab48", edge="#96701f", shine="#f2d489"),
}


def polygon(cx, cy, r, sides, turn=-math.pi / 2):
    pts = [(cx + math.cos(turn + i * math.tau / sides) * r,
            cy + math.sin(turn + i * math.tau / sides) * r)
           for i in range(sides)]
    return " ".join("%.2f,%.2f" % p for p in pts)


def coin(spec):
    cx = cy = 24.0
    r = spec["r"]
    if spec["sides"]:
        body = ('<polygon points="%s" fill="%s" stroke="%s" stroke-width="2" '
                'stroke-linejoin="round"/>' % (polygon(cx, cy, r, spec["sides"]),
                                               spec["face"], spec["edge"]))
        inner = ('<polygon points="%s" fill="none" stroke="%s" stroke-width="1.2" '
                 'opacity=".55" stroke-linejoin="round"/>'
                 % (polygon(cx, cy, r - 4.5, spec["sides"]), spec["edge"]))
    else:
        body = ('<circle cx="%s" cy="%s" r="%s" fill="%s" stroke="%s" '
                'stroke-width="2"/>' % (cx, cy, r, spec["face"], spec["edge"]))
        inner = ('<circle cx="%s" cy="%s" r="%s" fill="none" stroke="%s" '
                 'stroke-width="1.2" opacity=".55"/>'
                 % (cx, cy, r - 4.5, spec["edge"]))
    # a highlight up the top-left, which is what makes a flat disc read as metal
    shine = ('<path d="M%.1f %.1f A %.1f %.1f 0 0 1 %.1f %.1f" fill="none" '
             'stroke="%s" stroke-width="2.6" stroke-linecap="round" opacity=".75"/>'
             % (cx - r * 0.62, cy - r * 0.42, r * 0.78, r * 0.78,
                cx + r * 0.12, cy - r * 0.72, spec["shine"]))
    return ('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" '
            'width="48" height="48" role="img" aria-label="%s">'
            '<title>%s</title>%s%s%s</svg>'
            % (spec["name"], spec["name"], body, inner, shine))


# ── the gauges ──────────────────────────────────────────────────────────────
# The dial is a 180° arc across the top. It is cut into three: green on the
# left, a pale band in the middle, red on the right, and the needle points into
# whichever one the reading is.
GAUGE_ANGLE = {"low": 150, "medium": 90, "high": 30}   # degrees, 180 = left
ZONES = [(180, 132, "#4ecf4e"), (132, 48, "#e6e2d8"), (48, 0, "#e8503a")]


def arc(cx, cy, r, a0, a1):
    """A path along the dial from angle a0 to a1, measured the way a protractor
    is: 180° at the left, 0° at the right."""
    x0, y0 = cx + math.cos(math.radians(a0)) * r, cy - math.sin(math.radians(a0)) * r
    x1, y1 = cx + math.cos(math.radians(a1)) * r, cy - math.sin(math.radians(a1)) * r
    return "M%.2f %.2f A %.1f %.1f 0 0 1 %.2f %.2f" % (x0, y0, r, r, x1, y1)


def gauge(level):
    cx, cy, r = 24.0, 31.0, 17.0
    parts = ['<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" '
             'width="48" height="48" role="img" aria-label="%s priority">'
             '<title>%s priority</title>' % (level, level)]
    for a0, a1, colour in ZONES:
        parts.append('<path d="%s" fill="none" stroke="%s" stroke-width="6" '
                     'stroke-linecap="butt"/>' % (arc(cx, cy, r, a0, a1), colour))
    # the needle. Its angle IS the reading — the colour under it only agrees.
    a = math.radians(GAUGE_ANGLE[level])
    nx, ny = cx + math.cos(a) * (r - 2.5), cy - math.sin(a) * (r - 2.5)
    parts.append('<line x1="%.2f" y1="%.2f" x2="%.2f" y2="%.2f" stroke="#f2f0ea" '
                 'stroke-width="2.6" stroke-linecap="round"/>' % (cx, cy, nx, ny))
    parts.append('<circle cx="%s" cy="%s" r="3.4" fill="#f2f0ea"/>' % (cx, cy))
    parts.append('<circle cx="%s" cy="%s" r="1.5" fill="#1d2124"/>' % (cx, cy))
    parts.append("</svg>")
    return "".join(parts)


def main():
    os.makedirs(OUT, exist_ok=True)

    # the hand-drawn swatches, copied in first so that a generated icon with
    # the same name would win — which is the right way round, since a generated
    # one is the one this script is responsible for
    kept = 0
    if os.path.isdir(SOURCE_ICONS):
        for f in sorted(os.listdir(SOURCE_ICONS)):
            if f.endswith(".svg"):
                shutil.copy2(os.path.join(SOURCE_ICONS, f), os.path.join(OUT, f))
                kept += 1
    print("   hand-drawn swatches:", kept)

    for key, spec in COINS.items():
        io.open("%s/%s.svg" % (OUT, key), "w", encoding="utf-8").write(coin(spec))
        print("   %-16s %s" % (key + ".svg", spec["name"]))
    for level in ("low", "medium", "high"):
        io.open("%s/priority-%s.svg" % (OUT, level), "w", encoding="utf-8").write(gauge(level))
        print("   %-16s needle at %d°" % ("priority-%s.svg" % level, GAUGE_ANGLE[level]))


main()
