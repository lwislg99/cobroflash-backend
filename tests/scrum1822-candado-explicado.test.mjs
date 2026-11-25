// SCRUM-1822 (tramo ⓐ) · EL CANDADO DEL PARTE, EXPLICADO — Y EL BORRADOR, CON SU «EDITAR» ARRIBA.
//
// Pedido del fundador (20-nov-2026, sobre el parte firmado PT-2026-010): «un parte ahora como que no es
// editable... un boton arriba para editar y que se desbloqueen los campos».
//
// MEDIDO ANTES DE TOCAR (25-nov-2026, main 77c000dea): el servidor YA manda por qué no se puede editar
// (`puedeEditarContenido.motivo`, `src/modules/jobs/domain/parteTrabajo.ts`) y la vista no lo pintaba
// en ningún sitio: el parte firmado era texto plano sin una palabra de por qué. El borrador ya pintaba
// sus casillas, pero nada arriba decía que se podía tocar.
//
// FIRMA: pintar el motivo TAL CUAL llega del servidor, byte a byte y sólo cuando no se puede editar, es
// la decisión del orquestador por delegación del fundador, SCRUM-1656 comentario 22754. «Editar» es el
// literal del fundador para la ficha del cliente (SCRUM-1145 comentario 20598). Ficha:
// `docs/microcopy/2026-11-25-SCRUM-1822-candado-explicado.md`.
//
// Lo que se fija aquí:
//   ① FIRMADO: el motivo se pinta UNA vez, en la cabecera, y es lo que mandó el servidor, letra a letra;
//   ② la vista NO lleva su propia copia de la frase: si el servidor la cambia, la pantalla la sigue;
//   ③ sin motivo no hay candado: ni dibujo suelto ni una frase inventada;
//   ④ FIRMADO: no queda nada que se escriba, ni «Editar»;
//   ⑤ BORRADOR: «Editar» arriba, una vez, con el literal firmado; sus casillas se escriben; sin candado;
//   ⑥ «Editar» lleva a la PRIMERA casilla del parte, y tiene a quien le escuche;
//   ⑦ lo pintado tiene su regla en la hoja de estilos, y la firma, su ficha.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cargarDashboard, todos, clasesDeLasHojas } from './_banco-vistas.mjs';
import { puedeEditarContenido } from '../dist/modules/jobs/domain/parteTrabajo.js';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const VISTA = path.join(RAIZ, 'public', 'dashboard', 'js', 'parteDetailView.js');
const FICHA_CLIENTE = path.join(RAIZ, 'public', 'dashboard', 'js', 'customerDetailView.js');
const FICHA = path.join(RAIZ, 'docs', 'microcopy', '2026-11-25-SCRUM-1822-candado-explicado.md');
const EDITAR = 'Editar';

// Lo que el servidor dice HOY de un parte firmado. Se le pregunta al dominio: no se copia aquí.
const MOTIVO_DEL_SERVIDOR = puedeEditarContenido('firmado').motivo;
// Y uno que el servidor NO dice: si la vista pinta éste igual de bien, es que no lleva una frase suya.
const MOTIVO_CENTINELA = 'Ésta NO es la frase del dominio: «comillas», 2  espacios, <b>marcas</b> & un "final" sin punto';

export const MUTACIONES_QUE_ME_TUMBAN = [
  {
    // El candado deja de pintar lo que manda el servidor.
    fichero: 'public/dashboard/js/parteDetailView.js',
    de: "return '<p class=\"parte-candado\" data-parte-candado=\"1\">' + esc(motivo) + '</p>';",
    a: "return '';",
    cae: 'SCRUM-1822 ① FIRMADO: el motivo del servidor se pinta una vez, en la cabecera, letra a letra',
  },
  {
    // La vista retoca la frase (aquí, la recorta): ya no es byte a byte.
    fichero: 'public/dashboard/js/parteDetailView.js',
    de: "return '<p class=\"parte-candado\" data-parte-candado=\"1\">' + esc(motivo) + '</p>';",
    a: "return '<p class=\"parte-candado\" data-parte-candado=\"1\">' + esc(motivo.slice(0, 20)) + '</p>';",
    cae: 'SCRUM-1822 ① FIRMADO: el motivo del servidor se pinta una vez, en la cabecera, letra a letra',
  },
  {
    // El candado sale también en un parte que SÍ se puede editar.
    fichero: 'public/dashboard/js/parteDetailView.js',
    de: "if (editable) return ''; // el candado es sólo de lo que NO se puede editar",
    a: '',
    cae: 'SCRUM-1822 ⑤ BORRADOR: «Editar» arriba, una vez, con el literal firmado, y sin candado',
  },
  {
    // «Editar» sale en un parte firmado: un botón que promete lo que el servidor cierra con un 409.
    fichero: 'public/dashboard/js/parteDetailView.js',
    de: "if (!editable) return ''; // «Editar» es sólo de lo que SÍ se puede editar",
    a: '',
    cae: 'SCRUM-1822 ④ FIRMADO: no queda nada que se escriba, ni «Editar»',
  },
  {
    // El botón se pinta pero no lleva a ningún sitio.
    fichero: 'public/dashboard/js/parteDetailView.js',
    de: "if (primera && typeof primera.focus === 'function') primera.focus();",
    a: '',
    cae: 'SCRUM-1822 ⑥ «Editar» lleva el cursor a la primera casilla del parte',
  },
];

const BASE = Object.freeze({
  id: 13, numero: 'PT-2026-013', clienteNombre: 'Cliente de pruebas', jobId: 84,
  fecha: '2026-11-16T08:00:00.000Z', obra: 'Sala de calderas', referencia: null,
  entrada: '09:10', salida: '11:40', desplazamientos: 2, kilometros: 8,
  tecnicos: ['Israel'], tipo: 'mantenimiento',
  lineas: [
    { id: 1, bloque: 'mano_obra', unds: 1, descripcion: 'Revisión' },
    { id: 2, bloque: 'materiales', unds: 2, descripcion: 'Racor de latón' },
  ],
  notas: null,
});
const BORRADOR = Object.freeze({
  ...BASE, estado: 'borrador', firmoElCliente: false, firmoElTecnico: false,
  puedeEditarContenido: { ok: true, motivo: null }, puedeEditarPrecios: { ok: true, motivo: null },
});
const firmadoCon = (motivo) => ({
  ...BASE, estado: 'firmado', firmoElCliente: true, firmoElTecnico: true,
  firmadoPorNombre: 'Ana', firmadoTecnicoNombre: 'Israel',
  puedeEditarContenido: { ok: false, motivo }, puedeEditarPrecios: { ok: true, motivo: null },
});

const conClase = (n, clase) => String(n.className || '').split(/\s+/).includes(clase);
const con = (n, atributo) => !!n.getAttribute && n.getAttribute(atributo) !== null;
// El banco guarda el texto como lo ESCRIBE la vista (escapado): se deshace el escape y se compara.
const leido = (n) => todos(n).map((x) => x._texto || '').join('')
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/&amp;/g, '&');
const SE_ESCRIBE = ['INPUT', 'TEXTAREA', 'SELECT'];

/** Pinta el parte y devuelve la hoja y su cabecera. El SUELO va dentro. */
function pintar(parte) {
  const b = cargarDashboard(RAIZ);
  const c = b.mk('div');
  assert.equal(b.ctx.renderParte(c, parte), true, '🔴 SUELO: la vista se negó a pintar el parte');
  const cabecera = c.hijos[0];
  assert.ok(
    cabecera && cabecera.tagName === 'HEADER' && conClase(cabecera, 'parte-cabecera'),
    '🔴 SUELO: la hoja ya no empieza por `header.parte-cabecera` (¿cambió `renderParte`?)',
  );
  return {
    c, cabecera, ctx: b.ctx,
    candados: todos(c).filter((n) => con(n, 'data-parte-candado')),
    editar: todos(c).filter((n) => con(n, 'data-parte-editar')),
  };
}

function elMotivoSePinta(motivo) {
  const { cabecera, candados } = pintar(firmadoCon(motivo));
  assert.equal(candados.length, 1, '🔴 el parte que no se puede editar pinta UN candado con su motivo');
  assert.ok(todos(cabecera).includes(candados[0]), '🔴 el candado va ARRIBA, dentro de la cabecera del parte');
  assert.equal(leido(candados[0]), motivo, '🔴 el motivo se lee EXACTAMENTE como lo mandó el servidor');
  assert.deepEqual(
    todos(candados[0]).slice(1).map((n) => n.tagName), [],
    '🔴 el motivo es TEXTO: las marcas que traiga no se convierten en elementos',
  );
}

test('SCRUM-1822 ① FIRMADO: el motivo del servidor se pinta una vez, en la cabecera, letra a letra', () => {
  assert.ok(
    typeof MOTIVO_DEL_SERVIDOR === 'string' && MOTIVO_DEL_SERVIDOR.length > 20,
    '🔴 SUELO: el dominio ya no da el motivo de un parte firmado (`puedeEditarContenido`)',
  );
  elMotivoSePinta(MOTIVO_DEL_SERVIDOR);
  // Con OTRA frase, la misma exactitud: lo que se pinta es lo que llega, no lo que la vista se sabe.
  elMotivoSePinta(MOTIVO_CENTINELA);
});

test('SCRUM-1822 ② la vista no lleva su propia copia de la frase del servidor', () => {
  const fuente = fs.readFileSync(VISTA, 'utf8');
  assert.ok(fuente.includes('data-parte-candado'), '🔴 CONTROL: no estoy leyendo la vista del parte');
  assert.ok(!fuente.includes(MOTIVO_DEL_SERVIDOR), '🔴 la vista lleva escrita la frase del servidor: serían dos copias');
});

test('SCRUM-1822 ③ sin motivo no hay candado: ni dibujo suelto ni frase inventada', () => {
  const vacios = [
    ['null', null], ['sin la clave', undefined], ['cadena vacía', ''], ['solo espacios', '  \n\t '],
    ['un número', 7], ['un objeto', { texto: MOTIVO_CENTINELA }], ['una lista', [MOTIVO_CENTINELA]], ['true', true],
  ];
  for (const [nombre, valor] of vacios) {
    const { candados, c } = pintar(firmadoCon(valor));
    assert.equal(candados.length, 0, `🔴 sin motivo (${nombre}) no hay candado`);
    assert.equal(todos(c).filter((n) => conClase(n, 'parte-candado')).length, 0, `🔴 sin motivo (${nombre}) no queda el dibujo suelto`);
  }
  // Un servidor anterior, que no manda el candado: la vista no edita (como siempre) y no inventa por qué.
  const { puedeEditarContenido: _sin, ...sinCandado } = firmadoCon(MOTIVO_CENTINELA);
  assert.equal(pintar(sinCandado).candados.length, 0, '🔴 sin `puedeEditarContenido` no hay motivo que pintar');
  // CONTROL POSITIVO: el mismo buscador, con motivo, SÍ ve el candado.
  assert.equal(pintar(firmadoCon(MOTIVO_CENTINELA)).candados.length, 1, '🔴 CONTROL: con motivo el buscador no ve el candado');
});

test('SCRUM-1822 ④ FIRMADO: no queda nada que se escriba, ni «Editar»', () => {
  const { c, editar } = pintar(firmadoCon(MOTIVO_DEL_SERVIDOR));
  assert.equal(editar.length, 0, '🔴 un parte firmado ofrece «Editar»: el servidor lo cerraría con un 409');
  const abiertos = todos(c).filter((n) => SE_ESCRIBE.includes(n.tagName) && !con(n, 'disabled'));
  assert.deepEqual(abiertos.map((n) => n.tagName + ':' + (n.getAttribute('data-parte-campo') || n.getAttribute('name') || '')), [],
    '🔴 en un parte firmado queda una casilla abierta');
  assert.equal(todos(c).filter((n) => con(n, 'data-parte-campo')).length, 0, '🔴 queda un campo con cable de guardado');
  assert.equal(todos(c).filter((n) => conClase(n, 'parte-anadir')).length, 0, '🔴 queda un «Añadir línea»');
  // CONTROL POSITIVO: el mismo filtro, sobre el borrador, SÍ ve casillas abiertas.
  const borrador = pintar(BORRADOR);
  assert.ok(
    todos(borrador.c).filter((n) => SE_ESCRIBE.includes(n.tagName) && !con(n, 'disabled')).length > 0,
    '🔴 CONTROL: el filtro de casillas abiertas no ve ninguna ni en el borrador',
  );
});

test('SCRUM-1822 ⑤ BORRADOR: «Editar» arriba, una vez, con el literal firmado, y sin candado', () => {
  const { c, cabecera, editar, candados, ctx } = pintar(BORRADOR);
  assert.equal(editar.length, 1, '🔴 el borrador pinta UN botón `[data-parte-editar]`');
  const boton = editar[0];
  assert.equal(boton.tagName, 'BUTTON');
  assert.equal(boton.getAttribute('type'), 'button');
  assert.ok(todos(cabecera).includes(boton), '🔴 «Editar» va ARRIBA, dentro de la cabecera del parte');
  assert.equal(leido(boton), EDITAR, '🔴 el botón dice el literal firmado, y nada más');
  assert.equal(ctx.PARTE_TEXTOS.editar, EDITAR);
  // El literal es el de la ficha del cliente (SCRUM-1145 comentario 20598): la misma palabra, letra a letra.
  assert.ok(
    /^\s*editar: 'Editar', \/\/ APROBADO por el fundador el 23-oct-2026 \(SCRUM-1145 comentario 20598\)\s*$/m
      .test(fs.readFileSync(FICHA_CLIENTE, 'utf8')),
    '🔴 SUELO: la ficha del cliente ya no lleva «Editar» con su firma (SCRUM-1145 comentario 20598)',
  );
  // Sin candado, aunque llegara un motivo: el candado es sólo de lo que NO se puede editar.
  assert.equal(candados.length, 0, '🔴 un borrador no lleva candado');
  const conMotivo = pintar({ ...BORRADOR, puedeEditarContenido: { ok: true, motivo: MOTIVO_CENTINELA } });
  assert.equal(conMotivo.candados.length, 0, '🔴 con `ok: true` el motivo no se pinta, venga lo que venga');
  // Y lo de siempre sigue ahí: las casillas del parte se escriben.
  const campos = todos(c).filter((n) => con(n, 'data-parte-campo')).map((n) => n.getAttribute('data-parte-campo'));
  for (const nombre of ['entrada', 'salida', 'desplazamientos', 'kilometros', 'obra', 'referencia', 'tecnicos', 'notas']) {
    assert.ok(campos.includes(nombre), `🔴 el borrador ya no pinta la casilla «${nombre}»`);
  }
  assert.equal(todos(c).filter((n) => con(n, 'data-parte-campo') && con(n, 'disabled')).length, 0, '🔴 una casilla del borrador sale bloqueada');
});

const responder = (cuerpo) => ({
  ok: true, status: 200, headers: { get: () => 'application/json' },
  json: async () => cuerpo, blob: async () => ({}), text: async () => JSON.stringify(cuerpo),
});
const NAVEGADOR = { userAgent: 'banco', language: 'es-ES', onLine: true, serviceWorker: { register: async () => ({}) } };

/** La ficha REAL del parte (con sus cables), pintada desde lo que sirve `GET /admin/partes/13`. */
async function fichaReal(parte) {
  const fetch = async (url) => (/\/admin\/partes\/13$/.test(String(url)) ? responder(parte) : responder({}));
  const banco = cargarDashboard(RAIZ, { red: { fetch, navigator: NAVEGADOR } });
  const contenedor = banco.mk('div');
  banco.ctx.document.body.appendChild(contenedor);
  assert.equal(await banco.ctx.window.renderParteDetailView(contenedor, 13), true, '🔴 CIEGO: la ficha del parte no se pintó en el banco');
  assert.ok(contenedor.querySelector('[data-parte-firmas]'), '🔴 CIEGO: se pintó otra cosa que la ficha del parte');
  return contenedor;
}

test('SCRUM-1822 ⑥ «Editar» lleva el cursor a la primera casilla del parte', async () => {
  const contenedor = await fichaReal(BORRADOR);
  const boton = contenedor.querySelector('[data-parte-editar]');
  assert.ok(boton, '🔴 la ficha del borrador no pinta «Editar»');
  const casillas = todos(contenedor).filter((n) => con(n, 'data-parte-campo'));
  assert.ok(casillas.length >= 8, `🔴 SUELO: el borrador pinta ${casillas.length} casillas; se esperaban al menos 8`);
  const enfocadas = [];
  for (const casilla of casillas) casilla.focus = () => { enfocadas.push(casilla.getAttribute('data-parte-campo')); };
  assert.ok(boton.click() > 0, '🔴 «Editar» no tiene a nadie escuchando');
  assert.deepEqual(enfocadas, [casillas[0].getAttribute('data-parte-campo')], '🔴 «Editar» no deja el cursor en la primera casilla');
  assert.equal(enfocadas[0], 'entrada', '🔴 la primera casilla del borrador es la hora de entrada');
});

test('SCRUM-1822 ⑥ en la ficha del parte firmado no hay «Editar» y el motivo sigue ahí', async () => {
  const contenedor = await fichaReal(firmadoCon(MOTIVO_DEL_SERVIDOR));
  assert.equal(contenedor.querySelector('[data-parte-editar]'), null);
  const candado = contenedor.querySelector('[data-parte-candado]');
  assert.ok(candado, '🔴 la ficha del parte firmado no pinta el motivo');
  assert.equal(leido(candado), MOTIVO_DEL_SERVIDOR);
});

test('SCRUM-1822 ⑦ lo pintado tiene su regla en la hoja de estilos', () => {
  const clases = clasesDeLasHojas(RAIZ); // un Set; lanza si lee menos de 100 clases
  assert.ok(clases.has('parte-cabecera'), '🔴 CONTROL: el lector de hojas no ve una clase que SÍ tiene regla');
  assert.ok(!clases.has('parte-clase-que-no-existe'), '🔴 CONTROL: el lector de hojas da por buena cualquier clase');
  const candado = pintar(firmadoCon(MOTIVO_DEL_SERVIDOR)).candados[0];
  const boton = pintar(BORRADOR).editar[0];
  assert.ok(candado && boton, '🔴 falta el candado o el botón');
  assert.ok(conClase(candado, 'parte-candado') && conClase(boton, 'parte-editar'));
  const pintadas = [candado, boton].flatMap((n) => String(n.className || '').split(/\s+/).filter(Boolean));
  assert.deepEqual(pintadas.filter((c) => !clases.has(c)), [], '🔴 clase pintada sin regla: se vería desnuda');
});

test('SCRUM-1822 ⑦ la firma tiene su ficha, con los literales y la línea de aprobación', () => {
  assert.ok(fs.existsSync(FICHA), '🔴 falta la ficha de la firma en docs/microcopy/');
  const lineas = fs.readFileSync(FICHA, 'utf8').split(/\r?\n/);
  assert.ok(lineas.includes('> ' + MOTIVO_DEL_SERVIDOR), '🔴 la ficha no cita el motivo del servidor tal cual, en su propia línea de cita');
  assert.ok(lineas.includes('> ' + EDITAR), '🔴 la ficha no cita «Editar» tal cual, en su propia línea de cita');
  assert.ok(
    lineas.some((l) => l.startsWith('**Aprobado por el orquestador por delegación del fundador**') && /SCRUM-1656 comentario 22754/.test(l)),
    '🔴 la ficha no lleva la línea de firma delegada del motivo (docs/microcopy/README.md, punto 3), fuera de cita',
  );
});
