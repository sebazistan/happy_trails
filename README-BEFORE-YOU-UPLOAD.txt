UPLOAD THE CONTENTS, NOT THE FOLDER
════════════════════════════════════════════════════════════════════════════

Unzipping gives you a folder called site-assets-v2.4. GitHub must end up with
index.html at the TOP of the repository — not inside a folder.

  RIGHT   open site-assets-v2.4, select everything inside it, drag that
  WRONG   drag the site-assets-v2.4 folder itself

Dragging the folder puts the whole site at happytrailstoronto.com/site-assets-v2.4/
and leaves the old one exactly where it was. The site keeps working, keeps
showing the old version, and nothing anywhere reports an error — which is why
this is easy to do twice.

HOW TO TELL WHICH VERSION IS LIVE

  Visit   happytrailstoronto.com/version.txt

It says one line: the version, and when it was built. If it says 2.4 the upload
landed and anything you are still seeing is your browser's cache — reload with
Cmd+Shift+R (Mac) or Ctrl+F5 (Windows). If it is missing or says an older
number, the files did not land at the top of the repository.

The main map also shows the version in its top-right corner.

════════════════════════════════════════════════════════════════════════════

TWO FILES YOU CANNOT SEE
════════════════════════════════════════════════════════════════════════════

Upload EVERYTHING in this folder, including two files you cannot see by
default because their names begin with a dot or are all capitals:

  CNAME       one line: happytrailstoronto.com
  .nojekyll   an empty file

WHY THOSE TWO MATTER

CNAME is what tells GitHub Pages that this site answers to your domain. The
setting in Settings ▸ Pages ▸ Custom domain and this file are the same thing —
GitHub writes this file when you type the domain in, and reads it on every
upload. So if you upload a set of files WITHOUT it, GitHub sees the domain has
been removed and clears the setting. The site then goes back to being served
only at <your username>.github.io, and the custom domain has to be entered
again. That is the usual reason a domain that was working stops working after
an upload.

  If Settings ▸ Pages shows www.happytrailstoronto.com rather than
  happytrailstoronto.com, open CNAME and put the www version in it instead.
  The file and the setting have to say exactly the same thing.

.nojekyll turns off the blog engine GitHub Pages runs over uploaded files by
default. This site is already finished HTML and does not want anything done to
it; the empty file says so.

SHOWING HIDDEN FILES, so you can drag them
  Mac       in Finder, press Cmd + Shift + .
  Windows   in Explorer, View menu ▸ tick "Hidden items"
