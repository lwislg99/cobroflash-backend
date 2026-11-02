// Mutaciones de SCRUM-1335e: aplica UNA, corre el test de 1335e, restaura desde HEAD. Base sin mutar primero.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
const raiz = process.argv[2];
const f = path.join(raiz, 'tests', 'scrum804-la-rama-viva.test.mjs');
const MUT = {
  base: null,
  a_exigir_mudo: ['  if (CIEGO) assert.fail(CIEGO);', '  if (CIEGO) { /* mudo */ }'],
  b_ciego_nunca: ['const CIEGO = motivoDeCiego();', 'const CIEGO = null;'],
  c_sin_remedio: ["'verde. Si esto es un job de CI, su `actions/checkout` necesita `fetch-depth: 0` y la punta de '", "'verde. Si esto es un job de CI, revisa el checkout y la punta de '"],
  d_sin_rastro_sin_exigir: ["test('SCRUM-804 · ✅ SIN RASTRO es un veredicto, no un hueco', () => {\n  exigirArbol();", "test('SCRUM-804 · ✅ SIN RASTRO es un veredicto, no un hueco', () => {"],
};
const original = fs.readFileSync(f, 'utf8');
for (const [nombre, m] of Object.entries(MUT)) {
  let t = original;
  if (m) {
    if (!t.includes(m[0])) { console.log(`${nombre}: CIEGO (el ancla no está; la mutación NO se aplicó)`); continue; }
    t = t.replace(m[0], m[1]);
    fs.writeFileSync(f, t);
  }
  const aplicada = fs.readFileSync(f, 'utf8') !== original;
  const r = spawnSync(process.execPath, ['--test', '--test-reporter=tap', 'tests/scrum1335e-scrum804-en-clon-somero.test.mjs'], { cwd: raiz, encoding: 'utf8', maxBuffer: 1 << 26 });
  const ult = (re) => { const t = [...r.stdout.matchAll(re)]; return t.length ? t[t.length - 1][1] : null; };
  const pass = ult(/^# pass (\d+)/gm);
  const fail = ult(/^# fail (\d+)/gm);
  fs.writeFileSync(f, original);
  const veredicto = pass === null ? 'CIEGO (sin salida)' : (nombre === 'base' ? (fail === '0' ? 'base verde' : 'BASE ROJA') : (fail !== '0' ? 'MUERTA' : 'VIVA'));
  console.log(`${nombre}: aplicada=${aplicada} exit=${r.status} pass=${pass} fail=${fail} → ${veredicto}`);
}
