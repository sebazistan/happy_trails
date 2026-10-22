/* CUBEA — util.js : seeded RNG, math, colour helpers. Classic script (works from file://). */
(function () {
  'use strict';
  const C = (window.C = window.C || {});

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
  C.rnd = C.RNG((Date.now() ^ 0x5bd1e995) >>> 0);   // gameplay randomness (not seeded)

  C.clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
  C.lerp = (a, b, t) => a + (b - a) * t;
  C.dist = (ax, ay, bx, by) => Math.hypot(bx - ax, by - ay);
  C.hashStr = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
  C.sign = (v) => (v > 0 ? 1 : v < 0 ? -1 : 0);
  C.fmt = (n) => Math.round(n).toLocaleString('en-US');

  // colours: [r,g,b] arrays 0..255
  C.mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  C.rgb = (c, a) => (a === undefined || a === 1) ? `rgb(${c[0] | 0},${c[1] | 0},${c[2] | 0})` : `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;
  C.shade = (c, k) => [C.clamp(c[0] * k, 0, 255), C.clamp(c[1] * k, 0, 255), C.clamp(c[2] * k, 0, 255)];

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

  // Binary heap for A*
  C.Heap = class {
    constructor() { this.a = []; }
    get size() { return this.a.length; }
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
