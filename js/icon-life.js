/* ═══════════════════════════════════════════════════════════════════════════
   HAPPY TRAILS — THE ICONS THAT MOVE
   version 1.8

   WHAT THIS IS. Two of the little drawings on this site are readings rather
   than decoration (the coin says what a connection would COST, the dial how
   badly it is WANTED), and a reading that arrives with a bit of movement is
   read where one that is simply there is scenery. So:

     the coin   turns over once, edge on and back, the way a coin does
     the dial   swings its needle up from the bottom of the scale and settles
                onto its reading with one small overshoot

   EVERY TIME THE THING APPEARS, not once per page: a card that opens, closes
   and opens again does it again, because the second time is the first time for
   whoever is looking. That is the whole reason for this file.

   AND AGAIN WHENEVER SOMEBODY POINTS AT ONE: a reading you reach for is a
   reading you are asking about. It is also how anybody finds out the movement
   exists if they were looking elsewhere the first time.

   WHY NOT A GIF: a GIF has one animation clock shared by every copy on the
   page, so a play-once GIF shows its last frame on the second card that asks
   for it. It would also put hard edges on the coin's soft shine (GIF
   transparency is on or off) and fix the dial at three angles for ever.

   WHY THE DIAL IS INLINED AND THE COIN IS NOT. The coin turns as a whole, so it
   stays an <img> turned by the page's stylesheet. The dial's needle has to move
   INSIDE the drawing, which nothing outside an <img> can reach, so the dial's
   file is inlined and animated in place. The files are the same either way and
   are still correct sitting still with none of this running.

   WHERE THE ANGLES COME FROM: build/make_icons.py writes the angle it drew the
   needle at, and where it pivots, onto the group around it (`data-angle`,
   `data-hub`). Add a fourth reading to the dial and it swings to it with no
   change here.

   WHAT MARKS ONE: `data-life="coin"` or `data-life="dial"` on the <img>, put
   there by waypoint-card.js and make_wishful.py. Nothing matches on a file name.

   TO USE IT:  <script src="js/icon-life.js"></script>  and nothing else. It
   watches the page for icons arriving and for icons coming back into view.
   ═══════════════════════════════════════════════════════════════════════════ */

(function () {
  "use strict";

  const SETTINGS = {
    /* HOW MUCH OF THE ICON HAS TO BE SHOWING before it counts as having
       appeared. Small, because these sit in a row of facts at the bottom of a
       card that is often only just in view. */
    showing:      0.35,

    /* WHERE THE NEEDLE SWINGS UP FROM, as an angle on the dial's own
       protractor (180 is hard left, 0 is hard right): the bottom of the green,
       so a high reading travels furthest. */
    dialFrom:     180,
    /* …or from the OTHER end, when that is further: a low reading swung up from
       the bottom travelled thirty degrees, hardly a movement on a 28-pixel
       dial. This makes every needle cross at least half the scale. */
    dialFarEnd:   true,

    /* THE SHAPE OF THE SETTLE: how far past the reading the needle goes first,
       then back, then past again before it stops. A needle that stops dead has
       no weight; one that rings for ever is a toy. */
    past:         16,          // degrees past the reading, the first time
    back:         8,           // then back the other side by this much
    rest:         4,           // then past again
    last:         1.5,         // and the last small tremor before it stops

    /* AND HOW LONG THE TWO MOVES TAKE. Both are in the stylesheet too, as
       --coin-turn and --dial-swing, which is where to change them; these are
       only the fallback for working out when a turn has finished. */
    coinMs:       620,
    dialMs:       1300,

    /* A LITTLE STAGGER so a row of them does not move as one block. */
    stagger:      90,
    /* the cards whose readings play when the card itself is pointed at */
    cardsThatPlay: ".wt-card",
    staggerMost:  4,

    /* ── AND NOT UNTIL THE THING IS ACTUALLY ON SCREEN ─────────────────────
       Cards FADE in over about half a second, and the page asks for these
       animations the moment the fade begins, so the needle did its whole swing
       while the card was still transparent and by the time there was anything
       to see it had two degrees left to move: it looked broken. (The coin
       survives this because its two revolutions are still visible at the end.)

       So nothing plays until the icon is genuinely visible. `seenAt` is the
       opacity it must have reached; `waitMost` is how many frames to wait
       before playing anyway, so an icon that is invisible for some reason this
       file cannot see still animates. */
    seenAt:       0.9,
    waitMost:     150,          // frames — about two and a half seconds
  };

  const STILL = window.matchMedia &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* Somebody who has asked for less movement gets the drawings as drawn, which
     are correct: the needle is at its reading and the coin is face up. */
  if (STILL) return;

  /* ── THE DIAL'S FILE, FETCHED ONCE ───────────────────────────────────────
     One request per reading, not per icon. The promise itself is cached, so
     five cards asking at the same moment still make one request. */
  const files = new Map();

  function svgFor(src) {
    /* FIRST FROM icons/dials.js, the same drawings as text, loaded just before
       this file. It is the only route that works when a page is opened straight
       from a file on your own computer, where a browser will not let it fetch
       anything. */
    const known = window.HappyTrailsDials;
    const name = String(src || "").split("/").pop().split("?")[0];
    if (known && known[name]) return Promise.resolve(known[name]);
    if (!files.has(src)) {
      files.set(src, fetch(src)
        .then(r => (r.ok ? r.text() : Promise.reject(new Error(r.status))))
        .catch(() => null));
    }
    return files.get(src);
  }

  /* ── A DIAL ──────────────────────────────────────────────────────────────
     The <img> is replaced by the drawing itself with the same width, height
     and alt, so the layout does not move. If the fetch fails the <img> stays
     and the icon is simply still, which is a correct icon. */
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
        /* where it pivots and how far it has to come, read off the drawing */
        const hub = (needle.dataset.hub || "24 31").split(/[ ,]+/);
        const angle = parseFloat(needle.dataset.angle);

        if (isFinite(angle)) {
          /* EVERY ANGLE IN THE SWING, WORKED OUT HERE AND WRITTEN DOWN, and the
             swing DRIVEN FROM HERE a frame at a time by writing the SVG's own
             `transform` attribute (see swingNeedle()). Do not move this into
             CSS keyframes: a calc() multiplying two custom properties inside a
             keyframe on an SVG element is dropped by some browsers, which
             invalidates the keyframe and leaves the needle still, and
             stylesheet animation inside an SVG is what browsers agree on least
             (Safari in particular). SVG turns clockwise and the dial is
             measured the other way round, hence the minus. */
          const from = SETTINGS.dialFarEnd && angle > 90 ? 0 : SETTINGS.dialFrom;
          const swing = -(from - angle);
          /* the bounces are fixed degrees, not shares of the swing, so a short
             swing settles as visibly as a long one; each is on the far side of
             the reading from the one before */
          const way = swing < 0 ? 1 : -1;       // the direction of travel
          needle.lifeSwing = [swing, way * SETTINGS.past, -way * SETTINGS.back,
                              way * SETTINGS.rest, -way * SETTINGS.last, 0];
          needle.lifeHub = [parseFloat(hub[0]), parseFloat(hub[1])];
        }
      }
      img.replaceWith(svg);
      watch(svg);
      play(svg, 0);
    });
  }

  /* ── IS IT ACTUALLY ON SCREEN YET ────────────────────────────────────────
     Not "is it in the viewport" (an observer says yes about a card sitting at
     nought opacity) but "can it be SEEN". Opacity is multiplied up the
     ancestors, as the browser does it, and anything hidden outright is
     nought at once. */
  function seen(node) {
    let n = node, out = 1;
    while (n && n.nodeType === 1) {
      const s = getComputedStyle(n);
      if (s.visibility === "hidden" || s.display === "none") return 0;
      const o = parseFloat(s.opacity);
      if (isFinite(o)) out *= o;
      if (out < 0.02) return 0;
      n = n.parentElement;
    }
    return out;
  }

  /* ── PLAYING ONE ─────────────────────────────────────────────────────────
     A class on, and off again when finished: a class that stays on cannot be
     put on a second time, the usual reason an animation only plays once. It
     waits for the icon to be visible first (see `seenAt`), in a frame loop
     because what it waits for is a transition. `lifeWaiting` stops two
     requests queueing behind the same fade, since the class is not on yet
     while waiting. */
  function play(node, wait) {
    const dial = node.classList.contains("ht-dial");
    const on = dial ? "is-swinging" : "is-turning";
    if (node.classList.contains(on) || node.dataset.lifeWaiting) return;
    const go = () => {
      node.classList.remove(on);
      void node.getBoundingClientRect(); // let the browser notice it went away
      node.classList.add(on);
      if (dial) swingNeedle(node);
      setTimeout(() => node.classList.remove(on),
                 (dial ? SETTINGS.dialMs : SETTINGS.coinMs) + 120);
    };
    const whenSeen = () => {
      node.dataset.lifeWaiting = "1";
      let frames = 0;
      const look = () => {
        /* still attached? a card rebuilt underneath us takes its icons with it,
           and a loop watching a detached node would run to the cap */
        if (!node.isConnected) { delete node.dataset.lifeWaiting; return; }
        if (seen(node) >= SETTINGS.seenAt || ++frames > SETTINGS.waitMost) {
          delete node.dataset.lifeWaiting;
          go();
          return;
        }
        requestAnimationFrame(look);
      };
      requestAnimationFrame(look);
    };
    if (wait) setTimeout(whenSeen, wait); else whenSeen();
  }

  /* ── THE NEEDLE'S SWING, A FRAME AT A TIME ───────────────────────────────
     The needle starts at the far end of the scale, sweeps past its reading and
     swings back and forth three more times, each smaller. The six angles are
     the ones beDial() worked out; `SWING_AT` is where in the swing each is
     reached, and each leg eases in and out so it moves like something with
     weight. */
  const SWING_AT = [0, 0.42, 0.60, 0.75, 0.88, 1];
  const easeInOut = t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  function swingNeedle(svg) {
    const needle = svg.querySelector(".ht-needle");
    if (!needle || !needle.lifeSwing) return;
    const angles = needle.lifeSwing, hub = needle.lifeHub;
    cancelAnimationFrame(needle.lifeFrame);
    const began = performance.now();
    const frame = now => {
      const f = Math.min(1, (now - began) / SETTINGS.dialMs);
      let leg = 0;
      while (leg < SWING_AT.length - 2 && f > SWING_AT[leg + 1]) leg++;
      const t = (f - SWING_AT[leg]) / (SWING_AT[leg + 1] - SWING_AT[leg]);
      const a = angles[leg] + (angles[leg + 1] - angles[leg]) * easeInOut(Math.max(0, Math.min(1, t)));
      needle.setAttribute("transform", "rotate(" + a.toFixed(2) + " " + hub[0] + " " + hub[1] + ")");
      if (f < 1) needle.lifeFrame = requestAnimationFrame(frame);
      else needle.removeAttribute("transform");     // exactly as drawn
    };
    /* written at once, so the needle is at the far end before the next paint */
    frame(began);
  }

  /* ── WATCHING FOR THEM TO COME INTO VIEW ─────────────────────────────────
     One observer for the page, deliberately NOT `once`: an icon that scrolls
     out and back, or a card that closes and opens, has appeared again. The
     stagger is counted per batch so a row moves as a row, and capped so a page
     of twenty proposals does not start the last one two seconds late. */
  let watcher = null;
  function watch(node) {
    /* POINTING AT ONE PLAYS IT. `play` refuses while one is running, so
       waggling the mouse cannot stack them up. */
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
     Everything already on the page and everything that arrives later (cards
     are built after this file runs). One observer on the body rather than a
     hook into every generator, so a new page that writes these icons gets the
     behaviour for free. */
  function sweep(root) {
    const found = ((root && root.querySelectorAll) ? root : document)
      .querySelectorAll('[data-life="coin"], [data-life="dial"]');
    found.forEach(node => {
      if (node.dataset.life === "dial") beDial(node);
      else if (!node.dataset.lifeOn) { node.dataset.lifeOn = "1"; watch(node); }
    });
  }

  /* ── AND BEING ASKED DIRECTLY ────────────────────────────────────────────
     An observer answers "has this scrolled into view", right for the wishful
     page's column of cards, wrong for a trail page and the main map, where the
     cards are always in the viewport and merely faded out, so it fires once
     while the card is invisible. Pages that fade their cards call `replay` with
     the card at the moment it becomes the one on screen. */
  function replay(root) {
    if (!root) return;
    sweep(root);                     // in case its dial is still an <img>
    let nth = 0;
    root.querySelectorAll('[data-life="coin"], svg.ht-dial').forEach(node => {
      play(node, Math.min(nth++, SETTINGS.staggerMost) * SETTINGS.stagger);
    });
  }
  window.HappyTrailsIconLife = { replay: replay };

  /* ── AND POINTING AT A WHOLE CARD PLAYS ITS ICONS ────────────────────────
     On the Wishful page a proposal is one card and one link, so pointing at it
     is reaching for the proposal and its readings answer. One delegated
     listener covers every card; `pointerover` bubbles, and the check that the
     pointer came from OUTSIDE the card stops movement inside it restarting
     them. */
  const CARDS_THAT_PLAY = SETTINGS.cardsThatPlay;
  document.addEventListener("pointerover", e => {
    if (e.pointerType === "touch") return;         // a tap is not a hover
    const card = e.target.closest && e.target.closest(CARDS_THAT_PLAY);
    if (!card) return;
    if (e.relatedTarget && card.contains(e.relatedTarget)) return;
    let nth = 0;
    card.querySelectorAll('[data-life="coin"], svg.ht-dial').forEach(node =>
      play(node, Math.min(nth++, SETTINGS.staggerMost) * SETTINGS.stagger));
  });

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
