// tests/scrum1164-ocultar-en-receipt-inicio-planes.test.mjs — SCRUM-1164 (#3, #4, #7 · parte del panel, S4)
//
// Lo mismo que `scrum1164-ocultar-en-receipt-ficha-trabajo.test.mjs`, en Inicio y en Planes: en
// modo `receipt` (regla 24: ni factura ni cobro por YaQu) se CALLAN las afirmaciones de cobro y
// facturación, y en `fiscal`/`demo` siguen saliendo. Cada una se mide en los dos sentidos.
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cargarDashboard, pintarVista, todos } from './_banco-vistas.mjs';
import { casosEscritos } from './_casos-escritos.mjs';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

function textoDe(doc) {
  return todos(doc.body).map((n) => `${n.textContent || ''} ${typeof n.innerHTML === 'string' ? n.innerHTML : ''}`).join('\n');
}

function banco(modo) {
  const b = cargarDashboard(RAIZ);
  b.ctx.appModoEmision = modo;
  b.ctx.appUserRole = 'admin';
  return b;
}

// ── #4 · el checklist de Inicio ──────────────────────────────────────────────────────────
// Un negocio recién dado de alta: NADA hecho, así que todos los pasos que existan se pintan.
function checklist(modo) {
  const b = banco(modo);
  const doc = b.ctx.document;
  const hueco = doc.createElement('div');
  hueco.innerHTML = '<div class="kpi-grid"></div>';
  doc.body.appendChild(hueco);
  assert.ok(doc.querySelector('.kpi-grid'), '🔴 CIEGO: el banco no resuelve `.kpi-grid`, el checklist no tendría dónde montarse');
  b.ctx.renderSetupChecklist({ viasDeCobro: { cobroManual: false } }, { recentActivity: [], onboarding: {} });
  const texto = textoDe(doc);
  assert.ok(texto.includes('Completa tu configuración'), `🔴 CIEGO: el checklist no se pintó en modo ${modo}`);
  return texto;
}

const DEL_CHECKLIST = [
  ['paso «Cobra tu primer trabajo»', 'Cobra tu primer trabajo'],
  ['paso «Configura cómo cobras»', 'Configura cómo cobras'],
  ['nota «…o paguen» de WhatsApp', 'Te avisamos cuando acepten o paguen'],
  ['nota «tras pagar» de reseñas', 'Se lo pedimos al cliente tras pagar'],
];

const caso = casosEscritos(DEL_CHECKLIST, ([que, literal]) => `SCRUM-1164 · #4 · ${que}: sale en fiscal y en demo, y en receipt NO`, ([que, literal]) => {
  for (const modo of ['fiscal', 'demo']) {
    assert.ok(checklist(modo).includes(literal), `🔴 CONTROL: en ${modo} «${literal}» tiene que seguir saliendo — ocultar no es borrar`);
  }
  assert.ok(!checklist('receipt').includes(literal), `🔴 en receipt el checklist sigue afirmando «${literal}»`);
});
test('SCRUM-1164 · #4 · paso «Cobra tu primer trabajo»: sale en fiscal y en demo, y en receipt NO', caso(0));
test('SCRUM-1164 · #4 · paso «Configura cómo cobras»: sale en fiscal y en demo, y en receipt NO', caso(1));
test('SCRUM-1164 · #4 · nota «…o paguen» de WhatsApp: sale en fiscal y en demo, y en receipt NO', caso(2));
test('SCRUM-1164 · #4 · nota «tras pagar» de reseñas: sale en fiscal y en demo, y en receipt NO', caso(3));
caso.todos();

test('SCRUM-1164 · #4 · en receipt se quedan los pasos que SÍ se pueden cumplir, y el recuento cuadra con ellos', () => {
  const texto = checklist('receipt');
  for (const paso of ['Añade tu logo', 'Conecta tu WhatsApp', 'Enlace de reseñas de Google', 'Completa NIF y dirección',
    'Crea tu primer presupuesto', 'Carga tus precios', 'Que tu cliente firme un presupuesto']) {
    assert.ok(texto.includes(paso), `🔴 en receipt se ha perdido el paso «${paso}», que no depende del cobro`);
  }
  assert.ok(texto.includes('0/7'), '🔴 el contador no es 0/7: cuenta pasos que ya no se pintan (o pinta de más)');
  assert.ok(checklist('fiscal').includes('0/9'), '🔴 CONTROL: en fiscal el contador tiene que ser 0/9');
});

// ── #3 · la hoja de presupuesto rápido ────────────────────────────────────────────────────
test('SCRUM-1164 · #3 · «"100% al aceptar" genera la factura…»: en fiscal sí, en receipt NO', () => {
  const literal = 'genera la factura cuando el cliente firma';
  const ver = (modo) => {
    const b = banco(modo);
    b.ctx.openQuickQuoteModal();
    const texto = textoDe(b.ctx.document);
    assert.ok(texto.includes('Condiciones de pago'), `🔴 CIEGO: la hoja de presupuesto rápido no se abrió en ${modo}`);
    return texto;
  };
  assert.ok(ver('fiscal').includes(literal), '🔴 CONTROL: en fiscal la nota tiene que salir');
  assert.ok(!ver('receipt').includes(literal), '🔴 en receipt la hoja sigue prometiendo una factura');
});

// ── #7 · Planes ───────────────────────────────────────────────────────────────────────────
test('SCRUM-1164 · #7 · «+ 0,9 % solo cuando cobras con tarjeta…»: en fiscal sí, en receipt NO', async () => {
  const literal = 'solo cuando cobras con tarjeta';
  const ver = async (modo) => {
    const b = banco(modo);
    // La forma que lee `buildPlansHtml`: `plans[0]` es el plan único Pro.
    b.ctx.apiRequest = async () => ({
      currentPlan: 'trial', planExpiresAt: null, founding: null,
      plans: [{ id: 'pro', price: 19.9, priceAnnual: 199 }],
    });
    const r = await pintarVista(b, 'renderPlansView');
    assert.equal(r.error, null, `🔴 SUELO: Planes no monta en ${modo} (${r.error && r.error.message})`);
    const texto = textoDe(b.ctx.document);
    assert.ok(texto.includes('Plan Pro'), `🔴 CIEGO: la tarjeta del plan no se pintó en ${modo}`);
    return texto;
  };
  assert.ok((await ver('fiscal')).includes(literal), '🔴 CONTROL: en fiscal la nota de la comisión tiene que salir');
  assert.ok(!(await ver('receipt')).includes(literal), '🔴 en receipt Planes sigue hablando de cobrar con tarjeta, Bizum y transferencia');
});
