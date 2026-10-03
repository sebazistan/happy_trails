/* ═══════════════════════════════════════════════════════════════════════════
   HAPPY TRAILS — THE PLAYER RIG
   version 1.2

   Takes a drawing out of players.js and makes it move.

   THE WHOLE INTERFACE IS FOUR NAMES IN A DRAWING:

     part-<name>    a thing that can be drawn, and moved
     pivot-<name>   a dot saying where part-<name> turns. Never drawn — this
                    reads its centre and then removes it
     ground         the line the feet and the wheels stand on
     anchor         the one point that rides the route

   Nothing else is agreed between the drawing and the code. A joint is placed
   by DRAWING A DOT WHERE THE JOINT IS (the same trick the waypoint circles use
   to find the route), so there is no table of coordinates to keep in step with
   the artwork: move the saddle, drag the hip dot along with it, and the legs
   still work.

   NESTING IS THE SKELETON. part-shin-near drawn INSIDE part-thigh-near means
   the shin follows the thigh, because SVG transforms inherit. The joint order
   lives in the Layers panel, where the person drawing it can see it.

   NOTHING IS MEASURED IN SECONDS. Every moving thing is driven by DISTANCE
   TRAVELLED: the wheel turns because the ground went past under it, the dog's
   feet step every 0.42 m. So everything speeds up and slows down with the
   reader, needs no clock, and need not know what anything else is doing.

   Three lengths are in play, and muddling them is how a wheel ends up
   spinning like a food mixer:

     PIXELS      what moveTo() is given: how far the figure has moved across
                 the screen.

     DRAWING     what the artwork is in, whatever Illustrator was set to. A
     UNITS       wheel's radius is in these, so its turn is worked out in these
                 and comes out right without anybody typing a radius.

     THE         what a walking cycle is in (a dog steps every 0.42 m). The rig
     FIGURE'S    says how tall the figure really is (`tall`), the one fact needed
     METRES      to turn its metres into pixels.

   The first two differ by `scale`; the third is the first divided by
   `perMetre`.
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  "use strict";

  /* ── THE NUMBERS ──────────────────────────────────────────────────────── */
  var SETTINGS = {
    fallbackHeight: 40,   // px, if a rig forgets to say how tall it is
    fallbackTall: 1.7,    // metres, likewise — roughly a person
    fallbackGear: 3.0,    // wheel turns per turn of the pedals
    parkAt: -99999        // where the measuring bench sits, off screen
  };

  var SVG = "http://www.w3.org/2000/svg";
  var DEG = 180 / Math.PI;

  /* ── THE MEASURING BENCH ─────────────────────────────────────────────────
     getBBox() answers zero for anything not in the document, so a drawing is
     parked off screen just long enough to be measured. Appending it somewhere
     afterwards takes it off the bench, since an element is only in one place. */
  var bench = null;
  function onTheBench(node) {
    if (!bench) {
      bench = document.createElement("div");
      bench.setAttribute("aria-hidden", "true");
      bench.style.cssText = "position:absolute;left:" + SETTINGS.parkAt +
        "px;top:0;width:1px;height:1px;overflow:visible;pointer-events:none";
      document.body.appendChild(bench);
    }
    bench.appendChild(node);
  }

  function middleOf(node) {
    var b = node.getBBox();
    return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
  }

  /* ═════════════════════════════════════════════════════════════════════════
     ONE PLAYER
     ═════════════════════════════════════════════════════════════════════════ */
  function player(name, opts) {
    var lib = window.HappyTrailsPlayers;
    if (!lib || !lib.art || !lib.art[name]) return null;
    opts = opts || {};
    var rig = (lib.rigs && lib.rigs[name]) || {};

    /* ── THE DRAWING, AS A LIVE DOCUMENT ─────────────────────────────────── */
    var holder = document.createElementNS(SVG, "svg");
    var tmp = document.createElement("div");
    tmp.innerHTML = lib.art[name];
    var src = tmp.querySelector("svg");
    if (!src) return null;
    holder.setAttribute("viewBox", src.getAttribute("viewBox") || "0 0 100 100");
    holder.setAttribute("class", "pl pl-" + name);
    holder.setAttribute("aria-hidden", "true");
    holder.style.overflow = "visible";
    while (src.firstChild) holder.appendChild(src.firstChild);
    onTheBench(holder);

    var find = function (id) { return holder.querySelector('[id="' + id + '"]'); };

    /* ── THE PIVOTS, READ AND THEN TAKEN AWAY ────────────────────────────── */
    var pivots = {};
    Array.prototype.forEach.call(holder.querySelectorAll('[id^="pivot-"]'), function (n) {
      pivots[n.id.slice(6)] = middleOf(n);
      n.parentNode.removeChild(n);
    });
    var pivotBox = find("pivots");        // the tidy group they were drawn in
    if (pivotBox) pivotBox.parentNode.removeChild(pivotBox);

    /* ── THE ANCHOR, AND THE GROUND ──────────────────────────────────────── */
    var anchorDot = find("anchor");
    var anchor = { x: 0, y: 0 };
    if (anchorDot) {
      anchor = middleOf(anchorDot);
      anchorDot.parentNode.removeChild(anchorDot);
    }
    var groundLine = find("ground");
    var groundY = 0;
    if (groundLine) {
      groundY = middleOf(groundLine).y;
      groundLine.parentNode.removeChild(groundLine);
    }

    /* ── HOW BIG IT IS ON SCREEN ─────────────────────────────────────────────
       One number in the rig (how tall, ground to top) lets the drawing be any
       size in Illustrator, so nobody has to draw to a pixel grid. */
    var whole = holder.getBBox();
    var drawnTall = Math.max(1, groundY - whole.y);
    var height = opts.height || rig.height || SETTINGS.fallbackHeight;
    var scale = height / drawnTall;                       // px per drawing unit
    var perMetre = height / (rig.tall || SETTINGS.fallbackTall);   // px per metre

    /* ── WHAT MOVES ────────────────────────────────────────────────────────
       A part is found in the DRAWING, not the rig. The rig only says what a
       part DOES, and many parts do nothing on their own (a shin is moved
       entirely by its leg), so anything named part-<name> can be asked for by
       name whether the rig mentions it or not. Building parts only from the
       rig's list once left the shins unfound, and the crank quietly gave up
       every frame: no error, a rider whose legs never moved. Nothing in the
       console is not the same as the thing being there. */
    var parts = {};
    function partFor(key, how) {
      if (parts[key]) {
        if (how && !parts[key].how) parts[key].how = how;
        return parts[key];
      }
      var node = find("part-" + key);
      if (!node) return null;
      var box = node.getBBox();
      return (parts[key] = {
        node: node,
        how: how || {},
        pivot: pivots[key] || { x: box.x + box.width / 2, y: box.y + box.height / 2 },
        /* a wheel's radius comes from its own drawn size, so a bigger wheel
           turns more slowly and nobody ever types a radius */
        radius: Math.max(box.width, box.height) / 2
      });
    }
    var moving = [];
    Object.keys(rig.parts || {}).forEach(function (key) {
      var part = partFor(key, rig.parts[key]);
      if (part) moving.push(part);
    });

    /* ── THE DRAWN POSES, for a figure animated by hand rather than rigged ── */
    var frames = {};
    Object.keys(rig.frames || {}).forEach(function (set) {
      frames[set] = Array.prototype.slice.call(
        holder.querySelectorAll('[id^="frame-' + set + '-"]'))
        .sort(function (a, b) {
          return parseInt(a.id.split("-").pop(), 10) - parseInt(b.id.split("-").pop(), 10);
        });
    });

    /* ═══ THE PEDALLING LEG ══════════════════════════════════════════════════
       The foot is bolted to the crank and the knee is SOLVED: two bars of known
       length between a fixed hip and a foot going round a circle cross at
       exactly one pair of points, and which of the two is the knee is decided
       ONCE, from how the leg was drawn. Closed form, so exact and free; a leg
       solved rather than approximated is the difference between pedalling and
       waving.
       ═══════════════════════════════════════════════════════════════════════ */
    function setUpTheLeg(part) {
      var how = part.how.crank;
      var hub = pivots["crank"], reach = pivots["crank-reach"];
      var shin = partFor(how.shin);
      if (!hub || !reach || !shin) return null;

      var R = Math.hypot(reach.x - hub.x, reach.y - hub.y);
      var phase = (how.phase || 0) / DEG;
      /* WHERE THE FOOT WAS DRAWN. The drawing is the rest pose, so the foot as
         drawn must be the crank at this leg's own phase, which is why the two
         feet are drawn at opposite ends of the crank circle. */
      var footHome = { x: hub.x + Math.cos(phase) * R, y: hub.y + Math.sin(phase) * R };
      var leg = {
        hub: hub, R: R, phase: phase, shin: shin,
        gear: how.gear || SETTINGS.fallbackGear,
        wheel: partFor(how.wheel),
        hip: part.pivot,
        knee: shin.pivot,
        thighLen: Math.hypot(shin.pivot.x - part.pivot.x, shin.pivot.y - part.pivot.y),
        shinLen: Math.hypot(footHome.x - shin.pivot.x, footHome.y - shin.pivot.y)
      };
      /* WHERE THE FOOT GOES WHEN THE FIGURE STOPS: one foot leaves the pedal
         and reaches for the ground behind the cranks, where a person puts it.
         The leg usually cannot get there, and that is right: the solver
         straightens it as far as it goes, a leg reaching down, as at a red
         light. */
      leg.down = { x: hub.x - R * 0.8, y: groundY };
      leg.canPutDown = !!how.foot;

      leg.thighHome = Math.atan2(leg.knee.y - leg.hip.y, leg.knee.x - leg.hip.x);
      leg.shinHome = Math.atan2(footHome.y - leg.knee.y, footHome.x - leg.knee.x);
      /* WHICH WAY THE KNEE BENDS, from the drawing: solve the home pose both
         ways and keep the one that landed on the drawn knee. */
      leg.bend = 1;
      var tryIt = kneeFor(leg, footHome);
      if (Math.hypot(tryIt.x - leg.knee.x, tryIt.y - leg.knee.y) > 0.5) leg.bend = -1;

      /* CAN THE LEG REACH THE PEDAL? A leg drawn too short does not fail; it
         clamps, the foot comes off the crank and the rider paddles instead of
         pedalling, which is easy to look at without seeing. So it is measured
         at the furthest point of the circle and warned about, because the
         drawing is what needs fixing. */
      var furthest = Math.hypot(hub.x - leg.hip.x, hub.y - leg.hip.y) + R;
      if (furthest > leg.thighLen + leg.shinLen && window.console) {
        console.warn("player-rig: " + name + "'s " + how.shin.replace("shin", "leg") +
          " cannot reach the pedal — it needs to span " + furthest.toFixed(1) +
          " and the thigh and shin come to " + (leg.thighLen + leg.shinLen).toFixed(1) +
          ". Lengthen the leg in the drawing, or lower the saddle.");
      }
      return leg;
    }

    function kneeFor(leg, foot) {
      var dx = foot.x - leg.hip.x, dy = foot.y - leg.hip.y;
      var d = Math.min(Math.hypot(dx, dy) || 0.001, leg.thighLen + leg.shinLen - 0.01);
      var along = (d * d + leg.thighLen * leg.thighLen - leg.shinLen * leg.shinLen) / (2 * d);
      var off = Math.sqrt(Math.max(0, leg.thighLen * leg.thighLen - along * along)) * leg.bend;
      var ux = dx / d, uy = dy / d;
      return { x: leg.hip.x + ux * along - uy * off,
               y: leg.hip.y + uy * along + ux * off };
    }

    function turn(part, deg) {
      part.node.setAttribute("transform", "rotate(" + deg.toFixed(2) + " " +
        part.pivot.x.toFixed(2) + " " + part.pivot.y.toFixed(2) + ")");
    }

    /* HOW FAR A FOOT IS OFF THE PEDAL, 0 to 1. Set from outside: the figure
       does not know whether it has stopped, the thing driving it does. */
    var down = 0;
    function footDown(amount) {
      down = Math.max(0, Math.min(1, amount || 0));
      return down;
    }

    function moveTo(px) {
      var units = px / scale;             // the distance, in the drawing's units
      var metres = px / perMetre;         // the same distance, in the figure's

      moving.forEach(function (part) {
        var how = part.how;

        if (how.spin) {
          /* the wheel turns because the ground went past: angle = distance
             over radius, both in the same units, which they now are */
          turn(part, (units / part.radius) * DEG);

        } else if (how.crank) {
          var leg = part.leg || (part.leg = setUpTheLeg(part));
          if (!leg) return;
          /* the pedals are geared off the driving wheel, not off the ground,
             so changing the gear changes the cadence and nothing else */
          var wheelTurn = units / ((leg.wheel && leg.wheel.radius) || part.radius);
          var a = wheelTurn / leg.gear + leg.phase;
          var foot = { x: leg.hub.x + Math.cos(a) * leg.R,
                       y: leg.hub.y + Math.sin(a) * leg.R };
          if (leg.canPutDown && down > 0.001) {
            foot = { x: foot.x + (leg.down.x - foot.x) * down,
                     y: foot.y + (leg.down.y - foot.y) * down };
          }
          var knee = kneeFor(leg, foot);

          var thighBy = Math.atan2(knee.y - leg.hip.y, knee.x - leg.hip.x) - leg.thighHome;
          turn(part, thighBy * DEG);
          /* the shin is drawn INSIDE the thigh, so it has already been turned
             by the thigh; it only supplies the difference */
          var shinBy = Math.atan2(foot.y - knee.y, foot.x - knee.x) - leg.shinHome;
          turn(leg.shin, (shinBy - thighBy) * DEG);

        } else if (how.swing) {
          turn(part, Math.sin(metres / how.swing.per * Math.PI * 2) * how.swing.by);

        } else if (how.bob) {
          var up = Math.sin(metres / how.bob.per * Math.PI * 2) * how.bob.by / scale;
          part.node.setAttribute("transform", "translate(0 " + up.toFixed(2) + ")");
        }
      });

      /* THE DRAWN POSES. One frame every `every` metres, so the feet step
         faster when the reader scrolls faster and the dog never knows. */
      Object.keys(frames).forEach(function (set) {
        var list = frames[set];
        if (!list.length) return;
        var k = Math.floor(Math.abs(metres) / rig.frames[set].every) % list.length;
        for (var i = 0; i < list.length; i++) list[i].style.display = i === k ? "" : "none";
      });
    }

    moveTo(0);        // so a figure that is never moved is still a sensible pose

    return {
      el: holder,
      name: name,
      scale: scale,          // px per drawing unit
      perMetre: perMetre,    // px per one of the figure's own metres
      anchor: anchor,        // the point that rides the route, in drawing units
      height: height,
      width: whole.width * scale,
      box: whole,            // the drawing's own bounds, in drawing units
      moveTo: moveTo,
      footDown: footDown
    };
  }

  window.HappyTrailsRig = { settings: SETTINGS, player: player };
})();
