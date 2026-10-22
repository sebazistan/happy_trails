/* CUBEA — workshop.js : MAKING THINGS, FEEDING PEOPLE, AND TRADING FOR FOOD — all at a place, by hand.

   Three things that used to be menu rows are now things in the camp and conversations on the road.

   1. WORKBENCHES (not "craft" buttons). A bench is a thing you build on the ground and a person works at:
        banco   (reloading bench)   cartridges, Molotov cocktails
        fragua  (forge)             dynamite, hand grenades — burns firewood, makes noise, and can go wrong
        prensa  (printing press)    pamphlets
        cosedora (sewing table)     bandages from cloth
        marmita (cook pot)          cooked rations (see 2)
      Verb "Make…" on a bench lists what it can make, what that costs and whether you have it. Skilled hands (mechanics,
      blacksmiths, seamstresses, factory workers) are faster and safer. "Scavenge" is a verb on the ground and on wrecks.
   2. THE KITCHEN. A cook pot over a lit fire: "Cook rations" turns raw food into hot rations (a day's worth, ready for about
      five hours). At mealtime the people near the pot are served from it — hotter, tastier and cheaper than the pack. "Ladle"
      serves a particular person (favouritism and fairness are choices). The rest eat from their packs and grumble.
   3. TRADE. Face to face on the road: pay, take it on a vale, ask for it as a gift, barter something you carry (a hoe, seed,
      medicine, a hammock…), or demand it at gunpoint. The forage stance opens with a spoken offer; the seller answers in
      character before anything changes hands.

   PUBLIC API   C.potServe(person, portion) used by inventory.js mealTime;  C.tradeFood(a, seller, mode, item);
   TUNE: all numbers in the TUNE block.
*/
(function () {
  'use strict';
  const C = window.C, G = () => C.G, clamp = C.clamp;
  const rnd = Math.random;

  // TUNE ---------------------------------------------------------------------------------------------------------------
  const TUNE = {
    potServings: 8, potLife: 5,          // servings per batch; hours the pot stays hot
    hotBonus: 1.15, hotHope: 1.5,        // a served hot meal restores this much more and lifts the spirits
    potReach: 150,                       // px from the pot to be served at mealtime
    accident: { skilled: 0.04, novice: 0.12 }, blast: 26,
    barter: { hoe: 8, seed: 1.2, bucket: 4, axe: 8, med: 6, hammock: 4, primer: 1, snare: 1.5, line: 1, tools: 10, ammo: 0.5, pamph: 0.1, feed: 1 },   // food each is worth
    scavenge: { dur: 30, scrap: [1, 3], cloth: [0, 2] },
  };
  C.WORK_TUNE = TUNE;
  const inv = (a) => C.initInv(a.p);
  const gr = () => G().res;
  const SK = { banco: ['mecanico', 'chofer', 'obrerofab', 'herrero'], fragua: ['herrero', 'mecanico', 'obrerofab'], prensa: ['tabaquero', 'periodista', 'obrerofab', 'sindicalista'], cosedora: ['costurera', 'sastre', 'partera', 'medico'], marmita: ['cocinero', 'ama', 'panadero', 'lavandera', 'domestica'] };
  const skilled = (a, st) => (SK[st] || []).includes(a.p.occ) || (st === 'cosedora' && a.p.roster === 'che');

  // ------------------------------------------------------------------------------------------------------------------
  // THE BENCHES (things)
  // ------------------------------------------------------------------------------------------------------------------
  const wood = 'rgb(122,92,60)', woodD = 'rgb(84,62,40)', iron = 'rgb(70,70,74)';
  const sh = (c, x, y, r) => { c.fillStyle = 'rgba(0,0,0,.22)'; c.beginPath(); c.ellipse(x, y + 2, r, r * 0.35, 0, 0, 6.3); c.fill(); };
  Object.assign(C.THINGS, {
    banco: { n: 'Reloading bench', draw(c, t) { sh(c, t.x, t.y, 9); c.fillStyle = woodD; c.fillRect(t.x - 8, t.y - 1, 1.6, 5); c.fillRect(t.x + 6.4, t.y - 1, 1.6, 5); c.fillStyle = wood; c.fillRect(t.x - 9, t.y - 4, 18, 3.2); c.fillStyle = 'rgb(176,150,80)'; for (let i = 0; i < 4; i++) c.fillRect(t.x - 7 + i * 3.4, t.y - 7, 1.6, 3); c.fillStyle = iron; c.fillRect(t.x + 3, t.y - 7, 4, 3); } },
    fragua: { n: 'Forge', draw(c, t, time) { sh(c, t.x, t.y, 9); c.fillStyle = 'rgb(96,90,84)'; c.fillRect(t.x - 8, t.y - 6, 16, 9); c.fillStyle = 'rgb(40,36,34)'; c.fillRect(t.x - 5, t.y - 4, 10, 4); if (t.d.hot > G().min) { c.fillStyle = 'rgba(255,150,40,.95)'; c.fillRect(t.x - 4, t.y - 3.4, 8, 2.4); } c.fillStyle = iron; c.fillRect(t.x + 9, t.y - 3, 4, 5); c.fillRect(t.x + 8, t.y - 4.5, 6, 1.6); } },
    prensa: { n: 'Printing press', draw(c, t) { sh(c, t.x, t.y, 9); c.fillStyle = iron; c.fillRect(t.x - 7, t.y - 8, 14, 10); c.fillStyle = 'rgb(210,200,170)'; c.fillRect(t.x - 5, t.y - 6, 10, 4); c.fillStyle = 'rgb(180,40,40)'; c.fillRect(t.x + 4, t.y - 11, 2, 5); c.fillStyle = woodD; c.fillRect(t.x - 8, t.y + 2, 16, 2); } },
    cosedora: { n: 'Sewing table', draw(c, t) { sh(c, t.x, t.y, 8); c.fillStyle = woodD; c.fillRect(t.x - 7, t.y - 1, 1.5, 5); c.fillRect(t.x + 5.5, t.y - 1, 1.5, 5); c.fillStyle = wood; c.fillRect(t.x - 8, t.y - 4, 16, 3); c.fillStyle = 'rgb(236,230,214)'; c.fillRect(t.x - 5, t.y - 6, 8, 2.4); c.fillStyle = 'rgb(200,60,50)'; c.fillRect(t.x + 4, t.y - 6.5, 2.4, 2.4); } },
    marmita: { n: 'Cook pot', draw(c, t) { sh(c, t.x, t.y, 7); c.fillStyle = 'rgb(46,44,44)'; c.beginPath(); c.ellipse(t.x, t.y - 3, 6, 4.6, 0, 0, 6.3); c.fill(); c.fillStyle = (t.d.serv > 0) ? 'rgb(214,170,90)' : 'rgb(90,84,80)'; c.beginPath(); c.ellipse(t.x, t.y - 4, 4.6, 2.8, 0, 0, 6.3); c.fill(); c.strokeStyle = iron; c.lineWidth = 1; c.beginPath(); c.arc(t.x, t.y - 3, 7.5, Math.PI, 0); c.stroke(); if (t.d.serv > 0) { c.fillStyle = 'rgba(240,240,240,.35)'; c.beginPath(); c.arc(t.x + Math.sin(G().time * 3) * 1.2, t.y - 10, 2.4, 0, 6.3); c.fill(); } } },
  });
  const STATION_COST = { banco: { scrap: 4 }, fragua: { scrap: 8, lena: 4 }, prensa: { scrap: 14, money: 30 }, cosedora: { scrap: 2, cloth: 2 }, marmita: { scrap: 3 } };

  C.registerVerb({ id: 'build_station', n: 'Set up a workstation', icon: '🛠', kinds: ['ground'], reach: 16, dur: 14,
    variants: () => Object.keys(STATION_COST).map((k) => ({ param: { st: k }, label: `Set up ${C.THINGS[k].n.toLowerCase()} (${Object.entries(STATION_COST[k]).map(([r, n]) => n + ' ' + r).join(', ')})` })),
    check: (a, tg, p) => { if (!p) return null; const need = STATION_COST[p.st], r = gr(); for (const k in need) if ((r[k] || 0) < need[k]) return `Needs ${need[k]} ${k}.`; if (C.nearestThing(a.scene, tg.x, tg.y, null, 14)) return 'Something is in the way.'; return null; },
    done: (a, tg, p) => { const need = STATION_COST[p.st], r = gr(); for (const k in need) r[k] -= need[k]; C.addThing(a.scene, p.st, tg.x, tg.y, p.st === 'marmita' ? { serv: 0 } : {}); C.log(`${C.tagName(a.p)} set up a ${C.THINGS[p.st].n.toLowerCase()}.`, 'good'); return null; } });
  C.registerVerb({ id: 'strike_station', n: 'Take it down', icon: '📦', kinds: ['thing:banco', 'thing:fragua', 'thing:prensa', 'thing:cosedora', 'thing:marmita'], reach: 14, dur: 6,
    done: (a, tg) => { gr().scrap += Math.floor((STATION_COST[tg.tk].scrap || 2) / 2); C.removeThing(a.scene, tg.o); return null; } });

  // ------------------------------------------------------------------------------------------------------------------
  // MAKING THINGS
  // ------------------------------------------------------------------------------------------------------------------
  const MAKE = [
    { id: 'ammo', st: 'banco', n: 'Reload 10 cartridges', cost: { scrap: 2, money: 3 }, make: { ammo: 10 }, dur: 18 },
    { id: 'molotov', st: 'banco', n: 'Fill 2 Molotov cocktails', cost: { cloth: 1, money: 2 }, make: { molo: 2 }, dur: 12, risk: 0.5 },
    { id: 'dyn', st: 'fragua', n: 'Make a dynamite charge', cost: { scrap: 3, money: 5 }, make: { dyn: 1 }, dur: 22, fire: true, risk: 1.4 },
    { id: 'grenade', st: 'fragua', n: 'Make 2 hand grenades', cost: { scrap: 3, money: 4 }, make: { gren: 2 }, dur: 24, fire: true, risk: 1 },
    { id: 'pamph', st: 'prensa', n: 'Print 10 pamphlets', cost: { money: 3 }, make: { pamph: 10 }, dur: 20 },
    { id: 'bandage', st: 'cosedora', n: 'Cut and boil bandages (1 medicine)', cost: { cloth: 2 }, make: { med: 1 }, dur: 12 },
  ];
  C.MAKE = MAKE;
  const label = (k) => ({ scrap: 'scrap', cloth: 'cloth', money: 'pesos', ammo: 'cartridges', molo: 'molotovs', dyn: 'dynamite', gren: 'grenades', pamph: 'pamphlets', med: 'medicine', food: 'food', lena: 'firewood' }[k] || k);
  C.registerVerb({ id: 'make', n: 'Make…', icon: '🔨', kinds: ['thing:banco', 'thing:fragua', 'thing:prensa', 'thing:cosedora'], reach: 16,
    variants: (tg) => MAKE.filter((m) => m.st === tg.tk).map((m) => ({ param: { id: m.id }, label: `${m.n} (${Object.entries(m.cost).map(([k, n]) => n + ' ' + label(k)).join(', ')})` })),
    dur: (a, tg, p) => { const m = MAKE.find((x) => x.id === p.id); return m.dur * (skilled(a, m.st) ? 0.65 : 1.15); },
    check: (a, tg, p) => { if (!p) return null; const m = MAKE.find((x) => x.id === p.id), r = gr(); for (const k in m.cost) if ((r[k] || 0) < m.cost[k]) return `Needs ${m.cost[k]} ${label(k)} (have ${Math.floor(r[k] || 0)}).`; if (m.fire && (r.lena || 0) < 1) return 'The forge needs firewood.'; return null; },
    done: (a, tg, p) => {
      const m = MAKE.find((x) => x.id === p.id), r = gr(), s = a.scene; for (const k in m.cost) r[k] -= m.cost[k]; if (m.fire) { r.lena -= 1; tg.o.d.hot = G().min + 90; }
      if (m.risk) { const sk = skilled(a, m.st); const ch = (sk ? TUNE.accident.skilled : TUNE.accident.novice) * m.risk * (a.p.needs.energy < 25 ? 1.8 : 1); if (rnd() < ch) { C.say(a, '¡Cuidado!', '#7a1d1d', 2); C.explode(s, tg.x, tg.y, TUNE.blast, 22, null, {}); C.alertScene(s, tg.x, tg.y, 'explosion'); C.log(`An accident at the ${C.THINGS[m.st].n.toLowerCase()} — ${C.tagName(a.p)} is hurt and the whole camp heard it.`, 'bad'); return 'It went wrong.'; } }
      for (const k in m.make) r[k] = (r[k] || 0) + m.make[k]; C.log(`${C.tagName(a.p)}: ${m.n.toLowerCase()}.`, 'good'); if (a.p.exp !== undefined) a.p.exp = Math.min(100, a.p.exp + 0.3); return null; } });

  // SCAVENGING
  C.registerVerb({ id: 'scavenge', n: 'Scavenge scrap and cloth', icon: '🧰', kinds: ['ground', 'vehicle'], reach: 18, dur: TUNE.scavenge.dur,
    check: (a, tg) => (tg.kind === 'vehicle' && !tg.o.wreck ? 'Only wrecks may be stripped.' : null),
    done: (a, tg) => { const r = gr(), wreck = tg.kind === 'vehicle'; const s = tg.kind === 'ground' ? 1 : 3; const sc = TUNE.scavenge.scrap, cl = TUNE.scavenge.cloth; const n1 = Math.round((sc[0] + rnd() * (sc[1] - sc[0])) * s), n2 = Math.round((cl[0] + rnd() * (cl[1] - cl[0])) * (wreck ? 0.5 : 1)); r.scrap += n1; r.cloth += n2; if (wreck) tg.o.gone = true; C.log(`${C.tagName(a.p)} found ${n1} scrap${n2 ? ' and ' + n2 + ' cloth' : ''}.`, 'info'); return null; } });

  // ------------------------------------------------------------------------------------------------------------------
  // THE KITCHEN
  // ------------------------------------------------------------------------------------------------------------------
  const nearLit = (s, t) => C.thingsOf(s, 'fire').find((f) => f.d.lit && Math.hypot(f.x - t.x, f.y - t.y) < 45);
  C.registerVerb({ id: 'cook', n: 'Cook rations', icon: '🍲', kinds: ['thing:marmita'], reach: 18, dur: 20,
    check: (a, tg) => { const r = gr(); if (!nearLit(a.scene, tg.o)) return 'Needs a lit fire right beside the pot.'; if (r.food < 6) return 'Needs 6 rations of raw food.'; if (tg.o.d.serv > 0) return 'There is still food in the pot.'; return null; },
    done: (a, tg) => { const r = gr(); r.food -= 6; tg.o.d.serv = TUNE.potServings; tg.o.d.until = G().min + TUNE.potLife * 60; C.log(`${C.tagName(a.p)} cooked a pot of food — ${TUNE.potServings} servings, hot for about ${TUNE.potLife} hours.`, 'good'); return null; } });
  C.registerVerb({ id: 'ladle', n: 'Serve a ration', icon: '🥄', kinds: ['actor'], reach: 30, dur: 3,
    check: (a, tg) => { const pot = C.thingsOf(a.scene, 'marmita').find((t) => t.d.serv > 0 && t.d.until > G().min && Math.hypot(t.x - a.x, t.y - a.y) < 60); if (!pot) return 'No hot pot beside you.'; if (tg.o.p.needs.food > 92) return 'Not hungry.'; return null; },
    done: (a, tg) => { const pot = C.thingsOf(a.scene, 'marmita').find((t) => t.d.serv > 0 && t.d.until > G().min && Math.hypot(t.x - a.x, t.y - a.y) < 60); if (!pot) return 'The pot is cold.'; pot.d.serv--; serve(tg.o.p, 1); C.say(tg.o, 'Gracias.', '#1d5b2a', 2); return null; } });
  function serve(p, portion) { p.needs.food = clamp(p.needs.food + 34 * portion * TUNE.hotBonus, 0, 100); p.needs.hope = clamp(p.needs.hope + TUNE.hotHope * portion, 0, 100); p.hotFed = G().day; }
  /** Called from inventory.js mealTime: serve this person from a hot pot if they are close to one. */
  C.potServe = function (p, portion) {
    const a = p.actor, g = G(); if (!a || a.scene !== g.scene) return false;
    const pot = C.thingsOf(g.scene, 'marmita').find((t) => t.d.serv > 0 && t.d.until > g.min && Math.hypot(t.x - a.x, t.y - a.y) < TUNE.potReach); if (!pot) return false;
    pot.d.serv--; serve(p, portion); return true;
  };
  /** The first time the Sierra camp is entered: a kitchen corner, a tool rack, a rack of food, a woodpile and a bench. */
  C.seedCamp = function (s) {
    if (s.sid !== 'sierra' || s.seeded || !s.camp) return; s.seeded = true; const cx = s.camp.x * C.T, cy = s.camp.y * C.T + 60;
    C.addThing(s, 'toolrack', cx - 60, cy, {}); C.addThing(s, 'barbacoa', cx - 30, cy + 8, { fill: 0.5 }); C.addThing(s, 'woodpile', cx + 6, cy + 10, { n: 10 });
    C.addThing(s, 'fire', cx + 44, cy + 6, { lit: false }); C.addThing(s, 'marmita', cx + 52, cy + 6, { serv: 0 }); C.addThing(s, 'banco', cx + 90, cy + 14, {}); C.addThing(s, 'pizarra', cx - 90, cy + 20, {});
  };
  // pots go cold
  setInterval(() => { const g = G(); if (!g || !g.scene || !g.scene.things) return; for (const t of g.scene.things) if (t.k === 'marmita' && t.d.serv > 0 && t.d.until <= g.min) { t.d.serv = 0; C.log('A pot of food went cold and unused.', 'warn'); } }, 4000);

  // ------------------------------------------------------------------------------------------------------------------
  // TRADE (face to face)
  // ------------------------------------------------------------------------------------------------------------------
  const sellerOK = (tg) => tg.o.side === 'civ' && !tg.o.isPlayer && !tg.o.dead;
  C.tradeFood = function (a, seller, mode, item) {
    const g = G(), p = seller.p; const qty = Math.min(12, Math.max(3, Math.floor(p.needs.food / 8) - (p.cls === 0 ? 2 : 0)));
    if (mode === 'barter') { const v = TUNE.barter[item] || 1; const got = Math.max(1, Math.round(v * (p.cls <= 1 ? 1.2 : 1))); C.invTake(a.p, item, 1); g.res.food += got; p.needs.food = clamp(p.needs.food - got * 0.6, 0, 100); p.needs.hope = clamp(p.needs.hope + 2, 0, 100); p.sellCd = g.min + 1440; C.say(seller, got >= 4 ? '¡Esto sí me sirve!' : 'Bueno, trato hecho.', '#1d4a1d', 2.6); C.log(`${C.tagName(p)} gave ${got} food for ${C.ITEMS[item].n.toLowerCase()}.`, 'good'); C.addEvent({ type: 'purchase', victim: p, perpSide: 'rebel', positive: true, sev: 8, pub: 0, x: seller.x, y: seller.y, scene: a.scene, settlement: a.scene.sid, text: `${C.tagName(p)} traded food with the rebels`, memText: 'The rebels traded fairly with us' }); return got; }
    if (mode === 'gift') { const ok = p.trueStance + (p.traits.includes('generous') ? 25 : 0) + rnd() * 40 > 45; if (ok) { g.res.food += qty; p.needs.food = clamp(p.needs.food - qty * 0.5, 0, 100); C.say(seller, 'Llévese lo que haga falta.', '#1d4a1d', 2.6); p.trueStance += 1; } else { C.say(seller, 'Aquí no sobra nada, compañero.', '#7a1d1d', 2.6); } return ok ? qty : 0; }
    C.forageTransactionDirect(seller, mode, qty); return qty;       // pay | vale | take (gunpoint) through the existing policy code
  };
  C.registerVerb({ id: 'trade', n: 'Ask for food', icon: '🧺', kinds: ['actor'], reach: 26, dur: 4,
    variants: (tg) => { if (!tg.o || !tg.o.p || tg.o.side !== 'civ') return []; const out = [{ param: { mode: 'pay' }, label: 'Offer to pay' }, { param: { mode: 'vale' }, label: 'Take it on a vale (IOU)' }, { param: { mode: 'gift' }, label: 'Ask for it as a gift' }]; const me = C.actorsForVerb()[0]; if (me) for (const k in TUNE.barter) if ((inv(me)[k] || 0) > 0) out.push({ param: { mode: 'barter', item: k }, label: `Trade ${C.ITEMS[k].n.toLowerCase()}` }); out.push({ param: { mode: 'take' }, label: 'Demand it at gunpoint' }); return out; },
    check: (a, tg, p) => { if (!sellerOK(tg)) return 'Not someone you can trade with.'; if (!p) return null; const q = tg.o.p; if (q.needs.food < 25) return 'They have little to spare.'; if (q.sellCd > G().min && p.mode !== 'gift') return 'They already sold you something today.'; if (p.mode === 'pay' && G().res.money < 5) return 'You have no pesos to speak of.'; if (p.mode === 'take' && !(a.weaponOut || a.weapon)) return 'You have no weapon to show.'; if (p.mode === 'barter' && !((inv(a)[p.item] || 0) > 0)) return `You carry no ${C.ITEMS[p.item].n.toLowerCase()}.`; return null; },
    start: (a, tg, p) => { C.say(a, p.mode === 'take' ? '¡Lo que tenga de comer, ya!' : p.mode === 'barter' ? 'Le cambio esto por comida.' : p.mode === 'gift' ? '¿Nos puede ayudar con algo de comer?' : '¿Me vende unas viandas?', p.mode === 'take' ? '#7a1d1d' : '#222', 3); },
    done: (a, tg, p) => { C.tradeFood(a, tg.o, p.mode, p.item); return null; } });
  // the forage stance opens with a spoken offer (ai.js forageUpdate calls this before the transaction)
  C.forageOffer = function (a, t) { if (a.talking > 0 || !a.offered) { a.offered = G().time; C.say(a, ['¿Me vende unas viandas?', 'Buenas… ¿algo de comer?', '¿Tiene algo que nos pueda vender, compay?'][(rnd() * 3) | 0], '#222', 2.4); if (t && t.p) C.say(t, t.p.trueStance > 20 ? 'Claro, compañero.' : ['Pues… veamos.', 'Aquí hay poco.'][(rnd() * 2) | 0], '#444', 2.4); } };
})();
