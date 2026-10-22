/* CUBEA — lang.js : progressive Spanish.
   The game starts in plain English. Spanish terms are introduced gradually WITH a translation, e.g. "the barbudos (the bearded ones)",
   and later appear alone. Each lexicon entry has a tier (1 = early, 2 = mid, 3 = late). Level 0..1 follows the calendar (day / 650).
   Authoring: put {{key}} (or {{^key}} for Capitalised) in any string passed through C.tx(); or call C.es('key').                        */
(function () {
  'use strict';
  const C = (window.C = window.C || {});
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

  // level thresholds: when the Spanish form first appears (with translation), and how long the translation stays
  const INTRO = [0, 0.04, 0.2, 0.42];     // index = tier
  const SPAN = 0.3;                        // level span during which "Spanish (English)" is shown
  C.langLevel = () => { const g = C.G; return g ? clamp(g.day / 650, 0, 1) : 0; };
  C.langOverride = null;                   // set to 0..1 to force a level (testing)

  // key: [english, spanish, tier]
  const L = {
    // --- people & roles
    rebel: ['rebel', 'rebelde', 1], rebels: ['rebels', 'rebeldes', 1], barbudos: ['the bearded ones', 'los barbudos', 1], comandante: ['commander', 'comandante', 1], capitan: ['captain', 'capitán', 2], teniente: ['lieutenant', 'teniente', 3],
    soldier: ['soldier', 'soldado', 1], guard: ['guard', 'guardia', 1], police: ['police', 'policía', 2], informer: ['informer', 'chivato', 3], traitor: ['traitor', 'traidor', 3], friend: ['friend', 'compay', 1], comrade: ['comrade', 'compañero', 2], compadre: ['godfather-friend', 'compadre', 2],
    peasant: ['peasant', 'guajiro', 1], peasants: ['peasants', 'campesinos', 1], jefe: ['chief', 'jefe', 1], viejo: ['old man', 'viejo', 2], priest: ['priest', 'cura', 2], teacher: ['teacher', 'maestro', 2], landowner: ['landowner', 'hacendado', 2], steward: ['steward', 'mayordomo', 3], midwife: ['midwife', 'partera', 3],
    machetero: ['cane cutter', 'machetero', 2], carbonero: ['charcoal-burner', 'carbonero', 2], pescador: ['fisherman', 'pescador', 2], bodeguero: ['shopkeeper', 'bodeguero', 2], student: ['student', 'estudiante', 2], worker: ['worker', 'obrero', 2], doctor: ['doctor', 'médico', 3],
    // --- places & things
    sierra: ['the mountains', 'la Sierra', 1], monte: ['the forest', 'el monte', 2], pueblo: ['village', 'pueblo', 2], batey: ['sugar hamlet', 'batey', 3], bohio: ['hut', 'bohío', 1], cuartel: ['barracks', 'cuartel', 2], iglesia: ['church', 'iglesia', 2], bodega: ['store', 'bodega', 2],
    central: ['sugar mill', 'central', 3], zafra: ['sugar harvest', 'zafra', 3], tiempomuerto: ['dead season', 'tiempo muerto', 3], vale: ['IOU', 'vale', 2], comida: ['food', 'comida', 2], agua: ['water', 'agua', 2], guagua: ['bus', 'guagua', 3], lancha: ['boat', 'lancha', 3], camion: ['truck', 'camión', 2],
    carreta: ['ox-cart', 'carreta', 3], cerdo: ['pig', 'cerdo', 2], vaca: ['cow', 'vaca', 1], gallina: ['hen', 'gallina', 2], jutia: ['hutia', 'jutía', 3], puercojibaro: ['wild boar', 'puerco jíbaro', 3], guanajo: ['turkey', 'guanajo', 3],
    // --- exclamations (speech bubbles)
    gracias: ['Thanks', 'Gracias', 1], fuego: ['Fire!', '¡Fuego!', 1],
    // --- UI words
    squads: ['Your squads', 'Tus escuadras', 2], map: ['Map', 'Mapa', 3], manifesto: ['Manifesto', 'Manifiesto', 3], factions: ['Factions', 'Facciones', 3], journal: ['Journal', 'Diario', 3], camp: ['Camp', 'Campamento', 2],
    // --- stances / commands
    s_follow: ['Follow', 'Seguir', 2], s_hold: ['Hold', 'Mantener', 2], s_ambush: ['Ambush', 'Emboscada', 2], s_scout: ['Scout', 'Explorar', 2], s_forage: ['Forage', 'Forrajear', 3], s_harass: ['Harass', 'Hostigar', 3], s_withdraw: ['Withdraw', 'Retirada', 2],
    g_0: ['Vanguard', 'Vanguardia', 2], g_1: ['Center', 'Centro', 2], g_2: ['Rearguard', 'Retaguardia', 2], g_3: ['Medical', 'Sanidad', 3],
    // --- moods
    m_sereno: ['calm', 'sereno', 3], m_hambriento: ['hungry', 'hambriento', 2], m_sediento: ['thirsty', 'sediento', 3], m_agotado: ['exhausted', 'agotado', 3], m_temeroso: ['afraid', 'temeroso', 3], m_furioso: ['furious', 'furioso', 2], m_adolorido: ['in pain', 'adolorido', 3], m_confiado: ['confident', 'confiado', 2], m_esperanzado: ['hopeful', 'esperanzado', 3], m_desanimado: ['despondent', 'desanimado', 3],
    // --- factions
    f_peasants: ['Peasants', 'Campesinos', 1], f_workers: ['Workers & unions', 'Obreros y sindicatos', 2], f_middle: ['Middle class', 'Clase media', 2], f_students: ['Students', 'Estudiantes', 2], f_elite: ['Urban elite', 'Élite urbana', 3], f_landowners: ['Landowners', 'Terratenientes', 3], f_church: ['Church', 'Iglesia', 2], f_army: ['Army & police', 'Ejército y policía', 2], f_foreign: ['American interests', 'Intereses norteamericanos', 3],
    // --- occupations
    o_macheteo: ['Cane cutter', 'Machetero', 2], o_colono: ['Tenant farmer', 'Colono', 3], o_guajiro: ['Peasant farmer', 'Guajiro', 1], o_carbonero: ['Charcoal-burner', 'Carbonero', 2], o_vaquero: ['Cowhand', 'Vaquero', 3], o_pescador: ['Fisherman', 'Pescador', 2], o_mayordomo: ['Estate steward', 'Mayordomo', 3], o_hacendado: ['Landowner', 'Hacendado', 2],
    o_bodeguero: ['Shopkeeper', 'Bodeguero', 2], o_dependiente: ['Shop clerk', 'Dependiente', 3], o_maestro: ['Teacher', 'Maestro', 2], o_partera: ['Midwife / healer', 'Partera / curandera', 3], o_medico: ['Doctor', 'Médico', 2], o_abogado: ['Lawyer', 'Abogado', 2], o_comerciante: ['Merchant', 'Comerciante', 3], o_banquero: ['Banker', 'Banquero', 3],
    o_funcionario: ['Official', 'Funcionario', 3], o_periodista: ['Journalist', 'Periodista', 3], o_sacerdote: ['Priest', 'Sacerdote', 2], o_monja: ['Nun', 'Monja', 3], o_obrerocentral: ['Mill worker', 'Obrero del central', 3], o_estibador: ['Dock worker', 'Estibador', 3], o_tabaquero: ['Cigar roller', 'Tabaquero', 3],
    o_carpintero: ['Carpenter', 'Carpintero', 3], o_sastre: ['Tailor', 'Sastre', 3], o_barbero: ['Barber', 'Barbero', 3], o_chofer: ['Driver', 'Chofer', 3], o_mecanico: ['Mechanic', 'Mecánico', 3], o_ferroviario: ['Railwayman', 'Ferroviario', 3], o_costurera: ['Seamstress', 'Costurera', 3], o_lavandera: ['Washerwoman', 'Lavandera', 3],
    o_domestica: ['Domestic worker', 'Empleada doméstica', 3], o_sindicalista: ['Union leader', 'Dirigente sindical', 3], o_obrerofab: ['Factory worker', 'Obrero de fábrica', 3], o_camarero: ['Waiter / hotel staff', 'Camarero / hotel', 3], o_musico: ['Musician', 'Músico', 2], o_casino: ['Casino dealer', 'Crupier de casino', 3], o_locutor: ['Radio announcer', 'Locutor de radio', 3],
    o_estudiante: ['Student', 'Estudiante', 2], o_ama: ['Housewife', 'Ama de casa', 3], o_nino: ['Child', 'Niño/a', 2], o_jubilado: ['Elder', 'Anciano/a', 2], o_soldado: ['Soldier', 'Soldado', 1], o_guardia: ['Rural Guard', 'Guardia rural', 1], o_policia: ['Policeman', 'Policía', 2], o_oficial: ['Officer', 'Oficial', 2], o_sim: ['SIM agent', 'Agente del SIM', 3], o_rebelde: ['Rebel', 'Rebelde', 1],
    o_gerente: ['U.S. company manager', 'Gerente norteamericano', 3], o_turista: ['American tourist', 'Turista norteamericano', 3], o_marino: ['U.S. sailor', 'Marino norteamericano', 3], o_asesor: ['U.S. adviser', 'Asesor norteamericano', 3],
    // --- vehicles & animals
    v_jeep: ['Willys jeep', 'Jeep Willys', 1], v_truck: ['Truck', 'Camión', 2], v_car: ["Car ('55 Chevrolet)", "Auto (Chevrolet '55)", 2], v_bus: ['Bus', 'Guagua', 3], v_armyjeep: ['Army jeep', 'Jeep militar', 2], v_armytruck: ['Army truck', 'Camión militar', 2], v_oxcart: ['Ox-cart', 'Carreta de bueyes', 3], v_boat: ['Fishing boat', 'Lancha de pesca', 3], v_granma: ['Granma (yacht)', 'Granma (yate)', 1], v_patrolboat: ['Coast-guard boat', 'Guardacostas', 2],
    a_cow: ['cow', 'vaca', 1], a_pig: ['pig', 'cerdo', 2], a_hen: ['hen', 'gallina', 2], a_hutia: ['hutia', 'jutía', 3], a_boar: ['wild boar', 'puerco jíbaro', 3], a_turkey: ['turkey', 'guanajo', 3],
  };
  C.LEX = L;
  // helper to format by tier & level
  function render(en, es, tier) {
    if (en === es) return es;
    const lvl = C.langOverride !== null ? C.langOverride : C.langLevel(), t0 = INTRO[tier];
    if (lvl < t0) return en;
    if (lvl < t0 + SPAN) return es + ' (' + en + ')';
    return es;
  }
  C.es = function (key, cap) { const e = L[key]; if (!e) return key; const s = render(e[0], e[1], e[2]); return cap ? s.charAt(0).toUpperCase() + s.slice(1) : s; };
  C.tx = function (str) { return str ? String(str).replace(/\{\{(\^?)([a-z0-9_]+)\}\}/gi, (m, cap, key) => C.es(key, !!cap)) : str; };

  // --- building labels (the map stores Spanish labels; English is shown first) ---
  const LAB = {
    'Almacén Larrea (ron y azúcar)': 'Larrea Warehouse (rum & sugar)', 'Almacén de caña': 'Cane warehouse', 'Almacén del puerto': 'Port warehouse', 'Almacén': 'Warehouse', 'Banco Nacional': 'National Bank', 'Banco': 'Bank', 'Barracón': 'Barracks hut',
    'Bodega de Palmarito': 'Palmarito store', 'Bodega': 'Store', 'Bohío abandonado': 'Abandoned hut', 'Buró de Investigaciones (SIM)': 'Bureau of Investigations (SIM)', 'CMQ Radio': 'CMQ Radio', 'Café Paris': 'Café Paris', 'Capilla de San Lázaro': 'Chapel of San Lázaro',
    'Capilla de la Virgen (Caridad)': 'Chapel of the Virgin (Caridad)', 'Casa de hacendado': "Landowner's house", 'Casa del Mayordomo': "Steward's house", 'Casa del cañero': "Cane-grower's house", 'Casino Capri': 'Casino Capri', 'Casino Tropicana': 'Casino Tropicana',
    'Catedral': 'Cathedral', 'Cementerio': 'Cemetery', 'Central azucarero': 'Sugar mill', 'Cine': 'Cinema', 'Cooperativa de pescadores': 'Fishermen’s co-op', 'Cuartel Carlos M. de Céspedes': 'Céspedes Barracks', 'Cuartel Moncada': 'Moncada Barracks',
    'Cuartel de Manzanillo': 'Manzanillo Barracks', 'Cuartel de la Policía Nacional': 'National Police Barracks', 'Cuartel del SIM': 'SIM Headquarters', 'Depósito de combustible': 'Fuel depot', 'Depósito de gasolina (puerto)': 'Fuel depot (port)', 'El Capitolio': 'The Capitol',
    'Escuela rural': 'Rural school', 'Estación de policía': 'Police station', 'Gasolinera Esso': 'Esso gas station', 'Gasolinera Texaco': 'Texaco gas station', 'Gasolinera': 'Gas station', 'Gran Teatro': 'Grand Theater', 'Hospital Calixto García': 'Calixto García Hospital',
    'Hospital Saturnino Lora': 'Saturnino Lora Hospital', 'Hotel Casa Granda': 'Hotel Casa Granda', 'Hotel Nacional': 'Hotel Nacional', 'Iglesia bautista': 'Baptist church', 'Iglesia de la Purísima': 'Church of La Purísima', 'Iglesia del Ángel': 'Church of the Angel',
    'Instituto': 'High school', 'Jefatura de Policía': 'Police headquarters', 'Monte (huir hacia la Sierra)': 'Forest (flee to the Sierra)', 'Muelle': 'Pier', 'Palacio Presidencial': 'Presidential Palace', 'Parroquia Mayor': 'Main parish church', 'Polvorín del Ejército': 'Army powder magazine',
    'Polvorín': 'Powder magazine', 'Puesto de Guardacostas': 'Coast-guard post', 'Puesto de la Guardia Rural': 'Rural Guard post', 'Puesto del Ejército': 'Army outpost', 'Ron Bacardí (fábrica)': 'Bacardí rum factory', 'Secadero de pescado': 'Fish-drying racks',
    'Sindicato (CTC)': 'Union hall (CTC)', 'Sindicato de Obreros': 'Workers’ union hall', 'Sindicato': 'Union hall', 'Teatro Oriente': 'Oriente Theater', 'Tienda del mando': 'Command tent', 'Torre de CMQ': 'CMQ tower', 'Torre de radio de la policía': 'Police radio tower',
    'Torre de radio': 'Radio tower', 'Universidad de La Habana (la Escalinata)': 'University of Havana (the Steps)', 'Universidad de Oriente': 'University of Oriente',
    'Bohío': 'Hut', 'Casa': 'House', 'Casona': 'Manor', 'Cuartería': 'Tenement', 'Edificio': 'Apartment block', 'Tienda': 'Shop', 'Café': 'Café', 'Barbería': 'Barber shop', 'Farmacia': 'Pharmacy', 'Iglesia': 'Church', 'Capilla': 'Chapel', 'Escuela': 'School', 'Universidad': 'University', 'Hospital': 'Hospital', 'Clínica': 'Clinic',
    'Cuartel': 'Barracks', 'Ayuntamiento': 'Town hall', 'Palacio': 'Palace', 'Fábrica': 'Factory', 'Fábrica de ron': 'Rum factory', 'Teatro': 'Theater', 'Hotel': 'Hotel', 'Casino': 'Casino', 'Estación de radio': 'Radio station', 'Puente': 'Bridge',
    'Tienda de campaña': 'Tent', 'Cocina de campamento': 'Camp kitchen', 'Enfermería': 'Infirmary', 'Polvorín (munición)': 'Ammunition store', 'Taller': 'Workshop', 'Radio Rebelde': 'Radio Rebelde', 'Escuela rebelde': 'Rebel school', 'Imprenta': 'Printing press', 'Solar libre': 'Empty plot',
    'Estación de policía.': 'Police station', 'Embajada de EE.UU.': 'U.S. Embassy', 'Central Estrella (propiedad norteamericana)': 'Estrella Sugar Mill (U.S.-owned)',
  };
  C.LABELS_EN = LAB;
  C.lab = function (es) {
    if (!es) return es;
    if (es.indexOf('{{') >= 0) return C.tx(es);
    let pre = '', rest = es;
    const m = /^(Solar: )(.*)$/.exec(es); if (m) { pre = 'Plot: '; rest = m[2]; }
    // family houses: "Bohío Pino" -> "Pino hut"
    const fm = /^(Bohío|Casa|Casona) (?!de |del )(.+)$/.exec(rest);
    let en;
    if (fm && !LAB[rest]) { const kind = { 'Bohío': ['Hut', 'Bohío'], 'Casa': ['House', 'Casa'], 'Casona': ['Manor', 'Casona'] }[fm[1]]; en = fm[2] + ' ' + kind[0].toLowerCase(); const esForm = fm[1] + ' ' + fm[2]; const lvl = C.langOverride !== null ? C.langOverride : C.langLevel(); const t0 = fm[1] === 'Bohío' ? INTRO[1] : INTRO[2]; return pre + (lvl < t0 ? fm[2] + ' ' + kind[0].toLowerCase() : lvl < t0 + SPAN ? esForm + ' (' + en + ')' : esForm); }
    en = LAB[rest] || rest;
    if (en === rest) return pre + rest;
    const lvl = C.langOverride !== null ? C.langOverride : C.langLevel();
    return pre + (lvl < INTRO[2] ? en : lvl < INTRO[2] + SPAN ? rest + ' (' + en + ')' : rest);
  };

  // --- speech bubbles: existing Spanish lines with English glosses ---
  const PH = {
    'Buena caza': ['Good hunting', 2], 'Es por la causa': ["It's for the cause", 2], 'Gracias, comandante': ['Thank you, commander', 1], 'Gracias, compay': ['Thanks, friend', 1], 'Hay que pasar desapercibido': ['Stay inconspicuous', 3], 'Le pago en un mes': ["I'll pay you in a month", 2],
    'Llévese lo que haga falta': ['Take whatever you need', 2], 'No me convence todavía...': ["I'm not convinced yet...", 2], 'No nos dejen sin nada...': ["Don't leave us with nothing...", 2], 'No tenemos nada...': ['We have nothing...', 2], 'Primero demuestre que cumple.': ['First prove you keep your word.', 3],
    'Recargando': ['Reloading', 2], 'Sí, jefe': ['Yes, chief', 1], 'Sí, jefe...': ['Yes, chief...', 1], '¡A la orden!': ['At your orders!', 2], '¡Aaah!': ['Aaah!', 1], '¡Agáchense!': ['Get down!', 1], '¡Al monte!': ['To the forest!', 2], '¡Al suelo!': ['Hit the ground!', 1], '¡Allá están!': ['There they are!', 1],
    '¡Alto! ¡Quién vive!': ['Halt! Who goes there!', 1], '¡Antes muerto!': ['Dead first!', 3], '¡Ay!': ['Ow!', 1], '¡Ay, Dios mío!': ['Oh my God!', 1], '¡Corran!': ['Run!', 1], '¡Cuidado!': ['Careful!', 1], '¡Dios mío!': ['My God!', 1], '¡Disparos!': ['Gunshots!', 1],
    '¡Enemigo avistado!': ['Enemy sighted!', 2], '¡Estoy herido!': ["I'm hit!", 1], '¡Fuego!': ['Fire!', 1], '¡Goma ponchada!': ['Flat tire!', 3], '¡Granada!': ['Grenade!', 2], '¡Me dieron!': ['They got me!', 1], '¡Me rindo!': ['I surrender!', 2], '¡Me voy!': ["I'm leaving!", 2],
    '¡Mecha encendida! ¡Corran!': ['Fuse lit! Run!', 2], '¡Molotov!': ['Molotov!', 2], '¡No disparen! ¡Me rindo!': ["Don't shoot! I surrender!", 2], '¡Nos tiran!': ["They're shooting at us!", 1], '¡Rebeldes!': ['Rebels!', 1], '¡Sin balas!': ['Out of bullets!', 2], '¡Sálvese quien pueda!': ['Every man for himself!', 2],
    '¡Usted! ¡Alto ahí!': ['You there! Stop!', 2], 'Tengo hambre...': ["I'm hungry...", 2], 'Sed...': ['Thirsty...', 3], 'Estoy agotado': ["I'm exhausted", 3], 'Tengo miedo': ["I'm afraid", 2], '¿Para qué?': ['What for?', 2], 'No puedo más': ["I can't go on", 3], 'Un momento...': ['One moment...', 2],
    'Gracias': ['Thanks', 1], '¡Alerta!': ['Alert!', 2], 'Jefe, son demasiados...': ['Chief, there are too many...', 2], 'Es una locura, jefe': ["That's madness, chief", 2], '¡Viva!': ['Long live!', 3], '¡Venceremos!': ['We will win!', 3], '¡Patria o muerte!': ['Homeland or death!', 3],
  };
  C.PH = PH;
  C.phrase = function (txt) {
    const e = PH[txt]; if (!e) return txt;
    const lvl = C.langOverride !== null ? C.langOverride : C.langLevel(), t0 = INTRO[e[1]];
    if (lvl < t0) return e[0]; if (lvl < t0 + SPAN) return txt + ' (' + e[0] + ')'; return txt;
  };
  // convenience: stance/group/mood/faction/occupation/vehicle names
  C.stName = (k) => C.es('s_' + k, true);
  C.gName = (sq) => (sq.custom ? sq.name : C.es('g_' + sq.id, true));
  C.moodName = (l) => C.es('m_' + l);
  C.fName = (f) => C.es('f_' + f, true);
  C.occName = (k) => (L['o_' + k] ? C.es('o_' + k, true) : (C.OCC[k] || {}).n || k);
  C.vName = (type) => (L['v_' + type] ? C.es('v_' + type, true) : (C.VEHICLES[type] || {}).n || type);
  C.aName = (k) => C.es('a_' + k);
})();
