/* ═══════════════════════════════════════════════════════════════════════════
   HAPPY TRAILS — THE WAYPOINT CARD
   version 2.3

   ONE CARD, USED IN TWO PLACES. A waypoint card — the picture, the caption,
   the paged text, the facts along the bottom, the × and the expand button —
   is the same object on a trail page and on the main map. A card written
   twice is a card that goes out of step, so it lives here and both pages load
   it.

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

   and it hands back { cards, setBig, isBig, roomToGrow, measureOne, showSlide,
   showPage, playTheRightVideo, peek }.

   NOTHING IN HERE TOUCHES THE PAGE OUTSIDE `host` AND `veil`. It reads no
   global, holds no scroll position and knows nothing about a map. That is
   what makes it safe to run two of them, or none.
   ═══════════════════════════════════════════════════════════════════════════ */

window.HappyTrailsCards = function (opts) {
  "use strict";

  /* ── THE CARD'S OWN WORDS ────────────────────────────────────────────────
     Everything written on a card that is not the waypoint's own text. They
     live here rather than in each page, so the two pages cannot drift apart.
     A page may still override any of them by passing `words`; anything it
     leaves out falls back to this. */
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
    pictureWord:     "Picture",     // names each pager dot: "Picture 2 / 5"
    /* UP AND DOWN, because the words slide vertically in a window */
    previousPage:    "Back up the text",
    nextPage:        "Further down the text",
    cost:          "Cost",
    priority:      "Priority",
    level_low:     "Low",
    level_medium:  "Medium",
    level_high:    "High",
    /* the compact card: what it says on the button that opens it up */
    peekGo:        "Open",
    peekGoLong:    "Open this waypoint",
    openOnTrail:   "Open card on trail page",
    copyLink:      "Copy location",
    copyLinkLong:  "Copy a link to this waypoint",
    copied:        "Copied",
  };

  /* ── AND ITS OWN SETTINGS ────────────────────────────────────────────────
     The same arrangement as the words: the card knows what it needs, a page
     overrides what it cares about. A trail page passes its whole SETTINGS
     block, which names every one of these. */
  const CARD_SETTINGS = {
    captionFadeMs:      180,
    cardCanGrow:        true,
    /* how long a compact card takes to unfold, which the stylesheet also reads
       as --peek-grow; this copy is only for knowing when to re-measure the
       pages of text, so keep the two equal */
    peekGrowMs:         380,
    cardFitsWindow:     true,
    cardGrowFadeMs:     130,
    cardGrowMs:         260,
    cardGrowsAbove:     620,
    cardGrowsFrom:      1100,
    cardMinLines:       3,
    cardsCanBeClosed:   true,
    compareClickToMove: true,
    compareStartsAt:    50,
    compareStep:        4,
    iconFolder:         "icons/",
    mediaFolder:        "",
    mediaLoop:          true,
    pageLongText:       true,
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

  /* Copied from trail-engine.js rather than shared, because a file whose whole
     point is that it stands on its own should not need a third file to clamp a
     number. */
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

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

  /* Put SETTINGS.mediaFolder in front of a filename. Anything that already
     names where it lives — a full URL, a path from the site root, or an
     inline data: image — is handed back untouched. */
  function mediaPath(name) {
    if (typeof name !== "string" || !name) return name;
    if (/^(https?:|data:|blob:|\/)/i.test(name)) return name;
    /* THE FILE NAMES HAVE SPACES AND BRACKETS IN THEM ("don (94).jpg"). A raw
       space in an attribute works in every browser, but it is not a valid URL
       and works until a proxy, a CDN or a strict server decides it does not.
       encodeURI leaves the slashes and the brackets alone and fixes the
       spaces, which is exactly the amount of fixing wanted. */
    return encodeURI(SETTINGS.mediaFolder + name);
  }

  /* Turn whatever the waypoint gave us into a tidy list of slides. `media`
     may be one string or a list; `photo` is the older name for the same
     thing; nothing at all gets the placeholder graphic. */
  function slidesFor(stop, i) {
    let given = stop.media || stop.photo || null;
    // one entry may be written on its own rather than in a list — a bare
    // filename, or a single { src, caption } — so wrap anything that is not
    // already a list before going on
    if (given && !Array.isArray(given)) given = [given];
    if (!given || !given.length) return [{ src: standInPhoto(i), kind: "placeholder" }];
    return given.map(entry => {
      /* A PAIR OF FILES IS A BEFORE-AND-AFTER SLIDER — but only on a PROPOSAL.
         A slider says "this is how it is, and this is how it could be", which
         is meaningless on a waypoint that already exists: there is no "after"
         for a bridge that is standing there. So an ordinary waypoint handed a
         pair shows the BEFORE on its own.

         The rule is also applied in media_picks.py and trails_data.py. It is
         applied here on purpose too: those are about the table, and a card
         should not be able to build a control that does not belong on it
         whatever it is handed. */
      if (entry && entry.before && entry.after && stop.kind !== "wishful") {
        entry = { src: entry.before, caption: entry.caption || "" };
      }
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
     THIS IS ABOUT THE SMALL CARD, where the caption shares the title's line
     until the two will not fit, at which point the title drops below it.
     Without this, paging from a short caption to a long one on the same card
     would jerk the title, and everything under it, down a line and back up.

     So the caption is given a floor as wide as the WIDEST of that card's
     captions. Every picture on the card then lays out the same way, decided
     once by the longest. Short captions still sit flush right inside that
     room, so nothing looks padded.

     MEASURED ON A CANVAS, not in the page. The cards are built before any of
     them is shown, and a hidden element has no width to read; a canvas will
     measure text in a given font without the text being anywhere.

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

  /* If the fonts were still loading, the widest caption may not be the one
     that ends up widest; measure again once the real fonts are in. */
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(() => {
      document.querySelectorAll(".tm-card").forEach(holdRoomForTheLongestCaption);
    });
  }

  /* WHAT A PICTURE SAYS TO SOMEONE WHO CANNOT SEE IT. Almost no picture has a
     caption of its own, so the fallback is the waypoint's name and the
     picture's place in its set; a `alt` written into a picture's entry in
     trails_data.py wins over both, and a caption wins over the fallback. The
     text goes into an attribute, so it is read as plain text first (titles
     are written as HTML) and then escaped. */
  function plainText(html) {
    const holder = document.createElement("div");
    holder.innerHTML = html || "";
    return holder.textContent.trim();
  }
  function inAttribute(text) {
    return text.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
  }
  function describe(m, k, n, stop) {
    const own = plainText(m.alt || m.caption);
    return inAttribute(own || plainText(stop.title) +
      (n > 1 ? ", " + WORDS.pictureWord.toLowerCase() + " " + (k + 1) + " / " + n : ""));
  }

  function slideHtml(m, k, n, stop) {
    const says = describe(m, k, n, stop);
    if (m.kind === "compare") {
      // "after" underneath, "before" on top and clipped — the handle moves the
      // clip, so dragging it wipes from one to the other
      return '<div class="tm-slide"><div class="tm-compare" style="--split:' +
             SETTINGS.compareStartsAt + '%">' +
             '<img class="tm-after" alt="' + says + ", " + inAttribute(WORDS.afterLabel) +
             '" src="' + m.after + '">' +
             '<img class="tm-before" alt="' + says + ", " + inAttribute(WORDS.beforeLabel) +
             '" src="' + m.before + '">' +
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
      return '<div class="tm-slide"><video aria-label="' + says + '" src="' + m.src +
             '" playsinline preload="' +
             SETTINGS.videoPreload + '"' +
             (SETTINGS.videoMuted ? " muted" : "") +
             (SETTINGS.videoLoop ? " loop" : "") +
             (SETTINGS.videoControls ? " controls" : "") + "></video>" +
             (SETTINGS.videoSpinner ? '<div class="tm-spinner" aria-hidden="true"></div>' : "") +
             "</div>";
    }
    /* HELD BACK UNTIL IT IS WANTED. Every card on a page is built up front,
       and the main map has dozens of them across many trails' media folders;
       without `lazy` opening the map fetched pictures nobody had asked to see.
       It costs the trail pages nothing: a card about to fade in is on screen,
       and the browser fetches it. */
    return '<div class="tm-slide"><img alt="' + (m.kind === "placeholder" ? "" : says) +
           '" loading="lazy" decoding="async" src="' + m.src + '">' +
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
    /* THE TWO FIGURES CARRY A CLASS so a narrow screen can put them away: on a
       phone every line of the card is a line of words that could have been
       read instead, and both numbers are also on the elevation graph. */
    if (haveHeights) facts.push('<div class="tm-fact"><small>' + WORDS.elevation + "</small>" + Math.round(s.metres) + " " + WORDS.metres + "</div>");
    if (perMetre)    facts.push('<div class="tm-fact"><small>' + WORDS.fromStart + "</small>" + (s.distance * perMetre / 1000).toFixed(1) + " " + WORDS.km + "</div>");
    /* WISHFUL STOPS CARRY TWO MORE FACTS — what it would cost to build and how
       badly it is wanted. They read as the third and fourth figures after
       Elevation and From start, rather than as a loud panel of their own. */
    facts.push(judgementRow(s));
    /* the link button sits in the same row, at the far end; a waypoint with no
       mapLink gets no button */
    if (s.mapLink) facts.push(
      '<a class="tm-mapLink" href="' + s.mapLink + '" target="_blank" rel="noopener">' +
      WORDS.mapLink + "</a>");
    /* ONE MORE BUTTON, WHERE THE CARD IS NOT ON ITS OWN TRAIL. A card opened
       from the main map is a visitor, with no way through to the rest of the
       trail. `goTo` is that way through — the waypoint's own address on its own
       page, which opens there with the card already up. A card on its own
       trail page passes nothing and gets no button. */
    if (s.goTo) facts.push(
      '<a class="tm-goTo" href="' + s.goTo + '">' +
      (s.goToLabel || WORDS.openOnTrail) +
      '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" ' +
      'stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">' +
      '<path d="M5 12h13M12 5l7 7-7 7"/></svg></a>');

    /* AND ITS OWN ADDRESS (don.html#half-mile-bridge). `share` is given by
       whoever built the deck, because only they know whether this card is on
       its own trail's page or on the main map.

       LAST, so it is the bottom right corner of the card: everything from the
       Google maps link onwards is pushed to the right-hand end of the row, and
       whatever is written last in that group is furthest right. */
    if (s.share) facts.push(
      '<button class="tm-copy" type="button" data-share="' + s.share + '" ' +
      'title="' + WORDS.copyLinkLong + '">' +
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ' +
      'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      '<path d="M10 13.5a4 4 0 0 0 5.7.4l3-3a4 4 0 0 0-5.7-5.7l-1.7 1.7"/>' +
      '<path d="M14 10.5a4 4 0 0 0-5.7-.4l-3 3a4 4 0 0 0 5.7 5.7l1.7-1.7"/></svg>' +
      '<span>' + WORDS.copyLink + '</span></button>');

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
         drawn into it and the stylesheet shows whichever one is right, so only
         its label changes. It is hidden entirely on anything smaller than a
         desktop window: see .tm-grow in the stylesheet. */
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
        '<div class="tm-track">' + slides.map((m, k) => slideHtml(m, k, slides.length, s)).join("") + "</div>" +
        /* THE WAYPOINT NUMBER SITS ON THE PICTURE, top left, because a card's
           scarcest thing is room for words.

           ON THE MAIN MAP THE STAMP NAMES THE TRAIL INSTEAD. There, the few
           waypoints shown are not a sequence and "Waypoint 02 of 07" would be
           counting something the reader cannot see. `numbering` picks between
           the two, and a stop may carry its own `stamp` to say it outright. */
        '<div class="tm-stamp">' +
          '<div class="tm-count">' +
          (numbering
            ? WORDS.waypoint + " " + String(i + 1).padStart(2, "0") +
              " <span>" + WORDS.outOf + " " + String(stops.length).padStart(2, "0") + "</span>"
            : (s.stamp || s.trailName || "")) +
          "</div>" +
        "</div>" +
        /* ── THE COMPACT CARD ────────────────────────────────────────────
           On a phone — and on a desktop with waypoint auto-load switched off —
           a waypoint opens as a quarter of a card: the picture, the name of
           the place over it, and a button.

           On a phone the card IS the screen, and a full card covering the map
           you have just tapped a point on hides the thing that raised it. A
           strip along the bottom says "this is where you are" and leaves the
           map above it.

           IT IS THE SAME CARD, not a second one that could drift from the
           first: the same markup with two states. The small state holds the
           media to a quarter height, puts this overlay on top and folds the
           words away; opening it unfolds them, and the picture does not
           reload. */
        '<div class="tm-peek">' +
          '<div class="tm-peekTitle">' + s.title + "</div>" +
          '<button class="tm-peekGo" type="button">' +
            '<span>' + WORDS.peekGo + "</span>" +
            '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" ' +
            'stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">' +
            '<path d="M5 9l7 7 7-7"/></svg>' +
          "</button>" +
        "</div>" +
        /* THE PICTURE'S CAPTION, in the opposite corner, shown only when the card
           is expanded. The small card's copy sits beside the title; both are
           written into the card and filled together, and the stylesheet shows
           whichever one belongs. */
        '<div class="tm-slideCaption"></div>' +
        (many
          ? '<button class="tm-media-arrow is-prev" type="button" title="' + WORDS.previousPicture +
            '" aria-label="' + WORDS.previousPicture + '">&lsaquo;</button>' +
            '<button class="tm-media-arrow is-next" type="button" title="' + WORDS.nextPicture +
            '" aria-label="' + WORDS.nextPicture + '">&rsaquo;</button>' +
            '<div class="tm-dots">' +
            slides.map((m, k) => '<button class="tm-dot' + (k ? "" : " is-on") +
                                 '" type="button" data-slide="' + k + '" aria-label="' +
                                 WORDS.pictureWord + " " + (k + 1) + " / " + slides.length +
                                 '"' + (k ? "" : ' aria-current="true"') + '></button>').join("") +
            "</div>"
          : "") +
      "</div>" +

      /* THE WRAPPER IS NOT DECORATION. Folding the words away is done with
         grid-template-rows going from 1fr to 0fr, which needs a grid parent —
         rather than a max-height, because a guessed max clips the text if too
         small and animates empty space if too large. See .tm-innerWrap in the
         stylesheet. */
      '<div class="tm-innerWrap"><div class="tm-inner">' +
        /* THE TITLE AND THE SMALL CARD'S CAPTION SHARE A LINE, so the caption
           needs no row of its own. In the big view this copy is hidden and the
           one on the photograph is shown instead.

           THE CAPTION IS WRITTEN FIRST, AND MOVED TO THE RIGHT BY THE
           STYLESHEET (the row is laid out in reverse). That is deliberate:
           when the two are too long to share a line, the second one written is
           the one that drops to a line of its own, and it must be the TITLE
           that drops, so the caption keeps the corner under its photograph. */
        '<div class="tm-titleRow">' +
          '<div class="tm-slideCaption"></div>' +
          "<h2>" + s.title + "</h2>" +
        "</div>" +
        '<div class="tm-textwindow"><div class="tm-textpages">' + paragraphsFor(s) + "</div></div>" +
        /* ── THE TWO ARROWS THAT MOVE THE TEXT ─────────────────────────
           UP AND DOWN, because the words slide vertically in a window. There
           is no page count: the arrow greys out when there are no more pages,
           which says the same thing without costing a line of the card's
           height. The pair sits on the rule below the text rather than above
           it, which saves another line. See .tm-pager in the stylesheet. */
        '<div class="tm-pager">' +
          '<button class="tm-prevpage" type="button" title="' + WORDS.previousPage +
          '" aria-label="' + WORDS.previousPage + '">' +
          '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" ' +
          'stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">' +
          '<path d="M5 15l7-7 7 7"/></svg></button>' +
          '<button class="tm-nextpage" type="button" title="' + WORDS.nextPage +
          '" aria-label="' + WORDS.nextPage + '">' +
          '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" ' +
          'stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">' +
          '<path d="M5 9l7 7 7-7"/></svg></button>' +
        "</div>" +
        (facts.filter(Boolean).length
          ? '<div class="tm-facts">' + facts.filter(Boolean).join("") + "</div>" : "") +
      "</div></div>";

    host.appendChild(card);
    // one caption per slide, in the same order as the pictures
    card.captions = slides.map(m => m.caption || "");
    // BOTH copies of the caption — the one beside the title and the one on
    // the picture — are filled every time. Only one of them is ever shown.
    card.querySelectorAll(".tm-slideCaption")
        .forEach(box => { box.textContent = card.captions[0] || ""; });
    holdRoomForTheLongestCaption(card);
    /* ── THE COMPACT CARD'S ONE BUTTON ──────────────────────────────────
       It unfolds this card and nothing else: no state anywhere but a class.
       `card:grew` is raised afterwards because how many pages of text a card
       has depends on how tall it is, and it has just changed height.

       stopPropagation because a card on a map is sitting on a thing that also
       takes clicks, and "open this" must not also mean "close this and go back
       to the map". */
    const peekGo = card.querySelector(".tm-peekGo");
    if (peekGo) {
      peekGo.title = WORDS.peekGoLong;
      peekGo.setAttribute("aria-label", WORDS.peekGoLong + ": " + s.title);
      peekGo.addEventListener("click", e => {
        e.stopPropagation();
        e.preventDefault();
        grow(card);
      });
    }

    card.slideAt = 0;                      // which picture is showing
    card.pageAt = 0;                       // which page of text is showing
    card.pageCount = 1;
    card.pageHeight = 0;

    /* COPYING IT. Where the clipboard call is refused — an old browser, a page
       served over plain http — the button says nothing rather than throwing,
       and the address is still in the address bar. */
    const copy = card.querySelector(".tm-copy");
    if (copy) copy.addEventListener("click", () => {
      const say = copy.querySelector("span");
      const was = say.dataset.was || say.textContent;
      say.dataset.was = was;
      const done = () => {
        say.textContent = WORDS.copied;
        copy.classList.add("is-done");
        clearTimeout(copy.saidIt);
        copy.saidIt = setTimeout(() => {
          say.textContent = was;
          copy.classList.remove("is-done");
        }, 1800);
      };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(copy.dataset.share).then(done, () => {});
      }
    });

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

  /* ── the picture carousel ─────────────────────────────────────────────── */
  function showSlide(card, want) {
    const slides = card.querySelectorAll(".tm-slide").length;
    const at = SETTINGS.mediaLoop
      ? (want % slides + slides) % slides
      : clamp(want, 0, slides - 1);
    card.slideAt = at;

    /* ── THE PICTURES SLIDE ────────────────────────────────────────────────
       They sit in a row and the row moves, so the next picture comes in from
       the side you pressed.

       TRAP: `transition` is a SHORTHAND, so a second stylesheet rule setting
       it on this element replaces the first outright and silently kills the
       movement. Keep every transition for the track in one declaration. */
    card.querySelector(".tm-track").style.transform = "translateX(" + (-at * 100) + "%)";
    showCaption(card, at);
    card.querySelectorAll(".tm-dot").forEach((dot, k) => {
      dot.classList.toggle("is-on", k === at);
      if (k === at) dot.setAttribute("aria-current", "true"); else dot.removeAttribute("aria-current");
    });
    if (!SETTINGS.mediaLoop) {
      const prev = card.querySelector(".is-prev"), next = card.querySelector(".is-next");
      if (prev) prev.disabled = at === 0;
      if (next) next.disabled = at === slides - 1;
    }
    playTheRightVideo();
  }

  /* The caption under the pictures fades out, changes, and fades back in, so
     the words are never caught halfway between two pictures. The timer is kept
     on the card, so clicking quickly through a carousel cancels the pending
     change rather than stacking up several. */
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
        /* Fetch ahead. Raising preload from "metadata" to "auto" makes the
           browser fill the buffer now rather than when play() is called, which
           is the stutter. It is done for the card in front AND the ones either
           side of it. It is only ever raised, and load() is deliberately not
           called: that would restart a video that is already running. */
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
     and the bottom band, so the layout stays defined in exactly one place. */
  function roomForCard() {
    return host.clientHeight;
  }

  /* THE SAME QUESTION, ASKED OF AN EXPANDED CARD.
     In the big view the card's height is set by the stylesheet, to whatever
     makes the picture 4:3, and the words are beside the picture. So the room
     for the text is "the panel beside the picture, minus everything else in
     it": the title, the pager, the facts row, and the panel's padding.

     Measured from the children rather than from scrollHeight, because the
     panel centres what is in it and a panel with room to spare reports a
     scrollHeight equal to its own height.                                   */
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
       pages costs a layout per card, and the main map holds dozens of them
       while showing at most one. A hidden card is marked instead, and measured
       when it is shown; see measureOne, which the page calls as it opens one. */
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
         title, the pager and the facts have taken theirs. */
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

  /* UNFOLDING A COMPACT CARD. `is-peek` is what holds it small; taking it off
     lets the stylesheet do the growing. The re-measure a moment later is for
     the pages of text, which depend on that height and could not have been
     counted while it was folded. */
  function grow(card) {
    if (!card.classList.contains("is-peek")) return;
    card.classList.remove("is-peek");
    card.classList.add("is-grown");
    setTimeout(() => {
      measurePages(card);
      card.dispatchEvent(new CustomEvent("card:grew", { bubbles: true }));
    }, SETTINGS.peekGrowMs);
  }

  /* AND FOLDING ONE BACK when a card is closed, so the next time it opens
     small again. `is-grown` going with it lets the stylesheet tell "never been
     opened" from "opened and put away". */
  function peek(card, on) {
    if (!card) return;
    card.classList.toggle("is-peek", !!on);
    if (on) card.classList.remove("is-grown");
  }

  function showPage(card, want) {
    const at = clamp(want, 0, card.pageCount - 1);
    card.pageAt = at;
    card.querySelector(".tm-textpages").style.transform = "translateY(" + (-at * card.pageHeight) + "px)";
    card.querySelector(".tm-prevpage").disabled = at === 0;
    card.querySelector(".tm-nextpage").disabled = at >= card.pageCount - 1;
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
     there — and everything below is what a stylesheet cannot do: deciding
     when to offer it, holding the page still, and moving the panel between
     the two sizes rather than letting it jump.

     WHY THE MOVE IS DONE HERE AND NOT IN CSS. The two views are different
     layouts, not different sizes (picture above the words, or beside them),
     and the text is re-broken into pages for the new shape; none of that can
     be interpolated. So the change happens while the contents are invisible
     and what IS animated is the panel itself, from the box it had to the box
     it will have. Measuring both boxes is the only reason this is in
     JavaScript.                                                             */
  const veilBox = veil;
  const GLIDE_EASE = "cubic-bezier(.22,.61,.36,1)";
  let bigOn = false, bigAt = -1, changing = 0, gliding = 0;

  /* Whether this window is worth offering the big view on at all. It has to
     agree with the media query on .tm-grow in the stylesheet: the button is
     hidden below these sizes, and this stops anything else opening a view the
     window cannot hold. */
  const roomToGrow = () =>
    SETTINGS.cardCanGrow &&
    window.innerWidth  >= SETTINGS.cardGrowsFrom &&
    window.innerHeight >= SETTINGS.cardGrowsAbove;

  /* Asked every time rather than once, because it can change while the page
     is open. Somebody who has asked for less movement still gets the bigger
     card, at once, without the panel travelling. */
  const wantsStillness = () =>
    window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ── NOTHING IS DECODING WHILE THE PANEL IS MOVING ───────────────────────
     The move animates left, top, width and height, which is a layout on every
     frame, and a VIDEO PLAYING INSIDE THAT is a second full-time job on the
     same thread: that was the stutter on the trails with video.

     So the video stops for the length of the move and starts again at the end
     of it. `playTheRightVideo` is what starts it again, because it is the one
     place that knows WHICH video should be playing — by then the card may be a
     different shape with a different slide showing.

     It is safe when there is nothing playing: no video, a paused one, or a
     browser that cannot play the format all take the same path, which is to
     do nothing. */
  function hushVideo(card) {
    const playing = [];
    if (!card) return playing;
    card.querySelectorAll("video").forEach(video => {
      if (!video.paused && !video.ended) { playing.push(video); video.pause(); }
    });
    return playing;
  }

  /* ── THE OTHER CARDS, MEASURED WHEN NOBODY IS WATCHING ───────────────────
     Every card's text is broken into pages against the height it has, so a
     change of shape invalidates all of them. Doing them all at the moment the
     shape changes makes the move stutter; doing none would leave the next card
     with its pages broken for the other size.

     So they are done afterwards, a few at a time, in idle moments.
     `requestIdleCallback` is not in every browser, so a plain timer stands in
     for it. A card the reader reaches first is not a problem: the pages are
     measured again whenever a card is shown. */
  let measuringRest = 0;
  function lateMeasure(except) {
    clearTimeout(measuringRest);
    const rest = cards.filter(c => c !== except);
    const idle = window.requestIdleCallback ||
                 (fn => setTimeout(() => fn({ timeRemaining: () => 8 }), 60));
    measuringRest = setTimeout(() => {
      const next = () => idle(deadline => {
        // a handful per idle moment, or one if the browser is in a hurry
        let did = 0;
        while (rest.length && (did < 4 || deadline.timeRemaining() > 4)) {
          measurePages(rest.shift());
          did++;
          if (did >= 8) break;
        }
        if (rest.length) next();
      });
      next();
    }, SETTINGS.cardGrowMs);
  }

  /* Move the panel from the box it had to the box it now has. It is pinned to
     the window for the length of the move (position:fixed, the four
     measurements written on it) so it is out of the column's way while the
     column changes shape. Only the properties this sets are cleared
     afterwards: the drawing loop writes opacity and --card-nudge on the same
     element every frame, and wiping the style outright would take the card's
     own visibility with it. */
  function glide(card, from, to) {
    const s = card.style;
    const mine = ["position", "margin", "transform", "left", "top",
                  "width", "height", "transition"];
    const letGo = () => mine.forEach(p => s.removeProperty(p));
    const held = hushVideo(card);

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

    /* The contents come back before the panel has quite finished arriving: the
       easing puts most of the distance in the first half, and waiting for the
       last of it feels slow for no gain. */
    clearTimeout(gliding);
    setTimeout(() => card.classList.remove("is-changing"),
               Math.round(SETTINGS.cardGrowMs * 0.6));
    gliding = setTimeout(() => {
      letGo();
      // and the picture moves again, if it was moving before
      if (held.length) playTheRightVideo();
      wake();
    }, SETTINGS.cardGrowMs);
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
       holds the map. A card that froze the page itself would be wrong on one
       of the two. */
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
      /* 2. the shape changes while there is nothing to see changing, and the
            text is re-broken into pages against the size it is about to have.

            ONLY THIS CARD'S TEXT, THOUGH. Re-breaking every card in the frame
            the move begins on makes the move start by standing still. The
            others are done later: see `lateMeasure`. */
      const from = card.getBoundingClientRect();
      host.classList.toggle("is-big", on);
      measurePages(card);
      const to = card.getBoundingClientRect();
      // 3. and the panel travels from the one to the other
      glide(card, from, to);
      lateMeasure(card);
      wake();
    }, SETTINGS.cardGrowFadeMs);
  }
  return {
    cards:      cards,
    setBig:     setBig,
    isBig:      () => bigOn,
    roomToGrow: roomToGrow,
    measureOne: measurePages,
    showSlide:  showSlide,
    showPage:   showPage,
    playTheRightVideo: playTheRightVideo,
    /* the compact card: fold one back from outside (it unfolds itself) */
    peek:       peek,
  };
};
