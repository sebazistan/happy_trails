/* ═══════════════════════════════════════════════════════════════════════════
   HAPPY TRAILS — THE LINE FROM A CARD TO ITS PLACE
   version 3.2

   One line, from a waypoint on the map to the card that is about it.

   IT IS AN ELBOW, NOT A CURVE. It leaves the ring going straight up or
   straight down, turns one rounded corner, and runs straight across to the
   card:

         ( ● )
           │
           ╰──────────────┤ the card

   Two reasons, and the second is the real one. A drawn map is made of straight
   runs and right angles — the trails on it are drawn that way, the way a
   transit map is — so a swooping curve across it reads as something else
   entirely, something lying ON the map rather than belonging to it. And a line
   with one bend in a known place is one a reader can follow with their eye in
   a single movement; a curve has to be traced.

   IT IS DASHED, AND THE DASHES MOVE TOWARDS THE CARD. Slowly. The line says
   which way to look; the dashes travelling along it say it again: from the
   place on the map, to the words that are about it. The marching is one CSS
   animation on a constant dash pattern — see `--leader-cycle` and tm-march in
   the stylesheet — so it costs nothing per frame and carries on while the
   page is still.

   AND IT DRAWS ITSELF, IN A FIXED ORDER:

       1. the CARD arrives, and finishes arriving;
       2. THEN the line draws itself in, starting at the waypoint and growing
          towards the card;
       3. when the card is to go, the line draws itself back out FIRST — into
          the waypoint — and the card follows it.

   One number, `progress`, 0 to 1, says how much of the line exists, and it is
   wound by TIME, not by the card's fade: a card that is fading by scroll
   position cannot be asked to wait for a line. The only thing the card's fade
   is still allowed to do is hold the line back — see `leaderGone` — so a card
   that leaves faster than the line can retract takes the line with it, and
   there is never a line pointing at a card that is not there.

   HOW A LINE IS ONLY PART DRAWN, since a dashed line cannot use its own dash
   offset (that belongs to the marching): the line is shown through a MASK, and
   the mask is a second, solid copy of the same path whose own dash offset is
   the curtain. The copy is given `pathLength="1"` so that "all of it" is one
   unit whatever the line's real length is, and the line's real length changes
   every frame the map is zoomed.

   IT LIVES IN ITS OWN FILE BECAUSE TWO PAGES DRAW IT. The trail pages and the
   main map draw the same line, and with two copies the pages would start to
   differ in ways nobody means: one gets a fix, the other does not.

   WHAT A CALLER HAS TO PROVIDE is an overlay to draw on and, each time, the
   things the line joins:

       ring    the element on the map — a waypoint's chip, or the main map's
               featured icon. Its own box is used, or the .tm-pin inside it
               where there is one, because a trail page's chip is a zero-sized
               anchor with the ring hanging off it.
       card    the card. Any element with a box.
       shown   how faded in the card is, 0 to 1.

   AND IT HAS TO BE ASKED EVERY FRAME. Zooming moves the ring and nothing else
   moves the line, so a caller whose loop goes to sleep when the map is still
   must stay awake for as long as `busy()` says the line is drawing, and for as
   long as the map is moving.

   EVERYTHING ELSE IT WORKS OUT: where to leave the ring, which edge of the
   card to arrive at, which spot on that edge to hold on to, when to give the
   hold up, and when there is no line worth drawing at all.

   THE CALLS: draw(what) each frame; busy() whether it is mid-draw; drawn()
   whether any of it is on screen; retract(lead) to draw it out now, resolving
   when it is time for the card to follow; cancel() to take that back.
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  "use strict";

  /* ── THE NUMBERS ──────────────────────────────────────────────────────────
     Defaults. A caller passes its own over the top of these, which is how the
     trail pages keep theirs in trail-engine.js's settings block with all the
     others. */
  var SETTINGS = {
    /* WHEN THE LINE IS ALLOWED TO BEGIN, AS A FRACTION OF THE CARD'S FADE.
       The card has to be (nearly) all the way there before the line starts,
       because the order is card, THEN line. Short of 1 so a card whose fade
       never quite reaches it — a rounding, a card behind another — still gets
       one; high enough that the line cannot start while the card is still
       visibly arriving. */
    leaderInAt: 0.96,
    /* …AND WHEN IT MUST START LEAVING. Lower than leaderInAt on purpose, so a
       card hovering around one value cannot make the line flicker on and off:
       it starts at 0.96 and stays until the card has fallen to 0.92. */
    leaderOutAt: 0.92,
    /* THE FADE BY WHICH THE LINE MUST BE COMPLETELY GONE, whatever the clock
       says. A card that is fading by scroll position can leave in a tenth of a
       second; the line takes leaderOutMs. This is what keeps the line from
       outliving it. Between leaderOutAt and here the line is capped to the
       share of the card's fade that is left. */
    leaderGone: 0.18,

    leaderDrawMs: 420,      // how long the line takes to draw itself in
    leaderOutMs: 260,       // …and to draw itself back out. Shorter on
                            // purpose: arriving should be seen, leaving
                            // should not hold anybody up.
    leaderOutLead: 0.65,    // when a card is put away by hand, it waits this
                            // share of the retraction before it follows. Less
                            // than 1 so closing does not feel slow; more than
                            // 0 so the line really is going before the card.

    leaderBelow: 11,        // the LEAST it drops below the ring's middle
    leaderClear: 3,         // …and how far outside the ring's own edge
    leaderDrop: 54,         // how far it falls before it turns for the card
    leaderGap: 0,           // how far short of the card's edge it stops
    leaderShortest: 14,     // below this length it is not worth drawing
    leaderCardLeast: 20,    // a card box shorter than this is a card that is
                            // collapsing, not a card: the main map shuts a
                            // closed card's layout box up in a frame while its
                            // opacity is still fading, and a line drawn to the
                            // box it has then is attached to nothing
    leaderCorner: 26,       // the radius of the one bend. Big enough to read as
                            // a turn rather than a kink; it is cut down to half
                            // the shorter run when there is not room for it.
    leaderDash: 6,          // the dash, and the gap between two dashes, in
    leaderDashGap: 11,      // pixels. The gap is nearly twice the dash, which
                            // reads as a line of travelling dots rather than as
                            // a dashed border.
    leaderMarchMs: 2400,    // how long one dash takes to travel into the place
                            // the next one came from. Slow on purpose: it
                            // should be noticed only once, and then believed.
    leaderMask: 12,         // the width of the curtain, in pixels. Wider than
                            // the line by a margin, so no part of the line is
                            // ever clipped sideways by it.
    leaderMaxStep: 100,     // the most one frame is allowed to advance the
                            // drawing, in ms, so one very slow frame cannot
                            // skip most of the animation in one go.
    leaderStick: true,      // it keeps the spot it took on the card
    leaderStickSlack: 40,   // …until the ring is this far past the card's middle
    leaderStickStill: 7     // and it only takes a hold on a card standing still
  };

  var clamp = function (v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; };

  function leader(opts) {
    var holder = opts.holder;
    var line = opts.line;
    var fade = opts.fade || null;
    var S = {};
    Object.keys(SETTINGS).forEach(function (k) { S[k] = SETTINGS[k]; });
    Object.keys(opts.settings || {}).forEach(function (k) {
      if (opts.settings[k] !== undefined) S[k] = opts.settings[k];
    });

    /* WHERE THE LINE IS ATTACHED TO THE CARD, remembered rather than worked
       out afresh every frame. `side` is 0–3 for left, right, top, bottom;
       `along` is how far down or across that edge, as a fraction, so the spot
       survives the card changing size. */
    var held = { key: null, side: -1, along: 0.5, box: null };

    /* WHICH CARD'S LINE THIS IS, and how much of it exists. `progress` is 0
       (nothing) to 1 (all of it), wound by the clock; `forced` is somebody
       having asked for it to go NOW (a card being put away); `lastAt` is the
       time of the previous call, which is what the winding is measured from. */
    var lineFor = null;
    var progress = 0, forced = false, lastAt = 0, moving = false;

    /* NOBODY WHO HAS ASKED FOR LESS MOVEMENT GETS A LINE THAT DRAWS. It
       arrives and leaves in a frame. Read once: a setting that changes
       mid-visit is rare enough to be a reload. */
    var calm = !!(window.matchMedia &&
                  window.matchMedia("(prefers-reduced-motion: reduce)").matches);
    var drawMs = calm ? 1 : S.leaderDrawMs;
    var outMs  = calm ? 1 : S.leaderOutMs;

    /* ── THE CURTAIN ──────────────────────────────────────────────────────
       A mask holding a solid copy of the line. Built here, once, rather than
       written into each page's markup, so the pages cannot disagree about it.
       `userSpaceOnUse` and a region far
       bigger than the window: the default, objectBoundingBox, is the line's
       own box, and a straight line has a box with no height at all, which
       masks everything away. */
    var NS = "http://www.w3.org/2000/svg";
    var curtain = null;
    (function () {
      var svg = line.ownerSVGElement;
      if (!svg) return;
      var defs = svg.querySelector("defs");
      if (!defs) { defs = document.createElementNS(NS, "defs"); svg.insertBefore(defs, svg.firstChild); }
      var mask = document.createElementNS(NS, "mask");
      mask.setAttribute("id", "tm-leaderReveal");
      mask.setAttribute("maskUnits", "userSpaceOnUse");
      mask.setAttribute("x", "-20000"); mask.setAttribute("y", "-20000");
      mask.setAttribute("width", "40000"); mask.setAttribute("height", "40000");
      curtain = document.createElementNS(NS, "path");
      curtain.setAttribute("fill", "none");
      curtain.setAttribute("stroke", "#fff");
      curtain.setAttribute("stroke-width", String(S.leaderMask));
      /* butt, not round: a round cap on a dash that has been drawn back to
         nothing is still a dot, and that dot would sit on the ring for as
         long as the line was supposed to be gone */
      curtain.setAttribute("stroke-linecap", "butt");
      /* ONE UNIT LONG WHATEVER ITS REAL LENGTH — see the header. A dash of 1
         and a gap of 2: the dash is the whole path, the gap is more than the
         whole path, so there is only ever the one stretch showing. */
      curtain.setAttribute("pathLength", "1");
      curtain.setAttribute("stroke-dasharray", "1 2");
      curtain.setAttribute("stroke-dashoffset", "1");
      mask.appendChild(curtain);
      defs.appendChild(mask);
      line.setAttribute("mask", "url(#tm-leaderReveal)");
    })();

    /* in and out of the draw both ease, so the line sets off and arrives
       without a jolt */
    var ease = function (t) {
      return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    };

    /* THE RING'S OWN CIRCLE. A trail page's chip is a zero-sized anchor with
       its ring hanging off it, so the ring is the .tm-pin inside; the main
       map's featured icon is a real element and is its own ring. Asking for the
       pin first and falling back to the element covers both. */
    function circleOf(ring) {
      var pin = ring.querySelector && ring.querySelector(".tm-pin, .tm-dot");
      var box = (pin || ring).getBoundingClientRect();
      return box.height ? box : null;
    }

    /* NOTHING ON SCREEN, and ready to start again from the beginning. The hold
       on the card is given up with it, so the next line chooses a fresh spot. */
    function hide() {
      progress = 0; moving = false;
      held.key = null; held.side = -1; held.box = null;
      if (curtain) curtain.setAttribute("stroke-dashoffset", "1");
      holder.classList.remove("is-on");
    }

    /* ── THE ONE CALL ─────────────────────────────────────────────────────── */
    function draw(what) {
      var ring = what && what.ring;
      var card = what && what.card;
      var key = what ? what.key : null;
      var shown = what ? what.shown : 0;

      var now = performance.now();
      var dt = lastAt ? clamp(now - lastAt, 0, S.leaderMaxStep) : 16.7;
      lastAt = now;

      /* NOTHING TO DRAW BETWEEN: the page does not want one (switched off, a
         phone, a card expanded over the whole window), or there is no card or
         ring, or the ring is not on the screen. Gone this frame, with no
         ceremony: there is nothing left to point at, and a retraction needs a
         card to retract in front of. */
      if ((what && what.hidden) || !ring || !card ||
          !(ring.getClientRects && ring.getClientRects().length)) {
        lineFor = null; forced = false; hide(); return;
      }

      /* A DIFFERENT CARD'S LINE IS A NEW LINE. It starts from nothing, however
         much of the last one was drawn. */
      if (key !== lineFor) { lineFor = key; forced = false; hide(); }
      /* A CARD THAT HAS GONE HAS FORGOTTEN IT WAS ASKED TO LEAVE. Without this
         a card put away and then opened again would have no line, for ever. */
      if (shown < S.leaderGone) forced = false;

      /* ── HOW MUCH OF IT SHOULD EXIST ────────────────────────────────────
         The line is wanted while its card is (nearly) all the way up, and not
         once somebody has said it is to go. Wanted, it grows by the clock;
         not wanted, it shrinks by the clock. */
      var wanted = !forced && shown >= (progress > 0 ? S.leaderOutAt : S.leaderInAt);
      progress = clamp(progress + (wanted ? dt / drawMs : -dt / outMs), 0, 1);

      /* AND NEVER MORE THAN THE CARD HAS LEFT TO GIVE, so the line leaves with
         a fast-fading card rather than after it. Between leaderOutAt and
         leaderGone the line is allowed the matching share of itself, and below
         leaderGone none. */
      var cap = clamp((shown - S.leaderGone) / Math.max(0.01, S.leaderOutAt - S.leaderGone), 0, 1);
      if (progress > cap) progress = cap;

      moving = wanted ? progress < 1 : progress > 0;
      if (!(progress > 0)) { hide(); return; }

      var mine = holder.getBoundingClientRect();
      var box = card.getBoundingClientRect();
      if (!box.width || box.height < S.leaderCardLeast) { holder.classList.remove("is-on"); return; }

      /* IT LEAVES FROM OUTSIDE THE RING. Two things have to be cleared and they
         want two different numbers, so the start is whichever is further out.

         THE NAME — on a trail page a chip with the waypoint's name sits beside
         the ring at the ring's own height, so a line starting level with the
         ring starts inside the words.

         THE RING ITSELF — a coloured circle with a WHITE MIDDLE, so a line
         starting inside it reads as a line lying over the dot rather than
         leaving it.

         And the ring is MEASURED. It is counter-scaled as the map zooms, and
         it GROWS when its own waypoint is the open one — which is exactly when
         the line is drawn. */
      var round = circleOf(ring);
      var anchor = round || ring.getBoundingClientRect();
      /* HOW FAR OUT IS CLEAR OF IT, measured off the RING'S WIDER SIDE. A ring
         a few pixels wider than it is tall would otherwise let a sideways
         start sit just inside its own edge, drawing a pixel or two of line
         across the white middle. The wider side clears it whichever way the
         line goes. */
      var across = round ? Math.max(round.width, round.height) : 0;
      var outside = round ? across / 2 + S.leaderClear : S.leaderBelow;
      var middle = { x: anchor.left + anchor.width / 2 - mine.left,
                     y: anchor.top + anchor.height / 2 - mine.top };

      /* THE CARD IS AIMED AT FROM THE RING'S MIDDLE, and the line then starts
         clear of it. Asking from the already-dropped start would decide where
         to go from a point chosen by assuming which way it was going; asking
         from the middle lets the leaving be decided by the arriving. */
      var g = S.leaderGap;
      var L = box.left - mine.left, R = box.right - mine.left;
      var T = box.top - mine.top, B = box.bottom - mine.top;

      /* ── WHERE ON THE CARD'S EDGE, AND WHY NOT STRAIGHT ACROSS ───────────
         The obvious spot on a left or right edge is the one LEVEL with the
         ring. It is also the one that draws no elbow at all — the line comes
         straight back to the same height, so what you see is a rule across the
         map with a wrinkle in it.

         So the spot is taken one `leaderDrop` BELOW the ring's own height.
         The line then leaves the ring going down, turns a proper corner, and
         runs in level with the card:

                ( ● )                     ( ● )  ─── level: no elbow
                  │                          ╰─────────────┤
                  ╰───────────┤

         THE CLAMP DOES THE REST. A card entirely above the ring has no room
         below it, so the point lands on its bottom edge and the line goes UP
         instead. A short card clamps to its own edge and the elbow is as big as
         it can be rather than as big as it was asked for.

         It costs a few pixels of length and buys the one thing the shape is
         for: it is obvious, at a glance, which end is the map and which end is
         the card. */
      var dropTo = clamp(middle.y + S.leaderDrop, T + 24, B - 24);
      var sides = [
        { x: L - g, y: dropTo },
        { x: R + g, y: dropTo },
        { x: clamp(middle.x, L + 24, R - 24), y: T - g },
        { x: clamp(middle.x, L + 24, R - 24), y: B + g }
      ];
      var side = 0, best = Infinity;
      sides.forEach(function (q, n) {
        var d = (q.x - middle.x) * (q.x - middle.x) +
                (q.y - middle.y) * (q.y - middle.y);
        if (d < best) { best = d; side = n; }
      });

      /* ── AND THEN IT HOLDS ON ────────────────────────────────────────────
         The sum above asks, every frame, "which spot on this card is nearest
         the ring right now" — and the answer keeps changing, because the map is
         moving. The far end would creep along the card's edge the whole time it
         is open, and read as a line lying NEAR a card rather than one joined TO
         it.

         So the spot is chosen ONCE and remembered as a FRACTION along the edge
         it landed on, so if the card changes size the point stays where it was
         on the card rather than on the screen. */
      function cardHasNotMoved() {
        var was = held.box;
        if (!was) return false;
        var near = S.leaderStickStill;
        return Math.abs(was.x - L) < near && Math.abs(was.y - T) < near &&
               Math.abs(was.w - (R - L)) < near && Math.abs(was.h - (B - T)) < near;
      }
      function stillHolds(which) {
        var slack = S.leaderStickSlack;
        var midX = (L + R) / 2, midY = (T + B) / 2;
        if (which === 0) return middle.x < midX + slack;
        if (which === 1) return middle.x > midX - slack;
        if (which === 2) return middle.y < midY + slack;
        return middle.y > midY - slack;
      }

      if (!S.leaderStick) {
        held.side = -1;
      } else if (held.key === key && held.side >= 0 && stillHolds(held.side) &&
                 cardHasNotMoved()) {
        side = held.side;
      } else {
        held.key = key;
        held.side = side;
        held.along = side > 1
          ? (sides[side].x - L) / Math.max(1, R - L)
          : (sides[side].y - T) / Math.max(1, B - T);
        held.box = { x: L, y: T, w: R - L, h: B - T };
      }
      var to = held.side < 0 ? sides[side]
        : side > 1 ? { x: L + held.along * (R - L), y: side === 2 ? T - g : B + g }
                   : { x: side === 0 ? L - g : R + g, y: T + held.along * (B - T) };

      /* ── WHICH WAY IT LEAVES, AND WHERE IT TURNS ────────────────────────
         It always leaves the ring VERTICALLY, up or down, and it always turns
         exactly once. Two reasons for the vertical start:

           · the waypoint's NAME is in a chip immediately beside the ring, at
             the ring's own height, so a line setting off sideways is drawn
             through the words;
           · and so are the NEIGHBOURING WAYPOINTS. A line running sideways at
             the ring's own height crosses the next waypoint's ring, seven
             pixels into the white middle of somebody else's circle.

         DOWN, UNLESS THE LINE IS GOING UP, and that is asked of `to`, not of
         the card's box: the line HOLDS the spot it first took, and that spot
         can be high up the edge of a card whose bottom is still well below the
         ring. Near the end of a trail the card can sit two hundred pixels
         HIGHER than its waypoint, and a line that started below the ring would
         have to climb back up through the white middle it had just been kept
         out of. Going up is as safe as going down: the name's chip is level
         with the ring's middle, so clearing the circle clears the words either
         way.

         AND THEN ONE CORNER, in one of two places:

              ( ● )                      ( ● )
                │                          │
                ╰──────┤ card              ╰──────╮
                                                  ├ card

         The first is for a card well above or below the ring: the line drops
         to the card's own height and comes in at its left or right edge
         travelling horizontally. The second is for a card almost LEVEL with the
         ring, and for one held by its top or bottom edge: the line runs across
         at the height it dropped to and turns up into the card at the end.

         WHY NOT A STRAIGHT RUN FOR THE LEVEL CASE. Because "level" is exactly
         the case where a straight run is along the row the rings are in. */
      var clearY = Math.max(S.leaderBelow, outside);
      var way = to.y < middle.y ? -1 : 1;
      var from = { x: middle.x, y: middle.y + way * clearY };

      /* is the card far enough past the clearance to turn AT its own height? */
      var beyond = (to.y - from.y) * way > 2;
      var corner = (side <= 1 && beyond) ? { x: from.x, y: to.y }
                                         : { x: to.x,   y: from.y };
      /* NO LINE WHEN THE RING IS UNDER THE CARD. A waypoint can end up behind
         its own card — on a narrow window, or where the trail runs under the
         column the cards sit in — and a line to the nearest edge would start
         inside the card and cross the words. The card is already ON the place
         it is about. */
      var under = from.x > L && from.x < R && from.y > T && from.y < B;

      /* NOR WHEN THE CARD'S EDGE IS ALREADY AT THE RING. The test above does
         not catch a ring sitting just OUTSIDE a card, a few pixels off the
         edge: the start is clear of the circle but the far end is not, and the
         line turns straight back round into the white middle to reach it.

         Both ends have to be outside the ring, and the same number says so for
         both. When they are not, the card has arrived on top of the place it is
         about, and that says it better than a line could. */
      var hugging = Math.hypot(to.x - middle.x, to.y - middle.y) < outside;
      var run = Math.hypot(to.x - from.x, to.y - from.y);
      if (under || hugging || run < S.leaderShortest) {
        holder.classList.remove("is-on");
        return;
      }

      /* ── THE SHAPE OF IT ─────────────────────────────────────────────────
         Three points — out of the ring, the corner, the card — and the corner
         rounded off. The round-off is a quadratic whose control point IS the
         corner: it leaves tangent to the first run and arrives tangent to the
         second, so neither straight stretch is bent on the approach.

         THE RADIUS IS CUT DOWN TO FIT. Half of the shorter of the two runs is
         the most it can ever be: a corner bigger than the line it is rounding
         draws a loop. At the limit the elbow becomes a diagonal, which is the
         right drawing for a corner that has no room to be one. */
      var at = function (q) { return q.x.toFixed(1) + " " + q.y.toFixed(1); };
      var legA = Math.hypot(corner.x - from.x, corner.y - from.y);
      var legB = Math.hypot(to.x - corner.x, to.y - corner.y);
      var r = Math.min(S.leaderCorner, legA / 2, legB / 2);
      var d;
      if (r < 1) {
        // the three points are in line, near enough: one run, no kink
        d = "M" + at(from) + " L" + at(to);
      } else {
        var into = { x: corner.x + (from.x - corner.x) / legA * r,
                     y: corner.y + (from.y - corner.y) / legA * r };
        var outOf = { x: corner.x + (to.x - corner.x) / legB * r,
                      y: corner.y + (to.y - corner.y) / legB * r };
        d = "M" + at(from) + " L" + at(into) +
            " Q" + at(corner) + " " + at(outOf) +
            " L" + at(to);
      }
      if (line.getAttribute("d") !== d) {
        line.setAttribute("d", d);
        /* the curtain is the same path, so that "a quarter of the line" is a
           quarter of THIS line, round the corner and all */
        if (curtain) curtain.setAttribute("d", d);
      }

      /* THE FADE RUNS ALONG THE LINE, not across the window. A user-space
         gradient is given the line's own two ends each frame — otherwise it is
         measured against the bounding box and a line running up and to the
         left fades the wrong way round. */
      if (fade) {
        fade.setAttribute("x1", from.x.toFixed(1));
        fade.setAttribute("y1", from.y.toFixed(1));
        fade.setAttribute("x2", to.x.toFixed(1));
        fade.setAttribute("y2", to.y.toFixed(1));
      }

      /* ── THE DASHES, AND WHICH WAY THEY TRAVEL ───────────────────────────
         A constant pattern — dash, gap, dash, gap — and one CSS animation
         sliding the offset by exactly one dash-and-gap, for ever, so the end of
         the animation is indistinguishable from its beginning and there is no
         seam.

         THE OFFSET FALLS, AND THAT IS THE DIRECTION. A falling dash offset
         moves the pattern towards the END of the path, and the path starts at
         the ring and ends at the card — so the dashes travel from the place on
         the map to the card that is about it: first where, then what. The path
         is always drawn ring-first so the line can GROW from the ring; the sign
         of the offset is the only thing that says which way the dashes go.

         IT IS WRITTEN AS A CUSTOM PROPERTY rather than animated here, because
         the caller's loop sleeps whenever the map is still, and an animation
         driven from a sleeping loop stops mid-stride. */
      var cycle = S.leaderDash + S.leaderDashGap;
      line.style.strokeDasharray = S.leaderDash + " " + S.leaderDashGap;
      line.style.setProperty("--leader-cycle", cycle + "px");
      line.style.setProperty("--leader-march", S.leaderMarchMs + "ms");

      /* ── AND HOW MUCH OF IT IS SHOWING ───────────────────────────────────
         The curtain's own dash offset: 1 draws none of the path, 0 draws all
         of it, and between them the visible part is the START of the path, so
         the line grows out of the ring and shrinks back into it. */
      if (curtain) curtain.setAttribute("stroke-dashoffset", (1 - ease(progress)).toFixed(4));

      if (what.wishful !== undefined) {
        holder.classList.toggle("is-wishful", !!what.wishful);
      }
      holder.classList.add("is-on");
    }

    /* ── THE REST OF WHAT A PAGE CAN ASK ──────────────────────────────────── */

    /* whether the line is mid-draw, either way. A caller whose loop goes to
       sleep when nothing else is moving has to stay awake while this is true,
       or the line stops half-drawn. */
    function busy() { return moving; }

    /* whether any of it is on screen */
    function drawn() { return progress > 0; }

    /* DRAW IT OUT NOW. Returns a promise that resolves when it is time for the
       card to follow: after `lead` of the retraction, 1 being all of it. A
       caller putting a card away by hand passes S.leaderOutLead so the line
       is going before the card is; the tours pass 1 and the card leaves only
       once the line has gone. If nothing is drawn, it resolves at once.

       The time is a share of what is LEFT to draw back, not of the whole
       thing: a line caught a tenth of the way out has a tenth to go. */
    function retract(lead) {
      return new Promise(function (resolve) {
        if (!(progress > 0)) { resolve(); return; }
        forced = true;
        var share = lead === undefined ? 1 : clamp(lead, 0, 1);
        setTimeout(resolve, Math.round(outMs * progress * share));
      });
    }

    /* take that back — the card was asked for again before it left */
    function cancel() { forced = false; }

    return { draw: draw, busy: busy, drawn: drawn, retract: retract,
             cancel: cancel };
  }

  window.HappyTrailsLeader = leader;
})();
