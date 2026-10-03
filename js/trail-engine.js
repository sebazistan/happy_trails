/* ═══════════════════════════════════════════════════════════════════════════
   TRAIL ENGINE — shared by every trail page on the site
   version 7.0

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
     4. <script src="js/trail-engine.js"></script>

   The page supplies no markup of its own. The interface — the bar, the map
   stage, the card column, the readouts, the panels — is written by this file,
   from ONE place, so all the trails cannot drift apart from one another.

   TO CHANGE A TRAIL, edit its own page. To change how trails WORK, edit this.
   Colours, sizes and fonts are in happy-trails.css, shared the same way.
   ═══════════════════════════════════════════════════════════════════════════ */

(function () {
  "use strict";

/* Everything this trail is, handed over by its own page. A page that forgets
   to set it is told so plainly instead of failing deep in the engine. */
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
   Every setting a trail page can have, with what it means and its default.
   A trail page lists only what is different about it: set something in a page
   and it wins, leave it out and this applies. To change what every trail does
   by default, including ones not built yet, change the value here.
   ═══════════════════════════════════════════════════════════════════════════ */

const DEFAULTS = {

  version: "7.0",              // shown in the top-right corner.

  /* ── THE MAP ────────────────────────────────────────────────────────── */

  artwork: "inline",           // "inline"   use the <svg> in the page's tm-artwork
                               //            template. Works however you open the page.
                               // "map.png"  or any .jpg/.webp filename: a flat image
                               //            instead. A separate .svg FILE cannot be
                               //            used; browsers block reading one off the
                               //            local disk.

  mapSize: null,               // [width, height] of the artwork. null reads it
                               // from the SVG's viewBox or the image itself.

  /* ── HOW LONG THE TRAIL IS ──────────────────────────────────────────────
     Fill in ONE of these. The page measures the route itself, but only in map
     units (the SVG's viewBox); it cannot know whether a unit is a metre or a
     mile, so it needs one of these to turn that into a distance.            */

  trailLength: 10.2,           // THE EASY ONE. The whole walk, in kilometres. Every
                               // distance on the page (running total, each
                               // waypoint's "from start", the closing total) is
                               // scaled to match it.

  metresPerPixel: null,        // THE OTHER WAY. Real metres per map unit, from the
                               // scale bar: if 1 km measures 682 units, it is
                               // 1000/682 = 1.47. Only used when trailLength is
                               // null.
                               // Leave BOTH null and every distance readout
                               // removes itself, leaving percentages alone.

  /* ── THE ROUTE ──────────────────────────────────────────────────────── */

  routeFrom: "artwork",        // "artwork"  a path inside the SVG above. In
                               //            Illustrator, name the trail path "route"
                               //            and export SVG with Object IDs set to
                               //            "Layer Names".
                               // "paste"    the routePath string below instead, for
                               //            a flat-image map: copy the route's d="…"
                               //            out of your .svg in a text editor.

  routeName: "#route",         // what the path is called, for "artwork" mode

  /* ── THE PROPOSED LINES BESIDE IT ──────────────────────────────────────
     Every path matching this is read as a proposal (a bypass, a spur, a
     connection that does not exist yet). They are never walked, but a waypoint
     drawn on one is placed in the walk where that line leaves the trail. See
     buildBranches(). Illustrator turns a layer named "wishful route 1" into
     id="wishful_route_1", so the default matches both spellings.            */
  branchLines: '[id^="wishful_route"], [id^="wishful-route"], [id^="route-wish"]',
  branchSnap: 30,              // how near a loose end must be, in map units, to
                               // count as joining the line it is nearest
  heightMarkJump: 40,          // a mark this far out of line with its two
                               // neighbours, in metres, is worth a word
  markerStray: 25,             // and how far a waypoint circle may sit from any
                               // line before the page says so in the console
  sayWhatItRead: true,         // print the branch tree to the console at load

  routePath: "",               // the d="…" string, for "paste" mode
  routeArtboard: null,         // [width, height] of the artboard that string was
                               // drawn on, if it differs from the map size

  reverseRoute: false,         // walk it from the other end
  hideDrawnRoute: true,        // hide the artwork's own trail line, since the
                               // page draws its own animated one on top

  /* ── MOVEMENT ───────────────────────────────────────────────────────── */

  lockPageHeight: true,        // MEASURE the page's height once, in pixels, instead
                               // of leaving it as a multiple of the window height.
                               // On a phone the address bar slides away on scroll
                               // and the window grows 60-100px; a page measured in
                               // screenfuls would grow with it WHILE you scroll,
                               // moving the ground under you. See lockTheScroll().
  bigResizePx: 140,            // a real resize (turning the phone, dragging a desktop
                               // window) re-measures; an address bar appearing does
                               // not. Only a width change, or a height change bigger
                               // than this, counts: more than the tallest address
                               // bar, less than turning a phone.
  pageHeight: 1250,            // how tall the page is, in screenfuls. Bigger = more
                               // scrolling per metre = slower, calmer walk.
                               // Works together with the zoom: zooming in alone
                               // makes the map cross the screen faster for the same
                               // flick, so to be closer AND slower, raise both.

  followLag: 0.13,             // how lazily the map follows the scrollbar.
                               // 1 = rigid and instant, 0.05 = floaty and slow.

  zoomWalking: 1.25,           // scale while walking. 1 = artwork at true size,
                               // below 1 shows more map, above 1 shows less.
  zoomWalkingPhone: 0.82,      // the same on narrow screens, which see a much
                               // smaller slice of the map, so it is lower than the
                               // desktop figure.

  zoomOutAtStart: false,       // begin on the whole map and fly in to the
                               // trailhead. false starts already zoomed in at the
                               // first step.
  /* Never on a phone, whatever the setting above says: a phone cannot rescale
     the whole drawing every frame while its address bar slides, so it stutters
     instead of zooming. See where the page's stages are measured. */
  noPullBackOnAPhone: true,
  phoneWidth:   860,           // the width the stylesheet calls a phone too
  zoomOutAtEnd: true,          // pull back out to the whole map at the finish.
  pinShrinkOnPullBack: 0.45,   // how much smaller the waypoint rings get by the
                               // time the map is fully pulled back. 0 keeps
                               // them the size they are during the walk;
                               // 0.45 takes them to just over half.
  keepInsideEdges: true,       // never show bare ground beside the artwork while
                               // there is artwork to show. The route starts near
                               // the bottom edge, so centring exactly would leave
                               // a third of a phone screen of backdrop under it;
                               // instead the view stops at the edge and the point
                               // slides off centre. Only where the artwork is
                               // bigger than the window.
  tagFadeOnPullBack: 1.6,      // how quickly the waypoint names fade as the map
                               // pulls back out to full width. 1 = gone only at
                               // the very end, higher = gone sooner, 0 = they
                               // stay at full strength the whole way.
  overviewFit: 0.92,           // how much of the screen the whole map fills
                               // when it is pulled out. 1 = right to the edges,
                               // lower leaves more of a margin around it.
  zoomEase: "smoother",        // shape of the pull-back: "smooth" is a gentle S,
                               // "smoother" a longer, flatter S, "linear" none.
  zoomGeometric: true,         // ease the SCALE by ratio, not difference. Zoom is
                               // felt as "twice as close", so a straight numeric
                               // slide from 1.0 to 0.2 rushes at first and crawls
                               // at the end. Leave it on.

  /* ── THE BLUR AT EACH END ───────────────────────────────────────────────
     The map can be softened behind the opening and closing screens. Both are
     off: the opening text sits in its own box, and the finish should show the
     map clean. A full-screen blur is the most expensive thing this page can ask
     a phone to draw, so 0 is worth real frames. Give a value in screen pixels
     to bring one back.                                                      */

  blurAtStart: 0,              // softness behind the opening screen, in pixels
  blurAtEnd:   0,              // softness behind the finish, in pixels

  raisePointOnPhone: 0.16,     // on a phone the card covers the middle, so lift
                               // the walking point this fraction of the screen
                               // above centre. 0 keeps it dead centre.

  /* ── HOW THE SCROLL IS DIVIDED ──────────────────────────────────────────
     Scrolling top to bottom passes through these stages in order; only the
     middle one moves you along the trail. Each is in walks: 0.26 means "as much
     scrolling as 26% of the trail takes".

         openingHold   the opening panel travels up and off; the map does not move
         zoomInOver    fly-in to the trailhead; 0 while zoomOutAtStart is off
       ( the walk )    the trail, 0% to 100%
         zoomOutOver   the map pulls back out; the trail stays at 100%
         closingHold   a last breath of scroll with the whole map in view

     Nothing overlaps. The first CARD is deliberately not tied to this (see
     cardsArriveWith).                                                       */

  openingHold: 0.132,          // scrolling spent on the opening screen
  openingLeavesBy: 0.71,       // the panel has completely left this far through
                               // the hold. Keep it under 1: what is left over is
                               // the pause between the first card landing and the
                               // map moving, and at 1 the walk would start
                               // underneath the panel. The two are a pair: their
                               // PRODUCT is the scroll the exit takes (0.094),
                               // the LEFT OVER is the pause (0.038). Change one
                               // and check both.

  cardsArriveWith: 0.45,       // the READOUTS follow the opening panel out. 0 =
                               // they start the moment the panel moves; 1 = not
                               // until it has gone. The first card has its own
                               // entrance (firstCardEnters). Both hang off the
                               // PANEL, not the walk starting: the first card's
                               // stretch of scroll is over almost as soon as the
                               // walk begins, so holding the interface back past
                               // that deletes the card instead of delaying it.
  openingScrollsAway: true,    // the opening panel TRAVELS UP and off the top as
                               // you scroll, taking the darkening with it, rather
                               // than dissolving in place. It teaches the page:
                               // scroll, and things move. false is a plain fade.
  openingTravel: 1.15,         // how far it travels, in screenfuls. Over 1 carries
                               // it clear of the top edge so its corner does not
                               // clip at the last moment.
  openingFadesToo: 0.35,       // how much it also fades on the way out, 0 to 1. A
                               // little stops it looking like a solid object
                               // hitting the top edge.

  zoomInOver: 0.15,            // scrolling the fly-in takes, if zoomOutAtStart is on
  zoomOutOver: 0.26,           // the pull-back at the finish, which begins at 100%.
                               // Generous: slow reads as deliberate, quick as a
                               // glitch.

  closingHold: 0.08,           // scrolling after the pull-back. The map is
                               // whole and still; nothing is over it.
  closingFadeShare: 0.55,      // how far through that tail the interface has
                               // finished clearing away.

  showClosingScreen: false,    // a panel of totals over the finished map. Off: the
                               // pull-back ends on the map alone. Its words are
                               // still in WORDS.

  /* ── WHAT A PHONE DOES DIFFERENTLY ──────────────────────────────────────
     A phone has roughly a tenth of a laptop's graphics budget, and the
     artwork is the expensive part: every contour line is re-traced each frame.
     Flattening turns the drawing into one picture once, in the background, and
     moves that instead: the same view for a fraction of the work.          */

  flattenOnPhone: true,        // trade the live drawing for a flat picture of
                               // it while walking, on phones only
  flattenWidth: 3600,          // pixel width of that picture. Higher is sharper but
                               // slower and heavier in memory; lower goes soft
                               // when zoomed in. The artwork's own width (3600) is
                               // the sweet spot; if you raise zoomWalkingPhone,
                               // raise this too.
  flattenAfterMs: 400,         // wait this long first so the page has drawn and is
                               // scrollable. The live drawing shows until the
                               // picture is ready.

  /* ── THE TRAIL LINE ─────────────────────────────────────────────────── */
  /* Widths are in map units and are divided by the zoom as you go, so the line
     keeps the same thickness on screen. Colours are in the stylesheet.      */

  trailWidth: 9,               // the walked line, behind you, in map units
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
     map is left clear in between.

     A PHONE GETS ITS OWN FIGURE. On a laptop the card sits beside the map; on a
     phone it covers most of the screen, so cardVisibleForPhone is deliberately
     shorter: the card says its piece and gets out of the way. With thirteen
     waypoints, 0.075 keeps a card up for about three fifths of the walk in
     total; 0.036 brings that down to about a third.                         */

  cardVisibleFor: 0.075,       // how much of the route one card stays up for
  cardVisibleForPhone: 0.036,  // the same on a narrow screen. Set equal to
                               // cardVisibleFor for one figure for both.
  cardLead: 0.02,              // it arrives this far before its waypoint, so it
                               // is already readable when you get there
  cardLeadPhone: 0.012,        // a shorter run-up to match the shorter stay
  cardFade: 0.012,             // the fade in and the fade out at either end
  cardFadePhone: 0.008,        // shorter, because the stay is shorter; keep it well
                               // under a third of cardVisibleForPhone

  cardCloseMs: 220,            // how long the × takes to fade a card away, and
                               // how long a card takes to come back when the
                               // waypoint is clicked. Milliseconds.

  /* ── ONE CARD REPLACING ANOTHER ──────────────────────────────────────────
     Clicking a waypoint while another card is up is not instant: the new card
     comes in from the right and SHOVES the old one out to the left, the old
     one stepping back a little, long enough to be watched.                  */
  cardSwapMs: 520,             // how long the shove takes, in milliseconds
  cardShove: 132,              // and how far either card travels, in pixels
  cardShoveBack: 0.94,         // how far the outgoing one shrinks on its way
  cardsCanBeClosed: true,      // show the × in the corner of every card

  /* ── THE EXPANDED CARD ──────────────────────────────────────────────────
     The button beside the × swaps the card between the small view beside the
     map and a large one in the middle of the screen (4:3 picture, about three
     times the area, more text lines per page). While it is open the page does
     not scroll, since the scroll is the walk and would carry the card away; the
     veil takes the clicks meant for the map. A card always opens small, except
     a proposal arrived at from the Wishful thinking page.                   */
  cardCanGrow: true,           // offer the button at all
  cardGrowsFrom: 1100,         // the narrowest window that gets the button, in
                               // pixels; narrower cannot fit picture and words side
                               // by side. Matches the stylesheet's media query.
  cardGrowsAbove: 620,         // and the shortest window, for the same reason
  cardGrowFadeMs: 130,         // the contents fading out before the change
  cardGrowMs: 260,             // the panel travelling between the two sizes. Both
                               // are in the stylesheet too (--big-fade, --big-glide)
                               // and have to agree.
  /* THE COVER OVER A PAGE STILL FINDING ITS WAYPOINT. A link naming a waypoint
     cannot be honoured until the map is built and the page has measured its
     height, so a plain cover with a turning ring is held over the page until
     it is standing where it was asked to. arriveGiveUpMs is the backstop: a
     cover that outlives what it covers is worse than none. */
  arriveFadeMs: 240,           // how long the cover takes to fade away

  /* ── ARRIVING FROM A LINK ────────────────────────────────────────────────
     Somebody following "Open card on trail page" is handed one waypoint on a
     trail they have not seen. The cover stays while the page gets ready, then
     lifts and the trail travels under them to the waypoint at a pace they can
     watch, so they learn where on the trail they landed. The cards are hushed
     the whole way so the ONE card they asked for opens, on arrival.         */
  /* HOW FAR INTO THE OPENING the scroll prompt stays up, as a fraction of the
     opening panel's own arrival. Small: the first flick of the wheel answers
     "does this page go on" better than text can. */
  goOnUntil:     0.12,
  /* AND IT COMES BACK WHILE YOU WALK. Once the numbers along the bottom are up
     nothing else says the trail goes on, so whenever the reader stops for a
     moment the prompt returns, small, in the gap in that row of numbers, and
     goes again on scroll. It stops offering near the end. */
  goOnWhileWalking: true,
  goOnIdleMs:    2200,         // how long the page has to be still first
  goOnWalkEnds:  0.95,         // how far along the walk it stops offering
  goOnClearance: 10,           // the least room it keeps from the readings
                               // either side of it, in pixels

  /* ══ THE READER'S OWN ZOOM ═══════════════════════════════════════════════
     Pinching would otherwise make the browser scale the whole document, text
     and buttons and all. So there is a second, independent zoom, a lens, on top
     of the walk's: it goes OUT from the walk's own view and never in past it,
     because what a reader wants is the wider picture. + and FIT come back
     towards the walk's view and stop there. The page keeps scrolling while
     zoomed out.                                                             */
  /* ══ THE COMPACT CARD ════════════════════════════════════════════════════
     A waypoint opens as a quarter of a card: the picture, the place name over
     it, and a button that unfolds the rest.

     WHERE IT APPLIES. On a phone, where a full card would hide the map the
     reader just tapped; and on any screen with waypoint auto-load OFF, which
     says "do not put cards in front of me".

     NOT DURING A TOUR, which turns auto-load on: a tour of titles is useless. */
  peekCards:     true,
  peekOnAPhone:  true,         // on a narrow screen, always
  peekWithAutoLoadOff: true,   // and on any screen with auto-load off, where it
                               // means "small cards as I walk". A click on a
                               // waypoint's chip is always the full card.

  zoomOnTrail:   true,
  zoomOutSteps:  2,            // how many presses of − there are, out from
                               // the walk's own view. + never goes past it.
  zoomStep:      1.6,          // what one press of + or − is worth: two steps
                               // out is 1 / 1.6², about 0.39 of the walk's view
  zoomEaseMs:    260,          // how long a pressed step takes to arrive
  zoomEasePower: 3,            // the arrival curve: 1 - (1 - t)^3, quick off the
                               // mark, settling at the end. Worked out in lensTick
                               // rather than CSS.

  /* ── HOW MUCH THE FURNITURE FOLLOWS YOU BACK ─────────────────────────────
     The trail line, rings, name chips and rider are counter-scaled to hold
     their size on screen. Right while WALKING; wrong when STEPPING BACK: on a
     390-pixel phone two presses of − shrink the map to a third while the line
     stays fourteen pixels wide, a green worm with names lying across each other.
     So the furniture follows the step back by this much: 0 holds its size, 1
     shrinks with the map, 0.7 keeps a line thick enough to follow while the map
     gets genuinely wider. A wide window keeps 0 (fourteen pixels is 1% there). */
  furnitureFollowsZoomOut:        0,
  furnitureFollowsZoomOutOnPhone: 0.7,
  zoomWheel:     true,         // and a trackpad pinch (a wheel event with ctrlKey)
  untangleWhenOut: true,       // zoomed out, waypoint names that would lie on
                               // each other move left, up or down, or hide
  untangleGap:   3,            // the least room kept between them, in pixels
  zoomHidesUnderCard: true,    // the controls fade out while a card is opened out
                               // of its compact shape, and return when it closes

  arriveTravel:  true,
  arriveHoldMs:  780,          // how long the cover stays before setting off
  arriveTravelMs: 2200,        // and how long the journey itself takes
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
                               // Do not fetch ahead on a metered connection: free
                               // on wifi, but tens of megabytes nobody asked for on
                               // a phone. Where the browser cannot say (Safari) it
                               // is treated as unmetered.
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

  iconFolder: "icons/",        // EVERY drawing on the site lives here: the legend's
                               // swatches (one SVG per row, named after its
                               // `swatch`) and the coins and gauges on a wishful
                               // card (cost-high.svg, priority-low.svg). The main
                               // map reads this same folder, so redraw an icon
                               // and both pages change. IT MUST END IN A SLASH.
  legendFolder: "",            // honoured if a page still names one; empty means
                               // "use iconFolder".

  railBelowCardsOnPhone: true, // on a phone the card is nearly full width, so the
                               // rail of buttons has nowhere to stand and would be
                               // drawn across the card's picture. With this on the
                               // card takes the higher layer and covers the rail
                               // like a sheet, and the rail is lowered just enough
                               // that no card cuts a button in half (MEASURED, see
                               // placeRail()). The panel stays above the card.
  autoLoadSwitch: true,        // show the Waypoint auto-load row in the layers
                               // panel. The switch starts ON so a first-time reader
                               // sees the page do what it does. Setting this off
                               // removes the row and leaves auto-load on.

  /* THE TOUR. A button between the two arrows that walks the trail for you:
     it scrolls, opens each card, turns its pages and pictures at a pace worked
     out from what is in the card, then closes it and moves on. Escape or
     pressing it again leaves. The rest is in autoplay.js; `autoplay` here
     overrides that file's settings from a page. */
  showAutoplay: true,
  autoplay: {},

  showStepper: true,           // the two arrows above the readouts that jump to the
                               // next waypoint. Quieter than the legend and layers
                               // buttons on purpose: those open things, these move
                               // you along.
  stepperSmooth: true,         // glide to the next stop rather than jumping

  /* ── TRAVELLING PAST WAYPOINTS WITHOUT OPENING THEM ─────────────────────
     Going to a waypoint halfway down the trail scrolls past every waypoint in
     between, and with auto-load on each would open and shut its card as it
     went by, an unreadable flicker. So cards are hushed for the length of the
     journey and the one asked for opens on arrival. Only when something is in
     between: a step to the next waypoint opens at once. */
  hushWhilePassing: true,
  /* ANY JOURNEY LONGER THAN THIS IS HUSHED TOO, waypoint on the way or not:
     two neighbouring stops can be a screen apart, and a card opened at
     departure would appear, vanish and appear again. Roughly a screen. */
  hushOverPx:    700,
  travelCheck:   60,           // how often to look whether the scroll has arrived, ms
  arrivedWithin: 3,            // how close counts as arrived, in pixels
  travelLeast:   180,          // ignore "it has not moved" for this long first: a
                               // smooth scroll takes a moment to set off
  travelStill:   3,            // then this many still checks means it has been taken
                               // over, or stopped short of the target
  travelMost:    2600,         // hard limit: a hush that outlives the journey is a
                               // page with no cards on it

  linkToStops: true,           // EVERY STOP GETS AN ADDRESS: don.html#half-mile-bridge
                               // opens the Don at that stop with its card up, and
                               // walking past a stop rewrites the address to name
                               // it. The name comes from the stop's title, or
                               // `slug` per waypoint.
  linkNameEveryMs: 250,        // how often, at most, the address is checked against
                               // the walk. Every frame is measurably expensive and
                               // no more correct (see followTheWalk).
  linkArriveAfterMs: 260,      // settle time before jumping to a stop named in the
                               // address. The jump is a fraction of the page height,
                               // which is measured from the artwork, so arriving
                               // too early lands in the wrong place.
  showLegend: true,            // the LEGEND button and its panel
  showLayers: true,            // the LAYERS button and its panel
  openPanelAtStart: null,      // "legend", "layers", or null to start closed

  trailKind: "built",          // "built" or "wishful". A WISHFUL TRAIL does not exist
                               // yet (Mimico Creek, say): purple throughout, said so
                               // on its own page and the trails page, with a purple
                               // button on the main map's Wishful thinking switch.
                               // Sets body.trail-wishful; the stylesheet does the
                               // rest.
  crossings: true,             // a button wherever this trail meets another. Places
                               // come from the page's CROSSINGS list, each anchored
                               // to a small circle in the artwork (#link-1 …) drawn
                               // BESIDE the route so a crossing button never lands
                               // under a waypoint button.
  crossingMark: "#link-",      // what those circles are called in the drawing
  trailImage: "",              // a picture of this trail behind the opening panel,
                               // the same one the trails page uses on its card. A
                               // veil (--opening-veil) keeps the text readable.
                               // Empty leaves the panel plain.
  mapFile: "",                 // the drawing for the Download button, e.g.
                               // "maps/beltline-map.svg". Empty leaves the button off.
  wishfulLayer: "#wishful",    // A GROUP IN YOUR ARTWORK holding the routes that do
                               // not exist yet (a bridge closing a gap), drawn like
                               // the main route but shorter and in wishful purple.
                               // Put them in one Illustrator layer named "wishful"
                               // and the export gives <g id="wishful">. The Wishful
                               // thinking switch shows and hides it with the purple
                               // waypoints. A page with no such group is unaffected.
  wishfulOn: false,            // whether the wishful waypoints start switched on. Off
                               // hides their cards, circles, name chips and dots on
                               // the elevation graph.

  satelliteOn: false,          // whether the satellite view starts switched on
  satelliteImage: null,        // NO TRAIL HAS ONE. Set to an aerial picture's filename
                               // and the layers panel grows a "satellite view"
                               // switch; null builds no switch. The picture is drawn
                               // under the artwork and must cover the same ground,
                               // corner to corner. Real aerial imagery is licensed,
                               // so check what you may publish.
  satelliteHides: "#topo",     // what to hide when it comes on: the group in YOUR
                               // artwork holding the printed map (contours, water,
                               // roads, labels). Anything outside it, such as the
                               // route and waypoint circles, stays on top.

  showCompass: true,           // the north badge in the top-right: a fixed label,
                               // since the map is drawn north-up

  /* ── THE WAYPOINT MARKERS ───────────────────────────────────────────────
     The rings at each stop are drawn by the page, in front of everything, so
     they show over the satellite view where the artwork is hidden. Your
     artwork's circles still PLACE each waypoint (marker: "#wp-tarn"); draw them
     small and only these will show. */

  drawWaypoints: true,         // false goes back to relying on the artwork
  waypointSize: 26,            // the ring's width on screen, in pixels; held however
                               // far the map is zoomed, like the name chips
  waypointRing: 0,             // ring thickness. 0 = the same weight as the line from
                               // its card and the card's border (--card-edge-w)
  waypointRingWish: 0,         // the same for a wishful one: thinner, to match its card

  showWaypointLabels: true,    // the name chips pinned to the map
  showWaypointDots: false,     // add a dot to each chip. Leave false if your
                               // artwork already has its own markers drawn.

  /* ── ELEVATION ──────────────────────────────────────────────────────────
     Heights come from the `metres` values on the waypoints. Give at least two
     and the page fills in between; give none and the elevation readouts and
     profile strip remove themselves.

     HEIGHT MARKS. With only waypoint heights the profile between stops is a
     straight line. Height marks are small dots along the route in the drawing,
     NAMED for their height (`h-118` is 118 m; one every 500 m is plenty). They
     carry no card, chip or graph dot and are hidden (by the stylesheet, and
     again here). A waypoint's typed height wins where the two are close. The
     number is everything from the first digit (`h-118_1` is 118). "" ignores
     them.                                                                   */
  heightMarks: "h-",           // what a height mark's name begins with
  heightMarkClear: 0.005,      // a mark this near a waypoint, as a share of the
                               // route, gives way to it
  heightMarkStray: 0.04,       // one further than this from the route is reported in
                               // the console; probably left somewhere by accident

  smoothElevation: 14,         // rounds off the corners where the straight lines
                               // between waypoints meet. 0 = leave them sharp.
  profileDetail: 260,          // points the little graph is drawn from. More is
                               // smoother and very slightly slower.

  /* ── EXTRAS ─────────────────────────────────────────────────────────── */

  coordinateReader: true,      // the E key, for reading positions off the map by
                               // clicking. No button: it is a tool for setting up
                               // waypoints, not for visitors.

  mediaFolder: "",             // folder holding your pictures and video, relative to
                               // this HTML file, put in front of every filename in
                               // the waypoints. IT MUST END IN A SLASH. "" means
                               // write full paths yourself (the Beltline's media is
                               // on the site's CDN). Anything starting http://,
                               // https://, / or data: is left alone.
  /* ── ODDS AND ENDS ──────────────────────────────────────────────────────
     Small numbers kept here rather than buried in the engine. Safe to ignore. */

  signedElevation: true,       // a trail that ENDS LOWER than it starts has no ascent
                               // worth showing (the Beltline runs downhill, so the
                               // figure sat at zero). The readout then shows net
                               // change from the trailhead, negative, with the label
                               // WORDS.netChange. A trail that climbs is unaffected.
  cardRiseBy: 18,              // pixels a card slides up as it fades in
  firstCardEnters: true,       // the first card ARRIVES rather than merely being
                               // there. Every other card fades up as the walk
                               // reaches it; the first has no walk to be reached
                               // by, so it gets the same entrance (over cardFade of
                               // scroll) timed to land as the darkening finishes.
                               // false leaves it simply present.

  /* HOW FAR A CARD HAS TO HAVE FADED IN before it counts as on screen, which is
     when its coin and dial are asked to move: near enough to one that the
     reading is legible, since an animation behind a half-transparent card is
     half seen. */
  cardReadyAt:   0.96,
  cardLiveAbove: 0.05,         // a card fainter than this ignores the mouse, so
                               // it can never swallow a click meant for the map
  /* ── NO CARD LEFT HALF-FADED ─────────────────────────────────────────────
     Somebody who stops scrolling mid-fade is left with a card at 60% and the
     map showing through the words. If the page stays like that for
     settleAfterMs, it is eased onto the waypoint and the card finishes
     arriving. Any touch, wheel or key hands the page straight back. */
  settleCards:   true,
  settleAfterMs: 1800,         // how long a half-shown card is left alone
  settleMs:      800,          // and how long the glide onto its stop takes
  /* ── WHEN TWO CARDS WANT THE SAME MOMENT ───────────────────────────────
     Cards need about a third of a screen of scroll to give way to the next
     without a flicker. Waypoints closer than stackWithin (below) share a moment
     and are dealt as one hand. Measured in SCROLL PIXELS, because it is the
     reader's scroll that has to fit the fade, not the map's geometry. */
  /* ── THE LINE FROM THE CARD TO THE PLACE ───────────────────────────────
     With proposals beside the trail, a card can be about somewhere the map is
     not obviously pointing at, so a line is drawn between card and ring in the
     card's own colour. Desktop only: a phone has neither the room nor the
     pointer. */
  leaders: true,               // draw it at all
  /* WHEN THE LINE DRAWS: the card arrives, THEN the line draws itself in from
     the waypoint; on the way out the line retracts FIRST and the card follows.
     The numbers are leader-line.js's own, listed here with the rest of the
     line's so a trail page can differ. */
  leaderInAt: 0.96,            // the card has to be this far faded in before the
                               // line starts: card first, then line
  leaderOutAt: 0.92,           // …and the line starts leaving when the card falls
                               // to this. Lower than leaderInAt so a card hovering
                               // near one value cannot make it flicker.
  leaderDrawMs: 420,           // how long it takes to draw itself in
  leaderOutMs: 260,            // …and to draw itself back out
  leaderOutLead: 0.65,         // a card put away by hand waits this share of the
                               // retraction before following, so closing does
                               // not feel slow but the line still goes first
  leaderShortest: 14,          // below this length it is not worth drawing. Both
                               // ends fade out, so a short line is a soft mark
                               // between two things already side by side; at 44 it
                               // went missing whenever a ring sat just off the card.
  leaderBelow: 11,             // the LEAST it drops below the ring's middle before
                               // it starts, in pixels: clear of the name chip
  leaderClear: 3,              // and how far outside the ring's drawn edge it
                               // starts, whichever is further down. The ring is
                               // MEASURED because it grows when its waypoint is the
                               // open one; a fixed number that cleared a closed ring
                               // drew the line across the middle of an open one.
  leaderStick: true,           // once the line has found its spot on the card it
                               // KEEPS it instead of sliding along the edge as the
                               // map moves: pinned reads as attached
  leaderStickSlack: 40,        // until the ring has gone this far past the card's
                               // middle on the other side, when holding would drag
                               // the line across the words and it takes a new hold
  leaderStickStill: 7,         // A HOLD IS ONLY TAKEN ON A CARD STANDING STILL. If the
                               // card's box has moved or resized by more than this
                               // since the hold, it is dropped and retaken. Without
                               // it a card caught mid-animation (coming back out of
                               // full screen) hands the line a spot measured against
                               // a box still flying, and the line holds that wrong
                               // spot as long as the card is open.
  leaderGone: 0.18,            // the fade by which the line must be completely gone
                               // WHATEVER THE CLOCK SAYS. A card fading by scroll
                               // can vanish in a tenth of a second while the line
                               // takes leaderOutMs to retract, so between
                               // leaderOutAt and here the line is held to the share
                               // of card left. Stops a line pointing at nothing
                               // after a quick flick.
  leaderDrop: 84,              // THE ELBOW'S SIZE, in pixels: the line attaches to the
                               // card this far BELOW the ring's height, so it leaves
                               // the ring going down, turns a corner and meets the
                               // card level. Level with the ring is the shortest
                               // line but has no elbow, and then nothing says which
                               // end is the map. It also keeps the line off the
                               // waypoint's name chip. Clamped to the card's edge,
                               // so a card above the ring gets the shape upside down.
  leaderGap: 0,                // how far short of the card's edge it stops.
  leaderCorner: 26,           // radius of the one bend: big enough to read as a turn,
                               // small enough that both runs look straight. Cut down
                               // automatically when a card is nearly level with its
                               // ring (see leader-line.js).
  leaderDash: 6,               // the dash and the gap between two dashes, in
  leaderDashGap: 11,           // pixels. The gap is nearly twice the dash so it reads
                               // as travelling dots, not a dashed border.
  leaderMarchMs: 2400,         // how long one dash takes to travel to where the next
                               // was. Slow on purpose: noticed once, then believed.

  wishfulFadeMs: 260,          // how long the proposed lines take to fade in
                               // and out when the switch is thrown

  frontTie: 0.02,              // two cards within this much of each other's fade
                               // count as equally strong and the nearer stop wins.
                               // See "which card is on screen" in draw().

  /* ── WHERE THE WALKING POINT SITS, AS A FRACTION OF THE WINDOW ─────────
     0.5, 0.5 is dead centre. The four frame* values are the corners of a blend
     between what the framing wants when the trail runs ACROSS the page and
     DOWN it. See "where the walking point sits on the screen" in draw(). */
  arrivalPing: true,           // one ring from the walking point each time the walk
                               // reaches a waypoint
  compassSway: 22,             // how far the compass needle leans into the walk, in
                               // degrees per unit of framing. 0 = not at all.

  lookAhead: true,
  lookAheadBy: 0.05,           // how far along the trail it looks, as a
                               // fraction of the whole route
  frameAcrossX: 0.34,          // across the page: well left, vertically centred
  frameAcrossY: 0.50,
  frameDownX: 0.40,            // down the page: a little left and a good way up
  frameDownY: 0.33,
  frameEaseMs: 900,            // how long the framing takes to settle after the
                               // trail changes its mind about which way it goes

  /* ── HOW LONG THE MAP IS HELD AGAINST THE WINDOW ───────────────────────
     keepInsideEdges is fully on until holdEdgesFrom and fully off from
     holdEdgesUntil, after which the walking point is centred for the rest of
     the trail. 0 for holdEdgesUntil means it never lets go. */
  holdEdgesFrom:  0.015,
  holdEdgesUntil: 0.085,

  stackWithin: 260,            // cards closer than this, in pixels of scroll,
                               // are dealt as one hand
  /* THE FAN IS OFF. Cards sharing a moment were fanned like a hand of cards,
     which did not read: the edges behind are thin and over a busy map, and
     "another one is right here" is said better by the card simply changing at
     the next stop (see frontTie). The machinery still works: raise stackMax to
     3 and the hand comes back. How the fan looks is in the stylesheet
     (--stack-lift, --stack-shift, --stack-shrink). */
  stackMax: 1,                 // how many cards are shown at once. 1 = no fan.
  stackFade: 0.62,             // each card behind is this much of the one in front

  cardFoldBelow: 0.01,         // a card fainter than this is invisible, the only safe
                               // moment to fold it back to its compact shape (see
                               // "dressed before it is seen" in the drawing loop)
  placeholderHue: 24,          // colour of the stand-in photo on the first card,
  placeholderHueStep: 14       // and how far the hue turns on each card after it
};

/* ═══════════════════════════════════════════════════════════════════════════
   THE DEFAULT WORDS
   The same arrangement for text. A page overrides the handful that name its
   own trail (title, opening paragraph, kicker) and inherits the rest.
   ═══════════════════════════════════════════════════════════════════════════ */

const DEFAULT_WORDS = {

  browserTab:    null,             /* null = keep the page's own <title> */

  /* The two lines above the title. A line break in the kicker is <br>, so it is
     one string. Type and length share ONE line, which gives the title a line of
     height back. */
  cornerKicker:  "Type: Railpath &nbsp;·&nbsp; Length: 10.2 km",
  cornerTitle:   "The Beltline",

  /* ── THE NAVIGATION BAR ─────────────────────────────────────────────────
     The same bar every page uses; keep this block identical across them.
       here: true   marks the page you are on (accent colour, underlined). */
  bar: {
    brand:     "Happy Trails",
    brandHref: "index.html",
    links: [
      { label: "Map",     href: "index.html",         here: false },
      { label: "Trails",  href: "trails.html",  here: true  },
      { label: "Wishful", href: "wishful.html", here: false },
      { label: "About",   href: "about.html",   here: false },
      { label: "Contact", href: "contact.html", here: false },
      /* Marked so the stylesheet can tint it: the only item that leaves the
         site, so it should look like an offer. */
      { label: "Buy me a coffee", short: "Coffee",
        href: "https://buymeacoffee.com/sebazistan", here: false,
        newTab: true, kind: "coffee" }
    ]
  },

  /* ── THE LINK BUTTONS UNDER THE TITLE ───────────────────────────────────
     A link with no href is left off, so clear the href to drop one; clear all
     and the row disappears (set --title-links to 0px to close the gap).
       download: true   offers the file for saving
       newTab:   true   opens in a new tab
       icon             "back" goes before the label, the others after
     DOWNLOAD with an empty href is filled in from SETTINGS.mapFile.         */
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
  /* the line at the foot of the screen, for somebody who missed the opening panel's */
  scrollOn:      "Scroll for more",
  previousStop:  "Previous waypoint",
  nextStop:      "Next waypoint",
  /* the tour button between the two arrows, and how to get out of it */
  playTour:      "Play the trail",
  stopTour:      "Stop playing",
  tourEscape:    "Press Esc to leave autoplay",
  /* where the tour has got to; {n} and {of} count only the live stops, so
     switching the wishful layer off changes both */
  tourAt:        "{n} of {of}",
  tourBack:      "Previous waypoint",
  tourOn:        "Next waypoint",
  /* WHERE THE WALK HAS GOT TO, SHOWN AT ALL TIMES beside the arrows. Shorter than
     tourAt because it is a readout, like a page number, not a sentence. */
  stepAt:        "{n} / {of}",
  stepAtLabel:   "Waypoint {n} of {of}",
  /* PAUSING THE TOUR differs from stopping it: stopping closes the card and
     hands the page back, pausing leaves everything where it is. */
  tourHold:      "Pause the tour",
  tourGoOn:      "Carry on",
  tourHeld:      "Paused — press play to carry on",
  /* the elevation graph, for a keyboard and screen reader; and the word for flat ground */
  graphLabel:    "Position along the trail",
  level:         "level",
  /* THE BUTTON IN A CARD'S CORNER. Short, because card width is the scarcest
     thing on a phone. The long form is the tooltip (copyLinkLong in
     waypoint-card.js). */
  zoomIn:        "Zoom back in",
  zoomOut:       "Zoom out",
  zoomFit:       "Back to the walk's own view",
  copyLink:      "Copy location",
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
  /* the two facts a wishful stop carries and their three values: written out
     because a screen reader has only the words */
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
     The legend is a plain list of a small drawing and a label. `swatch` names
     the drawing, so adding a row is one line here. */
  legendName:   "Legend",
  legendTitle:  "Legend",
  legendNote:   "",
  /* Each row's drawing is icons/<swatch>.svg, the SAME folder the main map
     reads, so a symbol means the same on both pages. The last two are this
     page's own: the two kinds of waypoint. */
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
  /* the switch that decides whether a card opens by itself. Its note says what
     the switch is doing NOW, not what pressing it would do: a note that changes
     when you press is the clearest confirmation that it worked. */
  layerAutoLoad:     "Waypoint auto-load",
  layerAutoLoadOn:   "Full cards open as you reach each stop",
  layerAutoLoadOff:  "Small cards as you walk \u2014 tap a stop for the full one",
  layerWishfulNote:  "Stops that are proposed rather than built",
  /* what that row says on a wishful trail, where the switch is locked on */
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

/* What the page asked for, laid over what it did not mention. One level deep
   is enough: every setting is a plain value, short list or small object that is
   replaced whole. */
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
   The page's <body> holds only its artwork template; everything visible is put
   there by this, so the trail pages cannot end up with different navigation
   bars. The artwork template is left where it is and read later by name. */
function buildThePage() {
  var artwork = document.getElementById("tm-artwork");
  var stage = document.createElement("div");
  stage.innerHTML = INTERFACE;
  while (stage.firstChild) document.body.insertBefore(stage.firstChild, artwork);
  document.body.classList.add("page-trail");
  /* THE COVER GOES UP BEFORE ANYTHING IS DRAWN, and only when the address names
     a waypoint. Until the page stands at that waypoint (map built, height
     measured, scroll jumped, card open) there is only the trail arriving at
     somewhere nobody asked for. It goes up now, as the interface is written,
     because later is after the first paint. */
  if (location.hash.length > 1) {
    var cover = document.getElementById("tm-loading");
    if (cover) cover.classList.add("is-on");
    setTimeout(uncover, SETTINGS.arriveGiveUpMs);
  }
  /* A wishful trail is purple throughout; one class carries it (see
     body.trail-wishful in happy-trails.css). */
  if (SETTINGS.trailKind === "wishful") document.body.classList.add("trail-wishful");
}

var INTERFACE = "\n<!-- the site's navigation bar; words in WORDS.bar -->\n<header id=\"tm-bar\">\n  <a id=\"tm-barBrand\" href=\"#\"></a>\n  <nav id=\"tm-barNav\"></nav>\n</header>\n\n<!-- the map and everything drawn on it -->\n<div id=\"tm-stage\">\n  <!-- THE LENS: the reader's own zoom, a second transform on this wrapper, separate from the walk's on tm-world -->\n  <div id=\"tm-lens\">\n  <div id=\"tm-world\">\n    <!-- the artwork is inserted here when the page loads -->\n    <svg id=\"tm-trail\" xmlns=\"http://www.w3.org/2000/svg\">\n      <path id=\"tm-trailOutline\" fill=\"none\" stroke-linejoin=\"round\" stroke-linecap=\"round\"/>\n      <path id=\"tm-trailAhead\"   fill=\"none\" stroke-linejoin=\"round\" stroke-linecap=\"round\"/>\n      <path id=\"tm-trailWalked\"  fill=\"none\" stroke-linejoin=\"round\" stroke-linecap=\"round\"/>\n    </svg>\n    <div id=\"tm-labels\"></div>\n  </div>\n  </div>\n</div>\n\n<!-- THE ZOOM CONTROLS: out from the walk's view and back, never in past it -->\n<div id=\"tm-zoom\">\n  <button class=\"tm-zoomBtn\" id=\"tm-zoomIn\" type=\"button\">\n    <svg viewBox=\"0 0 24 24\" aria-hidden=\"true\"><circle cx=\"11\" cy=\"11\" r=\"7.5\"/><path d=\"M21 21l-4.35-4.35M8 11h6M11 8v6\" stroke-linecap=\"round\"/></svg>\n  </button>\n  <button class=\"tm-zoomBtn\" id=\"tm-zoomOut\" type=\"button\">\n    <svg viewBox=\"0 0 24 24\" aria-hidden=\"true\"><circle cx=\"11\" cy=\"11\" r=\"7.5\"/><path d=\"M21 21l-4.35-4.35M8 11h6\" stroke-linecap=\"round\"/></svg>\n  </button>\n  <button class=\"tm-zoomBtn\" id=\"tm-zoomFit\" type=\"button\"><span class=\"tm-11\">FIT</span></button>\n</div>\n\n<div id=\"tm-shade\"></div>\n\n<!-- the interface that sits over the map -->\n<div id=\"tm-ui\">\n\n  <header id=\"tm-topbar\">\n    <div id=\"tm-brand\">\n      <div class=\"tm-kicker\" id=\"tm-cornerKicker\"></div>\n      <h1 id=\"tm-cornerTitle\"></h1>\n      <!-- filled in from WORDS.trailLinks; empty if none of them has an href -->\n      <div id=\"tm-links\"></div>\n    </div>\n    <div id=\"tm-topright\">\n      <span id=\"tm-version\"></span>\n    </div>\n  </header>\n\n  <!-- THE LEFT RAIL: compass and the two panel buttons, pinned; one panel swaps its contents -->\n  <div id=\"tm-rail\">\n  <div id=\"tm-compass\" role=\"img\">\n    <!-- the arrow fills its 24x24 box -->\n    <svg viewBox=\"0 0 24 24\" aria-hidden=\"true\"><path d=\"M12 1.5 L20 22 L12 17.4 L4 22 Z\"/></svg>\n    <span id=\"tm-north\"></span>\n  </div>\n\n    <button class=\"tm-railBtn\" id=\"tm-legendBtn\" type=\"button\" aria-expanded=\"false\"\n            aria-controls=\"tm-panel\">\n      <svg viewBox=\"0 0 24 24\" aria-hidden=\"true\" fill=\"none\" stroke=\"currentColor\"\n           stroke-width=\"1.9\" stroke-linecap=\"round\">\n        <path d=\"M4 7h3M4 12h3M4 17h3M11 7h9M11 12h9M11 17h9\"/>\n      </svg>\n      <span class=\"tm-railName\"></span>\n    </button>\n\n    <button class=\"tm-railBtn\" id=\"tm-layersBtn\" type=\"button\" aria-expanded=\"false\"\n            aria-controls=\"tm-panel\">\n      <svg viewBox=\"0 0 24 24\" aria-hidden=\"true\" fill=\"none\" stroke=\"currentColor\"\n           stroke-width=\"1.9\" stroke-linejoin=\"round\">\n        <path d=\"M12 3 21 8l-9 5-9-5 9-5Z\"/><path d=\"M3 13l9 5 9-5\"/>\n      </svg>\n      <span class=\"tm-railName\"></span>\n    </button>\n  </div>\n\n  <!-- the one panel both buttons open -->\n  <aside id=\"tm-panel\" hidden>\n    <header id=\"tm-panelTop\">\n      <h2 id=\"tm-panelTitle\"></h2>\n      <button class=\"tm-close\" id=\"tm-panelClose\" type=\"button\">&times;</button>\n    </header>\n    <div id=\"tm-panelNote\"></div>\n    <div id=\"tm-panelBody\"></div>\n  </aside>\n\n  <!-- the veil behind an expanded card; clicking it puts the card back -->\n  <div id=\"tm-cardveil\"></div>\n\n  <!-- the card-to-waypoint line, drawn in screen coordinates -->\n  <svg id=\"tm-leaders\" aria-hidden=\"true\">\n    <defs>\n      <!-- faint at both ends, full across the middle; colour set once in the stylesheet -->\n      <linearGradient id=\"tm-leaderFade\" gradientUnits=\"userSpaceOnUse\">\n        <stop class=\"tm-leaderEnd\"  offset=\"0\"/>\n        <stop class=\"tm-leaderMid\"  offset=\"0.2\"/>\n        <stop class=\"tm-leaderMid\"  offset=\"0.8\"/>\n        <stop class=\"tm-leaderEnd\"  offset=\"1\"/>\n      </linearGradient>\n    </defs>\n    <path id=\"tm-leaderLine\" fill=\"none\"/>\n  </svg>\n\n  <div id=\"tm-cards\" role=\"main\"></div>\n\n  <div id=\"tm-readouts\">\n    <div id=\"tm-numbers\">\n      <div class=\"tm-readout\" id=\"tm-boxDistance\"><small></small><b id=\"tm-valDistance\">0</b></div>\n      <div class=\"tm-readout\" id=\"tm-boxElevation\"><small></small><b id=\"tm-valElevation\">0</b></div>\n      <div class=\"tm-readout tm-optional\" id=\"tm-boxAscent\"><small></small><b id=\"tm-valAscent\">0</b></div>\n      <div class=\"tm-gap\"></div>\n      <div class=\"tm-readout\" id=\"tm-boxComplete\"><small></small><b id=\"tm-valComplete\">0</b></div>\n    </div>\n    <div id=\"tm-profile\"></div>\n  </div>\n\n  <section id=\"tm-opening\">\n    <!-- one .tm-box shared by the opening and closing screens -->\n    <div class=\"tm-box\">\n      <div class=\"tm-kicker\" id=\"tm-openingKicker\"></div>\n      <h2 id=\"tm-openingTitle\"></h2>\n      <p id=\"tm-openingBody\"></p>\n      <div id=\"tm-hint\">\n        <span id=\"tm-openingHint\"></span>\n        <svg width=\"20\" height=\"26\" viewBox=\"0 0 20 26\" fill=\"none\" stroke=\"currentColor\"\n             stroke-width=\"1.6\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M10 3v18M4 15l6 6 6-6\"/></svg>\n      </div>\n    </div>\n  </section>\n\n  <section id=\"tm-closing\">\n    <div class=\"tm-box\">\n      <h2 id=\"tm-closingTitle\"></h2>\n      <p id=\"tm-closingBody\"></p>\n      <div class=\"tm-row\">\n        <div class=\"tm-readout\"><small id=\"tm-closingLabel1\"></small><b id=\"tm-closingTotal\">\u2014</b></div>\n        <div class=\"tm-readout\"><small id=\"tm-closingLabel2\"></small><b id=\"tm-closingAscent\">\u2014</b></div>\n        <div class=\"tm-readout\"><small id=\"tm-closingLabel3\"></small><b id=\"tm-closingHigh\">\u2014</b></div>\n      </div>\n    </div>\n  </section>\n</div>\n\n<!-- shown only on a phone held on its side (see the orientation media query) -->\n<div id=\"tm-turn\">\n  <div class=\"tm-box\">\n    <!-- a phone stood upright, with an arrow turning it that way -->\n    <svg width=\"52\" height=\"52\" viewBox=\"0 0 32 32\" fill=\"none\" stroke=\"currentColor\"\n         stroke-width=\"1.6\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\">\n      <rect x=\"11\" y=\"10\" width=\"10\" height=\"18\" rx=\"2.5\"/>\n      <line x1=\"14.4\" y1=\"25\" x2=\"17.6\" y2=\"25\"/>\n      <path d=\"M5.5 13.5 A11.5 11.5 0 0 1 26.5 13.5\"/>\n      <polyline points=\"9.6,9.6 5.5,13.6 1.6,9.4\"/>\n    </svg>\n    <h2 id=\"tm-turnTitle\"></h2>\n    <p id=\"tm-turnWhy\"></p>\n  </div>\n</div>\n\n<!-- a line at the foot saying the page goes on; gone once the walk starts -->\n<div id=\"tm-goOn\" aria-hidden=\"true\">\n  <span id=\"tm-goOnWord\"></span>\n  <svg viewBox=\"0 0 20 26\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.9\"\n       stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M10 3v18M4 15l6 6 6-6\"/></svg>\n</div>\n\n<div id=\"tm-scroller\"></div>\n\n<!-- optional helper: press E to read coordinates off the map -->\n<div id=\"tm-reader\">\n  <div id=\"tm-coords\">\u2014</div>\n  <div id=\"tm-readerPanel\">\n    <h3 id=\"tm-readerTitle\"></h3>\n    <p id=\"tm-readerHelp\"></p>\n    <textarea id=\"tm-readerOut\" aria-labelledby=\"tm-readerTitle\" spellcheck=\"false\" readonly></textarea>\n    <div id=\"tm-readerButtons\">\n      <button class=\"tm-button\" id=\"tm-copyButton\" type=\"button\">Copy</button>\n      <button class=\"tm-button\" id=\"tm-clearButton\" type=\"button\">Clear</button>\n    </div>\n  </div>\n</div>\n\n<!-- cover shown while the page finds the waypoint named in the address -->\n<div id=\"tm-loading\">\n  <div class=\"tm-loadRing\"></div>\n  <p id=\"tm-loadingWord\"></p>\n</div>\n\n<div id=\"tm-problem\"><p id=\"tm-problemText\"></p></div>";

/* ═══════════════════════════════════════════════════════════════════════════
   ══  THE ENGINE  ══  No edits needed past this point.
   ═══════════════════════════════════════════════════════════════════════════ */

/* ── small helpers ─────────────────────────────────────────────────────── */
const el         = name => document.getElementById("tm-" + name);
/* every element this page owns is prefixed "tm-" so it cannot clash with a
   layer name inside the artwork */
const clamp      = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const mix        = (a, b, t) => a + (b - a) * t;
const ramp       = (from, to, x) => { const t = clamp((x - from) / (to - from), 0, 1); return t * t * (3 - 2 * t); };
/* The same 0-to-1 ramp with a choice of curve. "smoother" has zero first AND
   second derivative at both ends, which removes the faint kick at the start and
   stop of a movement. SETTINGS.zoomEase picks. */
const slide = (from, to, x, shape) => {
  const t = clamp((x - from) / (to - from), 0, 1);
  if (shape === "linear")   return t;
  if (shape === "smoother") return t * t * t * (t * (t * 6 - 15) + 10);
  return t * t * (3 - 2 * t);                       // "smooth"
};
/* Blend two zoom levels by ratio, the way zoom is felt. Going 1.0 -> 0.2, the
   middle of a straight numeric slide is 0.6 (most of the movement looks done);
   by ratio it is 0.45 and the pull-back reads as one even glide. */
const mixZoom = (a, b, t) => SETTINGS.zoomGeometric ? a * Math.pow(b / a, t) : mix(a, b, t);
const isPhone    = () => window.innerWidth <= SETTINGS.phoneWidth;

/* ── AND SEPARATELY: IS THIS A THING YOU HOLD? ────────────────────────────
   isPhone() is about ROOM, and almost everything asking about phones wants
   that. The pull-back at the finish is different: whether rescaling the whole
   drawing every frame is smooth or a stutter depends on what is drawing, not on
   window width; a tablet at 1024 points is as much a handheld as a phone at 390.
   So it asks the way the browser describes the device: a pointer you cannot
   hover with, which is a finger. Both are true of a phone. */
const isHandheld = () => isPhone() ||
  !!(window.matchMedia &&
     window.matchMedia("(pointer: coarse) and (hover: none)").matches);
/* ── writing a readout ────────────────────────────────────────────────────
   Each readout is a number with a small unit. Rewriting it as HTML every frame
   makes the browser re-parse text that mostly has not changed (the number is
   rounded). say() keeps the two text nodes and touches one only when its
   content differs. */
const saidBefore = Object.create(null);
function say(name, value, unit) {
  if (saidBefore[name] === value) return;
  saidBefore[name] = value;
  const box = el(name);
  /* The markup starts as a bare "0", so the first call builds the parts: a
     text node for the number and an <i> for the unit. */
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
   measured, so these two labels are written twice: with the ordinary name, then
   here once there is an answer. A signed net change is not an "ascent". */
function nameTheClimb() {
  const name = downhillTrail ? WORDS.netChange : WORDS.ascent;
  const box  = el("boxAscent");
  if (box) box.querySelector("small").textContent = name;
  const closing = el("closingLabel2");
  if (closing) closing.textContent = name;
}

/* ── is this a connection worth spending? ─────────────────────────────────
   Fetching videos ahead stops first-play stutter. On wifi that is free; on a
   phone out on the trail it can be tens of megabytes nobody asked for. Where
   the browser says the reader wants data saving or the line is slow, we skip
   it; where it cannot say (Safari) we treat it as unmetered. Asked fresh each
   time because a phone can move from wifi to cellular halfway down the page. */
function onAMeteredLine() {
  if (!SETTINGS.videoPreloadOnlyOnFastLines) return false;
  const line = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  if (!line) return false;
  if (line.saveData) return true;
  return SETTINGS.slowConnections.indexOf(line.effectiveType) !== -1;
}

/* A rounded number that keeps its sign, with a true minus sign. "0" never
   comes out as "-0". */
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
/* A trail that finishes lower than it started has no useful "ascent" (the
   Beltline runs downhill, so it would be a permanent zero). Then the readout
   shows the NET change, negative, with a matching label. Decided once, from the
   first and last points of the route. */
let downhillTrail = false;
let climbedTo = [];             // uphill metres from the start to each point of
                                // `path`, added up once instead of every frame

/* ── the layers ──────────────────────────────────────────────────────────
   Two switches, plain booleans. Everything that reacts to them (cards, map
   circles, name chips, graph dots, the artwork) reads these rather than keeping
   its own copy, so they cannot disagree with the switch the reader sees. */
let wishfulOn   = true;
/* WHETHER A CARD OPENS BY ITSELF as the walk reaches its waypoint. Off, it is
   a map you open things on when you want, the better way to LOOK at it. A
   switch rather than a setting: it is a preference about what you are doing
   now, not about the trail. */
let autoLoadOn  = true;
/* EVERY PART OF THE DRAWING THAT IS A PROPOSAL, once found. A list: a drawing
   may have one <g id="wishful"> or, from named Illustrator layers, one path per
   proposal (wishful_route_1 …) with no group. The switch shows or hides all. */
let wishfulArt  = [];
/* links to trails that do not exist yet: purple, shown only while the
   proposals are. Declared here because applyLayers() reads it and `let` is not
   hoisted. */
let crossingsWishful = [];
let stepperNeedsRefresh = null; // set once the stepper exists, called when the
                                // set of reachable stops changes
let satelliteOn = false;
let satelliteOk = true;          // false once the picture has failed to load
let applyLayers = () => {};      // filled in once the page is built

/* THE READER'S OWN ZOOM-OUT, 1 being the walk's own view. Declared here ahead
   of everything that reads it: the layers are applied and the first frame drawn
   before the zoom's own code runs, and a `let` read before its line is an
   error, not a 1. */
let lensAt = 1;
/* WHERE THE ZOOM IS GOING, and where and when it started. `lensAt` is the level
   DRAWN this frame; these are what it travels between. Declared here for the
   same reason. */
let lensWant = 1, lensFrom = 1, lensSince = 0;
/* how big a waypoint chip is on screen as a fraction of its designed size: 1
   during the walk, smaller as the finish pulls back. Used by the pass that
   moves names off each other when zoomed out. */
let chipShrink = 1;
/* HOW MANY OF THE RIDER'S OWN PIXELS ONE MAP UNIT IS. Declared here, not beside
   the line that writes it, because draw() runs on the first frame and `let` is
   not hoisted; that has taken this page down four times. */
let riderScale = 1;
let lastUntangledOut = false;    // so names are put home once on the way back to 1
let buildPanels = () => {};      // and so is this

/* Is this stop on a layer that is switched on? Asked by everything that can
   show a waypoint, so a new layer only needs adding here. */
const onALiveLayer = stop => !(stop.kind === "wishful" && !wishfulOn);

function giveUp(message) {
  el("problem").classList.add("tm-open");
  el("problemText").innerHTML = message;
  uncover();          // whatever went wrong, it must be readable
}

/* TAKE THE COVER DOWN, the moment the page stands where it was asked to, and
   from everything that could mean it never will: artwork that would not load,
   an address naming a missing waypoint, and a plain timer. */
/* WHAT CANNOT BE SEEN CANNOT BE TABBED TO. Faded-out controls and cards stay
   in the document, so without this a keyboard user pressed Tab through dozens
   of invisible buttons (every card's close, grow, arrows and dots) before
   reaching anything on screen. `inert` takes a node out of the tab order and
   out of the accessibility tree together, the same moment the page stops it
   taking clicks. Written only when the answer changes. */
function takesInput(node, live) {
  if (node && node.inert === live) node.inert = !live;
}

function uncover() {
  const cover = el("loading");
  if (!cover || !cover.classList.contains("is-on")) return;
  cover.classList.add("is-going");
  setTimeout(() => cover.classList.remove("is-on", "is-going"),
             SETTINGS.arriveFadeMs);
}

/* ── the waypoint stepper ─────────────────────────────────────────────────
   Two arrows to the previous and next waypoint, deliberately quieter than the
   legend and layers buttons: those open things, these move you along. An arrow
   greys out when there is nothing that way. Which stops count depends on the
   Wishful thinking switch. */
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
    /* THE PLAY BUTTON SITS BETWEEN THE ARROWS: they step by hand, this one walks
       for you. Play AND pause in one control: press to start, again to hold,
       again to carry on. Stopping has its own button after the forward arrow,
       added by autoplay.js. Both faces are in the button and the stylesheet
       shows the right one, because swapping at the press would lose focus. */
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
    /* AND THE COUNT, AFTER THEM, because it answers the question the arrows
       raise ("how much is left") and belongs beside them. Filled in by
       refreshStepper. role="status" so a screen reader hears it without the
       focus moving. */
    '<span id="tm-stepCount" role="status"></span>';
  const readouts = el("readouts");
  readouts.parentNode.insertBefore(box, readouts);
}

/* put the words on the page */
function writeWords() {
  /* Only if the page asked for it. The <title> in the head is per-page and read
     by search engines and link previews, so overwriting it by default made every
     trail inherit the Beltline's. */
  if (WORDS.browserTab) document.title = WORDS.browserTab;
  const set = (id, text) => { const n = el(id); if (n) n.innerHTML = text; };
  set("cornerKicker",  WORDS.cornerKicker);
  set("cornerTitle",   WORDS.cornerTitle);
  set("openingKicker", WORDS.openingKicker);
  set("openingTitle",  WORDS.openingTitle);
  set("openingBody",   WORDS.openingBody);
  set("openingHint",   WORDS.openingHint);
  set("goOnWord",      WORDS.scrollOn);
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
    /* A link with a `short` form is written twice; the stylesheet shows one,
       because which fits is a question about window width. */
    (link.short ? '<span class="nav-full">' + link.label + '</span>' +
               '<span class="nav-short">' + link.short + '</span>'
             : link.label) +
    '</a>').join("");
}

/* The row of link buttons under the corner title. A link with no href is not
   written, so the row empties and #tm-links:empty takes it off the page. */
const ICONS = {
  /* A glyph saying what the button will DO: going back, saving a file, leaving
     the site. Drawn at 24x24 and scaled by the stylesheet. "back" sits before
     its label, the other two after. */
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
  /* DOWNLOAD offers the drawing this page shows, so it is filled in from
     SETTINGS.mapFile. With no mapFile it is dropped like any link with no href. */
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
  // With no buttons the row takes no space; close the top band up to suit.
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
  // pin the artwork to its own coordinate system: 1 map unit = 1 pixel
  svg.setAttribute("width", mapW);
  svg.setAttribute("height", mapH);
  if (box.length !== 4) svg.setAttribute("viewBox", "0 0 " + mapW + " " + mapH);
  svg.removeAttribute("style");
  svg.id = "tm-mapArtwork";
  /* Looked up once here, not on every toggle. */
  wishfulArt = [];
  [SETTINGS.wishfulLayer, SETTINGS.branchLines].forEach(pick => {
    if (!pick) return;
    svg.querySelectorAll(pick).forEach(node => {
      if (wishfulArt.indexOf(node) < 0) wishfulArt.push(node);
    });
  });
  el("world").insertBefore(svg, el("trail"));
  mapSvg = svg;

  /* The satellite picture sits UNDER the artwork at exactly its size, so they
     register corner to corner. Switching the layer on hides the printed map
     (SETTINGS.satelliteHides); the route and waypoint circles are outside that
     group and stay on top. */
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

/* Walks any SVG path and returns points spaced evenly along its true length,
   in map coordinates, accounting for nested groups, transforms and clipping. */
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

/* ── THE PROPOSED ROUTES, AND WHERE THEY HANG ────────────────────────────
   A trail page walks ONE line, the built trail: scroll position is a single
   number, and once the geometry forks it cannot say where you are. But a drawing
   may carry proposals beside it (a bypass that rejoins, a spur that stops, a
   spur off a spur) with waypoints on them, whose cards still have to arrive in
   order. So each proposed line gets an ANCHOR WINDOW on what it hangs off, and a
   point on it maps back to the built route:

     LEAVES at 0.36 and REJOINS at 0.63: a waypoint 60% along sits at
         0.36 + 0.6 x (0.63 - 0.36) = 0.522, regardless of how far it bows out.
     LEAVES at 0.76 and STOPS: everything on it belongs to 0.76, so cards pile up
         there rather than appearing half a kilometre late.
     hanging off ANOTHER proposal: resolves through its parent first.

   THE TREE IS BUILT OUTWARD FROM THE BUILT ROUTE, never by asking each line what
   it is nearest: two proposals sharing a junction would become each other's
   parent. Breadth-first, so a line only anchors to something already placed. */
let branches = [];            // [{ id, node, path, along, length, parent, … }]

function walkOneLine(node) {
  const pts = walkPath(node, mapSvg, SETTINGS.pointSpacing);
  if (pts.length < 2) return null;
  const run = [0];
  for (let i = 1; i < pts.length; i++)
    run.push(run[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y));
  return { path: pts, along: run, length: run[run.length - 1] };
}

/* the closest point on one sampled line to a place on the map, as how far off
   it is and how far along it that is, 0 to 1 */
function closestOn(line, x, y) {
  let best = 0, gap = Infinity;
  for (let i = 0; i < line.path.length; i++) {
    const d = (line.path[i].x - x) ** 2 + (line.path[i].y - y) ** 2;
    if (d < gap) { gap = d; best = i; }
  }
  return { off: Math.sqrt(gap), at: line.along[best] / (line.length || 1), index: best };
}

function buildBranches() {
  branches = [];
  if (!mapSvg || !SETTINGS.branchLines) return;
  const found = Array.prototype.slice.call(mapSvg.querySelectorAll(SETTINGS.branchLines))
    .filter(n => typeof n.getTotalLength === "function");
  if (!found.length) return;

  /* the built route in the same shape as a branch, so one piece of code can
     measure against either */
  const mainLine = { id: "route", path: path, along: along, length: routeLength };
  const done = [mainLine];
  let waiting = found.map(node => {
    const line = walkOneLine(node);
    return line && Object.assign(line, { id: node.id || "(unnamed)", node: node });
  }).filter(Boolean);

  while (waiting.length) {
    /* whichever loose end is closest to anything already placed joins the tree
       next, at that end */
    let pick = null;
    waiting.forEach(line => {
      [0, 1].forEach(end => {
        const p = line.path[end ? line.path.length - 1 : 0];
        done.forEach(known => {
          const near = closestOn(known, p.x, p.y);
          if (!pick || near.off < pick.off)
            pick = { line: line, end: end, onto: known, at: near.at, off: near.off };
        });
      });
    });
    // and its OTHER end, against the same already-placed lines
    const far = pick.line.path[pick.end ? 0 : pick.line.path.length - 1];
    let other = null;
    done.forEach(known => {
      const near = closestOn(known, far.x, far.y);
      if (!other || near.off < other.off)
        other = { onto: known, at: near.at, off: near.off };
    });

    pick.line.joins  = { onto: pick.onto, at: pick.at, off: pick.off, end: pick.end };
    pick.line.rejoins = other.off <= SETTINGS.branchSnap ? other : null;
    if (pick.off > SETTINGS.branchSnap) {
      console.warn('The proposed line "' + pick.line.id + '" does not touch anything — ' +
        'its nearest end is ' + Math.round(pick.off) + ' units from ' + pick.joins.onto.id +
        '. Its waypoints will be placed at that end anyway. Move it closer to the ' +
        'line it leaves, or check it is meant to be a separate route.');
    }
    done.push(pick.line);
    branches.push(pick.line);
    waiting = waiting.filter(l => l !== pick.line);
  }

  if (SETTINGS.sayWhatItRead) branches.forEach(b => console.info(
    'proposed line "' + b.id + '" joins ' + b.joins.onto.id + ' at ' +
    b.joins.at.toFixed(3) + ' (' + b.joins.off.toFixed(1) + ' off)' +
    (b.rejoins ? ', rejoins ' + b.rejoins.onto.id + ' at ' + b.rejoins.at.toFixed(3)
               : ' — and stops')));
}

/* a fraction along any line, as a fraction along the BUILT route */
function ontoTheRoute(line, at, depth) {
  if (!line || line.id === "route" || (depth || 0) > 8) return at;
  const j = line.joins;
  if (!j) return at;
  if (j.end === 1) at = 1 - at;              // it joins by its far end, so it is walked backwards
  const from = ontoTheRoute(j.onto, j.at, (depth || 0) + 1);
  if (!line.rejoins) return from;            // a spur: everything on it happens where it leaves
  const to = ontoTheRoute(line.rejoins.onto, line.rejoins.at, (depth || 0) + 1);
  return from + (to - from) * at;
}

/* which line is this place on — the built route, or one of the proposals? */
function lineUnder(x, y) {
  let best = { line: null, off: Infinity, at: 0 }, second = Infinity;
  const mainLine = { id: "route", path: path, along: along, length: routeLength };
  [mainLine].concat(branches).forEach(line => {
    const near = closestOn(line, x, y);
    if (near.off < best.off) { second = best.off; best = { line: line, off: near.off, at: near.at }; }
    else if (near.off < second) second = near.off;
  });
  best.margin = second - best.off;
  return best;
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

/* THE MIDDLE OF A SHAPE IN THE ARTWORK, in the artwork's own coordinates. A
   circle inside a group Illustrator has transformed is not where its own
   numbers say, so its box is measured and put through the matrix between it and
   the drawing's root. Used for waypoint markers and height marks. */
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
   Every dot in the drawing whose name begins with the prefix, as { at, metres }:
   where along the route it sits and the height it states (see heightMarks in
   the settings). Each is hidden as it is read; the stylesheet hides them too,
   and this covers a stylesheet older than the engine. */
function readHeightMarks() {
  const prefix = SETTINGS.heightMarks;
  if (!prefix || !mapSvg) return [];
  const found = [];
  mapSvg.querySelectorAll('[id^="' + prefix + '"]').forEach(node => {
    /* The prefix is reserved: anything whose name begins with it is a height
       mark, is hidden, and is nothing else. One with no number (`h-todo`) is
       hidden and gives no height. */
    node.style.visibility = "hidden";
    /* THE NAME ILLUSTRATOR MEANT, not the one it settled for. Two objects
       cannot share a name, so a second h-30 is exported as id="h-301", which
       read as 301 metres and put a cliff in the profile. Illustrator usually
       writes the original into data-name, so that is read first. Otherwise
       use a name that cannot be misread: the number stops at the first
       non-digit, so h-30b is thirty metres. */
    const called = (node.dataset && node.dataset.name) || node.id;
    const said = /^(-?\d+(?:\.\d+)?)/.exec(called.slice(prefix.length));
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
  found.sort((a, b) => a.at - b.at);
  /* A WORD IF ONE IS WILDLY OUT OF LINE with the marks either side of it: a
     trail does not drop three hundred metres between marks four hundred apart
     and climb back. Usually a typo or Illustrator's rename above. It warns
     rather than corrects, since a real cliff is a real cliff. */
  found.forEach((m, i) => {
    const before = found[i - 1], after = found[i + 1];
    /* A MARK AT EITHER END has one neighbour, so there is no middle to be out
       of line with. The last mark is exactly where Illustrator's rename bites
       (a second h-30 at the end of a descent), so compare with the one it has. */
    if (!before || !after) {
      const only = before || after;
      if (only && Math.abs(m.metres - only.metres) > SETTINGS.heightMarkJump * 2)
        console.warn("The height mark at " + (m.at * 100).toFixed(0) + "% of the route reads " +
          m.metres + " m, next to one of " + only.metres + " m. If that is not a real cliff, " +
          "check whether two marks in the drawing share a name: Illustrator renames the " +
          "second, and h-30 becomes h-301, which reads as three hundred and one metres. " +
          "A letter on the end — h-30b — cannot be misread.");
      return;
    }
    const between = (before.metres + after.metres) / 2;
    const swing = Math.abs(m.metres - between);
    if (swing > SETTINGS.heightMarkJump && swing > Math.abs(before.metres - after.metres) * 2)
      console.warn("The height mark at " + (m.at * 100).toFixed(0) + "% of the route reads " +
        m.metres + " m, between neighbours of " + before.metres + " m and " + after.metres +
        " m. If that is not a real cliff it is probably a typo — or two marks in the " +
        "drawing share a name and Illustrator renamed one of them.");
  });
  return found;
}

function placeWaypoints() {
  const placed = [];
  WAYPOINTS.forEach(w => {
    let distance = null;
    let node = null;              // the shape in the artwork, if it has one
    let onLine = null;            // which drawn line it actually sits on
    let alongLine = 0;            // and how far along THAT line, 0 to 1
    let spot = null;              // and where its circle actually is

    /* THE MARKER IS READ WHETHER OR NOT THE PAGE ALSO STATES A FRACTION. The two
       answer different questions: the fraction says where in the walk, the
       circle where on the paper, and without the circle there is no ring to
       click and nothing for a card's line to point at. */
    if (w.marker && mapSvg) {
      node = mapSvg.querySelector(w.marker);
      if (node) { const q = centreOf(node); spot = { x: q.x, y: q.y }; }
      else console.warn('waypoint marker "' + w.marker +
                        '" is not in the artwork — skipping "' + w.title + '"');
    }

    if (typeof w.along === "number") {
      distance = clamp(w.along, 0, 1) * routeLength;
    } else {
      if (!spot && Array.isArray(w.at)) spot = { x: w.at[0], y: w.at[1] };
      if (!spot) return;
      /* WHICH LINE IS IT ON. A circle near the built route belongs to it; a
         circle out on a proposal belongs to that proposal, and its place in the
         walk is where that proposal hangs off the route (see ontoTheRoute).
         The margin is the distance to the SECOND-nearest line and is what
         decides whether a circle could have meant the other one; an ambiguous
         circle is worth saying out loud rather than resolving quietly. */
      const mine = lineUnder(spot.x, spot.y);
      onLine = mine.line;
      alongLine = mine.at;
      if (mine.off > SETTINGS.markerStray) console.warn(
        'The waypoint circle for "' + w.title + '" is ' + Math.round(mine.off) +
        ' units from any line. It has been placed on ' + mine.line.id + ' anyway.');
      if (mine.margin < mine.off * 2 && mine.margin < SETTINGS.markerStray) console.warn(
        'The waypoint circle for "' + w.title + '" is ' + mine.off.toFixed(1) +
        ' units from ' + mine.line.id + ' and only ' + (mine.off + mine.margin).toFixed(1) +
        ' from the next line along. Nudge it so it is clearly on one of them.');
      distance = clamp(ontoTheRoute(onLine, alongLine, 0), 0, 1) * routeLength;
    }

    const here = pointAt(distance);
    placed.push({
      title: w.title, text: w.text, metres: w.metres,
      /* THE NAME THIS STOP HAS IN A URL: the title unless the waypoint states
         one. Stating one keeps an old link working after retitling a stop. */
      slug: w.slug || slugify(w.title),
      kind: w.kind || "real",                 // "wishful" puts it on that layer
      /* WHAT IT WOULD TAKE, and how badly it is wanted: "low", "medium" or
         "high", only on a wishful stop, since an existing stop costs nothing. */
      cost: w.cost || "", priority: w.priority || "",
      mapLink: w.mapLink || "",               // the button at the foot of the card
      media: w.media || w.photo || null,      // one file, or a list of them
      marker: node,
      /* WHERE ITS RING IS DRAWN, which is not the same question as where it sits
         in the walk. A waypoint on a proposed line is met where that line
         leaves the trail (`distance`), but its ring belongs where it was
         drawn, or a purple card would point at a green kilometre. On the built
         route the two agree to within the couple of units the circle was drawn
         off the line. */
      x: spot ? spot.x : here.x, y: spot ? spot.y : here.y,
      offRoute: !!(onLine && onLine.id !== "route"),
      onLine: onLine ? onLine.id : "route", alongLine: alongLine,
      distance: distance, fraction: distance / routeLength
    });
  });
  placed.sort((a, b) => a.fraction - b.fraction);
  return placed;
}

/* A title as it appears in a URL: lower case, words joined by hyphens, nothing
   a browser would encode. Two stops on one trail with the same title would
   collide; the console says so at build time. */
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
  /* THE HEIGHTS THE DRAWING KNOWS, added to the waypoints'. A mark on top of a
     waypoint gives way to it: the typed height is the one shown on its card, so
     the profile must pass through it exactly. Elsewhere the marks fill in what
     a straight line between two waypoints only guessed. */
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

  // Smoothing also drags heights slightly off the typed waypoints. Measure the
  // drift at each and take it back out, so a waypoint reads exactly its number.
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
  /* Which way does this trail go overall: does it end lower than it began.
     Then one pass builds climbedTo[], the uphill so far at each point, so the
     readout looks up its position instead of re-adding the trail every frame. */
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
  buildBranches();            // the proposals beside it, and where they hang
  stops = placeWaypoints();
  buildHeights();

  /* Turn the route's measured length (map units, from buildRoute) into real
     distances. Everything showing a distance derives from these two lines, so
     the scale is decided once. Given trailLength, one map unit is trailLength
     / routeLength; given metresPerPixel, take it as stated. */
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
  /* The ring on the route and the name beside it are one element pinned to the
     waypoint, so the ring inherits what the chip has: it holds its size as the
     map zooms, opens the card when clicked, and goes with its layer. The page
     draws it itself because with the satellite layer on the artwork underneath
     is hidden. */
  document.documentElement.style.setProperty("--marker-size", SETTINGS.waypointSize + "px");
  /* NOUGHT MEANS "WHATEVER THE LINE IS". The ring, the line leaving it and the
     card's border are one object with one weight, written once in the
     stylesheet as --card-edge-w. A number here overrides it and puts the three
     out of step. A page that wants its own ring weight still gets it. */
  if (SETTINGS.waypointRing)
    document.documentElement.style.setProperty("--marker-ring", SETTINGS.waypointRing + "px");
  if (SETTINGS.waypointRingWish)
    document.documentElement.style.setProperty("--marker-ring-wish", SETTINGS.waypointRingWish + "px");

  /* ── THE RINGS FIRST, THEN ALL OF THE NAMES ──────────────────────────────
     As one element a later waypoint covered an earlier one, ring and name
     alike. A z-index cannot fix it (every chip has a transform, so is its own
     stacking context). So names are built in a SECOND PASS, after every ring,
     in the same container: document order is the one stacking rule a transform
     cannot overrule.                                                        */
  if (SETTINGS.showWaypointLabels || SETTINGS.drawWaypoints) {
    const wire = (node, s, i) => {
      if (s.kind === "wishful") node.classList.add("tm-wishful");
      node.style.left = s.x + "px";
      node.style.top  = s.y + "px";
      if (SETTINGS.cardsReopenOnClick) {
        node.title = WORDS.openCard;
        node.classList.add("tm-clickable");
        node.addEventListener("click", () => { byHand(); tapCard(i); });
      }
      chips.push(node);
    };
    stops.forEach((s, i) => {
      const chip = addChip("",
        (SETTINGS.drawWaypoints ? '<div class="tm-pin"></div>' : "") +
        (SETTINGS.showWaypointDots && !SETTINGS.drawWaypoints ? '<div class="tm-dot"></div>' : ""));
      chip.classList.add("tm-ringOnly");
      wire(chip, s, i);
      s.chip = chip;            // the ring: what a card is thrown from, and
                                // what the line from that card points at
    });
    if (SETTINGS.showWaypointLabels) stops.forEach((s, i) => {
      const tag = addChip("", '<div class="tm-tag">' + s.title + "</div>");
      tag.classList.add("tm-nameOnly");
      wire(tag, s, i);
      s.tag = tag;              // the name, in the layer above every ring
    });
  }
  const walker = addChip("walker", '<div class="tm-ring"></div><div class="tm-dot"></div>');

  /* ── where this trail meets another ────────────────────────────────────
     Each crossing is a small circle in the drawing, off to one side of the
     route on purpose so it never sits under a waypoint, and becomes a link to
     that trail's page. A crossing named in the page but missing from the
     drawing is skipped and reported, rather than placed at 0,0 where it would
     look like a map bug. */
  (PAGE.CROSSINGS || []).forEach((cross, n) => {
    if (!SETTINGS.crossings) return;
    const mark = mapSvg && mapSvg.querySelector(SETTINGS.crossingMark + (n + 1));
    if (!mark) {
      console.warn('The crossing "' + cross.label + '" has no ' +
                   SETTINGS.crossingMark + (n + 1) + " circle in the artwork, " +
                   "so it has not been placed.");
      return;
    }
    /* A LINK TO A TRAIL THAT DOES NOT EXIST IS A DIFFERENT KIND OF LINK. Where a
       trail meets a PROPOSAL the button is purple and belongs to the Wishful
       thinking switch, shown only while proposals are, since offering a trail
       the map is not admitting exists makes no sense. Written as `kind` on the
       crossing in trails_data.py, the same word waypoints use. */
    const wishful = cross.kind === "wishful";
    const box = mark.getBBox();
    const node = addChip("", '<a class="tm-cross' + (wishful ? " is-wishful" : "") +
      '" href="' + cross.href + '">' +
      '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor"' +
      ' stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
      '<path d="M9 7H6a4 4 0 0 0 0 8h3"/><path d="M15 7h3a4 4 0 0 1 0 8h-3"/>' +
      '<path d="M8 11h8"/></svg>' +
      '<span>' + cross.label + "</span></a>");
    node.classList.add("tm-crossing");
    if (wishful) {
      node.classList.add("tm-wishfulCross");
      crossingsWishful.push(node);
    }
    node.style.left = (box.x + box.width / 2) + "px";
    node.style.top  = (box.y + box.height / 2) + "px";
    chips.push(node);        // so it holds its size as the map zooms
  });

  /* ── THE LEFT RAIL AND ITS ONE PANEL ─────────────────────────────────────
     The two buttons are pinned to the rail and never move, and a single panel
     swaps its contents, so a button cannot end up beside the wrong panel (as
     per-panel tabs did on the main map). Pressing the button of the section
     already showing closes it. */
  let openPanel = null;                       // "legend", "layers" or null
  const anyWishful = stops.some(s => s.kind === "wishful");
  const wishfulLocked = SETTINGS.trailKind === "wishful";

  const panelFor = {
    legend: { title: WORDS.legendTitle, note: WORDS.legendNote, body: legendRows },
    layers: { title: WORDS.layersTitle, note: WORDS.layersNote, body: layerSwitches }
  };

  /* Each row's drawing is a file in the icon folder named after its `swatch`.
     A row whose file is missing keeps its label and shows nothing in the icon
     column, rather than the broken-image mark. */
  function legendRows() {
    return '<ul class="tm-legend">' + WORDS.legend.map(row =>
      '<li><img class="tm-sw" alt="" src="' + (SETTINGS.legendFolder || SETTINGS.iconFolder) + row.swatch +
      '.svg" data-swatch="' + row.swatch + '"><span>' + row.label +
      "</span></li>").join("") + "</ul>";
  }

  /* A missing icon is also reported in the console, since a silently blank
     legend is miserable to debug. One listener for the list; an <img> error
     does not bubble, hence the capture phase. */
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
    /* ON A WISHFUL TRAIL THE SWITCH IS LOCKED ON. It hides stops that are
       proposed rather than built, which means nothing where the entire route
       is proposed, and switching it off would blank the page's whole subject.
       The row still appears, so the panel does not differ between trails for
       no visible reason, but greyed out and unpressable. */
    if (anyWishful) rows.push(switchRow("wishful", WORDS.layerWishful,
                                        wishfulLocked ? WORDS.layerWishfulLocked
                                                      : WORDS.layerWishfulNote,
                                        wishfulOn, wishfulLocked));
    /* Always shown, always last: it is about how the page behaves, not what is
       drawn, but it is what a reader who wants the page to stop moving will
       look for, and the layers panel is where they will look. */
    if (SETTINGS.autoLoadSwitch)
      rows.push(switchRow("autoload", WORDS.layerAutoLoad,
                          autoLoadOn ? WORDS.layerAutoLoadOn : WORDS.layerAutoLoadOff,
                          autoLoadOn));
    if (SETTINGS.satelliteImage && satelliteOk)
      rows.push(switchRow("satellite", WORDS.layerSatellite,
                          WORDS.layerSatelliteNote, satelliteOn));
    return '<div class="tm-switches">' + rows.join("") + "</div>";
  }

  /* `locked` draws the row as a statement, not a control: greyed and disabled,
     which stops the click, so there is no second place to remember it. */
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
    // Opening: take `hidden` off first or there is nothing to animate. Closing:
    // leave it on until the fade ends; the listener below puts it back.
    if (openPanel) el("panel").hidden = false;
    el("panel").classList.toggle("is-open", !!openPanel);
    el("legendBtn").classList.toggle("is-on", openPanel === "legend");
    el("layersBtn").classList.toggle("is-on", openPanel === "layers");
    el("legendBtn").setAttribute("aria-expanded", openPanel === "legend");
    el("layersBtn").setAttribute("aria-expanded", openPanel === "layers");
    buildPanels();
  }

  /* Everything the switches control, in one place. Called whenever either
     changes, and once at the start so the page matches the switches even if
     SETTINGS set them differently. */
  applyLayers = function () {
    // the wishful stops: map circle, name chip, graph dot. Cards: onALiveLayer.
    stops.forEach((s, i) => {
      if (s.kind !== "wishful") return;
      if (s.marker) s.marker.style.display = wishfulOn ? "" : "none";
      /* ring and name are two elements in two layers, so both are asked;
         `chips` is not one entry per stop, so indexing it by stop would hide
         the wrong waypoint's ring */
      if (s.chip) s.chip.style.display = wishfulOn ? "" : "none";
      if (s.tag)  s.tag.style.display  = wishfulOn ? "" : "none";
    });
    document.querySelectorAll("#tm-profile .tm-wpdot.tm-wishful")
            .forEach(d => { d.style.display = wishfulOn ? "" : "none"; });

    /* and the purple links to proposed trails. display, not a fade: a pill
       fading in over a moving map reads as something loading. */
    crossingsWishful.forEach(node => {
      node.style.display = wishfulOn ? "" : "none";
    });

    /* The routes that do not exist yet, drawn in the artwork, belong to this
       switch as much as the purple waypoints: a proposal and the stop that
       explains it should never show without each other. They FADE rather than
       blink: the class does the work and the stylesheet the fade, and display
       is taken away only AFTER it finishes, so a hidden layer is out of the
       render tree and free. Coming back, display is restored first and the fade
       runs next frame, since a fade from display:none has nothing to fade. */
    wishfulArt.forEach(node => {
      if (wishfulOn) {
        node.style.display = "";
        node.classList.add("tm-fading");
        requestAnimationFrame(() => requestAnimationFrame(() =>
          node.classList.remove("tm-fading")));
      } else {
        node.classList.add("tm-fading");
        setTimeout(() => {
          if (!wishfulOn) node.style.display = "none";
        }, SETTINGS.wishfulFadeMs);
      }
    });
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
    /* The flat picture is a picture of the printed map, so it steps aside
       whenever the printed map is meant to be hidden. When standing in, the
       drawing is made invisible, not removed: everything else reads positions
       out of it. */
    if (flatPicture) {
      const useFlat = !showPhoto;
      flatPicture.style.display = useFlat ? "" : "none";
      mapSvg.style.visibility   = useFlat ? "hidden" : "";
    }
    // the page behind the map, the shading and the dotted line each have a
    // light and a dark version
    document.body.classList.toggle("tm-satellite", showPhoto);
    /* a layer change alters which names are on the map, and so which can be in
       each other's way when zoomed out */
    if (lensAt < 0.9995) untangleSoon();
  };

  /* ── where the rail of buttons stands on a phone ───────────────────────
     The card is anchored to the BOTTOM of its column, so its top edge differs
     from card to card (less text, shorter). The rail has to start below the
     lowest of those top edges or a card will cut a button in half. So it is
     measured: clear the offset, note where the rail sits, find the lowest card
     top, drop the rail by the difference. Two layout reads at startup and on a
     resize, nothing per frame; it follows changes to words and pictures. */
  function placeRail() {
    const rail = el("rail");
    if (!rail || !cards.length) return;
    rail.style.setProperty("--rail-drop", "0px");     // back to its natural place
    const here = rail.getBoundingClientRect();
    const column = el("cards").getBoundingClientRect();

    /* Only needed when the card column actually runs across the rail (the
       wide-card layout), asked of the real boxes rather than the window width
       so it holds whatever the breakpoint. */
    const overlaps = column.left < here.right && column.right > here.left;
    if (!SETTINGS.railBelowCardsOnPhone || !overlaps) {
      rail.style.removeProperty("--rail-drop");
      return;
    }

    /* NOT NEEDED ONCE CARDS OPEN COMPACT. This was written when a phone's card
       was the whole screen. A compact card is a strip along the bottom and the
       top, where the rail naturally stands, is left alone; dropping the rail
       from a place nothing covers would push it under the one thing that
       does. */
    if (shouldPeek()) {
      rail.style.removeProperty("--rail-drop");
      return;
    }

    /* Drop to the LOWEST top edge of the set: a shorter card starts further down
       and is the one that would cross a button. */
    let lowest = here.top;
    cards.forEach(card => {
      const box = card.getBoundingClientRect();
      if (box.height > 0 && box.top > lowest) lowest = box.top;
    });
    rail.style.setProperty("--rail-drop", Math.max(0, Math.round(lowest - here.top)) + "px");
  }

  /* ── flattening the artwork on a phone ─────────────────────────────────
     The map moves every frame and a drawing makes the phone re-trace every line
     each time; this artwork is mostly contour lines, the worst case. So the
     drawing is serialised, painted once into a canvas flattenWidth across, and
     the picture put in front of it, which is the same view for a fraction of the
     work. The drawing stays in the page, invisible, because the route,
     waypoints and layer switches use it. It stands aside while the satellite view
     is on (which hides the printed map). Preparing it takes about a second on a
     mid-range phone, so it runs after the page is usable, with the live drawing
     showing until it is ready. */
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
     already made the panel inert by then, so this is tidiness: genuinely
     display:none when shut. */
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
      reshapeTheCards();
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
  /* The layers panel always has Waypoint auto-load, so its button goes only if
     the panel would genuinely be empty. */
  el("layersBtn").hidden = !SETTINGS.showLayers ||
                           (!anyWishful && !SETTINGS.satelliteImage &&
                            !SETTINGS.autoLoadSwitch);
  el("legendBtn").querySelector(".tm-railName").textContent = WORDS.legendName;
  el("layersBtn").querySelector(".tm-railName").textContent = WORDS.layersName;
  el("legendBtn").title = WORDS.legendName;
  el("layersBtn").title = WORDS.layersName;
  el("panelClose").title = WORDS.closePanel;

  /* A wishful trail shows all of itself: the switch that would hide part of it
     is locked on, so a setting that starts it off is ignored rather than
     quietly leaving stops hidden with no way back. */
  wishfulOn   = (SETTINGS.trailKind === "wishful") || SETTINGS.wishfulOn !== false;
  satelliteOn = SETTINGS.satelliteOn === true;
  applyLayers();
  if (SETTINGS.openPanelAtStart) showPanel(SETTINGS.openPanelAtStart);

  /* a waypoint placed with a shape in the artwork has that shape clickable too,
     so clicking the dot on the map opens its card, not just the name chip */
  if (SETTINGS.cardsReopenOnClick) stops.forEach((s, i) => {
    if (!s.marker) return;
    s.marker.style.cursor = "pointer";
    s.marker.addEventListener("click", () => { byHand(); tapCard(i); });
  });

  /* which card is the visible one, and whether it has faded in far enough to
     count as on screen; used to decide which video should be playing */
  let frontCard = -1, frontShowing = false;
  /* which card's coin and dial have already been played (see the end of draw()) */
  let iconsPlayedFor = -1;

  /* ── THE WAYPOINT CARDS ──────────────────────────────────────────────────
     The cards themselves (picture, caption, paged text, facts, × and expand
     button) are in waypoint-card.js, shared with the main map. What stays here
     is the part a trail page does differently: WHEN a card is shown, which is
     the walk's business, worked out in draw() from where the reader has
     scrolled. Without waypoint-card.js there are no cards, so say why instead
     of leaving a blank column. */
  if (typeof window.HappyTrailsCards !== "function") {
    giveUp("This page needs <code>waypoint-card.js</code>, which is not "
           + "there. It sits beside <code>trail-engine.js</code> and holds "
           + "the waypoint cards; upload the two together.");
    return;
  }

  /* WHAT A LINK TO EACH WAYPOINT LOOKS LIKE, worked out once and handed to the
     cards, which cannot know it: on the main map a waypoint's address is on a
     different page. */
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
    onClose:  i => { byHand(); putAway(i); },
    onOpen:   i => openCard(i),
    /* WHAT A TRAIL PAGE HOLDS STILL while a card is expanded: its own scroll.
       Scrolling is walking, and someone reading closely is not walking. */
    onBig:    on => {
      heldAt = window.scrollY;
      /* AND THE LAST READING OF THE SCROLL IS TAKEN NOW: nothing else takes one
         until the card is put back (see nudge), and a link that jumped to this
         waypoint a moment ago has only just changed it, so without this the map
         would draw the place the reader came from. */
      if (on) wanted = scrolled();
    },
    wake:     () => wake(),
    onAMeteredLine: onAMeteredLine,
  });

  /* A CARD UNFOLDING CHANGES WHAT THE LOOP SHOULD DRAW (the zoom controls step
     aside) and the loop sleeps when nothing moves. One word from the card wakes
     it; the next frame reads the classes itself. */
  el("cards").addEventListener("card:grew", () => wake());
  const cards       = deck.cards;

  /* ── AND WHENEVER A CARD CHANGES SIZE, THE LINE IS REDRAWN ───────────────
     The line from a card meets the middle of one of its edges, and a card
     changes size more often than it looks (compact fold, Open, a picture of a
     different aspect, a resize). A word at the START of a grow is not enough:
     the grow is a CSS transition the loop sleeps through, so the line would
     detach from an edge no longer there. A ResizeObserver fires all the way
     through, so the line stays joined at every size. It only wakes the loop;
     what to draw is worked out afresh next frame. */
  if (window.ResizeObserver) {
    const watchSizes = new ResizeObserver(() => wake());
    watchSizes.observe(el("cards"));
    cards.forEach(card => watchSizes.observe(card));
  }

  /* ── PRESSING A CARD BEHIND THE FRONT ONE BRINGS IT FORWARD ──────────────
     One listener on the column, since waypoint-card.js builds the cards. It
     fires only on a card marked as BEHIND another; everything else falls
     through to the card's own buttons. It takes the same road as a click on a
     waypoint ring, so a promoted card is held open like one opened by hand. */
  el("cards").addEventListener("click", e => {
    const card = e.target.closest(".tm-card");
    if (!card || !card.classList.contains("is-behind")) return;
    const i = cards.indexOf(card);
    if (i < 0) return;
    e.preventDefault();
    e.stopPropagation();
    byHand();
    openCard(i, false, false);
  }, true);

  const playTheRightVideo = deck.playTheRightVideo;
  const setBig      = deck.setBig;
  const roomToGrow  = deck.roomToGrow;

  /* the walk asks the deck rather than holding this itself */
  const bigOn = () => deck.isBig();
  let heldAt = 0;                 // the scroll position the walk is left at

  /* Each card carries three pieces of state:
       shownness  0 to 1, the fade the × button and a click drive; it multiplies
                  with the scroll-driven fade, so closing looks the same anywhere
       closed     the reader pressed ×; stays down until the walk leaves the
                  card's stretch of scroll
       held       the reader clicked this waypoint on the map; the card ignores
                  the scroll until they close it or the walk reaches the next
                  waypoint                                                     */
  const cardState = stops.map(() => ({ shownness: 1, closed: false, held: false }));

  /* ── STATE THE DRAWING LOOP TOUCHES GOES ABOVE THE DRAWING LOOP ───────────
     `let` is not hoisted, and draw() runs on the FIRST FRAME, before the file
     has finished being read. Declared beside the function that uses it, the
     page dies on load with "Cannot access 'leaderPen' before initialization"
     and the trail is blank. This has happened four times (lensAt, leaderAt,
     leaderPen), so everything the loop touches is declared here.

     leaderPen is the leader line's pen. The line's other state lives in
     leader-line.js with the drawing. */
  let leaderPen = null;
  /* THE STATE BEHIND putAway(), declared here for the reason above: a token
     bumped by every open, so a close waiting for the line finds itself out of
     date; and whether a card is on its way out. */
  let closeToken = 0, closePending = false;


  /* set by draw() when any card is mid-fade, so the loop keeps running though
     the page is not being scrolled */
  let cardsMoving = false;

  /* where the walking point is being framed, eased towards where the
     look-ahead says (see draw()) */
  let frameX = 0.5, frameY = 0.5;
  let compassLean = 0;
  const compassArrow = el("compass") && el("compass").querySelector("svg");

  /* true while somebody drags the elevation graph's knob (see draw()) */
  let scrubbing = false;

  /* ── SETTLING A HALF-FADED CARD ─────────────────────────────────────────
     draw() says which card is caught half-way in (halfShownStop); this waits
     until nobody has touched the page for settleAfterMs, then eases onto that
     card's waypoint. The glide is its own few frames of scrolling, not the
     browser's smooth scroll, so it is dropped the instant the reader does
     anything and nothing coasts underneath them. */
  let halfShownStop = -1, settleTimer = 0, settling = 0, lastTouchedAt = 0;
  const touched = () => {
    lastTouchedAt = performance.now();
    if (settling) { cancelAnimationFrame(settling); settling = 0; settleTimer = 0; }
  };
  ["wheel", "touchstart", "touchmove", "keydown", "pointerdown"].forEach(type =>
    addEventListener(type, touched, { passive: true, capture: true }));
  /* the page's own scroll counts as the reader too, except what this does itself */
  addEventListener("scroll", () => { if (!settling) lastTouchedAt = performance.now(); },
                   { passive: true });

  function settleOnto() {
    settleTimer = 0;
    if (halfShownStop < 0) return;
    const quietFor = performance.now() - lastTouchedAt;
    if (quietFor < SETTINGS.settleAfterMs) {        // they were still at it
      settleTimer = setTimeout(settleOnto, SETTINGS.settleAfterMs - quietFor);
      return;
    }
    /* TO THE NEAREST WAYPOINT by distance on the page: usually the half-shown
       card's own, or the next one if the reader stopped just short of it (a
       shorter glide, and the card they were heading for). Either way the card in
       front ends fully shown. */
    const from = window.scrollY;
    let i = halfShownStop, best = Infinity;
    liveStops().forEach(k => {
      const far = Math.abs(pageAtStop(k) - from);
      if (far < best) { best = far; i = k; }
    });
    const gap = pageAtStop(i) - from;
    if (Math.abs(gap) < 2) return;
    const still = window.matchMedia &&
                  window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (still) { window.scrollTo(0, from + gap); return; }
    const began = performance.now();
    const step = now => {
      const f = Math.min(1, (now - began) / SETTINGS.settleMs);
      const e = f < 0.5 ? 2 * f * f : 1 - Math.pow(-2 * f + 2, 2) / 2;   // in and out
      window.scrollTo(0, Math.round(from + gap * e));
      if (f < 1) { settling = requestAnimationFrame(step); return; }
      settling = 0;
    };
    settling = requestAnimationFrame(step);
  }

  /* WHICH WAYPOINT THE WALK WAS STANDING AT when a card was last opened by hand,
     and the one it is at now: together they let a clicked card stay open (see
     where draw() lets a held card give way). */
  let arrivedAt = -1, heldFrom = -2;

  /* ── A PERSON JUST DID SOMETHING ────────────────────────────────────────
     Called from handlers of real events (click, key, drag), never from an API
     call: the tour opens and closes cards through the same functions a person
     does and must not stop itself. The tour listens and gets out of the way. */
  function byHand() { document.dispatchEvent(new CustomEvent("trail:handover")); }

  /* A CARD BEING SHOVED ASIDE BY THE NEXT ONE: { out, in, at }, how far through
     the shove, 0 to 1. Null when no swap is happening, which is nearly always. */
  let swapping = null;

  function closeCard(i) {
    closePending = false;
    cardState[i].closed = true;
    cardState[i].held = false;
    /* AND IT FORGETS THAT IT WAS OPENED OUT: a compact card unfolded then put
       away is compact next time, as it was the first time. */
    if (deck && deck.cards[i]) deck.cards[i].classList.remove("is-grown");
    // A CARD ALWAYS COMES BACK SMALL. Closing puts the view back at the same
    // time, quietly: an expensive-looking shrink under a fade reads as a glitch.
    if (bigOn()) setBig(false, i, true);
    wake();
  }

  /* WHETHER THIS CARD SHOULD OPEN FOLDED. Asked at the moment of opening, so
     turning auto-load off, or a phone turned wide enough for a full card, takes
     effect on the next waypoint rather than the next page load. */
  function shouldPeek() {
    if (!SETTINGS.peekCards || !deck || !deck.peek) return false;
    if (document.body.classList.contains("tm-touring")) return false;
    if (SETTINGS.peekWithAutoLoadOff && !autoLoadOn) return true;
    if (!SETTINGS.peekOnAPhone) return false;
    return !!(window.matchMedia &&
              window.matchMedia("(max-width: " + SETTINGS.phoneWidth + "px)").matches);
  }

  /* `full` is for a card asked for by NAME (a click on a chip or map mark):
     always the whole card, on any screen. The compact card is for waypoints the
     walk brings up itself, and for the arrows.

     ── WHAT THE AUTO-LOAD SWITCH MEANS ─────────────────────────────────────
     Cards ALWAYS come up as the walk reaches them; the switch decides their
     SHAPE: on, full; off, compact (says where you are, leaves the map alone). A
     phone always gets compact. Flipping it reshapes every card at once, the one
     in front included, except one the reader opened out themselves. */
  function reshapeTheCards() {
    if (!deck || !deck.peek) return;
    const small = shouldPeek();
    deck.cards.forEach(card => {
      if (card.classList.contains("is-grown")) return;
      deck.peek(card, small);
    });
  }

  function openCard(i, quietly, full) {
    // asked for again: whatever was about to be put away is not, and a line
    // that had been told to leave stays
    closeToken++;
    closePending = false;
    if (leaderPen) leaderPen.cancel();
    const wasFront = frontCard;
    /* FOLDED OR NOT, decided here and applied before the card is shown, so it
       never appears at full height and then collapses. Every other card is
       folded back at the same time so it opens small next time. */
    if (deck && deck.peek) {
      const small = shouldPeek();
      deck.cards.forEach((card, k) => {
        /* THE ONE CARD NOT REFOLDED is the one just opened out by its own
           button. That click carries on up to the card, which the page reads as
           "open this waypoint" and answers by calling this function; without
           this line the same click folded the card straight back. `is-grown`
           is cleared when the card closes. */
        if (k === i && card.classList.contains("is-grown")) return;
        deck.peek(card, small);
      });
      /* asked for by name, it opens whole. `is-grown` rather than simply not
         folding it, because is-grown is what every other part of the page reads
         as "opened out on purpose, leave it be" (including the loop's folding
         of hidden cards). */
      if (full && small && deck.cards[i]) {       // only where cards open compact
        deck.peek(deck.cards[i], false);
        deck.cards[i].classList.add("is-grown");
      }
    }
    // where the walk was standing when this was asked for — see draw()
    heldFrom = arrivedAt;
    cardState.forEach((state, k) => {
      state.held = (k === i);          // only ever one card held open
      if (k === i) state.closed = false;
    });
    wake();

    /* A CARD ARRIVES THE WAY EVERY CARD ARRIVES: fading and rising, driven by
       `shownness` in the drawing loop (throwing it out of the waypoint's circle
       fought that rise and left a hop). `quietly` is the tour's, and tells the
       swap below not to treat a tour step as a change of mind. When a click
       replaces one card with another the outgoing one is shoved aside (see
       `swapping`), only for a card opened BY HAND. */
    if (!quietly && wasFront >= 0 && wasFront !== i) swapping = { out: wasFront, in: i, at: 0 };
  }

  /* A CLICK ON A WAYPOINT'S CHIP OR MARK is a toggle: on the one whose card is
     up it puts the card away; on any other it swaps to that one, wherever the
     walk is. The exception: a card up in its COMPACT shape is opened out
     instead, because the reader clicked to see what is there and a strip with a
     title on it is not that. */
  function tapCard(i) {
    const card = deck && deck.cards[i];
    // a card already on its way out is not 'up': pressing it again brings it back
    const upNow = frontCard === i && !cardState[i].closed && !closePending;
    if (upNow && !(card && card.classList.contains("is-peek"))) putAway(i);
    else openCard(i, false, true);
  }

  /* EVERY CARD SHUT, whatever opened it. Escape does this, and so does the tour
     when it finishes. */
  function closeAllCards() {
    closePending = false;
    if (bigOn()) setBig(false, undefined, true);
    if (deck) deck.cards.forEach(card => card.classList.remove("is-grown"));
    cardState.forEach((state, i) => { state.held = false; state.closed = true; });
    wake();
  }

  /* ── PUTTING A CARD AWAY WITH THE LINE GOING FIRST ──────────────────────
     The line draws itself back into its waypoint, THEN the card goes.
     closeCard/closeAllCards are the instant ones (the tour finishing, a jump);
     these are what a person's closing goes through. `full` waits for the whole
     retraction (the tour); by hand the card follows after leaderOutLead. A TOKEN
     guards against the card being asked for again while the line leaves:
     opening bumps it and a close with a stale token does nothing. */
  function lineLeaves(full) {
    if (!leaderPen || !leaderPen.drawn()) return Promise.resolve();
    const gone = leaderPen.retract(full ? 1 : SETTINGS.leaderOutLead);
    wake();                    // the loop is what draws the retraction
    return gone;
  }
  function putAway(i, full) {
    const token = ++closeToken;
    closePending = true;
    return lineLeaves(full).then(() => { if (token === closeToken) closeCard(i); });
  }
  function putAwayAll(full) {
    const token = ++closeToken;
    closePending = true;
    return lineLeaves(full).then(() => { if (token === closeToken) closeAllCards(); });
  }

  /* ── HOLDING THE WALK STILL WHILE A CARD IS OPEN ────────────────────────
     Scrolling is walking, and the smallest scroll would carry the card being
     read off the screen, so while the big view is up everything that scrolls is
     refused: the wheel, the keys, and anything else (middle-click drag, find-on-
     page) by putting the page back. NOT overflow:hidden: that removes the
     scrollbar, widening the window fifteen pixels, and the map jumps sideways
     mid-animation. */
  const SCROLL_KEYS = [" ", "PageUp", "PageDown", "Home", "End",
                       "ArrowUp", "ArrowDown"];
  addEventListener("wheel", e => { if (bigOn()) e.preventDefault(); },
                   { passive: false });
  addEventListener("touchmove", e => { if (bigOn()) e.preventDefault(); },
                   { passive: false });
  /* ESCAPE PUTS AWAY WHATEVER IS IN FRONT OF THE MAP, one layer at a time: an
     expanded card shrinks first (below), then Escape shuts every card. It is
     registered before the handler below so the two cannot both fire on one
     press. */
  addEventListener("keydown", e => {
    if (e.key !== "Escape" || bigOn()) return;
    if (openPanel) return;              // a panel has first claim on Escape
    putAwayAll();
  });

  addEventListener("keydown", e => {
    if (!bigOn()) return;
    if (e.key === "Escape") { setBig(false); return; }
    // not the arrows inside the card: the before/after slider uses them
    const inTheCard = e.target && e.target.closest && e.target.closest(".tm-card");
    if (!inTheCard && SCROLL_KEYS.indexOf(e.key) >= 0) e.preventDefault();
  });
  addEventListener("scroll", () => {
    if (bigOn() && Math.abs(window.scrollY - heldAt) > 1) window.scrollTo(0, heldAt);
  }, { passive: true });

  // clicking the veil is the other way out, and the one people try first
  el("cardveil").addEventListener("click", () => setBig(false));

  /* A window too small for the big view puts it back rather than leaving a card
     wider than the screen. */
  addEventListener("resize", () => { if (bigOn() && !roomToGrow()) setBig(false, -1, true); });

  /* elevation strip */
  // GRAPH_W and GRAPH_H are the graph's own drawing box; the stylesheet
  // stretches it, so they never change
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
      /* One dot per waypoint, from the same `stops` list as the cards and map
         pins, so moving a waypoint moves its dot. Like the knob below they sit
         outside the SVG so they stay round.

         EXCEPT A WAYPOINT NOT ON THIS ROUTE. The graph is the GROUND ALONG THE
         BUILT TRAIL, and a dot claims a height at a distance. A stop out on a
         proposal has neither (somewhere else, at an unsurveyed height), and
         four of them on one bend crowded the strip with untrue claims. They
         keep their ring and card; they just are not on the graph. */
      stops.filter(s => !s.offRoute).map(s =>
        '<div class="tm-wpdot' + (s.kind === "wishful" ? ' tm-wishful' : '') +
        '" title="' + s.title + '" style="left:' +
        (s.fraction * 100).toFixed(3) + '%;top:' +
        (graphY(s.metres) / GRAPH_H * 100).toFixed(3) + '%"></div>').join("") +
      // The knob sits outside the SVG: the graph is stretched to fit, so a circle
      // inside would come out a flat oval, while a plain element in percentages
      // stays round.
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

  /* ── holding the page still under the reader ────────────────────────────
     On a phone the address bar slides away on scroll down and back on scroll up,
     changing the window height by 60-100px. A page measured in screenfuls is
     re-measured each time and jumps by about twelve screenfuls mid-gesture;
     progress is scroll position as a SHARE of the page, so the walk stutters
     backwards and the map lurches. So the height is measured once, in pixels. A
     GENUINE resize still re-measures: an address bar is a height change under
     bigResizePx with the width unchanged; anything else is real. */
  let lockedTo = { w: 0, h: 0 };

  /* ── AND THE OTHER HALF OF THE SAME JITTER ───────────────────────────────
     Progress is scrollY over (document height - window height), and the window
     height is what an address bar changes: sixty pixels off the distance to
     scroll moves the walk a percent with the page not moved. So that span is
     measured once, when the height is locked, in a frame of its own because
     --scroll-length has just changed and the document is not yet laid out. */
  let scrollSpan = 0;
  function measureTheSpan() {
    scrollSpan = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
  }

  function lockTheScroll() {
    if (!SETTINGS.lockPageHeight) {
      document.documentElement.style.setProperty("--scroll-length", SETTINGS.pageHeight + "vh");
      requestAnimationFrame(measureTheSpan);
      return;
    }
    const w = window.innerWidth, h = window.innerHeight;
    const widthChanged  = w !== lockedTo.w;
    const heightJumped  = Math.abs(h - lockedTo.h) > SETTINGS.bigResizePx;
    if (!widthChanged && !heightJumped) return;      // just the address bar
    lockedTo = { w: w, h: h };
    document.documentElement.style.setProperty(
      "--scroll-length", Math.round(h * SETTINGS.pageHeight / 100) + "px");
    requestAnimationFrame(measureTheSpan);
  }
  lockTheScroll();
  /* the artwork and fonts can still change the document's height; one more look
     once the page has settled costs nothing */
  measureTheSpan();
  addEventListener("load", () => requestAnimationFrame(measureTheSpan));
  nameTheClimb();                 // now that we know which way the trail runs
  el("closingTotal").innerHTML  = perMetre ? (realLength / 1000).toFixed(1) + "<i>" + WORDS.km + "</i>"
                                           : Math.round(routeLength) + "<i>" + WORDS.units + "</i>";
  el("closingAscent").innerHTML = !haveHeights ? "—"
    : (downhillTrail ? signed(path[path.length - 1].metres - path[0].metres)
                     : Math.round(totalClimb)) + "<i>" + WORDS.metres + "</i>";
  el("closingHigh").innerHTML   = haveHeights ? Math.round(highest)    + "<i>" + WORDS.metres + "</i>" : "—";

  /* ── the loop: scroll position in, map position out ──────────────────── */
  let wanted = 0, shown = 0, ticking = false, lastFrame = 0, reading = false;
  /* whether the band along the bottom (numbers, graph, arrows) is up; kept
     here because the walking "scroll for more" prompt asks from outside draw() */
  let bandUp = false;
  /* which stop the address currently names, and what keeps it current (a no-op
     when linking is off) */
  let named = -1, followTheWalk = () => {};

  /* what the last frame worked out, so this one can skip what has not moved */
  let lastZoom  = -1;            // the zoom the line weights were sized for
  let graphUpTo = -1;            // the step the elevation line was built up to
  let graphSoFar = "";           // and the line itself, up to that step

  /* scrollSpan rather than the live sum: see "the other half of the same jitter" */
  const scrolled = () => (scrollSpan > 0 ? clamp(window.scrollY / scrollSpan, 0, 1) : 0);
  const wholeMapZoom = () =>
    Math.min(stageW() / mapW, stageH() / mapH) * SETTINGS.overviewFit;

  /* ---- the stages of the page, measured in walks -------------------------
     Turning a swoop off removes its scrolling rather than leaving a dead
     stretch of page.                                                        */
  const swoopIn  = SETTINGS.zoomOutAtStart ? SETTINGS.zoomInOver  : 0;
  /* ── THE PULL-BACK AT THE FINISH IS NOT DONE ON A HANDHELD ───────────────
     Rescaling the whole drawing over a stretch of scroll is a slow reveal on a
     desktop but a stutter on a phone, which also hides and shows its address bar
     meanwhile. Nothing is lost: the band still fades out, which is what says the
     walk is over, and the scroll it used goes too (swoopOut is 0). Asked of the
     DEVICE (see isHandheld()), so a landscape tablet is covered. */
  const pullOutHere = SETTINGS.zoomOutAtEnd &&
                      !(isHandheld() && SETTINGS.noPullBackOnAPhone);
  const swoopOut = pullOutHere ? SETTINGS.zoomOutOver : 0;

  const walkFrom = SETTINGS.openingHold + swoopIn;   // the first step
  const walkTo   = walkFrom + 1;                     // the last step, 100%
  const pulledOut = walkTo + swoopOut;               // the map is wide again
  const pageSpan  = pulledOut + SETTINGS.closingHold;

  /* draw() is handed the raw scroll position (0 top, 1 bottom) and the
     milliseconds since the last frame. */
  function draw(atPage, sinceLastFrame) {
    // where we are down the page, counted in walks
    const down = atPage * pageSpan;

    // how far along the trail that puts us: 0 through the opening hold and
    // fly-in, pinned at 1 from the last step on, which keeps the swoops out of
    // the walk's way
    const p = clamp(down - walkFrom, 0, 1);

    // How far pulled out, 0 = standing on the trail, 1 = whole map. The fly-in
    // is held wide while the opening screen is up and eases out across its
    // swoop; the pull-back eases in once the trail reads 100%. With
    // zoomOutAtStart off the page opens standing at the first step.
    const flyIn  = SETTINGS.zoomOutAtStart
                 ? 1 - slide(SETTINGS.openingHold, walkFrom, down, SETTINGS.zoomEase) : 0;
    const flyOut = pullOutHere
                 ? slide(walkTo, pulledOut, down, SETTINGS.zoomEase) : 0;
    const here = Math.max(flyIn, flyOut);
    const spot = pointAt(p * routeLength);
    const walkZoom = isPhone() ? SETTINGS.zoomWalkingPhone : SETTINGS.zoomWalking;
    const zoom = mixZoom(walkZoom, wholeMapZoom(), here);

    /* ── WHERE THE WALKING POINT SITS ON THE SCREEN ────────────────────────
       Not the middle, which is as close to the card as it can be without being
       under it. So the page LOOKS AHEAD, sampling the trail a little in front:
       going mostly ACROSS (Beltline) the point sits well left, leaving the right
       to the card; going mostly DOWN (Humber, Don) a little left and well UP,
       since the tall card wants the bottom right. It blends by how horizontal the
       direction is, and is EASED: per-frame answers would twitch at every kink,
       while slow drift is the camera movement nobody notices and everybody
       feels. */
    if (SETTINGS.lookAhead) {
      const on = p * routeLength;
      const ahead = pointAt(Math.min(routeLength, on + routeLength * SETTINGS.lookAheadBy));
      const back  = pointAt(Math.max(0, on - routeLength * SETTINGS.lookAheadBy * 0.4));
      const dx = ahead.x - back.x, dy = ahead.y - back.y;
      const run = Math.hypot(dx, dy) || 1;
      // 1 = travelling straight across the page, 0 = straight down it
      const across = Math.abs(dx) / run;
      const wantX = mix(SETTINGS.frameDownX, SETTINGS.frameAcrossX, across);
      const wantY = mix(SETTINGS.frameDownY, SETTINGS.frameAcrossY, across);
      /* eased in real time, so it takes frameEaseMs whatever the frame rate */
      const step = Math.min(1, Math.max(1, sinceLastFrame) / Math.max(1, SETTINGS.frameEaseMs));
      frameX += (wantX - frameX) * step;
      frameY += (wantY - frameY) * step;
    } else {
      frameX = 0.5; frameY = 0.5;
    }

    // the point lands where the framing asks, easing to the middle of the whole
    // map during the pull-back, where framing means nothing
    const offX = (frameX - 0.5) * stageW();
    const offY = (frameY - 0.5) * stageH();
    let midX = mix(spot.x - offX / zoom, mapW / 2, here);
    let midY = mix(spot.y - offY / zoom, mapH / 2, here);
    /* On a phone the card covers the lower half, so the point is lifted above
       centre. Once pulled back there is no card or walker, so the lift eases
       away and the map ends up centred. */
    const lift = isPhone()
               ? Math.round(stageH() * SETTINGS.raisePointOnPhone * (1 - here)) : 0;

    /* ---- keep the paper under the window --------------------------------
       midX/midY is the map point under the middle of the screen. Where the
       drawing is bigger than the window the centre is held far enough from each
       edge that the window stays on the paper; where smaller (the pull-back)
       there is nothing to clamp to and the map is centred. The lift makes the
       two vertical halves unequal, so they are worked out separately. */
    if (SETTINGS.keepInsideEdges) {
      const halfW  = stageW() / 2 / zoom;
      const above  = (stageH() / 2 - lift) / zoom;
      const below  = (stageH() / 2 + lift) / zoom;
      const wantX = midX, wantY = midY;
      midX = mapW * zoom >= stageW() ? clamp(midX, halfW, mapW - halfW) : mapW / 2;
      midY = mapH * zoom >= stageH() ? clamp(midY, above, mapH - below)
                                     : mapH / 2 - lift / zoom;
      /* ── ONLY WHILE THE WALK IS FINDING ITS PLACE ────────────────────────
         Holding the paper against the window is right at the START, where the
         route begins near an edge. Elsewhere the clamp slides the walking point
         towards the nearest corner (late in a trail, the cards' corner, putting
         rings under their own cards) and drifts. So it applies over the opening
         and lets go for good after holdEdgesUntil. */
      const letGo = SETTINGS.holdEdgesUntil > 0
                  ? ramp(SETTINGS.holdEdgesFrom, SETTINGS.holdEdgesUntil, p) : 1;
      if (letGo > 0) { midX = mix(midX, wantX, letGo); midY = mix(midY, wantY, letGo); }
    }

    world.style.transform =
      "translate(" + (stageW() / 2) + "px," + (stageH() / 2 - lift) + "px)" +
      " scale(" + zoom + ") translate(" + (-midX) + "px," + (-midY) + "px)";

    /* Line weights, dash patterns and chip sizes are "per zoom": they divide by
       it to hold their size on screen. During the walk the zoom does not change,
       and writing them anyway costs a style change per SVG element plus a loop
       over the chips, so it is done once and then only when the zoom moves.

       THE SIZE THINGS ARE SEEN AT includes the reader's own zoom-out, which
       shrinks everything inside the lens; without it, stepping back made the
       trail a hairline and the names unreadable. */
    const seen = zoom * lensAt;

    /* THE SIZE THEY ARE DRAWN AT is not quite the same number: which scale
       everything divides by decides how much of the reader's step back it
       follows (see furnitureFollowsZoomOut). At the walk's own view lensAt is 1
       and the two agree, so walking is unchanged. */
    const follow = isPhone() ? SETTINGS.furnitureFollowsZoomOutOnPhone
                             : SETTINGS.furnitureFollowsZoomOut;
    const drawnAt = zoom * Math.pow(lensAt, 1 - follow);

    if (seen !== lastZoom) {
      lastZoom = seen;
      el("trailOutline").style.strokeWidth = (SETTINGS.trailWidth + SETTINGS.trailOutlineExtra) / drawnAt;
      el("trailAhead").style.strokeWidth   = (SETTINGS.trailWidth * SETTINGS.trailAheadWidth) / drawnAt;
      el("trailWalked").style.strokeWidth  = SETTINGS.trailWidth / drawnAt;
      el("trailAhead").style.strokeDasharray = (SETTINGS.trailWidth * SETTINGS.trailAheadDot / drawnAt) +
                                         " " + (SETTINGS.trailWidth * SETTINGS.trailAheadGap / drawnAt);
      el("trailWalked").style.strokeDasharray = drawLength;
      /* Chips hold their size on screen whatever the zoom, right while walking but
         wrong pulled out to the whole map, where a dozen phone-sized rings cover
         what they mark. So they also shrink towards the finish. */
      chipShrink = 1 - here * SETTINGS.pinShrinkOnPullBack;
      /* THE RIDER'S OWN PIXEL SIZE: this scale and the shrink together.
         cyclist.js turns a distance along the trail into a wheel rotation and
         needs it in the units the wheel is drawn in (see zoomNow()). */
      riderScale = drawnAt / (chipShrink || 1);
      const hold = "scale(" + ((1 / drawnAt) * chipShrink) + ")";
      for (let i = 0; i < chips.length; i++) chips[i].style.transform = hold;
      walker.style.transform = hold;
      /* the scale changed, so which names overlap may have too (see
         untangleChips()); nothing to do at the walk's own view */
      if (lensAt === lensWant && (lensAt < 0.9995 || lastUntangledOut)) { lastUntangledOut = lensAt < 0.9995; untangleSoon(); }
    }
    // the walked part is revealed by pulling back a dash the length of the line
    el("trailWalked").style.strokeDashoffset = drawLength * (1 - p);

    /* ── AND THE COMPASS LEANS INTO THE WALK ───────────────────────────────
       A degree and a half in the direction the trail is going. Too small to
       read as information and not meant to; it is there because a compass
       perfectly rigid on a page where everything moves looks painted on. */
    if (SETTINGS.compassSway && compassArrow) {
      const leanTo = clamp((frameX - 0.5) * SETTINGS.compassSway, -3, 3);
      compassLean += (leanTo - compassLean) *
        Math.min(1, Math.max(1, sinceLastFrame) / 500);
      compassArrow.style.transform = "rotate(" + compassLean.toFixed(2) + "deg)";
    }

    walker.style.left = spot.x + "px";
    walker.style.top  = spot.y + "px";
    walker.style.opacity = (1 - here * 0.65).toFixed(2);

    /* The name beside each waypoint holds its size on screen, wrong once the
       whole map is in view, where a dozen full-size labels cover what they
       label. They fade with the pull-back; one custom property on their shared
       parent does all of them. */
    el("labels").style.setProperty("--tag-fade",
      Math.max(0, 1 - here * SETTINGS.tagFadeOnPullBack).toFixed(3));

    /* The readouts: text that has not changed still costs a parse and layout if
       written again, so say() writes only when the words differ. */
    if (perMetre) say("valDistance", (p * realLength / 1000).toFixed(2), WORDS.km);
    say("valComplete", String(Math.round(p * 100)), WORDS.percent);

    if (haveHeights) {
      say("valElevation", String(Math.round(spot.metres)), WORDS.metres);
      /* Uphill so far, or on a trail that ends lower than it starts the net
         change from the trailhead (negative). climbedTo[] is the running total,
         worked out once when the route was measured. */
      say("valAscent",
          downhillTrail ? signed(spot.metres - path[0].metres)
                        : String(Math.round(climbedTo[spot.index] || 0)),
          WORDS.metres);

      /* The walked part of the graph is the profile up to a whole step plus one
         short line to exactly where you are. Only that last line changes between
         frames; the long part changes a few hundred times over the whole page,
         so it is remembered and rebuilt only when its step has moved. */
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
      // the dot is placed in percentages of the graph's box
      cursorKnob.style.left = (cx / GRAPH_W * 100) + "%";
      cursorKnob.style.top  = (graphY(spot.metres) / GRAPH_H * 100) + "%";
    }

    /* ---- waypoint cards -------------------------------------------------
       How much of its own stretch of scroll each card is inside. A card is due
       from cardLead before its waypoint until cardVisibleFor later, and is worth
       nothing outside that.                                                 */
    let arriving = -1;                       // a card the walk has properly reached
    // a phone shows each card for a shorter stretch (cardVisibleForPhone)
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

    /* ── ARRIVING SOMEWHERE IS WORTH A SMALL NOISE ─────────────────────────
       When the walk actually reaches a waypoint (not passes near it) the
       walking point gives one ring, like a drop landing. It is the difference
       between a dot being moved along a line and one that is WALKING. Only on a
       real arrival, once per waypoint, and never while the graph is dragged:
       scrubbing the trail past in a second would set it ringing like a
       telephone. */
    if (arriving >= 0 && arriving !== arrivedAt && !scrubbing && SETTINGS.arrivalPing) {
      walker.classList.remove("is-arriving");
      void walker.offsetWidth;                  // so the animation starts again
      walker.classList.add("is-arriving");
    }
    arrivedAt = arriving;

    /* A CARD HELD OPEN BY A CLICK GIVES WAY ONCE THE WALK REACHES ANOTHER stop
       than the one it was at when the card was opened, not another than the
       card itself; otherwise a far card was thrown away the frame it was asked
       for (the walk is still "arriving at" the stop under it). With auto-load
       off the walk reaches nothing, so an opened card stays until closed. */
    if (arriving >= 0 && arriving !== heldFrom) {
      cardState.forEach((state, i) => { if (i !== arriving) state.held = false; });
      heldFrom = -2;
    }

    /* NOTHING OPENS WHILE THE GRAPH IS BEING DRAGGED. Scrubbing runs the whole
       trail past in a second or two and cards flashing open and shut look
       broken. The map, walker and numbers move; the cards wait. */
    if (scrubbing) {
      for (let i = 0; i < byScroll.length; i++) byScroll[i] = 0;
      /* AND THE FADE IS WOUND BACK TO NOTHING. `shownness` eases towards 1
         whenever a card is not closed, including through a hush where byScroll
         holds the card at nought, so by the end of the hush it had quietly hit 1
         and the card the journey was for snapped on at full opacity in one
         frame, with no rise or fade. Now nothing fades in during a hush and
         that card arrives like every other. */
      cardState.forEach(state => { state.held = false; state.shownness = 0; });
      arriving = -1;
    }

    cardsMoving = false;
    cardState.forEach((state, i) => {
      // once the walk has left a card's stretch, forget it was closed, so
      // scrolling back past it shows it again
      if (byScroll[i] === 0 && !state.held) state.closed = false;

      // ease the manual fade in real time, so it takes cardCloseMs whatever the
      // frame rate
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
    // multiply, so a card closed mid-stretch fades out from wherever it was. A
    // stop on a switched-off layer is worth nothing however near the walk is.
    /* The first card's entrance. Other cards are faded up by the walk arriving at
       their waypoint; the first IS the trailhead, so byScroll has been 1 since
       the top of the page and it would simply be revealed as the panel moved
       away. So it gets the same entrance over the same short stretch of scroll
       (cardFade), ending where the panel's darkening does. It multiplies into
       the card's own value, so the rise that goes with the fade (see nudge
       below) comes along. Past the opening this is 1. */
    const veilGoneAt = SETTINGS.openingHold * SETTINGS.openingLeavesBy;
    const entrance = SETTINGS.firstCardEnters
                   ? ramp(veilGoneAt - fadeOver, veilGoneAt, down) : 1;

    /* WITH AUTO-LOAD OFF, byScroll is worth nothing: a card shows only if
       something opened it. That is the whole of the switch, one term in one
       expression, because everything else about a card is written in terms of
       "how much should this be showing". */
    const shownAt = cardState.map((state, i) =>
      onALiveLayer(stops[i])
        ? (state.held ? 1 : byScroll[i]) * state.shownness * entrance
        : 0);

    /* ── WHICH CARD IS ON SCREEN ───────────────────────────────────────────
       A held one wins. Otherwise the strongest, and where several are EQUALLY
       strong, the one you are actually standing at. Without that last clause,
       where two stops are close both are at full strength and the first in the
       list won: standing at Nonsense corner you were shown the card for the
       spur before it. Nothing changes where only one card is up. */
    let front = -1, strongest = 0;
    cardState.forEach((state, i) => { if (state.held && shownAt[i] > 0) front = i; });
    if (front < 0) {
      shownAt.forEach((v, i) => { if (v > strongest) { strongest = v; front = i; } });
      if (front >= 0) {
        let closest = Math.abs(stops[front].fraction - p);
        shownAt.forEach((v, i) => {
          if (v < strongest - SETTINGS.frontTie) return;
          const gap = Math.abs(stops[i].fraction - p);
          if (gap < closest) { closest = gap; front = i; }
        });
      }
    }

    /* A CARD CAUGHT HALF-WAY IN is noted here and settled from outside the loop
       (see settleOnto()). Only a card the walk is fading (not held, not easing
       in on its own, nothing else driving the page) and only once the walk has
       caught up with the scroll, so a card merely passing through its fade does
       not count. */
    const halfShown = SETTINGS.settleCards && front >= 0 && !cardState[front].held &&
      cardState[front].shownness > 0.99 &&
      shownAt[front] > SETTINGS.cardLiveAbove && shownAt[front] < SETTINGS.cardReadyAt &&
      Math.abs(wanted - shown) < 0.0005 &&
      !scrubbing && !bigOn() && !settling &&
      !document.body.classList.contains("tm-touring");
    halfShownStop = halfShown ? front : -1;
    if (halfShown && !settleTimer) settleTimer = setTimeout(settleOnto, SETTINGS.settleAfterMs);
    else if (!halfShown && settleTimer && !settling) { clearTimeout(settleTimer); settleTimer = 0; }

    /* ── THE SHOVE ─────────────────────────────────────────────────────────
       Wound on in real time, so it takes cardSwapMs whatever the frame rate,
       keeping the loop awake. `ease` is the scroll's in-and-out curve: it sets
       off and arrives without a jolt, which reads as weight, not a slide. */
    if (swapping) {
      swapping.at = Math.min(1, swapping.at +
                    Math.max(1, sinceLastFrame) / Math.max(1, SETTINGS.cardSwapMs));
      if (swapping.at >= 1) swapping = null; else cardsMoving = true;
    }
    const shoveAt = swapping
      ? (swapping.at < 0.5 ? 2 * swapping.at * swapping.at
                           : 1 - Math.pow(-2 * swapping.at + 2, 2) / 2)
      : 1;

    /* ── THE HAND OF CARDS ─────────────────────────────────────────────────
       Which cards are close enough to the front one to be dealt with it. The
       run is walked outward from `front` through the LIVE stops in walk order:
       while the next is within stackWithin of the last it joins the hand. Only
       forwards (the ones behind have been read) and only stackMax of them.
       Worked out per frame because the live set changes when the Wishful
       switch is thrown; it is a walk down a list of twenty. */
    const hand = [];
    if (front >= 0) {
      const perFraction = scrollSpan > 0 ? scrollSpan / pageSpan : 0;
      const gapOk = perFraction > 0 ? SETTINGS.stackWithin / perFraction : 0;
      const live = [];
      for (let i = 0; i < stops.length; i++) if (onALiveLayer(stops[i])) live.push(i);
      const at = live.indexOf(front);
      if (at >= 0) {
        hand.push(front);
        for (let k = at + 1; k < live.length && hand.length < SETTINGS.stackMax; k++) {
          if (stops[live[k]].fraction - stops[live[k - 1]].fraction > gapOk) break;
          hand.push(live[k]);
        }
        /* HOW MANY THERE REALLY ARE, not how many are shown: the badge says
           "2 of 5" so a reader knows the hand is deeper than the visible cards. */
        let whole = hand.length, back = at;
        for (let k = at + 1; k < live.length; k++) {
          if (stops[live[k]].fraction - stops[live[k - 1]].fraction > gapOk) break;
          if (k >= at + SETTINGS.stackMax) whole++;
        }
        while (back > 0 &&
               stops[live[back]].fraction - stops[live[back - 1]].fraction <= gapOk) {
          back--; whole++;
        }
        hand.whole = whole;
        hand.mine = at - back + 1;
      }
    }
    const handAt = {};
    hand.forEach((i, n) => { handAt[i] = n; });

    /* ── DRESSED BEFORE IT IS SEEN ─────────────────────────────────────────
       Whether a waypoint opens compact is decided once a frame, here, not only
       where a card is opened BY HAND: most cards are brought up by the walk and
       never go through openCard, so on a phone only a tapped waypoint got the
       compact card and plain scrolling gave full-height ones.

       It is applied only to a card that is INVISIBLE (cardFoldBelow): folding
       on screen would collapse a card in the reader's face, and the one card
       never to touch is the one they have just pressed Open on. */
    const foldThem = deck && deck.peek ? shouldPeek() : null;

    cards.forEach((card, i) => {
      /* A CARD IN THE HAND IS DRAWN EVEN THOUGH IT IS NOT THE FRONT ONE: a card
         behind the front one is drawn at a fraction of its fade, and every
         other card is at nought. */
      const deep = handAt[i];
      let v = i === front ? shownAt[i]
            : deep === undefined ? 0
            : shownAt[front] * Math.pow(SETTINGS.stackFade, deep);
      let shove = 0, shrink = 1;
      if (swapping) {
        if (i === swapping.out) {
          /* STILL DRAWN WHILE IT LEAVES: otherwise its opacity goes to nothing
             the instant `front` changes, leaving nothing to shove. */
          v = Math.max(v, 1 - shoveAt);
          shove = -shoveAt * SETTINGS.cardShove;
          shrink = 1 - (1 - SETTINGS.cardShoveBack) * shoveAt;
        } else if (i === swapping.in) {
          shove = (1 - shoveAt) * SETTINGS.cardShove;
        }
      }
      /* WHERE IT SITS IN THE HAND. The stylesheet does the fanning (lift, shift
         and step back are one transform there) and the engine only reports the
         depth: the look of a card belongs in the stylesheet, a number that
         changes every frame belongs here. */
      card.style.setProperty("--card-stack", deep === undefined ? 0 : deep);
      card.style.zIndex = deep === undefined ? 1 : (30 - deep);
      card.classList.toggle("is-stacked", deep !== undefined && hand.length > 1);
      card.classList.toggle("is-behind", deep !== undefined && deep > 0);
      if (deep !== undefined) card.dataset.stackAt = deep; else delete card.dataset.stackAt;
      /* AND IT SAYS HOW DEEP THE HAND IS. At most three cards are shown and a
         hand can be five, so the front card carries the count. Written only when
         it changes: this runs sixty times a second. */
      if (i === front && hand.length > 1) {
        let badge = card.querySelector(".tm-stackAt");
        if (!badge) {
          badge = document.createElement("div");
          badge.className = "tm-stackAt";
          card.appendChild(badge);
        }
        const says = hand.mine + " of " + hand.whole + " here";
        if (badge.textContent !== says) badge.textContent = says;
      } else {
        const badge = card.querySelector(".tm-stackAt");
        if (badge) badge.remove();
      }
      card.style.setProperty("--card-shove", shove.toFixed(1));
      card.style.setProperty("--card-shrink", shrink.toFixed(4));
      card.style.opacity = v.toFixed(3);
      /* while it is invisible it is folded (or unfolded) for next time; `peek` is
         a class swap, written only when the answer has changed. Except the card
         somebody has just ASKED for, which is held: it is still invisible on its
         first frames, and folding it then would undo the full card a click had
         asked for. */
      if (foldThem !== null && v <= SETTINGS.cardFoldBelow && !cardState[i].held &&
          card.classList.contains("is-peek") !== foldThem) {
        deck.peek(card, foldThem);
      }
      // an invisible card must not swallow clicks meant for the map, but a card
      // fanned behind the front one is faint ON PURPOSE and likely to be pressed
      card.style.pointerEvents =
        (v > SETTINGS.cardLiveAbove || deep > 0) ? "auto" : "none";
      // and the one being shoved out takes no clicks at all
      if (swapping && i === swapping.out) card.style.pointerEvents = "none";
      takesInput(card, card.style.pointerEvents === "auto");
      // How far the card still has to rise, in pixels, as a plain number; the
      // stylesheet decides what to do with it.
      /* THE WHOLE HAND RISES TOGETHER. A card drawn at 38% of the front one's
         fade was being pushed a couple of dozen pixels DOWN the screen, nearly
         cancelling the fan's lift. A card in the hand is not entering; it is
         already here behind something, so it takes the front card's rise. */
      const rising = deep === undefined ? v : shownAt[front];
      const nudge = (1 - rising) * SETTINGS.cardRiseBy;
      card.style.setProperty("--card-nudge", nudge.toFixed(2));
    });

    drawTheLeader(front, shownAt[front] || 0);

    /* THE WAYPOINT WHOSE CARD IS UP IS MARKED ON THE MAP. Clicking a waypoint is
       a toggle and any waypoint can be opened from anywhere, so something must
       say which one you are looking at, or the second click that closes a card
       has no visible target. */
    stops.forEach((s, i) => {
      const open = i === front && shownAt[i] > 0.5;
      if (s.chip) s.chip.classList.toggle("is-open", open);
      if (s.tag)  s.tag.classList.toggle("is-open", open);
    });

    // a video only runs while its own card is on screen
    const showingNow = front >= 0 && shownAt[front] > SETTINGS.cardLiveAbove;
    if (front !== frontCard || showingNow !== frontShowing) {
      frontCard = front;
      frontShowing = showingNow;
      playTheRightVideo();
    }

    /* ── THE COIN AND THE DIAL GO AGAIN, ONCE THE CARD IS ACTUALLY UP ───────
       Not an observer (every card is in the viewport all the time, merely faded,
       so "came into view" fires once at load) and not when the card is CHOSEN:
       that is half a second before it has faded in, so the dial's swing played
       behind a transparent card and looked like a needle that does not move. The
       test is how far the card has FADED IN (`shownAt[front]`); iconsPlayedFor
       makes it once per appearance and is cleared when another card takes over. */
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
       Both are driven by `down`, the position in walks, not trail progress: the
       opening fades within its hold, well before the first step; the closing
       waits until the trail has run out AND the map has pulled back.

       For the opening, `gone` runs 0 to 1 across its stretch of scroll: 0 while
       squarely in front, 1 once left. Whether that travels up and off the top or
       plainly dissolves is the choice below; the number is the same either way,
       so everything downstream is unchanged. */
    const gone = ramp(0, SETTINGS.openingHold * SETTINGS.openingLeavesBy, down);
    const openFade = 1 - gone;
    // How far into the finish we are. Drives the clearing away of cards and
    // readouts whether or not there is a closing screen, so the pull-back always
    // ends on the map by itself.
    const endFade  = ramp(pulledOut,
                          pulledOut + SETTINGS.closingHold * SETTINGS.closingFadeShare,
                          down);
    const closeFade = SETTINGS.showClosingScreen ? endFade : 0;

    // The map can soften behind either screen and sharpen as it clears. Both are
    // off by default, and the filter is only switched on when there is something
    // to blur, because a full-screen filter costs a rendering pass every frame.
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
      /* It rises by openingTravel screenfuls, carrying its darkening so the map
         is uncovered from the bottom up. The fade is partial and deliberate: a
         fully solid panel would read as an object striking the top edge. */
      opening.style.transform =
        "translate3d(0," + (-gone * SETTINGS.openingTravel * 100).toFixed(2) + "%,0)";
      opening.style.opacity = (1 - gone * SETTINGS.openingFadesToo).toFixed(3);
    } else {
      opening.style.transform = "";
      opening.style.opacity = openFade.toFixed(3);
    }
    // out of the way entirely once gone, and its compositing layer handed back
    // so the walk is not carrying a full-screen layer that will never be drawn
    const done = gone > 0.999;
    opening.style.visibility = done ? "hidden" : "visible";
    opening.style.willChange = done ? "auto" : "transform, opacity";
    el("closing").style.opacity = closeFade.toFixed(3);
    el("closing").style.visibility = closeFade < 0.01 ? "hidden" : "visible";
    /* The interface arrives on the panel's way out, not the walk's way in: the
       panel rises, the map is uncovered, and the first card fades up through the
       back half so it is there as the darkening finishes leaving. It hangs off
       `gone` (the panel's progress), not the walk starting: the first waypoint
       is AT the trailhead, so its card's stretch of scroll is over within a
       moment of the walk beginning, and holding the interface back until then
       would close its window before its layer is ever switched on. */
    const started = ramp(SETTINGS.cardsArriveWith, 1, gone);
    /* The readouts follow the panel out. The card COLUMN does not: fading it
       would flatten the first card's own entrance into a slow dissolve. The
       cards fade themselves (see `entrance`), so the column only clears away at
       the finish. */
    el("cards").style.opacity = (1 - endFade).toFixed(3);
    const uiFade = (started * (1 - endFade)).toFixed(3);
    el("readouts").style.opacity = uiFade;
    takesInput(el("readouts"), +uiFade > 0.5);   // the profile graph can be focused, so it must not be while it is faded out
    /* THE WHOLE ROW ARRIVES WITH THE BAND, tour button and all. The tour button
       used to be live from the first frame, but then a lone round button (later
       with a count) stood in the corner of the opening screen for a band that
       had not appeared, which reads as not finished loading. So the row arrives
       as one object with the graph it sits above, and it is the ROW that is
       handed the pointer, so the count, pause button and tour note come along. */
    /* THE SCROLL PROMPT IS THE OPPOSITE OF THE BAND: up while the page is at the
       top, gone when the walk begins. Driven off the same number, so the two
       can never both show or both be missing. */
    const goOn = el("goOn");
    if (goOn) goOn.classList.toggle("is-on", started < SETTINGS.goOnUntil);
    /* once the band is up the prompt belongs to it: it moves into the gap in the
       row of numbers (is-inBand) and waits unseen until the reader stops
       scrolling (see keepSayingThereIsMore()). When the band goes, so does it. */
    bandUp = +uiFade > 0.5;
    if (goOn) {
      goOn.classList.toggle("is-inBand", bandUp && SETTINGS.goOnWhileWalking);
      /* and it goes the moment a card takes over the screen (expanded on a
         desktop, opened out on a phone): "scroll for more" would tell somebody
         reading to stop. Checked every frame, so it fades as the card grows. */
      if (!bandUp || aCardFillsTheScreen()) goOn.classList.remove("is-walking");
    }

    const stepper = el("stepper");
    if (stepper) {
      stepper.style.opacity = uiFade;
      stepper.style.pointerEvents = +uiFade > 0.5 ? "auto" : "none";
      takesInput(stepper, +uiFade > 0.5);
    }
    /* the zoom controls belong to the walk the same way: nothing worth looking
       at closely until the trail is on screen */
    const zoomBox = el("zoom");
    if (zoomBox) {
      /* AND THEY GIVE WAY TO AN OPENED CARD. One unfolded from compact is nearly
         all of a phone's screen: the controls would float over somebody's
         reading with nothing left to zoom. They fade and come back with the
         card. Only true where compact cards are in use. */
      const underACard = SETTINGS.zoomHidesUnderCard &&
                         cards.some(card => card.classList.contains("is-grown"));
      const zoomFade = underACard ? 0 : uiFade;
      zoomBox.style.opacity = zoomFade;
      zoomBox.style.pointerEvents = +zoomFade > 0.5 ? "auto" : "none";
      takesInput(zoomBox, +zoomFade > 0.5);
    }
    /* The shading over the map is there to make the readouts legible; with them
       gone at the finish it is a stain across a picture meant to be seen plainly. */
    el("shade").style.opacity = (1 - endFade).toFixed(3);
    /* The rail goes with the opening screen but returns for the finish: no use
       for a legend while the title is up, but the whole map at the end is when
       you might want one. */
    const rail = el("rail");
    if (rail) {
      rail.style.opacity = (1 - openFade).toFixed(3);
      rail.style.pointerEvents = openFade > 0.5 ? "none" : "";
      /* the two buttons only: the compass in the same rail stays clickable on
         the opening screen, which is how the cyclist is called up */
      takesInput(el("legendBtn"), openFade <= 0.5);
      takesInput(el("layersBtn"), openFade <= 0.5);
    }
  }

  function frame(now) {
    const gap = Math.min(64, now - lastFrame || 16.7);
    lastFrame = now;
    const left = wanted - shown;
    // ease towards the target at the same rate whatever the frame rate
    if (Math.abs(left) < 0.00004 || stillWanted) shown = wanted;
    else shown += left * (1 - Math.pow(1 - SETTINGS.followLag, gap / 16.7));
    /* THE READER'S ZOOM ADVANCES HERE, BEFORE ANYTHING IS DRAWN, so the lens, the
       counter-scaled rings and names and the card's line are all made from the
       same level in the same frame. */
    lensTick(now);
    draw(shown, gap);
    followTheWalk();
    // keep going while the map is catching up OR a card is mid-fade OR the
    // zoom is travelling OR the line is mid-draw
    if (shown !== wanted || cardsMoving || lensAt !== lensWant ||
        (leaderPen && leaderPen.busy())) requestAnimationFrame(frame);
    else ticking = false;
  }

  /* start the loop if it is not running; used by the card buttons, which need a
     frame or two though nothing has been scrolled */
  function wake() {
    if (!ticking) { ticking = true; lastFrame = 0; requestAnimationFrame(frame); }
  }

  function nudge() {
    if (reading) return;
    // an expanded card holds the walk where it is; anything slipping past the
    // three refusals is put back a frame later, so following it would only
    // make the map twitch
    if (bigOn()) return;
    wanted = scrolled();
    wake();
  }

  addEventListener("scroll", nudge, { passive: true });
  /* Order matters: the page's height is settled BEFORE anything re-reads the
     scroll position against it. */
  addEventListener("resize", () => { lockTheScroll(); nudge(); });
  wanted = shown = scrolled();
  draw(shown, 0);
  nudge();

  /* The cards must be laid out before the rail is placed against them, so this
     runs after the first draw and on every window reshape, including a phone
     turned on its side. */
  placeRail();
  addEventListener("resize", placeRail);

  /* ── the stepper's behaviour ────────────────────────────────────────────
     Which stops it can reach depends on the Wishful thinking switch, so
     liveStops() is asked fresh each time rather than cached. */
  function liveStops() {
    return stops.map((s, i) => i).filter(i => onALiveLayer(stops[i]));
  }

  /* Where the page has to be scrolled for a given stop to be the one you are
     standing at: a stop's fraction is placed inside the walk's own stretch of
     the page (see the stages), not against the whole document. */
  /* ── THE LINE FROM THE CARD TO THE PLACE IT IS ABOUT ────────────────────
     A card about a proposal may be about somewhere the map does not point at.
     The line is drawn in SCREEN coordinates (inside tm-world/tm-lens it would
     inherit the walk's and reader's transforms and its weight would breathe), it
     meets the card at the MIDDLE OF AN EDGE and stops short (a corner reads as
     a mistake), and it BOWS and draws in from the ring (a straight line looks
     like a ruler left on the page). The drawing is leader-line.js, shared with
     the main map so every fix lands once; what is here is which waypoint and
     card, and whether this page draws one at all. */
  function drawTheLeader(i, shown) {
    const holder = el("leaders");
    if (!holder) return;
    if (!leaderPen) {
      if (typeof window.HappyTrailsLeader !== "function") return;
      leaderPen = window.HappyTrailsLeader({
        holder: holder, line: el("leaderLine"), fade: el("leaderFade"),
        settings: SETTINGS
      });
    }
    const stop = i >= 0 ? stops[i] : null;
    leaderPen.draw({
      ring:  stop ? stop.chip : null,
      card:  i >= 0 ? cards[i] : null,
      key:   i,
      shown: shown,
      wishful: stop ? stop.kind === "wishful" : false,
      /* THE PAGE'S OWN REASONS FOR NOT DRAWING ONE: switched off, a phone, or a
         card expanded over the whole window. */
      hidden: !SETTINGS.leaders || isPhone() || bigOn()
    });
  }

  function pageAtStop(i) {
    const at = (walkFrom + stops[i].fraction) / pageSpan;
    return Math.round(at * scrollSpan);
  }

  /* THE SAME SUM AS pageAtStop, WITH A FRACTION INSTEAD OF A STOP: dragging the
     elevation graph gives a position along the trail, and the graph knows
     nothing about waypoints. */
  function pageAtFraction(f) {
    const at = (walkFrom + clamp(f, 0, 1)) / pageSpan;
    return Math.round(at * scrollSpan);
  }

  function goToFraction(f) {
    window.scrollTo(0, pageAtFraction(f));
  }

  /* A CARD THAT IS THE WHOLE SCREEN: the expanded view on a desktop, or a card
     opened out of its compact shape on a phone. */
  function aCardFillsTheScreen() {
    if (bigOn()) return true;
    return window.innerWidth <= SETTINGS.phoneWidth &&
           cards.some(card => card.classList.contains("is-grown"));
  }

  /* ── "SCROLL FOR MORE", WHILE WALKING ────────────────────────────────────
     After the opening panel and foot prompt are gone nothing says the trail goes
     on, and somebody stopped at a waypoint may think the page has ended. So when
     the page has been still for goOnIdleMs, with the band up and the walk not
     near its end, the prompt returns in the gap in the row of numbers; the first
     scroll sends it away. Placed by measuring that gap each time, since the row
     changes with window width (a phone hides one reading). */
  (function keepSayingThereIsMore() {
    const goOn = el("goOn");
    if (!goOn || !SETTINGS.goOnWhileWalking) return;
    let waiting = 0;

    function placeIt() {
      const gap = document.querySelector("#tm-numbers .tm-gap");
      const row = el("numbers");
      if (!gap || !row) return false;
      const g = gap.getBoundingClientRect(), r = row.getBoundingClientRect();
      if (!r.height) return false;
      /* ON ONE LINE IF IT FITS, on two (words over the arrow, a size smaller) if
         not: a phone's gap is about 130 pixels and a desktop-sized pill would sit
         on the readings either side. Measured, since the gap decides. */
      goOn.classList.remove("is-tight");
      if (goOn.offsetWidth + 2 * SETTINGS.goOnClearance > g.width) goOn.classList.add("is-tight");
      /* CENTRED ON THE WINDOW, where the eye expects a prompt about the whole
         page, moved only as far as needed to stay clear of the readings either
         side of its gap. Dead centre on a desktop; on a phone the gap is off to
         one side and it keeps to the middle of that. */
      const half = goOn.offsetWidth / 2, clear = SETTINGS.goOnClearance;
      const lo = g.left + clear + half, hi = g.right - clear - half;
      const x = lo <= hi ? clamp(window.innerWidth / 2, lo, hi) : g.left + g.width / 2;
      goOn.style.setProperty("--go-on-x", Math.round(x) + "px");
      goOn.style.setProperty("--go-on-y",
        Math.round(window.innerHeight - (r.top + r.height / 2)) + "px");
      return true;
    }

    function offer() {
      const along = clamp(shown * pageSpan - walkFrom, 0, 1);
      const worthIt = bandUp && along < SETTINGS.goOnWalkEnds &&
                      !scrubbing && !aCardFillsTheScreen() &&
                      !document.body.classList.contains("tm-touring");
      if (worthIt && placeIt()) goOn.classList.add("is-walking");
    }

    function stillFor() {
      goOn.classList.remove("is-walking");
      clearTimeout(waiting);
      waiting = setTimeout(offer, SETTINGS.goOnIdleMs);
    }
    addEventListener("scroll", stillFor, { passive: true });
    addEventListener("resize", stillFor);
    /* and once at the start, for somebody who arrives part way down (a link to a
       waypoint, the resume chip) and has not scrolled since */
    stillFor();
  })();

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
    /* the same journey a link makes, so one piece of code means "go and stand at
       this stop": it scrolls, opens the card, turns the wishful layer on if
       needed, and claims the address */
    goToStop(want, SETTINGS.stepperSmooth);
  }

  /* An arrow with nothing beyond it is disabled, not hidden: the pair keeps its
     shape, and greying says "you are at the end" where vanishing looks broken. */
  function refreshStepper() {
    const back = el("stepBack"), on = el("stepOn");
    if (!back || !on) return;
    const { at, live } = nearestStop();
    const here = live.indexOf(at);
    back.disabled = here <= 0;
    on.disabled   = here < 0 || here >= live.length - 1;

    /* THE COUNT, ON THE SAME FIGURES, so it cannot disagree with the arrows: the
       same `here` that greys the back arrow is the number shown. One live stop
       gets nothing ("1 / 1" is not information). Words come from WORDS. */
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
     Every stop has a name in the URL (don.html#half-mile-bridge). Arriving with
     one scrolls to that stop and opens its card; walking or stepping past a stop
     rewrites the address to match (replaceState, not pushState, so a walk leaves
     ONE back-button entry). A WISHFUL STOP TURNS ITS LAYER ON: a link to
     something unbuilt is the one most worth sending and would otherwise land on
     an empty stretch of trail. */
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
     Asked before a journey, to decide whether cards are hushed for it. The
     neighbour passes nothing, so its card opens at once; a stop six away passes
     five, which is what the hush is for. */
  function stopsPassed(i) {
    const here = nearestStop().at;
    if (here < 0 || here === i || !stops[i] || !stops[here]) return 0;
    const lo = Math.min(stops[here].fraction, stops[i].fraction);
    const hi = Math.max(stops[here].fraction, stops[i].fraction);
    return liveStops().filter(k => k !== here && k !== i &&
                              stops[k].fraction > lo && stops[k].fraction < hi).length;
  }

  /* ── HUSHING THE CARDS FOR THE LENGTH OF A JOURNEY ───────────────────────
     The same `scrubbing` the elevation graph raises while dragged, which the
     loop reads as "the walk is moving, open nothing". It is put down when the
     scroll arrives, or when it plainly will not: a smooth scroll cut short by a
     touch of the wheel says nothing. So arrival is watched for three ways at
     once: near enough to the target, not moved for a few checks, or taken too
     long. Whichever comes first, the hush ends and the asked-for card opens. */
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
         scroll can set off a good while after it is asked to on a busy machine,
         so a stall test counting from the start read "not moving yet" as
         "arrived" and dropped the hush before the journey began, intermittently.
         The timeout covers a journey that genuinely never starts. */
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
    /* HUSHED IF THERE IS ANYTHING TO PASS, *OR* IF IT IS SIMPLY A LONG WAY.
       Between two far-apart neighbours nothing is passed, so the card opened at
       departure with two thousand pixels still to travel, vanished when the walk
       left its stretch of scroll, and came back on arrival: three states where
       there should be one. A journey is a journey. */
    const target0 = pageAtStop(i);
    const far = smooth && SETTINGS.hushWhilePassing &&
                (stopsPassed(i) > 0 ||
                 Math.abs(target0 - window.scrollY) > SETTINGS.hushOverPx);
    const target = target0;
    window.scrollTo({ top: target, behavior: smooth ? "smooth" : "auto" });
    /* THE CARD OPENS ON ARRIVAL, NOT DEPARTURE, when there is anything to travel
       past: the hush clears every held card each frame it is up, so a card
       opened into it would be thrown away next frame. */
    if (far) travelTo(target, () => openCard(i));
    else openCard(i);
    return true;
  }

  if (SETTINGS.linkToStops) {
    /* THE ADDRESS WE ARRIVED ON, read now and kept. The jump has to wait for the
       page to settle (its height is measured from the artwork), and meanwhile
       the drawing loop is already deciding the nearest stop is the first and
       rewriting the address to say so; reading location.hash after that gives
       the page's own invention, so every link landed on stop one. */
    const arrivedOn = location.hash;
    /* and nothing rewrites the address until the arrival has happened */
    let settled = !arrivedOn;

    /* ARRIVING FROM THE WISHFUL THINKING PAGE. Somebody following a proposal's
       link came for that single idea, so it opens in the big view. bigOnArrival
       decides which links count ("wishful", true, false); a window too small
       gets the ordinary card (see roomToGrow). A link may also ask outright with
       ?big=1 (the main map's "Open card on trail page" button): in the address,
       not a setting, so it belongs to the JOURNEY and a shared link to the trail
       still opens the trail. */
    const askedForBig = /(?:^|[?&])big=1(?:&|$)/.test(location.search.slice(1));

    const shouldArriveBig = i =>
      SETTINGS.bigOnArrival === true || askedForBig ||
      (SETTINGS.bigOnArrival === "wishful" && stops[i] && stops[i].kind === "wishful");

    /* ── TRAVELLING THERE, RATHER THAN BEING PUT THERE ────────────────────
       Somebody handed one waypoint on a trail they have not seen has no idea
       whether it is at the start, end or middle; the trail travelling under them
       for two seconds answers that before they have read a word.

       THE CARDS ARE HUSHED FOR THE WHOLE JOURNEY (the same `scrubbing` the graph
       raises), so the waypoints between do not each open and shut on the way
       past. The one asked for opens on arrival and is the only one that does. */
    let travelling = 0;
    function travelThere(i, then) {
      const target = pageAtStop(i);
      const from = window.scrollY;
      const gap = target - from;
      const still = window.matchMedia &&
                    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (!SETTINGS.arriveTravel || still || Math.abs(gap) < 8) {
        window.scrollTo(0, target);
        shown = wanted;
        draw(shown, 0);
        then();
        return;
      }
      scrubbing = true;
      wake();
      const began = performance.now();
      const step = now => {
        const f = Math.min(1, (now - began) / SETTINGS.arriveTravelMs);
        // in and out, so it sets off and arrives without a jolt
        const e = f < 0.5 ? 2 * f * f : 1 - Math.pow(-2 * f + 2, 2) / 2;
        window.scrollTo(0, Math.round(from + gap * e));
        if (f < 1) { travelling = requestAnimationFrame(step); return; }
        scrubbing = false;
        wake();
        then();
      };
      travelling = requestAnimationFrame(step);
    }

    const arriveAt = () => {
      const i = stopNamed(arrivedOn);
      if (i < 0) {
        settled = true;
        requestAnimationFrame(uncover);
        return;
      }
      /* the address is claimed before the journey, so the loop does not rename it
         to wherever the page is passing through */
      named = i;
      nameInAddress(i);
      /* A LINK TO A PROPOSAL SWITCHES THE WISHFUL LAYER ON. Every link from the
         Wishful thinking page is to a proposal, hidden until that layer is on,
         which it is not on a fresh visit; otherwise the page travelled there and
         opened a card that by the layer's rules was not there. The arrows do the
         same (see goToStop), and the Layers panel is redrawn to agree. */
      if (stops[i].kind === "wishful" && !wishfulOn) {
        wishfulOn = true;
        applyLayers();
        if (buildPanels) buildPanels();
      }
      /* THE COVER STAYS UP FOR THE WHOLE JOURNEY, and you can see through it: it
         is transparent with a blur behind it, so the trail travelling underneath
         is visible, softened, saying "not yet" without hiding what is happening.
         It lifts as the waypoint arrives, when the card opens, so the two read
         as one event. */
      requestAnimationFrame(() => {
        settled = true;
        setTimeout(() => travelThere(i, () => {
          /* the full card, not the compact one: a link to one waypoint asks for
             THAT waypoint, the same as clicking its button */
          openCard(i, false, true);
          if (shouldArriveBig(i)) setBig(true, i, true);
          uncover();
        }), SETTINGS.arriveHoldMs);
      });
    };
    if (arrivedOn) setTimeout(arriveAt, SETTINGS.linkArriveAfterMs);
    // and if someone edits the address, or follows a link to this same page
    addEventListener("hashchange", () => {
      const i = stopNamed(location.hash);
      if (i < 0) return;
      const big = shouldArriveBig(i);
      /* A jump, not a glide, when the card is about to fill the screen: a smooth
         scroll is still travelling when the view locks, and the lock would put
         the page back where the scroll started. */
      goToStop(i, !big);
      if (big) setBig(true, i, true);
    });
    /* Walking past a stop names it in the address. Driven from the drawing loop,
       not the scroll event: `shown` eases towards the scroll, so the event's
       reading is a frame behind and overwrote a deliberate jump's address. NOT
       ON EVERY FRAME: nearestStop() builds two arrays per call, which at sixty
       times a second cost about five frames a second on a phone in garbage
       collection. Four times a second is faster than anyone passes a waypoint. */
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
  /* A late-arriving web font changes how many lines the text takes and so the
     card heights. Measure again once fonts have settled. */
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(placeRail);

  /* Flatten the artwork for phones after the first frame, never before. A window
     that starts wide and is later narrowed gets the same; flattenArtwork() does
     nothing the second time, so firing on every resize is safe. */
  setTimeout(flattenArtwork, SETTINGS.flattenAfterMs);
  addEventListener("resize", flattenArtwork);

  /* ══════════════════════════════════════════════════════════════════════════
     THE READER'S OWN ZOOM
     ══════════════════════════════════════════════════════════════════════════
     A SECOND TRANSFORM, ON A WRAPPER, is the whole design. The walk positions
     #tm-world frame by frame with a great deal of arithmetic; this scales
     whatever the walk produced, from #tm-lens just outside it. The two never
     share a matrix, so nothing here can upset the walk's sums.

     IT ONLY GOES OUT. The walk's own view is as close as it gets; what was
     missing was the other way (where this bend is heading, what is beside the
     trail). + and FIT bring you back towards the walk's view and stop there; −
     steps out zoomOutSteps times.

     ALWAYS ABOUT THE MIDDLE OF THE MAP. Zoomed out nothing is off-screen to
     drag towards, so there is no pan to keep, and the page goes on scrolling,
     the walk walking at whatever distance the reader stepped back to.
     ══════════════════════════════════════════════════════════════════════════ */
  const lens = el("lens");
  const lensLeast = Math.pow(SETTINGS.zoomStep, -SETTINGS.zoomOutSteps);
  /* lensAt itself is declared with the drawing loop's state */

  function lensApply() {
    if (!lens) return;
    /* scaled about the centre of the stage: translate by the part the shrinking
       gives up, half on each side */
    const shiftX = (1 - lensAt) * stageW() / 2, shiftY = (1 - lensAt) * stageH() / 2;
    lens.style.transform = lensAt >= 0.9995
      ? ""
      : "translate(" + shiftX.toFixed(2) + "px," + shiftY.toFixed(2) + "px) " +
        "scale(" + lensAt.toFixed(4) + ")";
    const out = el("zoomOut"), fit = el("zoomFit"), into = el("zoomIn");
    wake();          // the loop re-sizes the lines and chips for the new level
    /* THE BUTTONS ARE ASKED OF WHERE THE ZOOM IS GOING, not where it is this
       frame: − greys the moment it is pressed the last time. */
    if (out)  out.disabled  = lensWant <= lensLeast + 0.0005;
    if (into) into.disabled = lensWant >= 0.9995;
    if (fit)  fit.disabled  = lensWant >= 0.9995;
  }

  /* ── THE ZOOM IS WORKED OUT BY THE DRAWING LOOP, NOT BY THE BROWSER ──────
     A CSS transition tells the page nothing: the loop drew everything at the
     FINAL level and slept while the map slid there, so the card's line came
     adrift (up to ninety pixels from its ring). So the level is a number the
     loop moves a frame at a time, every frame draws from it, and the loop stays
     awake until it arrives. */
  function lensTick(now) {
    if (lensAt === lensWant) return;
    const t = clamp((now - lensSince) / SETTINGS.zoomEaseMs, 0, 1);
    const eased = 1 - Math.pow(1 - t, SETTINGS.zoomEasePower);
    lensAt = t >= 1 ? lensWant : lensFrom + (lensWant - lensFrom) * eased;
    lensApply();
  }

  /* the one way the level changes: eased, or not for a pinch, which is already
     a continuous movement under the fingers */
  function lensTo(want, ease) {
    if (!lens || !SETTINGS.zoomOnTrail) return;
    const now = clamp(want, lensLeast, 1);
    if (Math.abs(now - lensWant) < 0.0005) return;
    lensWant = now > 0.9995 ? 1 : now;
    if (ease) {
      lensFrom = lensAt;
      lensSince = performance.now();
    } else {
      lensAt = lensWant;
    }
    lensApply();
  }

  /* A STEP LANDS ON THE LADDER. Pinching can leave the level anywhere; the next
     press moves to the next whole step from there, so − twice from the walk's
     view always arrives at the same two places and + comes back through them. */
  function lensStep(dir) {
    // from where it is GOING, so two quick presses are two steps
    const rung = Math.log(lensWant) / Math.log(SETTINGS.zoomStep);   // 0, -1, -2
    const next = dir < 0 ? Math.floor(rung - 0.001) : Math.ceil(rung + 0.001);
    lensTo(Math.pow(SETTINGS.zoomStep, next), true);
  }
  function lensFit() { lensTo(1, true); }

  if (lens && SETTINGS.zoomOnTrail) {
    const into = el("zoomIn"), out = el("zoomOut"), fit = el("zoomFit");
    if (into) { into.title = WORDS.zoomIn; into.setAttribute("aria-label", WORDS.zoomIn);
                into.addEventListener("click", () => { byHand(); lensStep(+1); }); }
    if (out)  { out.title = WORDS.zoomOut; out.setAttribute("aria-label", WORDS.zoomOut);
                out.addEventListener("click", () => { byHand(); lensStep(-1); }); }
    if (fit)  { fit.title = WORDS.zoomFit; fit.setAttribute("aria-label", WORDS.zoomFit);
                fit.addEventListener("click", () => { byHand(); lensFit(); }); }

    /* ── PINCHING ──────────────────────────────────────────────────────────
       Two fingers change the level; one finger is the browser's, as the page
       scroll that walks the trail. The stage's touch-action is pan-y, so the
       browser keeps vertical scrolling and leaves the pinch to this code, which
       also stops the browser's page zoom scaling the whole document. */
    const stage = el("stage");
    const fingers = new Map();
    let pinchWas = 0;
    const spread = () => {
      const f = Array.from(fingers.values());
      return Math.hypot(f[0].x - f[1].x, f[0].y - f[1].y);
    };
    stage.addEventListener("pointerdown", e => {
      if (e.pointerType === "mouse") return;
      fingers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (fingers.size === 2) { pinchWas = spread(); byHand(); }
    });
    stage.addEventListener("pointermove", e => {
      if (!fingers.has(e.pointerId)) return;
      fingers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (fingers.size >= 2 && pinchWas > 0) {
        const now = spread();
        if (now > 0) { lensTo(lensWant * (now / pinchWas), false); pinchWas = now; }
        e.preventDefault();
      }
    });
    const letGo = e => {
      fingers.delete(e.pointerId);
      if (fingers.size < 2) pinchWas = 0;
    };
    stage.addEventListener("pointerup", letGo);
    stage.addEventListener("pointercancel", letGo);
    stage.addEventListener("pointerleave", letGo);

    /* A TRACKPAD PINCH ARRIVES AS A WHEEL EVENT WITH ctrlKey SET (a browser
       convention, nothing to do with the Control key), the only way to tell one
       from an ordinary scroll, which is left alone: it walks the trail. */
    if (SETTINGS.zoomWheel) {
      stage.addEventListener("wheel", e => {
        if (!e.ctrlKey) return;
        e.preventDefault();
        byHand();
        lensTo(lensWant * Math.exp(-e.deltaY / 180), false);
      }, { passive: false });
    }
    /* the centre of the stage moves when the window changes size */
    addEventListener("resize", lensApply);
    lensApply();
  }

  /* ══════════════════════════════════════════════════════════════════════════
     WAYPOINT NAMES THAT WOULD SIT ON EACH OTHER, ZOOMED OUT
     ══════════════════════════════════════════════════════════════════════════
     At the walk's own view every name sits right of its ring and nothing
     touches. Zoomed out, waypoints close up while names keep their size, so
     neighbours' names lie across each other and each other's rings.

     So, only while zoomed out, each name gets the first of four places that is
     clear: right of its ring, left, just above, just below. If none is clear the
     name is hidden and the ring stays (hover it and the name returns). The
     open card's waypoint goes first so its name never gives way; the rest in
     trail order.

     WORKED OUT IN ARITHMETIC, NOT BY MEASURING THE SCREEN: the zoom is still
     easing, so anything read off the screen is where the names are half-way
     there. Where they WILL be follows from things that do not move (each name's
     size and offset in its chip, the waypoint's place on the map, and the scale
     about to be drawn). The stylesheet does the moving, as a transition, from
     the classes handed out here.
     ══════════════════════════════════════════════════════════════════════════ */
  const TANGLE_CLASSES = ["is-left", "is-up", "is-down", "is-hushed"];
  let untangleDue = 0;
  function untangleSoon() {
    if (untangleDue) return;
    untangleDue = requestAnimationFrame(() => { untangleDue = 0; untangleChips(); });
  }
  function untangleChips() {
    if (!SETTINGS.untangleWhenOut) return;
    const out = lensAt < 0.9995;
    if (!out) {                      // the walk's own view: every name at home
      chips.forEach(c => c.classList.remove(...TANGLE_CLASSES));
      return;
    }
    const seen = lastZoom > 0 ? lastZoom : 1;        // what draw() sized for
    const k = chipShrink;                              // a chip's size on screen
    const gap = SETTINGS.untangleGap * k;
    const ringHalf = (SETTINGS.waypointSize / 2 + SETTINGS.untangleGap) * k;

    const live = chips.filter(c => c.offsetParent !== null);
    /* a chip's own coordinates -> where they land on screen, up to the one
       translation every chip shares (which cannot change an overlap) */
    const place = chip => {
      const px = parseFloat(chip.style.left) || 0, py = parseFloat(chip.style.top) || 0;
      const ox = chip.offsetWidth / 2, oy = chip.offsetHeight / 2;   // its transform-origin
      return (u, v) => ({ x: seen * (px + ox) + k * (u - ox), y: seen * (py + oy) + k * (v - oy) });
    };
    const rings = live.filter(c => !c.classList.contains("tm-crossing"))
                      .map(c => ({ chip: c, at: place(c)(0, 0) }));
    const hits = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

    const order = live.slice().sort((a, b) =>
      (b.classList.contains("is-open") ? 1 : 0) - (a.classList.contains("is-open") ? 1 : 0));
    const taken = [];
    order.forEach(chip => {
      const words = chip.querySelector(".tm-tag, .tm-cross");
      if (!words) return;
      const isTag = words.classList.contains("tm-tag");
      const w = words.offsetWidth, h = words.offsetHeight;
      const top = words.offsetTop - (isTag ? h / 2 : 0);     // a tag is centred on its ring
      const at = place(chip);
      const home = at(words.offsetLeft, top);
      const box = { x: home.x, y: home.y, w: w * k, h: h * k };
      const ring = at(0, 0);
      const tries = [["", box]];
      if (isTag) tries.push(["is-left", { ...box, x: 2 * ring.x - (box.x + box.w) }]);
      tries.push(["is-up",   { ...box, y: box.y - box.h - gap }],
                 ["is-down", { ...box, y: box.y + box.h + gap }]);
      const clear = r => !taken.some(t => hits(r, t)) &&
        !rings.some(o => o.chip !== chip &&
          hits(r, { x: o.at.x - ringHalf, y: o.at.y - ringHalf, w: 2 * ringHalf, h: 2 * ringHalf }));
      const pick = tries.find(([, r]) => clear(r));
      chip.classList.remove(...TANGLE_CLASSES);
      if (pick) { if (pick[0]) chip.classList.add(pick[0]); taken.push(pick[1]); }
      else chip.classList.add("is-hushed");
    });
  }

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
       autoplay.js and trail-graph.js are separate on purpose (neither is needed
       to read a trail, and neither should be able to break one), so everything
       they need comes through here. */
    deck,                                  // the cards, as waypoint-card.js made them
    closeAllCards, tapCard,
    putAway, putAwayAll,        // the same, with the line drawn back first
    /* THE TOUR SWITCHES AUTO-LOAD ON: with it off the walk opens nothing and the
       tour would scroll the whole trail past a blank map. It is a Layers panel
       switch, so the panel is redrawn to agree. */
    autoLoad: on => {
      if (autoLoadOn === !!on) return;
      autoLoadOn = !!on;
      reshapeTheCards();
      applyLayers(); buildPanels(); wake();
    },
    isAutoLoad: () => autoLoadOn,
    closePanels: () => { if (openPanel) showPanel(openPanel); },
    goToFraction, pageAtFraction, pageAtStop,
    liveStops, nearestStop,
    onALiveLayer: s => onALiveLayer(s),
    // true while the graph is being dragged: cards stay shut, the map still moves
    /* SOMEBODY HAS TAKEN THE WHEEL. Dragging the graph says a reader wants to go
       somewhere themselves, so the engine says so out loud and the tour, which
       does not know the graph exists, stops on hearing it. Anything else that
       takes hold of the walk should say the same. */
    scrubbing: on => { scrubbing = !!on; if (scrubbing) byHand(); wake(); },
    byHand,
    isScrubbing: () => scrubbing,
    front: () => frontCard,
    onAMeteredLine,
    /* HOW HIGH THE TRAIL IS AT A GIVEN FRACTION, and how many metres one map unit
       is: between them the graph can work out a gradient without the engine
       knowing what one is. */
    metresAt: f => pointAt(clamp(f, 0, 1) * routeLength).metres,
    perMetre,

    /* ── WHAT A RIDER ON THIS TRAIL NEEDS TO KNOW ───────────────────────
       cyclist.js draws a figure riding the route; its wheels must turn at the
       rate the ground goes past and it must lean into the heading. zoomNow()
       turns map-unit distance into the units the RIDER IS DRAWN IN (the rider
       hangs in the counter-scaled walking point, which near the finish and when
       a phone steps back is not exactly the map's own). pointAtFraction() samples
       the route; two points a hair apart give the heading. */
    zoomNow: () => (riderScale > 0 ? riderScale : 1),
    pointAtFraction: f => pointAt(clamp(f, 0, 1) * routeLength),
    trailWidth: () => SETTINGS.trailWidth,

    wake
  };

  /* ── A CLICK ON THE MAP PUTS THINGS AWAY ────────────────────────────────
     A click on empty map closes an open waypoint card and shuts the legend or
     layers panel. Everything that means something (a waypoint, crossing link,
     card, the rail, the panel) stops the click first, so the test names the
     things that are NOT the map rather than trying to name the map. */
  const NOT_THE_MAP = ".tm-card, .tm-label, #tm-rail, #tm-panel, #tm-stepper," +
                      " #tm-readouts, #tm-reader, .tm-cross, .tm-tourNote";
  el("stage").addEventListener("click", e => {
    if (e.target.closest && e.target.closest(NOT_THE_MAP)) return;
    if (bigOn()) return;             // the veil behind an expanded card owns this
    byHand();
    /* ONE PRESS, ONE THING PUT AWAY: the panel first (it opened last and lies
       over the card), the card on the next. Both going at once lost the
       waypoint somebody was reading when they pushed the panel aside. */
    if (openPanel) { showPanel(openPanel); nudge(); return; }
    if (frontCard >= 0 && !cardState[frontCard].closed) { putAwayAll(); nudge(); }
  });

  /* THE PAGE IS READY, AND SAYS SO. autoplay.js and trail-graph.js depend on
     things that exist only once the artwork has loaded and the waypoints are
     placed (the cards, the graph's dots, window.TRAIL); both wait for this. */
  document.dispatchEvent(new CustomEvent("trail:ready", { detail: window.TRAIL }));

  /* If there was no waypoint to find, nothing will take the cover down later
     and the page is already showing what it means to show. This sits ABOVE the
     reader because the reader may be switched off, and switching it off must
     not leave the page covered. */
  if (!SETTINGS.linkToStops || location.hash.length < 2) uncover();

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
  // the E key is the only way into the reader
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
