/* ═══════════════════════════════════════════════════════════════════════════
   HAPPY TRAILS — THE FIRST HELLO
   version 1.6

   WHAT THIS IS. The panel that greets somebody the first time they open the
   main map, and only the first time. It is deliberately the same object as the
   panel a trail page opens with (same translucent box, kicker-title-body and
   typography), with two differences, because this one is a doorway rather
   than a heading:

     · a slow four-colour wash behind it, in the map's own inks: the green of
       a built trail, the purple of a wishful one, the amber of the labels and
       the blue of the rivers. It is the only thing on the site that moves for
       no reason but pleasure.

     · a purple line that draws itself round the edge, and when it closes the
       circuit the panel leaves. It is a clock you can read without reading:
       it shows how long the panel intends to stay. Continue closes it at once.

   SHOWN ONCE PER PERSON, remembered in localStorage. If storage is not
   available (a private window) it is shown anyway: a greeting seen twice is a
   small annoyance, a greeting that throws is a broken page.

   WHY THE BORDER IS SVG, NOT CSS: a border that travels round a rounded
   rectangle is one stroke with a dash pattern as long as itself, which CSS
   cannot do. `pathLength="1"` makes the dash maths 0-to-1 whatever the panel's
   size, so the line takes the same time on a phone as on a desktop, and the
   viewBox is set from the panel's measured box so the corners are the
   panel's own and not ellipses.

   IT CLOSES ON THE ANIMATION, NOT ON A TIMER, so what you see and what
   happens cannot drift apart on a slow phone.

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
  }, opts.words || {});

  const SETTINGS = Object.assign({
    /* HOW LONG THE BORDER TAKES to go all the way round, in milliseconds, and
       so how long the panel stays if nobody touches it. Long enough to read
       three lines (the first second goes on noticing the panel appeared),
       short enough that nobody who knows the site feels held; the pause button
       is for the reader who wants longer. The stylesheet reads it as
       --hello-draw, which is where to change the look of the line itself. */
    stay:      9200,

    /* AND HOW LONG IT TAKES TO LEAVE. It overshoots on the way, getting
       momentarily bigger, which makes it read as leaving rather than being
       switched off. */
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
     Both halves in try/catch: storage throws in a few real situations (a
     Safari private window), and a greeting is not worth a broken page. */
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
     Built here rather than in the page's markup, so a page that never calls
     this carries none of it. */
  const veil = document.createElement("div");
  veil.id = "ht-hello";
  veil.setAttribute("role", "dialog");
  veil.setAttribute("aria-modal", "true");
  veil.setAttribute("aria-labelledby", "ht-helloTitle");
  veil.innerHTML =
    '<div class="ht-helloBox">' +
      /* the wash: four blobs of the map's own inks, each drifting at its own
         pace and blurred together. They are composited, so none of them
         repaints anything else. */
      '<div class="ht-helloArt" aria-hidden="true">' +
        '<span class="ht-blob is-1"></span><span class="ht-blob is-2"></span>' +
        '<span class="ht-blob is-3"></span><span class="ht-blob is-4"></span>' +
      '</div>' +
      '<svg class="ht-helloEdge" aria-hidden="true" focusable="false">' +
        '<rect class="ht-helloRun" pathLength="1"></rect>' +
      '</svg>' +
      '<div class="ht-helloText">' +
        '<div class="ht-helloKicker"></div>' +
        '<h2 id="ht-helloTitle"></h2>' +
        '<p></p>' +
        /* ── THE WAY OUT, AND THE WAY TO STAY ────────────────────────────
           Continue closes the panel; there is deliberately no × as well, since
           two controls that do the same thing is one too many. The pause sits
           left of Continue, the same height but an outline rather than filled:
           the line is a clock, and a clock somebody is reading against ought
           to be stoppable, but it is the smaller offer. */
        '<div class="ht-helloRow">' +
          '<button class="ht-helloHold" type="button">' +
            '<svg class="ht-helloHoldStop" viewBox="0 0 24 24" aria-hidden="true">' +
              '<rect x="6" y="5" width="4.4" height="14" rx="1.4"/>' +
              '<rect x="13.6" y="5" width="4.4" height="14" rx="1.4"/></svg>' +
            '<svg class="ht-helloHoldGo" viewBox="0 0 24 24" aria-hidden="true">' +
              '<path d="M8 5.2v13.6L19 12z"/></svg>' +
          '</button>' +
          '<button class="ht-helloGo" type="button"></button>' +
        '</div>' +
      '</div>' +
    '</div>';

  const box = veil.querySelector(".ht-helloBox");
  box.setAttribute("tabindex", "-1");
  const edge = veil.querySelector(".ht-helloEdge");
  const run = veil.querySelector(".ht-helloRun");
  const go = veil.querySelector(".ht-helloGo");
  const holdBtn = veil.querySelector(".ht-helloHold");

  veil.querySelector(".ht-helloKicker").textContent = WORDS.kicker;
  veil.querySelector("#ht-helloTitle").textContent = WORDS.title;
  veil.querySelector(".ht-helloText p").textContent = WORDS.body;
  go.textContent = WORDS.go;
  go.setAttribute("aria-label", WORDS.goLabel);
  veil.style.setProperty("--hello-draw", SETTINGS.stay + "ms");
  veil.style.setProperty("--hello-leave", SETTINGS.leave + "ms");

  (SETTINGS.host || document.body).appendChild(veil);

  /* ── THE BORDER IS CUT TO THE PANEL IT IS GOING ROUND ────────────────────
     Measured, not guessed: the viewBox is the panel's own pixel box, so the
     corner radius is the panel's own. Re-cut on resize, because the panel is
     fluid. */
  function cutTheEdge() {
    /* ── THE LINE LIES ON THE PANEL'S OWN EDGE, OVER ITS BORDER ────────────
       Drawn inside the border, the panel's grey 1px rim showed outside the
       line and its wider corner curve sat apart from the line's tighter one,
       so the line read as an offset copy of the edge. So the SVG is moved out
       by the border's width to cover the BORDER box: the line hides the rim
       and its corners are concentric with the panel's. offsetWidth/Height are
       the border box and, unlike getBoundingClientRect, ignore the entrance
       scale, so this is right even when measured mid-entrance.

       This needs the panel NOT to clip its children (see .ht-helloBox); the
       colour wash carries its own clip. */
    const wide = box.offsetWidth, tall = box.offsetHeight;
    if (!wide || !tall) return;
    const look = getComputedStyle(box);
    const thick = parseFloat(getComputedStyle(run).strokeWidth) || 2;
    const rim = parseFloat(look.borderTopWidth) || 0;
    const round = parseFloat(look.borderTopLeftRadius) || 22;
    /* an SVG is a replaced element: given only an inset it keeps its default
       300x150 rather than stretching, so its size is written as well */
    edge.style.left = edge.style.top = (-rim) + "px";
    edge.style.width = wide + "px";
    edge.style.height = tall + "px";
    edge.setAttribute("viewBox", "0 0 " + wide + " " + tall);
    run.setAttribute("x", thick / 2);
    run.setAttribute("y", thick / 2);
    run.setAttribute("width", Math.max(0, wide - thick));
    run.setAttribute("height", Math.max(0, tall - thick));
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
    if (watching) watching.disconnect();
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
     The panel leaves when the LINE arrives, so stopping the line is the whole
     of stopping the panel; `is-held` on the veil is what the stylesheet pauses
     the animation with. Reduced motion has no line and a plain timer stands
     in, so there the remainder has to be worked out by hand. */
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
  holdBtn.addEventListener("click", e => { e.stopPropagation(); holdIt(!held); });
  veil.addEventListener("click", e => { if (e.target === veil) leave(); });
  /* capture, so Escape closes this before any page behind it hears about it */
  document.addEventListener("keydown", onKey, true);
  window.addEventListener("resize", cutTheEdge, { passive: true });

  /* the border reaching the end IS the closing; under reduced motion there is
     no animation to hear, so a timer stands in (the only case where one does) */
  run.addEventListener("animationend", leave);
  if (STILL) {
    veil.classList.add("is-still");
    stillFrom = Date.now();
    stillTimer = setTimeout(leave, SETTINGS.stay);
  }

  cutTheEdge();
  /* ── AND AGAIN WHENEVER THE PANEL CHANGES SIZE ─────────────────────────
     The first cut happens before the site's web font arrives; when it lands
     the words reflow, the panel grows, and the line would keep tracing the old
     shorter panel. A ResizeObserver hears every change of size (font, rotated
     phone, zoom). Because the line's length is always 1 (pathLength),
     re-cutting mid-draw neither restarts nor jumps the animation. */
  let watching = null;
  if (typeof ResizeObserver === "function") {
    watching = new ResizeObserver(() => cutTheEdge());
    watching.observe(box);
  } else if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(cutTheEdge);            // the one change that is certain
  }
  // one frame later, so the arrival animation has a state to arrive from
  requestAnimationFrame(() => {
    cutTheEdge();
    veil.classList.add("is-here");
    /* FOCUS GOES TO THE PANEL, NOT THE BUTTON. A screen reader has to be taken
       inside the dialog, but focusing the button paints a focus ring for a
       mouse user who never asked for one; the ring then appears when somebody
       reaches for Tab. */
    try { box.focus({ preventScroll: true }); } catch (e) { box.focus(); }
  });

  return { close: leave, node: veil };
};
