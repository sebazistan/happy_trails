/* ═══════════════════════════════════════════════════════════════════════════
   HAPPY TRAILS — THE CONTACT FORM
   version 1.3

   A form on a site with no server behind it: GitHub Pages serves files and
   runs nothing, so there is nobody to receive a POST. The old
   <form action="mailto:…" method="post" enctype="text/plain"> trick triggers
   Chrome's "not secure" warning and then either opens a message full of
   URL-encoded rubbish or does nothing, so the form does not submit at all.

   Pressing Send posts the message to Web3Forms, which mails it to the owner.
   The access key is not a secret: Web3Forms designs it to sit in public pages
   and only ever lets it send to the address it was registered with.

   A CHECK-BOX SITS ABOVE THE BUTTON (hCaptcha, drawn by Web3Forms' script). The
   page refuses to post until it has been ticked, but only when the box was
   actually drawn: if the script never loaded there is nothing to tick, and
   holding the reader back would be worse than letting Web3Forms judge.

   If the post fails (offline, the service down) the page says so and offers
   the message to copy, and a mailto link to send it by hand.

   WITH SETTINGS.postTo EMPTY the form falls back to opening the reader's own
   mail app, already filled in and addressed, which is also how to swap in a
   different form service later.
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  "use strict";

  /* ── THE NUMBERS AND THE WORDS ────────────────────────────────────────── */
  var SETTINGS = {
    to:       "sebazistan@gmail.com",
    subject:  "Happy Trails — a note from {name}",

    /* An endpoint to POST to instead of opening a mail app. Empty means "open
       the reader's mail app". */
    postTo:   "https://api.web3forms.com/submit",
    accessKey: "ac6ce238-e144-412d-ad53-b119a99b03e5",   // Web3Forms' public key for this form

    /* How long to wait after handing the address to the browser before saying
       anything: if a mail app opened nobody reads this, and if not, the reader
       is looking at a form that appears to have done nothing. */
    waitMs:   1200,
    saidMs:   4000      // how long "copied" stays said
  };

  var WORDS = {
    opening:  "Opening your mail app…",
    noMail:   "If nothing opened, your browser has no mail app set up — " +
              "copy the message and send it from wherever you write mail.",
    copy:     "Copy the message",
    copied:   "Copied — paste it into a new message to " + SETTINGS.to,
    failed:   "That did not work. Write to " + SETTINGS.to + " instead.",
    sent:     "Thank you — your message is on its way.",
    sending:  "Sending…",
    tick:     "Please tick the box to show you are not a robot, then send again."
  };

  var form = document.querySelector(".pt-contact");
  if (!form) return;

  var say = form.querySelector(".pt-formSay");
  var copyBtn = form.querySelector(".pt-formCopy");
  var send = form.querySelector(".pt-send");
  var said;

  function field(name) {
    var el = form.querySelector("[name=" + name + "]");
    return el ? el.value.trim() : "";
  }

  /* THE MESSAGE, AS SOMEBODY WOULD WRITE IT: name and address go at the end,
     like a signature, so it reads like a note rather than a database row. */
  function theMessage() {
    return field("message") + "\n\n— " + field("name") +
           "\n" + field("email") + "\n";
  }

  function theSubject() {
    return SETTINGS.subject.replace("{name}", field("name") || "a reader");
  }

  function tell(words, how) {
    if (!say) return;
    say.textContent = words;
    say.className = "pt-formSay is-on" + (how ? " " + how : "");
  }

  /* ── COPYING, WHICH HAS TO WORK WITHOUT THE MODERN API ────────────────── */
  function copyIt() {
    var text = "To: " + SETTINGS.to + "\nSubject: " + theSubject() +
               "\n\n" + theMessage();
    var done = function () {
      tell(WORDS.copied, "is-good");
      clearTimeout(said);
      said = setTimeout(function () { tell(WORDS.noMail); }, SETTINGS.saidMs);
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done, older);
      return;
    }
    older();

    /* For plain http and older browsers with no navigator.clipboard: a
       textarea off the side of the page, selected, and the browser's copy
       command. */
    function older() {
      var box = document.createElement("textarea");
      box.value = text;
      box.setAttribute("readonly", "");
      box.style.cssText = "position:absolute;left:-9999px;top:0";
      document.body.appendChild(box);
      box.select();
      try { document.execCommand("copy"); done(); }
      catch (e) { tell(WORDS.failed, "is-bad"); }
      document.body.removeChild(box);
    }
  }

  if (copyBtn) copyBtn.addEventListener("click", copyIt);

  /* ── AND SENDING ──────────────────────────────────────────────────────── */
  form.addEventListener("submit", function (e) {
    /* Always: the form has no action, and a reload would throw away what the
       reader typed. */
    e.preventDefault();
    if (form.checkValidity && !form.checkValidity()) {
      form.reportValidity();
      return;
    }

    if (SETTINGS.postTo) {
      postIt();
      return;
    }

    /* location.href rather than window.open: a popup blocker stops the second
       and nothing stops the first. */
    tell(WORDS.opening);
    window.location.href = "mailto:" + encodeURIComponent(SETTINGS.to) +
      "?subject=" + encodeURIComponent(theSubject()) +
      "&body=" + encodeURIComponent(theMessage());

    /* No browser reports whether a mail app opened, so wait a moment and then
       offer the copy route. */
    clearTimeout(said);
    said = setTimeout(function () {
      tell(WORDS.noMail);
      if (copyBtn) copyBtn.hidden = false;
    }, SETTINGS.waitMs);
  });

  /* The form-service path, used when SETTINGS.postTo is filled in. */
  function postIt() {
    var drawn = form.querySelector(".h-captcha iframe");
    var answer = form.querySelector("[name='h-captcha-response']");
    if (drawn && !(answer && answer.value)) { tell(WORDS.tick, "is-bad"); return; }
    tell(WORDS.sending);
    if (send) send.disabled = true;
    var body = new FormData(form);
    body.append("access_key", SETTINGS.accessKey);
    body.append("subject", theSubject());
    body.append("from_name", "Happy Trails contact form");
    fetch(SETTINGS.postTo, {
      method: "POST",
      headers: { "Accept": "application/json" },
      body: body
    }).then(function (r) {
      return r.json().then(function (data) {
        if (!r.ok || data.success === false) throw new Error(data.message || r.status);
      });
    }).then(function () {
      form.reset();
      tell(WORDS.sent, "is-good");
    }).catch(function () {
      tell(WORDS.failed, "is-bad");
      if (copyBtn) copyBtn.hidden = false;
    }).then(function () {
      if (send) send.disabled = false;
    });
  }
})();
