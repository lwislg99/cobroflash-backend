// tests/scrum436-un-solo-formato-euros.test.mjs — SCRUM-436
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// LO QUE MIDIÓ EL PASO 0, Y POR QUÉ EL TICKET NO ERA EL QUE PARECÍA
//
// El encargo hablaba de «cuatro formateadores y ninguno compartido». **Falso, y el censo que lo
// dijo era mío**: `fmtMoneyEs` existe en `api.js:190`, está en `window` y lo usan **20 ficheros
// con 66 llamadas**. Lo que había eran TRES copias que se habían separado de él — y una de ellas
// la escribí yo en SCRUM-428 sin buscar antes si existía.
//
// Y no eran equivalentes. Medido con la misma batería en los cuatro:
//
//   valor          compartida        libroRegistro     reports/jobs
//   1000           1.000,00 €        1000,00 €         1000,00 €      ← 🔴 el caso de un oficio
//   9999.99        9.999,99 €        9999,99 €         9999,99 €      ← 🔴
//   null           0,00 €            —                 0,00 €
//   'texto'        0,00 €            NaN €             NaN €          ← 🔴 basura en pantalla
//
// El agrupado de miles NO es cosmético: es lo que A18.2 (AB6, «9.999,99 €») arregló con
// `useGrouping:'always'`, porque es-ES **no agrupa las cuatro cifras** por CLDR. Cada copia del
// formato reintrodujo el defecto que la original ya había corregido — y el tramo 1.000–9.999 € es
// justo el importe corriente de un trabajo.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// LA DIFERENCIA QUE **SÍ** ERA DELIBERADA, Y NO SE UNIFICA A CIEGAS
//
// `libroRegistroView` devuelve «—» para `null`, y su propio comentario lo dice: *«`null` NO es
// cero»*. En un libro de registro que se imprime y se entrega, decir «0,00 €» donde no hay dato es
// afirmar un importe que nadie ha calculado. **Esa diferencia se conserva** — por eso el
// formateador compartido gana una variante (`fmtMoneyEsOAusente`) en vez de aplanarlo todo.
//
// Lo que ese fichero SÍ gana es el agrupado, que es lo que su propio comentario exigía y su
// implementación no daba.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { censo, formateosDe, PUEDEN_FORMATEAR } from './_censo-formato-euros.mjs';

const RAIZ = path.resolve(import.meta.dirname, '..');
const require_ = createRequire(import.meta.url);

// `api.js` no exporta con `module.exports`: define funciones y las cuelga de `window`. Se evalúa
// con un `window` de mentira, que es como se comporta en el navegador.
function cargarApi() {
  const src = fs.readFileSync(path.join(RAIZ, 'public/dashboard/js/api.js'), 'utf8');
  const win = {};
  // eslint-disable-next-line no-new-func
  new Function('window', 'document', 'localStorage', 'fetch', `${src}`)(win, undefined, undefined, undefined);
  return win;
}

const api = cargarApi();

/**
 * `Intl` separa la cifra del símbolo con un ESPACIO DURO (U+00A0), no con un espacio normal.
 * Compararlo contra `'1.000,00 €'` escrito a mano falla por un carácter invisible — y el diff de
 * `assert` se ve idéntico, que es la peor forma de perder media hora. Se normaliza y se dice.
 */
const ESPACIO_DURO = String.fromCharCode(0xa0);   // escrito por su CÓDIGO, nunca pegado en crudo
const sinEspacioDuro = (v) => String(v).split(ESPACIO_DURO).join(' ');

test('SCRUM-436 · SUELO del propio test: el separador invisible sigue siendo el que creo', () => {
  // ⚠️ La primera versión de esta línea llevaba el U+00A0 PEGADO en el fuente. Funcionaba, y era
  // una trampa: un carácter invisible que se lee como un espacio normal, así que el siguiente que
  // toque la línea lo sustituye sin enterarse y el normalizador deja de normalizar EN SILENCIO.
  //
  // Misma familia que el `\b` que entró como 0x08 en el guard de SCRUM-428 y lo dejó incapaz de
  // fallar. Aquí se escribe por su código y se comprueba que sirve para lo que se puso.
  assert.equal(ESPACIO_DURO.charCodeAt(0), 0xa0);
  assert.notEqual(ESPACIO_DURO, ' ', '🔴 el «espacio duro» es un espacio normal: no normaliza nada.');
  assert.equal(sinEspacioDuro('1.000,00' + ESPACIO_DURO + '€'), '1.000,00 €');
});

// ── SUELO ────────────────────────────────────────────────────────────────────────────────────

test('SCRUM-436 · SUELO: el censo PARSEA el dashboard y reconoce lo que dice reconocer', () => {
  const r = censo(RAIZ);
  assert.ok(r.ficherosMirados >= 40,
    `🔴 el censo solo ha mirado ${r.ficherosMirados} ficheros de public/dashboard/js. «Nadie ` +
    'formatea a mano» y «no supe leer el árbol» dan el mismo verde.');

  // Control POSITIVO del detector, sobre fuente sintética: si dejara de reconocer las dos formas,
  // el verde de abajo no significaría nada — y este control sobrevive al arreglo, que es lo que
  // un suelo tiene que hacer.
  const positivo = formateosDe('sintetico.js', [
    "const a = n.toFixed(2) + ' €';",
    "const b = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(n);",
  ].join('\n'));
  assert.equal(positivo.length, 2,
    `🔴 el detector reconoce ${positivo.length} de las 2 formas conocidas de formatear dinero a ` +
    'mano. Con el detector ciego, el censo daría cero por no mirar.');
});

test('SCRUM-436 · 🔴 CONTROL NEGATIVO: lo que NO es dinero no cae', () => {
  // Un guard que marca todo no marca nada. Un porcentaje, una cantidad y una fecha usan las mismas
  // herramientas (`toFixed`, `toLocaleString`, `Intl`) y no son importes.
  const noEsDinero = formateosDe('sintetico.js', [
    "const pct = (x * 100).toFixed(0) + '%';",
    "const uds = n.toLocaleString('es-ES') + ' ud';",
    "const f = new Intl.NumberFormat('es-ES', { maximumFractionDigits: 0 }).format(n);",
    "const d = new Intl.DateTimeFormat('es-ES').format(fecha);",
    "const txt = 'Cobrado ' + nombre;",
  ].join('\n'));
  assert.deepEqual(noEsDinero, [],
    `🔴 el censo marca ${noEsDinero.length} cosas que NO son importes: ${JSON.stringify(noEsDinero)}.\n\n` +
    '  Un guard que marca todo no marca nada: acaba desactivado y con él se va la protección real.');
});

// ── EL CENSO ─────────────────────────────────────────────────────────────────────────────────

test('SCRUM-436 · 🔴 nadie formatea dinero por su cuenta fuera del formateador de la casa', () => {
  const { hallazgos } = censo(RAIZ);
  const lista = hallazgos.map((h) => `${h.fichero}:${h.linea} — ${h.forma}\n      ${h.fragmento}`);

  assert.deepEqual(lista, [],
    `🔴 HAY FORMATEO DE DINERO A MANO:\n    ${lista.join('\n    ')}\n\n` +
    '  Cada copia del formato se separa del original en cuanto éste se arregla. Pasó con\n' +
    '  `useGrouping:\'always\'` (A18.2/AB6): la casa imprime «9.999,99 €» y las copias «9999,99 €»,\n' +
    '  que es el importe corriente de un trabajo.\n\n' +
    `  Usa \`fmtMoneyEs(n, moneda)\` de api.js. Si tu pantalla necesita distinguir el AUSENTE del\n` +
    '  cero —un libro que se imprime y se entrega—, usa `fmtMoneyEsOAusente(n, moneda)`.\n\n' +
    `  Ficheros con permiso, y por qué: ${JSON.stringify(PUEDEN_FORMATEAR)}`);
});

// ── CONTROL POSITIVO: el mismo importe, el mismo texto en las cuatro pantallas ────────────────

test('SCRUM-436 · 🔴 los mismos importes dan el MISMO texto en las cuatro pantallas', () => {
  const { fmtMoneyEs, fmtMoneyEsOAusente } = api;
  assert.equal(typeof fmtMoneyEs, 'function', '🔴 `fmtMoneyEs` no se cuelga de window: nadie lo tendría.');
  assert.equal(typeof fmtMoneyEsOAusente, 'function', '🔴 falta `fmtMoneyEsOAusente`.');

  // Los cuatro consumidores, tal y como quedan tras el ticket.
  const expenses = (n) => fmtMoneyEs(n, 'EUR');          // expensesView.js:424 (ya delegaba)
  const libro    = (n) => fmtMoneyEsOAusente(n, 'EUR');  // libroRegistroView.js
  const reports  = (n) => fmtMoneyEs(n);                 // reportsView.js
  const jobs     = (n) => fmtMoneyEs(n);                 // jobsView.js

  for (const v of [0, 1000, 9999.99, 1234567.5, -50, 0.005]) {
    const textos = new Set([expenses(v), libro(v), reports(v), jobs(v)]);
    assert.equal(textos.size, 1,
      `🔴 el importe ${v} se pinta de ${textos.size} formas distintas: ${[...textos].join(' / ')}. ` +
      'El mismo número tiene que leerse igual en todas las pantallas o el profesional cree que ' +
      'son cifras distintas.');
  }

  // Y el caso que motivó todo: el agrupado que es-ES no da por defecto.
  assert.equal(sinEspacioDuro(fmtMoneyEs(1000)), '1.000,00 €',
    '🔴 se ha perdido `useGrouping:\'always\'` (A18.2/AB6): es-ES no agrupa las cuatro cifras por ' +
    'CLDR y volveríamos a imprimir «1000,00 €».');
  assert.equal(sinEspacioDuro(fmtMoneyEs(9999.99)), '9.999,99 €');
});

test('SCRUM-436 · el AUSENTE y el CERO siguen siendo afirmaciones distintas donde lo eran', () => {
  const { fmtMoneyEs, fmtMoneyEsOAusente } = api;

  // El libro conserva su «—»: es deliberado y está escrito en su propio comentario.
  for (const vacio of [null, undefined, '', 'no-es-un-numero', NaN]) {
    assert.equal(fmtMoneyEsOAusente(vacio, 'EUR'), '—',
      `🔴 «${String(vacio)}» sale como un importe. En un libro de registro que se imprime y se ` +
      'entrega, decir «0,00 €» donde no hay dato afirma un importe que nadie ha calculado.');
  }
  // Y el cero de verdad sigue siendo cero: no se confunde con el ausente.
  assert.equal(sinEspacioDuro(fmtMoneyEsOAusente(0, 'EUR')), '0,00 €',
    '🔴 un cero REAL sale como «—». Cero es un dato, y esconderlo es la mentira simétrica.');

  // Las demás pantallas no cambian de conducta: el ausente sigue siendo 0,00 € donde ya lo era.
  assert.equal(sinEspacioDuro(fmtMoneyEs(null)), '0,00 €',
    '🔴 `fmtMoneyEs` ha cambiado su trato del ausente. Lo usan 20 ficheros con 66 llamadas: eso ' +
    'no es unificar un formato, es cambiar lo que dicen veinte pantallas sin pedirlo.');

  // La moneda se respeta: `reports` y `jobs` la forzaban a «€» ignorando el parámetro.
  assert.match(fmtMoneyEs(10, 'USD'), /US\$|\$/,
    '🔴 la moneda deja de respetarse: el formateador estaría forzando € como hacían las copias.');
});
