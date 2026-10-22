/* CUBEA — ui.js : HUD, inspector, interaction menus, event cards, map, manifesto, factions, journal, camp, end screen. */
(function () {
  'use strict';
  const C = (window.C = window.C || {});
  const clamp = C.clamp;
  const G = () => C.G;
  // SMALL DOM HELPERS: $ (by id), esc (escape HTML), nl (escape + newlines to <br>), pct, col (rgb array → CSS), bar (a needs bar), needCol (green/yellow/red by level), PLACE (settlement name), STATUS labels.
  const $ = (id) => document.getElementById(id);
  const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const nl = (t) => esc(t).replace(/\n/g, '<br>');
  // The UI namespace C.ui; other modules (cmdui.js, pack.js, orders.js…) add to it.
  const ui = (C.ui = { overUI: false });
  const pct = (v) => Math.round(v) + '%';
  const col = (rgb) => `rgb(${rgb[0] | 0},${rgb[1] | 0},${rgb[2] | 0})`;
  const bar = (v, c) => `<div class="bar"><i style="width:${clamp(v, 0, 100)}%;background:${c}"></i></div>`;
  const needCol = (v) => v > 60 ? '#7fc46a' : v > 30 ? '#e6b84e' : '#dc4a3a';
  const PLACE = (id) => (C.SETTLEMENTS[id] ? C.SETTLEMENTS[id].name : id);
  const STATUS = { alive: '', dead: '† dead', jailed: 'in prison', exile: 'in exile', away: 'away', missing: 'missing' };

  // Remember whether the mouse is over a panel so clicks on panels do not fire the player's gun.
  // overlay mouse tracking so clicks on panels don't fire the gun
  document.addEventListener('mouseover', (e) => { ui.overUI = !!(e.target.closest && e.target.closest('.panel, #modal')); });

  // TOASTS AND THE LOG: short messages at the top and the fading log lines at the bottom; El Viejo's advice appears as a portrait toast.
  // ---------- toast / log ----------
  let toastT = 0;
  // Show a brief toast.
  ui.toast = function (t) { const el = $('toast'); el.textContent = t; el.style.display = 'block'; clearTimeout(toastT); toastT = setTimeout(() => (el.style.display = 'none'), 1700); };
  let logLines = [];
  // Called by C.log: keep the last 6 lines for the on-screen log.
  ui.onLog = function (text, kind) {
    logLines.push({ text, kind: kind || 'info', t: performance.now() }); if (logLines.length > 6) logLines.shift();
    renderLog();
  };
  // Draw the log lines that are less than 14 s old.
  function renderLog() { const el = $('log'); const now = performance.now(); logLines = logLines.filter((l) => now - l.t < 14000); el.innerHTML = logLines.map((l) => `<div class="${l.kind}">${esc(l.text)}</div>`).join(''); el.style.display = logLines.length && $('top').style.display !== 'none' ? 'block' : 'none'; }
  // El Viejo's speech bubble with his portrait.
  ui.viejoToast = function (text) {
    let el = $('viejo'); if (!el) { el = document.createElement('div'); el.id = 'viejo'; el.className = 'panel'; el.style.cssText = 'left:8px;bottom:40px;max-width:330px;padding:10px 12px;z-index:6;display:none;font-size:13px;line-height:1.4'; document.body.appendChild(el); }
    el.innerHTML = `<div style="display:flex;gap:10px"><canvas id="vcv" width="48" height="48" style="flex:none;border-radius:8px;background:rgba(0,0,0,.25)"></canvas><div><b style="color:var(--gold)">El Viejo</b><div>${esc(text)}</div></div></div>`;
    el.style.display = 'block'; const an = C.W.roster.anselmo; try { portrait($('vcv'), an, an.actor, 2.6); } catch (e) { }
    clearTimeout(el._t); el._t = setTimeout(() => (el.style.display = 'none'), Math.min(14000, 4000 + text.length * 55));
  };

  // PORTRAITS: the cube drawn large in the inspector/pack by the same renderer as the map (a stand-in actor for people not in the scene).
  // ---------- portrait ----------
  // Build a stand-in actor (colour, expression) for a person who has no live actor.
  function fakeActor(p) {
    const a = p.actor;
    const fake = { p, face: 1, anim: 0, moving: false, dead: p.status === 'dead', prone: false, drawColor: C.loyaltyColor(p.stance, p.conv), expr: a ? a.expr : { brow: 0, browY: 0, lid: 0, wide: 0, mouth: 0.1, open: 0, squint: 0, sweat: 0, tear: 0 }, blink: 0, weapon: null, weaponOut: false, muzzle: 0, aim: 0, alpha: 1, x: 0, y: 0, deadRot: 0, isPlayer: false, talking: 0, shooting: 0, pain: 0, panic: 0, camo: 0, smirk: false };
    if (!a) { const e = C.expressionTargets(Object.assign(fake, { panic: 0, pain: 0 })); fake.expr = e; }
    if (p.informant && !p.revealed) fake.drawColor = C.loyaltyColor(p.stance, Math.max(20, p.conv - 20)); else fake.drawColor = C.loyaltyColor(p.trueStance, p.conv);
    if (a) { fake.drawColor = a.drawColor; }
    return fake;
  }
  ui.portrait = (cv, p, a, scale) => portrait(cv, p, a, scale);   // shared with pack.js
  // Draw a person's portrait into a canvas at a scale.
  function portrait(cv, p, a, scale) {
    const c = cv.getContext('2d'); c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, cv.width, cv.height);
    c.setTransform(scale, 0, 0, scale, cv.width / 2, cv.height * 0.8);
    const f = fakeActor(p); if (a && a.isPlayer) { f.isPlayer = true; f.drawColor = [196, 52, 46]; }
    f.y = 5; C.drawActor(c, f, performance.now() / 1000, 1);
    c.setTransform(1, 0, 0, 1, 0, 0);
  }

  // HUD: the top bar (clock, resources chips, support meter, heat, speed buttons, panels buttons) and the minimap.
  // ---------- HUD ----------
  // Show the HUD panels and wire the speed and panel buttons.
  ui.start = function () {
    for (const id of ['top', 'left', 'minimap']) $(id).style.display = id === 'top' ? 'flex' : 'block';
    $('log').style.display = 'none';
    document.querySelectorAll('#speed button').forEach((b) => b.onclick = () => { const g = G(); const v = +b.dataset.sp; if (v === 0) g.paused = !g.paused; else { g.paused = false; g.speed = v; } ui.syncSpeed(); });
    $('bMap').onclick = () => ui.openMap(); $('bMan').onclick = ui.openManifesto; $('bFac').onclick = ui.openFactions; $('bJour').onclick = ui.openJournal; $('bBase').onclick = ui.openBase; $('bHelp').onclick = ui.openHelp;
    ui.refresh();
  };
  // Highlight the current speed button.
  ui.syncSpeed = function () { const g = G(); document.querySelectorAll('#speed button').forEach((b) => { const v = +b.dataset.sp; b.classList.toggle('on', v === 0 ? g.paused : !g.paused && g.speed === v); }); };
  // Show the current place's name.
  ui.setWhere = function () { $('where').textContent = G().scene.title || G().scene.name; };
  // Rebuild the left panel and refresh the HUD.
  ui.refresh = function () { buildLeft(); ui.update(true); };
  // Resource chips: key in G.res, icon, tooltip.
  const CHIPS = [['food', '🍚', 'Food'], ['money', '₱', 'Pesos'], ['ammo', '•', 'Cartridges'], ['med', '✚', 'Medicine'], ['fuel', '⛽', 'Fuel (stock)'], ['gren', '💣', 'Grenades'], ['guns', '🔫', 'Spare rifles'], ['shell', '🚀', 'Mortar shells'], ['rocket', '🎯', 'Rockets']];
  // Refresh the HUD each ~0.2 s: clock (or the sea's date), chips (with warnings), support meter, heat bar, army alert, mission text, context hint (what E would do), live squad bars and the inspector.
  ui.update = function (force) {
    const g = G(); if (!g || !g.scene) return;
    const L = g.unlocked.layer;
    const d = C.dateOf(g.day); const hh = Math.floor(g.hour), mm = Math.floor((g.hour - hh) * 60);
    $('clock').textContent = g.sea && g.sea.active ? `${g.sea.label}${g.paused ? '  ❚❚' : ''}` : `${C.dateStr(g.day)} · ${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}${g.paused ? '  ❚❚' : ''}${g.resting ? '  😴' : ''}`;
    $('where').textContent = (g.scene.title || g.scene.name) + (g.weather.rain > 0.25 ? ' · rain' : '') + (g.weather.fog > 0.2 ? ' · mist' : '');
    // chips
    let h = '';
    for (const [k, ic, nm] of CHIPS) {
      if (L < 2 && k !== 'ammo') continue; if (k === 'fuel' && L < 3) continue; if (k === 'gren' && !g.res.gren) continue;
      const v = Math.round(g.res[k]); const warn = (k === 'food' && v < C.partyIds().length * 2) || (k === 'ammo' && v < 15) || (k === 'money' && v < 15);
      h += `<span class="chip ${warn ? 'warn' : ''}" title="${nm}">${ic} <b>${v}</b></span>`;
    }
    if (L >= 3) h += `<span class="chip" title="Rebel rank & file">★ <b>${C.partyIds().length + 1}</b></span>`;
    if (g.res.vales > 0) h += `<span class="chip" title="Unpaid vales (IOUs)">📝 <b>${Math.round(g.res.vales)}</b></span>`;
    $('chips').innerHTML = h;
    const sm = $('supMeter').parentElement; sm.style.display = L >= 3 ? '' : 'none';
    const sup = g.supportMean || 0; $('supMeter').firstElementChild.style.left = (50 + sup / 2) + '%'; $('supNum').textContent = (sup > 0 ? '+' : '') + sup.toFixed(0);
    const heat = g.regime.heat; $('heatBar').style.width = heat + '%'; $('heatBar').style.background = heat > 66 ? '#dc4a3a' : heat > 33 ? '#e6b84e' : '#5b86e0'; $('heatNum').textContent = Math.round(heat); $('heatBar').parentElement.parentElement.style.display = L >= 2 ? '' : 'none';
    $('bMap').style.display = L >= 2 ? '' : 'none'; $('bBase').style.display = L >= 2 ? '' : 'none'; $('bFac').style.display = L >= 4 ? '' : 'none'; $('bMan').style.display = L >= 5 ? '' : 'none';
    $('bMap').textContent = '🗺 ' + C.es('map', true); $('bMan').textContent = '📜 ' + C.es('manifesto', true); $('bFac').textContent = '⚖ ' + C.es('factions', true); $('bJour').textContent = '📓 ' + C.es('journal', true); $('bBase').textContent = '⛺ ' + C.es('camp', true);
    // hint & mission
    let hint = '';
    if (g.mission) hint += `<b style="color:var(--gold)">Objective:</b> ${esc(g.mission.text)}<br>`;
    const it = C.findInteract && C.findInteract(); if (it) hint += `<kbd>E</kbd> ${hintFor(it)}`; else hint += g.player && g.player.weaponOut ? 'Weapon drawn — click to fire' : '<kbd>X</kbd> draw weapon';
    $('hint').innerHTML = hint;
    updateLeftLive(); if (g.selected && !g.selected.gone) updateInspectorLive(); renderLog();
    if (g.sea && g.sea.active) { $('hint').innerHTML = g.sea.phase === 'approach' ? `⛵ WASD steers · <kbd>E</kbd> land (when close to the shore) · running her aground also lands you` : `⛵ WASD walks the deck · <kbd>E</kbd> speaks to a man`; } else if (g.vehicle) { const v = g.vehicle; $('hint').innerHTML += `<br>🚗 ${v.def.n}: fuel ${Math.round(v.fuel)}/${v.def.tank} · speed ${Math.round(Math.abs(v.spd))} · <kbd>E</kbd> exit`; }
  };
  // Text describing what E would do on the nearest interactive thing.
  function hintFor(t) {
    switch (t.kind) {
      case 'actor': return `talk to ${esc(C.tagName(t.o.p))}`; case 'corpse': return `search ${esc(C.tagName(t.o.p))}`; case 'vehicle': return `use ${t.o.def.n}`; case 'item': return `pick up ${esc(t.o.label)}`;
      case 'animal': return 'collect meat'; case 'pad': return 'build here'; case 'building': return `enter ${esc(t.o.label)}`; case 'obj': return `sabotage ${esc(t.o.label)}`; default: return 'use';
    }
  }

  // GROUPS PANEL: each group with its stance buttons, hunger/morale bars, obedience, and the order/stance hint; '+ New group from selection'.
  // ---------- squads panel ----------
  // (see above)
  function buildLeft() {
    const g = G(); const el = $('left'); let h = `<h3>${C.es('squads')}</h3>`;
    for (const sq of g.squads) {
      const ps = sq.members.map((id) => C.P(id)).filter((p) => p && p.status === 'alive');
      h += `<div class="squad ${g.curSquad === sq.id ? 'cur' : ''}" data-sq="${sq.id}"><div class="hd"><span><span class="dot" style="background:${sq.col}"></span><b>${sq.id + 1}. ${C.gName(sq)}</b> <span class="sub">(${ps.length})</span></span><span class="sub" id="sqo${sq.id}"></span></div>`;
      h += `<div class="stances">`;
      for (const k in C.STANCES) h += `<button class="btn sm ${sq.stance === k ? 'on' : ''}" data-st="${k}" data-sq="${sq.id}" title="${esc(C.STANCES[k].d)}">${C.stName(k)}</button>`;
      h += `</div><div class="sub" id="sqs${sq.id}"></div></div>`;
    }
    if (g.unlocked.layer >= 3) h += `<h3 style="margin-top:8px">Policy</h3><div class="sub">When foraging:</div><div class="stances" id="polf">${['pay', 'vale', 'take'].map((k) => `<button class="btn sm ${g.policy.forage === k ? 'on' : ''}" data-pol="${k}" title="${k === 'pay' ? 'Pay pesos: trust and goodwill' : k === 'vale' ? 'Promise to repay in 30 days' : 'Take it: fast, feared, resented'}">${k === 'pay' ? 'Pay' : k === 'vale' ? 'Owe (vale)' : 'Take'}</button>`).join('')}</div>`;
    h += `<button class="btn sm" id="newgrp" style="margin-top:4px">+ New group from selection</button>`;
    h += `<div class="sub" style="margin-top:8px">RMB: move the selection (Shift queues; on an enemy = focus fire). Ctrl-drag boxes a selection; Shift+1–9 saves it as a group; use the command bar below for patrols, ambushes, digging, water and more. <kbd>F</kbd> springs an ambush. Squads may hesitate if hungry, scared or exhausted — look for the speech bubble.</div>`;
    el.innerHTML = h;
    el.querySelectorAll('.squad').forEach((d) => d.onclick = (e) => { if (e.target.closest('button')) return; C.selectGroup(+d.dataset.sq); buildLeft(); });
    el.querySelectorAll('.stances button[data-st]').forEach((b) => b.onclick = (e) => { e.stopPropagation(); if (g.paused) { ui.toast('No orders while paused'); return; } const sq = g.squads[+b.dataset.sq]; sq.stance = b.dataset.st; g.curSquad = sq.id; for (const id of sq.members) { const aa = C.P(id).actor; if (aa) { aa.stanceOv = null; aa.watching = false; } } ui.toast(`${C.gName(sq)}: ${C.stName(sq.stance)}`); buildLeft(); });
    const ng = el.querySelector('#newgrp'); if (ng) ng.onclick = () => { const ids = C.selIds(); if (!ids.length) { ui.toast('Select people first'); return; } const nm = window.prompt('Name this group', 'Group ' + (g.squads.length + 1)); if (nm === null) return; const sq = C.newGroup(nm.trim() || undefined, ids); if (sq) { g.curSquad = sq.id; buildLeft(); } };
    el.querySelectorAll('[data-pol]').forEach((b) => b.onclick = () => { g.policy.forage = b.dataset.pol; buildLeft(); });
  }
  // Live numbers for each group (obedience, hunger, morale, rounds).
  function updateLeftLive() {
    const g = G(); for (const sq of g.squads) {
      const e1 = $('sqo' + sq.id), e2 = $('sqs' + sq.id); if (!e1) continue;
      const acts = sq.members.map((id) => C.P(id)).filter((p) => p && p.status === 'alive');
      if (!acts.length) { e1.textContent = ''; e2.textContent = 'empty'; continue; }
      let ob = 0, food = 0, mor = 0, ammo = 0, n = 0, wounded = 0;
      for (const p of acts) { const a = p.actor; ob += a ? C.obedience(a) : 0.7; food += p.needs.food; mor += p.morale; if (p.hp < p.maxHp * 0.6) wounded++; if (a && a.weapon && a.weapon.spare !== undefined) { ammo += a.weapon.mag + a.weapon.spare; } n++; }
      e1.innerHTML = `obey <b>${Math.round(ob / n * 100)}%</b>`;
      e2.innerHTML = `hunger ${bar(food / n, needCol(food / n))}morale ${bar(mor / n, needCol(mor / n))}<span>${wounded ? wounded + ' wounded · ' : ''}${ammo | 0} rounds</span>`;
    }
  }

  // INSPECTOR: click anyone to see face, body, needs, combat experience, loyalty and WHY (the explainStance list), traits, tells, family tree, friends and bonds, memories.
  // ---------- inspector ----------
  // Hover tooltip (name, role, mood; a rebel's carried food/water and load).
  ui.tipFor = function (a) {
    const p = a.p; const e = a.expr ? a.expr.label : '';
    const role = p.role || (C.OCC[p.occ] ? C.occName(p.occ) : '');
    const carry = (a.side === 'rebel' || a.isPlayer) && p.inv ? `<br><span class="sub">🍚${p.inv.food || 0} 💧${p.inv.water || 0} · load ${C.loadOf(p).toFixed(0)}/${C.capacityOf(p).toFixed(0)} · double-click: pack</span>` : '';
    return `<b>${esc(C.fullName(p))}</b><br><span class="sub">${esc(role)} · ${C.ageOf(p)} · ${esc(ui.emo(e))}</span>${carry}${a.dead ? '<br><span class="sub">† dead</span>' : ''}`;
  };
  // Show/hide the inspector for a person.
  ui.inspect = function (p, a) {
    const el = $('right');
    if (!p) { el.style.display = 'none'; ui.curP = null; return; }
    ui.curP = p; ui.curA = a || p.actor || null; el.style.display = 'block'; ui.buildInspector();
  };
  const EMO_EN = { sereno: 'calm', hambriento: 'hungry', sediento: 'thirsty', agotado: 'exhausted', temeroso: 'afraid', furioso: 'furious', adolorido: 'in pain', confiado: 'confident', esperanzado: 'hopeful', desanimado: 'despondent' };
  // Mood label through the lexicon.
  ui.emo = (l) => C.moodName(l);
  // Build the inspector HTML (static part) for the current person.
  ui.buildInspector = function () {
    const g = G(), p = ui.curP, el = $('right'); if (!p) return; const a = ui.curA; const L = g.unlocked.layer;
    const age = C.ageOf(p); const F = C.FACTIONS[p.fac];
    const role = p.role || (C.OCC[p.occ] ? C.occName(p.occ) : '');
    const hidden = p.informant && !p.revealed;
    let h = `<canvas id="portrait" width="104" height="104"></canvas>`;
    h += `<div class="name">${esc(C.fullName(p))}${p.nick ? ` <span class="sub">“${esc(p.nick)}”</span>` : ''}</div><div class="role">${esc(role)} · ${age} yrs · ${p.sex === 'F' ? 'woman' : 'man'}</div>`;
    h += `<div class="sub">Born in ${esc(PLACE(p.birth))} · lives in ${esc(PLACE(p.settlement))}<br>${esc(C.fName(p.fac))}${p.eth !== 'blanca' && L >= 4 ? ' · ' + esc(p.eth) : ''}${p.status !== 'alive' ? ` · <b>${STATUS[p.status] || p.status}</b>` : ''}</div>`;
    h += `<div style="clear:both"></div>`;
    h += `<div class="row"><span>Mood</span><b id="iMood"></b></div>`;
    h += `<div class="row"><span>Body</span><span id="iBody"></span></div>${bar(p.hp / p.maxHp * 100, needCol(p.hp / p.maxHp * 100))}`;
    h += `<div id="iNeeds"></div>`;
    h += `<div class="row"><span>Combat experience</span><b id="iExp"></b></div>${bar(p.exp, '#c9a0ff')}`;
    if (L >= 3) {
      h += `<h3 style="margin-top:8px">Loyalty</h3><div id="iLoy"></div>`;
      h += `<div class="why" id="iWhy"></div>`;
    }
    h += `<div class="chips">${p.traits.map((t) => `<span class="chip" title="${esc(C.TRAITS[t].d)}">${esc(C.TRAITS[t].n)}</span>`).join('')}</div>`;
    h += `<div class="sub" id="iBlend"></div>`;
    if (p.note) h += `<div class="sub" style="margin-top:4px"><i>${esc(p.note)}</i></div>`;
    if (L >= 3 && p.status === 'alive' && !(a && a.isPlayer)) { const tl = C.tells(p); if (tl.length) h += `<div class="sub" style="margin-top:4px;color:#ffd37a">What you have noticed: ${tl.map(esc).join(' · ')}</div>`; }
    h += `<h3 style="margin-top:8px">Family</h3>` + familyHTML(p);
    h += `<h3 style="margin-top:8px">Friends & ties</h3>` + tiesHTML(p);
    h += `<h3 style="margin-top:8px">What they remember</h3>` + memHTML(p);
    h += `<div style="margin-top:8px;display:flex;gap:6px;flex-wrap:wrap">${a && !a.dead && !a.isPlayer && a.scene === g.scene ? `<button class="btn sm" id="iTalk">Talk (E)</button>` : ''}${a && !a.dead && (a.side === 'rebel' || a.isPlayer) && a.scene === g.scene ? `<button class="btn sm" id="iPack">Pack (T)</button>` : ''}<button class="btn sm" id="iClose">Close</button></div>`;
    el.innerHTML = h;
    try { portrait($('portrait'), p, a, 4.6); } catch (e) { }
    el.querySelectorAll('[data-pid]').forEach((n) => n.onclick = () => { const q = C.P(+n.dataset.pid); ui.inspect(q, q.actor && q.actor.scene === g.scene ? q.actor : null); });
    $('iClose').onclick = () => { C.select(null); }; const tk = $('iTalk'); if (tk) tk.onclick = () => ui.interact({ kind: 'actor', o: a }); const pk = $('iPack'); if (pk) pk.onclick = () => C.openPack(p);
    updateInspectorLive();
  };
  // Update the live parts of the inspector (mood, body, needs, loyalty and its explanation).
  function updateInspectorLive() {
    const g = G(), p = ui.curP; if (!p || !$('iMood')) return; const a = ui.curA || p.actor;
    const e = a ? a.expr : C.expressionTargets(fakeActor(p)); $('iMood').textContent = ui.emo(e.label);
    const cr = p.cracks.length, ch = p.chunks.length;
    $('iBody').innerHTML = `${Math.round(p.hp)}/${Math.round(p.maxHp)}${cr ? ` · <span title="Cracks heal with food and rest">${cr} crack${cr > 1 ? 's' : ''}</span>` : ''}${ch ? ` · <span title="Missing chunks never heal">${ch} chunk${ch > 1 ? 's' : ''} lost</span>` : ''}${p.bleed > 0.1 ? ' · <b style="color:#ff8f80">bleeding</b>' : ''}`;
    const n = p.needs; const rows = [['Food', n.food], ['Water', n.water], ['Energy', n.energy], ['Safety', n.safety], ['Dignity', n.dignity], ['Hope', n.hope]];
    $('iNeeds').innerHTML = rows.map(([k, v]) => `<div class="need"><span>${k}</span>${bar(v, needCol(v))}<span>${Math.round(v)}</span></div>`).join('') + `<div class="need"><span>Fear</span>${bar(p.fear, '#b06ae0')}<span>${Math.round(p.fear)}</span></div><div class="need"><span>Stress</span>${bar(p.stress, '#e08a3a')}<span>${Math.round(p.stress)}</span></div><div class="need"><span>Morale</span>${bar(p.morale, needCol(p.morale))}<span>${Math.round(p.morale)}</span></div>`;
    $('iExp').textContent = p.exp.toFixed(0) + ' · ' + (p.exp > 60 ? 'veteran' : p.exp > 30 ? 'seasoned' : p.exp > 10 ? 'blooded' : 'green') + (p.service ? ` · ${p.service}d service` : '');
    const loy = $('iLoy'); if (loy) {
      const hidden = p.informant && !p.revealed; const v = hidden ? p.stance : p.trueStance; const lab = Math.abs(v) < 12 ? 'Undecided' : v > 0 ? 'Rebel' : 'Batista';
      loy.innerHTML = `<div class="meter dual" style="width:100%"><i style="left:${50 + v / 2}%"></i></div><div class="row"><span>${lab}${hidden ? ' <b title="Informers hide their colours until unmasked">(as far as you can tell)</b>' : ''}</span><b>${v > 0 ? '+' : ''}${Math.round(v)}</b></div><div class="row"><span>How firmly held</span><b>${Math.round(p.conv)}${p.conv > 66 ? ' · deep' : p.conv < 25 ? ' · shallow' : ''}</b></div>`;
      const why = $('iWhy'); if (why && !hidden && p.status !== 'dead') { const ex = C.explainStance(p).slice(0, 6); why.innerHTML = ex.map((x) => `<div><span>${esc(x.label)}</span><b class="${x.v > 0 ? 'pos' : 'neg'}">${x.v > 0 ? '+' : ''}${x.v.toFixed(1)}</b></div>`).join(''); }
    }
    const bgk = (C.OCC[p.occ] || {}).bg || 'campesino'; const bg = C.BG[bgk]; const bl = $('iBlend'); if (bl) bl.innerHTML = `Blends in: jungle ${Math.round(bg[0] * 100)}% · countryside ${Math.round(bg[1] * 100)}% · town ${Math.round(bg[2] * 100)}% · city ${Math.round(bg[3] * 100)}%${p.sex === 'F' ? ' · <span title="Women draw less suspicion at checkpoints">less suspected in towns</span>' : ''}`;
  }
  // A clickable person reference (with status).
  function personLink(q) { const st = STATUS[q.status] || ''; return `<span class="link" data-pid="${q.id}">${esc(C.tagName(q))}</span> <span class="sub">${C.ageOf(q)}${q.status !== 'alive' ? ' · ' + st : ''}${q.settlement !== q.home && q.status === 'alive' ? ' · ' + esc(PLACE(q.settlement)) : ''}</span>`; }
  // The person's relatives (spouse, parents, children, siblings…) and which are dead, jailed or exiled.
  function familyHTML(p) {
    const P = C.P; const rows = [];
    const add = (lab, id) => { if (id >= 0) rows.push(`<div class="row"><span>${lab}</span><span>${personLink(P(id))}</span></div>`); };
    add('Spouse', p.spouse); add('Father', p.father); add('Mother', p.mother);
    for (const k of p.kids.slice(0, 7)) add(P(k).sex === 'F' ? 'Daughter' : 'Son', k);
    if (p.kids.length > 7) rows.push(`<div class="sub">…and ${p.kids.length - 7} more children</div>`);
    const sibs = new Set(); [p.mother, p.father].forEach((x) => { if (x >= 0) P(x).kids.forEach((k) => { if (k !== p.id) sibs.add(k); }); });
    [...sibs].slice(0, 6).forEach((k) => add(P(k).sex === 'F' ? 'Sister' : 'Brother', k)); if (sibs.size > 6) rows.push(`<div class="sub">…and ${sibs.size - 6} more siblings</div>`);
    const kin = C.kinOf(p); const rest = [...kin.entries()].filter(([, v]) => ['grandparent', 'grandchild', 'aunt', 'niece', 'cousin', 'inlaw'].includes(v.t)); if (rest.length) { const cnt = {}; rest.forEach(([, v]) => (cnt[v.t] = (cnt[v.t] || 0) + 1)); rows.push(`<div class="sub">Also: ${Object.keys(cnt).map((k) => cnt[k] + ' ' + (C.relLabelEs[k] || k)).join(', ')}</div>`); }
    const bad = [...kin.keys()].filter((id) => ['dead', 'jailed', 'exile'].includes(P(id).status)); if (bad.length) rows.push(`<div class="sub">${bad.slice(0, 4).map((id) => `${esc(C.tagName(P(id)))} (${STATUS[P(id).status]})`).join(' · ')}${bad.length > 4 ? ' …' : ''}</div>`);
    return rows.join('') || '<div class="sub">—</div>';
  }
  // Bonds (friendships earned in play, strongest first) then other ties.
  function tiesHTML(p) {
    // bonds first (friendships earned in play, strongest first), then the older ties
    const bl = C.bondsOf(p, 4).map((x) => `<div class="row"><span>${C.bondLabel(x.b)} <span class="sub">${Math.round(x.b)}</span></span><span>${personLink(x.q)}</span></div>`);
    const rows = bl.concat(p.rel.filter((r) => r.t !== 'neighbor' && r.t !== 'bond').slice(0, 9 - bl.length).map((r) => `<div class="row"><span>${C.relLabelEs[r.t] || r.t}</span><span>${personLink(C.P(r.id))}</span></div>`));
    return rows.join('') || '<div class="sub">—</div>';
  }
  // The five most recent memories with their direction (→ rebel / → Batista).
  function memHTML(p) {
    const ms = p.mem.slice().sort((a, b) => b.day - a.day).slice(0, 5);
    if (!ms.length) return '<div class="sub">Nothing in particular.</div>';
    return ms.map((m) => `<div class="row"><span style="max-width:215px">${esc(m.text)}${m.kin && m.kin !== 'self' && m.kin !== 'town' ? ` <span class="sub">(${esc(C.relLabelEs[m.kin] || m.kin)})</span>` : ''}</span><b class="${m.val > 0 ? 'pos' : 'neg'}">${m.val > 0 ? '→ rebel' : '→ Batista'}</b></div>`).join('');
  }

  // MODALS AND CARDS: one modal at a time (time stops while it is open); cards queue.
  // ---------- modal infrastructure ----------
  // Close the open modal; show the next queued card.
  ui.closeModal = function () { const g = G(); $('modal').style.display = 'none'; if (g) { g.modalOpen = false; g.pendingCard = null; } if (cardQueue.length) { const c = cardQueue.shift(); setTimeout(() => ui.card(c), 120); } };
  // Open a modal with HTML.
  function openModal(html, wide) { const g = G(); g.modalOpen = true; $('mbox').innerHTML = html; $('mbox').style.maxWidth = wide ? 'min(1060px,96vw)' : 'min(860px,94vw)'; $('modal').style.display = 'flex'; const x = $('mbox').querySelector('.close'); if (x) x.onclick = ui.closeModal; C.snd && C.snd.click(); }
  $('modal').addEventListener('mousedown', (e) => { if (e.target.id === 'modal' && !G().pendingCard) ui.closeModal(); });
  // Cards waiting for the current modal to close.
  const cardQueue = [];
  // Show a decision card: title, icon, body and choices (each with a label, a subtitle, an optional disabled flag, and fn). Time stops until a choice is made.
  ui.card = function (c) {
    const g = G(); if (g.modalOpen) { cardQueue.push(c); return; }
    g.pendingCard = c; g.paused = g.paused;
    let h = `<h2>${c.icon ? c.icon + ' ' : ''}${esc(c.title)}</h2><div class="lede">${nl(c.body || '')}</div><div class="choices">`;
    c.choices.forEach((ch, i) => { h += `<button class="choice" data-i="${i}" ${ch.disabled ? 'disabled' : ''}>${esc(ch.label)}${ch.sub ? `<small>${esc(ch.sub)}</small>` : ''}</button>`; });
    h += `</div>`;
    openModal(h); C.snd && C.snd.chime();
    $('mbox').querySelectorAll('.choice').forEach((b) => b.onclick = () => { const ch = c.choices[+b.dataset.i]; if (ch.disabled) return; g.pendingCard = null; $('modal').style.display = 'none'; g.modalOpen = false; try { ch.fn && ch.fn(); } catch (e) { console.error(e); } ui.refresh(); if (cardQueue.length && !g.modalOpen) { const n = cardQueue.shift(); setTimeout(() => ui.card(n), 100); } });
  };
  // generic menu (stays open when fn returns true)
  // A generic menu that stays open while an option returns true (used for talk menus, build menus, polls).
  ui.menu = function (title, lede, opts, head) {
    const g = G();
    let h = `<button class="btn sm close">✕</button>${head || ''}<h2>${esc(title)}</h2><div class="lede">${lede || ''}</div><div class="choices">`;
    opts.forEach((o, i) => { h += `<button class="choice" data-i="${i}" ${o.disabled ? 'disabled' : ''}>${esc(o.label)}${o.sub ? `<small>${esc(o.sub)}</small>` : ''}</button>`; });
    h += `</div>`;
    openModal(h);
    $('mbox').querySelectorAll('.choice').forEach((b) => b.onclick = () => { const o = opts[+b.dataset.i]; if (o.disabled) return; let keep = false; try { keep = o.fn && o.fn(); } catch (e) { console.error(e); } ui.update(true); if (keep && typeof keep === 'function') keep(); else if (keep === true) { ui.menu(title, lede, opts.map((x) => x), head); } else ui.closeModal(); });
  };

  // E on a thing opens the right menu: talk, search a corpse, drive a vehicle, pick up an item, collect game, sabotage an object, build on a plot, enter a building.
  // ---------- interaction menus ----------
  // (see above)
  ui.interact = function (t) {
    const g = G(); const o = t.o;
    switch (t.kind) {
      case 'actor': return talkMenu(o);
      case 'corpse': return corpseMenu(o);
      case 'vehicle': return vehicleMenu(o);
      case 'item': return pickUp(o);
      case 'animal': return takeMeat(o);
      case 'pad': return padMenu(o);
      case 'building': return buildingMenu(o);
      case 'obj': return objMenu(o);
    }
  };
  // Add a ground item's value to the stores (used by carry orders).
  ui.take = function (it) {
    const g = G();
    if (it.k === 'food') g.res.food += it.amount || 5; else if (it.k === 'ammo') g.res.ammo += it.amount || 10; else if (it.k === 'med') g.res.med += it.amount || 1; else if (it.k === 'fuel') g.res.fuel += it.amount || 5; else if (it.k === 'money') g.res.money += it.amount || 20;
    else if (['gren', 'molo', 'shell', 'rocket'].includes(it.k)) g.res[it.k] = (g.res[it.k] || 0) + (it.amount || 1);
    else if (it.k === 'gun') { g.res.ammo += Math.max(5, (it.mag || 0) + (it.spare || 0)); if (C.HEAVY.includes(it.wk)) { g.heavy = g.heavy || {}; g.heavy[it.wk] = (g.heavy[it.wk] || 0) + 1; } else if (it.wk !== 'machete') g.res.guns++; }
  };
  // Pick up a ground item and remove it from the scene.
  function pickUp(it) {
    const g = G(), s = g.scene; const i = s.items.indexOf(it); if (i < 0) return;
    if (it.k === 'food') { g.res.food += it.amount || 5; ui.toast(`+${it.amount || 5} food`); }
    else if (it.k === 'ammo') { g.res.ammo += it.amount || 10; ui.toast(`+${it.amount || 10} cartridges`); }
    else if (it.k === 'med') { g.res.med += it.amount || 1; ui.toast('+ medicine'); }
    else if (it.k === 'fuel') { g.res.fuel += it.amount || 5; }
    else if (it.k === 'money') { g.res.money += it.amount || 20; }
    else if (['gren', 'molo', 'shell', 'rocket'].includes(it.k)) { g.res[it.k] = (g.res[it.k] || 0) + (it.amount || 1); ui.toast(`+${it.amount || 1} ${C.ITEMS[it.k].n}`); }
    else if (it.k === 'water') { C.invAdd(g.player.p, 'water', it.amount || 1); ui.toast('+ water'); }
    else if (it.k === 'gun') { const pl = g.player; if (!pl.weapon || C.WEAPONS[it.wk].dmg > C.WEAPONS[pl.weapon.k].dmg * 0.9 && false) { C.giveWeapon(pl, it.wk, it.spare); pl.weapon.mag = it.mag; } else { g.res.ammo += Math.max(5, (it.mag || 0) + (it.spare || 0)); if (C.HEAVY.includes(it.wk)) { g.heavy = g.heavy || {}; g.heavy[it.wk] = (g.heavy[it.wk] || 0) + 1; } else if (it.wk !== 'machete') g.res.guns++; ui.toast('Spare ' + C.WEAPONS[it.wk].n + ' to the armory — hand it out from the talk menu'); } }
    s.items.splice(i, 1);
  }
  // Collect the meat of a dead animal.
  function takeMeat(an) { const g = G(), s = g.scene; const i = s.animals.indexOf(an); if (i < 0) return; g.res.food += an.def.food; s.animals.splice(i, 1); ui.toast(`+${an.def.food} food (${an.def.n})`); if (an.def.wild === false) { C.log('You took the meat of a dead ' + an.def.n + '.', 'info'); } }
  // A corpse: search it (supplies, weapon), bury it with respect (its family hears someone cared), or leave it.
  function corpseMenu(a) {
    const g = G(), p = a.p; const opts = [];
    const hasLoot = !a.looted;
    opts.push({ label: 'Search the body', sub: a.looted ? 'Already searched' : 'Cartridges, papers, small change', disabled: !hasLoot, fn: () => { a.looted = true; const am = Math.floor(Math.random() * 8) + (p.mil ? 6 : 0); g.res.ammo += am; const m = Math.floor(Math.random() * 12); g.res.money += m; ui.toast(`+${am} cartridges, +${m} pesos`); if (p.mil && p.mil.side === 'army') { g.rep.competence = clamp(g.rep.competence + 0.2, 0, 100); } return true; } });
    opts.push({ label: 'Bury them with respect', sub: p.mil && p.mil.side === 'rebel' ? 'Your people feel it' : 'Their family will hear that someone cared', fn: () => { const i = g.scene.corpses.indexOf(a); if (i >= 0) g.scene.corpses.splice(i, 1); if (p.mil && p.mil.side === 'rebel') for (const q of C.squadPeople()) q.morale = clamp(q.morale + 2, 0, 100); else { C.addEvent({ type: 'burial', victim: p, perpSide: 'rebel', positive: true, sev: 26, pub: 0.1, x: a.x, y: a.y, scene: g.scene, settlement: g.scene.sid, text: `The rebels buried ${C.tagName(p)} with respect`, memText: `The rebels buried ${C.tagName(p)} with respect` }); g.rep.justice = clamp(g.rep.justice + 0.8, 0, 100); } ui.toast('Buried.'); } });
    ui.menu(C.fullName(p), `${C.ageOf(p)} years, ${esc(p.role || (C.OCC[p.occ] ? C.occName(p.occ) : ''))}. ${p.diedBy ? 'Died: ' + esc(p.diedBy) + '.' : ''}`, opts, '');
  }
  // A vehicle: get in and drive (seats, fuel, tyres), siphon fuel, repair a tyre, or leave it.
  function vehicleMenu(v) {
    const g = G(), s = g.scene; const def = v.def;
    const opts = [];
    opts.push({ label: 'Get in and drive', sub: `${def.cap} seats · fuel ${Math.round(v.fuel)}/${def.tank} · ${v.tires.filter((q) => q < 0.2).length} flat tire(s)`, disabled: v.wreck, fn: () => { C.enterVehicle(g.player, v); g.vehicle = v; C.boardParty(v); v.driving = false; } });
    if (def.tank) opts.push({ label: 'Refuel from your stock', sub: `Fuel in stock: ${Math.round(g.res.fuel)}`, disabled: g.res.fuel < 1 || v.fuel >= def.tank - 1, fn: () => { const add = Math.min(g.res.fuel, def.tank - v.fuel); g.res.fuel -= add; v.fuel += add; ui.toast(`+${Math.round(add)} fuel`); return true; } });
    if (def.tank) opts.push({ label: 'Siphon fuel from the tank', sub: 'Quick theft: the owner will not forgive it', disabled: v.fuel < 3 || v.army === true && false, fn: () => { const take = Math.min(v.fuel, 15); v.fuel -= take; g.res.fuel += take; if (v.owner) C.addEvent({ type: 'theft', victim: C.P(v.owner), perpSide: 'rebel', val: -1, sev: 22, pub: 0.1, x: v.x, y: v.y, scene: s, settlement: s.sid, text: 'Rebels siphoned fuel', memText: 'Rebels stole fuel' }); else if (!v.army) { g.rep.justice = clamp(g.rep.justice - 0.4, 0, 100); } C.alertScene(s, v.x, v.y, 'shot'); ui.toast(`+${Math.round(take)} fuel`); return true; } });
    const flat = v.tires.findIndex((q) => q < 0.2);
    if (def.wheels) opts.push({ label: 'Fix a flat tire', sub: flat >= 0 ? 'Costs 1 scrap and some minutes' : 'No flat tires', disabled: flat < 0 || g.res.scrap < 1, fn: () => { g.res.scrap -= 1; v.tires[flat] = 1; C.advanceDays(0.02); ui.toast('Tire fixed'); return true; } });
    if (v.hp < def.hp * 0.8 && !v.wreck) opts.push({ label: 'Patch the body (2 scrap)', disabled: g.res.scrap < 2, fn: () => { g.res.scrap -= 2; v.hp = Math.min(def.hp, v.hp + def.hp * 0.3); v.engine = Math.min(1, v.engine + 0.3); return true; } });
    if (v.wreck) opts.push({ label: 'Strip the wreck for scrap', fn: () => { g.res.scrap += 3; v.gone = true; ui.toast('+3 scrap'); } });
    if (!v.wreck && v.army) opts.push({ label: 'Set the vehicle on fire', sub: 'Denies it to the army', fn: () => { v.burning = 8; C.alertScene(s, v.x, v.y, 'shot'); C.log('You torched a military vehicle.', 'info'); } });
    ui.menu(def.n, `${v.army ? 'Army vehicle. ' : ''}${v.wreck ? 'Wrecked.' : 'Parked.'}`, opts);
  }
  // A sabotage object: plant dynamite, set it on fire with a molotov, or leave it.
  function objMenu(o) {
    const g = G(), s = g.scene; const pl = g.player;
    ui.menu(o.label, 'A target the army depends on.', [
      { label: 'Plant dynamite (1 charge)', sub: 'A 6-second fuse — get clear!', disabled: !g.res.dyn, fn: () => { g.res.dyn--; C.plantDynamite(pl, o.x + 6, o.y + 6); } },
      { label: 'Set it on fire (needs a molotov)', disabled: !g.res.molo, fn: () => { g.res.molo--; C.throwExplosive(pl, o.x, o.y, 'molotov'); } },
    ]);
  }
  // A camp plot: cost (after labour discounts), what the building does, and Build.
  function padMenu(b) {
    const g = G(); const k = b.slot; const d = C.BLD[k]; const cost = C.padCost(b); cost[1] = cost[1] * 4;
    ui.menu(`Build: ${d.n}`, `Cost: ${cost[0]} pesos + ${Math.ceil(cost[1] * 0.25)} scrap${b.labor ? ` (labour has cut it ${Math.round(Math.min(.5, b.labor * .15) * 100)}%)` : ''} (you have ${Math.round(g.res.money)} pesos, ${g.res.scrap} scrap).<br>${padEffect(k)}`, [{ label: b.built ? 'Already built' : 'Build it', disabled: b.built, fn: () => { C.buildAtPad(b); } }]);
  }
  // One-line description of what each camp building gives.
  function padEffect(k) { return { cocina: 'Rations stretch further: meals cost less.', enfermeria: 'Wounded recover faster; bleeding is treated.', taller: 'Craft cartridges, grenades, dynamite.', radiocamp: 'Radio Rebelde: broadcast to the whole island (history: Feb 1958).', escuelacamp: 'Teach recruits to read: hope and dignity rise daily.', imprenta: 'Print pamphlets for students and strikers.', polvorin: 'A hidden ammo store.', tienda_c: 'A tent for the command.' }[k] || ''; }
  // A building: shops (buy food), clinics (ask for medicine), churches, barracks, camp buildings (craft); entering one lets you talk to people inside.
  function buildingMenu(b) {
    const g = G(), s = g.scene; const inside = s.actors.filter((a) => a.inside && a.bld === b.id && !a.dead);
    const opts = [];
    if (b.tag === 'fuel') opts.push({ label: 'Buy fuel (10 units: 8 pesos)', disabled: g.res.money < 8, fn: () => { g.res.money -= 8; g.res.fuel += 10; return true; } });
    if (b.tag === 'shop') { const price = C.price(s.sid); opts.push({ label: `Buy food (20 units for ${Math.ceil(price * 20)} pesos)`, disabled: g.res.money < price * 20, fn: () => { g.res.money -= price * 20; g.res.food += 20; g.stats.pesos += price * 20; return true; } }); opts.push({ label: 'Buy medicine (3 for 18 pesos)', disabled: g.res.money < 18, fn: () => { g.res.money -= 18; g.res.med += 3; return true; } }); opts.push({ label: 'Buy cartridges (10 for 14 pesos, discreetly)', disabled: g.res.money < 14, fn: () => { g.res.money -= 14; g.res.ammo += 10; g.regime.heat += 0.5; return true; } }); opts.push({ label: 'Buy cloth & scrap (6 pesos)', disabled: g.res.money < 6, fn: () => { g.res.money -= 6; g.res.cloth += 2; g.res.scrap += 2; return true; } }); }
    if (b.tag === 'union') opts.push({ label: 'Meet the strike committee', sub: 'Adds strike readiness (needs 10 pesos for the fund)', disabled: g.res.money < 10, fn: () => { g.res.money -= 10; g.strikePrep += 4; for (const p of C.W.people) if (p.fac === 'workers' && p.settlement === s.sid && p.status === 'alive') p.trueStance += 0.6; C.deed(3, 2); ui.toast('The committee meets in secret.'); } });
    if (b.tag === 'univ') opts.push({ label: 'Distribute pamphlets to students', sub: `Uses 5 pamphlets (have ${g.res.pamph})`, disabled: g.res.pamph < 5, fn: () => { g.res.pamph -= 5; g.strikePrep += 2; for (const p of C.W.people) if (p.fac === 'students' && p.settlement === s.sid && p.status === 'alive') { p.trueStance += 0.8; p.needs.hope = clamp(p.needs.hope + 1.5, 0, 100); } g.regime.heat += 1; if (g.player.covertNow && Math.random() < 0.15) { g.player.susp += 35; ui.toast('A plainclothes officer is watching you.'); } else ui.toast('Pamphlets are passed hand to hand.'); C.deed(4, 2); } });
    if (b.tag === 'church') opts.push({ label: 'Light a candle and talk to the sacristan', sub: 'Quiet counsel; the Church notes your respect', fn: () => { g.trust.church = clamp(g.trust.church + 0.01, 0, 1); C.deed(2, 1); ui.toast('You light a candle.'); } });
    if (b.tag === 'clinic') opts.push({ label: 'Ask the doctor for medicine (charity)', sub: 'Possible if the doctor sympathizes', fn: () => { const doc = inside.find((a) => a.p.occ === 'medico' || a.p.occ === 'partera'); const ok = doc ? doc.p.trueStance > -10 && Math.random() < 0.7 : false; if (ok) { g.res.med += 2; ui.toast('+2 medicine'); } else ui.toast('The doctor refuses, afraid.'); } });
    if (b.tag === 'bank' || /Larrea/.test(b.label)) opts.push({ label: 'Visit the merchant houses of the district', sub: 'Meet donors who can fund the Havana pipeline', fn: () => { const donors = C.W.people.filter((p) => p.settlement === s.sid && p.status === 'alive' && (p.donor || (p.cls >= 3 && (p.fac === 'elite' || p.fac === 'middle')))).sort((a, c) => (c.donor || 0) - (a.donor || 0)).slice(0, 7); ui.menu('Donors of ' + s.name, 'Who do you approach?', donors.map((p) => ({ label: `${C.fullName(p)} — ${(C.OCC[p.occ] ? C.occName(p.occ) : '')}`, sub: p.note ? p.note.slice(0, 90) : '', fn: () => { pitchMenu(p); } }))); } });
    if (inside.length) opts.push({ label: `Speak to someone inside (${inside.length})`, sub: 'The people in the building are out of sight', fn: () => { ui.menu('Inside ' + b.label, '', inside.slice(0, 9).map((a) => ({ label: `${C.fullName(a.p)} — ${(C.OCC[a.p.occ] ? C.occName(a.p.occ) : '')}`, sub: a.p.role || '', fn: () => { talkMenu(a); } }))); } });
    if (!opts.length) opts.push({ label: 'Nothing to do here', disabled: true });
    ui.menu(b.label, b.tag === 'army' ? 'An army building. Keep away unless you mean business.' : '', opts);
  }

  // TALKING: a menu of options that depend on who they are and what they can offer (see below).
  // ---------- talking to people ----------
  // One or two lines of local talk built from the world's state (soldiers about, hunger, rumours, their last memory, their faction's view).
  function gossipFor(p) {
    const g = G(), s = g.scene; const out = [];
    const army = s.actors.filter((a) => a.side === 'army' && !a.dead); if (army.length && p.trueStance > -20) out.push(`"There are ${army.length} soldiers around here, ${army.filter((a) => a.brain.mode === 'engage').length ? 'and they are already hunting someone' : 'mostly bored'}."`);
    if (p.occ === 'bodeguero') out.push('"I sell rice at the same price to everyone. They all come with the same hungry face."');
    if (p.traits.includes('gossip')) out.push(`"They say ${C.tagName(C.P(C.W.bySet[p.settlement][Math.floor(Math.random() * C.W.bySet[p.settlement].length)]))} has been seen at night with a man from Santiago."`);
    const last = p.mem.slice().sort((a, b) => b.day - a.day)[0]; if (last) out.push(`"${last.text}. I have not forgotten."`);
    if (p.fac === 'landowners') out.push('"Order. That is all anyone really wants."'); if (p.fac === 'students') out.push('"The only real question is who dares first."'); if (p.fac === 'church') out.push('"God judges the means as well as the ends."');
    if (p.needs.food < 30) out.push('"We ate beans yesterday. Today we hope."');
    if (!out.length) out.push('"Times are hard. What else can I say?"');
    return out;
  }
  // Build the talk menu: for surrendered soldiers (treat, amnesty, exchange, hold, recruit, interrogate, execute), wounded enemies (treat), rebels (move group, share food, treat wounds, give a rifle or heavy weapon from the armory), civilians (buy/take/ask food, give food, treat, invite to join, forage by gunpoint, pitch for a donation, organise students/unions, hand pipeline funds, seize an estate (land menu), racket options, have your network check, hold a trial).
  function talkMenu(a) {
    const g = G(), s = g.scene, p = a.p, pl = g.player; if (a.dead) return corpseMenu(a);
    const hidden = p.informant && !p.revealed;
    const rebel = a.side === 'rebel' && a.squad >= 0; const army = a.side === 'army'; const civ = a.side === 'civ';
    a.talking = 3; a.pendingTalk = true;
    const opts = [];
    const price = C.price(p.settlement, p);
    const tag = C.tagName(p);
    const head = `<canvas id="mport" width="84" height="84" style="float:right;border-radius:8px;background:rgba(0,0,0,.25);margin-left:10px"></canvas>`;
    const lede = `${esc(p.role || (C.OCC[p.occ] ? C.occName(p.occ) : ''))}, ${C.ageOf(p)}. Feeling <b>${a.expr ? ui.emo(a.expr.label) : '…'}</b>.${hidden ? '' : ` ${p.trueStance > 20 ? 'Leans rebel.' : p.trueStance < -20 ? 'Leans Batista.' : 'Undecided.'}`}<br><span class="sub">${esc(gossipFor(p)[0])}</span>`;
    // ---- surrendered / wounded soldiers
    if (army && !a.surrendered && a.p.hp < a.p.maxHp * 0.5) opts.push({ label: 'Treat his wounds (1 medicine)', sub: 'He is down. An enemy treated is an enemy who may stop fighting.', disabled: g.res.med < 1, fn: () => { C.treatEnemy(a); } });
    if (army && a.surrendered) {
      // the army's surrendered man: every option is a statement about who you are (see policy.js, the mercy index)
      opts.push({ label: 'Treat his wounds and release him (1 medicine)', sub: 'Mercy. The army hears of it; more will surrender.', disabled: g.res.med < 1 || (p.hp >= p.maxHp - 3 && !p.bleed), fn: () => { C.handlePrisoner(a, 'treat'); } });
      opts.push({ label: 'Release him under amnesty', sub: 'Disarmed, with a safe-conduct. Some will come back and join you.', fn: () => { C.handlePrisoner(a, 'amnesty'); } });
      opts.push({ label: 'Exchange him for a captured rebel', sub: 'Through the Red Cross — if the army holds any of yours.', fn: () => { C.handlePrisoner(a, 'exchange'); } });
      opts.push({ label: 'Hold him in the camp', sub: 'He eats your food and may escape. A verdict will be needed.', fn: () => { C.handlePrisoner(a, 'detain'); } });
      opts.push({ label: 'Recruit him (defect to the rebels)', sub: p.trueStance > -30 ? 'He may agree' : 'Unlikely', fn: () => { if (Math.random() < clamp(0.25 + (p.trueStance + 40) / 120 + (g.rep.justice - 50) / 200, 0.05, 0.85)) { p.trueStance = 40; C.recruit(p, p.exp); ui.toast('He joins you.'); a.gone = true; a.inside = true; const i = s.actors.indexOf(a); if (i >= 0) s.actors.splice(i, 1); } else ui.toast('"No, jefe. My family is in Bayamo."'); } });
      opts.push({ label: 'Interrogate (get the army’s positions)', fn: () => { ui.toast('He talks: positions marked.'); s.spotted = s.spotted || []; for (const q of s.actors) if (q.side === 'army' && !q.dead) s.spotted.push({ x: q.x, y: q.y, t: 20 }); g.rep.fear += 1; } });
      opts.push({ label: 'Execute', sub: 'An unarmed man. His family will never forgive it, and the army will fight on.', fn: () => { C.handlePrisoner(a, 'execute'); } });
    }
    // ---- own soldiers
    else if (rebel) {
      // heavy weapons from the armory: one menu entry per kind in stock
      for (const hk of C.HEAVY) { const have = (g.heavy && g.heavy[hk]) || 0; if (have > 0 && p.wpn !== hk) opts.push({ label: `Give the ${C.WEAPONS[hk].n} (${have} in the armory)`, sub: `Weight ${C.WEAPONS[hk].wt}. Others who carry less may resent it.`, fn: () => { C.armSoldier(p, hk); ui.toast(C.tagName(p) + ' takes the ' + C.WEAPONS[hk].n); return true; } }); }
      if (!p.wpn || p.wpn === 'machete') opts.push({ label: 'Give a rifle from the armory', sub: g.res.guns > 0 ? `${g.res.guns} spare — others who are unarmed may resent it` : 'No spare rifles', disabled: g.res.guns <= 0, fn: () => { C.armSoldier(p); ui.toast(C.tagName(p) + ' is armed.'); return true; } });
      for (const sq of g.squads) if (sq.id !== a.squad) opts.push({ label: `Move to ${C.gName(sq)}`, fn: () => { g.squads[a.squad].members = g.squads[a.squad].members.filter((i) => i !== p.id); sq.members.push(p.id); p.mil.squad = sq.id; a.squad = sq.id; C.attachSquads(s); buildLeft(); } });
      opts.push({ label: 'Share your food (2)', sub: 'A small kindness', disabled: g.res.food < 2, fn: () => { g.res.food -= 2; p.needs.food = clamp(p.needs.food + 30, 0, 100); p.morale = clamp(p.morale + 4, 0, 100); return true; } });
      opts.push({ label: 'Treat wounds (1 medicine)', disabled: g.res.med < 1 || p.hp >= p.maxHp - 3 && !p.bleed, fn: () => { g.res.med--; p.bleed = 0; p.hp = Math.min(p.maxHp, p.hp + 25); p.cracks.forEach((c) => (c.l -= 0.5)); p.cracks = p.cracks.filter((c) => c.l > 0.05); p.morale = clamp(p.morale + 3, 0, 100); return true; } });
      opts.push({ label: 'Praise', sub: 'Morale up, small', fn: () => { p.morale = clamp(p.morale + 6, 0, 100); p.trueStance = clamp(p.trueStance + 1, -100, 100); C.say(a, 'Gracias, comandante', '#1d4a1d', 2); } });
      opts.push({ label: 'Reprimand', sub: 'Discipline up, morale down', fn: () => { p.morale = clamp(p.morale - 5, 0, 100); g.rep.discipline = clamp(g.rep.discipline + 2, 0, 100); C.say(a, 'Sí, jefe...', '#7a1d1d', 2); } });
      opts.push({ label: 'Dismiss him from the rebels', sub: 'He goes home', fn: () => { C.desert(p); a.gone = true; const i = s.actors.indexOf(a); if (i >= 0) s.actors.splice(i, 1); } });
      if (p.roster === 'che' || p.occ === 'medico') opts.push({ label: 'Ask him to treat the whole squad (2 medicine)', disabled: g.res.med < 2, fn: () => { g.res.med -= 2; for (const q of C.squadPeople()) { q.bleed = 0; q.hp = Math.min(q.maxHp, q.hp + 14); } ui.toast('Squad treated.'); } });
      if (p.covert || ['celia', 'haydee', 'hart', 'melba', 'frank', 'vilma'].includes(p.roster)) opts.push({ label: `Hand over pipeline funds (${Math.round(g.pipe.balance)} pesos) for courier`, disabled: g.pipe.balance < 20, fn: () => { C.sendCourier(a, Math.round(g.pipe.balance)); } });
    }
    // ---- civilians
    else if (civ || (army && !a.surrendered)) {
      if (army) { opts.push({ label: 'Demand surrender', sub: 'He may lay down his weapon if outnumbered or demoralised', fn: () => { const p2 = a.p; if (Math.random() < clamp(0.1 + (60 - p2.morale) / 100 + (s.actors.filter((q) => q.side === 'rebel' && !q.dead).length > 3 ? 0.2 : 0), 0.05, 0.9)) { a.surrendered = true; C.say(a, '¡Me rindo!', '#7a1d1d', 4); C.dropWeapon(a); a.weaponOut = false; } else C.say(a, '¡Antes muerto!', '#1a2a7a', 2); } }); }
      else {
        opts.push({ label: 'Talk: ask about the neighborhood', sub: 'Intel and local sentiment', fn: () => { const lines = gossipFor(p); const mood = p.needs.hope < 35 ? 'sullen' : 'warm'; p.needs.hope = clamp(p.needs.hope + 0.5, 0, 100); ui.menu(C.fullName(p), esc(lines.join(' ')), [{ label: 'Thank them', fn: () => { } }]); return () => { }; } });
        const stock = p.needs.food > 28; const qty = Math.min(12, Math.max(3, Math.floor(p.needs.food / 8) - (p.cls === 0 ? 2 : 0)));
        opts.push({ label: `Buy food (${qty} for ${Math.ceil(qty * price)} pesos)`, sub: stock ? `${tag} sells at a ${Math.round(price / 0.26 * 100)}% price` : 'They have little to spare', disabled: !stock || g.res.money < qty * price, fn: () => { C.forageTransactionDirect(a, 'pay', qty); return true; } });
        opts.push({ label: `Take food on a vale (owe ${Math.ceil(qty * price)} pesos in 30 days)`, disabled: !stock, fn: () => { C.forageTransactionDirect(a, 'vale', qty); return true; } });
        opts.push({ label: 'Ask for food as a gift', sub: p.trueStance > 30 ? 'Sympathizer: likely yes' : 'May refuse', disabled: !stock, fn: () => { if (p.trueStance + (p.traits.includes('generous') ? 25 : 0) + Math.random() * 40 > 45) { g.res.food += qty; p.needs.food -= qty * 0.5; C.say(a, 'Llévese lo que haga falta', '#1d4a1d', 2.4); C.addEvent({ type: 'gift', victim: p, perpSide: 'rebel', positive: true, sev: 8, pub: 0, x: a.x, y: a.y, scene: s, settlement: s.sid, text: `${tag} gave food to the rebels`, memText: 'Gave to the rebels' }); } else { C.say(a, 'No tenemos nada...', '#7a1d1d', 2.2); } return true; } });
        opts.push({ label: 'Give food (3) to the family', sub: 'Build goodwill', disabled: g.res.food < 3 || p.needs.food > 70, fn: () => { g.res.food -= 3; p.needs.food = clamp(p.needs.food + 25, 0, 100); C.addEvent({ type: 'aid', victim: p, perpSide: 'rebel', positive: true, sev: 36, pub: 0.1, x: a.x, y: a.y, scene: s, settlement: s.sid, text: `The rebels gave food to ${tag}'s family`, memText: 'Rebels fed my family' }); C.deed(1, 1.5); return true; } });
        opts.push({ label: 'Treat their injuries (1 medicine)', sub: p.hp < p.maxHp - 3 || p.health < 70 ? '' : 'They look well', disabled: g.res.med < 1 || (p.hp >= p.maxHp - 3 && p.health >= 70), fn: () => { g.res.med--; p.hp = p.maxHp; p.health = clamp(p.health + 14, 0, 100); p.bleed = 0; C.addEvent({ type: 'aid', victim: p, perpSide: 'rebel', positive: true, sev: 52, pub: 0.2, x: a.x, y: a.y, scene: s, settlement: s.sid, text: `A rebel medic treated ${tag}`, memText: 'A rebel medic treated me' }); C.deed(1, 3); return true; } });
        if (p.sex === 'M' && C.ageOf(p) >= 16 && C.ageOf(p) <= 45 && !p.mil) opts.push({ label: 'Invite to join the rebels', sub: `Willing if committed: ${hidden ? '?' : p.trueStance > 35 && p.conv > 25 ? 'yes' : p.trueStance > 15 ? 'maybe' : 'no'}`, fn: () => { if (p.trueStance > 30 + (p.traits.includes('cautious') ? 10 : 0) && p.conv > 20 || p.trueStance > 55) { C.recruit(p); a.gone = true; const i = s.actors.indexOf(a); if (i >= 0) s.actors.splice(i, 1); } else C.say(a, 'No me convence todavía...', '#444', 2.4); } });
        if (p.sex === 'F' && C.ageOf(p) >= 16 && C.ageOf(p) <= 45 && !p.mil && g.platform.declared[6] && g.platform.pub[6] >= 1) opts.push({ label: 'Invite to join as courier / fighter', sub: 'She trusts you if you keep promises about women', fn: () => { if (p.trueStance > 25 && g.trust.peasants + g.trust.students > 0.7 || p.trueStance > 50) { p.covert = true; C.recruit(p, 2); a.gone = true; const i = s.actors.indexOf(a); if (i >= 0) s.actors.splice(i, 1); } else C.say(a, 'Primero demuestre que cumple.', '#444', 2.4); } });
        if (a.weaponOut || pl.weaponOut) opts.push({ label: 'Take food at gunpoint', sub: 'They will fear you — and remember', fn: () => { C.forageTransactionDirect(a, 'take', qty); return true; } });
        if (p.donor || (s.type === 'capital' || s.type === 'city') && p.cls >= 3 && (p.fac === 'elite' || p.fac === 'middle') && C.ageOf(p) > 25) opts.push({ label: 'Pitch for a contribution to the cause', sub: p.donor ? `A known donor (up to ~${p.donor} pesos)` : 'They may be generous — or informers', fn: () => { pitchMenu(p); } });
        if (p.fac === 'students' || p.occ === 'sindicalista') opts.push({ label: p.fac === 'students' ? 'Organize students: plan a march' : 'Organize the union: strike committee', sub: 'Builds the general strike (needs 10 pesos)', disabled: g.res.money < 10, fn: () => { g.res.money -= 10; g.strikePrep += 3; p.needs.hope = clamp(p.needs.hope + 4, 0, 100); p.trueStance = clamp(p.trueStance + 2, -100, 100); if (Math.random() < 0.12) g.player.susp += 30; C.deed(4, 2); ui.toast('They will organize.'); } });
        if (['celia', 'haydee', 'hart', 'melba', 'frank', 'vilma'].includes(p.roster)) opts.push({ label: `Hand pipeline funds (${Math.round(g.pipe.balance)} pesos) to a courier`, disabled: g.pipe.balance < 20, fn: () => { C.sendCourier(a, Math.round(g.pipe.balance)); } });
        if (g.unlocked.layer >= 3 && g.day > 20) {
          if (['bodeguero', 'comerciante', 'hacendado', 'mayordomo'].includes(p.occ) || p.fac === 'landowners') opts.push({ label: 'Demand a weekly "contribution" for protection', sub: 'Pays well. They will remember how you collected. The band drifts toward a business.', fn: () => { C.racketStart('protect', p); return true; } });
          if (['pescador', 'estibador'].includes(p.occ)) opts.push({ label: 'Arrange contraband runs on his boat', sub: 'Rum, cigars, and worse. Profitable; corrosive.', fn: () => { C.racketStart('contraband', p); return true; } });
          if ((p.fac === 'elite' || p.fac === 'landowners') && p.cls >= 3 && (s.type === 'city' || s.type === 'capital' || s.type === 'town')) opts.push({ label: 'Kidnap for ransom', sub: 'A fortune, if it works. Rebels do not usually do this. It will be remembered.', fn: () => { C.racketStart('kidnap', p); return true; } });
        }
        if (p.occ === 'mayordomo' || p.fac === 'landowners') opts.push({ label: 'Seize the estate and distribute the land', sub: 'The peasants cheer; landowners will never forgive', fn: () => { C.land.seizeMenu(p); } });
        if (p.informant && !p.revealed || C.tells(p).length) opts.push({ label: 'Have your network check on this person (12 pesos)', sub: 'Discreet inquiries; usually right', disabled: g.res.money < 12 || p.revealed, fn: () => { C.investigate(p); buildLeft(); ui.update(true); } });
        if (p.informant && p.revealed) { opts.push({ label: 'Hold a trial', sub: 'Calls the village; verdict visible to all', fn: () => { trial(a); } }); }
        if (p.roster === 'anselmo') { opts.splice(1, 0, { label: 'Ask El Viejo for advice', fn: () => { ui.openJournal('viejo'); } }); }
        if (p.roster === 'eutimio') { opts.unshift({ label: 'Take him on as a guide', sub: 'History says he betrays you', fn: () => { p.mil = { side: 'rebel', rank: 'Guía' }; C.recruit(p); p.informant = true; p.revealed = false; ui.toast('Eutimio is now your guide.'); } }); }
      }
    }
    ui.menu(C.fullName(p), lede, opts, head); try { portrait($('mport'), p, a, 3.8); } catch (e) { }
  }
  C.forageTransactionDirect = function (a, mode, qty) {
    const g = G(); const old = g.policy.forage; g.policy.forage = mode; const orig = Math.random; C.forageTransaction(a, a, 'civ'); g.policy.forage = old;
  };
  // (legacy) release a surrendered soldier; the full set of prisoner choices is in policy.js.
  function releasePrisoner(a) {
    const g = G(), s = g.scene, p = a.p; a.gone = true; const i = s.actors.indexOf(a); if (i >= 0) s.actors.splice(i, 1); p.mil = p.mil; if (a.weapon) C.dropWeapon(a);
    g.regime.armyMorale = clamp(g.regime.armyMorale - 0.5, 0, 100); g.stats.released++; g.rep.justice = clamp(g.rep.justice + 2, 0, 100); C.deed(5, 3);
    C.addEvent({ type: 'release', victim: p, perpSide: 'rebel', positive: true, sev: 38, pub: 0.2, x: a.x, y: a.y, scene: s, settlement: s.sid, text: `The rebels released ${C.tagName(p)} unharmed`, memText: 'The rebels spared our soldier', headline: null });
    p.status = 'away'; p.note = 'Released by the rebels.'; p.morale = 25; C.log(`${C.tagName(p)} released unharmed.`, 'good');
  }
  C.seizeEstate = function (p) {
    const g = G(), s = g.scene; C.deed(0, 28); C.deed(3, 4); g.rep.justice = clamp(g.rep.justice - 1, 0, 100);
    for (const q of C.W.people) { if (q.status !== 'alive') continue; if (q.fac === 'peasants' && q.settlement === s.sid) { q.trueStance += 6; q.needs.hope = clamp(q.needs.hope + 12, 0, 100); q.needs.food = clamp(q.needs.food + 8, 0, 100); } if (q.fac === 'landowners') q.trueStance -= 7; if (q.fac === 'elite') q.trueStance -= 1.5; }
    C.addEvent({ type: 'seizure', victim: p, perpSide: 'rebel', val: -1, sev: 62, pub: 0.8, x: 0, y: 0, settlement: s.sid, text: `Rebels seized the estate of ${C.tagName(p)}`, memText: 'Rebels took our land', headline: `Rebels seize the ${C.tagName(p)} estate and hand it to tenants` });
    ui.toast('The land is distributed.');
  };
  // A public trial of an exposed informer: death, exile, or release with a warning — each with different consequences for the village.
  function trial(a) {
    const g = G(), p = a.p; const s = g.scene;
    ui.menu('The trial of ' + C.fullName(p), `${esc(C.tagName(p))} took money from the army to sell your positions. The village is watching; his kin are in the crowd.`, [
      { label: 'Sentence: death (as in history)', sub: 'Justified by proof. His family will be torn.', fn: () => { C.die(a, g.player, 'executed'); g.stats.executed++; C.addEvent({ type: 'execution', victim: p, perpSide: 'rebel', val: -1, sev: 60, just: true, pub: 0.8, x: a.x, y: a.y, scene: s, settlement: s.sid, text: `Rebels executed an informer, ${C.tagName(p)}, after a trial`, memText: `${C.tagName(p)} was executed as an informer` }); g.rep.fear += 6; g.rep.justice -= 2; C.deed(5, 8); } },
      { label: 'Sentence: exile from the Sierra', sub: 'Merciful. He may talk to the army.', fn: () => { p.mil = null; p.settlement !== 'manzanillo' && C.moveTo(p, 'manzanillo'); a.gone = true; const i = s.actors.indexOf(a); if (i >= 0) s.actors.splice(i, 1); g.regime.heat += 4; g.rep.justice += 3; C.deed(5, 6); C.addEvent({ type: 'mercy', victim: p, perpSide: 'rebel', positive: true, sev: 30, pub: 0.5, x: 0, y: 0, settlement: s.sid, text: 'Rebels spared an informer', memText: 'Rebels spared the informer' }); } },
      { label: 'Release him with a warning', sub: 'He knows you are not savages. And what you know.', fn: () => { p.informant = false; p.trueStance = 0; p.stance = 0; g.rep.justice += 1; } },
    ]);
  }
  // Ask a rich person for a donation: the chance depends on their stance, your trust among the elite, justice and fear, and how your platform treats property, democracy and land.
  function pitchMenu(p) {
    const g = G(); const base = clamp(0.18 + (p.trueStance + 30) / 220 + g.trust.elite * 0.25 + (g.rep.justice - 50) / 300 - g.rep.fear / 400, 0.04, 0.85);
    const need = (k, lvl) => g.platform.declared[k] && g.platform.pub[k] === lvl;
    const prop = need(3, 0) || need(3, 1) ? 0.12 : g.platform.declared[3] && g.platform.pub[3] === 2 ? -0.18 : 0;
    const dem = need(4, 2) ? 0.1 : g.platform.declared[4] && g.platform.pub[4] === 0 ? -0.15 : 0;
    const land = g.platform.declared[0] && g.platform.pub[0] === 2 ? (p.fac === 'landowners' ? -0.35 : -0.1) : 0;
    const chance = clamp(base + prop + dem + land, 0.03, 0.9);
    const amt = () => Math.round((p.donor || (p.cls >= 4 ? 140 : 60)) * (0.25 + Math.random() * 0.35));
    const attempt = (mod, label) => () => {
      if ((p.donorCd || 0) > g.day) { ui.menu('Too soon', `${esc(C.tagName(p))} frowns. "I gave you something only a few weeks ago. Come back when the season changes."`, [{ label: 'Apologize and leave', fn: () => { } }]); g.player.susp = (g.player.susp || 0) + 8; return; }
      const ok = Math.random() < chance + mod; const risky = p.trueStance < -10 && Math.random() < 0.35 + (mod < 0 ? 0.1 : 0);
      if (risky) { g.regime.heat = clamp(g.regime.heat + 8, 0, 100); g.player.susp = (g.player.susp || 0) + 45; C.log(`${C.tagName(p)} may have gone to the police.`, 'bad'); }
      if (ok) { const m = amt(); p.donorCd = g.day + 60; g.pipe.balance += m; g.stats.pesos += m; C.addEvent({ type: 'donation', victim: p, perpSide: 'rebel', positive: true, sev: 14, pub: 0, x: 0, y: 0, settlement: p.settlement, text: `${C.tagName(p)} contributed to the cause`, memText: 'Gave to the cause' }); p.trueStance = clamp(p.trueStance + 3, -100, 100); ui.menu('A contribution', `${esc(C.tagName(p))} hands over an envelope: <b>${m} pesos</b> for the pipeline. Money in Havana must be carried to the Sierra by a courier — find Haydée, Hart or another contact.`, [{ label: 'Pocket it and slip away', fn: () => { } }]); }
      else ui.menu('Declined', `${esc(C.tagName(p))} looks at the floor. "Not now. Not in these times."`, [{ label: 'Thank them for their time', fn: () => { } }]);
    };
    ui.menu(`Pitch to ${C.tagName(p)}`, `Chance of success is around <b>${Math.round(chance * 100)}%</b>. Your declared platform matters: protect property or promise elections and the merchants relax; expropriation frightens them. ${p.trueStance < -10 ? '<br><b style="color:#ff9d8c">Warning:</b> this person leans toward the regime and may inform on you.' : ''}`, [
      { label: 'Appeal to conscience and the nation', sub: 'Honest', fn: attempt(0.05) },
      { label: 'Promise protection of property and the 1940 Constitution', sub: 'Effective with elites; commits you to a moderate platform', fn: attempt(0.15) },
      { label: 'Offer total discretion — no names, no receipts', sub: 'Lowers the chance, raises safety', fn: attempt(-0.05) },
      { label: 'Hint at what happens to those who refuse', sub: 'A tyrant\'s tool. Success is likelier — and costly later', fn: () => { g.rep.fear += 8; g.rep.justice -= 4; g.trust.elite = clamp(g.trust.elite - 0.08, 0.02, 1); attempt(0.25)(); C.addEvent({ type: 'intimidation', victim: p, perpSide: 'rebel', val: -1, sev: 50, pub: 0.2, x: 0, y: 0, settlement: p.settlement, text: 'Rebels threatened a merchant', memText: 'The rebels threatened me' }); } },
    ]);
  }

  // THE ISLAND MAP: places, routes, travel by foot/vehicle (with costs), and which squads go.
  // ---------- map ----------
  // (see above)
  ui.openMap = function (dest) {
    const g = G(); if (g.over) return; const here = g.scene.sid;
    const W = 760, H = 400;
    // schematic projection: the west is squeezed and the east (where the war is) stretched
    const fx = (lon) => { const t = lon <= -79 ? (lon + 85) / 6 * 0.3 : 0.3 + (lon + 79) / 4.9 * 0.7; return 14 + t * (W - 28); };
    const fy = (lat) => { const t = lat >= 21.5 ? (23.6 - lat) / 2.1 * 0.2 : 0.2 + (21.5 - lat) / 1.7 * 0.8; return 14 + Math.min(1.05, t) * (H - 40); };
    let h = `<button class="btn sm close">✕</button><h2>🗺 The island, ${C.dateStr(g.day)}</h2><div class="lede">Choose a place to travel to. Foot travel takes days (and food); vehicle travel takes hours and fuel. In towns and cities you leave rifles in a cache and carry only what can be hidden. (Schematic map: Oriente enlarged.)</div><div style="display:flex;gap:14px;align-items:flex-start;flex-wrap:wrap"><div><canvas id="mapcv" width="${W}" height="${H}" style="width:${W}px;max-width:100%"></canvas></div><div id="mapside" style="width:250px"></div></div>`;
    openModal(h, true);
    const cv = $('mapcv'), c = cv.getContext('2d');
    const nodes = C.PLAYABLE.map((id) => ({ id, S: C.SETTLEMENTS[id], x: fx(C.SETTLEMENTS[id].pos[0]), y: fy(C.SETTLEMENTS[id].pos[1]) }));
    const mean = {}; for (const id of C.PLAYABLE) { let s = 0, n = 0; for (const pid of C.W.bySet[id] || []) { const p = C.P(pid); if (p.status === 'alive' && C.ageOf(p) >= 15) { s += p.trueStance; n++; } } mean[id] = n ? s / n : 0; }
    const sel = { id: dest || null };
    function redraw() {
      c.fillStyle = '#17252f'; c.fillRect(0, 0, W, H);
      c.beginPath(); C.COAST.forEach((q, i) => (i ? c.lineTo(fx(q[0]), fy(q[1])) : c.moveTo(fx(q[0]), fy(q[1])))); c.closePath(); c.fillStyle = '#3d5a34'; c.fill(); c.strokeStyle = '#8fb07e'; c.lineWidth = 2; c.stroke();
      c.fillStyle = 'rgba(70,48,34,.45)'; c.beginPath(); c.ellipse(fx(-76.9), fy(20.12), 150, 30, -0.1, 0, 6.3); c.fill(); c.fillStyle = 'rgba(255,255,255,.4)'; c.font = 'italic 12px sans-serif'; c.textAlign = 'center'; c.fillText('Sierra Maestra', fx(-76.2), fy(20.2) + 4);
      c.strokeStyle = 'rgba(255,225,150,.5)'; c.lineWidth = 1.5; c.setLineDash([5, 4]);
      for (const e of C.EDGES) { const a = C.SETTLEMENTS[e[0]].pos, b = C.SETTLEMENTS[e[1]].pos; c.beginPath(); c.moveTo(fx(a[0]), fy(a[1])); c.lineTo(fx(b[0]), fy(b[1])); c.stroke(); } c.setLineDash([]);
      for (const id of ['biran', 'cardenas', 'artemisa', 'encrucijada', 'cruces', 'yara', 'banes', 'medialuna']) { const S = C.SETTLEMENTS[id]; if (!S.pos) continue; c.fillStyle = 'rgba(255,255,255,.35)'; c.beginPath(); c.arc(fx(S.pos[0]), fy(S.pos[1]), 3, 0, 6.3); c.fill(); c.font = '10px sans-serif'; c.fillStyle = 'rgba(255,255,255,.55)'; c.textAlign = 'center'; c.fillText(S.name + ' (birthplace)', fx(S.pos[0]), fy(S.pos[1]) - 6); }
      for (const n of nodes) {
        const m = mean[n.id]; const col2 = C.loyaltyColor(m * 2.2, 70);
        c.fillStyle = col(col2); c.beginPath(); c.arc(n.x, n.y, n.id === sel.id ? 12 : 9, 0, 6.3); c.fill(); c.strokeStyle = n.id === here ? '#ffe28a' : '#222'; c.lineWidth = n.id === here ? 3 : 1.5; c.stroke();
        c.font = '600 12px sans-serif'; c.textAlign = 'center'; c.lineWidth = 3; c.strokeStyle = 'rgba(0,0,0,.75)'; const lab = n.S.name + (n.id === here ? ' (you)' : ''); const dy = n.id === 'cayo' || n.id === 'sierra' ? 24 : -15; c.strokeText(lab, n.x, n.y + dy); c.fillStyle = n.id === here ? '#ffe28a' : '#fff'; c.fillText(lab, n.x, n.y + dy);
      }
      side();
    }
    function side() {
      const el = $('mapside'); const id = sel.id;
      if (!id) { el.innerHTML = `<div class="sub">Click a place. A node's colour shows the average loyalty of its people (blue Batista, white undecided, red rebel).</div>`; return; }
      const S = C.SETTLEMENTS[id]; const cost = id === here ? { days: 0, hours: 0 } : C.travelCost(here, id); const urban = ['town', 'city', 'capital'].includes(S.type);
      let t = `<h3 style="color:var(--gold);margin:0 0 4px">${esc(S.name)}</h3><div class="sub">${esc(S.blurb)}</div>`;
      t += `<div class="sub" style="margin-top:6px">Mood: ${mean[id] > 15 ? 'sympathetic' : mean[id] < -15 ? 'loyal to the regime' : 'divided'} (${mean[id] > 0 ? '+' : ''}${mean[id].toFixed(0)})</div>`;
      if (id !== here) {
        t += `<div class="row"><span>On foot</span><b>${cost.days.toFixed(1)} days</b></div><div class="row"><span>By vehicle</span><b>${cost.hours} h</b></div>`;
        t += `<div class="sub" style="margin-top:6px">Bring (within reach):</div>`;
        t += g.squads.map((sq) => `<label style="display:block"><input type="checkbox" class="sqgo" data-i="${sq.id}" ${urban ? (sq.id === 3 ? 'checked' : '') : 'checked'}> ${C.gName(sq)} (${sq.members.length})</label>`).join('');
        if (urban) t += `<div class="sub" style="color:#ffd37a;margin-top:4px">⚠ Rifles and SMGs go into a cache; only concealed pistols travel. Women and the urban-born draw less suspicion.</div>`;
        t += `<div style="display:flex;gap:6px;margin-top:8px;flex-wrap:wrap"><button class="btn primary" id="goFoot">Go on foot</button><button class="btn" id="goVeh" ${g.vehicle ? '' : 'disabled'} title="${g.vehicle ? '' : 'Get in a vehicle first (E)'}">By vehicle</button></div>`;
      } else t += `<div class="sub" style="margin-top:6px">You are here.</div>`;
      el.innerHTML = t;
      const go = (mode) => { const sqs = [...el.querySelectorAll('.sqgo')].filter((x) => x.checked).map((x) => +x.dataset.i); ui.closeModal(); C.travelTo(id, mode, sqs); };
      const gf = $('goFoot'); if (gf) gf.onclick = () => go('foot'); const gv = $('goVeh'); if (gv) gv.onclick = () => go('vehicle');
    }
    cv.onclick = (e) => { const r = cv.getBoundingClientRect(); const x = (e.clientX - r.left) * W / r.width, y = (e.clientY - r.top) * H / r.height; let best = null, bd = 26; for (const n of nodes) { const d = Math.hypot(n.x - x, n.y - y); if (d < bd) { bd = d; best = n; } } if (best) { sel.id = best.id; redraw(); } };
    redraw();
  };

  // THE MANIFESTO: announce a position per plank; the coloured dots show which factions like each option; the forecast under each option is the predicted shift in support (policy.js); a secret real plan can differ from the public one (concealment, with the risk of a leak); presets; a poll button.
  // ---------- manifesto ----------
  // (see above)
  ui.openManifesto = function () {
    const g = G(); if (g.over) return; const P = g.platform;
    let h = `<button class="btn sm close">✕</button><h2>📜 The Manifesto</h2><div class="lede">What you announce, what you will do, and whether people believe you. Unannounced planks mean nothing to anyone. Announced planks become promises; people count the days and the deeds. The coloured dots show how each option sits with: peasants · workers · middle class · students · elites · landowners · church · army.</div>`;
    h += `<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:6px">${Object.keys(C.presets).map((k) => `<button class="btn sm" data-pre="${k}">${C.presets[k].n}</button>`).join('')}</div>`;
    const FC = C.forecastAll();   // predicted shift in support for every option (policy.js)
    h += `<div class="sub" style="margin-bottom:6px">The small figure under each option is the <b>forecast</b>: the average change in support across the island if you announce it (best and worst factions on hover). <button class="btn sm" id="pollBtn">Run a poll (20 pesos)</button></div>`;
    C.PLANKS.forEach((pl, k) => {
      const decl = P.declared[k]; const mism = decl && P.pub[k] !== P.real[k];
      h += `<div class="plank"><div class="row"><b>${pl.name} <span class="sub">${pl.en}</span></b><span class="sub">deeds ${Math.round(g.deeds[k])}% ${decl ? '· announced ' + Math.max(0, g.day - P.dayDeclared[k]) + 'd ago' : '· not announced'}${mism ? ' · <b style="color:#ff9d8c">⚠ secret plan differs</b>' : ''}</span></div><div class="opts">`;
      pl.opts.forEach((o, i) => {
        const q = i - 1; const dots = C.FACTION_KEYS.map((f) => { const fit = 1 - Math.abs(q - C.FACTIONS[f].iss[k]); const cc = fit > 0.6 ? '#7fc46a' : fit > 0.2 ? '#cdd58a' : fit > -0.2 ? '#e6b84e' : '#dc4a3a'; return `<span title="${C.fName(f)}: ${fit > 0.6 ? 'likes' : fit > 0.2 ? 'ok' : fit > -0.2 ? 'cool' : 'dislikes'}" style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${cc};margin-right:2px"></span>`; }).join('');
        const fc = FC[k][i]; const tip = `Best: ${fc.best.map((f) => C.fName(f) + ' ' + (fc.byFaction[f] > 0 ? '+' : '') + fc.byFaction[f].toFixed(1)).join(', ')} · Worst: ${fc.worst.map((f) => C.fName(f) + ' ' + (fc.byFaction[f] > 0 ? '+' : '') + fc.byFaction[f].toFixed(1)).join(', ')}`;
        h += `<button class="btn ${decl && P.pub[k] === i ? 'on' : ''}" data-k="${k}" data-i="${i}" title="${esc(tip)}">${esc(o)}<br>${dots}<br><span class="sub" style="color:${fc.overall > 0.4 ? '#9fdc8a' : fc.overall < -0.4 ? '#ff9d8c' : 'inherit'}">forecast ${fc.overall > 0 ? '+' : ''}${fc.overall.toFixed(1)}</span></button>`;
      });
      h += `</div>`;
      if (decl) h += `<div class="sub" style="margin-top:4px">Secret intent: <select data-real="${k}" style="background:#0003;color:inherit;border:1px solid var(--line);border-radius:5px">${pl.opts.map((o, i) => `<option value="${i}" ${P.real[k] === i ? 'selected' : ''}>${esc(o)}</option>`).join('')}</select> <span class="sub">(a gap leaks eventually, and trust collapses)</span></div>`;
      h += `</div>`;
    });
    h += `<div class="sub">Trust: ${C.FACTION_KEYS.map((f) => `${C.fName(f)} ${Math.round(g.trust[f] * 100)}%`).join(' · ')}</div>`;
    openModal(h, true);
    $('pollBtn').onclick = () => { ui.menu('Run a poll', 'Which town? About forty people will be asked; people say what they dare to say.', C.PLAYABLE.map((sid) => ({ label: C.SETTLEMENTS[sid].name, fn: () => { const r = C.pollSettlement(sid, 20); if (!r) return; const rows = Object.keys(r.byFaction).map((f) => `<div class="row"><span>${C.fName(f)} <span class="sub">(n=${r.byFaction[f].n})</span></span><b>${Math.round(r.byFaction[f].pctRebel * 100)}% with you · mean ${r.byFaction[f].mean.toFixed(0)}</b></div>`).join(''); ui.menu('Poll: ' + C.SETTLEMENTS[sid].name, `Overall ${Math.round(r.pctRebel * 100)}% lean to you, ${Math.round(r.pctBatista * 100)}% to Batista (±${Math.round(r.margin * 100)}%).<br>${rows}`, [{ label: 'Back to the manifesto', fn: () => { ui.openManifesto(); } }]); } }))); };
    $('mbox').querySelectorAll('[data-pre]').forEach((b) => b.onclick = () => { C.applyPreset(b.dataset.pre); ui.openManifesto(); });
    $('mbox').querySelectorAll('[data-k]').forEach((b) => b.onclick = () => { const k = +b.dataset.k, i = +b.dataset.i; const keepReal = P.declared[k] && P.real[k] !== P.pub[k] ? P.real[k] : undefined; C.declarePlank(k, i, keepReal !== undefined ? keepReal : i); ui.openManifesto(); });
    $('mbox').querySelectorAll('[data-real]').forEach((s2) => s2.onchange = () => { P.real[+s2.dataset.real] = +s2.value; ui.openManifesto(); });
  };

  // FACTIONS PANEL: each faction's size, mean loyalty, trust in you, and what they care about; women and Afro-Cuban means.
  // ---------- factions ----------
  // (see above)
  ui.openFactions = function () {
    const g = G(); if (g.over) return; const t = C.factionTable(); const R = g.rep, RG = g.regime;
    const row = (name, v, tr, n, colr) => `<div class="fbar"><span><span style="display:inline-block;width:9px;height:9px;border-radius:3px;background:${colr || '#aaa'};margin-right:5px"></span>${esc(name)}${n !== undefined ? ` <span class="sub">(${n})</span>` : ''}</span><div class="track"><i style="left:${50 + v / 2}%"></i></div><span class="sub">${v > 0 ? '+' : ''}${v.toFixed(0)}${tr !== undefined ? ` · trust ${Math.round(tr * 100)}%` : ''}</span></div>`;
    let h = `<button class="btn sm close">✕</button><h2>⚖ Who is with you</h2><div class="lede">Average loyalty (blue ← → red) of the sampled people of each group across the island, and how far each group trusts you to keep your word.</div>`;
    h += t.rows.map((r) => row(r.name, r.mean, r.trust, r.n, r.col)).join('');
    h += `<div class="sub" style="margin:8px 0 2px">Cross-cutting groups</div>` + row('Women', t.women) + row('Afro-Cubans (negros & mulatos)', t.afro) + row('Everyone', t.all);
    // discipline axis
    const tyr = clamp((R.fear - 20) * 0.9 + (50 - R.justice) * 0.6, -100, 100); const soft = clamp((45 - R.discipline) * 1.2, -100, 100);
    const verdict = tyr > 35 ? '<b style="color:#ff9d8c">Tyrant: fear holds the troops, but elites, the Church and the towns pull away and informers multiply.</b>' : soft > 25 ? '<b style="color:#e6b84e">Too soft: indiscipline, desertion and theft; peasants lose trust.</b>' : '<b style="color:#a8e69a">Balanced: firm, fair and trusted.</b>';
    h += `<h3 style="margin-top:12px;color:var(--gold)">Your reputation</h3><div class="grid2"><div>${[['Fear', R.fear, '#b06ae0'], ['Justice', R.justice, '#7fc46a'], ['Honesty', R.honesty, '#5ab0e8'], ['Discipline', R.discipline, '#e6b84e'], ['Competence', R.competence, '#c9a0ff']].map(([n, v, c]) => `<div class="need" style="grid-template-columns:80px 1fr 30px"><span>${n}</span>${bar(v, c)}<span>${Math.round(v)}</span></div>`).join('')}</div><div class="sub">${verdict}<br><br>Fear compels quick obedience and quick betrayal. Justice and honesty compound slowly. Discipline is firmness applied fairly.</div></div>`;
    h += `<h3 style="margin-top:12px;color:var(--gold)">The regime</h3><div class="grid2"><div>${[['Legitimacy', RG.legit, '#5b86e0'], ['Army morale', RG.armyMorale, '#5b86e0'], ['US support', RG.usSupport, '#5b86e0'], ['Alert (heat)', RG.heat, '#dc4a3a']].map(([n, v, c]) => `<div class="need" style="grid-template-columns:90px 1fr 30px"><span>${n}</span>${bar(v, c)}<span>${Math.round(v)}</span></div>`).join('')}</div><div class="sub">When legitimacy and army morale both collapse, garrisons surrender and Batista flees. The history: 1 January 1959.</div></div>`;
    h += `<div class="sub" style="margin-top:8px">Strike readiness: ${Math.round(g.strikePrep)}/55 · Pipeline money in Havana: ${Math.round(g.pipe.balance)} pesos · ${g.pipe.couriers.length} courier(s) on the road</div>`;
    openModal(h, true);
  };

  // JOURNAL TABS: El Viejo (advice), Objectives, news (Bohemia headlines and the log), the Ledger (who you killed, released, executed, recruited), and the Director (its variables, in transparency mode).
  // ---------- journal ----------
  // (see above)
  ui.openJournal = function (tab) {
    const g = G(); if (g.over) return; tab = tab || 'viejo';
    const tabs = [['viejo', 'El Viejo'], ['obj', 'Objectives'], ['news', 'Bohemia & log'], ['ledger', 'Ledger'], ['dir', 'The Director']];
    let h = `<button class="btn sm close">✕</button><h2>📓 Journal</h2><div class="tabs">${tabs.map(([k, n]) => `<button class="btn sm ${tab === k ? 'on' : ''}" data-t="${k}">${n}</button>`).join('')}</div><div class="help">`;
    if (tab === 'viejo') {
      const an = C.W.roster.anselmo; C.story.update();
      h += `<canvas id="jport" width="72" height="72" style="float:right;border-radius:8px;background:rgba(0,0,0,.25);margin:0 0 6px 10px"></canvas><div class="sub">Don Anselmo, a veteran of the 1895 war, charcoal-burner of the Sierra. He sees what the mountain sees.</div>`;
      C.viejoAdvice().forEach(([t, txt]) => (h += `<div class="plank"><b>${esc(t)}</b><div>${esc(txt)}</div></div>`));
      if (g.viejoLast) h += `<div class="sub">Last said (day ${g.viejoLast.day}): “${esc(g.viejoLast.text)}”</div>`;
    } else if (tab === 'obj') {
      h += g.mission ? `<div class="plank"><b>Now:</b> ${esc(g.mission.text)}</div>` : '<div class="sub">No mission set. Look after your people.</div>';
      h += `<div class="plank"><b>The long road</b><div class="sub">Win the island: bring legitimacy and army morale down while building a coalition that will survive victory. History: Batista flees on 1 January 1959. You have until the end of 1960 to do it a different way.</div></div>`;
      h += `<div class="plank"><b>Unlocked systems</b><div class="sub">Level ${g.unlocked.layer}/6 — ${['', 'tactics', 'supplies', 'locals', 'factions', 'manifesto', 'the island'][g.unlocked.layer]}. They reveal as the story advances (press <kbd>U</kbd> to reveal all).</div></div>`;
    } else if (tab === 'news') {
      h += `<div class="sub">Headlines</div>` + (g.news.length ? g.news.slice(0, 10).map((n) => `<div class="row"><span>${esc(n.text)}</span><span class="sub">${C.dateStr(n.day)}</span></div>`).join('') : '<div class="sub">Quiet.</div>');
      h += `<div class="sub" style="margin-top:8px">Log</div>` + g.log.slice(0, 18).map((l) => `<div class="row"><span class="${l.kind === 'bad' ? 'pos' : l.kind === 'good' ? '' : ''}">${esc(l.text)}</span><span class="sub">${C.dateStr(l.day)}</span></div>`).join('');
    } else if (tab === 'ledger') {
      const S = g.stats; const alive = C.W.people.filter((p) => p.status === 'alive').length, dead = C.W.people.filter((p) => p.status === 'dead' && p.died !== null && p.died >= g.day - 400 && p.diedBy && ['killed', 'bullet', 'blast', 'executed', 'fire', 'blade', 'bleeding'].includes(p.diedBy)).length;
      h += `<table class="t"><tr><td>Soldiers killed</td><td>${S.killedArmy}</td></tr><tr><td>Civilians killed</td><td>${S.killedCiv}</td></tr><tr><td>Rebels lost</td><td>${S.lostRebels}</td></tr><tr><td>Prisoners released</td><td>${S.released}</td></tr><tr><td>Executed</td><td>${S.executed}</td></tr><tr><td>Recruited</td><td>${S.hired}</td></tr><tr><td>Pesos spent on honest purchases</td><td>${Math.round(S.pesos)}</td></tr><tr><td>Vales owed</td><td>${Math.round(g.res.vales)}</td></tr></table>`;
      h += `<div class="sub">The people behind the numbers: every death spreads through a family graph — the dead soldier's mother, his compadre, his barracks mates. Open any Cubean to see who they lost.</div>`;
    } else if (tab === 'dir') {
      const V = C.story.vars; C.story.update();
      h += `<div class="sub">The Director (storyteller) decides what happens next. It watches tension, momentum, and a spiral sensor; when you are sliding it throws a lifeline, when you are comfortable it raises the pressure.</div>`;
      h += [['Tension', V.tension], ['Target', V.target], ['Pressure', V.pressure], ['Momentum', V.momentum], ['Spiral risk', (V.spiral || 0) * 100], ['Intensity (7d)', (V.intensity7 || 0) * 10]].map(([n, v]) => `<div class="need" style="grid-template-columns:110px 1fr 36px"><span>${n}</span>${bar(v, '#e6b84e')}<span>${Math.round(v || 0)}</span></div>`).join('');
      h += `<div class="sub" style="margin-top:6px">Squad: ${V.n} · hunger ${Math.round(V.hunger || 0)} · morale ${Math.round(V.morale || 0)} · support trend ${(V.supTrend || 0).toFixed(1)}</div>`;
    }
    h += `</div>`; openModal(h);
    $('mbox').querySelectorAll('[data-t]').forEach((b) => b.onclick = () => ui.openJournal(b.dataset.t));
    const jp = $('jport'); if (jp) portrait(jp, C.W.roster.anselmo, C.W.roster.anselmo.actor, 3.2);
  };

  // THE CAMP SCREEN: build on the eight plots and craft (recipes need their buildings).
  // ---------- camp ----------
  // (see above)
  ui.openBase = function () {
    const g = G(); if (g.over) return; const s = g.scene; const atCamp = s.camp;
    let h = `<button class="btn sm close">✕</button><h2>⛺ Camp & workshop</h2><div class="lede">${atCamp ? 'Walk to the dashed pads at the camp and press E to build, or build from here. Slots are fixed: a handful of well-chosen buildings.' : 'You are not at the Sierra camp. You can craft only after reaching it; policies can be set anywhere.'}</div>`;
    h += `<div class="sub">Pesos ${Math.round(g.res.money)} · Scrap ${g.res.scrap} · Cloth ${g.res.cloth} · Food ${Math.round(g.res.food)} · Medicine ${g.res.med} · Cartridges ${Math.round(g.res.ammo)} · Dynamite ${g.res.dyn || 0} · Molotovs ${g.res.molo || 0} · Pamphlets ${g.res.pamph}</div>`;
    if (atCamp) {
      h += `<h3 style="color:var(--gold);margin:10px 0 4px">Build</h3>`;
      for (const id of s.camp.slots) { const b = s.blds[id]; const k = b.slot; const cost = C.padCost(b); h += `<div class="plank"><div class="row"><b>${esc(C.BLD[k].n)}</b><span class="sub">${b.built ? '✔ built' : cost[0] + ' pesos + ' + cost[1] + ' scrap' + (b.labor ? ' (labour ×' + b.labor + ')' : '')}</span></div><div class="sub">${esc(padEffect(k))}</div>${b.built ? '' : `<button class="btn sm" data-b="${id}">Build</button>`}</div>`; }
      h += `<h3 style="color:var(--gold);margin:10px 0 4px">Workshop & kitchen</h3>`;
      for (const r of C.RECIPES) { const okNeed = !r.need || g.base.built[r.need]; h += `<div class="row"><span>${esc(r.n)} <span class="sub">${Object.keys(r.cost).map((k) => r.cost[k] + ' ' + k).join(', ') || 'free'}${r.need ? ' · needs ' + C.BLD[r.need].n : ''}</span></span><button class="btn sm" data-r="${r.id}" ${okNeed ? '' : 'disabled'}>Make</button></div>`; }
    }
    h += `<h3 style="color:var(--gold);margin:10px 0 4px">Policies</h3><div class="row"><span>Foraging</span><span>${['pay', 'vale', 'take'].map((k) => `<button class="btn sm ${g.policy.forage === k ? 'on' : ''}" data-pol="${k}">${k}</button>`).join(' ')}</span></div>`;
    h += `<div class="sub">Pay: pesos, goodwill. Vale: food now, repay in 30 days (default costs honesty). Take: free and fast; fear, grievance, and kin who remember.</div>`;
    openModal(h, true);
    $('mbox').querySelectorAll('[data-b]').forEach((b) => b.onclick = () => { C.buildAtPad(s.blds[+b.dataset.b]); ui.openBase(); });
    $('mbox').querySelectorAll('[data-r]').forEach((b) => b.onclick = () => { C.craft(b.dataset.r); ui.openBase(); });
    $('mbox').querySelectorAll('[data-pol]').forEach((b) => b.onclick = () => { g.policy.forage = b.dataset.pol; ui.openBase(); buildLeft(); });
  };

  // The help screen: how the game works, controls, command system, fog of war.
  // ---------- help ----------
  // (see above)
  ui.openHelp = function () {
    openModal(`<button class="btn sm close">✕</button><h2>? How Cubea works</h2><div class="help">
<p><b>Cubes.</b> Every cube is a person with a name, a family, friends, a job and a memory. <b>Colour = loyalty</b>: blue is Batista's, red is the rebels', white undecided; pale means weakly held. Informers hide their colour until unmasked: read the <i>tells</i> in a person's file, or pay your network to check. (Infiltrators rarely grow a beard.) Green-tinted cubes are camouflaged: peasants blend into jungle, townsfolk into the city, and experience improves both.</p>
<p><b>Faces</b> show hunger, fear, anger, tiredness, hope, pain, and confidence (which grows with combat experience). <b>Cracks</b> are light wounds and heal with food and rest. <b>Missing chunks</b> are serious wounds and never heal; they slow, weaken and bleed.</p>
<p><b>Everything spreads.</b> Kill a soldier and his family, friends and barracks remember; pay a peasant fairly and his kin remember that too. Click anyone to see their family tree, who they lost, and why they feel as they do.</p>
<p><b>Command.</b> Orders are only given while time runs — never when paused. Click a squad (or <b>Ctrl-drag</b> a box, or Shift-click people) to select; the <b>Select…</b> menu picks everyone armed, wounded, veteran, green, women, brave or hotheads. <b>Shift+1–9</b> saves the selection as a group; <b>1–9</b> recalls it. Right-click moves (Shift queues waypoints; on a visible soldier = focus fire). The command bar below has tabs for <b>Move · Fight · Recon · Camp · People</b>: attack, ambush, patrol, retreat, scout, lookout, stalk, hide, dig in, dig a latrine, fetch water, carry supplies, build, rest, treat the wounded, help a peasant, feed livestock, forage. <b>Volunteers</b> asks who will step forward instead of picking someone. <b>Backspace</b> cancels orders.</p>
<p><b>Disobedience.</b> People will say it when you point them at a position that is known to be crushing. If you insist, some will refuse — and a man who thinks he was sent to die leaves, with his family's trust. Leading from the front, especially early in the war, earns the trust that lets you ask more later.</p>
<p><b>Fog of war.</b> Soldiers are hidden unless one of your people can see them (range, light, rain, cover, camouflage). Gunfire you cannot see leaves a ping. <kbd>V</kbd> turns the fog off.</p>
<p><b>Balance.</b> Too soft and your men steal, desert and fail; too severe and you rule by fear, losing the towns, the Church and the Havana money. The winning path is narrow and fair. Rackets and smuggling pay — and turn the band into a business.</p>
<p><b>Hotkeys.</b> WASD move, Shift run, C hide, X weapon, G grenade, R reload, E use, F ambush, V fog of war, Z rest, Space pause, Backspace cancel orders, 1–9 groups, M map, P manifesto, I factions, J journal, B camp, Tab cycle squadmates, N sound.</p>
</div>`);
  };

  // THE END SCREEN: the verdict for the Bay of Pigs (win/loss), or death, collapse or timeout; a ledger of the people's deaths and releases, the coalition (strongest and weakest factions, women and Afro-Cubans), reputation, Washington's ledger and the drift toward a business, and what shaped the run; 'Try again' (same seed, re-rolled landing) and 'Title screen'.
  // ---------- end ----------
  // (see above)
  ui.showEnd = function (kind) {
    const g = G(); const S = g.stats; const R = g.rep; const t = C.factionTable();
    const tyr = R.fear > 45 && R.justice < 45;
    const coal = t.rows.filter((r) => r.mean > 15).length;
    const histScore = (() => { const hist = C.presets.historia.v; let m = 0; hist.forEach((v, k) => { if (g.platform.declared[k] && g.platform.pub[k] === v) m++; }); return m; })();
    let title, body;
    if (kind === 'bop_win' || kind === 'bop_loss') {
      const win = kind === 'bop_win'; const gm = g.gov && g.gov.result ? g.gov.result.m : null;
      title = win ? (tyr ? 'The state holds — by fear' : 'The state holds') : 'The state falls';
      body = win ? 'The exile brigade is beaten at Playa Girón. The revolution survives its first and most important test, and a long standoff with its powerful neighbour begins.' : 'The American-backed invasion succeeds where the old regime failed. What comes after is decided by other people, in other rooms.';
      if (g.merc > 40) body += ' The men who had drifted into protection and smuggling were not the ones who defended the beach.';
    } else if (kind === 'victory') {
      title = tyr ? 'Victory by fear' : coal >= 5 ? 'Victory: a broad coalition' : 'Victory: a narrow one';
      body = tyr ? 'The regime falls. Your men obey because they fear you, and so do the towns.' : coal >= 5 ? 'Peasants, workers, students and much of the middle class stand with you, and the Church is wary but quiet.' : 'You won the war, but large parts of the island remain unconvinced.';
    } else if (kind === 'dead') { title = 'The leader falls'; body = 'The circle with the golden ring is still. History moves on without you.'; }
    else if (kind === 'collapse') { title = 'The movement dissolves'; body = 'Hunger, desertion and isolation have emptied the camp.'; }
    else { title = 'The war drags on'; body = 'By the end of 1960 neither side has won. The island is exhausted.'; }
    const causes = g.events.filter((e) => e.sev >= 50).slice(-6).map((e) => `<li>${esc(e.text)} <span class="sub">(${C.dateStr(e.day)})</span></li>`).join('');
    const strong = t.rows.slice().sort((a, b) => b.mean - a.mean).slice(0, 3).map((r) => r.name).join(', '), weak = t.rows.slice().sort((a, b) => a.mean - b.mean).slice(0, 3).map((r) => r.name).join(', ');
    const h = `<h2>${esc(title)}</h2><div class="lede">${esc(body)}</div>
<div class="grid2"><div class="plank"><b>The people's ledger</b><div class="sub">${C.dateStr(g.day)} · day ${g.day}<br>Soldiers killed ${S.killedArmy} · Civilians killed ${S.killedCiv} · Rebels lost ${S.lostRebels}<br>Released ${S.released} · Executed ${S.executed} · Recruited ${S.hired}</div></div>
<div class="plank"><b>The coalition</b><div class="sub">Strongest: ${esc(strong)}<br>Weakest: ${esc(weak)}<br>Women ${t.women.toFixed(0)} · Afro-Cubans ${t.afro.toFixed(0)}<br>Reputation — fear ${Math.round(R.fear)}, justice ${Math.round(R.justice)}, honesty ${Math.round(R.honesty)}, discipline ${Math.round(R.discipline)}</div></div></div>
${g.us ? `<div class="plank"><b>Washington's ledger</b><div class="sub">American arms shipments to the regime: ${g.us.arms}<br>Strings you accepted: ${g.us.strings} · American interests you crossed: ${g.us.interests}<br>${g.merc ? `Drift toward a business: ${Math.round(g.merc)}/100` : 'You never ran a racket.'}</div></div>` : ''}
<div class="plank"><b>What shaped this run</b><ul class="sub" style="margin:4px 0 0 18px;padding:0">${causes || '<li>A quiet war.</li>'}</ul></div>
<div style="display:flex;gap:8px;margin-top:12px;flex-wrap:wrap"><button class="btn primary big" onclick="location.search='?seed=${g.seed}&name='+encodeURIComponent(localStorage.getItem('cubea_name')||'Fidel Castro')+'&auto=prologue'">Try again</button><button class="btn big" onclick="location.search=''">Title screen</button></div>`;
    g.over = g.over || { kind }; openModal(h, true); $('mbox').querySelector('.close') && ($('mbox').querySelector('.close').style.display = 'none');
  };
})();
