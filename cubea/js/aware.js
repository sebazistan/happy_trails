/* CUBEA — aware.js : SITUATIONAL AWARENESS FOR CIVILIANS — eyes, ears, judgement, and a large repertoire of reactions.

   WHAT A CIVILIAN DOES NOW (civUpdate calls C.civAware first; if a reaction is running it owns the body)
   1. SEES    a vision cone (≈150° ahead, range shrinking with dusk, rain and fog; a short 360° bubble for what is almost at
              their elbow), blocked by walls and trees (C.losOpacity). Heading comes from movement; idle people glance about.
   2. HEARS   C.hearSound(scene, x, y, loudness, kind): shots, explosions, shouts, engines. Radius depends on loudness, age
              and whether they are indoors; a heard-but-unseen sound turns their head and may start a reaction.
   3. JUDGES  what they saw (C.readSubject):
              · an ARMED guerrilla in the COUNTRY is notable, not terrifying — peasants watch, greet, hide the children, bring
                water or warn you, according to their loyalty and what they have heard of the rebels' conduct (g.rep.fear);
              · an ARMED guerrilla in a TOWN provokes alarm in many (flee, bar the door, call the police);
              · a guerrilla in street clothes with a hidden pistol BLENDS (not seen as armed) unless they act oddly (hide, run,
                draw) or are RECOGNISED (famous faces, bearded men, men who have been seen before);
              · soldiers and police draw their own responses: the cautious avoid them, the sympathetic steer clear and warn rebels.
   4. DECIDES from ≈25 REACTIONS, weighted by fear, bravery, age, sex, loyalty, trade, religion and recent history:
              ignore · glance · stare · freeze · flee · run home and bar the door · shutter the shop · hide · shout a warning ·
              walk to the police · use a telephone · approach out of curiosity · greet · wave · bring water/food · tip off the
              rebels about soldiers · offer a safe house · follow (children) · admire / flirt (young women) · show off or ask to
              join (young men) · scold (old women) · cross themselves (the devout) · gather and gawk · call children in ·
              inform on you (informers).
   5. LIVES   eats breakfast, lunch and supper (at home, or in a café for those who can), takes a siesta in the heat, sleeps at
              night; hunger sends people to eat. Doors can be BARRED from inside (b.lockUntil): neighbours cannot enter and
              neither can you, without knocking.
   6. TOOLTIP hover any person (or vehicle) to see who they are, what they do, where they work and live, what they are doing
              and how they feel.

   PUBLIC API
     C.civAware(s, a, dt)             called from ai.js civUpdate; returns true when a reaction owns this frame
     C.hearSound(s, x, y, loud, kind) called from ai.js alertScene (and vehicles, explosions)
     C.readSubject(obs, subj, s)      → {kind, sev, why}
     C.lockedFor(b, actor)            true if the building is barred against that actor
     C.workplaceOf(s, a)              the building (or text) where this person works
   TUNE: all numbers in the TUNE block.
*/
(function () {
  'use strict';
  const C = window.C, G = () => C.G, clamp = C.clamp, TL = C.TILE, T = C.T;
  const A = () => C.ai;
  const urbanScene = (s) => s.type === 'town' || s.type === 'city' || s.type === 'capital';

  // TUNE ---------------------------------------------------------------------------------------------------------------
  const TUNE = {
    fov: 2.6,               // radians of the forward cone (≈150°)
    sight: 230,             // px base sight range for a civilian by day
    elbow: 30,              // px: everyone within this is noticed regardless of cone
    tick: 0.35,             // seconds between perception passes per person
    hearBase: 240,          // px for a shot; scaled by loudness
    lockMin: 25,            // game minutes a door stays barred
    recognise: 0.07,        // per pass, scaled by fame, within 90 px and in view
    wary: 12,               // game minutes a person stays jumpy after an incident
    phoneDelay: 7,          // seconds to place a call once at a telephone
    meals: [[6.5, 7.8, 'desayuno'], [12, 13.8, 'almuerzo'], [19, 20.6, 'cena']],
  };
  C.AWARE_TUNE = TUNE;
  const rnd = Math.random;

  // ------------------------------------------------------------------------------------------------------------------
  // HELPERS
  // ------------------------------------------------------------------------------------------------------------------
  const ageOf = (p) => C.ageOf(p);
  const has = (p, t) => p.traits && p.traits.includes(t);
  const homeOf = (s, p) => { const h = C.W.houses[p.hh]; return h && h.bld >= 0 ? s.blds[h.bld] : null; };
  const doorOf = (s, b) => s.doorPx(b);
  const nearestB = (s, a, pred) => { let best = null, bd = 1e9; for (const b of s.blds) { if (!b.door || b.open || !pred(b)) continue; const d = doorOf(s, b); const q = Math.hypot(d.x - a.x, d.y - a.y); if (q < bd) { bd = q; best = b; } } return best; };
  const POLICE = (b) => b.tag === 'army' && b.key !== 'sim' ? true : b.tag === 'army';
  const PHONE = (b) => ['shop', 'gov', 'bank', 'hotel', 'casino', 'clinic', 'radio', 'fuel', 'army'].includes(b.tag) || b.key === 'casona';
  const say = (a, t, col, d) => C.say(a, t, col || '#222', d || 2.8);
  const heading = (a, x, y) => { a.hd = Math.atan2(y - a.y, x - a.x); a.face = Math.cos(a.hd) >= 0 ? 1 : -1; };

  C.lockedFor = function (b, actor) { if (!b || !(b.lockUntil > G().min)) return false; if (actor && actor.p && !actor.isPlayer && b.lockOwner === actor.p.hh) return false; return true; };
  const lockDoor = (s, a, b) => { b.lockUntil = G().min + TUNE.lockMin + rnd() * 20; b.lockOwner = a.p.hh; };

  /** Where does this person work? A building, or a descriptive place for outdoor trades. */
  const WORKTAGS = { bodeguero: ['shop'], dependiente: ['shop'], comerciante: ['shop'], costurera: ['shop'], barbero: ['shop'], sastre: ['shop'], maestro: ['school', 'univ'], estudiante: ['univ', 'school'], sacerdote: ['church'], monja: ['church'], medico: ['clinic'], partera: ['clinic'], obrerocentral: ['factory'], obrerofab: ['factory'], ferroviario: ['factory'], funcionario: ['gov', 'bank'], abogado: ['gov', 'bank'], banquero: ['bank'], sindicalista: ['union'], periodista: ['radio'], locutor: ['radio'], casino: ['casino', 'hotel'], camarero: ['casino', 'hotel', 'leisure'], musico: ['casino', 'hotel', 'leisure'], chofer: ['fuel', 'store'], mecanico: ['fuel', 'store'], estibador: ['store'] };
  const OUTDOOR = { macheteo: 'cuts cane in the fields', colono: 'farms rented land', guajiro: 'works the land', vaquero: 'tends cattle', carbonero: 'burns charcoal', pescador: 'fishes from the pier', estibador: 'hauls cargo at the dock', domestica: 'works in other people’s houses', lavandera: 'takes in washing', ama: 'keeps the household', jubilado: 'is retired', hacendado: 'owns land', mayordomo: 'runs an estate' };
  C.workplaceOf = function (s, a) {
    const o = a.p.occ, tags = WORKTAGS[o];
    if (tags) for (const t of tags) { const L = s.blds.filter((b) => b.tag === t && !b.open); if (L.length) return L[(a.p.id * 7 + 3) % L.length]; }
    const ex = C.WORKTAGS_EXTRA && C.WORKTAGS_EXTRA[o];
    if (ex) for (const t of ex) { const [tag, key] = t.split(':'); const L = s.blds.filter((b) => b.tag === tag && (!key || b.key === key) && !b.open); if (L.length) return L[(a.p.id * 7 + 3) % L.length]; }
    return OUTDOOR[o] || (C.OUTDOOR_EXTRA && C.OUTDOOR_EXTRA[o]) || null;
  };

  // ------------------------------------------------------------------------------------------------------------------
  // SEEING
  // ------------------------------------------------------------------------------------------------------------------
  /** Can `obs` see (x,y)? cone + range + line of sight. */
  function canSee(s, obs, x, y, extra) {
    const dx = x - obs.x, dy = y - obs.y, d = Math.hypot(dx, dy);
    const g = G(); const dark = g.hour < 5 || g.hour >= 20 ? 0.5 : (g.hour < 7 || g.hour >= 18 ? 0.8 : 1);
    const range = TUNE.sight * dark * (1 - g.weather.rain * 0.25) * (1 - g.weather.fog * 0.4) * (extra || 1) * (ageOf(obs.p) > 65 ? 0.8 : 1);
    if (d > range) return false;
    if (d > TUNE.elbow) {
      const hd = obs.hd === undefined ? (obs.face > 0 ? 0 : Math.PI) : obs.hd; let da = Math.atan2(dy, dx) - hd; while (da > Math.PI) da -= 6.283; while (da < -Math.PI) da += 6.283;
      if (Math.abs(da) > TUNE.fov / 2) return false;
    }
    return C.losOpacity ? C.losOpacity(s, obs.x, obs.y, x, y) < 0.9 : true;
  }

  /** What does this observer make of that person? kind: armed | suspect | known | soldier | none. sev 0..1. */
  C.readSubject = function (obs, subj, s) {
    const g = G(), urban = urbanScene(s), p = subj.p;
    if (subj.side === 'army') return { kind: 'soldier', sev: subj.weaponOut ? 0.5 : 0.3, why: 'a soldier' };
    if (!(subj.side === 'rebel' || subj.isPlayer)) return { kind: 'none', sev: 0 };
    const w = subj.weapon && C.WEAPONS[subj.weapon.k];
    const brandish = subj.shooting > 0 || subj.exposed > 0 || (subj.weaponOut && !(subj.covertNow && urban && w && w.conceal));   // a covert man keeps his pistol under his shirt
    const showing = brandish || (w && !w.conceal && !(subj.covertNow && urban));
    const odd = subj.running || subj.hide || subj.prone || subj.exposed > 0;
    if (showing && w) return { kind: 'armed', sev: clamp(0.55 + (w.conceal ? 0 : 0.25) + (subj.shooting > 0 ? 0.2 : 0), 0, 1), why: `a man with a ${w.n.toLowerCase()}` };
    const fame = p.roster ? 0.7 : subj.isPlayer ? clamp(g.regime.heat / 100, 0.05, 0.8) : 0.04;
    const beard = p.beard ? 0.5 : 0;
    const d = Math.hypot(subj.x - obs.x, subj.y - obs.y);
    if (d < 90 && rnd() < TUNE.recognise * (fame + beard * 0.4) * (urban ? 1.4 : 1)) return { kind: 'known', sev: 0.5 + fame * 0.4, why: 'one of them' };
    if (odd && urban) return { kind: 'suspect', sev: 0.35, why: 'acting strangely' };
    if (!urban && (p.beard || w)) return { kind: 'armed', sev: 0.25, why: 'a barbudo' };   // in the monte a bearded man is a rebel; notable, not menacing
    return { kind: 'none', sev: 0 };
  };

  // ------------------------------------------------------------------------------------------------------------------
  // HEARING
  // ------------------------------------------------------------------------------------------------------------------
  /** Everyone within earshot of a sound reacts to it. kind: shot | boom | shout | engine | scream. */
  C.hearSound = function (s, x, y, loud, kind) {
    loud = loud || 1;
    for (const a of s.actors) {
      if (a.dead || a.side !== 'civ' || a.isPlayer) continue;
      const age = ageOf(a.p); const muffled = a.inside ? 0.4 : 1;
      const r = TUNE.hearBase * loud * muffled * (age > 65 ? 0.7 : 1) * (G().weather.rain > 0.4 ? 0.85 : 1) * (G().hour < 5 ? 1.2 : 1);
      const d = Math.hypot(a.x - x, a.y - y); if (d > r) continue;
      const aw = (a.aw = a.aw || {}); aw.heard = { x, y, kind, t: G().time, d };
      if (a.inside) { aw.state = 'wary'; aw.wt = G().min + 6; continue; }
      heading(a, x, y);
      if (kind === 'shot' || kind === 'boom') { a.panic = Math.min(1, (a.panic || 0) + (kind === 'boom' ? 0.6 : 0.3) * (1.2 - d / r)); startReaction(s, a, soundReaction(s, a, x, y, kind, d / r), { x, y }); }
      else if (kind === 'shout') { if (!a.react && rnd() < 0.5) startReaction(s, a, pick({ glance: 2, stare: 1.5, gather: 0.6 + (has(a.p, 'brave') ? 1 : 0), home_lock: 0.4 + (has(a.p, 'timid') ? 1.2 : 0), flee: has(a.p, 'timid') ? 0.8 : 0.1 }), { x, y }); }
      else if (kind === 'music') { if (!a.react && rnd() < 0.4) startReaction(s, a, pick({ stare: 2, approach: 1.2, glance: 1, gather: 0.6 }), { x, y }); }
      else if (kind === 'scream') { if (!a.react) startReaction(s, a, has(a.p, 'brave') || has(a.p, 'idealist') ? 'approach' : 'stare', { x, y }); }
      else if (kind === 'engine' && !a.react && rnd() < 0.3) startReaction(s, a, 'glance', { x, y });
    }
  };
  function soundReaction(s, a, x, y, kind, near) {
    const age = ageOf(a.p), brave = has(a.p, 'brave') || has(a.p, 'hothead') ? 1 : 0, timid = has(a.p, 'timid') || has(a.p, 'cautious') ? 1 : 0;
    const weights = { flee: 2 + timid * 3 + (age < 12 || age > 65 ? 1.5 : 0) + near * 1.5, home_lock: 2 + timid * 2 + (homeOf(s, a.p) ? 1.5 : 0), hide: 1.2 + timid, freeze: 0.8, gather: brave * 2 + (urbanScene(s) ? 0 : 1), stare: 0.7 + brave };
    return pick(weights);
  }
  const pick = (w) => { let t = 0; for (const k in w) t += Math.max(0, w[k]); let r = rnd() * t; for (const k in w) { r -= Math.max(0, w[k]); if (r <= 0) return k; } return 'ignore'; };

  // ------------------------------------------------------------------------------------------------------------------
  // CHOOSING A REACTION TO WHAT WAS SEEN
  // ------------------------------------------------------------------------------------------------------------------
  function reactTo(s, a, subj, rd) {
    const p = a.p, g = G(), urban = urbanScene(s), age = ageOf(p), sex = p.sex, sympathy = clamp((p.trueStance + 10) / 60, -1, 1);
    const timid = has(p, 'timid') || has(p, 'cautious') ? 1 : 0, brave = has(p, 'brave') || has(p, 'hothead') ? 1 : 0, devout = has(p, 'devout') ? 1 : 0, idealist = has(p, 'idealist') ? 1 : 0;
    const young = age >= 15 && age <= 30, d = Math.hypot(subj.x - a.x, subj.y - a.y);
    const shopkeeper = ['bodeguero', 'dependiente', 'comerciante', 'barbero', 'sastre'].includes(p.occ) && a.task && a.task.kind === 'in';
    const informer = p.informant && !p.revealed, official = ['funcionario', 'abogado', 'banquero'].includes(p.occ);
    const fearful = (0.5 + timid * 0.6 - brave * 0.5 + (age > 60 || age < 14 ? 0.3 : 0) + (sex === 'F' ? 0.12 : 0) - sympathy * 0.3);
    const w = {};
    const kidsNear = s.actors.some((q) => !q.dead && q.side === 'civ' && ageOf(q.p) < 12 && Math.hypot(q.x - a.x, q.y - a.y) < 80);
    if (rd.kind === 'armed') {
      const s0 = rd.sev;
      if (urban) {   // an armed guerrilla in the street: alarm
        w.flee = s0 * fearful * 3; w.home_lock = s0 * (0.5 + fearful) * (homeOf(s, p) ? 2.5 : 1); w.hide = s0 * fearful * 1.2; w.freeze = s0 * 0.8;
        w.shout_warn = s0 * (0.4 + brave * 0.4) * (1 - sympathy * 0.6); w.alert_phone = s0 * (0.4 + official * 1.2 + (1 - sympathy) * 0.5) * (rnd() < 0.7 ? 1 : 0.2);
        w.alert_police = s0 * (0.3 + official * 1.2 + brave * 0.5 + (informer ? 3 : 0)) * (1 - sympathy * 0.7);
        w.shutter = shopkeeper ? s0 * 3 : 0; w.stare = 0.6 + brave; w.call_children = kidsNear ? s0 * 2 : 0; w.cross = devout * s0 * 1.5; w.gather = brave * 0.8;
        if (sympathy > 0.2) { w.greet = sympathy * 1.2; w.help = sympathy * 1.0; w.safehouse = sympathy * (homeOf(s, p) ? 0.9 : 0); }
      } else {       // in the country: notable, not terrifying
        w.stare = 1.4; w.approach = 0.8 + brave + young * 0.5 + (age < 14 ? 1.5 : 0); w.gather = 0.6; w.hide = (fearful - 0.4) * s0 * (g.rep.fear > 35 ? 2 : 0.7); w.flee = Math.max(0, fearful - 0.6) * (g.rep.fear > 45 ? 2.5 : 0.4);
        w.home_lock = Math.max(0, fearful - 0.3) * (g.rep.fear > 35 ? 2 : 0.3) * (homeOf(s, p) ? 1 : 0); w.call_children = kidsNear ? 1.2 : 0;
        w.greet = 1 + sympathy * 2.5; w.help = Math.max(0, sympathy) * 2.0; w.tip_off = Math.max(0, sympathy) * 1.4; w.cross = devout * 1.2;
        if (informer) w.alert_police = 3;
      }
      // the young and the curious
      if (sex === 'F' && young && subj.p.sex === 'M') { const bold = 0.4 + sympathy * 0.5 + (g.rep.fear < 30 ? 0.3 : -0.3); w.admire = Math.max(0, bold) * 1.6 * (urban ? 0.4 : 1); w.flirt = Math.max(0, bold - 0.2) * (urban ? 0.3 : 0.9); if (d < 60 && subj.weaponOut) w.flee = (w.flee || 0) + 1.5 * timid; }
      if (sex === 'M' && young && !urban) { w.join_request = Math.max(0, sympathy + (idealist ? 0.5 : 0)) * 1.6 * (g.rep.fear < 40 ? 1 : 0.4); w.show_off = brave * 1.2; }
      if (sex === 'F' && age > 55) w.scold = 0.5 * (subj.shooting > 0 ? 0 : 1);
    } else if (rd.kind === 'known') {
      w.nod_quiet = sympathy > 0 ? 2 + sympathy * 2 : 0; w.help = Math.max(0, sympathy) * 1.5; w.safehouse = Math.max(0, sympathy) * (homeOf(s, p) ? 1.2 : 0);
      w.alert_police = (informer ? 4 : 0) + (1 - sympathy) * (0.3 + official + brave * 0.4); w.alert_phone = (1 - sympathy) * (0.3 + official * 1.5); w.avoid = fearful * 1.2; w.stare = 1;
    } else if (rd.kind === 'suspect') {
      w.stare = 1.4; w.avoid = fearful; w.alert_police = (informer ? 3 : 0) + official * 0.8 + (1 - sympathy) * 0.15; w.ignore = 1.5;
    } else if (rd.kind === 'soldier') {
      const dist = d; w.ignore = 2.5; w.glance = 1.5; w.avoid = fearful * 0.7 + (sympathy > 0.3 ? 0.8 : 0); w.stare = 0.5 + (age < 14 ? 1 : 0);
      if (sex === 'F' && young && subj.p.sex === 'M' && !(g.regime.armyMorale < 45)) { w.admire = 0.7; w.flirt = 0.25; }
      if (age < 12) w.follow = 1.2; if (sympathy > 0.3 && dist < 160) w.warn_rebels = sympathy * 0.6;
    }
    if (a.aw && a.aw.wary > g.min) { w.flee = (w.flee || 0) * 1.3; w.ignore = (w.ignore || 0) * 0.5; }
    const id = pick(w); return id;
  }

  // ------------------------------------------------------------------------------------------------------------------
  // STARTING AND RUNNING REACTIONS
  // ------------------------------------------------------------------------------------------------------------------
  const DUR = { ignore: 0, glance: 1.5, stare: 4, freeze: 3, flee: 6, home_lock: 40, shutter: 30, hide: 8, shout_warn: 2, alert_police: 60, alert_phone: 40, approach: 8, greet: 3, wave: 3, help: 14, tip_off: 6, safehouse: 12, follow: 14, admire: 6, flirt: 8, show_off: 6, join_request: 12, scold: 5, cross: 3, gather: 10, call_children: 3, nod_quiet: 3, avoid: 5, warn_rebels: 5 };
  function startReaction(s, a, id, at) {
    if (!id || id === 'ignore') return;
    const g = G(); if (a.react && a.react.id === id) return;
    if (a.react && ['flee', 'home_lock', 'alert_police', 'alert_phone'].includes(a.react.id) && !['flee', 'home_lock'].includes(id)) return;     // do not interrupt fleeing with chit-chat
    a.react = { id, t: 0, until: g.time + (DUR[id] || 4), at: at || null, phase: 0 }; a.path = null; a.pathFor = null; a.working = false;
    const aw = (a.aw = a.aw || {}); aw.react = id; aw.state = ['flee', 'home_lock', 'hide', 'freeze', 'shutter', 'alert_police', 'alert_phone', 'shout_warn', 'call_children'].includes(id) ? 'afraid' : ['stare', 'approach', 'gather', 'follow', 'avoid', 'glance'].includes(id) ? 'curious' : 'friendly';
    aw.wary = g.min + TUNE.wary;
    const lines = {
      flee: ['¡Corre!', '¡Ay, Dios!', '¡Armados!'], home_lock: ['¡Adentro, rápido!', 'Cierren la puerta'], hide: ['…'], freeze: ['…'], shutter: ['¡Cerrado!', 'Cierro hasta que pase esto'],
      shout_warn: ['¡Hay un hombre armado!', '¡Guerrilleros!', '¡Cuidado, cuidado!'], alert_police: ['Voy a avisar a la policía', '¡Tienen que saberlo!'], alert_phone: ['Voy a llamar…'],
      greet: ['Buenos días, compañero', '¡Que Dios los acompañe!'], wave: ['¡Hola!'], nod_quiet: ['Buenas… (en voz baja)', 'Aquí no se ha visto a nadie.'], help: ['Tengan, agua fresca.', '¿Han comido?'],
      safehouse: ['Por aquí, rápido, en mi casa.'], tip_off: ['¡Hay soldados en el camino!', 'Vi guardias por allá.'], admire: ['¡Mira, los barbudos!', 'Qué valientes…'], flirt: ['Tú, el de la barba… ¿cómo te llamas?', '¿Vienen de las montañas?'],
      show_off: ['Yo también sé disparar.'], join_request: ['¿Necesitan hombres?', 'Quiero ir con ustedes.'], scold: ['¡Qué falta de respeto!', 'Bajen esas armas.'], cross: ['Dios mío…'], call_children: ['¡Niños, a la casa!', '¡Entren ya!'], avoid: [], gather: [], approach: [], stare: [], follow: [], glance: [],
    };
    const L = lines[id]; if (L && L.length && (rnd() < 0.8)) say(a, L[(rnd() * L.length) | 0], id === 'flee' || id === 'shout_warn' ? '#7a1d1d' : '#222', 3);
    if (id === 'shout_warn') for (const o of s.actors) if (!o.dead && o !== a && o.side === 'civ' && !o.inside && Math.hypot(o.x - a.x, o.y - a.y) < 170 && !o.react) startReaction(s, o, rnd() < 0.55 ? 'stare' : (rnd() < 0.5 ? 'flee' : 'home_lock'), at);
    if (id === 'call_children') for (const o of s.actors) if (!o.dead && o.side === 'civ' && ageOf(o.p) < 13 && !o.inside && Math.hypot(o.x - a.x, o.y - a.y) < 140) startReaction(s, o, 'home_lock', at);
  }

  /** Report a sighting to the authorities: nearby soldiers go and look; the scene's alert rises. */
  function report(s, a, x, y, how) {
    s.alert = Math.min(1.5, (s.alert || 0) + 0.35); C.log && G().regime && (G().regime.heat = Math.min(100, G().regime.heat + 1.5));
    // the nearest few go and look (a report is one patrol's business, not the whole garrison's)
    const cand = s.actors.filter((o) => !o.dead && o.side === 'army' && !o.surrendered && !o.inside && o.brain.mode !== 'engage' && Math.hypot(o.x - x, o.y - y) < 640).sort((p, q) => Math.hypot(p.x - x, p.y - y) - Math.hypot(q.x - x, q.y - y)).slice(0, 6);
    let n = 0; for (const o of cand) { o.brain.mode = 'investigate'; o.brain.lastX = x; o.brain.lastY = y; o.brain.moveT = 0; n++; }
    say(a, how === 'phone' ? 'Sí, aquí, calle ' + (1 + ((x / T) | 0) % 9) + '… un hombre armado.' : '¡Un rebelde armado en la calle!', '#7a1d1d', 4);
    if (C.log && (a.p.informant || rnd() < 0.5)) C.log(`Someone reported you${how === 'phone' ? ' by telephone' : ' to the police'}. ${n ? n + ' soldiers are coming to look.' : 'Nobody was nearby to answer — yet.'}`, 'warn');
  }

  function runReaction(s, a, dt) {
    const g = G(), r = a.react, p = a.p, A_ = A();
    r.t += dt; const spd = a.speed * A_.terrainSpeed(s, a);
    const away = (x, y, dist) => { const ang = Math.atan2(a.y - y, a.x - x) + (rnd() - 0.5) * 0.7; const tx = a.x + Math.cos(ang) * dist, ty = a.y + Math.sin(ang) * dist; return { x: tx, y: ty }; };
    const walk = (mult) => A_.followPath(s, a, dt, spd * mult);
    const subjPos = r.at || (r.subj ? { x: r.subj.x, y: r.subj.y } : null);
    if (r.subj && !r.subj.dead) { r.at = { x: r.subj.x, y: r.subj.y }; }
    switch (r.id) {
      case 'glance': case 'stare': case 'freeze': case 'cross': case 'nod_quiet': case 'greet': case 'wave': case 'scold': case 'admire': case 'call_children':
        a.moving = false; if (subjPos) heading(a, subjPos.x, subjPos.y); if (r.id === 'freeze') a.panic = Math.max(a.panic, 0.3);
        if (r.id === 'admire' && r.subj && r.t > 1.5 && rnd() < dt * 0.4) { const d = Math.hypot(r.subj.x - a.x, r.subj.y - a.y); if (d > 40) { r.id = 'approach'; r.until = g.time + 6; } }
        break;
      case 'approach': case 'gather': case 'flirt': case 'show_off': case 'join_request': case 'follow': case 'help': {
        const tgt = r.subj && !r.subj.dead ? r.subj : null; if (!tgt) { a.moving = false; break; }
        const want = r.id === 'gather' ? 70 : r.id === 'follow' ? 38 : 28, d = Math.hypot(tgt.x - a.x, tgt.y - a.y);
        if (d > want + 6) { if (!a.path || r.t % 1.2 < dt) A_.setPath(s, a, tgt.x + (rnd() - 0.5) * 20, tgt.y + 10); walk(r.id === 'follow' ? 1.0 : 0.9); }
        else { a.moving = false; heading(a, tgt.x, tgt.y); if (r.phase === 0) { r.phase = 1; arrive(s, a, r, tgt); } }
        break;
      }
      case 'flee': case 'avoid': {
        if (!a.path || r.t < dt * 2) { const q = away(r.at ? r.at.x : a.x - 1, r.at ? r.at.y : a.y, r.id === 'flee' ? 260 : 90); A_.setPath(s, a, q.x, q.y); }
        a.running = r.id === 'flee'; const done = walk(r.id === 'flee' ? 1.9 : 1.1); if (done) { a.running = false; if (r.id === 'flee' && r.t < 3) r.t = r.until - g.time > 0 ? r.t : 99; r.until = Math.min(r.until, g.time + 0.5); }
        break;
      }
      case 'home_lock': case 'shutter': {
        let b = r.id === 'shutter' && a.task && a.task.b ? a.task.b : homeOf(s, p);
        if (!b || !b.door) b = nearestB(s, a, () => true); if (!b) { r.until = 0; break; }
        const d = doorOf(s, b); a.running = true; if (!a.path || r.t < dt * 2) A_.setPath(s, a, d.x, d.y + 2);
        if (walk(1.8) || Math.hypot(d.x - a.x, d.y - a.y) < 8) { a.running = false; a.inside = true; a.bld = b.id; a.nextPlan = g.min + 20 + rnd() * 25; lockDoor(s, a, b); a.react = null; if (a.aw) a.aw.state = 'hiding'; }
        break;
      }
      case 'hide': {
        if (!r.spot) { const b = nearestB(s, a, () => true); r.spot = b ? { x: doorOf(s, b).x + (rnd() - 0.5) * 20, y: doorOf(s, b).y + 6 } : away(r.at ? r.at.x : a.x, r.at ? r.at.y : a.y, 60); A_.setPath(s, a, r.spot.x, r.spot.y); }
        a.running = true; if (walk(1.6)) { a.running = false; a.prone = true; a.moving = false; } break;
      }
      case 'alert_police': case 'alert_phone': {
        const phone = r.id === 'alert_phone'; const b = r.b || (r.b = nearestB(s, a, phone ? PHONE : POLICE)); if (!b) { r.until = 0; break; }
        const d = doorOf(s, b); if (!r.arrived) { a.running = !phone && r.t < 20; if (!a.path) A_.setPath(s, a, d.x, d.y + 2); if (walk(phone ? 1.2 : 1.5) || Math.hypot(d.x - a.x, d.y - a.y) < 10) { r.arrived = true; r.w = 0; a.running = false; } break; }
        a.moving = false; r.w += dt; if (r.w >= (phone ? TUNE.phoneDelay : 2)) { report(s, a, r.at ? r.at.x : a.x, r.at ? r.at.y : a.y, phone ? 'phone' : 'person'); r.until = 0; if (phone) { a.inside = true; a.bld = b.id; a.nextPlan = g.min + 10; } }
        break;
      }
      case 'shout_warn': a.moving = false; if (subjPos) heading(a, subjPos.x, subjPos.y); break;
      case 'tip_off': case 'warn_rebels': a.moving = false; if (r.t > 0.8 && !r.done) { r.done = true; const lead = g.player; let n = 0; for (const o of s.actors) if (o.side === 'army' && !o.dead && Math.hypot(o.x - a.x, o.y - a.y) < 360) { o.spotted = 10; n++; } if (n) say(a, `¡Soldados! ${n > 3 ? 'Muchos' : 'Unos cuantos'}, por allá.`, '#1d5b2a', 4); else say(a, 'Por aquí no hay guardias.', '#1d5b2a', 3); } break;
      case 'safehouse': { const b = homeOf(s, p); if (!b) { r.until = 0; break; } const d = doorOf(s, b); if (!a.path) A_.setPath(s, a, d.x, d.y + 2); if (walk(1.4)) { b.safehouse = g.min + 90; b.safeOwner = p.hh; r.until = 0; a.moving = false; say(a, 'Mi casa es su casa.', '#1d5b2a', 4); } break; }
      default: r.until = 0;
    }
    if (g.time >= r.until) { a.react = null; a.running = false; a.prone = false; if (a.aw) { a.aw.react = null; a.aw.state = a.aw.wary > g.min ? 'wary' : 'calm'; } }
  }
  /** What happens when a person who walked up reaches the subject. */
  function arrive(s, a, r, tgt) {
    const p = a.p, g = G();
    switch (r.id) {
      case 'help': { const ok = tgt.isPlayer || tgt.side === 'rebel'; if (!ok) break; const n = tgt.p.needs; if (n.water < 60) { n.water = clamp(n.water + 40, 0, 100); say(a, 'Tome, agua fresca.', '#1d5b2a', 3); } else if (n.food < 55) { n.food = clamp(n.food + 25, 0, 100); say(a, 'Coma algo, compañero.', '#1d5b2a', 3); } else say(a, '¡Que Dios los cuide!', '#1d5b2a', 3); p.trueStance += 1.2; C.bondEvent && C.bondEvent(tgt.p, p, 'shared', 0.6); break; }
      case 'flirt': say(a, ['¿De dónde eres?', 'Cuídate mucho, ¿eh?', 'Mi hermano también quiere irse con ustedes.'][(rnd() * 3) | 0], '#7a2a5a', 3.5); p.needs.hope = clamp(p.needs.hope + 3, 0, 100); if (tgt.p) tgt.p.needs.hope = clamp((tgt.p.needs.hope || 50) + 1.5, 0, 100); break;
      case 'join_request': say(a, '¿Necesitan un hombre más?', '#222', 4); a.p.wantsJoin = g.day; if (tgt.isPlayer) C.ui.toast(`${C.tagName(p)} wants to join you — talk to him (E) to take him on.`); break;
      case 'show_off': say(a, '¡Yo también puedo pelear!', '#222', 3); break;
      case 'approach': case 'gather': say(a, ['¿Qué pasa por aquí?', 'Vienen de la Sierra, ¿verdad?'][(rnd() * 2) | 0], '#222', 3); break;
      case 'follow': say(a, '¡Mira, un rifle!', '#222', 3); break;
    }
  }

  // ------------------------------------------------------------------------------------------------------------------
  // THE PERCEPTION PASS + MEALS AND REST
  // ------------------------------------------------------------------------------------------------------------------
  C.civAware = function (s, a, dt) {
    if (a.recruit && C.recruitBehave && C.recruitBehave(s, a, dt)) return true;     // a volunteer waiting at the camp (recruits.js)
    const g = G(), p = a.p; const aw = (a.aw = a.aw || { state: 'calm' });
    // heading follows movement
    if (a.px !== undefined) { const mx = a.x - a.px, my = a.y - a.py; if (mx * mx + my * my > 0.04) a.hd = Math.atan2(my, mx); }
    a.px = a.x; a.py = a.y;
    // idle glances
    if (!a.moving && !a.react && rnd() < dt * 0.15) a.hd = (a.hd || 0) + (rnd() - 0.5) * 2.2;
    // perception pass (staggered)
    aw.tt = (aw.tt || (a.id % 7) * 0.05) - dt;
    if (aw.tt <= 0 && !a.fleeing) {
      aw.tt = TUNE.tick * (0.8 + rnd() * 0.5);
      let best = null, bs = 0;
      for (const o of s.actors) {
        if (o === a || o.dead || o.inside || o.inVeh || o.side === 'civ') continue;
        if (Math.hypot(o.x - a.x, o.y - a.y) > TUNE.sight * 1.1) continue;
        const loud = o.shooting > 0 ? 1.6 : o.weaponOut ? 1.15 : 1;
        if (!canSee(s, a, o.x, o.y, loud)) continue;
        const rd = C.readSubject(a, o, s); const sc = rd.sev * (1 + (1 - Math.hypot(o.x - a.x, o.y - a.y) / 300));
        if (rd.kind !== 'none' && sc > bs) { bs = sc; best = { o, rd }; }
      }
      if (best) {
        aw.seen = { t: g.time, kind: best.rd.kind, why: best.rd.why }; aw.subj = best.o;
        if (!a.react || ['stare', 'glance', 'approach', 'gather', 'nod_quiet', 'avoid'].includes(a.react.id)) {
          if (!aw.cool || g.time > aw.cool) { const id = reactTo(s, a, best.o, best.rd); aw.cool = g.time + 3 + rnd() * 4; if (id && id !== 'ignore') { startReaction(s, a, id, { x: best.o.x, y: best.o.y }); if (a.react) a.react.subj = best.o; } }
        }
      } else if (aw.state === 'curious' && !a.react) aw.state = aw.wary > g.min ? 'wary' : 'calm';
    }
    if (a.react) { if (a.fleeing) a.fleeing = false; runReaction(s, a, dt); return true; }
    mealAndRest(s, a);
    return false;
  };

  C.insideAware = function (s, a) { if (a.side === 'civ') mealAndRest(s, a); };
  /** Meals and sleep: the day's rhythm on top of the plan system. */
  function mealAndRest(s, a) {
    const g = G(), p = a.p, hr = g.hour; const key = g.day * 10;
    if (a.inside && a.bld >= 0) {
      const home = homeOf(s, p), inHome = home && home.id === a.bld;
      const meal = TUNE.meals.findIndex(([h0, h1]) => hr >= h0 && hr < h1);
      if (meal >= 0 && p.mealDone !== key + meal && (inHome || s.blds[a.bld].key === 'cafe' || s.blds[a.bld].key === 'restaurante')) { p.mealDone = key + meal; p.needs.food = clamp(p.needs.food + (meal === 1 ? 38 : 30), 0, 100); p.needs.water = clamp(p.needs.water + 20, 0, 100); a.eating = g.min + 25; a.nextPlan = Math.max(a.nextPlan, g.min + 25); }
      if (hr >= 13 && hr < 15 && inHome && ageOf(p) > 55 && rnd() < 0.002) a.nextPlan = Math.max(a.nextPlan, g.min + 60);   // siesta
      return;
    }
    // hungry in the street: head home or to a café
    if (!a.task || !a.task.hungry) {
      const meal = TUNE.meals.findIndex(([h0, h1]) => hr >= h0 && hr < h1);
      if ((meal >= 0 && p.mealDone !== key + meal && rnd() < 0.003) || (p.needs.food < 28 && rnd() < 0.004)) {
        const rich = (p.cls || 0) >= 2; const cafe = rich ? nearestB(s, a, (b) => b.key === 'cafe' || b.key === 'restaurante') : null; const home = homeOf(s, p);
        const b = cafe && rnd() < 0.5 ? cafe : home || cafe;
        if (b) { const d = doorOf(s, b); a.task = { kind: 'in', b, hungry: true }; a.path = null; A().setPath(s, a, d.x, d.y + 2); a.nextPlan = g.min + 120; }
      }
    }
  }

  // ------------------------------------------------------------------------------------------------------------------
  // TOOLTIP: hover a person or a vehicle
  // ------------------------------------------------------------------------------------------------------------------
  const css = document.createElement('style');
  css.textContent = '#npcTip{position:fixed;z-index:9;pointer-events:none;display:none;max-width:260px;padding:7px 10px;border-radius:10px;background:rgba(24,20,16,.94);border:1px solid rgba(232,195,106,.55);color:#f3ead8;font-size:11.5px;line-height:1.45;box-shadow:0 6px 20px rgba(0,0,0,.45)}#npcTip b{color:#e8c36a;font-size:12.5px}#npcTip i{opacity:.7;font-style:normal}#npcTip .st{display:inline-block;margin-top:3px;padding:0 6px;border-radius:8px;background:rgba(255,255,255,.12)}';
  document.head.appendChild(css);
  const tip = document.createElement('div'); tip.id = 'npcTip'; document.body.appendChild(tip);
  const esc = (t) => String(t).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
  function doing(s, a) {
    if (a.dead) return 'dead';
    const r = a.react && a.react.id; const L = { flee: 'running away', home_lock: 'running home to bar the door', shutter: 'shuttering the shop', hide: 'hiding', freeze: 'frozen with fear', stare: 'watching closely', glance: 'glancing over', approach: 'coming over to look', gather: 'gawking', greet: 'greeting someone', wave: 'waving', nod_quiet: 'giving a quiet nod', help: 'bringing something to help', tip_off: 'warning you', safehouse: 'offering shelter', follow: 'following the soldiers', admire: 'admiring the rebels', flirt: 'chatting someone up', show_off: 'showing off', join_request: 'wanting to enlist', scold: 'scolding', cross: 'crossing themselves', alert_police: 'going to tell the police', alert_phone: 'going to a telephone', call_children: 'calling the children in', avoid: 'steering clear', shout_warn: 'shouting a warning' };
    if (r && L[r]) return L[r];
    if (a.inside) { const b = s.blds[a.bld]; return (a.sleeping ? 'asleep' : a.eating > G().min ? 'eating' : 'inside') + (b ? ' at ' + b.label : ''); }
    if (a.inVeh) return 'in a vehicle'; if (a.working) return a.task && a.task.work === 'fish' ? 'fishing' : a.task && a.task.work === 'cut' ? 'working the field' : a.task && a.task.work === 'burn' ? 'tending the kiln' : a.task && a.task.work === 'haul' ? 'hauling' : 'working';
    if (a.task && a.task.hungry) return 'going to eat';
    if (a.task && a.task.kind === 'in' && a.task.b) return 'heading to ' + a.task.b.label;
    if (a.order) return 'following orders'; if (a.moving) return 'walking'; return 'standing about';
  }
  function actorTip(s, a) {
    const p = a.p, age = ageOf(p), g = G();
    let h = `<b>${esc(C.tagName(p))}</b> <i>${age}, ${p.sex === 'F' ? 'woman' : 'man'}</i><br>`;
    const occ = (C.OCC[p.occ] || {}).n || p.occ; h += `${esc(occ)}`;
    if (a.side === 'army') h += ` · <i>${esc((p.mil && p.mil.rank) || 'Soldier')}</i>`; else if (a.side === 'rebel' || a.isPlayer) h += ` · <i>${esc((p.mil && p.mil.rank) || p.role || 'Rebel')}</i>`;
    const wp = C.workplaceOf(s, a); if (wp && a.side === 'civ') h += `<br><i>${typeof wp === 'string' ? 'Job:' : 'Works at'}</i> ${esc(typeof wp === 'string' ? wp : wp.label)}`;
    const hb = homeOf(s, p); if (hb) h += `<br><i>Lives at</i> ${esc(hb.label)}`;
    h += `<br><i>Now:</i> ${esc(doing(s, a))}`;
    const aw = a.aw && a.aw.state && a.side === 'civ' ? a.aw.state : null; if (aw && aw !== 'calm') h += `<br><span class="st">${aw}</span>`;
    const lab = a.expr && a.expr.label; if (lab) h += `<br><i>Looks</i> ${esc(lab)}`;
    if (p.needs.food < 25) h += ' · hungry'; if (p.needs.water < 20) h += ' · thirsty'; if (p.needs.energy < 20) h += ' · exhausted';
    if (p.hp < p.maxHp * 0.6 && p.maxHp) h += ' · hurt';
    const kin = (p.kids ? p.kids.length : 0); if (kin && a.side === 'civ') h += `<br><i>${kin} child${kin > 1 ? 'ren' : ''}</i>`;
    if (a.side === 'civ' && a.aw && a.aw.seen && g.time - a.aw.seen.t < 6) h += `<br><i>Has noticed</i> ${esc(a.aw.seen.why)}`;
    if (a.p.wantsJoin !== undefined && g.day - a.p.wantsJoin < 3) h += `<br><span class="st">wants to join you</span>`;
    if (C.tipExtra) h += C.tipExtra(s, a);
    return h;
  }
  function vehicleTip(v) {
    const d = v.def; let h = `<b>${esc(d.n)}</b><br>`; h += `Fuel ${Math.round(v.fuel)}/${d.tank || 0} · hull ${Math.round(100 * v.hp / d.hp)}%`;
    if (v.faults && v.faults.length) h += `<br><span class="st">${v.faults.filter((f) => f.known).map((f) => f.n).join(', ') || 'running rough'}</span>`;
    const occ = (v.driver ? 1 : 0) + v.pass.length; if (d.cap) h += `<br>${occ}/${d.cap} aboard`; if (v.cargo) { const n = Object.values(v.cargo).reduce((s2, q) => s2 + q, 0); if (n) h += ` · cargo ${n}`; }
    return h;
  }
  C.tipHtml = { actor: actorTip, vehicle: vehicleTip };
  let lastMX = 0, lastMY = 0;
  window.addEventListener('mousemove', (e) => { lastMX = e.clientX; lastMY = e.clientY; });
  setInterval(() => {
    const g = G(); if (!g || !g.scene || g.over || g.modalOpen || document.getElementById('wheel') && document.getElementById('wheel').style.display === 'block') { tip.style.display = 'none'; return; }
    const s = g.scene, m = C.mouse; if (!m || m.wx === undefined) return;
    const tgt = e0(); function e0() { return document.elementFromPoint(lastMX, lastMY); }
    if (!tgt || tgt.id !== 'game') { tip.style.display = 'none'; return; }
    let html = null;
    const a = g.hover && g.hover.p && !g.hover.dead ? g.hover : null;
    if (a && !a.inside) html = actorTip(s, a);
    else { for (const v of s.vehicles) { if (v.gone) continue; if (Math.abs(v.x - m.wx) < v.def.w * 0.55 && Math.abs(v.y - m.wy) < v.def.h * 0.9) { html = vehicleTip(v); break; } } }
    if (!html) { tip.style.display = 'none'; return; }
    tip.innerHTML = html; tip.style.display = 'block'; const w = tip.offsetWidth, h = tip.offsetHeight;
    tip.style.left = Math.min(window.innerWidth - w - 8, lastMX + 16) + 'px'; tip.style.top = Math.min(window.innerHeight - h - 8, lastMY + 14) + 'px';
  }, 120);
})();
