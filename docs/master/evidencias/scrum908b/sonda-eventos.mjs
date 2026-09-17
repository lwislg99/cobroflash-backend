// SONDA de SCRUM-908b: ¿el flujo de `run()` entrega SIEMPRE los mismos eventos sobre el MISMO
// arbol? Si el recuento se mueve, hay eventos perdidos, y eso basta para una muda sin que el
// aserto tenga nada malo. No muta nada: solo corre la pasada limpia N veces.
// uso: node sonda-eventos.mjs <RAIZ> <guard> <N>
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const RAIZ = process.argv[2];
const GUARD = process.argv[3];
const N = Number(process.argv[4]);
const mod = await import(pathToFileURL(path.join(RAIZ, 'scripts/meta-guard-mutaciones.mjs')).href);
const { correr } = mod;
const NOMBRE = 'insertar una entrada en medio NO mueve ninguna clave';
const firmas = new Map();
let t0 = Date.now();
for (let i = 1; i <= N; i += 1) {
  const r = await correr(GUARD);
  const f = `pass=${r.pasados.length} fail=${r.caidos.length} skip=${r.saltados.length} movidos=${r.movidos.length}`;
  const vistoElNombrado = r.pasados.some((n) => n.includes(NOMBRE)) || r.caidos.some((n) => n.includes(NOMBRE));
  const clave = `${f} nombrado=${vistoElNombrado ? 'SI' : 'NO'}`;
  firmas.set(clave, (firmas.get(clave) || 0) + 1);
  if (!vistoElNombrado) console.log(`  [${i}] 🔴 EL TEST NOMBRADO NO APARECE: ${f}`);
  if (i % 10 === 0) console.log(`  ...${i}/${N} (${Math.round((Date.now() - t0) / 1000)}s)`);
}
console.log(`\nSONDA ${GUARD} · N=${N} · ${Math.round((Date.now() - t0) / 1000)}s`);
for (const [k, v] of [...firmas.entries()].sort((a, b) => b[1] - a[1])) console.log(`   ${v} x  ${k}`);
console.log(firmas.size === 1 ? 'UNA sola firma: el flujo entrego lo mismo las N veces.'
  : `🔴 ${firmas.size} FIRMAS DISTINTAS sobre el MISMO arbol: el flujo NO es determinista.`);
