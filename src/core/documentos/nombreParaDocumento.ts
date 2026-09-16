// src/core/documentos/nombreParaDocumento.ts — SCRUM-577 (CONT-04)
//
// QUÉ NOMBRE DEL CLIENTE SALE EN UN DOCUMENTO — la preferencia, en UN solo sitio.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// POR QUÉ EXISTE
//
// La regla «si hay denominación legal, ésa; si no, el nombre con el que se le conoce» estaba
// escrita **CINCO VECES A MANO**, medido el 24-ago-2026:
//
// ⚠️ SCRUM-636 · ESTA LISTA IBA POR NÚMERO DE LÍNEA Y CADUCÓ EN VEINTICUATRO HORAS. Decía
// `pdf.service.ts:482`, y esa línea se movió con el trabajo del propio SCRUM-577 que la escribió.
// REFERENCIAR POR POSICIÓN CADUCA; REFERENCIAR POR IDENTIDAD NO — así que ahora van por FUNCIÓN,
// que es lo que no se mueve al insertar código encima.
//
//   pdf.service.ts          · `generateQuotePdf` → `clientDisplay`
//   librosAeat.repo.ts      · el `nombre:` del mapa de clientes
//   albaran.service.ts      · el `const cliente` de la fuente del sellador
//   src/modules/jobs/domain/pendientesFacturar.service.ts (bandeja de pendientes)
//   exportData.ts           · la columna propia del CSV (caso aparte: no es la preferencia)
//
// Cinco copias de un criterio son cinco sitios donde divergir. Y sobre todo: **CONT-18
// (SCRUM-589) tiene que poder elegir qué nombre sale**, y con la regla repetida cinco veces ese
// ticket nace caro — tendría que encontrar las cinco antes de cambiar una. Con el criterio aquí,
// CONT-18 es cambiar ESTA función, no buscar.
//
// Es la misma forma que `IDENTIFICADORES` (SCRUM-578) dejó preparada para SCRUM-590.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// 🔴 ESTE MÓDULO NO CAMBIA NINGÚN COMPORTAMIENTO, Y ESO ES DELIBERADO
//
// Devuelve EXACTAMENTE lo que ya devolvían las cinco copias: `legalName || name`. No es una
// mejora disfrazada de refactor — es el mismo criterio, en un sitio. Si alguna llamada empezara
// a imprimir un nombre distinto, eso sería una regresión, no el objetivo.
//
// Medido antes de moverlo: **0 de 15 clientes tienen `legalName` relleno** (staging 0/4, dev
// 0/11, 24-ago-2026). O sea que hoy las cinco rutas caen todas al mismo `name` y este cambio es
// **inerte sobre los datos reales**. Se dice porque es la diferencia entre un cambio arriesgado y
// uno que no puede alterar nada todavía.
//
// ✅ CONT-18 (SCRUM-589) YA LLEGÓ, y entró por donde este comentario decía: **este fichero**.
// Sólo cambió una cosa respecto a lo previsto — la elección resultó ser POR DOCUMENTO y no por
// merchant (decisión del asesor, 6-sep-2026):
//
//   · por merchant habría necesitado una COLUMNA nueva, y hay cola de ALTERs sin aplicar;
//   · la víctima escrita («el profesional no puede evitarlo») se resuelve igual eligiéndolo en
//     cada documento;
//   · y el precedente más parecido del árbol, `Albaran.ocultarPreciosEnDocumento`, también vive
//     POR DOCUMENTO.
//
// Así que la preferencia viaja dentro de `Quote.docFields`, que ya era `Json`: cero migración.
// La preferencia POR MERCHANT —la capa de encima— es otro ticket, con su diff ya medido.

/** Lo mínimo que hace falta para decidir. Sirve tanto un `Customer` como un `Provider`. */
export interface ConNombres {
  name?: string | null;
  legalName?: string | null;
}

/**
 * SCRUM-589 (CONT-18) · LA ELECCIÓN, que este fichero llevaba escrito que iba a recibir.
 *
 * `usarRazonSocial` es **opcional y su ausencia significa `true`**, y eso no es pereza: es lo que
 * hace que los documentos YA GUARDADOS —que no traen el campo— y las cuatro rutas que no
 * preguntan nada (libro, albarán, bandeja de pendientes, factura) sigan imprimiendo EXACTAMENTE
 * lo de siempre. Un `boolean` con `!== false` es el mismo idioma que ya habla `docFields` en el
 * PDF (`!params.docFields || params.docFields[k] !== false`): se deriva, no se inventa otro.
 */
export interface OpcionesDeNombre {
  /** `false` = el profesional pidió el NOMBRE COMERCIAL en este documento. Ausente = como hoy. */
  usarRazonSocial?: boolean | null;
}

/**
 * El nombre del cliente que va impreso en un documento.
 *
 * Por defecto prefiere la **denominación legal** y cae al nombre con el que se le conoce — el
 * criterio que ya seguían las cinco copias. Desde SCRUM-589 el documento puede pedir lo
 * contrario, y entonces se invierte la PREFERENCIA, no el respaldo.
 *
 * 🔴 LOS DOS SENTIDOS CAEN AL OTRO NOMBRE, y es lo que sostiene dos de los controles del ticket:
 * un cliente sin razón social sale con su nombre comercial elija lo que elija, y uno sin nombre
 * sale con su razón social elija lo que elija. La elección decide QUIÉN VA PRIMERO, nunca deja
 * al documento sin nombre teniendo uno a mano.
 *
 * @param respaldo qué devolver cuando no hay ninguno de los dos. Cada documento tenía el suyo
 *   —`'—'` en el PDF, `null` en el libro y en el albarán— y **se respeta**: unificarlo sería
 *   cambiar lo que se imprime, que es justo lo que este módulo NO viene a hacer.
 * @param opciones la elección del DOCUMENTO. Omitirlo = el comportamiento de siempre.
 */
export function nombreParaDocumento<T extends string | null>(
  cliente: ConNombres | null | undefined,
  respaldo: T,
  opciones?: OpcionesDeNombre | null,
): string | T {
  const legal = (cliente?.legalName ?? '').trim();
  const comun = (cliente?.name ?? '').trim();
  // Ausente, `null` o `true` → la razón social manda, como siempre. Sólo un `false` explícito
  // invierte el orden: cualquier otra cosa cae del lado de lo que la pantalla lleva años haciendo.
  const primero = opciones?.usarRazonSocial === false ? comun : legal;
  const segundo = opciones?.usarRazonSocial === false ? legal : comun;
  if (primero) return primero;
  if (segundo) return segundo;
  return respaldo;
}
