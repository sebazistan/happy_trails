/* ═══════════════════════════════════════════════════════════════════════════
   HAPPY TRAILS — HOW LONG A CARD IS WORTH
   version 1.5

   WHAT THIS IS. One question, asked by both tours (the one that walks a single
   trail and the one on the main map that visits the featured waypoints): given
   this card, how long should it be up, and when should its text and pictures
   turn over? The tours have nothing else in common, but a card is a card and
   "how long is this worth" must not be two answers that drift apart.

   Everything is counted off the card at the moment it is asked, none of it
   about any particular waypoint.

     THE TEXT decides the length: the words actually on the card divided by a
     real reading speed, not a skimming one.

     THE PICTURES set a floor under it. Each slide wants a minimum look, and a
     video wants its own running time if the browser will say, so a card with
     eight photographs and one line of text is not gone in three seconds.

     EACH TRACK IS DIVIDED EQUALLY. The card is open for `dwell`; pictures each
     get dwell ÷ slides and pages each get dwell ÷ pages. Three pages and seven
     pictures means the pictures change faster, and both are on their last one
     when the card closes.

   WHY EQUAL SHARES. Aiming both tracks at one instant near the end failed on a
   card with ONE page of text (most of them): that instant landed at ZERO, every
   photograph after the first went past in one frame and the carousel was over.
   Equal shares have no such case, and every slide gets the same length
   whatever else the card contains.

   AND A CLOCK TO RUN IT ON. `clock()` is a small scheduler that can be STOPPED
   AND STARTED AGAIN, which setTimeout cannot do. Both tours can be paused, and
   a pause is only real if EVERYTHING waiting pauses with it (the card's time,
   the page turns, the picture turns, the beat between waypoints), so one clock
   per tour has everything hung off it and a pause is one instruction.

   TO USE IT:  HappyTrailsPace.plan(card, settings)  →  { dwell, pages, slides },
   or null if there is nothing there. `moments(count, dwell)` is the
   companion: it hands back the moments at which to move. `clock()` is the
   thing to run them on.
   ═══════════════════════════════════════════════════════════════════════════ */

window.HappyTrailsPace = (function () {
  "use strict";

  /* THE ONE PLACE THESE LIVE, for both tours. Each starts from these, divides
     the durations by its own speed, and lets a page override any of them. */
  const DEFAULTS = {
    /* Words per minute. Silent reading of unfamiliar prose runs 200 to 250 for
       most adults; this is the slow end on purpose, because somebody on a tour
       is also looking at a map and a photograph. Lower it and every card stays
       longer: the single biggest lever there is. */
    wordsPerMinute: 200,
    /* the floor under a card with almost nothing written (a one-line waypoint
       must not flash past) and a ceiling for an essay */
    leastOnACard:   4200,
    mostOnACard:    42000,
    /* each slide wants at least this long; a video wants its own running time
       if the browser will say, up to this (long enough for a short clip, short
       enough that a long one does not hold the tour hostage) */
    leastOnASlide:  3400,
    mostOnAVideo:   14000,
  };

  function plan(card, given) {
    if (!card) return null;
    const S = Object.assign({}, DEFAULTS, given || {});

    const words = Array.prototype.reduce.call(
      card.querySelectorAll(".tm-textpages p"),
      (n, para) => n + (para.textContent.trim().match(/\S+/g) || []).length, 0);

    const slides = Array.prototype.slice.call(card.querySelectorAll(".tm-slide"));
    const pages = Math.max(1, card.pageCount || 1);

    /* what the pictures want between them: a plain look each, except a video
       that says how long it runs, which wants to be seen through */
    const look = slides.reduce((sum, slide) => {
      const film = slide.querySelector("video");
      const runs = film && isFinite(film.duration) ? film.duration * 1000 : 0;
      return sum + Math.max(S.leastOnASlide, Math.min(S.mostOnAVideo, runs));
    }, 0);

    const read = Math.min(S.mostOnACard,
                 Math.max(S.leastOnACard, words / S.wordsPerMinute * 60000));

    /* `look` is the whole carousel's worth, so the card cannot be shorter
       without some slide being cheated of its turn. */
    const dwell = Math.max(read, look, S.leastOnACard);

    return {
      pages: pages,
      slides: slides.length,
      dwell: dwell,
    };
  }

  /* WHEN TO TURN. The card's time is cut into `count` equal shares and item j
     arrives at the start of the jth, so every item, first and last, is on
     screen for exactly dwell ÷ count. One item never moves.

     NOTE THE DIVISOR: `count`, not `count − 1`, which would put the last
     item's arrival at the very end of the card's life and squeeze everything
     before it (it counts the gaps instead of the items). */
  function moments(count, dwell) {
    if (count < 2) return [];
    const out = [];
    for (let j = 1; j < count; j++) out.push({ j: j, at: j * dwell / count });
    return out;
  }

  /* ── A CLOCK THAT CAN BE STOPPED ─────────────────────────────────────────
     setTimeout can be cleared but will not say how much was left, so a paused
     tour on plain timers either loses the remainder or needs separate
     bookkeeping beside each of four kinds of wait. This keeps the bookkeeping
     once: every job knows how much time it has left; pausing clears the real
     timer and subtracts what has elapsed; resuming sets a fresh timer for the
     remainder. Nothing else in either tour needs to know a pause is possible.

       at(ms, fn)   something to happen later: a page turn, a slide turn
       wait(ms)     a promise the tour awaits: a card's dwell, a beat
       cut()        resolve the wait NOW: what an arrow does
       clear()      drop everything pending: what stopping does

     `wait` and `cut` are separate from `at` and `clear` on purpose. An arrow
     means "this card is over, go on": the pending turns belong to a card about
     to be left and are dropped, while the wait must RESOLVE or the tour's own
     loop never continues. */
  function clock() {
    const jobs = [];
    let held = false, waiting = null;
    const now = () => (window.performance ? performance.now() : Date.now());

    function arm(job) {
      if (held || job.timer) return;
      job.from = now();
      job.timer = setTimeout(() => {
        const i = jobs.indexOf(job); if (i >= 0) jobs.splice(i, 1);
        job.timer = 0;
        job.fn();
      }, Math.max(0, job.left));
    }
    function forget(job) {
      const i = jobs.indexOf(job); if (i >= 0) jobs.splice(i, 1);
      if (job.timer) clearTimeout(job.timer);
      job.timer = 0;
    }
    function at(ms, fn) {
      const job = { left: Math.max(0, ms), fn: fn, timer: 0, from: 0 };
      jobs.push(job);
      arm(job);
      return job;
    }
    function wait(ms) {
      return new Promise(done => {
        const job = at(ms, () => { waiting = null; done(); });
        waiting = { job: job, done: done };
      });
    }
    function cut() {
      if (!waiting) return;
      const w = waiting;
      waiting = null;
      forget(w.job);
      w.done();
    }
    return {
      at: at,
      wait: wait,
      cut: cut,
      /* CLEAR LEAVES `waiting` ALONE: its job is dropped so it cannot fire by
         itself, but cut() can still resolve it, the order an arrow works in. */
      clear: function () { jobs.slice().forEach(forget); },
      pause: function () {
        if (held) return;
        held = true;
        const t = now();
        jobs.forEach(job => {
          if (!job.timer) return;
          clearTimeout(job.timer);
          job.timer = 0;
          job.left -= t - job.from;      // what is still owed
        });
      },
      resume: function () {
        if (!held) return;
        held = false;
        jobs.slice().forEach(arm);
      },
    };
  }

  return { plan: plan, moments: moments, clock: clock, DEFAULTS: DEFAULTS };
})();
