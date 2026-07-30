// SCRUM-205 · TODO SQL ESCRITO A MANO SE COMPRUEBA CONTRA EL SCHEMA (sin gate, ni BD ni red).
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// EL INCIDENTE QUE LO ORIGINA
//
// El backfill de `vf_estado` murió en staging con `column i.merchant_id does not exist`. Lo
// escribí suponiendo snake_case en todas las columnas. Es falso: **Prisma solo renombra la
// columna cuando el campo lleva `@map`**. Sin `@map`, la columna se llama exactamente como el
// campo —en camelCase— y en PostgreSQL eso exige comillas dobles.
//
// De las 7 columnas del fichero, 2 estaban mal: `merchantId` y `createdAt`. Las 2 son justo las
// que no llevan `@map`. Y el error de PostgreSQL solo nombraba UNA: al arreglarla, el siguiente
// intento habría muerto en la otra. De una en una, contra una base de datos real, cada vez.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// POR QUÉ ESTE GUARD Y NO SOLO LA COMPROBACIÓN DENTRO DEL .sql
//
// El fichero lleva ahora un bloque `DO` que aborta nombrando todas las columnas que falten.
// Eso está bien y se queda — pero **solo protege a quien ya está ejecutando contra una base**.
// Esto lo caza antes: en `npm test`, sin base, sin turno de staging, en el commit que lo
// introduce. Es la diferencia entre enterarse en el `pretest` y enterarse en producción.
//
// Y cubre el caso general, no el mío: cualquier `.sql` a mano que se añada mañana.
//
// LO QUE NO HACE: no valida la sintaxis SQL ni la semántica. Solo que cada `"tabla"."columna"`
// que el fichero nombra EXISTA en el schema con ese nombre físico exacto. Es el error que se
// comete, no el único que existe.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIR_SQL = path.join(RAIZ, 'prisma', 'backfill');

/** Mapa `tabla física` → Set de `columna física`, derivado del schema. */
export function columnasDelSchema(textoSchema) {
  const t = textoSchema.replace(/\r\n/g, '\n');
  const tablas = new Map();
  for (const m of t.matchAll(/^model[ \t]+(\w+)[ \t]*\{([\s\S]*?)^\}/gm)) {
    const cuerpo = m[2];
    let tabla = m[1];
    const cols = new Set();
    for (const linea of cuerpo.split('\n')) {
      const s = linea.trim();
      if (!s || s.startsWith('//')) continue;
      const tm = s.match(/^@@map\("([^"]+)"\)/);
      if (tm) { tabla = tm[1]; continue; }
      if (s.startsWith('@@')) continue;
      const cm = s.match(/^(\w+)[ \t]+(\S+)/);
      if (!cm) continue;
      // Las RELACIONES no son columnas: `quote Quote? @relation(...)` no existe en la tabla.
      if (/@relation/.test(s) && !/@map\(/.test(s)) continue;
      const map = s.match(/@map\("([^"]+)"\)/);
      cols.add(map ? map[1] : cm[1]);
    }
    tablas.set(tabla, cols);
  }
  return tablas;
}

/**
 * Referencias `"tabla"."columna"` y `alias."columna"` de un .sql, resolviendo los alias.
 *
 * Los alias se sacan del propio SQL (`FROM "invoices" i`, `UPDATE "invoices" i`), porque es
 * como está escrito de verdad: `i."merchantId"`, no `invoices."merchantId"`.
 */
export function referenciasDelSql(sql) {
  const alias = new Map();
  for (const m of sql.matchAll(/\b(?:UPDATE|FROM|JOIN)\s+"(\w+)"\s+(?!SET\b|WHERE\b)(\w+)/gi)) {
    alias.set(m[2], m[1]);
  }
  // `UPDATE "invoices"` sin alias: la tabla se referencia por su nombre entrecomillado.
  const tablasSueltas = [...sql.matchAll(/\b(?:UPDATE|FROM|JOIN)\s+"(\w+)"/gi)].map((m) => m[1]);

  const refs = [];
  // a) prefijo.columna → prefijo puede ser alias o nombre de tabla
  for (const m of sql.matchAll(/\b(\w+)\."(\w+)"/g)) {
    const tabla = alias.get(m[1]) ?? m[1];
    refs.push({ tabla, columna: m[2], texto: `${m[1]}."${m[2]}"` });
  }
  // b) `SET "columna"` sin prefijo → la tabla del UPDATE que lo contiene
  for (const m of sql.matchAll(/\bSET\s+"(\w+)"/gi)) {
    const antes = sql.slice(0, m.index);
    const ultimoUpdate = [...antes.matchAll(/\bUPDATE\s+"(\w+)"/gi)].pop();
    if (ultimoUpdate) refs.push({ tabla: ultimoUpdate[1], columna: m[1], texto: `SET "${m[1]}"` });
  }
  return { refs, tablasSueltas: [...new Set(tablasSueltas)] };
}

const SCHEMA = columnasDelSchema(fs.readFileSync(path.join(RAIZ, 'prisma', 'schema.prisma'), 'utf8'));

function ficherosSql() {
  if (!fs.existsSync(DIR_SQL)) return [];
  return fs.readdirSync(DIR_SQL).filter((f) => f.endsWith('.sql')).map((f) => path.join(DIR_SQL, f));
}

test('SCRUM-205 · el schema se parsea y trae las tablas que se esperan', () => {
  // Suelo: si el parseo del schema falla, todo lo de abajo pasa en vacío — cero referencias
  // comprobadas se lee igual que «todas correctas».
  assert.ok(SCHEMA.size >= 20, `🔴 ESCÁNER CIEGO: solo ${SCHEMA.size} tablas parseadas del schema`);
  for (const t of ['invoices', 'merchants']) {
    assert.ok(SCHEMA.has(t), `🔴 ESCÁNER CIEGO: no encuentro la tabla física "${t}" en el schema`);
  }
  // Y las dos que se supusieron mal: se comprueba que el parser las ve con su nombre REAL.
  assert.ok(SCHEMA.get('invoices').has('merchantId'), '🔴 el parser no ve invoices.merchantId');
  assert.ok(SCHEMA.get('invoices').has('createdAt'), '🔴 el parser no ve invoices.createdAt');
  assert.ok(SCHEMA.get('invoices').has('vf_hash'), '🔴 el parser no resuelve el @map de vfHash');
  assert.ok(!SCHEMA.get('invoices').has('merchant_id'), '🔴 el parser inventa merchant_id, que NO existe');
});

test('SCRUM-205 · toda columna de un .sql a mano existe en el schema', () => {
  const ficheros = ficherosSql();
  assert.ok(
    ficheros.length > 0,
    '🔴 ESCÁNER CIEGO: ningún .sql en prisma/backfill/. Si se movieron de sitio, este guard dejó ' +
      'de comprobar nada y el siguiente backfill se escribe a ciegas otra vez.',
  );

  const malas = [];
  let comprobadas = 0;

  for (const f of ficheros) {
    const sql = fs.readFileSync(f, 'utf8');
    const rel = path.relative(RAIZ, f).split(path.sep).join('/');
    const { refs, tablasSueltas } = referenciasDelSql(sql);

    for (const t of tablasSueltas) {
      if (!SCHEMA.has(t)) malas.push(`${rel}: la TABLA "${t}" no existe en el schema`);
    }
    for (const r of refs) {
      // `information_schema` y los alias de un VALUES no son tablas del modelo.
      if (r.tabla === 'information_schema' || r.tabla === 'ic' || r.tabla === 'x') continue;
      const cols = SCHEMA.get(r.tabla);
      if (!cols) { malas.push(`${rel}: tabla desconocida en ${r.texto} → "${r.tabla}"`); continue; }
      comprobadas += 1;
      if (!cols.has(r.columna)) {
        const parecida = [...cols].find((c) => c.replace(/_/g, '').toLowerCase() === r.columna.replace(/_/g, '').toLowerCase());
        malas.push(
          `${rel}: ${r.texto} → la columna "${r.columna}" NO existe en "${r.tabla}"`
          + (parecida ? `. ¿Querías "${parecida}"?` : ''),
        );
      }
    }
  }

  assert.ok(
    comprobadas >= 8,
    `🔴 ESCÁNER CIEGO: solo ${comprobadas} referencias comprobadas. El backfill de SCRUM-205 usa 7 ` +
      'columnas distintas y más de 8 referencias; si el extractor dejó de reconocerlas, su verde ' +
      'no significa que el SQL esté bien, significa que no ha mirado.',
  );

  assert.deepEqual(
    malas, [],
    '🔴 HAY SQL A MANO QUE NOMBRA COLUMNAS QUE NO EXISTEN:\n' + malas.map((s) => `    ${s}`).join('\n') +
      '\n\n  Esto revienta al ejecutarlo contra la base, de UNA EN UNA: PostgreSQL solo nombra la\n' +
      '  primera columna que falla.\n\n' +
      '  La trampa siempre es la misma: **Prisma solo renombra la columna si el campo lleva\n' +
      '  `@map`**. Sin `@map`, la columna se llama como el campo, en camelCase, y necesita\n' +
      '  comillas dobles en SQL. No se supone snake_case: se deriva del schema.',
  );
});

test('SCRUM-205 (autoprueba) · el guard caza el error EXACTO que se cometió', () => {
  // El SQL real que murió en staging, en miniatura. Si esto no sale, el guard no vale.
  const sqlMalo = 'UPDATE "invoices" i SET "vf_estado" = \'x\' FROM "merchants" m WHERE m."id" = i."merchant_id";';
  const { refs } = referenciasDelSql(sqlMalo);
  const mala = refs.find((r) => r.columna === 'merchant_id');
  assert.ok(mala, '🔴 el extractor no ve i."merchant_id"');
  assert.equal(mala.tabla, 'invoices', '🔴 el extractor no resuelve el alias `i` a "invoices"');
  assert.ok(
    !SCHEMA.get('invoices').has('merchant_id'),
    '🔴 el guard daría por buena merchant_id',
  );

  // Y el control: la versión CORRECTA no debe salir marcada.
  const sqlBueno = sqlMalo.replace('merchant_id', 'merchantId');
  const buena = referenciasDelSql(sqlBueno).refs.find((r) => r.columna === 'merchantId');
  assert.ok(SCHEMA.get('invoices').has(buena.columna), '🔴 FALSO POSITIVO: marca la versión correcta');
});
