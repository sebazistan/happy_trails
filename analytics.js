/* ═══════════════════════════════════════════════════════════════════════════
   HAPPY TRAILS — COUNTING VISITS
   version 1.0

   THIS FILE DOES NOTHING UNTIL YOU FILL IN ONE LINE. Every page loads it, so
   there is exactly one place to turn measurement on, one place to turn it off,
   and no page that quietly disagrees with the others.

   ── WHY BOTHER ──────────────────────────────────────────────────────────
   The question this site cannot currently answer is the only one that decides
   what to build next: DOES ANYONE GET TO THE END OF A TRAIL PAGE? A trail is a
   scroll from top to bottom, and if readers stop at the second waypoint then
   the format is wrong and no amount of new trails will fix it. If they reach
   the bottom, then writing the other nine trails is obviously the right thing
   to do. Visit counts alone will not tell you; depth will. So this sends four
   marks per trail page — a quarter, halfway, three quarters, the end — and
   nothing else.

   ── WHAT IT DELIBERATELY DOES NOT DO ────────────────────────────────────
   No cookies. No identifiers. No third-party advertising network. Nothing
   about a reader is stored by this file, and every provider below is one that
   works without any of that. If a reader has asked not to be tracked — Do Not
   Track, or Global Privacy Control — this file honours it and loads nothing at
   all, which is not the legal minimum and is the right behaviour.

   ── TO TURN IT ON ───────────────────────────────────────────────────────
   Set PROVIDER to one of "plausible", "goatcounter", "cloudflare", and fill in
   the one setting it needs. Leave it "" and this file stays inert.
   ═══════════════════════════════════════════════════════════════════════════ */

(function () {
  "use strict";

/* ── THE ONLY SETTINGS ──────────────────────────────────────────────────── */
const SETTINGS = {
  version:      "1.0",

  /* "" | "plausible" | "goatcounter" | "cloudflare"  */
  provider:     "",

  /* plausible — the domain as registered with them. Self-hosting? change
     plausibleHost too. */
  domain:       "happytrailstoronto.com",
  plausibleHost:"https://plausible.io",

  /* goatcounter — the whole endpoint they give you */
  goatcounter:  "https://YOURCODE.goatcounter.com/count",

  /* cloudflare web analytics — the token from its snippet */
  cloudflare:   "",

  /* honour a reader who has asked not to be measured. Leave this true. */
  respectDoNotTrack: true,

  /* how far down a trail page counts as a milestone. Four is enough to see the
     shape of the drop-off and few enough to stay cheap. */
  depthMarks:   [25, 50, 75, 100],
  depthEvery:   400            // ms between checks while scrolling
};

/* ── DO NOT MEASURE SOMEONE WHO HAS ASKED NOT TO BE ─────────────────────── */
const refused = SETTINGS.respectDoNotTrack && (
  navigator.doNotTrack === "1" || window.doNotTrack === "1" ||
  navigator.msDoNotTrack === "1" || navigator.globalPrivacyControl === true);

if (!SETTINGS.provider || refused) return;

/* ── LOAD WHICHEVER ONE IS CHOSEN ───────────────────────────────────────── */
function script(src, attrs) {
  const s = document.createElement("script");
  s.src = src; s.defer = true;
  Object.keys(attrs || {}).forEach(k => s.setAttribute(k, attrs[k]));
  document.head.appendChild(s);
  return s;
}

if (SETTINGS.provider === "plausible") {
  /* the events build, because the depth marks below are events */
  window.plausible = window.plausible || function () {
    (window.plausible.q = window.plausible.q || []).push(arguments);
  };
  script(SETTINGS.plausibleHost + "/js/script.manual.js",
         { "data-domain": SETTINGS.domain });
  if (window.plausible) window.plausible("pageview");
} else if (SETTINGS.provider === "goatcounter") {
  script("https://gc.zgo.at/count.js", { "data-goatcounter": SETTINGS.goatcounter });
} else if (SETTINGS.provider === "cloudflare") {
  script("https://static.cloudflareinsights.com/beacon.min.js",
         { "data-cf-beacon": JSON.stringify({ token: SETTINGS.cloudflare }) });
}

/* ── ONE WAY TO RECORD SOMETHING, WHICHEVER PROVIDER IS ON ──────────────── */
/* Each of them spells this differently and two of them may not have finished
   loading yet, so a mark that cannot be sent is dropped rather than queued
   forever — a lost count is not worth a memory leak. */
function mark(name) {
  try {
    if (window.plausible) { window.plausible(name); return; }
    if (window.goatcounter && window.goatcounter.count) {
      window.goatcounter.count({ path: location.pathname + "#" + name,
                                 title: name, event: true });
    }
  } catch (e) { /* measurement must never break the page */ }
}

/* ── HOW FAR DOWN A TRAIL PAGE PEOPLE ACTUALLY GET ──────────────────────── */
/* Only on the pages where it means anything. A reading page is short and a map
   page does not scroll, so depth on either would be noise. */
if (document.body.classList.contains("page-trail")) {
  const left = SETTINGS.depthMarks.slice();
  const trail = (location.pathname.split("/").pop() || "trail").replace(/\.html$/, "");
  let due = 0;
  addEventListener("scroll", function () {
    const now = Date.now();
    if (now < due || !left.length) return;
    due = now + SETTINGS.depthEvery;
    const height = document.documentElement.scrollHeight - innerHeight;
    const how = height > 0 ? Math.round((scrollY / height) * 100) : 100;
    while (left.length && how >= left[0]) mark("depth " + trail + " " + left.shift() + "%");
  }, { passive: true });
}

})();
