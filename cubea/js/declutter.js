/* CUBEA — declutter.js : A TIDY SCREEN BY DEFAULT.

   • SQUAD PANEL   collapses to a narrow strip: colour dot, name, headcount and a one-word summary of how the group is doing
                   ("3 hungry · 2 tired"). Hover it (or click a squad) and the full panel — stances, bars, policy — opens.
   • COMMAND BAR   appears only while someone is selected; shows one line (who, Select…, Order…, volunteers, cancel); the tabs and
                   order buttons open on hover or while an order is armed. Right-click still moves the selection with the bar closed.
   • LOG           three lines at most, fading after fourteen seconds (the Journal in the notebook keeps the rest).
   Turn it off in Menu → Settings ("Compact interface").
*/
(function () {
  'use strict';
  const C = window.C, G = () => C.G; const $ = (id) => document.getElementById(id);
  const css = document.createElement('style');
  css.textContent = `
#left.compact{width:176px;padding:6px 8px;transition:width .15s}
#left.compact h3,#left.compact .stances,#left.compact > .sub,#left.compact #newgrp,#left.compact .squad .sub{display:none}
#left.compact .squad{padding:3px 4px;margin-bottom:3px}
#left.compact .squad .hd{font-size:12px}
#left.compact .chip{display:block;font-size:10px;opacity:.8;margin-left:14px}
#left.compact:hover,#left.compact:focus-within{width:268px;padding:8px}
#left.compact:hover h3,#left.compact:hover .stances,#left.compact:hover > .sub,#left.compact:hover #newgrp,#left.compact:hover .squad .sub{display:block}
#left:not(.compact) .chip{display:none}
#cmdbar.idle{display:none!important}
#cmdbar.compact:not(:hover):not(.armed) .tabs,#cmdbar.compact:not(:hover):not(.armed) .orders,#cmdbar.compact:not(:hover):not(.armed) .hintline{display:none}
#log div:nth-last-child(n+4){display:none}
@media (max-width:1150px){#log{left:8px!important;right:8px!important;width:auto!important;bottom:62px!important}}`;
  document.head.appendChild(css);
  const on = () => !(C.settings && C.settings.compactUI === false);
  function states() {
    const g = G(); if (!g || !g.squads) return null; const out = {};
    for (const sq of g.squads) { const c = {}; let n = 0; for (const id of sq.members) { const p = C.P(id); if (!p || p.status !== 'alive' || !p.actor || p.actor.scene !== g.scene) continue; n++; const st = C.statesOf ? C.statesOf(p.actor)[0] : null; if (st && st.sev > 0.15 && !st.good) c[st.word] = (c[st.word] || 0) + 1; } out[sq.id] = Object.entries(c).sort((a, b) => b[1] - a[1]).slice(0, 2).map(([w, k]) => `${k} ${w}`).join(' · ') || (n ? 'doing well' : 'empty'); }
    return out;
  }
  setInterval(() => {
    const left = $('left'), bar = $('cmdbar'), g = G(); if (!left || !g) return; const compact = on();
    left.classList.toggle('compact', compact);
    if (bar) { bar.classList.toggle('compact', compact); const sel = C.selIds ? C.selIds().length : 0; bar.classList.toggle('idle', compact && sel < 1 && !(g.cmd && g.cmd.pending)); bar.classList.toggle('armed', !!(g.cmd && g.cmd.pending)); }
    if (compact) { const st = states(); if (st) left.querySelectorAll('.squad').forEach((d) => { let ch = d.querySelector('.chip'); if (!ch) { ch = document.createElement('span'); ch.className = 'chip'; d.querySelector('.hd').appendChild(ch); } ch.textContent = st[d.dataset.sq] || ''; }); }
  }, 600);
})();
