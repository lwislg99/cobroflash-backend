// SCRUM-1390e · las mutaciones del arreglo de portal-url, CON BASE. La lista NO vive aquí: se toma del
// test (`MUTACIONES_QUE_ME_TUMBAN`, las del meta-guard, y `MUTACIONES_CON_BASE`). Cada una se aplica al
// TEXTO del src (el fichero no se toca), se transpila a su sitio en dist/, se corre el test con el banco
// de SCRUM-1218c y dist/ se restaura comprobando que vuelve byte a byte. Una mutación vive si su caso
// `cae` no cae; si su texto no está UNA vez, sale CIEGA (no «muere»).
// Uso: node mutar.mjs <raíz del árbol, con dist/> <dir del banco (banco.mjs + ddl.sql)>
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

const [raiz, banco] = process.argv.slice(2);
if (!raiz || !banco) { console.log('CIEGO: faltan argumentos · EXIT=2'); process.exit(2); }
const TEST = 'tests/scrum1390e-el-portal-solo-lo-suyo.test.mjs';
const { MUTACIONES_QUE_ME_TUMBAN, MUTACIONES_CON_BASE } = await import(pathToFileURL(path.join(raiz, TEST)).href);
const lista = [...MUTACIONES_QUE_ME_TUMBAN.map((m) => ({ ...m, de_la_lista: 'meta-guard' })), ...MUTACIONES_CON_BASE.map((m) => ({ ...m, de_la_lista: 'con base' }))];
if (!lista.length) { console.log('CIEGO: el test no declara mutaciones · EXIT=2'); process.exit(2); }

const ts = createRequire(path.join(raiz, 'package.json'))('typescript');
const opciones = { ...ts.convertCompilerOptionsFromJson(JSON.parse(fs.readFileSync(path.join(raiz, 'tsconfig.json'), 'utf8')).compilerOptions, raiz).options, sourceMap: false };

let ciegos = 0; let vivas = 0;
for (const [i, m] of lista.entries()) {
  const src = fs.readFileSync(path.join(raiz, m.fichero), 'utf8');
  const veces = src.split(m.de).length - 1;
  const etiqueta = `M${i + 1} (${m.de_la_lista}) · «${m.de.trim().slice(0, 70)}» → «${m.a.trim().slice(0, 40)}»`;
  if (veces !== 1) { console.log(`CIEGO · ${etiqueta} · el texto sale ${veces} veces`); ciegos++; continue; }
  const js = path.join(raiz, 'dist', m.fichero.replace(/^src\//, '').replace(/\.ts$/, '.js'));
  const original = fs.readFileSync(js);
  fs.writeFileSync(js, ts.transpileModule(src.replace(m.de, m.a), { compilerOptions: opciones }).outputText);
  const salida = path.join(banco, `mut-${i}.json`);
  spawnSync(process.execPath, [path.join(banco, 'banco.mjs'), raiz, path.join(banco, 'ddl.sql'), TEST, '1', salida], { cwd: banco, encoding: 'utf8' });
  fs.writeFileSync(js, original);
  if (!fs.readFileSync(js).equals(original)) { console.log('🔴 dist/ NO quedó restaurado · EXIT=2'); process.exit(2); }
  const casos = fs.existsSync(salida) ? JSON.parse(fs.readFileSync(salida, 'utf8')).pasadas[0].casos : {};
  const total = Object.keys(casos).length;
  if (!total) { console.log(`CIEGO · ${etiqueta} · el banco no devolvió casos`); ciegos++; continue; }
  const caen = Object.entries(casos).filter(([, v]) => v === 'not ok').map(([k]) => k.split('|')[1]);
  // Las del meta-guard declaran un caso AST, que lee el src (aquí intacto): ese caso lo comprueba el
  // meta-guard. Aquí se mide la otra mitad, que con base también muere. (Visto el 23-oct: exigir aquí
  // su caso AST las daba por VIVAS a las cuatro.)
  const suyo = m.de_la_lista === 'con base' ? caen.some((n) => n.includes(m.cae)) : caen.length > 0;
  if (!suyo) vivas++;
  const que = m.de_la_lista === 'con base' ? `su caso («${m.cae}») ${suyo ? 'cae' : 'NO cae'}` : `con base ${suyo ? 'muere' : 'NO muere'}; su caso AST («${m.cae}») lo mide el meta-guard`;
  console.log(`${suyo ? 'MUERE' : '🔴 VIVE'} · ${etiqueta} · ${caen.length} de ${total} caen · ${que}`);
  for (const c of caen) console.log('    · ' + c.slice(0, 110));
}
console.log(`POBLACION=${lista.length} mutaciones · vivas=${vivas} · ciegas=${ciegos} · dist restaurado byte a byte · EXIT=${ciegos || vivas ? 2 : 0}`);
process.exit(ciegos || vivas ? 2 : 0);
