// Conductor de mutaciones para SCRUM-1501: aplica cada mutación a docs/master/SCRUM-475.md,
// corre SOLO el caso «línea a línea» de scrum475 y restaura los bytes (verificados).
// Uso: node docs/master/evidencias/scrum1501/mutar475.mjs <raíz del worktree>
//
// Las de ESTRUCTURA salen del catálogo del propio guard (`MUTACIONES_QUE_ME_TUMBAN` de
// tests/scrum475-schema-vs-sql.test.mjs, leído por AST con `mutacionesDeclaradas`, sin ejecutarlo).
// Aquí sólo se añaden dos que el catálogo no puede llevar: la base sin mutar y la de SOLO
// comentario, que desde SCRUM-1501 tiene que PASAR (el meta-guard sólo sabe de mutaciones que tumban).
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const RAIZ = path.resolve(process.argv[2]);
const { mutacionesDeclaradas } = await import(pathToFileURL(path.join(RAIZ, 'scripts/meta-guard-mutaciones.mjs')).href);
const GUARD = 'tests/scrum475-schema-vs-sql.test.mjs';
const DOC = path.join(RAIZ, 'docs/master/SCRUM-475.md');
const CASO = 'SCRUM-475 · el modelo de `schema.prisma` es el de la entrada de máster, línea a línea';

const delCatalogo = mutacionesDeclaradas(fs.readFileSync(path.join(RAIZ, GUARD), 'utf8'), GUARD)
  .filter((m) => m.fichero === 'docs/master/SCRUM-475.md');
if (delCatalogo.length === 0) { console.log('CIEGO: el catálogo del guard no trae mutaciones del bloque'); process.exit(2); }
const MUT = [
  ['BASE sin mutar · tiene que PASAR', null, null],
  ...delCatalogo.map((m, i) => [`catálogo ${i + 1} · tiene que CAER · ${m.a.trim().split('\n').pop()}`, m.de, m.a]),
  ['SOLO comentario · tiene que PASAR', '// invoice | quote | charge', '// documento relacionado (comentario distinto)'],
];

const LIMPIO = { ...process.env };
for (const k of ['NODE_TEST_CONTEXT', 'NODE_OPTIONS', 'FORCE_COLOR']) delete LIMPIO[k];
const ORIGINAL = fs.readFileSync(DOC);
let roto = false;
for (const [nombre, de, a] of MUT) {
  try {
    if (de !== null) {
      const txt = ORIGINAL.toString('utf8');
      if (txt.split(de).length !== 2) { console.log(`${nombre} · CIEGO: el ancla no está una sola vez`); continue; }
      fs.writeFileSync(DOC, txt.replace(de, a));
      if (fs.readFileSync(DOC).equals(ORIGINAL)) { console.log(`${nombre} · CIEGO: no cambió el fichero`); continue; }
    }
    const r = spawnSync(process.execPath, ['--test', '--test-reporter=tap', `--test-name-pattern=${CASO.replace(/[.*+?^${}()|[\]\\`]/g, '\\$&')}`,
      GUARD], { cwd: RAIZ, encoding: 'utf8', env: LIMPIO });
    const lineas = r.stdout.split(/\r?\n/).filter((l) => /^(not )?ok \d+ - /.test(l) && l.includes(CASO));
    const ko = lineas.filter((l) => l.startsWith('not ok')).length;
    const ok = lineas.length - ko;
    const v = lineas.length !== 1 ? `CIEGO (líneas del caso: ${lineas.length})` : ko ? 'CAE' : 'PASA';
    console.log(`${nombre} → ${v} · ok=${ok} not_ok=${ko} · exit=${r.status}`);
  } finally {
    fs.writeFileSync(DOC, ORIGINAL);
    if (!fs.readFileSync(DOC).equals(ORIGINAL)) { roto = true; console.log('🔴 NO RESTAURADO'); }
  }
}
console.log(`${MUT.length} mutaciones (${delCatalogo.length} del catálogo) · ${roto ? 'ÁRBOL ROTO' : 'restaurado byte a byte'}`);
