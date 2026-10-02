// tests/scrum1252-evidencias-libro-solo-facturas.test.mjs — SCRUM-1252 · el libro que va DENTRO del
// paquete de evidencias son las FACTURAS; el 303 del mismo paquete no se mueve.
//
// Los cuatro primeros casos los escribió J6d el 1-oct-2026 como test PROPUESTO (vivía en
// `docs/master/evidencias/SCRUM-1252/` porque contra `main` salía 2 de 4 en rojo). Entran en `tests/`
// con la línea de `paquete.repo.ts` que los pone verdes (SCRUM-1252b), sin cambiarles un aserto.
//
// 🔴 LA LÍNEA Y EL LITERAL ENTRAN JUNTOS (fundador, SCRUM-1252 comentario 17726). Con el filtro, el
// justificante sale del libro del ZIP pero su IVA sigue en el 303 del mismo ZIP: el libro deja de
// sumar lo que su 303. La línea sola convertiría un descuadre visible en uno invisible, así que el
// paquete lo DICE, con el texto firmado, en `avisos`. Los tres últimos casos vigilan eso: que el
// aviso sale cuando hay algo fuera, que no sale cuando no lo hay, y que es letra a letra el de su ficha.
//
// De los tres sitios que nombraba el ticket, sólo éste quedaba vivo (comentarios 17451 y 17452):
// la lista de Facturas estaba bien y la pantalla de Informes es «lo que va al 303». El paquete de
// evidencias lleva su propio `libro-registro.csv` y su propio `indice.csv`, y los dos salen del
// libro que lee `leerPaqueteEvidencias`.
//
// El criterio NO se escribe aquí: es el de SCRUM-1232 (`soloFacturas`, que decide por `type` y sólo
// por `type`). Una `F1` con número `J-` es una FACTURA (fundador, 28-sep-2026) y se queda.
//
// ⚠️ SE MIDE EJECUTANDO EL CAMINO REAL: `leerPaqueteEvidencias` de `dist/`, con un cliente Prisma
// falso en memoria. Ninguna base. La muestra es la de SCRUM-1232, para que los dos tests hablen de
// los mismos documentos.
//
// Las comprobaciones comparan la LISTA ENTERA de números, no la ausencia de uno: así el mismo aserto
// cae si entra un justificante y cae si se pierde una factura.
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { aprobacionesDeMicrocopy } from './_microcopy-aprobada.mjs';

const RAIZ = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const require = createRequire(path.join(RAIZ, 'package.json'));

const MIO = 7;
const OTRO = 8;
const DIA = new Date('2026-08-10T10:00:00.000Z'); // 3T-2026
const PERIODO = { merchantId: MIO, año: 2026, trimestre: 3 };

const fila = (id, merchantId, number, type, precio) => ({
  id, merchantId, number, createdAt: DIA, paidAt: DIA, type,
  total: Math.round(precio * 121) / 100, currency: 'EUR', status: 'paid',
  customerId: null, quoteId: null, chargeId: null, albaranRefs: null,
  lines: [{ concept: 'Trabajo', qty: 1, price: precio, tax: 0.21 }],
});

/** La muestra. Cada fila está por un motivo, y el motivo va al lado. */
const FILAS = [
  fila(1, MIO, 'F260001', 'F1', 100),           // factura normal: TIENE que seguir (el positivo)
  fila(2, MIO, 'J-2026-0001', 'JUST', 200),     // justificante por `type`: fuera del libro, dentro del 303
  fila(3, MIO, 'J-20260805-AB12', 'F1', 50),    // `F1` con número `J-`: es FACTURA y se queda
  fila(4, MIO, 'R260001', 'R1', -100),          // rectificativa: es factura, sigue
  fila(5, MIO, null, 'F1', 10),                 // sin número: nunca fue asiento
  fila(6, OTRO, 'J-2026-0099', 'JUST', 999),    // otro merchant: la consulta ni lo trae
];
const JUSTIFICANTE_MIO = 'J-2026-0001';
const FACTURAS_QUE_QUEDAN = ['F260001', 'J-20260805-AB12', 'R260001'];
// Lo que el libro traía ANTES de filtrar, en su orden (misma fecha → por número).
const TODO_LO_NUMERADO = ['F260001', 'J-2026-0001', 'J-20260805-AB12', 'R260001'];

function clienteFalso(filas = FILAS) {
  return {
    invoice: { findMany: async (a) => filas.filter((r) => r.merchantId === (a.where ?? {}).merchantId) },
    quote: { findMany: async () => [] },
    albaran: { findMany: async () => [] },
    expense: { findMany: async () => [] },
    job: { findMany: async () => [] },
    customer: { findMany: async () => [] },
    merchant: { findUnique: async () => ({ id: MIO, country: 'ES', name: 'Muestra', legalName: null, taxId: null }) },
  };
}

const { leerPaqueteEvidencias } = require('./dist/modules/fiscal/evidencias/paquete.repo.js');
const { construirPaqueteEvidencias, FICHEROS, AVISO_LIBRO_SOLO_FACTURAS } = require('./dist/modules/fiscal/evidencias/paquete.js');
const { leerLibroRegistro } = require('./dist/modules/invoicing/domain/libroRegistro.repo.js');
const { leerModelo303 } = require('./dist/modules/fiscal/modelo303/modelo303.repo.js');
const { rangoTrimestre } = require('./dist/modules/fiscal/modelo303/modelo303.js');

const fichero = (paquete, nombre) => {
  const f = paquete.ficheros.find((x) => x.nombre === nombre);
  assert.ok(f, `🔴 el paquete no lleva «${nombre}»: el test no está midiendo esa pieza.`);
  return f.contenido;
};
/** Las filas de datos de un CSV del paquete (sin BOM ni cabecera), ya troceadas por `;`. */
const filasCsv = (contenido) => (contenido.charCodeAt(0) === 0xFEFF ? contenido.slice(1) : contenido).split('\r\n').slice(1)
  .filter((l) => l.length > 0).map((l) => l.split(';'));
const primeraColumna = (contenido) => filasCsv(contenido).map((c) => c[0]);

/**
 * El paquete tal como salía ANTES: el libro entero, sin filtrar. Se arma con las MISMAS piezas
 * reales (lector, 303 y constructor); lo único que cambia es que al libro no se le pide el filtro.
 * Es el testigo de que la muestra contiene de verdad un justificante que el paquete sabría pintar.
 */
async function paqueteSinFiltrar() {
  const db = clienteFalso();
  const { desde, hasta } = rangoTrimestre(PERIODO.año, PERIODO.trimestre);
  return construirPaqueteEvidencias({
    libro: await leerLibroRegistro(db, { merchantId: MIO, desde, hasta }),
    modelo303: await leerModelo303(db, PERIODO),
    albaranes: [],
    informeVerificacion: { examinados: 0, cuadran: 0, hallazgos: [], versionesNoSoportadas: [], conclusion: 'no_se_pudo_mirar' },
    merchantId: MIO,
    periodo: { desde: desde.toISOString(), hasta: hasta.toISOString(), año: PERIODO.año, trimestre: PERIODO.trimestre },
  });
}

test('SCRUM-1252 · SUELO: sin filtrar, el paquete SÍ pinta el justificante — la muestra no está ciega', async () => {
  const antes = await paqueteSinFiltrar();
  assert.deepEqual(primeraColumna(fichero(antes, FICHEROS.libro)), TODO_LO_NUMERADO,
    '🔴 el libro sin filtrar no trae lo que la muestra tiene: el resto de casos no miden nada.');
  assert.deepEqual(primeraColumna(fichero(antes, FICHEROS.indice)), TODO_LO_NUMERADO);
  assert.ok(TODO_LO_NUMERADO.includes(JUSTIFICANTE_MIO));
});

test('SCRUM-1252 · el `libro-registro.csv` del paquete son las FACTURAS, y todas', async () => {
  const paquete = await leerPaqueteEvidencias(clienteFalso(), PERIODO);
  assert.deepEqual(primeraColumna(fichero(paquete, FICHEROS.libro)), FACTURAS_QUE_QUEDAN,
    '🔴 el libro del paquete de evidencias no es la lista de facturas del periodo. Si sobra ' +
    `«${JUSTIFICANTE_MIO}», el paquete lee el libro sin \`soloFacturas\` (RIVA 63: el libro son las ` +
    'facturas expedidas). Si falta una, el filtro se lleva de más — y una `F1` con número `J-` es una ' +
    'FACTURA (fundador, 28-sep-2026): el criterio es el `type`, no el número.');
});

test('SCRUM-1252 · el `indice.csv` del paquete lleva una fila por FACTURA', async () => {
  const paquete = await leerPaqueteEvidencias(clienteFalso(), PERIODO);
  assert.deepEqual(primeraColumna(fichero(paquete, FICHEROS.indice)), FACTURAS_QUE_QUEDAN,
    '🔴 el índice del paquete no coincide con las facturas del periodo.');
  assert.equal(paquete.resumen.asientos, FACTURAS_QUE_QUEDAN.length);
});

test('SCRUM-1252 · ⛔ el 303 del paquete es IDÉNTICO con filtro y sin él, y sigue llevando el IVA del justificante', async () => {
  const paquete = await leerPaqueteEvidencias(clienteFalso(), PERIODO);
  const antes = await paqueteSinFiltrar();
  const csv303 = fichero(paquete, FICHEROS.modelo303);
  assert.equal(csv303, fichero(antes, FICHEROS.modelo303),
    '🔴 el `modelo-303.csv` del paquete ha cambiado al filtrar el libro. El 303 declara lo DEVENGADO, ' +
    'no lo documentado (LIVA 75/167): sacarle el justificante INFRADECLARA.');

  // Y que «idéntico» no sea «idénticamente vacío»: la fila TOTAL lleva la base de TODO lo numerado,
  // justificante incluido. Lo esperado se deriva de la muestra.
  const base = FILAS.filter((r) => r.merchantId === MIO && r.number).reduce((s, r) => s + r.lines[0].price, 0);
  const total = filasCsv(csv303).find((c) => c[3] === 'TOTAL');
  assert.ok(total, '🔴 el 303 del paquete no trae su fila TOTAL.');
  assert.equal(total[4], base.toFixed(2).replace('.', ','),
    '🔴 la base total del 303 del paquete no es la de todo lo devengado en la muestra.');
  assert.equal(base, 250, 'la muestra ha cambiado: 100 + 200 (justificante) + 50 − 100.');
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// SCRUM-1252b · LA LÍNEA NO ENTRA SOLA: EL PAQUETE DICE LO QUE DEJA FUERA
// ═════════════════════════════════════════════════════════════════════════════════════════

const RANURA = 'libro-solo-facturas';
const avisosDelManifiesto = (paquete) => JSON.parse(fichero(paquete, FICHEROS.manifiesto)).avisos;
/** Las veces que ESTE aviso sale en una lista de avisos: se compara la lista, no una ausencia. */
const esteAviso = (avisos) => avisos.filter((a) => a === AVISO_LIBRO_SOLO_FACTURAS);
const numero = (celda) => Number(String(celda).replace(',', '.'));
/** La suma de la columna `base` del libro del paquete, y la base TOTAL de su 303. */
const baseDelLibro = (paquete) => filasCsv(fichero(paquete, FICHEROS.libro)).reduce((s, c) => s + numero(c[4]), 0);
const baseDel303 = (paquete) => numero(filasCsv(fichero(paquete, FICHEROS.modelo303)).find((c) => c[3] === 'TOTAL')[4]);
const BASE_DEL_JUSTIFICANTE = FILAS.find((r) => r.number === JUSTIFICANTE_MIO).lines[0].price;
const SIN_JUSTIFICANTE_MIO = FILAS.filter((r) => r.number !== JUSTIFICANTE_MIO);

test('SCRUM-1252 · 🔴 la línea no entra sola: con un justificante fuera del libro, el paquete lo DICE en `avisos` y dentro del ZIP', async () => {
  const paquete = await leerPaqueteEvidencias(clienteFalso(), PERIODO);

  // El descuadre que el aviso explica EXISTE en esta muestra: al libro del ZIP le falta, respecto
  // al 303 del mismo ZIP, exactamente la base del justificante.
  assert.equal(baseDel303(paquete) - baseDelLibro(paquete), BASE_DEL_JUSTIFICANTE,
    '🔴 el libro y el 303 del paquete no se separan por la base del justificante: la muestra ya no ' +
    'reproduce el descuadre y este caso no mide nada.');
  assert.equal(BASE_DEL_JUSTIFICANTE, 200, 'la muestra ha cambiado: el justificante propio era de 200.');

  assert.deepEqual(esteAviso(paquete.avisos), [AVISO_LIBRO_SOLO_FACTURAS],
    '🔴 el paquete deja un justificante fuera del libro y NO lo dice. Su IVA sigue en el 303 del mismo ' +
    'ZIP: quien sume los dos documentos ve dos totales y nada le explica por qué. La línea de ' +
    '`paquete.repo.ts` y este aviso entran juntos (fundador, SCRUM-1252 comentario 17726).');
  assert.deepEqual(esteAviso(avisosDelManifiesto(paquete)), [AVISO_LIBRO_SOLO_FACTURAS],
    '🔴 el aviso está en el objeto pero no viaja DENTRO del ZIP (`manifiesto.json`): quien abre el ' +
    'paquete no lo lee.');
});

test('SCRUM-1252 · CONTROL: sin nada fuera del libro, el aviso NO sale — ni sin justificantes, ni con el libro sin filtrar', async () => {
  // (a) El camino real, con una muestra SIN justificante propio (el del otro merchant sigue ahí).
  const limpio = await leerPaqueteEvidencias(clienteFalso(SIN_JUSTIFICANTE_MIO), PERIODO);
  assert.deepEqual(primeraColumna(fichero(limpio, FICHEROS.libro)), FACTURAS_QUE_QUEDAN);
  assert.equal(baseDel303(limpio), baseDelLibro(limpio),
    '🔴 sin justificantes, el libro y el 303 del paquete tienen que sumar la misma base.');
  assert.deepEqual(esteAviso(limpio.avisos), [],
    '🔴 el aviso sale sin que el libro haya dejado nada fuera: explica un descuadre que no existe.');
  assert.deepEqual(esteAviso(avisosDelManifiesto(limpio)), []);

  // (b) El paquete como salía ANTES (libro sin filtrar): el justificante está en el libro, los dos
  // documentos suman lo mismo y no hay nada que explicar.
  const antes = await paqueteSinFiltrar();
  assert.equal(baseDel303(antes), baseDelLibro(antes));
  assert.deepEqual(esteAviso(antes.avisos), []);

  // El mismo instrumento SÍ ve el aviso cuando toca: sin esto, las listas vacías de arriba podrían
  // ser un filtro que no encuentra nunca nada.
  const conJustificante = await leerPaqueteEvidencias(clienteFalso(), PERIODO);
  assert.equal(esteAviso(conJustificante.avisos).length, 1);
});

test('SCRUM-1252 · el aviso es, letra a letra, el texto que firmó el fundador (su ficha de `docs/microcopy/`)', () => {
  const ficha = aprobacionesDeMicrocopy().find((a) => a.ticket === 'SCRUM-1252' && a.ranura === RANURA);
  assert.ok(ficha, '🔴 no encuentro la ficha de la firma de este texto en docs/microcopy/.');
  assert.equal(ficha.aprobada, true, '🔴 la ficha existe pero su firma no cuenta como aprobación.');
  // Un texto firmado largo va ENTERO en UNA línea de cita y el código lo pinta en un solo literal
  // (SCRUM-1329): ni se parte ni se reescribe para que quepa.
  assert.deepEqual(ficha.literales, [AVISO_LIBRO_SOLO_FACTURAS],
    '🔴 el aviso que emite el código no es, letra a letra, el que consta firmado en su ficha ' +
    '(regla 39: ni una palabra distinta sin volver a firmar).');
});
