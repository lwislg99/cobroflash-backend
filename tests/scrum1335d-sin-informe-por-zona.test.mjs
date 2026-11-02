// tests/scrum1335d-sin-informe-por-zona.test.mjs — SCRUM-1335d · el recuento de los ficheros que
// NO ENTREGAN SU INFORME, por zona, y distinguiendo «en una zona» de «en las DOS».
//
// LO QUE HABÍA (medido en SCRUM-1335c, `evidencias/SCRUM-1335c/salida.txt`): un fichero que pierde su
// informe en las DOS zonas sale en CERO listas del trinquete, y `run()` pone en su lugar una entrada
// `pass` con la ruta del fichero por nombre — en las dos zonas `pass`/`pass`, o sea «comparada e
// igual». El «en la tanda 0 · siguen 0» se imprimía igual sobre un fichero cuyas pruebas nadie vio.
//
// LA SEÑAL: `run()` emite un `test:summary` con `file` por cada fichero cuyo informe llega ENTERO, y
// ninguno para el que enmudece (`evidencias/SCRUM-1335c/eventos.txt`). El hijo apunta esos ficheros
// (`conInforme`) y `sinInformePorZona` cuenta los que faltan.
//
// 🔴 ESTO ES UNA LÍNEA DE INFORME Y NO CAMBIA CUÁNDO SALE ROJO (autorizado así por el orquestador,
// 2-nov-2026). Que un informe incompleto ponga el job en CIEGO es una decisión del fundador, y la
// toma con la cifra que esta línea imprime. Lo fija el caso ⑤.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import { temporal } from './_temporal.mjs';
import {
  RAIZ, ZONAS, leerConInforme, medirEnZona, rutaRelativa, sinInformePorZona, veredicto,
} from '../scripts/_trinquete-de-zona.mjs';

const CAB = "import test from 'node:test';\nconst ZONA = Intl.DateTimeFormat().resolvedOptions().timeZone;\n";
const MUDO = (cond) => `if (${cond}) process.stdout.write = () => true;\n`;
const tres = (p) => [1, 2, 3].map((i) => `test('${p} ${i}', () => {});`).join('\n') + '\n';

/** Medida falsa: lo único que mira `sinInformePorZona` es `zona`, `ok` y `conInforme`. */
const medida = (zona, conInforme, extra = {}) => ({
  zona, ok: true, veredictos: new Map([['x::y', 'pass']]), conInforme: conInforme && new Set(conInforme), ...extra,
});

test('① cuenta por zona y separa «en UNA zona» de «en las DOS» (lógica pura)', () => {
  const ficheros = ['tests/a.test.mjs', 'tests/b.test.mjs', 'tests/c.test.mjs', 'tests/d.test.mjs'];
  const r = sinInformePorZona([
    medida('Z1', ['tests/a.test.mjs', 'tests/b.test.mjs']),
    medida('Z2', ['tests/a.test.mjs', 'tests/c.test.mjs']),
  ], ficheros);
  assert.equal(r.medible, true);
  assert.equal(r.poblacion, 4);
  assert.deepEqual(r.porZona.map((z) => [z.zona, z.sinInforme]), [['Z1', 2], ['Z2', 2]]);
  assert.deepEqual(r.enUna, ['tests/b.test.mjs', 'tests/c.test.mjs']);
  assert.deepEqual(r.enTodas, ['tests/d.test.mjs']);
});

test('② «no pude contar» NO sale como cero: sin `conInforme` o con una pasada caída', () => {
  const ficheros = ['tests/a.test.mjs'];
  const sinDato = sinInformePorZona([medida('Z1', ['tests/a.test.mjs']), medida('Z2', null)], ficheros);
  assert.equal(sinDato.medible, false);
  assert.match(sinDato.porque, /Z2/);
  assert.equal(sinDato.enTodas, undefined, 'un recuento que no se pudo hacer no lleva cifras');

  const caida = sinInformePorZona([medida('Z1', ['tests/a.test.mjs']), { zona: 'Z2', ok: false, porque: 'murió' }], ficheros);
  assert.equal(caida.medible, false);
  assert.equal(sinInformePorZona([], ficheros).medible, false, 'sin medidas no hay recuento');

  // Y la lectura de la medida del hijo: sin el campo es `null`, no un conjunto vacío.
  assert.equal(leerConInforme({ veredictos: [] }), null);
  assert.equal(leerConInforme(null), null);
  assert.deepEqual([...leerConInforme({ conInforme: ['tests/a.test.mjs'] })], ['tests/a.test.mjs']);
  assert.equal(leerConInforme({ conInforme: [] }).size, 0, 'una lista vacía SÍ es un dato: nadie informó');
});

test('③ acepta rutas absolutas y las cuenta con la misma clave que el hijo (`/`, relativa a la raíz)', () => {
  const abs = path.join(RAIZ, 'tests', 'a.test.mjs');
  const r = sinInformePorZona([medida('Z1', ['tests/a.test.mjs']), medida('Z2', [])], [abs]);
  assert.deepEqual(r.enUna, [rutaRelativa(abs)]);
  assert.deepEqual(r.enTodas, []);
});

test('④ POR EL CAMINO REAL: ficheros sembrados que enmudecen, medidos por el hijo en las dos zonas', () => {
  const dir = temporal('scrum1335d-');
  const SEMBRADOS = {
    'normal.test.mjs': CAB + tres('normal'),
    'mudo-en-midway.test.mjs': CAB + MUDO("ZONA === 'Pacific/Midway'") + tres('midway'),
    'mudo-en-las-dos.test.mjs': CAB + MUDO('true') + tres('dos'),
  };
  const rutas = Object.entries(SEMBRADOS).map(([n, c]) => {
    const r = path.join(dir, n); fs.writeFileSync(r, c); return r;
  });
  const medidas = ZONAS.map((zona) => medirEnZona({
    zona, ficheros: rutas, raiz: RAIZ, salida: path.join(dir, `${zona.replace(/\W/g, '_')}.json`),
  }));
  for (const m of medidas) assert.equal(m.ok, true, m.porque);

  const r = sinInformePorZona(medidas, rutas);
  const nombre = (rel) => rel.replace(/^.*\//, '');
  assert.equal(r.medible, true, r.porque);
  assert.equal(r.poblacion, 3);
  // Control positivo: el fichero normal SÍ informa en las dos, así que la señal existe.
  assert.deepEqual(r.enUna.map(nombre), ['mudo-en-midway.test.mjs']);
  // Y el caso que el instrumento no veía: en cero listas del comparador, aquí con su nombre.
  assert.deepEqual(r.enTodas.map(nombre), ['mudo-en-las-dos.test.mjs']);
});

test('⑤ el recuento NO cambia el veredicto: con ficheros sin informe en las DOS, sigue OK', () => {
  const medidas = [medida('Z1', []), medida('Z2', [])];
  const sinInforme = sinInformePorZona(medidas, ['tests/a.test.mjs']);
  assert.deepEqual(sinInforme.enTodas, ['tests/a.test.mjs']);
  const v = veredicto({ cambianEnElArbol: [], censadas: [], medidas, sinComparar: [] });
  assert.equal(v.estado, 'OK', 'ponerlo CIEGO es decisión del fundador (SCRUM-1335d), no de este tramo');
});
