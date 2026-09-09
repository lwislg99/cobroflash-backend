// tests/scrum844b-que-documento-se-declara.test.mjs — SCRUM-844 · puesto 2
//
// ═══════════════════════════════════════════════════════════════════════════════════════════════
// QUÉ DOCUMENTO SE DECLARA A HACIENDA, Y COMO QUÉ TIPO.
//
// `exigirTipoDeclarable(tipo, numero)` es el punto donde se decide si un documento entra en el
// registro de facturación y con qué `TipoFactura`. Sus tres desenlaces —devolver, y las dos formas
// de negarse— son lógica declarable pura, sin base ni red.
//
// 🔴 Y NO LOS TOCABA NADIE. `exigirTipoDeclarable` está en la lista de **exports huérfanos
// declarados** (`tests/_huerfanos-declarados.mjs`): ningún test lo llamaba. `scrum413` vigila que
// la UNIÓN de tipos siga cerrada y que el árbol no escriba otros valores —que es otra pregunta— y
// el único sitio que ejercitaba estas tres ramas era, de rebote, un test gateado.
//
// ── EL VECTOR, dicho en una frase ─────────────────────────────────────────────────────────────
//
// **Un justificante declarado como F1.** Un `J-` está FUERA de toda serie fiscal (V0-0, regla 26):
// `AEAT_POR_TIPO.JUST` es `null`, o sea «no se declara». Si esta función devolviera `'F1'` para un
// JUST, YaQu estaría declarando ante la AEAT, con el nombre del profesional encima, un documento
// que no es una factura. Y lo declarado ya está dicho.
//
// > Declarar de más ante Hacienda es peor que no declarar: lo segundo se corrige, lo primero ya
// > se dijo. (`tipoDocumento.ts`, y por eso un tipo DESCONOCIDO tampoco cae a F1 «por si acaso».)
//
// ⛔ Este fichero NO toca `src/`. Solo llama y comprueba. Cada caso se probó EN ROJO alterando el
//    punto exacto en `verifactu.service.ts` / `tipoDocumento.ts` y restaurando después.
// ═══════════════════════════════════════════════════════════════════════════════════════════════
import test from 'node:test';
import assert from 'node:assert/strict';

const { exigirTipoDeclarable } =
  await import('../dist/modules/invoicing/domain/verifactu.service.js');
const { declarabilidadDe, AEAT_POR_TIPO, esTipoConocido } =
  await import('../dist/modules/invoicing/domain/tipoDocumento.js');

const NUM_F = '2026-CF-001';
const NUM_J = 'J-20260315-ABCD';

// ═══════════════════════════════════════════════════════════════════════════════════════════════
// SUELO — sin esto, «no declara nada» y «no supe llamarlo» serían el mismo verde
// ═══════════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-844b · SUELO: la función existe, se llama, y el mapeo NO está vacío', () => {
  assert.equal(typeof exigirTipoDeclarable, 'function',
    '🔴 `exigirTipoDeclarable` ha dejado de exportarse: este fichero no está midiendo nada');
  const tipos = Object.keys(AEAT_POR_TIPO);
  assert.ok(tipos.length >= 3,
    `🔴 el mapeo AEAT tiene ${tipos.length} entradas. Con un mapeo vacío, «no se declara nada» `
    + 'saldría verde en todos los casos de abajo.');
  // Y que el mapeo tenga las DOS clases: algo que se declara y algo que no. Si todo fuera `null`,
  // los rechazos de abajo pasarían por vacío.
  assert.ok(tipos.some((t) => AEAT_POR_TIPO[t] !== null), '🔴 nada se declara: mapeo degenerado');
  assert.ok(tipos.some((t) => AEAT_POR_TIPO[t] === null), '🔴 todo se declara: no hay caso `null`');
});

// ═══════════════════════════════════════════════════════════════════════════════════════════════
// 🔴 EL VECTOR: un justificante NO se declara, y menos como F1
// ═══════════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-844b · 🔴 EL VECTOR: un JUSTIFICANTE no se declara — y NO cae a F1', () => {
  assert.throws(
    () => exigirTipoDeclarable('JUST', NUM_J),
    (e) => {
      assert.match(String(e.message), /document_not_invoiceable/,
        `🔴 un JUST tiene que rechazarse por «no es una factura». Llegó: «${e.message}»`);
      // El número va DENTRO del error a propósito: quien lo reciba tiene que poder decir CUÁL.
      assert.ok(String(e.message).includes(NUM_J),
        '🔴 el error no nombra el documento: en un lote de mil, un rechazo sin número no sirve');
      return true;
    },
    '🔴 UN JUSTIFICANTE SE ESTÁ DECLARANDO. Un `J-` está fuera de toda serie fiscal (regla 26): '
    + 'declararlo es decirle a Hacienda que existe una factura que no existe.',
  );

  // Y la mitad que el `throws` no puede comprobar: que NO devuelva 'F1'.
  let devuelto = null;
  try { devuelto = exigirTipoDeclarable('JUST', NUM_J); } catch { /* lo esperado */ }
  assert.equal(devuelto, null,
    `🔴 \`exigirTipoDeclarable('JUST')\` ha DEVUELTO «${devuelto}» en vez de lanzar. Ése es el `
    + 'defecto exacto que este fichero vigila.');
});

test('SCRUM-844b · 🔴 un tipo DESCONOCIDO tampoco cae a F1 «por si acaso»', () => {
  // Una fila vieja de la base, escrita antes de que la unión existiera, o un valor nuevo que
  // nadie mapeó. El fallo seguro es NO declarar; caer a F1 es declarar de más.
  for (const raro of ['ANT', 'F2', 'factura', '', 'null']) {
    assert.throws(
      () => exigirTipoDeclarable(raro, NUM_F),
      /unknown_invoice_type/,
      `🔴 el tipo «${raro}» no se ha rechazado como desconocido: o se declara algo que nadie ha `
      + 'mapeado, o cae a F1 por defecto. Las dos cosas son declarar de más.',
    );
  }
  // `null` y `undefined` son el caso real de una columna vieja, y van aparte del bucle porque el
  // mensaje los imprime distinto.
  for (const vacio of [null, undefined]) {
    assert.throws(() => exigirTipoDeclarable(vacio, NUM_F), /unknown_invoice_type/,
      `🔴 un \`type\` ${String(vacio)} tiene que ser DESCONOCIDO, no F1`);
  }
});

// ═══════════════════════════════════════════════════════════════════════════════════════════════
// ✅ CONTROL POSITIVO — y no es decorativo: sin él, un portón que rechace SIEMPRE pasaría todo
// ═══════════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-844b · ✅ POSITIVO: F1 y R1 SIGUEN declarándose, y cada uno como lo suyo', () => {
  assert.equal(exigirTipoDeclarable('F1', NUM_F), 'F1',
    '🔴 una factura completa ha dejado de declararse: la emisión fiscal queda rota entera');
  assert.equal(exigirTipoDeclarable('R1', '2026-CF-R-001'), 'R1',
    '🔴 una rectificativa ha dejado de declararse como R1');
  // 🔴 Y QUE NO SE CRUCEN. Una R1 declarada como F1 es una rectificación contada como venta nueva.
  assert.notEqual(exigirTipoDeclarable('R1', '2026-CF-R-001'), 'F1',
    '🔴 una R1 se está declarando como F1: la AEAT vería una factura nueva donde hay una corrección');
});

test('SCRUM-844b · el veredicto y el portón dicen LO MISMO, tipo por tipo', () => {
  // `declarabilidadDe` decide y `exigirTipoDeclarable` ejecuta. Si divergieran, el sitio que
  // consulta el veredicto y el que emite tomarían caminos distintos sobre el mismo documento.
  for (const tipo of Object.keys(AEAT_POR_TIPO)) {
    const v = declarabilidadDe(tipo);
    if (v.declara) {
      assert.equal(exigirTipoDeclarable(tipo, NUM_F), v.tipoAeat,
        `🔴 para «${tipo}» el veredicto dice ${v.tipoAeat} y el portón devuelve otra cosa`);
    } else {
      assert.throws(() => exigirTipoDeclarable(tipo, NUM_F), Error,
        `🔴 el veredicto dice que «${tipo}» NO se declara y el portón lo deja pasar`);
    }
  }
  // SUELO del bucle: que haya recorrido las dos ramas, no solo una.
  const veredictos = Object.keys(AEAT_POR_TIPO).map((t) => declarabilidadDe(t).declara);
  assert.ok(veredictos.includes(true) && veredictos.includes(false),
    '🔴 el bucle de arriba solo ha visto una de las dos ramas: no compara nada');
});

test('SCRUM-844b · `esTipoConocido` no se deja engañar por lo que hereda un objeto', () => {
  // Usa `hasOwnProperty` a propósito. Con un `in` o un acceso directo, `'toString'` o
  // `'constructor'` pasarían por tipos conocidos y `AEAT_POR_TIPO[tipo]` devolvería una función
  // —o sea, ni `null` ni un tipo AEAT—, y el documento se declararía con basura dentro.
  for (const heredado of ['toString', 'constructor', 'hasOwnProperty', '__proto__']) {
    assert.equal(esTipoConocido(heredado), false,
      `🔴 «${heredado}» se toma por un tipo conocido: viene del prototipo, no del mapeo`);
    assert.throws(() => exigirTipoDeclarable(heredado, NUM_F), /unknown_invoice_type/,
      `🔴 «${heredado}» ha llegado a declararse`);
  }
});
