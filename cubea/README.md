# CUBEA

*A low-poly game of the Cuban Revolution, Dec 1956 – Jan 1959, where every cube has a family.*
**Prototype 0.1 — HTML + JavaScript, 2D top-down, no build step.** The design and the Unreal Engine plan are in `docs/`.

> This folder is **self-contained** and independent of the rest of this repository. To move it into its own project: copy the `cubea/` folder out; nothing else is referenced.

## Run it

* **Just open `index.html`** in a modern desktop browser (Chrome/Edge/Firefox). No server or install needed.
* Or serve it: `npx http-server cubea` → http://localhost:8080
* URL options: `?seed=1956` (world seed) · `&auto=prologue` or `&auto=sandbox` (skip the title screen).
* Desktop only; keyboard + mouse.

## Play (60 seconds)

You are the **circle** with arms and legs: a time traveller standing in the rebel leader's boots. Your cubes are **red**; Batista's are **blue**; the undecided are **white**; **pale** means shallowly held.

| Keys | |
|---|---|
| **WASD** move · **Shift** run · **C** hide (camouflage) | **X** draw/holster · **LMB** fire (weapon drawn) / inspect (holstered) |
| **G** grenade · **R** reload | **RMB** order the selected squad (on an enemy = focus fire; Shift = scout direction) |
| **1–4** pick a squad · **F** spring an ambush | **E** talk / use / drive / pick up / build |
| **Q** foresight (3 per run: unmask a traitor, see the army) | **Z** rest until dawn |
| **Space** pause · speeds in the top bar | **M** map · **P** manifesto · **I** factions · **J** journal · **B** camp · **H** help |
| **Tab** cycle squadmates · **U** reveal all systems · **N** sound | **Wheel** zoom |

**Click anyone** to see their face, needs, loyalty and *why*, their **family tree**, friends, and what they remember. Click a relative to jump to them.

### The opening
**Alegría de Pío** (5 Dec 1956): army waves, two machine guns, flankers, an air raid with telegraphed bombs. Break for the forest to the north-west. Then the **Sierra camp**, **Don Anselmo (El Viejo)**, the hamlet of charcoal-burners, the army outpost, and the island.

## What's in it

* ~3,100 Cubeans generated on load in 0.2 s: lineages with grandparents/uncles/cousins, marriages, households, dead/jailed/exiled/away relatives, friends, compadres, rivals, garrisons — **families span towns** (a soldier's mother lives elsewhere).
* A **38-person historical roster** (Raúl, Che, Camilo, Almeida, Valdés, Celia, Frank País, Vilma, Haydée, Matos, Crescencio, Echeverría, Batista, …) linked to birthplaces — see `docs/ROSTER.md` for verification status.
* **Loyalty simulation:** events become memories that travel along family/friend edges; daily loyalty = policy fit × trust + needs + memories + peer pull + fear. Every number is explainable in the inspector.
* **Faces** (hunger, fear, anger, fatigue, hope, pain, confidence from experience), **limbs**, **hats/hair/beards** (rebels grow beards), **cracks that heal**, **chunks that don't**, **camouflage** by background and experience, **undercover** rules in towns (women draw less suspicion).
* **Combat:** fast bullets with travel time, wounds, bleeding, suppression, grenades, explosions with shrapnel, mortars, an air raid, surrender, prisoners.
* **Command:** 4 squads × 7 stances, telegraphed obedience, desertion/defection/recruitment, experience from time in any army.
* **Economy:** food/pesos/ammo/medicine/fuel, pay–owe–take foraging, vales (IOUs), crafting, an 8-pad camp, the Havana pipeline with couriers.
* **Vehicles:** jeep, truck, car, bus, army trucks, oxcart, boats — fuel, flats, wrecks, fire.
* **Politics:** 8 factions, 8 planks, public vs. private platform, promises/deeds/trust, reputation (fear/justice/honesty/discipline/competence), regime meters and a collapse condition, a general strike, women's platoon, racial-equality decisions.
* **The Director:** tension model, spiral sensor, 31 event types, 17 conditional historical anchors; El Viejo as in-world adviser.
* **8 locations:** cane field, Sierra, Palmarito, Cayo Piedra, Manzanillo, Bayamo, Santiago, Havana.

## Folder layout

```
cubea/
  index.html              page + CSS
  js/                     util data gen scene render ai combat sim events audio ui main   (≈5.4k lines, classic scripts → works from file://)
  docs/                   DESIGN_BIBLE · SCHEMA · UNREAL_CODE_BIBLE · ROSTER · RISKS · IDEAS_AND_QUESTIONS
  tools/
    export_unreal_data.js  → unreal_export/*.json (DataTables + population_golden.json)
    harness/               Playwright test harnesses: soak, event exerciser, ripple, calibration, ambush bots
  unreal_export/          generated JSON for the Unreal port
```

## Tests / balancing

```
npm i -D playwright            # once (and install a Chromium)
node tools/harness/events_exercise.js   # every event + anchor + choice + end screen
node tools/harness/soak.js              # 120 days of random play; checks NaNs/crashes
node tools/harness/ripple.js            # the family-graph ripple of a single killing
node tools/harness/calibrate.js         # pay / owe / take foraging policy over 90 days
node tools/harness/bot_ambush.js        # survivability of the prologue
node tools/export_unreal_data.js        # refresh unreal_export/
```

## Known limits (prototype)
* 2D top-down with simple art; no cover system yet; squad pathing is basic; crowds are capped (~300 actors/scene).
* Only one Sierra outpost is playable (La Plata); El Uvero, Santa Clara and the columns are resolved as abstract battles.
* Roster birthplaces marked 🟡/⚠ in `docs/ROSTER.md` need verification before release.
* No save/load (the world is seed-deterministic; save-as-deltas is designed in the Unreal bible).
* English UI with Spanish flavour; no localisation yet.
