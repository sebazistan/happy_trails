/* ═══════════════════════════════════════════════════════════════════════════
   HAPPY TRAILS — THE TOUR
   version 2.1

   WHAT THIS IS. The play button between the two arrows walks the trail for
   you. It scrolls to a waypoint, opens its card, turns the card's pages and
   its pictures, closes it, and goes on to the next one — until the trail runs
   out or you stop it.

   THE ORDER ON THE WAY OUT. When a card's time is up, the line that joins it
   to its waypoint draws itself back into the waypoint FIRST and the card goes
   only once the line has gone — `TRAIL.putAway(i, true)` waits for the whole
   of it. On arrival it is the other way: the card comes up, and then the line
   draws itself in. See leader-line.js for how.

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

   TO USE IT:  <script src="js/autoplay.js"></script> after trail-engine.js.
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

    /* HOW LONG EACH CARD IS READ FOR — words per minute, and the floors and
       ceilings on a card, a slide and a video — is NOT here. It is in
       tour-pace.js, once, for both tours. It still passes through the speed
       division below, and a page can still override any of it the same way as
       everything else. */

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

    /* HOW LONG TO LET A CARD GROW before measuring it. When the tour opens a
       card at the size the reader left the last one — see wantBig — how many
       pages the words break into depends on the shape the card ends at. Measure
       too early and the first page is broken against the small card and then
       shown in the big one. This is the card's own grow time with a little
       over. */
    growWait:      460,

    /* ── FETCHING AHEAD ────────────────────────────────────────────────────
       While one card is being read, the pictures for the NEXT waypoint are
       quietly asked for, so the tour does not arrive at a waypoint and show a
       grey rectangle on a slow connection. Skipped on a metered connection:
       fetching photographs nobody has asked for is what a data cap is for
       avoiding. */
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

    const asked = Object.assign({}, window.HappyTrailsPace.DEFAULTS, DEFAULTS,
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
       A trail page already has a row of controls — a back arrow, a play button
       and a forward arrow above the elevation graph. A second pair of arrows
       the moment the tour starts would be two of everything.

       So where that row exists, the note JOINS IT: no arrows of its own, no
       count of its own, and it sits in the row after the forward arrow. The
       buttons already there drive the tour — see the capture listener further
       down — and the count beside them is the engine's own, which tracks the
       walk whether a tour is running or not.

       The main map has no such row, so there the note carries its own. Nothing
       here decides which page it is on; it asks whether the row is there. */
    const row = document.getElementById("tm-stepper");
    const rowBack = document.getElementById("tm-stepBack");
    const rowOn = document.getElementById("tm-stepOn");
    const joinsTheRow = !!(row && rowBack && rowOn);

    /* ── THE STOP BUTTON ───────────────────────────────────────────────────
       Made here rather than written into the page, and made the same way by
       the map's tour, because it belongs to the tour: there is nothing for a
       page without a tour to do with it, and the stylesheet keeps it out of
       sight until the row is wearing `is-touring`.

       It is a SEPARATE button from play/pause, which is the whole point.
       Stopping closes the card and hands the page back; pausing leaves
       everything exactly where it is so you can finish reading. With both on
       the middle button, pressing play twice did the thing a reader almost
       never wants. */
    const stopBtn = document.createElement("button");
    stopBtn.type = "button";
    stopBtn.className = "tm-step tm-stop";
    stopBtn.id = "tm-stop";
    stopBtn.title = WORDS.stopTour || "Stop the tour";   // named from the start: it is in the tab order even before a tour begins
    stopBtn.setAttribute("aria-label", stopBtn.title);
    stopBtn.innerHTML =
      '<svg viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">' +
        '<rect x="6.6" y="6.6" width="10.8" height="10.8" rx="2"/></svg>';
    if (joinsTheRow) row.insertBefore(stopBtn, rowOn.nextSibling);

    let back = null, on = null, count = null;
    if (!joinsTheRow) {
      /* TWO PIECES: WHERE THE TOUR HAS GOT TO, and how to leave it. The count
         is worth having for the reason a progress bar is, and it is worked out
         from the stops that are actually live, so the route and the total
         change together. */
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

    let running = false, tween = 0, jump = 0, held = false;

    /* ── EVERY WAIT IN THE TOUR IS ON ONE CLOCK ────────────────────────────
       The card's own time, the page turns, the picture turns, the beat between
       waypoints — all of them are jobs on a single clock from tour-pace.js,
       which the map's tour uses too. It can do what setTimeout cannot: stop,
       and start again from where it stopped, so pausing is one instruction and
       the two tours cannot pause differently.

       `hold` is a wait the tour's own loop sits on; `later` is something that
       happens to the card while it does. Only `hold` is awaited. */
    const clock = window.HappyTrailsPace.clock();
    const later = (fn, ms) => clock.at(ms, fn);
    const clearAll = () => clock.clear();
    const hold = ms => (running ? clock.wait(ms) : Promise.resolve());

    /* ── PAUSING ───────────────────────────────────────────────────────────
       Three things stop together, because they are three views of the same
       clock: the waits, the green line drawing itself round the card, and the
       words at the end of the row. A progress line still filling on a tour that
       is not progressing is worse than no line at all. */
    function holdTour(on) {
      if (!running || held === !!on) return;
      held = !!on;
      if (held) clock.pause(); else clock.resume();
      if (window.HappyTrailsEdge) window.HappyTrailsEdge.hold(held);
      /* `is-on` on the play button means PLAYING, so a paused tour shows the
         triangle again — which is the offer, and pressing it is exactly what
         carries on. The row's own `is-touring` is what keeps the button green
         and the stop button on screen while it is held. */
      button.classList.toggle("is-on", !held);
      button.setAttribute("aria-pressed", held ? "false" : "true");
      button.title = held ? (WORDS.tourGoOn || "Carry on")
                          : (WORDS.tourHold || "Pause the tour");
      button.setAttribute("aria-label", button.title);
      how.textContent = held
        ? (WORDS.tourHeld || "Paused — press play to carry on")
        : (WORDS.tourEscape || "Press Esc to leave autoplay");
    }
    stopBtn.addEventListener("click", e => { e.stopPropagation(); stop(); });

    /* ONE BUTTON, THREE MEANINGS, AND NO AMBIGUITY BETWEEN THEM: nothing
       running means start, running means hold, held means carry on. */
    function toggle() {
      if (!running) start(false);
      else holdTour(!held);
    }

    /* AN ARROW. The pending slide and page turns go with it — they belong to a
       card about to be left — and then whatever the tour is waiting on is cut
       short so the loop moves at once. The loop is the only place that has to
       know what "on" and "back" mean.

       A PAUSED TOUR STAYS PAUSED. An arrow pressed while it is held means
       "show me the next one", not "start the clock again". */
    function step(by) {
      if (!running) return;
      jump = by;
      clearAll();
      clock.cut();
    }
    if (back) back.addEventListener("click", e => { e.stopPropagation(); step(-1); });
    if (on) on.addEventListener("click", e => { e.stopPropagation(); step(1); });

    /* ── THE ROW'S OWN ARROWS, WHILE THE TOUR IS RUNNING ───────────────────
       They step the walk one waypoint by hand, and on the way they tell the
       engine a reader has taken over — which stops the tour. While a tour is
       running the forward arrow should mean "go on to the next one" and the
       tour should follow rather than end.

       So while the tour is running the press is caught before it reaches the
       button, and means the tour's own step instead. In CAPTURE, and on the
       document rather than on the buttons: listeners on the element a click
       landed on run in the order they were added, and the engine's was added
       first, so it would already have stopped the tour. Capture on an ancestor
       runs before either.

       Not running, and nothing here happens: the press goes through to the
       engine untouched. */
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
       Its own tween rather than scrollTo({behavior:"smooth"}): the browser's
       smooth scroll has a pace of its own choosing and no way to ask when it
       has finished, and this one can be cut off mid-flight by Escape. */
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

    /* ── ASKING FOR THE NEXT WAYPOINT'S PICTURES ───────────────────────────
       Nothing is added to the page: these are the same URLs the card asks for
       a moment later, so the browser's own cache does the work.

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

    /* WHAT IS ON THIS CARD AND HOW LONG IT IS WORTH — counted off the card
       every time and asked of tour-pace.js. `measureOne` first, because how
       many pages a card has depends on how tall it is and it is only its real
       height once it is showing. */
    function readCard(i) {
      const card = deck.cards[i];
      if (!card) return null;
      if (deck.measureOne) deck.measureOne(card);
      const plan = window.HappyTrailsPace &&
                   window.HappyTrailsPace.plan(card, SETTINGS);
      return plan ? Object.assign({ card: card }, plan) : null;
    }

    /* ── HOW BIG THE READER WANTS THE CARDS ────────────────────────────────
       Halfway through a tour somebody may press the expand button to see the
       photographs properly, and should not have to press it again at every
       waypoint. So the tour carries one piece of the reader's state — whether
       the card was left expanded — read at the END of each card, when whatever
       they did to it has settled, and applied to the next one as it opens.
       Nothing is stored between visits.

       IT DOES NOT OUTLIVE THE TOUR. Stop, or Escape, and it goes back to
       false, so a card opened by hand afterwards is the ordinary card. */
    let wantBig = false;

    async function showCard(i) {
      TRAIL.openCard(i, true);          // quietly: no throw from the waypoint
      await hold(SETTINGS.settleFirst);
      if (!running) return;

      // the size the last card was left at, before readCard measures anything
      if (wantBig && deck.isBig && !deck.isBig() && deck.setBig) {
        deck.setBig(true, i);
        await hold(SETTINGS.growWait);
        if (!running) return;
      }

      const it = readCard(i);
      if (!it) return;

      if (deck.showPage) deck.showPage(it.card, 0);
      if (deck.showSlide) deck.showSlide(it.card, 0);

      /* THE LINE ROUND THE CARD, over exactly the time the card has left. It
         is the only thing on screen that answers "how long have I got with
         this one". tour-edge.js draws it. */
      if (window.HappyTrailsEdge) window.HappyTrailsEdge.draw(it.card, it.dwell);

      const turn = (count, move) => {
        window.HappyTrailsPace.moments(count, it.dwell).forEach(m => {
          later(() => { if (running) move(m.j); }, m.at);
        });
      };
      turn(it.pages, j => deck.showPage(it.card, j));
      turn(it.slides, j => deck.showSlide(it.card, j));

      await hold(it.dwell);
      // whatever they left it at is what the next one opens as
      if (deck.isBig) wantBig = deck.isBig();
      if (window.HappyTrailsEdge) window.HappyTrailsEdge.clear(it.card);
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
        /* THE LINE GOES FIRST, THEN THE CARD: putAway waits for the whole of
           the line's drawing-back before it touches the card. */
        if (TRAIL.putAway) await TRAIL.putAway(i, true); else TRAIL.closeCard(i);
        if (!running) return;
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
         would scroll past a map with no cards on it. The switch on the Layers
         panel moves with it. */
      if (TRAIL.autoLoad && !TRAIL.isAutoLoad()) TRAIL.autoLoad(true);
      button.classList.add("is-on");
      button.setAttribute("aria-pressed", "true");
      button.title = WORDS.tourHold || "Pause the tour";
      button.setAttribute("aria-label", button.title);
      stopBtn.title = WORDS.stopTour || "Stop the tour";
      stopBtn.setAttribute("aria-label", stopBtn.title);
      (joinsTheRow ? row : document.body).appendChild(note);
      requestAnimationFrame(() => note.classList.add("is-on"));
      document.body.classList.add("tm-touring");
      /* the row grows its tour-only pieces — the pause button here, and on the
         map the two arrows and the count as well */
      if (row) row.classList.add("is-touring");
      walk(fromTheTop);
    }

    function stop() {
      if (!running) return;
      /* LET GO OF THE PAUSE BEFORE ANYTHING ELSE. A stopped clock cannot run
         the timer that takes the note off the screen, so a tour stopped while
         paused would leave its note there for ever. */
      holdTour(false);
      running = false;
      wantBig = false;          // the show is over; cards are ordinary again
      clearAll();
      if (tween) cancelAnimationFrame(tween);
      tween = 0;
      if (window.HappyTrailsEdge) window.HappyTrailsEdge.clear();
      button.classList.remove("is-on");
      button.setAttribute("aria-pressed", "false");
      button.title = WORDS.playTour || "Play the trail";
      button.setAttribute("aria-label", button.title);
      note.classList.remove("is-on");
      setTimeout(() => {
        if (note.parentNode) note.parentNode.removeChild(note);
        if (row) row.classList.remove("is-touring");
      }, 260);
      document.body.classList.remove("tm-touring");
      // stopping puts the card away the same way: line first, then the card
      if (TRAIL.putAwayAll) TRAIL.putAwayAll(); else TRAIL.closeAllCards();
    }

    button.addEventListener("click", toggle);

    /* ── A LINK THAT STARTS THE TOUR ───────────────────────────────────────
       beltline.html?play — so a trail can be handed to somebody as something
       to WATCH rather than something to scroll.

       It starts from the top. A moment's wait first: the opening panel and the
       artwork are still settling, and a tour that sets off into that looks like
       a page that will not sit still.

       ?play rather than #play: a trail's hash is already its waypoint
       addresses — don.html#half-mile-bridge — and a waypoint could perfectly
       well be called "play". */
    const asks = new RegExp("(^|[?&])" + SETTINGS.linkWord + "($|[=&])");
    if (asks.test(location.search)) setTimeout(() => start(true), 900);

    /* ESCAPE LEAVES IT, and so does taking the wheel. Capture on the keydown
       so the tour is out of the way before anything else acts on the press —
       otherwise Escape would shut the cards and the tour would open another a
       moment later.

       SOMEBODY TYPING IS NOT PRESSING A CONTROL. The page has a textarea on it
       — the coordinate reader — and a space typed into that must be a space. */
    const typing = e => {
      const n = e.target;
      return !!n && (n.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(n.tagName));
    };

    document.addEventListener("keydown", e => {
      if (typing(e)) return;
      /* ── SPACE IS PLAY AND PAUSE, TOUR OR NO TOUR ───────────────────────
         The one key every media player has bound to this, on both the trail
         pages and the main map.

         preventDefault, because the browser's own meaning for space is "scroll
         down a page" — and on a trail page scrolling IS walking the trail, so
         left alone it would start the tour and in the same keystroke tell the
         engine a reader had taken over, which stops it.

         What is lost is space as a way to scroll; the arrow keys, Page Down and
         the wheel still do it. */
      if (e.key === " " || e.code === "Space") {
        e.preventDefault();
        e.stopPropagation();
        toggle();
        return;
      }
      if (!running) return;
      if (e.key === "Escape") { e.stopPropagation(); stop(); return; }
      if (["ArrowDown", "ArrowUp", "PageDown", "PageUp", "Home", "End"]
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
       a panel, dragging the graph, clicking the map. It is never raised from
       the functions themselves, which is why the tour, driving those same
       functions, does not stop itself. Anything added later that a person can
       press stops the tour by saying the same word. */
    document.addEventListener("trail:handover", () => { if (running) stop(); });
  }

  document.addEventListener("trail:ready", begin);
  window.addEventListener("load", () => setTimeout(begin, 0));
})();
