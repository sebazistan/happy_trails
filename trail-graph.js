/* ═══════════════════════════════════════════════════════════════════════════
   HAPPY TRAILS — THE ELEVATION GRAPH, MADE OF BUTTONS
   version 1.1

   WHAT THIS IS. The strip along the bottom of a trail page was a picture: it
   showed the hills, it showed where you were, and there was nothing you could
   do with it. It is now the fastest way to move around the trail.

     · POINT AT A WAYPOINT and its dot swells and says its name. The dots were
       always there — one per stop, at its own height — and the name was in a
       `title` attribute, which is to say it was there for nobody.

     · CLICK THE NAME and the page goes there and opens that waypoint's card.

     · DRAG THE KNOB — or anywhere along the graph — and the whole trail runs
       past under your hand. The map moves, the walker moves, the numbers
       move. The cards stay shut while you are dragging, because thirteen of
       them flashing open and closed in two seconds is not information.

   WHY IT IS ITS OWN FILE. None of it is needed to read a trail. A page that
   does not load this one has the graph it always had, and nothing in the
   engine has to know whether it was loaded.

   HOW IT FINDS ANYTHING. Through window.TRAIL, which the engine publishes —
   `stops` for the names, `goToStop` for the going, `goToFraction` for the
   dragging, `scrubbing` for the hush while a drag is happening. It reaches
   into nothing else and holds no state the engine also holds.

   TO USE IT:  <script src="trail-graph.js"></script> after trail-engine.js.
   ═══════════════════════════════════════════════════════════════════════════ */

(function () {
  "use strict";

  const SETTINGS = {
    /* HOW CLOSE THE POINTER HAS TO BE to a waypoint before that waypoint is
       the one being pointed at, in pixels across the graph. The dots are five
       pixels wide and nobody can hit a five-pixel target on a graph that is
       twenty pixels tall, so the real target is this wide and invisible. */
    reach:      26,

    /* WHERE THE NAME SITS, in pixels above the dot, and how long it takes to
       arrive. Above rather than beside, because two waypoints close together
       would otherwise write over each other. */
    nameLift:   14,

    /* DRAGGING. A drag that begins on the graph moves the page directly; one
       that begins on a waypoint's name does not, or the name could never be
       clicked. `slack` is how far the pointer may move before a press counts
       as a drag rather than as a click. */
    slack:      3,

    /* How long to wait after the last drag before letting the cards open
       again, so releasing the knob in the middle of a waypoint does not snap a
       card up in the same instant. */
    settle:     220,

    /* ── THE GRADIENT ──────────────────────────────────────────────────────
       While the graph is being dragged, the number beside the knob is the
       slope under it — which is the number anybody riding this actually wants,
       and the one thing a picture of a hill cannot tell you. It is worked out
       over a span rather than between two neighbouring samples: sampled
       finely, a hand-drawn profile is all noise, and a gradient that flickers
       between +11 and −8 as you drag is worse than none. */
    slopeOver:  0.006,        // the span it is measured across, as a fraction
                              // of the whole trail
    slopeShow:  0.5,          // below this, in per cent, it says "level"

    /* ── THE STEEP BITS, MARKED ────────────────────────────────────────────
       Anything at or above this gradient is drawn over the profile in a warmer
       colour. Five per cent is about where a climb stops being scenery and
       starts being a decision. Set it to 0 to leave the graph alone. */
    steepAt:    5,
    steepLeast: 2,            // and how many samples in a row it takes to count,
                              // so one noisy sample is not a hill
  };

  let wired = false;

  function begin() {
    if (wired) return;
    const TRAIL = window.TRAIL;
    const graph = document.getElementById("tm-profile");
    if (!TRAIL || !graph || !TRAIL.stops || !TRAIL.goToFraction) return;
    if (graph.style.display === "none") return;      // a trail with no heights

    const dots = Array.prototype.slice.call(graph.querySelectorAll(".tm-wpdot"));
    if (!dots.length) return;

    /* the dots are in stops order — make_pages writes them from the same array
       in the same loop — so the index IS the waypoint */
    dots.forEach((dot, i) => { dot.dataset.stop = i; });

    /* ── THE NAME THAT FOLLOWS THE POINTER ─────────────────────────────────
       One label, moved about, rather than one per waypoint sitting hidden: the
       graph can carry forty stops on a long trail and forty absolutely
       positioned labels is forty things to lay out on every resize.

       It is a real <button>, not a div with a click handler, so it can be
       reached by keyboard and announces itself as something that does
       something. */
    const name = document.createElement("button");
    name.type = "button";
    name.className = "tm-wpname";
    name.setAttribute("aria-hidden", "true");
    name.tabIndex = -1;
    graph.appendChild(name);

    let at = -1;                 // which waypoint the pointer is nearest, or -1

    function show(i) {
      if (i === at) return;
      if (at >= 0 && dots[at]) dots[at].classList.remove("is-near");
      at = i;
      if (i < 0) { name.classList.remove("is-on"); return; }
      const dot = dots[i];
      dot.classList.add("is-near");
      name.textContent = TRAIL.stops[i].title;
      name.style.left = dot.style.left;
      name.style.top = "calc(" + dot.style.top + " - " + SETTINGS.nameLift + "px)";
      name.classList.add("is-on");
    }

    /* which waypoint is nearest the pointer, in pixels rather than in
       fractions, so the reach is the same on a phone as on a wide screen */
    function nearest(x) {
      const box = graph.getBoundingClientRect();
      let best = -1, gap = SETTINGS.reach;
      dots.forEach((dot, i) => {
        if (dot.hidden || dot.style.display === "none") return;
        if (!dot.offsetParent) return;                 // on a switched-off layer
        const mid = box.left + (parseFloat(dot.style.left) / 100) * box.width;
        const off = Math.abs(x - mid);
        if (off < gap) { gap = off; best = i; }
      });
      return best;
    }

    /* ── DRAGGING THE WHOLE TRAIL PAST ─────────────────────────────────────
       A press anywhere on the graph takes hold of the walk. It is deliberately
       the whole graph and not only the knob: the knob is eleven pixels wide
       and the thing it is standing on is the width of the screen, and anybody
       who has used a video scrubber already expects the track to work.

       The cards are hushed for the duration — see TRAIL.scrubbing — and let
       back in a moment after the release, so letting go in the middle of a
       waypoint does not snap its card up in the same instant. */
    let dragging = false, began = 0, moved = false, letGo = 0;

    const whereIn = x => {
      const box = graph.getBoundingClientRect();
      return box.width ? Math.min(1, Math.max(0, (x - box.left) / box.width)) : 0;
    };

    graph.addEventListener("pointerdown", e => {
      if (e.target === name) return;          // the name is a button, not a track
      if (e.button != null && e.button !== 0) return;
      dragging = true; moved = false; began = e.clientX;
      clearTimeout(letGo);
      graph.setPointerCapture && graph.setPointerCapture(e.pointerId);
      graph.classList.add("is-dragging");
      e.preventDefault();
    });

    graph.addEventListener("pointermove", e => {
      if (!dragging) { show(nearest(e.clientX)); return; }
      if (!moved && Math.abs(e.clientX - began) < SETTINGS.slack) return;
      if (!moved) { moved = true; TRAIL.scrubbing(true); graph.classList.add("is-reading"); }
      const f = whereIn(e.clientX);
      TRAIL.goToFraction(f);
      saySlope(f);
    });

    function release(e) {
      if (!dragging) return;
      dragging = false;
      graph.classList.remove("is-dragging");
      graph.classList.remove("is-reading");
      if (moved) {
        /* let the cards back in, but not in the same frame: the walk is still
           settling and a card that snaps up on the release reads as a jolt */
        letGo = setTimeout(() => TRAIL.scrubbing(false), SETTINGS.settle);
      } else if (e && at >= 0) {
        /* a press that never moved, on a waypoint: treat it as the click it
           plainly was, so the dot itself works as well as its name does */
        if (TRAIL.byHand) TRAIL.byHand();
        TRAIL.goToStop(at, true);
      }
      moved = false;
    }
    graph.addEventListener("pointerup", release);
    graph.addEventListener("pointercancel", release);
    graph.addEventListener("pointerleave", () => {
      show(-1);
      release(null);            // null: a pointer leaving is never a click
    });

    /* clicking the name goes there and opens the card — the same journey the
       arrows and the links make, so there is one piece of code that means
       "go and stand at this waypoint" */
    name.addEventListener("click", e => {
      e.stopPropagation();
      if (TRAIL.byHand) TRAIL.byHand();     // a click here is a reader taking over
      if (at >= 0) TRAIL.goToStop(at, true);
    });

    /* ── THE STEEP SECTIONS ────────────────────────────────────────────────
       Drawn from the profile's own polyline rather than from a second set of
       samples, so the warm line lies exactly on the white one — it IS the
       white one, in the places where the ground is steep. The points come
       straight out of the path's `d`, which the engine wrote at even
       intervals, and the gradient at each is asked of the engine. */
    function markTheSteep() {
      if (!SETTINGS.steepAt || !TRAIL.metresAt || !TRAIL.perMetre) return;
      const svg = graph.querySelector("svg");
      const whole = graph.querySelector(".tm-whole");
      if (!svg || !whole) return;
      const d = whole.getAttribute("d") || "";
      const pts = d.replace(/[ML]/g, " ").trim().split(/\s+/).map(Number);
      const n = pts.length / 2;
      if (n < 4) return;

      const across = (TRAIL.length / (n - 1)) * TRAIL.perMetre;   // metres along
      let run = [], spans = [];
      for (let i = 1; i < n; i++) {
        const up = TRAIL.metresAt(i / (n - 1)) - TRAIL.metresAt((i - 1) / (n - 1));
        const grade = across ? Math.abs(up / across * 100) : 0;
        if (grade >= SETTINGS.steepAt) { if (!run.length) run.push(i - 1); run.push(i); }
        else { if (run.length >= SETTINGS.steepLeast) spans.push(run); run = []; }
      }
      if (run.length >= SETTINGS.steepLeast) spans.push(run);
      if (!spans.length) return;

      const bit = spans.map(span =>
        span.map((i, k) => (k ? "L" : "M") + pts[i * 2] + " " + pts[i * 2 + 1]).join("")
      ).join(" ");
      const mark = document.createElementNS("http://www.w3.org/2000/svg", "path");
      mark.setAttribute("class", "tm-steep");
      mark.setAttribute("d", bit);
      // under the walked line, over the whole profile
      whole.parentNode.insertBefore(mark, whole.nextSibling);
    }
    markTheSteep();

    /* ── THE GRADIENT UNDER THE POINTER ────────────────────────────────────
       Only while dragging. Standing still it would be a number nobody asked
       for sitting on top of the graph; moving, it is the whole reason for
       dragging in the first place. */
    const slope = document.createElement("div");
    slope.className = "tm-slope";
    slope.setAttribute("aria-hidden", "true");
    graph.appendChild(slope);

    function saySlope(f) {
      if (!TRAIL.metresAt || !TRAIL.perMetre) return;
      const half = SETTINGS.slopeOver / 2;
      const a = Math.max(0, f - half), b = Math.min(1, f + half);
      const across = (b - a) * TRAIL.length * TRAIL.perMetre;
      const up = TRAIL.metresAt(b) - TRAIL.metresAt(a);
      const grade = across ? up / across * 100 : 0;
      slope.textContent = Math.abs(grade) < SETTINGS.slopeShow
        ? (TRAIL.WORDS.level || "level")
        : (grade > 0 ? "+" : "\u2212") + Math.abs(grade).toFixed(1) + "%";
      slope.classList.toggle("is-up", grade >= SETTINGS.slopeShow);
      slope.classList.toggle("is-down", grade <= -SETTINGS.slopeShow);
      slope.style.left = (f * 100).toFixed(2) + "%";
    }

    /* ── AND THE KEYBOARD ──────────────────────────────────────────────────
       The graph is a slider now, so it is one to a keyboard too: left and
       right step a waypoint at a time — the same journey the two arrows make —
       and Home and End go to the ends. It takes focus, which also means the
       whole trail can be walked without a mouse. */
    graph.tabIndex = 0;
    graph.setAttribute("role", "slider");
    graph.setAttribute("aria-label", TRAIL.WORDS.graphLabel || "Position along the trail");
    graph.addEventListener("keydown", e => {
      const live = TRAIL.liveStops();
      if (!live.length) return;
      const here = live.indexOf(TRAIL.nearestStop().at);
      let want = null;
      if (e.key === "ArrowLeft"  || e.key === "ArrowDown") want = live[Math.max(0, here - 1)];
      else if (e.key === "ArrowRight" || e.key === "ArrowUp") want = live[Math.min(live.length - 1, here + 1)];
      else if (e.key === "Home") want = live[0];
      else if (e.key === "End")  want = live[live.length - 1];
      else return;
      e.preventDefault();
      if (TRAIL.byHand) TRAIL.byHand();
      if (want !== undefined) TRAIL.goToStop(want, true);
    });

    wired = true;
    graph.classList.add("is-live");
  }

  /* THE GRAPH IS BUILT WHEN THE ARTWORK HAS LOADED, which is well after this
     file runs. The engine says so when it has finished; `load` is a belt and
     braces for the case where this file arrives after that has already been
     said. `wired` makes running twice harmless. */
  document.addEventListener("trail:ready", begin);
  window.addEventListener("load", () => setTimeout(begin, 0));
})();
