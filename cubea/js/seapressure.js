/* CUBEA — seapressure.js : THE CROSSING HAPPENS BECAUSE OF THE BOAT, NOT THE CALENDAR.

   The Granma carries about seven times the people she was built for. Instead of firing "man overboard" on day 3 and "storm" on day 4,
   the crossing keeps a few hidden PRESSURES and rolls its events against them every second:
     load    people aboard against the boat's real capacity (12)            → she rides low, ships water, men are packed at the rail
     waves   a slow swell with random norther episodes                       → spray, rolling, sickness, bilge
     sick    the share of the men who are seasick (rises with waves × load)   → men at the rail, energy drain, falls
     bilge   water in the hull: grows with load × waves², falls when you bail → the leak, then swamped stores
     fear    nerves: load, waves and the men lost so far                      → the ration fight
   Who falls overboard is a person, weighted by being seasick, standing at the rail, exhausted, and by character (stoics and the brave
   hold on). The plane on day 5 stays as one fixed beat so the story keeps its spine.
   Each pressure is SHOWN: the hull sits lower and foams at the sides with load, spray flies with the waves, the bilge spreads as a
   puddle on the deck, sick men hang at the rail, and a small gauge strip (⚖ 🌊 💧 🤢) summarises it. Choices feed back into the
   model: bailing lowers the bilge, throwing cargo lowers the load, heaving to calms the sea, lemons settle stomachs.
   TUNE: numbers in the TUNE block.
*/
(function () {
  'use strict';
  const C = window.C, G = () => C.G, clamp = C.clamp;
  const rnd = Math.random;
  const TUNE = {
    cap: 12,
    swell: { base: 0.22, wobble: 0.14, stormChance: 0.0025, stormLen: [26, 42], stormAdd: 0.62, rise: 0.25, fall: 0.12 },
    sick: { rise: 0.016, load: 0.12, fall: 0.012, calm: 0.3 },
    bilge: { base: 0.0012, wave2: 0.016, load: 0.0035, crew: 0.0025 },
    over: { base: 0.0004, k: 0.13, cooldown: 22, roster: 0.15, rail: 6, stoic: 0.6 },
    cards: { gap: 14, sickAt: 0.35, leakAt: 0.45, floodAt: 1.0, stormAt: 0.7, planeDay: 5, rationsDay: 6, rationsFood: 0.3 },
    flood: { ammo: 0.35, food: 0.3 },
  };
  C.SEA_TUNE = TUNE;
  const party = () => C.squadPeople();

  function init(S) { S.pr = { waves: 0.2, sick: 0, bilge: 0, load: 0, fear: 0, stormT: 0, evCd: 6, overCd: 20, calmUntil: 0, relief: 0, seed: rnd() * 100, lost: 0 }; }
  const UNNAMED = 54;                                                      // the story's 82 men: the 28 you can name, and the rest
const people = () => (C.seaPeopleOverride || party().filter((p) => p.status === 'alive').length + 1 + UNNAMED);   // (override: test harness)
  C.seaLoad = () => clamp(Math.log2(Math.max(1, people() / TUNE.cap)) / 3, 0, 1.3);
  C.seaWhy = (P) => `${P.load > 0.6 ? people() + ' men on a boat built for ' + TUNE.cap + ', ' : ''}${P.waves > 0.6 ? 'the sea running high' : P.waves > 0.35 ? 'a lumpy sea' : 'calm water'}.`;

  C.seaPressure = function (dt, day) {
    const g = G(), S = g.sea, s = g.scene; if (!S.pr) init(S); const P = S.pr, V = TUNE;
    P.load = C.seaLoad(); P.evCd -= dt; P.overCd -= dt;
    // the sea
    if (P.stormT > 0) P.stormT -= dt; else if (S.t > 20 && rnd() < V.swell.stormChance * dt * 10 * (day >= 2 && day <= 4 ? 1.6 : 1)) P.stormT = V.swell.stormLen[0] + rnd() * (V.swell.stormLen[1] - V.swell.stormLen[0]);
    let tgt = V.swell.base + V.swell.wobble * Math.sin(S.t / 17 + P.seed) * Math.sin(S.t / 41 + P.seed * 2) + (P.stormT > 0 ? V.swell.stormAdd : 0); if (S.t < P.calmUntil) tgt *= 0.55;
    P.waves += (tgt - P.waves) * Math.min(1, dt * (tgt > P.waves ? V.swell.rise : V.swell.fall)); P.waves = clamp(P.waves, 0, 1);
    g.weather.target = clamp(P.waves * 1.1, 0, 1);
    // stomachs
    const sk = V.sick; P.sick = clamp(P.sick + dt * (P.waves > sk.calm ? sk.rise * P.waves * (sk.load + P.load) : -sk.fall) - P.relief * dt, 0, 1); P.relief = Math.max(0, P.relief - dt * 0.02);
    // water in the hull
    const b = V.bilge; P.bilge = clamp(P.bilge + dt * (b.base + b.wave2 * P.waves * P.waves * (0.2 + 1.2 * P.load) + b.load * P.load - b.crew * (people() > 40 ? 0.5 : 1)), 0, 1.3);
    // nerves
    P.fear = clamp(0.5 * P.load * P.waves + 0.3 * P.sick + 0.4 * P.lost / 3 + 0.2 * P.bilge, 0, 1);
    // people feel it
    const deck = s.actors.filter((a) => a.deck && !a.isPlayer && !a.dead);
    for (const a of deck) { const p = a.p; if (p._sr === undefined) p._sr = rnd(); const res = (p.traits.includes('stoic') ? 0.25 : 0) + (p.traits.includes('brave') ? 0.1 : 0); const was = a.seaSick; a.seaSick = p._sr + res < P.sick * 1.15; if (a.seaSick) { p.needs.energy = clamp(p.needs.energy - dt * 0.35, 0, 100); if (!was || (rnd() < dt * 0.1 && !a.sbub)) a.sbub = { text: 'seasick', key: 'sick', t: 4 }; } }
    // events
    const F = S.fired, K = V.cards; if (P.evCd > 0 || (C.situation && C.situation.active)) return;
    const fire = (id, arg) => { F[id] = true; P.evCd = K.gap; C.SEA_EVENTS[id].run(arg); };
    if (!F.sick && P.sick > K.sickAt) return fire('sick');
    if (!F.leak && P.bilge > K.leakAt) return fire('leak');
    if (P.bilge > K.floodAt && !P.flooded) { P.flooded = true; P.bilge = 0.7; const r = g.res; const a0 = r.ammo, f0 = r.food; r.ammo = Math.floor(r.ammo * (1 - V.flood.ammo)); r.food = Math.floor(r.food * (1 - V.flood.food)); C.log(`The bilge floods the hold: ${a0 - r.ammo} cartridges and ${f0 - r.food} food are ruined. ${C.seaWhy(P)}`, 'bad'); P.evCd = K.gap; return; }
    if (!F.storm && P.stormT > 0 && P.waves > K.stormAt) return fire('storm');
    if (!F.plane && day >= K.planeDay) return fire('plane');
    if (!F.rations && day >= K.rationsDay && (g.res.food < people() * K.rationsFood || P.fear > 0.6)) return fire('rations');
    // somebody goes over the side
    if (P.overCd <= 0) {
      const O = V.over; const rate = O.base + O.k * P.load * P.waves * (0.4 + P.sick) * (0.5 + P.waves); if (rnd() > rate * dt) return;
      let tot = 0; const w = deck.map((a) => { const p = a.p; let x = 0.3 + (a.seaSick ? 1.5 : 0) + (Math.abs(a.deck.w) > O.rail ? 1.2 : 0) + (p.needs.energy < 40 ? 0.6 : 0); if (p.roster) x *= O.roster; if (p.traits.includes('stoic') || p.traits.includes('brave')) x *= O.stoic; tot += x; return x; });
      if (!tot) return; let r = rnd() * tot, who = deck[0]; for (let i = 0; i < deck.length; i++) { r -= w[i]; if (r <= 0) { who = deck[i]; break; } }
      P.overCd = O.cooldown; P.evCd = K.gap; S.why = C.seaWhy(P); F.over = true; C.SEA_EVENTS.over.run(who.p); S.why = null; P.lost += 0.5;
    }
  };

  // choices feed back into the model; the reason is added to the overboard headline
  C.seaCardHook = function (c) {
    const S = G().sea, P = S && S.pr; if (!P) return;
    const wrap = (i, f) => { const ch = c.choices[i]; if (!ch) return; const old = ch.fn; ch.fn = () => { try { f(); } catch (e) { console.error(e); } return old && old(); }; };
    if (c.title === 'Man overboard!' && S.why) c.headline = (c.headline || '') + ' ' + S.why;
    if (c.title === 'She is taking water!') { wrap(0, () => { P.bilge = Math.max(0, P.bilge - 0.45); }); wrap(1, () => { P.bilge = Math.max(0, P.bilge - 0.35); }); }
    if (c.title === 'Storm!') { wrap(0, () => { P.calmUntil = S.t + 40; P.stormT = Math.min(P.stormT, 6); }); }
    if (c.title === 'The sea takes them') { wrap(0, () => { P.relief += 0.3; }); wrap(1, () => { P.fear = Math.max(0, P.fear - 0.1); }); }
    if (c.title === 'Man overboard!') { for (let i = 0; i < 2; i++) wrap(i, () => { P.lost += 0; }); }
  };

  // sick men go to the rail
  const dau = C.deckActorUpdate; C.deckActorUpdate = function (s, a, dt) { if (a.seaSick && a.deck && Math.random() < dt * 0.4) { const d = a.deck; d.tw = (d.w >= 0 ? 1 : -1) * 7.6; d.tu = d.u; d.t = 3 + Math.random() * 3; } return dau.call(this, s, a, dt); };

  // ---------------------------------------------------------------------------------------------------------------- drawing
  C.drawSea = function (ctx, s, cam, W, H, z) {
    const g = G(), S = g.sea; if (!S || !S.active || S.phase !== 'cross' || !S.pr) return; const P = S.pr, v = S.veh, t = performance.now() / 1000;
    ctx.save();
    // hull sits lower and foams along both sides as the load grows
    const l = 32 * z, hw = 11 * z; const a = C.toScreen(cam, v.x, v.y); const foam = clamp(0.15 + P.load * 0.6 + P.waves * 0.4, 0, 1);
    ctx.strokeStyle = `rgba(235,245,255,${0.25 + 0.5 * foam})`; ctx.lineWidth = Math.max(1.5, (1 + 3 * P.load) * z * 0.5); ctx.setLineDash([5 * z, 4 * z]); ctx.lineDashOffset = -t * 14 * z;
    for (const sd of [-1, 1]) { ctx.beginPath(); ctx.moveTo(a.x + sd * (hw + 1.5 * z * (1 - P.load * 0.6)), a.y - l); ctx.lineTo(a.x + sd * (hw + 1.5 * z * (1 - P.load * 0.6)), a.y + l); ctx.stroke(); }
    ctx.setLineDash([]);
    // spray: streaks that fly off the bow
    const n = Math.floor(P.waves * 26); ctx.fillStyle = 'rgba(240,250,255,.75)';
    for (let i = 0; i < n; i++) { const k = (t * (0.7 + (i % 5) * 0.12) + i * 0.37) % 1; const side = i % 2 ? 1 : -1; const x = a.x + side * (hw * 0.6 + k * 26 * z * (0.5 + (i % 3) * 0.3)), y = a.y - l + 6 * z - k * 8 * z + Math.sin(i * 7.1) * 8 * z; ctx.globalAlpha = (1 - k) * 0.8; ctx.fillRect(x, y, 1.6 * z, 1.6 * z); }
    ctx.globalAlpha = 1;
    // the bilge as a puddle on the deck
    if (P.bilge > 0.04) { const r = (3 + P.bilge * 11) * z; ctx.fillStyle = `rgba(40,95,140,${0.35 + 0.3 * P.bilge})`; const p = C.toScreen(cam, v.x, v.y + 16); ctx.beginPath(); ctx.ellipse(p.x, p.y, r * 0.8, r * 1.5, 0, 0, 6.3); ctx.fill(); }
    ctx.restore();
  };
  // gauge strip
  let hud = null;
  setInterval(() => {
    const g = G(), S = g && g.sea; const on = !!(S && S.active && S.phase === 'cross' && S.pr);
    if (!on) { if (hud) hud.style.display = 'none'; return; }
    if (!hud) { hud = document.createElement('div'); hud.id = 'seahud'; hud.className = 'panel'; hud.style.cssText = 'left:8px;top:284px;padding:7px 10px;z-index:5;font-size:11px;display:flex;flex-direction:column;gap:4px;min-width:150px;pointer-events:none'; document.body.appendChild(hud); }
    const P = S.pr, row = (ic, name, v, col) => `<div style="display:flex;align-items:center;gap:6px"><span style="width:14px">${ic}</span><span style="width:46px;color:var(--mute)">${name}</span><span style="flex:1;height:5px;background:rgba(255,255,255,.12);border-radius:3px;overflow:hidden"><i style="display:block;height:100%;width:${Math.round(clamp(v, 0, 1) * 100)}%;background:${v > 0.7 ? '#e0603f' : col}"></i></span></div>`;
    hud.innerHTML = row('⚖', 'Load', P.load / 1.0, '#e6b84e') + row('🌊', 'Sea', P.waves, '#5b86e0') + row('💧', 'Bilge', P.bilge, '#6fb6d8') + row('🤢', 'Sick', P.sick, '#8fc46a') + `<div style="color:var(--mute);margin-top:2px">${people()} aboard, built for ${TUNE.cap}</div>`;
    hud.style.display = 'flex';
  }, 300);
})();
