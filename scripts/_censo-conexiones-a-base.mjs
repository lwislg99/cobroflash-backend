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
//   · SCRUM-1575d · Un SERVICIO de `dist/modules/` (`SIEMBRA_SERVICIO`) se ve si se llama por su
//     nombre importado (`await cambiarFlagFiscal(…)`) en un fichero que ya habla con una base. NO se
//     ve: llamado como miembro de un espacio de nombres (`S.emitInvoice(…)`), ni en un fichero que no
//     nombra ninguna clave de base y deja la URL al `.env` que cargue el propio servicio.
//
// SCRUM-1575c · 1575b sólo contaba como conexión `new PrismaClient`, el SQL crudo y los procesos
// hijo. Ahora también: el singleton `dist/core/db/prisma.js` consultado (`SIEMBRA_SINGLETON`), una
// consulta de modelo (`x.modelo.método({…})`) sobre un cliente que le pasan o que le abre un módulo
// local (`abiertoPor`), el guard que corre al importar (`import './_staging-db.mjs'`) y la posición de
// la conexión en la PRIMERA CONSULTA, no en el `new` (Prisma conecta al consultar).
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
// SCRUM-1575c · las lecturas de modelo. Sin ellas, quien sólo LEE con un cliente que le pasan no salía.
const LEE_PRISMA = /^(findFirst|findFirstOrThrow|findUnique|findUniqueOrThrow|findMany|count|aggregate|groupBy)$/;
// SCRUM-1575c · el cliente de la aplicación (`src/core/db/prisma.ts`): `new PrismaClient()` con la
// `DATABASE_URL` del entorno. Quien lo importa y consulta ABRE una conexión, aunque no construya nada.
const SINGLETON = /(^|\/)core\/db\/prisma(\.js|\.ts)?$/;
// SCRUM-1575d · un servicio compilado de la aplicación: escribe por dentro con el singleton.
const SERVICIO_DE_DIST = /(^|\/)dist\/modules\//;
const EJECUTA_SQL_CRUDO = /^\$(executeRaw|executeRawUnsafe)$/;
const LEE_SQL_CRUDO = /^\$(queryRaw|queryRawUnsafe)$/;
const URL_DE_MIGRATE = /^--(from-url|to-url|from-schema-datasource|to-schema-datasource|from-migrations|shadow-database-url|url)(=|$)/;
const CLAVE_DE_BASE = /^(DATABASE_URL\w*|\w*_PG_URL|PG_URL\w*|POSTGRES\w*_URL)$/;
const BANCO_DESECHABLE = /LIBRO_PG_URL|destinoDesechable|PGlite|@electric-sql\/pglite/;

const textoDe = (n) => (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n) ? n.text : null);

/**
 * Por AST, sobre UNA fuente: qué conexiones abre, de qué claves, qué guards llama y si escribe.
 * PURA: ni ficheros ni entorno, para poder sembrarle casos fabricados.
 * SCRUM-1575d · `opciones.servicioUsaBase(distRel)`: ¿el módulo `dist/modules/…` habla con la base?
 */
export function analizarConexion(rel, fuente, opciones = {}) {
  const sf = ts.createSourceFile(rel, fuente, ts.ScriptTarget.Latest, true,
    /\.ts$/.test(rel) ? ts.ScriptKind.TS : ts.ScriptKind.JS);
  const conecta = new Set();
  const escribe = new Set();
  const claves = new Set();
  const guardas = new Set();
  const importados = new Map();   // nombre local → { modulo, importado }
  const importsDeEfecto = [];     // SCRUM-1575c · `import './_staging-db.mjs'`: se ejecuta sin nombrar nada
  const llamadas = [];            // { nombre, pos } de identificadores llamados
  const consultas = [];           // SCRUM-1575c · { pos } de cada `x.modelo.método(…)` y `x.$queryRaw…`
  let primeraConexion = Infinity;
  let primerCliente = Infinity;   // SCRUM-1575c · `new PrismaClient` no conecta: conecta su primera consulta
  let primeraGuarda = Infinity;
  let primerProceso = Infinity;   // SCRUM-1575c · la llamada que lanza el hijo, no la posición 0
  let ejecutaProceso = false;
  // `prisma.quote.findMany` → `prisma`; `(await prismaStaging()).quote…` → null.
  const raizDe = (x) => { while (ts.isPropertyAccessExpression(x)) x = x.expression; return ts.isIdentifier(x) ? x.text : null; };
  const alias = new Map();        // SCRUM-1575c · nombre local → el cliente del que es otro nombre
  const sinAlias = (r) => { for (let k = 0; r && alias.has(r) && k < 8; k++) r = alias.get(r); return r; };
  // El SDK de Stripe también tiene `stripe.prices.create({…})`: ni es Prisma ni conecta con la base.
  const NO_ES_PRISMA = /^stripe$/i;
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
    // SCRUM-1575c · `const db = prisma`: otro nombre, el mismo cliente.
    if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && n.initializer && ts.isIdentifier(n.initializer)) {
      alias.set(n.name.text, n.initializer.text);
    }
    // `prisma.$transaction(async (tx) => …)` ya es una consulta de `prisma`: lo que haga `tx` dentro no
    // cambia quién abre (por eso no se sigue el nombre `tx`).
    if (ts.isCallExpression(n) && ts.isPropertyAccessExpression(n.expression) && n.expression.name.text === '$transaction') {
      consultas.push({ pos: n.getStart(sf), receptor: raizDe(n.expression.expression) });
    }
    // SCRUM-1575c · `({ prisma } = await import('../dist/core/db/prisma.js'))`: por asignación, sin `const`.
    if (ts.isBinaryExpression(n) && n.operatorToken.kind === ts.SyntaxKind.EqualsToken && ts.isObjectLiteralExpression(n.left)) {
      const ini = ts.isAwaitExpression(n.right) ? n.right.expression : n.right;
      const modulo = ts.isCallExpression(ini) && ini.expression.kind === ts.SyntaxKind.ImportKeyword ? textoDe(ini.arguments[0]) : null;
      if (modulo) {
        for (const p of n.left.properties) {
          if (ts.isShorthandPropertyAssignment(p)) importados.set(p.name.text, { modulo, importado: p.name.text });
          if (ts.isPropertyAssignment(p) && ts.isIdentifier(p.initializer) && ts.isIdentifier(p.name)) importados.set(p.initializer.text, { modulo, importado: p.name.text });
        }
      }
    }
    // `const { X } = await import('./m.mjs')` y `await import(pathToFileURL(RAIZ + '/scripts/m.mjs').href)`:
    // el módulo es el literal que acaba en .mjs/.js dentro de la llamada. SCRUM-1575c · también a
    // través de un envoltorio local (`await imp('dist/core/db/prisma.js')`, `tests/banco-scrum911/`).
    if (ts.isVariableDeclaration(n) && n.initializer && ts.isObjectBindingPattern(n.name)) {
      const ini = ts.isAwaitExpression(n.initializer) ? n.initializer.expression : n.initializer;
      const esImport = ts.isCallExpression(ini) && (ini.expression.kind === ts.SyntaxKind.ImportKeyword
        || (ts.isIdentifier(ini.expression) && ini.arguments.length === 1 && /\.m?js$/.test(textoDe(ini.arguments[0]) ?? '')));
      if (esImport) {
        let modulo = null;
        const busca = (x) => { const t = textoDe(x); if (t && !modulo && /(\.m?js|@prisma\/client)$/.test(t)) modulo = t; ts.forEachChild(x, busca); };
        busca(ini);
        if (modulo) {
          if (/^\//.test(modulo)) modulo = '.' + modulo.replace(/^\/(scripts|tests)\//, '/');
          // Una ruta desde la raíz del repositorio se pasa a relativa a este fichero.
          else if (/^(scripts|tests|dist|src)\//.test(modulo)) modulo = path.posix.relative(path.posix.dirname(rel), modulo).replace(/^(?!\.)/, './');
          for (const el of n.name.elements) {
            if (ts.isIdentifier(el.name)) importados.set(el.name.text, { modulo, importado: el.propertyName && ts.isIdentifier(el.propertyName) ? el.propertyName.text : el.name.text });
          }
        }
      }
    }
    if (ts.isImportDeclaration(n) && !n.importClause && ts.isStringLiteral(n.moduleSpecifier)) {
      importsDeEfecto.push(n.moduleSpecifier.text);
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
    // SCRUM-1575c · `if (!HOSTS_PERMITIDOS.includes(info.host)) …`: la misma comprobación, por lista.
    if (ts.isCallExpression(n) && ts.isPropertyAccessExpression(n.expression) && n.expression.name.text === 'includes'
      && n.arguments.length === 1 && /(^|\.)(base|host)$/.test(n.arguments[0].getText(sf)) && decide(n)) guardPropio = true;
    if (ts.isNewExpression(n)) {
      const t = n.expression.getText(sf);
      if (/(^|\.)PrismaClient$/.test(t)) {
        conecta.add('new PrismaClient');
        primerCliente = Math.min(primerCliente, n.getStart(sf));
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
        primerProceso = Math.min(primerProceso, n.getStart(sf));
        // Una orden entera («npx prisma db push») sólo cuenta si es el ARGUMENTO del proceso: en
        // un test del hook la misma cadena es la entrada que se le da a leer, y no conecta.
        for (const a of n.arguments) {
          const t = ts.isTemplateExpression(a) ? a.head.text.trim() : (textoDe(a) ?? '').trim();
          if (/^(npx\s+)?(prisma|psql|pg_dump|pg_restore)\s/.test(t)) literales.push(t);
        }
      }
      if (EJECUTA_SQL_CRUDO.test(nom)) { escribe.add(nom); marcaConexion(nom, n.getStart(sf)); consultas.push({ pos: n.getStart(sf), receptor: raizDe(e) }); }
      if (LEE_SQL_CRUDO.test(nom)) { marcaConexion(nom, n.getStart(sf)); consultas.push({ pos: n.getStart(sf), receptor: raizDe(e) }); }
      // `prisma.modelo.update(...)`: el receptor es OTRO acceso a propiedad. Así no casan
      // `hash.update(...)` ni `crypto.createHash(...).update(...)`.
      if (ESCRIBE_PRISMA.test(nom) && ts.isPropertyAccessExpression(e) && ts.isPropertyAccessExpression(e.expression)) {
        escribe.add(`.${nom}`);
      }
      // SCRUM-1575c · `x.modelo.método({…})` o `x.modelo.findMany()`: una CONSULTA, abra quien abra el
      // cliente. El argumento tiene que ser un objeto literal (o ninguno): `this.pendientes.delete(id)`
      // o `mapa.claves.update(k)` no son Prisma.
      if ((ESCRIBE_PRISMA.test(nom) || LEE_PRISMA.test(nom)) && ts.isCallExpression(n) && ts.isPropertyAccessExpression(e)
        && ts.isPropertyAccessExpression(e.expression)
        && !NO_ES_PRISMA.test(raizDe(e) ?? '')
        && (n.arguments.length === 0 ? /^(findMany|findFirst|count|deleteMany|aggregate)$/.test(nom) : ts.isObjectLiteralExpression(n.arguments[0]))) {
        marcaConexion('.modelo', n.getStart(sf));
        consultas.push({ pos: n.getStart(sf), receptor: raizDe(e) });
      }
      if (nom === '$connect' && ts.isPropertyAccessExpression(e)) consultas.push({ pos: n.getStart(sf), receptor: raizDe(e) });
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
    // SCRUM-1575c · la posición es la del primer `spawn`/`exec…`: con 0, todo guard salía «DESPUÉS».
    const pp = primerProceso;
    if (prisma && tiene('db') && (tiene('push') || tiene('execute') || tiene('pull') || tiene('seed'))) {
      marcaConexion('prisma db', pp);
      if (tiene('push') || tiene('execute') || tiene('seed')) escribe.add('prisma db push/execute/seed');
    }
    if (prisma && tiene('migrate')) {
      if (fichas.some((f) => URL_DE_MIGRATE.test(f)) || tiene('deploy') || tiene('reset') || tiene('resolve')) marcaConexion('prisma migrate', pp);
      if (tiene('deploy') || tiene('reset') || tiene('resolve') || tiene('dev')) escribe.add('prisma migrate deploy/reset/resolve/dev');
    }
    if (tiene('psql')) { marcaConexion('psql', pp); escribe.add('psql (puede escribir)'); }
    if (tiene('pg_restore')) { marcaConexion('pg_restore', pp); escribe.add('pg_restore'); }
    if (tiene('pg_dump')) marcaConexion('pg_dump', pp);
  }

  // ── SCRUM-1575c · el singleton de la aplicación ──
  // `import { prisma } from '../dist/core/db/prisma.js'` (o su `await import`) y una consulta sobre ese
  // nombre: ABRE con la `DATABASE_URL` del entorno, sin `new` a la vista. Importarlo sin consultar no cuenta.
  const delSingleton = new Set([...importados].filter(([, i]) => SINGLETON.test(i.modulo)).map(([local]) => local));
  const consultasAlSingleton = consultas.filter((c) => delSingleton.has(sinAlias(c.receptor)));
  if (consultasAlSingleton.length > 0) {
    marcaConexion('singleton core/db/prisma', Math.min(...consultasAlSingleton.map((c) => c.pos)));
    claves.add('DATABASE_URL (implícita)');
  }
  // Prisma conecta en la primera consulta, no al construirse (medido por jv-j5t con Prisma 6.18:
  // cambia `DATABASE_URL` entre el `new` y la consulta, y usa la NUEVA). El `new` sólo vale de
  // posición si no hay ninguna consulta a la vista.
  if (consultas.length > 0) primeraConexion = Math.min(primeraConexion, ...consultas.map((c) => c.pos));
  else if (primerCliente < Infinity) primeraConexion = Math.min(primeraConexion, primerCliente);

  // ── Guards llamados directamente ──
  for (const { nombre, pos } of llamadas) {
    const imp = importados.get(nombre);
    if (!imp) continue;
    const base = path.posix.basename(imp.modulo);
    if (GUARDAS[base]?.includes(imp.importado)) { guardas.add(`${base}:${imp.importado}`); primeraGuarda = Math.min(primeraGuarda, pos); }
  }

  // ── SCRUM-1575d · el SERVICIO de `dist/modules/` ──
  // `await cambiarFlagFiscal(…)` escribe por dentro con el singleton y aquí no se veía: sin `.update`
  // a la vista, `cambiar-flag-fiscal.mjs` salía «escribe: —». Una llamada a algo importado de
  // `dist/modules/` cuenta como «puede escribir» (como `psql`: no se sabe qué hace dentro) cuando el
  // módulo HABLA CON LA BASE (`servicioUsaBase`, que el censo contesta leyendo su fuente en `src/`) y
  // el fichero YA habla con una base —conecta, o nombra una clave de base—; un test unitario que llama
  // al servicio sin base no entra. Si es lo único que conecta, la conexión es esa llamada.
  // Sin `servicioUsaBase` (la función suelta, sin árbol) se cuenta todo módulo: no hay fuente que leer.
  const usaBase = opciones.servicioUsaBase ?? (() => true);
  const llamadasAServicio = llamadas.filter((l) => {
    const m = importados.get(l.nombre)?.modulo ?? '';
    return SERVICIO_DE_DIST.test(m) && usaBase(path.posix.normalize(path.posix.join(path.posix.dirname(rel), m)));
  });
  if (llamadasAServicio.length > 0 && (conecta.size > 0 || claves.size > 0)) {
    for (const l of llamadasAServicio) escribe.add(`${l.nombre}() (servicio de dist, puede escribir)`);
    if (conecta.size === 0) marcaConexion('servicio dist/modules', Math.min(...llamadasAServicio.map((l) => l.pos)));
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
    importsDeEfecto: importsDeEfecto.filter((m) => m.startsWith('.')),
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

  // SCRUM-1575d · ¿el módulo de `dist/modules/` habla con la base? Se lee su FUENTE en `src/` (un
  // árbol puede no traer `dist/`): si nombra el cliente de la aplicación o construye uno, sí. Es texto,
  // no flujo: lo que llame a OTRO módulo que escribe no se sigue. Sin fuente que leer, sí (no se sabe).
  const servicios = new Map();   // distRel → 'usa_base' | 'no_usa_base' | 'sin_fuente'
  const servicioUsaBase = (distRel) => {
    if (!servicios.has(distRel)) {
      const src = path.join(raiz, distRel.replace(/^dist\//, 'src/').replace(/\.js$/, '.ts'));
      servicios.set(distRel, !fs.existsSync(src) ? 'sin_fuente'
        : /core\/db\/prisma|PrismaClient/.test(fs.readFileSync(src, 'utf8')) ? 'usa_base' : 'no_usa_base');
    }
    return servicios.get(distRel) !== 'no_usa_base';
  };

  const analisis = new Map();
  for (const f of parseables) analisis.set(rel(f), analizarConexion(rel(f), fs.readFileSync(f, 'utf8'), { servicioUsaBase }));

  // Un módulo local que llama a un guard es un GUARDIÁN: quien llame a lo que exporta, pasa por él.
  const guardianes = new Set([...analisis.values()].filter((a) => a.guardas.length > 0).map((a) => a.rel));
  const resolver = (desde, modulo) => path.posix.normalize(path.posix.join(path.posix.dirname(desde), modulo));

  // SCRUM-1575c · un módulo local que ABRE un cliente y lo entrega (`tests/banco-scrum911/_entorno.mjs`:
  // `prismaStaging()`) le pasa a quien lo llama su conexión y su comprobación de destino a mano.
  const abridores = new Map([...analisis.values()].filter((a) => a.abre).map((a) => [a.rel, a]));

  const filas = [];
  for (const a of analisis.values()) {
    if (a.conecta.length === 0) continue;
    if (/^scripts\/_(clave-vs-destino|db-guard)\.mjs$/.test(a.rel)) continue;
    const locales = (l) => l.modulo.startsWith('.');
    const indirectas = [...new Set([
      ...a.llamadosImportados.filter((l) => locales(l) && guardianes.has(resolver(a.rel, l.modulo)))
        .map((l) => `${path.posix.basename(l.modulo)}:${l.importado}`),
      // `import './_staging-db.mjs'`: el guard corre al importarlo, sin que se llame nada.
      ...a.importsDeEfecto.filter((m) => guardianes.has(resolver(a.rel, m))).map((m) => `${path.posix.basename(m)}:(import)`),
    ])].sort();
    const abiertoPor = a.abre ? null : [...new Set(a.llamadosImportados.filter(locales)
      .map((l) => resolver(a.rel, l.modulo)).filter((m) => abridores.has(m)))].sort()[0] ?? null;
    const abre = a.abre || abiertoPor !== null;
    const guardPropio = a.guardPropio || (abiertoPor !== null && abridores.get(abiertoPor).guardPropio);
    const protegido = a.guardas.length > 0 || indirectas.length > 0;
    const clase = protegido ? 'protegido'
      : a.rel.startsWith('tests/') && a.bancoDesechable ? 'banco_desechable'
      : !abre ? 'usa_cliente_ajeno'
      : guardPropio ? 'guard_propio'
      : a.escribe.length > 0 ? 'sin_guard_escribe'
      : 'sin_guard_lee';
    filas.push({ rel: a.rel, clase, conecta: a.conecta, escribe: a.escribe, claves: a.claves, abiertoPor,
      guardas: a.guardas, guardasIndirectas: indirectas, guardaAntes: a.guardaAntes });
  }
  filas.sort((x, y) => x.rel.localeCompare(y.rel));
  const porVeredicto = (v) => [...servicios].filter(([, x]) => x === v).map(([m]) => m).sort();
  return { poblacion: { ficheros: todos.length, parseados: parseables.length, fueraDelAst,
    servicios: { usaBase: porVeredicto('usa_base'), noUsaBase: porVeredicto('no_usa_base'), sinFuente: porVeredicto('sin_fuente') } }, filas };
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

/**
 * SCRUM-1575c · la segunda siembra: el hueco que tuvo 1575b. Un test que importa el singleton y
 * borra, sin `new` a la vista. El censo de 1575b no lo veía: si deja de verlo, CIEGO.
 */
export const SIEMBRA_SINGLETON = Object.freeze({
  rel: 'tests/__siembra-1575c.test.mjs',
  fuente: "import { prisma } from '../dist/core/db/prisma.js';\n" +
    'await prisma.quote.deleteMany({ where: { merchantId: 1 } });\n',
});

/**
 * SCRUM-1575d · la tercera: un script que sólo llama a un SERVICIO de `dist/modules/` con una URL de
 * base puesta, sin una consulta a la vista. Si deja de verlo, CIEGO.
 */
export const SIEMBRA_SERVICIO = Object.freeze({
  rel: 'scripts/__siembra-1575d.mjs',
  fuente: "process.env.DATABASE_URL = process.env.DATABASE_URL_STAGING;\n" +
    "const { cambiarFlagFiscal } = await import('../dist/modules/system/domain/flagFiscal.service.js');\n" +
    'await cambiarFlagFiscal({ merchantId: 1, valor: true });\n',
});

/** ¿El instrumento ve sus tres siembras como lo que son: abren, escriben y no llaman a ningún guard? */
export function veSusSiembras() {
  return [SIEMBRA, SIEMBRA_SINGLETON, SIEMBRA_SERVICIO].every(({ rel, fuente }) => {
    const a = analizarConexion(rel, fuente);
    return a.abre && a.escribe.length > 0 && a.guardas.length === 0;
  });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const raiz = process.argv[2] ? path.resolve(process.argv[2]) : RAIZ;
  const { poblacion, filas } = censarConexiones(raiz);
  const ve = veSusSiembras();
  if (!ve || poblacion.parseados === 0 || filas.length === 0) {
    console.log(`CIEGO · siembras vistas=${ve} · parseados=${poblacion.parseados} · filas=${filas.length}`);
    process.exit(2);
  }
  const porClase = {};
  for (const f of filas) (porClase[f.clase] ??= []).push(f);
  console.log(`censo-conexiones · ${poblacion.ficheros} ficheros en scripts/ y tests/ · ${poblacion.parseados} parseados por AST · ${filas.length} conectan · siembras vistas (3)`);
  console.log(`fuera del AST: ${poblacion.fueraDelAst.join(', ') || '(ninguno)'}`);
  const sv = poblacion.servicios;
  console.log(`servicios de dist/modules leídos en src/: ${sv.usaBase.length} hablan con la base · ${sv.noUsaBase.length} no · ${sv.sinFuente.length} sin fuente (cuentan como sí)`);
  for (const clase of CLASES) {
    const xs = porClase[clase] ?? [];
    console.log(`\n## ${clase} · ${xs.length}`);
    for (const f of xs) {
      console.log(`- ${f.rel} · conecta: ${f.conecta.join('+')}${f.abiertoPor ? ` (abre ${f.abiertoPor})` : ''} · escribe: ${f.escribe.join('+') || '—'} · claves: ${f.claves.join(',') || '—'}` +
        (f.guardas.length || f.guardasIndirectas.length ? ` · guard: ${[...f.guardas, ...f.guardasIndirectas.map((g) => `vía ${g}`)].join(',')}${f.guardaAntes === false ? ' (DESPUÉS en el texto)' : ''}` : ''));
    }
  }
}
