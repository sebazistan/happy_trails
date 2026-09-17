/* ═══════════════════════════════════════════════════════════════════════════
   HAPPY TRAILS — THE TOUR
   version 1.3

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

     THEN EACH TRACK IS DIVIDED EQUALLY. The card is open for `dwell`; every
     picture gets dwell ÷ slides and every page gets dwell ÷ pages. The two run
     at different rates — three pages and seven pictures means the pictures
     change faster — and both are on their last one when the card closes. The
     sums are in tour-pace.js, which the map's tour asks the same question of.

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
    /* ── THE ONE DIAL FOR THE WHOLE THING ──────────────────────────────────
       Everything below is a duration, and every one of them is divided by
       this before it is used. So `speed` is the tour's pace and nothing else
       has to be touched to change it: 1 is the reading pace the numbers below
       are written at, 2 is twice as brisk, 0.5 is half.

       It is a separate number from `wordsPerMinute` on purpose, and the two
       mean different things. wordsPerMinute is how fast a person READS — it
       decides how long a wordy card is compared with a short one, which is
       the shape of the tour. `speed` is how fast the tour goes through all of
       it. Changing the first changes the proportions; changing this one does
       not. */
    speed:          2,

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

    /* ── FETCHING AHEAD ────────────────────────────────────────────────────
       While one card is being read, the pictures for the NEXT waypoint are
       quietly asked for. On a slow connection the tour would otherwise arrive
       at each waypoint and show a grey rectangle for a second or two — the one
       moment a tour cannot afford it, because nobody is scrolling and there is
       nothing else to look at. Off on a metered connection: fetching
       photographs nobody has asked for is what a data cap is for avoiding. */
    lookAhead:      true,

    /* THE WORD THAT STARTS IT FROM A LINK — beltline.html?play */
    linkWord:       "play",
  };

  let wired = false;

  function begin() {
    if (wired) return;
    const TRAIL = window.TRAIL;
    if (!TRAIL || !TRAIL.deck || !TRAIL.stops || !TRAIL.pageAtStop) return;
    if (!window.HappyTrailsPace) return;      // the pacing lives in its own file
    const button = document.getElementById("tm-play");
    if (!button) return;
    wired = true;

    const asked = Object.assign({}, DEFAULTS,
                                (TRAIL.SETTINGS && TRAIL.SETTINGS.autoplay) || {});
    /* EVERY DURATION DIVIDED BY THE PACE, once, here — so no sum further down
       has to remember to do it and none of them can forget. `wordsPerMinute`
       is not a duration and is left alone; dividing it would change the shape
       of the tour rather than its speed. */
    const RATES = { scrollSpeed: 1 };     // per SECOND, so a faster tour wants MORE
    const KEEP = { speed: 1, wordsPerMinute: 1 };
    const SETTINGS = {};
    const pace = asked.speed || 1;
    for (const k in asked) {
      if (typeof asked[k] !== "number" || KEEP[k]) SETTINGS[k] = asked[k];
      else if (RATES[k]) SETTINGS[k] = asked[k] * pace;   // pixels a second
      else SETTINGS[k] = asked[k] / pace;                 // milliseconds
    }
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

    /* ── WHERE THE NOTE GOES, AND WHAT IT HAS TO CARRY ─────────────────────
       A trail page already has a row of controls that mean exactly what this
       note's arrows meant: a back arrow, a play button and a forward arrow,
       sitting together above the elevation graph. Putting a second pair of
       arrows on the screen the moment the tour starts — an inch away from the
       first pair, pointing the same way, doing very nearly the same thing —
       is two of everything and no way to tell from looking which is which.

       So where that row exists, the note JOINS IT: no arrows of its own, no
       count of its own, and it sits in the row after the forward arrow, so
       pressing play makes the words appear beside the buttons rather than
       putting a second set of buttons somewhere else. The three buttons that
       were already there drive the tour — see the capture listener further
       down — and the count beside them is the engine's own, which tracks the
       walk whether a tour is running or not.

       The main map has no such row, so there the note carries its own, which
       is what it was always for. Nothing here decides which page it is on; it
       asks whether the row is there. */
    const row = document.getElementById("tm-stepper");
    const rowBack = document.getElementById("tm-stepBack");
    const rowOn = document.getElementById("tm-stepOn");
    const joinsTheRow = !!(row && rowBack && rowOn);

    let back = null, on = null, count = null;
    if (!joinsTheRow) {
      /* TWO PIECES: WHERE THE TOUR HAS GOT TO, and how to leave it. The count
         is worth having for the reason a progress bar is — a tour with no end
         in sight is one people stop watching — and it is worked out from the
         stops that are actually live, so switching the wishful layer off
         changes the route and the total together. */
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
      back = arrow("back", "M15 5 8 12l7 7", WORDS.tourBack || "Previous");
      on = arrow("on", "M9 5l7 7-7 7", WORDS.tourOn || "Next");
      count = document.createElement("b");
      note.appendChild(back);
      note.appendChild(count);
      note.appendChild(on);
    }
    const how = document.createElement("span");
    how.textContent = WORDS.tourEscape || "Press Esc to leave autoplay";
    note.appendChild(how);

    function sayWhere(n, of) {
      if (!count) return;        // the row's own count is saying it instead
      count.hidden = !of;
      count.textContent = of ? (WORDS.tourAt || "{n} of {of}")
                                 .replace("{n}", n).replace("{of}", of) : "";
    }

    let running = false, tween = 0, jump = 0;
    const timers = [];
    const later = (fn, ms) => { timers.push(setTimeout(fn, ms)); };
    const clearAll = () => { while (timers.length) clearTimeout(timers.pop()); };

    /* ── WAITING, AND BEING INTERRUPTED ────────────────────────────────────
       Every wait in the tour is one of these, and every one of them resolves —
       either because the time came or because somebody stopped the tour. That
       is why nothing in here checks a flag halfway through a sleep: a stopped
       tour simply falls out of its own sequence at the next `if (!running)`. */
    let cutShort = null;
    function hold(ms) {
      return new Promise(done => {
        if (!running) { done(); return; }
        const t = setTimeout(() => { cutShort = null; done(); }, ms);
        timers.push(t);
        /* the handle on the wait currently running, so an arrow can end it
           early instead of the tour having to poll a flag */
        cutShort = () => { clearTimeout(t); cutShort = null; done(); };
      });
    }

    /* AN ARROW. The pending slide and page turns go with it — they belong to a
       card about to be left — and then whatever the tour is waiting on is cut
       short so the loop moves at once. The loop is the only place that has to
       know what "on" and "back" mean. */
    function step(by) {
      if (!running) return;
      jump = by;
      clearAll();
      if (cutShort) cutShort();
    }
    if (back) back.addEventListener("click", e => { e.stopPropagation(); step(-1); });
    if (on) on.addEventListener("click", e => { e.stopPropagation(); step(1); });

    /* ── THE ROW'S OWN ARROWS, WHILE THE TOUR IS RUNNING ───────────────────
       They already do something: they step the walk one waypoint, by hand, and
       on the way they tell the engine a reader has taken over — which stops
       the tour. That is exactly right when no tour is running and exactly
       wrong when one is, where the obvious meaning of the forward arrow is
       "go on to the next one" and the tour should follow rather than end.

       So while the tour is running the press is caught before it reaches the
       button, and means the tour's own step instead. In CAPTURE, and on the
       document rather than on the buttons: a listener added to the button
       itself would be a second listener on the same element, and listeners on
       the element a click landed on run in the order they were added — the
       engine's was added first, so it would already have stopped the tour
       before this one was reached. Capture on an ancestor runs before either.

       Not running, and nothing here happens at all: the press goes through to
       the engine untouched and the arrows are the arrows. */
    if (joinsTheRow) {
      document.addEventListener("click", e => {
        if (!running) return;
        const hit = e.target.closest && e.target.closest("#tm-stepBack, #tm-stepOn");
        if (!hit || hit.disabled) return;
        e.stopPropagation();
        e.preventDefault();
        step(hit.id === "tm-stepBack" ? -1 : 1);
      }, true);
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
    /* ── ASKING FOR THE NEXT WAYPOINT'S PICTURES ───────────────────────────
       An image the browser has already fetched is an image that is simply
       there when its card opens. Nothing is added to the page: these are the
       same URLs the card asks for a moment later, so the browser's own cache
       does all of the work and nothing is decoded twice.

       Videos are left alone. One is megabytes, it is not shown until its slide
       is, and the card's own `preload` already deals with it. */
    function fetchAhead(i) {
      if (!SETTINGS.lookAhead) return;
      if (TRAIL.onAMeteredLine && TRAIL.onAMeteredLine()) return;
      const card = deck.cards[i];
      if (!card || card.fetchedAhead) return;
      card.fetchedAhead = true;
      card.querySelectorAll("img[src]").forEach(img => {
        const ahead = new Image();
        ahead.decoding = "async";
        ahead.src = img.getAttribute("src");
      });
    }

    /* HOW LONG THIS CARD IS WORTH — asked of tour-pace.js, which the map's
       own tour asks the same question of. `measureOne` first, because how many
       pages a card has depends on how tall it is and it is only its real
       height once it is showing. */
    function readCard(i) {
      const card = deck.cards[i];
      if (!card) return null;
      if (deck.measureOne) deck.measureOne(card);
      const plan = window.HappyTrailsPace &&
                   window.HappyTrailsPace.plan(card, SETTINGS);
      return plan ? Object.assign({ card: card }, plan) : null;
    }

    /* ── ONE CARD, START TO FINISH ─────────────────────────────────────────
       The two tracks are laid out first and then simply waited through. Every
       page is up for dwell ÷ pages and every picture for dwell ÷ slides, so
       each gets the same turn as its neighbours and both tracks are on their
       last one when the card closes. tour-pace.js does the arithmetic and the
       map's tour asks it the same question. */
    async function showCard(i) {
      TRAIL.openCard(i, true);          // quietly: no throw from the waypoint
      await hold(SETTINGS.settleFirst);
      if (!running) return;

      const it = readCard(i);
      if (!it) return;

      if (deck.showPage) deck.showPage(it.card, 0);
      if (deck.showSlide) deck.showSlide(it.card, 0);

      const turn = (count, move) => {
        window.HappyTrailsPace.moments(count, it.dwell).forEach(m => {
          later(() => { if (running) move(m.j); }, m.at);
        });
      };
      turn(it.pages, j => deck.showPage(it.card, j));
      turn(it.slides, j => deck.showSlide(it.card, j));

      await hold(it.dwell);
    }

    /* ── THE WHOLE WALK ────────────────────────────────────────────────────
       From wherever the page happens to be standing, not always from the top:
       pressing play halfway down a trail carries on from there, which is what
       anybody would expect of it. */
    async function walk(fromTheTop) {
      const live = TRAIL.liveStops();
      if (!live.length) { stop(); return; }
      const here = TRAIL.nearestStop();
      let from = fromTheTop ? 0 : Math.max(0, live.indexOf(here.at));

      /* a `while` rather than a `for`, because the two arrows move `n` too */
      let n = from;
      while (n < live.length) {
        if (!running) return;
        jump = 0;
        const i = live[n];
        sayWhere(n + 1, live.length);
        /* only the note's own arrow needs telling; the row's pair is greyed
           out by the engine from where the walk actually is */
        if (back) back.disabled = n <= 0;
        await glideTo(TRAIL.pageAtStop(i));
        if (!running) return;
        if (live[n + 1] !== undefined) fetchAhead(live[n + 1]);
        if (!jump) await showCard(i);
        if (!running) return;
        TRAIL.closeCard(i);
        if (!jump) await hold(SETTINGS.betweenCards);
        n = jump ? Math.max(0, Math.min(live.length - 1, n + jump)) : n + 1;
      }
      if (running) stop();              // the end of the trail ends the tour
    }

    /* ── ON AND OFF ────────────────────────────────────────────────────────  */
    function start(fromTheTop) {
      if (running) return;
      running = true;
      /* AUTO-LOAD GOES ON. With it off the walk opens nothing, so the tour
         would scroll the whole trail past a map with no cards on it at all —
         it would look broken, and it would be. The switch on the Layers panel
         moves with it, so the panel never disagrees with the page. */
      if (TRAIL.autoLoad && !TRAIL.isAutoLoad()) TRAIL.autoLoad(true);
      button.classList.add("is-on");
      button.setAttribute("aria-pressed", "true");
      button.setAttribute("aria-label", WORDS.stopTour || "Stop playing");
      button.title = WORDS.stopTour || "Stop playing";
      (joinsTheRow ? row : document.body).appendChild(note);
      requestAnimationFrame(() => note.classList.add("is-on"));
      document.body.classList.add("tm-touring");
      walk(fromTheTop);
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

    button.addEventListener("click", () => (running ? stop() : start(false)));

    /* ── A LINK THAT STARTS THE TOUR ───────────────────────────────────────
       beltline.html?play — so a trail can be handed to somebody as something
       to WATCH rather than something to scroll, and it is the same page
       either way for anybody who would rather do it themselves.

       It starts from the top, because a link is being handed the trail rather
       than carrying on with it. A moment's wait first: the opening panel is
       still going and the artwork is still settling, and a tour that sets off
       into that looks like a page that will not sit still.

       ?play rather than #play: a trail's hash is already its waypoint
       addresses — don.html#half-mile-bridge — and a waypoint could perfectly
       well be called "play". */
    const asks = new RegExp("(^|[?&])" + SETTINGS.linkWord + "($|[=&])");
    if (asks.test(location.search)) setTimeout(() => start(true), 900);

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

    /* AND SO HAS ANYBODY WHO TOUCHED ANYTHING. The engine raises
       `trail:handover` from the handler of every real event a reader can cause
       — clicking a waypoint, closing a card, stepping with the arrows, opening
       a panel, dragging the graph, clicking the map. It is raised where the
       BROWSER said a human was involved and never from the functions
       themselves, which is why the tour, driving those same functions all day,
       does not stop itself.

       This file does not know what any of those things are, and does not need
       to: anything added later that a person can press stops the tour by
       saying the same word. */
    document.addEventListener("trail:handover", () => { if (running) stop(); });
  }

  document.addEventListener("trail:ready", begin);
  window.addEventListener("load", () => setTimeout(begin, 0));
})();
