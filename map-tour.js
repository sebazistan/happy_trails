/* ═══════════════════════════════════════════════════════════════════════════
   HAPPY TRAILS — THE TOUR OF THE WHOLE NETWORK
   version 1.2

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

    /* ── THE ROW OF CONTROLS, WHICH IS THE TRAIL PAGES' ROW ────────────────
       This tour used to put its own pair of arrows and its own count inside a
       floating note at the bottom of the screen, while the play button sat by
       itself on top of the zoom controls in the other corner. Two places, two
       shapes, and nothing about either of them the same as the row every trail
       page has.

       It is one row now, in the bottom left, made of the same buttons: the
       page writes the arrows, the play button and the count (see #ht-stepper
       in index.html) and this file adds the pause and the words. Somebody who
       has pressed play on a trail page knows where this is and what it does,
       which is the whole argument — there is one tour control on this site and
       it looks the same wherever it appears. */
    const row = document.getElementById("ht-stepper");
    const back = document.getElementById("ht-stepBack");
    const on = document.getElementById("ht-stepOn");
    const count = document.getElementById("ht-stepCount");
    if (!row || !back || !on || !count) return;
    back.title = WORDS.tourBack || "Previous";
    back.setAttribute("aria-label", back.title);
    on.title = WORDS.tourOn || "Next";
    on.setAttribute("aria-label", on.title);

    /* THE PAUSE BUTTON, made here for the same reason autoplay.js makes the
       trail pages' one: it belongs to the tour and has no meaning without one.
       A SEPARATE button from play/stop on purpose — stopping closes the card
       and hands the map back, pausing leaves everything exactly where it is,
       and somebody who wants another twenty seconds with a waypoint should not
       have to lose the waypoint to get them. */
    const holdBtn = document.createElement("button");
    holdBtn.type = "button";
    holdBtn.className = "tm-step tm-hold";
    holdBtn.id = "ht-hold";
    holdBtn.innerHTML =
      '<svg class="tm-holdStop" viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">' +
        '<rect x="6" y="5" width="4.4" height="14" rx="1.4"/>' +
        '<rect x="13.6" y="5" width="4.4" height="14" rx="1.4"/></svg>' +
      '<svg class="tm-holdGo" viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">' +
        '<path d="M8 5.2v13.6L19 12z"/></svg>';
    row.insertBefore(holdBtn, on.nextSibling);

    /* and the words, which join the row after the count rather than floating
       in the middle of the bottom of the screen with a second set of arrows */
    const note = document.createElement("div");
    note.className = "tm-tourNote";
    note.id = "ht-tourNote";
    note.setAttribute("role", "status");
    const how = document.createElement("span");
    how.textContent = WORDS.tourEscape || "Press Esc to leave the tour";
    note.appendChild(how);

    let running = false, tween = 0, jump = 0, held = false;

    /* ── EVERY WAIT IN THE TOUR IS ON ONE CLOCK ────────────────────────────
       The same clock the trail pages' tour runs on, from tour-pace.js, and for
       the same reason: it can be stopped and started again where it stopped,
       which setTimeout cannot. Pausing is then one instruction rather than
       four kinds of timer that have to agree — and the two tours cannot end up
       pausing differently, because they are pausing the same object. */
    const clock = window.HappyTrailsPace.clock();
    const later = (fn, ms) => clock.at(ms, fn);
    const clearAll = () => clock.clear();
    const hold = ms => (running ? clock.wait(ms) : Promise.resolve());

    /* ── PAUSING ───────────────────────────────────────────────────────────
       Three things stop together, because they are three views of the same
       clock: the waits, the green line drawing itself round the card, and the
       words at the end of the row. A line still filling on a tour that is not
       progressing would be telling the reader something untrue. */
    function holdTour(state) {
      if (!running || held === !!state) return;
      held = !!state;
      if (held) clock.pause(); else clock.resume();
      if (window.HappyTrailsEdge) window.HappyTrailsEdge.hold(held);
      holdBtn.classList.toggle("is-held", held);
      holdBtn.title = held ? (WORDS.tourGoOn || "Carry on")
                           : (WORDS.tourHold || "Pause the tour");
      holdBtn.setAttribute("aria-label", holdBtn.title);
      holdBtn.setAttribute("aria-pressed", held ? "true" : "false");
      how.textContent = held
        ? (WORDS.tourHeld || "Paused — press play to carry on")
        : (WORDS.tourEscape || "Press Esc to leave the tour");
    }
    holdBtn.addEventListener("click", e => { e.stopPropagation(); holdTour(!held); });

    /* AN ARROW. The pending slide and page turns go with it — they belong to a
       card that is about to be left — and then whatever the tour is waiting on
       is cut short so the loop moves at once. It also lets go of a pause:
       "next" on a paused tour means go on, not go on and stop again in the
       very next instruction, which is what the loop would otherwise do. */
    function step(by) {
      if (!running) return;
      holdTour(false);
      jump = by;
      clearAll();
      clock.cut();
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

      /* THE LINE ROUND THE CARD, over exactly the time this card has. Asked
         for at the same moment, of the same file, with the same number as the
         trail pages' tour asks — which is the point of both of them going
         through tour-pace.js for the number and tour-edge.js for the line. */
      if (window.HappyTrailsEdge) window.HappyTrailsEdge.draw(card, it.dwell);

      const turn = (howMany, move) => {
        window.HappyTrailsPace.moments(howMany, it.dwell).forEach(m => {
          later(() => { if (running) move(m.j); }, m.at);
        });
      };
      turn(it.pages, j => HT.deck().showPage(card, j));
      turn(it.slides, j => HT.deck().showSlide(card, j));
      await hold(it.dwell);
      if (window.HappyTrailsEdge) window.HappyTrailsEdge.clear(card);
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
      /* the row grows the pieces that belong to the tour: the two arrows, the
         count and the pause. Before this there is nothing an arrow could mean,
         because this map has no walk to step along. */
      row.classList.add("is-touring");
      row.appendChild(note);
      requestAnimationFrame(() => note.classList.add("is-on"));
      holdBtn.title = WORDS.tourHold || "Pause the tour";
      holdBtn.setAttribute("aria-label", holdBtn.title);
      holdBtn.setAttribute("aria-pressed", "false");
      fly();
    }

    function stop() {
      if (!running) return;
      /* LET GO OF THE PAUSE FIRST. The clock is stopped while a tour is held,
         and a stopped clock cannot run the timer that takes the note off the
         screen a moment from now — so a tour stopped while paused would leave
         its own note sitting there for ever. */
      holdTour(false);
      running = false;
      clearAll();
      if (tween) cancelAnimationFrame(tween);
      tween = 0;
      if (window.HappyTrailsEdge) window.HappyTrailsEdge.clear();
      button.classList.remove("is-on");
      button.setAttribute("aria-pressed", "false");
      button.setAttribute("aria-label", WORDS.playTour || "Tour the network");
      button.title = WORDS.playTour || "Tour the network";
      note.classList.remove("is-on");
      setTimeout(() => {
        if (note.parentNode) note.parentNode.removeChild(note);
        row.classList.remove("is-touring");
      }, 260);
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
