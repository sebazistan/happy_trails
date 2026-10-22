// Fog of war. The army's movements are hidden unless a rebel can actually see them (range, daylight,
// weather, line of sight, camouflage). Seen ground is remembered but dimmed; unseen shots leave a "ping".
(function () {
  const C = window.C, G = () => C.G, T = C.T, clamp = C.clamp;
  C.fogOn = () => { const g = G(); return !!(g && g.opts && g.opts.fog && !g.over && g.scene); };

  // base sight radius for drawing and for "can I see this point"
  function sightR(v) {
    const g = G(); const dark = g.hour < 5 || g.hour >= 20 ? 0.5 : (g.hour < 7 || g.hour >= 18 ? 0.78 : 1);
    return 200 * dark * (1 - g.weather.rain * 0.25) * (1 - g.weather.fog * 0.35) * (v && v.watching ? 1.5 : 1) * (v && v.p ? 0.85 + 0.3 * clamp(v.p.exp / 60, 0, 1) : 1);
  }
  C.sightR = sightR;

  function ensure(s) {
    if (!s.exploreCv) { s.exploreCv = document.createElement('canvas'); s.exploreCv.width = s.tw; s.exploreCv.height = s.th; s.exploreCtx = s.exploreCv.getContext('2d'); s.exploreCtx.fillStyle = '#fff'; s.explored = new Uint8Array(s.tw * s.th); }
    if (!s.pings) s.pings = [];
  }

  C.fogUpdate = function (s, dt) {
    if (!C.fogOn()) return; ensure(s);
    const g = G();
    for (const p of s.pings) p.t -= dt; s.pings = s.pings.filter((p) => p.t > 0);
    s.fogT = (s.fogT || 0) - dt; if (s.fogT > 0) return; s.fogT = 0.2;
    const vs = s.viewers = s.actors.filter((a) => (a.isPlayer || a.side === 'rebel') && !a.dead && !a.gone && !a.inside);
    // remembered ground
    const ex = s.exploreCtx;
    for (const v of vs) {
      if (v.fogX !== undefined && Math.hypot(v.x - v.fogX, v.y - v.fogY) < 5) continue; v.fogX = v.x; v.fogY = v.y;
      const r = sightR(v) / T; ex.beginPath(); ex.arc(v.x / T, v.y / T, r, 0, 6.3); ex.fill();
    }
    // who is seen right now
    for (const a of s.actors) {
      if (a.side !== 'army' || a.dead || a.gone) continue;
      let seen = false;
      for (const v of vs) {
        const d = Math.hypot(a.x - v.x, a.y - v.y); if (d > 330) continue;
        const range = (d < 30) ? 999 : C.detectRange(v, a, s) * (v.watching ? 1.5 : 1);
        if (d > range) continue;
        if (d < 36 || C.losOpacity(s, v.x, v.y, a.x, a.y) < 0.9) { seen = true; break; }
      }
      if (seen) { if (!(a.visT > g.time - 0.45)) { /* newly seen */ } a.visT = g.time; a.lastSeen = { x: a.x, y: a.y, t: g.time }; a.seenEver = g.time; }
    }
  };

  C.visible = function (a) {
    if (!C.fogOn() || a.side !== 'army' || a.isPlayer) return true;
    return (a.visT || -9) > G().time - 0.45;
  };
  C.pointSeen = function (x, y) {
    if (!C.fogOn()) return true; const s = G().scene; if (!s.viewers) return true;
    for (const v of s.viewers) { const r = sightR(v) * 0.95; if (Math.abs(v.x - x) < r && Math.abs(v.y - y) < r && Math.hypot(v.x - x, v.y - y) < r) return true; }
    return false;
  };
  C.explored = function (x, y) { const s = G().scene; if (!C.fogOn() || !s.explored) return true; const tx = Math.floor(x / T), ty = Math.floor(y / T); if (tx < 0 || ty < 0 || tx >= s.tw || ty >= s.th) return false; return s.exploreCtx.getImageData(tx, ty, 1, 1).data[3] > 100; };
  C.vehVisible = function (v) { if (!C.fogOn()) return true; if (v === G().vehicle) return true; return C.pointSeen(v.x, v.y); };

  // gunshots you cannot see leave a ping
  const tf = C.tryFire;
  C.tryFire = function (s, a) {
    const before = a.weapon ? a.weapon.mag : 0; const r = tf.apply(this, arguments);
    if (C.fogOn() && a.side === 'army' && a.weapon && a.weapon.mag < before && !C.visible(a)) {
      ensure(s); if (!(a.pingT > G().time - 0.7)) { a.pingT = G().time; const big = C.WEAPONS[a.weapon.k].rof >= 3; s.pings.push({ x: a.x + (Math.random() - 0.5) * 36, y: a.y + (Math.random() - 0.5) * 36, t: big ? 2.4 : 1.7, T0: big ? 2.4 : 1.7, big }); }
    }
    return r;
  };

  // overlay: dark where unexplored, dim where remembered, clear where seen now
  C.drawFog = function (ctx, s, g, W, H, dpr) {
    if (!C.fogOn()) return; ensure(s);
    const R = C.R; if (!R.fogCv) R.fogCv = document.createElement('canvas');
    const cv = R.fogCv; if (cv.width !== W * dpr || cv.height !== H * dpr) { cv.width = W * dpr; cv.height = H * dpr; }
    const f = cv.getContext('2d'); f.setTransform(1, 0, 0, 1, 0, 0); f.globalCompositeOperation = 'source-over'; f.clearRect(0, 0, cv.width, cv.height);
    f.fillStyle = 'rgba(6,9,12,.80)'; f.fillRect(0, 0, cv.width, cv.height);
    const z = g.cam.z, k = dpr * z, ox = dpr * (-g.cam.x * z + W / 2), oy = dpr * (-g.cam.y * z + H / 2);
    f.globalCompositeOperation = 'destination-out'; f.imageSmoothingEnabled = true;
    f.globalAlpha = 0.62; f.drawImage(s.exploreCv, 0, 0, s.tw, s.th, ox, oy, s.tw * T * k, s.th * T * k); f.globalAlpha = 1;
    for (const v of (s.viewers || [])) {
      const x = ox + v.x * k, y = oy + v.y * k, r = sightR(v) * k; if (x < -r || y < -r || x > cv.width + r || y > cv.height + r) continue;
      const gr = f.createRadialGradient(x, y, r * 0.35, x, y, r); gr.addColorStop(0, 'rgba(0,0,0,1)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
      f.fillStyle = gr; f.beginPath(); f.arc(x, y, r, 0, 6.3); f.fill();
    }
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(cv, 0, 0); ctx.restore();
    // last-known ghosts and pings (world space)
    ctx.save(); ctx.setTransform(k, 0, 0, k, ox, oy);
    for (const a of s.actors) {
      if (a.side !== 'army' || a.dead || a.inside || !a.lastSeen || C.visible(a)) continue; const age = g.time - a.lastSeen.t; if (age > 12) continue;
      ctx.globalAlpha = 0.45 * (1 - age / 12); ctx.strokeStyle = '#8fb0ff'; ctx.lineWidth = 1; ctx.setLineDash([2, 2]); ctx.strokeRect(a.lastSeen.x - 5, a.lastSeen.y - 12, 10, 12); ctx.setLineDash([]);
      ctx.fillStyle = '#8fb0ff'; ctx.font = '7px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('?', a.lastSeen.x, a.lastSeen.y - 3);
    }
    for (const p of (s.pings || [])) {
      const u = 1 - p.t / p.T0; ctx.globalAlpha = Math.max(0, 0.8 * (1 - u)); ctx.strokeStyle = p.big ? '#ff7a5a' : '#ffc27a'; ctx.lineWidth = p.big ? 2 : 1.2;
      ctx.beginPath(); ctx.arc(p.x, p.y, 6 + u * (p.big ? 38 : 24), 0, 6.3); ctx.stroke();
    }
    ctx.restore();
  };
})();
