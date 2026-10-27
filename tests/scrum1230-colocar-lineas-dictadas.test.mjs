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

function montar(propuesta = PROPUESTA) {
  const patches = [];
  const datos = (url, opts = {}) => {
    const u = String(url);
    const metodo = String(opts.method || 'GET').toUpperCase();
    if (metodo === 'POST' && /\/admin\/partes\/7\/dictado$/.test(u)) return propuesta;
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
async function hastaLaPropuesta(m, { conSuelta = true } = {}) {
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
  if (conSuelta) assert.ok(suelta, '🔴 CIEGO: la propuesta no pintó la línea «Sin colocar»');
  return { contenedor, suelta };
}

const confirmar = (contenedor) => contenedor.querySelector('[data-propuesta-confirmar]');

// SCRUM-1215 · el rótulo del botón. Hasta el 6-oct-2026 decía «Añadir estas líneas», que NO se
// aprobó (c.17367, 28-sep-2026): una línea sin cantidad no entra, y «estas» prometía las que se
// ven. «Añadir al parte» se firmó ese mismo día (c.17375) y estuvo sin aplicar hasta hoy.
test('SCRUM-1215 · el botón que confirma lo dictado dice «Añadir al parte», letra por letra', async () => {
  const m = montar();
  const { contenedor } = await hastaLaPropuesta(m);
  const boton = confirmar(contenedor);
  assert.ok(boton, '🔴 CIEGO: la propuesta no pintó su botón de confirmar');
  assert.equal(boton.textContent, 'Añadir al parte');
});

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
  assert.ok(boton && !boton.disabled, '🔴 con todo colocado, «Añadir al parte» sigue bloqueado');
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
  assert.ok(boton, '🔴 CIEGO: no está «Añadir al parte»');
  assert.equal(boton.disabled, true,
    '🔴 con una línea «Sin colocar» sin elegir se puede confirmar, y esa línea se descartaría sin aviso');
  // Aunque algo lo pulse igual, no sale un PATCH que deje fuera la línea sin colocar.
  boton.click();
  await esperar();
  assert.equal(m.patches.length, 0,
    '🔴 salió un PATCH con una línea «Sin colocar» sin decidir: se ha perdido en silencio');
});

// ── Los dos flecos de SCRUM-1215 c.17377, dentro de 1230: lo dictado tampoco se pierde en silencio
// por la CANTIDAD. Sin texto nuevo: el aviso es el del servidor y el botón sólo se apaga.

/** Sin «Sin colocar»: dos líneas de mano de obra, con la cantidad que se diga. */
const conCantidades = (a, b) => ({
  ...PROPUESTA,
  propuesta: {
    ...PROPUESTA.propuesta,
    mano_obra: [{ unds: a, descripcion: 'Cambio de presostato' }, { unds: b, descripcion: 'Purga del circuito' }],
    sinBloque: [],
  },
});
// SCRUM-1266 · la descripción de la propuesta dejó de ser un <span> de sólo lectura y es un campo
// (`data-propuesta-desc`): la fila se localiza por el valor de ese campo.
const filaDe = (contenedor, descripcion) => todos(contenedor).find((n) => n.getAttribute
  && n.getAttribute('data-propuesta') === '1' && todos(n).some((x) => x.getAttribute
    && x.getAttribute('data-propuesta-desc') === '1' && x.getAttribute('value') === descripcion));
const avisoEn = (fila) => todos(fila).filter((n) => n.getAttribute && n.getAttribute('data-falta-cantidad'));
const campoDe = (fila) => todos(fila).find((n) => n.getAttribute && n.getAttribute('data-propuesta-unds') === '1');

test('SCRUM-1230 · 🔴 si el técnico BORRA una cantidad que venía, su línea lo dice (y deja de decirlo al ponerla)', async () => {
  const m = montar(conCantidades(1, 2));
  const { contenedor } = await hastaLaPropuesta(m, { conSuelta: false });
  const fila = filaDe(contenedor, 'Purga del circuito');
  assert.ok(fila, '🔴 CIEGO: no encuentro la línea propuesta');
  assert.equal(avisoEn(fila).length, 0, '🔴 SUELO: la línea nació con cantidad y ya lleva aviso');

  const campo = campoDe(fila);
  campo.value = '';
  campo.disparar('input');
  const aviso = avisoEn(fila);
  assert.equal(aviso.length, 1, '🔴 cantidad borrada a mano y la línea no avisa: al confirmar no entraría, en silencio');
  assert.ok(todos(aviso[0]).some((x) => (x.textContent || '').includes('Falta la cantidad')),
    '🔴 el aviso no es el texto del servidor');

  campo.value = '4';
  campo.disparar('input');
  assert.equal(avisoEn(fila).length, 0, '🔴 con la cantidad puesta sigue avisando de que falta');
});

test('SCRUM-1230 · 🔴 con NINGUNA línea lista el botón se apaga, en vez de pulsarse sin hacer nada', async () => {
  const m = montar(conCantidades(null, null));
  const { contenedor } = await hastaLaPropuesta(m, { conSuelta: false });
  const boton = confirmar(contenedor);
  assert.ok(boton, '🔴 CIEGO: no está el botón de confirmar');
  assert.equal(boton.disabled, true, '🔴 sin ninguna línea con cantidad se puede pulsar, y no pasa nada ni se dice nada');

  // Control positivo: en cuanto una tiene cantidad, se enciende y entra ESA.
  const campo = campoDe(filaDe(contenedor, 'Cambio de presostato'));
  campo.value = '1';
  campo.disparar('input');
  assert.equal(boton.disabled, false, '🔴 con una línea lista el botón sigue apagado');
  boton.click();
  await esperar();
  assert.equal(m.patches.length, 1, `🔴 no salió el PATCH (${m.patches.length})`);
  assert.ok((m.patches[0].lineas || []).some((l) => l.descripcion === 'Cambio de presostato' && l.unds === 1));
});
