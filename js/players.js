/* Written by build/make_players.py — do not edit.
   The drawings are in artwork/players/ and the rigs in
   build/players_data.py. Inlined rather than fetched because fetch()
   does not work on file:// and this site is checked by double-clicking. */
window.HappyTrailsPlayers = {
  art: {
 "cyclist": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"-80 -280 360 340\" width=\"360\" height=\"340\">\n<!-- \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\n     A PLAYER RIG \u2014 cyclist\n\n     Redraw every part in place. Keep the names, keep the pivot dots, and the\n     code finds everything and moves it.\n\n       part-<name>    a thing you draw\n       pivot-<name>   a dot saying where part-<name> turns. Never drawn: the\n                      build reads its centre and deletes it\n       ground         the line the wheels and feet stand on\n       anchor         the single point that rides the route\n\n     NESTING IS THE SKELETON. part-shin-near is drawn INSIDE part-thigh-near,\n     so when the thigh turns the shin goes with it \u2014 SVG does that for nothing\n     and it means the joint order lives in the Layers panel, where you can see\n     it, rather than in a table somewhere that has to agree with the drawing.\n\n     Order in the panel is what sits in front of what. Far leg at the bottom,\n     near leg at the top.\n     \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550 -->\n<defs><style>\n  .cyclist-ink{ fill:none; stroke:#111; stroke-width:8; stroke-linecap:round; stroke-linejoin:round; }\n  .cyclist-tyre{ fill:none; stroke:#111; stroke-width:8; }\n  .cyclist-spoke{ stroke:#111; stroke-width:4; opacity:.55; }\n  /* the far side of the body, drawn pale so the near leg reads against\n     the frame. Depth, with one class and no extra drawing. */\n  .cyclist-far{ opacity:.38; }\n  .cyclist-pivot{ fill:#e8503a; }\n  .cyclist-guide{ stroke:#9ab; stroke-width:2; stroke-dasharray:8 8; }\n</style></defs>\n\n<!-- THE GROUND IS WHERE THE TYRES TOUCH, not where the hubs are. Both wheels\n     are drawn with their centres on y=0 and a radius of 44, so the ground is\n     y=44 \u2014 and the anchor sits ON it, under the back wheel, because the anchor\n     is the point that rides the route and a bicycle rides on its tyres. Put\n     the anchor at the hub instead and the whole figure sinks half a wheel into\n     the trail, which is exactly what it did the first time. -->\n<line id=\"ground\" class=\"cyclist-guide\" x1=\"-70\" y1=\"44\" x2=\"250\" y2=\"44\"/>\n<circle id=\"anchor\" class=\"cyclist-pivot\" cx=\"0\" cy=\"44\" r=\"4\"/>\n\n<!-- THE LEGS ARE A LENGTH, NOT A DRAWING. Saddle to bottom bracket is 93.5\n     here, and the crank is 24, so at the bottom of the stroke the foot is\n     117.2 from the hip. The leg is 122 long (thigh 58, shin 64), which leaves\n     it 96% extended down there \u2014 what a bike shop sets a saddle to. Draw the\n     legs shorter than that and the foot simply cannot reach the pedal: the\n     solver clamps, the foot comes off the crank, and the whole thing goes from\n     pedalling to paddling. Change the saddle height and these two lengths have\n     to move with it.\n\n     Both legs are drawn with the KNEE FORWARD, which is what tells the code\n     which way the joint bends. It reads that once, from the drawing. -->\n<g id=\"part-thigh-far\"><line class=\"cyclist-ink cyclist-far\" x1=\"36.0\" y1=\"-96.0\" x2=\"72.4\" y2=\"-50.8\"/><g id=\"part-shin-far\"><line class=\"cyclist-ink cyclist-far\" x1=\"72.4\" y1=\"-50.8\" x2=\"28.8\" y2=\"-4.0\"/><line class=\"cyclist-ink cyclist-far\" x1=\"23.8\" y1=\"-2.0\" x2=\"35.8\" y2=\"-2.0\"/></g></g>\n<g id=\"part-wheel-back\"><circle class=\"cyclist-tyre\" cx=\"0.0\" cy=\"0\" r=\"44.0\"/><line class=\"cyclist-spoke\" x1=\"0.0\" y1=\"0\" x2=\"38.0\" y2=\"0.0\"/><line class=\"cyclist-spoke\" x1=\"0.0\" y1=\"0\" x2=\"26.9\" y2=\"26.9\"/><line class=\"cyclist-spoke\" x1=\"0.0\" y1=\"0\" x2=\"0.0\" y2=\"38.0\"/><line class=\"cyclist-spoke\" x1=\"0.0\" y1=\"0\" x2=\"-26.9\" y2=\"26.9\"/></g>\n<g id=\"part-wheel-front\"><circle class=\"cyclist-tyre\" cx=\"120.0\" cy=\"0\" r=\"44.0\"/><line class=\"cyclist-spoke\" x1=\"120.0\" y1=\"0\" x2=\"158.0\" y2=\"0.0\"/><line class=\"cyclist-spoke\" x1=\"120.0\" y1=\"0\" x2=\"146.9\" y2=\"26.9\"/><line class=\"cyclist-spoke\" x1=\"120.0\" y1=\"0\" x2=\"120.0\" y2=\"38.0\"/><line class=\"cyclist-spoke\" x1=\"120.0\" y1=\"0\" x2=\"93.1\" y2=\"26.9\"/></g>\n\n<g id=\"part-frame\">\n  <path class=\"cyclist-ink\" d=\"M0 0 L52.8 -4.0 L36.0 -96.0 L0 0\n                       M52.8 -4.0 L120.0 0\n                       M36.0 -96.0 L111.6 -88.0\n                       M111.6 -88.0 L120.0 0\"/>\n  <line class=\"cyclist-ink\" x1=\"20.0\" y1=\"-96.0\" x2=\"52.0\" y2=\"-96.0\"/>\n  <line class=\"cyclist-ink\" x1=\"99.6\" y1=\"-88.0\" x2=\"125.6\" y2=\"-88.0\"/>\n</g>\n\n<g id=\"part-body\">\n  <path class=\"cyclist-ink\" d=\"M36.0 -96.0 L64.0 -140.0\n                       M64.0 -140.0 L111.6 -88.0\"/>\n</g>\n<g id=\"part-head\"><circle class=\"cyclist-ink\" cx=\"82.0\" cy=\"-166.0\" r=\"17\"/></g>\n\n<g id=\"part-thigh-near\"><line class=\"cyclist-ink\" x1=\"36.0\" y1=\"-96.0\" x2=\"86.4\" y2=\"-67.3\"/><g id=\"part-shin-near\"><line class=\"cyclist-ink\" x1=\"86.4\" y1=\"-67.3\" x2=\"76.8\" y2=\"-4.0\"/><line class=\"cyclist-ink\" x1=\"71.8\" y1=\"-2.0\" x2=\"83.8\" y2=\"-2.0\"/></g></g>\n\n<g id=\"pivots\">\n  <circle id=\"pivot-wheel-back\" class=\"cyclist-pivot\" cx=\"0.0\" cy=\"0.0\" r=\"3\"/>\n  <circle id=\"pivot-wheel-front\" class=\"cyclist-pivot\" cx=\"120.0\" cy=\"0.0\" r=\"3\"/>\n  <circle id=\"pivot-thigh-near\" class=\"cyclist-pivot\" cx=\"36.0\" cy=\"-96.0\" r=\"3\"/>\n  <circle id=\"pivot-thigh-far\" class=\"cyclist-pivot\" cx=\"36.0\" cy=\"-96.0\" r=\"3\"/>\n  <circle id=\"pivot-shin-near\" class=\"cyclist-pivot\" cx=\"86.4\" cy=\"-67.3\" r=\"3\"/>\n  <circle id=\"pivot-shin-far\" class=\"cyclist-pivot\" cx=\"72.4\" cy=\"-50.8\" r=\"3\"/>\n  <circle id=\"pivot-crank\" class=\"cyclist-pivot\" cx=\"52.8\" cy=\"-4.0\" r=\"3\"/>\n  <circle id=\"pivot-crank-reach\" class=\"cyclist-pivot\" cx=\"76.8\" cy=\"-4.0\" r=\"3\"/>\n  <circle id=\"pivot-head\" class=\"cyclist-pivot\" cx=\"64.0\" cy=\"-140.0\" r=\"3\"/>\n</g>\n</svg>",
 "dog": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"-40 -80 150 100\" width=\"150\" height=\"100\">\n<!-- \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\n     A PLAYER RIG \u2014 dog, drawn as FRAMES rather than rigged\n\n     Six poses of a trot, one per layer, named frame-trot-1 \u2026 frame-trot-6.\n     The code shows one at a time and steps between them BY DISTANCE \u2014 the rig\n     says one frame every 0.42 m \u2014 so the legs go faster when the reader\n     scrolls faster, and nothing about the dog has to know that.\n\n     This is the other half of the convention, and it exists because some\n     things are far easier to DRAW than to rig. A trot has a weight in it that\n     no arrangement of hinges gives you; six honest poses do.\n\n     WHAT IS IN A FRAME IS ONLY WHAT CHANGES. The body, the head and the tail\n     are drawn ONCE, outside the frames. Redrawing them six times would be six\n     chances for the head to jitter, and changing an ear would be six edits\n     instead of one. So the frames hold legs and nothing else.\n\n     AND A FRAMED PLAYER CAN STILL HAVE RIGGED PARTS. part-tail swings on its\n     own, because a tail wants to be continuous rather than stepped, and\n     part-body rises and falls, because a trotting dog does.\n\n     THE LEGS ARE SOLVED, NOT EYEBALLED. Each foot stands still on the ground\n     through its stance and swings forward through the air, and the knee is\n     placed by the same two-bar solve the cyclist uses. That is why the feet do\n     not skate. The far pair is drawn paler so the near pair reads first.\n\n     A trot moves DIAGONAL PAIRS together: front-near goes with rear-far.\n     \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550 -->\n<defs><style>\n  .dog-ink{ fill:none; stroke:#111; stroke-width:4.4; stroke-linecap:round; stroke-linejoin:round; }\n  .dog-thin{ stroke-width:3.4; }\n  .dog-far{ opacity:.38; }\n  .dog-pivot{ fill:#e8503a; }\n  .dog-guide{ stroke:#9ab; stroke-width:2; stroke-dasharray:8 8; }\n</style></defs>\n\n<line id=\"ground\" class=\"dog-guide\" x1=\"-30\" y1=\"0\" x2=\"140\" y2=\"0\"/>\n<circle id=\"anchor\" class=\"dog-pivot\" cx=\"0\" cy=\"0\" r=\"3\"/>\n\n<!-- THE LEGS: six poses, one shown at a time -->\n<g id=\"frame-trot-1\"><path class=\"dog-ink dog-far\" d=\"M18.0 -26.5 L19.4 -14.1 L12.9 0.0\"/><path class=\"dog-ink dog-far\" d=\"M46.4 -26.0 L45.8 -13.5 L53.4 0.0\"/><path class=\"dog-ink\" d=\"M12.8 -26.5 L18.7 -15.5 L19.8 0.0\"/><path class=\"dog-ink\" d=\"M51.6 -26.0 L44.9 -15.4 L46.5 0.0\"/></g>\n<g id=\"frame-trot-2\"><path class=\"dog-ink dog-far\" d=\"M18.0 -26.5 L24.3 -15.7 L13.9 -4.2\"/><path class=\"dog-ink dog-far\" d=\"M46.4 -26.0 L42.8 -14.0 L49.4 0.0\"/><path class=\"dog-ink\" d=\"M12.8 -26.5 L18.3 -15.3 L15.8 0.0\"/><path class=\"dog-ink\" d=\"M51.6 -26.0 L41.6 -18.5 L47.5 -4.2\"/></g>\n<g id=\"frame-trot-3\"><path class=\"dog-ink dog-far\" d=\"M18.0 -26.5 L28.3 -19.4 L19.4 -6.6\"/><path class=\"dog-ink dog-far\" d=\"M46.4 -26.0 L40.8 -14.8 L45.4 0.0\"/><path class=\"dog-ink\" d=\"M12.8 -26.5 L16.8 -14.7 L11.8 0.0\"/><path class=\"dog-ink\" d=\"M51.6 -26.0 L42.2 -17.7 L53.0 -6.6\"/></g>\n<g id=\"frame-trot-4\"><path class=\"dog-ink dog-far\" d=\"M18.0 -26.5 L23.9 -15.5 L25.0 0.0\"/><path class=\"dog-ink dog-far\" d=\"M46.4 -26.0 L39.7 -15.4 L41.3 0.0\"/><path class=\"dog-ink\" d=\"M12.8 -26.5 L14.2 -14.1 L7.7 0.0\"/><path class=\"dog-ink\" d=\"M51.6 -26.0 L51.0 -13.5 L58.6 0.0\"/></g>\n<g id=\"frame-trot-5\"><path class=\"dog-ink dog-far\" d=\"M18.0 -26.5 L23.5 -15.3 L21.0 0.0\"/><path class=\"dog-ink dog-far\" d=\"M46.4 -26.0 L36.4 -18.5 L42.3 -4.2\"/><path class=\"dog-ink\" d=\"M12.8 -26.5 L19.1 -15.7 L8.7 -4.2\"/><path class=\"dog-ink\" d=\"M51.6 -26.0 L48.0 -14.0 L54.6 0.0\"/></g>\n<g id=\"frame-trot-6\"><path class=\"dog-ink dog-far\" d=\"M18.0 -26.5 L22.0 -14.7 L17.0 0.0\"/><path class=\"dog-ink dog-far\" d=\"M46.4 -26.0 L37.0 -17.7 L47.8 -6.6\"/><path class=\"dog-ink\" d=\"M12.8 -26.5 L23.1 -19.4 L14.2 -6.6\"/><path class=\"dog-ink\" d=\"M51.6 -26.0 L46.0 -14.8 L50.6 0.0\"/></g>\n<!-- AND EVERYTHING THAT DOES NOT CHANGE, DRAWN ONCE -->\n<g id=\"part-tail\"><path class=\"dog-ink\" d=\"M6.5 -28.5 Q-6.0 -41.0 -15.0 -34.0\"/></g>\n<g id=\"part-body\">\n  <path class=\"dog-ink\" d=\"M6.5 -28.5 Q30.0 -33.5 55.0 -27.5\"/>      <!-- the back -->\n  <path class=\"dog-ink dog-thin\" d=\"M13.0 -25.0 Q31.0 -17.5 47.0 -25.0\"/> <!-- the belly -->\n  <path class=\"dog-ink\" d=\"M55.0 -27.5 L62.5 -39.5\"/>                 <!-- the neck -->\n  <circle class=\"dog-ink\" cx=\"65.5\" cy=\"-43.0\" r=\"6.2\"/>              <!-- the head -->\n  <path class=\"dog-ink dog-thin\" d=\"M70.0 -43.5 L77.5 -41.5\"/>            <!-- the muzzle -->\n  <path class=\"dog-ink dog-thin\" d=\"M62.0 -47.5 L59.5 -53.5\"/>            <!-- the ear -->\n</g>\n\n<g id=\"pivots\">\n  <circle id=\"pivot-tail\" class=\"dog-pivot\" cx=\"6.5\" cy=\"-28.5\" r=\"3\"/>\n</g>\n</svg>"
},
  rigs: {
 "cyclist": {
  "height": 57,
  "parts": {
   "head": {
    "bob": {
     "by": 0.7,
     "per": 3.3
    }
   },
   "thigh-far": {
    "crank": {
     "gear": 3.1,
     "phase": 180,
     "shin": "shin-far",
     "wheel": "wheel-back"
    }
   },
   "thigh-near": {
    "crank": {
     "foot": true,
     "gear": 3.1,
     "phase": 0,
     "shin": "shin-near",
     "wheel": "wheel-back"
    }
   },
   "wheel-back": {
    "spin": {}
   },
   "wheel-front": {
    "spin": {}
   }
  },
  "tall": 1.75
 },
 "dog": {
  "frames": {
   "trot": {
    "every": 0.42
   }
  },
  "height": 26,
  "parts": {
   "body": {
    "bob": {
     "by": 0.8,
     "per": 0.84
    }
   },
   "tail": {
    "swing": {
     "by": 16,
     "per": 0.84
    }
   }
  },
  "tall": 0.62
 }
},
  cast: [
 {
  "who": "cyclist",
  "every": 900,
  "facing": "toward",
  "speed": 1.35,
  "where": "any",
  "weight": 3,
  "sway": 8
 },
 {
  "who": "cyclist",
  "every": 1400,
  "facing": "with",
  "speed": 0.55,
  "where": "any",
  "weight": 2,
  "sway": 8
 },
 {
  "who": "dog",
  "every": 2200,
  "facing": "toward",
  "speed": 0.75,
  "where": "any",
  "weight": 1,
  "sway": 14
 }
],
  density: 0.55, fadeIn: 12, fadeOut: 14
};
