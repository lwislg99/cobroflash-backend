// SCRUM-1491 · QUIEN TECLEA «1,5» EN DESPLAZAMIENTO LEE QUÉ VALE, NO «VUELVE A INTENTARLO».
//
// El defecto, medido en yaqu.app el 6-oct-2026 (descripción del ticket): la ruta rechaza el campo
// con 400 `desplazamientos_invalido`, y la ficha enseñaba el aviso general, que manda a repetir
// algo que no va a entrar nunca.
//
// El literal está FIRMADO en SCRUM-1491 c.18517 (6-oct-2026) y se compara aquí letra a letra:
//   «No se ha guardado. Desplazamiento es un número entero, como 1 o 2 — no el tiempo de viaje»
//
// Monta la vista de verdad en el banco. El servidor de aquí rechaza como `apiRequest` entrega un
// rechazo (`public/dashboard/js/api.js`: `err.status`, `err.code`, y el `message` del servidor
// como mensaje del error), con la regla de la ruta para ese campo: entero y que quepa.
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cargarDashboard, todos } from './_banco-vistas.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FIRMADO_EN_18517 = 'No se ha guardado. Desplazamiento es un número entero, como 1 o 2 — no el tiempo de viaje';
const EL_GENERAL = 'No se ha podido guardar el cambio — vuelve a intentarlo';
const MENSAJE_DE_LA_RUTA = 'Los desplazamientos son un número entero.';
const TOPE_DE_LA_COLUMNA = 2147483647;

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
const avisos = (c) => todos(c).filter((x) => attr(x, 'data-parte-campo-no-guardado') != null);
const casilla = (c, nombre) => todos(c).find((x) => attr(x, 'data-parte-campo') === nombre);
const pausa = () => new Promise((r) => setTimeout(r, 5));

/** Un rechazo tal como lo lanza `apiRequest`. */
function rechazo(status, code, message) {
  const e = new Error(message || `API ${status}: ${code || 'server_error'}`);
  e.status = status;
  e.code = code || null;
  return e;
}

/**
 * `averia`, si se pone, es lo que se lanza en vez de aplicar la regla: un 500, un corte de red.
 * Sin ella, Desplazamiento se valida como en la ruta y lo demás se guarda.
 */
function servidor() {
  let guardado = { ...BASE };
  const estado = { averia: null, cuerpos: [] };
  const apiRequest = async (ruta, opts = {}) => {
    if ((opts.method || 'GET') !== 'PATCH') return { ...guardado };
    const cuerpo = JSON.parse(opts.body);
    estado.cuerpos.push(cuerpo);
    if (estado.averia) throw estado.averia;
    const d = cuerpo.desplazamientos;
    // Desde SCRUM-1488 la ruta da UN CÓDIGO POR CAUSA: el que no cabe ya no es `_invalido`.
    if (d !== undefined && d !== null) {
      if (!Number.isInteger(d)) throw rechazo(400, 'desplazamientos_invalido', MENSAJE_DE_LA_RUTA);
      if (d > TOPE_DE_LA_COLUMNA) throw rechazo(400, 'desplazamientos_no_cabe', `Los desplazamientos no pueden pasar de ${TOPE_DE_LA_COLUMNA}.`);
    }
    guardado = { ...guardado, ...cuerpo };
    return guardado;
  };
  return { apiRequest, estado, leer: () => guardado };
}

async function montar(srv) {
  const b = cargarDashboard(RAIZ);
  const c = b.mk('div');
  b.ctx.document.body.appendChild(c);
  const ok = await b.ctx.renderParteDetailView(c, 7, { apiRequest: srv.apiRequest });
  assert.notEqual(ok, false, '🔴 SUELO: la vista del parte no se ha montado');
  return c;
}

async function escribir(c, nombre, valor) {
  const campo = casilla(c, nombre);
  assert.ok(campo, `🔴 SUELO: no está la casilla «${nombre}»`);
  campo.value = valor;
  assert.ok(campo.disparar('change') > 0, `🔴 SUELO: nadie escucha la casilla «${nombre}»`);
  await pausa();
}

test('SCRUM-1491 · 🔴 «1,5» en Desplazamiento: sale el literal firmado, letra a letra, y no «vuelve a intentarlo»', async () => {
  const srv = servidor();
  const c = await montar(srv);
  // Lo que el navegador entrega de un «1,5» tecleado en una casilla numérica en es-ES.
  await escribir(c, 'desplazamientos', '1.5');

  assert.deepEqual(srv.estado.cuerpos, [{ desplazamientos: 1.5 }], '🔴 SUELO: no se mandó lo que se tecleó');
  assert.equal(srv.leer().desplazamientos, 1, '🔴 SUELO: la ruta de aquí no lo rechazó');
  const salen = avisos(c);
  assert.equal(salen.length, 1, '🔴 el campo no se guardó y la ficha no dice nada');
  assert.equal(salen[0].textContent, FIRMADO_EN_18517);
  assert.equal(attr(salen[0], 'data-parte-campo-no-guardado'), 'desplazamientos');
  assert.equal(attr(salen[0], 'role'), 'alert');
  assert.equal(casilla(c, 'desplazamientos').value, '1', 'la casilla vuelve a lo que quedó en el servidor');
  const horas = todos(c).find((x) => /\bparte-horas\b/.test(String(x.className || '')) && x.tagName === 'SECTION');
  assert.ok(horas, '🔴 SUELO: no encuentro el paso de las horas');
  assert.ok(todos(horas).includes(salen[0]), '🔴 el aviso ha cambiado de sitio: va junto a las horas, como el general');
});

// Hasta SCRUM-1488 el número que no cabe compartía código con «no es entero», y este literal salía
// para los dos. La ruta los separó (un código por causa) y el que no cabe tiene su texto: lo fija,
// letra a letra, `tests/scrum1492-lo-que-no-es-un-numero-no-borra-lo-guardado.test.mjs`.
test('SCRUM-1491 · un número que no cabe tiene código propio: sale SU texto, ni este literal ni el general', async () => {
  const srv = servidor();
  const c = await montar(srv);
  await escribir(c, 'desplazamientos', '3000000000');

  assert.deepEqual(srv.estado.cuerpos, [{ desplazamientos: 3000000000 }], '🔴 SUELO: no se mandó el número');
  assert.equal(srv.leer().desplazamientos, 1, '🔴 SUELO: la ruta de aquí no lo rechazó');
  const salen = avisos(c);
  assert.equal(salen.length, 1, '🔴 la ruta lo rechazó y la ficha no dice nada');
  assert.notEqual(salen[0].textContent, FIRMADO_EN_18517, '🔴 «es un número entero» a quien ha tecleado un entero');
  assert.notEqual(salen[0].textContent, EL_GENERAL, '🔴 manda a reintentar algo que la ruta va a rechazar siempre');
});

test('SCRUM-1491 · CONTROL 🔴 un 500 en ese mismo campo sigue con el aviso general', async () => {
  const srv = servidor();
  const c = await montar(srv);
  srv.estado.averia = rechazo(500, 'server_error');
  await escribir(c, 'desplazamientos', '3');

  const salen = avisos(c);
  assert.equal(salen.length, 1, '🔴 SUELO: el guardado falló y no hay aviso');
  assert.equal(salen[0].textContent, EL_GENERAL, '🔴 el literal nuevo se ha comido el caso general');
});

test('SCRUM-1491 · CONTROL 🔴 sin red (un error sin código) sigue con el aviso general', async () => {
  const srv = servidor();
  const c = await montar(srv);
  srv.estado.averia = new Error('Failed to fetch');
  await escribir(c, 'desplazamientos', '3');

  const salen = avisos(c);
  assert.equal(salen.length, 1, '🔴 SUELO: el guardado falló y no hay aviso');
  assert.equal(salen[0].textContent, EL_GENERAL);
});

test('SCRUM-1491 · 🔴 se decide por el CÓDIGO: el mensaje de la ruta sin su código no cambia el texto', async () => {
  const srv = servidor();
  const c = await montar(srv);
  // El mismo mensaje y el mismo estado, con otro código: quien decida leyendo texto cae aquí.
  srv.estado.averia = rechazo(400, 'otro_codigo', MENSAJE_DE_LA_RUTA + ' desplazamientos_invalido');
  await escribir(c, 'desplazamientos', '1.5');

  const salen = avisos(c);
  assert.equal(salen.length, 1, '🔴 SUELO: el guardado falló y no hay aviso');
  assert.equal(salen[0].textContent, EL_GENERAL, '🔴 la vista ha decidido leyendo el mensaje del servidor');
});

test('SCRUM-1491 · CONTROL: Kilómetros rechazado con SU código sigue con el aviso general', async () => {
  const srv = servidor();
  const c = await montar(srv);
  srv.estado.averia = rechazo(400, 'kilometros_invalido', 'Los kilómetros son un número.');
  await escribir(c, 'kilometros', '12.5');

  const salen = avisos(c);
  assert.equal(salen.length, 1, '🔴 SUELO: el guardado falló y no hay aviso');
  assert.equal(attr(salen[0], 'data-parte-campo-no-guardado'), 'kilometros');
  assert.equal(salen[0].textContent, EL_GENERAL);
});

test('SCRUM-1491 · 🔴 corregido a un entero, se guarda y el aviso SE QUITA', async () => {
  const srv = servidor();
  const c = await montar(srv);
  await escribir(c, 'desplazamientos', '1.5');
  assert.equal(avisos(c).length, 1, '🔴 SUELO: el rechazo no dejó aviso');

  await escribir(c, 'desplazamientos', '2');
  assert.equal(srv.leer().desplazamientos, 2, '🔴 SUELO: el entero no se guardó');
  assert.equal(avisos(c).length, 0, '🔴 el campo ya está guardado y la ficha sigue diciendo que no');
});

test('SCRUM-1491 · 🔴 Desplazamiento pide el teclado SIN coma; Kilómetros conserva el suyo', async () => {
  const c = await montar(servidor());
  const d = casilla(c, 'desplazamientos');
  const k = casilla(c, 'kilometros');
  assert.ok(d && k, '🔴 SUELO: faltan las casillas');
  assert.equal(attr(d, 'type'), 'number');
  assert.equal(attr(d, 'inputmode'), 'numeric', '🔴 la casilla de un entero sigue ofreciendo la coma');
  assert.equal(attr(k, 'inputmode'), 'decimal', '🔴 Kilómetros admite «12,5» y ha perdido su teclado');
  assert.equal(attr(casilla(c, 'obra'), 'inputmode'), null, 'CONTROL: un campo de texto no lleva teclado numérico');
});
