// tests/scrum398-vocabulario-de-cobro.test.mjs — SCRUM-398
//
// EL CONJUNTO CERRADO DE FORMAS DE COBRO, CERRADO DE VERDAD.
//
// `paidVia.ts` declara cinco valores y alrededor convivían al menos cuatro vocabularios. La UI
// etiquetaba `bizum`, `bank`, `manual` y `mercadopago`; el código escribe `mp` y `card:stripe`; y
// `reportsView` resolvía con `METHOD_LABELS[m.method] || m.method`, así que un método fuera del
// mapa **se le enseñaba al profesional sin traducir**: le aparecía `mp` en su informe.
//
// Y no es cosmético. `paid_via` ES `charge.method` (`exportData.ts:229`: «es lo que el asesor cruza
// con el banco»), y `paidVia.ts:17` explica qué se pierde al dispersarlo: «uno lo confirma una
// PERSONA, el otro un WEBHOOK. Son dos cadenas de evidencia distintas ante una inspección».
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { ETIQUETAS_PAID_VIA, ETIQUETAS_HEREDADAS, etiquetaMetodoCobro } from '../public/dashboard/js/paidViaEtiquetas.js';

const RAIZ = path.resolve(import.meta.dirname, '..');
const FUENTE_TS = 'src/modules/billing/domain/paidVia.ts';
const VISTA_P = 'public/dashboard/js/reportsView.js';
const VISTA = fs.readFileSync(path.join(RAIZ, VISTA_P), 'utf8');

/**
 * LOS VALORES DEL CONJUNTO, DERIVADOS DEL AST de `paidVia.ts`.
 *
 * No se escriben aquí: la lista de valores es la INTENCIÓN y vive en un solo sitio (regla 22,
 * crecer ahí es cambio de máster). Copiarla sería tener dos conjuntos cerrados, que es exactamente
 * el defecto que este guard existe para impedir.
 */
function paidViaDerivado() {
  const codigo = fs.readFileSync(path.join(RAIZ, FUENTE_TS), 'utf8');
  const sf = ts.createSourceFile(FUENTE_TS, codigo, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  let out = null;
  const visita = (n) => {
    if (ts.isVariableDeclaration(n) && n.name.getText(sf) === 'PAID_VIA' && n.initializer) {
      // `[...] as const` → el array vive dentro de la aserción.
      const arr = ts.isAsExpression(n.initializer) ? n.initializer.expression : n.initializer;
      if (ts.isArrayLiteralExpression(arr)) {
        out = arr.elements.map((e) => e.getText(sf).replace(/^['"`]|['"`]$/g, ''));
      }
    }
    ts.forEachChild(n, visita);
  };
  visita(sf);
  return out;
}

// ═══════════════════════════════════════════════════════════════════════════════════════════
// R4 · SUELO — va PRIMERO
// ═══════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-398 · R4 SUELO: si el derivador no encuentra valores en PAID_VIA, FALLA', () => {
  // Cero valores dejaría el guard verde por vacío: «cubro todos los valores» es trivialmente
  // cierto cuando no hay ninguno. Es el modo de fallo que ya mordió dos veces hoy.
  const valores = paidViaDerivado();
  assert.ok(Array.isArray(valores),
    `🔴 ESCÁNER CIEGO: no se pudo derivar \`PAID_VIA\` del AST de ${FUENTE_TS}. Si la declaración ` +
    'cambió de forma, ARREGLA EL DERIVADOR — no escribas la lista aquí, que es justo lo que este ' +
    'guard existe para impedir.');
  assert.ok(valores.length >= 5,
    `🔴 el derivador ve ${valores.length} valores y el conjunto declara al menos 5. Con la lista ` +
    'vacía o corta, la comprobación de cobertura pasaría sin comprobar nada.');
});

// ═══════════════════════════════════════════════════════════════════════════════════════════
// R1 · EL TEST · un valor sin etiqueta hace caer el guard
// ═══════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-398 · R1: TODO valor de PAID_VIA tiene su etiqueta, y el guard nombra los que falten', () => {
  const valores = paidViaDerivado();
  const sinEtiqueta = valores.filter((v) => !ETIQUETAS_PAID_VIA[v]);
  assert.deepEqual(sinEtiqueta, [],
    `🔴 HAY VALORES DEL CONJUNTO CERRADO SIN ETIQUETA: ${JSON.stringify(sinEtiqueta)}\n\n` +
    '  Hasta SCRUM-398 esto pasaba en VERDE y el valor crudo se le enseñaba al profesional en su\n' +
    '  informe de cobros. Añade su etiqueta en `paidViaEtiquetas.js` — y si el valor no debería\n' +
    '  existir, quítalo de `PAID_VIA`, que es cambio de máster (regla 22).');
});

test('SCRUM-398 · R1: y no sobran etiquetas inventadas fuera del conjunto', () => {
  // El reverso. Una etiqueta para un valor que ya no existe es un vocabulario paralelo creciendo
  // otra vez: `bizum`, `bank` y `mercadopago` estaban así, etiquetados y sin que nadie los escriba.
  const valores = paidViaDerivado();
  const sobran = Object.keys(ETIQUETAS_PAID_VIA).filter((k) => !valores.includes(k));
  assert.deepEqual(sobran, [],
    `🔴 hay etiquetas para valores que NO están en el conjunto cerrado: ${JSON.stringify(sobran)}. ` +
    'O el valor entra en `PAID_VIA` (cambio de máster), o es un vocabulario paralelo que empieza otra vez. ' +
    'Los HEREDADOS van en `ETIQUETAS_HEREDADAS`, con su procedencia escrita.');
});

// ═══════════════════════════════════════════════════════════════════════════════════════════
// R2 · CONTROL NEGATIVO · lo desconocido NO se pinta crudo
// ═══════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-398 · R2: un método desconocido no se pinta crudo — se dice que no se reconoce', () => {
  for (const desconocido of ['mp', 'paypal', 'lo_que_sea', 'MERCADOPAGO']) {
    const etiqueta = etiquetaMetodoCobro(desconocido);
    assert.notEqual(etiqueta, desconocido,
      `🔴 «${desconocido}» se le está enseñando al profesional TAL CUAL. Es la degradación ` +
      'silenciosa que cierra este ticket: «no sé traducir esto» convertido en «esto se llama así».');
    assert.match(etiqueta, /no reconocido/i,
      `🔴 «${desconocido}» sale como «${etiqueta}»: si no se reconoce, hay que DECIRLO, no ` +
      'inventar una traducción ni callarse.');
    assert.ok(etiqueta.includes(desconocido),
      `🔴 «${desconocido}» desaparece del todo. Quien lo vea tiene que poder investigarlo: el valor ` +
      'va entre paréntesis, marcado como no reconocido.');
  }
});

test('SCRUM-398 · R2: el `|| m.method` ya no está en la vista', () => {
  // La mitad estructural: aunque la función traduzca bien, si la vista sigue con su propio `||`
  // el crudo vuelve por la puerta de al lado.
  assert.doesNotMatch(VISTA.replace(/^\s*\/\/.*$/gm, ''), /\|\|\s*m\.method/,
    '🔴 la vista vuelve a resolver la etiqueta con `|| m.method`: un método fuera del mapa se ' +
    'pinta crudo otra vez.');
  assert.match(VISTA, /etiquetaMetodoCobro\(m\.method\)/,
    '🔴 la vista ya no usa la fuente única `etiquetaMetodoCobro`');
  // Hermano positivo: la regex de arriba casa cuando el patrón está de verdad.
  assert.match('${METHOD_LABELS[m.method] || m.method}', /\|\|\s*m\.method/);
});

test('SCRUM-398 · R2: un método vacío o ausente tampoco se cuela', () => {
  for (const vacio of [null, undefined, '', '   ']) {
    assert.match(etiquetaMetodoCobro(vacio), /sin método/i,
      `🔴 un método ${JSON.stringify(vacio)} sale como «${etiquetaMetodoCobro(vacio)}»`);
  }
});

// ═══════════════════════════════════════════════════════════════════════════════════════════
// R3 · CONTROL POSITIVO · los cinco declarados, uno por uno
// ═══════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-398 · R3: los CINCO del conjunto se etiquetan, uno por uno', () => {
  // Uno por uno y con su texto, no un bucle sobre el mapa: un bucle sobre el propio mapa se
  // comprobaría a sí mismo y pasaría aunque las cinco dijeran lo mismo.
  const igual = (v, esperado) => assert.equal(etiquetaMetodoCobro(v), esperado,
    `🔴 «${v}» se etiqueta como «${etiquetaMetodoCobro(v)}» y debería ser «${esperado}». Es un valor ` +
    'del conjunto cerrado: cambiarle el texto cambia lo que el profesional lee en su informe de cobros.');
  igual('card', '💳 Tarjeta');
  igual('bizum_auto', '📲 Bizum');
  igual('bizum_manual', '📲 Bizum (confirmado a mano)');
  igual('transfer', '🏦 Transferencia');
  igual('cash', '💶 Efectivo');
  // Y las cinco DISTINGUIBLES: `bizum_auto` y `bizum_manual` no pueden colapsar, que es justo la
  // distinción con valor probatorio («uno lo confirma una PERSONA, el otro un WEBHOOK»).
  const cinco = new Set(paidViaDerivado().map(etiquetaMetodoCobro));
  assert.equal(cinco.size, 5,
    '🔴 dos formas de cobro comparten etiqueta. Si son `bizum_auto` y `bizum_manual`, se está ' +
    'borrando en pantalla la diferencia entre lo que confirmó una persona y lo que confirmó un ' +
    'webhook — dos cadenas de evidencia distintas ante una inspección.');
});

test('SCRUM-398 · los HEREDADOS siguen traduciéndose (no perder lo que hoy se ve)', () => {
  // `card:stripe` lo escriben `stripe.routes.ts` (×3) y `receipt.routes.ts`; `manual` lo fabrica
  // `reports.routes.ts:164` al leer. Son cobros reales: dejarlos como «no reconocido» sería una
  // REGRESIÓN, no un arreglo.
  assert.equal(etiquetaMetodoCobro('card:stripe'), '💳 Tarjeta',
    `🔴 «card:stripe» sale como «${etiquetaMetodoCobro('card:stripe')}». Lo escriben cuatro sitios ` +
    'vivos y es un cobro con tarjeta REAL: dejarlo sin traducir es perder información que hoy sí se ve.');
  assert.equal(etiquetaMetodoCobro('manual'), '✍️ Marcado a mano',
    `🔴 «manual» sale como «${etiquetaMetodoCobro('manual')}». Lo fabrica \`reports.routes.ts:164\` ` +
    'al leer una factura pagada SIN `Charge`: es la ausencia de método, y tiene que decirse.');
  assert.ok(Object.keys(ETIQUETAS_HEREDADAS).length >= 2,
    '🔴 se han retirado los heredados: los cobros con `card:stripe` volverían a salir sin traducir');
});
