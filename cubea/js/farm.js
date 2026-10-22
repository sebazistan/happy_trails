/* CUBEA — farm.js : LAND REFORM AS SOMETHING YOU DO, ON THE GROUND, IN REAL TIME.

   There is no "redistribute land" button. The reform is a chain of physical, visible, failable acts:

     1. SERVE NOTICE  (talk to the owner or his mayordomo: demand / buy / farm it together). This opens the estate
        to survey and sets how the owners and the peasants react. Nobody has land yet.
     2. SURVEY        (verb on the ground, needs survey stakes from the tool rack): drive four stakes and a plot of
        half / one / two caballerías appears. Where you put it, and how big, is your decision — next to water or in
        scrub, enough for a family or a sliver. Stakes are limited and are carried.
     3. GRANT         (verb on a PERSON): give the nearest unassigned plot to that family. A promise made earlier in
        conversation ("you will have land by the rains") is checked against this act. Hope, loyalty and the owners'
        fury all move at THIS moment, for THIS family, remembered along their family edges.
     4. SOW           (verb on the plot, needs a hoe and seed): a granted plot with no seed is a piece of paper. If
        nobody provides seed and tools within ~12 days the family loses hope and says so — the promise was kept in
        law and broken in practice.
     5. WATER / HARVEST (verbs on crops): maize grows over ~20 days, stalls in drought if unwatered, and is
        harvested into packs or the stores. The family's share is what they eat; the rest is what they owe you.

   Everything above can be recorded as an Action (actions.js) and handed to a squad: "survey, sow, water" as a chore.

   PUBLIC API
     C.land.notice(owner, mode)    mode 'demand' | 'buy' | 'together'   (called by the talk menu in ui.js)
     C.farmDaily()                 growth, drought, neglect; called from C.dayTick via main.js hook
     verbs: survey, grant, sow, water_crop, harvest        thing kinds: parcel, (and the existing crop, stake)

   TUNE: all numbers in the TUNE block below.
*/
(function () {
  'use strict';
  const C = window.C, G = () => C.G, clamp = C.clamp, T = C.T;

  // TUNE ---------------------------------------------------------------------------------------------------------------
  const TUNE = {
    sizes: { half: { side: 40, n: 4, seed: 2, lab: 'half a caballería' }, one: { side: 56, n: 6, seed: 3, lab: 'one caballería' }, two: { side: 80, n: 9, seed: 5, lab: 'two caballerías' } },
    growPerDay: 0.05,        // crop progress per day (1.0 = ripe, ~20 days)
    droughtDays: 4,          // days without water or rain before a crop stalls
    neglectDays: 12,         // days a granted plot may sit unsown before the family loses faith
    harvestFood: 3,          // rations per ripe plant
    ownerFury: { demand: 7, buy: 3, together: 5 },      // landowner stance penalty at the notice
    buyCost: 45,
  };
  C.FARM_TUNE = TUNE;

  // The plot itself: a dashed rectangle with its family's name when granted.
  C.THINGS.parcel = { n: 'Surveyed plot', draw(c, t) {
    const sz = TUNE.sizes[t.d.size] || TUNE.sizes.one, h = sz.side / 2;
    c.save(); c.globalAlpha = 0.9; c.strokeStyle = t.d.family ? 'rgb(255,214,120)' : 'rgb(255,255,255)'; c.setLineDash([5, 4]); c.lineWidth = 1.4; c.strokeRect(t.x - h, t.y - h, sz.side, sz.side);
    c.fillStyle = t.d.family ? 'rgba(140,200,90,.14)' : 'rgba(255,255,255,.07)'; c.fillRect(t.x - h, t.y - h, sz.side, sz.side); c.setLineDash([]);
    c.fillStyle = 'rgba(255,255,255,.85)'; c.font = '9px sans-serif'; c.textAlign = 'center'; c.fillText(t.d.family ? 'Familia ' + t.d.family : sz.lab, t.x, t.y - h + 10); c.restore(); } };

  const inv = (a) => C.initInv(a.p);
  const has = (a, k, n) => (inv(a)[k] || 0) >= (n || 1);
  const parcels = (s) => C.thingsOf(s, 'parcel');

  // ------------------------------------------------------------------------------------------------------------------
  // 1. THE NOTICE (a conversation, not a transfer of land)
  // ------------------------------------------------------------------------------------------------------------------
  C.land.notice = function (owner, mode) {
    const g = G(), s = g.scene; C.policyInit();
    if (mode === 'buy') { if (g.res.money < TUNE.buyCost) { C.ui.toast(`Buying out costs ${TUNE.buyCost} pesos`); return false; } g.res.money -= TUNE.buyCost; }
    s.estate = { owner: owner.id, mode, day: g.day };
    const soft = mode === 'buy' ? 0.45 : 1;
    for (const q of C.W.people) { if (q.status !== 'alive') continue; if (q.fac === 'landowners') q.trueStance -= TUNE.ownerFury[mode] * soft; else if (q.fac === 'peasants' && q.settlement === s.sid) q.needs.hope = clamp(q.needs.hope + 6, 0, 100); }
    if (mode === 'demand' && Math.random() < 0.4) owner.status = 'exile';                        // owners often flee
    C.addEvent({ type: 'seizure', victim: owner, perpSide: 'rebel', val: -1, sev: mode === 'buy' ? 30 : 50, pub: 0.7, x: 0, y: 0, settlement: s.sid, text: `Rebels served notice on the estate of ${C.tagName(owner)}`, memText: mode === 'buy' ? 'The rebels offered to buy our land' : 'The rebels served notice on the estate' });
    C.log(`Notice served on ${C.tagName(owner)} (${mode === 'buy' ? 'bought out' : mode === 'together' ? 'to be worked together' : 'demanded'}). Nothing is distributed yet: lay out plots with survey stakes and put families on them.`, 'info');
    C.ui.toast('Estate open to survey — take stakes from the tool rack, then Q on the ground');
    return true;
  };

  /** The three tones of the conversation. This is speech, not a transfer: the land itself is dealt with in the field. */
  C.land.noticeMenu = function (p) {
    C.ui.menu('The estate of ' + C.fullName(p), 'What do you tell the owner? Tenants will wait and watch; so will every other owner in the Oriente.', [
      { label: 'Demand it', sub: 'The land is the tenants\'s. Owners are enraged; many flee.', fn: () => { C.land.notice(p, 'demand'); } },
      { label: 'Offer to buy it out (' + TUNE.buyCost + ' pesos)', sub: 'Calmer, costly, and the owner keeps some dignity.', disabled: G().res.money < TUNE.buyCost, fn: () => { C.land.notice(p, 'buy'); } },
      { label: 'Propose working it together', sub: 'A cooperative: slower, but the owner stays and the workers share.', fn: () => { C.land.notice(p, 'together'); } },
    ]);
  };

  // ------------------------------------------------------------------------------------------------------------------
  // 2–5. THE VERBS
  // ------------------------------------------------------------------------------------------------------------------
  C.registerVerb({ id: 'survey', n: 'Survey a plot', icon: '📐', kinds: ['ground'], reach: 16, dur: 10,
    variants: () => Object.keys(TUNE.sizes).map((k) => ({ param: { size: k }, label: `Survey ${TUNE.sizes[k].lab}` })),
    check: (a, tg, p) => (!a.scene.estate ? 'No estate is open to survey — serve notice on the owner first.' : p && !has(a, 'stake', 4) ? 'Needs four survey stakes.' : null),
    done: (a, tg, p) => {
      const s = a.scene, sz = TUNE.sizes[p.size], h = sz.side / 2;
      for (const q of parcels(s)) if (Math.abs(q.x - tg.x) < h + (TUNE.sizes[q.d.size].side / 2) && Math.abs(q.y - tg.y) < h + (TUNE.sizes[q.d.size].side / 2)) return 'That overlaps another plot.';
      const t = C.addThing(s, 'parcel', tg.x, tg.y, { size: p.size, state: 'staked', family: null, pid: null, day: G().day, stakes: [] });
      C.invTake(a.p, 'stake', 4); for (const [dx, dy] of [[-h, -h], [h, -h], [h, h], [-h, h]]) t.d.stakes.push(C.addThing(s, 'stake', tg.x + dx, tg.y + dy, {}).id);
      return null; } });

  C.registerVerb({ id: 'grant', n: 'Give them a plot', icon: '📜', kinds: ['actor'], reach: 22, dur: 6,
    check: (a, tg) => { const q = tg.o.p; if (tg.o.isPlayer || tg.o.side === 'rebel' || tg.o.side === 'army') return 'Land goes to families who will work it.'; if (!parcels(a.scene).some((x) => !x.d.family)) return 'There is no unassigned plot — survey one first.'; if (q.age < 16) return 'Not a child — find the head of the family.'; return null; },
    done: (a, tg) => {
      const g = G(), s = a.scene, q = tg.o.p, L = g.land; C.policyInit();
      let best = null, bd = 1e9; for (const x of parcels(s)) { if (x.d.family) continue; const d = Math.hypot(x.x - tg.x, x.y - tg.y); if (d < bd) { bd = d; best = x; } }
      if (!best) return 'No unassigned plot.';
      best.d.family = q.last || C.tagName(q); best.d.pid = q.id; best.d.state = 'granted'; best.d.grantDay = g.day; best.d.coop = s.estate && s.estate.mode === 'together';
      L.families++; q.needs.hope = clamp(q.needs.hope + 15, 0, 100); q.trueStance += 6; C.deed && C.deed(0, 6);
      for (const pr of g.promises) if (pr.kind === 'land' && pr.who === q.id && !pr.paid) { pr.paid = true; C.log(`You kept your word to ${C.tagName(q)}: the plot is theirs.`, 'good'); }
      C.addEvent({ type: 'land_grant', victim: q, perpSide: 'rebel', val: 1, sev: 28, pub: 0.5, x: tg.x, y: tg.y, settlement: s.sid, text: `${C.tagName(q)}'s family was given land`, memText: 'The rebels gave us our own land' });
      C.say(tg.o, '¡Es nuestra!', '#1d5b2a', 3); C.log(`${C.tagName(q)}'s family receives ${TUNE.sizes[best.d.size].lab}. They need seed, a hoe and water — a deed is not a harvest.`, 'good'); return null; } });

  C.registerVerb({ id: 'sow', n: 'Sow maize', icon: '🌱', kinds: ['thing:parcel'], reach: 36, dur: (a, tg) => 6 + TUNE.sizes[tg.o.d.size].n * 1.5,
    check: (a, tg) => { const d = tg.o.d; if (d.state === 'sown') return 'Already sown.'; const sz = TUNE.sizes[d.size]; if (!has(a, 'hoe')) return 'Needs a hoe.'; if (!has(a, 'seed', sz.seed)) return `Needs ${sz.seed} seed.`; return null; },
    done: (a, tg) => {
      const s = a.scene, d = tg.o.d, sz = TUNE.sizes[d.size]; C.invTake(a.p, 'seed', sz.seed); d.state = 'sown'; d.sownDay = G().day;
      const cols = Math.ceil(Math.sqrt(sz.n)), step = (sz.side - 12) / Math.max(1, cols - 1 || 1);
      for (let i = 0; i < sz.n; i++) C.addThing(s, 'crop', tg.x - sz.side / 2 + 6 + (i % cols) * step, tg.y - sz.side / 2 + 14 + Math.floor(i / cols) * step, { g: 0, parcel: tg.o.id, dry: 0, wet: false });
      return null; } });

  C.registerVerb({ id: 'water_crop', n: 'Water the crop', icon: '💧', kinds: ['thing:crop'], reach: 14, dur: 3,
    check: (a, tg) => (!(inv(a).bwater > 0) ? 'No water in the bucket.' : tg.o.d.g >= 1 ? 'Ripe already.' : null),
    done: (a, tg) => { inv(a).bwater--; tg.o.d.wet = true; tg.o.d.dry = 0; return null; } });

  C.registerVerb({ id: 'harvest', n: 'Harvest', icon: '🌽', kinds: ['thing:crop'], reach: 14, dur: 4,
    check: (a, tg) => (tg.o.d.g < 0.95 ? 'Not ripe yet.' : null),
    done: (a, tg) => {
      const s = a.scene, n = TUNE.harvestFood; const got = C.invAdd(a.p, 'food', n); if (got < n) G().res.food += n - got;
      const par = C.thingById(s, tg.o.d.parcel); C.removeThing(s, tg.o);
      if (par) { par.d.harvested = (par.d.harvested || 0) + 1; if (!s.things.some((t) => t.k === 'crop' && t.d.parcel === par.id)) { par.d.state = 'granted'; C.log(`The plot of the ${par.d.family || 'estate'} family is harvested.`, 'good'); } }
      return null; } });

  // ------------------------------------------------------------------------------------------------------------------
  // DAILY: growth, drought, and the slow disillusion of a deed without a harvest
  // ------------------------------------------------------------------------------------------------------------------
  C.farmDaily = function () {
    const g = G(), s = g.scene; if (!s || !s.things) return; const rain = (g.weather && g.weather.rain) || 0;
    for (const t of s.things) if (t.k === 'crop') {
      const d = t.d; if (rain > 0.3) { d.wet = true; d.dry = 0; } else if (!d.wet) d.dry++; d.wet = false;
      if (d.dry >= TUNE.droughtDays) { if (d.dry === TUNE.droughtDays) C.log('The maize is wilting — it needs water.', 'warn'); continue; }
      d.g = clamp((d.g || 0) + TUNE.growPerDay, 0, 1);
    }
    for (const t of parcels(s)) {
      if (t.d.state !== 'granted' || t.d.neglectTold) continue;
      if (g.day - t.d.grantDay >= TUNE.neglectDays) {
        t.d.neglectTold = true; const q = C.W.people.find((x) => x.id === t.d.pid); if (!q) continue;
        q.needs.hope = clamp(q.needs.hope - 14, 0, 100); q.trueStance -= 5;
        C.addEvent({ type: 'land_neglect', victim: q, perpSide: 'rebel', val: -1, sev: 22, pub: 0.3, x: t.x, y: t.y, settlement: s.sid, text: `${C.tagName(q)}'s family has land but no seed or tools`, memText: 'They gave us land and nothing to work it with' });
        C.log(`The ${t.d.family} family still has not sown their plot. "Una escritura no es una cosecha." They are losing faith.`, 'bad');
      }
    }
  };
})();
