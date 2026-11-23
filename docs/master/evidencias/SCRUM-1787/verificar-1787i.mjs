#!/usr/bin/env node
// docs/master/evidencias/SCRUM-1787/verificar-1787i.mjs — SCRUM-1787i
//
// SOLO LECTURA, y SOLO contra dev: ¿tiene `invoices` las columnas `due_date` y `pay_methods`?
// Se corre ANTES y DESPUÉS de `scripts/aplicar-sql-dev.mjs --file docs/sql/scrum-1787-vencimiento.sql --go`.
//
// A5: dos controles de tipo DISTINTO más `current_database()`:
//   ① el catálogo (`information_schema.columns`) — cuántas de las dos constan, con su tipo;
//   ② un SELECT de las dos columnas sobre la tabla — antes del ALTER falla con 42703, después pasa.
// Y un POSITIVO sembrado en la propia consulta: `customer_phone`, que existe desde hace meses. Si
// no sale, este guion no está viendo `invoices` y dice CIEGO (sale 2), no «0 columnas».
//
// La URL no se imprime ni viaja en argv: se lee `DATABASE_URL_DEV` del entorno y sólo se enseña
// lo que da `describirBD`. Si la base no es `yaqu_dev_javier`, no consulta.
//
//   node docs/master/evidencias/SCRUM-1787/verificar-1787i.mjs
//   salida: 0 = están las dos · 1 = falta alguna · 2 = CIEGO (no pude mirar)
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { describirBD, parseBDSegura } from '../../../../scripts/_db-guard.mjs';

const CLAVE = 'DATABASE_URL_DEV';
const BASE_ESPERADA = 'yaqu_dev_javier';
const ciego = (m) => { console.error(`CIEGO: ${m}`); process.exit(2); };

const url = process.env[CLAVE];
if (!url) ciego(`no hay ${CLAVE} en el entorno (no se imprime ningún valor)`);
if (!parseBDSegura(url)) ciego('la URL de la base es ilegible (no se imprime)');
const destino = describirBD(url);
console.log(`destino: ${CLAVE} → ${destino}`);
if (!destino.endsWith(`/${BASE_ESPERADA}`)) ciego(`el destino no es ${BASE_ESPERADA}: no consulto`);

const prisma = new PrismaClient({ datasourceUrl: url });
let salida = 2;
try {
  const filas = await prisma.$queryRawUnsafe(`
    SELECT current_database() AS base, column_name, data_type, is_nullable
      FROM information_schema.columns
     WHERE table_schema = current_schema()
       AND table_name = 'invoices'
       AND column_name IN ('due_date', 'pay_methods', 'customer_phone')
     ORDER BY column_name`);
  for (const f of filas) console.log(`① catálogo · ${f.base} · ${f.column_name} · ${f.data_type} · ${f.is_nullable}`);
  const base = filas[0]?.base;
  const positivo = filas.filter((f) => f.column_name === 'customer_phone').length;
  if (positivo !== 1) ciego('el positivo `customer_phone` no sale: no estoy viendo `invoices`');
  if (base !== BASE_ESPERADA) ciego(`current_database() dice «${base}», no ${BASE_ESPERADA}`);
  const nuevas = filas.filter((f) => f.column_name !== 'customer_phone');
  const tipos = Object.fromEntries(nuevas.map((f) => [f.column_name, `${f.data_type}:${f.is_nullable}`]));
  const catalogoOk = tipos.due_date === 'timestamp without time zone:YES' && tipos.pay_methods === 'jsonb:YES';
  console.log(`① catálogo · positivo customer_phone=${positivo} · columnas nuevas: ${nuevas.length} de 2`);

  let selectOk = false;
  try {
    const r = await prisma.$queryRawUnsafe('SELECT COUNT(*)::int AS n, COUNT(due_date)::int AS con_vencimiento, COUNT(pay_methods)::int AS con_formas FROM invoices');
    selectOk = true;
    console.log(`② SELECT de las dos columnas: pasa · facturas=${r[0].n} · con due_date=${r[0].con_vencimiento} · con pay_methods=${r[0].con_formas}`);
  } catch (e) {
    const codigo = e?.meta?.code ?? e?.code ?? 'sin código';
    console.log(`② SELECT de las dos columnas: FALLA · código ${codigo}`);
  }
  if (catalogoOk !== selectOk) ciego(`los dos controles discrepan (catálogo=${catalogoOk}, select=${selectOk})`);
  salida = catalogoOk ? 0 : 1;
  console.log(salida === 0 ? 'VEREDICTO: están las dos columnas' : 'VEREDICTO: FALTAN (las dos sondas coinciden)');
} catch (e) {
  console.error(`CIEGO: la consulta no corrió (${e?.code ?? e?.name ?? 'error'})`);
} finally {
  await prisma.$disconnect();
}
process.exit(salida);
