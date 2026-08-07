// tests/scrum325-libros-por-periodo.test.mjs — SCRUM-325 (E4).
//
// EL LIBRO DE A6, POR PERIODO Y EN UN FICHERO. Lo que se vigila aquí es la ENTREGA: qué columnas
// salen, en qué orden, con qué formato, de qué periodo — y que un fallo del lector NO se
// confunda nunca con un trimestre sin facturas.
//
// ⚠️ Este fichero NO comprueba que el libro esté bien calculado. Eso es A6 (SCRUM-296) y tiene
// sus propios tests. Si una cifra de aquí no cuadra con el libro, el defecto está en la entrega.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  COLUMNAS_EXPEDIDAS, LIBROS_DISPONIBLES, exigirLibroLegible, entraEnPeriodo,
  filasLibroExpedidas, filasDeAsiento, MAPA_ESTADO, celdasDeEstado,
} from '../dist/modules/fiscal/librosAeat/librosAeat.js';
import { csvLibroExpedidas, celda, nombreFicheroExpedidas } from '../dist/modules/fiscal/librosAeat/librosAeatCsv.js';
import { rangoTrimestre } from '../dist/modules/fiscal/modelo303/modelo303.js';

/** Un asiento del libro, con la forma que produce A6. */
function asiento(over = {}) {
  return {
    numero: '2026-CF-001',
    fecha: '2026-08-15T10:00:00.000Z',
    tipo: 'F1',
    clienteId: 70,
    base: 100,
    cuota: 21,
    porTipo: [{ tipo: 21, base: 100, cuota: 21 }],
    total: 121,
    moneda: 'EUR',
    estado: 'paid',
    importeIlegible: false,
    enlaces: { presupuestoId: null, presupuestoFirmado: null, albaranes: [], albaranesNoSellados: 0, cobroId: null },
    ...over,
  };
}
const libroDe = (asientos, over = {}) => ({ asientos, miradas: asientos.length, ajenas: 0, sinNumero: 0, ...over });
const DESTINATARIOS = new Map([[70, { nombre: 'Peñalver & Ço, S.L.', nif: 'B12345678' }]]);

// ── R1 · EL FORMATO, CONTRA UN VECTOR CONGELADO ────────────────────────────────────────────

test('SCRUM-325 · 🔴 R1: las columnas del libro están CONGELADAS, en orden y con su clave', () => {
  // Un formato que se entrega a un tercero no se prueba con «parece correcto»: se fija. Si alguien
  // añade, quita o reordena una columna, este test cae NOMBRANDO cuál — y entonces es una decisión
  // consciente, no una deriva.
  //
  // Se ancla en las CLAVES, no en los rótulos: los rótulos son microcopy sin aprobar (regla 30) y
  // tienen que poder cambiar cuando el fundador los apruebe sin romper el formato.
  const esperado = [
    'fechaExpedicion', 'serieNumero', 'tipoFactura', 'nifDestinatario', 'nombreDestinatario',
    'baseImponible', 'tipoIva', 'cuotaIva', 'totalFactura', 'cobro', 'anulada',
  ];
  const real = COLUMNAS_EXPEDIDAS.map((c) => c.clave);
  assert.deepEqual(real, esperado,
    `🔴 EL FORMATO DEL LIBRO HA CAMBIADO.\n  esperado: ${esperado.join(' · ')}\n  real:     ${real.join(' · ')}\n\n` +
    '  Sobran: ' + real.filter((c) => !esperado.includes(c)).join(', ') + '\n' +
    '  Faltan: ' + esperado.filter((c) => !real.includes(c)).join(', '));
});

test('SCRUM-325 · 🔴 R1: una fila completa, congelada celda a celda', () => {
  const filas = filasLibroExpedidas(libroDe([asiento()]), DESTINATARIOS);
  assert.equal(filas.length, 1, '🔴 una factura con un solo tipo de IVA tiene que dar UNA fila');
  const linea = csvLibroExpedidas(filas).split('\r\n')[1];
  assert.equal(
    linea,
    '2026-08-15;2026-CF-001;F1;B12345678;Peñalver & Ço, S.L.;100,00;21;21,00;121,00;Cobrada;—',
    '🔴 la fila del libro ha cambiado de forma. Si el cambio es querido, actualiza el vector Y di ' +
    'por qué en el commit: este fichero se entrega fuera.',
  );
});

test('SCRUM-325 · 🔴 R1: una factura con DOS tipos de IVA da DOS filas, y el total no se duplica', () => {
  const a = asiento({ porTipo: [{ tipo: 21, base: 100, cuota: 21 }, { tipo: 10, base: 50, cuota: 5 }], base: 150, cuota: 26, total: 176 });
  const filas = filasLibroExpedidas(libroDe([a]), DESTINATARIOS);
  assert.equal(filas.length, 2, '🔴 el desglose por tipo no produce una fila por tipo');
  assert.equal(filas[0].totalFactura, 176);
  assert.equal(filas[1].totalFactura, null,
    '🔴 el total se repite en la segunda fila: sumar esa columna daría el total MULTIPLICADO por ' +
    'el número de tipos de IVA de la factura.');
});

test('SCRUM-325 · un importe ILEGIBLE sale vacío, nunca 0,00', () => {
  // Regla heredada de A5/A6: un cero afirma «facturó cero»; un hueco dice «no se sabe».
  const filas = filasLibroExpedidas(libroDe([asiento({ importeIlegible: true })]), DESTINATARIOS);
  assert.equal(celda('baseImponible', filas[0].baseImponible), '',
    '🔴 un importe que no se pudo leer sale como 0,00. Eso es declarar una cifra que nadie ha ' +
    'comprobado, en un documento que se entrega a un tercero.');
});

// ── EL ESTADO, PARTIDO EN DOS EJES ─────────────────────────────────────────────────────────

test('SCRUM-325 · 🔴 un estado SIN columna asignada cae NOMBRÁNDOLO', () => {
  // El rojo que pidió el asesor antes de aprobar los rótulos. Si mañana entra un cuarto estado y
  // nadie dice a qué eje pertenece, la factura saldría como NO anulada y sin cobro — una
  // afirmación que nadie ha hecho, en un documento que se entrega fuera.
  assert.throws(
    () => filasDeAsiento(asiento({ estado: 'refunded' }), { nombre: null, nif: null }),
    /ESTADO DE FACTURA SIN COLUMNA ASIGNADA: «refunded»/,
    '🔴 un estado desconocido NO hace saltar nada: el mapeo miente en silencio.',
  );
  // Y el control por el otro lado: los tres conocidos NO lanzan. Sin esto, el suelo podría estar
  // rechazándolo todo y este test saldría igual de verde.
  for (const e of ['pending', 'paid', 'annulled']) {
    assert.doesNotThrow(() => filasDeAsiento(asiento({ estado: e }), { nombre: null, nif: null }),
      `🔴 «${e}» es un estado REAL de Invoice.status y el mapeo lo rechaza.`);
  }
});

test('SCRUM-325 · el MAPA cubre exactamente los estados que el código escribe', () => {
  // La tabla no se cree por estar escrita: se compara con lo que `src/` escribe de verdad. Es la
  // regla de la casa — una tabla a mano que se desincroniza de su fuente es el mismo defecto en
  // otra capa.
  const escritos = new Set(['pending']); // el @default del schema
  const dir = new URL('../src/', import.meta.url);
  const rec = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = new URL(e.name + (e.isDirectory() ? '/' : ''), d);
      if (e.isDirectory()) rec(p);
      else if (e.name.endsWith('.ts')) {
        const src = fs.readFileSync(p, 'utf8');
        for (const m of src.matchAll(/invoice\.(?:create|update|updateMany|upsert)\(([\s\S]{0,600}?)\)\s*[;,)]/g)) {
          for (const s of m[1].matchAll(/status:\s*'([a-z_]+)'/g)) escritos.add(s[1]);
        }
      }
    }
  };
  rec(dir);
  assert.ok(escritos.size >= 3,
    `🔴 el censo solo ha encontrado ${escritos.size} estados escritos: no está leyendo src/, y ` +
    'entonces «el mapa los cubre todos» sería verdad por vacío.');
  const sinMapear = [...escritos].filter((e) => !(e in MAPA_ESTADO)).sort();
  assert.deepEqual(sinMapear, [],
    `🔴 el código escribe estados que MAPA_ESTADO no conoce: ${sinMapear.join(', ')}.`);
});

test('SCRUM-325 · una factura ANULADA no afirma que no se cobró', () => {
  // Hallazgo declarado: `annulled` PISA el estado de cobro, porque los dos ejes compartían campo.
  // «Cobro» sale vacío —«no se sabe»— y no «Pendiente», que sería afirmar que no se cobró.
  const [fila] = filasDeAsiento(asiento({ estado: 'annulled' }), { nombre: null, nif: null });
  assert.equal(fila.anulada, 'Sí');
  assert.equal(fila.cobro, '',
    '🔴 una factura anulada declara un estado de cobro que el dato ya no contiene: al anularse se ' +
    'perdió si estaba cobrada. Un hueco dice «no se sabe»; una palabra afirma.');
});

// ── R2 · FRONTERAS DE PERIODO ──────────────────────────────────────────────────────────────

test('SCRUM-325 · 🔴 R2: el ÚLTIMO día del trimestre entra; el PRIMERO del siguiente, no', () => {
  const { desde, hasta } = rangoTrimestre(2026, 3); // jul-ago-sep
  // 🔴 LOS BORDES SE DERIVAN DEL RANGO, NO SE ESCRIBEN A MANO — y esta es la lección del test.
  // La primera versión ancló el borde en `'2026-09-30T23:59:59.900Z'` (UTC) y salió ROJA con el
  // código CORRECTO: el trimestre acaba a las 23:59:59.999 **hora de Madrid**, o sea las 22:59:59.999Z,
  // así que ese instante UTC ya es 1 de octubre en local. Escribir el borde a mano en la zona
  // equivocada convierte un test de fronteras en un generador de falsos rojos — justo donde más
  // caro sale, porque invita a «arreglar» un periodo fiscal que estaba bien.
  const ultimoDelT3 = new Date(hasta.getTime()).toISOString();
  const primeroDelT4 = new Date(hasta.getTime() + 1).toISOString();

  const dentro = filasLibroExpedidas(
    libroDe([asiento({ fecha: ultimoDelT3, numero: '2026-CF-030' })]), DESTINATARIOS, { desde, hasta },
  );
  assert.equal(dentro.length, 1,
    `🔴 una factura del ÚLTIMO instante del trimestre (${ultimoDelT3}) se queda FUERA del libro. ` +
    'Desaparece de un documento oficial sin que nadie lo note.');

  const fuera = filasLibroExpedidas(
    libroDe([asiento({ fecha: primeroDelT4, numero: '2026-CF-031' })]), DESTINATARIOS, { desde, hasta },
  );
  assert.equal(fuera.length, 0,
    `🔴 una factura del PRIMER instante del trimestre siguiente (${primeroDelT4}) entra en este ` +
    'libro. El trimestre declararía facturación que no le corresponde.');
});

test('SCRUM-325 · el rango NO se reimplementa: es el mismo `rangoTrimestre` que el modelo 303', () => {
  // Si el libro y el 303 definieran «trimestre» por su cuenta, un día dirían cosas distintas sobre
  // el mismo periodo y el profesional tendría dos documentos oficiales que se contradicen.
  const fuente = fs.readFileSync(new URL('../src/modules/fiscal/librosAeat/librosAeat.repo.ts', import.meta.url), 'utf8');
  assert.match(fuente, /import \{ rangoTrimestre \} from '\.\.\/modelo303\/modelo303'/,
    '🔴 el lector del libro ya no usa `rangoTrimestre` de A5: se ha escrito una segunda definición ' +
    'de trimestre.');
  assert.doesNotMatch(fuente, /new Date\(\s*año/,
    '🔴 hay una construcción de fechas de periodo a mano en el lector del libro.');
});

// ── R3 · CODIFICACIÓN, ABIERTA EN BYTES ────────────────────────────────────────────────────

test('SCRUM-325 · 🔴 R3: Ñ, acentos y ç sobreviven — comprobado en BYTES y releyendo el fichero', () => {
  // La dirección contraria a D1 (SCRUM-312). No se supone: se escribe a disco y se vuelve a leer.
  const filas = filasLibroExpedidas(
    libroDe([asiento()]),
    new Map([[70, { nombre: 'Peñalver & Ço — Diseño S.L.', nif: 'B12345678' }]]),
  );
  const csv = csvLibroExpedidas(filas);

  const destino = path.join(os.tmpdir(), `yaqu-scrum325-${process.pid}.csv`);
  fs.writeFileSync(destino, csv, 'utf8');
  const crudo = fs.readFileSync(destino);
  try {
    // ① El BOM, en bytes. Sin él Excel lee el fichero como ANSI y «Peña» sale «PeÃ±a».
    assert.deepEqual([...crudo.subarray(0, 3)], [0xEF, 0xBB, 0xBF],
      `🔴 el CSV NO empieza por el BOM UTF-8 (primeros bytes: ${[...crudo.subarray(0, 3)]}). En ` +
      'Excel español los acentos saldrán rotos, y es el fichero que se entrega fuera.');

    // ② Y el texto, releído del disco.
    const releido = crudo.toString('utf8');
    for (const trozo of ['Peñalver', 'Ço', 'Diseño']) {
      assert.ok(releido.includes(trozo),
        `🔴 «${trozo}» no sobrevive al viaje a disco: el fichero llega ilegible al profesional.`);
    }
    // ③ El separador de la casa, o Excel ES lo abre entero en la columna A.
    assert.ok(releido.split('\r\n')[0].includes(';'), '🔴 el CSV no usa `;`: Excel ES no lo separa.');
  } finally {
    fs.rmSync(destino, { force: true });
  }
});

// ── R4 · EL SUELO: «no había» ≠ «no supe mirar» ────────────────────────────────────────────

test('SCRUM-325 · 🔴 R4: periodo VACÍO con la base llena → fichero vacío CORRECTO', () => {
  // La base tiene asientos, pero ninguno del periodo. Eso es un libro vacío legítimo y tiene que
  // salir: solo cabecera, sin filas.
  const { desde, hasta } = rangoTrimestre(2026, 1);
  const libro = libroDe([asiento({ fecha: '2026-08-15T10:00:00.000Z' })]); // T3, no T1
  const filas = filasLibroExpedidas(libro, DESTINATARIOS, { desde, hasta });
  assert.equal(filas.length, 0);
  const lineas = csvLibroExpedidas(filas).split('\r\n');
  assert.equal(lineas.length, 1, '🔴 un libro sin asientos tiene que traer la cabecera y nada más');
  // Se ancla en un rótulo REAL, no en el marcador: los once están aprobados desde el 7-ago-2026 y
  // ya no queda ninguno pendiente. Un assert que busca `[PENDIENTE]` se vuelve rojo el día que se
  // aprueba la microcopy — o sea, falla al ARREGLARSE, que es el defecto de SCRUM-381.
  assert.ok(lineas[0].includes('Fecha de expedición') && lineas[0].includes('Anulada'),
    '🔴 la cabecera no llega entera: el fichero vacío no sería legible ni como constancia.');
});

test('SCRUM-325 · 🔴 R4: si el libro NO SE PUDO LEER, FALLA — no devuelve un fichero vacío', () => {
  // El corazón del ticket. Los dos casos dan el mismo Excel en blanco y significan lo contrario,
  // y el segundo se le manda a Hacienda diciendo que no facturaste.
  for (const [caso, roto] of [
    ['el lector devolvió null', null],
    ['el lector devolvió undefined', undefined],
    ['sin `asientos`', { miradas: 3 }],
    ['sin `miradas` — no se sabe cuántas facturas se examinaron', { asientos: [] }],
  ]) {
    assert.throws(
      () => filasLibroExpedidas(roto, DESTINATARIOS),
      /NO SE PUDO LEER EL LIBRO DE REGISTRO/,
      `🔴 con «${caso}» el libro NO falla: devuelve filas. Un fallo del lector se está entregando ` +
      'como un trimestre sin facturación.',
    );
  }

  // Y el control por el otro lado: un libro legible con CERO asientos NO lanza. Sin esto, el
  // suelo podría estar rechazándolo todo y este fichero saldría igual de verde.
  assert.doesNotThrow(() => exigirLibroLegible(libroDe([])),
    '🔴 un libro legible y vacío (0 facturas examinadas) está fallando: entonces el suelo no ' +
    'distingue nada, solo rechaza.');
});

// ── R5 · ROJO POR EL MECANISMO: la fuente del libro ────────────────────────────────────────

test('SCRUM-325 · 🔴 R5: la entrega SALE del libro de A6, y se nombra la fuente', () => {
  // Si alguien sustituye `leerLibroRegistro` por una consulta propia, este módulo dejaría de
  // entregar EL libro y pasaría a calcular OTRO — que es exactamente lo que 0.3 prohíbe.
  const fuente = fs.readFileSync(new URL('../src/modules/fiscal/librosAeat/librosAeat.repo.ts', import.meta.url), 'utf8');
  assert.match(fuente, /import \{ leerLibroRegistro[^}]*\} from '\.\.\/\.\.\/invoicing\/domain\/libroRegistro\.repo'/,
    '🔴 EL LIBRO YA NO SALE DE `leerLibroRegistro` (SCRUM-296 / A6). Si esta entrega lee las ' +
    'facturas por su cuenta, hay DOS libros de registro en el producto y un día dirán cifras ' +
    'distintas sobre el mismo trimestre.');
  assert.doesNotMatch(fuente, /invoice\.findMany|calcVatBreakdown/,
    '🔴 este módulo está leyendo facturas o repartiendo IVA por su cuenta. Es entrega, no cálculo: ' +
    'el libro lo construye A6.');
});

// ── EL HUECO DECLARADO: no hay libro de RECIBIDAS ──────────────────────────────────────────

test('SCRUM-325 · el hueco de las RECIBIDAS está declarado, no relleno', () => {
  // Medido en SCRUM-321 (E0, Q2): de los 8 datos de un asiento de compra hay 2 completos, 1 a
  // medias y 5 que NO existen (NIF del proveedor, base, tipo, cuota, deducible). Entregar un
  // «libro de recibidas» con `Expense.amount` sería inventarle a alguien sus datos fiscales.
  assert.equal(LIBROS_DISPONIBLES.length, 1,
    '🔴 hay más de un libro ofrecido. Si se ha añadido RECIBIDAS, `Expense` tiene que haber ganado ' +
    'antes NIF de proveedor, base, tipo y cuota de IVA — y eso es schema, que no es de este ticket.');
  assert.equal(LIBROS_DISPONIBLES[0].clave, 'expedidas');
});

test('SCRUM-325 · el nombre del fichero lleva el periodo y NO promete conformidad', () => {
  const n = nombreFicheroExpedidas(2026, 3);
  assert.equal(n, 'yaqu-emitidas-2026-T3.csv');
  assert.doesNotMatch(n, /aeat|libro.?registro/i,
    '🔴 el nombre del fichero promete conformidad fiscal. «La palabra es la promesa» (regla 7): ' +
    'ese nombre lo aprueba el fundador, no este código.');
});
