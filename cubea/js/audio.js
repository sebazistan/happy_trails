/* CUBEA — audio.js : tiny WebAudio synth for gunfire, blasts, hits. No asset files. Toggle with N. */
(function () {
  'use strict';
  const C = (window.C = window.C || {});
  // AUDIO STATE: the WebAudio context (created on first user input, as browsers require), a master gain, a one-second buffer of white noise reused for every sound, an on/off flag and a throttle table.
  let vol0 = 0.35, ctx = null, master = null, noiseBuf = null, on = true, last = {};
  // Create the audio context lazily; failure (no audio support) silently disables sound.
  function init() {
    if (ctx) return; try {
      ctx = new (window.AudioContext || window.webkitAudioContext)(); master = ctx.createGain(); master.gain.value = vol0; master.connect(ctx.destination);
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate); const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    } catch (e) { ctx = null; }
  }
  // Distance attenuation: 1 at the player, 0 at 650 px.
  function vol(x, y) { const g = C.G; if (!g || !g.player) return 1; const d = Math.hypot(g.player.x - x, g.player.y - y); return Math.max(0, 1 - d / 650); }
  // Play filtered white noise (a gunshot's crack, an explosion's rumble) with a frequency sweep and an exponential decay.
  function noise(dur, f0, f1, v, type, q) {
    if (!ctx || !on || v <= 0.01) return; const t = ctx.currentTime; const src = ctx.createBufferSource(); src.buffer = noiseBuf; src.loop = true;
    const fl = ctx.createBiquadFilter(); fl.type = type || 'lowpass'; fl.frequency.setValueAtTime(f0, t); fl.frequency.exponentialRampToValueAtTime(Math.max(40, f1), t + dur); if (q) fl.Q.value = q;
    const g = ctx.createGain(); g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(fl); fl.connect(g); g.connect(master); src.start(t, Math.random()); src.stop(t + dur + 0.05);
  }
  // Play a pitched sweep (a body thud, a falling whistle, a plane's drone).
  function tone(f0, f1, dur, v, type) {
    if (!ctx || !on || v <= 0.01) return; const t = ctx.currentTime; const o = ctx.createOscillator(); o.type = type || 'sine'; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    const g = ctx.createGain(); g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur); o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.05);
  }
  // Limit how often a sound may play (so a machine gun does not create hundreds of voices).
  function throttle(k, ms) { const n = performance.now(); if (last[k] && n - last[k] < ms) return false; last[k] = n; return true; }
  // The sound API used by combat and the UI: shot(kind,x,y) by loudness class, hit, death, boom (scaled by blast radius), whistle (incoming shell/bomb), plane, click, chime; toggle() for the N key. No audio files — everything is synthesised.
  C.snd = {
    init, toggle() { on = !on; return on; }, setVolume(v) { vol0 = v; if (master) master.gain.value = v; },
    shot(kind, x, y) { if (!ctx) return; const v = vol(x, y); if (!throttle('s' + kind + (x | 0 >> 5), 28)) return; if (kind === 1) noise(0.11, 3200, 600, 0.55 * v, 'bandpass', 0.7); else if (kind === 3) noise(0.16, 2400, 300, 0.7 * v, 'lowpass'); else noise(0.2, 2000, 220, 0.8 * v, 'lowpass'); tone(160, 60, 0.07, 0.25 * v, 'square'); },
    hit(x, y) { if (!ctx) return; const v = vol(x, y); if (!throttle('h', 40)) return; noise(0.08, 900, 200, 0.5 * v, 'lowpass'); tone(110, 50, 0.1, 0.3 * v, 'triangle'); },
    death(x, y) { if (!ctx) return; const v = vol(x, y); tone(190, 60, 0.35, 0.22 * v, 'sawtooth'); },
    boom(x, y, rad) { if (!ctx) return; const v = vol(x, y) * Math.min(1.3, 0.5 + rad / 90); noise(1.1, 1600, 70, 1.0 * v, 'lowpass'); tone(95, 28, 0.9, 0.7 * v, 'sine'); },
    whistle(x, y) { if (!ctx) return; const v = vol(x, y) + 0.2; tone(1300, 320, 1.15, 0.12 * Math.min(1, v), 'sine'); },
    plane() { if (!ctx) return; tone(70, 56, 4.8, 0.2, 'sawtooth'); noise(4.8, 500, 280, 0.12, 'bandpass', 0.5); },
    click() { if (!ctx) return; tone(520, 380, 0.05, 0.08, 'triangle'); },
    chime() { if (!ctx) return; tone(660, 880, 0.25, 0.09, 'sine'); },
  };
  // ---------------------------------------------------------------------------------------------------------------------
  // AMBIENCE AND MUSIC: crickets at night, cicadas and birds by day, rain and wind that follow the weather, the sea, a crackling fire
  // near you, your engine, the radio on the air, and the guitar. All procedural; all quiet; all gated by the same volume and N key.
  // ---------------------------------------------------------------------------------------------------------------------
  const amb = { t: 0, next: { cric: 0, cic: 0, bird: 0, fire: 0, wave: 0, radio: 0 }, rain: null, wind: null, eng: null };
  function loopNoise(freq, q, type) { const src = ctx.createBufferSource(); src.buffer = noiseBuf; src.loop = true; const fl = ctx.createBiquadFilter(); fl.type = type || 'bandpass'; fl.frequency.value = freq; fl.Q.value = q || 0.6; const g = ctx.createGain(); g.gain.value = 0; src.connect(fl); fl.connect(g); g.connect(master); src.start(); return g; }
  C.snd.ambient = function (dt) {
    const gm = C.G; if (!ctx || !gm || !gm.scene || !gm.player) return; amb.t += dt; const s = gm.scene, h = gm.hour, wet = gm.weather ? gm.weather.rain : 0, wind = gm.clim ? gm.clim.wind : 0.2, night = h < 5.5 || h >= 19, forest = s.type === 'sierra' || s.type === 'road' || s.type === 'cane' || s.type === 'village' || s.type === 'fishing';
    if (!amb.rain) { amb.rain = loopNoise(2200, 0.5); amb.wind = loopNoise(260, 0.4, 'lowpass'); }
    const want = on ? 1 : 0; amb.rain.gain.setTargetAtTime(want * wet * 0.11, ctx.currentTime, 0.6); amb.wind.gain.setTargetAtTime(want * (0.015 + wind * 0.06), ctx.currentTime, 0.8);
    if (!on) return; const now = amb.t;
    if (forest && night && now > amb.next.cric) { amb.next.cric = now + 0.5 + Math.random() * 0.4; for (let i = 0; i < 3; i++) setTimeout(() => tone(4300 + Math.random() * 200, 4150, 0.045, 0.012, 'sine'), i * 70); }
    if (forest && !night && h > 7 && h < 17.5 && wet < 0.3 && now > amb.next.cic) { amb.next.cic = now + 3 + Math.random() * 4; noise(2.2, 6200, 5200, 0.012, 'bandpass', 9); }
    if (forest && !night && h > 5.5 && h < 18.5 && wet < 0.4 && now > amb.next.bird) { amb.next.bird = now + 3 + Math.random() * 8; const f = 1500 + Math.random() * 1500; tone(f, f * 1.5, 0.13, 0.02, 'sine'); setTimeout(() => tone(f * 1.2, f * 1.7, 0.1, 0.017, 'sine'), 150); }
    if ((s.type === 'fishing' || s.type === 'town' && s.sid !== 'bayamo' || s.sid === 'bay') && now > amb.next.wave) { amb.next.wave = now + 5 + Math.random() * 3; noise(3.2, 500, 220, 0.02, 'lowpass'); }
    // a fire close by
    if (now > amb.next.fire && s.things) { amb.next.fire = now + 0.25 + Math.random() * 0.5; for (const t of s.things) if (t.k === 'fire' && t.d.lit) { const d = Math.hypot(gm.player.x - t.x, gm.player.y - t.y); if (d < 180) { noise(0.03, 3500, 1200, 0.03 * (1 - d / 180), 'highpass'); break; } } }
    // the radio on the air
    if (s.things && now > amb.next.radio) { amb.next.radio = now + 0.15; for (const t of s.things) if (t.k === 'radioset' && t.d.air > gm.time) { const d = Math.hypot(gm.player.x - t.x, gm.player.y - t.y); if (d < 260 && Math.random() < 0.6) noise(0.05, 2400 + Math.random() * 1500, 1800, 0.02 * (1 - d / 260), 'bandpass', 3); break; } }
    // your engine
    const v = gm.vehicle; if (v && v.def.tank && !v.wreck) { if (!amb.eng) { const o = ctx.createOscillator(); o.type = 'sawtooth'; const gg = ctx.createGain(); gg.gain.value = 0; const fl = ctx.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = 420; o.connect(fl); fl.connect(gg); gg.connect(master); o.start(); amb.eng = { o, g: gg }; } amb.eng.o.frequency.setTargetAtTime(38 + Math.abs(v.spd) * 0.5, ctx.currentTime, 0.1); amb.eng.g.gain.setTargetAtTime(0.045 + Math.abs(v.spd) / 4000, ctx.currentTime, 0.2); } else if (amb.eng) amb.eng.g.gain.setTargetAtTime(0, ctx.currentTime, 0.3);
  };
  // a plucked string: a quick triangle with a fast decay and a touch of noise on the attack
  C.snd.pluck = function (f, v) { if (!ctx || !on) return; v = v === undefined ? 1 : v; tone(f * 1.003, f, 0.55, 0.09 * v, 'triangle'); tone(f * 2, f * 2, 0.25, 0.025 * v, 'sine'); noise(0.02, 3000, 1500, 0.02 * v, 'highpass'); };
  const NOTE = (n) => 220 * Math.pow(2, n / 12);
  const PATTERNS = { son: [0, 7, 12, 7, 3, 7, 12, 7], bolero: [0, 7, 12, 15, 12, 7, 0, 7], marcha: [0, 0, 7, 7, 12, 12, 7, 7], guaji: [0, 4, 7, 4, 9, 7, 4, 7] };
  C.snd.guitar = function (song, beat, dist) { const p = PATTERNS[song] || PATTERNS.son; const v = Math.max(0, 1 - dist / 300); if (v > 0.05) C.snd.pluck(NOTE(p[beat % p.length] + (beat % 16 >= 8 ? 5 : 0)), v); };
  window.addEventListener('keydown', (e) => { if (e.key === 'n' || e.key === 'N') { const o = C.snd.toggle(); if (C.ui && C.ui.toast) C.ui.toast(o ? 'Sound on' : 'Sound off'); } });
})();
