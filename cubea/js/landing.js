/* CUBEA — landing.js : THE LANDING IS A FIREFIGHT YOU CAN SEE, NOT A CARD THAT SAYS "MASSACRE".

   When the Granma touches the beach the hidden coast is revealed by what is actually standing on it. The old model rolled one number
   (threat + alert + noise) and printed an outcome. Now the same number decides WHAT IS ON THE BEACH and the fight is played:
     risk < 0.42   nobody (maybe a sleepy sentry): you wade ashore unseen
     0.42 – 0.78   a squad in the dunes and a rifle or two                     (the old "contact")
     0.78 – 1.05   a rifle line and a machine gun covering the sand            (the old "ambush")
     above 1.05    a line, two or three machine guns, and an aircraft strafing the shallows  (the old "massacre")
   The party leaves the boat as real people wading ashore, with as many of the unnamed men (up to 22 are shown) beside them as the
   screen can carry. Who lives is decided by the bullets. The landing ends when you reach the trees inland (the trail north of the
   beach); a brief summary says how many of the 82 made it. If you die, you die.
   Supplies are lost in proportion to the share of men who fell carrying them. TUNE: numbers in the TUNE block.
*/
(function () {
  'use strict';
  const C = window.C, G = () => C.G, T = C.T, clamp = C.clamp;
  const rnd = Math.random, pick = (a) => a[(rnd() * a.length) | 0];
  const TUNE = { grace: 1.5, shieldPlayer: 0.08, shieldNamed: 0.5, quiet: 0.42, contact: 0.78, ambush: 1.05, base: 3, perRisk: 12, extras: 22, unnamed: 54, inland: 24, stragglers: 45, planeDelay: 7, mg: [0, 1, 2, 3], loss: 0.8 };
  C.LANDING_TUNE = TUNE;
  C.ui.playLanding = !navigator.webdriver;       // test runs keep the old instant resolution; landing tests set this true

  const tf = C.tryFire; C.tryFire = function (s, a) { if (a && a.holdFire) return false; return tf.apply(this, arguments); };   // ambushers wait for the keel to touch
  function makeExtra(s, x, y) {
    const p = C.newPerson(C.rnd, { sex: 'M', yob: 1915 + Math.floor(rnd() * 22), last: pick(C.SURNAMES), last2: pick(C.SURNAMES), settlement: s.sid, birth: pick(C.PLAYABLE), eth: pick(['blanca', 'blanca', 'mulata', 'negra']) });
    p.occ = 'guajiro'; p.mil = { side: 'rebel', rank: 'Soldado', squad: 1 }; p.side = 'rebel'; p._lbias = 0; p.hh = -1; p.occDone = true; C.finishPersonExt(p); p.fac = 'peasants'; p.trueStance = p.stance = 80; p.status = 'alive'; p.exp = 2 + rnd() * 10; p.look.hat = 'straw'; p.morale = 70;
    const a = C.makeActor(s, p, x, y); a.side = 'rebel'; a.squad = 1; a.speed = 40; a.extra = true; const wk = rnd() < 0.45 ? 'rifle' : 'machete'; C.giveWeapon(a, wk); a.weaponOut = true; s.actors.push(a); return a;
  }
  const inShallows = (s, v, k) => { for (let r = 0; r < 40; r += 6) { const ang = k * 2.4 + r; const x = v.x + Math.cos(ang) * (8 + r * 0.6), y = v.y + Math.sin(ang) * (10 + r * 0.6); const q = s.nearFree(Math.floor(x / T), Math.floor(y / T), 3); if (q) return { x: q.x * T + 8, y: q.y * T + 8 }; } return { x: v.x, y: v.y }; };

  C.playLanding = function (site, threat) {
    const g = G(), S = g.sea, s = g.scene, v = S.veh;
    const risk = threat + S.alert * 0.55 + (rnd() - 0.5) * 0.4;
    S.phase = 'landing'; S.label = '2 Dec 1956 · the landing'; S.landing = { site, risk, t: 0, plane: false, hostiles: [], extras: [], named: C.squadPeople().length, start: g.min };
    const L = S.landing; g.minPerSec = 0.5; g.vehicle = null;
    // the beach: what is on it
    const coastY = (site.cy + 1) * T, cx = v.x, n = risk < TUNE.quiet ? (rnd() < 0.4 ? 1 : 0) : Math.round(TUNE.base + (risk - TUNE.quiet) * TUNE.perRisk);
    const nmg = risk < TUNE.contact ? 0 : risk < TUNE.ambush ? 1 : risk < 1.25 ? 2 : 3;
    const place = (dx, dy) => { const q = s.nearFree(Math.floor((cx + dx) / T), Math.floor((coastY - dy) / T), 5); return q ? { x: q.x * T + 8, y: q.y * T + 8 } : { x: cx + dx, y: coastY - dy }; };
    for (let i = 0; i < n; i++) { const q = place((i - n / 2) * 20 + (rnd() - 0.5) * 24, 80 + rnd() * 80); const a = C.armyActor(s, q.x, q.y, i % 4 === 0 ? 'thompson' : pick(['garand', 'rifle', 'rifle', 'carbine']), 'patrol'); L.hostiles.push(a); a.holdFire = true; }
    for (let i = 0; i < nmg; i++) { const q = place((i - (nmg - 1) / 2) * 110 + (rnd() - 0.5) * 20, 60 + rnd() * 40); const a = C.armyActor(s, q.x, q.y, 'mg', 'patrol'); L.hostiles.push(a); a.holdFire = true; }
    g.player.shield = TUNE.shieldPlayer; for (const p of C.squadPeople()) if (p.actor && p.roster) p.actor.shield = TUNE.shieldNamed;
    // everybody into the shallows
    const rebels = s.actors.filter((a) => (a.side === 'rebel' || a.isPlayer) && a.inVeh === v);
    let k = 0; for (const a of rebels) { const q = inShallows(s, v, k++); C.exitVehicle(a, false); a.x = q.x; a.y = q.y; a.weaponOut = true; a.hide = false; a.order = null; }
    if (g.player.inVeh) { C.exitVehicle(g.player, false); }
    // the unnamed men (as many as the screen can carry)
    const ex = Math.min(TUNE.extras, TUNE.unnamed); for (let i = 0; i < ex; i++) { const q = inShallows(s, v, k++); L.extras.push(makeExtra(s, q.x, q.y)); }
    C.attachSquads && C.attachSquads(s);
    // the men run for the trees, spread along the beach (orders.js 'move')
    for (const a of s.actors) if ((a.side === 'rebel') && !a.isPlayer && !a.dead) a.order = { type: 'move', x: cx + (rnd() - 0.5) * 220, y: (site.cy - TUNE.inland - 2) * T };
    g.mission = { text: 'Get off the beach. Into the trees to the north — they are firing from the dunes. Your men follow you.', kind: 'sea' };
    C.ui.card({ title: risk < TUNE.quiet ? 'The beach is quiet' : 'The beach!', icon: risk < TUNE.quiet ? '🏝' : '🔥', headline: risk < TUNE.quiet ? 'Nobody on the sand. Get everyone ashore and into the trees.' : 'They were waiting in the dunes. Move! Take the men to the trees.', choices: [{ label: 'Go', fn() { } }] });
    C.log(`${site.name}: ${risk < TUNE.quiet ? 'the beach looks empty' : 'shots from the dunes'}.`, risk < TUNE.quiet ? 'info' : 'bad');
    if (C.snd && C.snd.chime) C.snd.chime();
  };

  C.landingTick = function (dt) {
    const g = G(), S = g.sea, s = g.scene, L = S && S.landing; if (!L) return; L.t += dt; const site = L.site;
    if (g.player.dead) { S.active = false; S.landing = null; g.over = { kind: 'dead', cause: 'killed at the landing' }; return; }
    // the defenders open fire a few seconds after the keel touches
    if (!L.fired && L.t > TUNE.grace && L.risk >= TUNE.quiet) { L.fired = true; for (const a of L.hostiles) { a.holdFire = false; a.brain.mode = 'investigate'; a.brain.lastX = g.player.x; a.brain.lastY = g.player.y; a.brain.moveT = 0; a.alert = 1; } if (L.hostiles.length) { s.alert = 1.4; g.combatT = Math.max(g.combatT || 0, 10); } }
    // aircraft over the shallows on a heavy landing
    if (!L.plane && L.risk >= TUNE.ambush && L.t > TUNE.planeDelay) { L.plane = true; const y = (site.cy + 2) * T; C.airstrike(s, g.player.x - 360, y, g.player.x + 320, y + 20, 7); C.log('A plane comes in low over the water.', 'bad'); }
    // done: the player has reached the trees
    const line = (site.cy - TUNE.inland) * T;
    if (g.player.y < line) {
      if (!L.trees) { L.trees = L.t; L.told = false; }
      const south = s.actors.filter((a) => !a.dead && !a.gone && !a.isPlayer && a.side === 'rebel' && a.y > line + 20 && !a.inVeh).length;
      if (south && !L.told && L.t - L.trees > 3) { L.told = true; if (C.viejoSays) C.viejoSays('Your men are still on the sand. Cover them from the trees, or leave them — but decide now.'); }
      if (!south || L.t - L.trees > TUNE.stragglers) finish(L);
    } else L.trees = 0;
  };
  function finish(L) {
    const g = G(), S = g.sea, s = g.scene, site = L.site; S.landing = null; g.player.shield = 1; for (const a of s.actors) if (a.shield) a.shield = 1;
    const named = C.squadPeople().filter((p) => p.status === 'alive'); const dead = L.named - named.length; const hurt = named.filter((p) => p.hp < p.maxHp * 0.7).length;
    const shown = L.extras.length, aliveEx = L.extras.filter((a) => !a.dead).length, frac = shown ? aliveEx / shown : 1;
    const unnamedAlive = Math.round(TUNE.unnamed * frac), total = L.named + TUNE.unnamed;
    const survivors = named.length + unnamedAlive, lost = clamp(1 - survivors / total, 0, 1);
    const kind = lost < 0.06 ? 'quiet' : lost < 0.25 ? 'contact' : lost < 0.6 ? 'ambush' : 'massacre';
    const sup = clamp(1 - lost * TUNE.loss, 0.15, 1), r = g.res; for (const k of ['ammo', 'food', 'med', 'gren', 'guns']) r[k] = Math.floor(r[k] * sup);
    for (const a of L.extras) { if (a.dead) continue; a.gone = true; a.dead = true; a.alpha = 0; } for (const a of L.hostiles) { if (!a.dead) { a.gone = true; } }
    g.flags.landing = { site: site.id, kind, dead, hurt, risk: L.risk }; g.stats.landingDead = dead + (TUNE.unnamed - unnamedAlive);
    const mult = clamp(0.8 + L.risk * 0.55 + (rnd() - 0.5) * 0.35, 0.7, 1.7);
    C.ui.card({ title: `Ashore: ${survivors} of ${total}`, icon: kind === 'massacre' ? '💀' : '🏝', headline: `${dead ? dead + ' of the men you know did not make it' : 'Everyone you know is alive'}${hurt ? ', ' + hurt + ' wounded' : ''}. Supplies kept: ${Math.round(sup * 100)}%.`, choices: [{ label: 'Go on', fn() { } }] });
    C.endSea(site, kind, mult, named.length);
  }
})();
