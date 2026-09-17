/* ═══════════════════════════════════════════════════════════════════════════
   HAPPY TRAILS — HOW LONG A CARD IS WORTH
   version 1.2

   WHAT THIS IS. One question, asked by both tours: given this card, how long
   should it be up, and when should its text and its pictures turn over?

   There are two tours now — the one that walks a single trail, and the one on
   the main map that visits the featured waypoints across all of them — and
   they have nothing else in common. Different movement, different buttons,
   different pages. But a card is a card, and the answer to "how long is this
   worth" must not be two answers that drift apart.

   HOW IT IS WORKED OUT, and note that none of it is about any particular
   waypoint: everything is counted off the card at the moment it is asked.

     THE TEXT decides the length. The words actually on the card are counted
     and divided by a reading speed — a real one, the speed somebody reads at
     rather than the speed somebody skims at.

     THE PICTURES set a floor under it. Each slide wants a minimum look, and a
     video wants its own running time if the browser will say what it is, so a
     card with eight photographs and one line of text is not gone in three
     seconds.

     THEN EACH TRACK IS DIVIDED EQUALLY. The card is open for `dwell`; the
     pictures each get dwell ÷ slides and the pages each get dwell ÷ pages. The
     two run at different rates — three pages and seven pictures means the
     pictures change faster — and both are on their last one when the card
     closes.

   WHY IT IS DIVIDED THIS WAY AND NOT THE OTHER. The first version aimed both
   tracks at one instant near the end, so the last page and the last photograph
   arrived together and the time after that was the last page's turn to be
   read. It was a nice idea with a hole straight through it: on a card with ONE
   page of text — which is most of them at a normal window size — that instant
   landed at ZERO, and every photograph after the first went past in the same
   frame. The first picture was on screen for about one frame and then the
   carousel was over. That is the bug this replaces.

   Equal shares have no such case. Every slide gets the same length whatever
   else the card contains, which is also what anybody watching a slideshow
   would expect of it.

   AND A CLOCK TO RUN IT ON. `clock()` hands back a small scheduler that can be
   STOPPED AND STARTED AGAIN, which is the one thing setTimeout cannot do. Both
   tours can be paused now — somebody who wants longer with a card should be
   able to have it without leaving the tour and finding the waypoint again —
   and a pause is only real if EVERYTHING waiting pauses with it: the card's
   own time, the page turns, the picture turns, the beat between waypoints. One
   clock per tour, everything hung off it, and a pause is then a single
   instruction rather than four places that have to agree.

   TO USE IT:  HappyTrailsPace.plan(card, settings)  →  { dwell, pages, slides,
   words }, or null if there is nothing there. `moments(count, dwell)` is the
   companion: it hands back the moments at which to move. `clock()` is the
   thing to run them on.
   ═══════════════════════════════════════════════════════════════════════════ */

window.HappyTrailsPace = (function () {
  "use strict";

  const DEFAULTS = {
    wordsPerMinute: 200,
    leastOnACard:   4200,
    mostOnACard:    42000,
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
       that will say how long it runs, which wants to be seen through */
    const look = slides.reduce((sum, slide) => {
      const film = slide.querySelector("video");
      const runs = film && isFinite(film.duration) ? film.duration * 1000 : 0;
      return sum + Math.max(S.leastOnASlide, Math.min(S.mostOnAVideo, runs));
    }, 0);

    const read = Math.min(S.mostOnACard,
                 Math.max(S.leastOnACard, words / S.wordsPerMinute * 60000));

    /* `look` is what the pictures want BETWEEN them, so it is already the
       whole carousel's worth: the card cannot be shorter than that without
       some slide being cheated of its turn. */
    const dwell = Math.max(read, look, S.leastOnACard);

    return {
      words: words,
      pages: pages,
      slides: slides.length,
      dwell: dwell,
    };
  }

  /* WHEN TO TURN. The card's time is cut into `count` equal shares and item j
     arrives at the start of the jth — so every item, the first and the last
     alike, is on screen for exactly dwell ÷ count. One item never moves.

     NOTE THE DIVISOR: `count`, not `count − 1`. Dividing by count − 1 puts the
     last item's arrival at the very end of the card's life, which gives it no
     time at all and squeezes everything before it into the space left over.
     That is the arithmetic that looked right until you counted the gaps
     instead of the items. */
  function moments(count, dwell) {
    if (count < 2) return [];
    const out = [];
    for (let j = 1; j < count; j++) out.push({ j: j, at: j * dwell / count });
    return out;
  }

  /* ── A CLOCK THAT CAN BE STOPPED ─────────────────────────────────────────
     setTimeout has no pause. You can clear it, but it will not tell you how
     much of it was left, so a paused tour built on plain timers either loses
     the remainder or has to keep a second set of bookkeeping beside every
     timer it sets — and there are four kinds of wait in a tour, so that is
     four places to get it wrong.

     This keeps the bookkeeping once. Every job knows how much time it has
     left; pausing clears the real timer and subtracts what has elapsed;
     resuming sets a fresh timer for the remainder. Nothing else in either tour
     has to know that a pause is even possible.

     THE FOUR THINGS IT DOES:
       at(ms, fn)   something to happen later — a page turn, a slide turn
       wait(ms)     a promise the tour awaits — a card's dwell, a beat
       cut()        resolve the wait NOW: what an arrow does
       clear()      drop everything pending: what stopping does

     `wait` and `cut` are separate from `at` and `clear` on purpose. An arrow
     means "this card is over, go on" — the pending turns belong to a card
     about to be left and are dropped, while the wait must RESOLVE or the tour's
     own loop never continues from the line it is sitting on. */
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
      /* CLEAR LEAVES `waiting` ALONE. The job behind it is dropped, so it can
         no longer fire by itself, but cut() can still resolve it — which is
         exactly the order an arrow does things in. */
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
      held: function () { return held; },
    };
  }

  return { plan: plan, moments: moments, clock: clock, DEFAULTS: DEFAULTS };
})();
