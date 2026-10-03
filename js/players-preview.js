/* ═══════════════════════════════════════════════════════════════════════════
   THE PLAYER BENCH — what it does
   version 1.2

   Shows everybody in players.js walking on the spot, at a speed you can drag.

   IT DRIVES THEM THE SAME WAY THE TRAIL DOES, which is what makes this page
   worth having: a distance goes up, every figure is told the distance, and
   nothing else is said to anybody. If a figure looks right here it will look
   right on the trail, because both are the same one sentence,
   player.moveTo(howFar).

   The clock in here is only a convenience for standing still and watching: it
   decides how fast the distance grows, as a reader's scroll does on a real
   page, and is not part of the animation.
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  "use strict";

  /* ── THE NUMBERS ──────────────────────────────────────────────────────── */
  var SETTINGS = {
    startSpeed: 90,      // px/s, where the slider starts
    scrubSpan: 1000,     // px of travel the scrub slider covers
    nudge: 4,            // px moved by the + and − buttons
    lapPad: 90,          // px of clear space beyond the stage before wrapping
    trailFrom: 0.80,     // where the route line sits down the stage, 0–1
    bigBy: 2.4,          // how much bigger "draw it large" is
    slowest: 0.0001      // below this the speed reads as stopped
  };

  var stages = document.getElementById("pb-stages");
  if (!stages) return;

  var lib = window.HappyTrailsPlayers;
  var rigLib = window.HappyTrailsRig;
  if (!lib || !rigLib || !Object.keys(lib.art || {}).length) {
    stages.innerHTML = '<p class="pb-missing">There is nobody in ' +
      '<code>artwork/players/</code> yet — or the build has not been run ' +
      'since they were added, so <code>players.js</code> is empty.</p>';
    return;
  }

  /* ── THE CONTROLS ─────────────────────────────────────────────────────── */
  var speedBar = document.getElementById("pb-speed");
  var speedOut = document.getElementById("pb-speedOut");
  var scrubBar = document.getElementById("pb-scrub");
  var scrubOut = document.getElementById("pb-scrubOut");
  var playBtn = document.getElementById("pb-play");
  var guidesBox = document.getElementById("pb-guides");
  var bigBox = document.getElementById("pb-big");

  var howFar = 0;          // THE ONE NUMBER. Everything on the page reads it.
  var running = true;
  var lastTick = 0;

  /* ── ONE LANE PER DRAWING ─────────────────────────────────────────────── */
  var lanes = [];

  Object.keys(lib.art).sort().forEach(function (name) {
    var rig = (lib.rigs && lib.rigs[name]) || {};

    var lane = document.createElement("section");
    lane.className = "pb-lane";

    var title = document.createElement("h2");
    title.className = "pb-name";
    title.appendChild(document.createTextNode(name));
    var facts = document.createElement("span");
    facts.className = "pb-facts";
    title.appendChild(facts);
    lane.appendChild(title);

    var stage = document.createElement("div");
    stage.className = "pb-stage is-guided";
    var trail = document.createElement("div");
    trail.className = "pb-trail";
    stage.appendChild(trail);

    var rider = document.createElement("div");
    rider.className = "pb-rider";
    var anchorMark = document.createElement("div");
    anchorMark.className = "pb-anchor";
    rider.appendChild(anchorMark);
    stage.appendChild(rider);
    lane.appendChild(stage);
    stages.appendChild(lane);

    /* THE FIGURE ITSELF, built at the size the rig asks for. "Draw it large"
       builds a second, bigger one, because a rig measures itself once and
       scaling the finished SVG would scale the line weight with it. */
    var made = build(name, rig.height);
    if (!made) return;

    facts.textContent = howItIsMade(name, rig, made);

    lanes.push({
      name: name, rig: rig, stage: stage, rider: rider, trail: trail,
      anchorMark: anchorMark, player: made, small: made, big: null
    });

    function build(who, height) {
      var p = rigLib.player(who, { height: height });
      if (!p) return null;
      rider.appendChild(p.el);
      return p;
    }
  });

  function howItIsMade(name, rig, made) {
    var art = lib.art[name];
    var count = function (what) { return (art.match(new RegExp('id="' + what, "g")) || []).length; };
    var bits = [];
    bits.push(count("part-") + " parts");
    var f = count("frame-");
    if (f) bits.push(f + " frames");
    bits.push(count("pivot-") + " pivots");
    bits.push(made.height + "px tall");
    if (rig.tall) bits.push("(" + rig.tall + " m)");
    return bits.join(" · ");
  }

  /* ── WHERE EVERYBODY STANDS, GIVEN THE DISTANCE ───────────────────────── */
  function place() {
    lanes.forEach(function (lane) {
      var p = lane.player;
      var stageW = lane.stage.clientWidth || 1;
      var stageH = lane.stage.clientHeight || 1;
      var lap = stageW + SETTINGS.lapPad;

      /* the wrap is done on the POSITION and never on the distance, so the
         legs do not jump a frame when the figure reappears on the left */
      var x = ((howFar % lap) + lap) % lap - SETTINGS.lapPad / 2;
      var y = Math.round(stageH * SETTINGS.trailFrom);

      lane.trail.style.top = y + "px";
      lane.rider.style.transform = "translate(" + x.toFixed(1) + "px," + y + "px)";
      p.moveTo(howFar);
    });
  }

  /* ── THE SVG HAS TO BE TOLD ITS OWN SIZE ────────────────────────────────
     An <svg> does not size itself to its contents, so a width of 100% inside a
     zero-sized box squashes the drawing to nothing (this once left the
     waypoint leader line at 300x150). It is given the drawing's own box, in
     the drawing's own units, then scaled, which keeps stroke weights honest.

     THE ANCHOR IS THE ORIGIN: the drawing hangs so its anchor lands on the
     route line, the same sum the trail page does, so a badly-placed anchor is
     caught here rather than on the site. */
  function fitEach() {
    lanes.forEach(function (lane) {
      [lane.small, lane.big].forEach(function (p) {
        if (!p) return;
        var vb = (p.el.getAttribute("viewBox") || "0 0 100 100").split(/[\s,]+/).map(Number);
        p.el.setAttribute("width", vb[2]);
        p.el.setAttribute("height", vb[3]);
        p.el.style.width = vb[2] + "px";
        p.el.style.height = vb[3] + "px";
        p.el.style.left = ((vb[0] - p.anchor.x) * p.scale) + "px";
        p.el.style.top = ((vb[1] - p.anchor.y) * p.scale) + "px";
        p.el.style.transform = "scale(" + p.scale + ")";
        p.el.style.transformOrigin = "0 0";
      });
    });
  }

  /* ── THE LOOP ─────────────────────────────────────────────────────────── */
  function tick(now) {
    var gap = lastTick ? Math.min(now - lastTick, 100) : 0;
    lastTick = now;
    if (running) {
      var speed = Number(speedBar.value);
      if (speed > SETTINGS.slowest) {
        howFar += speed * gap / 1000;
        showScrub();
      }
    }
    place();
    requestAnimationFrame(tick);
  }

  function showScrub() {
    var within = ((howFar % SETTINGS.scrubSpan) + SETTINGS.scrubSpan) % SETTINGS.scrubSpan;
    scrubBar.value = String(Math.round(within));
    scrubOut.textContent = Math.round(howFar) + " px";
  }

  /* ── WHAT THE CONTROLS DO ─────────────────────────────────────────────── */
  speedBar.addEventListener("input", function () {
    speedOut.textContent = speedBar.value + " px/s";
  });
  speedOut.textContent = speedBar.value + " px/s";

  scrubBar.addEventListener("input", function () {
    running = false;
    playBtn.textContent = "Play";
    howFar = Number(scrubBar.value);
    scrubOut.textContent = Math.round(howFar) + " px";
  });

  playBtn.addEventListener("click", function () {
    running = !running;
    playBtn.textContent = running ? "Pause" : "Play";
  });

  document.getElementById("pb-back").addEventListener("click", function () {
    nudgeBy(-SETTINGS.nudge);
  });
  document.getElementById("pb-fwd").addEventListener("click", function () {
    nudgeBy(SETTINGS.nudge);
  });
  function nudgeBy(by) {
    running = false;
    playBtn.textContent = "Play";
    howFar += by;
    showScrub();
  }

  guidesBox.addEventListener("change", function () {
    lanes.forEach(function (lane) {
      lane.stage.classList.toggle("is-guided", guidesBox.checked);
    });
  });

  /* "DRAW IT LARGE" BUILDS A SECOND FIGURE rather than scaling the first,
     because scaling the finished SVG scales the stroke weight too, and a fat
     line hides exactly the wobble you opened this page to find. */
  bigBox.addEventListener("change", function () {
    lanes.forEach(function (lane) {
      lane.stage.classList.toggle("is-big", bigBox.checked);
      if (bigBox.checked && !lane.big) {
        lane.big = rigLib.player(lane.name,
          { height: (lane.rig.height || 40) * SETTINGS.bigBy });
        if (lane.big) lane.rider.appendChild(lane.big.el);
      }
      var wanted = bigBox.checked && lane.big ? lane.big : lane.small;
      if (lane.big) lane.big.el.style.display = wanted === lane.big ? "" : "none";
      lane.small.el.style.display = wanted === lane.small ? "" : "none";
      lane.player = wanted;
    });
    fitEach();
  });

  window.addEventListener("resize", place);

  fitEach();
  place();
  requestAnimationFrame(tick);
})();
