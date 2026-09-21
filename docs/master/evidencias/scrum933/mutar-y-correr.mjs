// docs/master/evidencias/scrum933/mutar-y-correr.mjs — SCRUM-933
//
// ═════════════════════════════════════════════════════════════════════════════════════════════
// 🔴 LA SONDA INDEPENDIENTE · aplica UNA mutación de las que declara `scrum864c`, corre ese guard
// con `node --test` a pelo y restaura. No usa ninguna pieza del meta-guard: es la segunda sonda,
// y vale precisamente porque no comparte código con la primera (`veredicto-del-meta-guard.mjs`).
//
//     node docs/master/evidencias/scrum933/mutar-y-correr.mjs 0    ← sin mutar (control)
//     node docs/master/evidencias/scrum933/mutar-y-correr.mjs 1    ← la 1ª declarada
//     node docs/master/evidencias/scrum933/mutar-y-correr.mjs 2    ← la 2ª, la que salía MUDA
//
// Antes de creerse un verde comprueba que la mutación ENTRÓ: el ancla aparece exactamente UNA vez
// antes, CERO después, y el sustituto UNA. Restaura en un `finally` con los bytes de DISCO
// (SCRUM-570) y lo verifica por SHA-256; si no cuadra, sale con 3.
//
// Es una FOTO de la tanda del 18-sep-2026: las anclas están copiadas de la declaración de aquel
// día. Si la declaración cambia, esto caduca, y lo dice: «el ancla aparece 0 veces, no muto».
// No escribe nada dentro del árbol salvo la mutación, que se deshace.
// ═════════════════════════════════════════════════════════════════════════════════════════════
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
const F = path.join(RAIZ, 'scripts/_censo-mkdtemp.mjs');
const GUARD = 'tests/scrum864c-el-temporal-no-vuelve.test.mjs';
const MUTS = {
  1: {
    de: "    if (ts.isBlock(p) && p.parent && ts.isTryStatement(p.parent) && p.parent.finallyBlock === p) return 'finally';",
    a: '    if (false) return null;',
  },
  2: { de: '      if (!b.ids.has(d.nombre)) return false;', a: '      if (!b.ids.has(d.nombre)) return true;' },
};
const sha = (b) => crypto.createHash('sha256').update(b).digest('hex');
const cuenta = (t, s) => t.split(s).length - 1;

const n = Number(process.argv[2]);
if (!(n in MUTS) && n !== 0) {
  console.error('uso: mutar-y-correr.mjs <0|1|2>');
  process.exit(2);
}
const ORIGINAL = fs.readFileSync(F);
const SHA0 = sha(ORIGINAL);
const texto = ORIGINAL.toString('utf8');
console.log(`sha256 antes .......... ${SHA0}`);

let codigo = null;
try {
  if (n) {
    const m = MUTS[n];
    const veces = cuenta(texto, m.de);
    console.log(`ancla de la mutación ${n}: aparece ${veces} vez/veces`);
    if (veces !== 1) throw new Error(`🔴 el ancla aparece ${veces} veces, no 1: no muto`);
    fs.writeFileSync(F, texto.replace(m.de, m.a));
    const MUT = fs.readFileSync(F);
    const t2 = MUT.toString('utf8');
    console.log(`tras mutar: ancla ${cuenta(t2, m.de)} · sustituto ${cuenta(t2, m.a)} · sha256 ${sha(MUT)}`);
    if (cuenta(t2, m.de) !== 0 || cuenta(t2, m.a) !== 1 || Buffer.compare(MUT, ORIGINAL) === 0) {
      throw new Error('🔴 la mutación no entró como se esperaba');
    }
  }
  const r = spawnSync(process.execPath, ['--test', '--test-force-exit', '--test-reporter=spec', GUARD],
    { cwd: RAIZ, encoding: 'utf8' });
  codigo = r.status;
  const salida = (r.stdout || '') + (r.stderr || '');
  for (const l of salida.split('\n')) {
    if (/^\s*[✔✖]|^ℹ (tests|pass|fail|skipped)|^\s*actual: \[/.test(l)) console.log('   ' + l.trim());
  }
} finally {
  fs.writeFileSync(F, ORIGINAL);
  const SHA1 = sha(fs.readFileSync(F));
  console.log(`sha256 restaurado ..... ${SHA1}  ${SHA1 === SHA0 ? 'IGUAL ✔' : '🔴 DISTINTO'}`);
  if (SHA1 !== SHA0) process.exitCode = 3;
}
console.log(`EXIT DEL GUARD (mutación ${n}) = ${codigo}`);
