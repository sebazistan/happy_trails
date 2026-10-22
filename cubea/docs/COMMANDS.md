# CUBEA — Commands and the command UI

How you tell a few dozen named people what to do, how the interface is organised, and what happens when they will not. ✅ built in the prototype · ⬜ proposed.

## 1. Principles

1. **Select → verb → target → modifiers.** One grammar for everything: pick who, pick what, pick where/whom, then decide *how* (queue, volunteers, lead them yourself).
2. **People, not unit icons.** The selected cubes show their names and faces. You choose people by what you know about them (health, experience, traits, weapon), not by "squad 3".
3. **Every refusal is visible.** A soldier who will not do something says why, in words.
4. **No planning while paused.** You can look, read the journal, inspect families; you cannot give orders. Time is the pressure.
5. **Orders have costs.** An order that sends people into a known death costs trust; an order that makes them work in the middle of a firefight is dropped; a task takes time.
6. **Fog of war.** You only order against what you have seen or what you know.

## 2. Selecting people ✅

| Action | How |
|---|---|
| A whole group | click it in the left panel, or press **1–9** |
| A box | **Ctrl-drag** on the map |
| One person | Shift-click or Ctrl-click (toggles) |
| By what they are | the **Select…** menu: Everyone · Armed · No rifle · Wounded · Healthy · Veterans · Green · Rested · Women · Brave · Hotheads · Medics & kind; optional ordering: by experience, by health |
| Make a named group | **+ New group from selection** (prompts for a name), or **Shift+1–9** to save the selection into a slot |

Groups are people lists that also carry a *stance* (Follow, Hold, Ambush, Scout, Forage, Harass, Withdraw), which is the default behaviour when no order is active.

## 3. The orders ✅

Orders live in the **command bar** (bottom centre), five tabs. A tab button arms the order; most then want a click on the map (Esc or right-click cancels; **Shift** keeps placing / queues).

### Move
| Order | What it does |
|---|---|
| **Move** | Walk there. Shift queues waypoints. Right-click does this directly. |
| **Follow me** | Drop everything; stay close to you. |
| **Hold here** | Go to the spot and hold it; fire at will. |
| **Stand guard** | Hold the spot *and* see farther (×1.5 sight). |

### Fight
| Order | What it does |
|---|---|
| **Attack** | Advance to a place; stop and fight what they meet on the way. |
| **Focus fire** | Everyone shoots one soldier (right-click on a visible soldier does this). |
| **Ambush** | Slip to a spot, hide, hold fire until close — **F** springs it. |
| **Patrol** | Walk a loop through the points you click (Enter finishes). |
| **Retreat** | Run to a place without firing. Never counts as dangerous. |
| **Mortar fire** | The tube carrier deploys and lobs shells at the point; others in the selection are the crew (they hand over shells). Friendly fire is real. |

### Recon
| Order | What it does |
|---|---|
| **Scout** | Go quietly, look for ~14 s, come back and report how many soldiers were seen. |
| **Lookout** | Lie hidden at a spot and watch (sight ×1.5). |
| **Stalk** | Creep toward one soldier, stopping about 115 px away. |
| **Hide here** | Go to ground where they stand; hold fire until the enemy is close. |

### Camp
| Order | What it does |
|---|---|
| **Dig in** | A foxhole (14 s of work): half damage from bullets while in it. |
| **Dig latrine** | Camp hygiene +28. A camp without latrines gets **dysentery**. |
| **Fetch water** | Walk to the nearest water, fill canteens, come back; the squad's thirst drops. |
| **Carry supplies** | Collect ground items near a spot and bring them to you. |
| **Build (labour)** | Work a camp plot; each worker cuts the cost 15% (up to 50%). |
| **Rest** | Sleep where told: energy and health recover. |
| **Treat wounded** | A medic goes to the nearest wounded friend and uses medicine. |

### Supply (instant; set a standing allowance)
| Order | What it does |
|---|---|
| **Food: full / half / none** | How freely the selected eat from their own packs. Hungry people *disobey* a harsh restriction (see `docs/DESIGN_BIBLE.md` §12i). |
| **Water: free / sparing / none** | The same for water (e.g. forbid drinking while hiding in an ambush). |
| **Share out** | Pool everyone's rations and canteens and deal them back evenly. |

### People
| Order | What it does |
|---|---|
| **Help a peasant** | Work a peasant's plot ~18 s; they remember it; local trust ticks up. |
| **Feed livestock** | Small goodwill. |
| **Forage** | Gather food under your pay / vale / take policy. |

Non-combat tasks (dig, latrine, water, carry, build, rest, treat, help, feed) are **dropped when the shooting starts**: people fight, and then go back to work.

## 4. Modifiers ✅

* **Queue (Shift).** Chain moves or tasks; people finish one and start the next.
* **Volunteers.** The *Volunteers: N* toggle asks who steps forward instead of ordering named people. Willing people (brave, idealist, experienced, trusting, morale high, early in the war) raise a hand; the rest look at the ground. Volunteers gain trust; a volunteer is far less likely to refuse a dangerous task. If nobody steps forward, you get to decide whether to order someone anyway.
* **Lead them yourself.** Offered when they object to an order (below).
* **Cancel (Backspace).** Back to the squad stance.

## 5. Obedience, argument and refusal ✅

1. **Everyday friction.** Each order is rolled against obedience (loyalty, morale, experience, discipline, trust − hunger, exhaustion, fear, stress, thirst). A "no" is spoken ("Tengo hambre", "Estoy agotado") and retried.
2. **Danger estimate.** For an order with a target place, the game counts *known* enemies near it — only those someone actually saw in the last two minutes, plus a known army post — against the strength of the people you are sending (weapon, experience, health). The ratio gives **ok · risky · deadly**. The command bar previews it under the cursor ("DEADLY: 8 known soldiers near").
3. **Deadly.** The selected people argue: *"Jefe, you are sending us to die."* You may **Reconsider**, **Lead them yourself** (they trust a leader who goes first — much more in the early war), or insist (**That is an order**).
4. **If you insist.** Each person rolls willingness (trust, experience, morale, fear, traits, early-war bonus). A refuser either **leaves** (their support falls to near zero, they go home, a few defect to the army and may inform) or **balks** (stands where they are and loses trust). Their families hear why.
5. **Trust (`p.trust`, 0–100).** Falls when you send someone on a known-deadly order (−5), when a refusal happens, when you favour armed men over veterans; rises when you ask for volunteers (+2), when you share the risk, and — slowly — when you stand near them in a firefight.

## 6. The interface layout ✅

```
┌──────────────── top bar: clock · chips (food, pesos, rounds, medicine, grenades, spare rifles) · speed ────────────────┐
│ LEFT: groups (1–9)            │                                         │ RIGHT: inspector (face, needs,            │
│  stance buttons,              │               the map                   │  loyalty and why, family tree, memories,  │
│  hunger / morale bars,        │       selected = gold rings             │  what you have noticed)                   │
│  + New group                  │       fog of war over it                │                                           │
│                               │                                         │                                           │
│ BOTTOM-CENTRE: command bar —  │  selected N · filter menu · volunteers  │  tabs: Move Fight Recon Camp People       │
│  order buttons · danger line  │                                         │                                           │
│ BOTTOM-LEFT: objective, hint  │ BOTTOM: log                             │ BOTTOM-RIGHT: minimap                     │
└──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

* **Two ways to do the common thing.** Right-click is the fast path (move, focus fire); the bar is the complete path.
* **The hint line** under the bar is the single place for "what will this do and what will it risk".
* **At sea** (the Granma crossing) the bar is hidden: you walk the deck, you do not command it.

## 7. Proposed additions ⬜

| Idea | Why |
|---|---|
| **Rules of engagement** per group: *hold fire · return fire · fire at will · fire only on command* | The ambush stance does this crudely; ROE is the clean version. |
| **If-then triggers**: "if contact, retreat to the creek"; "if wounded, fall back with a medic" | Gives a patrol a plan while you are elsewhere. |
| **Courier latency** at long range: orders reach distant groups by runner, in minutes | Makes the big maps matter; makes the *Llano* network valuable. |
| **Formations** (column, line, wedge, scattered) | Cheap; helps ambushes and moves in forest. |
| **Named assignments**: *you are the lookout of the camp tonight*, *you are the camp cook* | Roles that persist and generate trust or grievance. |
| **Hostage and prisoner orders**: guard, march, exchange | The prisoner economy already exists, but prisoners are not yet commanded. |
| **Quick-chat**: "Everybody listens" (a speech, morale and trust effects) | Leadership as a verb. |
| **Radio and signals**: whistles, flares, bird calls | Fog-of-war friendly coordination. |
| **Sabotage tasks**: cut wire, mine a bridge, burn cane | Shared with `objs`. |
| **Teach / train**: veterans train greens (experience over time) | A cheap use of the experience system. |

## 8. Unreal mapping

* **Selection and orders** are `UCommandSubsystem` state — a TArray of `FCubeanHandle` plus a current `FOrder` — fed by Enhanced Input. Orders are **data** (`UOrderDefinition` DataAssets with verb, targeting mode, danger multiplier, work seconds, UI tab, icon), so new verbs are content, not code.
* Execution is a **Mass Entity** processor per verb family (move/engage/work/observe) or a **StateTree** per verb for named characters. The prototype's `runOrder` switch maps one-to-one onto StateTree tasks.
* The danger estimate is the same function over the AI perception subsystem's *shared knowledge* (what any friendly actually saw), not world truth.
* Command UI is **UMG + Common UI**; the order bar is built from the DataAsset registry.

## 9. The Pack (drag and drop) ✅

Double-click a rebel, or press **T**, to open their pack: item tiles you can drag to a nearby comrade, to the column's stores, or to the ground; ground items and stores can be dragged back in. Plain drag = 1, Shift = all, Ctrl = 5. Heavy loads slow people down; the window shows the load bar and the slowdown. Dragging the weapon tile onto a comrade hands it over. The window is read-only while paused. Per-person ration buttons (food/water: free, half, none) are in the pack as well.

## 10. Context-aware suggestions ✅

Below the command bar, up to four buttons appear only when they matter: share out when people are hungry, fetch water when thirsty, treat when wounded and medicine exists, redistribute when overloaded, dig a latrine when the camp is filthy, ambush/retreat on contact, open the pack when rifles are spare and men are unarmed.
