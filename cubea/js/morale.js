/* CUBEA — morale.js : THE SMALL THINGS THAT KEEP A COLUMN TOGETHER — a guitar, coffee, a cigar, rum, dominoes, a ball, a letter.

   Fighting men are not held together by orders alone. This file adds morale boosters that cost something real — weight in a pack,
   a ration of coffee or rum, noise, time — and give something real back: happiness, less boredom and grief, calmer nerves, stronger
   bonds, and sometimes a little of the cause itself.

   THE GUITAR   One man carries a guitar (2.5 weight units — a real cost on a long march — and it hates rain and being dropped).
                When it seems SAFE he plays, mostly in the evening: no fighting, a quiet scene, no soldiers close, the army not
                hunting you. Those within earshot sit and listen: happiness up, boredom and grief down, stress down, friendships
                grow between the listeners and the player. What he plays depends on the camp: a son for dull days, a bolero for
                the grieving and the homesick, the march of the 26th of July before a fight. If soldiers are near enough to hear
                he does not play — and if you ask him to, he says why not. Music carries; a camp that sings in an army zone gets
                visited. You can ask for a song (verb), take the guitar from him, or give it to someone who plays better.
   COFFEE       brewed at a lit fire from the column's coffee (verb), poured by the cup; mornings are better for it. Energy and mood.
   TOBACCO      a cigar passed round (verb): stress and mood, and friendship. At night a lit cigar can be seen.
   RUM          a measure poured: courage and mood now, aim and judgement for a couple of hours, and discipline if it becomes a habit.
   DOMINOES     played with someone (verb): mood and a bond, a quiet hour.
   PELOTA       a ball game for everyone near (verb): the whole squad's mood, a little fitness, a small risk of a sprain.
   LETTERS      mail arrives with mule trains and couriers; you hand it out at camp (verb). Most letters are good. Some are not.
   TUNE: all numbers in the TUNE block.
*/
(function () {
  'use strict';
  const C = window.C, G = () => C.G, clamp = C.clamp;
  const rnd = Math.random;

  // TUNE ---------------------------------------------------------------------------------------------------------------
  const TUNE = {
    play: { hours: [17, 23.3], chance: 0.004, secs: [45, 100], range: 120, hearing: 260, alertMax: 0.3, armyNear: 420, heatMax: 70, pause: 600 },   // pause: seconds before the next unprompted song
    song: { happy: 0.5, bore: 1.0, grief: 0.4, stress: 0.25, morale: 0.05, bond: 0.025 },                  // per game minute while listening (bond per second)
    coffee: { cups: 6, hotHours: 3, energy: 12, happy: 4, stress: 2 },
    cigar: { happy: 6, stress: 8, bond: 1.0 },
    rum: { happy: 10, fear: 12, stress: 10, drunkHours: 2, accMul: 0.72, discipline: 0.4 },
    domino: { secs: 40, happy: 6, bond: 2.5 },
    ball: { secs: 60, happy: 8, bore: 25, sprain: 0.03 },
    mail: { happy: 10, hope: 6, badNews: 0.1, grief: 25 },
  };
  C.MORALE_TUNE = TUNE;
  const inv = (a) => C.initInv(a.p);
  const has = (a, k, n) => (inv(a)[k] || 0) >= (n || 1);
  const stock = (k) => G().res[k] || 0;
  const pay = (a, k, n) => { n = n || 1; if (C.invTake(a.p, k, n) >= n) return true; const r = G().res; if ((r[k] || 0) >= n) { r[k] -= n; return true; } return false; };
  const haveAny = (a, k) => has(a, k) || stock(k) >= 1;

  // ------------------------------------------------------------------------------------------------------------------
  // ITEMS (weight is the point of the guitar)
  // ------------------------------------------------------------------------------------------------------------------
  Object.assign(C.ITEMS, {
    guitar: { n: 'Guitar',         icon: '🎸', w: 2.5, res: 'guitar',  d: 'A battered guitar. Heavy for what it does — and worth every ounce.' },
    cafe:   { n: 'Coffee',         icon: '☕', w: 0.3, res: 'cafe',    d: 'A handful of roasted coffee, enough for a pot.' },
    tabaco: { n: 'Cigars',         icon: '🚬', w: 0.1, res: 'tabaco',  d: 'Hand-rolled cigars.' },
    ron:    { n: 'Rum (bottle)',   icon: '🥃', w: 1.0, res: 'ron',     d: 'A bottle of aguardiente. A little goes a long way.' },
    domino: { n: 'Dominoes',       icon: '🁣', w: 0.6, res: 'domino',  d: 'A set of dominoes in a cloth bag.' },
    pelota: { n: 'Ball and bat',   icon: '⚾', w: 1.5, res: 'pelota',  d: 'A hard ball and a bat: Cuba plays baseball everywhere.' },
    carta:  { n: 'Letters',        icon: '✉', w: 0.05, res: 'carta',   d: 'Letters from home, bundled with string.' },
  });
  C.ITEM_KEYS = Object.keys(C.ITEMS);
  const initRes = () => { const r = G().res; for (const [k, v] of Object.entries({ guitar: 0, cafe: 6, tabaco: 8, ron: 3, domino: 1, pelota: 0, carta: 0 })) if (r[k] === undefined) r[k] = v; };

  /** At the start: one man has a guitar. */
  C.moraleInit = function () {
    const g = G(); if (!g || g.moraleInit) return; g.moraleInit = true; initRes();
    const ppl = C.partyPeople ? C.partyPeople() : []; if (!ppl.length) return;
    const cand = ppl.find((p) => p.traits.includes('musician') || p.occ === 'musico') || ppl.filter((p) => p.id !== C.W.player && p.traits.includes('generous') || p.traits.includes('idealist'))[0] || ppl[(ppl.length / 2) | 0];
    C.invAdd(cand, 'guitar', 1); cand.plays = true; C.log(`${C.tagName(cand)} carries a guitar. It weighs on him, and on the rest of you, a little less than silence would.`, 'info');
  };
  const ae = C.afterEnter; C.afterEnter = function (s) { if (ae) ae(s); if (C.moraleInit && !G().moraleInit && s.sid === 'sierra') C.moraleInit(); };

  // ------------------------------------------------------------------------------------------------------------------
  // THE GUITAR
  // ------------------------------------------------------------------------------------------------------------------
  const SONGS = {
    son:    { n: 'a son', line: '♪ …y siempre la sonrisa…', effect: { bore: 1.3, happy: 1.1 } },
    bolero: { n: 'a bolero', line: '♪ …que me quedé sin tu querer…', effect: { grief: 2.0, hope: 1 } },
    marcha: { n: 'the March of the 26th of July', line: '♪ ¡Marchando vamos hacia un ideal!', effect: { patria: 1, zeal: 1, loud: 1.4 } },
    guaji:  { n: 'Guantanamera', line: '♪ Yo soy un hombre sincero…', effect: { happy: 1.2, patria: 0.4 } },
  };
  const listeners = (s, a, r) => s.actors.filter((q) => !q.dead && !q.inside && !q.captive && (q.side === 'rebel' || q.isPlayer) && q !== a && Math.hypot(q.x - a.x, q.y - a.y) < r);
  /** Is it safe to play? Returns null if safe, or the reason not. */
  C.safeToPlay = function (s, a) {
    const g = G(), T = TUNE.play;
    if (g.combatT > 0 || a.shooting > 0 || a.lastHit > g.time - 20) return 'there was shooting a moment ago';
    if (s.alert > T.alertMax) return 'the army is jumpy tonight';
    if (g.regime.heat > T.heatMax) return 'the army is hunting us';
    if (s.type === 'town' || s.type === 'city' || s.type === 'capital') return 'not in the street';
    for (const o of s.actors) if (o.side === 'army' && !o.dead && !o.inside && Math.hypot(o.x - a.x, o.y - a.y) < T.armyNear) return 'soldiers are close enough to hear';
    if (a.p.body && a.p.body.wet > 80) return 'the strings are soaked';
    return null;
  };
  function chooseSong(s, a, ls) {
    const mind = ls.map((q) => q.p.mind || { grief: 0, boredom: 0 }); const avgG = mind.reduce((t, m) => t + m.grief, 0) / Math.max(1, mind.length), avgB = mind.reduce((t, m) => t + m.boredom, 0) / Math.max(1, mind.length);
    if (avgG > 20) return 'bolero'; if (G().combatT > -1 && s.alert > 0.15 && rnd() < 0.5) return 'marcha'; if (avgB > 35) return 'son'; return ['son', 'guaji', 'bolero'][(rnd() * 3) | 0];
  }
  function startPlaying(s, a, song, secs, asked) {
    const g = G(); const ls = listeners(s, a, TUNE.play.range); song = song || chooseSong(s, a, ls);
    a.playing = { until: g.time + (secs || TUNE.play.secs[0] + rnd() * (TUNE.play.secs[1] - TUNE.play.secs[0])), song, nextLine: 0, asked: !!asked }; a.order = null; a.path = null; a.moving = false; a.hide = false;
    C.log(`${C.tagName(a.p)} plays ${SONGS[song].n}.`, 'info'); if (C.hearSound) C.hearSound(s, a.x, a.y, SONGS[song].effect.loud || 0.8, 'music');
  }
  /** Per frame: the musicians play and the listeners are moved. */
  C.moraleTick = function (s, dt) {
    const g = G(); const gm = dt * (g.minPerSec || 1.5); if (!g.moraleInit && s.sid === 'sierra') C.moraleInit();
    for (const a of s.actors) {
      if (a.dead || !(a.side === 'rebel' || a.isPlayer) || !a.p.inv || !(a.p.inv.guitar > 0)) continue;
      if (a.playing) {
        const pl = a.playing; const why = C.safeToPlay(s, a); a.moving = false; a.working = false;
        if (g.time > pl.until || why || a.suppressed > 0) { if (why && !pl.asked) C.say(a, 'Mejor paro…', '#444', 3); a.playing = null; a.nextSong = g.time + TUNE.play.pause * (0.5 + rnd()); continue; }
        const S = SONGS[pl.song], ls = listeners(s, a, TUNE.play.range), e = TUNE.song, ef = S.effect;
        if (C.snd && C.snd.guitar && g.time > (pl.beatT || 0)) { pl.beatT = g.time + (pl.song === 'bolero' ? 0.62 : pl.song === 'marcha' ? 0.4 : 0.5); pl.beat = (pl.beat || 0) + 1; const pp = g.player; C.snd.guitar(pl.song, pl.beat, pp ? Math.hypot(pp.x - a.x, pp.y - a.y) : 0); }
        if (g.time > pl.nextLine) { pl.nextLine = g.time + 7 + rnd() * 5; C.say(a, S.line, '#6a3a8a', 5); }
        for (const q of ls.concat(g.player && !ls.includes(g.player) && Math.hypot(g.player.x - a.x, g.player.y - a.y) < TUNE.play.range ? [g.player] : [])) {
          const p = q.p, m = p.mind || (C.initBody(p), p.mind); if (!m) continue;
          m.happiness = clamp(m.happiness + e.happy * (ef.happy || 1) * gm, 0, 100); m.boredom = clamp(m.boredom - e.bore * (ef.bore || 1) * gm, 0, 100); m.grief = Math.max(0, m.grief - e.grief * (ef.grief || 1) * gm);
          p.stress = clamp(p.stress - e.stress * gm, 0, 100); p.morale = clamp(p.morale + e.morale * gm * 6, 0, 100); if (ef.hope) p.needs.hope = clamp(p.needs.hope + 0.05 * gm, 0, 100);
          if (ef.zeal && C.expose) C.expose(p, { patria: 0.6, disciplina: 0.3 }, 0.002 * gm, { zeal: 0.3 });
          if (C.bondEvent && rnd() < dt * 0.5) C.bondEvent(a.p, p, 'shared', e.bond * 20); q.sbubOff = true;
        }
        // music carries
        if (rnd() < dt * 0.1) for (const o of s.actors) if (o.side === 'army' && !o.dead && !o.inside && o.brain.mode === 'patrol' && Math.hypot(o.x - a.x, o.y - a.y) < TUNE.play.hearing * (ef.loud || 1)) { o.brain.mode = 'investigate'; o.brain.lastX = a.x; o.brain.lastY = a.y; o.brain.moveT = 0; C.log('The army heard the singing.', 'warn'); }
        continue;
      }
      // unprompted: evening, idle, safe
      if (a.isPlayer || a.order || a.moving || a.sleeping || a.inside || a.captive) continue; if (g.time < (a.nextSong || 0)) continue; const h = g.hour, T = TUNE.play.hours;
      if (h < T[0] || h > T[1] || rnd() > TUNE.play.chance * dt * 60) continue;
      if (listeners(s, a, TUNE.play.range).length < 2) continue; if (a.p.needs.energy < 25 || a.p.needs.food < 20) continue; if (C.safeToPlay(s, a)) { a.nextSong = g.time + 120; continue; }
      startPlaying(s, a);
    }
  };
  C.registerVerb({ id: 'request_song', n: 'Ask for a song', icon: '🎸', kinds: ['actor'], reach: 40, dur: 2,
    variants: (tg) => Object.keys(SONGS).map((k) => ({ param: { song: k }, label: `Ask for ${SONGS[k].n}` })),
    check: (a, tg) => { const q = tg.o; if (!q.p || !(q.p.inv && q.p.inv.guitar > 0)) return 'He has no guitar.'; if (q.playing) return 'He is already playing.'; const why = C.safeToPlay(q.scene, q); return why ? `He will not play — ${why}.` : null; },
    done: (a, tg, p) => { startPlaying(tg.o.scene, tg.o, p.song, 70, true); return null; } });
  C.registerVerb({ id: 'tune_up', n: 'Make him play now', icon: '🎶', kinds: ['actor'], reach: 40, dur: 2, check: (a, tg) => (!(tg.o.p.inv && tg.o.p.inv.guitar > 0) ? 'He has no guitar.' : null), done: (a, tg) => { const why = C.safeToPlay(tg.o.scene, tg.o); if (why) { C.say(tg.o, `No, jefe — ${why}.`, '#7a1d1d', 4); return null; } startPlaying(tg.o.scene, tg.o, null, null, true); return null; } });

  // ------------------------------------------------------------------------------------------------------------------
  // COFFEE
  // ------------------------------------------------------------------------------------------------------------------
  const nearLit = (s, p) => C.thingsOf(s, 'fire').find((f) => f.d.lit && Math.hypot(f.x - p.x, f.y - p.y) < 46);
  C.registerVerb({ id: 'brew_coffee', n: 'Brew coffee', icon: '☕', kinds: ['thing:fire'], reach: 18, dur: 14,
    check: (a, tg) => (!tg.o.d.lit ? 'The fire is not lit.' : tg.o.d.coffee > 0 ? 'There is coffee already.' : !haveAny(a, 'cafe') ? 'No coffee left.' : null),
    done: (a, tg) => { initRes(); pay(a, 'cafe', 1); tg.o.d.coffee = TUNE.coffee.cups; tg.o.d.coffeeUntil = G().min + TUNE.coffee.hotHours * 60; C.say(a, '¡Café!', '#222', 3); return null; } });
  C.registerVerb({ id: 'pour_coffee', n: 'Pour a cup', icon: '🥤', kinds: ['actor'], reach: 30, dur: 3,
    check: (a, tg) => (!C.thingsOf(a.scene, 'fire').find((f) => f.d.coffee > 0 && f.d.coffeeUntil > G().min && Math.hypot(f.x - a.x, f.y - a.y) < 70) ? 'No hot coffee beside you.' : null),
    done: (a, tg) => { const f = C.thingsOf(a.scene, 'fire').find((x) => x.d.coffee > 0 && x.d.coffeeUntil > G().min && Math.hypot(x.x - a.x, x.y - a.y) < 70); if (!f) return 'The pot is cold.'; f.d.coffee--; const p = tg.o.p, c = TUNE.coffee; p.needs.energy = clamp(p.needs.energy + c.energy, 0, 100); p.stress = clamp(p.stress - c.stress, 0, 100); C.initBody(p); p.mind.happiness = clamp(p.mind.happiness + c.happy, 0, 100); p.body.sleepDebt = Math.max(0, p.body.sleepDebt - 0.5); C.say(tg.o, 'Gracias, hermano.', '#1d5b2a', 2); return null; } });

  // ------------------------------------------------------------------------------------------------------------------
  // TOBACCO, RUM, DOMINOES, BALL, MAIL
  // ------------------------------------------------------------------------------------------------------------------
  C.registerVerb({ id: 'share_cigar', n: 'Share a cigar', icon: '🚬', kinds: ['actor'], reach: 26, dur: 5,
    variants: () => [{ param: { all: false }, label: 'Give him a cigar' }, { param: { all: true }, label: 'Pass cigars round the fire' }],
    check: (a, tg, p) => (!haveAny(a, 'tabaco') ? 'No cigars.' : null),
    done: (a, tg, p) => { initRes(); const who = p && p.all ? listeners(a.scene, a, 60).concat([tg.o]).filter((q, i, arr) => arr.indexOf(q) === i) : [tg.o]; let n = 0; for (const q of who) { if (!pay(a, 'tabaco', 1)) break; const pp = q.p; C.initBody(pp); pp.mind.happiness = clamp(pp.mind.happiness + TUNE.cigar.happy, 0, 100); pp.stress = clamp(pp.stress - TUNE.cigar.stress, 0, 100); C.bondEvent && C.bondEvent(a.p, pp, 'shared', TUNE.cigar.bond); n++; } if (a.scene && (G().hour > 20 || G().hour < 5) && n > 1) a.scene.alert = Math.min(1.5, (a.scene.alert || 0) + 0.03); C.say(a, n > 1 ? '¡Hay tabaco!' : 'Fúmese uno.', '#222', 3); return null; } });
  C.registerVerb({ id: 'pour_rum', n: 'Pour rum', icon: '🥃', kinds: ['actor'], reach: 26, dur: 5,
    variants: () => [{ param: { all: false }, label: 'Give him a measure' }, { param: { all: true }, label: 'Pour a round for everyone near' }],
    check: (a, tg) => (!haveAny(a, 'ron') ? 'No rum.' : null),
    done: (a, tg, p) => { initRes(); if (!pay(a, 'ron', 1)) return 'No rum.'; const who = p && p.all ? listeners(a.scene, a, 60).concat([tg.o]).filter((q, i, arr) => arr.indexOf(q) === i).slice(0, 8) : [tg.o]; const R = TUNE.rum, g = G(); for (const q of who) { const pp = q.p; C.initBody(pp); pp.mind.happiness = clamp(pp.mind.happiness + R.happy, 0, 100); pp.fear = clamp(pp.fear - R.fear, 0, 100); pp.stress = clamp(pp.stress - R.stress, 0, 100); pp.drunk = g.min + R.drunkHours * 60; pp.drinks = (pp.drinks || 0) + 1; } g.rep.discipline = clamp(g.rep.discipline - R.discipline * who.length * 0.3, 0, 100); C.say(a, '¡Salud!', '#222', 3); return null; } });
  const am = C.accMod; if (am) C.accMod = function (a) { let k = am(a); if (a.p.drunk > G().min) k *= TUNE.rum.accMul; return k; };

  C.registerVerb({ id: 'play_dominoes', n: 'Play dominoes', icon: '🁣', kinds: ['actor'], reach: 26, dur: TUNE.domino.secs,
    check: (a, tg) => (!haveAny(a, 'domino') && !(tg.o.p.inv && tg.o.p.inv.domino > 0) ? 'No dominoes.' : tg.o.side === 'army' ? 'Not with him.' : null),
    done: (a, tg) => { for (const q of [a, tg.o]) { const pp = q.p; C.initBody(pp); pp.mind.happiness = clamp(pp.mind.happiness + TUNE.domino.happy, 0, 100); pp.mind.boredom = Math.max(0, pp.mind.boredom - 30); } C.bondEvent && C.bondEvent(a.p, tg.o.p, 'shared', TUNE.domino.bond); C.say(a, '¡Doble seis!', '#222', 3); return null; } });
  C.registerVerb({ id: 'play_ball', n: 'Organise a game of pelota', icon: '⚾', kinds: ['ground'], reach: 30, dur: TUNE.ball.secs,
    check: (a) => (!haveAny(a, 'pelota') ? 'No ball and bat.' : C.safeToPlay(a.scene, a) ? 'Not now — ' + C.safeToPlay(a.scene, a) + '.' : null),
    done: (a, tg) => { const s = a.scene, who = listeners(s, a, 160).concat([a]); for (const q of who) { const pp = q.p; C.initBody(pp); pp.mind.happiness = clamp(pp.mind.happiness + TUNE.ball.happy, 0, 100); pp.mind.boredom = Math.max(0, pp.mind.boredom - TUNE.ball.bore); pp.needs.energy = clamp(pp.needs.energy - 5, 0, 100); pp.morale = clamp(pp.morale + 2, 0, 100); if (rnd() < TUNE.ball.sprain) { pp.limp = Math.max(pp.limp || 0, 0.3); C.say(q, '¡Ay, el tobillo!', '#7a1d1d', 3); } } C.say(a, '¡Jonrón!', '#222', 3); C.log(`${who.length} men play pelota for an hour. It is the best hour of the week.`, 'good'); return null; } });
  C.registerVerb({ id: 'hand_out_mail', n: 'Hand out the mail', icon: '✉', kinds: ['ground', 'actor'], reach: 40, dur: 10,
    check: (a) => (stock('carta') < 1 && !has(a, 'carta') ? 'No letters.' : null),
    done: (a, tg) => { initRes(); const s = a.scene, who = listeners(s, a, 140).concat([a]); let n = 0, bad = 0; for (const q of who) { if (!pay(a, 'carta', 1)) break; const pp = q.p; C.initBody(pp); if (rnd() < TUNE.mail.badNews) { pp.mind.grief = Math.min(100, pp.mind.grief + TUNE.mail.grief); bad++; C.say(q, '…', '#444', 4); } else { pp.mind.happiness = clamp(pp.mind.happiness + TUNE.mail.happy, 0, 100); pp.needs.hope = clamp(pp.needs.hope + TUNE.mail.hope, 0, 100); C.say(q, '¡Cartas de casa!', '#1d5b2a', 3); } n++; } C.log(`${n} letters handed out${bad ? ` — ${bad} brought bad news` : ''}.`, bad ? 'warn' : 'good'); return null; } });

  // the mule train and the couriers bring comforts
  const md = C.muleDaily; if (md) C.muleDaily = function () { md(); const q = G().muleQ; if (q && q.length) { const m = q[q.length - 1]; if (m.cafe === undefined) { m.cafe = Math.round(rnd() * 6); m.tabaco = Math.round(rnd() * 10); m.ron = Math.round(rnd() * 3); m.carta = Math.round(2 + rnd() * 10); } } };
  const aeDeliver = C.moraleDeliver = function (cargo) { initRes(); const r = G().res; for (const k of ['cafe', 'tabaco', 'ron', 'carta']) if (cargo[k]) r[k] = (r[k] || 0) + cargo[k]; if (cargo.carta) C.log(`${cargo.carta} letters came with the mules.`, 'info'); };
  // tooltip: what he carries for morale
  const te = C.tipExtra; C.tipExtra = function (s, a) { let h = te ? te(s, a) : ''; const i = a.p.inv; if (i && i.guitar > 0) h += `<br><i>Carries</i> a guitar${a.playing ? ' — playing' : ''}`; if (a.p.drunk > G().min) h += '<br><span class="st">had a drink</span>'; return h; };
})();
