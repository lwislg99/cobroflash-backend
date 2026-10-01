// SCRUM-1295 · Carriles e identidad. Lo que este guard sostiene:
//   · lo generado (`.claude/carriles.json`, `.claude/rules/carril-*.md`) ES lo que sale de la tabla de
//     docs/equipo/dos-equipos.md §3 — y el comparador distingue (control positivo: se muta una fila);
//   · la cerradura `.claude/hooks/carril.mjs`, lanzada como la lanza Claude (proceso + stdin), para a
//     quien edita fuera de su carril, para por DISCREPANCIA, y con el mapa roto NO deja pasar;
//   · EL CHOQUE con SCRUM-1298: en el equipo de Javier `sesion-1` es J1. La sonda del nombre usa la
//     traducción que quien lanza dejó en la mesa; SIN ella, esa misma sesión da DISCREPANCIA (el rojo
//     que demuestra que el arreglo es lo que la evita), y un nombre que no es el de la mesa sigue dándola;
//   · el censo de huecos ve un pariente en una tabla de juguete y se declara ciego sin población.
// Población declarada al final de cada bloque: un verde sin población no sabría nada.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { construirMapa, censoDeHuecos, nombresQueContradicen, puestoDeNombre, palabrasDe, reglaDe } from '../scripts/_carriles.mjs';
import { generar, ficherosDelRepo, MAPA } from '../scripts/carriles.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const HOOK = path.join(RAIZ, '.claude', 'hooks', 'carril.mjs');
const INICIO = path.join(RAIZ, '.claude', 'hooks', 'identidad.mjs');
const CLI = path.join(RAIZ, 'scripts', 'carriles.mjs');
const TABLA = fs.readFileSync(path.join(RAIZ, 'docs/equipo/dos-equipos.md'), 'utf8');
const DE_J1 = path.join(RAIZ, 'public/dashboard/js/invoicesView.js');
const DE_S2 = path.join(RAIZ, 'public/dashboard/js/homeView.js');

// Los `node` hijos NO heredan el entorno de la tanda (SCRUM-1349): con FORCE_COLOR, NODE_OPTIONS o
// NODE_TEST_CONTEXT del padre, el hijo cambia su salida y el test mide a la tanda, no al hijo.
const entorno = { ...process.env };
delete entorno.FORCE_COLOR; delete entorno.NODE_OPTIONS; delete entorno.NODE_TEST_CONTEXT;

const tmp = (t) => { const d = fs.mkdtempSync(path.join(os.tmpdir(), 'yaqu-1295-')); t.after(() => fs.rmSync(d, { recursive: true, force: true })); return d; };

/** Una mesa de juguete: carpeta con su `.yaqu-puesto.json` (o sin él) y un transcript con el nombre. */
function mesa(t, { puesto = undefined, crudo = undefined, nombre = null }) {
  const dir = tmp(t);
  if (crudo !== undefined) fs.writeFileSync(path.join(dir, '.yaqu-puesto.json'), crudo);
  else if (puesto !== undefined) fs.writeFileSync(path.join(dir, '.yaqu-puesto.json'), JSON.stringify(puesto));
  const transcript = path.join(dir, 't.jsonl');
  fs.writeFileSync(transcript, nombre ? JSON.stringify({ type: 'agent-name', agentName: nombre }) + '\n' : '');
  return { dir, transcript };
}

function cerradura(m, fichero, { hook = HOOK, args = [], herramienta = 'Edit' } = {}) {
  const env = { ...process.env };
  delete env.FORCE_COLOR; delete env.NODE_OPTIONS; delete env.NODE_TEST_CONTEXT;
  env.CLAUDE_PROJECT_DIR = m.dir;
  const r = spawnSync(process.execPath, [hook, ...args], {
    input: JSON.stringify({ tool_name: herramienta, tool_input: { file_path: fichero }, transcript_path: m.transcript, cwd: m.dir }),
    env,
    encoding: 'utf8',
  });
  return { codigo: r.status, err: r.stderr };
}

test('SCRUM-1295 · lo commiteado es lo que sale de la tabla, y el comparador distingue', () => {
  const r = spawnSync(process.execPath, [CLI, 'comprobar'], { cwd: RAIZ, encoding: 'utf8', env: entorno });
  assert.equal(r.status, 0, `node scripts/carriles.mjs comprobar →\n${r.stdout}${r.stderr}`);
  const m = /(\d+) filas de §3 · (\d+) reglas \((\d+) con dueño\)/.exec(r.stdout);
  assert.ok(m && Number(m[1]) >= 40 && Number(m[3]) >= 80, `población inesperada: ${r.stdout}`);

  // Control positivo: cambiar el dueño de UNA fila cambia lo generado. Si no, «IGUAL» no mide nada.
  const ficheros = ficherosDelRepo(RAIZ);
  const antes = generar(TABLA, ficheros).salida[MAPA];
  assert.equal(antes, fs.readFileSync(path.join(RAIZ, MAPA), 'utf8').replace(/\r\n/g, '\n'));
  const fila = '| `src/modules/reports/**` | **S1** |';
  assert.ok(TABLA.includes(fila), 'la fila que se muta ya no está en la tabla: elige otra');
  const mutada = generar(TABLA.replace(fila, '| `src/modules/reports/**` | **J3** |'), ficheros);
  assert.notEqual(mutada.salida[MAPA], antes);
  assert.equal(reglaDe('src/modules/reports/x.ts', mutada.mapa).puesto, 'J3');
  console.log(`# población: ${m[1]} filas, ${m[2]} reglas, ${m[3]} con dueño, ${ficheros.length} ficheros`);
});

test('SCRUM-1295 · la cerradura para fuera del carril y deja pasar dentro', (t) => {
  const s2 = mesa(t, { puesto: { puesto: 'S2' }, nombre: 'sesion-2' });
  const fuera = cerradura(s2, DE_J1);
  assert.equal(fuera.codigo, 2);
  assert.match(fuera.err, /es de J1/);
  assert.equal(cerradura(s2, DE_S2).codigo, 0);
  assert.equal(cerradura(s2, DE_J1, { herramienta: 'Read' }).codigo, 0, 'leer no es editar');
  // Sin mesas (hoy): la identidad sale solo del nombre, y la cerradura funciona igual.
  const hoy = mesa(t, { nombre: 's2-1oct' });
  assert.equal(cerradura(hoy, DE_J1).codigo, 2);
  assert.equal(cerradura(hoy, DE_S2).codigo, 0);
});

test('SCRUM-1295 · carpeta y nombre que discrepan paran; sin identidad solo para si se exige', (t) => {
  const d = cerradura(mesa(t, { puesto: { puesto: 'S2' }, nombre: 's3-1oct' }), DE_S2);
  assert.equal(d.codigo, 2);
  assert.match(d.err, /DISCREPANCIA/);
  const nadie = mesa(t, { nombre: 'cobroflash-backend-57' });
  assert.equal(cerradura(nadie, DE_J1).codigo, 0, 'hoy ninguna carpeta tiene identidad: sin --exigir-identidad no se para a nadie');
  const exigida = cerradura(nadie, DE_J1, { args: ['--exigir-identidad'] });
  assert.equal(exigida.codigo, 2);
  assert.match(exigida.err, /SIN IDENTIDAD/);
  for (const crudo of ['{no es json', '{"puesto":"S9"}', '{"puesto":"J1","nombre":""}']) {
    const rota = cerradura(mesa(t, { crudo, nombre: 'sesion-1' }), DE_S2, { args: ['--exigir-identidad'] });
    assert.equal(rota.codigo, 2, `una mesa rota (${crudo}) no da identidad`);
    assert.match(rota.err, /roto/);
  }
});

test('SCRUM-1295 · EL CHOQUE: «sesion-1» en la mesa de J1 no es S1 — una sola traducción', (t) => {
  // Lo que habría pasado al armar la cerradura tal cual: la carpeta dice J1, el nombre se lee S1.
  const sinTraduccion = cerradura(mesa(t, { puesto: { puesto: 'J1' }, nombre: 'sesion-1' }), DE_J1);
  assert.equal(sinTraduccion.codigo, 2, 'sin la traducción común, esto DEBE ser discrepancia: es el rojo que prueba el arreglo');
  assert.match(sinTraduccion.err, /DISCREPANCIA.*J1.*S1/s);
  // Con el nombre que quien lanza dejó en la mesa: mismo idioma, no hay discrepancia, y manda el carril.
  const javier = mesa(t, { puesto: { puesto: 'J1', nombre: 'sesion-1' }, nombre: 'sesion-1' });
  assert.equal(cerradura(javier, DE_J1).codigo, 0);
  const ajeno = cerradura(javier, DE_S2);
  assert.equal(ajeno.codigo, 2);
  assert.match(ajeno.err, /es de S2\b.*tú eres J1/);
  // Y la discrepancia sigue siendo señal: otra sesión sentada en esa mesa se para.
  for (const otro of ['sesion-2', 's1-1oct', 'j2-1oct']) {
    const r = cerradura(mesa(t, { puesto: { puesto: 'J1', nombre: 'sesion-1' }, nombre: otro }), DE_J1);
    assert.equal(r.codigo, 2, `«${otro}» en la mesa de J1`);
    assert.match(r.err, /DISCREPANCIA/);
  }
  assert.equal(puestoDeNombre('sesion-1'), 'S1');
  assert.equal(puestoDeNombre('Sesion-1 ', { puesto: 'J1', nombre: 'sesion-1' }), 'J1');
  assert.equal(puestoDeNombre('sesion-1', { puesto: 'J1', nombre: null }), 'S1');

  // SessionStart cuenta lo mismo que la cerradura: no hay una segunda traducción en identidad.mjs.
  const env = { ...process.env };
  delete env.FORCE_COLOR; delete env.NODE_OPTIONS; delete env.NODE_TEST_CONTEXT;
  env.CLAUDE_PROJECT_DIR = javier.dir;
  const inicio = spawnSync(process.execPath, [INICIO], { input: JSON.stringify({ session_title: 'sesion-1', cwd: javier.dir }), env, encoding: 'utf8' });
  const ctx = JSON.parse(inicio.stdout).hookSpecificOutput.additionalContext;
  assert.match(ctx, /eres el puesto J1/);
  assert.doesNotMatch(ctx, /DISCREPANCIA/);
  assert.doesNotMatch(fs.readFileSync(INICIO, 'utf8'), /puestoDeNombre\(/, 'identidad.mjs no traduce nombres: se lo pide a carril.mjs');
});

test('SCRUM-1295 · la mesa de un puesto J sin --nombre no se escribe, y con él lo lleva', (t) => {
  const dir = tmp(t);
  const sin = spawnSync(process.execPath, [CLI, 'mesa', 'J1', dir], { cwd: RAIZ, encoding: 'utf8', env: entorno });
  assert.equal(sin.status, 2);
  assert.match(sin.stdout, /NO-PUDE-MIRAR.*--nombre/);
  assert.ok(!fs.existsSync(path.join(dir, '.yaqu-puesto.json')), 'una mesa rechazada no deja identidad a medias');
  const con = spawnSync(process.execPath, [CLI, 'mesa', 'J1', dir, '--nombre', 'sesion-1'], { cwd: RAIZ, encoding: 'utf8', env: entorno });
  assert.equal(con.status, 0, con.stdout + con.stderr);
  assert.deepEqual((({ puesto, nombre }) => ({ puesto, nombre }))(JSON.parse(fs.readFileSync(path.join(dir, '.yaqu-puesto.json'), 'utf8'))), { puesto: 'J1', nombre: 'sesion-1' });
  const cruzada = spawnSync(process.execPath, [CLI, 'mesa', 'J1', dir, '--nombre', 'j2-1oct'], { cwd: RAIZ, encoding: 'utf8', env: entorno });
  assert.equal(cruzada.status, 2, 'un nombre que por su forma es de OTRO puesto no es una traducción');
  const luis = tmp(t);
  assert.equal(spawnSync(process.execPath, [CLI, 'mesa', 'S3', luis], { cwd: RAIZ, encoding: 'utf8', env: entorno }).status, 0, 'el equipo de Luis sigue sin necesitar --nombre');
});

test('SCRUM-1295 · con el mapa roto la cerradura NO deja pasar', (t) => {
  // Copia de la cerradura con SU mapa estropeado: el hook lee `../carriles.json` relativo a sí mismo.
  const dir = tmp(t);
  fs.mkdirSync(path.join(dir, '.claude', 'hooks'), { recursive: true });
  fs.mkdirSync(path.join(dir, 'scripts'));
  fs.copyFileSync(HOOK, path.join(dir, '.claude', 'hooks', 'carril.mjs'));
  fs.copyFileSync(path.join(RAIZ, 'scripts', '_carriles.mjs'), path.join(dir, 'scripts', '_carriles.mjs'));
  const copia = path.join(dir, '.claude', 'hooks', 'carril.mjs');
  const s2 = mesa(t, { puesto: { puesto: 'S2' }, nombre: 'sesion-2' });
  for (const [caso, escribir] of [['ausente', () => {}], ['no es JSON', () => fs.writeFileSync(path.join(dir, '.claude', 'carriles.json'), '{')]]) {
    escribir();
    const r = cerradura(s2, DE_S2, { hook: copia });
    assert.equal(r.codigo, 2, `mapa ${caso}`);
    assert.match(r.err, /SIN MAPA/);
  }
  // Control: la misma copia, con el mapa bueno, deja pasar lo que es suyo. El rojo era por el mapa.
  fs.copyFileSync(path.join(RAIZ, MAPA), path.join(dir, '.claude', 'carriles.json'));
  assert.equal(cerradura(s2, DE_S2, { hook: copia }).codigo, 0);
  const basura = spawnSync(process.execPath, [HOOK], { input: 'esto no es json', encoding: 'utf8', env: entorno });
  assert.equal(basura.status, 2);
});

test('SCRUM-1295 · huecos: ve un pariente, no cruza servidor con pantalla, y sin población lo dice', () => {
  const tabla = [
    '### 3.1 · Servidor', '| ruta | dueño | nota |', '|---|---|---|',
    '| `src/clientes/tagsDelCliente.ts` | **J2** | |',
    '| todo lo demás de `src/` | **S1** | |',
    '### 3.2 · Pantallas', '| ruta | dueño | nota |', '|---|---|---|',
    '| `public/js/parteDetailView.js` | **S4** | |',
    '| todo lo demás de `public/` | **S2** | |',
  ].join('\n');
  const ficheros = ['src/clientes/tagsDelCliente.ts', 'src/system/fusionClientes.ts', 'src/system/parteTrabajo.ts', 'src/otro/cosa.ts',
    'public/js/parteDetailView.js', 'public/js/parteOficinaView.js', 'public/js/homeView.js', 'public/logo.png', 'lib/suelto.ts'];
  const mapa = construirMapa(tabla, ficheros);
  assert.deepEqual(mapa.errores, []);
  const c = censoDeHuecos(mapa, ficheros);
  assert.deepEqual(c.parientes.map((h) => `${h.fichero}→${h.puesto}~${h.pistas.map((p) => p.puesto)}`), ['src/system/fusionClientes.ts→S1~J2', 'public/js/parteOficinaView.js→S2~S4']);
  assert.ok(!c.parientes.some((h) => h.fichero === 'src/system/parteTrabajo.ts'), 'el servidor de «parte» no es pariente de su pantalla');
  assert.deepEqual({ producto: c.producto, especificos: c.especificos, generales: c.generales, sinFila: c.sinFila.length }, { producto: 7, especificos: 2, generales: 5, sinFila: 0 });
  assert.deepEqual(palabrasDe('public/dashboard/js/parteOficinaView.js'), ['parte', 'oficina']);
  // Sin fila general, un fichero de producto no es de nadie: SIN-FILA, no «0 huecos».
  const sinGeneral = construirMapa(tabla.replace('| todo lo demás de `public/` | **S2** | |', ''), ficheros);
  assert.deepEqual(censoDeHuecos(sinGeneral, ficheros).sinFila, ['public/js/parteOficinaView.js', 'public/js/homeView.js']);

  // El nombre que contradice a la tabla: la carpeta dice S5 y la fila dice S0. Donde coinciden, calla.
  const tablaN = ['### 3.3 · Repo', '| ruta | dueño | nota |', '|---|---|---|', '| `scripts/` | **S0** | |', '| `scripts/equipo/**` | **S5** | |'].join('\n');
  const fn = ['scripts/verificacion-s5/a.mjs', 'scripts/verificacion-s5/b.mjs', 'scripts/equipo/turno-s5.mjs', 'scripts/censo.mjs'];
  const nc = nombresQueContradicen(construirMapa(tablaN, fn), fn);
  assert.deepEqual(nc, { conPuestoEnElNombre: 3, casos: [{ tramo: 'scripts/verificacion-s5/', dice: 'S5', puesto: 'S0', linea: 4, n: 2 }] });

  // El censo de verdad: mide (0 = sin huecos, 1 = hay lista), nunca 2, y con población.
  const r = spawnSync(process.execPath, [CLI, 'huecos'], { cwd: RAIZ, encoding: 'utf8', env: entorno });
  assert.ok(r.status === 0 || r.status === 1, `huecos salió ${r.status}:\n${r.stdout}${r.stderr}`);
  const m = /(\d+) ficheros de producto .* (\d+) con fila específica · (\d+) solo por la fila general/.exec(r.stdout);
  assert.ok(m && Number(m[1]) >= 300 && Number(m[2]) >= 100 && Number(m[3]) >= 100, `población inesperada: ${r.stdout.split('\n')[0]}`);
  console.log(`# población: ${r.stdout.split('\n')[0]}`);
});

test('SCRUM-1295 · los hooks están registrados y la identidad de la mesa no va a git', () => {
  const s = JSON.parse(fs.readFileSync(path.join(RAIZ, '.claude', 'settings.json'), 'utf8'));
  const ordenes = (evento) => (s.hooks?.[evento] ?? []).flatMap((g) => g.hooks.map((h) => ({ matcher: g.matcher ?? '', orden: h.command })));
  const carril = ordenes('PreToolUse').filter((o) => o.orden.includes('.claude/hooks/carril.mjs'));
  assert.equal(carril.length, 1);
  for (const h of ['Edit', 'Write', 'NotebookEdit', 'MultiEdit']) assert.ok(carril[0].matcher.split('|').includes(h), `la cerradura no ve ${h}`);
  assert.equal(ordenes('SessionStart').filter((o) => o.orden.includes('.claude/hooks/identidad.mjs')).length, 1);
  assert.ok(ordenes('PreToolUse').some((o) => o.orden.includes('guard-dangerous')), 'registrar los hooks nuevos no puede llevarse el guard que ya estaba');
  const ignorados = fs.readFileSync(path.join(RAIZ, '.gitignore'), 'utf8').split(/\r?\n/);
  for (const f of ['CLAUDE.local.md', '.yaqu-puesto.json']) assert.ok(ignorados.includes(f), `${f} sin ignorar: la identidad de una mesa acabaría commiteada y repartida a todas`);
});
