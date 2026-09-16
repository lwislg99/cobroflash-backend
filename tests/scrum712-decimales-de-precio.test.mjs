// tests/scrum712-decimales-de-precio.test.mjs — SCRUM-712
//
// UN PRECIO CON DECIMALES ILIMITADOS ES LA PUERTA POR LA QUE ENTRA UN NÚMERO QUE NINGÚN
// REDONDEO POSTERIOR PUEDE ARREGLAR, PORQUE EL DESACUERDO YA NACIÓ EN EL DATO.
//
// Medido antes de tocar nada, ejecutando el esquema REAL: `1.23456789` entraba y se guardaba tal
// cual. Y no lo acotaba nadie aguas abajo — `Product.price` es `Decimal(12,2)` y la base trunca en
// silencio, pero el precio de una LÍNEA vive en `Quote.lines`, que es una columna **`Json`**.
//
// ── LA DECISIÓN DEL FUNDADOR (4-sep-2026) ────────────────────────────────────────────────
//   PRECIO UNITARIO → 4 decimales    ·    IMPORTE → 2 decimales
//
// Un importe en euros tiene dos decimales y punto. Un precio unitario no: un electricista compra
// cable a 0,4567 €/m, y acotarlo a 2 le destruiría en silencio precisión que él escribió.
//
// 🔴 Y cuatro decimales EN LA PUERTA no son cuatro aguas abajo: el importe de línea, la base, la
// cuota y el total siguen a DOS, con el redondeo UNA SOLA VEZ Y AL FINAL (SCRUM-293/436). El
// defecto viejo no era que entraran decimales: era redondear en DOS SITIOS con DOS CONVENCIONES.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { fileURLToPath } from 'node:url';
import {
  CreateQuoteSchema, CreateChargeSchema, PSPWebhookSchema,
  DECIMALES_PRECIO_UNITARIO, DECIMALES_IMPORTE,
} from '../dist/core/validation/schemas.js';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ESQUEMAS = path.join(RAIZ, 'src/core/validation/schemas.ts');

const conPrecio = (price) => CreateQuoteSchema.safeParse({
  merchant_id: 1, customer_id: 1, currency: 'EUR',
  lines: [{ concept: 'Cable H07V-K 2,5 mm²', qty: 60, price }],
});
const conCoste = (costeUnitario) => CreateQuoteSchema.safeParse({
  merchant_id: 1, customer_id: 1, currency: 'EUR',
  lines: [{ concept: 'Cable', qty: 1, price: 1, costeUnitario }],
});
const conImporte = (amount) => CreateChargeSchema.safeParse({
  merchant_id: 1, concept: 'Señal', amount, currency: 'EUR',
});
const mensaje = (r) => r.error?.issues?.map((i) => i.message).join(' · ') ?? '';

// ═════════════════════════════════════════════════════════════════════════════════════════
// § 0 · SUELO — el censo de sitios que validan dinero. Cero es CEGUERA, no limpieza.
// ═════════════════════════════════════════════════════════════════════════════════════════

/** Los campos que SON dinero. Por IDENTIDAD de nombre: `price` no puede casar con `priceHistory`. */
const CAMPOS_DE_DINERO = new Set([
  'price', 'unitPrice', 'precio', 'precioUnitario', 'costeUnitario', 'cost', 'coste',
  'amount', 'importe', 'total', 'subtotal', 'salePrice', 'costPrice',
]);

/**
 * Censo de validaciones de dinero en `schemas.ts`, por AST.
 *
 * ⚠️ RECONOCE LAS DOS FORMAS, y no es un detalle: la primera versión sólo buscaba cadenas que
 * empezaran por `z.`, y al envolver los cinco sitios en `conDecimales(…)` **se declaró ciega ella
 * sola**. Eso fue el suelo haciendo su trabajo — pero un censo que sólo ve la forma vieja mide el
 * árbol de ayer.
 */
function censoDeDinero(fuente) {
  const sf = ts.createSourceFile('schemas.ts', fuente, ts.ScriptTarget.Latest, true);
  const out = [];
  const visita = (n) => {
    if (ts.isPropertyAssignment(n) && n.name && n.initializer) {
      const campo = String(n.name.text ?? n.name.escapedText ?? '');
      if (CAMPOS_DE_DINERO.has(campo)) {
        const texto = n.initializer.getText().replace(/\s+/g, ' ');
        if (/^z\.|^conDecimales\(/.test(texto)) {
          out.push({
            campo,
            linea: sf.getLineAndCharacterOfPosition(n.getStart()).line + 1,
            acotado: texto.startsWith('conDecimales('),
            texto: texto.slice(0, 90),
          });
        }
      }
    }
    ts.forEachChild(n, visita);
  };
  ts.forEachChild(sf, visita);
  return out;
}

test('SCRUM-712 · 🔴 SUELO: el censo VE los sitios que validan dinero; cero sería CEGUERA', () => {
  const censo = censoDeDinero(fs.readFileSync(ESQUEMAS, 'utf8'));
  assert.ok(censo.length >= 5,
    `🔴 CIEGO: el censo ha encontrado ${censo.length} validaciones de dinero en \`schemas.ts\` y se `
    + 'midieron 5. Eso no es «está limpio»: es que no ha mirado — los campos se llaman de otra '
    + 'forma, o la validación cambió de envoltorio. Con cero, «todas acotadas» sería verdad y vacía.');

  const sinAcotar = censo.filter((c) => !c.acotado);
  assert.deepEqual(sinAcotar.map((c) => `${c.campo}:${c.linea}`), [],
    '🔴 HAY UN CAMPO DE DINERO SIN ACOTAR DECIMALES:\n'
    + sinAcotar.map((c) => `    schemas.ts:${c.linea}  ${c.campo}: ${c.texto}`).join('\n')
    + '\n  Un número con decimales ilimitados en la puerta es el camino por el que entra un valor\n'
    + '  que ningún redondeo posterior arregla: el desacuerdo nace en el dato. Pásalo por\n'
    + '  `conDecimales(…)` con la escala que le toque — precio unitario 4, importe 2.');
});

test('SCRUM-712 · las dos escalas son las decididas, y son DOS por un motivo', () => {
  assert.equal(DECIMALES_PRECIO_UNITARIO, 4,
    '🔴 el precio unitario ha dejado de admitir 4 decimales. Un electricista compra cable a '
    + '0,4567 €/m: bajarlo a 2 le destruye en silencio precisión que él escribió.');
  assert.equal(DECIMALES_IMPORTE, 2,
    '🔴 un importe en euros tiene DOS decimales. Subirlo reabre la divergencia de SCRUM-624.');
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// § 1 · 🔴 EL ROJO QUE IMPORTA — y el rojo NOMBRA el valor y sus decimales
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-712 · 🔴 un precio con 8 decimales NO entra, y el rojo dice cuál y cuántos', () => {
  const r = conPrecio(1.23456789);
  assert.equal(r.success, false,
    '🔴 `1.23456789` SIGUE ENTRANDO como precio de línea. Se guarda tal cual —`Quote.lines` es '
    + '`Json`, ahí no trunca nadie— y a partir de ahí ningún redondeo posterior puede ponerlo de '
    + 'acuerdo consigo mismo: el desacuerdo ya nació en el dato.');
  assert.match(mensaje(r), /1\.23456789/,
    `🔴 el rojo no NOMBRA el valor: «${mensaje(r)}». «Validación fallida» obliga a quien lo lea a `
    + 'ir a buscar qué número fue.');
  assert.match(mensaje(r), /8 decimales/,
    `🔴 el rojo no dice CUÁNTOS decimales traía: «${mensaje(r)}».`);
  assert.match(mensaje(r), /máximo son 4/,
    `🔴 el rojo no dice cuál es el máximo, así que no dice qué hay que hacer: «${mensaje(r)}».`);
});

test('SCRUM-712 · 🔴 Y CAE CON EL MECANISMO VIEJO: sin acotar, ese mismo valor pasaba', () => {
  // Se ejecuta aquí el esquema de ANTES —`z.number().nonnegative()`— para que quede DEMOSTRADO y
  // no dicho. Si esto empezara a fallar, el rojo de arriba dejaría de probar que acotar añadía algo.
  const zod = ts; // (no se usa: el mecanismo viejo se reconstruye abajo con el zod real)
  void zod;
  return import('zod').then(({ z }) => {
    const comoEraAntes = z.number().nonnegative().optional();
    for (const v of [1.23456789, 30.003, 0.005]) {
      assert.equal(comoEraAntes.safeParse(v).success, true,
        `🔴 el mecanismo viejo ya rechazaba ${v}. Entonces acotar no añadía nada y el rojo de `
        + 'arriba no prueba lo que dice: comprueba qué ha cambiado antes de creerte el verde.');
    }
  });
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// § 2 · CONTROL POSITIVO, ENUMERADO — incluidos los del LÍMITE EXACTO
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-712 · ✅ CONTROL POSITIVO: los precios legítimos siguen entrando, uno por uno', () => {
  const LEGITIMOS = [
    ['0.4567  · 4 decimales, EL LÍMITE EXACTO — el cable del electricista', 0.4567],
    ['30.003  · 3 decimales — el valor de staging de SCRUM-624', 30.003],
    ['9.99    · 2 decimales, el caso normal', 9.99],
    ['12      · entero', 12],
    ['0.0001  · 4 decimales, el más pequeño que cabe', 0.0001],
    ['0       · gratis, que es `nonnegative` y no `positive`', 0],
    ['9999999.9999 · grande y con sus 4', 9999999.9999],
  ];
  for (const [rotulo, v] of LEGITIMOS) {
    const r = conPrecio(v);
    assert.equal(r.success, true,
      `🔴 ACOTAR HA RECHAZADO UN PRECIO VÁLIDO: ${rotulo}.\n    «${mensaje(r)}»\n`
      + '  Si al apretar se cae un caso real, el arreglo está mal: son 4 decimales, no menos.');
    assert.equal(r.data.lines[0].price, v, `🔴 ${rotulo} entra pero llega cambiado`);
  }
  // Y el coste unitario, que comparte escala porque el profesional los ve en la MISMA línea y el
  // margen se deriva de los dos: con coste a 4 y precio a 2 la resta sería asimétrica.
  assert.equal(conCoste(0.4567).success, true, '🔴 el coste unitario no admite sus 4 decimales');
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// § 3 · CONTROL NEGATIVO — cinco decimales no, y un IMPORTE no es un precio
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-712 · 🔴 CONTROL NEGATIVO: 5 decimales NO entran, ni en precio ni en coste', () => {
  const r = conPrecio(1.23456);
  assert.equal(r.success, false, '🔴 `1.23456` (5 decimales) entra como precio: el tope no aprieta.');
  assert.match(mensaje(r), /5 decimales/, `🔴 el rojo no cuenta bien: «${mensaje(r)}»`);
  assert.equal(conCoste(1.23456).success, false, '🔴 el coste unitario acepta 5 decimales');
});

test('SCRUM-712 · 🔴 UN IMPORTE NO ES UN PRECIO: 36.267 no entra en `amount` ni en `total`', () => {
  const r = conImporte(36.267);
  assert.equal(r.success, false,
    '🔴 `36.267` entra como importe de cobro. Un importe en euros tiene DOS decimales: lo que '
    + 'sobra ahí no es precisión, es la divergencia de SCRUM-624 volviendo a nacer.');
  assert.match(mensaje(r), /36\.267/);
  assert.match(mensaje(r), /máximo son 2/, `🔴 el rojo no dice el máximo del IMPORTE: «${mensaje(r)}»`);

  // El webhook del PSP: mismo criterio, y es dinero que viene de FUERA.
  assert.equal(PSPWebhookSchema.safeParse({
    event: 'payment.confirmed', charge_id: '1', amount: 36.267,
  }).success, false, '🔴 el webhook acepta un importe con 3 decimales');

  // Y el tramo del plan de cobro.
  assert.equal(CreateQuoteSchema.safeParse({
    merchant_id: 1, customer_id: 1, currency: 'EUR',
    lines: [{ concept: 'Obra', qty: 1, price: 100 }],
    tiers: [{ id: 't1', label: 'Señal', lines: [{ concept: 'Obra', qty: 1, price: 100 }], total: 36.267 }],
  }).success, false, '🔴 el total de un tramo acepta 3 decimales');

  // CONTROL POSITIVO del mismo camino: con 2 decimales, los tres entran.
  assert.equal(conImporte(36.27).success, true, '🔴 un importe legítimo de 2 decimales no entra');
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// § 4 · ⚠️ EL CASO QUE DECIDE SI EL ARREGLO ES BUENO O SÓLO LO PARECE
//
// Los `number` de coma flotante MIENTEN con los decimales: `1.005` se representa como
// `1.00499999999999989`. Una acotación que cuente decimales sobre el bit acepta o rechaza según
// el valor que toque — y eso es un arreglo que nace roto y VERDE.
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-712 · 🔴 los valores que MIENTEN al representarse: medidos, no supuestos', () => {
  // ① `1.005` y `8.165` tienen 3 decimales ESCRITOS y una representación binaria que no es exacta.
  //    Tienen que ENTRAR: el profesional escribió tres decimales, y tres caben en cuatro.
  for (const v of [1.005, 8.165]) {
    assert.equal(conPrecio(v).success, true,
      `🔴 \`${v}\` ha sido RECHAZADO. Tiene 3 decimales escritos y el tope son 4: lo está `
      + `rechazando su representación binaria (${v.toFixed(20)}), no su valor. La acotación está `
      + 'contando bits en vez de decimales.');
  }

  // ② `0.1 + 0.2` = `0.30000000000000004`: DIECISIETE decimales, y es un valor CALCULADO, no uno
  //    que nadie tecleó. Tiene que quedarse fuera — es exactamente la basura que esta puerta
  //    existe para parar.
  const calculado = 0.1 + 0.2;
  assert.equal(String(calculado), '0.30000000000000004',
    '🔴 este entorno ya no reproduce el clásico de la coma flotante: el control de abajo dejaría '
    + 'de estar midiendo lo que dice.');
  assert.equal(conPrecio(calculado).success, false,
    `🔴 \`${calculado}\` ha ENTRADO. Es un número calculado con 17 decimales, no un precio que `
    + 'alguien escribiera: si pasa la puerta, se guarda y ya no hay redondeo que lo arregle.');

  // ③ El epsilon de 1: `1.0000000000000002`. Mismo caso, por el otro lado del uno.
  assert.equal(conPrecio(1.0000000000000002).success, false,
    '🔴 el épsilon de 1 ha entrado como precio.');
});
