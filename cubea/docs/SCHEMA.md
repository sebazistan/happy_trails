# CUBEA — Data Schema (as implemented in the prototype)

Source of truth: `js/gen.js` (`newPerson`), `js/sim.js` (`C.newGame`), `js/data.js` (static tables).
A deterministic cross-check dataset can be exported with `node tools/export_unreal_data.js` (see `UNREAL_CODE_BIBLE.md`).

## 1. World (`C.W`)

| Field | Meaning |
|---|---|
| `people[]` | every Cubean ever generated, indexed by `id` (dense) |
| `bySet{sid:[ids]}` | people currently residing in each settlement |
| `houses[]` | households `{id, sid, members[], head, cls, tenure, bld}` |
| `roster{id:Person}` | named historical/authored people by key (`che`, `raul`, `celia`…) |
| `party[]` | the Granma party (named + generated) |
| `player` | id of "Fidel" — the role the time-traveller steps into |
| `seed`, `day`, `nextEv` | world seed, game day (0 = 5 Dec 1956), event counter |

Memory budget for ≈3,100 people at ~130 B each ≈ 0.4 MB; ≈9,000 non-kin edges ≈ 0.2 MB. **Data size is not the constraint** — legibility and content are.

## 2. Person

```
id                 u32 dense index
first, last, last2 names (paternal surname = `last`, maternal = `last2`); tag = nametag override; nick
sex 'M'|'F'        yob int          birth/home/settlement  place ids
status             'alive'|'dead'|'jailed'|'exile'|'away'|'missing'
mother, father, spouse   ids or -1;   kids[]   ids          (siblings, cousins, in-laws are DERIVED)
rel[]              {id, t, w}   non-kin edges, symmetric. t ∈ friend|compadre|lover|comrade|coworker|neighbor|employer|employee|rival
eth                'blanca'|'negra'|'mulata'|'china'|'otra'     social position only, never tinted
occ, cls, fac      occupation key, class 0–4, faction key
hh, lineage        household id, lineage id

— politics —
trueStance  −100…+100   (− Batista, + rebel)             stance   what they show (differs for informers)
conv        0…100       conviction = how firmly held     covert, informant, revealed
iss[8]      −1…+1       position on each plank           sal[2]   the two planks they care most about
traits[]    keys: idealist opportunist devout hothead loyalist cautious brave gossip generous greedy drinker veteran stoic kind
mem[≤9]     {ev, val(±1), int(0–100), blame, kind, text, day, kin, who}

— body & mind —
needs{food,water,energy,safety,dignity,hope}  0–100 (higher = better)
fear, fearOf, anger, stress, morale   0–100
exp 0–100 (combat experience)   service (days in an army)
hp, maxHp, cracks[{x,y,a,l,n,s,t}], chunks[{pos 0–7, s}], limp, armHurt, bleed

— military —
mil {side:'army'|'rebel', rank, squad|unit}   wpn   stash   role   note
— look —
look {eyeX,eyeY,eyeR,brow,browT,mouthW,mouthY,nose,freckle,mole,sw,sh,hair,hairCol,style,glasses,beard,mustache,hat,bun,scarf}
```

**Chunk slots:** `pos` 0–3 = corners TL, TR, BR, BL; 4–7 = edge middles T, R, B, L.

## 3. Runtime actor (scene-local, not persisted)

`{ p, x, y, face, anim, side:'civ'|'army'|'rebel', squad, weapon{k,mag,spare}, weaponOut, aim, camo, hide, prone, panic, pain, shooting, muzzle, expr{…}, bubble, inside, path, brain{mode,target,…}, order, suppressed, susp, exposed, drawColor }`

Only people in the current scene have actors (≤ ~300). Everyone else is data + the daily tick.

## 4. Event

`{ id, type, day, victim(person), perpSide:'rebel'|'army'|null, sev 0–100, just, pub 0–1, positive|val, x, y, scene, settlement, text, memText, headline }`

## 5. Player state (`C.G`)

`res{food,money,ammo,med,fuel,gren,dyn,molo,pamph,vales,cloth,scrap}` · `policy{forage,justice}` · `platform{pub[8],real[8],declared[8],dayDeclared[8]}` · `deeds[8]` · `promises[]` (vales) · `trust{faction→0–1}` · `rep{fear,justice,honesty,discipline,competence}` · `regime{legit,armyMorale,usSupport,heat}` · `squads[4]{members[],stance}` · `pipe{balance,couriers[]}` · `strikePrep` · `foresight` · `base.built{}` · `unlocked.layer` · `flags{}`

## 6. Static tables (`js/data.js`)

48 occupations (faction, background for camouflage, class) · 14 traits · 9 weapons · 5 explosives · 8 vehicles · 52 building types · 19 places (8 playable, 11 off-map birthplaces) · 8 planks · 8 factions (mean issue stances + salience) · **38-person historical roster** (see `ROSTER.md`).

## 7. Mapping to Unreal (summary — details in `UNREAL_CODE_BIBLE.md`)

| JS | UE5 |
|---|---|
| `W.people[]` | `UCubeanDatabase` (WorldSubsystem) with **struct-of-arrays** (`TArray<float> TrueStance`, …) |
| `person.rel`, kin ids | `TArray<FCubeanEdge>` CSR adjacency (offset table) |
| `mem[]` | fixed-size ring in a flat `TArray<FCubeanMemory>` (9 per person) |
| `C.addEvent` | `UCubeaEventBus::Publish(FCubeaEvent)` → job queue |
| daily tick | `ParallelFor` over people at the game-day boundary |
| actor | `AActor`/`Mass Entity` depending on LOD tier |
| `iss[]`, `sal[]` | `float[8]` + `uint8[2]` |
| static tables | `UDataTable` from exported CSV/JSON |
