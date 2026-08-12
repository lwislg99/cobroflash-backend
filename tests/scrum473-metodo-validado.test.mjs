// tests/scrum473-metodo-validado.test.mjs — SCRUM-473 / SCRUM-474
//
// El conjunto cerrado de la regla 22 existía, estaba bien argumentado, y **no lo consumía nadie**:
// `PAID_VIA` no aparecía fuera de su propio fichero. Un conjunto sin mecanismo deriva, y derivó —
// en producción hay `card:stripe` y `bizum`, que no están en él.
//
// 🔴 EL SUELO SE CALIBRA CONTRA LOS 9 ESCRITORES, NO CONTRA LOS 5 VALORES DE PRODUCCIÓN.
// `mp` y `bank` no aparecen en los datos y sí en el árbol: un guard calibrado con lo observado
// nace ciego a lo que todavía no se ha ejercido.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const RAIZ = path.resolve(import.meta.dirname, '..');
const { PAID_VIA } = await import('../dist/modules/billing/domain/paidVia.js');
const { esMetodoValido, partirMetodo, metodoParaAgrupar, metodoDesdeMercadoPago, METODO_DESCONOCIDO } =
  await import('../dist/modules/billing/domain/metodoDeCobro.js');

const leer = (rel) => fs.readFileSync(path.join(RAIZ, rel), 'utf8');

// ── SUELO ────────────────────────────────────────────────────────────────────────────────────

test('SCRUM-473 · SUELO: el validador CONSUME PAID_VIA, no una copia', () => {
  const fuente = leer('src/modules/billing/domain/metodoDeCobro.ts');
  assert.match(fuente, /import \{ PAID_VIA[\s\S]*?\} from '\.\/paidVia'/,
    '🔴 el validador no importa `PAID_VIA`. Una segunda lista es exactamente cómo esto vuelve a ' +
    'pasar dentro de tres meses — el defecto que este ticket denuncia, cometido en su arreglo.');

  // Y que la lista no esté además copiada a mano en el fichero.
  for (const v of PAID_VIA) {
    const copias = fuente.split(`'${v}'`).length - 1;
    assert.ok(copias === 0 || v === 'transfer' || v === 'cash' || v === 'card',
      `🔴 «${v}» aparece escrito a mano en el validador: eso es la copia que no puede haber.`);
  }
  assert.ok(PAID_VIA.length >= 5, `🔴 PAID_VIA solo trae ${PAID_VIA.length} valores: no se ha leído bien.`);
});

test('SCRUM-473 · SUELO: los NUEVE escritores siguen siendo los que el censo encontró', () => {
  // Si aparece un escritor nuevo, este número deja de cuadrar y alguien tiene que mirarlo. El
  // censo se hizo con DOS instrumentos porque el AST solo veía 2 de los 9.
  const escritores = [
    ['src/modules/billing/app/routes/charges.routes.ts', /methodPref === 'card'/],
    ['src/modules/billing/app/routes/receipt.routes.ts', /method: 'card:stripe'/],
    ['src/modules/billing/app/routes/stripe.routes.ts', /method: 'card:stripe'/],
    // SCRUM-489 · era `/method: 'mp'/`. Ese literal se escribía en el `update` que marca el cobro
    // como PAGADO, y `'mp'` no está en `PAID_VIA`: era un `paid_via` falso, no una preferencia.
    // Ahora consume el método que `getMpPayment()` ya traducía tres líneas antes. El escritor
    // sigue siendo el mismo fichero — lo que cambió es que dejó de inventarse el valor.
    ['src/modules/billing/app/routes/mpWebhook.routes.ts', /method: payment\.method/],
    ['src/modules/billing/app/routes/psp.routes.ts', /esMetodoValido\(body\.method\)/],
    ['src/modules/billing/app/routes/chargesAdmin.routes.ts', /method: 'bizum_manual'/],
    ['src/integrations/mercadopago.ts', /metodoDesdeMercadoPago\(/],
  ];
  for (const [rel, patron] of escritores) {
    assert.match(leer(rel), patron, `🔴 el escritor de «${rel}» ya no es el que el censo midió.`);
  }
});

// ── LA FORMA ─────────────────────────────────────────────────────────────────────────────────

test('SCRUM-474 · 🔴 la forma es `<metodo>[:<pasarela>]` con el método en PAID_VIA', () => {
  // ✅ PASAN: el método solo, y el método con pasarela. `card:stripe` NO se normaliza destruyendo
  // —se perdería la pasarela, que hoy solo vive ahí—: pasa porque `card` está en el conjunto.
  for (const v of PAID_VIA) assert.equal(esMetodoValido(v), true, `🔴 «${v}» es de PAID_VIA y no pasa.`);
  assert.equal(esMetodoValido('card:stripe'), true,
    '🔴 `card:stripe` no pasa. Rechazarlo ROMPERÍA los cobros con tarjeta de una pasarela real, y ' +
    'ése es el guard que alguien desactiva en una semana.');
  assert.equal(esMetodoValido('transfer:mercadopago'), true);

  // 🔴 NO PASAN: los dos huérfanos y la basura.
  assert.equal(esMetodoValido('bank'), false, '🔴 «bank» no está en PAID_VIA y pasa.');
  assert.equal(esMetodoValido('mp'), false, '🔴 «mp» no está en PAID_VIA y pasa.');
  assert.equal(esMetodoValido('bizum'), false,
    '🔴 «bizum» a secas pasa. No se puede saber si lo confirmó una persona o un webhook, y ésas ' +
    'son dos cadenas de evidencia distintas ante una inspección.');
  for (const malo of [null, undefined, '', '   ', 42, {}, ':stripe', 'card:', 'CARD SUELTO']) {
    assert.equal(esMetodoValido(malo), false, `🔴 «${String(malo)}» pasa la validación.`);
  }
});

test('SCRUM-474 · partir NO juzga, y la pasarela se conserva', () => {
  assert.deepEqual(partirMetodo('card:stripe'), { metodo: 'card', pasarela: 'stripe' });
  assert.deepEqual(partirMetodo('transfer'), { metodo: 'transfer', pasarela: null });
  assert.deepEqual(partirMetodo('  CARD:Stripe '), { metodo: 'card', pasarela: 'stripe' });
});

// ── LO QUE ARREGLA EL DEFECTO VISIBLE HOY ────────────────────────────────────────────────────

test('SCRUM-474 · 🔴 al LEER, `card` y `card:stripe` caen en el MISMO cubo', () => {
  // 38 de 51 cobros repartidos hoy en dos etiquetas para lo mismo: el profesional filtra por
  // tarjeta y ve la mitad. Esto lo arregla SIN TOCAR UN DATO.
  assert.equal(metodoParaAgrupar('card'), 'card');
  assert.equal(metodoParaAgrupar('card:stripe'), 'card',
    '🔴 `card:stripe` no cae en el cubo «card»: el filtro de Cobros sigue partiendo las tarjetas.');
  assert.equal(metodoParaAgrupar('transfer:mercadopago'), 'transfer');

  // Y lo no clasificable alimenta el cubo «Método no registrado» (SCRUM-285), que dice la verdad.
  for (const huerfano of ['bizum', 'bank', 'mp', null, 'lo-que-sea']) {
    assert.equal(metodoParaAgrupar(huerfano), null,
      `🔴 «${String(huerfano)}» se está clasificando en un cubo. Mapearlo por probabilidad es ` +
      'inventarse una cadena de evidencia, y eso es peor que un hueco declarado.');
  }
});

// ── EL ESCRITOR CON MÁS FUGA ─────────────────────────────────────────────────────────────────

test('SCRUM-474 · MercadoPago se traduce, y lo que no se reconoce se DECLARA', () => {
  assert.equal(metodoDesdeMercadoPago('credit_card'), 'card:mercadopago');
  assert.equal(metodoDesdeMercadoPago('bank_transfer'), 'transfer:mercadopago');
  assert.equal(metodoDesdeMercadoPago('ticket'), 'cash:mercadopago');
  // Lo traducido tiene que pasar la propia validación, o habríamos cambiado una fuga por otra.
  for (const t of ['credit_card', 'bank_transfer', 'ticket']) {
    assert.equal(esMetodoValido(metodoDesdeMercadoPago(t)), true,
      `🔴 la traducción de «${t}» no pasa la validación: fuga cambiada de sitio.`);
  }
  // 🔴 Y lo desconocido NO se inventa. Antes se guardaba crudo, o «mp» cuando no venía.
  assert.equal(metodoDesdeMercadoPago('un_tipo_que_no_conocemos'), METODO_DESCONOCIDO);
  assert.equal(metodoDesdeMercadoPago(null), METODO_DESCONOCIDO);
  assert.equal(metodoDesdeMercadoPago(undefined), METODO_DESCONOCIDO);
});
