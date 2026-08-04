// src/modules/system/audit.service.ts — A11.1 (EXT3, S2 F1-mínimo) + SCRUM-207 (AUDIT-FISCAL-1)
//
// Auditoría de las acciones sensibles. Nació fire-safe (un fallo del log jamás tumba la
// acción de negocio) y para las 8 acciones originales ESO SIGUE SIENDO LO CORRECTO.
//
// ── QUÉ CAMBIÓ EN SCRUM-207, y por qué no bastaba con añadir acciones ──────────────────
// El contrato (`docs/legal/AUDITLOG_FISCAL_CONTRATO.md`) exige que ante un ámbar «conste
// que el sistema informó y que el usuario decidió», y que una factura no exista sin su
// registro. `recordAudit` era ESTRUCTURALMENTE INCAPAZ de garantizar eso:
//   · devolvía `void` → nadie podía esperarla;
//   · `.catch(console.error)` → el fallo desaparecía;
//   · usaba el cliente GLOBAL → no podía participar en la transacción de quien la llama.
// Las tres cosas juntas significan que «se registra» era una intención, no un mecanismo.
//
// Ahora hay DOS puertas, y el nivel de durabilidad se ve en el nombre de la que se usa:
//   · `recordAudit`         (T3) — fire-safe. Igual que siempre. Las 8 originales no se tocan.
//   · `recordAuditOrThrow`  (T1/T2) — se ESPERA y PROPAGA, y acepta un cliente inyectado
//     para escribir DENTRO de una transacción ajena. Si falla, quien llama decide — y en
//     `allocateInvoiceNumber` esa decisión es que la transacción entera se deshaga.
//
// ── LA PROHIBICIÓN TIENE MECANISMO, NO COMENTARIO ─────────────────────────────────────
// Las acciones BLOQUEANTES no se pueden escribir por la puerta fire-safe: `recordAudit`
// no las acepta EN EL TIPO, así que un intento es un error de compilación, no una bomba
// que salta en producción el día que importa. `npm test` compila antes de nada, o sea que
// el guard corre en cada tanda sin que nadie tenga que acordarse de él.
import { prisma } from '../../core/db/prisma';
import { isFlagEnabled } from '../../core/flags';
import type { Request } from 'express';

export type AuditAction =
  | 'marcar_pagado_manual'
  | 'deshacer_pago'
  // ⚠️ LEGADO — NO USAR EN CÓDIGO NUEVO (SCRUM-207, decisión D-3 del fundador).
  // Cubría DOS hechos fiscales distintos con el mismo nombre: la anulación (SCRUM-153) y
  // la rectificativa R1. Se parte en `factura_anulada` / `factura_rectificada`. Las filas
  // ya escritas NO se tocan: reescribir un registro de auditoría para «limpiarlo» es
  // justamente lo que este módulo existe para impedir. La regla de unión para consultarlas
  // está en la §7.4 del contrato y vive en código en `auditoriaFiscal.query.ts`.
  | 'anular_factura'
  // Declarada desde A11.1 y JAMÁS escrita: no existe ningún camino de código que cambie un
  // flag (verificado en SCRUM-207: `flags` no aparece en ningún schema de validación ni en
  // ningún `merchant.update`). La escritura es manual del fundador contra la BD — ver
  // `core/flags.ts`. Se conserva declarada para el día que exista esa superficie (D-7).
  | 'cambio_flag'
  // SCRUM-14 (Parte L): traza del versionado del albarán — cada edición de un
  // albarán no firmado deja version++ y su registro aquí (decisión fundador 13-jul).
  | 'albaran_editado'
  // SCRUM-52 (carril A): autoría del operario congelada al crear el Trabajo desde el
  // accept (teamMemberId = creador del presupuesto; null = propietario).
  | 'operario_asignado'
  // SCRUM-66 (TRABAJO-4): el pro fija el tipo de operación del Trabajo (varias sueltas vs
  // trabajo único) → traza de que la decisión es del usuario/su asesor (caveat fiscal).
  | 'tipo_operacion_elegido'
  // SCRUM-25 (S2/S4): el merchant se descarga sus datos (CSV o paquete completo).
  // Queda traza de QUÉ fichero y con qué rango: es material que sale de la plataforma
  // con datos personales de los clientes finales.
  | 'datos_exportados'
  // ── SCRUM-244 · DERECHOS RGPD ───────────────────────────────────────────────────────
  // Los DOS instantes del art. 12.3, que da UN MES desde la solicitud. Están separados por un
  // humano A PROPÓSITO (opción C MIXTA, decisión del fundador 3-ago-2026): el profesional
  // SOLICITA desde su cuenta —eso arranca el plazo— y el fundador EJECUTA tras revisar.
  // Lo que hoy falta para cumplir no es poder exportar, que ya se puede: es poder DEMOSTRAR
  // que se atendió y cuándo.
  //
  // La fila de ATENCIÓN guarda en `entityId` el `id` de SU SOLICITUD. Esa correlación es lo que
  // permite contestar «¿cuántas llevan más de N días sin atender?», que es la única pregunta
  // que hace útil el registro. Detalle en `modules/exports/domain/portabilidadRegistro.ts`.
  | 'portabilidad_solicitada'
  | 'portabilidad_atendida'
  // ── SCRUM-207 · acciones FISCALES ───────────────────────────────────────────────────
  // A1 · se consume número de serie. **Punto de no retorno A** (SCRUM-200 §5). T1.
  | 'factura_emitida'
  // A5 · la factura entra en la cadena de huellas. **Punto de no retorno B**, que puede
  // ocurrir días después y que en C1/C2 lo dispara el CLIENTE descargando su PDF.
  | 'factura_sellada'
  // A6 · el sellado falló y el documento siguió su curso. Antes de esto solo quedaba un
  // `console.error` (lib/invoicing.ts:58 y :152): el fallo mudo del contrato §2.2.
  | 'sellado_fallido'
  // A7/A8 · las dos mitades de `anular_factura` (D-3).
  | 'factura_anulada'
  | 'factura_rectificada'
  // A9 · sale de la plataforma el registro fiscal (XML RRSIF de inspección, R13).
  | 'exportacion_fiscal'
  // A2/A3/A4 · el semáforo. A3 es BLOQUEANTE: si no consta la decisión, no se emite (D-2).
  //
  // 🚩 PUNTO DE ENGANCHE DE D-6 — DECLARADAS, TODAVÍA SIN ESCRITOR, y a propósito.
  // Escribir un aviso exige resolver su texto del CATÁLOGO VERSIONADO (contrato §6), y los
  // textos son regla 30: los aprueba el fundador, no se inventan. Hasta que existan, un
  // escritor solo podría guardar un identificador sin texto — es decir, exactamente el
  // registro incompleto que este ticket viene a evitar.
  //
  // Lo que SÍ queda montado para el ticket del front que las use:
  //   · `aviso_ambar_decidido` está en ACCIONES_BLOQUEANTES, así que `recordAudit` (fire-safe)
  //     NO la acepta: quien la escriba tendrá que usar `recordAuditOrThrow` y decidir qué
  //     hacer si falla. La garantía de D-2 no depende de que alguien se acuerde;
  //   · el sobre (`sobreFiscal`) ya lleva actor y flags congelados;
  //   · falta el bloque `aviso{ id, version, hash, texto, plantilla, variables }` del §5.2 y
  //     su guard (§8 T-1…T-4). Eso entra CON el catálogo, no antes.
  | 'aviso_ambar_mostrado'
  | 'aviso_ambar_decidido'
  | 'bloqueo_rojo_mostrado';

/**
 * Las que EXIGEN constancia: si no se pueden registrar, la acción NO ocurre.
 * Lista CERRADA — ampliarla es una decisión del fundador, no un detalle de implementación.
 */
// SCRUM-218b · `cambio_flag` entra aquí por decisión del fundador (29-jul-2026), y el motivo
// es de ALCANCE: la transacción de `cambiarFlagFiscal` protege ESE camino; esta lista protege
// el que alguien escriba mañana, en COMPILACIÓN y sin depender de ningún call site. Encender
// `INVOICING_ES_ENABLED` es el instante en que un profesional empieza a emitir con efectos
// fiscales: si eso llegara a registrarse con el `recordAudit` fire-safe, un fallo del log se
// tragaría y nos quedaríamos sin poder acreditar desde cuándo emite. Con la acción aquí, `tsc`
// lo impide ANTES de que exista el segundo escritor.
//
// SCRUM-221 · `exportacion_fiscal` entra aquí por decisión del fundador (29-jul-2026). Es la
// acción por la que los registros fiscales SALEN del sistema hacia una gestoría o una
// inspección: un pack que se descargó sin dejar rastro es exactamente lo que ese ticket
// impide. Mismo criterio que `factura_emitida`.
//
// ⚠️ CON UNA PRECISIÓN QUE HAY QUE LEER ANTES DE USAR ESTA FILA COMO PRUEBA, y que va aquí
// —y no solo en el ticket— porque quien la lea en una inspección tendrá el código delante,
// no el Jira:
//
//   `exportacion_fiscal` registra una PETICIÓN AUTORIZADA, NO UNA ENTREGA CONFIRMADA.
//
// El export NO es transaccional (a diferencia de `factura_emitida`, que se escribe dentro de
// la `$transaction` que consume el número). Aquí la fila se escribe ANTES de enviar los bytes,
// así que puede constar un export cuya descarga se cayó después — cliente que aborta, red que
// se corta. Se asume A CONCIENCIA: registrar de más es infinitamente menos grave que registrar
// de menos, que es lo que este ticket impide. Pero quien lea esta fila tiene que saber qué
// prueba (que alguien con permiso pidió el pack, cuándo, con qué alcance) y qué NO prueba
// (que el fichero llegara a su destino).
export const ACCIONES_BLOQUEANTES = [
  'factura_emitida',
  'aviso_ambar_decidido',
  'cambio_flag',
  'exportacion_fiscal',
  // SCRUM-244 · las dos de RGPD son BLOQUEANTES por el mismo motivo que `exportacion_fiscal`:
  // registrar de menos es lo único que este registro existe para impedir. Una solicitud que se
  // pierde en silencio deja un plazo legal corriendo que NADIE sabe que corre — y el día que
  // alguien pregunte, no hay nada que enseñar. Fire-and-forget aquí sería construir la prueba
  // y tirarla si el INSERT falla.
  'portabilidad_solicitada',
  'portabilidad_atendida',
] as const;
export type AuditActionBloqueante = (typeof ACCIONES_BLOQUEANTES)[number];
/** Todo lo demás. Es lo ÚNICO que `recordAudit` (fire-safe) acepta. */
export type AuditActionFireSafe = Exclude<AuditAction, AuditActionBloqueante>;

// ── EL SOBRE FISCAL (contrato §4.2) ───────────────────────────────────────────────────
// Decisión D-1 del fundador: **todo en `meta`, sin columnas nuevas.** En una tabla
// polimórfica cualquier columna nueva sería nullable, y una nullable no aporta integridad
// que un sobre declarado + guard no aporte ya.

export const SOBRE_VERSION = 1;

/**
 * Quién actúa. `teamMemberId = null` significaba «el propietario», y eso ya era falso: el
 * camino de emisión más transitado (C1) lo dispara el CLIENTE FINAL sin login. Sin este
 * campo, una factura emitida por el cliente quedaba atribuida al propietario.
 */
export type ActorTipo = 'pro_propietario' | 'pro_equipo' | 'cliente_final' | 'sistema' | 'psp';

export interface ActorAudit {
  tipo: ActorTipo;
  teamMemberId?: number | null;
  /** 'webhook:mp' | 'cron:x' | 'quote_token'… NUNCA el token en claro: sería un llavero. */
  ref?: string | null;
}

export interface SobreFiscal {
  v: number;
  actor: ActorAudit;
  /**
   * El modo fiscal EN EL MOMENTO del hecho, CONGELADO y no derivado — por el mismo motivo
   * que `vfPrevHash` se guarda como dato: dentro de un año, mirar el flag actual para
   * explicar por qué aquella factura salió `J-` es reconstruir, no probar.
   */
  flagsFiscales: { INVOICING_ES_ENABLED: boolean; SIF_ENABLED: boolean };
  [k: string]: unknown;
}

export function sobreFiscal(params: {
  actor: ActorAudit;
  flagsFiscales: { INVOICING_ES_ENABLED: boolean; SIF_ENABLED: boolean };
  payload?: Record<string, unknown>;
}): SobreFiscal {
  return {
    v: SOBRE_VERSION,
    actor: {
      tipo: params.actor.tipo,
      teamMemberId: params.actor.teamMemberId ?? null,
      ref: params.actor.ref ?? null,
    },
    flagsFiscales: params.flagsFiscales,
    ...(params.payload ?? {}),
  };
}

/**
 * El actor cuando hay una sesión del merchant detrás. `teamMemberId == null` sigue
 * significando «el propietario» — pero ahora se DICE (`pro_propietario`) en vez de
 * deducirse de un nulo, que es lo que hacía indistinguible al propietario del cliente
 * final y de un webhook.
 */
export function actorDeRequest(req: { teamMemberId?: number | null }): ActorAudit {
  const t = req.teamMemberId ?? null;
  return { tipo: t == null ? 'pro_propietario' : 'pro_equipo', teamMemberId: t };
}

/**
 * Los dos flags fiscales, resueltos y CONGELADOS a partir de un merchant ya leído. Si no
 * hay merchant a mano se devuelven en `false`, que es el default de la tabla P — nunca se
 * adivina «probablemente estaba encendido».
 */
export function flagsFiscalesDe(
  merchant: { id?: number | null; country?: string | null; flags?: unknown } | null,
): { INVOICING_ES_ENABLED: boolean; SIF_ENABLED: boolean } {
  if (!merchant) return { INVOICING_ES_ENABLED: false, SIF_ENABLED: false };
  return {
    INVOICING_ES_ENABLED: isFlagEnabled('INVOICING_ES_ENABLED', { merchant }),
    SIF_ENABLED: isFlagEnabled('SIF_ENABLED', { merchant }),
  };
}

export function requestIp(req: Request): string | null {
  const fwd = req.headers['x-forwarded-for'];
  const raw = Array.isArray(fwd) ? fwd[0] : (fwd || req.socket?.remoteAddress || '');
  return String(raw).split(',')[0].trim() || null;
}

export interface AuditParams<A extends AuditAction = AuditAction> {
  merchantId: number;
  teamMemberId?: number | null; // null = owner/admin implícito (ver `meta.actor` en lo fiscal)
  action: A;
  entityType?: string | null;
  entityId?: number | null;
  meta?: Record<string, unknown> | null;
  ip?: string | null;
}

/**
 * Cliente mínimo capaz de escribir el registro. Lo cumplen tanto el `prisma` global como
 * un `Prisma.TransactionClient`: esa es toda la gracia — poder escribir DENTRO de la
 * transacción de quien llama, para que el registro y el hecho se confirmen o se deshagan
 * juntos. Se tipa por estructura (y no como `Prisma.TransactionClient`) para que un test
 * pueda inyectar un doble que falle a propósito y probar el rojo.
 */
export interface AuditClient {
  auditLog: { create(args: { data: Record<string, unknown> }): Promise<unknown> };
}

function datosDe(params: AuditParams<AuditAction>): Record<string, unknown> {
  return {
    merchantId: params.merchantId,
    teamMemberId: params.teamMemberId ?? null,
    action: params.action,
    entityType: params.entityType ?? null,
    entityId: params.entityId ?? null,
    meta: (params.meta as any) ?? undefined,
    ip: params.ip ?? null,
  };
}

/**
 * **T3 · fire-safe.** No se espera y los fallos se tragan: un fallo del log JAMÁS tumba la
 * acción de negocio. Correcto para todo lo que NO es constitutivo de una prueba.
 *
 * No acepta las acciones bloqueantes: el tipo lo impide y `tsc` lo caza en cada tanda.
 */
export function recordAudit(params: AuditParams<AuditActionFireSafe>): void {
  prisma.auditLog
    .create({ data: datosDe(params) as any })
    .catch((e) => console.error('[audit] no se pudo registrar:', e?.message));
}

/**
 * **T1/T2 · se espera y PROPAGA.** Si el registro no se puede escribir, el error sube y
 * quien llama decide. Dentro de una `$transaction` (pasando `tx` como `client`) esa
 * decisión es automática: la transacción se deshace y el hecho no ocurre.
 *
 * No lleva `try/catch` A PROPÓSITO. Un `catch` aquí reconstruiría exactamente el fallo
 * mudo que este módulo viene a cerrar.
 */
export async function recordAuditOrThrow(
  params: AuditParams<AuditAction>,
  client: AuditClient = prisma as unknown as AuditClient,
): Promise<{ id: number }> {
  // SCRUM-244 · DEVUELVE LA FILA. Antes era `Promise<void>` y el cambio es ADITIVO: los
  // llamadores que la ignoran —todos los fiscales— siguen igual, porque `await` sobre un valor
  // que no se usa no cambia nada.
  //
  // Hace falta porque el registro de RGPD necesita el `id` de la SOLICITUD para que la fila de
  // ATENCIÓN pueda apuntar a ella. La alternativa era releer la fila recién escrita para
  // averiguar su id, que es una carrera contra uno mismo y además una consulta de más.
  return (await client.auditLog.create({ data: datosDe(params) })) as { id: number };
}
