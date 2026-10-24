// tests/scrum1310b-claves-ajenas-con-ddl.test.mjs — SCRUM-1310b
//
// ═════════════════════════════════════════════════════════════════════════════════════════
// TODA CLAVE AJENA DEL ESQUEMA TIENE SU DDL EN UN FICHERO — Y LAS 13 QUE NO LO TIENEN SOLO BAJAN.
//
// ── LA VÍCTIMA ────────────────────────────────────────────────────────────────────────────
// SCRUM-1310 (c.20753): de las 37 claves ajenas que implica `prisma/schema.prisma`, 13 no tienen
// DDL en NINGÚN fichero del repositorio —ni en las migraciones congeladas ni en `docs/sql/`—, y
// entre ellas la de la rectificativa (`invoices.rectifies_id`). Nacieron de `db push`: lo que
// hacen al borrar está sólo dentro de la base. Hoy el hueco no crece por costumbre, no por
// mecanismo. Decisión del fundador, SCRUM-1310 c.20776 (P3): «Sí» al trinquete por FICHEROS.
//
// ── QUÉ COMPARA, Y QUÉ NO ─────────────────────────────────────────────────────────────────
// Compara el ESQUEMA con los FICHEROS. No conecta a ninguna base: NO es el guard de «clave ajena
// real = esquema» que se paró en c.17665. Que el DDL escrito sea lo que la base tiene lo dice la
// consulta `docs/sql/scrum-1310b-claves-ajenas-sin-ddl-consulta.sql`, que corre Javier.
//
// Las dos mitades del trinquete, contra `SIN_DDL_CONGELADAS`:
//   ① una clave ajena del esquema sin DDL que NO está en la lista → ROJO. Escribe su `.sql`.
//   ② una de la lista que ya tiene DDL (o que el esquema ya no implica) → ROJO. Quítala: la
//      lista solo baja. Así no se queda dentro una que ya no hace falta excusar.
//
// ── CÓMO SE RECONOCE UN DDL ───────────────────────────────────────────────────────────────
// Sobre el texto DESNUDO (`desnudar` de `scripts/_clasificador-sql.mjs`: sin comentarios y con
// los literales de cadena en blanco), la forma `CONSTRAINT <nombre> FOREIGN KEY`, que cubre el
// `ALTER TABLE … ADD CONSTRAINT` de las congeladas y el `CONSTRAINT` en línea de los `CREATE
// TABLE` de `docs/sql/`. Que el NOMBRE aparezca en un fichero no basta: la sonda 1310 de
// `docs/master/evidencias/SCRUM-1550/sondas.json` busca por subcadena, y una consulta que nombrara
// la clave pasaría por su DDL. Por eso la consulta de 1310b no nombra ninguna de las 13.
//
// ── LÍMITE DECLARADO ──────────────────────────────────────────────────────────────────────
// Compara por el nombre que el esquema implica (`map:` o `<tabla>_<columnas>_fkey`). Si en las
// bases una se llama de otra forma, la consulta lo dice («CON OTRO NOMBRE») y hay que contarlo.
//
// ── CONTROLES ─────────────────────────────────────────────────────────────────────────────
// · Población: el parser de relaciones y un recuento por texto de `@relation(… fields:` tienen que
//   dar lo mismo. Si no casan, CIEGO.
// · Positivo SEMBRADO: una relación fabricada sin DDL se añade al esquema real y TIENE que salir
//   como nueva. Sin la semilla, el veredicto es CIEGO, nunca VERDE.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import { desnudar } from '../scripts/_clasificador-sql.mjs';
import { partirAtributos } from '../scripts/_prisma-procedencia-guard.mjs';
import { soloCodigo } from './_solo-codigo.mjs';

const RAIZ = path.resolve(import.meta.dirname, '..');
const SCHEMA = path.join(RAIZ, 'prisma', 'schema.prisma');
const CARPETAS_DDL = ['docs/sql', 'docs/historico/prisma-migrations-frozen-2026-03'];
const CONSULTA = 'docs/sql/scrum-1310b-claves-ajenas-sin-ddl-consulta.sql';

/**
 * LAS 13 DE c.20753, CONGELADAS. Solo bajan: cuando una reciba su DDL en `docs/sql/`, se borra
 * de aquí en el mismo PR (la mitad ② lo exige). Nunca se añade una.
 */
export const SIN_DDL_CONGELADAS = [
  'auth_sessions_merchant_id_fkey',
  'auth_sessions_team_member_id_fkey',
  'customers_merchant_id_fkey',
  'invoices_rectifies_id_fkey',
  'expenses_merchant_id_fkey',
  'expenses_quote_id_fkey',
  'expenses_provider_id_fkey',
  'quote_requests_merchant_id_fkey',
  'quote_requests_customer_id_fkey',
  'quote_templates_merchant_id_fkey',
  'team_members_merchant_id_fkey',
  'customer_events_merchant_id_fkey',
  'customer_events_customer_id_fkey',
];

// La semilla: un modelo fabricado con una relación que ningún fichero escribe.
const SEMILLA_NOMBRE = 'zz_semilla_1310b_padre_id_fkey';
const SEMILLA_SCHEMA = `
model ZzSemilla1310b {
  id      Int            @id
  padreId Int            @map("padre_id")
  padre   ZzPadre1310b   @relation(fields: [padreId], references: [id])
  @@map("zz_semilla_1310b")
}
model ZzPadre1310b {
  id    Int              @id
  hijos ZzSemilla1310b[]
}
`;

/** Las claves ajenas que implica un `schema.prisma`: una por `@relation(…)` con `fields:`. */
export function clavesAjenasDelSchema(texto) {
  const limpio = soloCodigo(String(texto).replace(/\r\n/g, '\n'), 'schema.prisma');
  const recuentoTexto = (limpio.match(/@relation\([^)]*\bfields\s*:/g) || []).length;
  const claves = [];
  for (const m of limpio.matchAll(/^\s*model\s+(\w+)\s*\{([\s\S]*?)^\s*\}/gm)) {
    const [, modelo, cuerpo] = m;
    const lineas = cuerpo.split('\n').map((l) => l.trim()).filter(Boolean);
    let tabla = modelo;
    const columnaDe = {};
    const relaciones = [];
    for (const l of lineas) {
      if (l.startsWith('@@')) {
        const t = l.match(/^@@map\(\s*(?:name\s*:\s*)?"([^"]+)"/);
        if (t) tabla = t[1];
        continue;
      }
      const { cabeza, atributos } = partirAtributos(l);
      const [campo] = cabeza.split(/\s+/);
      if (!/^\w+$/.test(campo || '')) continue;
      const map = atributos.map((a) => a.match(/^@map\(\s*(?:name\s*:\s*)?"([^"]+)"/)).find(Boolean);
      columnaDe[campo] = map ? map[1] : campo;
      const rel = atributos.find((a) => a.startsWith('@relation(') && /\bfields\s*:/.test(a));
      if (rel) relaciones.push(rel);
    }
    for (const rel of relaciones) {
      const campos = rel.match(/\bfields\s*:\s*\[([^\]]*)\]/)[1].split(',').map((s) => s.trim()).filter(Boolean);
      const columnas = campos.map((c) => columnaDe[c] ?? c);
      const mapa = rel.match(/\bmap\s*:\s*"([^"]+)"/);
      claves.push({ modelo, tabla, columnas, nombre: mapa ? mapa[1] : `${tabla}_${columnas.join('_')}_fkey` });
    }
  }
  return { claves, recuentoTexto };
}

/** Los nombres de restricción que un SQL declara como clave ajena (`CONSTRAINT x FOREIGN KEY`). */
export function nombresConDdl(sql) {
  const { desnudo, sinCerrar } = desnudar(sql);
  const nombres = new Set();
  for (const m of desnudo.matchAll(/\bCONSTRAINT\s+(\w+)\s+FOREIGN\s+KEY\b/gi)) nombres.add(m[1]);
  return { nombres, sinCerrar };
}

/** Los `.sql` de las dos carpetas, leídos del disco. */
export function fuentesDdl(raiz = RAIZ) {
  const fuentes = [];
  const recorrer = (rel) => {
    for (const e of fs.readdirSync(path.join(raiz, rel), { withFileTypes: true })) {
      const r = `${rel}/${e.name}`;
      if (e.isDirectory()) recorrer(r);
      else if (e.name.endsWith('.sql')) fuentes.push({ ruta: r, texto: fs.readFileSync(path.join(raiz, r), 'utf8') });
    }
  };
  for (const c of CARPETAS_DDL) recorrer(c);
  return fuentes;
}

/**
 * El veredicto del trinquete. `sembrar: false` existe para demostrar que sin la semilla el
 * instrumento no puede decir VERDE.
 * @returns {{ estado: 'VERDE'|'ROJO'|'CIEGO', motivo?: string, nuevas: string[], sobran: string[], total: number }}
 */
export function veredicto({ schema, fuentes, congeladas = SIN_DDL_CONGELADAS, sembrar = true }) {
  const vacio = { nuevas: [], sobran: [], total: 0 };
  const { claves, recuentoTexto } = clavesAjenasDelSchema(sembrar ? schema + SEMILLA_SCHEMA : schema);
  if (claves.length !== recuentoTexto) {
    return { ...vacio, estado: 'CIEGO', motivo: `parser ${claves.length} ≠ recuento por texto ${recuentoTexto}` };
  }
  const conDdl = new Set();
  const ilegibles = [];
  for (const f of fuentes) {
    const { nombres, sinCerrar } = nombresConDdl(f.texto);
    if (sinCerrar) ilegibles.push(`${f.ruta} (${sinCerrar})`);
    for (const n of nombres) conDdl.add(n);
  }
  if (ilegibles.length) return { ...vacio, estado: 'CIEGO', motivo: `no se pudo leer: ${ilegibles.join(', ')}` };
  if (!fuentes.length || !conDdl.size) return { ...vacio, estado: 'CIEGO', motivo: 'ningún DDL de clave ajena en las fuentes' };

  let sin = claves.filter((c) => !conDdl.has(c.nombre)).map((c) => c.nombre);
  if (!sembrar) return { ...vacio, estado: 'CIEGO', motivo: 'sin la semilla nada demuestra que el instrumento ve una clave sin DDL' };
  if (!sin.includes(SEMILLA_NOMBRE)) return { ...vacio, estado: 'CIEGO', motivo: 'la semilla no salió como clave sin DDL' };
  sin = sin.filter((n) => n !== SEMILLA_NOMBRE);

  const nuevas = sin.filter((n) => !congeladas.includes(n));
  const sobran = congeladas.filter((n) => !sin.includes(n));
  return { estado: nuevas.length || sobran.length ? 'ROJO' : 'VERDE', nuevas, sobran, total: claves.length - 1 };
}

// ───────────────────────────────────────────────────────────────────────────────────────────

test('SCRUM-1310b · las tres formas de escribir el DDL de una clave ajena que hay en el árbol se reconocen', () => {
  const formas = [
    'ALTER TABLE "public"."zz_a" ADD CONSTRAINT "zz_a_x_fkey" FOREIGN KEY ("x") REFERENCES "public"."zz"("id") ON DELETE RESTRICT ON UPDATE CASCADE;',
    'CREATE TABLE IF NOT EXISTS "zz_b" (\n  "x" INTEGER NOT NULL,\n  CONSTRAINT "zz_b_x_fkey" FOREIGN KEY ("x")\n    REFERENCES "zz"("id") ON DELETE CASCADE\n);',
    'ALTER TABLE zz_c ADD CONSTRAINT zz_c_x_fkey FOREIGN KEY (x) REFERENCES zz(id);',
  ];
  const vistos = formas.map((f) => [...nombresConDdl(f).nombres]);
  assert.deepEqual(vistos, [['zz_a_x_fkey'], ['zz_b_x_fkey'], ['zz_c_x_fkey']]);
});

test('SCRUM-1310b · un nombre en un comentario o dentro de una cadena no cuenta como DDL', () => {
  const sql = [
    '-- ALTER TABLE "zz" ADD CONSTRAINT "zz_com_fkey" FOREIGN KEY ("x") REFERENCES "y"("id");',
    "SELECT 'ALTER TABLE zz ADD CONSTRAINT zz_cad_fkey FOREIGN KEY (x) REFERENCES y(id);' AS texto;",
    'ALTER TABLE "zz" ADD CONSTRAINT "zz_real_fkey" FOREIGN KEY ("x") REFERENCES "y"("id");',
  ].join('\n');
  const { nombres } = nombresConDdl(sql);
  assert.deepEqual([...nombres], ['zz_real_fkey'], 'el positivo de la misma entrada tiene que verse y los otros dos no');
  assert.ok(!nombres.has('zz_com_fkey') && !nombres.has('zz_cad_fkey'));
});

test('SCRUM-1310b · el parser saca la tabla del @@map, la columna del @map y respeta el map: de la relación', () => {
  const schema = `
model Hijo {
  id       Int   @id
  padreId  Int   @map("padre_id")
  otroId   Int?
  padre    Padre @relation("A", fields: [padreId], references: [id], onDelete: Cascade)
  otro     Padre? @relation("B", fields: [otroId], references: [id], map: "hijo_otro_a_mano")
  @@map("hijos")
}
model Padre {
  id Int @id
  a  Hijo[] @relation("A")
  b  Hijo[] @relation("B")
}
`;
  const { claves, recuentoTexto } = clavesAjenasDelSchema(schema);
  assert.equal(recuentoTexto, 2);
  assert.deepEqual(claves.map((c) => c.nombre), ['hijos_padre_id_fkey', 'hijo_otro_a_mano']);
});

test('SCRUM-1310b · SEMBRADO: una relación nueva sin DDL cae, y con su DDL deja de caer', () => {
  const base = 'model Merchant {\n  id Int @id\n}\n';
  const nueva = `
model Gasto {
  id         Int      @id
  merchantId Int      @map("merchant_id")
  merchant   Merchant @relation(fields: [merchantId], references: [id])
  @@map("gastos")
}
`;
  const ddlOtro = [{ ruta: '<otro>', texto: 'ALTER TABLE "x" ADD CONSTRAINT "x_y_fkey" FOREIGN KEY ("y") REFERENCES "z"("id");' }];
  const sinDdl = veredicto({ schema: base + nueva, fuentes: ddlOtro, congeladas: [] });
  assert.equal(sinDdl.estado, 'ROJO');
  assert.deepEqual(sinDdl.nuevas, ['gastos_merchant_id_fkey']);

  const conDdl = veredicto({
    schema: base + nueva,
    fuentes: [...ddlOtro, { ruta: '<gastos>', texto: 'CREATE TABLE "gastos" (\n  CONSTRAINT "gastos_merchant_id_fkey" FOREIGN KEY ("merchant_id") REFERENCES "merchants"("id")\n);' }],
    congeladas: [],
  });
  assert.equal(conDdl.estado, 'VERDE');
  assert.deepEqual(conDdl.nuevas, []);
});

test('SCRUM-1310b · la lista solo baja: una congelada que ya tiene DDL tiene que salir de la lista', () => {
  const schema = 'model M {\n  id Int @id\n}\nmodel T {\n  id Int @id\n  mId Int @map("m_id")\n  m M @relation(fields: [mId], references: [id])\n  @@map("t")\n}\n';
  const fuentes = [{ ruta: '<t>', texto: 'ALTER TABLE "t" ADD CONSTRAINT "t_m_id_fkey" FOREIGN KEY ("m_id") REFERENCES "m"("id");' }];
  const r = veredicto({ schema, fuentes, congeladas: ['t_m_id_fkey'] });
  assert.equal(r.estado, 'ROJO');
  assert.deepEqual(r.sobran, ['t_m_id_fkey']);
});

test('SCRUM-1310b · sin la semilla el veredicto es CIEGO, nunca VERDE', () => {
  const schema = fs.readFileSync(SCHEMA, 'utf8');
  const fuentes = fuentesDdl();
  const conSemilla = veredicto({ schema, fuentes });
  const sinSemilla = veredicto({ schema, fuentes, sembrar: false });
  assert.notEqual(conSemilla.estado, 'CIEGO', `con la semilla tiene que ver: ${conSemilla.motivo ?? ''}`);
  assert.equal(sinSemilla.estado, 'CIEGO');
});

test('SCRUM-1310b · toda clave ajena de schema.prisma tiene su DDL en un fichero, salvo las congeladas, y las congeladas solo bajan', () => {
  const schema = fs.readFileSync(SCHEMA, 'utf8');
  const fuentes = fuentesDdl();
  const r = veredicto({ schema, fuentes });
  console.log(`[scrum1310b] fuentes ${fuentes.length} (${fuentes.reduce((a, f) => a + f.texto.length, 0)} B) · `
    + `claves ajenas ${r.total} · congeladas ${SIN_DDL_CONGELADAS.length} · estado ${r.estado}`);
  assert.notEqual(r.estado, 'CIEGO', `🔴 CIEGO: ${r.motivo}`);
  assert.ok(r.total > SIN_DDL_CONGELADAS.length, `población ${r.total}: no puede ser menor que la lista congelada`);
  assert.deepEqual(r.nuevas, [],
    '🔴 clave ajena del esquema SIN DDL en docs/sql ni en las congeladas. Escribe su .sql (ALTER aditivo, A5); '
    + 'la lista congelada NO se amplía (SCRUM-1310 c.20776).');
  assert.deepEqual(r.sobran, [],
    '🔴 estas congeladas ya tienen DDL (o el esquema ya no las implica): quítalas de SIN_DDL_CONGELADAS. La lista solo baja.');
  assert.equal(r.estado, 'VERDE');
});

test('SCRUM-1310b · la consulta para Javier pide las 13 por tabla y columna y no escribe el nombre de ninguna', () => {
  const sql = fs.readFileSync(path.join(RAIZ, CONSULTA), 'utf8');
  const { claves } = clavesAjenasDelSchema(fs.readFileSync(SCHEMA, 'utf8'));
  const nombradas = SIN_DDL_CONGELADAS.filter((n) => sql.includes(n));
  assert.deepEqual(nombradas, [], 'la sonda 1310 de SCRUM-1550 busca por subcadena: un nombre aquí fingiría su DDL');
  for (const n of SIN_DDL_CONGELADAS) {
    const c = claves.find((k) => k.nombre === n);
    if (!c) continue; // si el esquema ya no la implica, la mitad ② del trinquete lo dice
    assert.match(sql, new RegExp(`'${c.tabla}',\\s*'${c.columnas[0]}'\\)`), `la consulta no pide ${c.tabla}.${c.columnas[0]}`);
  }
  assert.match(sql, /'quotes',\s*'chargeId'\)/, 'falta el control positivo de la consulta');
});
