// src/modules/jobs/domain/albaranEdicion.ts — SCRUM-361 (H6 · fase 2)
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// LA VÍCTIMA, EN UNA LÍNEA
//
// Dos pestañas, o dos personas del mismo equipo, abren el mismo albarán. Una corrige las líneas y
// guarda. La otra guarda después, con lo que tenía en pantalla. **El trabajo de la primera
// desaparece y nadie se entera**: no hay error, no hay aviso, y el albarán queda con una `version`
// más alta que hace creer que todo fue bien.
//
// La fase 1 (SCRUM-361, ya en `main`) cerró esto en el momento de FIRMAR. Aquí se cierra en el
// momento de EDITAR, que es el otro lado de la misma puerta: el PATCH hacía
// `version: { increment: 1 }` a ciegas, sin mirar nunca contra qué versión venía escribiendo el
// editor. **El último que escribe ganaba, en silencio.**
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// 🔴 POR QUÉ ESTO DELEGA Y NO REIMPLEMENTA — Y ES LO MÁS IMPORTANTE DEL FICHERO
//
// La pregunta que hay que contestar aquí es LITERALMENTE la misma que contesta la fase 1: «¿la
// versión que traes es la que hay ahora, sabiendo que "no traes ninguna" NO es "traes la buena"?».
//
// Había dos formas de tenerla en los dos sitios:
//
//   REIMPLEMENTARLA AQUÍ   dos funciones que hoy dicen lo mismo y que mañana pueden separarse sin
//                          que nadie lo note. Haría falta un guard que las compare, y un guard que
//                          vigila una divergencia es peor que una divergencia imposible.
//   DELEGAR EN LA DE LA    una sola implementación. No hay nada que comparar porque no hay dos
//   FASE 1                 cosas: la segunda ES la primera.
//
// **Se delega.** No se ha tocado `albaranFirmante.ts` —el mecanismo de firma se LEE, modificarlo es
// STOP (regla 38)— y no hacía falta: importar es leer.
//
// Lo único que cambia entre las dos superficies es **quién lee el rechazo**. En la fase 1 lo lee un
// CLIENTE en la página pública, y su texto lo aprobó el asesor. Aquí lo lee el PROFESIONAL en el
// dashboard, y ese texto **todavía no está aprobado** (regla 30): por eso esta función devuelve
// código y NO mensaje. Ver `docs/master/SCRUM-361.md` § fase 2.
import { puedeFirmarEstaVersion } from './albaranFirmante';

/**
 * 🔴 El código es `albaran_cambiado_al_editar` y no `conflict`: quien lo lea en un log tiene que
 * saber QUÉ pasó sin abrir el fichero. Es hermano de `albaran_cambiado` (fase 1, al firmar) y se
 * distingue de él a propósito — la acción que le toca al front es otra: allí «vuelve a mirarlo
 * antes de firmar», aquí «tus cambios no se han guardado porque el documento se movió».
 */
export const ERROR_ALBARAN_CAMBIADO_AL_EDITAR = 'albaran_cambiado_al_editar';

/**
 * ¿PUEDE ESTE EDITOR ESCRIBIR? — la comparación, en el dominio y NO en la ruta.
 *
 * Vive aquí por lo mismo que `exigirNombreFirmante` y que `puedeFirmarEstaVersion`: *una
 * comparación escrita dentro de una ruta es una comparación que la siguiente ruta no hará*. Hoy
 * escribe contenido un solo sitio (el PATCH), y el guard de la fase 1 existe precisamente para
 * enterarnos el día que sean dos.
 *
 * ⚠️ **SI LA VERSIÓN NO LLEGA, NO SE ESCRIBE.** Un dashboard viejo en la caché del service worker,
 * o un cliente de API de antes de esta fase, manda el PATCH sin versión — y eso NO es «coincide»:
 * es «no sé qué estaba viendo». La asimetría de coste manda igual que en la fase 1: un guardado
 * rechazado cuesta recargar y repetir; **una edición pisada no se deshace y encima parece que se
 * guardó**. Ante la duda, se bloquea.
 *
 * Consecuencia declarada, no descubierta: mientras un navegador tenga el JS anterior a esta fase,
 * sus ediciones se rechazan hasta que recargue. Es el lado seguro del error, y es el que se elige.
 */
export function puedeEditarEstaVersion(
  vistaPorElEditor: unknown,
  laDeAhora: number,
): { ok: true } | { ok: false; error: string } {
  // 🔴 UNA SOLA IMPLEMENTACIÓN. Si algún día esto deja de delegar y se escribe aquí la comparación
  // a mano, `tests/scrum361-version-al-editar.test.mjs` lo caza por AST: el día que existan DOS
  // reglas de versión, se separarán en silencio y este mecanismo dejará de significar lo que dice.
  const mismaRegla = puedeFirmarEstaVersion(vistaPorElEditor, laDeAhora);
  if (!mismaRegla.ok) return { ok: false, error: ERROR_ALBARAN_CAMBIADO_AL_EDITAR };
  return { ok: true };
}
