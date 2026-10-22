/* CUBEA — main.js : game loop, input, player control, vehicles, scene switching, prologue, travel, camp. */
(function () {
  'use strict';
  const C = (window.C = window.C || {});
  const T = C.T, TL = C.TILE, clamp = C.clamp;
  const G = () => C.G;
  // INPUT STATE: which keys are down, and the mouse position in screen and world coordinates. Exposed as C.keys / C.mouse for the other modules.
  const keys = {}; const mouse = { x: 0, y: 0, down: false, wx: 0, wy: 0 };
  let last = 0, hudT = 0, acc = 0;
  C.keys = keys; C.mouse = mouse;
  const pick = (a) => a[Math.floor(Math.random() * a.length)];

  // ARMY ACTORS FOR SCRIPTS: waves in the prologue, patrols, ambush targets.
  // ---------------- actors for scripted armies ----------------
  // Spawn an army soldier actor at (x,y): reuses a living soldier from elsewhere in the database or invents one (a conscript), sets experience/morale/helmet, gives a weapon (random mix of Springfield, Garand, carbine, Thompson, BAR, shotgun unless `wk` is given) and a brain mode.
  C.armyActor = function (s, x, y, wk, mode) {
    let p = C.W.people.find((q) => q.status === 'alive' && q.mil && q.mil.side === 'army' && !q.actor && q.settlement !== s.sid && !q.roster);
    if (p) C.moveTo(p, s.sid);
    else {
      p = C.newPerson(C.rnd, { sex: 'M', yob: 1920 + Math.floor(Math.random() * 18), last: pick(C.SURNAMES), last2: pick(C.SURNAMES), settlement: s.sid, birth: pick(C.PLAYABLE), eth: pick(['blanca', 'blanca', 'mulata', 'negra']) });
      p.occ = 'soldado'; p.mil = { side: 'army', unit: s.sid, rank: 'Soldado' }; p.side = 'army'; p._lbias = 0; p.hh = -1; p.occDone = true; C.finishPersonExt(p);
    }
    p.status = 'alive'; p.exp = Math.min(Math.max(p.exp, 2 + Math.random() * 6), 14); p.morale = 62 + Math.random() * 20; p.hp = p.maxHp; p.look.hat = 'helmet'; p.trueStance = Math.min(p.trueStance, -35); p.stance = p.trueStance;
    const a = C.makeActor(s, p, x, y); a.side = 'army'; a.speed = 45; a.brain.mode = mode || 'patrol'; a.brain.role = 'patrol'; a.brain.post = { x, y }; a.brain.home = { x, y };
    // Batista's army was armed with a mix of surplus American weapons: Springfields and Garands first, then carbines,
    // Thompsons, a few BARs. (Callers that care — machine-gun posts, scripted waves — pass `wk` explicitly.)
    if (!wk) { const r = Math.random(); wk = r < 0.42 ? 'rifle' : r < 0.64 ? 'garand' : r < 0.78 ? 'carbine' : r < 0.9 ? 'thompson' : r < 0.96 ? 'bar' : 'shotgun'; }
    C.giveWeapon(a, wk); a.weaponOut = true; s.actors.push(a); return a;
  };
  // Minimal 'finishing' for generic invented soldiers (faction, class, traits, issues, stance, face).
  C.finishPersonExt = function (p) { // minimal finishing for generic soldiers
    const R = C.rnd; const F = C.FACTIONS.army;
    p.fac = 'army'; p.cls = 1; p.traits = [R.pick(C.TRAIT_KEYS)]; p.iss = F.iss.slice(); p.sal = [5, 0]; p.trueStance = p.stance = F.stance + R.gauss() * 15; p.conv = 40;
    p.look = { eyeX: R.range(0.2, 0.3), eyeY: R.range(-0.05, 0.08), eyeR: R.range(0.07, 0.105), brow: R.range(0.14, 0.22), browT: R.range(0.8, 1.7), mouthW: R.range(0.22, 0.34), mouthY: R.range(0.2, 0.3), nose: R.chance(0.45), cheek: false, freckle: false, sw: R.range(0.95, 1.08), sh: R.range(0.95, 1.1), hair: 'blk', hairCol: [30, 24, 20], style: R.int(4), glasses: false, beard: false, mustache: R.chance(0.2), hat: 'helmet', mole: false };
    p.maxHp = p.hp = 90 + Math.floor(R() * 12); p.literate = R.chance(0.7);
    C.W.bySet[p.settlement] = C.W.bySet[p.settlement] || [];
  };

  // SCENE ENTRY AND EXIT.
  // ---------------- scene entry ----------------
  // Detach every actor from its person and remember where they were; clear transient lists (bullets, particles, timers, fires).
  function leaveScene(old) {
    for (const a of old.actors) { a.p.actor = null; if (!a.dead) a.p.loc = { x: a.x, y: a.y }; }
    for (const a of old.corpses) { /* keep corpses */ }
    old.actors = []; old.spawned = false; old.bullets = []; old.parts = []; old.thrown = []; old.timers = []; old.fires = [];
  }
  // Ids of everyone in the player's squads.
  C.partyIds = () => G().squads.flatMap((s) => s.members);
  // Create the player's actor (carries a scoped rifle) and register it as G.player.
  C.makePlayerActor = function (s, x, y) {
    const g = G(); const p = C.P(C.W.player); p.status = 'alive';
    const a = C.makeActor(s, p, x, y); a.isPlayer = true; a.side = 'rebel'; a.speed = 56; a.weaponOut = false; a.alpha = 1;
    C.giveWeapon(a, 'scoped', 10); a.weapon.spare = 15; a.aim = 0; a.grenades = 0;
    s.actors.push(a); g.player = a; return a;
  };
  // Re-link squad membership to actors in the scene (squad id and formation slot).
  C.attachSquads = function (s) {
    const g = G();
    for (const sq of g.squads) {
      let slot = 0;
      sq.members = sq.members.filter((id) => { const p = C.P(id); return p && (p.status === 'alive'); });
      for (const id of sq.members) { const p = C.P(id); if (p.actor && p.actor.scene === s) { p.actor.squad = sq.id; p.actor.squadSlot = slot++; p.actor.side = 'rebel'; } }
    }
  };
  // Which weapon a rebel carries: authored people have signature weapons (Che a pistol, Camilo a Thompson…); others use their recorded weapon (armory) or a random one.
  function rebelWeapon(p) {
    const r = { raul: 'rifle', che: 'pistol', camilo: 'thompson', almeida: 'rifle', ramiro: 'garand', ameijeiras: 'rifle', universo: 'thompson', faustino: 'pistol', ciro: 'rifle', lalo: 'rifle', marquez: 'rifle' }[p.roster];
    return r || p.wpn || pick(['rifle', 'rifle', 'garand', 'pistol']);
  }
  // Bring a rebel person into the current scene near the leader (or a given spot) as an actor with their weapon.
  C.joinPlayerScene = function (p, squadId, near) {
    const g = G(), s = g.scene; const pl = g.player; if (!pl) return null;
    if (p.actor && p.actor.scene === s) { p.actor.squad = squadId; p.actor.side = 'rebel'; return p.actor; }
    const q = s.nearFree(Math.floor((near ? near.x : pl.x) / T) + (Math.random() * 6 - 3 | 0), Math.floor((near ? near.y : pl.y) / T) + (Math.random() * 6 - 3 | 0), 6);
    const a = C.makeActor(s, p, q.x * T + 8, q.y * T + 8); a.side = 'rebel'; a.squad = squadId; a.speed = 40;
    const wk = rebelWeapon(p); C.giveWeapon(a, wk); a.weapon.spare = C.WEAPONS[wk].mag * 2; a.weaponOut = true; if (wk === 'machete') a.weapon.spare = 1;
    p.look.hat = p.look.hat || (p.occ === 'guajiro' ? 'straw' : null); s.actors.push(a); C.attachSquads(s); return a;
  };
  // Move the game to another scene: who travels (living squad members, near enough unless `far`), leave the old scene, fetch/generate the new one, position the player (at the matching exit when arriving from a neighbour), spawn the residents, bring the party, re-attach squads, apply urban rules (rifles into a safehouse cache, only a concealed pistol in towns), place a vehicle, update the UI.
  C.enterScene = function (sid, o) {
    o = o || {}; const g = G(); const old = g.scene; const from = old ? old.sid : null;
    const party = o.party || null;           // array of person ids traveling with the player (undefined => all in current scene)
    let carry = [];
    if (old) {
      // who travels
      const pl = g.player;
      if (pl) {
        carry = old.actors.filter((a) => !a.dead && !a.isPlayer && a.squad >= 0 && (!party || party.includes(a.p.id)) && Math.hypot(a.x - pl.x, a.y - pl.y) < (o.far ? 9999 : 420)).map((a) => a.p.id);
      }
      // restore stashed weapons and leave
      for (const a of old.actors) if (a.p.stash) { a.weapon = a.p.stash; a.p.stash = null; }
      leaveScene(old);
    }
    const s = C.getScene(sid); g.scene = s; s.visited++;
    if (!s.pre) s.pre = C.prerender(s);
    g.selected = null; g.orderMarks = []; g.vehicle = null;
    // place the player
    let sx = s.spawn.x, sy = s.spawn.y;
    if (from) { const ex = s.exits.find((e) => e.dest === from); if (ex) { sx = (ex.x + ex.w / 2) * T; sy = (ex.y + ex.h / 2) * T; const dx = ex.side === 'w' ? 40 : ex.side === 'e' ? -40 : 0, dy = ex.side === 'n' ? 40 : ex.side === 's' ? -40 : 0; sx += dx; sy += dy; } }
    const q = s.nearFree(Math.floor(sx / T), Math.floor(sy / T), 8);
    // persons present in the scene (spawns civilians, army, stationed rebels)
    C.spawnScene(s);
    // move travelling rebels
    for (const id of carry) { C.moveTo(C.P(id), sid); }
    const pl = C.makePlayerActor(s, q.x * T + 8, q.y * T + 8);
    C.moveTo(pl.p, sid);
    for (const id of carry) { C.joinPlayerScene(C.P(id), C.P(id).mil && C.P(id).mil.squad >= 0 ? C.P(id).mil.squad : 0, pl); }
    // stationed rebels who live here
    for (const sq of g.squads) for (const id of sq.members) { const p = C.P(id); if (p.settlement === sid && !(p.actor && p.actor.scene === s)) C.joinPlayerScene(p, sq.id, o.campSpawn ? { x: s.camp.x * T, y: s.camp.y * T } : null); }
    C.attachSquads(s);
    applyUrbanRules(s);
    g.cam.x = pl.x; g.cam.y = pl.y;
    if (o.vehicle) { o.vehicle.x = pl.x + 20; o.vehicle.y = pl.y + 10; o.vehicle.spd = 0; s.vehicles.push(o.vehicle); }
    if (C.ui) { C.ui.refresh(); C.ui.setWhere && C.ui.setWhere(); }
    if (sid === 'sierra' && !s.introduced) { s.introduced = true; }
    C.log('You arrive at ' + s.name + '.', 'info');
  };
  // In towns and cities rebels hide their long guns (stashed on the person and restored when they leave) and become 'covert'; the player keeps a concealed pistol.
  function applyUrbanRules(s) {
    const urban = s.type === 'town' || s.type === 'city' || s.type === 'capital'; const g = G();
    for (const a of s.actors) {
      if (a.side !== 'rebel' && !a.isPlayer) continue;
      a.covertNow = urban;
      if (urban && a.weapon && !C.WEAPONS[a.weapon.k].conceal) { a.p.stash = a.weapon; a.weapon = null; a.weaponOut = false; if (a.isPlayer) { C.giveWeapon(a, 'pistol', 14); C.log('You leave your rifle in a safehouse cache: in town you carry only a concealed pistol.', 'warn'); } }
      if (!urban && a.p.stash) { a.weapon = a.p.stash; a.p.stash = null; }
    }
    if (urban) { g.player.covertNow = true; C.say(g.player, 'Hay que pasar desapercibido', '#444', 3); }
  }

  // BEGINNING A GAME: modes are 'prologue' (the Granma crossing), 'cane' (straight to Alegría de Pío), 'sandbox' (the Sierra camp, no opening).
  // ---------------- begin ----------------
  // Create the world and the initial squads (the Granma party split across four squads; Che and Faustino in the medical squad), then start the right opening and the UI.
  C.beginGame = function (mode, seed, fore, reveal, pname) {
    C.newGame(seed, {});
    C.setPlayerName(pname || 'Fidel Castro');
    const g = G();
    // initial squads from the Granma party
    const ids = C.W.party.filter((id) => id !== C.W.player);
    ids.forEach((id, i) => { const p = C.P(id); p.mil = p.mil || { side: 'rebel', rank: 'Soldado' }; p.side = 'rebel'; const sqi = i % 3 === 2 ? 2 : i % 2; g.squads[sqi].members.push(id); p.mil.squad = sqi; });
    for (const r of ['che', 'faustino']) { const q = C.W.roster[r]; for (const sq of g.squads) sq.members = sq.members.filter((i) => i !== q.id); g.squads[3].members.push(q.id); q.mil.squad = 3; }
    g.unlocked.layer = reveal ? 6 : 1;
    if (mode === 'sandbox') {
      g.unlocked.layer = reveal ? 6 : 2; g.day = 2; g.min = (2 * 24 + 7) * 60; g.hour = 7; g.weekday = (3 + 2) % 7;
      // some survivors only
      const surv = g.squads.flatMap((s) => s.members).slice(); surv.forEach((id, i) => { if (i % 3 === 2) { const p = C.P(id); if (!p.roster) { p.status = 'dead'; for (const s2 of g.squads) s2.members = s2.members.filter((x) => x !== id); } } });
      for (const id of g.squads.flatMap((s) => s.members)) { C.moveTo(C.P(id), 'sierra'); }
      C.enterScene('sierra', { campSpawn: true, far: true });
    } else if (mode === 'cane') {
      for (const id of ids) C.moveTo(C.P(id), 'alegria');
      C.enterScene('alegria', { far: true });
      initPrologue({ mult: 1 });
    } else {
      C.beginCrossing();
    }
    const pl = g.player; pl.p.exp = 5; g.cam.z = mode === 'prologue' ? 3.2 : 2.4;
    // the player holds weapon drawn at start of the ambush
    if (mode === 'cane') pl.weaponOut = true;
    C.ui.start();
    if (mode === 'cane') { g.paused = false; setTimeout(() => C.ui.card({ title: 'Alegría de Pío', icon: '🌴', body: 'Three days after the landing you rest in a cane field. Someone has told the army exactly where you are.', choices: [{ label: 'Begin: the cane field, 5 December 1956', fn: () => { } }] }), 300); }
    else if (mode === 'prologue') { g.paused = false; setTimeout(() => C.ui.card({ title: 'The Granma', icon: '⛵', body: `Tuxpan, Mexico, 25 November 1956. Eighty-two men (in this prototype, the ${C.W.party.length} you can name) on a yacht built for a dozen, the lights off, the sea coming over the bow. You are not the captain; the helm is not yours until the coast is in sight. What you can do is walk the deck, listen, and decide what kind of leader to be before anyone fires a shot.\n\nWASD to move on deck, E to speak to a man.`, choices: [{ label: 'Cast off', fn: () => { } }] }), 300); }
    last = performance.now(); requestAnimationFrame(frame);
  };

  // ALEGRÍA DE PÍO: the ambush. Army waves arrive on a timer (scaled by the landing's multiplier), machine guns cover the north-east, riflemen flank the way out, an air raid is telegraphed, some rebels scatter in panic; you must reach the forest in the north-west.
  // ---------------- prologue: Alegría de Pío ----------------
  // Start the prologue scene with the surviving party after the landing (or directly with `?auto=cane`).
  C.startAlegria = function (o) {
    o = o || {}; const g = G(); const ids = C.W.party.filter((id) => id !== C.W.player && C.P(id).status === 'alive');
    g.minPerSec = 1.5; g.unlocked.layer = Math.max(g.unlocked.layer, 1); g.hour = 12; g.min = 12 * 60;
    for (const id of ids) { C.moveTo(C.P(id), 'alegria'); }
    C.enterScene('alegria', { far: true }); initPrologue(o); g.player.weaponOut = true; g.cam.z = 2.4; C.ui.refresh();
    setTimeout(() => C.ui.card({ title: 'Alegría de Pío', icon: '🌴', body: (o.intro || '') + '\n\n(5 December 1956)', choices: [{ label: 'Rest in the cane', fn: () => { } }] }), 200);
  };
  // Set up the cane-field state: party cluster, weapons out, objective text and the prologue timer.
  function initPrologue(o) {
    o = o || {}; const g = G(), s = g.scene; s.pro = { t: 0, waves: 0, plane: false, done: false, started: false, mult: o.mult || 1 };
    g.min = 16.4 * 60; g.hour = 16.4;
    for (const a of s.actors) if (a.side === 'rebel') { a.weaponOut = true; }
    // party starts in a loose cluster
    const pl = g.player; let i = 0;
    for (const a of s.actors) { if (a.isPlayer) continue; const ang = i * 0.83, r = 30 + (i % 5) * 16; const q = s.nearFree(Math.floor((pl.x + Math.cos(ang) * r) / T), Math.floor((pl.y + Math.sin(ang) * r) / T), 4); a.x = q.x * T + 8; a.y = q.y * T + 8; a.weapon && (a.weapon.spare = C.WEAPONS[a.weapon.k].mag * 2); i++; }
    g.mission = { text: 'Survive the ambush. Machine guns cover the north-east; break for the forest in the north-west (↗ Monte). Keep your men together.', kind: 'escape' };
    C.log('Dec 5, 1956 — Alegría de Pío. Tired, hungry, wet from the landing, you rest in the cane. Then the first shots.', 'warn');
    C.viejoSays && null;
  }
  // Drive the scripted waves, the flank, the air raid, the scattering and the escape check each frame.
  function prologueUpdate(dt) {
    const g = G(), s = g.scene, P = s.pro; if (!P || P.done) return;
    P.t += dt;
    const spawnWave = (n0, x0, y0, spread, wk) => { const n = Math.max(1, Math.round(n0 * (P.mult || 1) + (Math.random() - 0.5))); for (let i = 0; i < n; i++) { const a = C.armyActor(s, (x0 + (Math.random() - 0.5) * spread) * T, (y0 + (Math.random() - 0.5) * spread * 0.6) * T, i % 6 === 0 ? 'thompson' : wk || 'garand', 'engage'); const t = pick(s.actors.filter((q) => q.side === 'rebel' && !q.dead)); a.brain.target = t; a.brain.seen = 8; a.brain.lastX = t.x; a.brain.lastY = t.y; } };
    if (P.t > 5 && P.waves === 0) { P.waves = 1; spawnWave(6, 76, 36, 8); spawnWave(3, 62, 12, 8, 'rifle'); const mg = C.armyActor(s, 66 * T, 11 * T, 'mg', 'engage'); mg.brain.target = g.player; mg.brain.seen = 30; mg.brain.role = 'guard'; const mg2 = C.armyActor(s, 79 * T, 34 * T, 'mg', 'engage'); mg2.brain.target = g.player; mg2.brain.seen = 30; mg2.brain.role = 'guard'; C.alertScene(s, 70 * T, 32 * T, 'contact'); g.shake = 0.7; C.log('FIRE from the east! ¡Emboscada!', 'bad'); C.say(g.player, '¡Al monte!', '#7a1d1d', 3); for (const a of s.actors) if (a.side === 'rebel') a.panic = 0.7; }
    if (P.t > 14 && P.waves === 1) { P.waves = 2; spawnWave(5, 40, 55, 14); C.log('Soldiers close in from the south!', 'bad'); }
    if (P.t > 26 && !P.flank) { P.flank = true; spawnWave(3, 14, 12, 8, 'rifle'); spawnWave(2, 44, 9, 6, 'garand'); C.log('Riflemen in the trees to the north-west — the way out is not clear!', 'bad'); }
    if (P.t > 32 && P.waves === 2) { P.waves = 3; spawnWave(5, 72, 50, 8, 'rifle'); const tk = C.addVehicle(s, 'armytruck', 82 * T, 52 * T, Math.PI, { fuel: 50 }); }
    if (P.t > 30 && !P.plane) { P.plane = true; const pl = g.player; s.bombing = true; { const off = (150 + Math.random() * 70) * (Math.random() < 0.5 ? -1 : 1); C.airstrike(s, pl.x - 330, pl.y + off, pl.x + 300, pl.y + off - 40, 7); } C.later(s, 6, () => { s.bombing = false; }); for (let k = 0; k < 4; k++) C.later(s, 1 + k * 1.3, () => { s.fires.push({ x: pl.x - 200 + k * 130 + Math.random() * 50, y: pl.y + 60 - k * 40 + Math.random() * 50, r: 28, t: 14, owner: null }); }); C.log('An airplane! The cane is burning!', 'bad'); }
    // scattering: panicked rebels break formation after the plane
    if (P.t > 24 && !P.scatter) { P.scatter = true; for (const a of s.actors) { if (a.side !== 'rebel' || a.isPlayer || a.p.roster) continue; if (Math.random() < 0.3) { const ang = Math.random() * 6.28; a.order = { type: 'move', x: clamp(a.x + Math.cos(ang) * 260, 40, s.tw * T - 40), y: clamp(a.y - 160, 40, s.th * T - 40), flee: true }; a.orderT = 0; C.say(a, '¡Sálvese quien pueda!', '#7a1d1d', 3); } } }
    // done when the player reaches the forest
    const ex = s.exits[0];
    if (g.player && !g.player.dead && P.t > 38 && g.player.y < (ex.y + ex.h) * T - 8 && g.player.x < (ex.x + ex.w) * T) finishPrologue();
  }
  // When the player reaches the forest: count who came with you and who was left behind (some are killed, some regroup later), show the aftermath card, jump two days, enter the Sierra and give El Viejo's welcome.
  function finishPrologue() {
    const g = G(), s = g.scene; s.pro.done = true;
    const pl = g.player; const mine = [], left = [];
    for (const sq of g.squads) for (const id of sq.members.slice()) { const p = C.P(id); if (p.status !== 'alive') continue; const a = p.actor; if (a && !a.dead && Math.hypot(a.x - pl.x, a.y - pl.y) < 280) mine.push(id); else left.push(id); }
    g.flags.leftBehind = left.slice();
    const total = C.W.party.length;  // includes you
    // those left behind are lost for now (may regroup later)
    for (const id of left) { for (const sq of g.squads) sq.members = sq.members.filter((x) => x !== id); const p = C.P(id); p.status = 'away'; if (Math.random() < 0.35) { C.killOffscreen(p, 'army', `${C.tagName(p)} was caught in the cane at Alegría de Pío`, 60); } }
    g.mission = null;
    C.ui.card({ title: 'Alegría de Pío', icon: '🌴', body: `Of the ${total} who landed, ${mine.length + 1} are with you in the forest tonight (counting you). ${left.length} others are missing, scattered, or dead.\n\n"The cane was burning, the sky full of lead — and we ran for the trees." You will have to rebuild a force from the survivors, the peasants who hide you, and the memory of this day.`, choices: [{ label: 'Climb into the Sierra', fn: () => {
      g.day += 2; g.min = (g.day * 24 + 6) * 60; g.hour = 6; g.weekday = (3 + g.day) % 7;
      for (const id of g.squads.flatMap((s2) => s2.members)) C.moveTo(C.P(id), 'sierra');
      g.unlocked.layer = 2; C.enterScene('sierra', { campSpawn: true, far: true });
      for (const a of g.scene.actors) if (a.side === 'rebel' && !a.isPlayer) { a.p.needs.food = Math.min(a.p.needs.food, 28); a.p.needs.energy = Math.min(a.p.needs.energy, 40); }
      g.player.weaponOut = false;
      C.ui.viejoToast('Welcome to the mountain, comandante. I am Anselmo — they call me El Viejo. I fought in \'95. Your men are hungry. Let us fix that first.');
      g.mission = { text: 'Feed your men: find the hamlet (Los Carboneros) and buy food (E on a villager). Learn the camp (B).', kind: 'intro' };
    } }] });
  }

  // THE PLAYER'S FRAME: movement (WASD, run, hide), aiming, firing, reloading, camp resupply of ammunition, exit prompts. At sea the deck movement of sea.js replaces it; in a vehicle drive() does.
  // ---------------- player update ----------------
  // Collision test for the player's body.
  const solidAt = (s, x, y) => C.footBlocked(s, x, y, 3.4);
  // (see above)
  function playerUpdate(dt) {
    const g = G(), s = g.scene, a = g.player; if (!a || a.dead) return;
    if (g.sea && g.sea.active && g.sea.phase === 'cross') { C.deckMove(dt, (keys.d || keys.ArrowRight ? 1 : 0) - (keys.a || keys.ArrowLeft ? 1 : 0), (keys.s || keys.ArrowDown ? 1 : 0) - (keys.w || keys.ArrowUp ? 1 : 0)); a.aim = Math.atan2(mouse.wy - (a.y - 9), mouse.wx - a.x); return; }
    if (g.vehicle) { drive(dt); return; }
    let mx = (keys.d || keys.ArrowRight ? 1 : 0) - (keys.a || keys.ArrowLeft ? 1 : 0), my = (keys.s || keys.ArrowDown ? 1 : 0) - (keys.w || keys.ArrowUp ? 1 : 0);
    const run = keys.Shift && a.p.needs.energy > 4 && !a.hide;
    if (mx || my) {
      const l = Math.hypot(mx, my); mx /= l; my /= l;
      let sp = a.speed * (run ? 1.6 : 1) * (a.hide ? 0.5 : 1);
      const t = C.tileAt(s, a.x, a.y); sp /= (C.TCOST[t] || 1); if (a.p.limp) sp *= 0.72; if (g.weather.rain > 0.3 && (t === TL.G || t === TL.TRAIL)) sp *= 0.9; if (a.p.needs.energy < 20) sp *= 0.8;
      C.stepMove(s, a, mx * sp * dt, my * sp * dt); a.moving = true; a.running = !!run;
      if (Math.abs(mx) > 0.15) a.face = mx > 0 ? 1 : -1;
      if (run) a.p.needs.energy = Math.max(0, a.p.needs.energy - dt * 0.25);
    } else { a.moving = false; a.running = false; }
    // aim
    a.aim = Math.atan2(mouse.wy - (a.y - 9), mouse.wx - a.x);
    if (a.weaponOut) a.face = Math.cos(a.aim) >= 0 ? 1 : -1;
    a.hide = !!keys.c; a.prone = false;
    if (mouse.down && a.weaponOut && a.weapon && !g.modalOpen && !C.ui.overUI) { C.tryFire(s, a, mouse.wx, mouse.wy); if (C.WEAPONS[a.weapon.k].rof < 1) { /* semi/bolt: one shot per click handled below */ mouse.down = false; } }
    // reload
    if (a.weapon && a.weapon.mag <= 0 && a.reload <= 0 && a.weapon.spare > 0) { a.reload = C.WEAPONS[a.weapon.k].rel; C.say(a, 'Recargando', '#444', 1.3); }
    // camp resupply
    const camp = s.camp; if (camp && Math.hypot(a.x - camp.x * T, a.y - camp.y * T) < 120 && g.res.ammo > 0) resupply();
    // exits
    for (const e of s.exits) {
      if (e.scripted) continue;
      if (a.x > e.x * T && a.x < (e.x + e.w) * T && a.y > e.y * T && a.y < (e.y + e.h) * T) { if (!g.exitPrompt) { g.exitPrompt = true; C.ui.openMap(e.dest); } }
    }
    if (!s.exits.some((e) => a.x > e.x * T && a.x < (e.x + e.w) * T && a.y > e.y * T && a.y < (e.y + e.h) * T)) g.exitPrompt = false;
    // spotted marks
    a.sleeping = false;
  }
  // Near the camp storehouse, top up everyone's magazines from the column's cartridge stock.
  function resupply() {
    const g = G(); for (const id of C.partyIds()) { const p = C.P(id); const a = p.actor; if (!a || !a.weapon || a.dead) continue; const w = C.WEAPONS[a.weapon.k]; if (w.melee) continue; const want = w.mag * 2 - (a.weapon.spare || 0); if (want > 0 && g.res.ammo >= want) { a.weapon.spare += want; g.res.ammo -= want; } }
    const pa = g.player; if (pa.weapon) { const w = C.WEAPONS[pa.weapon.k]; const want = w.mag * 3 - (pa.weapon.spare || 0); if (want > 0 && g.res.ammo >= want) { pa.weapon.spare += want; g.res.ammo -= want; } }
  }

  // DRIVING: acceleration/braking/steering with speed-dependent turning, terrain and tyre penalties, collisions (damage and shake), fuel burn, burst tyres off-road, running over pedestrians, wrecks, engine noise that draws attention, and boats on water. The Granma uses the same code in the approach phase; running her aground lands the party.
  // ---------------- vehicles ----------------
  // (see above)
  function drive(dt) {
    const g = G(), s = g.scene, a = g.player, v = g.vehicle; if (!v) return;
    const def = v.def;
    a.x = v.x; a.y = v.y;
    const up = keys.w || keys.ArrowUp, dn = keys.s || keys.ArrowDown, lf = keys.a || keys.ArrowLeft, rt = keys.d || keys.ArrowRight;
    const flat = v.tires.filter((q) => q < 0.2).length;
    let maxSp = def.spd * (flat ? 0.5 : 1) * (v.engine < 0.5 ? 0.6 : 1) * (v.hp < def.hp * 0.3 ? 0.7 : 1);
    const t = C.tileAt(s, v.x, v.y);
    if (!def.water) { if (t === TL.G || t === TL.SAND) maxSp *= 0.55; else if (t === TL.CANE) maxSp *= 0.35; else if (t === TL.TRAIL) maxSp *= 0.8; if (g.weather.rain > 0.4 && (t === TL.G || t === TL.TRAIL || t === TL.ROAD)) maxSp *= 0.8; }
    const hasFuel = def.tank === 0 || v.fuel > 0.05;
    if (!hasFuel && !v.warnedFuel) { C.log('The tank is empty.', 'bad'); v.warnedFuel = true; }
    if (hasFuel) v.warnedFuel = false;
    if (up && hasFuel && v.engine > 0.05) v.spd = Math.min(maxSp, v.spd + def.spd * 0.9 * dt);
    else if (dn) v.spd = Math.max(-maxSp * 0.35, v.spd - def.spd * 1.3 * dt);
    else v.spd *= (1 - 1.6 * dt);
    if (Math.abs(v.spd) > maxSp) v.spd *= (1 - 3 * dt);
    const steer = (rt ? 1 : 0) - (lf ? 1 : 0); const turnRate = 2.0 * clamp(Math.abs(v.spd) / 60, 0, 1) * (def.wheels === 2 ? 0.55 : 1) * (flat ? 0.7 : 1);
    v.ang += steer * turnRate * dt * (v.spd >= 0 ? 1 : -1) + (flat && Math.abs(v.spd) > 40 ? Math.sin(g.time * 7) * 0.01 : 0);
    const nx = v.x + Math.cos(v.ang) * v.spd * dt, ny = v.y + Math.sin(v.ang) * v.spd * dt;
    const blocked = (px, py) => {
      const pts = [[def.w / 2 - 2, 0], [-def.w / 2 + 2, 0], [0, def.h / 2 - 1], [0, -def.h / 2 + 1]]; const ca = Math.cos(v.ang), sa = Math.sin(v.ang);
      for (const [ox, oy] of pts) { const wx = px + ox * ca - oy * sa, wy = py + ox * sa + oy * ca; const tt = C.tileAt(s, wx, wy); if (def.water) { if (tt !== TL.DEEP && tt !== TL.SHAL) return true; } else if (C.TCOST[tt] === 0 || tt === TL.FOR || tt === TL.PIER && false) return true; }
      return false;
    };
    if (!blocked(nx, ny)) { v.x = nx; v.y = ny; } else { if (g.sea && g.sea.active && g.sea.phase === 'approach' && Math.abs(v.spd) > 10) { C.seaLand(); } if (Math.abs(v.spd) > 70 && !(g.sea && g.sea.active)) { v.hp -= Math.abs(v.spd) * 0.25; C.fx.dust(s, v.x, v.y, 4); g.shake = Math.max(g.shake, 0.3); C.say(a, '¡Cuidado!', '#7a1d1d', 1); } v.spd *= -0.2; }
    if (def.tank && hasFuel) v.fuel = Math.max(0, v.fuel - def.burn * dt * (0.08 + 0.45 * Math.abs(v.spd) / def.spd) * 0.5);
    // off-road tyre risk
    if ((t === TL.G || t === TL.CANE) && Math.abs(v.spd) > 50 && Math.random() < dt * 0.05 && !def.water) { const wi = Math.floor(Math.random() * 4); if (v.tires[wi] > 0.2) { v.tires[wi] = 0.05; C.log('¡Goma ponchada! A tire blew on the rough ground.', 'bad'); } }
    // run over pedestrians
    if (Math.abs(v.spd) > 38) for (const o of s.actors) { if (o.dead || o.inside || o.inVeh || o === a) continue; if (Math.hypot(o.x - v.x, o.y - v.y) < def.w * 0.5 + 3) { if (o.side === 'rebel' && o.squad >= 0) continue; C.hurt(o, Math.abs(v.spd) * 0.5, a, v.ang, 'blast'); C.say(a, '¡Dios mío!', '#7a1d1d', 1.6); } }
    for (const an of s.animals) if (!an.dead && Math.abs(v.spd) > 30 && Math.hypot(an.x - v.x, an.y - v.y) < def.w * 0.5) { an.hp = 0; an.dead = true; if (an.def.food) s.items.push({ k: 'food', x: an.x, y: an.y, label: 'Carne de ' + an.def.n, amount: an.def.food }); }
    v.lights = g.hour < 6.5 || g.hour > 18.5;
    a.moving = false; a.x = v.x; a.y = v.y;
    // passengers ride along
    for (const q of [v.driver].concat(v.pass)) if (q) { q.x = v.x; q.y = v.y; }
    if (v.hp <= 0 && !v.wreck) C.wreckVehicle(s, v);
    if (v.wreck) { g.vehicle = null; }
    // engine noise draws attention in quiet places
    if (Math.abs(v.spd) > 60 && s.sid === 'sierra') C.alertScene(s, v.x, v.y, 'shot');
    if (hasFuel && v.fuel <= 0.05 && v.def.tank) v.spd *= (1 - 0.5 * dt);
  }
  // Put nearby squadmates into a vehicle (up to its seats).
  C.boardParty = function (v) {
    const g = G(); const pl = g.player; const mates = g.scene.actors.filter((a) => !a.dead && a.side === 'rebel' && a.squad >= 0 && !a.isPlayer && !a.inVeh && Math.hypot(a.x - pl.x, a.y - pl.y) < 110);
    for (const m of mates) { if (v.pass.length + 1 >= v.def.cap) break; C.enterVehicle(m, v); }
  };
  // Everyone gets out.
  C.leaveVehicle = function () { const g = G(); const v = g.vehicle; if (!v) return; const mates = [v.driver].concat(v.pass).filter(Boolean); for (const m of mates.slice()) C.exitVehicle(m, false); v.spd = 0; };

  // INTERACTION: the thing nearest to the player that E would act on.
  // ---------------- interaction (E) ----------------
  // Search nearby actors, corpses, vehicles, items, carcasses, camp plots, building doors and sabotage objects; pick the closest within each kind's reach.
  C.findInteract = function () {
    const g = G(), s = g.scene, pl = g.player; if (!pl) return null; let best = null, bd = 1e9;
    const consider = (kind, o, x, y, r) => { const d = Math.hypot(x - pl.x, y - pl.y); if (d < r && d < bd) { bd = d; best = { kind, o }; } };
    for (const a of s.actors) if (!a.isPlayer && !a.dead && !a.inside && !a.inVeh) consider('actor', a, a.x, a.y, 30);
    for (const a of s.corpses) consider('corpse', a, a.x, a.y, 22);
    for (const v of s.vehicles) if (!v.gone) consider('vehicle', v, v.x, v.y, v.def.w * 0.8 + 18);
    for (const it of s.items) consider('item', it, it.x, it.y, 20);
    for (const an of s.animals) if (an.dead) consider('animal', an, an.x, an.y, 18);
    for (const b of s.blds) { if (b.key === 'pad') { const c = s.centerPx(b); consider('pad', b, c.x, c.y, 30); } else if (b.door && !b.open) { const d = s.doorPx(b); consider('building', b, d.x, d.y, 24); } }
    for (const o of s.objs) if (!o.dead) consider('obj', o, o.x, o.y, 28);
    return best;
  };

  // HOVER: which actor or corpse is under the mouse (for tooltips, inspection, double-click for the pack).
  // ---------------- hovering & inspection ----------------
  function updateHover() {
    const g = G(), s = g.scene; let best = null, bd = 14;
    for (const a of s.actors.concat(s.corpses)) { a.hover = false; if (a.inside || a.gone || a.inVeh) continue; const d = Math.hypot(a.x - mouse.wx, (a.y - 8) - mouse.wy); if (d < bd) { bd = d; best = a; } }
    if (best) best.hover = true; g.hover = best;
  }

  // MOUSE ORDERS. Right-click moves the selection (Shift queues; on a visible soldier = focus fire). The command bar arms an order that the next left-click places. The rich order set and the argument/refusal rules live in orders.js.
  // ---------------- orders from the mouse ----------------
  // Right-click handler (see above).
  C.commandAt = function (wx, wy, shift) {
    const g = G(), s = g.scene; if (g.paused) { C.ui.toast('No orders while paused — time is part of the pressure'); return; }
    if (g.rec && g.rec.on && C.recGoto) { C.recGoto(wx, wy); return; }   // recording an action: the click is a step
    if (g.cmd.pending) { if (g.cmd.pending.pts && g.cmd.pending.pts.length) C.cmdFinish(); else C.cmdCancel(); return; }
    let tgt = null, bd = 16; for (const a of s.actors) { if (a.side !== 'army' || a.dead || a.inside || !C.visible(a)) continue; const d = Math.hypot(a.x - wx, a.y - 8 - wy); if (d < bd) { bd = d; tgt = a; } }
    if (tgt) { C.selActors().forEach((a) => { a.p.focusT = g.time; }); const sq = g.squads[g.curSquad]; if (sq) sq.focus = tgt; C.issue({ type: 'focus', tgt, x: tgt.x, y: tgt.y }); return; }
    C.issue({ type: 'move', x: wx, y: wy }, { queue: shift });
  };
  // Orders armed from the command bar: cmdArm (start), cmdCancel, cmdFinish (patrol), cmdClick (place).
  // pending (button-armed) orders
  C.cmdArm = function (type) {
    const g = G(), def = C.ORDERS[type]; if (g.paused) { C.ui.toast('No orders while paused'); return; }
    if (def.need === 'none') { C.issue({ type }); return; }
    g.cmd.pending = { type, pts: type === 'patrol' ? [] : null }; C.ui.toast(`${def.n}: ${def.need === 'actor' ? 'click a soldier' : def.need === 'pad' ? 'click a camp plot' : type === 'patrol' ? 'click the points, Enter to finish' : 'click the map'} (Esc/RMB cancels, Shift keeps placing)`); C.ui.refreshCmd && C.ui.refreshCmd();
  };
  C.cmdCancel = function () { const g = G(); if (g.cmd.pending) { g.cmd.pending = null; C.ui.toast('Cancelled'); C.ui.refreshCmd && C.ui.refreshCmd(); } };
  C.cmdFinish = function () { const g = G(), p = g.cmd.pending; if (!p) return; if (p.type === 'patrol') { if (p.pts.length < 2) { const sel = C.selActors()[0]; if (sel) p.pts.unshift({ x: sel.x, y: sel.y }); } if (p.pts.length >= 2) { g.cmd.pending = null; C.issue({ type: 'patrol', pts: p.pts, x: p.pts[0].x, y: p.pts[0].y }); C.ui.refreshCmd && C.ui.refreshCmd(); } else C.ui.toast('Click at least one point'); } };
  C.cmdClick = function (wx, wy, shift) {
    const g = G(), s = g.scene, p = g.cmd.pending; if (!p) return false; const def = C.ORDERS[p.type];
    if (def.need === 'actor') { const t = g.hover && g.hover.side === 'army' && !g.hover.dead && C.visible(g.hover) ? g.hover : null; if (!t) { C.ui.toast('Click a soldier you can see'); return true; } C.issue({ type: p.type, tgt: t, x: t.x, y: t.y }); }
    else if (def.need === 'pad') { const tx = wx / C.T, ty = wy / C.T; const b = s.blds.find((q) => q.key === 'pad' && !q.built && tx >= q.x - 1 && tx <= q.x + q.w + 1 && ty >= q.y - 1 && ty <= q.y + q.h + 1); if (!b) { C.ui.toast('Click one of the empty camp plots'); return true; } C.issue({ type: 'build', pad: b, x: (b.x + b.w / 2) * C.T, y: (b.y + b.h + 1) * C.T }); }
    else if (p.type === 'patrol') { p.pts.push({ x: wx, y: wy }); g.orderMarks.push({ x: wx, y: wy, t: 0, col: '#7fd0ff' }); return true; }
    else C.issue({ type: p.type, x: wx, y: wy }, { queue: shift });
    if (!shift) { g.cmd.pending = null; C.ui.refreshCmd && C.ui.refreshCmd(); }
    return true;
  };

  // TRAVEL BETWEEN PLACES: the days pass, food is eaten, tyres can blow, and checkpoints, help and bribes happen on the way.
  // ---------------- travel ----------------
  // Run the daily hooks for each whole day that passes while travelling.
  C.advanceDays = function (days) {
    const g = G(); const whole = Math.floor(days);
    for (let i = 0; i < whole; i++) { g.day++; g.min = g.day * 1440 + (g.min % 1440); dailyHooks(); }
    g.min += (days - whole) * 1440; syncClock();
  };
  // Travel to another settlement by foot or vehicle: cost from the edge graph, fuel, rations (a hungry journey costs hunger and energy), time passing, a chance of an incident (checkpoint with bribe/bluff/turn-back, breakdown, kindness), then arrive.
  C.travelTo = function (dest, mode, squadsGoing) {
    const g = G(), cur = g.scene.sid; const cost = C.travelCost(cur, dest);
    const going = squadsGoing ? g.squads.filter((sq) => squadsGoing.includes(sq.id)).flatMap((sq) => sq.members) : [];
    const veh = mode === 'vehicle' ? g.vehicle : null;
    let days = mode === 'vehicle' ? cost.hours / 24 : cost.days;
    if (mode === 'vehicle' && !veh) { C.ui.toast('You need to be driving a vehicle.'); return; }
    if (veh) { const need = cost.hours * veh.def.burn * 0.9; if (veh.def.tank && veh.fuel < need) { C.ui.toast(`Not enough fuel (${Math.ceil(need)} needed)`); return; } veh.fuel -= need; }
    // rations
    const n = going.length + 1; const food = Math.ceil(n * 1.2 * Math.max(0.3, days)); const short = Math.max(0, food - g.res.food); g.res.food = Math.max(0, g.res.food - food);
    for (const id of going) { const p = C.P(id); p.needs.food = clamp(p.needs.food + (short ? -20 : 10), 0, 100); p.needs.energy = clamp(p.needs.energy - 10 * days, 0, 100); }
    if (short) C.log(`The journey is hungry: ${short} meals short.`, 'bad');
    // leave first so the old scene is clean
    const old = g.scene; if (veh) { old.vehicles = old.vehicles.filter((v) => v !== veh); }
    C.advanceDays(days);
    // encounter
    const chance = 0.28 + g.regime.heat * 0.004 + (mode === 'vehicle' ? 0.05 : 0);
    const arrive = () => { C.enterScene(dest, { party: going, far: true, vehicle: veh }); if (veh) { C.enterVehicle(g.player, veh); g.vehicle = veh; C.boardParty(veh); } };
    if (Math.random() < chance && dest !== 'sierra') {
      const kinds = ['checkpoint', 'checkpoint', 'breakdown', 'help'];
      const k = pick(kinds);
      if (k === 'checkpoint') {
        const armed = going.some((id) => { const a = C.P(id).actor; return a && a.weapon && !C.WEAPONS[a.weapon.k].conceal; });
        C.ui.card({ title: 'Checkpoint', icon: '🚧', body: `Rural Guards stop you on the road to ${C.SETTLEMENTS[dest].name}. ${armed ? 'Your men are carrying rifles under blankets.' : 'You carry only what can be hidden.'}`, choices: [
          { label: 'Bribe the sergeant (20 pesos)', sub: 'Quick and quiet', disabled: g.res.money < 20, fn: () => { g.res.money -= 20; arrive(); } },
          { label: 'Bluff — you are cane merchants', sub: armed ? 'Risky with rifles' : 'Likely to work', fn: () => { const ok = Math.random() < (armed ? 0.3 : 0.75) + (g.player.p.exp * 0.002); if (ok) { arrive(); C.log('The guards wave you through.', 'good'); } else { C.log('They find the rifles. Shooting starts!', 'bad'); g.regime.heat += 6; arrive(); C.spawnPatrol(g.scene, 4, 'Guardia Rural'); } } },
          { label: 'Turn back before they see you', fn: () => { C.advanceDays(days); arrive2back(); } },
        ] });
        const arrive2back = () => { C.enterScene(cur, { party: going, far: true, vehicle: veh }); if (veh) { C.enterVehicle(g.player, veh); g.vehicle = veh; } };
        return;
      } else if (k === 'breakdown' && veh) { veh.tires[0] = 0.05; C.log('A tire blows on the road. You lose half a day fixing it.', 'bad'); C.advanceDays(0.5); }
      else if (k === 'help') { g.res.food += 6; C.log('A peasant family shares their lunch with the travellers.', 'good'); }
    }
    arrive();
  };

  // THE CAMP: eight plots to build (kitchen, infirmary, workshop, radio, school, printing press, powder store, command tent) and crafting recipes that need them.
  // ---------------- camp building & crafting ----------------
  // Pesos and scrap cost per camp building (labour orders can cut it).
  C.BUILD_COST = { cocina: [20, 10], enfermeria: [30, 12], taller: [35, 14], radiocamp: [90, 22], escuelacamp: [25, 12], imprenta: [45, 16], polvorin: [25, 10], tienda_c: [10, 6] };
  // Pay (with labour discounts) and raise a building on a plot.
  C.buildAtPad = function (b) {
    const g = G(), s = g.scene; const k = b.slot; const cost0 = C.BUILD_COST[k]; if (!cost0 || b.built) return false; const cost = C.padCost(b);
    if (g.res.money < cost[0] || g.res.scrap < cost[1]) { C.ui.toast(`Need ${cost[0]} pesos and ${cost[1]} scrap/materials`); return false; }
    g.res.money -= cost[0]; g.res.scrap -= cost[1];
    const d = C.BLD[k]; b.key = k; b.label = d.n; b.fill = d.fill; b.roof = d.roof; b.open = false; b.built = true; b.tag = d.tag; s.rect(b.x, b.y, b.w, b.h, TL.BLD); b.door = { tx: b.x + (b.w >> 1), ty: b.y + b.h }; s.pre = null; s.mini = null; g.base.built[k] = true; g.base.level++;
    C.log(`Built: ${d.n}.`, 'good'); return true;
  };
  // Crafting: cartridges, bandages, molotovs, dynamite, grenades, pamphlets, cooked rations, scavenged scrap and cloth.
  C.RECIPES = [
    { id: 'ammo', n: 'Reload cartridges (10)', need: 'taller', cost: { scrap: 2, money: 3 }, make: { ammo: 10 } },
    { id: 'bandage', n: 'Bandages from cloth (1 medicine)', need: 'enfermeria', cost: { cloth: 2 }, make: { med: 1 } },
    { id: 'molotov', n: 'Molotov cocktails (2)', need: 'taller', cost: { cloth: 1, money: 2 }, make: { molo: 2 } },
    { id: 'dyn', n: 'Dynamite charge (1)', need: 'taller', cost: { scrap: 3, money: 5 }, make: { dyn: 1 } },
    { id: 'grenade', n: 'Hand grenades (2)', need: 'taller', cost: { scrap: 3, money: 4 }, make: { gren: 2 } },
    { id: 'pamph', n: 'Print pamphlets (10)', need: 'imprenta', cost: { money: 3 }, make: { pamph: 10 } },
    { id: 'rations', n: 'Cook rations: 6 food → 8', need: 'cocina', cost: { food: 6 }, make: { food: 8 } },
    { id: 'scrap', n: 'Scavenge scrap & cloth (rest of the day)', need: null, cost: {}, make: { scrap: 2, cloth: 2 } },
  ];
  // Make a recipe if its building exists and the ingredients are in the stores.
  C.craft = function (id) {
    const g = G(); const r = C.RECIPES.find((x) => x.id === id); if (!r) return;
    if (r.need && !g.base.built[r.need]) { C.ui.toast('Build the ' + C.BLD[r.need].n + ' first'); return; }
    for (const k in r.cost) if ((g.res[k] || 0) < r.cost[k]) { C.ui.toast('Not enough ' + k); return; }
    for (const k in r.cost) g.res[k] -= r.cost[k]; for (const k in r.make) g.res[k] = (g.res[k] || 0) + r.make[k];
    C.log('Crafted: ' + r.n, 'good'); C.ui.refresh();
  };

  // THE CLOCK AND DAILY HOOKS.
  // ---------------- the clock ----------------
  // Derive day, hour and weekday from the minute counter.
  function syncClock() { const g = G(); g.day = Math.floor(g.min / 1440); g.hour = (g.min % 1440) / 60; g.weekday = (3 + g.day) % 7; }
  // Once per game day: loyalty tick and bonds decay, the layered reveal of interface systems (support meter day 8, factions day 25…), weather, the Director's daily pick, outpost mission check, end conditions.
  function dailyHooks() {
    const g = G();
    C.dayTick(); C.bondDaily(); if (C.farmDaily) C.farmDaily();
    // the layered reveal: systems unlock as the story advances
    { const TH = [[3, 8, 'Locals: peasants remember how you treat them (support meter, loyalty details).'], [4, 25, 'Factions: peasants, workers, students, elites, landowners, the Church and the army are now tracked (⚖ Factions).'], [5, 60, 'Politics: you can now announce a platform (📜 Manifesto). Announced planks become promises.'], [6, 100, 'The island: the cities, the pipeline from Havana, the unions and the students are in play.']];
      for (const [L, d, msg] of TH) if (g.unlocked.layer < L && g.day >= d) { g.unlocked.layer = L; C.log('NEW SYSTEM — ' + msg, 'good'); C.ui.toast('New system unlocked'); C.ui.refresh(); } }
    // weather for the new day
    if (Math.random() < 0.17) { g.weather.target = 0.5 + Math.random() * 0.5; g.weather.t = 1 + Math.random() * 1.2; } else if (g.weather.t <= 0) g.weather.target = 0;
    g.weather.fog = g.scene.sid === 'sierra' && Math.random() < 0.12 ? 0.6 : 0;
    C.story.daily();
    if (g.mission && g.mission.kind === 'outpost' && !g.mission.done) checkOutpost();
    checkOver();
  }
  // The first mission is complete when no soldiers remain at the Sierra outpost.
  function checkOutpost() {
    const g = G(); const alive = C.W.people.filter((p) => p.mil && p.mil.side === 'army' && p.settlement === 'sierra' && p.status === 'alive').length;
    if (alive === 0) { g.mission.done = true; g.mission = null; C.log('The outpost is yours. A first victory.', 'good'); g.regime.armyMorale -= 5; }
  }
  // End conditions: the player is dead with no party; a 900-day limit; a starving remnant (fewer than two rebels, no food or money for 12 days).
  function checkOver() {
    const g = G(); if (g.over) return;
    const alive = C.squadPeople().length; if (alive === 0 && g.player && g.player.dead) { C.endGame('dead'); return; }
    if (g.day > 900) C.endGame('timeout');
    if (alive < 2 && g.day > 20 && g.res.food < 1 && g.res.money < 5 && !g.scene.pro) { /* starving remnant */ g.flags.remnant = (g.flags.remnant || 0) + 1; if (g.flags.remnant > 12) C.endGame('collapse'); } else g.flags.remnant = 0;
  }
  // C.mealTime now lives in inventory.js (meals feed packs and honour ration restrictions)

  // THE MAIN UPDATE (one simulation step of `dt` seconds): clock and meals, the sea/crossing, weather, resting, the prologue, the player, the scene (AI), fog of war, bonds, bullets and effects, order marks, spotted marks, and the camera follow.
  // ---------------- main update ----------------
  // (see above)
  function update(dt) {
    const g = G(), s = g.scene; if (!s) return;
    if (g.over) return;
    g.time += dt;
    const prevMin = g.min; g.min += dt * g.minPerSec * (g.resting ? 12 : 1);
    const prevDay = g.day; syncClock(); if (g.sea && g.sea.active) C.seaUpdate(dt);
    // meals
    for (const h of [7, 13, 19]) if (prevMin % 1440 < h * 60 && g.min % 1440 >= h * 60 || prevDay !== g.day && h === 7 && false) C.mealTime();
    if (C.campTick) C.campTick(s, g.min - prevMin);   // camp life: hourly consequences of what is on the ground (camp.js)
    if (g.day !== prevDay) { dailyHooks(); }
    // weather
    const w = g.weather; w.t -= dt / 60; if (w.t <= 0) w.target = Math.max(0, w.target - dt * 0.01); w.rain += (w.target - w.rain) * Math.min(1, dt * 0.2);
    // resting
    if (g.resting) { for (const id of C.partyIds()) { const a = C.P(id).actor; if (a) { a.sleeping = true; a.moving = false; } } g.player.sleeping = true; g.player.p.needs.energy = Math.min(100, g.player.p.needs.energy + dt * 6); if (g.hour >= 6 && g.hour < 7 || s.alert > 0.35 || g.combatT > 0) { g.resting = false; C.log('You wake.', 'info'); } }
    if (s.pro) prologueUpdate(dt);
    playerUpdate(dt);
    if (C.playerActTick) C.playerActTick(dt);
    C.updateScene(s, dt); C.fogUpdate(s, dt); C.bondTick(s, dt); C.updateBullets(s, dt); C.updateFx(s, dt);
    g.combatT = Math.max(0, g.combatT - dt); g.shake = Math.max(0, g.shake - dt * 1.6); g.flash = Math.max(0, g.flash - dt * 1.6); g.hurt = Math.max(0, g.hurt - dt * 0.18);
    for (const m of g.orderMarks) m.t += dt; g.orderMarks = g.orderMarks.filter((m) => m.t < 2.2);
    for (const sp of s.spotted || []) sp.t -= dt; if (s.spotted) s.spotted = s.spotted.filter((q) => q.t > 0);
    // decals fade
    // cam
    const pl = g.player; if (pl) { const k = Math.min(1, dt * 5); g.cam.x += (pl.x - g.cam.x) * k; g.cam.y += (pl.y - 10 - g.cam.y) * k; }
    // clamp camera to map
    const hw = C.R.W / 2 / g.cam.z, hh = C.R.H / 2 / g.cam.z; g.cam.x = clamp(g.cam.x, Math.min(hw, s.tw * T / 2), Math.max(s.tw * T - hw, s.tw * T / 2)); g.cam.y = clamp(g.cam.y, Math.min(hh, s.th * T / 2), Math.max(s.th * T - hh, s.th * T / 2));
    // mouse world
    const wv = C.toWorld(g.cam, mouse.x, mouse.y); mouse.wx = wv.x; mouse.wy = wv.y;
    updateHover();
    // death of the leader
    if (pl && pl.dead && !g.over) { C.endGame('dead'); }
    // cull far-off tracers
  }

  // The animation frame: advance the simulation in steps of at most 1/40 s × game speed unless paused or a card is open (a paused game still updates the hover so you can inspect), draw, refresh the HUD about five times a second.
  function frame(ts) {
    const g = G(); if (!g) return;
    const dtr = Math.min(0.06, (ts - last) / 1000); last = ts;
    if (!g.paused && !g.modalOpen && !g.over) {
      const sp = g.speed; let rem = dtr * sp;
      while (rem > 1e-4) { const step = Math.min(rem, 1 / 40); update(step); rem -= step; }
    } else {
      const wv = C.toWorld(g.cam, mouse.x, mouse.y); mouse.wx = wv.x; mouse.wy = wv.y; if (g.scene) updateHover();
    }
    C.drawScene(g.scene, g, ts / 1000);
    hudT -= dtr; if (hudT <= 0) { hudT = 0.2; C.ui.update(); C.drawMinimap(document.getElementById('mm'), g.scene, g); }
    requestAnimationFrame(frame);
  }

  // INPUT: keyboard hotkeys, mouse selection and orders, wheel zoom. Orders and fire are blocked while paused.
  // ---------------- input ----------------
  window.addEventListener('keydown', (e) => {
    const g = G(); if (!g) return;
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT')) return;
    const k = (e.shiftKey && /^Digit[1-9]$/.test(e.code)) ? e.code.slice(5) : (e.key.length === 1 ? e.key.toLowerCase() : e.key); keys[k] = true; if (e.key === 'Shift') keys.Shift = true;
    if (e.key === ' ') e.preventDefault();
    if (k === 'Escape') { if (g.cmd && g.cmd.pending) { C.cmdCancel(); return; } C.ui.closeModal(); return; }
    if (g.over) return;
    if (g.modalOpen) return;
    const pl = g.player;
    switch (k) {
      case ' ': g.paused = !g.paused; C.ui.toast(g.paused ? 'Paused' : 'Running'); C.ui.syncSpeed(); break;
      case 'x': if (pl && !g.vehicle) { pl.weaponOut = !pl.weaponOut && !!pl.weapon; C.ui.toast(pl.weaponOut ? 'Weapon drawn' : 'Weapon holstered'); } break;
      case 'r': if (pl && pl.weapon && pl.reload <= 0 && pl.weapon.spare > 0) pl.reload = C.WEAPONS[pl.weapon.k].rel; break;
      case 'g': if (pl && !g.vehicle) { if (g.res.gren > 0 && C.throwExplosive(pl, mouse.wx, mouse.wy, 'grenade')) g.res.gren--; else if (g.res.molo > 0 && C.throwExplosive(pl, mouse.wx, mouse.wy, 'molotov')) g.res.molo--; else C.ui.toast('No grenades'); } break;
      case 'f': { if (g.paused) { C.ui.toast('No orders while paused'); break; } const sq = g.squads[g.curSquad]; if (sq) { sq.fireNow = true; setTimeout(() => (sq.fireNow = false), 6000); C.ui.toast('¡Fuego! Ambush sprung'); } break; }
      case 'v': g.opts.fog = !g.opts.fog; C.ui.toast(g.opts.fog ? 'Fog of war on' : 'Fog of war off'); break;
      case 'z': if (!g.resting) { if (s_alert()) { C.ui.toast('Cannot rest: enemies near'); } else { g.resting = true; C.ui.toast('Resting until dawn…'); } } else g.resting = false; break;
      case 'e': doInteract(); break;
      case 'm': C.ui.openMap(); break;
      case 'p': C.ui.openManifesto(); break;
      case 'i': C.ui.openFactions(); break;
      case 'j': C.ui.openJournal(); break;
      case 'b': C.ui.openBase(); break;
      case 'h': C.ui.openHelp(); break;
      case 'tab': { e.preventDefault(); cyclePartner(); break; }
      case '1': case '2': case '3': case '4': case '5': case '6': case '7': case '8': case '9': { const n = (+k) - 1; if (!g.squads[n]) break; if (e.shiftKey) { C.assignGroup(n, C.selIds()); C.ui.toast('Selection assigned to ' + C.gName(g.squads[n])); } else { C.selectGroup(n); C.ui.toast('Group: ' + C.gName(g.squads[n]) + ' (' + g.squads[n].members.length + ')'); } C.ui.refresh(); break; }
      case 'Enter': C.cmdFinish(); break;
      case 'Backspace': e.preventDefault(); C.stopOrders(); break;
      case 'u': g.unlocked.layer = 6; C.ui.refresh(); C.ui.toast('All systems revealed'); break;
      case 'k': if (pl && !pl.dead && e.shiftKey) { pl.p.hp = 9999; C.ui.toast('God mode'); } break;
      default: break;
    }
  });
  // Is there danger nearby (alert, combat, engaged soldiers)? Blocks resting.
  function s_alert() { const g = G(); return g.scene.alert > 0.3 || g.combatT > 0 || g.scene.actors.some((a) => a.side === 'army' && !a.dead && a.brain.mode === 'engage'); }
  window.addEventListener('keyup', (e) => { const k = e.key.length === 1 ? e.key.toLowerCase() : e.key; keys[k] = false; if (e.key === 'Shift') keys.Shift = false; });
  window.addEventListener('blur', () => { for (const k in keys) keys[k] = false; });
  // Tab: select the next squadmate.
  function cyclePartner() { const g = G(); const list = g.scene.actors.filter((a) => a.squad >= 0 && !a.dead && !a.isPlayer); if (!list.length) return; g.selIdx = ((g.selIdx || 0) + 1) % list.length; select(list[g.selIdx]); }
  // Select (and inspect) an actor.
  function select(a) { const g = G(); if (g.selected) g.selected.sel = false; g.selected = a; if (a) { a.sel = true; C.ui.inspect(a.p, a); } else C.ui.inspect(null); }
  C.select = select;
  // E: exit a vehicle, or act on the nearest thing (talk, search, drive, pick up, enter, build, sabotage); at sea it lands the boat.
  function doInteract() {
    const g = G(); const pl = g.player; if (!pl || pl.dead) return;
    if (g.sea && g.sea.active) { if (g.sea.phase === 'approach') C.seaLand(); else { const t = C.findInteract(); if (t) C.ui.interact(t); } return; }
    if (g.vehicle) { C.leaveVehicle(); g.vehicle = null; return; }
    const t = C.findInteract(); if (!t) { C.ui.toast('Nothing to use here'); return; }
    C.ui.interact(t);
  }
  const cv = document.getElementById('game');
  cv.addEventListener('mousemove', (e) => { mouse.x = e.clientX; mouse.y = e.clientY; if (mouse.box && G()) G().box = { x0: Math.min(mouse.box.sx, e.clientX), y0: Math.min(mouse.box.sy, e.clientY), x1: Math.max(mouse.box.sx, e.clientX), y1: Math.max(mouse.box.sy, e.clientY) }; const tip = document.getElementById('tip'); const g = G(); if (!g || !g.scene) return; const a = g.hover; if (a && !g.modalOpen) { tip.style.display = 'block'; tip.style.left = Math.min(window.innerWidth - 270, e.clientX + 14) + 'px'; tip.style.top = (e.clientY + 14) + 'px'; tip.innerHTML = C.ui.tipFor(a); } else tip.style.display = 'none'; });
  cv.addEventListener('mousedown', (e) => {
    const g = G(); if (!g || g.modalOpen || g.over) return; C.snd && C.snd.init();
    if (e.button === 0 && g.cmd.pending) { C.cmdClick(mouse.wx, mouse.wy, e.shiftKey); return; }
    if (e.button === 0 && e.ctrlKey) { mouse.box = { sx: e.clientX, sy: e.clientY, wx: mouse.wx, wy: mouse.wy }; return; }
    if (e.button === 0) {
      const pl = g.player;
      if (pl && pl.weaponOut && !g.vehicle && !e.shiftKey && !g.paused) { mouse.down = true; if (pl.weapon && C.WEAPONS[pl.weapon.k].rof >= 1) { mouse.down = true; } C.tryFire(g.scene, pl, mouse.wx, mouse.wy); if (C.WEAPONS[pl.weapon ? pl.weapon.k : 'pistol'].rof < 1) mouse.down = false; }
      else { if (g.hover) select(g.hover); else select(null); }
      if (e.shiftKey && g.hover) { select(g.hover); const hp = g.hover.p; if (g.hover.side === 'rebel' && !g.hover.isPlayer) { const cur = C.selIds(); C.setSel(cur.includes(hp.id) ? cur.filter((x) => x !== hp.id) : cur.concat(hp.id)); } }
    } else if (e.button === 2) { C.commandAt(mouse.wx, mouse.wy, e.shiftKey); }
  });
  window.addEventListener('mouseup', (e) => {
    mouse.down = false; const g = G(); if (!g || !mouse.box) { return; }
    const b = mouse.box; mouse.box = null; g.box = null;
    const x0 = Math.min(b.wx, mouse.wx), x1 = Math.max(b.wx, mouse.wx), y0 = Math.min(b.wy, mouse.wy), y1 = Math.max(b.wy, mouse.wy);
    if (Math.hypot(e.clientX - b.sx, e.clientY - b.sy) < 6) { if (g.hover && g.hover.side === 'rebel' && !g.hover.isPlayer) { const cur = C.selIds(); const id = g.hover.p.id; C.setSel(cur.includes(id) ? cur.filter((x) => x !== id) : cur.concat(id)); } return; }
    const ids = g.scene.actors.filter((a) => a.side === 'rebel' && !a.isPlayer && !a.dead && !a.inside && a.squad >= 0 && a.x >= x0 && a.x <= x1 && a.y - 8 >= y0 && a.y - 8 <= y1).map((a) => a.p.id);
    C.setSel(ids); C.ui.toast(ids.length ? `${ids.length} selected` : 'Nobody in the box');
  });
  cv.addEventListener('contextmenu', (e) => e.preventDefault());
  cv.addEventListener('wheel', (e) => { const g = G(); if (!g) return; e.preventDefault(); g.cam.z = clamp(g.cam.z * (e.deltaY < 0 ? 1.1 : 0.9), 1.1, 4.2); }, { passive: false });
  document.getElementById('minimap').addEventListener('click', () => C.ui.openMap());

  // TITLE SCREEN: start buttons, the typed name (remembered in localStorage), the world seed and the ?auto= URL options used by the test harnesses.
  // ---------------- title screen wiring ----------------
  C.initRender(cv);
  const seedEl = document.getElementById('seed');
  const startGame = (mode) => {
    const msg = document.getElementById('genmsg'); msg.textContent = 'Generating 3,000 Cubeans, their families and friends…';
    setTimeout(() => { const seed = parseInt(seedEl.value, 10) || 1956; const pname = (document.getElementById('pname').value || '').trim() || 'Fidel Castro'; try { try { localStorage.setItem('cubea_name', pname); } catch (e) { } C.snd && C.snd.init(); C.beginGame(mode, seed, 0, false, pname); document.getElementById('title').style.display = 'none'; } catch (err) { msg.textContent = 'Error: ' + err.message; console.error(err); } }, 30);
  };
  const qs = new URLSearchParams(location.search); if (qs.get('seed')) seedEl.value = qs.get('seed');
  try { const sn = localStorage.getItem('cubea_name'); if (sn) document.getElementById('pname').value = sn; } catch (e) { }
  if (qs.get('name')) document.getElementById('pname').value = qs.get('name');
  document.getElementById('startBtn').onclick = () => startGame('prologue');
  document.getElementById('sandBtn').onclick = () => startGame('sandbox');
  if (qs.get('auto')) setTimeout(() => startGame(qs.get('auto') === 'sandbox' ? 'sandbox' : qs.get('auto') === 'cane' ? 'cane' : 'prologue'), 120);
  // test hook
  // Test hook: lets the Playwright harnesses step the simulation directly.
  C.debug = { update, get g() { return G(); }, select, keys, mouse, startGame, syncClock, dailyHooks };
})();
