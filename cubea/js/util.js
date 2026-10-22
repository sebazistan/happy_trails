/* CUBEA — util.js : seeded RNG, math, colour helpers. Classic script (works from file://). */
(function () {
  'use strict';
  const C = (window.C = window.C || {});

  // SEEDED RANDOM NUMBERS
  // C.RNG(seed) returns a function f() that yields floats in [0,1) from a 32-bit seed (mulberry32).
  // The SAME seed always gives the SAME sequence, which is what makes a world reproducible: population generation, scene
  // layouts and the Unreal port's golden-data check all depend on it. Helpers hang off the function:
  //   f.int(n) 0..n-1 · f.range(lo,hi) float · f.irange(lo,hi) inclusive int · f.pick(arr) · f.chance(p) boolean
  //   f.gauss() standard normal · f.weighted([[item,weight],…]) · f.shuffle(arr) in place (Fisher–Yates).
  // mulberry32 seeded RNG with helpers
  C.RNG = function (seed) {
    let a = seed >>> 0;
    const f = function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    f.int = (n) => Math.floor(f() * n);
    f.range = (lo, hi) => lo + f() * (hi - lo);
    f.irange = (lo, hi) => lo + Math.floor(f() * (hi - lo + 1));
    f.pick = (arr) => arr[Math.floor(f() * arr.length)];
    f.chance = (p) => f() < p;
    f.gauss = () => { let u = 0, v = 0; while (!u) u = f(); while (!v) v = f(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
    f.weighted = (pairs) => { // [[item, weight], ...]
      let tot = 0; for (const p of pairs) tot += p[1];
      let r = f() * tot;
      for (const p of pairs) { r -= p[1]; if (r <= 0) return p[0]; }
      return pairs[pairs.length - 1][0];
    };
    f.shuffle = (arr) => { for (let i = arr.length - 1; i > 0; i--) { const j = f.int(i + 1); [arr[i], arr[j]] = [arr[j], arr[i]]; } return arr; };
    return f;
  };
  // Gameplay randomness (combat spread, event rolls, AI choices) is deliberately NOT seeded from the world seed,
  // so two runs of the same world still play out differently. Anything that must be reproducible uses C.RNG(seed) instead.
  C.rnd = C.RNG((Date.now() ^ 0x5bd1e995) >>> 0);   // gameplay randomness (not seeded)

  // Small math helpers used everywhere: clamp to a range, linear interpolation, distance, a string hash (FNV-1a) that turns
  // names like 'sierra' into stable seeds, the sign of a number, and thousands-separated formatting.
  C.clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
  C.lerp = (a, b, t) => a + (b - a) * t;
  C.dist = (ax, ay, bx, by) => Math.hypot(bx - ax, by - ay);
  C.hashStr = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
  C.sign = (v) => (v > 0 ? 1 : v < 0 ? -1 : 0);
  C.fmt = (n) => Math.round(n).toLocaleString('en-US');

  // Colours are plain [r,g,b] arrays (0..255). mix blends two colours, rgb renders a CSS string, shade scales brightness.
  // colours: [r,g,b] arrays 0..255
  C.mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  C.rgb = (c, a) => (a === undefined || a === 1) ? `rgb(${c[0] | 0},${c[1] | 0},${c[2] | 0})` : `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;
  C.shade = (c, k) => [C.clamp(c[0] * k, 0, 255), C.clamp(c[1] * k, 0, 255), C.clamp(c[2] * k, 0, 255)];

  // LOYALTY COLOUR — the game's core legibility trick.
  // stance runs −100 (committed Batista) … +100 (committed rebel); conviction 0..100 says how firmly it is held.
  // The colour fades from white (neutral) toward red or blue; weakly held loyalties stay pale. A glance at a crowd shows who is where.
  // Loyalty colour. stance -100(Batista)..+100(Rebel); conviction 0..100 => saturation.
  // White = neutral; deep red = committed rebel; deep blue = committed Batista loyalist.
  const WHITE = [244, 240, 232], RED = [214, 40, 40], BLUE = [38, 82, 205];
  C.loyaltyColor = function (stance, conviction) {
    const mag = Math.min(1, Math.abs(stance) / 100);
    const conv = 0.35 + 0.65 * Math.min(1, conviction / 100);   // weakly held -> paler
    const t = Math.min(1, mag * (0.55 + 0.45 * conv) * 1.05);
    return C.mix(WHITE, stance >= 0 ? RED : BLUE, t);
  };
  C.COLORS = { WHITE, RED, BLUE };

  // Value noise (smoothed random lattice) used to shape terrain: forests, hills, shorelines. makeNoise(seed) returns noise(x,y) in [0,1].
  // A 256×256 random grid is bilinearly interpolated with a smoothstep curve, so neighbouring samples vary smoothly.
  // Cheap value noise for terrain
  C.makeNoise = function (seed) {
    const r = C.RNG(seed), N = 256, g = new Float32Array(N * N);
    for (let i = 0; i < g.length; i++) g[i] = r();
    const at = (x, y) => g[((y & 255) << 8) | (x & 255)];
    const sm = (t) => t * t * (3 - 2 * t);
    return function (x, y) {
      const xi = Math.floor(x), yi = Math.floor(y), xf = sm(x - xi), yf = sm(y - yi);
      const a = at(xi, yi), b = at(xi + 1, yi), c = at(xi, yi + 1), d = at(xi + 1, yi + 1);
      return (a + (b - a) * xf) + ((c + (d - c) * xf) - (a + (b - a) * xf)) * yf;
    };
  };

  // Binary min-heap used by the pathfinder (scene.js findPath). push(item, priority) / pop() returns the lowest-priority item.
  // clear() empties it so a pooled instance can be reused between searches without reallocating.
  // Binary heap for A*
  C.Heap = class {
    constructor() { this.a = []; }
    get size() { return this.a.length; }
    clear() { this.a.length = 0; }
    push(item, pri) {
      const a = this.a; a.push([pri, item]); let i = a.length - 1;
      while (i > 0) { const p = (i - 1) >> 1; if (a[p][0] <= a[i][0]) break; [a[p], a[i]] = [a[i], a[p]]; i = p; }
    }
    pop() {
      const a = this.a; const top = a[0]; const last = a.pop();
      if (a.length) {
        a[0] = last; let i = 0;
        for (;;) {
          let l = 2 * i + 1, r = l + 1, m = i;
          if (l < a.length && a[l][0] < a[m][0]) m = l;
          if (r < a.length && a[r][0] < a[m][0]) m = r;
          if (m === i) break; [a[m], a[i]] = [a[i], a[m]]; i = m;
        }
      }
      return top[1];
    }
  };
})();
