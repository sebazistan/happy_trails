/* CUBEA — rituals.js : FEASTS, FUNERALS, AND THE DAYS THAT ARE NOT ORDINARY.

   FEAST DAYS   The calendar the camp keeps: Santa Bárbara (4 Dec), San Lázaro (17 Dec), Nochebuena (24 Dec), Año Nuevo (31 Dec),
                Reyes (6 Jan), the Virgen de la Caridad (8 Sep), and a few more. On the day, El Viejo reminds you. A FEAST is made in
                the world: a lit fire, a pig or the food and firewood for one, and an hour or two: verb "Roast a pig" on a fire. When it
                is ready, everyone near eats, sings, and drinks a little: happiness way up, grief and boredom down, friendships
                strengthened across the camp — doubled on a feast day. A feast takes food and firewood, and makes smoke and noise (camp
                exposure rises), which is the whole difficulty.
   TOAST        verb on a person or the ground: a short speech and a drink (needs rum): a small, quick version.
   FUNERAL      after you bury a rebel the men who knew him stand with you: grief eases, bonds with the living deepen, the creed
                is spoken over the grave (ideology.js).
   TUNE: numbers in the TUNE block.
*/
(function () {
  'use strict';
  const C = window.C, G = () => C.G, clamp = C.clamp;
  const rnd = Math.random;
  const TUNE = { food: 12, wood: 3, hours: 1.5, happy: 22, grief: 18, bore: 40, bond: 1.6, feastDayMul: 1.6, reach: 150, toast: { happy: 6, bond: 1.0 }, funeral: { grief: 25, bond: 3 } };
  C.RITUAL_TUNE = TUNE;
  // [month (0-11), day, name, line]
  const FEASTS = [[8, 8, 'the Virgen de la Caridad del Cobre', 'The patroness of Cuba. Even the unbelievers stand a little straighter.'], [11, 4, 'Santa Bárbara', 'Santa Bárbara, who is also Changó. The old folk light candles.'], [11, 17, 'San Lázaro', 'San Lázaro, Babalú-Ayé, patron of the sick; some will walk on their knees tonight.'], [11, 24, 'Nochebuena', 'Christmas Eve: the night for a roast pig and the people you miss.'], [11, 31, 'New Year’s Eve', 'The last night of the year. Someone will want to sing.'], [0, 1, 'Año Nuevo', 'The first of the year. Everyone makes a promise they will not keep.'], [0, 6, 'Reyes (Three Kings)', 'The children get their gifts today, wherever they are. The men remember being children.']];
  C.feastToday = function () { const d = C.dateOf(G().day), m = d.getUTCMonth(), dd = d.getUTCDate(); return FEASTS.find((f) => f[0] === m && f[1] === dd) || null; };
  C.ritualsDaily = function () { const f = C.feastToday(); if (f) { C.log(`Today is ${f[2]}. ${f[3]}`, 'info'); if (C.viejoSays && rnd() < 0.7) C.viejoSays(`It is ${f[2]}. A roast pig would do more for these boys than a speech.`); } };
  C.registerVerb({ id: 'roast_pig', n: 'Roast a pig (feast)', icon: '🐖', kinds: ['thing:fire'], reach: 20, dur: 22,
    check: (a, tg) => { const r = G().res; if (!tg.o.d.lit) return 'The fire is not lit.'; if (tg.o.d.feast) return 'A feast is already cooking.'; if (r.food < TUNE.food) return `A feast needs ${TUNE.food} rations (a pig, or what it costs).`; if ((r.lena || 0) < TUNE.wood) return `Needs ${TUNE.wood} firewood.`; return null; },
    done: (a, tg) => { const g = G(), r = g.res; r.food -= TUNE.food; r.lena -= TUNE.wood; tg.o.d.feast = { until: g.min + TUNE.hours * 60, day: !!C.feastToday() }; C.say(a, '¡Hay lechón!', '#222', 4); C.log('A pig goes on the fire. The smell will carry for a mile.', 'info'); a.scene.alert = Math.min(1.5, (a.scene.alert || 0) + 0.08); return null; } });
  C.feastTick = function (s) {
    const g = G(); for (const f of C.thingsOf(s, 'fire')) { const F = f.d.feast; if (!F || g.min < F.until) continue; f.d.feast = null; const mul = F.day ? TUNE.feastDayMul : 1; const ls = s.actors.filter((q) => !q.dead && !q.inside && !q.captive && (q.side === 'rebel' || q.isPlayer) && Math.hypot(q.x - f.x, q.y - f.y) < TUNE.reach); let n = 0;
      for (const q of ls) { const p = q.p; C.initBody(p); p.mind.happiness = clamp(p.mind.happiness + TUNE.happy * mul, 0, 100); p.mind.grief = Math.max(0, p.mind.grief - TUNE.grief * mul); p.mind.boredom = Math.max(0, p.mind.boredom - TUNE.bore); p.needs.food = clamp(p.needs.food + 40, 0, 100); p.needs.hope = clamp(p.needs.hope + 5 * mul, 0, 100); p.stress = clamp(p.stress - 12 * mul, 0, 100); n++; C.say(q, ['¡Qué rico!', '¡Salud!', '¡Viva Cuba libre!'][(rnd() * 3) | 0], '#1d5b2a', 3); }
      for (let i = 0; i < ls.length * 2; i++) { const a = ls[(rnd() * ls.length) | 0], b = ls[(rnd() * ls.length) | 0]; if (a !== b && C.bondEvent) C.bondEvent(a.p, b.p, 'shared', TUNE.bond * mul); } if (g.regime) g.rep.discipline = clamp(g.rep.discipline - 0.2, 0, 100);
      C.log(`The feast is ready: ${n} people eat, drink and sing${F.day ? ` — and it is ${C.feastToday() ? C.feastToday()[2] : 'a holiday'}` : ''}.`, 'good'); }
  };
  C.registerVerb({ id: 'toast', n: 'Raise a toast', icon: '🥂', kinds: ['actor', 'ground'], reach: 60, dur: 5,
    check: (a) => ((a.p.inv && a.p.inv.ron > 0) || G().res.ron > 0 ? null : 'No rum for a toast.'),
    done: (a, tg) => { if (!C.invTake(a.p, 'ron', 1)) G().res.ron--; const ls = a.scene.actors.filter((q) => !q.dead && !q.inside && (q.side === 'rebel' || q.isPlayer) && Math.hypot(q.x - a.x, q.y - a.y) < 100); for (const q of ls) { C.initBody(q.p); q.p.mind.happiness = clamp(q.p.mind.happiness + TUNE.toast.happy, 0, 100); } for (let i = 0; i < ls.length; i++) { const x = ls[(rnd() * ls.length) | 0], y = ls[(rnd() * ls.length) | 0]; if (x !== y && C.bondEvent) C.bondEvent(x.p, y.p, 'shared', TUNE.toast.bond); } C.say(a, '¡Por los que no están!', '#222', 4); return null; } });
  /** After a burial: the men who knew him gather. */
  C.funeral = function (corpse) {
    const g = G(), s = g.scene, p = corpse.p; if (!(p.mil && p.mil.side === 'rebel')) return; let n = 0;
    for (const q of s.actors) { if (q.dead || !(q.side === 'rebel' || q.isPlayer) || Math.hypot(q.x - corpse.x, q.y - corpse.y) > 200) continue; const bond = C.bondOf ? C.bondOf(q.p, p) : 0; C.initBody(q.p); q.p.mind.grief = Math.max(0, q.p.mind.grief - TUNE.funeral.grief * (0.5 + bond / 100)); q.p.needs.hope = clamp(q.p.needs.hope + 2, 0, 100); if (q !== g.player) q.react = null; n++; if (C.expose && q.p.cr) C.expose(q.p, { patria: 0.5, justicia: 0.4, fe: 0.3 }, 0.03, { zeal: 2 }); }
    for (let i = 0; i < n; i++) { const x = s.actors[(rnd() * s.actors.length) | 0], y = s.actors[(rnd() * s.actors.length) | 0]; if (x && y && x !== y && x.side === 'rebel' && y.side === 'rebel' && C.bondEvent) C.bondEvent(x.p, y.p, 'shared', TUNE.funeral.bond); }
    if (n) C.log(`${n} comrades stand at the grave of ${C.tagName(p)}.`, 'info');
  };
})();
