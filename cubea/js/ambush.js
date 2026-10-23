/* CUBEA — ambush.js : THE ARMY TRUCK ON THE ROAD, FOR REAL.

   "The army takes the food at <village>" used to set a flag and nothing else. Now choosing to answer it puts you and your men on a road
   scene between the village and the town, in the brush beside the road, with the truck already leaving the village behind you.
   • Your men take the ambush stance and hide (ai.js: they hold fire until the enemy is within ~100 px, or until you press F).
   • The truck (an army GMC, a driver and four soldiers) drives east along the road at a steady pace.
   • When it is close to you, or the first shot is fired, it stops and the soldiers pile out and fight — ordinary combat from there.
   • Win: every soldier dead or gone. The food comes back to the families, the truck's cargo is yours, the village remembers.
   • Lose the chance: the truck reaches the far end of the road unmolested. The village remembers that too.
   Walk off either end of the road when you are done, as with any journey.
   TUNE: numbers in the TUNE block.
*/
(function () {
  'use strict';
  const C = window.C, G = () => C.G, clamp = C.clamp, T = C.T;
  const TUNE = { days: 2, startBack: 430, speed: 38, stopDist: 120, soldiers: 4, loot: { food: [10, 20], ammo: [8, 24], med: [0, 2] }, returnFood: 8, spread: 22 };
  C.AMBUSH_TUNE = TUNE;
  const rnd = Math.random, pick = (a) => a[(rnd() * a.length) | 0];

  C.startAmbush = function (village) {
    const g = G(); if (!C.roadInternals || !g.scene || (g.sea && g.sea.active)) return;
    if (g.scene.type === 'road') { C.ui.toast('You are already on a road.'); return; }
    const to = village === 'cayo' ? 'bayamo' : 'manzanillo'; if (!C.SETTLEMENTS[village] || !C.SETTLEMENTS[to]) return;
    const rid = `road:ambush:${village}>${to}`; delete C.scenes[rid]; C.ui.closeModal && C.ui.closeModal();
    const s = C.roadInternals.makeRoad(rid, village, to, TUNE.days); C.scenes[rid] = s; s.populated = true;
    const party = g.squads.flatMap((sq) => sq.members).filter((id) => id !== C.W.player).slice(0, 12);
    g.journey = { from: village, to, mode: 'foot', rid, t0: g.min, cost: { days: 0, hours: 0 } };
    C.enterScene(rid, { party, far: true });
    const W = s.road.W, ry = (x) => C.roadInternals.roadY(s, x), bx = Math.round(W * 0.55) * T;
    s.ambush = { stage: 'wait', village, bx, by: ry(bx), t: 0, soldiers: [], truck: null };
    // you and your men in the brush north of the road, spread along it
    const pl = g.player; pl.x = bx; pl.y = ry(bx) - 30; pl.hide = true;
    let i = 0; for (const a of s.actors) if (a.side === 'rebel' && !a.isPlayer && !a.dead) { const k = i++; a.x = bx + (k - 5) * TUNE.spread; a.y = ry(a.x) - 26 - rnd() * 14; a.order = null; a.stanceOv = 'ambush'; a.hide = true; a.path = null; }
    // the truck, behind you, with its soldiers
    const sx = bx - TUNE.startBack; const v = C.addVehicle(s, 'armytruck', sx, ry(sx), 0, { fuel: 70 });
    for (let k = 0; k < TUNE.soldiers + 1; k++) { const a = C.armyActor(s, sx, ry(sx), k === 0 ? 'thompson' : pick(['garand', 'rifle', 'rifle']), 'patrol'); a.brain.mode = 'patrol'; C.enterVehicle(a, v); s.ambush.soldiers.push(a); }
    v.order = { x: (W - 4) * T, y: ry((W - 4) * T), t: 0 }; s.ambush.truck = v;
    g.minPerSec = Math.min(g.minPerSec, 0.4);                           // the road's fast clock would make the scene useless for a fight
    C.ui.card({ title: 'Ambush at the bend', icon: '🪖', headline: 'The truck is coming along the road. Stay down. Your men fire when it is close, or press F to give the word.', choices: [{ label: 'Get down', fn() { } }] });
    const armed = s.actors.filter((a) => a.side === 'rebel' && !a.dead && a.weapon && a.weapon.k !== 'machete').length;
    if (armed < 4 && C.viejoSays) C.viejoSays(`Only ${armed} rifles for six soldiers and a truck. Let them come close, hijo, and make every shot count.`);
    C.log('You lie in the brush above the road. Somewhere behind you, an engine.', 'warn');
  };

  const spring = (s, A, why) => {
    A.stage = 'fight'; const v = A.truck; if (v) { v.order = null; v.spd = 0; }
    for (const a of A.soldiers) { if (a.dead) continue; if (a.inVeh) C.exitVehicle(a, false); a.brain.mode = 'investigate'; a.brain.lastX = G().player.x; a.brain.lastY = G().player.y; a.brain.moveT = 0; a.alert = 1; }
    s.alert = Math.max(s.alert || 0, 1); G().combatT = Math.max(G().combatT || 0, 6); C.log(why, 'warn');
  };
  C.ambushTick = function (s, dt) {
    const g = G(), A = s.ambush; if (!A || A.stage === 'done') return; A.t += dt; const v = A.truck;
    if (A.stage === 'wait') {
      if (v && !v.wreck && v.order) { v.spd = Math.max(v.spd, 0); }
      const d = v ? Math.hypot(v.x - A.bx, v.y - A.by) : 1e9;
      if (!v || v.wreck) return spring(s, A, 'The truck is wrecked.');
      if (d < TUNE.stopDist) spring(s, A, 'The truck has seen the brush move — it jolts to a stop and the soldiers jump down.');
      else if (g.combatT > 0 && d < 500) spring(s, A, 'The first shot rings out. The truck brakes hard and the soldiers jump down.');
      else if (v.x > (s.road.W - 6) * T) { A.stage = 'done'; C.log('The truck has driven out of the valley. The families will know you let it go.', 'bad'); C.memoryAll && C.memoryAll(A.village, { type: 'requisition', perpSide: 'army', text: 'The army took food and nobody stopped them', memText: 'The rebels did not stop the truck' }, 1, 40, 1); g.regime.legit -= 0.4; }
      return;
    }
    if (A.stage === 'fight') {
      if (A.soldiers.some((a) => !a.dead && !a.gone)) return;
      A.stage = 'done'; g.flags.ambushTruck = null; const L = TUNE.loot, r = (a) => Math.round(a[0] + rnd() * (a[1] - a[0]));
      const f = r(L.food), am = r(L.ammo), m = r(L.med); g.res.food += f; g.res.ammo += am; g.res.med += m;
      C.log(`The truck is yours: ${f} food, ${am} cartridges${m ? ', ' + m + ' bandages' : ''}. The rest goes back to ${C.SETTLEMENTS[A.village].name}.`, 'good');
      C.memoryAll && C.memoryAll(A.village, { type: 'aid', perpSide: 'rebel', positive: true, text: 'Rebels ambushed the army truck and brought back our food', memText: 'The rebels brought back our food' }, 1, 70, 1);
      C.deed && C.deed(0, 8); g.regime.heat += 5; g.regime.armyMorale = clamp((g.regime.armyMorale || 50) - 3, 0, 100);
      if (C.viejoSays) C.viejoSays('Good. Now leave before the army comes looking. Take what you can carry.');
    }
  };
})();
