// SCRUM-1579 · fabrica las variantes del test en tests/_v1579-*.mjs (se borran despues a mano).
// Uso: node variantes.mjs <raiz del worktree> <fichero original de main>
import fs from 'node:fs';
import path from 'node:path';

const [raiz, original] = process.argv.slice(2);
const final = fs.readFileSync(path.join(raiz, 'tests', 'scrum1515-nuestra-puerta-de-alta.test.mjs'), 'utf8');
const main = fs.readFileSync(original, 'utf8');

function cambia(texto, de, a, nombre) {
  const n = texto.split(de).length - 1;
  if (n !== 1) { console.log(`CIEGO ${nombre}: el ancla aparece ${n} veces`); process.exit(2); }
  return texto.replace(de, a);
}

const FILTRO = 'const cuantos = () => prisma.merchant.count({ where: deEsteCaso });';
const ULTIMO = "assert.equal(await cuantos(), alEmpezar + 2, '🔴 al acabar hay más merchants que los dos del guion');";
const AJENO_TARDE = "const tarde = await prisma.merchant.create({ data: { name: 'Ajeno tarde', email: `tarde-1579-${process.pid}@test.local`, country: 'ES' } }); try { ";
const AJENO_TARDE_FIN = " } finally { await prisma.merchant.delete({ where: { id: tarde.id } }); }";
const TRAS_B = "const guion = { A: await foto(A.email), B: await foto(B.email) };";

const v = {
  // R1: el arreglo SIN su filtro (recuento de la tabla entera) con el ajeno sembrado: tiene que caer.
  'r1-sin-filtro': cambia(final, FILTRO, 'const cuantos = () => prisma.merchant.count();', 'r1'),
  // R2: el test de main tal cual, con un ajeno creado justo antes del ultimo recuento: el rojo del CI.
  'r2-main-ajeno-tarde': cambia(main, ULTIMO, AJENO_TARDE + ULTIMO + AJENO_TARDE_FIN, 'r2'),
  // F2: el arreglo con el MISMO ajeno tardio: tiene que pasar.
  'f2-arreglo-ajeno-tarde': cambia(final, ULTIMO, AJENO_TARDE + ULTIMO + AJENO_TARDE_FIN, 'f2'),
  // M1: el guion crea un tercer merchant con correo del caso: tiene que seguir cayendo.
  'm1-guion-de-mas': cambia(final, TRAS_B, "await porElGuion({ name: 'De mas', email: `de-mas-1515-${sello.toLowerCase()}@test.local`, country: 'PT' }); " + TRAS_B, 'm1'),
};
for (const [nombre, texto] of Object.entries(v)) {
  const destino = path.join(raiz, 'tests', `_v1579-${nombre}.mjs`);
  fs.writeFileSync(destino, texto);
  console.log(`escrito ${path.relative(raiz, destino)} · ${texto.length} caracteres · distinto del final: ${texto !== final}`);
}
