/* CUBEA — combat.js : bullets (fast, with travel time), accuracy, wounds (cracks heal, chunks don't), bleeding, death,
   grenades, explosions with shrapnel, mortars, an air raid, particles. Meant to feel gritty, not cartoony. */
(function () {
  'use strict';
  const C = (window.C = window.C || {});
  const T = C.T, TL = C.TILE, clamp = C.clamp;
  const G = () => C.G;
  const gauss = () => { let u = 0, v = 0; while (!u) u = Math.random(); while (!v) v = Math.random(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(6.283 * v); };

  // ---------------- effects ----------------
  C.fx = {
    smoke(s, x, y, kind) { s.parts.push({ k: kind === 'fire' ? 'fire' : 'smoke', x, y, vx: (Math.random() - 0.5) * 8, vy: -8 - Math.random() * 10, r: kind === 'fire' ? 3 + Math.random() * 2.5 : 4 + Math.random() * 4, life: kind === 'fire' ? 0.6 : 1.8 + Math.random(), max: kind === 'fire' ? 0.6 : 2.4, c: 70 + (Math.random() * 40) | 0 }); },
    dust(s, x, y, n) { for (let i = 0; i < (n || 4); i++) s.parts.push({ k: 'dust', x, y, vx: (Math.random() - 0.5) * 36, vy: (Math.random() - 0.5) * 20 - 6, r: 2 + Math.random() * 3, life: 0.5 + Math.random() * 0.4, max: 0.9 }); },
    spark(s, x, y, ang, n) { for (let i = 0; i < (n || 3); i++) { const a = ang + (Math.random() - 0.5) * 1.6, sp = 60 + Math.random() * 120; s.parts.push({ k: 'spark', x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, r: 1, life: 0.18 + Math.random() * 0.14, max: 0.32 }); } },
    flash(s, x, y, r) { s.parts.push({ k: 'flash', x, y, vx: 0, vy: 0, r: r || 12, life: 0.18, max: 0.18 }); },
    ring(s, x, y, r) { s.parts.push({ k: 'ring', x, y, vx: 0, vy: 0, r: r || 40, life: 0.35, max: 0.35 }); },
    chunks(s, a, n, big) {
      const col = a.drawColor || [200, 200, 200];
      for (let i = 0; i < n; i++) { const ang = Math.random() * 6.283, sp = (big ? 70 : 40) + Math.random() * 90; s.parts.push({ k: 'chunk', x: a.x, y: a.y - 8, z: 0, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp * 0.6, vz: 40 + Math.random() * 60, rot: Math.random() * 6, vr: (Math.random() - 0.5) * 12, r: big ? 1.1 + Math.random() * 1.6 : 0.8 + Math.random() * 1.0, col: i % 3 === 0 ? [90, 20, 20] : col, life: 1.3 + Math.random() * 0.8, max: 2.1 }); }
    },
  };
  C.later = function (s, delay, fn) { (s.timers = s.timers || []).push({ t: delay, fn }); };

  C.updateFx = function (s, dt) {
    const parts = s.parts;
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i]; p.life -= dt; if (p.life <= 0) { parts.splice(i, 1); continue; }
      p.x += p.vx * dt; p.y += p.vy * dt;
      if (p.k === 'chunk') { p.vz -= 260 * dt; p.z += p.vz * dt; p.rot += p.vr * dt; if (p.z < 0) { p.z = 0; p.vz = -p.vz * 0.35; p.vx *= 0.55; p.vy *= 0.55; p.vr *= 0.5; if (Math.abs(p.vz) < 12) { p.vz = 0; } } }
      else if (p.k === 'smoke') { p.vx *= 0.98; p.vy *= 0.99; }
      else if (p.k === 'dust') { p.vx *= 0.9; p.vy *= 0.9; }
    }
    if (parts.length > 900) parts.splice(0, parts.length - 900);
    // timers
    if (s.timers) for (let i = s.timers.length - 1; i >= 0; i--) { const tm = s.timers[i]; tm.t -= dt; if (tm.t <= 0) { s.timers.splice(i, 1); try { tm.fn(); } catch (e) { console.error(e); } } }
    // thrown
    for (let i = s.thrown.length - 1; i >= 0; i--) {
      const g = s.thrown[i]; g.t += dt;
      g.x += g.vx * dt; g.y += g.vy * dt; g.vh -= 190 * dt; g.h += g.vh * dt;
      if (g.h <= 0) { g.h = 0; g.vh = -g.vh * 0.3; g.vx *= 0.5; g.vy *= 0.5; if (g.k === 'molotov' && !g.done) { g.done = true; igniteArea(s, g.x, g.y, 34, g.owner); s.thrown.splice(i, 1); continue; } }
      if (C.footBlocked(s, g.x, g.y, 1) && !g.bounced) { g.vx *= -0.3; g.vy *= -0.3; g.bounced = true; }
      if (g.t >= g.fuse) { s.thrown.splice(i, 1); const ex = C.EXPLOSIVES[g.k]; C.explode(s, g.x, g.y, ex.rad, ex.dmg, g.owner, { frags: ex.frags, kind: g.k }); }
    }
    // fires
    for (let i = s.fires.length - 1; i >= 0; i--) {
      const f = s.fires[i]; f.t -= dt; if (f.t <= 0) { s.fires.splice(i, 1); continue; }
      if (Math.random() < dt * 22) { C.fx.smoke(s, f.x + (Math.random() - 0.5) * f.r * 1.4, f.y + (Math.random() - 0.5) * f.r, 'fire'); }
      if (Math.random() < dt * 5) C.fx.smoke(s, f.x + (Math.random() - 0.5) * f.r, f.y - 4, 'smoke');
      f.hurtT = (f.hurtT || 0) - dt;
      if (f.hurtT <= 0) { f.hurtT = 0.5; for (const a of s.actors) { if (a.dead || a.inside) continue; if (Math.hypot(a.x - f.x, a.y - f.y) < f.r) { C.hurt(a, 9 + Math.random() * 7, f.owner, 0, 'fire'); a.panic = 1; } } for (const v of s.vehicles) if (!v.wreck && Math.hypot(v.x - f.x, v.y - f.y) < f.r + 10) { v.hp -= 10; if (v.fuel > 1 && Math.random() < 0.2) v.burning = 6; } }
    }
    if (s.decals.length > 500) s.decals.splice(0, s.decals.length - 500);
  };
  function igniteArea(s, x, y, r, owner) { s.fires.push({ x, y, r, t: 7, owner }); C.fx.flash(s, x, y, r * 0.8); C.alertScene(s, x, y, 'explosion'); }

  // ---------------- shooting ----------------
  C.accuracyOf = function (a) {
    const p = a.p;
    return clamp(0.12 + p.exp / 100 * 0.78 + (p.traits.includes('veteran') ? 0.08 : 0) - p.stress / 400 - (p.armHurt ? 0.12 : 0) - (p.needs.energy < 25 ? 0.08 : 0), 0.05, 0.98);
  };
  let lastNoise = 0;
  C.tryFire = function (s, a, tx, ty, bonus) {
    if (a.dead || !a.weapon || a.cd > 0 || a.reload > 0) return false;
    const w = C.WEAPONS[a.weapon.k];
    if (w.melee) return meleeAttack(s, a, tx, ty);
    if (a.weapon.mag <= 0) { if (a.weapon.spare === undefined || a.weapon.spare > 0) a.reload = w.rel; else { a.cd = 0.6; C.say(a, '¡Sin balas!', '#7a1d1d', 1.6); } return false; }
    a.weapon.mag--; a.cd = (1 / w.rof) * (0.92 + Math.random() * 0.16); a.muzzle = 0.07; a.shooting = 0.8; a.exposed = 6;
    const acc = C.accuracyOf(a) * (bonus || 1);
    const dist = Math.hypot(tx - a.x, ty - a.y);
    let spread = w.spr * (1 + (a.moving ? 0.6 : 0) + a.p.stress / 160 + (a.suppressed > 0 ? 0.6 : 0) - (a.prone ? 0.25 : 0)) * (1.65 - 1.15 * clamp(acc, 0, 1));
    const aim = Math.atan2(ty - (a.y - 9), tx - a.x);
    a.aim = aim;
    const n = w.pellets || 1;
    for (let i = 0; i < n; i++) {
      const ang = aim + gauss() * spread * Math.PI / 180;
      const mx = a.x + Math.cos(aim) * 9, my = a.y - 9 + Math.sin(aim) * 9;
      s.bullets.push({ x: mx, y: my, vx: Math.cos(ang) * w.spd, vy: Math.sin(ang) * w.spd, dmg: w.dmg * (0.9 + Math.random() * 0.2), owner: a, side: a.side, life: w.rng * 1.5 / w.spd, big: a.weapon.k === 'mg', dist: 0, ox: mx, oy: my, wk: a.weapon.k });
    }
    C.fx.spark(s, a.x + Math.cos(aim) * 11, a.y - 9 + Math.sin(aim) * 11, aim, 1);
    if (C.snd) C.snd.shot(w.snd, a.x, a.y, a.side);
    // noise: alert soldiers and scare civilians/animals (throttled)
    if (G().time - lastNoise > 0.35 || a.weapon.k === 'mg') { lastNoise = G().time; C.alertScene(s, a.x, a.y, 'shot'); C.scareAnimals(s, a.x, a.y, 150); }
    if (a.isPlayer || a.side === 'rebel') G().combatT = 8;
    return true;
  };
  function meleeAttack(s, a, tx, ty) {
    a.cd = 0.8; a.shooting = 0.4; a.aim = Math.atan2(ty - a.y, tx - a.x);
    for (const o of s.actors) { if (o === a || o.dead || o.inside || o.side === a.side) continue; if (Math.hypot(o.x - (a.x + Math.cos(a.aim) * 10), o.y - a.y) < 12) { C.hurt(o, 36 + Math.random() * 16, a, a.aim, 'blade'); return true; } }
    return false;
  }

  C.updateBullets = function (s, dt) {
    const B = s.bullets;
    for (let i = B.length - 1; i >= 0; i--) {
      const b = B[i]; const sp = Math.hypot(b.vx, b.vy); const steps = Math.max(1, Math.ceil(sp * dt / 5)); const sdt = dt / steps; let dead = false;
      for (let st = 0; st < steps && !dead; st++) {
        b.x += b.vx * sdt; b.y += b.vy * sdt; b.life -= sdt; b.dist += sp * sdt;
        if (b.life <= 0) { dead = true; break; }
        const tx = Math.floor(b.x / T), ty = Math.floor(b.y / T);
        if (tx < 0 || ty < 0 || tx >= s.tw || ty >= s.th) { dead = true; break; }
        const tile = s.tiles[ty * s.tw + tx];
        const bc = C.bulletBlockChance(tile);
        if (bc >= 1) { C.fx.dust(s, b.x, b.y, 3); C.fx.spark(s, b.x, b.y, Math.atan2(-b.vy, -b.vx), 3); if (tile === TL.BLD) { const bl = s.blds.find((q) => tx >= q.x && tx < q.x + q.w && ty >= q.y && ty < q.y + q.h); if (bl && b.owner && b.owner.side === 'rebel') bl.shotAt = (bl.shotAt || 0) + 1; } dead = true; break; }
        if (bc > 0 && Math.random() < bc * (sp * sdt / 8) * (tile === TL.FOR ? (b.dist < 40 ? 0.3 : 1) : 1)) { C.fx.spark(s, b.x, b.y, Math.atan2(-b.vy, -b.vx), 1); s.parts.push({ k: 'dust', x: b.x, y: b.y, vx: 0, vy: 0, r: 2, life: 0.3, max: 0.3 }); dead = true; break; }
        // actors
        for (const o of s.actors) {
          if (o.dead || o.inside || o.gone || o === b.owner) continue;
          if (o.inVeh) continue;
          if (b.side && o.side === b.side && b.side !== 'civ') continue;
          if (b.side === 'civ' && o.side === 'civ') continue;
          const prone = o.prone || o.hide; const cx = o.x, cy = o.y - (prone ? 5 : 8.5), r = prone ? 3.8 : 5.6;
          const dx = b.x - cx, dy = b.y - cy;
          if (dx * dx + dy * dy < r * r) {
            if (b.dist < 14) continue;   // don't shoot yourself through the neighbour at the muzzle
            C.hurt(o, b.dmg, b.owner, Math.atan2(b.vy, b.vx), 'bullet'); dead = true; break;
          }
          // near miss -> suppression
          const near = 15; if (dx * dx + dy * dy < near * near && b.owner && !o._missT) {
            o._missT = 1; o.suppressed = Math.min(5, o.suppressed + 1.2); o.p.stress = Math.min(100, o.p.stress + 1.2); o.p.fear = Math.min(100, o.p.fear + 0.9); o.p.morale = Math.max(0, o.p.morale - 0.25);
            if (o.side === 'civ') o.panic = Math.min(1, o.panic + 0.5);
            if (o.side === 'rebel' && Math.random() < 0.08) C.say(o, ['¡Nos tiran!', '¡Agáchense!', '¡Cuidado!'][Math.floor(Math.random() * 3)], '#7a1d1d', 1.2);
            C.later(s, 0.15, () => { o._missT = 0; });
          }
        }
        if (dead) break;
        // vehicles
        for (const v of s.vehicles) {
          if (v.gone) continue; const ca = Math.cos(-v.ang), sa = Math.sin(-v.ang); const lx = (b.x - v.x) * ca - (b.y - v.y) * sa, ly = (b.x - v.x) * sa + (b.y - v.y) * ca;
          if (Math.abs(lx) < v.def.w / 2 && Math.abs(ly) < v.def.h / 2 + 1) {
            if (b.dist < 12) continue; if (v.wreck) { dead = true; break; }
            v.hp -= b.dmg * 0.55; C.fx.spark(s, b.x, b.y, Math.atan2(-b.vy, -b.vx), 3);
            if (v.def.wheels && Math.abs(lx) > v.def.w * 0.2 && Math.random() < 0.16) { const wi = (lx > 0 ? 1 : 0) + (ly > 0 ? 2 : 0); if (v.tires[wi] > 0.2) { v.tires[wi] = 0.05; if (b.owner && b.owner.isPlayer) C.say(b.owner, '¡Goma ponchada!', '#444', 1.5); } }
            if (v.fuel > 2 && Math.random() < 0.06) { v.burning = 7; }
            if (Math.random() < 0.25) v.engine = Math.max(0, v.engine - 0.18);
            const occ = [v.driver].concat(v.pass).filter(Boolean); if (occ.length && Math.random() < 0.4) { const o = occ[Math.floor(Math.random() * occ.length)]; C.hurt(o, b.dmg * 0.7, b.owner, Math.atan2(b.vy, b.vx), 'bullet'); }
            if (v.hp <= 0 && !v.wreck) C.wreckVehicle(s, v);
            dead = true; break;
          }
        }
        if (dead) break;
        for (const an of s.animals) { if (an.dead) continue; if ((b.x - an.x) ** 2 + (b.y - an.y - 3) ** 2 < (an.def.sz + 1) ** 2) { an.hp -= b.dmg; an.flee = 5; if (an.hp <= 0) { an.dead = true; s.decals.push({ k: 'blood', x: an.x, y: an.y, r: 3, a: 0.6, rot: 1, t0: G().time, fade: 400 }); if (an.def.food) s.items.push({ k: 'food', x: an.x, y: an.y, label: 'Carne de ' + an.def.n, amount: an.def.food }); if (b.owner && b.owner.isPlayer) C.emit && C.emit('hunt', { animal: an }); } dead = true; break; } }
        if (dead) break;
        for (const o of s.objs) { if (o.dead) continue; if (Math.abs(b.x - o.x) < o.w / 2 && Math.abs(b.y - o.y) < o.h / 2) { o.hp -= b.dmg * 0.5; C.fx.spark(s, b.x, b.y, Math.atan2(-b.vy, -b.vx), 2); if (o.hp <= 0) C.destroyObj(s, o, b.owner); dead = true; break; } }
      }
      if (dead) B.splice(i, 1);
    }
  };

  // ---------------- wounds ----------------
  const DIR8 = [5, 2, 6, 3, 7, 0, 4, 1];      // east, SE, S, SW, W, NW, N, NE  -> notch slot
  C.hurt = function (a, dmg, src, ang, kind) {
    if (a.dead) return;
    const s = a.scene, p = a.p, g = G();
    const prone = a.prone || a.hide; if (prone && kind === 'bullet') dmg *= 0.85; if (kind === 'bullet' && C.inFoxhole && C.inFoxhole(a)) dmg *= 0.5;
    p.hp -= dmg; a.pain = Math.min(1, a.pain + dmg / 55); p.stress = Math.min(100, p.stress + dmg * 0.45); p.fear = Math.min(100, p.fear + dmg * 0.25); p.morale = Math.max(0, p.morale - dmg * 0.22);
    a.lastHit = g.time; a.lastAttacker = src; a.hurtT = 2; a.panic = Math.min(1, a.panic + (a.side === 'civ' ? 0.9 : 0.15)); a.exposed = Math.max(a.exposed || 0, 3);
    a.wounded = true;
    if (a.isPlayer) { g.hurt = Math.min(0.7, g.hurt + dmg / 80); g.shake = Math.max(g.shake, 0.4); }
    // visual damage: cracks for light hits, a missing chunk for serious ones
    const serious = dmg >= 26 || (dmg > 12 && p.hp < p.maxHp * 0.34);
    if (serious && p.chunks.length < 6) {
      const hx = -Math.cos(ang || 0), hy = -Math.sin(ang || 0);
      let idx = Math.round(((Math.atan2(hy, hx) + Math.PI * 2) % (Math.PI * 2)) / (Math.PI / 4)) % 8;
      let pos = DIR8[idx]; if (kind === 'blast' || kind === 'fire') pos = Math.floor(Math.random() * 8);
      if (Math.random() < 0.3) pos = (pos + (Math.random() < 0.5 ? 1 : 7)) % 8;
      if (p.chunks.some((c) => c.pos === pos)) pos = (pos + 1) % 8;
      const size = clamp(0.2 + dmg / 260 + Math.random() * 0.1, 0.2, 0.46);
      p.chunks.push({ pos, s: size });
      p.maxHp = Math.max(35, p.maxHp - dmg * 0.14);
      if ([2, 3, 6].includes(pos)) p.limp = 1; if ([1, 5, 7].includes(pos)) p.armHurt = 1;
      p.bleed = Math.max(p.bleed, 0.5 + dmg / 70);
      C.fx.chunks(s, a, 3 + (dmg / 25 | 0), false);
      if (Math.random() < 0.7 || a.isPlayer) C.say(a, ['¡Ay!', '¡Me dieron!', '¡Aaah!', '¡Estoy herido!'][Math.floor(Math.random() * 4)], '#7a1d1d', 1.6);
      if (a.side === 'rebel' && a.squad >= 0) C.log && C.log(C.tagName(p) + ' está herido' + (pos < 4 ? ' (pierde un pedazo)' : ''), 'warn');
    } else {
      const n = 1 + (dmg > 14 ? 1 : 0);
      for (let i = 0; i < n; i++) p.cracks.push({ x: (Math.random() - 0.5) * 0.7, y: (Math.random() - 0.5) * 0.7, a: Math.random() * 6.28, l: 0.7 + Math.random() * 0.3, n: Math.random() * 2 | 0, s: Math.random(), t: g.day });
      if (p.cracks.length > 14) p.cracks.splice(0, p.cracks.length - 14);
      C.fx.chunks(s, a, 1, false);
    }
    s.decals.push({ k: 'blood', x: a.x + (Math.random() - 0.5) * 6, y: a.y + (Math.random() - 0.5) * 4, r: 1.4 + dmg / 30, a: 0.55, rot: Math.random() * 6, t0: g.time, fade: 500 });
    C.fx.spark(s, a.x, a.y - 8, (ang || 0), 2);
    if (C.snd) C.snd.hit(a.x, a.y);
    if (p.hp <= 0) { C.die(a, src, kind); return; }
    // reaction
    if (a.side === 'army' && a.brain.mode !== 'engage' && src) { a.brain.mode = 'engage'; a.brain.target = src; a.brain.seen = 6; }
    if (a.side === 'army' && src) { a.brain.target = a.brain.target && !a.brain.target.dead ? a.brain.target : src; }
    if (C.emit && src && src.side !== a.side && p.hp < p.maxHp) C.emit('wound', { victim: a, killer: src, dmg });
  };

  C.dropWeapon = function (a) {
    if (!a.weapon) return;
    const s = a.scene; if (a.weapon.k === 'machete' && Math.random() < 0.5) { a.weapon = null; return; }
    s.items.push({ k: 'gun', x: a.x + (Math.random() - 0.5) * 8, y: a.y + 2, label: C.WEAPONS[a.weapon.k].n, wk: a.weapon.k, mag: a.weapon.mag, spare: a.weapon.spare || 0 });
    a.weapon = null; a.weaponOut = false;
  };

  C.die = function (a, killer, cause) {
    if (a.dead) return;
    const s = a.scene, p = a.p, g = G();
    a.dead = true; p.status = 'dead'; p.died = g.day; p.diedBy = cause; a.deadRot = (Math.random() < 0.5 ? 1 : -1) * (1.2 + Math.random() * 0.5); a.weaponOut = false; a.bubble = null; a.moving = false; a.path = null;
    p.hp = 0; a.alpha = 1;
    if (a.inVeh) C.exitVehicle(a, false);
    C.fx.chunks(s, a, cause === 'blast' ? 14 : 7, true); C.fx.dust(s, a.x, a.y, 4);
    s.decals.push({ k: 'blood', x: a.x, y: a.y, r: 5 + Math.random() * 2, a: 0.7, rot: Math.random() * 6, t0: g.time, fade: 900 });
    C.dropWeapon(a);
    if (a.weapon === null && p.wpn) { /* weapon dropped */ }
    // grenades etc. stay with the body; move out of the active list
    const i = s.actors.indexOf(a); if (i >= 0) s.actors.splice(i, 1); s.corpses.push(a);
    if (a.squad >= 0) { const sq = g.squads[a.squad]; if (sq) sq.members = sq.members.filter((id) => id !== p.id); }
    if (a.isPlayer) { g.over = { kind: 'dead', cause }; }
    // the people who loved them: events propagate through the family graph
    C.emit && C.emit('death', { victim: a, killer, cause });
    if (C.snd) C.snd.death(a.x, a.y);
  };

  // ---------------- explosions ----------------
  C.explode = function (s, x, y, rad, dmg, owner, opt) {
    opt = opt || {};
    const g = G();
    C.fx.flash(s, x, y, rad * 0.9); C.fx.ring(s, x, y, rad * 1.2);
    for (let i = 0; i < 10; i++) { const a = Math.random() * 6.28, sp = Math.random() * rad * 1.4; s.parts.push({ k: 'dust', x: x + Math.cos(a) * 3, y: y + Math.sin(a) * 3, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * 0.7, r: 3 + Math.random() * 4, life: 0.6 + Math.random() * 0.5, max: 1.1 }); }
    for (let i = 0; i < 7; i++) C.fx.smoke(s, x + (Math.random() - 0.5) * rad * 0.7, y + (Math.random() - 0.5) * rad * 0.5, 'smoke');
    for (let i = 0; i < 5; i++) C.fx.smoke(s, x + (Math.random() - 0.5) * rad * 0.5, y + (Math.random() - 0.5) * rad * 0.4, 'fire');
    s.decals.push({ k: 'crater', x, y, r: rad * 0.34, a: 0.85 }); s.decals.push({ k: 'scorch', x, y, r: rad * 0.7, a: 0.35 });
    // lasting smoke column
    for (let k = 0; k < 4; k++) C.later(s, 0.35 + k * 0.5, () => { C.fx.smoke(s, x, y - 4, 'smoke'); });
    // camera feel
    const gp = g.player; if (gp && gp.scene === s) { const d = Math.hypot(gp.x - x, gp.y - y); const k = clamp(1 - d / 420, 0, 1); g.shake = Math.max(g.shake, k * (rad / 60)); if (d < rad * 2.2) g.flash = Math.max(g.flash, 0.6 * clamp(1 - d / (rad * 2.2), 0, 1)); }
    if (C.snd) C.snd.boom(x, y, rad);
    // damage actors
    for (const a of s.actors.slice()) {
      if (a.dead || a.inside) continue;
      const d = Math.hypot(a.x - x, a.y - 6 - y); if (d > rad * 1.35) continue;
      if (d > 9 && C.losOpacity(s, x, y, a.x, a.y - 6) >= 1) continue;
      const k = Math.pow(clamp(1 - d / (rad * 1.35), 0, 1), 1.05); const amt = dmg * k;
      if (amt > 2) {
        const ang = Math.atan2(a.y - y, a.x - x);
        a.x += Math.cos(ang) * clamp(amt * 0.12, 0, 10) * (C.footBlocked(s, a.x + Math.cos(ang) * 8, a.y + Math.sin(ang) * 8, 3) ? 0 : 1); a.y += Math.sin(ang) * clamp(amt * 0.1, 0, 8) * (C.footBlocked(s, a.x, a.y + Math.sin(ang) * 8, 3) ? 0 : 1);
        a.suppressed = 4; a.panic = 1;
        C.hurt(a, amt, owner, ang + Math.PI, 'blast');
        if (!a.dead && owner && owner.side && owner.side !== a.side) { /* wounded by blast */ }
      }
    }
    for (const v of s.vehicles) { if (v.gone) continue; const d = Math.hypot(v.x - x, v.y - y); if (d > rad * 1.5) continue; const k = clamp(1 - d / (rad * 1.5), 0, 1); if (opt.vehicle === v) continue; v.hp -= dmg * k * 1.3; if (v.def.wheels) v.tires.forEach((q, i) => { if (Math.random() < k * 0.7) v.tires[i] = 0.05; }); if (k > 0.3 && v.fuel > 2 && Math.random() < 0.5) v.burning = 8; v.engine = Math.max(0, v.engine - k * 0.6); if (v.hp <= 0 && !v.wreck) C.wreckVehicle(s, v); }
    for (const o of s.objs) { if (o.dead) continue; const d = Math.hypot(o.x - x, o.y - y); if (d > rad * 1.3) continue; o.hp -= dmg * clamp(1 - d / (rad * 1.3), 0, 1) * 1.4; if (o.hp <= 0) C.destroyObj(s, o, owner); }
    for (const an of s.animals) { if (an.dead) continue; const d = Math.hypot(an.x - x, an.y - y); if (d < rad) { an.hp -= dmg * (1 - d / rad); an.flee = 5; if (an.hp <= 0) { an.dead = true; if (an.def.food) s.items.push({ k: 'food', x: an.x, y: an.y, label: 'Carne de ' + an.def.n, amount: an.def.food }); } } }
    // shrapnel
    const nf = opt.frags || 0;
    for (let i = 0; i < nf; i++) { const ang = (i / nf) * 6.283 + Math.random() * 0.4; s.bullets.push({ x: x + Math.cos(ang) * 4, y: y + Math.sin(ang) * 4, vx: Math.cos(ang) * 620, vy: Math.sin(ang) * 620, dmg: 20 + Math.random() * 10, owner: owner || null, side: null, life: rad * 1.7 / 620, dist: 20, frag: true }); }
    C.alertScene(s, x, y, 'explosion'); C.scareAnimals(s, x, y, rad * 4);
    if (owner && owner.side === 'rebel') g.combatT = 8;
    if (C.emit && owner) C.emit('blast', { x, y, rad, owner, kind: opt.kind });
  };

  C.destroyObj = function (s, o, owner) {
    if (o.dead) return; o.dead = true; o.hp = 0;
    C.explode(s, o.x, o.y, o.k === 'deposito' ? 78 : o.k === 'polvorin' ? 110 : 40, o.k === 'deposito' ? 140 : o.k === 'polvorin' ? 220 : 60, owner, { frags: 10 });
    if (o.k === 'deposito') { s.fires.push({ x: o.x, y: o.y, r: 30, t: 14, owner }); }
    if (C.emit) C.emit('sabotage', { obj: o, owner, scene: s });
  };

  // ---------------- throwing ----------------
  C.throwExplosive = function (a, tx, ty, kind) {
    const s = a.scene, ex = C.EXPLOSIVES[kind]; if (!ex) return false;
    if (a.cd > 0.3) return false;
    const ang = Math.atan2(ty - (a.y - 9), tx - a.x); const d = Math.min(Math.hypot(tx - a.x, ty - a.y), 150);
    const flight = 0.55 + d / 260; const vx = Math.cos(ang) * d / flight, vy = Math.sin(ang) * d / flight;
    s.thrown.push({ k: kind, x: a.x, y: a.y - 9, h: 10, vh: 190 * flight / 2 - 10 * 0, vx, vy, t: 0, fuse: kind === 'molotov' ? 9 : Math.max(ex.fuse, flight + 0.4), owner: a });
    a.cd = 0.9; a.aim = ang; a.shooting = 0.5; a.exposed = 6; C.say(a, kind === 'molotov' ? '¡Molotov!' : '¡Granada!', '#7a1d1d', 1.2);
    if (G().player === a || a.side === 'rebel') G().combatT = 8;
    return true;
  };
  C.plantDynamite = function (a, x, y) {
    const s = a.scene; s.thrown.push({ k: 'dynamite', x, y, h: 0, vh: 0, vx: 0, vy: 0, t: 0, fuse: C.EXPLOSIVES.dynamite.fuse, owner: a, planted: true });
    C.say(a, '¡Mecha encendida! ¡Corran!', '#7a1d1d', 2.4);
  };

  // ---------------- army heavy weapons ----------------
  C.mortar = function (s, x, y, delay) {
    C.later(s, Math.max(0.1, delay - 1.2), () => { s.parts.push({ k: 'ring', x, y, vx: 0, vy: 0, r: 30, life: 1.2, max: 1.2 }); if (C.snd) C.snd.whistle(x, y); });
    C.later(s, delay, () => C.explode(s, x, y, C.EXPLOSIVES.mortar.rad, C.EXPLOSIVES.mortar.dmg, null, { frags: 14, kind: 'mortar' }));
  };
  C.airstrike = function (s, x0, y0, x1, y1, n) {
    const L = Math.hypot(x1 - x0, y1 - y0); const dur = 4.5;
    // plane shadow
    for (let i = 0; i < 24; i++) C.later(s, i * (dur / 24), () => { const k = i / 24; s.parts.push({ k: 'shadow', x: x0 + (x1 - x0) * k, y: y0 + (y1 - y0) * k, vx: 0, vy: 0, r: 22, life: 0.25, max: 0.25 }); });
    if (C.snd) C.snd.plane();
    for (let i = 0; i < n; i++) {
      const k = (i + 0.5) / n, jx = (Math.random() - 0.5) * 30, jy = (Math.random() - 0.5) * 30;
      const bx = x0 + (x1 - x0) * k + jx, by = y0 + (y1 - y0) * k + jy;
      C.later(s, Math.max(0.05, 0.6 + k * dur - 1.1), () => { s.parts.push({ k: 'ring', x: bx, y: by, vx: 0, vy: 0, r: 60, life: 1.1, max: 1.1 }); if (C.snd) C.snd.whistle(bx, by); });
      C.later(s, 0.6 + k * dur, () => C.explode(s, bx, by, C.EXPLOSIVES.bomb.rad * 0.8, C.EXPLOSIVES.bomb.dmg, null, { frags: 12, kind: 'bomb' }));
    }
    // strafing
    for (let i = 0; i < 20; i++) { const k = i / 20; C.later(s, 0.5 + k * dur, () => { const px = x0 + (x1 - x0) * k + (Math.random() - 0.5) * 50, py = y0 + (y1 - y0) * k + (Math.random() - 0.5) * 50; C.fx.dust(s, px, py, 3); C.fx.spark(s, px, py, Math.random() * 6, 2); for (const a of s.actors) { if (a.dead || a.inside) continue; if (Math.hypot(a.x - px, a.y - py) < 9 && Math.random() < 0.5) C.hurt(a, 30 + Math.random() * 14, null, 0.7, 'bullet'); } }); }
  };
})();
