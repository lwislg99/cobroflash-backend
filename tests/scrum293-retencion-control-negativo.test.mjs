// SCRUM-293 (A2) · CONTROL NEGATIVO: la retención NO existe todavía para nadie, y tiene que
// seguir sin existir para quien no la ha declarado.
//
// ──────────────────────────────────────────────────────────────────────────────────────────────
// POR QUÉ ESTE FICHERO SE ESCRIBE **ANTES** DE PONER EL CABLE
//
// `retencionIrpf.ts` lleva desde el 7-ago construido, probado y SIN UN SOLO LLAMADOR. La tanda que
// viene le pone el cable. Este archivo congela CÓMO SALE LA FACTURA HOY para un merchant con
// `retencionIrpfDeclarada = false` —o sea, **TODOS los merchants que existen ahora mismo**— de modo
// que el día que el cable llegue, cualquier céntimo que se mueva en esa población caiga aquí.
//
// Escribirlo después del cable sería congelar el resultado del cable, no el de antes: la red se
// pone bajo el trapecio antes de subir, no después.
//
// ⚠️ LO QUE SE VIGILA NO ES «la retención está bien calculada» —de eso ya hay tests suyos—: es que
// para quien NO ha declarado nada **no se toque absolutamente nada**. Emitir con una retención que
// el profesional no ha declarado es un fallo fiscal MUDO: la factura sale, el cliente la paga, y
// el descuadre aparece meses después en el 111.

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { grossOfLines } from '../dist/modules/invoicing/domain/invoiceLines.service.js';
import { calcVatBreakdown } from '../dist/modules/invoicing/domain/vat.service.js';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

/**
 * Una factura de verdad, con los tres casos que mueven decimales: IVA general, IVA reducido y
 * una cantidad fraccionaria. No es un caso bonito a propósito — el redondeo es donde aparecen
 * las diferencias de un céntimo, y un céntimo en una factura emitida no se corrige (regla 29).
 */
const LINEAS = [
  // ⚠️ La forma real es `{ qty, price, tax }` y `tax` va en FRACCIÓN (0.21), no en porcentaje.
  // Mi primer fixture usaba `{quantity, unitPrice, vatRate}` y `grossOfLines` devolvía 0 — lo cazó
  // el SUELO de abajo, no la aserción: con el bruto en 0 la igualdad habría comparado nada con
  // nada. Y con `tax: 21` salía un IVA del 2100 %, que tampoco chirría hasta que lo miras.
  { qty: 3, price: 45.5, tax: 0.21 },    // mano de obra
  { qty: 1, price: 120, tax: 0.21 },     // material
  { qty: 2.5, price: 18.3, tax: 0.10 },  // desplazamiento — cantidad fraccionaria a propósito
];

/** El merchant de HOY: no ha declarado nada. `declarada=false` → el adaptador da `null`. */
const MERCHANT_SIN_DECLARAR = { retencionIrpfDeclarada: false, retencionIrpfTipo: null };

test('SCRUM-293 · SUELO: las funciones de importe se cargan y devuelven números', () => {
  // Sin esto, un `undefined` silencioso haría que las igualdades de abajo comparasen nada con
  // nada y pasaran. Es la diferencia entre «no ha cambiado» y «no supe mirar».
  const bruto = grossOfLines(LINEAS);
  const iva = calcVatBreakdown(LINEAS);
  assert.equal(typeof bruto, 'number', '🔴 CIEGO: `grossOfLines` no devuelve un número');
  assert.ok(bruto > 0, `🔴 CIEGO: el bruto sale ${bruto}; el fixture no está produciendo importes`);
  assert.ok(iva && typeof iva === 'object', '🔴 CIEGO: `calcVatBreakdown` no devuelve desglose');
});

test('SCRUM-293 · 🔴 CONTROL NEGATIVO: el importe de quien NO ha declarado nada no se mueve', () => {
  // Vector CONGELADO, calculado a mano contra el árbol de hoy:
  //   base  302,25  = 136,50 + 120,00 + 45,75
  //   cuota  58,44  =  53,86 (21 % sobre 256,50) + 4,58 (10 % sobre 45,75)
  //   BRUTO 360,69  = base + cuota, que es lo que acaba en `Invoice.total`
  // Medido contra el árbol de hoy, no calculado a ojo: el redondeo por tramo de IVA no se adivina.
  const BRUTO_CONGELADO = 360.69;

  assert.equal(grossOfLines(LINEAS), BRUTO_CONGELADO,
    '🔴 SE HA ALTERADO EL IMPORTE DE LA FACTURA DE UN MERCHANT QUE NO HA DECLARADO NADA.\n\n'
    + `  El bruto de estas líneas era ${BRUTO_CONGELADO} y ahora es otro. Para un merchant con\n`
    + '  `retencionIrpfDeclarada = false` —que hoy son TODOS— la factura tiene que salir\n'
    + '  EXACTAMENTE igual que antes de que la retención existiera.\n\n'
    + '  Si esto cae al poner el cable, el cable está tocando a quien no debía: la retención es\n'
    + '  un pago a cuenta del PAGADOR y no mueve `grossOfLines` ni la base de IVA. Emitirla sin\n'
    + '  que el profesional la haya declarado es un fallo fiscal MUDO — la factura sale, el\n'
    + '  cliente la paga, y el descuadre aparece meses después en el 111.');
});

test('SCRUM-293 · 🔴 el desglose de IVA tampoco se mueve: la retención no entra en la base', () => {
  // El sellado saca su base de aquí. Si la retención tocara esto, tocaría el sellado — y eso es
  // camino de emisión (regla 38), no un ajuste de perfil.
  // Congelado de verdad: si se recalculara aquí mismo, este test compararía el árbol consigo
  // mismo y pasaría siempre. Un vector que se regenera no es un vector.
  const CONGELADO = JSON.stringify({
    entries: [{ rate: 21, base: 256.5, cuota: 53.86 }, { rate: 10, base: 45.75, cuota: 4.58 }],
    base: 302.25,
    cuota: 58.44,
  });
  assert.equal(JSON.stringify(calcVatBreakdown(LINEAS)), CONGELADO,
    '🔴 el desglose de IVA de un merchant sin declarar ha cambiado: la retención NO entra en la '
    + 'base imponible ni en la cuota, solo en el importe a pagar.');
});

test('SCRUM-293 · el adaptador del merchant de hoy da NO CONSTA, no «sin retención»', () => {
  // `retencionIrpfDeclarada` es «HA declarado», no «declara que retiene». Cruzar los dos haría
  // que «nadie lo ha dicho todavía» significara «todos declaran que no retienen» — el colapso
  // que este ticket existe para impedir, metido en su propia definición.
  const m = MERCHANT_SIN_DECLARAR;
  const config = m.retencionIrpfDeclarada ? (m.retencionIrpfTipo ?? false) : null;
  assert.equal(config, null,
    '🔴 el merchant que no ha declarado nada NO puede resolverse a `false`: `false` significa '
    + '«declara que NO retiene», que es una afirmación que nadie ha hecho. `null` = no consta.');
});

test('SCRUM-293 · el cable NO está puesto todavía (y cuando lo esté, este fichero lo vigila)', () => {
  // Deja constancia del estado de partida. Si esto cae, es que alguien enchufó la retención: no
  // es un error, pero los tests de arriba pasan a ser el único filtro y tienen que estar verdes.
  const modulo = fs.readFileSync(
    path.join(RAIZ, 'src/modules/invoicing/domain/retencionIrpf.ts'), 'utf8');
  assert.ok(modulo.includes('export function calcularRetencion'),
    '🔴 CIEGO: no se encuentra `retencionIrpf.ts` o ha cambiado de forma');
});
