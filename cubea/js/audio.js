/* CUBEA — audio.js : tiny WebAudio synth for gunfire, blasts, hits. No asset files. Toggle with N. */
(function () {
  'use strict';
  const C = (window.C = window.C || {});
  let ctx = null, master = null, noiseBuf = null, on = true, last = {};
  function init() {
    if (ctx) return; try {
      ctx = new (window.AudioContext || window.webkitAudioContext)(); master = ctx.createGain(); master.gain.value = 0.35; master.connect(ctx.destination);
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate); const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    } catch (e) { ctx = null; }
  }
  function vol(x, y) { const g = C.G; if (!g || !g.player) return 1; const d = Math.hypot(g.player.x - x, g.player.y - y); return Math.max(0, 1 - d / 650); }
  function noise(dur, f0, f1, v, type, q) {
    if (!ctx || !on || v <= 0.01) return; const t = ctx.currentTime; const src = ctx.createBufferSource(); src.buffer = noiseBuf; src.loop = true;
    const fl = ctx.createBiquadFilter(); fl.type = type || 'lowpass'; fl.frequency.setValueAtTime(f0, t); fl.frequency.exponentialRampToValueAtTime(Math.max(40, f1), t + dur); if (q) fl.Q.value = q;
    const g = ctx.createGain(); g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(fl); fl.connect(g); g.connect(master); src.start(t, Math.random()); src.stop(t + dur + 0.05);
  }
  function tone(f0, f1, dur, v, type) {
    if (!ctx || !on || v <= 0.01) return; const t = ctx.currentTime; const o = ctx.createOscillator(); o.type = type || 'sine'; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    const g = ctx.createGain(); g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur); o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.05);
  }
  function throttle(k, ms) { const n = performance.now(); if (last[k] && n - last[k] < ms) return false; last[k] = n; return true; }
  C.snd = {
    init, toggle() { on = !on; return on; },
    shot(kind, x, y) { if (!ctx) return; const v = vol(x, y); if (!throttle('s' + kind + (x | 0 >> 5), 28)) return; if (kind === 1) noise(0.11, 3200, 600, 0.55 * v, 'bandpass', 0.7); else if (kind === 3) noise(0.16, 2400, 300, 0.7 * v, 'lowpass'); else noise(0.2, 2000, 220, 0.8 * v, 'lowpass'); tone(160, 60, 0.07, 0.25 * v, 'square'); },
    hit(x, y) { if (!ctx) return; const v = vol(x, y); if (!throttle('h', 40)) return; noise(0.08, 900, 200, 0.5 * v, 'lowpass'); tone(110, 50, 0.1, 0.3 * v, 'triangle'); },
    death(x, y) { if (!ctx) return; const v = vol(x, y); tone(190, 60, 0.35, 0.22 * v, 'sawtooth'); },
    boom(x, y, rad) { if (!ctx) return; const v = vol(x, y) * Math.min(1.3, 0.5 + rad / 90); noise(1.1, 1600, 70, 1.0 * v, 'lowpass'); tone(95, 28, 0.9, 0.7 * v, 'sine'); },
    whistle(x, y) { if (!ctx) return; const v = vol(x, y) + 0.2; tone(1300, 320, 1.15, 0.12 * Math.min(1, v), 'sine'); },
    plane() { if (!ctx) return; tone(70, 56, 4.8, 0.2, 'sawtooth'); noise(4.8, 500, 280, 0.12, 'bandpass', 0.5); },
    click() { if (!ctx) return; tone(520, 380, 0.05, 0.08, 'triangle'); },
    chime() { if (!ctx) return; tone(660, 880, 0.25, 0.09, 'sine'); },
  };
  window.addEventListener('keydown', (e) => { if (e.key === 'n' || e.key === 'N') { const o = C.snd.toggle(); if (C.ui && C.ui.toast) C.ui.toast(o ? 'Sound on' : 'Sound off'); } });
})();
