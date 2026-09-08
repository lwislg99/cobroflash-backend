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

test('SCRUM-632b · ✅ DOCUMENTO SUELTO: no está NINGUNO de los dos, y por motivos distintos', () => {
  const puestos = loQueSePinta({ veEconomia: true, esDocumentoSuelto: true });
  assert.deepEqual(puestos, [],
    `🔴 en documento suelto se pinta algo que no llega al emisor: ${JSON.stringify(puestos)}.\n`
    + '  La regla del fichero: «un control aparece en modo documento suelto SI Y SÓLO SI SU DATO\n'
    + '  SOBREVIVE AL EMISOR». El coste lo descarta el emisor (SCRUM-600/616) y la descripción no\n'
    + '  viaja en `cuerpoDelDocumentoSuelto` — MEDIDO ejecutándolo, no leyéndolo.');

  // Y con las dos condiciones en contra, tampoco.
  assert.deepEqual(loQueSePinta({ veEconomia: false, esDocumentoSuelto: true }), [],
    '🔴 con técnico Y documento suelto se sigue pintando algo.');
});

// ═════════════════════════════════════════════════════════════════════════════════════════════
// 🔴 LA MEDICIÓN QUE SOSTIENE EL CORTE DE LA DESCRIPCIÓN — ejecutada aquí, no citada
//
// Si algún día la descripción SÍ empezara a viajar en documento suelto, este caso cae y hay que
// volver a decidir si el campo se pinta. Sin él, el corte de arriba sería una opinión de hoy.
// ═════════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-632b · 🔴 la descripción NO sobrevive al emisor del documento suelto (por eso no se pinta)', () => {
  const win = {};
  new Function('window', fs.readFileSync(path.join(RAIZ, 'public/dashboard/js/cuerpoDelDocumentoSuelto.js'), 'utf8'))(win);

  const cuerpo = win.documentoSuelto.cuerpoDelDocumentoSuelto(7, [
    { concepto: 'Grifo monomando', cantidad: 1, precio: '100', iva: 21,
      description: 'TEXTO DEL PROFESIONAL', descripcion: 'TEXTO DEL PROFESIONAL' },
  ]);

  assert.equal(cuerpo.lines.length, 1, '🔴 el compositor no ha producido la línea: no se mide nada');
  const l = cuerpo.lines[0];
  assert.equal('description' in l, false,
    '🔴 la descripción SÍ viaja ahora en documento suelto. Entonces el corte de `descTd` sobra y '
    + 'hay que volver a decidirlo: el campo dejaría de ser un control que no llega a ningún sitio.');
  assert.equal(/TEXTO DEL PROFESIONAL/.test(l.concept), false,
    '🔴 la descripción viaja PEGADA al concepto en documento suelto. Mismo caso que arriba: si '
    + 'llega al papel, el campo tiene que poder rellenarse.');
  assert.deepEqual(Object.keys(l).sort(), ['concept', 'price', 'qty', 'tax'],
    `🔴 el cuerpo del documento suelto ha cambiado de forma: ${JSON.stringify(Object.keys(l))}. `
    + 'Lo que este caso afirma sobre la descripción se apoya en esa forma.');
});
