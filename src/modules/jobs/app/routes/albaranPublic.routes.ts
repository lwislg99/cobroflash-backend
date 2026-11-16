// src/modules/jobs/app/routes/albaranPublic.routes.ts — SCRUM-49 (ALBARAN-3)
// Página PÚBLICA de firma REMOTA del albarán: GET /albaran/:token (revisar + firmar en el móvil
// del cliente) y POST /albaran/:token/firmar (emitido → firmado + auto-envío de la copia firmada).
// SIN auth: la autoriza el TOKEN OPACO (Albaran.firmaToken, 128 bits; findUnique). Documento NO
// fiscal (regla 24). SCRUM-468: el VALORADO SI ensena importes -- los mismos que su PDF, sin
// desglose de cuota de IVA. El SIN_VALORAR sigue con concepto/cantidad/unidad. Molde: quoteDecisionLanding
// (página + canvas de firma) + el token opaco de customerPortal. Tenancy = el token.
import { Router, Request, Response } from 'express';
import { prisma } from '../../../../core/db/prisma';
import { esc, parseToken } from '../../../../core/utils/utils';
import { documentNotFoundHtml } from '../../../../core/http/publicNotFound';
import { rateLimit } from '../../../../core/http/rateLimit';
import { buildFirmaEvidencia, canTransitionAlbaran, ensureAlbaranPdf } from '../../domain/albaran.service';
import { renderLineasAlbaran } from './albaranPublicVista';
// SCRUM-300 (C5): microcopy del firmante en su fuente única (regla 30) — aquí no se escribe copy.
import {
  ALBARAN_ROTULOS,
  FIRMANTE_CALIDAD_ETIQUETAS,
  FIRMANTE_CALIDAD_LIBRE,
  type FirmanteCalidadId,
  FIRMANTE_NOMBRE_MAX,
  FIRMANTE_OTRO_MAX,
  COPY_CALIDAD_OTRO_VACIO,
  COPY_FIRMA_SIN_NOMBRE,
  COPY_ALBARAN_CAMBIADO,
  COPY_ALBARAN_CAMBIADO_BOTON,
  firmanteCalidadOpciones,
  exigirNombreFirmante,
  puedeFirmarEstaVersion,
  resolverCalidadFirmante,
} from '../../domain/albaranFirmante';
import { sendAlbaranFirmadoWhatsApp } from '../../domain/albaranWhatsApp.service';
import { requestIp } from '../../../system/audit.service';
import { getLocale } from '../../../../core/i18n/locales'; // SCRUM-967b
import { portalUrlDelCliente } from '../../../system/customerAdmin'; // SCRUM-967b
import { clienteDelDocumento } from '../../../invoicing/domain/clienteCongelado'; // SCRUM-1650b
// SCRUM-1646 (CSP paso 2): el guion de la página, fuera del HTML.
import { ALBARAN_FIRMA_JS, ID_DATOS_FIRMA, SRC_FIRMA_JS, cacheDelGuion, datosParaLaPagina } from './albaranFirmaNavegador';
// SCRUM-1723 (`style-src 'self'`): y su CSS, también fuera del HTML.
import { ALBARAN_FIRMA_CSS, HREF_FIRMA_CSS, cacheDelEstilo } from './albaranFirmaEstilo';

const router = Router();

// SCRUM-1646 · el guion de la página de firma, servido desde 'self' (`script-src 'self'`). Dos tramos
// de ruta, así que `/:token` (uno solo) no lo pisa. `immutable` SOLO con la huella buena.
router.get('/js/firma.js', (req: Request, res: Response) => {
  res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
  res.setHeader('Cache-Control', cacheDelGuion(req.query?.v));
  return res.send(ALBARAN_FIRMA_JS);
});
// SCRUM-1723 · el CSS de la página, servido desde 'self' (`style-src 'self'`), mismo patrón y huella.
router.get('/css/firma.css', (req: Request, res: Response) => {
  res.setHeader('Content-Type', 'text/css; charset=utf-8');
  res.setHeader('Cache-Control', cacheDelEstilo(req.query?.v));
  return res.send(ALBARAN_FIRMA_CSS);
});
// Superficie pública → rate-limit (patrón decisionLimiter del presupuesto).
const firmaLimiter = rateLimit({ scope: 'albaran_firma_publica', max: 20, windowMs: 60_000 });
const FIRMA_MAX_CHARS = 500_000; // mismo tope que la firma en obra (albaranes.routes.ts)

function renderPage(title: string, body: string): string {
  return `<!doctype html>
<html lang="es"><head>
<meta charset="utf-8"/><title>${esc(title)}</title>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<meta name="theme-color" content="#16a34a"/>
<link rel="stylesheet" href="/fonts/inter.css"/>
<link rel="stylesheet" href="${HREF_FIRMA_CSS}"/>
</head>
<body><div class="card">${body}</div></body></html>`;
}

// Cabecera del negocio (logo o avatar con inicial).
function merchantHero(merchant: { name: string | null; legalName: string | null; logoUrl: string | null } | null): string {
  const name = esc(merchant?.legalName || merchant?.name || 'Tu proveedor');
  const hero = merchant?.logoUrl
    ? `<img class="merchant-logo" src="${esc(merchant.logoUrl)}" alt="logo"/>`
    : `<div class="merchant-avatar">${esc((name || '?').charAt(0).toUpperCase())}</div>`;
  return `<div class="merchant-hero">${hero}<div class="merchant-name">${name}</div></div>`;
}

// SCRUM-93b: aviso RGPD breve para el cliente final que firma (capa 1, RGPD_TRATAMIENTO_DATOS.md
// §5). PASIVO a propósito — sin casilla, sin registro de aceptación: la base de IP/UA de la
// firma es ejecución del contrato + interés legítimo (eIDAS/Ley 6/2020), no consentimiento, que
// es revocable y no serviría para "des-probar" una firma ya prestada. ⚠️ Este bloque NUNCA debe
// incluir ip/ua (regla SCRUM-68): solo texto informativo + nombre/contacto del profesional.
function avisoPrivacidad(merchant: { name: string | null; legalName: string | null; email: string | null } | null): string {
  const nombre = esc(merchant?.legalName || merchant?.name || 'El profesional');
  const contacto = merchant?.email ? ` escribiendo a ${esc(merchant.email)}` : '';
  return `<p class="privacy-note">Al firmar, <strong>${nombre}</strong> tratará tus datos (nombre, contacto y
    dirección del servicio) para gestionar este parte de trabajo y su cobro. También registramos
    la fecha, hora, IP y navegador de esta firma para poder acreditarla si fuera necesario.
    ${nombre} es responsable de tus datos; YaQu los trata en su nombre como proveedor
    tecnológico. Puedes ejercer tus derechos${contacto} — más información en la
    <a href="/privacidad">política de privacidad</a>.</p>`;
}

// SCRUM-1646 · el lienzo de firma, los campos del firmante y el botón de firmar ya NO van en línea:
// su guion vive en `albaranFirmaNavegador.ts` y se sirve en `GET /albaran/js/firma.js` (abajo). Aquí
// sólo se pintan sus DATOS, en un bloque `application/json` que no se ejecuta.

/**
 * SCRUM-300 (C5): los dos campos de FIRMADO POR, sin añadir toques al camino normal.
 *
 * ⚠️ DOS DECISIONES QUE PARECEN LA MISMA Y SON OPUESTAS:
 *
 *  · El NOMBRE llega precargado con el del cliente. Lo pide el enunciado del ticket
 *    («el nombre precargado con el del cliente para el caso más común») y es un dato que
 *    nosotros ya sabemos, no una declaración de nadie.
 *
 *  · La CALIDAD llega SIN NADA MARCADO, y es deliberado: una casilla premarcada es una
 *    declaración que el firmante no ha hecho. Lo dice también el comentario de
 *    `firmadoPorCalidad` en `prisma/schema.prisma`. La rama `scrum-300-firmado-por` la
 *    premarcaba con «El propio cliente»; se ha retirado.
 *
 * El campo es OPCIONAL, así que no marcar nada no bloquea nada: el camino normal sigue siendo
 * trazo + botón. Solo paga toques quien firma siendo otra persona, que es justo el caso que el
 * documento necesita capturar.
 *
 * Los textos NO se escriben aquí: salen de `albaranFirmante.ts`, su fuente única (regla 30).
 * Hoy las seis etiquetas son `[PENDIENTE microcopy oficial]` porque nadie las ha aprobado.
 */
function firmanteCamposHtml(nombrePrecargado: string): string {
  // La primera opción va vacía y seleccionada: es la que deja el campo sin declarar.
  const opciones = firmanteCalidadOpciones()
    .map((o) => `<option value="${esc(o.id)}">${esc(o.etiqueta)}</option>`)
    .join('');
  return `
    <div class="firmante-campo">
      <label for="firmante-nombre">${esc(ALBARAN_ROTULOS.firmadoPorNombre)}</label>
      <input id="firmante-nombre" type="text" value="${nombrePrecargado}" maxlength="${FIRMANTE_NOMBRE_MAX}" autocomplete="name"/>
    </div>
    <div class="firmante-campo">
      <label for="firmante-calidad">${esc(ALBARAN_ROTULOS.firmadoPorCalidad)}</label>
      <select id="firmante-calidad"><option value="" selected></option>${opciones}</select>
    </div>
    <div class="firmante-campo" id="firmante-otro-wrap">
      <input id="firmante-otro" type="text" maxlength="${FIRMANTE_OTRO_MAX}" placeholder="${esc(FIRMANTE_CALIDAD_ETIQUETAS[FIRMANTE_CALIDAD_LIBRE])}"/>
    </div>`;
  // SCRUM-1646 · el comportamiento de estos campos (el «Otro» que abre su hueco y, 🔴 SCRUM-300, el
  // nombre PRECARGADO que se borra si quien firma dice que no es el cliente —dejarlo sellaría una
  // declaración falsa; lo tecleado a mano NO se toca) vive en `albaranFirmaNavegador.ts`, con los
  // ids de calidad que le llegan en los datos (`calidadLibre`, `calidadPropia`).
}

/** SCRUM-300 · la calidad que NO borra el nombre precargado: quien firma es el propio cliente. */
const CALIDAD_PROPIA: FirmanteCalidadId = 'el_propio_cliente';

// SCRUM-967b · las piezas de la línea firmada (L3) bajo «¡Parte firmado!».
function negocioDe(m: { name: string; legalName: string | null } | null): string {
  return (m?.legalName || m?.name || '').trim();
}
function presupuestosDe(m: { country: string | null } | null): string {
  return getLocale(m?.country).quotePlural.toLowerCase();
}

async function loadContext(token: string) {
  const albaran = await prisma.albaran.findUnique({ where: { firmaToken: token } });
  if (!albaran) return null;
  const [merchant, job] = await Promise.all([
    prisma.merchant.findUnique({ where: { id: albaran.merchantId }, select: { name: true, legalName: true, logoUrl: true, email: true, country: true } }),
    prisma.job.findUnique({ where: { id: albaran.jobId }, select: { customerId: true, titulo: true, direccion: true } }),
  ]);
  const customer = job ? await prisma.customer.findUnique({ where: { id: job.customerId }, select: { name: true } }) : null;
  return { albaran, merchant, job, customer };
}

// GET /albaran/:token — revisar + firmar (o estado "ya firmado" / no encontrado).
router.get('/:token', async (req: Request, res: Response) => {
  const html = (t: string, b: string) => res.setHeader('Content-Type', 'text/html; charset=utf-8').send(renderPage(t, b));
  const ctx = await loadContext(parseToken(req.params.token)).catch(() => null); // tolera URLs sucias ('{{1}}abc...' → 'abc...')
  if (!ctx) return res.status(404).setHeader('Content-Type', 'text/html; charset=utf-8').send(documentNotFoundHtml());
  const { albaran, merchant, job, customer } = ctx;
  const hero = merchantHero(merchant);
  // SCRUM-1650b · el nombre es el que quedó ESCRITO en el albarán al emitirlo, no el de la ficha de
  // hoy. Es también la SUGERENCIA del firmante (`firmanteCamposHtml`), que acaba sellada en «Firmado
  // por»: editar la ficha después de emitir no puede cambiar lo que se propone firmar. GO del
  // fundador del 10-nov-2026 (registro en docs/master/SCRUM-1650.md). Un albarán anterior al
  // escritor (columnas a NULL) cae a la ficha: la regla es la de `clienteDelDocumento`, no una copia.
  const nombreDelDocumento = albaran.customerName != null || customer ? clienteDelDocumento(albaran, customer).name : '';
  // SCRUM-1646 · el nombre SIN escapar va a los datos del guion («Gracias, …», por `textContent`); el
  // escapado, al HTML. Salen de la MISMA línea a propósito: saludo y «Gracias» no pueden decir dos
  // nombres.
  const nombreCliente = nombreDelDocumento || 'Cliente'; const customerName = esc(nombreCliente);
  const obra = esc((job?.direccion || job?.titulo || '').trim());

  if (albaran.estado === 'firmado') {
    // SCRUM-1302d (D) · ni aquí ni en «¡Parte firmado!» se promete la copia por WhatsApp: el
    // auto-envío del POST es de mejor esfuerzo y lo corta el tope diario (J6), y la página no sabe
    // si va a salir. Lo vigila `tests/scrum1302d-textos-de-la-pagina-de-firma.test.mjs`.
    return html('Parte de trabajo firmado', `${hero}<div class="status-ok"><strong>Este parte de trabajo ya está firmado.</strong><br/>Gracias, ${customerName}.</div>`);
  }
  if (albaran.estado !== 'emitido') {
    // borrador u otro: el token solo se emite en 'emitido', pero degradamos con dignidad.
    return html('Parte de trabajo', `${hero}<div class="status-ok"><strong>Este parte de trabajo aún no está listo para firmar.</strong><br/>El profesional te avisará.</div>`);
  }

  /**
   * SCRUM-468 · LA PANTALLA ENSEÑA LO MISMO QUE EL PDF, y para el VALORADO eso incluye importes.
   *
   * Hasta aquí ocultaba precios a TODOS los albaranes: regla de cuando solo existía SIN_VALORAR.
   * SCRUM-65 metió el modo valorado en el PDF y **no tocó esta pantalla**, así que el cliente
   * firmaba una pantalla sin importes y quedaba vinculado a un papel con Base y Total.
   *
   * El QUÉ se pinta vive en `albaranPublicVista.ts` — aparte para poder ejecutarlo en un test
   * contra el PDF, campo por campo. Aquí solo se llama.
   */
  // SCRUM-607 (ALB-02): el interruptor viaja tambien a la pantalla que el cliente abre desde el
  // movil. Si el PDF los oculta y esta no, el cliente los ve igual y el control no oculta nada.
  const linesHtml = renderLineasAlbaran(
    albaran.lineas, albaran.modoValoracion, albaran.ocultarPreciosEnDocumento,
  );

  /**
   * SCRUM-1646 · LO QUE EL GUION NECESITA, COMO DATOS. Antes iba interpolado dentro de un `<script>` en
   * línea; ahora viaja en un bloque `application/json` y el código (`albaranFirmaNavegador.ts`) no
   * lleva ni uno. Los TEXTOS siguen naciendo aquí y en `albaranFirmante.ts`, los mismos de antes,
   * palabra por palabra (regla 39: se mueve código, no copy).
   *
   * Lo que cada dato sostiene, y que no puede perderse al moverlo:
   *  · `firmarUrl` — 🔴 SCRUM-1632c: con el token LIMPIO (`parseToken`), nunca con lo que trajo la URL.
   *  · `version` — 🔴 SCRUM-361 (H6): la versión que ESTA PÁGINA pintó. El servidor la compara con la
   *    de ahora y NO sella si difieren. No es un hash: es el contador de fila que el PATCH incrementa.
   *  · `sinNombre` — SCRUM-300: el nombre es obligatorio al firmar; se corta en el navegador para no
   *    gastar un viaje. Texto APROBADO (fundador, 6-ago-2026), de la fuente única.
   *  · `cambiado` / `cambiadoBoton` — 🔴 SCRUM-361: aviso propio, no la línea roja, y se RETIRA el
   *    botón de firmar (reintentar lo mismo es justo lo que no debe pasar).
   *  · `portalLinea` / `portalBoton` — SCRUM-967b: el portal llega SOLO en la respuesta de un solo uso
   *    del POST; la URL entra como atributo y todo texto como texto.
   *  · `sinRespuesta` — SCRUM-1302d: no se sabe si la firma llegó; reintentar sobre un parte ya
   *    firmado contesta que ya está, sin escribir.
   *  · `firmadoGracias` — 🔴 SCRUM-1302d (D): NO promete la copia por WhatsApp. Lleva el nombre SIN
   *    escapar porque entra por `textContent` (antes iba escapado porque entraba por `innerHTML`):
   *    lo que se lee en pantalla es el mismo.
   */
  const datosDeFirma = {
    firmarUrl: `/albaran/${parseToken(req.params.token)}/firmar`,
    version: albaran.version,
    calidadLibre: FIRMANTE_CALIDAD_LIBRE,
    calidadPropia: CALIDAD_PROPIA,
    errorCambiado: 'albaran_cambiado',
    textos: {
      sinFirma: 'Dibuja tu firma para continuar.',
      sinNombre: COPY_FIRMA_SIN_NOMBRE,
      calidadOtroVacio: COPY_CALIDAD_OTRO_VACIO,
      enviando: 'Enviando…',
      botonFirmar: 'Firmar el parte de trabajo',
      marcaFirmado: '✓',
      firmadoTitulo: '¡Parte firmado!',
      firmadoGracias: `Gracias, ${nombreCliente}.`,
      portalLinea: `Ahí tienes tus ${presupuestosDe(merchant)} y pagos con ${negocioDe(merchant)}.`,
      portalBoton: 'Abrir mi portal de cliente',
      cambiado: COPY_ALBARAN_CAMBIADO,
      cambiadoBoton: COPY_ALBARAN_CAMBIADO_BOTON,
      reserva: 'No se ha podido firmar. Inténtalo de nuevo.',
      sinRespuesta: 'No hemos podido confirmar que tu firma haya llegado. Comprueba tu conexión y vuelve a intentarlo.',
    },
  };

  return html('Firmar parte de trabajo', `
    ${hero}
    <h1>Hola, ${customerName} 👋</h1>
    <div class="meta">Parte de trabajo ${esc(albaran.numero)}${obra ? ` · ${obra}` : ''}</div>
    ${linesHtml}
    <hr class="divider"/>
    ${firmanteCamposHtml(customerName)}
    <label class="sig-label">Tu firma</label>
    <p class="sig-sub">Revisa el parte y firma con el dedo o el ratón.</p>
    <div class="sig-wrapper" id="sig-wrapper">
      <canvas id="sig-canvas"></canvas>
      <span class="sig-placeholder" id="sig-placeholder">✍️ Firma aquí</span>
    </div>
    <div class="sig-actions"><button type="button" class="btn-clear" id="sig-clear">Borrar</button></div>
    <button class="btn-accept" id="btn-sign">Firmar el parte de trabajo</button>
    <div id="sig-error">Dibuja tu firma para continuar.</div>
    <small>Documento no fiscal — no constituye factura. Si no esperabas esto, cierra esta página.</small>
    ${avisoPrivacidad(merchant)}
    <script type="application/json" id="${ID_DATOS_FIRMA}">${datosParaLaPagina(datosDeFirma)}</script>
    <script src="${SRC_FIRMA_JS}"></script>
  `);
});

// POST /albaran/:token/firmar — emitido → firmado + auto-envío de la copia firmada (best-effort).
router.post('/:token/firmar', firmaLimiter, async (req: Request, res: Response) => {
  try {
    const albaran = await prisma.albaran.findUnique({ where: { firmaToken: parseToken(req.params.token) } }); // tolera URLs sucias
    if (!albaran) return res.status(404).json({ error: 'not_found', message: 'Este enlace no es válido.' });
    if (albaran.estado === 'firmado') return res.json({ ok: true, already: true }); // idempotente
    if (!canTransitionAlbaran(albaran.estado, 'firmado')) {
      return res.status(409).json({ error: 'invalid_transition', message: 'Este parte de trabajo no se puede firmar ahora.' });
    }

    // ── 🔴 SCRUM-361 (H6) · ¿SIGUE SIENDO EL ALBARÁN QUE EL CLIENTE VIO? ──────────────────────
    //
    // El PATCH solo se bloquea cuando el albarán ya está FIRMADO (`albaranes.routes.ts`), así que
    // un albarán ENVIADO A FIRMAR todavía se puede editar. Si el profesional corrige una línea
    // mientras el cliente tiene el enlace abierto, el cliente firma la pantalla que tenía y queda
    // sellado un contenido que NO VIO. La firma vale cero y parece que vale.
    //
    // Se compara ANTES de mirar la firma a propósito: si el documento ya no es el mismo, lo que
    // haya dibujado da igual, y el cliente prefiere enterarse antes que después de firmar.
    //
    // ⚠️ NO se recalcula ningún hash aquí ni en el navegador. `Albaran.version` es —hoy,
    // medido— «el contenido del documento cambió»: la incrementa un solo escritor, el PATCH, y
    // es el único que toca contenido. Duplicar `computeAlbaranContentHash` en el cliente era el
    // riesgo que H0 señaló (dos implementaciones que derivan en silencio) y esto lo evita entero.
    // Que siga siendo verdad lo vigila `tests/scrum361-version-al-firmar.test.mjs`.
    const mismaVersion = puedeFirmarEstaVersion(req.body?.version, albaran.version);
    if (!mismaVersion.ok) {
      return res.status(409).json({ error: mismaVersion.error, message: mismaVersion.message });
    }

    const signatureData = String(req.body?.signatureData || '');
    if (!/^data:image\/(png|jpeg);base64,/.test(signatureData)) {
      return res.status(400).json({ error: 'firma_invalida', message: 'La firma no es válida.' });
    }
    if (signatureData.length > FIRMA_MAX_CHARS) {
      return res.status(413).json({ error: 'firma_demasiado_grande', message: 'La firma es demasiado grande.' });
    }

    // Firma remota: sella evidencias (SCRUM-68) → estado firmado, congelado. Canal 'remoto'
    // y tokenId = firmaToken usado. ⚠️ ip/ua se guardan SOLO en evidenciaFirma y NUNCA se
    // exponen aquí: esta página pública jamás los devuelve (ni en el HTML ni en el JSON).
    // SCRUM-300 (C5): quién firma y en calidad de qué, también en el canal remoto. Resueltos
    // ANTES de sellar. Aquí quien tiene el móvil es normalmente el propio cliente, así que la
    // ranura precargada acierta aún más que en obra.
    const calidad = resolverCalidadFirmante({
      ranura: req.body?.firmadoPorCalidad,
      textoLibre: req.body?.firmadoPorCalidadOtro,
    });
    if (!calidad.ok) return res.status(400).json({ error: calidad.error, message: calidad.message });
    // SCRUM-300: el nombre es OBLIGATORIO al firmar (columna nullable por las filas viejas; el
    // acto de firmar lo exige). Ver `exigirNombreFirmante` para el porqué de las dos reglas.
    const nombre = exigirNombreFirmante(req.body?.firmadoPorNombre);
    if (!nombre.ok) return res.status(400).json({ error: nombre.error, message: nombre.message });
    const firmadoPorNombre = nombre.nombre;

    const firmadoAt = new Date();
    const evidencia = await buildFirmaEvidencia({
      albaran,
      canal: 'remoto',
      ip: requestIp(req),
      ua: (req.headers['user-agent'] as string) || null,
      tokenId: albaran.firmaToken,
      firmadoAt,
      firmadoPorNombre,
      firmadoPorCalidad: calidad.valor,
    });
    // ── 🔴 SCRUM-1302j · LA FIRMA SE ESCRIBE SÓLO SI EL PARTE SIGUE COMO SE LEYÓ ───────────────
    //
    // Leer `emitido` arriba y escribir aquí no es una sola operación. Con `where: { id }`, dos
    // peticiones a la vez leían las dos `emitido` y escribían las dos: quedaba el SEGUNDO trazo y
    // el segundo nombre, con dos PDF y dos copias pedidas (medido por S4 en SCRUM-1302d). Es el
    // patrón de SCRUM-1276 en el presupuesto: el estado leído va en el `where`.
    //
    // Y la versión leída también: si el profesional corrige el parte entre la lectura y esta
    // escritura, lo que se sellaría es un contenido que el cliente no vio (la ventana que
    // SCRUM-361 comprueba arriba, pero sobre lo leído).
    //
    // Quien llega tarde NO repite nada: ni PDF, ni copia, ni enlace del portal. Se vuelve a leer y
    // se contesta lo mismo que contestaría una petición nueva sobre ese parte.
    try {
      await prisma.albaran.update({
        where: { id: albaran.id, estado: albaran.estado, version: albaran.version },
        data: {
          estado: 'firmado', signatureUrl: signatureData, firmadoAt, evidenciaFirma: evidencia as any,
          firmadoPorNombre, firmadoPorCalidad: calidad.valor,
        },
      });
    } catch (e: any) {
      if (e?.code !== 'P2025') throw e;
      const ahora = await prisma.albaran.findUnique({ where: { id: albaran.id }, select: { estado: true, version: true } });
      if (ahora?.estado === 'firmado') return res.json({ ok: true, already: true });
      const sigueIgual = ahora ? puedeFirmarEstaVersion(req.body?.version, ahora.version) : null;
      if (sigueIgual && !sigueIgual.ok) {
        return res.status(409).json({ error: sigueIgual.error, message: sigueIgual.message });
      }
      // El mismo texto, ya aprobado, que la puerta de arriba: literal y con su `message` (SCRUM-275).
      return res.status(409).json({ error: 'invalid_transition', message: 'Este parte de trabajo no se puede firmar ahora.' });
    }
    await ensureAlbaranPdf(albaran.id, true).catch((e) => console.error('[albaranPublic] PDF tras firmar:', e?.message || e));

    // AUTO-ENVÍO de la copia firmada (SCRUM-49): best-effort, fire-and-forget. La firma NUNCA
    // falla por el envío; si el tope 3/día (J6) corta, la copia queda en la plataforma y el pro
    // puede reenviarla a mano (botón de la 47). Guards completos vía el servicio.
    sendAlbaranFirmadoWhatsApp(albaran.id).catch((e) => console.error('[albaranPublic] auto-envío:', e?.message || e));

    // SCRUM-967b · el enlace del portal, SOLO aquí: en la respuesta de la firma que acaba de entrar,
    // DESPUÉS de sellar y sin tocar nada de lo sellado. La rama `already` de arriba no lo devuelve
    // a propósito — si lo hiciera, cualquiera con el enlace del parte tendría el portal entero
    // (todos los documentos del cliente) para siempre. Best-effort: la firma ya está hecha.
    const job = await prisma.job.findUnique({ where: { id: albaran.jobId }, select: { customerId: true } }).catch(() => null);
    const portalUrl = job?.customerId
      ? await portalUrlDelCliente(albaran.merchantId, job.customerId).catch(() => null)
      : null;
    return res.json(portalUrl ? { ok: true, portalUrl } : { ok: true });
  } catch (err: any) {
    console.error('[POST /albaran/:token/firmar]', err?.message || err);
    return res.status(500).json({ error: 'internal_error', message: 'Error inesperado. Inténtalo más tarde.' });
  }
});

export default router;
