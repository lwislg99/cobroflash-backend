// src/modules/invoicing/domain/tipoDocumento.ts — SCRUM-413.
//
// LOS TIPOS DE DOCUMENTO, EN UNIÓN CERRADA, Y SU MAPEO AL CATÁLOGO DE LA AEAT.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// POR QUÉ ESTO EXISTE, MEDIDO POR EJECUCIÓN (SCRUM-413, 10-ago-2026)
//
// `Invoice.type` era `String @default("F1")` **sin enum, sin unión y sin guard** en los 211
// ficheros de `src/`, y el mapeo a la AEAT era, en DOS sitios:
//
//     inv.type === 'R1' ? 'R1' : 'F1'
//
// O sea: **todo lo que no fuera `R1` se declaraba F1, en silencio.** Alimentando el constructor de
// XML con una factura de cada tipo salía esto:
//
//     F1 → F1 ✅ · R1 → R1 ✅ · JUST → F1 🔴 · ANT → F1 🔴 · «LO-QUE-SEA» → F1 🔴
//
// Un justificante de cobro **no es una factura**: vive fuera de toda serie fiscal y el propio
// código se niega a sellarlo. Declararlo a Hacienda como factura completa, con el nombre del
// profesional encima, es el peor de los tres.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// POR QUÉ EL RESULTADO ES UNA UNIÓN ETIQUETADA Y NO UN `string | null`
//
// Hay **tres** desenlaces y son distintos entre sí:
//
//   · se declara, con su tipo del catálogo;
//   · **no se declara** —y es correcto—: el justificante;
//   · **no se sabe**: un tipo que nadie ha clasificado.
//
// Con `'F1' | 'R1' | null` los dos últimos se aplastan en el mismo `null`, y un llamador
// distraído trataría un tipo desconocido como «no declarable» — que es precisamente el silencio
// que este ticket viene a quitar. Con la unión etiquetada **el llamador tiene que mirar el motivo**,
// y el compilador no le deja olvidarse de uno.
//
// ⚠️ ESTE MÓDULO NO LANZA. Devuelve el veredicto y cada lado decide cómo fallar: en el sellado hay
// que **parar** (nada se sella), y en el paquete anual hay que **excluir con motivo** (el resto del
// ejercicio sigue siendo entregable). Si lanzara aquí, el segundo caso perdería el paquete entero
// por una factura. Y además evita el ciclo de imports: `RegistroNoEmitibleError` vive en
// `verifactu.service.ts`, que importa de aquí.

/**
 * Los tipos que el producto ESCRIBE hoy. Censo derivado por AST sobre `src/` (SCRUM-413): 13
 * escrituras a `invoice.create/update`, cero opacas, exactamente estos tres. El `@default` del
 * schema es `F1`, que es uno de ellos.
 *
 * ⚠️ `'ANT'` (anticipo) **NO está**, y es deliberado: hoy nadie lo escribe — es una reserva en un
 * comentario desde SCRUM-17 (`7500782`, 22-jul-2026) para FISCAL-1. Entra cuando P16.2 diga con qué
 * `TipoFactura` se sella. Mientras tanto, si alguien lo escribe, el sistema **para** en vez de
 * declararlo F1 por accidente — que es lo que hacía hasta hoy.
 */
export type TipoDocumento = 'F1' | 'R1' | 'JUST';

/** El veredicto. Tres desenlaces, no dos: ver la cabecera. */
export type Declarabilidad =
  | { declara: true; tipoAeat: 'F1' | 'R1' }
  | { declara: false; motivo: 'no_es_una_factura'; tipo: TipoDocumento }
  | { declara: false; motivo: 'tipo_desconocido'; tipo: string };

/**
 * El mapeo interno → AEAT, **explícito y exhaustivo**. `null` significa **no se declara**, y no es
 * lo mismo que un tipo: un `J-` no tiene sitio en el registro de facturación (P16.1 al asesor).
 *
 * Es un `Record<TipoDocumento, …>`: si mañana se añade un valor a la unión y no se le da entrada
 * aquí, **no compila**. Ésa es la diferencia con el `else` que había — el `else` nunca falta.
 */
export const AEAT_POR_TIPO: Readonly<Record<TipoDocumento, 'F1' | 'R1' | null>> = Object.freeze({
  F1: 'F1',
  R1: 'R1',
  // Fuera de toda serie fiscal (V0-0, regla 26). No se declara: ni F1, ni F2, ni con marcador.
  JUST: null,
});

/** ¿Es uno de los tipos que conocemos? */
export function esTipoConocido(tipo: unknown): tipo is TipoDocumento {
  return typeof tipo === 'string' && Object.prototype.hasOwnProperty.call(AEAT_POR_TIPO, tipo);
}

/**
 * El veredicto para un `Invoice.type` cualquiera, venga de donde venga —incluida una fila vieja de
 * la base escrita antes de que existiera esta unión—.
 *
 * ⚠️ Un tipo desconocido **NO se declara como F1 «por si acaso»**. Declarar de más ante Hacienda,
 * con el nombre de un profesional encima, es peor que no declarar: lo segundo se corrige, lo
 * primero ya se dijo.
 */
export function declarabilidadDe(tipo: string | null | undefined): Declarabilidad {
  if (!esTipoConocido(tipo)) {
    return { declara: false, motivo: 'tipo_desconocido', tipo: String(tipo) };
  }
  const aeat = AEAT_POR_TIPO[tipo];
  return aeat === null
    ? { declara: false, motivo: 'no_es_una_factura', tipo }
    : { declara: true, tipoAeat: aeat };
}
