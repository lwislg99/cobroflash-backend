// tests/scrum1072-actividad-se-guarda.test.mjs — SCRUM-1072 (mitad de servidor)
//
// LA ACTIVIDAD (PROFESIONAL O EMPRESARIAL), JUNTO A LA RETENCIÓN DE IRPF: SOLO SE GUARDA.
//
// `merchants.activity_kind` está aplicada en las tres bases desde el 29-sep-2026
// (docs/sql/scrum-1072-activity-kind.sql; MIGRATIONS_PENDING, «LOTE DE 7»). Este ticket la declara
// en el esquema, la deja entrar por el PUT del perfil y la devuelve por el GET. La pantalla es de
// otro carril y sus rótulos esperan firma: aquí no hay ni un texto que vea el usuario.
//
// Lo que se mide, por efecto:
//   ① el esquema declara lo que el DDL creó: texto anulable y SIN valor por defecto;
//   ② los CUATRO estados (no consta · profesional · empresarial · no lo sé) entran y vuelven
//      distintos, y «no lo sé» no se confunde con «no consta»;
//   ③ NEGATIVO: lo que no está en la lista cerrada se rechaza y no escribe;
//   ④ la actividad NO mueve la retención, y la retención no mueve la actividad;
//   ⑤ cada comerciante escribe SOLO su fila;
//   ⑥ ningún fichero de `src` la LEE para decidir nada (ni importes ni retención).
// ⛔ Sin red ni base.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { soloCodigo } from './_solo-codigo.mjs';

const RAIZ = path.resolve(import.meta.dirname, '..');
const moduloPrisma = await import('../dist/core/db/prisma.js');
const { merchantProfileUpdateSchema } = await import('../dist/core/validation/schemas.js');
const { getMerchantProfile, updateMerchantProfile } = await import('../dist/modules/system/merchantAdmin.js');

const CLAVE = 'activityKind';
const COLUMNA = 'activity_kind';
/** Los cuatro estados. `null` = no consta; 'no_lo_se' es una RESPUESTA. */
const ESTADOS = [null, 'profesional', 'empresarial', 'no_lo_se'];

// ── ① EL ESQUEMA ─────────────────────────────────────────────────────────────────────────────

test('SCRUM-1072 · ① el esquema declara la columna que el DDL creó: texto anulable y SIN valor por defecto', () => {
  const sql = fs.readFileSync(path.join(RAIZ, 'docs/sql/scrum-1072-activity-kind.sql'), 'utf8')
    .split(/\r?\n/).filter((l) => !l.trimStart().startsWith('--')).join('\n');
  const delDdl = [...sql.matchAll(/ADD COLUMN IF NOT EXISTS "(\w+)" TEXT\s*;/g)].map((m) => m[1]);
  assert.deepEqual(delDdl, [COLUMNA], '🔴 CIEGO: el DDL de SCRUM-1072 ya no crea exactamente esta columna de texto anulable');

  const schema = fs.readFileSync(path.join(RAIZ, 'prisma/schema.prisma'), 'utf8');
  const merchant = schema.match(/model\s+Merchant\s*\{([\s\S]*?)\n\}/);
  assert.ok(merchant, '🔴 CIEGO: no encuentro `model Merchant` en el esquema');
  const lineas = merchant[1].split(/\r?\n/).map((l) => l.trim()).filter((l) => l && !l.startsWith('//'));
  assert.ok(lineas.length > 50, `🔴 CIEGO: solo leo ${lineas.length} líneas del modelo Merchant`);
  const suyas = lineas.filter((l) => l.split(/\s+/)[0] === CLAVE);
  assert.equal(suyas.length, 1, `🔴 \`${CLAVE}\` no está declarada una vez en Merchant`);
  const [, tipo, ...resto] = suyas[0].split(/\s+/);
  assert.equal(tipo, 'String?', `🔴 \`${CLAVE}\` no es anulable: «no consta» no tendría cómo guardarse`);
  assert.ok(resto.join(' ').startsWith(`@map("${COLUMNA}")`), `🔴 \`${CLAVE}\` no apunta a la columna ${COLUMNA}`);
  assert.ok(!suyas[0].includes('@default'), `🔴 \`${CLAVE}\` lleva valor por defecto: afirmaría una respuesta que nadie dio`);
});

// ── ② ③ ④ ⑤ EL VIAJE POR EL SERVIDOR ──────────────────────────────────────────────────────────

/**
 * Una base con VARIAS filas que recuerda y respeta el `select` y el `where`: lo que no se pide no
 * sale, y cada escritura cae en la fila de su `id`.
 */
function baseQueRecuerda(filasIniciales) {
  const filas = new Map(filasIniciales.map((f) => [f.id, { email: 'pro@example.invalid', timezone: null, flags: null, ...f }]));
  moduloPrisma.prisma.merchant = {
    findUnique: async ({ where, select }) => {
      const fila = filas.get(where.id);
      if (!fila) return null;
      return Object.fromEntries(Object.keys(select).filter((k) => select[k]).map((k) => [k, k in fila ? fila[k] : null]));
    },
    update: async ({ where, data }) => Object.assign(filas.get(where.id), structuredClone(data)),
  };
  moduloPrisma.prisma.invoice = { findMany: async () => [] };
  return filas;
}
const originales = { merchant: moduloPrisma.prisma.merchant, invoice: moduloPrisma.prisma.invoice };
test.after(() => Object.assign(moduloPrisma.prisma, originales));

/** El PUT tal y como lo hace `app.ts`: esquema primero, y a la base solo lo que sobrevive. */
async function putComoApp(merchantId, body) {
  const parsed = merchantProfileUpdateSchema.safeParse(structuredClone(body));
  if (!parsed.success) return { status: 400 };
  await updateMerchantProfile(merchantId, parsed.data);
  return { status: 200 };
}

test('🔴 SCRUM-1072 · ② los CUATRO estados entran por el PUT y vuelven por el GET, distintos', async () => {
  const vueltas = [];
  for (const e of ESTADOS) {
    // La fila empieza con OTRO valor: uno igual aprobaría aunque no se escribiera nada.
    const filas = baseQueRecuerda([{ id: 7, [CLAVE]: e === 'empresarial' ? 'profesional' : 'empresarial' }]);
    assert.equal((await putComoApp(7, { [CLAVE]: e })).status, 200, `${JSON.stringify(e)} se rechaza`);
    assert.equal(filas.get(7)[CLAVE], e, `🔴 mando ${JSON.stringify(e)} y en la base queda ${JSON.stringify(filas.get(7)[CLAVE])}`);
    const perfil = await getMerchantProfile(7);
    assert.ok(CLAVE in perfil, `🔴 ${CLAVE} se guarda y no vuelve por el GET: el siguiente guardado lo borraría`);
    vueltas.push(perfil[CLAVE]);
  }
  assert.deepEqual(vueltas, ESTADOS, '🔴 los cuatro estados no vuelven tal cual');
  assert.equal(new Set(vueltas).size, ESTADOS.length, '🔴 dos estados colapsan en uno');
});

test('SCRUM-1072 · ② un perfil antiguo (columna NULL) sale «no consta», y un guardado que no la manda no la toca', async () => {
  const filas = baseQueRecuerda([{ id: 7, [CLAVE]: null }]);
  assert.equal((await getMerchantProfile(7))[CLAVE], null);
  filas.get(7)[CLAVE] = 'no_lo_se';
  assert.equal((await putComoApp(7, { name: 'Otro nombre' })).status, 200);
  assert.equal(filas.get(7)[CLAVE], 'no_lo_se', '🔴 un guardado ajeno ha borrado la actividad');
});

test('SCRUM-1072 · ③ NEGATIVO: lo que no está en la lista cerrada se rechaza y no escribe', async () => {
  for (const malo of ['', 'Profesional', 'PROFESIONAL', 'autonomo', 'no lo sé', 'no_lo_sé', 1, true, {}, []]) {
    const filas = baseQueRecuerda([{ id: 7, [CLAVE]: 'empresarial' }]);
    assert.equal((await putComoApp(7, { [CLAVE]: malo })).status, 400, `🔴 acepta ${JSON.stringify(malo)}`);
    assert.equal(filas.get(7)[CLAVE], 'empresarial', 'un 400 no escribe');
  }
  // POSITIVO, con el mismo banco: lo válido SÍ escribe (si no, el 400 de arriba no mediría nada).
  const filas = baseQueRecuerda([{ id: 7, [CLAVE]: 'empresarial' }]);
  assert.equal((await putComoApp(7, { [CLAVE]: 'profesional' })).status, 200);
  assert.equal(filas.get(7)[CLAVE], 'profesional');
});

test('🔴 SCRUM-1072 · ④ cambiar la actividad NO mueve la retención, y guardar la retención no mueve la actividad', async () => {
  const filas = baseQueRecuerda([{ id: 7, [CLAVE]: 'profesional', retencionIrpfDeclarada: true, retencionIrpfTipo: 15 }]);
  // El caso límite del ticket: de «Profesional» a «Empresarial» con la retención ya declarada.
  assert.equal((await putComoApp(7, { [CLAVE]: 'empresarial' })).status, 200);
  assert.deepEqual(
    [filas.get(7).retencionIrpfDeclarada, filas.get(7).retencionIrpfTipo, filas.get(7)[CLAVE]],
    [true, 15, 'empresarial'],
    '🔴 cambiar la actividad ha tocado la retención',
  );
  // Y lo que la pantalla manda de verdad al guardar: las dos juntas. Cada una queda con lo suyo.
  assert.equal((await putComoApp(7, { [CLAVE]: 'no_lo_se', retencionIrpfDeclarada: true, retencionIrpfTipo: 7 })).status, 200);
  assert.deepEqual([filas.get(7).retencionIrpfTipo, filas.get(7)[CLAVE]], [7, 'no_lo_se']);
  assert.equal((await putComoApp(7, { retencionIrpfDeclarada: true, retencionIrpfTipo: null })).status, 200);
  assert.equal(filas.get(7)[CLAVE], 'no_lo_se', '🔴 guardar la retención ha movido la actividad');
});

test('🔴 SCRUM-1072 · ⑤ cada comerciante escribe SOLO su fila', async () => {
  const filas = baseQueRecuerda([{ id: 7, [CLAVE]: null }, { id: 8, [CLAVE]: 'empresarial' }]);
  assert.equal((await putComoApp(7, { [CLAVE]: 'profesional' })).status, 200);
  assert.equal(filas.get(7)[CLAVE], 'profesional', 'CONTROL: la escritura del 7 sí llegó');
  assert.equal(filas.get(8)[CLAVE], 'empresarial', '🔴 guardar el perfil del 7 ha tocado al 8');
  assert.equal((await getMerchantProfile(8))[CLAVE], 'empresarial', '🔴 el GET del 8 devuelve lo del 7');
});

// ── ⑥ NADIE LA LEE PARA DECIDIR ──────────────────────────────────────────────────────────────

/** Ficheros .ts de `src`, recorridos a mano: el censo declara cuántos ha visto. */
function ficherosTs(dir, salida = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) ficherosTs(p, salida);
    else if (e.name.endsWith('.ts')) salida.push(p);
  }
  return salida;
}

test('🔴 SCRUM-1072 · ⑥ ningún fichero de src LEE la actividad: solo la valida y la devuelve el perfil', () => {
  const ficheros = ficherosTs(path.join(RAIZ, 'src'));
  assert.ok(ficheros.length > 200, `🔴 CIEGO: el censo solo ve ${ficheros.length} ficheros de src`);
  // El código SIN comentarios: un comentario que la nombre no es una lectura.
  const quienLaNombra = ficheros.filter((f) => {
    const sinComentarios = soloCodigo(fs.readFileSync(f, 'utf8'), f);
    return /\bactivityKind\b|\bactivity_kind\b/.test(sinComentarios);
  }).map((f) => path.relative(RAIZ, f).replace(/\\/g, '/')).sort();
  // CONTROL POSITIVO: los dos sitios donde SÍ tiene que estar salen. Un censo que no los viera
  // aprobaría también con un tercero leyéndola.
  assert.deepEqual(quienLaNombra, ['src/core/validation/schemas.ts', 'src/modules/system/merchantAdmin.ts'],
    '🔴 la actividad aparece fuera del perfil: hasta que el asesor responda Q-C5, YaQu no decide nada con ella');
});
