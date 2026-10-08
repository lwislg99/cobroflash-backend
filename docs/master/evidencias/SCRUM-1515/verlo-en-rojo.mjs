// SCRUM-1515 · ¿El test de las dos puertas SABE caer? Seis cambios, de uno en uno, sobre `dist/`
// (que no está en git: `src/` no se toca), y el test corrido con cada uno en el banco local.
//
// Uso:  node docs/master/evidencias/SCRUM-1515/verlo-en-rojo.mjs <carpeta node_modules con @electric-sql> <esquema.sql>
// Antes: `tsc --noCheck` y el test en verde sin tocar nada (es la primera fila, «sin cambio»).
// Cada fila dice si el cambio ENTRÓ (el fichero cambió de contenido), con qué código salió el
// test y la primera línea 🔴. Al acabar cada una se restaura el fichero y se comprueba por sha.
// Sale 0 si la base sale 0 y los seis cambios hacen caer el test; 1 si alguno no; 2 si algo no se
// pudo aplicar o restaurar.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.resolve(AQUI, '..', '..', '..', '..');
const GUION = path.join(RAIZ, 'dist', 'modules', 'auth', 'app', 'cli', 'altaDeMerchant.js');
const RUTA = path.join(RAIZ, 'dist', 'modules', 'auth', 'app', 'routes', 'auth.routes.js');
const sha = (f) => crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');

const CAMBIOS = [
  { nombre: 'sin cambio (la base)', esperado: 0 },
  { nombre: 'el guion corta en cuanto vuelve registerMerchant', fichero: GUION,
    de: "process.once('beforeExit', () => {", a: "setImmediate(() => process.exit(0)); process.once('beforeExit', () => {" },
  { nombre: 'el guion no pasa el correo a minúsculas', fichero: GUION,
    de: "String(crudo.email || '').toLowerCase().trim()", a: "String(crudo.email || '').trim()" },
  { nombre: 'el guion no recorta `source` a 200', fichero: GUION,
    de: "String(crudo.source || '').trim().slice(0, 200)", a: "String(crudo.source || '').trim()" },
  { nombre: 'el guion no quita los espacios del país', fichero: GUION,
    de: "String(crudo.country || 'ES').trim()", a: "String(crudo.country || 'ES')" },
  { nombre: 'el guion escribe la fila A MANO en vez de llamar a registerMerchant', fichero: GUION,
    de: 'await (0, auth_service_1.registerMerchant)(campos);',
    a: 'await prisma_1.prisma.merchant.create({ data: { name: campos.name, email: campos.email, country: campos.country, plan: "trial", status: "active" } });' },
  { nombre: 'la RUTA deja de recortar `source` a 200 (las copias divergen por el otro lado)', fichero: RUTA,
    de: "String(req.body?.source || '').trim().slice(0, 200)", a: "String(req.body?.source || '').trim()" },
];

let mal = 0;
for (const c of CAMBIOS) {
  let antes = null; let entro = 'no aplica';
  if (c.fichero) {
    antes = fs.readFileSync(c.fichero);
    const texto = antes.toString('utf8');
    if (texto.split(c.de).length !== 2) { console.log(`CIEGO  ${c.nombre}: el texto a cambiar aparece ${texto.split(c.de).length - 1} veces en ${path.relative(RAIZ, c.fichero)}`); process.exit(2); }
    fs.writeFileSync(c.fichero, texto.replace(c.de, () => c.a));
    entro = sha(c.fichero) !== crypto.createHash('sha256').update(antes).digest('hex') ? 'sí' : 'NO';
  }
  const r = spawnSync(process.execPath, [path.join(AQUI, 'banco-local.mjs'), process.argv[2], process.argv[3]], { cwd: RAIZ, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  const salida = (r.stdout || '') + (r.stderr || '');
  if (antes) {
    fs.writeFileSync(c.fichero, antes);
    if (sha(c.fichero) !== crypto.createHash('sha256').update(antes).digest('hex')) { console.log(`NO SE RESTAURÓ ${c.fichero}`); process.exit(2); }
  }
  const pasan = (salida.match(/^ℹ pass (\d+)/m) || [])[1]; const caen = (salida.match(/^ℹ fail (\d+)/m) || [])[1];
  const queda = (salida.match(/merchants que quedan al terminar: (\d+)/) || [])[1];
  const primera = (salida.split(/\r?\n/).find((l) => l.includes('🔴')) || '').trim().slice(0, 230);
  const cae = r.status !== 0 && caen === '1';
  const cuadra = c.esperado === 0 ? r.status === 0 && pasan === '1' : cae && entro === 'sí';
  if (!cuadra) mal += 1;
  console.log(`${cuadra ? 'cuadra' : 'NO CUADRA'} · ${c.nombre}\n    entró=${entro} · salida=${r.status} · pass=${pasan} fail=${caen} · merchants que quedan=${queda}${primera ? `\n    ${primera}` : ''}`);
}
console.log(`FILAS=${CAMBIOS.length} · que no cuadran=${mal} · EXIT=${mal ? 1 : 0}`);
process.exit(mal ? 1 : 0);
