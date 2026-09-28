// tests/scrum1216a-serie-sin-promesa.test.mjs — SCRUM-1216a
//
// ═════════════════════════════════════════════════════════════════════════════════════════
// LA PANTALLA DE LA SERIE DEJA DE PROMETER LO QUE NO HACE
//
// «Seguimos por ahí para que tu numeración no tenga saltos.» es FALSA desde el corte de la serie F
// (SCRUM-780, `ba1cd2d5`, 7-sep-2026): la factura ordinaria sale `F<AA><NNNN>` derivada de lo
// emitido y el número declarado no llega a ella (medido por J1 contra el `allocateInvoiceNumber`
// real: con «41» y sin nada, las dos `F260001`). Que llegue es SCRUM-1216b; esto es lo urgente que
// no toca el camino de emisión:
//
//   · se retira la promesa de las DOS pantallas (el alta y la puerta D1 de Ajustes);
//   · en `receipt` (ES real, `INVOICING_ES_ENABLED` OFF — regla 24: YaQu no emite nada) NO se enseña
//     ni el paso del alta ni la puerta de Ajustes. Medido: `puertaSerieDisponible` no mira el modo,
//     así que la puerta de Ajustes salía en `receipt`; y guardar por detrás la cerraría sólo ese año
//     (el 1-ene se reabre, y un merchant en `receipt` no emite nunca para volver a cerrarla).
//
// El campo «Número» SE QUEDA: lo necesita 1216b (decisión del orquestador, 28-sep-2026).
//
// Se MONTA con el banco de vistas y se pulsa, en las dos pantallas y en los dos modos.
// ═════════════════════════════════════════════════════════════════════════════════════════
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cargarDashboard, todos } from './_banco-vistas.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ANIO = new Date().getFullYear();
const PROMESA_FALSA = 'Seguimos por ahí para que tu numeración no tenga saltos.';
const PASO_SERIE = `¿Ya has facturado en ${ANIO}?`;

function montar(modo) {
  const peticiones = [];
  const banco = cargarDashboard(RAIZ, {
    datos: (url, opts) => {
      peticiones.push({ url, cuerpo: opts?.body ? JSON.parse(opts.body) : null });
      if (url.endsWith('/admin/onboarding/serie/previa')) return { ok: true, proximoNumero: 'F260001' };
      return /\/admin\/products$/.test(url) ? [] : {};
    },
  });
  banco.ctx.appModoEmision = modo;
  const id = (x) => banco.reg.porId.get(x) || null;
  const pulsar = async (n) => {
    assert.ok(n, 'no existe el botón');
    for (const f of n._oyentes.click || []) await f.call(n, { type: 'click', target: n, preventDefault() {}, stopPropagation() {} });
  };
  return { banco, id, pulsar, peticiones };
}

/** Todo el texto que la pantalla lleva: el marcado asignado y el texto puesto en cada nodo. */
const textoDe = (raiz) => todos(raiz).map((n) => `${n._html ?? ''} ${n._texto ?? ''}`).join('\n');

/** Recorre el asistente entero pulsando «Siguiente» (rama «Sí» + 41 si sale el paso de la serie). */
async function recorrerAlta(m) {
  m.banco.ctx.showOnboardingWizard(() => {});
  const titulo = () => m.banco.ctx.document.body.querySelector('#ob-steps h2')?.textContent?.trim();
  const titulos = [titulo()];
  const pantallas = [];
  m.id('ob-name').value = 'Fontanería Pepe';
  for (let i = 0; i < 6 && m.id('ob-next'); i += 1) {
    if (titulo() === PASO_SERIE) {
      await m.pulsar(m.id('ob-serie-si'));
      m.id('ob-serie-numero').value = '41';
    }
    pantallas.push(textoDe(m.banco.ctx.document.body));
    await m.pulsar(m.id('ob-next'));
    titulos.push(titulo());
  }
  pantallas.push(textoDe(m.banco.ctx.document.body));
  return { titulos, todo: pantallas.join('\n') };
}

// ═════════════════════════════════════════════════════════════════════════════════════════
// ① EL ALTA
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-1216a · 🔴 RECEIPT · el alta NO enseña el paso de la serie ni la promesa, y no guarda numeración', async () => {
  const m = montar('receipt');
  const { titulos, todo } = await recorrerAlta(m);
  assert.ok(!titulos.includes(PASO_SERIE), `🔴 en receipt el alta pregunta por la numeración de facturas: ${JSON.stringify(titulos)}`);
  assert.ok(!todo.includes(PROMESA_FALSA), '🔴 en receipt el alta sigue prometiendo continuidad de numeración');
  assert.equal(m.peticiones.filter((p) => /\/admin\/onboarding\/serie/.test(p.url)).length, 0,
    '🔴 en receipt el alta guarda o previsualiza numeración de facturas');
  // Control: el asistente SÍ se recorrió (no es un verde por no haber pintado nada).
  assert.ok(new Set(titulos.filter(Boolean)).size >= 3, `el asistente no avanzó: ${JSON.stringify(titulos)}`);
});

test('SCRUM-1216a · FISCAL · el paso sale, sin la promesa, y sigue guardando lo que guardaba', async () => {
  const m = montar('fiscal');
  const { titulos, todo } = await recorrerAlta(m);
  // CONTROL POSITIVO del filtro: fuera de receipt el paso NO se ha caído.
  assert.ok(titulos.includes(PASO_SERIE), `🔴 fuera de receipt el paso de la serie ha desaparecido: ${JSON.stringify(titulos)}`);
  assert.ok(!todo.includes(PROMESA_FALSA), '🔴 la promesa falsa sigue en el alta');
  assert.ok(todo.includes('Tu primera factura con YaQu será:'), 'suelo: la vista previa sigue en el alta');
  const guardado = m.peticiones.filter((p) => p.url.endsWith('/admin/onboarding/serie'));
  assert.equal(guardado.length, 1, 'el paso tiene que seguir guardando');
  assert.equal(guardado[0].cuerpo.vieneDeOtroSitio, true);
  assert.equal(guardado[0].cuerpo.ultimoNumero, 41, 'el campo «Número» se queda para 1216b');
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// ② AJUSTES — la puerta D1
// ═════════════════════════════════════════════════════════════════════════════════════════

function pintarPuerta(m) {
  const panel = m.banco.ctx.document.createElement('div');
  return { panel, caja: m.banco.ctx.renderPuertaSerie(panel, { veredicto: true, anio: ANIO }) };
}

test('SCRUM-1216a · 🔴 RECEIPT · la puerta de Ajustes NO se pinta aunque el servidor la ofrezca', () => {
  const m = montar('receipt');
  const { panel, caja } = pintarPuerta(m);
  assert.equal(caja, null, '🔴 en receipt la puerta de Ajustes sigue saliendo');
  assert.ok(!textoDe(panel).includes(PASO_SERIE), '🔴 en receipt Ajustes pregunta por la numeración de facturas');
  assert.equal(m.banco.ctx.puertaSerieVisible(true), false, '🔴 en receipt la visibilidad pura dice que sí');
});

test('SCRUM-1216a · FISCAL · la puerta sale, sin la promesa, y la visibilidad sigue obedeciendo al servidor', () => {
  const m = montar('fiscal');
  const { caja } = pintarPuerta(m);
  assert.ok(caja, '🔴 fuera de receipt la puerta ha dejado de pintarse');
  const marcado = textoDe(caja);
  assert.ok(marcado.includes(PASO_SERIE), 'suelo: la puerta pinta su pregunta');
  assert.ok(!marcado.includes(PROMESA_FALSA), '🔴 la promesa falsa sigue en Ajustes');
  assert.equal(m.banco.ctx.puertaSerieVisible(true), true);
  assert.equal(m.banco.ctx.puertaSerieVisible(false), false, 'fuera de receipt manda el servidor');
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// ③ EN EL FUENTE — la promesa no vuelve, en ninguna de las dos pantallas
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-1216a · la promesa no está en el código de ninguna de las dos pantallas', () => {
  for (const f of ['public/dashboard/js/onboardingView.js', 'public/dashboard/js/puertaSerie.js']) {
    const codigo = fs.readFileSync(path.join(RAIZ, f), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    assert.ok(/onboarding\/serie/.test(codigo), `CIEGO: ${f} no es la pantalla de la serie`);
    assert.ok(!codigo.includes(PROMESA_FALSA), `🔴 ${f} conserva la promesa falsa`);
  }
});
