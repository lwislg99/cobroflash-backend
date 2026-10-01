// tests/scrum1373-drenado-avisa-firmas-confirmadas.test.mjs — SCRUM-1373
//
// EL DRENADO DICE QUÉ FIRMAS HA CONFIRMADO EL SERVIDOR.
//
// Es la mitad de S2 de «el detalle abierto no se entera de que la cola subió»: el drenado sólo
// repintaba la home, y una pantalla abierta sobre el documento no tenía cómo saber que su firma
// acababa de subir. Aquí se mide el AVISO y su contrato; que el detalle escuche y se recargue es la
// otra mitad (S4), y hasta entonces el defecto sigue declarado.
//
// Cola, almacén y drenado reales (banco con IndexedDB); la subida, inyectada.
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { montarAlmacen, porQueEstariaCiego } from './_banco-almacen-local.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CUERPO = Object.freeze({ signatureData: 'data:image/png;base64,AAAA', firmadoPorNombre: 'Aurora Benítez' });
const copia = (x) => JSON.parse(JSON.stringify(x));

/** Un `subirFirma` de mentira: responde por «tipo:id», o `porDefecto`. */
function subidorQue(respuestas) {
  return async (firma) => {
    const r = respuestas[`${firma.tipo}:${firma.albaranId}`] ?? respuestas.porDefecto;
    if (r instanceof Error) throw r;
    return r;
  };
}
const yaFirmado = () => Object.assign(new Error('Este albarán ya está firmado.'),
  { status: 409, code: 'albaran_locked', data: { error: 'albaran_locked' } });
const rechazada = () => Object.assign(new Error('x'), { status: 400, code: 'invalid_id', data: { error: 'invalid_id' } });

/** El banco con la cola sembrada y un oyente apuntando lo que le llega. */
async function montar(documentos) {
  const b = montarAlmacen(RAIZ);
  for (const [id, tipo] of documentos) {
    const r = await b.ctx.encolarFirma(id, CUERPO, tipo);
    assert.equal(r.estado, b.ctx.GUARDADO, '🔴 CIEGO: no se pudo sembrar la cola');
  }
  const avisos = [];
  const desuscribir = b.ctx.alConfirmarseFirmas((lista) => { avisos.push(copia(lista)); });
  return { b, avisos, desuscribir };
}
const porOrden = (lista) => [...lista].sort((x, y) => `${x.tipo}:${x.documentoId}`.localeCompare(`${y.tipo}:${y.documentoId}`));

test('SCRUM-1373 · 🔴 SUELO: el banco monta el drenado y publica la suscripción', () => {
  const b = montarAlmacen(RAIZ);
  assert.equal(porQueEstariaCiego(b, RAIZ), null, '🔴 BANCO CIEGO (almacén).');
  for (const n of ['drenarFirmasPendientes', 'encolarFirma', 'alConfirmarseFirmas']) {
    assert.equal(typeof b.ctx[n], 'function', `🔴 no está publicada \`${n}\`.`);
  }
});

test('SCRUM-1373 · 🔴 una firma que SUBE se avisa con su tipo y su id', async () => {
  const { b, avisos } = await montar([[7, undefined]]);
  const r = await b.ctx.drenarFirmasPendientes(subidorQue({ porDefecto: { id: 7, estado: 'firmado' } }), { plazoMs: 1000 });
  assert.equal(r.subidas, 1, '🔴 CIEGO: el drenado no subió la firma; no hay aviso que medir');
  assert.deepEqual(avisos, [[{ tipo: 'albaran', documentoId: 7 }]],
    '🔴 la firma del albarán 7 subió y nadie se entera: una pantalla abierta sobre él seguirá ofreciendo firmar.');
});

test('SCRUM-1373 · ✅ la que el servidor YA TENÍA también se avisa: para la pantalla es lo mismo', async () => {
  const { b, avisos } = await montar([[7, undefined]]);
  const r = await b.ctx.drenarFirmasPendientes(subidorQue({ porDefecto: yaFirmado() }), { plazoMs: 1000 });
  assert.equal(r.yaEstaban, 1, '🔴 CIEGO: el 409 no se leyó como «ya la tiene»');
  assert.deepEqual(avisos, [[{ tipo: 'albaran', documentoId: 7 }]]);
});

test('SCRUM-1373 · ✅ varias en un drenado: UN aviso con todas, y cada una con SU tipo (parte 7 no es albarán 7)', async () => {
  const { b, avisos } = await montar([[7, undefined], [7, 'parte'], [9, 'parte-tecnico']]);
  await b.ctx.drenarFirmasPendientes(subidorQue({ porDefecto: { ok: true, estado: 'firmado', id: 1 } }), { plazoMs: 1000 });
  assert.equal(avisos.length, 1, '🔴 se avisa más de una vez por drenado');
  assert.deepEqual(porOrden(avisos[0]), porOrden([
    { tipo: 'albaran', documentoId: 7 }, { tipo: 'parte', documentoId: 7 }, { tipo: 'parte-tecnico', documentoId: 9 },
  ]));
});

test('SCRUM-1373 · 🔴 lo que NO está a salvo no se avisa: la que falla, la rechazada y la respuesta que no confirma', async () => {
  const { b, avisos } = await montar([[7, undefined], [8, undefined], [9, undefined], [10, undefined]]);
  const r = await b.ctx.drenarFirmasPendientes(subidorQue({
    'albaran:7': { id: 7, estado: 'firmado' },          // sube
    'albaran:8': new Error('fallo de red'),              // se queda en la cola
    'albaran:9': rechazada(),                            // sale de la cola, pero el servidor NO la tiene
    'albaran:10': '<html>portal cautivo</html>',         // 200 que no confirma
  }), { plazoMs: 1000 });
  assert.equal(r.subidas, 1, '🔴 CIEGO: la escena no es la que se quería medir: ' + JSON.stringify(r));
  assert.deepEqual(avisos, [[{ tipo: 'albaran', documentoId: 7 }]],
    '🔴 SE HA DADO POR A SALVO UNA FIRMA QUE EL SERVIDOR NO TIENE: una pantalla que escuche se pintaría «firmado».');
});

test('SCRUM-1373 · 🔴 un drenado que no confirma NADA no avisa (red caída y cola vacía)', async () => {
  const caida = await montar([[7, undefined]]);
  await caida.b.ctx.drenarFirmasPendientes(subidorQue({ porDefecto: new Error('fallo de red') }), { plazoMs: 500 });
  assert.deepEqual(caida.avisos, [], '🔴 con la red caída se avisa de firmas confirmadas');

  const vacia = await montar([]);
  await vacia.b.ctx.drenarFirmasPendientes(subidorQue({ porDefecto: { ok: true } }), { plazoMs: 500 });
  assert.deepEqual(vacia.avisos, [], '🔴 con la cola vacía se avisa (con una lista vacía, o de más)');
});

test('SCRUM-1373 · ✅ un oyente que LANZA no tumba el drenado ni deja sin aviso al siguiente', async () => {
  const b = montarAlmacen(RAIZ);
  await b.ctx.encolarFirma(7, CUERPO);
  const segundo = [];
  b.ctx.alConfirmarseFirmas(() => { throw new Error('la pantalla ya no existe'); });
  b.ctx.alConfirmarseFirmas((l) => { segundo.push(copia(l)); });
  const r = await b.ctx.drenarFirmasPendientes(subidorQue({ porDefecto: { id: 7, estado: 'firmado' } }), { plazoMs: 1000 });
  assert.equal(r.estado, b.ctx.GUARDADO);
  assert.equal(r.subidas, 1, '🔴 un oyente roto ha tumbado el drenado');
  assert.equal(segundo.length, 1, '🔴 un oyente roto ha dejado sin aviso al siguiente');
});

test('SCRUM-1373 · ✅ quien se DESUSCRIBE deja de recibir; y la lista que recibe uno no es la del otro', async () => {
  const { b, avisos, desuscribir } = await montar([[7, undefined]]);
  const otro = [];
  b.ctx.alConfirmarseFirmas((l) => { l.push({ tipo: 'x', documentoId: 0 }); l[0].documentoId = 999; otro.push(1); });
  const tercero = [];
  b.ctx.alConfirmarseFirmas((l) => { tercero.push(copia(l)); });
  desuscribir();
  await b.ctx.drenarFirmasPendientes(subidorQue({ porDefecto: { id: 7, estado: 'firmado' } }), { plazoMs: 1000 });
  assert.deepEqual(avisos, [], '🔴 un oyente desuscrito sigue recibiendo: una pantalla cerrada se repintaría.');
  assert.equal(otro.length, 1);
  assert.deepEqual(tercero, [[{ tipo: 'albaran', documentoId: 7 }]],
    '🔴 un oyente que manosea su lista le cambia el dato al siguiente.');
});
