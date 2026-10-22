/* CUBEA — services.js : THE RADIO, THE SICK BAY, AND GOVERNMENT AS PLACES.

   RADIO REBELDE (broadcast verbs)
     A radio set is built on the ground (scrap, a battery, tools). Verbs at the set: announce a plank of the manifesto (each of
     the eight planks has three positions; the forecast of what it will do to support is shown on the option), declare an amnesty,
     call for a strike, read a communiqué, read a text aloud over the air (ideology.js texts). Everyone on the island who might
     be listening may be moved; the army triangulates the signal (heat rises) and the camp's alert rises. The old manifesto
     panel (P) remains as the overview of what you have said.
   THE SICK BAY
     Wounded people who cannot walk are carried by two bearers on a stretcher (verb), laid on a cot (verb, built from scrap and
     cloth), and nursed (verb; medicine helps; medics, midwives and curanderas heal faster). Cots heal over time; the medical
     squad's Sick Call is a preset action that walks to the nearest hurt person and treats them.
   GOVERNING AS PLACES
     After victory the eight decisions are no longer a chain of cards. A petition banner stands at the building where each is
     decided (the Ayuntamiento for land, the police station for the old regime, the radio station for press and vote, the bank
     for the utilities, the university for schools, the barracks for the army, the casino and clubs for women and race, the
     warehouse and port for trade). Walk there and hold audience (verb). Order is your own; the invasion comes when they are done.
   TUNE: numbers in the TUNE block.
*/
(function () {
  'use strict';
  const C = window.C, G = () => C.G, clamp = C.clamp, T = C.T;
  const rnd = Math.random;

  // TUNE ---------------------------------------------------------------------------------------------------------------
  const TUNE = {
    radio: { cost: { scrap: 12, tools: 1, battery: 1 }, heat: 3, alert: 0.25, listen: 0.3, gain: 0.05, onAir: 25 },
    cot: { cost: { scrap: 2, cloth: 2 }, healPerMin: 0.12, feverCure: 0.02, medicBonus: 1.8, bleedStop: 0.01 },
    carrySpeed: 0.62, carryReach: 40, downedHp: 0.25,
  };
  C.SERVICE_TUNE = TUNE;
  const inv = (a) => C.initInv(a.p);
  const gr = () => G().res;
  const sh = (c, x, y, r) => { c.fillStyle = 'rgba(0,0,0,.22)'; c.beginPath(); c.ellipse(x, y + 2, r, r * 0.35, 0, 0, 6.3); c.fill(); };

  // ------------------------------------------------------------------------------------------------------------------
  // THINGS
  // ------------------------------------------------------------------------------------------------------------------
  Object.assign(C.THINGS, {
    radioset: { n: 'Radio Rebelde set', draw(c, t, time) { sh(c, t.x, t.y, 9); c.fillStyle = 'rgb(84,62,40)'; c.fillRect(t.x - 8, t.y - 2, 16, 4); c.fillStyle = 'rgb(70,78,70)'; c.fillRect(t.x - 7, t.y - 8, 14, 7); c.fillStyle = 'rgb(220,200,120)'; c.beginPath(); c.arc(t.x - 2, t.y - 4.5, 2.6, 0, 6.3); c.fill(); c.strokeStyle = 'rgb(180,180,176)'; c.lineWidth = 1; c.beginPath(); c.moveTo(t.x + 5, t.y - 8); c.lineTo(t.x + 9, t.y - 24); c.stroke(); if (t.d.air > G().time) { c.strokeStyle = 'rgba(255,230,120,.8)'; for (let i = 1; i <= 3; i++) { c.beginPath(); c.arc(t.x + 9, t.y - 24, 3 + i * 3 + (time * 6 % 3), -2.6, -0.5); c.stroke(); } } } },
    camilla: { n: 'Cot (camilla)', draw(c, t) { sh(c, t.x, t.y, 9); c.fillStyle = 'rgb(96,72,48)'; c.fillRect(t.x - 9, t.y - 1, 1.6, 5); c.fillRect(t.x + 7.4, t.y - 1, 1.6, 5); c.fillStyle = 'rgb(226,222,206)'; c.fillRect(t.x - 10, t.y - 4, 20, 4); c.fillStyle = 'rgb(176,60,52)'; c.fillRect(t.x - 10, t.y - 3, 6, 2.4); } },
    petition: { n: 'Petition', draw(c, t, time) { const b = Math.sin(time * 2 + t.x) * 0.8; c.fillStyle = 'rgba(0,0,0,.2)'; c.fillRect(t.x - 1, t.y - 2, 3, 3); c.strokeStyle = 'rgb(96,72,48)'; c.lineWidth = 1.6; c.beginPath(); c.moveTo(t.x, t.y + 1); c.lineTo(t.x, t.y - 22); c.stroke(); c.fillStyle = 'rgb(214,52,44)'; c.beginPath(); c.moveTo(t.x, t.y - 22); c.lineTo(t.x + 14, t.y - 20 + b); c.lineTo(t.x + 12, t.y - 14 + b); c.lineTo(t.x, t.y - 13); c.fill(); c.fillStyle = 'rgb(250,240,210)'; c.font = '7px sans-serif'; c.fillText('⚖', t.x + 3, t.y - 15); } },
  });
  C.registerVerb({ id: 'build_service', n: 'Set up a radio set / a cot', icon: '🛠', kinds: ['ground'], reach: 16, dur: 14,
    variants: () => [{ param: { k: 'radioset' }, label: 'Set up a radio set (12 scrap, tool kit, battery)' }, { param: { k: 'camilla' }, label: 'Make a cot (2 scrap, 2 cloth)' }],
    check: (a, tg, p) => { if (!p) return null; const need = p.k === 'radioset' ? TUNE.radio.cost : TUNE.cot.cost, r = gr(); for (const k in need) if ((r[k] || 0) < need[k]) return `Needs ${need[k]} ${k}.`; if (C.nearestThing(a.scene, tg.x, tg.y, null, 14)) return 'Something is in the way.'; return null; },
    done: (a, tg, p) => { const need = p.k === 'radioset' ? TUNE.radio.cost : TUNE.cot.cost, r = gr(); for (const k in need) if (k !== 'tools') r[k] -= need[k]; C.addThing(a.scene, p.k, tg.x, tg.y, {}); C.log(`${C.tagName(a.p)} set up ${p.k === 'radioset' ? 'a radio set' : 'a cot'}.`, 'good'); return null; } });

  // ------------------------------------------------------------------------------------------------------------------
  // THE RADIO
  // ------------------------------------------------------------------------------------------------------------------
  let fcDay = -1, fcCache = null; const forecast = () => { const g = G(); if (fcDay !== g.day || !fcCache) { fcCache = C.forecastAll ? C.forecastAll() : null; fcDay = g.day; } return fcCache; };
  /** Reach everyone who might be listening: apply a value vector to the island (a fraction of them hear it). */
  C.broadcast = function (vec, gain, o) {
    o = o || {}; let n = 0; const frac = o.frac || TUNE.radio.listen;
    for (const p of C.W.people) { if (p.status !== 'alive' || p.mil && p.mil.side === 'army' && !o.army) continue; if (rnd() > frac * ((p.cls || 0) >= 1 || rnd() < 0.5 ? 1 : 0.4)) continue; C.expose(p, vec, gain || TUNE.radio.gain, { zeal: 1 }); n++; }
    return n;
  };
  const onAirCheck = (a, tg) => (tg.o.d.air > G().time ? 'The set is already on the air.' : null);
  const goOnAir = (a, tg, what) => { const g = G(), s = a.scene; tg.o.d.air = g.time + TUNE.radio.onAir; g.regime.heat = clamp(g.regime.heat + TUNE.radio.heat, 0, 100); s.alert = Math.min(1.5, (s.alert || 0) + TUNE.radio.alert); C.say(a, 'Aquí Radio Rebelde…', '#222', 4); C.log(`On the air: ${what}. The army will have heard it, and will be listening for where it came from.`, 'info'); };
  C.PLANKS && C.PLANKS.forEach((pl, k) => {
    C.registerVerb({ id: 'announce_' + k, n: 'Announce: ' + pl.name, icon: '📻', kinds: ['thing:radioset'], reach: 18, dur: 12,
      variants: () => { const fc = forecast(); return pl.opts.map((o, i) => { const f = fc && fc[k] && fc[k][i]; return { param: { i }, label: `${o}${f ? ` (forecast ${f.overall > 0 ? '+' : ''}${f.overall.toFixed(1)})` : ''}` }; }); },
      check: onAirCheck,
      done: (a, tg, p) => { const g = G(); const P = g.platform; const keepReal = P.declared[k] && P.real[k] !== P.pub[k] ? P.real[k] : undefined; C.declarePlank(k, p.i, keepReal !== undefined ? keepReal : p.i); goOnAir(a, tg, `${pl.name}: ${pl.opts[p.i]}`); return null; } });
  });
  C.registerVerb({ id: 'announce_amnesty', n: 'Announce an amnesty', icon: '🕊', kinds: ['thing:radioset'], reach: 18, dur: 12,
    variants: () => [{ param: { l: 'rank' }, label: 'Amnesty for rank and file' }, { param: { l: 'all' }, label: 'Amnesty for every soldier who lays down arms' }, { param: { l: 'none' }, label: 'Withdraw the amnesty' }],
    check: onAirCheck, done: (a, tg, p) => { C.policyInit && C.policyInit(); C.setAmnesty(p.l); goOnAir(a, tg, 'an amnesty'); return null; } });
  C.registerVerb({ id: 'call_strike', n: 'Call for a strike', icon: '✊', kinds: ['thing:radioset'], reach: 18, dur: 12, check: (a, tg) => onAirCheck(a, tg) || (gr().money < 10 ? 'The strike fund needs 10 pesos.' : null),
    done: (a, tg) => { const g = G(); g.res.money -= 10; g.strikePrep += 3; C.broadcast({ igualdad: 0.6, tierra: 0.4 }, 0.04); goOnAir(a, tg, 'a call for a strike'); return null; } });
  C.registerVerb({ id: 'communique', n: 'Read a communiqué', icon: '📰', kinds: ['thing:radioset'], reach: 18, dur: 12, check: onAirCheck,
    done: (a, tg) => { const g = G(); const wins = g.stats.killedArmy || 0; C.broadcast({ patria: 0.5, disciplina: 0.3 }, 0.04); g.regime.armyMorale = clamp(g.regime.armyMorale - 0.5 - Math.min(2, wins * 0.02), 0, 100); g.regime.legit = clamp(g.regime.legit - 0.4, 0, 100); goOnAir(a, tg, 'a communiqué of the war'); return null; } });
  C.registerVerb({ id: 'read_on_air', n: 'Read a text on the air', icon: '📖', kinds: ['thing:radioset'], reach: 18, dur: 14, variants: () => Object.keys(C.TEXTS).map((id) => ({ param: { text: id }, label: C.TEXTS[id].n })), check: (a, tg) => onAirCheck(a, tg) || (!a.p.literate ? 'You must be able to read.' : null),
    done: (a, tg, p) => { const T0 = C.TEXTS[p.text]; const n = C.broadcast(T0.v, 0.06, { frac: 0.4 }); if (C.initCreed) { C.initCreed(); const g = G(); for (const k of C.CREED_AXES) { const t = T0.v[k] || 0; if (t) g.creed[k] = clamp(g.creed[k] + (t - g.creed[k]) * 0.12 * Math.abs(t), -1, 1); } } goOnAir(a, tg, `“${T0.n}” (${n} listeners)`); return null; } });

  // ------------------------------------------------------------------------------------------------------------------
  // THE SICK BAY
  // ------------------------------------------------------------------------------------------------------------------
  const isHurt = (q) => !q.dead && (q.p.hp < q.p.maxHp * 0.75 || q.p.bleed > 0.2 || q.p.ill);
  const downed = (q) => q.p.hp < q.p.maxHp * TUNE.downedHp;
  C.registerVerb({ id: 'carry_wounded', n: 'Pick up on a stretcher', icon: '🚑', kinds: ['actor'], reach: 26, dur: 6,
    check: (a, tg) => { const q = tg.o; if (!(q.side === 'rebel' || q.isPlayer) || q.dead) return 'Only your own wounded.'; if (q.carried) return 'Already being carried.'; if (!isHurt(q)) return 'He is on his feet.'; const mate = a.scene.actors.find((o) => o !== a && o !== q && !o.dead && (o.side === 'rebel') && !o.carrying && !downed(o) && Math.hypot(o.x - a.x, o.y - a.y) < TUNE.carryReach); return mate ? null : 'A stretcher needs two bearers — a second person beside you.'; },
    done: (a, tg) => { const s = a.scene, q = tg.o; const mate = s.actors.find((o) => o !== a && o !== q && !o.dead && o.side === 'rebel' && !o.carrying && !downed(o) && Math.hypot(o.x - a.x, o.y - a.y) < TUNE.carryReach); if (!mate) return 'No second bearer.'; q.carried = { a, b: mate }; a.carrying = mate.carrying = q; q.order = null; q.path = null; q.moving = false; q.prone = true; C.log(`${C.tagName(a.p)} and ${C.tagName(mate.p)} lift ${C.tagName(q.p)} onto a stretcher.`, 'info'); return null; } });
  C.registerVerb({ id: 'put_on_cot', n: 'Lay them on the cot', icon: '🛏', kinds: ['thing:camilla'], reach: 26, dur: 3,
    check: (a, tg) => (a.carrying ? (tg.o.d.occ && C.thingById(a.scene, tg.o.id) && tg.o.d.occ ? 'The cot is taken.' : null) : 'You are not carrying anyone.'),
    done: (a, tg) => { const q = a.carrying; if (!q) return 'Nobody to lay down.'; const c = q.carried; if (c) { c.a.carrying = c.b.carrying = null; } q.carried = null; q.onCot = tg.o.id; tg.o.d.occ = q.id; q.x = tg.x; q.y = tg.y - 3; q.prone = true; q.sleeping = false; C.log(`${C.tagName(q.p)} is on a cot.`, 'good'); return null; } });
  C.registerVerb({ id: 'nurse', n: 'Nurse the patient', icon: '🩺', kinds: ['thing:camilla'], reach: 22, dur: 14,
    check: (a, tg) => { const q = occupant(a.scene, tg.o); return q ? null : 'Nobody is on the cot.'; },
    done: (a, tg) => { const q = occupant(a.scene, tg.o); if (!q) return 'Nobody is on the cot.'; const p = q.p; const medic = ['medico', 'partera'].includes(a.p.occ) || a.p.roster === 'che'; const med = gr().med >= 1 || (inv(a).med || 0) > 0; if (med) { if (!C.invTake(a.p, 'med', 1)) gr().med--; p.hp = Math.min(p.maxHp, p.hp + (medic ? 34 : 22)); p.bleed = 0; if (p.ill) { if (medic || rnd() < 0.5) p.ill = null; } } else { p.hp = Math.min(p.maxHp, p.hp + 8); p.needs.water = clamp(p.needs.water + 20, 0, 100); } C.bondEvent && C.bondEvent(a.p, p, 'treated', medic ? 1.2 : 0.8); C.say(a, med ? 'Aguanta, compañero.' : 'No hay medicina… agua y descanso.', '#1d5b2a', 3); return null; } });
  const occupant = (s, cot) => (cot.d.occ ? s.actors.find((q) => q.id === cot.d.occ && !q.dead && q.onCot === cot.id) : null);
  C.registerVerb({ id: 'lift_off', n: 'Help him up', icon: '🧍', kinds: ['thing:camilla'], reach: 22, dur: 3, check: (a, tg) => (occupant(a.scene, tg.o) ? null : 'Nobody is on the cot.'), done: (a, tg) => { const q = occupant(a.scene, tg.o); if (q) { q.onCot = null; q.prone = false; tg.o.d.occ = null; } return null; } });
  /** Per frame: carried people move with their bearers (who are slowed); cots heal their patients. */
  C.sickTick = function (s, dt) {
    const gm = dt * (G().minPerSec || 1.5);
    for (const q of s.actors) {
      if (q.carried) { const c = q.carried; if (c.a.dead || c.b.dead) { q.carried = null; c.a.carrying = c.b.carrying = null; q.prone = false; continue; } q.x = (c.a.x + c.b.x) / 2; q.y = (c.a.y + c.b.y) / 2 - 2; q.moving = false; q.prone = true; }
      if (q.onCot) { const cot = C.thingById(s, q.onCot); if (!cot) { q.onCot = null; q.prone = false; continue; } q.x = cot.x; q.y = cot.y - 3; q.prone = true; q.moving = false; q.order = null; const p = q.p; p.hp = Math.min(p.maxHp, p.hp + TUNE.cot.healPerMin * gm); p.needs.energy = Math.min(100, p.needs.energy + 0.1 * gm); if (p.bleed > 0) p.bleed = Math.max(0, p.bleed - TUNE.cot.bleedStop * gm); if (p.ill && rnd() < TUNE.cot.feverCure * gm * 0.1) p.ill = null; if (p.hp >= p.maxHp * 0.92 && !p.ill) { q.onCot = null; q.prone = false; cot.d.occ = null; C.say(q, 'Ya estoy bien.', '#1d5b2a', 3); } }
    }
  };
  // bearers are slow; the very hurt barely walk (read by climate.js speedMod via these flags)
  const sm = C.speedMod; C.speedMod = function (a) { let k = sm ? sm(a) : 1; if (a.carrying && a.carrying.carried) k *= TUNE.carrySpeed; if (a.p.hp < a.p.maxHp * TUNE.downedHp && !a.carried) k *= 0.35; return k; };
  // macros: "the nearest hurt person"
  const resolve = C.resolveRef; C.resolveRef = function (s, a, ref, o) { if (ref.kind === 'actor' && ref.filter === 'hurt') { let best = null, bd = 1e9; for (const q of s.actors) { if (q === a || q.dead || !(q.side === 'rebel' || q.isPlayer) || !isHurt(q)) continue; const d = Math.hypot(q.x - a.x, q.y - a.y); if (d < bd) { bd = d; best = q; } } return best ? { kind: 'actor', o: best, x: best.x, y: best.y } : null; } return resolve(s, a, ref, o); };
  C.PRESETS.push({ id: 'p_sickcall', name: 'Sick call', home: true, repeat: 3, steps: [{ t: 'verb', v: 'treat', tgt: { kind: 'actor', filter: 'hurt', mode: 'nearest' } }] });

  // ------------------------------------------------------------------------------------------------------------------
  // GOVERNING AS PLACES (the steps themselves live in govern.js)
  // ------------------------------------------------------------------------------------------------------------------
  const PLACES = [['ayuntamiento', 'The land'], ['policia', 'The old regime'], ['radio', 'The press and the vote'], ['banco', 'The utilities'], ['univ', 'Schools and the Church'], ['cuartel', 'The army and the militias'], ['casino', 'Women and race'], ['almacen', 'Trade and oil']];
  C.GOV_PLACES = PLACES;
  /** Put a petition banner at each building where an undecided matter waits (idempotent; call when governing begins and on entering Havana). */
  C.govPlaces = function (s) {
    const g = G(); if (!g.gov || !g.gov.done || !s || s.sid !== 'habana') return;
    PLACES.forEach(([key, label], i) => { if (g.gov.done[i]) return; if (C.thingsOf(s, 'petition').some((t) => t.d.step === i)) return; const b = s.blds.find((q) => q.key === key) || s.blds.find((q) => q.tag === (C.BLD[key] || {}).tag); if (!b) return; const d = s.doorPx(b); C.addThing(s, 'petition', d.x + 14, d.y + 12, { step: i, label }); });
    for (const t of C.thingsOf(s, 'petition')) if (g.gov.done[t.d.step]) C.removeThing(s, t);
  };
  const ae = C.afterEnter; C.afterEnter = function (s) { if (ae) ae(s); if (C.govPlaces) C.govPlaces(s); };
  C.registerVerb({ id: 'hold_audience', n: 'Hold audience on this matter', icon: '⚖', kinds: ['thing:petition'], reach: 40, dur: 8,
    check: (a, tg) => (!G().gov ? 'There is no government yet.' : G().gov.done[tg.o.d.step] ? 'Already decided.' : null),
    done: (a, tg) => { C.govDecide(tg.o.d.step); return null; } });
})();
