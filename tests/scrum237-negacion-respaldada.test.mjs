// tests/scrum237-negacion-respaldada.test.mjs — SCRUM-237
//
// GUARD PREVENTIVO: ninguna NEGACIÓN de la suite (un `assert.doesNotMatch` o `assert.ok(!…includes/
// test)`) puede quedarse sin RESPALDO. Nace del bug de scrum73 —un `doesNotMatch` sobre un token
// imposible (`RegistroFacturacionAltaType`, el TIPO del XSD, que no aparece jamás en el XML) que
// llevaba tiempo VERDE sin comprobar nada—. Ese bug fue ÚNICO (14 negaciones de salida revisadas a
// mano, 0 de su clase); esto es la red para que siga en cero.
//
// SALIDA (SCRUM-237 · A): por defecto imprime el RECUENTO por nivel + el DETALLE solo de las DÉBIL
// (que son las que hay que mirar). El ledger completo (44+ líneas) solo con YAQU_LEDGER_NEGACIONES=1
// — un ledger que se imprime siempre es ruido que entierra justo las DÉBIL.
//
// SUELO (SCRUM-237 · B): NO un entero a mano (el `total>=646` que aceptaba 713 siendo 745 nos enseñó
// lo que le pasa a esos). El suelo es auto-calibrado: (1) cero parse-errors sobre los ficheros
// descubiertos, (2) negaciones>0 y positivos>0, (3) un CANARIO positivo, y (4) la AUTOPRUEBA del
// analizador con corpus sintético — que demuestra que NO está ciego sin ningún número que mantener.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { analizarFuente, clasificar, analizarCorpus } from './_negacion-respaldo.mjs';

const DIR_TESTS = path.dirname(fileURLToPath(import.meta.url));

// Clasifica la PRIMERA negación de un fuente sintético (helper de la autoprueba).
function nivelDe(fuente) {
  const { negaciones, positivos, varsFuente } = analizarFuente(fuente);
  assert.equal(negaciones.length, 1, `el sintético debe tener 1 negación, tiene ${negaciones.length}`);
  return clasificar(negaciones[0], positivos, varsFuente).nivel;
}

// ─────────────────────────────────────────────────────────────────────────────────────
// AUTOPRUEBA DEL ANALIZADOR — el suelo real. Un analizador que nunca se vio clasificar no
// demuestra nada; estos casos prueban que distingue las cuatro formas y, sobre todo, que
// CAZA la clase de scrum73. Si el analizador se rompe, estos casos caen antes que el corpus.
// ─────────────────────────────────────────────────────────────────────────────────────
test('SCRUM-237 · autoprueba: HERMANO DEL TOKEN → FUERTE', () => {
  assert.equal(nivelDe(`
    assert.doesNotMatch(bodyOff, /RegistroAlta/);
    assert.match(bodyOn, /RegistroAlta/);
  `), 'FUERTE');
});

test('SCRUM-237 · autoprueba: SUJETO VERIFICADO por contenido → MEDIO', () => {
  assert.equal(nivelDe(`
    assert.doesNotMatch(message, /no disponible/i);
    assert.match(message, /tramos automáticos/i);
  `), 'MEDIO');
});

test('SCRUM-237 · autoprueba: sujeto = FUENTE leída → ESTRUCTURAL (mutation-test declarada)', () => {
  assert.equal(nivelDe(`
    const fuente = leerFuente(ruta);
    assert.doesNotMatch(fuente, /state\\.template\\s*=/);
  `), 'ESTRUCTURAL');
  // y por llamada directa a un lector de fuente:
  assert.equal(nivelDe(`assert.doesNotMatch(codigo('quotesView.js'), /_ts/);`), 'ESTRUCTURAL');
});

test('SCRUM-237 · autoprueba: token DINÁMICO sin sujeto verificado → DÉBIL (aceptado, no marcado)', () => {
  assert.equal(nivelDe(`assert.doesNotMatch(xmlSuelto, new RegExp(inv.number));`), 'DEBIL');
});

test('SCRUM-237 · autoprueba: char-class prohibida sin respaldo → DÉBIL (guard de patrón, no scrum73)', () => {
  assert.equal(nivelDe(`assert.doesNotMatch(id, /['@ ]/);`), 'DEBIL');
});

test('SCRUM-237 · autoprueba: EL BUG DE SCRUM73 (token concreto imposible, sin respaldo) → NINGUNO', () => {
  // Reconstrucción EXACTA del assert viejo: el token es el nombre del TIPO, que no aparece en NINGÚN
  // XML, ni con el flag ON. El positivo del fichero es del ELEMENTO (RegistroAlta), otro token. Sin
  // hermano, sin sujeto verificado (bodyOff no tiene positivo de contenido), no es fuente → NINGUNO.
  assert.equal(nivelDe(`
    assert.doesNotMatch(bodyOff, /RegistroFacturacionAltaType/);
    assert.match(bodyOn, /RegistroAlta/);
  `), 'NINGUNO');
  // Y la prueba de que NO es un falso positivo genérico: el MISMO assert con el token BUENO pasa.
  assert.equal(nivelDe(`
    assert.doesNotMatch(bodyOff, /RegistroAlta/);
    assert.match(bodyOn, /RegistroAlta/);
  `), 'FUERTE');
});

// ─────────────────────────────────────────────────────────────────────────────────────
// CORPUS REAL — barrido de todos los tests/*.test.mjs.
// ─────────────────────────────────────────────────────────────────────────────────────
const rutas = fs.readdirSync(DIR_TESTS)
  .filter((f) => f.endsWith('.test.mjs'))
  .map((f) => path.join(DIR_TESTS, f));

const corpus = analizarCorpus(rutas);

test('SCRUM-237 · suelo: el analizador NO está ciego (parse, presencia, canario)', () => {
  // (1) Cero parse-errors: un fichero que no parsea es un fichero NO mirado — fallo ruidoso, no skip.
  assert.deepEqual(corpus.parseErrors.map((p) => p.ruta), [],
    `🔴 ficheros que no parsean (el analizador NO los miró): ${corpus.parseErrors.map((p) => p.ruta + ' — ' + p.parseError).join(' · ')}`);
  // (2) Presencia: encontró negaciones Y positivos. Cero de cualquiera = analizador ciego.
  assert.ok(corpus.totalNeg > 0, '🔴 CERO negaciones encontradas — el barrido no ve nada');
  assert.ok(corpus.totalPos > 0, '🔴 CERO positivos encontrados — el barrido no ve los hermanos');
  // (3) Canario: la negación /RegistroAlta/ de scrum73 (la que TIENE hermano en :78) debe salir
  //     FUERTE. Si el analizador no la encuentra o la clasifica mal, está ciego o roto.
  const canario = corpus.items.find((i) => i.ruta.endsWith('scrum73-verifactu-gate.test.mjs') && i.token === 'RegistroAlta');
  assert.ok(canario, '🔴 CANARIO ausente: no se encontró la negación /RegistroAlta/ de scrum73');
  assert.equal(canario.nivel, 'FUERTE', `🔴 CANARIO mal clasificado: /RegistroAlta/ debería ser FUERTE (hermano en :78), salió ${canario?.nivel}`);
});

test('SCRUM-237 · ninguna negación de la suite se queda SIN respaldo (NINGUNO = 0)', () => {
  const s = corpus.stats;
  const debiles = corpus.items.filter((i) => i.nivel === 'DEBIL');
  const sinRespaldo = corpus.items.filter((i) => i.nivel === 'NINGUNO');

  // ── SALIDA (A): recuento por nivel SIEMPRE; detalle SOLO de las DÉBIL; ledger completo tras flag.
  const rel = (r) => path.relative(path.join(DIR_TESTS, '..'), r).replace(/\\/g, '/');
  process.stdout.write(
    `\n[SCRUM-237] ${corpus.totalNeg} negaciones · FUERTE ${s.FUERTE} · MEDIO ${s.MEDIO} · ` +
    `ESTRUCTURAL ${s.ESTRUCTURAL} · DÉBIL ${s.DEBIL} · NINGUNO ${s.NINGUNO}\n` +
    `  (ESTRUCTURAL = respaldo por mutation-test, NO verificada por este guard — declarada, no fingida)\n` +
    `  ⚠️ LÍMITE: las DÉBIL se ACEPTAN y NO tienen techo. Si esta lista crece mucho, DÉBIL se vuelve el\n` +
    `     vertedero de lo que no encaja y el guard vale MENOS de lo que parece. No hay ratchet a mano\n` +
    `     (los sabemos acabar mal); pero míralas de vez en cuando — un DÉBIL que sube sin parar es una señal.\n`);
  if (debiles.length) {
    process.stdout.write('  DÉBIL (aceptadas y declaradas — mirar si alguna debería reforzarse):\n');
    for (const d of debiles) process.stdout.write(`    · ${rel(d.ruta)}:${d.linea}  «${d.token}» — ${d.motivo}\n`);
  }
  if (process.env.YAQU_LEDGER_NEGACIONES === '1') {
    process.stdout.write('  LEDGER COMPLETO:\n');
    for (const i of corpus.items) process.stdout.write(`    [${i.nivel}] ${rel(i.ruta)}:${i.linea}  «${i.token}»\n`);
  }

  // ── El veredicto: rojo duro SOLO si hay NINGUNO (la clase de scrum73). Todo lo demás está respaldado.
  assert.deepEqual(
    sinRespaldo.map((i) => `${rel(i.ruta)}:${i.linea} «${i.token}»`),
    [],
    `🔴 SCRUM-237: negación(es) SIN NINGÚN respaldo (patrón scrum73 — verde permanente). ` +
    `Añade un hermano del token, verifica el sujeto por contenido, o —si es estructural— deja la ` +
    `mutation-test. NO subas un número: arregla la negación.`,
  );
});
