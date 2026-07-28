// scripts/preflight-schema-drift.mjs — SCRUM-167
//
// PREFLIGHT de deriva de esquema. Antes de correr la tanda gateada, compara el esquema de
// una BD contra prisma/schema.prisma y FALLA RÁPIDO nombrando la causa — en vez de 16
// errores de Prisma repartidos por 14 ficheros (lo que pasó en SCRUM-160: a yaqu_dev_javier
// le faltaba un `db push` y la tanda se cayó a pedazos sin decir por qué).
//
// LO QUE HACE CUMPLIR (SCRUM-169): «un cambio de schema no está aplicado hasta estar en las
// tres BD». Cobertura de las tres NO significa que un comando se conecte a las tres — significa
// que las tres estén cubiertas por ALGÚN mecanismo. Este preflight cubre STAGING y DESARROLLO;
// PRODUCCIÓN tiene el suyo: el `scripts/db-push-prod` del fundador (host-check + preview de
// migrate diff + GO explícito de un humano que ha leído el host). NO apuntes esto a prod.
//
// INFORMA, NUNCA ARREGLA (razón de ser de SCRUM-118): solo corre `migrate diff`, que
// INTROSPECCIONA y compara — no escribe. Cero `db push`, cero `migrate deploy`. Un push
// automático contra una BD mal apuntada es exactamente el escenario que SCRUM-118 impide.
//
// ── CÓDIGOS DE SALIDA (contrato con el enganche del runner) ───────────────────
//   EXIT   SIGNIFICADO
//   ─────  ─────────────────────────────────────────────────────────────────────
//   0      en sync.
//   3      DERIVA de esquema. El ÚNICO código en que se sugiere `db push`.
//   2      no se pudo comparar: guard anti-prod, URL ilegible o error de migrate diff.
//   1 y    la herramienta NO llegó a hablar (crash de Node, import roto). NO es una
//   otro   deriva; nunca sugerir aplicar nada.
//   ─────  ─────────────────────────────────────────────────────────────────────
// POR QUÉ EL 1 ESTÁ RESERVADO: 1 es el código que Node emite al REVENTAR (módulo no hallado,
// import roto, crash). Si la deriva usara el 1, «hay deriva» y «el preflight está roto» serían
// indistinguibles POR CONSTRUCCIÓN — ninguna comprobación previa lo arregla, solo lo hace menos
// probable. Reservando el 1 (y cualquier código no reconocido) para «no pudo hablar», se cierra
// la clase entera: solo el 3 autoriza a tocar la BD.
//
// ── POR QUÉ EL GUARD ES ANTI-PROD Y NO LA ALLOWLIST DE LOS TESTS ──────────────
// El guard de `tests/_staging-db.mjs` (assertSafeStagingUrl) es una allowlist de UN host
// (acela) porque esos tests CREAN Y BORRAN merchants: la pregunta es «¿es EXACTAMENTE esta
// BD?». Este preflight SOLO LEE metadatos de esquema, y su alcance es staging + desarrollo;
// la pregunta aquí es otra: «¿NO es prod?». Una BD de desarrollo LOCAL no pasaría la allowlist
// de acela y el preflight no podría mirarla — justo el caso que motiva el ticket. Por eso se
// comprueba contra PROD_HOST (importado de `_db-guard.mjs`, fuente única de hostnames), no la
// allowlist. Un guard distinto SIN esta explicación sería el próximo malentendido.
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import dotenv from 'dotenv';
import { PROD_HOST } from './_db-guard.mjs';

// SCRUM-167 (b): resolver TODO contra la raíz del proyecto, no el CWD — así el preflight
// funciona lanzado desde cualquier directorio (p. ej. desde el runner). Antes, rutas relativas
// al CWD fallaban fuera de la raíz: fail-closed, pero un modo de fallo tonto de quitar.
const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
dotenv.config({ path: path.join(PROJECT_ROOT, '.env'), quiet: true }); // .env de la raíz (no sobrescribe env presente)

const url = process.argv[2] || process.env.DATABASE_URL_STAGING;
// Datamodel a comparar: por defecto el REAL. `PREFLIGHT_DATAMODEL` lo sobrescribe SOLO para
// verificar el preflight contra una COPIA mutada de schema.prisma, sin tocar nunca el fichero
// real (SCRUM-167). En uso normal no se pone y no cambia nada.
const OVERRIDE = process.env.PREFLIGHT_DATAMODEL || null;
const DATAMODEL = OVERRIDE || path.join(PROJECT_ROOT, 'prisma', 'schema.prisma'); // ruta real (absoluta por defecto)
const DATAMODEL_LABEL = OVERRIDE || 'prisma/schema.prisma'; // etiqueta legible para los mensajes

// IMPRIME SIEMPRE contra qué datamodel compara. Un override que cambia el objetivo puede hacer
// que un "en sync" mire el fichero equivocado — un fallo en la dirección TRANQUILIZADORA, el
// peor en una herramienta cuyo único trabajo es no dejar pasar una deriva. Si no es el de por
// defecto, se dice DESTACADO: un verde no se lee sin saber contra qué se obtuvo (SCRUM-167).
if (OVERRIDE) {
  console.error(`\n⚠️  PREFLIGHT_DATAMODEL activo: comparando contra ${DATAMODEL_LABEL}, NO contra prisma/schema.prisma.`);
  console.error('    Este modo es SOLO para verificar el propio preflight. Un "en sync" aquí no dice');
  console.error('    nada del schema real.\n');
} else {
  console.log(`preflight: comparando el esquema de la BD contra ${DATAMODEL_LABEL}.`);
}

function hostOf(u) {
  try { return new URL(u).hostname; } catch { return null; }
}

// ── GUARD ANTI-PROD, fail-closed ─────────────────────────────────────────────
if (!url) {
  console.error('❌ preflight: sin URL. Pásala como argumento o en DATABASE_URL_STAGING.');
  process.exit(2);
}
const host = hostOf(url);
if (!host) {
  console.error('❌ preflight: la URL no se pudo parsear — fail-closed, no se compara nada.');
  process.exit(2);
}
if (host === PROD_HOST) {
  console.error(`\n❌ preflight: la URL apunta a PRODUCCIÓN (${PROD_HOST}). ABORTADO.`);
  console.error('   Prod NO se mira desde aquí: tiene su propio mecanismo (scripts/db-push-prod,');
  console.error('   con host-check, preview y GO explícito del fundador). Esto es staging + dev.\n');
  process.exit(2);
}

// ── migrate diff (SOLO LECTURA) ──────────────────────────────────────────────
// Se invoca el CLI de prisma por `node <cli>` (no `npx`/`.cmd`/shell): así la URL viaja
// como ARGUMENTO y no acaba en una línea de shell donde su contraseña sería visible.
// `--script` da el SQL (para clasificar el sentido); `--exit-code` hace exit 2 si hay diff.
const res = spawnSync(process.execPath, [
  path.join(PROJECT_ROOT, 'node_modules', 'prisma', 'build', 'index.js'), 'migrate', 'diff',
  '--from-url', url,
  '--to-schema-datamodel', DATAMODEL,
  '--script', '--exit-code',
], {
  cwd: PROJECT_ROOT, // rutas relativas (un override) se resuelven contra la raíz, no el CWD
  env: { ...process.env, DATABASE_URL: url }, // prisma valida el datasource; sigue siendo solo lectura
  encoding: 'utf8',
  maxBuffer: 32 * 1024 * 1024,
});

// migrate diff --exit-code: 0 = sin diff, 2 = hay diff, cualquier otro = ERROR real.
if (res.status === 0) {
  console.log(`✅ preflight: el esquema de la BD coincide con ${DATAMODEL_LABEL}. En sync.`);
  process.exit(0);
}
if (res.status !== 2) {
  console.error(`\n❌ preflight: migrate diff falló (exit ${res.status}) — no se pudo comparar. Fail-closed.`);
  const err = (res.stderr || res.stdout || '').split('\n')
    .filter((l) => l.trim() && !/^warn |deprecated|Update available|major update|npm i |pris\.ly|[┌│└]/.test(l))
    .slice(0, 8).join('\n');
  // SCRUM-196: aquí `err` YA es un string filtrado (no un objeto), así que `?? err` es lo que
  // aplica — consistencia con los otros dos catch, NO reducción real: la superficie (el stderr de
  // Prisma, ya filtrado por el regex de arriba) no cambia. Probado: no contiene la contraseña.
  if (err) console.error(err?.message ?? err);
  process.exit(2);
}

// status === 2 → hay deriva. Clasifica el SENTIDO a partir del SQL.
// El SQL dice cómo llevar la BD → schema: ADD/CREATE = a la BD le FALTA (va por detrás);
// DROP = la BD TIENE algo que el fichero no (va por delante).
const stmts = (res.stdout || '').split('\n').filter((l) => /^\s*(ALTER|CREATE|DROP)\b/i.test(l));
const drops = stmts.filter((l) => /\bDROP\b/i.test(l));
const adds  = stmts.filter((l) => /\b(ADD COLUMN|CREATE)\b/i.test(l));

console.error(`\n❌ preflight: DERIVA DE ESQUEMA — la BD NO coincide con ${DATAMODEL_LABEL}.`);
if (adds.length && !drops.length) {
  console.error(`   SENTIDO: la BD va POR DETRÁS del schema — le faltan ${stmts.length} cambio(s). Corre \`db push\` contra esta BD.`);
} else if (drops.length && !adds.length) {
  console.error(`   SENTIDO: la BD va POR DELANTE del schema — tiene ${drops.length} objeto(s) que NO están en ${DATAMODEL_LABEL} (algo aplicado fuera del fichero). También es señal.`);
} else if (adds.length === 0 && drops.length === 0) {
  // (a) SCRUM-167: ALTER COLUMN … SET NOT NULL / cambio de tipo casa con `stmts` pero ni con
  // `adds` ni con `drops`. Antes caía al «MIXTO 0 y 0», que no significa nada. Se nombra.
  console.error(`   SENTIDO: cambio de TIPO o de RESTRICCIÓN (${stmts.length} sentencia(s)) — ni adiciones ni borrados (p. ej. \`SET NOT NULL\`, cambio de tipo). La BD difiere del fichero sin ser «por detrás» ni «por delante».`);
} else {
  console.error(`   SENTIDO: MIXTO — ${adds.length} por detrás (ADD/CREATE) y ${drops.length} por delante (DROP).`);
}
console.error('\n   Diferencias (SQL para llevar la BD al fichero):');
for (const s of stmts) console.error('     ' + s.trim());
console.error('\n   El preflight INFORMA, no arregla: ningún db push automático (SCRUM-118). Aplícalo tú tras leer el sentido.\n');
// exit 3 = DERIVA (código distintivo — ver «CÓDIGOS DE SALIDA» en la cabecera). NO 1: así el
// enganche no confunde una deriva con un preflight que reventó al arrancar (ambos serían 1).
process.exit(3);
