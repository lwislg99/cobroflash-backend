// src/modules/jobs/domain/albaranContenidoFuentes.ts — SCRUM-438 (v:3)
//
// DE DÓNDE SALE CADA UNO DE LOS CINCO CAMPOS, SEGÚN LA VERSIÓN DEL SOBRE. **UN SOLO SITIO.**
//
// ═════════════════════════════════════════════════════════════════════════════════════════
// POR QUÉ ESTE MÓDULO EXISTE (decisión del asesor, 11-ago-2026 · opción C)
//
// Antes había DOS sitios decidiendo cómo se obtienen esos cinco datos: la receta al verificar y
// el ensamblado del PDF. **Dos sitios que derivan el mismo dato se desincronizan**, y en un
// documento firmado eso no es duplicación:
//
// > es la posibilidad de que existan **dos verdades sobre lo que se firmó** — el papel diciendo
// > una cosa y el sello certificando otra.
//
// Aquí se declara UNA vez. La receta y el PDF conforman a esta declaración, y hay un guard que lo
// comprueba **por versión** (ver `FUENTES_POR_VERSION` y el guard reapuntado de SCRUM-371).
//
// ⚠️ LO QUE ESTE MÓDULO **NO** HACE: no serializa, no ordena claves y no calcula hashes. El orden
// de claves de cada receta sigue siendo suyo, escrito entero y aparte — un helper compartido de
// ORDEN ataría una versión a otra, y eso sigue prohibido. Esto comparte **valores**, no forma.
//
// ═════════════════════════════════════════════════════════════════════════════════════════
// 🔴 LOS SOBRES v:1 Y v:2 NO CAMBIAN NI UN BIT
//
// Sus recetas están congeladas y **no se tocan**; este módulo solo declara, para ellas, lo que ya
// hacían. Si al leerlo parece que cambia algo de v:1 o v:2, es un error y hay que pararlo: la
// condición dura del ticket es que un PDF viejo imprima lo mismo carácter a carácter y que un
// sobre viejo verifique exactamente igual.

/** Las cinco claves del bloque congelado, en su orden. Congelada: un guard la cuenta. */
export const CLAVES_CONGELADAS = Object.freeze([
  'obra',
  'referenciaTrabajo',
  'cliente',
  'emisor',
  'emisorNif',
] as const);

export type ClaveCongelada = (typeof CLAVES_CONGELADAS)[number];

/** El bloque que v:3 guarda DENTRO del sobre. Las cinco, siempre. */
export type ContenidoCongelado = { [K in ClaveCongelada]: string | null };

/** Las fuentes VIVAS, tal y como las resuelven hoy el sellador, el barrido y el PDF. */
export interface FuentesVivas {
  jobDireccion: string | null;
  lugarEntrega: string | null;
  referenciaTrabajo: string | null;
  cliente: string | null;
  emisor: string | null;
  emisorNif: string | null;
}

export class ContenidoCongeladoIncompletoError extends Error {
  readonly faltan: string[];
  constructor(faltan: string[]) {
    super(
      `contenido_congelado_incompleto: falta(n) ${faltan.join(', ')}. El bloque tiene las ` +
      `${CLAVES_CONGELADAS.length} claves o NO EXISTE: un bloque a medias haría que la receta ` +
      'leyera `undefined` como si fuera un valor sellado, y eso NO se distingue de un `null` ' +
      'legítimo — que no es teórico, `obra` es null en todos los sobres de hoy. NO se completa ' +
      'con nulos: completar con nulos es fabricar el valor sellado que no se tenía.',
    );
    this.name = 'ContenidoCongeladoIncompletoError';
    this.faltan = faltan;
  }
}

export class VersionDeSobreDesconocidaError extends Error {
  readonly version: unknown;
  constructor(version: unknown, conocidas: readonly number[]) {
    super(
      `version_de_sobre_desconocida:${String(version)}. Este resolvedor sabe v:${conocidas.join(', v:')}. ` +
      'NO se aproxima con la más parecida: un despachador que elige una rama para una versión que ' +
      'no reconoce está ADIVINANDO, y un valor adivinado en un documento firmado es peor que un error ' +
      'ruidoso — coincidiría por accidente hasta el día que no.',
    );
    this.name = 'VersionDeSobreDesconocidaError';
    this.version = version;
  }
}

/**
 * 🔴 TODO O NADA (enmienda 1 del asesor, 11-ago-2026).
 *
 * Falla NOMBRANDO la clave que falta. No devuelve un bloque parcial ni lo completa.
 */
export function validarContenidoCongelado(bloque: unknown): ContenidoCongelado {
  if (bloque == null || typeof bloque !== 'object' || Array.isArray(bloque)) {
    throw new ContenidoCongeladoIncompletoError([...CLAVES_CONGELADAS]);
  }
  const b = bloque as Record<string, unknown>;
  const faltan = CLAVES_CONGELADAS.filter((k) => !Object.prototype.hasOwnProperty.call(b, k));
  if (faltan.length) throw new ContenidoCongeladoIncompletoError(faltan);
  const salida = {} as ContenidoCongelado;
  for (const k of CLAVES_CONGELADAS) {
    const v = b[k];
    salida[k] = v == null ? null : String(v);
  }
  return salida;
}

/**
 * DE DÓNDE SALE CADA CAMPO EN CADA VERSIÓN — la declaración que el guard compara con las recetas.
 *
 * `'congelado'` = del bloque dentro del sobre. Lo demás son nombres de `FuentesVivas`.
 *
 * ⚠️ Esto NO es documentación: es el dato del que sale `contenidoSegunVersion`, y el guard
 * reapuntado de SCRUM-371 lo cara contra lo que cada receta lee de verdad. Una fuente añadida en
 * silencio a cualquier versión vuelve a caer, que era lo que aquel guard quería impedir.
 */
export const FUENTES_POR_VERSION: Readonly<Record<number, Readonly<Record<ClaveCongelada, string>>>> = Object.freeze({
  // v:1 — `obra` salía de `Job.direccion`. Congelado desde el primer albarán firmado en v:1.
  1: Object.freeze({
    obra: 'jobDireccion',
    referenciaTrabajo: 'referenciaTrabajo',
    cliente: 'cliente',
    emisor: 'emisor',
    emisorNif: 'emisorNif',
  }),
  // v:2 (SCRUM-300) — `obra` cambió de fuente a `Albaran.lugarEntrega`. Los otros cuatro, vivos.
  2: Object.freeze({
    obra: 'lugarEntrega',
    referenciaTrabajo: 'referenciaTrabajo',
    cliente: 'cliente',
    emisor: 'emisor',
    emisorNif: 'emisorNif',
  }),
  // v:3 (SCRUM-438) — LOS CINCO salen del bloque congelado. Ninguna fila viva se consulta.
  3: Object.freeze({
    obra: 'congelado',
    referenciaTrabajo: 'congelado',
    cliente: 'congelado',
    emisor: 'congelado',
    emisorNif: 'congelado',
  }),
});

export const VERSIONES_CON_FUENTES: readonly number[] = Object.freeze(
  Object.keys(FUENTES_POR_VERSION).map(Number).sort((a, b) => a - b),
);

/**
 * Los CINCO campos, resueltos según la versión del sobre. **De aquí beben la receta v:3 y el PDF.**
 *
 * ⚠️ `version` nula o indefinida = **albarán SIN FIRMAR**, y NO es un error: manda el campo de hoy,
 * que es lo que el PDF necesita para pintar un borrador. Solo un NÚMERO que no se conoce lanza.
 * Confundir las dos cosas rompería el PDF de todos los albaranes no firmados.
 */
export function contenidoSegunVersion(
  version: number | null | undefined,
  fuentes: FuentesVivas & { contenidoCongelado?: unknown },
): ContenidoCongelado {
  if (version == null) {
    // Sin firmar: los campos de hoy. Es el estado de un borrador, no una versión desconocida.
    return {
      obra: fuentes.lugarEntrega || null,
      referenciaTrabajo: fuentes.referenciaTrabajo || null,
      cliente: fuentes.cliente || null,
      emisor: fuentes.emisor || null,
      emisorNif: fuentes.emisorNif || null,
    };
  }
  const mapa = Object.prototype.hasOwnProperty.call(FUENTES_POR_VERSION, version)
    ? FUENTES_POR_VERSION[version]
    : undefined;
  if (!mapa) throw new VersionDeSobreDesconocidaError(version, VERSIONES_CON_FUENTES);

  const congelado = Object.values(mapa).includes('congelado')
    ? validarContenidoCongelado(fuentes.contenidoCongelado)
    : null;

  const salida = {} as ContenidoCongelado;
  for (const clave of CLAVES_CONGELADAS) {
    const origen = mapa[clave];
    salida[clave] = origen === 'congelado'
      ? (congelado as ContenidoCongelado)[clave]
      // 🔴 `|| null`, NO `?? null`, y la diferencia NO es de estilo — es la CONDICIÓN DURA del
      // ticket. El `obraSegunVersion` al que esto sustituye colapsaba con `||`
      // (`fuentes.jobDireccion || null`), y el verificador colapsa igual en `normalizar()`. Con
      // `??`, una cadena vacía SOBREVIVE donde antes moría: el PDF de un albarán v:1 o v:2
      // imprimiría `''` donde hoy no imprime nada, y `recomputarHashDeEvidencia` sacaría OTRO
      // hash sobre un documento intacto. Medido: 12 combinaciones divergían.
      : ((fuentes as unknown as Record<string, string | null>)[origen] || null);
  }
  return salida;
}
