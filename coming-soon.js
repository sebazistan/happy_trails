/* ═══════════════════════════════════════════════════════════════════════════
   HAPPY TRAILS — THE DRAWING THAT DRAWS ITSELF
   version 2.1

   WHAT THIS IS. The picture on coming-soon.html: a trail network that builds
   itself and takes itself apart again, in the main map's own colours and its
   own geometry. Trails run horizontally and vertically, with the occasional
   forty-five degree leg, the way a subway map does. They branch now and then
   and a white dot marks the junction. They cross expressways and railways —
   a bright green dot where a trail goes OVER one, nothing where it goes under,
   and the road is drawn back across the trail so you can see it pass beneath.
   Red blocks are golf courses, and a trail will not cross one. Every so often
   a red dot appears at a pinch point, or a purple line — something proposed
   rather than built — draws itself in and straight back out again.

   NO TRAIL EVER CROSSES ANOTHER TRAIL, or itself. That one rule is what makes
   the picture read as a network rather than as a scribble, and it is the rule
   a game of snake plays by: every step a trail takes claims the ground it is
   on, and nothing else may step there until the far end has been rubbed out
   and given it back.

   WHY A CANVAS AND NOT SVG. Every line here is redrawn on every frame, because
   a line that is being erased from its far end cannot simply be added to. Two
   dozen polylines redrawn sixty times a second is nothing to a canvas and is a
   great deal of work for two dozen DOM elements with changing dash offsets.

   HOW A LINE DRAWS AND UNDRAWS ITSELF. Each one keeps its points, the distance
   along it at each point, and two numbers: `head`, how far the drawing has got,
   and `tail`, how far the erasing has got. Only the stretch between the two is
   drawn. Growing moves the head; when the drawn stretch is as long as it is
   allowed to be, the tail starts moving too and the line appears to travel.
   When the tail catches the head the line is gone and another one starts.

   WHAT KEEPS IT CHEAP
     · a hard cap on how many lines exist at once, and on how many steps any
       one of them may take, so no array grows without limit
     · one requestAnimationFrame loop, with the time step clamped, so a tab
       that has been in the background does not come back and lurch
     · nothing runs while the page is hidden or the picture is scrolled out of
       view — an animation nobody is looking at is pure waste
     · somebody who has asked for less movement gets one finished drawing and
       no loop at all

   TO USE IT:  HappyTrailsComingSoon(document.getElementById("cs-canvas"));
   ═══════════════════════════════════════════════════════════════════════════ */

window.HappyTrailsComingSoon = function (canvas) {
  "use strict";

  /* ── EVERY NUMBER IN THE PICTURE ─────────────────────────────────────────
     All of it is here. Nothing below invents a size, a speed or a colour. */
  const SETTINGS = {

    /* THE GRID. Everything snaps to it, which is what makes the lines read as
       a diagram rather than as scribble. A step is one cell across, or one
       cell diagonally. */
    cell:            30,      // one grid step, in pixels
    cellPhone:       22,      // …on a narrow screen, so the same picture fits
    corner:          9,       // HOW ROUNDED A BEND IS. The map's trails turn
                              // on a radius rather than a point; this is how
                              // far back from the corner the curve starts.
                              // Never more than half a cell.

    /* HOW MANY THINGS AT ONCE. The first is the hard ceiling — branches are
       refused once it is reached — and the rest are what the picture aims for. */
    maxLines:        20,
    wantTrails:      7,
    wantLanes:       3,
    wantHighways:    2,
    wantRails:       2,
    startEvery:      0.45,    // seconds between one new line and the next
    startTries:      4,       // places considered for each, emptiest wins

    /* WHICH WAY A LINE GOES. Mostly horizontal and vertical: a turn off an
       orthogonal leg stays orthogonal nine times in ten, and only now and then
       cuts the corner at forty-five. `leg` is how many steps before it may
       turn at all, which is what gives the long straight runs. */
    straightness:    0.88,    // chance a turn keeps to the square grid
    turnBoth:        0.5,     // chance a turn goes left rather than right
    edgeMargin:      1.2,     // cells of the canvas a line will not go past

    /* THE GOLF COURSES. Red SQUARES — the same number of cells each way — that
       appear, sit, and go. A trail will not cross one. */
    wantGolf:        3,
    golfEvery:       3.2,     // seconds between one appearing and the next
    golfCells:       [2, 4],  // how many cells across, and the same down
    golfLife:        [10, 18],// seconds it stays before it starts to go
    golfFade:        0.9,     // seconds to fade in, and again to fade out
    golfClear:       0.55,    // cells of clearance a trail keeps around one

    /* THE DOTS. All three pop in rather than appearing: a quick grow with a
       little overshoot, which is what makes one arriving catch the eye on a
       picture where everything else is already moving. */
    dotPop:          0.34,    // seconds for a dot to reach full size
    dotOvershoot:    1.3,     // and how far past it goes on the way
    crossOver:       0.5,     // chance a trail crosses OVER a road or railway
                              // rather than under it. Over gets the bright
                              // green dot; under gets the road drawn back
                              // across the trail.
    redEvery:        [4, 9],  // seconds between one red dot and the next
    redAtOnce:       3,       // and never more than this many on the picture
    redLife:         [5, 7],  // how long one stays

    /* THE WISHFUL LINE. Something proposed rather than built: it draws itself
       in, and then straight back out again at more than twice the speed. One
       at a time, and not often. */
    wishEvery:       [18, 34],// seconds between one and the next
    wishRush:        2.4,     // how much faster its tail moves than its head

    /* WHAT EACH KIND OF LINE IS. speed is pixels a second; maxLen is how long
       the drawn stretch may get before the tail sets off after the head; steps
       is the most grid steps it may ever take, which is what bounds the arrays
       and stops a line living for ever. Every one is jittered per line, so no
       two move alike. */
    kinds: {
      trail:   { speed: 58, maxLen: 640, steps: 30, leg: [4, 9], fork: 0.22,
                 width: 7.5, casing: 12.5, solid: true },
      wish:    { speed: 68, maxLen: 400, steps: 18, leg: [4, 8], fork: 0,
                 width: 6.5, casing: 11,   solid: true },
      lane:    { speed: 74, maxLen: 340, steps: 22, leg: [3, 7], fork: 0,
                 width: 3.2, casing: 0,    solid: false },
      highway: { speed: 44, maxLen: 900, steps: 34, leg: [5, 10], fork: 0,
                 width: 6.0, casing: 0,    solid: false },
      rail:    { speed: 38, maxLen: 820, steps: 34, leg: [6, 12], fork: 0,
                 width: 4.0, casing: 0,    solid: false },
    },

    /* THE COLOURS, taken from the artwork itself rather than matched by eye:
       these are the values in happy-trails-map.svg. Change one here and the
       picture stops agreeing with the map, which is the whole point of it. */
    ink: {
      backdrop:    "#1e1e1e",   // the page's own ground, so there is no panel
      trail:       "#4fcf4f",   // a built trail
      trailCasing: "#181a18",   // the dark edge that lifts it off the ground
      wish:        "#e84fff",   // a route that is only proposed
      wishCasing:  "#1d1420",
      junction:    "#ffffff",   // where one trail branches from another
      bridge:      "#00ff00",   // where a trail crosses OVER something
      pinch:       "#ff3600",   // a red dot: where a trail has a problem
      lane:        "#4fcf4f",   // a bike lane: the same green, drawn thin
      highway:     "#878787",
      highwayLine: "#b2a66b",   // its dashed centre
      rail:        "#a8a8a8",
      railTie:     "#878787",   // the sleepers, as a dash over the top
      golf:        "#c25d5d",
    },

    dotJunction:   5.2,         // the white dot at a branch
    dotBridge:     4.2,         // the bright green one at a crossing
    dotPinch:      4.6,         // and the red one
    dashHighway:   [14, 12],    // the centre line of an expressway
    dashRail:      [3, 9],      // and the sleepers on a railway
    dashLane:      [9, 7],      // a bike lane is the same green as a trail and
                                // half its width; on the map the width alone
                                // tells them apart, and at this size it does
                                // not, so a lane is drawn broken
    underStub:     2.6,         // how far either side of a trail a road is
                                // drawn back over it, in trail widths, where
                                // the trail passes underneath

    maxStep:       0.05,        // seconds: the longest time step allowed, so a
                                // tab coming back from the background resumes
                                // rather than jumping
    settleFrames:  900,         // how far ahead the picture is wound before the
                                // first frame, so it opens as a network rather
                                // than as an empty rectangle

    /* THE PICTURE IS THE SAME PICTURE ON EVERY SCREEN, not the same number of
       lines. Everything counted is scaled by how much room there actually is,
       against this — the size the numbers above were tuned at. */
    roomAt:        [1400, 560],
    roomLeast:     0.70,
  };

  if (!canvas || !canvas.getContext) return null;
  const ctx = canvas.getContext("2d", { alpha: false });
  if (!ctx) return null;

  const K = SETTINGS.kinds;
  const INK = SETTINGS.ink;

  /* the eight directions, as steps on the grid: east, south-east, south and so
     on round the compass. An EVEN index is a square direction, an odd one a
     diagonal, which is how straightness below keeps to the grid. */
  const DIRS = [[1, 0], [1, 1], [0, 1], [-1, 1],
                [-1, 0], [-1, -1], [0, -1], [1, -1]];
  const turn = (d, by) => (d + by + 8) % 8;
  const pick = list => list[(Math.random() * list.length) | 0];
  const between = (a, b) => a + Math.random() * (b - a);
  const jitter = (v, much) => v * (1 - much + Math.random() * much * 2);
  const now = () => clock;

  let lines = [], golf = [], reds = [];
  let taken = new Map();                 // the ground the trails have claimed
  let W = 0, H = 0, cell = SETTINGS.cell, room = 1, reach = 1;
  let sinceLine = 0, sinceGolf = 0, tillRed = 0, tillWish = 0, clock = 0;
  let running = false, frame = 0, lastAt = 0, visible = true, onScreen = true;

  const stillWanted = window.matchMedia &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const wantedOf = n => Math.max(1, Math.round(n * room));

  /* ── THE SHAPE OF THE CANVAS ─────────────────────────────────────────────
     Sized in device pixels so the lines are crisp on a retina screen, capped
     at two because a three-times canvas costs nine times the fill and looks no
     better. Everything below works in CSS pixels. */
  function measure() {
    const box = canvas.getBoundingClientRect();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    W = Math.max(320, Math.round(box.width));
    H = Math.max(180, Math.round(box.height));
    canvas.width  = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    cell = W < 620 ? SETTINGS.cellPhone : SETTINGS.cell;
    const was = SETTINGS.roomAt;
    /* the SQUARE ROOT of the area, not the area: a panel a third of the size
       wants about half the lines, not a third of them */
    room  = Math.max(SETTINGS.roomLeast,
                     Math.min(1.1, Math.sqrt((W * H) / (was[0] * was[1]))));
    reach = Math.max(SETTINGS.roomLeast,
                     Math.min(1.1, Math.hypot(W, H) / Math.hypot(was[0], was[1])));
  }

  /* ── THE GROUND A TRAIL HAS CLAIMED ──────────────────────────────────────
     Two keys per step: the point it has reached, and the middle of the step
     that got there. The middle is what stops two diagonals crossing at a place
     neither of them has a point. Only trails and wishful lines claim ground —
     an expressway and a railway are things a trail crosses, not things it has
     to get around. */
  const HALF = () => cell / 2;
  const key = (x, y) => Math.round(x / HALF()) + "," + Math.round(y / HALF());

  const claimed = (x, y) => taken.has(key(x, y));

  function claim(line, at, keys) {
    for (let i = 0; i < keys.length; i++) {
      taken.set(keys[i], (taken.get(keys[i]) || 0) + 1);
    }
    line.claims.push({ at: at, keys: keys });
  }

  function release(keys) {
    for (let i = 0; i < keys.length; i++) {
      const n = (taken.get(keys[i]) || 0) - 1;
      if (n > 0) taken.set(keys[i], n); else taken.delete(keys[i]);
    }
  }

  function dropClaims(line, upTo) {
    while (line.claims.length && line.claims[0].at < upTo) {
      release(line.claims.shift().keys);
    }
  }

  const inside = (x, y) => {
    const m = cell * SETTINGS.edgeMargin;
    return x >= m && y >= m && x <= W - m && y <= H - m;
  };

  /* Is this step open to this kind of line? Off the canvas, into a golf course
     that is solid enough to see, or — for a trail — onto ground another trail
     is already standing on. */
  function open(kind, x, y, fromX, fromY) {
    if (!inside(x, y)) return false;
    const mx = (x + fromX) / 2, my = (y + fromY) / 2;
    for (let i = 0; i < golf.length; i++) {
      const g = golf[i];
      if (g.alpha < 0.3) continue;
      const pad = cell * SETTINGS.golfClear;
      if (x > g.x - pad && x < g.x + g.side + pad &&
          y > g.y - pad && y < g.y + g.side + pad) return false;
      if (mx > g.x - pad && mx < g.x + g.side + pad &&
          my > g.y - pad && my < g.y + g.side + pad) return false;
    }
    if (K[kind].solid && (claimed(x, y) || claimed(mx, my))) return false;
    return true;
  }

  /* ── A LINE ──────────────────────────────────────────────────────────────
     `grid` is the bare vertices, on the grid; `pts` is what is actually drawn,
     which is the same thing with its corners rounded off. run[] is the
     distance along `pts` at each of them, and head and tail are distances into
     that. */
  function newLine(kind, x, y, dir) {
    const k = K[kind];
    const line = {
      kind: kind, grid: [{ x: x, y: y }], pts: [], run: [],
      head: 0, tail: 0, dir: dir, steps: 0,
      legLeft: Math.round(between(k.leg[0], k.leg[1])),
      speed: jitter(k.speed, 0.2) * (0.8 + reach * 0.2),
      maxLen: jitter(k.maxLen, 0.25) * reach,
      maxSteps: Math.round(k.steps * (0.7 + reach * 0.3)),
      tailRush: kind === "wish" ? SETTINGS.wishRush : 1,
      growing: true, forks: 0, dots: [], cross: [], claims: [],
    };
    if (k.solid) claim(line, 0, [key(x, y)]);
    rebuild(line);
    return line;
  }

  /* ── THE CORNERS GET ROUNDED ─────────────────────────────────────────────
     The map's trails turn on a radius, not on a point, and a right angle drawn
     sharp looks like a diagram of a circuit rather than a route. Each interior
     vertex is replaced by two points a little way back along each leg, and the
     short step between them — with a round line join over the top — reads as a
     curve. It is done here, on the drawn polyline, rather than in the geometry,
     so everything that reasons about where a line has BEEN still sees plain
     grid steps. */
  function rebuild(line) {
    const g = line.grid, pts = [], r = Math.min(SETTINGS.corner, cell * 0.45);
    for (let i = 0; i < g.length; i++) {
      if (i === 0 || i === g.length - 1) { pts.push(g[i]); continue; }
      const a = g[i - 1], b = g[i], c = g[i + 1];
      const inLen  = Math.hypot(b.x - a.x, b.y - a.y);
      const outLen = Math.hypot(c.x - b.x, c.y - b.y);
      const sameWay = (b.x - a.x) * outLen === (c.x - b.x) * inLen &&
                      (b.y - a.y) * outLen === (c.y - b.y) * inLen;
      if (sameWay || !inLen || !outLen) { pts.push(b); continue; }
      const ri = Math.min(r, inLen * 0.45), ro = Math.min(r, outLen * 0.45);
      pts.push({ x: b.x - (b.x - a.x) / inLen * ri,
                 y: b.y - (b.y - a.y) / inLen * ri });
      pts.push({ x: b.x + (c.x - b.x) / outLen * ro,
                 y: b.y + (c.y - b.y) / outLen * ro });
    }
    const run = [0];
    for (let i = 1; i < pts.length; i++) {
      run.push(run[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x,
                                       pts[i].y - pts[i - 1].y));
    }
    line.pts = pts; line.run = run;
  }

  const ends = line => line.run.length ? line.run[line.run.length - 1] : 0;

  /* ── WHICH WAY NEXT ──────────────────────────────────────────────────────
     Mostly square. Off a horizontal or vertical leg a turn stays square nine
     times in ten and otherwise cuts across at forty-five; off a diagonal it
     comes back to square. Either way it is a turn of one or two eighths, so
     nothing ever doubles back on itself. */
  function nextWay(dir) {
    const square = dir % 2 === 0;
    const both = Math.random() < SETTINGS.turnBoth ? 1 : -1;
    if (square) return turn(dir, (Math.random() < SETTINGS.straightness ? 2 : 1) * both);
    return turn(dir, (Math.random() < SETTINGS.straightness ? 1 : 2) * both);
  }

  function extend(line) {
    const k = K[line.kind];
    if (line.steps >= line.maxSteps) { stopGrowing(line); return false; }

    const at = line.grid[line.grid.length - 1];
    const here = ends(line);

    if (line.legLeft <= 0) {
      line.dir = nextWay(line.dir);
      line.legLeft = Math.round(between(k.leg[0], k.leg[1]));
      /* A BRANCH, and the white dot that says so. It leaves square to the
         parent so the two are plainly two, and it is refused if there is no
         room on the ground for it to start. */
      if (k.fork && Math.random() < k.fork && line.forks < 1 &&
          lines.length < wantedOf(SETTINGS.maxLines)) {
        const away = turn(line.dir, Math.random() < 0.5 ? 2 : -2);
        const s = DIRS[away];
        if (open(line.kind, at.x + s[0] * cell, at.y + s[1] * cell, at.x, at.y)) {
          lines.push(newLine(line.kind, at.x, at.y, away));
          line.forks++;
          line.dots.push({ at: here, born: clock, ink: INK.junction,
                           r: SETTINGS.dotJunction });
        }
      }
    }

    /* straight on if it can; otherwise whichever turn leaves it furthest from
       the nearest edge, which never runs a line along the border */
    const ahead = DIRS[line.dir];
    let go = null;
    if (open(line.kind, at.x + ahead[0] * cell, at.y + ahead[1] * cell, at.x, at.y)) {
      go = line.dir;
    } else {
      let bestRoom = -1;
      const away = [2, -2, 1, -1, 3, -3];
      for (let t = 0; t < away.length; t++) {
        const d = turn(line.dir, away[t]);
        const s = DIRS[d];
        const nx = at.x + s[0] * cell, ny = at.y + s[1] * cell;
        if (!open(line.kind, nx, ny, at.x, at.y)) continue;
        const spare = Math.min(nx, ny, W - nx, H - ny);
        if (spare > bestRoom) { bestRoom = spare; go = d; }
      }
      if (go === null) { stopGrowing(line); return false; }
      line.legLeft = Math.round(between(k.leg[0], k.leg[1]));
    }

    const s = DIRS[go];
    const nx = at.x + s[0] * cell, ny = at.y + s[1] * cell;
    line.dir = go;
    line.grid.push({ x: nx, y: ny });
    line.steps++;
    line.legLeft--;
    rebuild(line);
    if (k.solid) {
      claim(line, ends(line), [key(nx, ny), key((nx + at.x) / 2, (ny + at.y) / 2)]);
      lookForCrossings(line, at, { x: nx, y: ny }, here);
    }
    return true;
  }

  function stopGrowing(line) {
    line.growing = false;
  }

  /* ── WHERE A TRAIL MEETS A ROAD OR A RAILWAY ─────────────────────────────
     Tested once, as the step is laid down, rather than every frame. Each
     crossing is decided there and then: over, and it gets the bright green dot
     the map puts on a bridge; under, and the road is drawn back across the
     trail afterwards so you can see it pass beneath. */
  function lookForCrossings(line, a, b, atA) {
    const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    for (let i = 0; i < lines.length; i++) {
      const other = lines[i];
      if (other === line || other.kind === "trail" || other.kind === "wish") continue;
      const pts = other.pts, run = other.run;
      for (let q = 1; q < pts.length; q++) {
        if (run[q] < other.tail || run[q - 1] > other.head) continue;
        const hit = meet(a, b, pts[q - 1], pts[q]);
        if (!hit) continue;
        const ux = (pts[q].x - pts[q - 1].x), uy = (pts[q].y - pts[q - 1].y);
        const m = Math.hypot(ux, uy) || 1;
        line.cross.push({
          at: atA + Math.hypot(hit.x - a.x, hit.y - a.y) / len *
              Math.hypot(b.x - a.x, b.y - a.y),
          x: hit.x, y: hit.y, born: clock,
          over: Math.random() < SETTINGS.crossOver,
          ux: ux / m, uy: uy / m,
          ink: other.kind === "rail" ? INK.rail : INK.highway,
          w: K[other.kind].width,
        });
      }
    }
  }

  /* where two segments cross, or null. Plain line-segment intersection. */
  function meet(p1, p2, p3, p4) {
    const d = (p2.x - p1.x) * (p4.y - p3.y) - (p2.y - p1.y) * (p4.x - p3.x);
    if (!d) return null;
    const t = ((p3.x - p1.x) * (p4.y - p3.y) - (p3.y - p1.y) * (p4.x - p3.x)) / d;
    const u = ((p3.x - p1.x) * (p2.y - p1.y) - (p3.y - p1.y) * (p2.x - p1.x)) / d;
    if (t < 0 || t > 1 || u < 0 || u > 1) return null;
    return { x: p1.x + (p2.x - p1.x) * t, y: p1.y + (p2.y - p1.y) * t };
  }

  /* ── STARTING THINGS ─────────────────────────────────────────────────────  */
  function startOne() {
    const count = kind => {
      let n = 0;
      for (let i = 0; i < lines.length; i++) if (lines[i].kind === kind) n++;
      return n;
    };
    const want = [];
    if (count("trail")   < wantedOf(SETTINGS.wantTrails))   want.push("trail");
    if (count("lane")    < wantedOf(SETTINGS.wantLanes))    want.push("lane");
    if (count("highway") < wantedOf(SETTINGS.wantHighways)) want.push("highway");
    if (count("rail")    < wantedOf(SETTINGS.wantRails))    want.push("rail");
    if (!want.length || lines.length >= wantedOf(SETTINGS.maxLines)) return;
    place(pick(want));
  }

  /* WHERE THERE IS ROOM, not merely anywhere. A few candidates are tried and
     the one furthest from anything already drawn wins, which spreads the
     picture out without any of it being arranged by hand. */
  function place(kind) {
    const m = cell * SETTINGS.edgeMargin;
    let best = null, bestRoom = -1;
    for (let go = 0; go < SETTINGS.startTries; go++) {
      const x = Math.round(between(m, W - m) / cell) * cell;
      const y = Math.round(between(m, H - m) / cell) * cell;
      if (!open(kind, x, y, x, y)) continue;
      let near = Infinity;
      for (let i = 0; i < lines.length; i++) {
        const g = lines[i].grid;
        for (let q = 0; q < g.length; q += 2) {
          const d = (g[q].x - x) * (g[q].x - x) + (g[q].y - y) * (g[q].y - y);
          if (d < near) near = d;
        }
      }
      if (near > bestRoom) { bestRoom = near; best = { x: x, y: y }; }
    }
    if (!best) return null;
    /* a square direction to begin with, because most of the picture is square */
    const line = newLine(kind, best.x, best.y, ((Math.random() * 4) | 0) * 2);
    lines.push(line);
    return line;
  }

  function addGolf() {
    if (golf.length >= wantedOf(SETTINGS.wantGolf)) return;
    const m = cell * SETTINGS.edgeMargin;
    const side = Math.round(between(SETTINGS.golfCells[0],
                                    SETTINGS.golfCells[1])) * cell;
    for (let go = 0; go < 14; go++) {
      const x = Math.round(between(m, W - m - side) / cell) * cell;
      const y = Math.round(between(m, H - m - side) / cell) * cell;
      let clear = true;
      for (let i = 0; i < golf.length; i++) {
        const g = golf[i];
        if (x < g.x + g.side + cell && g.x < x + side + cell &&
            y < g.y + g.side + cell && g.y < y + side + cell) { clear = false; break; }
      }
      /* and never over a trail that is already there. A trail goes round a golf
         course, but only one that meets it after it has appeared; a course laid
         over a line already drawn would sit with a trail running through it,
         which is the one thing a golf course on this map never does. */
      if (clear) clear = nothingIn(x - cell * 0.7, y - cell * 0.7,
                                   side + cell * 1.4, side + cell * 1.4);
      if (!clear) continue;
      golf.push({ x: x, y: y, side: side, alpha: 0, age: 0,
                  life: between(SETTINGS.golfLife[0], SETTINGS.golfLife[1]) });
      return;
    }
  }

  /* IS THIS RECTANGLE EMPTY? Of everything, not only of trails: a golf course
     laid over a bike lane or a railway that was already there would sit with a
     line running out of both sides of it. */
  function nothingIn(x, y, w, h) {
    const hit = (px, py) => px > x && px < x + w && py > y && py < y + h;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const pts = line.pts, run = line.run;
      for (let q = 0; q < pts.length; q++) {
        if (run[q] < line.tail || run[q] > line.head) continue;
        if (hit(pts[q].x, pts[q].y)) return false;
        if (q && hit((pts[q].x + pts[q - 1].x) / 2,
                     (pts[q].y + pts[q - 1].y) / 2)) return false;
      }
    }
    return true;
  }

  /* A RED DOT, somewhere along a trail that is on the picture: the map's mark
     for a place where a trail has a problem. Never more than a few, and each
     one goes again after a handful of seconds. */
  function addRed() {
    if (reds.length >= SETTINGS.redAtOnce) return;
    const able = lines.filter(l => l.kind === "trail" && l.head - l.tail > cell * 3);
    if (!able.length) return;
    const line = pick(able);
    reds.push({ line: line, at: between(line.tail + cell, line.head - cell),
                born: clock, life: between(SETTINGS.redLife[0], SETTINGS.redLife[1]) });
  }

  function addWish() {
    for (let i = 0; i < lines.length; i++) if (lines[i].kind === "wish") return;
    place("wish");
  }

  /* ── MOVING EVERYTHING ON ────────────────────────────────────────────────  */
  function advance(dt) {
    clock += dt;

    sinceLine += dt;
    if (sinceLine > SETTINGS.startEvery) { sinceLine = 0; startOne(); }
    sinceGolf += dt;
    if (sinceGolf > SETTINGS.golfEvery) { sinceGolf = 0; addGolf(); }
    tillRed -= dt;
    if (tillRed <= 0) {
      tillRed = between(SETTINGS.redEvery[0], SETTINGS.redEvery[1]);
      addRed();
    }
    tillWish -= dt;
    if (tillWish <= 0) {
      tillWish = between(SETTINGS.wishEvery[0], SETTINGS.wishEvery[1]);
      addWish();
    }

    for (let i = golf.length - 1; i >= 0; i--) {
      const g = golf[i];
      g.age += dt;
      const going = g.age > g.life;
      g.alpha += (going ? -dt : dt) / SETTINGS.golfFade;
      if (g.alpha > 1) g.alpha = 1;
      if (g.alpha <= 0 && going) golf.splice(i, 1);
    }

    for (let i = lines.length - 1; i >= 0; i--) {
      const line = lines[i];
      if (line.growing) {
        line.head += line.speed * dt;
        let guard = 0;
        while (line.head > ends(line) && line.growing && guard++ < 20) extend(line);
        if (line.head > ends(line)) line.head = ends(line);
      }
      if (!line.growing || ends(line) - line.tail > line.maxLen) {
        line.tail += line.speed * dt * (line.growing ? 1 : line.tailRush);
      }
      dropClaims(line, line.tail);
      while (line.dots.length && line.dots[0].at < line.tail) line.dots.shift();
      while (line.cross.length && line.cross[0].at < line.tail) line.cross.shift();
      if (!line.growing && line.tail >= line.head) {
        dropClaims(line, Infinity);
        lines.splice(i, 1);
      }
    }

    for (let i = reds.length - 1; i >= 0; i--) {
      const r = reds[i];
      if (clock - r.born > r.life || lines.indexOf(r.line) < 0 ||
          r.at < r.line.tail || r.at > r.line.head) reds.splice(i, 1);
    }
  }

  /* ── DRAWING THE STRETCH BETWEEN TWO DISTANCES ───────────────────────────
     The whole trick of the thing. Walks the points, cuts the first and last
     segments at the exact distances asked for, and leaves a path ready to
     stroke. Nothing is drawn outside `from`…`to`, which is what makes a line
     appear to be drawn and then rubbed out. */
  function trace(line, from, to) {
    const pts = line.pts, run = line.run;
    let started = false;
    ctx.beginPath();
    for (let k = 1; k < pts.length; k++) {
      const a = run[k - 1], b = run[k];
      if (b <= from || a >= to) continue;
      const span = b - a || 1;
      const t0 = (Math.max(a, from) - a) / span;
      const t1 = (Math.min(b, to) - a) / span;
      const p = pts[k - 1], q = pts[k];
      if (!started) {
        ctx.moveTo(p.x + (q.x - p.x) * t0, p.y + (q.y - p.y) * t0);
        started = true;
      }
      ctx.lineTo(p.x + (q.x - p.x) * t1, p.y + (q.y - p.y) * t1);
    }
    return started;
  }

  function strokeKind(kind, colour, width, dash) {
    ctx.strokeStyle = colour;
    ctx.lineWidth = width;
    ctx.setLineDash(dash || []);
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.kind !== kind) continue;
      if (trace(line, line.tail, line.head)) ctx.stroke();
    }
    ctx.setLineDash([]);
  }

  function pointAt(line, at) {
    const run = line.run, pts = line.pts;
    for (let k = 1; k < run.length; k++) {
      if (run[k] < at) continue;
      const span = run[k] - run[k - 1] || 1;
      const t = (at - run[k - 1]) / span;
      const p = pts[k - 1], q = pts[k];
      return { x: p.x + (q.x - p.x) * t, y: p.y + (q.y - p.y) * t };
    }
    return null;
  }

  /* a dot arriving: quick to full size, a little past it, and back */
  function popped(born) {
    const t = (clock - born) / SETTINGS.dotPop;
    if (t >= 1) return 1;
    if (t <= 0) return 0;
    const e = 1 - Math.pow(1 - t, 3);
    return e * (1 + (SETTINGS.dotOvershoot - 1) * Math.sin(Math.PI * t));
  }

  function dot(x, y, r, colour) {
    if (r <= 0.2) return;
    ctx.fillStyle = colour;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  /* ── ONE FRAME ───────────────────────────────────────────────────────────
     In the map's own order, bottom to top: the ground, the things trails
     cross, the trails, then everything that sits ON a trail. */
  function paint() {
    ctx.fillStyle = INK.backdrop;
    ctx.fillRect(0, 0, W, H);

    for (let i = 0; i < golf.length; i++) {
      const g = golf[i];
      ctx.globalAlpha = Math.max(0, Math.min(1, g.alpha));
      ctx.fillStyle = INK.golf;
      ctx.fillRect(g.x, g.y, g.side, g.side);
      ctx.globalAlpha = 1;
    }

    strokeKind("rail", INK.rail, K.rail.width);
    strokeKind("rail", INK.railTie, K.rail.width, SETTINGS.dashRail);
    strokeKind("highway", INK.highway, K.highway.width);
    strokeKind("highway", INK.highwayLine, 1.6, SETTINGS.dashHighway);
    strokeKind("lane", INK.lane, K.lane.width, SETTINGS.dashLane);

    // a trail is drawn twice: its dark edge, then its colour
    strokeKind("trail", INK.trailCasing, K.trail.casing);
    strokeKind("wish",  INK.wishCasing,  K.wish.casing);
    strokeKind("trail", INK.trail, K.trail.width);
    strokeKind("wish",  INK.wish,  K.wish.width);

    /* WHERE A TRAIL PASSES UNDER, the road is put back over it — a short piece
       of it, in its own colour, across the trail. That is the whole difference
       between over and under here, and it is why the bright green dot means
       something: it is only ever on the crossings the trail is on top of. */
    ctx.lineCap = "butt";
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      for (let c = 0; c < line.cross.length; c++) {
        const x = line.cross[c];
        if (x.over || x.at < line.tail || x.at > line.head) continue;
        const half = K.trail.casing * SETTINGS.underStub / 2;
        ctx.strokeStyle = x.ink;
        ctx.lineWidth = x.w;
        ctx.beginPath();
        ctx.moveTo(x.x - x.ux * half, x.y - x.uy * half);
        ctx.lineTo(x.x + x.ux * half, x.y + x.uy * half);
        ctx.stroke();
      }
    }
    ctx.lineCap = "round";

    /* and everything that sits on top of a trail: the white dot at a branch,
       the bright green one where it crosses over something, and the red one
       where there is a problem */
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      for (let d = 0; d < line.dots.length; d++) {
        const it = line.dots[d];
        if (it.at < line.tail || it.at > line.head) continue;
        const p = pointAt(line, it.at);
        if (p) dot(p.x, p.y, it.r * popped(it.born), it.ink);
      }
      for (let c = 0; c < line.cross.length; c++) {
        const x = line.cross[c];
        if (!x.over || x.at < line.tail || x.at > line.head) continue;
        dot(x.x, x.y, SETTINGS.dotBridge * popped(x.born), INK.bridge);
      }
    }
    for (let i = 0; i < reds.length; i++) {
      const r = reds[i];
      const p = pointAt(r.line, r.at);
      if (p) dot(p.x, p.y, SETTINGS.dotPinch * popped(r.born), INK.pinch);
    }
  }

  /* ── THE LOOP ────────────────────────────────────────────────────────────  */
  function step(at) {
    if (!running) return;
    const dt = Math.min(SETTINGS.maxStep, (at - lastAt) / 1000 || 0.016);
    lastAt = at;
    advance(dt);
    paint();
    frame = requestAnimationFrame(step);
  }

  function start() {
    if (running || stillWanted) return;
    running = true;
    lastAt = performance.now();
    frame = requestAnimationFrame(step);
  }

  function stop() {
    running = false;
    if (frame) cancelAnimationFrame(frame);
    frame = 0;
  }

  const shouldRun = () => visible && onScreen;
  const settle = () => { if (shouldRun()) start(); else stop(); };

  /* wound forward before anyone sees it, so the picture opens as a network
     rather than as an empty rectangle with one line crawling across it */
  function seed() {
    lines = []; golf = []; reds = []; taken = new Map();
    sinceLine = SETTINGS.startEvery; sinceGolf = SETTINGS.golfEvery;
    tillRed = 0.5; tillWish = 3; clock = 0;
    for (let i = 0; i < SETTINGS.settleFrames; i++) advance(1 / 60);
    paint();
  }

  measure();
  seed();

  /* NOTHING RUNS THAT NOBODY IS LOOKING AT. A picture in a background tab, or
     scrolled past, is a loop burning a phone's battery to no end. */
  document.addEventListener("visibilitychange", () => {
    visible = !document.hidden; settle();
  });
  if (window.IntersectionObserver) {
    new IntersectionObserver(entries => {
      onScreen = entries[0].isIntersecting; settle();
    }, { threshold: 0.02 }).observe(canvas);
  }

  let resizing = 0;
  window.addEventListener("resize", () => {
    clearTimeout(resizing);
    resizing = setTimeout(() => { measure(); seed(); }, 180);
  });

  if (stillWanted) paint(); else settle();

  return { start: start, stop: stop, settings: SETTINGS };
};
