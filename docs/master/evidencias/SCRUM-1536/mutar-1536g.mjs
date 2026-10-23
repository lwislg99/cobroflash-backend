// docs/master/evidencias/SCRUM-1536/mutar-1536g.mjs — SCRUM-1536g
// Aplica cada MUTACIONES_QUE_ME_TUMBAN del test de 1536g (leídas con el lector del meta-guard),
// compila con --noCheck, corre el test y restaura el fichero (también si algo falla).
// Primero la BASE sin mutar (A3): si no da 3 verdes, CIEGO y no muta.
// Uso: node mutar-1536g.mjs <raíz del árbol>   · salida: salida-mutar-1536g.txt
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';

const RAIZ = process.argv[2];
// El `tsc` que resuelva la raíz (en un worktree anidado, el del checkout de arriba).
const TSC = createRequire(path.join(RAIZ, 'x.cjs')).resolve('typescript/bin/tsc');
const TEST = 'tests/scrum1536g-el-pais-no-se-cambia.test.mjs';
const { mutacionesDeclaradas } = await import(new URL('file:///' + path.join(RAIZ, 'scripts/meta-guard-mutaciones.mjs').replaceAll('\\', '/')));
const M = mutacionesDeclaradas(fs.readFileSync(path.join(RAIZ, TEST), 'utf8'), path.basename(TEST));
console.log('DECLARADAS', M.length, JSON.stringify(M.map((m) => m.fichero)));
const ENV = { ...process.env };
for (const k of Object.keys(ENV)) if (/^NODE_TEST|^NODE_OPTIONS$|^FORCE_COLOR$/.test(k)) delete ENV[k];

const compilar = () => spawnSync(process.execPath, [TSC, '--noCheck'], { cwd: RAIZ, encoding: 'utf8' }).status;
const correr = () => {
  const r = spawnSync(process.execPath, ['--test', '--test-force-exit', TEST], { cwd: RAIZ, encoding: 'utf8', env: ENV });
  const out = r.stdout + r.stderr;
  const caidos = out.split(/\r?\n/).filter((l) => /^✖ SCRUM-1536g/.test(l)).map((l) => l.replace(/ \(\d.*$/, ''));
  const pasan = out.split(/\r?\n/).filter((l) => /^✔ SCRUM-1536g/.test(l)).length;
  return { status: r.status, caidos: [...new Set(caidos)], pasan };
};

const base = correr();
console.log('BASE', compilar(), JSON.stringify(base));
if (base.pasan !== 3 || base.caidos.length) { console.log('CIEGO: la base no da 3 verdes; no se muta'); process.exit(2); }
for (const m of M) {
  const f = path.join(RAIZ, m.fichero);
  const original = fs.readFileSync(f, 'utf8');
  const veces = original.split(m.de).length - 1;
  if (veces !== 1) { console.log('ANCLA', m.fichero, 'aparece', veces, 'veces'); continue; }
  try {
    fs.writeFileSync(f, original.replace(m.de, m.a));
    const c = compilar();
    const r = correr();
    const cae = r.caidos.some((n) => n.includes(m.cae));
    console.log(cae ? 'VIVA (la tumba)' : 'MUDA', m.fichero, 'tsc=' + c, JSON.stringify(r));
  } finally {
    fs.writeFileSync(f, original);
  }
}
console.log('RESTAURADO', compilar(), JSON.stringify(correr()));
