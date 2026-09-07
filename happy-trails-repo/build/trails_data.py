"""
The nine trails that get a page, and the temp content each one starts with.

The geography is REAL — which river a trail follows, whether it climbs or falls,
roughly how long it is — because that is what makes the placeholder useful to
look at. The waypoint text is obviously not: it is there so the cards have
something in them and the layout can be judged. Every one of these pages is
meant to be rewritten the way the Beltline was.
"""

TRAILS = [
  dict(
    slug="etobicoke", name="Etobicoke Creek", kind="river", seed=11,
    kicker="TYPE: RAVINE / LENGTH: 15.4 KM", length=15.4,
    # Walked from the top of the valley down to the lake. It used to be walked
    # the other way, which put its northern end at the bottom of the drawing:
    # the page scrolled downwards while the journey went up it. Every trail here
    # now runs the way the page does — north to south, left to right.
    lead="A creek-side route down through Etobicoke to the lake at Marie Curtis "
         "Park, mostly in the valley and mostly away from traffic.",
    from_to=(560, 220, 1180, 2260), wobble=250, offset=86, rail_y=980,
    places=[(1450, 520, "Etobicoke", 62), (700, 1900, "Marie Curtis", 44),
            (2400, 1400, "Alderwood", 44)],
    meets=[
      (0.00, "w-humber", "West Humber"),
      (1.00, "waterfront", "Waterfront Trail"),
    ],
    stops=[
      ("Etobicoke North",    0.00, 142, "The northern end, for now"),
      ("Eglinton gap",       0.15, 131, "The trail stops and the road starts", "wishful", "medium", "high"),
      ("Centennial Park",    0.32, 118, "The valley opens out"),
      ("Sherway",            0.54,  93, "The trail brushes a shopping mall"),
      ("Under the QEW",      0.72,  84, "Loud, dark, and mercifully short"),
      ("Lakeshore crossing", 0.88,  79, "A signalised crossing, badly timed"),
      ("Marie Curtis Park",  1.00,  76, "Where the creek meets the lake"),
    ]),
  dict(
    slug="w-humber", name="West Humber", kind="river", seed=23,
    kicker="TYPE: RAVINE / LENGTH: 12.8 KM", length=12.8,
    lead="The West Humber branch, running from the river junction out to the "
         "north-west through a long chain of parkland.",
    from_to=(900, 300, 2900, 1900), wobble=190, offset=-80, rail_y=1500,
    places=[(1900, 700, "Rexdale", 58), (2700, 1600, "Humber Junction", 44)],
    meets=[
      (0.00, "humber", "Humber River"),
      (1.00, "finch", "Finch Corridor"),
    ],
    stops=[
      ("Humber North",      0.00, 158, "Farmland begins"),
      ("Steeles",           0.18, 151, "The city boundary"),
      ("Finch crossing",    0.37, 139, "Under the hydro lines"),
      ("Claireville",       0.58, 128, "The reservoir edge"),
      ("Albion Road",       0.82, 112, "A road crossing with no signal", "wishful", "medium", "high"),
      ("Humber junction",   1.00, 104, "Where the two branches meet"),
    ]),
  dict(
    slug="humber", name="Humber River", kind="river", seed=31,
    kicker="TYPE: RAVINE / LENGTH: 18.1 KM", length=18.1,
    # (the stops here already ran north to south; only the sentence describing
    #  them was pointing the other way)
    lead="The Humber from the north end of the city down to the lake — the "
         "longest continuous off-road route in the west end, and one of the "
         "oldest.",
    from_to=(700, 320, 2950, 2180), wobble=230, offset=88, rail_y=1250,
    places=[(2900, 900, "Weston", 58), (1500, 2050, "Humber Bay", 48)],
    meets=[
      (0.00, "w-humber", "West Humber"),
      (0.46, "finch", "Finch Corridor"),
      (1.00, "waterfront", "Waterfront Trail"),
    ],
    stops=[
      ("Humber North",      0.00, 152, "The top of the valley"),
      ("Sheppard",          0.12, 143, "Wide and quiet"),
      ("Rockcliffe gap",    0.28, 128, "A missing link under the rail", "wishful", "high", "high"),
      ("Weston",            0.42, 121, "The trail meets the town"),
      ("Lambton",           0.62, 106, "An old mill site"),
      ("Old Mill",          0.80,  92, "The valley narrows"),
      ("Humber Bay Arch",   1.00,  76, "The bridge everyone photographs"),
    ]),
  dict(
    slug="finch", name="Finch Corridor", kind="corridor", seed=43,
    kicker="TYPE: HYDRO CORRIDOR / LENGTH: 11.2 KM", length=11.2,
    lead="A straight east-west run under the transmission lines, flat and open "
         "the whole way, with the road crossings as its only interruptions.",
    from_to=(300, 1000, 3300, 1320), rail_y=1900, parks=4,
    places=[(1200, 620, "North York", 58), (2700, 1850, "Finch West", 44)],
    meets=[
      (0.00, "humber", "Humber River"),
      (1.00, "e-don", "East Don"),
    ],
    stops=[
      ("Weston Road",     0.00, 168, "The western end"),
      ("Jane Street",     0.22, 172, "A crossing that needs a signal", "wishful", "medium", "low"),
      ("Keele",           0.44, 176, "Open and exposed"),
      ("Dufferin",        0.66, 179, "Allotments beside the path"),
      ("Bathurst",        0.86, 183, "The corridor narrows"),
      ("Yonge",           1.00, 186, "The eastern end"),
    ]),
  dict(
    slug="waterfront", name="Waterfront", kind="waterfront", seed=57,
    kicker="TYPE: WATERFRONT / LENGTH: 22.6 KM", length=22.6,
    lead="The lake shore from end to end. Flat, busy, and the spine that every "
         "other trail in the city eventually connects to.",
    shore_y=1560, rail_y=620, parks=5,
    places=[(700, 700, "Parkdale", 56), (2200, 640, "Downtown", 62),
            (3200, 760, "The Beaches", 50)],
    meets=[
      (0.00, "humber", "Humber River"),
      (0.62, "don", "Lower Don"),
      (1.00, "highland", "Highland Creek"),
    ],
    stops=[
      ("Humber Bay",      0.00, 76, "The western gateway"),
      ("Sunnyside",       0.16, 76, "Beach on one side, road on the other"),
      ("Bathurst Quay",   0.36, 76, "Where it gets crowded"),
      ("Sugar Beach",     0.52, 76, "Slow down and share"),
      ("Cherry Street",   0.66, 76, "New bridges, new alignment"),
      ("Gardiner squeeze", 0.74, 76, "The pinch point, and the way round it", "wishful", "high", "high"),
      ("Ashbridges",      0.84, 76, "Wide and fast again"),
      ("The Beaches",     1.00, 78, "The boardwalk begins"),
    ]),
  # THE LOWER DON IS WALKED DOWNSTREAM, not up.
  # It used to start at the harbour and climb to the forks, which put its first
  # stop at the bottom of the drawing and its last at the top — so the page
  # scrolled upwards while the reader scrolled down. Every other trail on the
  # site reads the way a page reads: left to right, and top to bottom. This one
  # now does too, which means the journey itself is reversed: you start at the
  # forks and follow the river down to the lake. That is a descent, and the
  # elevation readout says so — it is the one trail on the map with a negative
  # net change, which is exactly what that feature was built for.
  dict(
    slug="don", name="Lower Don", kind="river", seed=61,
    kicker="TYPE: RAVINE / LENGTH: 9.4 KM", length=9.4,
    lead="From the forks down the Don valley to the harbour — the busiest "
         "valley route in the city, and the one with the most unfinished edges.",
    from_to=(820, 380, 2760, 2180), wobble=170, offset=76, rail_y=1500,
    places=[(1450, 820, "Don Valley", 58), (2600, 2000, "Port Lands", 44)],
    meets=[
      (0.00, "e-don", "East Don"),
      (0.30, "beltline", "The Beltline"),
      (1.00, "waterfront", "Waterfront Trail"),
    ],
    stops=[
      ("The Forks",        0.00, 118, "Where the two Dons meet"),
      ("Half Mile Bridge", 0.16, 110, "Decommissioned, and ready", "wishful", "medium", "high"),
      ("Brick Works",      0.30, 104, "The Beltline joins here"),
      ("Bloor viaduct",    0.48,  96, "Under the bridge"),
      ("Riverdale",        0.66,  88, "The last of the ravine"),
      ("Corktown Common",  0.86,  80, "A park built on fill"),
      ("Keating Channel",  1.00,  75, "The mouth of the river"),
    ]),
  # Reversed for the same reason as its western twin, and it has to be: the two
  # meet at the forks, and a reader following one into the other should not find
  # the second running the opposite way on the screen.
  dict(
    slug="e-don", name="East Don", kind="river", seed=73,
    kicker="TYPE: RAVINE / LENGTH: 13.7 KM", length=13.7,
    lead="The East Don branch, dropping south-west from the city boundary to "
         "the forks through a quieter and greener valley than its western twin.",
    from_to=(1500, 400, 3200, 2200), wobble=200, offset=-84, rail_y=900,
    places=[(2350, 1350, "East Don", 56), (1900, 780, "Don Mills", 46)],
    meets=[
      (0.00, "finch", "Finch Corridor"),
      (1.00, "don", "Lower Don"),
    ],
    stops=[
      ("Steeles",         0.00, 172, "The city boundary"),
      ("Leslie",          0.22, 158, "Quiet, and off-road the whole way"),
      ("Sheppard gap",    0.42, 149, "The trail stops for a kilometre", "wishful", "high", "medium"),
      ("Don Mills",       0.58, 141, "The valley widens"),
      ("Wynford",         0.80, 129, "Under the Parkway"),
      ("The Forks",       1.00, 118, "Where the two Dons meet"),
    ]),
  dict(
    slug="meadoway", name="The Meadoway", kind="corridor", seed=89,
    kicker="TYPE: HYDRO CORRIDOR / LENGTH: 16.0 KM", length=16.0,
    lead="A meadow being made out of a mown hydro corridor, running east-west "
         "across Scarborough and slowly joining up as it is built.",
    # A corridor is level, so its drawing has almost no vertical run — but it
    # had a little, and it was upward. Flipped, so that the one trail that is
    # nearly a straight line still leans the way every other one does.
    from_to=(400, 1080, 3400, 1500), rail_y=560, parks=5,
    places=[(1300, 900, "Scarborough", 58), (2900, 1750, "Highland Creek", 46)],
    meets=[
      (0.00, "don", "Lower Don"),
      (1.00, "highland", "Highland Creek"),
    ],
    stops=[
      ("Don valley",     0.00, 112, "The western end, at the ravine"),
      ("Victoria Park",  0.18, 126, "The first built section"),
      ("Warden",         0.36, 133, "Meadow either side"),
      ("Kennedy gap",    0.52, 138, "Not built yet", "wishful", "medium", "low"),
      ("Midland",        0.70, 144, "Back on the corridor"),
      ("Markham Road",   0.86, 149, "A crossing to fix"),
      ("Highland Creek", 1.00, 152, "The eastern end"),
    ]),
  dict(
    slug="highland", name="Highland Creek", kind="river", seed=97,
    kicker="TYPE: RAVINE / LENGTH: 10.9 KM", length=10.9,
    lead="A steep, wooded creek route running down to the Scarborough bluffs "
         "and the lake, with more climbing than anything else on the map.",
    from_to=(2000, 400, 3200, 2200), wobble=210, offset=80, rail_y=1400,
    places=[(2500, 800, "Scarborough", 54), (1700, 2000, "Port Union", 44)],
    # Reversed for the same reason as Etobicoke Creek — and this one was already
    # DESCRIBED as a descent ("running down to the bluffs and the lake") while
    # being walked uphill, so the words and the page now agree as well.
    meets=[
      (0.00, "meadoway", "The Meadoway"),
      (1.00, "waterfront", "Waterfront Trail"),
    ],
    stops=[
      ("Morningside",     0.00, 148, "High ground, at the top of the creek"),
      ("Ellesmere",       0.18, 136, "The first descent"),
      ("Colonel Danforth",0.40, 118, "Deep in the ravine"),
      ("Old Kingston",    0.62,  98, "The valley opens"),
      ("Highway 401",     0.78,  88, "A dark underpass", "wishful", "low", "medium"),
      ("Port Union",      1.00,  76, "The lake, and the Waterfront Trail"),
    ]),
]

# a stop is (title, position 0-1, metres, caption[, kind])
# ── WHAT EACH PROPOSAL IS, in one sentence ────────────────────────────────
# A stop's caption is written for a map pin: four or five words, read in
# passing. The Wishful thinking page has room for a sentence and needs one — a
# reader comparing twelve proposals cannot do it on "Not built yet". The
# Beltline's three carry their own `blurb` in its waypoints; these are the rest.
WISHFUL_BLURBS = {
  "Eglinton gap":     "The trail stops and the road starts. A few hundred "
                      "metres of path would carry it across.",
  "Albion Road":      "A four-lane road with no signal and no crossing. It is "
                      "the most dangerous point on the West Humber.",
  "Rockcliffe gap":   "The rail corridor cuts the valley in two and there is "
                      "no way under it. A tunnel, or a long way round.",
  "Jane Street":      "A crossing that needs a signal. The corridor is straight "
                      "and fast either side of it.",
  "Gardiner squeeze": "Wall on one side, water on the other, and the busiest "
                      "trail in the city pinched between them.",
  "Sheppard gap":     "A kilometre of valley with no path in it. The trail "
                      "picks up again on the far side.",
  "Kennedy gap":      "Not built yet, and already funded — this one is coming "
                      "whether or not anyone argues for it.",
  "Highway 401":      "A dark, wet underpass that people avoid after dusk. "
                      "Lighting would change what it is.",
  "Half Mile Bridge": "The bridge is already standing and already closed. It "
                      "needs a deck and railings, and nothing else.",
}


# ── WHAT A WISHFUL STOP WOULD COST, AND HOW BADLY IT IS WANTED ─────────────
# Both are placeholders, like everything else on the nine generated trails, but
# they are placeholders with a defensible shape — the point of the Wishful
# thinking page is that a reader can ask for the cheap things that matter, and
# that question is only interesting if the answers are spread out.
#
#   COST      low     paint, a sign, a curb cut, a light
#             medium  a signal, a ramp, a few hundred metres of path
#             high    a bridge, a tunnel, land nobody is selling
#
#   PRIORITY  low     it would be nice; nobody is at risk
#             medium  it costs people time, or sends them a long way round
#             high    it is where the network breaks, or where people get hurt
#
# The twelve as judged: a road crossing with no signal is medium cost and high
# priority because someone will be hit there; a hydro-corridor gap already
# inside a funded programme is low priority however much it costs, because it
# is coming anyway; and the Half Mile Bridge is the cheapest high-priority
# thing on the map, since the bridge is already standing.

def stop_dicts(trail):
    """A stop is written as a tuple, and a WISHFUL stop is written as a longer
    one:

        ("Riverdale",  0.66,  88, "The last of the ravine")
        ("Half Mile Bridge", 0.16, 110, "Decommissioned, and ready",
                                        "wishful", "medium", "high")
                                         kind      cost      priority

    Cost is what it would take to build — "low", "medium" or "high" — and
    priority is how badly it is wanted, on the same three. Neither means
    anything on a stop that already exists, so neither is read there."""
    # A FINISHED TRAIL WRITES ITS STOPS OUT IN FULL, as dicts with their own
    # text, photographs and captions, and anchored to a named circle in the
    # artwork rather than to a fraction along it. A placeholder trail writes
    # tuples. Both end up in the same shape here, so nothing downstream has to
    # know which kind it is reading — which is the whole point of moving the
    # Beltline into this file.
    if trail.get("waypoints"):
        out = []
        for i, w in enumerate(trail["waypoints"]):
            out.append(dict(i=i + 1, title=w["title"], marker=w.get("marker"),
                            at=None, metres=w["metres"],
                            caption=(w.get("media") or [("", "")])[0][1],
                            kind=w.get("kind", "real"),
                            cost=w.get("cost", ""), priority=w.get("priority", ""),
                            blurb=w.get("blurb", ""),
                            mapLink=w.get("mapLink", ""),
                            media=w.get("media") or [], text=w.get("text") or []))
        return out

    out = []
    for i, s in enumerate(trail["stops"]):
        title, at, metres, caption = s[0], s[1], s[2], s[3]
        kind = s[4] if len(s) > 4 else "real"
        cost     = s[5] if len(s) > 5 else ""
        priority = s[6] if len(s) > 6 else ""
        # ON A BUILT TRAIL both are required. A wishful stop with neither would
        # not fail — it would quietly not appear under any filter on the
        # Wishful thinking page, which is the worst way for data to be missing.
        #
        # On a WISHFUL trail they are not asked for, and none of them has them.
        # The whole route there is proposed, so what it would cost and how badly
        # it is wanted are questions about the trail, not about stop four of
        # seven; pricing three of its stops and not the others would say
        # something untrue about the other four.
        if kind == "wishful" and not trail.get("wishful") and not (cost and priority):
            raise ValueError(
                "%s: the wishful stop %r has no cost or priority. Every wishful "
                "stop on a built trail needs both — they are what the Wishful "
                "thinking page sorts on, and a stop missing them would silently "
                "vanish from every filter." % (trail["slug"], title))
        out.append(dict(i=i + 1, title=title, marker=None, at=at, metres=metres,
                        caption=caption, kind=kind, cost=cost, priority=priority,
                        blurb=WISHFUL_BLURBS.get(title, caption),
                        mapLink="", media=[], text=[]))
    return out

# ── THE BELTLINE ───────────────────────────────────────────────────────────
# THE ONLY FINISHED TRAIL, and — since this entry — no longer a special case.
#
# It used to be a hand-written beltline.html: the same page as the other nine,
# but maintained separately, which meant every change to the shared template
# had to be made twice and its three wishful stops had to be listed a second
# time for the Wishful thinking page to know about them. There was a check that
# refused to build if those two lists disagreed, which is a good check and a
# bad sign — a list that needs guarding against itself should not be two lists.
#
# So it lives here now, with everything that makes it itself: its own words, its
# own photographs and videos, its own text, its own heights. make_pages.py
# writes it exactly as it writes the others, and where a trail supplies real
# content the generator uses it instead of inventing a placeholder.
#
# Two things about it still differ, and both are stated rather than assumed:
#   artwork="beltline"  its drawing comes from make_beltline.py, because a
#                       railpath does not look like a river or a corridor
#   real=True           its words are written, not generated
BELTLINE = dict(
  slug="beltline", name="The Beltline", kind="railpath", seed=7,
  artwork="beltline", real=True,
  kicker="TYPE: RAILPATH / LENGTH: 10.2 KM", length=10.2,
  lead="A mixed-use trail following the path of the former Toronto Belt Line Railway, which operated for about seventy years. The eastern half, through Mt. Pleasant Cemetery and down Mud Creek to the Brickworks, is the best of it.",
  wiki="https://en.wikipedia.org/wiki/Beltline_Trail",
  gmap="https://www.google.com/maps/dir/43.6948874,-79.4652451/43.6810265,-79.3687185/",
  words=dict(
    openingKicker="10.2 km · Toronto",
    openingTitle="The Beltline, end to end",
    openingBody="A mixed-use trail along the path of the former Toronto Belt Line Railway, which ran for about seventy years. Scroll to walk it from the west end to the Brickworks — the map moves under you, and each stop arrives as you reach it.",
    closingTitle="Brickworks",
    closingBody="Ten kilometres from the rail yards in the west to the Brickworks in the Don Valley. The gaps at Allan Rd and Marlee Ave are the two that would do the most good if they were closed."),
  meets=[],
  # Each stop is anchored to a named circle in the artwork rather than to a
  # fraction, which is what lets the drawing be redrawn without moving the text.
  waypoints=[
    dict(
      marker="#wp-landing",
      title="Bit of a rough start",
      metres=97,
      mapLink="https://www.google.com/maps/@43.6948874,-79.4652451,17z",
      media=[
        ("01-a.jpg", "The western end, as it is"),
        ("01-b.jpg", "The same view, tidied up")],
      text=[
        "The part of the trail west of Allan Rd is a bit shabby and less popular than the more treed and scenic portion to the east. It opened in 1988 and has since fallen into disrepair.",
        "Poor signage, a misplaced curb cut and rusty gates all say the same thing: this end has not had the attention the rest of the trail has."]),
    dict(
      marker="#wp-shore",
      title="The Beltline begins",
      metres=95,
      media=[
        ("02-a.mp4", "Looking east from the air")],
      text=[
        "Where the Toronto Belt Line railway met the main trunk line. There is a railway pattern set into the concrete and an information board under a covered roof, hemmed in by industry.",
        "From the air it is clearly a narrow strip of green surrounded by concrete, but walking or cycling down it, it feels like a welcome relief from the noise and pollution of the city."]),
    dict(
      marker="#wp-boathouse",
      title="Missing crosswalk",
      metres=93,
      kind="wishful", cost="low", priority="high",
      blurb="The path crosses a road here and nothing on the road says so. Paint, a sign and a curb cut would do it.",
      media=[
        ("07-a.jpg", "Ronald Ave, with nowhere marked to cross")],
      text=[
        "It doesn't really make much sense that a popular trail like the Beltline is missing crosswalks in a few spots, such as where it crosses Ronald Ave.",
        "There are plans for a pedestrian island at Caledonia Rd. A pedestrian island that is missing crosswalks is inferior to a simple crosswalk."]),
    dict(
      marker="#wp-tarn",
      title="Bridge over Dufferin St.",
      metres=90,
      media=[
        ("04-a.mp4", "Marlee Ave, from the air"),
        ("04-b.mp4", "The trail through the houses")],
      text=[
        "It doesn't seem like much, but this kind of infrastructure on a multi-use trail is still pretty rare in the GTA.",
        "A bridge is an admission that the people on the trail matter as much as the people in the cars underneath it. That is rarer than it should be."]),
    dict(
      marker="#wp-pass",
      title="Marlee Ave",
      metres=88,
      media=[
        ("05-a.jpg", "Where the trail stops"),
        ("05-b.jpg", "Where it could carry on")],
      text=[
        "The trail reaches Marlee Ave, where it ends abruptly. At some point in the future the trail will cross Marlee and continue to Allan Rd further east.",
        "Construction on the extension is estimated for 2027."]),
    dict(
      marker="#wp-moraine",
      title="Allan Rd",
      metres=86,
      media=[
        ("06-a.jpg", "The gap, fifty years on"),
        ("06-b.jpg", "As it is today"),
        ("06-c.jpg", "With a bridge across")],
      text=[
        "A massive trench blasted through Midtown, wiping out hundreds of houses, with the intention of pushing a freeway into the heart of downtown — eventually forced by public outcry to stop in the early 70s.",
        "The trail was bisected by Allan Rd in 1972 and remains divided fifty years later. The bypass sends you along Marlee and Roselawn with no bike lanes, only sharrows.",
        "A pedestrian bridge would close the gap in one move."]),
    dict(
      marker="#wp-bridge",
      title="Old Park crossing",
      metres=84,
      kind="wishful", cost="medium", priority="medium",
      blurb="A busy street with no signal where the trail meets it. People cross anyway, in gaps in the traffic.",
      media=[
        ("07-a.jpg", "The crosswalk, awkwardly placed")],
      text=[
        "The crosswalk is inconveniently placed, and the curb cut routes anything on wheels between a pole and a guy wire."]),
    dict(
      marker="#wp-shoulder",
      title="Wait for a gap",
      metres=80,
      media=[
        ("08-a.jpg", "The island, as built"),
        ("08-b.jpg", "A crosswalk instead"),
        ("08-c.mp4", "Approaching Eglinton"),
        ("08-d.jpg", "Oriole Pkwy, the same problem again")],
      text=[
        "Inviting kids, people pushing strollers and old people to run out into traffic is just a terrible idea.",
        "A pedestrian island that is missing crosswalks is inferior to a simple crosswalk. Oriole Pkwy is roughly the same distance from the nearest intersection as the crosswalk on Avenue Rd, but for some reason the city decided to go with one of those horrible dangerous pedestrian islands instead.",
        "Past Eglinton the trail cuts between apartment buildings and begins its descent into the Don Valley. Memorial Park, a little further on, is the midpoint of the whole run."]),
    dict(
      marker="#wp-traverse",
      title="Bridge over Yonge St.",
      metres=72,
      media=[
        ("09-a.mp4", "Over Yonge"),
        ("09-b.jpg", "The gate into Mt. Pleasant")],
      text=[
        "Infrastructure like this is to be celebrated. What could have been a major trail barrier is a fun feature of the trail.",
        "Beyond it the trail passes through a narrow gate and ducks under Mt. Pleasant Rd."]),
    dict(
      marker="#wp-steps",
      title="Mt. Pleasant Cemetery",
      metres=64,
      media=[
        ("10-a.mp4", "Through the cemetery"),
        ("10-b.jpg", "The sign, mostly worn away")],
      text=[
        "The cemetery allows pedestrians and cyclists to pass through. Go slow and be respectful of the space here.",
        "Signage is poor: the dotted line referenced on the sign has mostly been worn away."]),
    dict(
      marker="#wp-spur",
      title="Moore crossing",
      metres=52,
      kind="wishful", cost="high", priority="low",
      blurb="The severed spur. Reconnecting it means a structure and land that nobody is currently selling.",
      media=[
        ("11-a.jpg", "A simple crosswalk, and it works"),
        ("11-b.jpg", "The stairs, during the closure")],
      text=[
        "A simple crosswalk is all we ask for, and here we get it.",
        "The trail was closed here for improvements and is now reopen; for a while the only way through was the stairs."]),
    dict(
      marker="#wp-overlook",
      title="Mud Creek",
      metres=34,
      media=[
        ("12-a.mp4", "Dropping toward the Don"),
        ("12-b.jpg", "In the trees"),
        ("12-c.jpg", "Under the rail bridge")],
      text=[
        "Out of the cemetery the trail drops more steeply toward the Don River, following Mud Creek down.",
        "This is the stretch people picture when they picture the Beltline: narrow, green, and a long way from the traffic above."]),
    dict(
      marker="#wp-hut",
      title="The Brickworks",
      metres=22,
      media=[
        ("13-a.jpg", "The Brickworks from above"),
        ("13-b.jpg", "With the connections it deserves"),
        ("13-c.jpg", "Bikes through the car park"),
        ("13-d.jpg", "Cars, people and bikes kept apart")],
      text=[
        "At its peak the Don Valley Brickworks was producing around 25 million bricks per year. The factory ran from the mid-1800s to the 1980s; restoration began in the 1990s and the quarry became a park.",
        "It is now run by Evergreen as a cultural centre with an eatery and a farmers market, and it sits at the junction of the Beltline and the Lower Don trail, drawing thousands of visitors a year.",
        "Given its location the Brickworks should be a hub for cyclists, but connections to the rest of the network are poor and the entrance routes bikes through a car park and a pedestrian walkway. It's bad planning.",
        "The Half Mile Bridge, decommissioned in 2007, could carry the trail straight across to the Don Valley. This would by no means be the first time rail bridges have been converted into trails."]),
  ])

# ── THE WISHFUL TRAILS ────────────────────────────────────────────────────
# Trails that do not exist. They are a KIND of their own, not a variant: purple
# throughout rather than green, a purple button on the main map that appears
# with the Wishful thinking switch, and a page that says plainly it is a
# proposal. `kind` stays "river" and so on for the DRAWING; `wishful=True` is
# what makes it a wishful trail. More will follow — add them here.
WISHFUL_TRAILS = [
  dict(
    slug="mimico", name="Mimico Creek", kind="river", seed=131, wishful=True,
    kicker="TYPE: WISHFUL / LENGTH: 13.5 KM", length=13.5,
    lead="A creek that runs the whole way from the airport lands to the lake "
         "with no continuous trail beside it. This is what one would look like.",
    from_to=(700, 300, 2900, 2150), wobble=220, offset=82, rail_y=1250,
    places=[(1500, 700, "Mimico", 56), (2600, 1900, "Humber Bay", 46)],
    meets=[
      (1.00, "waterfront", "Waterfront Trail"),
    ],
    stops=[
      ("Airport lands",   0.00, 158, "Where the creek starts, behind the fences"),
      ("Eglinton",        0.16, 141, "A crossing with no way through", "wishful"),
      ("Islington",       0.34, 126, "The valley is there; the path is not"),
      ("Berry Road",      0.52, 108, "A gap of four blocks", "wishful"),
      ("Grand Ave",       0.71,  92, "The one built stretch"),
      ("Mimico Creek",    0.86,  81, "Under the rail embankment", "wishful"),
      ("Humber Bay",      1.00,  76, "It would meet the Waterfront here"),
    ]),
  dict(
    slug="etobicoke-south", name="Etobicoke Creek South", kind="river",
    seed=149, wishful=True,
    kicker="TYPE: WISHFUL / LENGTH: 8.7 KM", length=8.7,
    lead="The southern half of Etobicoke Creek, from the QEW down to Marie "
         "Curtis Park — the piece that would finish the creek route.",
    from_to=(800, 420, 2850, 2050), wobble=190, offset=-78, rail_y=1600,
    places=[(1700, 900, "Alderwood", 52), (2500, 1800, "Long Branch", 46)],
    meets=[
      (0.00, "etobicoke", "Etobicoke Creek"),
      (1.00, "waterfront", "Waterfront Trail"),
    ],
    stops=[
      ("The QEW",         0.00, 104, "Where the built trail stops"),
      ("Horner Ave",      0.21,  96, "An industrial stretch", "wishful"),
      ("Evans Ave",       0.44,  88, "The creek is culverted here", "wishful"),
      ("Lakeshore",       0.68,  80, "One crossing from the lake"),
      ("Marie Curtis",    1.00,  76, "The mouth, and the Waterfront Trail"),
    ]),
]

# Every trail that gets a page, built and wishful together. The Beltline is
# first because it is the finished one, and because a list whose first entry is
# the example everyone should copy is a more useful list.
ALL_TRAILS = [BELTLINE] + TRAILS + WISHFUL_TRAILS
