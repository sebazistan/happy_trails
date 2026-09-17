/* ═══════════════════════════════════════════════════════════════════════════
   HAPPY TRAILS — THE TOUR OF THE WHOLE NETWORK
   version 1.1

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
    speed:         3,

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

    /* IN A DIFFERENT ORDER EVERY TIME. Thirty-six waypoints is more than
       anybody watches in one sitting, so a tour that always begins in the same
       corner and works along the same line is a tour most of which nobody ever
       sees. Shuffled, it is a different walk each time — and the count in the
       corner still says how far through it you are. */
    shuffle:       true,

    /* The flight between two waypoints, and the pause after a card closes
       before setting off again. */
    flyMs:         1500,
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

    /* THE LINE AT THE FOOT OF THE SCREEN: where the tour has got to, how to
       leave it, and two arrows for going on or back. The arrows are here
       rather than anywhere else because this is the only thing on the screen
       that belongs to the tour — everything else belongs to the map. */
    const note = document.createElement("div");
    note.className = "tm-tourNote";
    note.id = "ht-tourNote";
    note.setAttribute("role", "status");
    const arrow = (way, d, label) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "tm-tourStep is-" + way;
      b.title = label; b.setAttribute("aria-label", label);
      b.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" ' +
        'stroke="currentColor" stroke-width="2.4" stroke-linecap="round" ' +
        'stroke-linejoin="round"><path d="' + d + '"/></svg>';
      return b;
    };
    const back = arrow("back", "M15 5 8 12l7 7", WORDS.tourBack || "Previous");
    const on = arrow("on", "M9 5l7 7-7 7", WORDS.tourOn || "Next");
    const count = document.createElement("b");
    const how = document.createElement("span");
    how.textContent = WORDS.tourEscape || "Press Esc to leave autoplay";
    note.appendChild(back);
    note.appendChild(count);
    note.appendChild(on);
    note.appendChild(how);

    let running = false, tween = 0, jump = 0;
    const timers = [];
    const later = (fn, ms) => { timers.push(setTimeout(fn, ms)); };
    const clearAll = () => { while (timers.length) clearTimeout(timers.pop()); };

    /* ── WAITING, AND BEING CUT SHORT ──────────────────────────────────────
       Every wait in the tour is one of these. `cutShort` is the handle on the
       one currently running, so an arrow can end it early instead of the tour
       having to poll a flag: the wait resolves, the loop carries on, and the
       loop is the only place that has to know what "on" and "back" mean. */
    let cutShort = null;
    const hold = ms => new Promise(done => {
      if (!running) { done(); return; }
      const t = setTimeout(() => { cutShort = null; done(); }, ms);
      timers.push(t);
      cutShort = () => { clearTimeout(t); cutShort = null; done(); };
    });

    /* AN ARROW. The pending slide and page turns go with it — they belong to a
       card that is about to be left — and then whatever the tour is waiting on
       is cut short so the loop moves at once. */
    function step(by) {
      if (!running) return;
      jump = by;
      clearAll();
      if (cutShort) cutShort(); 
    }
    back.addEventListener("click", e => { e.stopPropagation(); step(-1); });
    on.addEventListener("click", e => { e.stopPropagation(); step(1); });
    const still = () => window.matchMedia &&
                        window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    /* ── FLYING TO ONE ─────────────────────────────────────────────────────
       Its own tween rather than the map's glide, for the same reason the trail
       tour has its own: the glide has a pace of its own choosing and no way to
       say when it has arrived, and this one can be cut off in a frame.

       WHY IT INTERPOLATES A MAP POINT AND NOT THE MAP'S POSITION, which is the
       whole reason the flight used to swerve.

       The obvious way is to work out where the map has to END UP — its x, its
       y, its zoom — and slide all three from where they are now to there. It
       looks reasonable and it is wrong, because x and y are in SCREEN pixels
       and they mean completely different amounts of map at the two ends of the
       journey. Sliding them at an even rate while the zoom multiplies itself
       puts the place you are travelling to somewhere different on the screen
       in every frame: it drifts off to one side, and comes swinging back as
       the zoom catches up. That is the swerve.

       So what travels is the MAP POINT under a fixed spot on the screen. It
       goes in a straight line, at an even rate, from whatever was under that
       spot to the waypoint; the zoom multiplies itself as before; and the
       map's x and y are worked out from those two every frame rather than
       being animated themselves. The waypoint comes straight at you and lands
       exactly where it was always going to. */
    function flyTo(f) {
      return new Promise(done => {
        if (!running) { done(); return; }
        const narrow = window.innerWidth <= S.phoneWidth;
        const rests = narrow ? S.restsAtPhone : S.restsAt;
        const box = HT.stage();
        // the fixed spot on the screen that the waypoint is flying towards
        const hold = { x: box.width * rests[0], y: box.height * rests[1] };
        const want = HT.fitScale() * HT.featuredFrom() * S.closeness;

        const from = { x: HT.view.x, y: HT.view.y, scale: HT.view.scale };
        // what is under that spot right now, in the map's own coordinates
        const wasOn = { x: (hold.x - from.x) / from.scale,
                        y: (hold.y - from.y) / from.scale };

        const place = (mx, my, scale) => {
          const at = { x: hold.x - mx * scale, y: hold.y - my * scale, scale: scale };
          HT.settle(at);
          HT.jumpTo(at);
        };
        if (still()) { place(f.x, f.y, want); done(); return; }

        const began = performance.now();
        const step = now => {
          if (!running) { done(); return; }
          const t = Math.min(1, (now - began) / S.flyMs);
          const e = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
          place(wasOn.x + (f.x - wasOn.x) * e,
                wasOn.y + (f.y - wasOn.y) * e,
                // the zoom doubles and halves rather than adding, so a flight
                // from far out to close in is one steady move
                from.scale * Math.pow(want / from.scale, e));
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
        window.HappyTrailsPace.moments(count, it.dwell).forEach(m => {
          later(() => { if (running) move(m.j); }, m.at);
        });
      };
      turn(it.pages, j => HT.deck().showPage(card, j));
      turn(it.slides, j => HT.deck().showSlide(card, j));
      await hold(it.dwell);
    }

    /* A DIFFERENT WALK EVERY TIME. Fisher-Yates, which is the shuffle that is
       actually uniform — the tempting one-liner that sorts by a random
       comparator is not, and with thirty-six waypoints the bias is visible as
       the same few tending to come first. */
    function shuffled(list) {
      const out = list.slice();
      for (let i = out.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        const t = out[i]; out[i] = out[j]; out[j] = t;
      }
      return out;
    }

    async function fly() {
      const live = S.shuffle ? shuffled(HT.liveFeatures()) : HT.liveFeatures();
      if (!live.length) { stop(); return; }
      /* a `while` rather than a `for`, because the arrows move `n` too */
      let n = 0;
      while (n < live.length) {
        if (!running) return;
        jump = 0;
        const i = live[n];
        count.hidden = false;
        count.textContent = (WORDS.tourAt || "{n} of {of}")
          .replace("{n}", n + 1).replace("{of}", live.length);
        back.disabled = n <= 0;
        await flyTo(HT.features()[i]);
        if (!running) return;
        if (!jump) await showCard(i);
        if (!running) return;
        HT.show(-1);
        if (!jump) await hold(S.betweenCards);
        n = jump ? Math.max(0, Math.min(live.length - 1, n + jump)) : n + 1;
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
