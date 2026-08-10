// SCRUM-426 · El libro de facturas RECIBIDAS (A6).
//
// Sin gate: el módulo es PURO y se importa de `dist/`. Ni BD, ni red, ni navegador.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// QUÉ VIGILA ESTE FICHERO
//
// Lo que un libro de compras no puede hacer, en orden de gravedad:
//
//   ① decir «no compró nada» cuando lo que pasó es que no se pudo leer  → el suelo `miradas`
//   ② meter un gasto SIN clasificar como si su base fuera 0             → se excluye
//   ③ excluirlo EN SILENCIO                                            → se cuenta, con su dinero
//   ④ rellenar un hueco calculándolo                                   → la cuota se lee, no se deriva
//   ⑤ confundir «nunca se decidió» con «se decidió que no»             → `null` ≠ `false`
//
// El ② y el ③ son la misma decisión mirada por sus dos lados, y son el corazón del ticket: TODAS
// las filas anteriores al 10-ago-2026 tienen `baseAmount` a NULL.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  construirLibroRecibidas,
  exigirLibroRecibidasLegible,
} from '../dist/modules/invoicing/domain/libroRecibidas.js';

// `isDemoMerchant` es `id === 1`: un merchant de demo desactivaría comprobaciones sin tocar nada.
const M = 7;
const OTRO = 9;

/** Un gasto CLASIFICADO: el caso normal a partir del 10-ago-2026. */
const clasificado = (over = {}) => ({
  merchantId: M,
  date: new Date('2026-08-11T09:00:00Z'),
  concept: 'Material eléctrico',
  amount: '121.00',
  currency: 'EUR',
  providerId: 3,
  baseAmount: '100.00',
  vatRate: 21,
  vatAmount: '21.00',
  vatDeducible: true,
  providerInvoiceNumber: 'A-2026/443',
  providerInvoiceDate: new Date('2026-08-10T00:00:00Z'),
  ...over,
});

/** Un gasto de ANTES de la migración: las seis columnas fiscales a NULL. Es la mayoría. */
const sinClasificar = (over = {}) => ({
  merchantId: M,
  date: new Date('2026-05-02T09:00:00Z'),
  concept: 'Gasoil',
  amount: '60.00',
  currency: 'EUR',
  providerId: null,
  baseAmount: null,
  vatRate: null,
  vatAmount: null,
  vatDeducible: null,
  providerInvoiceNumber: null,
  providerInvoiceDate: null,
  ...over,
});

// ── ① EL SUELO ──────────────────────────────────────────────────────────────────────────

test('SCRUM-426 · SUELO: `miradas` viaja SIEMPRE, y distingue «no había» de «no supe leer»', () => {
  const vacio = construirLibroRecibidas({ gastos: [], merchantId: M });
  assert.equal(vacio.asientos.length, 0, '🔴 un libro sin gastos no puede traer asientos');
  assert.equal(
    vacio.miradas, 0,
    '🔴 sin `miradas` un periodo sin compras y un lector roto dan el MISMO libro vacío, y el ' +
      'segundo le dice a un despacho que no se compró nada.',
  );
  // Y el hermano positivo: con gastos, `miradas` los cuenta TODOS, entren o no como asiento.
  const con = construirLibroRecibidas({ gastos: [clasificado(), sinClasificar()], merchantId: M });
  assert.equal(con.miradas, 2, `🔴 se examinaron 2 gastos y \`miradas\` dice ${con.miradas}`);
  assert.equal(con.asientos.length, 1, '🔴 solo el clasificado es asiento');
});

test('SCRUM-426 · 🔴 el suelo LANZA si el libro no se puede leer, en vez de pasar por vacío', () => {
  for (const roto of [null, undefined, {}, { asientos: [] }, { miradas: 3 }, { asientos: 'no', miradas: 1 }]) {
    assert.throws(
      () => exigirLibroRecibidasLegible(roto),
      /NO SE PUDO LEER EL LIBRO DE FACTURAS RECIBIDAS/,
      `🔴 con ${JSON.stringify(roto)} el suelo deja pasar un libro ilegible`,
    );
  }
  // Hermano positivo: uno legible NO lanza. Sin esto, un suelo que lanzara SIEMPRE también pasaría.
  assert.doesNotThrow(() => exigirLibroRecibidasLegible({ asientos: [], miradas: 0 }));
});

// ── ②③ EL CORAZÓN: SIN `baseAmount` NO ES ASIENTO, Y SE DICE ────────────────────────────

test('SCRUM-426 · 🔴 EL VECTOR: un gasto sin `baseAmount` NO entra como si valiera 0', () => {
  // TODAS las filas anteriores al 10-ago-2026 están así. Si entraran con base 0, el libro
  // afirmaría «compró y la base fue cero» sobre un dato que no consta.
  const libro = construirLibroRecibidas({
    gastos: [sinClasificar(), sinClasificar({ amount: '40.00' }), clasificado()],
    merchantId: M,
  });

  assert.equal(libro.asientos.length, 1, `🔴 entraron ${libro.asientos.length} asientos y debía ser 1`);
  assert.equal(libro.asientos[0].base, 100, '🔴 el asiento que entra no es el clasificado');
  // La negación que importa: ninguna base a 0 colada.
  assert.equal(
    libro.asientos.filter((a) => a.base === 0).length, 0,
    '🔴 HAY ASIENTOS CON BASE 0 que vienen de un gasto sin clasificar. Un cero es una afirmación ' +
      '—«la base fue cero»— y aquí no se sabe. Es el defecto de SCRUM-403 en el otro lado.',
  );
});

test('SCRUM-426 · 🔴 …pero NO se excluyen en silencio: se cuentan, y con su DINERO', () => {
  // Excluir sin declarar es el mismo defecto con otra cara: 190 gastos fuera y un libro de 10
  // asientos se lee como «compré diez cosas».
  const libro = construirLibroRecibidas({
    gastos: [sinClasificar(), sinClasificar({ amount: '40.00' }), clasificado()],
    merchantId: M,
  });

  assert.equal(libro.sinClasificar, 2, `🔴 se excluyeron 2 y el libro declara ${libro.sinClasificar}`);
  assert.equal(
    libro.sinClasificarImporte, 100,
    `🔴 el importe excluido sale ${libro.sinClasificarImporte} y son 100 (60 + 40). Un recuento sin ` +
      'su dinero no se puede revisar a mano, que es justo lo que ese aviso pide que hagas.',
  );
});

test('SCRUM-426 · un importe ILEGIBLE del excluido no suma cero: se queda fuera del total', () => {
  // Familia SCRUM-271/367: `Number([])` es 0. Un array vacío como importe no puede sumar.
  const libro = construirLibroRecibidas({
    gastos: [sinClasificar({ amount: [] }), sinClasificar({ amount: '25.00' })],
    merchantId: M,
  });
  assert.equal(libro.sinClasificar, 2, '🔴 los dos se excluyen igual: ninguno tiene base');
  assert.equal(
    libro.sinClasificarImporte, 25,
    `🔴 sale ${libro.sinClasificarImporte}: el importe ilegible ha sumado 0 en vez de quedarse fuera.`,
  );
});

// ── ④ NO SE RELLENA CALCULANDO ──────────────────────────────────────────────────────────

test('SCRUM-426 · la cuota se LEE, no se deriva de base × tipo', () => {
  // La especificación de la columna dice que se guarda «porque un redondeo distinto entre pantalla
  // y libro es una discrepancia que después nadie sabe explicar». Derivarla aquí sería un segundo
  // sitio calculando lo mismo.
  const libro = construirLibroRecibidas({
    gastos: [clasificado({ vatAmount: null })],
    merchantId: M,
  });
  assert.equal(libro.asientos.length, 1, '🔴 sin cuota el asiento sigue entrando: la base consta');
  assert.equal(
    libro.asientos[0].cuota, null,
    `🔴 la cuota sale ${libro.asientos[0].cuota}. Con base 100 y tipo 21, derivarla daría 21 — y ` +
      'eso es calcular un dato fiscal que no consta.',
  );
  assert.equal(libro.sinCuota, 1, '🔴 el hueco no se declara: `sinCuota` debería contarlo');
  // Hermano positivo: cuando SÍ está guardada, se usa tal cual.
  const conCuota = construirLibroRecibidas({ gastos: [clasificado()], merchantId: M });
  assert.equal(conCuota.asientos[0].cuota, 21, '🔴 no se está leyendo la cuota guardada');
  assert.equal(conCuota.sinCuota, 0, '🔴 se cuenta como sin cuota una que sí la tiene');
});

// ── ⑤ `null` NO ES `false` ──────────────────────────────────────────────────────────────

test('SCRUM-426 · «nunca se decidió» y «se decidió que NO» salen distintos', () => {
  const libro = construirLibroRecibidas({
    gastos: [
      clasificado({ vatDeducible: null }),
      clasificado({ vatDeducible: false }),
      clasificado({ vatDeducible: true }),
    ],
    merchantId: M,
  });
  assert.deepEqual(
    libro.asientos.map((a) => a.deducible), [null, false, true],
    '🔴 se están aplanando `null` y `false`. `null` es «nunca clasificado» y `false` es una ' +
      'decisión tomada: en un libro que se entrega, confundirlas afirma algo que nadie dijo.',
  );
  assert.equal(libro.sinDeducibilidadDecidida, 1, '🔴 no se declara cuántos siguen sin decidir');
});

// ── TENENCIA (regla 2) ──────────────────────────────────────────────────────────────────

test('SCRUM-426 · un merchant NO ve las compras de otro, y el descarte SE CUENTA', () => {
  const libro = construirLibroRecibidas({
    gastos: [clasificado(), clasificado({ merchantId: OTRO }), clasificado({ merchantId: OTRO })],
    merchantId: M,
  });
  assert.equal(libro.asientos.length, 1, '🔴 se han colado compras de otro merchant EN UN LIBRO FISCAL');
  assert.equal(
    libro.ajenas, 2,
    `🔴 se descartaron 2 filas ajenas y el libro declara ${libro.ajenas}. Un descarte silencioso ` +
      'es indistinguible de un dato que nunca existió.',
  );
  assert.equal(libro.miradas, 3, '🔴 `miradas` cuenta lo EXAMINADO, ajenas incluidas');
});

// ── LAS DOS FECHAS NO SE CONFUNDEN ──────────────────────────────────────────────────────

test('SCRUM-426 · la fecha del proveedor NO se sustituye por la del apunte', () => {
  // Son fechas distintas y confundirlas movería un asiento de periodo.
  const libro = construirLibroRecibidas({ gastos: [clasificado()], merchantId: M });
  const a = libro.asientos[0];
  assert.match(a.fechaExpedicion, /^2026-08-10/, '🔴 la fecha de expedición no es la del proveedor');
  assert.match(a.fechaApunte, /^2026-08-11/, '🔴 la fecha de apunte no es la de `Expense.date`');
  assert.notEqual(a.fechaExpedicion, a.fechaApunte, '🔴 las dos fechas han salido iguales');

  // Y si el proveedor no puso fecha, se queda VACÍA: no se rellena con la del apunte.
  const sinFecha = construirLibroRecibidas({
    gastos: [clasificado({ providerInvoiceDate: null })], merchantId: M,
  });
  assert.equal(
    sinFecha.asientos[0].fechaExpedicion, null,
    '🔴 se ha rellenado la fecha de expedición con la del apunte. Son dos hechos distintos.',
  );
});

// ── EL ASIENTO A MEDIAS ENTRA, PERO SE CUENTA ───────────────────────────────────────────

test('SCRUM-426 · sin nº del proveedor el asiento ENTRA (la compra ocurrió) y se declara', () => {
  const libro = construirLibroRecibidas({
    gastos: [clasificado({ providerInvoiceNumber: null }), clasificado()],
    merchantId: M,
  });
  assert.equal(
    libro.asientos.length, 2,
    '🔴 se ha omitido una compra por no tener el nº del proveedor. Su base consta: omitirla dejaría ' +
      'el IVA soportado por debajo de lo real.',
  );
  assert.equal(libro.sinNumeroProveedor, 1, '🔴 no se declara el asiento identificable a medias');
  assert.equal(libro.asientos[0].numeroProveedor, null, '🔴 no se inventa un número');
});

// ── EL TIPO DE IVA, EN LA CONVENCIÓN CORRECTA ───────────────────────────────────────────

test('SCRUM-426 · el tipo va en ENTERO de porcentaje, y una fracción NO se acepta', () => {
  // `AlbaranLinea.tipoIva` usa 21; `Quote.lines[].tax` usa 0.21. Mezclarlas multiplica el IVA por
  // cien sin que nada falle, y es un error conocido de esta casa.
  const bueno = construirLibroRecibidas({ gastos: [clasificado({ vatRate: 10 })], merchantId: M });
  assert.equal(bueno.asientos[0].tipoIva, 10, '🔴 no se lee el tipo entero');

  const fraccion = construirLibroRecibidas({ gastos: [clasificado({ vatRate: 0.21 })], merchantId: M });
  assert.equal(
    fraccion.asientos[0].tipoIva, null,
    '🔴 se ha aceptado `0.21` como tipo. Es la convención de `Quote.lines[].tax`, no la de esta ' +
      'columna: un libro con «tipo 0,21 %» es un documento que no se puede entregar.',
  );
  // Y el 0 SÍ es un tipo legítimo (exento/no sujeto), no se confunde con «no consta».
  const cero = construirLibroRecibidas({ gastos: [clasificado({ vatRate: 0 })], merchantId: M });
  assert.equal(cero.asientos[0].tipoIva, 0, '🔴 el tipo 0 se está tratando como ausente');
});

// ── LO QUE ESTE MÓDULO NO HACE ──────────────────────────────────────────────────────────

test('SCRUM-426 · no formatea NADA: el formato es E4 y va después', () => {
  // Que este módulo se quede en dato de dominio es lo que hace fiable la frontera: si la capa de
  // entrega calculara, una cifra del fichero podría discrepar del libro sin saber cuál manda.
  const libro = construirLibroRecibidas({ gastos: [clasificado()], merchantId: M });
  const a = libro.asientos[0];
  assert.equal(typeof a.base, 'number', '🔴 la base sale como texto: eso ya es formato');
  assert.equal(typeof a.tipoIva, 'number', '🔴 el tipo sale como texto: eso ya es formato');
  assert.ok(!('columnas' in libro) && !('csv' in libro), '🔴 el libro trae formato dentro');
  // Y no se ha inventado un nombre oficial: P15.1 sigue sin respuesta.
  //
  // ⚠️ HERMANO POSITIVO de la negación (SCRUM-237). Sin él, `!includes(…)` pasaría por vacío para
  // siempre —el token no está en ninguna parte, así que la negación sería verde por construcción—
  // y nadie se enteraría el día que alguien SÍ lo escribiera. Primero se comprueba que el detector
  // reconoce el nombre teniéndolo delante.
  const conNombre = { ...libro, rotulo: 'Libro Registro de la AEAT · recibidas' };
  assert.ok(
    JSON.stringify(conNombre).includes('Libro Registro de la AEAT'),
    '🔴 ESCÁNER CIEGO: el detector no reconocería el nombre oficial ni estando dentro del libro.',
  );
  assert.ok(
    !JSON.stringify(libro).includes('Libro Registro de la AEAT'),
    '🔴 el módulo se autodenomina «Libro Registro de la AEAT». Ese nombre es una PROMESA y no hay ' +
      'documento oficial en el árbol contra el que se haya contrastado el formato (P15.1).',
  );
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// LA CONEXIÓN CON E4 · SE EJECUTA, NO SE MENCIONA
//
// Mencionar no es hacer. Estos tests no comprueban que exista un import ni que un comentario
// hable de la conexión: RECORREN LA CADENA ENTERA —repo de E4 → lector de A6 → motor → filas—
// con una base falsa, y comparan lo que sale con lo que el motor calculó. Si alguien desconecta
// el motor, o hace que E4 se invente sus propias cifras, esto muere.
// ═════════════════════════════════════════════════════════════════════════════════════════

import {
  COLUMNAS_RECIBIDAS, LIBROS_DISPONIBLES, filasLibroRecibidas, avisosLibroRecibidas,
} from '../dist/modules/fiscal/librosAeat/librosAeat.js';
import { leerLibroRecibidasDelTrimestre } from '../dist/modules/fiscal/librosAeat/librosAeat.repo.js';
import { csvLibroRecibidas } from '../dist/modules/fiscal/librosAeat/librosAeatCsv.js';

/** Base falsa: devuelve los gastos que se le den y resuelve el proveedor. Nada más. */
function dbFalsa(gastos, proveedores = [{ id: 3, name: 'Suministros Peña', taxId: 'B12345678' }]) {
  const visto = { where: null };
  return {
    visto,
    expense: { findMany: async (args) => { visto.where = args.where; return gastos; } },
    provider: { findMany: async () => proveedores },
    invoice: { findMany: async () => [] },
    quote: { findMany: async () => [] },
    albaran: { findMany: async () => [] },
    customer: { findMany: async () => [] },
  };
}

test('SCRUM-426 · 🔴 LA CADENA ENTERA CORRE: repo de E4 → lector de A6 → motor → filas', async () => {
  const db = dbFalsa([clasificado(), sinClasificar()]);
  const r = await leerLibroRecibidasDelTrimestre(db, { merchantId: M, año: 2026, trimestre: 3 });

  // ① el motor corrió de verdad: solo el clasificado es asiento, y `miradas` cuenta los dos.
  assert.equal(r.filas.length, 1, `🔴 salieron ${r.filas.length} filas y el motor produce 1 asiento`);
  assert.equal(r.miradas, 2, '🔴 `miradas` no llega al entregable: sin él, vacío y roto se leen igual');

  // ② las cifras son LAS DEL MOTOR, no unas recalculadas por la capa de formato.
  const f = r.filas[0];
  assert.equal(f.base, 100, `🔴 la base sale ${f.base}: E4 está produciendo su propia cifra`);
  assert.equal(f.cuota, 21, '🔴 la cuota no es la que guardó el motor');
  assert.equal(f.tipoIva, 21, '🔴 el tipo no es el del motor');

  // ③ el id se resolvió a identidad — que es ENTREGA, no cálculo.
  assert.equal(f.nifProveedor, 'B12345678', '🔴 no se resuelve el NIF del proveedor');
  assert.equal(f.nombreProveedor, 'Suministros Peña', '🔴 no se resuelve el nombre del proveedor');
  assert.ok(!('proveedorId' in f), '🔴 el id interno se está pintando en un libro que sale de casa');

  // ④ y el periodo se aplicó DONDE se dijo: por la fecha del apunte, que siempre existe.
  assert.ok(db.visto.where.date, '🔴 no se filtró por periodo: el libro traería todo el histórico');
  assert.equal(db.visto.where.merchantId, M, '🔴 la consulta no está acotada al merchant (regla 2)');
});

test('SCRUM-426 · 🔴 SI ALGUIEN DESCONECTA EL MOTOR, ESTO MUERE: E4 declara los DOS libros', () => {
  const claves = LIBROS_DISPONIBLES.map((l) => l.clave);
  assert.deepEqual(
    claves, ['expedidas', 'recibidas'],
    `🔴 \`LIBROS_DISPONIBLES\` declara ${JSON.stringify(claves)}. Si «recibidas» desaparece, el ` +
      'motor de A6 vuelve a ser dominio que nadie alcanza — que es lo que cazó SCRUM-411.',
  );
  const recibidas = LIBROS_DISPONIBLES.find((l) => l.clave === 'recibidas');
  assert.equal(recibidas.columnas, COLUMNAS_RECIBIDAS, '🔴 el libro declarado no usa sus columnas');
});

test('SCRUM-426 · las columnas son UNA POR CAMPO DEL MOTOR, en el orden del motor', () => {
  // Se DERIVAN del asiento que produce el motor, no de una lista escrita a mano: si el motor gana
  // un campo y nadie le da columna, saldría del libro en silencio.
  const libro = construirLibroRecibidas({ gastos: [clasificado()], merchantId: M });
  const delMotor = Object.keys(libro.asientos[0]);
  const deLaHoja = COLUMNAS_RECIBIDAS.map((c) => c.clave);

  // `proveedorId` es la ÚNICA excepción declarada: se resuelve a nif + nombre, igual que el libro
  // de expedidas resuelve `clienteId`. Todo lo demás va 1:1 y en el mismo orden.
  const esperado = delMotor.flatMap((k) => (k === 'proveedorId' ? ['nifProveedor', 'nombreProveedor'] : [k]));
  assert.deepEqual(
    deLaHoja, esperado,
    '🔴 las columnas y los campos del motor han dejado de coincidir.\n' +
      `   motor: ${JSON.stringify(delMotor)}\n   hoja:  ${JSON.stringify(deLaHoja)}\n\n` +
      '  Un campo del motor sin columna sale del libro EN SILENCIO; una columna sin campo se pinta ' +
      'siempre vacía y parece un dato que falta. No hay especificación (P15.1): el orden es el del motor.',
  );
});

test('SCRUM-426 · 🔴 lo excluido VIAJA DENTRO del fichero, no en una nota de la pantalla', async () => {
  // El fichero se reenvía por correo al despacho, y ahí ya no hay pantalla que explique nada.
  const db = dbFalsa([clasificado(), sinClasificar(), sinClasificar({ amount: '40.00' })]);
  const r = await leerLibroRecibidasDelTrimestre(db, { merchantId: M, año: 2026, trimestre: 3 });
  const csv = csvLibroRecibidas(r.filas, r.avisos);

  assert.match(csv, /2 gastos sin datos de IVA no figuran/, '🔴 el fichero no dice cuántos quedaron fuera');
  assert.match(csv, /100/, '🔴 el fichero no dice CUÁNTO dinero quedó fuera (60 + 40)');
  assert.match(csv, /Formato provisional/, '🔴 el fichero no declara que el formato no está contrastado');
  assert.ok(csv.startsWith('\ufeff'), '🔴 el BOM ha dejado de ir el primero: Excel leerá «Peña» roto');
  // Y el hermano positivo del aviso: sin exclusiones, ese segundo aviso NO aparece.
  const limpio = csvLibroRecibidas([], avisosLibroRecibidas({ sinClasificar: 0, sinClasificarImporte: 0 }));
  assert.doesNotMatch(limpio, /sin datos de IVA/, '🔴 el aviso de excluidos sale sin haber excluidos');
  assert.match(limpio, /Formato provisional/, '🔴 el de formato provisional tiene que salir siempre');
});
