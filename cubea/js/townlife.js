/* CUBEA — townlife.js : THE LIFE OF A TOWN — more buildings, more trades, shifts and markets, night watchmen, horse and cart.

   A town is not a plaza with houses. It has a bakery that is lit at three in the morning, a butcher, a market with stalls on
   Saturdays, restaurants that cook through lunch and supper, bars that stay open late, a post office and a postman, a school, a
   hospital with night nurses, a town hall, filling stations with attendants, a garage where the mechanic works, a night
   watchman (sereno) walking the streets, milk carts at dawn, and vendors calling their wares. People travel to the building where
   they work (see aware.js workplaceOf for what a hover shows), go home to eat, go out in the evening, and sleep.

   WHAT THIS FILE ADDS
   • BUILDINGS   restaurante, panadería, carnicería, mercado, taller (garage), correos, bar, ferretería, zapatería, tabaquería, escuela
                 mayor, estación de autobuses. Tags: 'food', 'market', 'garage', 'post', 'bar' (the older tags still apply).
   • TRADES      panadero, carnicero, cocinero, cantinero, zapatero, herrero, albañil, cartero, enfermera, vendedor ambulante,
                 lechero, carretonero, sereno, pompero (filling-station attendant).
   • SCHEDULES   C.townPlan(s, a, hour, weekday) overrides the old plan for these people and for the evening out, market day, siesta.
   • TRAFFIC     horse-drawn carretones and more cars, taxis, buses and trucks driving the streets; mounted men (guardia rural,
                 vaqueros, hacendados) on horses; denser streets (more households per scene).
   TUNE: numbers in the TUNE block.
*/
(function () {
  'use strict';
  const C = window.C, G = () => C.G, clamp = C.clamp, T = C.T, TL = C.TILE;
  const rnd = Math.random;

  // TUNE ---------------------------------------------------------------------------------------------------------------
  const TUNE = {
    barNight: 0.22, barWomen: 0.03,      // chance per replan that an adult man / woman spends the evening in a bar
    diningOut: 0.14,                     // well-off people eating at a restaurant in the evening
    marketDay: 5, marketFrom: 7, marketTo: 12, marketGoing: 0.6,   // Saturday (weekday 5), who goes
    carretones: { town: 4, city: 7, capital: 9 }, taxiShare: 0.3, drivingCars: 0.7, drivingTrucks: 0.45,
    mounted: ['vaquero', 'hacendado', 'mayordomo', 'guardia'], mountSpeed: 1.9,
    capBoost: 1.3,                       // households per scene multiplied by this (see scene.js caps)
  };
  C.TOWN_TUNE = TUNE;

  // ------------------------------------------------------------------------------------------------------------------
  // BUILDINGS
  // ------------------------------------------------------------------------------------------------------------------
  Object.assign(C.BLD, {
    restaurante: { n: 'Restaurante', w: 4, h: 3, fill: [236, 210, 176], roof: [170, 70, 60], tag: 'food' },
    panaderia:   { n: 'Panadería', w: 3, h: 2, fill: [238, 218, 170], roof: [190, 120, 60], tag: 'food' },
    carniceria:  { n: 'Carnicería', w: 3, h: 2, fill: [236, 200, 190], roof: [150, 60, 56], tag: 'food' },
    mercado:     { n: 'Mercado', w: 7, h: 4, fill: [214, 198, 150], roof: [110, 150, 100], tag: 'market' },
    taller:      { n: 'Taller mecánico', w: 4, h: 3, fill: [196, 196, 200], roof: [90, 96, 110], tag: 'garage' },
    correos:     { n: 'Correos', w: 3, h: 2, fill: [226, 226, 214], roof: [80, 110, 150], tag: 'post' },
    bar:         { n: 'Bar', w: 3, h: 2, fill: [196, 150, 110], roof: [110, 60, 50], tag: 'bar' },
    ferreteria:  { n: 'Ferretería', w: 3, h: 2, fill: [206, 200, 180], roof: [120, 100, 80], tag: 'shop' },
    zapateria:   { n: 'Zapatería', w: 2, h: 2, fill: [220, 196, 170], roof: [130, 90, 70], tag: 'shop' },
    tabaqueria:  { n: 'Tabaquería', w: 3, h: 2, fill: [214, 190, 150], roof: [120, 80, 50], tag: 'shop' },
    estacion:    { n: 'Estación de autobuses', w: 5, h: 3, fill: [222, 218, 204], roof: [160, 70, 50], tag: 'station' },
  });
  C.BLD.escuela.n = 'Escuela';

  // ------------------------------------------------------------------------------------------------------------------
  // TRADES (sampling weights follow the occupation table in data.js; "where" as there)
  // ------------------------------------------------------------------------------------------------------------------
  const add = (k, o) => { if (!C.OCC[k]) C.OCC[k] = o; };
  add('panadero',   { n: 'Panadero', fac: 'workers', bg: 'obrero', cls: 1, where: 'urban', w: 1.6, sex: 'M' });
  add('carnicero',  { n: 'Carnicero', fac: 'workers', bg: 'obrero', cls: 1, where: 'urban', w: 1.1, sex: 'M' });
  add('cocinero',   { n: 'Cocinero/a', fac: 'workers', bg: 'servicio', cls: 1, where: 'urban', w: 2.2 });
  add('cantinero',  { n: 'Cantinero', fac: 'workers', bg: 'servicio', cls: 1, where: 'urban', w: 1.2, sex: 'M' });
  add('zapatero',   { n: 'Zapatero', fac: 'workers', bg: 'obrero', cls: 1, where: 'urban', w: 0.9, sex: 'M' });
  add('herrero',    { n: 'Herrero', fac: 'workers', bg: 'obrero', cls: 1, where: 'any', w: 0.7, sex: 'M' });
  add('albanil',    { n: 'Albañil', fac: 'workers', bg: 'obrero', cls: 1, where: 'urban', w: 2.4, sex: 'M' });
  add('cartero',    { n: 'Cartero', fac: 'middle', bg: 'servicio', cls: 2, where: 'urban', w: 0.6, sex: 'M' });
  add('enfermera',  { n: 'Enfermera', fac: 'middle', bg: 'profesional', cls: 2, where: 'urban', w: 0.9, sex: 'F' });
  add('vendedor',   { n: 'Vendedor ambulante', fac: 'workers', bg: 'servicio', cls: 0, where: 'urban', w: 2.4 });
  add('lechero',    { n: 'Lechero', fac: 'workers', bg: 'servicio', cls: 1, where: 'urban', w: 0.8, sex: 'M' });
  add('carretonero',{ n: 'Carretonero', fac: 'workers', bg: 'obrero', cls: 1, where: 'urban', w: 1.2, sex: 'M' });
  add('sereno',     { n: 'Sereno (vigilante nocturno)', fac: 'workers', bg: 'militar', cls: 1, where: 'urban', w: 0.6, sex: 'M' });
  add('pompero',    { n: 'Empleado de gasolinera', fac: 'workers', bg: 'obrero', cls: 1, where: 'urban', w: 0.8, sex: 'M' });
  // where each trade works (aware.js reads these for the hover and the workplace)
  C.WORKTAGS_EXTRA = { panadero: ['food:panaderia'], carnicero: ['food:carniceria'], cocinero: ['food:restaurante', 'shop:cafe'], cantinero: ['bar'], zapatero: ['shop:zapateria'], cartero: ['post'], enfermera: ['clinic'], pompero: ['fuel'], mecanico: ['garage', 'fuel'], herrero: ['garage'], vendedor: ['market'], carretonero: ['market', 'store'] };
  C.OUTDOOR_EXTRA = { sereno: 'walks the streets at night', lechero: 'delivers milk by cart', albanil: 'builds and repairs', carretonero: 'hauls by horse and cart' };

  // ------------------------------------------------------------------------------------------------------------------
  // SCHEDULES
  // ------------------------------------------------------------------------------------------------------------------
  const urban = (s) => s.type === 'town' || s.type === 'city' || s.type === 'capital';
  const all = (s, pred) => s.blds.filter((b) => b.door && !b.open && pred(b));
  const byKey = (s, key, a) => { const L = all(s, (b) => b.key === key); return L.length ? L[(a.p.id * 7 + 3) % L.length] : null; };
  const byTag = (s, tag, a) => { const L = all(s, (b) => b.tag === tag); return L.length ? L[(a.p.id * 7 + 3) % L.length] : null; };
  const spotNear = (s, x, y, r) => ({ kind: 'spot', x: x + (rnd() - 0.5) * r, y: y + (rnd() - 0.5) * r * 0.7 });
  const home = (s, a) => { const h = C.W.houses[a.p.hh]; return h && h.bld >= 0 ? s.blds[h.bld] : null; };

  /** Returns a plan for this person now, or null to let the standard planner decide. */
  C.townPlan = function (s, a, hr, wd) {
    if (!urban(s)) return null;
    const p = a.p, age = C.ageOf(p), o = p.occ, plaza = s.plaza ? { x: s.plaza.x * T, y: s.plaza.y * T } : { x: s.spawn.x, y: s.spawn.y };
    const inB = (b) => (b ? { kind: 'in', b } : null);
    const sunday = wd === 6;
    // trades
    switch (o) {
      case 'panadero': if (hr >= 3 && hr < 11) return inB(byKey(s, 'panaderia', a)) || null; break;
      case 'carnicero': if (hr >= 6 && hr < 15 && !sunday) return inB(byKey(s, 'carniceria', a)) || null; break;
      case 'cocinero': if ((hr >= 10 && hr < 15) || (hr >= 17 && hr < 23)) return inB(byKey(s, 'restaurante', a) || byKey(s, 'cafe', a)) || null; break;
      case 'cantinero': if (hr >= 16 || hr < 2) return inB(byTag(s, 'bar', a) || byKey(s, 'cafe', a)) || null; break;
      case 'camarero': if ((hr >= 11 && hr < 15) || (hr >= 18 && hr < 24)) return inB(byKey(s, 'restaurante', a) || byTag(s, 'hotel', a) || byTag(s, 'bar', a)) || null; break;
      case 'enfermera': if (hr >= 6.5 && hr < 19 || hr >= 21) return inB(byTag(s, 'clinic', a)) || null; break;
      case 'medico': if (hr >= 7 && hr < 18) return inB(byTag(s, 'clinic', a)) || null; break;
      case 'cartero': if (hr >= 8 && hr < 15 && !sunday) { const hb = s.homes.length ? s.blds[s.homes[(rnd() * s.homes.length) | 0].bld] : null; if (hb) { const d = s.doorPx(hb); return { kind: 'work', x: d.x, y: d.y + 8, work: 'deliver' }; } } break;
      case 'pompero': if (hr >= 7 && hr < 19) return inB(byTag(s, 'fuel', a)) || null; break;
      case 'mecanico': case 'herrero': if (hr >= 8 && hr < 18 && !sunday) return inB(byTag(s, 'garage', a) || byTag(s, 'fuel', a)) || null; break;
      case 'zapatero': if (hr >= 8 && hr < 18 && !sunday) return inB(byKey(s, 'zapateria', a)) || null; break;
      case 'lechero': if (hr >= 4.5 && hr < 9.5) return spotNear(s, plaza.x, plaza.y, 420); break;
      case 'sereno': if (hr >= 21 || hr < 5.5) return Object.assign(spotNear(s, plaza.x, plaza.y, 360), { kind: 'work', work: 'patrol' }); break;
      case 'albanil': if (hr >= 7 && hr < 17 && !sunday) { const hb = s.homes.length ? s.blds[s.homes[(p.id * 3) % s.homes.length].bld] : null; if (hb) { const d = s.doorPx(hb); return { kind: 'work', x: d.x + 18, y: d.y + 14, work: 'build' }; } } break;
      case 'vendedor': if (hr >= 7 && hr < 18) { const m = byTag(s, 'market', a); if (m) { const d = s.doorPx(m); return { kind: 'work', x: d.x + (rnd() - 0.5) * 80, y: d.y + 14, work: 'sell' }; } return Object.assign(spotNear(s, plaza.x, plaza.y, 200), { kind: 'work', work: 'sell' }); } break;
      case 'carretonero': if (hr >= 6 && hr < 17 && !sunday) { const m = byTag(s, 'market', a) || byTag(s, 'store', a); if (m) { const d = s.doorPx(m); return { kind: 'work', x: d.x + (rnd() - 0.5) * 50, y: d.y + 18, work: 'haul' }; } } break;
    }
    if (age < 13) return null;
    // market day: housewives, maids, retirees and traders go to the market
    if (wd === TUNE.marketDay && hr >= TUNE.marketFrom && hr < TUNE.marketTo && ['ama', 'domestica', 'lavandera', 'jubilado', 'comerciante', 'bodeguero'].includes(o) && rnd() < TUNE.marketGoing) { const m = byTag(s, 'market', a); if (m) { const d = s.doorPx(m); return { kind: 'spot', x: d.x + (rnd() - 0.5) * 110, y: d.y + 10 + rnd() * 24 }; } }
    // evening: the bar (men mostly), dinner out (the well-off), a stroll
    if (hr >= 19.5 && hr < 24 && p.sex === 'M' && age >= 18 && !p.traits.includes('devout') && rnd() < TUNE.barNight) { const b = byTag(s, 'bar', a) || byKey(s, 'cafe', a); if (b) return inB(b); }
    if (hr >= 19.5 && hr < 24 && p.sex === 'F' && age >= 20 && rnd() < TUNE.barWomen) { const b = byKey(s, 'cafe', a); if (b) return inB(b); }
    if (hr >= 19 && hr < 21.5 && (p.cls || 0) >= 3 && rnd() < TUNE.diningOut) { const b = byKey(s, 'restaurante', a); if (b) return inB(b); }
    if (sunday && hr >= 11 && hr < 14 && rnd() < 0.25) { const b = byKey(s, 'restaurante', a); if (b) return inB(b); }
    // the post office and the bank are visited by errands
    if (hr >= 9 && hr < 15 && !sunday && rnd() < 0.015) { const b = byTag(s, 'post', a) || byTag(s, 'bank', a); if (b) return inB(b); }
    return null;
  };

  // ------------------------------------------------------------------------------------------------------------------
  // HORSES, CARTS AND TRAFFIC
  // ------------------------------------------------------------------------------------------------------------------
  Object.assign(C.VEHICLES, { carreton: { n: 'Carretón (horse cart)', w: 28, h: 13, spd: 82, cap: 3, tank: 0, burn: 0, col: [150, 110, 70], hp: 90, wheels: 2, cargoCap: 240, trunk: 0, year: 1900 } });
  /** Called at the end of spawnVehicles: more traffic, taxis, horse carts. */
  C.townTraffic = function (s, R) {
    if (!urban(s)) return;
    const roads = []; for (let y = 0; y < s.th; y++) for (let x = 0; x < s.tw; x++) { const t = s.tiles[y * s.tw + x]; if (t === TL.ROAD || t === TL.PAVED) roads.push([x, y]); }
    if (!roads.length) return;
    for (const v of s.vehicles) {
      if (v.type === 'car') { if (R() < TUNE.drivingCars) { v.driving = true; v.fuel = Math.max(v.fuel, 25); v.lights = false; } if (R() < TUNE.taxiShare && (s.type !== 'town')) { v.taxi = true; v.paint = [[240, 200, 60], [30, 30, 30]]; } }
      if ((v.type === 'truck' || v.type === 'bus') && R() < TUNE.drivingTrucks) { v.driving = true; v.fuel = Math.max(v.fuel, 40); }
    }
    const n = TUNE.carretones[s.type] || 4;
    for (let i = 0; i < n; i++) { const q = roads[(R() * roads.length) | 0]; const v = C.addVehicle(s, 'carreton', q[0] * T + 8, q[1] * T + 8, R() * 6.28, { fuel: 0 }); v.driving = true; v.fuel = 0; v.wait = R() * 6; }
  };
  /** Mounted men: the Guardia Rural rode, so did cowboys and estate owners. Called after actors are placed. */
  C.assignMounts = function (s) {
    for (const a of s.actors) { if (a.mount || a.isPlayer) continue; const o = a.p.occ; if (!TUNE.mounted.includes(o)) continue; if (o === 'hacendado' && rnd() < 0.5) continue; if (a.side === 'rebel') continue; if (urban(s) && o !== 'guardia' && rnd() < 0.7) continue; a.mount = { col: [[120, 82, 52], [60, 44, 36], [200, 190, 170], [150, 110, 70]][(a.p.id * 5) % 4] }; a.speed = (a.speed || 36) * TUNE.mountSpeed; }
  };
  // the horse under a rider (called from render.js before the rider is drawn)
  C.drawMount = function (c, a, t) {
    const m = a.mount; if (!m || a.dead || a.inside) return; const f = a.face || 1, trot = a.moving ? Math.sin(a.anim * 2) * 0.9 : 0;
    c.save(); c.translate(a.x, a.y + 3);
    c.fillStyle = 'rgba(0,0,0,.25)'; c.beginPath(); c.ellipse(0, 4, 11, 3.2, 0, 0, 6.3); c.fill();
    c.fillStyle = `rgb(${m.col})`; c.beginPath(); c.ellipse(0, -5 + trot * 0.3, 10, 4.2, 0, 0, 6.3); c.fill();                                    // body
    c.beginPath(); c.moveTo(f * 8, -8); c.lineTo(f * 14, -13 + trot * 0.4); c.lineTo(f * 17, -10); c.lineTo(f * 14, -6); c.lineTo(f * 8, -3); c.fill();   // neck and head
    c.fillStyle = 'rgb(30,24,20)'; c.fillRect(f * 15, -12.5 + trot * 0.4, 1.2, 1.2);
    c.fillStyle = 'rgb(40,32,28)'; c.beginPath(); c.moveTo(-f * 9, -6); c.quadraticCurveTo(-f * 15, -4, -f * 14, 2); c.lineTo(-f * 9, -2); c.fill();   // tail
    c.fillStyle = `rgb(${m.col[0] * 0.75},${m.col[1] * 0.75},${m.col[2] * 0.75})`; for (const [lx, ph] of [[-6, 0], [-3, 1], [4, 1], [7, 0]]) c.fillRect(lx - 0.7, -2, 1.5, 6 + (ph ? trot : -trot) * 0.8);
    c.restore();
  };
})();
