#!/usr/bin/env python3
"""Stack the per-layer SVGs back into one document with named, switchable
groups. Imported by make_artwork.py; not run on its own.

  * every layer keeps the shared page box, so they stay registered
  * every id is namespaced per layer, so the glyph and clip ids the renderer
    generates cannot collide between layers
  * numbers are rounded and colours shortened, which cuts the file a lot

ORDER is bottom of the stack first — the reverse of Illustrator's layer
palette. Stacking is decided here and nowhere else: a group written later
paints on top.

THE ONE ORDERING RULE THAT MATTERS: every "…-bridge" layer must come AFTER
`rail` and `highway`. A bridge carries a trail OVER a railway or an expressway,
so it has to paint on top of them, otherwise switching Trails on draws the
bridges underneath the very things they cross. The check at the end of merge()
makes sure that stays true however the order file is edited.
"""
import io, os, re

W = [6546.78]
H = [3372.52]

def pct_to_hex(m):
    vals = [float(v.strip().rstrip('%')) for v in m.group(1).split(',')]
    return '#%02x%02x%02x' % tuple(max(0, min(255, round(v * 255 / 100))) for v in vals)

def tidy(svg):
    svg = re.sub(r'rgb\(([^)]*)\)', pct_to_hex, svg)
    svg = re.sub(r'\s(?:fill|stroke)-opacity="1"', '', svg)
    svg = re.sub(r'\sfill-rule="nonzero"', '', svg)
    svg = re.sub(r'(\d+\.\d{2,})', lambda m: f"{float(m.group(1)):.1f}".rstrip('0').rstrip('.'), svg)
    svg = re.sub(r'>\s+<', '><', svg)
    return svg.strip()

def namespace(svg, tag):
    ids = set(re.findall(r'id="([^"]+)"', svg))
    for i in sorted(ids, key=len, reverse=True):
        svg = svg.replace(f'id="{i}"', f'id="{tag}--{i}"')
        svg = svg.replace(f'xlink:href="#{i}"', f'xlink:href="#{tag}--{i}"')
        svg = svg.replace(f'url(#{i})', f'url(#{tag}--{i})')
    return svg

# ── the mask-to-opacity swap ────────────────────────────────────────────────
# Illustrator layer opacity comes out of the renderer as a <mask> holding one
# grey rectangle, pushed through a colour-removing filter. Two things are wrong
# with that:
#
#   * a <mask> is measured in objectBoundingBox units by default, so a layer
#     whose geometry is a perfectly straight horizontal or vertical line — the
#     Finch route is exactly this — has a bounding box of zero height, the mask
#     region collapses to nothing, and the layer disappears entirely. That is a
#     real bug: Finch rendered as a blank layer before this.
#   * a mask plus a filter is re-composited every frame while the map is being
#     dragged, and there were twelve of them.
#
# Where the mask is a single rectangle of uniform opacity covering the whole
# artboard — which is every one of them here — it is exactly equivalent to a
# plain opacity on the group, and that is what this does. The check is strict:
# anything that is not that simple shape is left alone.
MASK_RE = re.compile(
    r'<mask id="([^"]+)">\s*<g filter="url\(#[^"]+\)">\s*'
    r'<rect x="(-?[\d.]+)" y="(-?[\d.]+)" width="([\d.]+)" height="([\d.]+)" '
    r'fill="rgb\(0%, 0%, 0%\)" fill-opacity="([\d.]+)"/>\s*</g>\s*</mask>', re.S)

def masks_to_opacity(svg, report):
    flat = {}
    for m in MASK_RE.finditer(svg):
        mid, x, y, w, h, op = m.group(1), *map(float, m.groups()[1:6])
        covers = x <= 0 and y <= 0 and x + w >= W[0] and y + h >= H[0]
        if covers:
            flat[mid] = round(op, 3)
    for mid, op in flat.items():
        svg = re.sub(r'<mask id="%s">.*?</mask>' % re.escape(mid), '', svg, flags=re.S)
        svg = svg.replace('<g mask="url(#%s)">' % mid, '<g opacity="%g">' % op)
        report.append(op)
    # the colour-removing filter has nothing left to do once the masks are gone
    if flat and 'mask="url(#' not in svg:
        svg = re.sub(r'<filter id="filter-remove-color".*?</filter>', '', svg, flags=re.S)
    return svg



def inner(path):
    """A layer file's contents, without its own <svg> wrapper."""
    raw = io.open(path, encoding="utf-8").read()
    body = re.sub(r"^.*?<svg[^>]*>", "", raw, flags=re.S)
    return re.sub(r"</svg>\s*$", "", body).strip()


def page_size(path):
    """The artboard, read off a layer rather than written down. Every layer
    carries the same one, which is what keeps them in register."""
    raw = io.open(path, encoding="utf-8").read()
    m = re.search(r'viewBox="([\d.\- ]+)"', raw)
    if m:
        _, _, w, h = [float(v) for v in m.group(1).split()]
        return w, h
    w = re.search(r'width="([\d.]+)', raw)
    h = re.search(r'height="([\d.]+)', raw)
    return float(w.group(1)), float(h.group(1))


def merge(made, order, out_path):
    """`made` is [(slug, illustrator name, file)]. `order` is either a plain
    list of slugs, bottom of the stack first, or an object with `order` and
    `skip`.

    A layer in the file but NOT in the order is stacked on top, and the build
    says so — a layer you have just drawn should appear loudly rather than
    vanish. A layer in `skip` is left out on purpose, which is a different
    thing and worth being able to say: the legend layer is still in the
    Illustrator file and no longer belongs in the map, and without somewhere to
    write that down it would either be silently dropped by a list that forgot
    it or noisily re-added every build."""
    skip = []
    if isinstance(order, dict):
        skip = order.get("skip", [])
        order = order.get("order", [])
    have = {slug: f for slug, _, f in made if slug not in skip}
    if skip:
        print("   left out on purpose:", ", ".join(skip))
    W[0], H[0] = page_size(next(iter(have.values())))

    stack = [s for s in order if s in have]
    extra = [s for s in have if s not in order]
    if extra:
        print("   layers not in layer-order.json, stacked on top:", extra)
        stack += extra

    for b in [s for s in stack if s.endswith("-bridge")]:
        for under in ("rail", "highway"):
            if under in stack and stack.index(b) < stack.index(under):
                raise SystemExit(
                    "layer-order.json puts %s below %s. A bridge carries a "
                    "trail OVER those, so it has to paint on top of them." % (b, under))

    parts, report, flattened = [], [], []
    for tag in stack:
        body = masks_to_opacity(inner(have[tag]), flattened)
        body = namespace(tidy(body), tag)
        parts.append('<g id="layer-%s">%s</g>' % (tag, body))
        report.append((tag, round(os.path.getsize(have[tag]) / 1024),
                       round(len(body) / 1024)))

    out = ('<svg xmlns="http://www.w3.org/2000/svg" '
           'xmlns:xlink="http://www.w3.org/1999/xlink" '
           'width="%s" height="%s" viewBox="0 0 %s %s">%s</svg>'
           % (W[0], H[0], W[0], H[0], "".join(parts)))
    io.open(out_path, "w", encoding="utf-8").write(out)

    print("   %d layers, %dK of source into %dK of map; %d masks flattened"
          % (len(parts), sum(r[1] for r in report),
             round(len(out) / 1024), len(flattened)))
    left = sum(p.count('mask="url(') for p in parts)
    if left:
        print("   masks still in the file:", left)
    return out_path
