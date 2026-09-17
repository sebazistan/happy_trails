/* ═══════════════════════════════════════════════════════════════════════════
   HAPPY TRAILS — THE LINE ROUND A CARD ON A TOUR
   version 1.0

   WHAT THIS IS. While a tour is running, a green line draws itself round the
   edge of the card that is open. When it closes the circuit, the tour moves to
   the next waypoint. It is a progress bar that is not shaped like a progress
   bar: it says how long you have got with this card without putting a grey
   trough and a moving blue block on top of a photograph.

   IT IS THE SAME OBJECT AS THE WELCOME PANEL'S BORDER, deliberately. That
   panel — the first thing anybody sees on the main map — draws a purple line
   round itself and leaves when the line arrives, and somebody who has watched
   that once already knows what a line going round something means here. The
   colour is the difference: purple is the site's "not built yet", green is a
   trail you can ride, and the tour is a tour of trails.

   WHY AN SVG RECTANGLE AND NOT CSS. A border that travels round a rounded
   corner is one stroke with a dash pattern as long as itself, and there is
   nothing in CSS that will do it — border-image cannot, a conic gradient goes
   round a circle rather than round a rounded rectangle, and four separate
   growing edges meet at the corners wrongly. `pathLength="1"` is what makes it
   tractable: the dash maths becomes 0-to-1 whatever the card's real size, so
   one animation is correct on a phone and on a wide screen without measuring
   anything about the line itself.

   THE CARD IS MEASURED, NOT GUESSED. The viewBox is the card's own pixel box
   and the corner radius is read off the card, so the line lies exactly on the
   edge rather than on an ellipse produced by stretching a square viewBox. It
   is re-cut whenever the card changes size, which it does: a card with a tall
   photograph and one with a short one are different heights, and the tour
   opens both.

   AND IT STOPS WHEN THE TOUR STOPS. Pausing a tour pauses the line, because a
   progress bar that keeps filling while nothing is progressing is worse than
   no progress bar. That is one line of CSS — animation-play-state — for the
   same reason the whole thing is an animation rather than a timer: what you
   see and what happens cannot drift apart if they are the same thing.

   TO USE IT:  <script src="tour-edge.js"></script> before the two tour files.

     HappyTrailsEdge.draw(card, ms)   start it, over this many milliseconds
     HappyTrailsEdge.hold(on)         pause or let go
     HappyTrailsEdge.clear(card)      take it off; clear() with nothing takes
                                      it off whatever card has one
   ═══════════════════════════════════════════════════════════════════════════ */

window.HappyTrailsEdge = (function () {
  "use strict";

  const SETTINGS = {
    /* THE CLASS THE CARD WEARS while its line is running, and while it is
       held. Both are on the CARD rather than on the line, so the stylesheet
       can reach the line, and anything else about the card it might want to
       treat differently, from one place. */
    running:  "is-timing",
    holding:  "is-held",

    /* HOW MUCH OF THE CARD'S TIME THE LINE TAKES. One: it arrives exactly as
       the card's time runs out, which is the whole point of it. It is here as
       a number rather than as a 1 buried in a multiplication so that a tour
       that wanted the line to arrive a moment early — a warning rather than a
       finish line — could say so. */
    share:    1,

    /* THE LEAST TIME WORTH DRAWING ONE FOR. Under this the line is a flicker
       round the edge of a card that has already gone, so it is not drawn. */
    leastMs:  1200,
  };

  /* every card that currently carries a line, so `hold` and `clear` do not
     have to be told which one */
  const marked = new Set();

  /* ── THE LINE ITSELF ─────────────────────────────────────────────────────
     Made once per card and kept. Re-making it on every visit would be simpler
     to read and would also throw away the browser's layout of it each time,
     and a tour opens the same card again the second time round. */
  function edgeFor(card) {
    let svg = card.querySelector(":scope > .tm-edge");
    if (svg) return svg;
    const NS = "http://www.w3.org/2000/svg";
    svg = document.createElementNS(NS, "svg");
    svg.setAttribute("class", "tm-edge");
    svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("focusable", "false");
    const run = document.createElementNS(NS, "rect");
    run.setAttribute("class", "tm-edgeRun");
    run.setAttribute("pathLength", "1");
    svg.appendChild(run);
    /* FIRST CHILD, so it is behind the card's own contents in paint order and
       a photograph never has a green line lying across its top edge. The
       stylesheet lifts it back above the picture at the four edges where it
       actually is — see .tm-edge's z-index. */
    card.insertBefore(svg, card.firstChild);
    return svg;
  }

  /* CUT TO THE CARD IT IS GOING ROUND. offsetWidth rather than a bounding
     rect, on purpose: the engine is putting a transform on this card every
     frame — the shove when one card replaces another, the small rise as it
     fades in — and a bounding rect measures the card AFTER that transform, so
     the line would be cut to a card mid-shove and be the wrong size for the
     rest of its life. offsetWidth is the layout size, which is what the line
     shares with the card. */
  function cut(card) {
    const svg = edgeFor(card);
    const run = svg.firstChild;
    const w = card.offsetWidth, h = card.offsetHeight;
    if (!w || !h) return false;
    const thick = parseFloat(getComputedStyle(run).strokeWidth) || 2;
    const round = parseFloat(getComputedStyle(card).borderTopLeftRadius) || 16;
    svg.setAttribute("viewBox", "0 0 " + w + " " + h);
    run.setAttribute("x", thick / 2);
    run.setAttribute("y", thick / 2);
    run.setAttribute("width", Math.max(0, w - thick));
    run.setAttribute("height", Math.max(0, h - thick));
    run.setAttribute("rx", Math.max(0, round - thick / 2));
    return true;
  }

  /* A CARD CHANGES SIZE WHILE ITS LINE IS RUNNING. The carousel turns to a
     taller photograph, the text pages over, the window is resized — and a line
     cut to the old height would sit inside or outside the new edge. One
     observer for all of them, made only if the browser has one; without it the
     line is cut once and is correct until something moves. */
  let watcher = null;
  function watch(card) {
    if (!window.ResizeObserver) return;
    if (!watcher) {
      watcher = new ResizeObserver(entries => {
        entries.forEach(entry => {
          if (marked.has(entry.target)) cut(entry.target);
        });
      });
    }
    watcher.observe(card);
  }

  /* ── STARTING ONE ────────────────────────────────────────────────────────
     The class comes off and goes back on with a reflow in between, which is
     what makes it run a SECOND time on a card the tour has already visited.
     Without it the class is already there, nothing has changed, and the
     browser has nothing to animate — the usual reason an animation plays once
     and never again. */
  function draw(card, ms) {
    if (!card || !(ms > SETTINGS.leastMs)) return;
    const took = Math.round(ms * SETTINGS.share);
    if (!cut(card)) return;
    marked.add(card);
    watch(card);
    card.style.setProperty("--edge-draw", took + "ms");
    card.classList.remove(SETTINGS.running, SETTINGS.holding);
    void card.offsetWidth;
    card.classList.add(SETTINGS.running);
  }

  /* ── PAUSING ─────────────────────────────────────────────────────────────
     Every card carrying a line, not just the one on screen, because a tour
     paused in the middle of a card swap has two. */
  function hold(on) {
    marked.forEach(card => card.classList.toggle(SETTINGS.holding, !!on));
  }

  function clear(card) {
    const list = card ? [card] : Array.from(marked);
    list.forEach(one => {
      one.classList.remove(SETTINGS.running, SETTINGS.holding);
      marked.delete(one);
      if (watcher) watcher.unobserve(one);
    });
  }

  return { draw: draw, hold: hold, clear: clear, SETTINGS: SETTINGS };
})();
