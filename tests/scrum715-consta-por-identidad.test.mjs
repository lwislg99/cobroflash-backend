// tests/scrum715-consta-por-identidad.test.mjs — SCRUM-715
//
// LA VÍCTIMA: quien pregunte si un texto está aprobado y reciba un «sí» que nadie firmó.
//
// `constaAprobado()` casaba por SUBCADENA, y eso no era un riesgo teórico ni futuro: en el
// registro hay textos aprobados de DOS PALABRAS —«Mano de obra», «Materiales», «Guardar precios»,
// «Precio por unidad»— cuyas palabras aparecen en la prosa normal del propio registro. Preguntar
// por «Materiales del almacén central» contestaba «aprobado» porque «Materiales» está escrito en
// alguna frase. Un verde falso esperando, hoy.
//
// ── 🔒 UN PREFIJO NO ES UN NOMBRE, Y UNA SUBCADENA TAMPOCO ──────────────────────────────────
// Cuarta cara de la misma avería en una semana:
//   · `data-view="parte*"` cazando `partes-oficina` por PREFIJO
//   · `window.renderParte` cazando `renderPartesOficinaView` por PREFIJO
//   · un guard apuntando al ALIAS en vez de a la función
//   · esta SUBCADENA
// Siempre igual: el guard mira la FORMA y no el HECHO.
//
// EL MECANISMO NUEVO no busca dentro del texto del registro: EXTRAE las unidades en las que el
// registro escribe un literal aprobado —la celda de la columna «Texto aprobado», y la cita `>` en
// los ficheros de `docs/microcopy/`— y compara por IDENTIDAD. Los delimitadores no se inventan
// aquí: son los que el registro ya usaba, medidos antes de tocar nada.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import {
  constaAprobado, literalesAprobados, aprobacionesDeMicrocopy, REGISTRO_CONGELADO,
} from './_microcopy-aprobada.mjs';

// Los cuatro cortos que el fundador nombró, más el resto de los que se han firmado estos días.
// Se enumeran a propósito: si apretar el matching tirase una aprobación legítima, el arreglo
// estaría mal y este control lo diría por su nombre.
const APROBADOS = Object.freeze([
  'Mano de obra',
  'Materiales',
  'Guardar precios',
  'Precio por unidad',
  'Partes por valorar',
  'Tipo de intervención',
  'Reparación / Asistencia técnica',
  'Mantenimiento',
  'Instalación',
  'Cliente',
  'Dirección de la obra',
  'Qué hay que hacer',
  'Abrir trabajo',
  'Trabajo nuevo',
  'Sin especificar',
  'Elige un cliente.',
  'Primero necesitas un cliente.',
  'No se han podido cargar tus clientes.',
  'No se ha podido abrir el trabajo.',
  'No te queda ningún parte por valorar.',
  'No se ha podido abrir el parte. Vuelve a intentarlo.',
]);

// EL CASO QUE DECIDE EL TICKET. Textos que NADIE aprobó y que, sin embargo, están escritos dentro
// del registro: dos son TROZOS de literales aprobados y dos son prosa. Con subcadena, los cuatro
// salían «aprobados».
//
// ⚠️ Y OJO CON LA DIRECCIÓN, que es donde me equivoqué al primer intento: el mecanismo viejo
// buscaba la CONSULTA DENTRO DEL DOCUMENTO. Por eso una frase MÁS LARGA que el literal aprobado
// —«Materiales del almacén central»— no colaba: no está escrita en ninguna parte. Lo que colaba
// era lo contrario, una consulta CORTA que aparece en el registro. Un caso mal elegido habría
// pasado con los dos mecanismos y no habría probado nada.
const NO_APROBADOS = Object.freeze([
  'Vuelve a intentarlo',  // la cola de «No se ha podido abrir el parte. Vuelve a intentarlo.»
  'de obra',              // trozo de «Mano de obra», uno de los cortos que motivaron el ticket
  'Precio por',           // 🔒 PREFIJO de «Precio por unidad»: un prefijo no es un nombre
  'Libro registro',       // nombre de pantalla que aparece en prosa; nadie lo firmó como copy
]);

// Éstos tampoco están aprobados, pero NO discriminan: el mecanismo viejo tampoco los colaba,
// porque son más largos que el literal y no están escritos en el registro. Se comprueban igual
// —tienen que salir no aprobados— pero no sirven como prueba del arreglo, y queda dicho.
const NO_APROBADOS_QUE_NO_DISCRIMINAN = Object.freeze([
  'Materiales del almacén central',
  'Mano de obra especializada',
]);

/** El mecanismo VIEJO, tal cual era: buscar la aguja DENTRO del texto del documento. */
function constaPorSubcadena(aguja) {
  return aprobacionesDeMicrocopy()
    .filter((a) => a.texto.includes(String(aguja).trim()))
    .map((a) => a.ruta);
}

// ═══════════════════════════════════════════════════════════════════════════════════════════
// 🔴 EL ROJO QUE IMPORTA
// ═══════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-715 · 🔴 un texto de DOS PALABRAS que nadie aprobó sale NO APROBADO', () => {
  for (const t of [...NO_APROBADOS, ...NO_APROBADOS_QUE_NO_DISCRIMINAN]) {
    assert.deepEqual(constaAprobado(t), [],
      `🔴 «${t}» sale como APROBADO y nadie lo firmó. Casa porque un literal corto que sí está `
      + 'aprobado aparece dentro. Un «sí» que nadie firmó es peor que no tener buscador: la '
      + 'regla 30 dice que la microcopy la aprueba el fundador, y esto la elude sin querer.');
  }
});

test('SCRUM-715 · 🔴 Y CAE CON EL MECANISMO VIEJO: esos MISMOS textos pasaban en verde', () => {
  // Si el caso elegido no distinguiera los dos mecanismos, esta prueba no probaría nada.
  const colados = NO_APROBADOS.filter((t) => constaPorSubcadena(t).length > 0);
  assert.deepEqual(colados, NO_APROBADOS,
    '🔴 el caso NO discrimina: con subcadena tendrían que colarse LOS CUATRO y se cuelan '
    + `${colados.length}. Un caso que pasa con los dos mecanismos no prueba ninguno.`);

  // Y al revés, para que quede claro dónde está la diferencia: por identidad no se cuela ninguno.
  assert.deepEqual(NO_APROBADOS.filter((t) => constaAprobado(t).length > 0), []);
});

// ═══════════════════════════════════════════════════════════════════════════════════════════
// CONTROL POSITIVO — apretar el matching no puede tirar aprobaciones legítimas
// ═══════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-715 · ✅ CONTROL POSITIVO: las 21 aprobaciones se siguen encontrando, una a una', () => {
  const caidas = [];
  for (const t of APROBADOS) {
    const donde = constaAprobado(t);
    if (donde.length === 0) caidas.push(t);
  }
  assert.deepEqual(caidas, [],
    '🔴 APRETAR EL MATCHING HA TIRADO APROBACIONES LEGÍTIMAS, y eso es un arreglo mal hecho, no '
    + 'un efecto colateral aceptable. Se han perdido:\n    '
    + caidas.map((t) => JSON.stringify(t)).join('\n    ')
    + '\n    Mira en qué FORMA está escrita cada una en el registro: el extractor tiene que '
    + 'conocer el delimitador que usa, no al revés.');

  // Los cuatro cortos, nombrados aparte: son los que hacían falsa la versión anterior.
  for (const corto of ['Mano de obra', 'Materiales', 'Guardar precios', 'Precio por unidad']) {
    assert.ok(constaAprobado(corto).length >= 1,
      `🔴 «${corto}» es de los cortos que motivaron el ticket y ha dejado de encontrarse.`);
  }
});

test('SCRUM-715 · 🔴 SUELO: el extractor SACA literales, y un cero se declara ciego', () => {
  const todos = literalesAprobados();
  assert.ok(todos.length >= 100,
    `🔴 CIEGO: sólo ${todos.length} literales extraídos y hay 144 medidos. Con el extractor a `
    + 'medias, «no consta» dejaría de ser un veredicto y sería una ceguera.');
  assert.throws(() => constaAprobado(''), /CIEGO/,
    '🔴 la cadena vacía tiene que lanzar: casaría con todo y daría «aprobado» gratis.');
});

test('SCRUM-715 · las NOTAS del registro congelado no son textos aprobados', () => {
  // El registro usa `>` para avisos y advertencias. Si las citas contaran ahí, cada nota se
  // convertiría en un literal firmado por el fundador, que es justo lo que la regla 30 prohíbe.
  const congelado = aprobacionesDeMicrocopy().find((a) => a.origen === 'congelado');
  assert.ok(congelado, '🔴 no se está leyendo el registro congelado');

  const notas = fs.readFileSync(REGISTRO_CONGELADO, 'utf8')
    .split(/\r?\n/)
    .filter((l) => /^\s*>\s?\S/.test(l))
    .map((l) => l.replace(/^\s*>\s?/, '').trim())
    .filter((l) => l.length > 40);
  assert.ok(notas.length >= 5, `🔴 CIEGO: sólo ${notas.length} notas largas; el registro tiene muchas`);

  const coladas = notas.filter((n) => congelado.literales.includes(n));
  assert.deepEqual(coladas, [],
    `🔴 ${coladas.length} nota(s) del registro se están leyendo como texto aprobado. Una nota no `
    + 'la firmó nadie.');
});
