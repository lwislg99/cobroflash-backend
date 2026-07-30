// SCRUM-229 · el margen agregado en el pie de totales, y que las líneas ilegibles SE DIGAN.
//
// EL MOTIVO DEL TICKET, medido: `quotesView.js:1003` hace
//
//     const safeMarkup = Number.isFinite(markupPerc) ? markupPerc : 0;
//
// o sea que un margen NO NUMÉRICO se convierte en 0 en silencio y entra en el cálculo como si
// fuera un margen real de cero. La pantalla no distingue «margen 0 %» de «margen que no se pudo
// leer», y son cosas distintas: la primera es una decisión del profesional, la segunda es un
// dato que falta.
//
// Este fichero tiene DOS capas, y hacen falta las dos:
//
//   ① COMPORTAMIENTO — sobre las funciones puras de `quoteMargen.js`. Es la que prueba que una
//     línea ilegible produce «· 1 línea sin calcular» de verdad. Los guards históricos de
//     `quotesView.js` son estructurales sobre la fuente (es un módulo de navegador que
//     `node:test` no importa), y un guard de forma puede pasar mientras el comportamiento está
//     mal — que es exactamente el fallo que este ticket cierra.
//   ② ESTRUCTURA — sobre `quotesView.js`, para lo que la capa ① no puede ver: que el agregado se
//     acumule DENTRO del bucle que ya existe y no en un segundo recorrido, y que no se haya
//     tocado la aritmética de `safeMarkup`.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { leerFuente } from './_guard-texto.mjs'; // SCRUM-193

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PURO = path.join(RAIZ, 'public', 'dashboard', 'js', 'quoteMargen.js');
const VISTA = path.join(RAIZ, 'public', 'dashboard', 'js', 'quotesView.js');

// `quoteMargen.js` es un script clásico puro (ni DOM ni red): se evalúa y publica sus dos
// funciones en el objeto global que reciba. Así se prueba el COMPORTAMIENTO sin navegador.
const sandbox = {};
new Function('window', fs.readFileSync(PURO, 'utf8'))(sandbox);
const { margenDeLinea, textoMargen } = sandbox;

/** Formateador de dinero equivalente al `fmtMoneyEs` real, para no depender de la vista. */
const fmt = (n) => n.toFixed(2).replace('.', ',') + ' €';

// ── SUELO ANTI-VERDE-HUECO ────────────────────────────────────────────────────────────────
test('SCRUM-229 · las dos funciones puras existen y se pueden ejecutar (suelo)', () => {
  assert.equal(typeof margenDeLinea, 'function',
    '🔴 no se pudo cargar `margenDeLinea`: los asserts de abajo pasarían en vacío');
  assert.equal(typeof textoMargen, 'function', '🔴 no se pudo cargar `textoMargen`');
});

// ── ① COMPORTAMIENTO · el agregado ────────────────────────────────────────────────────────
test('SCRUM-229 · el margen de una línea es lo que el markup añade sobre el precio base', () => {
  // 2 × 50 € con 20 % de margen → coste 100 €, margen 20 €
  const r = margenDeLinea({ qtyRaw: '2', priceRaw: '50', markupRaw: '20' });
  assert.equal(r.calculable, true);
  assert.equal(r.coste, 100);
  assert.equal(r.importe, 20);
});

test('SCRUM-229 · el campo VACÍO es margen 0, no una línea sin calcular', () => {
  // `quotesView.js` normaliza el vacío a "0" antes de leerlo: es una decisión, no un dato que
  // falta. Contarlo como «sin calcular» pondría el aviso en casi todos los presupuestos.
  for (const vacio of ['', '   ', null, undefined]) {
    const r = margenDeLinea({ qtyRaw: '1', priceRaw: '100', markupRaw: vacio });
    assert.equal(r.calculable, true, `🔴 markup ${JSON.stringify(vacio)} se contó como ilegible`);
    assert.equal(r.importe, 0);
  }
});

test('SCRUM-229 · un markup NO NUMÉRICO no se cuenta como 0: se marca como no calculable', () => {
  for (const basura of ['abc', '--', '€', 'x20']) {
    const r = margenDeLinea({ qtyRaw: '1', priceRaw: '100', markupRaw: basura });
    assert.equal(
      r.calculable, false,
      `🔴 EL MARKUP ${JSON.stringify(basura)} SE TRAGÓ COMO 0.\n\n` +
        '  Es el fallo que este ticket cierra: un margen ilegible entra en el cálculo como si\n' +
        '  fuera un margen real de cero, y la pantalla no distingue «el profesional puso 0 %» de\n' +
        '  «no se pudo leer el dato». El primero es una decisión; el segundo, un dato que falta.',
    );
    assert.equal(r.importe, 0, 'una línea no calculable no aporta importe al agregado');
  }
});

test('SCRUM-229 · el LÍMITE: texto medio numérico SÍ cuenta, porque el total lo cuenta', () => {
  // Medido: `parseFloat` acepta el prefijo numérico — `"1,2,3"` → 1.2 y `"12abc"` → 12 son
  // FINITOS, así que `safeMarkup` los mete en el TOTAL con ese valor.
  //
  // El pie tiene que decir lo MISMO que el total. Marcarlos como «sin calcular» aquí sería más
  // estricto que el cálculo y produciría dos cifras que se contradicen en la misma pantalla —
  // peor que el fallo que este ticket cierra. El límite del ticket es explícito: NO se cambia el
  // comportamiento de `safeMarkup`; lo que cambia es que el pie lo dice.
  //
  // Que `parseFloat` acepte prefijos es un hallazgo propio y NO se arregla aquí: cambiarlo mueve
  // el TOTAL, que es otra decisión. Queda como límite declarado, no como olvido.
  for (const [valor, esperado] of [['1,2,3', 1.2], ['12abc', 12]]) {
    const r = margenDeLinea({ qtyRaw: '1', priceRaw: '100', markupRaw: valor });
    assert.equal(r.calculable, true, `🔴 ${JSON.stringify(valor)} debe contar igual que en el total`);
    assert.equal(r.importe, esperado, `🔴 el pie y el total deben usar el mismo markup para ${valor}`);
  }
});

// ── ① COMPORTAMIENTO · el texto, que es microcopy aprobado ────────────────────────────────
test('SCRUM-229 · valor normal: importe primero y porcentaje entre paréntesis', () => {
  const txt = textoMargen({ importe: 18, coste: 100, sinCalcular: 0 }, fmt);
  assert.equal(txt, '18,00 € (18 %)',
    '🔴 microcopy aprobado el 29-jul: «18,00 € (18 %)» — importe primero, % entre paréntesis, ' +
      'igual que el IVA de al lado. No se reformula (regla 30).');
});

test('SCRUM-229 · con líneas ilegibles lo DICE, y dice «sin calcular» — no «sin margen»', () => {
  const txt = textoMargen({ importe: 18, coste: 100, sinCalcular: 2 }, fmt);
  assert.equal(txt, '18,00 € · 2 líneas sin calcular',
    '🔴 microcopy aprobado: «18,00 € · 2 líneas sin calcular».');
  assert.ok(!/sin margen/i.test(txt),
    '🔴 «sin margen» se leería como margen CERO, que es la confusión que este ticket cierra. ' +
      'El fundador aprobó «sin calcular» a propósito.');
});

test('SCRUM-229 · el contador respeta singular y plural', () => {
  assert.match(textoMargen({ importe: 5, coste: 50, sinCalcular: 1 }, fmt), /· 1 línea sin calcular$/);
  assert.match(textoMargen({ importe: 5, coste: 50, sinCalcular: 2 }, fmt), /· 2 líneas sin calcular$/);
  assert.match(textoMargen({ importe: 5, coste: 50, sinCalcular: 11 }, fmt), /· 11 líneas sin calcular$/);
});

test('SCRUM-229 · con líneas ilegibles se OMITE el porcentaje', () => {
  // Un porcentaje agregado calculado sobre una parte de las líneas se leería como el del
  // presupuesto entero. Mejor no darlo que darlo mal.
  const txt = textoMargen({ importe: 18, coste: 100, sinCalcular: 1 }, fmt);
  assert.ok(!/%/.test(txt), '🔴 el % sobre datos incompletos se lee como si fuera el del total');
});

// ── ② ESTRUCTURA · lo que el comportamiento no puede ver ──────────────────────────────────
const src = leerFuente(VISTA);

test('SCRUM-229 · el agregado se acumula DENTRO del recorrido que ya existe', () => {
  assert.match(src, /margenDeLinea\(/,
    '🔴 el pie no llama a `margenDeLinea`: o no está hecho, o se reimplementó el cálculo aparte');

  // UN solo `lines.forEach` en `recalcTotals`: un segundo recorrido acabaría dando otra cifra.
  const cuerpo = src.slice(src.indexOf('function recalcTotals()'), src.indexOf('function renderPreview()'));
  const recorridos = (cuerpo.match(/lines\.(forEach|map|reduce|filter)\(/g) || []).length;
  assert.equal(
    recorridos, 1,
    `🔴 hay ${recorridos} recorridos de \`lines\` en recalcTotals (debe haber 1).\n` +
      '  Dos recorridos distintos sobre las mismas líneas acaban dando dos cifras distintas: es\n' +
      '  la misma disciplina que SCRUM-228 (partición sobre las mismas listas, no consulta aparte).',
  );
});

test('SCRUM-229 · NO se cambia el comportamiento de `safeMarkup` en el total', () => {
  // Límite explícito del ticket: lo que cambia es que el pie lo DICE, no cómo se calcula el
  // total. Tocar esto es otra decisión y otro ticket.
  assert.match(
    src, /const\s+safeMarkup\s*=\s*Number\.isFinite\(markupPerc\)\s*\?\s*markupPerc\s*:\s*0;/,
    '🔴 se ha tocado `safeMarkup`. Este ticket NO cambia cómo entra un markup ilegible en el ' +
      'TOTAL (sigue como 0); solo hace que el pie lo diga. Cambiarlo es otra decisión.',
  );
});

test('SCRUM-229 · la fila del pie usa la clase de apoyo que ya existe, sin componente nuevo', () => {
  const pie = src.slice(src.indexOf('totalsBox.innerHTML'), src.indexOf('kpiBox.innerHTML'));
  assert.match(pie, /Base imponible/, 'suelo: no encuentro el pie de totales');
  assert.match(pie, /quote-totals__apoyo[\s\S]*Margen/,
    '🔴 la fila «Margen» debe ser una `.quote-totals__apoyo` más, como Base imponible e IVA');
});
