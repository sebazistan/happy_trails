/* ═══════════════════════════════════════════════════════════════════════════
   HAPPY TRAILS — HOW LONG A CARD IS WORTH
   version 1.1

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

   TO USE IT:  HappyTrailsPace.plan(card, settings)  →  { dwell, pages, slides,
   words }, or null if there is nothing there. `moments(count, dwell)` is the
   companion: it hands back the moments at which to move.
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

  return { plan: plan, moments: moments, DEFAULTS: DEFAULTS };
})();
