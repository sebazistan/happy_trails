/* CUBEA — climate.js : TEMPERATURE, WEATHER'S EFFECT ON BODIES AND MINDS, AND THE WORDS THAT SHOW IT.

   THE CLIMATE (C.climate / g.clim, refreshed every couple of seconds)
   Oriente's monthly highs and lows (Cuban normals, ≈ 27/19 °C in January to 33/23 °C in July–August), a daily curve peaking mid-afternoon,
   cooler up in the Sierra (−4 °C at the camp, more on the peaks), cooled by rain and fog, and two kinds of spells: the winter NORTE
   (a cold front, December–March, −5 to −9 °C for a day or three, wind and rain) and the summer HEAT WAVE (+3 to +4 °C for days).
   "Feels like" adds the humid-heat index in summer and wind-chill and wetness in winter. By CUBAN standards: ≥ 33 °C feels very hot,
   ≥ 36 °C is dangerous work; ≤ 17 °C is cold, ≤ 13 °C is bitter for people who own no coat.

   THE BODY AND MIND (p.body, p.mind — every person, both sides)
     body:  heat (heat strain 0-100)  chill (cold strain)  wet (soaked-ness)  feet (foot health)  sleepDebt (hours awake beyond rest)
            hygiene (cleanliness)
     mind:  happiness  boredom  grief  trauma
   (the older needs/stress/morale/anger/fear/hp/health stay where they were; see docs/VARIABLES.md for all of them)
   Heat: rises with temperature, exertion, load, sun, thirst; falls in shade, indoors, at rest and with water. At the top it is heatstroke:
         collapse, hit points lost. Cold: rises with low temperature, wind, wetness, hunger and sleeping on the ground; falls by a fire,
         indoors, in a hammock with cover. Wet: rain soaks; sun, fire and roofs dry. Wet feet rot (trench foot): speed and mobility fall.
   EFFECTS (both sides, same rules): accuracy, reload time, speed, alertness of sentries, thirst and food burn, energy drain, mood and
         stress, illness (fever, heatstroke), the camp's firewood burn, vehicles (engine heat, battery in cold, fuel burn), and
         the army's morale on extreme days.

   STATUS WORDS: C.statesOf(a) lists a person's states with severity; a small word bubble ("hungry", "freezing", "happy"…) pops up over
   YOUR people for 5 s once every minute or two — only for strong values — and the whole picture is on mouse rollover.
   TUNE: numbers in the TUNE block.
*/
(function () {
  'use strict';
  const C = window.C, G = () => C.G, clamp = C.clamp, TL = C.TILE;
  const rnd = Math.random;

  // TUNE ---------------------------------------------------------------------------------------------------------------
  const TUNE = {
    hi: [27, 28, 29, 30, 31, 32, 33, 33, 32, 31, 29, 27], lo: [19, 19, 20, 21, 22, 23, 23, 23, 23, 22, 21, 20],     // monthly normals (°C), Jan..Dec
    alt: { sierra: -4 }, norteChance: 0.12, norteDrop: [5, 9], heatWaveChance: 0.06, heatWaveAdd: [3, 4],
    veryHot: 33, dangerHot: 36, cold: 17, bitter: 13,
    heatRate: 0.05, heatRecover: 0.45, chillRate: 0.07, chillRecover: 0.6, wetRate: 1.5, dryRate: 0.4,
    heatstroke: 92, collapseSecs: 45,
    drain: { water: 1 / 60, food: 1 / 80, energyHeat: 1 / 80, energyCold: 1 / 120 },
    bubbleEvery: [45, 120], bubbleSecs: 5,                        // real seconds
    strong: { hungry: 20, thirsty: 20, tired: 18, sleepDebt: 20, heat: 70, chill: 65, wet: 85, feet: 25, hygiene: 15, happy: 85, miserable: 15, angry: 70, afraid: 75, stressed: 80, hurt: 0.35, bored: 80, grief: 60, trauma: 60, despair: 12, hope: 92 },
  };
  C.CLIMATE_TUNE = TUNE;

  // ------------------------------------------------------------------------------------------------------------------
  // THE CLIMATE
  // ------------------------------------------------------------------------------------------------------------------
  function compute(g, s) {
    const m = C.dateOf(g.day).getUTCMonth(), hr = g.hour, hi = TUNE.hi[m], lo = TUNE.lo[m];
    const mean = (hi + lo) / 2, amp = (hi - lo) / 2; let t = mean + amp * Math.sin((hr - 8.5) / 24 * Math.PI * 2);
    t += (TUNE.alt[s.sid] || (s.sid === 'habana' ? -0.5 : 0));
    const f = g.front && g.front.until > g.min ? g.front : null, hw = g.heatwave && g.heatwave.until > g.min ? g.heatwave : null;
    if (f) t -= f.drop * (0.75 + 0.25 * Math.sin(hr / 24 * 6.28)); if (hw) t += hw.add;
    const rain = g.weather.rain, fog = g.weather.fog || 0; t -= rain * 3 + fog * 1.5;
    const humid = clamp(0.55 + rain * 0.3 + (s.type === 'fishing' || s.type === 'coast' ? 0.08 : 0) - (hr > 11 && hr < 17 ? 0.1 : 0), 0.3, 1);
    const wind = clamp(0.18 + (f ? 0.6 : 0) + rain * 0.25 + (s.sid === 'bay' ? 0.2 : 0), 0, 1.2);
    let feels = t; if (t > 26) feels += (humid - 0.4) * 9 * (t - 26) / 7; if (t < 21) feels -= wind * 3.2 * (21 - t) / 6;
    return { temp: t, feels, humid, wind, front: !!f, heatwave: !!hw, month: m, indoor: clamp(24 + (t - 24) * 0.45, 16, 31) };
  }
  C.climate = () => { const g = G(); return g && g.scene ? (g.clim = compute(g, g.scene)) : null; };
  let accT = 0;
  C.climateTick = function (s, dt) { accT -= dt; if (accT > 0) return; accT = 2; const g = G(); g.clim = compute(g, s); };
  /** Once a day: fronts and heat waves arrive and are announced. */
  C.climateDaily = function () {
    const g = G(), m = C.dateOf(g.day).getUTCMonth();
    if (!(g.front && g.front.until > g.min) && (m === 11 || m <= 2) && rnd() < TUNE.norteChance) { const dur = 1 + Math.floor(rnd() * 3); g.front = { until: g.min + dur * 1440, drop: TUNE.norteDrop[0] + rnd() * (TUNE.norteDrop[1] - TUNE.norteDrop[0]) }; g.weather.target = Math.max(g.weather.target, 0.5); g.weather.t = 1.2; C.log(`A norte blows in: a cold front for about ${dur} day${dur > 1 ? 's' : ''}. Wind, rain, and cold nights — hammocks and fires matter.`, 'warn'); }
    if (!(g.heatwave && g.heatwave.until > g.min) && m >= 5 && m <= 7 && rnd() < TUNE.heatWaveChance) { const dur = 3 + Math.floor(rnd() * 4); g.heatwave = { until: g.min + dur * 1440, add: TUNE.heatWaveAdd[0] + rnd() * (TUNE.heatWaveAdd[1] - TUNE.heatWaveAdd[0]) }; C.log(`A heat wave: ${dur} days of savage heat. Water, shade and rest at midday.`, 'warn'); }
    const c = G().clim; if (c) { if (c.feels > TUNE.dangerHot + 1) { g.regime.armyMorale = clamp(g.regime.armyMorale - 0.4, 0, 100); } if (c.feels < TUNE.bitter) { g.regime.armyMorale = clamp(g.regime.armyMorale - 0.4, 0, 100); } }
    for (const id of (g.squads || []).flatMap((q) => q.members)) { const p = C.P(id); if (!p || p.status !== 'alive' || !p.body) continue; const b = p.body; if (b.chill > 55 && b.wet > 35 && !p.ill && rnd() < 0.2) { p.ill = { k: 'fever', d: 0 }; C.log(`${C.tagName(p)} has a fever after the cold and wet.`, 'bad'); } if (b.hygiene < 20 && !p.ill && rnd() < 0.05) { p.ill = { k: 'dysentery', d: 0 }; } }
  };

  // ------------------------------------------------------------------------------------------------------------------
  // THE BODY AND MIND
  // ------------------------------------------------------------------------------------------------------------------
  const initBody = (p) => { if (!p.body) p.body = { heat: 10, chill: 0, wet: 0, feet: 90, sleepDebt: 2, hygiene: 70 }; if (!p.mind) p.mind = { happiness: 55, boredom: 10, grief: 0, trauma: 0 }; return p.body; };
  C.initBody = initBody;
  const nearFire = (s, a) => (s.things || []).some((t) => t.k === 'fire' && t.d.lit && Math.hypot(t.x - a.x, t.y - a.y) < 46);
  const hammockNear = (s, a) => (s.things || []).some((t) => t.k === 'hammock' && Math.hypot(t.x - a.x, t.y - a.y) < 22);
  /** One frame for one person (called from ai.js commonUpdate; gm = game minutes elapsed). */
  C.bodyTick = function (s, a, dt, gm) {
    const p = a.p, g = G(), cl = g.clim; if (!cl || a.dead) return; const b = initBody(p), mi = p.mind, n = p.needs;
    const sheltered = a.inside || (a.inVeh && a.inVeh.def.cap > 4 && a.inVeh.def.tank), tile = C.tileAt(s, a.x, a.y), shade = sheltered || tile === TL.FOR || a.hide;
    const sun = !shade && g.hour > 8 && g.hour < 17 && g.weather.rain < 0.3, fire = nearFire(s, a);
    const exert = (a.running ? 2.2 : a.moving ? 1.35 : a.working ? 1.25 : a.shooting > 0 ? 1.8 : a.sleeping ? 0.3 : 0.6) * (1 + (1 - clamp(a.loadK || 1, 0.3, 1)) * 1.2);
    const feels = sheltered ? cl.indoor : cl.feels + (sun ? 2.5 : 0) - (shade ? 1.2 : 0) + (fire ? 6 : 0);
    // heat strain
    if (feels > 30) b.heat += (feels - 30) * TUNE.heatRate * exert * (n.water < 35 ? 1.6 : 1) * gm; else b.heat -= TUNE.heatRecover * (shade ? 1.4 : 1) * (n.water > 50 ? 1 : 0.6) * gm * (a.moving ? 0.6 : 1);
    if (!sheltered && feels <= 30 && b.heat > 0) b.heat -= 0.2 * gm;
    // cold strain
    if (feels < TUNE.cold) b.chill += (TUNE.cold - feels) * TUNE.chillRate * (b.wet > 40 ? 1.7 : 1) * (n.food < 30 ? 1.3 : 1) * (a.sleeping && !(hammockNear(s, a) || a.inside) ? 1.25 : 1) * (a.moving ? 0.55 : 1) * gm; else b.chill -= TUNE.chillRecover * gm;
    if (fire) b.chill -= 1.2 * gm; if (a.inside) b.chill -= 0.5 * gm;
    // wetness, feet
    if (!sheltered && g.weather.rain > 0.3) b.wet += g.weather.rain * TUNE.wetRate * gm * (a.hide ? 0.8 : 1); else b.wet -= TUNE.dryRate * (sun ? 2 : 1) * (fire ? 3 : 1) * (a.inside ? 2 : 1) * gm;
    if (tile === TL.SHAL) b.wet = Math.min(100, b.wet + 4 * gm);
    if (b.wet > 60 && a.moving) b.feet -= 0.05 * exert * gm; else if (b.wet < 30 && !a.moving) b.feet += 0.03 * gm;
    // sleep, hygiene
    if (a.sleeping || a.inside && g.hour > 22) b.sleepDebt -= gm / 30; else b.sleepDebt += gm / 60;
    b.hygiene -= (0.04 + (b.heat > 40 ? 0.04 : 0)) * gm; if (tile === TL.SHAL) b.hygiene += 1.5 * gm;
    for (const k of ['heat', 'chill', 'wet']) b[k] = clamp(b[k], 0, 100); b.feet = clamp(b.feet, 0, 100); b.sleepDebt = clamp(b.sleepDebt, 0, 48); b.hygiene = clamp(b.hygiene, 0, 100);
    // costs to the old needs: thirst, food burn, energy
    const act = a.moving ? 1.25 : 0.75;
    n.water = Math.max(0, n.water - 0.07 * gm * act * (b.heat / 100 * TUNE.drain.water * 60));
    n.food = Math.max(0, n.food - 0.024 * gm * act * (b.chill / 100 * TUNE.drain.food * 80 + (feels > 33 ? 0.1 : 0)));
    if (!a.sleeping && !a.inside) n.energy = Math.max(0, n.energy - 0.06 * gm * act * (b.heat / 100 * TUNE.drain.energyHeat * 80 + b.chill / 100 * TUNE.drain.energyCold * 120 + b.sleepDebt / 48));
    // mind
    const hunger = (100 - n.food) / 100, target = 50 + (n.hope - 50) * 0.3 + (p.morale - 50) * 0.3 - b.heat * 0.25 - b.chill * 0.3 - Math.max(0, b.wet - 40) * 0.1 - hunger * 15 - p.stress * 0.15 - mi.grief * 0.2 - mi.trauma * 0.15 - b.sleepDebt * 0.4 - (100 - b.hygiene) * 0.08;
    mi.happiness += (clamp(target, 0, 100) - mi.happiness) * Math.min(1, 0.02 * gm);
    if (!a.moving && !a.working && !a.sleeping && !a.inside && !(g.combatT > 0)) mi.boredom += 0.12 * gm; else mi.boredom -= 0.4 * gm; mi.boredom = clamp(mi.boredom, 0, 100);
    mi.grief = Math.max(0, mi.grief - 0.01 * gm); if (a.suppressed > 0 || a.lastHit > g.time - 3) mi.trauma = Math.min(100, mi.trauma + 0.8 * dt); mi.trauma = Math.max(0, mi.trauma - 0.003 * gm);
    p.stress = clamp(p.stress + (b.heat > 60 ? (b.heat - 60) / 400 : 0) * gm + (b.chill > 50 ? (b.chill - 50) / 400 : 0) * gm + b.sleepDebt / 4000 * gm, 0, 100);
    // consequences
    if (b.heat >= TUNE.heatstroke && !a.collapsed) { a.collapsed = g.time + TUNE.collapseSecs; a.order = null; a.path = null; C.say(a, '…', '#7a1d1d', 3); p.hp = Math.max(5, p.hp - 8); p.ill = p.ill || { k: 'heatstroke', d: 0 }; if (a.side === 'rebel' || a.isPlayer) C.log(`${C.tagName(p)} collapsed from the heat.`, 'bad'); }
    if (a.collapsed) { if (g.time > a.collapsed) { a.collapsed = 0; b.heat = 55; } else { a.moving = false; a.prone = true; if (a.side !== 'rebel' || true) a.cd = Math.max(a.cd, 0.5); b.heat -= 1.2 * gm; } }
    if (b.feet < 30) p.limp = Math.max(p.limp || 0, 0.3);
    statusTick(s, a, dt);
  };

  // ------------------------------------------------------------------------------------------------------------------
  // EFFECTS ON FIGHTING AND MOVING (used by combat.js, ai.js, garage.js)
  // ------------------------------------------------------------------------------------------------------------------
  /** Multiplier on aiming skill: heat, shivering, cold hands, wet, fatigue, trauma. 1 = unaffected. */
  C.accMod = function (a) { const p = a.p, b = p.body; if (!b) return 1; let k = 1; k -= Math.max(0, b.heat - 40) / 100 * 0.35; k -= Math.max(0, b.chill - 30) / 100 * 0.45; k -= Math.max(0, b.wet - 60) / 100 * 0.08; k -= b.sleepDebt / 48 * 0.3; k -= (p.mind.trauma / 100) * 0.2; if (a.collapsed) k = 0.05; return clamp(k, 0.3, 1); };
  /** Multiplier on spread from weather: rain, fog, wind. */
  C.spreadMod = function (a) { const g = G(); let k = 1 + g.weather.rain * 0.18 + (g.weather.fog || 0) * 0.1; if (g.clim) k += g.clim.wind * 0.12; return k; };
  /** Multiplier on reload time: numb fingers, shaking hands, wet cartridges. */
  C.reloadMod = function (a) { const b = a.p.body; if (!b) return 1; return 1 + Math.max(0, b.chill - 30) / 100 * 0.7 + Math.max(0, b.heat - 60) / 100 * 0.3 + Math.max(0, b.wet - 70) / 100 * 0.15; };
  /** Multiplier on walking speed. */
  C.speedMod = function (a) { const b = a.p.body; if (!b) return 1; let k = 1 - Math.max(0, b.heat - 50) / 100 * 0.5 - Math.max(0, b.chill - 50) / 100 * 0.3 - Math.max(0, 40 - b.feet) / 100 * 0.6; if (a.collapsed) k = 0; return clamp(k, 0.15, 1); };
  /** Multiplier on how far a sentry sees/hears: sleepy, cold, overheated, grieving people are less alert. */
  C.alertMod = function (a) { const b = a.p.body; if (!b) return 1; return clamp(1 - b.sleepDebt / 48 * 0.4 - Math.max(0, b.chill - 40) / 100 * 0.2 - Math.max(0, b.heat - 60) / 100 * 0.2, 0.5, 1); };
  /** Vehicle fuel/heat/battery factors from the weather. */
  C.fuelMod = function () { const c = G().clim; if (!c) return 1; return 1 + (c.temp < 16 ? (16 - c.temp) * 0.012 : 0) + (c.temp > 34 ? (c.temp - 34) * 0.01 : 0) + G().weather.rain * 0.08; };
  C.engineAmbient = function () { const c = G().clim; return c ? 1 + (c.temp - 30) * 0.035 : 1; };

  // ------------------------------------------------------------------------------------------------------------------
  // STATES AND STATUS WORDS
  // ------------------------------------------------------------------------------------------------------------------
  /** All of a person's states as {key,word,sev(0-1),val,good}: sev is how far past "strong" it is. */
  C.statesOf = function (a) {
    const p = a.p, n = p.needs, b = initBody(p), m = p.mind, S = TUNE.strong, out = []; const add = (key, word, val, sev, good) => { if (sev > 0) out.push({ key, word, val: Math.round(val), sev: clamp(sev, 0, 1), good: !!good }); };
    const low = (v, th) => (v < th ? (th - v) / th : 0), high = (v, th) => (v > th ? (v - th) / (100 - th) : 0);
    add('food', 'hungry', n.food, low(n.food, S.hungry) * 1.2); add('water', 'thirsty', n.water, low(n.water, S.thirsty) * 1.3); add('energy', 'tired', n.energy, low(n.energy, S.tired) * 1.1);
    add('sleep', 'sleepy', b.sleepDebt, high(b.sleepDebt / 48 * 100, S.sleepDebt / 48 * 100)); add('heat', 'overheated', b.heat, high(b.heat, S.heat)); add('chill', 'freezing', b.chill, high(b.chill, S.chill)); add('wet', 'soaked', b.wet, high(b.wet, S.wet) * 0.8); add('feet', 'sore feet', b.feet, low(b.feet, S.feet));
    add('hygiene', 'filthy', b.hygiene, low(b.hygiene, S.hygiene) * 0.7); add('happy', 'happy', m.happiness, high(m.happiness, S.happy), true); add('miserable', 'miserable', m.happiness, low(m.happiness, S.miserable) * 1.1);
    add('anger', 'angry', p.anger, high(p.anger, S.angry)); add('fear', 'afraid', p.fear, high(p.fear, S.afraid)); add('stress', 'stressed', p.stress, high(p.stress, S.stressed)); add('bored', 'bored', m.boredom, high(m.boredom, S.bored) * 0.7);
    add('grief', 'grieving', m.grief, high(m.grief, S.grief)); add('trauma', 'shaken', m.trauma, high(m.trauma, S.trauma)); add('hope', 'hopeless', n.hope, low(n.hope, S.despair)); add('hopeful', 'hopeful', n.hope, high(n.hope, S.hope), true);
    const hpf = p.maxHp ? p.hp / p.maxHp : 1; add('hurt', 'in pain', hpf * 100, hpf < S.hurt ? (S.hurt - hpf) / S.hurt : (a.pain > 0.7 ? 0.5 : 0)); if (p.bleed > 0.2) add('bleed', 'bleeding', p.bleed * 10, 0.6); if (p.ill) add('ill', p.ill.k === 'dysentery' ? 'sick (dysentery)' : p.ill.k === 'heatstroke' ? 'heatstruck' : 'feverish', 50, 0.7);
    if (a.side === 'rebel' && p.trueStance < -8) add('doubt', 'doubting', p.trueStance, 0.5);
    return out.sort((x, y) => y.sev - x.sev);
  };
  let nextBub = new WeakMap();
  function statusTick(s, a, dt) {
    if (!(a.side === 'rebel' || a.isPlayer) || a.squad < 0 && !a.isPlayer) return; if (a.inside) return;
    if (a.sbub) { a.sbub.t -= dt; if (a.sbub.t <= 0) a.sbub = null; return; }
    let t = nextBub.get(a); if (t === undefined) { t = performance.now() + 5000 + rnd() * 40000; nextBub.set(a, t); } if (performance.now() < t) return;
    nextBub.set(a, performance.now() + (TUNE.bubbleEvery[0] + rnd() * (TUNE.bubbleEvery[1] - TUNE.bubbleEvery[0])) * 1000);
    C.popStatus(a);
  }
  /** Show the strongest state as a small word bubble for a few seconds (nothing if nothing is strong). */
  C.popStatus = function (a) { const st = C.statesOf(a).filter((x) => x.sev > 0.05); if (!st.length) return null; const top = st[0]; a.sbub = { text: top.word, key: top.key, t: TUNE.bubbleSecs, good: top.good }; return top.word; };
  const COL = { food: '#d98a2b', water: '#3a8fd6', energy: '#7a6ad0', sleep: '#7a6ad0', heat: '#e0592a', chill: '#4aa6d8', wet: '#4a8fb0', feet: '#8a6a40', hygiene: '#8a8a60', happy: '#2f9b4a', miserable: '#6a5a8a', anger: '#cc3a2a', fear: '#a04ac0', stress: '#c07a2a', bored: '#8a8a8a', grief: '#5a5a7a', trauma: '#a04ac0', hope: '#6a5a8a', hopeful: '#2f9b4a', hurt: '#cc3a2a', bleed: '#cc3a2a', ill: '#7a9a2a', doubt: '#8a6a3a' };
  C.statusColor = (k) => COL[k] || '#666';
  /** Wrap a mourning event so the survivor grieves. */
  const be = C.bondEvent; C.bondEvent = function (a, b, kind, mult) { if (kind === 'mourned' && a) { initBody(a); a.mind.grief = Math.min(100, a.mind.grief + 22); } return be.apply(this, arguments); };
  // Tooltip addition for aware.js: states as words, and for your own people the whole panel of numbers.
  C.tipExtra = function (s, a) {
    const p = a.p, b = initBody(p), m = p.mind, st = C.statesOf(a); let h = '';
    if (st.length) h += `<br><i>States:</i> ${st.slice(0, 6).map((x) => `<span style="color:${COL[x.key] || '#ccc'}">${x.word}</span>`).join(', ')}`;
    if (a.side === 'rebel' || a.isPlayer) {
      const n = p.needs, r = (v) => Math.round(v);
      h += `<br><i>Food</i> ${r(n.food)} · <i>Water</i> ${r(n.water)} · <i>Energy</i> ${r(n.energy)} · <i>Hope</i> ${r(n.hope)}`;
      h += `<br><i>Morale</i> ${r(p.morale)} · <i>Stress</i> ${r(p.stress)} · <i>Fear</i> ${r(p.fear)} · <i>Anger</i> ${r(p.anger)}`;
      h += `<br><i>Heat</i> ${r(b.heat)} · <i>Chill</i> ${r(b.chill)} · <i>Wet</i> ${r(b.wet)} · <i>Feet</i> ${r(b.feet)}`;
      h += `<br><i>Happiness</i> ${r(m.happiness)} · <i>Boredom</i> ${r(m.boredom)} · <i>Grief</i> ${r(m.grief)} · <i>Trauma</i> ${r(m.trauma)}`;
      h += `<br><i>Awake</i> ${r(b.sleepDebt)} h over · <i>Clean</i> ${r(b.hygiene)} · <i>HP</i> ${r(p.hp)}/${r(p.maxHp)} · <i>XP</i> ${r(p.exp)}`;
      if (a.weapon) h += `<br><i>Weapon</i> ${C.WEAPONS[a.weapon.k].n} (${a.weapon.mag}+${a.weapon.spare === undefined ? '∞' : a.weapon.spare})`;
      h += `<br><i>Accuracy</i> ×${C.accMod(a).toFixed(2)} · <i>Speed</i> ×${C.speedMod(a).toFixed(2)}`;
    }
    return h;
  };
})();
