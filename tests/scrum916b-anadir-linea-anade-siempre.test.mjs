// tests/scrum916b-anadir-linea-anade-siempre.test.mjs — SCRUM-916b (S4)
//
// ═══════════════════════════════════════════════════════════════════════════════════════════════
// «+ AÑADIR LÍNEA» DEL PARTE AÑADE SIEMPRE, Y LO ESCRITO NO SE PIERDE.
//
// Orden del fundador (dos veces, literal): «esto de añadir lineas sigue roto cogelo como lo tenemos
// en presupuesto». Medido en navegador real, 4 de 4 combinaciones (390 con el dedo y 1280 con el
// ratón, servidor a 0 y a 150 ms; `docs/master/evidencias/SCRUM-916/b-anadir-linea/reproducir.mjs`):
// con una fila escrita, pulsar «Añadir línea» GUARDABA y REPINTABA la ficha entera, así que no abría
// fila nueva, el foco no quedaba en ningún sitio y lo tecleado después se perdía. Y una fila a medias
// bloqueaba los dos botones.
//
// El patrón que se espeja es el del editor de presupuestos: cada pulsación añade una fila y nada se
// repinta. Aquí además se GUARDA (el parte guarda por línea al salir del campo; eso no cambia), pero
// la fila se ASIENTA en su sitio: los nodos de las demás filas son los mismos antes y después.
//
// 🔴 LO QUE ESTE BANCO NO VE: EL FOCO. `focus()` es un no-op en `_banco-vistas.mjs`, así que «el foco
// queda en la UNDS de la fila nueva» se exige en navegador real, en `reproducir.mjs` (función
// `exigir`). Aquí se exige todo lo demás: qué filas hay, qué se escribe en el servidor y qué nodos
// sobreviven.
//
// El servidor de mentira contesta al `PATCH` como el de verdad (`partes.routes.ts`): con el parte
// entero y un `id` por línea. Un caso lo hace contestar pobre (`{ ok: true }`) para andar el camino
// de la relectura.
// ═══════════════════════════════════════════════════════════════════════════════════════════════
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { nodo } from './_banco-vistas.mjs';

const RAIZ = path.resolve(import.meta.dirname, '..');
const VISTA = path.join(RAIZ, 'public', 'dashboard', 'js', 'parteDetailView.js');

// Nombres de mentira; el parte es el del técnico (sin dinero).
const PARTE = Object.freeze({
  id: 7, numero: 'PT-2026-916', clienteNombre: 'Comunidad Los Olivos',
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
const copia = (x) => JSON.parse(JSON.stringify(x));

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

/**
 * Un servidor de mentira con UN parte. `falla`, `pobre` y `retener` se cambian en caliente:
 *   · `retener` deja cada `PATCH` en el aire hasta `soltar()` (el guardado «viajando»);
 *   · `falla` se mira AL SOLTAR, así un caso decide el desenlace con la petición ya en vuelo.
 */
function servidor(lineas) {
  const s = { parte: copia(PARTE), pedidas: [], falla: false, pobre: false, retener: false, enElAire: [], siguiente: 100 };
  if (lineas) s.parte.lineas = copia(lineas);
  s.apiRequest = async (ruta, opciones = {}) => {
    const metodo = opciones.method || 'GET';
    const cuerpo = opciones.body ? JSON.parse(opciones.body) : null;
    s.pedidas.push({ metodo, ruta, cuerpo });
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
  const { ctx, cont } = montar();
  const srv = servidor(lineas);
  const ok = await ctx.renderParteDetailView(cont, 7, { apiRequest: srv.apiRequest });
  assert.equal(ok, true, '🔴 NO PUDE MIRAR: la vista no pintó el parte');
  return { ctx, cont, srv };
}

const botonAnadir = (cont, bloque) => {
  const b = cont.querySelectorAll('.parte-anadir').find((x) => x.getAttribute('data-bloque') === bloque);
  assert.ok(b, `🔴 NO PUDE MIRAR: no hay botón «Añadir línea» en ${bloque}`);
  return b;
};
// 🔴 LÍMITE DEL BANCO, MEDIDO AL ESCRIBIR ESTO: su `removeAttribute('data-x')` borra el atributo pero NO
// la entrada de `dataset`, y sus selectores `[data-x]` leen `dataset`. Así que un nodo al que la vista
// le QUITA un `data-*` sigue casando con `[data-x]` (en el navegador no: lo mide `reproducir.mjs`).
// `hasAttribute` sí dice la verdad, y por eso aquí «¿sigue por escribir?» y «¿sigue en espera?» se
// preguntan con `hasAttribute`, nodo a nodo, y no contando lo que devuelve el selector.
const conAtributo = (cont, atributo) => cont.querySelectorAll('[' + atributo + ']').filter((n) => n.hasAttribute(atributo));
const porEscribir = (cont) => conAtributo(cont, 'data-parte-linea-nueva');
const campos = (fila) => ({ unds: fila.querySelector('.parte-linea-unds'), desc: fila.querySelector('.parte-linea-desc') });
// Una fila pintada desde el servidor lleva la cantidad en el ATRIBUTO (el banco no la copia a la
// propiedad); una asentada en su sitio, en la propiedad. Se lee la que haya.
const valor = (campo) => (typeof campo.value === 'string' && campo.value !== '' ? campo.value : (campo.getAttribute('value') || campo.value || ''));
const loQueSeVe = (fila) => { const c = campos(fila); return `${valor(c.unds)} · ${valor(c.desc)}`; };
const guardadasEnPantalla = (cont, bloque) =>
  cont.querySelector(`[data-parte-filas="${bloque}"]`).querySelectorAll('[data-parte-linea]').map(loQueSeVe);

/** Pulsa «Añadir línea» y devuelve la fila que ha aparecido (la que antes no estaba). */
async function pulsar(cont, bloque) {
  const antes = porEscribir(cont);
  const escuchas = botonAnadir(cont, bloque).dispararClick();
  await vaciar();
  assert.ok(escuchas > 0, '🔴 NO PUDE MIRAR: «Añadir línea» no tiene escuchador');
  const nuevas = porEscribir(cont).filter((f) => !antes.includes(f));
  assert.equal(nuevas.length, 1, `🔴 pulsar «Añadir línea» (${bloque}) no ha abierto UNA fila nueva: ha abierto ${nuevas.length}`);
  return nuevas[0];
}
/** Lo que hace salir de un campo: el valor queda y salta `change`. SIN esperar. */
const dejarEscrito = (campo, texto) => { campo.value = texto; campo.disparar('change'); };
async function escribir(campo, texto) { dejarEscrito(campo, texto); await vaciar(); }

// ═══ ① LA SECUENCIA DEL FUNDADOR ══════════════════════════════════════════════════════════════

test('SCRUM-916b · 🔴 con la fila escrita, UN clic en «Añadir línea» la guarda Y abre otra vacía', async () => {
  const { cont, srv } = await abrir();
  const fila = await pulsar(cont, 'mano_obra');
  await escribir(campos(fila).unds, '3');
  // El cursor está en la descripción: el clic la hace perder el foco (`change`) y, acto seguido, pulsa.
  dejarEscrito(campos(fila).desc, 'Purgado del circuito');
  botonAnadir(cont, 'mano_obra').dispararClick();
  await vaciar();

  assert.deepEqual(srv.deLaBase(), [
    'mano_obra: 2 · Sustitución de la bomba', 'materiales: 1 · Bomba 25-60', 'mano_obra: 3 · Purgado del circuito',
  ], '🔴 lo escrito no ha llegado al servidor, o ha llegado otra cosa');
  assert.equal(srv.patch().length, 1, 'una línea escrita es UNA escritura');
  assert.deepEqual(guardadasEnPantalla(cont, 'mano_obra'), ['2 · Sustitución de la bomba', '3 · Purgado del circuito'],
    '🔴 la línea escrita no se ve como guardada');
  const nuevas = porEscribir(cont);
  assert.equal(nuevas.length, 1,
    `🔴 EL DEFECTO: con la fila escrita, pulsar «Añadir línea» no deja una fila nueva en la que seguir (hay ${nuevas.length}). ` +
    'El fundador tenía que pulsar dos veces.');
  assert.equal(loQueSeVe(nuevas[0]), ' · ', 'la fila nueva nace vacía');
  assert.equal(nuevas[0].parentNode.getAttribute('data-parte-filas'), 'mano_obra', 'y en SU bloque');
});

test('SCRUM-916b · 🔴 guardar una línea NO repinta la ficha: las demás filas y el botón son los MISMOS nodos', async () => {
  const { cont, srv } = await abrir();
  const filaVieja = cont.querySelector('[data-parte-linea="0"]');
  const boton = botonAnadir(cont, 'mano_obra');
  assert.ok(filaVieja, '🔴 NO PUDE MIRAR: no encuentro la línea guardada 0');
  const fila = await pulsar(cont, 'mano_obra');
  await escribir(campos(fila).unds, '3');
  await escribir(campos(fila).desc, 'Purgado del circuito');

  assert.equal(srv.patch().length, 1, 'control: se guardó');
  assert.equal(cont.querySelector('[data-parte-linea="0"]'), filaVieja,
    '🔴 la ficha se ha repintado entera al guardar una línea: a 1280 px ese repintado le quitaba el botón al ratón entre bajar y subir');
  assert.equal(botonAnadir(cont, 'mano_obra'), boton, '🔴 el botón «Añadir línea» ya no es el mismo nodo');
  assert.equal(srv.gets(), 1, '🔴 el PATCH ya trae las líneas: releer el parte entero sobra (y es lo que repintaba)');
  // La fila escrita es AHORA la línea guardada: mismo nodo, con el índice que tiene en el servidor.
  assert.equal(fila.getAttribute('data-parte-linea'), '2', '🔴 la fila escrita no se ha asentado como la línea 2');
  assert.equal(fila.hasAttribute('data-parte-linea-nueva'), false);
  const marcasDeNueva = ['data-nueva-unds', 'data-nueva-desc', 'data-quitar-nueva', 'data-nueva-guardando', 'data-nueva-del-parte']
    .filter((a) => conAtributo(cont, a).length > 0);
  assert.deepEqual(marcasDeNueva, [], '🔴 la fila asentada conserva marcas de fila sin guardar');
});

// ═══ ② EL PATRÓN DE PRESUPUESTOS: cada clic añade, y nada bloquea ═══════════════════════════

test('SCRUM-916b · 🔴 dos clics son dos filas vacías, y una fila a medias no bloquea NINGÚN botón (cero escrituras)', async () => {
  const { cont, srv } = await abrir();
  const una = await pulsar(cont, 'mano_obra');
  const otra = await pulsar(cont, 'mano_obra');
  assert.notEqual(una, otra);
  assert.equal(porEscribir(cont).length, 2, '🔴 el segundo clic no ha añadido otra fila');

  await escribir(campos(una).unds, '4');           // a medias: sólo la cantidad
  const enMateriales = await pulsar(cont, 'materiales');
  assert.equal(enMateriales.parentNode.getAttribute('data-parte-filas'), 'materiales',
    '🔴 con una fila a medias en mano de obra, el botón de MATERIALES no abre fila en materiales');
  await pulsar(cont, 'mano_obra');
  assert.equal(porEscribir(cont).length, 4);
  assert.equal(campos(una).unds.value, '4', '🔴 la cantidad a medias se ha perdido');
  assert.equal(srv.patch().length, 0, '🔴 añadir filas no escribe nada: vacías o a medias no hay qué guardar');
});

test('SCRUM-916b · 🔴 lo que hay A MEDIAS en otra fila sigue ahí cuando una se guarda', async () => {
  const { cont, srv } = await abrir();
  const aMedias = await pulsar(cont, 'mano_obra');
  await escribir(campos(aMedias).unds, '4');
  const entera = await pulsar(cont, 'materiales');
  await escribir(campos(entera).unds, '6');
  await escribir(campos(entera).desc, 'Racores de 1"');

  assert.equal(srv.patch().length, 1, 'control: la entera se guardó');
  assert.deepEqual(guardadasEnPantalla(cont, 'materiales'), ['1 · Bomba 25-60', '6 · Racores de 1"']);
  assert.deepEqual(porEscribir(cont), [aMedias], '🔴 la fila a medias ha desaparecido (o ya no es el mismo nodo) al guardarse la otra');
  assert.equal(campos(aMedias).unds.value, '4', '🔴 lo tecleado a medias se ha perdido');
});

// ═══ ③ NADA SE PIERDE MIENTRAS EL GUARDADO VIAJA ════════════════════════════════════════════

test('SCRUM-916b · 🔴 lo que se teclea MIENTRAS viaja el guardado no se pisa, y se guarda al salir del campo', async () => {
  const { cont, srv } = await abrir();
  const fila = await pulsar(cont, 'mano_obra');
  const c = campos(fila);
  await escribir(c.desc, 'Purg');
  srv.retener = true;
  await escribir(c.unds, '3');                      // completa: sale el PATCH y se queda en el aire
  assert.equal(srv.enElAire.length, 1, '🔴 NO PUDE MIRAR: el guardado no está viajando');
  c.desc.value = 'Purgado del circuito';            // el técnico sigue escribiendo (aún sin `change`)
  srv.retener = false;
  srv.soltar();
  await vaciar();

  assert.equal(c.desc.value, 'Purgado del circuito',
    '🔴 la respuesta del servidor ha pisado lo que el técnico estaba escribiendo');
  assert.equal(fila.getAttribute('data-parte-linea'), '2', 'control: la fila se asentó');
  c.desc.disparar('change');                        // sale del campo
  await vaciar();
  assert.equal(srv.deLaBase()[2], 'mano_obra: 3 · Purgado del circuito',
    '🔴 lo tecleado durante el viaje no llega nunca al servidor: la fila asentada no guarda al salir del campo');
  assert.equal(srv.patch()[1].cuerpo.lineas[2].id, 'n100', 'y viaja con SU id: es la misma línea, no otra');
});

// ═══ ④ LA FILA ASENTADA ES UNA LÍNEA GUARDADA DE VERDAD ═════════════════════════════════════

test('SCRUM-916b · la fila asentada se corrige y se quita como cualquier línea guardada (y si el PATCH no trae las líneas, se releen)', async () => {
  const { cont, srv } = await abrir();
  srv.pobre = true;                                 // el camino de la relectura: `{ ok: true }` y un GET
  const fila = await pulsar(cont, 'mano_obra');
  await escribir(campos(fila).unds, '3');
  await escribir(campos(fila).desc, 'Purgado del circuito');
  assert.equal(srv.gets(), 2, '🔴 un PATCH que no trae las líneas obliga a releer: si no, la pantalla enseña lo que creemos que mandamos');
  assert.equal(fila.getAttribute('data-parte-linea'), '2', '🔴 tras releer, la fila no se ha asentado');
  srv.pobre = false;

  await escribir(campos(fila).unds, '5');
  assert.deepEqual(srv.patch()[1].cuerpo.lineas[2], { id: 'n100', bloque: 'mano_obra', unds: 5, descripcion: 'Purgado del circuito' },
    '🔴 corregir la cantidad de la fila asentada no guarda la lista con SU id');

  const equis = fila.querySelector('.parte-quitar-linea');
  assert.equal(equis.getAttribute('data-indice'), '2', '🔴 la «×» de la fila asentada no es la de una línea guardada');
  assert.ok(equis.dispararClick() > 0);
  await vaciar();
  assert.deepEqual(srv.deLaBase(), ['mano_obra: 2 · Sustitución de la bomba', 'materiales: 1 · Bomba 25-60'],
    '🔴 la «×» de la fila asentada no la quita del servidor');
  assert.equal(srv.patch().length, 3, 'una escritura por gesto: guardar, corregir y quitar');
});

// ═══ ⑤ SI FALLA ═══════════════════════════════════════════════════════════════════════════════

test('SCRUM-916b · 🔴 si el guardado falla, el aviso va detrás de SU fila, lo tecleado sigue, y el siguiente «Añadir línea» lo reintenta', async () => {
  const { cont, srv, ctx } = await abrir();
  const falla = await pulsar(cont, 'mano_obra');
  const detras = await pulsar(cont, 'mano_obra');
  srv.falla = true;
  await escribir(campos(falla).unds, '3');
  await escribir(campos(falla).desc, 'Purgado del circuito');

  const avisos = cont.querySelectorAll('[data-linea-no-guardada]');
  assert.equal(avisos.length, 1, '🔴 el fallo no se dice');
  assert.equal(avisos[0].textContent, ctx.PARTE_TEXTOS.noSeGuardo, 'con el literal APROBADO, no uno nuevo');
  assert.equal(falla.nextSibling, avisos[0].parentNode,
    '🔴 el aviso no está justo detrás de la fila que no se guardó: con dos filas por escribir, no se sabría cuál');
  assert.deepEqual(porEscribir(cont), [falla, detras], 'las dos filas siguen por escribir');
  assert.equal(campos(falla).desc.value, 'Purgado del circuito', '🔴 lo tecleado se ha perdido');

  srv.falla = false;
  await pulsar(cont, 'mano_obra');                  // otro clic: añade Y reintenta la que está completa
  assert.equal(srv.deLaBase()[2], 'mano_obra: 3 · Purgado del circuito', '🔴 el siguiente clic no reintenta la línea que falló');
  assert.equal(cont.querySelectorAll('[data-linea-no-guardada]').length, 0, '🔴 el aviso sigue ahí con la línea ya guardada: sería mentira');
  assert.equal(porEscribir(cont).length, 2, 'quedan la que estaba vacía y la nueva');
});

// ═══ ⑥ LO QUE DEPENDE DE «¿HAY LÍNEAS?» SE PONE AL DÍA SIN REPINTAR ═════════════════════════

test('SCRUM-916b · 🔴 en un parte VACÍO, la primera línea pone el paso de las firmas al día sin repintarlo', async () => {
  const { cont, srv } = await abrir([]);
  const firmar = cont.querySelector('[data-parte-firmar]');
  assert.ok(firmar && firmar.hasAttribute('data-parte-firma-en-espera'), '🔴 NO PUDE MIRAR: el parte vacío no pinta la firma en espera');
  assert.equal(cont.querySelectorAll('[data-parte-apunta-primero]').length, 1, 'control: «apunta primero» está');

  const fila = await pulsar(cont, 'mano_obra');
  await escribir(campos(fila).unds, '3');
  await escribir(campos(fila).desc, 'Purgado del circuito');

  assert.equal(srv.patch().length, 1, 'control: se guardó');
  assert.equal(cont.querySelector('[data-parte-firmar]'), firmar, '🔴 el paso de las firmas se ha repintado (con la ficha entera)');
  assert.equal(conAtributo(cont, 'data-parte-firma-en-espera').length, 0,
    '🔴 con una línea guardada la firma sigue «en espera»: el servidor ya la admite y la pantalla dice que no');
  assert.equal(cont.querySelectorAll('[data-parte-apunta-primero]').length, 0, '🔴 sigue diciendo «apunta primero» con una línea apuntada');
  assert.equal(cont.querySelectorAll('[data-parte-primera-firma-fija]').length, 1, '🔴 falta el aviso de que la primera firma lo deja fijo');
});

// ═══ ⑦ UN REPINTADO DE OTRO CAMINO NO SE LLEVA LO QUE ESTÁ POR ESCRIBIR ═════════════════════

test('SCRUM-916b · 🔴 quitar una línea guardada (que repinta) conserva las filas por escribir, con lo tecleado', async () => {
  const { cont, srv } = await abrir();
  const aMedias = await pulsar(cont, 'mano_obra');
  await escribir(campos(aMedias).unds, '4');
  const equis = cont.querySelectorAll('.parte-quitar-linea').find((b) => b.getAttribute('data-indice') === '1');
  assert.ok(equis && equis.dispararClick() > 0, '🔴 NO PUDE MIRAR: no encuentro la «×» de la línea guardada 1');
  await vaciar();

  assert.deepEqual(srv.deLaBase(), ['mano_obra: 2 · Sustitución de la bomba'], 'control: la línea se quitó');
  const quedan = porEscribir(cont);
  assert.equal(quedan.length, 1, '🔴 el repintado se ha llevado la fila que el técnico tenía a medias');
  assert.equal(campos(quedan[0]).unds.value, '4', '🔴 la fila vuelve, pero sin lo tecleado');
  assert.equal(quedan[0].parentNode.getAttribute('data-parte-filas'), 'mano_obra');
  // Y sigue viva: se completa y se guarda.
  await escribir(campos(quedan[0]).desc, 'Revisión de la válvula');
  assert.equal(srv.deLaBase()[1], 'mano_obra: 4 · Revisión de la válvula', '🔴 la fila conservada ya no guarda');
});

test('SCRUM-916b · una fila EN COLA detrás de otro guardado que repinta se guarda UNA vez (ni se pierde ni se duplica)', async () => {
  const { cont, srv } = await abrir();
  srv.retener = true;
  const equis = cont.querySelectorAll('.parte-quitar-linea').find((b) => b.getAttribute('data-indice') === '1');
  equis.dispararClick();                            // su PATCH se queda en el aire
  await vaciar();
  const fila = await pulsar(cont, 'mano_obra');
  await escribir(campos(fila).unds, '3');
  await escribir(campos(fila).desc, 'Purgado del circuito');   // completa: espera su turno
  assert.equal(srv.patch().length, 1, 'control: la fila espera detrás de la «×», no escribe todavía');

  srv.retener = false;
  srv.soltar();                                     // vuelve la «×» y repinta
  await vaciar();
  assert.deepEqual(srv.deLaBase(), ['mano_obra: 2 · Sustitución de la bomba', 'mano_obra: 3 · Purgado del circuito'],
    '🔴 la fila que esperaba se ha perdido, se ha duplicado o ha resucitado la línea quitada');
  assert.deepEqual(guardadasEnPantalla(cont, 'mano_obra'), ['2 · Sustitución de la bomba', '3 · Purgado del circuito']);
  assert.equal(porEscribir(cont).length, 0);
  assert.equal(srv.patch().length, 2);
});

test('SCRUM-916b · una fila VIAJANDO cuando otro camino repinta: si llega, se ve guardada una vez; si falla, vuelve con su aviso', async () => {
  for (const falla of [false, true]) {
    const { ctx, cont, srv } = await abrir();
    const fila = await pulsar(cont, 'mano_obra');
    await escribir(campos(fila).unds, '3');
    srv.retener = true;
    await escribir(campos(fila).desc, 'Purgado del circuito');
    assert.equal(srv.enElAire.length, 1, '🔴 NO PUDE MIRAR: el guardado no está viajando');
    // Otro camino repinta la ficha (es lo que hacen la firma confirmada o un campo que no se guardó).
    await ctx.renderParteDetailView(cont, 7, { apiRequest: srv.apiRequest });
    assert.equal(porEscribir(cont).length, 1, '🔴 el repintado se ha llevado la fila que estaba viajando');

    srv.retener = false;
    srv.falla = falla;
    srv.soltar();
    await vaciar();
    if (!falla) {
      assert.deepEqual(guardadasEnPantalla(cont, 'mano_obra'), ['2 · Sustitución de la bomba', '3 · Purgado del circuito'],
        '🔴 la línea llegó al servidor y la pantalla no la enseña (o la enseña dos veces)');
      assert.equal(porEscribir(cont).length, 0, '🔴 queda una copia por escribir de una línea ya guardada: el siguiente clic la duplicaría');
      assert.equal(srv.patch().length, 1);
    } else {
      const quedan = porEscribir(cont);
      assert.equal(quedan.length, 1, '🔴 el guardado falló y la fila ya no está: lo tecleado se ha perdido');
      assert.equal(loQueSeVe(quedan[0]), '3 · Purgado del circuito');
      assert.equal(cont.querySelectorAll('[data-linea-no-guardada]').length, 1, '🔴 el fallo no se dice');
      srv.falla = false;
      await pulsar(cont, 'mano_obra');              // y se puede reintentar
      assert.equal(srv.deLaBase()[2], 'mano_obra: 3 · Purgado del circuito', '🔴 la fila que volvió no se puede reintentar');
    }
  }
});

// ═══ LAS MUTACIONES QUE ME TUMBAN (SCRUM-745; las ejecuta `npm run meta:mutaciones`) ══════════════
// Cada una imita un trozo del defecto, o un descuido que lo devolvería. Cada campo, LITERAL.
export const MUTACIONES_QUE_ME_TUMBAN = [
  // El defecto del fundador: con una fila ESCRITA en pantalla, pulsar no añade.
  { fichero: 'public/dashboard/js/parteDetailView.js', de: "      var fila = ponerFilaNueva(bloque, null);", a: "      var fila = filasNuevas().some(function (f) { return !!loQueDice(f); }) ? null : ponerFilaNueva(bloque, null);", cae: 'SCRUM-916b · 🔴 con la fila escrita, UN clic en «Añadir línea» la guarda Y abre otra vacía' },
  // Su otra mitad: una fila A MEDIAS bloquea los botones.
  { fichero: 'public/dashboard/js/parteDetailView.js', de: "      var fila = ponerFilaNueva(bloque, null);", a: "      var fila = filasNuevas().some(function (f) { return !loQueDice(f); }) ? null : ponerFilaNueva(bloque, null);", cae: 'SCRUM-916b · 🔴 dos clics son dos filas vacías, y una fila a medias no bloquea NINGÚN botón (cero escrituras)' },
  // Releer el parte entero aunque el PATCH ya traiga las líneas.
  { fichero: 'public/dashboard/js/parteDetailView.js', de: "        if (guardada && !lineas) {", a: "        if (guardada) {", cae: 'SCRUM-916b · 🔴 guardar una línea NO repinta la ficha: las demás filas y el botón son los MISMOS nodos' },
  // Volver a repintar la ficha entera al guardar, en vez de asentar la fila.
  { fichero: 'public/dashboard/js/parteDetailView.js', de: "        if (cuadraConLoMandado(lineas, lista)) {", a: "        if (false) {", cae: 'SCRUM-916b · 🔴 lo que hay A MEDIAS en otra fila sigue ahí cuando una se guarda' },
  // Pisar con la respuesta del servidor lo que el técnico sigue escribiendo.
  { fichero: 'public/dashboard/js/parteDetailView.js', de: "      if (c.desc.value === enviada.crudoDesc) { c.desc.value = desc; crecerDescripcion(c.desc); }", a: "      c.desc.value = desc;", cae: 'SCRUM-916b · 🔴 lo que se teclea MIENTRAS viaja el guardado no se pisa, y se guarda al salir del campo' },
  // La fila asentada sin el cable de una línea guardada.
  { fichero: 'public/dashboard/js/parteDetailView.js', de: "      escucharCasillaGuardada(c.unds, unds);", a: "      ;", cae: 'SCRUM-916b · la fila asentada se corrige y se quita como cualquier línea guardada (y si el PATCH no trae las líneas, se releen)' },
  // El aviso al final del bloque, y no detrás de SU fila.
  { fichero: 'public/dashboard/js/parteDetailView.js', de: "      fila.insertAdjacentHTML('afterend', AVISO_DE_FILA_NO_GUARDADA);", a: "      fila.parentNode.insertAdjacentHTML('beforeend', AVISO_DE_FILA_NO_GUARDADA);", cae: 'SCRUM-916b · 🔴 si el guardado falla, el aviso va detrás de SU fila, lo tecleado sigue, y el siguiente «Añadir línea» lo reintenta' },
  // El paso de las firmas, sin ponerse al día con la primera línea.
  { fichero: 'public/dashboard/js/parteDetailView.js', de: "          ponerFirmasAlDia();", a: "          ;", cae: 'SCRUM-916b · 🔴 en un parte VACÍO, la primera línea pone el paso de las firmas al día sin repintarlo' },
  // Un repintado que se lleva lo que estaba por escribir.
  { fichero: 'public/dashboard/js/parteDetailView.js', de: "    var porEscribir = filasPorEscribirDe(contenedor, parteId);", a: "    var porEscribir = [];", cae: 'SCRUM-916b · 🔴 quitar una línea guardada (que repinta) conserva las filas por escribir, con lo tecleado' },
  // La fila que esperaba su turno vuelve tras el repintado, pero nadie la guarda.
  { fichero: 'public/dashboard/js/parteDetailView.js', de: "        } else if (escrito.guardando === 'espera') {", a: "        } else if (escrito.guardando === 'nunca') {", cae: 'SCRUM-916b · una fila EN COLA detrás de otro guardado que repinta se guarda UNA vez (ni se pierde ni se duplica)' },
  // La fila que viajaba vuelve sin su recado: el desenlace del guardado no llega a la pantalla.
  { fichero: 'public/dashboard/js/parteDetailView.js', de: "        if (escrito.guardando === 'enviando') {", a: "        if (escrito.guardando === 'nunca') {", cae: 'SCRUM-916b · una fila VIAJANDO cuando otro camino repinta: si llega, se ve guardada una vez; si falla, vuelve con su aviso' },
];
