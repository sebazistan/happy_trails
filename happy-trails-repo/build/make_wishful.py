#!/usr/bin/env python3
"""
Build wishful.html — every proposed thing on the site, in one sortable list.

WHAT THIS PAGE IS FOR
  The wishful stops are the most useful thing on this site and the hardest to
  find. Each one lives partway down a trail page, behind a switch that starts
  off. Somebody who wants to know "what would it take to fix the network, and
  what would fix the most for the least" has to open nine pages and remember
  what they saw.

  So they are gathered here, and the page is built around the question rather
  than the list: two sliders — what it would cost, how badly it is wanted — and
  a sort that puts the cheap important ones first. Filtering is what makes the
  page worth having; without it this is just a longer table of contents.

WHAT IS AND IS NOT ON IT
  A wishful stop on a BUILT trail — a gap, a crossing, a bridge with no deck.
  Twelve of them at the moment.

  NOT the wishful TRAILS (Mimico Creek, Etobicoke Creek South). Those are whole
  routes that do not exist, they have pages of their own, and their stops are
  not proposals within a trail — they are the trail. Putting them in this list
  would mean answering "what would this cost" for a stop of a route that does
  not exist, which is a question about the route.

WHERE THE CONTENT COMES FROM
  trails_data.py, all of it. The Beltline used to be the exception — a
  hand-written page whose three proposals had to be listed again in this file,
  with a check that refused to build if the two copies disagreed. The check
  worked, and it was a symptom: a list that has to be guarded against itself
  should not be two lists. The Beltline is in the trail data now like every
  other trail, so this file reads one source and there is nothing to guard.

WHERE EACH CARD GOES
  don.html#half-mile-bridge — the stop's own address, using the deep links in
  trail-engine.js. Following one opens the trail at that stop with its card up,
  and turns the Wishful thinking layer on so the stop is actually there. The
  name in the URL is made from the stop's title exactly as the engine makes it,
  which is why slug() below has to agree with slugify() there.
"""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import paths

import io, os, re, sys
from trails_data import ALL_TRAILS, stop_dicts

SITE = paths.SITE
OUT = SITE + "/wishful.html"

# The two folders carry spaces in their names, which a URL has to encode.
WISH_PICS = "wishful%20link%20images/"

def slug(text):
    """The name a stop has in a URL. This MUST agree with slugify() in
    trail-engine.js — the engine makes the name, this makes the link to it, and
    if they disagree every link on this page lands on the top of a trail page
    with no card open and no error to say why."""
    return re.sub(r"-+$", "", re.sub(r"^-+", "",
           re.sub(r"[^a-z0-9]+", "-", re.sub(r"[‘’']", "",
           str(text).lower())))) or "stop"


def gather():
    """Every wishful stop on a built trail, in one list."""
    items = []
    for t in ALL_TRAILS:
        if t.get("wishful"):
            continue                      # a whole proposed trail, not a gap in one
        for s in stop_dicts(t):
            if s["kind"] != "wishful":
                continue
            items.append(dict(
                title=s["title"], slug=slug(s["title"]),
                trail=t["name"], trailSlug=t["slug"],
                cost=s["cost"], priority=s["priority"],
                blurb=s["blurb"] or s["caption"]))
    return items


LEVEL_WORD = {"low": "Low", "medium": "Medium", "high": "High"}


def card(it):
    return '''    <article class="wt-card" data-cost="%s" data-priority="%s"
             data-trail="%s" data-title="%s">
      <div class="wt-shot" style="background-image:url('%s%s.png')"></div>
      <div class="wt-body">
        <div class="wt-on">%s</div>
        <h3><a class="wt-open" href="%s.html#%s">%s</a></h3>
        <p>%s</p>
        <div class="wt-marks">
          <span class="wt-mark is-cost"><img src="icons/cost-%s.svg" alt=""
            width="48" height="48"><span><small>Cost</small><b>%s</b></span></span>
          <span class="wt-mark is-priority"><img src="icons/priority-%s.svg" alt=""
            width="48" height="48"><span><small>Priority</small><b>%s</b></span></span>
        </div>
        <div class="wt-go">See it on the map <span aria-hidden="true">&rarr;</span></div>
      </div>
    </article>''' % (
        it["cost"], it["priority"], it["trail"], it["title"].lower(),
        WISH_PICS, it["slug"], it["trail"], it["trailSlug"], it["slug"],
        it["title"], it["blurb"],
        it["cost"], LEVEL_WORD[it["cost"]],
        it["priority"], LEVEL_WORD[it["priority"]])


def page(items):
    """The page, with the cards dropped into it.

    Note the marker rather than a %s: this template contains percent signs that
    are nothing to do with Python — %20 for the spaces in a folder name, and a
    "%s" inside the page's own JavaScript — and a format string would either
    choke on them or quietly eat them."""
    cards = "\n".join(card(i) for i in items)
    return CARDS_HERE.replace("<!--THE CARDS GO HERE-->", cards)


CARDS_HERE = '''<!doctype html>
<html lang="en">
<!-- ═══════════════════════════════════════════════════════════════════════════
     HAPPY TRAILS — WISHFUL THINKING
     version 1.0

     Every proposed thing on the site, gathered off the trail pages it is
     scattered across, and sortable by what it would cost and how badly it is
     wanted. This file is GENERATED by make_wishful.py — edit that, not this,
     or the next build will throw your changes away.

     THE ONE THING THAT IS NOT OBVIOUS
       Each card links to a stop, not to a page: don.html#half-mile-bridge.
       That works because every waypoint on every trail now has a name of its
       own in the URL (see linkToStops in trail-engine.js). Following one opens
       the trail at that stop, with its card up, and switches the Wishful
       thinking layer on — which matters, because otherwise the link would land
       on a page where the thing it is about is hidden.

     WHERE THE NUMBERS ARE: at the top of the script, in one block, as
     everywhere else on this site. WHERE THE STYLING IS: happy-trails.css,
     under body.page-wishful.
     ═══════════════════════════════════════════════════════════════════════════ -->
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>Wishful thinking — Happy Trails</title>
<!-- SOCIAL_HEAD -->
<link rel="stylesheet" href="happy-trails.css">
</head>
<body class="page-text page-wishful">

<header id="ht-bar">
  <a id="ht-brand" href="index.html">Happy Trails</a>
  <nav id="ht-nav">
    <a href="index.html">Map</a>
    <a href="trails.html">Trails</a>
    <a href="wishful.html" class="is-here" aria-current="page">Wishful</a>
    <a href="about.html">About</a>
    <a href="contact.html">Contact</a>
    <a class="ht-coffee" href="https://buymeacoffee.com/sebazistan" target="_blank" rel="noopener"><span class="nav-full">Buy me a coffee</span><span class="nav-short">Coffee</span></a>
  </nav>
</header>

<main>
  <div class="pt-head">
    <div class="pt-kicker">What is missing, and what it would take</div>
    <h1>Wishful thinking</h1>
    <p class="pt-lede">Twelve places where the trail network stops, doubles
      back, or sends you onto a road. Each one is somewhere a specific, buildable
      thing would fix a specific problem — a crossing, a deck, a light, a
      kilometre of path. Narrow them down by what they would cost and by how
      badly they are wanted, and the argument makes itself. The cheapest thing
      that would do the most good is always first.</p>
  </div>

  <!-- ── THE CONTROLS ────────────────────────────────────────────────────
       Two sliders and three shortcuts. The sliders sit at "Any" until moved,
       so the page opens showing everything — a filter that starts on hides
       things from a reader who has not asked for anything to be hidden.

       THE SHORTCUTS ARE NOT A SORT. Each one sets both sliders to a pair worth
       asking for, and the sliders move to show it: "Best value" is cheap and
       badly wanted, and you can see that it is, which is what makes it
       trustworthy. The order of what is left never changes — best value first,
       always — because a list that reorders itself as well as shortening
       itself is two changes to follow at once. -->
  <section class="wt-controls" aria-label="Filter">
    <div class="wt-sliders">
      <div class="wt-slider">
        <label for="wt-cost">Cost <b id="wt-costNow">Any</b></label>
        <input type="range" id="wt-cost" min="0" max="3" step="any" value="0"
               aria-valuetext="Any" aria-describedby="wt-costNow">
        <div class="wt-ticks">
          <button type="button" data-for="wt-cost" data-at="0">Any</button>
          <button type="button" data-for="wt-cost" data-at="1">Low</button>
          <button type="button" data-for="wt-cost" data-at="2">Medium</button>
          <button type="button" data-for="wt-cost" data-at="3">High</button>
        </div>
      </div>
      <div class="wt-slider">
        <label for="wt-priority">Priority <b id="wt-priorityNow">Any</b></label>
        <input type="range" id="wt-priority" min="0" max="3" step="any" value="0"
               aria-valuetext="Any" aria-describedby="wt-priorityNow">
        <div class="wt-ticks">
          <button type="button" data-for="wt-priority" data-at="0">Any</button>
          <button type="button" data-for="wt-priority" data-at="1">Low</button>
          <button type="button" data-for="wt-priority" data-at="2">Medium</button>
          <button type="button" data-for="wt-priority" data-at="3">High</button>
        </div>
      </div>
    </div>

    <div class="wt-sortRow">
      <span class="wt-sortLabel">Show me</span>
      <div class="wt-sort" role="group" aria-label="Shortcuts">
        <button type="button" data-cost="1" data-priority="3">Best value</button>
        <button type="button" data-cost="0" data-priority="3">Most wanted</button>
        <button type="button" data-cost="1" data-priority="0">Cheapest</button>
      </div>
      <button type="button" id="wt-reset" class="wt-reset">Reset</button>
    </div>

    <p class="wt-count" id="wt-count" role="status">Showing all 12</p>
  </section>

  <section class="wt-list" id="wt-list">
<!--THE CARDS GO HERE-->
  </section>

  <p class="wt-empty" id="wt-empty" hidden>Nothing matches both of those.
    <button type="button" class="wt-linkish" id="wt-clear">Clear the filters</button>
    and start again.</p>

  <footer class="pt-foot">
    <span>Happy Trails — the multi-use trails of the Greater Toronto Area.</span>
    <span><a href="index.html">Main map</a> · <a href="trails.html">All trails</a></span>
  </footer>
</main>

<script>
(function () {
  "use strict";

/* ── EVERY NUMBER AND NAME THIS PAGE USES, IN ONE PLACE ──────────────────── */
const SETTINGS = {
  version:        "1.1",

  /* The slider has four stops. Position 0 is "Any" and means no filtering at
     all; 1, 2 and 3 are the three levels in order. Keeping "Any" ON THE SLIDER
     rather than in a separate checkbox means one control does one job and
     there is only ever one place to look for what is being filtered. */
  levels:         ["", "low", "medium", "high"],
  levelWords:     ["Any", "Low", "Medium", "High"],

  /* THE ORDER NEVER CHANGES: the best deal first. How much good a thing does,
     divided by what it would take, with priority counting for more — a cheap
     thing nobody needs is not a bargain, it is just cheap. */
  worth:          { low: 1, medium: 2, high: 3 },
  valueBias:      1.35,        // how much heavier priority is than cost

  countOne:       "Showing 1 of 12",
  countAll:       "Showing all 12",
  countSome:      "Showing %s of 12",

  /* Cards are re-ordered by writing a CSS `order` on each, rather than by
     moving them in the document: nothing is destroyed and rebuilt, so the
     browser can animate between arrangements and a card keeps its scroll
     position, its focus and its loaded picture. */
  stagger:        26,          // ms between one card appearing and the next
  leaveMs:        150,         // how long a card takes to shrink away before
                               // it is taken out of the layout. Short: this is
                               // an acknowledgement, not a performance.
  enterMs:        280,         // and how long one takes to arrive

  /* THE SLIDER SLIDES, AND THEN SNAPS. With a step of 1 the thumb jumps from
     stop to stop under the finger, which feels like a fault rather than a
     constraint. It takes any value while it is being dragged and settles onto
     the nearest stop when let go, over this many milliseconds. */
  snapMs:         160
};

const $  = id => document.getElementById(id);
const cards = Array.prototype.slice.call(document.querySelectorAll(".wt-card"));
const sliders = [$("wt-cost"), $("wt-priority")];

/* how good a deal each card is, worked out once */
cards.forEach(c => {
  const p = SETTINGS.worth[c.dataset.priority] || 0;
  const k = SETTINGS.worth[c.dataset.cost] || 1;
  c._value = (p * SETTINGS.valueBias) / k;
  c._cost = k;
});
const byValue = (a, b) => b._value - a._value || a._cost - b._cost;

/* the stop a slider is nearest, which is the value it MEANS however far it has
   been dragged between two of them */
const stopOf = el => Math.max(0, Math.min(3, Math.round(+el.value)));

/* WHAT THE LIST WAS LAST SHOWING. apply() runs on every frame of a slider —
   dragging one, or gliding it to a stop, calls it sixty times a second — and
   almost all of those frames ask for exactly the same set of cards. Re-running
   the animation on each of them would mean the cards never finished arriving.
   So the readouts follow the slider continuously, and the list is only rebuilt
   when the pair of values it depends on actually changes. */
let lastFilter = null;
let pass = 0;                 // cancels the timers of a filter change that has
                              // been overtaken by a newer one

function apply() {
  const wantCost = SETTINGS.levels[stopOf($("wt-cost"))];
  const wantPri  = SETTINGS.levels[stopOf($("wt-priority"))];

  sliders.forEach(el => {
    const at = stopOf(el);
    const word = SETTINGS.levelWords[at];
    $(el.id + "Now").textContent = word;
    el.setAttribute("aria-valuetext", word);
    /* the slider takes the colour of what it is showing, so the control and
       the coins on the cards below it agree at a glance */
    el.dataset.level = SETTINGS.levels[at] || "any";
    /* and the name of the stop it is on is marked, so the row of words under
       the groove reads as a set of buttons with one of them chosen */
    el.parentNode.querySelectorAll(".wt-ticks button").forEach(b =>
      b.classList.toggle("is-on", +b.dataset.at === at));
  });

  /* a shortcut lights up when the sliders happen to be where it would put
     them — however they got there */
  document.querySelectorAll(".wt-sort button").forEach(b =>
    b.classList.toggle("is-on",
      +b.dataset.cost === stopOf($("wt-cost")) &&
      +b.dataset.priority === stopOf($("wt-priority"))));

  const asked = wantCost + "|" + wantPri;
  if (asked === lastFilter) return;      // nothing to rebuild
  lastFilter = asked;
  const mine = ++pass;

  const showing = cards.filter(c =>
    (!wantCost || c.dataset.cost === wantCost) &&
    (!wantPri  || c.dataset.priority === wantPri));

  showing.sort(byValue);

  /* ── GOING ──────────────────────────────────────────────────────────────
     A card that is leaving shrinks and fades first, and is taken out of the
     layout only once that has played. Taken out immediately it would simply
     blink out of existence and the cards after it would jump into the hole.

     A CARD THAT IS OUT MUST LEAVE THE LAYOUT, though — the class is what does
     that. `hidden` alone could not: .wt-card sets a display of its own, which
     beats the browser's [hidden] rule, so filtered-out cards kept their cells
     and left holes in the grid. */
  const leaving = cards.filter(c =>
    showing.indexOf(c) === -1 && !c.classList.contains("is-out"));
  leaving.forEach(c => {
    c.classList.remove("is-in");
    c.classList.add("is-leaving");
    c.style.transitionDelay = "0ms";
  });
  const clear = () => {
    if (mine !== pass) return;           // a newer filter has taken over
    leaving.forEach(c => {
      c.classList.remove("is-leaving");
      c.classList.add("is-out");
      c.hidden = true;
    });
    place();
  };
  if (leaving.length) setTimeout(clear, SETTINGS.leaveMs);
  else place();

  /* ── AND ARRIVING ───────────────────────────────────────────────────────
     Order is written as a CSS `order` rather than by moving the cards in the
     document: nothing is destroyed and rebuilt, so pictures stay loaded and
     focus stays where it was. A card that was out is put back into the layout
     first, then — after a frame, so the browser has something to animate FROM
     — told to arrive. */
  function place() {
    if (mine !== pass) return;
    showing.forEach((c, i) => {
      c.style.order = i;
      c.hidden = false;
      c.classList.remove("is-leaving", "is-out");
    });
    requestAnimationFrame(() => {
      if (mine !== pass) return;
      showing.forEach((c, i) => {
        c.style.transitionDelay = (i * SETTINGS.stagger) + "ms";
        c.classList.add("is-in");
      });
    });
  }

  const n = showing.length;
  $("wt-count").textContent =
    n === cards.length ? SETTINGS.countAll
    : n === 1          ? SETTINGS.countOne
    : SETTINGS.countSome.replace("%s", n);
  $("wt-empty").hidden = n > 0;
  $("wt-list").hidden = n === 0;

  /* the address remembers the filter, so a filtered view can be sent to
     somebody — which is the whole point of a page that answers a question */
  const bits = [];
  if (wantCost) bits.push("cost=" + wantCost);
  if (wantPri)  bits.push("priority=" + wantPri);
  try {
    history.replaceState(null, "",
      location.pathname + (bits.length ? "?" + bits.join("&") : ""));
  } catch (e) { /* file:// refuses, and it does not matter */ }
}

/* ── MOVING A SLIDER TO A STOP, VISIBLY ─────────────────────────────────── */
/* Setting .value would teleport the thumb. Every way of getting to a stop that
   is not a drag — a shortcut, a tick, Reset, the keyboard — comes through here
   instead, so the thumb travels and you can see which way it went. */
function glide(el, to, then) {
  const from = +el.value, gap = to - from;
  if (!gap) { el.value = to; apply(); if (then) then(); return; }
  const started = performance.now();
  (function step(now) {
    const t = Math.min(1, (now - started) / SETTINGS.snapMs);
    // ease out: quick to leave, gentle to arrive
    el.value = from + gap * (1 - Math.pow(1 - t, 3));
    apply();
    if (t < 1) requestAnimationFrame(step);
    else if (then) then();
  })(started);
}

sliders.forEach(el => {
  el.addEventListener("input", apply);
  /* let go, and it settles onto the nearest stop */
  const settle = () => glide(el, stopOf(el));
  el.addEventListener("change", settle);
  el.addEventListener("pointerup", settle);
  el.addEventListener("pointercancel", settle);
  /* THE KEYBOARD MOVES A WHOLE STOP AT A TIME. With step="any" the arrow keys
     would otherwise nudge it by a hundredth, which is unusable — the slider
     would look broken to anyone not using a mouse. */
  el.addEventListener("keydown", e => {
    const at = stopOf(el);
    let to = null;
    if (e.key === "ArrowRight" || e.key === "ArrowUp") to = Math.min(3, at + 1);
    else if (e.key === "ArrowLeft" || e.key === "ArrowDown") to = Math.max(0, at - 1);
    else if (e.key === "Home") to = 0;
    else if (e.key === "End") to = 3;
    if (to === null) return;
    e.preventDefault();
    glide(el, to);
  });
});

/* ── THE SHORTCUTS, THE TICKS, AND RESET ────────────────────────────────── */
/* All three do the same thing: put the sliders somewhere. Nothing here filters
   directly — apply() is the only thing that decides what is shown, and it only
   ever reads the sliders. One source of truth, and the sliders always show it. */
document.querySelectorAll(".wt-sort button").forEach(b =>
  b.addEventListener("click", () => {
    glide($("wt-cost"), +b.dataset.cost);
    glide($("wt-priority"), +b.dataset.priority);
  }));

document.querySelectorAll(".wt-ticks button").forEach(b =>
  b.addEventListener("click", () => glide($(b.dataset.for), +b.dataset.at)));

function reset() {
  glide($("wt-cost"), 0);
  glide($("wt-priority"), 0);
}
$("wt-reset").addEventListener("click", reset);
$("wt-clear").addEventListener("click", reset);

/* arriving with a filter already in the address */
(function fromAddress() {
  const q = new URLSearchParams(location.search);
  const at = name => Math.max(0, SETTINGS.levels.indexOf(q.get(name) || ""));
  if (q.get("cost"))     $("wt-cost").value = at("cost");
  if (q.get("priority")) $("wt-priority").value = at("priority");
})();

apply();
})();
</script>

</body>
</html>
'''


def main():
    items = gather()
    io.open(OUT, "w", encoding="utf-8").write(page(items))
    print("   wishful.html —", len(items), "proposals")
    for it in items:
        print("      %-20s %-16s cost %-7s priority %-7s -> %s.html#%s"
              % (it["title"], it["trail"], it["cost"], it["priority"],
                 it["trailSlug"], it["slug"]))


main()
