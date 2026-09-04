// SCRUM-293 (A2) · LA RETENCIÓN DE IRPF, CALCULADA APARTE — y el cuadre que NO se puede romper.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// POR QUÉ ESTE TICKET NO ESTÁ TERMINADO, Y ESO ESTÁ BIEN
//
// A2 pide que la retención se configure UNA VEZ en el perfil y se aplique sola. Los campos que
// eso necesita —el tipo en el perfil, y el tipo APLICADO congelado en la factura (regla 29: una
// emitida no se recalcula)— exigen migración, y las migraciones están paradas por SCRUM-383.
//
// Así que aquí se entrega el CÁLCULO, aislado y probado, sin llamadores. Lo que falta es el
// campo, no el mecanismo.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// EL CONTROL NEGATIVO ES EL QUE MÁS IMPORTA
//
// Esto toca el cálculo de un documento fiscal, así que lo primero que hay que demostrar es que
// **para quien no retiene no cambia absolutamente nada**. De ahí que el módulo no toque
// `calcVatBreakdown` ni `grossOfLines` — y que haya un test que lo VIGILA, no que lo afirme.

import test from 'node:test';
import { soloEjecutable } from './_guard-texto.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  calcularRetencion, liquidoAPercibir, bloqueRetencion, leerTipoRetencion,
  esTipoRetencionValido, TIPOS_RETENCION,
} from '../dist/modules/invoicing/domain/retencionIrpf.js';
import { calcVatBreakdown } from '../dist/modules/invoicing/domain/vat.service.js';
import { grossOfLines } from '../dist/modules/invoicing/domain/invoiceLines.service.js';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

// ═══════════════════════════════════════════════════════════════════════════════════════════
// ① EL CASO CALCULADO A MANO — escrito aquí, no derivado del código
// ═══════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-293 · el caso de mil euros, hecho a mano', () => {
  // Una reforma de 1.000 € al 21 % de IVA, profesional con retención del 15 %:
  //
  //     Base imponible                    1.000,00
  //     IVA 21 %          1.000 × 0,21 =    210,00
  //     Total factura                     1.210,00   ← lo que se sella
  //     Retención 15 %    1.000 × 0,15 =    150,00   ← sobre la BASE, no sobre el total
  //     Líquido           1.210 − 150  =  1.060,00   ← lo que el cliente transfiere
  //
  // Los números de la derecha están calculados a mano y escritos a mano. Si el código cambia y
  // deja de dar esto, es el código el que se ha equivocado.
  const lineas = [{ qty: 1, price: 1000, tax: 0.21 }];
  const bd = calcVatBreakdown(lineas);
  assert.equal(bd.base, 1000.00, 'la base no es la esperada');
  assert.equal(bd.cuota, 210.00, 'la cuota no es la esperada');
  assert.equal(grossOfLines(lineas), 1210.00, 'el total no es el esperado');

  assert.equal(calcularRetencion(1000, 15), 150.00);
  assert.equal(liquidoAPercibir(1210, 150), 1060.00);

  const b = bloqueRetencion({ baseImponible: bd.base, total: grossOfLines(lineas), tipo: 15 });
  assert.deepEqual(b, { tipo: 15, base: 1000, retencion: 150, liquido: 1060 });
});

test('SCRUM-293 · la retención va sobre la BASE, nunca sobre el total', () => {
  // El error clásico, y caro: 1.210 × 15 % = 181,50 en vez de 150,00. Treinta y un euros y medio
  // en una factura de mil, y el descuadre aparece en el 111 meses después.
  assert.equal(calcularRetencion(1000, 15), 150.00);
  assert.notEqual(calcularRetencion(1210, 15), 150.00);
  assert.equal(calcularRetencion(1210, 15), 181.50, 'control: así sale el cálculo equivocado');
});

// ═══════════════════════════════════════════════════════════════════════════════════════════
// ② LOS REDONDEOS — que es donde estos cálculos se rompen
// ═══════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-293 · se redondea UNA vez, al final, a dos decimales', () => {
  // 333,33 × 15 % = 49,9995 → 50,00. Con un redondeo intermedio saldría 49,99 y el céntimo
  // habría que explicárselo a alguien.
  assert.equal(calcularRetencion(333.33, 15), 50.00);
  // 100,10 × 7 % = 7,007 → 7,01
  assert.equal(calcularRetencion(100.10, 7), 7.01);
  // 0,05 × 15 % = 0,0075 → 0,01 (medio arriba, como el resto de la casa)
  assert.equal(calcularRetencion(0.05, 15), 0.01);
  // 0,03 × 15 % = 0,0045 → 0,00
  assert.equal(calcularRetencion(0.03, 15), 0.00);
});

test('SCRUM-293 · el redondeo es el MISMO que el del resto de importes', () => {
  // Si esta función redondeara distinto de `calcVatBreakdown`, la retención y la base bailarían
  // un céntimo entre sí. Se comprueba contra el redondeo real de la casa, no contra una copia.
  const base = calcVatBreakdown([{ qty: 3, price: 33.333, tax: 0.21 }]).base;
  assert.equal(base, 100.00, 'suelo: la base viene ya redondeada a dos decimales');
  assert.equal(calcularRetencion(base, 15), 15.00);
});

test('SCRUM-293 · el líquido nunca se guarda: se deriva de total y retención', () => {
  assert.equal(liquidoAPercibir(1210, 150), 1060);
  assert.equal(liquidoAPercibir(121, 15), 106);
  // Y con céntimos que no cierran redondos:
  assert.equal(liquidoAPercibir(1210.01, 150.00), 1060.01);
});

// ═══════════════════════════════════════════════════════════════════════════════════════════
// ③ CONTROL NEGATIVO — quien NO retiene emite exactamente como hoy
// ═══════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-293 · CONTROL NEGATIVO: sin retención configurada NO hay bloque', () => {
  assert.equal(bloqueRetencion({ baseImponible: 1000, total: 1210, tipo: null }), null,
    '🔴 se está pintando un bloque de retención a quien no retiene');
});

test('SCRUM-293 · CONTROL NEGATIVO: el cálculo de la factura NO cambia para nadie', () => {
  // 🔴 EL TEST QUE MÁS IMPORTA. Se toca el cálculo de un documento fiscal para todo el mundo, así
  // que se demuestra que base, cuota y total salen IDÉNTICOS con el módulo cargado.
  const casos = [
    [[{ qty: 1, price: 1000, tax: 0.21 }], 1000, 210, 1210],
    [[{ qty: 2, price: 45, tax: 0.10 }], 90, 9, 99],
    [[{ qty: 1, price: 500, tax: 0.21 }, { qty: 1, price: 100, tax: 0.10 }], 600, 115, 715],
    [[{ qty: 1, price: 300, tax: 0 }], 300, 0, 300],
  ];
  for (const [lineas, base, cuota, total] of casos) {
    const bd = calcVatBreakdown(lineas);
    assert.equal(bd.base, base, `base de ${JSON.stringify(lineas)}`);
    assert.equal(bd.cuota, cuota, `cuota de ${JSON.stringify(lineas)}`);
    assert.equal(grossOfLines(lineas), total, `total de ${JSON.stringify(lineas)}`);
  }
});

test('SCRUM-293 · GUARD: el módulo no importa NADA del cálculo compartido', () => {
  // No basta con que hoy dé lo mismo: hay que impedir que mañana alguien enchufe la retención
  // dentro de `calcVatBreakdown`. Los 16 consumidores de esa función incluyen el SELLADO
  // (`registro.builder.ts` manda su base literal al XML), así que tocarla es tocar el camino de
  // emisión — y eso es una parada de la regla 38, no un refactor.
  const src = fs.readFileSync(path.join(RAIZ, 'src/modules/invoicing/domain/retencionIrpf.ts'), 'utf8');
  const sinComentarios = soloEjecutable(src);
  assert.doesNotMatch(sinComentarios, /^import /m,
    '🔴 el módulo ha dejado de ser aislado: si importa el cálculo compartido, ya no es un hueco seguro');
  for (const prohibido of ['calcVatBreakdown', 'grossOfLines', 'registro.builder', 'prisma']) {
    assert.ok(!sinComentarios.includes(prohibido),
      `🔴 el módulo toca «${prohibido}»: deja de ser aislado y entra en territorio de la regla 38`);
  }
  // Respaldo de la negación (SCRUM-237): esos nombres SÍ existen, así que su ausencia significa algo.
  const vat = fs.readFileSync(path.join(RAIZ, 'src/modules/invoicing/domain/vat.service.ts'), 'utf8');
  assert.match(vat, /calcVatBreakdown/, 'suelo: el nombre prohibido tiene que existir en la casa');
});

// ═══════════════════════════════════════════════════════════════════════════════════════════
// ④ EL SUELO FISCAL — «no lo sé» no puede colapsar en «no retiene»
// ═══════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-293 · SUELO: si la configuración no se puede leer, NO se cae a «sin retención»', () => {
  // Emitir sin la retención de alguien que retiene es un defecto fiscal MUDO: la factura sale, el
  // cliente la paga, y el descuadre aparece en el 111 meses después. Por eso el fallo de lectura
  // y el «no retiene» son valores DISTINTOS.
  for (const roto of [null, undefined, 0, 99, 'quince', {}, NaN]) {
    const r = leerTipoRetencion(roto);
    assert.equal(r.ok, false, `🔴 ${JSON.stringify(roto) ?? 'undefined'} se está tragando como «no retiene»`);
    assert.ok(r.motivo, 'el fallo tiene que decir POR QUÉ');
  }
  // Y el «no retiene» declarado sí es un sí, con su valor propio.
  assert.deepEqual(leerTipoRetencion(false), { ok: true, tipo: null });
  for (const t of TIPOS_RETENCION) assert.deepEqual(leerTipoRetencion(t), { ok: true, tipo: t });
});

test('SCRUM-293 · los tipos son un conjunto CERRADO', () => {
  assert.deepEqual([...TIPOS_RETENCION], [15, 7, 2, 1]);
  assert.equal(esTipoRetencionValido(15), true);
  assert.equal(esTipoRetencionValido(7.5), false, '🔴 un tipo inventado se está aceptando');
  assert.equal(esTipoRetencionValido('15'), false);
});
