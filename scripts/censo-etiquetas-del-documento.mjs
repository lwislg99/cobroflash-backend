// scripts/censo-etiquetas-del-documento.mjs — PASO 0 de SCRUM-595 (DOC-05).
//
// ¿QUÉ HAY HOY, EN LA BASE, PARA ETIQUETAR UN DOCUMENTO?
//
// Son dos preguntas y hacen falta las dos:
//   (a) qué COLUMNAS de etiquetas existen en `quotes` y en `invoices`  → information_schema
//   (b) CUÁNTOS documentos hay de cada tipo                            → COUNT sobre las tablas
// Responder sólo (a) es leer el `schema.prisma` y llamarlo medición. Responder sólo (b) deja sin
// saber si el sitio donde guardar la etiqueta existe ya.
//
// SOLO LECTURA. Ni un INSERT, ni un UPDATE, ni un DELETE. El `ALTER` de este ticket lo aplica el
// fundador (paso ②) y este script no lo toca ni lo lanza.
//
// ═══════════════════════════════════════════════════════════════════════════════════════════════
// 🔴 EL SUELO, QUE ES LO QUE HACE QUE UN CERO SIGNIFIQUE ALGO
//
// Un instrumento ciego y un censo limpio se leen IGUAL: los dos dicen «no hay etiquetas». Este
// script se niega a confundirlos, y por dos vías distintas:
//
//   1. CONTROL POSITIVO DE COLUMNA — `customers.tags` (CONT-07, ya aplicada en las tres bases) y
//      `quotes.lines`. Si NO salen, la consulta no estaba mirando esta base: la ausencia de
//      `quotes.tags` no significaría «no está», significaría «no se vio nada».
//   1b. 🔴 RECUENTO DE COLUMNAS DE CADA TABLA TOCADA — el control del ANTES-Y-DESPUÉS. Una fila
//      sin estado de partida NO distingue «la he creado» de «ya estaba»: sólo el recuento que
//      SUBE de N a N+1 en `quotes` y en `invoices` demuestra que este ALTER hizo algo. Y
//      `customers` va de testigo: su recuento NO puede moverse, porque este ALTER no la toca.
//   2. 🔴 SUELO DE FILAS — si NO se encuentra NI UN documento (cero presupuestos Y cero facturas),
//      el censo NO da un verde: sale con código 2 declarándose CIEGO. Sobre una base vacía,
//      «ningún documento tiene etiquetas» es cierto y no dice absolutamente nada.
//
// ⚠️ NO IMPRIME URL, USUARIO NI CONTRASEÑA. Todo lo que sale pasa por `describirBD`
// (`_db-guard.mjs`): host y base, nada más. Es la lección de SCRUM-195 — una credencial se
// protege impidiendo que el error SALGA, no redactando el mensaje después. Por eso el `catch`
// tampoco vuelca el error: el mensaje de un fallo de conexión lleva la cadena dentro.
//
// ⛔ SÓLO DESARROLLO. `DATABASE_URL_DEV` y nada más: staging y producción están fuera del encargo
// de SCRUM-595, y una herramienta de censo «contra la base que le digas» es la que un día se
// apunta a producción. El guard de PROD_HOST está igualmente, por si la clave miente.
//
// USO:  node scripts/censo-etiquetas-del-documento.mjs
import { PrismaClient } from '@prisma/client';
import { readFileSync } from 'node:fs';
import { describirBD, parseBDSegura, PROD_HOST } from './_db-guard.mjs';

const CLAVE = 'DATABASE_URL_DEV';

/** Las dos tablas del ticket. `presupuesto` y `factura` son LOS DOS documentos del bloque. */
const DOCUMENTOS = [
  { tabla: 'quotes', palabra: 'presupuestos' },
  { tabla: 'invoices', palabra: 'facturas' },
];

/**
 * Controles positivos: columnas que TIENEN que estar. `customers.tags` es la de CONT-07 —el
 * mecanismo que este ticket mide— y `quotes.lines` es una columna de toda la vida.
 */
const CONTROLES = [
  { tabla: 'customers', columna: 'tags' },
  { tabla: 'quotes', columna: 'lines' },
];

// Se lee `.env` a mano porque este script se lanza suelto. Sólo se copian los NOMBRES a
// `process.env`; nada se imprime.
function cargarEnv() {
  let txt;
  try {
    txt = readFileSync(new URL('../.env', import.meta.url), 'utf8');
  } catch {
    return; // sin `.env` se sale por «clave ausente», que ya es informativo
  }
  for (const linea of txt.split(/\r?\n/)) {
    const m = linea.match(/^\s*([A-Z_0-9]+)\s*=\s*(.*)$/);
    if (m) process.env[m[1]] = m[2];
  }
}

async function main() {
  cargarEnv();

  const url = process.env[CLAVE];
  if (!url) {
    console.log(`\n🔴 [${CLAVE}] ausente — CIEGO. No se mide nada y no se afirma nada.`);
    process.exit(2);
  }
  const p = parseBDSegura(url);
  if (!p) {
    console.log(`\n🔴 [${CLAVE}] URL de BD ilegible — CIEGO.`);
    process.exit(2);
  }
  // SUELO DURO, antes que nada: jamás producción, venga de donde venga la clave.
  if (p.host === PROD_HOST) {
    console.log(`\n⛔ [${CLAVE}] APUNTA A PRODUCCIÓN — ABORTADO. Este censo no mide contra prod.`);
    process.exit(2);
  }

  console.log(`\n=== SCRUM-595 · censo de etiquetas del documento ===`);
  console.log(`=== ${CLAVE} → ${describirBD(url)} ===\n`);

  const prisma = new PrismaClient({
    datasourceUrl: url.trim().replace(/^['"]|['"]$/g, ''),
  });

  let ciego = false;
  try {
    // ── (a) QUÉ COLUMNAS DE ETIQUETAS HAY ────────────────────────────────────────────────────
    // Se pide el TIPO, no sólo la existencia: `schemaDrift` comprueba que la columna esté y NO su
    // tipo, así que un `tags` creado como TEXT arrancaría en verde y se pudriría al leer un array.
    const cols = await prisma.$queryRaw`
      SELECT table_name, column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND ( (table_name IN ('quotes', 'invoices') AND column_name = 'tags')
           OR (table_name = 'customers' AND column_name = 'tags')
           OR (table_name = 'quotes' AND column_name = 'lines') )
      ORDER BY table_name, column_name`;

    const visto = new Set(cols.map((c) => `${c.table_name}.${c.column_name}`));

    // ── (a0) 🔴 EL RECUENTO POR TABLA · el control del ANTES-Y-DESPUÉS ───────────────────────
    // `quotes` e `invoices` son las tablas que toca el ALTER; `customers` es el TESTIGO: si su
    // recuento se moviera, este ALTER habría hecho algo que no le tocaba.
    const recuentos = await prisma.$queryRaw`
      SELECT table_name, COUNT(*)::int AS columnas
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name IN ('quotes', 'invoices', 'customers')
      GROUP BY table_name ORDER BY table_name`;
    console.log('  (a0) RECUENTO DE COLUMNAS POR TABLA');
    if (recuentos.length !== 3) {
      console.log('      🔴 CIEGO: esperaba 3 tablas y veo ' + recuentos.length + '.');
      ciego = true;
    }
    for (const r of recuentos) {
      const papel = r.table_name === 'customers' ? 'TESTIGO — no la toca este ALTER' : 'la toca el ALTER';
      console.log(`      ${r.table_name}: ${Number(r.columnas)} columnas   (${papel})`);
    }

    console.log('\n  (a) COLUMNAS DE ETIQUETAS');
    for (const { tabla } of DOCUMENTOS) {
      const fila = cols.find((c) => c.table_name === tabla && c.column_name === 'tags');
      console.log(
        fila
          ? `      ${tabla}.tags → ${fila.data_type} · nullable=${fila.is_nullable} · default=${fila.column_default ?? 'NINGUNO'}`
          : `      ${tabla}.tags → AUSENTE  (el ② de este ticket todavía no está aplicado aquí)`,
      );
    }

    // 🔴 El control positivo, que es lo que hace que ese «AUSENTE» signifique algo.
    const faltanControles = CONTROLES.filter((c) => !visto.has(`${c.tabla}.${c.columna}`));
    if (faltanControles.length > 0) {
      console.log('\n  🔴 CIEGO: faltan controles positivos: '
        + faltanControles.map((c) => `${c.tabla}.${c.columna}`).join(', '));
      console.log('     La consulta NO estaba mirando esta base. La ausencia de `tags` en los');
      console.log('     documentos no significa «no está»: significa «no se vio nada».');
      ciego = true;
    } else {
      console.log('      ✔ controles positivos presentes: '
        + CONTROLES.map((c) => `${c.tabla}.${c.columna}`).join(' · '));
    }

    // ── (b) CUÁNTOS DOCUMENTOS HAY ───────────────────────────────────────────────────────────
    console.log('\n  (b) DOCUMENTOS EN ESTA BASE');
    const conteos = {};
    conteos.quotes = Number((await prisma.$queryRaw`SELECT COUNT(*)::int AS n FROM quotes`)[0].n);
    conteos.invoices = Number((await prisma.$queryRaw`SELECT COUNT(*)::int AS n FROM invoices`)[0].n);
    for (const { tabla, palabra } of DOCUMENTOS) {
      console.log(`      ${palabra}: ${conteos[tabla]}`);
    }

    // Contexto: cuántos clientes SÍ llevan ya etiqueta. Dice si el mecanismo de CONT-07 está
    // vivo en esta base o sólo existe la columna.
    if (visto.has('customers.tags')) {
      const usados = await prisma.$queryRaw`
        SELECT COUNT(*)::int AS n FROM customers WHERE tags IS NOT NULL`;
      console.log(`\n      contexto (CONT-07): clientes con etiquetas declaradas = ${Number(usados[0].n)}`);
    }

    // ── 🔴 EL SUELO DE FILAS ─────────────────────────────────────────────────────────────────
    const totalDocumentos = conteos.quotes + conteos.invoices;
    if (totalDocumentos === 0) {
      console.log('\n🔴 CIEGO: NO HAY NI UN DOCUMENTO EN ESTA BASE.');
      console.log('   Cero presupuestos y cero facturas. Sobre una base vacía «ningún documento');
      console.log('   tiene etiquetas» es cierto y no dice nada: este censo NO da un verde.');
      ciego = true;
    }

    if (ciego) {
      console.log('\n❌ El censo se declara CIEGO. No se sigue.');
      process.exit(2);
    }

    console.log(`\n✅ Censo con vista: ${totalDocumentos} documentos (${conteos.quotes} presupuestos`
      + ` + ${conteos.invoices} facturas), controles positivos presentes.`);
  } catch {
    // No se vuelca el error: su mensaje puede llevar la URL con la contraseña dentro (SCRUM-195).
    console.log('\n🔴 No se pudo consultar la base — CIEGO. (El error no se imprime: su mensaje');
    console.log('   puede llevar la cadena de conexión dentro. Lección de SCRUM-195.)');
    process.exit(2);
  } finally {
    await prisma.$disconnect().catch(() => {});
  }
}

main();
