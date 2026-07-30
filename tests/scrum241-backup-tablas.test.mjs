// GUARD · LA LISTA DE TABLAS DEL BACKUP SE DERIVA DEL SCHEMA, NO SE RECUERDA. — SCRUM-241 · BACKUP-ROTO-1
//
// EL DEFECTO: `scripts/backup-dump.mjs` tiene una lista `TABLES` a mano que decide qué vuelca el
// dump LÓGICO (la ruta que corre donde no hay `pg_dump`, p. ej. la imagen Node de Railway). Esa
// lista HABÍA DERIVADO del schema, en silencio y sin que nada lo cazara:
//   · faltaban `bot_sessions`, `albaranes`, `albaran_lineas_facturadas` (datos de negocio/fiscales);
//   · pedía `wa_messages`, pero la tabla real es `whatsapp_messages` → el `SELECT` reventaba y se
//     guardaba `{__error}` mientras el dump se anunciaba «con éxito».
//
// LA LECCIÓN, ya sin discutir (recon SCRUM-222): en esta casa hay cuatro listas de modelos que
// deben casar con el schema; las DOS con guard (MODELOS_POR_MERCHANT, ORDEN_BORRADO_MERCHANT)
// están completas, las DOS sin guard (esta y el wipeDemo) han derivado. Este guard cierra la del
// backup, que es la que más duele porque su fallo es mudo y su producto es la última red.
//
// LA FORMA DE LA REGLA (estructural, sin allowlist): el conjunto de `TABLES` debe ser EXACTAMENTE
// el conjunto de tablas del schema — cada `model` aporta su `@@map("...")` o, si no lo tiene, su
// propio nombre (que es como Prisma nombra la tabla por defecto). Falta una → rojo; sobra una que
// no es tabla (el caso `wa_messages`) → rojo. Sin lista de excepciones: si una tabla no debiera ir
// al backup, esa es una decisión de máster, no un hueco silencioso en un array.
//
// ⚠️ Texto, no import: `backup-dump.mjs` ejecuta `main()` al importarse (se conectaría a la BD), así
// que la lista se LEE del fuente, igual que `tests/scrum172-cobertura-tenancy.test.mjs` hace con
// MODELOS_POR_MERCHANT. Este fichero no contiene ningún `const TABLES`, así que no se caza a sí mismo.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SCHEMA = path.join(RAIZ, 'prisma', 'schema.prisma');
const BACKUP = path.join(RAIZ, 'scripts', 'backup-dump.mjs');

/**
 * Tablas del schema, DERIVADAS del texto. Por cada `model X { … }`, la tabla es su `@@map("…")`
 * o, si no declara ninguno, el propio nombre del modelo (el default de Prisma). Pura a propósito:
 * el rojo se puede provocar con un schema sintético sin tocar `prisma/schema.prisma` (freno duro
 * del repo, §3 de ASESOR.md — de aquí no se toca ni para probar).
 */
export function tablasDelSchema(schemaText) {
  const out = [];
  let modelo = null, mapa = null;
  for (const linea of String(schemaText || '').replace(/\r/g, '').split('\n')) {
    const m = /^\s*model\s+(\w+)\s*\{/.exec(linea);
    if (m) { modelo = m[1]; mapa = null; continue; }
    if (!modelo) continue;
    const mm = /^\s*@@map\("([^"]+)"\)/.exec(linea);
    if (mm) { mapa = mm[1]; continue; }
    if (/^\s*\}/.test(linea)) { out.push(mapa || modelo); modelo = null; mapa = null; }
  }
  return out;
}

/**
 * La lista `TABLES` declarada en backup-dump.mjs, leída como TEXTO (sin comentarios). Devuelve
 * `null` si no encuentra el bloque — que el guard trata como fallo, no como lista vacía.
 */
export function tablasDeclaradas(fuente) {
  const i = fuente.indexOf('const TABLES');
  if (i === -1) return null;
  const fin = fuente.indexOf('];', i);
  if (fin === -1) return null;
  const bloque = fuente.slice(i, fin)
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|\s)\/\/.*$/gm, '$1');
  return [...bloque.matchAll(/'([^'\\]+)'/g)].map((m) => m[1]);
}

// ── 1 · SUELO: los dos lados tienen algo real que comparar ────────────────────────────────────
test('SCRUM-241 · SUELO: schema y TABLES se leen y no salen vacíos (no un verde hueco)', () => {
  const derivadas = tablasDelSchema(fs.readFileSync(SCHEMA, 'utf8'));
  const declaradas = tablasDeclaradas(fs.readFileSync(BACKUP, 'utf8'));
  assert.ok(derivadas.length >= 20, `🔴 solo ${derivadas.length} tablas derivadas del schema: ¿cambió el formato?`);
  assert.ok(derivadas.includes('merchants'), '🔴 el parser del schema no ve ni `merchants`');
  assert.ok(declaradas && declaradas.length >= 20,
    `🔴 no se pudo leer TABLES de backup-dump.mjs (${declaradas?.length ?? 'null'})`);
});

// ── 2 · QUE EL DETECTOR DETECTA (schema sintético, no el real) ────────────────────────────────
test('SCRUM-241 · el detector usa @@map, y el nombre del modelo si no hay @@map', () => {
  const sintetico = `
model Foo {
  id Int @id
  @@map("foos")
}
model BarSinMap {
  id Int @id
}`;
  assert.deepEqual(tablasDelSchema(sintetico), ['foos', 'BarSinMap']);
});

// ── 3 · EL GUARD ──────────────────────────────────────────────────────────────────────────────
test('SCRUM-241 · TABLES del backup === tablas del schema (ni falta ni sobra ninguna)', () => {
  const derivadas = new Set(tablasDelSchema(fs.readFileSync(SCHEMA, 'utf8')));
  const declaradas = new Set(tablasDeclaradas(fs.readFileSync(BACKUP, 'utf8')));
  const faltan = [...derivadas].filter((t) => !declaradas.has(t)); // en el schema, NO en el backup
  const sobran = [...declaradas].filter((t) => !derivadas.has(t)); // en el backup, NO son tabla real

  assert.deepEqual(
    { faltan, sobran }, { faltan: [], sobran: [] },
    '\n\n🔴 La lista TABLES de scripts/backup-dump.mjs NO coincide con el schema:\n'
    + (faltan.length ? `   · FALTAN (el dump lógico NO las volcaría): ${faltan.join(', ')}\n` : '')
    + (sobran.length ? `   · SOBRAN (no son tablas reales → el SELECT revienta en silencio): ${sobran.join(', ')}\n` : '')
    + '\n   TABLES tiene que ser EXACTAMENTE las tablas del schema (@@map o nombre de modelo).'
    + '\n   Es el patrón de la casa: una lista a mano sin guard deriva y el fallo del backup es mudo.'
    + '\n   Si una tabla no debe ir al backup, es una decisión de máster, no un hueco en el array.',
  );
});
