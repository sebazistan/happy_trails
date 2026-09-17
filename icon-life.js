/* ═══════════════════════════════════════════════════════════════════════════
   HAPPY TRAILS — THE ICONS THAT MOVE
   version 1.2

   WHAT THIS IS. Two of the little drawings on this site are readings rather
   than decoration — the coin says what a connection would COST, the dial says
   how badly it is WANTED — and a reading that arrives with a bit of movement
   is read, where one that is simply there is scenery. So:

     the coin   turns over once, edge on and back, the way a coin does
     the dial   swings its needle up from the bottom of the scale and settles
                onto its reading with one small overshoot

   EVERY TIME THE THING APPEARS, not once per page. A card that opens, closes
   and opens again does it again, because the second time is the first time for
   whoever is looking at it. That is the whole reason for this file.

   AND AGAIN WHENEVER SOMEBODY POINTS AT ONE. A reading you have reached for is
   a reading you are asking about, and the coin turning under the cursor is the
   answer arriving rather than sitting there. It is also how anybody finds out
   the movement exists at all, if they happened to be looking elsewhere the
   first time.

   WHY NOT A GIF, which would have been less code. A GIF has one animation
   clock shared by every copy of it on the page, so a play-once GIF shows its
   last frame on the second card that asks for it — which is exactly the case
   that matters here. It would also put hard edges on the coin's soft shine,
   since GIF transparency is on or off with nothing in between, and it would
   fix the dial at three angles for ever. None of those are true of this.

   WHY THE DIAL IS INLINED AND THE COIN IS NOT. The coin turns as a whole, so
   it can stay an <img> and be turned by the page's own stylesheet. The dial's
   needle has to move INSIDE the drawing, and nothing outside an <img> can
   reach inside it — so the dial's file is fetched once, inlined, and animated
   in place. The files are the same files either way, and they are still
   correct sitting still with none of this running.

   WHERE THE ANGLES COME FROM. Not from here. build/make_icons.py draws the
   needle and writes the angle it drew it at, and where it pivots, onto the
   group around it (`data-angle`, `data-hub`). This file reads those. Add a
   fourth reading to the dial one day and it will swing to it without a line
   changing here.

   WHAT MARKS ONE. `data-life="coin"` or `data-life="dial"` on the <img>. Both
   generators that write these icons — waypoint-card.js and make_wishful.py —
   put it there. Nothing here matches on a file name.

   TO USE IT:  <script src="icon-life.js"></script>  and nothing else. It
   watches the page for icons arriving and for icons coming back into view.
   ═══════════════════════════════════════════════════════════════════════════ */

(function () {
  "use strict";

  const SETTINGS = {
    /* HOW MUCH OF THE ICON HAS TO BE SHOWING before it counts as having
       appeared. Small, because these sit in a row of facts at the bottom of a
       card and the row is often only just in view. */
    showing:      0.35,

    /* WHERE THE NEEDLE SWINGS UP FROM, as an angle on the dial's own
       protractor — 180 is hard left, 0 is hard right. The bottom of the green,
       so every reading has somewhere to travel from and a high one travels
       furthest, which is the reading being acted out rather than just shown. */
    dialFrom:     180,

    /* THE SHAPE OF THE SETTLE, as fractions of the whole swing: how far past
       the reading the needle goes first, then how far back, then how far past
       again before it stops. A needle that arrives and stops dead has no
       weight; one that rings for ever is a toy. */
    past:         0.12,
    back:         0.05,
    rest:         0.02,

    /* AND HOW LONG THE TWO MOVES TAKE. Both are also in the stylesheet, as
       --coin-turn and --dial-swing; these are only the fallback for working
       out when a turn has finished. The stylesheet is where to change them. */
    coinMs:       620,
    dialMs:       760,

    /* A LITTLE STAGGER so a row of them does not move as one block. */
    stagger:      90,
    staggerMost:  4,
  };

  const STILL = window.matchMedia &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* Somebody who has asked for less movement gets the drawings exactly as they
     are drawn — which are correct, because the needle is drawn at its reading
     and the coin is drawn face up. There is nothing to fall back to. */
  if (STILL) return;

  /* ── THE DIAL'S FILE, FETCHED ONCE ───────────────────────────────────────
     One request per reading, not per icon: five cards showing a high priority
     share one fetch. The promise itself is what is cached, so five cards
     asking at the same moment still make one request. */
  const files = new Map();

  function svgFor(src) {
    if (!files.has(src)) {
      files.set(src, fetch(src)
        .then(r => (r.ok ? r.text() : Promise.reject(new Error(r.status))))
        .catch(() => null));
    }
    return files.get(src);
  }

  /* ── A DIAL ──────────────────────────────────────────────────────────────
     The <img> is replaced by the drawing itself, with the same width, height
     and alt, so nothing about the layout moves. If the fetch fails — offline,
     a file renamed — the <img> is left exactly where it was and the icon is
     simply still, which is a correct icon.  */
  function beDial(img) {
    if (img.dataset.lifeOn) return;
    img.dataset.lifeOn = "1";
    svgFor(img.getAttribute("src")).then(text => {
      if (!text) return;
      const holder = document.createElement("span");
      holder.innerHTML = text;
      const svg = holder.querySelector("svg");
      if (!svg) return;

      svg.setAttribute("class", "ht-dial");
      svg.setAttribute("aria-hidden", "true");
      if (img.hasAttribute("width")) svg.setAttribute("width", img.getAttribute("width"));
      if (img.hasAttribute("height")) svg.setAttribute("height", img.getAttribute("height"));

      const needle = svg.querySelector(".ht-needle");
      if (needle) {
        /* where it pivots and how far it has to come, both read off the
           drawing rather than worked out here */
        const hub = (needle.dataset.hub || "24 31").split(/[ ,]+/);
        const angle = parseFloat(needle.dataset.angle);
        needle.style.transformOrigin = hub[0] + "px " + hub[1] + "px";
        if (isFinite(angle)) {
          /* EVERY ANGLE IN THE SWING, WORKED OUT HERE AND WRITTEN DOWN.
             It used to be one number — the starting angle — with the keyframes
             deriving the overshoot and the two settling wobbles from it by
             multiplying one custom property by another inside a calc(). That
             is the sort of thing that works in a test page and is quietly
             dropped in a real one: a calc() multiplying two custom properties,
             inside a keyframe, on an SVG element, is about as far out on the
             thin ice as CSS goes, and where it is not supported the whole
             keyframe is invalid and the needle simply does not move. Which is
             exactly what was happening.

             Four plain degree values instead. Nothing to resolve, nothing to
             multiply, and the shape of the swing is decided in the one place
             that already knows the angles. CSS turns clockwise and the dial is
             measured the other way round, hence the minus. */
          const swing = -(SETTINGS.dialFrom - angle);
          needle.style.setProperty("--swing", swing + "deg");
          needle.style.setProperty("--swing-past", (-swing * SETTINGS.past).toFixed(2) + "deg");
          needle.style.setProperty("--swing-back", (swing * SETTINGS.back).toFixed(2) + "deg");
          needle.style.setProperty("--swing-rest", (-swing * SETTINGS.rest).toFixed(2) + "deg");
        }
      }
      img.replaceWith(svg);
      watch(svg);
      play(svg, 0);
    });
  }

  /* ── PLAYING ONE ─────────────────────────────────────────────────────────
     A class on, and off again when it has finished. Off again matters: a class
     that stays on is a class that cannot be put on a second time, which is the
     usual reason an animation only ever plays once. */
  function play(node, wait) {
    const dial = node.classList.contains("ht-dial");
    const on = dial ? "is-swinging" : "is-turning";
    if (node.classList.contains(on)) return;
    const go = () => {
      node.classList.remove(on);
      void node.offsetWidth;            // let the browser notice it went away
      node.classList.add(on);
      setTimeout(() => node.classList.remove(on),
                 (dial ? SETTINGS.dialMs : SETTINGS.coinMs) + 120);
    };
    if (wait) setTimeout(go, wait); else go();
  }

  /* ── WATCHING FOR THEM TO COME INTO VIEW ─────────────────────────────────
     One observer for the whole page. It is deliberately NOT `once`: an icon
     that scrolls out and comes back, or a card that closes and opens, has
     appeared again, and appearing again is the case this file exists for.

     The stagger is counted per batch, so a row of icons arriving together
     moves as a row rather than as a block — and it is capped, or a page of
     twenty proposals would have the last one starting two seconds late. */
  let watcher = null;
  function watch(node) {
    /* POINTING AT ONE PLAYS IT. On the icon itself rather than on the card
       around it: hovering a card is not asking about its cost, and a row of
       readings that all move whenever the pointer crosses the card is a twitch
       rather than an answer. `play` refuses while one is already running, so
       waggling the mouse over it cannot stack them up. */
    if (!node.dataset.lifeHover) {
      node.dataset.lifeHover = "1";
      node.addEventListener("pointerenter", () => play(node, 0));
    }
    if (!window.IntersectionObserver) { play(node, 0); return; }
    if (!watcher) {
      watcher = new IntersectionObserver(entries => {
        let nth = 0;
        entries.forEach(entry => {
          if (!entry.isIntersecting) return;
          play(entry.target,
               Math.min(nth++, SETTINGS.staggerMost) * SETTINGS.stagger);
        });
      }, { threshold: SETTINGS.showing });
    }
    watcher.observe(node);
  }

  /* ── FINDING THEM ────────────────────────────────────────────────────────
     Everything already on the page, and everything that arrives later — a
     waypoint card is built after this file runs, and the cards on the main map
     are built later still. One observer on the body rather than a hook into
     every generator, so a third page that writes one of these icons gets the
     behaviour without knowing this file exists. */
  function sweep(root) {
    const found = ((root && root.querySelectorAll) ? root : document)
      .querySelectorAll('[data-life="coin"], [data-life="dial"]');
    found.forEach(node => {
      if (node.dataset.life === "dial") beDial(node);
      else if (!node.dataset.lifeOn) { node.dataset.lifeOn = "1"; watch(node); }
    });
  }

  /* ── AND BEING ASKED DIRECTLY ────────────────────────────────────────────
     An observer answers "has this scrolled into view", which is the right
     question on the wishful page, where each proposal is a card in a column.
     It is the WRONG question on a trail page and on the main map: the cards
     there are all in the viewport all the time and simply faded to nothing, so
     the observer fires once, while the card is invisible, and never again.

     So the pages that fade their cards ask for the animation at the moment a
     card actually becomes the one on screen. Nothing here has to know which
     pages those are — they call `replay` and pass the card. */
  function replay(root) {
    if (!root) return;
    sweep(root);                     // in case its dial is still an <img>
    let nth = 0;
    root.querySelectorAll('[data-life="coin"], svg.ht-dial').forEach(node => {
      play(node, Math.min(nth++, SETTINGS.staggerMost) * SETTINGS.stagger);
    });
  }
  window.HappyTrailsIconLife = { replay: replay, sweep: () => sweep(document) };

  function begin() {
    sweep(document);
    if (!window.MutationObserver) return;
    let due = 0;
    new MutationObserver(() => {
      // one sweep per burst of changes, not one per node
      clearTimeout(due);
      due = setTimeout(() => sweep(document), 60);
    }).observe(document.body, { childList: true, subtree: true });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", begin);
  } else {
    begin();
  }
})();
