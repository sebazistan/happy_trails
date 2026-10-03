/* ═══════════════════════════════════════════════════════════════════════════
   HAPPY TRAILS — COUNTING VISITS
   version 1.1

   THIS FILE DOES NOTHING UNTIL YOU FILL IN ONE LINE. Every page loads it, so
   there is one place to turn measurement on and off.

   WHY: the question that decides what to build next is whether anyone gets to
   the end of a trail page. If readers stop at the second waypoint the format
   is wrong; if they reach the bottom, writing more trails is right. Visit
   counts will not tell you that; depth will, so this sends four marks per
   trail page (a quarter, halfway, three quarters, the end) and nothing else.

   PRIVACY: no cookies, no identifiers, no advertising network, and every
   provider below works without any of that. A reader who has asked not to be
   tracked (Do Not Track or Global Privacy Control) gets nothing loaded.

   TO TURN IT ON: set PROVIDER to "plausible", "goatcounter" or "cloudflare"
   and fill in the one setting it needs. Leave it "" and this file stays inert.
   ═══════════════════════════════════════════════════════════════════════════ */

(function () {
  "use strict";

/* ── THE ONLY SETTINGS ──────────────────────────────────────────────────── */
const SETTINGS = {
  version:      "1.1",

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
  /* the events build, because the depth marks are events */
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
/* Each provider spells this differently and may not have finished loading, so a
   mark that cannot be sent is dropped rather than queued. */
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
/* Trail pages only: reading pages are short and map pages do not scroll, so
   depth there would be noise. */
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
