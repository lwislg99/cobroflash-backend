// Copias de tests/scrum844c en tmp con UNA mutación cada una; corre sólo el caso «EL ENLACE».
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
const raiz = process.cwd();
const tmp = process.argv[2];
const original = fs.readFileSync(path.join(raiz, 'tests/scrum844c-el-xml-que-se-remite.test.mjs'), 'utf8');
const distUrl = pathToFileURL(path.join(raiz, 'dist')).href;
const falso = path.join(tmp, 'instalacion-vacia.mjs');
fs.writeFileSync(falso, "export const numeroInstalacion = (id) => (id === 7 ? '' : String(id));\n");
const tsUrl = pathToFileURL(path.join(raiz, '..', '..', '..', 'node_modules', 'typescript', 'lib', 'typescript.js')).href;
const base = (s) => s.replaceAll("'../dist/", `'${distUrl}/`).replace("import ts from 'typescript';", `import ts from '${tsUrl}';`)
  .replace("const RAIZ = path.join(AQUI, '..');", `const RAIZ = ${JSON.stringify(raiz)};`);
const MUT = [
  ['sana', (s) => s],
  ['numeroInstalacion devuelve vacío para el id 7', (s) => s.replace(`'${distUrl}/modules/fiscal/verifactu/instalacion.js'`, `'${pathToFileURL(falso).href}'`)],
  ['CAMPOS_DEL_PRODUCTOR sin version', (s) => s.replace("'nombre', 'nif', 'idSistema', 'version', 'numInstalacion'", "'nombre', 'nif', 'idSistema', 'numInstalacion'")],
];
for (const [nombre, f] of MUT) {
  const b = base(original); const s = f(b);
  if (nombre !== 'sana' && s === b) { console.log(`CIEGO ${nombre}: la mutación no cambió nada`); continue; }
  const ft = path.join(tmp, 'copia-844c.test.mjs');
  fs.writeFileSync(ft, s);
  const r = spawnSync(process.execPath, ['--test', '--test-reporter=tap', '--test-name-pattern=EL ENLACE', ft], { encoding: 'utf8' });
  const n = (k) => /# (\w+) (\d+)/g.exec('') || (new RegExp(`^# ${k} (\\d+)`, 'm').exec(r.stdout) ?? [])[1];
  const errs = [...r.stdout.matchAll(/^\s+error: [|>-]*\s*\n((?:\s+.*\n){1,2})/gm)].map((m) => m[1].replace(/\s+/g, ' ').trim());
  const msg = errs.join(' ¦ ').slice(0, 220);
  console.log(`${nombre}: status=${r.status} pass=${n('pass')} fail=${n('fail')} ${msg}`);
}
