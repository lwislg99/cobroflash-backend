// SCRUM-1480e · La fila de un fichero de `scripts/` nace con él. Lo que este test sostiene:
//   · los 28 ficheros que el criterio «área del ticket que lo creó» decide en el equipo de Luis tienen
//     fila PROPIA en docs/equipo/dos-equipos.md §3.3, del puesto que el criterio dio (si una fusión se
//     lleva una fila por delante, el fichero vuelve a la fila general y nadie lo nota);
//   · a quien pregunta por un script que SÓLO cubre la fila general, `carriles.mjs de` le dice que nadie
//     ha decidido su dueño y cómo nace su fila; y NO se lo dice de uno que ya tiene fila.
// El criterio vive en dos-equipos.md §3.3, «Cómo nace la fila de un fichero de `scripts/`».
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { construirMapa, reglaDe } from '../scripts/_carriles.mjs';
import { ficherosDelRepo } from '../scripts/carriles.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CLI = path.join(RAIZ, 'scripts', 'carriles.mjs');
const TABLA = fs.readFileSync(path.join(RAIZ, 'docs/equipo/dos-equipos.md'), 'utf8');

// Un fichero por línea: dos tickets que toquen esta lista no chocan en la misma línea física.
const DECIDIDOS = [
  ['scripts/carriles.mjs', 'S0', 'puesto'],
  ['scripts/_carriles.mjs', 'S0', 'puesto'],
  ['scripts/_censo-sin-consumir.mjs', 'S0', 'puesto'],
  ['scripts/auditoria-cierres.mjs', 'S0', 'puesto'],
  ['scripts/claves-bd-de-todos-los-arboles.mjs', 'S0', 'puesto'],
  ['scripts/espera-del-equipo.mjs', 'S0', 'puesto'],
  ['scripts/sesiones-que-no-volvieron.mjs', 'S0', 'puesto'],
  ['scripts/traspaso-derivado.mjs', 'S0', 'puesto'],
  ['scripts/_sin-consumir-declarados.json', 'S0', 'contenedor'],
  ['scripts/_censo-rango-del-parte.mjs', 'S1', 'puesto'],
  ['scripts/guard-965-un-solo-presupuesto.mjs', 'S2', 'puesto'],
  ['scripts/guard-duplicar-926.mjs', 'S2', 'puesto'],
  ['scripts/_censo-entorno-prestado.mjs', 'S3', 'puesto'],
  ['scripts/_censo-gemelo-crudo.mjs', 'S3', 'puesto'],
  ['scripts/_tanda-por-tramos.mjs', 'S3', 'puesto'],
  ['scripts/_tests-que-cubren.mjs', 'S3', 'puesto'],
  ['scripts/tests-que-cubren.mjs', 'S3', 'puesto'],
  ['scripts/_ciegos-por-entorno-declarados.json', 'S3', 'contenedor'],
  ['scripts/_entorno-prestado-declarados.json', 'S3', 'contenedor'],
  ['scripts/_version-de-fila-dudosa-declaradas.json', 'S3', 'contenedor'],
  ['scripts/_detalle-917.mjs', 'S4', 'puesto'],
  ['scripts/_trabajos-917.mjs', 'S4', 'puesto'],
  ['scripts/capturas-lista-trabajos-917.mjs', 'S4', 'puesto'],
  ['scripts/guard-detalle-trabajo-917.mjs', 'S4', 'puesto'],
  ['scripts/guard-lista-trabajos-917.mjs', 'S4', 'puesto'],
  ['scripts/_censo-bytes-control.mjs', 'S5', 'puesto'],
  ['scripts/arbol-mio.mjs', 'S5', 'puesto'],
  ['scripts/estado-antes-del-go.mjs', 'S5', 'puesto'],
];

// Los `node` hijos NO heredan el entorno de la tanda (SCRUM-1349).
const entorno = { ...process.env };
delete entorno.FORCE_COLOR; delete entorno.NODE_OPTIONS; delete entorno.NODE_TEST_CONTEXT;
const de = (rel) => spawnSync(process.execPath, [CLI, 'de', path.join(RAIZ, rel)], { cwd: RAIZ, env: entorno, encoding: 'utf8' });

test('SCRUM-1480e · los 28 scripts que decide el área del ticket creador tienen fila propia, del puesto que el criterio dio', () => {
  const ficheros = ficherosDelRepo();
  const mapa = construirMapa(TABLA, ficheros);
  assert.deepEqual(mapa.errores, [], 'la tabla se convierte sin errores');
  assert.equal(DECIDIDOS.length, 28, 'población: 28 ficheros declarados');
  assert.equal(new Set(DECIDIDOS.map(([f]) => f)).size, 28, 'ninguno repetido');
  const vivos = DECIDIDOS.filter(([f]) => ficheros.includes(f));
  // Suelo: su dueño puede borrar o renombrar alguno, pero una lista que ya no casa con nada no mide.
  assert.ok(vivos.length >= 20, `población: ${vivos.length} de 28 siguen en el repo (suelo 20)`);
  for (const [f, puesto, tipo] of vivos) {
    const r = reglaDe(f, mapa);
    assert.ok(r, `${f}: alguna fila lo reclama`);
    assert.equal(r.patron, f, `${f}: lo cubre una fila que lo NOMBRA, no un patrón general (${r.patron})`);
    assert.equal(`${r.puesto} ${r.tipo}`, `${puesto} ${tipo}`, `${f}: el dueño que dio el criterio`);
  }
  // Control: la sonda distingue. Un ayudante compartido que NO tiene fila sigue en la general.
  const general = reglaDe('scripts/_navegador.mjs', mapa);
  assert.equal(general.patron, 'scripts/**', 'control: _navegador.mjs sólo lo cubre la fila general');
  assert.equal(general.puesto, null, 'control: la fila general de scripts/ no tiene cerradura');
});

test('SCRUM-1480e · `carriles.mjs de` avisa cuando a un script sólo lo cubre la fila general, y calla cuando tiene fila', () => {
  const nuevo = de('scripts/__un-script-que-nace-hoy__.mjs');
  assert.equal(nuevo.status, 0, nuevo.stderr);
  assert.match(nuevo.stdout, /SIN CERRADURA/, 'un script nuevo cae en la fila general');
  assert.match(nuevo.stdout, /su dueño no lo ha decidido nadie/, 'y se le dice que nadie ha decidido su dueño');
  assert.match(nuevo.stdout, /área del ticket que lo crea/, 'con el criterio');
  assert.match(nuevo.stdout, /dos-equipos\.md §3\.3/, 'y dónde está escrito');
  const viejo = de('scripts/_navegador.mjs');
  assert.match(viejo.stdout, /su dueño no lo ha decidido nadie/, 'también uno que ya existe y sigue sin fila');
  const conFila = de('scripts/carriles.mjs');
  assert.equal(conFila.status, 0, conFila.stderr);
  assert.match(conFila.stdout, /→ S0 \(puesto\)/, 'control: uno con fila propia dice su dueño');
  assert.doesNotMatch(conFila.stdout, /no lo ha decidido nadie/, 'y no lleva el aviso');
  const deOtraCarpeta = de('scripts/equipo/latido.mjs');
  assert.doesNotMatch(deOtraCarpeta.stdout, /no lo ha decidido nadie/, 'ni uno de una carpeta con fila propia');
  const producto = de('public/dashboard/js/homeView.js');
  assert.doesNotMatch(producto.stdout, /no lo ha decidido nadie/, 'ni un fichero de producto: su fila general SÍ da dueño');
});
