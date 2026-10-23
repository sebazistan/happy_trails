/* CUBEA — situations.js : EVENTS HAPPEN IN REAL TIME, NOT IN A DIALOG.

   Every event that used to stop the game with a card ("Man overboard — Turn back? / Press on?") is now a SITUATION: a banner at the
   top of the screen with a headline, one line of what is happening, and a small hint line with the possible responses. The game does
   not pause. You answer by pressing the number key (or clicking a hint), or by doing something in the world; if you do nothing the
   situation resolves itself with its passive option when the timer bar runs out ("no answer = press on").
   • A card with several choices becomes a situation with a timer (30 s of play, `secs` on the card overrides).
   • A card with one choice ("Carry on") is just a notice: it fades after a few seconds and its single outcome applies.
   • Big story beats stay as full pages: the prologue, Havana, 1961, the end of the regime, victory/defeat (MODAL below).
   • The speed drops to normal when a situation appears; further situations queue behind the one on screen.
   • Playwright test runs (navigator.webdriver) keep the old blocking cards so the older harnesses still click them; tests of this
     module set C.ui.liveCards = true.
   TUNE: numbers in the TUNE block.
*/
(function () {
  'use strict';
  const C = window.C, ui = C.ui, G = () => C.G; const $ = (id) => document.getElementById(id);
  const TUNE = { secs: 30, noticeSecs: 9, maxSentence: 150, maxChip: 34 };
  const MODAL = /Havana|April 1961|Playa Gir|regime collapses|victory|defeat|The Granma|Alegr[ií]a de P|Nobody steps forward|death sentence/i;
  C.SITUATION_TUNE = TUNE;
  ui.liveCards = !navigator.webdriver;
  const orig = ui.card;
  const css = document.createElement('style');
  css.textContent = `
#sit{position:fixed;left:50%;top:100px;transform:translateX(-50%);width:min(580px,calc(100vw - 24px));z-index:8;padding:10px 14px 12px;display:none;overflow:hidden}
#sit h3{margin:0 0 2px;font-size:19px;line-height:1.15}
#sit .what{font-size:13px;line-height:1.35;margin:0 0 7px;color:var(--ink)}
#sit .hint{display:flex;flex-wrap:wrap;gap:6px;font-size:11.5px;color:var(--mute)}
#sit .hint button{font:inherit;font-size:11.5px;color:var(--ink);background:rgba(255,255,255,.08);border:1px solid var(--line);border-radius:999px;padding:2px 9px;cursor:pointer}
#sit .hint button:hover,#sit .hint button:focus-visible{border-color:var(--gold);background:rgba(230,184,78,.18)}
#sit .hint button.dis{opacity:.4;cursor:default}
#sit kbd{font:inherit;font-weight:700;color:var(--gold);margin-right:4px}
#sit .def{font-size:10.5px;color:var(--mute);margin-top:5px}
#sit .sub{font-size:10.5px;color:var(--mute);margin-top:4px;min-height:1.3em}
#sit .bar{position:absolute;left:0;bottom:0;height:3px;background:var(--gold);width:100%}
#sit .more{position:absolute;right:12px;top:8px;font-size:10.5px;color:var(--mute)}
#sit.notice h3{font-size:16px}
@media (max-width:700px){#sit{top:auto;bottom:128px}}`;
  document.head.appendChild(css);
  let el = null, cur = null; const queue = [];
  const first = (t) => { const s = String(t || '').replace(/\s+/g, ' ').trim(); const m = s.match(/^.*?[.!?](?=\s|$)/); let o = m ? m[0] : s; if (o.length > TUNE.maxSentence) o = o.slice(0, TUNE.maxSentence - 1).replace(/\s+\S*$/, '') + '…'; return o; };
  const chip = (l) => { let s = String(l).replace(/\(.*?\)/g, '').split(/ — |: |, | - /)[0].trim(); if (s.length > TUNE.maxChip) s = s.slice(0, TUNE.maxChip - 1).replace(/\s+\S*$/, '') + '…'; return s; };
  const passive = (c) => { if (c.def !== undefined) return c.def; const re = /ignore|let |press on|hold|carry on|keep|wait|nothing|stay|do not|don't/i; for (let i = c.choices.length - 1; i >= 0; i--) if (re.test(c.choices[i].label) && !c.choices[i].disabled) return i; for (let i = c.choices.length - 1; i >= 0; i--) if (!c.choices[i].disabled) return i; return 0; };
  const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  function show(c) {
    const g = G(); if (!el) { el = document.createElement('div'); el.id = 'sit'; el.className = 'panel'; document.body.appendChild(el); }
    const notice = c.choices.length <= 1; const secs = c.secs || (notice ? TUNE.noticeSecs : TUNE.secs); const def = notice ? 0 : passive(c);
    cur = { c, left: secs, secs, def, notice }; g.pendingCard = c;
    const what = c.headline !== undefined ? c.headline : first(c.body);
    el.className = 'panel' + (notice ? ' notice' : '');
    el.innerHTML = `<h3>${c.icon ? c.icon + ' ' : ''}${esc(c.title)}</h3>${what ? `<div class="what">${esc(what)}</div>` : ''}` +
      (notice ? '' : `<div class="hint">${c.choices.map((ch, i) => `<button data-i="${i}" class="${ch.disabled ? 'dis' : ''}" title="${esc((ch.label || '') + (ch.sub ? ' — ' + ch.sub : ''))}"><kbd>${i + 1}</kbd>${esc(chip(ch.label))}</button>`).join('')}</div><div class="sub"></div><div class="def">no answer: ${esc(chip(c.choices[def].label))}</div>`) +
      (queue.length ? `<div class="more">+${queue.length} more</div>` : '') + `<div class="bar"></div>`;
    el.style.display = 'block';
    el.querySelectorAll('.hint button').forEach((b) => { b.onclick = () => choose(+b.dataset.i); const ch = c.choices[+b.dataset.i]; b.onmouseenter = b.onfocus = () => { el.querySelector('.sub').textContent = ch.sub || ch.label || ''; }; b.onmouseleave = () => { el.querySelector('.sub').textContent = ''; }; });
    if (g.speed > 1) { g.speed = 1; if (ui.syncSpeed) ui.syncSpeed(); }
    if (C.snd && C.snd.chime) C.snd.chime();
    C.log(`${c.title}${what ? ' — ' + what : ''}`, 'warn');
  }
  function finish(i, timedOut) {
    const g = G(), c = cur && cur.c; if (!cur) return; cur = null; el.style.display = 'none'; g.pendingCard = null;
    const ch = c.choices[i]; if (timedOut && c.choices.length > 1) C.log(`You say nothing: ${chip(ch.label).toLowerCase()}.`, 'info');
    try { ch && !ch.disabled && ch.fn && ch.fn(); } catch (e) { console.error(e); }
    if (ui.update) ui.update(true);
    if (queue.length && !g.modalOpen) show(queue.shift());
  }
  function choose(i) { if (!cur) return; const ch = cur.c.choices[i]; if (!ch || ch.disabled) return; finish(i, false); }
  C.situation = { choose, get active() { return cur; }, queue };
  ui.card = function (c) {
    if (!ui.liveCards || !c.choices || MODAL.test(c.title || '') || c.modal) return orig.call(this, c);
    if (c.onShow) { try { c.onShow(); } catch (e) { console.error(e); } c.onShow = null; }
    if (cur || G().modalOpen) { queue.push(c); return; }
    show(c);
  };
  setInterval(() => {
    const g = G(); if (!cur || !g || g.paused || g.modalOpen || g.over) return;
    cur.left -= 0.2; const b = el.querySelector('.bar'); if (b) b.style.width = Math.max(0, cur.left / cur.secs * 100) + '%';
    if (cur.left <= 0) finish(cur.def, true);
  }, 200);
  // number keys answer the live situation (capture phase: these keys otherwise recall control groups)
  window.addEventListener('keydown', (e) => {
    if (!cur || cur.notice || e.ctrlKey || e.altKey || e.metaKey || e.shiftKey) return; if (e.target && ['INPUT', 'SELECT', 'TEXTAREA'].includes(e.target.tagName)) return;
    const n = +e.key; if (n >= 1 && n <= cur.c.choices.length) { e.preventDefault(); e.stopImmediatePropagation(); choose(n - 1); }
  }, true);
})();
