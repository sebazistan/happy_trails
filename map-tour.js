/* ═══════════════════════════════════════════════════════════════════════════
   HAPPY TRAILS — THE TOUR OF THE WHOLE NETWORK
   version 1.0

   WHAT THIS IS. The trail pages walk one trail; this walks all of them. Press
   play on the main map and it flies from one featured waypoint to the next,
   anywhere in the region, opening each card and turning its pages and its
   pictures before moving on.

   IT IS THE SAME IDEA AS autoplay.js AND ALMOST NONE OF THE SAME CODE, because
   the two pages move in completely different ways. A trail page is a scroll: a
   tour there is a matter of putting the page at a certain height. The map is a
   thing you fly over: a tour here is a matter of putting a point in the middle
   of the screen at a chosen zoom. The one thing they genuinely share — how
   long a card is worth, and when its text and its pictures should turn — is in
   tour-pace.js, asked by both, so the two tours cannot drift apart on the only
   question where they must agree.

   WHERE IT PUTS THE WAYPOINT. Not in the middle. The card comes up in a column
   on the right, and a waypoint centred on the screen would spend the whole
   tour underneath it. It is placed to the left of centre by as much as the
   card is wide, so you can see the thing being talked about and the talking at
   the same time.

   IT STOPS THE MOMENT ANYBODY TOUCHES THE MAP. Dragging, zooming, pressing a
   waypoint, Escape, or the button again. A map that keeps flying away while
   somebody is trying to look at something is worse than no tour at all.

   TO USE IT:  <script src="map-tour.js"></script> after the map's own script,
   with tour-pace.js before it. It needs window.HT.tour, which index.html
   publishes; without it, nothing happens and the page is exactly as it was.
   ═══════════════════════════════════════════════════════════════════════════ */

(function () {
  "use strict";

  const DEFAULTS = {
    /* THE ONE DIAL. Every duration below is divided by this, so the tour's
       pace is one number. See autoplay.js, which works the same way. */
    speed:         2,

    wordsPerMinute: 200,
    leastOnACard:   4200,
    mostOnACard:    42000,
    leastOnASlide:  3400,
    mostOnAVideo:   14000,

    /* HOW CLOSE IT FLIES IN, as a multiple of the zoom at which the featured
       waypoints appear at all. Past that multiple the map is close enough that
       the waypoint is plainly ON something — a particular corner of a
       particular trail — which is the whole reason for going there. */
    closeness:     1.55,

    /* WHERE THE WAYPOINT SITS on the screen, across and down, as fractions.
       Left of centre so the card does not cover it. On a narrow screen the
       card covers the bottom instead, so it is lifted rather than moved. */
    restsAt:       [0.34, 0.42],
    restsAtPhone:  [0.5, 0.3],
    phoneWidth:    860,

    /* The flight between two waypoints, and the pause after a card closes
       before setting off again. */
    flyMs:         2200,
    betweenCards:  520,
    settleFirst:   520,
  };

  let wired = false;

  function begin() {
    if (wired) return;
    const HT = window.HT && window.HT.tour;
    if (!HT || !window.HappyTrailsPace) return;
    const button = document.getElementById("ht-play");
    if (!button) return;
    wired = true;

    const asked = Object.assign({}, DEFAULTS, HT.settings.mapTour || {});
    const S = {};
    const pace = asked.speed || 1;
    for (const k in asked) {
      S[k] = (typeof asked[k] === "number" && k !== "speed" && k !== "wordsPerMinute"
              && k !== "closeness" && k !== "phoneWidth")
           ? asked[k] / pace : asked[k];
    }
    const WORDS = HT.words;

    /* the line at the foot of the screen, and where the tour has got to */
    const note = document.createElement("div");
    note.className = "tm-tourNote";
    note.id = "ht-tourNote";
    note.setAttribute("role", "status");
    const count = document.createElement("b");
    const how = document.createElement("span");
    how.textContent = WORDS.tourEscape || "Press Esc to leave autoplay";
    note.appendChild(count);
    note.appendChild(how);

    let running = false, tween = 0;
    const timers = [];
    const later = (fn, ms) => { timers.push(setTimeout(fn, ms)); };
    const clearAll = () => { while (timers.length) clearTimeout(timers.pop()); };
    const hold = ms => new Promise(done => {
      if (!running) { done(); return; }
      later(done, ms);
    });
    const still = () => window.matchMedia &&
                        window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    /* ── FLYING TO ONE ─────────────────────────────────────────────────────
       Its own tween rather than the map's glide, for the same reason the trail
       tour has its own: the glide has a pace of its own choosing and no way to
       say when it has arrived, and this one can be cut off in a frame. It
       moves in log space on the zoom — doubling and halving, not adding — so a
       flight from far out to close in feels like one steady move rather than
       a rush at one end and a crawl at the other. */
    function flyTo(f) {
      return new Promise(done => {
        if (!running) { done(); return; }
        const narrow = window.innerWidth <= S.phoneWidth;
        const rests = narrow ? S.restsAtPhone : S.restsAt;
        const box = HT.stage();
        const want = HT.fitScale() * HT.featuredFrom() * S.closeness;
        const to = {
          scale: want,
          x: box.width * rests[0] - f.x * want,
          y: box.height * rests[1] - f.y * want,
        };
        HT.settle(to);
        const from = { x: HT.view.x, y: HT.view.y, scale: HT.view.scale };
        if (still()) { HT.jumpTo(to); done(); return; }

        const began = performance.now();
        const step = now => {
          if (!running) { done(); return; }
          const t = Math.min(1, (now - began) / S.flyMs);
          const e = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
          HT.jumpTo({
            // the zoom is interpolated geometrically; the position linearly
            scale: from.scale * Math.pow(to.scale / from.scale, e),
            x: from.x + (to.x - from.x) * e,
            y: from.y + (to.y - from.y) * e,
          });
          if (t < 1) tween = requestAnimationFrame(step); else done();
        };
        tween = requestAnimationFrame(step);
      });
    }

    /* ── ONE CARD ──────────────────────────────────────────────────────────  */
    async function showCard(i) {
      HT.show(i);
      await hold(S.settleFirst);
      if (!running) return;
      const card = HT.deck().cards[i];
      if (!card) return;
      HT.deck().measureOne(card);
      const it = window.HappyTrailsPace.plan(card, S);
      if (!it) return;

      HT.deck().showPage(card, 0);
      HT.deck().showSlide(card, 0);
      const turn = (count, move) => {
        window.HappyTrailsPace.moments(count, it.endAt).forEach(m => {
          later(() => { if (running) move(m.j); }, m.at);
        });
      };
      turn(it.pages, j => HT.deck().showPage(card, j));
      turn(it.slides, j => HT.deck().showSlide(card, j));
      await hold(it.dwell);
    }

    async function fly() {
      const live = HT.liveFeatures();
      if (!live.length) { stop(); return; }
      for (let n = 0; n < live.length; n++) {
        if (!running) return;
        const i = live[n];
        count.hidden = false;
        count.textContent = (WORDS.tourAt || "{n} of {of}")
          .replace("{n}", n + 1).replace("{of}", live.length);
        await flyTo(HT.features()[i]);
        if (!running) return;
        await showCard(i);
        if (!running) return;
        HT.show(-1);
        await hold(S.betweenCards);
      }
      if (running) stop();
    }

    function start() {
      if (running) return;
      running = true;
      button.classList.add("is-on");
      button.setAttribute("aria-pressed", "true");
      button.setAttribute("aria-label", WORDS.stopTour || "Stop playing");
      button.title = WORDS.stopTour || "Stop playing";
      document.body.appendChild(note);
      requestAnimationFrame(() => note.classList.add("is-on"));
      fly();
    }

    function stop() {
      if (!running) return;
      running = false;
      clearAll();
      if (tween) cancelAnimationFrame(tween);
      tween = 0;
      button.classList.remove("is-on");
      button.setAttribute("aria-pressed", "false");
      button.setAttribute("aria-label", WORDS.playTour || "Tour the network");
      button.title = WORDS.playTour || "Tour the network";
      note.classList.remove("is-on");
      later(() => { if (note.parentNode) note.parentNode.removeChild(note); }, 260);
      HT.show(-1);
    }

    button.addEventListener("click", e => {
      e.stopPropagation();        // the map's own click handler must not see it
      running ? stop() : start();
    });

    /* ANYTHING AT ALL STOPS IT. The map publishes the same `trail:handover`
       the trail pages do, from the handlers of real events — a drag, a wheel,
       a waypoint, a panel. This file does not need to know what any of them
       are. */
    document.addEventListener("trail:handover", () => { if (running) stop(); });
    document.addEventListener("keydown", e => {
      if (running && e.key === "Escape") { e.stopPropagation(); stop(); }
    }, true);

    /* and a link may ask for it, the same word the trail pages use */
    if (/(^|[?&])play($|[=&])/.test(location.search)) setTimeout(start, 1200);
  }

  document.addEventListener("map:ready", begin);
  window.addEventListener("load", () => setTimeout(begin, 0));
})();
