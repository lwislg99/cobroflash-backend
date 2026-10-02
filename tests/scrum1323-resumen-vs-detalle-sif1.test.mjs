// tests/scrum1323-resumen-vs-detalle-sif1.test.mjs — SCRUM-1323
//
// Sin gate, sin red, sin `dist`: lee `docs/YAQU_MASTER.md` y un extracto histórico suyo.
//
// ═════════════════════════════════════════════════════════════════════════════════════════
// 🔴 QUÉ IMPIDE ESTO
//
// El máster dice el estado de cada hito de SIF-1 EN DOS SITIOS: la línea de resumen de la Parte U
// (`> **SIF-1** (U1.3): S1-0 🟡 … · S1-D ✅ …`) y la viñeta de detalle de ese hito bajo
// `### U1.3`. Nada los comparaba. Durante quince días el resumen dijo `S1-D ✅` mientras su viñeta
// no llevaba ningún símbolo y definía su «Done» como algo que no se había cumplido (lo corrigió
// SCRUM-1319). La fuente de verdad se contradecía consigo misma en la prioridad absoluta de F1.
//
// ── QUÉ SE COMPARA, Y QUÉ NO ──────────────────────────────────────────────────────────────
// El SÍMBOLO de estado, no la prosa. No se busca «DONE», «HECHO» ni «BORRADOR»: un guard atado a
// una palabra se queda mudo el día que alguien la cambia, o acaba haciendo que se edite el máster
// para contentar al test (la regla 41 al revés).
//
//   · estado del RESUMEN  = el símbolo pegado al identificador del hito (`S1-D ~~✅~~ 🟡` es 🟡:
//     lo tachado no cuenta). Un ✅ dentro del paréntesis de ese hito es de una PARTE suya, no del
//     hito (`S1-0 🟡 HUMANO (cert FNMT ✅ …)` es 🟡).
//   · estados del DETALLE = los símbolos de `ESTADOS` que lleva su viñeta, fuera de lo tachado.
//
//   regla ① · la viñeta lleva alguno  → el del resumen tiene que ser uno de ellos;
//   regla ② · la viñeta no lleva ninguno → el resumen no puede decir `HECHO`.
//
// ── LOS LÍMITES, DECLARADOS ───────────────────────────────────────────────────────────────
//   a) Una viñeta sin símbolo solo prohíbe el ✅. `S1-0 🟡` y `S1-F ⏳` contra una viñeta muda
//      pasan: no hay dos sitios que comparar, hay uno. Medido al escribirlo: 4 viñetas así de 10.
//      🔴 Esos hitos NO SE COMPRUEBAN, y el test ① lo imprime en cada pasada, con sus nombres
//      («SIN COMPROBAR contra su viñeta: 4 de 10 hitos (…)»). Esa salida la fija ⑫.
//   b) Una viñeta con DOS símbolos distintos se compara por pertenencia: no sabe cuál es el
//      vigente. Medido al escribirlo: 0 viñetas así de 10. El test ① las imprime si aparecen, y
//      esa salida la fija ⑬.
//   c) No sabe si el estado es VERDAD (si de verdad hay 10 registros aceptados): solo que los dos
//      sitios dicen lo mismo.
//
// ── POR QUÉ NADA VA POR NÚMERO DE LÍNEA ───────────────────────────────────────────────────
// Una evidencia de SCRUM-523 situaba el resumen en una línea que tres semanas después ya era
// otra. Aquí todo se localiza por identidad: el código de sección (`U1.3`) une el resumen con su
// `### U1.3`, y el identificador (`S1-D`) une cada tramo del resumen con su viñeta.
//
// ── POR QUÉ NO PUEDE CALLAR ───────────────────────────────────────────────────────────────
// Buscar algo por su forma y pasar cuando no se encuentra es no vigilar nada (SCRUM-1321). Todo
// lo que este fichero no consigue leer es un PROBLEMA con su motivo, y va en un test aparte del de
// las contradicciones para que «no veo» y «veo y está mal» no se confundan.
// ═════════════════════════════════════════════════════════════════════════════════════════
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { casosEscritos } from './_casos-escritos.mjs';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const MASTER = path.join(RAIZ, 'docs/YAQU_MASTER.md');

/** El código que une el resumen con su sección de detalle. */
export const SECCION = 'U1.3';

/**
 * Los símbolos de estado que usa hoy el resumen de SIF-1, medidos sobre la línea real.
 * Es una lista CERRADA: uno que no esté aquí pegado a un hito es un PROBLEMA, no un estado que
 * se ignora. Ampliarla es una decisión, y se ve en el diff.
 */
export const ESTADOS = [
  '✅',
  '🟡',
  '⏳',
];

/** El único estado que desbloquea algo: la propia sección lo dice, «Solo con 8/8 ✅». */
export const HECHO = '✅';

// El histórico: la línea de resumen y la sección `### U1.3` tal como estaban en `origin/main`
// justo antes de SCRUM-1319, sacadas de git byte a byte. No se ha fabricado nada.
const FIXTURE = path.join(RAIZ, 'tests/fixtures/scrum1323/master-u13-en-e9e71cab.md');
const SHA_FIXTURE = '5de5b6ee3333fe7544be9f0f20cc91d1f13f046c2f12c68377114622c7178e51';

const RE_PICTO = /\p{Extended_Pictographic}️?/u;
const RE_ID_VIÑETA = /^- \*\*([A-Z][A-Z0-9]*-[0-9A-Za-z]+)(?=[ :*])/;
const sinSelector = (s) => s.replace(/️/g, '');
const escapar = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Lo tachado se sustituye por espacios: deja de leerse y las columnas no se mueven. */
function sinTachado(linea) {
  return linea.replace(/~~.*?~~/g, (m) => ' '.repeat(m.length));
}

/**
 * Lee los dos sitios y los compara. No lanza: devuelve lo que vio.
 *
 *   problemas        → lo que NO se pudo leer (el instrumento está ciego a algo)
 *   hitos            → la población: id, estado del resumen, estados del detalle y dónde están
 *   contradicciones  → los hitos cuyos dos sitios no dicen lo mismo
 */
export function compararResumenYDetalle(texto, seccion = SECCION) {
  const problemas = [];
  const problema = (motivo, detalle) => problemas.push({ motivo, detalle });
  const lineas = texto.split(/\r?\n/);
  const sec = escapar(seccion);

  // ── el resumen: UNA línea `> **<nombre>** (U1.3): …` ──
  const reResumen = new RegExp(`^> \\*\\*([^*]+)\\*\\* \\(${sec}\\):`);
  const resumenes = lineas.map((l, i) => ({ i, m: reResumen.exec(l) })).filter((x) => x.m);
  if (resumenes.length === 0) problema('SIN_RESUMEN', `ninguna línea «> **…** (${seccion}): …»`);
  if (resumenes.length > 1) problema('RESUMEN_DUPLICADO', `${resumenes.length} líneas «> **…** (${seccion}): …»`);

  // ── la sección: UN encabezado `### U1.3 …`, hasta el siguiente encabezado ──
  const reSeccion = new RegExp(`^### ${sec}(?![0-9.])`);
  const secciones = lineas.map((l, i) => i).filter((i) => reSeccion.test(lineas[i]));
  if (secciones.length === 0) problema('SIN_SECCION', `ningún encabezado «### ${seccion}»`);
  if (secciones.length > 1) problema('SECCION_DUPLICADA', `${secciones.length} encabezados «### ${seccion}»`);
  if (resumenes.length !== 1 || secciones.length !== 1) return { problemas, hitos: [], contradicciones: [] };

  const iResumen = resumenes[0].i;
  const nombre = resumenes[0].m[1];
  const ini = secciones[0];
  if (!lineas[ini].includes(nombre)) {
    problema('SECCION_DE_OTRO', `el resumen es de «${nombre}» y el encabezado «${lineas[ini]}» no lo nombra`);
  }
  let fin = lineas.findIndex((l, i) => i > ini && /^#{1,3} /.test(l));
  if (fin < 0) fin = lineas.length;

  // ── las viñetas de detalle: la población sale de AQUÍ ──
  const detalle = new Map(); // id → índices de línea (la viñeta y sus líneas sangradas)
  let abierta = null;
  for (let i = ini + 1; i < fin; i++) {
    const l = lineas[i];
    if (l.startsWith('- ')) {
      const m = RE_ID_VIÑETA.exec(l);
      if (!m) { problema('VIÑETA_ILEGIBLE', `no sé qué hito es: «${l.slice(0, 60)}»`); abierta = null; continue; }
      if (detalle.has(m[1])) { problema('HITO_DUPLICADO', `dos viñetas para ${m[1]}`); abierta = null; continue; }
      abierta = [i];
      detalle.set(m[1], abierta);
    } else if (abierta && /^\s+\S/.test(l)) {
      abierta.push(i);
    } else {
      abierta = null;
    }
  }
  if (detalle.size === 0) problema('SIN_HITOS', `la sección «### ${seccion}» no tiene ninguna viñeta de hito`);

  // ── el resumen, tramo a tramo, por el identificador del hito ──
  const resumen = sinTachado(lineas[iResumen]);
  if (resumen.includes('~~')) problema('TACHADO_ABIERTO', 'el resumen tiene un «~~» sin cerrar');

  const prefijos = new Set([...detalle.keys()].map((id) => id.split('-')[0]));
  if (prefijos.size > 1) problema('PREFIJOS_MEZCLADOS', `los hitos no comparten prefijo: ${[...prefijos].join(', ')}`);
  for (const p of prefijos) {
    const re = new RegExp(`(?<![\\w-])${escapar(p)}-[0-9A-Za-z]+(?![\\w-])`, 'g');
    for (const m of new Set(resumen.match(re) || [])) {
      if (!detalle.has(m)) problema('HITO_SIN_DETALLE', `el resumen nombra ${m} y la sección no tiene su viñeta`);
    }
  }

  const hitos = [];
  for (const [id, idx] of detalle) {
    const re = new RegExp(`(?<![\\w-])${escapar(id)}(?![\\w-])(\\s*)`, 'g');
    const menciones = [...resumen.matchAll(re)];
    const conSimbolo = [];
    for (const m of menciones) {
      const col = m.index + m[0].length;
      const p = RE_PICTO.exec(resumen.slice(col));
      if (p && p.index === 0) conSimbolo.push({ col, bruto: p[0], simbolo: sinSelector(p[0]) });
    }
    let estado = null;
    if (menciones.length === 0) problema('HITO_SIN_RESUMEN', `${id} tiene viñeta y el resumen no lo nombra`);
    else if (conSimbolo.length === 0) problema('SIN_SIMBOLO', `el resumen nombra ${id} sin un símbolo de estado pegado`);
    else if (conSimbolo.length > 1) problema('RESUMEN_AMBIGUO', `el resumen da ${conSimbolo.length} estados a ${id}`);
    else if (!ESTADOS.includes(conSimbolo[0].simbolo)) {
      problema('SIMBOLO_DESCONOCIDO', `${id} lleva «${conSimbolo[0].bruto}», que no está en ESTADOS`);
    } else estado = conSimbolo[0];

    const marcas = [];
    for (const i of idx) {
      const l = sinTachado(lineas[i]);
      if (l.includes('~~')) problema('TACHADO_ABIERTO', `la viñeta de ${id} tiene un «~~» sin cerrar`);
      for (const m of l.matchAll(new RegExp(RE_PICTO.source, 'gu'))) {
        const simbolo = sinSelector(m[0]);
        if (ESTADOS.includes(simbolo)) marcas.push({ linea: i, col: m.index, bruto: m[0], simbolo });
      }
    }
    hitos.push({
      id,
      resumen: estado ? estado.simbolo : null,
      enResumen: estado ? { linea: iResumen, col: estado.col, bruto: estado.bruto } : null,
      detalle: [...new Set(marcas.map((x) => x.simbolo))],
      marcas,
      viñeta: idx[0],
    });
  }

  const contradicciones = [];
  for (const h of hitos) {
    if (h.resumen === null) continue; // ya es un problema: no se juzga lo que no se leyó
    if (h.detalle.length === 0) {
      if (h.resumen === HECHO) {
        contradicciones.push({ id: h.id, resumen: h.resumen, detalle: [],
          por: `el resumen dice ${HECHO} y la viñeta de ${h.id} no lleva ningún símbolo de estado` });
      }
    } else if (!h.detalle.includes(h.resumen)) {
      contradicciones.push({ id: h.id, resumen: h.resumen, detalle: h.detalle,
        por: `el resumen dice ${h.resumen} y la viñeta de ${h.id} dice ${h.detalle.join(' ')}` });
    }
  }
  return { problemas, hitos, contradicciones };
}

const motivos = (r) => r.problemas.map((p) => p.motivo);
const ids = (r) => r.contradicciones.map((c) => c.id);
const pinta = (r) => r.problemas.map((p) => `    ${p.motivo} · ${p.detalle}`).join('\n');

// ── herramientas de mutación: cambian el texto EN MEMORIA y devuelven el texto nuevo ──
function reemplazarEn(texto, linea, col, largo, nuevo) {
  const ls = texto.split('\n');
  ls[linea] = ls[linea].slice(0, col) + nuevo + ls[linea].slice(col + largo);
  return ls.join('\n');
}
function conResumen(texto, h, simbolo) {
  return reemplazarEn(texto, h.enResumen.linea, h.enResumen.col, h.enResumen.bruto.length, simbolo);
}
function conDetalle(texto, h, simbolo) {
  if (h.marcas.length === 0) return reemplazarEn(texto, h.viñeta, texto.split('\n')[h.viñeta].length, 0, ` ${simbolo}`);
  // de derecha a izquierda, para que una sustitución no mueva las columnas de la siguiente
  return [...h.marcas].sort((a, b) => b.linea - a.linea || b.col - a.col)
    .reduce((t, m) => reemplazarEn(t, m.linea, m.col, m.bruto.length, simbolo), texto);
}
/** Un estado que, puesto SOLO en el resumen de este hito, tiene que contradecir a su viñeta. */
function estadoQueContradice(h) {
  return h.detalle.length === 0 ? HECHO : ESTADOS.find((s) => !h.detalle.includes(s));
}
/** Sustituye un literal que tiene que estar UNA vez: una mutación que no se aplica no es un caso. */
function cambiar(texto, viejo, nuevo) {
  assert.equal(texto.split(viejo).length - 1, 1, `la mutación necesita «${viejo}» exactamente una vez`);
  return texto.replace(viejo, () => nuevo);
}

const historico = () => fs.readFileSync(FIXTURE, 'utf8');
const real = () => fs.readFileSync(MASTER, 'utf8');

// ═════════════════════════════════════════════════════════════════════════════════════════
// EL ÁRBOL DE VERDAD
// ═════════════════════════════════════════════════════════════════════════════════════════

/**
 * Lo que el test ① hace y DICE en cada pasada. Es una función con nombre para que su salida se
 * pueda fijar (⑫ y ⑬): una salida que nadie fija desaparece en la siguiente edición sin que nadie
 * se entere, y aquí la salida es el único sitio donde el guard confiesa lo que NO comprueba.
 */
function veLosDosSitios(texto) {
  const r = compararResumenYDetalle(texto);
  console.log(`  [SCRUM-1323] población: ${r.hitos.length} hitos de ${SECCION} · `
    + r.hitos.map((h) => `${h.id} ${h.resumen}/${h.detalle.join('') || '—'}`).join(' · '));
  // Límite a): una viñeta sin símbolo solo prohíbe el ✅. Esos hitos NO se comparan contra nada, y
  // un «25/25 verde» sin esta línea se lee como «los diez están vigilados». Sale SIEMPRE, también
  // con cero: que no salga no puede significar «ninguno».
  const mudas = r.hitos.filter((h) => h.detalle.length === 0).map((h) => h.id);
  console.log(`  [SCRUM-1323] ⚠️ SIN COMPROBAR contra su viñeta: ${mudas.length} de ${r.hitos.length} hitos`
    + ` (${mudas.join(', ') || 'ninguno'}) — su viñeta no lleva símbolo de estado; ahí solo se prohíbe ${HECHO}`);
  const varios = r.hitos.filter((h) => h.detalle.length > 1).map((h) => h.id);
  if (varios.length) console.log(`  [SCRUM-1323] ⚠️ comparados solo por pertenencia (viñeta con varios símbolos): ${varios.join(', ')}`);

  assert.deepEqual(r.problemas, [],
    '🔴 NO PUEDO LEER EL ESTADO DE SIF-1 EN EL MÁSTER, y sin leerlo no vigilo nada:\n' + pinta(r)
    + '\n\n  Esto NO dice que el máster se contradiga: dice que su formato ha cambiado y este guard se'
    + '\n  ha quedado ciego. Se arregla enseñándole el formato nuevo a este fichero, no al revés.');
  assert.ok(r.hitos.length > 0, 'población vacía: no hay nada comparado');
  assert.equal(r.hitos.filter((h) => h.resumen !== null).length, r.hitos.length,
    'hay hitos sin estado leído en el resumen');
  return r;
}

test('SCRUM-1323 ① · el instrumento VE los dos sitios del máster: población declarada y ningún hito sin leer', () => {
  veLosDosSitios(real());
});

test('SCRUM-1323 ② · el resumen de SIF-1 y la viñeta de cada hito dicen el MISMO estado', () => {
  const r = compararResumenYDetalle(real());
  assert.deepEqual(r.contradicciones.map((c) => c.por), [],
    '🔴 EL MÁSTER SE CONTRADICE CONSIGO MISMO EN EL ESTADO DE SIF-1:\n    '
    + r.contradicciones.map((c) => c.por).join('\n    ')
    + `\n\n  El resumen de la Parte U («> **…** (${SECCION}): …») y la viñeta del hito bajo «### ${SECCION}»`
    + '\n  tienen que llevar el mismo símbolo. Corrige el que esté mal —los dos a la vez si el hito ha'
    + '\n  cambiado de estado— con la autorización que pide un cambio de máster. No se toca este guard.');
});

test('SCRUM-1323 ③ · sobre el máster de hoy, cambiar el estado de CADA hito solo en el resumen cae; en los dos sitios, pasa', () => {
  const texto = real().replace(/\r\n/g, '\n');
  const base = compararResumenYDetalle(texto);
  assert.deepEqual(base.problemas, [], 'sin base legible no hay mutación que valga:\n' + pinta(base));
  assert.ok(base.hitos.length > 0, 'población vacía');
  const yaRotos = ids(base);

  let probados = 0;
  for (const h of base.hitos) {
    if (yaRotos.includes(h.id)) continue; // su rojo lo da ②; aquí no distinguiría nada
    const otro = estadoQueContradice(h);
    assert.ok(otro && otro !== h.resumen, `${h.id}: no encuentro un estado con el que contradecir a ${h.detalle.join(' ')}`);

    const soloResumen = conResumen(texto, h, otro);
    assert.notEqual(soloResumen, texto, `${h.id}: la mutación del resumen no se aplicó`);
    assert.deepEqual(ids(compararResumenYDetalle(soloResumen)), [...yaRotos, h.id].sort(),
      `🔴 ${h.id}: el resumen pasa a ${otro}, su viñeta sigue en «${h.detalle.join(' ') || 'sin símbolo'}» y el guard NO cae`);

    const losDos = conDetalle(soloResumen, h, otro);
    assert.notEqual(losDos, soloResumen, `${h.id}: la mutación del detalle no se aplicó`);
    const r = compararResumenYDetalle(losDos);
    assert.deepEqual([motivos(r), ids(r)], [[], yaRotos],
      `🔴 ${h.id}: cambiado a ${otro} EN LOS DOS SITIOS, el guard cae. Así impediría corregir el máster.`);
    probados++;
  }
  console.log(`  [SCRUM-1323] mutaciones: ${probados} hitos × 2 (solo resumen → rojo · los dos sitios → verde); ${yaRotos.length} ya en rojo sin mutar`);
  assert.equal(probados + yaRotos.length, base.hitos.length);
});

test('SCRUM-1323 ④ · mover el resumen y la sección de sitio no cambia nada: se localizan por identidad, no por línea', () => {
  const texto = real().replace(/\r\n/g, '\n');
  const quita = (r) => r.hitos.map((h) => [h.id, h.resumen, h.detalle]);
  const base = compararResumenYDetalle(texto);
  const movido = compararResumenYDetalle('relleno\n'.repeat(137) + texto);
  assert.ok(base.hitos.length > 0, 'población vacía');
  assert.equal(movido.hitos[0].viñeta - base.hitos[0].viñeta, 137, 'el relleno no desplazó la sección');
  assert.deepEqual([quita(movido), ids(movido), motivos(movido)], [quita(base), ids(base), motivos(base)]);
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// EL CASO REAL: el máster de `origin/main` antes de SCRUM-1319
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-1323 ⑤ · el extracto histórico es el de git: sus bytes no se han tocado', () => {
  const bytes = fs.readFileSync(FIXTURE);
  assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'), SHA_FIXTURE,
    'el extracto ha cambiado (¿un editor le puso BOM o CRLF?). Se regenera desde git, no a mano: '
    + 'la receta está en docs/master/SCRUM-1323.md');
});

test('SCRUM-1323 ⑥ · ROJO REAL: con el resumen que estuvo quince días en `main`, cae y acusa a S1-D y solo a S1-D', () => {
  const r = compararResumenYDetalle(historico());
  assert.deepEqual(r.problemas, [], pinta(r));
  assert.equal(r.hitos.length, 10, 'el extracto histórico tiene 10 hitos');
  assert.deepEqual(r.contradicciones.map((c) => [c.id, c.resumen, c.detalle]), [['S1-D', '✅', []]]);
  // el ✅ de una PARTE del hito no es el estado del hito: S1-0 lleva «cert FNMT ✅» en su paréntesis
  assert.equal(r.hitos.find((h) => h.id === 'S1-0').resumen, '🟡');
});

test('SCRUM-1323 ⑦ · el arreglo tal como lo hizo SCRUM-1319 (`~~✅~~ 🟡`) pasa: lo tachado no es el estado', () => {
  const r = compararResumenYDetalle(cambiar(historico(), 'S1-D ✅ DECIDIDO', 'S1-D ~~✅~~ 🟡 NO HECHO — la VÍA está DECIDIDA'));
  assert.deepEqual([motivos(r), ids(r)], [[], []]);
  assert.equal(r.hitos.find((h) => h.id === 'S1-D').resumen, '🟡');
});

test('SCRUM-1323 ⑧ · el otro arreglo posible —dar el hito por hecho EN SU VIÑETA— también pasa, diga lo que diga la prosa', () => {
  for (const prosa of ['**✅ DONE 15-oct-26**', '✅ HECHO', '(cerrado ✅)']) {
    const r = compararResumenYDetalle(cambiar(historico(), 'aceptados consecutivos.', `aceptados consecutivos. ${prosa}`));
    assert.deepEqual([motivos(r), ids(r)], [[], []], `con «${prosa}» en la viñeta de S1-D`);
  }
});

test('SCRUM-1323 ⑨ · la contradicción al revés también cae: la viñeta cambia de estado y el resumen no', () => {
  const r = compararResumenYDetalle(cambiar(historico(), '**🟡 BORRADOR 13-jun-26:** plantilla', '**✅ DONE:** plantilla'));
  assert.deepEqual(ids(r), ['S1-D', 'S1-E']);
  assert.deepEqual(r.contradicciones[1].detalle, ['✅']);
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// NI MUDO NI CIEGO: cada forma de no encontrar lo que busca es un problema con nombre
// ═════════════════════════════════════════════════════════════════════════════════════════

const CIEGOS = [
  ['el resumen desaparece', 'SIN_RESUMEN',
    (t) => cambiar(t, '> **SIF-1** (U1.3):', '> **SIF-1**:')],
  ['el resumen está dos veces', 'RESUMEN_DUPLICADO',
    (t) => t + '\n> **SIF-1** (U1.3): S1-A ✅\n'],
  ['la sección de detalle desaparece', 'SIN_SECCION',
    (t) => cambiar(t, '### U1.3 · SIF-1', '### SIF-1')],
  ['la sección está dos veces', 'SECCION_DUPLICADA',
    (t) => t + '\n### U1.3 · SIF-1 otra vez\n'],
  ['la sección con ese código es de otro sprint', 'SECCION_DE_OTRO',
    (t) => cambiar(t, '### U1.3 · SIF-1 v2', '### U1.3 · CONNECT-1')],
  ['la sección se queda sin viñetas', 'SIN_HITOS',
    (t) => t.split('\n').filter((l) => !l.startsWith('- ')).join('\n')],
  ['una viñeta deja de llevar el identificador en negrita', 'VIÑETA_ILEGIBLE',
    (t) => cambiar(t, '- **S1-F · Revisión', '- S1-F · Revisión')],
  ['un hito del resumen no tiene viñeta', 'HITO_SIN_DETALLE',
    (t) => cambiar(t, 'S1-H 🟡 (', 'S1-H 🟡 ( · S1-I ⏳ (')],
  ['un hito con viñeta no está en el resumen', 'HITO_SIN_RESUMEN',
    (t) => cambiar(t, ' · S1-F ⏳ (revisión asesor)', '')],
  ['un hito pierde el símbolo en el resumen', 'SIN_SIMBOLO',
    (t) => cambiar(t, 'S1-F ⏳ (revisión asesor)', 'S1-F pendiente (revisión asesor)')],
  ['el símbolo ya no va pegado al identificador', 'SIN_SIMBOLO',
    (t) => cambiar(t, 'S1-F ⏳ (revisión asesor)', 'S1-F (revisión asesor) ⏳')],
  ['un hito lleva un símbolo que no es un estado conocido', 'SIMBOLO_DESCONOCIDO',
    (t) => cambiar(t, 'S1-F ⏳ (revisión asesor)', 'S1-F 🚧 (revisión asesor)')],
  ['el resumen da dos estados al mismo hito', 'RESUMEN_AMBIGUO',
    (t) => cambiar(t, 'S1-F ⏳ (revisión asesor)', 'S1-F ⏳ (revisión asesor) · S1-F ✅')],
  ['dos viñetas para el mismo hito', 'HITO_DUPLICADO',
    (t) => cambiar(t, '- **S1-G · Evidencias:**', '- **S1-F · Evidencias:**')],
  ['un tachado sin cerrar en el resumen', 'TACHADO_ABIERTO',
    (t) => cambiar(t, 'S1-F ⏳ (revisión asesor)', 'S1-F ~~✅ ⏳ (revisión asesor)')],
];

const caso2 = casosEscritos(CIEGOS, ([caso, motivo, mutar]) => `SCRUM-1323 ⑩ · si ${caso}, lo DICE (${motivo}) en vez de pasar`, ([caso, motivo, mutar]) => {
  const antes = historico();
  const despues = mutar(antes);
  assert.notEqual(despues, antes, 'la mutación no se aplicó');
  assert.ok(motivos(compararResumenYDetalle(despues)).includes(motivo),
    `esperaba ${motivo} y dijo: ${JSON.stringify(motivos(compararResumenYDetalle(despues)))}`);
});
test('SCRUM-1323 ⑩ · si el resumen desaparece, lo DICE (SIN_RESUMEN) en vez de pasar', caso2(0));
test('SCRUM-1323 ⑩ · si el resumen está dos veces, lo DICE (RESUMEN_DUPLICADO) en vez de pasar', caso2(1));
test('SCRUM-1323 ⑩ · si la sección de detalle desaparece, lo DICE (SIN_SECCION) en vez de pasar', caso2(2));
test('SCRUM-1323 ⑩ · si la sección está dos veces, lo DICE (SECCION_DUPLICADA) en vez de pasar', caso2(3));
test('SCRUM-1323 ⑩ · si la sección con ese código es de otro sprint, lo DICE (SECCION_DE_OTRO) en vez de pasar', caso2(4));
test('SCRUM-1323 ⑩ · si la sección se queda sin viñetas, lo DICE (SIN_HITOS) en vez de pasar', caso2(5));
test('SCRUM-1323 ⑩ · si una viñeta deja de llevar el identificador en negrita, lo DICE (VIÑETA_ILEGIBLE) en vez de pasar', caso2(6));
test('SCRUM-1323 ⑩ · si un hito del resumen no tiene viñeta, lo DICE (HITO_SIN_DETALLE) en vez de pasar', caso2(7));
test('SCRUM-1323 ⑩ · si un hito con viñeta no está en el resumen, lo DICE (HITO_SIN_RESUMEN) en vez de pasar', caso2(8));
test('SCRUM-1323 ⑩ · si un hito pierde el símbolo en el resumen, lo DICE (SIN_SIMBOLO) en vez de pasar', caso2(9));
test('SCRUM-1323 ⑩ · si el símbolo ya no va pegado al identificador, lo DICE (SIN_SIMBOLO) en vez de pasar', caso2(10));
test('SCRUM-1323 ⑩ · si un hito lleva un símbolo que no es un estado conocido, lo DICE (SIMBOLO_DESCONOCIDO) en vez de pasar', caso2(11));
test('SCRUM-1323 ⑩ · si el resumen da dos estados al mismo hito, lo DICE (RESUMEN_AMBIGUO) en vez de pasar', caso2(12));
test('SCRUM-1323 ⑩ · si dos viñetas para el mismo hito, lo DICE (HITO_DUPLICADO) en vez de pasar', caso2(13));
test('SCRUM-1323 ⑩ · si un tachado sin cerrar en el resumen, lo DICE (TACHADO_ABIERTO) en vez de pasar', caso2(14));
caso2.todos();

test('SCRUM-1323 ⑪ · un texto que no es el máster no da verde: da problemas y población cero', () => {
  for (const t of ['', '# otro documento\n\n- **S1-A** ✅\n']) {
    const r = compararResumenYDetalle(t);
    assert.deepEqual([motivos(r), r.hitos.length, r.contradicciones.length], [['SIN_RESUMEN', 'SIN_SECCION'], 0, 0]);
  }
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// LO QUE EL GUARD DICE DE SÍ MISMO: la salida de ①, fijada
//
// ① imprime qué hitos NO compara (viñeta sin símbolo) y cuáles compara solo por pertenencia (viñeta
// con varios). Esas dos líneas son el límite del guard dicho donde se lee el verde. Aquí se corre
// LA MISMA función que corre ①, con `console.log` cambiado por un cuaderno mientras dura: quitar
// cualquiera de las dos líneas, o vaciarlas de nombres, hace caer esto.
//
// 🔴 LÍMITE: ⑫ y ⑬ fijan LO QUE LA FUNCIÓN DICE, no QUE ① LA SIGA LLAMANDO. Esa llamada es una
// línea, y está a la vista justo debajo de la función. No se cierra con un proceso hijo que corra
// este fichero y lea su salida: un hijo de `node --test` hereda el contexto del padre y en CI pisa
// el TAP de la tanda (SCRUM-1308). Quien quiera cerrarlo, que lo cierre por AST —comprobar que el
// cuerpo de ① llama a `veLosDosSitios`—, que no toca procesos. Decidido por el orquestador, 1-oct.
// ═════════════════════════════════════════════════════════════════════════════════════════

/** Lo que `fn` manda a `console.log` mientras corre. El original vuelve aunque `fn` lance. */
function loQueDice(fn) {
  const dicho = [];
  const original = console.log;
  console.log = (...a) => { dicho.push(a.join(' ')); };
  try { fn(); } finally { console.log = original; }
  return dicho;
}
/** La ÚNICA línea de la salida que lleva esa marca; si hay otra cuenta, cae diciendo cuántas. */
function laLinea(dicho, marca) {
  const con = dicho.filter((l) => l.includes(marca));
  assert.equal(con.length, 1, `esperaba UNA línea con «${marca}» en la salida de ① y hay ${con.length}:\n    ${dicho.join('\n    ')}`);
  return con[0];
}
/** Los identificadores de hito que nombra una línea, en el orden en que salen. */
const nombrados = (linea) => linea.match(/(?<![\w-])S1-[0-9A-Za-z]+(?![\w-])/g) || [];

const SIN_COMPROBAR = 'SIN COMPROBAR contra su viñeta';
const POR_PERTENENCIA = 'comparados solo por pertenencia';
// El extracto histórico vale tal cual aunque lleve el rojo de S1-D: ① no juzga contradicciones
// (eso es ②), solo exige que no haya PROBLEMAS de lectura, y el extracto no los tiene (⑥).

test('SCRUM-1323 ⑫ · ① DICE, con sus nombres, los hitos que NO comprueba: 4 de 10 en el extracto, y los del máster de hoy', () => {
  // ── el extracto histórico: bytes congelados, así que los nombres van literales ──
  const linea = laLinea(loQueDice(() => veLosDosSitios(historico())), SIN_COMPROBAR);
  assert.deepEqual(nombrados(linea), ['S1-0', 'S1-D', 'S1-F', 'S1-G']);
  assert.ok(linea.includes('4 de 10 hitos'), `la línea no da la cuenta sobre la población: «${linea}»`);

  // ── la línea se mueve con el dato: S1-F gana un símbolo en su viñeta y deja de salir ──
  const conF = cambiar(historico(), 'Entregable: conformidad archivada.', 'Entregable: conformidad archivada. ⏳');
  const lineaF = laLinea(loQueDice(() => veLosDosSitios(conF)), SIN_COMPROBAR);
  assert.deepEqual(nombrados(lineaF), ['S1-0', 'S1-D', 'S1-G']);
  assert.ok(lineaF.includes('3 de 10 hitos'), `«${lineaF}»`);

  // ── el máster de hoy: los nombres salen del comparador, no de una lista escrita aquí ──
  let r;
  const hoy = laLinea(loQueDice(() => { r = veLosDosSitios(real()); }), SIN_COMPROBAR);
  const mudas = r.hitos.filter((h) => h.detalle.length === 0).map((h) => h.id);
  assert.deepEqual(nombrados(hoy), mudas);
  assert.ok(hoy.includes(`${mudas.length} de ${r.hitos.length} hitos`), `«${hoy}»`);
});

test('SCRUM-1323 ⑫ · con CERO hitos sin comprobar la línea sale igual y dice «ninguno»: su ausencia no puede leerse como «todos vigilados»', () => {
  // cada viñeta muda recibe el símbolo que ya lleva su hito en el resumen (S1-D, el ✅ histórico)
  const base = compararResumenYDetalle(historico());
  const mudas = base.hitos.filter((h) => h.detalle.length === 0);
  assert.equal(mudas.length, 4, 'el extracto tiene 4 viñetas sin símbolo');
  const todas = mudas.reduce((t, h) => conDetalle(t, h, h.resumen), historico());
  const linea = laLinea(loQueDice(() => veLosDosSitios(todas)), SIN_COMPROBAR);
  assert.deepEqual(nombrados(linea), []);
  assert.ok(linea.includes('0 de 10 hitos (ninguno)'), `«${linea}»`);
});

test('SCRUM-1323 ⑬ · una viñeta con DOS símbolos sin tachar pasa por pertenencia, y ① lo DICE con el nombre del hito', () => {
  // El caso probable: S1-E y S1-H llevan «🟡 BORRADOR». Alguien añade «✅ DONE» y no tacha el 🟡.
  const dos = cambiar(historico(), '**🟡 BORRADOR 13-jun-26:** plantilla', '**🟡 BORRADOR 13-jun-26 · ✅ DONE 15-oct-26:** plantilla');
  const r = compararResumenYDetalle(dos);
  assert.deepEqual(r.hitos.find((h) => h.id === 'S1-E').detalle, ['🟡', '✅']);
  assert.deepEqual(ids(r), ['S1-D'], 'el límite b): el resumen sigue en 🟡 y S1-E NO cae (S1-D es el rojo del extracto)');
  assert.deepEqual(nombrados(laLinea(loQueDice(() => veLosDosSitios(dos)), POR_PERTENENCIA)), ['S1-E']);

  // ── el control: la misma edición TACHANDO el 🟡 ya no es de pertenencia — cae, y el aviso no sale ──
  const tachado = cambiar(historico(), '**🟡 BORRADOR 13-jun-26:** plantilla', '**~~🟡 BORRADOR 13-jun-26~~ · ✅ DONE 15-oct-26:** plantilla');
  assert.deepEqual(ids(compararResumenYDetalle(tachado)), ['S1-D', 'S1-E']);
  for (const [caso, texto] of [['tachando el 🟡', tachado], ['sin tocar nada', historico()]]) {
    const dicho = loQueDice(() => veLosDosSitios(texto));
    assert.equal(dicho.filter((l) => l.includes(POR_PERTENENCIA)).length, 0, `${caso}: el aviso de pertenencia sale sin viñeta con dos símbolos`);
    laLinea(dicho, SIN_COMPROBAR); // y la salida no está vacía: la otra línea sí está
  }
});
