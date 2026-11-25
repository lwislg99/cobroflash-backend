// tests/scrum1824-dictado-sin-carrera.test.mjs — SCRUM-1824 (S4)
//
// ═══════════════════════════════════════════════════════════════════════════════════════════════
// «AÑADIR AL PARTE» VIAJANDO, Y EL TÉCNICO QUE SIGUE APUNTANDO: NO SE PIERDE NI UNA LÍNEA.
//
// Medido en navegador real el 24-nov-2026 (`docs/master/evidencias/SCRUM-1824/reproducir.mjs`, 390
// con el dedo y 1280 con el ratón): con el `PATCH` de lo dictado en el aire, completar una fila a mano
// o corregir una línea guardada BORRABA del servidor las líneas dictadas, 6 secuencias de 6. Cada
// `PATCH` de líneas manda la lista ENTERA; el del dictado no apuntaba lo guardado en `parte.lineas` y
// repintaba FUERA de su turno, así que el guardado que esperaba detrás armaba su lista sin ellas.
//
// La cura es la de SCRUM-916b: lo dictado se ASIENTA en su sitio, dentro del turno, sin repintar la
// ficha. Si la respuesta no cuadra con lo mandado, se repinta — pero también dentro del turno.
//
// 🔴 LO QUE ESTE BANCO NO VE: el reloj. Aquí el `PATCH` se retiene y se suelta a mano; que una red
// lenta de verdad (1200 ms) dé lo mismo lo mide `reproducir.mjs` (secuencia «① bis»).
//
// El servidor de mentira contesta al `PATCH` como el de verdad (`partes.routes.ts`): con el parte
// entero y un `id` por línea. Un caso lo hace contestar pobre (`{ ok: true }`) para el camino de la
// relectura.
// ═══════════════════════════════════════════════════════════════════════════════════════════════
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { nodo, almacenDeTeclas } from './_banco-vistas.mjs';

const RAIZ = path.resolve(import.meta.dirname, '..');
const VISTA = path.join(RAIZ, 'public', 'dashboard', 'js', 'parteDetailView.js');

// Nombres de mentira; el parte es el del técnico (sin dinero).
const PARTE = Object.freeze({
  id: 7, numero: 'PT-2026-1824', clienteNombre: 'Comunidad Los Olivos',
  fecha: '2026-11-19T08:00:00.000Z', obra: 'Sala de calderas', referencia: null,
  entrada: '09:00', salida: null, desplazamientos: null, kilometros: null,
  tecnicos: [], tipo: 'averia', notas: null, estado: 'borrador',
  lineas: [
    { id: 'a1', bloque: 'mano_obra', unds: 2, descripcion: 'Sustitución de la bomba' },
    { id: 'b1', bloque: 'materiales', unds: 1, descripcion: 'Bomba 25-60' },
  ],
  firmoElCliente: false, firmoElTecnico: false, firmasCompletas: false,
  puedeEditarContenido: { ok: true, motivo: null }, puedeEditarPrecios: { ok: true, motivo: null },
});
const PROPUESTA = Object.freeze({
  propuesta: {
    vacia: false, sinBloque: [], datosRetirados: [],
    mano_obra: [{ unds: 1, descripcion: 'Purgado del circuito' }],
    materiales: [{ unds: 2, descripcion: 'Racores de tres cuartos' }],
  },
  avisos: {},
});
const DICTADO = 'He purgado el circuito y he puesto dos racores de tres cuartos';
const INICIALES = ['mano_obra: 2 · Sustitución de la bomba', 'materiales: 1 · Bomba 25-60'];
const DICTADAS = ['mano_obra: 1 · Purgado del circuito', 'materiales: 2 · Racores de tres cuartos'];
const MANUAL = 'mano_obra: 3 · Limpieza de filtros';
const CLAVE_DEL_MOVIL = 'yaqu_parte_dictado_7';
const copia = (x) => JSON.parse(JSON.stringify(x));
// A3: se comparan CONJUNTOS, no cuentas. El orden del servidor es el de llegada y no es lo que se mide.
const conjunto = (lista) => [...lista].sort();

function montar(almacen) {
  const reg = { porId: new Map(), selectoresNoSoportados: [] };
  const ctx = {
    console, window: null, Date, Array, Object, String, Number, JSON, Promise, Error, isFinite,
    document: { createElement: (t) => nodo(t, reg) }, localStorage: almacen,
  };
  ctx.window = ctx;
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(VISTA, 'utf8'), ctx, { filename: 'parteDetailView.js' });
  return { ctx, cont: nodo('div', reg), reg };
}

/** Un servidor de mentira con UN parte. `retener` deja cada `PATCH` en el aire hasta `soltar()`. */
function servidor(lineas) {
  const s = { parte: copia(PARTE), pedidas: [], falla: false, pobre: false, retener: false, enElAire: [], siguiente: 100 };
  if (lineas) s.parte.lineas = copia(lineas);
  s.apiRequest = async (ruta, opciones = {}) => {
    const metodo = opciones.method || 'GET';
    const cuerpo = opciones.body ? JSON.parse(opciones.body) : null;
    s.pedidas.push({ metodo, ruta, cuerpo });
    if (ruta === '/admin/partes/7/dictado' && metodo === 'POST') return copia(PROPUESTA);
    if (ruta !== '/admin/partes/7') throw new Error('ruta inesperada ' + ruta);
    if (metodo === 'GET') return copia(s.parte);
    if (metodo !== 'PATCH') throw new Error('método inesperado ' + metodo);
    if (s.retener) await new Promise((seguir) => s.enElAire.push(seguir));
    if (s.falla) throw new Error('sin red');
    if (cuerpo.lineas) s.parte.lineas = cuerpo.lineas.map((l) => ({ ...l, id: l.id || 'n' + s.siguiente++ }));
    return s.pobre ? { ok: true } : copia(s.parte);
  };
  s.soltar = () => { for (const seguir of s.enElAire.splice(0)) seguir(); };
  s.patch = () => s.pedidas.filter((p) => p.metodo === 'PATCH');
  s.gets = () => s.pedidas.filter((p) => p.metodo === 'GET').length;
  s.deLaBase = () => s.parte.lineas.map((l) => `${l.bloque}: ${l.unds} · ${l.descripcion}`);
  return s;
}

const vaciar = async () => { for (let i = 0; i < 12; i++) await new Promise((r) => setImmediate(r)); };

async function abrir(lineas) {
  const almacen = almacenDeTeclas();
  const { ctx, cont } = montar(almacen);
  const srv = servidor(lineas);
  const ok = await ctx.renderParteDetailView(cont, 7, { apiRequest: srv.apiRequest });
  assert.equal(ok, true, '🔴 NO PUDE MIRAR: la vista no pintó el parte');
  return { ctx, cont, srv, almacen };
}

// 🔴 LÍMITE DEL BANCO (medido en SCRUM-916b): su `removeAttribute('data-x')` no borra la entrada de
// `dataset`, y sus selectores `[data-x]` leen `dataset`. «¿Sigue por escribir?» se pregunta con
// `hasAttribute`, nodo a nodo.
const conAtributo = (cont, atributo) => cont.querySelectorAll('[' + atributo + ']').filter((n) => n.hasAttribute(atributo));
const porEscribir = (cont) => conAtributo(cont, 'data-parte-linea-nueva');
const campos = (fila) => ({ unds: fila.querySelector('.parte-linea-unds'), desc: fila.querySelector('.parte-linea-desc') });
const valor = (campo) => (typeof campo.value === 'string' && campo.value !== '' ? campo.value : (campo.getAttribute('value') || campo.value || ''));
const loQueSeVe = (fila) => { const c = campos(fila); return `${valor(c.unds)} · ${valor(c.desc)}`; };
const filasGuardadas = (cont, bloque) =>
  cont.querySelector(`[data-parte-filas="${bloque}"]`).querySelectorAll('[data-parte-linea]').filter((f) => f.hasAttribute('data-parte-linea'));
const guardadasEnPantalla = (cont, bloque) => filasGuardadas(cont, bloque).map(loQueSeVe);
const propuestaEnPantalla = (cont) => cont.querySelectorAll('[data-propuesta="1"]').length;
const cuadroDelDictado = (cont) => cont.querySelector('[data-dictado-texto]');

/** Lo que hace salir de un campo: el valor queda y salta `change`. SIN esperar. */
const dejarEscrito = (campo, texto) => { campo.value = texto; campo.disparar('change'); };

/** Dicta, pulsa «Ordenar en líneas» y deja la propuesta en pantalla. */
async function dictarYOrdenar(cont) {
  const cuadro = cuadroDelDictado(cont);
  assert.ok(cuadro, '🔴 NO PUDE MIRAR: no hay cuadro del dictado');
  cuadro.value = DICTADO;
  cuadro.disparar('input');
  const escuchas = cont.querySelector('[data-dictado-ordenar]').dispararClick();
  await vaciar();
  assert.ok(escuchas > 0, '🔴 NO PUDE MIRAR: «Ordenar» no tiene escuchador');
  assert.equal(propuestaEnPantalla(cont), 2, '🔴 NO PUDE MIRAR: la propuesta no está en pantalla');
}
/** Pulsa «Añadir al parte». SIN esperar: quien llama decide si viaja o llega. */
function anadirAlParte(cont) {
  const boton = cont.querySelector('[data-propuesta-confirmar]');
  assert.ok(boton, '🔴 NO PUDE MIRAR: no hay botón de añadir lo dictado');
  assert.ok(boton.dispararClick() > 0, '🔴 NO PUDE MIRAR: «Añadir al parte» no tiene escuchador');
}
/** Lo dictado, VIAJANDO: su `PATCH` está fuera y retenido. Los siguientes ya no se retienen. */
async function dictadoViajando(cont, srv) {
  await dictarYOrdenar(cont);
  srv.retener = true;
  anadirAlParte(cont);
  await vaciar();
  srv.retener = false;
  assert.equal(srv.enElAire.length, 1, '🔴 NO PUDE MIRAR: el PATCH de lo dictado no está en el aire');
}
/** «Añadir línea» en mano de obra, con cantidad y descripción, y fuera de la casilla. SIN esperar al guardado. */
async function filaAMano(cont) {
  const antes = porEscribir(cont);
  cont.querySelectorAll('.parte-anadir').find((x) => x.getAttribute('data-bloque') === 'mano_obra').dispararClick();
  await vaciar();
  const nuevas = porEscribir(cont).filter((f) => !antes.includes(f));
  assert.equal(nuevas.length, 1, '🔴 NO PUDE MIRAR: «Añadir línea» no ha abierto UNA fila');
  dejarEscrito(campos(nuevas[0]).unds, '3');
  dejarEscrito(campos(nuevas[0]).desc, 'Limpieza de filtros');
  await vaciar();
  return nuevas[0];
}

// ═══ CONTROL: sin carrera, el banco ve las cinco ═══════════════════════════════════════════════

test('SCRUM-1824 · control: primero la fila a mano y DESPUÉS lo dictado → las cinco, en el servidor y en pantalla', async () => {
  const { cont, srv } = await abrir();
  await filaAMano(cont);
  await dictarYOrdenar(cont);
  anadirAlParte(cont);
  await vaciar();
  assert.deepEqual(conjunto(srv.deLaBase()), conjunto([...INICIALES, ...DICTADAS, MANUAL]));
  assert.deepEqual(guardadasEnPantalla(cont, 'mano_obra'), ['2 · Sustitución de la bomba', '3 · Limpieza de filtros', '1 · Purgado del circuito']);
  assert.deepEqual(guardadasEnPantalla(cont, 'materiales'), ['1 · Bomba 25-60', '2 · Racores de tres cuartos']);
});

// ═══ ① LA CARRERA, POR CADA GUARDADO QUE PUEDE ESPERAR DETRÁS ══════════════════════════════════

test('SCRUM-1824 · 🔴 una fila a mano completada MIENTRAS VIAJA lo dictado no borra lo dictado', async () => {
  const { cont, srv } = await abrir();
  await dictadoViajando(cont, srv);
  await filaAMano(cont);
  srv.soltar();
  await vaciar();

  assert.deepEqual(conjunto(srv.deLaBase()), conjunto([...INICIALES, ...DICTADAS, MANUAL]),
    '🔴 EN EL SERVIDOR NO ESTÁ TODO: el guardado de la fila a mano ha mandado la lista sin las dictadas');
  assert.deepEqual(guardadasEnPantalla(cont, 'mano_obra'), ['2 · Sustitución de la bomba', '1 · Purgado del circuito', '3 · Limpieza de filtros'],
    '🔴 la pantalla no enseña lo guardado en mano de obra');
  assert.deepEqual(guardadasEnPantalla(cont, 'materiales'), ['1 · Bomba 25-60', '2 · Racores de tres cuartos']);
  assert.equal(porEscribir(cont).length, 0, '🔴 la fila a mano estaba completa y sigue por escribir');
});

test('SCRUM-1824 · 🔴 corregir la cantidad de una línea guardada MIENTRAS VIAJA lo dictado: quedan las dos cosas', async () => {
  const { cont, srv } = await abrir();
  await dictadoViajando(cont, srv);
  const cantidad = cont.querySelector('[data-linea-unds="0"]');
  dejarEscrito(cantidad, '4');
  await vaciar();
  srv.soltar();
  await vaciar();

  assert.deepEqual(conjunto(srv.deLaBase()), conjunto(['mano_obra: 4 · Sustitución de la bomba', INICIALES[1], ...DICTADAS]),
    '🔴 la corrección se ha guardado LLEVÁNDOSE lo dictado (o al revés)');
  assert.equal(valor(cont.querySelector('[data-linea-unds="0"]')), '4', '🔴 la pantalla ha vuelto a la cantidad vieja: enseña lo que el servidor no tiene');
  assert.equal(cont.querySelector('[data-linea-unds="0"]'), cantidad, '🔴 la casilla que el técnico estaba corrigiendo se ha repintado');
  assert.deepEqual(guardadasEnPantalla(cont, 'materiales'), ['1 · Bomba 25-60', '2 · Racores de tres cuartos']);
});

test('SCRUM-1824 · 🔴 quitar una línea guardada con su «×» MIENTRAS VIAJA lo dictado no se lleva lo dictado', async () => {
  const { cont, srv } = await abrir();
  await dictadoViajando(cont, srv);
  const equis = cont.querySelectorAll('.parte-quitar-linea').find((x) => x.getAttribute('data-indice') === '1');
  assert.ok(equis && equis.dispararClick() > 0, '🔴 NO PUDE MIRAR: la «×» de la segunda línea no escucha');
  await vaciar();
  srv.soltar();
  await vaciar();

  assert.deepEqual(conjunto(srv.deLaBase()), conjunto([INICIALES[0], ...DICTADAS]),
    '🔴 la «×» ha mandado la lista vieja sin la quitada: lo dictado no está en el servidor');
  assert.deepEqual(guardadasEnPantalla(cont, 'materiales'), ['2 · Racores de tres cuartos']);
});

test('SCRUM-1824 · 🔴 con el servidor contestando POBRE se relee… dentro del turno: la fila que esperaba no borra lo dictado', async () => {
  const { cont, srv } = await abrir();
  srv.pobre = true;
  await dictadoViajando(cont, srv);
  await filaAMano(cont);
  srv.soltar();
  await vaciar();

  assert.deepEqual(conjunto(srv.deLaBase()), conjunto([...INICIALES, ...DICTADAS, MANUAL]),
    '🔴 por el camino de la relectura lo dictado se pierde igual');
  assert.equal(porEscribir(cont).length, 0, '🔴 la fila a mano estaba completa y sigue por escribir');
  assert.equal(propuestaEnPantalla(cont), 0, 'la propuesta ya está en el parte');
});

// ═══ ② LO DICTADO SE ASIENTA EN SU SITIO ═══════════════════════════════════════════════════════

test('SCRUM-1824 · 🔴 lo dictado se ASIENTA sin repintar la ficha: mismos nodos, ni una relectura, y el dictado queda limpio', async () => {
  const { cont, srv, almacen } = await abrir();
  const deAntes = filasGuardadas(cont, 'mano_obra').concat(filasGuardadas(cont, 'materiales'));
  const firmas = cont.querySelector('[data-parte-firmas]');
  await dictarYOrdenar(cont);
  assert.ok(almacen.getItem(CLAVE_DEL_MOVIL), '🔴 NO PUDE MIRAR: lo dictado no se ha guardado en el móvil');
  const relecturas = srv.gets();
  anadirAlParte(cont);
  await vaciar();

  assert.deepEqual(conjunto(srv.deLaBase()), conjunto([...INICIALES, ...DICTADAS]), 'control: se guardó');
  assert.equal(srv.gets(), relecturas, '🔴 se ha releído el parte: la ficha se ha repintado entera');
  assert.equal(filasGuardadas(cont, 'mano_obra')[0], deAntes[0], '🔴 la primera línea de mano de obra es otro nodo');
  assert.equal(filasGuardadas(cont, 'materiales')[0], deAntes[1], '🔴 la primera línea de materiales es otro nodo');
  assert.equal(cont.querySelector('[data-parte-firmas]'), firmas, '🔴 el paso de las firmas se ha repintado');
  assert.deepEqual(guardadasEnPantalla(cont, 'mano_obra'), ['2 · Sustitución de la bomba', '1 · Purgado del circuito']);
  assert.deepEqual(guardadasEnPantalla(cont, 'materiales'), ['1 · Bomba 25-60', '2 · Racores de tres cuartos']);
  // Lo que el repintado dejaba limpio, sigue quedando limpio.
  assert.equal(propuestaEnPantalla(cont), 0, '🔴 la propuesta sigue en pantalla: añadirla otra vez la duplicaría');
  assert.equal(cont.querySelectorAll('[data-propuesta-confirmar]').length, 0, '🔴 el botón de añadir sigue ahí');
  assert.equal(cuadroDelDictado(cont).value, '', '🔴 el cuadro del dictado sigue con el texto ya añadido');
  assert.equal(almacen.getItem(CLAVE_DEL_MOVIL), null, '🔴 lo dictado sigue en el móvil: la siguiente carga lo ofrecería otra vez');

  // Y lo asentado es lo que pintaría una carga nueva.
  const otra = montar(almacenDeTeclas());
  await otra.ctx.renderParteDetailView(otra.cont, 7, { apiRequest: srv.apiRequest });
  for (const bloque of ['mano_obra', 'materiales']) {
    assert.deepEqual(guardadasEnPantalla(cont, bloque), guardadasEnPantalla(otra.cont, bloque), `🔴 ${bloque}: lo asentado no es lo que pinta una carga nueva`);
  }
});

// (Sin 🔴: en verde también antes de la cura, porque el repintado cableaba la línea. Guarda el cable de la asentada.)
test('SCRUM-1824 · la línea dictada, ya asentada, es una línea guardada más: se corrige y se quita', async () => {
  const { cont, srv } = await abrir();
  await dictarYOrdenar(cont);
  anadirAlParte(cont);
  await vaciar();
  const fila = filasGuardadas(cont, 'mano_obra')[1];
  assert.ok(fila, '🔴 NO PUDE MIRAR: la línea dictada no está en mano de obra');

  dejarEscrito(campos(fila).unds, '5');
  await vaciar();
  assert.ok(srv.deLaBase().includes('mano_obra: 5 · Purgado del circuito'), '🔴 corregir la cantidad de la línea asentada no guarda nada: sus casillas no escuchan');
  assert.equal(srv.deLaBase().length, 4, 'la corrección no añade ni quita líneas');

  const equis = fila.querySelector('.parte-quitar-linea');
  assert.ok(equis && equis.dispararClick() > 0, '🔴 la «×» de la línea asentada no escucha');
  await vaciar();
  assert.deepEqual(conjunto(srv.deLaBase()), conjunto([...INICIALES, DICTADAS[1]]), '🔴 la «×» de la línea asentada no la quita del servidor (o quita otra)');
});

test('SCRUM-1824 · 🔴 en un parte VACÍO, lo dictado pone al día el paso de las firmas sin repintarlo', async () => {
  const { cont, srv } = await abrir([]);
  const firmar = cont.querySelector('[data-parte-firmar]');
  assert.ok(firmar && firmar.hasAttribute('data-parte-firma-en-espera'), '🔴 NO PUDE MIRAR: el parte vacío no pinta la firma en espera');
  await dictarYOrdenar(cont);
  anadirAlParte(cont);
  await vaciar();

  assert.equal(srv.deLaBase().length, 2, 'control: se guardó');
  assert.equal(cont.querySelector('[data-parte-firmar]'), firmar, '🔴 el paso de las firmas se ha repintado');
  assert.equal(conAtributo(cont, 'data-parte-firma-en-espera').length, 0, '🔴 con líneas guardadas la firma sigue «en espera»');
  assert.equal(cont.querySelectorAll('[data-parte-apunta-primero]').length, 0, '🔴 sigue diciendo «apunta primero» con líneas apuntadas');
  assert.equal(cont.querySelectorAll('[data-parte-sin-lineas]').length, 0, '🔴 el hueco de «sin líneas» sigue junto a las líneas');
});

test('SCRUM-1824 · 🔴 lo que el técnico empieza a dictar MIENTRAS VIAJA lo anterior no se borra', async () => {
  const { cont, srv, almacen } = await abrir();
  await dictadoViajando(cont, srv);
  const cuadro = cuadroDelDictado(cont);
  cuadro.value = 'Y además he cambiado el manómetro';
  cuadro.disparar('input');
  srv.soltar();
  await vaciar();

  assert.deepEqual(conjunto(srv.deLaBase()), conjunto([...INICIALES, ...DICTADAS]), 'control: se guardó');
  assert.equal(cuadroDelDictado(cont).value, 'Y además he cambiado el manómetro', '🔴 se ha borrado lo que estaba dictando');
  const guardado = JSON.parse(almacen.getItem(CLAVE_DEL_MOVIL) || 'null');
  assert.ok(guardado && guardado.texto === 'Y además he cambiado el manómetro', '🔴 lo que estaba dictando no queda en el móvil: una recarga se lo lleva');
  assert.ok(!guardado.respuesta, '🔴 la propuesta YA AÑADIDA sigue en el móvil: la siguiente carga la ofrecería otra vez');
  assert.equal(propuestaEnPantalla(cont), 0, 'la propuesta ya está en el parte');
});

// ═══ ③ LO QUE LA CURA NO PUEDE ROMPER ══════════════════════════════════════════════════════════

test('SCRUM-1824 · dos toques seguidos a «Añadir al parte» (no pasa nada a la vista y se repite): lo dictado entra UNA vez', async () => {
  const { cont, srv } = await abrir();
  await dictadoViajando(cont, srv);
  anadirAlParte(cont);   // el segundo toque, con el primero en el aire
  await vaciar();
  srv.soltar();
  await vaciar();

  assert.deepEqual(conjunto(srv.deLaBase()), conjunto([...INICIALES, ...DICTADAS]), '🔴 lo dictado ha entrado dos veces (o ninguna)');
  assert.equal(srv.patch().length, 1, '🔴 el segundo toque ha mandado otro PATCH con la misma propuesta');
});

test('SCRUM-1824 · si NO se guarda, la propuesta se queda, se dice, y el segundo toque SÍ manda', async () => {
  const { cont, srv, almacen } = await abrir();
  await dictarYOrdenar(cont);
  srv.falla = true;
  anadirAlParte(cont);
  await vaciar();
  assert.deepEqual(srv.deLaBase(), INICIALES, 'control: no se guardó');
  assert.equal(propuestaEnPantalla(cont), 2, '🔴 un fallo se ha llevado la propuesta');
  assert.equal(cont.querySelectorAll('[data-dictado-no-guardado]').length, 1, '🔴 el fallo no se dice');
  assert.ok(almacen.getItem(CLAVE_DEL_MOVIL), '🔴 un fallo ha borrado lo dictado del móvil');

  srv.falla = false;
  anadirAlParte(cont);
  await vaciar();
  assert.deepEqual(conjunto(srv.deLaBase()), conjunto([...INICIALES, ...DICTADAS]), '🔴 tras un fallo, el botón se queda sin mandar nada');
  assert.equal(cont.querySelectorAll('[data-dictado-no-guardado]').length, 0, '🔴 ya está guardado y sigue diciendo que no');
});
