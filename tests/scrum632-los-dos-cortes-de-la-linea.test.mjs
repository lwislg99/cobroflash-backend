// tests/scrum632-los-dos-cortes-de-la-linea.test.mjs — SCRUM-632b
//
// ═════════════════════════════════════════════════════════════════════════════════════════════
// LOS DOS MECANISMOS QUE DECIDEN QUÉ SE PINTA EN LA LÍNEA, A LA VEZ.
//
// La hoja de ajustes de una línea tiene ahora DOS cortes independientes, y vinieron de dos
// tickets distintos que tocaron el MISMO sitio:
//
//   · el COSTE no se pinta si `!veEconomia` (SCRUM-597 · P-DOC-3) **ni** si `esDocumentoSuelto`
//     (SCRUM-600: el emisor descarta `costeUnitario`);
//   · la DESCRIPCIÓN no se pinta si `esDocumentoSuelto` (SCRUM-632, medido: su dato no viaja).
//
// 🔴 POR QUÉ ESTE FICHERO EXISTE: al mezclar, git marcó los dos como el mismo conflicto. Elegir
// un lado —que es la resolución fácil— habría dejado el `if` de uno solo, y el otro corte
// desaparecería **sin que nada se pusiera rojo**: son `appendChild` sueltos, así que lo que falta
// no rompe nada; simplemente se pinta lo que no debía. Un guard de texto diría «las dos líneas
// están»; esto EJECUTA las dos y mira qué cuelga.
//
// Patrón de la casa: fuente + `new Function` + DOM de juguete (SCRUM-229/500/655/650d).
// ═════════════════════════════════════════════════════════════════════════════════════════════
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const VISTA = path.join(RAIZ, 'public/dashboard/js/quotesView.js');

/**
 * Saca del fuente la línea EXACTA que decide algo. Se extrae en vez de copiarse: una
 * transcripción aquí fijaría lo que yo escribí, no lo que el fichero hace.
 *
 * 🔴 SUELO: si no está, esto FALLA. Un «se comporta bien» sobre una línea que no se encontró
 * sería verde sobre nada.
 */
function lineaQueDecide(aguja, queEs) {
  const fuente = fs.readFileSync(VISTA, 'utf8');
  const linea = fuente.split('\n').find((l) => l.includes(aguja));
  assert.ok(linea,
    `🔴 CIEGO: no encuentro en \`quotesView.js\` la línea que decide ${queEs} (buscaba «${aguja}»). `
    + 'O cambió de forma, o desapareció en un merge — en los dos casos hay que mirarlo antes de '
    + 'fiarse de nada de lo de abajo.');
  return linea.trim();
}

/** Ejecuta la regla de SCRUM-597 tal y como está escrita en el fichero. */
function veEconomiaSegunElFichero(win) {
  const src = lineaQueDecide('const veEconomia =', 'quién ve la economía (SCRUM-597)');
  return new Function('window', src + '\nreturn veEconomia;')(win);
}

/** Ejecuta los DOS `appendChild` y devuelve qué ha quedado colgado de la hoja de ajustes. */
function loQueSePinta({ veEconomia, esDocumentoSuelto }) {
  const coste = lineaQueDecide('appendChild(costeTd)', 'si se pinta el COSTE');
  const desc = lineaQueDecide('appendChild(descTd)', 'si se pinta la DESCRIPCIÓN');

  const puestos = [];
  const ajustesCampos = { appendChild(n) { puestos.push(n); return n; } };
  new Function('ajustesCampos', 'costeTd', 'descTd', 'veEconomia', 'esDocumentoSuelto',
    coste + '\n' + desc)(ajustesCampos, 'COSTE', 'DESCRIPCION', veEconomia, esDocumentoSuelto);
  return puestos;
}

// ═════════════════════════════════════════════════════════════════════════════════════════════
// LA REGLA DE 597, ejecutada
// ═════════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-632b · la regla de SCRUM-597 sigue viva: `veoEconomia()` decide, y sin ella no se rompe', () => {
  assert.equal(veEconomiaSegunElFichero({ veoEconomia: () => true }), true,
    '🔴 con `veoEconomia()` true la línea no da true: la regla de P-DOC-3 se ha perdido en el merge.');
  assert.equal(veEconomiaSegunElFichero({ veoEconomia: () => false }), false,
    '🔴 con `veoEconomia()` false la línea NO da false. Entonces el coste se pintaría a un técnico, '
    + 'que es exactamente lo que SCRUM-597 cerró.');
  // Sin la pieza cargada, el panel no puede quedarse a oscuras: se sigue pintando.
  assert.equal(veEconomiaSegunElFichero({}), true,
    '🔴 sin `window.veoEconomia` la línea deja de pintar el coste al propietario. El respaldo '
    + 'existe para que un orden de carga roto no esconda datos a quien sí puede verlos.');
});

// ═════════════════════════════════════════════════════════════════════════════════════════════
// ✅ LOS DOS MECANISMOS, EN LOS DOS MODOS — el control que decide
// ═════════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-632b · ✅ técnico en PRESUPUESTO: el coste NO está; la descripción SÍ', () => {
  const puestos = loQueSePinta({ veEconomia: false, esDocumentoSuelto: false });
  assert.equal(puestos.includes('COSTE'), false,
    '🔴 el COSTE se pinta a quien no ve economía. Es la fuga que cerró SCRUM-597: el coste en la '
    + 'misma fila que el precio, con el margen leyéndose de dos casillas contiguas.');
  assert.equal(puestos.includes('DESCRIPCION'), true,
    '🔴 la DESCRIPCIÓN no se pinta a un técnico en un presupuesto. No es economía del negocio: es '
    + 'el texto del documento, y el técnico es quien lo escribe.');
});

test('SCRUM-632b · ✅ propietario en PRESUPUESTO: están LOS DOS', () => {
  const puestos = loQueSePinta({ veEconomia: true, esDocumentoSuelto: false });
  assert.deepEqual(puestos, ['COSTE', 'DESCRIPCION'],
    `🔴 en el caso normal no se pintan los dos controles: ${JSON.stringify(puestos)}.\n`
    + '  Si falta uno, el merge se resolvió eligiendo un lado — y el corte que sobrevivió tapa '
    + 'que el otro desapareció, porque son `appendChild` sueltos y nada más se rompe.');
});

// 🔴 SCRUM-1805 ① (26-nov-2026) · ESTE CASO DECÍA «no está NINGUNO de los dos» y se volvió a decidir,
// como pedía su propio comentario de abajo: desde 1787k (GO SCRUM-1787 c.22338 ①) la descripción
// SÍ sobrevive al emisor de la factura suelta, y SCRUM-1805 ① la pide en el editor en modo factura.
// La regla del fichero no cambia —«se pinta si y sólo si su dato sobrevive»—; cambió el dato. El
// COSTE sigue fuera, y por el mismo motivo de siempre: el emisor lo descarta.
test('SCRUM-632b · ✅ DOCUMENTO SUELTO: la DESCRIPCIÓN sí (viaja desde 1787k); el COSTE no, se vea o no la economía', () => {
  const puestos = loQueSePinta({ veEconomia: true, esDocumentoSuelto: true });
  assert.deepEqual(puestos, ['DESCRIPCION'],
    `🔴 en documento suelto se pinta otra cosa que la descripción: ${JSON.stringify(puestos)}.\n`
    + '  La regla del fichero: «un control aparece en modo documento suelto SI Y SÓLO SI SU DATO\n'
    + '  SOBREVIVE AL EMISOR». El coste lo descarta el emisor (SCRUM-600/616); la descripción viaja\n'
    + '  en `cuerpoDelDocumentoSuelto` desde SCRUM-1805 ① — MEDIDO ejecutándolo, abajo.');

  // Con técnico: el coste sigue sin salir, la descripción sí.
  assert.deepEqual(loQueSePinta({ veEconomia: false, esDocumentoSuelto: true }), ['DESCRIPCION'],
    '🔴 con técnico Y documento suelto no queda sólo la descripción.');
});

// ═════════════════════════════════════════════════════════════════════════════════════════════
// 🔴 LA MEDICIÓN QUE SOSTIENE QUE LA DESCRIPCIÓN SE PINTE — ejecutada aquí, no citada
//
// Si algún día la descripción DEJARA de viajar en documento suelto, este caso cae y hay que volver
// a decidir si el campo se pinta. Sin él, el corte de arriba sería una opinión de hoy.
// (Hasta SCRUM-1805 ① afirmaba lo contrario: que NO viajaba.)
// ═════════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-632b · 🔴 la descripción SÍ sobrevive al emisor del documento suelto, como clave propia (por eso se pinta)', () => {
  const win = {};
  new Function('window', fs.readFileSync(path.join(RAIZ, 'public/dashboard/js/cuerpoDelDocumentoSuelto.js'), 'utf8'))(win);

  const cuerpo = win.documentoSuelto.cuerpoDelDocumentoSuelto(7, [
    { concepto: 'Grifo monomando', cantidad: 1, precio: '100', iva: 21,
      description: 'TEXTO DEL PROFESIONAL', descripcion: 'TEXTO DEL PROFESIONAL' },
  ]);

  assert.equal(cuerpo.lines.length, 1, '🔴 el compositor no ha producido la línea: no se mide nada');
  const l = cuerpo.lines[0];
  assert.equal(l.description, 'TEXTO DEL PROFESIONAL',
    '🔴 la descripción NO viaja en documento suelto. Entonces el campo vuelve a ser un control que '
    + 'no llega a ningún sitio, y el corte de `descTd` hay que volver a decidirlo.');
  // Decisión (a) de SCRUM-1805 ①: NO se pega al concepto. El concepto que se sella no cambia.
  assert.equal(l.concept, 'Grifo monomando',
    '🔴 la descripción viaja PEGADA al concepto: cambia el texto que se sella (decisión (a) de '
    + 'SCRUM-1805 ①: sólo la clave propia).');
  assert.deepEqual(Object.keys(l).sort(), ['concept', 'description', 'price', 'qty', 'tax'],
    `🔴 el cuerpo del documento suelto ha cambiado de forma: ${JSON.stringify(Object.keys(l))}. `
    + 'Lo que este caso afirma sobre la descripción se apoya en esa forma.');

  // Y sin descripción, la línea es el objeto de siempre (ni una clave vacía).
  const sinNada = win.documentoSuelto.cuerpoDelDocumentoSuelto(7, [
    { concepto: 'Grifo', cantidad: 1, precio: '100', iva: 21, descripcion: '   ', dto: '' },
  ]);
  assert.deepEqual(Object.keys(sinNada.lines[0]).sort(), ['concept', 'price', 'qty', 'tax'],
    '🔴 una línea sin descripción ni descuento ya no es el mismo objeto de antes.');
});
