// src/modules/jobs/domain/jobDireccion.ts — SCRUM-424 (G3)
//
// LA DIRECCIÓN DE LA OBRA: quien la escribe, y a quién NO se le puede escribir.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// POR QUÉ SE TECLEA Y NO SE HEREDA — medido, no elegido por gusto
//
// La tentación evidente es «rellénala con la del cliente». **No se puede, por dos motivos, y el
// primero es que no existe:**
//
//   · `Customer` NO tiene dirección: ni `address`, ni `city`, ni `postal` (medido sobre el modelo
//     entero). `Quote` tampoco. El propio schema lo dice en `Job.direccion`: «sin fuente hoy (ni
//     Quote ni Customer la tienen) → se llenará en la UI (tarea futura)».
//   · Y aunque la tuviera, sería la dirección FISCAL de quien paga, no la de la obra. SCRUM-300 ya
//     tuvo que separarlas para el albarán: «el lugar del trabajo puede no ser el domicilio de quien
//     paga». Un enlace a mapa que lleva al sitio equivocado es PEOR que no tenerlo, porque el que
//     no existe no se sigue.
//
// Tampoco se deriva de `Albaran.lugarEntrega`: va al revés (el Trabajo contiene a los albaranes) y
// un Trabajo puede tener varios albaranes con lugares distintos — habría que elegir uno, y elegir
// por el sistema el sitio adonde conduce al profesional es justo lo que no se puede hacer.
//
// **Se teclea. No hay precedencia que definir porque no hay segunda fuente.**
import { obraSegunVersion } from './albaran.service';

/**
 * Mismo tope que `LUGAR_ENTREGA_MAX` (300) y con constante PROPIA, no importada: son dos datos
 * distintos —la dirección del Trabajo y el lugar de entrega de UN albarán— y compartir la constante
 * los ataría, de modo que cambiar el tope de uno movería el del otro sin que nadie lo pidiera. El
 * valor coincide porque los dos son direcciones postales españolas, no porque sean el mismo campo.
 */
export const JOB_DIRECCION_MAX = 300;

/**
 * Vacío se queda VACÍO. Nunca se cae a ninguna otra dirección «parecida» — misma regla que
 * `normalizarLugarEntrega`, y por el mismo motivo: sin dato no hay bloque y no hay enlace, que es
 * el comportamiento que ya funciona y que esta tarea no puede romper.
 */
export function normalizarJobDireccion(v: unknown): string | null {
  const s = String(v ?? '').trim().slice(0, JOB_DIRECCION_MAX);
  return s || null;
}

/** El código del 409 cuando escribir la dirección dejaría una evidencia firmada sin verificar. */
export const ERROR_DIRECCION_SELLADA = 'direccion_sellada_en_evidencia';

// SCRUM-424 · microcopy APROBADA (SCRUM-1124, comentario 17002, firma delegada del orquestador).
// Solo se ve en el caso raro de abajo: un Trabajo con un albarán firmado ANTES de SCRUM-300.
// Consta en `docs/microcopy/2026-09-25-SCRUM-1124-direccion-albaran-firmado.md`.
export const MSG_DIRECCION_SELLADA =
  'No se puede añadir la dirección a este trabajo: tiene un albarán ya firmado que la lleva ' +
  'dentro de su firma. Cambiarla dejaría esa firma sin poder verificarse.';

/**
 * 🔴 REGLA 29 · ¿LEE ESTA VERSIÓN DE SOBRE LA DIRECCIÓN DEL TRABAJO?
 *
 * Aquí está el peligro entero de esta tarea, y no es que se reescriba una evidencia —eso no pasa,
 * porque nadie toca la fila—. Es más silencioso:
 *
 *   · El sobre **v:1** calcula `obra` desde `Job.direccion` (`obraSegunVersion`), y lo hace **EN
 *     VIVO al verificar**: `albaranBarrido.ts` le pasa el `job.direccion` DE HOY, no el de aquel
 *     día. Nadie guardó una copia.
 *   · Todos los v:1 se sellaron con `direccion` a `null`, porque nadie la escribía nunca.
 *   · Así que el día que alguien la escriba, recalcular ese v:1 daría `obra: "Calle X"` donde el
 *     hash guardado dice `null` → **«no coincide» sobre un albarán intacto.**
 *
 * Es exactamente el fallo que el propio `obraSegunVersion` avisa para el otro eje: *«Verificar —o
 * imprimir— un documento v:1 con la regla de v:2 daría "no coincide" sobre un albarán intacto»*.
 * Mismo daño, otro disparador: no cambia la regla, cambia el dato que la regla lee.
 *
 * ⚠️ **Se PREGUNTA a `obraSegunVersion` con dos sondas en vez de comparar `v === 1`.** Un `=== 1`
 * escrito hoy se quedaría ciego el día que exista una v:3 que vuelva a leer el Trabajo, y ese día
 * el guard estaría verde mientras rompe firmas. Preguntándole a la función que de verdad decide,
 * esto no puede envejecer: si la receta cambia, la respuesta cambia con ella.
 */
// ─────────────────────────────────────────────────────────────────────────────────────────
// SCRUM-438 · LAS DOS SONDAS PASARON A SER TRES, Y LA VERSIÓN RARA YA NO REVIENTA
//
// v:3 no lee NINGUNA fuente viva: toma los cinco campos del bloque congelado del sobre. Con solo
// dos sondas, preguntarle por v:3 hacía **LANZAR** al resolvedor (el bloque no venía) — y a esta
// función la llama la ruta que escribe `Job.direccion`, así que un Trabajo con un albarán v:3
// firmado habría devuelto un 500 en vez de una respuesta. Por eso la sonda aporta también un
// bloque, con un TERCER valor distinto de los otros dos: así v:3 contesta «ninguna de las dos»,
// que es la verdad, en vez de reventar.
//
// 🔴 Y una versión que el resolvedor NO CONOCE se responde **`true` (depende → NO se escribe)**, no
// `false`. No es simetría: los dos errores no cuestan lo mismo. Negarse a escribir una dirección es
// un 409 que alguien resuelve mirando; escribirla sobre una firma que sí dependía de ella deja esa
// firma sin poder verificarse, y eso no se deshace (regla 29). Ante «no sé», se protege.
export function versionLeeJobDireccion(version: number | null | undefined): boolean {
  const SONDA_JOB = '\x00sonda:job.direccion';
  const SONDA_ALB = '\x00sonda:albaran.lugarEntrega';
  const SONDA_SOBRE = '\x00sonda:contenido-congelado';
  try {
    return obraSegunVersion(version, {
      jobDireccion: SONDA_JOB,
      lugarEntrega: SONDA_ALB,
      // Las cinco claves, porque el bloque es TODO O NADA. Solo `obra` lleva sonda: es el único
      // campo por el que esta función pregunta.
      contenidoCongelado: {
        obra: SONDA_SOBRE, referenciaTrabajo: null, cliente: null, emisor: null, emisorNif: null,
      },
    }) === SONDA_JOB;
  } catch {
    return true;
  }
}

/** Lo mínimo que hace falta saber de un albarán para decidir si su firma depende del Trabajo. */
export type AlbaranSellado = { numero: string; evidenciaFirma: unknown };

/**
 * Los albaranes de un Trabajo cuya firma **depende de `Job.direccion`**. Si devuelve alguno, la
 * dirección NO se puede escribir: hacerlo dejaría esas firmas sin verificar.
 *
 * Sin evidencia = sin firmar = no depende de nada. La versión sale del sobre GUARDADO (`v`), nunca
 * de la de hoy: es el mismo criterio que usa `recomputarHashDeEvidencia` para verificarlo, y tiene
 * que serlo — un guard que mirase otra versión que el verificador protegería lo que no toca.
 */
export function albaranesConFirmaQueDependeDelTrabajo(albaranes: readonly AlbaranSellado[]): string[] {
  return albaranes
    .filter((a) => {
      if (a.evidenciaFirma == null) return false;
      const v = (a.evidenciaFirma as { v?: number } | null)?.v;
      return versionLeeJobDireccion(v);
    })
    .map((a) => a.numero);
}
