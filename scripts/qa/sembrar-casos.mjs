// scripts/qa/sembrar-casos.mjs — SCRUM-1367
//
// ═════════════════════════════════════════════════════════════════════════════════════════════
// 🔴 SÓLO `aceptado --presupuesto 206` SE HA EJECUTADO CONTRA PRODUCCIÓN (14-oct-2026, SCRUM-1367f:
//    Trabajo #77). La regla de `aceptado` existe (SCRUM-1367 c.18479, sus cinco condiciones abajo);
//    las otras órdenes siguen sin regla propia y sin correr. Es la
//    CAPACIDAD de crear los casos que le faltan a la cuenta QA, probada sin
//    red (`tests/scrum1367-sembrar-casos.test.mjs`). Vive APARTE de `sembrar-qa.mjs` a propósito:
//    aquél tiene la autorización del 29-sep-2026 y su lista blanca; éste ensancha lo que se puede
//    escribir (ACEPTAR un presupuesto) y por eso pide su propia regla. Dos ficheros, dos permisos.
//
//   node scripts/qa/sembrar-casos.mjs aceptado        ① un presupuesto ACEPTADO, con su Trabajo
//   node scripts/qa/sembrar-casos.mjs aceptado --presupuesto N   …aceptando el BORRADOR #N que ya existe (no crea)
//   node scripts/qa/sembrar-casos.mjs plan            ② un presupuesto en borrador con plan de cobro PROPIO
//   node scripts/qa/sembrar-casos.mjs perfil-fiscal   ③ razón social, NIF, dirección y WhatsApp DE PRUEBA en el merchant QA
//   node scripts/qa/sembrar-casos.mjs mismo-id        ④ SOLO MIDE: ¿hay un albarán y un parte con el mismo id?
//   node scripts/qa/sembrar-casos.mjs mismo-id --crear-hasta N    …y crea hasta N partes en borrador para conseguirlo
//
// Los cuatro huecos, medidos el 1-oct-2026 por cuatro sesiones distintas, cada una por su lado:
//   ① ningún Trabajo con presupuesto aceptado (SCRUM-1355: el control positivo no se pudo ver);
//   ② ningún presupuesto con plan de cobro propio (la pantalla del plan no se pudo ver);
//   ③ el merchant QA sin perfil fiscal: «Guardar cambios» no envía (SCRUM-1227 sin cerrar);
//   ④ ningún albarán y parte con el mismo id (SCRUM-1360: el defecto no se pudo ver en pantalla).
//
// Los cerrojos son los de `sembrar-qa.mjs`, no una copia: la cuenta se comprueba contra el SERVIDOR
// con SU `comprobarCuentaQA` (merchant 46 y owner) y nada sale sin esa prueba. La única escritura
// que este fichero AÑADE es `POST /admin/quotes/<id>/accept`; el resto sale por la `escritura` de
// allí, con la lista blanca de allí.
//
// LO QUE HACE Y LO QUE NO HACE CADA ORDEN, leído en `src/` el 1-oct-2026 (no visto en producción):
//   ① ACEPTAR cambia el estado del presupuesto y el servidor crea su Trabajo (`ensureJobForQuote`).
//      No emite documento, no cobra y no envía nada: `acceptQuoteAdmin` dice «solo estado, sin
//      crear cobros». NO deja un tramo emitido: eso es emitir factura y aquí no entra nunca.
//   ② El plan viaja en el alta (`customBillingPlan`): no hace falta el PATCH de billing-plan.
//   ③ 🔴 Los datos fiscales son INEQUÍVOCAMENTE DE PRUEBA y lo dicen ellos mismos. Sólo se
//      escriben sobre un campo VACÍO o que ya tenga el valor de prueba: si la cuenta trae otro
//      dato, alguien lo puso y no se pisa. ⚠️ `Merchant.legalName` y `taxId` entran en el hash de
//      la firma de los albaranes (aviso de SCRUM-431 en `job.service.ts`): un albarán de la cuenta
//      QA firmado ANTES de rellenarlos dejará de verificar. Es una cuenta de pruebas; se avisa.
//   ④ Partes y albaranes numeran aparte, y el id del siguiente parte no se sabe hasta crearlo.
//      Sin `--crear-hasta` no se escribe nada. Con él, cada parte creado se QUEDA (borrar no entra).
//
// ① LAS CINCO CONDICIONES DE SCRUM-1367 c.18479 (6-oct-2026: el orquestador decide SÍ, por
//    delegación del fundador). Cómo las cumple `aceptado` (SCRUM-1367e):
//   1 · sólo la cuenta QA ............ `comprobarCuentaQA` (merchant 46 y owner, dicho por el servidor).
//   2 · ni documento ni cobro ......... foto de los ids de facturas, cobros y albaranes ANTES de
//                                       aceptar y DESPUÉS; si difieren, grita (sale 1). Sin foto
//                                       completa (lista ilegible o llena), no acepta.
//       ⚠️ «deshace» NO se puede: un documento emitido no se borra (regla 29) y un aceptado no se
//       rechaza (409 `already_accepted`). Por eso la quinta va ANTES y es la que protege.
//   3 · teléfonos del rango imposible . relee la ficha del cliente QA: todo teléfono que traiga es
//                                       `340` + 8 dígitos (SCRUM-262), o no acepta.
//   4 · declarado ..................... la salida dice qué creó y que NO se quita por el panel.
//   5 · 🔴 FAIL-CLOSED ................ `GET /admin/me` → `modoEmision` tiene que ser `receipt`
//       (España, no demo, `INVOICING_ES_ENABLED` en OFF: `getEmissionMode`). Cualquier otro
//       valor, o ninguno, y no escribe NADA. El día que se encienda, la orden deja de funcionar sola.
//
// ① CON `--presupuesto N` (SCRUM-1367f, 14-oct-2026). Crear un presupuesto pide plan activo
//    (`requireActivePlan` en `/quote/create`) y la prueba de la cuenta QA venció el 12-oct; aceptar
//    no lo pide. Esta variante acepta un borrador que YA existe, por el mismo camino y con las
//    mismas cinco condiciones. Lo único que cambia es de dónde sale el presupuesto, y por eso
//    lleva dos cerrojos más:
//   · el #N tiene que ser del cliente QA, que es aquél cuyos teléfonos mira la condición 3;
//   · si el cliente QA ya tiene un presupuesto ACEPTADO, no se acepta otro: el caso ① ya existe.
//     Sin la marca, ésta es la idempotencia. Vale también al revés: sin `--presupuesto`, un
//     aceptado sin marca frena el alta de uno nuevo.
//
// SALIDAS: las de `sembrar-qa.mjs` — 0 hecho · 1 NO PUDE · 2 CIEGO: sin sesión · 3 rechazado.
// ═════════════════════════════════════════════════════════════════════════════════════════════
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { peticion, urlDelPanel, Rechazo, RUTA_SESION } from './sesion-panel.mjs';
import {
  comprobarCuentaQA, escritura, leerJSON, guardarPerfil, NoPude, PROHIBIDAS,
  NOMBRE_CLIENTE_QA, TITULO_TRABAJO_QA,
} from './sembrar-qa.mjs';

export const MARCA_ACEPTADO = '[QA-1367-ACEPTADO]';
export const MARCA_PLAN = '[QA-1367-PLAN]';
/**
 * En FRACCIÓN y sumando 1: `validateCustomBillingPlan` exige `Σ round(percentage*100) === 100`.
 * El borrador de este fichero los llevaba en porcentaje (40 y 60) y el servidor los habría
 * rechazado con un 400; lo cazó el test al pasar el plan por el validador de verdad (2-oct-2026).
 */
export const PLAN_QA = [
  { label: 'Anticipo de pruebas QA', percentage: 0.4 },
  { label: 'Final de pruebas QA', percentage: 0.6 },
];
/**
 * 🔴 DATOS FISCALES DE PRUEBA. No son de nadie y lo dicen: provincia 00 (no existe), todo ceros,
 * código postal 00000 y un móvil del rango imposible de SCRUM-262. Si los ves en una cuenta que no
 * es la QA, alguien se ha equivocado de cuenta.
 */
export const PERFIL_FISCAL_QA = {
  legalName: 'PRUEBAS QA YAQU - NO ES UNA EMPRESA REAL',
  taxId: 'B00000000',
  address: 'Calle de Pruebas QA 0, 00000 Ninguna Parte (dato de prueba)',
  whatsappPhone: '34000001367',
};
export const TOPE_PARTES_POR_ORDEN = 50;
const TOPE_LISTA_PRESUPUESTOS = 100; // `TOPE_LISTADO_QUOTES`: si llega llena, «no está» no se sabe
const LIMITE_LISTA = 200;
const INTENTOS_TRABAJO = 5; // el servidor crea el Trabajo SIN esperar (`ensureJobForQuote(...).catch`)

/** Lo ÚNICO que este fichero añade a lo que `sembrar-qa.mjs` ya deja escribir. */
export const ESCRITURAS_DE_CASOS = [
  ['POST', /^\/admin\/quotes\/\d+\/accept$/],
];

const cuentasVistas = new WeakSet();
async function cuentaQA(fetchFn, cookie) {
  const cuenta = await comprobarCuentaQA(fetchFn, cookie);
  cuentasVistas.add(cuenta);
  return cuenta;
}

/** Grita si `metodo ruta` no es una escritura de casos. Las prohibidas de `sembrar-qa` mandan igual. */
export function escrituraDeCasoPermitida(metodo, ruta) {
  const m = String(metodo).toUpperCase();
  const u = urlDelPanel(ruta);
  if (u.search || u.hash) throw new Rechazo(`🔴 ESCRITURA RECHAZADA: ${m} ${ruta} lleva query o fragmento.`);
  if (PROHIBIDAS.some((re) => re.test(u.pathname))) throw new Rechazo(`🔴 ESCRITURA PROHIBIDA: ${m} ${u.pathname}.`);
  if (!ESCRITURAS_DE_CASOS.some(([mm, re]) => mm === m && re.test(u.pathname))) {
    throw new Rechazo(`🔴 ESCRITURA RECHAZADA: ${m} ${u.pathname} no está en la lista de casos de SCRUM-1367.`);
  }
  return u;
}

async function escrituraDeCaso(fetchFn, metodo, ruta, { cuenta, cuerpo = {} } = {}) {
  const u = escrituraDeCasoPermitida(metodo, ruta);
  if (!cuenta || !cuentasVistas.has(cuenta)) throw new Rechazo('🔴 escritura sin una cuenta QA comprobada contra el servidor: no sale.');
  return fetchFn(u.href, {
    method: String(metodo).toUpperCase(),
    headers: { accept: 'application/json', 'content-type': 'application/json', cookie: cuenta.cookie },
    body: JSON.stringify(cuerpo),
    redirect: 'manual',
  });
}

const lista = (x, que) => { if (!Array.isArray(x)) throw new NoPude(`${que} no devolvió una lista`); return x; };
const lector = (fetchFn, cookie) => async (ruta) => leerJSON(await peticion(fetchFn, 'GET', ruta, { cookie }), `GET ${ruta}`);

/** El cliente QA, que tiene que existir ya: estos casos se montan SOBRE el sembrado base. */
async function clienteQA(leer) {
  const suyos = lista(await leer(`/admin/customers?search=${encodeURIComponent(NOMBRE_CLIENTE_QA)}`), 'la búsqueda de clientes')
    .filter((c) => c && c.name === NOMBRE_CLIENTE_QA);
  if (suyos.length !== 1) {
    throw new NoPude(`hay ${suyos.length} clientes «${NOMBRE_CLIENTE_QA}» y hace falta exactamente uno. `
      + 'Si no hay ninguno, corre antes `node scripts/qa/sembrar-qa.mjs sembrar`.');
  }
  return suyos[0];
}

/** El presupuesto del cliente QA que lleva `marca` en la cabecera o el pie; lo crea si no está. */
async function presupuestoConMarca(fetchFn, leer, cuenta, cliente, marca, extra) {
  const delCliente = lista(await leer(`/admin/quotes?search=${encodeURIComponent(NOMBRE_CLIENTE_QA)}`), 'la lista de presupuestos');
  const conMarca = [];
  for (const q of delCliente.filter((x) => x && x.customerName === NOMBRE_CLIENTE_QA)) {
    const d = await leer(`/admin/quotes/${q.id}`);
    if (d.customer && d.customer.id === cliente.id && `${d.docHeaderText ?? ''}\n${d.docFooterText ?? ''}`.includes(marca)) conMarca.push(d);
  }
  if (conMarca.length > 1) throw new NoPude(`hay ${conMarca.length} presupuestos con la marca ${marca} (ids ${conMarca.map((q) => q.id).join(', ')}): no elijo uno a ciegas.`);
  if (conMarca.length) return { presupuesto: conMarca[0], nuevo: false };
  if (delCliente.length >= TOPE_LISTA_PRESUPUESTOS) throw new NoPude(`la lista de presupuestos llega llena (${delCliente.length}): no puedo afirmar que el de la marca ${marca} no exista.`);
  const creado = await leerJSON(await escritura(fetchFn, 'POST', '/quote/create', {
    cuenta,
    cuerpo: {
      merchant_id: cuenta.merchantId, customer_id: cliente.id, currency: 'EUR',
      lines: [{ concept: 'Servicio de pruebas QA', qty: 1, price: 100, tax: 0.21 }], // IVA en FRACCIÓN (SCRUM-1268c)
      docHeaderText: `${marca} Presupuesto de pruebas QA creado por scripts/qa/sembrar-casos.mjs.`,
      ...extra,
    },
  }), 'POST /quote/create');
  if (!Number.isInteger(creado.id)) throw new NoPude('el presupuesto no trae id');
  const presupuesto = await leer(`/admin/quotes/${creado.id}`);
  if (!String(presupuesto.docHeaderText ?? '').includes(marca)) {
    throw new NoPude(`presupuesto #${creado.id} creado, pero al releerlo NO lleva la marca ${marca}: la siguiente orden crearía otro.`);
  }
  return { presupuesto, nuevo: true };
}

/** El único modo en que aceptar no puede emitir ni cobrar (regla 24). Ver condición 5 arriba. */
export const MODO_QUE_PERMITE_ACEPTAR = 'receipt';
/** Rango imposible de SCRUM-262: 34 + 0 + 8 dígitos. */
export const TELEFONO_IMPOSIBLE = /^340\d{8}$/;

/** Condición 5. El modo lo calcula el SERVIDOR; aquí no se reconstruye el criterio. */
async function exigirModoSinEmision(leer) {
  const me = await leer('/admin/me');
  if (me.modoEmision !== MODO_QUE_PERMITE_ACEPTAR) {
    throw new Rechazo(`🔴 NO SE ACEPTA: el servidor dice modoEmision=${JSON.stringify(me.modoEmision ?? null)} y sólo se acepta con `
      + `«${MODO_QUE_PERMITE_ACEPTAR}» (INVOICING_ES_ENABLED en OFF: aceptar no puede emitir ni cobrar). No se ha escrito nada.`);
  }
}

/** Condición 3. Cada teléfono que traiga la ficha, del rango imposible; si la ficha no los trae, no se sabe. */
async function exigirTelefonosImposibles(leer, cliente) {
  const ficha = await leer(`/admin/customers/${cliente.id}`);
  if (!ficha || !('mobile' in ficha) || !('phone' in ficha)) {
    throw new NoPude(`la ficha del cliente #${cliente.id} no trae «mobile» y «phone»: no sé si un mensaje llegaría a alguien. No se ha escrito nada.`);
  }
  const reales = ['mobile', 'phone'].filter((k) => ficha[k] != null && String(ficha[k]).trim() !== '' && !TELEFONO_IMPOSIBLE.test(String(ficha[k]).replace(/\D/g, '')));
  if (reales.length) {
    throw new Rechazo(`🔴 NO SE ACEPTA: el cliente #${cliente.id} tiene ${reales.map((k) => `${k}=${ficha[k]}`).join(', ')}, fuera del rango imposible (SCRUM-262). No se ha escrito nada.`);
  }
}

/**
 * Condición 2. Los ids de todo lo que es documento o cobro en la cuenta. Ids y no cifras: un
 * documento que entra mientras otro sale deja la cifra igual. Lista ilegible o llena = sin foto.
 */
async function fotoDeDocumentosYCobros(leer) {
  const llena = (xs, que) => { if (xs.length >= LIMITE_LISTA) throw new NoPude(`${que} llega llena (${xs.length}): no puedo contar lo que hay.`); return xs; };
  const facturas = llena(lista(await leer('/admin/invoices'), 'la lista de facturas'), 'la lista de facturas');
  const cobros = llena(lista(await leer('/admin/cobros'), 'la lista de cobros'), 'la lista de cobros');
  const al = await leer('/admin/albaranes');
  const albaranes = llena(lista(al && al.filas, 'la lista de albaranes'), 'la lista de albaranes');
  const ids = (xs, pref) => xs.map((x) => `${pref}${x.origen ? `${x.origen}:` : ''}${x.id}`);
  return [...ids(facturas, 'factura '), ...ids(cobros, 'cobro '), ...ids(albaranes, 'albarán ')].sort();
}

/** Los presupuestos ACEPTADOS del cliente QA, releídos uno a uno. Lista llena = no se sabe. */
async function aceptadosDelCliente(leer, cliente) {
  const delCliente = lista(await leer(`/admin/quotes?search=${encodeURIComponent(NOMBRE_CLIENTE_QA)}`), 'la lista de presupuestos');
  if (delCliente.length >= TOPE_LISTA_PRESUPUESTOS) throw new NoPude(`la lista de presupuestos llega llena (${delCliente.length}): no puedo afirmar que no haya ya uno aceptado.`);
  const aceptados = [];
  for (const q of delCliente.filter((x) => x && x.customerName === NOMBRE_CLIENTE_QA && x.status === 'accepted')) {
    const d = await leer(`/admin/quotes/${q.id}`);
    if (d.customer && d.customer.id === cliente.id) aceptados.push(d);
  }
  return aceptados;
}

/** `--presupuesto N`: el borrador que ya existe, del cliente QA y sin otro aceptado al lado. */
async function presupuestoElegido(leer, cliente, id, aceptados) {
  const otros = aceptados.filter((q) => q.id !== id);
  if (otros.length) {
    throw new NoPude(`el cliente QA ya tiene ${otros.length === 1 ? 'un presupuesto aceptado' : `${otros.length} presupuestos aceptados`} (#${otros.map((q) => q.id).join(', #')}): `
      + `el caso ① ya existe y no acepto el #${id}. Para verlo: \`aceptado --presupuesto ${otros[0].id}\`. No se ha escrito nada.`);
  }
  const presupuesto = await leer(`/admin/quotes/${id}`);
  if (!presupuesto.customer || presupuesto.customer.id !== cliente.id) {
    throw new Rechazo(`🔴 NO SE ACEPTA: el presupuesto #${id} es del cliente #${presupuesto.customer ? presupuesto.customer.id : '?'} y sólo se acepta uno `
      + `del cliente QA #${cliente.id}, el de los teléfonos comprobados. No se ha escrito nada.`);
  }
  return presupuesto;
}

/**
 * ① Un presupuesto ACEPTADO y su Trabajo, vistos los dos al releer. Si se llegó a intentar la
 * aceptación, la foto de después se mira SIEMPRE: también si el `accept` falla o el Trabajo no sale.
 */
export async function casoAceptado(fetchFn, cookie, opciones = {}) {
  const intento = { fotoAntes: null, leer: lector(fetchFn, cookie), presupuestoId: null };
  let lineas = null;
  let fallo = null;
  try { lineas = await aceptarYVerTrabajo(fetchFn, cookie, opciones, intento); } catch (e) { fallo = e; }
  if (intento.fotoAntes !== null) {
    let fotoDespues;
    try { fotoDespues = await fotoDeDocumentosYCobros(intento.leer); } catch (e) {
      throw new NoPude(`🔴 se intentó aceptar el presupuesto #${intento.presupuestoId} y NO PUDE releer documentos y cobros después (${e.message}). `
        + `Míralo a mano en la cuenta QA.${fallo ? ` Antes había fallado: ${fallo.message}` : ''}`);
    }
    const nuevos = fotoDespues.filter((x) => !intento.fotoAntes.includes(x));
    const idos = intento.fotoAntes.filter((x) => !fotoDespues.includes(x));
    if (nuevos.length || idos.length) {
      throw new NoPude(`🔴🔴 ACEPTAR HA MOVIDO DOCUMENTOS O COBROS en la cuenta QA: aparecen [${nuevos.join(', ')}] · desaparecen [${idos.join(', ')}]. `
        + `El presupuesto #${intento.presupuestoId} y lo que haya salido NO se deshacen por el panel (regla 29). Avisa YA al orquestador.`);
    }
    if (!fallo) lineas.push(`documentos y cobros: los mismos ${intento.fotoAntes.length} antes y después de aceptar (ids de facturas, cobros y albaranes)`);
  }
  if (fallo) throw fallo;
  return lineas;
}

async function aceptarYVerTrabajo(fetchFn, cookie, { esperar = (ms) => new Promise((r) => setTimeout(r, ms)), presupuestoId = null }, intento) {
  const cuenta = await cuentaQA(fetchFn, cookie);
  const { leer } = intento;
  await exigirModoSinEmision(leer);
  const cliente = await clienteQA(leer);
  await exigirTelefonosImposibles(leer, cliente);
  const aceptados = await aceptadosDelCliente(leer, cliente);
  let presupuesto;
  let nuevo = false;
  if (presupuestoId !== null) {
    presupuesto = await presupuestoElegido(leer, cliente, presupuestoId, aceptados);
  } else {
    const sinMarca = aceptados.filter((q) => !`${q.docHeaderText ?? ''}\n${q.docFooterText ?? ''}`.includes(MARCA_ACEPTADO));
    if (sinMarca.length) {
      throw new NoPude(`el cliente QA ya tiene el presupuesto #${sinMarca[0].id} aceptado (sin la marca ${MARCA_ACEPTADO}): el caso ① ya existe y no creo otro. `
        + `Para verlo: \`aceptado --presupuesto ${sinMarca[0].id}\`. No se ha escrito nada.`);
    }
    ({ presupuesto, nuevo } = await presupuestoConMarca(fetchFn, leer, cuenta, cliente, MARCA_ACEPTADO, {}));
  }
  let aceptadoAhora = false;
  if (presupuesto.status !== 'accepted') {
    if (presupuesto.status !== 'draft') throw new NoPude(`el presupuesto #${presupuesto.id} está en «${presupuesto.status}»: sólo se acepta desde borrador.`);
    const foto = await fotoDeDocumentosYCobros(leer);
    await exigirModoSinEmision(leer); // otra vez, pegado a la escritura
    intento.fotoAntes = foto;
    intento.presupuestoId = presupuesto.id;
    await leerJSON(await escrituraDeCaso(fetchFn, 'POST', `/admin/quotes/${presupuesto.id}/accept`, {
      cuenta, cuerpo: { channel: 'backoffice', comment: 'Aceptación de PRUEBA (scripts/qa/sembrar-casos.mjs, SCRUM-1367). Sin cliente real.' },
    }), `POST /admin/quotes/${presupuesto.id}/accept`);
    aceptadoAhora = true;
    presupuesto = await leer(`/admin/quotes/${presupuesto.id}`);
    if (presupuesto.status !== 'accepted') throw new NoPude(`el presupuesto #${presupuesto.id} no quedó aceptado (status=${presupuesto.status}).`);
  }
  // El Trabajo lo crea el servidor sin esperar: se busca, y si no sale se DICE (no se da por hecho).
  let trabajo = null;
  let total = 0;
  for (let i = 0; i < INTENTOS_TRABAJO && !trabajo; i++) {
    if (i) await esperar(1000);
    const trabajos = lista(await leer('/admin/jobs'), 'la lista de trabajos');
    total = trabajos.length;
    trabajo = trabajos.find((j) => j && j.quote && j.quote.id === presupuesto.id) || null;
  }
  const lineas = [
    `cuenta comprobada en el servidor: merchant ${cuenta.merchantId} («${cuenta.nombre}»), owner`,
    `presupuesto #${presupuesto.id} nº ${presupuesto.number ?? '?'} · ${nuevo ? 'CREADO' : presupuestoId !== null ? 'ya estaba (elegido con --presupuesto, sin marca)' : 'ya estaba'} · ${aceptadoAhora ? 'ACEPTADO ahora' : 'ya estaba aceptado (no se repite)'}`,
  ];
  if (!trabajo) {
    throw new NoPude(`el presupuesto #${presupuesto.id} está aceptado, pero su Trabajo no aparece entre los ${total} de la lista`
      + `${total >= LIMITE_LISTA ? ' (la lista llega llena: puede estar y no verse)' : ''}. El caso NO está completo.`);
  }
  if (trabajo.totalAceptado == null) throw new NoPude(`el Trabajo #${trabajo.id} existe, pero su importe aceptado sale vacío: el control positivo de SCRUM-1355 no se vería.`);
  lineas.push(`trabajo   #${trabajo.id} · con su presupuesto aceptado · importe aceptado ${trabajo.totalAceptado}`);
  lineas.push('no se ha emitido ningún documento, ni cobrado, ni enviado nada');
  lineas.push(`queda en la cuenta QA: el presupuesto #${presupuesto.id} (${presupuestoId !== null ? 'elegido con --presupuesto' : `marca ${MARCA_ACEPTADO}`}) aceptado y su Trabajo #${trabajo.id}. `
    + 'NO se quita por el panel (un aceptado no se rechaza ni se borra); repetir la orden no crea otro.');
  return lineas;
}

/** ② Un presupuesto en borrador con plan de cobro PROPIO, releído. */
export async function casoPlan(fetchFn, cookie) {
  const cuenta = await cuentaQA(fetchFn, cookie);
  const leer = lector(fetchFn, cookie);
  const cliente = await clienteQA(leer);
  const { presupuesto, nuevo } = await presupuestoConMarca(fetchFn, leer, cuenta, cliente, MARCA_PLAN, { customBillingPlan: PLAN_QA });
  const tramos = Array.isArray(presupuesto.billingPlan) ? presupuesto.billingPlan : [];
  if (presupuesto.hasCustomPlan !== true || tramos.length !== PLAN_QA.length) {
    throw new NoPude(`el presupuesto #${presupuesto.id} existe, pero al releerlo NO tiene plan propio de ${PLAN_QA.length} tramos `
      + `(hasCustomPlan=${presupuesto.hasCustomPlan}, tramos=${tramos.length}).`);
  }
  return [
    `cuenta comprobada en el servidor: merchant ${cuenta.merchantId} («${cuenta.nombre}»), owner`,
    `presupuesto #${presupuesto.id} nº ${presupuesto.number ?? '?'} · ${presupuesto.status} · plan propio de ${tramos.length} tramos · ${nuevo ? 'CREADO' : 'ya estaba'}`,
  ];
}

/** ③ El perfil fiscal DE PRUEBA, sólo sobre campos vacíos o que ya lo tengan. */
export async function casoPerfilFiscal(fetchFn, cookie) {
  await cuentaQA(fetchFn, cookie);
  const antes = await lector(fetchFn, cookie)('/admin/merchant');
  const ajenos = Object.entries(PERFIL_FISCAL_QA).filter(([k, v]) => antes[k] != null && String(antes[k]).trim() !== '' && antes[k] !== v);
  if (ajenos.length) {
    throw new NoPude(`el perfil ya trae ${ajenos.map(([k]) => k).join(', ')} con un valor que no es el de prueba: alguien lo puso y no se pisa. No se ha escrito nada.`);
  }
  if (Object.entries(PERFIL_FISCAL_QA).every(([k, v]) => antes[k] === v)) {
    return ['el perfil fiscal de PRUEBA ya estaba puesto, campo a campo: no se escribe nada'];
  }
  const lineas = await guardarPerfil(fetchFn, cookie, PERFIL_FISCAL_QA);
  if (lineas.some((l) => l.startsWith('🔴'))) throw new NoPude(`el perfil no se relee como se envió:\n${lineas.join('\n')}`);
  return [
    ...lineas,
    '🔴 son datos DE PRUEBA: no son de ninguna empresa (NIF todo ceros, provincia 00, móvil de un rango imposible)',
    '⚠️ razón social y NIF entran en el hash de la firma de los albaranes: uno firmado ANTES de este cambio dejará de verificar',
  ];
}

/** ④ ¿Hay un albarán y un parte con el mismo id? Sin `crearHasta`, sólo mide. */
export async function casoMismoId(fetchFn, cookie, { crearHasta = 0 } = {}) {
  const cuenta = await cuentaQA(fetchFn, cookie);
  const leer = lector(fetchFn, cookie);
  const al = await leer('/admin/albaranes');
  const albaranes = lista(al && al.filas, 'la lista de albaranes');
  const pa = await leer('/admin/partes');
  const partes = lista(pa && pa.partes, 'la lista de partes');
  if (!albaranes.length) throw new NoPude('la cuenta no tiene ningún albarán. Corre antes `node scripts/qa/sembrar-qa.mjs sembrar`.');
  const idsAlbaran = new Set(albaranes.map((a) => a.id));
  const cabecera = `cuenta comprobada en el servidor: merchant ${cuenta.merchantId}, owner · población: ${albaranes.length} albaranes, ${partes.length} partes`;
  const ya = partes.find((p) => idsAlbaran.has(p.id));
  if (ya) return [cabecera, `HAY: el albarán #${ya.id} y el parte #${ya.id} comparten id · no se escribe nada`];
  if (partes.length >= LIMITE_LISTA) throw new NoPude(`la lista de partes llega llena (${partes.length}): no puedo afirmar que no haya ya uno con el id de un albarán.`);
  const mayorAlbaran = Math.max(...idsAlbaran);
  if (!crearHasta) {
    return [cabecera, `NO HAY ninguno. Albaranes: #${[...idsAlbaran].sort((a, b) => a - b).join(', #')} · partes: ${partes.length ? '#' + partes.map((p) => p.id).sort((a, b) => a - b).join(', #') : 'ninguno'}.`,
      'No se ha escrito nada. Para crearlo: `mismo-id --crear-hasta N` (cada parte creado se queda en la cuenta, en borrador).'];
  }
  const trabajos = lista(await leer('/admin/jobs'), 'la lista de trabajos').filter((j) => j && j.tituloPropio === TITULO_TRABAJO_QA);
  if (trabajos.length !== 1) throw new NoPude(`hay ${trabajos.length} trabajos «${TITULO_TRABAJO_QA}» y hace falta exactamente uno para colgar los partes.`);
  const creados = [];
  while (creados.length < crearHasta) {
    const p = await leerJSON(await escritura(fetchFn, 'POST', '/admin/partes', { cuenta, cuerpo: { jobId: trabajos[0].id } }), 'POST /admin/partes');
    if (!Number.isInteger(p.id)) throw new NoPude(`un parte creado no trae id. Creados hasta aquí: ${creados.join(', ') || 'ninguno'}.`);
    creados.push(p.id);
    if (idsAlbaran.has(p.id)) return [cabecera, `HECHO: el parte #${p.id} comparte id con el albarán #${p.id} · partes creados: ${creados.length} (#${creados.join(', #')})`];
    if (p.id > mayorAlbaran) {
      throw new NoPude(`el contador de partes (#${p.id}) ya pasó del mayor albarán de la cuenta (#${mayorAlbaran}): por este camino no se alcanza. `
        + `Creados y que se quedan: #${creados.join(', #')}.`);
    }
  }
  throw new NoPude(`creados ${creados.length} partes (#${creados.join(', #')}) y ninguno coincide todavía; el mayor albarán es #${mayorAlbaran}. Repite con otro \`--crear-hasta\`.`);
}

export async function ejecutar(argv, { fetchFn = globalThis.fetch, rutaSesion = RUTA_SESION, esperar, out = (s) => process.stdout.write(s + '\n'), err = (s) => process.stderr.write(s + '\n') } = {}) {
  const [orden, ...resto] = argv;
  try {
    const ORDENES = ['aceptado', 'plan', 'perfil-fiscal', 'mismo-id'];
    if (!ORDENES.includes(orden)) throw new Rechazo(`orden «${orden ?? ''}» desconocida. Uso: ${ORDENES.join(' · ')} [--crear-hasta N | --presupuesto N]`);
    let crearHasta = 0;
    let presupuestoId = null;
    if (resto.length) {
      const opcion = { 'mismo-id': '--crear-hasta', aceptado: '--presupuesto' }[orden];
      if (!opcion || resto.length !== 2 || resto[0] !== opcion || !/^\d+$/.test(resto[1])) throw new Rechazo(`argumentos de más o mal formados: ${resto.join(' ')}`);
      if (orden === 'aceptado') {
        presupuestoId = Number(resto[1]);
        if (presupuestoId < 1) throw new Rechazo('--presupuesto necesita el id de un presupuesto.');
      } else {
        crearHasta = Number(resto[1]);
        if (crearHasta < 1 || crearHasta > TOPE_PARTES_POR_ORDEN) throw new Rechazo(`--crear-hasta admite de 1 a ${TOPE_PARTES_POR_ORDEN} partes por orden.`);
      }
    }
    let cookie = '';
    try { cookie = fs.readFileSync(rutaSesion, 'utf8').trim(); } catch { cookie = ''; }
    if (!cookie) {
      err(`CIEGO — no hay sesión guardada en ${rutaSesion}. Entra antes con: node scripts/qa/sesion-panel.mjs login luisdragonball+qa@gmail.com`);
      return 2;
    }
    const lineas = orden === 'aceptado' ? await casoAceptado(fetchFn, cookie, { ...(esperar ? { esperar } : {}), presupuestoId })
      : orden === 'plan' ? await casoPlan(fetchFn, cookie)
        : orden === 'perfil-fiscal' ? await casoPerfilFiscal(fetchFn, cookie)
          : await casoMismoId(fetchFn, cookie, { crearHasta });
    for (const l of lineas) out(l);
    return 0;
  } catch (e) {
    if (e instanceof Rechazo) { err(e.message); return 3; }
    if (e instanceof NoPude) { err(`NO PUDE: ${e.message} Lo hecho hasta aquí queda como estaba.`); return 1; }
    err(`NO PUDE: ${e && e.message ? e.message : e}`);
    return 1;
  }
}

// ── CLI ──────────────────────────────────────────────────────────────────────────────────────────
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = await ejecutar(process.argv.slice(2));
}
