/* CUBEA — inventory.js : what each person carries, and what happens to it.

   WHY THIS EXISTS
   Before this module food, water and ammunition were one anonymous pile (`g.res`). Real columns do not work like that:
   each man carries a few rations and a canteen, a heavy weapon needs a carrier and ammunition bearers, and the hungry
   man's compadre gives him half his bread.  This file models that, in four layers:

     1. ITEM DEFINITIONS   (C.ITEMS)  — weight, label, which `g.res` key is the "column stores" version of the item.
     2. PERSONAL INVENTORY (p.inv)    — counts per item, limited by a *carrying capacity* in weight units.
     3. HOLDERS & TRANSFERS (C.transfer) — one function moves items between a person, the column's stores, and the
                                        ground; the drag-and-drop UI (cmdui/inventory panel) is a thin skin over it.
     4. DAILY LIFE (C.invTick, C.mealTime) — eating, drinking, sharing with nearby comrades, ration restrictions and the
                                        disobedience that follows when people are too hungry/thirsty/disloyal.

   DATA SHAPES
     p.inv  = { food, water, ammo, med, gren, molo, shell, rocket }   integers (ammo = loose rounds)
     p.rat  = { f: 0..1, w: 0..1 }   ration allowance set by orders. 1 = eat/drink freely, 0.5 = sparingly, 0 = forbidden.
     p.trust (0..100) is reused: breaking a ration order costs trust both ways (you ordered it; they ignored it).

   All numbers live in the TUNE block below so they can be balanced in one place.
*/
(function () {
  'use strict';
  const C = window.C, G = () => C.G, clamp = C.clamp;

  // ------------------------------------------------------------------------------------------------------------------
  // TUNE — every balance knob for this module.
  // ------------------------------------------------------------------------------------------------------------------
  const TUNE = {
    baseCapacity: 14,        // weight units an average healthy adult can carry in addition to their weapon's weight
    eatBelow: 45,            // a person with free rations eats when needs.food falls below this
    drinkBelow: 50,          // ... and drinks when needs.water falls below this
    ration: 34,              // needs.food restored by one food item (matches the old meal size)
    gulp: 30,                // needs.water restored by one water item (a canteen "unit")
    shareRange: 38,          // world px within which comrades will share (about 2.5 tiles)
    shareEvery: 3.5,         // seconds between a person's sharing checks
    topUp: { food: 3, water: 2, med: 0, gren: 0 }, // what each rebel is topped up to at resupply (if capacity allows)
    restrictedFloor: 22,     // a person on restricted rations will still eat/drink if the need falls below this
  };
  C.INV_TUNE = TUNE;

  // ------------------------------------------------------------------------------------------------------------------
  // 1. ITEM DEFINITIONS
  //    w   = weight per unit.   res = the key of g.res that holds the column's stock of the same thing (or null).
  //    ammo is counted in single rounds, so its weight is tiny per unit.
  // ------------------------------------------------------------------------------------------------------------------
  C.ITEMS = {
    food:   { n: 'Ration',        icon: '🍚', w: 1.0,  res: 'food', d: 'A day\'s food: rice, beans, a little salt pork.' },
    water:  { n: 'Canteen',       icon: '💧', w: 1.0,  res: null,   d: 'A canteen of water. Refill at any stream or the camp barrel.' },
    ammo:   { n: 'Cartridges',    icon: '•',  w: 0.02, res: 'ammo', d: 'Loose rounds. Reloads draw on these.' },
    med:    { n: 'Medicine',      icon: '✚',  w: 0.3,  res: 'med',  d: 'Bandages, sulfa, iodine.' },
    gren:   { n: 'Grenade',       icon: '💣', w: 1.0,  res: 'gren', d: 'A fragmentation grenade.' },
    molo:   { n: 'Molotov',       icon: '🍾', w: 1.0,  res: 'molo', d: 'A bottle of fuel and rag.' },
    shell:  { n: 'Mortar shell',  icon: '🚀', w: 3.0,  res: 'shell', d: 'A 60 mm mortar bomb. Heavy.' },
    rocket: { n: 'Bazooka rocket', icon: '🎯', w: 2.5, res: 'rocket', d: 'A 2.36-inch rocket for the bazooka.' },
    // --- tools and materials for work in the world (farming, camp life, teaching) ---
    hoe:    { n: 'Hoe (azada)',    icon: '⛏', w: 2.0,  res: 'hoe',    d: 'For clearing and planting a plot.' },
    axe:    { n: 'Axe (hacha)',    icon: '🪓', w: 2.5,  res: 'axe',    d: 'For felling trees; a machete does it slowly.' },
    seed:   { n: 'Seed',           icon: '🌱', w: 0.4,  res: 'seed',   d: 'Maize, beans, malanga and yuca cuttings, by the handful.' },
    bucket: { n: 'Bucket',         icon: '🪣', w: 1.5,  res: 'bucket', d: 'To carry water to animals, crops and the kitchen.' },
    bwater: { n: 'Water in bucket', icon: '💦', w: 1.0, res: null,     d: 'A bucket of water (needs a bucket to carry).' },
    feed:   { n: 'Pig feed',       icon: '🥣', w: 1.0,  res: 'feed',   d: 'Scraps, bran and boiled roots for the pigs.' },
    lena:   { n: 'Firewood (leña)', icon: '🪵', w: 1.5, res: 'lena',   d: 'Dry wood for the kitchen fire.' },
    stake:  { n: 'Survey stake',   icon: '🚩', w: 0.5,  res: 'stake',  d: 'A stick with a red rag, to mark a boundary.' },
    hammock:{ n: 'Hammock (hamaca)', icon: '🛏', w: 1.5, res: 'hammock', d: 'Canvas hammock; keeps a man off the wet ground.' },
    primer: { n: 'Reading primer', icon: '📖', w: 0.2,  res: 'primer', d: 'A primer (cartilla) for teaching letters.' },
    snare: { n: 'Snare (trampa)',  icon: '🪤', w: 0.4, res: 'snare', d: 'Wire or fibre snare for jutías, guinea fowl and quail. Silent.' },
    line: { n: 'Fishing line', icon: '🎣', w: 0.2, res: 'line', d: 'Line and hook for the river and the shore.' },
    pamph:  { n: 'Pamphlets',      icon: '📰', w: 0.05, res: 'pamph',  d: 'Printed leaflets and manifestos.' },
  };
  C.ITEM_KEYS = Object.keys(C.ITEMS);

  // Weight of each weapon when carried. (Phase "period weapons" extends C.WEAPONS; anything missing counts as 4.)
  C.weaponWeight = (k) => (C.WEAPONS[k] && C.WEAPONS[k].wt !== undefined ? C.WEAPONS[k].wt : 4);

  // ------------------------------------------------------------------------------------------------------------------
  // 2. PERSONAL INVENTORY
  // ------------------------------------------------------------------------------------------------------------------

  /** A stable personal "strength" multiplier (0.85–1.15) from the person's id, so strength is an individual trait,
   *  not a sex or age stereotype. Age and health then modify it. */
  C.strengthOf = function (p) {
    const base = 0.85 + ((p.id * 2654435761) >>> 0) % 31 / 100;
    const age = C.ageOf(p); const ageK = age < 16 ? 0.7 : age > 55 ? 0.8 : age > 45 ? 0.92 : 1;
    const hurt = clamp(p.hp / p.maxHp, 0.35, 1);
    return base * ageK * (0.6 + 0.4 * hurt) * (p.limp ? 0.85 : 1);
  };

  /** Maximum weight this person can carry, counting their weapon. */
  C.capacityOf = (p) => TUNE.baseCapacity * C.strengthOf(p) + 3;

  /** Current weight carried (inventory + equipped weapon + its spare rounds). */
  C.loadOf = function (p) {
    let w = 0; const inv = p.inv || {};
    for (const k of C.ITEM_KEYS) w += (inv[k] || 0) * C.ITEMS[k].w;
    if (p.wpn) w += C.weaponWeight(p.wpn);
    const a = p.actor; if (a && a.weapon && a.weapon.spare) w += a.weapon.spare * 0.02;
    return w;
  };

  /** Create an empty/default inventory the first time a person joins the rebels (or the player). */
  C.initInv = function (p) {
    if (p.inv) return p.inv;
    p.inv = { food: 2, water: 2, ammo: 0, med: 0, gren: 0, molo: 0, shell: 0, rocket: 0 };
    if (p.occ === 'medico' || p.roster === 'che') p.inv.med = 3;      // medics carry the bandages
    p.rat = p.rat || { f: 1, w: 1 };
    return p.inv;
  };

  /** How many more of item k this person could carry right now (by weight). */
  C.canCarry = function (p, k) {
    C.initInv(p); const room = C.capacityOf(p) - C.loadOf(p); return Math.max(0, Math.floor(room / C.ITEMS[k].w + 1e-6));
  };

  /** Add up to n of item k; returns how many were actually added. */
  C.invAdd = function (p, k, n) {
    C.initInv(p); const add = Math.min(n, C.canCarry(p, k)); if (add > 0) p.inv[k] = (p.inv[k] || 0) + add; return add;
  };

  /** Remove up to n of item k; returns how many were actually removed. */
  C.invTake = function (p, k, n) {
    C.initInv(p); const t = Math.min(n, p.inv[k] || 0); p.inv[k] = (p.inv[k] || 0) - t; return t;
  };

  // ------------------------------------------------------------------------------------------------------------------
  // 3. HOLDERS AND TRANSFERS
  //    A *holder* is one of
  //      { kind:'person', p }   a person's pack
  //      { kind:'stores' }      the column's stores (g.res): mules, the camp storehouse
  //      { kind:'ground', s, x, y }  the floor; items dropped become s.items entries that anyone can pick up
  //    C.transfer moves n of item k from one holder to another, respecting weight limits, and returns the number moved.
  // ------------------------------------------------------------------------------------------------------------------
  C.holderHas = function (h, k) {
    const g = G();
    if (h.kind === 'person') return (C.initInv(h.p)[k] || 0);
    if (h.kind === 'stores') { const rk = C.ITEMS[k].res; return rk ? Math.floor(g.res[rk] || 0) : (C.nearWater(h) ? 99 : 0); }
    if (h.kind === 'ground') return h.s.items.filter((it) => it.k === k && Math.hypot(it.x - h.x, it.y - h.y) < 14).reduce((a, it) => a + (it.amount || 1), 0);
    return 0;
  };
  /** Stores can only hand out water where there is a barrel or stream (the Sierra camp has one). */
  C.nearWater = () => { const g = G(); return !!(g.scene && (g.scene.sid === 'sierra' || g.base.built.cocina)); };

  C.transfer = function (from, to, k, n) {
    const g = G(); const def = C.ITEMS[k]; if (!def || n <= 0) return 0;
    let n1 = Math.min(n, C.holderHas(from, k)); if (n1 <= 0) return 0;
    // how much can the destination take?
    if (to.kind === 'person') n1 = Math.min(n1, C.canCarry(to.p, k));
    if (n1 <= 0) return 0;
    // remove from source
    if (from.kind === 'person') C.invTake(from.p, k, n1);
    else if (from.kind === 'stores') { if (def.res) g.res[def.res] = Math.max(0, (g.res[def.res] || 0) - n1); }
    else if (from.kind === 'ground') {
      let need = n1; for (const it of from.s.items.slice()) { if (need <= 0) break; if (it.k !== k || Math.hypot(it.x - from.x, it.y - from.y) >= 14) continue; const have = it.amount || 1; const t = Math.min(have, need); it.amount = have - t; need -= t; if (it.amount <= 0) from.s.items.splice(from.s.items.indexOf(it), 1); }
    }
    // put into destination
    if (to.kind === 'person') C.invAdd(to.p, k, n1);
    else if (to.kind === 'stores') { if (def.res) g.res[def.res] = (g.res[def.res] || 0) + n1; }
    else if (to.kind === 'ground') { to.s.items.push({ k, x: to.x + (Math.random() - 0.5) * 6, y: to.y + (Math.random() - 0.5) * 6, amount: n1, label: def.n }); }
    return n1;
  };

  /** Convenience used by the UI: hand something from one person to another and let the bond system know. */
  C.give = function (fromP, toP, k, n) {
    const moved = C.transfer({ kind: 'person', p: fromP }, { kind: 'person', p: toP }, k, n);
    if (moved && C.bondEvent) C.bondEvent(fromP, toP, 'shared', 1.2);
    return moved;
  };

  // ------------------------------------------------------------------------------------------------------------------
  // 4. DAILY LIFE: eating, drinking, sharing, restrictions, disobedience
  // ------------------------------------------------------------------------------------------------------------------

  /** Set the ration allowance for a list of person ids. food/water: 1 free, 0.5 sparing, 0 forbidden. */
  C.setRation = function (ids, food, water) {
    for (const id of ids) { const p = C.P(id); if (!p) continue; C.initInv(p); if (food !== null && food !== undefined) p.rat.f = food; if (water !== null && water !== undefined) p.rat.w = water; }
  };

  /** Eat one ration from own pack if available. Returns true if eaten. */
  function eat(p) { if (C.invTake(p, 'food', 1) > 0) { p.needs.food = clamp(p.needs.food + TUNE.ration, 0, 100); return true; } return false; }
  function drink(p) { if (C.invTake(p, 'water', 1) > 0) { p.needs.water = clamp(p.needs.water + TUNE.gulp, 0, 100); return true; } return false; }

  /**
   * Per-actor tick (called from commonUpdate for rebels and the player).
   *  - eat/drink from the pack according to the ration allowance
   *  - refill the canteen at water
   *  - share with a nearby comrade who is in need
   *  - break ration orders when pushed too far (disobedience)
   */
  C.invTick = function (s, a, dt) {
    const p = a.p; if (!(a.side === 'rebel' || a.isPlayer) || a.dead) return;
    C.initInv(p); const g = G();
    if (C.routineTick) C.routineTick(a);
    a.invT = (a.invT || 0) - dt; if (a.invT > 0) return; a.invT = 1.2;          // the expensive part runs about once a second
    const n = p.needs, r = p.rat;

    // refill a canteen when standing in shallow water (and drink there too if allowed)
    if (C.tileAt(s, a.x, a.y) === TL_SHAL() && (p.inv.water || 0) < 2) C.invAdd(p, 'water', 1);

    // --- normal eating & drinking, limited by the ration allowance ---
    // allowance 1: eat at the usual threshold; 0.5: only when quite hungry; 0: never (until disobedience kicks in)
    const eatAt = r.f >= 1 ? TUNE.eatBelow : r.f > 0 ? TUNE.restrictedFloor + 8 : -1;
    const drinkAt = r.w >= 1 ? TUNE.drinkBelow : r.w > 0 ? TUNE.restrictedFloor + 10 : -1;
    if (n.food < eatAt) eat(p);
    if (n.water < drinkAt) drink(p);

    // --- reload from loose rounds (rockets for a launcher, cartridges for everything else) ---
    if (a.weapon && a.weapon.spare !== undefined && !(C.WEAPONS[a.weapon.k].crew)) {
      const W = C.WEAPONS[a.weapon.k], key = W.launcher ? 'rocket' : 'ammo';
      if (a.weapon.spare < W.mag * (W.launcher ? 1 : 1) && (p.inv[key] || 0) > 0) { const t = Math.min(p.inv[key], W.mag * 2); p.inv[key] -= t; a.weapon.spare += t; }
    }
    // --- a heavy load slows you down: nothing up to 75% of capacity, then up to −35% speed at 125% ---
    { const cap = C.capacityOf(p), load = C.loadOf(p); a.loadK = 1 - clamp((load - cap * 0.75) / (cap * 0.5), 0, 0.35); }

    // --- disobedience: a restriction the person cannot stand ---
    breakRestriction(s, a);

    // --- sharing with a nearby comrade ---
    a.shareT = (a.shareT || 0) - 1.2; if (a.shareT <= 0) { a.shareT = TUNE.shareEvery; shareWithNeighbour(s, a); }
  };
  const TL_SHAL = () => C.TILE.SHAL;

  /**
   * Disobedience when a ration order meets real need.
   * Chance rises with (a) how deep the unmet need is, (b) low loyalty / low trust, (c) low discipline.
   * What they do: eat or drink from their own pack in secret; if the pack is empty and need is severe they ask
   * a comrade (who may refuse because of the order) — handled by the sharing step.
   */
  function breakRestriction(s, a) {
    const p = a.p, g = G(), n = p.needs, r = p.rat;
    const hunger = r.f < 1 ? clamp((TUNE.eatBelow - n.food) / TUNE.eatBelow, 0, 1) : 0;
    const thirst = r.w < 1 ? clamp((TUNE.drinkBelow - n.water) / TUNE.drinkBelow, 0, 1) : 0;
    const need = Math.max(hunger, thirst); if (need < 0.15) return;
    const loyal = clamp((p.trueStance + 20) / 120, 0, 1), trust = C.trustOf(p) / 100, disc = clamp(g.rep.discipline / 100, 0, 1);
    // chance per check (~1.2 s). Quadratic in need so a mild restriction is obeyed, a harsh one is not.
    let chance = 0.02 + 0.5 * need * need + 0.12 * (1 - loyal) + 0.08 * (1 - trust) - 0.1 * disc;
    if (p.traits.includes('stoic')) chance *= 0.5; if (p.traits.includes('idealist')) chance *= 0.7; if (p.traits.includes('greedy') || p.traits.includes('drinker')) chance *= 1.4;
    if (Math.random() > clamp(chance, 0, 0.7)) return;
    // they do it anyway
    let did = false;
    if (hunger >= thirst) did = eat(p); else did = drink(p);
    if (did) {
      C.say(a, hunger >= thirst ? 'Perdón, jefe... tengo hambre' : 'Perdón, jefe... sed', '#7a5a1d', 3);
      C.addTrust(p, -1.2); g.rep.discipline = clamp(g.rep.discipline - 0.15, 0, 100); p.stats = p.stats || {}; p.stats.brokeRation = (p.stats.brokeRation || 0) + 1;
    }
  }

  /**
   * A person with spare supplies helps a comrade in need. Generous people share sooner and more; greedy people hoard.
   * A restriction order applies to *taking*, not to giving: the giver follows their own allowance too.
   * Every act of sharing feeds the friendship system (C.bondEvent), which is how comrades become family-strength friends.
   */
  function shareWithNeighbour(s, a) {
    const p = a.p; let best = null, worst = 1e9;
    // choose the NEEDIEST comrade in range (not merely the nearest — in a crowded camp the nearest is rarely the hungry one)
    for (const o of s.actors) {
      if (o === a || o.dead || o.inside || !(o.side === 'rebel' || o.isPlayer)) continue;
      if (Math.hypot(o.x - a.x, o.y - a.y) > TUNE.shareRange) continue;
      const need = Math.min(o.p.needs.food, o.p.needs.water); if (need < worst) { worst = need; best = o; }
    }
    if (!best) return; const q = best.p; C.initInv(q);
    const giverKeeps = p.traits.includes('greedy') ? 3 : p.traits.includes('generous') ? 0 : 1;      // rations the giver keeps for themselves
    const needFood = q.needs.food < 28 && q.rat.f > 0, needWater = q.needs.water < 28 && q.rat.w > 0;
    if (needFood && (p.inv.food || 0) > giverKeeps) { if (C.give(p, q, 'food', 1)) C.log && Math.random() < 0.15 && C.log(`${C.tagName(p)} shares a ration with ${C.tagName(q)}.`, 'info'); }
    if (needWater && (p.inv.water || 0) > giverKeeps) { C.give(p, q, 'water', 1); }
    // a medic or kind soul hands a bandage to the bleeding
    if ((q.bleed > 0 || q.hp < q.maxHp * 0.5) && (p.inv.med || 0) > 0 && (p.occ === 'medico' || p.traits.includes('kind') || p.roster === 'che')) { if (C.give(p, q, 'med', 1)) { q.bleed = 0; q.hp = Math.min(q.maxHp, q.hp + 20); } }
  }

  /**
   * Meal times (7, 13, 19h): the column's stores feed everyone who is with the column and tops up their packs.
   * People on restricted rations draw less. Anyone out of reach of the column (not in the scene) lives on their pack.
   */
  C.mealTime = function () {
    const g = G(); let fed = 0, short = 0; const save = g.base.built.cocina ? 0.75 : 1;
    for (const id of C.partyIds().concat([C.W.player])) {
      const p = C.P(id); if (!p || p.status !== 'alive') continue; C.initInv(p);
      const portion = p.rat.f;                                   // 1 full, 0.5 half, 0 none
      if (p.needs.food <= 70 && portion > 0) {
        // first the pack, then the stores
        if (!(p.inv.food > 0 && p.needs.food < TUNE.eatBelow && eat(p))) {
          const cost = save * portion;
          if (g.res.food >= cost) { g.res.food -= cost; p.needs.food = clamp(p.needs.food + TUNE.ration * portion, 0, 100); fed++; }
          else { short++; p.stress = clamp(p.stress + 4, 0, 100); p.morale = clamp(p.morale - 3, 0, 100); }
        } else fed++;
      } else if (p.needs.food <= 70 && portion === 0) { p.morale = clamp(p.morale - 1.5, 0, 100); }
      if (p.rat.w > 0) p.needs.water = clamp(p.needs.water + 25 * p.rat.w, 0, 100);
      // top the pack up from the stores to the target level (never beyond capacity or what stores hold)
      for (const k of ['food', 'water']) { const want = TUNE.topUp[k] - (p.inv[k] || 0); if (want > 0) C.transfer({ kind: 'stores' }, { kind: 'person', p }, k, want); }
    }
    if (short) C.log(`${short} of your people went without a meal.`, 'bad'); else if (fed && g.res.food < fed * 3) C.log('Food is running low.', 'warn');
  };

  /**
   * "Share out": pool every selected person's rations and canteens and deal them back evenly (respecting capacity).
   * A fast way to rescue the one man who has nothing while another carries five days of food.
   */
  C.pool = function (ids) {
    const ps = ids.map((i) => C.P(i)).filter((p) => p && p.status === 'alive'); if (ps.length < 2) return;
    for (const k of ['food', 'water']) {
      let total = 0; for (const p of ps) { C.initInv(p); total += p.inv[k] || 0; p.inv[k] = 0; }
      let i = 0, guard = 0; while (total > 0 && guard++ < 500) { const p = ps[i++ % ps.length]; if (C.invAdd(p, k, 1)) total--; else if (guard > ps.length * 40) break; }
      if (total > 0) { const g = G(); const rk = C.ITEMS[k].res; if (rk) g.res[rk] += total; }   // whatever nobody can carry goes back to the stores
    }
    C.ui.toast('Rations pooled and shared out');
  };
})();
