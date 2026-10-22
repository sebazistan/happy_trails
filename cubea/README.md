# CUBEA

*A low-poly game of the Cuban Revolution, Dec 1956 – Jan 1959 (and a flash-forward to April 1961), where every cube has a family.*
**Prototype 0.2 — HTML + JavaScript, 2D top-down, no build step.** The design and the Unreal Engine plan are in `docs/`.

> This folder is **self-contained** and independent of the rest of this repository. To move it into its own project: copy the `cubea/` folder out; nothing else is referenced.

## Run it

* **Just open `index.html`** in a modern desktop browser (Chrome/Edge/Firefox). No server or install needed.
* Or serve it: `npx http-server cubea` → http://localhost:8080
* URL options: `?seed=1956` (world seed) · `&name=Rafael%20Mesa` (your name) · `&auto=prologue` (the Granma crossing) · `&auto=cane` (straight to Alegría de Pío) · `&auto=sandbox` (the Sierra, no opening).
* Desktop only; keyboard + mouse.

## Play (60 seconds)

You are **Fidel** — under whatever name you type on the title screen. Your cubes are **red**; Batista's are **blue**; the undecided are **white**; **pale** means shallowly held.

| Keys | |
|---|---|
| **WASD** move · **Shift** run · **C** hide (camouflage) | **X** draw/holster · **LMB** fire (weapon drawn) / inspect (holstered) |
| **G** grenade · **R** reload | **RMB** move the selection (Shift queues; on a visible soldier = focus fire) |
| **1–9** pick a group · **Shift+1–9** save the selection as a group | **Ctrl-drag** box-select · **Shift-click** toggle one |
| **E** talk / use / drive / pick up / build / land | **Z** rest until dawn · **Backspace** cancel orders |
| **F** spring an ambush | **V** fog of war on/off |
| **Space** pause (no orders while paused) · speeds in the top bar | **M** map · **P** manifesto · **I** factions · **J** journal · **B** camp · **H** help |
| **Tab** cycle squadmates · **U** reveal all systems · **N** sound | **Wheel** zoom |

**Click anyone** to see their face, needs, loyalty and *why*, their **family tree**, friends, what they remember, and *what you have noticed* about them. Click a relative to jump to them.

### The opening
**The Granma** (25 Nov – 2 Dec 1956): you walk the deck of an overloaded yacht, make six decisions about seasickness, a leak, a man overboard, a storm, a plane and the rations — the helm is not yours until land is sighted. Then you choose a landing site (Cabo Cruz, Las Coloradas, the beach by Niquero, the Toro river mouth). What waits on each is **re-rolled every run**; the landing can be quiet, or a massacre that sometimes kills everyone. The survivors reach **Alegría de Pío** (army waves, two machine guns, an air raid with telegraphed bombs), break for the forest, and reach the Sierra camp, **Don Anselmo (El Viejo)**, villages, the army outpost, and the island.

### The end
When Havana falls, eight governing decisions calibrate the state you inherit, and the game ends at **Playa Girón (the Bay of Pigs), April 1961**, victory or defeat.

## What's in it

* ~3,100 Cubeans generated on load in 0.2 s: lineages with grandparents/uncles/cousins, marriages, households, dead/jailed/exiled/away relatives, friends, compadres, rivals, garrisons — **families span towns**.
* A **38-person historical roster** (Raúl, Che, Camilo, Almeida, Valdés, Celia, Frank País, Vilma, Haydée, Matos, Crescencio, Echeverría, Batista, …) — see `docs/ROSTER.md` for verification status.
* **Loyalty simulation:** events become memories that travel along family/friend edges; daily loyalty = policy fit × trust + needs + memories + peer pull + fear. Every number is explainable in the inspector.
* **Faces**, **limbs**, **beards** (rebels grow them; infiltrators rarely do), **cracks that heal**, **chunks that don't**, **camouflage** by background and experience, **undercover** rules in towns.
* **Combat:** fast bullets with travel time, wounds, bleeding, suppression, grenades, explosions, mortars, air raids, surrender, prisoners, foxholes.
* **Command (v2):** select by group, box, or filter (armed, wounded, veterans…); **23 orders** in five tabs (attack, ambush, patrol, scout, dig in, latrine, water, carry, build, treat, help a peasant…); queues; **volunteers**; trust per soldier; **people argue and refuse** when you send them against a known-deadly position — and leaving soldiers take their families' support with them. See `docs/COMMANDS.md`.
* **Fog of war:** enemies are hidden unless seen; unseen gunfire pings; last-known markers.
* **Discipline:** soldiers of every side can steal, beat, murder and — rarely — "abuse"; for your own you choose between firing squad, court-martial, a private reckoning, or letting it pass, and the troop is divided about it. Rifles are scarce; arming novices divides the veterans.
* **Rackets:** protection, contraband and kidnapping pay — and drift the band toward a business, losing support and idealists.
* **The Americans:** arms shipments, an American-owned mill, sailors on leave, a diplomat, an agent, the casino mob, the nationalisation question, the invasion.
* **Economy:** food/pesos/ammo/medicine/fuel/spare rifles, pay–owe–take foraging, vales (IOUs), crafting, an 8-pad camp, the Havana pipeline with couriers.
* **Vehicles:** jeep, truck, car, bus, army trucks, oxcart, boats, the Granma — fuel, flats, wrecks, fire.
* **Politics:** 8 factions, 8 planks, public vs. private platform, promises/deeds/trust, reputation, regime meters, a general strike, a women's platoon, racial-equality decisions, a non-violent path where marchers are mostly brutalised.
* **The Director:** tension model, spiral sensor, ~40 event types, 17 conditional historical anchors; El Viejo as in-world adviser.
* **Language:** English with Spanish creeping in over the game; early translations are dropped later.
* **8 locations + the coast**, each a large map; terrain is painted in cached chunks.

## Folder layout

```
cubea/
  index.html              page + CSS
  js/                     util data lang gen scene render ai combat fog orders sea sim events events2 govern audio ui cmdui main
                          (classic scripts → works from file://)
  docs/                   DESIGN_BIBLE · DECISIONS · COMMANDS · SCHEMA · UNREAL_CODE_BIBLE · ROSTER · RISKS · IDEAS_AND_QUESTIONS
  tools/
    export_unreal_data.js  → unreal_export/*.json (DataTables + population_golden.json)
    harness/               Playwright test harnesses: soak, event exerciser, atrocity, sea, ripple, calibration, ambush bots
  unreal_export/          generated JSON for the Unreal port
```

## Tests / balancing

```
npm i -D playwright            # once (and install a Chromium)
node tools/harness/events_exercise.js   # every event + anchor + choice + end screen
node tools/harness/soak.js              # 120 days of random play; checks NaNs/crashes
node tools/harness/atrocity.js          # army atrocity tick, offender punishment, arming resentment
node tools/harness/sea.js               # the crossing, six landings, hand-off to Alegría de Pío
node tools/harness/ripple.js            # the family-graph ripple of a single killing
node tools/harness/calibrate.js         # pay / owe / take foraging policy over 90 days
node tools/harness/bot_ambush.js        # survivability of the prologue
node tools/export_unreal_data.js        # refresh unreal_export/
```

## Known limits (prototype)
* 2D top-down with simple art; no cover system yet; crowds are capped (~300 actors/scene); the countryside around each town is terrain and trees only.
* Only one Sierra outpost is playable (La Plata); El Uvero, Santa Clara and the columns are resolved as abstract battles.
* Roster birthplaces marked 🟡/⚠ in `docs/ROSTER.md` need verification before release.
* No save/load (the world is seed-deterministic; save-as-deltas is designed in the Unreal bible).
* The "networks" layer (santería houses, cabildos, lodges, regional clubs) is designed (`docs/DECISIONS.md`), not built.
