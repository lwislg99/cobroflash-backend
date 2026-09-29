// SCRUM-1266 · EL DATO QUE LA MÁQUINA SE INVENTÓ LLEGA AL PARTE MARCADO, NO LIMPIO.
//
// El defecto (medido el 29-sep sobre ba1b0966): el saneador del dictado señala los tokens que el
// dictado no respalda (`datosRetirados`, SCRUM-725) y la propuesta los avisa. Pero al pulsar «Añadir»
// la línea viajaba como `{bloque, unds, descripcion}`: la marca se perdía, el dato inventado entraba
// en el parte y ya nadie sabía que lo era — hasta que la firma lo congelaba.
//
// Se mide el VIAJE entero, en sus dos mitades:
//   · el PANEL (`cargarDashboard`): dictar → propuesta con una línea marcada → añadir → mirar el
//     cuerpo del `PATCH` que sale de verdad; y corregir la descripción EN la propuesta;
//   · el DOMINIO (dist): lo que ese PATCH guarda (`casarLineasPorIdentidad`), lo que se le devuelve al
//     técnico (`lineasParaElTecnico`), una edición posterior desde una pantalla que no conoce la marca,
//     y que la marca NO entra en el sello (`computeParteContentHash`).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { cargarDashboard, todos } from './_banco-vistas.mjs';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const { casarLineasPorIdentidad, lineasParaElTecnico, computeParteContentHash } =
  await import('../dist/modules/jobs/domain/parteTrabajo.js');

const INVENTADA = 'Revisión de central Honeywell Galaxy';
const MARCA = ['Honeywell', 'Galaxy'];

const PARTE = {
  id: 7, numero: 'PT-2026-001', clienteNombre: 'Comunidad Los Olivos',
  fecha: '2026-09-02T08:00:00.000Z', obra: 'C/ Mayor 3', referencia: 'REF-778',
  entrada: '09:15', salida: '12:45', desplazamientos: 1, kilometros: 12.5,
  tecnicos: ['Israel'], tipo: 'mantenimiento',
  lineas: [{ id: 'l1', bloque: 'mano_obra', unds: 2, descripcion: 'Desplazamiento a obra' }],
  notas: '', estado: 'borrador', firmoElCliente: false, firmoElTecnico: false,
  puedeEditarContenido: { ok: true, motivo: null }, puedeEditarPrecios: { ok: true, motivo: null },
};

/** Lo que devuelve `/admin/partes/:id/dictado` con un dato que el técnico no dijo. */
const PROPUESTA = {
  propuesta: {
    vacia: false,
    mano_obra: [{ unds: 1, descripcion: INVENTADA }, { unds: 1, descripcion: 'Purga del circuito' }],
    materiales: [],
    sinBloque: [],
    datosRetirados: [{ descripcion: INVENTADA, tokens: MARCA }],
  },
  avisos: { cantidadesRetiradas: 'Falta la cantidad', datosRetirados: 'AVISO-725', sin_lineas_reconocidas: 'x' },
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
  return { banco: cargarDashboard(RAIZ, { datos }), patches };
}

const esperar = async (n = 20) => { for (let i = 0; i < n; i++) await new Promise((r) => setTimeout(r, 0)); };

async function hastaLaPropuesta(m) {
  const contenedor = m.banco.mk('div');
  m.banco.ctx.document.body.appendChild(contenedor);
  assert.equal(await m.banco.ctx.window.renderParteDetailView(contenedor, 7), true,
    '🔴 CIEGO: la ficha del parte no se pintó en el banco');
  const campo = contenedor.querySelector('[data-dictado-texto]');
  assert.ok(campo, '🔴 CIEGO: no está el campo del dictado');
  campo.value = 'He revisado la central y he purgado el circuito';
  const ordenar = contenedor.querySelector('[data-dictado-ordenar]');
  assert.ok(ordenar && ordenar.click() > 0, '🔴 «Ordenar en líneas» no tiene a nadie escuchando');
  await esperar();
  return contenedor;
}

const filaDe = (contenedor, descripcion) => todos(contenedor).find((n) => n.getAttribute
  && n.getAttribute('data-propuesta') === '1' && todos(n).some((x) => x.getAttribute
    && x.getAttribute('data-propuesta-desc') === '1' && x.getAttribute('value') === descripcion));
const campoDesc = (fila) => todos(fila).find((n) => n.getAttribute && n.getAttribute('data-propuesta-desc') === '1');
const avisoDato = (fila) => todos(fila).find((n) => n.getAttribute && n.getAttribute('data-dato-inventado'));

async function anadir(m, contenedor) {
  const boton = contenedor.querySelector('[data-propuesta-confirmar]');
  assert.ok(boton && !boton.disabled, '🔴 CIEGO: «Añadir» no está o está bloqueado');
  boton.click();
  await esperar();
  assert.equal(m.patches.length, 1, `🔴 no salió el PATCH (${m.patches.length})`);
  return m.patches[0].lineas || [];
}

test('SCRUM-1266 · 🔴 la línea con un dato inventado SALE MARCADA en el PATCH (la de al lado, no)', async () => {
  const m = montar();
  const contenedor = await hastaLaPropuesta(m);
  const fila = filaDe(contenedor, INVENTADA);
  assert.ok(fila, '🔴 CIEGO: no encuentro la línea propuesta con el dato inventado');
  assert.ok(avisoDato(fila), '🔴 el aviso de SCRUM-725 ya no se pinta en su línea');

  const lineas = await anadir(m, contenedor);
  const marcada = lineas.find((l) => l.descripcion === INVENTADA);
  assert.ok(marcada, `🔴 la línea no llegó al PATCH (${JSON.stringify(lineas)})`);
  assert.deepEqual(marcada.datosNoRespaldados, MARCA,
    '🔴 LA MARCA SE PIERDE AL AÑADIR: el dato inventado entra en el parte y nadie sabe que lo era.');
  const limpia = lineas.find((l) => l.descripcion === 'Purga del circuito');
  assert.ok(limpia && limpia.datosNoRespaldados === undefined, '🔴 una línea sin dato inventado sale marcada');
});

test('SCRUM-1266 · 🔴 la descripción se corrige EN LA PROPUESTA, y la marca sigue a lo que queda escrito', async () => {
  const m = montar();
  const contenedor = await hastaLaPropuesta(m);
  const fila = filaDe(contenedor, INVENTADA);
  const campo = campoDesc(fila);
  assert.ok(campo && campo.tagName === 'INPUT', '🔴 la descripción de la propuesta no es un campo editable');

  // Quita uno de los dos datos: el aviso sigue (queda «Galaxy»).
  campo.value = 'Revisión de central Galaxy';
  campo.disparar('input');
  assert.equal(avisoDato(fila).hidden, false, '🔴 el aviso se ha ido con un dato inventado todavía escrito');
  // Quita los dos: el aviso se oculta, y la línea entra corregida y SIN marca.
  campo.value = 'Revisión de central';
  campo.disparar('input');
  assert.equal(avisoDato(fila).hidden, true, '🔴 el aviso sigue ahí con el dato ya corregido');

  const lineas = await anadir(m, contenedor);
  const corregida = lineas.find((l) => l.descripcion === 'Revisión de central');
  assert.ok(corregida, `🔴 se guardó lo que dijo la máquina, no lo que corrigió el técnico (${JSON.stringify(lineas)})`);
  assert.equal(corregida.datosNoRespaldados, undefined, '🔴 la línea corregida sigue marcada');
  assert.ok(!lineas.some((l) => l.descripcion === INVENTADA), '🔴 la versión inventada también entró');
});

test('SCRUM-1266 · 🔴 el servidor GUARDA la marca, se la devuelve al técnico y la sostiene al editar', () => {
  // Lo que el PATCH del panel manda (primer test), casado con lo que ya había.
  const previas = [{ id: 'l1', bloque: 'mano_obra', unds: 2, descripcion: 'Desplazamiento a obra' }];
  const nuevas = previas.concat([
    { bloque: 'mano_obra', unds: 1, descripcion: INVENTADA, datosNoRespaldados: MARCA },
  ]);
  let n = 0;
  const guardadas = casarLineasPorIdentidad(previas, nuevas, () => `id-${++n}`);
  const guardada = guardadas.find((l) => l.descripcion === INVENTADA);
  assert.deepEqual(guardada.datosNoRespaldados, MARCA, '🔴 el guardado tira la marca');

  const alTecnico = lineasParaElTecnico(guardadas);
  assert.deepEqual(alTecnico.find((l) => l.descripcion === INVENTADA).datosNoRespaldados, MARCA,
    '🔴 la marca se guarda pero no vuelve a la pantalla');
  assert.deepEqual(Object.keys(alTecnico.find((l) => l.id === 'l1')).sort(), ['bloque', 'descripcion', 'id', 'unds'],
    '🔴 una línea sin marca ya no sale con sus cuatro campos de siempre');

  // Una edición posterior desde una pantalla que NO conoce la marca (manda sólo id, bloque, unds,
  // descripción) y que corrige UNO de los dos datos: queda marcado el otro, no se limpia todo.
  const editada = { id: guardada.id, bloque: 'mano_obra', unds: 1, descripcion: 'Revisión de central Galaxy' };
  const trasEditar = casarLineasPorIdentidad(guardadas, [guardadas[0], editada], () => 'nuevo');
  assert.deepEqual(trasEditar[1].datosNoRespaldados, ['Galaxy'],
    '🔴 editar la línea borra (o conserva entera) la marca sin mirar lo que queda escrito');
  const corregida = casarLineasPorIdentidad(trasEditar, [trasEditar[0], { ...editada, descripcion: 'Revisión de central' }], () => 'x');
  assert.equal(corregida[1].datosNoRespaldados, undefined, '🔴 el dato está corregido y la línea sigue marcada');
});

test('SCRUM-1266 · la marca NO entra en el sello del parte', () => {
  const base = {
    numero: 'PT-2026-0007', fecha: '2026-09-02T09:00:00.000Z', cliente: 'Comunidad', obra: 'C/ Mayor 12',
    referencia: null, entrada: null, salida: null, desplazamientos: null, kilometros: null, tecnicos: [],
    tipo: null, notas: null, firmadoPorNombre: null, firmadoPorCalidad: null,
  };
  const sin = computeParteContentHash({ ...base, lineas: [{ bloque: 'mano_obra', unds: 1, descripcion: INVENTADA }] });
  const con = computeParteContentHash({
    ...base, lineas: [{ bloque: 'mano_obra', unds: 1, descripcion: INVENTADA, datosNoRespaldados: MARCA }],
  });
  assert.equal(con, sin, '🔴 la marca ha entrado en el sello: un parte ya firmado dejaría de verificar');
});

test('SCRUM-1266 · la ruta del PATCH deja pasar la marca hasta el casado (sin comentarios, por texto)', () => {
  const src = fs.readFileSync(path.join(RAIZ, 'src/modules/jobs/app/routes/partes.routes.ts'), 'utf8');
  const i = src.indexOf('function validarLineasDelTecnico(');
  assert.ok(i >= 0, '🔴 CIEGO: no encuentro `validarLineasDelTecnico` en partes.routes.ts');
  const j = src.indexOf('\n}\n', i);
  const cuerpo = src.slice(i, j).replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
  assert.match(cuerpo, /datosNoRespaldados:\s*l\.datosNoRespaldados/,
    '🔴 la validación del PATCH ya no deja pasar la marca: el panel la manda y el servidor la tira');
});
