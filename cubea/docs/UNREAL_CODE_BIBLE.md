# CUBEA — Unreal Engine 5 Code Bible

*How to turn the JS prototype into an isometric low-poly UE5 game. Written against UE 5.4+ concepts (Mass Entity, StateTree, Chaos Vehicles, Niagara, Enhanced Input, CommonUI). Names of engine APIs change between versions — verify against your installed version before copying.*

**Golden rule:** keep the **simulation (people, graph, events, loyalty, director)** in a plain C++ module with *no UObjects and no rendering*. Everything the player sees is a *projection* of that data. That gives you determinism, headless balancing, small saves, and the ability to simulate 3,000–20,000 people cheaply.

---

## 1. Targets & budgets (PC only)

| Item | Budget |
|---|---|
| People in database | 3,000 now → 20,000 later (≈ 2.5 MB at 130 B/person; trivial) |
| Tier A: full actors near the player | ≤ 150 |
| Tier B: Mass Entity visible crowd | ≤ 2,000 |
| Tier C: data only (daily tick) | everyone else |
| Daily tick | < 10 ms for 20k people (ParallelFor, no allocation) |
| Bullets in flight | ≤ 400 (struct array + substepped traces) |
| Frame | 60 fps on a mid GPU at 1440p |

## 2. Module / plugin layout

```
Source/
  CubeaCore/        (Public/Private)   pure C++: no UObject, no Slate
      CubeaRng.h            Mulberry32 identical to util.js
      CubeaTypes.h          enums, FCubeanId, edge types
      CubeanDatabase.h/.cpp SoA people store, kin queries, edge CSR
      WorldGen.h/.cpp       lineages → marriages → households → fates → edges → garrisons → roster
      EventBus.h/.cpp       Publish(), memory ring, delayed queue
      LoyaltyEngine.h/.cpp  target stance, explain, daily tick (ParallelFor)
      Director.h/.cpp       tension model, spiral sensor, event selection
      Economy.h/.cpp        prices, vales, foraging transactions
      Regime.h/.cpp         legitimacy, army morale, heat
  CubeaGame/        UObject layer: subsystems, actors, Mass processors, GAS-lite combat, vehicles
  CubeaUI/          CommonUI/UMG widgets
  CubeaEditor/      DataTable importers, golden-data validators
  CubeaTests/       Automation tests + headless commandlet
Content/
  Data/             DataTables imported from unreal_export/*.json
  Cubes/            meshes, materials, Niagara, VAT textures
  World/            landscape/tiles, foliage, buildings
```

## 3. The simulation core (plain C++)

### 3.1 RNG — port exactly so seeds reproduce the JS world

```cpp
// CubeaRng.h — mulberry32, same stream as util.js (use uint32 arithmetic; do NOT use FRandomStream)
struct FCubeaRng {
  uint32 A;
  explicit FCubeaRng(uint32 Seed) : A(Seed) {}
  float Next() {                        // [0,1)
    A += 0x6D2B79F5u;
    uint32 T = A;
    T = (T ^ (T >> 15)) * (1u | T);
    T = (T + ((T ^ (T >> 7)) * (61u | T))) ^ T;
    return float((T ^ (T >> 14))) / 4294967296.0f;
  }
  int32 Int(int32 N) { return int32(Next() * N); }
  float Range(float Lo, float Hi) { return Lo + Next() * (Hi - Lo); }
  bool  Chance(float P) { return Next() < P; }
  float Gauss() { float U = 0, V = 0; while (U == 0) U = Next(); while (V == 0) V = Next(); return FMath::Sqrt(-2.f * FMath::Loge(U)) * FMath::Cos(2.f * PI * V); }
};
```
> ⚠ JS uses 64-bit doubles. Floats in C++ will drift. For exact agreement use `double` in the generator and `float` only for runtime state. Validate with the **golden file** (§13).

### 3.2 Struct-of-arrays people store

```cpp
using FCubeanId = uint32;

enum class ECubeanStatus : uint8 { Alive, Dead, Jailed, Exile, Away, Missing };
enum class EFaction : uint8 { Peasants, Workers, Middle, Students, Elite, Landowners, Church, Army };
enum class EEdgeType : uint8 { Friend, Compadre, Lover, Comrade, Coworker, Neighbor, Employer, Employee, Rival };

struct FCubeanMemory {                    // 16 bytes
  int32  EventId;  int16 Day;  uint8 Kind;  uint8 Kin;   // kin relation of the *subject*
  int8   Val;      uint8 Intensity;  uint8 Blame;  uint8 pad;  FCubeanId Who;
};

struct FCubeanEdge { FCubeanId Other; EEdgeType Type; uint8 Weight; };   // symmetric, stored on both ends

class FCubeanDatabase {
public:
  // identity
  TArray<FName> First, Last, Last2; TArray<uint8> Sex; TArray<int16> Yob;
  TArray<ECubeanStatus> Status; TArray<uint8> Settlement, Home, Birth;
  // kin (ids or -1)
  TArray<int32> Mother, Father, Spouse; TArray<TArray<FCubeanId>> Kids;  // consider a CSR for Kids too
  // politics
  TArray<float> TrueStance, Conviction; TArray<uint8> Informant /*bit0 informant, bit1 revealed, bit2 covert*/;
  TArray<TStaticArray<int8,8>> Issues;  TArray<TStaticArray<uint8,2>> Salient; TArray<EFaction> Faction;
  // body
  TArray<TStaticArray<uint8,6>> Needs;  TArray<uint8> Fear, Anger, Stress, Morale, Exp; TArray<float> Hp, MaxHp;
  // memories: fixed 9 per person in a flat array
  TArray<FCubeanMemory> Memories;       // size = People * 9; count in MemCount
  TArray<uint8> MemCount;
  // edges in CSR form (rebuild after generation)
  TArray<uint32> EdgeOffset; TArray<FCubeanEdge> Edges;
  int32 Num() const { return Status.Num(); }
};
```

### 3.3 Kin and audience queries (port of `kinOf` / `audienceOf`)

* Store only `Mother/Father/Spouse/Kids`. Derive siblings (children of parents), grandparents, aunts/uncles, nieces, cousins, in-laws by traversal.
* Kin weights: `Spouse 1, Child 1, Parent .9, Sibling .75, Grand .5, AuntNiece .35, InLaw .3, Cousin .25`; non-kin edges `Lover .8, Compadre .5, Comrade .5, Friend .4, Coworker .15, Neighbor .12, Employer .1, Rival −.2`; 2nd hop 0.4× through ties ≥ .5.
* **Audience** returns a `TSmallMap<FCubeanId, FAudienceEntry{float W; uint8 Rel}>`. It is called per event, not per tick. Use a scratch `TArray` with an epoch-stamp map to avoid allocation.

### 3.4 Event bus → memories

```cpp
struct FCubeaEvent {
  int32 Id; int16 Day; FName Type; FCubeanId Victim; uint8 PerpSide /*0 none,1 rebel,2 army*/;
  float Severity; bool bJust; float Publicity; int8 ForcedSign; uint8 Settlement;
  FVector2D Pos; FText Text, MemText, Headline;
};

class FEventBus {
public:
  void Publish(const FCubeaEvent& Ev);               // creates memories now or enqueues them
  void Tick(double GameMinutes);                      // apply due items
private:
  struct FQueued { double DueMin; FCubeanId Id; FCubeanMemory Mem; float W; };
  TArray<FQueued> Queue;                              // min-heap by DueMin
};
```
Rules (from `sim.js addEvent`): sign = +1 if the rebels did good or the army did harm; −1 if the rebels did harm; intensity = `sev × (just?0.55:1) × weight × (sameSettlement?1:0.8)`; witnesses immediate; kin (w ≥ .7) ≈ same day; others 2–5 days (gossip trait ×0.6); duplicate (same Kind+Who+Val within 30 days) merges: `int += 0.22 × new`.

### 3.5 Daily loyalty tick (port of `dayTick` + `explainStance`)

```cpp
void FLoyaltyEngine::DailyTick(FCubeanDatabase& Db, const FGameState& G, int32 Day) {
  ParallelFor(Db.Num(), [&](int32 i) {
    if (Db.Status[i] == ECubeanStatus::Dead || Db.Status[i] == ECubeanStatus::Exile) return;
    float Target = FactionMean[Db.Faction[i]] * 0.55f;
    // policy: two salient planks, positive fit scaled by trust(faction)
    for (int k = 0; k < 2; ++k) {
      int Plank = Db.Salient[i][k]; float Fit = G.Declared[Plank] ? 1.f - FMath::Abs((G.Pub[Plank]-1) - Db.Issues[i][Plank]/100.f) : 0.f;
      if (Fit > 0) Fit *= 0.4f + 0.6f * G.Trust[(int)Db.Faction[i]];
      Target += 46.f * (k==0?0.6f:0.4f) * Fit;
    }
    Target += RestOfPlatform(Db, i, G) * 14.f;
    Target += 0.2f * (0.6f*(Db.Needs[i][HOPE]-50) + 0.4f*(Db.Needs[i][DIGNITY]-50));
    for (const FCubeanMemory& M : MemoriesOf(Db, i)) Target += 0.55f * M.Val * M.Intensity * FMath::Pow(0.5f, (Day-M.Day)/HalfLife(M));  // 70 d, kin 260 d
    Target += 0.12f * (PeerMean(Db, i) - Db.TrueStance[i]);
    Target = FMath::Clamp(Target, -100.f, 100.f);
    float Rate = 0.05f * (1.f - Db.Conviction[i]/135.f);
    Db.TrueStance[i] = FMath::Clamp(Db.TrueStance[i] + (Target - Db.TrueStance[i]) * Rate, -100.f, 100.f);
    // conviction grows when pushed the way they already lean
  });
  // then: serial passes for needs drift, trust, regime, couriers, director
}
```
Keep a **`Explain(i)`** function that returns the same terms as labelled contributions — the UI "why" list calls it. *Never duplicate the formula; one function emits the terms and the tick sums them.*

### 3.6 Director

Port `events.js` structurally: `FDirectorVars` (pressure, momentum, tension, target, spiral, intensity7), `UCubeaEventDef` data assets with `Category`, `Tension`, `CooldownDays`, `MinLayer`, a `Weight` condition and a `Run` action. Anchors are data assets with a date and an optional condition. See `unreal_export/events_meta.json` for the current table.

---

## 4. Static data → DataTables

Run `node tools/export_unreal_data.js` → `unreal_export/*.json`. Import each as a `UDataTable` (row struct = `FTableRowBase`):

| JSON | Row struct |
|---|---|
| factions, planks, occupations, traits | `FCubeaFactionRow`, `FCubeaPlankRow`, `FCubeaOccupationRow`, `FCubeaTraitRow` |
| weapons, explosives, vehicles | `FCubeaWeaponRow` (dmg, rof, speed, range, spread, mag, reload), … |
| buildings, settlements, travel_edges | `FCubeaBuildingRow`, `FCubeaSettlementRow`, `FCubeaTravelEdgeRow` |
| roster | `FCubeaRosterRow` (name, birth place, side, traits, family tuples) |
| tuning | one `UCubeaTuningAsset` (all `C.TUNE` knobs, editable at runtime) |

Authoring rule: **gameplay numbers live in data, not code.** Designers tune from a spreadsheet.

---

## 5. Representation tiers

```
Tier C  data only            all people; daily tick; "village aggregates"
Tier B  Mass Entity          visible but unimportant: civilians, soldiers at range; ISM + vertex-animation walk
Tier A  full actor           ≤150 nearest + all named: ACubeanActor with MID, facial params, equipment sockets, StateTree
```
Promotion/demotion by distance and importance (named = always Tier A when in the scene). On promotion, copy from the DB (position, health, state); on demotion, write back.

### 5.1 Mass Entity for the crowd

Fragments (plain structs): `FCubeanIdFragment{FCubeanId Id}`, `FCubeanScheduleFragment{double NextPlanMin; FVector Goal; uint8 Task}`, `FCubeanLookFragment{…}`, `FCubeanMoodFragment{half Brow, Lid, Mouth…}`.
Processors:
* `UCubeaSchedule` — port of `planFor` using time-of-day + `FSmartObject`/zone graph targets (home door, field, shop, church…).
* `UCubeaPanic` — gunfire/explosion events add `Panic`; flee to the nearest door (Mass `ZoneGraph` lane query).
* `UCubeaMoodToRender` — pushes 6 floats per entity into `PerInstanceCustomData` (ISM) for the face material.
* `UCubeaLOD` — decides tier; spawns/despawns Tier A actors.

Walking: bake a 16-frame **vertex animation texture** (VAT) of the cube walk (legs/arms swing), sample in the material with an instance phase.

---

## 6. The cube in 3D (low-poly, material-driven)

### 6.1 Mesh
* **Body**: a 3×3×3 lattice of small cubes (27 cells) in one merged mesh *or* a single cube + dissolve mask. For *missing chunks* the lattice is clearest: hide cells (corner = 1 cell, edge = 2, big = 3) via a per-instance bitmask (`PerInstanceCustomData` or a 32-bit float-packed mask decoded in the vertex shader).
* **Limbs**: 2 arms, 2 legs as separate small cubes (parented sockets) for Tier A; baked into the VAT for Tier B.
* **Time traveller**: a sphere body (+ ring/torus orbiting) with the same limbs and a glowing clock-hand material.
* **Gear**: hats/hair/beards/beret/straw/kepi as small static meshes on a head socket; weapon on a hand socket.

### 6.2 Material parameters (per-instance or MID)

| Parameter | Source |
|---|---|
| `LoyaltyColor` | `loyaltyColor(trueStance or shown, conviction)` (white→red or white→blue; saturation = conviction) |
| `CamoAmount`, `EnvColor` | `camoTarget` result; environment sample from the landscape layer under the cube |
| `DamageCracks` (scalar 0–1) + `CrackSeed` | cracks count × freshness (heal → fade) |
| `ChunkMask` (uint32→float) | hidden lattice cells |
| `Face0..Face3` (4× float4) | brow tilt/height, lid, wide, mouth curve/open, squint, sweat/tear; eye spacing/size, mouth width/y, nose, glasses |
| `Pain`, `Dead` | tint/flatten; dead = lie down pose + X eyes |

### 6.3 The face is procedural

Do **not** author a face atlas. Draw it in the material with SDFs: two eye capsules (spacing/size from `look`), brow lines rotated by `BrowTilt`, mouth as a bezier/arc SDF with `Curve`/`Open`. Per-person resting temperament is a hash of the id. This reproduces `drawFace()` in `render.js` and gives every cube a unique, animatable face for free. Hats/beards are meshes (not material).

### 6.4 Name tags
Don't use one `UWidgetComponent` per person. Use a **single HUD pass** (Slate/`AHUD::DrawText` or a Niagara-text-free instanced billboard) that projects positions, declutters (priority: player > selected/hover > named > squad > enemy > rest; skip overlaps), and draws "First Last" in a small font. Mirror the JS rule in `render.js` (`placed[]`).

---

## 7. World, camera, atmosphere

* **Camera:** perspective with low FOV (~20–25°), pitch ≈ −50°, yaw snaps in 90° steps; follow the player with damping; `UCameraComponent` on a `USpringArmComponent` with collision off. Optionally orthographic (`ProjectionMode`, `OrthoWidth` ~ 2,500).
* **Occlusion:** roofs fade when the player/squad is behind or inside (`MPC_Cubea.PlayerPos` + a distance-and-angle mask in the roof material).
* **Terrain:** Landscape for the Sierra (heightmap + layers: jungle floor, cliff, trail, shallows), **modular tile kit** for villages/towns (tile = 100 uu ↔ JS `T = 16`). Buildings are modular low-poly kits with *roof and wall materials from `buildings.json`*; labels via a signage text actor (or the HUD pass).
* **Foliage:** `UHierarchicalInstancedStaticMeshComponent` with 3 tree LODs (jungle canopy as dense low-poly blobs, palms, ceiba). A translucent canopy layer *dims* units beneath (see JS: canopy composited at 34%).
* **Water:** simple stylised water plane (flow map optional); shallow crossing is walkable (nav area cost 1.7).
* **Weather & time:** a `UCubeaWeatherSubsystem` writes `MPC_Cubea` (rain, fog, night). Niagara rain; Directional Light + SkyAtmosphere or a stylised gradient sky. Mud: wet-ground material multiplies speed.
* **Navigation:** Recast navmesh with area types (road 0.7, trail 0.8, forest 1.6, shallows 1.7, cane 1.4); Mass uses ZoneGraph for crowds and the navmesh for squad movement.

---

## 8. Combat

### 8.1 Bullets
`UBulletSubsystem` stores `FBullet{FVector Pos, Vel; float Dmg, Life; uint32 OwnerId; uint8 Side}` in a flat array. Each tick **substep** by ≤ 5 uu: `LineTraceSingle` (visibility channel) against world + `OverlapMulti` against a **spatial hash** of actor capsules. Tile/foliage block chances from `scene.js` map to physical materials (foliage: probabilistic stop per 8 uu).
Render tracers as one Niagara ribbon system (data interface reading from the array) — thousands of tracers cost almost nothing.

### 8.2 Accuracy & damage (port `accuracyOf`, `tryFire`, `hurt`)
`spread = weapon.spr × (1 + .6·moving + stress/160 + .6·suppressed − .25·prone) × (1.65 − 1.15·acc)`, with `acc = .12 + .78·exp/100 + veteran − stress/400 − wounds`. Near-miss within 15 uu adds suppression. Serious hits (≥ 26 or ≥ 12 when low) remove a lattice cell (chunk) in the *direction of impact*, set limp/armHurt/bleed; light hits add a crack.

### 8.3 Explosions
`UExplosionSubsystem::Explode(Pos, Radius, Damage, Owner, Frags)`: LOS-checked radial damage (`Damage·(1−d/(1.35R))^1.05`), knockback, vehicle wreck/fuel fire, sabotage objects, shrapnel as extra bullets, camera shake + post-process flash, Niagara (flash gradient, dust ring, smoke columns, cube-fragment burst), decals (crater, scorch). Air raid = telegraphed (ring + whistle 1 s ahead).

### 8.4 Death
On death spawn Niagara **mesh particles** (body-coloured cubes + 1/3 dark red) with Chaos collision; leave a corpse actor (static pose, X eyes); drop the weapon as an interactable. **Always publish `FCubeaEvent`** so the family graph reacts.

---

## 9. AI

* **Perception:** a custom `UCubeaSightComponent` computing the same detection range: `210 uu × light × weather × (1 − .85·camo) × movement(.72 still, 1 moving) × weapon-out(1.35) × firing(1.4) × viewer-experience(.8–1.2)` plus a LOS opacity integral across foliage tiles. Don't use stock AIPerception cones for the camouflage mechanic.
* **Army:** StateTree with states *Patrol/Guard → Investigate → Engage → Search → Retreat/Surrender*; morale drives *Retreat* or *Surrender* (surrender when outnumbered or hp < 30–40%).
* **Rebels:** StateTree per stance (*Follow, Hold, Ambush, Scout, Forage, Harass, Withdraw*). **Obedience roll** per order, with a **speech-bubble reason on refusal** (never silent). Forage uses the economy transaction (pay/owe/take) and cooldowns in game-hours.
* **Civilians:** Mass schedule (home → work → plaza → church on Sunday), panic → nearest door.
* **Squad commands:** an `USquadSubsystem` with 4 squads, stance, focus target, scout bearing, `FireNow` flag (ambush).

## 10. Vehicles
`AWheeledVehiclePawn` + `UChaosWheeledVehicleMovementComponent` (low-poly meshes). Add `UCubeaVehicleStateComponent`: fuel (tank, burn), 4 tyre healths (flat → friction ×0.4, radius −, pull), engine health, fire, wreck. Gunfire to wheels pops tyres; fuel tank hits ignite when fuel > 0. Oxcart = kinematic cart with no fuel; boat = buoyancy-lite pawn. Interact menu: drive / refuel / patch / siphon / strip.

## 11. Director and content in the editor
* `UCubeaEventDef : UPrimaryDataAsset` — `Id, Category, Tension, CooldownDays, MinLayer, TArray<UCubeaCondition*> Weights (Instanced), TArray<UCubeaAction*> Actions`.
* `UCubeaAnchorDef` — date, optional condition, card definition. Cards use CommonUI with choices as `UCubeaChoice` (label, sub, enable-condition, effects).
* El Viejo = an NPC + `UCubeaAdviceProvider` reading the same `FDirectorVars`.

## 12. Save / load
Save = **world seed + deltas** (anything that diverged from the deterministic baseline: statuses, stances, memories, relationships made/broken, needs, scene entities that changed, resources, platform, flags). Save size stays tiny; generation is deterministic and < 0.5 s. Add a version stamp and migration hooks.

## 13. Testing & balancing (non-negotiable)
1. **Golden population test:** `unreal_export/population_golden.json` stores counts and the first 60 people from seed 1956. The C++ generator must reproduce them (same RNG consumption order!). Test in `CubeaTests`.
2. **Headless commandlet** `CubeaSim -seed=… -days=800 -policy=pay|vale|take -out=csv`: no rendering, runs the daily tick + Director + scripted bot policies, logs *support, trust, fear/justice, regime meters, stock levels, spiral risk*. Run thousands of seeds in CI to find dominant strategies and unwinnable states (see `RISKS.md`).
3. **Invariants:** *winnable from any reachable mid-game snapshot* (bots try recovery valves); *every route to an unrecoverable state shows ≥ N days of warning*.
4. **Soak tests** (random orders/travel/events, no crashes/NaNs) — the JS prototype already has one; port it.

## 14. JS → UE file map

| JS | UE |
|---|---|
| `util.js` | `CubeaRng.h`, color helpers in `CubeaColor.h` |
| `data.js` | DataTables + `UCubeaTuningAsset` |
| `gen.js` | `WorldGen.cpp`, `CubeanDatabase.cpp` |
| `scene.js` | World building tools: tile kits, `UCubeaSceneBuilder`, A\* → navmesh |
| `render.js` | cube materials, VAT, face SDF, HUD name tags, minimap widget |
| `ai.js` | StateTrees, Mass processors, `USquadSubsystem` |
| `combat.js` | `UBulletSubsystem`, `UExplosionSubsystem`, Niagara |
| `sim.js` | `EventBus`, `LoyaltyEngine`, `Economy`, `Regime` |
| `events.js` | `Director`, event/anchor data assets, `UCubeaAdviceProvider` |
| `ui.js` | CommonUI widgets (inspector, cards, map, manifesto, factions, journal, camp, end) |
| `main.js` | `ACubeaGameMode`, input (Enhanced Input), travel, clock |

## 15. Pitfalls specific to this design
* **Don't make every person an Actor.** The database is the world; actors are views.
* **Don't iterate all people per event.** Use the audience (≈ 50–80) + a bounded town diffusion sample.
* **Floating-point determinism** across platforms: keep generation in `double`; sim runtime in `float`.
* **Colour ≠ skin.** Loyalty tint is *never* a skin tone; ethnicity is a data variable shown in UI/dialogue.
* **Name-tag clutter** kills readability: declutter or fade by distance.
* **Opaque numbers kill trust:** every stat needs an `Explain`.
* **Colourblind support:** add a secondary channel (pattern/icon/ring) for loyalty.

## 16. Suggested milestones in UE
1. **M0 — data core:** CubeaCore + golden tests + headless sim (no art).
2. **M1 — graybox isometric:** camera, tile kit, cube + face material, 150 Tier-A actors, inspector UI.
3. **M2 — combat slice:** bullets, explosions, wounds, squads, the ambush.
4. **M3 — loop:** camp, supplies, forage, locals, Director.
5. **M4 — politics:** manifesto, trust, factions, anchors.
6. **M5 — the island:** Mass crowds, 2 villages, 2 towns, Santiago, Havana, vehicles, pipeline.
7. **M6 — polish/audio/localisation.**
