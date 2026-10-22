/* CUBEA — scene.js : tile maps for every location, buildings with labels, pathfinding, actor instantiation. */
(function () {
  'use strict';
  const C = (window.C = window.C || {});
  const T = 16;                                   // px per tile (world units)
  C.T = T;
  // terrain codes
  const G = 0, FOR = 1, ROAD = 2, DEEP = 3, SHAL = 4, BLD = 5, ROCK = 6, CANE = 7, SAND = 8, TRAIL = 9, PLAZA = 10, FENCE = 11, PIER = 12, PAVED = 13;
  C.TILE = { G, FOR, ROAD, DEEP, SHAL, BLD, ROCK, CANE, SAND, TRAIL, PLAZA, FENCE, PIER, PAVED };
  //                 G    FOR  ROAD DEEP SHAL BLD  ROCK CANE SAND TRL  PLZ  FNC  PIER PAVED
  const COST =    [1.0, 1.6, 0.7, 0,   1.7, 0,   0,   1.4, 1.25, 0.8, 0.7, 0,   0.7, 0.65];
  const OPAC =    [0,   0.30,0,   0,   0,   1,   1,   0.22,0,    0,   0,   0.0, 0,   0];
  const BLOCKB =  [0,   0.045,0,  0,   0,   1,   1,   0.02,0,    0,   0,   0,   0,   0]; // bullet-stopping chance per 8px
  C.TCOST = COST; C.TOPAC = OPAC;

  C.scenes = {};

  class Scene {
    constructor(sid, type, tw, th) {
      this.sid = sid; this.type = type; this.tw = tw; this.th = th;
      this.S = C.SETTLEMENTS[sid]; this.name = this.S.name;
      this.tiles = new Uint8Array(tw * th);
      this.var = new Uint8Array(tw * th);           // per-tile random variation
      this.blds = []; this.props = []; this.objs = []; this.pois = []; this.exits = []; this.homes = []; this.vehicles = []; this.animals = [];
      this.actors = []; this.thrown = []; this.bullets = []; this.parts = []; this.items = []; this.corpses = []; this.decals = []; this.fires = [];
      this.R = C.RNG(C.hashStr(sid) ^ (C.W.seed || 1));
      for (let i = 0; i < this.var.length; i++) this.var[i] = (this.R() * 255) | 0;
      this.alert = 0; this.time = 0; this.visited = 0;
    }
    in(x, y) { return x >= 0 && y >= 0 && x < this.tw && y < this.th; }
    get(x, y) { return this.in(x, y) ? this.tiles[y * this.tw + x] : ROCK; }
    set(x, y, t) { if (this.in(x, y)) this.tiles[y * this.tw + x] = t; }
    rect(x, y, w, h, t, onlyOn) { for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) if (this.in(i, j) && (!onlyOn || onlyOn.includes(this.get(i, j)))) this.set(i, j, t); }
    disc(cx, cy, r, t, onlyOn) { for (let j = Math.floor(cy - r); j <= cy + r; j++) for (let i = Math.floor(cx - r); i <= cx + r; i++) if ((i - cx) ** 2 + (j - cy) ** 2 <= r * r && this.in(i, j) && (!onlyOn || onlyOn.includes(this.get(i, j)))) this.set(i, j, t); }
    line(pts, w, t, onlyOn) {
      for (let k = 0; k < pts.length - 1; k++) {
        const [x0, y0] = pts[k], [x1, y1] = pts[k + 1]; const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) * 2 + 1;
        for (let s = 0; s <= n; s++) { const x = x0 + (x1 - x0) * s / n, y = y0 + (y1 - y0) * s / n; this.disc(x, y, w / 2, t, onlyOn); }
      }
    }
    isFree(x, y) { return this.in(x, y) && COST[this.get(x, y)] > 0; }
    freeRect(x, y, w, h, margin) {
      for (let j = y - margin; j < y + h + margin; j++) for (let i = x - margin; i < x + w + margin; i++) {
        if (!this.in(i, j)) return false; const t = this.get(i, j);
        if (t === BLD || t === DEEP || t === ROCK || t === ROAD || t === PAVED || t === PLAZA || t === SHAL || t === FENCE || t === PIER) return false;
      }
      return true;
    }
    addBld(key, x, y, opts) {
      const d = C.BLD[key]; opts = opts || {};
      const w = opts.w || d.w, h = opts.h || d.h;
      const b = { id: this.blds.length, key, label: opts.label || d.n, x, y, w, h, fill: d.fill, roof: d.roof, tag: d.tag, open: !!d.open, door: null, owner: opts.owner || null, hh: -1, inside: [], hp: 100, alt: opts.alt || '', fac: opts.fac || null };
      if (!d.open) { this.rect(x, y, w, h, BLD); b.door = { tx: x + (w >> 1), ty: y + h }; if (this.get(b.door.tx, b.door.ty) === BLD) b.door.ty++; if (this.in(b.door.tx, b.door.ty) && this.get(b.door.tx, b.door.ty) !== ROAD && this.get(b.door.tx, b.door.ty) !== PAVED && this.get(b.door.tx, b.door.ty) !== PLAZA && this.get(b.door.tx, b.door.ty) !== DEEP) this.set(b.door.tx, b.door.ty, TRAIL); }
      else { b.door = { tx: x + (w >> 1), ty: y + (h >> 1) }; if (opts.paint !== false) this.rect(x, y, w, h, key === 'muelle' ? PIER : key === 'cementerio' ? G : G); }
      this.blds.push(b); return b;
    }
    prop(k, x, y, label) { this.props.push({ k, x: x * T + T / 2, y: y * T + T / 2, label: label || '' }); }
    centerPx(b) { return { x: (b.x + b.w / 2) * T, y: (b.y + b.h / 2) * T }; }
    doorPx(b) { return { x: b.door.tx * T + T / 2, y: b.door.ty * T + T / 2 }; }
    // find a free tile near (tx,ty)
    nearFree(tx, ty, r, avoid) {
      for (let rr = 0; rr <= (r || 8); rr++) for (let a = 0; a < 12 + rr * 4; a++) {
        const ang = this.R() * 6.283, x = Math.round(tx + Math.cos(ang) * rr), y = Math.round(ty + Math.sin(ang) * rr);
        if (this.isFree(x, y) && (!avoid || !avoid.includes(this.get(x, y)))) return { x, y };
      }
      return { x: tx, y: ty };
    }
    randomFree(tiles) {
      for (let k = 0; k < 400; k++) { const x = this.R.int(this.tw), y = this.R.int(this.th); if (this.isFree(x, y) && (!tiles || tiles.includes(this.get(x, y)))) return { x, y }; }
      return { x: this.tw >> 1, y: this.th >> 1 };
    }
  }
  C.Scene = Scene;

  // ---------------- generic helpers ----------------
  function scatterTrees(s, density, region, tiles) {
    const R = s.R;
    for (let y = 0; y < s.th; y++) for (let x = 0; x < s.tw; x++) {
      if (region && !region(x, y)) continue;
      const t = s.get(x, y); if (tiles && !tiles.includes(t)) continue;
      if (R() < density) s.prop(R() < 0.45 ? 'palm' : R() < 0.4 ? 'ceiba' : 'tree', x + R.range(-0.3, 0.3), y + R.range(-0.3, 0.3));
    }
  }
  function placeHouses(s, hhs, kinds, area, spacing) {
    // place dwellings on free land inside area(x,y)=bool, return array of buildings
    const R = s.R, out = [];
    let tries = 0;
    const want = hhs.length;
    while (out.length < want && tries++ < want * 80) {
      const key = R.weighted(kinds);
      const d = C.BLD[key];
      const x = R.irange(2, s.tw - d.w - 2), y = R.irange(2, s.th - d.h - 3);
      if (!area(x, y) || !s.freeRect(x, y, d.w, d.h + 1, spacing)) continue;
      const b = s.addBld(key, x, y); out.push(b);
    }
    return out;
  }
  function famLabel(b, hh) { const head = C.W.people[hh.head]; if (!head) return; const pre = b.key === 'bohio' ? 'Bohío' : b.key === 'casona' ? 'Casona' : 'Casa'; b.label = pre + ' ' + head.last; }
  function assignHomes(s, hhs, bldgs) {
    const R = s.R;
    for (let i = 0; i < hhs.length && bldgs.length; i++) {
      const b = bldgs[i % bldgs.length]; hhs[i].bld = b.id; b.hh = hhs[i].id; s.homes.push({ hh: hhs[i].id, bld: b.id }); famLabel(b, hhs[i]);
    }
  }
  function worldBorder(s, t) { // frame of impassable terrain
    for (let i = 0; i < s.tw; i++) { s.set(i, 0, t); s.set(i, s.th - 1, t); }
    for (let j = 0; j < s.th; j++) { s.set(0, j, t); s.set(s.tw - 1, j, t); }
  }
  function addExit(s, side, from, to, label, dest) { // side n/s/e/w, from..to in tiles along the edge
    let r;
    if (side === 'n') r = { x: from, y: 0, w: to - from, h: 3 }; else if (side === 's') r = { x: from, y: s.th - 3, w: to - from, h: 3 };
    else if (side === 'w') r = { x: 0, y: from, w: 3, h: to - from }; else r = { x: s.tw - 3, y: from, w: 3, h: to - from };
    r.label = label; r.dest = dest; r.side = side;
    // open a corridor through any border/rock
    s.rect(r.x, r.y, r.w, r.h, TRAIL, [ROCK, DEEP, FOR]);
    s.exits.push(r);
  }

  // ---------------- generators ----------------
  const gen = {};

  gen.cane = function (s) {
    const R = s.R, noise = C.makeNoise(7);
    s.rect(0, 0, s.tw, s.th, CANE);
    for (let y = 0; y < s.th; y++) for (let x = 0; x < s.tw; x++) {
      const n = noise(x * 0.09, y * 0.09);
      if (y < 6 + n * 4 || x < 5 + n * 3) s.set(x, y, FOR);
      else if (n > 0.66) s.set(x, y, G);
    }
    s.disc(40, 47, 7, G, [CANE]);                       // clearing where the party lands
    s.line([[84, 52], [60, 50], [44, 48], [30, 44]], 2, TRAIL);   // cart track
    s.line([[10, 60], [20, 52], [30, 44]], 2, TRAIL);
    for (let i = 0; i < 40; i++) { const x = R.irange(8, s.tw - 4), y = R.irange(8, s.th - 4); if (s.get(x, y) === CANE && R() < 0.6) s.prop('palm', x, y); }
    s.addBld('bohio', 56, 36, { label: 'Bohío abandonado' });
    s.addBld('bohio', 18, 30, { label: 'Casa del cañero' });
    s.exits.push({ x: 4, y: 0, w: 34, h: 5, label: 'Monte (huir hacia la Sierra)', dest: 'sierra', side: 'n', scripted: true });
    s.spawn = { x: 40 * T, y: 47 * T };
    s.title = 'Cañaveral de Alegría de Pío';
  };

  gen.sierra = function (s, hhs) {
    const R = s.R, n1 = C.makeNoise(11), n2 = C.makeNoise(23);
    for (let y = 0; y < s.th; y++) for (let x = 0; x < s.tw; x++) {
      const h = n1(x * 0.07, y * 0.07) * 0.72 + n2(x * 0.19, y * 0.19) * 0.28;
      s.set(x, y, h > 0.69 ? ROCK : h > 0.46 ? FOR : (n2(x * 0.3, y * 0.3) > 0.58 ? FOR : G));
    }
    const camp = { x: 50, y: 46 }, ham = { x: 80, y: 22 }, post = { x: 18, y: 16 };
    // stream N->S
    const ps = []; for (let y = 0; y <= s.th; y += 4) ps.push([36 + Math.sin(y * 0.15) * 7, y]);
    s.line(ps, 2.2, SHAL);
    for (let k = 0; k < 3; k++) { const p = ps[R.irange(3, ps.length - 3)]; s.disc(p[0], p[1], 1.6, DEEP, [SHAL]); }
    // trails & clearings
    s.disc(camp.x, camp.y, 9, G); s.disc(ham.x, ham.y, 8, G); s.disc(post.x, post.y, 9, G);
    s.line([[camp.x, camp.y], [64, 36], [ham.x, ham.y]], 2.4, TRAIL);
    s.line([[camp.x, camp.y], [38, 38], [post.x + 4, post.y + 4]], 2.4, TRAIL, [ROCK, FOR, G, DEEP]);
    s.line([[camp.x, camp.y], [camp.x, s.th - 1]], 2.4, TRAIL);
    s.line([[camp.x, camp.y], [3, 34]], 2.4, TRAIL);
    s.line([[ham.x, ham.y], [s.tw - 1, 28]], 2.4, TRAIL);
    s.line([[ham.x, ham.y], [ham.x - 6, 4]], 2, TRAIL);
    // camp pads: build slots
    s.camp = { x: camp.x, y: camp.y, slots: [] };
    const padAt = [[-6, -4, 'cocina'], [-2, -6, 'enfermeria'], [3, -6, 'taller'], [7, -3, 'radiocamp'], [-7, 2, 'escuelacamp'], [7, 3, 'imprenta'], [-3, 7, 'polvorin'], [3, 7, 'tienda_c']];
    for (const [dx, dy, k] of padAt) {
      const d = C.BLD[k]; const b = s.addBld('pad', camp.x + dx, camp.y + dy, { label: 'Solar: ' + d.n, w: d.w, h: d.h }); b.slot = k; b.built = false; s.camp.slots.push(b.id);
    }
    s.addBld('tienda_c', camp.x - 1, camp.y + 1, { label: 'Tienda del mando' });
    s.prop('fire', camp.x + 1, camp.y - 1, 'Fogata');
    // hamlet Los Carboneros
    const hbs = [];
    for (const [dx, dy] of [[-5, -3], [0, -5], [5, -2], [-4, 3], [2, 3], [7, 4]]) hbs.push(s.addBld('bohio', ham.x + dx, ham.y + dy));
    s.prop('carbonera', ham.x - 8, ham.y + 2, 'Carbonera'); s.prop('carbonera', ham.x - 9, ham.y - 1, 'Carbonera'); s.prop('carbonera', ham.x + 9, ham.y - 4, 'Carbonera');
    s.hamlet = hbs;
    // army outpost
    s.rect(post.x - 7, post.y - 5, 15, 12, G, [FOR, ROCK]);
    const pb = s.addBld('posta', post.x - 2, post.y - 3, { label: 'Puesto del Ejército' });
    const bk = s.addBld('cuartel', post.x - 5, post.y + 2, { label: 'Barracón', w: 6, h: 3 });
    for (let i = post.x - 7; i < post.x + 8; i++) { s.set(i, post.y - 5, FENCE); s.set(i, post.y + 6, FENCE); }
    for (let j = post.y - 5; j < post.y + 7; j++) { s.set(post.x - 7, j, FENCE); s.set(post.x + 7, j, FENCE); }
    s.set(post.x + 7, post.y, TRAIL); s.set(post.x + 7, post.y + 1, TRAIL); s.set(post.x, post.y + 6, TRAIL);
    s.addBld('polvorin', post.x + 3, post.y - 3, { label: 'Polvorín del Ejército' });
    s.objs.push({ k: 'deposito', label: 'Depósito de combustible', x: (post.x + 4) * T, y: (post.y + 3) * T, hp: 60, w: 28, h: 20 });
    s.army = { x: post.x * T, y: post.y * T, bld: pb.id };
    s.prop('flag', post.x + 1, post.y - 4, 'Bandera');
    // trees
    scatterTrees(s, 0.05, null, [FOR]); scatterTrees(s, 0.012, null, [G]);
    addExit(s, 's', 46, 56, 'Camino a Cayo Piedra', 'cayo');
    addExit(s, 'w', 30, 38, 'Hacia Palmarito', 'palmarito');
    addExit(s, 'e', 25, 33, 'Hacia Santiago (Sierra este)', 'santiago');
    s.spawn = { x: camp.x * T, y: (camp.y + 3) * T };
    s.title = 'Sierra Maestra';
    s.dwellings = hbs; s.fieldPois = [{ tx: ham.x - 7, ty: ham.y + 4 }];
    assignHomes(s, hhs, hbs);
  };

  gen.village = function (s, hhs) {
    const R = s.R, noise = C.makeNoise(31);
    s.rect(0, 0, s.tw, s.th, G);
    for (let y = 0; y < s.th; y++) for (let x = 0; x < s.tw; x++) {
      const n = noise(x * 0.12, y * 0.12);
      if (x < 4 || n > 0.7 && (x < 14 || y < 8)) s.set(x, y, FOR);
    }
    // cane fields W and S
    for (let y = 0; y < s.th; y++) for (let x = 0; x < s.tw; x++) { if ((x > 4 && x < 22 && y > 8) || (y > 40 && x > 22)) if (s.get(x, y) === G) s.set(x, y, CANE); }
    s.line([[0, 18], [36, 24], [s.tw - 1, 26]], 2.4, ROAD);   // main road
    s.line([[36, 24], [36, 4]], 1.6, TRAIL); s.line([[36, 26], [34, s.th - 1]], 1.6, TRAIL); s.line([[20, 20], [14, 44]], 1.4, TRAIL);
    s.rect(30, 22, 12, 7, PLAZA);                                   // plaza
    // river north
    const rp = []; for (let x = 0; x < s.tw; x += 4) rp.push([x, 5 + Math.sin(x * 0.2) * 2]); s.line(rp, 2.4, SHAL);
    s.prop('well', 36, 25, 'Pozo');
    const bod = s.addBld('bodega', 31, 19, { label: 'Bodega de Palmarito' }); s.pois.push({ k: 'shop', b: bod.id });
    const cap = s.addBld('capilla', 38, 18, { label: 'Capilla de San Lázaro' });
    const esc = s.addBld('escuela', 43, 22, { label: 'Escuela rural' });
    const posta = s.addBld('posta', 56, 28, { label: 'Puesto de la Guardia Rural' });
    s.rect(54, 26, 9, 8, G, [CANE, FOR]);
    for (let i = 54; i < 63; i++) { s.set(i, 26, FENCE); s.set(i, 33, FENCE); } for (let j = 26; j < 34; j++) { s.set(54, j, FENCE); s.set(62, j, FENCE); } s.set(54, 29, TRAIL);
    s.army = { x: 58 * T, y: 30 * T, bld: posta.id };
    s.addBld('casona', 48, 11, { label: 'Casa del Mayordomo' }); s.addBld('almacen', 54, 12, { label: 'Almacén de caña' });
    s.addBld('cementerio', 58, 40, { label: 'Cementerio' });
    s.addBld('casona', 60, 12, { label: 'Casa de hacendado' });
    s.pois.push({ k: 'church', b: cap.id }, { k: 'school', b: esc.id });
    // households' dwellings
    const homes = placeHouses(s, hhs, [['bohio', 8], ['casa', 1.2]], (x, y) => x > 20 && x < 66 && y > 8 && y < 46 && !(x > 28 && x < 44 && y > 16 && y < 31), 1);
    assignHomes(s, hhs, homes);
    // yards: animals will be placed by instantiate
    for (let i = 0; i < 8; i++) { const p = s.randomFree([G]); s.prop(i % 2 ? 'palm' : 'tree', p.x, p.y); }
    scatterTrees(s, 0.04, (x, y) => s.get(x, y) === FOR || (x < 6), [FOR]); scatterTrees(s, 0.01, null, [G]);
    for (let i = 0; i < 6; i++) s.pois.push({ k: 'field', tx: R.irange(6, 20), ty: R.irange(12, 40) });
    for (let i = 0; i < 4; i++) s.pois.push({ k: 'field', tx: R.irange(26, 60), ty: R.irange(42, 50) });
    addExit(s, 'w', 16, 22, 'Camino a la Sierra', 'sierra');
    addExit(s, 'e', 22, 30, 'Camino a Manzanillo / Bayamo', 'manzanillo');
    s.spawn = { x: 36 * T, y: 30 * T };
    s.title = 'Palmarito (batey)';
    s.dwellings = homes;
  };

  gen.fishing = function (s, hhs) {
    const R = s.R, noise = C.makeNoise(41);
    s.rect(0, 0, s.tw, s.th, G);
    for (let y = 0; y < s.th; y++) for (let x = 0; x < s.tw; x++) {
      const shore = 34 + Math.sin(x * 0.18) * 2.2 + noise(x * 0.1, 3) * 2;
      if (y > shore + 3) s.set(x, y, DEEP); else if (y > shore) s.set(x, y, SHAL); else if (y > shore - 3) s.set(x, y, SAND);
      else if (noise(x * 0.15, y * 0.15) > 0.64 && (x < 12 || x > 58 || y < 10)) s.set(x, y, FOR);
    }
    s.line([[0, 26], [36, 27], [s.tw - 1, 22]], 2, TRAIL); s.line([[36, 27], [36, 0]], 2, ROAD); s.rect(30, 24, 12, 4, PLAZA);
    s.addBld('muelle', 34, 33, { label: 'Muelle', w: 5, h: 8, paint: false }); s.rect(34, 33, 5, 9, PIER);
    s.pierPx = { x: 36 * T, y: 40 * T };
    const coop = s.addBld('cooperativa', 40, 22, { label: 'Cooperativa de pescadores' });
    s.addBld('secadero', 24, 29, { label: 'Secadero de pescado' });
    const cap = s.addBld('capilla', 46, 20, { label: 'Capilla de la Virgen (Caridad)' });
    const bod = s.addBld('bodega', 28, 21, { label: 'Bodega' });
    const posta = s.addBld('posta', 56, 24, { label: 'Puesto de Guardacostas' });
    s.army = { x: 58 * T, y: 28 * T, bld: posta.id };
    s.pois.push({ k: 'church', b: cap.id }, { k: 'shop', b: bod.id });
    const homes = placeHouses(s, hhs, [['bohio', 9], ['casa', 1]], (x, y) => y > 12 && y < 31 && x > 8 && x < 64 && !(x > 28 && x < 44 && y > 22 && y < 29), 1);
    assignHomes(s, hhs, homes);
    scatterTrees(s, 0.05, null, [FOR]); scatterTrees(s, 0.012, null, [G, SAND]);
    for (const [x, y] of [[30, 38], [44, 38], [38, 45], [26, 41]]) s.boatSpots = (s.boatSpots || []).concat([{ x: x * T, y: y * T }]);
    addExit(s, 'n', 32, 40, 'Camino a la Sierra / Manzanillo', 'sierra');
    s.spawn = { x: 36 * T, y: 28 * T };
    s.title = 'Cayo Piedra (aldea de pescadores)';
    s.dwellings = homes;
  };

  function townGrid(s, opt) { // returns {blocks:[{x,y,w,h}], streets}
    const sx = opt.sx, sy = opt.sy, street = opt.street || 3;
    const blocks = [];
    // streets
    for (let x = opt.x0; x < s.tw - 4; x += sx) s.rect(x, 2, street, s.th - 4, opt.paved ? PAVED : ROAD, [G, FOR, SAND, CANE]);
    for (let y = opt.y0; y < s.th - 4; y += sy) s.rect(2, y, s.tw - 4, street, opt.paved ? PAVED : ROAD, [G, FOR, SAND, CANE]);
    for (let x = opt.x0; x + sx + street < s.tw - 2; x += sx) for (let y = opt.y0; y + sy + street < s.th - 2; y += sy) blocks.push({ x: x + street, y: y + street, w: sx - street, h: sy - street, gx: (x - opt.x0) / sx, gy: (y - opt.y0) / sy });
    return blocks;
  }
  function clearAround(s, x, y, w, h) { for (let j = y - 1; j <= y + h; j++) for (let i = x - 1; i <= x + w; i++) { if (i >= x && i < x + w && j >= y && j < y + h) continue; if (s.get(i, j) === BLD) return false; } return true; }
  function fillBlock(s, b, kinds, rowGap) {
    // pack buildings in two rows along block
    const out = [];
    let y = b.y;
    while (y < b.y + b.h - 2) {
      let x = b.x, rowH = 0;
      while (x < b.x + b.w - 2) {
        const key = s.R.weighted(kinds); const d = C.BLD[key];
        if (x + d.w > b.x + b.w || y + d.h > b.y + b.h) { x++; if (x + 2 > b.x + b.w) break; continue; }
        if (!s.freeRect(x, y, d.w, d.h, 0) || !clearAround(s, x, y, d.w, d.h)) { x++; continue; }
        const bl = s.addBld(key, x, y); out.push(bl); x += d.w + 1; rowH = Math.max(rowH, d.h);
      }
      y += (rowH || 3) + (rowGap || 1);
    }
    return out;
  }

  function buildTown(s, hhs, spec) {
    const R = s.R;
    s.rect(0, 0, s.tw, s.th, G);
    const noise = C.makeNoise(spec.seed);
    for (let y = 0; y < s.th; y++) for (let x = 0; x < s.tw; x++) { if (x < 3 || y < 3 || x > s.tw - 4 || y > s.th - 4) if (noise(x * 0.2, y * 0.2) > 0.4) s.set(x, y, FOR); }
    if (spec.water) spec.water(s);
    const blocks = townGrid(s, spec.grid);
    const civic = spec.civic;   // [{key,label, gx,gy}] by block coords
    const used = new Set();
    for (const c of civic) {
      const bl = blocks.find((b) => b.gx === c.gx && b.gy === c.gy); if (!bl) continue; used.add(bl);
      const d = C.BLD[c.key];
      const x = bl.x + Math.max(0, ((bl.w - d.w) >> 1)), y = bl.y + Math.max(0, ((bl.h - d.h) >> 1));
      if (c.plaza) { bl.plazaBlock = true; s.rect(bl.x, bl.y, bl.w, bl.h, PLAZA); s.prop('tree', bl.x + 1, bl.y + 1); s.prop('tree', bl.x + bl.w - 2, bl.y + bl.h - 2); s.prop('fountain', bl.x + bl.w / 2, bl.y + bl.h / 2, c.plaza); s.plaza = { x: bl.x + bl.w / 2, y: bl.y + bl.h / 2 }; continue; }
      const b = s.addBld(c.key, x, y, { label: c.label || d.n, fac: c.fac }); b.civic = true; bl.civicBld = b;
      if (c.extra) for (const e of c.extra) { const bb = s.addBld(e.key, bl.x + e.dx, bl.y + e.dy, { label: e.label }); if (e.army) s.army = { x: (bb.x + bb.w / 2) * T, y: (bb.y + bb.h + 1) * T, bld: bb.id }; }
      if (c.army) s.army = { x: (b.x + b.w / 2) * T, y: (b.y + b.h + 1) * T, bld: b.id };
    }
    // homes & shops (civic blocks get houses in whatever room is left around the big building)
    const rest = blocks.filter((b) => !used.has(b) || (b.civicBld && !b.plazaBlock));
    const homes = [];
    for (const bl of rest) {
      const kinds = spec.kinds(bl);
      const placed = fillBlock(s, bl, kinds, 1);
      placed.forEach((p) => { if (C.BLD[p.key].tag === 'home') homes.push(p); });
    }
    // households -> homes (cuarterías host 4 households)
    let hi = 0;
    for (const b of homes) { const cap = b.key === 'cuarteria' ? 4 : b.key === 'edificio' ? 3 : 1; for (let c = 0; c < cap && hi < hhs.length; c++, hi++) { hhs[hi].bld = b.id; b.hh = b.hh < 0 ? hhs[hi].id : b.hh; s.homes.push({ hh: hhs[hi].id, bld: b.id }); if (cap === 1) famLabel(b, hhs[hi]); } }
    s.dwellings = homes;
    // trees along streets
    for (let i = 0; i < s.tw * s.th * 0.004; i++) { const p = s.randomFree([G, SAND]); if (!s.blds.some((b) => p.x >= b.x - 1 && p.x < b.x + b.w + 1 && p.y >= b.y - 1 && p.y < b.y + b.h + 1)) s.prop(R() < 0.5 ? 'palm' : 'tree', p.x, p.y); }
    scatterTrees(s, 0.04, (x, y) => s.get(x, y) === FOR, [FOR]);
    for (const e of spec.exits) addExit(s, e[0], e[1], e[2], e[3], e[4]);
    s.spawn = { x: (s.plaza ? s.plaza.x : s.tw / 2) * T, y: ((s.plaza ? s.plaza.y : s.th / 2) + 4) * T };
    s.title = spec.title;
    if (spec.after) spec.after(s);
  }

  gen.manzanillo = function (s, hhs) {
    buildTown(s, hhs, {
      seed: 61, title: 'Manzanillo', grid: { x0: 12, y0: 10, sx: 14, sy: 13, street: 3, paved: false },
      water: (s) => { for (let y = 0; y < s.th; y++) { const sh = 8 + Math.sin(y * 0.2) * 2; for (let x = 0; x < sh + 4; x++) s.set(x, y, x > sh ? SAND : x > sh - 3 ? SHAL : DEEP); } for (let y = 0; y < s.th; y++) for (let x = 0; x < 9; x++) s.set(x, y, x < 5 ? DEEP : x < 7 ? SHAL : SAND); },
      civic: [{ gx: 2, gy: 1, key: 'iglesia', label: 'Iglesia de la Purísima' }, { gx: 3, gy: 1, plaza: 'Parque Céspedes', key: 'fabrica' }, { gx: 4, gy: 1, key: 'ayuntamiento' },
        { gx: 3, gy: 0, key: 'cuartel', label: 'Cuartel de Manzanillo', army: true }, { gx: 3, gy: 2, key: 'cine', label: 'Cine' }, { gx: 1, gy: 3, key: 'hospital' }, { gx: 5, gy: 3, key: 'sindicato', label: 'Sindicato de Obreros' },
        { gx: 1, gy: 0, key: 'almacen', label: 'Almacén del puerto' }, { gx: 1, gy: 1, key: 'almacen', label: 'Almacén del puerto' }, { gx: 0, gy: 2, key: 'gasolinera', label: 'Gasolinera Texaco' }, { gx: 5, gy: 0, key: 'central', label: 'Central azucarero' }],
      kinds: (b) => [['casa', 5], ['bohio', 2], ['bodega', 1.1], ['tienda', 0.6], ['cafe', 0.5], ['barberia', 0.4], ['farmacia', 0.3], ['cuarteria', 1.4]],
      exits: [['e', 22, 32, 'Camino a Palmarito / Sierra', 'palmarito'], ['e', 36, 44, 'Carretera a Bayamo', 'bayamo'], ['s', 40, 54, 'Camino a Cayo Piedra', 'cayo']],
      after: (s) => { s.pierPx = { x: 7 * T, y: 30 * T }; s.rect(5, 29, 8, 2, PIER); s.boatSpots = [{ x: 5 * T, y: 34 * T }, { x: 4 * T, y: 24 * T }]; s.objs.push({ k: 'deposito', label: 'Depósito de gasolina (puerto)', x: 14 * T, y: 36 * T, hp: 70, w: 28, h: 20 }); },
    });
  };
  gen.bayamo = function (s, hhs) {
    buildTown(s, hhs, {
      seed: 62, title: 'Bayamo', grid: { x0: 8, y0: 8, sx: 14, sy: 13, street: 3, paved: false },
      water: (s) => { const rp = []; for (let y = 0; y < s.th; y += 4) rp.push([s.tw - 12 + Math.sin(y * 0.2) * 3, y]); s.line(rp, 3, SHAL); },
      civic: [{ gx: 2, gy: 1, plaza: 'Plaza del Himno', key: 'fabrica' }, { gx: 3, gy: 1, key: 'iglesia', label: 'Parroquia Mayor' }, { gx: 1, gy: 1, key: 'ayuntamiento' },
        { gx: 2, gy: 0, key: 'cuartel', label: 'Cuartel Carlos M. de Céspedes', army: true }, { gx: 2, gy: 2, key: 'cine', label: 'Cine' }, { gx: 4, gy: 2, key: 'hospital' }, { gx: 0, gy: 2, key: 'sindicato', label: 'Sindicato' },
        { gx: 4, gy: 0, key: 'central', label: 'Central azucarero' }, { gx: 0, gy: 0, key: 'gasolinera', label: 'Gasolinera Esso' }, { gx: 3, gy: 3, key: 'escuela', label: 'Instituto' }, { gx: 5, gy: 1, key: 'almacen', label: 'Almacén' }],
      kinds: (b) => [['casa', 5], ['bohio', 1.5], ['bodega', 1.1], ['tienda', 0.6], ['cafe', 0.5], ['barberia', 0.4], ['farmacia', 0.3], ['cuarteria', 1.2]],
      exits: [['w', 20, 30, 'Camino a Manzanillo', 'manzanillo'], ['w', 40, 48, 'Hacia Palmarito', 'palmarito'], ['e', 20, 30, 'Carretera a Santiago', 'santiago'], ['s', 36, 48, 'Carretera a La Habana', 'habana']],
      after: (s) => { s.objs.push({ k: 'torre', label: 'Torre de radio', x: 30 * T, y: 22 * T, hp: 50, w: 8, h: 8 }); },
    });
  };
  gen.santiago = function (s, hhs) {
    buildTown(s, hhs, {
      seed: 63, title: 'Santiago de Cuba', grid: { x0: 8, y0: 8, sx: 13, sy: 12, street: 3, paved: true },
      water: (s) => { const nz = C.makeNoise(5); for (let y = s.th - 14; y < s.th; y++) for (let x = 0; x < s.tw; x++) { const d = y - (s.th - 14 + Math.sin(x * 0.16) * 2); s.set(x, y, d > 4 ? DEEP : d > 1 ? SHAL : SAND); } for (let y = 0; y < 14; y++) for (let x = 0; x < s.tw; x++) if (nz(x * 0.1, y * 0.1) > 0.55 + y * 0.02 && y < 10) s.set(x, y, y < 7 ? ROCK : FOR); },
      civic: [{ gx: 3, gy: 2, plaza: 'Parque Céspedes', key: 'fabrica' }, { gx: 4, gy: 2, key: 'catedral', label: 'Catedral' }, { gx: 2, gy: 2, key: 'hotel', label: 'Hotel Casa Granda' }, { gx: 3, gy: 1, key: 'ayuntamiento' },
        { gx: 7, gy: 3, key: 'cuartel', label: 'Cuartel Moncada', army: true, extra: [{ key: 'polvorin', dx: 1, dy: 6, label: 'Polvorín' }] }, { gx: 1, gy: 1, key: 'univ', label: 'Universidad de Oriente' }, { gx: 0, gy: 3, key: 'hospital', label: 'Hospital Saturnino Lora' },
        { gx: 5, gy: 3, key: 'policia', label: 'Jefatura de Policía' }, { gx: 4, gy: 3, key: 'sim', label: 'Cuartel del SIM' }, { gx: 2, gy: 3, key: 'ron', label: 'Ron Bacardí (fábrica)' }, { gx: 6, gy: 1, key: 'sindicato', label: 'Sindicato (CTC)' },
        { gx: 5, gy: 1, key: 'teatro', label: 'Teatro Oriente' }, { gx: 0, gy: 1, key: 'iglesia', label: 'Iglesia bautista' }, { gx: 6, gy: 2, key: 'banco', label: 'Banco' }, { gx: 1, gy: 3, key: 'gasolinera', label: 'Gasolinera' }],
      kinds: (b) => [['casa', 4], ['cuarteria', 2.6], ['edificio', 1.2], ['bodega', 1.2], ['tienda', 0.8], ['cafe', 0.6], ['barberia', 0.4], ['farmacia', 0.4]],
      exits: [['n', 50, 62, 'Hacia la Sierra Maestra', 'sierra'], ['w', 30, 40, 'Carretera a Bayamo', 'bayamo'], ['w', 50, 58, 'Carretera a La Habana', 'habana']],
      after: (s) => { s.pierPx = { x: 40 * T, y: (s.th - 12) * T }; s.rect(38, s.th - 14, 3, 7, PIER); s.boatSpots = [{ x: 30 * T, y: (s.th - 5) * T }]; s.objs.push({ k: 'torre', label: 'Torre de radio de la policía', x: 66 * T, y: 38 * T, hp: 50, w: 8, h: 8 }); },
    });
  };
  gen.habana = function (s, hhs) {
    buildTown(s, hhs, {
      seed: 64, title: 'La Habana', grid: { x0: 8, y0: 12, sx: 13, sy: 11, street: 3, paved: true },
      water: (s) => { for (let y = 0; y < 9; y++) for (let x = 0; x < s.tw; x++) s.set(x, y, y < 5 ? DEEP : y < 7 ? SHAL : y < 8 ? SAND : PAVED); for (let x = 2; x < s.tw - 2; x++) s.set(x, 9, FENCE); },
      civic: [{ gx: 4, gy: 1, key: 'capitolio', label: 'El Capitolio' }, { gx: 4, gy: 0, key: 'hotel', label: 'Hotel Nacional' }, { gx: 2, gy: 1, key: 'palacio', label: 'Palacio Presidencial', army: true }, { gx: 1, gy: 2, key: 'univ', label: 'Universidad de La Habana (la Escalinata)' },
        { gx: 3, gy: 1, plaza: 'Parque Central', key: 'fabrica' }, { gx: 5, gy: 1, key: 'casino', label: 'Casino Tropicana' }, { gx: 6, gy: 1, key: 'banco', label: 'Banco Nacional' }, { gx: 3, gy: 2, key: 'radio', label: 'CMQ Radio' },
        { gx: 5, gy: 2, key: 'sim', label: 'Buró de Investigaciones (SIM)' }, { gx: 4, gy: 2, key: 'policia', label: 'Estación de policía' }, { gx: 2, gy: 2, key: 'hospital', label: 'Hospital Calixto García' }, { gx: 0, gy: 1, key: 'iglesia', label: 'Iglesia del Ángel' },
        { gx: 6, gy: 2, key: 'sindicato', label: 'Sindicato (CTC)' }, { gx: 1, gy: 1, key: 'teatro', label: 'Gran Teatro' }, { gx: 7, gy: 2, key: 'casino', label: 'Casino Capri' }, { gx: 0, gy: 2, key: 'almacen', label: 'Almacén Larrea (ron y azúcar)' }, { gx: 7, gy: 1, key: 'gasolinera', label: 'Gasolinera' }, { gx: 6, gy: 0, key: 'cafe', label: 'Café Paris' },
        { gx: 7, gy: 3, key: 'cuartel', label: 'Cuartel de la Policía Nacional', army: false }],
      kinds: (b) => [['edificio', 3], ['cuarteria', 2.6], ['casa', 3.5], ['tienda', 1.4], ['bodega', 1.4], ['cafe', 1], ['barberia', 0.5], ['farmacia', 0.6], ['casona', 0.5]],
      exits: [['w', 24, 34, 'Carretera Central (a Oriente)', 'bayamo'], ['e', 30, 40, 'Autopista a Santiago', 'santiago']],
      after: (s) => { s.objs.push({ k: 'torre', label: 'Torre de CMQ', x: 56 * T, y: 38 * T, hp: 50, w: 8, h: 8 }); const lb = s.blds.find((b) => b.label.indexOf('Larrea') >= 0); if (lb) s.larrea = lb.id; s.pierPx = { x: 20 * T, y: 6 * T }; s.rect(18, 5, 3, 5, PIER); s.boatSpots = [{ x: 14 * T, y: 3 * T }]; },
    });
  };

  // make sure every building door can be reached from the spawn point (carve a footpath if a door is walled in)
  function ensureAccess(s) {
    const tw = s.tw, th = s.th, N = tw * th; const reach = new Uint8Array(N);
    const st = s.nearFree(Math.floor(s.spawn.x / T), Math.floor(s.spawn.y / T), 10);
    const flood = (sx, sy) => { const q = [sy * tw + sx]; reach[q[0]] = 1; while (q.length) { const c = q.pop(); const x = c % tw, y = (c / tw) | 0; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= tw || ny >= th) continue; const i = ny * tw + nx; if (reach[i] || COST[s.tiles[i]] === 0) continue; reach[i] = 1; q.push(i); } } };
    flood(st.x, st.y);
    for (const b of s.blds) {
      if (!b.door || b.open) continue; const dx0 = b.door.tx, dy0 = b.door.ty; if (!s.in(dx0, dy0)) continue;
      const di = dy0 * tw + dx0; if (reach[di]) continue;
      // BFS through anything but buildings/deep water until we touch the reachable network
      const prev = new Int32Array(N).fill(-1), seen = new Uint8Array(N); const q = [di]; seen[di] = 1; let hit = -1;
      for (let qi = 0; qi < q.length && hit < 0; qi++) {
        const c = q[qi]; const x = c % tw, y = (c / tw) | 0;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx = x + dx, ny = y + dy; if (nx < 1 || ny < 1 || nx >= tw - 1 || ny >= th - 1) continue; const i = ny * tw + nx; if (seen[i]) continue;
          const t = s.tiles[i]; if (t === BLD || t === DEEP) continue; seen[i] = 1; prev[i] = c; q.push(i); if (reach[i]) { hit = i; break; }
        }
      }
      if (hit < 0) continue;
      for (let c = hit; c !== -1 && c !== di; c = prev[c]) { if (COST[s.tiles[c]] === 0) s.tiles[c] = TRAIL; }
      if (COST[s.tiles[di]] === 0) s.tiles[di] = TRAIL; flood(dx0, dy0);
    }
  }
  // ---------------- build / fetch scene ----------------
  const SIZES = { cane: [84, 60], sierra: [100, 70], village: [72, 52], fishing: [72, 52], manzanillo: [96, 66], bayamo: [96, 66], santiago: [112, 74], habana: [122, 80] };
  C.getScene = function (sid) {
    if (C.scenes[sid]) return C.scenes[sid];
    const S = C.SETTLEMENTS[sid]; const sz = SIZES[sid === 'palmarito' ? 'village' : sid === 'cayo' ? 'fishing' : sid === 'alegria' ? 'cane' : sid];
    const s = new Scene(sid, S.type, sz[0], sz[1]);
    // households to house (cap by scene capacity)
    const cap = { sierra: 6, palmarito: 62, cayo: 38, manzanillo: 90, bayamo: 84, santiago: 100, habana: 112, cane: 0 }[sid];
    const hhsAll = C.W.houses.filter((h) => h.sid === sid && h.members.some((m) => C.W.people[m].status === 'alive'));
    const R = C.RNG(C.hashStr(sid) ^ C.W.seed);
    const hhs = R.shuffle(hhsAll.slice()).slice(0, cap);
    const fn = sid === 'palmarito' ? gen.village : sid === 'cayo' ? gen.fishing : sid === 'alegria' ? gen.cane : gen[sid] || gen.sierra;
    fn(s, hhs);
    s.hhs = hhs;
    ensureAccess(s);
    C.scenes[sid] = s;
    return s;
  };

  // ---------------- pathfinding ----------------
  // mode: 'foot' | 'car' (roads strongly preferred, no forest) | 'boat'
  C.findPath = function (s, x0, y0, x1, y1, mode) {
    const tw = s.tw, th = s.th;
    let sx = Math.floor(x0 / T), sy = Math.floor(y0 / T), ex = Math.floor(x1 / T), ey = Math.floor(y1 / T);
    const cost = (t) => {
      if (mode === 'boat') return (t === DEEP || t === SHAL) ? 1 : 0;
      if (mode === 'car') { if (t === ROAD || t === PAVED || t === PLAZA) return 0.5; if (t === TRAIL) return 0.8; if (t === G || t === SAND) return 2.2; if (t === CANE) return 3.5; return 0; }
      return COST[t];
    };
    const ok = (x, y) => x >= 0 && y >= 0 && x < tw && y < th && cost(s.tiles[y * tw + x]) > 0;
    if (!ok(ex, ey)) { const q = nearestOk(s, ex, ey, cost); if (!q) return null; ex = q.x; ey = q.y; }
    if (!ok(sx, sy)) { const q = nearestOk(s, sx, sy, cost); if (!q) return null; sx = q.x; sy = q.y; }
    const h = (x, y) => Math.hypot(x - ex, y - ey);
    const g = new Float32Array(tw * th).fill(1e9), from = new Int32Array(tw * th).fill(-1), closed = new Uint8Array(tw * th);
    const heap = new C.Heap(); const si = sy * tw + sx, ei = ey * tw + ex;
    g[si] = 0; heap.push(si, h(sx, sy));
    let n = 0;
    const DX = [1, -1, 0, 0, 1, 1, -1, -1], DY = [0, 0, 1, -1, 1, -1, 1, -1];
    while (heap.size && n++ < 9000) {
      const cur = heap.pop(); if (closed[cur]) continue; closed[cur] = 1;
      if (cur === ei) break;
      const cx = cur % tw, cy = (cur / tw) | 0;
      for (let d = 0; d < 8; d++) {
        const nx = cx + DX[d], ny = cy + DY[d]; if (!ok(nx, ny)) continue;
        if (d >= 4 && (!ok(cx + DX[d], cy) || !ok(cx, cy + DY[d]))) continue;
        const ni = ny * tw + nx; if (closed[ni]) continue;
        const ng = g[cur] + cost(s.tiles[ni]) * (d >= 4 ? 1.414 : 1);
        if (ng < g[ni]) { g[ni] = ng; from[ni] = cur; heap.push(ni, ng + h(nx, ny)); }
      }
    }
    if (from[ei] < 0 && ei !== si) return null;
    const out = []; let c = ei;
    while (c !== si && c >= 0) { out.push({ x: (c % tw) * T + T / 2, y: ((c / tw) | 0) * T + T / 2 }); c = from[c]; }
    out.reverse();
    // string-pull: drop collinear waypoints
    const sm = []; for (let i = 0; i < out.length; i++) { if (i === 0 || i === out.length - 1 || (out[i + 1].x - out[i].x) * (out[i].y - out[i - 1].y) !== (out[i + 1].y - out[i].y) * (out[i].x - out[i - 1].x)) sm.push(out[i]); }
    return sm;
  };
  function nearestOk(s, x, y, cost) {
    for (let r = 1; r < 14; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
      const nx = x + dx, ny = y + dy; if (nx >= 0 && ny >= 0 && nx < s.tw && ny < s.th && cost(s.tiles[ny * s.tw + nx]) > 0) return { x: nx, y: ny };
    }
    return null;
  }

  // movement/collision test for foot units (radius r px)
  C.footBlocked = function (s, x, y, r) {
    r = r || 4;
    const tw = s.tw, th = s.th;
    for (const [ox, oy] of [[-r, -r], [r, -r], [-r, r], [r, r]]) {
      const tx = Math.floor((x + ox) / T), ty = Math.floor((y + oy) / T);
      if (tx < 0 || ty < 0 || tx >= tw || ty >= th) return true;
      if (COST[s.tiles[ty * tw + tx]] === 0) return true;
    }
    return false;
  };
  C.tileAt = function (s, x, y) { const tx = Math.floor(x / T), ty = Math.floor(y / T); return (tx < 0 || ty < 0 || tx >= s.tw || ty >= s.th) ? ROCK : s.tiles[ty * s.tw + tx]; };
  // line-of-sight opacity sum between two points
  C.losOpacity = function (s, x0, y0, x1, y1) {
    const d = Math.hypot(x1 - x0, y1 - y0); const n = Math.ceil(d / (T * 0.5)); let sum = 0, last = -1;
    for (let i = 1; i < n; i++) {
      const x = x0 + (x1 - x0) * i / n, y = y0 + (y1 - y0) * i / n; const tx = Math.floor(x / T), ty = Math.floor(y / T);
      const idx = ty * s.tw + tx; if (idx === last) continue; last = idx;
      if (tx < 0 || ty < 0 || tx >= s.tw || ty >= s.th) return 2;
      sum += OPAC[s.tiles[idx]]; if (sum >= 1) return sum;
    }
    return sum;
  };
  C.bulletBlockChance = (t) => BLOCKB[t] || 0;
})();
