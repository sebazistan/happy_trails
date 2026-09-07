# Happy Trails

A hand-drawn map of the multi-use trails of the Greater Toronto Area, the
routes that connect them, and the gaps that still need closing.

**You do not build this site. You change it and push, and it builds itself.**

---

## Setting it up, once

1. Push this repository to GitHub.
2. **Settings ▸ Pages ▸ Build and deployment ▸ Source: _GitHub Actions_.**

That is the whole setup — no keys, no tokens, no branch to keep tidy. From then
on every push to `main` rebuilds the site and publishes it, in about ninety
seconds. The **Actions** tab shows each build; a red one means nothing was
published and the live site is untouched.

If the site is not going to live at `https://www.huzzahdesign.com/happy-trails/`,
change `BASE` at the top of `build/make_meta.py`. It is used for the link
previews and the sitemap, both of which need absolute addresses.

---

## Changing things

### To add or edit a trail, a stop, or a proposal

Edit **`build/trails_data.py`**. It is the file you will spend nearly all your
time in, and everything else follows from it: the trail pages, the Wishful
thinking page, the pictures, the link previews, the sitemap.

You can edit it in GitHub's own web editor — press `.` in the repository, or
click the pencil on the file — from any machine, with nothing installed.

A placeholder trail's stops are written as short tuples:

```python
("Riverdale", 0.66, 88, "The last of the ravine"),
```

— title, how far along the route it sits (0 to 1), its height in metres, and a
few words for the map pin.

A **proposal** — something that is not built — carries three more:

```python
("Half Mile Bridge", 0.16, 110, "Decommissioned, and ready",
                                "wishful", "medium", "high"),
#                                kind      cost      priority
```

Cost and priority are each `"low"`, `"medium"` or `"high"`. They are what the
Wishful thinking page sorts on, so the build **refuses to run** if a proposal is
missing either — a stop without them would silently vanish from every filter,
which is the worst way for data to be missing.

A **finished** trail writes its stops out in full instead, with its own
photographs, captions and text. **The Beltline is the worked example** — copy
the shape of its entry.

### To redraw a map

Everything visual is set in Illustrator, including where the stops go.

Put the file in `artwork/`:

| file | what it is |
|---|---|
| `artwork/happy-trails.ai` | the main map |
| `artwork/trails/don.ai` | the Lower Don's own map — named for its slug |

Inside the drawing, these names matter:

- **`route`** — the line a trail page walks. One per trail map.
- **`wp-something`** — a small circle per stop. **This is how you place a stop
  by eye.** The page snaps the stop onto the nearest point of the route, so the
  circle does not have to sit exactly on the line; near it is enough. In the
  trail's entry, the stop says `marker="#wp-something"`.
- **`link-1`, `link-2`…** — a small circle where this trail meets another.
- On the main map, a layer named for a trail's slug holds that route's
  highlight; `wishful-…` for one that does not exist yet.

The route buttons on the main map are **measured** from the artwork, not typed.
Move a route and its button follows. If two buttons land on top of one another —
which happens when two routes end at the same place — correct it in
`artwork/pin-nudges.json`; delete the entry and the measured position comes
back.

The main map in this repository is **`artwork/happy-trails.ai`** — your
Illustrator file, unchanged. The build reproduces the map currently on the site
from it exactly, byte for byte, so replacing it with your next save is all that
is needed.

**`.ai` or `.svg`, and `.svg` wins.** An `.ai` file is a PDF underneath and its
layers come out of that, which depends on _Create PDF Compatible File_ being
ticked when it was saved. If a converted `.ai` ever comes out wrong, export SVG
from Illustrator instead — _File ▸ Export ▸ Export As ▸ SVG_, **Styling:
Presentation Attributes**, **Object IDs: Layer Names** — and drop it in beside
the `.ai`. The build prefers it.

A trail with no artwork of its own keeps the drawn placeholder, so the site can
be finished one trail at a time and is never missing a map.

### To add photographs

`media/<trail slug>/`, and name them in that trail's stops. Any shape works —
they are cropped to fill, never squashed. Video (`.mp4`, `.webm`) plays silently
and loops.

### To change how anything looks

`static/happy-trails.css` — every colour, size and font for every page, in one
file. The red accent has a clearly marked home at the top.

### To change how a trail page behaves

`static/trail-engine.js` — shared by all twelve. Its `DEFAULTS` block is the
list of everything a trail page can be told to do.

### To count visits

`static/analytics.js`. It does nothing until you set `provider` to
`"plausible"`, `"goatcounter"` or `"cloudflare"` and fill in the one setting
that one needs. No cookies, no identifiers, and it honours Do Not Track.

It also records how far down each trail page people actually get — a quarter,
half, three quarters, the end. That is the number that says whether the
scrolling format is working, and nothing else on the site can tell you.

---

## What is where

```
build/          the generators, and trails_data.py — the file you edit most
artwork/        the Illustrator files, and the two small files describing them
templates/      the pages written by hand rather than generated
static/         copied to the site untouched: stylesheet, engine, favicons, icons
media/          photographs and video, one folder per trail
_site/          THE BUILT SITE — never committed, never edited
```

Anything in `_site/` is written by the build and overwritten by the next one.
**Editing a file there works until the next push and then stops working**, which
is the worst kind of working. Every generated page says so at the top and names
the file to edit instead.

---

## Building it yourself

You do not need to. But if you want to see it before you push:

```bash
pip install -r requirements.txt
python3 build.py          # writes _site/
python3 build/check.py    # what the Action runs before publishing
```

You will also need two things that are not Python packages:
`poppler-utils` (for reading Illustrator layers) and `libcairo2` (for drawing
the pictures). On Ubuntu: `sudo apt install poppler-utils libcairo2`. On a Mac:
`brew install poppler cairo`.

`python3 build.py --zip` also writes a dated zip of the finished site, for
keeping or for handing to someone who is not using GitHub.

---

## The checks

`build/check.py` runs before anything is published, and the build fails rather
than publishing if it finds a problem. Every check is there because the thing it
looks for has actually happened:

- a page shipped with its link-preview marker still in it, because it was
  regenerated after the step that fills it in
- a map shipped in the previous month's colours, drawn once and never redrawn
- a link to a picture in a folder whose name had changed
- a deep link to a stop that had been renamed, which lands silently at the top
  of the right page with nothing open
- a stop anchored to a circle the drawing no longer contains
- an absolute path from the machine that built it

None of those raise an error in a browser. All of them are obvious to a script
that reads the finished files.
