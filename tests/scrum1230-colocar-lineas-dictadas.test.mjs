// SCRUM-1230 · LO DICTADO QUE LA MÁQUINA NO SUPO COLOCAR YA NO SE PIERDE AL CONFIRMAR.
//
// El defecto (SCRUM-1215 lote 1, c.17360): el dictado propone las líneas en su bloque, y las que no
// sabe si son mano de obra o material van bajo «Sin colocar — elige mano de obra o materiales».
// Pero la línea no tenía NINGÚN control para elegir, y `lineasConfirmadas` las descartaba al pulsar
// «Añadir estas líneas». El técnico dictaba, confirmaba, y lo dictado desaparecía sin aviso.
//
// Se mide el VIAJE en el panel entero (`cargarDashboard`): pintar el parte → dictar → «Ordenar en
// líneas» (la propuesta llega por `fetch`) → elegir el bloque en la línea → confirmar → y mirar el
// cuerpo del `PATCH` que sale de verdad.
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { cargarDashboard, todos } from './_banco-vistas.mjs';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

const PARTE = {
  id: 7, numero: 'PT-2026-001', clienteNombre: 'Comunidad Los Olivos',
  fecha: '2026-09-02T08:00:00.000Z', obra: 'C/ Mayor 3', referencia: 'REF-778',
  entrada: '09:15', salida: '12:45', desplazamientos: 1, kilometros: 12.5,
  tecnicos: ['Israel'], tipo: 'mantenimiento',
  lineas: [{ id: 'l1', bloque: 'mano_obra', unds: 2, descripcion: 'Revisión' }],
  notas: '', estado: 'borrador', firmoElCliente: false, firmoElTecnico: false,
  puedeEditarContenido: { ok: true, motivo: null }, puedeEditarPrecios: { ok: true, motivo: null },
};

/** Lo que devuelve `/admin/partes/:id/dictado`: una línea colocada y una que la máquina no supo. */
const PROPUESTA = {
  propuesta: {
    vacia: false,
    mano_obra: [{ unds: 1, descripcion: 'Cambio de presostato' }],
    materiales: [],
    sinBloque: [{ unds: 3, descripcion: 'Tubo de cobre' }],
    datosRetirados: [],
  },
  avisos: { cantidadesRetiradas: 'Falta la cantidad', datosRetirados: 'x', sin_lineas_reconocidas: 'x' },
};

function montar() {
  const patches = [];
  const datos = (url, opts = {}) => {
    const u = String(url);
    const metodo = String(opts.method || 'GET').toUpperCase();
    if (metodo === 'POST' && /\/admin\/partes\/7\/dictado$/.test(u)) return PROPUESTA;
    if (metodo === 'PATCH' && /\/admin\/partes\/7$/.test(u)) {
      patches.push(JSON.parse(opts.body || '{}'));
      return PARTE;
    }
    if (/\/admin\/partes\/7$/.test(u)) return PARTE;
    return {};
  };
  const banco = cargarDashboard(RAIZ, { datos });
  return { banco, patches };
}

const esperar = async (n = 20) => { for (let i = 0; i < n; i++) await new Promise((r) => setTimeout(r, 0)); };

/** Pinta, dicta y ordena. Devuelve el contenedor con la propuesta ya pintada. */
async function hastaLaPropuesta(m) {
  const contenedor = m.banco.mk('div');
  m.banco.ctx.document.body.appendChild(contenedor);
  assert.equal(await m.banco.ctx.window.renderParteDetailView(contenedor, 7), true,
    '🔴 CIEGO: la ficha del parte no se pintó en el banco');
  const campo = contenedor.querySelector('[data-dictado-texto]');
  assert.ok(campo, '🔴 CIEGO: no está el campo del dictado');
  campo.value = 'He cambiado el presostato y he puesto tres tubos de cobre';
  const ordenar = contenedor.querySelector('[data-dictado-ordenar]');
  assert.ok(ordenar && ordenar.click() > 0, '🔴 «Ordenar en líneas» no tiene a nadie escuchando');
  await esperar();
  const suelta = todos(contenedor).find((n) => n.getAttribute && n.getAttribute('data-propuesta') === '1'
    && n.getAttribute('data-bloque') === 'sinBloque');
  assert.ok(suelta, '🔴 CIEGO: la propuesta no pintó la línea «Sin colocar»');
  return { contenedor, suelta };
}

const confirmar = (contenedor) => contenedor.querySelector('[data-propuesta-confirmar]');

test('SCRUM-1230 · 🔴 una línea «Sin colocar» se PUEDE colocar y entra en el parte con su bloque', async () => {
  const m = montar();
  const { contenedor, suelta } = await hastaLaPropuesta(m);

  const opciones = todos(suelta).filter((n) => n.tagName === 'INPUT' && n.getAttribute('data-colocar'));
  assert.deepEqual(opciones.map((n) => n.value).sort(), ['mano_obra', 'materiales'],
    '🔴 la línea «Sin colocar» no ofrece elegir mano de obra o materiales: el rótulo manda hacer algo imposible');
  const materiales = opciones.find((n) => n.value === 'materiales');
  materiales.checked = true;
  materiales.disparar('change');

  const boton = confirmar(contenedor);
  assert.ok(boton && !boton.disabled, '🔴 con todo colocado, «Añadir estas líneas» sigue bloqueado');
  boton.click();
  await esperar();

  assert.equal(m.patches.length, 1, `🔴 no salió el PATCH (${m.patches.length})`);
  const lineas = m.patches[0].lineas || [];
  const tubo = lineas.find((l) => l.descripcion === 'Tubo de cobre');
  assert.ok(tubo, `🔴 LO DICTADO SE HA PERDIDO: la línea colocada no llegó al PATCH (${JSON.stringify(lineas)})`);
  assert.equal(tubo.bloque, 'materiales', '🔴 entró en un bloque que no es el que se eligió');
  assert.equal(tubo.unds, 3);
  // Y no se ha llevado nada por delante: lo que ya había y la otra línea propuesta siguen.
  assert.ok(lineas.some((l) => l.descripcion === 'Revisión'), '🔴 el PATCH ha borrado lo que ya estaba apuntado');
  assert.ok(lineas.some((l) => l.descripcion === 'Cambio de presostato' && l.bloque === 'mano_obra'));
});

test('SCRUM-1230 · 🔴 CONTROL NEGATIVO: sin elegir, NO se confirma — nada se descarta en silencio', async () => {
  const m = montar();
  const { contenedor } = await hastaLaPropuesta(m);
  const boton = confirmar(contenedor);
  assert.ok(boton, '🔴 CIEGO: no está «Añadir estas líneas»');
  assert.equal(boton.disabled, true,
    '🔴 con una línea «Sin colocar» sin elegir se puede confirmar, y esa línea se descartaría sin aviso');
  // Aunque algo lo pulse igual, no sale un PATCH que deje fuera la línea sin colocar.
  boton.click();
  await esperar();
  assert.equal(m.patches.length, 0,
    '🔴 salió un PATCH con una línea «Sin colocar» sin decidir: se ha perdido en silencio');
});
