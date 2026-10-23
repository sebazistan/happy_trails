# CUBEA — Decisions log

What was decided, in the order the questions were asked (the numbering follows `IDEAS_AND_QUESTIONS.md`), what the prototype does about it, and what is still open. ✅ built · 🟡 partly built · ⬜ designed, not yet built.

## Player, tone and rules

| # | Decision | Status |
|---|---|---|
| Q2 | **No time traveller.** You play Fidel under whatever name you type on the title screen (default "Fidel Castro"; the name is stored locally and used on nametags, journal and end screen). The family around you stays historical (Raúl, Che, Celia…). | ✅ `C.setPlayerName`, title-screen field `#pname` |
| Q3 | **Light on moralising.** The "Compared with history" ending block and its critical commentary are gone. The end screen shows a plain ledger (deaths, releases, executions, coalition, what shaped the run). Consequences are *shown in the world*, not lectured. | ✅ `ui.showEnd` |
| Q3b | **Rackets are a path, not a sermon.** Rebels can become mercenaries, smugglers and thugs. It is profitable, it loses support, idealists leave, opportunists arrive, and it is never the winning choice. | ✅ `events2.js` (§Rackets) |
| Q4 | **Seriousness without spectacle.** Visuals stay as they are (cubes, cracks, chunks). Soldiers on *every* side can steal, beat, murder, torture and — rarely — abuse women (always spoken of as "abuse", e.g. "the soldier abused my daughter"). There is a strong incentive to punish rebel offenders (firing squad, as happened historically) but it is hard: you lose a soldier from a small troop, and killing your own divides the troop (some approve, some do not, close friends may desert). | ✅ `C.atrocityTick`, `C.punishOffender`, `misconduct` and `army_abuse` events |
| Q5 | **English with a lot of Spanish.** The amount of Spanish rises with the days; early on each Spanish word is followed by its translation ("los barbudos (the bearded ones)"); later the translations are dropped. | ✅ `lang.js` (tiers 1–3, `level = day/650`) |
| Q6 | **No planning while paused.** Pause lets you look (inspect, read, think); you cannot give orders, fire, or ambush. Time is part of the pressure. | ✅ |
| Q7 | **Scenes, but very large scenes.** Each location is a map 1.6–1.9× the old size (roughly 160–195 × 110–130 tiles for towns), with countryside, roads and shoreline continuing outward; terrain is painted lazily in chunks. | ✅ `embedScene`, chunked `prerender` |
| Q8 | **~3,000 people is plenty.** Do not scale the population; scale the *depth* of each person. | ✅ unchanged |
| Q9 | **Ending.** The main game is done when Havana falls. Then a short governing phase (8 decisions that calibrate the state you inherit) and a flash-forward to **Playa Girón (Bay of Pigs), April 1961**. Victory or defeat there ends the game. | ✅ `govern.js` |
| Q10 | **Pacifism is possible, and mostly gets people brutalised and killed.** If the player and the troop have not killed anyone, peaceful marches become available; the regime beats, jails and shoots the marchers most of the time. Rarely the police stand aside. | ✅ `peaceful_protest` |
| Q11 | **Open with the Granma crossing.** You walk the deck; you cannot steer until land is sighted; then you choose a landing site. Enemy strength is re-rolled every run so replaying the intro never gives a stronger start. The landing can be a massacre and sometimes kills the whole party. | ✅ `sea.js` |
| Q12 | (undecided) | open |
| Q13 | **More regions is good.** The scene system is data-driven (generator + size + scale); new regions are additions, not rewrites. | 🟡 8 scenes + bay |
| Q14 | **The Mariana Grajales platoon can become soldiers** — but rifles are scarce: arming novices while veterans carry machetes divides the troop ("Guns are limited; giving them to inexperienced soldiers will divide the rebels somewhat"). | ✅ `C.armSoldier`, `C.resentment`, `women_volunteers` |
| Q15 | See *My ideas on Santería, syncretism and mutual-aid societies* below. | ⬜ designed |
| Q16 | **American imperialism is the big enemy behind the scenes.** Batista is the face; Washington funds the aircraft, the bombs, the mill, the phone company, the casinos, and finally the invasion. | ✅ `events2.js` (§Americans), `govern.js` |
| Q17 | **Art direction:** Untitled-Goose-Game-style cel-shaded low-poly 3D in Unreal; the 2D prototype stays a design tool. | ⬜ (`UNREAL_CODE_BIBLE.md` §Art) |
| Q18 | Small team, PC only. | noted |
| Q20 | The user hopes to make Cuban connections (for birthplaces, language, review). Roster flags 🟡/⚠ stay until then. | open |
| Q21 | **Foresight tokens: dropped.** See below. | ✅ replaced by tells + investigation |
| Q22 | **No plot armour.** Anyone can die. Named people with traits are somewhat *less* likely than new recruits to die, never immune. | ✅ |
| Q23 | **No enemy detection-range display. Fog of war instead.** Enemy movement is hidden unless seen; unseen gunfire pings. The order system is rich (see `COMMANDS.md`). | ✅ `fog.js`, `orders.js` |
| Q24 | **Disobedience is a big deal.** Soldiers argue when sent against a position known to be crushing; if you insist, some refuse — convinced they are being sent to die — and leave, and their support falls to near zero. Sending people on known deadly missions costs trust. Leading the mission yourself earns trust, much more in the early game. | ✅ `C.orderDanger`, `C.willing`, refusal card |
| I1 | Beards grow with service; infiltrators and informers rarely do. | ✅ `beardLen`, `C.tells` |
| I2/I3 | Try all the built ideas (except the time traveller): mail call, lectores, etc. | 🟡 several in; see `IDEAS_AND_QUESTIONS.md` |
| Meta | **Reusable engine** for other anti-imperialist rebel conflicts (Algeria, Vietnam…), even where they ended badly. **No Batista-side version. No educational mode.** | ⬜ `UNREAL_CODE_BIBLE.md` §RevolutionKit |

## My answer on foresight tokens (Q21)

Drop them. They existed to give a time traveller a way to see what a historian already knows. Now that you are simply Fidel, they conflict with the thing the game is about: you *do not know* who is lying, and you pay in time, money and risk to find out.

What replaced them (all built):

* **Tells.** The inspector shows things you could notice: clean-shaven after a long stay, kin in the army, spends too freely, always arrives just before a patrol… Each is individually ambiguous.
* **Investigation.** "Have your network check on this person" costs 12 pesos and is *usually* right (50–92% by network quality). It can be wrong, and a wrong accusation has a cost.
* **Trials.** A revealed informer can be tried in public; the verdict is visible to the village.

## My ideas on Santería, syncretism and mutual-aid societies (Q15)

These work best as a **network layer**, not as a ninth faction. People already belong to a faction (peasants, workers, students, elite, landowners, Church, army, middle); the networks cut *across* them and give new edges for events to travel along.

1. **Membership edges.** Add `membership[]` to each person: `{kind, id, role}` with kinds
   * `ilé` — a religious house (Santería/Regla de Ocha, Palo Monte, spiritism) with a *babalawo/santera* at its head and *padrinos/ahijados* (godparent/godchild) edges that count like compadres in `audienceOf`;
   * `cabildo` / `sociedad de color` — Afro-Cuban mutual-aid and social societies (burial insurance, loans, a clinic, a dance hall);
   * `abakuá` — a male fraternity (secretive; protective inside the group; the regime infiltrates it; a rebel cannot simply "recruit" it);
   * `logia` — Masonic lodges (strong in the independence tradition; often anti-Batista; a source of money, safe addresses and lawyers);
   * `centro` — regional and immigrant clubs (Centro Gallego, Asturiano, the Chinese Casino Chung Wah): clinics, newspapers, funds, and a very different class and race picture than the one in the sierra;
   * `parroquia` — the parish (the *hierarchy* of the Church is a faction; popular Catholicism is a network).
2. **Syncretism as content.** The calendar matters: 4 Dec Santa Bárbara/Changó, 17 Dec San Lázaro/Babalú-Ayé (pilgrimage to El Rincón), 8 Sept Virgen de la Caridad del Cobre/Ochún (the national patron, pilgrimage to El Cobre in the Sierra's own foothills). A rebel who respects the date is invited; one who ignores it is merely tolerated; the army that raids a *toque de santo* is remembered for a generation.
3. **Mechanics that matter.** A house gives you (a) **hiding** (people in an ilé are rarely searched by neighbours), (b) **medicine** (herbalists, midwives, bone-setters when the clinic is shut), (c) **burial** (a society that buries your dead respects you more than any speech), (d) **information** (the house hears everything); and it can **refuse** you. Informers can sit inside an ilé or a lodge; the regime can bribe a leader.
4. **Race and class relations.** Mutual-aid societies are where the "Sociedad de Color" decision (already in as `racial_clubs`) stops being a one-off card and becomes a standing relationship with named leaders you can please or betray.
5. **Cost.** One table (`NETWORKS`), one field per person, and ~6 event types. It does not need a new simulation.

## What is still open

* Birthplaces and other roster fields (🟡/⚠ in `ROSTER.md`) — to be provided later.
* Qualitative review by Cubans for speech, names, customs and the "abuse" handling.
* Which other regions to add first (Camagüey/Las Villas for the columns; Escambray; Isla de Pinos).
* Whether the networks layer above is worth building before the Unreal port.

## Round 3 decisions (hallmark systems, inventory, bonds, UI)

| Request | What was built | Where |
|---|---|---|
| Make the key traits of the Cuban rebels solid | Period weapons incl. bazooka and mortar crews; treatment of prisoners, mercy index and amnesty; land reform (seizure menu, cooperatives, compensation, the Sierra law); platform forecasts and polls | `data.js`, `combat.js`, `orders.js`, `policy.js` |
| Friendships that become as strong as family | A bond meter per pair: proximity, ×6 in combat, shared rations, bandages; at full strength a bond weighs 1.0 in the audience of events (like a spouse) | `bonds.js`, `gen.js` |
| Heavily commented code | Every file has a header; every section and function has a comment; balance numbers in documented TUNE blocks | all `js/*.js` |
| Design Bible up to date | New sections 12i–12p | `docs/DESIGN_BIBLE.md` |
| Clever, modern, context-aware UI with drag and drop | The Pack window (drag items between people, stores, ground), the suggestion strip, glass styling | `pack.js`, `cmdui.js`, `index.html` |
| Each soldier has an inventory with a maximum | Weight-based capacity from individual strength, age and health; slowdown when overloaded | `inventory.js` |
| Soldiers carry food and water and share with comrades | Packs; the neediest comrade within range is helped; medics hand out bandages | `inventory.js` |
| Restrict food/water; disobedience if loyalty is low or they are too hungry/thirsty | Supply orders; per-check chance to cheat rises with need², low loyalty and low trust; cheating costs trust and discipline | `inventory.js`, `orders.js` |

## Round 4 decisions (agency, camp, land, ideology, shell)

| Request | What was built | Where |
|---|---|---|
| Compare with other RTS/squad games; use what players enjoy | Research with honest provenance (sourced vs recalled), design lessons table | `docs/RESEARCH.md` |
| No "redistribute land" button; important things in the world, in real time | Physical verbs on placed things; context wheel; land reform as notice → survey → grant → sow → harvest | `things.js`, `actions.js`, `farm.js`, `docs/PLAYER_AGENCY.md` |
| Many commands, messages and promises that vary with context | **Voice**: lines that depend on the listener's state; promise ledger with fulfilment checks | `ideology.js` |
| Ideology as a functional part; indoctrination by hand-tailored values | Six values per person, creed = what you say, deeds = what you do, gap = hypocrisy; texts, speeches, pamphlets, posters, letters | `ideology.js`, `docs/IDEOLOGY.md` |
| Action recording like Photoshop actions, stops with explanation, returns to start | Recorder + macro engine; spot/distance and specific/nearest toggles; legible failure; routines | `actions.js` |
| Daily routine: latrine, food storage, sleeping, fuel, watches, literacy, medical | Camp life model and preset chores | `camp.js` |
| Simplify/modernise UI; settings and real-game features | Grouped wheel (second ring for variants), pause menu, settings, key rebinding, saves, autosave | `settings.js`, `things.js` |

Choices to note: (1) **orders still cannot be given while paused**; recording happens in real time. (2) Conversation stays a menu (what you *say*); everything else is a verb. (3) The creed has no slider: it is the average of what you actually said. (4) Historical details marked [recalled] in `RESEARCH.md` must be verified against the primary texts before release.

## Round 5: hunting and accurate fauna
Wild game now matches what an Oriente guerrilla could eat (see `HUNTING.md`); turkey removed (not Cuban). Kills leave carcasses that must be dressed; meat rots unless smoked; snares/fishing give a silent alternative to shooting. Cartridges and noise are the cost of the rifle.

## Round 6: awareness, vehicles, towns
NPCs get eyes (cones, light, walls), ears and judgement, and a repertoire of ~30 reactions; a guerrilla's armed presence means different things in town and country; hidden pistols blend. Vehicles became machines (faults, repairs, cargo, trunk, orders) with period silhouettes. Towns got more building types, trades, shifts and traffic. See `AWARENESS_VEHICLES_TOWNS.md`.

## Round 7: menus → world (first three)
Crafting became benches, rationing became a cook pot with servings at mealtime, foraging became a face-to-face trade (`workshop.js`). Still to move: prisoners/trials, recruitment at the camp edge, the travel map, couriers, broadcasts/posters, the sick bay, governing.

## Round 8: weather, states, and the rest of the menus
* **Climate** (`climate.js`): Cuban monthly normals, nortes and heat waves; body (heat, chill, wet, feet, sleep debt, hygiene) and mind (happiness, boredom, grief, trauma) tracked on every person; effects on aim, reload, speed, sentries, thirst, food and firewood burn, vehicle heat/battery/fuel, army morale — for both sides. Status-word bubbles (5 s, only for strong values, every 45–120 real seconds) over your own people; the whole state panel on rollover.
* **Menus → world** (finished): prisoners and trials (`captives.js`), recruitment at the gate (`recruits.js`), the road as a place with checkpoints, mule trains, couriers on foot (`journeys.js`), Radio Rebelde broadcasts, the sick bay with stretchers and cots, and the eight governing matters as petition banners at Havana's buildings (`services.js`).
* The manifesto panel (P) and factions panel stay as overviews of what you have said and how people stand.

## Round 9: morale boosters (`morale.js`)
A guitar with a real carrying cost, played when safe (never with soldiers within earshot; the army can hear music), plus coffee, cigars, rum (aim and discipline cost), dominoes, pelota and mail. They act on the happiness/boredom/grief/stress layer from `climate.js`, so the status words ("happy", "bored", "grieving") show the effect.

## Round 10: a tidy screen (UI polish and the last in-world conveniences)
* **One notebook** (`notebook.js`): Journal · Map · Manifesto · Factions · Camp · Actions · Creed · Diary · Help · Menu as tabs on one modal; the six top-bar buttons are gone. Old hotkeys open the matching tab.
* **Lens keys** (`lens.js`): hold L (or tap to cycle, wheel while held) to overlay what the enemy sees, what carries sound and smoke, camp exposure, supplies. Information lives in the world, not in panels.
* **Declutter** (`declutter.js`): compact side panels that expand on hover, three-line log, command bar only when something is selected.
* **Convenience** (`convenience.js`): wheel ranks verbs by use, middle-click repeats the last verb, the duty board on the blackboard gives standing chores, "wait here" verb, auto-slow on contact.
* **Break / make camp** (`camping.js`): pack the camp into gear carried by people and vehicles, unpack it elsewhere. A camp that stays too long becomes *exposed* (smoke, footprints, noise), raising raid odds; moving resets it.
* **Feasts and funerals** (`rituals.js`): a calendar of Cuban feast days; roasting a pig at a lit fire feeds and bonds the camp (stronger on a feast day) but raises exposure; toasts; burials draw mourners.
* **Informer tells** (`suspects.js`): informers behave like informers (slip out at night, ask questions); you can have a man watched, ask him, or search his kit. Mistakes cost trust.
* **Diary** (`diary.js`): each night an entry is written from the day's log; read it in the notebook.
* **Sound** (`audio.js`): procedural ambience (cicadas, frogs, wind, rain) and guitar notes in sync with the morale beat.
* **Guided start** (`guide.js`): El Viejo speaks five short lines, each waiting for you to do the thing (walk, Q wheel, a verb, hold L, J). F2 skips; never runs on loaded games or `?auto=`.
* **Developer overlay** (`devlens.js`): F3 shows fps, counts, clock and the hovered actor's raw state.

## Round 11: events in real time (`situations.js`)
Event cards no longer stop the game. A decision becomes a banner (headline, one line, small keyed hints such as "1 Go back · 2 Continue on course") with a timer; ignoring it applies the passive option. One-choice cards become fading notices. Story beats (prologue, Havana, 1961, collapse, victory/defeat) remain full pages. Number keys answer a live situation (they otherwise recall control groups). Test runs keep blocking cards (`navigator.webdriver`). Also fixed the log collapsing to a sliver on narrow screens. Next step in the same direction: give individual events a physical form in the world (a swimmer in the water, a truck on the road) so the response is an action, not a hint.
