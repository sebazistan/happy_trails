/* CUBEA — data.js : static game data. Spanish names, settlements, factions, planks, weapons, vehicles,
   buildings and the historical roster. Roster flags: v = 'ok' (checked against sources while building),
   'check' (from memory, verify), 'assumed' (birthplace unknown, placed for the demo). See docs/ROSTER.md */
(function () {
  'use strict';
  const C = (window.C = window.C || {});

  // ---------- calendar ----------
  C.START_UTC = Date.UTC(1956, 11, 5);                 // 5 Dec 1956: Alegría de Pío
  C.dateOf = (day) => new Date(C.START_UTC + day * 86400000);
  const MES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  C.dateStr = (day) => { const d = C.dateOf(day); return d.getUTCDate() + ' ' + MES[d.getUTCMonth()] + ' ' + d.getUTCFullYear(); };
  C.dayOfDate = (y, m, d) => Math.round((Date.UTC(y, m - 1, d) - C.START_UTC) / 86400000);
  C.yearOf = (day) => C.dateOf(day).getUTCFullYear();
  // Cuban sugar harvest (zafra) ~ Dec-May; the rest is tiempo muerto (dead season, hunger)
  C.isZafra = (day) => { const m = C.dateOf(day).getUTCMonth(); return m === 11 || m <= 4; };

  // ---------- names ----------
  C.MALE = 'José Juan Pedro Luis Carlos Antonio Manuel Francisco Jesús Rafael Miguel Ramón Ángel Eduardo Roberto Julio Armando Reinaldo Orlando Pablo Fernando Sergio Andrés Alberto Rogelio Ernesto Felipe Héctor Gilberto Osvaldo Nicolás Justo Eladio Evaristo Tomás Isidro Teófilo Wilfredo Lázaro Rolando Esteban Mario Ignacio Benigno Faustino Clemente Narciso Amado Lino Digno Eusebio Cándido Abelardo Baldomero Calixto Dámaso Eligio Florentino Gumersindo Hilario Idelfonso Leoncio Marcelino Nemesio Onelio Primitivo Quintín Regino Silvio Telésforo Urbano Venancio'.split(' ');
  C.FEMALE = 'María Ana Carmen Josefa Rosa Teresa Margarita Lucía Dolores Mercedes Caridad Gladys Ofelia Hilda Zoila Esperanza Altagracia Aurora Blanca Cecilia Digna Eulalia Felicia Georgina Haydée Inés Juana Lidia Marta Nélida Olga Petra Rebeca Sara Tomasa Ursula Vilma Yolanda Zenaida Alicia Berta Candelaria Delia Edelmira Fe Graciela Isabel Leonor Magdalena Natividad Pura Reina Sofía Violeta Amparo Concepción Dulce Elena Francisca Lourdes Milagros Nieves Piedad Regla Silvia'.split(' ');
  C.SURNAMES = 'García Rodríguez Fernández Pérez González Martínez López Sánchez Díaz Hernández Gómez Álvarez Morales Cruz Reyes Ramos Castillo Mesa Torres Rojas Jiménez Suárez Herrera Medina Vega Rivero Peña Acosta Ortega Delgado Cabrera Valdés Molina Cardoso Expósito Quesada Betancourt Céspedes Tamayo Savón Mustelier Pompa Escalona Noa Frómeta Zaldívar Barreto Lorenzo Arencibia Menéndez Alonso Pino Estévez Cordero Bermúdez Ibarra Leyva Aguilera Vidal Zayas Carrazana Peláez Rosales Naranjo Montero Padrón Borges Duarte Guerra Soler Varona Bravo Hidalgo Sarduy Marrero Caballero Gil Ferrer Roque Salazar Varela Orozco Fonseca Linares Lage Mederos Oliva Pacheco Rivas Urrutia Zamora Batista Lara Mena Nápoles Oquendo Palma Quiñones Revilla Santana Tejeda Ulloa Villar Yero'.split(' ');
  C.SURN_CN = ['Chiong', 'Wong', 'Lam', 'Chang', 'Fong', 'Chang', 'Kuan'];            // Chinese-Cuban
  C.SURN_WI = ['Pierre', 'Joseph', 'Williams', 'Thompson', 'Clarke', 'Brown', 'Jean', 'Baptiste'];  // Haitian / British West Indian braceros
  C.SURN_GAL = ['Pardo', 'Seoane', 'Souto', 'Lage', 'Freire', 'Cancio', 'Vilariño', 'Rey'];         // Spanish (Galician) immigrants
  C.NICKS = ['El Gallego', 'El Negro', 'El Flaco', 'Cuco', 'Mongo', 'Pichi', 'Guajiro', 'El Chino', 'Tato', 'La China', 'El Mudo', 'Pepe Cojo', 'Machete', 'Quiquí', 'La Vieja', 'El Cojo', 'Papi', 'Manolo', 'Yeyo', 'Nené', 'Chicho', 'Beba', 'Cheo', 'Nana'];

  // ---------- planks (political platform). q: -1 / 0 / +1 ----------
  C.PLANKS = [
    { id: 'land', name: 'Reforma agraria', en: 'Land reform', opts: ['Keep the estates', 'Fair rents, distribute idle land', 'Break up the great estates'], deed: 'Distribute land to families' },
    { id: 'health', name: 'Salud y escuelas', en: 'Health & schools', opts: ['Leave to charity', 'Rural clinics and schools', 'Free universal care and education'], deed: 'Treat the sick, open a school' },
    { id: 'church', name: 'La Iglesia', en: 'The Church', opts: ['Defer to the Church', 'Neutral; protect worship', 'Secular state, curb the clergy'], deed: 'Protect or challenge the parish' },
    { id: 'property', name: 'Propiedad', en: 'Property & industry', opts: ['Protect all property', 'Regulated mixed economy', 'Nationalize key industries'], deed: 'Protect or seize property' },
    { id: 'democracy', name: 'Democracia', en: 'Democracy', opts: ['Rebel command rules', 'Elections after victory', 'Restore the 1940 Constitution'], deed: 'Hold open assemblies' },
    { id: 'justice', name: 'Justicia', en: 'Justice for the regime', opts: ['Amnesty for soldiers', 'Fair trials for crimes', 'Revolutionary tribunals'], deed: 'Hold trials, release prisoners' },
    { id: 'women', name: 'Las mujeres', en: "Women's equality", opts: ['Traditional roles', 'Vote, work, equal pay', 'Women fight and lead'], deed: 'Give women real roles' },
    { id: 'race', name: 'Igualdad racial', en: 'Racial equality', opts: ['Leave things as they are', 'End formal segregation', 'Full integration & promotion'], deed: 'Promote Afro-Cubans, open clubs' },
  ];
  C.PLANK_IDX = {}; C.PLANKS.forEach((p, i) => (C.PLANK_IDX[p.id] = i));

  // ---------- factions ----------
  // iss: mean issue stance per plank [land,health,church,property,democracy,justice,women,race]; sal: salience weights
  C.FACTIONS = {
    peasants:   { name: 'Campesinos', en: 'Peasants',  col: '#7a9a3a', stance: 8,   sd: 24, conv: [8, 38],  iss: [0.8, 0.7, -0.2, 0.2, 0.2, 0.1, -0.1, 0.1], sal: [3, 1.6, 0.5, 0.5, 0.7, 1, 0.5, 0.7] },
    workers:    { name: 'Obreros y sindicatos', en: 'Workers & unions', col: '#c07a2a', stance: 12, sd: 28, conv: [10, 45], iss: [0.5, 0.7, 0.0, 0.5, 0.3, 0.3, 0.1, 0.3], sal: [1, 2, 0.4, 1.5, 1.2, 1, 0.6, 1.3] },
    middle:     { name: 'Clase media', en: 'Middle class', col: '#b09a6a', stance: 0, sd: 26, conv: [8, 40], iss: [0.2, 0.5, -0.2, 0.0, 0.7, 0.0, 0.2, 0.1], sal: [0.6, 1.4, 0.8, 0.8, 2.2, 0.8, 0.8, 0.6] },
    students:   { name: 'Estudiantes', en: 'Students', col: '#b0407a', stance: 38,  sd: 26, conv: [15, 55], iss: [0.5, 0.7, 0.3, 0.4, 0.6, 0.3, 0.5, 0.4], sal: [1, 1.3, 1, 1, 2.2, 1, 1.3, 1.3] },
    elite:      { name: 'Élite urbana', en: 'Urban elite', col: '#6a6ab0', stance: -12, sd: 26, conv: [10, 45], iss: [-0.4, 0.1, -0.3, -0.7, 0.8, -0.2, 0.2, -0.1], sal: [1.2, 0.4, 0.5, 2.5, 2, 0.8, 0.5, 0.6] },
    landowners: { name: 'Terratenientes', en: 'Landowners', col: '#8a5a3a', stance: -52, sd: 18, conv: [25, 70], iss: [-0.9, -0.1, -0.5, -0.9, 0.2, -0.5, -0.4, -0.4], sal: [3, 0.3, 0.6, 2.5, 0.6, 1, 0.5, 0.6] },
    church:     { name: 'Iglesia', en: 'Church', col: '#e0d080', stance: -4, sd: 18, conv: [20, 60], iss: [0.1, 0.4, -0.9, -0.3, 0.4, -0.3, -0.3, 0.0], sal: [0.6, 1.2, 3, 0.8, 1, 1.2, 1.4, 0.7] },
    army:       { name: 'Ejército y policía', en: 'Army & police', col: '#4a6ac0', stance: -62, sd: 22, conv: [30, 75], iss: [-0.4, 0.0, -0.3, -0.4, -0.5, -0.8, -0.4, -0.2], sal: [0.6, 0.3, 0.4, 0.8, 1, 2.4, 0.5, 0.4] },
  };
  C.FACTION_KEYS = Object.keys(C.FACTIONS);

  // ---------- occupations ----------
  // bg = camouflage/background profile; fac = faction; rural/urban availability
  C.BG = { // affinity 0..1 for [jungle, rural, town, city]
    campesino: [0.92, 0.78, 0.35, 0.14], pescador: [0.6, 0.7, 0.4, 0.2], obrero: [0.3, 0.35, 0.62, 0.7],
    estudiante: [0.25, 0.3, 0.5, 0.72], profesional: [0.2, 0.3, 0.6, 0.66], servicio: [0.2, 0.3, 0.6, 0.78],
    militar: [0.5, 0.4, 0.4, 0.3], clero: [0.15, 0.4, 0.6, 0.6],
  };
  C.OCC = {
    // rural
    macheteo:   { n: 'Cortador de caña', fac: 'peasants', bg: 'campesino', cls: 0, where: 'rural', w: 12, sex: 'M' },
    colono:     { n: 'Colono (arrendatario)', fac: 'peasants', bg: 'campesino', cls: 1, where: 'rural', w: 8 },
    guajiro:    { n: 'Guajiro (campesino)', fac: 'peasants', bg: 'campesino', cls: 0, where: 'rural', w: 12 },
    carbonero:  { n: 'Carbonero', fac: 'peasants', bg: 'campesino', cls: 0, where: 'rural', w: 4, sex: 'M' },
    vaquero:    { n: 'Vaquero', fac: 'peasants', bg: 'campesino', cls: 0, where: 'rural', w: 3, sex: 'M' },
    pescador:   { n: 'Pescador', fac: 'workers', bg: 'pescador', cls: 0, where: 'coast', w: 14, sex: 'M' },
    mayordomo:  { n: 'Mayordomo (capataz)', fac: 'landowners', bg: 'militar', cls: 2, where: 'rural', w: 1, sex: 'M' },
    hacendado:  { n: 'Hacendado (terrateniente)', fac: 'landowners', bg: 'profesional', cls: 4, where: 'any', w: 0.6, sex: 'M' },
    // services
    bodeguero:  { n: 'Bodeguero', fac: 'middle', bg: 'servicio', cls: 2, where: 'any', w: 2.5 },
    dependiente:{ n: 'Dependiente', fac: 'middle', bg: 'servicio', cls: 2, where: 'urban', w: 6 },
    maestro:    { n: 'Maestro/a', fac: 'middle', bg: 'profesional', cls: 2, where: 'any', w: 1.4 },
    partera:    { n: 'Partera / curandera', fac: 'peasants', bg: 'campesino', cls: 0, where: 'rural', w: 0.8, sex: 'F' },
    medico:     { n: 'Médico', fac: 'middle', bg: 'profesional', cls: 3, where: 'urban', w: 0.8 },
    abogado:    { n: 'Abogado', fac: 'elite', bg: 'profesional', cls: 3, where: 'urban', w: 0.8, sex: 'M' },
    comerciante:{ n: 'Comerciante', fac: 'elite', bg: 'profesional', cls: 3, where: 'urban', w: 1.2 },
    banquero:   { n: 'Banquero', fac: 'elite', bg: 'profesional', cls: 4, where: 'city', w: 0.5, sex: 'M' },
    funcionario:{ n: 'Funcionario', fac: 'middle', bg: 'profesional', cls: 3, where: 'urban', w: 2 },
    periodista: { n: 'Periodista', fac: 'middle', bg: 'profesional', cls: 3, where: 'city', w: 0.6 },
    sacerdote:  { n: 'Sacerdote', fac: 'church', bg: 'clero', cls: 3, where: 'any', w: 0.6, sex: 'M' },
    monja:      { n: 'Monja', fac: 'church', bg: 'clero', cls: 2, where: 'urban', w: 0.5, sex: 'F' },
    // urban labour
    obrerocentral:{ n: 'Obrero del central', fac: 'workers', bg: 'obrero', cls: 1, where: 'town', w: 8, sex: 'M' },
    estibador:  { n: 'Estibador', fac: 'workers', bg: 'obrero', cls: 1, where: 'port', w: 5, sex: 'M' },
    tabaquero:  { n: 'Tabaquero', fac: 'workers', bg: 'obrero', cls: 1, where: 'city', w: 2 },
    carpintero: { n: 'Carpintero', fac: 'workers', bg: 'obrero', cls: 1, where: 'urban', w: 2, sex: 'M' },
    sastre:     { n: 'Sastre', fac: 'workers', bg: 'obrero', cls: 1, where: 'urban', w: 1.5 },
    barbero:    { n: 'Barbero', fac: 'workers', bg: 'obrero', cls: 1, where: 'urban', w: 1.2, sex: 'M' },
    chofer:     { n: 'Chofer', fac: 'workers', bg: 'obrero', cls: 1, where: 'urban', w: 2, sex: 'M' },
    mecanico:   { n: 'Mecánico', fac: 'workers', bg: 'obrero', cls: 1, where: 'urban', w: 1.5, sex: 'M' },
    ferroviario:{ n: 'Ferroviario', fac: 'workers', bg: 'obrero', cls: 1, where: 'town', w: 1.2, sex: 'M' },
    costurera:  { n: 'Costurera', fac: 'workers', bg: 'obrero', cls: 1, where: 'urban', w: 3, sex: 'F' },
    lavandera:  { n: 'Lavandera', fac: 'workers', bg: 'servicio', cls: 0, where: 'any', w: 2, sex: 'F' },
    domestica:  { n: 'Empleada doméstica', fac: 'workers', bg: 'servicio', cls: 0, where: 'urban', w: 5, sex: 'F' },
    sindicalista:{ n: 'Dirigente sindical', fac: 'workers', bg: 'obrero', cls: 2, where: 'urban', w: 0.8 },
    obrerofab:  { n: 'Obrero de fábrica', fac: 'workers', bg: 'obrero', cls: 1, where: 'city', w: 4 },
    camarero:   { n: 'Camarero / hotel', fac: 'workers', bg: 'servicio', cls: 1, where: 'city', w: 2 },
    musico:     { n: 'Músico', fac: 'workers', bg: 'servicio', cls: 1, where: 'city', w: 1 },
    casino:     { n: 'Crupier de casino', fac: 'middle', bg: 'servicio', cls: 2, where: 'capital', w: 1.5 },
    locutor:    { n: 'Locutor de radio', fac: 'middle', bg: 'profesional', cls: 3, where: 'capital', w: 0.4 },
    // students and the young
    estudiante: { n: 'Estudiante', fac: 'students', bg: 'estudiante', cls: 2, where: 'any', w: 0, age: [14, 28] },
    ama:        { n: 'Ama de casa', fac: 'middle', bg: 'servicio', cls: 1, where: 'any', w: 0, sex: 'F' },
    nino:       { n: 'Niño/a', fac: 'peasants', bg: 'campesino', cls: 0, where: 'any', w: 0, age: [0, 13] },
    jubilado:   { n: 'Anciano/a', fac: 'peasants', bg: 'campesino', cls: 0, where: 'any', w: 0, age: [66, 99] },
    // armed state
    soldado:    { n: 'Soldado', fac: 'army', bg: 'militar', cls: 1, where: 'any', w: 0, sex: 'M' },
    guardia:    { n: 'Guardia rural', fac: 'army', bg: 'militar', cls: 1, where: 'rural', w: 0, sex: 'M' },
    policia:    { n: 'Policía', fac: 'army', bg: 'militar', cls: 1, where: 'urban', w: 0, sex: 'M' },
    oficial:    { n: 'Oficial', fac: 'army', bg: 'militar', cls: 3, where: 'any', w: 0, sex: 'M' },
    sim:        { n: 'Agente del SIM', fac: 'army', bg: 'militar', cls: 2, where: 'urban', w: 0, sex: 'M' },
    // rebels
    rebelde:    { n: 'Rebelde', fac: 'peasants', bg: 'campesino', cls: 0, where: 'any', w: 0 },
  };
  // occupation weights by settlement type (pick from where-tags)
  C.occPool = function (stype, sex, age) {
    const out = [];
    const rural = stype === 'village' || stype === 'sierra' || stype === 'fishing' || stype === 'offmap';
    const coast = stype === 'fishing';
    const urban = !rural;
    const port = stype === 'town' || stype === 'city' || stype === 'capital';
    for (const k in C.OCC) {
      const o = C.OCC[k]; if (!o.w) continue;
      if (o.sex && o.sex !== sex) continue;
      let ok = false;
      switch (o.where) {
        case 'any': ok = true; break;
        case 'rural': ok = rural; break;
        case 'coast': ok = coast || stype === 'town' && k === 'pescador'; break;
        case 'urban': ok = urban; break;
        case 'town': ok = stype === 'town'; break;
        case 'city': ok = stype === 'city' || stype === 'capital'; break;
        case 'capital': ok = stype === 'capital'; break;
        case 'port': ok = port; break;
      }
      if (!ok) continue;
      let w = o.w;
      if (stype === 'fishing' && k === 'pescador') w = 40;
      if (stype === 'sierra' && (k === 'carbonero' || k === 'guajiro')) w *= 3;
      if (sex === 'F' && !o.sex) w *= 0.25;   // women's recorded paid work in 1950s Cuba was far lower
      out.push([k, w]);
    }
    return out;
  };

  // ---------- traits ----------
  C.TRAITS = {
    idealist:    { n: 'Idealista', d: 'Hope and dignity move them more; conviction grows fast' },
    opportunist: { n: 'Oportunista', d: 'Drifts toward whoever seems to be winning' },
    devout:      { n: 'Devoto', d: 'Cares deeply about the Church' },
    hothead:     { n: 'Impulsivo', d: 'Stress and anger spike; may act without orders' },
    loyalist:    { n: 'Leal al régimen', d: 'Resists persuasion; conviction hard to shake' },
    cautious:    { n: 'Cauteloso', d: 'Hides opinions; slow to commit' },
    brave:       { n: 'Valiente', d: 'Resists fear and stress' },
    gossip:      { n: 'Chismoso', d: 'News about them and by them travels fast' },
    generous:    { n: 'Generoso', d: 'Shares food readily with those they trust' },
    greedy:      { n: 'Codicioso', d: 'Sells to the highest bidder; can be bribed' },
    drinker:     { n: 'Bebedor', d: 'Careless on watch; talks too much' },
    veteran:     { n: 'Veterano', d: 'Fought in an earlier war or uprising' },
    stoic:       { n: 'Estoico', d: 'Keeps a steady face under pressure' },
    kind:        { n: 'Bondadoso', d: 'Kindness shown to them is returned' },
  };
  C.TRAIT_KEYS = Object.keys(C.TRAITS);

  // ---------- weapons ----------
  // dmg per bullet, rof shots/s, spd px/s, rng px, spread deg, mag, pellets, rel = reload s
  // ---------- weapons ----------
  // Period arms of the Cuban war (1956–59): what rebels carried, captured, or bought, and what Batista's army fielded.
  //   dmg  damage per projectile      rof  rounds/second       spd  projectile speed (px/s)     rng  effective range (px)
  //   spr  spread in degrees          mag  rounds per magazine rel  reload seconds               wt   carried weight (see inventory.js)
  //   snd  loudness class 0–3         melee/launcher/crew mark special handling in combat.js and orders.js
  C.WEAPONS = {
    pistol:  { n: 'Pistola .45', dmg: 30, rof: 2.2, spd: 780, rng: 190, spr: 4.5, mag: 7, rel: 1.8, wt: 1.2, conceal: true, snd: 1 },
    revolver:{ n: 'Revólver', dmg: 30, rof: 1.6, spd: 740, rng: 180, spr: 4.0, mag: 6, rel: 2.2, wt: 1.0, conceal: true, snd: 1 },
    rifle:   { n: 'Fusil Springfield', dmg: 58, rof: 0.75, spd: 1250, rng: 560, spr: 1.6, mag: 5, rel: 2.6, wt: 4.0, snd: 2 },
    mauser:  { n: 'Mauser 7 mm', dmg: 56, rof: 0.7, spd: 1230, rng: 550, spr: 1.8, mag: 5, rel: 2.7, wt: 4.0, snd: 2 },
    garand:  { n: 'Garand M1', dmg: 52, rof: 1.5, spd: 1200, rng: 520, spr: 2.2, mag: 8, rel: 2.4, wt: 4.5, snd: 2 },
    carbine: { n: 'Carabina M1', dmg: 36, rof: 2.0, spd: 1050, rng: 400, spr: 2.8, mag: 15, rel: 2.2, wt: 2.6, snd: 2 },
    scoped:  { n: 'Fusil con mira', dmg: 70, rof: 0.45, spd: 1350, rng: 760, spr: 0.7, mag: 5, rel: 3.0, wt: 4.5, snd: 2 },
    thompson:{ n: 'Thompson', dmg: 24, rof: 8, spd: 800, rng: 280, spr: 7.5, mag: 30, rel: 2.6, wt: 4.5, snd: 2 },
    bar:     { n: 'Fusil automático Browning (BAR)', dmg: 55, rof: 4.5, spd: 1250, rng: 520, spr: 4.0, mag: 20, rel: 3.6, wt: 8.0, snd: 3 },
    mg:      { n: 'Ametralladora', dmg: 40, rof: 9, spd: 1250, rng: 640, spr: 4.5, mag: 100, rel: 5.0, wt: 11.0, snd: 3 },
    shotgun: { n: 'Escopeta', dmg: 20, rof: 0.9, spd: 600, rng: 150, spr: 11, mag: 2, rel: 2.5, wt: 3.5, pellets: 7, snd: 2 },
    machete: { n: 'Machete', dmg: 40, rof: 1.4, spd: 0, rng: 18, spr: 0, mag: 1, rel: 0, wt: 1.0, melee: true, snd: 0 },
    // Rocket launcher (2.36-inch "bazooka"): a slow visible rocket, big blast, deadly to vehicles, dangerous backblast.
    bazooka: { n: 'Bazuca', dmg: 0, rof: 0.22, spd: 380, rng: 380, spr: 2.2, mag: 1, rel: 4.5, wt: 7.0, launcher: true, snd: 3 },
    // 60 mm mortar: crew-served. Cannot be fired directly; it is fired by the 'mortar' order (orders.js) and needs shells.
    mortar:  { n: 'Mortero 60 mm', dmg: 0, rof: 0.33, spd: 0, rng: 640, spr: 0, mag: 1, rel: 0, wt: 12.0, crew: true, snd: 3 },
  };
  C.HEAVY = ['bar', 'mg', 'bazooka', 'mortar'];     // weapons that live in the heavy-weapons armory (g.heavy) rather than "spare rifles"

  C.EXPLOSIVES = {
    grenade:  { n: 'Granada', fuse: 2.1, rad: 58, dmg: 150, frags: 14 },
    molotov:  { n: 'Molotov', fuse: 0.01, rad: 34, dmg: 40, fire: true, frags: 0 },
    dynamite: { n: 'Dinamita', fuse: 6, rad: 96, dmg: 220, frags: 10 },
    mortar:   { n: 'Mortero', fuse: 0.01, rad: 70, dmg: 170, frags: 16 },
    rocket:   { n: 'Cohete de bazuca', fuse: 0.01, rad: 62, dmg: 210, frags: 10, vehMult: 3 },
    bomb:     { n: 'Bomba aérea', fuse: 0.01, rad: 100, dmg: 260, frags: 18 },
  };

  // ---------- vehicles ----------
  C.VEHICLES = {
    jeep:    { n: 'Jeep Willys', w: 22, h: 12, spd: 170, cap: 4, tank: 38, burn: 0.55, col: [96, 110, 70], hp: 140, wheels: 4 },
    truck:   { n: 'Camión', w: 34, h: 15, spd: 120, cap: 8, tank: 90, burn: 0.9, col: [170, 120, 60], hp: 220, wheels: 4 },
    car:     { n: 'Auto (Chevrolet \'55)', w: 28, h: 13, spd: 210, cap: 4, tank: 55, burn: 0.7, col: [190, 70, 70], hp: 130, wheels: 4 },
    bus:     { n: 'Guagua', w: 42, h: 15, spd: 115, cap: 14, tank: 110, burn: 1.1, col: [200, 160, 50], hp: 260, wheels: 4 },
    armyjeep:{ n: 'Jeep militar', w: 22, h: 12, spd: 175, cap: 4, tank: 40, burn: 0.55, col: [70, 80, 130], hp: 160, wheels: 4, army: true },
    armytruck:{ n: 'Camión militar', w: 36, h: 15, spd: 125, cap: 10, tank: 95, burn: 0.9, col: [60, 90, 130], hp: 260, wheels: 4, army: true },
    oxcart:  { n: 'Carreta de bueyes', w: 24, h: 14, spd: 42, cap: 3, tank: 0, burn: 0, col: [150, 110, 70], hp: 90, wheels: 2 },
    yacht:   { n: 'Granma', w: 64, h: 22, spd: 48, cap: 99, tank: 0, burn: 0, col: [200, 205, 210], hp: 400, wheels: 0, water: true, deck: true },
    boat:    { n: 'Lancha de pesca', w: 36, h: 14, spd: 78, cap: 6, tank: 40, burn: 0.35, col: [90, 150, 180], hp: 120, wheels: 0, water: true },
  };

  // ---------- buildings (w,h in tiles) ----------
  C.BLD = {
    bohio:    { n: 'Bohío', w: 3, h: 2, fill: [150, 120, 70], roof: [196, 170, 90], tag: 'home' },
    casa:     { n: 'Casa', w: 3, h: 3, fill: [214, 190, 150], roof: [176, 84, 60], tag: 'home' },
    casona:   { n: 'Casa de hacendado', w: 5, h: 4, fill: [236, 222, 190], roof: [150, 70, 50], tag: 'home' },
    cuarteria:{ n: 'Cuartería', w: 6, h: 3, fill: [190, 170, 140], roof: [130, 110, 100], tag: 'home' },
    edificio: { n: 'Edificio', w: 5, h: 4, fill: [220, 210, 190], roof: [150, 150, 150], tag: 'home' },
    bodega:   { n: 'Bodega', w: 3, h: 2, fill: [220, 200, 140], roof: [160, 70, 50], tag: 'shop' },
    tienda:   { n: 'Tienda', w: 4, h: 3, fill: [230, 210, 170], roof: [150, 90, 70], tag: 'shop' },
    cafe:     { n: 'Café', w: 3, h: 2, fill: [200, 160, 120], roof: [140, 70, 60], tag: 'shop' },
    barberia: { n: 'Barbería', w: 2, h: 2, fill: [230, 200, 200], roof: [140, 80, 80], tag: 'shop' },
    farmacia: { n: 'Farmacia', w: 3, h: 2, fill: [210, 235, 215], roof: [90, 140, 100], tag: 'shop' },
    gasolinera:{ n: 'Gasolinera', w: 4, h: 3, fill: [230, 230, 235], roof: [200, 50, 50], tag: 'fuel' },
    iglesia:  { n: 'Iglesia', w: 5, h: 5, fill: [238, 232, 214], roof: [150, 120, 90], tag: 'church' },
    capilla:  { n: 'Capilla', w: 3, h: 3, fill: [238, 232, 214], roof: [150, 120, 90], tag: 'church' },
    catedral: { n: 'Catedral', w: 8, h: 6, fill: [232, 224, 200], roof: [140, 110, 90], tag: 'church' },
    escuela:  { n: 'Escuela', w: 5, h: 3, fill: [240, 230, 200], roof: [90, 130, 170], tag: 'school' },
    univ:     { n: 'Universidad', w: 10, h: 5, fill: [235, 232, 222], roof: [120, 120, 130], tag: 'univ' },
    hospital: { n: 'Hospital', w: 6, h: 4, fill: [240, 240, 240], roof: [200, 80, 80], tag: 'clinic' },
    clinica:  { n: 'Clínica', w: 3, h: 2, fill: [240, 240, 240], roof: [200, 120, 120], tag: 'clinic' },
    cuartel:  { n: 'Cuartel', w: 8, h: 4, fill: [160, 170, 200], roof: [70, 85, 130], tag: 'army' },
    posta:    { n: 'Puesto de la Guardia Rural', w: 4, h: 3, fill: [170, 180, 205], roof: [80, 95, 140], tag: 'army' },
    policia:  { n: 'Estación de policía', w: 5, h: 3, fill: [170, 180, 205], roof: [80, 95, 140], tag: 'army' },
    sim:      { n: 'Cuartel del SIM', w: 5, h: 3, fill: [150, 150, 180], roof: [60, 60, 100], tag: 'army' },
    ayuntamiento:{ n: 'Ayuntamiento', w: 6, h: 4, fill: [236, 226, 200], roof: [130, 100, 80], tag: 'gov' },
    palacio:  { n: 'Palacio Presidencial', w: 9, h: 6, fill: [240, 232, 210], roof: [110, 110, 140], tag: 'gov' },
    capitolio:{ n: 'El Capitolio', w: 9, h: 6, fill: [238, 236, 230], roof: [150, 150, 150], tag: 'gov' },
    central:  { n: 'Central azucarero (fábrica)', w: 9, h: 6, fill: [180, 160, 140], roof: [100, 90, 90], tag: 'factory' },
    fabrica:  { n: 'Fábrica', w: 7, h: 5, fill: [180, 175, 170], roof: [100, 100, 105], tag: 'factory' },
    ron:      { n: 'Fábrica de ron', w: 7, h: 5, fill: [190, 150, 120], roof: [110, 70, 60], tag: 'factory' },
    almacen:  { n: 'Almacén', w: 5, h: 3, fill: [190, 180, 160], roof: [110, 100, 90], tag: 'store' },
    sindicato:{ n: 'Sindicato', w: 4, h: 3, fill: [230, 190, 160], roof: [170, 70, 50], tag: 'union' },
    cine:     { n: 'Cine', w: 4, h: 3, fill: [220, 200, 220], roof: [130, 90, 140], tag: 'leisure' },
    teatro:   { n: 'Teatro', w: 6, h: 4, fill: [230, 210, 200], roof: [140, 90, 90], tag: 'leisure' },
    hotel:    { n: 'Hotel', w: 7, h: 5, fill: [236, 232, 214], roof: [130, 150, 160], tag: 'hotel' },
    casino:   { n: 'Casino', w: 6, h: 4, fill: [240, 200, 210], roof: [160, 60, 100], tag: 'casino' },
    banco:    { n: 'Banco', w: 5, h: 4, fill: [226, 226, 214], roof: [120, 130, 120], tag: 'bank' },
    radio:    { n: 'Estación de radio', w: 4, h: 3, fill: [220, 220, 230], roof: [90, 90, 160], tag: 'radio' },
    cementerio:{ n: 'Cementerio', w: 6, h: 4, fill: [200, 205, 195], roof: [150, 150, 150], tag: 'cemetery', open: true },
    muelle:   { n: 'Muelle', w: 8, h: 2, fill: [150, 120, 90], roof: [150, 120, 90], tag: 'pier', open: true },
    secadero: { n: 'Secadero de pescado', w: 4, h: 2, fill: [190, 160, 120], roof: [190, 160, 120], tag: 'fishing' },
    cooperativa:{ n: 'Cooperativa de pescadores', w: 4, h: 3, fill: [170, 200, 210], roof: [90, 130, 150], tag: 'fishing' },
    // camp (Sierra)
    tienda_c: { n: 'Tienda de campaña', w: 2, h: 2, fill: [110, 120, 80], roof: [90, 100, 64], tag: 'camp' },
    cocina:   { n: 'Cocina de campamento', w: 3, h: 2, fill: [140, 110, 80], roof: [110, 90, 60], tag: 'camp' },
    enfermeria:{ n: 'Enfermería', w: 3, h: 2, fill: [220, 220, 210], roof: [170, 70, 70], tag: 'camp' },
    polvorin: { n: 'Polvorín (munición)', w: 2, h: 2, fill: [90, 90, 90], roof: [60, 60, 60], tag: 'camp' },
    taller:   { n: 'Taller', w: 3, h: 2, fill: [150, 130, 100], roof: [100, 90, 70], tag: 'camp' },
    radiocamp:{ n: 'Radio Rebelde', w: 2, h: 2, fill: [150, 150, 170], roof: [90, 90, 120], tag: 'camp' },
    escuelacamp:{ n: 'Escuela rebelde', w: 3, h: 2, fill: [200, 190, 150], roof: [120, 110, 80], tag: 'camp' },
    imprenta: { n: 'Imprenta', w: 2, h: 2, fill: [200, 190, 190], roof: [120, 100, 100], tag: 'camp' },
    pad:      { n: 'Solar libre', w: 2, h: 2, fill: [140, 130, 100], roof: [140, 130, 100], tag: 'pad', open: true },
    puente:   { n: 'Puente', w: 4, h: 2, fill: [170, 140, 100], roof: [170, 140, 100], tag: 'bridge', open: true },
    deposito: { n: 'Depósito de gasolina', w: 2, h: 2, fill: [180, 60, 50], roof: [140, 40, 40], tag: 'fuelstore' },
    torre:    { n: 'Torre de radio', w: 1, h: 1, fill: [90, 90, 90], roof: [90, 90, 90], tag: 'tower' },
  };

  // ---------- settlements ----------
  // pos = [lon,lat] used on the island map. pop = size of simulated sample (1 Cubean ~ 100 real people)
  C.SETTLEMENTS = {
    alegria:    { id: 'alegria', name: 'Alegría de Pío', type: 'cane', pop: 0, pos: [-77.62, 19.97], region: 'Oriente', bias: 0, blurb: 'Cane fields near the landing. The army is waiting.' },
    bay:        { id: 'bay', name: 'The coast of Oriente', type: 'coast', pop: 0, pos: [-77.75, 19.85], region: 'Oriente', bias: 0, blurb: 'The sea approach to the landing.' },
    sierra:     { id: 'sierra', name: 'Sierra Maestra', type: 'sierra', pop: 110, pos: [-76.95, 19.98], region: 'Oriente', bias: 18, blurb: 'Jungle ridges, charcoal-burners, rivers. The only place the army cannot easily reach.' },
    palmarito:  { id: 'palmarito', name: 'Palmarito', type: 'village', pop: 270, pos: [-77.2, 20.15], region: 'Oriente', bias: 6, blurb: 'A foothill batey of cane cutters and tenant farmers (fictional).' },
    cayo:       { id: 'cayo', name: 'Cayo Piedra', type: 'fishing', pop: 150, pos: [-77.35, 19.92], region: 'Oriente', bias: 2, blurb: 'A fishing village on the southern coast (fictional).' },
    manzanillo: { id: 'manzanillo', name: 'Manzanillo', type: 'town', pop: 560, pos: [-77.12, 20.34], region: 'Oriente', bias: 4, blurb: 'Sugar port on the Gulf of Guacanayabo.' },
    bayamo:     { id: 'bayamo', name: 'Bayamo', type: 'town', pop: 500, pos: [-76.64, 20.38], region: 'Oriente', bias: -4, blurb: 'Garrison town of the Cauto plain.' },
    santiago:   { id: 'santiago', name: 'Santiago de Cuba', type: 'city', pop: 780, pos: [-75.82, 20.02], region: 'Oriente', bias: 12, blurb: 'Cuba\'s rebel city: students, the underground, the Moncada barracks.' },
    habana:     { id: 'habana', name: 'La Habana', type: 'capital', pop: 900, pos: [-82.37, 23.13], region: 'La Habana', bias: 0, blurb: 'Capital of Batista\'s Cuba: casinos, banks, the Palace, and the money.' },
    // off-map origins: exist as places for birthplaces & relatives; their people are 'away'
    biran:      { id: 'biran', name: 'Birán', type: 'offmap', pop: 0, pos: [-75.66, 20.62], region: 'Oriente' },
    rosario:    { id: 'rosario', name: 'Rosario (Argentina)', type: 'offmap', pop: 0, pos: null, region: 'Exterior' },
    artemisa:   { id: 'artemisa', name: 'Artemisa', type: 'offmap', pop: 0, pos: [-82.76, 22.81], region: 'La Habana' },
    cardenas:   { id: 'cardenas', name: 'Cárdenas', type: 'offmap', pop: 0, pos: [-81.2, 23.04], region: 'Matanzas' },
    encrucijada:{ id: 'encrucijada', name: 'Encrucijada', type: 'offmap', pop: 0, pos: [-79.87, 22.61], region: 'Las Villas' },
    cruces:     { id: 'cruces', name: 'Cruces', type: 'offmap', pop: 0, pos: [-80.27, 22.34], region: 'Las Villas' },
    yara:       { id: 'yara', name: 'Yara', type: 'offmap', pop: 0, pos: [-76.7, 20.27], region: 'Oriente' },
    medialuna:  { id: 'medialuna', name: 'Media Luna', type: 'offmap', pop: 0, pos: [-77.4, 20.15], region: 'Oriente' },
    banes:      { id: 'banes', name: 'Banes', type: 'offmap', pop: 0, pos: [-75.72, 20.96], region: 'Oriente' },
    exterior:   { id: 'exterior', name: 'Exilio (Miami / México)', type: 'offmap', pop: 0, pos: null, region: 'Exterior' },
    galicia:    { id: 'galicia', name: 'Galicia (España)', type: 'offmap', pop: 0, pos: null, region: 'Exterior' },
  };
  C.PLAYABLE = ['sierra', 'palmarito', 'cayo', 'manzanillo', 'bayamo', 'santiago', 'habana'];
  // travel edges: [a,b,footDays,vehicleHours]
  C.EDGES = [
    ['sierra', 'palmarito', 0.6, 2], ['sierra', 'cayo', 1.0, 3], ['sierra', 'santiago', 4, 7],
    ['palmarito', 'manzanillo', 1.5, 3], ['palmarito', 'bayamo', 2.5, 5], ['cayo', 'manzanillo', 2, 4],
    ['manzanillo', 'bayamo', 1.5, 2], ['bayamo', 'santiago', 5, 5],
    ['santiago', 'habana', 28, 15], ['bayamo', 'habana', 24, 12], ['manzanillo', 'habana', 25, 13],
  ];
  // schematic coastline [lon,lat] for the island map
  C.COAST = [[-84.95, 21.85], [-84.35, 22.2], [-83.65, 22.75], [-83.0, 22.97], [-82.37, 23.2], [-81.7, 23.1], [-81.1, 23.15], [-80.4, 23.05], [-79.5, 22.7], [-78.7, 22.45], [-77.9, 22.2], [-77.2, 21.7], [-76.6, 21.25], [-75.9, 21.1], [-75.7, 21.0], [-75.0, 20.75], [-74.2, 20.28], [-74.2, 20.05], [-74.9, 19.95], [-75.5, 19.9], [-76.2, 19.95], [-76.9, 19.9], [-77.4, 19.85], [-77.72, 19.85], [-77.6, 20.2], [-77.3, 20.6], [-77.5, 20.95], [-78.2, 21.4], [-78.4, 21.6], [-79.5, 21.65], [-80.4, 22.05], [-81.1, 22.05], [-81.8, 22.3], [-82.5, 22.7], [-83.5, 22.25], [-84.4, 21.9]];

  // ---------- historical roster ----------
  // side: 'rebel' | 'llano' | 'peasant' | 'church' | 'union' | 'student' | 'regime' | 'elite' ; at = settlement id the person starts in
  // tag = nametag text override. fam = authored relatives (others are generated). Every authored character gets generated kin as well.
  C.ROSTER = [
    // --- the Granma party (in the Alegría de Pío scene at start) ---
    { id: 'raul', first: 'Raúl', last: 'Castro', last2: 'Ruz', sex: 'M', yob: 1931, birth: 'biran', at: 'party', side: 'rebel', occ: 'rebelde', role: 'Capitán', v: 'ok', traits: ['idealist', 'brave', 'cautious'], exp: 18, st: 96, cv: 95, hair: 'blk',
      fam: [['sibling', 'Ramón', 'Castro', 1924, 'M', 'alive', 'biran'], ['sibling', 'Angelita', 'Castro', 1923, 'F', 'alive', 'biran'], ['mother', 'Lina', 'Ruz', 1903, 'F', 'alive', 'biran'], ['father', 'Ángel', 'Castro', 1875, 'M', 'dead', 'biran']], note: 'Younger brother of the commander. Organizer, disciplinarian, pragmatic.' },
    { id: 'che', first: 'Ernesto', last: 'Guevara', last2: 'de la Serna', tag: 'Che Guevara', sex: 'M', yob: 1928, birth: 'rosario', at: 'party', side: 'rebel', occ: 'rebelde', role: 'Médico del grupo', v: 'ok', traits: ['idealist', 'brave', 'stoic'], exp: 8, st: 100, cv: 100, hair: 'brn', beard: false, hat: 'beret',
      fam: [['spouse', 'Hilda', 'Gadea', 1921, 'F', 'away', 'exterior'], ['child', 'Hilda Beatriz', 'Guevara', 1956, 'F', 'away', 'exterior'], ['father', 'Ernesto', 'Guevara', 1900, 'M', 'alive', 'rosario'], ['mother', 'Celia', 'de la Serna', 1908, 'F', 'alive', 'rosario']], note: 'Argentine doctor. Treats the wounded; hard on discipline and on himself.' },
    { id: 'camilo', first: 'Camilo', last: 'Cienfuegos', last2: 'Gorriarán', sex: 'M', yob: 1932, birth: 'habana', at: 'party', side: 'rebel', occ: 'rebelde', role: 'Soldado', v: 'ok', traits: ['brave', 'generous', 'idealist'], exp: 4, st: 90, cv: 85, hair: 'blk', beard: true, hat: 'cowboy',
      fam: [['father', 'Ramón', 'Cienfuegos', 1900, 'M', 'alive', 'habana'], ['mother', 'Emilia', 'Gorriarán', 1905, 'F', 'alive', 'habana'], ['sibling', 'Osmany', 'Cienfuegos', 1931, 'M', 'alive', 'habana']], note: 'A Havana tailor and sketch artist. Fearless, funny, loved by the men.' },
    { id: 'almeida', first: 'Juan', last: 'Almeida', last2: 'Bosque', sex: 'M', yob: 1927, birth: 'habana', at: 'party', side: 'rebel', occ: 'rebelde', role: 'Capitán', v: 'ok', traits: ['brave', 'stoic', 'veteran'], exp: 20, eth: 'negra', st: 94, cv: 95, hair: 'blk',
      fam: [], note: 'Afro-Cuban mason from Havana; a Moncada veteran. Steady under fire.' },
    { id: 'ramiro', first: 'Ramiro', last: 'Valdés', last2: 'Menéndez', sex: 'M', yob: 1932, birth: 'artemisa', at: 'party', side: 'rebel', occ: 'rebelde', role: 'Capitán', v: 'check', traits: ['cautious', 'veteran', 'brave'], exp: 20, st: 92, cv: 90, hair: 'blk', fam: [], note: 'Moncada veteran. Methodical, security-minded.' },
    { id: 'ameijeiras', first: 'Efigenio', last: 'Ameijeiras', last2: 'Delgado', sex: 'M', yob: 1931, birth: 'habana', at: 'party', side: 'rebel', occ: 'rebelde', role: 'Teniente', v: 'assumed', traits: ['brave', 'hothead'], exp: 5, st: 88, cv: 80, hair: 'brn', fam: [], note: 'Havana-born expeditionary.' },
    { id: 'universo', first: 'Universo', last: 'Sánchez', last2: '', sex: 'M', yob: 1929, birth: 'habana', at: 'party', side: 'rebel', occ: 'rebelde', role: 'Soldado', v: 'assumed', traits: ['generous', 'brave'], exp: 2, st: 85, cv: 78, hair: 'blk', fam: [], note: 'Expeditionary; his birthplace is unverified here.' },
    { id: 'faustino', first: 'Faustino', last: 'Pérez', last2: 'Hernández', sex: 'M', yob: 1920, birth: 'habana', at: 'party', side: 'rebel', occ: 'medico', role: 'Médico', v: 'assumed', traits: ['idealist', 'cautious', 'kind'], exp: 2, st: 88, cv: 82, hair: 'brn', fam: [], note: 'Physician who later runs the urban underground.' },
    { id: 'ciro', first: 'Ciro', last: 'Redondo', last2: 'García', sex: 'M', yob: 1931, birth: 'artemisa', at: 'party', side: 'rebel', occ: 'rebelde', role: 'Soldado', v: 'assumed', traits: ['brave', 'idealist'], exp: 3, st: 86, cv: 80, hair: 'blk', fam: [], note: 'Expeditionary.' },
    { id: 'lalo', first: 'Lalo', last: 'Sardiñas', last2: 'Montoto', sex: 'M', yob: 1927, birth: 'habana', at: 'party', side: 'rebel', occ: 'rebelde', role: 'Soldado', v: 'assumed', traits: ['brave', 'generous'], exp: 3, eth: 'negra', st: 84, cv: 78, hair: 'blk', fam: [], note: 'Afro-Cuban expeditionary.' },
    { id: 'marquez', first: 'Juan Manuel', last: 'Márquez', last2: '', sex: 'M', yob: 1915, birth: 'habana', at: 'party', side: 'rebel', occ: 'abogado', role: 'Segundo jefe', v: 'assumed', traits: ['idealist', 'stoic'], exp: 1, st: 90, cv: 85, hair: 'gry', fam: [], note: 'Lawyer and second-in-command of the expedition; in history he was captured after the ambush.' },
    // --- Sierra peasants ---
    { id: 'crescencio', first: 'Crescencio', last: 'Pérez', last2: 'Montano', sex: 'M', yob: 1895, birth: 'medialuna', at: 'sierra', side: 'peasant', occ: 'guajiro', role: 'Líder campesino', v: 'ok', traits: ['generous', 'brave', 'stoic'], exp: 6, st: 40, cv: 60, hair: 'gry', hat: 'straw',
      fam: [['child', 'Ignacio', 'Pérez', 1925, 'M', 'alive', 'sierra'], ['child', 'Ernesto', 'Pérez', 1928, 'M', 'alive', 'sierra']], note: 'Peasant leader of the western Sierra; knows every trail. Born at Purial de Vicana, Media Luna.' },
    { id: 'guillermo', first: 'Guillermo', last: 'García', last2: 'Frías', sex: 'M', yob: 1928, birth: 'sierra', at: 'sierra', side: 'peasant', occ: 'guajiro', role: 'Guía campesino', v: 'assumed', traits: ['brave', 'stoic'], exp: 4, st: 55, cv: 55, hair: 'blk', hat: 'straw', fam: [], note: 'Peasant guide who later commands rebel columns.' },
    { id: 'eutimio', first: 'Eutimio', last: 'Guerra', last2: '', sex: 'M', yob: 1915, birth: 'sierra', at: 'sierra', side: 'peasant', occ: 'guajiro', role: 'Guía', v: 'ok', traits: ['greedy', 'cautious'], exp: 0, st: 30, cv: 30, hair: 'blk', hat: 'straw', informant: true, trueStance: -60, fam: [['father', 'Anselmo', 'Guerra', 1890, 'M', 'alive', 'sierra']], note: 'A guide who offers his services. History says he sold you out for money.' },
    { id: 'anselmo', first: 'Anselmo', last: 'Rivero', last2: 'Peña', tag: 'Don Anselmo', sex: 'M', yob: 1884, birth: 'sierra', at: 'sierra', side: 'peasant', occ: 'jubilado', role: 'El Viejo (guía)', v: 'fiction', traits: ['veteran', 'kind', 'stoic', 'gossip'], exp: 30, st: 60, cv: 70, hair: 'wht', hat: 'straw', beard: true, fam: [['child', 'Rosalía', 'Rivero', 1930, 'F', 'alive', 'palmarito'], ['grandchild', 'Dalia', 'Rivero', 1941, 'F', 'alive', 'palmarito']], note: 'A veteran of the 1895 war, now an old charcoal-burner. Knows the mountain, the families and the gossip. (Fictional)' },
    { id: 'tete', first: 'Delsa Esther', last: 'Puebla', last2: 'Viltres', tag: 'Teté Puebla', sex: 'F', yob: 1940, birth: 'yara', at: 'sierra', side: 'peasant', occ: 'guajiro', role: 'Joven campesina', v: 'check', traits: ['brave', 'idealist', 'stoic'], exp: 0, st: 52, cv: 50, hair: 'blk', fam: [], note: 'A teenage peasant girl from the Yara region. In history she commanded the Mariana Grajales platoon.' },
    // --- Llano (urban underground) and civil allies ---
    { id: 'celia', first: 'Celia', last: 'Sánchez', last2: 'Manduley', sex: 'F', yob: 1920, birth: 'medialuna', at: 'manzanillo', side: 'llano', occ: 'ama', role: 'Organizadora del apoyo', v: 'ok', traits: ['idealist', 'generous', 'kind'], exp: 0, st: 85, cv: 85, hair: 'brn', covert: true,
      fam: [['father', 'Manuel', 'Sánchez', 1885, 'M', 'alive', 'manzanillo'], ['sibling', 'Acacia', 'Sánchez', 1918, 'F', 'alive', 'manzanillo'], ['sibling', 'Griselda', 'Sánchez', 1925, 'F', 'alive', 'manzanillo'], ['sibling', 'Flavia', 'Sánchez', 1922, 'F', 'alive', 'manzanillo']], note: 'Daughter of a doctor from Media Luna. Builds the network that supplies the Sierra. Everyone trusts her.' },
    { id: 'frank', first: 'Frank', last: 'País', last2: 'García', sex: 'M', yob: 1934, birth: 'santiago', at: 'santiago', side: 'llano', occ: 'maestro', role: 'Jefe de Acción (Llano)', v: 'ok', traits: ['idealist', 'brave', 'cautious', 'devout'], exp: 0, st: 92, cv: 92, hair: 'blk', covert: true,
      fam: [['mother', 'Rosario', 'García', 1900, 'F', 'alive', 'santiago'], ['sibling', 'Josué', 'País', 1937, 'M', 'alive', 'santiago'], ['sibling', 'Agustín', 'País', 1939, 'M', 'alive', 'santiago']], note: 'Baptist schoolteacher, 22 years old, who runs the whole Santiago underground.' },
    { id: 'vilma', first: 'Vilma', last: 'Espín', last2: 'Guillois', sex: 'F', yob: 1930, birth: 'santiago', at: 'santiago', side: 'llano', occ: 'estudiante', role: 'Enlace (Llano)', v: 'ok', traits: ['idealist', 'brave', 'cautious'], exp: 0, st: 88, cv: 85, hair: 'brn', covert: true,
      fam: [['father', 'José', 'Espín', 1895, 'M', 'alive', 'santiago']], note: 'Chemical engineer from a wealthy Santiago family; brilliant organizer. Women move through checkpoints more easily than men.' },
    { id: 'haydee', first: 'Haydée', last: 'Santamaría', last2: 'Cuadrado', sex: 'F', yob: 1922, birth: 'encrucijada', at: 'habana', side: 'llano', occ: 'ama', role: 'Coordinadora (Llano)', v: 'ok', traits: ['brave', 'idealist', 'stoic'], exp: 5, st: 94, cv: 95, hair: 'blk', covert: true,
      fam: [['sibling', 'Abel', 'Santamaría', 1927, 'M', 'dead', 'encrucijada'], ['spouse', 'Armando', 'Hart', 1930, 'M', 'alive', 'habana']], note: 'Moncada survivor who lost her brother Abel there. A courier and organizer in Havana.' },
    { id: 'hart', first: 'Armando', last: 'Hart', last2: 'Dávalos', sex: 'M', yob: 1930, birth: 'habana', at: 'habana', side: 'llano', occ: 'abogado', role: 'Coordinador nacional (Llano)', v: 'ok', traits: ['idealist', 'cautious'], exp: 0, st: 88, cv: 85, hair: 'brn', covert: true, fam: [], note: 'A young lawyer who leads the national underground.' },
    { id: 'melba', first: 'Melba', last: 'Hernández', last2: 'Rodríguez', sex: 'F', yob: 1921, birth: 'cruces', at: 'habana', side: 'llano', occ: 'abogado', role: 'Abogada y enlace', v: 'check', traits: ['brave', 'idealist'], exp: 4, st: 90, cv: 90, hair: 'brn', covert: true, fam: [], note: 'Lawyer and Moncada survivor.' },
    { id: 'echeverria', first: 'José Antonio', last: 'Echeverría', last2: 'Bianchi', tag: 'José A. Echeverría', sex: 'M', yob: 1932, birth: 'cardenas', at: 'habana', side: 'student', occ: 'estudiante', role: 'Presidente de la FEU', v: 'ok', traits: ['idealist', 'brave', 'hothead', 'devout'], exp: 0, st: 92, cv: 90, hair: 'blk', fam: [], note: 'Architecture student and president of the university federation; leads the Revolutionary Directorate.' },
    { id: 'blas', first: 'Blas', last: 'Roca', last2: 'Calderío', sex: 'M', yob: 1908, birth: 'manzanillo', at: 'habana', side: 'union', occ: 'sindicalista', role: 'Dirigente del PSP', v: 'check', traits: ['cautious', 'stoic', 'veteran'], exp: 0, st: 20, cv: 70, hair: 'gry', fam: [], note: 'Communist party (PSP) leader from Manzanillo. Wary of the rebels as "putschists" at first.' },
    { id: 'lazaro', first: 'Lázaro', last: 'Peña', last2: 'González', sex: 'M', yob: 1911, birth: 'habana', at: 'habana', side: 'union', occ: 'sindicalista', role: 'Líder obrero', v: 'check', traits: ['stoic', 'veteran', 'idealist'], exp: 0, eth: 'negra', st: 25, cv: 70, hair: 'gry', fam: [], note: 'Afro-Cuban union organizer, prominent in the communist labour movement.' },
    { id: 'serantes', first: 'Enrique', last: 'Pérez', last2: 'Serantes', tag: 'Mons. Pérez Serantes', sex: 'M', yob: 1883, birth: 'galicia', at: 'santiago', side: 'church', occ: 'sacerdote', role: 'Arzobispo de Santiago', v: 'check', traits: ['devout', 'kind', 'stoic'], exp: 0, st: 12, cv: 60, hair: 'wht', fam: [], note: 'Galician-born archbishop. Helped save the life of captured rebels in 1953; wary of radicalism.' },
    { id: 'matos', first: 'Huber', last: 'Matos', last2: 'Benítez', sex: 'M', yob: 1918, birth: 'yara', at: 'manzanillo', side: 'llano', occ: 'maestro', role: 'Maestro y arrocero', v: 'ok', traits: ['idealist', 'devout', 'stoic'], exp: 0, st: 55, cv: 55, hair: 'blk', fam: [], note: 'Schoolteacher and rice grower of Manzanillo. A moderate who wants democracy back.' },
    { id: 'vallejo', first: 'René', last: 'Vallejo', last2: 'Ortiz', sex: 'M', yob: 1921, birth: 'manzanillo', at: 'manzanillo', side: 'llano', occ: 'medico', role: 'Médico', v: 'assumed', traits: ['kind', 'brave'], exp: 0, st: 60, cv: 55, hair: 'blk', fam: [], note: 'A Manzanillo doctor who becomes the commander\'s physician.' },
    { id: 'rielo', first: 'Isabel', last: 'Rielo', last2: 'Rodríguez', sex: 'F', yob: 1935, birth: 'santiago', at: 'santiago', side: 'llano', occ: 'costurera', role: 'Costurera', v: 'check', traits: ['brave', 'stoic'], exp: 0, st: 55, cv: 55, hair: 'blk', fam: [['sibling', 'Lilia', 'Rielo', 1938, 'F', 'alive', 'santiago']], note: 'In history, led the Mariana Grajales platoon. Hometown San Luis, near Santiago.' },
    // --- the regime ---
    { id: 'batista', first: 'Fulgencio', last: 'Batista', last2: 'Zaldívar', sex: 'M', yob: 1901, birth: 'banes', at: 'habana', side: 'regime', occ: 'oficial', role: 'Presidente', v: 'check', traits: ['opportunist', 'loyalist'], exp: 40, eth: 'mulata', st: -100, cv: 100, hair: 'blk', fam: [], note: 'Sergeant-turned-general who seized power in 1952. Not of the old white elite, and kept out of their clubs.' },
    { id: 'tabernilla', first: 'Francisco', last: 'Tabernilla', last2: 'Dolz', sex: 'M', yob: 1888, birth: 'habana', at: 'habana', side: 'regime', occ: 'oficial', role: 'Jefe del Estado Mayor', v: 'assumed', traits: ['loyalist', 'greedy'], exp: 60, st: -95, cv: 90, hair: 'wht', fam: [], note: 'Army chief of staff; his family holds many posts.' },
    { id: 'cantillo', first: 'Eulogio', last: 'Cantillo', last2: 'Porras', sex: 'M', yob: 1911, birth: 'santiago', at: 'santiago', side: 'regime', occ: 'oficial', role: 'General de Oriente', v: 'assumed', traits: ['cautious', 'opportunist'], exp: 40, st: -70, cv: 55, hair: 'gry', fam: [], note: 'Field commander who will lead the 1958 offensive.' },
    { id: 'chaviano', first: 'Alberto', last: 'del Río Chaviano', last2: '', tag: 'Cnel. Chaviano', sex: 'M', yob: 1916, birth: 'santiago', at: 'santiago', side: 'regime', occ: 'oficial', role: 'Coronel, Regimiento Maceo', v: 'assumed', traits: ['loyalist', 'hothead'], exp: 30, st: -90, cv: 85, hair: 'blk', fam: [], note: 'Commanded the Moncada garrison.' },
    { id: 'sarria', first: 'Pedro', last: 'Sarría', last2: 'Tartabull', sex: 'M', yob: 1920, birth: 'santiago', at: 'santiago', side: 'regime', occ: 'oficial', role: 'Teniente', v: 'check', traits: ['kind', 'stoic', 'cautious'], exp: 15, st: -40, cv: 40, hair: 'blk', fam: [], note: 'The lieutenant who protected captured rebels in 1953. Soldiers can be more than their uniform.' },
    { id: 'ventura', first: 'Esteban', last: 'Ventura', last2: 'Novo', sex: 'M', yob: 1913, birth: 'habana', at: 'habana', side: 'regime', occ: 'sim', role: 'Coronel de policía', v: 'assumed', traits: ['hothead', 'loyalist', 'greedy'], exp: 30, st: -100, cv: 95, hair: 'blk', fam: [], note: 'Feared Havana police colonel; his men torture suspects.' },
    // --- Havana pipeline donors (fictional archetypes) ---
    { id: 'larrea', first: 'Ernesto', last: 'Larrea', last2: 'Ibarra', tag: 'Don Ernesto Larrea', sex: 'M', yob: 1898, birth: 'habana', at: 'habana', side: 'elite', occ: 'comerciante', role: 'Comerciante de ron y azúcar', v: 'fiction', traits: ['cautious', 'generous', 'opportunist'], exp: 0, st: -8, cv: 30, hair: 'gry', donor: 1200, fam: [['spouse', 'Mercedes', 'Ibarra', 1905, 'F', 'alive', 'habana'], ['child', 'Alfredo', 'Larrea', 1932, 'M', 'alive', 'habana']], note: 'Wealthy rum merchant. Dislikes Batista\'s gangsters; fears communists and land reform even more. (Fictional)' },
    { id: 'mercedes', first: 'Mercedes', last: 'Ibarra', last2: 'Soler', tag: 'Doña Mercedes Ibarra', sex: 'F', yob: 1905, birth: 'habana', at: 'habana', side: 'elite', occ: 'ama', role: 'Anfitriona de tertulias', v: 'fiction', traits: ['devout', 'generous', 'gossip'], exp: 0, st: 18, cv: 35, hair: 'gry', donor: 600, fam: [], note: 'Hosts salons where money and rumours change hands. (Fictional)' },
    { id: 'quesada', first: 'Alfredo', last: 'Quesada', last2: 'Mena', tag: 'Dr. Quesada', sex: 'M', yob: 1920, birth: 'habana', at: 'habana', side: 'elite', occ: 'abogado', role: 'Abogado de causas políticas', v: 'fiction', traits: ['idealist', 'cautious'], exp: 0, st: 40, cv: 40, hair: 'blk', donor: 500, fam: [], note: 'Defends political prisoners; a courier of money and messages. (Fictional)' },
  ];

  // quick lookup used by gen.js
  C.ROSTER_BY_ID = {}; C.ROSTER.forEach((r) => (C.ROSTER_BY_ID[r.id] = r));
})();
