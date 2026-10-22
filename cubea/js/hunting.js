/* CUBEA — hunting.js : WILD GAME, HUNTING, SNARES, FISHING, DRESSING AND KEEPING MEAT.

   THE ANIMALS (ai.js ANIMALS table; habitats in spawnAnimals) are those a guerrilla in Oriente could actually eat:
   jutía conga (the great Cuban tree-rat, dusk), puerco jíbaro (feral pig, dangerous when wounded), gallina de guinea (feral
   guinea fowl, in the fields), paloma torcaza (pigeon), codorniz (quail of the cane and pasture), yaguasa (whistling duck of
   the shallows), iguana, and cangrejo de tierra (land crab of the coastal swamp, out at night). Livestock — cattle, pigs,
   hens — is in the farms and villages and belongs to somebody (see forageTransaction). Turkey was removed: the wild turkey
   is not Cuban. Caiman and crocodile (Zapata swamp) are not in these maps. See docs/HUNTING.md for the reasoning.

   THE LOOP (all physical; no "hunt" button)
     FIND     animals keep their own hours (dusk, day, night) and their own senses: birds FLUSH when you walk up, faster if you
              move openly; crabs only bolt when you are almost on them; a jutía at noon is asleep in a hollow.
     TAKE     shoot (a rifle for a pig, a shotgun for birds — noisy: it alerts soldiers and scares everything for 150 px),
              OR set a snare (silent, slow, takes small game while you sleep), OR fish, OR grab a crab. A wounded animal
              runs and BLEEDS: follow the blood. A wounded jíbaro turns on you.
     DRESS    a kill is a carcass until someone dresses it (verb) — quicker with a machete and for people who grew up in
              the monte (guajiros, cane-cutters, charcoal-burners, fishermen).
     KEEP     fresh meat in a Cuban summer lasts hours, not days. Eaten that day it is a feast; after ~10 hours it rots
              unless it is SMOKED on a barbacoa over a lit fire (the Taíno word is where "barbecue" comes from) into tasajo-like
              cured meat. Carcasses left in the field vanish.

   VERBS: dress, set_snare, check_snare, catch_crab, fish, smoke_meat. Presets: Check the snares, Go fishing, Dress the kill, Smoke the meat.
   TUNE: numbers in the TUNE block.
*/
(function () {
  'use strict';
  const C = window.C, G = () => C.G, clamp = C.clamp, TL = C.TILE;

  // TUNE ---------------------------------------------------------------------------------------------------------------
  const TUNE = {
    flushWalk: 60, flushHidden: 24, flushStill: 38,     // px at which a bird bursts away (walking / hiding / standing still)
    crabBolt: 20,                                        // px at which a crab runs
    bleedPerSec: 1.6, trailEvery: 14,                    // wounded animals lose hp and leave a blood spot every N px
    charge: { range: 150, speed: 1.35, dmg: 9, cd: 0.9, reach: 8 },   // wounded fierce animals
    carcassLife: 900,                                    // seconds a carcass lies before the ants and dogs have it
    freshHours: 10, rotPerHour: 0.14,                    // meat is fresh this long, then this share rots per hour
    snareRange: 110, snareChance: 0.16, nightMult: 2.0,  // per hour, per snare, when small game is near
    fishChance: 0.5, fishFood: 3,                        // per attempt (monte skill adds)
    smokeBatch: 12, smokeNeed: 50,                       // units one smoking cures; max px from a lit fire
  };
  C.HUNT_TUNE = TUNE;
  const MONTE = new Set(['campesino', 'guajiro', 'macheteo', 'colono', 'carbonero', 'pescador', 'vaquero']);
  const monte = (a) => (MONTE.has(a.p.occ) ? 1 : 0);
  const inv = (a) => C.initInv(a.p);
  const has = (a, k, n) => (inv(a)[k] || 0) >= (n || 1);
  const g_ = () => G();

  // ------------------------------------------------------------------------------------------------------------------
  // BEHAVIOUR (called every frame from ai.js updateScene)
  // ------------------------------------------------------------------------------------------------------------------
  const activeNow = (act, h) => act === 'night' ? (h >= 19 || h < 5) : act === 'dusk' ? ((h >= 16 && h < 22) || (h >= 4 && h < 8)) : (h >= 6 && h < 18);
  let blood = 0;
  C.huntUpdate = function (s, dt) {
    const g = G(), h = g.hour; const hunters = s.actors.filter((a) => !a.dead && !a.inside && (a.side === 'rebel' || a.isPlayer));
    for (let i = s.animals.length - 1; i >= 0; i--) {
      const an = s.animals[i], d = an.def;
      if (an.dead) { if (g.time - (an.deadT || g.time) > TUNE.carcassLife && !an.claimed) s.animals.splice(i, 1); continue; }
      if (!d.wild) continue;
      // sleeping: outside its hours it stays put (unless scared)
      if (d.act && !(an.flee > 0) && !activeNow(d.act, h)) { an.moving = false; an.wait = Math.max(an.wait, 2); }
      // wounded: bleeds, leaves a trail, eventually drops
      if (an.hp < (an.hpMax || 30) && an.hp > 0 && !an.charging) {
        an.hp -= TUNE.bleedPerSec * dt; an.trail = (an.trail || 0) + (an.flee > 0 ? d.spd * 2.4 * dt : 0);
        if (an.trail > TUNE.trailEvery) { an.trail = 0; s.decals.push({ k: 'blood', x: an.x, y: an.y, r: 2, a: 0.55, rot: Math.random() * 6, t0: g.time, fade: 500 }); }
        if (an.hp <= 0) { an.dead = true; an.deadT = g.time; continue; }
      }
      // nearest hunter
      let near = null, nd = 1e9; for (const a of hunters) { const q = Math.hypot(a.x - an.x, a.y - an.y); if (q < nd) { nd = q; near = a; } }
      if (!near) continue;
      if (d.bird && !(an.flee > 0)) {
        const lim = near.hide || near.prone ? TUNE.flushHidden : near.moving ? TUNE.flushWalk : TUNE.flushStill;
        if (nd < lim) { an.flee = 6; const ang = Math.atan2(an.y - near.y, an.x - near.x) + (Math.random() - 0.5); an.tx = an.x + Math.cos(ang) * 220; an.ty = an.y + Math.sin(ang) * 150; an.moving = true; an.wait = 6; if (Math.random() < 0.5) C.say && 0; for (const o of s.animals) if (o !== an && o.k === an.k && !o.dead && Math.hypot(o.x - an.x, o.y - an.y) < 70) { o.flee = 5; o.tx = an.tx + (Math.random() - 0.5) * 40; o.ty = an.ty + (Math.random() - 0.5) * 40; o.moving = true; } }
      }
      if (d.crab && nd < TUNE.crabBolt && !(an.flee > 0)) { an.flee = 3; const ang = Math.atan2(an.y - near.y, an.x - near.x); an.tx = an.x + Math.cos(ang) * 40; an.ty = an.y + Math.sin(ang) * 30; an.moving = true; }
      // a wounded fierce animal turns and charges the nearest person
      if (d.fierce && an.hp < (an.hpMax || 45) * 0.92 && nd < TUNE.charge.range) {
        an.charging = true; an.flee = 0; const dx = near.x - an.x, dy = near.y - an.y, dd = Math.hypot(dx, dy) || 1, sp = d.spd * TUNE.charge.speed;
        if (dd > TUNE.charge.reach) { const mx = dx / dd * sp * dt, my = dy / dd * sp * dt; if (!C.footBlocked(s, an.x + mx, an.y + my, 2.5)) { an.x += mx; an.y += my; } an.face = dx > 0 ? 1 : -1; an.anim += sp * dt * 0.6; an.moving = true; }
        else { an.cd = (an.cd || 0) - dt; if (an.cd <= 0) { an.cd = TUNE.charge.cd; C.hurt(near, TUNE.charge.dmg * (0.7 + Math.random() * 0.6), null, 0, 'tusks'); C.say && C.say(near, '¡El jíbaro!', '#7a1d1d', 2); } }
        an.hp -= 0.4 * dt;
        if (an.hp <= 0) { an.dead = true; an.deadT = g.time; }
      } else if (an.charging) an.charging = false;
    }
  };

  // ------------------------------------------------------------------------------------------------------------------
  // MEAT: dressing adds fresh meat that rots; smoking cures it
  // ------------------------------------------------------------------------------------------------------------------
  C.addMeat = function (a, n) {
    const g = G(), got = C.invAdd(a.p, 'food', n); const over = n - got; const p = a.p;
    p.fresh = (p.fresh || 0) + got; if (got > 0 && !p.freshT) p.freshT = g.time;
    if (over > 0) { g.res.food += over; g.res.fresh = (g.res.fresh || 0) + over; g.res.freshT = g.res.freshT || g.time; }
    return got + over;
  };
  const hoursSince = (t) => (G().time - t) * (G().minPerSec || 1.5) / 60;
  function rot(label, fresh, t, take) {
    if (!(fresh > 0)) return 0; const age = hoursSince(t); if (age < TUNE.freshHours) return 0;
    const n = Math.min(fresh, Math.max(1, Math.round(fresh * TUNE.rotPerHour))); take(n); return n;
  }
  let acc = 0;
  /** Hourly: rot, and snares. */
  C.huntTick = function (s, minutes) {
    const g = G(); acc += minutes; if (acc < 60) return; const hours = Math.floor(acc / 60); acc -= hours * 60;
    for (let k = 0; k < Math.min(hours, 6); k++) {
      for (const a of s.actors) { if (!(a.side === 'rebel' || a.isPlayer) || a.dead) continue; const p = a.p; const n = rot('pack', p.fresh, p.freshT, (m) => { const i = C.initInv(p); const m2 = Math.min(m, i.food || 0); i.food -= m2; p.fresh -= m; if (p.fresh <= 0) p.freshT = 0; if (m2) C.log(`${m2} of ${C.tagName(p)}'s fresh meat has gone off in the heat.`, 'warn'); }); }
      const n2 = rot('store', g.res.fresh, g.res.freshT, (m) => { const m2 = Math.min(m, g.res.food); g.res.food -= m2; g.res.fresh -= m; if (g.res.fresh <= 0) g.res.freshT = 0; if (m2) C.log(`${m2} rations of fresh meat in the stores turned. Smoke it the day you kill it.`, 'warn'); });
      snares(s, g);
    }
  };
  function snares(s, g) {
    const night = g.hour >= 19 || g.hour < 5;
    for (const t of C.thingsOf(s, 'snare')) {
      if (t.d.catch) continue;
      for (const an of s.animals) {
        if (an.dead || !an.def.snare || Math.hypot(an.x - t.x, an.y - t.y) > TUNE.snareRange) continue;
        const act = an.def.act === 'dusk' || an.def.act === 'night' ? (night ? TUNE.nightMult : 1) : (night ? 0.3 : 1);
        if (Math.random() < TUNE.snareChance * act * (1 + (t.d.skill || 0) * 0.5)) { t.d.catch = an.k; t.d.food = an.def.food; s.animals.splice(s.animals.indexOf(an), 1); C.log('A snare has taken something.', 'info'); break; }
      }
    }
  }

  // ------------------------------------------------------------------------------------------------------------------
  // THE SNARE (a thing)
  // ------------------------------------------------------------------------------------------------------------------
  C.THINGS.snare = { n: 'Snare (trampa)', draw(c, t) {
    c.save(); c.strokeStyle = 'rgb(90,70,44)'; c.lineWidth = 1.2; c.beginPath(); c.moveTo(t.x - 5, t.y + 2); c.lineTo(t.x - 5, t.y - 6); c.moveTo(t.x + 5, t.y + 2); c.lineTo(t.x + 5, t.y - 6); c.stroke();
    c.strokeStyle = t.d.catch ? 'rgb(214,60,50)' : 'rgb(200,200,190)'; c.lineWidth = 0.9; c.beginPath(); c.ellipse(t.x, t.y - 1, 5, 2.4, 0, 0, 6.3); c.stroke();
    if (t.d.catch) { c.fillStyle = 'rgb(214,60,50)'; c.fillRect(t.x - 1, t.y - 11, 2, 4); } c.restore(); } };

  // ------------------------------------------------------------------------------------------------------------------
  // VERBS
  // ------------------------------------------------------------------------------------------------------------------
  C.registerVerb({ id: 'dress', n: 'Dress the kill', icon: '🔪', kinds: ['animal'], reach: 14,
    dur: (a, tg) => Math.max(4, (tg.o.def.sz * 2 + 4) * (a.p.wpn === 'machete' || (a.weapon && a.weapon.k === 'machete') ? 0.6 : 1) * (monte(a) ? 0.55 : 1)),
    check: (a, tg) => (!tg.o.dead ? 'It is still alive.' : tg.o.claimed ? 'Already dressed.' : null),
    done: (a, tg) => {
      const an = tg.o, s = a.scene; const f = an.fat != null ? 0.6 + 0.8 * an.fat : 1;
      const n = Math.max(1, Math.round(an.def.food * f * (monte(a) ? 1.15 : 0.9))); an.claimed = true; const i = s.animals.indexOf(an); if (i >= 0) s.animals.splice(i, 1);
      s.decals.push({ k: 'blood', x: an.x, y: an.y, r: 3.5, a: 0.55, rot: 0, t0: G().time, fade: 500 });
      const got = C.addMeat(a, n); C.log(`${C.tagName(a.p)} dressed a ${an.def.n}: ${got} rations. Eat it today or smoke it.`, 'good'); return null; } });

  C.registerVerb({ id: 'set_snare', n: 'Set a snare', icon: '🪤', kinds: ['ground'], reach: 14, dur: 8,
    check: (a, tg) => (!has(a, 'snare') ? 'No snares.' : null),
    done: (a, tg) => { inv(a).snare--; C.addThing(a.scene, 'snare', tg.x, tg.y, { skill: monte(a), day: G().day }); return null; } });
  C.registerVerb({ id: 'check_snare', n: 'Check the snare', icon: '🪤', kinds: ['thing:snare'], reach: 14, dur: 4,
    check: (a, tg) => (!tg.o.d.catch ? 'Empty.' : null),
    done: (a, tg) => { const d = tg.o.d, def = C.ANIMALS[d.catch]; const n = Math.max(1, Math.round(def.food * 0.85)); C.addMeat(a, n); C.log(`${C.tagName(a.p)} took a ${def.n} from the snare (${n} rations).`, 'good'); d.catch = null; return null; } });
  C.registerVerb({ id: 'pick_snare', n: 'Take the snare up', icon: '📦', kinds: ['thing:snare'], reach: 14, dur: 3,
    done: (a, tg) => { C.invAdd(a.p, 'snare', 1); C.removeThing(a.scene, tg.o); return null; } });

  C.registerVerb({ id: 'catch_crab', n: 'Grab it', icon: '🦀', kinds: ['animal'], reach: 8, dur: 3,
    check: (a, tg) => (!tg.o.def.crab ? 'Too quick for your hands.' : tg.o.dead ? 'Already caught.' : null),
    done: (a, tg) => { const an = tg.o; an.dead = true; an.deadT = G().time; an.claimed = true; const i = a.scene.animals.indexOf(an); if (i >= 0) a.scene.animals.splice(i, 1); C.addMeat(a, 2); return null; } });

  C.registerVerb({ id: 'fish', n: 'Fish', icon: '🎣', kinds: ['water'], reach: 20, dur: 18,
    check: (a) => (!has(a, 'line') ? 'No fishing line.' : null),
    done: (a) => { if (Math.random() < TUNE.fishChance + monte(a) * 0.25) { const n = TUNE.fishFood + (Math.random() < 0.25 ? 2 : 0); C.addMeat(a, n); C.log(`${C.tagName(a.p)} caught fish (${n} rations).`, 'good'); return null; } C.say(a, 'Nada…', '#222', 2); return null; } });

  C.registerVerb({ id: 'smoke_meat', n: 'Smoke the meat', icon: '♨', kinds: ['thing:barbacoa'], reach: 18, dur: 12,
    check: (a, tg) => { const s = a.scene, g = G(); const fire = C.thingsOf(s, 'fire').find((f) => f.d.lit && Math.hypot(f.x - tg.x, f.y - tg.y) < TUNE.smokeNeed); if (!fire) return 'Needs a lit fire right beside the rack.'; if ((a.p.fresh || 0) + (g.res.fresh || 0) < 1) return 'No fresh meat to smoke.'; if ((g.res.lena || 0) < 1) return 'No firewood.'; return null; },
    done: (a) => { const g = G(); g.res.lena--; let left = TUNE.smokeBatch, cured = 0; const p = a.p; const c1 = Math.min(left, p.fresh || 0); p.fresh = (p.fresh || 0) - c1; left -= c1; cured += c1; const c2 = Math.min(left, g.res.fresh || 0); g.res.fresh = (g.res.fresh || 0) - c2; cured += c2; C.log(`${cured} rations of meat smoked on the barbacoa — it will keep.`, 'good'); return null; } });

  // ------------------------------------------------------------------------------------------------------------------
  // PRESETS
  // ------------------------------------------------------------------------------------------------------------------
  const TH = (tk) => ({ kind: 'thing', tk, mode: 'nearest' });
  C.PRESETS.push(
    { id: 'p_snares', name: 'Check the snares', home: true, repeat: 3, steps: [{ t: 'verb', v: 'check_snare', tgt: TH('snare') }] },
    { id: 'p_fish', name: 'Go fishing', home: true, repeat: 1, steps: [{ t: 'verb', v: 'take', param: { item: 'line', n: 1 }, tgt: TH('toolrack') }, { t: 'verb', v: 'fish', tgt: { kind: 'water', mode: 'nearest' } }, { t: 'verb', v: 'put', param: { item: 'line' }, tgt: TH('toolrack') }] },
    { id: 'p_dress', name: 'Dress the kill', home: true, repeat: 1, steps: [{ t: 'verb', v: 'dress', tgt: { kind: 'animal', ak: '*', dead: true, mode: 'nearest' } }] },
    { id: 'p_smoke', name: 'Smoke the meat', home: true, repeat: 1, steps: [{ t: 'verb', v: 'smoke_meat', tgt: TH('barbacoa') }] }
  );
})();
