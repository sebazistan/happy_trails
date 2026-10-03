/* ═══════════════════════════════════════════════════════════════════════════
   HAPPY TRAILS — WHAT THE BROWSER REMEMBERS
   version 1.3

   TWO SMALL KINDNESSES, both the same idea: this browser has been here before,
   and the page can be a little more useful for knowing it.

     ON A TRAIL PAGE: how far along you had got. A trail is nine screenfuls of
     scrolling, and finding yourself at the trailhead again after stopping to
     do something else is a small tax. A chip offers to put you back, once, and
     takes no for an answer.

     ON THE WISHFUL THINKING PAGE: which proposals are new. Not from a date
     (nothing here carries one and somebody would have to remember to set it)
     but from the LIST: the addresses of the proposals on the page last time
     are kept, and anything not among them is new. Add a proposal to
     trails_data.py and it marks itself for everybody who has been here before.

   NOTHING HERE IS LOAD-BEARING. Every read and write is wrapped, since storage
   throws in a private window. With storage unavailable a trail page does not
   offer to resume and the wishful page marks nothing, which is exactly what a
   first visit looks like.

   NOTHING IS SENT ANYWHERE: one number and one list of addresses, kept in this
   browser.

   TO USE IT:  <script src="js/remembers.js"></script>. It works out for itself
   which of the two pages it is on, and does nothing on any other.
   ═══════════════════════════════════════════════════════════════════════════ */

(function () {
  "use strict";

  const SETTINGS = {
    /* ── RESUMING A TRAIL ──────────────────────────────────────────────────  */
    /* How far along you have to have got before it is worth remembering, and
       how far from the top you have to be on ARRIVAL before it is worth
       offering. Both a fraction of the walk: under a tenth is somebody who
       glanced at the trailhead, and offering to put them back would move them
       nowhere. */
    worthKeeping: 0.08,
    worthOffering: 0.1,
    /* how long the offer stands before it takes silence for an answer */
    offerFor:     12000,
    /* and how long it ignores the scroll before taking THAT for an answer (see
       the note where the listeners are hung) */
    deafFor:      900,
    /* how often the position is written down, in milliseconds; not on every
       scroll event, which would be a write to disk sixty times a second */
    keepEvery:    1200,
    /* forgotten after this many days: a trail you read a month ago is not one
       you are in the middle of */
    forgetAfter:  30,

    /* ── THE WISHFUL PAGE ──────────────────────────────────────────────────  */
    newWord:      "New",
    /* a first visit marks nothing, and neither does a visit after a great many
       were added: "everything is new" is not news */
    markAtMost:   6,

    /* Raise either key and everybody starts with a clean memory, which is what
       you want if the meaning of what is stored changes. NOTE: the trail key is
       also written out in full at the top of the file, where the book is
       snapshotted before SETTINGS exists; change it in both places. */
    trailKey:     "happy-trails:where:1",
    wishKey:      "happy-trails:wishful-seen:1",
  };

  /* ── STORAGE, WITHOUT THE SHARP EDGES ────────────────────────────────────  */
  function read(key) {
    try { return window.localStorage.getItem(key); } catch (e) { return null; }
  }
  function write(key, value) {
    try { window.localStorage.setItem(key, value); } catch (e) { /* fine */ }
  }

  /* ══ TWO THINGS READ NOW, BEFORE THE PAGE CAN CHANGE THEM ════════════════
     This file's body runs while the document is still parsing, before the
     engine has fetched its artwork or anything has scrolled, which is the only
     moment either of these is still true.

     THE ADDRESS. A trail page puts the waypoint you stand at in the address bar
     as you walk, within a moment of loading, so by the time the engine is ready
     every trail page has a #hash. The offer is refused when the address asks
     for somewhere in particular (don.html#half-mile-bridge is already a
     request), so read late that test refused EVERY time.

     THE BOOK. The position is deleted when you are near the top, which is where
     you are on arrival, so the first write after loading erased the very entry
     the offer was about to read. Snapshotted here, it cannot be. */
  const ARRIVED_ON = location.hash;
  const BOOK_ON_ARRIVAL = (function () {
    try { return JSON.parse(read("happy-trails:where:1") || "{}") || {}; }
    catch (e) { return {}; }
  })();

  /* ════════════════════════════════════════════════════════════════════════
     ONE: WHERE YOU HAD GOT TO ON A TRAIL
     ════════════════════════════════════════════════════════════════════════ */
  function rememberTheTrail() {
    const TRAIL = window.TRAIL;
    if (!TRAIL || !TRAIL.where || !TRAIL.goToFraction) return;

    /* one entry per trail, keyed on the page itself, so reading the Humber
       does not move your place on the Don */
    const mine = location.pathname;
    const all = () => {
      try { return JSON.parse(read(SETTINGS.trailKey) || "{}") || {}; }
      catch (e) { return {}; }
    };

    /* ── KEEPING IT ────────────────────────────────────────────────────────  */
    let due = 0;
    function keep() {
      const at = TRAIL.where();
      const book = all();
      if (at < SETTINGS.worthKeeping) delete book[mine];
      else book[mine] = { at: Math.round(at * 1000) / 1000, on: Date.now() };
      write(SETTINGS.trailKey, JSON.stringify(book));
    }
    addEventListener("scroll", () => {
      clearTimeout(due);
      due = setTimeout(keep, SETTINGS.keepEvery);
    }, { passive: true });
    /* and once on the way out, the one moment it is certain to matter:
       `pagehide` rather than `unload`, which a phone never fires */
    addEventListener("pagehide", keep);

    /* ── OFFERING IT ───────────────────────────────────────────────────────
       Only from the top of the page, and only when no address asks for
       somewhere in particular (a chip offering somewhere else would be an
       argument rather than an offer). */
    if (ARRIVED_ON) return;
    if (TRAIL.where() > SETTINGS.worthOffering) return;

    const was = BOOK_ON_ARRIVAL[mine];
    if (!was || !was.at || was.at < SETTINGS.worthOffering) return;
    if (Date.now() - (was.on || 0) > SETTINGS.forgetAfter * 864e5) return;

    const W = TRAIL.WORDS || {};
    const chip = document.createElement("div");
    chip.className = "tm-resume";
    chip.setAttribute("role", "status");
    chip.innerHTML =
      "<span></span>" +
      '<button class="is-go" type="button"></button>' +
      '<button class="is-no" type="button"></button>';
    chip.querySelector("span").textContent =
      (W.resumeTitle || "Carry on where you left off?");
    chip.querySelector(".is-go").textContent = W.resumeGo || "Resume";
    chip.querySelector(".is-no").textContent = W.resumeNo || "Start again";
    document.body.appendChild(chip);
    requestAnimationFrame(() => chip.classList.add("is-on"));

    let going = 0;
    const away = () => {
      clearTimeout(going);
      chip.classList.remove("is-on");
      setTimeout(() => { if (chip.parentNode) chip.parentNode.removeChild(chip); }, 300);
    };
    chip.querySelector(".is-go").addEventListener("click", () => {
      TRAIL.goToFraction(was.at);
      away();
    });
    chip.querySelector(".is-no").addEventListener("click", () => {
      const book = all();
      delete book[mine];
      write(SETTINGS.trailKey, JSON.stringify(book));
      away();
    });
    /* SILENCE IS AN ANSWER, and the answer is no. It also goes the moment
       somebody starts reading: scrolling past the offer is a decision.

       NOT FOR THE FIRST MOMENT, THOUGH. The page is still settling when the
       chip arrives (the artwork has just landed, a trackpad may still be
       coasting from the last page), and a chip that takes the first wheel event
       for an answer is never seen. It listens only once it has been up long
       enough to have been read. */
    going = setTimeout(away, SETTINGS.offerFor);
    setTimeout(() => {
      addEventListener("wheel", away, { passive: true, once: true });
      addEventListener("touchstart", away, { passive: true, once: true });
    }, SETTINGS.deafFor);
  }

  /* ════════════════════════════════════════════════════════════════════════
     TWO: WHAT IS NEW ON THE WISHFUL THINKING PAGE
     ════════════════════════════════════════════════════════════════════════ */
  function markWhatIsNew() {
    const cards = Array.prototype.slice.call(document.querySelectorAll(".wt-card"));
    if (!cards.length) return;

    /* a proposal's address is its identity: it is where the thing IS, so it
       cannot drift the way a title or a list position can */
    const nameOf = card => {
      const link = card.querySelector(".wt-open");
      return link ? link.getAttribute("href") : null;
    };
    const here = cards.map(nameOf).filter(Boolean);
    if (!here.length) return;

    let before = null;
    try { before = JSON.parse(read(SETTINGS.wishKey) || "null"); }
    catch (e) { before = null; }

    /* always write what is here now, even on a first visit, so the SECOND
       visit can say something */
    write(SETTINGS.wishKey, JSON.stringify(here));

    if (!Array.isArray(before) || !before.length) return;   // first visit
    const seen = new Set(before);
    const fresh = cards.filter(card => {
      const name = nameOf(card);
      return name && !seen.has(name);
    });
    /* everything is new is not news: somebody returning after a very long
       time, or the list rebuilt */
    if (!fresh.length || fresh.length > SETTINGS.markAtMost) return;

    fresh.forEach(card => {
      const flag = document.createElement("span");
      flag.className = "wt-new";
      flag.textContent = SETTINGS.newWord;
      card.appendChild(flag);
    });
  }

  /* Both signals below can arrive, and on a trail page both do; once is
     enough, since twice would hang two sets of listeners on the scroll and pin
     a second badge to every new proposal. */
  let started = false;
  function begin() {
    if (started) return;
    const onATrail = document.body.classList.contains("page-trail");
    /* ── WHY THE RESUME CHIP NEVER APPEARED ────────────────────────────────
       A trail page has no window.TRAIL until its artwork has loaded, and `load`
       fires BEFORE that. So the load fallback arrived first, found no engine,
       and latched, and the later `trail:ready` that could have worked was
       refused as a second run. It therefore latches only once it has had
       something to work with. */
    if (onATrail && !window.TRAIL) return;
    started = true;
    if (onATrail) rememberTheTrail();
    markWhatIsNew();
  }

  /* a trail page has no window.TRAIL until the artwork has loaded, so this
     waits for the same word the tour and the graph wait for; the wishful page
     never says it, so that one runs on `load` */
  document.addEventListener("trail:ready", begin);
  window.addEventListener("load", () => setTimeout(begin, 0));
})();
