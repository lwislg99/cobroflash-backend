// tests/scrum619-vocabulario-de-linea.test.mjs — SCRUM-619 (carril B)
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// UNA LINEA TIENE DOS VOCABULARIOS, Y NADIE LOS ESTABA COMPARANDO.
//
// SCRUM-616 dejo constancia de que `POST /admin/invoices` descarta en silencio todo lo que no
// sea `concept/qty/price/tax`, y de que por ahi se cae la marca de suplido. Este fichero
// contesta la pregunta que quedaba viva: **¿es `suplido` el unico, y cuantos mas pueden caerse
// manana?**
//
// La respuesta esta MEDIDA, y no se parece a lo que uno esperaria:
//
//   PRESUPUESTO   (CreateQuoteSchema)     concept, price, qty, suplido, tax   ← CINCO
//   FACTURA SUELTA (validarFacturaSuelta) concept, price, qty, tax            ← CUATRO
//   divergencia                           suplido
//
// 🔴 Y LO QUE DE VERDAD IMPORTA: el presupuesto YA TUVO ESTE MISMO FALLO Y LO ARREGLARON.
// `QuoteLineSchema` declara `suplido` a proposito, con el motivo escrito al lado:
//
//     «Sin declararla aqui, `z.object` la BORRA en silencio —zod quita las claves que no
//      conoce— y la casilla del editor no llegaria nunca a `Quote.lines`.»  (SCRUM-500)
//
// O sea: alguien encontro exactamente este defecto en UNA puerta, lo arreglo y dejo escrito por
// que. A la OTRA puerta nadie se lo conto. No es un descuido nuevo: es el mismo descuido, dos
// veces, porque las dos listas de claves se mantienen a mano y por separado.
//
// Por eso lo que aporta este fichero NO es documentar la divergencia de hoy —eso ya lo hace
// scrum616— sino un TRINQUETE: el dia que alguien anada una clave al vocabulario del
// presupuesto (descuentos, etiquetas, nota interna… el bloque 2 va justo de eso), este test cae
// y le obliga a DECIDIR que hace la factura con ella. Hoy esa decision no se toma: no se toma
// porque nadie se entera.
//
// ⛔ ESTE FICHERO NO ARREGLA NADA. Conservar la marca es tocar el camino de emision
// (reglas 29/38) y eso es STOP. Aqui se mide, se fija y se avisa.
//
// ⚠️ SI ESTE FICHERO SALE EN ROJO: casi siempre sera porque alguien ha anadido una clave a
// `QuoteLineSchema`. Eso NO es un fallo: es este test haciendo su trabajo. Lo que toca es
// decidir —y escribir— que hace la factura con esa clave, y luego actualizar la lista de abajo.
// ─────────────────────────────────────────────────────────────────────────────────────────
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { CreateQuoteSchema } from '../dist/core/validation/schemas.js';
import { validarFacturaSuelta } from '../dist/modules/invoicing/domain/facturaSuelta.js';
import { calcVatBreakdown } from '../dist/modules/invoicing/domain/vat.service.js';
import { censarEstrechamientos, FIRMA_LINEA_FACTURA } from './_censo-estrechamientos-linea.mjs';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

// Una linea de suplido REAL, mas una clave que no existe en ninguna parte. La clave inventada es
// la calibracion: si el instrumento no la viera caer, tampoco veria caer una de verdad.
const CLAVE_INVENTADA = 'referenciaProveedor';
const LINEA = Object.freeze({
  concept: 'Tasa municipal', qty: 1, price: 45, tax: 0, suplido: true, [CLAVE_INVENTADA]: 'AY-2026-0044',
});

/**
 * El vocabulario DECLARADO de una línea de presupuesto, leído del propio esquema.
 *
 * 🔴 NACE DE UN ROJO, y es el rojo que exigía el suelo del encargo. La primera versión medía
 * esto POR COMPORTAMIENTO: metía una línea de prueba, parseaba y miraba qué claves salían. Al
 * inyectar `descuentoPct` en `QuoteLineSchema` —la calibración obligatoria— **el trinquete NO
 * cayó**: zod no inventa las claves opcionales que no vienen en la entrada, así que
 * `Object.keys(salida)` sólo enseña lo que la SONDA traía. Yo estaba midiendo mi propia sonda.
 *
 * Y el fallo caía justo donde apunta el ticket: una clave nueva del bloque 2 —descuentos,
 * etiquetas, nota interna— habría entrado sin que nada se enterase, que es exactamente el
 * suceso que este fichero existe para cazar. Un instrumento ciego para su propio caso de uso.
 *
 * Ahora se lee el ESQUEMA: `lines` → array → objeto → `shape`. Y con su suelo, porque si algún
 * día zod cambia de forma interna esto devolvería un conjunto vacío, que se leería como «el
 * presupuesto no acepta ninguna clave» en vez de como «no supe mirar».
 */
function vocabularioDeclaradoPresupuesto() {
  let n = CreateQuoteSchema.shape?.lines;
  const pasos = [];
  for (let i = 0; i < 8 && n; i++) {
    pasos.push(n.constructor?.name ?? '?');
    if (n.shape) return { ok: true, claves: Object.keys(n.shape).sort(), pasos };
    n = n.unwrap?.() ?? n.element ?? n.innerType?.() ?? n._def?.schema ?? n._def?.innerType ?? null;
  }
  return { ok: false, pasos };
}

/** El vocabulario que SOBREVIVE a la puerta del presupuesto, medido por COMPORTAMIENTO. */
function vocabularioPresupuesto(linea) {
  const r = CreateQuoteSchema.safeParse({ merchant_id: 1, customer_id: 1, currency: 'EUR', lines: [linea] });
  if (!r.success) return { ok: false, issues: r.error.issues };
  return { ok: true, claves: Object.keys(r.data.lines[0]).sort() };
}

/** El vocabulario que SOBREVIVE a la puerta de la factura suelta. */
function vocabularioFacturaSuelta(linea) {
  const r = validarFacturaSuelta({ customerId: 7, lines: [linea] });
  if (!r.ok) return { ok: false, error: r.error };
  return { ok: true, claves: Object.keys(r.lineas[0]).sort() };
}

// ── LO FIJADO ────────────────────────────────────────────────────────────────────────────
// 🔴 2-sep-2026 · SCRUM-655 · ENTRA `apartado`, Y LA DECISIÓN QUE ESTE GUARD EXIGE, ESCRITA:
//
// QUÉ HACE LA FACTURA CON ELLA: **nada, y es deliberado, no un olvido.** Un apartado es la
// estructura de lectura del PRESUPUESTO —«1. DEMOLICIONES» y sus partidas 1.01, 1.02—, o sea
// una decisión de cómo se presenta una OFERTA. La factura es otro documento y no la hereda.
//
// Consecuencia, dicha en voz alta porque es justo lo que este guard existe para que no se caiga
// en silencio: al facturar un presupuesto con apartados, `Invoice.lines` recibe las líneas SIN
// las cabeceras y SIN la marca. Los importes NO cambian —las cabeceras nunca sumaron— así que
// no hay un euro en juego; lo que se pierde es el agrupamiento visual del documento.
//
// ⚠️ Y NO SE ARREGLA AQUÍ: tocar la puerta de la factura es camino de emisión y está fuera de
// esta tanda (T6). Queda declarado para que la decisión sea de alguien y no del descuido.
const VOC_PRESUPUESTO = ['apartado', 'concept', 'price', 'qty', 'suplido', 'tax'];
const VOC_FACTURA = ['concept', 'price', 'qty', 'tax'];
// `apartado` se une a `suplido` en la lista de lo que el presupuesto guarda y la factura no.
// Que la lista CREZCA no es neutro: cada entrada es un dato que muere al facturar.
const DIVERGENCIA = ['apartado', 'suplido'];

/**
 * Los sitios que reconstruyen una linea con la firma EXACTA de `Invoice.lines`. Fijado POR
 * FICHERO y no por linea: un numero de linea cambia porque alguien anadio un comentario doce
 * lineas mas arriba, y un guard que cae por eso lo apaga el siguiente que pase (SCRUM-600).
 *
 * El VEREDICTO de cada uno —si pierde algo o no— esta en `docs/master/SCRUM-619.md`, porque es
 * juicio y no derivacion: depende de si la linea que entra traia mas claves. Aqui solo se fija
 * CUANTOS hay y DONDE.
 */
const ESTRECHAMIENTOS = Object.freeze({
  'src/lib/invoicing.ts': 1,
  'src/modules/ai/domain/ai.service.ts': 1,
  'src/modules/invoicing/domain/facturaSuelta.ts': 1,
  'src/modules/invoicing/domain/finalInvoice.service.ts': 2,
  'src/modules/jobs/app/routes/albaranes.routes.ts': 1,
  'src/modules/jobs/domain/albaranAFactura.ts': 2,
  'src/modules/jobs/domain/recapitulativa.service.ts': 1,
  'src/modules/maintenance/domain/maintenance.service.ts': 1,
  'src/modules/products/app/routes/products.routes.ts': 1,
  'src/modules/system/app/routes/invoicesAdmin.routes.ts': 1,
});

// ─────────────────────────────────────────────────────────────────────────────────────────
// SUELO · el instrumento tiene que ALCANZAR las dos puertas y SABER VER que se cae algo.
// ─────────────────────────────────────────────────────────────────────────────────────────
test('SCRUM-619 · SUELO: las dos puertas responden, y las dos tiran una clave inventada', () => {
  const q = vocabularioPresupuesto(LINEA);
  const f = vocabularioFacturaSuelta(LINEA);
  assert.equal(q.ok, true, `🔴 CIEGO: el presupuesto rechaza una linea valida — ${JSON.stringify(q.issues?.slice(0, 2))}`);
  assert.equal(f.ok, true, `🔴 CIEGO: la factura suelta rechaza una linea valida — ${f.error}`);

  // 🔴 LA CALIBRACION QUE EXIGE EL ENCARGO: si el detector no ve caer una clave que nunca ha
  // visto, su «solo se cae suplido» no valdria nada — seria el instrumento, no el codigo.
  assert.equal(q.claves.includes(CLAVE_INVENTADA), false,
    `🔴 CALIBRACION FALLIDA: ${CLAVE_INVENTADA} ha SOBREVIVIDO al presupuesto. `
    + 'O la puerta dejo de filtrar, o no estoy midiendo lo que creo.');
  assert.equal(f.claves.includes(CLAVE_INVENTADA), false,
    `🔴 CALIBRACION FALLIDA: ${CLAVE_INVENTADA} ha SOBREVIVIDO a la factura suelta.`);
});

// ─────────────────────────────────────────────────────────────────────────────────────────
// LOS DOS VOCABULARIOS, Y SU DIVERGENCIA
// ─────────────────────────────────────────────────────────────────────────────────────────
test('SCRUM-619 · SUELO: sé leer el vocabulario DECLARADO del esquema, no sólo mi sonda', () => {
  const d = vocabularioDeclaradoPresupuesto();
  assert.equal(d.ok, true,
    `🔴 CIEGO: no he llegado al \`shape\` de la línea de presupuesto. Pasos: ${d.pasos.join(' → ')}. `
    + 'Un conjunto vacío aquí se leería como «el presupuesto no acepta nada», que es falso.');
  assert.ok(d.claves.length >= 4,
    `🔴 CIEGO: sólo veo ${d.claves.length} claves declaradas (${d.claves.join(', ')})`);
  // Lo declarado tiene que CONTENER lo que de hecho sobrevive. Si no, una de las dos
  // mediciones está mal y no sabría cuál.
  const sobrevive = vocabularioPresupuesto(LINEA);
  assert.equal(sobrevive.ok, true);
  assert.deepEqual(sobrevive.claves.filter((c) => !d.claves.includes(c)), [],
    '🔴 sobrevive una clave que el esquema no declara: las dos mediciones se contradicen');
});

test('SCRUM-619 · 🔴 EL TRINQUETE: el vocabulario del PRESUPUESTO no crece sin que alguien decida', () => {
  const q = vocabularioDeclaradoPresupuesto();
  assert.equal(q.ok, true, '🔴 CIEGO: sin el vocabulario declarado este trinquete no vigila nada');
  assert.deepEqual(q.claves, VOC_PRESUPUESTO,
    `🔴 HA CAMBIADO EL VOCABULARIO DE UNA LINEA DE PRESUPUESTO.\n`
    + `  antes: ${VOC_PRESUPUESTO.join(', ')}\n  ahora: ${q.claves.join(', ')}\n\n`
    + '  Si has ANADIDO una clave, esto NO es un fallo: es el aviso. Falta una decision, y es\n'
    + '  esta: QUE HACE LA FACTURA CON ELLA. Hoy la puerta de la factura suelta acepta cuatro\n'
    + '  claves y TIRA EN SILENCIO todo lo demas — sin error, sin aviso y sin cambiar ningun\n'
    + '  importe. Si no se decide, tu clave nueva llegara a `Quote.lines` y NO a `Invoice.lines`,\n'
    + '  y nadie se enterara. Decide, escribelo, y actualiza esta lista.');
});

test('SCRUM-619 · el vocabulario de la FACTURA SUELTA sigue siendo de cuatro claves', () => {
  const f = vocabularioFacturaSuelta(LINEA);
  assert.deepEqual(f.claves, VOC_FACTURA,
    `🔴 cambio lo que la factura suelta deja pasar: ${f.claves.join(', ')}`);
  // La firma que la casa declara por escrito en `albaranAFactura.ts` es la misma. Si se
  // separaran, habria dos convenciones y ninguna mandaria.
  assert.deepEqual(f.claves, [...FIRMA_LINEA_FACTURA],
    '🔴 la puerta de la factura y la firma declarada en el censo ya no dicen lo mismo');
});

test('SCRUM-619 · 🔴 LA DIVERGENCIA, NOMBRADA: hoy es `suplido`, y es exactamente una', () => {
  // Se compara lo DECLARADO por el presupuesto contra lo que la factura deja pasar: una clave
  // recién declarada y todavía sin usar YA es divergencia, porque el día que alguien la mande
  // se caerá. Esperar a que se use es esperar a perder el primer dato.
  const q = vocabularioDeclaradoPresupuesto();
  const f = vocabularioFacturaSuelta(LINEA);
  assert.equal(q.ok, true, '🔴 CIEGO: sin vocabulario declarado no puedo calcular la divergencia');
  const divergencia = q.claves.filter((c) => !f.claves.includes(c));

  assert.deepEqual(divergencia, DIVERGENCIA,
    `🔴 cambio la divergencia entre las dos puertas.\n`
    + `  antes: ${DIVERGENCIA.join(', ') || '(ninguna)'}\n  ahora: ${divergencia.join(', ') || '(ninguna)'}\n`
    + '  Cada clave de esta lista es un dato que el presupuesto SI guarda y la factura NO.\n'
    + '  Si la lista se ha VACIADO, enhorabuena: alguien lo arreglo, y hay que decirlo en la\n'
    + '  entrada del master en vez de borrar este test.');

  // Y al reves: la factura no acepta nada que el presupuesto no acepte. Si algun dia lo hiciera,
  // habria un dato que solo existe en facturas y el presupuesto no sabria producirlo.
  assert.deepEqual(f.claves.filter((c) => !q.claves.includes(c)), [],
    '🔴 la factura acepta una clave que el presupuesto no: son dos vocabularios que se han cruzado');
});

// ─────────────────────────────────────────────────────────────────────────────────────────
// EL CENSO DE ESTRECHAMIENTOS · cuantos sitios reconstruyen una linea con la firma exacta.
// ─────────────────────────────────────────────────────────────────────────────────────────
test('SCRUM-619 · SUELO del censo: el escaner ve el arbol y ve lineas', () => {
  const r = censarEstrechamientos(RAIZ);
  assert.ok(r.ficheros >= 200, `🔴 ESCANER CIEGO: solo veo ${r.ficheros} ficheros .ts en src/`);
  assert.ok(r.conForma >= 20, `🔴 ESCANER CIEGO: solo veo ${r.conForma} literales con forma de linea`);
});

test('SCRUM-619 · 🔴 no aparece un estrechamiento NUEVO sin que se vea', () => {
  const r = censarEstrechamientos(RAIZ);
  const porFichero = {};
  for (const e of r.estrechamientos) porFichero[e.ruta] = (porFichero[e.ruta] || 0) + 1;

  const nuevos = Object.keys(porFichero).filter((f) => !(f in ESTRECHAMIENTOS));
  assert.deepEqual(nuevos, [],
    `🔴 SITIO NUEVO que reconstruye una linea con la firma de cuatro claves: ${nuevos.join(', ')}.\n`
    + '  Comprueba si la linea que entra traia mas claves: si las traia, se acaban de perder.');

  const cambiados = Object.keys(ESTRECHAMIENTOS)
    .filter((f) => (porFichero[f] || 0) !== ESTRECHAMIENTOS[f])
    .map((f) => `${f}: ${ESTRECHAMIENTOS[f]} → ${porFichero[f] || 0}`);
  assert.deepEqual(cambiados, [],
    `🔴 cambio el numero de estrechamientos por fichero: ${cambiados.join(' · ')}.\n`
    + '  Si BAJA tambien falla, y es a proposito: un estrechamiento que desaparece es un arreglo, '
    + 'y un arreglo sin anotar se deshace solo.');

  const total = Object.values(ESTRECHAMIENTOS).reduce((a, b) => a + b, 0);
  assert.equal(r.estrechamientos.length, total,
    `🔴 el total no cuadra con la suma por fichero: ${r.estrechamientos.length} vs ${total}`);
});

// ─────────────────────────────────────────────────────────────────────────────────────────
// CONTROL POSITIVO · LOS IMPORTES NO CAMBIAN. Este ticket no toca euros.
// ─────────────────────────────────────────────────────────────────────────────────────────
test('SCRUM-619 · ✅ CONTROL POSITIVO: perder la marca NO mueve ningun importe', () => {
  const total = (linea) => {
    const r = validarFacturaSuelta({ customerId: 7, lines: [linea] });
    assert.equal(r.ok, true);
    const bd = calcVatBreakdown(r.lineas);
    return { base: bd.base, cuota: bd.cuota, total: (bd.base + bd.cuota).toFixed(2) };
  };

  const conMarca = total(LINEA);
  const sinMarca = total({ concept: LINEA.concept, qty: LINEA.qty, price: LINEA.price, tax: LINEA.tax });

  assert.deepEqual(conMarca, sinMarca,
    '🔴 la marca de suplido AHORA mueve los importes. Este ticket no toca euros: si un total se '
    + 'ha movido, se ha roto algo o alguien ha cambiado el calculo.');
  assert.equal(conMarca.total, '45.00', '🔴 cambio el total de un documento de un solo suplido');
  assert.equal(conMarca.cuota, 0, '🔴 un suplido ha dejado de ir al 0 %');
});
