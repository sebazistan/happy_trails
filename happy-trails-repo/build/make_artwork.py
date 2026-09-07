#!/usr/bin/env python3
"""
Illustrator to maps/.

WHAT THIS IS FOR
  The maps are drawn by hand, in Illustrator, and the positions of the
  waypoints are set by eye there — a small circle named wp-something, dropped
  where the stop belongs. That is the whole point of the arrangement: nobody
  should be typing coordinates. This script is what carries that from the .ai
  file to the site, so that pushing a redrawn map is all it takes.

WHAT YOU PUT IN artwork/
  happy-trails.ai        the main map. Or happy-trails.svg — see below.
  trails/<slug>.ai       a trail's own map, if you have drawn one
  layer-order.json       which layer sits on top of which, in the main map
  pin-nudges.json        hand corrections to route-button positions

  <slug> is the trail's slug in trails_data.py — don.ai becomes the Lower Don's
  map. A trail with no file here keeps the drawn placeholder that make_trails.py
  produces, so the two can be mixed and the site is never missing a map.

.AI OR .SVG — EITHER, AND .SVG WINS
  An .ai file is a PDF underneath, and each Illustrator layer is an optional
  content group inside it, which is how the layers come out separately and
  keep their registration. That works, and it depends on "Create PDF
  Compatible File" being ticked when the file was saved, which is the default
  and is easy to turn off by accident.

  So if a .svg of the same name is present it is used instead and no conversion
  happens. Exporting SVG from Illustrator (File ▸ Export ▸ Export As ▸ SVG,
  with "Styling: Presentation Attributes" and "Object IDs: Layer Names") is the
  more predictable path, and it is the one to fall back on if a converted .ai
  ever comes out wrong.

WHAT COMES OUT
  maps/happy-trails-map.svg    the main map, layers merged in order
  maps/<slug>-map.svg          one per trail that has artwork
  artwork/pins.json            where each route's button sits on the main map,
                               measured rather than guessed

WHAT NAMES MATTER, inside the drawing
  route          the path a trail page walks. One per trail map.
  wp-<name>      a small circle per stop. The page snaps the stop onto the
                 nearest point of the route, so it does not have to be exactly
                 on the line — near it is enough.
  link-<n>       a small circle where this trail meets another
  <trail slug>   on the main map, the layer holding that route's highlight
  wishful-<slug> the same, for a trail that does not exist yet
"""

import io, json, os, re, shutil, subprocess, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import paths


def slugify(name):
    """An Illustrator layer name as a file name. The leading "12 " that
    Illustrator adds to keep layers ordered is dropped."""
    name = re.sub(r"^\d+\s+", "", str(name).strip())
    return re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")


# ── .ai → one SVG per layer ────────────────────────────────────────────────

def layers_from_ai(ai_path, into):
    """Render every Illustrator layer to its own SVG, all sharing one page box
    so that they stay in register when they are stacked back up."""
    import pikepdf
    os.makedirs(into, exist_ok=True)
    made = []
    with pikepdf.open(ai_path) as probe:
        if "/OCProperties" not in probe.Root:
            raise SystemExit(
                "%s has no layers in it.\n"
                "  Illustrator only writes them into the PDF half of an .ai "
                "file when\n  'Create PDF Compatible File' is ticked in the "
                "save dialog. Either\n  re-save it with that on, or export an "
                ".svg beside it — this script\n  prefers the .svg when there "
                "is one." % os.path.basename(ai_path))
        names = [(o.objgen, str(o.Name)) for o in probe.Root.OCProperties.OCGs]

    tmp = os.path.join(into, "_one-layer.pdf")
    for objgen, nm in names:
        out = os.path.join(into, slugify(nm) + ".svg")
        with pikepdf.open(ai_path) as pdf:
            d = pdf.Root.OCProperties.D
            keep, hide = [], []
            for o in pdf.Root.OCProperties.OCGs:
                (keep if o.objgen == objgen else hide).append(o)
            d.ON = pikepdf.Array(keep)
            d.OFF = pikepdf.Array(hide)
            pdf.save(tmp)
        subprocess.run(["pdftocairo", "-svg", tmp, out], check=True)
        made.append((slugify(nm), nm, out))
    if os.path.exists(tmp):
        os.remove(tmp)
    return made


def merge(made, order_file, out_path):
    """Stack the layers back up, in the order given, as one <svg> with each
    layer in a <g id="layer-…"> the page can switch on and off."""
    import make_merge
    order = json.load(io.open(order_file, encoding="utf-8")) \
        if os.path.exists(order_file) else [s for s, _, _ in made]
    make_merge.merge(made, order, out_path)


# ── the main map ───────────────────────────────────────────────────────────

def main_map():
    svg = os.path.join(paths.ARTWORK, "happy-trails.svg")
    ai  = os.path.join(paths.ARTWORK, "happy-trails.ai")
    out = os.path.join(paths.MAPS, "happy-trails-map.svg")

    if os.path.exists(svg) and (not os.path.exists(ai) or
                                os.path.getmtime(svg) >= os.path.getmtime(ai)):
        shutil.copy2(svg, out)
        print("   happy-trails-map.svg   from the .svg (%.0f KB)"
              % (os.path.getsize(out) / 1024))
        return
    if not os.path.exists(ai):
        raise SystemExit("artwork/happy-trails.svg or .ai — neither is there.")
    print("   happy-trails.ai → layers …")
    made = layers_from_ai(ai, os.path.join(paths.ARTWORK, "_layers"))
    merge(made, os.path.join(paths.ARTWORK, "layer-order.json"), out)
    print("   happy-trails-map.svg   from the .ai, %d layers" % len(made))


# ── a trail's own map ──────────────────────────────────────────────────────

def trail_maps():
    """Any trail with a drawing of its own in artwork/trails/ gets it. The rest
    keep the placeholder make_trails.py draws for them, which is what lets the
    site be finished one trail at a time rather than all at once."""
    src = os.path.join(paths.ARTWORK, "trails")
    if not os.path.isdir(src):
        return []
    drawn = []
    for f in sorted(os.listdir(src)):
        slug, ext = os.path.splitext(f)
        if ext.lower() not in (".svg", ".ai"):
            continue
        if ext.lower() == ".svg":
            shutil.copy2(os.path.join(src, f),
                         os.path.join(paths.MAPS, slug + "-map.svg"))
        else:
            if os.path.exists(os.path.join(src, slug + ".svg")):
                continue                      # the .svg beside it wins
            made = layers_from_ai(os.path.join(src, f),
                                  os.path.join(src, "_layers-" + slug))
            merge(made, os.path.join(src, slug + "-order.json"),
                  os.path.join(paths.MAPS, slug + "-map.svg"))
        drawn.append(slug)
        print("   %-22s from artwork/trails/%s" % (slug + "-map.svg", f))
    return drawn


# ── where each route's button goes on the main map ────────────────────────

def measure_pins(routes):
    """A route is a long thin line, so its centroid is usually nowhere near it —
    the Humber's is out in a field. Each route's layer is rendered ON ITS OWN
    and the button goes on the drawn pixel nearest that centroid, which puts it
    on the line whatever shape the line is.

    A route may be nudged by hand afterwards: two buttons measured to their
    routes' southern tips can still land on top of one another, and only a
    person looking at the map can say so. artwork/pin-nudges.json holds those."""
    import cairosvg, numpy as np
    from PIL import Image

    merged = io.open(os.path.join(paths.MAPS, "happy-trails-map.svg"),
                     encoding="utf-8").read()
    vb = re.search(r'viewBox="([\d.\- ]+)"', merged)
    _, _, W, H = [float(v) for v in vb.group(1).split()]
    defs = re.search(r"<defs>.*?</defs>", merged, re.S)
    defs = defs.group(0) if defs else ""
    scale = 0.16                       # enough to find a line, cheap to render

    pins = {}
    for slug in routes:
        m = re.search(r'<g id="layer-%s"[^>]*>' % re.escape(slug), merged)
        if not m:
            continue
        depth, i = 0, m.start()
        for j in range(m.start(), len(merged)):
            if merged.startswith("<g", j):
                depth += 1
            elif merged.startswith("</g>", j):
                depth -= 1
                if depth == 0:
                    i = j + 4
                    break
        one = ('<svg xmlns="http://www.w3.org/2000/svg" '
               'xmlns:xlink="http://www.w3.org/1999/xlink" '
               'width="%f" height="%f" viewBox="0 0 %f %f">%s%s</svg>'
               % (W, H, W, H, defs, merged[m.start():i]))
        png = cairosvg.svg2png(bytestring=one.encode("utf-8"),
                               output_width=int(W * scale),
                               output_height=int(H * scale))
        a = np.array(Image.open(io.BytesIO(png)).convert("RGBA"))
        ys, xs = np.nonzero(a[:, :, 3] > 24)
        if not len(xs):
            continue
        cx, cy = xs.mean(), ys.mean()
        k = np.argmin((xs - cx) ** 2 + (ys - cy) ** 2)
        pins[slug] = [int(round(xs[k] / scale)), int(round(ys[k] / scale))]

    nudge_file = os.path.join(paths.ARTWORK, "pin-nudges.json")
    if os.path.exists(nudge_file):
        for slug, xy in json.load(io.open(nudge_file, encoding="utf-8")).items():
            if slug in pins:
                pins[slug] = xy
                print("   %-30s nudged by hand to %s" % (slug, xy))

    json.dump(pins, io.open(os.path.join(paths.ARTWORK, "pins.json"), "w",
                            encoding="utf-8"), indent=1)
    print("   pins.json              %d route buttons measured" % len(pins))
    return pins


def main():
    paths.make()
    main_map()
    trail_maps()


if __name__ == "__main__":
    main()
