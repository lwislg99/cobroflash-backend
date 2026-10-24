// SCRUM-1324c · El vigía de main tiene que CARGAR donde corre: un workflow que no instala paquetes.
//
// Lo que pasó: SCRUM-1339u (0a66ee4f8, 22-oct-2026) hizo que `scripts/vigia-silencio-de-main.mjs`
// importara `_senal-de-nombres.mjs`, que importa `typescript`. `vigia-de-main.yml` no hace `npm ci`,
// así que desde el 22-oct a las 11:50Z el juez moría al cargar (`Cannot find package 'typescript'`) y
// el Issue «[vigía] main sin verificar» recibió 123 comentarios «SIN veredicto» en 36 h, mientras el
// meta-guard llevaba 4 rojos seguidos en `main`. Los tests del vigía seguían verdes: corren donde SÍ
// hay `node_modules`. Nadie vigilaba el silencio del vigía del silencio.
//
// Lo que este test sostiene, con la condición sacada del DESTINO y no del código:
//   · de `vigia-de-main.yml` se leen los scripts que ejecuta y si instala paquetes;
//   · si no instala, el grafo de imports de cada uno (AST, recursivo por las rutas relativas) no pide
//     ningún paquete: sólo módulos propios y los de node;
//   · y además se CARGA de verdad: el grafo se copia a un directorio sin `node_modules` y se ejecuta.
// El instrumento lleva su cebo sembrado: un grafo fabricado con dos paquetes que TIENE que ver.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { builtinModules } from 'node:module';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const WORKFLOW = '.github/workflows/vigia-de-main.yml';

const esDeNode = (e) => e.startsWith('node:') || builtinModules.includes(e);
const esRelativo = (e) => e.startsWith('./') || e.startsWith('../');

/** Los especificadores de un módulo, por AST: `import … from`, `export … from` e `import('literal')`. */
function especificadores(codigo, fichero) {
  const sf = ts.createSourceFile(fichero, codigo, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  const fuera = [];
  const recorrer = (n) => {
    if ((ts.isImportDeclaration(n) || ts.isExportDeclaration(n)) && n.moduleSpecifier && ts.isStringLiteral(n.moduleSpecifier)) {
      fuera.push(n.moduleSpecifier.text);
    } else if (ts.isCallExpression(n) && n.expression.kind === ts.SyntaxKind.ImportKeyword) {
      const a = n.arguments[0];
      fuera.push(a && (ts.isStringLiteral(a) || ts.isNoSubstitutionTemplateLiteral(a)) ? a.text : '<import dinámico sin literal>');
    }
    ts.forEachChild(n, recorrer);
  };
  recorrer(sf);
  return fuera;
}

/** El grafo desde `entrada` (ruta absoluta): qué ficheros propios toca y qué paquetes pide. */
export function grafoDeImports(entrada) {
  const visitados = new Set();
  const paquetes = [];
  const pendientes = [path.resolve(entrada)];
  while (pendientes.length) {
    const f = pendientes.pop();
    if (visitados.has(f)) continue;
    visitados.add(f);
    for (const e of especificadores(fs.readFileSync(f, 'utf8'), f)) {
      if (esDeNode(e)) continue;
      if (esRelativo(e)) pendientes.push(path.resolve(path.dirname(f), e));
      else paquetes.push({ desde: path.relative(RAIZ, f).split(path.sep).join('/'), paquete: e });
    }
  }
  return { visitados: [...visitados], paquetes };
}

/** Del workflow: los scripts que ejecuta (`node scripts/….mjs`) y si instala paquetes. */
export function loQueEjecuta(yml) {
  const scripts = [...new Set([...yml.matchAll(/\bnode\s+(scripts\/[\w./-]+\.mjs)\b/g)].map((m) => m[1]))];
  const instala = /\bnpm\s+(ci|install|i)\b/.test(yml) || /\bsetup-node\b[\s\S]*?\bcache:/.test(yml);
  return { scripts, instala };
}

const enTmp = (nombre) => fs.mkdtempSync(path.join(os.tmpdir(), `scrum1324c-${nombre}-`));

test('cebo sembrado: el instrumento ve dos paquetes en un grafo fabricado, y nada de node ni de lo propio', () => {
  const d = enTmp('cebo');
  try {
    fs.writeFileSync(path.join(d, 'a.mjs'), "import fs from 'node:fs';\nimport { b } from './b.mjs';\nexport const a = b;\n");
    fs.writeFileSync(path.join(d, 'b.mjs'), "import pad from 'left-pad';\nimport path from 'path';\nexport { c as b } from './c.mjs';\n");
    fs.writeFileSync(path.join(d, 'c.mjs'), "export const c = 1;\nexport async function x() { return import('otro-paquete'); }\n");
    const g = grafoDeImports(path.join(d, 'a.mjs'));
    assert.equal(g.visitados.length, 3, `población del cebo: ${g.visitados.length} ficheros, se esperaban 3`);
    assert.deepEqual(g.paquetes.map((p) => p.paquete).sort(), ['left-pad', 'otro-paquete']);
  } finally {
    fs.rmSync(d, { recursive: true });
  }
});

test('el workflow del vigía de main: qué ejecuta y si instala paquetes (la condición sale de aquí)', () => {
  const { scripts, instala } = loQueEjecuta(fs.readFileSync(path.join(RAIZ, WORKFLOW), 'utf8'));
  assert.ok(scripts.includes('scripts/vigia-silencio-de-main.mjs'),
    `${WORKFLOW} no ejecuta el vigía: este test ya no mide lo que dice. Ejecuta: ${scripts.join(', ') || '(nada)'}`);
  for (const s of scripts) assert.ok(fs.existsSync(path.join(RAIZ, s)), `${WORKFLOW} ejecuta ${s}, que no existe`);
  // Hoy no instala (medido el 24-oct-2026). Si un día lo hace, el test de abajo deja de exigir y lo dice aquí.
  assert.equal(typeof instala, 'boolean');
});

test('sin `npm ci` en su workflow, el grafo de cada script que ejecuta no pide ningún paquete', () => {
  const { scripts, instala } = loQueEjecuta(fs.readFileSync(path.join(RAIZ, WORKFLOW), 'utf8'));
  assert.ok(scripts.length > 0, `población: 0 scripts leídos de ${WORKFLOW} — no he mirado nada`);
  if (instala) return;
  const filas = scripts.map((s) => ({ s, ...grafoDeImports(path.join(RAIZ, s)) }));
  const vistos = new Set(filas.flatMap((f) => f.visitados));
  assert.ok(vistos.size >= 4, `población: ${vistos.size} módulos en el grafo de ${scripts.length} script(s); el vigía solo ya toca 4`);
  const malos = filas.flatMap((f) => f.paquetes.map((p) => `${f.s} → ${p.desde} importa «${p.paquete}»`));
  assert.deepEqual(malos, [],
    `${WORKFLOW} no instala paquetes, y estos imports harían morir al vigía al cargar (SCRUM-1324c):\n  ${malos.join('\n  ')}\n`
    + `Sobre ${vistos.size} módulos de ${scripts.length} script(s). Se arregla el import (un módulo sin paquetes), no este test.`);
});

test('y se CARGA de verdad: copiado a un directorio sin node_modules, el vigía arranca y contesta', () => {
  const entrada = path.join(RAIZ, 'scripts/vigia-silencio-de-main.mjs');
  const { visitados } = grafoDeImports(entrada);
  const d = enTmp('carga');
  try {
    for (const f of visitados) {
      const destino = path.join(d, path.relative(RAIZ, f));
      fs.mkdirSync(path.dirname(destino), { recursive: true });
      fs.copyFileSync(f, destino);
    }
    assert.equal(fs.existsSync(path.join(d, 'node_modules')), false);
    const env = { ...process.env };
    for (const k of ['NODE_TEST_CONTEXT', 'NODE_OPTIONS', 'NODE_PATH', 'FORCE_COLOR']) delete env[k];
    const r = spawnSync(process.execPath, ['scripts/vigia-silencio-de-main.mjs', '--desde-de-la-red'], { cwd: d, env, encoding: 'utf8', timeout: 60000 });
    assert.equal(r.status, 0, `el vigía no carga sin paquetes (${visitados.length} módulos copiados):\n${(r.stderr || '').slice(0, 800)}`);
    assert.ok(!Number.isNaN(Date.parse(r.stdout.trim())), `contestó algo que no es una fecha: «${r.stdout.trim()}»`);
  } finally {
    fs.rmSync(d, { recursive: true });
  }
});
