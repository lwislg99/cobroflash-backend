// tests/scrum1293-cargador-de-marcadores.test.mjs — SCRUM-1293
//
// EL CARGADOR DE LAS LISTAS DE MARCADORES NO PUEDE DEVOLVER UNA LISTA QUE NO HA SABIDO LEER
//
// Las listas de los censos de scrum402, scrum667 y scrum650d viven en
// `scripts/_marcadores-pendientes-declarados.json`. Los tres tests conservan sus aserciones y
// sacan los datos por `tests/_marcadores-declarados.mjs`. Si ese cargador devolviera una lista
// vacía —o una con una clave pisada— los tres censos darían un veredicto sobre algo que no es
// lo declarado. Aquí se prueba, caso a caso, que cada forma de «no supe leer» sale en ROJO
// nombrando el motivo, y —control positivo— que el fichero REAL sí se lee y trae lo que hay.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { leerMarcadoresDeclarados, marcadoresDeclarados, RUTA_DECLARADOS } from './_marcadores-declarados.mjs';

const SANO = {
  panel: { ficheros: { 'a.js': 1 } },
  servidor: { ficheros: { 'src/a.ts': 2 } },
  papel: { constantes: { MARCADOR_X: 'cuando pasa tal cosa' } },
};

/** Escribe `contenido` en un temporal FUERA del árbol y devuelve su ruta. */
function temporal(t, contenido) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'scrum1293-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const ruta = path.join(dir, 'declarados.json');
  fs.writeFileSync(ruta, typeof contenido === 'string' ? contenido : JSON.stringify(contenido, null, 2));
  return ruta;
}

test('SCRUM-1293 · CONTROL POSITIVO: el fichero REAL se lee, y trae las tres secciones con algo', () => {
  const r = leerMarcadoresDeclarados();
  assert.equal(r.ok, true, `🔴 el cargador no sabe leer ${RUTA_DECLARADOS}: ${r.motivo}`);
  for (const seccion of ['panel', 'servidor', 'papel']) {
    assert.ok(Object.keys(r[seccion]).length > 0, `🔴 \`${seccion}\` llega vacía y el cargador la dio por buena`);
    assert.ok(Object.isFrozen(r[seccion]), `🔴 \`${seccion}\` no llega congelada: un test podría cambiarla`);
  }
});

test('SCRUM-1293 · CONTROL POSITIVO: un fichero sano fabricado se lee tal cual', (t) => {
  const r = leerMarcadoresDeclarados(temporal(t, SANO));
  assert.equal(r.ok, true, r.motivo);
  assert.deepEqual({ ...r.panel }, { 'a.js': 1 });
  assert.deepEqual({ ...r.servidor }, { 'src/a.ts': 2 });
  assert.deepEqual({ ...r.papel }, { MARCADOR_X: 'cuando pasa tal cosa' });
});

// Cada caso: cómo se rompe el fichero, y qué tiene que decir el motivo. Que el motivo NOMBRE la
// causa importa: un rojo que sólo dice «mal» manda a mirar al sitio equivocado.
const texto = (o) => JSON.stringify(o, null, 2);
const sin = (seccion) => { const o = structuredClone(SANO); delete o[seccion]; return o; };
const con = (fn) => { const o = structuredClone(SANO); fn(o); return o; };
const ROTOS = [
  ['fichero AUSENTE', null, /no se puede leer/],
  ['no es JSON', '{ esto no es json', /no es JSON válido/],
  ['sección `panel` AUSENTE', sin('panel'), /falta `panel\.ficheros`/],
  ['sección `servidor` AUSENTE', sin('servidor'), /falta `servidor\.ficheros`/],
  ['sección `papel` AUSENTE', sin('papel'), /falta `papel\.constantes`/],
  ['sección `panel` VACÍA', con((o) => { o.panel.ficheros = {}; }), /`panel\.ficheros` está VACÍO/],
  ['sección `servidor` VACÍA', con((o) => { o.servidor.ficheros = {}; }), /`servidor\.ficheros` está VACÍO/],
  ['sección `papel` VACÍA', con((o) => { o.papel.constantes = {}; }), /`papel\.constantes` está VACÍO/],
  ['sección que es una LISTA', con((o) => { o.panel.ficheros = ['a.js']; }), /falta `panel\.ficheros`/],
  ['un número a CERO', con((o) => { o.panel.ficheros['a.js'] = 0; }), /MAYOR que 0/],
  ['un número NEGATIVO', con((o) => { o.servidor.ficheros['src/a.ts'] = -1; }), /MAYOR que 0/],
  ['un número que es TEXTO', con((o) => { o.panel.ficheros['a.js'] = '1'; }), /MAYOR que 0/],
  ['una condición del papel VACÍA', con((o) => { o.papel.constantes.MARCADOR_X = '  '; }), /no vacía/],
  ['clave REPETIDA con el MISMO valor (el incidente del PR #1065)',
    texto(SANO).replace('"a.js": 1', '"a.js": 1,\n      "a.js": 1'), /`panel\.ficheros` repite "a\.js"/],
  ['clave REPETIDA con valor DISTINTO',
    texto(SANO).replace('"src/a.ts": 2', '"src/a.ts": 2,\n      "src/a.ts": 9'), /`servidor\.ficheros` repite "src\/a\.ts"/],
  ['clave REPETIDA en el papel',
    texto(SANO).replace('"MARCADOR_X": "cuando pasa tal cosa"', '"MARCADOR_X": "una",\n      "MARCADOR_X": "otra"'),
    /`papel\.constantes` repite "MARCADOR_X"/],
];

for (const [caso, contenido, motivo] of ROTOS) {
  test(`SCRUM-1293 · 🔴 ${caso}: NO se lee como bueno, y el motivo lo nombra`, (t) => {
    const ruta = contenido === null
      ? path.join(os.tmpdir(), `scrum1293-no-existe-${process.pid}.json`)
      : temporal(t, contenido);
    // Que el caso esté de verdad ROTO como dice: si el `replace` de arriba no casara, el fixture
    // sería el fichero sano y este test probaría otra cosa.
    if (typeof contenido === 'string') assert.notEqual(contenido, texto(SANO), '🔴 el fixture no se ha roto');
    const r = leerMarcadoresDeclarados(ruta);
    assert.equal(r.ok, false, `🔴 «${caso}» se ha leído como BUENO: ${JSON.stringify(r)}`);
    assert.match(r.motivo, motivo, `🔴 el motivo no nombra la causa: «${r.motivo}»`);
    // Y la entrada que usan los tests LANZA: no hay valor por defecto.
    assert.throws(() => marcadoresDeclarados(ruta), /NO SE PUEDE LEER LA LISTA DE MARCADORES DECLARADOS/);
  });
}

// ═════════════════════════════════════════════════════════════════════════════════════════
// LAS MUTACIONES QUE ME TUMBAN (SCRUM-745) · las ejecuta `npm run meta:mutaciones`
// ═════════════════════════════════════════════════════════════════════════════════════════
export const MUTACIONES_QUE_ME_TUMBAN = [
  {
    // El incidente del PR #1065, en su sitio de hoy: una clave repetida, MISMO valor, en la lista
    // REAL del panel. Antes la declaraba SCRUM-751 sobre el literal `CENSO` de scrum402.
    fichero: 'scripts/_marcadores-pendientes-declarados.json',
    de: '      "settingsView.js": 1,',
    a: '      "settingsView.js": 1,\n      "settingsView.js": 1,',
    cae: 'CONTROL POSITIVO: el fichero REAL se lee, y trae las tres secciones con algo',
  },
  {
    // El cargador deja de mirar las repetidas.
    fichero: 'tests/_marcadores-declarados.mjs',
    de: 'if (repetidas.length) {',
    a: 'if (false) {',
    cae: 'clave REPETIDA con el MISMO valor (el incidente del PR #1065)',
  },
  {
    // El cargador da por buena una sección vacía.
    fichero: 'tests/_marcadores-declarados.mjs',
    de: 'if (entradas.length === 0) {',
    a: 'if (false) {',
    cae: 'sección `panel` VACÍA',
  },
];
