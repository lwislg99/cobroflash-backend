// tests/scrum1493b-anadir-409-relee.test.mjs — SCRUM-1493b (carril S4)
//
// «Añadir al parte» con el `PATCH` rechazado con 409 (`parte_locked`: el parte se firmó desde otro
// sitio) decía «No se han podido guardar las líneas — vuelve a intentarlo», y reintentar no iba a
// funcionar NUNCA (lo dejó escrito SCRUM-1493, «visto de paso»). Ahora hace lo mismo que «Ordenar»
// ante ese mismo 409 (SCRUM-1302 C, conducta 2): RELEE el parte, y no dice nada nuevo. La prueba de
// que la situación es equivalente no es que los botones se parezcan: es que tras releer la pantalla
// cuenta la verdad (firmado, sin botón), igual que en «Ordenar».
//
// El servidor es de `fetch`: el error que decide es el que fabrica el `apiRequest` real.
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cargarDashboard, todos } from './_banco-vistas.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const NO_SE_GUARDARON = 'No se han podido guardar las líneas — vuelve a intentarlo';

const BASE = Object.freeze({
  id: 7, numero: 'PT-2026-007', clienteNombre: 'Comunidad Los Olivos',
  fecha: '2026-09-02T08:00:00.000Z', obra: 'C/ Mayor 3', referencia: 'R-9',
  entrada: '08:00', salida: '11:30', desplazamientos: 1, kilometros: 12,
  tecnicos: ['Israel'], tipo: 'mantenimiento',
  lineas: [{ bloque: 'mano_obra', unds: 2, descripcion: 'Revisión' }],
  notas: 'Llave en portería', estado: 'borrador',
  puedeEditarContenido: { ok: true, motivo: null }, puedeEditarPrecios: { ok: true, motivo: null },
});
const PROPUESTA = Object.freeze({
  propuesta: {
    vacia: false,
    mano_obra: [{ unds: 1, descripcion: 'Purga del circuito' }],
    materiales: [{ unds: 2, descripcion: 'Detector' }],
    sinBloque: [], datosRetirados: [],
  },
  avisos: { cantidadesRetiradas: 'Falta la cantidad', datosRetirados: 'Revisa este dato' },
});

const attr = (n, a) => (n.getAttribute ? n.getAttribute(a) : null);
const con = (c, a) => todos(c).filter((x) => attr(x, a) != null);
const pausa = () => new Promise((r) => setTimeout(r, 8));
const copia = (x) => JSON.parse(JSON.stringify(x));

/**
 * `guardar` dice qué pasa con el `PATCH`: 'ok', o un código. El 409 FIRMA el parte de verdad —es lo
 * que ese código significa en esta ruta—, así que la relectura lo trae firmado.
 */
function servidor() {
  let parte = copia(BASE);
  const estado = { guardar: 'ok', pedidas: [] };
  const responder = (status, data) => ({
    ok: status < 400, status, statusText: 'x',
    headers: { get: () => 'application/json' },
    json: async () => copia(data), blob: async () => ({}), text: async () => '',
  });
  const fetch = async (url, opts = {}) => {
    const metodo = String(opts.method || 'GET').toUpperCase();
    estado.pedidas.push({ metodo, url: String(url) });
    if (metodo === 'POST' && /\/dictado$/.test(String(url))) return responder(200, PROPUESTA);
    if (metodo === 'PATCH') {
      if (estado.guardar === 409) {
        parte = { ...parte, estado: 'firmado', firmadoAt: '2026-09-02T12:00:00.000Z', firmadoPorNombre: 'Ana',
          puedeEditarContenido: { ok: false, motivo: 'El parte ya está firmado.' } };
        return responder(409, { error: 'parte_locked', message: 'El parte ya está firmado.' });
      }
      if (estado.guardar !== 'ok') return responder(estado.guardar, { error: 'internal_error' });
      parte = { ...parte, ...JSON.parse(opts.body) };
      return responder(200, parte);
    }
    return responder(200, parte);
  };
  const de = (metodo, patron) => estado.pedidas.filter((p) => p.metodo === metodo && patron.test(p.url));
  return { fetch, estado, de };
}

/** El parte montado, con una propuesta de dos líneas en pantalla, y «Añadir al parte» pulsado. */
async function anadirCon(que) {
  const srv = servidor();
  const b = cargarDashboard(RAIZ, { red: { fetch: srv.fetch } });
  const c = b.mk('div');
  b.ctx.document.body.appendChild(c);
  const ok = await b.ctx.renderParteDetailView(c, 7);
  assert.notEqual(ok, false, 'SUELO: la vista del parte no se ha montado');
  con(c, 'data-dictado-texto')[0].value = 'He purgado el circuito y cambiado dos detectores';
  assert.ok(con(c, 'data-dictado-ordenar')[0].disparar('click') > 0, 'SUELO: nadie escucha «Ordenar en líneas»');
  await pausa();
  const confirmar = con(c, 'data-propuesta-confirmar')[0];
  assert.ok(confirmar, 'SUELO: la propuesta no tiene botón «Añadir al parte»');
  srv.estado.guardar = que;
  const lecturas = srv.de('GET', /\/admin\/partes\/7$/).length;
  assert.ok(confirmar.disparar('click') > 0, 'SUELO: nadie escucha «Añadir al parte»');
  await pausa();
  assert.equal(srv.de('PATCH', /\/admin\/partes\/7$/).length, 1, 'SUELO: el guardado no llegó a intentarse');
  return { c, srv, releidas: srv.de('GET', /\/admin\/partes\/7$/).length - lecturas };
}

test('SCRUM-1493b · 🔴 un 409 al añadir (firmado desde otro sitio) RELEE el parte y no dice «vuelve a intentarlo»', async () => {
  const { c, releidas } = await anadirCon(409);
  assert.equal(releidas, 1, '🔴 el 409 no ha releído el parte: la pantalla sigue enseñando uno que ya no existe');
  assert.ok(!c.innerHTML.includes('vuelve a intentarlo'), '🔴 en un 409 «vuelve a intentarlo» es falso: no va a funcionar nunca');
  // La equivalencia con «Ordenar»: tras releer, la pantalla cuenta la verdad.
  assert.equal(con(c, 'data-propuesta-confirmar').length, 0, '🔴 sigue ofreciendo «Añadir al parte» en un parte firmado');
  assert.equal(con(c, 'data-dictado-ordenar').length, 0, '🔴 sigue ofreciendo ordenar un parte firmado');
  assert.equal(con(c, 'data-parte-campo').length, 0, '🔴 la ficha releída sigue con casillas: no ha salido firmada');
});

test('SCRUM-1493b · CONTROL: un 500 al añadir NO relee, conserva la propuesta y dice el texto firmado', async () => {
  const { c, releidas } = await anadirCon(500);
  assert.equal(releidas, 0, 'releer está firmado para 409 y 404, no para un 5xx');
  assert.equal(con(c, 'data-propuesta-confirmar').length, 1, 'la propuesta y su botón siguen para reintentar');
  assert.ok(todos(c).some((n) => attr(n, 'data-dictado-no-guardado') != null && n.textContent === NO_SE_GUARDARON),
    'el aviso firmado de SCRUM-704 sigue saliendo en un 5xx');
});
