/* ═══════════════════════════════════════════════════════════════════════════
   HAPPY TRAILS — THE TOUR
   version 1.0

   WHAT THIS IS. The play button between the two arrows walks the trail for
   you. It scrolls to a waypoint, opens its card, turns the card's pages and
   its pictures, closes it, and goes on to the next one — until the trail runs
   out or you stop it.

   NOTHING IN HERE KNOWS ANYTHING ABOUT ANY PARTICULAR TRAIL. Not how many
   waypoints there are, not how many pictures a card has, not how much is
   written on one. Every one of those is counted off the page at the moment the
   card opens, so a waypoint you add next year, with four more photographs and
   twice the text, is paced correctly without a number changing here.

   HOW THE PACE IS WORKED OUT, which is the whole of it.

     THE TEXT decides the length. The words actually on the card are counted
     and divided by a reading speed — a real one, the speed somebody reads at
     rather than the speed somebody skims at. That is how long the card is
     worth staying on.

     THE PICTURES set a floor under it. Every slide wants a minimum look, and a
     video wants its own length if it has one, so a card with eight
     photographs and one line of text is not gone in three seconds.

     THEN BOTH ARRIVE TOGETHER. The card is open for `dwell`; the last page of
     text and the last picture are both reached at the same instant, `endAt`,
     and the time from there to the end — one page's worth of reading — is the
     last page's turn to be read. The two tracks run at different rates, which
     is the point: three pages and seven pictures means the pictures change
     faster, and they still finish on the same beat.

   TWO WAYS OUT, and a line on the screen saying so: Escape, or the button
   again. It also stops the moment somebody scrolls, touches or uses the arrow
   keys, because at that point they have taken over and a page that keeps
   driving itself under them is fighting them.

   WHY IT IS ITS OWN FILE. A trail page reads perfectly well with none of this,
   and none of it should be able to break one. It reaches the engine only
   through window.TRAIL.

   TO USE IT:  <script src="autoplay.js"></script> after trail-engine.js.
   ═══════════════════════════════════════════════════════════════════════════ */

(function () {
  "use strict";

  const DEFAULTS = {
    /* ── HOW FAST THE WORDS GO BY ──────────────────────────────────────────
       Words per minute. Silent reading of unfamiliar prose runs around 200 to
       250 for most adults; this is deliberately at the slow end of that,
       because somebody on a tour is also looking at a map and a photograph
       while they read. Lower it and every card stays longer. It is the single
       biggest lever in this file. */
    wordsPerMinute: 200,

    /* AND THE FLOOR UNDER A CARD with almost nothing written on it, so a
       one-line waypoint does not flash past. Milliseconds. */
    leastOnACard:   4200,
    mostOnACard:    42000,    // and a ceiling, for a waypoint with an essay

    /* ── HOW LONG A PICTURE IS WORTH ───────────────────────────────────────
       Each slide wants at least this long. A video wants its own running time
       if the browser will say what it is, up to `mostOnAVideo` — long enough
       for a short clip to play through, short enough that a two-minute one
       does not hold the tour hostage. */
    leastOnASlide:  3400,
    mostOnAVideo:   14000,

    /* ── THE SCROLLING BETWEEN WAYPOINTS ───────────────────────────────────
       Pixels a second. Slow: the whole point of the tour is that the map moves
       under you at a pace you can watch, and the waypoints are the punctuation
       rather than the sentence. The two bounds keep a very short hop from
       being instant and a very long one from being a wait. */
    scrollSpeed:    240,
    leastTravel:    900,
    mostTravel:     5200,

    /* A beat between closing one card and setting off for the next, so the two
       movements are separate things rather than one continuous slide. */
    betweenCards:   520,

    /* How long to give the card's own opening fade before starting to turn its
       pages. It is SETTINGS.cardCloseMs on the engine's side; a little more
       here so the first page is properly up before it moves. */
    settleFirst:    420,
  };

  let wired = false;

  function begin() {
    if (wired) return;
    const TRAIL = window.TRAIL;
    if (!TRAIL || !TRAIL.deck || !TRAIL.stops || !TRAIL.pageAtStop) return;
    const button = document.getElementById("tm-play");
    if (!button) return;
    wired = true;

    const SETTINGS = Object.assign({}, DEFAULTS,
                                   (TRAIL.SETTINGS && TRAIL.SETTINGS.autoplay) || {});
    const WORDS = TRAIL.WORDS || {};
    const deck = TRAIL.deck;
    const still = () => window.matchMedia &&
                        window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    /* ── THE LINE THAT SAYS HOW TO GET OUT ─────────────────────────────────
       It only exists while the tour is running. A note about leaving something
       you are not in is noise. */
    const note = document.createElement("div");
    note.className = "tm-tourNote";
    note.id = "tm-tourNote";
    note.setAttribute("role", "status");
    note.textContent = WORDS.tourEscape || "Press Esc to leave autoplay";

    let running = false, tween = 0;
    const timers = [];
    const later = (fn, ms) => { timers.push(setTimeout(fn, ms)); };
    const clearAll = () => { while (timers.length) clearTimeout(timers.pop()); };

    /* ── WAITING, AND BEING INTERRUPTED ────────────────────────────────────
       Every wait in the tour is one of these, and every one of them resolves —
       either because the time came or because somebody stopped the tour. That
       is why nothing in here checks a flag halfway through a sleep: a stopped
       tour simply falls out of its own sequence at the next `if (!running)`. */
    function hold(ms) {
      return new Promise(done => {
        if (!running) { done(); return; }
        later(done, ms);
      });
    }

    /* ── SCROLLING THERE ───────────────────────────────────────────────────
       Its own tween rather than scrollTo({behavior:"smooth"}), for two
       reasons: the browser's own smooth scroll has a pace of its own choosing
       and no way to ask when it has finished, and this one can be cut off
       mid-flight the instant somebody presses Escape. */
    function glideTo(y) {
      return new Promise(done => {
        const from = window.scrollY;
        const gap = Math.round(y) - from;
        if (!running || !gap) { done(); return; }
        if (still()) { window.scrollTo(0, from + gap); done(); return; }
        const ms = Math.max(SETTINGS.leastTravel,
                   Math.min(SETTINGS.mostTravel,
                            Math.abs(gap) / SETTINGS.scrollSpeed * 1000));
        const began = performance.now();
        const step = now => {
          if (!running) { done(); return; }
          const t = Math.min(1, (now - began) / ms);
          // in and out, so it sets off and arrives without a jolt at either end
          const e = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
          window.scrollTo(0, Math.round(from + gap * e));
          if (t < 1) tween = requestAnimationFrame(step); else done();
        };
        tween = requestAnimationFrame(step);
      });
    }

    /* ── WHAT IS ACTUALLY ON THIS CARD ─────────────────────────────────────
       Counted, every time, off the card itself. `measureOne` is asked first
       because the number of pages depends on how tall the card is, and the
       card is only its real height once it is showing. */
    function readCard(i) {
      const card = deck.cards[i];
      if (!card) return null;
      if (deck.measureOne) deck.measureOne(card);

      const words = Array.prototype.reduce.call(
        card.querySelectorAll(".tm-textpages p"),
        (n, para) => n + (para.textContent.trim().match(/\S+/g) || []).length, 0);

      const slides = Array.prototype.slice.call(card.querySelectorAll(".tm-slide"));
      const pages = Math.max(1, card.pageCount || 1);

      /* what the pictures want between them: a plain look each, except a video
         that will say how long it runs, which wants to be seen through */
      const look = slides.reduce((sum, slide) => {
        const film = slide.querySelector("video");
        const runs = film && isFinite(film.duration) ? film.duration * 1000 : 0;
        return sum + Math.max(SETTINGS.leastOnASlide,
                              Math.min(SETTINGS.mostOnAVideo, runs));
      }, 0);

      const read = Math.min(SETTINGS.mostOnACard,
                   Math.max(SETTINGS.leastOnACard,
                            words / SETTINGS.wordsPerMinute * 60000));

      const dwell = Math.max(read, look, SETTINGS.leastOnACard);
      /* the last page's own turn to be read — one page's worth, and never less
         than a picture is worth */
      const lastLook = Math.max(SETTINGS.leastOnASlide, read / pages);
      return {
        card: card, pages: pages, slides: slides.length,
        dwell: dwell,
        endAt: Math.max(0, dwell - lastLook),
      };
    }

    /* ── ONE CARD, START TO FINISH ─────────────────────────────────────────
       The two tracks are laid out first and then simply waited through. Page
       j of P arrives at j × endAt / (P−1) and picture k of S at k × endAt /
       (S−1) — so whatever P and S are, the last of each lands on endAt
       together, and the stretch from there to `dwell` is the last page being
       read. */
    async function showCard(i) {
      TRAIL.openCard(i, true);          // quietly: no throw from the waypoint
      await hold(SETTINGS.settleFirst);
      if (!running) return;

      const it = readCard(i);
      if (!it) return;

      if (deck.showPage) deck.showPage(it.card, 0);
      if (deck.showSlide) deck.showSlide(it.card, 0);

      const turn = (count, move) => {
        if (count < 2) return;
        for (let j = 1; j < count; j++) {
          later(() => { if (running) move(j); }, j * it.endAt / (count - 1));
        }
      };
      turn(it.pages, j => deck.showPage(it.card, j));
      turn(it.slides, j => deck.showSlide(it.card, j));

      await hold(it.dwell);
    }

    /* ── THE WHOLE WALK ────────────────────────────────────────────────────
       From wherever the page happens to be standing, not always from the top:
       pressing play halfway down a trail carries on from there, which is what
       anybody would expect of it. */
    async function walk() {
      const live = TRAIL.liveStops();
      if (!live.length) { stop(); return; }
      const here = TRAIL.nearestStop();
      let from = Math.max(0, live.indexOf(here.at));

      for (let n = from; n < live.length; n++) {
        if (!running) return;
        const i = live[n];
        await glideTo(TRAIL.pageAtStop(i));
        if (!running) return;
        await showCard(i);
        if (!running) return;
        TRAIL.closeCard(i);
        await hold(SETTINGS.betweenCards);
      }
      if (running) stop();              // the end of the trail ends the tour
    }

    /* ── ON AND OFF ────────────────────────────────────────────────────────  */
    function start() {
      if (running) return;
      running = true;
      button.classList.add("is-on");
      button.setAttribute("aria-pressed", "true");
      button.setAttribute("aria-label", WORDS.stopTour || "Stop playing");
      button.title = WORDS.stopTour || "Stop playing";
      document.body.appendChild(note);
      requestAnimationFrame(() => note.classList.add("is-on"));
      document.body.classList.add("tm-touring");
      walk();
    }

    function stop() {
      if (!running) return;
      running = false;
      clearAll();
      if (tween) cancelAnimationFrame(tween);
      tween = 0;
      button.classList.remove("is-on");
      button.setAttribute("aria-pressed", "false");
      button.setAttribute("aria-label", WORDS.playTour || "Play the trail");
      button.title = WORDS.playTour || "Play the trail";
      note.classList.remove("is-on");
      later(() => { if (note.parentNode) note.parentNode.removeChild(note); }, 260);
      document.body.classList.remove("tm-touring");
      TRAIL.closeAllCards();
    }

    button.addEventListener("click", () => (running ? stop() : start()));

    /* ESCAPE LEAVES IT, and so does taking the wheel. Capture on the keydown
       so the tour is out of the way before anything else acts on the press —
       otherwise Escape would shut the cards the tour is in the middle of
       showing and the tour would open another one a moment later. */
    document.addEventListener("keydown", e => {
      if (!running) return;
      if (e.key === "Escape") { e.stopPropagation(); stop(); return; }
      if (["ArrowDown", "ArrowUp", "PageDown", "PageUp", "Home", "End", " "]
          .indexOf(e.key) >= 0) stop();
    }, true);

    /* Somebody who scrolls has taken over. `wheel` and `touchstart` rather
       than `scroll`, because the tour's own scrolling fires `scroll` several
       times a second and would stop itself. */
    window.addEventListener("wheel", () => { if (running) stop(); }, { passive: true });
    window.addEventListener("touchstart", () => { if (running) stop(); }, { passive: true });
  }

  document.addEventListener("trail:ready", begin);
  window.addEventListener("load", () => setTimeout(begin, 0));
})();
