# CUBEA — NPC awareness, vehicles, and the life of a town

*Code: `js/aware.js`, `js/garage.js`, `js/townlife.js`. Tests: `tools/harness/{aware,garage,town}.js`. Tunables are at the top of each file.*

## 1. Situational awareness (aware.js)
**Eyes.** Each civilian has a heading (from movement; idle people glance about) and a vision cone ≈150°, a short 360° bubble (30 px) for what is at their elbow, range shrinking at dusk/night, in rain and fog, and for the old; walls and trees block sight (`C.losOpacity`).
**Ears.** `C.hearSound(scene, x, y, loudness, kind)`: shots, explosions, shouts, screams, engines. Hearing radius depends on loudness, age, rain, night, and whether the listener is indoors (muffled). A heard-but-unseen sound turns the head and can start a reaction.
**Judgement (`C.readSubject`).**
* Armed guerrilla in the **country**: notable, not terrifying. Peasants watch, greet, hide the children, bring water, tip you off about soldiers — in proportion to their loyalty and to the band's reputation for fear (`g.rep.fear`).
* Armed guerrilla in a **town**: alarm. Many flee, bar the door, shutter the shop, call the children in, shout a warning, walk to the police, or go to a telephone.
* A guerrilla in **street clothes with a hidden pistol** blends (37 of 40 glances see nothing) unless they act oddly (run, hide, draw, shoot) or are **recognised** (famous face, beard, repeated sightings).
* Soldiers: ignored, glanced at, avoided, admired, followed by children, or warned about by sympathisers.
**Reactions** (≈30): ignore · glance · stare · freeze · flee · run home and bar the door · shutter the shop · hide · shout a warning · call the children in · walk to the police · use a telephone · approach · gather and gawk · greet · wave · quiet nod · bring water/food · tip off the rebels · offer a safe house · follow · admire · flirt · show off · ask to join · scold · cross themselves · avoid · warn rebels. Weights depend on fear, bravery, age, sex, loyalty, trade, piety, kids nearby, informer status, and recent alarm. Young women may be drawn to the soldiers or frightened by them; young men may want to enlist or show off; old women scold; the devout cross themselves.
**Consequences.** A report raises the scene's alert and sends nearby soldiers to the spot; a barred door (`b.lockUntil`) cannot be entered by neighbours or you (knock); a safe house hides you; a recruit gets a "wants to join" tag.
**Life.** Breakfast, lunch, supper (home, or a café for those who can), siesta for the old, hunger sends people to eat, sleep at night.
**Hover** any person to see: name, age, sex, job and *where they work*, where they live, what they are doing, awareness state, how they look and feel, kids, and what they have noticed. Hover a vehicle for fuel, hull, known faults, occupancy and cargo.

## 2. Vehicles (garage.js)
**Looks:** two-tone '55 Chevrolet with fins and whitewalls (random period colours, yellow taxis), Willys jeep with the spare on the back, stake-bed truck with cab and sacks, a rounded guagua with livery and luggage on the roof, GMC army truck with canvas bows and star, bull-drawn carreta and horse-drawn carretón.
**Mechanics:** engine temperature, coolant, fan belt, hoses, plugs, battery, fuel line, brakes, springs, tyres, hull. Heat from speed, load, soft ground, midday heat and rain; cooling from airflow, coolant and a belt. Faults: overheat (steam, cut power; cool down, open the hood, add water — drive it hot and the head gasket goes), burst hose, snapped belt, fouled plugs, dead battery, fuel-line clog, brake fade, broken spring, blown gasket, flat tyre, stuck in mud.
**Repairs** (verbs on the vehicle): look it over, repair <fault> with the right part, or an improvised fix (scrap, rope, a stocking) that is likelier to fail and comes back later; push-start (3 people), jump-start, push out of mud (2 people) or planks; some faults (spring, gasket) need a garage and pesos. Mechanics and chauffeurs are quicker and surer. Parts are in the tool rack and on sale at gas stations.
**Cargo:** a trunk / bed / roof rack with a weight limit; overloading slows and heats. **People:** seats (car 5, jeep 4, truck 14, bus 30, army truck 18) plus a hidden **trunk** (car 2, truck 4, bus 3); prisoners, the wounded, recruits and willing civilians can be loaded; `C.checkpointSearch` shows what a checkpoint would find.
**Orders:** put a soldier at the wheel, select him, right-click a destination: the vehicle drives there on roads (and cross-country for jeeps and trucks), stops and says why when something breaks. You can ride along as a passenger.

## 3. Town life (townlife.js)
**Buildings:** restaurants, bakeries, butchers, a market, garages, post offices, bars, hardware, shoe and tobacco shops, bus station, bigger schools, on top of the older church, hospital, clinic, town hall, bank, hotel, casino, barracks, filling station, factory, union.
**Trades:** baker, butcher, cook, barman, shoemaker, blacksmith, mason, postman, nurse, street vendor, milkman, carter, night watchman (*sereno*), filling-station attendant — added to the existing 40-odd.
**Schedules:** bakers at 3 a.m.; butchers; cooks through lunch and supper; bars open late; nurses on shifts; postmen on rounds; milk carts at dawn; Saturday market; the evening out (men mostly), dinner out for the well-off; the night watchman walks.
**Traffic:** more cars driving (70%), taxis in cities, buses and trucks, horse-drawn carretones; mounted guardia rural, cowboys and estate owners (speed ×1.9, a horse under them). Households that had no roof no longer wander at night; families double up in tenements. Towns now have ≈170–225 civilians plus soldiers (up from ≈90).

## 4. Known limits / next
* Vehicles cannot yet be driven *by civilians* in ambient traffic (cars drive themselves); a passing mechanic "fixes" ambient breakdowns after a while.
* No telephone network model: any shop/office/bank counts as a phone; calls take a few seconds.
* Inside buildings nothing is simulated beyond meals and sleep (customers, queues, class lessons are future work).
* Cows, hens and pigs are still livestock without owners' routines; markets have no stalls as objects yet.
* The Unreal export (`unreal_export/`) was regenerated after adding trades and buildings.
