/* ═══════════════════════════════════════════════════════════════════════════
   HAPPY TRAILS — A SMALL SURPRISE ON THE COMPASS
   version 1.0

   ON THE MAIN MAP ONLY. Press the compass's N five times inside two seconds and a message dances
   across the screen in big 3D letters while confetti falls. Five seconds
   later it all lifts away and the page is exactly as it was.

   IT IS MEANT TO BE FOUND, NOT ANNOUNCED. Nothing on the page hints at it, and
   the message is stored as character codes rather than as text, so reading
   this file or searching the site's source does not give it away. The words
   it says are the owner's to change: edit CODES (each number is one letter).

   Trail pages do not load this file: their compass switches the cyclist on
   and off, and five presses there should do just that.

   THE LOOK IS IN THE STYLESHEET (the .sp- rules): the 3D letters, their
   dance and their colours. This file only builds the letters, paints the
   confetti and takes everything away again.
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  "use strict";

  /* ── THE NUMBERS ─────────────────────────────────────────────────────── */
  var SETTINGS = {
    presses:      5,       // how many presses make it happen
    withinMs:     2000,    // …inside this long; older presses stop counting
    showMs:       5000,    // how long the message and confetti stay
    fadeMs:       600,     // the lift-away at the end; the stylesheet's --sp-fade must match
    letterLagMs:  70,      // each letter starts its dance this much after the one before
    confetti:     240,     // pieces in the whole show
    emitMs:       3200,    // after this no new pieces start, so the sky can empty by showMs
    gravity:      0.00045, // px per ms squared: pulls a piece down
    drag:         0.0009,  // per ms: air slows a piece's sideways travel
    burstSpeed:   1.1,     // px per ms for a piece fired from a bottom corner
    spreadDeg:    38,      // how wide each corner's fan is
    pieceMin:     6,       // smallest confetti piece, px
    pieceMax:     13,      // largest
    colours: ["#ce1126", "#007a3d", "#ffffff", "#111111", "#f5b82e", "#e8537a"],
    reducedMs:    3000     // for visitors who ask for less motion: message only, held this long
  };

  /* the message, one character code per letter; a space is a gap between words */
  var CODES = [70, 82, 69, 69, 32, 80, 65, 76, 69, 83, 84, 73, 78, 69, 33];

  var compass = document.getElementById("ht-compass");
  if (!compass) return;

  var stamps = [];       // when the recent presses happened
  var showing = false;

  compass.addEventListener("click", function () {
    var now = Date.now();
    stamps = stamps.filter(function (t) { return now - t < SETTINGS.withinMs; });
    stamps.push(now);
    if (stamps.length < SETTINGS.presses || showing) return;
    stamps = [];
    show();
  });

  /* ── THE LETTERS ─────────────────────────────────────────────────────── */
  function build() {
    var stage = document.createElement("div");
    stage.className = "sp-stage";
    stage.setAttribute("aria-hidden", "true");
    var words = String.fromCharCode.apply(null, CODES).split(" ");
    var n = 0;
    words.forEach(function (word) {
      var line = document.createElement("div");
      line.className = "sp-word";
      word.split("").forEach(function (ch) {
        var span = document.createElement("span");
        span.className = "sp-letter";
        span.textContent = ch;
        span.style.setProperty("--sp-hue", SETTINGS.colours[n % 4]);
        span.style.animationDelay = (n * SETTINGS.letterLagMs) + "ms";
        line.appendChild(span);
        n++;
      });
      stage.appendChild(line);
    });
    return stage;
  }

  /* ── THE CONFETTI ────────────────────────────────────────────────────── */
  function confettiOn(canvas, endAt) {
    var ctx = canvas.getContext("2d");
    var scale = window.devicePixelRatio || 1;
    var w = 0, h = 0;
    function size() {
      w = window.innerWidth; h = window.innerHeight;
      canvas.width = w * scale; canvas.height = h * scale;
      ctx.setTransform(scale, 0, 0, scale, 0, 0);
    }
    size();
    window.addEventListener("resize", size);

    var pieces = [], born = 0, start = performance.now(), last = start, raf = 0;

    /* half from the left corner, half from the right, fanned up and inward */
    function launch(i) {
      var fromLeft = i % 2 === 0;
      var aim = (fromLeft ? -60 : -120) +
                (Math.random() - 0.5) * 2 * SETTINGS.spreadDeg;       // degrees; up is -90
      var speed = SETTINGS.burstSpeed * (0.55 + Math.random() * 0.6);
      var rad = aim * Math.PI / 180;
      pieces.push({
        x: fromLeft ? 0 : w, y: h,
        vx: Math.cos(rad) * speed, vy: Math.sin(rad) * speed,
        size: SETTINGS.pieceMin + Math.random() * (SETTINGS.pieceMax - SETTINGS.pieceMin),
        colour: SETTINGS.colours[Math.floor(Math.random() * SETTINGS.colours.length)],
        spin: Math.random() * 6.28, spinBy: (Math.random() - 0.5) * 0.02,
        flip: Math.random() * 6.28, flipBy: 0.004 + Math.random() * 0.008
      });
    }

    function frame(now) {
      var dt = Math.min(48, now - last); last = now;
      var due = Math.min(SETTINGS.confetti,
                         Math.floor(SETTINGS.confetti * (now - start) / SETTINGS.emitMs));
      while (born < due) launch(born++);

      ctx.clearRect(0, 0, w, h);
      pieces.forEach(function (p) {
        p.vy += SETTINGS.gravity * dt;
        p.vx -= p.vx * SETTINGS.drag * dt;
        p.x += p.vx * dt; p.y += p.vy * dt;
        p.spin += p.spinBy * dt; p.flip += p.flipBy * dt;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.spin);
        ctx.scale(1, Math.cos(p.flip));            // tumbling: a flat piece turning edge-on
        ctx.fillStyle = p.colour;
        ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
        ctx.restore();
      });
      if (now < endAt) raf = requestAnimationFrame(frame);
    }
    raf = requestAnimationFrame(frame);

    return function stop() {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", size);
    };
  }

  /* ── THE SHOW ────────────────────────────────────────────────────────── */
  function show() {
    showing = true;
    var still = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
    var stage = build();
    var stopConfetti = function () {};
    if (still) {
      stage.classList.add("is-still");
    } else {
      var canvas = document.createElement("canvas");
      canvas.className = "sp-confetti";
      stage.appendChild(canvas);
      stopConfetti = confettiOn(canvas, performance.now() + SETTINGS.showMs);
    }
    document.body.appendChild(stage);
    requestAnimationFrame(function () { stage.classList.add("is-on"); });

    var holdMs = still ? SETTINGS.reducedMs : SETTINGS.showMs;
    setTimeout(function () { stage.classList.remove("is-on"); }, holdMs);
    setTimeout(function () {
      stopConfetti();
      if (stage.parentNode) stage.parentNode.removeChild(stage);
      showing = false;
    }, holdMs + SETTINGS.fadeMs);
  }
})();
