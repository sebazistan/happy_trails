# CUBEA — Design Bible

*Working title. A low-poly game of the Cuban Revolution (Dec 1956 – Jan 1959) where every cube has a family.*
*This document describes what the HTML/JS prototype in `cubea/` actually does, why, and where it goes next in Unreal Engine.*
*Companion docs: `SCHEMA.md` (data), `UNREAL_CODE_BIBLE.md` (how to build it in UE5), `ROSTER.md` (real people), `RISKS.md` (what can go wrong), `IDEAS_AND_QUESTIONS.md` (wild ideas, open questions).*

> **Status legend** used throughout: ✅ implemented in the prototype · 🟡 partial · ⬜ designed, not built.

---

## 0. One-paragraph pitch

You are a **time traveller** (the circle with arms and legs) who has stepped into the boots of the rebel leader, trying to do the Revolution *right*. You start as the survivor of an ambush in a cane field and end — a game-year later — as either the architect of a broad coalition or the ruler of a feared remnant. Between them: a Sierra camp, villages and fishing coves, sugar towns, Santiago, and Havana. Every one of ~3,000 sampled Cubeans is a cube with a name, a job, a mood face, a loyalty colour, and a **family and friends graph**. Whatever you do to one of them echoes through the others. The game is a **loyalty simulation wearing a squad-tactics skin**.

## 1. Pillars

1. **Everyone is somebody's.** No anonymous deaths. A killed soldier has a mother, a compadre, barracks-mates, and a nametag with a family name.
2. **Legibility over fidelity.** The state of the world is readable at a glance: *colour = loyalty, saturation = how firmly held, face = feeling, cracks/chunks = injury, green tint = camouflage, nametag = family.*
3. **Balance, not a slider to "good".** Too soft → indiscipline and desertion. Too severe → fear-loyalty, informers, and flight of the towns, Church and money. The winning band is narrow and *earned*.
4. **Combat first, politics revealed.** You are taught tactics; consequences are shown in miniature from the first kill, then layered in (see §2).
5. **Constraints, not rails.** Historical beats (La Plata, the Matthews interview, Frank País, Radio Rebelde, the April 1958 strike, Operation Verano…) are *conditional* on what you did. Alternatives work for a while and hit visible ceilings; a **postmortem** shows the causal chain.

## 2. The core loop & the layered reveal ✅

```
 ┌── tactics (real-time with pause) ──┐
 │ move · shoot · take cover · order  │
 └───────────────┬────────────────────┘
                 ▼
 supplies (food/ammo/medicine/fuel/pesos) ──▶ obedience, morale, strength
                 ▼
 locals (buy · owe · take · treat · recruit) ──▶ MEMORIES in the family graph
                 ▼
 factions (peasants · workers · middle · students · elite · landowners · Church · army)
                 ▼
 platform (8 planks) + promises + deeds ──▶ trust
                 ▼
 regime meters (legitimacy · army morale · US support · heat) ──▶ collapse (Jan 1959) or not
```

The prototype implements the reveal as **six layers** (`g.unlocked.layer`, key **U** reveals all):

| Layer | Unlocks | Trigger |
|---|---|---|
| 1 | Tactics, squads, hunger/ammo | start |
| 2 | Supplies chips, map, camp (B), foresight | after the ambush |
| 3 | Support meter, loyalty details in inspector, forage policy | day 8 |
| 4 | Factions panel | day 25 |
| 5 | Manifesto (platform & promises) | day 60 |
| 6 | The island: cities, pipeline, unions, students | day 100 |

**Design rule:** the *simulation* is always running at full depth; the *UI* reveals it. A player who ignores the politics still feels them (a village goes cold; a rifle is refused) and is told why by El Viejo.

---

## 3. Systems map (the "internal map" of the prototype)

### 3.1 Modules

| File | Responsibility | Key exports |
|---|---|---|
| `util.js` | Seeded RNG, colour math (`loyaltyColor`), binary heap, value noise | `C.RNG`, `C.loyaltyColor` |
| `data.js` | All static content: names, planks, factions, occupations, traits, weapons, vehicles, buildings, settlements, **historical roster** | `C.PLANKS`, `C.FACTIONS`, `C.ROSTER`, … |
| `gen.js` | **Population generator** (lineages → marriages → households → fates → friends/compadres/rivals → garrisons → roster → Granma party) and the **graph queries** `kinOf`, `audienceOf` | `C.genWorld`, `C.kinOf`, `C.audienceOf` |
| `scene.js` | Tile maps for 8 locations, buildings w/ labels, A\* pathfinding, LOS, door-reachability pass | `C.getScene`, `C.findPath`, `C.losOpacity` |
| `render.js` | Canvas drawing: cubes w/ faces, limbs, cracks/chunks, hats, vehicles, buildings, FX, minimap, expression model | `C.drawScene`, `C.expressionTargets` |
| `ai.js` | Runtime **actors**; civilian schedules; army AI; rebel stances & obedience; camouflage; animals; vehicles | `C.spawnScene`, `C.giveOrder`, `C.camoTarget` |
| `combat.js` | Bullets (travel time), accuracy, wounds, bleeding, death, grenades, explosions, mortars, air raid, particles | `C.tryFire`, `C.hurt`, `C.die`, `C.explode`, `C.airstrike` |
| `sim.js` | **Political simulation**: events → memories → loyalty; needs drift; trust/promises; regime meters; couriers; travel cost | `C.addEvent`, `C.emit`, `C.dayTick`, `C.explainStance` |
| `events.js` | **The Director** (storyteller), event table, historical anchors, abstract battles, El Viejo | `C.story`, `C.resolveBattle` |
| `ui.js` | HUD, inspector w/ family tree, interaction menus, cards, map, manifesto, factions, journal, camp, end screen | `C.ui.*` |
| `main.js` | Loop, input, player, vehicles, scene switching, prologue script, travel, camp, meals, clock | `C.beginGame`, `C.enterScene`, `C.travelTo` |
| `audio.js` | Procedural WebAudio gunfire/blasts | `C.snd` |

### 3.2 Data flow

```
 player/AI action ──▶ combat.js / ai.js / ui.js ──▶ C.emit / C.addEvent
                                                         │
          ┌──────────────────────────────────────────────┘
          ▼
   Event record ──▶ audienceOf(victim) = kin (weighted) ∪ ties ∪ 2nd-hop friends
          │             witnesses in scene get it now; kin in ~1 day; others by gossip (+ town-wide for public events)
          ▼
   Memory { kind, val(+rebel/−Batista), intensity, blame, who, day }  (ring of 9, merge duplicates)
          │
          ▼  (daily tick)
   target stance = policy fit (2 salient planks ×trust) + rest of platform + hope/dignity
                 + Σ memories (half-life 70 d; kin 260 d) + peer pull + fear + opportunism
   stance += (target − stance) × rate × (1 − conviction/135)      conviction grows when pushed the way they lean
          │
          ▼
   Colour of the cube · faction means · supportMean · regime meters · Director inputs
```

### 3.3 Time

* Real-time with pause; speeds ×1/2/4. At ×1, **1 real s = 1.5 game min** (a day ≈ 16 real min). Meals at 07/13/19. Dawn/dusk lighting.
* A **daily tick** runs every game day: needs for off-scene people, loyalty updates for all ~3,100 people, trust, regime meters, memory queue, couriers, the Director.
* Travel between places advances the calendar (and runs the daily tick for each day).

---

## 4. The Cubean ✅

Full field list: **`SCHEMA.md`**. Highlights:

* **Identity:** first name, paternal & maternal surname (Spanish custom: women keep their maiden surname), nickname, sex, birth year, ethnicity (*social position only; never tinted*), birthplace, home, residence.
* **Kin:** `mother`, `father`, `spouse`, `kids` stored; siblings/cousins/in-laws are **derived** by traversal.
* **Edges (non-kin):** friend, compadre, lover, comrade, coworker, neighbor, employer/employee, rival.
* **Politics:** `trueStance` (−100 Batista … +100 rebel), `conv` (conviction 0–100), `stance` (what they show), `informant`/`revealed`, 8 `iss[]` issue positions, top-2 `sal[]` salient planks.
* **Body:** needs (food, water, energy, safety, dignity, hope), fear, anger, stress, morale, `exp`, `hp/maxHp`, `cracks[]`, `chunks[]`, `limp`, `armHurt`, `bleed`.
* **Look:** per-person eye spacing, brow weight, mouth width, nose, glasses, beard, hat, hair, build, mole, freckles — so no two cubes read alike.

**Population (seed 1956):** ~3,100 people (≈2,650 alive; the rest dead, jailed, exiled or away), ~1,450 households, ~9,000 non-kin edges; every person has ≥1 relationship; mean audience (kin ∪ ties ∪ 2nd hop) ≈ 56 people. Generation takes ≈ 0.2 s.

**Why lineages:** founder couples (b. 1868–94) → native children → cross-lineage marriages inside each settlement → grandchildren. Cousins, aunts, godparents and in-laws *emerge* instead of being faked. ~20% move to a bigger place (Santiago/Havana) so **families span the island**: kill a soldier in Palmarito and his mother in Bayamo remembers.

**Fates:** by age, mortality is baked in; young men in Oriente die to army violence more; ~2.5% of men are jailed; educated men go into exile; soldiers are drawn from other settlements' sons (so garrison men have families elsewhere).

---

## 5. The graph, events and loyalty ✅

### 5.1 Who cares (kin weights)

`spouse 1.0 · child 1.0 · parent 0.9 · sibling 0.75 · grandparent/grandchild 0.5 · aunt/uncle/niece/nephew 0.35 · in-law 0.3 · cousin 0.25`
`lover 0.8 · compadre 0.5 · comrade 0.5 · friend 0.4 · coworker 0.15 · neighbor 0.12 · employer/employee 0.1 · rival −0.2` · friends-of-close-ties at 0.4×.

### 5.2 Events → memories

`C.addEvent({ type, victim, perpSide, sev, just, pub, positive|val })`

* **Sign** is toward the rebels (+) or toward Batista (−): *army harms civilians → +; rebels harm civilians/soldiers → −; rebels help → +.*
* **Intensity** = `sev × (just ? 0.55 : 1) × weight`. A *just* act (an informer shot after a trial; a fair fight) lands softer on non-kin but not on grieving kin.
* **Speed:** witnesses in the scene immediately; close kin ≈ same day; others 2–5 days (gossipy people sooner); `pub > 0` events also diffuse across the town.
* **Dedup:** repeated similar acts toward the same person merge into one stronger memory (no farming goodwill by paying the same peasant 20 times).
* **Immediate effects on kin:** conviction jumps in the direction of the shock; anger, fear, stress; dignity and safety shift.

### 5.3 The daily loyalty update

```
target = 0.55·faction mean
       + 46 × [0.6·fit(salient₁) + 0.4·fit(salient₂)]  (positive fit scaled by trust: 0.4+0.6·trust)
       + 14 × avg fit(rest of declared platform)
       + 0.2 × [0.6(hope−50) + 0.4(dignity−50)]
       + 0.55 × Σ memory(val·int·0.5^(age/halfLife))     (half-life 70 d, kin 260 d; capped ±75)
       + 0.12 × (peer mean − self)                        (family and friends pull)
       − fear and opportunism terms
rate   = 0.05 × (1 − conviction/135) × (cautious 0.75, idealist 1.1)
```

`C.explainStance(p)` returns exactly these contributions; the **inspector's "why" list** is the same code the simulation runs. *Never ship an opaque number.*

### 5.4 Informers

`informant` persons display a pale friendly colour (`stance`), but their `trueStance` is blue. **Foresight** (Q, 3 per run) reveals one; El Viejo hints; a trial can expose them. Eutimio Guerra (the historical informer) is a scripted case.

### 5.5 What a kill costs (measured)

One rural guard killed in Palmarito had **75 people** in his web across 3 towns; after 6 days his kin's stance fell by 5.7 on average (conviction ↑), his friends ≈ +0.6. The cost is *local, human and slow-burning* rather than a global "−1 reputation".

---

## 6. Body, mind, and the face ✅

### 6.1 Expression model

Per cube, smoothed 8×/s from state. Inputs → features:

| Feature | Driven by |
|---|---|
| inner-brow tilt | anger (down) · fear/worry/pain/hunger (up) · confidence (steady) |
| eyelids | tiredness · thirst · hunger |
| eye width | fear |
| squint | pain · firing |
| mouth curve | hope · confidence (+) · anger/fear/hunger/pain (−) |
| mouth open | fear · pain · talking · shooting |
| sweat / tear | fear > .55 / despair + stress |

Each person also has a fixed **resting temperament** (small stable offset), so identical states don't look identical.
**Label** (`sereno, hambriento, sediento, agotado, temeroso, furioso, adolorido, confiado, esperanzado, desanimado`) is the highest-weight emotion and is shown in the inspector with an English gloss.

### 6.2 Combat experience (`exp`, 0–100)

Gained by **time in any army** (+0.12/day rebel, +0.07/day army) and by combat (+0.6 per kill, +2.5 per won set-piece). Effects:

* accuracy `0.12 + 0.78·exp/100 + veteran + …` (minus stress, wounds, exhaustion);
* camouflage multiplier `0.3 + 0.9·exp/100`;
* energy use −32% at 100;
* **confidence**: `0.75·exp/100 + (morale−50)/120 + stoic/brave…` → steady brows + small smile.
* Defectors and deserters **keep** it.

### 6.3 Injury: cracks heal, chunks don't

* **Light hits** → cracks (random zigzag on the body). They shrink by ~0.08/day (faster fed & rested; faster with an infirmary) and disappear.
* **Serious hits** (≥26 dmg, or ≥12 when already low) → a **missing chunk**: a corner or edge piece of the cube is cut away (drawn as real cut-outs with outlined edges). Permanent. Reduces max HP; bottom chunks → **limp** (slower), side chunks → **arm hurt** (aim penalty). Starts **bleeding** until treated (medic, medicine) or clotted.
* Position follows the **direction of the hit**; blasts/fire are random.
* Death → the cube breaks into body-coloured fragments; corpse remains; weapon drops; the event propagates.

### 6.3b Combat feel ✅

Bullets are **fast and have travel time** (700–1,350 px/s vs. ~55 px/s walking), draw as tracers, are stopped by walls, thinned by foliage, hit vehicles/animals/obstacles. Near misses **suppress** (stress, fear, civilian panic). Grenades arc and bounce; **explosions** hurt by distance with line-of-sight, throw shrapnel, knock back, wreck vehicles, ignite fuel, blow depots, scare animals, shake the camera. Mortars whistle; an **air raid** telegraphs each bomb with a ring one second early. Wounds, bleeding, and surrender make it grim rather than cartoony.

### 6.4 Camouflage ✅

`camoTarget = affinity[background][environment] × (0.3 + 0.9·exp) × movement × stance`

| Background | jungle | country | town | city |
|---|---|---|---|---|
| peasant (*campesino*) | **.92** | .78 | .35 | .14 |
| fisher | .60 | .70 | .40 | .20 |
| urban worker | .30 | .35 | .62 | .70 |
| student | .25 | .30 | .50 | .72 |
| professional / service | .20–.30 | .30 | .60–.66 | .66–.78 |

* Standing still ×1.05, moving ×0.45, hiding/prone ×1.35, firing ×0.2.
* Displayed as a **green tint** that first desaturates the loyalty colour (so red turns olive, not mud).
* Detection range of soldiers = `210 px × light × weather × (1−0.85·camo) × …`.
* **Undercover in towns:** an armed-looking person is spotted at once; otherwise *suspicion* accumulates only if you run, carry money/pamphlets near soldiers. `suspicionFactor`: women ×0.55, students/service ×0.8, peasants ×1.6, Afro-Cuban ×1.15 (profiling was real), less with experience. A peasant sniper is a ghost in the jungle and a flashing target in Havana.

Measured: a peasant with exp 80 in jungle = **0.95** hidden; a green student = **0.11**; in Santiago a student woman gets **0.31×** suspicion vs. a peasant man **1.84×**.

---

## 7. Commanding soldiers ✅

* **4 squads** (Vanguardia, Centro, Retaguardia, Sanidad). **Stances:** Follow · Hold · Ambush (hide; hold fire until close or **F**) · Scout (move ahead quietly, mark enemies) · Forage (buy/owe/take) · Harass (fire at range, fall back) · Withdraw.
* **Orders:** RMB move; RMB on an enemy = focus fire; Shift+RMB = scout direction.
* **Obedience** (shown per squad, per soldier on the inspector): `0.45 + 0.30·loyalty + 0.18·morale + 0.10·exp + 0.10·discipline − hunger − exhaustion − fear − stress − thirst`.
* **Telegraphed refusal:** a soldier who doesn't comply says *why* in a speech bubble ("Tengo hambre…", "Estoy agotado", "Tengo miedo") and retries — **never a silent failure**.
* **Desertion / AWOL / defection / recruitment** are all in; time in any army gives experience.
* **Surrender:** army men break when demoralised *and* outnumbered or badly hurt; prisoners can be released (army morale ↓, justice ↑), recruited, interrogated or executed (grievance).

## 8. Economy & logistics ✅

| Resource | Source | Sink |
|---|---|---|
| Food (1 unit = 1 meal) | buy, owe (vale), take, gifts, hunting/livestock, rations (kitchen) | meals (07/13/19, only if hungry) ≈ 1.1/person/day |
| Pesos | donations (pipeline), loot, pitches | food, fuel, medicine, builds, bribes, vales |
| Cartridges | captured, bought, crafted | firing; resupply at camp |
| Medicine | buy, loot | treating wounds & villagers |
| Fuel | stations, siphoning, stock | vehicles (≈ 0.1–0.2/s driving) |
| Vales (IOUs) | foraging "owe" | repay in 30 days — default costs honesty & trust |

* **Seasons:** *zafra* (Dec–May) vs. *tiempo muerto*: food is dearer and hunger worse in the dead season.
* **Prices** move with season, rain and the seller's sympathy.
* **Camp:** 8 fixed pads (kitchen, infirmary, workshop, radio, school, press, magazine, tent). **Recipes:** cartridges, bandages, molotovs, dynamite, grenades, pamphlets, rations, scavenging.
* **Vehicles:** jeep, truck, car, bus (guagua), army jeep/truck, **oxcart**, fishing boat. Fuel tank, 4 tyres (flats at 50% speed + pull; blow-outs offroad or by gunfire), engine damage, fire and wrecks. Passengers (your nearby squad boards). Repair with scrap; refuel from stock or at a gas station; siphon (theft).
* **Pipeline:** donors in Havana → pesos in `pipe.balance` → a **courier** (best: a woman, an experienced hand) carries it; 6–10 days; risk 22–60% (heat, sex, experience); arrest possible.

## 9. Politics ✅

### 9.1 Factions (8) and cross-cutting groups
Peasants · Workers & unions · Middle class · Students · Urban elite · Landowners · Church · Army & police. **Women** and **Afro-Cubans** are cross-cutting means (not factions), reported in the Factions panel.

### 9.2 Planks (8) — the **Manifesto**
Each has 3 options; each faction has its own mean position and salience.
`Land reform · Health & schools · The Church · Property & industry · Democracy · Justice for the regime · Women's equality · Racial equality.`

* **Announced (public)** vs **intended (private)**: a gap *leaks* eventually (more often when the regime's heat is high) → honesty −14, trust collapses for those who care.
* **Promises are timers.** After 20 days an announced reform plank needs *deeds* (distribute land, treat the sick, protect/seize property, hold trials…); people lose trust faster for salient broken promises. Flip-flopping costs trust.
* **Dots** next to each option show, per faction, who likes it — the player learns the *shape* of the trade-off without a spreadsheet.

### 9.3 Reputation (5 axes)
Fear · Justice · Honesty · Discipline · Competence. The **Factions panel** reads these into a verdict: *Balanced / Too soft / Tyrant*.

### 9.4 The regime
Legitimacy, army morale, US support, heat (army attention). Collapse = legitimacy < 18 & army morale < 25, or the 1 Jan 1959 anchor with legit < 38 & morale < 48. **Heat rises with your size, radio use and recent fights** — the anti-snowball brake.

### 9.5 What tyranny costs (all implemented)
1. **Fear** > 50 drains trust of elites, Church, middle class and students daily.
2. **Informers** spawn inside your own ranks at a rate that grows with fear.
3. Pitches to donors are less likely to succeed and *threatening* them scars elite trust.
4. Heat climbs; offensives come sooner.
5. Fear-loyal people carry **low conviction** — pale cubes that flip after a defeat.
6. Victory by terror ends with a *different* epilogue (no coalition).
7. The Director meets fear with informant events and meets mercy with defections.

### 9.6 Women & race
* **Women:** `women_volunteers` event (and the Sept 1958 Mariana Grajales platoon anchor): form an armed platoon (women's approval ↑; traditionalists, the devout ↓), or couriers/nurses/scouts only, or decline. Women in towns draw less suspicion (§6.4).
* **Race:** `ethnicity` shapes discrimination, salient issues and profiling, **not** the loyalty tint. `racial_clubs` event (integrate / end formal segregation / defer). Almeida, Sardiñas, Lázaro Peña are Afro-Cuban named characters. Batista himself is mixed-race — kept out of elite white clubs.

---

## 10. The Director (storyteller) ✅

**Variables (daily):** pressure (threat, supply stress, squad stress) · momentum (support trend, headcount trend) · tension (smoothed pressure + recent event intensity) · **target tension** (sawtooth: build 6 days, release 2, rising baseline) · **spiral risk** (derivatives of hunger, morale, support, headcount + low stocks + fear) · heat · season · style profile (fear vs. mercy).

**Loop:** update → if spiral risk is high prefer **lifeline** events (credit offered, a guard defects, a storm, the midwife hides your wounded) → else if tension < target prefer **pressure**, if > target prefer **rest/social** → weight by cooldowns, layer, style fit → run with a warning (El Viejo) → log. A quiet-days guarantee ensures at least one event every ~3 days.

**Event table (30):** patrol · informant hint · army requisition · eviction · reprisal · wounded arrive · air raid · offensive · misconduct · delegation · fiesta · priest visit · stranger · teacher · women volunteers · racial clubs · students' march · union call · PSP offer · Havana salon · SIM net · Che's clinic · El Viejo's story · lieutenants disagree · bodeguero credit · guard defects · storm · donation · hidden wounded · rain day.

**Historical anchors (17, conditional):** regroup (Dec 1956) · La Plata (Jan 1957, playable mission) · Eutimio Guerra (Feb 1957) · Matthews interview (Feb 1957) · Palace attack (Mar 1957; Echeverría may live if you helped) · El Uvero (May 1957) · Frank País (Jul 1957; may live if protected) · Radio Rebelde (Feb 1958) · US arms embargo (Mar 1958) · **General strike** (9 Apr 1958; succeeds only if prepared) · Operation Verano (May–Aug 1958) · Mariana Grajales platoon (Sep 1958) · Pact of Caracas (Jul 1958) · the columns (Aug 1958) · Santa Clara (Dec 1958) · New Year / collapse check.

**El Viejo** (Don Anselmo, a fictional 1895 veteran charcoal-burner) is the Director's *voice*: he warns of patrols and leaks with lead time, gives contextual advice from the same state the Director reads (hunger, ammunition, discipline, fear, money, missing platform), and answers "what should I be paying attention to?" in the Journal. He is a node in the graph (family in Palmarito), can be hurt, and his advice has an in-world source rather than a tutorial popup.

---

## 11. The world ✅

Eight tile-map scenes with labelled buildings (≈50 building types), roads, rivers, foliage, vehicles, livestock, weather and day/night.

| Place | Type | Pop (sample) | Notes |
|---|---|---|---|
| Alegría de Pío | cane field | scripted | Prologue: army waves, 2 MG, flankers, air raid; escape north-west |
| Sierra Maestra | jungle/mountain | ~110 | camp with 8 build pads, charcoal hamlet *Los Carboneros*, army outpost (La Plata mission), stream, hutias & wild boar |
| Palmarito (fictional) | batey | ~270 | plaza, bodega, chapel, school, Guardia post, steward's house, cane fields, cattle |
| Cayo Piedra (fictional) | fishing village | ~150 | pier, boats, drying racks, co-op, coast-guard post |
| Manzanillo | sugar port | ~560 | harbour, sugar mill, barracks, union hall, church |
| Bayamo | garrison town | ~500 | river, barracks, hospital, union |
| Santiago de Cuba | city | ~780 | Moncada, cathedral, University of Oriente, Bacardí, SIM, bay; student & union life |
| La Habana | capital | ~900 | Capitol, Palace, University (Escalinata), casinos, banks, SIM, CMQ radio, Larrea warehouse, Malecón |

In towns and cities **rifles/SMGs go to a cache**; only concealable pistols travel.

---

## 12. The anti-spiral toolkit (as built) ✅/🟡

1. **Rubber bands from history:** heat scales with force size, so early success draws offensives; weakness makes you hard to find. ✅
2. **Caps & decay:** memories half-life 70/260 days, ±75 cap, dedupe merge; shocks limited to 2 hops. ✅
3. **Valves always exist (at a cost):** vales, credit lifelines, defectors, storm, hidden wounded, amnesty/mercy, retreat to the Sierra. ✅
4. **Failure-forward:** losing a base isn't game over; the *leader's* death offers a **rewind** (a time traveller can). ✅
5. **Slow, visible decline + the spiral sensor** feeding lifelines and El Viejo's warnings. ✅
6. **Winning has costs** (heat, couriers, the Havana money's strings). ✅
7. **Headless balance harness** 🟡 (browser-driven scripts used in development: soak, calibration, ripple, bot ambush). ⬜ port to a commandlet in UE (see Unreal bible).

**Calibration snapshot (90 days, 28 men, ~9 transactions/day — deliberately extreme):**

| Foraging policy | Village mean (6 → …) | Fear / Justice | Notes |
|---|---|---|---|
| Pay | **+38** | 0 / 50 | slow, solid |
| Owe (vale) | +35 | 0 / 50 (honesty ↑) | free food now, repaid later; slightly less than paying |
| Take 1 in 3 | **−47** | 100 / 0 | cheap and ruinous |
| Always take | **−89** | 100 / 0 | the "tyrant" curve |

Tune in `C.TUNE` (sim.js) and the event severities (`sev`) in sim.js/events.js.

---

## 13. Serious risk assessment

See **`RISKS.md`** for the full list. Headlines: scope (three games in one) · the invisible-simulation problem · death spirals · dominant strategies · grind · procedural sameness · perceived AI unfairness · replay value · balance testing · cultural content risk (women, race, violence, a polarising real figure) · performance of crowds · store policy.

## 14. Comparable games — what each teaches

* **Jagged Alliance 2** — the closest relative (squad + town loyalty). Lesson: tactical depth carries a strategic layer; avoid militia micromanagement.
* **Partisans 1941** — guerrilla camp + squad. Lesson: its strategic layer drew complaints; keep camp-building *constrained* (fixed pads).
* **Tropico** — factions & edicts in a Cuban-flavoured setting. Lesson: factions are fun as *sliders you can feel*; our dots-on-options echo it.
* **Burden of Command** — leadership as trust & morale. Lesson: the leader is a **person-in-the-loop**, not a god.
* **Battle Brothers** — death spirals. Lesson: build the lifelines and the postmortem.
* **Shadow of Mordor (Nemesis)** — grudges create attachment. Lesson: names + memory = story; need variety after ~10 h.
* **RimWorld** — needs/mood generate stories; a **director** paces. Lesson: we copied the director.
* **Crusader Kings III / Bannerlord** — relationship graphs. Lesson: every number needs a tooltip; avoid shallow social layers.
* **Democracy 4 / Suzerain** — policy games get "solved". Lesson: hidden influence graphs get min-maxed; add contingent events and leakage (public vs private).
* **This War of Mine / Frostpunk** — moral scarcity. Lesson: if one answer is always right, tension dies; make the "wrong" answers tempting *now*.
* **Kenshi / Wartales** — big open worlds and grind. Lesson: delegate chores, keep pressure not busywork.

## 15. Wild ideas, open questions

→ **`IDEAS_AND_QUESTIONS.md`**.

## 16. Roadmap

1. **Vertical slice (this prototype)** — done: prologue → Sierra → villages → towns → Havana with full loyalty sim.
2. **Vertical slice 2** — real squad tactics polish (cover, suppression, medics), playable La Plata, pacing pass.
3. **Unreal port, graybox** — data + sim as a pure C++ module; headless balancing commandlet; Mass Entity crowds; isometric camera; cube meshes with material-driven faces. See `UNREAL_CODE_BIBLE.md`.
4. **Content** — expand roster (verified), more towns, authored set-pieces, Spanish localisation.
5. **Alpha** — audio, music (son, guaguancó), performance, accessibility (colourblind: pattern/icon channel for loyalty).
