#!/usr/bin/env node
// docs/master/evidencias/SCRUM-1553/contradiccion.mjs · J3 (equipo de Javier), 14-oct-2026 · SCRUM-1553 ③, salida D
//
// UNA CONSULTA QUE TIENE QUE SALIR VACÍA: los tickets donde `listo-para-construir` convive con una etiqueta
// que dice lo contrario. La eligió el orquestador del equipo de Javier entre las cuatro del ③ porque es la
// única que no depende de que alguien se acuerde.
//
//   node docs/master/evidencias/SCRUM-1553/contradiccion.mjs --foto <foto.tsv> [--equipo equipo-javier]
//   node docs/master/evidencias/SCRUM-1553/contradiccion.mjs --solo-controles
//
// LA FOTO es la de la casa (la que lee `SCRUM-1496/tabla-ya-esta.mjs --jira`): clave<TAB>estado<TAB>etiquetas
// separadas por comas, y DELANTE una línea de cabecera obligatoria:
//   # medido: <AAAA-MM-DDTHH:MMZ> · jql: <la consulta> · total: <N que dijo Jira>
// Sin fecha no se juzga: una foto de Jira caduca en horas, y una etiqueta no lleva fecha. Sin «total», o con
// un total que no casa con las filas, tampoco: la foto puede venir cortada (una página de 50, un `head`).
// La foto se saca por el MCP de Atlassian con la JQL que este guion imprime: el repositorio no guarda
// credenciales de Jira, y por eso el guion no consulta Jira él mismo (ver «NO VE» abajo).
//
// QUÉ ES «CONTRARIA» — la lista entera, y nada más:
//   · cualquier etiqueta que EMPIECE por `esperando-` (hoy, en la foto del 14-oct: -asesor, -alter,
//     -caso-real, -decision); el prefijo es deliberado y va con su guion: «esperandox» no casa;
//   · `decision-jefe`, `fundador`, `sin-firma`, por su nombre EXACTO («fundadores» no casa).
//
// CÓDIGOS DE SALIDA:  0 = vacía (y los controles pasaron) · 1 = hay contradicciones · 2 = NO HE PODIDO MIRAR
//
// CONTROLES, en CADA pasada y antes de mirar la foto real, por la MISMA función que la juzga:
//   · POSITIVO SEMBRADO: tickets inventados (SCRUM-90001…) con la etiqueta y una contraria. NO se usan los de
//     la foto real como positivo: el día que se les quite la etiqueta, el control se quedaría mudo en verde.
//   · NEGATIVOS: con la etiqueta y sin contraria; con algo que se le PARECE a una contraria; con la contraria
//     y sin la etiqueta. Ninguno puede salir.
//   Si un control falla, sale 2: un instrumento que no caza su semilla no puede decir «vacía».
//
// NO VE (y lo imprime en cada salida, no solo aquí): la decisión pendiente que solo consta en el TEXTO de un
// ticket, sin etiqueta. El 14-oct SCRUM-1553 midió que eran 9 de las 17 que esperaban una decisión. Por eso
// los tickets con la etiqueta y sin contraria salen como NO JUZGADOS, no como limpios.

import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

export const ETIQUETA = 'listo-para-construir';
export const PREFIJO_CONTRARIO = 'esperando-';
export const CONTRARIAS_EXACTAS = Object.freeze(['decision-jefe', 'fundador', 'sin-firma']);
export const JQL = `project = SCRUM AND labels = "${ETIQUETA}" AND statusCategory != Done ORDER BY key ASC`;

// El dato del límite lleva la fecha en que se midió, no la de hoy (A10, SCRUM-1154).
const LIMITE = [
  'NO VE la decisión pendiente que solo consta en el TEXTO de un ticket, sin etiqueta.',
  '  Medido por SCRUM-1553 el 2026-10-14 hacia las 04:20Z (main c30729832): en 9 de las 17 que esperaban una',
  '  decisión el bloqueo NO tenía etiqueta (1043 1051 1058 1063 1064 1065 1067 1077 1401). Esa lista es de',
  '  ese día: no se ha vuelto a medir. Para esos, lo único que hay es leer el ticket (PASO 0).',
  'NO VE una etiqueta contraria CADUCADA: la cuenta igual (p. ej. `esperando-alter` con el ALTER ya aplicado).',
  'NO VE tickets cerrados ni los que no lleven la etiqueta: solo lo que trae la foto.',
];

export function contrarias(etiquetas) {
  return etiquetas.filter((e) => (e.startsWith(PREFIJO_CONTRARIO) && e.length > PREFIJO_CONTRARIO.length)
    || CONTRARIAS_EXACTAS.includes(e));
}

// Devuelve { medido, total, jql, filas: [{clave, estado, etiquetas}], ciegos: [motivo] }.
export function leerFoto(texto) {
  const ciegos = [];
  let medido = null; let total = null; let jql = null;
  const filas = [];
  const lineas = String(texto).split(/\r?\n/);
  lineas.forEach((l, i) => {
    if (!l.trim()) return;
    if (l.startsWith('#')) {
      const m = /medido:\s*(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?Z)/.exec(l);
      if (m) medido = m[1];
      const t = /total:\s*(\d+)/.exec(l);
      if (t) total = Number(t[1]);
      const j = /jql:\s*(.*?)\s*(?:·|$)/.exec(l);
      if (j) jql = j[1];
      return;
    }
    const cols = l.split('\t');
    if (!/^SCRUM-\d+$/.test(cols[0].trim())) { ciegos.push(`línea ${i + 1} no empieza por una clave SCRUM-N: «${l.slice(0, 60)}»`); return; }
    if (cols.length < 3) { ciegos.push(`${cols[0].trim()} (línea ${i + 1}) no trae la columna de etiquetas`); return; }
    const etiquetas = cols[2].split(',').map((e) => e.trim()).filter(Boolean);
    filas.push({ clave: cols[0].trim(), estado: cols[1].trim(), etiquetas });
  });
  if (!medido) ciegos.push('la foto no lleva «# medido: AAAA-MM-DDTHH:MMZ»: sin fecha no se juzga');
  if (total === null) ciegos.push('la foto no lleva «total: N» de Jira: no se puede saber si viene entera');
  else if (total !== filas.length) ciegos.push(`Jira dijo total ${total} y la foto trae ${filas.length} filas: viene cortada o sobra algo`);
  if (jql !== null && !/labels\s*=\s*"?listo-para-construir"?/.test(jql)) ciegos.push(`la JQL de la cabecera no filtra por ${ETIQUETA}: «${jql}»`);
  return { medido, total, jql, filas, ciegos };
}

// Devuelve { conEtiqueta, fueraDeEquipo, contradicciones: [{clave, estado, contrarias}], noJuzgados: [clave] }.
export function juzgar(filas, equipo = null) {
  const conEtiqueta = filas.filter((f) => f.etiquetas.includes(ETIQUETA));
  const enEquipo = equipo ? conEtiqueta.filter((f) => f.etiquetas.includes(equipo)) : conEtiqueta;
  const contradicciones = []; const noJuzgados = [];
  for (const f of enEquipo) {
    const c = contrarias(f.etiquetas);
    if (c.length) contradicciones.push({ clave: f.clave, estado: f.estado, contrarias: c });
    else noJuzgados.push(f.clave);
  }
  return { conEtiqueta: conEtiqueta.length, mirados: enEquipo.length, fueraDeEquipo: conEtiqueta.length - enEquipo.length, contradicciones, noJuzgados };
}

// La semilla: inventada, con números que no existen en Jira, para que nadie la «arregle».
const SEMILLA = [
  '# medido: 2026-10-14T00:00Z · jql: project = SCRUM AND labels = "listo-para-construir" · total: 8',
  'SCRUM-90001\tsemilla\tequipo-javier,esperando-semilla-1553b,listo-para-construir', // POSITIVO: prefijo
  'SCRUM-90002\tsemilla\tequipo-javier,fundador,listo-para-construir',                 // POSITIVO: nombre exacto
  'SCRUM-90003\tsemilla\tdecision-jefe,equipo-javier,listo-para-construir,sin-firma',  // POSITIVO: dos a la vez
  'SCRUM-90004\tsemilla\tequipo-javier,listo-para-construir',                          // NEGATIVO: sin contraria
  'SCRUM-90005\tsemilla\tequipo-javier,esperandox,fundadores,no-esperando-x,listo-para-construir', // NEGATIVO: se le parecen
  'SCRUM-90006\tsemilla\tequipo-javier,esperando-',                                    // NEGATIVO: sin la etiqueta (y prefijo pelado)
  'SCRUM-90007\tsemilla\tequipo-javier,esperando-asesor',                              // NEGATIVO: contraria sin la etiqueta
  'SCRUM-90008\tsemilla\tequipo-luis,esperando-asesor,listo-para-construir',           // con --equipo equipo-javier: fuera
].join('\n');

export function controles() {
  const fallos = [];
  const foto = leerFoto(SEMILLA);
  if (foto.ciegos.length) fallos.push(`la semilla sale ciega: ${foto.ciegos.join(' | ')}`);
  const r = juzgar(foto.filas, 'equipo-javier');
  const salen = r.contradicciones.map((c) => c.clave).sort().join(' ');
  if (salen !== 'SCRUM-90001 SCRUM-90002 SCRUM-90003') fallos.push(`POSITIVO/NEGATIVO: esperaba «SCRUM-90001 SCRUM-90002 SCRUM-90003» y salió «${salen}»`);
  const c3 = r.contradicciones.find((c) => c.clave === 'SCRUM-90003');
  if (!c3 || c3.contrarias.join(',') !== 'decision-jefe,sin-firma') fallos.push(`SCRUM-90003 debía nombrar decision-jefe y sin-firma; nombró «${c3 ? c3.contrarias.join(',') : '—'}»`);
  if (r.noJuzgados.join(' ') !== 'SCRUM-90004 SCRUM-90005') fallos.push(`NO JUZGADOS: esperaba «SCRUM-90004 SCRUM-90005» y salió «${r.noJuzgados.join(' ')}»`);
  if (r.fueraDeEquipo !== 1) fallos.push(`el filtro de equipo debía dejar fuera 1 (SCRUM-90008) y dejó ${r.fueraDeEquipo}`);
  // Las puertas de «no he podido mirar»: una foto sin fecha y una cortada tienen que salir ciegas.
  if (!leerFoto(SEMILLA.replace(/medido: \S+/, 'medido: ayer')).ciegos.some((c) => c.includes('medido'))) fallos.push('una foto sin fecha válida NO salió ciega');
  if (!leerFoto(SEMILLA.split('\n').slice(0, 5).join('\n')).ciegos.some((c) => c.includes('cortada'))) fallos.push('una foto cortada NO salió ciega');
  return { fallos, casos: 8 };
}

function horasDesde(iso) {
  const ms = Date.now() - Date.parse(iso);
  return Number.isFinite(ms) ? (ms / 3600000).toFixed(1) : '?';
}

function principal(argv) {
  const valor = (n) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : null; };
  const rutaFoto = valor('--foto');
  const equipo = valor('--equipo');
  const ctl = controles();
  console.log(`CONTROLES · ${ctl.casos} tickets sembrados (SCRUM-90001…90008), por la misma función que la foto real: ${ctl.fallos.length ? '🔴 FALLAN' : 'pasan'}`);
  for (const f of ctl.fallos) console.log(`   · ${f}`);
  if (ctl.fallos.length) { console.log('🔴 NO HE PODIDO MIRAR: el instrumento no caza su propia semilla; su «vacía» no valdría nada.'); return 2; }
  if (argv.includes('--solo-controles')) return 0;

  if (!rutaFoto) {
    console.log('🔴 NO HE PODIDO MIRAR: falta --foto <foto.tsv>.');
    console.log(`   Sácala por el MCP de Atlassian con esta JQL (campos: labels, status), y pon delante la cabecera:\n   ${JQL}\n   # medido: AAAA-MM-DDTHH:MMZ · jql: … · total: N`);
    return 2;
  }
  let texto;
  try { texto = fs.readFileSync(rutaFoto, 'utf8'); } catch (e) { console.log(`🔴 NO HE PODIDO MIRAR: no se pudo leer ${rutaFoto}: ${e.message}`); return 2; }
  const foto = leerFoto(texto);
  console.log(`FOTO · ${rutaFoto}`);
  console.log(`   medida en Jira: ${foto.medido || '—'} (hace ${foto.medido ? horasDesde(foto.medido) : '?'} h) · total que dijo Jira: ${foto.total ?? '—'} · filas leídas: ${foto.filas.length}`);
  if (foto.ciegos.length) {
    console.log('🔴 NO HE PODIDO MIRAR:');
    for (const c of foto.ciegos) console.log(`   · ${c}`);
    return 2;
  }
  const r = juzgar(foto.filas, equipo);
  if (r.conEtiqueta === 0) { console.log(`🔴 NO HE PODIDO MIRAR: ninguna fila lleva ${ETIQUETA}. Cero no es «vacía»: es que no hay qué mirar (¿JQL equivocada?).`); return 2; }
  console.log(`POBLACIÓN · ${r.conEtiqueta} con ${ETIQUETA}${equipo ? ` · ${r.mirados} de ${equipo} · ${r.fueraDeEquipo} fuera de ese equipo (no mirados)` : ' · todos los equipos'}`);
  console.log(`   contrarias: «${PREFIJO_CONTRARIO}*», ${CONTRARIAS_EXACTAS.map((e) => `«${e}»`).join(', ')}`);
  console.log('');
  if (r.contradicciones.length) {
    console.log(`🔴 NO SALE VACÍA · ${r.contradicciones.length} de ${r.mirados} llevan ${ETIQUETA} y una etiqueta que dice lo contrario:`);
    for (const c of r.contradicciones) console.log(`   ${c.clave.padEnd(11)} ${c.contrarias.join(', ').padEnd(28)} (${c.estado})`);
  } else {
    console.log(`✅ VACÍA · ninguno de los ${r.mirados} lleva ${ETIQUETA} junto a una etiqueta contraria.`);
  }
  console.log('');
  console.log(`⚠️ NO JUZGADOS, NO LIMPIOS · ${r.noJuzgados.length} llevan la etiqueta sin ninguna contraria; esta consulta no dice que estén listos:`);
  console.log(`   ${r.noJuzgados.map((k) => k.replace('SCRUM-', '')).join(' ') || '—'}`);
  console.log('');
  for (const l of LIMITE) console.log(`⚠️ ${l}`);
  return r.contradicciones.length ? 1 : 0;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  process.exitCode = principal(process.argv.slice(2));
}
