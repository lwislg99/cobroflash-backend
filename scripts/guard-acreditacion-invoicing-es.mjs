// scripts/guard-acreditacion-invoicing-es.mjs — SCRUM-1097 (encargo 2, GO del fundador 23-sep-2026)
//
// ═════════════════════════════════════════════════════════════════════════════════════════════
// ¿HAY HOY UN MERCHANT ES REAL ACREDITADO PARA FACTURAR CON EFECTOS FISCALES?
//
// SCRUM-1097 (censo de 18 vías) y SCRUM-1099 (censo por AST de todo escritor de `Invoice`)
// concluyeron que HOY, por CÓDIGO, ningún merchant ES real puede emitir: la única vía es humana
// y deliberada (`scripts/cambiar-flag-fiscal.mjs` contra producción). Este guard no vuelve a
// medir esa premisa — la vigila: si algún día deja de ser cierta, esto lo tiene que ver.
//
// «Acreditado» = merchant con `country = 'ES'`, que NO es el demo (id=1, regla 8 — exclusión
// EXPLÍCITA y nombrada, nunca por efecto del filtro), y que cumple UNA de dos:
//   (a) `merchant.flags.INVOICING_ES_ENABLED === true`  (override por merchant, `core/flags.ts`)
//   (b) tiene alguna `Invoice` de tipo fiscal (catálogo AEAT RD 1619/2012: F1/F2/F3/R1-R5)
//
// ── LÍMITE DECLARADO, A PROPÓSITO (no se oculta) ────────────────────────────────────────────
// `core/flags.ts` tiene TRES niveles de precedencia: merchant > env > default de la tabla. Este
// guard SOLO ve (a) — el override por merchant en la columna `merchants.flags` — porque es lo
// único que vive en la base de datos. Un `INVOICING_ES_ENABLED=true` puesto como VARIABLE DE
// ENTORNO en Railway encendería la facturación fiscal para TODOS los merchants ES sin tocar ni
// una fila, y NINGUNA consulta SQL puede verlo. Por eso el brazo (b) —¿ha llegado a EMITIRSE algo
// fiscal de verdad?— no depende de flags en absoluto: es la comprobación de fondo, porque
// `crearFacturaEmitida.ts` es, medido por AST en SCRUM-1099, el ÚNICO sitio de `src/` que
// inserta una fila en `invoices`.
//
// ── SOLO LECTURA ESTRUCTURAL, DEMOSTRADA POR AST SOBRE SU PROPIO FUENTE ─────────────────────
// No basta con que un humano lea este fichero y diga «solo hace `findMany`». Cada ejecución se
// auto-verifica: `verificarSoloLecturaEstructural` parsea ESTE MISMO fichero con el AST de
// TypeScript y comprueba que TODA llamada `prisma.<algo>.<método>(…)` use un método de la LISTA
// BLANCA (`METODOS_PERMITIDOS`). Blanca, no negra: una negra («nunca `create`, `update`…») se
// queda corta en cuanto Prisma añada un método nuevo; una blanca falla CERRADO ante cualquier
// nombre que no reconozca — incluido uno que no existe todavía.
//
// ⚠️ NO IMPRIME URL, USUARIO NI CONTRASEÑA. Todo lo que sale pasa por `describirBD`
// (`_db-guard.mjs`) — host y base, nada más (lección de SCRUM-195: el `catch` tampoco vuelca el
// error, porque el mensaje de un fallo de conexión puede llevar la cadena dentro).
//
// ⚠️ SIN DESTINO POR DEFECTO. `--staging` o `--prod-ro`, y nada si no se pide: apuntar a
// producción es una decisión que se declara en la línea de comando, nunca un olvido.
//
// TRES VEREDICTOS, no dos: `0` limpio (medido, cero acreditados) · `1` HALLAZGO (medido, ≥1
// acreditado — la acreditación se rompió) · `2` CIEGO (no se pudo medir; nunca se confunde con
// limpio). Un cero sin suelo delante no se puede juzgar: si NO hay ni un merchant ES no-demo en
// la base, el guard se declara CIEGO en vez de dar un «cero» vacío de significado.
//
// ── CONFIRMACIÓN DEL HOST Y RASTRO DE CADA EJECUCIÓN (SCRUM-1101) ──────────────────────────
// Que la URL apunte al host esperado no basta: hay que NOMBRARLO en `ACREDITACION_CONFIRM`, el
// patrón `FLAG_CONFIRM` de `cambiar-flag-fiscal.mjs`. No se prohíbe apuntar a producción, se
// obliga a decirlo, y va ANTES de construir el cliente.
// Cada ejecución —también la que aborta— deja UN fichero JSONL propio en
// `ACREDITACION_REGISTRO_DIR` (por defecto `~/.yaqu/registro-acreditacion-invoicing-es/`, fuera
// del árbol): fecha, host SIN credencial (`describirBD`), consulta y recuento (`null` si no se
// midió, que no es cero). Se escribe con el proceso VIVO, línea a línea, y la de «conectando» va
// antes de conectar: si muere a mitad, el fichero ya dice contra qué lo intentaba. Si el fichero
// no se puede escribir, no se mide: una pasada sin rastro es la que este ticket existe para evitar.
//
// USO:
//   ACREDITACION_CONFIRM=<host> node scripts/guard-acreditacion-invoicing-es.mjs --staging   # DATABASE_URL_STAGING (.env)
//   ACREDITACION_CONFIRM=<host> node scripts/guard-acreditacion-invoicing-es.mjs --prod-ro   # DATABASE_URL_PROD_RO (entorno)
// ═════════════════════════════════════════════════════════════════════════════════════════════
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { PrismaClient } from '@prisma/client';
import { describirBD, parseBDSegura, PROD_HOST, STAGING_HOST } from './_db-guard.mjs';
import { ejecutadoDirectamente } from './_puerta-de-entrada.mjs';

export const MERCHANT_DEMO_ID = 1; // regla 8 — exclusión explícita y nombrada
export const FLAG_INVOICING_ES = 'INVOICING_ES_ENABLED';
export const TIPOS_FISCALES = Object.freeze(['F1', 'F2', 'F3', 'R1', 'R2', 'R3', 'R4', 'R5']);
export const CONSULTA_TEXTO =
  `merchants WHERE country='ES' AND id<>${MERCHANT_DEMO_ID} AND ` +
  `(flags.${FLAG_INVOICING_ES}=true OR EXISTS invoice.type IN (${TIPOS_FISCALES.join(',')}))`;
export const CLAVE_CONFIRMACION = 'ACREDITACION_CONFIRM';
export const CLAVE_DIR_REGISTRO = 'ACREDITACION_REGISTRO_DIR';
const DIR_REGISTRO_POR_DEFECTO = path.join(os.homedir(), '.yaqu', 'registro-acreditacion-invoicing-es');

/**
 * Lista BLANCA de métodos de Prisma que este guard tiene permitido llamar. Ver cabecera §AST.
 * `$disconnect` no es dato: es el cierre de la conexión, y sin él el proceso no termina.
 */
export const METODOS_PERMITIDOS = Object.freeze(new Set(['findMany', '$disconnect']));

/**
 * ¿La cadena de acceso de la que cuelga `n` arranca en el identificador `prisma`?
 * `prisma.merchant.findMany` → sube por `.expression` hasta el identificador raíz.
 */
function raizEsPrisma(n) {
  let base = n;
  while (ts.isPropertyAccessExpression(base)) base = base.expression;
  return ts.isIdentifier(base) && base.text === 'prisma';
}

/** El análisis puro — recibe TEXTO, para poder probarlo en rojo sin tocar disco. */
export function analizarSoloLectura(codigo, nombre = 'x.mjs') {
  const sf = ts.createSourceFile(nombre, codigo, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  const prohibidos = [];
  const linea = (n) => sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1;

  const v = (n) => {
    if (ts.isCallExpression(n) && ts.isPropertyAccessExpression(n.expression) && raizEsPrisma(n.expression.expression)) {
      const metodo = n.expression.name.text;
      if (!METODOS_PERMITIDOS.has(metodo)) prohibidos.push({ metodo, linea: linea(n) });
    }
    ts.forEachChild(n, v);
  };
  v(sf);
  return { prohibidos };
}

/** El auto-check real: se lee y se analiza A SÍ MISMO en cada ejecución. */
export function verificarSoloLecturaEstructural(rutaAbs) {
  return analizarSoloLectura(fs.readFileSync(rutaAbs, 'utf8'), path.basename(rutaAbs));
}

/**
 * La medición. Recibe un `PrismaClient` (o un doble de prueba con la misma forma) para poder
 * probar la lógica sin BD real — el patrón de `preview-migracion.mjs` (ejecutor inyectado).
 *
 * UNA sola llamada `prisma.merchant.findMany(…)`: el filtro (a) se resuelve en memoria, igual
 * que lo resuelve `core/flags.ts` (mismo criterio: objeto plano, no array, booleano estricto),
 * para no depender de la sintaxis de filtrado JSON de Prisma —no usada hoy en ningún otro sitio
 * de este árbol— siendo la primera vez que se ejercitaría contra una base real.
 */
export async function medirAcreditacion(prisma) {
  let candidatos;
  try {
    candidatos = await prisma.merchant.findMany({
      where: { country: 'ES', id: { not: MERCHANT_DEMO_ID } },
      select: {
        id: true,
        flags: true,
        Invoice: { where: { type: { in: [...TIPOS_FISCALES] } }, select: { id: true }, take: 1 },
      },
    });
  } catch {
    // Sin volcar el error: SCRUM-195 — su mensaje puede llevar la cadena de conexión dentro.
    return { ciego: true, motivo: 'la consulta contra `merchants` falló' };
  }

  if (candidatos.length === 0) {
    return {
      ciego: true,
      motivo: 'CERO merchants ES no-demo en esta base — un cero sobre cero no prueba nada '
        + '(sin control positivo: la misma búsqueda no encuentra ni un caso conocido)',
    };
  }

  const acreditados = candidatos
    .filter((m) => {
      const flags = m.flags;
      const flagOn = flags != null && typeof flags === 'object' && !Array.isArray(flags) && flags[FLAG_INVOICING_ES] === true;
      const tieneFiscal = Array.isArray(m.Invoice) && m.Invoice.length > 0;
      return flagOn || tieneFiscal;
    })
    .map((m) => ({ id: m.id }));

  return { ciego: false, floor: candidatos.length, filas: acreditados };
}

// ═════════════════════════════════════════════════════════════════════════════════════════════

function cargarEnvStagingSiFalta(raiz, env) {
  if (env.DATABASE_URL_STAGING) return;
  let txt;
  try {
    txt = fs.readFileSync(path.join(raiz, '.env'), 'utf8');
  } catch {
    return; // sin `.env` se sale luego por «clave ausente», que ya es informativo
  }
  for (const linea of txt.split(/\r?\n/)) {
    const m = linea.match(/^\s*([A-Z_0-9]+)\s*=\s*(.*)$/);
    if (m) env[m[1]] = env[m[1]] ?? m[2];
  }
}

/**
 * Abre el fichero de rastro de ESTA ejecución (uno por ejecución: `wx`, nunca pisa otro) y
 * devuelve `anotar`, que añade una línea JSON con su fecha. Síncrono a propósito: la línea está
 * en disco antes de dar el paso siguiente. Lanza si no se puede escribir — quien llama no mide.
 */
export function abrirRastro(dir) {
  fs.mkdirSync(dir, { recursive: true });
  const sello = new Date().toISOString().replace(/[:.]/g, '-');
  const ruta = path.join(dir, `${sello}-${process.pid}-${Math.random().toString(36).slice(2, 8)}.jsonl`);
  fs.writeFileSync(ruta, '', { flag: 'wx' });
  const anotar = (campos) => fs.appendFileSync(ruta, JSON.stringify({ fecha: new Date().toISOString(), ...campos }) + '\n', 'utf8');
  return { ruta, anotar };
}

/**
 * La ejecución entera, con lo que toca el mundo inyectado (`env`, `crearPrisma`, `hosts`) para
 * poder probar cada salida sin base real. `principal()` la llama con los valores de verdad.
 * `hosts` existe SOLO para los tests: la CLI no lo expone.
 */
export async function ejecutar({
  argv,
  env,
  raiz = path.join(path.dirname(fileURLToPath(import.meta.url)), '..'),
  crearPrisma = (url) => new PrismaClient({ datasourceUrl: url.trim().replace(/^['"]|['"]$/g, '') }),
  hosts = { staging: STAGING_HOST, prod: PROD_HOST },
}) {
  const dirRastro = env[CLAVE_DIR_REGISTRO] || DIR_REGISTRO_POR_DEFECTO;
  let rastro;
  try {
    rastro = abrirRastro(dirRastro);
  } catch {
    console.log(`\n🔴 no se pudo escribir el rastro en «${dirRastro}» — CIEGO. Sin rastro no se mide.`);
    return 2;
  }
  let clave = null;
  let host = null;
  const cerrar = (exit, veredicto, extra = {}) => {
    rastro.anotar({ fase: 'final', veredicto, exit, destino: clave, host, consulta: CONSULTA_TEXTO, recuento: null, ...extra });
    console.log(`(rastro de esta ejecución: ${rastro.ruta})`);
    return exit;
  };
  rastro.anotar({ fase: 'inicio', argv: argv.filter((a) => a.startsWith('--')) });

  const auto = verificarSoloLecturaEstructural(fileURLToPath(import.meta.url));
  if (auto.prohibidos.length) {
    console.error('🔴 el propio guard llama a un método de Prisma fuera de la lista blanca — ABORTADO:');
    for (const p of auto.prohibidos) console.error(`   línea ${p.linea}: prisma.….${p.metodo}(…)`);
    return cerrar(2, 'ABORTADO', { motivo: 'auto-check AST: método fuera de la lista blanca' });
  }

  let hostEsperado;
  if (argv.includes('--staging')) { clave = 'DATABASE_URL_STAGING'; hostEsperado = hosts.staging; }
  else if (argv.includes('--prod-ro')) { clave = 'DATABASE_URL_PROD_RO'; hostEsperado = hosts.prod; }
  else {
    console.error('Uso: ACREDITACION_CONFIRM=<host> node scripts/guard-acreditacion-invoicing-es.mjs --staging | --prod-ro');
    console.error('Sin bandera no hay destino por defecto: apuntar a producción es una decisión,');
    console.error('nunca un olvido.');
    return cerrar(2, 'ABORTADO', { motivo: 'sin bandera de destino' });
  }

  if (clave === 'DATABASE_URL_STAGING') cargarEnvStagingSiFalta(raiz, env);

  const url = env[clave];
  if (!url) {
    console.log(`\n🔴 [${clave}] ausente — CIEGO. No se mide nada y no se afirma nada.`);
    return cerrar(2, 'CIEGO', { motivo: `${clave} ausente` });
  }
  const p = parseBDSegura(url);
  if (!p) {
    console.log(`\n🔴 [${clave}] URL de BD ilegible — CIEGO.`);
    return cerrar(2, 'CIEGO', { motivo: 'URL de BD ilegible' });
  }
  host = describirBD(url);
  if (p.host !== hostEsperado) {
    console.log(`\n⛔ [${clave}] apunta al host «${p.host}», y se esperaba «${hostEsperado}» — ABORTADO.`);
    console.log('   Un host inesperado no se trata como "probablemente el que toca".');
    return cerrar(2, 'ABORTADO', { motivo: `host inesperado (se esperaba ${hostEsperado})` });
  }
  if (env[CLAVE_CONFIRMACION] !== p.host) {
    console.log(`\n⛔ Confirma la base de forma EXPLÍCITA. [${clave}] apunta a:\n\n    ${host}\n`);
    console.log(`   Si es la correcta, re-ejecuta nombrándola: ${CLAVE_CONFIRMACION}=${p.host} node scripts/guard-acreditacion-invoicing-es.mjs …`);
    console.log(`   Si NO es la que querías, no toques ${CLAVE_CONFIRMACION}: cambia ${clave}.`);
    return cerrar(2, 'ABORTADO', { motivo: `sin confirmación explícita del host en ${CLAVE_CONFIRMACION}` });
  }

  console.log(`\n=== SCRUM-1097 · guard de acreditación INVOICING_ES · ${new Date().toISOString()} ===`);
  console.log(`=== [${clave}] → ${host} ===`);
  console.log(`=== consulta: ${CONSULTA_TEXTO} ===\n`);
  rastro.anotar({ fase: 'conectando', destino: clave, host, consulta: CONSULTA_TEXTO });

  const prisma = crearPrisma(url);
  let resultado;
  try {
    resultado = await medirAcreditacion(prisma);
  } finally {
    await prisma.$disconnect().catch(() => {});
  }

  if (resultado.ciego) {
    console.log(`🔴 CIEGO: ${resultado.motivo}`);
    return cerrar(2, 'CIEGO', { motivo: resultado.motivo });
  }

  console.log(`suelo: ${resultado.floor} merchant(s) ES no-demo vistos — control positivo de que la búsqueda SÍ ve la base`);
  console.log(`recuento acreditados: ${resultado.filas.length}`);
  const medido = { suelo: resultado.floor, recuento: resultado.filas.length, acreditados: resultado.filas.map((f) => f.id) };
  if (resultado.filas.length > 0) {
    console.log('\n🔴 HALLAZGO — estos merchants NO deberían poder facturar con efectos fiscales hoy:');
    for (const f of resultado.filas) console.log(`   merchant id=${f.id}`);
    return cerrar(1, 'HALLAZGO', medido);
  }
  console.log('\n✔ CERO — ningún merchant ES no-demo acreditado para facturación fiscal hoy.');
  return cerrar(0, 'LIMPIO', medido);
}

function principal() {
  return ejecutar({ argv: process.argv.slice(2), env: { ...process.env } });
}

if (ejecutadoDirectamente(import.meta.url)) {
  principal().then((codigo) => process.exit(codigo));
}
