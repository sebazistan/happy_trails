# CUBEA — Ideas and open questions

Answered questions and the decisions that came out of them are in **`DECISIONS.md`**. This file is the idea shelf, with status, and what is still open.

## A. Ideas

Status: ✅ built · 🟡 partly · ⬜ designed · ✖ dropped

**Mechanics that use what is already built**
1. ✅ **Barbudos.** Rebel cubes grow beards with service; infiltrators and informers rarely do (a tell).
2. ✅ **Mail call.** Letters drawn from each soldier's *actual* family graph.
3. ⬜ **Lectores.** A reader in a cigar workshop is a one-person radio station — and a target for the police.
4. ⬜ **Compadrazgo as a system.** Choosing a compadre at a baptism or wedding; a binding edge that carries loyalty and obligation. (Fits the networks layer in `DECISIONS.md`.)
5. ⬜ **Radio dial UI.** Radio Rebelde, CMQ, baseball, dance music; the same event log, different headlines, and a credibility meter.
6. 🟡 **Rumour ripples.** The ripple is in the simulation and the inspector; the visual (speech icons hopping along the graph) is not.
7. ✅ **Graph detective.** Informer hunting by tells and by paying your network (replaces the old foresight tokens).
8. ⬜ **Obituaries and the People's Ledger.** A generated paragraph per dead Cubean; the end screen as a memorial wall.
9. 🟡 **Thought line.** The inspector explains *why* each person feels as they do (`explainStance`); a single-sentence summary is not yet generated.
10. ✖ **Time-traveller sight / rewind.** Dropped with the time traveller.

**Fiction and world**
11. 🟡 **The zafra as the heartbeat** (the harvest calendar drives prices and hunger; cane-fire sabotage with a human cost is not built).
12. ⬜ **Festivals** (Virgen de la Caridad 8 Sept, Carnival, Reyes, Nochebuena) — also the syncretic calendar in `DECISIONS.md`.
13. ⬜ **Baseball** as ceasefire, recruiting tool and statement.
14. 🟡 **Smuggling by sea.** Contraband runs on the Cayo boats exist as a racket; a navigation mini-game does not. The Granma crossing is the first sea scene.
15. ✅ **Foreign actors.** US arms to the regime, an American-owned mill, sailors on shore leave, a diplomat, an agent with a lot of money, the casino mob, the embargo. Kidnapping for ransom is a racket (and has American consequences).
16. ⬜ **Ageing and orphans.** Children grow up inside the two-year span; some turn 16 with a grudge.
17. ⬜ **Justice scenes.** A village tribunal with jurors from the community.
18. ⬜ **Hurricane season and drought** as shocks that test promises.
19. ✅ **Rackets and the mercenary drift** (protection, contraband, kidnapping) — profitable, and the band becomes a business.
20. ✅ **The non-violent path** (silent marches; mostly brutalised).

**Meta**
21. ⬜ **Reusable engine for other conflicts** — factions, planks, rosters, scenes, events as data (Algeria, Vietnam, the Philippines, Iran, Angola…). See `UNREAL_CODE_BIBLE.md` §RevolutionKit. *Decided:* anti-imperialist rebel conflicts, including those that ended badly; no regime-side version; no educational mode.
22. ✅ **After the fall of Havana** — eight governing decisions and the invasion at Playa Girón, then the end.
23. ✖ **Asymmetric multiplayer; play-as-regime.** Not wanted.
24. ⬜ **Networks layer** (ilé, cabildo, abakuá, logia, centro, parroquia) — see `DECISIONS.md`.

## B. Questions still open

**Production**
1. Birthplaces and other roster fields (🟡/⚠ in `ROSTER.md`) — to come from you.
2. Who can review language, names, customs and the "abuse" handling (Cuban consultants, historians, sensitivity readers)?
3. Release target (Steam early access vs. something else) — affects how much to polish the Spanish tiers and accessibility.

**Content**
4. Which region next: Escambray / Las Villas (the Directorio and Che's front), Camagüey, Isla de Pinos, Pinar del Río?
5. The networks layer — worth building before the Unreal port, or after?
6. How many of the governing decisions should *echo* on the Bay of Pigs outcome? Currently: support, readiness, unity, repression, the rackets, American strings. Add the literacy campaign and the economy as explicit modifiers?

**Design details**
7. Granma intro: the crossing is about 1 minute of play. Longer, with more incidents? Or tighter?
8. Fog of war: the radius is the same for everyone with a small experience modifier. Binoculars, lookouts at heights, and night vision (cats' eyes…) are possible; is the added complexity worth it?
9. Orders by courier with delay (see `COMMANDS.md` §7) — essential once maps are very large, or too fiddly?
10. Is the Director too visible? The Journal shows its variables. Hide in release, or keep as a "transparency mode"?
