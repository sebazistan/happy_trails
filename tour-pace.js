/* ═══════════════════════════════════════════════════════════════════════════
   HAPPY TRAILS — HOW LONG A CARD IS WORTH
   version 1.0

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

     THEN BOTH ARRIVE TOGETHER. The card is open for `dwell`. The last page of
     text and the last picture are both reached at `endAt`, and the stretch
     from there to the end is the last page's turn to be read. The two tracks
     run at different rates — three pages and seven pictures means the pictures
     change faster — and they still finish on the same beat.

   TO USE IT:  HappyTrailsPace.plan(card, settings)  →  { dwell, endAt, pages,
   slides }, or null if there is nothing there. `turn(count, move, endAt)` is
   the companion: it hands back the moments at which to move.
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

    const dwell = Math.max(read, look, S.leastOnACard);
    /* the last page's own turn to be read — one page's worth, and never less
       than a picture is worth */
    const lastLook = Math.max(S.leastOnASlide, read / pages);

    return {
      words: words,
      pages: pages,
      slides: slides.length,
      dwell: dwell,
      endAt: Math.max(0, dwell - lastLook),
    };
  }

  /* WHEN TO TURN. Item j of `count` arrives at j × endAt ÷ (count − 1), so
     whatever `count` is the last one lands exactly on endAt — which is what
     makes the text and the pictures finish together however many of each
     there are. One item never moves at all. */
  function moments(count, endAt) {
    if (count < 2) return [];
    const out = [];
    for (let j = 1; j < count; j++) out.push({ j: j, at: j * endAt / (count - 1) });
    return out;
  }

  return { plan: plan, moments: moments, DEFAULTS: DEFAULTS };
})();
