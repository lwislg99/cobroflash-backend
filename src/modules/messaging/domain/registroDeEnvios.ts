// src/modules/messaging/domain/registroDeEnvios.ts — SCRUM-501
//
// UNA FILA POR ENVÍO, ESCRITA AL ENVIAR.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// POR QUÉ EXISTE, Y POR QUÉ NO BASTABA CON TENER LA TABLA
//
// `email_messages` está en las tres bases (SCRUM-495 lo acreditó: 12 columnas, PK y 3 índices,
// idénticas en staging y producción), el modelo está en el esquema y la firma del webhook está
// construida. Y la tabla se quedaría **vacía para siempre**, porque nadie escribía una fila.
//
// 🔴 Un campo que existe en el esquema no es un campo que alguien escriba.
//
// La sesión 1 del receptor lo midió por el otro lado: `idDeLaRespuesta` —el que saca el
// `provider_id` de la respuesta del proveedor— tenía UN SOLO consumidor, la propia
// `constanciaCorreo.ts`. El id se calculaba y no se persistía, así que el
// `UPDATE … WHERE provider_id` del webhook no habría encontrado ninguna fila que actualizar.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// 🔴 LA REGLA QUE GOBIERNA ESTE FICHERO, Y ESTÁ IMPUESTA POR CONSTRUCCIÓN
//
//     Una escritura de telemetría no puede tumbar la operación que observa.
//
// `registrarEnvio` **NO LANZA NUNCA** y **NO SE QUEDA COLGADA NUNCA**. Las dos cosas van aquí
// dentro, no en cada llamador, porque una invariante repartida entre siete `try` es una invariante
// que alguien se olvida en el octavo. Una divergencia IMPOSIBLE gana a una vigilada.
//
// ⚠️ Y un `try` alrededor NO habría bastado: solo ve la excepción de lo que se espera con `await`.
// Por eso el `await` y el `catch` viven en la misma función, sobre la misma promesa.
//
// ⚠️ EL PLAZO no es adorno: sin él, una base que no contesta **retrasa el correo indefinidamente**,
// que es tumbar la operación por otro camino. Con él, el envío sigue y la fila se escribirá o no —
// es telemetría, y llegar tarde no la invalida.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// SIN BACKFILL, y es deliberado (SCRUM-475 fase 2 §4): los correos ya enviados no tienen fila y
// **no se les inventa una**. De ellos no consta nada, que es la verdad.
import { prisma as clientePorDefecto } from '../../../core/db/prisma';
import { maskEmail } from '../../../core/utils/utils';
import type { Constancia } from './constanciaCorreo';

/**
 * Cuánto se espera a la base antes de seguir sin fila. El correo manda; la fila acompaña.
 *
 * ⚠️ SIN `export` a propósito (SCRUM-494): su único consumidor está en este fichero, y el guard de
 * huérfanos avisó de que exportarlo solo servía para que lo leyera su test. Se prueba por la
 * SUPERFICIE PÚBLICA — `registrarEnvio` acepta `plazoMs`, y con él se ejercita el mecanismo.
 */
const PLAZO_ESCRITURA_MS = 3_000;

/**
 * 🔴 NINGUNA DIRECCIÓN EN CLARO FUERA DE `to_email`, y esto lo destapó un test, no una relectura.
 *
 * `error` guarda el mensaje del proveedor tal cual, y **ese mensaje suele traer el destinatario
 * dentro** («550 no such user ana@obra.example»). `CAMPOS_PERSONALES` cubre `emailMessage.toEmail`
 * (SCRUM-497) y NO cubre `error`: una dirección escondida ahí **sobreviviría a una supresión del
 * art. 17**, y el guard de SCRUM-497 no la vería porque vigila COLUMNAS, no contenidos.
 *
 * Se ataca la causa en vez de añadir un segundo vigilante: si la dirección no entra en claro, no hay
 * nada que anonimizar después. Una divergencia IMPOSIBLE gana a una vigilada.
 *
 * ⚠️ Se enmascara CUALQUIER cosa con forma de correo, no solo el destinatario: el mensaje puede
 * nombrar el remitente, un `reply-to` o la dirección de otro. Derivado de la forma, no de una lista.
 *
 * ⚠️ SIN `export` (SCRUM-494): su consumidor real está aquí dentro. Se prueba por la superficie
 * pública —`registrarEnvio` con un motivo que trae direcciones— y así el test comprueba lo que de
 * verdad importa: que la fila ESCRITA no las lleva, no que exista un ayudante que sabría quitarlas.
 */
function sinCorreosEnClaro(texto: string | null): string | null {
  if (!texto) return texto;
  return texto.replace(/[^\s<>()[\],;:"']+@[^\s<>()[\],;:"']+\.[A-Za-z]{2,}/g, (correo) => maskEmail(correo));
}

/**
 * 🔴 SCRUM-508 · LAS CLASES DE CORREO, CERRADAS. Una por emisor del árbol.
 *
 * Nace al cablear los cinco que faltaban: con `kind` como cadena libre, seis emisores escribiendo
 * su literal a mano son seis oportunidades de que dos digan lo mismo con palabras distintas —y
 * entonces la pregunta «¿se le envió el digest?» depende de acertar cómo lo escribió cada uno—.
 *
 * Al ser un tipo, un valor mal escrito **no compila**. Una divergencia imposible gana a una
 * vigilada, y no hace falta guard nuevo para sostenerlo.
 *
 * ⚠️ Un `kind` por EMISOR, no por correo concreto: ver el hueco declarado de `lifecycle` en
 * `docs/master/SCRUM-508.md`.
 */
export const CLASES_DE_CORREO = Object.freeze({
  /** La factura al cliente, con su PDF adjunto. */
  factura: 'invoice',
  /** El mismo camino cuando el documento es un justificante de cobro (reglas 24/26). */
  justificante: 'justificante',
  /** El presupuesto al cliente, con su enlace para firmar. */
  presupuesto: 'quote',
  /** El enlace de acceso de un solo uso. */
  enlaceDeAcceso: 'magic_link',
  /** La invitación a un miembro del equipo. */
  invitacion: 'invitacion',
  /** Los correos del ciclo de vida: bienvenida, día 3/7/12, prueba expirada, inactivo, primer pago. */
  cicloDeVida: 'lifecycle',
  /** El resumen semanal de los lunes. */
  resumenSemanal: 'digest',
  /** Los avisos al profesional: le pagaron, le aceptaron un presupuesto, le aprobaron uno. */
  avisoAlProfesional: 'aviso_pro',
  /** El mensaje que el profesional manda a soporte desde el panel. */
  soporte: 'soporte',
} as const);

export type ClaseDeCorreo = (typeof CLASES_DE_CORREO)[keyof typeof CLASES_DE_CORREO];

/**
 * Lo que el EMISOR no puede saber y su llamador sí. Sin `merchantId` no hay fila: la columna es
 * `NOT NULL` y **inventar un merchant sería peor que no tener la fila**.
 *
 * `kind` es qué clase de correo es, y sale de `CLASES_DE_CORREO`. También obligatorio: una fila que
 * no dice qué se mandó no responde a la pregunta para la que existe.
 */
export interface ContextoDeEnvio {
  merchantId: number;
  kind: ClaseDeCorreo;
  /** A qué cliente iba, si iba a uno. `null` cuando el destinatario es el propio profesional. */
  customerId?: number | null;
  /** `invoice` · `quote` · `charge`. Nulos si el emisor no lo sabe: no se inventa una relación. */
  relatedType?: string | null;
  relatedId?: number | null;
}

export interface ResultadoRegistro {
  escrita: boolean;
  /** Por qué no se escribió. `null` cuando sí se escribió. Para el log, nunca para el usuario. */
  motivo: 'sin_contexto' | 'sin_destino' | 'fallo_escritura' | 'plazo' | null;
  /** El id de la fila, cuando se escribió. Lo usa el test; nadie más lo necesita todavía. */
  id?: number;
}

/** El cliente mínimo que hace falta. Se inyecta para poder probar esto sin base de datos. */
export interface ClienteDeEnvios {
  emailMessage: { create: (args: { data: Record<string, unknown> }) => Promise<{ id: number }> };
}

/**
 * UNA fila por envío. Devuelve qué pasó y **no lanza jamás**.
 *
 * 🔴 `provider_id` va tal cual: si el proveedor no dio identificador, va **nulo**, y el `status` lo
 * dice con palabras (`aceptado_sin_identificador`). NO se inventa un id — un identificador
 * fabricado haría que el webhook actualizara la fila equivocada, o ninguna.
 *
 * 🔴 `updated_at` se escribe DESDE PRISMA (`@updatedAt`). La columna es `NOT NULL` sin default, así
 * que cualquier `INSERT` que no venga de aquí falla, y eso es a propósito.
 */
export async function registrarEnvio(args: {
  contexto?: ContextoDeEnvio | null;
  to: string;
  constancia: Constancia;
  cliente?: ClienteDeEnvios;
  plazoMs?: number;
}): Promise<ResultadoRegistro> {
  const { contexto, to, constancia } = args;

  // ── Lo que impide escribir, ANTES de tocar la base ────────────────────────────────────
  //
  // Los dos casos son `NOT NULL` en la tabla, y los dos se dicen en vez de rellenarse: una fila con
  // un merchant inventado contamina el registro de otro, y `to_email` sin destinatario no describe
  // ningún envío — porque no hubo envío al que ponerle destinatario.
  if (!contexto || !Number.isInteger(contexto.merchantId) || !contexto.kind) {
    return { escrita: false, motivo: 'sin_contexto' };
  }
  if (!to || !to.trim()) return { escrita: false, motivo: 'sin_destino' };

  const cliente = args.cliente ?? (clientePorDefecto as unknown as ClienteDeEnvios);
  const plazoMs = args.plazoMs ?? PLAZO_ESCRITURA_MS;

  // ⚠️ EL `await` Y EL `catch` SOBRE LA MISMA PROMESA. Si la escritura se lanzara sin esperar, este
  // `try` no vería nada: un rechazo que llega cuando el bloque ya terminó no lo captura nadie.
  let temporizador: NodeJS.Timeout | undefined;
  try {
    const escritura = cliente.emailMessage.create({
      data: {
        merchantId: contexto.merchantId,
        customerId: contexto.customerId ?? null,
        kind: contexto.kind,
        toEmail: to,
        // Nulo si no consta. El `@default` de la tabla es `aceptado_sin_identificador`, que es
        // exactamente este caso dicho con palabras.
        providerId: constancia.idProveedor,
        status: constancia.estado,
        // 🔴 El motivo va SIN DIRECCIONES EN CLARO: ver `sinCorreosEnClaro`. La única copia en claro
        // que este ticket crea es `to_email`, que sí está cubierta por `CAMPOS_PERSONALES`.
        error: sinCorreosEnClaro(constancia.motivo),
        relatedType: contexto.relatedType ?? null,
        relatedId: contexto.relatedId ?? null,
      },
    });
    const plazo = new Promise<'plazo'>((resolver) => {
      temporizador = setTimeout(() => resolver('plazo'), plazoMs);
      // No retiene el proceso: un envío no puede dejar el `node` vivo esperando a la telemetría.
      temporizador.unref?.();
    });
    const cual = await Promise.race([escritura, plazo]);
    if (cual === 'plazo') {
      // La escritura sigue su curso; simplemente no se la espera más. Y su rechazo se atiende aquí
      // para que no acabe en un `unhandledRejection` que tumbe el proceso.
      escritura.catch((e) => anotarFallo(to, e));
      console.error('[correo]', JSON.stringify({
        evento: 'registro_sin_confirmar', motivo: 'plazo', ms: plazoMs, to: maskEmail(to),
      }));
      return { escrita: false, motivo: 'plazo' };
    }
    return { escrita: true, motivo: null, id: cual.id };
  } catch (e) {
    anotarFallo(to, e);
    return { escrita: false, motivo: 'fallo_escritura' };
  } finally {
    if (temporizador) clearTimeout(temporizador);
  }
}

/**
 * La constancia de que no quedó constancia. Hacia dentro, y **en silencio hacia el usuario**: el
 * correo salió, y decirle al profesional que falló nuestra telemetría sería ruido que no puede
 * accionar.
 *
 * ⚠️ El destinatario va ENMASCARADO. Es dato personal, los logs de Railway los lee cualquiera con
 * acceso al panel, y la única copia en claro que este ticket crea es la columna `to_email` — que sí
 * está cubierta por `CAMPOS_PERSONALES` (SCRUM-497).
 */
function anotarFallo(to: string, e: unknown): void {
  console.error('[correo]', JSON.stringify({
    evento: 'registro_fallido', to: maskEmail(to),
    error: (e as { message?: string })?.message || String(e),
  }));
}
