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

import { desnudar, clasificarFichero, RECHAZADA } from '../scripts/_clasificador-sql.mjs';
import { partirAtributos } from '../scripts/_prisma-procedencia-guard.mjs';
import { soloCodigo } from './_solo-codigo.mjs';

const RAIZ = path.resolve(import.meta.dirname, '..');
const SCHEMA = path.join(RAIZ, 'prisma', 'schema.prisma');
const CARPETAS_DDL = ['docs/sql', 'docs/historico/prisma-migrations-frozen-2026-03'];
const CONSULTA = 'docs/sql/scrum-1310b-claves-ajenas-sin-ddl-consulta.sql';

/**
 * LAS 13 DE c.20753, CONGELADAS. Solo bajan: cuando una reciba su DDL en `docs/sql/`, se borra
 * de aquí en el mismo PR (la mitad ② lo exige). Nunca se añade una.
 *
 * SCRUM-1310c: las 13 recibieron su DDL en `docs/sql/scrum-1310c-claves-ajenas-ddl.sql`, con el
 * nombre y las acciones medidos en PRODUCCIÓN (c.20810). La lista queda vacía y no vuelve a crecer.
 */
export const SIN_DDL_CONGELADAS = [];

/**
 * Las 13 que c.20753 encontró sin DDL, por su IDENTIDAD. Ya no excusan nada: la consulta de 1310b
 * las sigue pidiendo y el fichero de 1310c tiene que darles DDL a todas. No se toca.
 */
export const LAS_13_DE_C20753 = [
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

// ── SCRUM-1310c · EL DDL DE LAS 13 ─────────────────────────────────────────────────────────
const DDL_1310C = 'docs/sql/scrum-1310c-claves-ajenas-ddl.sql';

/**
 * Lo que devolvió PRODUCCIÓN a la consulta de 1310b (SCRUM-1310 c.20810, Javier, Railway, solo
 * lectura, 24-oct-2026): nombre real, ON DELETE y ON UPDATE. Es la única parte del DDL que no sale
 * del esquema. La fila 0 es el control: `quotes_chargeId_fkey`, que sí tiene DDL congelado.
 */
export const PRODUCCION_C20810 = [
  { orden: 0, nombre: 'quotes_chargeId_fkey', onDelete: 'SET NULL', onUpdate: 'CASCADE' },
  { orden: 1, nombre: 'auth_sessions_merchant_id_fkey', onDelete: 'RESTRICT', onUpdate: 'CASCADE' },
  { orden: 2, nombre: 'auth_sessions_team_member_id_fkey', onDelete: 'SET NULL', onUpdate: 'CASCADE' },
  { orden: 3, nombre: 'customers_merchant_id_fkey', onDelete: 'RESTRICT', onUpdate: 'CASCADE' },
  { orden: 4, nombre: 'invoices_rectifies_id_fkey', onDelete: 'SET NULL', onUpdate: 'CASCADE' },
  { orden: 5, nombre: 'expenses_merchant_id_fkey', onDelete: 'RESTRICT', onUpdate: 'CASCADE' },
  { orden: 6, nombre: 'expenses_quote_id_fkey', onDelete: 'SET NULL', onUpdate: 'CASCADE' },
  { orden: 7, nombre: 'expenses_provider_id_fkey', onDelete: 'SET NULL', onUpdate: 'CASCADE' },
  { orden: 8, nombre: 'quote_requests_merchant_id_fkey', onDelete: 'RESTRICT', onUpdate: 'CASCADE' },
  { orden: 9, nombre: 'quote_requests_customer_id_fkey', onDelete: 'RESTRICT', onUpdate: 'CASCADE' },
  { orden: 10, nombre: 'quote_templates_merchant_id_fkey', onDelete: 'RESTRICT', onUpdate: 'CASCADE' },
  { orden: 11, nombre: 'team_members_merchant_id_fkey', onDelete: 'RESTRICT', onUpdate: 'CASCADE' },
  { orden: 12, nombre: 'customer_events_merchant_id_fkey', onDelete: 'RESTRICT', onUpdate: 'CASCADE' },
  { orden: 13, nombre: 'customer_events_customer_id_fkey', onDelete: 'RESTRICT', onUpdate: 'CASCADE' },
];

// El control: la línea de la congelada que la consulta de 1310b compara byte a byte.
const CONTROL_FICHERO = 'docs/historico/prisma-migrations-frozen-2026-03/20251104175333_add_quote_model/migration.sql';
const CONTROL_LINEA = 26;

/**
 * El DDL de una clave ajena, con la forma de las congeladas. Tabla, columnas, tabla y columnas
 * referenciadas salen de `schema.prisma` (`@@map`, `@map`, `@relation(fields:, references:)`);
 * nombre y acciones, de `medida` (producción). El esquema `"public"` es el de las congeladas.
 */
export function ddlDeClave(schemaTexto, medida) {
  const { claves, modelos } = clavesAjenasDelSchema(schemaTexto);
  const c = claves.filter((k) => k.nombre === medida.nombre);
  if (c.length !== 1) throw new Error(`${medida.nombre}: el esquema implica ${c.length} relaciones con ese nombre, no 1`);
  const [k] = c;
  const ref = modelos[k.modeloRef];
  if (!ref) throw new Error(`${medida.nombre}: el modelo referenciado ${k.modeloRef} no está en el esquema`);
  const q = (cols) => cols.map((x) => `"${x}"`).join(', ');
  const columnasRef = k.referencias.map((r) => ref.columnaDe[r] ?? r);
  return `ALTER TABLE "public"."${k.tabla}" ADD CONSTRAINT "${medida.nombre}" FOREIGN KEY (${q(k.columnas)}) `
    + `REFERENCES "public"."${ref.tabla}"(${q(columnasRef)}) ON DELETE ${medida.onDelete} ON UPDATE ${medida.onUpdate};`;
}

/** Las sentencias del fichero de 1310c: cada línea que no es comentario ni está en blanco. */
function sentenciasDe(texto) {
  return String(texto).split(/\r?\n/).map((l) => l.trim()).filter((l) => l && !l.startsWith('--'));
}

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
  const modelos = {};
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
      if (rel) relaciones.push({ rel, modeloRef: (cabeza.split(/\s+/)[1] || '').replace(/[?[\]]/g, '') });
    }
    modelos[modelo] = { tabla, columnaDe };
    for (const { rel, modeloRef } of relaciones) {
      const lista = (clave) => (rel.match(new RegExp(`\\b${clave}\\s*:\\s*\\[([^\\]]*)\\]`))?.[1] ?? '')
        .split(',').map((s) => s.trim()).filter(Boolean);
      const campos = lista('fields');
      const columnas = campos.map((c) => columnaDe[c] ?? c);
      const mapa = rel.match(/\bmap\s*:\s*"([^"]+)"/);
      claves.push({ modelo, tabla, columnas, modeloRef, referencias: lista('references'),
        nombre: mapa ? mapa[1] : `${tabla}_${columnas.join('_')}_fkey` });
    }
  }
  return { claves, recuentoTexto, modelos };
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
  const nombradas = LAS_13_DE_C20753.filter((n) => sql.includes(n));
  assert.deepEqual(nombradas, [], 'la sonda 1310 de SCRUM-1550 busca por subcadena: un nombre aquí fingiría su DDL');
  for (const n of LAS_13_DE_C20753) {
    const c = claves.find((k) => k.nombre === n);
    if (!c) continue; // si el esquema ya no la implica, la mitad ② del trinquete lo dice
    assert.match(sql, new RegExp(`'${c.tabla}',\\s*'${c.columnas[0]}'\\)`), `la consulta no pide ${c.tabla}.${c.columnas[0]}`);
  }
  assert.match(sql, /'quotes',\s*'chargeId'\)/, 'falta el control positivo de la consulta');
});

// ── SCRUM-1310c ────────────────────────────────────────────────────────────────────────────

test('SCRUM-1310c · CONTROL: el generador escribe quotes_chargeId_fkey idéntico, byte a byte, a su congelada', () => {
  const schema = fs.readFileSync(SCHEMA, 'utf8');
  const linea = fs.readFileSync(path.join(RAIZ, CONTROL_FICHERO), 'utf8').split('\n')[CONTROL_LINEA - 1].replace(/\r$/, '');
  assert.match(linea, /^ALTER TABLE .* FOREIGN KEY /, `la línea ${CONTROL_LINEA} de la congelada ya no es el DDL del control`);
  const control = PRODUCCION_C20810.find((p) => p.orden === 0);
  assert.equal(ddlDeClave(schema, control), linea);
  // Negativo del mismo control: con otra acción ya no casa.
  assert.notEqual(ddlDeClave(schema, { ...control, onDelete: 'RESTRICT' }), linea);
});

test('SCRUM-1310c · el fichero de docs/sql es exactamente el DDL de las 13: esquema + lo medido en producción (c.20810)', () => {
  const schema = fs.readFileSync(SCHEMA, 'utf8');
  const texto = fs.readFileSync(path.join(RAIZ, DDL_1310C), 'utf8');
  const esperado = PRODUCCION_C20810.filter((p) => p.orden > 0).map((p) => ddlDeClave(schema, p));
  assert.equal(esperado.length, LAS_13_DE_C20753.length);
  assert.deepEqual(PRODUCCION_C20810.filter((p) => p.orden > 0).map((p) => p.nombre), LAS_13_DE_C20753);
  assert.deepEqual(sentenciasDe(texto), esperado);
  const { nombres } = nombresConDdl(texto);
  assert.deepEqual(LAS_13_DE_C20753.filter((n) => !nombres.has(n)), [], 'una de las 13 sin DDL en el fichero');
});

test('SCRUM-1310c · el fichero NO se puede aplicar: el clasificador rechaza las 13 sentencias', () => {
  const r = clasificarFichero(fs.readFileSync(path.join(RAIZ, DDL_1310C), 'utf8'));
  assert.equal(r.ok, false);
  assert.equal(r.sentencias.length, 13, `población: ${r.sentencias.length} sentencias`);
  assert.equal(r.rechazadas.length, 13);
  // Se afirma el RECHAZO, no el motivo: con el prefijo `"public".` el clasificador las rechaza hoy
  // como «acción no reconocida» antes de llegar a la rama de FOREIGN KEY (SCRUM-1310c, hallazgo).
  assert.ok(r.rechazadas.every((s) => s.veredicto === RECHAZADA));
});
