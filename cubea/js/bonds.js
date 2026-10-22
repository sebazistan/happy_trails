/* CUBEA — bonds.js : friendship that grows from shared time and shared danger, until it counts as much as family.

   THE IDEA
   Family ties are fixed at birth. Friendship should be *earned in play*: the men who sleep in the same ditch, split the
   same ration, and come back from the same ambush become brothers. When one of them dies, the other grieves like a
   brother — because the loyalty engine treats a strong bond as a strong family edge.

   HOW IT WORKS
     bond value  b ∈ [0,100] per pair, stored symmetrically in p.bonds[otherId].
     growth      every game-minute two rebels stand within BOND_RANGE of each other: +RATE·(1 − b/110)
                 × 6 if BOTH are "in combat" (firing, hit recently, exposed)      ← proximity-in-combat boost
                 × 1.5 if they are in the same group/squad
                 × personality (kind/generous/gossip faster; cautious/stoic slower; hothead/greedy slightly slower)
     events      C.bondEvent(a,b,kind,x) gives instant jumps: shared a ration (+1.2), treated a wound (+6),
                 pulled out of a firefight (+10), survived a battle together (+3), fought side by side (+0.4/s via the
                 combat multiplier), lost the same friend (+4).
     decay       a pair that has been apart for a long while loses a little (never below half of what was reached).
     effect      at b ≥ 20 a real edge {t:'bond', w:b/100} is written into BOTH people's p.rel[], so the existing
                 kin/audience machinery (C.audienceOf, gen.js) carries events along it. audienceOf maps a bond of
                 strength w to an audience weight 0.25 + 0.75·w — a full bond (w=1) weighs 1.0, like a spouse or child.
     labels      <20 acquaintance · 20–49 friend · 50–79 close friend · ≥80 brother/sister-in-arms

   WHAT THE PLAYER SEES   the inspector's "Bonds" block (ui.js) and the log line when a pair crosses a threshold.
*/
(function () {
  'use strict';
  const C = window.C, G = () => C.G, clamp = C.clamp;

  // ------------------------------------------------------------------------------------------------------------------
  // TUNE
  // ------------------------------------------------------------------------------------------------------------------
  const TUNE = {
    range: 46,            // world px (≈3 tiles): "near each other"
    rate: 0.05,           // bond points per game-minute of proximity, before multipliers
    combatBoost: 6,       // multiplier when both are in combat
    squadBoost: 1.5,      // multiplier for the same group
    edgeAt: 20,           // bond value at which a real relationship edge is created
    cap: 100,
    tickEvery: 1.0,       // real seconds between bond updates (pair search is O(n²) over the people in the scene)
  };
  C.BOND_TUNE = TUNE;

  /** Human label for a bond value (used by the inspector and the log). */
  C.bondLabel = (b) => (b >= 80 ? 'brother-in-arms' : b >= 50 ? 'close friend' : b >= 20 ? 'friend' : 'acquaintance');

  /** Read the bond value between two people (0 if none). */
  C.bondOf = (p, q) => (p.bonds && p.bonds[q.id]) || 0;

  /** Personality multiplier on how fast a person bonds. */
  function sociability(p) {
    let k = 1;
    if (p.traits.includes('kind')) k *= 1.25; if (p.traits.includes('generous')) k *= 1.2; if (p.traits.includes('gossip')) k *= 1.15;
    if (p.traits.includes('cautious')) k *= 0.85; if (p.traits.includes('stoic')) k *= 0.85; if (p.traits.includes('hothead')) k *= 0.9; if (p.traits.includes('greedy')) k *= 0.8;
    return k;
  }

  /** Add `d` to the bond of a pair (symmetric), update the relationship edge, announce threshold crossings. */
  function addBond(p, q, d) {
    if (p.id === q.id || d <= 0) return;
    p.bonds = p.bonds || {}; q.bonds = q.bonds || {};
    const before = p.bonds[q.id] || 0, after = clamp(before + d, 0, TUNE.cap);
    p.bonds[q.id] = q.bonds[p.id] = after;
    if (after >= TUNE.edgeAt) writeEdge(p, q, after);
    // announce when a pair crosses 20 / 50 / 80
    for (const th of [20, 50, 80]) if (before < th && after >= th && C.log) {
      // only log if the player has something to learn from it: a named leader or squadmates
      C.log(`${C.tagName(p)} and ${C.tagName(q)} have become ${th === 20 ? 'friends' : th === 50 ? 'close friends' : 'brothers-in-arms'}.`, th >= 50 ? 'good' : 'info');
    }
  }

  /** Make sure both people carry a 'bond' relationship edge whose weight tracks the bond value. */
  function writeEdge(p, q, b) {
    for (const [x, y] of [[p, q], [q, p]]) {
      let e = x.rel.find((r) => r.id === y.id && r.t === 'bond');
      if (!e) { e = { id: y.id, t: 'bond', w: 0 }; x.rel.push(e); }
      e.w = b / 100;
    }
  }

  /**
   * Instant bond events.
   *  kind: 'shared' (gave food/water/ammo), 'treated' (bandaged), 'saved' (pulled from fire), 'survived' (battle over),
   *        'mourned' (lost the same friend).  `mult` scales the amount.
   */
  C.bondEvent = function (a, b, kind, mult) {
    const amt = { shared: 1.2, treated: 6, saved: 10, survived: 3, mourned: 4, fought: 0.4 }[kind] || 1;
    addBond(a, b, amt * (mult || 1) * Math.sqrt(sociability(a) * sociability(b)));
  };

  // is this actor currently "in combat" (for the proximity-in-combat multiplier)?
  const inCombat = (a, g) => a.shooting > 0 || a.exposed > 0 || a.lastHit > g.time - 8 || a.suppressed > 0;

  /**
   * The proximity tick. Called from main.js update(). Looks at every pair of rebels (and the player) in the scene
   * that are within range and adds bond. A simple grid keeps it cheap with ~60 rebels.
   */
  C.bondTick = function (s, dt) {
    const g = G(); s.bondT = (s.bondT || 0) - dt; if (s.bondT > 0) return; const step = TUNE.tickEvery; s.bondT = step;
    const gm = step * g.minPerSec;                 // game minutes elapsed since the last tick
    if (gm <= 0) return;
    const rs = s.actors.filter((a) => (a.side === 'rebel' || a.isPlayer) && !a.dead && !a.inside && !a.inVeh && !a.deck && !a.gone);
    let anyCombat = false;
    for (let i = 0; i < rs.length; i++) for (let j = i + 1; j < rs.length; j++) {
      const a = rs[i], b = rs[j]; const dx = a.x - b.x; if (dx > TUNE.range || dx < -TUNE.range) continue; const dy = a.y - b.y; if (dx * dx + dy * dy > TUNE.range * TUNE.range) continue;
      let k = TUNE.rate * gm * Math.sqrt(sociability(a.p) * sociability(b.p));
      const both = inCombat(a, g) && inCombat(b, g); if (both) { k *= TUNE.combatBoost; anyCombat = true; (a.p.stats = a.p.stats || {}).foughtWith = 1; a.p.combatMates = a.p.combatMates || new Set(); a.p.combatMates.add(b.p.id); b.p.combatMates = b.p.combatMates || new Set(); b.p.combatMates.add(a.p.id); }
      if (a.squad >= 0 && a.squad === b.squad) k *= TUNE.squadBoost;
      const cur = C.bondOf(a.p, b.p); k *= (1 - cur / 110);
      addBond(a.p, b.p, k);
    }
    // when the fighting is over, everyone who stood together in it gets a "survived together" bonus
    if (!anyCombat && s.wasCombat) {
      for (const a of rs) if (a.p.combatMates) { for (const id of a.p.combatMates) { const q = C.P(id); if (q && q.status === 'alive' && a.p.id < id) C.bondEvent(a.p, q, 'survived'); } a.p.combatMates = null; }
    }
    s.wasCombat = anyCombat;
  };

  /** Daily: bonds between people who have been apart fade slowly (but never below half of the peak). */
  C.bondDaily = function () {
    const g = G();
    for (const id of C.partyIds()) {
      const p = C.P(id); if (!p || !p.bonds) continue;
      for (const k in p.bonds) {
        const q = C.P(+k); if (!q || q.status === 'dead') continue;
        const apart = !(p.actor && q.actor && p.actor.scene === q.actor.scene);
        if (apart && p.bonds[k] > 10) { const peak = (p.bondPeak = p.bondPeak || {}); peak[k] = Math.max(peak[k] || 0, p.bonds[k]); p.bonds[k] = Math.max(peak[k] * 0.5, p.bonds[k] - 0.15); }
      }
    }
  };

  /** Strongest bonds of a person, for the inspector. */
  C.bondsOf = function (p, n) {
    if (!p.bonds) return [];
    return Object.keys(p.bonds).map((k) => ({ q: C.P(+k), b: p.bonds[k] })).filter((x) => x.q && x.b >= 12).sort((x, y) => y.b - x.b).slice(0, n || 5);
  };
})();
