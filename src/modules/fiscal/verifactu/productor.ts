// src/modules/fiscal/verifactu/productor.ts — SCRUM-247 · QUIÉN FABRICA ESTE SOFTWARE, ANTE LA AEAT.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// POR QUÉ CONSTANTES DEL REPO Y NO VARIABLES DE ENTORNO
//
// Estos cinco datos identifican a YaQu como PRODUCTOR del sistema informático de facturación
// ante la Agencia Tributaria. Viajan dentro de cada registro VeriFactu que se emite.
//
// Cambiar el NIF del productor **es un hecho fiscal, no una configuración**. Como constante
// aparece en un diff, se revisa y queda fechado; como variable de un panel, alguien la cambia un
// martes y no queda rastro de quién ni de cuándo. Decisión del fundador (2-ago-2026), y no es
// hipotética: la SL está en constitución y ese NIF va a cambiar.
//
// ⚠️ EL DEFECTO QUE CIERRA, medido: estas cinco vivían SOLO en el panel de Railway. Estaban en
// staging y **NO en producción** — el log de arranque de producción lo decía literalmente. Con
// ellas sin poner, encender `INVOICING_ES_ENABLED` no emite nada: el emisor falla en claro con
// `verifactu_productor_no_configurado`. Eran precondición de SCRUM-218 y nadie lo veía desde el
// código. Y en desarrollo era peor todavía: `.env.local` no las define, así que un `npm run dev`
// emitía productor VACÍO sin avisar.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// LO QUE NO EXISTE, Y ES DELIBERADO
//
// **No hay override por entorno.** Ni de test. Se evaluó y se descartó por el fundador: un camino
// que SUSTITUYE la identidad fiscal va contra la razón de ser de esto, aunque viviera solo en los
// tests y fuese visible — una puerta que existe se acaba usando. Los tests emiten XML con la
// identidad real, que además es más fiel a producción y no sale de la máquina.
//
// Si algún día hiciera falta un productor distinto por entorno, se decide y se escribe aquí: no
// se resuelve con una variable de entorno que reintroduzca el agujero que este fichero cierra.
//
// ⚠️ Un guard (`tests/scrum247-productor-constante.test.mjs`) impide que vuelvan a leerse de
// `process.env`, y otro exige que NINGUNA esté vacía — porque el peligro no desapareció, cambió
// de forma: antes era «¿y si el entorno no las trae?», ahora es «¿y si alguien deja una constante
// vacía en un PR?». Sin ese segundo test, esto sería cambiar un fail-open vigilado por uno
// invisible.

/** Razón social del PRODUCTOR del software (no del merchant que factura). */
export const VERIFACTU_PRODUCTOR_NOMBRE = "<Luis Lara Granado>";

/** NIF del productor. Cambiarlo es un HECHO FISCAL: que se vea en el diff es el objetivo. */
export const VERIFACTU_PRODUCTOR_NIF = "<02290074X>";

/** Id del sistema informático. EXACTAMENTE 2 posiciones (XSD); la AEAT rechaza con 1177. */
export const VERIFACTU_ID_SISTEMA = "01";

/** Versión declarada del SIF. */
export const VERIFACTU_VERSION = "1.0.0";

/** Número de instalación del sistema. */
export const VERIFACTU_NUM_INSTALACION = "1";

/** Las cinco juntas, para quien necesite recorrerlas (el guard de no-vacías, por ejemplo). */
export const PRODUCTOR_VERIFACTU = {
  VERIFACTU_PRODUCTOR_NOMBRE,
  VERIFACTU_PRODUCTOR_NIF,
  VERIFACTU_ID_SISTEMA,
  VERIFACTU_VERSION,
  VERIFACTU_NUM_INSTALACION,
} as const;
