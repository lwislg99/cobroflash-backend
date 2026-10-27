// SCRUM-1480f · Un fichero NUEVO de `scripts/` no entra sin fila. Es la otra mitad de SCRUM-1480e: aquél
// escribió el criterio («nace con fila, del puesto del área del ticket que lo crea») y avisa a quien pregunta;
// nada ponía en rojo al PR que creaba un script sin fila. Lo que este test sostiene:
//   · NO SUBE: todo script que sólo cubre la fila general estaba ya en la foto del 9-oct-2026 (225) o está
//     declarado, con su ticket y su motivo, en scripts/_sin-fila-declarados.json;
//   · NO BAJA EN SILENCIO: de la foto quedan sin fila exactamente los que dice `suelo.quedan`. Quien le da
//     fila a uno baja el número en su PR; una bajada que nadie ha hecho es el instrumento roto;
//   · la foto no se edita (va con su huella) y el número no pasa de 225.
// Compara CONJUNTOS y no cuentas: «he dado fila a uno y he colado otro» deja la cuenta igual.
// El criterio y las dos salidas del rojo: docs/equipo/dos-equipos.md §3.3, «Cómo nace la fila de un fichero
// de `scripts/`».
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { construirMapa, scriptsSinFila, trinqueteDeScripts } from '../scripts/_carriles.mjs';
import { ficherosDelRepo } from '../scripts/carriles.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const leer = (rel) => fs.readFileSync(path.join(RAIZ, rel), 'utf8').replace(/\r\n/g, '\n');
const TABLA = leer('docs/equipo/dos-equipos.md');
const LISTA = 'scripts/_sin-fila-declarados.json';
const DECLARADO = JSON.parse(leer(LISTA));

// El suelo, escrito: los que sólo cubría la fila general el 9-oct-2026, sobre 303 ficheros de scripts/.
const TOPE = 225;
const HUELLA_DE_LA_FOTO = '06e3b2729a5c54e8a249fad7e740a7ff2a8ec8f36323ac0460222990999e9b55';

const SALIDAS = `Tiene dos salidas (docs/equipo/dos-equipos.md §3.3, «Cómo nace la fila de un fichero de scripts/»):
  1. darle FILA en esa tabla, la del puesto del área del ticket que lo crea, y regenerar con
     \`node scripts/carriles.mjs generar\`. Es la del equipo de Luis.
  2. declararlo en ${LISTA}, con su ticket y su motivo: sólo si lo crea el equipo de Javier (que no
     edita esa tabla; la S0 le da fila después) o si el ticket que lo crea no lleva UNA etiqueta de área.
Lo que NO vale es subir \`suelo.quedan\` ni añadirlo a la foto.`;

const foto = () => leer(DECLARADO.suelo.foto).split('\n').filter(Boolean);
const medir = (ficheros) => {
  const mapa = construirMapa(TABLA, ficheros);
  assert.deepEqual(mapa.errores, [], 'la tabla se convierte sin errores');
  return scriptsSinFila(mapa, ficheros);
};

test('SCRUM-1480f · población y suelo: la foto son los 225 del 9-oct-2026, sin editar, y el número sólo baja', () => {
  const ficheros = ficherosDelRepo();
  const scripts = ficheros.filter((f) => f.startsWith('scripts/'));
  // Suelo de la población: «no pude listar scripts/» no puede dar verde. Eran 303 al nacer el test.
  assert.ok(scripts.length >= 250, `población: ${scripts.length} ficheros en scripts/ (suelo 250)`);
  const f = foto();
  assert.equal(f.length, TOPE, `población: la foto lleva ${f.length} ficheros`);
  assert.equal(new Set(f).size, TOPE, 'ninguno repetido');
  assert.equal(crypto.createHash('sha256').update(f.join('\n') + '\n').digest('hex'), HUELLA_DE_LA_FOTO,
    `${DECLARADO.suelo.foto} es una foto del 9-oct-2026 y no se edita: un script nuevo no se añade a ella`);
  assert.equal(DECLARADO.suelo.fecha, '2026-10-09', 'el suelo lleva su fecha');
  assert.ok(Number.isInteger(DECLARADO.suelo.quedan) && DECLARADO.suelo.quedan >= 0 && DECLARADO.suelo.quedan <= TOPE,
    `suelo.quedan (${DECLARADO.suelo.quedan}) no pasa de ${TOPE}: sólo baja`);
});

test('SCRUM-1480f · NO SUBE: ningún script sin fila que no estuviera en la foto o no esté declarado', () => {
  const sinFila = medir(ficherosDelRepo());
  // El control de que la sonda VE va en el test del cebo, más abajo: sin él, «0 nuevos» sería «no he mirado».
  const { nuevos } = trinqueteDeScripts({ sinFila, foto: foto(), declarados: Object.keys(DECLARADO.declarados) });
  assert.deepEqual(nuevos, [], `${nuevos.length} fichero(s) de scripts/ sin fila en dos-equipos.md §3.3 y sin declarar: ${nuevos.join(', ')}.\n${SALIDAS}`);
});

test('SCRUM-1480f · NO BAJA EN SILENCIO: de la foto quedan sin fila exactamente los que dice `suelo.quedan`', () => {
  const sinFila = medir(ficherosDelRepo());
  const { quedan } = trinqueteDeScripts({ sinFila, foto: foto(), declarados: [] });
  assert.equal(quedan.length, DECLARADO.suelo.quedan,
    `de los ${TOPE} de la foto siguen sin fila ${quedan.length}, y ${LISTA} dice ${DECLARADO.suelo.quedan}. `
    + 'Si le has dado fila a alguno o lo has borrado, baja `suelo.quedan` en este mismo PR. '
    + 'Si no has hecho ninguna de las dos cosas, el número no ha mejorado: se ha roto el instrumento (la tabla, o cómo se lee).');
});

test('SCRUM-1480f · un declarado lleva ticket, equipo y motivo, existe y sigue sin fila', () => {
  const ficheros = ficherosDelRepo();
  const sinFila = medir(ficheros);
  const entradas = Object.entries(DECLARADO.declarados);
  const { declaradosQueSobran } = trinqueteDeScripts({ sinFila, foto: foto(), declarados: entradas.map(([f]) => f) });
  assert.deepEqual(declaradosQueSobran, [], `declarados que ya tienen fila, ya no existen o son de la foto: se BORRA su entrada de ${LISTA}`);
  for (const [f, d] of entradas) {
    assert.match(String(d.ticket ?? ''), /^SCRUM-\d+$/, `${f}: el ticket que lo crea`);
    assert.match(String(d.equipo ?? ''), /^(luis|javier)$/, `${f}: equipo «luis» o «javier»`);
    assert.ok(String(d.motivo ?? '').trim().length >= 20, `${f}: el motivo por el que hoy no se le puede escribir dueño`);
  }
});

test('SCRUM-1480f · el cebo: un script fabricado sin fila sale como NUEVO, y uno con fila o declarado no', () => {
  const ficheros = ficherosDelRepo();
  const CEBO = 'scripts/__cebo-que-nace-sin-fila__.mjs';
  const CEBO_CON_FILA = 'scripts/equipo/__cebo-en-carpeta-con-fila__.mjs';
  assert.ok(!ficheros.includes(CEBO) && !ficheros.includes(CEBO_CON_FILA), 'los cebos no existen en el repo');
  const sinFila = medir([...ficheros, CEBO, CEBO_CON_FILA]);
  const f = foto();
  assert.deepEqual(trinqueteDeScripts({ sinFila, foto: f, declarados: [] }).nuevos.filter((x) => x.includes('__cebo')), [CEBO],
    'el que nace sin fila sale como nuevo; el de una carpeta con fila, no');
  assert.deepEqual(trinqueteDeScripts({ sinFila, foto: f, declarados: [CEBO] }).nuevos.filter((x) => x.includes('__cebo')), [],
    'declarado, deja de salir');
  // Y las dos mitades sobre lo fabricado: quitarle a la sonda uno de la foto baja `quedan`; un declarado
  // que no está sin fila sobra.
  const sinUno = sinFila.filter((x) => x !== f[0]);
  assert.equal(trinqueteDeScripts({ sinFila: sinUno, foto: f, declarados: [] }).quedan.length,
    trinqueteDeScripts({ sinFila, foto: f, declarados: [] }).quedan.length - 1, 'uno de la foto con fila: queda uno menos');
  assert.deepEqual(trinqueteDeScripts({ sinFila, foto: f, declarados: ['scripts/carriles.mjs', f[0]] }).declaradosQueSobran,
    ['scripts/carriles.mjs', f[0]], 'un declarado con fila sobra, y uno de la foto también');
});

test('SCRUM-1480f · la fila general de scripts/ NOMBRA sus dos primeras excepciones (aceptación 3 de SCRUM-1480)', () => {
  const fila = TABLA.split('\n').find((l) => l.startsWith('| `scripts/` (verificación, censos de consulta) |'));
  assert.ok(fila, 'la fila general de scripts/ está en §3.3');
  const nota = fila.split('|')[3] ?? '';
  for (const ruta of ['`scripts/qa/`', '`scripts/vigia-sesiones-jv.mjs`']) {
    assert.ok(nota.includes(ruta), `la nota de la fila general nombra ${ruta}, no sólo «las filas de abajo»`);
  }
});
