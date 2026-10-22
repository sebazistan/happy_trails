# CUBEA — Hunting and wild game

*Code: `js/hunting.js` (behaviour, verbs, meat), `js/ai.js` (animal table, habitats). Test: `tools/harness/hunting.js`. Species list is from general natural-history knowledge of Cuba [recalled] — verify with a Cuban naturalist before release.*

## What is in the game (wild)
| Game name | Animal | Habitat / hours | Notes |
|---|---|---|---|
| jutía conga | *Capromys pilorides*, Cuban tree-rat (hutía) | forest, dusk | the classic campo meat; snare-able |
| puerco jíbaro | feral pig | forest, dusk | 22 rations; a **wounded one charges** |
| gallina de guinea | feral guinea fowl | fields and forest edge, day | flocks; flush; snare-able |
| paloma torcaza | pigeon / dove | forest, day | flushes |
| codorniz | bobwhite quail | cane and pasture, day | tiny; flushes; snare-able |
| yaguasa | West Indian whistling duck | shallows, dusk | flushes |
| iguana | Cuban rock iguana | rock, sand, scrub, day | slow |
| cangrejo de tierra | land crab | coastal sand and swamp, night | grab by hand (the Granma landing was in crab country) |
Livestock (cow, pig, hen) lives on farms and belongs to someone — taking it goes through the forage policy.
**Removed:** wild turkey (not Cuban). **Not modelled:** crocodile and caiman (Zapata swamp is not on these maps), parrots (protected), almiquí and other rarities.

## The loop
**Find** (hours, senses: birds flush at ~60 px if you walk, 24 if you hide) → **take** (shoot — loud, alerts soldiers; snare — silent, works while you sleep, best at night for jutía; fish with a line; grab a crab) → follow the **blood trail** of a wounded animal → **dress** the carcass (faster with a machete and for people raised in the monte) → **keep**: fresh meat rots after ~10 game hours; **smoke it** on a barbacoa beside a lit fire. Carcasses left alone vanish after a while.

## Wheel verbs and presets
Dress the kill · Set / Check / Take up a snare · Grab (crab) · Fish · Smoke the meat. Presets: Check the snares, Go fishing, Dress the kill, Smoke the meat (copy, edit, schedule).

## Why it matters
Shooting costs scarce cartridges and tells the army where you are; snares and fishing do not. Hunting competes with the chores for people-hours, and spoilage makes the camp's rack and fire part of the food system.

## Next
Tracks and droppings as readable things; dogs; the zafra/tiempo muerto seasons changing game and crop; rebels trading game to villages; ammunition choice (birdshot vs ball); shooting from a hide at dusk.
