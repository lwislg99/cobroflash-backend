// SCRUM-1302 (B) · UN CAMPO DE LA CABECERA DEL PARTE QUE NO SE GUARDA, SE DICE.
//
// El defecto, medido en yaqu.app el 1-oct-2026 (c.17880): el `PATCH` de un campo falla, la ficha
// se repinta desde el servidor, la casilla vuelve al valor viejo, su línea plegada se cierra y
// no sale ningún texto.
//
// El literal está FIRMADO en SCRUM-1302 c.18288 (6-oct-2026) y se compara aquí letra a letra:
//   «No se ha podido guardar el cambio — vuelve a intentarlo»
//
// Monta la vista de verdad en el banco, con un servidor que rechaza el campo que se le diga.
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cargarDashboard, todos } from './_banco-vistas.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FIRMADO_EN_18288 = 'No se ha podido guardar el cambio — vuelve a intentarlo';

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

test('SCRUM-1302b · 🔴 las notas no se guardan: sale el texto firmado, en su línea, y la línea queda ABIERTA', async () => {
  const srv = servidor(['notas']);
  const c = await montar(srv);
  await escribir(c, 'notas', 'Otra nota');

  assert.equal(srv.estado.patches, 1, '🔴 SUELO: el cambio no llegó a mandarse');
  assert.equal(casilla(c, 'notas').value, 'Llave en portería', 'la casilla enseña lo que quedó en el servidor');
  const salen = avisos(c);
  assert.equal(salen.length, 1, '🔴 el guardado falló y la ficha no dice nada');
  assert.equal(salen[0].textContent, FIRMADO_EN_18288);
  assert.equal(attr(salen[0], 'role'), 'alert');
  const notas = linea(c, 'notas');
  assert.ok(todos(notas).includes(salen[0]), '🔴 el aviso no está en la línea del campo que falló');
  assert.notEqual(attr(notas, 'open'), null, '🔴 la línea se queda cerrada: el aviso está y no se ve');
  assert.equal(attr(linea(c, 'obra'), 'open'), null, 'CONTROL: las demás líneas no se abren');
});

test('SCRUM-1302b · un campo de las horas: el aviso va en el paso de las horas', async () => {
  const srv = servidor(['desplazamientos']);
  const c = await montar(srv);
  await escribir(c, 'desplazamientos', '3');

  const salen = avisos(c);
  assert.equal(salen.length, 1);
  assert.equal(salen[0].textContent, FIRMADO_EN_18288);
  const horas = todos(c).find((x) => /\bparte-horas\b/.test(String(x.className || '')) && x.tagName === 'SECTION');
  assert.ok(horas, '🔴 SUELO: no encuentro el paso de las horas');
  assert.ok(todos(horas).includes(salen[0]), '🔴 el aviso no está junto a las horas');
});

test('SCRUM-1302b · el tipo de intervención, que no es una casilla sino tres radios', async () => {
  const srv = servidor(['tipo']);
  const c = await montar(srv);
  const radio = todos(c).find((x) => attr(x, 'name') === 'parte-tipo' && attr(x, 'value') === 'instalacion');
  radio.checked = true;
  assert.ok(radio.disparar('change') > 0, '🔴 SUELO: nadie escucha el radio');
  await pausa();

  const salen = avisos(c);
  assert.equal(salen.length, 1, '🔴 el tipo no se guardó y no se dice');
  const tipo = linea(c, 'tipo');
  assert.ok(todos(tipo).includes(salen[0]));
  assert.notEqual(attr(tipo, 'open'), null);
  assert.equal(srv.leer().tipo, 'mantenimiento', 'CONTROL: el servidor sigue con el tipo de antes');
});

test('SCRUM-1302b · 🔴 si ese campo se guarda después, el aviso SE QUITA; el de otro campo, no', async () => {
  const srv = servidor(['notas', 'obra']);
  const c = await montar(srv);
  await escribir(c, 'notas', 'Otra nota');
  await escribir(c, 'obra', 'C/ Nueva 1');
  assert.deepEqual(avisos(c).map((x) => attr(x, 'data-parte-campo-no-guardado')), ['obra'],
    'cada fallo repinta: queda el aviso del último');

  srv.estado.rechaza.delete('obra');
  await escribir(c, 'referencia', 'R-10');
  assert.equal(avisos(c).length, 1, '🔴 guardar OTRO campo ha borrado un aviso que sigue siendo verdad');

  await escribir(c, 'obra', 'C/ Nueva 1');
  assert.equal(srv.leer().obra, 'C/ Nueva 1', '🔴 SUELO: el reintento no se guardó');
  assert.equal(avisos(c).length, 0, '🔴 el campo ya está guardado y la ficha sigue diciendo que no');
});

test('SCRUM-1302b · CONTROL: un guardado que sale bien no pinta ningún aviso', async () => {
  const srv = servidor([]);
  const c = await montar(srv);
  await escribir(c, 'notas', 'Otra nota');
  assert.equal(srv.leer().notas, 'Otra nota', '🔴 SUELO: el cambio no se guardó');
  assert.equal(avisos(c).length, 0);
});

test('SCRUM-1302b · si tampoco se puede releer, manda el aviso de carga y no se añade otro', async () => {
  const srv = servidor(['notas']);
  const c = await montar(srv);
  srv.estado.sinLectura = true;
  await escribir(c, 'notas', 'Otra nota');
  assert.ok(todos(c).some((x) => attr(x, 'data-parte-error') != null), '🔴 SUELO: la ficha no dice que no se pudo cargar');
  assert.equal(avisos(c).length, 0);
});
