/* CUBEA — garage.js : VEHICLES AS MACHINES — period looks, breakdowns, repairs, cargo, passengers, and driving orders.

   WHAT A VEHICLE IS NOW
   • LOOKS    period-correct silhouettes in the game's low-poly top-down style: a two-tone '55 Chevrolet with fins and whitewalls,
              a Willys jeep with its spare on the back, a stake-bed Ford/Chevrolet truck, a rounded 1950s guagua (bus) with luggage
              on the roof, a GMC army truck with canvas bows and a star, a bull-drawn carreta. Cars get a colour of their own.
   • HEALTH   an engine temperature, coolant, belt, hoses, plugs, battery, fuel line, brakes, springs, tyres, and a body. Heat
              comes from speed, load, slopes of mud, the hour and rain; cooling from airflow, coolant and a working fan belt.
              FAULTS appear with wear (older vehicles, overloading, rough ground, rain) and are real conditions with symptoms:
                overheat (steam; cut power; let it cool, open the hood, add water — drive it hot and the head gasket goes)
                burst hose (coolant drains) · fan belt snaps (heat, flat battery) · fouled plugs (misfire, lost power)
                dead battery (will not start; jump it, push-start it, replace it) · fuel-line clog / vapour lock (stalls)
                brake fade (long stopping) · broken spring or axle (crawl; needs a garage) · blown gasket (needs a garage)
                flat tyre (patch, spare, or grass stuffing) · stuck in mud (push, or planks)
              Some can be fixed on the road, with the right part or a worse improvised one that fails again later; some cannot.
              Mechanics, chauffeurs and drivers know what they are doing; others take longer and fail more often.
   • CARGO    a trunk / bed / roof rack with a weight limit (v.cargo), loaded and unloaded by hand; overloading slows and heats.
   • PEOPLE   seats, plus a TRUNK for people you would rather not have seen; trucks and buses carry many more. Prisoners, the
              wounded, recruits and willing civilians can be loaded; a checkpoint may search the trunk.
   • ORDERS   put a soldier at the wheel; select him; right-click anywhere: the vehicle drives there along the roads (and
              across the fields, if it is a jeep or a truck), stops when something breaks and the driver says what.

   VERBS (the wheel, Q, on a vehicle): look it over · repair <fault> · refuel · add water · open the hood · push · jump-start ·
   stow cargo · unstow cargo · load person · unload people · get in · take the wheel · ride along.
   TUNE: all numbers in the TUNE block.
*/
(function () {
  'use strict';
  const C = window.C, G = () => C.G, clamp = C.clamp, T = C.T, TL = C.TILE;
  const rnd = Math.random;

  // TUNE ---------------------------------------------------------------------------------------------------------------
  const TUNE = {
    onset: 0.0011,          // fault chance per second at wear 1, cruising speed
    heatPerSec: 0.012,      // temperature gain at full speed with a normal load (0..1 scale)
    coolPerSec: 0.016,      // cooling from airflow at full speed with a healthy fan belt and coolant
    idleCool: 0.014,        // cooling per second when stopped (hood closed); hood open ×3
    overheatAt: 0.92, gasketAt: 0.985, gasketSecs: 6,
    mudChance: 0.0035,      // per second on soft ground in rain
    helpers: 3,             // people needed to push-start; 2 to push out of mud
    garageCost: { spring: 45, gasket: 80 },
    partPrice: { hose: 6, belt: 8, plug: 4, battery: 40, tire: 30, patch: 3, tools: 25 },
  };
  C.GARAGE_TUNE = TUNE;

  // The period fleet: names, seats, trunk, cargo capacity (weight units, see ITEMS), body details
  const V = C.VEHICLES;
  Object.assign(V.car, { n: "Chevrolet Bel Air '55", cap: 5, trunk: 2, cargoCap: 70, year: 1955 });
  Object.assign(V.jeep, { n: 'Willys CJ-2A jeep', cap: 4, trunk: 0, cargoCap: 60, year: 1948 });
  Object.assign(V.truck, { n: 'Camión Ford F-3 (stake bed)', cap: 14, trunk: 4, cargoCap: 420, year: 1951 });
  Object.assign(V.bus, { n: 'Guagua (autobús)', cap: 30, trunk: 3, cargoCap: 220, year: 1949 });
  Object.assign(V.armyjeep, { n: 'Willys jeep (Ejército)', cap: 4, trunk: 0, cargoCap: 60, year: 1950 });
  Object.assign(V.armytruck, { n: 'GMC "Jimmy" (Ejército)', cap: 18, trunk: 4, cargoCap: 450, year: 1952 });
  Object.assign(V.oxcart, { n: 'Carreta de bueyes', cap: 4, trunk: 0, cargoCap: 300, year: 1900 });
  Object.assign(V.boat, { cargoCap: 160, trunk: 0 });

  // New items for repair and carrying (see inventory.js ITEMS shape)
  const ITEMS = C.ITEMS;
  Object.assign(ITEMS, {
    tools:   { n: 'Tool kit',     icon: '🔧', w: 3.0, res: 'tools',   d: 'Wrenches, pliers, wire. Needed for most repairs.' },
    patch:   { n: 'Patch kit',    icon: '🩹', w: 0.5, res: 'patch',   d: 'Rubber patches and cement for a punctured tube.' },
    hose:    { n: 'Radiator hose', icon: '〰', w: 0.4, res: 'hose',   d: 'A spare radiator hose.' },
    belt:    { n: 'Fan belt',     icon: '⭕', w: 0.3, res: 'belt',    d: 'A spare fan belt.' },
    plug:    { n: 'Spark plugs',  icon: '⚡', w: 0.1, res: 'plug',    d: 'Spark plugs (each repair uses two).' },
    battery: { n: 'Battery',      icon: '🔋', w: 6.0, res: 'battery', d: 'A 6-volt battery.' },
    tire:    { n: 'Spare tire',   icon: '🛞', w: 8.0, res: 'tire',    d: 'A mounted spare.' },
  });
  const gres = () => { const r = G().res; for (const [k, v] of Object.entries({ tools: 1, patch: 2, hose: 1, belt: 1, plug: 4, battery: 0, tire: 1, scrap: 0 })) if (r[k] === undefined) r[k] = v; return r; };

  // ------------------------------------------------------------------------------------------------------------------
  // STATE
  // ------------------------------------------------------------------------------------------------------------------
  let vid = 1;
  /** Lazily create a vehicle's mechanical state. */
  C.vState = function (v) {
    if (v.c) return v.c; const d = v.def, army = !!d.army;
    const age = clamp((1957 - (d.year || 1950)) + rnd() * 6, 0, 40);
    v.id = v.id || vid++; v.cargo = v.cargo || {}; v.trunk = v.trunk || []; v.faults = v.faults || [];
    v.paint = v.paint || PAINTS[(v.id * 7) % PAINTS.length];
    v.c = { temp: 0.25 + rnd() * 0.1, coolant: 0.9, wear: army ? 0.55 + rnd() * 0.3 : clamp(0.45 + age * 0.025 + rnd() * 0.35, 0.4, 1.4), hot: 0, gaskT: 0, helpers: 0 };
    return v.c;
  };
  const PAINTS = [[[32, 160, 160], [240, 238, 228]], [[226, 120, 140], [240, 238, 228]], [[240, 200, 60], [30, 30, 30]], [[190, 50, 46], [236, 224, 200]], [[40, 40, 44], [200, 200, 200]], [[70, 130, 200], [240, 238, 228]], [[120, 160, 90], [236, 226, 190]], [[200, 120, 50], [30, 30, 30]]];

  // The catalogue of faults: how bad, how it shows, what it does, how it can be fixed.
  // fixes: label, need (items from pack/stores), quality (chance it holds), temp (comes back later), garage (needs a garage building + pesos)
  const FAULT = {
    hose: { n: 'burst radiator hose', symptom: 'steam and a puddle of water', w: 1.0, fixes: [{ label: 'Fit a spare hose', need: { hose: 1 }, q: 0.95, dur: 14 }, { label: 'Tape and wire it (scrap)', need: { scrap: 1 }, q: 0.55, temp: true, dur: 10 }] },
    belt: { n: 'snapped fan belt', symptom: 'the engine runs hot and the battery light is on', w: 0.9, fixes: [{ label: 'Fit a spare belt', need: { belt: 1 }, q: 0.95, dur: 14 }, { label: 'Make one from rope and a stocking', need: { scrap: 1 }, q: 0.45, temp: true, dur: 12 }] },
    plugs: { n: 'fouled spark plugs', symptom: 'misfiring, no power', w: 1.1, fixes: [{ label: 'Fit new plugs', need: { plug: 2 }, q: 0.95, dur: 12 }, { label: 'Clean and gap the old ones', need: { tools: 1 }, q: 0.6, temp: true, dur: 10 }] },
    battery: { n: 'dead battery', symptom: 'click… click… nothing', w: 0.7, fixes: [{ label: 'Fit a new battery', need: { battery: 1 }, q: 1, dur: 12 }, { label: 'Jump-start from another vehicle', jump: true, q: 0.95, dur: 8 }, { label: 'Push-start it (3 people)', push: 3, q: 0.8, dur: 10 }] },
    clog: { n: 'blocked fuel line', symptom: 'stalls, coughs, restarts', w: 0.6, fixes: [{ label: 'Blow out the line', need: { tools: 1 }, q: 0.75, dur: 12 }, { label: 'Wait for it to clear', wait: true, q: 0.4, dur: 20 }] },
    brakes: { n: 'faded brakes', symptom: 'the pedal goes soft', w: 0.5, fixes: [{ label: 'Adjust the shoes', need: { tools: 1, scrap: 1 }, q: 0.7, temp: true, dur: 20 }] },
    spring: { n: 'broken leaf spring', symptom: 'the body sags, the ride is brutal', w: 0.45, fixes: [{ label: 'Wire it up (scrap)', need: { scrap: 2, tools: 1 }, q: 0.35, temp: true, dur: 24 }, { label: 'Replace at a garage', garage: 'spring', q: 1, dur: 30 }] },
    gasket: { n: 'blown head gasket', symptom: 'white smoke, oil in the water', w: 0, fixes: [{ label: 'Replace at a garage', garage: 'gasket', q: 1, dur: 40 }] },
    stuck: { n: 'stuck in the mud', symptom: 'the wheels spin', w: 0, fixes: [{ label: 'Get people to push (2)', push: 2, q: 0.9, dur: 10 }, { label: 'Lay planks under the wheels (scrap)', need: { scrap: 2 }, q: 0.85, dur: 14 }] },
  };
  C.FAULT = FAULT;
  const MECH = new Set(['mecanico', 'chofer', 'obrerofab']);
  const skilled = (a) => MECH.has(a.p.occ) || a.p.id === 'che' || a.p.trait === 'handy' || (a.p.traits && a.p.traits.includes('handy'));
  const haveFault = (v, id) => v.faults.find((f) => f.id === id);
  const addFault = (v, id, driver, silent) => {
    if (haveFault(v, id)) return; const f = { id, n: FAULT[id].n, known: false, t: G().time }; v.faults.push(f);
    if (['gasket', 'stuck', 'battery', 'hose'].includes(id) || id === 'clog') f.known = true;
    if (!silent) { const s = G().scene; const loud = driver || v.driver; const txt = { hose: '¡Se reventó la manguera!', belt: 'Se rompió la correa…', plugs: 'No jala bien…', battery: 'Nada… la batería.', clog: 'Se está ahogando.', brakes: 'Los frenos no agarran.', spring: '¡Se rompió una ballesta!', gasket: '¡Se fundió el motor!', stuck: '¡Nos atascamos!' }[id]; if (loud && txt) C.say(loud, txt, '#7a1d1d', 3.5); C.log(`${v.def.n}: ${FAULT[id].n}.`, 'warn'); if (s && C.ui && (v === G().vehicle)) C.ui.toast(`${FAULT[id].n} — ${FAULT[id].symptom}`); }
  };
  const power = (v) => {
    let k = 1; if (haveFault(v, 'plugs')) k *= 0.55; if (haveFault(v, 'clog')) k *= 0.35; if (haveFault(v, 'spring')) k *= 0.5; if (haveFault(v, 'stuck')) k *= 0.05; if (haveFault(v, 'gasket')) k *= 0.0;
    const c = C.vState(v); if (c.temp > 0.85) k *= 0.7; const over = loadOf(v) / (v.def.cargoCap || 100); if (over > 1) k *= 1 / (1 + (over - 1) * 1.5);
    return k;
  };
  C.vehPower = power;
  /** Why can this vehicle not move right now? (null if it can) */
  C.vehBlocked = function (v) {
    const c = C.vState(v); if (v.def.water || !v.def.tank) return null;
    if (haveFault(v, 'battery')) return 'The battery is dead.'; if (haveFault(v, 'gasket')) return 'The engine is finished without a garage.'; if (c.stall) return c.stall;
    if (v.fuel <= 0.05) return 'The tank is empty.'; if (haveFault(v, 'stuck')) return 'Stuck in the mud.'; return null;
  };
  const loadOf = (v) => { let w = 0; for (const k in v.cargo || {}) w += (ITEMS[k] ? ITEMS[k].w : 1) * v.cargo[k]; w += (v.trunk || []).length * 9; return w; };
  C.vehLoad = loadOf;

  // ------------------------------------------------------------------------------------------------------------------
  // THE PER-FRAME MACHINE (called from ai.js updateVehicles for every vehicle, and so for the player's too)
  // ------------------------------------------------------------------------------------------------------------------
  C.vehTick = function (s, v, dt) {
    if (v.wreck || v.def.water) return; const c = C.vState(v), d = v.def, g = G();
    if (!d.tank) return;                                                          // ox-carts have no engine
    const sp = Math.abs(v.spd || 0), run = (v.driver || v.driving) && sp > 4 && !c.stall;
    const t = C.tileAt(s, v.x, v.y); const soft = !d.wheels ? false : (t === TL.G || t === TL.CANE || t === TL.SAND || t === TL.TRAIL);
    const load = clamp(loadOf(v) / (d.cargoCap || 100), 0, 2);
    const hot = g.hour > 11 && g.hour < 17 ? 1.15 : g.hour < 6 ? 0.8 : 1;
    const belt = haveFault(v, 'belt') ? 0.15 : 1, cool = (1 - (haveFault(v, 'hose') ? 0.85 : 0)) * (c.coolant > 0.2 ? 1 : 0.3) * belt;
    // heat and cooling
    if (run) c.temp += (TUNE.heatPerSec * (0.3 + sp / d.spd) * (1 + load * 0.6) * (soft ? 1.5 : 1) * hot - TUNE.coolPerSec * (sp / d.spd) * cool) * dt;
    else if (v.driver || c.temp > 0.3) c.temp -= TUNE.idleCool * (v.hood ? 3 : 1) * (cool > 0.5 ? 1 : 0.6) * dt;
    c.temp = clamp(c.temp, 0.1, 1.2);
    if (haveFault(v, 'hose') && run) c.coolant = Math.max(0, c.coolant - 0.01 * dt);
    // overheat: engine cuts out; drive it hot and the gasket goes
    if (c.temp >= TUNE.overheatAt && !c.stall) { c.stall = 'The engine has overheated.'; v.spd *= 0.4; const dr = v.driver; if (dr) C.say(dr, '¡Se calentó el motor!', '#7a1d1d', 3.5); C.log(`${d.n} overheated — let it cool, open the hood, add water.`, 'warn'); if (v === g.vehicle) C.ui.toast('Overheated! Stop, open the hood (E on the vehicle → Q wheel), add water.'); }
    if (c.stall && c.stall.startsWith('The engine has overheated') && c.temp < 0.62) { c.stall = null; if (v.driver && v.driver.isPlayer) C.ui.toast('The engine has cooled — it will start.'); }
    if (c.temp > TUNE.gasketAt && run) { c.gaskT += dt; if (c.gaskT > TUNE.gasketSecs) addFault(v, 'gasket'); } else c.gaskT = Math.max(0, c.gaskT - dt);
    // steam and smoke
    if (c.temp > 0.8 && Math.random() < dt * 6) C.fx.smoke(s, v.x + Math.cos(v.ang) * d.w * 0.4, v.y + Math.sin(v.ang) * d.w * 0.4 - 5, 'smoke');
    if (haveFault(v, 'plugs') && run && Math.random() < dt * 2.5) C.fx.smoke(s, v.x - Math.cos(v.ang) * d.w * 0.5, v.y - Math.sin(v.ang) * d.w * 0.5 - 3, 'smoke');
    // stalls: clog / vapour lock in the heat
    if (haveFault(v, 'clog') && run && Math.random() < dt * 0.25) { c.stall = 'The engine has stalled.'; c.stallT = 6 + rnd() * 6; }
    if (c.stall === 'The engine has stalled.') { c.stallT -= dt; v.spd *= 0.95; if (c.stallT <= 0) c.stall = null; }
    // onset of faults
    if (run && !v.ambientSafe) {
      const rain = g.weather.rain, rough = soft ? 1.8 : 1; const base = TUNE.onset * c.wear * (0.4 + sp / d.spd) * rough * (1 + load) * (1 + rain * 0.5) * dt;
      if (rnd() < base) { const ids = Object.keys(FAULT).filter((k) => FAULT[k].w > 0 && !haveFault(v, k)); let tot = 0; for (const k of ids) tot += FAULT[k].w; let r = rnd() * tot, pickk = null; for (const k of ids) { r -= FAULT[k].w; if (r <= 0) { pickk = k; break; } } if (pickk) { addFault(v, pickk, v.driver); if (pickk === 'belt') c.temp += 0.05; if (pickk === 'spring' || pickk === 'brakes') { /* felt, not seen */ } } }
      if (soft && rain > 0.4 && sp < 60 && rnd() < TUNE.mudChance * dt * 10 * (d.cap > 6 ? 0.6 : 1)) addFault(v, 'stuck', v.driver);
    }
    // symptoms make faults known after a while
    for (const f of v.faults) if (!f.known && G().time - f.t > 25 && run) f.known = true;
    // brakes: long stopping
    if (haveFault(v, 'brakes') && v.spd) v.spd *= 1 + dt * 0.35 * (v.spd > 0 ? 0 : 0);
    // temporary repairs come back
    for (const f of v.faults) if (f.fixedUntil && G().min > f.fixedUntil) { f.fixedUntil = 0; }
    for (let i = v.faults.length - 1; i >= 0; i--) { const f = v.faults[i]; if (f.mendedTemp && G().min > f.mendedTemp) { v.faults.splice(i, 1); addFault(v, f.id, v.driver); } }
    // ambient traffic is mended by a passing mechanic after a while
    if (v.ambient && v.faults.length && g.time - (v.faults[0].t || 0) > 300) { v.faults.length = 0; c.stall = null; c.temp = 0.3; }
  };

  // ------------------------------------------------------------------------------------------------------------------
  // VERBS
  // ------------------------------------------------------------------------------------------------------------------
  const inv = (a) => C.initInv(a.p);
  const avail = (a, k) => (inv(a)[k] || 0) + (gres()[k] || 0);
  const useItem = (a, k, n) => { let need = n; const i = inv(a); const m = Math.min(need, i[k] || 0); if (m) { i[k] -= m; need -= m; } if (need > 0) gres()[k] = Math.max(0, gres()[k] - need); };
  const helpersNear = (a, v, n) => a.scene.actors.filter((q) => !q.dead && !q.inside && !q.inVeh && (q.side === 'rebel' || q.isPlayer) && Math.hypot(q.x - v.x, q.y - v.y) < 50).length >= n;
  const garageNear = (v) => v.scene !== undefined ? null : G().scene.blds.find((b) => b.tag === 'fuel' && Math.hypot(G().scene.doorPx(b).x - v.x, G().scene.doorPx(b).y - v.y) < 240);

  C.registerVerb({ id: 'inspect_veh', n: 'Look it over', icon: '🔍', kinds: ['vehicle'], reach: 26, dur: 8,
    done: (a, tg) => { const v = tg.o; C.vState(v); let n = 0; for (const f of v.faults) { if (!f.known && (skilled(a) || rnd() < 0.7)) { f.known = true; n++; } } const c = v.c; const parts = []; parts.push(`temperature ${c.temp > 0.8 ? 'HIGH' : c.temp > 0.6 ? 'warm' : 'normal'}`); parts.push(`coolant ${Math.round(c.coolant * 100)}%`); parts.push(`fuel ${Math.round(v.fuel)}/${v.def.tank}`); parts.push(`tires ${v.tires.filter((q) => q < 0.2).length ? v.tires.filter((q) => q < 0.2).length + ' flat' : 'ok'}`);
      const known = v.faults.filter((f) => f.known).map((f) => f.n); C.log(`${C.tagName(a.p)} looked over the ${v.def.n}: ${parts.join(', ')}. ${known.length ? 'Problems: ' + known.join(', ') + '.' : 'Nothing wrong that shows.'}`, 'info'); if (!known.length && v.faults.length) C.say(a, 'Algo no suena bien…', '#222', 3); return null; } });

  C.registerVerb({ id: 'repair', n: 'Repair', icon: '🔧', kinds: ['vehicle'], reach: 24,
    variants: (tg) => { const out = []; const v = tg.o; C.vState(v); for (const f of v.faults) if (f.known) FAULT[f.id].fixes.forEach((fx, i) => out.push({ param: { fault: f.id, fix: i }, label: `${FAULT[f.id].n}: ${fx.label}` })); v.tires.forEach((q, i) => { if (q < 0.2) { out.push({ param: { fault: 'flat', fix: 0, tire: i }, label: `Flat tire ${i + 1}: patch it` }); out.push({ param: { fault: 'flat', fix: 1, tire: i }, label: `Flat tire ${i + 1}: put on the spare` }); out.push({ param: { fault: 'flat', fix: 2, tire: i }, label: `Flat tire ${i + 1}: stuff it with grass (scrap)` }); } }); return out; },
    dur: (a, tg, p) => { if (p.fault === 'flat') return [12, 16, 10][p.fix] * (skilled(a) ? 0.6 : 1); const fx = FAULT[p.fault].fixes[p.fix]; return fx.dur * (skilled(a) ? 0.6 : 1.1); },
    check: (a, tg, p) => {
      if (!p) return null; const v = tg.o;
      if (p.fault === 'flat') { const need = [{ patch: 1 }, { tire: 1 }, { scrap: 1 }][p.fix]; for (const k in need) if (avail(a, k) < need[k]) return `Needs ${ITEMS[k] ? ITEMS[k].n.toLowerCase() : k}.`; return v.tires[p.tire] >= 0.2 ? 'That tire is fine.' : null; }
      const f = haveFault(v, p.fault); if (!f) return 'Already dealt with.'; const fx = FAULT[p.fault].fixes[p.fix];
      if (fx.need) for (const k in fx.need) if (avail(a, k) < fx.need[k]) return `Needs ${fx.need[k] > 1 ? fx.need[k] + ' ' : ''}${ITEMS[k] ? ITEMS[k].n.toLowerCase() : k}.`;
      if (fx.push && !helpersNear(a, v, fx.push)) return `Needs ${fx.push} people beside it.`;
      if (fx.jump && !a.scene.vehicles.some((o) => o !== v && !o.wreck && o.def.tank && !haveFault(o, 'battery') && Math.hypot(o.x - v.x, o.y - v.y) < 70)) return 'Needs another running vehicle alongside.';
      if (fx.garage) { const gb = a.scene.blds.find((b) => b.tag === 'fuel' && Math.hypot(a.scene.doorPx(b).x - v.x, a.scene.doorPx(b).y - v.y) < 240); if (!gb) return 'Beyond a roadside fix — it needs a garage (a gas station with a workshop).'; if (G().res.money < TUNE.garageCost[fx.garage]) return `The garage wants ${TUNE.garageCost[fx.garage]} pesos.`; }
      return null; },
    done: (a, tg, p) => {
      const v = tg.o, g = G(); const sk = skilled(a);
      if (p.fault === 'flat') { const need = [{ patch: 1 }, { tire: 1 }, { scrap: 1 }][p.fix]; for (const k in need) useItem(a, k, need[k]); const q = [0.9, 1, 0.5][p.fix] * (sk ? 1 : 0.85); if (rnd() < q) { v.tires[p.tire] = p.fix === 2 ? 0.45 : 1; C.log(`${C.tagName(a.p)} fixed the tire.`, 'good'); } else C.log('The patch did not hold.', 'warn'); return null; }
      const fx = FAULT[p.fault].fixes[p.fix], f = haveFault(v, p.fault);
      if (fx.need) for (const k in fx.need) useItem(a, k, fx.need[k]); if (fx.garage) g.res.money -= TUNE.garageCost[fx.garage];
      const ok = rnd() < fx.q * (sk ? 1 : 0.85);
      if (ok) { if (fx.temp) { f.mendedTemp = g.min + 40 + rnd() * 120; f.known = false; v.faults.splice(v.faults.indexOf(f), 1); const ff = { id: p.fault, n: FAULT[p.fault].n, known: false, t: g.time, mendedTemp: f.mendedTemp, patched: true }; /* pending relapse stored as a hidden entry */ pending(v, ff); } else v.faults.splice(v.faults.indexOf(f), 1); if (p.fault === 'hose') v.c.coolant = Math.max(v.c.coolant, 0.4); if (p.fault === 'battery') v.c.stall = null; if (p.fault === 'stuck') v.c.stall = null; C.say(a, '¡Listo!', '#1d5b2a', 2.5); C.log(`${C.tagName(a.p)} got the ${FAULT[p.fault].n} sorted${fx.temp ? ' (it will not last)' : ''}.`, 'good'); }
      else { C.log(`${C.tagName(a.p)} could not fix the ${FAULT[p.fault].n}.`, 'warn'); C.say(a, 'No sale…', '#7a1d1d', 2.5); return 'It would not take.'; }
      return null; } });
  // a temporary repair is removed from the list and returns later: kept on v.pend
  function pending(v, ff) { v.pend = v.pend || []; v.pend.push(ff); }
  const origTick = C.vehTick; C.vehTick = function (s, v, dt) { origTick(s, v, dt); if (v.pend && v.pend.length) { for (let i = v.pend.length - 1; i >= 0; i--) { const f = v.pend[i]; if (G().min > f.mendedTemp) { v.pend.splice(i, 1); addFault(v, f.id, v.driver); } } } };

  C.registerVerb({ id: 'refuel', n: 'Refuel', icon: '⛽', kinds: ['vehicle'], reach: 24, dur: 8,
    check: (a, tg) => (!tg.o.def.tank ? 'No engine.' : G().res.fuel < 1 ? 'No fuel in stock.' : tg.o.fuel >= tg.o.def.tank - 1 ? 'Tank is full.' : null),
    done: (a, tg) => { const g = G(), v = tg.o; const add = Math.min(g.res.fuel, v.def.tank - v.fuel); g.res.fuel -= add; v.fuel += add; if (v.c && v.c.stall === 'The tank is empty.') v.c.stall = null; C.log(`+${Math.round(add)} fuel.`, 'info'); return null; } });
  C.registerVerb({ id: 'add_water', n: 'Add water to the radiator', icon: '💧', kinds: ['vehicle'], reach: 24, dur: 6,
    check: (a, tg) => (!tg.o.def.tank ? 'No radiator.' : !(inv(a).bwater > 0) ? 'No water in the bucket.' : tg.o.c && tg.o.c.temp > 0.85 && !tg.o.hood ? 'Open the hood and let it breathe first — cold water on a hot block cracks it.' : null),
    done: (a, tg) => { const v = tg.o; C.vState(v); inv(a).bwater--; v.c.coolant = Math.min(1, v.c.coolant + 0.5); v.c.temp = Math.max(0.3, v.c.temp - 0.15); return null; } });
  C.registerVerb({ id: 'open_hood', n: 'Open / close the hood', icon: '🚗', kinds: ['vehicle'], reach: 22, dur: 2,
    check: (a, tg) => (!tg.o.def.tank ? 'Nothing to open.' : null), done: (a, tg) => { tg.o.hood = !tg.o.hood; return null; } });
  C.registerVerb({ id: 'push_veh', n: 'Push', icon: '🫸', kinds: ['vehicle'], reach: 26, dur: 6,
    check: (a, tg) => (tg.o.def.tank && !haveFault(tg.o, 'stuck') && !haveFault(tg.o, 'battery') ? 'No reason to push it.' : null), done: () => null });

  // CARGO ------------------------------------------------------------------------------------------------------------
  const STOWABLE = ['food', 'ammo', 'med', 'fuel', 'hammock', 'stake', 'seed', 'feed', 'lena', 'hoe', 'axe', 'bucket', 'tools', 'patch', 'hose', 'belt', 'plug', 'battery', 'tire', 'snare', 'line', 'pamph', 'primer', 'shell', 'rocket'];
  C.registerVerb({ id: 'stow', n: 'Load cargo', icon: '📦', kinds: ['vehicle'], reach: 26, dur: 5,
    variants: (tg) => [{ param: { item: '*' }, label: 'Load everything you can spare' }].concat(['food', 'ammo', 'med', 'fuel', 'hammock', 'tools', 'tire', 'battery'].map((k) => ({ param: { item: k }, label: `Load ${ITEMS[k].n.toLowerCase()}` }))),
    check: (a, tg, p) => { if (!p) return null; const v = tg.o; C.vState(v); if (loadOf(v) >= (v.def.cargoCap || 0) - 0.2) return 'Full.'; if (p.item !== '*' && !(inv(a)[p.item] > 0)) return `You carry no ${ITEMS[p.item].n.toLowerCase()}.`; return null; },
    done: (a, tg, p) => { const v = tg.o, i = inv(a); const cap = v.def.cargoCap || 0; let moved = 0; const keys = p.item === '*' ? STOWABLE : [p.item]; for (const k of keys) { let n = i[k] || 0; if (!n || !ITEMS[k]) continue; if (p.item === '*' && ['ammo', 'med'].includes(k)) n = Math.max(0, n - 3); while (n > 0 && loadOf(v) + ITEMS[k].w <= cap) { i[k]--; n--; v.cargo[k] = (v.cargo[k] || 0) + 1; moved++; } } C.log(moved ? `Loaded ${moved} item${moved > 1 ? 's' : ''} into the ${v.def.n}.` : 'Nothing fits.', 'info'); return null; } });
  C.registerVerb({ id: 'unstow', n: 'Unload cargo', icon: '📤', kinds: ['vehicle'], reach: 26, dur: 5,
    variants: (tg) => { const v = tg.o; return [{ param: { item: '*' }, label: 'Unload everything' }].concat(Object.keys(v.cargo || {}).filter((k) => v.cargo[k] > 0).map((k) => ({ param: { item: k }, label: `Unload ${ITEMS[k] ? ITEMS[k].n.toLowerCase() : k} (${v.cargo[k]})` }))); },
    check: (a, tg, p) => (Object.values(tg.o.cargo || {}).every((n) => !n) ? 'Nothing in it.' : null),
    done: (a, tg, p) => { const v = tg.o; const keys = p.item === '*' ? Object.keys(v.cargo) : [p.item]; let n = 0; for (const k of keys) { while (v.cargo[k] > 0) { v.cargo[k]--; const got = C.invAdd(a.p, k, 1); if (!got) { const res = gres(); if (ITEMS[k].res) res[ITEMS[k].res] = (res[ITEMS[k].res] || 0) + 1; else a.scene.items.push({ k, x: a.x + 6, y: a.y + 3, amount: 1, label: ITEMS[k].n }); } n++; } } C.log(`Unloaded ${n} item${n > 1 ? 's' : ''}.`, 'info'); return null; } });

  // PEOPLE ------------------------------------------------------------------------------------------------------------
  const willing = (q) => q.side === 'rebel' || q.surrendered || q.p.status === 'jailed' || (q.p.hp < q.p.maxHp * 0.4) || q.p.trueStance > 12 || q.p.wantsJoin !== undefined;
  C.registerVerb({ id: 'load_person', n: 'Put them in', icon: '🚗', kinds: ['actor'], reach: 30, dur: 4,
    variants: () => [{ param: { where: 'seat' }, label: 'Into the seat' }, { param: { where: 'trunk' }, label: 'Into the trunk (out of sight)' }],
    check: (a, tg, p) => { const q = tg.o; if (q.isPlayer) return 'Not you.'; if (!p) return null; const v = nearestVeh(a.scene, a); if (!v) return 'No vehicle beside you.'; if (!willing(q)) return 'They will not get in.'; if (p.where === 'seat' && v.pass.length + (v.driver ? 1 : 0) >= v.def.cap) return 'No seats left.'; if (p.where === 'trunk' && (v.trunk || []).length >= (v.def.trunk || 0)) return 'No room in the trunk.'; return null; },
    done: (a, tg, p) => { const v = nearestVeh(a.scene, a), q = tg.o; C.vState(v); if (p.where === 'trunk') { q.inVeh = v; q.hiddenInVeh = true; q.inTrunk = true; v.trunk.push(q); q.order = null; } else { if (!v.driver) { C.enterVehicle(q, v); } else C.enterVehicle(q, v); } C.log(`${C.tagName(q.p)} ${p.where === 'trunk' ? 'is in the trunk' : 'got in'}.`, 'info'); return null; } });
  function nearestVeh(s, a) { let best = null, bd = 60; for (const v of s.vehicles) { if (v.gone || v.wreck) continue; const d = Math.hypot(v.x - a.x, v.y - a.y); if (d < bd) { bd = d; best = v; } } return best; }
  C.registerVerb({ id: 'unload_people', n: 'Everyone out', icon: '🚪', kinds: ['vehicle'], reach: 30, dur: 3,
    check: (a, tg) => ((tg.o.pass.length + (tg.o.trunk || []).length) ? null : 'Nobody to unload.'),
    done: (a, tg) => { const v = tg.o; for (const q of v.trunk.slice()) { v.trunk.splice(v.trunk.indexOf(q), 1); q.inTrunk = false; q.inVeh = v; C.exitVehicle(q, false); } for (const q of v.pass.slice()) if (!q.isPlayer) C.exitVehicle(q, false); return null; } });
  C.registerVerb({ id: 'take_wheel', n: 'Take the wheel', icon: '🛞', kinds: ['vehicle'], reach: 30, dur: 2,
    check: (a, tg) => { const v = tg.o; if (v.driver && v.driver !== a) return 'Someone is driving.'; if (v.wreck) return 'Wrecked.'; if (!v.def.tank && !v.def.water && v.type !== 'oxcart') return null; return null; },
    done: (a, tg) => { const v = tg.o; if (a.isPlayer) { C.enterVehicle(a, v); G().vehicle = v; C.boardParty(v); v.driving = false; } else { C.enterVehicle(a, v); v.driving = false; C.log(`${C.tagName(a.p)} takes the wheel of the ${v.def.n}. Select him and right-click a destination.`, 'info'); } return null; } });
  C.registerVerb({ id: 'ride', n: 'Ride along', icon: '🪑', kinds: ['vehicle'], reach: 30, dur: 2,
    check: (a, tg) => (!tg.o.driver ? 'Needs a driver at the wheel.' : tg.o.pass.length + 1 >= tg.o.def.cap ? 'No seats left.' : !a.isPlayer ? 'Order the others with Get in.' : null),
    done: (a, tg) => { C.enterVehicle(a, tg.o); G().riding = tg.o; return null; } });
  C.registerVerb({ id: 'get_in', n: 'Get in', icon: '🚪', kinds: ['vehicle'], reach: 30, dur: 2,
    check: (a, tg) => (tg.o.pass.length + (tg.o.driver ? 1 : 0) >= tg.o.def.cap ? 'No seats left.' : null), done: (a, tg) => { C.enterVehicle(a, tg.o); return null; } });

  // the wheel needs vehicles as targets, and macros need to find them again
  const tAt = C.targetsAt; C.targetsAt = function (wx, wy) { const out = tAt.call(this, wx, wy); const s = G().scene; const vs = []; for (const v of s.vehicles) { if (v.gone) continue; if (Math.abs(v.x - wx) < v.def.w * 0.62 && Math.abs(v.y - wy) < v.def.h * 1.1) { C.vState(v); vs.push({ kind: 'vehicle', o: v, x: v.x, y: v.y, label: v.def.n }); } } return vs.concat(out); };
  const refOf = C.refOf; C.refOf = function (tg) { if (tg.kind === 'vehicle') return { kind: 'vehicle', id: tg.o.id, vt: tg.o.type, mode: 'nearest', x: tg.x, y: tg.y }; return refOf(tg); };
  const resolve = C.resolveRef; C.resolveRef = function (s, a, ref, o) { if (ref.kind === 'vehicle') { let best = null, bd = 1e9; for (const v of s.vehicles) { if (v.gone || v.wreck) continue; if (ref.mode === 'specific' ? v.id !== ref.id : v.type !== ref.vt) continue; const d = Math.hypot(v.x - a.x, v.y - a.y); if (d < bd) { bd = d; best = v; } } return best ? { kind: 'vehicle', o: best, x: best.x, y: best.y } : null; } return resolve(s, a, ref, o); };

  // ------------------------------------------------------------------------------------------------------------------
  // EXIT FROM TRUNK, CHECKPOINT SEARCH
  // ------------------------------------------------------------------------------------------------------------------
  const exitV = C.exitVehicle; C.exitVehicle = function (a, hurt) { const v = a.inVeh; if (v && v.trunk) { const i = v.trunk.indexOf(a); if (i >= 0) { v.trunk.splice(i, 1); a.inTrunk = false; } } return exitV.call(this, a, hurt); };
  /** What a checkpoint would find: guns in the cargo, people in the trunk. Returns {guns, people, contraband}. */
  C.checkpointSearch = function (v) { C.vState(v); const guns = (v.cargo.ammo || 0) + (v.cargo.rocket || 0) + (v.cargo.shell || 0); return { guns, people: (v.trunk || []).length, contraband: guns > 0 || (v.trunk || []).length > 0 }; };

  // ------------------------------------------------------------------------------------------------------------------
  // DRIVING ORDERS: a soldier at the wheel drives where you send him
  // ------------------------------------------------------------------------------------------------------------------
  /** Called from main.js commandAt: if any selected soldier is a driver, the vehicle goes to (wx,wy). */
  C.vehOrder = function (wx, wy) {
    const drivers = C.selActors().filter((a) => a.inVeh && a.inVeh.driver === a && !a.isPlayer); if (!drivers.length) return false;
    for (const a of drivers) { const v = a.inVeh; v.order = { x: wx, y: wy, t: 0 }; v.route = null; v.ri = 0; C.vState(v); G().orderMarks.push({ x: wx, y: wy, t: 0, col: '#ffd070' }); C.say(a, '¡Voy!', '#222', 2); }
    C.ui.toast(`${drivers.length} vehicle${drivers.length > 1 ? 's' : ''} driving there`); return true;
  };
  /** One frame of an ordered vehicle (called from updateVehicles). */
  C.vehDrive = function (s, v, dt) {
    const o = v.order, d = v.def, a = v.driver; if (!o || !a) { v.order = null; return false; }
    C.vState(v); const why = C.vehBlocked(v);
    if (why) { v.spd *= (1 - 2.5 * dt); o.t += dt; if (!o.told || o.t - o.told > 30) { o.told = o.t; C.say(a, why.replace('The ', '').replace('Stuck in the mud.', '¡Estamos atascados!'), '#7a1d1d', 4); C.log(`${d.n}: ${why}`, 'warn'); } return true; }
    const dx0 = o.x - v.x, dy0 = o.y - v.y, dist = Math.hypot(dx0, dy0);
    if (dist < 24) { v.order = null; v.spd = 0; C.log(`${C.tagName(a.p)} has arrived.`, 'good'); C.say(a, 'Llegamos.', '#1d5b2a', 3); return true; }
    // route: roads where there are roads; straight across country for the sturdy vehicles
    if (!v.route || v.ri >= v.route.length) {
      const offroadOK = d.type !== 'car' && (v.type === 'jeep' || v.type === 'armyjeep' || v.type === 'truck' || v.type === 'armytruck' || v.type === 'oxcart');
      const r = C.findPath(s, v.x, v.y, o.x, o.y, 'car'); v.route = (r && r.length) ? r : (offroadOK ? [{ x: o.x, y: o.y }] : null); v.ri = 0;
      if (!v.route) { v.order = null; C.say(a, 'No hay camino.', '#7a1d1d', 3.5); C.log('The driver cannot find a way there.', 'warn'); return true; }
    }
    const w = v.route[v.ri]; if (!w) { v.route = null; return true; } const dx = w.x - v.x, dy = w.y - v.y, wd = Math.hypot(dx, dy); if (wd < 7) { v.ri++; return true; }
    let blocked = false; const ex = v.x + Math.cos(v.ang) * (d.w * 0.7 + 8), ey = v.y + Math.sin(v.ang) * (d.w * 0.7 + 8);
    for (const q of s.actors) { if (q.inside || q.dead || q.inVeh || q === a) continue; if (Math.abs(q.x - ex) < 12 && Math.abs(q.y - ey) < 12) { blocked = true; break; } }
    const want = Math.atan2(dy, dx); let da = want - v.ang; while (da > Math.PI) da -= 6.283; while (da < -Math.PI) da += 6.283; v.ang += clamp(da, -2.4 * dt, 2.4 * dt);
    const t = C.tileAt(s, v.x, v.y); let mx = d.spd * 0.6 * power(v); if (d.wheels) { if (t === TL.G || t === TL.SAND) mx *= 0.55; else if (t === TL.CANE) mx *= 0.35; else if (t === TL.TRAIL) mx *= 0.8; } if (v.tires.some((q) => q < 0.2)) mx *= 0.5; if (Math.abs(da) > 0.8) mx *= 0.5;
    v.spd = blocked ? Math.max(0, v.spd - 200 * dt) : Math.min(mx, v.spd + 100 * dt);
    const nx = v.x + Math.cos(v.ang) * v.spd * dt, ny = v.y + Math.sin(v.ang) * v.spd * dt; const tt = C.tileAt(s, nx, ny); if (C.TCOST[tt] === 0 || tt === TL.FOR) { v.route = null; v.spd *= 0.3; o.fail = (o.fail || 0) + 1; if (o.fail > 40) { v.order = null; v.spd = 0; C.say(a, 'No hay paso por aquí.', '#7a1d1d', 4); C.log('The driver cannot get through there — too much forest.', 'warn'); } } else { v.x = nx; v.y = ny; }
    if (d.tank) v.fuel = Math.max(0, v.fuel - d.burn * dt * (0.08 + 0.45 * Math.abs(v.spd) / d.spd) * 0.5);
    for (const q of [v.driver].concat(v.pass, v.trunk || [])) if (q) { q.x = v.x; q.y = v.y; }
    return true;
  };

  // ------------------------------------------------------------------------------------------------------------------
  // PERIOD LOOKS (called from render.js drawVehicle before the old drawing)
  // ------------------------------------------------------------------------------------------------------------------
  const rgb = (c, a) => `rgba(${c[0]},${c[1]},${c[2]},${a === undefined ? 1 : a})`;
  const shade = (c, k) => [clamp(c[0] * k, 0, 255), clamp(c[1] * k, 0, 255), clamp(c[2] * k, 0, 255)];
  function wheels(c, v, w, h, xs, r) { const tires = v.tires || [1, 1, 1, 1]; xs.forEach((x, i) => { for (const sgn of [-1, 1]) { const idx = (i * 2 + (sgn > 0 ? 1 : 0)) % 4; const flat = tires[idx] <= 0.2; c.fillStyle = flat ? 'rgb(100,44,44)' : 'rgb(22,20,20)'; c.fillRect(x - r, sgn * (h / 2) - (flat ? 0.9 : 1.5) + (sgn > 0 ? 0.3 : -0.3), r * 2, flat ? 1.8 : 3); if (!flat && v.type === 'car') { c.fillStyle = 'rgb(240,238,228)'; c.fillRect(x - r + 1, sgn * (h / 2) - 0.5 + (sgn > 0 ? 0.6 : -0.6), r * 2 - 2, 0.9); } } }); }
  C.drawVehiclePeriod = function (c, v, t) {
    const d = v.def; if (d.water) return false; if (v.type === 'oxcart' || v.type === 'carreton') return drawCart(c, v, t); C.vState(v);
    const w = d.w, h = d.h; const wreck = v.wreck; const P = v.paint || PAINTS[0];
    const body = wreck ? [48, 44, 42] : v.type === 'car' ? P[0] : d.col, top = wreck ? [40, 38, 36] : v.type === 'car' ? P[1] : shade(d.col, 0.85);
    const glass = 'rgba(176,214,232,.9)', chrome = 'rgb(214,214,208)';
    c.fillStyle = 'rgba(0,0,0,.25)'; c.fillRect(-w / 2 + 2, -h / 2 + 3, w, h);
    switch (v.type) {
      case 'car': {
        wheels(c, v, w, h - 1, [w * 0.3, -w * 0.3], 3);
        c.fillStyle = rgb(body); roundRectP(c, -w / 2, -h / 2, w, h, 4); c.fill();                              // body
        if (!wreck) { c.fillStyle = rgb(shade(body, 0.8)); c.beginPath(); c.moveTo(-w / 2, -h / 2 + 1); c.lineTo(-w / 2 - 3, -h / 2 + 0.5); c.lineTo(-w / 2, -h / 2 + 4); c.fill(); c.beginPath(); c.moveTo(-w / 2, h / 2 - 1); c.lineTo(-w / 2 - 3, h / 2 - 0.5); c.lineTo(-w / 2, h / 2 - 4); c.fill(); }   // tail fins
        c.fillStyle = rgb(top); roundRectP(c, -w * 0.22, -h / 2 + 2, w * 0.4, h - 4, 3); c.fill();             // roof (two-tone)
        if (!wreck) { c.fillStyle = glass; c.fillRect(w * 0.18, -h / 2 + 2, w * 0.1, h - 4); c.fillRect(-w * 0.3, -h / 2 + 2.5, w * 0.07, h - 5); c.fillStyle = chrome; c.fillRect(w / 2 - 1.5, -h / 2 + 1, 1.8, h - 2); c.fillRect(-w / 2 - 0.5, -h / 2 + 1.5, 1.4, h - 3); c.fillStyle = chrome; c.fillRect(-w * 0.2, -0.4, w * 0.62, 0.8); if (v.taxi) { c.fillStyle = 'rgb(250,230,80)'; c.fillRect(-2, -1.5, 4, 3); } }
        break; }
      case 'jeep': case 'armyjeep': {
        wheels(c, v, w, h + 1, [w * 0.28, -w * 0.28], 3);
        c.fillStyle = rgb(body); roundRectP(c, -w / 2, -h / 2 + 0.5, w, h - 1, 2); c.fill();
        c.fillStyle = rgb(shade(body, 0.78)); c.fillRect(w * 0.12, -h / 2 + 0.5, w * 0.38, h - 1); c.fillStyle = 'rgba(0,0,0,.25)'; for (const y of [-h / 2 + 2, h / 2 - 3.2]) c.fillRect(w * 0.3, y, 5, 1.2);                       // hood with fender bulges
        if (!wreck) { c.fillStyle = glass; c.fillRect(w * 0.08, -h / 2 + 1, 1.6, h - 2); c.fillStyle = 'rgb(30,30,30)'; c.beginPath(); c.arc(-w / 2 - 1, 0, 3.2, 0, 6.3); c.fill(); c.fillStyle = 'rgb(70,70,66)'; c.beginPath(); c.arc(-w / 2 - 1, 0, 1.4, 0, 6.3); c.fill(); if (d.army) { c.fillStyle = 'rgb(236,236,230)'; c.beginPath(); for (let i = 0; i < 5; i++) { const a = -Math.PI / 2 + i * 1.2566; c.lineTo(Math.cos(a) * 3 - w * 0.05, Math.sin(a) * 3); const a2 = a + 0.628; c.lineTo(Math.cos(a2) * 1.3 - w * 0.05, Math.sin(a2) * 1.3); } c.fill(); } }
        break; }
      case 'truck': case 'armytruck': {
        wheels(c, v, w, h, [w * 0.34, -w * 0.3, -w * 0.12], 3);
        const army = !!d.army; c.fillStyle = rgb(shade(body, 0.8)); c.fillRect(-w / 2, -h / 2, w * 0.62, h);                          // bed
        c.fillStyle = rgb(army ? [200, 196, 160] : [170, 130, 80]); if (!army) { c.fillRect(-w / 2 + 1, -h / 2 + 1, w * 0.62 - 2, h - 2); c.strokeStyle = 'rgba(60,40,20,.7)'; c.lineWidth = 0.7; for (let x = -w / 2 + 4; x < w * 0.1; x += 4) { c.beginPath(); c.moveTo(x, -h / 2 + 1); c.lineTo(x, h / 2 - 1); c.stroke(); } }
        else { c.fillStyle = 'rgb(176,172,132)'; roundRectP(c, -w / 2 + 1, -h / 2 + 1, w * 0.6, h - 2, 3); c.fill(); c.strokeStyle = 'rgba(70,64,40,.7)'; c.lineWidth = 0.7; for (let x = -w / 2 + 5; x < w * 0.1; x += 6) { c.beginPath(); c.moveTo(x, -h / 2 + 1); c.lineTo(x, h / 2 - 1); c.stroke(); } }
        // cargo on the bed
        const sacks = Math.min(6, Math.round(Object.values(v.cargo || {}).reduce((q, n) => q + n, 0) / 6)); if (!army) for (let i = 0; i < sacks; i++) { c.fillStyle = 'rgb(190,160,110)'; c.fillRect(-w / 2 + 3 + (i % 3) * 7, -h / 2 + 3 + Math.floor(i / 3) * 6, 5.5, 4.5); }
        if (!army && (v.pass.length > 0)) { c.fillStyle = 'rgba(214,60,50,.9)'; for (let i = 0; i < Math.min(6, v.pass.length); i++) c.fillRect(-w / 2 + 4 + (i % 3) * 7, -h / 2 + 3 + Math.floor(i / 3) * 6, 3.2, 3.2); }
        c.fillStyle = rgb(body); roundRectP(c, w * 0.14, -h / 2, w * 0.36, h, 3); c.fill();                                            // cab
        if (!wreck) { c.fillStyle = glass; c.fillRect(w * 0.3, -h / 2 + 1.2, w * 0.09, h - 2.4); c.fillStyle = chrome; c.fillRect(w / 2 - 1.4, -h / 2 + 1, 1.8, h - 2); c.fillStyle = rgb(shade(body, 0.7)); c.fillRect(w * 0.42, -h / 2 + 1.5, w * 0.08, h - 3); if (army) { c.fillStyle = 'rgb(236,236,230)'; c.fillRect(w * 0.2, -1, 4, 2); c.fillRect(w * 0.2 + 1, -2, 2, 4); } }
        break; }
      case 'bus': {
        wheels(c, v, w, h, [w * 0.32, -w * 0.3], 3.2);
        c.fillStyle = rgb(wreck ? body : [226, 188, 58]); roundRectP(c, -w / 2, -h / 2, w, h, 5); c.fill();
        c.fillStyle = rgb(wreck ? top : [196, 62, 50]); c.fillRect(-w / 2, -h / 2 + h * 0.38, w, h * 0.24);                                // livery stripe
        if (!wreck) { c.fillStyle = glass; for (let i = 0; i < 6; i++) { c.fillRect(-w / 2 + 4 + i * 6.2, -h / 2 + 0.7, 4.4, 2.2); c.fillRect(-w / 2 + 4 + i * 6.2, h / 2 - 2.9, 4.4, 2.2); } c.fillRect(w / 2 - 5, -h / 2 + 1.5, 3.4, h - 3); c.fillStyle = chrome; c.fillRect(w / 2 - 1.2, -h / 2 + 1, 1.5, h - 2); c.fillStyle = 'rgb(60,50,30)'; c.fillRect(-w / 2 + 3, -h / 2 + 4, w * 0.62, h - 8); c.strokeStyle = 'rgba(40,30,20,.6)'; c.lineWidth = 0.6; c.strokeRect(-w / 2 + 3, -h / 2 + 4, w * 0.62, h - 8);
          const lug = Math.min(5, Math.round(Object.values(v.cargo || {}).reduce((q, n) => q + n, 0) / 8)); for (let i = 0; i < lug; i++) { c.fillStyle = 'rgb(170,130,80)'; c.fillRect(-w / 2 + 6 + i * 7, -h / 2 + 5.5, 5.5, h - 11); } }
        break; }
    }
    if (!wreck) {
      if (v.lights || (G().hour < 6.5 || G().hour > 18.5) && (v.driver || v.driving)) { c.fillStyle = 'rgba(255,240,170,.95)'; c.fillRect(w / 2 - 1.6, -h / 2 + 1.2, 2, 2.4); c.fillRect(w / 2 - 1.6, h / 2 - 3.6, 2, 2.4); c.fillStyle = 'rgba(255,240,170,.12)'; c.beginPath(); c.moveTo(w / 2, -h / 2); c.lineTo(w / 2 + 38, -h / 2 - 12); c.lineTo(w / 2 + 38, h / 2 + 12); c.lineTo(w / 2, h / 2); c.fill(); }
      if (v.hood) { c.fillStyle = rgb(shade(body, 1.15)); c.fillRect(w / 2 - 9, -h / 2 + 1, 9, h - 2); c.strokeStyle = 'rgba(0,0,0,.5)'; c.lineWidth = 0.7; c.strokeRect(w / 2 - 9, -h / 2 + 1, 9, h - 2); }
      if (v.faults && v.faults.some((f) => f.known)) { c.fillStyle = 'rgb(240,170,40)'; c.beginPath(); c.moveTo(0, -h / 2 - 7); c.lineTo(3.2, -h / 2 - 1.5); c.lineTo(-3.2, -h / 2 - 1.5); c.fill(); c.fillStyle = '#222'; c.fillRect(-0.4, -h / 2 - 5.5, 0.8, 2.2); }
    }
    return true;
  };
  function drawCart(c, v, t) {
    const d = v.def, w = d.w, h = d.h, moving = Math.abs(v.spd || 0) > 2; const sway = moving ? Math.sin(G().time * 6) * 0.5 : 0;
    c.fillStyle = 'rgba(0,0,0,.25)'; c.fillRect(-w / 2 + 2, -h / 2 + 3, w, h);
    c.fillStyle = 'rgb(30,26,22)'; for (const sg of [-1, 1]) { c.beginPath(); c.ellipse(-2, sg * (h / 2 + 0.5), 4.6, 1.3, 0, 0, 6.3); c.fill(); c.strokeStyle = 'rgb(150,120,80)'; c.lineWidth = 0.6; for (let i = 0; i < 4; i++) { c.beginPath(); c.moveTo(-2 + Math.cos(i * 0.785) * 4.4, sg * (h / 2 + 0.5) + Math.sin(i * 0.785) * 1.2); c.lineTo(-2 - Math.cos(i * 0.785) * 4.4, sg * (h / 2 + 0.5) - Math.sin(i * 0.785) * 1.2); c.stroke(); } }
    c.fillStyle = 'rgb(150,112,72)'; c.fillRect(-w / 2, -h / 2, w * 0.66, h); c.strokeStyle = 'rgb(70,48,30)'; c.lineWidth = 1; c.strokeRect(-w / 2, -h / 2, w * 0.66, h); c.strokeStyle = 'rgba(70,48,30,.6)'; c.lineWidth = 0.6; for (let x = -w / 2 + 4; x < w * 0.15; x += 4) { c.beginPath(); c.moveTo(x, -h / 2); c.lineTo(x, h / 2); c.stroke(); }
    const n = Math.min(5, Math.round(Object.values(v.cargo || {}).reduce((q, k) => q + k, 0) / 10)); for (let i = 0; i < n; i++) { c.fillStyle = 'rgb(196,168,116)'; c.fillRect(-w / 2 + 3 + (i % 3) * 6, -h / 2 + 2 + Math.floor(i / 3) * 6, 5, 4); }
    c.strokeStyle = 'rgb(110,80,50)'; c.lineWidth = 1.4; c.beginPath(); c.moveTo(w * 0.16, 0); c.lineTo(w * 0.62, 0); c.stroke();                        // the tongue
    for (const sg of (v.type === 'carreton' ? [0] : [-1, 1])) { const ox = w * 0.58 + (moving ? Math.sin(G().time * 6 + sg) * 0.6 : 0), oy = sg * 3 + sway; c.fillStyle = 'rgb(222,214,196)'; c.fillRect(ox - 6, oy - 2.3, 11, 4.6); c.fillStyle = 'rgb(176,150,120)'; c.fillRect(ox + 4, oy - 1.8, 4, 3.6); c.fillStyle = 'rgb(240,236,224)'; c.fillRect(ox + 7, oy - 3, 1, 1.2); c.fillRect(ox + 7, oy + 1.8, 1, 1.2); }
    c.strokeStyle = 'rgb(130,100,70)'; c.lineWidth = 1; c.beginPath(); c.moveTo(w * 0.52, -4); c.lineTo(w * 0.52, 4); c.stroke();
    return true;
  }
  function roundRectP(c, x, y, w, h, r) { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }

  // PARTS FOR SALE at gas stations (a conversation: buying is a menu; fitting is a verb)
  C.buyPart = function (k) { const g = G(), price = TUNE.partPrice[k]; if (g.res.money < price) { C.ui.toast('Not enough pesos'); return false; } g.res.money -= price; gres()[k] = (gres()[k] || 0) + 1; C.ui.toast(`Bought ${ITEMS[k].n.toLowerCase()} (${price} pesos)`); return true; };
})();
