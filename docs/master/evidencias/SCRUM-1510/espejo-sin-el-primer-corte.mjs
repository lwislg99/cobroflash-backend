// docs/master/evidencias/SCRUM-1510/espejo-sin-el-primer-corte.mjs — SCRUM-1510, punto ciego ②
//
// Monta (o desmonta) un ESPEJO del compilado en el que `ensureInvoicePdf` ya no pregunta por el
// estado: el primer corte queda en `if (false)`. Es la siembra del punto ciego ②.
//
//   node docs/master/evidencias/SCRUM-1510/espejo-sin-el-primer-corte.mjs montar
//   node docs/master/evidencias/SCRUM-1510/espejo-sin-el-primer-corte.mjs desmontar
//
// El espejo vive en `dist/__espejo-1510b/` (ignorado por git, y dentro del árbol para que resuelva
// `node_modules`). Lleva `dist/` y una copia de `tests/`, para poder correr un test contra él sin
// tocar nada. NO se toca `src/` ni el `dist/` de verdad: se coteja por sha256 antes y después.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const RAIZ = path.resolve(import.meta.dirname, '../../../..');
const DIST = path.join(RAIZ, 'dist');
const ESPEJO = path.join(DIST, '__espejo-1510b');
const sha = (f) => crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const VIGILADOS = ['src/lib/invoicing.ts', 'dist/lib/invoicing.js', 'src/modules/invoicing/domain/selladoEstado.ts'];
const foto = () => Object.fromEntries(VIGILADOS.map((r) => [r, sha(path.join(RAIZ, r))]));

const orden = process.argv[2];
if (orden === 'desmontar') {
  fs.rmSync(ESPEJO, { recursive: true, force: true });
  console.log(`espejo desmontado: existe=${fs.existsSync(ESPEJO)}`);
  process.exit(fs.existsSync(ESPEJO) ? 1 : 0);
}
if (orden !== 'montar') { console.error('uso: montar | desmontar'); process.exit(2); }

const antes = foto();
fs.rmSync(ESPEJO, { recursive: true, force: true });
fs.mkdirSync(ESPEJO, { recursive: true });
// De hijo en hijo: node no deja copiar un directorio dentro de sí mismo.
for (const e of fs.readdirSync(DIST)) {
  if (path.join(DIST, e) === ESPEJO) continue;
  fs.cpSync(path.join(DIST, e), path.join(ESPEJO, 'dist', e), { recursive: true });
}
fs.cpSync(path.join(RAIZ, 'tests'), path.join(ESPEJO, 'tests'), { recursive: true });
// El test lee del esquema el estado con el que nace la factura: sin él, el fichero muere al cargar
// y eso se lee como un rojo sin serlo (visto en la primera pasada: «tests 1 · fail 1», 0 casos).
fs.mkdirSync(path.join(ESPEJO, 'prisma'), { recursive: true });
fs.copyFileSync(path.join(RAIZ, 'prisma/schema.prisma'), path.join(ESPEJO, 'prisma/schema.prisma'));

const objetivo = path.join(ESPEJO, 'dist/lib/invoicing.js');
const texto = fs.readFileSync(objetivo, 'utf8');
const CORTE = 'if (!(0, selladoEstado_1.puedeProducirDocumento)(inv.vfEstado)) {';
const veces = texto.split(CORTE).length - 1;
if (veces !== 1) { console.error(`CIEGO: el primer corte aparece ${veces} veces en el compilado (se esperaba 1)`); process.exit(1); }
fs.writeFileSync(objetivo, texto.replace(CORTE, 'if (false) {'));

const despues = foto();
const intacto = VIGILADOS.every((r) => antes[r] === despues[r]);
console.log(`espejo montado en ${path.relative(RAIZ, ESPEJO)}`);
console.log(`  primer corte en el compilado: ${veces} · en el espejo: ${fs.readFileSync(objetivo, 'utf8').split(CORTE).length - 1}`);
console.log(`  sha256 del compilado de verdad : ${despues['dist/lib/invoicing.js']}`);
console.log(`  sha256 del compilado del espejo: ${sha(objetivo)}`);
console.log(`  árbol de verdad igual antes y después (${VIGILADOS.length} ficheros): ${intacto ? 'SÍ' : 'NO'}`);
process.exit(intacto ? 0 : 1);
