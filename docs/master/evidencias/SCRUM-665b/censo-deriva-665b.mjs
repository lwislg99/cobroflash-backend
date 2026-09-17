// SCRUM-665b · ② ¿HAY MÁS DIVERGENCIAS ENTRE `prisma/schema.prisma` Y LA BASE?
//
// ── QUÉ SE COMPARA, Y EN LAS DOS DIRECCIONES ────────────────────────────────────────────────
// El arranque (`schemaDrift`, SCRUM-222) sólo mira UNA: **esperado ⊆ real**, o sea qué columnas
// declara el esquema y NO existen en la base. Es la dirección que tumba el arranque, y por eso es
// la que vigila.
//
// 🔴 PERO SCRUM-665 ERA LA OTRA: siete columnas que la base TENÍA y el esquema NO declaraba. Ésa
// no rompe nada al arrancar —por eso nadie se entera— y es la que fabrica los «columna que no
// existe» sobre columnas que sí están. Aquí se miden LAS DOS.
//
// ── LO QUE SE REUSA, para no escribir un tercer criterio ────────────────────────────────────
// `tablasEsperadas` y `compararEsquema` son los del arranque (`src/core/db/schemaDrift.ts`), con
// su suelo anti-falso-positivo dentro. Un censo con su propia idea de qué es una columna daría un
// número distinto del que decide si producción levanta.
//
// ── ⛔ LO QUE ESTE CENSO NO PUEDE MIRAR, y se declara ───────────────────────────────────────
// SÓLO compara contra **DESARROLLO**. No tengo credenciales de staging ni de producción, y el
// encargo prohíbe tocarlas. Así que este resultado NO dice nada de las otras dos bases.
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const RAIZ = 'C:/Users/Javier Pereira/cobroflash-b2';
process.chdir(RAIZ);

const { tablasEsperadas, compararEsquema } = await import('../../../../dist/core/db/schemaDrift.js');
const { Prisma } = await import('@prisma/client');

const url = process.env.DATABASE_URL_DEV;
if (!url) { console.error('🔴 sin DATABASE_URL_DEV'); process.exit(2); }

const esperadas = tablasEsperadas(Prisma.dmmf.datamodel);
const modelos = Prisma.dmmf.datamodel.models.length;
const columnasEsperadas = esperadas.reduce((a, t) => a + t.columnas.length, 0);

console.log('── POBLACIÓN ───────────────────────────────────────────────────────────');
console.log('   base comparada          : DESARROLLO (DATABASE_URL_DEV) · y SÓLO ésa');
console.log('   modelos en el esquema   : ' + modelos);
console.log('   tablas esperadas        : ' + esperadas.length);
console.log('   columnas esperadas      : ' + columnasEsperadas);

const prisma = new PrismaClient({ datasources: { db: { url } } });
try {
  const [huella] = await prisma.$queryRaw`
    SELECT pg_postmaster_start_time()::text AS arranque, (SELECT count(*) FROM invoices) AS inv`;
  console.log('   huella de la base       : arranque ' + huella.arranque + ' · invoices ' + huella.inv);

  const enLaBd = await prisma.$queryRaw`
    SELECT table_name AS tabla, column_name AS columna
    FROM information_schema.columns WHERE table_schema = 'public'`;
  const tablasBd = new Set(enLaBd.map((c) => c.tabla));
  console.log('   tablas en la base       : ' + tablasBd.size);
  console.log('   columnas en la base     : ' + enLaBd.length);
  console.log('');

  // ── SUELO ──────────────────────────────────────────────────────────────────────────────────
  if (enLaBd.length === 0 || esperadas.length === 0) {
    console.error('🔴 CIEGO: el catálogo devolvió ' + enLaBd.length + ' columnas y el esquema '
      + esperadas.length + ' tablas. Un cero aquí no es «no hay deriva»: es que no estoy mirando.');
    process.exit(3);
  }

  // ── DIRECCIÓN A · lo que el ESQUEMA declara y la BASE no tiene (la que tumba el arranque) ──
  const veredicto = compararEsquema(esperadas, enLaBd.map((c) => ({ tabla: c.tabla, columna: c.columna })));
  console.log('── ⓐ EL ESQUEMA DECLARA Y LA BASE NO TIENE (la que vigila el arranque) ──');
  console.log('   veredicto de `compararEsquema`: ' + veredicto.estado);
  console.log('   claves que devuelve           : ' + Object.keys(veredicto).join(', '));
  const faltan = veredicto.columnasQueFaltan || [];
  const tablasQueFaltan = veredicto.tablasQueFaltan || [];
  console.log('   TABLAS que faltan             : ' + tablasQueFaltan.length
    + (tablasQueFaltan.length ? ' → ' + tablasQueFaltan.join(', ') : ''));
  console.log('   COLUMNAS que faltan           : ' + faltan.length);
  for (const f of faltan) console.log('     🔴 ' + f.tabla + '.' + f.columna + '   (modelo ' + f.modelo + '.' + f.campo + ')');
  console.log('');

  // ── DIRECCIÓN B · lo que la BASE tiene y el ESQUEMA no declara (la de SCRUM-665) ───────────
  // ⚠️ `columnas` es un array de OBJETOS `{campo, columna}`, no de cadenas. Meterlos en un `Set`
  // y preguntar por el nombre da SIEMPRE `false`: en la primera pasada eso me dio «435 de 435 sin
  // declarar», incluida `merchants.name`, que el esquema declara desde el primer día. Un número
  // imposible al lado de «faltan 0» — dos resultados que no pueden ser ciertos a la vez.
  const esperadoPorTabla = new Map(esperadas.map((t) => [t.tabla, new Set(t.columnas.map((c) => c.columna))]));
  const sobran = enLaBd
    .filter((c) => esperadoPorTabla.has(c.tabla) && !esperadoPorTabla.get(c.tabla).has(c.columna))
    .sort((a, b) => (a.tabla + a.columna).localeCompare(b.tabla + b.columna));
  console.log('── ⓑ LA BASE TIENE Y EL ESQUEMA NO DECLARA (la de SCRUM-665) ────────────');
  console.log('   columnas no declaradas: ' + sobran.length);
  for (const c of sobran) console.log('     ⚠️ ' + c.tabla + '.' + c.columna);
  console.log('');

  // ── TABLAS que la base tiene y el esquema no nombra (informativo, no es deriva de columna) ─
  const tablasNoEsperadas = [...tablasBd].filter((t) => !esperadoPorTabla.has(t)).sort();
  console.log('── ⓒ TABLAS de la base que el esquema no nombra (informativo) ───────────');
  console.log('   ' + tablasNoEsperadas.length + (tablasNoEsperadas.length ? ': ' + tablasNoEsperadas.join(', ') : ''));
  console.log('');

  console.log('── RESUMEN ─────────────────────────────────────────────────────────────');
  console.log('   ⓐ esquema→base que faltan : ' + faltan.length);
  console.log('   ⓑ base→esquema sin declarar: ' + sobran.length);
  console.log('   ⓒ tablas ajenas al esquema : ' + tablasNoEsperadas.length);
  console.log('');
  console.log('⛔ Y NO SE ARREGLA NINGUNA (regla 9): una divergencia que alguien arregla de paso es');
  console.log('   una decisión de esquema tomada sin que el fundador se entere.');
} finally {
  await prisma.$disconnect();
}
