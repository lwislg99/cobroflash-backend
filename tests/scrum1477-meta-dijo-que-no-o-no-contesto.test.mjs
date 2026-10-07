// tests/scrum1477-meta-dijo-que-no-o-no-contesto.test.mjs — SCRUM-1477
//
// «META DIJO QUE NO» Y «META NO CONTESTÓ» SON LO CONTRARIO, Y `whatsapp.ts` DEVOLVÍA LO MISMO.
//
// Con un «no» de Meta el mensaje no ha salido. Sin respuesta, no se sabe: puede haber salido, y
// decirle al profesional que no salió es como acaba mandándolo dos veces. Los siete envíos
// devolvían `{ ok: false, error }` en los dos casos, sin nombre.
//
// QUÉ SE COMPRUEBA
//   ① ejecutado: los siete envíos, contra un servidor de laboratorio que contesta 4xx, 5xx, no
//      contesta o corta, devuelven `desenlace` con el nombre que toca. Es `dist/` y es axios de
//      verdad; va en un proceso aparte (`_meta-de-laboratorio.mjs` explica por qué).
//   ② ejecutado aquí mismo: cuando la petición no llega a salir (el freno de SCRUM-180), los
//      siete dicen `no_enviado`.
//   ③ `reason` y `error` salen como salían. El campo es nuevo: quien no lo lea no nota nada.
//   ④ por AST: los `catch` que envuelven una llamada a Meta son siete, son los siete que mide el
//      laboratorio, y los siete devuelven lo mismo.
//
// QUÉ NO SE COMPRUEBA: nada de esto habla con Meta. Que un 4xx suyo signifique siempre «no ha
// salido» es lo que dice su API, no algo que este fichero pueda ver. Y el plazo real es de 10 s:
// el laboratorio comprueba que cada envío lo PIDE, y lo acorta para no esperarlo.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { inyectarBase, moduloDeDist, MERCHANT } from './_envio-doblado.mjs';
import { CASOS, ENVIOS } from './_meta-de-laboratorio.mjs';
import { telefonoDePrueba } from '../scripts/_telefonos-prueba.mjs';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const LABORATORIO = path.join(AQUI, '_meta-de-laboratorio.mjs');
const FUENTE = path.join(AQUI, '..', 'src', 'integrations', 'whatsapp.ts');
const SIETE = Object.keys(ENVIOS);
const PLAZO_REAL_MS = 10_000;

/**
 * El entorno del proceso de laboratorio, construido a mano. Fuera lo que lo convertiría en un
 * proceso de test (el freno de SCRUM-180 lanzaría y no se mediría nada), lo que le haría escribir
 * su informe encima del de la tanda, el color, el dry-run y cualquier proxy: la única dirección
 * a la que habla es 127.0.0.1.
 */
function entornoDelLaboratorio() {
  const env = { ...process.env };
  for (const clave of Object.keys(env)) {
    if (/^(NODE_TEST_CONTEXT|NODE_OPTIONS|FORCE_COLOR|WHATSAPP_DRY_RUN)$/.test(clave)) delete env[clave];
    if (/^(https?|all|no)_proxy$/i.test(clave)) delete env[clave];
  }
  return env;
}

const medidas = new Map();
/** Lanza el laboratorio para un caso (una vez) y comprueba que MIDIÓ antes de devolver nada. */
function medir(caso) {
  if (medidas.has(caso)) return medidas.get(caso);
  const r = spawnSync(process.execPath, [LABORATORIO, caso], {
    env: entornoDelLaboratorio(), encoding: 'utf8', timeout: 60_000,
  });
  assert.equal(r.status, 0, `🔴 CIEGO: el laboratorio no ha terminado bien (${caso}).\n${r.stderr}`);
  const m = JSON.parse(r.stdout);
  // EL SUELO. Un laboratorio que no llega a llamar se lee igual que uno donde todo va bien.
  assert.deepEqual(Object.keys(m.resultados), SIETE, `🔴 CIEGO: no se han medido los siete envíos (${caso}).`);
  assert.equal(m.recibidas, SIETE.length,
    `🔴 CIEGO: el servidor de laboratorio ha recibido ${m.recibidas} peticiones y se han hecho ${SIETE.length} envíos (${caso}).`);
  assert.equal(new Set(m.salidas.map((s) => `${s.protocolo}//${s.destino}`)).size, 1,
    `🔴 los siete envíos ya no piden el mismo destino (${caso}): alguno habla con otro sitio.`);
  assert.deepEqual(m.salidas.map((s) => s.plazoPedidoMs), SIETE.map(() => PLAZO_REAL_MS),
    `🔴 algún envío ya no pide el plazo de ${PLAZO_REAL_MS} ms a Meta (${caso}).`);
  medidas.set(caso, m);
  return m;
}

/** Los siete resultados de un caso, cada uno reducido a lo que se afirma de él. */
const loQueDevuelven = (caso) => Object.fromEntries(
  Object.entries(medir(caso).resultados).map(([envio, r]) => [envio, { ok: r.ok, desenlace: r.desenlace, reason: r.reason, error: r.error }]),
);
const losSieteIgual = (forma) => Object.fromEntries(SIETE.map((envio) => [envio, forma]));

// ═══ SUELO ══════════════════════════════════════════════════════════════════════════════════

test('SCRUM-1477 · SUELO: con Meta contestando 200, los siete envíos SALEN y no llevan desenlace', () => {
  assert.deepEqual(
    Object.fromEntries(Object.entries(medir('responde-200').resultados).map(([envio, r]) => [envio, { ok: r.ok, desenlace: r.desenlace }])),
    losSieteIgual({ ok: true, desenlace: null }),
    '🔴 CIEGO: el laboratorio no consigue que un envío salga bien, así que sus fallos no dicen nada.');
});

// ═══ ① META DIJO QUE NO ═════════════════════════════════════════════════════════════════════

test('SCRUM-1477 · 🔴 Meta contesta 400 → los siete dicen `rechazado`, y `error` sigue siendo el cuerpo de Meta', () => {
  assert.deepEqual(loQueDevuelven('meta-400'),
    losSieteIgual({ ok: false, desenlace: 'rechazado', reason: null, error: CASOS['meta-400'].cuerpo }),
    '🔴 Meta ha dicho que NO y el envío no lo dice con nombre (o ha cambiado `reason` o `error`, que otros leen).');
});

test('SCRUM-1477 · 🔴 Meta contesta 401 → los siete dicen `rechazado`', () => {
  assert.deepEqual(loQueDevuelven('meta-401'),
    losSieteIgual({ ok: false, desenlace: 'rechazado', reason: null, error: CASOS['meta-401'].cuerpo }));
});

test('SCRUM-1477 · 🔴 Meta contesta 429 (su límite de ritmo) → los siete dicen `rechazado`', () => {
  assert.deepEqual(loQueDevuelven('meta-429'),
    losSieteIgual({ ok: false, desenlace: 'rechazado', reason: null, error: CASOS['meta-429'].cuerpo }));
});

// ═══ ② META NO CONTESTÓ: NO SE SABE ═════════════════════════════════════════════════════════

test('SCRUM-1477 · 🔴 Meta NO contesta y vence el plazo → los siete dicen `sin_respuesta`, que es OTRO nombre', () => {
  const m = medir('sin-respuesta');
  assert.deepEqual(
    Object.fromEntries(Object.entries(m.resultados).map(([envio, r]) => [envio, { ok: r.ok, desenlace: r.desenlace, reason: r.reason, tipoDeError: r.tipoDeError }])),
    losSieteIgual({ ok: false, desenlace: 'sin_respuesta', reason: null, tipoDeError: 'string' }),
    '🔴 la petición LLEGÓ al servidor y no hubo respuesta: el mensaje puede haber salido. Si esto dice '
    + '`rechazado`, el profesional leerá que no salió y lo mandará otra vez.');
  for (const [envio, r] of Object.entries(m.resultados)) {
    assert.match(r.error, /^timeout of \d+ms exceeded$/, `🔴 CIEGO: el fallo de ${envio} no es el plazo vencido de axios.`);
  }
});

test('SCRUM-1477 · 🔴 la conexión se CORTA después de recibir el envío → los siete dicen `sin_respuesta`', () => {
  assert.deepEqual(loQueDevuelven('corte'),
    losSieteIgual({ ok: false, desenlace: 'sin_respuesta', reason: null, error: 'socket hang up' }));
});

test('SCRUM-1477 · 🔴 Meta contesta 500 → `sin_respuesta`, aunque `error` sea un objeto como en un 4xx', () => {
  assert.deepEqual(loQueDevuelven('meta-500'),
    losSieteIgual({ ok: false, desenlace: 'sin_respuesta', reason: null, error: CASOS['meta-500'].cuerpo }),
    '🔴 con un 5xx no se sabe si el mensaje salió. Y `error` llega como OBJETO, igual que en un 4xx: '
    + 'quien distinguiera por la forma de `error` lo daría por rechazado.');
});

test('SCRUM-1477 · 🔴 Meta contesta 503 → `sin_respuesta`', () => {
  assert.deepEqual(loQueDevuelven('meta-503'),
    losSieteIgual({ ok: false, desenlace: 'sin_respuesta', reason: null, error: CASOS['meta-503'].cuerpo }));
});

test('SCRUM-1477 · 🔴 el 408 es un 4xx y NO es un rechazo: dice que venció el plazo → `sin_respuesta`', () => {
  assert.deepEqual(loQueDevuelven('meta-408'),
    losSieteIgual({ ok: false, desenlace: 'sin_respuesta', reason: null, error: CASOS['meta-408'].cuerpo }));
});

// ═══ ③ NO LLEGÓ A SALIR ═════════════════════════════════════════════════════════════════════

test('SCRUM-1477 · 🔴 la petición NO llega a salir (el freno de SCRUM-180) → los siete dicen `no_enviado`', async () => {
  inyectarBase({ 'customer.findMany': () => [] });
  const { config } = moduloDeDist('../dist/core/config/env.js');
  const antes = { dry: process.env.WHATSAPP_DRY_RUN, id: config.WHATSAPP_PHONE_NUMBER_ID, token: config.WHATSAPP_ACCESS_TOKEN };
  delete process.env.WHATSAPP_DRY_RUN;
  config.WHATSAPP_PHONE_NUMBER_ID = 'laboratorio-1477';
  config.WHATSAPP_ACCESS_TOKEN = 'laboratorio-1477';
  const errorDeConsola = console.error;
  console.error = () => {};
  try {
    const wa = moduloDeDist('../dist/integrations/whatsapp.js');
    const vistos = {};
    for (const [envio, extra] of Object.entries(ENVIOS)) {
      const r = await wa[envio]({ to: telefonoDePrueba(77), merchantId: MERCHANT, ...extra });
      assert.match(String(r.error), /^SCRUM-180: /, `🔴 CIEGO: ${envio} no ha fallado por el freno de salida a Meta.`);
      vistos[envio] = { ok: r.ok, desenlace: r.desenlace, reason: r.reason };
    }
    assert.deepEqual(vistos, losSieteIgual({ ok: false, desenlace: 'no_enviado', reason: undefined }),
      '🔴 aquí se SABE que el mensaje no ha salido —no se llegó a llamar— y el envío no lo dice.');
  } finally {
    console.error = errorDeConsola;
    process.env.WHATSAPP_DRY_RUN = antes.dry;
    config.WHATSAPP_PHONE_NUMBER_ID = antes.id;
    config.WHATSAPP_ACCESS_TOKEN = antes.token;
  }
});

// ═══ ④ LOS SIETE, POR AST ═══════════════════════════════════════════════════════════════════

const ts = createRequire(import.meta.url)('typescript');

/** Los `catch` cuyo `try` llama a `metaHttp.post`, con la función que los contiene y lo que devuelven. */
function catchDeMeta(fuente) {
  const sf = ts.createSourceFile('whatsapp.ts', fuente, ts.ScriptTarget.Latest, true);
  const llamaAMeta = (nodo) => {
    let si = false;
    const mira = (n) => {
      if (ts.isCallExpression(n) && n.expression.getText(sf) === 'metaHttp.post') si = true;
      else ts.forEachChild(n, mira);
    };
    mira(nodo);
    return si;
  };
  const hallados = [];
  const visita = (n, funcion) => {
    const dentroDe = ts.isFunctionDeclaration(n) && n.name ? n.name.text : funcion;
    if (ts.isTryStatement(n) && n.catchClause && llamaAMeta(n.tryBlock)) {
      const devuelve = n.catchClause.block.statements.filter(ts.isReturnStatement).map((r) => r.expression?.getText(sf) ?? '');
      hallados.push({ funcion: dentroDe, devuelve });
    }
    ts.forEachChild(n, (h) => visita(h, dentroDe));
  };
  visita(sf, null);
  return hallados;
}

const DEVUELVE = '{ ok: false, error: err?.response?.data || err?.message, desenlace: desenlaceDeMeta(err) }';

test('SCRUM-1477 · SUELO: el censo VE un `catch` de Meta que no dice el desenlace, y no cuenta los que no llaman a Meta', () => {
  const hallados = catchDeMeta(`
    async function conMeta() { try { await metaHttp.post(u, c); } catch (err: any) { return { ok: false, error: err?.message }; } }
    async function sinMeta() { try { await otraCosa(); } catch (err: any) { return null; } }
  `);
  assert.deepEqual(hallados, [{ funcion: 'conMeta', devuelve: ['{ ok: false, error: err?.message }'] }]);
});

/**
 * Lo que llama a Meta y NO es un envío. `markInboundRead` marca como leído el mensaje que nos
 * llegó (y enseña «escribiendo…»): no manda nada a nadie y no devuelve resultado, así que no
 * tiene desenlace que contar. Son dos `try`: el que lleva el indicador y el de reserva sin él.
 */
const NO_ES_UN_ENVIO = Object.freeze({ markInboundRead: 2 });

test('SCRUM-1477 · 🔴 los `catch` que envuelven una llamada a Meta son SIETE, los que mide el laboratorio, y devuelven lo mismo', () => {
  const todos = catchDeMeta(fs.readFileSync(FUENTE, 'utf8'));
  const aparte = todos.filter((h) => h.funcion in NO_ES_UN_ENVIO);
  assert.deepEqual(aparte, [
    { funcion: 'markInboundRead', devuelve: [] },
    { funcion: 'markInboundRead', devuelve: [] },
  ], '🔴 lo declarado como «no es un envío» ha cambiado: o ya no son dos, o ahora devuelve algo. Si '
    + 'devuelve un resultado, es un envío y tiene que decir su desenlace.');
  const hallados = todos.filter((h) => !(h.funcion in NO_ES_UN_ENVIO));
  assert.deepEqual(hallados.map((h) => h.funcion).sort(), [...SIETE].sort(),
    '🔴 los envíos que llaman a Meta ya no son los siete que ejercita el laboratorio. Si hay uno nuevo, '
    + 'se añade a `ENVIOS` en `tests/_meta-de-laboratorio.mjs`: sin eso, su `catch` no lo ejecuta nadie.');
  assert.deepEqual(hallados.map((h) => h.devuelve), SIETE.map(() => [DEVUELVE]),
    '🔴 algún `catch` devuelve otra cosa. Los siete tienen que decir lo mismo para el mismo caso.');
});
