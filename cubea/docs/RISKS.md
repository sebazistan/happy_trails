# CUBEA — Serious Risk Assessment

*A clear-eyed list of how this game can become repetitive, grindy, slowly unwinnable, offensive, or simply unfinishable — with what the prototype already does about each, what evidence we have, and what is still open.*
Severity: 🔴 could sink the project · 🟠 serious · 🟡 manageable.

---

## 1. Scope: three games in one 🔴
Squad tactics, logistics/economy, and a political-social sim are each a full game. The prototype exists to prove they can share *one* spine (the family graph).
* **Done:** one spine; combat is "just" a source of events; politics is "just" a reader of memories. Camp building is fixed-slot (8 pads), crafting is 8 recipes.
* **Open:** the tactics are still shallow (no real cover system, no suppression UI beyond bubbles). Decide *which of the three is the anchor* for marketing and polish. Recommendation: tactics first.
* **Cut list if time runs out:** vehicles beyond jeep/truck/oxcart; boats; crafting variety; second town; Havana set-pieces beyond the pitch/courier; the island map (replace with a menu).

## 2. The invisible-simulation problem 🔴
If players can't see *why* a village is cold, they assume randomness and stop trusting it.
* **Done:** inspector with the exact contribution list the sim uses (`explainStance`); family tree; memories; "what they remember"; colour/saturation; faces; nametags; log lines naming the cause; Bohemia headlines; El Viejo's advice; the postmortem screen.
* **Open:** a **ripple visualisation** (watch the shock travel along family edges), a **"why did that happen?"** button on log entries, a settlement heat-map layer.

## 3. Death spirals & unwinnable drift 🔴
Hunger → disobedience → forced foraging → hatred → less food; losses → morale → desertion → more losses; fear → informers → raids → more fear.
* **Done:** (a) heat scales with force size and kills (early success draws offensives; weakness hides you); (b) memory caps/decay/dedupe; (c) lifelines (vale credit, defectors, storm, hidden wounded, donation) selected by a **spiral sensor**; (d) El Viejo's contextual warnings; (e) failure-forward: the leader's death offers a *rewind*; (f) desperation does not snowball: shocks stop at ~2 hops.
* **Evidence:** a 120-day random-orders soak (leader invulnerable) never crashed or NaN'd and the Director fired 32 mixed cards; foraging calibration shows *take* is ruinous quickly but recoverable only slowly (see Design Bible §12).
* **Open:** a formal **winnability harness** — bots starting from random mid-game snapshots must find a recovery path. Metric: *time between "point of no return" and the player's awareness* must be ≥ N days with visible warnings.

## 4. Dominant strategies 🟠
"Pay for everything, never kill" tends to be solved; "vale spam" is a loan exploit.
* **Done:** paying costs real pesos (≈ 8–25/day for a column); repeated payments to one person merge (no goodwill farming); vales repay *with a cost* (honesty/trust if you default) and give *less* than paying; cooldowns per seller (one sale a day) and per forager (game-hours); donors have a 60-day cooldown; heat and the Director's offensive/airraid events punish passive stockpiling.
* **Open:** the economy has few *sinks* beyond food/ammo. Add: medicine decay, spoilage, bribes, wages for couriers, repair costs. Add the arms embargo effect on ammunition prices.

## 5. Grind 🟠
Repeated village visits to pay, forage and patrol become chores.
* **Done:** forage stance automates purchases; squads follow; resting skips the night; the layered reveal limits what you must manage early; events are *choices*, not chores.
* **Open:** standing orders per base ("keep 20 food"), lieutenants who manage a region, "auto-resupply" caravans.

## 6. Procedural sameness 🟠
"Pedro's cousin was killed" ×1000.
* **Done:** 38 authored characters, 30 event definitions, 17 anchors, real and fictional places, varied faces/hats/jobs, memory *texts* that name relatives, the Bohemia headline layer.
* **Open:** authored *set pieces* (≈ 100) and distinct town rules; cube silhouettes for the ~30 named people (hat, beard, medal); generated **obituaries**; a "legends" screen.

## 7. Perceived AI unfairness 🟠
"My squad ignored me" is poison in tactics games.
* **Done:** obedience percentage is *shown*; a refusal produces a reason bubble; refusals retry; orders show a marker; the prologue ambush is hard but telegraphed (air-raid rings, MG positions in the objective).
* **Open:** an explicit **command-confidence** UI; an "obey anyway" option with a morale/discipline cost.

## 8. Replay value 🟠
* **Done:** world seed; deterministic generation; Director randomness; conditional anchors; foresight tokens as a difficulty dial; different platforms.
* **Open:** per-run modifiers (who the traitors are, which landowners are brutal, the army commander), scenario variants (1895, 1933), a mirrored Batista campaign.

## 9. Balance testing is a project in itself 🔴
Emergent systems cannot be hand-balanced.
* **Done:** browser-driven harnesses used here: soak (120 days), ripple check, calibration of policies, bot ambush runs, event/anchor exerciser.
* **Open:** port to a **headless commandlet** in UE with thousands of seeds in CI and CSV output; golden population data (`unreal_export/population_golden.json`) already exists for cross-checking the C++ generator.

## 10. Cultural, ethical and platform risk 🔴
The subject is real, recent and bitterly contested among Cubans in Cuba and in exile.
* **Women:** the "tradeoff" must not trivialise sexism. Prototype frames it as *shifting coalitions* and gives women named, operational roles; sexual violence by one's own soldiers appears only as an abstract "misconduct" decision with consequences — **never depicted**. Keep it that way.
* **Race:** ethnicity is a social-position variable (access, profiling, salient issues), **never** the loyalty tint; Afro-Cuban leaders are named characters; the Batista exception (mixed-race, excluded from elite clubs) is acknowledged.
* **History:** the "winning formula" thesis is contested. The prototype includes a *concealment* mechanic (public vs private platform), shows that the real regime later became authoritarian (end text), and gives alternatives viable-for-a-while paths.
* **Process:** historians and Cuban consultants *before* release; content notes; store ratings and regional restrictions (violence, a real head of state) reviewed early; no glorification of atrocities.

## 11. Performance 🟡
* **Done:** 266 live actors in Santiago = ~1.4 ms update per frame; draw ≈ 20 ms in *software* rendering (headless), expected well under 5 ms on GPU. Generation 0.2 s.
* **Open (Unreal):** Mass Entity LOD; ISM with VAT; HUD-pass name tags; the cost of clip-based chunk cut-outs becomes a material mask.

## 12. What would make the whole thing fail
1. Players don't understand cause → effect. *(Fix: legibility; the postmortem.)*
2. The first hour isn't fun as a squad game. *(Fix: polish the ambush, Sierra camp, La Plata.)*
3. The history feels like a lecture. *(Fix: alternatives with visible ceilings, not scolding.)*
4. The ripple is too gentle to matter, or too harsh to recover from. *(Fix: calibration harness; tune `C.TUNE`.)*
5. Content runs out. *(Fix: expand rosters/anchors; scenario DLC.)*
