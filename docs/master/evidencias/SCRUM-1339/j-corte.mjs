// docs/master/evidencias/SCRUM-1339/j-corte.mjs — SCRUM-1339j · ¿QUÉ DICTA EL META-GUARD SEGÚN
// CUÁNTA COLA NO LLEGA?
//
// El meta-guard DE LA CASA (`correr` y `aplicarUna`, sin copiar nada) sobre un guard y sus
// mutaciones, con la cola del canal hijo→padre recortada en N bytes por `j-sonda-tuberia.mjs`.
// N=0 es el control: no se recorta nada y tiene que salir lo mismo que sin sonda.
//
//   NODE_OPTIONS='--import file:///…/j-sonda-tuberia.mjs' node j-corte.mjs <raíz> <guard> <N1,N2,…>
//
// ⚠️ MUTA el árbol (lo hace `aplicarUna`, que restaura en su `finally`); al acabar se comprueban
// por sha256 los ficheros mutados.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { pathToFileURL } from 'node:url';

const [RAIZ, GUARD, lista = '0'] = process.argv.slice(2);
if (!RAIZ || !GUARD) { console.error('uso: node j-corte.mjs <raíz> <guard> <N1,N2,…>'); process.exit(2); }
if (!/j-sonda-tuberia/.test(process.env.NODE_OPTIONS || '')) { console.log('🔴 CIEGO: la sonda no está en NODE_OPTIONS; sin ella todos los cortes medirían lo mismo.'); console.log('EXIT=3'); process.exit(3); }
const M = await import(pathToFileURL(path.join(RAIZ, 'scripts/meta-guard-mutaciones.mjs')).href);
const sha = (b) => crypto.createHash('sha256').update(b).digest('hex').slice(0, 12);
const muts = M.mutacionesDeclaradas(fs.readFileSync(path.join(RAIZ, 'tests', GUARD), 'utf8'), GUARD);
const antes = new Map(muts.map((m) => [m.fichero, sha(fs.readFileSync(path.join(RAIZ, m.fichero)))]));
const clase = (r) => (r.ok ? 'VIVA' : r.ciego ? 'CIEGO' : r.muerto ? 'FICHERO MUERTO' : r.mudo ? 'MUDA' : '(sin clasificar)');
console.log(`node ${process.version} ${process.platform} · ${GUARD} · ${muts.length} mutaciones · cortes: ${lista}`);

const cuenta = {};
for (const N of lista.split(',').map(Number)) {
  process.env.J_COLA = String(N);
  const limpia = await M.correr(GUARD);
  console.log(`\n══ COLA QUE NO LLEGA: ${N} B · LIMPIA ${limpia.pasados.length} pasados · ${limpia.caidos.length} caídos`);
  let k = 0;
  for (const mut of muts) {
    k += 1;
    const r = await M.aplicarUna(mut, GUARD, limpia);
    const c = clase(r);
    cuenta[c] = (cuenta[c] || 0) + 1;
    const texto = String(r.ciego || r.muerto || r.mudo || '');
    const rec = /Recuento: (\d+ pasados · \d+ caídos · \d+ saltados)/.exec(texto)?.[1];
    const faltan = /FALTAN (\d+ de los \d+)/.exec(texto)?.[1];
    const causa = !texto ? '' : /NO APARECE en la pasada mutada/.test(texto) ? ' · NO APARECE en la mutada' : /EL FICHERO SALIÓ ROJO POR SU RUTA/.test(texto) ? ' · fichero rojo por su ruta' : ' · (otra causa: ' + texto.replace(/\s+/g, ' ').slice(0, 120) + ')';
    console.log(`   mutación ${k} («${mut.cae.slice(12, 52)}…») → ${c}${causa}${rec ? ' · mutada: ' + rec : ''}${faltan ? ' · faltan ' + faltan : ''}`);
  }
}
delete process.env.J_COLA;
console.log(`\nRECUENTO de veredictos: ${Object.entries(cuenta).map(([c, n]) => `${c} ${n}`).join(' · ')}`);
let sucio = 0;
for (const [f, h] of antes) if (sha(fs.readFileSync(path.join(RAIZ, f))) !== h) { sucio += 1; console.log(`🔴 ${f} NO está como estaba`); }
console.log(`ÁRBOL: ${antes.size} fichero(s) mutados comprobados por sha256 · distintos de antes: ${sucio}`);
console.log(`EXIT=${sucio ? 3 : 0}`);
process.exit(sucio ? 3 : 0);
