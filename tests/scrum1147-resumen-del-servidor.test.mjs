// tests/scrum1147-resumen-del-servidor.test.mjs — SCRUM-1147
//
// Había DOS cálculos de la misma cifra fiscal: `GET /admin/reports/resumen-trimestre` (SCRUM-1048,
// probado, sin ningún llamador) y el que hacía `reportsView.js` sumando cuotas de
// `recibidas.json` en el navegador. Medido antes del cambio: 0 diferencias en 2000 lotes, así que
// se retira el del navegador sin mover ninguna cifra.
//
// 🔴 EL QUE DECIDE: el servidor y `recibidas.json` se sirven DISCREPANDO a propósito. Si la
// pantalla vuelve a sumar por su cuenta, pinta la cifra de `recibidas.json` y este test cae.
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cargarDashboard, pintarVista, todos } from './_banco-vistas.mjs';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const eur = (n) => new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(n);
const sinNbsp = (s) => String(s || '').replace(/[  ]/g, ' ');

const RESUMEN = {
  año: 2026, trimestre: 3,
  ivaRepercutido: { porTipo: [{ tipo: 21, base: 100, cuota: 21 }], totalBase: 100, totalCuota: 21 },
  ivaSoportado: { porTipo: [{ tipo: 21, base: 160, cuota: 33.5 }], totalBaseDeducible: 160, totalCuotaDeducible: 33.5,
    noDeducible: { count: 0, importe: 0 }, sinClasificar: { count: 0, importe: 0 } },
  diferencia: -12.5, retenciones: { disponible: false, motivo: 'x' }, borradorParaAsesor: true,
  from: '2026-07-01', to: '2026-09-30', facturasSinDesglose: { count: 1, importe: 50 }, invoiceCount: 2, expenseCount: 1,
};
// Lo que un cálculo EN EL NAVEGADOR sacaría de aquí es 999 de soportado: tiene que NO salir.
const RECIBIDAS_DISCREPANTE = {
  filas: [{ base: 5000, tipoIva: 21, cuota: 999, deducible: 'Sí' }, { base: 10, tipoIva: 21, cuota: 2.1, deducible: 'No' }],
  miradas: 2, avisos: ['Formato provisional.'],
};
const VAT_DISCREPANTE = { currency: 'EUR', rates: [], totals: { base: 0, cuota: 777 }, invoiceCount: 2, excluded: { count: 9, total: 9 } };
const PL = { currency: 'EUR', months: Array.from({ length: 12 }, () => ({ revenue: 10, expenses: 5 })), totals: {} };

function montarInformes() {
  const pedidas = [];
  const banco = cargarDashboard(RAIZ, {
    datos: (url) => {
      const u = String(url);
      pedidas.push(u);
      if (/\/admin\/reports\/resumen-trimestre\?/.test(u)) return RESUMEN;
      if (/\/admin\/libros\/recibidas\.json\?/.test(u)) return RECIBIDAS_DISCREPANTE;
      if (/\/admin\/reports\/vat\?/.test(u)) return VAT_DISCREPANTE;
      if (/\/admin\/reports\/pl\?/.test(u)) return PL;
      if (/\/admin\/reports\/x2\?/.test(u)) return { paymentMethods: [], reminderSavings: null, agingBuckets: [] };
      return {};
    },
  });
  return { banco, pedidas };
}

const kpis = (raiz) => Object.fromEntries(todos(raiz).filter((n) => n.className === 'kpi-card').map((n) => {
  const l = todos(n).find((c) => c.className === 'kpi-label');
  const v = todos(n).find((c) => c.className === 'kpi-value');
  return [l && l.textContent, sinNbsp(v && v.textContent)];
}));

test('SCRUM-1147 · 🔴 Informes pinta las cifras de IVA DEL SERVIDOR, aunque recibidas.json diga otra cosa', async () => {
  const { banco, pedidas } = montarInformes();
  const r = await pintarVista(banco, 'renderReportsView');
  assert.equal(r.error, null, `🔴 Informes revienta: ${r.error && r.error.message}`);
  assert.ok(pedidas.some((u) => /\/admin\/reports\/resumen-trimestre\?/.test(u)), '🔴 la pantalla no pide el resumen del servidor');
  const k = kpis(r.contenedor);
  assert.ok('IVA soportado (deducible)' in k, 'CIEGO: no se pintó el bloque de soportado');
  assert.equal(k['IVA soportado (deducible)'], sinNbsp(eur(33.5)), '🔴 el soportado no es el del servidor: la pantalla está sumando por su cuenta');
  assert.equal(k['IVA repercutido'], sinNbsp(eur(21)), '🔴 el repercutido del resumen no es el del servidor');
});

test('SCRUM-1147 · la diferencia es la del servidor, negativa tal cual, con el rótulo firmado y sin palabras de claim', async () => {
  const { banco } = montarInformes();
  const r = await pintarVista(banco, 'renderReportsView');
  const k = kpis(r.contenedor);
  assert.equal(k['Diferencia (repercutido − soportado)'], sinNbsp(eur(-12.5)));
  const texto = todos(r.contenedor).map((n) => n.textContent || '').join(' ');
  for (const prohibida of [/a pagar/i, /a compensar/i, /a devolver/i, /lo que debes/i]) {
    assert.doesNotMatch(texto, prohibida, `🔴 reglas 7/24 · la diferencia se presenta como determinación fiscal (${prohibida})`);
  }
});

test('SCRUM-1147 · facturas sin desglose: del resumen del servidor, no de /vat', async () => {
  const { banco } = montarInformes();
  const r = await pintarVista(banco, 'renderReportsView');
  const notas = todos(r.contenedor).filter((n) => n.className === 'resumen-trimestre-nota').map((n) => sinNbsp(n.textContent));
  assert.ok(notas.some((t) => t.startsWith('⚠ 1 factura sin desglose de líneas')), `🔴 la nota no sale del resumen: ${JSON.stringify(notas)}`);
  assert.ok(!notas.some((t) => /⚠ 9 facturas/.test(t)), '🔴 la nota sigue leyendo `/vat`');
});

test('SCRUM-1147 · Home pregunta al resumen del servidor, y ya no a /vat ni a recibidas.json', async () => {
  const { banco, pedidas } = montarInformes();
  banco.ctx.appMerchantId = 1;
  const caja = banco.mk('div');
  caja.id = 'home-resumen-trimestre';
  pedidas.length = 0;
  await banco.ctx.pintarResumenTrimestreEnHome();
  assert.ok(pedidas.some((u) => /\/admin\/reports\/resumen-trimestre\?/.test(u)), '🔴 Home no pide el resumen del servidor');
  assert.ok(!pedidas.some((u) => /\/admin\/reports\/vat\?|\/admin\/libros\/recibidas\.json\?/.test(u)), `🔴 Home sigue pidiendo los orígenes viejos: ${pedidas.join(', ')}`);
  assert.match(todos(caja).map((n) => n.textContent || '').join(' '), /Tu resumen del trimestre ya está listo/, 'CIEGO: con datos el aviso tenía que salir');
});
