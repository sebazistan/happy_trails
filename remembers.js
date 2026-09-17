/* ═══════════════════════════════════════════════════════════════════════════
   HAPPY TRAILS — WHAT THE BROWSER REMEMBERS
   version 1.0

   TWO SMALL KINDNESSES, both of them the same idea: this browser has been here
   before, and the page can be a little more useful for knowing it.

     ON A TRAIL PAGE — how far along you had got. A trail is nine screenfuls of
     scrolling; coming back to one and finding yourself at the trailhead again
     is a small tax on having stopped to do something else. A chip offers to
     put you back. It offers, once, and takes no for an answer.

     ON THE WISHFUL THINKING PAGE — which proposals are new. Not from a date,
     because nothing on this site carries one and a date is a thing somebody
     has to remember to set. From the LIST: the addresses of the proposals that
     were on the page last time are kept, and anything not among them is new.
     Add a proposal to trails_data.py and it marks itself, for everybody who
     has been here before and for nobody who has not.

   NOTHING HERE IS LOAD-BEARING. Every read and every write is wrapped: storage
   throws rather than returning null in a private window, and neither of these
   is worth a broken page. With storage unavailable, a trail page simply does
   not offer to resume and the wishful page marks nothing — which is exactly
   what a first visit looks like, and a first visit is correct.

   NOTHING IS SENT ANYWHERE. It is one number and one list of addresses from
   this page, in this browser, and no part of it leaves the machine.

   TO USE IT:  <script src="remembers.js"></script>. It works out for itself
   which of the two pages it is on, and does nothing on any other.
   ═══════════════════════════════════════════════════════════════════════════ */

(function () {
  "use strict";

  const SETTINGS = {
    /* ── RESUMING A TRAIL ──────────────────────────────────────────────────  */
    /* How far along you have to have got before it is worth remembering, and
       how far from the top you have to be on ARRIVAL before it is worth
       offering. Both as a fraction of the walk: under a tenth is somebody who
       glanced at the trailhead, and offering to put them back where they were
       would be offering to move them nowhere. */
    worthKeeping: 0.08,
    worthOffering: 0.1,
    /* and how long the offer stands before it takes silence for an answer */
    offerFor:     12000,
    /* how often the position is written down, in milliseconds. Not on every
       scroll event: that is a write to disk sixty times a second. */
    keepEvery:    1200,
    /* it is forgotten after this long, in days — a trail you were reading a
       month ago is not a trail you are in the middle of */
    forgetAfter:  30,

    /* ── THE WISHFUL PAGE ──────────────────────────────────────────────────  */
    newWord:      "New",
    /* a first visit marks nothing, however many proposals there are; and a
       visit after a great many have been added marks nothing either, because
       "everything is new" is not news */
    markAtMost:   6,

    /* Raise either of these and everybody starts again with a clean memory,
       which is what you want if the meaning of what is stored ever changes. */
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
    /* and once on the way out, which is the one moment it is certain to
       matter — `pagehide` rather than `unload`, which a phone never fires */
    addEventListener("pagehide", keep);

    /* ── OFFERING IT ───────────────────────────────────────────────────────
       Only from the top of the page, and only when there is no address asking
       for somewhere in particular: arriving at don.html#half-mile-bridge is
       already a request to be put somewhere, and a chip offering to put you
       somewhere else is an argument rather than an offer. */
    if (location.hash) return;
    if (TRAIL.where() > SETTINGS.worthOffering) return;

    const was = all()[mine];
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
       somebody starts reading — scrolling past the offer is a decision. */
    going = setTimeout(away, SETTINGS.offerFor);
    addEventListener("wheel", away, { passive: true, once: true });
    addEventListener("touchstart", away, { passive: true, once: true });
  }

  /* ════════════════════════════════════════════════════════════════════════
     TWO: WHAT IS NEW ON THE WISHFUL THINKING PAGE
     ════════════════════════════════════════════════════════════════════════ */
  function markWhatIsNew() {
    const cards = Array.prototype.slice.call(document.querySelectorAll(".wt-card"));
    if (!cards.length) return;

    /* a proposal's address is its identity: it is where the thing IS, so it
       cannot drift the way a title or a position in a list can */
    const nameOf = card => {
      const link = card.querySelector(".wt-open");
      return link ? link.getAttribute("href") : null;
    };
    const here = cards.map(nameOf).filter(Boolean);
    if (!here.length) return;

    let before = null;
    try { before = JSON.parse(read(SETTINGS.wishKey) || "null"); }
    catch (e) { before = null; }

    /* always write what is here now, even on a first visit — that is what
       makes the SECOND visit able to say anything */
    write(SETTINGS.wishKey, JSON.stringify(here));

    if (!Array.isArray(before) || !before.length) return;   // first visit
    const seen = new Set(before);
    const fresh = cards.filter(card => {
      const name = nameOf(card);
      return name && !seen.has(name);
    });
    /* everything is new is not news — that is somebody coming back after a
       very long time, or the list having been rebuilt */
    if (!fresh.length || fresh.length > SETTINGS.markAtMost) return;

    fresh.forEach(card => {
      const flag = document.createElement("span");
      flag.className = "wt-new";
      flag.textContent = SETTINGS.newWord;
      card.appendChild(flag);
    });
  }

  /* Both signals below can arrive, and on a trail page both do. Once is
     enough: twice would hang two sets of listeners on the scroll and pin a
     second badge to every new proposal. */
  let started = false;
  function begin() {
    if (started) return;
    started = true;
    if (document.body.classList.contains("page-trail")) rememberTheTrail();
    markWhatIsNew();
  }

  /* a trail page has no window.TRAIL until the artwork has loaded, so this
     waits for the same word the tour and the graph wait for; the wishful page
     never says it, so that one runs on `load` */
  document.addEventListener("trail:ready", begin);
  window.addEventListener("load", () => setTimeout(begin, 0));
})();
