// SCRUM-1442c · corre las mutaciones que declara el test, con las piezas DE LA CASA
// (`mutacionesDeclaradas`, `correr`, `aplicarUna` de scripts/meta-guard-mutaciones.mjs): la misma
// aplicación, restauración byte a byte (fuente y dist/) y veredicto que el meta-guard del CI.
// Uso: node docs/master/evidencias/SCRUM-1442/mutaciones.mjs   (con dist/ al día del fuente)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { mutacionesDeclaradas, correr, aplicarUna } from '../../../../scripts/meta-guard-mutaciones.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
const GUARD = 'tests/scrum1442c-la-tarjeta-del-pdf-sin-nan.test.mjs';
const muts = mutacionesDeclaradas(fs.readFileSync(path.join(RAIZ, GUARD), 'utf8'), GUARD);
console.log(`POBLACION · ${muts.length} mutaciones declaradas en ${GUARD}`);
if (muts.length === 0) { console.log('CIEGO: ninguna declaración legible'); process.exit(2); }

const NOMBRE = path.basename(GUARD); // `correr` y `aplicarUna` lo resuelven bajo tests/
const limpia = await correr(NOMBRE);
console.log(`BASE sin mutar · ${JSON.stringify({ caidos: limpia.caidos, pasan: limpia.pasan?.length ?? limpia.pasan })}`);
let malas = 0;
for (const [i, m] of muts.entries()) {
  const r = await aplicarUna(m, NOMBRE, limpia);
  const v = r.ciego ? `CIEGO (${r.ciego})` : r.ok ? 'VIVA (cae donde dice)' : `MUDA (${r.motivo ?? JSON.stringify(r)})`;
  if (!r.ok) malas += 1;
  console.log(`M${i + 1} · ${v}`);
}
console.log(`RESUMEN · ${muts.length - malas}/${muts.length} vivas`);
process.exit(malas ? 1 : 0);
