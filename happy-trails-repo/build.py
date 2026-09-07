#!/usr/bin/env python3
"""
Build the site.

    python3 build.py

That is the whole thing. It reads build/trails_data.py, artwork/, templates/,
static/ and media/, and writes _site/ — which is what gets published.

You do not normally run this yourself. Pushing to GitHub runs it (see
.github/workflows/build.yml) and publishes whatever it produces, so the way to
change the site is to change its sources and push.

    --keep       do not empty _site/ first. Faster while you are iterating,
                 and it can leave a file behind that the build no longer makes.
    --zip        also write a dated zip of the finished site, for keeping or
                 for handing to someone who is not using GitHub.

THE ORDER MATTERS, and each step says why it has to come where it does.
"""

import argparse, io, os, shutil, subprocess, sys, time

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "build"))
import paths                                     # noqa: E402

STEPS = [
    ("make_artwork", "the Illustrator file → maps/",
     "First, because everything else measures itself against the drawing: the "
     "route buttons, the waypoint positions, the pictures."),
    ("make_beltline", "the Beltline's own map",
     "A railpath is not a river, a shore or a hydro corridor, so it is drawn "
     "to its own rules rather than by make_trails."),
    ("make_trails", "a placeholder map per trail without one",
     "Only for trails with no artwork of their own — a trail you have drawn "
     "keeps its drawing."),
    ("make_icons", "the coins, the dials, and the legend swatches",
     "Before the pages, which reference them by name."),
    ("make_images", "one picture per trail, one per proposal",
     "These read the maps, so they come after the maps."),
    ("make_pages", "a page per trail",
     "Reads the maps and inlines each one into its trail's page."),
    ("make_index", "the main map page",
     "Inlines the big map and writes the measured route-button positions."),
    ("make_wishful", "the Wishful thinking page",
     "Reads every trail's stops, so it comes after the trail data is settled."),
    ("make_social", "the 1200x630 link previews",
     "Reads the maps."),
    ("make_meta", "descriptions, link previews, sitemap, robots",
     "LAST. It edits every page that exists, so every page has to exist."),
]

COPY = [
    ("static", ""),          # the stylesheet, the engine, the favicons, icons
    ("media", "media"),      # photographs and video, one folder per trail
]


def copy_sources():
    """Files that are not generated: they are copied as they are.

    Copied FIRST, so that a generator can overwrite one if it means to — the
    icons are the case that matters, where the hand-drawn swatches come from
    static/icons and the drawn ones are added on top."""
    n = 0
    for src, into in COPY:
        s = os.path.join(paths.ROOT, src)
        if not os.path.isdir(s):
            continue
        d = os.path.join(paths.SITE, into) if into else paths.SITE
        shutil.copytree(s, d, dirs_exist_ok=True)
        n += sum(len(f) for _, _, f in os.walk(s))
    # the pages that are written by hand rather than generated
    for f in sorted(os.listdir(paths.TEMPLATES)):
        if f == "index.html":
            continue                      # make_index assembles that one
        shutil.copy2(os.path.join(paths.TEMPLATES, f),
                     os.path.join(paths.SITE, f))
        n += 1
    print("   %d files copied from static/, media/ and templates/" % n)


def run(step):
    """Each generator is run as its own process.

    Not imported: several of them do their work at import time, and one that
    fails should stop the build with its own traceback rather than half-running
    inside another. A build server has to be able to say WHICH step broke."""
    r = subprocess.run([sys.executable, os.path.join(HERE, "build", step + ".py")],
                       cwd=HERE)
    if r.returncode:
        raise SystemExit("\nbuild stopped: build/%s.py failed (exit %d).\n"
                         "Everything above it succeeded; nothing below it ran."
                         % (step, r.returncode))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--keep", action="store_true",
                    help="do not empty _site/ first")
    ap.add_argument("--zip", action="store_true",
                    help="also write a zip of the finished site")
    args = ap.parse_args()

    began = time.time()
    if os.path.isdir(paths.SITE) and not args.keep:
        shutil.rmtree(paths.SITE)
    paths.make()

    print("\n── copying what is not generated ────────────────────────────")
    copy_sources()

    for i, (step, what, _why) in enumerate(STEPS, 1):
        print("\n── %d/%d  %s ──" % (i, len(STEPS), what))
        run(step)

    files = sum(len(f) for _, _, f in os.walk(paths.SITE))
    size = sum(os.path.getsize(os.path.join(r, f))
               for r, _, fs in os.walk(paths.SITE) for f in fs)
    print("\n════════════════════════════════════════════════════════════")
    print("  _site/  %d files, %.1f MB, in %.0f seconds"
          % (files, size / 1048576.0, time.time() - began))

    if args.zip:
        name = "happy-trails-" + time.strftime("%Y-%m-%d")
        out = os.path.join(paths.ROOT, name)
        shutil.make_archive(out, "zip", paths.SITE)
        print("  %s.zip" % name)


if __name__ == "__main__":
    main()
