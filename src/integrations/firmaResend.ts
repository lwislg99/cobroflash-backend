// src/integrations/firmaResend.ts — SCRUM-475 (fase 2A)
//
// ¿ESTE AVISO DE ENTREGA LO MANDA DE VERDAD EL PROVEEDOR?
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// QUÉ PROTEGE, Y POR QUÉ SE CONSTRUYE ANTES QUE LA TABLA
//
// La fase 2 completa necesita la tabla `EmailMessage` (diff preparado y SIN aplicar en
// `docs/master/SCRUM-475.md` §4 — es del fundador) y el secreto del panel de Resend. Pero **la
// verificación de firma es PURA**: se construye y se prueba hoy con un secreto de prueba, y es la
// pieza que más fácil se hace mal.
//
// 🔴 LO QUE PASA SI ESTO ESTÁ MAL: `entregado`, `rebotado` y `reclamado` son los únicos estados que
// NO puede producir nuestro propio envío — solo un aviso del proveedor (`constanciaCorreo.ts` lo
// fija con un test). Si la firma no se comprueba, **cualquiera con la URL puede decirnos que un
// correo se entregó**, y el producto lo creería. La constancia entera valdría cero: es peor que no
// tenerla, porque parece que la tienes.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// 🔴 LA FIRMA CUBRE EL CUERPO CRUDO, Y ESO ES UNA DECISIÓN DE ARQUITECTURA
//
// Un `express.json()` parsea y **re-serializa**: los espacios, el orden de las claves y el escape
// de los no-ASCII pueden cambiar, y con eso la firma deja de casar. La casa ya resuelve esto en DOS
// sitios, y se han leído los dos:
//
//   ① `src/app.ts:147` — `express.json({ verify })` guarda `rawBody` **solo** para
//      `/webhooks/whatsapp`, comparando el prefijo de la URL dentro del parser GLOBAL.
//   ② `stripe.routes.ts:12` y `connectWebhook.routes.ts:20` — `express.raw({ type:
//      'application/json' })` exportado por el propio router y montado ANTES del parser global.
//
// **Se reutiliza ②**, y el motivo no es preferencia: ① es un RETROFIT. El webhook de WhatsApp
// necesita además `req.body` ya parseado (lo recorre entero después de validar), así que su raw
// body tuvo que colarse dentro del parser global, y el precio es una **lista de URLs dentro de un
// middleware compartido** que hay que ampliar cada vez. ② es self-contained: el webhook trae su
// propio parser y no toca nada de nadie — por eso Stripe lo usa DOS veces, y es la forma que la
// casa ya eligió para un webhook NUEVO. Añadir `/webhooks/resend` a la lista de ① sería editar el
// parser por el que pasa TODA la aplicación para no ganar nada.
//
// ⚠️ Aquí no se monta ninguna ruta (es la fase 2B): lo que esta decisión fija HOY es la FIRMA de
// esta función — recibe `Buffer`, y **nada más que `Buffer`**. Pasarle el objeto ya parseado no
// devuelve «firma inválida»: devuelve `cuerpo_no_crudo`, que es lo único que hace depurable ese
// día. Hay test que lo prueba re-serializando un JSON idéntico y viendo que la firma cae.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// 🔴 «NO COINCIDE» Y «NO SE PUDO COMPROBAR» NO SON EL MISMO RECHAZO
//
// Los dos rechazan igual —fail-closed, como `isValidSignature` de WhatsApp (SCRUM-99)—, pero
// **dicen cosas distintas**, y por eso el veredicto lleva CLASE además de motivo:
//
//   · `RECHAZADO`            → la comprobación se hizo y salió que no. Alguien manda basura.
//   · `NO_SE_PUDO_COMPROBAR` → no había con qué comprobar: falta el secreto, falta una cabecera, o
//                              el cuerpo no llegó crudo. **Esto es un fallo NUESTRO, no un ataque.**
//
// Sin esa separación, el día que el secreto de Railway esté mal pegado el log dirá «firma inválida»
// y se buscará el fallo en Resend durante horas. El precedente de la casa devuelve un `boolean` y
// distingue solo por el `console.error`; aquí la distinción está en el TIPO, que es lo que impide
// que el siguiente que lo lea la pierda. (Ese guard es ajeno y NO se toca: regla 9.)
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// NI DEPENDENCIA NI SDK — MEDIDO, NO SUPUESTO
//
// El esquema es HMAC-SHA256 sobre `id.timestamp.cuerpo`, con el secreto en base64 tras `whsec_`.
// Está documentado y son ~40 líneas de `node:crypto`, así que **no se añade `svix` ni el SDK de
// Resend**: la regla 36 (nada de dependencias sin el fundador) ni siquiera se activa.
//
// ⚠️ LO QUE ESTE MÓDULO NO HACE: no persiste, no monta ruta, no lee configuración. El secreto
// ENTRA por parámetro — así es puro, testeable sin entorno, y **no hay ningún secreto escrito aquí
// ni en sus tests** (el de prueba se genera al vuelo).
import crypto from 'crypto';
import { ESTADOS_CORREO, type EstadoCorreo } from '../modules/messaging/domain/constanciaCorreo';

/**
 * Cuánto puede separarse el reloj del aviso del nuestro. Es la tolerancia del propio esquema.
 *
 * 🔴 Sirve contra la REPETICIÓN: un aviso capturado con su firma buena sigue teniendo la firma
 * buena para siempre, así que sin ventana un tercero puede reenviar el mismo `delivered` mañana.
 * Por eso la ventana se comprueba ANTES que el HMAC — si se comprobara después, un aviso repetido
 * con firma válida pasaría el HMAC y solo entonces se miraría la hora, que es el orden en el que se
 * cuela un fallo el día que alguien «optimice» saliendo antes.
 */
export const TOLERANCIA_MS = 5 * 60 * 1000;

/** Las tres cabeceras del esquema. Falta una → no se puede comprobar, y se dice CUÁL. */
export const CABECERAS = ['svix-id', 'svix-timestamp', 'svix-signature'] as const;

/** No había con qué comprobar. Es un fallo de configuración NUESTRO. */
export type MotivoNoComprobable =
  | 'sin_secreto'      // nadie configuró el secreto del panel
  | 'secreto_ilegible' // hay secreto pero no es un `whsec_<base64>` decodificable
  | 'falta_cabecera'   // falta una de las tres
  | 'cuerpo_no_crudo'; // nos han dado el cuerpo ya parseado: la firma no se puede recomponer

/** La comprobación se hizo y salió que no. */
export type MotivoRechazo =
  | 'timestamp_ilegible'
  | 'fuera_de_ventana'   // repetición, o relojes descuadrados
  | 'firma_ilegible'     // la cabecera no trae ninguna firma `v1` con forma
  | 'firma_no_coincide'; // el HMAC no da. Cuerpo alterado, secreto distinto o firma inventada.

export type Veredicto =
  | { ok: true; id: string; emitidoEn: Date; cuerpo: unknown }
  | { ok: false; clase: 'NO_SE_PUDO_COMPROBAR'; motivo: MotivoNoComprobable; detalle: string }
  | { ok: false; clase: 'RECHAZADO'; motivo: MotivoRechazo; detalle: string };

const noComprobable = (motivo: MotivoNoComprobable, detalle: string): Veredicto =>
  ({ ok: false, clase: 'NO_SE_PUDO_COMPROBAR', motivo, detalle });
const rechazado = (motivo: MotivoRechazo, detalle: string): Veredicto =>
  ({ ok: false, clase: 'RECHAZADO', motivo, detalle });

/** Las cabeceras llegan con la caja que quiera el proveedor (y Express las baja). Se normaliza. */
function leerCabecera(cabeceras: Record<string, unknown>, nombre: string): string {
  for (const [k, v] of Object.entries(cabeceras ?? {})) {
    if (k.toLowerCase() !== nombre) continue;
    const valor = Array.isArray(v) ? v[0] : v;
    return typeof valor === 'string' ? valor.trim() : '';
  }
  return '';
}

/**
 * El secreto del panel: `whsec_<base64>` (se admite también el base64 pelado).
 *
 * ⚠️ Devuelve `null` en vez de lanzar, y el llamador lo convierte en `secreto_ilegible`: un secreto
 * mal pegado es lo más probable que pase el primer día, y tiene que salir por su propio motivo en
 * vez de confundirse con una firma que no casa.
 */
function clavePrimaria(secreto: string): Buffer | null {
  const base64 = secreto.startsWith('whsec_') ? secreto.slice('whsec_'.length) : secreto;
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(base64)) return null;
  const clave = Buffer.from(base64, 'base64');
  return clave.length ? clave : null;
}

/**
 * VERIFICA el aviso. Fail-closed: cualquier duda es rechazo.
 *
 * `ahora` entra por parámetro para que la ventana se pueda probar sin tocar el reloj del proceso.
 */
export function verificarFirmaResend(params: {
  cabeceras: Record<string, unknown>;
  cuerpoCrudo: unknown;
  secreto: string | undefined | null;
  ahora?: number;
}): Veredicto {
  const { cabeceras, cuerpoCrudo, secreto } = params;
  const ahora = params.ahora ?? Date.now();

  // ── Lo que hace imposible comprobar ────────────────────────────────────────────────────
  if (!secreto || !secreto.trim()) {
    return noComprobable('sin_secreto',
      'no hay secreto de webhook configurado: sin él NO se puede distinguir un aviso del proveedor ' +
      'de uno inventado, así que se rechaza todo (fail-closed). Se configura en Railway.');
  }
  const clave = clavePrimaria(secreto.trim());
  if (!clave) {
    return noComprobable('secreto_ilegible',
      'el secreto está puesto pero no es un `whsec_<base64>` decodificable. NO es que la firma no ' +
      'case: es que no hay con qué comprobarla. Revisa que se pegó entero y sin espacios.');
  }
  // 🔴 Buffer y nada más. Un objeto o una cadena aquí significa que alguien metió un parser de JSON
  // delante, y entonces la firma NO SE PUEDE recomponer aunque el aviso sea legítimo.
  if (!Buffer.isBuffer(cuerpoCrudo)) {
    return noComprobable('cuerpo_no_crudo',
      `el cuerpo llegó como ${cuerpoCrudo === null ? 'null' : typeof cuerpoCrudo}, no como Buffer. ` +
      'La firma cubre los BYTES tal cual llegaron: si un `express.json()` los parsea y re-serializa, ' +
      'ya no se pueden recomponer. Monta `express.raw({ type: "application/json" })` delante, como ' +
      'hacen los webhooks de Stripe.');
  }
  for (const nombre of CABECERAS) {
    if (!leerCabecera(cabeceras, nombre)) {
      return noComprobable('falta_cabecera',
        `falta la cabecera \`${nombre}\`. El esquema exige las tres (${CABECERAS.join(', ')}); sin ` +
        'ella no hay nada que comprobar — y eso NO es lo mismo que una firma que no casa.');
    }
  }

  const id = leerCabecera(cabeceras, 'svix-id');
  const timestamp = leerCabecera(cabeceras, 'svix-timestamp');
  const firmas = leerCabecera(cabeceras, 'svix-signature');

  // ── Lo que sí se comprueba y sale que no ───────────────────────────────────────────────
  if (!/^\d+$/.test(timestamp)) {
    return rechazado('timestamp_ilegible',
      `\`svix-timestamp\` no es un número de segundos: «${timestamp}».`);
  }
  // ⚠️ ANTES del HMAC, a propósito: ver TOLERANCIA_MS.
  const desfase = Math.abs(ahora - Number(timestamp) * 1000);
  if (desfase > TOLERANCIA_MS) {
    return rechazado('fuera_de_ventana',
      `el aviso viene con ${Math.round(desfase / 1000)} s de desfase y la tolerancia es ` +
      `${TOLERANCIA_MS / 1000} s. Una firma válida lo sigue siendo para siempre, así que un aviso ` +
      'viejo reenviado por un tercero se rechaza aquí — o los relojes están descuadrados.');
  }

  // La cabecera trae una LISTA separada por espacios: `v1,<base64> v1,<base64>`. Hay más de una
  // durante una rotación de secreto, y basta con que case una.
  const candidatas = firmas.split(' ')
    .map((t) => t.trim())
    .filter((t) => t.startsWith('v1,'))
    .map((t) => t.slice('v1,'.length))
    .filter(Boolean);
  if (!candidatas.length) {
    return rechazado('firma_ilegible',
      '`svix-signature` no trae ninguna firma con la forma `v1,<base64>`. Se ha mirado la cabecera ' +
      'y no hay nada comparable — distinto de haber comparado y no casar.');
  }

  // 🔴 Se concatenan BYTES, no cadenas: `${id}.${ts}.${cuerpo.toString()}` obligaría a decidir una
  // codificación, y un cuerpo con acentos o emoji dejaría de dar el mismo HMAC que el que firmó el
  // proveedor. El prefijo es ASCII; el cuerpo va tal cual llegó.
  const firmado = Buffer.concat([Buffer.from(`${id}.${timestamp}.`, 'utf8'), cuerpoCrudo]);
  const esperada = crypto.createHmac('sha256', clave).update(firmado).digest();

  const casa = candidatas.some((c) => {
    const recibida = Buffer.from(c, 'base64');
    // `timingSafeEqual` LANZA si los buffers miden distinto (mismo patrón que `mercadopago.ts:129`
    // y `whatsappIncoming.routes.ts`): una firma de longitud rara no puede tirar una excepción.
    try {
      return crypto.timingSafeEqual(recibida, esperada);
    } catch {
      return false;
    }
  });
  if (!casa) {
    return rechazado('firma_no_coincide',
      'el HMAC no da. Puede ser una firma inventada, el secreto de otro entorno, o el cuerpo ' +
      'alterado después de firmarse — el esquema NO permite distinguirlos, y no se finge que sí: ' +
      `lo que queda para depurar es qué se firmó (id \`${id}\`, ts \`${timestamp}\`, ` +
      `${cuerpoCrudo.length} bytes).`);
  }

  // ── Solo AHORA se mira el contenido ────────────────────────────────────────────────────
  // Parsear antes de verificar sería darle al que manda basura un parser gratis y un mensaje de
  // error que le dice cómo va el formato.
  let cuerpo: unknown = null;
  try {
    cuerpo = JSON.parse(cuerpoCrudo.toString('utf8'));
  } catch {
    // Firma buena y JSON roto no es un ataque: es el proveedor mandando algo que no esperábamos.
    // Se acepta —la firma es lo que esta función responde— y el cuerpo queda `null` para que quien
    // lo consuma en 2B decida, en vez de reventar aquí.
    cuerpo = null;
  }
  return { ok: true, id, emitidoEn: new Date(Number(timestamp) * 1000), cuerpo };
}

// ─────────────────────────────────────────────────────────────────────────────────────────
// EL VOCABULARIO — qué estado de `constanciaCorreo.ts` produce cada aviso
//
// Se consume el vocabulario CERRADO de la fase 2; aquí no se inventa ningún estado (Parte P/regla
// 30). Los cuatro eventos son los que el proveedor manda, y son exactamente los tres estados que un
// envío propio NO puede producir, más el fallo.
//
// ⚠️ Un evento desconocido devuelve `null`, no un estado por defecto: si el proveedor añade uno
// mañana, esto tiene que decir «no sé qué es esto» en vez de decidir. Y NO se llama a `avanzar()`
// aquí — quién avanza y sobre qué fila es la fase 2B, que necesita la tabla.
// ─────────────────────────────────────────────────────────────────────────────────────────

export const EVENTOS_RESEND: Readonly<Record<string, EstadoCorreo>> = Object.freeze({
  'email.delivered': 'entregado',
  'email.bounced': 'rebotado',
  'email.complained': 'reclamado',
  'email.failed': 'fallo_envio',
});

/** El estado que corresponde a un aviso, o `null` si el evento no es de los conocidos. */
export function estadoDelAviso(evento: unknown): EstadoCorreo | null {
  if (typeof evento !== 'string') return null;
  const estado = EVENTOS_RESEND[evento];
  // Cinturón: si alguien añadiera aquí un estado que no está en el vocabulario cerrado, no sale.
  return estado && (ESTADOS_CORREO as readonly string[]).includes(estado) ? estado : null;
}
