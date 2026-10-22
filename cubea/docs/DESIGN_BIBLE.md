# CUBEA — Design Bible

*Working title. A low-poly game of the Cuban Revolution (Dec 1956 – Jan 1959) where every cube has a family.*
*This document describes what the HTML/JS prototype in `cubea/` actually does, why, and where it goes next in Unreal Engine.*
*Companion docs: `SCHEMA.md` (data), `UNREAL_CODE_BIBLE.md` (how to build it in UE5), `ROSTER.md` (real people), `RISKS.md` (what can go wrong), `IDEAS_AND_QUESTIONS.md` (wild ideas, open questions).*

> **Status legend** used throughout: ✅ implemented in the prototype · 🟡 partial · ⬜ designed, not built.

---

## 0. One-paragraph pitch

You are **Fidel** — under whatever name you type — on a leaking yacht, then in a cane field, then in the mountains, and finally in a capital that is yours to run. You open with the **Granma crossing** (you walk the deck; the helm is not yours until land is sighted, and you choose where to put ashore), survive the massacre at the landing and at Alegría de Pío if you can, and fight a two-year war that ends when Havana falls — followed by eight governing decisions and the American-backed invasion at **Playa Girón**. Between them: a Sierra camp, villages and fishing coves, sugar towns, Santiago, and Havana. Every one of ~3,000 sampled Cubeans is a cube with a name, a job, a mood face, a loyalty colour, and a **family and friends graph**. Whatever you do to one of them echoes through the others. The game is a **loyalty simulation wearing a squad-tactics skin**; the enemy you cannot shoot is the money behind the regime.

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
| 2 | Supplies chips, map, camp (B), spare-rifle chip, command bar tabs | after the ambush |
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

`informant` persons display a pale friendly colour (`stance`), but their `trueStance` is blue. **Tells** (clean-shaven after a long stay, kin in the army, spending…) and a 12-peso **investigation** by your network (usually right, sometimes wrong) can expose one; El Viejo hints; a trial can confirm. Eutimio Guerra (the historical informer) is a scripted case.

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

Full reference: **`COMMANDS.md`**. In brief:

* **Selection** by group (1–9), Ctrl-drag box, Shift-click, or a filter menu (armed, wounded, veterans, green, women, brave, hotheads, medics & kind). Groups carry a stance (Follow, Hold, Ambush, Scout, Forage, Harass, Withdraw) for when no order is active.
* **23 orders** in five tabs (Move, Fight, Recon, Camp, People): move, follow, hold, guard, attack, focus fire, ambush, patrol, retreat, scout, lookout, stalk, hide, dig in, dig latrine, fetch water, carry supplies, build (labour), rest, treat wounded, help a peasant, feed livestock, forage. Shift queues. **Volunteers** asks who steps forward.
* **No orders while paused.**
* **Obedience** (per soldier on the inspector): `0.45 + 0.30·loyalty + 0.18·morale + 0.10·exp + 0.10·discipline + 0.14·(trust−55)/55 − hunger − exhaustion − fear − stress − thirst`. A refusal is spoken ("Tengo hambre…") and retried — never silent.
* **Danger and disobedience.** The game estimates how deadly an order is from *known* enemies (seen in the last two minutes, plus a known post). Deadly orders make people argue; if you insist, some refuse and leave (support → near zero), others balk (trust falls). **Lead them yourself** instead: trust is earned by sharing risk, much more in the early war than late.
* **Per-soldier `trust`** (0–100): falls with known-deadly orders, favouritism in arming, abuse you ignored; rises with volunteers, shared risk and fairness.
* **Desertion / AWOL / defection / recruitment** are in; time in any army gives experience.
* **Surrender:** army men break when demoralised *and* outnumbered or badly hurt; prisoners can be released, recruited, interrogated or executed. A rebel **hothead** may shoot a prisoner before anyone stops him (discipline and justice fall).
* **Arming is scarce.** Rifles live in an armory (`res.guns`); handing one to a novice while veterans carry machetes costs trust and morale among the veterans (more if the novice is a woman and the veteran is a traditionalist). The Mariana Grajales platoon can be armed — with consequences.

### 7.1 Fog of war ✅

Enemy movement is hidden unless a rebel can see it: distance (`detectRange`: day/night, rain, fog, moving, hiding, weapon out, camouflage, viewer experience), line of sight, and lookouts (×1.5). Seen ground is remembered (dim); unseen is dark. A soldier who drops out of sight leaves a **last-known marker** for twelve seconds; gunfire you cannot see leaves a **ping** (bigger for machine guns). **V** toggles it. There is no enemy detection-range display.

### 7.2 Atrocities and discipline ✅

Soldiers of *every* side can steal, loot, beat, abuse (rare; always called "abuse"), murder and torture; the army's rate rises with regime heat and traits (drinker, hothead, greedy). The reports reach you (`army_abuse`), and your own men are not immune (`misconduct`). For a rebel offender you choose: **firing squad** (grave offences; the troop divides — some approve, some do not, close friends may desert), **court-martial**, **private reckoning**, or **let it pass**. Each choice has an outcome that depends on the offender's kin, the victim's sex, the offence and the troop's own views.

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
4. **Failure-forward:** losing a base isn't game over; the *leader's* death is — and "Try again" restarts with the same world seed and a re-rolled landing. ✅
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

## 12b. The opening: the Granma ✅

* **Crossing (≈1 minute).** A deck of cubes at sea; you walk it (WASD) and speak to men (E). Seven "days" of eight seconds each, with six decisions: seasickness (lemons, discipline, or nothing), the leak (throw cargo, bail all night, or gamble), a man overboard (turn back and search — time, food, risk — or leave him), a storm (heave to or hold course), a plane on the horizon, and the ration fight. Each shifts needs, trust and supplies. The calendar is frozen at day 0 until you land.
* **Approach.** At dawn on 2 December the helm unlocks. There are four landing sites — Cabo Cruz (rocky, a lighthouse, close to the mountains), Las Coloradas (mangrove swamp: the historic one), a long beach by Niquero (easy landing, an army post), the Toro river mouth (quiet, far from the mountains) — and a patrol boat and a plane that may spot you.
* **Hidden threat, re-rolled every run.** Each site gets `threat = base × (0.55 … 1.5)` at the start of the crossing, so replaying never gives a stronger start. Landing outcome = `threat + 0.55·alert + noise`: *ashore unseen*, *under fire*, *ambushed on the beach*, or a **massacre** (60–100% of the party dies; sometimes you do; sometimes everyone does). Supplies are lost in proportion.
* **After the landing** the story funnels into **Alegría de Pío**, whose enemy waves are scaled by a landing-dependent multiplier (0.7–1.7×). `?auto=cane` jumps straight to it for testing.

## 12c. The Americans behind the regime ✅/🟡

Batista is the face. The aircraft, bombs, rockets and spare parts are American; so are the sugar mills, the phone company, the refineries, the bank that holds the mortgage, the casinos' money and — in the end — the invasion. The prototype tracks `g.us = {arms, strings, outrage, interests}`:

* **us_arms** — a new shipment of planes and bombs, a casing marked "Made in U.S.A."; pamphlets, a journalist, or silence.
* **us_mill** — the manager offers money in exchange for safe passage for the company's cane and trucks; take it (strings, workers resent), refuse (workers cheer), sabotage.
* **us_sailors** — American marines on shore leave and a woman in a bar; intervene or stay hidden (the police look away).
* **us_diplomat** — "Washington has no love for Batista anymore": soften the nationalisation plank and get pressure on Batista, or tell him to take it up with the people.
* **us_agent** — a "journalist" offers arms and money (a leash) — accept, expel, or follow him.
* **mob_casino** — Havana's gambling money offers protection and a cut.
* **Kidnapping for ransom** — a racket with American consequences.
* **Governing:** nationalise the phone company and refineries or negotiate; sell sugar to Moscow or stay inside the American economy; the final **April 1961** card makes the invasion's CIA training, planes and promises explicit.

El Viejo comments in character ("A country can have a flag and no keys").

## 12d. Rackets and the mercenary drift ✅

`g.merc` (0–100) is how far the band has drifted from a cause toward a business. Starting a racket — protection payments from shopkeepers and landowners, contraband runs on the Cayo boats, kidnapping for ransom (talk menu or the `racket_offer` event) — pays well (about 5 and 9 pesos a day per arrangement; a ransom is 120–340) and moves the meter. What it costs:

* daily, once `merc > 20`: civilians' support erodes (peasants, middle class and the Church most), justice and honesty reputations fall, idealists in the troop lose trust;
* **30** — idealists leave; greedy local recruits arrive;
* **55** — "los cobradores": every faction's trust drops, justice −12; you may wind the rackets down;
* **80** — a lieutenant says the cause is a pretext; faction trust falls again;
* `misconduct` events become far more likely;
* the end screen reports the drift, and the Bay of Pigs score is reduced by it.

It is never the winning path, and it is deliberately tempting when pesos are short.

## 12e. After Havana: governing and Playa Girón ✅

When Batista falls (the conditional anchor, or the collapse check), `C.beginGoverning()` runs eight decision cards — land, the old regime's trials, press and the vote, American-owned utilities, schools and the Church, the army and militias, women and race, trade and oil — each adjusting six meters: **support, readiness, unity, repression, tension with Washington, economy**. Starting values come from the world you built (faction means, your troop size, rackets, American strings, executions, atrocities). Then **April 1961**: a CIA-trained exile brigade lands at Playa Girón. `score = 0.30·support + 0.28·readiness + 0.20·unity + 0.10·economy + 0.12·(100 − 0.8·repression) − 0.14·merc − 2.5·strings ± noise`; above 48 you win, with a text that depends on how broad the support was. Win or lose, the game ends; the ledger shows what shaped the run.

## 12f. The non-violent path ✅

If neither you nor your troop have killed anyone, the `peaceful_protest` event offers to endorse a silent march (mothers and students in white). Most of the time (60%) the police beat and shoot — some marchers die, some are jailed — otherwise people are arrested (28%) or, rarely (12%), the police stand aside and thousands see it. It builds a mass movement and legitimacy at a price in lives; it does not win a war by itself.

## 12g. Scale: very large scenes ✅

Every playable scene is generated at a compact size by the existing generators and then **embedded** in a map 1.6–1.9× larger: terrain continues outward (noise for the Sierra, mirrored-and-varied for towns, so roads leave and shorelines continue), exits move to the edge of the big map and are joined by a track, and countryside trees and palms are sprinkled in. Terrain is painted lazily in 16×16-tile chunks with an LRU cache (canopy only where there is forest), and A* uses pooled, stamp-versioned arrays (no per-search allocation). The Alegría de Pío and bay scenes keep their tuned sizes. Cost is measured: 120 simulation steps in the biggest scene (≈195×128 tiles, ~300 actors) take about 140 ms.

## 12h. Language ✅

English with a lot of Spanish, rising over the game (`lang.js`): `level = day/650` gives 0 → 1; tier-1 words appear with their translation at once ("los barbudos (the bearded ones)"), tier 2–3 later; by about day 500 most nouns are Spanish and translations are dropped. Speech bubbles, building labels, occupations, moods, stances and groups all pass through the lexicon. Texts use `{{key}}` tokens.

## 12i. Inventories, provisions and sharing ✅ (`inventory.js`, `pack.js`)

Every rebel carries a **pack**: rations, canteens, loose cartridges, medicine, grenades, molotovs, mortar shells and bazooka rockets, limited by **weight**. Capacity = `14 × strength + 3`; strength is an individual 0.85–1.15 (from the person's id, *not* sex or age stereotypes) × age × health. Weapons count too (a rifle 4, a BAR 8, a bazooka 7, a mortar 12, a machine gun 11). Above 75% of capacity speed falls, to −35% at 125%.

* **Eating and drinking.** Each person eats from their own pack when hunger falls below 45 and drinks below 50; meals (7, 13, 19h) feed from the column's stores and top the packs up (3 rations, 2 canteens). Standing in shallows refills a canteen.
* **Sharing.** Every ~3.5 s a person with spare supplies gives a ration or water to the *neediest* comrade within ~2.5 tiles (generous people give sooner, greedy ones keep three). A medic or kind soul hands a bandage to the bleeding. Every act of sharing feeds the bond system.
* **Ration orders** (Supply tab): food *full / half / none*, water *free / sparing / none*, and *share out* (pool and redistribute evenly). A restriction means the person eats/drinks only when badly in need.
* **Disobedience.** The chance to break a restriction per check = `0.02 + 0.5·need² + 0.12·(1 − loyalty) + 0.08·(1 − trust) − 0.1·discipline` (halved for stoics, ×1.4 for greedy/drinkers). Someone who cheats says so ("Perdón, jefe… tengo hambre"), and loses trust; discipline slips.
* **Drag and drop.** Double-click a rebel (or **T**) to open the **Pack**: their items as tiles, nearby comrades, the column's stores and the ground as drop targets. Plain drag = 1, Shift = all, Ctrl = 5. Rules mirror the world: only within hand-over range; stores only near the leader; weight limits enforced; read-only while paused. Dragging the weapon tile onto a comrade hands it over (a novice getting a weapon still causes resentment).

## 12j. Friendship that becomes family ✅ (`bonds.js`)

A **bond** (0–100) per pair of rebels grows with *time near each other*: `+0.05 per game-minute × (1 − b/110)`, ×1.5 in the same group, **×6 when both are in combat**, scaled by personality (kind/generous/gossip faster; cautious/stoic/hothead/greedy slower). One-off jumps: sharing (+1.2), a bandage (+6), pulling someone out of a firefight (+10), surviving a battle together (+3). At 20 a real relationship edge `{t:'bond', w:b/100}` is written to both people; the audience of any event weights it `0.25 + 0.75·w`, so a **full bond (100) counts like a spouse or child (1.0)**: a death grieves a brother-in-arms exactly as it would a brother. Labels: acquaintance, friend (20), close friend (50), brother-in-arms (80). Bonds between people who are apart fade slowly (never below half the peak). The inspector lists the strongest bonds.

## 12k. Period weapons ✅ (`data.js`, `combat.js`, `orders.js`)

Small arms: pistol, revolver, Springfield, Mauser, Garand, **M1 carbine** (light, 15 rounds), scoped rifle, Thompson, **BAR** (heavy, automatic), machine gun, shotgun, machete. **Bazooka:** a slow visible rocket (380 px/s, range 380) that detonates on the first thing it touches — a grenade-like blast, ×3 vehicle damage and fire; **backblast** hurts anyone in the 28-px rear cone, friend or foe (friends lose trust); fires automatically only at vehicles or clusters of three. **60 mm mortar:** crew-served — the *mortar* order makes the tube carrier walk into range (≥90 px, ≤640), deploy (6 s), fire a shell every 3 s with error `14 + 0.06·distance + (no spotter: 36) − 0.12·experience` px, and pack up; the rest of the selection act as crew and hand shells over; friendly fire is real. Heavy weapons come from loot (a BAR 30%, a mortar 18%, a bazooka 15%, a machine gun 12%, scaled by garrison size), the **arms dealer** event (pesos only), or capture; they live in `g.heavy` and are handed out through the talk menu or the pack. The army's rifle mix now includes carbines, Thompsons and a few BARs.

## 12l. Treatment of prisoners, amnesty and mercy ✅ (`policy.js`)

A **mercy index** (−3…+3, half-life 60 days) records how you treat enemy soldiers. It feeds `surrenderBonus = 0.12·mercy + amnesty bonus`, added to the army's chance to surrender when its morale breaks — so mercy *shortens* fights, and executions make the army fight to the last. Options for a surrendered soldier: **treat his wounds and release** (1 medicine; mercy +1.3), **release under amnesty** (some come back to join), **exchange** for a captured rebel (Red Cross), **hold** (eats your food, may escape, needs a verdict), **recruit**, **interrogate**, **execute** (mercy −2.2; if you announced an amnesty it is voided and honesty falls 10). A wounded enemy can be treated where he lies and then surrenders. **Radio Rebelde's amnesty** (all, or rank-and-file) makes a trickle of soldiers desert every day.

## 12m. Land reform ✅ (`policy.js`)

Seizing an estate opens a menu: hand it to the tenants (quick, popular, enrages owners), run it as a **cooperative**, or **buy it out** (45 pesos; owners' anger halved). Families receive land (≈ a third of the village's peasants); output is disrupted for 20 days, then the land yields food and goodwill. Events: tenants occupy idle land (`land_petition`); the **Sierra agrarian law** (Oct 1958) sets a ceiling (30 or 67 caballerías) and a compensation rule (none, bonds, cash) and declares the land plank. Owners flee in 40% of non-compensated seizures.

## 12n. Calibrating the platform ✅ (`policy.js`, manifesto UI)

Every option of every plank shows a **forecast**: the average shift in support across a fixed 700-person sample if you announced it, with the best and worst factions on hover (the platform is temporarily changed and `stanceTarget` re-evaluated; cached per day and platform). **Run a poll** (20 pesos) samples ~40 adults in a town: by-faction mean and % leaning your way with a margin of error; people say what they dare to say (the fearful and informers lean toward the regime).

## 12o. Interface principles ✅

* **Context-aware:** the strip under the command bar offers only what the situation calls for (hungry people → share out; thirst → fetch water; wounded → treat; overloaded → redistribute; filthy camp → latrine; contact → ambush/retreat; unarmed men and spare rifles → open the pack).
* **Direct manipulation:** drag items between people, stores and ground; Ctrl-drag to select; number keys for groups.
* **Every number is explainable:** the inspector's loyalty reasons, the danger line, the forecast, the pack's load and slowdown.
* **Modern look:** glass panels (blur), rounded cards, subtle motion (tile hover, suggestion fade-in), consistent tokens in `:root`.

## 12p. Code conventions ✅

Classic scripts in a fixed order (see the comment in `index.html`); one global namespace `window.C`; state in `C.G` and `C.W`. **Every file starts with a header explaining what it is and why; every section and every function has a comment explaining what it does and why it is shaped that way; every balance number lives in a named TUNE block or table with a comment.** New modules follow the same pattern (`inventory.js`, `bonds.js`, `policy.js`, `pack.js` are the reference examples).

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
