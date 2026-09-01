// scripts/censo-tipo-cliente.mjs — PASO 0 de SCRUM-574 (CONT-01), pregunta P-CONT-4.
//
// ¿QUÉ VALORES TIENE HOY «Tipo de cliente» EN LOS CLIENTES EXISTENTES?
//
// SON DOS PREGUNTAS DISTINTAS Y HACEN FALTA LAS DOS — el encargo lo dice y tiene razón:
//   (a) qué PERMITE el esquema en esa columna  → information_schema + pg_constraint
//   (b) qué valores tienen LAS FILAS DE HOY    → GROUP BY sobre `customers`
// Responder solo (a) es leer el `schema.prisma` y llamarlo medición; responder solo (b) deja
// sin saber si mañana puede aparecer un valor que hoy no está.
//
// SOLO LECTURA. No hay un solo INSERT/UPDATE/DELETE aquí, y es deliberado: la migración del
// punto 4 del encargo no se ejecuta hasta que este número esté escrito y el fundador decida.
//
// ⚠️ NO IMPRIME URL, USUARIO NI CONTRASEÑA. Todo lo que sale pasa por `describirBD`
// (`_db-guard.mjs`): host y base, nada más. Es la regla R7 y el motivo de SCRUM-195 — una
// credencial se protege impidiendo que el error SALGA, no redactando el mensaje después. Por eso
// el `catch` de abajo tampoco vuelca `e`: el mensaje de un error de conexión lleva la cadena.
//
// SUELO (encargo de SCRUM-574): si la columna no existe en la base que se mide, este script lo
// DICE en vez de devolver «0 clientes clasificados», que es lo que devolvería un instrumento
// ciego y se lee igual que un censo limpio.
import { PrismaClient } from '@prisma/client';
import { readFileSync } from 'node:fs';
import { describirBD, parseBDSegura, PROD_HOST } from './_db-guard.mjs';

// Se lee `.env` a mano porque este script se lanza suelto (no por `npm run dev`, que ya carga
// el entorno). Solo se copian los NOMBRES que hacen falta a `process.env`; nada se imprime.
function cargarEnv() {
  let txt;
  try {
    txt = readFileSync(new URL('../.env', import.meta.url), 'utf8');
  } catch {
    return; // sin `.env` el script sale por «clave ausente», que ya es informativo
  }
  for (const linea of txt.split(/\r?\n/)) {
    const m = linea.match(/^\s*([A-Z_0-9]+)\s*=\s*(.*)$/);
    if (m) process.env[m[1]] = m[2];
  }
}

async function medir(nombreClave) {
  const url = process.env[nombreClave];
  if (!url) {
    console.log(`\n[${nombreClave}] ausente — no se mide.`);
    return null;
  }
  const p = parseBDSegura(url);
  if (!p) {
    console.log(`\n[${nombreClave}] URL de BD ilegible — no se mide.`);
    return null;
  }
  // SUELO DURO, y va antes que nada: jamás producción, venga de donde venga la clave.
  if (p.host === PROD_HOST) {
    console.log(`\n[${nombreClave}] APUNTA A PRODUCCIÓN — ABORTADO. Ninguna sesión mide contra prod.`);
    return null;
  }

  console.log(`\n=== ${nombreClave} → ${describirBD(url)} ===`);
  const prisma = new PrismaClient({
    datasourceUrl: url.trim().replace(/^['"]|['"]$/g, ''),
  });
  try {
    // ── (a) QUÉ PERMITE EL ESQUEMA ────────────────────────────────────────────────────────
    const col = await prisma.$queryRaw`
      SELECT data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = 'customers' AND column_name = 'tipo_destinatario'`;
    if (col.length === 0) {
      // Éste es el SUELO del encargo: ciego, y se declara.
      console.log('  (a) esquema: ⛔ LA COLUMNA `tipo_destinatario` NO EXISTE en esta base.');
      console.log('      → CIEGO. No se migra nada sobre esto: o el instrumento está roto o la');
      console.log('        captura es de otra cosa, y las dos hay que decirlas antes de tocar datos.');
      return { ciego: true };
    }
    console.log(
      `  (a) esquema: tipo=${col[0].data_type} · nullable=${col[0].is_nullable} · default=${col[0].column_default ?? 'NINGUNO'}`,
    );
    const checks = await prisma.$queryRaw`
      SELECT pg_get_constraintdef(con.oid) AS def
      FROM pg_constraint con
      JOIN pg_class rel ON rel.oid = con.conrelid
      WHERE rel.relname = 'customers' AND con.contype = 'c'`;
    console.log(
      `  (a) CHECK en \`customers\`: ${checks.length === 0 ? 'NINGUNO → la columna acepta CUALQUIER texto' : checks.map((c) => c.def).join(' | ')}`,
    );

    // ── (b) QUÉ TIENEN LAS FILAS DE HOY ───────────────────────────────────────────────────
    const total = await prisma.$queryRaw`SELECT COUNT(*)::int AS n FROM customers`;
    console.log(`  (b) filas en \`customers\`: ${total[0].n}`);
    const grupos = await prisma.$queryRaw`
      SELECT tipo_destinatario AS valor, COUNT(*)::int AS n
      FROM customers
      GROUP BY tipo_destinatario
      ORDER BY n DESC`;
    for (const g of grupos) {
      const etiqueta = g.valor === null ? 'NULL  (= «Sin clasificar» en la ficha)' : JSON.stringify(g.valor);
      console.log(`      tipo_destinatario = ${etiqueta} → ${g.n}`);
    }

    // Contexto que el switch necesita: hoy la distinción empresa/persona es IMPLÍCITA y vive en
    // si alguien rellenó `legal_name`. Contarlo es lo que dice si esa señal serviría para migrar.
    const ctx = await prisma.$queryRaw`
      SELECT
        COUNT(*) FILTER (WHERE legal_name IS NOT NULL AND legal_name <> '')::int AS con_razon_social,
        COUNT(*) FILTER (WHERE tax_id     IS NOT NULL AND tax_id     <> '')::int AS con_nif,
        COUNT(*) FILTER (WHERE recargo_equivalencia IS NOT NULL)::int            AS con_recargo
      FROM customers`;
    console.log(
      `  (b) con razón social: ${ctx[0].con_razon_social} · con NIF: ${ctx[0].con_nif} · con recargo declarado: ${ctx[0].con_recargo}`,
    );
    return { ciego: false, total: total[0].n, grupos };
  } catch (e) {
    // Sin volcar `e`: el mensaje de un fallo de conexión lleva la cadena dentro (SCRUM-195).
    console.log(`  ⛔ ERROR al medir (${e?.constructor?.name ?? 'desconocido'}) · code=${e?.code ?? 'n/d'}`);
    console.log('      → NO SUPE MIRAR. Esto no es «0 clientes»: es que no hubo medición.');
    return { ciego: true };
  } finally {
    await prisma.$disconnect();
  }
}

cargarEnv();
console.log('PASO 0 · P-CONT-4 — ¿qué valores tiene hoy «Tipo de cliente» (`tipo_destinatario`)?');
console.log('SOLO LECTURA. Producción no se mide y no vive en un árbol de trabajo (regla 3).');
await medir('DATABASE_URL_STAGING');
await medir('DATABASE_URL_DEV');
