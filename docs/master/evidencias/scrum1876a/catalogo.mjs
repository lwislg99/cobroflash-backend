// SCRUM-1876a · lectura del CATÁLOGO de una base, solo SELECT.
//
// Para cada uno de los 11 objetos que la base tiene y `prisma/schema.prisma` de main no, lee
// `information_schema.columns`, `pg_indexes` y las claves ajenas de `pg_constraint`.
//
// uso:  node docs/master/evidencias/scrum1876a/catalogo.mjs DATABASE_URL_DEV
//       node docs/master/evidencias/scrum1876a/catalogo.mjs DATABASE_URL_STAGING
//
// · La URL entra por el ENTORNO (la carga `scripts/_cargar-env.mjs`), nunca por argumento, y no
//   se imprime: lo que se imprime es `current_database()`, que lo contesta la propia base.
// · No acepta otra clave: producción no se mira desde un árbol.
// · Controles (A5: dos de tipos DISTINTOS más `current_database()`):
//     positivo de columna → `invoices.merchantId` TIENE que salir;
//     positivo de índice  → la clave primaria de `invoices` TIENE que salir;
//     negativo derivado   → cada columna pedida con el sufijo `_zz1876` tiene que dar 0 filas.
//   Si un positivo no sale o el negativo da algo, el veredicto es CIEGO (salida 2), no «faltan».
// · Salida: 0 = los 11 están · 1 = falta alguno (los nombra) · 2 = CIEGO.
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.resolve(AQUI, '..', '..', '..', '..');

const CLAVES = ['DATABASE_URL_DEV', 'DATABASE_URL_STAGING'];
const clave = process.argv[2];
if (!CLAVES.includes(clave)) {
  console.error(`uso: catalogo.mjs ${CLAVES.join('|')}`);
  process.exit(2);
}

const { cargarEnvDelEquipo } = await import(pathToFileURL(path.join(RAIZ, 'scripts', '_cargar-env.mjs')).href);
cargarEnvDelEquipo();
const url = process.env[clave];
if (!url) {
  console.error(`CIEGO: ${clave} no está en el entorno.`);
  process.exit(2);
}

export const COLUMNAS = [
  ['customers', 'callback_on'],
  ['customers', 'callback_note'],
  ['customers', 'pay_methods_por_defecto'],
  ['invoices', 'retencion_irpf_importe'],
  ['quote_templates', 'discount_global_amount'],
  ['albaranes', 'firmado_en_dispositivo_at'],
  ['albaranes', 'ventana_suelo_at'],
  ['albaranes', 'ventana_suelo_fuente'],
  ['albaranes', 'parte_id'],
];
export const INDICES = ['customers_merchant_id_callback_on_idx', 'albaranes_merchant_id_parte_id_idx'];
// `Invoice.merchantId` no lleva `@map`: la columna se llama `merchantId`, no `merchant_id`. Con
// `merchant_id` (el ejemplo del encargo) este control daba 0 filas y el veredicto fue CIEGO.
const CONTROL_COLUMNA = ['invoices', 'merchantId'];
const CONTROL_INDICE = 'invoices_pkey';

const { PrismaClient } = (await import('@prisma/client')).default;
const prisma = new PrismaClient({ datasourceUrl: url });

const SQL_COLUMNAS =
  'SELECT table_name, column_name, data_type, udt_name, numeric_precision, numeric_scale, ' +
  'datetime_precision, character_maximum_length, is_nullable, column_default ' +
  "FROM information_schema.columns WHERE table_schema = 'public' AND table_name = $1 AND column_name = $2";
const SQL_INDICE = "SELECT indexname, indexdef FROM pg_indexes WHERE schemaname = 'public' AND indexname = $1";
const SQL_AJENAS =
  'SELECT c.conname, t.relname AS tabla, pg_get_constraintdef(c.oid) AS def FROM pg_constraint c ' +
  "JOIN pg_class t ON t.oid = c.conrelid JOIN pg_namespace n ON n.oid = t.relnamespace " +
  "WHERE n.nspname = 'public' AND c.contype = 'f' AND t.relname = ANY($1::text[])";

let salida = 0;
try {
  const [{ base }] = await prisma.$queryRawUnsafe('SELECT current_database() AS base');
  console.log(`clave: ${clave} · current_database(): ${base}`);

  const ctrlCol = await prisma.$queryRawUnsafe(SQL_COLUMNAS, ...CONTROL_COLUMNA);
  const ctrlIdx = await prisma.$queryRawUnsafe(SQL_INDICE, CONTROL_INDICE);
  let negativos = 0;
  for (const [t, c] of COLUMNAS) {
    negativos += (await prisma.$queryRawUnsafe(SQL_COLUMNAS, t, `${c}_zz1876`)).length;
  }
  for (const i of INDICES) negativos += (await prisma.$queryRawUnsafe(SQL_INDICE, `${i}_zz1876`)).length;
  console.log(
    `control positivo columna ${CONTROL_COLUMNA.join('.')}: ${ctrlCol.length} fila(s)` +
      (ctrlCol[0] ? ` (${ctrlCol[0].data_type}, nullable ${ctrlCol[0].is_nullable})` : ''),
  );
  console.log(`control positivo índice ${CONTROL_INDICE}: ${ctrlIdx.length} fila(s)`);
  console.log(`control negativo (11 nombres con sufijo _zz1876): ${negativos} fila(s)`);
  if (ctrlCol.length !== 1 || ctrlIdx.length !== 1 || negativos !== 0) {
    console.log('VEREDICTO: CIEGO — un control no dio lo que tenía que dar; lo de abajo no se juzga.');
    salida = 2;
  }

  const faltan = [];
  console.log('\n| objeto | data_type (udt) | precisión | nullable | default |');
  console.log('|---|---|---|---|---|');
  for (const [t, c] of COLUMNAS) {
    const f = await prisma.$queryRawUnsafe(SQL_COLUMNAS, t, c);
    if (f.length !== 1) {
      faltan.push(`${t}.${c}`);
      console.log(`| ${t}.${c} | NO ESTÁ (${f.length} filas) | | | |`);
      continue;
    }
    const r = f[0];
    const precision =
      r.numeric_precision != null && r.udt_name === 'numeric'
        ? `numeric(${r.numeric_precision},${r.numeric_scale})`
        : r.datetime_precision != null
          ? `datetime_precision ${r.datetime_precision}`
          : r.character_maximum_length != null
            ? `máx ${r.character_maximum_length}`
            : '—';
    console.log(
      `| ${t}.${c} | ${r.data_type} (${r.udt_name}) | ${precision} | ${r.is_nullable} | ${r.column_default ?? 'NULL'} |`,
    );
  }
  console.log('\n| índice | indexdef |');
  console.log('|---|---|');
  for (const i of INDICES) {
    const f = await prisma.$queryRawUnsafe(SQL_INDICE, i);
    if (f.length !== 1) {
      faltan.push(i);
      console.log(`| ${i} | NO ESTÁ (${f.length} filas) |`);
      continue;
    }
    console.log(`| ${i} | ${f[0].indexdef} |`);
  }

  const tablas = [...new Set(COLUMNAS.map(([t]) => t))];
  const ajenas = await prisma.$queryRawUnsafe(SQL_AJENAS, tablas);
  const nombres = COLUMNAS.map(([, c]) => c);
  const queTocan = ajenas.filter((a) => nombres.some((n) => new RegExp(`\\(([^)]*\\b)?${n}\\b`).test(a.def.split('REFERENCES')[0])));
  console.log(`\nclaves ajenas en ${tablas.join(', ')}: ${ajenas.length} leída(s); sobre alguna de las 9 columnas: ${queTocan.length}`);
  for (const a of queTocan) console.log(`  · ${a.tabla} · ${a.conname} · ${a.def}`);

  if (salida === 0) {
    if (faltan.length) {
      console.log(`\nVEREDICTO: FALTAN ${faltan.length} de 11 → ${faltan.join(', ')}`);
      salida = 1;
    } else {
      console.log('\nVEREDICTO: los 11 objetos están (9 columnas + 2 índices).');
    }
  }
} catch (e) {
  console.log(`CIEGO: la consulta falló — ${String(e?.message || e).split('\n').slice(-1)[0].slice(0, 200)}`);
  salida = 2;
} finally {
  await prisma.$disconnect();
}
process.exit(salida);
