// tests/scrum294-recargo-caja.test.mjs — SCRUM-294 (A3) · recargo de equivalencia y criterio de caja.
//
// Las dos mitades se entregan CALCULADAS Y AISLADAS, sin llamadores, porque enchufarlas toca el
// camino de emisión (el total sellado y el XML) y necesita campos de schema. Lo que sí se puede
// cerrar hoy es el mecanismo, y estos tests son los que impiden que se enchufe mal mañana.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const RAIZ = path.resolve(import.meta.dirname, '..');
const F_RECARGO = 'src/modules/invoicing/domain/recargoEquivalencia.ts';
const F_CAJA = 'src/modules/invoicing/domain/criterioCaja.ts';

const { calcularRecargo, calcularRecargoDeFactura, leerRecargoDelCliente, RECARGO_POR_TIPO_IVA } =
  await import('../dist/modules/invoicing/domain/recargoEquivalencia.js');
const { clasificarPorCobro, leerCriterioCaja, ADVERTENCIA_CAJA } =
  await import('../dist/modules/invoicing/domain/criterioCaja.js');
const { calcVatBreakdown } = await import('../dist/modules/invoicing/domain/vat.service.js');

// ═════════════════════════════════════════════════════════════════════════════════════════
// EL RECARGO · lo que decide el ticket: no cambia la base, es un impuesto MÁS sobre ella
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-294 · CONTROL POSITIVO: el caso de mil euros, calculado A MANO', () => {
  // Con lápiz, para que el mecanismo no cuadre consigo mismo:
  //   Base 1.000,00 al 21 %  →  IVA        1.000,00 × 0,21  = 210,00
  //                             RECARGO    1.000,00 × 0,052 =  52,00
  //   Total que paga el cliente: 1.000 + 210 + 52 = 1.262,00
  const r = calcularRecargo(1000, 21);
  assert.equal(r.ok, true);
  assert.equal(r.tipoRecargo, 5.2);
  assert.equal(r.cuota, 52.00, '🔴 el recargo del 21 % sobre 1.000,00 no es 52,00');
  assert.equal(r.base, 1000, '🔴 el recargo ha tocado la BASE. No la toca: cuelga de ella.');

  // Y los otros dos tramos, también a mano:
  assert.equal(calcularRecargo(500, 10).cuota, 7.00,  '🔴 500,00 al 10 % → recargo 1,4 % = 7,00');
  assert.equal(calcularRecargo(200, 4).cuota,  1.00,  '🔴 200,00 al 4 %  → recargo 0,5 % = 1,00');
});

test('SCRUM-294 · el recargo va sobre la BASE, nunca sobre la cuota ni sobre el total', () => {
  // El error clásico: aplicarlo al total con IVA (1.210 × 5,2 % = 62,92 en vez de 52,00). Son
  // 10,92 € de más en una factura de mil, y los paga el cliente.
  const base = 1000, iva = 210, total = base + iva;
  assert.notEqual(calcularRecargo(base, 21).cuota, Math.round(total * 0.052 * 100) / 100);
  assert.equal(calcularRecargo(base, 21).cuota, 52.00);
});

test('SCRUM-294 · un tipo de IVA SIN recargo conocido no se aproxima con el más parecido', () => {
  // Misma regla que el 303 con las casillas: redondear un tipo hacia el vecino es declarar mal, y
  // encima queda cuadrado.
  for (const tipo of [5, 2, 0, 7.5, 'veintiuno', null, undefined]) {
    const r = calcularRecargo(100, tipo);
    assert.equal(r.ok, false, `🔴 el tipo ${JSON.stringify(tipo)} ha producido un recargo`);
    assert.equal(r.motivo, 'tipo_iva_sin_recargo_conocido');
  }
});

test('SCRUM-294 · una base ILEGIBLE no produce un recargo de 0,00 €', () => {
  // `Number('')` es 0 y `Number([])` es 0 (familia SCRUM-271). Un recargo de 0,00 se lee como
  // «este cliente no lleva recargo», que es justo lo contrario de «no se pudo calcular».
  for (const mala of ['', [], null, undefined, 'mil euros', NaN, {}]) {
    const r = calcularRecargo(mala, 21);
    assert.equal(r.ok, false, `🔴 la base ${JSON.stringify(mala)} ha producido un recargo`);
    assert.equal(r.motivo, 'base_ilegible');
  }
  // Y la otra cara: una base de CERO legítima sí calcula, y da 0,00.
  const cero = calcularRecargo(0, 21);
  assert.equal(cero.ok, true);
  assert.equal(cero.cuota, 0);
});

test('SCRUM-294 · una factura con varios tramos: cada uno con su tipo, y lo que falla se declara', () => {
  // Base 100 al 21 % → 5,20 · Base 200 al 10 % → 2,80 · Base 50 al 5 % → SIN recargo conocido.
  const r = calcularRecargoDeFactura([
    { rate: 21, base: 100, cuota: 21 },
    { rate: 10, base: 200, cuota: 20 },
    { rate: 5,  base: 50,  cuota: 2.5 },
  ]);
  assert.equal(r.total, 8.00, '🔴 5,20 + 2,80 = 8,00 (el tramo del 5 % NO suma: no se sabe)');
  assert.equal(r.sinCalcular.length, 1,
    '🔴 el tramo sin recargo conocido no se declara. Sumarle cero produciría un recargo más bajo ' +
    'que el real, y ese número acaba en una factura que alguien cobra.');
});

test('SCRUM-294 · los tipos de recargo son un conjunto CERRADO', () => {
  assert.deepEqual(Object.keys(RECARGO_POR_TIPO_IVA).map(Number).sort((a, b) => a - b), [4, 10, 21]);
  assert.throws(() => { 'use strict'; RECARGO_POR_TIPO_IVA[5] = 0.62; },
    '🔴 la tabla de recargos se puede modificar en caliente: un tipo inventado entraría sin pasar ' +
    'por el asesor.');
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// CONTROL NEGATIVO · un merchant SIN recargo emite EXACTAMENTE como hoy
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-294 · CONTROL NEGATIVO: el cálculo de la factura NO cambia para nadie', () => {
  // El desglose compartido tiene que dar lo mismo que antes de este ticket: base, cuota y tramos.
  // Si esto se moviera, se movería el número que `registro.builder.ts` manda LITERAL al XML.
  const lineas = [
    { concept: 'Mano de obra', qty: 2, price: 300, tax: 0.21 },
    { concept: 'Material', qty: 1, price: 250, tax: 0.10 },
  ];
  const bd = calcVatBreakdown(lineas);
  assert.equal(bd.base, 850.00, '🔴 la base compartida ha cambiado');
  assert.equal(bd.cuota, 151.00, '🔴 la cuota compartida ha cambiado (126,00 + 25,00)');
  assert.deepEqual(bd.entries, [
    { rate: 21, base: 600, cuota: 126 },
    { rate: 10, base: 250, cuota: 25 },
  ], '🔴 el desglose por tramos ha cambiado');

  // Y el recargo, calculado APARTE, no toca nada de lo anterior.
  const rec = calcularRecargoDeFactura(bd.entries);
  assert.equal(rec.total, 34.70, '🔴 600×5,2 % + 250×1,4 % = 31,20 + 3,50 = 34,70');
  assert.equal(calcVatBreakdown(lineas).base, 850.00,
    '🔴 calcular el recargo ha alterado el desglose: no puede tocar nada.');
});

test('SCRUM-294 · SUELO: si no se puede leer la configuración, NO se cae a «sin recargo»', () => {
  // Emitir sin el recargo de quien lo lleva es un defecto MUDO: la factura sale, se cobra, y el
  // proveedor se come el recargo que tenía que haber repercutido.
  for (const malo of [null, undefined, 'sí', 1, {}, []]) {
    const r = leerRecargoDelCliente(malo);
    assert.equal(r.ok, false, `🔴 «${JSON.stringify(malo)}» se ha leído como una respuesta válida`);
  }
  // Las dos respuestas legítimas, que son las que dan valor al suelo:
  assert.deepEqual(leerRecargoDelCliente(true), { ok: true, aplica: true });
  assert.deepEqual(leerRecargoDelCliente(false), { ok: true, aplica: false });
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// EL CRITERIO DE CAJA · clasifica y avisa; NO liquida
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-294 · el RECC reparte los asientos entre cobrados y no cobrados', () => {
  const c = clasificarPorCobro([
    { numero: 'A', estado: 'paid', cuota: 21 },
    { numero: 'B', estado: 'pending', cuota: 42 },
    { numero: 'C', estado: 'paid', cuota: 10.50 },
  ]);
  assert.equal(c.cuotaCobrada, 31.50);
  assert.equal(c.cuotaNoCobrada, 42.00);
  assert.equal(c.miradas, 3, '🔴 sin `miradas`, «cero cobrados» y «no supe mirar» son el mismo cero');
});

test('SCRUM-294 · el aviso de que la marca NO es la fecha del euro viaja CON el dato', () => {
  // Medido: `paidAt: new Date()` en tres sitios de `src`. Si la advertencia viviera en la
  // pantalla, un export o un PDF publicarían la clasificación sin ella.
  const c = clasificarPorCobro([{ numero: 'A', estado: 'paid', cuota: 21 }]);
  assert.equal(c.advertencia, ADVERTENCIA_CAJA);
  assert.match(c.advertencia, /^\[PENDIENTE microcopy oficial\] /,
    '🔴 el aviso se presenta como texto aprobado y no lo está (regla 30)');
  assert.match(c.advertencia, /no en qué fecha entró el dinero/,
    '🔴 el aviso no dice lo único que tiene que decir.');
});

test('SCRUM-294 · una cuota ilegible no cae a ningún lado: se declara', () => {
  const c = clasificarPorCobro([
    { numero: 'A', estado: 'paid', cuota: null },
    { numero: 'B', estado: 'paid', cuota: 21 },
  ]);
  assert.deepEqual(c.sinCuota, ['A'],
    '🔴 el asiento sin cuota legible se ha sumado como cero: desaparecería de la declaración sin ' +
    'que nadie lo note.');
  assert.equal(c.cuotaCobrada, 21);
});

test('SCRUM-294 · SUELO del RECC: «no se pudo leer» no es «no está acogido»', () => {
  for (const malo of [null, undefined, 'sí', 0, {}]) {
    assert.equal(leerCriterioCaja(malo).ok, false, `🔴 «${JSON.stringify(malo)}» se dio por válido`);
  }
  assert.deepEqual(leerCriterioCaja(true), { ok: true, acogido: true });
  assert.deepEqual(leerCriterioCaja(false), { ok: true, acogido: false });
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// LOS GUARDS DE AISLAMIENTO (regla 38) — con respaldo de la negación (SCRUM-237)
// ═════════════════════════════════════════════════════════════════════════════════════════

function fuente(rel) {
  const ruta = path.join(RAIZ, rel);
  assert.ok(fs.existsSync(ruta), `🔴 no existe ${rel}: el guard no puede mirar, así que FALLA.`);
  return fs.readFileSync(ruta, 'utf8');
}

test('SCRUM-294 · los dos módulos NO importan nada: no pueden tocar el camino de emisión', () => {
  for (const rel of [F_RECARGO, F_CAJA]) {
    const sf = ts.createSourceFile(rel, fuente(rel), ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
    const imports = [];
    const visitar = (n) => {
      if (ts.isImportDeclaration(n)) imports.push(n.moduleSpecifier.getText(sf));
      ts.forEachChild(n, visitar);
    };
    visitar(sf);
    assert.deepEqual(imports, [],
      `🔴 ${rel} importa ${imports.join(', ')}.\n\n` +
      '  Estos módulos calculan APARTE a propósito: el recargo no cambia la base ni la cuota (el\n' +
      '  XSD de la AEAT lo pone como hermano de `CuotaRepercutida`, no como otra base), así que\n' +
      '  `calcVatBreakdown` —16 consumidores, uno el sellado— no tiene nada que aprender. Un\n' +
      '  import es el primer paso para que sí lo tenga.');
  }
});

test('SCRUM-294 · GUARD con respaldo: los nombres prohibidos EXISTEN en la casa', () => {
  // SCRUM-237: una negación sobre un token inexistente es un verde permanente. Antes de exigir
  // que estos nombres NO estén en mis módulos, se comprueba que SÍ están en el árbol.
  const PROHIBIDOS = ['calcVatBreakdown', 'grossOfLines', 'registro.builder', 'prisma'];
  const vat = fuente('src/modules/invoicing/domain/vat.service.ts');
  const lineas = fuente('src/modules/invoicing/domain/invoiceLines.service.ts');
  assert.ok(vat.includes('calcVatBreakdown'), '🔴 `calcVatBreakdown` ya no existe donde se medía');
  assert.ok(lineas.includes('grossOfLines'), '🔴 `grossOfLines` ya no existe donde se medía');
  assert.ok(fs.existsSync(path.join(RAIZ, 'src/modules/fiscal/verifactu/registro.builder.ts')),
    '🔴 `registro.builder.ts` ya no existe: la negación de abajo dejaría de significar algo');

  for (const rel of [F_RECARGO, F_CAJA]) {
    const codigo = fuente(rel).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    for (const p of PROHIBIDOS) {
      assert.ok(!codigo.includes(p),
        `🔴 ${rel} menciona «${p}» en su CÓDIGO. Se lee sin comentarios a propósito: el comentario ` +
        'que explica la prohibición contiene la palabra prohibida.');
    }
  }
});

test('SCRUM-294 · nadie los llama todavía, y eso es el estado correcto', () => {
  // Enchufarlos cambia el TOTAL sellado y el XML: es STOP y necesita GO con el diff delante.
  // Cuando llegue ese día, este test cae y obliga a decirlo en la entrada.
  const llamadores = [];
  const andar = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) andar(p);
      else if (e.name.endsWith('.ts') && !p.endsWith('recargoEquivalencia.ts') && !p.endsWith('criterioCaja.ts')) {
        const c = fs.readFileSync(p, 'utf8');
        // 🔴 SE BUSCA EL IMPORT, NO LA MENCIÓN — y el cambio lo pagó SCRUM-294-a (12-ago-2026).
        //
        // Esto buscaba la CADENA `recargoEquivalencia` en cualquier `.ts` de `src/`. Cuando el
        // recargo pasó a ser un campo del CLIENTE, la palabra apareció en `schemas.ts` (la
        // validación) y en `customerAdmin.ts` (el `select` de la ficha) — dos ficheros que **no
        // importan este módulo**: llevan la palabra porque es el NOMBRE DEL CAMPO.
        //
        // Y el falso positivo no era ruido: empujaba a romper algo para callarlo, y lo único
        // «rompible» era justo lo que la regla 38 prohíbe tocar. Un guard atado a la FORMA
        // (mencionar) se cae con cualquier cambio correcto; atado al HECHO (importar), no.
        const importa = /(?:from|import|require)\s*\(?\s*['"][^'"]*\/(?:recargoEquivalencia|criterioCaja)['"]/.test(c);
        if (importa) llamadores.push(path.relative(RAIZ, p).replace(/\\/g, '/'));
      }
    }
  };
  andar(path.join(RAIZ, 'src'));
  assert.deepEqual(llamadores, [],
    `🔴 alguien ya llama a estos módulos: ${llamadores.join(', ')}.\n\n` +
    '  No es que esté prohibido — es que enchufarlos cambia el TOTAL de la factura (lo que se\n' +
    '  sella) y el XML del desglose, y las dos cosas son STOP. Si ya hay GO del fundador, quita\n' +
    '  este test EN EL MISMO COMMIT y dilo en la entrada.');
});
