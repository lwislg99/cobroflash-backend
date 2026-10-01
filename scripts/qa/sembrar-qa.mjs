// scripts/qa/sembrar-qa.mjs — SCRUM-1268
//
// ═════════════════════════════════════════════════════════════════════════════════════════════
// 🔴 LA ÚNICA ESCRITURA EN PRODUCCIÓN PARA QA: ESTRECHA, Y SÓLO EN LA CUENTA QA.
//
//   node scripts/qa/sembrar-qa.mjs sembrar            cliente + trabajo + albarán EMITIDO + parte en borrador
//                                                     + presupuesto en borrador con cabecera y pie
//   node scripts/qa/sembrar-qa.mjs perfil <f.json>    guarda Configuración y la RELEE, campo a campo
//
// Autorizado por el fundador (29-sep-2026) para QA en producción en la cuenta QA, incluida la
// escritura en Configuración. Vive APARTE de `sesion-panel.mjs`, que sigue siendo sólo de lectura:
// dos ficheros, dos reglas de permiso. Retirar la escritura es borrar este fichero y su regla.
//
// Entra con la sesión que deja `node scripts/qa/sesion-panel.mjs login luisdragonball+qa@gmail.com`
// y lee con SU `peticion` (sólo GET). Lo que escribe sale por `escritura`, que exige ANTES de la red:
//   ① método + ruta en `ESCRITURAS` y en ninguna de `PROHIBIDAS`, sin query ni fragmento;
//   ② una cuenta que `comprobarCuentaQA` haya visto en el SERVIDOR: `GET /admin/me` con
//      `merchantId === MERCHANT_QA` y `isOwner`. No el correo —`/admin/me` ni lo devuelve—, y no un
//      objeto fabricado: sólo vale el que devuelve esa función.
//
// Lo que NO entra, sea la cuenta que sea: emitir facturas, cobros o pagos, enviar nada al cliente
// (`/enviar-*`), onboarding, flags y borrar. Tampoco `slug` ni `invoiceSeriesPrefix` del perfil (la
// URL pública y la serie de numeración).
//
// Emitir un albarán es IRREVERSIBLE y gasta un número ALB: `sembrar` sólo emite si el albarán no lo
// está, y el alta lleva una clave de idempotencia fija por trabajo (el servidor devuelve el mismo,
// 200 `repetida`, sin reservar número). Repetir la orden no crea nada nuevo ni quema números.
//
// El PRESUPUESTO (SCRUM-1268b) gasta un número de la serie de presupuestos, que NO es fiscal, y
// como owner no avisa a nadie (el WhatsApp sólo sale si necesita aprobación, y eso es de un
// técnico: `quotes.routes.ts`, `needsApproval`). 🔴 `POST /quote/create` NO deduplica: la
// idempotencia es NUESTRA, por el marcador `MARCA_PRESUPUESTO_QA` en su cabecera o su pie, y se
// busca en el DETALLE de cada presupuesto del cliente QA (la lista no trae esos textos).
//
// SALIDAS: 0 hecho · 1 NO PUDE (respuesta no 2xx, datos ambiguos, lista recortada): se dice, y lo
//          hecho hasta ahí queda como estaba · 2 CIEGO: sin sesión · 3 rechazado: uso malo,
//          escritura fuera de la lista, o una sesión que NO es la cuenta QA.
// ═════════════════════════════════════════════════════════════════════════════════════════════
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { peticion, urlDelPanel, Rechazo, RUTA_SESION } from './sesion-panel.mjs';

export const MERCHANT_QA = 46; // medido con `sesion-panel.mjs get /admin/me` el 29-sep-2026: «PruebaQA», owner
export const NOMBRE_CLIENTE_QA = 'Cliente de pruebas QA';
export const MOVIL_CLIENTE_QA = '34000001268'; // rango imposible: 34 + 0 + 8 dígitos (SCRUM-262)
export const TITULO_TRABAJO_QA = 'Trabajo de pruebas QA';
export const claveAlbaranQA = (jobId) => `qa-sembrar-albaran-trabajo-${jobId}`;
export const PERFIL_EXCLUIDOS = ['slug', 'invoiceSeriesPrefix'];
const LIMITE_LISTA = 200; // las listas del panel cortan en 200: si llega llena, «no está» no se sabe
export const MARCA_PRESUPUESTO_QA = '[QA-1268]';
export const CABECERA_QA = `${MARCA_PRESUPUESTO_QA} Cabecera de pruebas QA: este texto va ARRIBA del presupuesto.`;
export const PIE_QA = `${MARCA_PRESUPUESTO_QA} Pie de pruebas QA: este texto va ABAJO del presupuesto.`;
const TOPE_LISTA_PRESUPUESTOS = 100; // `TOPE_LISTADO_QUOTES` de quoteAdmin.ts: si llega llena, «no está» no se sabe

export const ESCRITURAS = [
  ['POST', /^\/admin\/customers$/],
  ['POST', /^\/admin\/jobs$/],
  ['POST', /^\/admin\/jobs\/\d+\/albaranes$/],
  ['POST', /^\/admin\/albaranes\/\d+\/emitir$/],
  ['POST', /^\/admin\/partes$/],
  ['PUT', /^\/admin\/merchant$/],
  ['POST', /^\/quote\/create$/],
];
/** Redundante con la lista blanca a propósito: si alguien la ensancha, esto sigue cerrando. */
export const PROHIBIDAS = [/enviar/i, /factur/i, /invoice/i, /convertir/i, /cobro/i, /pago/i, /payment/i, /stripe/i, /onboarding/i, /flag/i, /borrar/i];

export class NoPude extends Error {}

/** Grita si `metodo ruta` no es una de las escrituras admitidas. Devuelve la URL. */
export function escrituraPermitida(metodo, ruta) {
  const m = String(metodo).toUpperCase();
  const u = urlDelPanel(ruta);
  if (u.search || u.hash) throw new Rechazo(`🔴 ESCRITURA RECHAZADA: ${m} ${ruta} lleva query o fragmento.`);
  if (PROHIBIDAS.some((re) => re.test(u.pathname))) {
    throw new Rechazo(`🔴 ESCRITURA PROHIBIDA: ${m} ${u.pathname} (envíos, facturas, cobros, onboarding, flags y borrados no entran nunca).`);
  }
  if (!ESCRITURAS.some(([mm, re]) => mm === m && re.test(u.pathname))) {
    throw new Rechazo(`🔴 ESCRITURA RECHAZADA: ${m} ${u.pathname} no está en la lista blanca de SCRUM-1268.`);
  }
  return u;
}

/** 2xx y JSON, o `NoPude` con el estado y el principio del cuerpo. */
export async function leerJSON(res, que) {
  const texto = await res.text();
  if (res.status < 200 || res.status >= 300) {
    throw new NoPude(`${que} → ${res.status}${res.status === 401 ? ' (la sesión caducó: repite el login)' : ''}. ${String(texto).slice(0, 500)}`);
  }
  try { return JSON.parse(texto); } catch { throw new NoPude(`${que} → ${res.status} pero el cuerpo no es JSON`); }
}

const cuentasVistas = new WeakSet();

/** El cerrojo: lo que dice el SERVIDOR de la sesión. Devuelve la prueba que `escritura` exige. */
export async function comprobarCuentaQA(fetchFn, cookie) {
  const me = await leerJSON(await peticion(fetchFn, 'GET', '/admin/me', { cookie }), 'GET /admin/me');
  if (me.merchantId !== MERCHANT_QA || me.isOwner !== true) {
    throw new Rechazo(`🔴 NO ES LA CUENTA QA: el servidor dice merchantId=${me.merchantId} · isOwner=${me.isOwner}. `
      + `Sólo se escribe en el merchant ${MERCHANT_QA} y como owner. No se ha escrito nada.`);
  }
  const cuenta = { merchantId: me.merchantId, nombre: me.merchantName, cookie };
  cuentasVistas.add(cuenta);
  return cuenta;
}

/** El único punto de salida para ESCRIBIR. */
export async function escritura(fetchFn, metodo, ruta, { cuenta, cuerpo = {} } = {}) {
  const u = escrituraPermitida(metodo, ruta);
  if (!cuenta || !cuentasVistas.has(cuenta)) throw new Rechazo('🔴 escritura sin una cuenta QA comprobada contra el servidor: no sale.');
  return fetchFn(u.href, {
    method: String(metodo).toUpperCase(),
    headers: { accept: 'application/json', 'content-type': 'application/json', cookie: cuenta.cookie },
    body: JSON.stringify(cuerpo),
    redirect: 'manual',
  });
}

const corto = (v) => { const s = JSON.stringify(v); return s === undefined ? 'undefined' : s.length > 120 ? s.slice(0, 117) + '…' : s; };
const igual = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
const lista = (x, que) => { if (!Array.isArray(x)) throw new NoPude(`${que} no devolvió una lista`); return x; };

/** El caso de prueba completo, sin duplicar. Devuelve las líneas del informe. */
export async function sembrar(fetchFn, cookie) {
  const cuenta = await comprobarCuentaQA(fetchFn, cookie);
  const lineas = [`cuenta comprobada en el servidor: merchant ${cuenta.merchantId} («${cuenta.nombre}»), owner`];
  const leer = async (ruta) => leerJSON(await peticion(fetchFn, 'GET', ruta, { cookie }), `GET ${ruta}`);
  const escribir = async (m, ruta, cuerpo) => leerJSON(await escritura(fetchFn, m, ruta, { cuenta, cuerpo }), `${m} ${ruta}`);

  // ① cliente: por nombre EXACTO (la búsqueda del panel es por subcadena)
  const clientes = lista(await leer(`/admin/customers?search=${encodeURIComponent(NOMBRE_CLIENTE_QA)}`), 'la búsqueda de clientes')
    .filter((c) => c && c.name === NOMBRE_CLIENTE_QA);
  if (clientes.length > 1) throw new NoPude(`hay ${clientes.length} clientes «${NOMBRE_CLIENTE_QA}» (ids ${clientes.map((c) => c.id).join(', ')}): no elijo uno a ciegas.`);
  let cliente = clientes[0];
  const clienteNuevo = !cliente;
  if (!cliente) {
    cliente = await escribir('POST', '/admin/customers', {
      name: NOMBRE_CLIENTE_QA, mobile: MOVIL_CLIENTE_QA, notes: 'Datos de prueba creados por scripts/qa/sembrar-qa.mjs (SCRUM-1268).',
    });
  }
  if (!Number.isInteger(cliente.id)) throw new NoPude('el cliente no trae id');
  lineas.push(`cliente   #${cliente.id} «${NOMBRE_CLIENTE_QA}» · ${clienteNuevo ? 'CREADO' : 'ya estaba'}`);

  // ② trabajo
  const trabajos = lista(await leer('/admin/jobs'), 'la lista de trabajos');
  const suyos = trabajos.filter((j) => j && j.customer && j.customer.id === cliente.id && j.tituloPropio === TITULO_TRABAJO_QA);
  if (suyos.length > 1) throw new NoPude(`hay ${suyos.length} trabajos «${TITULO_TRABAJO_QA}» de ese cliente: no elijo uno a ciegas.`);
  if (!suyos.length && trabajos.length >= LIMITE_LISTA) throw new NoPude(`la lista de trabajos llega llena (${trabajos.length}): no puedo afirmar que el trabajo no exista.`);
  let trabajo = suyos[0];
  const trabajoNuevo = !trabajo;
  if (!trabajo) trabajo = await escribir('POST', '/admin/jobs', { customerId: cliente.id, titulo: TITULO_TRABAJO_QA });
  if (!Number.isInteger(trabajo.id)) throw new NoPude('el trabajo no trae id');
  lineas.push(`trabajo   #${trabajo.id} «${TITULO_TRABAJO_QA}» · ${trabajoNuevo ? 'CREADO' : 'ya estaba'}`);

  // ③ albarán con clave fija; se emite SOLO si no lo está
  let albaran = await escribir('POST', `/admin/jobs/${trabajo.id}/albaranes`, {
    claveIdempotencia: claveAlbaranQA(trabajo.id), notas: 'Albarán de pruebas QA (SCRUM-1268).',
  });
  if (albaran.idempotencia !== 'aplicada' && albaran.idempotencia !== 'repetida') {
    throw new NoPude(`el servidor no aplicó la clave de idempotencia (idempotencia=${albaran.idempotencia}): no se emite nada.`);
  }
  if (!Number.isInteger(albaran.id)) throw new NoPude('el albarán no trae id');
  const albaranNuevo = albaran.idempotencia === 'aplicada';
  let emitidoAhora = false;
  if (albaran.estado !== 'emitido') {
    albaran = await escribir('POST', `/admin/albaranes/${albaran.id}/emitir`, {});
    emitidoAhora = true;
  }
  if (albaran.estado !== 'emitido') throw new NoPude(`el albarán #${albaran.id} no quedó emitido (estado=${albaran.estado}).`);
  lineas.push(`albarán   #${albaran.id} ${albaran.numero ?? ''} · ${albaranNuevo ? 'CREADO' : 'ya estaba'} · ${emitidoAhora ? 'EMITIDO ahora' : 'ya estaba emitido (no se repite)'}`);

  // ④ parte en borrador
  const r = await leer('/admin/partes');
  const partes = lista(r && r.partes, 'la lista de partes');
  const borradores = partes.filter((p) => p && p.jobId === trabajo.id && p.estado === 'borrador');
  if (!borradores.length && partes.length >= LIMITE_LISTA) throw new NoPude(`la lista de partes llega llena (${partes.length}): no puedo afirmar que el parte no exista.`);
  let parte = borradores[0];
  const parteNuevo = !parte;
  if (!parte) parte = await escribir('POST', '/admin/partes', { jobId: trabajo.id });
  if (!Number.isInteger(parte.id) || parte.estado !== 'borrador') throw new NoPude(`el parte no quedó en borrador (id=${parte.id}, estado=${parte.estado}).`);
  lineas.push(`parte     #${parte.id} ${parte.numero ?? ''} · borrador · ${parteNuevo ? 'CREADO' : 'ya estaba'}`);

  // ⑤ presupuesto en borrador con cabecera y pie. El servidor NO deduplica: se busca antes por la
  // marca, en el DETALLE (la lista no trae los textos), sólo entre los del cliente QA.
  const delCliente = lista(await leer(`/admin/quotes?search=${encodeURIComponent(NOMBRE_CLIENTE_QA)}`), 'la lista de presupuestos');
  const candidatos = delCliente.filter((q) => q && q.customerName === NOMBRE_CLIENTE_QA);
  const conMarca = [];
  for (const q of candidatos) {
    const d = await leer(`/admin/quotes/${q.id}`);
    const textos = `${d.docHeaderText ?? ''}\n${d.docFooterText ?? ''}`;
    if (d.customer && d.customer.id === cliente.id && textos.includes(MARCA_PRESUPUESTO_QA)) conMarca.push(d);
  }
  if (conMarca.length > 1) throw new NoPude(`hay ${conMarca.length} presupuestos con la marca ${MARCA_PRESUPUESTO_QA} (ids ${conMarca.map((q) => q.id).join(', ')}): no elijo uno a ciegas.`);
  if (!conMarca.length && delCliente.length >= TOPE_LISTA_PRESUPUESTOS) throw new NoPude(`la lista de presupuestos llega llena (${delCliente.length}): no puedo afirmar que el presupuesto no exista.`);
  let presupuesto = conMarca[0];
  const presupuestoNuevo = !presupuesto;
  if (!presupuesto) {
    const creado = await escribir('POST', '/quote/create', {
      merchant_id: cuenta.merchantId, customer_id: cliente.id, currency: 'EUR',
      // El IVA va en FRACCIÓN (0.21), no en porcentaje: lo exige el esquema desde SCRUM-217 (SCRUM-1268c).
      lines: [{ concept: 'Servicio de pruebas QA', qty: 1, price: 10, tax: 0.21 }],
      docHeaderText: CABECERA_QA, docFooterText: PIE_QA,
    });
    if (!Number.isInteger(creado.id)) throw new NoPude('el presupuesto no trae id');
    // Se RELEE: que el alta devuelva 201 no dice que la cabecera y el pie se guardaran.
    presupuesto = await leer(`/admin/quotes/${creado.id}`);
    if (presupuesto.docHeaderText !== CABECERA_QA || presupuesto.docFooterText !== PIE_QA) {
      throw new NoPude(`presupuesto #${creado.id} creado, pero al releerlo la cabecera o el pie NO son los enviados: `
        + `cabecera=${corto(presupuesto.docHeaderText)} · pie=${corto(presupuesto.docFooterText)}.`);
    }
  }
  if (presupuesto.status !== 'draft') throw new NoPude(`el presupuesto #${presupuesto.id} no está en borrador (status=${presupuesto.status}).`);
  const conTextos = presupuesto.docHeaderText && presupuesto.docFooterText ? 'con cabecera y pie' : '⚠️ le falta la cabecera o el pie (alguien los editó)';
  lineas.push(`presupuesto #${presupuesto.id} nº ${presupuesto.number ?? '?'} · borrador · ${conTextos} · ${presupuestoNuevo ? 'CREADO' : 'ya estaba'}`);
  return lineas;
}

/** Comprueba los valores del perfil ANTES de tocar la red. */
export function validarPerfil(valores) {
  if (!valores || typeof valores !== 'object' || Array.isArray(valores) || !Object.keys(valores).length) {
    throw new Rechazo('perfil: el fichero tiene que ser un objeto JSON con al menos un campo.');
  }
  const fuera = Object.keys(valores).filter((k) => PERFIL_EXCLUIDOS.includes(k));
  if (fuera.length) throw new Rechazo(`🔴 perfil: ${fuera.join(', ')} no se tocan (URL pública y serie de numeración). No se ha escrito nada.`);
  return valores;
}

/** Guarda el perfil con `valores` y lo RELEE. Nunca imprime la respuesta cruda del PUT. */
export async function guardarPerfil(fetchFn, cookie, valores) {
  validarPerfil(valores);
  const cuenta = await comprobarCuentaQA(fetchFn, cookie);
  const leer = async () => leerJSON(await peticion(fetchFn, 'GET', '/admin/merchant', { cookie }), 'GET /admin/merchant');
  const antes = await leer();
  await leerJSON(await escritura(fetchFn, 'PUT', '/admin/merchant', { cuenta, cuerpo: valores }), 'PUT /admin/merchant');
  const despues = await leer();
  const lineas = [`cuenta comprobada en el servidor: merchant ${cuenta.merchantId}, owner · PUT /admin/merchant hecho · lo de abajo es la RELECTURA`];
  let distintos = 0;
  for (const [k, v] of Object.entries(valores)) {
    const ok = igual(v, despues[k]);
    if (!ok) distintos++;
    lineas.push(`${ok ? '  OK        ' : '🔴 DISTINTO '} ${k}: enviado ${corto(v)} · releído ${corto(despues[k])}`);
  }
  const sinEnviar = Object.keys({ ...antes, ...despues }).filter((k) => !(k in valores) && !igual(antes[k], despues[k]));
  for (const k of sinEnviar) lineas.push(`🔴 CAMBIÓ SIN ENVIARSE ${k}: antes ${corto(antes[k])} · después ${corto(despues[k])}`);
  lineas.push(`resumen: ${Object.keys(valores).length} enviados · ${distintos} no se releen igual · ${sinEnviar.length} cambiaron sin enviarse`);
  return lineas;
}

/**
 * La herramienta entera. La CLI la llama con la ruta fija y el `fetch` real; los tests, con una
 * sesión temporal y un `fetch` falso. Devuelve el código de salida; escribe por `out`/`err`.
 */
export async function ejecutar(argv, { fetchFn = globalThis.fetch, rutaSesion = RUTA_SESION, out = (s) => process.stdout.write(s + '\n'), err = (s) => process.stderr.write(s + '\n') } = {}) {
  const [orden, arg] = argv;
  try {
    if (orden !== 'sembrar' && orden !== 'perfil') throw new Rechazo(`orden «${orden ?? ''}» desconocida. Uso: sembrar · perfil <valores.json>`);
    let valores = null;
    if (orden === 'perfil') {
      if (!arg) throw new Rechazo('falta el fichero: perfil <valores.json>');
      try { valores = JSON.parse(fs.readFileSync(arg, 'utf8').replace(/^﻿/, '')); } catch (e) { throw new Rechazo(`perfil: no puedo leer ${arg} como JSON (${e.message})`); }
      validarPerfil(valores);
    }
    let cookie = '';
    try { cookie = fs.readFileSync(rutaSesion, 'utf8').trim(); } catch { cookie = ''; }
    if (!cookie) {
      err(`CIEGO — no hay sesión guardada en ${rutaSesion}. Entra antes con: node scripts/qa/sesion-panel.mjs login luisdragonball+qa@gmail.com`);
      return 2;
    }
    const lineas = orden === 'sembrar' ? await sembrar(fetchFn, cookie) : await guardarPerfil(fetchFn, cookie, valores);
    for (const l of lineas) out(l);
    return 0;
  } catch (e) {
    if (e instanceof Rechazo) { err(e.message); return 3; }
    if (e instanceof NoPude) { err(`NO PUDE: ${e.message} Lo hecho hasta aquí queda como estaba; repetir la orden no duplica.`); return 1; }
    err(`NO PUDE: ${e && e.message ? e.message : e}`);
    return 1;
  }
}

// ── CLI ──────────────────────────────────────────────────────────────────────────────────────────
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = await ejecutar(process.argv.slice(2));
}
