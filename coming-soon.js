/* ═══════════════════════════════════════════════════════════════════════════
   HAPPY TRAILS — THE DRAWING THAT DRAWS ITSELF
   version 3.2

   WHAT THIS IS. The picture on coming-soon.html: a trail network that builds
   itself and takes itself apart again, in the main map's own colours and its
   own geometry. Trails run horizontally and vertically, with the occasional
   forty-five degree leg, the way a subway map does. They branch now and then
   and a white dot marks the junction. They cross expressways and railways —
   a bright green dot on the bridges and no mark on the level crossings.
   Rivers run under all of it, and are always crossed on a bridge.

   NOTHING EVER RUNS ON TOP OF ANYTHING ELSE. Lines cross — at ninety degrees
   wherever the grid allows it — but no two of them ever share a step, of any
   kind, so nothing is ever drawn along the top of something else. Red blocks are golf courses, and a trail will not
   cross one. Grey and red connections run from one trail to another. Every so
   often a red dot appears at a pinch point, or a purple line — something
   proposed rather than built — draws itself in and straight back out again.

   EVERY WIDTH HERE IS THE LEGEND'S OWN NUMBER. The little drawings beside the
   legend rows on the main map are all drawn against a trail sixteen units
   wide: a bike lane is eight of those units, an expressway is sixteen with a
   two-unit dashed line down it, a railway is sixteen with a two-unit rail and
   eight-unit sleepers over the top. Those sixteenths are what is written in
   `kinds` below, and SETTINGS.pen is what one of them is worth in pixels here.
   Change `pen` and the whole picture gets heavier or lighter together, and it
   still agrees with the legend. Nothing is matched by eye.

   NO TRAIL EVER CROSSES ANOTHER TRAIL, or itself. That one rule is what makes
   the picture read as a network rather than as a scribble, and it is the rule
   a game of snake plays by: every step a trail takes claims the ground it is
   on, and nothing else may step there until the far end has been rubbed out
   and given it back.

   AND NOTHING RUNS ALONGSIDE ITS OWN KIND. Two trails a single cell apart read
   as one fat trail badly drawn; two expressways do the same. So every step a
   line takes also puts a soft mark on the grid — one the line itself may
   ignore, and one that nothing ELSE of that kind may step within. How far is
   `apart`, per kind, and it is the difference between a map and a bundle of
   cable.

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
    corner:          14,      // HOW ROUNDED A BEND IS. The map's trails turn
                              // on a radius rather than a point; this is how
                              // far back from the corner the curve starts, so
                              // it is the radius in all but name. Never more
                              // than half a cell — a bend cannot eat more than
                              // half of the legs either side of it.
    cornerSteps:     6,       // and how many straight pieces a RIGHT ANGLE is
                              // carried in. A gentler bend gets proportionally
                              // fewer. Six is already shorter than the line is
                              // wide; more is invisible and costs points.

    /* THE PEN. Every width in `kinds` below is the legend's own number, drawn
       against a trail sixteen units wide. This is what one of those units is
       worth in pixels, so a trail comes out at 16 × pen and everything else
       keeps its proportion to it. Raise it and the whole picture thickens
       together; the dots are sized from it too, so they stay inside the line
       they sit on. */
    pen:             0.66,

    /* HOW MANY THINGS AT ONCE. This is the hard ceiling — a branch is refused
       once it is reached. What the picture aims for, kind by kind, is `want`
       in each entry of `kinds`. */
    maxLines:        22,
    startEvery:      0.35,    // seconds between one new line and the next
    startTries:      10,      // places considered for each, emptiest wins.
                              // Higher than it used to be because a line now
                              // has to find room away from its own kind too.

    /* WHICH WAY A LINE GOES. Mostly horizontal and vertical: a turn off an
       orthogonal leg stays orthogonal nine times in ten, and only now and then
       cuts the corner at forty-five. `leg` in each kind is how many steps
       before it may turn at all, which is what gives the long straight runs;
       `straight` there overrides this for a kind that wants to wander more (a
       river) or less (an expressway). */
    straightness:    0.88,    // chance a turn keeps to the square grid
    turnBoth:        0.5,     // chance a turn goes left rather than right
    sameWay:         0.18,    // …and the chance it turns the SAME way twice
                              // running. Two turns the same way is a hairpin,
                              // and a hairpin is the one shape a map like this
                              // never has, so it is rare on purpose. Raise it
                              // and the picture starts folding back on itself.
    edgeMargin:      1.2,     // cells of the canvas a line will not go past
    diagLeg:         [2, 4],  // HOW LONG A FORTY-FIVE DEGREE LEG MAY BE, which
                              // is a different number from `leg` on purpose. A
                              // diagonal run as long as a square one stops
                              // being an occasional corner-cut and becomes a
                              // mountain drawn across the picture. Short, so a
                              // diagonal reads as the map's way of getting
                              // round something. A kind may override it with
                              // `diag` — the river does, because a river IS
                              // mostly diagonal.
    /* THE LAST FEW PIXELS OF A LINE. Every line ends the same way — its tail
       catches its head — and for a second before that it is a stub: an inch of
       grey lying on the picture with no beginning and no end, which reads as a
       stray mark rather than as a road going away. So the last stretch of a
       line is faded out instead of drawn, and a line that never got going in
       the first place is not held on screen at all, it is whipped off. */
    stubLeast:       2.0,     // cells: below this a line fades as it shortens
    leastSteps:      5,       // steps: a line that stops shorter than this
                              // never had anywhere to go
    stubRush:        3.5,     // and how much faster such a line is taken away

    giveUp:          3,       // HOW MANY TIMES RUNNING A LINE MAY BE SHOVED
                              // off its course before it simply stops. A line
                              // that keeps being blocked is in a corner it
                              // cannot get out of, and left to keep trying it
                              // ties itself in a knot of short zigzags —
                              // which is the one thing that reads as a mistake
                              // rather than as a map. Better that it ends
                              // there and something starts somewhere emptier.
                              // The count resets the moment it gets a clear
                              // leg, so a line that is merely picking its way
                              // past one obstacle is not punished for it.
    afterTurn:       0.4,     // and how much of a normal leg it runs after a
                              // turn it was FORCED into, as a fraction. Short,
                              // so a line pushed round by the edge of the
                              // picture comes back into it quickly instead of
                              // drawing a frame round the outside.

    /* ── WHERE THE CURSOR IS, THE MAP IS NOT ────────────────────────────────
       The one interactive thing on the page, and it is deliberately not a
       control: nothing is drawn for the pointer, nothing lights up, there is
       no instruction to read. A circle of ground around the cursor is simply
       closed to every line, the way a golf course is, so the drawing parts as
       you move through it and closes up again behind you. Sit still and it
       settles into a clearing; take the mouse away and it fills back in.

       A page nobody touches looks exactly as it did before, which is the whole
       point — and somebody who has asked for less movement gets the still
       picture and no pointer behaviour at all. */
    wakeCells:       5,       // the radius of that circle, in CELLS. Big on
                              // purpose: at two or three the lines swerve and
                              // you are not sure you saw it.
    wakeMost:        0.26,    // …but never more than this much of the SHORTER
                              // side of the picture. Five cells is judged
                              // against a wide screen; on a phone the cells
                              // are smaller but the picture is much smaller
                              // still, and the same five cells would be a hole
                              // half the width of it.
    wakeEase:        14,      // how fast the circle follows the cursor, per
                              // second. High enough to feel attached to the
                              // pointer, low enough that a flick across the
                              // page does not saw through the picture.
    wakeGrow:        6,       // and how fast it opens when the pointer arrives
                              // and closes when it leaves
    wakeSolid:       0.5,     // HOW MUCH OF THE CLEARING IS ACTUALLY CLEAR.
                              // The rule above only stops a line GROWING into
                              // the circle; everything already drawn there
                              // stays put, so on its own the effect is a faint
                              // swerve you are not sure you saw. So what is
                              // already inside the circle is faded back into
                              // the page as well: solid to this fraction of
                              // the radius, then easing back to full by the
                              // edge. No ring, no spotlight, no hard rim —
                              // the drawing simply is not there near the
                              // cursor, which is what the rule says too. Set
                              // it to 0 for the swerve alone.
    wakeShy:         0.6,     // HOW MUCH A LINE LEANS AWAY. The circle alone
                              // only stops a line dead at its edge; this makes
                              // a line that has to turn prefer the way that
                              // takes it further from the cursor, so it bends
                              // away in advance instead of running up against
                              // the circle and stopping. Zero turns that off.

    /* THE CONNECTIONS. A connection on the map is a short link that gets you
       from the end of one trail to the start of another, and it is no use
       unless it actually lands on one — so a connection here is given a real
       target on another trail and steers for it rather than wandering. Grey is
       a road connection, red is a dangerous one. */
    linkReach:       12,      // the furthest, in cells, it will try to reach
    linkLeast:       4,       // and the shortest worth drawing
    linkFresh:       6,       // and how far back from a trail's drawing head
                              // it will look for an end to land on, in cells
    linkStraight:    0.8,     // how much a cell of carrying straight on is
                              // worth against a cell of getting closer. Above
                              // zero it arrives in long legs and right angles
                              // rather than in a staircase.
    linkSquare:      0.5,     // and what a forty-five degree leg costs it, so
                              // it goes round corners rather than cutting them
    linkArrive:      1.2,     // cells from the target that count as arrived
    linkDots:        true,    // a white junction dot where it leaves a trail
                              // and another where it lands, which is the mark
                              // the map puts on a crosswalk or a junction

    /* THE GOLF COURSES. Red SQUARES — the same number of cells each way — that
       appear, sit, and go. A trail will not cross one. */
    wantGolf:        3,
    golfEvery:       3.2,     // seconds between one appearing and the next
    golfCells:       [2, 4],  // how many cells across, and the same down
    golfLife:        [10, 18],// seconds it stays before it starts to go
    golfFade:        0.9,     // seconds to fade in, and again to fade out
    golfClear:       0.55,    // cells of clearance a trail keeps around one

    /* THE DOTS, in legend units across — the map draws all three of them at
       twelve units on a sixteen-unit trail, which is why they sit inside it
       with a rim of green showing all the way round. All three pop in rather
       than appearing: a quick grow with a little overshoot, which is what
       makes one arriving catch the eye on a picture where everything else is
       already moving. */
    dotJunction:    13,       // the white dot at a branch or a junction
    dotBridge:      12,       // the bright green one where a trail goes over
    dotPinch:       12.5,     // and the red one at a pinch point
    dotPop:          0.34,    // seconds for a dot to reach full size
    dotOvershoot:    1.3,     // and how far past it goes on the way
    crossOver:       0.75,    // chance a crossing is a BRIDGE and gets the
                              // bright green dot. The rest are level crossings
                              // and get no mark at all — the trail is simply
                              // drawn over the road, the way the map draws it.
                              // There used to be a short piece of road painted
                              // back across the trail here to say "under", and
                              // what it looked like on the picture was a stray
                              // grey dash lying on a green line. A river is
                              // always crossed over: that is what a bridge is.
    redEvery:        [4, 9],  // seconds between one red dot and the next
    redAtOnce:       3,       // and never more than this many on the picture
    redLife:         [5, 7],  // how long one stays

    /* THE WISHFUL LINE. Something proposed rather than built: it draws itself
       in, and then straight back out again at more than twice the speed. One
       at a time, and not often. */
    wishEvery:       [18, 34],// seconds between one and the next
    wishRush:        2.4,     // how much faster its tail moves than its head

    /* ── WHAT EACH KIND OF LINE IS ───────────────────────────────────────────
       want    how many of this kind the picture aims to have at once
       speed   pixels a second
       maxLen  how long the drawn stretch may get before the tail sets off
               after the head — the biggest lever on how busy this looks
       steps   the most grid steps it may ever take, which is what bounds the
               arrays and stops a line living for ever
       leg     grid steps before it may turn: big legs, long straight runs
       fork    chance of branching at a turn, and forks how many times at most
       apart   cells of clearance it keeps from ANOTHER LINE OF ITS OWN KIND
       hold    seconds it sits finished before it starts rubbing itself out
       width / casing / mark / tie — all in legend units, see `pen` above
       solid   does it claim the ground, so nothing may cross it
       crossed is it a thing a trail crosses, with a dot or a stub
       seeks   does it steer for a target on another trail
       Every speed and length is jittered per line, so no two move alike. */
    kinds: {
      trail:   { want: 7, speed: 58, maxLen: 1000, steps: 46, leg: [5, 12],
                 fork: 0.30, forks: 2, apart: 1, hold: 0,
                 width: 16, casing: 26, solid: true },

      wish:    { want: 0, speed: 68, maxLen: 460, steps: 20, leg: [4, 8],
                 fork: 0, forks: 0, apart: 2, hold: 0,
                 width: 16, casing: 26, solid: true },

      /* a bike lane is the same green as a trail and half its width. On the
         map the width alone tells them apart; at this size it does not, so it
         is drawn as the map draws a route that is not a finished trail —
         round dots with a gap between them, not a dashed line. */
      lane:    { want: 2, speed: 74, maxLen: 420, steps: 26, leg: [4, 9],
                 fork: 0, forks: 0, apart: 2, hold: 0,
                 width: 8, casing: 0, solid: false },

      link:    { want: 2, speed: 96, maxLen: 520, steps: 22, leg: [3, 8],
                 fork: 0, forks: 0, apart: 2, hold: 3.5, seeks: true,
                 width: 8, casing: 0, solid: false },

      danger:  { want: 1, speed: 96, maxLen: 520, steps: 22, leg: [3, 8],
                 fork: 0, forks: 0, apart: 2, hold: 3.5, seeks: true,
                 width: 8, casing: 0, solid: false },

      /* the greys run a long way and hardly turn: they are what the trails are
         crossing, and a short one going nowhere looks like a mistake */
      highway: { want: 2, speed: 52, maxLen: 1600, steps: 56, leg: [8, 16],
                 fork: 0, forks: 0, apart: 2, hold: 1.5, straight: 0.95,
                 crossed: true,
                 width: 16, casing: 0, mark: 2, solid: false },

      rail:    { want: 2, speed: 46, maxLen: 1500, steps: 56, leg: [8, 16],
                 fork: 0, forks: 0, apart: 2, hold: 1.5, straight: 0.95,
                 crossed: true,
                 width: 16, casing: 0, mark: 2, tie: 8, solid: false },

      /* the river wanders — it is the one thing on the map that was not laid
         out by anybody — so it takes far more of its turns at forty-five. The
         legend draws it at its own scale, much bigger than the trail rows;
         these are the map's proportions brought down to the trail's. */
      river:   { want: 1, speed: 44, maxLen: 1300, steps: 44, leg: [3, 7],
                 fork: 0, forks: 0, apart: 2, hold: 2.5, straight: 0.55,
                 crossed: true, alwaysOver: true, diag: [3, 7],
                 width: 14, casing: 26, solid: false },
    },

    /* THE DASHES, also in legend units: these are the numbers in the legend's
       own SVGs. A zero-length dash with a round cap is a DOT, which is how the
       map draws a bike lane and a trail that is not finished yet. */
    dashHighway:   [9.14, 18.28],   // the centre line of an expressway
    dashRail:      [2, 12],         // and the sleepers on a railway
    dotLane:       [0, 17],         // a bike lane: dots, not dashes

    /* THE COLOURS, taken from the legend's own drawings rather than matched by
       eye. Change one here and the picture stops agreeing with the map, which
       is the whole point of it. */
    ink: {
      backdrop:    "#1e1e1e",   // the page's own ground, so there is no panel
      trail:       "#4ecf4e",   // a built trail
      trailCasing: "#181a18",   // the dark edge that lifts it off the ground
      wish:        "#cc6fff",   // a route that is only proposed
      wishCasing:  "#1d1420",
      junction:    "#ffffff",   // where one trail branches, or a link lands
      bridge:      "#a9ff9c",   // where a trail crosses OVER something
      pinch:       "#ff3600",   // a red dot: where a trail has a problem
      lane:        "#4ecf4e",   // a bike lane: the same green, drawn thin
      link:        "#bdbdbd",   // a road connection between two trails
      danger:      "#ff3600",   // and a dangerous one
      road:        "#878787",   // the bed of an expressway AND of a railway:
                                // on the map they are the same grey, and what
                                // tells them apart is what is drawn down the
                                // middle
      highwayLine: "#b2a66b",   // the expressway's dashed centre
      railLine:    "#a8a8a8",   // the railway's rail…
      railTie:     "#a8a8a8",   // …and its sleepers, as a dash over the top
      riverCore:   "#82afb8",   // the water
      riverBank:   "#454a43",   // and the ground either side of it
      golf:        "#c25d5d",
    },

    maxStep:       0.05,        // seconds: the longest time step allowed, so a
                                // tab coming back from the background resumes
                                // rather than jumping
    settleFrames:  1400,        // how far ahead the picture is wound before the
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

  /* THE LEGEND'S UNITS BECOME PIXELS, once, here — so nothing below has to
     remember to multiply, and there is exactly one place where the picture's
     weight is decided. */
  const pen = SETTINGS.pen;
  for (const name in K) {
    const k = K[name];
    k.px     = k.width  * pen;
    k.pxCase = (k.casing || 0) * pen;
    k.pxMark = (k.mark   || 0) * pen;
    k.pxTie  = (k.tie    || 0) * pen;
    /* HOW MANY OF ITS OWN STEPS A LINE MAY IGNORE when it asks whether it is
       running too close to its own kind. It has to be able to stand where it
       stands, so the window must cover everything within `apart` of the step
       it is about to take — a little over twice that — and no more, or the
       line can fold back on itself unnoticed. Derived, not typed, so `apart`
       is the only number to change. */
    k.forget = (k.apart || 1) * 2 + 3;
  }
  const DASH = {
    highway: SETTINGS.dashHighway.map(v => v * pen),
    rail:    SETTINGS.dashRail.map(v => v * pen),
    lane:    SETTINGS.dotLane.map(v => v * pen),
  };
  // the dots are given in legend units across; here they are radii in pixels
  /* the backdrop again with nothing in it, for the soft edge of the clearing.
     Worked out from the one colour above rather than written down twice — two
     spellings of the same grey is exactly the sort of thing that goes out of
     step the first time somebody changes it. */
  const NOTHING = (function () {
    let h = INK.backdrop.replace("#", "");
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    const n = parseInt(h, 16);
    return "rgba(" + ((n >> 16) & 255) + "," + ((n >> 8) & 255) + "," +
           (n & 255) + ",0)";
  })();

  const DOT = {
    junction: SETTINGS.dotJunction * pen / 2,
    bridge:   SETTINGS.dotBridge   * pen / 2,
    pinch:    SETTINGS.dotPinch    * pen / 2,
  };

  /* the eight directions, as steps on the grid: east, south-east, south and so
     on round the compass. An EVEN index is a square direction, an odd one a
     diagonal, which is how straightness below keeps to the grid. */
  const DIRS = [[1, 0], [1, 1], [0, 1], [-1, 1],
                [-1, 0], [-1, -1], [0, -1], [1, -1]];
  const turn = (d, by) => (d + by + 8) % 8;
  const pick = list => list[(Math.random() * list.length) | 0];
  const between = (a, b) => a + Math.random() * (b - a);
  const jitter = (v, much) => v * (1 - much + Math.random() * much * 2);

  let lines = [], golf = [], reds = [];
  let taken = new Map();                 // the ground the trails have claimed
  let busy = new Map();                  // and every step every line is standing on
  let spread = new Map();                // and the room each kind keeps to itself
  let W = 0, H = 0, cell = SETTINGS.cell, room = 1, reach = 1;
  let sinceLine = 0, sinceGolf = 0, tillRed = 0, tillWish = 0, clock = 0;
  let running = false, frame = 0, lastAt = 0, visible = true, onScreen = true;
  /* the cursor's clearing: where it is being drawn towards, where it actually
     is this frame, and how wide it is open. All three are eased, so the hole
     opens, follows and closes rather than jumping about. */
  let wantX = 0, wantY = 0, wakeX = 0, wakeY = 0, wake = 0, wakeOn = false;

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

  /* ── AND THE STEP ITSELF, WHICH EVERY KIND CLAIMS ────────────────────────
     Two lines may CROSS — that is what a map does, and at ninety degrees it is
     the clearest thing on it — but they may not run along the same ground, and
     the difference between the two is exactly one thing: whether they share an
     EDGE of the grid or only a corner of it.

     A crossing shares a point and no edge: one line goes east through it, the
     other goes north through it, and the two edges they use are different
     edges. Running on top of each other means using the SAME edge, and that is
     the only thing refused here. Which is why the key is the middle of the
     step with the step's axis written after it — the middle alone is not
     enough, because the two diagonals of a cell share their middle and are a
     perfectly good ninety-degree crossing. */
  const edgeOf = (ax, ay, bx, by, dir) =>
        key((ax + bx) / 2, (ay + by) / 2) + "/" + (dir % 4);

  function claim(line, at, ground, edges) {
    for (let i = 0; i < ground.length; i++) {
      taken.set(ground[i], (taken.get(ground[i]) || 0) + 1);
    }
    for (let i = 0; i < edges.length; i++) {
      busy.set(edges[i], (busy.get(edges[i]) || 0) + 1);
    }
    line.claims.push({ at: at, ground: ground, edges: edges });
  }

  function release(c) {
    for (let i = 0; i < c.ground.length; i++) {
      const n = (taken.get(c.ground[i]) || 0) - 1;
      if (n > 0) taken.set(c.ground[i], n); else taken.delete(c.ground[i]);
    }
    for (let i = 0; i < c.edges.length; i++) {
      const n = (busy.get(c.edges[i]) || 0) - 1;
      if (n > 0) busy.set(c.edges[i], n); else busy.delete(c.edges[i]);
    }
  }

  function dropClaims(line, upTo) {
    while (line.claims.length && line.claims[0].at < upTo) {
      release(line.claims.shift());
    }
  }

  /* ── THE ROOM EACH KIND KEEPS TO ITSELF ──────────────────────────────────
     A softer thing than a claim, and a different problem. Two trails may not
     cross; but two trails that never cross and run one cell apart for half the
     picture look like one badly drawn trail, and two expressways doing it look
     like a mistake. So every step also leaves a mark on a coarser grid, under
     its own kind's name, and no line of that kind may step within `apart`
     cells of somebody ELSE's mark.

     "Somebody else's" is the whole trick. A line is forever standing inside
     its own marks, so the count at a square is compared with the line's own
     contribution to it: more than its own means another line is there. A
     branch SHARES its parent's tally — they are one trail with two ends, and
     they are allowed to be close. */
  const coarse = (x, y) => Math.round(x / cell) + "," + Math.round(y / cell);

  function stamp(line, at, x, y) {
    const k = line.kind + "|" + coarse(x, y);
    spread.set(k, (spread.get(k) || 0) + 1);
    line.marks.push({ at: at, k: k });

    /* AND THE LINE'S OWN RECENT HISTORY, which it may ignore — but only the
       last few steps of it. A line has to be allowed to stand where it is
       standing, or it could not take its next step at all; what it must NOT be
       allowed is to come back and run alongside a stretch of itself laid down
       half a minute ago. So the exemption is a short sliding window: `forget`
       steps of memory, and everything older blocks this line exactly as it
       blocks every other line of its kind. */
    line.near.set(k, (line.near.get(k) || 0) + 1);
    line.recent.push(k);
    while (line.recent.length > K[line.kind].forget) {
      forget(line, line.recent.shift());
    }
  }

  function forget(line, k) {
    const n = (line.near.get(k) || 0) - 1;
    if (n > 0) line.near.set(k, n); else line.near.delete(k);
  }

  function unstamp(line, upTo) {
    while (line.marks.length && line.marks[0].at < upTo) {
      const k = line.marks.shift().k;
      const n = (spread.get(k) || 0) - 1;
      if (n > 0) spread.set(k, n); else spread.delete(k);
    }
  }

  function crowded(kind, x, y, self) {
    const a = K[kind].apart;
    if (!a) return false;
    const cx = Math.round(x / cell), cy = Math.round(y / cell);
    for (let dx = -a; dx <= a; dx++) {
      for (let dy = -a; dy <= a; dy++) {
        const k = kind + "|" + (cx + dx) + "," + (cy + dy);
        const n = spread.get(k);
        if (!n) continue;
        if (!self || n > (self.near.get(k) || 0)) return true;
      }
    }
    return false;
  }

  const inside = (x, y) => {
    const m = cell * SETTINGS.edgeMargin;
    return x >= m && y >= m && x <= W - m && y <= H - m;
  };

  /* Is this step open to this kind of line? Off the canvas, into a golf course
     that is solid enough to see, onto ground another trail is already standing
     on, along a step ANY line is already using, or too close to another line
     of the same kind. `dir` is which of the eight ways the step goes; pass -1
     where there is no step yet, as when a line is being placed. */
  function open(kind, x, y, fromX, fromY, self, dir) {
    if (!inside(x, y)) return false;
    if (dir >= 0 && busy.has(edgeOf(fromX, fromY, x, y, dir))) return false;
    const mx = (x + fromX) / 2, my = (y + fromY) / 2;
    /* THE GOLF COURSES, TESTED ALONG THE WHOLE STEP rather than at its ends.
       Two points — where the step lands and the middle of it — used to be
       enough, and it was not: a DIAGONAL step can pass across the corner of a
       square with both of those points outside it, and what you saw was a
       trail clipping the corner of a golf course, which is the one thing a
       golf course on this map never allows. Five points cost nothing and there
       is no corner narrow enough to slip between them. */
    for (let i = 0; i < golf.length; i++) {
      const g = golf[i];
      if (g.alpha < 0.3) continue;
      const pad = cell * SETTINGS.golfClear;
      const x0 = g.x - pad, x1 = g.x + g.side + pad;
      const y0 = g.y - pad, y1 = g.y + g.side + pad;
      for (let t = 0; t <= 4; t++) {
        const px = fromX + (x - fromX) * t / 4;
        const py = fromY + (y - fromY) * t / 4;
        if (px > x0 && px < x1 && py > y0 && py < y1) return false;
      }
    }
    /* AND THE CURSOR'S CLEARING, tested the same way along the step — but
       NOT at the step's own starting point. A line that the clearing has
       swept over is standing inside it; test where it stands and every way
       out is closed too, and instead of walking out it stops dead. Leaving
       t = 0 out means it may not go deeper in, but it may always leave. */
    if (wake > 1) {
      for (let t = 1; t <= 4; t++) {
        const px = fromX + (x - fromX) * t / 4;
        const py = fromY + (y - fromY) * t / 4;
        if (Math.hypot(px - wakeX, py - wakeY) < wake) return false;
      }
    }
    if (K[kind].solid && (claimed(x, y) || claimed(mx, my))) return false;
    if (crowded(kind, x, y, self || null)) return false;
    return true;
  }

  /* ── A LINE ──────────────────────────────────────────────────────────────
     `grid` is the bare vertices, on the grid; `pts` is what is actually drawn,
     which is the same thing with its corners rounded off. run[] is the
     distance along `pts` at each of them, and head and tail are distances into
     that. */
  function newLine(kind, x, y, dir, parent) {
    const k = K[kind];
    const line = {
      kind: kind, grid: [{ x: x, y: y }], pts: [], run: [],
      head: 0, tail: 0, dir: dir, steps: 0,
      legLeft: Math.round(between(k.leg[0], k.leg[1])),   // reset by legFor
      speed: jitter(k.speed, 0.2) * (0.8 + reach * 0.2),
      maxLen: jitter(k.maxLen, 0.25) * reach,
      maxSteps: Math.round(k.steps * (0.7 + reach * 0.3)),
      tailRush: kind === "wish" ? SETTINGS.wishRush : 1,
      hold: k.hold || 0,
      growing: true, forks: 0, dots: [], cross: [], claims: [],
      target: null, spin: 0, pushed: 0,
      // a branch shares its parent's tally: they are one trail with two ends,
      // and they are allowed to start out side by side
      near: parent ? parent.near : new Map(), marks: [], recent: [],
    };
    claim(line, 0, k.solid ? [key(x, y)] : [], []);
    stamp(line, 0, x, y);
    rebuild(line);
    return line;
  }

  /* ── THE CORNERS GET ROUNDED ─────────────────────────────────────────────
     The map's trails turn on a radius, not on a point, and a right angle drawn
     sharp looks like a diagram of a circuit rather than a route. Each interior
     vertex is replaced by a curve that leaves the leg behind it going exactly
     the way that leg was going and joins the leg ahead going exactly the way
     THAT one goes. It is done here, on the drawn polyline, rather than in the
     geometry, so everything that reasons about where a line has BEEN still
     sees plain grid steps. */
  function rebuild(line) {
    const g = line.grid, pts = [];
    const r = Math.min(SETTINGS.corner, cell * 0.45);
    for (let i = 0; i < g.length; i++) {
      if (i === 0 || i === g.length - 1) { pts.push(g[i]); continue; }
      const a = g[i - 1], b = g[i], c = g[i + 1];
      const inLen  = Math.hypot(b.x - a.x, b.y - a.y);
      const outLen = Math.hypot(c.x - b.x, c.y - b.y);
      if (!inLen || !outLen) { pts.push(b); continue; }
      const ix = (b.x - a.x) / inLen,  iy = (b.y - a.y) / inLen;
      const ox = (c.x - b.x) / outLen, oy = (c.y - b.y) / outLen;
      // straight through: no corner to round
      if (Math.abs(ix - ox) < 1e-9 && Math.abs(iy - oy) < 1e-9) { pts.push(b); continue; }

      const ri = Math.min(r, inLen * 0.45), ro = Math.min(r, outLen * 0.45);
      const p0 = { x: b.x - ix * ri, y: b.y - iy * ri };   // where the bend starts
      const p2 = { x: b.x + ox * ro, y: b.y + oy * ro };   // and where it ends

      /* THE BEND ITSELF, as a quadratic curve pulled towards the corner it
         replaces, and cut into short straight pieces.

         The curve is the shape; the pieces are how it is carried. Everything
         downstream of here works in DISTANCE ALONG A POLYLINE — what to draw
         between the head and the tail, where a dot sits, where a road crosses
         — and none of that has an answer on a curve without measuring its arc
         length, which is an approximation anyway. Six short segments across a
         right angle are shorter than the line is wide: the join between them
         is rounded by the stroke, and what you see is a curve. So the maths
         stays where it is and the corner still looks drawn rather than cut.

         How many pieces follows how far the line turns, so a gentle
         forty-five degree bend does not carry the cost of a right angle. */
      const angle = Math.acos(Math.max(-1, Math.min(1, ix * ox + iy * oy)));
      const steps = Math.max(2, Math.round(SETTINGS.cornerSteps *
                                           angle / (Math.PI / 2)));
      for (let k = 0; k <= steps; k++) {
        const t = k / steps, u = 1 - t;
        pts.push({ x: u * u * p0.x + 2 * u * t * b.x + t * t * p2.x,
                   y: u * u * p0.y + 2 * u * t * b.y + t * t * p2.y });
      }
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
     Mostly square. Off a horizontal or vertical leg a turn stays square most
     of the time and otherwise cuts across at forty-five; off a diagonal it
     comes back to square. Either way it is a turn of one or two eighths, so
     nothing ever doubles back on itself. A kind may have its own `straight`:
     an expressway almost never cuts the corner, a river often does. */
  /* how many steps this line may run before it may turn again — a short leg
     if it has just gone diagonal, a full one if it is back on the square */
  function legFor(line, dir) {
    const k = K[line.kind];
    const span = (dir % 2) ? (k.diag || SETTINGS.diagLeg) : k.leg;
    return Math.round(between(span[0], span[1]));
  }

  function nextWay(line) {
    const k = K[line.kind];
    const keeps = k.straight !== undefined ? k.straight : SETTINGS.straightness;
    /* WHICH HAND IT TURNS. Two turns the same way is a hairpin — the line
       folds back and runs beside where it has just been — and that is the one
       shape this picture must not make. So a turn goes the OTHER way from the
       last one unless the dice say otherwise, which they rarely do. */
    let hand;
    if (line.spin && Math.random() > SETTINGS.sameWay) hand = -line.spin;
    else hand = Math.random() < SETTINGS.turnBoth ? 1 : -1;
    line.spin = hand;
    const square = line.dir % 2 === 0;
    if (square) return turn(line.dir, (Math.random() < keeps ? 2 : 1) * hand);
    return turn(line.dir, (Math.random() < keeps ? 1 : 2) * hand);
  }

  /* ── ONE MORE STEP ───────────────────────────────────────────────────────
     Two ways of choosing it. A connection is STEERING for a place on another
     trail, so it takes whichever open direction gets it closest, with a bonus
     for carrying straight on so it arrives in legs and right angles rather
     than in a staircase. Everything else WANDERS: straight on if it can,
     otherwise whichever turn leaves it furthest from the nearest edge. */
  function extend(line) {
    const k = K[line.kind];
    if (line.steps >= line.maxSteps) { stopGrowing(line); return false; }

    const at = line.grid[line.grid.length - 1];
    const here = ends(line);
    let go = null;

    if (k.seeks && line.target) {
      const gap = Math.hypot(line.target.x - at.x, line.target.y - at.y);
      if (gap <= cell * SETTINGS.linkArrive) { arrive(line, here); return false; }
      let best = Infinity;
      const ways = [0, 2, -2, 1, -1];
      for (let t = 0; t < ways.length; t++) {
        const d = turn(line.dir, ways[t]);
        const s = DIRS[d];
        const nx = at.x + s[0] * cell, ny = at.y + s[1] * cell;
        if (!open(line.kind, nx, ny, at.x, at.y, line, d)) continue;
        let want = Math.hypot(line.target.x - nx, line.target.y - ny);
        if (ways[t] === 0) want -= cell * SETTINGS.linkStraight;
        if (d % 2) want += cell * SETTINGS.linkSquare;   // square by preference
        if (want < best) { best = want; go = d; }
      }
      if (go === null) { stopGrowing(line); return false; }

    } else {
      if (line.legLeft <= 0) {
        line.dir = nextWay(line);
        line.legLeft = legFor(line, line.dir);
        /* A BRANCH, and the white dot that says so. It leaves square to the
           parent so the two are plainly two, and it is refused if there is no
           room on the ground for it to start. */
        if (k.fork && Math.random() < k.fork && line.forks < (k.forks || 1) &&
            lines.length < wantedOf(SETTINGS.maxLines)) {
          const away = turn(line.dir, Math.random() < 0.5 ? 2 : -2);
          const s = DIRS[away];
          if (open(line.kind, at.x + s[0] * cell, at.y + s[1] * cell,
                   at.x, at.y, line, away)) {
            lines.push(newLine(line.kind, at.x, at.y, away, line));
            line.forks++;
            line.dots.push({ at: here, born: clock, ink: INK.junction,
                             r: DOT.junction });
          }
        }
      }

      const ahead = DIRS[line.dir];
      if (open(line.kind, at.x + ahead[0] * cell, at.y + ahead[1] * cell,
               at.x, at.y, line, line.dir)) {
        go = line.dir;
        line.pushed = 0;            // a clear step: it is not stuck after all
      } else {
        if (++line.pushed > SETTINGS.giveUp) { stopGrowing(line); return false; }
        /* BLOCKED, so it turns. Whichever way has the most room — but room
           measured A WHOLE LEG AHEAD, not one step ahead, and that distinction
           is the difference between a map and a picture frame. Scored one step
           ahead, a line stopped by the top edge finds that turning to run
           ALONG the edge is as roomy as anything else, and away it goes round
           the border. Scored a leg ahead, running along the edge is still
           jammed against the edge a leg later and turning inward is not, so it
           comes back into the picture.

           A square turn is preferred over a diagonal one, and a turn that
           repeats the last one — a hairpin again — is costed against. A turn
           of three eighths is not offered at all: that is a line doubling back
           on itself in all but name. */
        let bestRoom = -Infinity;
        const away = [2, -2, 1, -1];
        const peek = Math.max(3, k.leg[0]);
        for (let t = 0; t < away.length; t++) {
          const d = turn(line.dir, away[t]);
          const s = DIRS[d];
          const nx = at.x + s[0] * cell, ny = at.y + s[1] * cell;
          if (!open(line.kind, nx, ny, at.x, at.y, line, d)) continue;
          const fx = at.x + s[0] * cell * peek, fy = at.y + s[1] * cell * peek;
          let spare = Math.min(fx, fy, W - fx, H - fy);
          /* and, if the cursor is on the picture, the way that gets further
             from it — so a line bends away in advance rather than running up
             against the clearing and stopping at its edge */
          if (wake > 1) {
            spare += (Math.hypot(fx - wakeX, fy - wakeY) -
                      Math.hypot(at.x - wakeX, at.y - wakeY)) * SETTINGS.wakeShy;
          }
          if (d % 2 === 0) spare += cell * 2;
          if (line.spin && Math.sign(away[t]) === line.spin) spare -= cell * 3;
          if (spare > bestRoom) { bestRoom = spare; go = d; line.spin = Math.sign(away[t]); }
        }
        if (go === null) { stopGrowing(line); return false; }
        /* A SHORT LEG AFTER A FORCED TURN. A line that has just been stopped
           by the edge of the picture is, by definition, standing against it;
           give it a full leg and it runs the length of the border and the
           picture grows a frame round it. A short one means it turns again
           soon, and the next turn is the other way — back inside. */
        line.legLeft = (go % 2) ? legFor(line, go)
                                : Math.max(2, Math.round(k.leg[0] * SETTINGS.afterTurn));
      }
    }

    const s = DIRS[go];
    const nx = at.x + s[0] * cell, ny = at.y + s[1] * cell;
    line.dir = go;
    line.grid.push({ x: nx, y: ny });
    line.steps++;
    line.legLeft--;
    rebuild(line);
    stamp(line, ends(line), nx, ny);
    claim(line, ends(line),
          k.solid ? [key(nx, ny), key((nx + at.x) / 2, (ny + at.y) / 2)] : [],
          [edgeOf(at.x, at.y, nx, ny, go)]);
    if (line.kind === "trail" || line.kind === "wish") {
      lookForCrossings(line, at, { x: nx, y: ny }, here);
    }
    return true;
  }

  function stopGrowing(line) {
    line.growing = false;
    /* A LINE THAT NEVER GOT GOING is not worth waiting for. It does not get
       its hold, and its tail comes after it quickly, so what would have been a
       stub sitting on the picture for three seconds is gone in half of one. */
    if (line.steps < SETTINGS.leastSteps) {
      line.hold = 0;
      line.tailRush = SETTINGS.stubRush;
    }
  }

  /* a connection that has got where it was going: it stops, and gets the white
     junction dot the map puts where one route meets another */
  function arrive(line, here) {
    stopGrowing(line);
    if (SETTINGS.linkDots) {
      line.dots.push({ at: here, born: clock, ink: INK.junction,
                       r: DOT.junction });
    }
  }

  /* ── WHERE A TRAIL MEETS A ROAD, A RAILWAY OR A RIVER ────────────────────
     Tested once, as the step is laid down, rather than every frame. Each
     crossing is decided there and then: a bridge, and it gets the bright green
     dot the map puts on one; a level crossing, and it gets no mark at all. A
     river is always crossed on a bridge — a trail does not go under a river. */
  function lookForCrossings(line, a, b, atA) {
    for (let i = 0; i < lines.length; i++) {
      const other = lines[i];
      if (other === line || !K[other.kind].crossed) continue;
      const pts = other.pts, run = other.run;
      for (let q = 1; q < pts.length; q++) {
        if (run[q] < other.tail || run[q - 1] > other.head) continue;
        const hit = meet(a, b, pts[q - 1], pts[q]);
        if (!hit) continue;
        line.cross.push({
          at: atA + Math.hypot(hit.x - a.x, hit.y - a.y),
          x: hit.x, y: hit.y, born: clock,
          over: K[other.kind].alwaysOver ? true
                                         : Math.random() < SETTINGS.crossOver,
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
    if (lines.length >= wantedOf(SETTINGS.maxLines)) return;
    const count = kind => {
      let n = 0;
      for (let i = 0; i < lines.length; i++) if (lines[i].kind === kind) n++;
      return n;
    };
    const want = [];
    for (const name in K) {
      if (K[name].want && count(name) < wantedOf(K[name].want)) want.push(name);
    }
    if (!want.length) return;
    const kind = pick(want);
    if (K[kind].seeks) placeLink(kind); else place(kind);
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
      if (!open(kind, x, y, x, y, null, -1)) continue;
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
    const line = newLine(kind, best.x, best.y, ((Math.random() * 4) | 0) * 2, null);
    lines.push(line);
    return line;
  }

  /* ── A CONNECTION, FROM ONE TRAIL TO ANOTHER ─────────────────────────────
     A connection that starts nowhere and ends nowhere is just a short grey
     line, which is what these used to be. So one is given two real ends: a
     place on a trail that is currently drawn, and a place on a DIFFERENT
     trail, near enough to be worth walking and far enough to be worth drawing.
     It leaves the first heading whichever square way gets it closest to the
     second, and steers from there. */
  function spotOnATrail(notThis) {
    const able = [];
    for (let i = 0; i < lines.length; i++) {
      const l = lines[i];
      if (l.kind === "trail" && l !== notThis && l.head - l.tail > cell * 4) {
        able.push(l);
      }
    }
    if (!able.length) return null;
    const line = pick(able);
    /* NEAR THE HEAD, not anywhere along it. A trail is being rubbed out from
       the tail the whole time, so a point picked at random can easily be gone
       by the time the connection gets there — and a connection with nothing at
       either end of it is exactly the short grey line going nowhere that these
       replaced. The freshest stretch is the stretch that will still be there. */
    const from = Math.max(line.tail + cell, line.head - cell * SETTINGS.linkFresh);
    const p = pointAt(line, between(from, line.head - cell));
    if (!p) return null;
    return { line: line,
             x: Math.round(p.x / cell) * cell,
             y: Math.round(p.y / cell) * cell };
  }

  function placeLink(kind) {
    const from = spotOnATrail(null);
    if (!from) return null;
    const to = spotOnATrail(from.line);
    if (!to) return null;

    const span = Math.hypot(to.x - from.x, to.y - from.y);
    if (span < cell * SETTINGS.linkLeast || span > cell * SETTINGS.linkReach) {
      return null;
    }
    if (crowded(kind, from.x, from.y, null)) return null;

    let dir = -1, best = Infinity;
    for (let i = 0; i < 8; i += 2) {
      const s = DIRS[i];
      const nx = from.x + s[0] * cell, ny = from.y + s[1] * cell;
      if (!open(kind, nx, ny, from.x, from.y, null, i)) continue;
      const q = Math.hypot(to.x - nx, to.y - ny);
      if (q < best) { best = q; dir = i; }
    }
    if (dir < 0) return null;

    const line = newLine(kind, from.x, from.y, dir, null);
    line.target = { x: to.x, y: to.y };
    if (SETTINGS.linkDots) {
      line.dots.push({ at: 0, born: clock, ink: INK.junction, r: DOT.junction });
    }
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
      // nor does a golf course appear in the clearing the cursor has made
      if (wake > 1 &&
          Math.hypot(x + side / 2 - wakeX, y + side / 2 - wakeY) < wake + side) {
        continue;
      }
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

    /* THE CLEARING CATCHES UP. Exponential approach rather than a fixed step,
       so it behaves the same whatever the frame rate — and so a tab coming
       back from the background does not find the hole in last minute's place
       and drag it across the picture. */
    const follows = 1 - Math.exp(-SETTINGS.wakeEase * dt);
    wakeX += (wantX - wakeX) * follows;
    wakeY += (wantY - wakeY) * follows;
    const wants = wakeOn ? Math.min(SETTINGS.wakeCells * cell,
                                    Math.min(W, H) * SETTINGS.wakeMost) : 0;
    wake += (wants - wake) * (1 - Math.exp(-SETTINGS.wakeGrow * dt));

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
      /* A LINE THAT HAS ARRIVED MAY SIT THERE a moment before it starts rubbing
         itself out. A connection whose whole point is that it joins two trails
         has to be on the picture long enough to be read as joining them. */
      if (!line.growing && line.hold > 0) {
        line.hold -= dt;
      } else if (!line.growing || ends(line) - line.tail > line.maxLen) {
        line.tail += line.speed * dt * (line.growing ? 1 : line.tailRush);
      }
      dropClaims(line, line.tail);
      unstamp(line, line.tail);
      while (line.dots.length && line.dots[0].at < line.tail) line.dots.shift();
      while (line.cross.length && line.cross[0].at < line.tail) line.cross.shift();
      if (!line.growing && line.hold <= 0 && line.tail >= line.head) {
        dropClaims(line, Infinity);
        unstamp(line, Infinity);
        // and hand back what is left of its own short memory, which a branch
        // may still be sharing
        while (line.recent.length) forget(line, line.recent.shift());
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

  /* how solidly a line is drawn: all of it, until the drawn stretch gets short
     enough to read as a stray mark, and then less and less of it */
  function showing(line) {
    const least = cell * SETTINGS.stubLeast;
    const len = line.head - line.tail;
    return len >= least ? 1 : Math.max(0, len / least);
  }

  function strokeKind(kind, colour, width, dash) {
    if (!(width > 0)) return;
    ctx.strokeStyle = colour;
    ctx.lineWidth = width;
    ctx.setLineDash(dash || []);
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.kind !== kind) continue;
      const showy = showing(line);
      if (showy <= 0.02) continue;
      ctx.globalAlpha = showy;
      if (trace(line, line.tail, line.head)) ctx.stroke();
    }
    ctx.globalAlpha = 1;
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
     In the map's own order, bottom to top: the water, the ground, the things
     trails cross, the thin things that hang off trails, the trails themselves,
     then everything that sits ON a trail. */
  function paint() {
    ctx.fillStyle = INK.backdrop;
    ctx.fillRect(0, 0, W, H);

    // the river, under all of it: its banks first, then the water
    strokeKind("river", INK.riverBank, K.river.pxCase);
    strokeKind("river", INK.riverCore, K.river.px);

    for (let i = 0; i < golf.length; i++) {
      const g = golf[i];
      ctx.globalAlpha = Math.max(0, Math.min(1, g.alpha));
      ctx.fillStyle = INK.golf;
      ctx.fillRect(g.x, g.y, g.side, g.side);
      ctx.globalAlpha = 1;
    }

    /* A RAILWAY AND AN EXPRESSWAY ARE THE SAME GREY BED on the map, and what
       tells them apart is what is drawn down the middle of it: a rail with
       sleepers over it, or a dashed tan centre line. */
    strokeKind("rail", INK.road, K.rail.px);
    strokeKind("rail", INK.railLine, K.rail.pxMark);
    strokeKind("rail", INK.railTie, K.rail.pxTie, DASH.rail);
    strokeKind("highway", INK.road, K.highway.px);
    strokeKind("highway", INK.highwayLine, K.highway.pxMark, DASH.highway);

    // the thin things: a bike lane in dots, and the connections between trails
    strokeKind("lane", INK.lane, K.lane.px, DASH.lane);
    strokeKind("link", INK.link, K.link.px);
    strokeKind("danger", INK.danger, K.danger.px);

    // a trail is drawn twice: its dark edge, then its colour
    strokeKind("trail", INK.trailCasing, K.trail.pxCase);
    strokeKind("wish",  INK.wishCasing,  K.wish.pxCase);
    strokeKind("trail", INK.trail, K.trail.px);
    strokeKind("wish",  INK.wish,  K.wish.px);

    /* and everything that sits on top of a trail: the white dot at a branch or
       a junction, the bright green one where it crosses over something, and
       the red one where there is a problem */
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const showy = showing(line);
      for (let d = 0; d < line.dots.length; d++) {
        const it = line.dots[d];
        if (it.at < line.tail || it.at > line.head) continue;
        const p = pointAt(line, it.at);
        if (p) dot(p.x, p.y, it.r * popped(it.born) * showy, it.ink);
      }
      for (let c = 0; c < line.cross.length; c++) {
        const x = line.cross[c];
        if (!x.over || x.at < line.tail || x.at > line.head) continue;
        dot(x.x, x.y, DOT.bridge * popped(x.born) * showy, INK.bridge);
      }
    }
    for (let i = 0; i < reds.length; i++) {
      const r = reds[i];
      const p = pointAt(r.line, r.at);
      if (p) dot(p.x, p.y, DOT.pinch * popped(r.born), INK.pinch);
    }

    /* ── AND THE CLEARING, LAST ──────────────────────────────────────────
       The page's own colour, painted back over whatever is under the cursor
       and easing out to nothing by the edge of the circle. It goes on top of
       everything, dots included, so what is near the pointer is simply not
       there — which is what the rule that keeps lines out of it says as well.

       It is a fade and not a hole on purpose: a hard rim would read as a
       spotlight cut into the artwork, and a line stopping dead at an invisible
       circle would read as a fault. This way a line that has routed around the
       clearing is at full strength exactly where it comes back into view. */
    if (wake > 1 && SETTINGS.wakeSolid < 1) {
      const fade = ctx.createRadialGradient(
        wakeX, wakeY, wake * SETTINGS.wakeSolid, wakeX, wakeY, wake);
      fade.addColorStop(0, INK.backdrop);
      fade.addColorStop(1, NOTHING);
      ctx.fillStyle = fade;
      ctx.beginPath();
      ctx.arc(wakeX, wakeY, wake, 0, Math.PI * 2);
      ctx.fill();
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
    lines = []; golf = []; reds = [];
    taken = new Map(); busy = new Map(); spread = new Map();
    sinceLine = SETTINGS.startEvery; sinceGolf = SETTINGS.golfEvery;
    tillRed = 0.5; tillWish = 3; clock = 0;
    wake = 0; wakeOn = false;      // the picture is wound forward untouched
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

  /* ── THE CURSOR ──────────────────────────────────────────────────────────
     offsetX and offsetY are already in the same pixels everything else here
     works in — the canvas has no padding and its CSS size is its size — so
     there is no rectangle to measure and nothing to read back from layout on
     every mouse move.

     On the first move the clearing is put exactly where the pointer is rather
     than eased to it, or it would open somewhere else and sweep across the
     picture on its way over. Passive listeners throughout: this never wants to
     stop the page scrolling, and on a touch screen a drag should still scroll
     even as it parts the drawing under the finger.

     Nobody who has asked for less movement gets any of this: there is no loop
     running for it to affect, and a still picture that quietly rearranged
     itself under the cursor would be exactly the thing they turned off. */
  if (!stillWanted) {
    const here = e => {
      if (!wakeOn) { wakeX = e.offsetX; wakeY = e.offsetY; }
      wantX = e.offsetX; wantY = e.offsetY;
      wakeOn = true;
    };
    canvas.addEventListener("pointermove", here, { passive: true });
    canvas.addEventListener("pointerdown", here, { passive: true });
    const gone = () => { wakeOn = false; };
    canvas.addEventListener("pointerleave", gone, { passive: true });
    canvas.addEventListener("pointercancel", gone, { passive: true });
    window.addEventListener("blur", gone, { passive: true });
  }

  let resizing = 0;
  window.addEventListener("resize", () => {
    clearTimeout(resizing);
    resizing = setTimeout(() => { measure(); seed(); }, 180);
  });

  if (stillWanted) paint(); else settle();

  return { start: start, stop: stop, settings: SETTINGS };
};
