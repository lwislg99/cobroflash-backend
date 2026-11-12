// Mutador local de SCRUM-1608: BASE (los ficheros tocados, de una ref) + las mutaciones del catálogo del test.
//   node mutar-1608.mjs <raiz> <ref-base>
// Comitea ANTES: restaura cada fichero con los bytes que leyó al empezar.
import fs from 'node:fs'; import path from 'node:path'; import { spawnSync, execFileSync } from 'node:child_process';
const RAIZ = path.resolve(process.argv[2]); const REF = process.argv[3];
const TEST = 'tests/scrum1608-tipo-de-iva-con-decimal.test.mjs';
const env = { ...process.env }; delete env.NODE_TEST_CONTEXT; delete env.NODE_OPTIONS;
const correr = () => { const r = spawnSync(process.execPath, ['--test', '--test-reporter=tap', TEST], { cwd: RAIZ, env, encoding: 'utf8', maxBuffer: 1 << 26 });
  const caidos = [...r.stdout.matchAll(/^not ok \d+ - (.*)$/gm)].map((m) => m[1]); return { code: r.status, caidos, total: (r.stdout.match(/^# tests (\d+)/m) || [])[1] }; };
const src = fs.readFileSync(path.join(RAIZ, TEST), 'utf8');
const bloque = src.slice(src.indexOf('MUTACIONES_QUE_ME_TUMBAN = ['), src.indexOf('\n];', src.indexOf('MUTACIONES_QUE_ME_TUMBAN')) + 3);
const muts = eval(bloque.slice(bloque.indexOf('[')));
const ficheros = [...new Set(muts.map((m) => m.fichero))];
const originales = new Map(ficheros.map((f) => [f, fs.readFileSync(path.join(RAIZ, f))]));
const restaurar = () => { for (const [f, b] of originales) { fs.writeFileSync(path.join(RAIZ, f), b);
  if (!fs.readFileSync(path.join(RAIZ, f)).equals(b)) { console.log(`NO RESTAURADO ${f}`); process.exit(3); } } };
let mal = 0;
const sano = correr(); console.log(`SANO · exit ${sano.code} · ${sano.total} pruebas · caídas ${sano.caidos.length}`); if (sano.code !== 0 || !sano.total) mal++;
try {
  for (const f of ficheros) fs.writeFileSync(path.join(RAIZ, f), execFileSync('git', ['show', `${REF}:${f}`], { cwd: RAIZ, maxBuffer: 1 << 26 }));
  const b = correr(); console.log(`BASE ${REF} (${ficheros.length} ficheros) · exit ${b.code} · caídas ${b.caidos.length}: ${b.caidos.map((c) => c.slice(0, 26)).join(' | ')}`); if (b.code === 0) mal++;
} finally { restaurar(); }
console.log(`POBLACION · ${muts.length} mutaciones`);
muts.forEach((m, i) => { const txt = originales.get(m.fichero).toString('utf8'); const n = txt.split(m.de).length - 1;
  if (n !== 1) { console.log(`  ${i + 1}. «de» casa ${n} veces en ${m.fichero} → MAL DECLARADA`); mal++; return; }
  try { fs.writeFileSync(path.join(RAIZ, m.fichero), txt.replace(m.de, m.a)); const r = correr(); const suyo = r.caidos.some((c) => c.startsWith(m.cae));
    console.log(`  ${i + 1}. ${m.fichero} · exit ${r.code} · cae lo suyo («${m.cae}»): ${suyo ? 'SÍ' : 'NO'} · caídas ${r.caidos.length}`); if (!suyo) mal++; } finally { restaurar(); } });
console.log(`vivas o mal declaradas: ${mal}`); process.exit(mal ? 1 : 0);
