// Mutador local de SCRUM-1390y: BASE (homeView de una ref) + las mutaciones del catálogo del test.
//   node mutar-1390y.mjs <raiz> <ref-base>
import fs from 'node:fs'; import path from 'node:path'; import { spawnSync, execFileSync } from 'node:child_process';
const RAIZ = path.resolve(process.argv[2]); const REF = process.argv[3];
const TEST = 'tests/scrum1390y-inicio-por-rol.test.mjs'; const VISTA = 'public/dashboard/js/homeView.js';
const env = { ...process.env }; delete env.NODE_TEST_CONTEXT; delete env.NODE_OPTIONS;
const correr = () => { const r = spawnSync(process.execPath, ['--test', '--test-reporter=tap', TEST], { cwd: RAIZ, env, encoding: 'utf8', maxBuffer: 1 << 26 });
  const caidos = [...r.stdout.matchAll(/^not ok \d+ - (.*)$/gm)].map((m) => m[1]); return { code: r.status, caidos, total: (r.stdout.match(/^# tests (\d+)/m) || [])[1] }; };
const original = fs.readFileSync(path.join(RAIZ, VISTA));
const restaurar = () => { fs.writeFileSync(path.join(RAIZ, VISTA), original); if (!fs.readFileSync(path.join(RAIZ, VISTA)).equals(original)) { console.log('NO RESTAURADO'); process.exit(3); } };
const src = fs.readFileSync(path.join(RAIZ, TEST), 'utf8');
const bloque = src.slice(src.indexOf('MUTACIONES_QUE_ME_TUMBAN = ['), src.indexOf('\n];', src.indexOf('MUTACIONES_QUE_ME_TUMBAN')) + 3);
const muts = eval(bloque.slice(bloque.indexOf('[')));
let mal = 0;
const sano = correr(); console.log(`SANO · exit ${sano.code} · ${sano.total} pruebas · caídas ${sano.caidos.length}`); if (sano.code !== 0 || !sano.total) mal++;
try {
  fs.writeFileSync(path.join(RAIZ, VISTA), execFileSync('git', ['show', `${REF}:${VISTA}`], { cwd: RAIZ, maxBuffer: 1 << 26 }));
  const b = correr(); console.log(`BASE ${REF} · exit ${b.code} · caídas ${b.caidos.length}: ${b.caidos.map((c) => c.slice(0, 16)).join(' | ')}`); if (b.code === 0) mal++;
} finally { restaurar(); }
console.log(`POBLACION · ${muts.length} mutaciones`);
muts.forEach((m, i) => { const txt = original.toString('utf8'); const n = txt.split(m.de).length - 1;
  if (n !== 1) { console.log(`  ${i + 1}. «de» casa ${n} veces → MAL DECLARADA`); mal++; return; }
  try { fs.writeFileSync(path.join(RAIZ, VISTA), txt.replace(m.de, m.a)); const r = correr(); const suyo = r.caidos.some((c) => c.startsWith(m.cae));
    console.log(`  ${i + 1}. exit ${r.code} · cae lo suyo («${m.cae}»): ${suyo ? 'SÍ' : 'NO'} · caídas ${r.caidos.length}`); if (!suyo) mal++; } finally { restaurar(); } });
console.log(`vivas o mal declaradas: ${mal}`); process.exit(mal ? 1 : 0);
