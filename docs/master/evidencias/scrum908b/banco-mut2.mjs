// SCRUM-908b · N pasadas de la MUTACION #2 de scrum859 sobre la MISMA base.
// N se declara por argumento, ANTES de correr. Reutiliza una unica pasada limpia y la
// RE-VERIFICA al final: si la linea base cambio, el bloque entero queda invalidado y lo dice.
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const RAIZ = process.argv[2];
const N = Number(process.argv[3]);
const mod = await import(pathToFileURL(path.join(RAIZ, 'scripts/meta-guard-mutaciones.mjs')).href);
const { censoDeDeclaraciones, correr, aplicarUna } = mod;
const GUARD = 'scrum859-identidad-y-motivo-cerrado.test.mjs';
const decl = censoDeDeclaraciones().find((c) => c.guard === GUARD);
const MUT = decl.mutaciones[1]; // la #2
console.log(`N DECLARADA = ${N}`);
console.log(`mutacion #2: ${MUT.fichero}`);
console.log(`   de: ${MUT.de}`);
console.log(`    a: ${MUT.a}`);
console.log(`  cae: ${MUT.cae}`);
const firma = (r) => `pass=${r.pasados.length} fail=${r.caidos.length} skip=${r.saltados.length} movidos=${r.movidos.length}`;
const limpia = await correr(GUARD);
console.log(`LINEA BASE: ${firma(limpia)}`);
const t0 = Date.now();
const cuenta = { VIVA: 0, MUDA: 0, CIEGA: 0, MUERTA: 0 };
for (let i = 1; i <= N; i += 1) {
  const r = await aplicarUna(MUT, GUARD, limpia);
  const v = r.ok ? 'VIVA' : (r.muerto ? 'MUERTA' : (r.mudo ? 'MUDA' : 'CIEGA'));
  cuenta[v] += 1;
  if (v !== 'VIVA') {
    console.log(`  [${i}] 🔴 ${v}`);
    console.log('      ' + String(r.mudo || r.ciego || r.muerto).replace(/\n/g, '\n      '));
  }
  if (i % 5 === 0) console.log(`  ...${i}/${N} (${Math.round((Date.now() - t0) / 1000)}s) vivas=${cuenta.VIVA} MUDAS=${cuenta.MUDA} ciegas=${cuenta.CIEGA}`);
}
const limpia2 = await correr(GUARD);
console.log(`\nLINEA BASE AL FINAL: ${firma(limpia2)}  ${firma(limpia) === firma(limpia2) ? '(IGUAL: el bloque vale)' : '🔴 (CAMBIO: el bloque NO vale)'}`);
console.log(`RESULTADO N=${N} · vivas ${cuenta.VIVA} · MUDAS ${cuenta.MUDA} · ciegas ${cuenta.CIEGA} · muertas ${cuenta.MUERTA} · ${Math.round((Date.now() - t0) / 1000)}s`);
