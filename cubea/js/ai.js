/* CUBEA — ai.js : actors (runtime cubes), daily schedules for civilians, army behaviour, rebel squad orders with
   telegraphed obedience, camouflage, animals and vehicles. */
(function () {
  'use strict';
  const C = (window.C = window.C || {});
  const T = C.T, TL = C.TILE, clamp = C.clamp;
  const G = () => C.G;

  const ANIMALS = {
    cow: { n: 'vaca', sz: 7, col: [236, 232, 220], patch: [60, 50, 44], horns: true, food: 40, spd: 10 },
    pig: { n: 'cerdo', sz: 4.5, col: [232, 160, 160], food: 18, spd: 14 },
    hen: { n: 'gallina', sz: 2.5, col: [250, 246, 238], food: 4, spd: 16 },
    hutia: { n: 'jutía', sz: 3, col: [120, 90, 60], food: 6, spd: 30, wild: true },
    boar: { n: 'puerco jíbaro', sz: 5, col: [90, 66, 54], food: 22, spd: 34, wild: true },
    turkey: { n: 'guanajo', sz: 3.4, col: [100, 70, 50], food: 8, spd: 24, wild: true },
  };
  C.ANIMALS = ANIMALS;

  // ---------------- create actors ----------------
  C.makeActor = function (s, p, x, y) {
    const a = {
      p, id: p.id, x, y, vx: 0, vy: 0, face: 1, anim: 0, moving: false, side: 'civ', squad: -1, isPlayer: false,
      weapon: null, weaponOut: false, aim: 0, dead: false, gone: false, inside: false, bld: -1, alpha: 1,
      path: null, pi: 0, goalT: 0, wait: 0, task: null, taskT: 0, camo: 0, hide: false, prone: false, panic: 0, pain: 0, shooting: 0, muzzle: 0, talking: 0, blink: 0, blinkT: 2 + Math.random() * 4,
      expr: { brow: 0, browY: 0, lid: 0, wide: 0, mouth: 0, open: 0, squint: 0, sweat: 0, tear: 0, label: 'sereno' }, bubble: null,
      drawColor: C.loyaltyColor(p.stance, p.conv), cd: 0, reload: 0, brain: { mode: 'idle', target: null, seen: 0, lastX: 0, lastY: 0, alertT: 0 },
      susp: 0, sel: false, hover: false, spotted: 0, order: null, orderT: 0, nextPlan: 0, speed: 38, suppressed: 0, lastHit: -99, bleeding: false, deadRot: 0, hurtT: 0, scene: s,
    };
    p.actor = a; return a;
  };
  function giveWeapon(a, k, ammo) {
    const w = C.WEAPONS[k]; a.weapon = { k, mag: w.mag, spare: ammo === undefined ? w.mag * 3 : ammo }; a.p.wpn = k;
  }
  C.giveWeapon = giveWeapon;

  function homeB(s, p) { const h = C.W.houses[p.hh]; if (!h || h.bld < 0) return null; const b = s.blds[h.bld]; return b && s.hhs.includes(h) ? b : null; }

  // gather the persons that should be shown in a scene
  C.scenePeople = function (s) {
    const out = []; const ids = C.W.bySet[s.sid] || [];
    const inDistrict = new Set(s.hhs.map((h) => h.id));
    for (const id of ids) {
      const p = C.W.people[id]; if (p.status !== 'alive') continue;
      if (p.actor && p.actor.scene !== s) continue;
      const keep = p.roster || p.mil || inDistrict.has(p.hh);
      if (keep) out.push(p);
    }
    return out;
  };

  C.spawnScene = function (s) {
    if (s.spawned) return; s.spawned = true;
    const R = C.rnd; const hr = G().hour;
    const people = C.scenePeople(s);
    const wd = G().weekday;
    for (const p of people) {
      if (s.sid === 'alegria') continue;
      const a = C.makeActor(s, p, 0, 0);
      initSide(s, a);
      placeInitially(s, a, hr, wd);
      s.actors.push(a);
    }
    spawnAnimals(s); spawnVehicles(s);
  };

  function initSide(s, a) {
    const p = a.p;
    if (p.mil && p.mil.side === 'army') {
      a.side = 'army';
      const role = p.occ;
      const wk = role === 'oficial' ? 'thompson' : role === 'policia' ? C.rnd.pick(['pistol', 'rifle']) : role === 'sim' ? 'pistol' : C.rnd.pick(['garand', 'rifle', 'rifle', 'thompson']);
      giveWeapon(a, wk); a.weaponOut = true; a.p.look.hat = a.p.look.hat || (role === 'policia' || role === 'oficial' ? 'kepi' : 'helmet');
      a.speed = 42; a.brain.mode = 'patrol';
    } else if (p.mil && p.mil.side === 'rebel') { a.side = 'rebel'; }
    else {
      a.side = 'civ';
      if (p.occ === 'mayordomo' || p.occ === 'hacendado') giveWeapon(a, 'pistol', 12);
      else if (['macheteo', 'colono', 'guajiro', 'carbonero', 'vaquero'].includes(p.occ) && p.sex === 'M' && C.ageOf(p) >= 16 && C.rnd.chance(0.5)) giveWeapon(a, 'machete', 1);
      else if (C.rnd.chance(0.04) && p.sex === 'M') giveWeapon(a, 'revolver', 6);
      a.weaponOut = false;
    }
    a.speed = (a.speed || 36) * (C.ageOf(p) > 60 ? 0.7 : C.ageOf(p) < 12 ? 0.85 : 1);
  }

  function placeInitially(s, a, hr, wd) {
    const p = a.p;
    if (a.side === 'army') {
      const post = s.army || { x: s.tw * T / 2, y: s.th * T / 2 };
      const ang = Math.random() * 6.28, r = 20 + Math.random() * 70;
      const q = s.nearFree(Math.floor((post.x + Math.cos(ang) * r) / T), Math.floor((post.y + Math.sin(ang) * r) / T), 6, [TL.FENCE]);
      a.x = q.x * T + 8; a.y = q.y * T + 8;
      a.brain.post = { x: post.x, y: post.y }; a.brain.role = Math.random() < 0.4 ? 'guard' : 'patrol';
      a.brain.home = { x: a.x, y: a.y };
      return;
    }
    const plan = planFor(s, a, hr, wd);
    if (plan.kind === 'in' && plan.b) { a.inside = true; a.bld = plan.b.id; const d = s.doorPx(plan.b); a.x = d.x; a.y = d.y; a.task = plan; a.nextPlan = G().min + 30 + Math.random() * 90; return; }
    const pos = plan.x !== undefined ? { x: plan.x, y: plan.y } : s.centerPx(s.blds[0] || { x: 10, y: 10, w: 1, h: 1 });
    const q = s.nearFree(Math.floor(pos.x / T), Math.floor(pos.y / T), 6, [TL.DEEP]);
    a.x = q.x * T + 8; a.y = q.y * T + 8; a.task = plan; a.nextPlan = G().min + 20 + Math.random() * 80;
  }

  // ---------------- daily schedule ----------------
  const BYTAG = (s, tag) => s.blds.filter((b) => b.tag === tag && !b.open);
  function pickB(s, a, tag) { const L = BYTAG(s, tag); return L.length ? L[(a.p.id * 7 + 3) % L.length] : null; }
  function planFor(s, a, hr, wd) {
    const p = a.p, age = C.ageOf(p), R = Math.random;
    const home = homeB(s, p);
    const sunday = wd === 6;
    const goHome = () => (home ? { kind: 'in', b: home } : { kind: 'spot', x: s.spawn.x + (R() - 0.5) * 200, y: s.spawn.y + (R() - 0.5) * 120 });
    if (hr >= 21.5 || hr < 5.5) return goHome();
    if (s.sid === 'alegria') return goHome();
    const plaza = s.plaza ? { x: s.plaza.x * T, y: s.plaza.y * T } : { x: s.spawn.x, y: s.spawn.y };
    const spotNear = (o, r) => ({ kind: 'spot', x: o.x + (R() - 0.5) * r, y: o.y + (R() - 0.5) * r * 0.7 });
    if (sunday && hr >= 9 && hr < 11 && (p.traits.includes('devout') || R() < 0.45)) { const ch = pickB(s, a, 'church'); if (ch) return { kind: 'in', b: ch }; }
    if (age < 13) {
      if (hr >= 8 && hr < 12.5 && !sunday) { const sc = pickB(s, a, 'school'); if (sc && age >= 6) return { kind: 'in', b: sc }; }
      const h = home ? s.doorPx(home) : plaza; return spotNear(R() < 0.4 ? plaza : h, 90);
    }
    const lunch = hr >= 12 && hr < 14;
    if (lunch && R() < 0.5) return goHome();
    if (hr >= 18) { if (R() < 0.45) return spotNear(plaza, 150); if (R() < 0.4) { const cf = pickB(s, a, 'shop'); if (cf) return { kind: 'in', b: cf }; } return goHome(); }
    const o = p.occ;
    if (sunday && !['bodeguero', 'sacerdote', 'medico', 'casino', 'camarero'].includes(o)) { return R() < 0.5 ? spotNear(plaza, 160) : goHome(); }
    const fieldSpot = () => { const f = s.pois.filter((q) => q.k === 'field'); if (f.length) { const q = f[(p.id + Math.floor(G().min / 120)) % f.length]; return { kind: 'work', x: q.tx * T + 8 + R() * 30, y: q.ty * T + 8 + R() * 30, work: 'cut' }; } return spotNear(plaza, 200); };
    switch (o) {
      case 'macheteo': case 'colono': case 'guajiro': case 'vaquero': return s.type === 'cane' ? goHome() : fieldSpot();
      case 'carbonero': { const pr = s.props.filter((q) => q.k === 'carbonera'); if (pr.length) { const q = pr[p.id % pr.length]; return { kind: 'work', x: q.x + (R() - 0.5) * 30, y: q.y + 14 + R() * 12, work: 'burn' }; } return fieldSpot(); }
      case 'pescador': if (s.pierPx) { return { kind: 'work', x: s.pierPx.x + (R() - 0.5) * 70, y: s.pierPx.y - R() * 20, work: 'fish' }; } return spotNear(plaza, 120);
      case 'bodeguero': case 'dependiente': case 'comerciante': case 'costurera': case 'barbero': case 'sastre': { const b = pickB(s, a, 'shop'); return b ? { kind: 'in', b } : goHome(); }
      case 'maestro': { const b = pickB(s, a, 'school') || pickB(s, a, 'univ'); return b ? { kind: 'in', b } : goHome(); }
      case 'estudiante': { const b = pickB(s, a, 'univ') || pickB(s, a, 'school'); return b && hr < 16 ? { kind: 'in', b } : spotNear(plaza, 140); }
      case 'sacerdote': case 'monja': { const b = pickB(s, a, 'church'); return b ? { kind: 'in', b } : goHome(); }
      case 'medico': case 'partera': { const b = pickB(s, a, 'clinic'); return b ? { kind: 'in', b } : goHome(); }
      case 'obrerocentral': case 'obrerofab': case 'ferroviario': { const b = pickB(s, a, 'factory'); return b ? { kind: 'in', b } : fieldSpot(); }
      case 'estibador': { if (s.pierPx) return { kind: 'work', x: s.pierPx.x + R() * 60, y: s.pierPx.y + 10, work: 'haul' }; const b = pickB(s, a, 'store'); return b ? { kind: 'in', b } : goHome(); }
      case 'funcionario': case 'abogado': { const b = pickB(s, a, 'gov') || pickB(s, a, 'bank'); return b ? { kind: 'in', b } : goHome(); }
      case 'banquero': { const b = pickB(s, a, 'bank'); return b ? { kind: 'in', b } : goHome(); }
      case 'sindicalista': { const b = pickB(s, a, 'union'); return b ? { kind: 'in', b } : goHome(); }
      case 'periodista': case 'locutor': { const b = pickB(s, a, 'radio') || pickB(s, a, 'leisure'); return b ? { kind: 'in', b } : goHome(); }
      case 'casino': case 'camarero': case 'musico': { const b = pickB(s, a, 'casino') || pickB(s, a, 'hotel') || pickB(s, a, 'leisure'); return b ? { kind: 'in', b } : goHome(); }
      case 'chofer': case 'mecanico': { const b = pickB(s, a, 'fuel') || pickB(s, a, 'store'); return b ? { kind: 'in', b } : spotNear(plaza, 160); }
      case 'domestica': case 'lavandera': { const b = homeB(s, p) || pickB(s, a, 'home'); return R() < 0.5 ? spotNear(plaza, 140) : (b ? { kind: 'in', b } : goHome()); }
      case 'ama': return R() < 0.5 ? goHome() : R() < 0.6 ? spotNear(plaza, 150) : (pickB(s, a, 'shop') ? { kind: 'in', b: pickB(s, a, 'shop') } : goHome());
      case 'jubilado': return R() < 0.5 ? spotNear(plaza, 100) : goHome();
      case 'hacendado': case 'mayordomo': { if (s.type === 'village') { const pr = BYTAG(s, 'home').find((b) => /Mayordomo|hacendado/.test(b.label)); if (pr) return { kind: 'in', b: pr }; } return spotNear(plaza, 100); }
      default: return R() < 0.5 ? spotNear(plaza, 150) : goHome();
    }
  }

  // ---------------- animals & vehicles ----------------
  function spawnAnimals(s) {
    const R = C.RNG(C.hashStr(s.sid) + 77);
    const add = (k, x, y) => s.animals.push({ k, def: ANIMALS[k], x, y, hx: x, hy: y, face: 1, anim: 0, moving: false, dead: false, wait: R() * 4, hp: k === 'cow' ? 80 : 30, tx: x, ty: y, wild: !!ANIMALS[k].wild });
    if (s.type === 'village' || s.type === 'fishing') {
      for (const hm of s.homes.slice(0, 30)) { const b = s.blds[hm.bld]; if (R() < 0.6) { const n = R.irange(1, 3); for (let i = 0; i < n; i++) add('hen', (b.x + b.w / 2) * T + R.range(-30, 30), (b.y + b.h + 1.5) * T + R.range(0, 16)); } if (R() < 0.18) add('pig', (b.x + b.w + 1.5) * T, (b.y + b.h / 2) * T); }
      if (s.type === 'village') for (let i = 0; i < 6; i++) { const q = s.randomFree([TL.G]); add('cow', q.x * T + 8, q.y * T + 8); }
    }
    if (s.type === 'sierra') { for (let i = 0; i < 9; i++) { const q = s.randomFree([TL.FOR]); add('hutia', q.x * T + 8, q.y * T + 8); } for (let i = 0; i < 4; i++) { const q = s.randomFree([TL.FOR]); add('boar', q.x * T + 8, q.y * T + 8); } for (let i = 0; i < 3; i++) { const q = s.randomFree([TL.G, TL.FOR]); add('turkey', q.x * T + 8, q.y * T + 8); } }
    if (s.type === 'cane') for (let i = 0; i < 3; i++) { const q = s.randomFree([TL.G]); add('hen', q.x * T + 8, q.y * T + 8); }
  }
  C.addVehicle = function (s, type, x, y, ang, opt) {
    const d = C.VEHICLES[type]; opt = opt || {};
    const v = { type, def: d, x, y, ang: ang || 0, spd: 0, fuel: opt.fuel !== undefined ? opt.fuel : d.tank * (0.25 + Math.random() * 0.7), tires: [1, 1, 1, 1], hp: d.hp, driver: null, pass: [], wreck: false, burning: 0, gone: false, army: !!d.army, lights: false, route: null, wait: 0, owner: opt.owner || null, engine: 1, loot: opt.loot || 0 };
    if (opt.flat) v.tires[Math.floor(Math.random() * 4)] = 0.05;
    if (d.tank === 0) v.fuel = 0;
    s.vehicles.push(v); return v;
  };
  function spawnVehicles(s) {
    const R = C.RNG(C.hashStr(s.sid) + 5);
    const roadTiles = []; for (let y = 0; y < s.th; y++) for (let x = 0; x < s.tw; x++) { const t = s.tiles[y * s.tw + x]; if (t === TL.ROAD || t === TL.PAVED) roadTiles.push([x, y]); }
    const roadPick = () => roadTiles.length ? roadTiles[R.int(roadTiles.length)] : null;
    const park = (type, n, opt) => { for (let i = 0; i < n; i++) { const q = roadPick(); if (!q) return; const horiz = s.get(q[0] + 1, q[1]) === s.get(q[0], q[1]) || s.get(q[0] - 1, q[1]) === s.get(q[0], q[1]); const v = C.addVehicle(s, type, q[0] * T + 8, q[1] * T + 8, horiz ? 0 : Math.PI / 2, Object.assign({ flat: R() < 0.12 }, opt)); } };
    switch (s.sid) {
      case 'sierra': { const h = s.hamlet[0]; C.addVehicle(s, 'oxcart', (h.x + 4) * T, (h.y + 4) * T, 0); C.addVehicle(s, 'armyjeep', s.army.x + 40, s.army.y + 30, 0, { fuel: 30 }); break; }
      case 'palmarito': { C.addVehicle(s, 'oxcart', 30 * T, 36 * T, 0.3); C.addVehicle(s, 'oxcart', 14 * T, 30 * T, 1.2); const c = s.blds.find((b) => /hacendado/.test(b.label)); if (c) C.addVehicle(s, 'truck', (c.x + 1) * T, (c.y + c.h + 2) * T, 0, { fuel: 50 }); C.addVehicle(s, 'armyjeep', s.army.x - 50, s.army.y + 10, 0, { fuel: 35 }); break; }
      case 'cayo': { (s.boatSpots || []).forEach((q, i) => C.addVehicle(s, 'boat', q.x, q.y, 0.2 * i, { fuel: 18 + i * 6 })); park('truck', 1); break; }
      case 'manzanillo': case 'bayamo': { park('car', 5); park('truck', 2); park('bus', 1); if (s.army) { C.addVehicle(s, 'armytruck', s.army.x + 30, s.army.y + 20, 0, { fuel: 70 }); C.addVehicle(s, 'armyjeep', s.army.x - 30, s.army.y + 20, 0, { fuel: 38 }); } if (s.boatSpots) s.boatSpots.forEach((q) => C.addVehicle(s, 'boat', q.x, q.y, 0.4, { fuel: 24 })); break; }
      case 'santiago': case 'habana': { park('car', 10); park('truck', 2); park('bus', 2); if (s.army) { C.addVehicle(s, 'armytruck', s.army.x + 30, s.army.y + 24, 0, { fuel: 80 }); C.addVehicle(s, 'armyjeep', s.army.x - 30, s.army.y + 24, 0, { fuel: 40 }); C.addVehicle(s, 'armyjeep', s.army.x, s.army.y + 40, 0, { fuel: 40 }); } if (s.boatSpots) s.boatSpots.forEach((q) => C.addVehicle(s, 'boat', q.x, q.y, 0.4, { fuel: 24 })); break; }
      case 'alegria': break;
    }
    // some cars drive around town
    for (const v of s.vehicles) if ((v.type === 'car' || v.type === 'bus') && R() < 0.5 && (s.type === 'town' || s.type === 'city' || s.type === 'capital')) { v.driving = true; v.fuel = Math.max(v.fuel, 25); v.lights = false; }
  }

  // ---------------- movement ----------------
  function setPath(s, a, x, y, mode) {
    a.path = C.findPath(s, a.x, a.y, x, y, mode || 'foot'); a.pi = 0; a.goalT = 0;
    return !!a.path;
  }
  C.setGoal = function (a, x, y) { return setPath(a.scene, a, x, y); };
  function followPath(s, a, dt, speed) {
    if (!a.path || a.pi >= a.path.length) { a.moving = false; return true; }
    const w = a.path[a.pi]; let dx = w.x - a.x, dy = w.y - a.y; const d = Math.hypot(dx, dy);
    if (d < 3.2) { a.pi++; if (a.pi >= a.path.length) { a.moving = false; return true; } return false; }
    dx /= d; dy /= d; stepMove(s, a, dx * speed * dt, dy * speed * dt); a.moving = true; if (Math.abs(dx) > 0.2) a.face = dx > 0 ? 1 : -1;
    return false;
  }
  function stepMove(s, a, mx, my) {
    const r = 3.6;
    if (!C.footBlocked(s, a.x + mx, a.y, r)) a.x += mx; else if (!C.footBlocked(s, a.x + mx, a.y - 3, r)) { a.x += mx; a.y -= 1; }
    if (!C.footBlocked(s, a.x, a.y + my, r)) a.y += my;
    // anim
    a.anim += Math.hypot(mx, my) * 0.5;
  }
  C.stepMove = stepMove;
  function terrainSpeed(s, a) { const t = C.tileAt(s, a.x, a.y); let k = 1 / (C.TCOST[t] || 1); if (a.p.limp) k *= 0.72; if (a.prone || a.hide) k *= 0.55; if (G().weather.rain > 0.3 && (t === TL.G || t === TL.TRAIL)) k *= 0.88; if (a.p.needs.energy < 20) k *= 0.8; return clamp(k, 0.4, 1.5); }

  C.say = function (a, text, col, dur) { a.bubble = { text, col, t: dur || 2.6 }; };

  // ---------------- detection & suspicion ----------------
  function isHostile(a, b) { // would a (army/rebel) shoot b?
    if (b.dead || b.inside || b.gone) return false;
    if (a.side === 'army') {
      if (b.side === 'rebel' || b.isPlayer) return !(b.covertNow) || b.exposed > 0;
      return false;
    }
    if (a.side === 'rebel') return b.side === 'army' && !b.surrendered;
    return false;
  }
  C.isHostile = isHostile;
  function detectRange(viewer, tgt, s) {
    let r = 210;
    const g = G();
    const dark = g.hour < 5 || g.hour >= 20 ? 0.55 : (g.hour < 7 || g.hour >= 18 ? 0.8 : 1);
    r *= dark * (1 - g.weather.rain * 0.25) * (1 - g.weather.fog * 0.35);
    r *= tgt.moving ? 1.0 : 0.72; if (tgt.prone || tgt.hide) r *= 0.7;
    r *= (tgt.weaponOut || tgt.shooting > 0) ? 1.35 : 1;
    if (tgt.shooting > 0) r *= 1.4;
    r *= 1 - 0.85 * tgt.camo;
    r *= 0.8 + 0.4 * clamp(viewer.p.exp / 60, 0, 1);
    return r;
  }
  C.detectRange = detectRange;

  // camouflage: how well does this person blend into the ground they stand on?
  C.camoTarget = function (a, s) {
    const t = C.tileAt(s, a.x, a.y);
    const env = t === TL.FOR ? 0 : t === TL.CANE ? 1 : t === TL.G || t === TL.TRAIL || t === TL.SAND ? 1 : 2;
    const cat = s.type === 'sierra' ? (t === TL.FOR || t === TL.ROCK ? 0 : 1) : (s.type === 'cane' ? (t === TL.FOR ? 0 : 1) : (s.type === 'village' || s.type === 'fishing') ? (t === TL.FOR ? 0 : 1) : (s.type === 'town' ? 2 : 3));
    const bg = C.BG[a.p.bgKey || (C.OCC[a.p.occ] || {}).bg || 'campesino'] || C.BG.campesino;
    let aff = bg[cat];
    if (cat <= 1) aff *= (t === TL.FOR ? 1 : t === TL.CANE ? 0.85 : t === TL.G ? 0.55 : t === TL.ROCK ? 0.7 : 0.25);
    if (cat >= 2) aff *= (t === TL.PAVED || t === TL.ROAD || t === TL.PLAZA) ? 0.85 : 0.5;
    const ex = clamp(0.3 + a.p.exp / 100 * 0.9, 0.3, 1.15);
    let k = aff * ex;
    if (a.moving) k *= (a.hide ? 0.7 : 0.45); else k *= 1.05;
    if (a.hide || a.prone) k *= 1.35;
    if (a.shooting > 0 || a.exposed > 0) k *= 0.2;
    if (a.side === 'army') k *= 0.25;
    return clamp(k, 0, 0.95);
  };
  // women and the urban young are suspected less in cities and towns
  C.suspicionFactor = function (a, s) {
    let k = 1;
    if (s.type === 'town' || s.type === 'city' || s.type === 'capital') {
      if (a.p.sex === 'F') k *= 0.55;
      const bg = (C.OCC[a.p.occ] || {}).bg; if (bg === 'estudiante' || bg === 'servicio' || bg === 'profesional') k *= 0.8;
      if (bg === 'campesino') k *= 1.6;
      if (a.p.eth === 'negra' || a.p.eth === 'mulata') k *= 1.15;     // police profiling was real
      k *= 1 - clamp(a.p.exp / 200, 0, 0.3);
    }
    return k;
  };

  // ---------------- the per-frame update ----------------
  C.updateScene = function (s, dt) {
    const g = G();
    s.time += dt;
    const acts = s.actors;
    // staggered detection for army, needs etc.
    for (let i = 0; i < acts.length; i++) {
      const a = acts[i]; if (a.dead || a.gone) continue;
      if (a.inVeh) { updateInVehicle(s, a, dt); continue; }
      commonUpdate(s, a, dt);
      if (a.isPlayer) continue;      // main.js drives the player
      if (a.inside) { insideUpdate(s, a, dt); continue; }
      if (a.side === 'army') armyUpdate(s, a, dt);
      else if (a.side === 'rebel') rebelUpdate(s, a, dt);
      else civUpdate(s, a, dt);
    }
    updateAnimals(s, dt); updateVehicles(s, dt);
    // spotted decay
    for (const a of acts) if (a.spotted > 0) a.spotted -= dt;
  };

  function commonUpdate(s, a, dt) {
    const p = a.p;
    a.shooting = Math.max(0, a.shooting - dt); a.muzzle = Math.max(0, a.muzzle - dt); a.pain = Math.max(0, a.pain - dt * 0.18); a.panic = Math.max(0, a.panic - dt * 0.08);
    a.talking = Math.max(0, a.talking - dt); a.hurtT = Math.max(0, a.hurtT - dt); a.exposed = Math.max(0, (a.exposed || 0) - dt); a.suppressed = Math.max(0, a.suppressed - dt);
    if (a.bubble) { a.bubble.t -= dt; if (a.bubble.t <= 0) a.bubble = null; }
    a.blinkT -= dt; if (a.blinkT <= 0) { a.blink = 0.9; a.blinkT = 2 + Math.random() * 5; } a.blink = Math.max(0, a.blink - dt * 7);
    a.cd = Math.max(0, a.cd - dt);
    if (a.reload > 0) { a.reload -= dt; if (a.reload <= 0 && a.weapon) { const w = C.WEAPONS[a.weapon.k]; const need = w.mag - a.weapon.mag; const take = Math.min(need, a.weapon.spare === undefined ? need : a.weapon.spare); a.weapon.mag += take; if (a.weapon.spare !== undefined) a.weapon.spare -= take; } }
    // slow expression + colour updates
    a.exprT = (a.exprT || 0) - dt;
    if (a.exprT <= 0) {
      a.exprT = 0.12; const tgt = C.expressionTargets(a); const k = 0.28, e = a.expr;
      for (const key of ['brow', 'browY', 'lid', 'wide', 'mouth', 'open', 'squint']) e[key] += (tgt[key] - e[key]) * k;
      e.sweat = tgt.sweat; e.tear = tgt.tear; e.label = tgt.label;
      // colour: loyalty (public) -> camouflage
      const shown = C.shownStance ? C.shownStance(a) : p.stance;
      let base = C.loyaltyColor(shown.v, shown.c);
      if (a.isPlayer) base = [196, 52, 46];
      // camo blend toward the terrain colour
      const t = C.tileAt(s, a.x, a.y); const env = t === TL.FOR ? [66, 112, 54] : t === TL.CANE ? [140, 156, 64] : (t === TL.PAVED || t === TL.PLAZA || t === TL.ROAD) ? [136, 134, 130] : t === TL.SAND ? [200, 184, 140] : t === TL.ROCK ? [112, 106, 98] : [104, 138, 70];
      const target = C.camoTarget(a, s);
      a.camo += (target - a.camo) * 0.12;
      const lum = base[0] * 0.3 + base[1] * 0.59 + base[2] * 0.11; const dull = C.mix(base, [lum, lum, lum], a.camo * 0.55);
      a.drawColor = C.mix(dull, env, Math.min(0.9, a.camo * 0.92));
      // pain darkens slightly
      if (a.pain > 0.2) a.drawColor = C.mix(a.drawColor, [200, 90, 80], a.pain * 0.25);
      // visibility to the player's eye
      const gp = G().player;
      if (!a.isPlayer && gp && a.side !== 'rebel' || (a.side === 'rebel' && a.squad < 0)) {
        const d = gp ? Math.hypot(a.x - gp.x, a.y - gp.y) : 0; a.alpha = clamp(1 - a.camo * (d > 55 ? 0.55 : 0.1), 0.35, 1);
      } else a.alpha = Math.max(0.6, 1 - a.camo * 0.35);
      if (a.dead) a.alpha = 1;
    }
    // aim smoothing already set by shooter; limbs anim
    if (!a.moving) a.anim *= 0.9;
    // needs decay while the scene runs (per game-minute)
    const gm = dt * g_minPerSec();
    const n = p.needs; const act = a.moving ? 1.25 : 0.75;
    n.food = Math.max(0, n.food - 0.024 * gm * (a.side === 'civ' ? 0.6 : 1) * act);
    n.water = Math.max(0, n.water - 0.07 * gm * act * (G().weather.rain > 0.4 ? 0.6 : 1));
    const expSave = 1 - clamp(p.exp / 100, 0, 1) * 0.32;
    if (a.inside || a.sleeping) n.energy = Math.min(100, n.energy + 0.14 * gm); else n.energy = Math.max(0, n.energy - 0.06 * gm * act * expSave * (a.running ? 2 : 1));
    // drink from water
    const tt = C.tileAt(s, a.x, a.y); if ((tt === TL.SHAL) && n.water < 95) n.water = Math.min(100, n.water + 0.9 * gm);
    p.stress = Math.max(0, p.stress - 0.02 * gm); p.anger = Math.max(0, p.anger - 0.02 * gm); p.fear = Math.max(p.fearBase || 0, p.fear - 0.03 * gm);
    // bleeding
    if (p.bleed > 0 && !a.dead) { p.hp -= p.bleed * dt * 0.9; p.bleed = Math.max(0, p.bleed - dt * 0.0015); a.bleeding = true; a.hurtT = 1; if (Math.random() < dt * 3) s.decals.push({ k: 'blood', x: a.x, y: a.y, r: 1.4 + Math.random() * 1.5, a: 0.5, rot: Math.random() * 6, t0: g().time, fade: 600 }); if (p.hp <= 0) C.die(a, a.lastAttacker, 'bleeding'); } else a.bleeding = false;
    if (a.side !== 'rebel' || a.squad < 0) a.hide = a.hide && false;
  }
  function g_minPerSec() { return G().minPerSec; }
  function g() { return G(); }

  // ---- inside a building ----
  function insideUpdate(s, a, dt) {
    a.sleeping = G().hour >= 22 || G().hour < 5;
    if (G().min >= a.nextPlan) {
      // leave and take a new plan
      const b = s.blds[a.bld];
      const plan = planFor(s, a, G().hour, G().weekday);
      if (plan.kind === 'in' && plan.b && plan.b.id === a.bld) { a.nextPlan = G().min + 40 + Math.random() * 120; return; }
      a.inside = false; a.sleeping = false; if (b) { const d = s.doorPx(b); a.x = d.x; a.y = d.y + 4; }
      applyPlan(s, a, plan);
    }
  }
  function applyPlan(s, a, plan) {
    a.task = plan; a.nextPlan = G().min + 50 + Math.random() * 130;
    if (plan.kind === 'in') { const d = s.doorPx(plan.b); setPath(s, a, d.x, d.y + 2); a.task.arrive = false; }
    else if (plan.x !== undefined) { setPath(s, a, plan.x, plan.y); }
  }

  // ---- civilians ----
  function civUpdate(s, a, dt) {
    const p = a.p;
    // react to gunfire / danger nearby
    if (a.panic > 0.5 || a.hurtT > 0) {
      // run for the nearest door or away from danger
      if (!a.fleeing) { a.fleeing = true; const doors = s.blds.filter((b) => b.door && !b.open && Math.hypot(s.doorPx(b).x - a.x, s.doorPx(b).y - a.y) < 400); doors.sort((q, r) => Math.hypot(s.doorPx(q).x - a.x, s.doorPx(q).y - a.y) - Math.hypot(s.doorPx(r).x - a.x, s.doorPx(r).y - a.y)); const b = doors[0]; if (b) { const d = s.doorPx(b); setPath(s, a, d.x, d.y + 2); a.task = { kind: 'in', b, flee: true }; } if (Math.random() < 0.3) C.say(a, ['¡Ay, Dios mío!', '¡Disparos!', '¡Al suelo!', '¡Corran!'][Math.floor(Math.random() * 4)], '#7a1d1d'); }
      const done = followPath(s, a, dt, a.speed * 1.9 * terrainSpeed(s, a)); a.running = true;
      if (done && a.task && a.task.kind === 'in' && a.task.b) { a.inside = true; a.bld = a.task.b.id; a.nextPlan = G().min + 25 + Math.random() * 40; a.fleeing = false; a.running = false; }
      return;
    }
    a.fleeing = false; a.running = false;
    const t = a.task;
    if (!t || G().min >= a.nextPlan) { const plan = planFor(s, a, G().hour, G().weekday); applyPlan(s, a, plan); return; }
    if (a.wait > 0) { a.wait -= dt; a.moving = false; if (t.work && a.wait > 0) { a.anim += dt * 4; a.working = true; } return; }
    a.working = false;
    const done = followPath(s, a, dt, a.speed * 0.85 * terrainSpeed(s, a));
    if (done) {
      if (t.kind === 'in' && t.b) { a.inside = true; a.bld = t.b.id; a.nextPlan = G().min + 40 + Math.random() * 140; if (t.b.tag === 'church') a.nextPlan = G().min + 60 + Math.random() * 40; }
      else if (t.kind === 'work') { a.wait = 4 + Math.random() * 10; if (Math.random() < 0.35) setPath(s, a, t.x + (Math.random() - 0.5) * 40, t.y + (Math.random() - 0.5) * 30); }
      else { a.wait = 2 + Math.random() * 9; if (Math.random() < 0.8) setPath(s, a, t.x + (Math.random() - 0.5) * 80, t.y + (Math.random() - 0.5) * 50); }
    }
  }

  // ---- army ----
  function armyUpdate(s, a, dt) {
    const b = a.brain, p = a.p;
    if (a.surrendered) { a.moving = false; a.weaponOut = false; return; }
    b.detT = (b.detT || 0) - dt;
    // look for hostiles every ~0.3s
    if (b.detT <= 0) {
      b.detT = 0.25 + Math.random() * 0.15;
      let best = null, bd = 1e9;
      for (const o of s.actors) {
        if (o.side === 'army' || o.dead || o.inside || o.gone || o.inVeh && o.inVeh.hidden) continue;
        const exposedCivilian = o.side === 'civ';
        if (!(o.side === 'rebel' || o.isPlayer)) continue;
        const d = Math.hypot(o.x - a.x, o.y - a.y); if (d > 420) continue;
        let range = detectRange(a, o, s);
        const urban = s.type === 'town' || s.type === 'city' || s.type === 'capital';
        // undercover rebels in towns: only suspicious if armed in view or behaving oddly
        if (urban && (o.covertNow || o.p.covert) && !o.weaponOut && !(o.shooting > 0) && o.exposed <= 0) {
          const sf = C.suspicionFactor(o, s);
          if (d < 90 && (o.carrying || o.running)) o.susp = (o.susp || 0) + 14 * dt * sf; else if (d < 60) o.susp = (o.susp || 0) + 1.2 * dt * sf;
          if (o.susp > 100) { o.exposed = 8; o.susp = 40; C.say(a, '¡Usted! ¡Alto ahí!', '#1a2a7a'); C.alertScene(s, a.x, a.y, 'arrest'); }
          continue;
        }
        if (d > range) continue;
        if (d > 40 && C.losOpacity(s, a.x, a.y, o.x, o.y) >= 0.95) continue;
        if (d < bd) { bd = d; best = o; }
      }
      if (best) {
        if (b.mode !== 'engage' && b.mode !== 'retreat') { C.say(a, ['¡Alto! ¡Quién vive!', '¡Rebeldes!', '¡Fuego!', '¡Allá están!'][Math.floor(Math.random() * 4)], '#1a2a7a'); C.alertScene(s, a.x, a.y, 'contact'); }
        b.target = best; b.seen = 6; b.lastX = best.x; b.lastY = best.y; if (b.mode !== 'retreat') b.mode = 'engage';
      } else if (b.mode === 'engage') { b.seen -= 0.3; if (b.seen <= 0) { b.mode = 'search'; b.searchT = 14; } }
    }
    // morale-based behaviour
    if ((p.morale < 18 || (p.morale < 34 && p.hp < p.maxHp * 0.4)) && b.mode === 'engage' && !b.rallied) { const reb = s.actors.filter((x) => (x.side === 'rebel') && !x.dead && Math.hypot(x.x - a.x, x.y - a.y) < 230).length, mine = s.actors.filter((x) => x.side === 'army' && !x.dead && !x.surrendered && Math.hypot(x.x - a.x, x.y - a.y) < 230).length; b.mode = (reb >= mine && Math.random() < 0.6 || p.hp < p.maxHp * 0.3 && Math.random() < 0.5) ? 'surrender' : 'retreat'; }
    if (b.mode === 'surrender') { a.surrendered = true; a.weapon && C.dropWeapon(a); a.weaponOut = false; C.say(a, '¡No disparen! ¡Me rindo!', '#7a1d1d', 6); C.emit && C.emit('surrender', a); return; }
    // behaviours
    if (b.mode === 'engage' && b.target && !b.target.dead) {
      const tgt = b.target; const d = Math.hypot(tgt.x - a.x, tgt.y - a.y); const w = a.weapon ? C.WEAPONS[a.weapon.k] : null;
      a.aim = Math.atan2(tgt.y - 6 - (a.y - 8), tgt.x - a.x); a.face = tgt.x >= a.x ? 1 : -1; a.weaponOut = true;
      if (!w) { b.mode = 'retreat'; return; }
      const stand = Math.min(w.rng * 0.6, 260);
      b.moveT = (b.moveT || 0) - dt;
      if (d > stand || C.losOpacity(s, a.x, a.y, tgt.x, tgt.y) > 0.7) {
        if (b.moveT <= 0) { b.moveT = 0.9; setPath(s, a, tgt.x + (Math.random() - 0.5) * 60, tgt.y + (Math.random() - 0.5) * 60); }
        followPath(s, a, dt, a.speed * 0.95 * terrainSpeed(s, a));
      } else {
        a.moving = false; a.prone = p.stress > 55 && Math.random() < 0.01 ? !a.prone : a.prone;
        if (b.moveT <= 0 && Math.random() < 0.3) { b.moveT = 1.8; const ang = Math.random() * 6.28; setPath(s, a, a.x + Math.cos(ang) * 40, a.y + Math.sin(ang) * 40); }
        if (a.path && b.moveT > 0.4) followPath(s, a, dt, a.speed * 0.7);
      }
      if (d < w.rng && a.suppressed < 2.5 || d < 60) C.tryFire(s, a, tgt.x, tgt.y - 8);
      if (a.weapon && a.weapon.mag <= 0 && a.reload <= 0) { if (a.weapon.spare === undefined || a.weapon.spare > 0) a.reload = w.rel; else if (Math.random() < 0.5) { b.mode = 'retreat'; } }
    } else if (b.mode === 'search') {
      b.searchT -= dt; if (b.searchT <= 0) { b.mode = 'patrol'; a.weaponOut = a.weaponOut; }
      b.moveT = (b.moveT || 0) - dt; if (b.moveT <= 0) { b.moveT = 3; setPath(s, a, b.lastX + (Math.random() - 0.5) * 120, b.lastY + (Math.random() - 0.5) * 120); }
      followPath(s, a, dt, a.speed * 0.8 * terrainSpeed(s, a));
    } else if (b.mode === 'investigate') {
      b.moveT = (b.moveT || 0) - dt; if (b.moveT <= 0) { b.moveT = 5; setPath(s, a, b.lastX, b.lastY); }
      if (followPath(s, a, dt, a.speed * terrainSpeed(s, a))) { b.mode = 'search'; b.searchT = 10; }
    } else if (b.mode === 'retreat') {
      const home = b.post || b.home; b.moveT = (b.moveT || 0) - dt; if (b.moveT <= 0) { b.moveT = 2; setPath(s, a, home.x, home.y); }
      followPath(s, a, dt, a.speed * 1.15 * terrainSpeed(s, a)); a.weaponOut = false;
      if (Math.hypot(home.x - a.x, home.y - a.y) < 40 && p.morale > 25) { b.mode = 'patrol'; b.rallied = true; }
    } else { // patrol / guard
      a.weaponOut = s.alert > 0.5;
      if (b.role === 'guard') {
        if (a.wait > 0) { a.wait -= dt; a.moving = false; } else { a.wait = 4 + Math.random() * 10; const h = b.home; setPath(s, a, h.x + (Math.random() - 0.5) * 36, h.y + (Math.random() - 0.5) * 36); }
        followPath(s, a, dt, a.speed * 0.5);
      } else {
        if (a.wait > 0) { a.wait -= dt; a.moving = false; }
        else if (followPath(s, a, dt, a.speed * 0.62 * terrainSpeed(s, a)) || !a.path) { a.wait = 2 + Math.random() * 6; const pt = patrolPoint(s, a); setPath(s, a, pt.x, pt.y); }
      }
    }
    // idle cooling of alert
    s.alert = Math.max(0, s.alert - dt * 0.012);
  }
  function patrolPoint(s, a) {
    const urban = s.type === 'town' || s.type === 'city' || s.type === 'capital';
    if (urban) { const q = s.randomFree([TL.ROAD, TL.PAVED, TL.PLAZA]); return { x: q.x * T + 8, y: q.y * T + 8 }; }
    const post = a.brain.post; const ang = Math.random() * 6.28, r = 30 + Math.random() * 150; return { x: post.x + Math.cos(ang) * r, y: post.y + Math.sin(ang) * r };
  }
  // raise the alarm: nearby soldiers investigate, civilians panic
  C.alertScene = function (s, x, y, kind) {
    s.alert = Math.min(1.5, s.alert + (kind === 'shot' ? 0.12 : 0.5));
    for (const o of s.actors) {
      if (o.dead || o.inside) continue; const d = Math.hypot(o.x - x, o.y - y);
      if (o.side === 'army' && d < 520 && o.brain.mode !== 'engage' && !o.surrendered) { o.brain.mode = 'investigate'; o.brain.lastX = x; o.brain.lastY = y; o.brain.moveT = 0; }
      else if (o.side === 'civ' && d < (kind === 'shot' ? 160 : 260)) { o.panic = Math.min(1, o.panic + (kind === 'shot' ? 0.45 : 0.7)); o.fleeing = false; }
    }
  };

  // ---- rebels ----
  C.STANCES = {
    follow: { n: 'Seguir', d: 'Stay close to you. Fire at will.' },
    hold: { n: 'Mantener', d: 'Hold this spot. Fire at will.' },
    ambush: { n: 'Emboscada', d: 'Hide and wait. Hold fire until the enemy is close or you give the word (F).' },
    scout: { n: 'Explorar', d: 'Move ahead quietly and mark enemies. Avoid contact.' },
    forage: { n: 'Forrajear', d: 'Gather food nearby. Policy decides: pay, owe (vale), or take.' },
    harass: { n: 'Hostigar', d: 'Fire from range, fall back when they close.' },
    withdraw: { n: 'Retirada', d: 'Break contact and return to you.' },
  };
  function obedience(a) {
    const p = a.p, n = p.needs;
    const loyal = clamp((p.trueStance + 20) / 120, 0, 1), disc = clamp((G().rep ? G().rep.discipline : 50) / 100, 0, 1);
    let o = 0.45 + 0.30 * loyal + 0.18 * (p.morale - 50) / 50 + 0.10 * p.exp / 100 + 0.10 * (disc - 0.5) - 0.28 * (100 - n.food) / 100 * (n.food < 40 ? 1.2 : 0.4) - 0.2 * (100 - n.energy) / 100 * (n.energy < 30 ? 1 : 0.3) - 0.22 * p.fear / 100 - 0.12 * p.stress / 100 - 0.15 * (n.water < 25 ? 1 : 0);
    if (p.traits.includes('hothead')) o -= 0.06; if (p.traits.includes('idealist')) o += 0.04;
    return clamp(o, 0.05, 0.99);
  }
  C.obedience = obedience;
  function whyNot(a) { const n = a.p.needs; if (n.food < 25) return 'Tengo hambre...'; if (n.water < 20) return 'Sed...'; if (n.energy < 22) return 'Estoy agotado'; if (a.p.fear > 55) return 'Tengo miedo'; if (a.p.morale < 30) return '¿Para qué?'; if (a.p.stress > 70) return 'No puedo más'; return 'Un momento...'; }

  C.giveOrder = function (squadId, order) { // order: {type, x,y, target}
    const sq = G().squads[squadId]; if (!sq) return;
    let ok = 0, refused = 0;
    for (const id of sq.members) {
      const a = C.P(id).actor; if (!a || a.dead || a.gone || a.inVeh) continue;
      const comply = Math.random() < obedience(a) + 0.12;
      a.pendingOrder = null;
      if (comply) { a.order = Object.assign({ t: 0 }, order); a.orderT = 0.15 + Math.random() * 0.7; ok++; if (Math.random() < 0.35) C.say(a, order.type === 'move' ? 'Sí, jefe' : '¡A la orden!', '#1d4a1d', 1.4); }
      else { refused++; C.say(a, whyNot(a), '#7a1d1d', 2.6); a.pendingOrder = Object.assign({ t: 0 }, order); a.retryT = 5 + Math.random() * 5; a.p.morale = Math.max(0, a.p.morale - 0.3); }
    }
    return { ok, refused };
  };

  function nearestEnemy(s, a, maxD) {
    let best = null, bd = maxD;
    for (const o of s.actors) {
      if (o.dead || o.inside || o.gone || o.side !== 'army' || o.surrendered) continue;
      const d = Math.hypot(o.x - a.x, o.y - a.y); if (d >= bd) continue;
      const vis = d < 36 || C.losOpacity(s, a.x, a.y, o.x, o.y) < 0.9; if (!vis) continue;
      // can I actually see him? camouflaged enemies are harder
      const range = detectRange(a, o, s); if (d > range * 1.1) continue;
      bd = d; best = o;
    }
    return best;
  }
  C.nearestEnemy = nearestEnemy;

  function rebelUpdate(s, a, dt) {
    const g = G(), sq = a.squad >= 0 ? g.squads[a.squad] : null, p = a.p;
    if (a.pendingOrder) { a.retryT -= dt; if (a.retryT <= 0) { a.retryT = 6; if (Math.random() < obedience(a) + 0.2) { a.order = a.pendingOrder; a.pendingOrder = null; a.orderT = 0.1; } else C.say(a, whyNot(a), '#7a1d1d', 2); } }
    const stance = sq ? sq.stance : 'follow';
    const lead = g.player;
    if (!lead || lead.dead) { civilianLike(s, a, dt); return; }
    a.weaponOut = !!a.weapon && (stance !== 'forage' || s.alert > 0.2);
    // desertion/AWOL handled by daily sim
    // find target
    a.scanT = (a.scanT || 0) - dt;
    if (a.scanT <= 0) { a.scanT = 0.22 + Math.random() * 0.1; a.target = nearestEnemy(s, a, a.weapon ? C.WEAPONS[a.weapon.k].rng * 1.05 : 200); const near = nearestEnemy(s, a, 700); if (near && !a.sawEnemy) { a.sawEnemy = true; if (stance === 'scout' && Math.random() < 0.8) { C.say(a, '¡Enemigo avistado!', '#1d4a1d', 2.4); s.spotted = s.spotted || []; s.spotted.push({ x: near.x, y: near.y, t: 10 }); } } else if (!near) a.sawEnemy = false; }
    if (sq && sq.focus && !sq.focus.dead && !sq.focus.inside && a.weapon && Math.hypot(sq.focus.x - a.x, sq.focus.y - a.y) < C.WEAPONS[a.weapon.k].rng && C.losOpacity(s, a.x, a.y, sq.focus.x, sq.focus.y) < 0.9) a.target = sq.focus;
    const tgt = a.target;
    const w = a.weapon ? C.WEAPONS[a.weapon.k] : null;
    // fear can make them break
    if (p.morale < 14 && p.fear > 60 && tgt && !a.pendingOrder) { a.order = { type: 'move', x: lead.x, y: lead.y, flee: true }; C.say(a, '¡Me voy!', '#7a1d1d'); }
    // ambush holds fire until close or triggered
    let canFire = !!tgt && !!w;
    if (stance === 'ambush' && tgt) { const d = Math.hypot(tgt.x - a.x, tgt.y - a.y); canFire = d < 105 || sq.fireNow || a.suppressed > 0 || a.lastHit > g.time - 2; }
    if (stance === 'scout' || stance === 'forage' && !a.defending) canFire = canFire && a.lastHit > g.time - 3 && stance === 'scout';
    if (stance === 'withdraw') canFire = false;
    if (canFire) {
      a.aim = Math.atan2(tgt.y - 8 - (a.y - 8), tgt.x - a.x); a.face = tgt.x >= a.x ? 1 : -1;
      const bonus = (stance === 'ambush' && sq.fireNow) ? 1.25 : 1;
      C.tryFire(s, a, tgt.x, tgt.y - 8, bonus);
      if (a.weapon.mag <= 0 && a.reload <= 0 && (a.weapon.spare === undefined || a.weapon.spare > 0)) { a.reload = w.rel; C.say(a, 'Recargando', '#444', 1.2); }
    }
    // orders
    if (a.order) {
      a.orderT -= dt; if (a.orderT > 0) { a.moving = false; return; }
      const o = a.order;
      if (o.type === 'move') {
        const dd = Math.hypot(o.x - a.x, o.y - a.y);
        if (!a.path || a.pathFor !== o) { setPath(s, a, o.x + (a.id % 5 - 2) * 9, o.y + ((a.id >> 3) % 4 - 1.5) * 9); a.pathFor = o; }
        const run = o.flee ? 1.35 : 1; const done = followPath(s, a, dt, a.speed * run * (stance === 'scout' ? 0.7 : 1) * terrainSpeed(s, a)); a.running = !!o.flee;
        if (done || dd < 14) { a.order = null; a.path = null; a.pathFor = null; }
        return;
      }
    }
    // stance behaviours
    a.running = false;
    switch (stance) {
      case 'hold': case 'ambush': {
        a.moving = false; a.prone = stance === 'ambush' || (a.suppressed > 0); a.hide = stance === 'ambush'; if (stance === 'ambush') { a.weaponOut = true; }
        break;
      }
      case 'harass': {
        a.prone = false;
        if (tgt) { const d = Math.hypot(tgt.x - a.x, tgt.y - a.y); if (d < 100) { a.fallback = (a.fallback || 0) - dt; const dx = a.x - tgt.x, dy = a.y - tgt.y, dl = Math.hypot(dx, dy) || 1; stepMove(s, a, dx / dl * a.speed * 1.1 * dt, dy / dl * a.speed * 1.1 * dt); a.moving = true; } else a.moving = false; }
        else followLeader(s, a, dt, lead, 100);
        break;
      }
      case 'withdraw': followLeader(s, a, dt, lead, 40, 1.2); break;
      case 'scout': {
        const o = a.scoutDir || (a.scoutDir = { x: lead.x, y: lead.y }); a.hide = true;
        a.scoutT = (a.scoutT || 0) - dt; if (a.scoutT <= 0) { a.scoutT = 2.5; const ang = (sq.scoutAng !== undefined ? sq.scoutAng : -Math.PI / 2) + (Math.random() - 0.5) * 0.9; const dist = 90 + Math.random() * 70; setPath(s, a, clamp(lead.x + Math.cos(ang) * dist, 24, s.tw * T - 24), clamp(lead.y + Math.sin(ang) * dist, 24, s.th * T - 24)); }
        if (tgt && Math.hypot(tgt.x - a.x, tgt.y - a.y) < 160) { const dx = a.x - tgt.x, dy = a.y - tgt.y, dl = Math.hypot(dx, dy) || 1; stepMove(s, a, dx / dl * a.speed * dt, dy / dl * a.speed * dt); a.moving = true; }
        else followPath(s, a, dt, a.speed * 0.6 * terrainSpeed(s, a));
        break;
      }
      case 'forage': forageUpdate(s, a, dt, lead); break;
      default: followLeader(s, a, dt, lead, 46); // follow
    }
  }
  function followLeader(s, a, dt, lead, dist, mult) {
    const slot = (a.squadSlot || 0) + 1; const ang = (slot * 0.9) + Math.PI * 0.6; const rr = dist * 0.7 + (slot % 4) * 7;
    const tx = lead.x + Math.cos(ang) * rr, ty = lead.y + Math.sin(ang) * rr + 10;
    const d = Math.hypot(tx - a.x, ty - a.y);
    if (d > 26) {
      a.repT = (a.repT || 0) - dt; if (a.repT <= 0 || !a.path) { a.repT = 0.8; setPath(s, a, tx, ty); }
      const sp = a.speed * (d > 120 ? 1.35 : 1.0) * (mult || 1) * terrainSpeed(s, a); a.running = d > 120; followPath(s, a, dt, sp);
    } else { a.moving = false; a.path = null; a.prone = false; a.hide = false; }
  }
  function civilianLike(s, a, dt) { a.moving = false; }

  // foraging: look for food nearby; policy decides how
  function forageUpdate(s, a, dt, lead) {
    const g = G(); a.hide = false;
    a.forT = (a.forT || 0) - dt;
    if (!a.forTarget || a.forTarget.dead || a.forTarget.inside) {
      if (a.forT > 0) { a.moving = false; return; }
      a.forT = 3 + Math.random() * 2;
      // choose: livestock, wild game, then a civilian with food (peasant/shop)
      let best = null, bd = 9e9;
      for (const an of s.animals) { if (an.dead) continue; const d = Math.hypot(an.x - lead.x, an.y - lead.y); if (d < 420 && d < bd && (an.wild || g.policy.forage !== 'pay' || true)) { bd = d; best = { k: 'animal', o: an }; } }
      for (const o of s.actors) { if (o.side !== 'civ' || o.dead || o.inside || o.p.needs.food < 28 || (o.p.sellCd || 0) > g.min) continue; const d = Math.hypot(o.x - lead.x, o.y - lead.y); if (d < 360 && d < bd * 0.7 && !o.p.rebelHost) { bd = d; best = { k: 'civ', o }; } }
      if (best && (best.o.id === undefined || true)) a.forTarget = best.o, a.forKind = best.k;
      else { followLeader(s, a, dt, lead, 90); return; }
    }
    const t = a.forTarget; const d = Math.hypot(t.x - a.x, t.y - a.y);
    if (d > 16) { a.repT = (a.repT || 0) - dt; if (a.repT <= 0 || !a.path) { a.repT = 1; setPath(s, a, t.x, t.y); } followPath(s, a, dt, a.speed * terrainSpeed(s, a)); if (a.forKind === 'animal' && t.wild && a.weapon && d < 140 && a.cd <= 0 && C.WEAPONS[a.weapon.k].spr < 3 && a.weapon.mag > 0) { a.aim = Math.atan2(t.y - a.y, t.x - a.x); a.weaponOut = true; C.tryFire(s, a, t.x, t.y - 3); } return; }
    a.moving = false;
    a.talking = 1;
    if (a.forKind === 'animal') {
      if (t.dead) { C.harvestAnimal(a, t); a.forTarget = null; return; }
      if (!t.wild) { C.forageTransaction(a, t, 'animal'); a.forTarget = null; a.forT = (360 + Math.random() * 240) / G().minPerSec; return; }
      if (a.cd <= 0 && a.weapon) { a.aim = Math.atan2(t.y - a.y, t.x - a.x); C.tryFire(s, a, t.x, t.y - 3); }
    } else { C.forageTransaction(a, t, 'civ'); a.forTarget = null; a.forT = (240 + Math.random() * 240) / G().minPerSec; }
  }

  // ---------------- animals ----------------
  function updateAnimals(s, dt) {
    for (const an of s.animals) {
      if (an.dead) continue;
      an.wait -= dt;
      if (an.flee > 0) an.flee -= dt;
      const sp = an.def.spd * (an.flee > 0 ? 2.4 : 1);
      if (an.wait <= 0 && !an.moving) { const r = an.wild ? 140 : 70; an.tx = an.hx + (Math.random() - 0.5) * r; an.ty = an.hy + (Math.random() - 0.5) * r * 0.7; an.moving = true; }
      if (an.moving || an.flee > 0) {
        const dx = an.tx - an.x, dy = an.ty - an.y, d = Math.hypot(dx, dy);
        if (d < 3) { an.moving = false; an.wait = 2 + Math.random() * 7; }
        else { const mx = dx / d * sp * dt, my = dy / d * sp * dt; if (!C.footBlocked(s, an.x + mx, an.y + my, 2.5)) { an.x += mx; an.y += my; } else { an.moving = false; an.wait = 1; } an.anim += Math.hypot(mx, my) * 0.6; if (Math.abs(dx) > 1) an.face = dx > 0 ? 1 : -1; }
      }
    }
  }
  C.scareAnimals = function (s, x, y, r) { for (const an of s.animals) { if (an.dead) continue; if (Math.hypot(an.x - x, an.y - y) < r) { an.flee = 4; const a = Math.atan2(an.y - y, an.x - x); an.tx = an.x + Math.cos(a) * 120; an.ty = an.y + Math.sin(a) * 120; an.moving = true; } } };

  // ---------------- vehicles ----------------
  function updateVehicles(s, dt) {
    for (const v of s.vehicles) {
      if (v.gone) continue;
      if (v.burning > 0) { v.burning -= dt; if (Math.random() < dt * 10) C.fx.smoke(s, v.x + (Math.random() - 0.5) * 10, v.y - 4, 'fire'); if (Math.random() < dt * 6) C.fx.smoke(s, v.x, v.y - 8, 'smoke'); v.hp -= dt * 8; if (v.hp <= 0 && !v.wreck) C.wreckVehicle(s, v); }
      else if (v.wreck && Math.random() < dt * 1.5) C.fx.smoke(s, v.x, v.y - 6, 'smoke');
      if (v.wreck) continue;
      if (v.driver && v.driver.isPlayer) continue;      // main.js drives it
      if (v.driving && !v.driver) { // ambient traffic
        if (v.fuel <= 0.5 || v.tires.some((q) => q < 0.2)) { v.spd *= 0.9; continue; }
        v.wait -= dt; if (v.wait > 0) continue;
        if (!v.route || v.ri >= v.route.length) { const q = s.randomFree([TL.ROAD, TL.PAVED]); const r = C.findPath(s, v.x, v.y, q.x * T + 8, q.y * T + 8, 'car'); if (!r) { v.wait = 5; continue; } v.route = r; v.ri = 0; }
        const w = v.route[v.ri]; const dx = w.x - v.x, dy = w.y - v.y, d = Math.hypot(dx, dy);
        if (d < 5) { v.ri++; continue; }
        // yield to pedestrians
        let blocked = false; for (const a of s.actors) { if (a.inside || a.dead) continue; const ex = v.x + Math.cos(v.ang) * 20, ey = v.y + Math.sin(v.ang) * 20; if (Math.abs(a.x - ex) < 14 && Math.abs(a.y - ey) < 14) { blocked = true; break; } }
        const want = Math.atan2(dy, dx); let da = want - v.ang; while (da > Math.PI) da -= 6.283; while (da < -Math.PI) da += 6.283; v.ang += clamp(da, -3 * dt, 3 * dt);
        v.spd = blocked ? 0 : Math.min(v.def.spd * 0.45, v.spd + 90 * dt);
        v.x += Math.cos(v.ang) * v.spd * dt; v.y += Math.sin(v.ang) * v.spd * dt; v.fuel = Math.max(0, v.fuel - v.def.burn * dt * 0.05);
      }
    }
  }
  function updateInVehicle(s, a, dt) { const v = a.inVeh; a.x = v.x; a.y = v.y; a.inside = false; a.hiddenInVeh = true; a.alpha = 0; a.moving = false; }
  C.updateInVehicleFlag = function (a) { return a.inVeh ? true : false; };

  // used by combat on vehicle destruction
  C.wreckVehicle = function (s, v) {
    v.wreck = true; v.spd = 0; v.burning = Math.max(v.burning, 8);
    C.explode(s, v.x, v.y, 46, 90, null, { frags: 6, vehicle: v });
    for (const a of v.pass.slice()) C.exitVehicle(a, true);
    if (v.driver) C.exitVehicle(v.driver, true);
  };
  C.enterVehicle = function (a, v) {
    if (v.wreck) return false; if (v.pass.length + (v.driver ? 1 : 0) >= v.def.cap) return false;
    a.inVeh = v; a.hiddenInVeh = true; if (!v.driver) v.driver = a; else v.pass.push(a);
    if (a.isPlayer) { G().vehicle = v; } return true;
  };
  C.exitVehicle = function (a, hurt) {
    const v = a.inVeh; if (!v) return; const s = a.scene;
    if (v.driver === a) v.driver = null; else v.pass = v.pass.filter((q) => q !== a);
    a.inVeh = null; a.hiddenInVeh = false; a.alpha = 1;
    const ang = Math.random() * 6.28; const tx = v.x + Math.cos(ang) * (v.def.w * 0.7), ty = v.y + Math.sin(ang) * (v.def.h * 1.2 + 6);
    a.x = C.footBlocked(s, tx, ty, 4) ? v.x : tx; a.y = C.footBlocked(s, tx, ty, 4) ? v.y : ty;
    if (a.isPlayer) G().vehicle = null;
    if (hurt) { C.hurt(a, 20 + Math.random() * 25, null, ang, 'blast'); }
    if (v.driver == null && v.pass.length) { v.driver = v.pass.shift(); }
  };
})();
