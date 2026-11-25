// tests/scrum1818b-selector-de-plan.test.mjs — SCRUM-1818b (puesto S2, 25-nov-2026)
//
// El FRONT de SCRUM-1818: en Informes, la tarjeta «Funnel de plataforma» (solo fundador) deja de
// cortar en 15 comercios y cada fila lleva un selector de plan + «Cambiar plan», que llama a la ruta
// de S1 `PUT /admin/plataforma/merchants/:id/plan` con `{ plan }`. Motivo: el 20-nov-2026 activar el
// plan Equipo del piloto exigió editar a mano `merchants.plan` en Railway.
//
// MICROCOPY FIRMADA: SCRUM-1656 c.22694. Aquí se copia SOLO para compararla byte a byte.
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cargarDashboard, pintarVista, todos } from './_banco-vistas.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** Las mutaciones que tienen que tumbarme (SCRUM-745). */
export const MUTACIONES_QUE_ME_TUMBAN = [
  {
    fichero: 'public/dashboard/js/reportsView.js',
    de: 'const rows = data.merchants || [];',
    a: 'const rows = (data.merchants || []).slice(0, 15);',
    cae: 'SCRUM-1818b · 🔴 la tabla enseña TODOS los comercios (sin el tope de 15) y cada fila lleva su selector',
  },
  {
    fichero: 'public/dashboard/js/reportsView.js',
    de: 'if (!window.confirm(pregunta)) {',
    a: 'if (false) {',
    cae: 'SCRUM-1818b · 🔴 decir que NO a la confirmación no cambia nada',
  },
  {
    fichero: 'public/dashboard/js/reportsView.js',
    de: "{ method: 'PUT', body: JSON.stringify({ plan: nuevo }) }",
    a: "{ method: 'PUT', body: JSON.stringify({ plan: actual }) }",
    cae: 'SCRUM-1818b · 🔴 cambiar el plan: confirma con el literal, hace el PUT con el plan elegido y avisa del éxito',
  },
  {
    fichero: 'public/dashboard/js/reportsView.js',
    de: "403: 'Solo la cuenta del fundador puede cambiar planes.',",
    a: '',
    cae: 'SCRUM-1818b · 🔴 cada fallo dice SU literal firmado, nunca el texto del servidor',
  },
];

const PLANES = ['trial', 'pro', 'founding', 'equipo'];
const BOTON = 'Cambiar plan';
const confirmacion = (nombre, actual, nuevo) =>
  `¿Cambiar el plan de ${nombre} de ${actual} a ${nuevo}? Solo cambia el plan dentro de YaQu: no toca Stripe ni cobra nada.`;
const exito = (nombre, nuevo) => `Plan de ${nombre}: ${nuevo}.`;
const ERRORES = {
  400: 'Ese plan no existe. Los que hay: trial, pro, founding, equipo.',
  403: 'Solo la cuenta del fundador puede cambiar planes.',
  404: 'Ese comercio ya no existe.',
};
const OTRO = 'No se pudo cambiar el plan. Inténtalo otra vez.';

// 20 comercios: más de 15, para que el tope viejo se note. El 1 es el de la primera fila.
const COMERCIOS = Array.from({ length: 20 }, (_, i) => ({
  id: 100 + i, name: `ZZComercio ${i + 1}`, registeredAt: '2026-11-01T10:00:00Z', acquisitionSource: null,
  plan: i === 0 ? 'trial' : 'pro', quotes: 0, sent: 0, accepted: 0, collectedCount: 0, collectedAmount: 0,
}));
const FUNNEL = {
  steps: { registered: 20, firstQuote: 0, sent: 0, accepted: 0, collected: 0 },
  paidVia: {}, quoteCreatedVia: {}, bySource: [], merchants: COMERCIOS,
};

async function informes({ confirma = true, fallo = null } = {}) {
  const banco = cargarDashboard(RAIZ, { rol: 'admin' });
  const llamadas = [];
  const preguntas = [];
  const avisos = [];
  banco.ctx.apiRequest = async (u, o) => {
    const url = String(u);
    llamadas.push({ u: url, o: o || {} });
    if (o && o.method === 'PUT') {
      // `fallo: true` = error de red, sin `status`.
      if (fallo) { const e = new Error('API fallo'); e.status = fallo === true ? undefined : fallo; e.data = { error: 'x', message: 'texto del servidor' }; throw e; }
      return { id: 100, plan: JSON.parse(o.body).plan, antes: 'trial' };
    }
    if (/\/admin\/metrics\/platform-funnel/.test(url)) return FUNNEL;
    if (/\/admin\/metrics\//.test(url)) return {};
    return {};
  };
  banco.ctx.confirm = (m) => { preguntas.push(m); return confirma; };
  banco.ctx.showToast = (m, k = 'ok') => { avisos.push([m, k]); };
  const r = await pintarVista(banco, 'renderReportsView');
  assert.equal(r.error, null, `🔴 SUELO: Informes no monta (${r.error && r.error.message})`);
  await new Promise((ok) => setTimeout(ok, 20)); // la tarjeta del funnel carga sin `await`
  const nodos = () => todos(r.contenedor);
  const texto = (n) => String(n.textContent || '').trim();
  const selectores = () => nodos().filter((n) => n.tagName === 'SELECT' && /^Plan de /.test(String(n.getAttribute?.('aria-label') ?? '')));
  const botones = () => nodos().filter((n) => n.tagName === 'BUTTON' && texto(n) === BOTON);
  const puts = () => llamadas.filter((l) => l.o.method === 'PUT');
  return { banco, nodos, texto, selectores, botones, puts, preguntas, avisos };
}

async function pulsar(nodo) {
  const fns = (nodo._oyentes && nodo._oyentes.click) || [];
  assert.ok(fns.length > 0, `🔴 CIEGO: «${nodo.textContent}» no tiene ningún oyente de clic`);
  await Promise.all(fns.map((fn) => fn.call(nodo, { type: 'click', target: nodo, currentTarget: nodo, preventDefault() {}, stopPropagation() {} })));
}

async function elegir(select, valor) {
  select.value = valor;
  const fns = (select._oyentes && select._oyentes.change) || [];
  await Promise.all(fns.map((fn) => fn.call(select, { type: 'change', target: select, currentTarget: select })));
}

test('SCRUM-1818b · 🔴 la tabla enseña TODOS los comercios (sin el tope de 15) y cada fila lleva su selector', async () => {
  const f = await informes();
  assert.ok(f.nodos().some((n) => f.texto(n) === 'ZZComercio 1'), '🔴 CIEGO: la tarjeta del funnel no se pinta (ni el comercio 1)');
  assert.ok(f.nodos().some((n) => f.texto(n) === 'ZZComercio 20'), '🔴 el comercio 20 no sale: la tabla sigue cortando en 15');
  assert.equal(f.selectores().length, 20, `🔴 hay ${f.selectores().length} selectores de plan para 20 comercios`);
  assert.equal(f.botones().length, 20, `🔴 hay ${f.botones().length} botones «${BOTON}» para 20 comercios`);
});

test('SCRUM-1818b · las opciones son los cuatro valores literales y el aria-label es el firmado', async () => {
  const f = await informes();
  const s = f.selectores()[0];
  assert.equal(s.getAttribute('aria-label'), 'Plan de ZZComercio 1', '🔴 el aria-label no es «Plan de {nombre}»');
  const opciones = todos(s).filter((n) => n.tagName === 'OPTION');
  assert.deepEqual(opciones.map((o) => o.value), PLANES, '🔴 los valores de las opciones no son trial · pro · founding · equipo');
  assert.deepEqual(opciones.map((o) => f.texto(o)), PLANES, '🔴 el texto de las opciones no es el valor literal');
  assert.equal(s.value, 'trial', '🔴 el selector no arranca en el plan actual del comercio');
});

test('SCRUM-1818b · 🔴 cambiar el plan: confirma con el literal, hace el PUT con el plan elegido y avisa del éxito', async () => {
  const f = await informes();
  const s = f.selectores()[0];
  const b = f.botones()[0];
  await elegir(s, 'equipo');
  await pulsar(b);
  assert.deepEqual(f.preguntas, [confirmacion('ZZComercio 1', 'trial', 'equipo')], '🔴 la confirmación no es la firmada, byte a byte');
  const p = f.puts();
  assert.equal(p.length, 1, '🔴 no sale el PUT');
  assert.equal(p[0].u, '/admin/plataforma/merchants/100/plan', '🔴 el PUT no va a la ruta de S1 con el id del comercio');
  assert.deepEqual(JSON.parse(p[0].o.body), { plan: 'equipo' }, '🔴 el cuerpo del PUT no lleva el plan elegido');
  assert.deepEqual(f.avisos, [[exito('ZZComercio 1', 'equipo'), 'ok']], '🔴 el aviso de éxito no es el firmado');
});

test('SCRUM-1818b · 🔴 decir que NO a la confirmación no cambia nada', async () => {
  const f = await informes({ confirma: false });
  await elegir(f.selectores()[0], 'pro');
  await pulsar(f.botones()[0]);
  assert.equal(f.preguntas.length, 1, '🔴 CIEGO: no se ha preguntado');
  assert.equal(f.puts().length, 0, '🔴 con «Cancelar» en la confirmación, el plan se ha cambiado igual');
});

test('SCRUM-1818b · 🔴 cada fallo dice SU literal firmado, nunca el texto del servidor', async () => {
  for (const [status, literal] of [[400, ERRORES[400]], [403, ERRORES[403]], [404, ERRORES[404]], [500, OTRO], [undefined, OTRO]]) {
    const f = await informes({ fallo: status ?? true });
    await elegir(f.selectores()[0], 'founding');
    await pulsar(f.botones()[0]);
    assert.equal(f.puts().length, 1, `🔴 CIEGO: con el fallo ${status} no salió el PUT`);
    assert.deepEqual(f.avisos, [[literal, 'error']], `🔴 con el fallo ${status} el aviso no es «${literal}»`);
  }
});
