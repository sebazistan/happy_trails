#!/usr/bin/env node
/* Export Cubea's static tables + a deterministic population sample as JSON for Unreal DataTables / port verification.
   Usage:  node tools/export_unreal_data.js [seed=1956] [out=unreal_export]
   Writes: factions, planks, occupations, traits, weapons, vehicles, buildings, settlements, roster, events_meta,
           population_golden.json (stats + first 60 people, to verify a C++ re-implementation of the generator). */
const fs = require('fs'), path = require('path'), vm = require('vm');
const seed = parseInt(process.argv[2], 10) || 1956;
const outDir = path.resolve(__dirname, '..', process.argv[3] || 'unreal_export');
const root = path.resolve(__dirname, '..', 'js');
const noop = () => ({ addEventListener() {}, style: {}, getContext() { return {}; } });
const sandbox = { window: { devicePixelRatio: 1, addEventListener() {} }, document: { getElementById: noop, createElement: noop }, console, performance: { now: () => Date.now() }, Math, Date, setTimeout, location: { search: '' } };
sandbox.window.window = sandbox.window; vm.createContext(sandbox);
for (const f of ['util', 'data', 'gen', 'scene', 'render', 'ai', 'combat', 'sim', 'events']) vm.runInContext(fs.readFileSync(path.join(root, f + '.js'), 'utf8'), sandbox, { filename: f + '.js' });
const C = sandbox.window.C;
fs.mkdirSync(outDir, { recursive: true });
const w = (name, obj) => fs.writeFileSync(path.join(outDir, name + '.json'), JSON.stringify(obj, null, 1));
w('factions', C.FACTION_KEYS.map((k) => Object.assign({ key: k }, C.FACTIONS[k])));
w('planks', C.PLANKS);
w('occupations', Object.keys(C.OCC).map((k) => Object.assign({ key: k }, C.OCC[k])));
w('traits', Object.keys(C.TRAITS).map((k) => Object.assign({ key: k }, C.TRAITS[k])));
w('weapons', Object.keys(C.WEAPONS).map((k) => Object.assign({ key: k }, C.WEAPONS[k])));
w('explosives', Object.keys(C.EXPLOSIVES).map((k) => Object.assign({ key: k }, C.EXPLOSIVES[k])));
w('vehicles', Object.keys(C.VEHICLES).map((k) => Object.assign({ key: k }, C.VEHICLES[k])));
w('buildings', Object.keys(C.BLD).map((k) => Object.assign({ key: k }, C.BLD[k])));
w('settlements', Object.keys(C.SETTLEMENTS).map((k) => C.SETTLEMENTS[k]));
w('travel_edges', C.EDGES.map((e) => ({ a: e[0], b: e[1], footDays: e[2], vehicleHours: e[3] })));
w('roster', C.ROSTER);
w('tuning', C.TUNE);
w('events_meta', { events: C.story.defs.map((d) => ({ id: d.id, category: d.cat, tension: d.t, cooldownDays: d.cd, layer: d.layer || 1 })), anchors: C.story.anchors.map((a) => ({ id: a.id, day: a.day })) });
// deterministic population
const W = C.genWorld(seed);
const alive = W.people.filter((p) => p.status === 'alive');
const count = (arr, f) => arr.reduce((m, p) => { const k = f(p); m[k] = (m[k] || 0) + 1; return m; }, {});
let edges = 0; for (const p of W.people) edges += p.rel.length;
const slim = (p) => ({ id: p.id, name: C.fullName(p), sex: p.sex, yob: p.yob, status: p.status, settlement: p.settlement, home: p.home, mother: p.mother, father: p.father, spouse: p.spouse, kids: p.kids, occ: p.occ, fac: p.fac, eth: p.eth, trueStance: +p.trueStance.toFixed(2), conv: +p.conv.toFixed(2), traits: p.traits, iss: p.iss.map((x) => +x.toFixed(3)), sal: p.sal, rel: p.rel.map((r) => [r.id, r.t, +r.w.toFixed(2)]) });
w('population_golden', { seed, people: W.people.length, alive: alive.length, households: W.houses.length, nonKinEdges: edges / 2, byFaction: count(alive, (p) => p.fac), byStatus: count(W.people, (p) => p.status), bySettlement: count(alive, (p) => p.settlement), meanStance: +(alive.reduce((a, p) => a + p.trueStance, 0) / alive.length).toFixed(3), first60: W.people.slice(0, 60).map(slim) });
console.log('Exported to', outDir, '— people', W.people.length, 'alive', alive.length);
