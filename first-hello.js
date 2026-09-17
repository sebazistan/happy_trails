/* ═══════════════════════════════════════════════════════════════════════════
   HAPPY TRAILS — THE FIRST HELLO
   version 1.2

   WHAT THIS IS. The panel that greets somebody the first time they open the
   main map, and only the first time. It is the map's answer to the panel a
   trail page opens with, and it is deliberately the same object: the same
   translucent box, the same kicker-title-body, the same typography. Two
   differences, and both are because this one is a doorway rather than a
   heading:

     · a slow four-colour wash behind it, in the map's own inks — the green of
       a built trail, the purple of a wishful one, the amber of the labels and
       the blue of the rivers. It drifts. It is the only thing on the site that
       moves for no reason but pleasure.

     · a purple line that draws itself round the edge, and when it closes the
       circuit the panel leaves. It is a clock you can read without reading
       anything: the panel is not asking you to wait, it is showing you how
       long it intends to keep you. Press Continue and it goes at once.

   IT IS SHOWN ONCE PER PERSON, remembered in localStorage. If that is not
   available — a private window, storage turned off — it is shown, which is the
   right way round: a greeting seen twice is a small annoyance, a greeting that
   throws is a broken page.

   WHY THE BORDER IS DRAWN IN SVG AND NOT IN CSS. A border that travels round a
   rounded rectangle is one stroke with a dash pattern as long as itself, and
   nothing in CSS will do that. `pathLength="1"` lets the dash maths be
   0-to-1 regardless of the panel's real size, so the line takes exactly as
   long on a phone as on a desktop — and the viewBox is set from the panel's
   measured box, so the corners are the panel's own corners and not ellipses.

   IT CLOSES ON THE ANIMATION, NOT ON A TIMER. The panel goes when the border
   says it has arrived, so what you see and what happens cannot drift apart —
   which they will, on a slow phone, if a setTimeout is racing a keyframe.

   TO USE IT:  HappyTrailsHello({ words: {...}, settings: {...} })
   ═══════════════════════════════════════════════════════════════════════════ */

window.HappyTrailsHello = function (opts) {
  "use strict";
  opts = opts || {};

  const WORDS = Object.assign({
    kicker:  "Every multi-use trail in the GTA",
    title:   "Welcome to Happy Trails",
    body:    "Drag to move the map, scroll to zoom. Green is a trail you can " +
             "ride today; purple is one that ought to exist. Click a waypoint " +
             "to see what is there.",
    go:      "Continue",
    goLabel: "Close this and go to the map",
    hold:    "Hold this open",
    unhold:  "Let it carry on",
    shut:    "Close",
  }, opts.words || {});

  const SETTINGS = Object.assign({
    /* HOW LONG THE BORDER TAKES to go all the way round, in milliseconds, and
       therefore how long the panel stays if nobody touches it. Long enough to
       read the three lines without hurrying, short enough that nobody who
       already knows the site feels held. The stylesheet reads it too, as
       --hello-draw, which is where to change the look of the line itself. */
    stay:      4600,

    /* AND HOW LONG IT TAKES TO LEAVE. Short, and it overshoots on the way —
       the panel gets momentarily bigger before it goes, which is what makes it
       read as leaving rather than as being switched off. */
    leave:     380,

    /* WHERE IT IS REMEMBERED. Change the number and everybody sees the panel
       once more, which is what you want when the words change. */
    remember:  "happy-trails:hello:1",

    /* Somewhere to put it. Defaults to the end of the body. */
    host:      null,
  }, opts.settings || {});

  const STILL = window.matchMedia &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ── HAS THIS PERSON BEEN HERE BEFORE ───────────────────────────────────
     Both halves in try/catch. Storage throws rather than returning null in a
     few real situations — a Safari private window is the famous one — and a
     greeting panel is not worth a broken page. */
  function beenHere() {
    try { return window.localStorage.getItem(SETTINGS.remember) === "1"; }
    catch (e) { return false; }
  }
  function rememberIt() {
    try { window.localStorage.setItem(SETTINGS.remember, "1"); }
    catch (e) { /* nothing to do, and nothing worth saying */ }
  }

  if (beenHere()) return null;

  /* ── THE PANEL ──────────────────────────────────────────────────────────
     Written here rather than in the page's markup so that a page which never
     calls this carries none of it — and so the one place the panel is
     described is the one place it behaves. */
  const veil = document.createElement("div");
  veil.id = "ht-hello";
  veil.setAttribute("role", "dialog");
  veil.setAttribute("aria-modal", "true");
  veil.setAttribute("aria-labelledby", "ht-helloTitle");
  veil.innerHTML =
    '<div class="ht-helloBox">' +
      /* the wash. Four blobs of the map's own inks, each drifting on its own
         path at its own pace, blurred into each other. Blurring four moving
         circles is cheaper than it sounds — they are composited, and none of
         them causes a repaint of anything else. */
      '<div class="ht-helloArt" aria-hidden="true">' +
        '<span class="ht-blob is-1"></span><span class="ht-blob is-2"></span>' +
        '<span class="ht-blob is-3"></span><span class="ht-blob is-4"></span>' +
      '</div>' +
      '<svg class="ht-helloEdge" aria-hidden="true" focusable="false">' +
        '<rect class="ht-helloRun" pathLength="1"></rect>' +
      '</svg>' +
      /* TWO SMALL CONTROLS IN THE CORNER. The line going round the panel is a
         clock, and a clock somebody is reading against ought to be stoppable —
         four seconds is enough for three lines of text at a normal reading
         pace and not enough for somebody who has just looked up from something
         else. And a way to shut it now, for the reader who has read it. */
      '<div class="ht-helloTools">' +
        '<button class="ht-helloTool ht-helloHold" type="button">' +
          '<svg class="ht-helloHoldStop" viewBox="0 0 24 24" aria-hidden="true">' +
            '<rect x="6" y="5" width="4.4" height="14" rx="1.4"/>' +
            '<rect x="13.6" y="5" width="4.4" height="14" rx="1.4"/></svg>' +
          '<svg class="ht-helloHoldGo" viewBox="0 0 24 24" aria-hidden="true">' +
            '<path d="M8 5.2v13.6L19 12z"/></svg>' +
        '</button>' +
        '<button class="ht-helloTool ht-helloShut" type="button">' +
          '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" ' +
            'stroke="currentColor" stroke-width="2.6" stroke-linecap="round">' +
            '<path d="M6 6l12 12M18 6L6 18"/></svg>' +
        '</button>' +
      '</div>' +
      '<div class="ht-helloText">' +
        '<div class="ht-helloKicker"></div>' +
        '<h2 id="ht-helloTitle"></h2>' +
        '<p></p>' +
        '<button class="ht-helloGo" type="button"></button>' +
      '</div>' +
    '</div>';

  const box = veil.querySelector(".ht-helloBox");
  box.setAttribute("tabindex", "-1");
  const edge = veil.querySelector(".ht-helloEdge");
  const run = veil.querySelector(".ht-helloRun");
  const go = veil.querySelector(".ht-helloGo");
  const holdBtn = veil.querySelector(".ht-helloHold");
  const shutBtn = veil.querySelector(".ht-helloShut");

  veil.querySelector(".ht-helloKicker").textContent = WORDS.kicker;
  veil.querySelector("#ht-helloTitle").textContent = WORDS.title;
  veil.querySelector(".ht-helloText p").textContent = WORDS.body;
  go.textContent = WORDS.go;
  go.setAttribute("aria-label", WORDS.goLabel);
  shutBtn.title = WORDS.shut;
  shutBtn.setAttribute("aria-label", WORDS.shut);
  veil.style.setProperty("--hello-draw", SETTINGS.stay + "ms");
  veil.style.setProperty("--hello-leave", SETTINGS.leave + "ms");

  (SETTINGS.host || document.body).appendChild(veil);

  /* ── THE BORDER IS CUT TO THE PANEL IT IS GOING ROUND ────────────────────
     Measured, not guessed: the viewBox is the panel's own pixel box, so the
     corner radius is the panel's own radius rather than an ellipse produced by
     stretching a square viewBox. Re-cut on resize, because the panel is fluid
     and a phone turned sideways is a different panel. */
  function cutTheEdge() {
    const shape = box.getBoundingClientRect();
    if (!shape.width || !shape.height) return;
    const thick = parseFloat(getComputedStyle(run).strokeWidth) || 2;
    const round = parseFloat(getComputedStyle(box).borderTopLeftRadius) || 22;
    edge.setAttribute("viewBox", "0 0 " + shape.width + " " + shape.height);
    run.setAttribute("x", thick / 2);
    run.setAttribute("y", thick / 2);
    run.setAttribute("width", Math.max(0, shape.width - thick));
    run.setAttribute("height", Math.max(0, shape.height - thick));
    run.setAttribute("rx", Math.max(0, round - thick / 2));
  }

  /* ── GOING ──────────────────────────────────────────────────────────────
     Once, however it is asked: the button, the border finishing, Escape, or a
     click on the ground either side of the panel. `left` guards against the
     border's animationend arriving a frame after somebody has pressed
     Continue, which would otherwise take the panel away twice. */
  let left = false;
  function leave() {
    if (left) return;
    left = true;
    rememberIt();
    veil.classList.add("is-going");
    clearTimeout(stillTimer);
    window.removeEventListener("resize", cutTheEdge);
    document.removeEventListener("keydown", onKey, true);
    setTimeout(() => {
      if (veil.parentNode) veil.parentNode.removeChild(veil);
      if (opts.onClose) opts.onClose();
    }, SETTINGS.leave + 60);
  }

  function onKey(e) {
    if (e.key === "Escape") { e.stopPropagation(); leave(); }
  }

  /* ── HOLDING IT OPEN ────────────────────────────────────────────────────
     Because the panel leaves when the LINE arrives rather than on a timer
     running alongside it, stopping the line is the whole of stopping the
     panel — there is no second clock to remember. `is-held` on the veil is
     what the stylesheet pauses the animation with.

     The one case that needs its own handling is reduced motion, where there
     is no line and a plain timer stands in for it. There the remainder has to
     be worked out by hand, which is the small price of the animation not
     existing to be paused. */
  let held = false, stillTimer = 0, stillFrom = 0, stillLeft = SETTINGS.stay;

  function holdIt(on) {
    if (left || held === on) return;
    held = on;
    veil.classList.toggle("is-held", held);
    holdBtn.title = held ? WORDS.unhold : WORDS.hold;
    holdBtn.setAttribute("aria-label", holdBtn.title);
    holdBtn.setAttribute("aria-pressed", held ? "true" : "false");
    if (!STILL) return;
    if (held) {
      clearTimeout(stillTimer);
      stillLeft -= Date.now() - stillFrom;
    } else {
      stillFrom = Date.now();
      stillTimer = setTimeout(leave, Math.max(0, stillLeft));
    }
  }
  holdBtn.title = WORDS.hold;
  holdBtn.setAttribute("aria-label", WORDS.hold);
  holdBtn.setAttribute("aria-pressed", "false");

  go.addEventListener("click", leave);
  shutBtn.addEventListener("click", e => { e.stopPropagation(); leave(); });
  holdBtn.addEventListener("click", e => { e.stopPropagation(); holdIt(!held); });
  veil.addEventListener("click", e => { if (e.target === veil) leave(); });
  /* capture, so Escape closes this before any page behind it hears about it */
  document.addEventListener("keydown", onKey, true);
  window.addEventListener("resize", cutTheEdge, { passive: true });

  /* the border reaching the end IS the closing. On a browser that will not
     animate — reduced motion — there is nothing to hear, so a timer stands in
     for it, and it is the only case where one does. */
  run.addEventListener("animationend", leave);
  if (STILL) {
    veil.classList.add("is-still");
    stillFrom = Date.now();
    stillTimer = setTimeout(leave, SETTINGS.stay);
  }

  cutTheEdge();
  // one frame later, so the arrival animation has a state to arrive from
  requestAnimationFrame(() => {
    cutTheEdge();
    veil.classList.add("is-here");
    /* FOCUS GOES TO THE PANEL, NOT TO THE BUTTON. A screen reader has to be
       taken inside the dialog or it goes on reading the map behind it — but
       focusing the button paints a focus ring on it for somebody who arrived
       with a mouse and never asked for one. The panel takes focus instead, so
       the ring appears the moment somebody reaches for Tab and not before. */
    try { box.focus({ preventScroll: true }); } catch (e) { box.focus(); }
  });

  return { close: leave, node: veil };
};
