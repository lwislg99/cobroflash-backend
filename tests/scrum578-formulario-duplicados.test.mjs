// tests/scrum578-formulario-duplicados.test.mjs — SCRUM-578 (CONT-05, punto a + el aviso)
//
// LOS CUATRO CONTROLES **DESDE LA UI**, no desde el módulo de dominio.
//
// El dominio ya está probado en `scrum578-duplicados-identificador.test.mjs`. Aquí se comprueba
// lo que aquel no puede: que el formulario PIDE lo que tiene que pedir, que el aviso aparece y
// desaparece por los motivos correctos, y que el selector de prefijo existe de verdad.
//
// ⚠️ Los 9 guards de navegador NO cubren este formulario (SCRUM-628). Ésta es la única cobertura
// que tiene, así que lleva sus suelos: un banco que no monta nada da verde igual que un producto
// correcto.
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { createRequire } from 'node:module';
import { telefonoDePrueba } from '../scripts/_telefonos-prueba.mjs';

const RAIZ = path.resolve(import.meta.dirname, '..');
const require_ = createRequire(import.meta.url);
const prefijos = require_(path.join(RAIZ, 'public/dashboard/js/prefijosPais.js'));

const COMPLETO = telefonoDePrueba(12345678); // 34012345678
const NACIONAL = COMPLETO.slice(2);          // 012345678

// ── EL SELECTOR DE PREFIJO (punto a) ─────────────────────────────────────────────────────

test('SCRUM-578 · SUELO: el módulo de prefijos responde y trae países de verdad', () => {
  const lista = prefijos.listaDePrefijos();
  assert.ok(Array.isArray(lista) && lista.length >= 150,
    `🔴 la lista trae ${lista && lista.length} países: o se ha recortado, o el módulo no monta`);
  assert.equal(new Set(lista.map((p) => p.iso)).size, lista.length, '🔴 hay ISO repetidos');
});

test('SCRUM-578 · 🔴 España va PRIMERA (España-first no es una preferencia: es el máster)', () => {
  const lista = prefijos.listaDePrefijos();
  assert.equal(lista[0].iso, 'ES', '🔴 España no es la primera opción del selector');
  assert.equal(lista[0].prefijo, '34');
});

test('SCRUM-578 · el resto va ORDENADO por nombre, no por código', () => {
  // Un desplegable de 222 países ordenado por ISO es inservible: nadie busca «DE» para Alemania.
  const resto = prefijos.listaDePrefijos().slice(1).map((p) => p.nombre);
  const ordenado = [...resto].sort((a, b) => a.localeCompare(b, 'es'));
  assert.deepEqual(resto, ordenado, '🔴 el resto de países no está ordenado por nombre');
});

test('SCRUM-578 · la bandera se CALCULA del ISO — cero imágenes, cero peticiones', () => {
  // Dos indicadores regionales. Si esto dejara de funcionar habría que descargar banderas, y el
  // presupuesto de peso (Parte AB) es justo lo que este diseño existe para respetar.
  assert.equal(prefijos.banderaDe('ES'), '\u{1F1EA}\u{1F1F8}');
  assert.equal(prefijos.banderaDe('FR'), '\u{1F1EB}\u{1F1F7}');
  // Y no revienta con basura: devuelve vacío en vez de un carácter inventado.
  assert.equal(prefijos.banderaDe('X'), '');
  assert.equal(prefijos.banderaDe(null), '');
});

test('SCRUM-578 · el nombre lo pone el navegador, y nada revienta el selector', () => {
  assert.equal(prefijos.nombreDe('ES'), 'España');
  // ⚠️ `ZZ` NO sirve para probar el respaldo: es un código VÁLIDO de ICU y devuelve «Región
  // desconocida». Lo escribí creyendo lo contrario y el test cayó — la suposición era mía.
  assert.equal(prefijos.nombreDe('ZZ'), 'Región desconocida');

  // Y el invariante que de verdad importa, que además cubre los 222 de golpe: NINGUNA opción del
  // selector puede quedarse sin rótulo. Un desplegable con huecos es peor que uno en inglés.
  for (const p of prefijos.listaDePrefijos()) {
    assert.equal(typeof p.nombre, 'string', `🔴 ${p.iso} no tiene nombre`);
    assert.ok(p.nombre.length > 0, `🔴 ${p.iso} deja su opción sin rótulo`);
    assert.ok(p.prefijo.length > 0, `🔴 ${p.iso} no tiene prefijo`);
  }

  // Entrada basura: no revienta. Devolver vacío es aceptable —ese ISO no está en la tabla— pero
  // lanzar dejaría el selector sin montar y el formulario sin teléfono.
  for (const malo of ['', null, undefined, '??']) {
    assert.equal(typeof prefijos.nombreDe(malo), 'string', `🔴 nombreDe(${JSON.stringify(malo)}) revienta`);
  }
});

test('SCRUM-578 · SUELO: el selector se construye y trae las 222 opciones', () => {
  const doc = { createElement: (t) => nodoDeMentira(t) };
  const sel = prefijos.selectorDePrefijo({ doc });
  assert.ok(sel, '🔴 el selector no se construye');
  assert.equal(sel.hijos.length, prefijos.listaDePrefijos().length, '🔴 faltan opciones');
  assert.equal(sel.value, '34', '🔴 no arranca en España');
  // Y cada opción lleva las tres cosas: bandera, nombre y prefijo.
  const primera = sel.hijos[0]._texto;
  assert.ok(primera.includes('España'), '🔴 la opción no lleva nombre');
  assert.ok(primera.includes('+34'), '🔴 la opción no lleva prefijo');
  assert.ok(primera.startsWith(prefijos.banderaDe('ES')), '🔴 la opción no lleva bandera');
});

// ── LO QUE EL FORMULARIO PIDE Y ENVÍA ────────────────────────────────────────────────────

const fuenteBruta = require_('node:fs')
  .readFileSync(path.join(RAIZ, 'public/dashboard/js/customersView.js'), 'utf8');

/**
 * 🔴 SOLO EL CÓDIGO. Sin esto, los guards de abajo SE CAZAN A SÍ MISMOS en los comentarios que
 * explican la prohibición — me pasó al escribirlos: el comentario que dice «el rótulo
 * “E.164 sin +” describía un campo que ya no existe» hacía caer al guard que comprueba que ese
 * rótulo no está, y el que explica el `|| "34"` hacía caer al que lo prohíbe.
 *
 * Es la misma lección de SCRUM-574, y por eso se quitan las líneas de comentario Y los
 * comentarios al final de línea: quitar solo las que empiezan por `//` no basta.
 */
const fuenteVista = fuenteBruta
  .split(/\r?\n/)
  .filter((l) => !l.trimStart().startsWith('//'))
  .map((l) => l.replace(/\s*\/\/.*$/, ''))
  .join('\n');

test('SCRUM-578 · SUELO: se ha leído la vista de verdad', () => {
  assert.ok(fuenteBruta.length > 5000, '🔴 no he leído customersView.js: nada de lo de abajo mediría');
  assert.ok(fuenteVista.includes('renderCustomersView'), '🔴 no es el fichero que creo');
  // Y que el filtrado de comentarios NO se ha llevado el codigo por delante.
  assert.ok(fuenteVista.length > fuenteBruta.length * 0.4,
    '🔴 el filtro de comentarios ha borrado casi todo: los guards de abajo medirían sobre nada');
  assert.ok(fuenteVista.includes('function telefonoCompleto'), '🔴 el filtro se ha llevado codigo real');
});

test('SCRUM-578 · 🔴 ANTES: el rótulo «E.164 sin +» ya NO está — describía un campo que no existe', () => {
  // Era la prueba del ticket: una regla escrita en una etiqueta que el sistema no aplicaba. Con
  // el prefijo fuera, además, el texto es falso.
  assert.equal(
    fuenteVista.includes('E.164 sin +'), false,
    '🔴 sigue el rótulo viejo: describe un campo donde el prefijo iba dentro, y ya no va',
  );
});

test('SCRUM-578 · el NOMBRE nunca se envía a la comprobación de duplicados', () => {
  // La precisión 2 del fundador, vigilada donde se decide: en lo que el formulario pregunta.
  const bloque = fuenteVista.slice(
    fuenteVista.indexOf('async function comprobarDuplicados'),
    fuenteVista.indexOf('function buildModal'),
  );
  assert.ok(bloque.length > 200, '🔴 SUELO: no encuentro la función, este guard no mide nada');
  assert.ok(bloque.includes('params.set("phone"'), '🔴 SUELO: el bloque no es el que creo');
  assert.equal(
    /params\.set\(\s*["']name["']/.test(bloque), false,
    '🔴 el NOMBRE se está enviando: el aviso saltaría con cada «María García» y sería ruido',
  );
});

test('SCRUM-578 · 🔴 el aviso NO se queda encendido si la comprobación falla', () => {
  // Enseñar «duplicado» porque se cayó la red es peor que no enseñarlo: acusa de algo que nadie
  // ha comprobado. El `catch` tiene que APAGARLO.
  const bloque = fuenteVista.slice(
    fuenteVista.indexOf('async function comprobarDuplicados'),
    fuenteVista.indexOf('function buildModal'),
  );
  const catchIdx = bloque.indexOf('catch');
  assert.ok(catchIdx > 0, '🔴 SUELO: no hay catch en la comprobación');
  assert.ok(
    bloque.slice(catchIdx).includes('avisoDuplicado.hidden = true'),
    '🔴 si la comprobación falla, el aviso se queda encendido acusando sin haber comprobado',
  );
});

test('SCRUM-578 · 🔴 el aviso se APAGA al abrir el modal', () => {
  // Sin esto arrastraría el aviso del cliente anterior y acusaría de duplicado a uno que no lo es.
  const abrir = fuenteVista.slice(fuenteVista.indexOf('modalForm.reset();'));
  assert.ok(
    abrir.slice(0, 600).includes('avisoDuplicado.hidden = true'),
    '🔴 el aviso sobrevive al abrir el modal: acusaría al cliente siguiente',
  );
});

test('SCRUM-578 · el prefijo y el número se juntan SIN duplicar el prefijo', () => {
  // Al pegar un número copiado de WhatsApp («34012345678») con España elegida, concatenar daría
  // `3434012345678`, un teléfono que no existe.
  const bloque = fuenteVista.slice(
    fuenteVista.indexOf('function telefonoCompleto'),
    fuenteVista.indexOf('function repartirTelefono'),
  );
  assert.ok(bloque.includes('yaLoLleva'), '🔴 no se comprueba si el número ya trae el prefijo');
  assert.ok(bloque.includes('startsWith(prefijo)'), '🔴 la comprobación no mira el prefijo elegido');
});

test('SCRUM-578 · 🔴 el respaldo del prefijo NO es un literal escrito a mano', () => {
  // El guard de SCRUM-311 lo cazó: un `|| "34"` en la lectura de un control es un valor
  // inventado. Sale de la fuente declarada.
  const bloque = fuenteVista.slice(
    fuenteVista.indexOf('function telefonoCompleto'),
    fuenteVista.indexOf('function repartirTelefono'),
  );
  assert.equal(/\|\|\s*["']34["']/.test(bloque), false, '🔴 vuelve a haber un prefijo literal de respaldo');
  assert.ok(bloque.includes('prefijosPais.ESPANA.prefijo'), '🔴 el respaldo no sale de la fuente declarada');
});

// ── EL CONTROL QUE MÁS IMPORTA: EL VACÍO, DESDE LA UI ────────────────────────────────────

test('SCRUM-578 · 🔴 un cliente SIN teléfono no pregunta por duplicados', () => {
  // Es mi propio hallazgo del backend, vigilado en el otro extremo: `canon(null)` es "", así que
  // si el formulario preguntara con todo vacío, el servidor tendría que descartarlo. Aquí se
  // comprueba que NI SIQUIERA PREGUNTA — el aviso se apaga y no se gasta una petición.
  const bloque = fuenteVista.slice(
    fuenteVista.indexOf('async function comprobarDuplicados'),
    fuenteVista.indexOf('function buildModal'),
  );
  assert.ok(
    bloque.includes('if (!params.toString())'),
    '🔴 se pregunta por duplicados sin ningún identificador: el aviso podría saltar sobre nada',
  );
  const tras = bloque.slice(bloque.indexOf('if (!params.toString())'));
  assert.ok(tras.slice(0, 200).includes('hidden = true'), '🔴 sin identificadores el aviso no se apaga');
});

// ── ayuda ────────────────────────────────────────────────────────────────────────────────

/** Lo justo del DOM para montar un `<select>` y mirarlo. */
function nodoDeMentira(tag) {
  const n = {
    tagName: String(tag).toUpperCase(), className: '', name: '', value: '', hijos: [], _texto: '',
    appendChild(h) { n.hijos.push(h); return h; },
    addEventListener() {},
    get textContent() { return n._texto; },
    set textContent(v) { n._texto = String(v); },
  };
  return n;
}

// Se declara aquí para que el fixture del teléfono no quede sin usar y alguien lo borre creyendo
// que sobra: es el par de la evidencia, y lo usa el test de dominio hermano.
test('SCRUM-578 · el par de la evidencia sigue siendo el mismo número escrito de dos formas', () => {
  assert.equal(COMPLETO, '34' + NACIONAL);
  assert.notEqual(NACIONAL, '', '🔴 el fixture está vacío');
});
