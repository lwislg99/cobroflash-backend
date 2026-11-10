// tests/scrum1675-dictado-sobrevive-a-la-recarga.test.mjs — SCRUM-1675 (PILOTO-1)
//
// Medido en yaqu.app (SCRUM-1658, parte #13 a 390): dictar en «Dicta lo que has hecho», pulsar
// «Ordenar en líneas» y RECARGAR antes de «Añadir al parte» → el cuadro volvía VACÍO y la propuesta
// desaparecía, sin aviso. En una obra recargar es lo normal: el móvil se bloquea, entra una llamada.
//
// Cada test «recarga» de verdad: monta la vista OTRA VEZ, en un contexto nuevo, con el mismo
// `localStorage` del móvil. Lo único que pasa de una carga a la otra es lo que se guardó en él.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const RAIZ = path.resolve(import.meta.dirname, '..');
const FUENTE = fs.readFileSync(path.join(RAIZ, 'public', 'dashboard', 'js', 'parteDetailView.js'), 'utf8');

/** El `localStorage` del móvil: sobrevive a la recarga porque vive FUERA de la vista. */
function movil() {
  const datos = new Map();
  return {
    datos,
    getItem: (k) => (datos.has(k) ? datos.get(k) : null),
    setItem: (k, v) => { datos.set(k, String(v)); },
    removeItem: (k) => { datos.delete(k); },
  };
}

/** Una carga de la página: la vista recién evaluada, con el almacén del móvil. */
function cargar(almacen) {
  const ctx = { console, window: null, document: { createElement: () => ({ style: {} }) },
    Date, Array, Object, String, Number, JSON, isFinite, localStorage: almacen };
  ctx.window = ctx;
  vm.createContext(ctx);
  vm.runInContext(FUENTE, ctx, { filename: 'parteDetailView.js' });
  return ctx;
}

/** DOM mínimo (el de SCRUM-706): recuerda los oyentes y sólo «encuentra» lo que se pintó. */
function pantalla(filasDeLaPropuesta) {
  const oyentes = new Map();
  const nodos = new Map();
  const nodo = (marca) => ({
    marca, disabled: false, value: '', innerHTML: '',
    addEventListener(ev, fn) { oyentes.set(marca + ':' + ev, fn); },
    getAttribute: () => '',
    querySelector() { return null; },
    querySelectorAll(sel) {
      if (marca !== 'data-dictado-propuesta' || !filasDeLaPropuesta) return [];
      if (sel === '[data-propuesta="1"]') return filasDeLaPropuesta;
      return [];
    },
  });
  const contenedor = {
    innerHTML: '',
    querySelector(sel) {
      const m = /\[([a-z-]+)/.exec(sel);
      const marca = m ? m[1] : sel;
      // Lo pintado DENTRO de un hueco (la propuesta) también se encuentra, como en el DOM real.
      const pintado = this.innerHTML + [...nodos.values()].map((n) => n.innerHTML).join('');
      if (!pintado.includes(marca)) return null;
      if (!nodos.has(marca)) nodos.set(marca, nodo(marca));
      return nodos.get(marca);
    },
  };
  return { contenedor, oyentes, nodos };
}

const PARTE_ABIERTO = {
  id: 13, numero: 'PT-2026-005', estado: 'borrador', clienteNombre: 'Cliente QA',
  lineas: [], tecnicos: [], puedeEditarContenido: { ok: true, motivo: null },
};
const PARTE_FIRMADO = { ...PARTE_ABIERTO, puedeEditarContenido: { ok: false, motivo: 'firmado' } };
const DICTADO = 'He cambiado el grifo de la cocina y revisado la llave de paso';
const PROPUESTA = {
  propuesta: {
    vacia: false, motivo: null,
    mano_obra: [{ descripcion: 'Revisión de la llave de paso', unds: 1 }],
    materiales: [{ descripcion: 'Grifo monomando de cocina', unds: 1 }],
    sinBloque: [], cantidadesRetiradas: [],
  },
  avisos: {},
};

const servidor = (parte, pedidas = []) => async (ruta, init) => {
  pedidas.push({ ruta, init });
  if (ruta === '/admin/partes/13' && !(init && init.method)) return parte;
  if (ruta === '/admin/partes/13/dictado') return PROPUESTA;
  return parte;
};

test('SCRUM-1675 · 🔴 lo dictado SIGUE en el cuadro después de recargar', async () => {
  const almacen = movil();

  // Carga 1: el operario dicta (el teclado del móvil escribe y dispara `input`).
  const v1 = pantalla();
  await cargar(almacen).renderParteDetailView(v1.contenedor, 13, { apiRequest: servidor(PARTE_ABIERTO) });
  const campo = v1.contenedor.querySelector('[data-dictado-texto]');
  assert.ok(campo, '🔴 CIEGO: la pantalla no pintó el cuadro del dictado');
  const alEscribir = v1.oyentes.get('data-dictado-texto:input');
  assert.equal(typeof alEscribir, 'function',
    '🔴 nadie escucha el cuadro del dictado: lo que se dicta no se guarda en ningún sitio');
  campo.value = DICTADO;
  alEscribir();

  // Carga 2: la recarga. Contexto nuevo; sólo el almacén del móvil pasa de una a otra.
  const v2 = pantalla();
  await cargar(almacen).renderParteDetailView(v2.contenedor, 13, { apiRequest: servidor(PARTE_ABIERTO) });
  assert.ok(v2.contenedor.innerHTML.includes('>' + DICTADO + '</textarea>'),
    '🔴 TRAS RECARGAR EL CUADRO VUELVE VACÍO: el operario pierde lo que ha dictado sin aviso ' +
    '(SCRUM-1675, medido en yaqu.app sobre el parte #13).');
});

test('SCRUM-1675 · 🔴 la propuesta de «Ordenar en líneas» vuelve tras recargar, y «Añadir al parte» funciona', async () => {
  const almacen = movil();

  const v1 = pantalla();
  await cargar(almacen).renderParteDetailView(v1.contenedor, 13, { apiRequest: servidor(PARTE_ABIERTO) });
  v1.contenedor.querySelector('[data-dictado-texto]').value = DICTADO;
  v1.oyentes.get('data-dictado-texto:input')();
  await v1.oyentes.get('data-dictado-ordenar:click')();
  assert.ok(v1.nodos.get('data-dictado-propuesta').innerHTML.includes('Grifo monomando de cocina'),
    '🔴 CIEGO: la propuesta no se pintó en la primera carga; el test no mediría la recarga');

  // La recarga, con un servidor que NO vuelve a ordenar: lo que salga es lo guardado.
  const pedidas = [];
  const v2 = pantalla([{
    getAttribute: (k) => (k === 'data-bloque' ? 'materiales' : null),
    querySelector: (sel) => (sel.includes('unds') ? { value: '1' }
      : sel.includes('desc') ? { value: 'Grifo monomando de cocina' } : null),
  }]);
  await cargar(almacen).renderParteDetailView(v2.contenedor, 13, { apiRequest: servidor(PARTE_ABIERTO, pedidas) });

  const hueco = v2.contenedor.querySelector('[data-dictado-propuesta]');
  assert.ok(hueco && hueco.innerHTML.includes('Grifo monomando de cocina'),
    '🔴 TRAS RECARGAR LA PROPUESTA HA DESAPARECIDO: hay que volver a dictar y a esperar al modelo.');
  assert.ok(v2.contenedor.innerHTML.includes(DICTADO), '🔴 la propuesta vuelve pero el texto dictado no');
  assert.equal(pedidas.filter((p) => p.ruta.endsWith('/dictado')).length, 0,
    'la propuesta recuperada sale del móvil: no se vuelve a llamar al modelo');

  // 🔴 Y NO VUELVE MUERTA: su «Añadir al parte» tiene escucha y guarda.
  const anadir = v2.oyentes.get('data-propuesta-confirmar:click');
  assert.equal(typeof anadir, 'function',
    '🔴 LA PROPUESTA RECUPERADA ESTÁ PINTADA Y MUERTA: «Añadir al parte» no tiene escucha (SCRUM-706).');
  anadir();
  await new Promise((r) => setTimeout(r, 0));
  await new Promise((r) => setTimeout(r, 0));
  const patch = pedidas.find((p) => p.init && p.init.method === 'PATCH');
  assert.ok(patch, '🔴 pulsar «Añadir al parte» en la propuesta recuperada no guarda nada');
  assert.match(patch.init.body, /Grifo monomando de cocina/);

  // Ya está en el parte: lo guardado en el móvil se borra, o recuperarlo lo añadiría dos veces.
  assert.equal(almacen.datos.size, 0,
    '🔴 tras «Añadir al parte» lo dictado sigue en el móvil: la siguiente carga lo ofrecería otra vez');
});

test('SCRUM-1675 · un parte que ya no se puede tocar BORRA lo que quedaba dictado en el móvil', async () => {
  const almacen = movil();
  const v1 = pantalla();
  await cargar(almacen).renderParteDetailView(v1.contenedor, 13, { apiRequest: servidor(PARTE_ABIERTO) });
  v1.contenedor.querySelector('[data-dictado-texto]').value = DICTADO;
  v1.oyentes.get('data-dictado-texto:input')();
  assert.equal(almacen.datos.size, 1, '🔴 CIEGO: no se guardó nada, el borrado no se mediría');

  const v2 = pantalla();
  await cargar(almacen).renderParteDetailView(v2.contenedor, 13, { apiRequest: servidor(PARTE_FIRMADO) });
  assert.ok(!v2.contenedor.innerHTML.includes(DICTADO), 'un parte firmado no ofrece el dictado');
  assert.equal(almacen.datos.size, 0,
    '🔴 el parte ya está firmado y lo dictado (cliente, obra) se queda en el móvil para nada');
});

test('SCRUM-1675 · sin almacén (ventana privada, bloqueado) el parte se pinta igual y no lanza', async () => {
  const roto = { getItem() { throw new Error('SecurityError'); }, setItem() { throw new Error('QuotaExceeded'); },
    removeItem() { throw new Error('SecurityError'); } };
  const v = pantalla();
  await assert.doesNotReject(async () => {
    await cargar(roto).renderParteDetailView(v.contenedor, 13, { apiRequest: servidor(PARTE_ABIERTO) });
    v.contenedor.querySelector('[data-dictado-texto]').value = DICTADO;
    v.oyentes.get('data-dictado-texto:input')();
  }, '🔴 un móvil sin almacén tumba la pantalla del parte: guardar lo dictado es un extra');
  assert.ok(v.contenedor.innerHTML.includes('data-dictado-ordenar'), 'el dictado sigue ofreciéndose');
});

test('SCRUM-1675 · la clave del dictado está registrada para PURGARSE al cerrar sesión', () => {
  const registro = fs.readFileSync(path.join(RAIZ, 'public', 'dashboard', 'js', 'almacenLocal.js'), 'utf8');
  const fila = /patron:\s*\/\^yaqu_parte_dictado_\/,\s*almacen:\s*'localStorage',\s*purga:\s*(true|false)/.exec(registro);
  assert.ok(fila, '🔴 `yaqu_parte_dictado_` no está en CLAVES_LOCALES: el logout no sabe que existe');
  assert.equal(fila[1], 'true',
    '🔴 lo dictado en la obra (cliente, instalación) sobrevive al cierre de sesión en un móvil compartido');
});
