#!/usr/bin/env python3
"""
Look over the built site and refuse it if it is wrong.

WHY THIS RUNS BEFORE PUBLISHING
  A build that succeeds is not the same as a site that works. Every one of the
  checks below is here because the thing it looks for has actually happened at
  least once:

    · a page shipped with <!-- SOCIAL_HEAD --> still in it, because it was
      regenerated after the step that fills that in — no favicon, no link
      preview, and nothing anywhere said so
    · a map shipped in last month's colours, because it was drawn once and
      never redrawn after the colour changed
    · a link to a picture in a folder whose name had changed
    · a deep link to a stop that had been renamed, which lands silently at the
      top of the right page with nothing open

  None of those raise an error in a browser. All of them are obvious to a
  script that reads the finished files, which is what this is.

It needs nothing installed and no browser: it reads the built site off disk.
"""

import io, os, re, sys, urllib.parse
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import paths

PROBLEMS = []


def bad(where, what):
    PROBLEMS.append("%-24s %s" % (where, what))


def pages():
    return sorted(f for f in os.listdir(paths.SITE) if f.endswith(".html"))


def read(f):
    return io.open(os.path.join(paths.SITE, f), encoding="utf-8").read()


# ── 1. nothing half-built ──────────────────────────────────────────────────
def check_markers():
    for f in pages():
        s = read(f)
        for marker in ("<!-- SOCIAL_HEAD -->", "THE MAP GOES HERE",
                       "THE CARDS GO HERE"):
            if marker in s:
                bad(f, "still has the %s marker — a step that fills it in "
                       "either did not run or ran too early" % marker)
        if "og:title" not in s:
            bad(f, "has no link preview: make_meta.py did not reach it")
        if 'href="favicon.svg"' not in s:
            bad(f, "has no favicon")


# ── 2. nothing points anywhere that is not there ───────────────────────────
def check_links():
    for f in pages():
        s = read(f)
        wanted = set()
        wanted |= set(re.findall(r'(?:href|src)="([^"#:]+)"', s))
        wanted |= set(re.findall(r"url\('([^']+)'\)", s))
        for ref in wanted:
            if ref.startswith(("http", "//", "data:", "mailto:")):
                continue
            local = urllib.parse.unquote(ref.split("?")[0])
            if not local or local.endswith("/"):
                continue
            # An href written by JavaScript rather than by hand — the engine
            # builds the navigation bar and the legend rows as strings, so the
            # source contains href=" followed by an expression. Those are not
            # addresses and there is nothing on disk to look for.
            if re.search(r"[+'\n<>]|\s\s", local):
                continue
            if not os.path.exists(os.path.join(paths.SITE, local)):
                bad(f, "points at %s, which is not in the built site" % local)


# ── 3. every deep link lands on a stop that exists ─────────────────────────
def slugs_of(page):
    """The name each stop on a trail page has in a URL, worked out the same way
    the engine works it out — from the stop's title."""
    s = read(page)
    body = s[s.find("const WAYPOINTS"):s.find("window.TRAIL_PAGE")]
    out = []
    for title in re.findall(r'title:\s*"((?:[^"\\]|\\.)*)"', body):
        t = title.replace('\\"', '"').lower()
        t = re.sub(r"[\u2018\u2019']", "", t)
        out.append(re.sub(r"^-+|-+$", "", re.sub(r"[^a-z0-9]+", "-", t)))
    return out


def check_deep_links():
    for f in pages():
        for ref in set(re.findall(r'href="([a-z0-9\-]+\.html)#([a-z0-9\-]+)"',
                                  read(f))):
            page, want = ref
            if not os.path.exists(os.path.join(paths.SITE, page)):
                bad(f, "links to %s, which does not exist" % page)
                continue
            have = slugs_of(page)
            if want not in have:
                bad(f, "links to %s#%s, and that page has no such stop "
                       "(it has %s)" % (page, want, ", ".join(have[:4]) + " …"))


# ── 4. every trail page can actually be walked ─────────────────────────────
def check_trails():
    for f in pages():
        s = read(f)
        if "window.TRAIL_PAGE" not in s:
            continue
        if 'id="route"' not in s:
            bad(f, "has no <path id=\"route\"> — the page has nothing to walk")
        stops = len(re.findall(r'title:\s*"', s[s.find("const WAYPOINTS"):
                                                s.find("window.TRAIL_PAGE")]))
        markers = len(set(re.findall(r'id="(wp-[a-z0-9\-]+)"', s)))
        if stops and markers < stops:
            bad(f, "has %d stops but only %d wp- circles in its drawing — "
                   "the ones with no circle will not appear" % (stops, markers))
        for m in re.findall(r'marker:\s*"#(wp-[a-z0-9\-]+)"', s):
            if 'id="%s"' % m not in s:
                bad(f, "a stop is anchored to #%s, which the drawing does not "
                       "contain" % m)


# ── 5. nothing from the machine it was built on ───────────────────────────
def check_absolute_paths():
    for r, _, fs in os.walk(paths.SITE):
        for f in fs:
            if not f.endswith((".html", ".css", ".js", ".svg", ".xml", ".txt")):
                continue
            p = os.path.join(r, f)
            s = io.open(p, encoding="utf-8", errors="ignore").read()
            for leak in ("/home/", "file:///", "C:\\"):
                if leak in s:
                    bad(os.path.relpath(p, paths.SITE),
                        "contains %r — a path from the machine that built it"
                        % leak)


# ── 6. the wishful page still lists everything ────────────────────────────
def check_wishful():
    f = "wishful.html"
    if f not in pages():
        bad(f, "was not built")
        return
    s = read(f)
    cards = len(re.findall(r'class="wt-card"', s))
    everywhere = 0
    for p in pages():
        if "window.TRAIL_PAGE" not in read(p):
            continue
        body = read(p)
        everywhere += len(re.findall(r'kind:\s*"wishful"', body)) \
            if "trailKind:      \"wishful\"" not in body else 0
    if cards != everywhere:
        bad(f, "lists %d proposals, but the trail pages hold %d. A wishful "
               "stop that is not on this page cannot be found." % (cards, everywhere))
    for level in ("low", "medium", "high"):
        for kind in ("cost", "priority"):
            want = "icons/%s-%s.svg" % (kind, level)
            if want in s and not os.path.exists(os.path.join(paths.SITE, want)):
                bad(f, "shows %s, which was not drawn" % want)


def main():
    for check in (check_markers, check_links, check_deep_links, check_trails,
                  check_absolute_paths, check_wishful):
        check()

    n = len(pages())
    if PROBLEMS:
        print("\n%d problems in the built site:\n" % len(PROBLEMS))
        for p in PROBLEMS:
            print("   " + p)
        print("\nThe site was NOT published.")
        raise SystemExit(1)
    print("   %d pages checked: markers, links, deep links, drawings, "
          "absolute paths, the wishful list — all sound" % n)


if __name__ == "__main__":
    main()
