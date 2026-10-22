# CUBEA — Player agency: fine control, in the world, in real time

*Question from the design brief: how does the player get a very fine level of control without every important mechanic becoming a button in a menu ("redistribute land → level 3")? Answer: **physical verbs on physical things**, a **context wheel**, **recorded actions**, and **spoken words that depend on who is listening**. Code: `things.js`, `actions.js`, `camp.js`, `farm.js`, `ideology.js`. Research behind it: `RESEARCH.md`.*

## 1. The rule
> If it matters, it exists in the world, can be carried, placed, stolen, spoiled or watched — and the player does it with their hands (or sends someone to), at a place, taking time, with a legible reason when it fails.

Menus survive only for *conversation* (what you say), *meta* (save, settings) and *overview* (map, factions, journal).

## 2. The substrate
| Piece | What it is | Where |
|---|---|---|
| **Things** | Stakes, plots, crops, hammocks, latrines, storage racks (barbacoas), woodpiles, cooking fires, sentry posts, a blackboard, posters, a tool rack, a trough. Drawn on the map, saved with the game. | `things.js` (`C.THINGS`, `C.addThing`) |
| **Context wheel** | **Q** (or Alt+click) at the cursor: a ring of verbs for whatever is under it (person, animal, tree, water, thing, ground). Verbs with several variants (which item, which speech) open a second ring. Impossible verbs stay visible, greyed, with the reason ("Needs two stakes"). | `things.js` |
| **Verbs** | `C.registerVerb({id, kinds, reach, dur, check, done})`: what it applies to, how close you must be, how long it takes, what it needs, what it does. Anyone can add one. | `actions.js` |
| **Who does it** | The selected soldiers (each walks over and does it), or you, if nobody is selected and you are close (progress ring; moving cancels). | `actions.js` |
| **Recorded actions** | Press **K**, select a soldier, **● Record**: right-click to walk, use the wheel on things — each command is performed live *and* written down. Save it, name it, run it for anyone, copy it, schedule it at an hour (a *routine*). | `actions.js` |

### The recorder, precisely (as requested)
* **Steps:** walk to a place, wait, say a line, or a verb on a target ("take 2 feed from the nearest rack", "feed the nearest pig", "fill at the nearest water", "give water", "put the bucket back").
* **Spot vs distance:** a walk step is either *this exact spot* or *this far from where the action starts* (toggle on the step). A target is either *that very thing* or *the nearest of its kind* (toggle).
* **Failure is never silent:** if anything is missing (no bucket, no path, no pig, wounded, under fire) the action **stops, the soldier says why, it is logged, and he walks back to where he started** (per-action toggle `home`). Under fire the action pauses and the soldier fights.
* **Presets** ship as copyable examples: Feed the pigs, Water the pigs, Firewood run, Light the cooking fire, Night watch, Literacy lesson.

## 3. Land reform without a button
The old one-click seizure is replaced by a chain (`farm.js`):
1. **Serve notice** (a *conversation* with the owner: demand / buy out / work it together). Opens the estate to survey. Nothing is handed over. Owners react.
2. **Survey**: take stakes from the tool rack; **Q on the ground → Survey a plot** (half / one / two caballerías). You decide where and how big; stakes run out; plots cannot overlap.
3. **Grant**: **Q on a person → Give them a plot**. The family's hope, loyalty and the owners' fury move *now*, for *them*, remembered along kin edges. A matching promise is marked kept.
4. **Sow** (hoe + seed), **water**, **harvest**. A granted plot with no seed after 12 days is a family that loses faith: *"una escritura no es una cosecha."*
Every step can be recorded as an action and given to a squad.

## 4. Camp life (`camp.js`)
A camp is whatever stands on the ground. Hourly and daily consequences: waste (latrine or foul ground; dysentery; a latrine near the water is a mistake), food (racks vs sacks on the ground; rain; spoilage), fuel (cut, stack, carry; a fire in daylight is smoke the army sees), sleep (hammocks; the rain on the bedless), the watch (postas; sentries nod off), school (blackboard + primer), sick call. Each is a loop of verbs; see the file header for the numbers (`TUNE`).

## 5. Words (`ideology.js`) — see `IDEOLOGY.md`
Speeches, readings aloud, pamphlets, posters, letters, and a **voice** whose options change with the listener's state (hungry, wounded, hopeless, unarmed… or a peasant, to whom you can promise land, seed, medicine). Promises go in a ledger and are checked against deeds.

## 5b. Workshop, kitchen and trade (`workshop.js`)
The camp menu's recipe list is gone. Benches are built on the ground (Q → Set up a workstation), used with *Make…*, and skilled hands are quicker and safer; the forge burns firewood, is loud, and can go wrong. A cook pot beside a lit fire makes eight hot servings; at mealtime those near it are served (*Ladle* chooses who). Foraging opens with a spoken offer, and the wheel on a civilian offers pay / vale / gift / barter / gunpoint.

## 6. What we did *not* do
* No "advance to the next stage": systems read the state of the world; the Director (storyteller) reacts to it.
* No hidden numbers: every change is logged or spoken.
* No automation that cannot fail: macros stop and say why.

## 7. Next
Beyond this prototype: ownership of plots by people (inheritance, theft), cooperative decisions as in-world assemblies, weather-driven planting seasons (zafra / tiempo muerto), cooking as a recipe loop, stretcher relays for the wounded, a teaching tree for literacy → radio operator → clerk, per-person duty rosters that merge into routines.
