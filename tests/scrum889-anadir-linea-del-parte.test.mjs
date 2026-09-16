// tests/scrum889-anadir-linea-del-parte.test.mjs — SCRUM-889
//
// ═════════════════════════════════════════════════════════════════════════════════════════════
// 🔴 EL TÉCNICO NO PODÍA APUNTAR NI UNA LÍNEA EN EL PARTE
//
// Medido corriendo el 16-sep-2026 (docs/master/SCRUM-889.md, PASO 0), app real y Edge a 390 y 1280
// px: «Añadir línea» se pinta (`parteDetailView.js`, `.parte-anadir`) y NADA lo escucha. Pulsarlo
// no añade fila ni manda nada. La «×» de una línea guardada, igual: se pinta y no quita nada. Y sin
// clave de IA el dictado responde «No se ha podido sacar ninguna línea» — eso es otro ticket.
//
// El arreglo usa el patrón de líneas que ya tiene la casa (el de «Añadir estas líneas» del
// dictado, `confirmarLoDictado`): la línea se escribe con el `PATCH` de SIEMPRE mandando la lista
// ENTERA —las que había más la nueva—, SÓLO con cantidad y descripción puestas por el técnico
// (`lineasConfirmadas`: una línea sin cantidad no sale), y después se relee el parte del servidor.
//
// ── EL BANCO ─────────────────────────────────────────────────────────────────────────────────
// La vista DE VERDAD, cargada con `vm`, sobre el mini-DOM de `_banco-vistas.mjs` (sin dependencias
// nuevas, regla 36). Se pulsa y se teclea por sus escuchadores. Lo único doblado es `apiRequest`.
// ═════════════════════════════════════════════════════════════════════════════════════════════
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { nodo } from './_banco-vistas.mjs';

const RAIZ = path.resolve(import.meta.dirname, '..');
const VISTA = path.join(RAIZ, 'public', 'dashboard', 'js', 'parteDetailView.js');

const PARTE = Object.freeze({
  id: 7, numero: 'PT-2026-889', clienteNombre: 'María López',
  fecha: '2026-09-16T08:00:00.000Z', obra: 'C/ Mayor 3', referencia: null,
  entrada: '09:00', salida: null, desplazamientos: null, kilometros: null,
  tecnicos: [], tipo: 'reparacion_asistencia',
  lineas: [{ bloque: 'materiales', unds: 3, descripcion: 'Magnetotérmico 16 A' }],
  notas: null, estado: 'borrador',
  puedeEditarContenido: { ok: true, motivo: null }, puedeEditarPrecios: { ok: true, motivo: null },
});

function montar() {
  const reg = { porId: new Map(), selectoresNoSoportados: [] };
  const ctx = {
    console, window: null, Date, Array, Object, String, Number, JSON, Promise, Error, isFinite,
    document: { createElement: (t) => nodo(t, reg) },
  };
  ctx.window = ctx;
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(VISTA, 'utf8'), ctx, { filename: 'parteDetailView.js' });
  return { ctx, cont: nodo('div', reg), reg };
}

/** Un servidor de mentira con UN parte: GET lo devuelve, PATCH de `lineas` lo reemplaza. */
function servidor({ patchFalla = false } = {}) {
  const estado = { parte: JSON.parse(JSON.stringify(PARTE)), pedidas: [] };
  estado.apiRequest = async (ruta, opciones = {}) => {
    const metodo = opciones.method || 'GET';
    const cuerpo = opciones.body ? JSON.parse(opciones.body) : null;
    estado.pedidas.push({ metodo, ruta, cuerpo });
    if (ruta !== '/admin/partes/7') throw new Error('ruta inesperada ' + ruta);
    if (metodo === 'GET') return JSON.parse(JSON.stringify(estado.parte));
    if (metodo === 'PATCH') {
      if (patchFalla) throw new Error('sin red');
      if (cuerpo.lineas) estado.parte.lineas = cuerpo.lineas;
      return { ok: true };
    }
    throw new Error('método inesperado ' + metodo);
  };
  estado.escrituras = () => estado.pedidas.filter((p) => p.metodo !== 'GET');
  return estado;
}

const vaciar = async () => { for (let i = 0; i < 8; i++) await new Promise((r) => setImmediate(r)); };

async function abrir(opciones) {
  const { ctx, cont, reg } = montar();
  const srv = servidor(opciones);
  const ok = await ctx.renderParteDetailView(cont, 7, { apiRequest: srv.apiRequest });
  assert.equal(ok, true, '🔴 NO PUDE MIRAR: la vista no pintó el parte');
  return { ctx, cont, srv, reg };
}

const botonAnadir = (cont, bloque) => {
  const b = cont.querySelectorAll('.parte-anadir').find((x) => x.getAttribute('data-bloque') === bloque);
  assert.ok(b, `🔴 NO PUDE MIRAR: no hay botón «Añadir línea» en ${bloque}`);
  return b;
};
const camposDesc = (cont) => cont.querySelectorAll('input.parte-linea-desc');
const camposUnds = (cont) => cont.querySelectorAll('input.parte-linea-unds');

/** Pulsa «Añadir línea» y devuelve los dos campos de la fila que ha aparecido. */
async function anadir(cont, bloque) {
  const antesDesc = camposDesc(cont).length;
  const antesUnds = camposUnds(cont).length;
  const escuchas = botonAnadir(cont, bloque).dispararClick();
  await vaciar();
  assert.ok(escuchas > 0, '🔴 «Añadir línea» NO TIENE ESCUCHADOR: se pinta y pulsarlo no hace nada.');
  const desc = camposDesc(cont);
  const unds = camposUnds(cont);
  assert.equal(desc.length, antesDesc + 1, '🔴 pulsar «Añadir línea» no ha añadido una línea en la que escribir');
  assert.equal(unds.length, antesUnds + 1, '🔴 la línea nueva no trae su casilla de UNDS');
  const nuevaDesc = desc.find((x) => !x.hasAttribute('data-linea-desc'));
  const nuevaUnds = unds.find((x) => !x.hasAttribute('data-linea-unds'));
  assert.ok(nuevaDesc && nuevaUnds, '🔴 no distingo la línea nueva de las guardadas');
  return { desc: nuevaDesc, unds: nuevaUnds };
}

async function teclear(campo, valor) {
  campo.value = valor;
  campo.disparar('change');
  await vaciar();
}

// ═══ ① EL ROJO ═════════════════════════════════════════════════════════════════════════════════

test('SCRUM-889 · 🔴 pulsar «Añadir línea» añade una línea en la que escribir, en SU bloque', async () => {
  const { cont, srv } = await abrir();
  const nueva = await anadir(cont, 'mano_obra');
  assert.equal(nueva.desc.value, '', 'la línea nueva nace vacía');
  assert.equal(srv.escrituras().length, 0, '🔴 pulsar «Añadir línea» no puede escribir nada todavía: no hay nada que guardar');
});

test('SCRUM-889 · 🔴 con cantidad y descripción, la línea se GUARDA (lista entera) y el parte se relee del servidor', async () => {
  const { cont, srv } = await abrir();
  const nueva = await anadir(cont, 'mano_obra');
  await teclear(nueva.unds, '2');
  assert.equal(srv.escrituras().length, 0, 'con sólo la cantidad todavía no se manda nada');
  await teclear(nueva.desc, 'Cambio de diferencial');

  const esc = srv.escrituras();
  assert.equal(esc.length, 1, '🔴 la línea apuntada no ha llegado al servidor');
  assert.equal(esc[0].metodo, 'PATCH');
  assert.deepEqual(esc[0].cuerpo, {
    lineas: [
      { bloque: 'materiales', unds: 3, descripcion: 'Magnetotérmico 16 A' },
      { bloque: 'mano_obra', unds: 2, descripcion: 'Cambio de diferencial' },
    ],
  }, '🔴 el PATCH reemplaza la lista ENTERA: tiene que llevar las que había MÁS la nueva, y ni un importe');
  const gets = srv.pedidas.filter((p) => p.metodo === 'GET').length;
  assert.equal(gets, 2, '🔴 tras guardar no se relee el parte: la pantalla enseñaría lo que creemos que mandamos');
  assert.equal(camposDesc(cont).filter((x) => x.value === 'Cambio de diferencial').length, 1,
    'la línea guardada vuelve pintada desde el servidor, una sola vez');
});

test('SCRUM-889 · en «Materiales» la línea va a materiales', async () => {
  const { cont, srv } = await abrir();
  const nueva = await anadir(cont, 'materiales');
  await teclear(nueva.desc, 'Cable 2,5 mm');
  await teclear(nueva.unds, '10');
  assert.deepEqual(srv.escrituras()[0]?.cuerpo?.lineas?.[1], { bloque: 'materiales', unds: 10, descripcion: 'Cable 2,5 mm' });
});

test('SCRUM-889 · sin cantidad, o sin descripción, NO se manda nada (una línea sin cantidad no sale)', async () => {
  for (const [unds, desc] of [['', 'Revisión'], ['0', 'Revisión'], ['2', '   ']]) {
    const { cont, srv } = await abrir();
    const nueva = await anadir(cont, 'mano_obra');
    await teclear(nueva.unds, unds);
    await teclear(nueva.desc, desc);
    assert.equal(srv.escrituras().length, 0, `🔴 se ha mandado una línea incompleta (unds «${unds}», descripción «${desc}»)`);
  }
});

test('SCRUM-889 · si el guardado FALLA no se hace como si se hubiera guardado: se dice, y lo tecleado sigue ahí', async () => {
  const { cont, srv, ctx } = await abrir({ patchFalla: true });
  const nueva = await anadir(cont, 'mano_obra');
  await teclear(nueva.unds, '2');
  await teclear(nueva.desc, 'Cambio de diferencial');
  assert.equal(srv.escrituras().length, 1, 'control: se intentó guardar');
  assert.equal(srv.pedidas.filter((p) => p.metodo === 'GET').length, 1, '🔴 se ha repintado desde el servidor y lo tecleado se ha perdido');
  const aviso = cont.querySelectorAll('[data-linea-no-guardada]');
  assert.equal(aviso.length, 1, '🔴 el fallo no se dice: el técnico creería que ya está apuntada');
  assert.equal(aviso[0].textContent, ctx.PARTE_TEXTOS.noSeGuardo, 'el aviso es el literal APROBADO, no uno nuevo');
  assert.equal(nueva.desc.value, 'Cambio de diferencial');
});

test('SCRUM-889 · pulsar «Añadir línea» dos veces no deja dos líneas vacías', async () => {
  const { cont } = await abrir();
  await anadir(cont, 'mano_obra');
  const antes = camposDesc(cont).length;
  botonAnadir(cont, 'mano_obra').dispararClick();
  await vaciar();
  assert.equal(camposDesc(cont).length, antes, '🔴 cada pulsación deja otra línea vacía');
});

// ═══ ② LA «×» ═════════════════════════════════════════════════════════════════════════════════

test('SCRUM-889 · 🔴 la «×» de una línea GUARDADA la quita (lista entera sin ella) y relee', async () => {
  const { cont, srv } = await abrir();
  const x = cont.querySelectorAll('.parte-quitar-linea').find((b) => b.getAttribute('data-indice') === '0');
  assert.ok(x, '🔴 NO PUDE MIRAR: no hay «×» en la línea guardada');
  const escuchas = x.dispararClick();
  await vaciar();
  assert.ok(escuchas > 0, '🔴 la «×» NO TIENE ESCUCHADOR: se pinta y pulsarla no quita nada.');
  assert.deepEqual(srv.escrituras().map((e) => e.cuerpo), [{ lineas: [] }], '🔴 la línea no se ha quitado en el servidor');
  assert.equal(srv.pedidas.filter((p) => p.metodo === 'GET').length, 2, '🔴 tras quitar no se relee el parte');
});

test('SCRUM-889 · la «×» de la línea NUEVA sin guardar sólo la quita de la pantalla: no escribe', async () => {
  const { cont, srv } = await abrir();
  await anadir(cont, 'mano_obra');
  const antes = camposDesc(cont).length;
  const x = cont.querySelectorAll('.parte-quitar-linea').find((b) => !b.hasAttribute('data-indice'));
  assert.ok(x, '🔴 la línea nueva no trae su «×»');
  x.dispararClick();
  await vaciar();
  assert.equal(srv.escrituras().length, 0, '🔴 quitar una línea que nunca se guardó ha escrito en el servidor');
  assert.equal(camposDesc(cont).length, antes - 1, '🔴 la línea nueva sigue en pantalla');
});

// ═══ ③ PARTE FIRMADO: no hay botón y nada que escuchar ════════════════════════════════════════

test('SCRUM-889 · un parte FIRMADO no ofrece «Añadir línea» ni «×»', async () => {
  const { ctx, cont } = montar();
  const firmado = { ...PARTE, estado: 'firmado', puedeEditarContenido: { ok: false, motivo: 'firmado' } };
  await ctx.renderParteDetailView(cont, 7, { apiRequest: async () => firmado });
  assert.equal(cont.querySelectorAll('.parte-anadir').length, 0);
  assert.equal(cont.querySelectorAll('.parte-quitar-linea').length, 0);
});
