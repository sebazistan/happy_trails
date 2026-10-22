/* CUBEA — actions.js : VERBS, the ACTION RECORDER (macros for NPCs) and ROUTINES.

   THREE IDEAS IN ONE FILE
   1. VERBS  — the small physical things a person can do in the world: take a ration from a rack, fill a bucket,
      feed a pig, chop a tree, dig a latrine, hang a hammock, stand guard, teach a lesson, plant, harvest…
      Each verb declares what it can be used ON (kinds), what it NEEDS (a tool, an item, a skill), how far the actor must
      be, how long it takes, and what happens when it finishes. Other modules (camp.js, farm.js, ideology.js) register
      their own verbs with C.registerVerb.
   2. THE ACTION RECORDER — like Photoshop's Actions palette, for people. Press ● Record with a soldier selected, then
      direct that soldier as you normally would (right-click to walk, the context wheel to use things). Every command is
      performed live AND written down as a step. Stop, name it, and it is a reusable ACTION that any soldier can run,
      from wherever they are standing. Steps can be flipped between SPOT (this exact place) and DISTANCE (this far from
      where you start), and between SPECIFIC target (that very pig) and NEAREST (any pig).
      If at ANY step something is missing (no bucket, no path, no pig, hurt, under fire) the action STOPS, the soldier
      says why, it is logged, and he WALKS BACK to where he started. Failure is never silent.
   3. ROUTINES — an action can be scheduled at an hour of the day for a person (the feeding-the-pigs-at-6 problem
      solved once, for good). The camp's duty roster (camp.js) is built from the same machinery.

   STEP TYPES   { t:'goto', mode:'spot'|'dist', x,y,dx,dy }
                { t:'verb', v:verbId, param, tgt:ref, wait? }
                { t:'wait', s }      { t:'say', text }
   TARGET REF   { kind:'thing'|'animal'|'actor'|'tree'|'water'|'ground', mode:'specific'|'nearest', ... }
   A MACRO is   { id, name, steps[], repeat, home }

   Everything is executed by C.macroRun, which the order system (orders.js runOrder) calls each frame.
*/
(function () {
  'use strict';
  const C = window.C, G = () => C.G, T = C.T, TL = C.TILE, clamp = C.clamp;
  const ui = C.ui; const toast = (t) => ui.toast(t);
  const AI = () => C.ai;

  // ------------------------------------------------------------------------------------------------------------------
  // 1. THE VERB REGISTRY
  // ------------------------------------------------------------------------------------------------------------------
  C.VERB = {};                                                     // id → verb definition
  /**
   * Register a verb.
   *   id, n (name), icon
   *   kinds     list of target kinds it applies to: 'animal','actor','tree','water','ground','thing' or 'thing:<kind>'
   *   variants  optional (tg) → [{param, label?}] : the same verb offered with different parameters (e.g. which item to take)
   *   reach     px within which the actor must stand
   *   dur       seconds of work (number or (a,tg,param)=>number)
   *   check     (a, tg, param) → null | 'reason it cannot be done'   (preconditions: items, tools, state)
   *   done      (a, tg, param) → null | 'reason it failed'            (the effect)
   *   label     optional (tg, param) → string
   */
  C.registerVerb = function (v) { C.VERB[v.id] = v; return v; };

  /** Does this verb apply to this target? */
  function applies(v, tg) { return v.kinds.some((k) => k === tg.kind || (tg.kind === 'thing' && (k === 'thing' || k === 'thing:' + tg.tk))); }
  /** The concrete verb entries (one per variant) the wheel should offer for a target. */
  C.verbsFor = function (tg) {
    const out = [];
    for (const id in C.VERB) { const v = C.VERB[id]; if (!applies(v, tg)) continue; const vars = v.variants ? v.variants(tg) : [{}]; for (const vr of vars) out.push(Object.assign({}, v, { param: vr.param, label: vr.label ? () => vr.label : v.label })); }
    return out;
  };

  /** Who performs a verb right now: the selected rebels in the scene, or (when nobody is selected) the player. */
  C.actorsForVerb = function () {
    const g = G(); if (g.rec && g.rec.on) { const p = C.P(g.rec.pid); return p && p.actor ? [p.actor] : []; }
    const sel = C.selActors ? C.selActors() : []; if (sel.length && g.sel && g.sel.length) return sel;
    return [g.player];
  };

  // ------------------------------------------------------------------------------------------------------------------
  // Target references: how a recorded step points at something so it can be found again later, from elsewhere.
  // ------------------------------------------------------------------------------------------------------------------
  C.refOf = function (tg) {
    if (tg.kind === 'thing') return { kind: 'thing', tk: tg.tk, id: tg.o.id, mode: 'nearest', x: tg.x, y: tg.y };
    if (tg.kind === 'animal') return { kind: 'animal', ak: tg.o.k, mode: 'nearest', x: tg.x, y: tg.y };
    if (tg.kind === 'actor') return { kind: 'actor', pid: tg.o.p.id, mode: 'specific', x: tg.x, y: tg.y };
    if (tg.kind === 'tree') return { kind: 'tree', mode: 'nearest', x: tg.x, y: tg.y };
    if (tg.kind === 'water') return { kind: 'water', mode: 'nearest', x: tg.x, y: tg.y };
    return { kind: 'ground', mode: 'specific', x: tg.x, y: tg.y };
  };
  const TREE = { tree: 1, palm: 1, ceiba: 1 };
  /** Find the live target for a reference, from the actor's point of view. Returns {kind,o,x,y,tk} or null. */
  C.resolveRef = function (s, a, ref, o) {
    const near = (list, f) => { let best = null, bd = 420; for (const q of list) { const d = Math.hypot(q.x - a.x, q.y - a.y); if (d < bd && (!f || f(q))) { bd = d; best = q; } } if (!best) { bd = 300; for (const q of list) { const d = Math.hypot(q.x - ref.x, q.y - ref.y); if (d < bd && (!f || f(q))) { bd = d; best = q; } } } return best; };
    if (ref.kind === 'thing') {
      const t = ref.mode === 'specific' ? C.thingById(s, ref.id) : near(s.things || [], (q) => q.k === ref.tk);
      return t ? { kind: 'thing', tk: t.k, o: t, x: t.x, y: t.y } : null;
    }
    if (ref.kind === 'animal') { const an = near(s.animals.filter((q) => !q.dead), (q) => q.k === ref.ak); return an ? { kind: 'animal', o: an, x: an.x, y: an.y } : null; }
    if (ref.kind === 'actor') { const q = C.P(ref.pid).actor; return q && !q.dead && q.scene === s ? { kind: 'actor', o: q, x: q.x, y: q.y } : null; }
    if (ref.kind === 'tree') { const t = near(s.props.filter((p) => TREE[p.k])); return t ? { kind: 'tree', o: t, x: t.x, y: t.y } : null; }
    if (ref.kind === 'water') {
      let best = null, bd = 1e9; const cx = Math.floor(ref.x / T), cy = Math.floor(ref.y / T); const ax = Math.floor(a.x / T), ay = Math.floor(a.y / T);
      for (const [px, py] of [[ax, ay], [cx, cy]]) for (let r = 0; r < 40 && !best; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) { if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue; const t = C.tileAt(s, (px + dx) * T + 8, (py + dy) * T + 8); if (t === TL.SHAL) { const d = Math.hypot(dx, dy); if (d < bd) { bd = d; best = { x: (px + dx) * T + 8, y: (py + dy) * T + 8 }; } } }
      return best ? { kind: 'water', o: best, x: best.x, y: best.y } : null;
    }
    // ground: absolute spot, or relative to where this run started ('dist' mode)
    if (ref.mode === 'dist' && o && o.start) return { kind: 'ground', o: { x: o.start.x + ref.dx, y: o.start.y + ref.dy }, x: o.start.x + ref.dx, y: o.start.y + ref.dy };
    return { kind: 'ground', o: { x: ref.x, y: ref.y }, x: ref.x, y: ref.y };
  };

  // ------------------------------------------------------------------------------------------------------------------
  // 2. RUNNING MACROS (called by orders.js runOrder for order type 'macro')
  // ------------------------------------------------------------------------------------------------------------------
  /** Give a person an action to run. Honours obedience (a hungry or resentful soldier may say no and retry). */
  C.giveMacro = function (a, macro, opt) {
    opt = opt || {}; const g = G();
    const o = { type: 'macro', m: macro, i: 0, rep: 0, w: 0, phase: 'go', start: { x: a.x, y: a.y }, err: null, t: 0, quiet: !!opt.quiet };
    const comply = opt.force || Math.random() < AI().obedience(a) + 0.25;
    if (!comply) { C.say(a, AI().whyNot(a), '#7a1d1d', 2.6); a.pendingOrder = o; a.retryT = 5 + Math.random() * 5; return false; }
    a.pendingOrder = null; a.path = null; a.pathFor = null; a.working = false;
    if (opt.queue && a.order) (a.orderQ = a.orderQ || []).push(o); else { a.order = o; a.orderT = 0.1; a.orderQ = []; }
    return true;
  };

  function fail(a, o, reason) {
    o.err = reason; const name = C.tagName(a.p);
    C.say(a, reason, '#7a1d1d', 4); C.log(`${name} stopped "${o.m.name}": ${reason}${o.m.home !== false ? ' Heading back.' : ''}`, 'warn');
    if (C.G.rec && C.G.rec.on && C.G.rec.pid === a.p.id) { /* while recording, a failure is part of the lesson: it is shown but the recording continues */ }
    o.i = -1; o.phase = 'return'; a.working = false; a.path = null; a.pathFor = null;
  }
  function goto(s, a, o, x, y, dt, mult) { const A = AI(); if (!a.path || a.pathFor !== o || o.gx !== x || o.gy !== y) { if (!A.setPath(s, a, x, y)) return 'nopath'; a.pathFor = o; o.gx = x; o.gy = y; } const done = A.followPath(s, a, dt, a.speed * (mult || 1) * A.terrainSpeed(s, a)); return done || Math.hypot(x - a.x, y - a.y) < 12 ? 'arrived' : 'moving'; }

  /** One frame of a macro. Returns true if it consumed the frame (the unit should not run its stance behaviour). */
  C.macroRun = function (s, a, o, dt, lead, tgtEnemy) {
    const g = G(), m = o.m;
    // shooting starts: pause the work, fight, resume
    if (tgtEnemy || a.lastHit > g.time - 4 || a.suppressed > 0) { a.working = false; return false; }
    // coming home after a failure
    if (o.phase === 'return') {
      if (m.home === false) { endMacro(a, o); return false; }
      const r = goto(s, a, o, o.start.x, o.start.y, dt, 1.1); if (r !== 'moving') { C.log(`${C.tagName(a.p)} is back.`, 'info'); endMacro(a, o); } return true;
    }
    const step = m.steps[o.i];
    if (!step) { o.rep++; if (o.rep < (m.repeat || 1)) { o.i = 0; return true; } if (m.home) { o.i = -1; o.phase = 'return'; return true; } C.log && !o.quiet && C.log(`${C.tagName(a.p)} finished "${m.name}".`, 'good'); endMacro(a, o); return false; }
    if (step.t === 'goto') {
      const x = step.mode === 'dist' ? o.start.x + step.dx : step.x, y = step.mode === 'dist' ? o.start.y + step.dy : step.y;
      const r = goto(s, a, o, x, y, dt, 1); if (r === 'nopath') { fail(a, o, "Can't get there."); return true; } if (r === 'arrived') { o.i++; a.path = null; a.pathFor = null; } return true;
    }
    if (step.t === 'wait') { a.moving = false; o.w += dt; if (o.w >= step.s) { o.w = 0; o.i++; } return true; }
    if (step.t === 'say') { C.say(a, step.text, '#222', 3); o.i++; return true; }
    if (step.t === 'verb') {
      const V = C.VERB[step.v]; if (!V) { fail(a, o, 'Unknown action.'); return true; }
      if (!o.cur || o.curStep !== o.i) { o.cur = C.resolveRef(s, a, step.tgt, o); o.curStep = o.i; o.phase = 'go'; o.w = 0; if (!o.cur) { fail(a, o, `Can't find the ${step.tgt.kind === 'thing' ? (C.THINGS[step.tgt.tk] || {}).n || 'target' : step.tgt.kind === 'animal' ? 'animal' : step.tgt.kind}.`); return true; } }
      const tg = o.cur; const why = V.check ? V.check(a, tg, step.param) : null; if (why) { fail(a, o, why); return true; }
      if (tg.kind === 'actor') { tg.x = tg.o.x; tg.y = tg.o.y; }
      const reach = V.reach || 14;
      if (o.phase === 'go') {
        if (Math.hypot(tg.x - a.x, tg.y - a.y) > reach) { const r = goto(s, a, o, tg.x, tg.y + 6, dt, 1); if (r === 'nopath') fail(a, o, "Can't get there."); else if (r === 'arrived' && Math.hypot(tg.x - a.x, tg.y - a.y) > reach + 10) fail(a, o, "Can't get close enough."); return true; }
        o.phase = 'work'; o.w = 0; o.dur = typeof V.dur === 'function' ? V.dur(a, tg, step.param) : (V.dur || 3); if (V.start) V.start(a, tg, step.param);
      }
      a.moving = false; a.working = true; o.w += dt; a.anim += dt * 5; a.face = tg.x >= a.x ? 1 : -1;
      if (o.w >= o.dur) { a.working = false; const err = V.done ? V.done(a, tg, step.param) : null; if (err) { fail(a, o, err); return true; } o.i++; o.cur = null; o.phase = 'go'; o.w = 0; }
      return true;
    }
    o.i++; return true;
  };
  function endMacro(a, o) { a.working = false; a.path = null; a.pathFor = null; if (a.orderQ && a.orderQ.length) { a.order = a.orderQ.shift(); a.orderT = 0.1; } else a.order = null; }

  // ------------------------------------------------------------------------------------------------------------------
  // Doing a verb from the context wheel (live)
  // ------------------------------------------------------------------------------------------------------------------
  /** Perform verb `v` on target `tg` with the people for the moment (recorder actor, selection, or the player). */
  C.doVerb = function (v, tg, param) {
    const g = G(); if (g.paused) { toast('No orders while paused — time is part of the pressure'); return; }
    const step = { t: 'verb', v: v.id, param, tgt: C.refOf(tg) };
    const actors = C.actorsForVerb();
    if (g.rec && g.rec.on) { C.recAdd(step); }
    let any = false;
    for (const a of actors) {
      if (a.isPlayer) { startPlayerAct(a, v, tg, param); any = true; continue; }
      const m = { id: 'tmp', name: v.n, steps: [step], repeat: 1, home: false };
      any = C.giveMacro(a, m, { queue: !!(g.rec && g.rec.on), quiet: true, force: !!(g.rec && g.rec.on) }) || any;
    }
    if (!any && actors.length) toast('They hesitate…');
  };

  // The player's own hands: if you are close, you do it yourself (a progress ring over your head); moving cancels it.
  function startPlayerAct(a, v, tg, param) {
    const g = G(); const why = v.check ? v.check(a, tg, param) : null; if (why) { toast(why); return; }
    if (Math.hypot(tg.x - a.x, tg.y - a.y) > (v.reach || 14) + 6) { toast('Too far — walk closer, or select someone to send'); return; }
    const dur = typeof v.dur === 'function' ? v.dur(a, tg, param) : (v.dur || 3);
    g.pact = { v, tg, param, t: 0, dur }; if (v.start) v.start(a, tg, param); C.say(a, v.n + '…', '#333', 1.2);
  }
  /** Per-frame update of the player's own action. Called from main.js update(). */
  C.playerActTick = function (dt) {
    const g = G(), p = g.pact, a = g.player; if (!p || !a) return;
    if (a.moving || g.paused) { g.pact = null; return; }
    a.working = true; p.t += dt; a.anim += dt * 4;
    if (p.t >= p.dur) { a.working = false; const err = p.v.done ? p.v.done(a, p.tg, p.param) : null; if (err) toast(err); g.pact = null; }
  };

  // ------------------------------------------------------------------------------------------------------------------
  // 3. THE RECORDER
  // ------------------------------------------------------------------------------------------------------------------
  C.initActions = function () { const g = G(); g.macros = g.macros || []; g.rec = g.rec || { on: false, steps: [] }; };

  /** Start recording with the first selected soldier. */
  C.recStart = function () {
    const g = G(); C.initActions(); const ids = C.selIds(); const p = ids.length ? C.P(ids[0]) : null;
    if (!p || !p.actor || p.actor.scene !== g.scene) { toast('Select a soldier first, then press Record'); return; }
    g.rec = { on: true, pid: p.id, steps: [], name: 'New action', start: { x: p.actor.x, y: p.actor.y }, repeat: 1, home: true };
    p.actor.order = null; p.actor.orderQ = [];
    toast(`Recording ${C.tagName(p)}: right-click to walk, use the wheel (Q) on things. Each command is performed and recorded.`); refreshPanel();
  };
  C.recAdd = function (step) { const g = G(); if (g.rec && g.rec.on) { g.rec.steps.push(step); refreshPanel(); } };
  /** Record a walk to a world point (called by main.js commandAt while recording). */
  C.recGoto = function (wx, wy) {
    const g = G(), r = g.rec; if (!r || !r.on) return false;
    const a = C.P(r.pid).actor; if (!a) return false;
    const step = { t: 'goto', mode: 'spot', x: wx, y: wy, dx: wx - r.start.x, dy: wy - r.start.y };
    C.recAdd(step);
    C.giveMacro(a, { id: 'tmp', name: 'Walk', steps: [step], repeat: 1, home: false }, { queue: true, quiet: true, force: true });
    g.orderMarks.push({ x: wx, y: wy, t: 0, col: '#ff8a7a' });
    return true;
  };
  C.recStop = function (save) {
    const g = G(), r = g.rec; if (!r || !r.on) return;
    r.on = false;
    if (save && r.steps.length) { const m = { id: 'm' + Date.now(), name: r.name, steps: r.steps.slice(), repeat: r.repeat || 1, home: r.home !== false }; g.macros.push(m); toast(`Saved action "${m.name}" (${m.steps.length} steps)`); }
    g.rec = { on: false, steps: [] }; refreshPanel();
  };
  /** Run a saved action on everyone selected (each from where they stand). */
  C.playMacro = function (m) {
    const g = G(); if (g.paused) { toast('No orders while paused'); return; }
    const acts = C.selActors ? C.selActors() : []; if (!acts.length) { toast('Select who should do it'); return; }
    let n = 0; for (const a of acts) if (C.giveMacro(a, m, {})) n++; toast(`${n}/${acts.length} start "${m.name}"`);
  };

  // ------------------------------------------------------------------------------------------------------------------
  // 4. ROUTINES: an action at an hour of the day, every day, for a person
  // ------------------------------------------------------------------------------------------------------------------
  C.addRoutine = function (p, macro, hour) { p.routine = p.routine || []; p.routine.push({ h: hour, mid: macro.id }); };
  /** Called about once a second per rebel (from inventory.js's tick). Starts a due routine when the person is idle. */
  C.routineTick = function (a) {
    const p = a.p, g = G(); if (!p.routine || !p.routine.length || a.order || a.dead || g.paused) return;
    const hr = g.hour;
    for (const r of p.routine) {
      const key = g.day + ':' + r.mid + ':' + r.h; if (p.routineDone === key) continue;
      if (hr >= r.h && hr < r.h + 0.75) { const m = g.macros.find((x) => x.id === r.mid) || C.PRESETS.find((x) => x.id === r.mid); if (!m) continue; p.routineDone = key; C.giveMacro(a, m, { force: true }); C.log(`${C.tagName(p)} begins "${m.name}".`, 'info'); return; }
    }
  };
  C.PRESETS = [];       // read-only built-in actions (camp.js adds the camp duties)

  // ------------------------------------------------------------------------------------------------------------------
  // 5. GENERIC VERBS
  // ------------------------------------------------------------------------------------------------------------------
  const inv = (a) => C.initInv(a.p);
  const has = (a, k, n) => (inv(a)[k] || 0) >= (n || 1);
  const need = (k, why) => (a) => (has(a, k) ? null : why);
  C.TAKEABLE = {
    barbacoa: [['food', 2, 'rations'], ['food', 6, 'rations'], ['seed', 4, 'seed'], ['feed', 2, 'pig feed'], ['med', 1, 'medicine']],
    toolrack: [['hoe', 1, 'a hoe'], ['axe', 1, 'an axe'], ['bucket', 1, 'a bucket'], ['stake', 4, 'stakes'], ['hammock', 1, 'a hammock'], ['primer', 1, 'a primer']],
    woodpile: [['lena', 2, 'firewood']],
  };
  const THING_CAN_TAKE = Object.keys(C.TAKEABLE).map((k) => 'thing:' + k);

  C.registerVerb({
    id: 'take', n: 'Take', icon: '✋', kinds: THING_CAN_TAKE, reach: 16, dur: 2,
    variants: (tg) => (C.TAKEABLE[tg.tk] || []).map(([item, n, lab]) => ({ param: { item, n }, label: `Take ${n} ${lab}` })),
    check: (a, tg, p) => (p && C.holderHas({ kind: 'stores' }, p.item) < 1 ? `None left (${C.ITEMS[p.item].n})` : (p && C.canCarry(a.p, p.item) < 1 ? 'Cannot carry more' : null)),
    done: (a, tg, p) => { const m = C.transfer({ kind: 'stores' }, { kind: 'person', p: a.p }, p.item, p.n); return m ? null : 'Could not take it (stores empty or hands full).'; },
  });
  C.registerVerb({
    id: 'put', n: 'Put away', icon: '📥', kinds: ['thing:barbacoa', 'thing:woodpile', 'thing:toolrack'], reach: 16, dur: 2,
    variants: (tg) => { const acc = { barbacoa: ['food', 'seed', 'feed', 'med'], woodpile: ['lena'], toolrack: ['hoe', 'axe', 'bucket', 'stake', 'hammock', 'primer'] }[tg.tk] || []; return acc.map((item) => ({ param: { item }, label: `Put away ${C.ITEMS[item].n.toLowerCase()}` })); },
    check: (a, tg, p) => (p && !has(a, p.item) ? `Nothing to put away (${C.ITEMS[p.item].n})` : null),
    done: (a, tg, p) => { C.transfer({ kind: 'person', p: a.p }, { kind: 'stores' }, p.item, 999); return null; },
  });
  C.registerVerb({
    id: 'fill', n: 'Fill bucket', icon: '🪣', kinds: ['water'], reach: 18, dur: 4,
    check: (a) => (!has(a, 'bucket') ? 'No bucket.' : (inv(a).bwater || 0) >= inv(a).bucket ? 'Buckets already full.' : null),
    done: (a) => { const i = inv(a); i.bwater = Math.min(i.bucket, (i.bwater || 0) + 1); return null; },
  });
  C.registerVerb({
    id: 'give_water', n: 'Give water', icon: '💦', kinds: ['animal', 'actor'], reach: 16, dur: 3,
    check: (a) => (has(a, 'bwater') ? null : 'No water in the bucket.'),
    done: (a, tg) => { const i = inv(a); i.bwater--; if (tg.kind === 'animal') { tg.o.watered = G().time; } else { tg.o.p.needs.water = clamp(tg.o.p.needs.water + 30, 0, 100); C.bondEvent && C.bondEvent(a.p, tg.o.p, 'shared', 0.8); } return null; },
  });
  C.registerVerb({
    id: 'feed', n: 'Feed', icon: '🥣', kinds: ['animal', 'thing:trough'], reach: 16, dur: 4,
    check: (a, tg) => (tg.kind === 'animal' && tg.o.def.wild ? "It's wild." : has(a, 'feed') ? null : 'No feed.'),
    done: (a, tg) => { inv(a).feed--; if (tg.kind === 'animal') { tg.o.fat = Math.min(1, (tg.o.fat || 0.3) + 0.12); tg.o.fed = G().time; } else tg.o.d.feed = (tg.o.d.feed || 0) + 1; return null; },
  });
  C.registerVerb({
    id: 'butcher', n: 'Butcher', icon: '🔪', kinds: ['animal'], reach: 16, dur: 6,
    check: (a, tg) => (tg.o.def.wild ? 'Shoot wild game instead.' : tg.o.dead ? 'Already dead.' : null),
    done: (a, tg) => { const an = tg.o, g = G(); const f = 0.6 + 0.8 * (an.fat || 0.3); an.def = Object.assign({}, an.def, { food: Math.round(an.def.food * f) }); C.forageTransaction(a, an, 'animal'); an.dead = true; an.hp = 0; const s = a.scene; s.decals.push({ k: 'blood', x: an.x, y: an.y, r: 3, a: 0.5, rot: 0, t0: g.time, fade: 400 }); return null; },
  });
  C.registerVerb({
    id: 'chop', n: 'Chop wood', icon: '🪓', kinds: ['tree'], reach: 14, dur: (a) => (has(a, 'axe') ? 7 : 14),
    check: (a) => (has(a, 'axe') || a.p.wpn === 'machete' || (a.weapon && a.weapon.k === 'machete') ? null : 'Needs an axe or a machete.'),
    done: (a, tg) => { const s = a.scene; const n = 2 + (Math.random() < 0.5 ? 1 : 0); const got = C.invAdd(a.p, 'lena', n); if (got < n) s.items.push({ k: 'lena', x: a.x + 6, y: a.y + 3, amount: n - got, label: 'Firewood' }); const i = s.props.indexOf(tg.o); if (i >= 0) s.props.splice(i, 1); s.pre = null; C.fx && C.fx.dust(s, tg.x, tg.y, 6); return null; },
  });
  C.registerVerb({
    id: 'give', n: 'Hand over', icon: '🤝', kinds: ['actor'], reach: 20, dur: 1.5,
    variants: (tg) => (tg.o.isPlayer ? [] : ['food', 'water', 'med', 'hoe', 'seed', 'bucket', 'axe', 'primer'].map((item) => ({ param: { item, n: 1 }, label: `Give ${C.ITEMS[item].n.toLowerCase()}` }))),
    check: (a, tg, p) => (p && !has(a, p.item) ? `You have no ${C.ITEMS[p.item].n.toLowerCase()}.` : null),
    done: (a, tg, p) => { C.give(a.p, tg.o.p, p.item, p.n); return null; },
  });
  C.registerVerb({
    id: 'treat', n: 'Bandage', icon: '✚', kinds: ['actor'], reach: 16, dur: 5,
    check: (a, tg) => (G().res.med < 1 && !has(a, 'med') ? 'No medicine.' : tg.o.p.hp >= tg.o.p.maxHp - 3 && !tg.o.p.bleed ? 'Not hurt.' : null),
    done: (a, tg) => { const q = tg.o.p; if (!C.invTake(a.p, 'med', 1)) G().res.med--; q.hp = Math.min(q.maxHp, q.hp + 28); q.bleed = 0; if (q.ill) q.ill = null; C.bondEvent && C.bondEvent(a.p, q, 'treated'); return null; },
  });

  // ------------------------------------------------------------------------------------------------------------------
  // 6. THE ACTIONS PANEL (palette)
  // ------------------------------------------------------------------------------------------------------------------
  const css = document.createElement('style');
  css.textContent = `
#actions{position:fixed;right:8px;top:92px;width:320px;max-height:calc(100vh - 330px);overflow:auto;z-index:6;display:none;padding:8px 10px}
#actions h3{margin:4px 0;font-size:11px;letter-spacing:.09em;text-transform:uppercase;color:var(--gold)}
#actions .mrow,#actions .srow{display:flex;gap:4px;align-items:center;padding:3px 4px;border-radius:7px;background:rgba(255,255,255,.05);margin-bottom:3px;font-size:12px}
#actions .srow .tx{flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
#actions .rec{background:rgba(220,74,58,.25);border:1px solid rgba(220,74,58,.7);border-radius:8px;padding:5px 7px;margin-bottom:6px}
#actions input[type=text],#actions input[type=number]{background:rgba(0,0,0,.3);color:inherit;border:1px solid var(--line);border-radius:5px;padding:2px 5px;font:inherit}
#actions .tog{font-size:10px;padding:1px 5px}`;
  document.head.appendChild(css);
  const panel = document.createElement('div'); panel.id = 'actions'; panel.className = 'panel'; document.body.appendChild(panel);
  const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  let open = false;
  C.toggleActions = function () { open = !open; panel.style.display = open ? 'block' : 'none'; if (open) refreshPanel(); };

  function stepText(st) {
    if (st.t === 'goto') return st.mode === 'dist' ? `Walk ${Math.round(Math.hypot(st.dx, st.dy) / T * 10) / 10} tiles (${Math.abs(st.dx) > Math.abs(st.dy) ? (st.dx > 0 ? 'east' : 'west') : (st.dy > 0 ? 'south' : 'north')})` : `Walk to this spot`;
    if (st.t === 'wait') return `Wait ${st.s}s`; if (st.t === 'say') return `Say "${st.text}"`;
    const V = C.VERB[st.v]; const tn = st.tgt.kind === 'thing' ? (C.THINGS[st.tgt.tk] || {}).n : st.tgt.kind === 'animal' ? st.tgt.ak : st.tgt.kind;
    const par = st.param && st.param.item ? ` ${st.param.n || ''} ${C.ITEMS[st.param.item].n.toLowerCase()}` : '';
    return `${V ? V.n : st.v}${par} → ${tn}${st.tgt.mode === 'nearest' ? ' (nearest)' : ''}`;
  }
  /** Rebuild the panel HTML. */
  function refreshPanel() {
    const g = G(); if (!g || !open) return; C.initActions(); const r = g.rec;
    let h = `<button class="btn sm" style="float:right" id="acClose">✕</button><h3>Actions</h3>`;
    h += `<div class="sub" style="margin-bottom:5px">Record what you tell one soldier to do, then replay it for anyone. If something is missing or blocked, they stop, say why, and walk back.</div>`;
    if (r.on) {
      h += `<div class="rec"><b>● Recording ${esc(C.tagName(C.P(r.pid)))}</b><div class="sub">Right-click to walk · Q for the context wheel · Esc closes the wheel</div>`;
      h += `<input type="text" id="acName" value="${esc(r.name)}" style="width:100%;margin:4px 0">`;
      r.steps.forEach((st, i) => { h += `<div class="srow"><span class="tx" title="${esc(stepText(st))}">${i + 1}. ${esc(stepText(st))}</span>${st.t === 'goto' ? `<button class="btn tog" data-tg="${i}">${st.mode === 'dist' ? 'distance' : 'spot'}</button>` : st.t === 'verb' && st.tgt.kind !== 'ground' && st.tgt.kind !== 'actor' ? `<button class="btn tog" data-tn="${i}">${st.tgt.mode === 'nearest' ? 'nearest' : 'this one'}</button>` : ''}<button class="btn tog" data-up="${i}">↑</button><button class="btn tog" data-del="${i}">✕</button></div>`; });
      h += `<div style="display:flex;gap:6px;align-items:center;margin-top:4px;flex-wrap:wrap"><label>repeat <input type="number" id="acRep" min="1" max="20" value="${r.repeat || 1}" style="width:46px"></label><label><input type="checkbox" id="acHome" ${r.home !== false ? 'checked' : ''}> return home</label></div>`;
      h += `<div style="display:flex;gap:6px;margin-top:5px"><button class="btn sm primary" id="acSave">■ Stop &amp; save</button><button class="btn sm" id="acDiscard">Discard</button></div></div>`;
    } else {
      h += `<button class="btn sm danger" id="acRec">● Record (selected soldier)</button>`;
    }
    h += `<h3 style="margin-top:8px">Saved actions</h3>`;
    const all = (C.PRESETS || []).map((m) => Object.assign({ preset: true }, m)).concat(g.macros);
    if (!all.length) h += `<div class="sub">None yet.</div>`;
    all.forEach((m) => { h += `<div class="mrow"><span class="tx" style="flex:1;overflow:hidden;text-overflow:ellipsis" title="${esc(m.steps.map(stepText).join(' → '))}">${m.preset ? '📋' : '⚙'} ${esc(m.name)} <span class="sub">(${m.steps.length})</span></span><button class="btn tog" data-play="${m.id}">▶ play</button><button class="btn tog" data-sched="${m.id}" title="Run it daily at an hour, for the selected people">🕐</button>${m.preset ? `<button class="btn tog" data-copy="${m.id}" title="Make an editable copy">⧉</button>` : `<button class="btn tog" data-rm="${m.id}">✕</button>`}</div>`; });
    panel.innerHTML = h;
    const q = (s) => panel.querySelector(s); const qa = (s) => panel.querySelectorAll(s);
    q('#acClose').onclick = C.toggleActions;
    if (q('#acRec')) q('#acRec').onclick = C.recStart;
    if (r.on) {
      q('#acName').onchange = (e) => { r.name = e.target.value; }; q('#acRep').onchange = (e) => { r.repeat = Math.max(1, Math.min(20, +e.target.value || 1)); }; q('#acHome').onchange = (e) => { r.home = e.target.checked; };
      q('#acSave').onclick = () => C.recStop(true); q('#acDiscard').onclick = () => C.recStop(false);
      qa('[data-tg]').forEach((b) => b.onclick = () => { const st = r.steps[+b.dataset.tg]; st.mode = st.mode === 'dist' ? 'spot' : 'dist'; refreshPanel(); });
      qa('[data-tn]').forEach((b) => b.onclick = () => { const st = r.steps[+b.dataset.tn]; st.tgt.mode = st.tgt.mode === 'nearest' ? 'specific' : 'nearest'; refreshPanel(); });
      qa('[data-del]').forEach((b) => b.onclick = () => { r.steps.splice(+b.dataset.del, 1); refreshPanel(); });
      qa('[data-up]').forEach((b) => b.onclick = () => { const i = +b.dataset.up; if (i > 0) { [r.steps[i - 1], r.steps[i]] = [r.steps[i], r.steps[i - 1]]; refreshPanel(); } });
    }
    const find = (id) => (C.PRESETS.find((x) => x.id === id) || g.macros.find((x) => x.id === id));
    qa('[data-play]').forEach((b) => b.onclick = () => C.playMacro(find(b.dataset.play)));
    qa('[data-rm]').forEach((b) => b.onclick = () => { g.macros = g.macros.filter((x) => x.id !== b.dataset.rm); refreshPanel(); });
    qa('[data-copy]').forEach((b) => b.onclick = () => { const m = find(b.dataset.copy); g.macros.push(JSON.parse(JSON.stringify(Object.assign({}, m, { id: 'm' + Date.now(), name: m.name + ' (copy)', preset: false })))); refreshPanel(); });
    qa('[data-sched]').forEach((b) => b.onclick = () => { const m = find(b.dataset.sched); const hs = window.prompt('Run "' + m.name + '" every day at what hour? (0–23.5, e.g. 6.5)', '6'); if (hs === null) return; const hr = parseFloat(hs); if (isNaN(hr)) return; const ids = C.selIds(); ids.forEach((id) => C.addRoutine(C.P(id), m, hr)); toast(`${ids.length} will do "${m.name}" daily at ${hr}h`); });
  }
  window.addEventListener('keydown', (e) => { const g = G(); if (!g || !g.scene || g.over || (e.target && ['INPUT', 'SELECT', 'TEXTAREA'].includes(e.target.tagName))) return; if (e.key === 'k' || e.key === 'K') { if (!e.shiftKey) C.toggleActions(); } });
})();
