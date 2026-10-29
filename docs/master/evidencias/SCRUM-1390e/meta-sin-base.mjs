// SCRUM-1390e · la mecánica del meta-guard (mutar el src EN SITIO, correr el test SIN base, restaurar y comprobar los bytes), sólo con
// las MUTACIONES_QUE_ME_TUMBAN de este ticket: el meta-guard entero no admite filtro por fichero. Uso: node meta-sin-base.mjs <raíz>
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
const raiz = process.argv[2];
const TEST = 'tests/scrum1390e-el-portal-solo-lo-suyo.test.mjs';
const { MUTACIONES_QUE_ME_TUMBAN } = await import(pathToFileURL(path.join(raiz, TEST)).href);
const entorno = { ...process.env };
for (const k of ['NODE_TEST_CONTEXT', 'NODE_OPTIONS', 'FORCE_COLOR', 'LIBRO_PG_URL', 'DATABASE_URL']) delete entorno[k];
const corre = () => {
  const tap = path.join(os.tmpdir(), 'scrum1390e-meta.tap');
  fs.rmSync(tap, { force: true });
  spawnSync(process.execPath, ['--test', '--test-force-exit', '--test-reporter=tap', `--test-reporter-destination=${tap}`, TEST], { cwd: raiz, env: entorno, encoding: 'utf8' });
  const l = fs.existsSync(tap) ? fs.readFileSync(tap, 'utf8').split(/\r?\n/) : [];
  return l.map((x) => /^(not ok|ok) \d+ - (.*?)(?: # (SKIP)\b.*)?$/.exec(x)).filter(Boolean).map((m) => ({ v: m[3] ? 'skip' : m[1], n: m[2] }));
};
const base = corre();
console.log(`BASE sin mutar: ${base.length} casos · ok=${base.filter((c) => c.v === 'ok').length} · skip=${base.filter((c) => c.v === 'skip').length} · not ok=${base.filter((c) => c.v === 'not ok').length}`);
for (const m of MUTACIONES_QUE_ME_TUMBAN) {
  const f = path.join(raiz, m.fichero);
  const original = fs.readFileSync(f);
  const s = original.toString('utf8');
  if (s.split(m.de).length - 1 !== 1) { console.log('CIEGO · ' + m.de.trim()); continue; }
  fs.writeFileSync(f, s.replace(m.de, m.a));
  const r = corre();
  fs.writeFileSync(f, original);
  if (!fs.readFileSync(f).equals(original)) { console.log('NO RESTAURADO'); process.exit(2); }
  const cae = r.filter((c) => c.v === 'not ok').map((c) => c.n);
  const suyo = cae.some((n) => n.includes(m.cae));
  console.log(`${suyo ? 'MUERE' : 'VIVE'} · «${m.de.trim().slice(0, 60)}» · caen ${cae.length}/${r.length} · su caso ${suyo ? 'cae' : 'NO cae'}`);
}
