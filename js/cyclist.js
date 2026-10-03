/* ═══════════════════════════════════════════════════════════════════════════
   HAPPY TRAILS — THE CYCLIST
   version 2.2

   A stick figure on a bicycle, riding the trail in place of the red dot.

   Press the compass and the walking point becomes a rider; press it again and
   it goes back to being a dot. It is deliberately a thing you find rather than
   a thing you are offered: the page works without it and never mentions it.

   THE BICYCLE IS NOT DRAWN HERE. It is drawn in Illustrator, in
   artwork/players/cyclist.svg, and this file asks player-rig.js for it, so the
   rider can be redrawn without touching code: move the saddle, drag the hip
   dot with it, save, build. The rig reads the pivots out of the drawing.

   WHAT LIVES HERE is everything about the TRAIL rather than the bicycle: how
   far the ground has moved, which way the rider faces, when he turns round,
   when he puts a foot down, and when he pulls a wheelie.

   THE WHEELS HAVE TO TURN AT THE RIGHT RATE. A wheel turns because the ground
   goes past it, so the angle is distance travelled divided by radius in the
   SAME units. The distance is in map units, the wheel is drawn in its own
   units, and the map zoom changes, so that conversion is the whole job. Get it
   wrong and the wheels skate. This file works out the distance in screen
   pixels and hands over that one number; the rig does the rest.

   THE RIDER STAYS UPRIGHT. A bicycle drawn along a line running right-to-left
   is upside down, so when the heading turns back on itself the figure MIRRORS
   (rides the other way, still head-up) with a visible flip and a hold
   afterwards, so a trail that dithers cannot set it spinning.

   IT RUNS ITS OWN LOOP, only while showing. Nothing in the engine knows it
   exists; it asks TRAIL where the walk is and draws itself.
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  "use strict";

  /* ── EVERY NUMBER IN ONE PLACE ───────────────────────────────────────────
     The bicycle's own proportions live in the drawing; only what this file
     decides is here. */
  var S = {
    /* HOW BIG HE IS, in screen pixels, ground to top of head. The drawing
       scales to it. */
    height:        57,

    /* HOW HE SITS ON THE TRAIL. The drawing's `ground` line (where the tyres
       touch) rests on the LOWER edge of the drawn route, not its middle, so the
       bicycle looks on the path rather than sunk into it. */
    sitOn:         0.5,     // share of the line's width below its centre

    /* WHICH WAY ROUND HE IS. Hysteresis plus a hold: a heading hovering at
       dead vertical would otherwise flip the rider back and forth forever. */
    flipAt:        0.12,    // how far past straight up the heading must go
    flipAfterMs:   1100,    // how long a MARGINAL wrong heading must last
                            // before he acts; this stops a wobbly trail
                            // spinning him
    flipAtOnce:    0.62,    // a heading this emphatically backwards is the
                            // trail turning round, not wobbling, so above this
                            // he turns after flipSoonMs instead. The long wait
                            // is only needed near vertical, where a hand's
                            // breadth of wobble changes the sign.
    flipSoonMs:     260,    // the short wait; long enough that a kink ridden
                            // through in a quarter of a second never registers
    flipHoldMs:    1600,    // wait after a flip before another: the first two
                            // stop him reacting to the trail's noise, this
                            // stops him reacting to himself
    flipShowMs:    260,     // how long the flip takes to play; written onto
                            // --cy-turn so the number lives only here

    /* STANDING STILL. A cyclist who stops puts a foot down, or reads as a bug.
       WHERE the foot goes is the drawing's business; only WHEN is decided here. */
    stopAfterMs:   420,     // no movement for this long counts as stopped
    footDownMs:    260,     // and how long the leg takes to reach the ground
    stillBelow:    0.04,    // screen px per frame under which nothing is moving

    /* THE WHEELIE. Rare, and never twice in a row: the charm is not being sure
       you saw it. */
    wheelieEvery: 10000,    // mid-ride: never more often than this
    wheelieOdds:   0.012,   // and even then, only sometimes
    wheelieOnStart: 0.62,   // pulling away from a stop: usually, since that is
                            // when a rider really does one
    wheelieAfterStop: 2600, // but not twice within this, or a reader jogging
                            // the scroll back and forth gets a circus act
    wheelieMs:     980,
    wheelieDeg:    26,

    lookAhead:     0.004    // how far along the route to look for the heading,
                            // as a fraction of the whole
  };

  /* ── THE FIGURE ──────────────────────────────────────────────────────────
     Asked for by name. What comes back knows its own size, where its anchor
     is, and how to be told how far it has come. The anchor in cyclist.svg sits
     under the BACK WHEEL on the ground line, because that is the point that
     rides the route. */
  function hire() {
    var rig = window.HappyTrailsRig;
    if (!rig) return null;
    return rig.player("cyclist", { height: S.height });
  }

  /* THE STACK OF WRAPPERS the figure hangs in, outermost first. Each does one
     thing, and they are separate because they change at different moments and
     would otherwise fight over a single transform.

       cy-spin   which way along the trail he is pointing
       cy-flip   whether he is mirrored, so he stays head-up
       cy-tip    the wheelie
       cy-sit    the drop onto the lower edge of the route line          */
  var LAYERS = ["cy-spin", "cy-flip", "cy-tip", "cy-sit"];

  /* ── AND THE RIDE ITSELF ─────────────────────────────────────────────── */
  function start() {
    var T = window.TRAIL;
    var walker = document.getElementById("tm-walker");
    var compass = document.getElementById("tm-compass");
    if (!T || !walker || !compass || !T.pointAtFraction) return;

    var bike = hire();
    if (!bike) return;                    // no players.js: the dot stays a dot

    /* THE WRAPPERS, nested outermost to innermost, the drawing at the bottom:
       plain divs of no size sitting on the walking point. */
    var layers = {}, parent = walker;
    LAYERS.forEach(function (name) {
      var d = document.createElement("div");
      d.className = "cy-layer " + name;
      parent.appendChild(d);
      parent = layers[name] = d;
    });
    var spin = layers["cy-spin"], flip = layers["cy-flip"], tip = layers["cy-tip"];
    parent.appendChild(bike.el);

    /* An <svg> does not size itself to its contents, so it is given its own
       viewBox as a pixel box and then scaled (which also keeps stroke weights
       right), and offset so the drawing's ANCHOR lands on the walking point. */
    var vb = (bike.el.getAttribute("viewBox") || "0 0 100 100").split(/[\s,]+/).map(Number);
    bike.el.setAttribute("width", vb[2]);
    bike.el.setAttribute("height", vb[3]);
    bike.el.style.width = vb[2] + "px";
    bike.el.style.height = vb[3] + "px";
    bike.el.style.left = ((vb[0] - bike.anchor.x) * bike.scale).toFixed(2) + "px";
    bike.el.style.top = ((vb[1] - bike.anchor.y) * bike.scale).toFixed(2) + "px";
    bike.el.style.transform = "scale(" + bike.scale.toFixed(5) + ")";

    // the stylesheet is told how long a turn takes (flipShowMs stays the one
    // place the number is written)
    document.documentElement.style.setProperty("--cy-turn", S.flipShowMs + "ms");

    var riding = false, ticking = false;
    var rolledSoFar = 0, lastAt = null, flipped = false, flippedAtMs = 0;
    var movedAt = 0, footDown = 1, wheelieAt = -99999, wheelieFrom = 0;
    var wasStopped = true, wrongSince = 0, hasRidden = false;
    var lastMs = 0;

    /* A HANDLE ON IT, for checking: a thing that happens by chance every ten
       seconds is otherwise impossible to test. The page does not use it. */
    window.CYCLIST = {
      settings: S,
      riding: function () { return riding; },
      wheelie: function () { wheelieFrom = performance.now(); wheelieAt = wheelieFrom; },
      look: function () {
        return { rolled: rolledSoFar, flipped: flipped, foot: footDown,
                 scale: bike.scale, height: bike.height };
      },
      rider: function () { return bike; }
    };

    compass.classList.add("cy-hint");
    compass.addEventListener("click", function () {
      riding = !riding;
      walker.classList.toggle("is-riding", riding);
      compass.classList.toggle("is-riding", riding);
      if (riding) { lastAt = null; lastMs = 0; hasRidden = false; wake(); }
    });

    function wake() { if (!ticking) { ticking = true; requestAnimationFrame(frame); } }

    function frame(now) {
      if (!riding) { ticking = false; return; }
      var gap = lastMs ? Math.min(64, now - lastMs) : 16.7;
      lastMs = now;

      var at = T.where();
      var zoom = T.zoomNow();
      sitOnTheLine();

      /* ── HOW FAR THE GROUND MOVED, ON SCREEN ─────────────────────────────
         The number the whole thing hangs on. `at` is a fraction of the route;
         times the route's length it is MAP units; times the zoom it is the
         SCREEN pixels the ground travelled under the wheel, the same units the
         wheel is drawn in. */
      if (lastAt === null) lastAt = at;
      var rolled = (at - lastAt) * T.length * zoom;
      lastAt = at;
      rolledSoFar += rolled;

      var speed = Math.abs(rolled);
      if (speed > S.stillBelow) movedAt = now;
      var stopped = now - movedAt > S.stopAfterMs;
      var wantFoot = stopped ? 1 : 0;
      var ease = Math.min(1, gap / S.footDownMs);
      footDown += (wantFoot - footDown) * ease;

      /* ── WHICH WAY IT IS POINTING ───────────────────────────────────────
         Two samples a hair apart; their difference is the heading, which is
         both which way the bicycle faces and, once past straight up, which way
         round the rider must be to stay head-up. */
      var a = T.pointAtFraction(Math.max(0, at - S.lookAhead));
      var b = T.pointAtFraction(Math.min(1, at + S.lookAhead));
      var hx = b.x - a.x, hy = b.y - a.y;
      var heading = (Math.abs(hx) + Math.abs(hy)) < 0.0001 ? 0
                  : Math.atan2(hy, hx) * 180 / Math.PI;

      /* ── AND HE ONLY TURNS ROUND IF HE MEANS IT ──────────────────────────
         The heading must be wrong for a WHILE before he reacts: a river path
         re-crosses its own valley, and testing the instant heading would have
         him spinning like a weathervane. A kink ridden through in half a second
         never registers, which is right. The hold since the LAST flip is a
         separate job: it stops him reacting to himself. */
      var facing = Math.cos(heading * Math.PI / 180);
      var wantFlip = flipped ? facing < S.flipAt : facing < -S.flipAt;
      /* HOW WRONG HE IS, from nought (dead vertical, genuinely open) to one
         (riding backwards, not). The wait is chosen from this; one number for
         every case left him upside down for a full second at every reversal. */
      var wrongBy = flipped ? facing : -facing;
      if (wantFlip !== flipped) {
        if (!wrongSince) wrongSince = now;
        /* THE FIRST FRAME DOES NOT WAIT. How he first appears is not a change
           of mind, just which way the trail runs where the reader stands;
           waiting meant a second of an upside-down cyclist on trails that start
           east-to-west. */
        var waitFor = !hasRidden ? 0
                    : wrongBy > S.flipAtOnce ? S.flipSoonMs
                    : S.flipAfterMs;
        if (now - wrongSince >= waitFor &&
            (!hasRidden || now - flippedAtMs > S.flipHoldMs)) {
          var quietly = !hasRidden;
          flipped = wantFlip;
          flippedAtMs = now;
          wrongSince = 0;
          /* THE TURN IS A TRANSITION, NOT A KEYFRAME ANIMATION. Keyframes
             running scaleX 1 → .06 → 1 ended back at the value they started
             from, un-mirroring the figure after the heading had already turned,
             so he faced backwards and flipped again. A transition between
             scaleX(1) and scaleX(-1) squashes through nought on its own and
             can only land on the value it was given.

             Appearing for the first time is not a turn, so the transition is
             switched off for that single frame. */
          if (quietly) {
            flip.style.transition = "none";
            flip.style.transform = wantFlip ? "scaleX(-1)" : "scaleX(1)";
            void flip.offsetWidth;
            flip.style.transition = "";
          }
        }
      } else {
        wrongSince = 0;                             // it came right on its own
      }

      /* ── THE WHEELIE ─────────────────────────────────────────────────────
         MID-RIDE it is rare: a trick performed reliably is a feature, and
         would be boring by the third waypoint. PULLING AWAY FROM A STOP it is
         likely, because that is when a person really does one (the weight is
         already going back as the first pedal stroke lands); there the
         pleasure is recognition, not rarity. */
      if (!stopped && wasStopped &&
          now - wheelieAt > S.wheelieAfterStop &&
          Math.random() < S.wheelieOnStart) {
        wheelieAt = now; wheelieFrom = now;
      } else if (!stopped && now - wheelieAt > S.wheelieEvery &&
                 Math.random() < S.wheelieOdds) {
        wheelieAt = now; wheelieFrom = now;
      }
      wasStopped = stopped;
      var wheelieAge = (now - wheelieFrom) / S.wheelieMs;
      var lift = 0;
      if (wheelieAge >= 0 && wheelieAge <= 1) {
        // up fast, hold a moment, down slowly, as one actually goes
        var u = wheelieAge < 0.25 ? wheelieAge / 0.25
              : wheelieAge < 0.55 ? 1
              : 1 - (wheelieAge - 0.55) / 0.45;
        lift = S.wheelieDeg * (u * u * (3 - 2 * u));
      }

      /* ── AND IT IS DRAWN ──────────────────────────────────────────────────
         Three transforms for where the rider points (this file's business) and
         one call telling the drawing how far the ground has gone past. Wheels,
         cranks, knees and the nod of the head all come out of that one number. */
      var turn = flipped ? heading - 180 : heading;
      spin.style.transform = "rotate(" + turn.toFixed(2) + "deg)";
      flip.style.transform = flipped ? "scaleX(-1)" : "scaleX(1)";
      tip.style.transform = "rotate(" + (-lift).toFixed(2) + "deg)";

      bike.footDown(footDown);
      bike.moveTo(rolledSoFar);
      hasRidden = true;        // from here on, a flip is a change of mind

      requestAnimationFrame(frame);
    }

    /* ── WHERE THE TYRES MEET THE PATH ───────────────────────────────────
       The tyres rest on the LOWER EDGE of the drawn line, not its middle. The
       drawing's anchor is on its ground line under the back tyre, so the point
       that rides the route is already the contact patch; all that is left is
       to drop the figure by half the line's width.

       MEASURED, not calculated: the line's width is drawn through a chain of
       scales (world zoom, the chip's counter-scale, the lens), and working that
       out from the numbers would mean keeping a copy of somebody else's
       arithmetic correct forever. Re-measured only when the size he is drawn
       at moves enough to matter, a few times a page rather than sixty times a
       second. */
    var sitAt = -1;
    function sitOnTheLine() {
      var outline = document.getElementById("tm-trailOutline");
      var toScreen = bike.el.getScreenCTM();
      if (!outline || !toScreen || !outline.getScreenCTM) return;

      /* HOW BIG A PIXEL IS WHERE THE RIDER LIVES. He hangs inside the walking
         point, which is counter-scaled to keep his size as the map zooms, so
         the drop must be stated in his units, not the screen's.

         USE THE LENGTH OF THE MATRIX COLUMN, NOT `a`. `a` is the scale times
         the cosine of the rotation, and he is turned twice (along the trail and
         for a wheelie) and mirrored, which makes `a` negative. On the Beltline
         `a` ran 0.0272 to 0.2511 while his real size never left 0.2511: a
         ninefold error from nothing but which way he faced. It showed on zoom
         because the drop is only re-measured on change, so whatever `a` was at
         that moment got latched in: he sank two line-widths into the trail, or
         mirrored, climbed out of it. hypot(a, b) is the scale whatever the
         rotation, and positive whatever the mirroring. */
      var here = Math.hypot(toScreen.a, toScreen.b) / bike.scale;
      if (!here) return;

      /* NOTHING HAS MOVED, so nothing to do. Asked of the measured size rather
         than the zoom, because the chips and rider also shrink towards the
         finish under their own rule with the zoom standing still. */
      if (Math.abs(here - sitAt) < sitAt * 0.02) return;

      /* HOW WIDE THE ROUTE IS DRAWN, on screen, right now: the element's own
         screen matrix covers the world's zoom and whatever else is between, and
         cannot go stale.

         `a` IS SAFE HERE, so do not 'fix' it to match the above: nothing
         between the route and the screen rotates it (the world and lens only
         move and scale), whereas the rider hangs under two rotations and a
         mirror. */
      var wide = parseFloat(getComputedStyle(outline).strokeWidth) *
                 outline.getScreenCTM().a;
      if (!wide) return;

      sitAt = here;
      layers["cy-sit"].style.transform =
        "translateY(" + (wide * S.sitOn / here).toFixed(2) + "px)";
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () { setTimeout(start, 60); });
  } else {
    setTimeout(start, 60);
  }
})();
