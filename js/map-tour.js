/* ═══════════════════════════════════════════════════════════════════════════
   HAPPY TRAILS — THE TOUR OF THE WHOLE NETWORK
   version 2.0

   WHAT THIS IS. The trail pages walk one trail; this walks all of them. Press
   play on the main map and it flies from one featured waypoint to the next,
   anywhere in the region, opening each card and turning its pages and its
   pictures before moving on.

   IT IS THE SAME IDEA AS autoplay.js AND ALMOST NONE OF THE SAME CODE. A trail
   page is a scroll, so a tour there puts the page at a certain height; the map
   is flown over, so a tour here puts a point in the middle of the screen at a
   chosen zoom. What they share (how long a card is worth, and when its text and
   pictures turn) is in tour-pace.js, asked by both, so the two tours cannot
   drift apart on the one question where they must agree.

   THE ORDER ON THE WAY OUT: between waypoints the line draws itself back into
   its icon first and the card goes only once the line has gone
   (`HT.putAway(true)` waits for the whole of it). The same goes for Stop and
   the arrows. See leader-line.js.

   WHERE IT PUTS THE WAYPOINT: not in the middle. The card comes up in a column
   on the right, so the waypoint is placed left of centre by about the card's
   width, and you can see the thing being talked about and the talking at once.

   IT STOPS THE MOMENT ANYBODY TOUCHES THE MAP (dragging, zooming, pressing a
   waypoint, Escape, or the button again): a map that keeps flying away while
   somebody is trying to look at something is worse than no tour.

   TO USE IT:  <script src="js/map-tour.js"></script> after the map's own script,
   with tour-pace.js before it. It needs window.HT.tour, which index.html
   publishes; without it nothing happens and the page is as it was.
   ═══════════════════════════════════════════════════════════════════════════ */

(function () {
  "use strict";

  const DEFAULTS = {
    /* THE ONE DIAL. Every duration below is divided by this, so the tour's
       pace is one number (autoplay.js works the same way). How long each card
       is read for lives in tour-pace.js, once, for both tours. */
    speed:         3,

    /* HOW CLOSE IT FLIES IN, as a multiple of the zoom at which the featured
       waypoints appear at all. Past it the waypoint is plainly ON something, a
       particular corner of a particular trail, which is why it goes there. */
    closeness:     1.55,

    /* WHERE THE WAYPOINT SITS on the screen, across and down, as fractions.
       Left of centre so the card does not cover it. On a narrow screen the
       card covers the bottom instead, so it is lifted rather than moved. */
    restsAt:       [0.34, 0.42],
    restsAtPhone:  [0.5, 0.3],
    phoneWidth:    860,

    /* IN A DIFFERENT ORDER EVERY TIME: more waypoints than anybody watches in
       one sitting, so a fixed order would mean most are never seen. The count
       in the corner still says how far through you are. */
    shuffle:       true,

    /* The flight between two waypoints, and the pause after a card closes
       before setting off again. */
    flyMs:         1500,
    betweenCards:  520,
    settleFirst:   520,

    /* HOW LONG TO LET A CARD GROW before measuring it. When the tour opens a
       card at the size the reader left the last one (see wantBig) the panel
       travels between shapes, and how many pages the words break into depends
       on where it ends; measure too early and the first page is broken against
       the small card but shown in the big one. The card's grow time plus a
       little. */
    growWait:      460,
  };

  let wired = false;

  function begin() {
    if (wired) return;
    const HT = window.HT && window.HT.tour;
    if (!HT || !window.HappyTrailsPace) return;
    const button = document.getElementById("ht-play");
    if (!button) return;
    wired = true;

    const asked = Object.assign({}, window.HappyTrailsPace.DEFAULTS, DEFAULTS,
                                HT.settings.mapTour || {});
    const S = {};
    const pace = asked.speed || 1;
    for (const k in asked) {
      S[k] = (typeof asked[k] === "number" && k !== "speed" && k !== "wordsPerMinute"
              && k !== "closeness" && k !== "phoneWidth")
           ? asked[k] / pace : asked[k];
    }
    const WORDS = HT.words;

    /* ── THE ROW OF CONTROLS, WHICH IS THE TRAIL PAGES' ROW ────────────────
       One row, bottom left, of the same buttons as a trail page: the page
       writes the arrows, play button and count (#ht-stepper in index.html) and
       this file adds the pause and the words. Somebody who has pressed play on
       a trail page knows what it does: there is one tour control on this site
       and it looks the same wherever it appears. */
    const row = document.getElementById("ht-stepper");
    const back = document.getElementById("ht-stepBack");
    const on = document.getElementById("ht-stepOn");
    const count = document.getElementById("ht-stepCount");
    if (!row || !back || !on || !count) return;
    button.title = WORDS.playTour || "Tour the network";
    button.setAttribute("aria-label", button.title);
    back.title = WORDS.tourBack || "Previous";
    back.setAttribute("aria-label", back.title);
    on.title = WORDS.tourOn || "Next";
    on.setAttribute("aria-label", on.title);

    /* THE STOP BUTTON, in index.html beside the others. Separate from
       play/pause as on the trail pages: stopping closes the card and hands the
       map back, pausing leaves everything where it is so you can finish
       reading. */
    const stopBtn = document.getElementById("ht-stop");
    if (!stopBtn) return;
    stopBtn.title = WORDS.stopTour || "Stop the tour";   // named from the start, not only once a tour is running
    stopBtn.setAttribute("aria-label", stopBtn.title);

    /* and the words, which join the row after the count */
    const note = document.createElement("div");
    note.className = "tm-tourNote";
    note.id = "ht-tourNote";
    note.setAttribute("role", "status");
    const how = document.createElement("span");
    how.textContent = WORDS.tourEscape || "Press Esc to leave the tour";
    note.appendChild(how);

    let running = false, tween = 0, jump = 0, held = false;

    /* ── EVERY WAIT IN THE TOUR IS ON ONE CLOCK ────────────────────────────
       The clock from tour-pace.js that the trail pages' tour also runs on: it
       can be stopped and restarted where it stopped, which setTimeout cannot,
       so pausing is one instruction and the two tours pause identically. */
    const clock = window.HappyTrailsPace.clock();
    const later = (fn, ms) => clock.at(ms, fn);
    const clearAll = () => clock.clear();
    const hold = ms => (running ? clock.wait(ms) : Promise.resolve());

    /* ── PAUSING ───────────────────────────────────────────────────────────
       Three things stop together as views of the same clock: the waits, the
       green line round the card, and the words at the end of the row. A line
       still filling on a paused tour would say something untrue. */
    function holdTour(state) {
      if (!running || held === !!state) return;
      held = !!state;
      if (held) clock.pause(); else clock.resume();
      if (window.HappyTrailsEdge) window.HappyTrailsEdge.hold(held);
      /* `is-on` on the play button means PLAYING, so a held tour shows the
         triangle again (the offer to carry on). The row's `is-touring` keeps
         the button green and the stop button on screen while held. */
      button.classList.toggle("is-on", !held);
      button.setAttribute("aria-pressed", held ? "false" : "true");
      button.title = held ? (WORDS.tourGoOn || "Carry on")
                          : (WORDS.tourHold || "Pause the tour");
      button.setAttribute("aria-label", button.title);
      how.textContent = held
        ? (WORDS.tourHeld || "Paused — press play to carry on")
        : (WORDS.tourEscape || "Press Esc to leave the tour");
    }
    stopBtn.addEventListener("click", e => { e.stopPropagation(); stop(); });

    /* ONE BUTTON, THREE MEANINGS: nothing running means start, running means
       hold, held means carry on. */
    function toggle() {
      if (!running) start();
      else holdTour(!held);
    }

    /* AN ARROW. The pending slide and page turns go with it (they belong to a
       card about to be left) and whatever the tour is waiting on is cut short.
       A PAUSED TOUR STAYS PAUSED: an arrow means "show me the next one", not
       "and start the clock again". */
    function step(by) {
      if (!running) return;
      jump = by;
      clearAll();
      clock.cut();
    }

    /* ── AND THE SAME ARROWS WITH NO TOUR RUNNING ──────────────────────────
       The featured waypoints are in a fixed order, which is a walk in all but
       name, so the arrows fly to the next and previous one and open its card,
       and the count says which you are on, tour or not, as on a trail page.

       WHERE IT STEPS FROM is asked of the PAGE, not remembered here: somebody
       who clicks a badge by hand has moved the cursor, and a second idea of
       "current" kept in this file would quietly disagree with the map. */
    let at = -1;
    /* NOTHING IS SAID UNTIL THERE IS SOMETHING TO SAY: a "— / 36" readout
       announces that it has no reading and takes up room doing it. With no
       waypoint current it is not there, and the stylesheet grows it into the
       row once it has a number. */
    function sayWhere() {
      const live = HT.liveFeatures();
      const k = live.indexOf(at);
      if (k < 0) { count.classList.remove("is-said"); return; }
      count.hidden = false;
      count.textContent = (WORDS.tourAt || "{n} / {of}")
        .replace("{n}", k + 1).replace("{of}", live.length);
      count.classList.add("is-said");
    }
    async function hop(by) {
      const live = HT.liveFeatures();
      if (!live.length) return;
      const open = HT.openAt ? HT.openAt() : -1;
      let k = live.indexOf(open >= 0 ? open : at);
      /* nothing open and nowhere been: forward lands on the first, back on the
         last */
      if (k < 0) k = by > 0 ? -1 : live.length;
      k = Math.max(0, Math.min(live.length - 1, k + by));
      at = live[k];
      sayWhere();
      // the line goes back first, then the card, then the map moves on
      await HT.putAway(true);
      await flyTo(HT.features()[at], true);
      HT.show(at);
    }

    const arrow = by => e => {
      e.stopPropagation();
      if (running) step(by); else hop(by);
    };
    back.addEventListener("click", arrow(-1));
    on.addEventListener("click", arrow(1));
    /* a badge clicked by hand moves the count too, read a frame later when the
       page has recorded which one is open */
    document.addEventListener("click", e => {
      if (running) return;
      if (!e.target.closest || !e.target.closest(".ht-feat")) return;
      requestAnimationFrame(() => { at = HT.openAt ? HT.openAt() : -1; sayWhere(); });
    });
    sayWhere();
    const still = () => window.matchMedia &&
                        window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    /* ── FLYING TO ONE ─────────────────────────────────────────────────────
       Its own tween rather than the map's glide, as in the trail tour: the
       glide picks its own pace and cannot say when it has arrived.

       WHY IT INTERPOLATES A MAP POINT AND NOT THE MAP'S POSITION. Sliding the
       map's x, y and zoom from where they are to where they must end looks
       reasonable and swerves: x and y are in SCREEN pixels, which mean very
       different amounts of map at the two ends of the journey, so at an even
       rate while the zoom multiplies the destination drifts to one side and
       swings back as the zoom catches up.

       So what travels is the MAP POINT under a fixed spot on the screen, in a
       straight line at an even rate from whatever was under that spot to the
       waypoint; the zoom multiplies itself; and the map's x and y are worked
       out from those two every frame. The waypoint comes straight at you and
       lands exactly where it was going to. */
    function flyTo(f, always) {
      return new Promise(done => {
        /* `always` is for the arrows with no tour running: the same flight and
           landing, asked for by a person rather than the loop, so stepping by
           hand and being taken there look the same. */
        if (!running && !always) { done(); return; }
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
          if (!running && !always) { done(); return; }
          const t = Math.min(1, (now - began) / S.flyMs);
          const e = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
          place(wasOn.x + (f.x - wasOn.x) * e,
                wasOn.y + (f.y - wasOn.y) * e,
                // the zoom multiplies rather than adds, so a flight from far
                // out to close in is one steady move
                from.scale * Math.pow(want / from.scale, e));
          if (t < 1) tween = requestAnimationFrame(step); else done();
        };
        tween = requestAnimationFrame(step);
      });
    }

    /* ── HOW BIG THE READER WANTS THE CARDS ────────────────────────────────
       Halfway through a tour somebody presses expand to see the photographs
       properly; without this the next card arrived small again, once per
       waypoint, the tour overruling the reader every few seconds.

       So the tour carries one piece of the reader's state, whether the card
       was left expanded, read at the END of each card when what they did has
       settled and applied to the next as it opens. Nothing is stored between
       visits.

       IT DOES NOT OUTLIVE THE TOUR. Stop or Escape resets it to false: a
       preference expressed inside a show is about the show. */
    let wantBig = false;

    /* ── ONE CARD ──────────────────────────────────────────────────────────  */
    async function showCard(i) {
      HT.show(i);
      await hold(S.settleFirst);
      if (!running) return;
      const card = HT.deck().cards[i];
      if (!card) return;

      // the size the last card was left at, before anything is measured
      const deck = HT.deck();
      if (wantBig && deck.isBig && !deck.isBig() && deck.setBig) {
        deck.setBig(true, i);
        await hold(S.growWait);
        if (!running) return;
      }

      HT.deck().measureOne(card);
      const it = window.HappyTrailsPace.plan(card, S);
      if (!it) return;

      HT.deck().showPage(card, 0);
      HT.deck().showSlide(card, 0);

      /* THE LINE ROUND THE CARD, over exactly the time this card has: asked
         of the same files (tour-pace.js for the number, tour-edge.js for the
         line) with the same number as the trail pages' tour. */
      if (window.HappyTrailsEdge) window.HappyTrailsEdge.draw(card, it.dwell);

      const turn = (howMany, move) => {
        window.HappyTrailsPace.moments(howMany, it.dwell).forEach(m => {
          later(() => { if (running) move(m.j); }, m.at);
        });
      };
      turn(it.pages, j => HT.deck().showPage(card, j));
      turn(it.slides, j => HT.deck().showSlide(card, j));
      await hold(it.dwell);
      // whatever they left it at is what the next one opens as
      if (HT.deck().isBig) wantBig = HT.deck().isBig();
      if (window.HappyTrailsEdge) window.HappyTrailsEdge.clear(card);
    }

    /* A DIFFERENT WALK EVERY TIME. Fisher-Yates, which is actually uniform;
       sorting by a random comparator is not, and the bias is visible as the
       same few tending to come first. */
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
        at = i;                       // so the arrows carry on from here after
        count.hidden = false;
        count.textContent = (WORDS.tourAt || "{n} / {of}")
          .replace("{n}", n + 1).replace("{of}", live.length);
        count.classList.add("is-said");
        await flyTo(HT.features()[i]);
        if (!running) return;
        if (!jump) await showCard(i);
        if (!running) return;
        /* THE LINE GOES FIRST, THEN THE CARD: putAway(true) waits for the
           whole of the line's drawing-back. */
        await HT.putAway(true);
        if (!running) return;
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
      button.title = WORDS.tourHold || "Pause the tour";
      button.setAttribute("aria-label", button.title);
      stopBtn.title = WORDS.stopTour || "Stop the tour";
      stopBtn.setAttribute("aria-label", stopBtn.title);
      /* the row grows the pieces that belong to the tour: the two arrows, the
         count and the pause */
      row.classList.add("is-touring");
      row.appendChild(note);
      requestAnimationFrame(() => note.classList.add("is-on"));
      fly();
    }

    function stop() {
      if (!running) return;
      /* LET GO OF THE PAUSE FIRST. A paused clock cannot run the timer that
         takes the note off the screen, so a tour stopped while paused would
         leave its note there for ever. */
      holdTour(false);
      running = false;
      wantBig = false;          // the show is over; cards are ordinary again
      clearAll();
      if (tween) cancelAnimationFrame(tween);
      tween = 0;
      if (window.HappyTrailsEdge) window.HappyTrailsEdge.clear();
      button.classList.remove("is-on");
      button.setAttribute("aria-pressed", "false");
      button.title = WORDS.playTour || "Tour the network";
      button.setAttribute("aria-label", button.title);
      note.classList.remove("is-on");
      setTimeout(() => {
        if (note.parentNode) note.parentNode.removeChild(note);
        row.classList.remove("is-touring");
      }, 260);
      HT.putAway();               // stopping puts the card away the same way
      /* THE COUNT MEANS SOMETHING DIFFERENT NOW, so it is rewritten: during a
         tour it says how far through THE TOUR you are (shuffled, so the fourth
         stop is not the fourth waypoint), with no tour it says which waypoint
         is open. One number cannot mean both. */
      sayWhere();
    }

    button.addEventListener("click", e => {
      e.stopPropagation();        // the map's own click handler must not see it
      toggle();
    });

    /* ANYTHING AT ALL STOPS IT. The map publishes the same `trail:handover` as
       the trail pages, from the handlers of real events (a drag, a wheel, a
       waypoint, a panel), so this file need not know what they are. */
    document.addEventListener("trail:handover", () => { if (running) stop(); });
    /* SOMEBODY TYPING IS NOT PRESSING A CONTROL: the coordinate reader is a
       textarea, and a space typed into it must be a space. */
    const typing = e => {
      const n = e.target;
      return !!n && (n.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(n.tagName));
    };
    document.addEventListener("keydown", e => {
      if (typing(e)) return;
      /* SPACE IS PLAY AND PAUSE, as on every trail page. preventDefault
         because the browser's meaning for it is "scroll", and this page does
         not scroll. */
      if (e.key === " " || e.code === "Space") {
        e.preventDefault();
        e.stopPropagation();
        toggle();
        return;
      }
      if (running && e.key === "Escape") { e.stopPropagation(); stop(); }
    }, true);

    /* and a link may ask for it, the same word the trail pages use */
    if (/(^|[?&])play($|[=&])/.test(location.search)) setTimeout(start, 1200);
  }

  document.addEventListener("map:ready", begin);
  window.addEventListener("load", () => setTimeout(begin, 0));
})();
