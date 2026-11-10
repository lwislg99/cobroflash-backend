// SCRUM-1390e · el ROJO por la ruta real: pone en dist/ el customersAdmin.routes.js de origin/main
// (transpilado del src de main, sin el arreglo), corre el test nuevo con el banco de SCRUM-1218c y
// RESTAURA dist/ comprobando que vuelve byte a byte. Imprime cada caso y el mensaje de cada rojo.
// Uso: node rojo-contra-main.mjs <raíz del árbol, con dist/> <dir del banco (banco.mjs + ddl.sql)>
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';

const [raiz, banco] = process.argv.slice(2);
if (!raiz || !banco) { console.log('CIEGO: faltan argumentos · EXIT=2'); process.exit(2); }
const ts = createRequire(path.join(raiz, 'package.json'))('typescript');
const REL = 'src/modules/system/app/routes/customersAdmin.routes.ts';
const js = path.join(raiz, 'dist/modules/system/app/routes/customersAdmin.routes.js');
const sha = execFileSync('git', ['rev-parse', 'origin/main'], { cwd: raiz, encoding: 'utf8' }).trim();
const srcMain = execFileSync('git', ['show', `${sha}:${REL}`], { cwd: raiz, encoding: 'utf8' });
if (srcMain.includes('puedeLlevarseElPortal')) { console.log('CIEGO: origin/main ya lleva el arreglo · EXIT=2'); process.exit(2); }
const cfg = JSON.parse(fs.readFileSync(path.join(raiz, 'tsconfig.json'), 'utf8')).compilerOptions;
const salidaTs = ts.transpileModule(srcMain, { compilerOptions: { ...ts.convertCompilerOptionsFromJson(cfg, raiz).options, sourceMap: false } }).outputText;

const original = fs.readFileSync(js);
fs.writeFileSync(js, salidaTs);
const out = path.join(banco, 'rojo-contra-main.json');
const r = spawnSync(process.execPath, [path.join(banco, 'banco.mjs'), raiz, path.join(banco, 'ddl.sql'), 'tests/scrum1390e-el-portal-solo-lo-suyo.test.mjs', '1', out], { cwd: banco, encoding: 'utf8' });
fs.writeFileSync(js, original);
if (!fs.readFileSync(js).equals(original)) { console.log('🔴 dist/ NO quedó restaurado · EXIT=2'); process.exit(2); }

console.log(`medido sobre origin/main ${sha} (src de main transpilado a dist/, y restaurado byte a byte)`);
console.log(r.stdout.split('\n').filter((l) => l.includes('pasada')).join('\n'));
const tap = fs.readFileSync(path.join(banco, 'tap-scrum1390e-el-portal-solo-lo-suyo.test.mjs-0.tap'), 'utf8').split(/\r?\n/);
for (let i = 0; i < tap.length; i++) {
  if (!/^(not ok|ok) \d+ - /.test(tap[i])) continue;
  console.log(tap[i]);
  if (tap[i].startsWith('not ok')) {
    const j = tap.indexOf('  error: |-', i);
    if (j > 0) console.log('      → ' + tap[j + 1].trim());
  }
}
const casos = Object.values(JSON.parse(fs.readFileSync(out, 'utf8')).pasadas[0].casos);
console.log(`POBLACION=${casos.length} casos · ok=${casos.filter((v) => v === 'ok').length} · not ok=${casos.filter((v) => v === 'not ok').length} · EXIT=${casos.length ? 0 : 2}`);
