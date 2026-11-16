// tests/scrum1575b-censo-conexiones.test.mjs — SCRUM-1575b
//
// ¿Qué scripts conectan con una base sin pasar por el guard de destino? El censo vive en
// `scripts/_censo-conexiones-a-base.mjs`; aquí se le pone delante un árbol FABRICADO que sabe la
// respuesta, se le quita para ver que dice CIEGO y no verde, y se fija el trinquete sobre el árbol
// real: ningún script nuevo que escriba sin guard.
//
// ⛔ NINGÚN CASO CONECTA CON UNA BASE. Los dos backfills se lanzan con una URL de loopback al puerto 1
// (`127.0.0.1:1`), que el guard no reconoce: se niegan antes de construir el cliente. Si alguien
// les quitara el guard, intentarían conectar con ese loopback —que no escucha— y el test caería por
// el mensaje, no por la conexión. La URL de producción no se le pasa nunca a un hijo.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { casosEscritos } from './_casos-escritos.mjs'; // SCRUM-1415 · un caso por fila, con su nombre escrito
import { analizarConexion, censarConexiones, SIEMBRA, CLASES } from '../scripts/_censo-conexiones-a-base.mjs';
import { comprobarCredencialDeProduccion, OK, PRODUCCION_EN_ARBOL } from '../scripts/_clave-vs-destino.mjs';
import { temporal, borrarTemporal } from './_temporal.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CENSO = path.join(RAIZ, 'scripts', '_censo-conexiones-a-base.mjs');
const LOOPBACK = 'postgresql://u:p@127.0.0.1:1/nada';

/** Entorno del hijo a mano: sin las variables de `node --test`, que lo dejarían sin ejecutar nada. */
function entornoLimpio(extra) {
  const env = { ...process.env, ...extra };
  for (const k of ['NODE_TEST_CONTEXT', 'NODE_OPTIONS', 'FORCE_COLOR']) delete env[k];
  for (const k of Object.keys(env)) if (/^DATABASE_URL/.test(k) && !(k in extra)) delete env[k];
  return env;
}

function arbolFabricado(ficheros) {
  const dir = temporal('scrum1575b-');
  for (const [rel, texto] of Object.entries(ficheros)) {
    fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
    fs.writeFileSync(path.join(dir, rel), texto);
  }
  return dir;
}

test('SCRUM-1575b · siembra · el instrumento VE su propio caso: conecta, escribe y no llama a ningún guard', () => {
  const a = analizarConexion(SIEMBRA.rel, SIEMBRA.fuente);
  assert.deepEqual([a.abre, a.escribe.length > 0, a.guardas.length], [true, true, 0],
    '🔴 el censo no ve un PrismaClient que borra filas sin guard: su «sin_guard_escribe = 0» no valdría nada.');
});

test('SCRUM-1575b · siembra · un árbol fabricado sale clasificado como se sabe que es', () => {
  const dir = arbolFabricado({
    'scripts/expuesto.mjs': SIEMBRA.fuente,
    'scripts/_clave-vs-destino.mjs': 'export function comprobarCredencialDeProduccion() {}',
    'scripts/guardado.mjs': "import { comprobarCredencialDeProduccion } from './_clave-vs-destino.mjs';\n" +
      "comprobarCredencialDeProduccion('DATABASE_URL', process.env.DATABASE_URL, 'x');\n" +
      'const p = new PrismaClient(); await p.quote.update({});\n',
    'scripts/dinamico.mjs': "const { exigirDestinoCorrecto } = await import('./_clave-vs-destino.mjs');\n" +
      "exigirDestinoCorrecto('DATABASE_URL_DEV', process.env.DATABASE_URL_DEV, 'x');\n" +
      'const p = new PrismaClient(); await p.quote.deleteMany({});\n',
    'scripts/a-mano.mjs': 'const info = parse(u);\nif (info.base !== "yaqu_dev_javier") process.exit(2);\n' +
      'const p = new PrismaClient(); await p.quote.update({});\n',
    'scripts/solo-avisa.mjs': 'console.log(host === PROD_HOST ? "ES PRODUCCIÓN" : "");\n' +
      'const p = new PrismaClient(); await p.quote.update({});\n',
    'scripts/helper.mjs': 'export async function limpia(prisma) { await prisma.$executeRawUnsafe("delete from x"); }\n',
    'tests/hook.test.mjs': "import { spawnSync } from 'node:child_process';\n" +
      "spawnSync(process.execPath, ['hook.mjs'], { input: 'npx prisma db push' });\n",
    'scripts/sin-base.mjs': 'export const nada = 1;\n',
  });
  try {
    const { filas } = censarConexiones(dir);
    const clase = Object.fromEntries(filas.map((f) => [f.rel, f.clase]));
    assert.deepEqual(clase, {
      'scripts/a-mano.mjs': 'guard_propio',
      'scripts/dinamico.mjs': 'protegido',
      'scripts/expuesto.mjs': 'sin_guard_escribe',
      'scripts/guardado.mjs': 'protegido',
      'scripts/helper.mjs': 'usa_cliente_ajeno',
      'scripts/solo-avisa.mjs': 'sin_guard_escribe',
    }, '🔴 el censo clasifica mal un árbol cuya respuesta se conoce. Ni el test del hook ni el fichero sin base conectan.');
  } finally {
    borrarTemporal(dir);
  }
});

test('SCRUM-1575b · sin nada que censar dice CIEGO y sale 2, no un verde', () => {
  const dir = arbolFabricado({ 'scripts/sin-base.mjs': 'export const nada = 1;\n' });
  try {
    const r = spawnSync(process.execPath, [CENSO, dir], { encoding: 'utf8', env: entornoLimpio({}) });
    assert.equal(r.status, 2, `🔴 un árbol sin conexiones salió ${r.status}: ${r.stdout}${r.stderr}`);
    assert.match(r.stdout, /^CIEGO/, '🔴 el cero no dice CIEGO.');
  } finally {
    borrarTemporal(dir);
  }
});

test('SCRUM-1575b · trinquete · en el árbol real ningún script ni test escribe sin guard de destino', () => {
  const { poblacion, filas } = censarConexiones(RAIZ);
  assert.ok(poblacion.parseados >= 1500 && filas.length >= 50,
    `🔴 CENSO CIEGO: ${poblacion.parseados} ficheros parseados y ${filas.length} conexiones; el 22-oct eran 1.936 y 61.`);
  assert.ok(filas.every((f) => CLASES.includes(f.clase)));
  const graves = filas.filter((f) => f.clase === 'sin_guard_escribe').map((f) => f.rel);
  assert.deepEqual(graves, [],
    '🔴 HAY UN SCRIPT QUE CONECTA CON UNA BASE, ESCRIBE Y NO PASA POR EL GUARD DE DESTINO:\n    ' + graves.join('\n    ') + '\n\n' +
    '  Patrón: `comprobarCredencialDeProduccion(clave, url, worktree)` de `scripts/_clave-vs-destino.mjs`\n' +
    '  sobre la MISMA url que recibe el cliente, y negarse si no es `OK` (lo hacen `preview-migracion.mjs`\n' +
    '  y los dos backfills). Para una clave `_DEV`/`_STAGING`/`_TESTS`, `exigirDestinoCorrecto`.');
});

/**
 * Por AST: ¿el script llama a `comprobarCredencialDeProduccion('DATABASE_URL', X, …)` ANTES de
 * `new PrismaClient({ datasources: { db: { url: X } } })`, con la MISMA variable X? Devuelve X o null.
 */
function variableComprobadaYEntregada(fuente) {
  const sf = ts.createSourceFile('s.mjs', fuente, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  let comprobada = null; let posGuard = Infinity; let entregada = null; let posCliente = Infinity;
  const rec = (n) => {
    if (ts.isCallExpression(n) && ts.isIdentifier(n.expression) && n.expression.text === 'comprobarCredencialDeProduccion'
      && n.arguments[0]?.getText(sf) === "'DATABASE_URL'" && ts.isIdentifier(n.arguments[1])) {
      comprobada = n.arguments[1].text; posGuard = Math.min(posGuard, n.getStart(sf));
    }
    if (ts.isNewExpression(n) && n.expression.getText(sf) === 'PrismaClient') {
      posCliente = Math.min(posCliente, n.getStart(sf));
      const m = /datasources:\s*\{\s*db:\s*\{\s*url(?:\s*:\s*(\w+))?\s*\}/.exec(n.arguments?.[0]?.getText(sf) ?? '');
      if (m) entregada = m[1] ?? 'url';
    }
    ts.forEachChild(n, rec);
  };
  rec(sf);
  return comprobada && comprobada === entregada && posGuard < posCliente ? comprobada : null;
}

// URLs FABRICADAS. Ninguna se le da a un proceso ni a un cliente: sólo a la función pura.
const PRODUCCION_FABRICADA = 'postgresql://u:p@autorack.proxy.rlwy.net:5432/railway';
const DEV_FABRICADA = 'postgresql://u:p@acela.proxy.rlwy.net:5432/yaqu_dev_javier';

const BACKFILLS = [
  { script: 'backfill-quote-numbers.mjs', nombre: 'numbers' },
  { script: 'backfill-quote-jobid.mjs', nombre: 'jobid' },
];

{
  const decideUrl = casosEscritos(BACKFILLS,
    (f) => `SCRUM-1575b · ${f.nombre} · la url que comprueba el guard es la que recibe el cliente: producción se niega y dev pasa`,
    ({ script }) => {
    const fuente = fs.readFileSync(path.join(RAIZ, 'scripts', script), 'utf8');
    assert.ok(variableComprobadaYEntregada(fuente),
      `🔴 ${script} no comprueba con comprobarCredencialDeProduccion('DATABASE_URL', x) la MISMA x que le da al cliente, ANTES de construirlo.`);
    assert.equal(comprobarCredencialDeProduccion('DATABASE_URL', PRODUCCION_FABRICADA, 'x').veredicto, PRODUCCION_EN_ARBOL,
      '🔴 una URL de producción no se niega.');
    assert.equal(comprobarCredencialDeProduccion('DATABASE_URL', DEV_FABRICADA, 'x').veredicto, OK,
      '🔴 CONTROL POSITIVO: un destino declarado no-producción tampoco pasa; el guard se negaría siempre.');
  });

  const decideDestino = casosEscritos(BACKFILLS,
    (f) => `SCRUM-1575b · ${f.nombre} · se NIEGA ante un destino no declarado, antes de construir el cliente`,
    ({ script }) => {
    const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'scrum1575b-cwd-'));
    try {
      const r = spawnSync(process.execPath, [path.join(RAIZ, 'scripts', script)], {
        cwd, encoding: 'utf8', timeout: 60_000, env: entornoLimpio({ DATABASE_URL: LOOPBACK }),
      });
      assert.equal(r.status, 1, `🔴 ${script} salió ${r.status} con un destino no declarado:\n${r.stdout}${r.stderr}`);
      assert.match(r.stderr, /DESTINO NO RECONOCIDO/,
        `🔴 ${script} no se negó por el guard de destino (¿intentó conectar?):\n${r.stderr}`);
    } finally {
      fs.rmSync(cwd, { recursive: true, force: true });
    }
  });

  test('SCRUM-1575b · numbers · la url que comprueba el guard es la que recibe el cliente: producción se niega y dev pasa', decideUrl(0));
  test('SCRUM-1575b · jobid · la url que comprueba el guard es la que recibe el cliente: producción se niega y dev pasa', decideUrl(1));
  test('SCRUM-1575b · numbers · se NIEGA ante un destino no declarado, antes de construir el cliente', decideDestino(0));
  test('SCRUM-1575b · jobid · se NIEGA ante un destino no declarado, antes de construir el cliente', decideDestino(1));
  decideUrl.todos();
  decideDestino.todos();
}
