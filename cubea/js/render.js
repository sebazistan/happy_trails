/* CUBEA — render.js : canvas drawing. Cubes with faces, limbs, cracks and missing chunks; vehicles; buildings; effects. */
(function () {
  'use strict';
  const C = (window.C = window.C || {});
  const T = C.T, TL = C.TILE;
  const PS = 2;                                   // prerender scale
  const INK = 'rgb(38,30,28)';
  const FONT = '"Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';

  // ---------- terrain palette ----------
  function tileColor(t, v) {
    const k = (v - 128) / 128;               // -1..1
    switch (t) {
      case TL.G: return [120 + k * 9, 152 + k * 9, 84 + k * 6];
      case TL.FOR: return [66 + k * 6, 100 + k * 8, 56 + k * 5];
      case TL.ROAD: return [182 + k * 7, 156 + k * 7, 116 + k * 6];
      case TL.PAVED: return [136 + k * 5, 136 + k * 5, 140 + k * 5];
      case TL.PLAZA: return [206 + k * 6, 192 + k * 6, 160 + k * 5];
      case TL.TRAIL: return [156 + k * 7, 132 + k * 6, 96 + k * 5];
      case TL.SAND: return [230 + k * 5, 212 + k * 5, 160 + k * 5];
      case TL.DEEP: return [40 + k * 4, 96 + k * 5, 150 + k * 6];
      case TL.SHAL: return [96 + k * 5, 156 + k * 5, 184 + k * 5];
      case TL.CANE: return [150 + k * 8, 164 + k * 8, 66 + k * 5];
      case TL.ROCK: return [122 + k * 8, 116 + k * 8, 108 + k * 8];
      case TL.FENCE: return [120 + k * 9, 152 + k * 9, 84 + k * 6];
      case TL.PIER: return [150 + k * 6, 118 + k * 6, 82 + k * 5];
      case TL.BLD: return [150, 140, 120];
      default: return [120, 150, 84];
    }
  }
  const rgb = (c) => `rgb(${c[0] | 0},${c[1] | 0},${c[2] | 0})`;

  // ---------- prerender of the static scene ----------
  C.prerender = function (s) {
    const W = s.tw * T * PS, H = s.th * T * PS;
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H; const c = cv.getContext('2d');
    const cn = document.createElement('canvas'); cn.width = W; cn.height = H; const cc = cn.getContext('2d');
    c.scale(PS, PS); cc.scale(PS, PS);
    const R = C.RNG(C.hashStr(s.sid) + 9);
    const tw = s.tw;
    for (let y = 0; y < s.th; y++) for (let x = 0; x < tw; x++) {
      const t = s.tiles[y * tw + x], v = s.var[y * tw + x];
      c.fillStyle = rgb(tileColor(t === TL.BLD ? TL.G : t, v)); c.fillRect(x * T, y * T, T + 0.5, T + 0.5);
      const px = x * T, py = y * T;
      if (t === TL.CANE) { // stalk rows
        c.strokeStyle = 'rgba(70,110,30,.55)'; c.lineWidth = 1;
        for (let i = 0; i < 4; i++) { c.beginPath(); c.moveTo(px + 2 + i * 4, py + 1); c.lineTo(px + 2 + i * 4 + (v & 1 ? 1 : -1), py + T - 1); c.stroke(); }
        c.fillStyle = 'rgba(235,225,120,.35)'; for (let i = 0; i < 3; i++) c.fillRect(px + 1 + ((v >> (i + 1)) & 7) * 1.7, py + 2 + i * 4, 2, 5);
      } else if (t === TL.ROCK) {
        c.fillStyle = 'rgba(70,64,58,.45)'; c.beginPath(); c.moveTo(px + 2, py + T - 2); c.lineTo(px + 8, py + 2 + (v & 3)); c.lineTo(px + T - 2, py + T - 3); c.closePath(); c.fill();
        c.fillStyle = 'rgba(210,205,195,.25)'; c.beginPath(); c.moveTo(px + 8, py + 2 + (v & 3)); c.lineTo(px + T - 2, py + T - 3); c.lineTo(px + 10, py + 10); c.closePath(); c.fill();
      } else if (t === TL.DEEP) {
        c.strokeStyle = 'rgba(190,225,245,.22)'; c.lineWidth = 0.8; c.beginPath(); const o = (v % 7); c.moveTo(px + 2, py + 4 + o); c.quadraticCurveTo(px + 6, py + 1 + o, px + 10, py + 4 + o); c.stroke();
      } else if (t === TL.SHAL) {
        c.strokeStyle = 'rgba(230,245,255,.28)'; c.lineWidth = 0.7; c.beginPath(); c.moveTo(px + 3, py + 8); c.lineTo(px + 8, py + 8); c.stroke();
      } else if (t === TL.PLAZA) {
        c.strokeStyle = 'rgba(120,100,80,.25)'; c.lineWidth = 0.6; c.strokeRect(px + 0.5, py + 0.5, T - 1, T - 1);
      } else if (t === TL.PAVED) {
        c.fillStyle = 'rgba(0,0,0,.05)'; if (v & 8) c.fillRect(px, py, T, 1);
      } else if (t === TL.PIER) {
        c.strokeStyle = 'rgba(70,45,25,.5)'; c.lineWidth = 0.8; for (let i = 0; i < 4; i++) { c.beginPath(); c.moveTo(px, py + i * 4 + 2); c.lineTo(px + T, py + i * 4 + 2); c.stroke(); }
      } else if (t === TL.FENCE) {
        c.strokeStyle = 'rgb(96,70,44)'; c.lineWidth = 1.4; c.beginPath(); c.moveTo(px, py + 9); c.lineTo(px + T, py + 9); c.stroke(); c.lineWidth = 1.8;
        c.beginPath(); c.moveTo(px + 2, py + 5); c.lineTo(px + 2, py + 13); c.moveTo(px + 10, py + 5); c.lineTo(px + 10, py + 13); c.stroke();
      } else if (t === TL.G && (v & 15) === 3) {
        c.fillStyle = 'rgba(60,110,40,.4)'; c.fillRect(px + 5, py + 6, 1.5, 3); c.fillRect(px + 8, py + 5, 1.5, 3);
      } else if (t === TL.FOR) { // foliage blobs on floor (and canopy)
        for (let i = 0; i < 4; i++) {
          const bx = px + R() * T, by = py + R() * T, r = 4 + R() * 4, shade = 0.78 + R() * 0.45;
          const col = `rgba(${(46 * shade) | 0},${(98 * shade) | 0},${(44 * shade) | 0},.95)`;
          c.fillStyle = col; c.beginPath(); c.arc(bx, by, r, 0, 6.3); c.fill();
          cc.fillStyle = col; cc.beginPath(); cc.arc(bx, by, r, 0, 6.3); cc.fill();
        }
      }
    }
    // buildings
    for (const b of s.blds) drawBuildingStatic(c, b);
    // props
    for (const p of s.props) drawPropStatic(c, cc, p, R);
    return { cv, cn };
  };

  function drawBuildingStatic(c, b) {
    const x = b.x * T, y = b.y * T, w = b.w * T, h = b.h * T;
    if (b.key === 'pad') {
      c.save(); c.strokeStyle = 'rgba(255,255,255,.55)'; c.setLineDash([3, 3]); c.lineWidth = 1; c.strokeRect(x + 1, y + 1, w - 2, h - 2); c.fillStyle = 'rgba(255,255,255,.08)'; c.fillRect(x, y, w, h); c.restore(); return;
    }
    if (b.key === 'muelle') return;
    if (b.key === 'cementerio') {
      c.fillStyle = 'rgba(190,195,185,.5)'; c.fillRect(x, y, w, h); c.strokeStyle = 'rgba(90,90,90,.7)'; c.strokeRect(x + .5, y + .5, w - 1, h - 1);
      c.fillStyle = 'rgba(235,235,230,.95)'; for (let i = 0; i < 12; i++) { const cx = x + 6 + (i % 6) * 15, cy = y + 8 + Math.floor(i / 6) * 22; c.fillRect(cx, cy, 2, 7); c.fillRect(cx - 2, cy + 2, 6, 1.6); } return;
    }
    // shadow
    c.fillStyle = 'rgba(0,0,0,.22)'; c.fillRect(x + 3, y + 4, w, h);
    const roofH = Math.max(7, h * 0.46);
    c.fillStyle = rgb(b.fill); c.fillRect(x, y, w, h);
    c.fillStyle = rgb(b.roof); c.fillRect(x - 1, y - 2, w + 2, roofH);
    c.fillStyle = 'rgba(0,0,0,.22)'; c.fillRect(x - 1, y - 2 + roofH, w + 2, 2);
    c.fillStyle = 'rgba(255,255,255,.14)'; c.fillRect(x - 1, y - 2, w + 2, 2);
    c.strokeStyle = 'rgba(40,30,25,.65)'; c.lineWidth = 1; c.strokeRect(x - .5, y - 2.5, w + 1, h + 2);
    // windows
    c.fillStyle = 'rgba(60,80,100,.55)';
    const nwin = Math.max(1, Math.floor(w / 18));
    for (let i = 0; i < nwin; i++) c.fillRect(x + (i + 0.5) * (w / nwin) - 2.2, y + roofH + 1.5, 4.4, Math.min(5, h - roofH - 4));
    // door
    c.fillStyle = 'rgb(70,46,30)'; c.fillRect(x + w / 2 - 3, y + h - 7, 6, 7);
    if (b.tag === 'church') { c.fillStyle = 'rgb(235,225,200)'; c.fillRect(x + w / 2 - 1, y - 9, 2, 8); c.fillRect(x + w / 2 - 3.5, y - 7, 7, 2); }
    if (b.tag === 'army') { c.fillStyle = 'rgb(200,50,50)'; c.fillRect(x + 3, y - 2, 6, 4); }
    if (b.key === 'iglesia' || b.key === 'catedral') { c.fillStyle = 'rgb(210,200,175)'; c.fillRect(x + w - 10, y - 12, 8, 14); }
  }
  function drawPropStatic(c, cc, p, R) {
    const x = p.x, y = p.y;
    switch (p.k) {
      case 'tree': case 'ceiba': case 'palm': {
        const r = p.k === 'ceiba' ? 15 : p.k === 'palm' ? 11 : 10;
        c.fillStyle = 'rgba(0,0,0,.2)'; c.beginPath(); c.ellipse(x + 2, y + 3, r * 0.8, r * 0.45, 0, 0, 6.3); c.fill();
        c.fillStyle = 'rgb(90,64,40)'; c.fillRect(x - 1.5, y - 2, 3, 6);
        const crown = (g) => {
          if (p.k === 'palm') { g.strokeStyle = 'rgb(48,120,50)'; g.lineWidth = 2.6; g.lineCap = 'round'; for (let i = 0; i < 7; i++) { const a = i * 0.9 + (x % 3); g.beginPath(); g.moveTo(x, y - 5); g.quadraticCurveTo(x + Math.cos(a) * r * 0.6, y - 9 + Math.sin(a) * r * 0.3, x + Math.cos(a) * r, y - 4 + Math.sin(a) * r * 0.7); g.stroke(); } }
          else { g.fillStyle = p.k === 'ceiba' ? 'rgb(46,112,50)' : 'rgb(56,122,52)'; g.beginPath(); g.arc(x, y - 6, r, 0, 6.3); g.fill(); g.fillStyle = 'rgba(255,255,255,.1)'; g.beginPath(); g.arc(x - r * 0.3, y - 6 - r * 0.3, r * 0.55, 0, 6.3); g.fill(); g.fillStyle = 'rgba(0,0,0,.12)'; g.beginPath(); g.arc(x + r * 0.35, y - 3, r * 0.5, 0, 6.3); g.fill(); }
        };
        crown(c); crown(cc); break;
      }
      case 'well': c.fillStyle = 'rgb(130,128,120)'; c.beginPath(); c.arc(x, y, 6, 0, 6.3); c.fill(); c.fillStyle = 'rgb(40,90,130)'; c.beginPath(); c.arc(x, y, 3.6, 0, 6.3); c.fill(); break;
      case 'fountain': c.fillStyle = 'rgb(150,150,150)'; c.beginPath(); c.arc(x, y, 9, 0, 6.3); c.fill(); c.fillStyle = 'rgb(90,160,200)'; c.beginPath(); c.arc(x, y, 6.5, 0, 6.3); c.fill(); break;
      case 'carbonera': c.fillStyle = 'rgb(60,50,44)'; c.beginPath(); c.ellipse(x, y, 11, 8, 0, 0, 6.3); c.fill(); c.fillStyle = 'rgb(110,84,60)'; c.beginPath(); c.ellipse(x, y - 2, 8, 5, 0, 0, 6.3); c.fill(); break;
      case 'flag': c.strokeStyle = 'rgb(80,60,40)'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(x, y + 6); c.lineTo(x, y - 14); c.stroke(); c.fillStyle = 'rgb(60,90,200)'; c.fillRect(x, y - 14, 10, 6); c.fillStyle = '#fff'; c.fillRect(x, y - 11, 10, 2); break;
      default: break;
    }
  }

  // ---------- helpers ----------
  const clamp = C.clamp;
  function roundRect(c, x, y, w, h, r) { c.beginPath(); c.moveTo(x + r, y); c.lineTo(x + w - r, y); c.quadraticCurveTo(x + w, y, x + w, y + r); c.lineTo(x + w, y + h - r); c.quadraticCurveTo(x + w, y + h, x + w - r, y + h); c.lineTo(x + r, y + h); c.quadraticCurveTo(x, y + h, x, y + h - r); c.lineTo(x, y + r); c.quadraticCurveTo(x, y, x + r, y); c.closePath(); }
  const NOTCH = [[0, 0], [1, 0], [1, 1], [0, 1], [0.5, 0], [1, 0.5], [0.5, 1], [0, 0.5]];

  // ---------- expression model ----------
  C.expressionTargets = function (a) {
    const p = a.p, n = p.needs;
    const hunger = (100 - n.food) / 100, thirst = (100 - n.water) / 100, tired = (100 - n.energy) / 100;
    const fear = clamp((p.fear + a.panic * 40) / 100, 0, 1), anger = clamp(p.anger / 100, 0, 1), stress = clamp(p.stress / 100, 0, 1);
    const pain = clamp(a.pain, 0, 1), hope = (n.hope - 50) / 50;
    const conf = clamp(p.exp / 100 * 0.75 + (p.morale - 50) / 120 + (p.traits.includes('stoic') ? 0.12 : 0) + (p.traits.includes('brave') ? 0.1 : 0) - stress * 0.35 - fear * 0.3, 0, 1);
    const e = { brow: 0, browY: 0, lid: 0, wide: 0, mouth: 0, open: 0, squint: 0, sweat: 0, tear: 0, label: 'sereno' };
    let top = 0.18;
    const cand = [];
    cand.push(['adolorido', pain * 1.4]); cand.push(['temeroso', fear]); cand.push(['furioso', anger]);
    cand.push(['hambriento', hunger > 0.55 ? hunger * 0.9 : 0]); cand.push(['sediento', thirst > 0.6 ? thirst * 0.85 : 0]); cand.push(['agotado', tired > 0.6 ? tired * 0.85 : 0]);
    cand.push(['confiado', conf > 0.55 ? conf * 0.8 : 0]); cand.push(['esperanzado', hope > 0.35 ? hope * 0.6 : 0]); cand.push(['desanimado', hope < -0.35 ? -hope * 0.6 : 0]);
    for (const c of cand) if (c[1] > top) { top = c[1]; e.label = c[0]; }
    // blended features
    e.brow = -anger * 0.9 + fear * 0.8 + stress * 0.2 - conf * 0.25 + pain * 0.5 + (hunger > 0.5 ? 0.25 * hunger : 0);   // + = inner ends up (worry), - = down (anger)
    e.browY = fear * -0.5 + conf * 0.2 + anger * 0.25;
    e.lid = clamp(tired * 0.85 + thirst * 0.3 + (hunger > 0.5 ? hunger * 0.25 : 0) - fear * 0.7, 0, 0.85);
    e.wide = fear * 0.9;
    e.mouth = clamp(hope * 0.6 + conf * 0.45 - anger * 0.8 - fear * 0.4 - hunger * 0.45 - pain * 0.8 - (hope < 0 ? 0.2 : 0), -1, 1);
    e.open = clamp(fear * 0.55 + pain * 0.5 + (a.talking ? 0.4 : 0) + (a.shooting > 0 ? 0.5 : 0), 0, 1);
    e.squint = clamp(pain * 1.2 + (a.shooting > 0 ? 0.5 : 0), 0, 1);
    e.sweat = fear > 0.55 ? 1 : 0; e.tear = (hope < -0.5 && p.stress > 50) ? 1 : 0;
    // individual resting temperament (stable per person)
    const h = (p.id * 2654435761 >>> 0) / 4294967296;
    e.mouth += (h - 0.5) * 0.32; e.brow += ((h * 7.7) % 1 - 0.5) * 0.22;
    return e;
  };
  C.emotionLabel = (a) => (a.expr ? a.expr.label : 'sereno');

  // ---------- cube figure ----------
  function notchRect(ch, bw, bh, inflate) {
    const [nx, ny] = NOTCH[ch.pos], sz = ch.s * Math.min(bw, bh);
    let x0 = -bw / 2 + nx * (bw - sz), y0 = -bh / 2 + ny * (bh - sz), x1 = x0 + sz, y1 = y0 + sz;
    if (inflate) {
      const tl = nx === 0, tr = nx === 1, tt = ny === 0, tb = ny === 1;
      x0 = tl ? x0 - 2 : x0 + 0.75; x1 = tr ? x1 + 2 : x1 - 0.75; y0 = tt ? y0 - 2 : y0 + 0.75; y1 = tb ? y1 + 2 : y1 - 0.75;
    }
    return [x0, y0, x1 - x0, y1 - y0];
  }
  function drawBody(c, a, bw, bh, col, dead) {
    const p = a.p;
    // dark outline base: the body silhouette grown by a hair, with the missing chunks cut out (so the wound edge is outlined too)
    c.save(); c.beginPath(); c.rect(-bw / 2 - 0.75, -bh / 2 - 0.75, bw + 1.5, bh + 1.5); c.clip();
    c.beginPath(); c.rect(-bw / 2 - 0.75, -bh / 2 - 0.75, bw + 1.5, bh + 1.5);
    for (const ch of p.chunks) { const r = notchRect(ch, bw, bh, true); c.rect(r[0], r[1], r[2], r[3]); }
    c.fillStyle = 'rgba(20,14,12,.8)'; c.fill('evenodd'); c.restore();
    c.save();
    c.beginPath(); c.rect(-bw / 2, -bh / 2, bw, bh);
    if (p.chunks.length) { for (const ch of p.chunks) { const r = notchRect(ch, bw, bh, false); c.rect(r[0], r[1], r[2], r[3]); } c.clip('evenodd'); } else c.clip();
    c.fillStyle = rgb(col); c.fillRect(-bw / 2, -bh / 2, bw, bh);
    // cube shading: top light, left light, bottom/right shade
    c.fillStyle = 'rgba(255,255,255,.28)'; c.fillRect(-bw / 2, -bh / 2, bw, 1.8);
    c.fillStyle = 'rgba(255,255,255,.12)'; c.fillRect(-bw / 2, -bh / 2, 1.4, bh);
    c.fillStyle = 'rgba(0,0,0,.18)'; c.fillRect(-bw / 2, bh / 2 - 2, bw, 2); c.fillRect(bw / 2 - 1.5, -bh / 2, 1.5, bh);
    // cracks
    if (p.cracks.length) {
      c.strokeStyle = 'rgba(30,22,20,.78)'; c.lineWidth = 0.7; c.lineCap = 'round';
      for (const k of p.cracks) {
        const al = clamp(k.l, 0.05, 1); if (al <= 0.06) continue;
        c.globalAlpha = clamp(k.l * 1.3, 0.2, 1);
        let x = k.x * bw, y = k.y * bh, ang = k.a; c.beginPath(); c.moveTo(x, y);
        const segs = 3 + (k.n | 0);
        for (let i = 0; i < segs; i++) { ang += ((i % 2) ? 0.7 : -0.7) * (0.4 + ((k.s * (i + 1)) % 1)); x += Math.cos(ang) * bw * 0.16 * al; y += Math.sin(ang) * bh * 0.16 * al; c.lineTo(x, y); }
        c.stroke();
      }
      c.globalAlpha = 1;
    }
    c.restore();
  }

  function drawFace(c, a, bw, bh) {
    const p = a.p, L = p.look, e = a.expr, f = a.face;
    const ex = L.eyeX * bw, ey = (L.eyeY - 0.06) * bh, er = Math.max(0.9, L.eyeR * bw * 1.15);
    c.save(); c.translate(f * 0.5, 0);
    c.fillStyle = INK; c.strokeStyle = INK; c.lineCap = 'round';
    if (a.dead) {
      c.lineWidth = 0.8; for (const sx of [-1, 1]) { const x = sx * ex, y = ey; c.beginPath(); c.moveTo(x - 1.3, y - 1.3); c.lineTo(x + 1.3, y + 1.3); c.moveTo(x + 1.3, y - 1.3); c.lineTo(x - 1.3, y + 1.3); c.stroke(); }
      c.beginPath(); c.moveTo(-1.8, bh * 0.26); c.lineTo(1.8, bh * 0.26); c.stroke(); c.restore(); return;
    }
    const open = 1 - clamp(e.lid + e.squint * 0.6 + a.blink, 0, 0.95);
    const eh = er * (0.8 + e.wide * 0.9) * open;
    for (const sx of [-1, 1]) {
      const x = sx * ex + f * 0.4, y = ey;
      if (e.squint > 0.55) { c.lineWidth = 0.8; c.beginPath(); c.moveTo(x - sx * 1.4, y - 1); c.lineTo(x + sx * 0.3, y); c.lineTo(x - sx * 1.4, y + 1); c.stroke(); }
      else { c.beginPath(); c.ellipse(x, y, er * (0.9 + e.wide * 0.3), Math.max(0.35, eh), 0, 0, 6.3); c.fill(); if (e.wide > 0.5) { c.fillStyle = '#fff'; c.beginPath(); c.arc(x - 0.3, y - 0.3, 0.45, 0, 6.3); c.fill(); c.fillStyle = INK; } }
      // heavy lid line when tired
      if (e.lid > 0.35) { c.lineWidth = 0.7; c.beginPath(); c.moveTo(x - er * 1.2, y - eh * 0.2); c.lineTo(x + er * 1.2, y - eh * 0.2); c.stroke(); }
      // brows: inner end is toward the face centre
      const bl = L.brow * bw * 1.4, tilt = e.brow * bl * 0.55, by = ey - er * 1.6 - 1.4 - e.browY * 1.6 + (e.lid > 0.4 ? 0.5 : 0);
      c.lineWidth = L.browT * 0.55 * (1 + Math.abs(e.brow) * 0.15);
      c.beginPath(); c.moveTo(x - sx * bl * 0.5 + 0, by + tilt * 0.5 * -1 * -1 * 0.0 + tilt * 0.5); // outer end
      // outer end lower for worry (tilt>0 -> inner up), inner end y = by - tilt
      c.moveTo(x + sx * bl * 0.5, by + tilt * 0.5); c.lineTo(x - sx * bl * 0.5, by - tilt * 0.5); c.stroke();
    }
    // nose
    if (L.nose) { c.fillStyle = 'rgba(38,30,28,.45)'; c.fillRect(f * 0.5 - 0.5, ey + er + 0.6, 1, 1.5); c.fillStyle = INK; }
    // mouth
    const my = bh * (L.mouthY - 0.02), mw = L.mouthW * bw * (1 - e.open * 0.3);
    c.lineWidth = 0.85;
    if (e.open > 0.35) { c.beginPath(); c.ellipse(f * 0.5, my + 0.5, mw * 0.32, 0.9 + e.open * 1.3, 0, 0, 6.3); c.fill(); }
    else {
      c.beginPath(); c.moveTo(-mw / 2 + f * 0.4, my + (e.mouth > 0 ? 0 : -e.mouth * 0.3)); c.quadraticCurveTo(f * 0.4, my + e.mouth * 2.4 + 0.8, mw / 2 + f * 0.4, my - (a.smirk ? 0.6 : 0) + (e.mouth > 0 ? 0 : -e.mouth * 0.3)); c.stroke();
    }
    if (L.mustache) { c.fillStyle = rgb(L.hairCol); c.fillRect(-mw * 0.55 + f * 0.4, my - 1.8, mw * 1.1, 1.3); }
    if (L.freckle) { c.fillStyle = 'rgba(120,70,40,.5)'; for (const dx of [-2.6, -1.4, 1.4, 2.6]) c.fillRect(dx, ey + er + 1.5, 0.7, 0.7); }
    if (L.mole) { c.fillStyle = 'rgba(40,24,18,.7)'; c.fillRect(-ex * 1.3, my - 1.5, 0.9, 0.9); }
    if (e.sweat) { c.fillStyle = 'rgba(120,190,240,.9)'; c.beginPath(); c.ellipse(bw / 2 - 1.2, -bh / 2 + 3.2, 0.9, 1.5, 0, 0, 6.3); c.fill(); }
    if (e.tear) { c.fillStyle = 'rgba(120,190,240,.9)'; c.fillRect(ex + 0.6, ey + 1.6, 0.8, 2.2); }
    if (L.glasses) { c.strokeStyle = 'rgba(30,24,22,.85)'; c.lineWidth = 0.6; for (const sx of [-1, 1]) { c.beginPath(); c.arc(sx * ex + f * 0.4, ey, er * 1.9, 0, 6.3); c.stroke(); } c.beginPath(); c.moveTo(-ex + er * 1.9, ey); c.lineTo(ex - er * 1.9, ey); c.stroke(); }
    c.restore();
  }

  function drawHeadgear(c, a, bw, bh) {
    const L = a.p.look, top = -bh / 2;
    // hair band
    if (!L.hat || L.hat === 'collar') {
      c.fillStyle = rgb(L.hairCol);
      if (a.p.sex === 'F') { c.fillRect(-bw / 2 - 0.4, top - 1.2, bw + 0.8, 3.6); if (L.bun) { c.beginPath(); c.arc(0, top - 2.4, 2.1, 0, 6.3); c.fill(); } else { c.fillRect(-bw / 2 - 0.8, top, 1.8, bh * 0.55); c.fillRect(bw / 2 - 1, top, 1.8, bh * 0.55); } if (L.scarf) { c.fillStyle = 'rgb(210,90,90)'; c.fillRect(-bw / 2, top - 1.4, bw, 3); } }
      else if (L.hair === 'wht' || a.p.look.style < 3) { c.fillRect(-bw / 2 + 0.3, top - 0.6, bw - 0.6, 2.4); if (L.style === 1) c.fillRect(-bw / 2 + 1, top - 1.6, bw - 2, 1.4); }
      else { c.fillRect(-bw / 2 + 0.3, top - 0.6, bw - 0.6, 1.6); }
    }
    switch (L.hat) {
      case 'straw': c.fillStyle = 'rgb(224,196,110)'; c.beginPath(); c.ellipse(0, top + 0.5, bw * 0.78, 2.1, 0, 0, 6.3); c.fill(); c.fillStyle = 'rgb(200,168,84)'; c.fillRect(-bw * 0.3, top - 3, bw * 0.6, 3.4); c.fillStyle = 'rgba(90,60,30,.7)'; c.fillRect(-bw * 0.3, top - 0.6, bw * 0.6, 0.8); break;
      case 'cap': c.fillStyle = 'rgb(70,84,60)'; c.fillRect(-bw / 2, top - 2.6, bw, 3.4); c.fillRect(-bw / 2 + (a.face > 0 ? bw * 0.5 : -bw * 0.2), top + 0.3, bw * 0.6, 1.1); c.fillStyle = 'rgb(200,50,40)'; c.fillRect(-0.7, top - 2, 1.4, 1.2); break;
      case 'beret': c.fillStyle = 'rgb(48,52,48)'; c.beginPath(); c.ellipse(a.face * 0.8, top - 0.8, bw * 0.62, 2.7, -0.12 * a.face, 0, 6.3); c.fill(); c.fillStyle = 'rgb(230,200,60)'; c.fillRect(a.face * 1.5 - 0.5, top - 1.6, 1.3, 1.3); break;
      case 'cowboy': c.fillStyle = 'rgb(120,86,52)'; c.beginPath(); c.ellipse(0, top + 0.4, bw * 0.85, 2.3, 0, 0, 6.3); c.fill(); c.fillRect(-bw * 0.32, top - 3.4, bw * 0.64, 3.8); break;
      case 'panama': c.fillStyle = 'rgb(240,232,210)'; c.beginPath(); c.ellipse(0, top + 0.4, bw * 0.7, 1.9, 0, 0, 6.3); c.fill(); c.fillRect(-bw * 0.3, top - 2.6, bw * 0.6, 3); c.fillStyle = 'rgb(40,40,40)'; c.fillRect(-bw * 0.3, top - 0.2, bw * 0.6, 0.8); break;
      case 'helmet': c.fillStyle = 'rgb(84,96,70)'; c.beginPath(); c.ellipse(0, top - 0.2, bw * 0.62, 3.1, 0, Math.PI, 0); c.fill(); c.fillRect(-bw * 0.62, top - 0.2, bw * 1.24, 1.1); break;
      case 'kepi': c.fillStyle = 'rgb(60,80,140)'; c.fillRect(-bw / 2, top - 2.6, bw, 3.2); c.fillRect(-bw / 2 + (a.face > 0 ? bw * 0.5 : -bw * 0.2), top + 0.4, bw * 0.6, 1); c.fillStyle = 'rgb(230,210,90)'; c.fillRect(-0.8, top - 2.1, 1.6, 1.2); break;
      case 'veil': c.fillStyle = 'rgb(30,30,34)'; c.fillRect(-bw / 2 - 0.8, top - 1.6, bw + 1.6, 4); c.fillRect(-bw / 2 - 0.8, top, 1.8, bh * 0.6); c.fillRect(bw / 2 - 1, top, 1.8, bh * 0.6); break;
      case 'collar': c.fillStyle = '#fff'; c.fillRect(-1.6, bh / 2 - 3.4, 3.2, 1.8); break;
      default: break;
    }
    const bl = L.beard ? 1 : (a.p.beardLen || 0);
    if (bl > 0.12) { const top = bh * (0.52 - 0.47 * bl); c.fillStyle = rgb(L.hairCol); c.beginPath(); c.moveTo(-bw / 2 + 0.3, top); c.lineTo(bw / 2 - 0.3, top); c.lineTo(bw / 2 - 0.9, bh / 2 - 0.3); c.lineTo(-bw / 2 + 0.9, bh / 2 - 0.3); c.closePath(); c.globalAlpha = bl < 0.5 ? 0.55 + bl * 0.5 : 0.92; c.fill(); c.globalAlpha = 1; }
  }

  const WLEN = { pistol: 5, revolver: 5, rifle: 13, garand: 13, scoped: 14, thompson: 9, mg: 14, shotgun: 12, machete: 8 };
  function drawActor(c, a, t, z) {
    const p = a.p, L = p.look;
    let bw = 10 * L.sw, bh = 10 * L.sh;
    const dead = a.dead, prone = a.prone && !dead;
    const col = a.drawColor;
    c.save(); c.translate(a.x, a.y);
    // shadow
    c.fillStyle = 'rgba(0,0,0,.26)'; c.beginPath(); c.ellipse(0, 3, bw * 0.6, 2.4, 0, 0, 6.3); c.fill();
    if (dead) { c.translate(0, -bh * 0.1); c.rotate(a.deadRot || 1.5); }
    else {
      const bob = a.moving ? Math.abs(Math.sin(a.anim * 2)) * 1.2 : Math.sin(t * 2 + p.id) * 0.25;
      c.translate(0, -bh / 2 - 4.3 - bob + (prone ? 3 : 0));
      if (prone) c.scale(1.12, 0.78);
    }
    const sw = a.moving ? Math.sin(a.anim * 2) : 0;
    const limb = 'rgb(' + ((col[0] * 0.72) | 0) + ',' + ((col[1] * 0.72) | 0) + ',' + ((col[2] * 0.72) | 0) + ')';
    if (!dead && !prone) {   // legs
      const lh = 4.4 + (p.limp ? -0.6 : 0);
      c.fillStyle = limb;
      c.fillRect(-bw * 0.28 - 1.2, bh / 2 - 0.5 + (sw > 0 ? -sw : 0) * 0.0, 2.5, lh - sw * 1.4);
      c.fillRect(bw * 0.28 - 1.3, bh / 2 - 0.5, 2.5, lh + sw * 1.4);
      c.fillStyle = 'rgb(48,38,34)'; c.fillRect(-bw * 0.28 - 1.5, bh / 2 + lh - 1.2 - sw * 1.4, 3.1, 1.5); c.fillRect(bw * 0.28 - 1.6, bh / 2 + lh - 1.2 + sw * 1.4, 3.1, 1.5);
    }
    // arms (behind body)
    const hasW = a.weapon && a.weaponOut && !dead;
    if (!dead) {
      c.fillStyle = limb;
      const as = a.moving ? Math.sin(a.anim * 2) * 1.5 : 0;
      c.fillRect(-bw / 2 - 2.3, -bh * 0.1 + as, 2.4, 5);
      if (!hasW) c.fillRect(bw / 2 - 0.1, -bh * 0.1 - as, 2.4, 5);
      if (a.p.armHurt) { c.fillStyle = 'rgba(30,20,20,.4)'; c.fillRect(-bw / 2 - 2.3, -bh * 0.1 + as + 3, 2.4, 2); }
    }
    drawBody(c, a, bw, bh, col, dead);
    drawFace(c, a, bw, bh);
    drawHeadgear(c, a, bw, bh);
    if (hasW) {
      const ang = a.aim || 0, wl = WLEN[a.weapon.k] || 10;
      c.save(); c.translate(bw / 2 - 1, -bh * 0.02); c.rotate(ang);
      c.fillStyle = limb; c.fillRect(0, -1.2, 5, 2.4);
      c.strokeStyle = 'rgb(36,30,28)'; c.lineWidth = a.weapon.k === 'mg' ? 2 : 1.4; c.lineCap = 'butt'; c.beginPath(); c.moveTo(-1.5, 0); c.lineTo(wl, 0); c.stroke();
      if (a.weapon.k === 'scoped') { c.strokeStyle = 'rgb(20,20,20)'; c.lineWidth = 1.2; c.beginPath(); c.moveTo(3, -1.6); c.lineTo(8, -1.6); c.stroke(); }
      if (a.muzzle > 0) { c.fillStyle = 'rgba(255,230,140,.95)'; c.beginPath(); c.moveTo(wl, 0); c.lineTo(wl + 5 + Math.random() * 4, -2); c.lineTo(wl + 9 + Math.random() * 5, 0); c.lineTo(wl + 5, 2); c.closePath(); c.fill(); c.fillStyle = 'rgba(255,255,255,.9)'; c.beginPath(); c.arc(wl + 1, 0, 1.6, 0, 6.3); c.fill(); }
      c.restore();
    }
    c.restore();
  }

  C.drawActor = (c, a, t, z) => drawActor(c, a, t, z);
  // the leader: an ordinary cube with a gold star and a ring on the ground (see drawScene)
  // ---------- vehicles ----------
  function drawVehicle(c, v, t) {
    const d = v.def; const w = d.w, h = d.h;
    c.save(); c.translate(v.x, v.y); c.rotate(v.ang);
    c.fillStyle = 'rgba(0,0,0,.25)'; c.fillRect(-w / 2 + 2, -h / 2 + 3, w, h);
    if (d.water) {
      c.fillStyle = 'rgb(240,240,236)'; c.beginPath(); c.moveTo(w / 2, 0); c.lineTo(w / 2 - 8, -h / 2); c.lineTo(-w / 2, -h / 2); c.lineTo(-w / 2, h / 2); c.lineTo(w / 2 - 8, h / 2); c.closePath(); c.fill();
      c.strokeStyle = rgb(d.col); c.lineWidth = 2; c.stroke(); c.fillStyle = 'rgb(150,120,80)'; c.fillRect(-w / 4, -h / 4, w / 3, h / 2);
      if (d.deck) { c.strokeStyle = 'rgba(80,60,40,.5)'; c.lineWidth = 0.7; for (let q = -w / 2 + 4; q < w / 2 - 6; q += 5) { c.beginPath(); c.moveTo(q, -h / 2 + 1); c.lineTo(q, h / 2 - 1); c.stroke(); } if (v.pass.length) { c.fillStyle = 'rgba(200,60,50,.9)'; for (let q = 0; q < Math.min(40, v.pass.length + 1); q++) c.fillRect(-w / 2 + 4 + (q % 12) * 4.4, -h / 2 + 3 + Math.floor(q / 12) * 4.5, 3, 3); } }
    } else if (v.type === 'oxcart') {
      c.fillStyle = 'rgb(150,112,72)'; c.fillRect(-w / 2, -h / 2, w * 0.7, h); c.strokeStyle = 'rgb(70,48,30)'; c.lineWidth = 1; c.strokeRect(-w / 2, -h / 2, w * 0.7, h);
      c.fillStyle = 'rgb(60,40,28)'; c.fillRect(-w / 2 + 3, -h / 2 - 2, 4, 3); c.fillRect(-w / 2 + 3, h / 2 - 1, 4, 3);
      c.fillStyle = 'rgb(120,86,56)'; c.fillRect(w * 0.2, -3, 14, 6);                                         // yoke / oxen
      c.fillStyle = 'rgb(200,190,170)'; c.fillRect(w * 0.45, -h / 2 + 1, 8, 5); c.fillRect(w * 0.45, h / 2 - 6, 8, 5);
    } else {
      const col = v.wreck ? [50, 46, 44] : d.col;
      c.fillStyle = rgb(col); roundRect(c, -w / 2, -h / 2, w, h, 3); c.fill();
      c.strokeStyle = 'rgba(20,16,14,.8)'; c.lineWidth = 0.9; c.stroke();
      if (!v.wreck) {
        c.fillStyle = 'rgba(190,225,240,.85)'; c.fillRect(w * 0.08, -h / 2 + 1.5, w * 0.2, h - 3); c.fillStyle = 'rgba(0,0,0,.18)'; c.fillRect(-w / 2 + 2, -h / 2 + 1.5, w * 0.35, h - 3);
        if (v.type === 'truck' || v.type === 'armytruck') { c.fillStyle = 'rgba(0,0,0,.2)'; c.fillRect(-w / 2 + 2, -h / 2 + 2, w * 0.5, h - 4); }
        if (v.type === 'bus') { c.fillStyle = 'rgba(190,225,240,.85)'; for (let i = 0; i < 5; i++) c.fillRect(-w / 2 + 4 + i * 7, -h / 2 + 0.6, 4.5, 2); }
        c.fillStyle = 'rgba(255,240,170,.95)'; if (v.lights) c.fillRect(w / 2 - 1.6, -h / 2 + 1.5, 2, 2.4), c.fillRect(w / 2 - 1.6, h / 2 - 3.9, 2, 2.4);
        if (d.army) { c.fillStyle = 'rgb(230,230,230)'; c.fillRect(-2, -1, 4, 2); }
      } else { c.fillStyle = 'rgba(0,0,0,.3)'; c.fillRect(-w / 3, -h / 3, w / 2, h / 2); }
      // wheels
      if (d.wheels) {
        for (let i = 0; i < 4; i++) {
          const wx = (i % 2 ? 1 : -1) * w * 0.32, wy = (i < 2 ? -1 : 1) * (h / 2 + 0.5);
          const flat = v.tires[i] <= 0.15;
          c.fillStyle = flat ? 'rgb(90,40,40)' : 'rgb(24,22,22)'; c.fillRect(wx - 2.6, wy - (flat ? 1.1 : 1.8), 5.2, flat ? 2.2 : 3.6);
        }
      }
    }
    c.restore();
    // damage smoke/fire handled in main particles
  }

  // ---------- main draw ----------
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  C.R = { canvas: null, ctx: null, W: 0, H: 0 };
  C.initRender = function (canvas) {
    C.R.canvas = canvas; C.R.ctx = canvas.getContext('2d');
    const resize = () => { const w = window.innerWidth, h = window.innerHeight; canvas.width = w * dpr; canvas.height = h * dpr; canvas.style.width = w + 'px'; canvas.style.height = h + 'px'; C.R.W = w; C.R.H = h; };
    window.addEventListener('resize', resize); resize();
  };
  C.toScreen = (cam, x, y) => ({ x: (x - cam.x) * cam.z + C.R.W / 2, y: (y - cam.y) * cam.z + C.R.H / 2 });
  C.toWorld = (cam, sx, sy) => ({ x: (sx - C.R.W / 2) / cam.z + cam.x, y: (sy - C.R.H / 2) / cam.z + cam.y });

  function outlinedText(ctx, txt, x, y, size, fill, bold, stroke) {
    ctx.font = (bold ? '600 ' : '') + size + 'px ' + FONT; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.lineWidth = Math.max(2, size * 0.28); ctx.strokeStyle = stroke || 'rgba(12,10,8,.78)'; ctx.lineJoin = 'round'; ctx.strokeText(txt, x, y);
    ctx.fillStyle = fill; ctx.fillText(txt, x, y);
  }
  C.outlinedText = outlinedText;

  C.drawScene = function (s, G, t) {
    const ctx = C.R.ctx, W = C.R.W, H = C.R.H, cam = G.cam;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#1b2418'; ctx.fillRect(0, 0, W, H);
    if (!s.pre) s.pre = C.prerender(s);
    const z = cam.z;
    const shx = G.shake > 0 ? (Math.random() - 0.5) * G.shake * 6 : 0, shy = G.shake > 0 ? (Math.random() - 0.5) * G.shake * 6 : 0;
    // static ground
    ctx.save(); ctx.setTransform(dpr * z, 0, 0, dpr * z, dpr * (-cam.x * z + W / 2 + shx), dpr * (-cam.y * z + H / 2 + shy));
    ctx.imageSmoothingEnabled = true;
    const vx0 = cam.x - W / 2 / z - 8, vy0 = cam.y - H / 2 / z - 8, vw = W / z + 16, vh = H / z + 16;
    const sx0 = Math.max(0, vx0), sy0 = Math.max(0, vy0), sw = Math.min(s.tw * T - sx0, vw), sh = Math.min(s.th * T - sy0, vh);
    if (sw > 0 && sh > 0) ctx.drawImage(s.pre.cv, sx0 * PS, sy0 * PS, sw * PS, sh * PS, sx0, sy0, sw, sh);
    const vis = (x, y, r) => x > vx0 - r && x < vx0 + vw + r && y > vy0 - r && y < vy0 + vh + r;
    if (s.type === 'coast') drawWaves(ctx, s, t, vx0, vy0, vw, vh);
    // decals: craters, scorch, blood
    for (const d of s.decals) if (vis(d.x, d.y, d.r)) {
      ctx.globalAlpha = d.a * (d.fade ? Math.max(0.15, 1 - (G.time - d.t0) / d.fade) : 1);
      if (d.k === 'blood') { ctx.fillStyle = 'rgb(110,28,24)'; ctx.beginPath(); ctx.ellipse(d.x, d.y, d.r, d.r * 0.7, d.rot, 0, 6.3); ctx.fill(); }
      else if (d.k === 'crater') { ctx.fillStyle = 'rgb(56,44,34)'; ctx.beginPath(); ctx.ellipse(d.x, d.y, d.r, d.r * 0.8, 0, 0, 6.3); ctx.fill(); ctx.fillStyle = 'rgb(88,70,52)'; ctx.beginPath(); ctx.ellipse(d.x, d.y - 1, d.r * 0.7, d.r * 0.55, 0, 0, 6.3); ctx.fill(); }
      else if (d.k === 'foxhole') { ctx.fillStyle = 'rgb(86,66,46)'; ctx.beginPath(); ctx.ellipse(d.x, d.y + 1, d.r + 1.5, (d.r + 1.5) * 0.7, 0, 0, 6.3); ctx.fill(); ctx.fillStyle = 'rgb(34,26,20)'; ctx.beginPath(); ctx.ellipse(d.x, d.y + 1, d.r - 1, (d.r - 1) * 0.65, 0, 0, 6.3); ctx.fill(); }
      else if (d.k === 'latrine') { ctx.fillStyle = 'rgb(60,48,36)'; ctx.fillRect(d.x - 3, d.y - 2, 6, 5); ctx.fillStyle = 'rgb(120,100,70)'; ctx.fillRect(d.x - 4, d.y - 3, 8, 1.5); }
      else if (d.k === 'scorch') { ctx.fillStyle = 'rgb(30,26,24)'; ctx.beginPath(); ctx.ellipse(d.x, d.y, d.r, d.r * 0.8, 0, 0, 6.3); ctx.fill(); }
      ctx.globalAlpha = 1;
    }
    // sabotage objects & dynamic props
    for (const o of s.objs) if (vis(o.x, o.y, 30)) drawObj(ctx, o, t);
    for (const p of s.props) if (vis(p.x, p.y, 30) && (p.k === 'fire')) { ctx.fillStyle = 'rgba(255,150,40,.9)'; ctx.beginPath(); ctx.moveTo(p.x - 3, p.y + 2); ctx.quadraticCurveTo(p.x, p.y - 10 - Math.sin(t * 9) * 2, p.x + 3, p.y + 2); ctx.fill(); ctx.fillStyle = 'rgb(80,60,40)'; ctx.fillRect(p.x - 5, p.y + 2, 10, 2); }
    // ground items
    for (const it of s.items) if (vis(it.x, it.y, 10)) drawItem(ctx, it, t);
    // vehicles, animals, actors sorted by y
    const list = [];
    for (const v of s.vehicles) if (vis(v.x, v.y, 70) && C.vehVisible(v)) list.push({ y: v.def.deck ? v.y - 400 : v.y, k: 'v', o: v });
    for (const an of s.animals) if (vis(an.x, an.y, 20)) list.push({ y: an.y, k: 'n', o: an });
    for (const a of s.corpses) if (vis(a.x, a.y, 20)) list.push({ y: a.y - 40, k: 'a', o: a });
    for (const a of s.actors) if (!a.inside && !a.gone && vis(a.x, a.y, 30) && C.visible(a)) list.push({ y: a.y, k: 'a', o: a });
    list.sort((p, q) => p.y - q.y);
    for (const it of list) {
      if (it.k === 'v') drawVehicle(ctx, it.o, t);
      else if (it.k === 'n') drawAnimal(ctx, it.o, t);
      else {
        const a = it.o;
        if (a.alpha < 1) ctx.globalAlpha = a.alpha;
        if (a.isPlayer) { ctx.strokeStyle = 'rgba(255,214,96,.9)'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.ellipse(a.x, a.y + 2, 9.5, 4, 0, 0, 6.3); ctx.stroke(); }
        drawActor(ctx, a, t, z);
        if (a.isPlayer && !a.dead) { ctx.fillStyle = 'rgb(255,214,96)'; ctx.strokeStyle = 'rgba(60,40,10,.8)'; ctx.lineWidth = 0.6; ctx.beginPath(); for (let q = 0; q < 10; q++) { const ang = -Math.PI / 2 + q * Math.PI / 5, rr = q % 2 ? 1.8 : 4.2; ctx[q ? 'lineTo' : 'moveTo'](a.x + Math.cos(ang) * rr, a.y - 32 + Math.sin(ang) * rr); } ctx.closePath(); ctx.fill(); ctx.stroke(); }
        ctx.globalAlpha = 1;
        if (a.msel && !a.sel) { ctx.strokeStyle = 'rgba(255,214,96,.8)'; ctx.lineWidth = 0.9; ctx.beginPath(); ctx.ellipse(a.x, a.y + 2, 7.5, 3.1, 0, 0, 6.3); ctx.stroke(); }
        if (a.working && !a.dead) { ctx.strokeStyle = 'rgba(255,255,255,.6)'; ctx.lineWidth = 0.8; ctx.beginPath(); ctx.arc(a.x, a.y - 22, 3 + Math.sin(t * 8) * 0.6, 0, 6.3); ctx.stroke(); }
        if (a.sel) { ctx.strokeStyle = 'rgba(255,230,120,.95)'; ctx.lineWidth = 1.1; ctx.beginPath(); ctx.ellipse(a.x, a.y + 2, 8.5, 3.6, 0, 0, 6.3); ctx.stroke(); }
        if (a.hover && !a.sel) { ctx.strokeStyle = 'rgba(255,255,255,.8)'; ctx.lineWidth = 0.8; ctx.beginPath(); ctx.ellipse(a.x, a.y + 2, 8, 3.4, 0, 0, 6.3); ctx.stroke(); }
      }
    }
    // bullets: streaks
    ctx.lineCap = 'round';
    for (const b of s.bullets) {
      if (!C.pointSeen(b.x, b.y)) continue;
      const sp = Math.hypot(b.vx, b.vy) || 1, len = Math.min(26, sp * 0.028);
      const gx = ctx.createLinearGradient(b.x, b.y, b.x - b.vx / sp * len, b.y - b.vy / sp * len); gx.addColorStop(0, 'rgba(255,240,170,.98)'); gx.addColorStop(1, 'rgba(255,200,90,0)');
      ctx.strokeStyle = gx; ctx.lineWidth = b.big ? 1.8 : 1.1; ctx.beginPath(); ctx.moveTo(b.x, b.y); ctx.lineTo(b.x - b.vx / sp * len, b.y - b.vy / sp * len); ctx.stroke();
    }
    // thrown grenades
    for (const g of s.thrown) { ctx.fillStyle = g.k === 'molotov' ? 'rgb(200,120,40)' : 'rgb(50,60,40)'; ctx.beginPath(); ctx.arc(g.x, g.y - g.h, 2.2, 0, 6.3); ctx.fill(); ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.beginPath(); ctx.ellipse(g.x, g.y, 2, 1, 0, 0, 6.3); ctx.fill(); }
    // canopy over everything (partial) so actors in the forest are dimmed
    ctx.globalAlpha = 0.34;
    if (sw > 0 && sh > 0) ctx.drawImage(s.pre.cn, sx0 * PS, sy0 * PS, sw * PS, sh * PS, sx0, sy0, sw, sh);
    ctx.globalAlpha = 1;
    // particles
    for (const p of s.parts) if (vis(p.x, p.y, 20) && (p.k === 'text' || C.pointSeen(p.x, p.y))) drawPart(ctx, p);
    // order markers & exits
    for (const e of s.exits) {
      ctx.fillStyle = 'rgba(255,225,110,.10)'; ctx.fillRect(e.x * T, e.y * T, e.w * T, e.h * T);
      ctx.strokeStyle = 'rgba(255,225,110,.5)'; ctx.setLineDash([4, 4]); ctx.lineWidth = 1; ctx.strokeRect(e.x * T + .5, e.y * T + .5, e.w * T - 1, e.h * T - 1); ctx.setLineDash([]);
    }
    for (const a of s.actors) { if (!a.msel || !a.order || a.dead) continue; const o = a.order; const tx = o.tgt ? o.tgt.x : o.x, ty = o.tgt ? o.tgt.y : o.y; if (tx === undefined) continue; ctx.strokeStyle = 'rgba(255,224,122,.28)'; ctx.lineWidth = 0.8; ctx.setLineDash([3, 3]); ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(tx, ty); ctx.stroke(); ctx.setLineDash([]); }
    for (const m of G.orderMarks) { const k = 1 - m.t / 2.2; ctx.strokeStyle = m.col; ctx.globalAlpha = k; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(m.x, m.y, 4 + (1 - k) * 8, 0, 6.3); ctx.stroke(); ctx.globalAlpha = 1; }
    ctx.restore();
    C.drawFog(ctx, s, G, W, H, dpr);

    // ----- screen-space layer: labels, tags, bubbles -----
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const bsz = clamp(2.5 * z + 4.5, 8, 12);
    for (const b of s.blds) {
      if (b.key === 'pad' && b.built) continue;
      const sp = C.toScreen(cam, (b.x + b.w / 2) * T + shx / z, (b.y + b.h / 2) * T - (b.h * T * 0.1));
      if (sp.x < -80 || sp.x > W + 80 || sp.y < -20 || sp.y > H + 20) continue;
      if (b.w * T * z < 26 && z < 1.7) continue;
      const lab = C.lab(b.label);
      outlinedText(ctx, lab, sp.x, sp.y, bsz, b.key === 'pad' ? 'rgba(255,255,255,.75)' : '#fff', true);
    }
    if (s.landings && G.sea && G.sea.phase === 'approach') for (const st of s.landings) { const sp = C.toScreen(cam, st.wx, st.wy - 50); if (sp.x < -100 || sp.x > W + 100 || sp.y < -30 || sp.y > H + 30) continue; outlinedText(ctx, st.name, sp.x, sp.y, 11, '#ffe9a8', true); }
    for (const o of s.objs) { if (o.dead) continue; const sp = C.toScreen(cam, o.x, o.y - 14); if (sp.x > -60 && sp.x < W + 60 && sp.y > -20 && sp.y < H + 20) outlinedText(ctx, C.lab(o.label), sp.x, sp.y, bsz - 1, '#ffd9a0', true); }
    for (const v of s.vehicles) { if (v.gone) continue; const sp = C.toScreen(cam, v.x, v.y - 14); if (sp.x < -60 || sp.x > W + 60 || sp.y < -20 || sp.y > H + 20) continue; const fuel = v.def.tank ? Math.round(v.fuel / v.def.tank * 100) : -1; outlinedText(ctx, C.vName(v.type) + (v.wreck ? ' (wrecked)' : '') + (v.wreck || fuel < 0 ? '' : fuel <= 2 ? ' · out of gas' : v.tires.some((q) => q < 0.2) ? ' · flat tire' : ''), sp.x, sp.y, bsz - 1.5, v.wreck ? '#bbb' : '#d8ecff', false); }
    for (const an of s.animals) { if (an.dead) continue; const sp = C.toScreen(cam, an.x, an.y - 8); if (sp.x < 0 || sp.x > W || sp.y < 0 || sp.y > H || z < 1.6) continue; outlinedText(ctx, C.aName(an.k), sp.x, sp.y, 7.5, '#f4efe0', false); }
    for (const it of s.items) { if (z < 1.4) continue; const sp = C.toScreen(cam, it.x, it.y - 8); if (sp.x < 0 || sp.x > W || sp.y < 0 || sp.y > H) continue; outlinedText(ctx, it.label, sp.x, sp.y, 7.5, '#ffe9a8', false); }
    const tagSize = clamp(3.4 * z + 0.6, 7, 10.5);
    const placed = [];     // declutter: skip a tag if it would sit on top of one already drawn
    const prio = (a) => (a.isPlayer ? 0 : a.sel || a.hover ? 1 : a.p.roster ? 2 : a.squad >= 0 ? 3 : a.side === 'army' ? 4 : 5);
    const order = s.actors.concat(s.corpses).slice().sort((p, q) => prio(p) - prio(q));
    for (const a of order) {
      if (a.inside || a.gone || !C.visible(a)) continue; const p = a.p;
      const sp = C.toScreen(cam, a.x, a.y - (a.dead ? 6 : 27 * (a.isPlayer ? 1.05 : 1))); if (sp.x < -60 || sp.x > W + 60 || sp.y < -20 || sp.y > H + 20) continue;
      if (a.alpha < 0.35 && !a.sel) continue;
      let name = C.tagName(p);
      { const wdt = name.length * tagSize * 0.52 + 6; const bx = { x0: sp.x - wdt / 2, x1: sp.x + wdt / 2, y0: sp.y - tagSize * 0.6, y1: sp.y + tagSize * 0.6 };
        if (prio(a) > 1 && placed.some((q) => bx.x0 < q.x1 && bx.x1 > q.x0 && bx.y0 < q.y1 && bx.y1 > q.y0)) continue; placed.push(bx); }
      const showStance = p.stance;
      const fill = a.dead ? '#aaa' : a.isPlayer ? '#ffe28a' : p.roster && p.roster !== 'fidel' ? '#fff3c4' : (p.mil && p.mil.side === 'army' ? '#cfe0ff' : (a.squad >= 0 ? '#ffd0c8' : '#f2efe6'));
      ctx.globalAlpha = a.dead ? 0.7 : Math.max(0.5, a.alpha);
      outlinedText(ctx, name, sp.x, sp.y, tagSize, fill, !!(p.roster));
      ctx.globalAlpha = 1;
      // little status glyphs
      let gx = sp.x + ctx.measureText(name).width / 2 + 5;
      const glyph = (txt, col) => { outlinedText(ctx, txt, gx, sp.y, tagSize, col, true); gx += tagSize + 2; };
      if (!a.dead) {
        if (p.role && /Comandante|Capitán|Jefe|Coronel|Teniente|General/.test(p.role) && !a.isPlayer) glyph('★', '#ffd24a');
        if (p.roster === 'che' || p.occ === 'medico' && a.squad >= 0) glyph('✚', '#ff8a8a');
        if (p.covert && a.squad >= -1 && (G.showCovert || a.squad >= 0)) glyph('☺', '#b8ffb0');
        if (a.bleeding) glyph('●', '#ff5a4a');
      }
      if (a.bubble) { const by = sp.y - tagSize - 5; ctx.font = '600 ' + (tagSize + 1) + 'px ' + FONT; const tw = ctx.measureText(a.bubble.text).width + 12; ctx.fillStyle = 'rgba(255,252,240,.96)'; roundRect(ctx, sp.x - tw / 2, by - 9, tw, 16, 6); ctx.fill(); ctx.strokeStyle = 'rgba(40,30,20,.6)'; ctx.lineWidth = 1; ctx.stroke(); ctx.fillStyle = a.bubble.col || '#2a1d14'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(a.bubble.text, sp.x, by - 0.5); }
    }
    // exit labels
    for (const e of s.exits) { const sp = C.toScreen(cam, (e.x + e.w / 2) * T, (e.y + e.h / 2) * T); if (sp.x > -100 && sp.x < W + 100 && sp.y > -30 && sp.y < H + 30) outlinedText(ctx, '↗ ' + C.lab(e.label), sp.x, sp.y, bsz, '#ffe28a', true); }
    if (G.box) { ctx.strokeStyle = 'rgba(255,224,122,.9)'; ctx.fillStyle = 'rgba(255,224,122,.12)'; ctx.lineWidth = 1; const b = G.box; ctx.fillRect(b.x0, b.y0, b.x1 - b.x0, b.y1 - b.y0); ctx.strokeRect(b.x0, b.y0, b.x1 - b.x0, b.y1 - b.y0); }
    // day/night + weather overlays
    drawAtmosphere(ctx, G, W, H, t);
  };

  function drawWaves(ctx, s, t, vx0, vy0, vw, vh) {
    ctx.save(); ctx.lineCap = 'round';
    const cell = 46; const i0 = Math.floor(vx0 / cell) - 1, i1 = Math.ceil((vx0 + vw) / cell) + 1, j0 = Math.floor(vy0 / cell) - 1, j1 = Math.ceil((vy0 + vh) / cell) + 1;
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const h = Math.sin(i * 12.9898 + j * 78.233) * 43758.5453; const f = h - Math.floor(h); const h2 = Math.sin(i * 39.3468 + j * 11.135) * 24634.6345; const f2 = h2 - Math.floor(h2);
      const x = (i + f) * cell, y = (j + f2) * cell; const tt = C.tileAt(s, x, y); if (tt !== TL.DEEP && tt !== TL.SHAL) continue;
      const ph = (t * 0.35 + f * 6.28); const a = 0.18 + 0.2 * Math.sin(ph); if (a <= 0.04) continue;
      ctx.strokeStyle = `rgba(235,245,250,${a})`; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x - 5, y); ctx.quadraticCurveTo(x, y - 2.2 - Math.sin(ph) * 1.2, x + 5, y); ctx.stroke();
    }
    ctx.restore();
  }
  function drawObj(ctx, o, t) {
    if (o.dead) { ctx.fillStyle = 'rgba(30,26,24,.85)'; ctx.fillRect(o.x - o.w / 2, o.y - o.h / 2, o.w, o.h); return; }
    if (o.k === 'deposito') { ctx.fillStyle = 'rgb(200,64,52)'; ctx.fillRect(o.x - 12, o.y - 8, 24, 16); ctx.fillStyle = 'rgb(240,230,220)'; ctx.fillRect(o.x - 12, o.y - 3, 24, 4); ctx.strokeStyle = '#2a1a16'; ctx.strokeRect(o.x - 12.5, o.y - 8.5, 25, 17); }
    else if (o.k === 'torre') { ctx.strokeStyle = 'rgb(70,70,76)'; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(o.x - 6, o.y + 5); ctx.lineTo(o.x, o.y - 18); ctx.lineTo(o.x + 6, o.y + 5); ctx.moveTo(o.x - 3, o.y - 6); ctx.lineTo(o.x + 3, o.y - 6); ctx.moveTo(o.x - 4.4, o.y); ctx.lineTo(o.x + 4.4, o.y); ctx.stroke(); ctx.fillStyle = 'rgb(220,60,60)'; ctx.beginPath(); ctx.arc(o.x, o.y - 18, 1.5 + Math.sin(t * 5) * 0.4, 0, 6.3); ctx.fill(); }
    else if (o.k === 'polvorin') { ctx.fillStyle = 'rgb(90,90,90)'; ctx.fillRect(o.x - 8, o.y - 6, 16, 12); }
  }
  function drawItem(ctx, it, t) {
    ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.fillRect(it.x - 4, it.y + 1, 9, 3);
    if (it.k === 'food') { ctx.fillStyle = 'rgb(170,130,70)'; ctx.fillRect(it.x - 4, it.y - 4, 8, 7); ctx.fillStyle = 'rgb(220,190,110)'; ctx.fillRect(it.x - 4, it.y - 4, 8, 2); }
    else if (it.k === 'ammo') { ctx.fillStyle = 'rgb(86,92,70)'; ctx.fillRect(it.x - 4, it.y - 3, 8, 6); ctx.fillStyle = 'rgb(230,200,80)'; ctx.fillRect(it.x - 2, it.y - 1, 4, 2); }
    else if (it.k === 'med') { ctx.fillStyle = 'rgb(240,240,240)'; ctx.fillRect(it.x - 4, it.y - 4, 8, 7); ctx.fillStyle = 'rgb(210,50,50)'; ctx.fillRect(it.x - 1, it.y - 3, 2, 5); ctx.fillRect(it.x - 2.5, it.y - 1.5, 5, 2); }
    else if (it.k === 'gun') { ctx.strokeStyle = 'rgb(40,34,30)'; ctx.lineWidth = 1.8; ctx.beginPath(); ctx.moveTo(it.x - 6, it.y); ctx.lineTo(it.x + 6, it.y - 1); ctx.stroke(); }
    else if (it.k === 'fuel') { ctx.fillStyle = 'rgb(200,60,50)'; ctx.fillRect(it.x - 3, it.y - 5, 6, 8); ctx.fillStyle = 'rgb(240,240,240)'; ctx.fillRect(it.x - 1, it.y - 7, 2, 2); }
    else if (it.k === 'money') { ctx.fillStyle = 'rgb(90,150,90)'; ctx.fillRect(it.x - 4, it.y - 3, 8, 5); ctx.fillStyle = 'rgb(220,240,200)'; ctx.fillRect(it.x - 1, it.y - 2, 2, 3); }
    else { ctx.fillStyle = 'rgb(200,200,180)'; ctx.fillRect(it.x - 3, it.y - 3, 6, 6); }
  }
  function drawAnimal(ctx, a, t) {
    ctx.save(); ctx.translate(a.x, a.y);
    const d = a.def, f = a.face;
    ctx.fillStyle = 'rgba(0,0,0,.22)'; ctx.beginPath(); ctx.ellipse(0, 2, d.sz, d.sz * 0.35, 0, 0, 6.3); ctx.fill();
    if (a.dead) { ctx.rotate(1.2); ctx.globalAlpha = 0.85; }
    const bob = a.moving && !a.dead ? Math.sin(a.anim * 2) * 0.8 : 0;
    ctx.translate(0, -d.sz * 0.5 - bob);
    ctx.fillStyle = rgb(d.col); roundRect(ctx, -d.sz, -d.sz * 0.5, d.sz * 2, d.sz, d.sz * 0.35); ctx.fill();
    if (d.patch) { ctx.fillStyle = rgb(d.patch); ctx.fillRect(-d.sz * 0.5, -d.sz * 0.4, d.sz * 0.6, d.sz * 0.5); }
    ctx.fillStyle = rgb(d.col); ctx.fillRect(f * d.sz * 0.9 - d.sz * 0.3, -d.sz * 0.6, d.sz * 0.7, d.sz * 0.7);
    ctx.fillStyle = INK; ctx.fillRect(f * d.sz * 1.15 - 0.5, -d.sz * 0.35, 1.2, 1.2);
    if (d.horns) { ctx.fillStyle = '#eee'; ctx.fillRect(f * d.sz * 0.9, -d.sz * 0.75, 1, 2); }
    ctx.fillStyle = 'rgb(50,40,36)'; ctx.fillRect(-d.sz * 0.7, d.sz * 0.45, 1.4, 2.5 + bob); ctx.fillRect(d.sz * 0.6, d.sz * 0.45, 1.4, 2.5 - bob);
    ctx.restore();
  }
  function drawPart(ctx, p) {
    const k = p.life / p.max;
    switch (p.k) {
      case 'smoke': ctx.fillStyle = `rgba(${p.c},${p.c},${p.c},${0.45 * k})`; ctx.beginPath(); ctx.arc(p.x, p.y, p.r * (1.6 - k), 0, 6.3); ctx.fill(); break;
      case 'fire': ctx.fillStyle = `rgba(255,${(120 + 100 * k) | 0},40,${0.85 * k})`; ctx.beginPath(); ctx.arc(p.x, p.y, p.r * (0.5 + k * 0.6), 0, 6.3); ctx.fill(); break;
      case 'flash': { const rr = p.r * (1.4 - k * 0.6); const gr = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, rr); gr.addColorStop(0, `rgba(255,248,210,${0.95 * k})`); gr.addColorStop(0.45, `rgba(255,200,110,${0.6 * k})`); gr.addColorStop(1, 'rgba(255,140,60,0)'); ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(p.x, p.y, rr, 0, 6.3); ctx.fill(); break; }
      case 'dust': ctx.fillStyle = `rgba(190,170,130,${0.55 * k})`; ctx.beginPath(); ctx.arc(p.x, p.y, p.r * (1.3 - k * 0.5), 0, 6.3); ctx.fill(); break;
      case 'spark': ctx.strokeStyle = `rgba(255,220,120,${k})`; ctx.lineWidth = 0.9; ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - p.vx * 0.03, p.y - p.vy * 0.03); ctx.stroke(); break;
      case 'chunk': ctx.save(); ctx.translate(p.x, p.y - (p.z || 0)); ctx.rotate(p.rot); ctx.fillStyle = rgb(p.col); ctx.fillRect(-p.r, -p.r, p.r * 2, p.r * 2); ctx.strokeStyle = 'rgba(20,14,12,.7)'; ctx.lineWidth = 0.6; ctx.strokeRect(-p.r, -p.r, p.r * 2, p.r * 2); ctx.restore(); break;
      case 'ring': ctx.strokeStyle = `rgba(255,240,200,${0.8 * k})`; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(p.x, p.y, p.r * (1 - k) + 4, 0, 6.3); ctx.stroke(); break;
      case 'shadow': ctx.fillStyle = `rgba(0,0,0,${0.35 * Math.min(1, k * 3)})`; ctx.beginPath(); ctx.ellipse(p.x, p.y, p.r, p.r * 0.35, 0, 0, 6.3); ctx.fill(); break;
      case 'text': break;
      default: break;
    }
  }
  function drawAtmosphere(ctx, G, W, H, t) {
    const hr = G.hour;
    // darkness 0..1
    let dark = 0; if (hr < 5 || hr >= 20) dark = 0.62; else if (hr < 7) dark = 0.62 * (7 - hr) / 2; else if (hr >= 18) dark = 0.62 * (hr - 18) / 2;
    dark = Math.max(dark, G.weather.rain * 0.18);
    if (dark > 0.02) { ctx.fillStyle = `rgba(8,14,40,${dark})`; ctx.fillRect(0, 0, W, H); }
    if (hr >= 17 && hr < 19.5) { ctx.fillStyle = `rgba(255,140,50,${0.12 * (1 - Math.abs(hr - 18.2) / 1.4)})`; ctx.fillRect(0, 0, W, H); }
    if (G.weather.rain > 0.08) {
      ctx.strokeStyle = 'rgba(200,220,255,.45)'; ctx.lineWidth = 1; ctx.beginPath();
      const n = Math.floor(120 * G.weather.rain);
      for (let i = 0; i < n; i++) { const x = ((i * 97 + t * 420) % (W + 40)) - 20, y = ((i * 53 + t * 700) % (H + 40)) - 20; ctx.moveTo(x, y); ctx.lineTo(x - 5, y + 14); }
      ctx.stroke();
    }
    if (G.weather.fog > 0.05) { ctx.fillStyle = `rgba(210,220,225,${G.weather.fog * 0.3})`; ctx.fillRect(0, 0, W, H); }
    if (G.flash > 0) { ctx.fillStyle = `rgba(255,240,210,${G.flash * 0.5})`; ctx.fillRect(0, 0, W, H); }
    // vignette when hurt
    if (G.hurt > 0.02) { const g = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.3, W / 2, H / 2, Math.max(W, H) * 0.7); g.addColorStop(0, 'rgba(120,0,0,0)'); g.addColorStop(1, `rgba(120,0,0,${Math.min(0.55, G.hurt)})`); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); }
  }

  // ---------- minimap ----------
  C.drawMinimap = function (mc, s, G) {
    const ctx = mc.getContext('2d'); const w = mc.width, h = mc.height;
    if (!s.mini) {
      const m = document.createElement('canvas'); m.width = s.tw; m.height = s.th; const mx = m.getContext('2d'); const img = mx.createImageData(s.tw, s.th);
      for (let i = 0; i < s.tiles.length; i++) { const c = tileColor(s.tiles[i], 128); img.data[i * 4] = c[0] * 0.9; img.data[i * 4 + 1] = c[1] * 0.9; img.data[i * 4 + 2] = c[2] * 0.9; img.data[i * 4 + 3] = 255; }
      mx.putImageData(img, 0, 0); s.mini = m;
    }
    ctx.clearRect(0, 0, w, h); ctx.imageSmoothingEnabled = false;
    const sc = Math.min(w / s.tw, h / s.th); const ox = (w - s.tw * sc) / 2, oy = (h - s.th * sc) / 2;
    ctx.drawImage(s.mini, ox, oy, s.tw * sc, s.th * sc);
    const px = (x) => ox + x / T * sc, py = (y) => oy + y / T * sc;
    for (const b of s.blds) { if (b.key === 'pad') continue; ctx.fillStyle = b.tag === 'army' ? '#6a86ff' : b.tag === 'church' ? '#fff0b0' : 'rgba(255,255,255,.55)'; ctx.fillRect(ox + b.x * sc, oy + b.y * sc, Math.max(1.5, b.w * sc), Math.max(1.5, b.h * sc)); }
    for (const v of s.vehicles) { if (v.gone) continue; ctx.fillStyle = '#e8d070'; ctx.fillRect(px(v.x) - 1.5, py(v.y) - 1, 3, 2); }
    for (const a of s.actors) { if (a.inside || a.gone || a.dead || !C.visible(a)) continue; const c = a.p.mil && a.p.mil.side === 'army' ? '#5e86ff' : (a.squad >= 0 || a.isPlayer) ? '#ff4a3a' : 'rgba(240,240,240,.7)'; ctx.fillStyle = c; ctx.fillRect(px(a.x) - 1, py(a.y) - 1, a.isPlayer ? 3.4 : 2, a.isPlayer ? 3.4 : 2); }
    const cam = G.cam; ctx.strokeStyle = 'rgba(255,255,255,.8)'; ctx.lineWidth = 1; ctx.strokeRect(px(cam.x - C.R.W / 2 / cam.z), py(cam.y - C.R.H / 2 / cam.z), C.R.W / cam.z / T * sc, C.R.H / cam.z / T * sc);
  };
})();
