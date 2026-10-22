# CUBEA — Research notes: what other games teach, and what the historical record gives us

*Honest provenance: web access from the build environment was limited (some sites unreachable, results thin). Items marked **[src]** are backed by a source we could open; items marked **[recalled]** come from general knowledge and must be verified against the primary texts (see "Reading list") before release. Nothing here quotes copyrighted text at length.*

## 1. What players enjoy in squad, tactics and colony games

### Sourced
* **Characters who feel alive.** Jagged Alliance is praised for mercenaries with personality — their snide remarks, complaints, cheers and bickering — on top of X-COM-style combat and RPG depth **[src: reviews and forum threads, e.g. [PC Gamer forum thread on squad tactics favourites](https://forums.pcgamer.com/threads/your-favorite-single-player-squad-party-tactical-games.128567)]**.
* **Permanent consequences and bonds.** XCOM players single out permanence, soldiers reacting when a squadmate is hurt or killed, and bonds between squadmates that reward keeping the same buddies together **[src: [Task & Purpose on XCOM 2: War of the Chosen](https://taskandpurpose.com/culture/xcom2-war-chosen-review)]**. *Cubea already has permanent death, memories along family edges and the new bond system.*
* **Pause-and-plan.** Door Kickers is loved for planning while paused and then watching the plan play out; commenters compare it to FTL's pause-and-play **[src: [Steam discussion](https://steamcommunity.com/app/248610/discussions/0/598198356181074001)]**. *Cubea deliberately forbids orders while paused; the action recorder below gives the same "plan, then watch it unfold" pleasure without breaking that rule: you plan by **recording an action live**, and it replays.*
* **Real-time-with-pause is a favourite format** in the Jagged Alliance lineage **[src: same PC Gamer thread]**.
* **Direct control and per-unit inventory.** Men of War lets you take over any unit, tracks ammunition and fuel, gives every soldier an inventory, and lets equipment be looted from the dead or ground or transferred between units **[src: [Men of War: Assault Squad](https://en.wikipedia.org/wiki/Men_of_War:_Assault_Squad)]**. *Cubea's Pack window and drag-and-drop follow this.*
* **Story generators.** RimWorld is described as an emergent story generator — individuals, disasters, raids, moods and base design colliding — with an AI storyteller dealing the events and a priorities system through which pawns choose jobs **[src: [Game Developer: Dwarf Fortress and RimWorld tell very different stories](https://gamedeveloper.com/design/dwarf-fortress-and-rimworld-tell-very-different-stories)]**. Reviewers also note the *failure stories*: a doctor sweeping the floor while a patient bleeds out because one priority number was wrong. *Cubea's Director is the storyteller; the action recorder and duty roster are our "work priorities" and must fail legibly (with a spoken reason), never silently.*
* **Hard-edged consequences in mercenary-company games.** Battle Brothers: permadeath, characters with backgrounds and traits, no rigid classes, equipment that matters; Wartales: deeper resource and crafting systems **[src: [Battle Brothers listing](https://rawg.io/games/battle-brothers), [Steam community comparison](https://steamcommunity.com/app/1527950/discussions/0/596263818508643319)]**.

### Recalled (genre knowledge, to be checked against player communities)
* **Company of Heroes:** suppression, cover and squad-level veterancy; the feeling that a *squad* is a living thing that fights better the longer it lives. → Cubea: cover/suppression exists in part; veterancy and "squad identity" can be made stronger (named groups, group history).
* **Frostpunk, This War of Mine:** moral choices with visible, material costs; survival management *is* the story. → Cubea: rations, latrines, sleeping, fuel, the night watch.
* **Mount & Blade, Crusader Kings:** retinue loyalty and promises as a system; people remember what you swore. → Cubea: the promise ledger.
* **Dwarf Fortress:** deep personal simulation that tells stories without scripts; the player designs *processes* (workshops, stockpiles). → Cubea: land reform and camp life are processes the player lays out on the ground.
* **Kenshi, Project Zomboid:** the world is physical; you carry, drop, build, wait. → Cubea: stakes, sacks, hammocks, buckets.
* **Spelunky/FTL-style legibility:** every failure has a visible cause.

### Design lessons we are adopting
1. **Personality through barks and bickering** (done in part; extend with ideology-flavoured banter).
2. **Everything physical:** if it matters, it exists in the world and can be carried, placed, stolen, spoiled, or watched.
3. **Plans that play out live:** record once, watch it run; failures stop with a spoken reason and the unit walks back.
4. **Priority/duty systems, but with legible failure.**
5. **Bonds as a retention mechanic:** keep friends together and they fight better (bonds exist; add buddy-assignment to watches and details).
6. **A storyteller, not a script:** events come from the world's state.
7. **No menu where a world action would do** (see `PLAYER_AGENCY.md`).

## 2. Historical flavour for the camp (Sierra Maestra, 1957–58)

### Sourced
* **Thin food, shared equally.** Rebels subsisted on the campesino staple of boiled **malanga**, mashed into gruel; wild pig was an occasional bonus and undercooked pork caused early food poisoning; officers and men ate the same rations; Fidel is reported furious at finding the rice and beans he expected already eaten; Che wrote that new recruits unused to a single meal a day would not eat food that tasted bad **[src: [Taste: Fidel Castro, Che Guevara, and the Guerrilla Gourmands](https://tastecooking.com/the-guerrilla-gourmands/)]**.
* **Dependence on the peasantry and mule trains.** Survivors of the first ambush lacked weapons, equipment, ammunition, food and medicine; later mule teams carried supplies; a rebel was sent for 50 cans of milk and a military lamp; the intellectuals quickly learned they depended on campesinos for survival **[src: same article; [Smithsonian](https://www.smithsonianmag.com/history/cuba-remembers-revolutionary-past-present-180960447/)]**.
* **Rustic industries, hospitals, an armory, a newspaper (*El Cubano Libre*) and Radio Rebelde** grew up in Column 4's zone **[src: [EcuRed, Escuela de Reclutas del Ejército Rebelde](https://www.ecured.cu/Escuela_de_Reclutas_del_Ej%C3%A9rcito_Rebelde)]**.
* **A recruit school at Minas del Frío** (about 400 recruits in early December 1958) near Column 7's zone **[src: [Duke/HAHR, The Cuban Rebel Army: a numerical survey](https://read.dukeupress.edu/hahr/article/58/2/284/150640/The-Cuban-Rebel-Army-A-Numerical-Survey)]**.
* **Literacy as a command practice.** An essay reports Che giving literacy classes to peasant recruits, reading aloud from Cervantes, Stevenson and Neruda, and requiring his peasant bodyguards to attend (a single, anecdotal source) **[src: [Commentary, Norman Gall](https://www.commentary.org/articles/norman-gall/the-legacy-of-che-guevara/)]**; he also opened clinics and trained new guerrillas **[src: [documentary transcript](https://www.journeyman.tv/film_documents/493/transcript/)]**. Che and Fidel's reading habits: [Paris Review](https://www.theparisreview.org/blog/2019/01/31/what-che-guevara-and-fidel-castro-read/).
* **Che as the column's medical officer** early in the war **[src: Yale photo archive caption, [collections.library.yale.edu](https://collections.library.yale.edu/catalog/10016808)]**.

### Recalled — verify in *Reminiscences of the Cuban Revolutionary War* (Guevara) and Fidel/Celia/Raúl accounts
Not confirmed by an accessible source here; treat as leads, not facts:
* Hammocks and a waterproof sheet ("nylon") as the usual bed; sleeping on the ground when none; foot problems and boot shortages; asthma (Che) and its effect on marching.
* Cooking smoke as a security problem (a fire in the forest is visible and smelled); cooking in the early morning mist or at night.
* A bakery, shoe and uniform workshops, a rebel armory (making grenades/mines), saddlery, a printing press; a rebel hospital with limited medicine; wounded carried on stretchers by relays of men.
* Night sentries ("posta"), passwords, rotating watches; discipline for desertion and for informing (the Eutimio Guerra case is in the game).
* Tobacco and coffee as morale items; mail and newspapers; reading aloud.
* Political education: patriotic texts (Martí), the *History Will Absolve Me* programme, the Sierra Maestra Manifesto (July 1957), Radio Rebelde's broadcasts, and *El Cubano Libre*.

### Reading list for the next verification pass
Che Guevara, *Reminiscences of the Cuban Revolutionary War* ([marxists.org PDF](https://www.marxists.org/archive/guevara/1963/reminiscences/reminiscences.pdf), not reachable from the build machine); Che Guevara Reader ([marxists.org](https://www.marxists.org/archive/guevara/1967/che-reader/che-reader.pdf)); Fidel Castro, *History Will Absolve Me* (1953); the Sierra Maestra Manifesto (1957); Celia Sánchez and Haydée Santamaría accounts; Carlos Franqui, *Diary of the Cuban Revolution*; Hugh Thomas, *Cuba: The Pursuit of Freedom*; Samuel Farber, *The Origins of the Cuban Revolution Reconsidered*. A Cuban historian and a veteran-oral-history archive would be ideal reviewers.

## 3. How the research changes the design (summary)
| Finding | Change |
|---|---|
| Players love personal stories and bickering | Barks tied to ideology, bonds and needs |
| Pause-and-plan is loved; we forbid ordering while paused | **Action recorder**: record once in real time, replay as a routine |
| Per-unit inventory and looting | Done (pack); extend to tools, seed, firewood, buckets |
| Work priorities produce stories **and failure** | Duty roster + macros with legible failure and "return to start" |
| Frostpunk-style survival-as-story | Camp life model: latrine, storage, sleeping, fuel, watch, sick call, school |
| Dwarf-Fortress-style processes | Land reform and camp layout as things placed on the ground |
| Retinue loyalty and promises | Promise ledger with real fulfilment checks |
| Historical texts as culture | Ideology system: documents with value vectors, read, taught and tested |
