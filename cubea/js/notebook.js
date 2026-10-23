/* CUBEA — notebook.js : ONE NOTEBOOK INSTEAD OF A ROW OF BUTTONS.

   The top bar used to carry six buttons (Map, Manifesto, Factions, Journal, Camp, Help) and the game had separate hotkeys for them
   plus floating panels for Actions (K) and Creed (Y). Now there is one 📓 Notebook: a tab strip along the top of whichever page is
   open — Journal · Map · Manifesto · Factions · Camp · Actions · Creed · Help · Menu — and the old hotkeys (J, M, P, I, B, H, K, Y)
   still open the matching tab. The notebook remembers the last page you had open. Nothing else in the top bar but the clock,
   the resources and the notebook and gear buttons.
   (The Actions and Creed pages are live overlays by design — you want them open while you work — so their tabs toggle those panels.)
*/
(function () {
  'use strict';
  const C = window.C, ui = C.ui, G = () => C.G; const $ = (id) => document.getElementById(id);
  const LS = { get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }, set(k, v) { try { localStorage.setItem(k, v); } catch (e) { } } };
  const css = document.createElement('style');
  css.textContent = `
#bMap,#bMan,#bFac,#bJour,#bBase,#bHelp{display:none!important}
#bNote{font-weight:600}
.nbtabs{display:flex;gap:4px;flex-wrap:wrap;margin:-4px 34px 10px 0;padding-bottom:7px;border-bottom:1px solid var(--line,rgba(255,255,255,.14))}
.nbtabs button{font:inherit;font-size:12px;padding:3px 10px;border-radius:999px;border:1px solid var(--line,rgba(255,255,255,.18));background:rgba(255,255,255,.05);color:inherit;cursor:pointer}
.nbtabs button:hover{border-color:var(--gold,#e8c36a)}
.nbtabs button.on{background:rgba(232,195,106,.22);border-color:var(--gold,#e8c36a);font-weight:600}`;
  document.head.appendChild(css);

  // tab → how to open it, and the key that used to
  const TABS = [
    { id: 'journal', n: 'Journal', k: 'J', open: (a) => orig.journal(a) },
    { id: 'map', n: 'Map', k: 'M', open: () => orig.map() },
    { id: 'manifesto', n: 'Manifesto', k: 'P', open: () => orig.manifesto() },
    { id: 'factions', n: 'Factions', k: 'I', open: () => orig.factions() },
    { id: 'camp', n: 'Camp', k: 'B', open: () => orig.base() },
    { id: 'actions', n: 'Actions', k: 'K', panel: 'actions' },
    { id: 'creed', n: 'Creed', k: 'Y', panel: 'creed' },
    { id: 'help', n: 'Help', k: 'H', open: () => orig.help() },
    { id: 'menu', n: 'Menu', k: 'Esc', menu: true },
  ];
  const orig = { journal: ui.openJournal, map: ui.openMap, manifesto: ui.openManifesto, factions: ui.openFactions, base: ui.openBase, help: ui.openHelp };
  let current = LS.get('cubea_nb') || 'journal';

  /** Put the tab strip at the top of the open modal. */
  function decorate(id) {
    const box = $('mbox'); if (!box) return; current = id; LS.set('cubea_nb', id);
    const old = box.querySelector('.nbtabs'); if (old) old.remove();
    const bar = document.createElement('div'); bar.className = 'nbtabs';
    bar.innerHTML = TABS.map((t) => `<button data-t="${t.id}" class="${t.id === id ? 'on' : ''}" title="${t.k}">${t.n}</button>`).join('');
    box.insertBefore(bar, box.firstChild.nextSibling && box.firstChild.classList && box.firstChild.classList.contains('close') ? box.firstChild.nextSibling : box.firstChild);
    bar.querySelectorAll('button').forEach((b) => b.onclick = () => openTab(b.dataset.t));
  }
  function openTab(id, arg) {
    const t = TABS.find((x) => x.id === id) || TABS[0];
    if (t.menu) { ui.closeModal(); if (C.openPause) C.openPause(); return; }
    if (t.panel) { ui.closeModal(); const key = t.k.toLowerCase(); if (t.id === 'actions' && C.toggleActions) C.toggleActions(); else if (t.id === 'creed' && C.openCreed) C.openCreed(); else window.dispatchEvent(new KeyboardEvent('keydown', { key })); return; }
    t.open(arg); decorate(t.id);
  }
  // the old entry points now go through the notebook
  ui.openJournal = (tab) => { orig.journal(tab); decorate('journal'); };
  ui.openMap = (dest) => { orig.map(dest); decorate('map'); };
  ui.openManifesto = () => { orig.manifesto(); decorate('manifesto'); };
  ui.openFactions = () => { orig.factions(); decorate('factions'); };
  ui.openBase = () => { orig.base(); decorate('camp'); };
  ui.openHelp = () => { orig.help(); decorate('help'); };
  C.openNotebook = (tab) => openTab(tab || current);
  // when a page redraws itself (a button inside it re-opens it), the strip must come back
  new MutationObserver(() => { const box = $('mbox'); if (box && $('modal').style.display !== 'none' && box.firstChild && !box.querySelector('.nbtabs') && /Camp|Journal|Manifesto|island|Who is with you|How Cubea/.test(box.textContent.slice(0, 80))) { /* page re-rendered by itself */ const id = /Camp & workshop/.test(box.textContent.slice(0, 60)) ? 'camp' : /Manifesto/.test(box.textContent.slice(0, 40)) ? 'manifesto' : /Who is with you/.test(box.textContent.slice(0, 40)) ? 'factions' : /island/.test(box.textContent.slice(0, 40)) ? 'map' : /How Cubea/.test(box.textContent.slice(0, 40)) ? 'help' : current; decorate(id); } }).observe($('mbox'), { childList: true });
  // one button on the top bar
  window.addEventListener('load', () => { const row = $('bMap') && $('bMap').parentNode; if (row && !$('bNote')) { const b = document.createElement('button'); b.className = 'btn sm'; b.id = 'bNote'; b.title = 'Notebook (J)'; b.textContent = '📓 Notebook'; b.onclick = () => openTab(current); row.insertBefore(b, row.firstChild); } });
})();
