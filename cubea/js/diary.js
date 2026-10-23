/* CUBEA — diary.js : THE DIARY WRITES ITSELF.

   Each new day a short entry is composed from yesterday's log — the best and the worst of it — and stored in g.diary (it is part of
   the save). The Diary page in the notebook reads them back, newest first. Nothing to manage: it is the story of your campaign
   told in the order it happened. Entries are capped at 4 events and 400 days are kept.
   TUNE: numbers in the TUNE block.
*/
(function () {
  'use strict';
  const C = window.C, ui = C.ui, G = () => C.G;
  const TUNE = { perDay: 4, keep: 400, skip: /^(El Viejo|You feel|Hunger)/ };
  C.DIARY_TUNE = TUNE;
  const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const rank = { bad: 3, good: 3, warn: 2, info: 1 };
  /** Called by the daily hook, after g.day has advanced: write the entry for the day that just ended. */
  C.diaryDaily = function () {
    const g = G(); if (!g) return; g.diary = g.diary || []; const d = g.day - 1;
    const ev = g.log.filter((l) => l.day === d && !TUNE.skip.test(l.text)).sort((a, b) => (rank[b.kind] || 1) - (rank[a.kind] || 1)).slice(0, TUNE.perDay).sort((a, b) => a.t - b.t);
    const w = g.weather && g.weather.rain > 0.5 ? 'Rain all day.' : '';
    const place = g.scene ? (g.scene.title || g.scene.name) : '';
    if (!ev.length && !w) return;
    g.diary.push({ day: d, place, w, ev: ev.map((l) => ({ text: l.text, kind: l.kind })) });
    if (g.diary.length > TUNE.keep) g.diary.shift();
  };
  C.openDiary = function () {
    const g = G(), list = (g.diary || []).slice().reverse();
    const h = `<button class="btn sm close">✕</button><h2>📖 Diary</h2><div class="lede">Written by itself each night from what happened that day.</div>` +
      (list.length ? list.slice(0, 60).map((e) => `<div class="plank" style="margin-bottom:8px"><b>${C.dateStr(e.day)}</b> <span class="sub">${esc(e.place || '')} ${esc(e.w || '')}</span>${e.ev.map((x) => `<div class="${x.kind === 'bad' ? 'pos' : ''}">• ${esc(x.text)}</div>`).join('')}</div>`).join('') : '<div class="sub">The first page is still blank. Come back after the first night.</div>');
    g.modalOpen = true; document.getElementById('mbox').innerHTML = h; document.getElementById('modal').style.display = 'flex';
    const x = document.querySelector('#mbox .close'); if (x) x.onclick = ui.closeModal;
  };
  if (C.nbTabs) { const i = C.nbTabs.findIndex((t) => t.id === 'help'); C.nbTabs.splice(i < 0 ? C.nbTabs.length : i, 0, { id: 'diary', n: 'Diary', k: 'tab', open: () => C.openDiary() }); }
})();
