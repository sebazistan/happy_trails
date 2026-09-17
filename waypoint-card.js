/* ═══════════════════════════════════════════════════════════════════════════
   HAPPY TRAILS — THE WAYPOINT CARD
   version 1.2

   ONE CARD, USED IN TWO PLACES. A waypoint card — the picture, the caption,
   the paged text, the facts along the bottom, the × and the expand button —
   is the same object on a trail page and on the main map. It used to live
   inside trail-engine.js, where the main map could not reach it; the main map
   now shows a few waypoints of its own, and the choice was to write the card
   a second time or to move it here. A card written twice is a card that goes
   out of step, so it lives here and both pages load it.

   WHAT THIS FILE DOES NOT DECIDE is when a card is shown. That is the whole
   difference between the two pages: on a trail page the walk fades cards in
   and out as you scroll past their waypoints, and on the main map you click
   an icon and it opens. Neither of those is a card's business. This file
   builds the cards, runs everything inside them, and hands them back.

   HOW TO USE IT

     const deck = HappyTrailsCards({
       host:     where the cards go,
       veil:     the element that darkens behind an expanded card,
       stops:    [{ title, metres, distance, media, text, kind, … }],
       settings: the page's SETTINGS,       words: the page's WORDS,
       haveHeights: whether to show the Elevation fact,
       perMetre:    map units to metres, or 0 for no From start fact,
       numbering:   write "Waypoint 03 of 13" on the picture,
       front:       () => which card is the one in front, for video,
       onClose:     i => the page decides what closing means,
       wake:        () => the page has something to redraw,
       onAMeteredLine: () => whether to hold back on fetching video,
     });

   and it hands back { cards, setBig, isBig, bigAt, measureAll, showSlide,
   showPage, showCaption, playTheRightVideo, roomToGrow }.

   NOTHING IN HERE TOUCHES THE PAGE OUTSIDE `host` AND `veil`. It reads no
   global, holds no scroll position and knows nothing about a map. That is
   what makes it safe to run two of them, or none.
   ═══════════════════════════════════════════════════════════════════════════ */

window.HappyTrailsCards = function (opts) {
  "use strict";

  /* ── THE CARD'S OWN WORDS ────────────────────────────────────────────────
     Everything written on a card that is not the waypoint's own text. They
     live here rather than in each page, because they are the card's, and a
     page that had to list twenty labels to get a card would have twenty
     labels to keep in step with the other page's twenty. A page may still
     override any of them by passing `words`; anything it leaves out falls
     back to this. */
  const CARD_WORDS = {
    closeCard:     "Close",
    growCard:      "See this waypoint bigger",
    shrinkCard:    "Back to the map",
    waypoint:      "Waypoint",
    outOf:         "of",
    elevation:     "Elevation",
    fromStart:     "From start",
    metres:        "m",
    km:            "km",
    mapLink:       "Google maps",
    photoMissing:  "photo placeholder",
    videoMissing:  "video unavailable",
    beforeLabel:   "Before",
    afterLabel:    "After",
    compareHandle: "Drag to compare",
    previousPicture: "Previous picture",
    nextPicture:     "Next picture",
    previousPage:    "Previous",
    nextPage:        "Continue reading",
    cost:          "Cost",
    priority:      "Priority",
    level_low:     "Low",
    level_medium:  "Medium",
    level_high:    "High",
    openOnTrail:   "Open card on trail page",
  };

  /* ── AND ITS OWN SETTINGS ────────────────────────────────────────────────
     The same arrangement as the words: the card knows what it needs, a page
     overrides what it cares about. A trail page passes its whole SETTINGS
     block, which names every one of these, so nothing there changes. */
  const CARD_SETTINGS = {
    captionFadeMs:      180,
    cardCanGrow:        true,
    cardFitsWindow:     true,
    cardGrowFadeMs:     130,
    cardGrowMs:         260,
    cardGrowsAbove:     620,
    cardGrowsFrom:      1100,
    cardMinLines:       3,
    /* how long a card takes to arrive out of the waypoint that was clicked,
       and the shape of that move. See popFrom. */
    cardPopMs:          380,
    cardPopEase:        "cubic-bezier(.28,.78,.32,1)",
    /* HOW SMALL THE CARD STARTS. Not the waypoint's real size: a pin is
       fourteen pixels and a card is five hundred, and a move that begins at
       three per cent spends nine tenths of itself as a speck and then arrives
       all at once. Starting at a fifth reads as the card coming OUT of the
       waypoint, which is the thing being said, and every frame of it is worth
       looking at. */
    cardPopLeast:       0.22,
    cardsCanBeClosed:   true,
    compareClickToMove: true,
    compareStartsAt:    50,
    compareStep:        4,
    iconFolder:         "icons/",
    mediaFolder:        "",
    mediaLoop:          true,
    pageLongText:       true,
    phoneWidth:         860,
    placeholderHue:     24,
    placeholderHueStep: 14,
    videoAutoplay:      true,
    videoControls:      false,
    videoLoop:          true,
    videoMuted:         true,
    videoPreload:       "metadata",
    videoPreloadCards:  1,
    videoPreloadFront:  true,
    videoSpinner:       true,
  };

  const SETTINGS = Object.assign({}, CARD_SETTINGS, opts.settings || {});
  const WORDS    = Object.assign({}, CARD_WORDS, opts.words || {});
  const stops    = opts.stops;
  const host     = opts.host;
  const veil     = opts.veil;
  const haveHeights = !!opts.haveHeights;
  const perMetre    = opts.perMetre || 0;
  const numbering   = opts.numbering !== false;
  const front    = opts.front   || (() => -1);
  const onClose  = opts.onClose || function () {};
  const onOpen   = opts.onOpen  || function () {};
  const onBig    = opts.onBig   || function () {};
  const wake     = opts.wake    || function () {};
  const onAMeteredLine = opts.onAMeteredLine || (() => false);

  /* The two arithmetic helpers this file uses. They are three lines between
     them and they are in trail-engine.js as well — copied rather than shared,
     because a file whose whole point is that it stands on its own should not
     need a third file to clamp a number. */
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const isPhone = () => window.innerWidth <= (SETTINGS.phoneWidth || 760);

  /* ── waypoint cards ─────────────────────────────────────────────────────
     Each card is: an optional ×, a picture window holding one or more slides,
     then the text in a window that pages rather than scrolls.               */

  /* the graphic drawn when a waypoint has no picture of its own */
  function standInPhoto(i) {
    const hue = SETTINGS.placeholderHue + i * SETTINGS.placeholderHueStep;
    const art =
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 480">' +
      '<defs><linearGradient id="s" x1="0" y1="0" x2="0" y2="1">' +
      '<stop offset="0" stop-color="hsl(' + hue + ',22%,34%)"/>' +
      '<stop offset="1" stop-color="hsl(' + (hue + 18) + ',20%,15%)"/></linearGradient></defs>' +
      '<rect width="640" height="480" fill="url(#s)"/>' +
      '<circle cx="512" cy="112" r="34" fill="hsl(' + (hue + 30) + ',45%,78%)" opacity=".26"/>' +
      '<g transform="translate(0,120)">' +
      '<path d="M0 268 L118 172 L196 236 L292 132 L404 250 L470 200 L640 296 L640 360 L0 360 Z" fill="hsl(' + hue + ',18%,12%)" opacity=".85"/>' +
      '<path d="M0 300 L96 246 L214 300 L330 232 L456 302 L560 258 L640 318 L640 360 L0 360 Z" fill="hsl(' + hue + ',16%,8%)"/>' +
      '<path d="M292 132 L252 176 L292 168 L318 190 L340 158 Z" fill="#eceff1" opacity=".7"/>' +
      '</g></svg>';
    return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(art);
  }

  const VIDEO_FILE = /\.(mp4|webm|ogv|mov)(\?|#|$)/i;

  /* Turn whatever the waypoint gave us into a tidy list of slides. `media`
     may be one string or a list; `photo` is the older name for the same
     thing; nothing at all gets the placeholder graphic. */
  /* Put SETTINGS.mediaFolder in front of a filename. Anything that already
     names where it lives — a full URL, a path from the site root, or an
     inline data: image — is handed back untouched. */
  function mediaPath(name) {
    if (typeof name !== "string" || !name) return name;
    return /^(https?:|data:|blob:|\/)/i.test(name) ? name : SETTINGS.mediaFolder + name;
  }

  function slidesFor(stop, i) {
    let given = stop.media || stop.photo || null;
    // one entry may be written on its own rather than in a list — a bare
    // filename, or a single { src, caption } — so wrap anything that is not
    // already a list before going on
    if (given && !Array.isArray(given)) given = [given];
    if (!given || !given.length) return [{ src: standInPhoto(i), kind: "placeholder" }];
    return given.map(entry => {
      // a pair of files is a before/after slider rather than a plain picture
      if (entry && entry.before && entry.after) {
        return { kind: "compare", caption: entry.caption || "",
                 before: mediaPath(entry.before), after: mediaPath(entry.after),
                 beforeLabel: entry.beforeLabel || WORDS.beforeLabel,
                 afterLabel:  entry.afterLabel  || WORDS.afterLabel };
      }
      const src  = mediaPath(typeof entry === "string" ? entry : entry.src);
      const kind = (entry && entry.kind) || (VIDEO_FILE.test(src) ? "video" : "image");
      // a plain filename has no caption; { src: "…", caption: "…" } does
      return { src: src, kind: kind, caption: (entry && entry.caption) || "" };
    });
  }

  /* ── ROOM FOR THE LONGEST CAPTION, NOT THE ONE SHOWING ─────────────────
     THIS IS ABOUT THE SMALL CARD, where the caption shares the title's line.
     A card's captions change as you page through its pictures, and they are
     not all the same length. The caption shares a line with the title until
     the two will not fit, at which point the title drops below it — so
     without this, paging from a short caption to a long one on the same card
     would jerk the title, and everything under it, down a line and back up
     again. The words changing is the point; the layout moving is not.

     So the caption is given a floor as wide as the WIDEST of that card's
     captions. Every picture on the card then lays out the same way: either
     they all share the line or the title sits under all of them, decided once
     by the longest. Short captions still sit flush right inside that room,
     because the text is right-aligned, so nothing looks padded.

     MEASURED ON A CANVAS, not in the page. The cards are built before any of
     them is shown, and a hidden element has no width to read; a canvas will
     measure text in a given font without the text being anywhere. It is also
     free of layout, so doing this for every card costs nothing at load.

     The floor is handed to the stylesheet as a custom property rather than
     set as a width, so the rule that caps a caption at part of the line stays
     in the stylesheet with every other measurement. */
  const captionRuler = document.createElement("canvas").getContext("2d");

  function holdRoomForTheLongestCaption(card) {
    // the copy beside the title: the one on the picture is absolutely
    // positioned and its width moves nothing
    const box = card.querySelector(".tm-inner .tm-slideCaption");
    const written = (card.captions || []).filter(Boolean);
    // one caption, or none, cannot disagree with itself
    if (!box || written.length < 2) return;
    const style = getComputedStyle(box);
    captionRuler.font = style.fontStyle + " " + style.fontWeight + " " +
                        style.fontSize + " " + style.fontFamily;
    let widest = 0;
    written.forEach(t => {
      widest = Math.max(widest, captionRuler.measureText(t).width);
    });
    // a pixel or two of slack: a canvas and the page round letter spacing
    // differently, and a floor a hair too low would let the longest caption
    // wrap inside its own box, which is the thing being avoided
    card.style.setProperty("--caption-room", Math.ceil(widest + 2) + "px");
  }

  /* If the page is still loading the fonts it asks for, every measurement
     above was taken in a fallback face and the widest caption may not be the
     one that ends up widest. Measuring again once the real fonts are in is one
     pass over the cards and settles it. */
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(() => {
      document.querySelectorAll(".tm-card").forEach(holdRoomForTheLongestCaption);
    });
  }

  function slideHtml(m) {
    if (m.kind === "compare") {
      // "after" underneath, "before" on top and clipped — the handle moves the
      // clip, so dragging it wipes from one to the other
      return '<div class="tm-slide"><div class="tm-compare" style="--split:' +
             SETTINGS.compareStartsAt + '%">' +
             '<img class="tm-after" alt="" src="' + m.after + '">' +
             '<img class="tm-before" alt="" src="' + m.before + '">' +
             '<span class="tm-compare-label is-before">' + m.beforeLabel + "</span>" +
             '<span class="tm-compare-label is-after">' + m.afterLabel + "</span>" +
             '<div class="tm-compare-handle" tabindex="0" role="slider"' +
             ' aria-label="' + WORDS.compareHandle + '" aria-valuemin="0" aria-valuemax="100"' +
             ' aria-valuenow="' + SETTINGS.compareStartsAt + '"><span>&lsaquo;&rsaquo;</span></div>' +
             "</div></div>";
    }
    if (m.kind === "video") {
      /* the spinner is always in the markup and always turning — it is only
         made visible while the video is waiting, so there is no moment where
         it has to start up. See wireBuffering() for the switching.          */
      return '<div class="tm-slide"><video src="' + m.src + '" playsinline preload="' +
             SETTINGS.videoPreload + '"' +
             (SETTINGS.videoMuted ? " muted" : "") +
             (SETTINGS.videoLoop ? " loop" : "") +
             (SETTINGS.videoControls ? " controls" : "") + "></video>" +
             (SETTINGS.videoSpinner ? '<div class="tm-spinner" aria-hidden="true"></div>' : "") +
             "</div>";
    }
    /* HELD BACK UNTIL IT IS WANTED. Every card on a page is built up front —
       that is what makes one appear the instant the walk reaches it — and on
       the main map there are thirty-six of them, drawing on sixteen trails'
       media folders. Without this, opening the map fetched seventy pictures
       nobody had asked to see. `lazy` costs the trail pages nothing: a card
       that is about to fade in is on screen, and the browser fetches it. */
    return '<div class="tm-slide"><img alt="" loading="lazy" decoding="async" src="' + m.src + '">' +
           (m.kind === "placeholder" ? '<span class="tm-caption">' + WORDS.photoMissing + "</span>" : "") +
           "</div>";
  }

  /* The coin and the gauge, with their words. Both files live in
     SETTINGS.iconFolder and are named for their value — cost-high.svg,
     priority-low.svg — so adding a fourth level later is a file, not a rule. */
  const LEVELS = { low: 1, medium: 2, high: 3 };
  function judgementRow(s) {
    if (s.kind !== "wishful") return "";
    const bits = [];
    const one = (what, level) => {
      if (!LEVELS[level]) return;
      bits.push('<span class="tm-judge is-' + what + ' is-' + level + '">' +
        '<img src="' + SETTINGS.iconFolder + what + "-" + level + '.svg" alt="" ' +
        'width="48" height="48" data-life="' +
        (what === "cost" ? "coin" : "dial") + '">' +
        '<span class="tm-judgeText"><small>' + WORDS[what] + "</small><b>" +
        WORDS["level_" + level] + "</b></span></span>");
    };
    one("cost", s.cost);
    one("priority", s.priority);
    return bits.length ? '<div class="tm-judgement">' + bits.join("") + "</div>" : "";
  }

  /* text may be one string (blank lines start new paragraphs) or a list */
  function paragraphsFor(stop) {
    const given = Array.isArray(stop.text) ? stop.text : String(stop.text || "").split(/\n\s*\n/);
    return given.filter(t => String(t).trim()).map(t => "<p>" + t + "</p>").join("");
  }

  const cards = stops.map((s, i) => {
    const facts = [];   // empty entries are dropped before the row is written
    if (haveHeights) facts.push("<div><small>" + WORDS.elevation + "</small>" + Math.round(s.metres) + " " + WORDS.metres + "</div>");
    if (perMetre)    facts.push("<div><small>" + WORDS.fromStart + "</small>" + (s.distance * perMetre / 1000).toFixed(1) + " " + WORDS.km + "</div>");
    /* the link button sits in the same row as the facts, at the far end. A
       waypoint with no mapLink contributes nothing, so no button appears —
       there is no setting to remember to turn off. */
    /* WISHFUL STOPS CARRY TWO MORE FACTS — what it would cost to build and how
       badly it is wanted. They belong in this row and nowhere else: it is the
       row of things that are true about this stop, and a coin and a dial are
       two more of those. They had a panel of their own beside the title, which
       made them the loudest thing on the card; here they read as what they
       are, the third and fourth figures after Elevation and From start. */
    facts.push(judgementRow(s));
    if (s.mapLink) facts.push(
      '<a class="tm-mapLink" href="' + s.mapLink + '" target="_blank" rel="noopener">' +
      WORDS.mapLink + "</a>");
    /* AND ONE MORE BUTTON, WHERE THE CARD IS NOT ON ITS OWN TRAIL. A card
       opened from the main map is a visitor: it shows one waypoint, with no
       walk around it and no way through to the rest of the trail. `goTo` is
       that way through — the waypoint's own address on its own page, which
       opens there with the card already up. A card on its own trail page
       passes nothing and gets no button, so this costs those pages a line of
       markup that is never written. */
    if (s.goTo) facts.push(
      '<a class="tm-goTo" href="' + s.goTo + '">' +
      (s.goToLabel || WORDS.openOnTrail) +
      '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" ' +
      'stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">' +
      '<path d="M5 12h13M12 5l7 7-7 7"/></svg></a>');

    const slides = slidesFor(s, i);
    const many = slides.length > 1;

    const card = document.createElement("article");
    card.className = "tm-card" + (s.kind === "wishful" ? " tm-wishful" : "");
    card.innerHTML =
      (SETTINGS.cardsCanBeClosed
        ? '<button class="tm-close" type="button" title="' + WORDS.closeCard +
          '" aria-label="' + WORDS.closeCard + '">&times;</button>'
        : "") +

      /* THE EXPAND BUTTON, immediately left of the ×. Both arrow crosses are
         drawn into it and the stylesheet shows whichever one is right, so the
         button never has to be redrawn — only its label changes, which is the
         part a screen reader needs. It is hidden entirely on anything smaller
         than a desktop window: see .tm-grow in the stylesheet. */
      (SETTINGS.cardCanGrow
        ? '<button class="tm-grow" type="button" aria-pressed="false" title="' +
          WORDS.growCard + '" aria-label="' + WORDS.growCard + '">' +
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" ' +
          'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
          '<path class="tm-growIcon" d="M9 3H3v6M15 3h6v6M9 21H3v-6M15 21h6v-6"/>' +
          '<path class="tm-shrinkIcon" d="M3 9h6V3M21 9h-6V3M3 15h6v6M21 15h-6v6"/>' +
          "</svg></button>"
        : "") +

      '<div class="tm-media">' +
        '<div class="tm-track">' + slides.map(slideHtml).join("") + "</div>" +
        /* THE WAYPOINT NUMBER SITS ON THE PICTURE, top left. It was a row of
           its own between the picture and the title, which cost 21 pixels of a
           card whose scarcest thing is room for words. Over the picture it
           costs nothing. */
        /* ON THE MAIN MAP THE STAMP NAMES THE TRAIL INSTEAD. There, the few
           waypoints shown are not a sequence and "Waypoint 02 of 07" would be
           counting something the reader cannot see; what they want to know is
           which trail they have just clicked on. `numbering` picks between
           the two, and a stop may carry its own `stamp` to say it outright. */
        '<div class="tm-stamp">' +
          '<div class="tm-count">' +
          (numbering
            ? WORDS.waypoint + " " + String(i + 1).padStart(2, "0") +
              " <span>" + WORDS.outOf + " " + String(stops.length).padStart(2, "0") + "</span>"
            : (s.stamp || s.trailName || "")) +
          "</div>" +
        "</div>" +
        /* THE PICTURE'S CAPTION, in the opposite corner — but only when the
           card is expanded, where there is room for it on the photograph and
           the panel beside it wants its whole height for words. The small
           card's copy sits below the picture, beside the title, and the two
           are written into the card together: the stylesheet shows whichever
           one belongs and the engine fills both, so neither can go stale.
           Here it is dressed like the waypoint number above it — a shadow and
           a wash of dark — so it reads over a bright sky as easily as over a
           dark one. */
        '<div class="tm-slideCaption"></div>' +
        (many
          ? '<button class="tm-media-arrow is-prev" type="button" title="' + WORDS.previousPicture +
            '" aria-label="' + WORDS.previousPicture + '">&lsaquo;</button>' +
            '<button class="tm-media-arrow is-next" type="button" title="' + WORDS.nextPicture +
            '" aria-label="' + WORDS.nextPicture + '">&rsaquo;</button>' +
            '<div class="tm-dots">' +
            slides.map((m, k) => '<button class="tm-dot' + (k ? "" : " is-on") +
                                 '" type="button" data-slide="' + k + '"></button>').join("") +
            "</div>"
          : "") +
      "</div>" +

      '<div class="tm-inner">' +
        /* THE TITLE AND THE SMALL CARD'S CAPTION SHARE A LINE — the caption
           below the picture and over to the right, without a row of its own to
           sit in. On a heading's line it costs nothing and reads as what it
           is: a note about the picture above, set beside the name of the
           place. In the big view this copy is hidden and the one written onto
           the photograph is shown instead.

           THE CAPTION IS WRITTEN FIRST, AND MOVED TO THE RIGHT BY THE
           STYLESHEET (the row is laid out in reverse). That is deliberate:
           when the two are too long to share a line — "Bridge over Dufferin
           St." beside "The trail through the houses" — the second one written
           is the one that drops to a line of its own, and it must be the TITLE
           that drops. The caption keeps the corner under the photograph it
           belongs to, and the heading moves down to make room for it. */
        '<div class="tm-titleRow">' +
          '<div class="tm-slideCaption"></div>' +
          "<h2>" + s.title + "</h2>" +
        "</div>" +
        '<div class="tm-textwindow"><div class="tm-textpages">' + paragraphsFor(s) + "</div></div>" +
        '<div class="tm-pager">' +
          '<button class="tm-prevpage" type="button" title="' + WORDS.previousPage +
          '" aria-label="' + WORDS.previousPage + '">&lsaquo;</button>' +
          '<button class="tm-nextpage" type="button" title="' + WORDS.nextPage +
          '" aria-label="' + WORDS.nextPage + '">&rsaquo;</button>' +
          '<span class="tm-pagecount"></span>' +
        "</div>" +
        (facts.filter(Boolean).length
          ? '<div class="tm-facts">' + facts.filter(Boolean).join("") + "</div>" : "") +
      "</div>";

    host.appendChild(card);
    // one caption per slide, in the same order as the pictures
    card.captions = slides.map(m => m.caption || "");
    // BOTH copies of the caption — the one beside the title and the one on
    // the picture — are filled every time. Only one of them is ever shown.
    card.querySelectorAll(".tm-slideCaption")
        .forEach(box => { box.textContent = card.captions[0] || ""; });
    holdRoomForTheLongestCaption(card);
    card.slideAt = 0;                      // which picture is showing
    card.pageAt = 0;                       // which page of text is showing
    card.pageCount = 1;
    card.pageHeight = 0;

    if (SETTINGS.cardsCanBeClosed) {
      card.querySelector(".tm-close").addEventListener("click", () => onClose(i));
    }
    if (SETTINGS.cardCanGrow) {
      card.querySelector(".tm-grow").addEventListener("click", () => setBig(!bigOn, i));
    }
    if (many) {
      card.querySelector(".is-prev").addEventListener("click", () => showSlide(card, card.slideAt - 1));
      card.querySelector(".is-next").addEventListener("click", () => showSlide(card, card.slideAt + 1));
      card.querySelectorAll(".tm-dot").forEach(dot =>
        dot.addEventListener("click", () => showSlide(card, +dot.dataset.slide)));
    }
    card.querySelectorAll(".tm-compare").forEach(wireCompare);
    catchMissingFiles(card, i);
    wireBuffering(card);
    card.querySelector(".tm-prevpage").addEventListener("click", () => showPage(card, card.pageAt - 1));
    card.querySelector(".tm-nextpage").addEventListener("click", () => showPage(card, card.pageAt + 1));
    return card;
  });

  /* ── the buffering ring ──────────────────────────────────────────────
     A video that has not finished filling its buffer freezes on its first
     frame with nothing to explain the pause. These four events cover it:
       waiting / stalled → the video has run out of data and is fetching more
       loadstart         → the file has only just been asked for
       playing / canplay → there is enough to run
     The class goes on the slide, not the video, because the ring is a sibling
     of the video, positioned over it. Media events do not bubble, so each
     listener is attached to the video element itself.                       */
  function wireBuffering(card) {
    if (!SETTINGS.videoSpinner) return;
    card.querySelectorAll(".tm-slide video").forEach(video => {
      const slide = video.closest(".tm-slide");
      const waiting = () => slide.classList.add("is-buffering");
      const ready   = () => slide.classList.remove("is-buffering");
      ["waiting", "stalled", "loadstart"].forEach(e => video.addEventListener(e, waiting));
      ["playing", "canplay", "canplaythrough", "suspend", "error"]
        .forEach(e => video.addEventListener(e, ready));
      /* a video that arrived already buffered never fires any of the above */
      if (video.readyState >= 3) ready();
    });
  }

  /* ── when a file cannot be found ──────────────────────────────────────────
     A wrong path or a media folder that did not travel with the page would
     otherwise leave a broken-image icon in the card. Instead the slide falls
     back to the same placeholder graphic a waypoint with no pictures gets,
     with a caption saying what happened, so the card still looks deliberate. */
  function catchMissingFiles(card, i) {
    card.querySelectorAll("img").forEach(img => {
      img.addEventListener("error", () => {
        img.src = standInPhoto(i);
        const slide = img.closest(".tm-slide");
        if (slide && !slide.querySelector(".tm-caption")) {
          const note = document.createElement("span");
          note.className = "tm-caption";
          note.textContent = WORDS.photoMissing;
          slide.appendChild(note);
        }
      }, { once: true });
    });
    card.querySelectorAll("video").forEach(video => {
      video.addEventListener("error", () => {
        const slide = video.closest(".tm-slide");
        if (!slide) return;
        slide.innerHTML = '<img alt="" src="' + standInPhoto(i) + '">' +
                          '<span class="tm-caption">' + WORDS.videoMissing + "</span>";
      }, { once: true });
    });
  }

  /* ── the before/after slider ──────────────────────────────────────────────
     Everything is done by moving one number: --split, the handle's position
     as a percentage. The stylesheet clips the top picture to it.            */
  function wireCompare(box) {
    const handle = box.querySelector(".tm-compare-handle");
    let lastPointer = "mouse";

    function setSplit(percent) {
      const at = clamp(percent, 0, 100);
      box.style.setProperty("--split", at + "%");
      handle.setAttribute("aria-valuenow", Math.round(at));
      box.splitAt = at;
    }
    function splitFrom(event) {
      const r = box.getBoundingClientRect();
      return ((event.clientX - r.left) / (r.width || 1)) * 100;
    }

    let dragging = false;
    box.addEventListener("pointerdown", e => { lastPointer = e.pointerType || "mouse"; });
    handle.addEventListener("pointerdown", e => {
      dragging = true;
      handle.setPointerCapture(e.pointerId);
      e.preventDefault();                       // don't start a text selection
    });
    handle.addEventListener("pointermove", e => { if (dragging) setSplit(splitFrom(e)); });
    const letGo = e => {
      dragging = false;
      try { handle.releasePointerCapture(e.pointerId); } catch (err) {}
    };
    handle.addEventListener("pointerup", letGo);
    handle.addEventListener("pointercancel", letGo);

    // With a mouse, clicking anywhere on the picture jumps the handle there.
    // On a touch screen it does not, so that swiping across the card still
    // scrolls the page — only the handle itself drags.
    if (SETTINGS.compareClickToMove) {
      box.addEventListener("click", e => {
        if (lastPointer === "touch" || e.target.closest(".tm-compare-handle")) return;
        setSplit(splitFrom(e));
      });
    }

    handle.addEventListener("keydown", e => {
      if (e.key === "ArrowLeft")  { setSplit(box.splitAt - SETTINGS.compareStep); e.preventDefault(); }
      if (e.key === "ArrowRight") { setSplit(box.splitAt + SETTINGS.compareStep); e.preventDefault(); }
    });

    setSplit(SETTINGS.compareStartsAt);
  }

  /* ══ A CARD ARRIVES OUT OF ITS WAYPOINT ══════════════════════════════════
     The waypoint you clicked and the card that answers are the same thing, and
     a card that simply fades up somewhere else does not say so. Given the box
     the waypoint's own circle occupies on the screen, the card starts there —
     that size, that place — and grows to where it belongs.

     WHY IT ANIMATES TO THE CARD'S CURRENT TRANSFORM AND NOT TO `none`. The
     page has its own transform on every card: a lift, and a nudge it rewrites
     on every frame while the card fades in. Animating to `none` would carry
     the card away from that and then snap it back the moment the animation was
     cleared. So the resting transform is read first, the move is stacked in
     FRONT of it — which puts it in the parent's coordinates, where both
     rectangles were measured — and the move ends on the resting transform
     itself, so clearing it afterwards changes nothing.

     A transition rather than a keyframe, because the end state is a matrix
     that is only known at the moment it begins. */
  function popFrom(i, from) {
    const card = cards[i];
    if (!card || !from || !from.width || !from.height) return;
    if (wantsStillness()) return;
    if (card.popping) return;                 // already on its way

    const to = card.getBoundingClientRect();
    if (!to.width || !to.height) return;

    const rest = getComputedStyle(card).transform;
    const held = rest && rest !== "none" ? " " + rest : "";

    /* one scale for both axes, taken from whichever fits — a card is a tall
       rectangle and a waypoint is a small circle, and squashing one into the
       other reads as a mistake rather than as a move */
    const shrink = Math.max(SETTINGS.cardPopLeast, Math.min(1,
                   Math.min(from.width / to.width, from.height / to.height)));
    const dx = (from.left + from.width / 2) - (to.left + to.width / 2);
    const dy = (from.top + from.height / 2) - (to.top + to.height / 2);

    card.popping = true;
    card.style.transition = "none";
    card.style.transform =
      "translate(" + dx.toFixed(1) + "px," + dy.toFixed(1) + "px) scale(" +
      shrink.toFixed(4) + ")" + held;
    void card.offsetWidth;                    // make the browser believe it
    card.style.transition = "transform " + SETTINGS.cardPopMs + "ms " +
                            SETTINGS.cardPopEase;
    card.style.transform = rest && rest !== "none" ? rest : "none";
    clearTimeout(card.popTimer);
    card.popTimer = setTimeout(() => {
      card.style.transition = "";
      card.style.transform = "";
      card.popping = false;
    }, SETTINGS.cardPopMs + 40);
  }

  /* ── the picture carousel ─────────────────────────────────────────────── */
  function showSlide(card, want) {
    const slides = card.querySelectorAll(".tm-slide").length;
    const at = SETTINGS.mediaLoop
      ? (want % slides + slides) % slides
      : clamp(want, 0, slides - 1);
    card.slideAt = at;
    card.querySelector(".tm-track").style.transform = "translateX(" + (-at * 100) + "%)";
    showCaption(card, at);
    card.querySelectorAll(".tm-dot").forEach((dot, k) => dot.classList.toggle("is-on", k === at));
    if (!SETTINGS.mediaLoop) {
      const prev = card.querySelector(".is-prev"), next = card.querySelector(".is-next");
      if (prev) prev.disabled = at === 0;
      if (next) next.disabled = at === slides - 1;
    }
    playTheRightVideo();
  }

  /* The caption under the pictures. It fades out, changes, and fades back in,
     so the words are never caught halfway between two pictures. The timer is
     kept on the card, so clicking quickly through a carousel cancels the
     pending change rather than stacking up several of them. */
  function showCaption(card, at) {
    const boxes = card.querySelectorAll(".tm-slideCaption");
    if (!boxes.length) return;
    const want = (card.captions && card.captions[at]) || "";
    if (boxes[0].textContent === want) return;
    clearTimeout(card.captionTimer);
    boxes.forEach(box => box.classList.add("tm-fading"));
    card.captionTimer = setTimeout(() => {
      boxes.forEach(box => {
        box.textContent = want;
        box.classList.remove("tm-fading");
      });
    }, SETTINGS.captionFadeMs);
  }

  /* Only the video on the visible card's current slide should be running —
     everything else is paused, so nothing plays out of sight. */
  function playTheRightVideo() {
    cards.forEach((card, i) => {
      const showing = i === front() && parseFloat(card.style.opacity || 0) > 0.05;
      card.querySelectorAll(".tm-slide").forEach((slide, k) => {
        const video = slide.querySelector("video");
        if (!video) return;
        /* Fetch ahead. Raising preload from "metadata" to "auto" tells the
           browser to fill the buffer now rather than at the moment play() is
           called — which is the stutter. It is done for the card in front of
           the reader AND for the one either side of it, so a video has
           usually finished arriving before its card does. It is only ever
           raised, never lowered, and load() is deliberately not called: that
           would restart a video that is already running. */
        if (SETTINGS.videoPreloadFront && !onAMeteredLine() && video.preload !== "auto" &&
            Math.abs(i - front()) <= SETTINGS.videoPreloadCards) {
          video.preload = "auto";
        }
        if (showing && k === card.slideAt && SETTINGS.videoAutoplay) {
          const started = video.play();
          if (started && started.catch) started.catch(() => {});   // autoplay refused
        } else {
          video.pause();
        }
      });
    });
  }

  /* ── the text, in pages ───────────────────────────────────────────────────
     The window is set to a whole number of lines so a page never cuts a line
     in half, and the block inside is slid up by exactly that height.        */
  /* How much vertical room a card actually has: the height of the card
     column, which the stylesheet defines as everything between the top band
     and the bottom band. That is true on a phone as well as on a desktop —
     only the size of the bands differs — so there is nothing to work out
     here, and the layout stays defined in exactly one place. */
  function roomForCard() {
    return host.clientHeight;
  }

  /* THE SAME QUESTION, ASKED OF AN EXPANDED CARD.
     In the big view the card is not as tall as its column — its height is set
     by the stylesheet, to whatever makes the picture 4:3 — and the words are
     beside the picture rather than under it. So the room for the text is not
     "the column minus the card" but "the panel beside the picture, minus
     everything else in it": the title, the pager, the facts row, and the
     panel's own padding.

     Measured from the children rather than from scrollHeight, because the
     panel centres what is in it: a panel with room to spare reports a
     scrollHeight equal to its own height, which would say there is no room
     left exactly when there is the most.                                    */
  function roomBesideThePicture(card, win) {
    const inner = card.querySelector(".tm-inner");
    const box = getComputedStyle(inner);
    let taken = 0;
    Array.prototype.forEach.call(inner.children, kid => {
      if (kid === win) return;
      const edges = getComputedStyle(kid);
      taken += kid.getBoundingClientRect().height +
               parseFloat(edges.marginTop) + parseFloat(edges.marginBottom);
    });
    return inner.clientHeight - parseFloat(box.paddingTop) -
           parseFloat(box.paddingBottom) - taken;
  }

  function measurePages(card) {
    const win   = card.querySelector(".tm-textwindow");
    const pages = card.querySelector(".tm-textpages");
    const pager = card.querySelector(".tm-pager");
    const first = pages.querySelector("p");
    if (!first) return;

    /* A CARD THAT IS NOT PAINTED IS NOT MEASURED. Breaking the text into
       pages costs a layout per card, and the main map holds thirty-six of
       them while showing at most one — measuring them all on every resize
       took a quarter of a second there and changed nothing anybody could see.
       A hidden card is marked instead, and measured when it is shown; see
       measureOne, which the page calls as it opens one. On a trail page no
       card is ever hidden this way, so nothing there changes. */
    if (getComputedStyle(card).visibility === "hidden") {
      card.needsMeasuring = true;
      return;
    }
    card.needsMeasuring = false;

    const lineHeight = parseFloat(getComputedStyle(first).lineHeight) || 20;
    const wanted = parseFloat(getComputedStyle(card).getPropertyValue("--card-text-lines")) || 6;
    let lines = wanted;

    if (host.classList.contains("is-big")) {
      /* THE BIG VIEW. The card's height is already decided, so the question
         is only how much of the panel beside the picture is left once the
         title, the pager and the facts have taken theirs. It is usually
         enough that a waypoint which was three pages becomes one. */
      const hadPager = pager.classList.contains("is-on");
      pager.classList.add("is-on");                  // measure the worst case
      win.style.height = "0px";
      const spare = roomBesideThePicture(card, win);
      pager.classList.toggle("is-on", hadPager);
      lines = clamp(Math.floor(spare / lineHeight), SETTINGS.cardMinLines, wanted);

    } else if (SETTINGS.cardFitsWindow) {
      // Measure the card with no text at all and the arrows showing — the
      // worst case — then give the text whatever room is left over. This is
      // what stops a tall picture pushing the card down over the readouts on
      // a short window.
      const hadPager = pager.classList.contains("is-on");
      pager.classList.add("is-on");
      win.style.height = "0px";
      const everythingElse = card.getBoundingClientRect().height;
      pager.classList.toggle("is-on", hadPager);

      const spare = roomForCard() - everythingElse;
      lines = clamp(Math.floor(spare / lineHeight), SETTINGS.cardMinLines, wanted);
    }

    const pageHeight = Math.round(lineHeight * Math.max(1, lines));
    const fullHeight = pages.scrollHeight;
    card.pageHeight = pageHeight;
    card.pageCount = SETTINGS.pageLongText
      ? Math.max(1, Math.ceil(fullHeight / pageHeight))
      : 1;
    // a short entry gets a short window rather than a page-sized hole; a long
    // one is clamped to exactly one page and turns the rest into pages
    win.style.height = Math.min(fullHeight, pageHeight) + "px";
    card.pageAt = Math.min(card.pageAt, card.pageCount - 1);
    pager.classList.toggle("is-on", card.pageCount > 1);
    showPage(card, card.pageAt);
  }

  function showPage(card, want) {
    const at = clamp(want, 0, card.pageCount - 1);
    card.pageAt = at;
    card.querySelector(".tm-textpages").style.transform = "translateY(" + (-at * card.pageHeight) + "px)";
    card.querySelector(".tm-prevpage").disabled = at === 0;
    card.querySelector(".tm-nextpage").disabled = at >= card.pageCount - 1;
    card.querySelector(".tm-pagecount").textContent = (at + 1) + " / " + card.pageCount;
  }

  cards.forEach(measurePages);
  addEventListener("resize", () => cards.forEach(measurePages));
  // a webfont arriving late changes the line height, so measure again once the
  // fonts have settled
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(() => cards.forEach(measurePages));
  }
  /* ══ THE EXPANDED CARD ═══════════════════════════════════════════════════
     The button beside the × puts one waypoint in the middle of the screen at
     about three times the size, over a veil, with the walk held still behind
     it. The layout is entirely in the stylesheet — see THE EXPANDED CARD
     there — and everything below is the handful of things a stylesheet
     cannot do: deciding when to offer it, holding the page still, and moving
     the panel between the two sizes rather than letting it jump.

     WHY THE MOVE IS DONE HERE AND NOT IN CSS. The two views are different
     layouts, not different sizes: the picture is above the words in one and
     beside them in the other, and the text is re-broken into pages for the
     new shape. None of that can be interpolated. So the change happens while
     the contents are invisible — 130 milliseconds of fade, which is short
     enough to read as one movement — and what IS animated is the panel
     itself, from the box it had to the box it will have. The measurement of
     both boxes is the only reason this is in JavaScript at all.            */
  const veilBox = veil;
  const GLIDE_EASE = "cubic-bezier(.22,.61,.36,1)";
  let bigOn = false, bigAt = -1, changing = 0, gliding = 0;

  /* Whether this window is worth offering the big view on at all. It has to
     agree with the media query on .tm-grow in the stylesheet: the button is
     hidden below these sizes, and this is what stops anything else — a link
     arriving from the Wishful thinking page, say — opening a view the window
     cannot hold. */
  const roomToGrow = () =>
    SETTINGS.cardCanGrow &&
    window.innerWidth  >= SETTINGS.cardGrowsFrom &&
    window.innerHeight >= SETTINGS.cardGrowsAbove;

  /* Asked every time rather than once, because it can be changed while the
     page is open. Somebody who has asked their computer for less movement
     still gets the bigger card — they simply get it at once, without the
     panel travelling across the screen to arrive at it. */
  const wantsStillness = () =>
    window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* Move the panel from the box it had to the box it now has.
     It is pinned to the window for the length of the move — position:fixed,
     with the four measurements written on it — so that it is out of the
     column's way while the column itself is changing shape underneath. Only
     the properties this sets are cleared afterwards: the drawing loop writes
     opacity and --card-nudge on the same element every frame, and wiping the
     style outright would take the card's own visibility with it. */
  function glide(card, from, to) {
    const s = card.style;
    const mine = ["position", "margin", "transform", "left", "top",
                  "width", "height", "transition"];
    const letGo = () => mine.forEach(p => s.removeProperty(p));

    letGo();
    s.transition = "none";
    s.position = "fixed"; s.margin = "0"; s.transform = "none";
    s.left = from.left + "px"; s.top = from.top + "px";
    s.width = from.width + "px"; s.height = from.height + "px";
    void card.offsetWidth;              // start the move from there, not here

    s.transition = ["left", "top", "width", "height"]
      .map(p => p + " " + SETTINGS.cardGrowMs + "ms " + GLIDE_EASE).join(", ");
    s.left = to.left + "px"; s.top = to.top + "px";
    s.width = to.width + "px"; s.height = to.height + "px";

    /* The contents come back before the panel has quite finished arriving.
       The easing puts most of the distance in the first half, so by then it is
       within a few pixels of home, and waiting for the last of it makes the
       whole thing feel slow for no gain. */
    clearTimeout(gliding);
    setTimeout(() => card.classList.remove("is-changing"),
               Math.round(SETTINGS.cardGrowMs * 0.6));
    gliding = setTimeout(() => { letGo(); wake(); }, SETTINGS.cardGrowMs);
  }

  /* on: true to expand, false to put it back.
     i:  which card. Left out, it is whichever one is expanded.
     quiet: change without the fade or the move — used when the card is being
            closed anyway, so the two do not animate over each other. */
  function setBig(on, i, quiet) {
    if (typeof i !== "number" || i < 0) i = bigAt >= 0 ? bigAt : front();
    const card = cards[i];
    if (!card || on === bigOn) return;
    if (on && !roomToGrow()) return;

    bigOn = on;
    bigAt = on ? i : -1;
    veilBox.classList.toggle("is-on", on);
    /* THE PAGE IS TOLD, AND DECIDES WHAT TO HOLD STILL. A trail page holds
       its scroll, because scrolling it is walking the trail; the main map
       holds the map, because dragging it is moving about. Neither is a card's
       business, and a card that reached out and froze the page would be wrong
       on one of the two. */
    onBig(on, i);
    if (on) onOpen(i);        // it stays put, whatever the page says

    const button = card.querySelector(".tm-grow");
    if (button) {
      button.setAttribute("aria-pressed", on ? "true" : "false");
      button.title = on ? WORDS.shrinkCard : WORDS.growCard;
      button.setAttribute("aria-label", button.title);
    }

    if (quiet || wantsStillness()) {
      host.classList.toggle("is-big", on);
      card.classList.remove("is-changing");
      cards.forEach(measurePages);
      wake();
      return;
    }

    // 1. the contents go out
    card.classList.add("is-changing");
    clearTimeout(changing);
    changing = setTimeout(() => {
      // 2. the shape changes while there is nothing to see changing, and the
      //    text is re-broken into pages against the size it is about to have
      const from = card.getBoundingClientRect();
      host.classList.toggle("is-big", on);
      cards.forEach(measurePages);
      const to = card.getBoundingClientRect();
      // 3. and the panel travels from the one to the other
      glide(card, from, to);
      wake();
    }, SETTINGS.cardGrowFadeMs);
  }
  return {
    popFrom:    popFrom,
    cards:      cards,
    setBig:     setBig,
    isBig:      () => bigOn,
    bigAt:      () => bigAt,
    roomToGrow: roomToGrow,
    measureAll: () => cards.forEach(measurePages),
    measureOne: measurePages,
    showSlide:  showSlide,
    showPage:   showPage,
    showCaption: showCaption,
    playTheRightVideo: playTheRightVideo,
  };
};
