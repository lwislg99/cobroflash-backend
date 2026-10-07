// SCRUM-1492 · LO QUE UNA CASILLA NUMÉRICA NO ENTIENDE NO BORRA EL VALOR GUARDADO.
//
// El defecto, medido en yaqu.app el 6-oct-2026 (descripción del ticket, 13 filas): con «2» guardado
// en Desplazamiento, teclear «1e», «-», «.» o «,» y salir de la casilla mandaba
// `{"desplazamientos":null}`. El servidor borraba el 2 con un 200, la ficha no decía nada y la
// casilla seguía enseñando lo tecleado. Una casilla `type="number"` entrega `value === ''` tanto si
// está vacía como si lo que tiene no es un número; lo que los distingue es `validity.badInput`.
//
// Monta la vista de verdad en el banco. El banco no modela `validity`: aquí se pone a mano en la
// casilla, con `value` vacío, que es lo que entrega el navegador.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cargarDashboard, todos } from './_banco-vistas.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DESPLAZAMIENTO = 'No se ha guardado. Desplazamiento es un número entero, como 1 o 2 — no el tiempo de viaje';
const KILOMETROS = 'No se ha guardado. Kilómetros es un número, como 12 o 12,5';
const EL_GENERAL = 'No se ha podido guardar el cambio — vuelve a intentarlo';

const BASE = Object.freeze({
  id: 7, numero: 'PT-2026-007', clienteNombre: 'Comunidad Los Olivos',
  fecha: '2026-09-02T08:00:00.000Z', obra: 'C/ Mayor 3', referencia: 'R-9',
  entrada: '08:00', salida: '11:30', desplazamientos: 2, kilometros: 12,
  tecnicos: ['Israel'], tipo: 'mantenimiento',
  lineas: [{ bloque: 'mano_obra', unds: 2, descripcion: 'Revisión' }],
  notas: 'Llave en portería', estado: 'borrador',
  puedeEditarContenido: { ok: true, motivo: null }, puedeEditarPrecios: { ok: true, motivo: null },
});

const attr = (n, a) => (n.getAttribute ? n.getAttribute(a) : null);
const avisos = (c) => todos(c).filter((x) => attr(x, 'data-parte-campo-no-guardado') != null);
const casilla = (c, nombre) => todos(c).find((x) => attr(x, 'data-parte-campo') === nombre);
const numericas = (c) => todos(c).filter((x) => attr(x, 'data-parte-campo') != null && attr(x, 'type') === 'number');
const pausa = () => new Promise((r) => setTimeout(r, 5));

function servidor(parte) {
  let guardado = { ...BASE, ...(parte || {}) };
  const cuerpos = [];
  const apiRequest = async (ruta, opts = {}) => {
    if ((opts.method || 'GET') !== 'PATCH') return { ...guardado };
    const cuerpo = JSON.parse(opts.body);
    cuerpos.push(cuerpo);
    guardado = { ...guardado, ...cuerpo };
    return guardado;
  };
  return { apiRequest, cuerpos, leer: () => guardado };
}

async function montar(srv) {
  const b = cargarDashboard(RAIZ);
  const c = b.mk('div');
  b.ctx.document.body.appendChild(c);
  const traidos = [];
  const crear = b.ctx.document.createElement;
  b.ctx.document.createElement = function (etiqueta) {
    const n = crear.call(this, etiqueta);
    n.scrollIntoView = function (opciones) { traidos.push({ nodo: n, opciones }); };
    return n;
  };
  const ok = await b.ctx.renderParteDetailView(c, 7, { apiRequest: srv.apiRequest });
  assert.notEqual(ok, false, '🔴 SUELO: la vista del parte no se ha montado');
  return { c, traidos };
}

/** Sale de la casilla con un valor que el navegador SÍ entiende (o con la casilla vacía de verdad). */
async function escribir(c, nombre, valor) {
  const campo = casilla(c, nombre);
  assert.ok(campo, `🔴 SUELO: no está la casilla «${nombre}»`);
  campo.validity = { badInput: false };
  campo.value = valor;
  assert.ok(campo.disparar('change') > 0, `🔴 SUELO: nadie escucha la casilla «${nombre}»`);
  await pausa();
}

/** Sale de la casilla con algo que NO es un número: el navegador entrega vacío y `badInput`. */
async function teclearLoQueNoEsUnNumero(c, nombre) {
  const campo = casilla(c, nombre);
  assert.ok(campo, `🔴 SUELO: no está la casilla «${nombre}»`);
  campo.validity = { badInput: true };
  campo.value = '';
  assert.ok(campo.disparar('change') > 0, `🔴 SUELO: nadie escucha la casilla «${nombre}»`);
  await pausa();
}

test('SCRUM-1492 · 🔴 Desplazamiento con 2 guardado y «1e» tecleado: NO se manda nada, el 2 sigue, y se dice', async () => {
  const srv = servidor();
  const { c } = await montar(srv);
  assert.equal(casilla(c, 'desplazamientos').value, '2', '🔴 SUELO: la casilla no trae el valor guardado');
  await teclearLoQueNoEsUnNumero(c, 'desplazamientos');

  assert.deepEqual(srv.cuerpos, [], '🔴 se ha mandado un guardado: lo que no es un número se ha leído como un borrado');
  assert.equal(srv.leer().desplazamientos, 2, '🔴 el valor guardado se ha borrado');
  assert.equal(casilla(c, 'desplazamientos').value, '2', '🔴 la casilla no enseña lo que hay guardado');
  const salen = avisos(c);
  assert.equal(salen.length, 1, '🔴 lo tecleado no ha entrado y la ficha no dice nada');
  assert.equal(salen[0].textContent, DESPLAZAMIENTO);
  assert.equal(attr(salen[0], 'data-parte-campo-no-guardado'), 'desplazamientos');
});

test('SCRUM-1492 · 🔴 lo mismo en Kilómetros con 12 guardado, con SU texto', async () => {
  const srv = servidor();
  const { c } = await montar(srv);
  await teclearLoQueNoEsUnNumero(c, 'kilometros');

  assert.deepEqual(srv.cuerpos, [], '🔴 se ha mandado un guardado');
  assert.equal(srv.leer().kilometros, 12, '🔴 el valor guardado se ha borrado');
  assert.equal(casilla(c, 'kilometros').value, '12');
  const salen = avisos(c);
  assert.equal(salen.length, 1);
  assert.equal(salen[0].textContent, KILOMETROS);
  assert.equal(attr(salen[0], 'data-parte-campo-no-guardado'), 'kilometros');
});

test('SCRUM-1492 · el aviso NO es el general: «no se ha podido guardar» sería falso, no se ha intentado', async () => {
  const srv = servidor();
  const { c } = await montar(srv);
  await teclearLoQueNoEsUnNumero(c, 'desplazamientos');
  await teclearLoQueNoEsUnNumero(c, 'kilometros');

  const textos = avisos(c).map((a) => a.textContent);
  assert.equal(textos.length, 2, '🔴 SUELO: no han salido los dos avisos');
  assert.equal(textos.includes(EL_GENERAL), false, '🔴 dice que el guardado ha fallado, y no se ha mandado ninguno');
  assert.equal(textos.some((t) => /vuelve a intentarlo/.test(t)), false, '🔴 manda a repetir algo que volvería a no entrar');
});

test('SCRUM-1492 · el aviso va en el paso de las horas, con `role="alert"`, y se trae a la vista', async () => {
  const srv = servidor();
  const { c, traidos } = await montar(srv);
  await teclearLoQueNoEsUnNumero(c, 'kilometros');

  const aviso = avisos(c)[0];
  assert.ok(aviso, '🔴 SUELO: no hay aviso');
  assert.equal(attr(aviso, 'role'), 'alert');
  const horas = todos(c).find((x) => /\bparte-horas\b/.test(String(x.className || '')) && x.tagName === 'SECTION');
  assert.ok(horas, '🔴 SUELO: no encuentro el paso de las horas');
  assert.ok(todos(horas).includes(aviso), '🔴 el aviso no está junto a la casilla');
  const suyos = traidos.filter((t) => t.nodo === aviso);
  assert.equal(suyos.length, 1, '🔴 el aviso no se trae a la vista');
  assert.deepEqual({ ...suyos[0].opciones }, { block: 'nearest' });
});

test('SCRUM-1492 · con la casilla VACÍA de antes, lo que no es un número tampoco se queda en pantalla sin decirlo', async () => {
  const srv = servidor({ desplazamientos: null });
  const { c } = await montar(srv);
  assert.equal(casilla(c, 'desplazamientos').value, '', '🔴 SUELO: la casilla no nace vacía');
  await teclearLoQueNoEsUnNumero(c, 'desplazamientos');

  assert.deepEqual(srv.cuerpos, []);
  assert.equal(avisos(c).length, 1, '🔴 no se ha guardado nada y la ficha no lo dice');
  assert.equal(avisos(c)[0].textContent, DESPLAZAMIENTO);
});

test('SCRUM-1492 · repetirlo deja UN aviso, y sigue sin mandarse nada', async () => {
  const srv = servidor();
  const { c } = await montar(srv);
  await teclearLoQueNoEsUnNumero(c, 'desplazamientos');
  await teclearLoQueNoEsUnNumero(c, 'desplazamientos');

  assert.deepEqual(srv.cuerpos, []);
  assert.equal(avisos(c).length, 1, '🔴 dos intentos dejan el aviso dos veces');
});

test('SCRUM-1492 · tras el aviso, un número bueno se guarda y el aviso se quita', async () => {
  const srv = servidor();
  const { c } = await montar(srv);
  await teclearLoQueNoEsUnNumero(c, 'desplazamientos');
  assert.equal(avisos(c).length, 1, '🔴 SUELO: el aviso no llegó a salir');

  await escribir(c, 'desplazamientos', '3');
  assert.deepEqual(srv.cuerpos, [{ desplazamientos: 3 }]);
  assert.equal(srv.leer().desplazamientos, 3);
  assert.equal(avisos(c).length, 0, '🔴 ya está guardado y la ficha sigue diciendo que no');
});

test('SCRUM-1492 · tras el aviso, BORRAR la casilla a propósito sigue borrando: la casilla volvió a lo guardado', async () => {
  const srv = servidor();
  const { c } = await montar(srv);
  await teclearLoQueNoEsUnNumero(c, 'desplazamientos');
  await escribir(c, 'desplazamientos', '');

  assert.deepEqual(srv.cuerpos, [{ desplazamientos: null }], '🔴 tras un intento que no entró, la casilla ya no deja borrar');
  assert.equal(srv.leer().desplazamientos, null);
});

test('SCRUM-1492 · CONTROL 🔴 borrar la casilla a propósito sigue mandando `null` y borrando, sin aviso', async () => {
  const srv = servidor();
  const { c } = await montar(srv);
  await escribir(c, 'desplazamientos', '');
  await escribir(c, 'kilometros', '');

  assert.deepEqual(srv.cuerpos, [{ desplazamientos: null }, { kilometros: null }], '🔴 un borrado de verdad ha dejado de guardarse');
  assert.equal(srv.leer().desplazamientos, null);
  assert.equal(srv.leer().kilometros, null);
  assert.equal(avisos(c).length, 0, '🔴 un borrado que sale bien no avisa de nada');
});

test('SCRUM-1492 · CONTROL: un valor bueno se sigue guardando, en las dos', async () => {
  const srv = servidor();
  const { c } = await montar(srv);
  await escribir(c, 'desplazamientos', '3');
  await escribir(c, 'kilometros', '12.5');

  assert.deepEqual(srv.cuerpos, [{ desplazamientos: 3 }, { kilometros: 12.5 }]);
  assert.equal(avisos(c).length, 0);
});

test('SCRUM-1492 · CONTROL: una casilla de texto, que no tiene `badInput`, sigue como estaba', async () => {
  const srv = servidor();
  const { c } = await montar(srv);
  const notas = casilla(c, 'notas');
  assert.ok(notas, '🔴 SUELO: no está la casilla de notas');
  notas.value = 'Llave en el bar';
  assert.ok(notas.disparar('change') > 0);
  await pausa();

  assert.deepEqual(srv.cuerpos, [{ notas: 'Llave en el bar' }]);
  assert.equal(avisos(c).length, 0);
});

// ═══════════════════════════════════════════════════════════════════════════════════════════
// DE PASO, EN EL MISMO PR · LOS CÓDIGOS DE RANGO DE LA RUTA TIENEN SU TEXTO.
//
// SCRUM-1488 (#2249) separó los rechazos de la ruta en un código por causa. Cuatro nacieron sin
// texto en la pantalla y caían en el general, que manda a «volver a intentarlo» algo que no va a
// entrar nunca. Y `-3` no es `badInput`: es un número, sólo que fuera de rango; lo de arriba no
// lo cubre. El servidor de aquí rechaza como `apiRequest` entrega un rechazo (`err.code`).
// ═══════════════════════════════════════════════════════════════════════════════════════════
const DESPLAZAMIENTO_NEGATIVO = 'No se ha guardado. Desplazamiento es 0 o más';
const KILOMETROS_NEGATIVO = 'No se ha guardado. Kilómetros es 0 o más';
const DESPLAZAMIENTO_NO_CABE = 'No se ha guardado. Ese número es demasiado grande para Desplazamiento';
const KILOMETROS_NO_CABE = 'No se ha guardado. Ese número es demasiado grande para Kilómetros';

/** Qué pinta la ficha ante cada código de `parteRango.ts`. Un código nuevo entra aquí con su texto. */
const TEXTO_DE_CADA_CODIGO = {
  desplazamientos_invalido: DESPLAZAMIENTO,
  desplazamientos_negativo: DESPLAZAMIENTO_NEGATIVO,
  desplazamientos_no_cabe: DESPLAZAMIENTO_NO_CABE,
  // Firmado en c.18706: el de Kilómetros, que es la misma causa cazada por la ruta. HOY NO SE
  // ALCANZA desde la casilla (lo que no es un número lo para `badInput` antes de mandarlo; medido
  // con `1e999`): es la red para el día que un cambio lo haga alcanzable.
  kilometros_invalido: KILOMETROS,
  kilometros_negativo: KILOMETROS_NEGATIVO,
  kilometros_no_cabe: KILOMETROS_NO_CABE,
};
/** Los que siguen en el general, con su motivo. No es una lista para que pase lo nuevo. Hoy, ninguno. */
const SIGUE_EN_EL_GENERAL = {};

/** Un servidor que rechaza todo `PATCH` con ese código, como la ruta: 400 y nada guardado. */
function servidorQueRechaza(codigo) {
  const guardado = { ...BASE };
  const cuerpos = [];
  const apiRequest = async (ruta, opts = {}) => {
    if ((opts.method || 'GET') !== 'PATCH') return { ...guardado };
    cuerpos.push(JSON.parse(opts.body));
    const e = new Error('lo que la ruta dice a quien la llama a mano');
    e.status = 400;
    e.code = codigo;
    throw e;
  };
  return { apiRequest, cuerpos, leer: () => guardado };
}

async function loQueSaleAl(codigo, nombre, valor) {
  const srv = servidorQueRechaza(codigo);
  const { c } = await montar(srv);
  await escribir(c, nombre, valor);
  assert.equal(srv.cuerpos.length, 1, '🔴 SUELO: el valor no llegó a mandarse, no hay rechazo que mirar');
  return { c, srv, salen: avisos(c) };
}

test('SCRUM-1492 · 🔴 «-3» en Desplazamiento: sale lo que VALE, no «vuelve a intentarlo», y la casilla vuelve a lo guardado', async () => {
  const { c, srv, salen } = await loQueSaleAl('desplazamientos_negativo', 'desplazamientos', '-3');

  assert.deepEqual(srv.cuerpos, [{ desplazamientos: -3 }], '🔴 SUELO: no se mandó lo tecleado');
  assert.equal(salen.length, 1, '🔴 la ruta lo rechazó y la ficha no dice nada');
  assert.equal(salen[0].textContent, DESPLAZAMIENTO_NEGATIVO);
  assert.equal(attr(salen[0], 'data-parte-campo-no-guardado'), 'desplazamientos');
  assert.equal(attr(salen[0], 'role'), 'alert');
  assert.equal(casilla(c, 'desplazamientos').value, '2', '🔴 la casilla enseña algo que no está guardado');
});

test('SCRUM-1492 · 🔴 «-5» en Kilómetros: su texto, y el 12 sigue en la casilla', async () => {
  const { c, salen } = await loQueSaleAl('kilometros_negativo', 'kilometros', '-5');

  assert.equal(salen.length, 1);
  assert.equal(salen[0].textContent, KILOMETROS_NEGATIVO);
  assert.equal(attr(salen[0], 'data-parte-campo-no-guardado'), 'kilometros');
  assert.equal(casilla(c, 'kilometros').value, '12');
});

test('SCRUM-1492 · 🔴 un número que no cabe, en las dos: se dice que es demasiado grande', async () => {
  const d = await loQueSaleAl('desplazamientos_no_cabe', 'desplazamientos', '3000000000');
  assert.equal(d.salen.length, 1);
  assert.equal(d.salen[0].textContent, DESPLAZAMIENTO_NO_CABE);
  assert.equal(casilla(d.c, 'desplazamientos').value, '2');

  const k = await loQueSaleAl('kilometros_no_cabe', 'kilometros', '100000000');
  assert.equal(k.salen.length, 1);
  assert.equal(k.salen[0].textContent, KILOMETROS_NO_CABE);
  assert.equal(casilla(k.c, 'kilometros').value, '12');
});

test('SCRUM-1492 · CENSO 🔴 cada código de rechazo de `parteRango.ts` tiene SU texto, y ninguno manda a reintentar', async () => {
  // Los códigos se LEEN de la ruta (sin sus comentarios): si S1 estrena uno, este test cae hasta
  // que tenga texto firmado o conste aquí por qué sigue en el general.
  const fuente = fs.readFileSync(path.join(RAIZ, 'src', 'modules', 'jobs', 'domain', 'parteRango.ts'), 'utf8')
    .split(/\r?\n/).filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n');
  const codigos = [...new Set([...fuente.matchAll(/error:\s*'([a-z_]+)'/g)].map((m) => m[1]))].sort();
  assert.ok(codigos.length >= 6, `🔴 SUELO: sólo he leído ${codigos.length} códigos de la ruta; no he podido mirar`);
  assert.deepEqual(codigos, [...Object.keys(TEXTO_DE_CADA_CODIGO), ...Object.keys(SIGUE_EN_EL_GENERAL)].sort(),
    '🔴 los códigos de la ruta han cambiado: uno nuevo necesita SU texto firmado antes de entrar');

  const dichos = [];
  for (const codigo of codigos) {
    const nombre = codigo.startsWith('desplazamientos_') ? 'desplazamientos' : 'kilometros';
    const { salen } = await loQueSaleAl(codigo, nombre, '7');
    assert.equal(salen.length, 1, `🔴 «${codigo}»: la ruta rechazó y la ficha no dice nada`);
    dichos.push(salen[0].textContent);
    if (codigo in SIGUE_EN_EL_GENERAL) {
      assert.equal(salen[0].textContent, EL_GENERAL, `«${codigo}» consta como «sigue en el general» y ya no lo está`);
    } else {
      assert.equal(salen[0].textContent, TEXTO_DE_CADA_CODIGO[codigo], `🔴 «${codigo}» no pinta su texto`);
      assert.equal(/vuelve a intentarlo/.test(salen[0].textContent), false,
        `🔴 «${codigo}» manda a repetir algo que la ruta va a rechazar siempre`);
    }
  }
  const propios = dichos.filter((t) => t !== EL_GENERAL);
  assert.equal(new Set(propios).size, propios.length, '🔴 dos causas distintas dicen lo mismo: un texto por causa');
});

test('SCRUM-1492 · CONTROL 🔴 un fallo que NO es un rechazo de rango sigue con el general', async () => {
  const quinientos = await loQueSaleAl('server_error', 'desplazamientos', '3');
  assert.equal(quinientos.salen.length, 1, '🔴 SUELO: el guardado falló y no hay aviso');
  assert.equal(quinientos.salen[0].textContent, EL_GENERAL, '🔴 un texto de rango se ha comido el caso general');

  // Un código que coincide con algo que TODO objeto trae no es un código de la tabla.
  const heredado = await loQueSaleAl('constructor', 'kilometros', '3');
  assert.equal(heredado.salen[0].textContent, EL_GENERAL);
});

test('SCRUM-1492 · las dos casillas numéricas llevan `min="0"`, y las de texto no', async () => {
  const srv = servidor();
  const { c } = await montar(srv);
  const dos = numericas(c);
  assert.equal(dos.length, 2, '🔴 SUELO: no están las dos casillas numéricas');
  assert.deepEqual(dos.map((x) => attr(x, 'min')), ['0', '0']);
  assert.equal(attr(casilla(c, 'notas'), 'min'), null);
});

test('SCRUM-1492 · CENSO: TODA casilla numérica de la cabecera tiene qué decir, y no es el general', async () => {
  const srv = servidor();
  const { c } = await montar(srv);
  const nombres = numericas(c).map((x) => attr(x, 'data-parte-campo'));
  assert.deepEqual([...nombres].sort(), ['desplazamientos', 'kilometros'],
    '🔴 las casillas numéricas de la cabecera han cambiado: una nueva necesita SU texto firmado antes de entrar');

  await teclearLoQueNoEsUnNumero(c, 'desplazamientos');
  await teclearLoQueNoEsUnNumero(c, 'kilometros');
  const dichos = avisos(c);
  assert.equal(dichos.length, nombres.length, '🔴 una casilla numérica no dice nada cuando lo tecleado no entra');
  assert.equal(dichos.every((a) => a.textContent && a.textContent !== EL_GENERAL), true);
  assert.deepEqual(srv.cuerpos, []);
});
