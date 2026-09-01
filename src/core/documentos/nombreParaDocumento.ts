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
//   src/modules/invoicing/infra/pdf/pdf.service.ts:482   (PDF de presupuesto)
//   src/modules/fiscal/librosAeat/librosAeat.repo.ts:58  (libro de la AEAT)
//   src/modules/jobs/domain/albaran.service.ts:637       (albarán)
//   src/modules/jobs/domain/pendientesFacturar.service.ts (bandeja de pendientes)
//   src/modules/exports/domain/exportData.ts:150         (columna propia del CSV, caso aparte)
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
// ⏳ PENDIENTE DE CONT-18 (SCRUM-589): ese ticket añade el control de «mostrar nombre comercial
// en facturas». Cuando llegue, **su sitio es este fichero**: pasará a recibir la preferencia del
// merchant y a decidir con ella. Aquí no se construye —no es su ticket— pero el hueco queda hecho.

/** Lo mínimo que hace falta para decidir. Sirve tanto un `Customer` como un `Provider`. */
export interface ConNombres {
  name?: string | null;
  legalName?: string | null;
}

/**
 * El nombre del cliente que va impreso en un documento.
 *
 * Prefiere la **denominación legal** y cae al nombre con el que se le conoce. Es el criterio que
 * ya seguían las cinco copias, sin cambiarlo.
 *
 * @param respaldo qué devolver cuando no hay ninguno de los dos. Cada documento tenía el suyo
 *   —`'—'` en el PDF, `null` en el libro y en el albarán— y **se respeta**: unificarlo sería
 *   cambiar lo que se imprime, que es justo lo que este módulo NO viene a hacer.
 */
export function nombreParaDocumento<T extends string | null>(
  cliente: ConNombres | null | undefined,
  respaldo: T,
): string | T {
  const legal = (cliente?.legalName ?? '').trim();
  if (legal) return legal;
  const comun = (cliente?.name ?? '').trim();
  if (comun) return comun;
  return respaldo;
}
