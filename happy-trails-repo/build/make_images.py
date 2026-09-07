#!/usr/bin/env python3
"""
A picture per trail — drawn as a PHOTOGRAPH TAKEN ON IT, not a crop of its map.

WHY THIS CHANGED
  These used to be crops of each trail's own drawing. That was tidy and it was
  wrong: the picture sat directly above a card whose whole subject is the map,
  and beside a page that opens with the map itself. Showing the map a third
  time told the reader nothing new. What the card is actually for is the thing
  the map cannot say — what it is LIKE to be there — so the picture is now a
  view along the trail from about eye height, the photograph that will one day
  replace it.

  They are still drawings, and they are meant to be replaced. But they are
  drawings in the right idiom, which is the whole point: a placeholder in the
  wrong idiom makes the layout impossible to judge.

WHERE THEY ARE USED — exactly two places, and nowhere else:
  · the card for that trail on trails.html
  · behind the opening card on that trail's own page, under a black veil
  The link previews in social/ are made separately by make_social.py, and the
  maps are their own files in maps/. Nothing else reads this folder.

HOW EACH ONE IS BUILT
  Every picture is the same scene assembled from the same parts — sky, haze,
  a treeline at the horizon, ground, a path running away from the camera,
  planting either side, shadows across the path, a vignette — with the parts
  swapped to suit what kind of trail it is:

    river       a ravine: dense canopy both sides, water glinting through
    waterfront  the lake on one side, a wide sky, low planting
    corridor    open mown grass under transmission towers, biggest sky
    railpath    a straight cut, gravel shoulder, fence and rails alongside

  A WISHFUL TRAIL HAS NO PATH. That is what makes it wishful, so its picture
  shows the same valley with a worn desire line through the grass where a trail
  would go, and no asphalt. It is the most honest thing the picture can say.

  Everything is placed from random.Random(seed) with the trail's own seed — the
  same seed that drew its map — so a trail's picture never changes between runs
  and no two trails get the same one.
"""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import paths
import io, math, os, random, sys
import cairosvg

from trails_data import ALL_TRAILS

# TWO FOLDERS, because the two sets of pictures answer different questions.
#   trail link images/    what a trail is like        — one per trail
#   wishful link images/  what is missing, and where  — one per wishful stop
# The names carry spaces because that is what they were asked to be called; in
# a URL those become %20, which every reference in the site writes out.
OUT       = paths.TRAIL_PIX
OUT_WISH  = paths.WISH_PIX
os.makedirs(OUT, exist_ok=True)
os.makedirs(OUT_WISH, exist_ok=True)

W, H = 1000, 560          # the shape of the card, and of the opening panel
HZ   = 250                # the horizon. Everything above is sky.


# ── small helpers ───────────────────────────────────────────────────────────

def px(v):
    return "%.1f" % v


def rgb(r, g, b):
    return "#%02x%02x%02x" % (max(0, min(255, int(r))),
                              max(0, min(255, int(g))),
                              max(0, min(255, int(b))))


def mix(c1, c2, t):
    """Between two (r,g,b) triples. Used for aerial perspective: everything far
    away is mixed towards the haze colour, which is what makes distance read."""
    return tuple(a + (b - a) * t for a, b in zip(c1, c2))


def blob(rng, cx, cy, r, colour, n=9, squash=0.8, op=1.0):
    """A mass of foliage: overlapping circles rather than one shape, because a
    single ellipse reads as a balloon and a cluster reads as leaves."""
    out = []
    for _ in range(n):
        a = rng.uniform(0, math.tau)
        d = rng.uniform(0, r * 0.55)
        rr = rng.uniform(r * 0.42, r * 0.78)
        out.append('<ellipse cx="%s" cy="%s" rx="%s" ry="%s" fill="%s" opacity="%.2f"/>'
                   % (px(cx + math.cos(a) * d), px(cy + math.sin(a) * d * squash),
                      px(rr), px(rr * squash), colour, op))
    return "".join(out)


# ── the scene ───────────────────────────────────────────────────────────────

def photograph(seed, kind, wishful=False, ghost=False, gap=None):
    rng = random.Random(seed)

    # WHERE THE PATH GOES. The vanishing point moves a little from picture to
    # picture, and the path bends towards it, so no two views line up.
    vp = rng.uniform(W * 0.36, W * 0.64)
    bend = rng.uniform(-90, 90)
    warm = rng.uniform(-0.12, 0.14)          # colour temperature of the light
    sunx = rng.uniform(W * 0.12, W * 0.88)

    HAZE = (206, 216, 214)
    parts = []
    d = parts.append

    # ── SKY ────────────────────────────────────────────────────────────────
    top = mix((116, 158, 190), (150, 150, 150), 0.25 if ghost else 0.0)
    d('<defs>')
    d('<linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">'
      '<stop offset="0" stop-color="%s"/>'
      '<stop offset="1" stop-color="%s"/></linearGradient>'
      % (rgb(*mix(top, (255, 240, 220), max(0.0, warm))), rgb(*HAZE)))
    d('<radialGradient id="sun" cx="%.3f" cy="0.42" r="0.55">'
      '<stop offset="0" stop-color="#fff6dd" stop-opacity=".85"/>'
      '<stop offset="1" stop-color="#fff6dd" stop-opacity="0"/></radialGradient>'
      % (sunx / W))
    # the corners of a photograph are always a little darker than its middle
    d('<radialGradient id="vig" cx="0.5" cy="0.5" r="0.78">'
      '<stop offset="0.55" stop-color="#000" stop-opacity="0"/>'
      '<stop offset="1" stop-color="#000" stop-opacity=".34"/></radialGradient>')
    d('</defs>')
    d('<rect width="%d" height="%d" fill="url(#sky)"/>' % (W, HZ + 10))
    d('<rect width="%d" height="%d" fill="url(#sun)"/>' % (W, HZ + 10))

    # a few clouds, flat-bottomed the way fair-weather cloud is
    for _ in range(rng.randint(2, 4)):
        cx, cy = rng.uniform(0, W), rng.uniform(24, 120)
        d(blob(rng, cx, cy, rng.uniform(46, 96), "#ffffff", n=7, squash=0.42,
               op=rng.uniform(0.32, 0.6)))

    # ── GROUND ─────────────────────────────────────────────────────────────
    grass_far = mix((150, 168, 128), HAZE, 0.55)
    grass_near = mix((70, 100, 48), (120, 120, 108), 0.55 if ghost else 0.0)
    grass_near = mix(grass_near, (150, 140, 90), max(0.0, warm))
    d('<defs><linearGradient id="gr" x1="0" y1="0" x2="0" y2="1">'
      '<stop offset="0" stop-color="%s"/><stop offset="1" stop-color="%s"/>'
      '</linearGradient></defs>' % (rgb(*grass_far), rgb(*grass_near)))
    d('<rect y="%d" width="%d" height="%d" fill="url(#gr)"/>' % (HZ, W, H - HZ))

    # ── WHAT IS AT THE HORIZON, which is what says where we are ────────────
    if kind == "waterfront":
        # the lake fills one side, with the far shore as a thin dark line
        # THE SHORE RECEDES. Drawn as a rectangle the water met the grass in a
        # straight vertical line, which is a line no shore has ever made; it
        # has to run away towards the same vanishing point everything else does.
        near_x, far_x = W * 1.35, vp + 26
        d('<path d="M%s %s L%s %s L%s %s L%s %s Z" fill="%s" opacity=".95"/>'
          % (px(far_x), HZ - 2, px(W + 60), HZ - 2, px(W + 60), px(H + 4),
             px(near_x), px(H + 4), rgb(*mix((118, 152, 168), HAZE, 0.3))))
        d('<path d="M%s %s L%s %s" stroke="%s" stroke-width="3" opacity=".5"/>'
          % (px(far_x), px(HZ - 1), px(near_x), px(H + 4),
             rgb(*mix((70, 96, 88), HAZE, 0.4))))
        d('<rect x="%s" y="%d" width="%s" height="3" fill="%s" opacity=".5"/>'
          % (px(far_x), HZ - 5, px(W + 60 - far_x), rgb(*mix((70, 96, 88), HAZE, 0.55))))
        for _ in range(rng.randint(7, 12)):     # glare, in bands along the water
            t = rng.random()
            gy = HZ + (H - HZ) * t ** 1.5
            edge = far_x + (near_x - far_x) * t ** 1.5
            gx = rng.uniform(edge + 10, W + 40)
            d('<rect x="%s" y="%s" width="%s" height="%s" fill="#ffffff" opacity="%.2f"/>'
              % (px(gx), px(gy), px(rng.uniform(14, 70) * (0.3 + t)),
                 px(1.5 + 2.5 * t), rng.uniform(0.14, 0.42)))
    else:
        # a treeline, hazy with distance
        far = rgb(*mix((74, 104, 70), HAZE, 0.62))
        for x in range(-40, W + 60, 34):
            d(blob(rng, x, HZ - rng.uniform(4, 30), rng.uniform(26, 54), far,
                   n=4, squash=0.7, op=0.9))

    if kind == "corridor":
        # transmission towers, getting smaller and paler as they recede
        for i in range(5):
            t = i / 4.0
            tx = vp + (rng.uniform(-40, 40) + (W * 0.42 - vp)) * (1 - t) ** 0.7
            base = HZ + (H - HZ - 30) * (1 - t) ** 2.1
            hgt = 40 + 210 * (1 - t) ** 2.0
            col = rgb(*mix((92, 96, 92), HAZE, 0.18 + 0.62 * t))
            wdt = max(0.8, 3.4 * (1 - t) ** 1.3)
            d('<path d="M%s %s L%s %s M%s %s L%s %s M%s %s L%s %s" '
              'stroke="%s" stroke-width="%s" fill="none" opacity=".85"/>'
              % (px(tx - hgt * 0.16), px(base), px(tx), px(base - hgt),
                 px(tx + hgt * 0.16), px(base), px(tx), px(base - hgt),
                 px(tx - hgt * 0.22), px(base - hgt * 0.72),
                 px(tx + hgt * 0.22), px(base - hgt * 0.72), col, px(wdt)))

    if kind == "railpath":
        # the working railway this trail was cut beside, and the fence between
        side = 1 if rng.random() < 0.5 else -1
        for lane in (0.22, 0.30):
            d('<path d="M%s %s Q%s %s %s %s" stroke="%s" stroke-width="3" '
              'fill="none" opacity=".7"/>'
              % (px(vp + side * 26), px(HZ + 2), px(vp + side * 150), px(HZ + 130),
                 px(vp + side * (W * lane * 4)), px(H), rgb(140, 132, 118)))
        d('<path d="M%s %s L%s %s" stroke="%s" stroke-width="2.2" fill="none" '
          'opacity=".55" stroke-dasharray="3 9"/>'
          % (px(vp + side * 14), px(HZ), px(vp + side * W * 0.9), px(H),
             rgb(120, 124, 120)))

    # ── THE PATH ───────────────────────────────────────────────────────────
    # Drawn in perspective: a sliver at the vanishing point widening to most of
    # the frame at the reader's feet, with both edges bending the same way.
    half_far, half_near = 5.0, W * 0.30
    cx_far, cx_near = vp, vp + bend
    ctl = (vp + bend * 0.15, HZ + (H - HZ) * 0.45)
    left = ("M%s %s Q%s %s %s %s"
            % (px(cx_far - half_far), px(HZ + 2), px(ctl[0] - half_near * 0.42),
               px(ctl[1]), px(cx_near - half_near), px(H + 4)))
    right = ("L%s %s Q%s %s %s %s Z"
             % (px(cx_near + half_near), px(H + 4), px(ctl[0] + half_near * 0.42),
                px(ctl[1]), px(cx_far + half_far), px(HZ + 2)))

    # The path's outline, kept as a clip so that anything drawn ON the path —
    # the shadows, chiefly — stops at its edge. Without this the shadows ran out
    # into the grass as full-width bars and read as concrete steps, which is a
    # good illustration of how little it takes to stop a picture looking like a
    # photograph.
    d('<defs><clipPath id="road"><path d="%s %s"/></clipPath></defs>' % (left, right))

    if wishful:
        # NO TRAIL HERE. A desire line: bare earth worn through the grass by the
        # people who already walk it, narrower and softer-edged than asphalt.
        d('<defs><linearGradient id="dirt" x1="0" y1="0" x2="0" y2="1">'
          '<stop offset="0" stop-color="%s"/><stop offset="1" stop-color="%s"/>'
          '</linearGradient></defs>'
          % (rgb(*mix((150, 136, 108), HAZE, 0.5)), rgb(138, 120, 92)))
        narrow = left.replace("M%s" % px(cx_far - half_far), "M%s" % px(cx_far - 3))
        d('<path d="%s %s" fill="url(#dirt)" opacity=".92" transform="translate(0,0)"/>'
          % (narrow, right))
        # grass encroaching from both sides, because nobody maintains it
        for _ in range(26):
            t = rng.random()
            y = HZ + (H - HZ) * t ** 1.6
            hw = half_far + (half_near - half_far) * t ** 1.7
            cxx = cx_far + bend * t ** 1.7
            s = rng.choice([-1, 1])
            d('<ellipse cx="%s" cy="%s" rx="%s" ry="%s" fill="%s" opacity=".55"/>'
              % (px(cxx + s * hw * rng.uniform(0.7, 1.0)), px(y),
                 px(4 + 26 * t), px(2 + 9 * t), rgb(*mix(grass_near, (60, 84, 44), 0.4))))
    else:
        surface = (96, 96, 96) if kind != "corridor" else (128, 120, 104)
        if kind == "railpath":
            surface = (120, 112, 100)
        d('<defs><linearGradient id="pav" x1="0" y1="0" x2="0" y2="1">'
          '<stop offset="0" stop-color="%s"/><stop offset="1" stop-color="%s"/>'
          '</linearGradient></defs>'
          % (rgb(*mix(surface, HAZE, 0.55)), rgb(*surface)))
        d('<path d="%s %s" fill="url(#pav)"/>' % (left, right))
        # the painted centre line, dashed and foreshortened
        for i in range(16):
            t = (i / 16.0) ** 1.9
            t2 = ((i + 0.45) / 16.0) ** 1.9
            y1, y2 = HZ + (H - HZ) * t, HZ + (H - HZ) * t2
            wdt = 1 + 7 * t
            d('<line x1="%s" y1="%s" x2="%s" y2="%s" stroke="#e8dfb4" '
              'stroke-width="%s" opacity=".5"/>'
              % (px(cx_far + bend * t ** 1.7), px(y1),
                 px(cx_far + bend * t2 ** 1.7), px(y2), px(wdt)))

    # ── PLANTING EITHER SIDE ───────────────────────────────────────────────
    # Nearer means bigger, darker and greener — that contrast against the hazy
    # treeline is what gives the picture depth.
    density = {"river": 13, "waterfront": 5, "corridor": 4, "railpath": 7}[kind]
    for i in range(density):
        t = (i + 0.6) / density
        side = -1 if i % 2 == 0 else 1
        if kind == "waterfront" and side > 0:
            continue           # the other side is the lake
        y = HZ + (H - HZ) * t ** 1.5
        hw = half_far + (half_near - half_far) * t ** 1.7
        x = cx_far + bend * t ** 1.7 + side * (hw + 30 + 210 * t)
        r = 26 + 160 * t
        # every tree is a slightly different green and a slightly different
        # weight. Identical foliage is the thing that makes drawn scenery look
        # drawn, and it costs nothing to vary.
        base = (58 + rng.uniform(-16, 22), 92 + rng.uniform(-22, 26),
                48 + rng.uniform(-14, 30))
        col = rgb(*mix(mix(base, HAZE, max(0.0, 0.5 - t * 0.55)),
                       (120, 120, 116), 0.5 if ghost else 0.0))
        d(blob(rng, x, y - r * 0.55, r, col, n=8, squash=rng.uniform(0.74, 0.96),
               op=0.95))
        # the shaded underside of the SAME canopy — its own green taken down,
        # sitting low and central. Offset, or given a colour of its own, it
        # stopped being shade and became a second tree standing behind the first.
        d(blob(rng, x, y - r * 0.34, r * 0.52,
               rgb(*mix(base, (22, 40, 20), 0.6)), n=4, squash=0.62, op=0.20))
        # and what the tree casts on the ground, which is what stops it hovering
        d('<ellipse cx="%s" cy="%s" rx="%s" ry="%s" fill="#1b2a16" opacity=".16"/>'
          % (px(x + r * 0.25), px(y + r * 0.06), px(r * 0.8), px(r * 0.16)))
        if t > 0.35:                                     # a trunk, once close
            d('<rect x="%s" y="%s" width="%s" height="%s" fill="%s" opacity=".8"/>'
              % (px(x - 4 - 7 * t), px(y - r * 0.2), px(8 + 14 * t), px(r * 0.55),
                 rgb(*mix((62, 48, 36), HAZE, max(0.0, 0.4 - t)))))

    # a canopy over the top of the frame, which is what standing under trees
    # actually looks like and what stops the sky from dominating
    if kind in ("river", "railpath"):
        dark = rgb(*mix((34, 56, 30), (110, 110, 110), 0.45 if ghost else 0.0))
        for cx in (rng.uniform(-40, 120), rng.uniform(W - 120, W + 40)):
            d(blob(rng, cx, rng.uniform(-70, -10), rng.uniform(150, 230), dark,
                   n=10, squash=0.8, op=0.92))

    # ── SHADOWS ACROSS THE PATH ────────────────────────────────────────────
    # Dappled light is the single strongest cue that a picture is a photograph
    # of somewhere and not a diagram of it.
    d('<g clip-path="url(#road)">')
    for _ in range(rng.randint(5, 8)):
        t = rng.uniform(0.05, 1.05)
        y = HZ + (H - HZ) * t ** 1.5
        # a shadow falls across the path at an angle and its two ends are not
        # level, so it is a parallelogram leaning one way, not a bar
        lean = rng.uniform(30, 120) * (1 if rng.random() < 0.5 else -1) * (0.25 + t)
        thick = 6 + 54 * t * rng.uniform(0.5, 1.3)
        d('<path d="M%s %s L%s %s L%s %s L%s %s Z" fill="#1b2a16" opacity="%.2f"/>'
          % (px(-W), px(y), px(W * 2), px(y + lean),
             px(W * 2), px(y + lean + thick), px(-W), px(y + thick),
             rng.uniform(0.07, 0.16)))
    # and the very edge of a path is always darker than its middle
    d('<path d="%s %s" fill="none" stroke="#20301a" stroke-width="26" '
      'opacity=".18"/>' % (left, right))
    d('</g>')
    # the verge: paths are not cut out of the grass with scissors, and a hard
    # edge is the other thing that says "diagram" rather than "photograph"
    d('<path d="%s %s" fill="none" stroke="%s" stroke-width="7" opacity=".45"/>'
      % (left, right, rgb(126, 118, 86)))

    # ── WHAT IS IN THE WAY ─────────────────────────────────────────────────
    # A wishful stop is a place where the trail STOPS, and the picture has to
    # show the thing that stops it. Each is drawn across the frame at a fixed
    # depth, over the path and under the near planting, so the path visibly
    # runs into it rather than past it.
    if gap:
        gy = HZ + (H - HZ) * 0.34               # how far away the obstacle is
        ghw = half_far + (half_near - half_far) * 0.34 ** 1.7
        gcx = cx_far + bend * 0.34 ** 1.7

        if gap == "crossing":
            # a road across the path, and no way marked over it
            d('<path d="M-20 %s L%s %s L%s %s L-20 %s Z" fill="#4c4c50"/>'
              % (px(gy - 26), px(W + 20), px(gy - 34), px(W + 20), px(gy + 62),
                 px(gy + 44)))
            for i in range(9):                  # the centre line of the road
                x = -20 + i * (W + 40) / 9.0
                d('<rect x="%s" y="%s" width="46" height="5" fill="#e8dfb4" '
                  'opacity=".8"/>' % (px(x), px(gy + 6 - i * 0.8)))
            # the kerb the path arrives at, which is where it ends
            d('<rect x="%s" y="%s" width="%s" height="7" fill="#b9b3a4"/>'
              % (px(gcx - ghw - 8), px(gy + 38), px(ghw * 2 + 16)))

        elif gap == "under-rail":
            # an embankment with a rail line on it, and one dark opening
            d('<path d="M-20 %s L%s %s L%s %s L-20 %s Z" fill="#6d6353"/>'
              % (px(gy - 96), px(W + 20), px(gy - 104), px(W + 20), px(gy + 40),
                 px(gy + 48)))
            d('<rect x="-20" y="%s" width="%s" height="9" fill="#4a4238"/>'
              % (px(gy - 104), W + 40))
            for i in range(14):                 # sleepers along the top
                d('<rect x="%s" y="%s" width="30" height="7" fill="#3a342c" '
                  'opacity=".7"/>' % (px(-20 + i * (W + 40) / 14.0), px(gy - 112)))
            d('<path d="M%s %s L%s %s A %s %s 0 0 1 %s %s L%s %s Z" fill="#15161a"/>'
              % (px(gcx - ghw * 1.25), px(gy + 44), px(gcx - ghw * 1.25), px(gy - 26),
                 px(ghw * 1.25), px(ghw * 1.25), px(gcx + ghw * 1.25), px(gy - 26),
                 px(gcx + ghw * 1.25), px(gy + 44)))

        elif gap == "bridge":
            # a truss standing over a valley, with no deck to walk on
            top, bot = gy - 96, gy + 42
            d('<rect x="-20" y="%s" width="%s" height="10" fill="#7a6f5e"/>'
              % (px(bot), W + 40))
            for x0 in (60.0, W - 160.0):        # the two piers
                d('<rect x="%s" y="%s" width="26" height="%s" fill="#8a7f6c"/>'
                  % (px(x0), px(top), px(bot - top)))
            d('<rect x="60" y="%s" width="%s" height="12" fill="#8a7f6c"/>'
              % (px(top), px(W - 220)))
            for i in range(11):                 # the diagonals of the truss
                x = 60 + i * (W - 220) / 11.0
                d('<path d="M%s %s L%s %s" stroke="#8a7f6c" stroke-width="7" '
                  'fill="none"/>' % (px(x), px(bot), px(x + (W - 220) / 11.0), px(top)))
            # the deck: a few planks left, and a lot of sky between them
            for i in range(7):
                x = 70 + i * (W - 240) / 7.0
                if i in (2, 4):
                    continue                    # the missing ones
                d('<rect x="%s" y="%s" width="%s" height="9" fill="#6a6053"/>'
                  % (px(x), px(bot - 16), px((W - 240) / 8.0)))

        elif gap == "underpass":
            # A HIGHWAY OVERHEAD, and a dark mouth under it that the path runs
            # into. The mouth reaches down to the path's own surface at this
            # depth — held above it, it read as a hole in the sky rather than
            # somewhere you ride.
            deck = gy + 30                       # where the underside sits
            # THE DECK IS A DECK, not a wall. At 150px deep it filled the frame
            # and the picture became a slab of concrete with a hole in it; a
            # highway seen from underneath is a thin edge with sky above it.
            d('<rect x="-20" y="%s" width="%s" height="52" fill="#5d5952"/>'
              % (px(deck - 96), W + 40))
            d('<rect x="-20" y="%s" width="%s" height="7" fill="#7d786f"/>'
              % (px(deck - 96), W + 40))
            d('<rect x="-20" y="%s" width="%s" height="16" fill="#403c37"/>'
              % (px(deck - 16), W + 40))
            # the abutments either side, which is what makes it a bridge deck
            for x0 in (-20.0, gcx + ghw * 1.9):
                wdt = (gcx - ghw * 1.9) + 20 if x0 < 0 else W + 20 - x0
                d('<rect x="%s" y="%s" width="%s" height="%s" fill="#6b6660"/>'
                  % (px(x0), px(deck - 44), px(max(0, wdt)), px(44)))
            # the opening, and the deeper dark inside it
            d('<rect x="%s" y="%s" width="%s" height="%s" fill="#0e1014"/>'
              % (px(gcx - ghw * 1.9), px(deck - 44), px(ghw * 3.8), px(44)))
            d('<rect x="%s" y="%s" width="%s" height="%s" fill="#05070a"/>'
              % (px(gcx - ghw * 1.25), px(deck - 34), px(ghw * 2.5), px(34)))

        elif gap == "squeeze":
            # A WALL ONE SIDE, WATER THE OTHER, and not enough room between.
            # The wall is the point of this picture, so it is drawn as a solid
            # mass running the full depth of the frame rather than as a sliver
            # beside the path — a retaining wall you cannot get round, which is
            # exactly what a pinch point is.
            side = -1                            # the wall is always on the left
            wall_top = gy - 150
            d('<path d="M%s %s L%s %s L%s %s L%s %s Z" fill="#9a9184"/>'
              % (px(gcx - ghw * 0.9), px(wall_top), px(-40), px(-40),
                 px(-40), px(H + 4), px(gcx - ghw * 1.15), px(H + 4)))
            # its coping, and the joints down its face
            d('<path d="M%s %s L%s %s" stroke="#6f685c" stroke-width="7" '
              'fill="none"/>' % (px(gcx - ghw * 0.9), px(wall_top), px(-40), px(-40)))
            for k in range(1, 5):
                t2 = k / 5.0
                d('<path d="M%s %s L%s %s" stroke="#847b6d" stroke-width="3" '
                  'opacity=".7" fill="none"/>'
                  % (px(gcx - ghw * (0.9 + 0.25 * t2)), px(wall_top + (H - wall_top) * t2),
                     px(-40), px(-40 + (H + 44) * t2 * 0.85)))
            # and the water, filling everything to the right of the path
            d('<path d="M%s %s L%s %s L%s %s L%s %s Z" fill="#7fa3b4" '
              'opacity=".95"/>'
              % (px(gcx + ghw * 1.05), px(gy - 60), px(W + 40), px(gy - 60),
                 px(W + 40), px(H + 4), px(gcx + ghw * 2.4), px(H + 4)))
            d('<path d="M%s %s L%s %s" stroke="#54798c" stroke-width="4" '
              'fill="none"/>' % (px(gcx + ghw * 1.05), px(gy - 58),
                                 px(gcx + ghw * 2.4), px(H + 4)))

        elif gap == "ends":
            # nothing is in the way; the path simply stops being a path
            d('<path d="M%s %s L%s %s L%s %s L%s %s Z" fill="url(#gr)"/>'
              % (px(-20), px(gy), px(W + 20), px(gy),
                 px(W + 20), px(gy + 8), px(-20), px(gy + 8)))
            d('<rect x="-20" y="%s" width="%s" height="%s" fill="url(#gr)"/>'
              % (px(gy), W + 40, px(H - gy)))
            # the last of the asphalt, crumbling into the grass
            for i in range(22):
                t = rng.random()
                d('<ellipse cx="%s" cy="%s" rx="%s" ry="%s" fill="%s" '
                  'opacity="%.2f"/>'
                  % (px(gcx + rng.uniform(-ghw, ghw)), px(gy + rng.uniform(0, 34)),
                     px(rng.uniform(6, 22)), px(rng.uniform(3, 8)),
                     rgb(*mix((96, 96, 96), grass_near, rng.random())),
                     rng.uniform(0.3, 0.75)))

    # ── THE LENS ───────────────────────────────────────────────────────────
    d('<rect width="%d" height="%d" fill="url(#vig)"/>' % (W, H))
    if ghost:
        d('<rect width="%d" height="%d" fill="#cfcdc4" opacity=".38"/>' % (W, H))

    return ('<svg xmlns="http://www.w3.org/2000/svg" width="%d" height="%d" '
            'viewBox="0 0 %d %d">%s</svg>' % (W, H, W, H, "".join(parts)))


def write(slug, seed, kind, wishful=False, ghost=False, gap=None, folder=None):
    svg = photograph(seed, kind, wishful, ghost, gap)
    out = "%s/%s.png" % (folder or OUT, slug)
    cairosvg.svg2png(bytestring=svg.encode("utf-8"), write_to=out,
                     output_width=W, output_height=H)
    print("  ", (slug + ".png").ljust(24), (gap or kind).ljust(11),
          os.path.getsize(out) // 1024, "KB")


# ── WHAT IS IN THE WAY, at each of the twelve wishful stops ────────────────
# The picture for a wishful stop has one job the trail pictures do not: to show
# WHY it stops. So each names the thing that interrupts it, and the drawing is
# chosen from that rather than from the kind of trail it is on. The slug is the
# same one the engine makes from the stop's title, which is also the name in
# the URL — so a stop, its picture and its link all agree without a third list
# to keep in step.
GAPS = [
    # slug                  seed  scene        what stops the trail
    ("eglinton-gap",        211, "river",      "crossing"),
    ("albion-road",         223, "river",      "crossing"),
    ("rockcliffe-gap",      227, "river",      "under-rail"),
    ("jane-street",         229, "corridor",   "crossing"),
    ("gardiner-squeeze",    233, "waterfront", "squeeze"),
    ("half-mile-bridge",    239, "river",      "bridge"),
    ("sheppard-gap",        241, "river",      "ends"),
    ("kennedy-gap",         251, "corridor",   "ends"),
    ("highway-401",         257, "river",      "underpass"),
    ("missing-crosswalk",   263, "railpath",   "crossing"),
    ("old-park-crossing",   269, "railpath",   "crossing"),
    ("moore-crossing",      271, "railpath",   "under-rail"),
]


def main():
    print("  trail link images/")
    for t in ALL_TRAILS:
        write(t["slug"], t["seed"], t["kind"], bool(t.get("wishful")))
    # And the tile for a trail with no page yet: the same view, drained of
    # colour and with no path in it, so it reads as "not yet" beside the others.
    write("soon", 3, "corridor", wishful=True, ghost=True)

    print("  wishful link images/")
    for slug, seed, kind, gap in GAPS:
        write(slug, seed, kind, gap=gap, folder=OUT_WISH)


main()
