// SCRUM-1215 · LAS CUATRO HOJAS DE S4 QUE EL CENSO SEGUÍA ACUSANDO TENÍAN FIRMA: AHORA LA CITAN.
//
// El 7-oct-2026 el censo de SCRUM-1157 daba 38 hojas sin comentario de firma, y cuatro eran del
// parte y del albarán. Las cuatro tenían firma escrita desde hacía semanas; lo que faltaba era que
// el fuente la citara. Tres de ellas, además, el 28-sep NO pasaban la pregunta del ticket («¿el
// código hace lo que el texto dice?») y por eso se dejaron sin marcar a propósito:
//
//   · `pistaFirma` se le decía también al técnico            → lo arregló SCRUM-1229
//   · `sinBloque` mandaba elegir algo que no se podía elegir → lo arregló SCRUM-1230
//   · `sinLineas` salía en un parte ya firmado               → `sinLineasCerrado` (c.17367)
//
// Una marca de firma encima de un literal es una afirmación, y nada la comprobaba: el censo sólo
// lee que el comentario EXISTE. Aquí se ata cada marca a SU ficha (por ticket y ranura, la forma
// fuerte de SCRUM-1306) y el literal se lee del objeto que la vista pinta, no del texto del fichero.
//
// Lo que cada texto afirma ya lo mide su test, y no se repite aquí:
//   pistaFirma → tests/scrum1215c-pista-del-tecnico.test.mjs y tests/scrum1229-firma-del-tecnico-viaje.test.mjs
//   sinLineas  → tests/scrum1215b-sin-lineas-cerrado.test.mjs
//   btnFoto    → tests/scrum1215c-foto-oculta-en-firmado.test.mjs y tests/scrum1302g-foto-con-diez.test.mjs
// De `sinBloque` faltaban dos cosas que `tests/scrum1230-colocar-lineas-dictadas.test.mjs` no mira
// (que el rótulo se lea, que las fichas digan las dos palabras que el rótulo nombra, y que no se
// pinte cuando no hay nada que colocar): van abajo.

import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

import { cargarDashboard, todos } from './_banco-vistas.mjs';
import { aprobacionesDeMicrocopy } from './_microcopy-aprobada.mjs';
import { censar } from '../scripts/_censo-convenio-microcopy.mjs';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

const ID_PISTA = 'public/dashboard/js/parteDetailView.js · TEXTOS.pistaFirma';
const ID_SIN_LINEAS = 'public/dashboard/js/parteDetailView.js · TEXTOS.sinLineas';
const ID_SIN_BLOQUE = 'public/dashboard/js/parteDetailView.js · TEXTOS.sinBloque';
const ID_FOTO = 'public/dashboard/js/albaranDetailView.js · ROTULOS_ALBARAN.btnFoto';

/** Los dos objetos de texto, tal como los deja cargados el panel. */
function textosDelPanel() {
  const banco = cargarDashboard(RAIZ, {});
  return {
    parte: banco.ctx.PARTE_TEXTOS,
    albaran: vm.runInContext("typeof ROTULOS_ALBARAN !== 'undefined' ? ROTULOS_ALBARAN : undefined", banco.ctx),
  };
}

/** La ficha de UNA firma, por ticket y ranura. `undefined` si no existe. */
const ficha = (ticket, ranura) => aprobacionesDeMicrocopy().find((a) => a.ticket === ticket && a.ranura === ranura);

/** La clase que el censo le da a una hoja, o `undefined` si el censo no la ve. */
function claseEnElCenso(id) {
  const r = censar({ raiz: RAIZ });
  assert.equal(r.estado, 'OK', '🔴 CIEGO: el censo de SCRUM-1157 no ha podido mirar: ' + JSON.stringify(r.ciegos));
  const h = r.hojas.find((x) => x.id === id);
  return h ? h.clase : undefined;
}

test('SCRUM-1215e · SUELO: el panel carga los dos objetos, las fichas se leen y el censo ve acusadas', () => {
  const t = textosDelPanel();
  assert.ok(t.parte && Object.keys(t.parte).length >= 27,
    '🔴 SUELO: `PARTE_TEXTOS` no se ha cargado entero: lo de abajo compararía `undefined` con una ficha');
  assert.ok(t.albaran && Object.keys(t.albaran).length >= 8,
    '🔴 SUELO: `ROTULOS_ALBARAN` no se ha cargado: lo de abajo compararía `undefined` con una ficha');
  assert.ok(aprobacionesDeMicrocopy().length > 100, '🔴 SUELO: el barrido de fichas ve muy pocas: no sabe mirar');
  // El control de que el censo sabe ACUSAR: hoy hay hojas sin firma (las del libro registro, de J1).
  const r = censar({ raiz: RAIZ });
  assert.equal(r.estado, 'OK');
  assert.ok(r.acusadas.length > 0,
    '✅ el censo ya no acusa a nadie. Si es verdad, este control sobra: cámbialo por otro que demuestre que sabe acusar');
  assert.equal(claseEnElCenso('public/dashboard/js/parteDetailView.js · TEXTOS.noExisteEstaClave'), undefined,
    '🔴 SUELO: el censo da clase a una hoja que no existe');
});

test('SCRUM-1215e · 🔴 `pistaFirma` cita su firma y es, letra por letra, lo que firmó el fundador (SCRUM-720c)', () => {
  const f = ficha('SCRUM-720', 'los-diez-que-faltaban');
  assert.ok(f && f.aprobada && f.firmante === 'fundador', '🔴 la ficha de SCRUM-720c no está o su firma no cuenta');
  assert.ok(f.literales.includes(textosDelPanel().parte.pistaFirma),
    '🔴 lo que pinta `pistaFirma` no es el literal de su ficha: o cambió el texto, o la marca cita una firma que no es la suya');
  assert.equal(claseEnElCenso(ID_PISTA), 'APROBADO', '🔴 el fuente no cita la firma de `pistaFirma`: el censo la sigue acusando');
});

test('SCRUM-1215e · 🔴 `sinBloque` cita su firma y es, letra por letra, lo que firmó el fundador (SCRUM-720c)', () => {
  const f = ficha('SCRUM-720', 'los-diez-que-faltaban');
  assert.ok(f && f.aprobada && f.firmante === 'fundador', '🔴 la ficha de SCRUM-720c no está o su firma no cuenta');
  assert.ok(f.literales.includes(textosDelPanel().parte.sinBloque),
    '🔴 lo que pinta `sinBloque` no es el literal de su ficha');
  assert.equal(claseEnElCenso(ID_SIN_BLOQUE), 'APROBADO', '🔴 el fuente no cita la firma de `sinBloque`: el censo la sigue acusando');
});

test('SCRUM-1215e · 🔴 `sinLineas` cita su firma y es, letra por letra, lo que firmó el fundador (SCRUM-720)', () => {
  const f = ficha('SCRUM-720', 'rotulos-del-parte');
  assert.ok(f && f.aprobada && f.firmante === 'fundador', '🔴 la ficha de SCRUM-720 no está o su firma no cuenta');
  assert.ok(f.literales.includes(textosDelPanel().parte.sinLineas),
    '🔴 lo que pinta `sinLineas` no es el literal de su ficha');
  assert.equal(claseEnElCenso(ID_SIN_LINEAS), 'APROBADO', '🔴 el fuente no cita la firma de `sinLineas`: el censo la sigue acusando');
});

test('SCRUM-1215e · 🔴 `btnFoto` tiene ficha con la firma delegada (c.18283), y la cita', () => {
  const f = ficha('SCRUM-1215', 'anadir-foto-del-albaran');
  assert.ok(f, '🔴 «📷 Añadir foto» se firmó en SCRUM-1215 comentario 18283 y no tiene ficha en docs/microcopy/');
  assert.ok(f.aprobada && f.firmante === 'orquestador' && f.delegacion,
    '🔴 la ficha de `btnFoto` no lleva la firma delegada completa (README de docs/microcopy/, punto 3)');
  assert.ok(f.literales.includes(textosDelPanel().albaran.btnFoto),
    '🔴 lo que pinta `btnFoto` no es el literal de su ficha');
  assert.equal(claseEnElCenso(ID_FOTO), 'APROBADO', '🔴 el fuente no cita la firma de `btnFoto`: el censo la sigue acusando');
});

// ── «Sin colocar — elige mano de obra o materiales»: lo que afirma, mirado en lo pintado ─────────

const PARTE = {
  id: 7, numero: 'PT-2026-001', clienteNombre: 'Comunidad Los Olivos',
  fecha: '2026-09-02T08:00:00.000Z', obra: 'C/ Mayor 3', referencia: 'REF-778',
  entrada: '09:15', salida: '12:45', desplazamientos: 1, kilometros: 12.5,
  tecnicos: ['Israel'], tipo: 'mantenimiento',
  lineas: [{ id: 'l1', bloque: 'mano_obra', unds: 2, descripcion: 'Revisión' }],
  notas: '', estado: 'borrador', firmoElCliente: false, firmoElTecnico: false,
  puedeEditarContenido: { ok: true, motivo: null }, puedeEditarPrecios: { ok: true, motivo: null },
};

const propuestaCon = (sinBloque) => ({
  propuesta: {
    vacia: false,
    mano_obra: [{ unds: 1, descripcion: 'Cambio de presostato' }],
    materiales: [],
    sinBloque,
    datosRetirados: [],
  },
  avisos: { cantidadesRetiradas: 'Falta la cantidad', datosRetirados: 'x', sin_lineas_reconocidas: 'x' },
});

const esperar = async (n = 20) => { for (let i = 0; i < n; i++) await new Promise((r) => setTimeout(r, 0)); };

/** Pinta el parte, dicta y ordena; devuelve el contenedor con la propuesta que conteste `propuesta`. */
async function hastaLaPropuesta(propuesta) {
  const datos = (url, opts = {}) => {
    const u = String(url);
    const metodo = String(opts.method || 'GET').toUpperCase();
    if (metodo === 'POST' && /\/admin\/partes\/7\/dictado$/.test(u)) return propuesta;
    if (/\/admin\/partes\/7$/.test(u)) return PARTE;
    return {};
  };
  const banco = cargarDashboard(RAIZ, { datos });
  const contenedor = banco.mk('div');
  banco.ctx.document.body.appendChild(contenedor);
  assert.equal(await banco.ctx.window.renderParteDetailView(contenedor, 7), true,
    '🔴 CIEGO: la ficha del parte no se pintó en el banco');
  const campo = contenedor.querySelector('[data-dictado-texto]');
  assert.ok(campo, '🔴 CIEGO: no está el campo del dictado');
  campo.value = 'He cambiado el presostato y he puesto tres tubos de cobre';
  const ordenar = contenedor.querySelector('[data-dictado-ordenar]');
  assert.ok(ordenar && ordenar.click() > 0, '🔴 CIEGO: «Ordenar en líneas» no tiene a nadie escuchando');
  await esperar();
  assert.ok(contenedor.querySelector('[data-propuesta-confirmar]'), '🔴 CIEGO: la propuesta no se ha pintado');
  return { contenedor, rotulo: banco.ctx.PARTE_TEXTOS.sinBloque };
}

const titulos = (contenedor) => todos(contenedor).filter((n) => n.tagName === 'H4').map((n) => String(n.textContent));

test('SCRUM-1215e · 🔴 con una línea sin colocar, el rótulo se lee y las fichas dicen las dos palabras que nombra', async () => {
  const { contenedor, rotulo } = await hastaLaPropuesta(propuestaCon([{ unds: 3, descripcion: 'Tubo de cobre' }]));
  assert.ok(titulos(contenedor).includes(rotulo),
    '🔴 hay una línea sin colocar y su rótulo no se pinta. Títulos leídos: ' + JSON.stringify(titulos(contenedor)));
  const suelta = todos(contenedor).find((n) => n.getAttribute && n.getAttribute('data-bloque') === 'sinBloque');
  assert.ok(suelta, '🔴 CIEGO: no está la línea sin colocar');
  // El banco no agrega `textContent` (límite 4 de `_banco-vistas.mjs`): el texto de
  // `<label><input …>Mano de obra</label>` lo guarda el nodo cuya etiqueta lo precede, que es el
  // `<input>`. En el navegador ese mismo texto es el de la ficha.
  const opciones = todos(suelta).filter((n) => n.tagName === 'INPUT' && n.getAttribute('data-colocar'));
  assert.equal(opciones.length, 2, '🔴 CIEGO: la línea sin colocar no trae sus dos opciones');
  const fichas = opciones.map((n) => String(n.textContent).trim());
  assert.deepEqual(fichas, ['Mano de obra', 'Materiales'],
    '🔴 el rótulo manda elegir «mano de obra o materiales» y lo que se ofrece en la línea no son esas dos palabras: ' + JSON.stringify(fichas));
  for (const palabra of fichas) {
    assert.ok(rotulo.toLowerCase().includes(palabra.toLowerCase()),
      `🔴 la ficha dice «${palabra}» y el rótulo («${rotulo}») no la nombra`);
  }
});

test('SCRUM-1215e · 🔴 CONTROL NEGATIVO: sin ninguna línea suelta, el rótulo NO se pinta (no manda elegir sobre nada)', async () => {
  const { contenedor, rotulo } = await hastaLaPropuesta(propuestaCon([]));
  assert.ok(titulos(contenedor).length > 0, '🔴 CIEGO: la propuesta no pintó ningún título de bloque');
  assert.ok(!titulos(contenedor).includes(rotulo),
    '🔴 no hay nada sin colocar y la propuesta dice «' + rotulo + '»: manda elegir algo que no está');
});
