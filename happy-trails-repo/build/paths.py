"""Where everything is.

ONE FILE KNOWS THE LAYOUT. Every generator used to carry the absolute path of
the machine it was written on, which worked exactly as long as it ran on that
machine — and a build server is not that machine. They all ask here now.

    happy-trails/
      build/        these scripts, and trails_data.py — the file you edit most
      artwork/      the Illustrator file, and the per-trail maps drawn from it
      templates/    the pages that are written by hand rather than generated
      static/       files copied to the site untouched: the stylesheet, the
                    engine, the favicons
      media/        photographs and video, one folder per trail
      _site/        THE BUILT SITE. Never committed, never edited — every file
                    in it is written by the build and overwritten by the next.

HT_SITE in the environment moves the output somewhere else, which is what lets
a build write to a scratch folder and be compared against the last one.
"""

import os

HERE      = os.path.dirname(os.path.abspath(__file__))
ROOT      = os.path.dirname(HERE)

SITE      = os.environ.get("HT_SITE") or os.path.join(ROOT, "_site")
ARTWORK   = os.path.join(ROOT, "artwork")
TEMPLATES = os.path.join(ROOT, "templates")
STATIC    = os.path.join(ROOT, "static")
MEDIA     = os.path.join(ROOT, "media")

# where the built site puts each kind of thing
MAPS      = os.path.join(SITE, "maps")
ICONS     = os.path.join(SITE, "icons")
SOCIAL    = os.path.join(SITE, "social")
TRAIL_PIX = os.path.join(SITE, "trail link images")
WISH_PIX  = os.path.join(SITE, "wishful link images")


def make():
    """Every folder the build writes into, created if it is not there."""
    for d in (SITE, MAPS, ICONS, SOCIAL, TRAIL_PIX, WISH_PIX):
        os.makedirs(d, exist_ok=True)
