// tests/scrum600e-condiciones-contra-el-emisor.test.mjs — SCRUM-600e
//
// ═══════════════════════════════════════════════════════════════════════════════════════════════
// «3. CONDICIONES» NO LLEGA A LA FACTURA, Y NO PUEDE LLEGAR TODAVÍA. Esto lo hace cumplir.
//
// LA MEDICIÓN QUE ABRE ESTE TICKET (contrastada, no heredada): los TRES campos del bloque
// —`paymentTerms`, `customBillingPlan`, `validUntil`— **no existen en `model Invoice`**. Ni uno.
// El encargo pedía construir «las 🟢, las que no necesitan columna nueva»: en este bloque **no hay
// ninguna**. Así que lo que sale del ticket no es la función, es el mecanismo que impide que
// alguien la encienda a medias.
//
// ── QUÉ CAZA, QUE EL GUARD DE 600b NO ───────────────────────────────────────────────────────
//
// `scrum600b-la-factura-usa-el-front.test.mjs:307` fija los RÓTULOS de hoy con una lista a mano.
// Éste deriva la REGLA desde dos ficheros que no se leen entre sí, y por eso caza las dos cosas
// que aquél no puede ver:
//
//   ① encender «3. Condiciones» en el documento suelto **sin** las columnas → 🔴 nombrando cuál;
//   ② colgar un control NUEVO del bloque que nadie ha asignado → 🔴 (aquél no lo tiene en su lista).
//
// Y el día que el fundador apruebe el ALTER, éste **se pone verde solo**: no hay lista que editar.
//
// ── 26-nov-2026 · SCRUM-1805 ① (decisión SCRUM-1787 c.22325 ②) ──────────────────────────────
// La factura TIENE ya paso «Condiciones»: formas de pago (`Invoice.payMethods`), «Vence el»
// (`Invoice.dueDate`) y ajustes. Lo que sigue sin columna —`paymentTerms`, `customBillingPlan`,
// `validUntil`— sigue FUERA, y la vara de este guard es la misma: las puertas bajan al nivel de la
// fila (ver `PUERTAS`) y los dos controles nuevos se miden con la regla ① (`SOLO_EN_EL_SUELTO`).
//
// 🔴 NADA DE ESTO MODIFICA EL CAMINO DE EMISIÓN (regla 38). Se lee `facturaSuelta.ts` y
// `prisma/schema.prisma`; las mutaciones de los negativos ocurren EN MEMORIA, sobre una copia del
// texto, y nunca tocan el disco.
// ═══════════════════════════════════════════════════════════════════════════════════════════════
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  revisarCondicionesContraEmisor, censarInsercionesDelSuelto, camposDelModelo,
  clavesQueSobreviven, camposDelBloque, leer, CensoCiego,
  RUTA_PANTALLA, RUTA_SCHEMA, RUTA_VALIDADOR, BLOQUE,
} from './_condiciones-vs-emisor.mjs';

/**
 * Las puertas que dejan fuera del documento suelto los controles de «3. Condiciones» SIN columna.
 * Literales del árbol.
 *
 * 🔴 SCRUM-1805 ① (decisión SCRUM-1787 c.22325 ②) · hasta aquí la puerta era UNA, la del bloque
 * entero (`if (!esDocumentoSuelto) leftCard.appendChild(blockConditions);`). Desde 1805 la factura
 * TIENE paso Condiciones —formas de pago (`Invoice.payMethods`), «Vence el» (`Invoice.dueDate`) y
 * ajustes—, así que el bloque entra en los dos modos y las puertas bajan un nivel: la fila de cobro
 * (`paymentTerms` + `customBillingPlan`) y la caducidad (`validUntil`), que siguen sin columna. La
 * mutación abre LAS DOS, y el rojo ① tiene que nombrar los mismos tres campos de siempre: la vara
 * no baja, sólo se mueve a donde está ahora la puerta.
 */
const PUERTAS = [
  'if (!esDocumentoSuelto) blockConditions.appendChild(filaCobro);',
  'if (!esDocumentoSuelto) filaValidezDetalle.appendChild(validWrapper);',
];
/** La de la fila de cobro, para el rojo ③ (guarda compuesta). */
const PUERTA = PUERTAS[0];

/** LADO A mutado: se abren las puertas y los tres controles sin columna entran en el documento suelto. */
function conCondicionesEncendidas(pantalla) {
  let out = pantalla;
  for (const p of PUERTAS) {
    assert.ok(out.includes(p),
      `🔴 la puerta ya no es literalmente \`${p}\`. Sin ella, la mutación de este test no muta `
      + 'nada y los rojos de abajo saldrían verdes por no haber cambiado el código.');
    out = out.replace(p, p.replace('if (!esDocumentoSuelto) ', ''));
  }
  return out;
}

/** LADO B mutado: `model Invoice` gana las tres columnas. Sólo en memoria. */
function conLasTresColumnas(schema) {
  const ancla = 'model Invoice {';
  assert.ok(schema.includes(ancla), '🔴 no encuentro `model Invoice {` en el schema');
  return schema.replace(ancla, ancla + '\n'
    + '  paymentTerms      String?\n'
    + '  customBillingPlan Json?\n'
    + '  validUntil        DateTime?\n'
    // SCRUM-915d · las formas de pago se mudaron a Condiciones: la cuarta columna que el bloque pide.
    + '  payMethods        Json?\n');
}

// ─────────────────────────────────────────────────────────────────────────────────────────────
// SUELO — un censo que no ve nada tiene que DECIRLO, no dar verde
// ─────────────────────────────────────────────────────────────────────────────────────────────

test('SCRUM-600e · SUELO: el censo VE el formulario, su raíz y los tres controles del bloque', () => {
  const r = censarInsercionesDelSuelto(leer(RUTA_PANTALLA));
  assert.equal(r.raiz, 'leftCard', '🔴 la raíz del formulario ha cambiado: la alcanzabilidad medía otra cosa');
  assert.ok(r.inserciones.length > 50, `🔴 sólo ${r.inserciones.length} inserciones: el analizador no está viendo el formulario`);
  assert.deepEqual(r.opacas, [],
    '🔴 hay guardas de `esDocumentoSuelto` con una forma que este censo NO sabe leer. No se '
    + 'adivinan: se declaran. Mientras estén ahí, el veredicto de esos controles no es fiable.\n  '
    + r.opacas.join('\n  '));

  // CONTROL POSITIVO: en el PRESUPUESTO los tres SÍ llegan. Si no llegaran a ninguno de los dos
  // modos, «apagado en la factura» y «no sé leer el grafo» serían el mismo resultado.
  for (const { control } of camposDelBloque()) {
    assert.ok(r.enPresupuesto.has(control),
      `🔴 \`${control}\` no llega ni al PRESUPUESTO. Eso no es un hallazgo del documento suelto: `
      + 'es que el censo no sabe recorrer el grafo de inserción.');
  }
});

test('SCRUM-600e · SUELO: los dos lados se leen de verdad, y ninguno sale vacío', () => {
  const campos = camposDelModelo(leer(RUTA_SCHEMA), 'Invoice');
  assert.ok(campos.length > 30, `🔴 sólo ${campos.length} campos en \`model Invoice\`: el lector del schema está ciego`);
  assert.ok(campos.includes('number') && campos.includes('total'),
    '🔴 el lector del schema no ve ni `number` ni `total`: no está leyendo el modelo que dice');

  const supervivientes = clavesQueSobreviven(leer(RUTA_VALIDADOR));
  // 21-nov-2026 · SCRUM-1787i: el emisor acepta también `dueDate` y `payMethods` (GO de regla 40 en
  // SCRUM-1787 c.22325 ③ y c.22331; esta expectativa la mueve el fundador en c.22349 «1-Ok sí»).
  assert.deepEqual([...supervivientes].sort(), ['customerId', 'dueDate', 'lineas', 'payMethods'],
    '🔴 lo que sobrevive a `validarFacturaSuelta` ha cambiado. Si el emisor acepta más claves, esta '
    + 'medición y el reparto 🟢/🟡/🔴 del parte hay que rehacerlos.');
});

test('SCRUM-600e · SUELO: si el schema no se puede leer, el censo se DECLARA ciego (no da verde)', () => {
  assert.throws(() => camposDelModelo('model Otro {\n  id Int\n}\n', 'Invoice'), CensoCiego,
    '🔴 sin poder leer `model Invoice` el guard daría TODA columna por inexistente y cantaría un '
    + 'defecto enorme que no existe. Tiene que lanzar.');
  assert.throws(() => clavesQueSobreviven('export const nada = 1;\n'), CensoCiego,
    '🔴 sin poder leer `ResultadoValidacion` saldría «el emisor lo tira todo», que no es lo medido.');
});

// ─────────────────────────────────────────────────────────────────────────────────────────────
// 🔴 EL CONTROL QUE DECIDE
// ─────────────────────────────────────────────────────────────────────────────────────────────

test('SCRUM-600e · 🔴 EL CONTROL QUE DECIDE: la pantalla no pide NADA que el emisor tire', () => {
  const r = revisarCondicionesContraEmisor();
  assert.deepEqual(r.pidenLoQueSeTira, [],
    '🔴 LA PANTALLA PIDE UN DATO QUE NO TIENE DÓNDE GUARDARSE. El profesional lo teclea, pulsa, y\n'
    + '  el documento sale sin él: ni error, ni aviso, ni diferencia de importe. Antes de encender\n'
    + '  este control hace falta su columna en `model Invoice` — y el ALTER es del fundador.\n  '
    + r.pidenLoQueSeTira.join('\n  '));
  assert.deepEqual(r.sinAsignar, [],
    `🔴 hay un control colgado de \`${BLOQUE}\` que nadie ha asignado en \`CAMPO_A_BLOQUE\`. Un\n`
    + '  control que no está en ninguna lista entra sin que suene nada — la lección de SCRUM-284.\n  '
    + r.sinAsignar.join('\n  '));
  assert.deepEqual(r.asignadosFantasma, [],
    '🔴 un control asignado ya no llega ni al presupuesto: el mapa de bloques está mintiendo.\n  '
    + r.asignadosFantasma.join('\n  '));
  // SCRUM-915d · la excepción del andamio de los pasos no puede quedarse vieja.
  assert.deepEqual(r.noSonCamposQueSobran, [],
    '🔴 `NO_SON_CAMPOS` declara piezas que ya no cuelgan de Condiciones: una excepción que sobra es\n'
    + '  un hueco por el que mañana entra otra cosa con ese nombre.\n  ' + r.noSonCamposQueSobran.join('\n  '));
  // SCRUM-1805 ① · lo declarado «sólo de la factura» no puede colgarse de Condiciones en el presupuesto.
  assert.deepEqual(r.soloEnElSueltoEnElPresupuesto, [],
    '🔴 un control de `SOLO_EN_EL_SUELTO` llega también al Condiciones del PRESUPUESTO.\n  '
    + r.soloEnElSueltoEnElPresupuesto.join('\n  '));
});

test('SCRUM-600e · 🔴 LA MEDICIÓN DEL TICKET: los tres campos del bloque NO existen en `Invoice`', () => {
  const enInvoice = new Set(camposDelModelo(leer(RUTA_SCHEMA), 'Invoice'));
  const conColumna = camposDelBloque().filter(({ campo }) => enInvoice.has(campo));
  // 21-nov-2026 · SCRUM-1787i: `payMethods` ya tiene columna en `Invoice` (ALTER firmado en SCRUM-1787
  // c.22331; GO c.22325 ③). Esta expectativa la mueve el fundador en c.22349 «1-Ok sí». Las otras tres
  // siguen sin columna, y una cuarta que la gane vuelve a poner esto en rojo.
  assert.deepEqual(conColumna.map((x) => x.campo), ['payMethods'],
    '✅ ESTO ES UNA BUENA NOTICIA Y HAY QUE MIRARLA, NO BORRARLA: alguno de los campos de\n'
    + '  «3. Condiciones» YA TIENE COLUMNA. El reparto que cerró SCRUM-600e (0 🟢 · 0 🟡 · 3 🔴)\n'
    + '  ha cambiado y el bloque puede empezar a construirse. Actualiza el parte y abre el ticket.\n  '
    + conColumna.map((x) => `${x.campo} (control ${x.control})`).join('\n  '));
});

// ─────────────────────────────────────────────────────────────────────────────────────────────
// 🔴 LOS ROJOS — cada uno mutando UN SOLO LADO, que es lo que prueba que apuntan
//
// La lección de SCRUM-821c: si los dos lados leyeran la misma fuente, mover uno movería el otro y
// el negativo sería imposible. Aquí el LADO A es `quotesView.js` y el LADO B es
// `prisma/schema.prisma`. Se mutan por separado y el veredicto cambia por separado.
// ─────────────────────────────────────────────────────────────────────────────────────────────

test('SCRUM-600e · 🔴 ROJO ①: encender el bloque SIN las columnas cae, y NOMBRA los tres campos', () => {
  const r = revisarCondicionesContraEmisor({
    [RUTA_PANTALLA]: conCondicionesEncendidas(leer(RUTA_PANTALLA)),
    // LADO B intacto, leído del disco: la mutación es de UN solo fichero.
  });
  // SCRUM-915d · son CUATRO desde que las formas de pago viven en Condiciones (un campo más vigilado).
  // 21-nov-2026 · SCRUM-1787i: son TRES otra vez, porque `payMethods` ya tiene columna y sobrevive al
  // emisor (SCRUM-1787 c.22325 ③ y c.22331). Esta expectativa la mueve el fundador en c.22349 «1-Ok sí».
  assert.equal(r.pidenLoQueSeTira.length, 3,
    `🔴 el guard NO ha cazado el encendido a medias (dijo ${r.pidenLoQueSeTira.length} de 3). Un `
    + 'guard que no se ha visto en rojo no está probado.');
  for (const campo of ['paymentTerms', 'customBillingPlan', 'validUntil']) {
    assert.ok(r.pidenLoQueSeTira.some((m) => m.includes(campo)),
      `🔴 el rojo no nombra \`${campo}\`. Un rojo que no dice qué falta obliga a buscarlo a mano.`);
  }
});

test('SCRUM-600e · ✅ NEGATIVO APUNTADO: con las columnas puestas, el MISMO encendido pasa', () => {
  // Las dos mutaciones a la vez. El LADO A es idéntico al del ROJO ① — lo único que cambia es un
  // fichero que el LADO A **no lee**. Si el veredicto no se moviera, los dos lados serían el
  // mismo lado y el verde de este guard no significaría nada.
  const r = revisarCondicionesContraEmisor({
    [RUTA_PANTALLA]: conCondicionesEncendidas(leer(RUTA_PANTALLA)),
    [RUTA_SCHEMA]: conLasTresColumnas(leer(RUTA_SCHEMA)),
  });
  assert.deepEqual(r.pidenLoQueSeTira, [],
    '🔴 el guard sigue en rojo DESPUÉS de darle las columnas. Entonces no está midiendo el schema:\n'
    + '  estaría prohibiendo el bloque por su nombre, y el día del ALTER bloquearía la función\n'
    + '  correcta en vez de dejarla pasar.\n  ' + r.pidenLoQueSeTira.join('\n  '));
  assert.deepEqual(r.medicion.lleganAlSuelto, ['fieldPaymentTerms', 'stagesWrapper', 'validWrapper', 'payMethodsWrapper'],
    '🔴 con la puerta abierta los tres controles tienen que llegar al documento suelto; si no, la '
    + 'mutación del LADO A no ha hecho nada y el verde de arriba es vacío.');
});

test('SCRUM-600e · 🔴 ROJO ②: un control NUEVO en el bloque que nadie asignó también cae', () => {
  // El hueco exacto del guard por lista de rótulos: esto NO está en `NO_DEBEN_ESTAR`.
  // SCRUM-915d · el ancla es la línea de hoy (el control cuelga de su fila) y se comprueba que la
  // mutación SE APLICÓ: con el ancla vieja el `replace` no hacía nada y el rojo no probaba nada.
  const ANCLA = 'filaCobroDetalle.appendChild(fieldPaymentTerms.wrapper);';
  const original = leer(RUTA_PANTALLA);
  assert.ok(original.includes(ANCLA), `🔴 el ancla de la mutación ya no existe: ${ANCLA}`);
  const pantalla = original.replace(ANCLA, ANCLA + '\n    blockConditions.appendChild(campoRecienInventado);');
  const r = revisarCondicionesContraEmisor({ [RUTA_PANTALLA]: pantalla });
  assert.equal(r.sinAsignar.length, 1,
    '🔴 un control nuevo ha entrado en «3. Condiciones» sin que el guard lo vea. Ése es justo el '
    + 'caso que una lista de rótulos escrita a mano no puede cazar.');
  assert.match(r.sinAsignar[0], /campoRecienInventado/);
});

test('SCRUM-915d · 🔴 ROJO ②b: un control nuevo colgado DE UNA FILA de Condiciones también cae', () => {
  // El hueco que abrían las filas: mirando sólo los hijos directos del bloque, esto pasaba.
  const ANCLA = 'filaPagosDetalle.appendChild(payMethodsWrapper);';
  const original = leer(RUTA_PANTALLA);
  assert.ok(original.includes(ANCLA), `🔴 el ancla de la mutación ya no existe: ${ANCLA}`);
  const pantalla = original.replace(ANCLA, ANCLA + '\n    filaPagosDetalle.appendChild(campoEnUnaFila);');
  const r = revisarCondicionesContraEmisor({ [RUTA_PANTALLA]: pantalla });
  assert.equal(r.sinAsignar.length, 1, `🔴 un control colgado de una fila no se ve: ${JSON.stringify(r.sinAsignar)}`);
  assert.match(r.sinAsignar[0], /campoEnUnaFila.*filaPagosDetalle/);
});

test('SCRUM-600e · 🔴 ROJO ③: si la guarda toma una forma que el censo no sabe leer, se DECLARA', () => {
  // No se adivina una condición compuesta: se dice que no se sabe. Un censo que sigue reportando
  // con el modelo roto es peor que no tener censo.
  const original = leer(RUTA_PANTALLA);
  assert.ok(original.includes(PUERTA), `🔴 la puerta ya no existe: ${PUERTA}`);
  const pantalla = original.replace(PUERTA,
    'if (!esDocumentoSuelto && algo) blockConditions.appendChild(filaCobro);');
  const r = revisarCondicionesContraEmisor({ [RUTA_PANTALLA]: pantalla });
  assert.equal(r.opacas.length, 1, '🔴 la guarda compuesta no se ha declarado opaca: se estaría adivinando');
  assert.match(r.opacas[0], /blockConditions\.appendChild\(filaCobro\)/);
});

// ─────────────────────────────────────────────────────────────────────────────────────────────
// ✅ Y EL PRESUPUESTO NO SE TOCA
// ─────────────────────────────────────────────────────────────────────────────────────────────

test('SCRUM-600e · ✅ POSITIVO: «3. Condiciones» sigue ENTERO en el presupuesto', () => {
  // El arreglo barato de un guard como éste sería vaciar el bloque. Esto lo impide: apagarlo en la
  // factura no es quitarlo del presupuesto, que es donde los tres campos sí tienen dónde ir.
  const r = revisarCondicionesContraEmisor();
  assert.deepEqual(r.medicion.lleganAlPresupuesto,
    ['fieldPaymentTerms', 'stagesWrapper', 'validWrapper', 'payMethodsWrapper'],
    '🔴 el presupuesto ha PERDIDO controles de «3. Condiciones». Ahí sí se guardan: `Quote` tiene '
    + 'las tres columnas.');
  // SCRUM-1805 ① (c.22325 ②) · al documento suelto llegan EXACTAMENTE las formas de pago, que tienen
  // columna (`Invoice.payMethods`, 1787i). Igualdad exacta, no «al menos»: cualquier otro control del
  // presupuesto que empiece a llegar a la factura vuelve a poner esto en rojo.
  assert.deepEqual(r.medicion.lleganAlSuelto, ['payMethodsWrapper'],
    '🔴 al documento suelto llega de «3. Condiciones» algo distinto de las formas de pago.');
  assert.deepEqual(r.medicion.soloEnElSueltoQueLlegan, ['dueWrapper', 'fieldVatDefault'],
    '🔴 la factura ha perdido «Vence el» o el IVA por defecto de su paso Condiciones (SCRUM-1805 ①).');
});

// ─────────────────────────────────────────────────────────────────────────────────────────────
// 🔴 SCRUM-1805 ① · LOS CONTROLES QUE SÓLO LA FACTURA CUELGA DE CONDICIONES, medidos igual
// ─────────────────────────────────────────────────────────────────────────────────────────────

test('SCRUM-1805 · 🔴 ROJO ④: si `dueDate` no tuviera dónde ir, «Vence el» cae con la MISMA regla', () => {
  // LADO B mutado (en memoria): `Invoice` y `validarFacturaSuelta` pierden `dueDate`. La pantalla,
  // intacta. Si el veredicto no se moviera, `SOLO_EN_EL_SUELTO` sería una lista de excusas.
  const schema = leer(RUTA_SCHEMA);
  const validador = leer(RUTA_VALIDADOR);
  const lineaDue = schema.split(/\r?\n/).find((l) => /^\s*dueDate\s+\S/.test(l));
  assert.ok(lineaDue, '🔴 no encuentro la columna `dueDate` en el schema: la mutación no mutaría nada');
  assert.ok(/\bdueDate\b/.test(validador), '🔴 el validador ya no nombra `dueDate`: la mutación no mutaría nada');
  const r = revisarCondicionesContraEmisor({
    [RUTA_SCHEMA]: schema.split(/\r?\n/).filter((l) => !/^\s*dueDate\s+\S/.test(l)).join('\n'),
    [RUTA_VALIDADOR]: validador.replace(/\bdueDate\b/g, 'fechaQueNoExiste'),
  });
  assert.equal(r.pidenLoQueSeTira.length, 1, `🔴 «Vence el» sin columna no ha caído: ${JSON.stringify(r.pidenLoQueSeTira)}`);
  assert.match(r.pidenLoQueSeTira[0], /dueWrapper.*dueDate/);
});

test('SCRUM-1805 · 🔴 ROJO ⑤: si «Vence el» deja de colgarse del paso, su excepción SOBRA y cae', () => {
  const ANCLA = 'if (esDocumentoSuelto) filaValidezDetalle.appendChild(dueWrapper);';
  const original = leer(RUTA_PANTALLA);
  assert.ok(original.includes(ANCLA), `🔴 el ancla de la mutación ya no existe: ${ANCLA}`);
  const r = revisarCondicionesContraEmisor({ [RUTA_PANTALLA]: original.replace(ANCLA, '') });
  assert.deepEqual(r.noSonCamposQueSobran, ['dueWrapper'],
    '🔴 una excepción de `SOLO_EN_EL_SUELTO` que ya no cuelga del bloque no ha sonado.');
});

test('SCRUM-1805 · 🔴 ROJO ⑥: si «Vence el» se colgara también en el PRESUPUESTO, deja de ser «sólo de la factura»', () => {
  // La guarda `if (esDocumentoSuelto)` quitada: el control llega a los dos modos. Su dato sigue
  // teniendo columna, así que la regla ① no lo caza; lo caza que deje de estar guardado.
  const ANCLA = 'if (esDocumentoSuelto) filaValidezDetalle.appendChild(dueWrapper);';
  const original = leer(RUTA_PANTALLA);
  assert.ok(original.includes(ANCLA), `🔴 el ancla de la mutación ya no existe: ${ANCLA}`);
  const r = revisarCondicionesContraEmisor({ [RUTA_PANTALLA]: original.replace(ANCLA, 'filaValidezDetalle.appendChild(dueWrapper);') });
  assert.deepEqual(r.soloEnElSueltoEnElPresupuesto, ['dueWrapper'],
    '🔴 «Vence el» ha entrado en el presupuesto y nadie lo ha visto.');
});
