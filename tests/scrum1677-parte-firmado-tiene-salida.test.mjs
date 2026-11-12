// SCRUM-1677 (PILOTO-1) · Un parte firmado no es un callejón sin salida. Textos firmados: SCRUM-1656
// comentario 21408, entradas 5 («← Trabajo: {cliente}») y 6 («Volver al trabajo»).
//
// Se mide en el BANCO DEL PANEL ENTERO (`cargarDashboard`): la vista real, pintada por
// `renderParteDetailView`, y los botones PULSADOS. Lo que se mira es a dónde navega el panel
// (`renderAppView`), no el fuente.
//   ① la cabecera enlaza al trabajo en TODOS los estados (borrador, firmado, facturado);
//   ② firmado: hay «Volver al trabajo»; primaria si no queda firma, secundaria si queda una;
//   ③ borrador: no hay «Volver al trabajo» (la acción ahí es apuntar y firmar);
//   ④ pulsar cualquiera de las dos lleva a `jobs-detail` con SU `jobId`;
//   ⑤ sin `jobId` no se pinta ninguna de las dos (no hay a dónde volver); sin cliente, la miga no.
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { cargarDashboard } from './_banco-vistas.mjs';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

const BASE = Object.freeze({
  id: 13, jobId: 79, numero: 'PT-2026-013', clienteNombre: 'Cliente de prueba',
  fecha: '2026-11-10T08:00:00.000Z', obra: '', referencia: '', entrada: '09:00', salida: '11:00',
  desplazamientos: 0, kilometros: 0, tecnicos: [], tipo: 'averia',
  lineas: [{ id: 'l1', bloque: 'mano_obra', unds: 2, descripcion: 'Cambio de grifo' }],
  notas: '', estado: 'borrador', firmoElCliente: false, firmoElTecnico: false,
  puedeEditarContenido: { ok: true, motivo: null }, puedeEditarPrecios: { ok: true, motivo: null },
});
const CERRADO = { puedeEditarContenido: { ok: false, motivo: 'firmado' } };
const FIRMADO_LOS_DOS = { ...CERRADO, estado: 'firmado', firmoElCliente: true, firmoElTecnico: true, firmadoPorNombre: 'Ana', firmadoTecnicoNombre: 'Israel' };
const FIRMADO_UNO = { ...CERRADO, estado: 'firmado', firmoElTecnico: true, firmadoTecnicoNombre: 'Israel' };
const FACTURADO = { ...FIRMADO_LOS_DOS, estado: 'facturado', puedeEditarContenido: { ok: false, motivo: 'facturado' } };

const MIGA = '← Trabajo: Cliente de prueba';
const VOLVER = 'Volver al trabajo';

async function pintar(parte) {
  const responder = (cuerpo) => ({
    ok: true, status: 200, headers: { get: () => 'application/json' },
    json: async () => cuerpo, blob: async () => ({}), text: async () => JSON.stringify(cuerpo),
  });
  const fetch = async (url) => (/\/admin\/partes\/13$/.test(String(url)) ? responder(parte) : responder({}));
  const banco = cargarDashboard(RAIZ, {
    red: { fetch, navigator: { userAgent: 'banco', language: 'es-ES', onLine: true, serviceWorker: { register: async () => ({}) } } },
  });
  const w = banco.ctx.window;
  const navegaciones = [];
  w.renderAppView = (vista, datos) => { navegaciones.push({ vista, datos }); };
  const contenedor = banco.mk('div');
  banco.ctx.document.body.appendChild(contenedor);
  assert.equal(await w.renderParteDetailView(contenedor, 13), true, '🔴 CIEGO: la ficha del parte no se pintó en el banco');
  assert.ok(contenedor.querySelector('[data-parte-firmas]'), '🔴 CIEGO: se pintó otra cosa que la ficha del parte');
  return {
    miga: contenedor.querySelector('[data-parte-al-trabajo]'),
    volver: contenedor.querySelector('[data-parte-volver-al-trabajo]'),
    navegaciones,
  };
}

test('SCRUM-1677 ① la cabecera enlaza al trabajo en TODOS los estados', async () => {
  for (const [nombre, parte] of [['borrador', BASE], ['firmado', { ...BASE, ...FIRMADO_LOS_DOS }], ['facturado', { ...BASE, ...FACTURADO }]]) {
    const { miga } = await pintar(parte);
    assert.ok(miga, `🔴 la cabecera del parte ${nombre} no enlaza a su trabajo`);
    assert.equal(miga.textContent, MIGA, `🔴 la miga del parte ${nombre} no dice el texto firmado`);
  }
});

test('SCRUM-1677 ② firmado: «Volver al trabajo», primaria sin firmas pendientes y secundaria con una', async () => {
  const los2 = await pintar({ ...BASE, ...FIRMADO_LOS_DOS });
  assert.ok(los2.volver, '🔴 un parte firmado por los dos sigue sin ninguna acción');
  assert.equal(los2.volver.textContent, VOLVER);
  assert.match(String(los2.volver.className), /\bbtn-primary\b/, '🔴 sin nada pendiente, volver al trabajo no es la acción principal');

  const uno = await pintar({ ...BASE, ...FIRMADO_UNO });
  assert.ok(uno.volver, '🔴 un parte con una firma no tiene salida');
  assert.match(String(uno.volver.className), /\bbtn-secondary\b/, '🔴 con una firma pendiente, volver compite en verde con ella');

  const fact = await pintar({ ...BASE, ...FACTURADO });
  assert.ok(fact.volver, '🔴 un parte facturado no tiene salida');
});

test('SCRUM-1677 ③ borrador: no hay «Volver al trabajo» (la miga basta)', async () => {
  const { volver, miga } = await pintar(BASE);
  assert.ok(miga, '🔴 CIEGO: sin miga en el borrador, el negativo no prueba nada');
  assert.equal(volver, null, '🔴 el borrador ofrece volver como acción, por delante de apuntar y firmar');
});

test('SCRUM-1677 ④ las dos salidas llevan a `jobs-detail` con el jobId del parte', async () => {
  const r = await pintar({ ...BASE, ...FIRMADO_LOS_DOS });
  assert.ok(r.miga.click() > 0, '🔴 la miga no tiene a nadie escuchando');
  assert.ok(r.volver.click() > 0, '🔴 «Volver al trabajo» no tiene a nadie escuchando');
  assert.deepEqual(r.navegaciones.map((n) => [n.vista, n.datos && n.datos.jobId]), [
    ['jobs-detail', 79],
    ['jobs-detail', 79],
  ],
    `🔴 no navegan al trabajo del parte: ${JSON.stringify(r.navegaciones)}`);
});

test('SCRUM-1677 ⑤ sin trabajo no hay a dónde volver; sin cliente, la miga (que lo nombra) no sale', async () => {
  const sinTrabajo = await pintar({ ...BASE, ...FIRMADO_LOS_DOS, jobId: null });
  assert.equal(sinTrabajo.miga, null, '🔴 miga a un trabajo que no existe');
  assert.equal(sinTrabajo.volver, null, '🔴 «Volver al trabajo» sin trabajo');

  const sinCliente = await pintar({ ...BASE, ...FIRMADO_LOS_DOS, clienteNombre: null });
  assert.equal(sinCliente.miga, null, '🔴 la miga sale sin el cliente que el texto firmado nombra');
  assert.ok(sinCliente.volver, '🔴 sin cliente, el parte firmado vuelve a quedarse sin salida');
});
