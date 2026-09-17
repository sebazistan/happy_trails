/* ═══════════════════════════════════════════════════════════════════════════
   TRAIL ENGINE — shared by every trail page on the site
   version 4.9

   WHAT THIS IS. One copy of the machinery that walks a map along a route as
   you scroll. Every trail page loads this same file, so a visitor downloads it
   once and it is cached for every trail after that, and a fix made here is a
   fix on every trail at the same time.

   WHAT A TRAIL PAGE LOOKS LIKE. Four things, in this order:

     1. <head>          its own title, description and social preview
     2. <script>        SETTINGS, WORDS and WAYPOINTS — everything that makes
                        this trail this trail — ending with
                            window.TRAIL_PAGE = { SETTINGS, WORDS, WAYPOINTS };
     3. <template id="tm-artwork">   the map, as one <svg>
     4. <script src="trail-engine.js"></script>

   The page supplies no markup of its own. The interface — the bar, the map
   stage, the card column, the readouts, the panels — is written by this file,
   from ONE place, so all the trails cannot drift apart from one another.

   TO CHANGE A TRAIL, edit its own page. To change how trails WORK, edit this.
   Colours, sizes and fonts are in happy-trails.css, shared the same way.
   ═══════════════════════════════════════════════════════════════════════════ */

(function () {
  "use strict";

/* Everything this trail is, handed over by its own page. A page that forgets
   to set it gets told so plainly rather than failing somewhere deep in the
   engine with an error about undefined properties. */
var PAGE = window.TRAIL_PAGE;
if (!PAGE || !PAGE.WAYPOINTS) {
  document.title = "Trail page not set up";
  document.body.innerHTML =
    '<div style="font:16px/1.6 system-ui;max-width:44rem;margin:14vh auto;padding:0 6vw;color:#ddd">' +
    "<h1 style=\"font-size:20px\">This trail page has no waypoints</h1>" +
    "<p>trail-engine.js expects the page to set <code>window.TRAIL_PAGE = " +
    "{ SETTINGS, WORDS, WAYPOINTS }</code> in a &lt;script&gt; BEFORE it loads " +
    "this file. See the top of trail-engine.js for the four parts of a trail " +
    "page.</p></div>";
  return;
}

/* ═══════════════════════════════════════════════════════════════════════════
   THE DEFAULTS
   Every setting a trail page can have, with what it means, and the value it
   takes if the page says nothing.

   A TRAIL PAGE ONLY LISTS WHAT IS DIFFERENT ABOUT IT. That is the point of
   keeping them here: there are ten trail pages, and if each carried its own
   copy of this it would be ten copies to keep in step, nine of them saying the
   same thing. Set something in a page and it wins; leave it out and this is
   what you get.

   So: to change one trail, edit that trail's page. To change what a trail does
   BY DEFAULT — every trail at once, including the ones not built yet — change
   the value here.
   ═══════════════════════════════════════════════════════════════════════════ */

const DEFAULTS = {

  version: "6.1",              // shown in the top-right corner

  /* ── THE MAP ────────────────────────────────────────────────────────── */

  artwork: "inline",           // "inline"   use the <svg> at the bottom of this
                               //            file. Works however you open the
                               //            page, including double-clicking it.
                               // "map.png"  or any .jpg/.webp filename, to use a
                               //            flat image instead. A separate .svg
                               //            FILE cannot be used — browsers block
                               //            reading one off the local disk — so
                               //            paste vector artwork into the bottom
                               //            of this file instead.

  mapSize: null,               // [width, height] of the artwork. null reads it
                               // from the SVG's viewBox or the image itself.

  /* ── HOW LONG THE TRAIL IS ──────────────────────────────────────────────
     Two ways to tell the page how far the walk really is. Fill in ONE.

     The page always measures the route for itself, but only in the map's own
     units — the numbers in the SVG's viewBox. It has no way of knowing whether
     one of those units is a metre or a mile, so it needs one of these to turn
     its measurement into a distance.                                        */

  trailLength: 10.2,            // THE EASY ONE. The whole walk, in kilometres.
                               // Type in the real figure — off a guidebook, a
                               // GPS track, whatever you trust — and every
                               // distance on the page is scaled to match it:
                               // the running total, each waypoint's "from
                               // start", and the total on the closing screen.
                               // You do not need to know anything about the
                               // map's scale for this to be right.

  metresPerPixel: null,        // THE OTHER WAY. How many real metres one map
                               // unit covers, read off your scale bar: if 1 km
                               // measures 682 units, it is 1000/682 = 1.47.
                               // Only used when trailLength is null.

                               // Leave BOTH null and every distance readout
                               // removes itself — the page then works in
                               // percentages alone, which is a fine choice for
                               // a route whose real length you do not know.
                               // If both are filled in, trailLength wins.

  /* ── THE ROUTE ──────────────────────────────────────────────────────── */

  routeFrom: "artwork",        // "artwork"  a path inside the SVG above. In
                               //            Illustrator, name the trail path
                               //            "route" in the Layers panel and
                               //            export SVG with Object IDs set to
                               //            "Layer Names".
                               // "paste"    the routePath string below instead.
                               //            Use this when the map is a flat
                               //            image: open your .svg in a text
                               //            editor and copy the route's d="…".

  routeName: "#route",         // what the path is called, for "artwork" mode

  routePath: "",               // the d="…" string, for "paste" mode
  routeArtboard: null,         // [width, height] of the artboard that string was
                               // drawn on, if it differs from the map size

  reverseRoute: false,         // walk it from the other end
  hideDrawnRoute: true,        // hide the artwork's own trail line, since the
                               // page draws its own animated one on top

  /* ── MOVEMENT ───────────────────────────────────────────────────────── */

  lockPageHeight: true,        // MEASURE the page's height once, in pixels,
                               // rather than leaving it as a multiple of the
                               // window height.
                               //
                               // Why it matters on a phone: the address bar
                               // slides away the moment you scroll, and the
                               // window grows by 60-100px when it does. A page
                               // measured in screenfuls grows with it, so the
                               // whole page gets taller WHILE you are scrolling
                               // it - you scroll down and the ground you are
                               // standing on moves under you. Fixing the height
                               // in pixels at the start makes that impossible.
                               // See lockTheScroll().
  bigResizePx: 140,            // A real resize - turning the phone, or a
                               // desktop window being dragged - should of
                               // course re-measure. An address bar appearing is
                               // not a real resize. Only a change of width, or
                               // a change of height bigger than this, counts.
                               // Comfortably more than the tallest address bar,
                               // comfortably less than turning a phone.
  pageHeight: 1250,            // how tall the page is, in screenfuls. Bigger =
                               // more scrolling per metre = slower, calmer walk,
                               // and more scrolling between one waypoint card
                               // and the next.
                               //
                               // This and the zoom below work together. Zooming
                               // in does not by itself add scrolling: the page
                               // is the same length, so the map simply travels
                               // further across the screen for the same flick
                               // of the thumb, which reads as FASTER. To end up
                               // closer in AND slower between stops, both have
                               // to move — the zoom went up by a quarter,
                               // so this went up by rather more than that.

  followLag: 0.13,             // how lazily the map follows the scrollbar.
                               // 1 = rigid and instant, 0.05 = floaty and slow.

  zoomWalking: 1.25,           // scale while walking. 1 = artwork at true size,
                               // below 1 shows more map, above 1 shows less.
  zoomWalkingPhone: 0.82,      // the same, on narrow screens, which see a much
                               // smaller slice of the map. It is lower than the
                               // desktop figure because a phone screen is a
                               // fraction of the width: at the SAME zoom it
                               // would show almost nothing either side of the
                               // route.

  zoomOutAtStart: false,       // begin on the whole map and fly in to the
                               // trailhead. false starts you already zoomed in,
                               // standing at the first step, and removes the
                               // scrolling that swoop used to take.
  zoomOutAtEnd: true,          // pull back out to the whole map at the finish.
  pinShrinkOnPullBack: 0.45,   // how much smaller the waypoint rings get by the
                               // time the map is fully pulled back. 0 keeps
                               // them the size they are during the walk;
                               // 0.45 takes them to just over half.
  keepInsideEdges: true,       // Never show the ground beside the artwork while
                               // there is artwork to show instead.
                               //
                               // The route on this map starts near the bottom
                               // edge of the drawing, so centring the walking
                               // point exactly would put the edge of the paper
                               // on screen and leave a third of a phone screen
                               // of bare backdrop under it — worst at the very
                               // start, which is exactly where a reader is
                               // deciding whether the page works. With this on,
                               // the view stops at the edge and the walking
                               // point slides off centre instead, which is what
                               // every map does when you drag it to its corner.
                               // It only ever applies where the artwork is
                               // bigger than the window; pulled out at the
                               // finish, the whole map is centred as before.
  tagFadeOnPullBack: 1.6,      // how quickly the waypoint names fade as the map
                               // pulls back out to full width. 1 = gone only at
                               // the very end, higher = gone sooner, 0 = they
                               // stay at full strength the whole way.
  overviewFit: 0.92,           // how much of the screen the whole map fills
                               // when it is pulled out. 1 = right to the edges,
                               // lower leaves more of a margin around it.
  zoomEase: "smoother",        // the shape of the pull-back: "smooth" is the
                               // gentle S it used to be, "smoother" is a longer,
                               // flatter S that has no perceptible start or
                               // stop, "linear" is no easing at all.
  zoomGeometric: true,         // ease the SCALE by ratio rather than by
                               // difference. Zoom is felt as "twice as close",
                               // not "0.6 bigger", so a straight numeric slide
                               // from 1.0 to 0.2 rushes at the beginning and
                               // crawls at the end. This makes the pull-back
                               // feel like one steady movement. Leave it on.

  /* ── THE BLUR AT EACH END ───────────────────────────────────────────────
     The map can be softened behind the opening and closing screens so their
     text reads cleanly over it, sharpening again as you scroll away. Both are
     off: the opening text now sits in its own box, which gives it all the
     contrast it needs, and the finish is meant to show the map clean.

     A full-screen blur is also the single most expensive thing this page can
     ask a phone to draw, so leaving these at 0 is worth real frames. Give
     either one a value in screen pixels to bring it back.                    */

  blurAtStart: 0,              // softness behind the opening screen, in pixels
  blurAtEnd:   0,              // softness behind the finish, in pixels

  raisePointOnPhone: 0.16,     // on a phone the card covers the middle, so lift
                               // the walking point this fraction of the screen
                               // above centre. 0 keeps it dead centre.

  /* ── HOW THE SCROLL IS DIVIDED ──────────────────────────────────────────
     The page is longer than the walk. Scrolling from top to bottom passes
     through these stages in order, and only the middle one moves you along the
     trail. Each is measured in walks, so 0.26 means "as much scrolling as 26%
     of the trail takes".

         openingHold   the opening panel travels up and off the top, and the
                       map is uncovered behind it. The map itself does not
                       move: it is already at walking zoom, standing at the
                       trailhead.
         zoomInOver    the map flies in to the trailhead — only if
                       zoomOutAtStart is on. It is off, so this is 0.
       ( the walk )    the trail, 0% to 100%.
         zoomOutOver   the map pulls back out. The trail stays at 100%.
         closingHold   a last breath of scroll with the whole map in view.

     Nothing overlaps, and that is the point: the walk cannot begin until the
     opening panel has completely gone, because the panel finishes inside
     openingHold and the first step is not taken until openingHold is over.
     openingLeavesBy is what guarantees the gap.

     The first CARD is a separate question and is deliberately not tied to
     this: the first waypoint sits at the trailhead, so it arrives with the
     panel's exit rather than with the walk. See cardsArriveWith.            */

  openingHold: 0.132,          // scrolling spent on the opening screen. The map
                               // is already at walking zoom underneath it and
                               // does not move at all during this.
  openingLeavesBy: 0.71,       // the opening panel has completely left this far
                               // through that hold. Keep it under 1: what is
                               // left over is the pause between the first card
                               // landing and the map beginning to move, and if
                               // this reached 1 the walk would start underneath
                               // the panel.
                               //
                               // These two are a pair. Their PRODUCT is how
                               // much scrolling the panel's exit takes (0.094
                               // of a walk); what is LEFT OVER is the pause
                               // that follows it (0.038). Change one and check
                               // both, or the exit will speed up when you only
                               // meant to shorten the pause.

  cardsArriveWith: 0.45,       // The READOUTS follow the opening panel out.
                               // 0 = they start appearing the moment the panel
                               // begins to move; 1 = not until it has entirely
                               // gone. The first CARD has its own entrance —
                               // see firstCardEnters below.
                               //
                               // Both have to hang off the PANEL rather than
                               // off the walk starting. The first waypoint sits
                               // at the trailhead — its card's own stretch of
                               // scroll is over almost as soon as the walk
                               // begins — so anything that holds the interface
                               // back past that point does not delay the first
                               // card, it deletes it.
  openingScrollsAway: true,    // The opening panel TRAVELS UP and off the top
                               // as you scroll, rather than dissolving where it
                               // stands. It is the first thing the page does,
                               // so it is also the page teaching you what it
                               // wants: scroll, and things move. It takes the
                               // darkening with it, so the map is uncovered
                               // from the bottom up as it goes.
                               // false goes back to a plain fade.
  openingTravel: 1.15,         // how far it travels, in screenfuls. Anything
                               // over 1 carries it clear of the top edge before
                               // the hold is over, which is what stops the
                               // corner of the panel clipping at the last
                               // moment.
  openingFadesToo: 0.35,       // how much it also fades on the way out, 0 to 1.
                               // A little (not none) stops the panel looking
                               // like a solid object hitting the top edge.

  zoomInOver: 0.15,            // how much scrolling the fly-in would take, if
                               // zoomOutAtStart were switched back on. Ignored
                               // while it is off.
  zoomOutOver: 0.26,           // the pull-back at the finish, which does not
                               // begin until the trail reads 100%. Generous,
                               // because a slow pull-back reads as deliberate
                               // and a quick one reads as a glitch.

  closingHold: 0.08,           // scrolling after the pull-back. The map is
                               // whole and still; nothing is over it.
  closingFadeShare: 0.55,      // how far through that tail the interface has
                               // finished clearing away.

  showClosingScreen: false,    // a panel of totals over the finished map. Off:
                               // the pull-back ends on the map alone, with the
                               // cards and readouts cleared away and nothing
                               // over it. Switch it back on and the words for
                               // it are still in WORDS below, untouched.

  /* ── WHAT A PHONE DOES DIFFERENTLY ──────────────────────────────────────
     A phone has to redraw the whole map every frame with roughly a tenth of
     the graphics budget a laptop has, and the artwork is the expensive part:
     every contour line is re-traced from its outline each time the picture
     moves. Flattening turns the drawing into a single picture once, in the
     background, and moves that instead — the same view, a fraction of the
     work. Measured on a mid-range phone it is the difference between a walk
     that judders and one that does not.                                     */

  flattenOnPhone: true,        // trade the live drawing for a flat picture of
                               // it while walking, on phones only
  flattenWidth: 3600,          // how many pixels wide that picture is. Higher
                               // is sharper, slower to prepare and heavier in
                               // memory; lower goes soft when the map is zoomed
                               // in. The artwork's own width is the sweet spot —
                               // this map is 3600 across. If you raise
                               // zoomWalkingPhone, raise this to match, or the
                               // picture is being blown up past its own size.
  flattenAfterMs: 400,         // how long to wait before preparing it, so the
                               // page has drawn and is scrollable first. The
                               // live drawing is shown until the picture is
                               // ready, so nothing is ever missing — it simply
                               // gets cheaper a moment in.

  /* ── THE TRAIL LINE ─────────────────────────────────────────────────── */
  /* Widths are in map units and are divided by the zoom as you go, so the line
     keeps the same thickness on screen. Colours are in the stylesheet.      */

  trailWidth: 9,               // the walked line, behind you. In map units,
                               // so it grew with the map in 4.8
  trailOutlineExtra: 5,        // how much wider the pale outline under it is,
                               // which is what makes it read on busy artwork
  trailAheadWidth: 0.55,       // the dotted line ahead of you, as a share of
                               // trailWidth. 1 would make it equally heavy.
  trailAheadDot: 0.2,          // length of one dot ahead of you, again as a
  trailAheadGap: 2.4,          // share of trailWidth, and the gap between them
  pointSpacing: 5,             // map units between the points the page generates
                               // along your route. Smaller = smoother, slower.

  /* ── WAYPOINT CARDS ─────────────────────────────────────────────────── */

  /* A card is on screen for cardVisibleFor of the walk and no longer, so the
     map is left clear in between. Raise it to keep cards up for more of the
     route, lower it to show them only right at each waypoint.

     A PHONE GETS ITS OWN FIGURE. On a laptop the card sits in a column beside
     the map and you can read it and watch the route at the same time. On a
     phone it covers most of the screen, so a card that is up for the same
     share of the walk means you spend that walk looking at a card rather than
     at a map. cardVisibleForPhone is deliberately shorter: the card arrives,
     says its piece, and gets out of the way of the thing you came for.

     With thirteen waypoints, 0.075 keeps a card up for about three fifths of
     the walk in total; 0.036 on a phone brings that down to about a third.   */

  cardVisibleFor: 0.075,       // how much of the route one card stays up for
  cardVisibleForPhone: 0.036,  // the same on a narrow screen, where the card
                               // covers the map rather than sitting beside it.
                               // Set it equal to cardVisibleFor to go back to
                               // one figure for both.
  cardLead: 0.02,              // it arrives this far before its waypoint, so it
                               // is already readable when you get there
  cardLeadPhone: 0.012,        // a shorter run-up to match the shorter stay
  cardFade: 0.012,             // the fade in and the fade out at either end
  cardFadePhone: 0.008,        // shorter, because the whole stay is shorter —
                               // keep this well under a third of
                               // cardVisibleForPhone or the card will spend
                               // most of its time part-faded

  cardCloseMs: 220,            // how long the × takes to fade a card away, and
                               // how long a card takes to come back when the
                               // waypoint is clicked. Milliseconds.

  /* ── ONE CARD REPLACING ANOTHER ──────────────────────────────────────────
     Clicking a waypoint while another card is up used to be instant: the
     outgoing card's opacity was set to zero in the same frame the incoming
     one appeared, and two things happening in one frame is not a change
     anybody can follow — you looked away and looked back and it was a
     different card.

     So a swap is now its own small piece of business. The new card comes in
     from the right and SHOVES the old one out to the left, the old one
     stepping back a little as it goes, the way one card pushing another off a
     table would. It takes long enough to be watched. */
  cardSwapMs: 520,             // how long the shove takes, in milliseconds
  cardShove: 132,              // and how far either card travels, in pixels
  cardShoveBack: 0.94,         // how far the outgoing one shrinks on its way
  /* THE "SCROLL FOR MORE" LINE IS GONE. It said, at the foot of every card,
     that the page was still a scroll — worth saying once and not thirteen
     times, and it cost a row of a card whose scarcest thing is room for the
     words. What replaced it is simply that the cards are bigger. */
  cardsCanBeClosed: true,      // show the × in the corner of every card

  /* ── THE EXPANDED CARD ──────────────────────────────────────────────────
     The button beside the × swaps the card between the small view beside the
     map and a large one in the middle of the screen: the picture on the left
     at the same 4:3 it always had, only about three times the area, and the
     words beside it with enough lines that most waypoints stop being paged.

     WHILE IT IS OPEN THE PAGE DOES NOT SCROLL. The walk is the scroll, and a
     reader looking closely at one waypoint is not walking — worse, the scroll
     would carry the card away underneath them. So the page is held where it
     is until the card is put back or closed, and the veil takes the clicks
     that would otherwise reach the map.

     A CARD ALWAYS OPENS SMALL. Closing one puts the view back, so the next
     one to appear is the ordinary card beside the map rather than something
     that fills the screen without being asked. The single exception is a
     proposal arrived at from the Wishful thinking page, which is a link to
     one particular idea and opens showing it properly. */
  cardCanGrow: true,           // offer the button at all
  cardGrowsFrom: 1100,         // the narrowest window that gets it, in pixels.
                               // Under this the picture and the words cannot
                               // sit side by side and the big view would be no
                               // improvement, so it is not offered. Matches the
                               // media query in the stylesheet.
  cardGrowsAbove: 620,         // and the shortest window, for the same reason
  cardGrowFadeMs: 130,         // the contents fading out before the change
  cardGrowMs: 260,             // the panel travelling between the two sizes.
                               // Both are in the stylesheet as well (--big-fade
                               // and --big-glide) and have to agree.
  /* THE COVER OVER A PAGE THAT IS STILL FINDING ITS WAYPOINT. A link naming a
     waypoint cannot be honoured until the map is built and the page has
     measured its own height, and every bit of that is otherwise visible: the
     trail opens at its beginning, then travels to the waypoint while you
     watch. So a plain cover with a turning ring is held over it, and taken
     down the moment the page is standing where it was asked to stand.
     arriveGiveUpMs is the backstop — a cover that outlives what it is covering
     is worse than no cover, so after this it comes down regardless. */
  arriveFadeMs: 240,           // how long the cover takes to fade away
  arriveGiveUpMs: 7000,        // and the longest it may ever stay up
  bigOnArrival: "wishful",     // which deep links open expanded:
                               //   "wishful"  a link to a proposal — which is
                               //              what the Wishful thinking page
                               //              hands over
                               //   true       every link to a waypoint
                               //   false      never
  cardsReopenOnClick: true,    // clicking a waypoint on the map opens its card
                               // again, wherever the scroll happens to be. It
                               // gives way on its own once the walk reaches the
                               // next waypoint.

  /* ── PICTURES AND VIDEO ON THE CARDS ────────────────────────────────────
     Give a waypoint one picture and the card just shows it. Give it several
     and the card grows arrows and dots to step through them. Anything ending
     .mp4, .webm, .ogv or .mov is treated as video.

     Whatever you supply is cropped to fill the card's picture window rather
     than squashed, so portrait, square and widescreen files all sit correctly
     — the shape of that window is --card-media in the stylesheet.          */

  mediaLoop: true,             // the arrows wrap round from the last picture
                               // back to the first
  videoAutoplay: true,         // a video starts by itself when its slide is
                               // showing, and stops when it is not
  videoLoop: true,
  videoMuted: true,            // browsers only allow a video to start on its
                               // own if it is muted. Turn this off and the
                               // reader has to press play.
  videoControls: false,        // show the browser's own play/pause bar
  videoPreload: "metadata",    // how much of every video the browser fetches
                               // up front: "none", "metadata" or "auto".
                               // "metadata" keeps the page light — only the
                               // video's size and length are fetched.
  videoPreloadFront: true,     // videos near the card the reader is looking
                               // at are quietly upgraded to "auto", so they
                               // have buffered before being asked to play.
                               // This is what stops the first-play stutter.
  videoPreloadCards: 1,        // how many cards either side of the one in
                               // front also get fetched ahead. 0 = only the
                               // card showing; 1 = its neighbours too.
  videoPreloadOnlyOnFastLines: true,
                               // Do not fetch ahead on a metered connection.
                               // Reading ahead is free on wifi and expensive on
                               // a phone out on the trail — three videos of a
                               // few megabytes each, none of them asked for.
                               // The browser is asked whether the reader has
                               // data saving on or is on a slow line; where it
                               // cannot say (Safari does not implement this)
                               // nothing changes and videos are fetched ahead
                               // as usual.
  slowConnections: ["slow-2g", "2g", "3g"],
                               // which answers count as "do not spend this".
                               // Add "4g" to be stricter still.
  videoSpinner: true,          // show a turning ring over a video while it is
                               // still filling its buffer

  /* ── THE BEFORE/AFTER SLIDER ────────────────────────────────────────────
     A picture entry written as { before: "…", after: "…" } becomes a slide
     with a handle you drag across to wipe between the two. Both are cropped
     to fill in the usual way, so give it a matching pair — same camera
     position, same shape — and they will line up.                          */

  compareStartsAt: 50,         // where the handle sits when the card opens,
                               // as a percentage from the left
  compareClickToMove: true,    // with a mouse, clicking anywhere on the
                               // picture jumps the handle there. On a touch
                               // screen only the handle itself drags, so that
                               // swiping the card still scrolls the page.
  compareStep: 4,              // how far one arrow-key press moves it, in
                               // percent, when the handle has keyboard focus

  /* ── LONG TEXT ──────────────────────────────────────────────────────────
     A card shows --card-text-lines lines at a time (stylesheet). Anything
     longer is split into pages with ‹ › arrows underneath, rather than a
     scrollbar — a scrollbar inside the card would swallow scrolling meant
     for the map and stop you walking.                                      */

  pageLongText: true,          // false simply cuts the text off instead

  cardFitsWindow: true,        // shrink the text window, page by page, so the
                               // whole card always fits between the corner
                               // title and the readouts along the bottom. On a
                               // tall window you get the full cardTextLines; on
                               // a short one you get fewer lines and more pages,
                               // rather than a card running off the screen.
  cardMinLines: 3,             // never squeeze it below this many lines
  captionFadeMs: 180,          // how long a picture's caption takes to fade out
                               // before the next one fades in. 0 swaps it
                               // instantly. Keep it at or under half of
                               // --media-slide in the stylesheet, so the words
                               // have changed by the time the picture has.

  /* ── THE PANELS AND THE LAYERS ──────────────────────────────────────────
     Two buttons on the left-hand rail, both opening the same panel. */

  iconFolder: "icons/",        // EVERY drawing on the site lives here: the
                               // legend's swatches, one SVG per row named
                               // after the row's `swatch` below, and the coins
                               // and gauges on a wishful card, named for their
                               // value — cost-high.svg, priority-low.svg.
                               // There used to be a separate legend/ folder,
                               // which only made anyone adding a new kind of
                               // drawing guess which of the two it belonged in.
                               // IT MUST END IN A SLASH.
  legendFolder: "",            // kept so that a page which still names one is
                               // honoured; empty means "use iconFolder".
                               //
                               // The Happy Trails map reads this same folder.
                               // Keep one copy of it beside both pages, or a
                               // copy each — either way, redraw an icon and
                               // both pages change together.

  railBelowCardsOnPhone: true, // On a phone the waypoint card is full width and
                               // fills nearly the whole column, so the rail of
                               // buttons beside it has nowhere of its own to
                               // stand — it ends up drawn across the card's
                               // picture. With this on, the card is given the
                               // higher layer and simply covers the rail, the
                               // way a sheet covers what is under it: nothing
                               // fades, nothing blinks, and for the two thirds
                               // of the walk with no card up the buttons are
                               // exactly where they always were.
                               //
                               // The rail is also lowered just enough that no
                               // card can ever cut a button in half. How far is
                               // MEASURED, not guessed — see placeRail() — so
                               // it stays right when you change the text or the
                               // pictures and the cards change height.
                               //
                               // The panel stays above the card, so a panel you
                               // have opened is never covered by an arriving
                               // card. Close the card with its x to reach the
                               // buttons again.
  autoLoadSwitch: true,        // show the Waypoint auto-load row in the
                               // layers panel. The switch itself starts ON:
                               // a first-time reader should see the page do
                               // what it does. Turning this setting off
                               // removes the row and leaves auto-load on
                               // permanently.

  /* THE TOUR. A button between the two arrows that walks the trail for you:
     it scrolls, opens each card, turns its pages and its pictures at a pace
     worked out from what is actually written and shown in that card, then
     closes it and moves on. Escape leaves it, and so does pressing it again.
     Everything else about it is in autoplay.js; `autoplay` here is a place to
     override that file's own settings from a page. */
  showAutoplay: true,
  autoplay: {},

  showStepper: true,           // the two arrows above the readouts that jump
                               // from one waypoint to the next. Quieter than
                               // the legend and layers buttons on purpose:
                               // those open things, these only move you along.
  stepperSmooth: true,         // glide to the next stop rather than jumping.
                               // Off is instant, which some people prefer.

  /* ── TRAVELLING PAST WAYPOINTS WITHOUT OPENING THEM ─────────────────────
     Going to a waypoint halfway down the trail means scrolling past every
     waypoint in between, and with auto-load on each of those opens its card
     and shuts it again as it goes by — half a second each, six of them, none
     of them the one asked for. It is the same unreadable flicker that dragging
     the elevation graph used to cause, and it has the same answer: the cards
     are hushed for the length of the journey and the one asked for opens on
     arrival. Only when there is actually something in between: a step to the
     next waypoint passes nothing and opens at once, as it always did. */
  hushWhilePassing: true,
  travelCheck:   60,           // how often to look whether the scroll has
                               // arrived, in milliseconds
  arrivedWithin: 3,            // and how close counts as arrived, in pixels
  travelLeast:   180,          // ignore "it has not moved" for this long first:
                               // a smooth scroll takes a moment to set off
  travelStill:   3,            // then this many still checks means it has been
                               // taken over, or stopped short of the target
  travelMost:    2600,         // and a hard limit, because a hush that outlives
                               // the journey is a page with no cards on it

  linkToStops: true,           // EVERY STOP GETS AN ADDRESS OF ITS OWN.
                               // don.html#half-mile-bridge opens the Don at
                               // that stop with its card up; walking past a
                               // stop rewrites the address to name it, so the
                               // link to where you are is always in the bar.
                               // The name is made from the stop's title, or
                               // set per waypoint with `slug`.
  linkNameEveryMs: 250,        // how often, at most, the address is checked
                               // against where the walk has got to. See the
                               // note beside followTheWalk: doing it every
                               // frame is measurably expensive and no more
                               // correct.
  linkArriveAfterMs: 260,      // how long to let the page settle before
                               // jumping to a stop named in the address. The
                               // page's height is measured from the artwork,
                               // and the jump is a fraction of that height, so
                               // arriving too early lands in the wrong place.
  showLegend: true,            // the LEGEND button and its panel
  showLayers: true,            // the LAYERS button and its panel
  openPanelAtStart: null,      // "legend", "layers", or null to start closed

  trailKind: "built",          // "built" or "wishful". A WISHFUL TRAIL is one
                               // that does not exist yet — Mimico Creek, say.
                               // It is a kind of its own, not a variant: it is
                               // purple throughout rather than green, it says
                               // so on its own page and on the trails page,
                               // and the main map gives it a purple button on
                               // the Wishful thinking switch. Setting this puts
                               // body.trail-wishful on the page and the
                               // stylesheet does the rest.
  crossings: true,             // Show a button wherever this trail meets
                               // another one. The places come from the page's
                               // CROSSINGS list; each is anchored to a small
                               // circle in the artwork (#link-1, #link-2 …)
                               // drawn deliberately BESIDE the route, so a
                               // crossing button can never land under a
                               // waypoint button.
  crossingMark: "#link-",      // what those circles are called in the drawing
  trailImage: "",              // A picture of this trail, shown behind the
                               // opening panel — the same one the trails page
                               // uses on its card, so arriving here looks like
                               // the thing you clicked. A veil goes over it
                               // (see --opening-veil) because the panel's text
                               // has to stay readable over whatever it is.
                               // Empty leaves the panel plain, as before.
  mapFile: "",                 // the drawing this page shows, for the Download
                               // button — e.g. "maps/beltline-map.svg". Empty
                               // means the button has nothing to offer and is
                               // left off, like any other unset link.
  wishfulLayer: "#wishful",    // A GROUP IN YOUR ARTWORK holding the routes
                               // that do not exist yet — the bridge that would
                               // close a gap, the connection that would join
                               // two trails. Draw them like the main route but
                               // shorter, and in the wishful purple; put them
                               // all in one Illustrator layer named "wishful"
                               // and the export gives you <g id="wishful">.
                               //
                               // The Wishful thinking switch shows and hides
                               // this group along with the purple waypoints, so
                               // the proposal and the stops that describe it
                               // appear and disappear together — which is the
                               // point of the layer: what the trail IS, and
                               // what it COULD be, one switch apart.
                               //
                               // A page whose artwork has no such group is
                               // unaffected; nothing is looked for twice and
                               // nothing breaks.
  wishfulOn: false,            // whether the wishful-thinking waypoints start
                               // switched on. Off hides their cards, their
                               // circles on the map, their name chips and their
                               // dots on the elevation graph — everything.

  satelliteOn: false,          // whether the satellite view starts switched on
  satelliteImage: null,        // NO TRAIL HAS ONE. Set it to the filename of an
                               // aerial picture and that trail grows a
                               // "satellite view" switch in its layers panel;
                               // leave it null and the switch is not built at
                               // all. The layer itself still works — this is
                               // the picture that is missing, not the feature.
                               //
                               // The old one was a render of the demo terrain
                               // rather than a photograph of anywhere, so it
                               // has gone. Real aerial imagery is licensed, so
                               // check what you are allowed to publish before
                               // pointing this at anything.
                               //
                               // (was: the aerial picture, drawn underneath the
                               // artwork and lined up with it exactly. It must
                               // cover the same ground as the map, corner to
                               // corner. null removes the switch.
  satelliteHides: "#topo",     // what to hide when it comes on: a selector for
                               // the group in YOUR artwork holding the printed
                               // map — contours, water, roads, labels. Anything
                               // outside it (here the route and the waypoint
                               // circles) stays drawn on top of the photograph.

  showCompass: true,           // the little north badge in the top-right. The
                               // map is drawn north-up, so it is a fixed label
                               // rather than a needle that turns.

  /* ── THE WAYPOINT MARKERS ───────────────────────────────────────────────
     The rings drawn on the route at each stop. The page draws these itself,
     in front of everything, rather than leaving it to the circles in your
     artwork — which is what lets them show over the satellite view, where the
     artwork underneath is hidden.

     Your artwork's circles are still what PLACES each waypoint (marker:
     "#wp-tarn"), so keep drawing them; they just no longer have to be the
     thing you see. Draw them small in Illustrator and only these will show. */

  drawWaypoints: true,         // false goes back to relying on the artwork
  waypointSize: 26,            // the ring's width on screen, in pixels. It
                               // holds this size however far the map is zoomed,
                               // the way the name chips do.
  waypointRing: 6,             // how thick that ring is
  waypointRingWish: 4,         // and how thick a wishful-thinking one is —
                               // thinner, to match its card

  showWaypointLabels: true,    // the name chips pinned to the map
  showWaypointDots: false,     // add a dot to each chip. Leave false if your
                               // artwork already has its own markers drawn.

  /* ── ELEVATION ──────────────────────────────────────────────────────── */
  /* Heights come from the `metres` values on the waypoints in section ③.
     Give at least two and the page fills in everything between them; give
     none and the elevation readouts and the profile strip remove themselves. */

  /* HEIGHTS READ STRAIGHT OFF THE DRAWING.
     A trail with three waypoints has three heights, and the profile between
     them is a straight line — so a valley between two stops does not exist and
     a trail that climbs and drops twice reads as one ramp. The fix is not more
     waypoint cards: it is HEIGHT MARKS, small dots placed along the route in
     the drawing and NAMED for their height. `h-118` is 118 metres above sea
     level. One every 500 metres is plenty.

     They are heights and nothing else. No card, no name chip, no dot on the
     elevation graph, and nothing visible on the page — the stylesheet hides
     anything in the artwork whose name begins with the prefix, and this reads
     them and hides them again itself. A waypoint's own height always wins
     where the two are close, because somebody typed it.

     The number is everything from the first digit: `h-118`, `h-118_1` (what
     Illustrator writes when two objects share a name) and `h-118-2` all mean
     118. Set heightMarks to "" to ignore them entirely. */
  heightMarks: "h-",           // what a height mark's name begins with
  heightMarkClear: 0.005,      // a mark this near a waypoint, as a share of the
                               // route, gives way to it
  heightMarkStray: 0.04,       // and one further than this from the route says
                               // so in the console — it has probably been left
                               // somewhere by accident

  smoothElevation: 14,         // rounds off the corners where the straight lines
                               // between waypoints meet. 0 = leave them sharp.
  profileDetail: 260,          // how many points the little graph is drawn from.
                               // More is smoother and very slightly slower.

  /* ── EXTRAS ─────────────────────────────────────────────────────────── */

  coordinateReader: true,      // the E key, for reading positions off the map
                               // by clicking. There is no button for it — it is
                               // a tool for setting waypoints up, not for
                               // visitors — so this only governs the key.

  mediaFolder: "",             // The Beltline's pictures and video are hosted
                               // on the site's own CDN, so each waypoint gives
                               // a full URL and there is no folder to prefix.
                               // Put a folder name back here if you move them
                               // alongside the page.       // the folder holding your pictures and video,
                               // relative to this HTML file. It is put in front
                               // of every filename in the waypoints below, so
                               // they read "photo-01.jpg" rather than
                               // "photo-01.jpg". IT MUST END IN A SLASH.
                               // Set it to "" to write full paths yourself.
                               // Anything starting http://, https://, / or
                               // data: is left alone.
  phoneWidth: 860,             // screens narrower than this get the phone layout

  /* ── ODDS AND ENDS ──────────────────────────────────────────────────────
     Small numbers that used to be buried in the engine. Safe to ignore.    */

  signedElevation: true,       // A trail that ENDS LOWER than it starts has no
                               // ascent worth showing — the Beltline runs
                               // downhill the whole way, so the figure sat at
                               // zero for the entire walk. When that is the
                               // case the readout shows the net change from the
                               // trailhead instead, as a negative number, and
                               // takes the label WORDS.netChange to match.
                               // A trail that climbs is unaffected.
  cardRiseBy: 18,              // pixels a card slides up as it fades in
  firstCardEnters: true,       // The first card ARRIVES rather than merely
                               // being there already. Every other card fades up
                               // and rises the last few pixels into place as
                               // the walk reaches it; the first one has no walk
                               // to be reached by, its waypoint being the
                               // trailhead itself. This gives it the same
                               // entrance, over the same short stretch of
                               // scroll as any other card — cardFade — timed to
                               // land exactly as the darkening finishes going.
                               // false leaves it simply present, as it was.

  /* HOW FAR A CARD HAS TO HAVE FADED IN before it counts as being on screen —
     which is when its coin and its dial are asked to move. Near enough to one
     that the reading is plainly legible before it starts, because an animation
     played behind a half-transparent card is an animation half seen. */
  cardReadyAt:   0.96,
  cardLiveAbove: 0.05,         // a card fainter than this ignores the mouse, so
                               // it can never swallow a click meant for the map
  placeholderHue: 24,          // colour of the stand-in photo on the first card,
  placeholderHueStep: 14       // and how far the hue turns on each card after it
};

/* ═══════════════════════════════════════════════════════════════════════════
   THE DEFAULT WORDS
   The same arrangement for text. A page overrides the handful that name its
   own trail — the title, the opening paragraph, the kicker — and inherits the
   rest, so "Waypoint", "Elevation" and "Scroll for more" are written once.
   ═══════════════════════════════════════════════════════════════════════════ */

const DEFAULT_WORDS = {

  browserTab:    null,             /* null = keep the page's own <title> */

  /* The two lines above the title. A line break in the kicker is written as
     <br>, which is why this is one string rather than two settings. */
  /* Type and length on ONE line, separated rather than stacked: two short
     facts about the same thing read better side by side, and it gives the
     title back a line of height at the top of the screen. */
  cornerKicker:  "Type: Railpath &nbsp;·&nbsp; Length: 10.2 km",
  cornerTitle:   "The Beltline",

  /* ── THE NAVIGATION BAR ─────────────────────────────────────────────────
     The same bar the other pages on the site use. Keep this block identical
     across all of them and the navigation stays consistent everywhere.
       here: true   marks the page you are on, which is drawn in the accent
                    colour and underlined.                                  */
  bar: {
    brand:     "Happy Trails",
    brandHref: "index.html",
    links: [
      { label: "Map",     href: "index.html",         here: false },
      { label: "Trails",  href: "trails.html",  here: true  },
      { label: "Wishful", href: "wishful.html", here: false },
      { label: "About",   href: "about.html",   here: false },
      { label: "Contact", href: "contact.html", here: false },
      /* The support link is marked so the stylesheet can tint it — it is the
         only item in the bar that leaves the site, and it should look like an
         offer rather than another section. */
      { label: "Buy me a coffee", short: "Coffee",
        href: "https://buymeacoffee.com/sebazistan", here: false,
        newTab: true, kind: "coffee" }
    ]
  },

  /* ── THE LINK BUTTONS UNDER THE TITLE ───────────────────────────────────
     Somewhere to send people off the page. A button with an empty href is
     left off entirely, so to drop one just clear its href — no need to
     delete the line. Clear all three and the row disappears; set
     --title-links to 0px in the stylesheet to close the gap it leaves.

       download: true   offers the file for saving rather than opening it
       newTab:   true   opens in a new tab, which is what you want for
                        anything leaving the site                           */
  /* The buttons under the corner title. A link with no href is not written at
     all, so the two reference links below simply do not appear on a trail that
     has not been given them — which is most of them, for now.

     `icon` says what the button DOES: "back" goes before the label because
     that is the direction it means, "download" and "external" go after,
     because they describe where the label leads.

     DOWNLOAD is special: leave its href empty and it is filled in from
     SETTINGS.mapFile, so every trail offers its OWN drawing without the URL
     being written out twice. */
  trailLinks: [
    { label: "Main map",     href: "index.html",  icon: "back" },
    { label: "Download",     href: "",            icon: "download", download: true },
    { label: "Wikipedia",    href: "",            icon: "external", newTab: true },
    { label: "Google maps",  href: "",            icon: "external", newTab: true }
  ],

  openingKicker: "10.2 km · Toronto",
  openingTitle:  "The Beltline, end to end",
  openingBody:   "A mixed-use trail along the path of the former Toronto Belt Line Railway, which ran for about seventy years. Scroll to walk it from the west end to the Brickworks — the map moves under you, and each stop arrives as you reach it.",
  openingHint:   "Scroll to begin",
  previousStop:  "Previous waypoint",
  nextStop:      "Next waypoint",
  /* the tour button between the two arrows, and the line that says how to get
     out of it once it is running */
  playTour:      "Play the trail",
  stopTour:      "Stop playing",
  tourEscape:    "Press Esc to leave autoplay",
  /* where the tour has got to. {n} and {of} are filled in from the stops that
     are actually live, so switching the wishful layer off changes both. */
  tourAt:        "{n} of {of}",
  tourBack:      "Previous waypoint",
  tourOn:        "Next waypoint",
  /* AND WHERE THE WALK HAS GOT TO, SHOWN AT ALL TIMES beside the arrows —
     tour or no tour. Shorter than tourAt because it is never read as a
     sentence: it is a readout sitting next to the two controls it refers to,
     the way a page number sits next to the page. {n} and {of} again count only
     the live stops. */
  stepAt:        "{n} / {of}",
  stepAtLabel:   "Waypoint {n} of {of}",
  /* PAUSING THE TOUR, which is a different thing from stopping it and so has a
     button of its own: stopping closes the card and hands the page back,
     pausing leaves everything exactly where it is so you can finish reading. */
  tourHold:      "Pause the tour",
  tourGoOn:      "Carry on",
  tourHeld:      "Paused — press play to carry on",
  /* the elevation graph, for a keyboard and a screen reader, and the word for
     ground that is not going anywhere much */
  graphLabel:    "Position along the trail",
  level:         "level",
  copyLink:      "Copy link to this waypoint",
  copied:        "Link copied",
  resumeTitle:   "Carry on where you left off?",
  resumeGo:      "Resume",
  resumeNo:      "Start again",
  turnPhone:     "Turn your phone upright",
  turnPhoneWhy:  "This trail is walked by scrolling, and there is not enough "
               + "room to show the map and a waypoint at once on a screen this "
               + "shallow.",

  closingTitle:  "Brickworks",
  closingBody:   "Ten kilometres from the rail yards in the west to the Brickworks in the Don Valley. The gaps at Allan Rd and Marlee Ave are the two that would do the most good if they were closed.",

  /* the small labels under the numbers */
  distance:      "Distance",
  elevation:     "Elevation",
  /* the two facts a wishful stop carries, and the three values each of
     them can take. Written out rather than shown only as a picture: the
     coin and the dial are quick to read, the words are unambiguous, and
     a screen reader has only the words. */
  cost:          "Cost",
  priority:      "Priority",
  level_low:     "Low",
  level_medium:  "Medium",
  level_high:    "High",
  ascent:        "Ascent",
  netChange:     "Net change",     /* replaces "Ascent" on a downhill trail */
  complete:      "Complete",
  highPoint:     "High point",
  totalDistance: "Distance",

  /* on the waypoint cards */
  closeCard:     "Close",          /* the × button's tooltip and screen-reader name */
  arriving:      "Finding this waypoint",     /* under the ring, while a link
                                                 to one waypoint is being
                                                 found. Empty for no words. */
  growCard:      "See this waypoint bigger",  /* the button beside the × */
  shrinkCard:    "Back to the map",           /* the same button, once it is */
  openCard:      "Open this waypoint",   /* tooltip on a waypoint chip */
  waypoint:      "Waypoint",
  outOf:         "of",
  fromStart:     "From start",
  mapLink:       "Google maps",    /* the button beside the facts. A waypoint
                                      with no mapLink simply has no button.  */
  photoMissing:  "photo placeholder",
  videoMissing:  "video unavailable",
  north:         "N",                    /* the letter on the compass badge */
  northLabel:    "North is up",          /* its screen-reader description   */

  /* the carousel and the page-turner (tooltips and screen-reader labels) */
  beforeLabel:     "Before",       /* the default corner labels on the slider, */
  afterLabel:      "After",        /* used when a picture pair doesn't name its own */
  compareHandle:   "Drag to compare",
  previousPicture: "Previous picture",
  nextPicture:     "Next picture",
  previousPage:    "Previous",
  nextPage:        "Continue reading",

  /* ── THE LEGEND AND LAYERS PANELS ───────────────────────────────────────
     The legend is a plain list: each row is a small drawing and a label. The
     `swatch` names one of the shapes the stylesheet knows how to draw — line,
     dashed, dot, wishdot, thin, thick, water, road, peak — so adding a row is
     one line here and nothing else.                                        */
  legendName:   "Legend",
  legendTitle:  "Legend",
  legendNote:   "",
  /* Each row's drawing is legend/<swatch>.svg. This is the SAME folder the
     Happy Trails map reads, and the names match its rows, so a symbol drawn
     once means the same thing on both pages. The last two are this page's own:
     the two kinds of waypoint, which the city map has no use for. */
  legend: [
    { swatch: "trails",             label: "Trail" },
    { swatch: "bridge",             label: "Bridge" },
    { swatch: "unpaved",            label: "Unpaved trail" },
    { swatch: "under-construction", label: "Under construction" },
    { swatch: "lanes",              label: "Bike lane" },
    { swatch: "connections",        label: "Connection" },
    { swatch: "road-connection",    label: "Road connection" },
    { swatch: "dangerous",          label: "Dangerous connection" },
    { swatch: "crosswalk",          label: "Crosswalk / junction" },
    { swatch: "tunnel",             label: "Bridge / tunnel crossing" },
    { swatch: "stairs",             label: "Stairs" },
    { swatch: "barrier",            label: "Barrier" },
    { swatch: "wishful",            label: "Wishful thinking" },
    { swatch: "roads",              label: "Road" },
    { swatch: "highway",            label: "Highway" },
    { swatch: "rail",               label: "Railway" },
    { swatch: "river",              label: "River" },
    { swatch: "golf",               label: "Golf course" },
    { swatch: "waypoint",           label: "Waypoint" },
    { swatch: "waypoint-wishful",   label: "Wishful thinking" }
  ],

  layersName:   "Layers",
  layersTitle:  "Layers",
  layersNote:   "Switch parts of the map on and off.",
  layerWishful:      "Wishful thinking",
  /* the switch that decides whether a card opens by itself. Its note says
     what the switch is doing NOW rather than what pressing it would do —
     a switch already tells you that by being on or off, and a note that
     changes when you press it is the clearest confirmation that it
     worked. */
  layerAutoLoad:     "Waypoint auto-load",
  layerAutoLoadOn:   "Stops open as you reach them",
  layerAutoLoadOff:  "Tap a waypoint to open it",
  layerWishfulNote:  "Stops that are proposed rather than built",
  /* what that row says instead on a wishful trail, where the switch is
     locked on because there is nothing for it to hide. */
  layerWishfulLocked:"This whole trail is proposed",
  layerSatellite:      "Satellite view",
  layerSatelliteNote:  "Aerial imagery in place of the drawn map",
  closePanel:   "Close",

  /* the coordinate reader */
  readerTitle:   "Read coordinates",
  readerHelp:    "Click the map to record a point. <kbd>Z</kbd> undo · <kbd>C</kbd> clear · <kbd>E</kbd> or <kbd>Esc</kbd> to close. Numbers are in the map's own units — paste them into a waypoint below.",

  /* units */
  km:            "km", metres: "m", percent: "%", units: "u"
};

/* What the page asked for, laid over what it did not mention. One level deep is
   enough: every setting is a plain value, a short list or a small object that
   is replaced whole rather than merged into. */
function withDefaults(given, fallback) {
  const out = {};
  for (const k in fallback) out[k] = fallback[k];
  for (const k in given)    out[k] = given[k];
  return out;
}

var SETTINGS  = withDefaults(PAGE.SETTINGS || {}, DEFAULTS);
var WORDS     = withDefaults(PAGE.WORDS    || {}, DEFAULT_WORDS);
var WAYPOINTS = PAGE.WAYPOINTS || [];

/* ── the interface, written once for every trail ──────────────────────────
   The page's <body> holds only its artwork template. Everything you can see
   is put there by this, so that thirteen trail pages cannot end up with
   thirteen slightly different navigation bars. The artwork template is left
   exactly where it is — it is read later, by name. */
function buildThePage() {
  var artwork = document.getElementById("tm-artwork");
  var stage = document.createElement("div");
  stage.innerHTML = INTERFACE;
  while (stage.firstChild) document.body.insertBefore(stage.firstChild, artwork);
  document.body.classList.add("page-trail");
  /* THE COVER GOES UP BEFORE ANYTHING IS DRAWN, and only when the address
     names a waypoint. From here until the page is standing at that waypoint —
     map built, height measured, scroll jumped, card open — there is nothing to
     see but the trail arriving at somewhere nobody asked for. Put up here, at
     the moment the interface is written, rather than later: later is after the
     first paint. */
  if (location.hash.length > 1) {
    var cover = document.getElementById("tm-loading");
    if (cover) cover.classList.add("is-on");
    setTimeout(uncover, SETTINGS.arriveGiveUpMs);
  }
  /* A wishful trail is purple throughout. One class carries it — see
     body.trail-wishful in happy-trails.css — so nothing here has to know
     which colour anything is. */
  if (SETTINGS.trailKind === "wishful") document.body.classList.add("trail-wishful");
}

var INTERFACE = "\n<!-- the site's navigation bar. It owns the top of the window; the map and the\n     interface both begin underneath it. Its words are in WORDS.bar. -->\n<header id=\"tm-bar\">\n  <a id=\"tm-barBrand\" href=\"#\"></a>\n  <nav id=\"tm-barNav\"></nav>\n</header>\n\n<!-- the map and everything drawn on it -->\n<div id=\"tm-stage\">\n  <div id=\"tm-world\">\n    <!-- the artwork is inserted here when the page loads -->\n    <svg id=\"tm-trail\" xmlns=\"http://www.w3.org/2000/svg\">\n      <path id=\"tm-trailOutline\" fill=\"none\" stroke-linejoin=\"round\" stroke-linecap=\"round\"/>\n      <path id=\"tm-trailAhead\"   fill=\"none\" stroke-linejoin=\"round\" stroke-linecap=\"round\"/>\n      <path id=\"tm-trailWalked\"  fill=\"none\" stroke-linejoin=\"round\" stroke-linecap=\"round\"/>\n    </svg>\n    <div id=\"tm-labels\"></div>\n  </div>\n</div>\n<div id=\"tm-shade\"></div>\n\n<!-- the interface that sits over the map -->\n<div id=\"tm-ui\">\n\n  <header id=\"tm-topbar\">\n    <div id=\"tm-brand\">\n      <div class=\"tm-kicker\" id=\"tm-cornerKicker\"></div>\n      <h1 id=\"tm-cornerTitle\"></h1>\n      <!-- filled in from WORDS.trailLinks; empty if none of them has an href -->\n      <div id=\"tm-links\"></div>\n    </div>\n    <div id=\"tm-topright\">\n      <span id=\"tm-version\"></span>\n    </div>\n  </header>\n\n  <!-- THE LEFT RAIL\n       The compass and the two panel buttons live in one fixed column. This is\n       the fix for the panels coming adrift: the buttons are pinned to the\n       window and never move, whatever is open. There is only ever ONE panel,\n       which slides out beside the rail and swaps its contents, so a button can\n       never end up detached from the thing it opens. -->\n  <div id=\"tm-rail\">\n  <div id=\"tm-compass\" role=\"img\">\n    <!-- the arrow is drawn to fill its 24\u00d724 box, so --compass-arrow in the\n         stylesheet is the size you actually see -->\n    <svg viewBox=\"0 0 24 24\" aria-hidden=\"true\"><path d=\"M12 1.5 L20 22 L12 17.4 L4 22 Z\"/></svg>\n    <span id=\"tm-north\"></span>\n  </div>\n\n    <button class=\"tm-railBtn\" id=\"tm-legendBtn\" type=\"button\" aria-expanded=\"false\"\n            aria-controls=\"tm-panel\">\n      <svg viewBox=\"0 0 24 24\" aria-hidden=\"true\" fill=\"none\" stroke=\"currentColor\"\n           stroke-width=\"1.9\" stroke-linecap=\"round\">\n        <path d=\"M4 7h3M4 12h3M4 17h3M11 7h9M11 12h9M11 17h9\"/>\n      </svg>\n      <span class=\"tm-railName\"></span>\n    </button>\n\n    <button class=\"tm-railBtn\" id=\"tm-layersBtn\" type=\"button\" aria-expanded=\"false\"\n            aria-controls=\"tm-panel\">\n      <svg viewBox=\"0 0 24 24\" aria-hidden=\"true\" fill=\"none\" stroke=\"currentColor\"\n           stroke-width=\"1.9\" stroke-linejoin=\"round\">\n        <path d=\"M12 3 21 8l-9 5-9-5 9-5Z\"/><path d=\"M3 13l9 5 9-5\"/>\n      </svg>\n      <span class=\"tm-railName\"></span>\n    </button>\n  </div>\n\n  <!-- the one panel both buttons open -->\n  <aside id=\"tm-panel\" hidden>\n    <header id=\"tm-panelTop\">\n      <h2 id=\"tm-panelTitle\"></h2>\n      <button class=\"tm-close\" id=\"tm-panelClose\" type=\"button\">&times;</button>\n    </header>\n    <div id=\"tm-panelNote\"></div>\n    <div id=\"tm-panelBody\"></div>\n  </aside>\n\n  <!-- the veil behind an expanded waypoint card. It is inside the interface\n       layer so it covers the map, the readouts, the rail and the panel, and\n       stops short of the site's bar, which stays lit. Clicking it puts the\n       card back. -->\n  <div id=\"tm-cardveil\"></div>\n\n  <div id=\"tm-cards\"></div>\n\n  <div id=\"tm-readouts\">\n    <div id=\"tm-numbers\">\n      <div class=\"tm-readout\" id=\"tm-boxDistance\"><small></small><b id=\"tm-valDistance\">0</b></div>\n      <div class=\"tm-readout\" id=\"tm-boxElevation\"><small></small><b id=\"tm-valElevation\">0</b></div>\n      <div class=\"tm-readout tm-optional\" id=\"tm-boxAscent\"><small></small><b id=\"tm-valAscent\">0</b></div>\n      <div class=\"tm-gap\"></div>\n      <div class=\"tm-readout\" id=\"tm-boxComplete\"><small></small><b id=\"tm-valComplete\">0</b></div>\n    </div>\n    <div id=\"tm-profile\"></div>\n  </div>\n\n  <section id=\"tm-opening\">\n    <!-- the same panel the finish used to use: one .tm-box, so the two ends of\n         the page are visibly the same object and share their styling -->\n    <div class=\"tm-box\">\n      <div class=\"tm-kicker\" id=\"tm-openingKicker\"></div>\n      <h2 id=\"tm-openingTitle\"></h2>\n      <p id=\"tm-openingBody\"></p>\n      <div id=\"tm-hint\">\n        <span id=\"tm-openingHint\"></span>\n        <svg width=\"20\" height=\"26\" viewBox=\"0 0 20 26\" fill=\"none\" stroke=\"currentColor\"\n             stroke-width=\"1.6\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M10 3v18M4 15l6 6 6-6\"/></svg>\n      </div>\n    </div>\n  </section>\n\n  <section id=\"tm-closing\">\n    <div class=\"tm-box\">\n      <h2 id=\"tm-closingTitle\"></h2>\n      <p id=\"tm-closingBody\"></p>\n      <div class=\"tm-row\">\n        <div class=\"tm-readout\"><small id=\"tm-closingLabel1\"></small><b id=\"tm-closingTotal\">\u2014</b></div>\n        <div class=\"tm-readout\"><small id=\"tm-closingLabel2\"></small><b id=\"tm-closingAscent\">\u2014</b></div>\n        <div class=\"tm-readout\"><small id=\"tm-closingLabel3\"></small><b id=\"tm-closingHigh\">\u2014</b></div>\n      </div>\n    </div>\n  </section>\n</div>\n\n<!-- Shown only on a phone held on its side. A short, wide window has no room\n     for both the map and a waypoint at once: the card ends up taller than the\n     space it has, so its picture and its title are pushed off the top of the\n     screen. Rather than serve a broken layout, the page asks for the one it\n     was built for. Purely a stylesheet decision \u2014 see the orientation media\n     query \u2014 so it costs nothing on every other screen and cannot get out of\n     step with any state the page is holding. -->\n<div id=\"tm-turn\">\n  <div class=\"tm-box\">\n    <!-- a phone stood upright, with an arrow turning it that way -->\n    <svg width=\"52\" height=\"52\" viewBox=\"0 0 32 32\" fill=\"none\" stroke=\"currentColor\"\n         stroke-width=\"1.6\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\">\n      <rect x=\"11\" y=\"10\" width=\"10\" height=\"18\" rx=\"2.5\"/>\n      <line x1=\"14.4\" y1=\"25\" x2=\"17.6\" y2=\"25\"/>\n      <path d=\"M5.5 13.5 A11.5 11.5 0 0 1 26.5 13.5\"/>\n      <polyline points=\"9.6,9.6 5.5,13.6 1.6,9.4\"/>\n    </svg>\n    <h2 id=\"tm-turnTitle\"></h2>\n    <p id=\"tm-turnWhy\"></p>\n  </div>\n</div>\n\n<div id=\"tm-scroller\"></div>\n\n<!-- optional helper: press E to read coordinates off the map -->\n<div id=\"tm-reader\">\n  <div id=\"tm-coords\">\u2014</div>\n  <div id=\"tm-readerPanel\">\n    <h3 id=\"tm-readerTitle\"></h3>\n    <p id=\"tm-readerHelp\"></p>\n    <textarea id=\"tm-readerOut\" spellcheck=\"false\" readonly></textarea>\n    <div id=\"tm-readerButtons\">\n      <button class=\"tm-button\" id=\"tm-copyButton\" type=\"button\">Copy</button>\n      <button class=\"tm-button\" id=\"tm-clearButton\" type=\"button\">Clear</button>\n    </div>\n  </div>\n</div>\n\n<!-- WHAT SOMEBODY FOLLOWING A LINK TO ONE WAYPOINT SEES WHILE THE PAGE FINDS\n     IT. A link from the Wishful thinking page is a link to one idea, but the\n     page it lands on has to build its map, measure its own height and only\n     then jump to the right place — and all of that is visible: the trail\n     opens at its beginning and travels to the waypoint while you watch. This\n     covers that. It is only ever shown when the address names a waypoint, and\n     it goes as soon as the page is standing where it was asked to stand. -->\n<div id=\"tm-loading\">\n  <div class=\"tm-loadRing\"></div>\n  <p id=\"tm-loadingWord\"></p>\n</div>\n\n<div id=\"tm-problem\"><p id=\"tm-problemText\"></p></div>";

/* ═══════════════════════════════════════════════════════════════════════════
   ══  THE ENGINE  ══  No edits needed past this point.
   It is still commented, in case you want to change how something works.
   ═══════════════════════════════════════════════════════════════════════════ */

/* ── small helpers ─────────────────────────────────────────────────────── */
const el         = name => document.getElementById("tm-" + name);
/* every element this page owns is prefixed "tm-" so it can never clash
   with a layer name inside the artwork you paste in at the bottom     */
const clamp      = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const mix        = (a, b, t) => a + (b - a) * t;
const ramp       = (from, to, x) => { const t = clamp((x - from) / (to - from), 0, 1); return t * t * (3 - 2 * t); };
/* The same 0-to-1 ramp, but you choose the shape of the curve. "smoother" has
   a zero second derivative at both ends as well as a zero first one, which is
   what removes the faint kick you can otherwise feel at the moment a movement
   starts and the moment it stops. SETTINGS.zoomEase picks between them. */
const slide = (from, to, x, shape) => {
  const t = clamp((x - from) / (to - from), 0, 1);
  if (shape === "linear")   return t;
  if (shape === "smoother") return t * t * t * (t * (t * 6 - 15) + 10);
  return t * t * (3 - 2 * t);                       // "smooth"
};
/* Blend two zoom levels the way zoom is actually felt — by ratio, not by
   difference. Going 1.0 -> 0.2 through the middle of a straight numeric slide
   puts you at 0.6, which looks and feels like most of the movement has already
   happened; by ratio the middle is 0.45, and the pull-back reads as one even
   glide. mix() is still there for everything that is genuinely linear.     */
const mixZoom = (a, b, t) => SETTINGS.zoomGeometric ? a * Math.pow(b / a, t) : mix(a, b, t);
const isPhone    = () => window.innerWidth <= SETTINGS.phoneWidth;
/* The map area, which is the window minus the navigation bar across the top.
   Everything that needs a centre or a fit-to-screen measures this rather than
   the window, so the walker sits in the middle of the map and not behind the
   bar. Change --bar-height in the stylesheet and these follow it. */
/* ── writing a readout ────────────────────────────────────────────────────
   Each readout is a number and a small unit beside it. Rewriting it as HTML
   every frame means the browser re-parses and re-lays-out text that has not
   changed sixty times a second — and most frames it has not changed, because
   the number is rounded. say() keeps the two text nodes and touches one only
   when its content is actually different.                                   */
const saidBefore = Object.create(null);
function say(name, value, unit) {
  if (saidBefore[name] === value) return;
  saidBefore[name] = value;
  const box = el(name);
  /* The two parts have to exist before either can be written to. The markup
     starts as a bare "0" with no unit beside it, so the first call through
     here builds them: a text node for the number and an <i> for the unit. */
  let num = box.firstChild;
  if (!num || num.nodeType !== 3 || !box.querySelector("i")) {
    box.textContent = "";
    num = document.createTextNode("");
    const tag = document.createElement("i");
    tag.textContent = unit;
    box.appendChild(num);
    box.appendChild(tag);
  }
  num.nodeValue = value;
}

/* Whether this trail climbs or descends is not known until the route has been
   measured, which happens long after the words are first written. These two
   labels are therefore written twice: once with the ordinary name, and again
   here once there is an answer. The label has to follow the figure — a signed
   net change is not an "ascent", and "Ascent  −75 m" reads as a mistake rather
   than as information. */
function nameTheClimb() {
  const name = downhillTrail ? WORDS.netChange : WORDS.ascent;
  const box  = el("boxAscent");
  if (box) box.querySelector("small").textContent = name;
  const closing = el("closingLabel2");
  if (closing) closing.textContent = name;
}

/* ── is this a connection worth spending? ─────────────────────────────────
   Fetching the next videos ahead of time is what stops them stuttering on
   first play. On wifi that is free; on a phone out on the trail it can be tens
   of megabytes nobody asked for. The browser will tell us, where it knows: the
   reader has asked for data saving, or the connection is slow enough that
   guessing wrong is expensive. Where it does not know — Safari does not
   implement this — we get undefined, treat it as unmetered, and behave exactly
   as before. Asked fresh each time rather than cached, because a phone can
   walk from wifi onto cellular halfway down the page. */
function onAMeteredLine() {
  if (!SETTINGS.videoPreloadOnlyOnFastLines) return false;
  const line = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  if (!line) return false;
  if (line.saveData) return true;
  return SETTINGS.slowConnections.indexOf(line.effectiveType) !== -1;
}

/* A rounded number that keeps its sign, and shows a true minus sign rather
   than a hyphen. "0" never comes out as "-0". */
const signed = n => {
  const r = Math.round(n);
  return r > 0 ? "+" + r : r < 0 ? "\u2212" + Math.abs(r) : "0";
};

const stageW = () => el("stage").clientWidth;
const stageH = () => el("stage").clientHeight;
const stillWanted = matchMedia("(prefers-reduced-motion: reduce)").matches;
const SVG_NS     = "http://www.w3.org/2000/svg";

/* shared state, filled in as the page sets itself up */
let mapSvg = null;              // the artwork, when it is an SVG
let mapW = 0, mapH = 0;         // artwork size, in map units
let path = [];                  // the route, as evenly spaced {x, y, metres}
let along = [];                 // distance from the start at each of those points
let routeLength = 0;            // total, in map units
let stops = [];                 // the waypoints, once placed on the route
let haveHeights = false;
let totalClimb = 0, highest = 0;
/* A trail that finishes lower than it started has no useful "ascent" to show —
   the Beltline runs downhill the whole way, so the figure was a permanent
   zero. When that is the case the readout switches to the NET change, which is
   a negative number, and takes a label to match. downhillTrail is decided once,
   from the first and last points of the route. */
let downhillTrail = false;
let climbedTo = [];             // uphill metres from the start to each point of
                                // `path`, added up once instead of every frame

/* ── the layers ──────────────────────────────────────────────────────────
   Two switches, both plain booleans. Everything that has to react to them —
   cards, map circles, name chips, dots on the elevation graph, the artwork
   underneath — reads these rather than keeping its own copy, so they can never
   disagree with the switch the reader can see. */
let wishfulOn   = true;
/* WHETHER A CARD OPENS BY ITSELF as the walk reaches its waypoint. On, the
   page reads itself to you; off, it is a map with twelve things on it that
   you open when you want them. Off is the better way to LOOK at the map —
   nothing covers it unless you ask — which is why it is a switch and not a
   setting: it is a preference about what you are doing right now, not about
   the trail. */
let autoLoadOn  = true;
let wishfulArt  = null;         // the group in the artwork, once it is found
let stepperNeedsRefresh = null; // set once the stepper exists, called when the
                                // set of reachable stops changes
let satelliteOn = false;
let satelliteOk = true;          // false once the picture has failed to load
let applyLayers = () => {};      // filled in once the page is built
let buildPanels = () => {};      // and so is this

/* Is this stop on a layer that is currently switched on? One function, asked
   by everything that can show a waypoint, so nothing has to remember the rule
   for itself. Add a layer later and this is the only place it goes. */
const onALiveLayer = stop => !(stop.kind === "wishful" && !wishfulOn);

function giveUp(message) {
  el("problem").classList.add("tm-open");
  el("problemText").innerHTML = message;
  uncover();          // whatever went wrong, it must be readable
}

/* TAKE THE COVER DOWN. Called the moment the page is standing where it was
   asked to stand — and by everything that could mean it never will: a trail
   whose artwork would not load, an address naming a waypoint that no longer
   exists, and a plain timer, because a cover that outlives what it is covering
   is worse than never having put one up. */
function uncover() {
  const cover = el("loading");
  if (!cover || !cover.classList.contains("is-on")) return;
  cover.classList.add("is-going");
  setTimeout(() => cover.classList.remove("is-on", "is-going"),
             SETTINGS.arriveFadeMs);
}

/* ── the waypoint stepper ─────────────────────────────────────────────────
   Two arrows that jump to the previous and next waypoint. Deliberately quieter
   than the legend and layers buttons beside them: those open things, these
   only move you along, and the map is the thing you are meant to be looking
   at. An arrow greys out when there is nothing that way to go to.

   Which stops count depends on the Wishful thinking switch — a stop that is
   not on the map should not be somewhere the arrows can take you. */
function buildStepper() {
  if (!SETTINGS.showStepper) return;
  const box = document.createElement("div");
  box.id = "tm-stepper";
  box.innerHTML =
    '<button class="tm-step" id="tm-stepBack" type="button" aria-label="' +
      WORDS.previousStop + '" title="' + WORDS.previousStop + '">' +
      '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor"' +
      ' stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">' +
      '<path d="M15 5 8 12l7 7"/></svg></button>' +
    /* THE PLAY BUTTON SITS BETWEEN THE TWO ARROWS, because that is what it is:
       the arrows step one waypoint at a time by hand, and this one does the
       walking for you. It is play AND pause — one control, two states, the way
       a play button has meant since the cassette deck. Press it and the tour
       starts, press it again and it holds where it is, press it again and it
       carries on. Stopping is a different thing and has a button of its own,
       after the forward arrow, which autoplay.js adds.

       Both faces are in the button and the stylesheet shows whichever applies,
       so there is nothing to swap at the moment of pressing it — a swap would
       lose the button's focus on the way through. */
    (SETTINGS.showAutoplay ?
      '<button class="tm-step tm-play" id="tm-play" type="button" ' +
        'aria-pressed="false" aria-label="' + WORDS.playTour + '" title="' +
        WORDS.playTour + '">' +
        '<svg class="tm-playGo" viewBox="0 0 24 24" aria-hidden="true" ' +
        'fill="currentColor"><path d="M8 5.2v13.6L19 12z"/></svg>' +
        '<svg class="tm-playPause" viewBox="0 0 24 24" aria-hidden="true" ' +
        'fill="currentColor"><rect x="6" y="5" width="4.4" height="14" rx="1.4"/>' +
        '<rect x="13.6" y="5" width="4.4" height="14" rx="1.4"/></svg>' +
        '</button>' : "") +
    '<button class="tm-step" id="tm-stepOn" type="button" aria-label="' +
      WORDS.nextStop + '" title="' + WORDS.nextStop + '">' +
      '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor"' +
      ' stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">' +
      '<path d="M9 5l7 7-7 7"/></svg></button>' +
    /* AND THE COUNT, AFTER THEM. It belongs here and nowhere else: it is the
       answer to "how much of this is left", which is the question the two
       arrows raise, and a readout that answers a control ought to be beside
       that control rather than in another corner of the screen. It is filled
       in by refreshStepper, which already works out both halves of it for the
       arrows' own disabled states. role="status" so the number reaching a
       screen reader does not move the focus. */
    '<span id="tm-stepCount" role="status"></span>';
  const readouts = el("readouts");
  readouts.parentNode.insertBefore(box, readouts);
}

/* put the words on the page */
function writeWords() {
  /* Only if the page asked for it. The <title> in the head is what a search
     engine and a link preview read, it is per-page already, and it is written
     where anyone editing the page can see it — so overwriting it from here by
     default meant every trail inherited the Beltline's title. Set browserTab
     in a page's WORDS if you want it to differ from its own <title>. */
  if (WORDS.browserTab) document.title = WORDS.browserTab;
  const set = (id, text) => { const n = el(id); if (n) n.innerHTML = text; };
  set("cornerKicker",  WORDS.cornerKicker);
  set("cornerTitle",   WORDS.cornerTitle);
  set("openingKicker", WORDS.openingKicker);
  set("openingTitle",  WORDS.openingTitle);
  set("openingBody",   WORDS.openingBody);
  set("openingHint",   WORDS.openingHint);
  /* the picture behind the opening panel, if this trail has one */
  if (SETTINGS.trailImage) {
    const box = el("opening").querySelector(".tm-box");
    box.classList.add("tm-hasImage");
    box.style.setProperty("--opening-image", 'url("' + SETTINGS.trailImage + '")');
  }
  set("loadingWord",   WORDS.arriving);
  set("turnTitle",     WORDS.turnPhone);
  set("turnWhy",       WORDS.turnPhoneWhy);
  set("closingTitle",  WORDS.closingTitle);
  set("closingBody",   WORDS.closingBody);
  set("closingLabel1", WORDS.totalDistance);
  set("closingLabel2", WORDS.ascent);          // may change — see nameTheClimb()
  set("closingLabel3", WORDS.highPoint);
  set("readerTitle",   WORDS.readerTitle);
  set("readerHelp",    WORDS.readerHelp);
  set("version",       "v" + SETTINGS.version);
  writeBar();
  writeTrailLinks();
  set("north",         WORDS.north);
  el("compass").setAttribute("aria-label", WORDS.northLabel);
  el("compass").hidden = !SETTINGS.showCompass;
  el("boxDistance").querySelector("small").textContent  = WORDS.distance;
  el("boxElevation").querySelector("small").textContent = WORDS.elevation;
  el("boxAscent").querySelector("small").textContent    = WORDS.ascent;
  el("boxComplete").querySelector("small").textContent  = WORDS.complete;
}

/* The navigation bar shared with the rest of the site. */
function writeBar() {
  const brand = el("barBrand");
  brand.textContent = WORDS.bar.brand;
  brand.href = WORDS.bar.brandHref;
  el("barNav").innerHTML = WORDS.bar.links.map(link =>
    '<a href="' + link.href + '"' +
    (link.here ? ' class="tm-here" aria-current="page"' : '') +
    (link.kind ? ' class="tm-' + link.kind + '"' : '') +
    (link.newTab ? ' target="_blank" rel="noopener"' : '') + '>' +
    /* A link with a `short` form is written twice — the stylesheet shows one
       of them and hides the other, because which one fits is a question about
       the width of the window, and CSS is the only thing that knows that. */
    (link.short ? '<span class="nav-full">' + link.label + '</span>' +
               '<span class="nav-short">' + link.short + '</span>'
             : link.label) +
    '</a>').join("");
}

/* The row of link buttons under the corner title. A link with no href is
   simply not written, so the row empties itself and the stylesheet's
   #tm-links:empty rule takes it off the page. */
const ICONS = {
  /* A little glyph saying what the button will DO, which is different from
     what it points at: going back, saving a file, leaving the site. Drawn at
     24x24 and scaled by the stylesheet so they all match the text beside them.
     "back" sits before its label because that is the direction it means; the
     other two sit after, because they describe where the label leads. */
  back:     '<path d="M15 5 8 12l7 7"/>',
  download: '<path d="M12 4v10"/><path d="M8 11l4 4 4-4"/><path d="M5 19h14"/>',
  external: '<path d="M14 5h5v5"/><path d="M19 5l-8 8"/>' +
            '<path d="M18 14v4a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h4"/>'
};
const icon = name => !ICONS[name] ? "" :
  '<svg class="tm-linkIcon" viewBox="0 0 24 24" aria-hidden="true" fill="none"' +
  ' stroke="currentColor" stroke-width="2" stroke-linecap="round"' +
  ' stroke-linejoin="round">' + ICONS[name] + '</svg>';

function writeTrailLinks() {
  /* The DOWNLOAD button offers the drawing this page is actually showing, so
     it is filled in from SETTINGS.mapFile rather than being written out again
     in every page's words. A page with no mapFile has nothing to offer and the
     button is dropped, exactly like any other link with no href. */
  const links = WORDS.trailLinks.map(link => {
    if (link && link.icon === "download" && !link.href) {
      return Object.assign({}, link, { href: SETTINGS.mapFile || "" });
    }
    return link;
  });
  const wanted = links.filter(link => link && link.href);
  el("links").innerHTML = wanted.map(link =>
    '<a href="' + link.href + '"' +
    (link.download ? ' download' : '') +
    (link.newTab ? ' target="_blank" rel="noopener"' : '') +
    '>' + (link.icon === "back" ? icon("back") : "") + link.label +
    (link.icon && link.icon !== "back" ? icon(link.icon) : "") + '</a>').join("");
  // With no buttons the row takes no space, so the top band closes up by the
  // height it had been reserving for them and the cards move up to suit.
  if (!wanted.length) document.documentElement.style.setProperty("--title-links", "0px");
}

/* ── step 1: get the artwork into the page ─────────────────────────────── */
function loadArtwork(next) {
  if (SETTINGS.artwork === "inline") {
    const source = el("artwork");
    const svg = source && source.content.querySelector("svg");
    if (!svg) return giveUp(
      "There is no artwork in the <code>&lt;template id=\"tm-artwork\"&gt;</code> block " +
      "at the bottom of this file. Paste your Illustrator SVG in there, or point " +
      "<code>SETTINGS.artwork</code> at an image file.");
    return useSvg(svg.cloneNode(true), next);
  }

  if (/\.svgz?$/i.test(SETTINGS.artwork)) return giveUp(
    "<code>SETTINGS.artwork</code> can't be a separate SVG file — browsers refuse to " +
    "read one off the local disk, so the route inside it would be unreadable.<br><br>" +
    "Open <code>" + SETTINGS.artwork + "</code> in a text editor, copy the whole " +
    "<code>&lt;svg&gt;…&lt;/svg&gt;</code>, and paste it into the " +
    "<code>&lt;template id=\"tm-artwork\"&gt;</code> block at the bottom of this file. " +
    "Then set <code>artwork: \"inline\"</code>.");

  const probe = new Image();
  probe.onload = () => {
    mapW = (SETTINGS.mapSize && SETTINGS.mapSize[0]) || probe.naturalWidth;
    mapH = (SETTINGS.mapSize && SETTINGS.mapSize[1]) || probe.naturalHeight;
    const img = document.createElement("img");
    img.src = SETTINGS.artwork;
    img.alt = "";
    img.style.width = mapW + "px";
    img.style.height = mapH + "px";
    el("world").insertBefore(img, el("trail"));
    next();
  };
  probe.onerror = () => giveUp("Couldn't load <code>" + SETTINGS.artwork + "</code>. Check the filename and that it sits beside this page.");
  probe.src = SETTINGS.artwork;
}

function useSvg(svg, next) {
  const box = (svg.getAttribute("viewBox") || "").trim().split(/[\s,]+/).map(Number);
  mapW = (SETTINGS.mapSize && SETTINGS.mapSize[0]) || (box.length === 4 ? box[2] : parseFloat(svg.getAttribute("width")))  || 1000;
  mapH = (SETTINGS.mapSize && SETTINGS.mapSize[1]) || (box.length === 4 ? box[3] : parseFloat(svg.getAttribute("height"))) || 1000;
  // pin the artwork to its own coordinate system: 1 map unit = 1 pixel here
  svg.setAttribute("width", mapW);
  svg.setAttribute("height", mapH);
  if (box.length !== 4) svg.setAttribute("viewBox", "0 0 " + mapW + " " + mapH);
  svg.removeAttribute("style");
  svg.id = "tm-mapArtwork";
  /* Looked up once, here, rather than on every toggle: the artwork does not
     change after this, and a querySelector per switch press is a waste. */
  wishfulArt = SETTINGS.wishfulLayer ? svg.querySelector(SETTINGS.wishfulLayer) : null;
  el("world").insertBefore(svg, el("trail"));
  mapSvg = svg;

  /* The satellite picture sits UNDER the artwork, at exactly the artwork's
     size, so the two are registered corner to corner. Switching the layer on
     hides the printed map (SETTINGS.satelliteHides) and lets the photograph
     show through; the route and the waypoint circles live outside that group,
     so they stay drawn on top of it either way. */
  if (SETTINGS.satelliteImage) {
    const photo = document.createElement("img");
    photo.id = "tm-satellite";
    photo.alt = "";
    photo.src = SETTINGS.satelliteImage;
    photo.style.width  = mapW + "px";
    photo.style.height = mapH + "px";
    photo.addEventListener("error", () => {
      console.warn('The satellite picture "' + SETTINGS.satelliteImage +
                   '" did not load, so that layer has been removed.');
      photo.remove();
      satelliteOk = false;
      buildPanels();
    });
    el("world").insertBefore(photo, svg);
  }
  next();
}

/* ── step 2: turn the route into evenly spaced points ──────────────────── */

/* Walks any SVG path — straight, curved or both — and returns points spaced
   evenly along its true length, in map coordinates. Nested groups, transforms
   and clipping are all accounted for. */
function walkPath(pathNode, root, spacing) {
  const length = pathNode.getTotalLength();
  if (!length) return [];
  const rootAt = root.getScreenCTM(), pathAt = pathNode.getScreenCTM();
  const toMap = (rootAt && pathAt) ? rootAt.inverse().multiply(pathAt) : root.createSVGMatrix();
  const dot = root.createSVGPoint();
  const steps = Math.max(2, Math.ceil(length / spacing));
  const out = [];
  for (let i = 0; i <= steps; i++) {
    const p = pathNode.getPointAtLength(length * i / steps);
    dot.x = p.x; dot.y = p.y;
    const q = dot.matrixTransform(toMap);
    out.push({ x: q.x, y: q.y, metres: 0 });
  }
  return out;
}

function buildRoute() {
  if (SETTINGS.routeFrom === "artwork") {
    if (!mapSvg) { giveUp("<code>routeFrom: \"artwork\"</code> needs SVG artwork. With a flat image, use <code>\"paste\"</code> instead."); return false; }
    const line = mapSvg.querySelector(SETTINGS.routeName);
    if (!line) { giveUp(
      "No route in the artwork called <code>" + SETTINGS.routeName + "</code>.<br><br>" +
      "In Illustrator, name the trail path <b>route</b> in the Layers panel and export " +
      "SVG with <b>Object IDs → Layer Names</b>. Or change <code>SETTINGS.routeName</code> " +
      "to whatever it is actually called."); return false; }
    if (typeof line.getTotalLength !== "function") { giveUp(
      "<code>" + SETTINGS.routeName + "</code> is a <code>&lt;" + line.tagName.toLowerCase() +
      "&gt;</code>, not a line. Point <code>routeName</code> at the path itself, not the " +
      "layer holding it."); return false; }
    path = walkPath(line, mapSvg, SETTINGS.pointSpacing);
    if (SETTINGS.hideDrawnRoute) line.style.display = "none";

  } else {
    if (!SETTINGS.routePath) { giveUp("<code>routeFrom</code> is <code>\"paste\"</code> but <code>routePath</code> is empty."); return false; }
    // measure the pasted path inside a temporary SVG scaled onto the map
    const board = SETTINGS.routeArtboard || [mapW, mapH];
    const holder = document.createElementNS(SVG_NS, "svg");
    holder.setAttribute("viewBox", "0 0 " + board[0] + " " + board[1]);
    holder.setAttribute("width", mapW);
    holder.setAttribute("height", mapH);
    holder.setAttribute("preserveAspectRatio", "none");
    Object.assign(holder.style, { position: "absolute", top: 0, left: 0, opacity: 0, pointerEvents: "none" });
    const line = document.createElementNS(SVG_NS, "path");
    line.setAttribute("d", SETTINGS.routePath);
    holder.appendChild(line);
    el("world").appendChild(holder);
    path = walkPath(line, holder, SETTINGS.pointSpacing * (board[0] / mapW));
    holder.remove();
  }

  if (path.length < 2) { giveUp("The route came out empty. Check that it is one continuous line."); return false; }
  if (SETTINGS.reverseRoute) path.reverse();

  along = [0];
  for (let i = 1; i < path.length; i++)
    along.push(along[i - 1] + Math.hypot(path[i].x - path[i - 1].x, path[i].y - path[i - 1].y));
  routeLength = along[along.length - 1];
  return true;
}

/* where am I, `distance` map units along the route? */
function pointAt(distance) {
  distance = clamp(distance, 0, routeLength);
  let lo = 0, hi = along.length - 1;
  while (lo < hi - 1) { const mid = (lo + hi) >> 1; if (along[mid] <= distance) lo = mid; else hi = mid; }
  const a = path[lo], b = path[hi];
  const t = (distance - along[lo]) / ((along[hi] - along[lo]) || 1);
  return { x: mix(a.x, b.x, t), y: mix(a.y, b.y, t), metres: mix(a.metres, b.metres, t), index: lo };
}

/* ── step 3: place the waypoints on the route ──────────────────────────── */
function nearestPoint(x, y) {
  let best = 0, bestGap = Infinity;
  for (let i = 0; i < path.length; i++) {
    const gap = (path[i].x - x) ** 2 + (path[i].y - y) ** 2;
    if (gap < bestGap) { bestGap = gap; best = i; }
  }
  return best;
}

/* THE MIDDLE OF A SHAPE IN THE ARTWORK, in the artwork's own coordinates.
   A circle drawn inside a group that Illustrator has transformed is not where
   its own numbers say it is, so its box is measured and then put through the
   matrix between it and the drawing's root. Both the waypoint markers and the
   height marks are found this way. */
function centreOf(node) {
  const b = node.getBBox();
  const dot = mapSvg.createSVGPoint();
  dot.x = b.x + b.width / 2;
  dot.y = b.y + b.height / 2;
  const rootAt = mapSvg.getScreenCTM(), nodeAt = node.getScreenCTM();
  return dot.matrixTransform((rootAt && nodeAt)
    ? rootAt.inverse().multiply(nodeAt) : mapSvg.createSVGMatrix());
}

/* ── HEIGHT MARKS ────────────────────────────────────────────────────────
   Every dot in the drawing whose name begins with the prefix, as
   { at, metres } — where along the route it sits, and what it says the height
   is there. See heightMarks in the settings for what they are for.

   Each one is hidden as it is read. The stylesheet hides them too; this is the
   belt to its braces, and it is what keeps them invisible in a page whose
   stylesheet is older than its engine. */
function readHeightMarks() {
  const prefix = SETTINGS.heightMarks;
  if (!prefix || !mapSvg) return [];
  const found = [];
  mapSvg.querySelectorAll('[id^="' + prefix + '"]').forEach(node => {
    /* The prefix is reserved: anything in the artwork whose name begins with
       it is a height mark, is hidden, and is nothing else. One with no number
       in its name — `h-todo`, say — is hidden with the rest and simply has no
       height to give. */
    node.style.visibility = "hidden";
    const said = /^(-?\d+(?:\.\d+)?)/.exec(node.id.slice(prefix.length));
    if (!said) return;
    const spot = centreOf(node);
    const i = nearestPoint(spot.x, spot.y);
    const off = Math.hypot(path[i].x - spot.x, path[i].y - spot.y) / routeLength;
    if (off > SETTINGS.heightMarkStray) {
      console.warn('height mark "' + node.id + '" is a long way off the route ('
                   + Math.round(off * 100) + '% of its length) — it is being '
                   + 'read at the nearest point anyway');
    }
    found.push({ at: along[i] / routeLength, metres: parseFloat(said[1]) });
  });
  return found.sort((a, b) => a.at - b.at);
}

function placeWaypoints() {
  const placed = [];
  WAYPOINTS.forEach(w => {
    let distance = null;
    let node = null;              // the shape in the artwork, if it has one

    if (typeof w.along === "number") {
      distance = clamp(w.along, 0, 1) * routeLength;
    } else {
      let spot = null;
      if (w.marker && mapSvg) {
        node = mapSvg.querySelector(w.marker);
        if (node) {
          const q = centreOf(node);
          spot = { x: q.x, y: q.y };
        } else {
          console.warn('waypoint marker "' + w.marker + '" is not in the artwork — skipping "' + w.title + '"');
        }
      }
      if (!spot && Array.isArray(w.at)) spot = { x: w.at[0], y: w.at[1] };
      if (!spot) return;
      distance = along[nearestPoint(spot.x, spot.y)];
    }

    const here = pointAt(distance);
    placed.push({
      title: w.title, text: w.text, metres: w.metres,
      /* THE NAME THIS STOP HAS IN A URL. Written from the title unless the
         waypoint states one, so a stop is linkable without anyone having to
         think about it — and stating one is how you keep an old link working
         after retitling a stop. */
      slug: w.slug || slugify(w.title),
      kind: w.kind || "real",                 // "wishful" puts it on that layer
      /* WHAT IT WOULD TAKE, and how badly it is wanted. "low", "medium" or
         "high", and only ever set on a wishful stop — a stop that already
         exists costs nothing to build and cannot be a priority to build. */
      cost: w.cost || "", priority: w.priority || "",
      mapLink: w.mapLink || "",               // the button at the foot of the card
      media: w.media || w.photo || null,      // one file, or a list of them
      marker: node,
      x: here.x, y: here.y, distance: distance, fraction: distance / routeLength
    });
  });
  placed.sort((a, b) => a.fraction - b.fraction);
  return placed;
}

/* A title, as it appears in a URL: lower case, words joined by hyphens, and
   nothing in it that a browser would have to encode. Two stops on the SAME
   trail with the same title would collide — the console says so at build time
   rather than leaving one of them unreachable. */
function slugify(text) {
  return String(text || "").toLowerCase()
    .replace(/[\u2018\u2019']/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "stop";
}

/* ── step 4: heights, worked out from the waypoints ────────────────────── */
function buildHeights() {
  const typed = stops.filter(s => typeof s.metres === "number")
                     .map(s => ({ at: s.fraction, metres: s.metres }));
  /* THE HEIGHTS THE DRAWING KNOWS, added to the heights the waypoints know.
     A mark sitting on top of a waypoint gives way to it: the waypoint's height
     was typed by a person and is the one shown on its card, so the profile
     must pass through it exactly. Everywhere else the marks fill in what the
     straight line between two waypoints was only guessing at. */
  const marks = readHeightMarks().filter(m =>
    !typed.some(s => Math.abs(s.at - m.at) < SETTINGS.heightMarkClear));
  const known = typed.concat(marks).sort((a, b) => a.at - b.at);
  if (known.length < 2) return;

  // straight lines between the known heights, flat beyond the ends
  path.forEach((p, i) => {
    const t = along[i] / routeLength;
    if (t <= known[0].at)                      { p.metres = known[0].metres; return; }
    if (t >= known[known.length - 1].at)       { p.metres = known[known.length - 1].metres; return; }
    for (let k = 0; k < known.length - 1; k++) {
      if (t <= known[k + 1].at) {
        const f = (t - known[k].at) / ((known[k + 1].at - known[k].at) || 1);
        p.metres = mix(known[k].metres, known[k + 1].metres, f);
        return;
      }
    }
  });

  // soften the corners where those straight lines meet, so the profile reads
  // like ground rather than a bar chart
  const span = Math.round(SETTINGS.smoothElevation);
  if (span > 1) {
    const raw = path.map(p => p.metres);
    for (let i = 0; i < path.length; i++) {
      let sum = 0, n = 0;
      for (let k = i - span; k <= i + span; k++) {
        if (k < 0 || k >= raw.length) continue;
        sum += raw[k]; n++;
      }
      path[i].metres = sum / n;
    }
  }

  // Smoothing rounds the corners, but it also drags the heights slightly off
  // the waypoints you typed. Measure that drift at each waypoint and take it
  // back out, so a waypoint always reads exactly the number you gave it.
  if (span > 1) {
    const drift = known.map(k => ({
      at: k.at,
      off: k.metres - pointAt(k.at * routeLength).metres
    }));
    path.forEach((p, j) => {
      const t = along[j] / routeLength;
      let off = drift[drift.length - 1].off;
      if (t <= drift[0].at) off = drift[0].off;
      else for (let k = 0; k < drift.length - 1; k++) {
        if (t <= drift[k + 1].at) {
          off = mix(drift[k].off, drift[k + 1].off,
                    (t - drift[k].at) / ((drift[k + 1].at - drift[k].at) || 1));
          break;
        }
      }
      p.metres += off;
    });
  }

  haveHeights = true;
  /* One pass along the route builds climbedTo[]: how much uphill there has
     been by the time you reach each point. The readout then only has to look
     up its own position instead of adding the whole trail up again on every
     frame, which is what it used to do. */
  /* Which way does this trail go, overall? Not "does it ever go down", but
     "does it end lower than it began" — one comparison, end to end. */
  downhillTrail = SETTINGS.signedElevation &&
                  path[path.length - 1].metres < path[0].metres;

  climbedTo = new Array(path.length);
  climbedTo[0] = 0;
  for (let i = 1; i < path.length; i++) {
    const rise = path[i].metres - path[i - 1].metres;
    if (rise > 0) totalClimb += rise;
    climbedTo[i] = totalClimb;
    highest = Math.max(highest, path[i].metres);
  }
  // let each card show the height actually used at its position
  stops.forEach(s => { if (typeof s.metres !== "number") s.metres = pointAt(s.distance).metres; });
}

/* ── step 5: build the page and run it ─────────────────────────────────── */
function start() {
  const world = el("world");
  world.style.width  = mapW + "px";
  world.style.height = mapH + "px";
  el("trail").setAttribute("viewBox", "0 0 " + mapW + " " + mapH);
  el("trail").setAttribute("width", mapW);
  el("trail").setAttribute("height", mapH);

  if (!buildRoute()) return;
  stops = placeWaypoints();
  buildHeights();

  /* Turn the route's measured length into real distances. buildRoute() has
     just walked the path and set routeLength, in map units. Everything on the
     page that shows a distance is derived from these two lines and nothing
     else, so the scale is decided exactly once.

     Given a trailLength we work backwards: the route measures so many map
     units and is known to be so many kilometres, therefore one map unit is
     this many metres. Given metresPerPixel instead we take it as stated. */
  const perMetre = SETTINGS.trailLength
    ? (SETTINGS.trailLength * 1000) / routeLength
    : SETTINGS.metresPerPixel;
  const realLength = perMetre ? routeLength * perMetre : null;

  // a note in the console, so the scale can be checked while setting a map up
  if (perMetre) console.info(
    "Trail scale: the route measures " + Math.round(routeLength) + " map units; at " +
    perMetre.toFixed(3) + " m per unit that is " + (realLength / 1000).toFixed(2) + " km" +
    (SETTINGS.trailLength ? " (from SETTINGS.trailLength)" : " (from SETTINGS.metresPerPixel)"));

  /* the three lines that make up the trail */
  const shape = "M" + path.map(p => p.x.toFixed(1) + " " + p.y.toFixed(1)).join(" L");
  ["trailOutline", "trailAhead", "trailWalked"].forEach(id => el(id).setAttribute("d", shape));
  el("trailOutline").style.stroke = "var(--trail-outline)";
  el("trailAhead").style.stroke   = "var(--trail-ahead)";
  el("trailWalked").style.stroke  = "var(--trail-walked)";
  const drawLength = el("trailWalked").getTotalLength();

  /* name chips on the map, plus the moving point */
  const chips = [];
  function addChip(id, inner) {
    const node = document.createElement("div");
    node.className = "tm-label";
    if (id) node.id = "tm-" + id;
    node.innerHTML = inner;
    el("labels").appendChild(node);
    return node;
  }
  /* The ring on the route and the name beside it are one element, pinned to
     the waypoint's position. Making the ring part of the chip rather than a
     thing of its own means it inherits everything the chip already has: it
     holds its size as the map zooms, it opens the card when clicked, and it
     disappears with its layer. Nothing extra to keep in step.

     The page draws this ring itself instead of leaving it to the circle in the
     artwork, because when the satellite layer is on the artwork underneath is
     hidden — and a waypoint you cannot see is not much of a waypoint. */
  document.documentElement.style.setProperty("--marker-size", SETTINGS.waypointSize + "px");
  document.documentElement.style.setProperty("--marker-ring", SETTINGS.waypointRing + "px");
  document.documentElement.style.setProperty("--marker-ring-wish", SETTINGS.waypointRingWish + "px");

  if (SETTINGS.showWaypointLabels || SETTINGS.drawWaypoints) stops.forEach((s, i) => {
    const chip = addChip("",
      (SETTINGS.drawWaypoints ? '<div class="tm-pin"></div>' : "") +
      (SETTINGS.showWaypointDots && !SETTINGS.drawWaypoints ? '<div class="tm-dot"></div>' : "") +
      (SETTINGS.showWaypointLabels ? '<div class="tm-tag">' + s.title + "</div>" : ""));
    if (s.kind === "wishful") chip.classList.add("tm-wishful");
    chip.style.left = s.x + "px";
    chip.style.top  = s.y + "px";
    s.chip = chip;              // so a card can be thrown from it
    if (SETTINGS.cardsReopenOnClick) {
      chip.title = WORDS.openCard;
      chip.classList.add("tm-clickable");
      chip.addEventListener("click", () => { byHand(); tapCard(i); });
    }
    chips.push(chip);
  });
  const walker = addChip("walker", '<div class="tm-ring"></div><div class="tm-dot"></div>');

  /* ── where this trail meets another ────────────────────────────────────
     A network is trails that join up, so the page should let you follow one
     into the next. Each crossing is a small circle in the drawing — put there
     off to one side of the route on purpose, so it can never sit underneath a
     waypoint and leave two buttons in one place — and this turns each into a
     link to that trail's page.

     A crossing named in the page but missing from the drawing is skipped and
     said so in the console, rather than being placed at 0,0 where it would
     look like a bug in the map. */
  (PAGE.CROSSINGS || []).forEach((cross, n) => {
    if (!SETTINGS.crossings) return;
    const mark = mapSvg && mapSvg.querySelector(SETTINGS.crossingMark + (n + 1));
    if (!mark) {
      console.warn('The crossing "' + cross.label + '" has no ' +
                   SETTINGS.crossingMark + (n + 1) + " circle in the artwork, " +
                   "so it has not been placed.");
      return;
    }
    const box = mark.getBBox();
    const node = addChip("", '<a class="tm-cross" href="' + cross.href + '">' +
      '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor"' +
      ' stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
      '<path d="M9 7H6a4 4 0 0 0 0 8h3"/><path d="M15 7h3a4 4 0 0 1 0 8h-3"/>' +
      '<path d="M8 11h8"/></svg>' +
      '<span>' + cross.label + "</span></a>");
    node.classList.add("tm-crossing");
    node.style.left = (box.x + box.width / 2) + "px";
    node.style.top  = (box.y + box.height / 2) + "px";
    chips.push(node);        // so it holds its size as the map zooms
  });

  /* ── THE LEFT RAIL AND ITS ONE PANEL ─────────────────────────────────────
     What went wrong on the Happy Trails map: each panel had its own tab
     clipped to its edge, so the tabs slid about as panels opened and closed
     and could end up beside the wrong panel. Here the two buttons are pinned
     to the rail and never move, and there is a single panel that swaps its
     contents. Pressing the button of the section already showing closes it. */
  let openPanel = null;                       // "legend", "layers" or null
  const anyWishful = stops.some(s => s.kind === "wishful");
  const wishfulLocked = SETTINGS.trailKind === "wishful";

  const panelFor = {
    legend: { title: WORDS.legendTitle, note: WORDS.legendNote, body: legendRows },
    layers: { title: WORDS.layersTitle, note: WORDS.layersNote, body: layerSwitches }
  };

  /* Each row's drawing is a file in SETTINGS.legendFolder named after its
     `swatch` — legend/trail.svg for swatch:"trail". A row whose file is
     missing keeps its label and simply shows nothing in the icon column,
     rather than the broken-image mark. */
  function legendRows() {
    return '<ul class="tm-legend">' + WORDS.legend.map(row =>
      '<li><img class="tm-sw" alt="" src="' + (SETTINGS.legendFolder || SETTINGS.iconFolder) + row.swatch +
      '.svg" data-swatch="' + row.swatch + '"><span>' + row.label +
      "</span></li>").join("") + "</ul>";
  }

  /* A row whose icon is missing keeps its label and leaves the space blank —
     and says so in the console, because a silently blank legend is a miserable
     thing to debug. One listener for the whole list; an <img> error does not
     bubble, hence the capture phase. */
  el("panelBody").addEventListener("error", e => {
    const img = e.target;
    if (!img.classList || !img.classList.contains("tm-sw")) return;
    img.style.visibility = "hidden";
    console.warn('Legend icon "' + img.dataset.swatch + '" did not load from "' +
      img.getAttribute("src") + '".\n  Check that the legend folder really sits' +
      ' beside this page. On Windows, "Extract All" on a zip whose contents are' +
      ' already inside a folder gives you legend\\legend\\ — one level too deep.');
  }, true);

  function layerSwitches() {
    const rows = [];
    /* ON A WISHFUL TRAIL THE SWITCH IS LOCKED ON.
       It hides the stops that are proposed rather than built — a distinction
       that means something on a real trail with a proposed extension, and
       nothing at all here, where the entire route is proposed. Switching it
       off would blank part of a page whose whole subject is the part it
       blanked. So the row still appears, because taking it away would make
       the panel differ between trails for no visible reason, but it appears
       greyed out and cannot be pressed. */
    if (anyWishful) rows.push(switchRow("wishful", WORDS.layerWishful,
                                        wishfulLocked ? WORDS.layerWishfulLocked
                                                      : WORDS.layerWishfulNote,
                                        wishfulOn, wishfulLocked));
    /* Always shown, on every trail, and always the last row: it is about how
       the page behaves rather than about what is drawn on the map, so it does
       not belong among the layers that switch artwork on and off — but it is
       what a reader who wants the page to stop moving will come looking for,
       and the layers panel is where they will look. */
    if (SETTINGS.autoLoadSwitch)
      rows.push(switchRow("autoload", WORDS.layerAutoLoad,
                          autoLoadOn ? WORDS.layerAutoLoadOn : WORDS.layerAutoLoadOff,
                          autoLoadOn));
    if (SETTINGS.satelliteImage && satelliteOk)
      rows.push(switchRow("satellite", WORDS.layerSatellite,
                          WORDS.layerSatelliteNote, satelliteOn));
    return '<div class="tm-switches">' + rows.join("") + "</div>";
  }

  /* `locked` draws the row as a statement rather than a control: greyed, and
     disabled, which is what stops the click — the handler below never runs on
     a disabled button, so there is no second place to remember this. */
  function switchRow(name, label, note, on, locked) {
    return '<button class="tm-switch' + (on ? " is-on" : "") +
           (locked ? " is-locked" : "") + '" type="button" ' +
           (locked ? "disabled " : "") +
           'data-layer="' + name + '" role="switch" aria-checked="' + on + '">' +
           '<span class="tm-track"><span class="tm-knobby"></span></span>' +
           '<span class="tm-switchText"><b>' + label + "</b><small>" + note +
           "</small></span></button>";
  }

  buildPanels = function () {
    if (!openPanel) return;
    const p = panelFor[openPanel];
    el("panelTitle").textContent = p.title;
    el("panelNote").textContent = p.note || "";
    el("panelNote").hidden = !p.note;
    el("panelBody").innerHTML = p.body();
  };

  function showPanel(which) {
    openPanel = (openPanel === which) ? null : which;
    // Opening: take `hidden` off first, or there is nothing to animate.
    // Closing: leave it on until the fade has played — the listener below
    // puts it back once the opacity transition ends.
    if (openPanel) el("panel").hidden = false;
    el("panel").classList.toggle("is-open", !!openPanel);
    el("legendBtn").classList.toggle("is-on", openPanel === "legend");
    el("layersBtn").classList.toggle("is-on", openPanel === "layers");
    el("legendBtn").setAttribute("aria-expanded", openPanel === "legend");
    el("layersBtn").setAttribute("aria-expanded", openPanel === "layers");
    buildPanels();
  }

  /* Everything the two switches control, in one place. Called whenever either
     changes, and once at the start so the page matches the switches even if
     you set them differently in SETTINGS. */
  applyLayers = function () {
    // the wishful stops: their circle on the map, their name chip, their dot
    // on the elevation graph. Their cards are handled by onALiveLayer above.
    stops.forEach((s, i) => {
      if (s.kind !== "wishful") return;
      if (s.marker) s.marker.style.display = wishfulOn ? "" : "none";
      if (chips[i]) chips[i].style.display = wishfulOn ? "" : "none";
    });
    document.querySelectorAll("#tm-profile .tm-wpdot.tm-wishful")
            .forEach(d => { d.style.display = wishfulOn ? "" : "none"; });

    /* The routes that do not exist yet, drawn in the artwork itself — the
       bridge that would close a gap, the link that would join two trails. They
       belong to this switch as much as the purple waypoints do: a proposal and
       the stop that explains it should never be visible without each other. */
    if (wishfulArt) wishfulArt.style.display = wishfulOn ? "" : "none";
    // the arrows can only reach stops that are on the map
    if (stepperNeedsRefresh) stepperNeedsRefresh();

    // the satellite view: show the photograph, hide the printed map over it
    const printed = mapSvg && SETTINGS.satelliteHides
                  ? mapSvg.querySelector(SETTINGS.satelliteHides) : null;
    const paper   = mapSvg ? mapSvg.querySelector("#background") : null;
    const showPhoto = satelliteOn && satelliteOk;
    if (printed) printed.style.display = showPhoto ? "none" : "";
    if (paper)   paper.style.display   = showPhoto ? "none" : "";
    const photo = el("satellite");
    if (photo) photo.style.display = showPhoto ? "" : "none";
    /* The flat picture stands in for the drawing, but it is a picture of the
       printed map — so it steps aside whenever the printed map is meant to be
       hidden. When it is standing in, the drawing is made invisible rather
       than removed: everything else still reads positions out of it. */
    if (flatPicture) {
      const useFlat = !showPhoto;
      flatPicture.style.display = useFlat ? "" : "none";
      mapSvg.style.visibility   = useFlat ? "hidden" : "";
    }
    // the page behind the map, the shading over it and the dotted line ahead
    // all have a light version and a dark one
    document.body.classList.toggle("tm-satellite", showPhoto);
  };

  /* ── where the rail of buttons stands on a phone ───────────────────────
     The card is anchored to the BOTTOM of its column, so its top edge is
     wherever its own height leaves it — and that differs from card to card,
     because a card with less text is shorter. The rail has to start below the
     highest of those top edges, or the card that sits lowest will cross a
     button halfway down and cut it in half.

     So it is measured rather than guessed: clear the offset, note where the
     rail naturally sits, find the lowest card top of the whole set, and drop
     the rail by the difference. Two layout reads, at startup and on a resize —
     nothing per frame. Change the words or the pictures and the cards change
     height; this follows them without anyone having to retune a number.     */
  function placeRail() {
    const rail = el("rail");
    if (!rail || !cards.length) return;
    rail.style.setProperty("--rail-drop", "0px");     // back to its natural place
    const here = rail.getBoundingClientRect();
    const column = el("cards").getBoundingClientRect();

    /* Is there anything to solve? Only when the card column actually runs
       across the rail — which is the wide-card layout, and is asked as a
       question about the real boxes rather than about the window's width, so
       it stays true whatever the breakpoint is set to. */
    const overlaps = column.left < here.right && column.right > here.left;
    if (!SETTINGS.railBelowCardsOnPhone || !overlaps) {
      rail.style.removeProperty("--rail-drop");
      return;
    }

    /* Drop to the LOWEST top edge of the whole set. A shorter card starts
       further down, and it is that one which would otherwise cross a button. */
    let lowest = here.top;
    cards.forEach(card => {
      const box = card.getBoundingClientRect();
      if (box.height > 0 && box.top > lowest) lowest = box.top;
    });
    rail.style.setProperty("--rail-drop", Math.max(0, Math.round(lowest - here.top)) + "px");
  }

  /* ── flattening the artwork on a phone ─────────────────────────────────
     WHY. The map moves under you on every frame. When it is a drawing, that
     means the phone re-traces every line in it from its outline, every frame —
     and this artwork is mostly contour lines, which are the worst possible
     case: hundreds of points each, all of them redrawn to move the picture a
     few pixels. Turning the drawing into a single flat picture once, and
     moving that instead, is the same view for a fraction of the work.

     HOW. The drawing is written out as text, handed to the browser as an
     image, painted once into a canvas at flattenWidth pixels across, and the
     result is put in front of it. The drawing itself stays in the page,
     invisible: it is still what the route, the waypoints and the layer
     switches are read from and written to, so nothing else in the page has to
     know this happened.

     WHEN IT STANDS ASIDE. Switching the satellite view on hides the printed
     map, which the flat picture would still be showing. So the flat picture is
     put away whenever the satellite is on — and the drawing underneath is
     cheap to move at that point anyway, because most of it is hidden.
     Preparing the picture takes about a second on a mid-range phone, so it is
     done a moment after the page is up and usable, with the live drawing
     showing until it is ready. Nothing is ever missing; it just gets cheaper. */
  let flatPicture = null;                 // the <img>, once it has been made

  function flattenArtwork() {
    if (!SETTINGS.flattenOnPhone || !isPhone() || !mapSvg || flatPicture) return;
    let source;
    try { source = new XMLSerializer().serializeToString(mapSvg); }
    catch (e) { return; }                 // nothing to lose if this is refused
    const url = URL.createObjectURL(new Blob([source], { type: "image/svg+xml" }));
    const drawing = new Image();
    drawing.onload = () => {
      try {
        const wide = Math.max(1, Math.round(SETTINGS.flattenWidth));
        const tall = Math.max(1, Math.round(wide * mapH / mapW));
        const sheet = document.createElement("canvas");
        sheet.width = wide; sheet.height = tall;
        sheet.getContext("2d").drawImage(drawing, 0, 0, wide, tall);
        const flat = new Image();
        flat.onload = () => {
          flat.id = "tm-flatMap";
          flat.alt = "";
          flat.style.width  = mapW + "px";
          flat.style.height = mapH + "px";
          mapSvg.parentNode.insertBefore(flat, mapSvg);
          flatPicture = flat;
          applyLayers();                  // decides which of the two is shown
        };
        flat.src = sheet.toDataURL("image/webp", 0.9);
      } catch (e) { /* a canvas the browser will not let us read: carry on */ }
      URL.revokeObjectURL(url);
    };
    drawing.onerror = () => URL.revokeObjectURL(url);
    drawing.src = url;
  }

  /* Put `hidden` back once the closing fade has finished. The stylesheet has
     already made the panel inert by then (visibility and pointer-events), so
     this is tidiness rather than the fix — but it leaves the panel genuinely
     display:none when shut, which is what anyone reading the DOM expects. */
  el("panel").addEventListener("transitionend", e => {
    if (e.target === el("panel") && e.propertyName === "opacity" && !openPanel) {
      el("panel").hidden = true;
    }
  });

  el("panelClose").addEventListener("click", () => showPanel(openPanel));
  el("legendBtn").addEventListener("click", () => showPanel("legend"));
  el("layersBtn").addEventListener("click", () => showPanel("layers"));
  el("panelBody").addEventListener("click", e => {
    const sw = e.target.closest(".tm-switch");
    if (!sw) return;
    byHand();
    if (sw.dataset.layer === "wishful")   wishfulOn = !wishfulOn;
    if (sw.dataset.layer === "satellite") satelliteOn = !satelliteOn;
    if (sw.dataset.layer === "autoload") {
      autoLoadOn = !autoLoadOn;
      /* Switching it OFF puts away whatever is on screen — otherwise the card
         you were looking at stays up, and the switch appears not to have done
         anything until you scroll. Switching it ON opens nothing: the walk
         will do that at the next waypoint, which is the behaviour being
         turned back on. */
      if (!autoLoadOn) cardState.forEach(state => { state.held = false; state.closed = true; });
      wake();
    }
    applyLayers();
    buildPanels();
    nudge();
  });
  document.addEventListener("keydown", e => {
    if (e.key === "Escape" && openPanel) showPanel(openPanel);
  });

  el("legendBtn").addEventListener("click", byHand);
  el("layersBtn").addEventListener("click", byHand);

  el("legendBtn").hidden = !SETTINGS.showLegend;
  /* The layers button used to be hidden on a trail with no wishful stops and
     no satellite image, because there was nothing in the panel. There always
     is now — Waypoint auto-load is on every trail — so the button goes only if
     the panel would genuinely be empty. */
  el("layersBtn").hidden = !SETTINGS.showLayers ||
                           (!anyWishful && !SETTINGS.satelliteImage &&
                            !SETTINGS.autoLoadSwitch);
  el("legendBtn").querySelector(".tm-railName").textContent = WORDS.legendName;
  el("layersBtn").querySelector(".tm-railName").textContent = WORDS.layersName;
  el("legendBtn").title = WORDS.legendName;
  el("layersBtn").title = WORDS.layersName;
  el("panelClose").title = WORDS.closePanel;

  /* A wishful trail shows all of itself: the switch that would hide part
     of it is locked on, so the setting that would start it off is ignored
     rather than quietly leaving stops hidden with no way to get them back. */
  wishfulOn   = (SETTINGS.trailKind === "wishful") || SETTINGS.wishfulOn !== false;
  satelliteOn = SETTINGS.satelliteOn === true;
  applyLayers();
  if (SETTINGS.openPanelAtStart) showPanel(SETTINGS.openPanelAtStart);

  /* if a waypoint was placed with a shape drawn in the artwork, that shape is
     clickable too — so clicking the dot on the map opens its card, not just
     the name chip beside it */
  if (SETTINGS.cardsReopenOnClick) stops.forEach((s, i) => {
    if (!s.marker) return;
    s.marker.style.cursor = "pointer";
    s.marker.addEventListener("click", () => { byHand(); tapCard(i); });
  });

  /* which card is currently the visible one, and whether it has faded in far
     enough to count as on screen. Both are used to decide which video, if any,
     should be playing. */
  let frontCard = -1, frontShowing = false;
  /* which card's coin and dial have already been played — see the note at the
     bottom of draw(), where it is used */
  let iconsPlayedFor = -1;

  /* ── THE WAYPOINT CARDS ──────────────────────────────────────────────────
     The cards themselves are in waypoint-card.js, which this page and the
     main map both load. Everything about what a card IS — its picture, its
     caption, the paged text, the facts, the × and the expand button — is in
     there. What stays here is the only part a trail page does differently:
     WHEN a card is shown, which on this page is the walk's business and is
     worked out in draw() from where the reader has scrolled to.

     Loading it is not optional. A trail page without it has no cards at all,
     which would be a blank column beside the map and nothing to say why — so
     it says why. */
  if (typeof window.HappyTrailsCards !== "function") {
    giveUp("This page needs <code>waypoint-card.js</code>, which is not "
           + "there. It sits beside <code>trail-engine.js</code> and holds "
           + "the waypoint cards; upload the two together.");
    return;
  }

  /* WHAT A LINK TO EACH WAYPOINT LOOKS LIKE, worked out once and handed to the
     cards. The card cannot work this out for itself and should not try: the
     same card module also runs on the main map, where a waypoint's address is
     on a different page altogether. */
  if (SETTINGS.linkToStops) {
    const page = location.origin + location.pathname;
    stops.forEach(s => { if (s.slug) s.share = page + "#" + s.slug; });
  }

  const deck = HappyTrailsCards({
    host:     el("cards"),
    veil:     el("cardveil"),
    stops:    stops,
    settings: SETTINGS,
    words:    WORDS,
    haveHeights: haveHeights,
    perMetre: perMetre,
    numbering: true,
    front:    () => frontCard,
    onClose:  i => { byHand(); closeCard(i); },
    onOpen:   i => openCard(i),
    /* WHAT A TRAIL PAGE HOLDS STILL while a card is expanded: its own scroll.
       Scrolling this page is walking the trail, and someone reading a
       waypoint closely is not walking — see the three refusals below. */
    onBig:    on => {
      heldAt = window.scrollY;
      /* AND THE LAST READING OF THE SCROLL IS TAKEN NOW. From here until the
         card is put back nothing else will take one — see nudge — and a link
         that jumped to this waypoint a moment ago has only just changed it,
         so without this the map would be left drawing the place the reader
         came from rather than the one they asked for. */
      if (on) wanted = scrolled();
    },
    wake:     () => wake(),
    onAMeteredLine: onAMeteredLine,
  });

  const cards       = deck.cards;
  const measurePages = deck.measureOne;
  const showSlide   = deck.showSlide;
  const showPage    = deck.showPage;
  const showCaption = deck.showCaption;
  const playTheRightVideo = deck.playTheRightVideo;
  const setBig      = deck.setBig;
  const roomToGrow  = deck.roomToGrow;

  /* the walk asks the deck rather than holding this itself */
  const bigOn = () => deck.isBig();
  let heldAt = 0;                 // the scroll position the walk is left at

  /* Each card carries three pieces of state:
       shownness  0 to 1, the fade the × button and a click drive. It is
                  separate from the scroll-driven fade, and the two multiply,
                  so closing a card looks the same wherever you are.
       closed     the reader pressed ×. It stays down until the walk leaves its
                  stretch of scroll, so it can appear again on a later visit.
       held       the reader clicked this waypoint on the map. The card ignores
                  the scroll position until they close it or the walk arrives
                  at the next waypoint.                                        */
  const cardState = stops.map(() => ({ shownness: 1, closed: false, held: false }));

  /* set by draw() when any card is mid-fade, so the loop keeps running even
     though the page is not being scrolled */
  let cardsMoving = false;

  /* true while somebody is dragging the elevation graph's knob. See draw(). */
  let scrubbing = false;

  /* WHICH WAYPOINT THE WALK WAS STANDING AT when a card was last opened by
     hand, and the one it is standing at now. The two together are what let a
     clicked card stay open: see the note in draw() where a held card gives
     way. */
  let arrivedAt = -1, heldFrom = -2;

  /* ── A PERSON JUST DID SOMETHING ────────────────────────────────────────
     Called from the handlers of real events — a click, a key, a drag — and
     never from an API call. That distinction is the whole of it: the tour
     opens and closes cards all day through the same functions a person does,
     and it must not stop itself. So the signal is raised where the browser
     told us a human was involved, not where the work happens.

     The tour listens for it and gets out of the way. Anything else that ever
     wants to know when a reader has taken over can listen for the same
     thing. */
  function byHand() { document.dispatchEvent(new CustomEvent("trail:handover")); }

  /* A CARD BEING SHOVED ASIDE BY THE NEXT ONE. { out, in, at } — which card is
     leaving, which is arriving, and how far through the shove we are, 0 to 1.
     Null when no swap is happening, which is nearly always. */
  let swapping = null;

  function closeCard(i) {
    cardState[i].closed = true;
    cardState[i].held = false;
    // A CARD ALWAYS COMES BACK SMALL. Closing one puts the view back at the
    // same time, so the next card to appear is the ordinary one beside the
    // map. Quietly: the card is fading away over the same moment, and an
    // expensive-looking shrink underneath a fade reads as a glitch.
    if (bigOn()) setBig(false, i, true);
    wake();
  }

  function openCard(i, quietly) {
    const wasFront = frontCard;
    // where the walk was standing when this was asked for — see draw()
    heldFrom = arrivedAt;
    cardState.forEach((state, k) => {
      state.held = (k === i);          // only ever one card held open
      if (k === i) state.closed = false;
      // With auto-load off nothing else will ever re-close these, and a card
      // left un-closed would fade back in the moment the held one let go.
      else if (!autoLoadOn) state.closed = true;
    });
    wake();

    /* A CARD ARRIVES THE WAY EVERY CARD ARRIVES — by fading and rising, which
       the drawing loop already does from `shownness`. There was briefly a
       version of this that threw the card out of the waypoint's own circle,
       and it was wrong twice over: the throw fought the rise the loop was
       doing at the same moment, and because the throw ended on the transform
       the card had when it STARTED, clearing it afterwards let the card jump
       the last few pixels of that rise in one frame — a small hop, a moment
       after the card had apparently finished arriving. One motion is better
       than two, and the one the loop does was already right.

       `quietly` is still honoured: the tour uses it, and it is what tells the
       swap below not to treat a tour step as somebody changing their mind. */
    /* AND THE SWAP IS REMEMBERED. When a click replaces one card with
       another, the outgoing one is shoved aside by the incoming one rather
       than simply dissolving under it — see `swapping` and the drawing loop.
       Only for a card opened BY HAND: the tour changes card every few seconds
       and does not want a shove each time. */
    if (!quietly && wasFront >= 0 && wasFront !== i) swapping = { out: wasFront, in: i, at: 0 };
  }

  /* A CLICK ON A WAYPOINT IS A TOGGLE. On the one whose card is already up it
     puts the card away; on any other it swaps to that one, wherever the walk
     happens to have got to. */
  function tapCard(i) {
    if (frontCard === i && !cardState[i].closed) closeCard(i);
    else openCard(i);
  }

  /* EVERY CARD SHUT, whatever opened it. Escape does this, and so does the
     tour when it finishes. */
  function closeAllCards() {
    if (bigOn()) setBig(false, undefined, true);
    cardState.forEach((state, i) => { state.held = false; state.closed = true; });
    wake();
  }


  /* ── HOLDING THE WALK STILL WHILE A CARD IS OPEN ────────────────────────
     Scrolling this page is walking the trail, and someone reading one
     waypoint closely is not walking: left alone, the smallest scroll would
     carry the card they are reading off the screen. So while the big view is
     up, everything that scrolls a page is refused.

     The page is NOT given overflow:hidden, which is the usual way to do this.
     That takes the scrollbar away, and the window is fifteen pixels wider for
     as long as it is gone — so the map, which is sized to the window, jumps
     sideways at the exact moment the card is trying to move smoothly. Turning
     away the input instead leaves the layout alone.

     Three refusals, because there are three ways to scroll: the wheel, the
     keys, and anything else at all — a middle-click drag, a trackpad gesture,
     a browser's own find-on-page — which the last one catches by simply
     putting the page back where it was.                                     */
  const SCROLL_KEYS = [" ", "PageUp", "PageDown", "Home", "End",
                       "ArrowUp", "ArrowDown"];
  addEventListener("wheel", e => { if (bigOn()) e.preventDefault(); },
                   { passive: false });
  addEventListener("touchmove", e => { if (bigOn()) e.preventDefault(); },
                   { passive: false });
  /* ESCAPE PUTS AWAY WHATEVER IS IN FRONT OF THE MAP, one layer at a time:
     an expanded card shrinks first (below), and Escape again — or Escape with
     nothing expanded — shuts every card and leaves you looking at the trail.
     It is registered before the handler below so the two cannot both fire on
     the same press. */
  addEventListener("keydown", e => {
    if (e.key !== "Escape" || bigOn()) return;
    if (openPanel) return;              // a panel has first claim on Escape
    closeAllCards();
  });

  addEventListener("keydown", e => {
    if (!bigOn()) return;
    if (e.key === "Escape") { setBig(false); return; }
    // not the arrows inside the card itself — the before/after slider is
    // worked with them, and it is on the screen
    const inTheCard = e.target && e.target.closest && e.target.closest(".tm-card");
    if (!inTheCard && SCROLL_KEYS.indexOf(e.key) >= 0) e.preventDefault();
  });
  addEventListener("scroll", () => {
    if (bigOn() && Math.abs(window.scrollY - heldAt) > 1) window.scrollTo(0, heldAt);
  }, { passive: true });

  // clicking the veil is the other way out, and the one people try first
  el("cardveil").addEventListener("click", () => setBig(false));

  /* A window that has become too small for the big view puts it back rather
     than leaving a card wider than the screen. The card measurements that
     follow a resize are the ordinary ones, further down. */
  addEventListener("resize", () => { if (bigOn() && !roomToGrow()) setBig(false, -1, true); });

  /* elevation strip */
  // GRAPH_W and GRAPH_H are just the graph's own drawing box — it is stretched
  // to whatever width and height the stylesheet gives it, so they never change
  const STEPS = SETTINGS.profileDetail, GRAPH_W = 1000, GRAPH_H = 100;
  const graphX = i => (i / (STEPS - 1)) * GRAPH_W;
  let heights = [], lowMark = 0, highMark = 1, walkedLine, cursorLine, cursorKnob;
  const graphY = m => GRAPH_H - ((m - lowMark) / ((highMark - lowMark) || 1)) * (GRAPH_H - 8) - 4;

  if (haveHeights) {
    for (let i = 0; i < STEPS; i++) heights.push(pointAt((i / (STEPS - 1)) * routeLength).metres);
    lowMark = Math.min.apply(null, heights);
    highMark = Math.max.apply(null, heights);
    let d = "M0 " + graphY(heights[0]);
    for (let i = 1; i < STEPS; i++) d += " L" + graphX(i) + " " + graphY(heights[i]);
    el("profile").innerHTML =
      '<svg viewBox="0 0 ' + GRAPH_W + " " + GRAPH_H + '" preserveAspectRatio="none" aria-hidden="true">' +
      '<path class="tm-under" d="' + d + " L" + GRAPH_W + " " + GRAPH_H + " L0 " + GRAPH_H + ' Z"/>' +
      '<path class="tm-whole" d="' + d + '"/>' +
      '<path class="tm-walked" id="tm-graphWalked" d=""/>' +
      '<line class="tm-cursor" id="tm-graphCursor" x1="0" y1="0" x2="0" y2="' + GRAPH_H + '"/>' +
      '</svg>' +
      /* One dot per waypoint. Both numbers come straight off the same `stops`
         list the cards and the map pins are built from — a waypoint's place on
         the route is written down once, in the WAYPOINTS block, and everything
         else asks that list for it. Move a waypoint and its dot moves with it.
         Like the knob below, these sit outside the SVG so they stay round. */
      stops.map(s =>
        '<div class="tm-wpdot' + (s.kind === "wishful" ? ' tm-wishful' : '') +
        '" title="' + s.title + '" style="left:' +
        (s.fraction * 100).toFixed(3) + '%;top:' +
        (graphY(s.metres) / GRAPH_H * 100).toFixed(3) + '%"></div>').join("") +
      // The dot sits outside the SVG. The graph is stretched to fit its box,
      // so a circle drawn inside it would come out as a flat oval; a plain
      // element placed in percentages stays round whatever the size.
      '<div class="tm-knob" id="tm-graphKnob"></div>';
    walkedLine = el("graphWalked");
    cursorLine = el("graphCursor");
    cursorKnob = el("graphKnob");
  } else {
    el("profile").style.display = "none";
    el("boxElevation").style.display = "none";
    el("boxAscent").style.display = "none";
  }
  if (!perMetre) el("boxDistance").style.display = "none";

  /* the closing screen's totals */
  /* ── holding the page still under the reader ────────────────────────────
     THE PROBLEM. On a phone the address bar slides away as soon as you scroll
     down, and slides back when you scroll up. The window gets 60-100px taller
     and shorter as it does. A page whose height is "1250 screenfuls" is
     therefore re-measured every time that happens: the page grows by roughly
     twelve screenfuls' worth in one frame, mid-gesture. Because progress along
     the trail is your scroll position as a SHARE of the page, growing the page
     under you means the same position is suddenly a smaller share — so the
     walk stutters backwards, and the map lurches, exactly at the moment you
     started scrolling. The gap that can appear at the foot of the page is the
     other half of the same thing: for a moment the document is shorter than
     the browser thinks it can scroll to.

     THE FIX. Measure once, in pixels, and stop listening. The height is then
     a fact about the page rather than a function of the window, and the
     address bar can come and go without the ground moving.

     A GENUINE resize still re-measures — turning the phone, dragging a desktop
     window. The two are told apart by size: an address bar is a height change
     of under bigResizePx with the width unchanged; anything else is real. */
  let lockedTo = { w: 0, h: 0 };

  function lockTheScroll() {
    if (!SETTINGS.lockPageHeight) {
      document.documentElement.style.setProperty("--scroll-length", SETTINGS.pageHeight + "vh");
      return;
    }
    const w = window.innerWidth, h = window.innerHeight;
    const widthChanged  = w !== lockedTo.w;
    const heightJumped  = Math.abs(h - lockedTo.h) > SETTINGS.bigResizePx;
    if (!widthChanged && !heightJumped) return;      // just the address bar
    lockedTo = { w: w, h: h };
    document.documentElement.style.setProperty(
      "--scroll-length", Math.round(h * SETTINGS.pageHeight / 100) + "px");
  }
  lockTheScroll();
  nameTheClimb();                 // now that we know which way the trail runs
  el("closingTotal").innerHTML  = perMetre ? (realLength / 1000).toFixed(1) + "<i>" + WORDS.km + "</i>"
                                           : Math.round(routeLength) + "<i>" + WORDS.units + "</i>";
  el("closingAscent").innerHTML = !haveHeights ? "—"
    : (downhillTrail ? signed(path[path.length - 1].metres - path[0].metres)
                     : Math.round(totalClimb)) + "<i>" + WORDS.metres + "</i>";
  el("closingHigh").innerHTML   = haveHeights ? Math.round(highest)    + "<i>" + WORDS.metres + "</i>" : "—";

  /* ── the loop: scroll position in, map position out ──────────────────── */
  let wanted = 0, shown = 0, ticking = false, lastFrame = 0, reading = false;
  /* which stop the address currently names, and the thing that keeps it
     current. Left as a no-op when linking is off. */
  let named = -1, followTheWalk = () => {};

  /* What the last frame worked out, so this frame can skip the parts of the
     drawing that have not moved. See draw(). */
  let lastZoom  = -1;            // the zoom the line weights were sized for
  let graphUpTo = -1;            // the step the elevation line was built up to
  let graphSoFar = "";           // and the line itself, up to that step

  const scrolled = () => {
    const most = document.documentElement.scrollHeight - window.innerHeight;
    return most > 0 ? clamp(window.scrollY / most, 0, 1) : 0;
  };
  const wholeMapZoom = () =>
    Math.min(stageW() / mapW, stageH() / mapH) * SETTINGS.overviewFit;

  /* ---- the five stages of the page, measured in walks -------------------
     Turning the swoops off removes the scrolling they were using, rather than
     leaving a dead stretch of page behind.                                  */
  const swoopIn  = SETTINGS.zoomOutAtStart ? SETTINGS.zoomInOver  : 0;
  const swoopOut = SETTINGS.zoomOutAtEnd   ? SETTINGS.zoomOutOver : 0;

  const walkFrom = SETTINGS.openingHold + swoopIn;   // the first step
  const walkTo   = walkFrom + 1;                     // the last step, 100%
  const pulledOut = walkTo + swoopOut;               // the map is wide again
  const pageSpan  = pulledOut + SETTINGS.closingHold;

  /* draw() is handed the raw scroll position (0 at the top of the page, 1 at
     the bottom) and the milliseconds since the last frame.                  */
  function draw(atPage, sinceLastFrame) {
    // where we are down the page, counted in walks
    const down = atPage * pageSpan;

    // ...and how far along the trail that puts us. Still 0 through the opening
    // hold AND the whole fly-in, and pinned at 1 from the last step onwards,
    // which is what keeps the two swoops out of the walk's way.
    const p = clamp(down - walkFrom, 0, 1);

    // How far pulled out we are, 0 = standing on the trail, 1 = whole map.
    // The fly-in is held wide while the opening screen is up and eases to
    // nothing across its swoop; the pull-back eases in once the trail already
    // reads 100%. With zoomOutAtStart off there is no fly-in at all, so the
    // page opens standing at the first step.
    const flyIn  = SETTINGS.zoomOutAtStart
                 ? 1 - slide(SETTINGS.openingHold, walkFrom, down, SETTINGS.zoomEase) : 0;
    const flyOut = SETTINGS.zoomOutAtEnd
                 ? slide(walkTo, pulledOut, down, SETTINGS.zoomEase) : 0;
    const here = Math.max(flyIn, flyOut);
    const spot = pointAt(p * routeLength);
    const walkZoom = isPhone() ? SETTINGS.zoomWalkingPhone : SETTINGS.zoomWalking;
    const zoom = mixZoom(walkZoom, wholeMapZoom(), here);

    // the point that lands in the middle of the screen — the walker, easing
    // out to the middle of the whole map during the pull-back
    let midX = mix(spot.x, mapW / 2, here);
    let midY = mix(spot.y, mapH / 2, here);
    /* On a phone the card covers the lower half of the screen, so the point
       you are standing on is lifted above centre to stay clear of it. Once the
       map has pulled back out there is no card and no walker — only the whole
       picture — so the lift eases away with the pull-back and the map ends up
       squarely in the middle. */
    const lift = isPhone()
               ? Math.round(stageH() * SETTINGS.raisePointOnPhone * (1 - here)) : 0;

    /* ---- keep the paper under the window --------------------------------
       midX/midY is the map point that lands under the middle of the screen, so
       the visible window in MAP units reaches this far either side of it. Where
       the drawing is bigger than the window, the centre is held far enough in
       from each edge that the window stays on the paper; where it is smaller —
       the pull-back at the finish — there is nothing to clamp to and the map is
       simply centred. The lift makes the two vertical halves unequal, which is
       why they are worked out separately. */
    if (SETTINGS.keepInsideEdges) {
      const halfW  = stageW() / 2 / zoom;
      const above  = (stageH() / 2 - lift) / zoom;
      const below  = (stageH() / 2 + lift) / zoom;
      midX = mapW * zoom >= stageW() ? clamp(midX, halfW, mapW - halfW) : mapW / 2;
      midY = mapH * zoom >= stageH() ? clamp(midY, above, mapH - below)
                                     : mapH / 2 - lift / zoom;
    }

    world.style.transform =
      "translate(" + (stageW() / 2) + "px," + (stageH() / 2 - lift) + "px)" +
      " scale(" + zoom + ") translate(" + (-midX) + "px," + (-midY) + "px)";

    /* Line weights, dash patterns and chip sizes are all "per zoom" — they
       divide by it so they hold their size on screen. During the walk the zoom
       does not change at all, so all of this is the same answer frame after
       frame. Writing it anyway is not free: each write is a style change on an
       SVG element, and the chips are a whole loop of them. So it is done once
       and then only when the zoom has actually moved.                        */
    if (zoom !== lastZoom) {
      lastZoom = zoom;
      el("trailOutline").style.strokeWidth = (SETTINGS.trailWidth + SETTINGS.trailOutlineExtra) / zoom;
      el("trailAhead").style.strokeWidth   = (SETTINGS.trailWidth * SETTINGS.trailAheadWidth) / zoom;
      el("trailWalked").style.strokeWidth  = SETTINGS.trailWidth / zoom;
      el("trailAhead").style.strokeDasharray = (SETTINGS.trailWidth * SETTINGS.trailAheadDot / zoom) +
                                         " " + (SETTINGS.trailWidth * SETTINGS.trailAheadGap / zoom);
      el("trailWalked").style.strokeDasharray = drawLength;
      /* Chips hold their size on screen whatever the zoom — that is the point
         of them while you are walking. Pulled out to the whole map it stops
         being right: a dozen rings drawn for a phone-sized view cover the
         thing they are marking. So they also shrink towards the finish. */
      const hold = "scale(" +
        ((1 / zoom) * (1 - here * SETTINGS.pinShrinkOnPullBack)) + ")";
      for (let i = 0; i < chips.length; i++) chips[i].style.transform = hold;
      walker.style.transform = hold;
    }
    // the walked part is revealed by pulling back a dash the length of the line
    el("trailWalked").style.strokeDashoffset = drawLength * (1 - p);

    walker.style.left = spot.x + "px";
    walker.style.top  = spot.y + "px";
    walker.style.opacity = (1 - here * 0.65).toFixed(2);

    /* The name beside each waypoint holds its size on screen, which is right
       while you are walking and wrong once the whole map is in view: at that
       zoom a dozen full-size labels cover the thing they are labelling. They
       fade out with the pull-back, leaving the route, the rings and the map.
       One custom property on their shared parent does all of them at once. */
    el("labels").style.setProperty("--tag-fade",
      Math.max(0, 1 - here * SETTINGS.tagFadeOnPullBack).toFixed(3));

    /* The readouts. These are text, and text that has not changed still costs
       a parse and a layout if you write it again — at 60 frames a second, for
       four numbers, that adds up. say() writes only when the words differ. */
    if (perMetre) say("valDistance", (p * realLength / 1000).toFixed(2), WORDS.km);
    say("valComplete", String(Math.round(p * 100)), WORDS.percent);

    if (haveHeights) {
      say("valElevation", String(Math.round(spot.metres)), WORDS.metres);
      /* Uphill so far, or — on a trail that ends lower than it starts — the
         net change from the trailhead, which reads as a negative number.
         climbedTo[] is the running total of every uphill metre, worked out once
         when the route was measured; it used to be added up from the start of
         the trail on every single frame. */
      say("valAscent",
          downhillTrail ? signed(spot.metres - path[0].metres)
                        : String(Math.round(climbedTo[spot.index] || 0)),
          WORDS.metres);

      /* The walked part of the elevation graph is the profile up to a whole
         step, plus one short line out to exactly where you are. Only that last
         line changes between frames; the long part changes when the walk
         crosses a step, which happens a few hundred times over the whole page
         rather than sixty times a second. So the long part is remembered and
         only rebuilt when the step it ends on has moved.                     */
      const exact = p * (STEPS - 1), whole = Math.floor(exact);
      if (whole !== graphUpTo) {
        if (whole > graphUpTo && graphUpTo >= 0) {
          // walking forwards: just add the steps that were crossed
          for (let i = graphUpTo + 1; i <= whole; i++)
            graphSoFar += " L" + graphX(i) + " " + graphY(heights[i]);
        } else {
          // scrolled backwards, or the first frame: build it from the start
          graphSoFar = "M0 " + graphY(heights[0]);
          for (let i = 1; i <= whole; i++)
            graphSoFar += " L" + graphX(i) + " " + graphY(heights[i]);
        }
        graphUpTo = whole;
      }
      walkedLine.setAttribute("d",
        graphSoFar + " L" + (exact / (STEPS - 1)) * GRAPH_W + " " + graphY(spot.metres));
      const cx = (exact / (STEPS - 1)) * GRAPH_W;
      cursorLine.setAttribute("x1", cx); cursorLine.setAttribute("x2", cx);
      // the dot is placed in percentages of the graph's box, so it needs the
      // same two numbers turned into fractions of GRAPH_W and GRAPH_H
      cursorKnob.style.left = (cx / GRAPH_W * 100) + "%";
      cursorKnob.style.top  = (graphY(spot.metres) / GRAPH_H * 100) + "%";
    }

    /* ---- waypoint cards -------------------------------------------------
       First, how much of its own stretch of scroll each card is inside. A card
       is due from cardLead before its waypoint until cardVisibleFor later, and
       is worth nothing at all outside that.                                 */
    let arriving = -1;                       // a card the walk has properly reached
    // a phone shows each card for a shorter stretch — see cardVisibleForPhone
    const narrow    = isPhone();
    const staysFor  = narrow ? SETTINGS.cardVisibleForPhone : SETTINGS.cardVisibleFor;
    const arrivesAt = narrow ? SETTINGS.cardLeadPhone       : SETTINGS.cardLead;
    const fadeOver  = narrow ? SETTINGS.cardFadePhone       : SETTINGS.cardFade;
    const byScroll = stops.map((s, i) => {
      const from = s.fraction - arrivesAt;
      const to   = from + staysFor;
      const v = Math.min(ramp(from, from + fadeOver, p),
                         1 - ramp(to - fadeOver, to, p));
      if (v > 0.5) arriving = i;
      return v;
    });

    arrivedAt = arriving;

    /* A CARD HELD OPEN BY A CLICK GIVES WAY ONCE THE WALK REACHES ANOTHER —
       and "another" means another than the one it was standing at when the
       card was opened, not another than the card itself.

       That distinction is the whole of clicking a distant waypoint. Ask for
       the twelfth waypoint's card while standing at the fourth and the walk
       is, on the very next frame, still "arriving at" the fourth — so the old
       test threw the card away in the frame it was asked for, and clicking
       anything but the waypoint under your feet did nothing at all. Now the
       card stays until the walk actually MOVES to a different stop, which is
       the moment the reader has taken over again and cards should go back to
       opening and closing by themselves.

       Only while cards open by themselves, as before: with auto-load off the
       walk reaches nothing, so a card you opened stays until you close it. */
    if (arriving >= 0 && autoLoadOn && arriving !== heldFrom) {
      cardState.forEach((state, i) => { if (i !== arriving) state.held = false; });
      heldFrom = -2;
    }

    /* NOTHING OPENS WHILE THE GRAPH IS BEING DRAGGED. Scrubbing the elevation
       knob runs the whole trail past in a second or two, and cards flashing
       open and shut the whole way is unreadable and looks broken. The map
       moves, the walker moves, the numbers move; the cards wait. */
    if (scrubbing) {
      for (let i = 0; i < byScroll.length; i++) byScroll[i] = 0;
      cardState.forEach(state => { state.held = false; });
      arriving = -1;
    }

    cardsMoving = false;
    cardState.forEach((state, i) => {
      // once the walk has left a card's stretch, forget that it was closed, so
      // scrolling back past it shows it again
      if (byScroll[i] === 0 && !state.held) state.closed = false;

      // ease the manual fade towards where it should be, in real time so it
      // takes cardCloseMs whatever the frame rate
      const wants = state.closed ? 0 : 1;
      if (state.shownness !== wants) {
        const step = Math.max(1, sinceLastFrame) / Math.max(1, SETTINGS.cardCloseMs);
        state.shownness = wants > state.shownness
          ? Math.min(wants, state.shownness + step)
          : Math.max(wants, state.shownness - step);
        if (state.shownness !== wants) cardsMoving = true;
      }
    });

    // held cards ignore the scroll; everything else follows it. The two fades
    // multiply, so a card closed mid-stretch fades out from wherever it was.
    // A stop on a switched-off layer is worth nothing however close the walk
     // comes to it, so it can never be the front card and never fades in.
    /* The first card's entrance. Every other card is faded up by the walk
       arriving at its waypoint; the first waypoint IS the trailhead, so the
       walk never arrives at it and byScroll has already been 1 since the top
       of the page. Left alone it would not enter at all — it would simply be
       revealed, sitting there, as the panel over it moved away.

       So it is given the same entrance as any other card, over the same short
       stretch of scroll (cardFade), ending exactly where the panel's darkening
       does. Because it multiplies into the card's own value rather than into
       the layer holding it, the rise that goes with the fade — see the nudge
       below, which is worked out from that same value — comes along with it.
       Past the opening this is 1 and changes nothing. */
    const veilGoneAt = SETTINGS.openingHold * SETTINGS.openingLeavesBy;
    const entrance = SETTINGS.firstCardEnters
                   ? ramp(veilGoneAt - fadeOver, veilGoneAt, down) : 1;

    /* WITH AUTO-LOAD OFF, byScroll is worth nothing: a card is shown only if
       something opened it. That is the whole of the switch — one term in one
       expression — because everything else about a card, its fade, its place
       in the column, its closing, was already written in terms of "how much
       should this be showing", and this only ever answers that question. */
    const shownAt = cardState.map((state, i) =>
      onALiveLayer(stops[i])
        ? (state.held ? 1 : (autoLoadOn ? byScroll[i] : 0)) * state.shownness * entrance
        : 0);

    // only one card is ever on screen: a held one wins, else the strongest
    let front = -1, strongest = 0;
    cardState.forEach((state, i) => { if (state.held && shownAt[i] > 0) front = i; });
    if (front < 0) shownAt.forEach((v, i) => { if (v > strongest) { strongest = v; front = i; } });

    /* ── THE SHOVE ─────────────────────────────────────────────────────────
       Wound on in real time, so it takes cardSwapMs whatever the frame rate,
       and it keeps the loop awake while it runs. `ease` is the same in-and-out
       curve the scroll uses: it sets off and arrives without a jolt, which is
       what makes a shove read as weight rather than as a slide. */
    if (swapping) {
      swapping.at = Math.min(1, swapping.at +
                    Math.max(1, sinceLastFrame) / Math.max(1, SETTINGS.cardSwapMs));
      if (swapping.at >= 1) swapping = null; else cardsMoving = true;
    }
    const shoveAt = swapping
      ? (swapping.at < 0.5 ? 2 * swapping.at * swapping.at
                           : 1 - Math.pow(-2 * swapping.at + 2, 2) / 2)
      : 1;

    cards.forEach((card, i) => {
      let v = i === front ? shownAt[i] : 0;
      let shove = 0, shrink = 1;
      if (swapping) {
        if (i === swapping.out) {
          /* IT IS STILL DRAWN WHILE IT LEAVES. Without this line the outgoing
             card's opacity goes to nothing the instant `front` changes, and
             there is no shove to see because there is nothing left to shove. */
          v = Math.max(v, 1 - shoveAt);
          shove = -shoveAt * SETTINGS.cardShove;
          shrink = 1 - (1 - SETTINGS.cardShoveBack) * shoveAt;
        } else if (i === swapping.in) {
          shove = (1 - shoveAt) * SETTINGS.cardShove;
        }
      }
      card.style.setProperty("--card-shove", shove.toFixed(1));
      card.style.setProperty("--card-shrink", shrink.toFixed(4));
      card.style.opacity = v.toFixed(3);
      // an invisible card must not swallow clicks meant for the map
      card.style.pointerEvents = v > SETTINGS.cardLiveAbove ? "auto" : "none";
      // and the one being shoved out takes no clicks at all, whatever its fade
      if (swapping && i === swapping.out) card.style.pointerEvents = "none";
      // How far the card still has to rise, in pixels, as a plain number. The
      // stylesheet decides what to do with it — where the card is anchored in
      // its column, and how much extra lean to add — so the engine no longer
      // needs to know whether this is a phone.
      const nudge = (1 - v) * SETTINGS.cardRiseBy;
      card.style.setProperty("--card-nudge", nudge.toFixed(2));
    });

    /* THE WAYPOINT WHOSE CARD IS UP IS MARKED ON THE MAP. Now that clicking a
       waypoint is a toggle — and that any waypoint can be opened from
       anywhere, however far the walk has got — there has to be something on
       the map saying which one you are looking at. Otherwise the second click
       that closes a card is a click with no visible target. */
    stops.forEach((s, i) => {
      if (s.chip) s.chip.classList.toggle("is-open", i === front && shownAt[i] > 0.5);
    });

    // a video only runs while its own card is the one on screen, so start or
    // stop it whenever that changes
    const showingNow = front >= 0 && shownAt[front] > SETTINGS.cardLiveAbove;
    if (front !== frontCard || showingNow !== frontShowing) {
      const cameUp = front !== frontCard;
      frontCard = front;
      frontShowing = showingNow;
      playTheRightVideo();
    }

    /* ── THE COIN AND THE DIAL GO AGAIN, ONCE THE CARD IS ACTUALLY UP ───────
       They cannot be left to an observer here: every card on this page is
       inside the viewport the whole time and simply faded to nothing, so "came
       into view" happens once, at load, while the card is invisible.

       BUT NOT AT THE MOMENT THE CARD IS CHOSEN EITHER, which is what this used
       to do and is why the dial has been reported as not moving three times.
       Choosing a card and the card being on screen are half a second apart: it
       fades in, and `shownness` is what does the fading. Asking for the
       animations at the moment of choosing meant the needle did its whole
       swing — bottom of the scale, up to its reading, one overshoot — behind a
       transparent card, and by the time there was anything to look at it had a
       fifth of its travel left and was moving about two degrees. Which looks
       exactly like a needle that does not move.

       The coin survived it because its turn is two full revolutions and its
       last fifth is still a coin spinning. The dial did not.

       So the test is on how far the card has actually FADED IN, not on which
       card is chosen: `shownAt[front]`, the same number the stylesheet is
       being given. One play per card per appearance — iconsPlayedFor is what
       makes it once — and it is cleared as soon as a different card takes over
       or the cards go, so opening the same one again plays it again. */
    if (front !== iconsPlayedFor) {
      if (front >= 0 && shownAt[front] >= SETTINGS.cardReadyAt) {
        iconsPlayedFor = front;
        if (window.HappyTrailsIconLife) {
          window.HappyTrailsIconLife.replay(cards[front]);
        }
      } else if (front < 0) {
        iconsPlayedFor = -1;
      }
    }

    /* ---- the opening and closing screens --------------------------------
       Both are driven by `down`, the position in walks, not by trail progress:
       the opening fades within its hold, well before the first step; the
       closing waits until the trail has run out AND the map has finished
       pulling back out to full width.                                       */
    /* The opening screen. `gone` runs 0 to 1 across the stretch of scroll it
       is given: 0 while it is squarely in front of you, 1 once it has left.
       What it DOES with that is the choice below — travel up and off the top,
       which is the page showing you what scrolling is for, or the old plain
       dissolve. Either way the number is the same, so everything downstream
       (the interface clearing, the walk not starting yet) is unchanged. */
    const gone = ramp(0, SETTINGS.openingHold * SETTINGS.openingLeavesBy, down);
    const openFade = 1 - gone;
    // How far into the finish we are. This drives the clearing away of the
    // cards and the readouts whether or not there is a closing screen, so the
    // pull-back always ends on the map by itself.
    const endFade  = ramp(pulledOut,
                          pulledOut + SETTINGS.closingHold * SETTINGS.closingFadeShare,
                          down);
    const closeFade = SETTINGS.showClosingScreen ? endFade : 0;

    // The map can soften behind either screen and sharpen as it clears. Both
    // are off by default — the opening text has its own box to sit in, and the
    // finish is meant to be seen clean — and the filter is only switched on
    // when there is actually something to blur, because a full-screen filter
    // costs a rendering pass on every single frame it is live.
    const softness = openFade  * SETTINGS.blurAtStart +
                     closeFade * SETTINGS.blurAtEnd;
    const stage = el("stage");
    if (softness > 0.05) {
      stage.style.setProperty("--map-blur", softness.toFixed(2) + "px");
      stage.classList.add("tm-blurred");
    } else if (stage.classList.contains("tm-blurred")) {
      stage.classList.remove("tm-blurred");
    }

    const opening = el("opening");
    if (SETTINGS.openingScrollsAway) {
      /* It rises by openingTravel screenfuls, carrying its own darkening with
         it, so the map is uncovered from the bottom up as it goes. The fade is
         partial and deliberate: a panel that stayed fully solid would read as
         an object striking the top edge of the window. */
      opening.style.transform =
        "translate3d(0," + (-gone * SETTINGS.openingTravel * 100).toFixed(2) + "%,0)";
      opening.style.opacity = (1 - gone * SETTINGS.openingFadesToo).toFixed(3);
    } else {
      opening.style.transform = "";
      opening.style.opacity = openFade.toFixed(3);
    }
    // out of the way entirely once it has gone, whichever way it left — and
    // its compositing layer is handed back at the same moment, so the rest of
    // the walk is not carrying a full-screen layer that will never be drawn
    const done = gone > 0.999;
    opening.style.visibility = done ? "hidden" : "visible";
    opening.style.willChange = done ? "auto" : "transform, opacity";
    el("closing").style.opacity = closeFade.toFixed(3);
    el("closing").style.visibility = closeFade < 0.01 ? "hidden" : "visible";
    /* The interface arrives on the panel's way out, not on the walk's way in.
       The panel rises, the map is uncovered behind it, and the first card
       fades up through the back half of that movement so that it is there as
       the darkening finishes leaving.

       It has to hang off `gone` — the panel's own progress — and not off the
       walk starting. The first waypoint is AT the trailhead, so its card's
       stretch of scroll is over within a moment of the walk beginning; holding
       the interface back until then does not make the first card arrive later,
       it means the card's window has closed before the layer holding it is
       ever switched on, and it is never seen at all. */
    const started = ramp(SETTINGS.cardsArriveWith, 1, gone);
    /* The readouts follow the panel out. The card COLUMN does not: fading the
       whole column would flatten the first card's own entrance into a slow
       dissolve and swallow its rise. The cards fade themselves — see
       `entrance` above — so the column only has to clear away at the finish. */
    el("cards").style.opacity = (1 - endFade).toFixed(3);
    const uiFade = (started * (1 - endFade)).toFixed(3);
    el("readouts").style.opacity = uiFade;
    /* THE WHOLE ROW ARRIVES WITH THE BAND, tour button and all.
       It used to arrive in two halves: the arrows faded in with the readouts
       and the elevation graph, and the tour button did not — it was live from
       the first frame, on the argument that a tour is most use to somebody who
       has just arrived and has not begun.

       The argument was sound and the result was wrong. What it produced was a
       single round button, and later a count beside it, standing on their own
       in the corner of an opening screen with nothing else around them yet —
       controls for a band that had not appeared. A control that arrives before
       the thing it controls does not read as an early offer; it reads as
       something that has not finished loading.

       So the row arrives as one object, with the graph it sits above. And it
       is the ROW that is handed the pointer, not each button: the things
       inside it inherit that, which is what lets the count, the pause button
       and the tour's note come along without each needing a line here. */
    const stepper = el("stepper");
    if (stepper) {
      stepper.style.opacity = uiFade;
      stepper.style.pointerEvents = +uiFade > 0.5 ? "auto" : "none";
    }
    /* The shading over the map exists to make the readouts legible against it.
       With the readouts gone at the finish it is just a stain across a picture
       that is meant to be seen plainly, so it goes with them. */
    el("shade").style.opacity = (1 - endFade).toFixed(3);
    /* The rail goes with the opening screen but comes back for the finish:
       there is nothing to look at a legend for while the title is up, but the
       whole map at the end is exactly when you might want one. */
    const rail = el("rail");
    if (rail) {
      rail.style.opacity = (1 - openFade).toFixed(3);
      rail.style.pointerEvents = openFade > 0.5 ? "none" : "";
    }
  }

  function frame(now) {
    const gap = Math.min(64, now - lastFrame || 16.7);
    lastFrame = now;
    const left = wanted - shown;
    // ease towards the target at the same rate whatever the frame rate
    if (Math.abs(left) < 0.00004 || stillWanted) shown = wanted;
    else shown += left * (1 - Math.pow(1 - SETTINGS.followLag, gap / 16.7));
    draw(shown, gap);
    followTheWalk();
    // keep going while the map is still catching up OR a card is mid-fade
    if (shown !== wanted || cardsMoving) requestAnimationFrame(frame);
    else ticking = false;
  }

  /* start the loop if it is not already running — used by the card buttons,
     which need a frame or two even though nothing has been scrolled */
  function wake() {
    if (!ticking) { ticking = true; lastFrame = 0; requestAnimationFrame(frame); }
  }

  function nudge() {
    if (reading) return;
    // an expanded card holds the walk where it is: the page is not supposed to
    // move, and anything that does slip past the three refusals above is put
    // back a frame later, so following it here would only make the map twitch
    if (bigOn()) return;
    wanted = scrolled();
    wake();
  }

  addEventListener("scroll", nudge, { passive: true });
  /* Order matters: the page's own height is settled BEFORE anything re-reads
     the scroll position against it, so nothing ever measures against a length
     that is about to change. */
  addEventListener("resize", () => { lockTheScroll(); nudge(); });
  wanted = shown = scrolled();
  draw(shown, 0);
  nudge();

  /* The cards have to be laid out before the rail can be placed against them,
     so this happens after the first draw and again whenever the window changes
     shape — including a phone being turned on its side, which changes both the
     card heights and whether any of this applies at all. */
  placeRail();
  addEventListener("resize", placeRail);

  /* ── the stepper's behaviour ────────────────────────────────────────────
     Which stops it can reach depends on the Wishful thinking switch: a stop
     that is not drawn on the map should not be somewhere an arrow can take
     you. liveStops() is therefore asked fresh each time rather than cached,
     because the switch can be thrown at any moment. */
  function liveStops() {
    return stops.map((s, i) => i).filter(i => onALiveLayer(stops[i]));
  }

  /* Where the page has to be scrolled for a given stop to be the one you are
     standing at. The walk occupies its own stretch of the page — see the five
     stages — so a stop's fraction has to be placed inside that stretch, not
     against the whole document. */
  function pageAtStop(i) {
    const at = (walkFrom + stops[i].fraction) / pageSpan;
    return Math.round(at * (document.documentElement.scrollHeight - window.innerHeight));
  }

  /* THE SAME SUM AS pageAtStop, ASKED WITH A FRACTION INSTEAD OF A STOP.
     Dragging the elevation graph gives a position along the trail and wants
     the page put there; the graph knows nothing about waypoints, and should
     not have to. */
  function pageAtFraction(f) {
    const at = (walkFrom + clamp(f, 0, 1)) / pageSpan;
    return Math.round(at * (document.documentElement.scrollHeight - window.innerHeight));
  }

  function goToFraction(f) {
    window.scrollTo(0, pageAtFraction(f));
  }

  /* The stop the walk is currently at or has most recently passed. */
  function nearestStop() {
    const p = clamp(shown * pageSpan - walkFrom, 0, 1);
    const live = liveStops();
    let best = -1, gap = Infinity;
    live.forEach(i => {
      const d = Math.abs(stops[i].fraction - p);
      if (d < gap) { gap = d; best = i; }
    });
    return { at: best, live: live };
  }

  function stepTo(direction) {
    const { at, live } = nearestStop();
    const here = live.indexOf(at);
    const want = live[here + direction];
    if (want === undefined) return;
    /* the same journey a link makes, so there is one piece of code that means
       "go and stand at this stop" — it scrolls, opens the card, turns the
       wishful layer on if the stop needs it, and claims the address */
    goToStop(want, SETTINGS.stepperSmooth);
  }

  /* An arrow with nothing beyond it is disabled rather than hidden: the pair
     keeps its shape, and a control that greys out says "you are at the end"
     where one that vanishes just looks broken. */
  function refreshStepper() {
    const back = el("stepBack"), on = el("stepOn");
    if (!back || !on) return;
    const { at, live } = nearestStop();
    const here = live.indexOf(at);
    back.disabled = here <= 0;
    on.disabled   = here < 0 || here >= live.length - 1;

    /* THE COUNT, ON THE SAME FIGURES. It is written here rather than anywhere
       else precisely so that it cannot disagree with the arrows: the same
       `here` that decides whether the back arrow is greyed out is the number
       shown. A trail with one live stop gets nothing — "1 / 1" is not
       information — and the words come from WORDS so a page can change them. */
    const count = el("stepCount");
    if (!count) return;
    if (here < 0 || live.length < 2) { count.hidden = true; return; }
    count.hidden = false;
    const put = t => String(t).replace("{n}", here + 1).replace("{of}", live.length);
    count.textContent = put(WORDS.stepAt || "{n} / {of}");
    count.setAttribute("aria-label", put(WORDS.stepAtLabel || "Waypoint {n} of {of}"));
  }

  if (SETTINGS.showStepper) {
    const back = el("stepBack"), on = el("stepOn");
    if (back) back.addEventListener("click", () => { byHand(); stepTo(-1); });
    if (on)   on.addEventListener("click", () => { byHand(); stepTo(1); });
    refreshStepper();
    addEventListener("scroll", refreshStepper, { passive: true });
    stepperNeedsRefresh = refreshStepper;
  }

  /* ── A LINK TO ONE STOP ──────────────────────────────────────────────────
     Until now a trail had exactly one address, and there was no way to send
     anyone to a particular place on it — you could only say "open the Don and
     scroll to about a fifth of the way down". Every stop now has a name of its
     own in the URL:

         don.html#half-mile-bridge

     Arriving with one of those scrolls straight to that stop and opens its
     card. Walking or stepping past a stop quietly rewrites the address to
     match, so the link to wherever you are is always in the address bar and
     always copyable — with replaceState, not pushState, because a walk down a
     trail should leave ONE entry in the back button, not one per waypoint.

     A WISHFUL STOP TURNS ITS LAYER ON. A link to something that is not built
     is exactly the link most worth sending, and it would otherwise land on a
     page where that stop is switched off — the reader would arrive at an empty
     stretch of trail with no idea what they had been sent to look at. */
  function stopNamed(name) {
    const want = String(name || "").replace(/^#/, "").toLowerCase();
    if (!want) return -1;
    return stops.findIndex(s => s.slug === want);
  }

  function nameInAddress(i) {
    if (!SETTINGS.linkToStops || i < 0 || !stops[i]) return;
    const want = "#" + stops[i].slug;
    if (location.hash === want) return;
    try { history.replaceState(null, "", want); } catch (e) { /* file:// says no */ }
  }

  /* ── HOW MANY LIVE WAYPOINTS LIE BETWEEN HERE AND THERE ──────────────────
     Asked before a journey, to decide whether the cards need hushing for it.
     Stepping to the neighbour passes nothing, so nothing is hushed and its
     card opens in the same instant it always did; clicking something six
     waypoints away passes five, and those five are what the hush is for. */
  function stopsPassed(i) {
    const here = nearestStop().at;
    if (here < 0 || here === i || !stops[i] || !stops[here]) return 0;
    const lo = Math.min(stops[here].fraction, stops[i].fraction);
    const hi = Math.max(stops[here].fraction, stops[i].fraction);
    return liveStops().filter(k => k !== here && k !== i &&
                              stops[k].fraction > lo && stops[k].fraction < hi).length;
  }

  /* ── HUSHING THE CARDS FOR THE LENGTH OF A JOURNEY ───────────────────────
     The same `scrubbing` the elevation graph raises while it is being dragged,
     which the drawing loop already knows means "the walk is moving, do not
     open anything". It is put back down when the scroll arrives — or when it
     plainly is not going to, which is the part that matters: a smooth scroll
     can be cut short by anybody who touches the wheel, and it says nothing at
     all when that happens. So the arrival is watched for rather than waited
     out, in three ways at once — near enough to the target, or not having
     moved for a few checks, or simply having taken too long. Whichever comes
     first, the hush ends and the card that was asked for opens. */
  let travelWatch = 0;
  function travelTo(target, arrive) {
    scrubbing = true;
    clearTimeout(travelWatch);
    const began = performance.now();
    let was = window.scrollY, still = 0, everMoved = false;
    const look = () => {
      const now = window.scrollY;
      const age = performance.now() - began;
      if (now !== was) { everMoved = true; still = 0; } else { still++; }
      was = now;
      const there = Math.abs(now - target) <= SETTINGS.arrivedWithin;
      /* "IT HAS STOPPED MOVING" IS ONLY MEANINGFUL ONCE IT HAS MOVED. A smooth
         scroll does not set off in the frame it is asked to, and on a busy
         machine it can be a good deal later than that — so a stall test that
         starts counting immediately reads "not moving yet" as "arrived",
         drops the hush before the journey has begun, and the whole flicker
         this exists to prevent happens anyway. Which is exactly what it did,
         intermittently, which is the worst way to find out. The timeout below
         is what covers a journey that genuinely never starts. */
      const stopped = everMoved && age > SETTINGS.travelLeast &&
                      still >= SETTINGS.travelStill;
      if (there || stopped || age > SETTINGS.travelMost) {
        scrubbing = false;
        wake();
        if (arrive) arrive();
        return;
      }
      travelWatch = setTimeout(look, SETTINGS.travelCheck);
    };
    travelWatch = setTimeout(look, SETTINGS.travelCheck);
  }

  function goToStop(i, smooth) {
    if (i < 0 || !stops[i]) return false;
    if (stops[i].kind === "wishful" && !wishfulOn) {
      wishfulOn = true;
      applyLayers();
      if (buildPanels) buildPanels();     // the switch redraws as on
    }
    named = i;                    // claim it, so the loop agrees rather than fights
    nameInAddress(i);
    const target = pageAtStop(i);
    const far = smooth && SETTINGS.hushWhilePassing && stopsPassed(i) > 0;
    window.scrollTo({ top: target, behavior: smooth ? "smooth" : "auto" });
    /* THE CARD OPENS ON ARRIVAL, NOT ON DEPARTURE, when there is anything to
       travel past. It cannot open before: the hush clears every held card on
       every frame it is up, so a card opened into it would be thrown away in
       the next frame. */
    if (far) travelTo(target, () => openCard(i));
    else openCard(i);
    return true;
  }

  if (SETTINGS.linkToStops) {
    /* THE ADDRESS WE ARRIVED ON, read now and kept.

       Not read later, when the jump happens. The jump has to wait for the page
       to settle — its height is measured from the artwork and pageAtStop() is a
       fraction of that height — and during that wait the drawing loop is
       already running, already deciding that the nearest stop to the top of the
       page is the first one, and already rewriting the address to say so. Ask
       for location.hash after that and you get the answer the page just made
       up, so every link landed on stop one. */
    const arrivedOn = location.hash;
    /* and nothing rewrites the address until the arrival has happened */
    let settled = !arrivedOn;

    /* ARRIVING FROM THE WISHFUL THINKING PAGE.
       That page is a list of proposals, and each one links to the waypoint it
       belongs to. Somebody who followed one of those links came to look at
       that single idea, not to walk the trail — so it opens in the big view,
       already showing the picture at size, rather than as a small card at the
       side of a map they did not ask for. bigOnArrival decides which links
       count: "wishful" is the one journey there is, but "true" opens every
       deep link expanded and "false" turns it off. A window too small for the
       big view simply gets the ordinary card — see roomToGrow.

       AND A LINK MAY ASK FOR IT OUTRIGHT, with ?big=1 on the address. The
       main map's featured waypoints do: their cards carry an "Open card on
       trail page" button, and somebody who presses that has asked to see this
       one waypoint properly, exactly as the Wishful thinking page's links
       mean. Putting it in the address rather than in a setting keeps it a
       property of the JOURNEY — a link somebody shares of the trail itself
       still opens the trail. */
    const askedForBig = /(?:^|[?&])big=1(?:&|$)/.test(location.search.slice(1));

    const shouldArriveBig = i =>
      SETTINGS.bigOnArrival === true || askedForBig ||
      (SETTINGS.bigOnArrival === "wishful" && stops[i] && stops[i].kind === "wishful");

    const arriveAt = () => {
      const i = stopNamed(arrivedOn);
      requestAnimationFrame(() => {
        if (i >= 0) {
          goToStop(i, false);
          if (shouldArriveBig(i)) setBig(true, i, true);
          /* STANDING THERE, NOT TRAVELLING THERE. The map eases towards
             wherever the scroll says, a frame at a time — which is what makes
             the walk a walk, and which here would mean watching the trail
             hurry from its beginning to the waypoint that was asked for. So
             the eased position is set equal to the asked-for one and the map
             is drawn once: the page opens already standing at the waypoint. */
          shown = wanted;
          draw(shown, 0);
        }
        settled = true;
        /* and now there is something worth looking at, so the cover comes off.
           A frame later, so that what is uncovered is this drawing and not the
           one before it. */
        requestAnimationFrame(uncover);
      });
    };
    if (arrivedOn) setTimeout(arriveAt, SETTINGS.linkArriveAfterMs);
    // and if someone edits the address, or follows a link to this same page
    addEventListener("hashchange", () => {
      const i = stopNamed(location.hash);
      if (i < 0) return;
      const big = shouldArriveBig(i);
      /* A jump rather than a glide when the card is about to fill the screen:
         a smooth scroll is still travelling when the view locks, and the lock
         would put the page back where the scroll started. */
      goToStop(i, !big);
      if (big) setBig(true, i, true);
    });
    /* Walking past a stop names it in the address. This is driven from the
       drawing loop rather than from the scroll event, and the difference
       matters: `shown` is the position the map is DRAWN at, and it eases
       towards the scroll rather than snapping to it, so a scroll event fires
       with a reading that is still one frame behind. Wired to the event, a
       deliberate jump to a stop was immediately overwritten by the stale
       reading of where the page had been a moment earlier — the card was
       right and the address in the bar was wrong. */
    /* NOT ON EVERY FRAME. nearestStop() builds two arrays each time it is
       asked — the live stops, and the distances to them — and doing that sixty
       times a second to keep a URL up to date cost about five frames a second
       on a phone, in garbage collection, for a value nobody can read that
       fast. Four times a second is faster than anyone scrolls past a
       waypoint. */
    let nextLook = 0;
    followTheWalk = () => {
      if (!settled) return;
      const now = Date.now();
      if (now < nextLook) return;
      nextLook = now + SETTINGS.linkNameEveryMs;
      const { at } = nearestStop();
      if (at >= 0 && at !== named) { named = at; nameInAddress(at); }
    };
  }
  /* A late-arriving web font changes how many lines the text takes and so how
     tall the cards are. Measure again once the fonts have settled. */
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(placeRail);

  /* Flatten the artwork for phones — after the first frame has been drawn and
     the page is scrollable, never before it. A window that starts wide and is
     later narrowed gets the same treatment; flattenArtwork() does nothing the
     second time it is called, so this is safe to fire on every resize. */
  setTimeout(flattenArtwork, SETTINGS.flattenAfterMs);
  addEventListener("resize", flattenArtwork);

  // handy from the browser console: TRAIL.path, TRAIL.stops, TRAIL.where()
  window.TRAIL = {
    version: SETTINGS.version, path, stops, SETTINGS, WORDS,
    length: routeLength, climb: totalClimb, highest, haveHeights,
    size: { width: mapW, height: mapH },
    // where() is progress along the trail, 0 to 1; scrollAt() is raw page scroll
    where: () => clamp(shown * pageSpan - walkFrom, 0, 1),
    scrollAt: () => shown,
    stages: { pageSpan, walkFrom, walkTo, pulledOut },
    cardState, openCard, closeCard, draw,
    // linking: TRAIL.slugs() lists what this trail's stops are called in a URL
    slugs: () => stops.map(s => s.slug), goToStop, stopNamed,

    /* ── AND WHAT THE TWO COMPANION FILES ASK FOR ────────────────────────
       autoplay.js and trail-graph.js are separate files on purpose — neither
       is needed to read a trail, and neither should be able to break one — so
       everything they need comes through here rather than through a private
       arrangement. Nothing below is new behaviour; it is the engine's own
       working, named. */
    deck,                                  // the cards, as waypoint-card.js made them
    closeAllCards, tapCard,
    /* THE TOUR SWITCHES AUTO-LOAD ON. With it off the walk opens nothing, so
       the tour would scroll the whole trail past a blank map — it would look
       broken and it would BE useless. It is a switch on the Layers panel, so
       the panel is redrawn to agree with itself. */
    autoLoad: on => {
      if (autoLoadOn === !!on) return;
      autoLoadOn = !!on;
      if (!autoLoadOn) cardState.forEach(st => { st.held = false; st.closed = true; });
      applyLayers(); buildPanels(); wake();
    },
    isAutoLoad: () => autoLoadOn,
    closePanels: () => { if (openPanel) showPanel(openPanel); },
    goToFraction, pageAtFraction, pageAtStop,
    liveStops, nearestStop,
    onALiveLayer: s => onALiveLayer(s),
    // true while the graph is being dragged: cards stay shut, the map still moves
    /* SOMEBODY HAS TAKEN THE WHEEL. Dragging the graph is the clearest
       statement there is that a reader wants to go somewhere themselves, so
       the engine says so out loud — and the tour, which has no idea the graph
       exists, stops on hearing it. Anything else that ever takes hold of the
       walk should say the same thing and get the same result for free. */
    scrubbing: on => { scrubbing = !!on; if (scrubbing) byHand(); wake(); },
    byHand,
    isScrubbing: () => scrubbing,
    front: () => frontCard,
    onAMeteredLine,
    /* HOW HIGH THE TRAIL IS AT A GIVEN FRACTION ALONG IT, and how many real
       metres one map unit is. Between them the graph can work out a gradient
       without the engine having to know what a gradient is. */
    metresAt: f => pointAt(clamp(f, 0, 1) * routeLength).metres,
    perMetre,
    wake
  };

  /* ── A CLICK ON THE MAP PUTS THINGS AWAY ────────────────────────────────
     The map is the page, and clicking the page you are reading is the oldest
     way there is of saying "I have finished with that". So a click on empty
     map closes an open waypoint card and shuts the legend or layers panel.

     ON EMPTY MAP. Everything that means something — a waypoint, a crossing
     link, a card, the rail, the panel itself — stops the click before it gets
     here, either by being inside one of those or by its own handler. The test
     is deliberately written that way round: name the things that are NOT the
     map, rather than trying to name the map. */
  const NOT_THE_MAP = ".tm-card, .tm-label, #tm-rail, #tm-panel, #tm-stepper," +
                      " #tm-readouts, #tm-reader, .tm-cross, .tm-tourNote";
  el("stage").addEventListener("click", e => {
    if (e.target.closest && e.target.closest(NOT_THE_MAP)) return;
    if (bigOn()) return;             // the veil behind an expanded card owns this
    byHand();
    let did = false;
    if (openPanel) { showPanel(openPanel); did = true; }
    if (frontCard >= 0 && !cardState[frontCard].closed) { closeAllCards(); did = true; }
    if (did) nudge();
  });

  /* THE PAGE IS READY, AND SAYS SO. autoplay.js and trail-graph.js are built
     on things that do not exist until the artwork has loaded and the waypoints
     have been placed — the cards, the graph's dots, window.TRAIL itself. Both
     wait for this rather than guessing at a moment. */
  document.dispatchEvent(new CustomEvent("trail:ready", { detail: window.TRAIL }));

  /* ── the coordinate reader (optional; press E) ───────────────────────── */
  if (!SETTINGS.coordinateReader) return;

  let marks = [];
  const panel = el("reader");

  const mapPointOf = event => {
    const box = world.getBoundingClientRect();
    const zoom = box.width / mapW;
    return { x: Math.round((event.clientX - box.left) / zoom),
             y: Math.round((event.clientY - box.top) / zoom) };
  };

  function drawMarks() {
    let layer = el("readerMarks");
    if (!layer) {
      layer = document.createElementNS(SVG_NS, "svg");
      layer.id = "tm-readerMarks";
      layer.setAttribute("viewBox", "0 0 " + mapW + " " + mapH);
      Object.assign(layer.style, { position: "absolute", top: 0, left: 0,
        width: mapW + "px", height: mapH + "px", overflow: "visible" });
      world.appendChild(layer);
    }
    const zoom = world.getBoundingClientRect().width / mapW;
    layer.innerHTML = marks.map(m =>
      '<circle cx="' + m.x + '" cy="' + m.y + '" r="' + (6 / zoom) +
      '" fill="#0aa" stroke="#fff" stroke-width="' + (2 / zoom) + '"/>').join("");
    el("readerOut").value = marks.length
      ? marks.map(m => "at: [" + m.x + ", " + m.y + "],").join("\n")
      : "Click the map to read a position off it.";
  }

  function openReader(open) {
    reading = open;
    panel.classList.toggle("tm-open", open);
    document.body.classList.toggle("tm-reading", open);
    document.body.style.overflow = open ? "hidden" : "";
    if (open) {
      const zoom = wholeMapZoom();
      world.style.transform =
        "translate(" + (stageW() / 2) + "px," + (stageH() / 2) + "px)" +
        " scale(" + zoom + ") translate(" + (-mapW / 2) + "px," + (-mapH / 2) + "px)";
      drawMarks();
    } else {
      const layer = el("readerMarks");
      if (layer) layer.remove();
      nudge();
    }
  }

  panel.addEventListener("click", e => {
    if (e.target.closest("#tm-readerPanel")) return;
    marks.push(mapPointOf(e));
    drawMarks();
  });
  panel.addEventListener("mousemove", e => {
    if (e.target.closest("#tm-readerPanel")) return;
    const p = mapPointOf(e);
    el("coords").textContent = "x: " + p.x + "   y: " + p.y;
  });
  // there is no button for the reader any more — the E key is the only way in
  el("clearButton").addEventListener("click", () => { marks = []; drawMarks(); });
  el("copyButton").addEventListener("click", () => {
    const box = el("readerOut");
    box.removeAttribute("readonly");
    box.select();
    try { document.execCommand("copy"); } catch (e) {}
    if (navigator.clipboard) navigator.clipboard.writeText(box.value).catch(() => {});
    box.setAttribute("readonly", "");
    el("copyButton").textContent = "Copied";
    setTimeout(() => { el("copyButton").textContent = "Copy"; }, 1200);
  });
  addEventListener("keydown", e => {
    if (e.target.tagName === "TEXTAREA" && e.key !== "Escape") return;
    const key = e.key.toLowerCase();
    if (key === "e") openReader(!reading);
    else if (!reading) return;
    else if (e.key === "Escape") openReader(false);
    else if (key === "z") { marks.pop(); drawMarks(); }
    else if (key === "c") { marks = []; drawMarks(); }
  });

  /* If there was no waypoint to find — the address names nothing, or this
     trail does not give its stops addresses at all — then nothing is going to
     take the cover down later, and the page is already showing what it means
     to show. */
  if (!SETTINGS.linkToStops || location.hash.length < 2) uncover();
}

/* ── go ────────────────────────────────────────────────────────────────── */
function begin() {
  writeWords();
  buildStepper();
  loadArtwork(start);
}
/* The artwork template sits at the bottom of the trail page, so nothing can
   start until the page has been read to the end. The interface is written
   first, then the trail is built on top of it. */
function startEverything() {
  buildThePage();
  begin();
}
if (document.readyState === "loading") addEventListener("DOMContentLoaded", startEverything);
else startEverything();

})();
