/* CUBEA — guide.js : EL VIEJO SHOWS YOU THE FIRST TWENTY MINUTES.

   No tutorial screens. A new game begins with El Viejo speaking one short line at a time, each waiting for you to do the thing he
   just said: walk, press Q beside something, do a verb, hold L for a lens, open the notebook (J). Five steps, then he stops for good.
   F2 skips the lot. It never runs when a game is loaded, when the URL has ?auto=, or after it has been finished once on this browser
   (localStorage 'cubea_guided').
*/
(function () {
  'use strict';
  const C = window.C, G = () => C.G;
  const LS = { get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }, set(k, v) { try { localStorage.setItem(k, v); } catch (e) { } } };
  const seen = { wheel: false, verb: false };
  const STEPS = [
    { say: 'Compay, first learn to walk. Right-click the ground and go somewhere.', ok: (g, st) => Math.hypot(g.player.x - st.x, g.player.y - st.y) > 140 },
    { say: 'Stand close to something — a fire, a person, a tree — and press Q. The wheel shows what your hands can do with it.', ok: () => seen.wheel },
    { say: 'Choose something from the wheel. Doing is how you give orders in this war.', ok: () => seen.verb },
    { say: 'Now hold L. That is how you see what the enemy would see, and what carries sound and smoke.', ok: () => C.lens && C.lens.on },
    { say: 'Last: press J to open your notebook. Everything you need to remember is written there.', ok: () => { const m = document.getElementById('modal'); return m && m.style.display !== 'none' && document.querySelector('#mbox .nbtabs'); } },
  ];
  C.guide = { i: -1, off: true };
  function wrap() {
    const ow = C.openWheel; if (ow) C.openWheel = function () { seen.wheel = true; return ow.apply(this, arguments); };
    const od = C.doVerb; if (od) C.doVerb = function () { seen.verb = true; return od.apply(this, arguments); };
  }
  function say(t) { if (C.ui && C.ui.viejoToast) C.ui.viejoToast(t); }
  let st = null, timer = null;
  C.startGuide = function (force) {
    if (!force && (LS.get('cubea_guided') === '1' || /[?&]auto=/.test(location.search))) return;
    const g = G(); if (!g || !g.player || (!force && g.day > 2)) return; wrap(); C.guide.off = false; C.guide.i = 0; st = { x: g.player.x, y: g.player.y }; seen.wheel = seen.verb = false;
    setTimeout(() => say(STEPS[0].say), 2500);
    timer = setInterval(() => {
      const gg = G(); if (!gg || C.guide.off) return clearInterval(timer);
      if (STEPS[C.guide.i].ok(gg, st)) { C.guide.i++; if (C.guide.i >= STEPS.length) { say('Good. The rest you will learn the way I did — badly. Suerte, hijo.'); C.endGuide(); } else setTimeout(() => say(STEPS[C.guide.i].say), 1500); }
    }, 700);
  };
  C.endGuide = function () { C.guide.off = true; clearInterval(timer); LS.set('cubea_guided', '1'); };
  window.addEventListener('keydown', (e) => { if (e.key === 'F2' && !C.guide.off) { C.endGuide(); say('As you wish. Remember: J is the notebook.'); } });
})();
