// SCRUM-1475 · EL PARTE TRAE A LA VISTA SU AVISO DE «NO SE HA PODIDO GUARDAR EL CAMBIO».
//
// El defecto, medido por S2 en yaqu.app el 6-oct-2026 (build `eb1fdefa`, parte 9 de la cuenta QA,
// cuatro ventanas): `avisarCampoNoGuardado` colgaba el aviso debajo del campo y NO llevaba la página
// hasta él. Con «Notas» al borde inferior de la ventana asomaban 13 px de su caja en móvil y 5 en
// escritorio: el aviso estaba y el técnico no lo veía.
//
// Aquí no hay maquetación —el banco no desplaza nada—, así que lo que se sujeta es la LLAMADA:
// quién la recibe, con qué opciones y EN QUÉ MOMENTO. Las tres cosas, porque cada una sola deja
// pasar un arreglo que no arregla:
//   · sobre otro nodo (la línea, la casilla) se trae otra cosa y el aviso puede seguir fuera;
//   · sin `block: 'nearest'` la página salta aunque el aviso ya se viera entero;
//   · antes de colgarlo, o con su línea plegada todavía cerrada, el navegador no tiene nada que traer.
// Que el aviso quede entero y libre del botón de ayuda y de la cabecera se mide en el navegador
// (registro `docs/master/SCRUM-1475.md`): eso depende también de la reserva de la página, que es
// SCRUM-1464 y no vive en este fichero.
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cargarDashboard, todos } from './_banco-vistas.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const BASE = Object.freeze({
  id: 7, numero: 'PT-2026-007', clienteNombre: 'Comunidad Los Olivos',
  fecha: '2026-09-02T08:00:00.000Z', obra: 'C/ Mayor 3', referencia: 'R-9',
  entrada: '08:00', salida: '11:30', desplazamientos: 1, kilometros: 12,
  tecnicos: ['Israel'], tipo: 'mantenimiento',
  lineas: [{ bloque: 'mano_obra', unds: 2, descripcion: 'Revisión' }],
  notas: 'Llave en portería', estado: 'borrador',
  puedeEditarContenido: { ok: true, motivo: null }, puedeEditarPrecios: { ok: true, motivo: null },
});

const attr = (n, a) => (n.getAttribute ? n.getAttribute(a) : null);
const esAviso = (n) => attr(n, 'data-parte-campo-no-guardado') != null;
const casilla = (c, nombre) => todos(c).find((x) => attr(x, 'data-parte-campo') === nombre);
const linea = (c, clave) => todos(c).find((x) => attr(x, 'data-parte-plegable') === clave);
const pausa = () => new Promise((r) => setTimeout(r, 5));

/** Rechaza el PATCH de los campos de `rechaza`; `sinLectura` hace fallar también el GET. */
function servidor(rechaza) {
  let guardado = { ...BASE };
  const estado = { rechaza: new Set(rechaza), sinLectura: false, patches: 0 };
  const apiRequest = async (ruta, opts = {}) => {
    if ((opts.method || 'GET') === 'PATCH') {
      estado.patches += 1;
      const cuerpo = JSON.parse(opts.body);
      if (Object.keys(cuerpo).some((k) => estado.rechaza.has(k))) throw new Error('API 500: server_error');
      guardado = { ...guardado, ...cuerpo };
      return guardado;
    }
    if (estado.sinLectura) throw new Error('Failed to fetch');
    return { ...guardado };
  };
  return { apiRequest, estado, leer: () => guardado };
}

/**
 * Monta la vista de verdad y apunta cada `scrollIntoView` que reciba un nodo creado por ella, con
 * la foto del instante: si el nodo ya cuelga de la ficha y si su línea plegada ya está abierta. Se
 * espía desde aquí, sin tocar el banco: el `scrollIntoView` del banco no hace nada y no apunta.
 */
async function montar(srv) {
  const b = cargarDashboard(RAIZ);
  const c = b.mk('div');
  b.ctx.document.body.appendChild(c);
  const traidos = [];
  const crear = b.ctx.document.createElement;
  b.ctx.document.createElement = function (etiqueta) {
    const n = crear.call(this, etiqueta);
    n.scrollIntoView = function (opciones) {
      const plegable = n.closest ? n.closest('[data-parte-plegable]') : null;
      traidos.push({
        nodo: n,
        opciones,
        colgadoDeLaFicha: todos(c).includes(n),
        suLineaAbierta: plegable ? attr(plegable, 'open') != null : null,
      });
    };
    return n;
  };
  const ok = await b.ctx.renderParteDetailView(c, 7, { apiRequest: srv.apiRequest });
  assert.notEqual(ok, false, '🔴 SUELO: la vista del parte no se ha montado');
  return { c, traidos };
}

async function escribir(c, nombre, valor) {
  const campo = casilla(c, nombre);
  assert.ok(campo, `🔴 SUELO: no está la casilla «${nombre}»`);
  campo.value = valor;
  assert.ok(campo.disparar('change') > 0, `🔴 SUELO: nadie escucha la casilla «${nombre}»`);
  await pausa();
}

test('SCRUM-1475 · 🔴 las notas no se guardan: el parte trae SU aviso a la vista, ya colgado y con la línea abierta', async () => {
  const srv = servidor(['notas']);
  const { c, traidos } = await montar(srv);
  await escribir(c, 'notas', 'Otra nota');

  assert.equal(srv.estado.patches, 1, '🔴 SUELO: el cambio no llegó a mandarse');
  const salen = todos(c).filter(esAviso);
  assert.equal(salen.length, 1, '🔴 SUELO: el aviso no está en la ficha, no hay nada que traer');

  const delAviso = traidos.filter((t) => t.nodo === salen[0]);
  assert.equal(delAviso.length, 1, '🔴 el aviso se cuelga y nadie lleva la página hasta él: si el campo estaba abajo, cae fuera de la pantalla');
  assert.deepEqual({ ...delAviso[0].opciones }, { block: 'nearest' },
    '🔴 `nearest` y nada más: con otra cosa la página salta aunque el aviso ya se viera entero');
  assert.equal(delAviso[0].colgadoDeLaFicha, true, '🔴 se trae ANTES de colgarlo: el navegador no tiene nada que traer');
  assert.equal(delAviso[0].suLineaAbierta, true, '🔴 se trae con su línea plegada cerrada: lo traído no se ve');
  assert.ok(todos(linea(c, 'notas')).includes(salen[0]), 'CONTROL: el aviso sigue en la línea de las notas');
  assert.deepEqual(traidos.filter((t) => !esAviso(t.nodo)).length, 0, 'CONTROL: no se trae a la vista ninguna otra cosa');
});

test('SCRUM-1475 · un campo de las horas, que no vive en una línea plegada: también se trae', async () => {
  const srv = servidor(['entrada']);
  const { c, traidos } = await montar(srv);
  await escribir(c, 'entrada', '09:15');

  const salen = todos(c).filter(esAviso);
  assert.equal(salen.length, 1, '🔴 SUELO: el aviso de las horas no está en la ficha');
  const delAviso = traidos.filter((t) => t.nodo === salen[0]);
  assert.equal(delAviso.length, 1, '🔴 el aviso de las horas no se trae a la vista');
  assert.deepEqual({ ...delAviso[0].opciones }, { block: 'nearest' });
  assert.equal(delAviso[0].colgadoDeLaFicha, true);
  assert.equal(delAviso[0].suLineaAbierta, null, 'CONTROL: las horas no están dentro de ninguna línea plegada');
});

test('SCRUM-1475 · cada fallo trae SU aviso: el segundo no se queda sin traer', async () => {
  const srv = servidor(['notas', 'obra']);
  const { c, traidos } = await montar(srv);
  await escribir(c, 'notas', 'Otra nota');
  await escribir(c, 'obra', 'C/ Nueva 1');

  assert.deepEqual(traidos.map((t) => attr(t.nodo, 'data-parte-campo-no-guardado')), ['notas', 'obra']);
  const queda = todos(c).filter(esAviso);
  assert.equal(queda.length, 1, 'CONTROL: cada fallo repinta, queda el aviso del último');
  assert.equal(traidos[1].nodo, queda[0], '🔴 el aviso que está en pantalla no es el que se trajo');
});

test('SCRUM-1475 · CONTROL: un guardado que sale bien no mueve la página', async () => {
  const srv = servidor([]);
  const { c, traidos } = await montar(srv);
  await escribir(c, 'notas', 'Otra nota');
  assert.equal(srv.leer().notas, 'Otra nota', '🔴 SUELO: el cambio no se guardó');
  assert.equal(todos(c).filter(esAviso).length, 0);
  assert.equal(traidos.length, 0, '🔴 la página se mueve sin que haya aviso que enseñar');
});

test('SCRUM-1475 · si tampoco se puede releer, la ficha dice que no carga y no se trae nada', async () => {
  const srv = servidor(['notas']);
  const { c, traidos } = await montar(srv);
  srv.estado.sinLectura = true;
  await escribir(c, 'notas', 'Otra nota');
  assert.ok(todos(c).some((x) => attr(x, 'data-parte-error') != null), '🔴 SUELO: la ficha no dice que no se pudo cargar');
  assert.equal(traidos.length, 0);
});
