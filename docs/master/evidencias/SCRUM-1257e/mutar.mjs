// docs/master/evidencias/SCRUM-1257e/mutar.mjs — EL ROJO PRIMERO de `guard:modo-en-ajustes`, EN NAVEGADOR.
//
// Uso:  node docs/master/evidencias/SCRUM-1257e/mutar.mjs
//
// SIN LISTA PROPIA (SCRUM-1387). Las mutaciones son las MUTACIONES_QUE_ME_TUMBAN de
// `tests/scrum1257e-modo-en-ajustes-tres-modos.test.mjs`, leídas con el lector del meta-guard (por
// AST, sin ejecutar el test). La red de la casa (`npm run meta:mutaciones`) las aplica contra ese test
// de la tanda; esto las aplica contra el guard de NAVEGADOR, una cada vez, y RESTAURA el fichero por
// bytes (sha256 antes = sha256 después, o sale con 3).
//
// Qué modos TIENEN que caer en el guard y cuáles NO lo dice la tabla de abajo, por el `a` de cada
// mutación: un guard que cae en todos los modos tampoco está midiendo el modo.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { mutacionesDeclaradas } from '../../../../scripts/meta-guard-mutaciones.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');
const TEST = 'tests/scrum1257e-modo-en-ajustes-tres-modos.test.mjs';
const GUARD = path.join(RAIZ, 'scripts/guard-modo-en-ajustes.mjs');
const sha = (b) => crypto.createHash('sha256').update(b).digest('hex');

const suyas = mutacionesDeclaradas(fs.readFileSync(path.join(RAIZ, TEST), 'utf8'), TEST);
if (suyas.length !== 4) { console.log(`CIEGO: esperaba las 4 mutaciones de ${TEST} y leo ${suyas.length}`); process.exit(2); }

// Qué casos del guard caen con cada una. Se casa por el `a`, no por la posición en la lista.
const ESPERADO = [
  { si: 'DETALLE_MODO_EMISION.receipt;', id: 'M1', cae: ['fiscal', 'demo'], noCae: ['receipt', 'null'] },
  { si: '!== "receipt"', id: 'M2', cae: ['receipt'], noCae: ['fiscal', 'demo', 'null'] },
  { si: 'slice(0, -1)', id: 'M3', cae: ['receipt'], noCae: ['fiscal', 'demo', 'null'] },
  { si: 'fila.remove()', id: 'M4', cae: ['fiscal', 'demo', 'receipt'], noCae: ['null'] },
];

let mal = 0;
const copias = new Map();
try {
  for (const m of suyas) {
    const e = ESPERADO.find((x) => m.a.includes(x.si));
    if (!e) { console.log('CIEGA: una mutación del test no está en la tabla de esperados: ' + JSON.stringify(m.a)); mal++; continue; }
    const F = path.join(RAIZ, m.fichero);
    if (!copias.has(F)) copias.set(F, fs.readFileSync(F));
    const original = copias.get(F);
    const txt = original.toString('utf8');
    if (txt.split(m.de).length !== 2) { console.log(e.id + ' CIEGA: el ancla no está una sola vez'); mal++; continue; }
    fs.writeFileSync(F, txt.replace(m.de, m.a));
    const r = spawnSync(process.execPath, [GUARD], { encoding: 'utf8' });
    fs.writeFileSync(F, original);
    const salida = (r.stdout || '') + (r.stderr || '');
    const caen = new Set([...salida.matchAll(/🔴 \[([a-z]+)/g)].map((x) => x[1]));
    const ok = r.status === 1 && e.cae.every((c) => caen.has(c)) && e.noCae.every((c) => !caen.has(c));
    if (!ok) mal++;
    console.log(`${ok ? '✔' : '✘'} ${e.id} · en el test cae «${m.cae}» · en el navegador: salida ${r.status} · caen [${[...caen].join(', ')}]`
      + ` · tenían que caer [${e.cae.join(', ')}] y NO [${e.noCae.join(', ')}]`);
    for (const l of salida.split('\n').filter((l) => /🔴 \[|pintada:|fuente: /.test(l))) console.log('     ' + l.trim());
  }
} finally {
  for (const [F, b] of copias) fs.writeFileSync(F, b);
}
for (const [F, b] of copias) {
  const despues = sha(fs.readFileSync(F));
  console.log(`\n${path.relative(RAIZ, F)} sha256 antes ${sha(b).slice(0, 12)} · después ${despues.slice(0, 12)}`);
  if (despues !== sha(b)) { console.log('🔴 EL FICHERO NO QUEDÓ COMO ESTABA'); process.exit(3); }
}
console.log(mal ? `🔴 ${mal} mutación(es) sin el rojo esperado` : `✔ las ${suyas.length} mutaciones caen en el navegador donde tienen que caer, y sólo ahí`);
process.exit(mal ? 1 : 0);
