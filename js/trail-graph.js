/* ═══════════════════════════════════════════════════════════════════════════
   HAPPY TRAILS — THE ELEVATION GRAPH, MADE OF BUTTONS
   version 1.6

   WHAT THIS IS. The strip along the bottom of a trail page shows the hills and
   where you are, and is also the fastest way to move around the trail.

     · POINT AT A WAYPOINT and its dot swells and says its name (the name used
       to be in a `title` attribute, which is to say there for nobody).

     · CLICK THE NAME and the page goes there and opens that waypoint's card.

     · DRAG THE KNOB, or anywhere along the graph, and the whole trail runs past
       under your hand: the map, the walker and the numbers move. The cards stay
       shut while dragging, because thirteen of them flashing open and closed
       in two seconds is not information.

   WHY IT IS ITS OWN FILE. None of it is needed to read a trail. A page that
   does not load this one has the plain graph, and the engine need not know
   whether it was loaded.

   HOW IT FINDS ANYTHING: through window.TRAIL, which the engine publishes
   (`stops` for the names, `goToStop` for the going, `goToFraction` for the
   dragging, `scrubbing` for the hush during a drag). It reaches into nothing
   else and holds no state the engine also holds.

   TO USE IT:  <script src="js/trail-graph.js"></script> after trail-engine.js.
   ═══════════════════════════════════════════════════════════════════════════ */

(function () {
  "use strict";

  const SETTINGS = {
    /* HOW CLOSE THE POINTER HAS TO BE to a waypoint, in pixels across the
       graph, for it to be the one pointed at. The dots are five pixels wide and
       nobody can hit that on a graph twenty pixels tall, so the real target is
       this wide and invisible. */
    reach:      26,

    /* WHERE THE NAME SITS, in pixels above the dot. Above rather than beside,
       because two waypoints close together would write over each other. */
    nameLift:   14,

    /* DRAGGING. A drag that begins on the graph moves the page directly; one
       that begins on a waypoint's name does not, or the name could never be
       clicked. `slack` is how far the pointer may move before a press counts as
       a drag rather than a click. */
    slack:      3,

    /* How long to wait after the last drag before letting the cards open
       again, so releasing the knob mid-waypoint does not snap a card up at
       once. */
    settle:     220,

    /* ── THE GRADIENT ──────────────────────────────────────────────────────
       While the graph is dragged, the number beside the knob is the slope under
       it, which is what anybody riding this wants and a picture of a hill
       cannot tell you. It is worked out over a span, not between neighbouring
       samples: a hand-drawn profile is all noise when sampled finely, and a
       gradient flickering between +11 and −8 is worse than none. */
    slopeOver:  0.006,        // the span it is measured across, as a fraction
                              // of the whole trail
    slopeShow:  0.5,          // below this, in per cent, it says "level"

    /* ── THE STEEP BITS, MARKED ────────────────────────────────────────────
       Steep ground is drawn in a warmer colour. Set steepAt to 0 to leave the
       graph alone. */
    steepAt:    9,            // the gradient, in per cent, at which the
                              // profile is fully the warm colour; five per cent
                              // is a slope you notice, not one worth colouring
                              // red
    steepMost:  1.0,          // how far towards the warm colour the steepest
                              // ground may go; 1 = all the way, safe because
                              // steepCurve keeps everything else well away
    steepCurve: 2.6,          // how slowly the colour leaves white; 1 is a
                              // straight ramp, higher keeps the middle pale
    colourStops: 48,          // how finely the colour is sampled along the
                              // strip; more is smoother and it is drawn once
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

    /* the dots are in stops order (make_pages writes them from the same array
       in the same loop), so the index IS the waypoint */
    dots.forEach((dot, i) => { dot.dataset.stop = i; });

    /* ── THE NAME THAT FOLLOWS THE POINTER ─────────────────────────────────
       One label, moved about, rather than one hidden per waypoint: a long trail
       can carry forty stops and forty positioned labels is forty things to lay
       out on every resize. A real <button>, so it can be reached by keyboard
       and announces itself as something that does something. */
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

    /* which waypoint is nearest the pointer, in pixels not fractions, so the
       reach is the same on a phone as on a wide screen */
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
       A press anywhere on the graph takes hold of the walk, not only the knob:
       the knob is eleven pixels wide and the track is the width of the screen,
       and anybody who has used a video scrubber expects the track to work.
       The cards are hushed meanwhile (TRAIL.scrubbing) and let back in a moment
       after the release. */
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
        /* let the cards back in, but not in the same frame: a card snapping up
           on the release reads as a jolt */
        letGo = setTimeout(() => TRAIL.scrubbing(false), SETTINGS.settle);
      } else if (e && at >= 0) {
        /* a press that never moved, on a waypoint, is the click it plainly
           was, so the dot works as well as its name */
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

    /* clicking the name goes there and opens the card, the same journey the
       arrows and links make, so one piece of code means "go and stand at this
       waypoint" */
    name.addEventListener("click", e => {
      e.stopPropagation();
      if (TRAIL.byHand) TRAIL.byHand();     // a click here is a reader taking over
      if (at >= 0) TRAIL.goToStop(at, true);
    });

    /* ── THE PROFILE'S COLOUR FOLLOWS THE GROUND ───────────────────────────
       The profile is ONE line whose colour changes along it: a gradient with a
       stop every few samples, each mixed between the profile's own colour and
       the warm one by how steep the ground is there. (A second path laid over
       only the stretches steeper than steepAt gave hard edges, and left bits of
       genuinely steep ground white beside bits barely over the line: it read
       as a fault, not information.) The mix is eased and capped, so gentle
       ground stays as it was and only a real climb warms up, which is the
       honest way to draw a quantity with no edges in it. */
    function colourByGround() {
      if (!SETTINGS.steepAt || !TRAIL.metresAt || !TRAIL.perMetre) return;
      const svg = graph.querySelector("svg");
      const whole = graph.querySelector(".tm-whole");
      if (!svg || !whole) return;
      const d = whole.getAttribute("d") || "";
      const n = (d.replace(/[ML]/g, " ").trim().split(/\s+/).length) / 2;
      if (n < 4) return;

      /* THE CALM END IS READ BEFORE THIS RULE OVERWRITES IT. After the first
         pass `whole`'s stroke is url(#tm-groundFade), not a colour, so a redraw
         would have nothing to mix from; the answer is kept on the element. */
      if (!whole.dataset.calmInk) whole.dataset.calmInk = getComputedStyle(whole).stroke;
      const calm = whole.dataset.calmInk;
      const warm = getComputedStyle(graph).getPropertyValue("--steep-ink").trim()
                   || "rgb(232,80,58)";
      /* A COLOUR FROM THE STYLESHEET COMES BACK EITHER WAY. getComputedStyle
         resolves `stroke` to rgb(...) but returns a custom property as written,
         and --steep-ink is #e8503a, which read as numbers gives 8, 503 and 3, a
         colour the browser throws away (every stop came out plain white). */
      const rgb = text => {
        const t = String(text).trim();
        const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(t);
        if (hex) {
          const h = hex[1].length === 3 ? hex[1].replace(/./g, c => c + c) : hex[1];
          return [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16));
        }
        const m = t.match(/-?[\d.]+/g);
        return m && m.length >= 3 ? m.slice(0, 3).map(Number) : [255, 255, 255];
      };
      const a = rgb(calm), b = rgb(warm);
      const between = t => "rgb(" + a.map((v, i) =>
        Math.round(v + (b[i] - v) * t)).join(",") + ")";

      const across = (TRAIL.length / (n - 1)) * TRAIL.perMetre;   // metres along
      const steps = Math.min(SETTINGS.colourStops, n - 1);
      const svgNS = "http://www.w3.org/2000/svg";
      let defs = svg.querySelector("defs");
      if (!defs) { defs = document.createElementNS(svgNS, "defs"); svg.insertBefore(defs, svg.firstChild); }
      const was = defs.querySelector("#tm-groundFade");
      if (was) was.remove();
      const grad = document.createElementNS(svgNS, "linearGradient");
      grad.setAttribute("id", "tm-groundFade");
      grad.setAttribute("x1", "0"); grad.setAttribute("y1", "0");
      grad.setAttribute("x2", "1"); grad.setAttribute("y2", "0");

      for (let k = 0; k <= steps; k++) {
        /* the steepness AROUND this stop rather than at it: one sample of a
           hand-drawn profile is noise */
        const at = k / steps;
        const w = 1 / (steps * 2);
        const up = TRAIL.metresAt(Math.min(1, at + w)) - TRAIL.metresAt(Math.max(0, at - w));
        const run = across * (n - 1) * Math.min(1, at + w) - across * (n - 1) * Math.max(0, at - w);
        const grade = run ? Math.abs(up / run * 100) : 0;
        /* ── HOW WARM THIS BIT OF GROUND IS ──────────────────────────────
           Only the steepest ground is the full colour. The curve is deliberately
           slow to leave white: raised to a power, a gentle slope barely tints,
           a middling one is pale orange, and red is kept for the bits that
           would make you get off and push. (An eased ramp is symmetrical, so
           half the threshold gave half the colour and a merely not-flat trail
           looked alarming end to end.) */
        let t = Math.max(0, Math.min(1, grade / SETTINGS.steepAt));
        t = Math.pow(t, SETTINGS.steepCurve);
        const stop = document.createElementNS(svgNS, "stop");
        stop.setAttribute("offset", at.toFixed(4));
        stop.setAttribute("stop-color", between(t * SETTINGS.steepMost));
        grad.appendChild(stop);
      }
      defs.appendChild(grad);
      whole.style.stroke = "url(#tm-groundFade)";
    }
    colourByGround();

    /* ── THE GRADIENT UNDER THE POINTER ────────────────────────────────────
       Only while dragging: standing still it would be a number nobody asked
       for on top of the graph. */
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
       The graph is a slider, so it is one to a keyboard too: left and right
       step a waypoint at a time (the same journey as the two arrows), Home and
       End go to the ends, and the whole trail can be walked without a mouse. */
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

  /* THE GRAPH IS BUILT WHEN THE ARTWORK HAS LOADED, well after this file runs.
     The engine says `trail:ready` when finished; `load` is a belt and braces
     for this file arriving after that was said. `wired` makes running twice
     harmless. */
  document.addEventListener("trail:ready", begin);
  window.addEventListener("load", () => setTimeout(begin, 0));
})();
