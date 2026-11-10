// Réplica LOCAL y acotada del meta-guard, sólo para `tests/scrum962f-editor-cuatro-44.test.mjs`: por cada
// mutación de su `MUTACIONES_QUE_ME_TUMBAN` (el catálogo, SCRUM-1387) — aplica, corre el test, exige que caiga
// SU prueba, restaura y compara bytes. El oficial es `npm run meta:mutaciones` (job del CI). Esto es el «rojo
// primero» antes de empujar. Además, fuera del catálogo porque no se escribe como `de`/`a`: la BASE, el
// `styles.css` de ANTES del arreglo (el commit padre del que lo añade), tiene que tumbar el test.
//   node mutar-962f.mjs <raiz del worktree> [<sha del arreglo>]
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync, execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const RAIZ = path.resolve(process.argv[2]);
const ARREGLO = process.argv[3] || null;
const TEST = path.join(RAIZ, 'tests', 'scrum962f-editor-cuatro-44.test.mjs');
const env = { ...process.env }; delete env.FORCE_COLOR; delete env.NODE_OPTIONS; delete env.NODE_TEST_CONTEXT;
const { MUTACIONES_QUE_ME_TUMBAN: M } = await import(pathToFileURL(TEST).href + '?' + Date.now());

const correr = () => {
  const r = spawnSync(process.execPath, ['--test', '--test-force-exit', '--test-reporter=tap', TEST], { cwd: RAIZ, env, encoding: 'utf8', maxBuffer: 1 << 26 });
  const lineas = (r.stdout || '').split('\n');
  const caidos = lineas.filter((l) => /^not ok \d+ - /.test(l)).map((l) => l.replace(/^not ok \d+ - /, '').trim());
  const total = Number((lineas.find((l) => /^# tests /.test(l)) || '').replace(/\D/g, '')) || 0;
  return { status: r.status, caidos, total };
};
const conRestauracion = (f, nuevo, fn) => {
  const original = fs.readFileSync(f);
  try { fs.writeFileSync(f, nuevo); return fn(!fs.readFileSync(f).equals(original)); }
  finally { fs.writeFileSync(f, original); if (!fs.readFileSync(f).equals(original)) { console.log(`🔴 NO RESTAURADO: ${f}`); process.exit(3); } }
};

const base = correr();
console.log(`POBLACION · ${M.length} mutaciones declaradas · node ${process.version}`);
console.log(`BASE sin mutar · exit ${base.status} · ${base.total} pruebas · caídas ${base.caidos.length}`);
if (base.status !== 0 || !base.total) { console.log('🔴 la BASE no está verde: no se muta nada'); process.exit(2); }

let mal = 0;
for (const [i, m] of M.entries()) {
  const f = path.join(RAIZ, m.fichero);
  const texto = fs.readFileSync(f, 'utf8');
  const veces = texto.split(m.de).length - 1;
  let fila;
  if (veces !== 1) { fila = `🔴 ANCLA: «de» casa ${veces} veces (tiene que ser 1)`; mal++; }
  else {
    fila = conRestauracion(f, texto.replace(m.de, m.a), (aplicada) => {
      const r = correr();
      const suyo = r.caidos.some((c) => c.includes(m.cae));
      if (!aplicada || !suyo || !r.total) mal++;
      return `${aplicada ? 'aplicada' : '🔴 NO APLICADA'} · exit ${r.status} · cae lo suyo («${m.cae}»): ${suyo ? 'SÍ' : '🔴 NO'} · caídas ${r.caidos.length}`;
    });
  }
  console.log(`  ${i + 1}. ${m.fichero} → ${fila}`);
}

if (ARREGLO) {
  const CSS = path.join(RAIZ, 'public/dashboard/css/styles.css');
  const antes = execFileSync('git', ['show', `${ARREGLO}^:public/dashboard/css/styles.css`], { cwd: RAIZ });
  const fila = conRestauracion(CSS, antes, (aplicada) => {
    const r = correr();
    if (!aplicada || r.status === 0) mal++;
    return `${aplicada ? 'aplicada' : '🔴 NO APLICADA'} · exit ${r.status} · caídas ${r.caidos.length}`;
  });
  console.log(`  BASE · el styles.css de ANTES del arreglo (${ARREGLO}^) → ${fila}`);
}
console.log(`\n${mal ? '🔴' : '✅'} vivas o mal declaradas: ${mal}`);
process.exit(mal ? 1 : 0);
