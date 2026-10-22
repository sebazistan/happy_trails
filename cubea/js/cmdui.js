// Command bar: selection summary, filters, volunteer toggle and the tabbed order buttons.
(function () {
  const C = window.C, G = () => C.G; const ui = C.ui;
  const css = document.createElement('style');
  css.textContent = `#cmdbar{position:fixed;left:284px;bottom:8px;width:430px;padding:7px 8px;z-index:4;display:none}
#cmdbar .row{display:flex;gap:5px;align-items:center;flex-wrap:wrap;margin-bottom:5px}
#cmdbar .tabs .btn{flex:1}
#cmdbar .btn.on{outline:1px solid var(--gold);background:rgba(230,184,78,.22)}
#cmdbar .orders{display:grid;grid-template-columns:repeat(4,1fr);gap:4px}
#cmdbar .orders .btn{font-size:11px;padding:4px 3px}
#cmdbar select{background:rgba(255,255,255,.08);color:inherit;border:1px solid var(--line);border-radius:5px;font-size:11px;padding:2px}
#cmdbar .hintline{font-size:11px;color:var(--mute);min-height:14px;margin-top:4px}
#cmdbar .danger-deadly{color:#ff7a6a}#cmdbar .danger-risky{color:#ffc27a}
#log{left:max(34vw,724px)!important;width:min(520px,calc(100vw - 724px - 250px))!important}`;
  document.head.appendChild(css);
  const bar = document.createElement('div'); bar.id = 'cmdbar'; bar.className = 'panel'; document.body.appendChild(bar);

  let built = false, lastTab = null, lastLayer = -1;
  function build() {
    const g = G(); const cmd = g.cmd; let h = '';
    h += `<div class="row"><b>Selected <span id="selN">0</span></b><span class="sub" id="selNames" style="flex:1;overflow:hidden;white-space:nowrap;text-overflow:ellipsis"></span></div>`;
    h += `<div class="row"><select id="selFilter"><option value="">Select…</option>${Object.keys(C.FILTERS).map((k) => `<option value="${k}">${C.FILTERS[k][0]}</option>`).join('')}</select>`;
    h += `<select id="selSort"><option value="">Order…</option><option value="exp">By experience</option><option value="hp">By health</option></select>`;
    h += `<button class="btn sm" id="volBtn" title="Ask for volunteers instead of ordering people">Volunteers: off</button><button class="btn sm" id="stopBtn" title="Backspace">Cancel orders</button></div>`;
    h += `<div class="row tabs">${C.ORDER_TABS.map(([k, n]) => `<button class="btn sm" data-tab="${k}">${n}</button>`).join('')}</div>`;
    h += `<div class="orders" id="ordBtns"></div><div class="hintline" id="cmdHint"></div>`;
    bar.innerHTML = h; built = true;
    const sf = bar.querySelector('#selFilter'), ss = bar.querySelector('#selSort');
    sf.onchange = () => { if (sf.value) C.selectBy(sf.value, ss.value || null); sf.value = ''; ss.value = ''; };
    bar.querySelector('#volBtn').onclick = () => { const seq = [0, 1, 2, 3, 5]; const g2 = G(); g2.cmd.vol = seq[(seq.indexOf(g2.cmd.vol) + 1) % seq.length]; refresh(); };
    bar.querySelector('#stopBtn').onclick = () => C.stopOrders();
    bar.querySelectorAll('[data-tab]').forEach((b) => b.onclick = () => { G().cmd.tab = b.dataset.tab; refresh(); });
  }
  function orderButtons() {
    const g = G(); const tab = g.cmd.tab; const el = bar.querySelector('#ordBtns'); let h = '';
    for (const k in C.ORDERS) { const d = C.ORDERS[k]; if (d.tab !== tab) continue; h += `<button class="btn sm ${g.cmd.pending && g.cmd.pending.type === k ? 'on' : ''}" data-ord="${k}" title="${d.d.replace(/"/g, '&quot;')}">${d.n}</button>`; }
    el.innerHTML = h; el.querySelectorAll('[data-ord]').forEach((b) => b.onclick = () => C.cmdArm(b.dataset.ord));
    lastTab = tab;
  }
  function refresh() {
    const g = G(); if (!g || !g.scene || g.over) { bar.style.display = 'none'; return; }
    if (!document.getElementById('left') || document.getElementById('left').style.display === 'none') { bar.style.display = 'none'; return; }
    bar.style.display = 'block';
    if (!built) build();
    if (lastTab !== g.cmd.tab || bar.querySelector('[data-ord]') === null || true) orderButtons();
    bar.querySelectorAll('[data-tab]').forEach((b) => b.classList.toggle('on', b.dataset.tab === g.cmd.tab));
    const ids = C.selIds(); bar.querySelector('#selN').textContent = ids.length;
    bar.querySelector('#selNames').textContent = ids.slice(0, 5).map((id) => C.tagName(C.P(id))).join(', ') + (ids.length > 5 ? ` +${ids.length - 5}` : '');
    bar.querySelector('#volBtn').textContent = 'Volunteers: ' + (g.cmd.vol ? g.cmd.vol : 'off');
    bar.querySelector('#volBtn').classList.toggle('on', g.cmd.vol > 0);
  }
  ui.refreshCmd = refresh;

  // live hint: what the order under the cursor would risk
  setInterval(() => {
    const g = G(); if (!g || !g.scene || g.over) return;
    if (bar.style.display === 'none') { refresh(); return; }
    const hint = bar.querySelector('#cmdHint'); if (!hint) return;
    const p = g.cmd.pending; let t = '';
    if (g.paused) t = 'Orders are locked while paused.';
    else if (p && C.ORDERS[p.type].need === 'point') {
      const acts = C.selActors(); const dg = C.orderDanger(acts, { type: p.type, x: C.mouse.wx, y: C.mouse.wy });
      t = `<span class="danger-${dg.level}">${dg.level === 'ok' ? 'No known enemy there.' : dg.level === 'risky' ? `Risky: ${dg.foes} known soldiers near.` : `DEADLY: ${dg.foes} known soldiers near. They will say so.`}</span>`;
    } else if (p) t = C.ORDERS[p.type].d;
    else t = (g.opts.fog ? 'Fog of war on (V). ' : '') + 'RMB moves the selection. Ctrl-drag selects.';
    hint.innerHTML = t;
    bar.querySelector('#selN').textContent = C.selIds().length;
  }, 350);
  const iv = setInterval(() => { const g = G(); if (g && g.scene && !g.over && !built) refresh(); }, 600); void iv;
  window.addEventListener('keydown', () => setTimeout(refresh, 0));
})();
