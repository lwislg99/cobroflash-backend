#!/usr/bin/env node
// scripts/censo-migraciones.mjs — SCRUM-758
//
// ═════════════════════════════════════════════════════════════════════════════════════════
// ¿QUÉ MIGRACIONES DE ESTE ÁRBOL CAMBIAN **ESTRUCTURA** Y CUÁLES CAMBIAN **DATOS**?
//
// La pregunta importa porque las dos se rompen distinto. Si falta una de ESTRUCTURA, el chequeo
// de arranque (`src/core/db/schemaDrift.ts`) lo ve y en producción **no arranca**. Si falta una
// de DATOS, **nadie lo ve**: el esquema cuadra, la app arranca, y las filas están mal.
//
// ── 🔴 LAS MIGRACIONES DE ESTE ÁRBOL VIVEN EN TRES IDIOMAS ─────────────────────────────
//
// Y un censo que mire uno solo SUBESTIMA. Está medido, midiéndome a mí misma:
//   · 1ª pasada, sólo ficheros `.sql`      → 3 con DML
//   · 2ª pasada, + llamadas de Prisma      → subió
//   · 3ª pasada, + `cliente.query(sql)` con `pg` en crudo → apareció `backfill-job-assignees`,
//     que ESCRIBE y que las dos primeras daban por limpio.
//
// Los tres se leen aquí. Y un `grep` no vale para ninguno: el clasificador oficial de SCRUM-395
// ya dejó escrito por qué —«un guard de texto acaba vigilando la EXPLICACIÓN en vez del
// código»—, así que el parseo se DERIVA de él (`desnudar` + `partirSentencias`) en vez de
// escribir un segundo que se quede atrás.
//
// ⚠️ QUÉ NO HACE, y decirlo importa: NO separa «migración» de «sembrador» ni de «herramienta».
// Un `seed-demo.mjs` escribe datos y no es una migración; un censo que lo llamara migración
// mentiría. Este script da el HECHO —qué toca datos y qué toca estructura— y la lista sale
// ordenada por carpeta para que esa lectura la haga quien la tenga que hacer.
//
// ⛔ SÓLO LEE FICHEROS. Ni una conexión a ninguna base, en ningún modo.
//
// USO:  node scripts/censo-migraciones.mjs
// SALIDAS: 0 censo hecho · 2 CIEGO (no ve casos que sabemos que existen)
// ═════════════════════════════════════════════════════════════════════════════════════════
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';

const RAIZ = process.cwd();
const { desnudar, partirSentencias } = await import(pathToFileURL(path.join(RAIZ, 'scripts/_clasificador-sql.mjs')).href);

export const SALIDA_CIEGO = 2;

const CARPETAS_SQL = ['docs/sql', 'prisma/backfill', 'docs/historico/prisma-migrations-frozen-2026-03'];
const CARPETAS_CODIGO = ['scripts', 'prisma'];

/** Métodos de Prisma que MUTAN DATOS. Ninguno hace DDL. Cerrado: uno nuevo se decide. */
const PRISMA_ESCRIBE = new Set(['create', 'createMany', 'createManyAndReturn', 'update',
  'updateMany', 'updateManyAndReturn', 'upsert', 'delete', 'deleteMany']);

/**
 * El eje de UNA sentencia. `null` si está vacía; `desconocida` si no se reconoce el verbo —
 * y eso NO se cuenta como inocuo: sale listado aparte.
 */
export function ejeDeSentencia(sql) {
  const t = String(sql).replace(/\s+/g, ' ').trim().toUpperCase();
  if (!t) return null;
  // DATOS primero: un `INSERT … SELECT` es DML aunque nombre tablas.
  if (/^(INSERT|UPDATE|DELETE|TRUNCATE|MERGE|COPY)\b/.test(t)) return 'datos';
  if (/^(CREATE|ALTER|DROP|COMMENT)\b/.test(t)) return 'estructura';
  if (/^(SELECT|WITH|EXPLAIN|SHOW)\b/.test(t)) return 'lectura';
  if (/^(BEGIN|COMMIT|ROLLBACK|SET|DO|GRANT|REVOKE|ANALYZE|VACUUM|LOCK)\b/.test(t)) return 'sesion';
  return 'desconocida';
}

function ficheros(dir, exts, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) ficheros(p, exts, out);
    else if (exts.some((x) => e.name.endsWith(x))) out.push(p);
  }
  return out;
}

/** Un `.sql` entero, por el parseo oficial. */
export function censarSql(texto) {
  const { desnudo, sinCerrar } = desnudar(texto);
  if (sinCerrar) return { ilegible: sinCerrar };
  return { ejes: partirSentencias(desnudo).map((x) => ejeDeSentencia(x.sql)).filter(Boolean), via: '.sql' };
}

/** Un `.mjs`/`.ts`: sus literales que parezcan SQL, y sus llamadas de Prisma que escriban. */
export function censarCodigo(texto, nombre = 'x.mjs') {
  const sf = ts.createSourceFile(nombre, texto, ts.ScriptTarget.Latest, true,
    nombre.endsWith('.ts') ? ts.ScriptKind.TS : ts.ScriptKind.JS);
  const ejes = [];
  const vias = new Set();
  const v = (n) => {
    if (ts.isStringLiteralLike(n) || ts.isNoSubstitutionTemplateLiteral(n)) {
      const e = ejeDeSentencia(n.text);
      if (e && e !== 'desconocida') { ejes.push(e); vias.add('SQL en literal'); }
    }
    if (ts.isTemplateExpression(n)) {
      const e = ejeDeSentencia(n.head.text);
      if (e && e !== 'desconocida') { ejes.push(e); vias.add('SQL en plantilla'); }
    }
    if (ts.isCallExpression(n) && ts.isPropertyAccessExpression(n.expression)) {
      const m = n.expression.name.getText(sf);
      const recep = n.expression.expression.getText(sf);
      if ((/^(prisma|tx|db|cliente|prismaApp)\b/.test(recep) || /\.(prisma|tx)\b/.test(recep))
          && PRISMA_ESCRIBE.has(m)) { ejes.push('datos'); vias.add('Prisma'); }
    }
    ts.forEachChild(n, v);
  };
  ts.forEachChild(sf, v);
  return { ejes, via: [...vias].join(' + ') || '—' };
}

/**
 * ✅ CONTROL POSITIVO DEL CENSO — los cinco idiomas que SABEMOS que existen.
 *
 * Si no los ve, se declara CIEGO y sale con 2. Un censo que no encuentra lo que sí está no
 * puede afirmar nada sobre lo que no está.
 */
export const DEBE_VER = [
  { rel: 'docs/sql/scrum-425-clave-idempotencia.sql', eje: 'estructura' }, // DDL en .sql
  { rel: 'docs/sql/scrum-650-paso-c-backfill.sql', eje: 'datos' },         // DML en .sql
  { rel: 'prisma/backfill/scrum609-item-kind.sql', eje: 'estructura' },    // mixto
  { rel: 'scripts/backfill-job-assignees.mjs', eje: 'datos' },             // pg en crudo
  { rel: 'scripts/renumerar-documentos.mjs', eje: 'datos' },               // Prisma
];

export function censar(raiz = RAIZ) {
  const filas = [];
  for (const c of CARPETAS_SQL) for (const p of ficheros(path.join(raiz, c), ['.sql'])) {
    filas.push({ rel: path.relative(raiz, p).split(path.sep).join('/'), ...censarSql(fs.readFileSync(p, 'utf8')) });
  }
  for (const c of CARPETAS_CODIGO) for (const p of ficheros(path.join(raiz, c), ['.mjs', '.ts'])) {
    filas.push({ rel: path.relative(raiz, p).split(path.sep).join('/'), ...censarCodigo(fs.readFileSync(p, 'utf8'), path.basename(p)) });
  }
  for (const f of filas) {
    f.cuenta = {};
    for (const e of (f.ejes || [])) f.cuenta[e] = (f.cuenta[e] || 0) + 1;
  }
  return filas;
}

// El guard tolera que NO haya `argv[1]` (p. ej. `node -e` o un test que lo importe): sin esta
// comprobación, importar este módulo REVENTABA con ERR_INVALID_ARG_TYPE. Medido.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const filas = censar();
  const de = (rel) => filas.find((f) => f.rel === rel);
  const ciegos = DEBE_VER.filter(({ rel, eje }) => !((de(rel)?.cuenta || {})[eje] > 0));
  if (ciegos.length) {
    console.error('🔴 CENSO CIEGO — no ve casos que SABEMOS que existen:');
    for (const c of ciegos) console.error(`   · ${c.rel} debería tener «${c.eje}»`);
    process.exit(SALIDA_CIEGO);
  }
  console.log(`✅ control positivo: los ${DEBE_VER.length} idiomas conocidos se ven.\n`);

  const ilegibles = filas.filter((f) => f.ilegible);
  for (const f of ilegibles) console.log(`🔴 ILEGIBLE ${f.rel}: ${f.ilegible}`);

  const conDatos = filas.filter((f) => f.cuenta.datos > 0).sort((a, b) => a.rel.localeCompare(b.rel));
  const soloDdl = filas.filter((f) => !f.cuenta.datos && f.cuenta.estructura > 0);
  const desconocidas = filas.filter((f) => f.cuenta.desconocida > 0);

  console.log(`FICHEROS CENSADOS: ${filas.length} · ilegibles: ${ilegibles.length}`);
  console.log(`  cambian DATOS: ${conDatos.length} · sólo ESTRUCTURA: ${soloDdl.length}\n`);
  console.log('═══ CAMBIAN DATOS ═══');
  for (const f of conDatos) console.log(`  ${f.rel}  ${JSON.stringify(f.cuenta)}  [${f.via}]`);
  console.log('\n═══ SÓLO ESTRUCTURA ═══');
  for (const f of soloDdl) console.log(`  ${f.rel}  ${JSON.stringify(f.cuenta)}`);
  if (desconocidas.length) {
    console.log('\n🔴 ═══ CON SENTENCIAS QUE NO SÉ CLASIFICAR (no se dan por inocuas) ═══');
    for (const f of desconocidas) console.log(`  ${f.rel}  desconocidas: ${f.cuenta.desconocida}`);
  }
}
