// Command system v2: selection, named groups, a table of orders, task execution, volunteers,
// and what happens when you send people to a place they are sure will kill them.
(function () {
  const C = window.C, G = () => C.G, T = C.T, TL = C.TILE, clamp = C.clamp;
  // Access to the AI's movement helpers (exported by ai.js as C.ai).
  const AI = () => C.ai;
  const toast = (t) => C.ui && C.ui.toast(t);

  // ---------------------------------------------------------------- order table
  // need: 'point' (click ground) | 'actor' (click an enemy) | 'pad' (click a camp plot) | 'none' (now)
  // danger: how much the order exposes people (multiplier on the danger estimate)
  // THE ORDER TABLE (see docs/COMMANDS.md). Each order: tab (which command-bar tab), name, need ('point' click the ground, 'actor' click a soldier, 'pad' click a camp plot, 'none' immediate), danger (how much it exposes people, ×0 … 1), work (seconds a task takes), instant (supply orders that apply at once) and a description.
  C.ORDERS = {
    macro:   { tab: 'hidden', n: 'Action', need: 'none', danger: 0.3, d: 'A recorded or preset action (see the Actions panel, K).' },
    move:    { tab: 'move',  n: 'Move',            need: 'point', danger: 0.8, d: 'Walk to a place. Shift queues waypoints.' },
    follow:  { tab: 'move',  n: 'Follow me',       need: 'none',  danger: 0,   d: 'Drop what you are doing and stay close to the leader.' },
    hold:    { tab: 'move',  n: 'Hold here',       need: 'point', danger: 0.5, d: 'Go to a spot and hold it. Fire at will.' },
    guard:   { tab: 'move',  n: 'Stand guard',     need: 'point', danger: 0.5, d: 'Stand watch at a spot: sees farther, never leaves it.' },
    attack:  { tab: 'fight', n: 'Attack',          need: 'point', danger: 1.0, d: 'Advance to a place and fight whatever they meet on the way.' },
    focus:   { tab: 'fight', n: 'Focus fire',      need: 'actor', danger: 0.9, d: 'Everyone shoots one man.' },
    ambush:  { tab: 'fight', n: 'Ambush',          need: 'point', danger: 0.6, d: 'Slip to a spot, hide, hold fire until they are close (F springs it).' },
    patrol:  { tab: 'fight', n: 'Patrol',          need: 'point', danger: 0.7, d: 'Walk a loop between points (click several, Enter to finish).' },
    retreat: { tab: 'fight', n: 'Retreat',         need: 'point', danger: 0,   d: 'Break contact and run to a place without firing.' },
    scout:   { tab: 'recon', n: 'Scout',           need: 'point', danger: 0.4, d: 'Go quietly, look, come back and report what they saw.' },
    watch:   { tab: 'recon', n: 'Lookout',         need: 'point', danger: 0.3, d: 'Lie hidden at a spot and watch (sight range ×1.5).' },
    sneak:   { tab: 'recon', n: 'Stalk',           need: 'actor', danger: 0.7, d: 'Creep close to a soldier without being seen.' },
    hide:    { tab: 'recon', n: 'Hide here',       need: 'none',  danger: 0,   d: 'Go to ground where you stand. Hold fire until close.' },
    dig:     { tab: 'camp',  n: 'Dig in',          need: 'point', danger: 0.6, work: 14, d: 'Dig a foxhole: half damage from bullets while in it.' },
    latrine: { tab: 'camp',  n: 'Dig latrine',     need: 'point', danger: 0.1, work: 10, d: 'Camp hygiene. Without one, dysentery comes.' },
    water:   { tab: 'camp',  n: 'Fetch water',     need: 'none',  danger: 0.2, work: 6,  d: 'Fill canteens at the nearest water and bring them back.' },
    carry:   { tab: 'camp',  n: 'Carry supplies',  need: 'point', danger: 0.3, d: 'Collect what lies on the ground near a place and bring it to the camp.' },
    build:   { tab: 'camp',  n: 'Build (labour)',  need: 'pad',   danger: 0.1, work: 15, d: 'Help raise a structure: each worker cuts its cost.' },
    rest:    { tab: 'camp',  n: 'Rest',            need: 'point', danger: 0.1, work: 22, d: 'Sleep where you are told: energy and health back.' },
    // Crew-served mortar: the person carrying the tube deploys (6 s), then lobs shells at the clicked point every ~3 s while shells last.
    // Everyone else in the selection becomes the crew: they stay close and hand shells to the gunner.
    mortar:  { tab: 'fight', n: 'Mortar fire',     need: 'point', danger: 0.15, d: 'The mortar team lobs shells at a point (needs the tube and shells; spotter sight helps; friendly fire is real).' },
    treat:   { tab: 'camp',  n: 'Treat wounded',   need: 'none',  danger: 0.2, d: 'Bandage the wounded (uses medicine).' },
    help:    { tab: 'people', n: 'Help a peasant', need: 'none',  danger: 0.1, work: 18, d: 'Work a peasant\'s plot. They remember.' },
    feed:    { tab: 'people', n: 'Feed livestock', need: 'none',  danger: 0.1, work: 8,  d: 'Tend the animals. Small goodwill.' },
    forage:  { tab: 'people', n: 'Forage',         need: 'none',  danger: 0.2, d: 'Gather food nearby under your pay/vale/take policy.' },
  };
  // Supply orders are *instant*: they set a standing ration allowance on each selected person (p.rat). They are
  // not obeyed blindly — see breakRestriction() in inventory.js: hunger, thirst, low loyalty and low trust make people cheat.
  const setRat = (f, w) => (ids) => { C.setRation(ids, f, w); C.ui.toast(`${ids.length} on ${f !== null ? 'food ' + ['none', 'half', 'full'][f === 0 ? 0 : f === 0.5 ? 1 : 2] : ''}${f !== null && w !== null ? ', ' : ''}${w !== null ? 'water ' + ['none', 'sparing', 'free'][w === 0 ? 0 : w === 0.5 ? 1 : 2] : ''}`); };
  Object.assign(C.ORDERS, {
    food_full: { tab: 'supply', n: 'Food: full',     need: 'none', danger: 0, instant: setRat(1, null),   d: 'Eat whenever hungry.' },
    food_half: { tab: 'supply', n: 'Food: half',     need: 'none', danger: 0, instant: setRat(0.5, null), d: 'Eat only when quite hungry, half portions.' },
    food_none: { tab: 'supply', n: 'Food: none',     need: 'none', danger: 0, instant: setRat(0, null),   d: 'Do not eat. Hungry people will disobey.' },
    water_full:{ tab: 'supply', n: 'Water: free',    need: 'none', danger: 0, instant: setRat(null, 1),   d: 'Drink whenever thirsty.' },
    water_half:{ tab: 'supply', n: 'Water: sparing', need: 'none', danger: 0, instant: setRat(null, 0.5), d: 'Drink only when quite thirsty.' },
    water_none:{ tab: 'supply', n: 'Water: none',    need: 'none', danger: 0, instant: setRat(null, 0),   d: 'No drinking (e.g. while hiding). Thirsty people will disobey.' },
    share_out: { tab: 'supply', n: 'Share out',      need: 'none', danger: 0, instant: (ids) => C.pool(ids), d: 'Pool food and water among the selected and deal it out evenly.' },
  });
  C.ORDER_TABS = [['move', 'Move'], ['fight', 'Fight'], ['recon', 'Recon'], ['camp', 'Camp'], ['people', 'People'], ['supply', 'Supply']];

  // ---------------------------------------------------------------- selection & groups
  // The ids of the selected people (alive rebels); falls back to the current group when nothing is selected.
  C.selIds = function () {
    const g = G(); g.sel = (g.sel || []).filter((id) => { const p = C.P(id); return p && p.status === 'alive' && p.mil && p.mil.side === 'rebel'; });
    if (g.sel.length) return g.sel;
    const sq = g.squads[g.curSquad]; return sq ? sq.members.slice() : [];
  };
  // Select these people: stores the list and flags their actors (msel) for the gold ring.
  C.setSel = function (ids) {
    const g = G(); g.sel = ids.slice();
    const set = new Set(g.sel);
    for (const a of g.scene.actors) a.msel = set.has(a.p.id) && !a.isPlayer;
    if (C.ui && C.ui.refreshCmd) C.ui.refreshCmd();
  };
  // The selected people's actors in the current scene.
  C.selActors = () => C.selIds().map((id) => C.P(id).actor).filter((a) => a && a.scene === G().scene && !a.dead && !a.gone);
  // Colours for up to nine groups.
  C.GROUP_COLS = ['#e4574b', '#e8a23a', '#5ab0e8', '#7fd07a', '#b58be8', '#e88bb4', '#8be8d2', '#d6d66a', '#c0875a'];
  // Create a named group (up to nine) from the given people.
  C.newGroup = function (name, ids) {
    const g = G(); if (g.squads.length >= 9) { toast('Nine groups at most'); return null; }
    const id = g.squads.length; const sq = { id, name: name || ('Group ' + (id + 1)), col: C.GROUP_COLS[id], members: [], stance: 'follow', fireNow: false, custom: true };
    g.squads.push(sq); if (ids && ids.length) C.assignGroup(id, ids); return sq;
  };
  // Move people into group n (removing them from other groups).
  C.assignGroup = function (n, ids) {
    const g = G(); const sq = g.squads[n]; if (!sq) return;
    for (const id of ids) { const p = C.P(id); if (!p || id === C.W.player) continue; for (const q of g.squads) q.members = q.members.filter((x) => x !== id); sq.members.push(id); if (p.mil) p.mil.squad = n; if (p.actor) { p.actor.squad = n; p.actor.stanceOv = null; } }
    C.ui.refresh && C.ui.refresh();
  };
  // Select all members of group n (and make it the current group).
  C.selectGroup = function (n) { const g = G(); const sq = g.squads[n]; if (!sq) return; g.curSquad = n; C.setSel(sq.members.filter((id) => C.P(id).status === 'alive')); };

  // filters on the whole party
  // Selection filters by what the person is: armed, no rifle, wounded, healthy, veterans, green, rested, women, brave, hotheads, medics & kind.
  C.FILTERS = {
    all:     ['Everyone', (p) => true],
    armed:   ['Armed', (p) => p.wpn && p.wpn !== 'machete'],
    unarmed: ['No rifle', (p) => !p.wpn || p.wpn === 'machete'],
    wounded: ['Wounded', (p) => p.hp < p.maxHp * 0.7 || p.bleed > 0],
    healthy: ['Healthy', (p) => p.hp >= p.maxHp * 0.9],
    vets:    ['Veterans', (p) => p.exp >= 45],
    greens:  ['Green', (p) => p.exp < 18],
    rested:  ['Rested', (p) => p.needs.energy > 60 && p.needs.food > 45],
    women:   ['Women', (p) => p.sex === 'F'],
    brave:   ['Brave', (p) => p.traits.includes('brave')],
    hothead: ['Hotheads', (p) => p.traits.includes('hothead')],
    kind:    ['Medics & kind', (p) => p.traits.includes('kind') || p.occ === 'medico' || p.occ === 'enfermera'],
  };
  // The living rebels (except the leader) who have actors in this scene.
  C.partyPeople = () => C.squadPeople().filter((p) => p.id !== C.W.player && p.actor && p.actor.scene === G().scene);
  // Select everyone matching a filter, optionally ordered by experience or health.
  C.selectBy = function (key, sortKey) {
    const f = C.FILTERS[key]; let ps = C.partyPeople().filter(f[1]);
    if (sortKey === 'exp') ps.sort((a, b) => b.exp - a.exp); else if (sortKey === 'hp') ps.sort((a, b) => b.hp - a.hp);
    C.setSel(ps.map((p) => p.id)); toast(`${ps.length} selected: ${f[0]}`);
  };

  // ---------------------------------------------------------------- danger
  // A weapon's relative power (damage × rate of fire relative to a rifle) for the danger estimate.
  const power = (a) => { const w = a.weapon ? C.WEAPONS[a.weapon.k] : null; if (!w) return 0.2; return clamp(w.dmg * Math.min(w.rof, 6) / 43, 0.2, 9); };
  // The enemy soldiers KNOWN to be near a point: seen in the last 120 s (using last-known positions for those now out of sight). Only what someone actually saw counts.
  C.knownEnemiesNear = function (x, y, r) {
    const g = G(), s = g.scene; const out = [];
    for (const a of s.actors) { if (a.side !== 'army' || a.dead) continue; const seen = (a.seenEver || -999) > g.time - 120; if (!seen && C.fogOn()) continue; const px = a.lastSeen && !C.visible(a) ? a.lastSeen.x : a.x, py = a.lastSeen && !C.visible(a) ? a.lastSeen.y : a.y; if (Math.hypot(px - x, py - y) < r) out.push(a); }
    return out;
  };
  // Estimate how deadly an order is: known enemy power near the target (plus a known army post) over our power (weapon × experience × health), times the order's own danger factor. Returns {level:'ok'|'risky'|'deadly', ratio, foes}.
  C.orderDanger = function (acts, order) {
    const g = G(), s = g.scene, def = C.ORDERS[order.type]; if (!def || !def.danger) return { level: 'ok', ratio: 0, foes: 0 };
    const pts = order.pts || [{ x: order.tgt ? order.tgt.x : order.x, y: order.tgt ? order.tgt.y : order.y }]; if (pts[0].x === undefined) return { level: 'ok', ratio: 0, foes: 0 };
    let theirs = 0, foes = 0; const seen = new Set();
    for (const pt of pts) {
      for (const e of C.knownEnemiesNear(pt.x, pt.y, 200)) { if (seen.has(e)) continue; seen.add(e); theirs += power(e); foes++; }
      if (s.army && C.explored(s.army.x, s.army.y) && Math.hypot(pt.x - s.army.x, pt.y - s.army.y) < 190) { theirs += 3; foes += 3; }
    }
    let ours = 0; for (const a of acts) ours += power(a) * (0.6 + a.p.exp / 150) * (a.p.hp / a.p.maxHp);
    const ratio = theirs / Math.max(0.5, ours) * def.danger;
    return { level: ratio > 2.4 ? 'deadly' : ratio > 1.3 ? 'risky' : 'ok', ratio, foes };
  };

  // willingness 0..1 to do something dangerous
  // How willing a person is to do something dangerous (0..1): trust, experience, morale, fear, stress, traits (brave/idealist/veteran up; cautious down), and an early-war bonus.
  C.willing = function (p) {
    const g = G(); let w = 0.35 + C.trustOf(p) / 160 + p.exp / 330 + (p.morale - 50) / 220 - p.fear / 260 - p.stress / 330;
    if (p.traits.includes('brave')) w += 0.2; if (p.traits.includes('idealist')) w += 0.1; if (p.traits.includes('hothead')) w += 0.08; if (p.traits.includes('cautious')) w -= 0.15; if (p.traits.includes('veteran')) w += 0.07;
    if (g.day < 120) w += 0.1 * (1 - g.day / 120);
    return clamp(w, 0.02, 0.98);
  };

  // ---------------------------------------------------------------- issuing
  // Spread a group around a target point in a grid so they do not stack on one spot.
  function slotOffset(i, n) { const cols = Math.ceil(Math.sqrt(n)); return { dx: ((i % cols) - (cols - 1) / 2) * 12, dy: (Math.floor(i / cols) - (Math.ceil(n / cols) - 1) / 2) * 12 }; }
  // Pick who steps forward: those with willingness above 0.5 (with some randomness), up to the requested count; the rest look at the ground.
  function volunteersFor(acts, order, count) {
    const def = C.ORDERS[order.type];
    const scored = acts.map((a) => ({ a, w: C.willing(a.p) * (0.7 + Math.random() * 0.6) })).sort((x, y) => y.w - x.w);
    const yes = scored.filter((q) => q.w > 0.5).slice(0, count), looked = scored.filter((q) => !yes.includes(q));
    return { yes: yes.map((q) => q.a), no: looked.map((q) => q.a) };
  }

  // THE ENTRY POINT FOR ORDERS: block while paused; supply orders apply instantly; volunteers if requested; estimate the danger; for 'deadly' orders show the argument card (reconsider / lead them yourself / that is an order); then apply.
  C.issue = function (order, opt) {
    opt = opt || {}; const g = G(), s = g.scene; if (!s) return;
    if (g.paused) { toast('No orders while paused — time is part of the pressure'); return; }
    const def = C.ORDERS[order.type]; if (!def) return;
    if (def.instant) { def.instant(C.selIds()); return; }   // supply orders: no walking, no danger
    let acts = C.selActors(); if (!acts.length) { toast('Nobody is selected (click a squad or Ctrl-drag a box)'); return; }
    // volunteers
    if (g.cmd && g.cmd.vol > 0 && !opt.volDone && def.danger > 0.15 && order.type !== 'follow') {
      const v = volunteersFor(acts, order, g.cmd.vol);
      if (!v.yes.length) { C.ui.card({ title: 'Nobody steps forward', icon: '🙋', body: `You ask for ${g.cmd.vol} volunteers for "${def.n}". Eyes go to the ground.`, choices: [{ label: 'Order someone anyway', fn: () => C.issue(order, Object.assign({}, opt, { volDone: true })) }, { label: 'Forget it', fn: () => { } }] }); return; }
      for (const a of v.yes) { C.addTrust(a.p, 2); C.say(a, '¡Yo voy!', '#1d4a1d', 2); }
      for (const a of v.no) { C.say(a, '...', '#555', 1.4); }
      acts = v.yes; if (v.yes.length < g.cmd.vol) toast(`${v.yes.length} of ${g.cmd.vol} volunteered`);
      opt.volDone = true; opt.volunteered = true;
    }
    // danger
    const dg = C.orderDanger(acts, order);
    if (dg.level === 'deadly' && !opt.insist && !opt.volunteered) {
      const worst = acts.slice().sort((a, b) => C.willing(a.p) - C.willing(b.p)).slice(0, 3).map((a) => C.tagName(a.p));
      const lead = g.player; const near = lead && acts.some((a) => Math.hypot(a.x - lead.x, a.y - lead.y) < 90);
      C.ui.card({ title: 'They think it is a death sentence', icon: '⚠',
        body: `${worst.join(', ')} look at the position you point to. ${dg.foes} soldiers are dug in there, as far as anyone has seen, and you are asking ${acts.length} people to walk into it.\n\n"Jefe, you are sending us to die."`,
        choices: [
          { label: 'Reconsider', sub: 'Nobody is blamed for asking', fn: () => { acts.forEach((a) => C.addTrust(a.p, 1)); } },
          { label: 'Lead them yourself', sub: 'They trust a leader who goes first — more so early in the war', fn: () => C.issue(order, Object.assign({}, opt, { insist: true, led: true })) },
          { label: 'That is an order', sub: 'Some may refuse. Those who go will remember it.', fn: () => C.issue(order, Object.assign({}, opt, { insist: true })) },
        ] });
      return;
    }
    apply(acts, order, dg, opt);
  };

  // Apply an order to each person: refusal outcomes for deadly orders (a refuser deserts or balks), obedience roll otherwise (a 'no' is spoken and retried), trust changes, queueing, and the order marker.
  function apply(acts, order, dg, opt) {
    const g = G(), s = g.scene, def = C.ORDERS[order.type]; const n = acts.length;
    const refused = [], deserted = [], balked = [];
    acts.forEach((a, i) => {
      const p = a.p; const off = slotOffset(i, n);
      let comply = Math.random() < AI().obedience(a) + 0.12 + (opt.led ? 0.2 : 0) + (opt.volunteered ? 0.3 : 0);
      if (dg.level === 'deadly') {
        const w = C.willing(p) + (opt.led ? 0.3 * Math.max(0.2, 1 - g.day / 500) + 0.12 : 0) + (opt.volunteered ? 0.3 : 0);
        if (Math.random() > w) { // refuses outright
          refused.push(p);
          if (Math.random() < 0.65) deserted.push(p); else balked.push(p);
          return;
        }
        C.addTrust(p, opt.led ? 1 : -5); p.morale = clamp(p.morale - 6, 0, 100); p.fear = clamp(p.fear + 8, 0, 100); a.deadly = g.time;
      } else if (dg.level === 'risky' && !opt.led && !opt.volunteered) { C.addTrust(p, -0.6); }
      if (!comply) { C.say(a, AI().whyNot(a), '#7a1d1d', 2.6); a.pendingOrder = makeOrder(order, off, a, i); a.retryT = 5 + Math.random() * 5; p.morale = Math.max(0, p.morale - 0.3); return; }
      const o = makeOrder(order, off, a, i);
      a.pendingOrder = null; a.path = null; a.pathFor = null;
      if (opt.queue && a.order) { (a.orderQ = a.orderQ || []).push(o); }
      else { a.order = o; a.orderT = 0.15 + Math.random() * 0.6; a.orderQ = []; if (order.type !== 'forage') { a.stanceOv = null; a.working = false; a.watching = false; } if (Math.random() < 0.3) C.say(a, C.es ? 'Sí, jefe' : 'Yes, chief', '#1d4a1d', 1.4); }
      if (order.type === 'follow') { a.order = null; a.stanceOv = 'follow'; a.watching = false; }
      if (order.type === 'forage') { a.order = null; a.stanceOv = 'forage'; }
      if (order.type === 'hide') { a.order = null; a.stanceOv = 'ambush'; }
    });
    const pt = order.tgt ? order.tgt : (order.pts ? order.pts[0] : order);
    if (pt && pt.x !== undefined && order.type !== 'follow') g.orderMarks.push({ x: pt.x, y: pt.y, t: 0, col: dg.level === 'deadly' ? '#ff5a4a' : '#ffe07a' });
    if (refused.length) refuseOutcome(refused, deserted, balked, order);
    else if (dg.level !== 'ok' && order.type !== 'retreat') toast(dg.level === 'deadly' ? 'They go, grimly.' : 'They do not like the odds.');
  }

  // Create each person's own copy of the order with a formation offset.
  function makeOrder(order, off, a, i) {
    const o = Object.assign({ t: 0, phase: 'go', w: 0 }, order);
    if (o.pts) o.pts = o.pts.map((q) => ({ x: q.x + off.dx * 0.5, y: q.y + off.dy * 0.5 })), o.pi = 0;
    else if (o.x !== undefined && !o.tgt) { o.x += off.dx; o.y += off.dy; }
    return o;
  }

  // Consequences of a refusal: balkers lose trust and stand still; deserters leave the troop (support near zero, a few defect to the army and may inform, their families hear why); summary card.
  function refuseOutcome(refused, deserted, balked, order) {
    const g = G();
    for (const p of balked) { C.addTrust(p, -9); p.morale = clamp(p.morale - 8, 0, 100); if (p.actor) C.say(p.actor, 'No voy. Es una muerte segura.', '#7a1d1d', 4); }
    for (const p of deserted) {
      // they are certain they are being sent to die: support drops to near nothing and they leave
      p.trueStance = Math.min(p.trueStance, -8 + Math.random() * 6); p.stance = p.trueStance; p.conv = Math.max(8, p.conv * 0.3); p.trust = 5;
      for (const sq of g.squads) sq.members = sq.members.filter((id) => id !== p.id);
      const defect = Math.random() < 0.3 && p.sex === 'M';
      if (p.actor) { C.say(p.actor, '¡Me largo!', '#7a1d1d', 3); p.actor.order = { type: 'move', x: p.actor.x + (Math.random() - 0.5) * 400, y: p.actor.y + 300, flee: true }; p.actor.squad = -1; p.actor.deserting = true; }
      p.mil = defect ? { side: 'army', rank: 'Soldado' } : null; p.status = 'away';
      if (defect) { p.informant = true; p.revealed = false; g.regime.heat += 1.5; }
      C.addEvent({ type: 'desertion', victim: p, perpSide: 'rebel', sev: 44, pub: 0.2, x: 0, y: 0, settlement: p.settlement, text: `${C.tagName(p)} left the rebels rather than obey a suicidal order`, memText: 'My son said the rebels sent men to certain death' });
    }
    g.stats.refused = (g.stats.refused || 0) + refused.length;
    const nm = (l) => l.map(C.tagName).join(', ');
    C.ui.card({ title: 'They will not go', icon: '✋', body: `${nm(refused)} refuse${refused.length === 1 ? 's' : ''}.\n\n${deserted.length ? nm(deserted) + ' walk' + (deserted.length === 1 ? 's' : '') + ' out of the camp. Whatever they felt for the cause is gone, and their families will hear why.\n' : ''}${balked.length ? nm(balked) + ' stand' + (balked.length === 1 ? 's' : '') + ' rooted to the spot and will not look at you.' : ''}`, choices: [{ label: 'It cannot be helped', fn: () => { } }] });
  }

  // Finish an order: start the next queued one or return to the stance.
  function endOrder(a, keepStance) {
    a.working = false; a.path = null; a.pathFor = null;
    if (a.orderQ && a.orderQ.length) { a.order = a.orderQ.shift(); a.orderT = 0.1; return; }
    a.order = null; if (!keepStance && a.stanceOv && !['forage'].includes(a.stanceOv)) a.stanceOv = null;
  }
  // Backspace: cancel orders of the selection.
  C.stopOrders = function () {
    const g = G(); if (g.paused) { toast('No orders while paused'); return; }
    for (const a of C.selActors()) { a.order = null; a.orderQ = []; a.pendingOrder = null; a.stanceOv = null; a.working = false; a.watching = false; a.path = null; }
    toast('Orders cancelled — back to the squad stance');
  };

  // ---------------------------------------------------------------- execution (called from rebelUpdate)
  // Tasks that are dropped when the shooting starts.
  const NONCOMBAT = { dig: 1, latrine: 1, water: 1, carry: 1, build: 1, rest: 1, treat: 1, help: 1, feed: 1, macro: 1 };
  // Walk toward a point with the AI's path helpers; true on arrival.
  function goto(s, a, o, x, y, dt, mult) {
    const AIx = AI();
    if (!a.path || a.pathFor !== o || o.gx !== x || o.gy !== y) { AIx.setPath(s, a, x, y); a.pathFor = o; o.gx = x; o.gy = y; }
    const done = AIx.followPath(s, a, dt, a.speed * (mult || 1) * AIx.terrainSpeed(s, a));
    return done || Math.hypot(x - a.x, y - a.y) < 12;
  }
  // Nearest item of a list passing a filter.
  function nearest(list, a, f) { let best = null, bd = 9e9; for (const o of list) { if (f && !f(o)) continue; const d = Math.hypot(o.x - a.x, o.y - a.y); if (d < bd) { bd = d; best = o; } } return best; }
  // The nearest shallow-water tile (cached per scene).
  function waterSpot(s, a) {
    if (s.waterCache === undefined) { const pts = []; for (let ty = 1; ty < s.th - 1; ty++) for (let tx = 1; tx < s.tw - 1; tx++) { const t = s.tiles[ty * s.tw + tx]; if (t === TL.SHAL) pts.push({ x: tx * T + 8, y: ty * T + 8 }); } s.waterCache = pts; }
    return nearest(s.waterCache, a);
  }

  // returns true when the order consumed this frame (the unit should not run its stance behaviour)
  // THE ORDER EXECUTOR (called from rebelUpdate each frame): the behaviour of each order — attack (advance and stop to fight), focus, ambush/watch/hold/guard (go there then hold with a stance override), patrol (loop between points), retreat (run, no firing), scout/stalk (sneak, look 14 s, report, return), dig/latrine/rest/build (go, work, effect), water (fetch and bring back), carry (collect ground items and bring them), treat (bandage the nearest wounded), help/feed (work for a peasant or livestock), mortar. Returns true when it consumed the frame.
  C.runOrder = function (s, a, o, dt, lead, tgt) {
    const g = G(), p = a.p, def = C.ORDERS[o.type]; if (!def) { a.order = null; return false; }
    // non-combat tasks are dropped when the shooting starts
    if (NONCOMBAT[o.type] && (tgt || a.lastHit > g.time - 4 || a.suppressed > 0)) { a.working = false; return false; }
    const run = 1;
    switch (o.type) {
      case 'move': return false; // handled by rebelUpdate's original branch
      case 'attack': {
        if (tgt) { a.moving = false; return false; }
        if (goto(s, a, o, o.x, o.y, dt, 1)) { a.stanceOv = 'hold'; endOrder(a, true); }
        return true;
      }
      case 'focus': {
        const t = o.tgt; if (!t || t.dead || t.inside) { endOrder(a); return false; }
        a.target = t; if (Math.hypot(t.x - a.x, t.y - a.y) > (a.weapon ? C.WEAPONS[a.weapon.k].rng * 0.8 : 60)) { goto(s, a, o, t.x, t.y, dt, 1); return false; }
        a.moving = false; return false;
      }
      case 'mortar': return runMortar(s, a, o, dt, lead, tgt);
      case 'ambush': case 'watch': case 'hold': case 'guard': {
        const sneaky = o.type === 'ambush' || o.type === 'watch';
        a.hide = sneaky; if (goto(s, a, o, o.x, o.y, dt, sneaky ? 0.7 : 1)) { a.stanceOv = o.type === 'hold' || o.type === 'guard' ? 'hold' : 'ambush'; a.watching = o.type === 'watch' || o.type === 'guard'; a.face = lead && lead.x < a.x ? -1 : 1; endOrder(a, true); }
        return true;
      }
      case 'patrol': {
        if (tgt) { a.moving = false; return false; }
        const pt = o.pts[o.pi % o.pts.length]; if (goto(s, a, o, pt.x, pt.y, dt, 0.9)) { o.pi++; a.path = null; a.pathFor = null; }
        return true;
      }
      case 'retreat': {
        a.target = null; a.running = true; if (goto(s, a, o, o.x, o.y, dt, 1.3)) { a.running = false; a.stanceOv = 'follow'; endOrder(a); } return true;
      }
      case 'scout': case 'sneak': {
        a.hide = true; let tx = o.x, ty = o.y;
        if (o.type === 'sneak') { const t = o.tgt; if (!t || t.dead) { endOrder(a); return false; } tx = t.x; ty = t.y; if (Math.hypot(tx - a.x, ty - a.y) < 115) { a.stanceOv = 'ambush'; a.watching = true; endOrder(a, true); return true; } }
        if (o.phase === 'go') { if (goto(s, a, o, tx, ty, dt, 0.65)) { o.phase = 'look'; o.w = 0; } return true; }
        if (o.phase === 'look') { a.moving = false; o.w += dt; a.watching = true; if (o.w > 14) { a.watching = false; o.phase = 'back'; const n = C.knownEnemiesNear(o.x, o.y, 240).length; if (!o.reported) { o.reported = true; C.say(a, n ? `Vi ${n} soldados` : 'Despejado', '#1d3a6a', 4); C.log(`${C.tagName(p)} reports: ${n ? n + ' soldiers near the spot.' : 'nothing moving there.'}`, 'info'); } } return true; }
        a.hide = false; if (goto(s, a, o, lead.x, lead.y, dt, 1)) endOrder(a); return true;
      }
      case 'dig': case 'latrine': case 'rest': case 'build': {
        let tx = o.x, ty = o.y; if (o.type === 'build') { const b = o.pad; if (!b || b.built) { endOrder(a); return false; } tx = (b.x + b.w / 2) * T; ty = (b.y + b.h + 1) * T; }
        if (o.phase === 'go') { if (goto(s, a, o, tx, ty, dt, 1)) { o.phase = 'work'; o.w = 0; } return true; }
        a.moving = false; a.working = true; o.w += dt; a.anim += dt * 6;
        if (o.type === 'rest') { a.sleeping = true; p.needs.energy = clamp(p.needs.energy + dt * 1.6, 0, 100); p.hp = Math.min(p.maxHp, p.hp + dt * 0.25); }
        if (o.w >= def.work) {
          a.sleeping = false;
          if (o.type === 'dig') { (s.foxholes = s.foxholes || []).push({ x: a.x, y: a.y }); s.decals.push({ k: 'foxhole', x: a.x, y: a.y, r: 7, a: 0.9, rot: 0, t0: g.time }); a.hide = true; a.stanceOv = 'hold'; p.exp = Math.min(100, p.exp + 0.2); endOrder(a, true); return true; }
          if (o.type === 'latrine') { if (!o.pad) { g.hygiene = clamp((g.hygiene === undefined ? 70 : g.hygiene) + 28, 0, 100); s.decals.push({ k: 'latrine', x: a.x + 6, y: a.y, r: 4, a: 0.9, rot: 0, t0: g.time }); C.log(`${C.tagName(p)} dug a latrine. The camp will be healthier.`, 'good'); } }
          if (o.type === 'build') { o.pad.labor = (o.pad.labor || 0) + 1; C.log(`${C.tagName(p)} worked on the ${o.pad.label.replace('Solar: ', '')}. Cost now ${C.padCost(o.pad)[0]} pesos.`, 'info'); }
          endOrder(a); a.working = false;
        }
        return true;
      }
      case 'water': {
        if (o.phase === 'go') { const w = waterSpot(s, a); if (!w) { toast('There is no water on this map'); endOrder(a); return false; } if (goto(s, a, o, w.x, w.y, dt, 1)) { o.phase = 'work'; o.w = 0; } return true; }
        if (o.phase === 'work') { a.moving = false; a.working = true; o.w += dt; if (o.w >= def.work) { o.phase = 'back'; a.working = false; } return true; }
        if (goto(s, a, o, lead.x, lead.y, dt, 1)) { const sq = g.squads[a.squad]; let n = 0; if (sq) for (const id of sq.members) { const q = C.P(id); if (q.status === 'alive') { q.needs.water = clamp(q.needs.water + 20, 0, 100); n++; } } p.needs.water = clamp(p.needs.water + 25, 0, 100); C.log(`${C.tagName(p)} brought water for ${n}.`, 'good'); endOrder(a); } return true;
      }
      case 'macro': return C.macroRun(s, a, o, dt, lead, tgt);   // recorded/preset action (actions.js)
      case 'carry': {
        if (o.phase === 'go') { if (goto(s, a, o, o.x, o.y, dt, 1)) { o.phase = 'back'; o.haul = []; for (const it of s.items.slice()) if (Math.hypot(it.x - a.x, it.y - a.y) < 80 && o.haul.length < 4 && ['food', 'ammo', 'med', 'fuel', 'money', 'gun'].includes(it.k)) { o.haul.push(it); s.items.splice(s.items.indexOf(it), 1); } if (!o.haul.length) { C.log(`${C.tagName(p)} found nothing to carry there.`, 'info'); endOrder(a); } } return true; }
        if (goto(s, a, o, lead.x, lead.y, dt, 0.9)) { for (const it of o.haul) C.ui.take(it); C.log(`${C.tagName(p)} brought back ${o.haul.length} load${o.haul.length > 1 ? 's' : ''}.`, 'good'); endOrder(a); } return true;
      }
      case 'treat': {
        if (!o.pt || o.pt.p.status !== 'alive' || (o.pt.p.hp >= o.pt.p.maxHp * 0.8 && !o.pt.p.bleed)) { o.pt = nearest(s.actors.filter((q) => q.side === 'rebel' || q.isPlayer), a, (q) => q !== a && !q.dead && (q.p.hp < q.p.maxHp * 0.75 || q.p.bleed > 0)); o.w = 0; if (!o.pt) { endOrder(a); return false; } }
        if (g.res.med < 1) { C.log('No medicine left to treat anyone.', 'warn'); endOrder(a); return false; }
        if (Math.hypot(o.pt.x - a.x, o.pt.y - a.y) > 14) { goto(s, a, o, o.pt.x, o.pt.y, dt, 1.1); return true; }
        a.moving = false; a.working = true; o.w += dt; if (o.w > 5) { g.res.med--; const q = o.pt.p; q.hp = Math.min(q.maxHp, q.hp + 28); q.bleed = 0; C.bondEvent(p, q, 'treated'); if (q.cracks) q.cracks.forEach((c) => (c.l -= 0.4)); C.say(a, 'Ya está', '#1d4a1d', 2); o.w = 0; o.pt = null; a.working = false; }
        return true;
      }
      case 'help': case 'feed': {
        if (!o.pt || o.pt.dead) { o.pt = o.type === 'help' ? nearest(s.actors, a, (q) => q.side === 'civ' && !q.dead && !q.inside && ['campesino', 'guajiro', 'macheteo', 'colono', 'carbonero', 'vaquero', 'pescador'].includes(q.p.occ)) || nearest(s.actors, a, (q) => q.side === 'civ' && !q.dead && !q.inside) : nearest(s.animals, a, (q) => !q.dead && q.wild === false); o.w = 0; if (!o.pt) { toast(o.type === 'help' ? 'No one nearby to help' : 'No livestock nearby'); endOrder(a); return false; } }
        if (Math.hypot(o.pt.x - a.x, o.pt.y - a.y) > 18) { goto(s, a, o, o.pt.x, o.pt.y, dt, 1); return true; }
        a.moving = false; a.working = true; a.anim += dt * 5; o.w += dt;
        if (o.w >= def.work) {
          if (o.type === 'help') { const v = o.pt.p; v.needs.hope = clamp(v.needs.hope + 10, 0, 100); v.needs.dignity = clamp(v.needs.dignity + 6, 0, 100); C.addEvent({ type: 'aid', victim: v, perpSide: 'rebel', positive: true, sev: 26, pub: 0.15, x: a.x, y: a.y, settlement: v.settlement, text: `${C.tagName(p)} helped ${C.tagName(v)} with the work`, memText: 'A rebel soldier worked beside us and asked for nothing' }); g.trust.peasants = clamp(g.trust.peasants + 0.004, 0.02, 1); }
          else { g.trust.peasants = clamp(g.trust.peasants + 0.001, 0.02, 1); p.morale = clamp(p.morale + 1.5, 0, 100); }
          p.morale = clamp(p.morale + 1, 0, 100); endOrder(a);
        }
        return true;
      }
      default: endOrder(a); return false;
    }
  };

  // ---- mortar crew behaviour ------------------------------------------------------------------------------------------------
  // Gunner (weapon.k === 'mortar'): walk into range -> deploy 6 s -> fire a shell every 3 s -> pack up 4 s.
  // Crew (anyone else): stay near the gunner and top up his shells from their own packs.
  // Accuracy: error radius = 14 + 0.06·distance + (no spotter on target ? 36 : 0) − 0.12·experience.
  function runMortar(s, a, o, dt, lead, tgt) {
    const g = G(), p = a.p;
    const gunner = a.weapon && a.weapon.k === 'mortar';
    if (!gunner) {
      // a crewman: shadow the nearest gunner and hand over shells
      const gun = s.actors.find((q) => !q.dead && q.weapon && q.weapon.k === 'mortar' && q.order && q.order.type === 'mortar');
      if (!gun) { endOrder(a); return false; }
      if (Math.hypot(gun.x - a.x, gun.y - a.y) > 26) { goto(s, a, o, gun.x + 10, gun.y + 8, dt, 1); return true; }
      a.moving = false; a.working = true;
      C.initInv(p); C.initInv(gun.p);
      if ((p.inv.shell || 0) > 0 && (gun.p.inv.shell || 0) < 2) { C.give(p, gun.p, 'shell', 1); }
      return true;
    }
    C.initInv(p); const W = C.WEAPONS.mortar;
    const dist = Math.hypot(o.x - a.x, o.y - a.y);
    if (o.phase === 'go') {
      if (dist < 90) { // too close: back away along the line from the target
        const k = 110 / Math.max(1, dist); goto(s, a, o, a.x + (a.x - o.x) * k * 0.3, a.y + (a.y - o.y) * k * 0.3, dt, 0.9); return true; }
      if (dist > W.rng) { goto(s, a, o, a.x + (o.x - a.x) * 0.2, a.y + (o.y - a.y) * 0.2, dt, 1); return true; }
      o.phase = 'setup'; o.w = 0; o.shots = 0; return true;
    }
    a.moving = false; a.working = true; o.w += dt;
    if (o.phase === 'setup') { if (o.w >= 6) { o.phase = 'fire'; o.w = 3; C.say(a, 'Listo el mortero', '#1d4a1d', 2); } return true; }
    if (o.phase === 'fire') {
      if (o.w >= 3) {
        if ((p.inv.shell || 0) <= 0) { C.say(a, '¡Sin granadas!', '#7a1d1d', 2); o.phase = 'pack'; o.w = 0; return true; }
        o.w = 0; p.inv.shell--; o.shots++;
        const spotted = C.pointSeen(o.x, o.y); const err = clamp(14 + 0.06 * dist + (spotted ? 0 : 36) - 0.12 * p.exp, 8, 90);
        const ang = Math.random() * 6.283, r = Math.random() * err; const ix = o.x + Math.cos(ang) * r, iy = o.y + Math.sin(ang) * r;
        C.mortar(s, ix, iy, 1.9 + dist / 500);
        C.snd && C.snd.shot(3, a.x, a.y, a.side); a.shooting = 0.6; a.muzzle = 0.1; a.exposed = 8; g.combatT = 8; C.fx.smoke(s, a.x, a.y - 6, 'smoke');
        if (o.shots >= (o.n || 6)) { o.phase = 'pack'; o.w = 0; }
      }
      return true;
    }
    if (o.phase === 'pack') { if (o.w >= 4) { a.working = false; endOrder(a); } return true; }
    return true;
  }

  // FOXHOLES: a unit standing in one takes half damage from bullets.
  // foxhole cover (used by combat.hurt)
  // (see above)
  C.inFoxhole = function (a) { const s = a.scene; if (!s || !s.foxholes) return false; for (const f of s.foxholes) if (Math.abs(f.x - a.x) < 9 && Math.abs(f.y - a.y) < 9) return true; return false; };

  // LABOUR: each worker who has helped cuts a camp building's cost 15% (up to 50%).
  // building discounts from labour
  // (see above)
  C.padCost = function (b) { const k = b.slot; const cost = C.BUILD_COST[k]; const f = 1 - Math.min(0.5, (b.labor || 0) * 0.15); return [Math.ceil(cost[0] * f), Math.ceil(cost[1] * 0.25 * f)]; };

  // DAILY UPKEEP: camp hygiene decays (dysentery strikes when it is low and there is no latrine); leading from the front under fire earns trust (more in the early war).
  // ---------------------------------------------------------------- daily upkeep
  // (see above)
  C.ordersDaily = function () {
    const g = G(); if (g.hygiene === undefined) g.hygiene = 70;
    const party = C.squadPeople().length; g.hygiene = clamp(g.hygiene - (0.8 + party * 0.06), 0, 100);
    if (g.hygiene < 25 && party > 5 && Math.random() < 0.22) {
      const sick = C.squadPeople().filter((p) => p.id !== C.W.player).sort(() => Math.random() - 0.5).slice(0, 1 + Math.floor(Math.random() * 3));
      for (const p of sick) { p.health = clamp(p.health - 12, 0, 100); p.needs.energy = clamp(p.needs.energy - 12, 0, 100); }
      C.log(`Dysentery in the camp (${sick.map(C.tagName).join(', ')}). Dig a latrine.`, 'bad'); g.hygiene = clamp(g.hygiene + 6, 0, 100);
    }
    // leading from the front earns trust (early war more than late)
    for (const p of C.squadPeople()) { if (p.id === C.W.player) continue; if (p.leadAcc > 4) { const k = Math.max(0.3, 1 - g.day / 520); C.addTrust(p, Math.min(2.5, p.leadAcc / 25) * k * 1.6); } p.leadAcc = 0; }
  };
})();
