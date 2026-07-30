// GUARD · UNA URL CON CREDENCIAL NUNCA VIAJA EN EL ARGV DE UN SUBPROCESO. — SCRUM-226 · DBURL-GUARD-1
//
// EL DEFECTO: pasar una URL de BD CON CONTRASEÑA de forma que acabe en el argv de un hijo
// (spawn/execFile). El argv de un proceso es MUNDIALMENTE VISIBLE mientras corre: `ps aux`,
// `/proc/<pid>/cmdline`. Costó dos cosas esta semana: fugó credenciales de PRODUCCIÓN (SCRUM-196)
// y, por el susto, mató el wrapper `db-push-prod` (SCRUM-223).
//
// POR QUÉ UN GUARD Y NO UNA REVISIÓN: el repo tiene DOS comentarios que se CONTRADICEN sobre esto,
// y el equivocado ENSEÑA mal —
//   · scripts/backup-dump.mjs (CORRECTO, aprendido en SCRUM-196): «pasar la URL como ARGUMENTO
//     —buena práctica contra inyección de shell— es JUSTO lo que mete el secreto en argv, visible
//     en ps → se usa PGPASSWORD + una URL ya sin contraseña».
//   · scripts/preflight-schema-drift.mjs (lo tenía al REVÉS): «así la URL viaja como argumento y
//     no acaba en una línea de shell donde su contraseña sería visible» — falso: argv ES lo que ve
//     `ps`. Y justo debajo, el defecto: `--from-url <url-con-credencial>`.
// Las dos fugas vinieron de sesiones COPIANDO formas. Un comentario que enseña mal es una fuga
// esperando su turno. Este guard fija UNA sola verdad y falla sobre CUALQUIER script que la rompa.
//
// LA FORMA DE LA REGLA (estructural, sin allowlist): una llamada de la familia spawn cuyo ARRAY de
// argv contenga (a) un flag cuyo siguiente token es una URL con credencial —`--from-url`/`--to-url`/
// `--url`— o (b) un `process.env.DATABASE_URL*` crudo como elemento. Las formas SEGURAS no casan
// solas: la URL viaja por el ENTORNO (env `DATABASE_URL` que lee `--from-schema-datasource`) o por
// `PGPASSWORD` con la URL ya sin contraseña. Eso —que lo seguro no dispare sin lista— es lo que lo
// hace un guard y no una lista de los que hoy fallan.
//
// FUERA DE ALCANCE, dicho aquí y REPETIDO en el mensaje de fallo (PASO 5): esto SOLO mira el código
// versionado. Las dos fugas reales fueron COMANDOS AD-HOC de sesión — una URL tecleada en la shell,
// que ningún guard del repo puede ver. Cobertura CERO ahí. Verde aquí = «ningún fichero del repo lo
// hace», NO «no puede volver a pasar». Un guard que da sensación de cobertura que no tiene es peor
// que no tenerlo, así que el fallo lo dice en voz alta. También queda fuera el vector `exec`/
// `execSync` (cadena de SHELL, no array de argv) y el de imprimir el stderr del hijo: ninguno se
// expresa limpiamente como regla AST y no queremos un guard difuso (ese print se arregla a mano en
// preflight, no aquí).
//
// ⚠️ AST, no `grep`. Esta cabecera y el Set FLAGS_URL_EN_ARGV contienen los literales prohibidos;
// solo cuentan DENTRO del argv de una llamada spawn real —no como prosa ni como elementos de un Set—
// así que el árbol no se caza a sí mismo (SCRUM-176/168). Aun así el fichero se excluye por RUTA:
// cinturón y tirantes, igual que el guard de colisiones del dashboard.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const THIS_FILE = fileURLToPath(import.meta.url);
const RAIZ = path.join(path.dirname(THIS_FILE), '..');

const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'coverage', '.claude', 'storage', '.playwright-mcp']);
const CODE_EXT = new Set(['.ts', '.js', '.mjs', '.cjs']);

// Familia de arranque de subprocesos que toma un ARRAY de argv (node:child_process). `exec`/
// `execSync` quedan FUERA a propósito: reciben una cadena de shell, otro vector que esta regla AST
// no cubre (ver «FUERA DE ALCANCE» arriba). `fork` incluido: también arranca un hijo con args.
const SPAWN_FNS = new Set(['spawn', 'spawnSync', 'execFile', 'execFileSync', 'fork']);

// Flags de prisma/pg cuyo SIGUIENTE token es una URL de BD con credencial. Su presencia en el argv
// de un spawn ES el defecto — la forma segura no los usa (ver cabecera). Literales a propósito: que
// se puedan `grep` a mano igual que hace este guard.
const FLAGS_URL_EN_ARGV = new Set(['--from-url', '--to-url', '--url']);

/** ¿`node` es exactamente `process.env`? */
function esProcessEnv(node) {
  return ts.isPropertyAccessExpression(node)
    && ts.isIdentifier(node.expression) && node.expression.text === 'process'
    && node.name.text === 'env';
}

/** ¿`node` es `process.env.DATABASE_URL*` (por punto o por corchete)? La URL cruda, sin redactar. */
function esProcessEnvDbUrl(node) {
  if (ts.isPropertyAccessExpression(node) && esProcessEnv(node.expression)) {
    return /^DATABASE_URL/.test(node.name.text);
  }
  if (ts.isElementAccessExpression(node) && esProcessEnv(node.expression)
      && node.argumentExpression && ts.isStringLiteralLike(node.argumentExpression)) {
    return /^DATABASE_URL/.test(node.argumentExpression.text);
  }
  return false;
}

/** Nombre de la función llamada: `spawnSync(...)` o `cp.spawnSync(...)` / `child_process.execFileSync(...)`. */
function nombreCallee(node) {
  const e = node.expression;
  if (ts.isIdentifier(e)) return e.text;
  if (ts.isPropertyAccessExpression(e)) return e.name.text;
  return null;
}

/**
 * Recorre el AST y devuelve TODA llamada de la familia spawn cuyo argv (un array literal entre sus
 * argumentos) meta una credencial en argv. Devuelve [{ token, linea }].
 */
export function argvConCredencial(codigo, ruta = 'anon.mjs') {
  const sf = ts.createSourceFile(ruta, codigo, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  const hallazgos = [];
  const lineaDe = (nodo) => sf.getLineAndCharacterOfPosition(nodo.getStart(sf)).line + 1;

  function visit(node) {
    if (ts.isCallExpression(node) && SPAWN_FNS.has(nombreCallee(node))) {
      for (const arg of node.arguments) {
        if (!ts.isArrayLiteralExpression(arg)) continue; // el argv es un array literal
        for (const el of arg.elements) {
          if (ts.isStringLiteralLike(el) && FLAGS_URL_EN_ARGV.has(el.text)) {
            hallazgos.push({ token: el.text, linea: lineaDe(el) });
          } else if (esProcessEnvDbUrl(el)) {
            hallazgos.push({ token: 'process.env.DATABASE_URL* (URL cruda en argv)', linea: lineaDe(el) });
          }
        }
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(sf);
  return hallazgos;
}

function walk(dir, out) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) walk(full, out);
      continue;
    }
    if (full === THIS_FILE) continue; // el propio guard, ver ⚠️ AST arriba
    if (CODE_EXT.has(path.extname(entry.name))) out.push(full);
  }
  return out;
}

function escanearRepo() {
  const hallazgos = [];
  for (const f of walk(RAIZ, [])) {
    const codigo = fs.readFileSync(f, 'utf8');
    for (const h of argvConCredencial(codigo, f)) {
      hallazgos.push(`${path.relative(RAIZ, f).replace(/\\/g, '/')}:${h.linea} → ${h.token}`);
    }
  }
  return hallazgos;
}

// ── 1 · SUELO: que el escaneo tenga algo real que mirar ──────────────────────────────────────
// Si el walk se rompe (una ruta mal, un filtro de más), la lista sale vacía y el guard pasa en
// VERDE sin haber leído un fichero. Verde hueco — el peor en un guard de seguridad.
test('SCRUM-226 · SUELO: el escaneo recorre el repo y alcanza scripts/ (no un verde hueco)', () => {
  const ficheros = walk(RAIZ, []).map((f) => path.relative(RAIZ, f).replace(/\\/g, '/'));
  assert.ok(ficheros.length >= 50, `🔴 solo se recorrieron ${ficheros.length} ficheros: el walk está roto`);
  assert.ok(ficheros.includes('scripts/backup-dump.mjs'),
    '🔴 el escaneo no llegó a scripts/ — cobertura falsa');
  assert.ok(ficheros.includes('scripts/preflight-schema-drift.mjs'),
    '🔴 el escaneo no ve el preflight — justo el fichero que motivó el guard');
});

// ── 2 · QUE EL DETECTOR DETECTA (fuentes sintéticas, no el repo) ──────────────────────────────
// Sin esto «0 hallazgos» no distingue «repo limpio» de «detector ciego».
test('SCRUM-226 · detecta --from-url en el argv de un spawn (el defecto vivo de SCRUM-196)', () => {
  const h = argvConCredencial("spawnSync(node, ['migrate','diff','--from-url', url, '--script']);");
  assert.equal(h.length, 1);
  assert.equal(h[0].token, '--from-url');
});

test('SCRUM-226 · detecta --to-url y --url igual, y en cp.execFileSync (callee con punto)', () => {
  assert.equal(argvConCredencial("cp.execFileSync('prisma', ['migrate','diff','--to-url', u]);").length, 1);
  assert.equal(argvConCredencial("spawn('prisma', ['db','execute','--url', u]);").length, 1);
});

test('SCRUM-226 · detecta process.env.DATABASE_URL* crudo como elemento de argv (punto y corchete)', () => {
  const h = argvConCredencial("execFileSync('psql', [process.env.DATABASE_URL_STAGING]);");
  assert.equal(h.length, 1);
  assert.match(h[0].token, /DATABASE_URL/);
  assert.equal(argvConCredencial("spawnSync('psql', [process.env['DATABASE_URL']]);").length, 1);
});

// ── 3 · QUE NO MARCA LO SEGURO (las dos formas que YA existen en el repo) ─────────────────────
test('SCRUM-226 · NO marca --from-schema-datasource: la URL va por el entorno (db-push-prod)', () => {
  assert.deepEqual(
    argvConCredencial(
      "spawnSync(node, ['migrate','diff','--from-schema-datasource','prisma/schema.prisma'," +
      "'--to-schema-datamodel', DATAMODEL], { env: { DATABASE_URL: url } });",
    ),
    [],
  );
});

test('SCRUM-226 · NO marca una URL YA sin contraseña + PGPASSWORD en el entorno (backup-dump)', () => {
  assert.deepEqual(
    argvConCredencial("execFileSync('pg_dump', ['--format=custom', urlSinPass], { env: { PGPASSWORD: pass } });"),
    [],
  );
});

test('SCRUM-226 · un flag prohibido en COMENTARIO o fuera de un spawn no cuenta (AST, no grep)', () => {
  assert.deepEqual(argvConCredencial("// nunca uses --from-url con la URL en argv\nconst x = 1;"), []);
  // Un array que no es argumento de un spawn (p. ej. el propio Set de este guard) es inmune.
  assert.deepEqual(argvConCredencial("const flags = new Set(['--from-url', '--to-url', '--url']);"), []);
});

// ── 4 · EL GUARD ─────────────────────────────────────────────────────────────────────────────
test('SCRUM-226 · GUARD: ningún spawn del repo mete una URL con credencial en argv', () => {
  const hallazgos = escanearRepo();
  assert.deepEqual(
    hallazgos, [],
    '🔴 URL CON CREDENCIAL EN ARGV — visible para cualquiera con `ps` / /proc/<pid>/cmdline:\n   '
    + hallazgos.join('\n   ')
    + '\n\n   El secreto NO viaja en el argv de un subproceso. Formas seguras que YA existen en el'
    + '\n   repo (úsalas, no inventes otra):'
    + '\n     · prisma: --from-schema-datasource <schema> + env DATABASE_URL   (scripts/db-push-prod)'
    + '\n     · pg_*  : URL sin contraseña en argv + PGPASSWORD en el entorno   (scripts/backup-dump.mjs)'
    + '\n   Costó dos veces esta semana: fugó credenciales de prod (SCRUM-196) y mató db-push-prod (SCRUM-223).'
    + '\n\n   ⚠️ ALCANCE — lo que este guard NO ve: SOLO mira el código del repo. Las DOS fugas reales'
    + '\n   fueron COMANDOS AD-HOC de sesión (una URL tecleada en la shell), y ahí la cobertura es'
    + '\n   CERO: ningún guard del repo ve un comando que no está en el repo. Verde aquí NO significa'
    + '\n   «no puede volver a pasar» — significa «ningún fichero versionado lo hace».',
  );
});
