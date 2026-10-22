// Banco de mutaciones de SCRUM-962c. Las mutaciones NO viven aquí: son MUTACIONES_QUE_ME_TUMBAN del
// test del ticket (las mismas que corre el meta-guard; SCRUM-1387). Cada una reintroduce una avería
// del censo viejo y tiene que tumbar el test que nombra su `cae`.
// Uso, desde la raíz del repo:  node docs/master/evidencias/SCRUM-962c/mutar.mjs
import fs from 'node:fs';
import { execFileSync, spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import path from 'node:path';

const TEST = 'tests/scrum962c-censo-tactil-poblacion-vara-etiqueta.test.mjs';
const { MUTACIONES_QUE_ME_TUMBAN } = await import(pathToFileURL(path.resolve(TEST)).href);
const env = { ...process.env }; delete env.FORCE_COLOR;
const correr = () => {
  const r = spawnSync(process.execPath, ['--test', TEST], { encoding: 'utf8', env });
  const n = (k) => Number((r.stdout.match(new RegExp(`ℹ ${k} (\\d+)`)) || [])[1]);
  const caidos = [...r.stdout.matchAll(/^✖ (.+?) \(\d/gm)].map((x) => x[1]);
  return { tests: n('tests'), fail: n('fail'), caidos };
};
const base = correr();
console.log(`BASE tests ${base.tests} fail ${base.fail}`);
if (base.fail !== 0 || !(base.tests > 0)) { console.log('BASE no verde: aborto'); process.exit(2); }
let mal = 0;
for (const [i, { fichero, de, a, cae }] of MUTACIONES_QUE_ME_TUMBAN.entries()) {
  const t = fs.readFileSync(fichero, 'utf8');
  if (t.split(de).length !== 2) { console.log(`CIEGA  M${i + 1}: «${de}» aparece ${t.split(de).length - 1} veces en ${fichero}`); mal++; continue; }
  fs.writeFileSync(fichero, t.replace(de, a));
  const ns = execFileSync('git', ['diff', '--numstat', '--', fichero], { encoding: 'utf8' }).trim();
  const r = correr();
  execFileSync('git', ['restore', '--source=HEAD', '--', fichero]);
  const cayo = r.caidos.some((c) => c.includes(cae));
  const v = !(r.tests > 0) ? 'CIEGA' : cayo ? 'MUERTA' : (r.fail ? 'OTRA' : 'VIVA');
  if (v !== 'MUERTA') mal++;
  console.log(`${v.padEnd(6)} M${String(i + 1).padEnd(3)} cae «${cae}» · tests ${r.tests} fail ${r.fail} · numstat «${ns}»`);
}
const limpio = execFileSync('git', ['status', '--porcelain', '--', 'scripts', 'tests'], { encoding: 'utf8' }).trim();
console.log(`no muertas ${mal} de ${MUTACIONES_QUE_ME_TUMBAN.length} · árbol restaurado: ${limpio === '' ? 'sí' : 'NO → ' + limpio}`);
const salida = mal || limpio ? 1 : 0;
console.log('EXIT=' + salida);
process.exit(salida);
