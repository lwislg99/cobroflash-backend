// scripts/qa/sembrar-albaranes.mjs — SCRUM-1367b
//
// ═════════════════════════════════════════════════════════════════════════════════════════════
// 🔴 ESTO NO SE HA EJECUTADO NUNCA CONTRA PRODUCCIÓN, Y NO SE EJECUTA HASTA QUE EL FUNDADOR DIGA
//    CON QUÉ REGLA. Es la CAPACIDAD de crear los dos casos de ALBARÁN que le faltan a la cuenta QA,
//    probada sin red (`tests/scrum1367b-sembrar-albaranes.test.mjs`). Vive APARTE de
//    `sembrar-qa.mjs` y de `sembrar-casos.mjs` a propósito: FIRMAR un albarán es irreversible y es
//    una escritura que ninguno de los dos cubre. Tres ficheros, tres permisos: el fundador puede
//    autorizar uno sin los otros.
//
//   node scripts/qa/sembrar-albaranes.mjs diez-fotos   ⑤ un albarán EMITIDO con líneas (una con decimales) y 10 fotos
//   node scripts/qa/sembrar-albaranes.mjs firmado      ⑥ un albarán FIRMADO en el sitio, con una firma DE PRUEBA
//   node scripts/qa/sembrar-albaranes.mjs sin-movil    ⑦ un albarán EMITIDO de un cliente SIN móvil ni teléfono (SCRUM-1367c)
//
// Los huecos, medidos el 2-oct-2026 por S2 en yaqu.app (SCRUM-1367, comentario 18143): no se pudo
// ver «foto» con diez ya subidas (SCRUM-1302), ni las cantidades «2,5» y «12.345» en el resumen del
// pad (SCRUM-743), ni la caja de un albarán FIRMADO (SCRUM-1360), ni firmar lo ya subido.
//
// Cada caso tiene SU albarán, con su clave de idempotencia fija: el de las fotos no se firma (un
// firmado no admite fotos) y el de base de `sembrar-qa.mjs` no se toca. Los cerrojos son los de
// `sembrar-qa.mjs`, no una copia: la cuenta se comprueba contra el SERVIDOR con SU
// `comprobarCuentaQA` (merchant 46 y owner), y crear y emitir salen por SU `escritura`. Lo ÚNICO
// que este fichero añade es subir una foto y firmar: `ESCRITURAS_DE_ALBARAN`.
//
// LO QUE HACE Y LO QUE NO, leído en `src/` el 2-oct-2026 (no visto en producción):
//   ⑤ Emitir gasta un número ALB y no se deshace. Subir dos veces la misma foto devuelve la primera
//      (`fotoYaSubida`): repetir la orden no ocupa plazas. Las diez son cuadrados lisos de colores.
//   ⑥ 🔴 FIRMAR NO SE DESHACE: el albarán queda congelado. La firma en el sitio no envía nada a
//      nadie (enviar es otra ruta, y las de envío siguen prohibidas). El firmante es un nombre que
//      dice que es de prueba. ⚠️ La razón social y el NIF del merchant entran en el hash de la
//      firma: por eso la orden NO firma si el perfil fiscal está vacío (se rellenaría después y el
//      albarán dejaría de verificar). Antes: `sembrar-casos.mjs perfil-fiscal`.
//   ⑦ El cliente sin móvil es SUYO (nombre fijo), con su Trabajo y su albarán: no se apoya en el
//      cliente #84 que otra sesión creó a mano. Si alguien le pone un número, la orden se NIEGA
//      antes de escribir: ya no sería el caso. No añade ninguna escritura a la lista: cliente,
//      trabajo, albarán y emitir salen por la `escritura` de `sembrar-qa.mjs`.
//   Ninguna de las tres emite factura, cobra ni envía. «Ninguna factura en la cuenta QA» sigue sin
//   caso: emitirla es el camino fiscal y no entra por aquí nunca.
//
// SALIDAS: las de `sembrar-qa.mjs` — 0 hecho · 1 NO PUDE · 2 CIEGO: sin sesión · 3 rechazado.
// ═════════════════════════════════════════════════════════════════════════════════════════════
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { peticion, urlDelPanel, Rechazo, RUTA_SESION } from './sesion-panel.mjs';
import { comprobarCuentaQA, escritura, leerJSON, NoPude, PROHIBIDAS, TITULO_TRABAJO_QA } from './sembrar-qa.mjs';

export const FOTOS_POR_ALBARAN = 10; // `FOTOS_MAX_POR_ALBARAN` del servidor; un test los compara
export const claveAlbaranFotos = (jobId) => `qa-1367-albaran-diez-fotos-trabajo-${jobId}`;
export const claveAlbaranFirmado = (jobId) => `qa-1367-albaran-firmado-trabajo-${jobId}`;
/** Una cantidad con decimales y otra con miles: lo que SCRUM-743 no pudo ver en el pad. */
export const LINEAS_QA = [
  { concepto: 'Tubo de pruebas QA', cantidad: 2.5, unidad: 'm' },
  { concepto: 'Tornillos de pruebas QA', cantidad: 12345, unidad: 'ud' },
];
/** ⑦ El cliente que NO tiene a dónde mandarle nada: ni móvil ni teléfono (SCRUM-1302). */
// Ninguno de los dos nombres CONTIENE al del sembrado base: la búsqueda del panel es por subcadena.
export const NOMBRE_CLIENTE_SIN_MOVIL = 'Cliente sin móvil de pruebas QA';
export const TITULO_TRABAJO_SIN_MOVIL = 'Trabajo de un cliente sin móvil, de pruebas QA';
export const claveAlbaranSinMovil = (jobId) => `qa-1367-albaran-cliente-sin-movil-trabajo-${jobId}`;
const LIMITE_LISTA = 200; // las listas del panel cortan en 200: si llega llena, «no está» no se sabe
/** 🔴 No es nadie, y lo dice. Si lo ves firmando en una cuenta que no es la QA, es un error de cuenta. */
export const FIRMANTE_QA = 'FIRMA DE PRUEBA QA - NO ES UN CLIENTE REAL';

/** Lo ÚNICO que este fichero añade a lo que `sembrar-qa.mjs` ya deja escribir. */
export const ESCRITURAS_DE_ALBARAN = [
  ['POST', /^\/admin\/albaranes\/\d+\/fotos$/],
  ['POST', /^\/admin\/albaranes\/\d+\/firmar$/],
];

// ── Imágenes de prueba: PNG de verdad (el PDF del albarán las incrusta), lisos y distintos ───────
const TABLA_CRC = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = TABLA_CRC[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function trozo(tipo, datos) {
  const cuerpo = Buffer.concat([Buffer.from(tipo, 'ascii'), datos]);
  const largo = Buffer.alloc(4); largo.writeUInt32BE(datos.length);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(cuerpo));
  return Buffer.concat([largo, cuerpo, crc]);
}
/** Un PNG RGB de `lado`×`lado` de un solo color. */
export function pngLiso(r, g, b, lado = 16) {
  const cabecera = Buffer.alloc(13);
  cabecera.writeUInt32BE(lado, 0); cabecera.writeUInt32BE(lado, 4);
  cabecera[8] = 8; cabecera[9] = 2; // 8 bits por canal, RGB
  const fila = Buffer.concat([Buffer.from([0]), Buffer.alloc(lado * 3).map((_, i) => [r, g, b][i % 3])]);
  const pixeles = Buffer.concat(Array.from({ length: lado }, () => fila));
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    trozo('IHDR', cabecera), trozo('IDAT', zlib.deflateSync(pixeles)), trozo('IEND', Buffer.alloc(0)),
  ]);
}
/** Diez fotos DISTINTAS (el servidor deduplica por bytes): un color por foto. */
export const FOTOS_QA = Array.from({ length: FOTOS_POR_ALBARAN }, (_, i) => pngLiso(20 + i * 23, 200 - i * 17, 90 + i * 11));
/** La «firma»: un cuadrado gris. No imita el trazo de nadie. */
export const FIRMA_QA = `data:image/png;base64,${pngLiso(120, 120, 120, 32).toString('base64')}`;

const cuentasVistas = new WeakSet();
async function cuentaQA(fetchFn, cookie) {
  const cuenta = await comprobarCuentaQA(fetchFn, cookie);
  cuentasVistas.add(cuenta);
  return cuenta;
}

/** Grita si `metodo ruta` no es una escritura de albarán. Las prohibidas de `sembrar-qa` mandan igual. */
export function escrituraDeAlbaranPermitida(metodo, ruta) {
  const m = String(metodo).toUpperCase();
  const u = urlDelPanel(ruta);
  if (u.search || u.hash) throw new Rechazo(`🔴 ESCRITURA RECHAZADA: ${m} ${ruta} lleva query o fragmento.`);
  if (PROHIBIDAS.some((re) => re.test(u.pathname))) throw new Rechazo(`🔴 ESCRITURA PROHIBIDA: ${m} ${u.pathname}.`);
  if (!ESCRITURAS_DE_ALBARAN.some(([mm, re]) => mm === m && re.test(u.pathname))) {
    throw new Rechazo(`🔴 ESCRITURA RECHAZADA: ${m} ${u.pathname} no está en la lista de albaranes de SCRUM-1367b.`);
  }
  return u;
}

async function escrituraDeAlbaran(fetchFn, metodo, ruta, { cuenta, cuerpo = {} } = {}) {
  const u = escrituraDeAlbaranPermitida(metodo, ruta);
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

/** El Trabajo QA, que tiene que existir ya: estos casos se montan SOBRE el sembrado base. */
async function trabajoQA(leer) {
  const suyos = lista(await leer('/admin/jobs'), 'la lista de trabajos').filter((j) => j && j.tituloPropio === TITULO_TRABAJO_QA);
  if (suyos.length !== 1) {
    throw new NoPude(`hay ${suyos.length} trabajos «${TITULO_TRABAJO_QA}» y hace falta exactamente uno. `
      + 'Si no hay ninguno, corre antes `node scripts/qa/sembrar-qa.mjs sembrar`.');
  }
  return suyos[0];
}

/**
 * El albarán del caso, por su clave fija (el servidor devuelve el mismo si ya existe), y EMITIDO.
 * `admiteFirmado`: el de la firma puede estar ya firmado; el de las fotos, no.
 */
async function albaranDelCaso(fetchFn, cuenta, trabajo, clave, notas, { admiteFirmado }) {
  let albaran = await leerJSON(await escritura(fetchFn, 'POST', `/admin/jobs/${trabajo.id}/albaranes`, {
    cuenta, cuerpo: { claveIdempotencia: clave, notas, lineas: LINEAS_QA },
  }), `POST /admin/jobs/${trabajo.id}/albaranes`);
  if (albaran.idempotencia !== 'aplicada' && albaran.idempotencia !== 'repetida') {
    throw new NoPude(`el servidor no aplicó la clave de idempotencia (idempotencia=${albaran.idempotencia}): no se emite nada.`);
  }
  if (!Number.isInteger(albaran.id)) throw new NoPude('el albarán no trae id');
  const nuevo = albaran.idempotencia === 'aplicada';
  if (albaran.estado === 'firmado') {
    if (!admiteFirmado) throw new NoPude(`el albarán #${albaran.id} de este caso está FIRMADO: congelado, ya no admite fotos. Alguien lo firmó a mano.`);
    return { albaran, nuevo, emitidoAhora: false };
  }
  let emitidoAhora = false;
  if (albaran.estado !== 'emitido') {
    albaran = await leerJSON(await escritura(fetchFn, 'POST', `/admin/albaranes/${albaran.id}/emitir`, { cuenta, cuerpo: {} }), `POST /admin/albaranes/${albaran.id}/emitir`);
    emitidoAhora = true;
  }
  if (albaran.estado !== 'emitido') throw new NoPude(`el albarán #${albaran.id} no quedó emitido (estado=${albaran.estado}).`);
  return { albaran, nuevo, emitidoAhora };
}

const fraseAlbaran = ({ albaran, nuevo, emitidoAhora }) => `albarán   #${albaran.id} ${albaran.numero ?? ''} · ${nuevo ? 'CREADO' : 'ya estaba'} · ${emitidoAhora ? 'EMITIDO ahora' : 'ya estaba emitido (no se repite)'}`;

/** ⑤ Un albarán emitido, con sus líneas y exactamente diez fotos, contadas al releer. */
export async function casoDiezFotos(fetchFn, cookie) {
  const cuenta = await cuentaQA(fetchFn, cookie);
  const leer = lector(fetchFn, cookie);
  const trabajo = await trabajoQA(leer);
  const caso = await albaranDelCaso(fetchFn, cuenta, trabajo, claveAlbaranFotos(trabajo.id),
    'Albarán de pruebas QA con diez fotos (SCRUM-1367). Las fotos son cuadrados de colores.', { admiteFirmado: false });
  const { albaran } = caso;
  const rutaFotos = `/admin/albaranes/${albaran.id}/fotos`;
  const antes = lista(await leer(rutaFotos), 'la lista de fotos').length;
  let hay = antes;
  let subidas = 0;
  let repetidas = 0;
  for (const foto of FOTOS_QA) {
    if (hay >= FOTOS_POR_ALBARAN) break; // no se manda una foto que el servidor va a rechazar por tope
    const r = await leerJSON(await escrituraDeAlbaran(fetchFn, 'POST', rutaFotos, {
      cuenta, cuerpo: { mime: 'image/png', data: foto.toString('base64') },
    }), `POST ${rutaFotos}`);
    if (r.already === true) { repetidas++; continue; }
    if (!Number.isInteger(r.attachmentId)) throw new NoPude(`una foto subida no trae id. Subidas hasta aquí: ${subidas}.`);
    subidas++; hay++;
  }
  // Se RELEE: que cada subida diga 201 no dice cuántas hay.
  const despues = lista(await leer(rutaFotos), 'la lista de fotos').length;
  const lineas = [
    `cuenta comprobada en el servidor: merchant ${cuenta.merchantId} («${cuenta.nombre}»), owner`,
    fraseAlbaran(caso),
    `fotos     había ${antes} · subidas ahora ${subidas} · ya estaban (no ocupan plaza) ${repetidas} · al RELEER hay ${despues}`,
  ];
  if (despues !== FOTOS_POR_ALBARAN) {
    throw new NoPude(`el albarán #${albaran.id} tiene ${despues} fotos al releer y hacen falta exactamente ${FOTOS_POR_ALBARAN}. El caso NO está completo.\n${lineas.join('\n')}`);
  }
  lineas.push('no se ha firmado, facturado, cobrado ni enviado nada');
  return lineas;
}

/** ⑥ Un albarán FIRMADO en el sitio con la firma de prueba. Irreversible, y lo dice. */
export async function casoFirmado(fetchFn, cookie) {
  const cuenta = await cuentaQA(fetchFn, cookie);
  const leer = lector(fetchFn, cookie);
  // El perfil fiscal entra en el hash de la firma: firmar con él vacío es firmar algo que dejará
  // de verificar el día que se rellene. Se mira ANTES de crear ni emitir nada.
  const merchant = await leer('/admin/merchant');
  const vacios = ['legalName', 'taxId'].filter((k) => merchant[k] == null || String(merchant[k]).trim() === '');
  if (vacios.length) {
    throw new NoPude(`el perfil fiscal de la cuenta tiene vacío ${vacios.join(' y ')}, que entra en el hash de la firma: `
      + 'un albarán firmado ahora dejaría de verificar al rellenarlo. Corre antes `node scripts/qa/sembrar-casos.mjs perfil-fiscal`. No se ha escrito nada.');
  }
  const trabajo = await trabajoQA(leer);
  const caso = await albaranDelCaso(fetchFn, cuenta, trabajo, claveAlbaranFirmado(trabajo.id),
    'Albarán de pruebas QA firmado con una firma DE PRUEBA (SCRUM-1367). Nadie lo ha recibido.', { admiteFirmado: true });
  let firmadoAhora = false;
  if (caso.albaran.estado !== 'firmado') {
    await leerJSON(await escrituraDeAlbaran(fetchFn, 'POST', `/admin/albaranes/${caso.albaran.id}/firmar`, {
      cuenta, cuerpo: { signatureData: FIRMA_QA, firmadoPorNombre: FIRMANTE_QA },
    }), `POST /admin/albaranes/${caso.albaran.id}/firmar`);
    firmadoAhora = true;
  }
  // Se RELEE: el estado y el firmante que quedaron, no los que se mandaron.
  const releido = await leer(`/admin/albaranes/${caso.albaran.id}`);
  if (releido.estado !== 'firmado') throw new NoPude(`el albarán #${caso.albaran.id} no quedó firmado (estado=${releido.estado}).`);
  const lineas = [
    `cuenta comprobada en el servidor: merchant ${cuenta.merchantId} («${cuenta.nombre}»), owner`,
    fraseAlbaran(caso),
    `firma     ${firmadoAhora ? 'FIRMADO ahora' : 'ya estaba firmado (no se repite)'} · firmante al releer: «${releido.firmadoPorNombre ?? ''}»`,
  ];
  if (releido.firmadoPorNombre !== FIRMANTE_QA) {
    lineas.push(`⚠️ el firmante NO es el de prueba («${FIRMANTE_QA}»): este albarán lo firmó otra mano`);
  }
  lineas.push('🔴 un albarán firmado queda CONGELADO: no se deshace, no admite fotos ni cambios');
  lineas.push('no se ha facturado, cobrado ni enviado nada');
  return lineas;
}

const sinNumero = (v) => v == null || String(v).trim() === '';
const numerosDe = (c) => ['mobile', 'phone'].filter((k) => !sinNumero(c[k]));

/** ⑦ Un albarán emitido de un cliente sin móvil ni teléfono. Lo que queda se RELEE del servidor. */
export async function casoSinMovil(fetchFn, cookie) {
  const cuenta = await cuentaQA(fetchFn, cookie);
  const leer = lector(fetchFn, cookie);
  const escribir = async (ruta, cuerpo) => leerJSON(await escritura(fetchFn, 'POST', ruta, { cuenta, cuerpo }), `POST ${ruta}`);

  // El cliente, por nombre EXACTO (la búsqueda del panel es por subcadena).
  const hallados = lista(await leer(`/admin/customers?search=${encodeURIComponent(NOMBRE_CLIENTE_SIN_MOVIL)}`), 'la búsqueda de clientes');
  const suyos = hallados.filter((c) => c && c.name === NOMBRE_CLIENTE_SIN_MOVIL);
  if (suyos.length > 1) throw new NoPude(`hay ${suyos.length} clientes «${NOMBRE_CLIENTE_SIN_MOVIL}» (ids ${suyos.map((c) => c.id).join(', ')}): no elijo uno a ciegas.`);
  if (!suyos.length && hallados.length >= LIMITE_LISTA) throw new NoPude(`la búsqueda de clientes llega llena (${hallados.length}): no puedo afirmar que el cliente no exista.`);
  let cliente = suyos[0];
  const clienteNuevo = !cliente;
  // Se mira ANTES de crear trabajo ni albarán: un cliente con número ya no es este caso.
  if (cliente && numerosDe(cliente).length) {
    throw new NoPude(`el cliente #${cliente.id} «${NOMBRE_CLIENTE_SIN_MOVIL}» TIENE ${numerosDe(cliente).join(' y ')}: alguien se lo puso y ya no es el caso «sin móvil». No se ha escrito nada.`);
  }
  if (!cliente) {
    cliente = await escribir('/admin/customers', {
      name: NOMBRE_CLIENTE_SIN_MOVIL, notes: 'Cliente de prueba SIN móvil ni teléfono, a propósito (scripts/qa/sembrar-albaranes.mjs, SCRUM-1367c). No le pongas número.',
    });
  }
  if (!Number.isInteger(cliente.id)) throw new NoPude('el cliente no trae id');

  const trabajos = lista(await leer('/admin/jobs'), 'la lista de trabajos');
  const delCliente = trabajos.filter((j) => j && j.customer && j.customer.id === cliente.id && j.tituloPropio === TITULO_TRABAJO_SIN_MOVIL);
  if (delCliente.length > 1) throw new NoPude(`hay ${delCliente.length} trabajos «${TITULO_TRABAJO_SIN_MOVIL}» de ese cliente: no elijo uno a ciegas.`);
  if (!delCliente.length && trabajos.length >= LIMITE_LISTA) throw new NoPude(`la lista de trabajos llega llena (${trabajos.length}): no puedo afirmar que el trabajo no exista.`);
  let trabajo = delCliente[0];
  const trabajoNuevo = !trabajo;
  if (!trabajo) trabajo = await escribir('/admin/jobs', { customerId: cliente.id, titulo: TITULO_TRABAJO_SIN_MOVIL });
  if (!Number.isInteger(trabajo.id)) throw new NoPude('el trabajo no trae id');

  const caso = await albaranDelCaso(fetchFn, cuenta, trabajo, claveAlbaranSinMovil(trabajo.id),
    'Albarán de pruebas QA de un cliente sin móvil (SCRUM-1367). Nadie lo ha recibido.', { admiteFirmado: true });

  // Se RELEE el cliente: que el alta no llevara número no dice que haya quedado sin él.
  const releido = await leer(`/admin/customers/${cliente.id}`);
  const lineas = [
    `cuenta comprobada en el servidor: merchant ${cuenta.merchantId} («${cuenta.nombre}»), owner`,
    `cliente   #${cliente.id} «${NOMBRE_CLIENTE_SIN_MOVIL}» · ${clienteNuevo ? 'CREADO' : 'ya estaba'}`,
    `trabajo   #${trabajo.id} «${TITULO_TRABAJO_SIN_MOVIL}» · ${trabajoNuevo ? 'CREADO' : 'ya estaba'}`,
    fraseAlbaran(caso),
  ];
  if (releido.id !== cliente.id || numerosDe(releido).length) {
    const que = releido.id !== cliente.id ? 'no es el que se pidió' : `tiene ${numerosDe(releido).join(' y ')}`;
    throw new NoPude(`al RELEER, el cliente #${cliente.id} ${que}. El caso NO está completo.\n${lineas.join('\n')}`);
  }
  lineas.push('cliente al RELEER: sin móvil y sin teléfono');
  if (caso.albaran.estado === 'firmado') lineas.push('⚠️ el albarán está FIRMADO: lo firmó otra mano; este caso lo deja sólo emitido');
  lineas.push('no se ha firmado, facturado, cobrado ni enviado nada');
  return lineas;
}

export async function ejecutar(argv, { fetchFn = globalThis.fetch, rutaSesion = RUTA_SESION, out = (s) => process.stdout.write(s + '\n'), err = (s) => process.stderr.write(s + '\n') } = {}) {
  const [orden, ...resto] = argv;
  try {
    const ORDENES = ['diez-fotos', 'firmado', 'sin-movil'];
    if (!ORDENES.includes(orden)) throw new Rechazo(`orden «${orden ?? ''}» desconocida. Uso: ${ORDENES.join(' · ')}`);
    if (resto.length) throw new Rechazo(`argumentos de más: ${resto.join(' ')}`);
    let cookie = '';
    try { cookie = fs.readFileSync(rutaSesion, 'utf8').trim(); } catch { cookie = ''; }
    if (!cookie) {
      err(`CIEGO — no hay sesión guardada en ${rutaSesion}. Entra antes con: node scripts/qa/sesion-panel.mjs login luisdragonball+qa@gmail.com`);
      return 2;
    }
    const CASOS = { 'diez-fotos': casoDiezFotos, firmado: casoFirmado, 'sin-movil': casoSinMovil };
    const lineas = await CASOS[orden](fetchFn, cookie);
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
