BEFORE YOU UPLOAD THIS FOLDER
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
