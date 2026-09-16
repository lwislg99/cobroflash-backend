// src/modules/system/domain/soporte.ts — SCRUM-406
//
// «ESCRÍBENOS»: EL MENSAJE DEL PROFESIONAL, CON EL CONTEXTO PEGADO.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// QUÉ ARREGLA
//
// Hasta hoy el único contacto del producto era un `mailto:hola@yaqu.app` al pie de la guía. Eso
// **abre el cliente de correo del móvil** —que en un móvil de trabajo puede no estar configurado— y
// se lleva el hilo a la bandeja personal del profesional, fuera del producto para siempre. Y llega
// sin nada: ni quién es, ni desde dónde escribe, ni qué estaba haciendo.
//
// ⚠️ EL CONTEXTO NO ES ADORNO: es lo único que separa esto del `mailto:`. Un «no me funciona»
// anónimo desde una obra no se puede atender. Por eso el guard lo comprueba: si el contexto no
// viaja, el formulario no vale más que lo que sustituye.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// DE DÓNDE SALE EL CONTEXTO — no se recoge nada nuevo
//
// El entorno de la app (instalada / pestaña / desconocido) **ya se guarda**: lo escribe
// `POST /admin/entorno` en `AuthSession.instaladaPwa` desde SCRUM-360 (H5 fase 2). Aquí se LEE.
// Construir una segunda recogida del mismo dato habría dado dos verdades sobre lo mismo.
//
// Lo único que aporta el cliente es la PANTALLA desde la que escribe, que solo él sabe.
//
// ⚠️ SIN MODELO NI TABLA (camino 2, decisión del fundador): esto no persiste nada. El día que haga
// falta rastro dentro del producto, eso es el camino 3 y lo decide él.
import { CONTACTO_YAQU, destinoSoporte } from '../../../core/config/contacto';

/** Tope del mensaje. No es una regla de negocio: es no aceptar un cuerpo de correo sin fondo. */
export const SOPORTE_MENSAJE_MAX = 4000;

export interface ContextoSoporte {
  merchantId: number;
  /** Cómo contestarle. Sin esto el mensaje no tiene vuelta, y el guard lo exige. */
  merchantEmail: string | null;
  merchantNombre: string | null;
  /** Si escribe un operario y no el dueño de la cuenta, importa saberlo. */
  teamMemberId?: number | null;
  /** Ruta del dashboard desde la que escribe (`#/trabajos/12`). La única aportación del cliente. */
  pantalla: string | null;
  /** `AuthSession.instaladaPwa` — lo que ya guarda SCRUM-360 fase 2. `null` = no se sabe. */
  instaladaPwa: boolean | null;
}

/** Los tres estados de SCRUM-360, tal cual, sin inventar un cuarto. */
export function entornoLegible(instaladaPwa: boolean | null): string {
  if (instaladaPwa === true) return 'instalada';
  if (instaladaPwa === false) return 'pestaña';
  return 'desconocido';
}

/**
 * Valida el mensaje. Vacío NO se envía: un correo en blanco gasta el único canal que hay.
 */
export function exigirMensaje(v: unknown):
  | { ok: true; mensaje: string }
  | { ok: false; error: string } {
  const t = typeof v === 'string' ? v.trim() : '';
  if (!t) return { ok: false, error: 'mensaje_vacio' };
  if (t.length > SOPORTE_MENSAJE_MAX) return { ok: false, error: 'mensaje_largo' };
  return { ok: true, mensaje: t };
}

function esc(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/**
 * El correo que nos llega a NOSOTROS.
 *
 * ⚠️ Esto no es microcopy de producto (regla 30): no lo lee ningún profesional, lo leemos nosotros.
 * Lo que sí lee el profesional —«Escríbenos», «¿Qué ha pasado?», «Enviar» y la confirmación— está
 * aprobado y vive en el front.
 */
export function construirCorreoSoporte(mensaje: string, ctx: ContextoSoporte): {
  to: string;
  replyTo: string | null;
  subject: string;
  html: string;
} {
  const quien = ctx.merchantNombre || ctx.merchantEmail || `merchant ${ctx.merchantId}`;
  const pantalla = ctx.pantalla && ctx.pantalla.trim() ? ctx.pantalla.trim() : 'sin identificar';
  const filas: [string, string][] = [
    ['Merchant', `${ctx.merchantId} · ${quien}`],
    ['Email', ctx.merchantEmail || '(la cuenta no tiene email)'],
    ['Quién escribe', ctx.teamMemberId ? `operario ${ctx.teamMemberId}` : 'la cuenta (dueño)'],
    ['Pantalla', pantalla],
    ['Entorno', entornoLegible(ctx.instaladaPwa)],
  ];
  return {
    to: destinoSoporte(),
    // Para poder CONTESTAR dándole a responder. Es la mitad de «te contestamos por correo».
    replyTo: ctx.merchantEmail || null,
    subject: `[YaQu] ${quien} — ${pantalla}`,
    html:
      `<p style="white-space:pre-wrap">${esc(mensaje)}</p><hr/>`
      + '<table cellpadding="4">'
      + filas.map(([k, v]) => `<tr><td><b>${esc(k)}</b></td><td>${esc(v)}</td></tr>`).join('')
      + '</table>',
  };
}

export { CONTACTO_YAQU, destinoSoporte };
