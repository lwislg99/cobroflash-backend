// tests/scrum1233g-banco-bloquea-el-sw.test.mjs — SCRUM-1233g (carril S4)
//
// UN BANCO QUE INTERCEPTA yaqu.app TIENE QUE BLOQUEAR EL SERVICE WORKER.
//
// `page.route` / `context.route` NO ven lo que pide el service worker de la casa. En cuanto el SW
// toma la página, sus `fetch` salen por su cuenta, y la escritura que el banco creía contestar en el
// navegador llega a PRODUCCIÓN. Mordió dos veces al mismo puesto:
//   · 1-oct-2026 · una sonda «sin red» escribió en producción (cicatriz S4, «sin comprobación»).
//   · 16-oct-2026 · la 1.ª pasada de `docs/master/evidencias/SCRUM-1233/ver1233.mjs` dejó salir tres
//     `PATCH /admin/jobs/77` con cuerpo `{}` (SCRUM-1233 c.19857).
// La cicatriz estaba escrita y no paró la segunda: una lección que nadie comprueba se repite.
//
// LA REGLA, sobre todo fichero de `docs/master/evidencias/` y `scripts/` que llama a `.route(`:
//   ① si abre él mismo el contexto (`newContext`, `newPage`, `launchPersistentContext`) y nombra
//     `yaqu.app` en el CÓDIGO, ese contexto lleva `serviceWorkers: 'block'`;
//   ② si no lo abre, lo abre un fichero que importa: si ese fichero está en el repo, se le aplica ①;
//     si NO está en el repo, el banco va en FUERA_DEL_REPO, nombrado y con lo medido, porque desde
//     aquí no se puede ver.
// Se lee por AST: un `serviceWorkers: 'block'` o un `yaqu.app` dentro de un COMENTARIO no cuentan
// (A23 casilla 2; el primer censo de este ticket, por regex, contó comentarios y dio un «5 de 7 sin
// bloquear» que era falso). Lo que no parsea sale CIEGO, no verde.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const CARPETAS = ['docs/master/evidencias', 'scripts'];
const EXTENSIONES = /\.(mjs|cjs|js)$/;
const METODOS_DE_CONTEXTO = new Set(['newContext', 'newPage', 'launchPersistentContext']);

// Bancos cuyo contexto lo abre un fichero que NO está en git. Medido el 16-oct-2026: los cinco
// importan el `comun.mjs` de las sondas de S2 (`D:/MILLONARIO/cobroFlash/sondas-s2/comun.mjs`), y
// ése abre `browser.newContext({ serviceWorkers: 'block', viewport })` (su línea 15). Seguros hoy,
// pero no comprobables desde el repo. Quien suba ese `comun.mjs` junto a su banco, que lo saque de aquí.
const FUERA_DEL_REPO = new Map([
  ['docs/master/evidencias/SCRUM-1188/sonda-1188e-sustituir-plantilla.mjs', 'importa ./comun.mjs, que no está en el repo'],
  ['docs/master/evidencias/SCRUM-1227/sonda-1227-guardar.mjs', 'importa sondas-s2/comun.mjs por ruta absoluta'],
  ['docs/master/evidencias/SCRUM-1231/sonda-1231b-admin-logo.mjs', 'importa ./comun.mjs, que no está en el repo'],
  ['docs/master/evidencias/SCRUM-1482/sonda-1482b-id-ficha.mjs', 'importa ./comun.mjs, que no está en el repo'],
  ['docs/master/evidencias/SCRUM-917/sonda-917i-seccion-vacia.mjs', 'importa ./comun.mjs, que no está en el repo'],
]);

// Suelo de la población: el 16-oct había 895 ficheros de código en las dos carpetas y 8 que llaman a
// `.route(` (5 fuera del repo + SCRUM-1184 + SCRUM-1437 + el de 1233g). Bajar de aquí es que el
// instrumento ha dejado de ver.
const SUELO_FICHEROS = 800;
const SUELO_BANCOS = 8;

/**
 * Clasifica UN fuente. Pura, para poder probarla con fuentes escritos aquí.
 * @returns {{ ciego: string|null, intercepta: boolean, abreContexto: boolean, apuntaAProd: boolean, bloquea: boolean, importa: string[] }}
 */
export function clasificar(nombre, fuente) {
  const sf = ts.createSourceFile(nombre, fuente, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  const diag = sf.parseDiagnostics || [];
  if (diag.length) {
    return { ciego: `no parsea (${diag.length} diagnósticos)`, intercepta: false, abreContexto: false, apuntaAProd: false, bloquea: false, importa: [] };
  }
  let intercepta = false; let abreContexto = false; let apuntaAProd = false; let bloquea = false;
  const importa = [];
  const esBloqueo = (obj) => ts.isObjectLiteralExpression(obj) && obj.properties.some((p) =>
    ts.isPropertyAssignment(p) && p.name && p.name.getText(sf).replace(/['"]/g, '') === 'serviceWorkers'
    && ts.isStringLiteralLike(p.initializer) && p.initializer.text === 'block');
  const visitar = (n) => {
    if (ts.isStringLiteralLike(n) || ts.isTemplateHead(n) || ts.isTemplateMiddle(n) || ts.isTemplateTail(n)) {
      if (n.text.includes('yaqu.app')) apuntaAProd = true;
    }
    if (ts.isImportDeclaration(n) && ts.isStringLiteral(n.moduleSpecifier)) importa.push(n.moduleSpecifier.text);
    if (ts.isCallExpression(n) && ts.isPropertyAccessExpression(n.expression)) {
      const metodo = n.expression.name.text;
      if (metodo === 'route') intercepta = true;
      if (METODOS_DE_CONTEXTO.has(metodo)) {
        abreContexto = true;
        if (n.arguments.some(esBloqueo)) bloquea = true;
      }
    }
    ts.forEachChild(n, visitar);
  };
  visitar(sf);
  return { ciego: null, intercepta, abreContexto, apuntaAProd, bloquea, importa };
}

/** Un import a fichero, resuelto: `{ dentro: rel }` si está en el repo, `{ fuera: espec }` si no; null si es un paquete. */
function resolverImport(desdeAbs, espec) {
  let abs = null;
  if (espec.startsWith('file:')) abs = fileURLToPath(espec);
  else if (espec.startsWith('.') || path.isAbsolute(espec)) abs = path.resolve(path.dirname(desdeAbs), espec);
  else return null;
  const rel = path.relative(RAIZ, abs);
  if (rel.startsWith('..') || path.isAbsolute(rel) || !fs.existsSync(abs)) return { fuera: espec };
  return { dentro: abs };
}

function recorrer(dir, fuera) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === 'node_modules') continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) recorrer(p, fuera);
    else if (EXTENSIONES.test(e.name)) fuera.push(p);
  }
  return fuera;
}

const relDe = (abs) => path.relative(RAIZ, abs).split(path.sep).join('/');

function censo() {
  const ficheros = CARPETAS.flatMap((c) => recorrer(path.join(RAIZ, c), []));
  const cache = new Map();
  const leer = (abs) => {
    if (!cache.has(abs)) cache.set(abs, clasificar(relDe(abs), fs.readFileSync(abs, 'utf8')));
    return cache.get(abs);
  };
  const bancos = []; const ciegos = [];
  for (const abs of ficheros) {
    const rel = relDe(abs);
    const c = leer(abs);
    if (c.ciego) { ciegos.push(`${rel}: ${c.ciego}`); continue; }
    if (!c.intercepta) continue;
    if (c.abreContexto) {
      // ① contexto propio: sólo cuenta si va contra producción.
      if (c.apuntaAProd) bancos.push({ rel, clase: c.bloquea ? 'bloquea' : 'no-bloquea' });
      else bancos.push({ rel, clase: 'no-es-prod' });
      continue;
    }
    // ② contexto ajeno: se busca en lo que importa.
    const resueltos = c.importa.map((e) => resolverImport(abs, e)).filter(Boolean);
    const fuera = resueltos.filter((r) => r.fuera).map((r) => r.fuera);
    const helpers = resueltos.filter((r) => r.dentro).map((r) => ({ abs: r.dentro, c: leer(r.dentro) }))
      .filter((h) => !h.c.ciego && h.c.abreContexto);
    if (helpers.length) {
      const prod = c.apuntaAProd || helpers.some((h) => h.c.apuntaAProd);
      const bloquea = helpers.every((h) => h.c.bloquea);
      bancos.push({ rel, clase: !prod ? 'no-es-prod' : bloquea ? 'bloquea' : 'no-bloquea', via: helpers.map((h) => relDe(h.abs)) });
    } else if (fuera.length) {
      bancos.push({ rel, clase: 'fuera-del-repo', via: fuera });
    } else {
      bancos.push({ rel, clase: 'sin-contexto' });
    }
  }
  return { ficheros, bancos, ciegos };
}

test('control: el clasificador distingue bloquear, no bloquear y bloquear sólo en un comentario', () => {
  const sin = `const ctx = await b.newContext({ viewport: {} }); await page.route('**/*', f); await page.goto('https://yaqu.app/');`;
  const con = `const ctx = await b.newContext({ viewport: {}, serviceWorkers: 'block' }); await page.route('**/*', f); await page.goto('https://yaqu.app/');`;
  const comentado = `// newContext({ serviceWorkers: 'block' })\nconst ctx = await b.newContext({}); await ctx.route('**', f); const u = \`https://yaqu.app/\${x}\`;`;
  const prodSoloEnComentario = `// Sobre yaqu.app\nimport { abrir } from './comun.mjs';\nawait page.route('**', f);`;
  const pick = (r) => ({ intercepta: r.intercepta, abreContexto: r.abreContexto, apuntaAProd: r.apuntaAProd, bloquea: r.bloquea });
  assert.deepEqual(pick(clasificar('sin.mjs', sin)), { intercepta: true, abreContexto: true, apuntaAProd: true, bloquea: false });
  assert.deepEqual(pick(clasificar('con.mjs', con)), { intercepta: true, abreContexto: true, apuntaAProd: true, bloquea: true });
  assert.deepEqual(pick(clasificar('com.mjs', comentado)), { intercepta: true, abreContexto: true, apuntaAProd: true, bloquea: false });
  const ajeno = clasificar('ajeno.mjs', prodSoloEnComentario);
  assert.deepEqual(pick(ajeno), { intercepta: true, abreContexto: false, apuntaAProd: false, bloquea: false });
  assert.deepEqual(ajeno.importa, ['./comun.mjs']);
  assert.ok(clasificar('roto.mjs', 'const = ;').ciego, 'un fuente que no parsea tiene que salir CIEGO');
});

test('todo banco que intercepta yaqu.app bloquea el service worker; el que no se puede ver, nombrado', () => {
  const { ficheros, bancos, ciegos } = censo();
  const cuenta = (k) => bancos.filter((b) => b.clase === k).length;
  const poblacion = `población: ${ficheros.length} ficheros en ${CARPETAS.join(' + ')}, ${bancos.length} llaman a .route( ` +
    `(bloquea ${cuenta('bloquea')} · fuera del repo ${cuenta('fuera-del-repo')} · no es prod ${cuenta('no-es-prod')} · ` +
    `sin contexto ${cuenta('sin-contexto')} · NO bloquea ${cuenta('no-bloquea')})`;
  assert.deepEqual(ciegos, [], `CIEGO: estos ficheros no parsean y no se pueden clasificar (${poblacion})`);
  assert.ok(ficheros.length >= SUELO_FICHEROS, `el instrumento no ve la carpeta: ${poblacion} (suelo ${SUELO_FICHEROS})`);
  assert.ok(bancos.length >= SUELO_BANCOS, `el instrumento ha dejado de reconocer bancos: ${poblacion} (suelo ${SUELO_BANCOS})`);

  assert.deepEqual(bancos.filter((b) => b.clase === 'no-bloquea').map((b) => b.rel), [],
    `Estos bancos interceptan yaqu.app y su contexto NO lleva serviceWorkers: 'block'. El SW se salta ` +
    `page.route y la escritura llega a producción. Ponlo en su newContext (${poblacion}).`);
  assert.deepEqual(bancos.filter((b) => b.clase === 'sin-contexto').map((b) => b.rel), [],
    `CIEGO: estos llaman a .route( y no se encuentra quién abre su contexto (${poblacion}).`);

  const fueraNuevos = bancos.filter((b) => b.clase === 'fuera-del-repo' && !FUERA_DEL_REPO.has(b.rel)).map((b) => `${b.rel} ← ${b.via.join(', ')}`);
  assert.deepEqual(fueraNuevos, [],
    `Estos bancos abren su contexto en un fichero que NO está en git: no se puede comprobar que bloquee el SW. ` +
    `Sube el fichero con el banco (A8) (${poblacion}).`);

  const porRel = new Map(bancos.map((b) => [b.rel, b]));
  const sobran = [...FUERA_DEL_REPO.keys()].filter((rel) => !porRel.has(rel) || porRel.get(rel).clase !== 'fuera-del-repo');
  assert.deepEqual(sobran, [],
    `Estos de FUERA_DEL_REPO ya no lo están (su contexto se ve desde el repo, o ya no son bancos): sácalos de la lista, uno a uno (${poblacion}).`);
});
