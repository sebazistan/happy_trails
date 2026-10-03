/* ═══════════════════════════════════════════════════════════════════════════
   HAPPY TRAILS — THE LINE ROUND A CARD ON A TOUR
   version 1.2

   WHAT THIS IS. While a tour runs, a green line draws itself round the edge of
   the open card; when it closes the circuit, the tour moves to the next
   waypoint. It is a progress bar that is not shaped like one: it says how long
   you have with this card without a grey trough and a moving block on top of
   a photograph.

   IT IS THE SAME OBJECT AS THE WELCOME PANEL'S BORDER, deliberately. That panel
   draws a purple line round itself and leaves when the line arrives, so
   somebody who has watched it already knows what a line going round something
   means. The colour is the difference: purple is "not built yet", green is a
   trail you can ride.

   WHY AN SVG RECTANGLE AND NOT CSS. A border that travels round a rounded
   corner is one stroke with a dash pattern as long as itself, and CSS cannot
   do it: border-image cannot, a conic gradient goes round a circle, and four
   growing edges meet wrongly at the corners. `pathLength="1"` makes the dash
   maths 0-to-1 whatever the card's size, so one animation is correct on a
   phone and a wide screen.

   THE CARD IS MEASURED, NOT GUESSED. The viewBox is the card's own pixel box
   and the corner radius is read off the card, so the line lies on the edge
   rather than on an ellipse. It is re-cut whenever the card changes size
   (a tall photograph and a short one are different heights).

   IT STOPS WHEN THE TOUR STOPS: pausing a tour pauses the line, one line of
   CSS (animation-play-state). The whole thing is an animation rather than a
   timer so that what you see and what happens cannot drift apart.

   TO USE IT:  <script src="js/tour-edge.js"></script> before the two tour files.

     HappyTrailsEdge.draw(card, ms)   start it, over this many milliseconds
     HappyTrailsEdge.hold(on)         pause or let go
     HappyTrailsEdge.clear(card)      take it off; clear() with nothing takes
                                      it off whatever card has one
   ═══════════════════════════════════════════════════════════════════════════ */

window.HappyTrailsEdge = (function () {
  "use strict";

  const SETTINGS = {
    /* THE CLASS THE CARD WEARS while its line is running, and while it is
       held. On the CARD rather than the line, so the stylesheet can reach both
       from one place. */
    running:  "is-timing",
    holding:  "is-held",

    /* HOW MUCH OF THE CARD'S TIME THE LINE TAKES. One: it arrives exactly as
       the card's time runs out. A number rather than a buried 1 so a tour could
       have the line arrive early, as a warning rather than a finish line. */
    share:    1,

    /* THE LEAST TIME WORTH DRAWING ONE FOR; under this it is a flicker round
       a card that has already gone. */
    leastMs:  1200,
  };

  /* every card that currently carries a line, so `hold` and `clear` need not
     be told which */
  const marked = new Set();

  /* ── THE LINE ITSELF ─────────────────────────────────────────────────────
     Made once per card and kept: re-making it would throw away the browser's
     layout of it, and a tour opens the same card again on the second round. */
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
    /* FIRST CHILD, so it is behind the card's contents in paint order and a
       photograph never has a green line across its top edge. The stylesheet
       lifts it back above the picture at the four edges (see .tm-edge's
       z-index). */
    card.insertBefore(svg, card.firstChild);
    return svg;
  }

  /* CUT TO THE CARD IT IS GOING ROUND. The engine puts a transform on the card
     every frame (the shove when one card replaces another, the rise as it
     fades in), and a bounding rect measures AFTER that transform, so the line
     would be cut to a card mid-shove and stay the wrong size. Layout sizes
     ignore the transform. */
  function cut(card) {
    const svg = edgeFor(card);
    const run = svg.firstChild;
    /* clientWidth, NOT offsetWidth. The SVG is inset:0, and an absolutely
       positioned child is laid out against the PADDING box, inside the card's
       one-pixel border, while offsetWidth reports the border box. Two pixels of
       disagreement drew the line slightly too large and offset up and left. */
    const w = card.clientWidth, h = card.clientHeight;
    if (!w || !h) return false;
    const look = getComputedStyle(card);
    const thick = parseFloat(getComputedStyle(run).strokeWidth) || 2;
    const rim = parseFloat(look.borderTopWidth) || 0;
    /* and the corner it has to lie on is the INNER one, in by the border */
    const round = (parseFloat(look.borderTopLeftRadius) || 16) - rim;
    svg.setAttribute("viewBox", "0 0 " + w + " " + h);
    run.setAttribute("x", thick / 2);
    run.setAttribute("y", thick / 2);
    run.setAttribute("width", Math.max(0, w - thick));
    run.setAttribute("height", Math.max(0, h - thick));
    run.setAttribute("rx", Math.max(0, round - thick / 2));
    return true;
  }

  /* A CARD CHANGES SIZE WHILE ITS LINE IS RUNNING (the carousel turns to a
     taller photograph, the text pages over, the window is resized), and a line
     cut to the old height would sit inside or outside the new edge. One
     observer for all of them; without ResizeObserver the line is cut once. */
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
     The class comes off and goes back on with a reflow between, which is what
     makes it run a SECOND time on a card the tour has already visited. */
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
     Every card carrying a line, because a tour paused mid card swap has two. */
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
