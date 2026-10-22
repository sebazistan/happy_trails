/* CUBEA — camp.js : THE DAILY LIFE OF A GUERRILLA CAMP.

   A camp here is not a menu of buildings. It is whatever you and your people have physically put on the ground
   (see things.js): hammocks, latrines, storage racks (barbacoas), woodpiles, cooking fires, sentry posts (postas),
   a blackboard, a tool rack, a trough. Each hour of game time C.campTick looks at what is there and what the people
   are doing, and the consequences follow — good and bad — with a spoken or logged reason.

   THE REQUIREMENTS (each is a small physical loop, never a button)
   • LATRINE   every person adds waste several times a day. If an open latrine is near, it fills; when it is full
               (or there is none) the ground fouls. Foul ground, or a latrine close to the water, breeds dysentery.
               Verbs: dig a latrine (needs a hoe), cover it when full (and dig a new one).
   • WATER     a bucket carried from a source (actions.js fill / give_water). A latrine within 40 px of the stream is
               a mistake the camp will pay for. Boiling is not modelled (nobody boiled water then); distance is.
   • FOOD      stores are kept on racks. Food left on the ground in sacks, or racks in the rain, spoils; ants and
               rats take their share. Cooking needs a lit fire and firewood.
   • FUEL      firewood is cut (axe), stacked (woodpile), carried to the fire. A lit fire in daylight is SMOKE that
               can be seen for miles: the guerrillas cooked before dawn or after dusk. Smoke raises the regime's heat.
   • SLEEP     a hammock and a sheet each. Without one a person sleeps on the ground: poorer rest, and the rain makes
               them sick. Hammocks are hung on stakes (physical things you carry and place).
   • WATCH     night posts (postas). A post that has someone standing in it covers the camp; none, and a patrol or an
               informer can walk in. A tired sentry nods off — and says so.
   • SCHOOL    a blackboard and a primer: someone teaches, those nearby learn to read (and, via ideology.js, what
               they read). Che gave classes to peasant recruits; the camp's literacy drive is this loop.
   • MEDICINE  bandaging (actions.js treat); dysentery and fever are real conditions that wear a person down until
               rest and medicine clear them. Sick call is a walk to the people who are ill.

   PUBLIC API
     C.campStats(s)   a summary the HUD / hints use          C.campTick(s, minutes)   hourly consequences
     verbs: dig_latrine, cover_latrine, hang_hammock, build_rack, make_fire, light_fire, post_sentry, stand_watch,
            raise_board, teach, pack_up       presets appended to C.PRESETS (see the bottom of the file)

   TUNE: all numbers are in the TUNE block directly below.
*/
(function () {
  'use strict';
  const C = window.C, G = () => C.G, clamp = C.clamp, dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

  // TUNE ---------------------------------------------------------------------------------------------------------------
  const TUNE = {
    wasteRange: 90,          // px: how far a person will walk to an open latrine
    latrineCap: 14,          // uses before a latrine is full
    waterSafe: 40,           // px: a latrine closer than this to a water tile contaminates it
    foulSick: 0.05,          // dysentery chance per person per day per unit of foul ground (cap 0.5)
    spoilSack: 0.10,         // share of ground-stored food lost per day
    spoilRack: 0.01,         // … on a rack (×3 in the rain)
    rackCap: 40,             // food units one rack keeps off the ground
    smokeHeat: 0.5,          // regime heat per daylight hour with a fire lit
    fuelPerHour: 1,          // firewood burned by a lit fire per hour
    watchHours: [22, 5],     // night is from 22:00 to 05:00
    nap: 0.35,               // chance per hour a sentry with energy < 25 nods off
    lessonGain: 25,          // literacy points per lesson (100 = reads)
  };
  C.CAMP_TUNE = TUNE;

  // ------------------------------------------------------------------------------------------------------------------
  // Helpers
  // ------------------------------------------------------------------------------------------------------------------
  const inv = (a) => C.initInv(a.p);
  const has = (a, k, n) => (inv(a)[k] || 0) >= (n || 1);
  const takeItem = (a, k, n) => { const i = inv(a); if ((i[k] || 0) < n) return false; i[k] -= n; return true; };
  const hourNow = () => G().hour;
  const isNight = (h) => h >= TUNE.watchHours[0] || h < TUNE.watchHours[1];
  /** The rebels physically in this scene (the people the camp is for). */
  function people(s) { return s.actors.filter((a) => (a.side === 'rebel' || a.isPlayer) && !a.dead && !a.inside); }
  /** True if any water tile lies within r px of (x,y). Uses the scene tile map's water test. */
  function waterNear(s, x, y, r) {
    const T = C.T; const rt = Math.ceil(r / T);
    for (let dy = -rt; dy <= rt; dy++) for (let dx = -rt; dx <= rt; dx++) { const tx = Math.floor(x / T) + dx, ty = Math.floor(y / T) + dy; const id = s.get(tx, ty); if (id === 3 || id === 4)  /* DEEP or SHAL */ { if (Math.hypot(dx * T, dy * T) <= r) return true; } }
    return false;
  }

  // ------------------------------------------------------------------------------------------------------------------
  // A summary of the camp, for hints and the tests
  // ------------------------------------------------------------------------------------------------------------------
  C.campStats = function (s) {
    const ppl = people(s), th = (k) => C.thingsOf(s, k);
    const hammocks = th('hammock').length, latr = th('latrine').filter((t) => !t.d.covered);
    const racks = th('barbacoa').length, foodStore = G().res.food;
    return {
      people: ppl.length, hammocks, bedsShort: Math.max(0, ppl.length - hammocks),
      openLatrines: latr.length, fullLatrines: latr.filter((t) => t.d.use >= TUNE.latrineCap).length, foul: s.foul || 0,
      racks, rackCap: racks * TUNE.rackCap, foodStore, sacked: Math.max(0, foodStore - racks * TUNE.rackCap),
      fires: th('fire').length, litFires: th('fire').filter((t) => t.d.lit).length, firewood: G().res.lena || 0,
      postas: th('posta').length, sentries: ppl.filter((a) => a.onWatch).length,
      boards: th('pizarra').length, illiterate: ppl.filter((a) => !a.p.literate).length, sick: ppl.filter((a) => a.p.ill).length,
    };
  };

  // ------------------------------------------------------------------------------------------------------------------
  // THE HOURLY TICK. `minutes` is the game time since the last call (accumulated so nothing is lost at high speed).
  // ------------------------------------------------------------------------------------------------------------------
  let acc = 0, lastDay = -1;
  C.campTick = function (s, minutes) {
    const g = G(); if (!s || people(s).length < 3) return;   // a camp is three or more rebels staying put — with or without any things on the ground
    acc += minutes; if (acc < 60) return; const hours = Math.floor(acc / 60); acc -= hours * 60;
    for (let i = 0; i < Math.min(hours, 6); i++) hourly(s, g);
    if (g.day !== lastDay) { lastDay = g.day; daily(s, g); }
  };

  function hourly(s, g) {
    const h = g.hour, ppl = people(s), say = C.log;
    // keep the woodpile's drawn height honest
    for (const w of C.thingsOf(s, 'woodpile')) w.d.n = g.res.lena || 0;
    for (const r of C.thingsOf(s, 'barbacoa')) r.d.fill = clamp((g.res.food || 0) / Math.max(1, TUNE.rackCap), 0, 1);
    // 1. waste: each person adds a little, more in the morning and evening
    const peak = (h >= 5 && h < 8) || (h >= 16 && h < 19) ? 2.2 : 0.6;
    for (const a of ppl) {
      if (Math.random() > 0.35 * peak) continue;
      let best = null, bd = TUNE.wasteRange; for (const l of C.thingsOf(s, 'latrine')) { if (l.d.covered || l.d.use >= TUNE.latrineCap) continue; const d = dist(l, a); if (d < bd) { bd = d; best = l; } }
      if (best) { best.d.use = (best.d.use || 0) + 1; }
      else { s.foul = Math.min(10, (s.foul || 0) + 0.12); a.p.needs.hope = clamp(a.p.needs.hope - 0.05, 0, 100); }
    }
    for (const l of C.thingsOf(s, 'latrine')) if (!l.d.covered && l.d.use >= TUNE.latrineCap && !l.d.told) { l.d.told = 1; say('A latrine is full. Cover it and dig another before the flies do it for you.', 'warn'); }
    // 2. fires: burn fuel; out when the wood is gone; daylight smoke is a security problem
    for (const f of C.thingsOf(s, 'fire')) if (f.d.lit) {
      if ((g.res.lena || 0) < TUNE.fuelPerHour) { f.d.lit = false; say('The fire dies — no firewood left.', 'warn'); continue; }
      g.res.lena -= TUNE.fuelPerHour; f.d.hours = (f.d.hours || 0) + 1;
      if (h >= 7 && h < 18) { g.regime.heat = Math.min(100, g.regime.heat + TUNE.smokeHeat); if (!f.d.smokeTold) { f.d.smokeTold = 1; say('Smoke over the canopy in daylight — the army will see it. Cook before dawn, or after dark.', 'warn'); } }
      else f.d.smokeTold = 0;
      if (f.d.hours >= 2) { f.d.lit = false; f.d.hours = 0; for (const a of ppl) a.p.needs.hope = clamp(a.p.needs.hope + 1.2, 0, 100); say('A hot meal finishes — the camp is easier for it.', 'good'); }
    }
    // 3. the night watch
    if (isNight(h)) {
      const posts = C.thingsOf(s, 'posta'); const sentries = ppl.filter((a) => a.onWatch);
      for (const a of sentries) if (a.p.needs.energy < 25 && Math.random() < TUNE.nap) { a.onWatch = false; a.order = null; C.say(a, 'Me estoy durmiendo… (nodding off)', '#7a1d1d', 3); say(`${C.tagName(a.p)} nodded off on watch.`, 'warn'); a.p.needs.energy = Math.min(100, a.p.needs.energy + 10); }
      s.nightCover = posts.length ? sentries.length / posts.length : 0;
      if (ppl.length > 3 && !sentries.length && Math.random() < 0.04 + g.regime.heat * 0.0015) { g.regime.heat = Math.min(100, g.regime.heat + 4); g.rep.discipline = clamp(g.rep.discipline - 2, 0, 100); say('A patrol came close in the dark and nobody was on watch. Luck, not discipline, kept you alive.', 'bad'); }
    } else s.nightCover = 0;
  }

  function daily(s, g) {
    const ppl = people(s), say = C.log, st = C.campStats(s);
    // sleeping: bedless people recover poorly; rain makes them sick
    const rain = (g.weather && g.weather.rain) || 0;
    ppl.forEach((a, i) => {
      if (i >= st.hammocks) { a.p.needs.energy = clamp(a.p.needs.energy - 6, 0, 100); a.p.needs.hope = clamp(a.p.needs.hope - 1.5, 0, 100); if (rain > 0.3 && Math.random() < 0.25 && !a.p.ill) a.p.ill = { k: 'fever', d: 0 }; }
    });
    if (st.bedsShort > 0 && ppl.length > 2) say(`${st.bedsShort} of your people slept on the ground. Hang more hammocks (stakes and sheeting from the tool rack).`, 'info');
    // dysentery: foul ground, or a latrine on the stream
    let risk = Math.min(0.5, (s.foul || 0) * TUNE.foulSick);
    for (const l of C.thingsOf(s, 'latrine')) if (!l.d.covered && waterNear(s, l.x, l.y, TUNE.waterSafe)) { risk += 0.08; if (!l.d.wtold) { l.d.wtold = 1; say('A latrine this close to the water will poison it. Move it.', 'warn'); } }
    if (risk > 0) for (const a of ppl) if (!a.p.ill && Math.random() < risk) { a.p.ill = { k: 'dysentery', d: 0 }; say(`${C.tagName(a.p)} has dysentery — bad ground or bad water.`, 'bad'); }
    s.foul = Math.max(0, (s.foul || 0) - 0.15);
    // illness runs its course; rest and medicine help
    for (const a of ppl) { const p = a.p; if (!p.ill) continue; p.ill.d++; p.hp = Math.max(8, p.hp - (p.ill.k === 'dysentery' ? 4 : 2)); p.needs.energy = clamp(p.needs.energy - 5, 0, 100); if (p.ill.d >= 4 && Math.random() < 0.5) { p.ill = null; say(`${C.tagName(p)} is recovering.`, 'good'); } }
    // spoilage: ground-stored food rots faster than rack-stored; rain triples the rack rate
    const lostSack = Math.floor(st.sacked * TUNE.spoilSack), lostRack = Math.floor(Math.min(g.res.food, st.rackCap) * TUNE.spoilRack * (rain > 0.3 ? 3 : 1));
    const lost = lostSack + lostRack; if (lost > 0) { g.res.food = Math.max(0, g.res.food - lost); say(`${lost} rations spoiled${lostSack ? ' (sacks on the ground)' : ''}. ${st.racks ? '' : 'A barbacoa would keep them off the ground.'}`, 'warn'); }
    // the colour: a lesson per board per day is the baseline; the verbs do the rest
  }

  // ------------------------------------------------------------------------------------------------------------------
  // VERBS: the physical things that make the above true. Placing consumes an item; picking up returns it.
  // ------------------------------------------------------------------------------------------------------------------
  const hrToSec = (h) => (h * 60) / (G().minPerSec || 1.5);
  const place = (a, tg, kind, d) => { const t = C.addThing(a.scene, kind, tg.x, tg.y, d); return t; };
  const free = (a, tg, r) => !C.nearestThing(a.scene, tg.x, tg.y, null, r || 14) && (!a.scene.isSolid || !a.scene.isSolid(tg.x, tg.y));

  C.registerVerb({ id: 'dig_latrine', n: 'Dig latrine', icon: '⛏', kinds: ['ground'], reach: 16, dur: 14,
    check: (a, tg) => (!has(a, 'hoe') && !has(a, 'axe') ? 'Needs a hoe to dig.' : !free(a, tg) ? 'Something is in the way.' : null),
    done: (a, tg) => { place(a, tg, 'latrine', { use: 0, covered: false }); C.log(`${C.tagName(a.p)} dug a latrine.`, 'info'); return null; } });
  C.registerVerb({ id: 'cover_latrine', n: 'Fill in and cover', icon: '🟫', kinds: ['thing:latrine'], reach: 16, dur: 8,
    check: (a, tg) => (tg.o.d.covered ? 'Already covered.' : !has(a, 'hoe') ? 'Needs a hoe.' : null),
    done: (a, tg) => { tg.o.d.covered = true; return null; } });
  C.registerVerb({ id: 'hang_hammock', n: 'Hang a hammock', icon: '🛏', kinds: ['ground'], reach: 14, dur: 6,
    check: (a, tg) => (!has(a, 'hammock') ? 'No hammock to hang.' : !has(a, 'stake', 2) ? 'Needs two stakes (or trees).' : !free(a, tg) ? 'Something is in the way.' : null),
    done: (a, tg) => { takeItem(a, 'hammock', 1); takeItem(a, 'stake', 2); place(a, tg, 'hammock', {}); return null; } });
  C.registerVerb({ id: 'build_rack', n: 'Build a barbacoa', icon: '🪵', kinds: ['ground'], reach: 14, dur: 16,
    check: (a, tg) => (!has(a, 'axe') ? 'Needs an axe.' : (G().res.lena || 0) < 4 ? 'Needs 4 firewood-sized poles.' : !free(a, tg) ? 'Something is in the way.' : null),
    done: (a, tg) => { G().res.lena -= 4; place(a, tg, 'barbacoa', { fill: 0 }); return null; } });
  C.registerVerb({ id: 'make_fire', n: 'Ring a fire pit', icon: '🪨', kinds: ['ground'], reach: 14, dur: 6,
    check: (a, tg) => (!free(a, tg) ? 'Something is in the way.' : null), done: (a, tg) => { place(a, tg, 'fire', { lit: false }); return null; } });
  C.registerVerb({ id: 'light_fire', n: 'Light the fire', icon: '🔥', kinds: ['thing:fire'], reach: 14, dur: 4,
    check: (a, tg) => (tg.o.d.lit ? 'Already lit.' : (G().res.lena || 0) < 2 ? 'No firewood to burn.' : null),
    done: (a, tg) => { tg.o.d.lit = true; tg.o.d.hours = 0; return null; } });
  C.registerVerb({ id: 'post_sentry', n: 'Set a sentry post', icon: '🚩', kinds: ['ground'], reach: 14, dur: 6,
    check: (a, tg) => (!has(a, 'stake', 2) ? 'Needs two stakes.' : !free(a, tg) ? 'Something is in the way.' : null),
    done: (a, tg) => { takeItem(a, 'stake', 2); place(a, tg, 'posta', {}); return null; } });
  C.registerVerb({ id: 'stand_watch', n: 'Stand watch (4 h)', icon: '👁', kinds: ['thing:posta'], reach: 10, dur: () => hrToSec(4),
    check: (a) => (a.p.needs.energy < 12 ? 'Too exhausted to keep awake.' : null),
    start: (a) => { a.onWatch = true; a.watching = true; }, done: (a) => { a.onWatch = false; a.watching = false; C.say(a, 'Relevo… (relief, please)', '#222', 2.5); return null; } });
  C.registerVerb({ id: 'raise_board', n: 'Raise a blackboard', icon: '🪧', kinds: ['ground'], reach: 14, dur: 10,
    check: (a, tg) => (!has(a, 'axe') ? 'Needs an axe.' : !free(a, tg) ? 'Something is in the way.' : null), done: (a, tg) => { place(a, tg, 'pizarra', {}); return null; } });
  C.registerVerb({ id: 'teach', n: 'Teach a lesson', icon: '📖', kinds: ['thing:pizarra'], reach: 30, dur: 14,
    check: (a) => (has(a, 'primer') ? null : 'Needs a primer (cartilla).'),
    done: (a, tg) => {
      const s = a.scene; let n = 0, learned = 0;
      for (const q of people(s)) { if (q === a || q.p.literate || dist(q, tg) > 70 || q.sleeping) continue; n++; const p = q.p; p.lit = (p.lit || 0) + TUNE.lessonGain; p.needs.hope = clamp(p.needs.hope + 2, 0, 100); C.bondEvent && C.bondEvent(a.p, p, 'taught'); if (p.lit >= 100) { p.literate = true; learned++; C.log(`${C.tagName(p)} read a whole page aloud for the first time.`, 'good'); } }
      if (C.onLesson) C.onLesson(a, tg, n);                    // ideology.js: what the lesson taught
      C.log(n ? `${C.tagName(a.p)} taught ${n} to read${learned ? ` (${learned} now can)` : ''}.` : 'Nobody came to the lesson.', n ? 'good' : 'info'); return n ? null : 'Nobody came to the lesson.'; } });
  C.registerVerb({ id: 'pack_up', n: 'Pack it up', icon: '📦', kinds: ['thing:hammock', 'thing:posta', 'thing:stake', 'thing:pizarra'], reach: 14, dur: 4,
    done: (a, tg) => { const back = { hammock: ['hammock', 1, 'stake', 2], posta: ['stake', 2], stake: ['stake', 1], pizarra: [] }[tg.tk] || []; for (let i = 0; i < back.length; i += 2) C.invAdd(a.p, back[i], back[i + 1]); C.removeThing(a.scene, tg.o); return null; } });

  // ------------------------------------------------------------------------------------------------------------------
  // PRESET ACTIONS: ready-made macros (copy them, edit them, schedule them). They are the camp's chores.
  // Targets are 'nearest', so they work wherever the person is standing; failures stop with a spoken reason.
  // ------------------------------------------------------------------------------------------------------------------
  const T = (tk) => ({ kind: 'thing', tk, mode: 'nearest' });
  C.PRESETS.push(
    { id: 'p_feedpigs', name: 'Feed the pigs', home: true, repeat: 1, steps: [
      { t: 'verb', v: 'take', param: { item: 'feed', n: 2 }, tgt: T('barbacoa') }, { t: 'verb', v: 'feed', tgt: { kind: 'animal', ak: 'pig', mode: 'nearest' } }] },
    { id: 'p_waterpigs', name: 'Water the pigs', home: true, repeat: 1, steps: [
      { t: 'verb', v: 'take', param: { item: 'bucket', n: 1 }, tgt: T('toolrack') }, { t: 'verb', v: 'fill', tgt: { kind: 'water', mode: 'nearest' } },
      { t: 'verb', v: 'give_water', tgt: { kind: 'animal', ak: 'pig', mode: 'nearest' } }, { t: 'verb', v: 'put', param: { item: 'bucket' }, tgt: T('toolrack') }] },
    { id: 'p_wood', name: 'Firewood run', home: true, repeat: 2, steps: [
      { t: 'verb', v: 'take', param: { item: 'axe', n: 1 }, tgt: T('toolrack') }, { t: 'verb', v: 'chop', tgt: { kind: 'tree', mode: 'nearest' } },
      { t: 'verb', v: 'put', param: { item: 'lena' }, tgt: T('woodpile') }, { t: 'verb', v: 'put', param: { item: 'axe' }, tgt: T('toolrack') }] },
    { id: 'p_cook', name: 'Light the cooking fire', home: true, repeat: 1, steps: [{ t: 'verb', v: 'light_fire', tgt: T('fire') }] },
    { id: 'p_watch', name: 'Night watch', home: false, repeat: 1, steps: [{ t: 'say', text: '¿Quién vive?' }, { t: 'verb', v: 'stand_watch', tgt: T('posta') }] },
    { id: 'p_lesson', name: 'Literacy lesson', home: true, repeat: 1, steps: [
      { t: 'verb', v: 'take', param: { item: 'primer', n: 1 }, tgt: T('toolrack') }, { t: 'verb', v: 'teach', tgt: T('pizarra') }] }
  );
})();
