// scripts/_censo-conexiones-a-base.mjs — SCRUM-1575b
//
// ¿QUÉ SCRIPTS CONECTAN CON UNA BASE SIN PASAR POR EL GUARD DE DESTINO?
//
// SCRUM-1575 arregló UNO (`preview-migracion.mjs`) y dejó escrito su «no medido»: los demás. Este
// censo los busca por AST —no por grep: un mensaje que dice «corre `prisma db push`» no conecta con
// nada— en `scripts/**` y `tests/**`, y para cada uno dice:
//
//   · CÓMO conecta: `new PrismaClient`, un `$executeRaw`, o un proceso hijo (`prisma db …`,
//     `prisma migrate …` con URL, `psql`, `pg_dump`, `pg_restore`);
//   · DE QUÉ CLAVE saca la URL (`process.env.DATABASE_URL*` y literales de clave);
//   · si LLAMA a un guard de destino (`_clave-vs-destino.mjs` o `_db-guard.mjs`), directo o a
//     través de un módulo local que lo llama;
//   · si puede ESCRIBIR.
//
// Y lo clasifica (`CLASES`, de más grave a menos): `sin_guard_escribe` (el grave) · `sin_guard_lee` ·
// `guard_propio` (compara `.base`/`.host` o `PROD_HOST` a mano, sin la función de la casa) ·
// `usa_cliente_ajeno` (no abre conexión: usa un cliente que le pasan, y el destino lo decide quien
// lo construyó) · `banco_desechable` (tests de Postgres de usar y tirar, que ya exigen loopback y
// `_test`) · `protegido`.
//
// ⛔ NO EJECUTA NADA NI CONECTA CON NADA. Lee ficheros y los parsea.
//
// LO QUE NO VE (dicho aquí para que su cero no se lea como «limpio»):
//   · Un proceso hijo cuyo comando se arma ENTERO en variables sin ningún literal reconocible.
//     Se buscan literales sueltos (`'db'`, `'push'`, `'psql'`) en todo el fichero, no sólo en la
//     llamada: así se ve `preview-migracion.mjs`, que arma los argumentos lejos del `spawn`.
//   · «Llama al guard» no es «lo llama ANTES de conectar»: se da `guardaAntes` comparando la
//     posición en el texto, que es un indicio, no un flujo de control.
//   · La protección indirecta se da si el fichero llama a CUALQUIER cosa importada de un módulo
//     local que llama a un guard, no necesariamente a la que guarda.
//   · Ficheros que no son JS/TS (`scripts/db-push-prod`, `.ps1`): fuera del AST. Se declaran.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** Las funciones que deciden el destino, por módulo. A mano: una función nueva se da de alta aquí. */
export const GUARDAS = Object.freeze({
  '_clave-vs-destino.mjs': Object.freeze(['exigirDestinoCorrecto', 'comprobarClaveVsDestino', 'comprobarCredencialDeProduccion']),
  '_db-guard.mjs': Object.freeze(['destinoSembrable', 'destinoDesechable', 'assertSafeStagingUrl']),
});

const EJECUTA = /^(execFileSync|execFile|spawnSync|spawn|exec|execSync|execa)$/;
const ESCRIBE_PRISMA = /^(create|createMany|createManyAndReturn|update|updateMany|upsert|delete|deleteMany)$/;
const EJECUTA_SQL_CRUDO = /^\$(executeRaw|executeRawUnsafe)$/;
const LEE_SQL_CRUDO = /^\$(queryRaw|queryRawUnsafe)$/;
const URL_DE_MIGRATE = /^--(from-url|to-url|from-schema-datasource|to-schema-datasource|from-migrations|shadow-database-url|url)(=|$)/;
const CLAVE_DE_BASE = /^(DATABASE_URL\w*|\w*_PG_URL|PG_URL\w*|POSTGRES\w*_URL)$/;
const BANCO_DESECHABLE = /LIBRO_PG_URL|destinoDesechable|PGlite|@electric-sql\/pglite/;

const textoDe = (n) => (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n) ? n.text : null);

/**
 * Por AST, sobre UNA fuente: qué conexiones abre, de qué claves, qué guards llama y si escribe.
 * PURA: ni ficheros ni entorno, para poder sembrarle casos fabricados.
 */
export function analizarConexion(rel, fuente) {
  const sf = ts.createSourceFile(rel, fuente, ts.ScriptTarget.Latest, true,
    /\.ts$/.test(rel) ? ts.ScriptKind.TS : ts.ScriptKind.JS);
  const conecta = new Set();
  const escribe = new Set();
  const claves = new Set();
  const guardas = new Set();
  const importados = new Map();   // nombre local → { modulo, importado }
  const llamadas = [];            // { nombre, pos } de identificadores llamados
  let primeraConexion = Infinity;
  let primeraGuarda = Infinity;
  let ejecutaProceso = false;
  let guardPropio = false;        // compara el host con PROD_HOST a mano, sin la función de la casa
  const literales = [];           // literales de una sola palabra, o que EMPIEZAN por un comando

  // ¿La comparación DECIDE algo? Sólo si está en la condición de un `if` o dentro de un `assert`.
  // `host === PROD_HOST ? '⚠️ ES PRODUCCIÓN' : ''` en un `console.log` avisa y sigue: no es un guard.
  const decide = (n) => {
    for (let hijo = n, p = n.parent; p; hijo = p, p = p.parent) {
      if (ts.isIfStatement(p)) return p.expression === hijo;
      if (ts.isCallExpression(p) && /^assert(\.\w+)?$/.test(p.expression.getText(sf))) return true;
      if (ts.isConditionalExpression(p) && p.condition === hijo) return false;
      if (ts.isBlock(p) || ts.isSourceFile(p)) return false;
    }
    return false;
  };
  const marcaConexion = (senal, pos) => { conecta.add(senal); primeraConexion = Math.min(primeraConexion, pos); };

  const rec = (n) => {
    // `const { X } = await import('./m.mjs')` y `await import(pathToFileURL(RAIZ + '/scripts/m.mjs').href)`:
    // el módulo es el literal que acaba en .mjs/.js dentro de la llamada.
    if (ts.isVariableDeclaration(n) && n.initializer && ts.isObjectBindingPattern(n.name)) {
      const ini = ts.isAwaitExpression(n.initializer) ? n.initializer.expression : n.initializer;
      if (ts.isCallExpression(ini) && ini.expression.kind === ts.SyntaxKind.ImportKeyword) {
        let modulo = null;
        const busca = (x) => { const t = textoDe(x); if (t && !modulo && /(\.m?js|@prisma\/client)$/.test(t)) modulo = t; ts.forEachChild(x, busca); };
        busca(ini);
        if (modulo) {
          if (/^\//.test(modulo)) modulo = '.' + modulo.replace(/^\/(scripts|tests)\//, '/');
          for (const el of n.name.elements) {
            if (ts.isIdentifier(el.name)) importados.set(el.name.text, { modulo, importado: el.propertyName && ts.isIdentifier(el.propertyName) ? el.propertyName.text : el.name.text });
          }
        }
      }
    }
    if (ts.isImportDeclaration(n) && n.importClause && ts.isStringLiteral(n.moduleSpecifier)) {
      const modulo = n.moduleSpecifier.text;
      if (/^(pg|postgres|pg-promise)$/.test(modulo)) marcaConexion(`import ${modulo}`, n.getStart(sf));
      const nb = n.importClause.namedBindings;
      if (nb && ts.isNamedImports(nb)) {
        for (const el of nb.elements) importados.set(el.name.text, { modulo, importado: (el.propertyName ?? el.name).text });
      }
      if (n.importClause.name) importados.set(n.importClause.name.text, { modulo, importado: 'default' });
    }
    // `info.base === 'yaqu_dev_javier'`, `host !== PROD_HOST`: una comprobación de destino a mano.
    if (ts.isBinaryExpression(n) && /^(===|!==|==|!=)$/.test(n.operatorToken.getText(sf))) {
      const lados = [n.left, n.right].map((x) => x.getText(sf));
      if (lados.some((t) => /(^|\.)(base|host)$/.test(t) || /_HOST$|HOST_PRODUCCION$/.test(t)) && decide(n)) guardPropio = true;
    }
    if (ts.isNewExpression(n)) {
      const t = n.expression.getText(sf);
      if (/(^|\.)PrismaClient$/.test(t)) {
        marcaConexion('new PrismaClient', n.getStart(sf));
        // Sin argumentos, Prisma toma la URL del `env("DATABASE_URL")` del esquema.
        if (!n.arguments || n.arguments.length === 0) claves.add('DATABASE_URL (implícita)');
      }
      if (/^(pg\.)?(Client|Pool)$/.test(t) && importados.get(t.replace(/^pg\./, ''))?.modulo === 'pg') marcaConexion(`new ${t} (pg)`, n.getStart(sf));
    }
    if (ts.isCallExpression(n) || ts.isTaggedTemplateExpression(n)) {
      const e = ts.isCallExpression(n) ? n.expression : n.tag;
      const nom = ts.isPropertyAccessExpression(e) ? e.name.text : ts.isIdentifier(e) ? e.text : '';
      if (ts.isIdentifier(e)) llamadas.push({ nombre: e.text, pos: n.getStart(sf) });
      if (EJECUTA.test(nom) && ts.isCallExpression(n)) {
        ejecutaProceso = true;
        // Una orden entera («npx prisma db push») sólo cuenta si es el ARGUMENTO del proceso: en
        // un test del hook la misma cadena es la entrada que se le da a leer, y no conecta.
        for (const a of n.arguments) {
          const t = ts.isTemplateExpression(a) ? a.head.text.trim() : (textoDe(a) ?? '').trim();
          if (/^(npx\s+)?(prisma|psql|pg_dump|pg_restore)\s/.test(t)) literales.push(t);
        }
      }
      if (EJECUTA_SQL_CRUDO.test(nom)) { escribe.add(nom); marcaConexion(nom, n.getStart(sf)); }
      if (LEE_SQL_CRUDO.test(nom)) marcaConexion(nom, n.getStart(sf));
      // `prisma.modelo.update(...)`: el receptor es OTRO acceso a propiedad. Así no casan
      // `hash.update(...)` ni `crypto.createHash(...).update(...)`.
      if (ESCRIBE_PRISMA.test(nom) && ts.isPropertyAccessExpression(e) && ts.isPropertyAccessExpression(e.expression)) {
        escribe.add(`.${nom}`);
      }
    }
    // process.env.X y process.env['X']
    if (ts.isPropertyAccessExpression(n) && /^process\.env$/.test(n.expression.getText(sf)) && CLAVE_DE_BASE.test(n.name.text)) claves.add(n.name.text);
    if (ts.isElementAccessExpression(n) && /^process\.env$/.test(n.expression.getText(sf))) {
      const k = textoDe(n.argumentExpression);
      if (k && CLAVE_DE_BASE.test(k)) claves.add(k);
    }
    const lit = textoDe(n);
    if (lit !== null) {
      if (CLAVE_DE_BASE.test(lit)) claves.add(lit);
      // `l.startsWith('DATABASE_URL_DEV=')`: la clave leída a mano del `.env`.
      if (/=$/.test(lit) && CLAVE_DE_BASE.test(lit.slice(0, -1))) claves.add(lit.slice(0, -1));
      const t = lit.trim();
      if (/^\S+$/.test(t)) literales.push(t);
    }
    ts.forEachChild(n, rec);
  };
  rec(sf);

  // ── Procesos hijo: sólo si el fichero lanza alguno ──
  if (ejecutaProceso) {
    const fichas = literales.flatMap((l) => l.split(/\s+/));
    const tiene = (x) => fichas.includes(x);
    const prisma = fichas.some((f) => f === 'prisma' || /prisma[\\/]build[\\/]index\.js$/.test(f));
    if (prisma && tiene('db') && (tiene('push') || tiene('execute') || tiene('pull') || tiene('seed'))) {
      marcaConexion('prisma db', 0);
      if (tiene('push') || tiene('execute') || tiene('seed')) escribe.add('prisma db push/execute/seed');
    }
    if (prisma && tiene('migrate')) {
      if (fichas.some((f) => URL_DE_MIGRATE.test(f)) || tiene('deploy') || tiene('reset') || tiene('resolve')) marcaConexion('prisma migrate', 0);
      if (tiene('deploy') || tiene('reset') || tiene('resolve') || tiene('dev')) escribe.add('prisma migrate deploy/reset/resolve/dev');
    }
    if (tiene('psql')) { marcaConexion('psql', 0); escribe.add('psql (puede escribir)'); }
    if (tiene('pg_restore')) { marcaConexion('pg_restore', 0); escribe.add('pg_restore'); }
    if (tiene('pg_dump')) marcaConexion('pg_dump', 0);
  }

  // ── Guards llamados directamente ──
  for (const { nombre, pos } of llamadas) {
    const imp = importados.get(nombre);
    if (!imp) continue;
    const base = path.posix.basename(imp.modulo);
    if (GUARDAS[base]?.includes(imp.importado)) { guardas.add(`${base}:${imp.importado}`); primeraGuarda = Math.min(primeraGuarda, pos); }
  }

  // ¿ABRE la conexión, o usa un cliente que le pasan? `$queryRaw` sobre un parámetro no abre nada:
  // el destino lo decide quien construyó el cliente.
  const abre = [...conecta].some((c) => !/^\$|^\./.test(c));

  return {
    rel,
    abre,
    guardPropio,
    conecta: [...conecta].sort(),
    escribe: [...escribe].sort(),
    claves: [...claves].sort(),
    guardas: [...guardas].sort(),
    guardaAntes: guardas.size > 0 ? primeraGuarda <= primeraConexion : null,
    importsLocales: [...importados.values()].filter((i) => i.modulo.startsWith('.')).map((i) => i.modulo),
    llamadosImportados: llamadas.filter((l) => importados.has(l.nombre)).map((l) => ({ nombre: l.nombre, ...importados.get(l.nombre) })),
    bancoDesechable: BANCO_DESECHABLE.test(fuente),
  };
}

function ficherosDe(dirs, raiz) {
  const out = [];
  const rec = (dir) => {
    if (!fs.existsSync(dir)) return;
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) { if (e.name !== 'node_modules' && e.name !== 'fixtures') rec(p); continue; }
      out.push(p);
    }
  };
  for (const d of dirs) rec(path.join(raiz, d));
  return out;
}

/**
 * El censo sobre un árbol. La raíz entra por parámetro para poder ponerle delante uno FABRICADO.
 * Devuelve la población (cuántos ficheros se parsearon y cuáles quedaron fuera del AST) y una fila
 * por fichero que conecta.
 */
export function censarConexiones(raiz = RAIZ) {
  const todos = ficherosDe(['scripts', 'tests'], raiz);
  const rel = (f) => path.relative(raiz, f).replace(/\\/g, '/');
  const parseables = todos.filter((f) => /\.(mjs|js|cjs|ts)$/.test(f) && !/\.d\.ts$/.test(f));
  const fueraDelAst = todos.filter((f) => !parseables.includes(f) && !/\.(json|md|sql|txt|xml|xsd|csv|pdf|png)$/i.test(f)).map(rel).sort();

  const analisis = new Map();
  for (const f of parseables) analisis.set(rel(f), analizarConexion(rel(f), fs.readFileSync(f, 'utf8')));

  // Un módulo local que llama a un guard es un GUARDIÁN: quien llame a lo que exporta, pasa por él.
  const guardianes = new Set([...analisis.values()].filter((a) => a.guardas.length > 0).map((a) => a.rel));
  const resolver = (desde, modulo) => path.posix.normalize(path.posix.join(path.posix.dirname(desde), modulo));

  const filas = [];
  for (const a of analisis.values()) {
    if (a.conecta.length === 0) continue;
    if (/^scripts\/_(clave-vs-destino|db-guard)\.mjs$/.test(a.rel)) continue;
    const indirectas = [...new Set(a.llamadosImportados
      .filter((l) => l.modulo.startsWith('.') && guardianes.has(resolver(a.rel, l.modulo)))
      .map((l) => `${path.posix.basename(l.modulo)}:${l.importado}`))].sort();
    const protegido = a.guardas.length > 0 || indirectas.length > 0;
    const clase = protegido ? 'protegido'
      : a.rel.startsWith('tests/') && a.bancoDesechable ? 'banco_desechable'
      : !a.abre ? 'usa_cliente_ajeno'
      : a.guardPropio ? 'guard_propio'
      : a.escribe.length > 0 ? 'sin_guard_escribe'
      : 'sin_guard_lee';
    filas.push({ rel: a.rel, clase, conecta: a.conecta, escribe: a.escribe, claves: a.claves,
      guardas: a.guardas, guardasIndirectas: indirectas, guardaAntes: a.guardaAntes });
  }
  filas.sort((x, y) => x.rel.localeCompare(y.rel));
  return { poblacion: { ficheros: todos.length, parseados: parseables.length, fueraDelAst }, filas };
}

/** Las clases, de la más grave a la menos. */
export const CLASES = Object.freeze(['sin_guard_escribe', 'sin_guard_lee', 'guard_propio', 'usa_cliente_ajeno', 'banco_desechable', 'protegido']);

/** Lo que el propio instrumento siembra para saber que ve: un script que conecta y escribe sin guard. */
export const SIEMBRA = Object.freeze({
  rel: 'scripts/__siembra-1575b.mjs',
  fuente: "import { PrismaClient } from '@prisma/client';\n" +
    'const p = new PrismaClient({ datasourceUrl: process.env.DATABASE_URL });\n' +
    'await p.quote.deleteMany({});\n',
});

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const raiz = process.argv[2] ? path.resolve(process.argv[2]) : RAIZ;
  const sembrada = analizarConexion(SIEMBRA.rel, SIEMBRA.fuente);
  const { poblacion, filas } = censarConexiones(raiz);
  const ve = sembrada.conecta.length > 0 && sembrada.escribe.length > 0 && sembrada.guardas.length === 0;
  if (!ve || poblacion.parseados === 0 || filas.length === 0) {
    console.log(`CIEGO · siembra vista=${ve} · parseados=${poblacion.parseados} · filas=${filas.length}`);
    process.exit(2);
  }
  const porClase = {};
  for (const f of filas) (porClase[f.clase] ??= []).push(f);
  console.log(`censo-conexiones · ${poblacion.ficheros} ficheros en scripts/ y tests/ · ${poblacion.parseados} parseados por AST · ${filas.length} conectan · siembra vista`);
  console.log(`fuera del AST: ${poblacion.fueraDelAst.join(', ') || '(ninguno)'}`);
  for (const clase of CLASES) {
    const xs = porClase[clase] ?? [];
    console.log(`\n## ${clase} · ${xs.length}`);
    for (const f of xs) {
      console.log(`- ${f.rel} · conecta: ${f.conecta.join('+')} · escribe: ${f.escribe.join('+') || '—'} · claves: ${f.claves.join(',') || '—'}` +
        (f.guardas.length || f.guardasIndirectas.length ? ` · guard: ${[...f.guardas, ...f.guardasIndirectas.map((g) => `vía ${g}`)].join(',')}${f.guardaAntes === false ? ' (DESPUÉS en el texto)' : ''}` : ''));
    }
  }
}
