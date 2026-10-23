/* CUBEA — devlens.js : F3 DEVELOPER OVERLAY.

   F3 toggles a small text panel: frame time, actor/thing counts, game clock and minute-rate, the hovered actor's raw state
   (hp, body, mind, task, path length) and the camp exposure. Nothing here changes the simulation; it only reads.
*/
(function () {
  'use strict';
  const C = window.C;
  const el = document.createElement('pre');
  el.id = 'devlens'; el.style.cssText = 'position:fixed;right:8px;bottom:8px;z-index:30;margin:0;padding:6px 8px;font:11px/1.35 monospace;background:rgba(0,0,0,.72);color:#9fe9a0;border-radius:6px;pointer-events:none;display:none;max-width:44vw;white-space:pre-wrap';
  document.body.appendChild(el);
  let on = false, last = performance.now(), ft = 16, iv = null;
  const tick = () => { const n = performance.now(); ft += (n - last - ft) * 0.1; last = n; requestAnimationFrame(tick); };
  requestAnimationFrame(tick);
  C.devText = function () {
    const g = C.G; if (!g || !g.scene) return 'no game';
    const s = g.scene, lines = [`${(1000 / Math.max(1, ft)).toFixed(0)} fps (${ft.toFixed(1)} ms) · ${s.sid} · actors ${s.actors.length} · things ${(s.things || []).length}`,
      `day ${g.day} h${g.hour.toFixed(1)} · minPerSec ${g.minPerSec} · wait x${C.waitMul ? C.waitMul() : 1} · paused ${!!g.paused}`];
    if (C.campExposure) lines.push('camp exposure ' + C.campExposure(s) + '%');
    const h = g.hover;
    if (h) { const p = h.p; lines.push(`${C.tagName(p)} hp ${Math.round(h.hp)} side ${h.side} task ${h.task ? h.task.t || h.task.id || 'yes' : '-'} path ${h.path ? h.path.length : 0}`, 'body ' + JSON.stringify(p.body || {}).slice(0, 140), 'mind ' + JSON.stringify(p.mind || {}).slice(0, 140)); }
    return lines.join('\n');
  };
  C.toggleDev = function (v) { on = v === undefined ? !on : v; el.style.display = on ? 'block' : 'none'; clearInterval(iv); if (on) iv = setInterval(() => { el.textContent = C.devText(); }, 250); };
  window.addEventListener('keydown', (e) => { if (e.key === 'F3') { e.preventDefault(); C.toggleDev(); } });
})();
