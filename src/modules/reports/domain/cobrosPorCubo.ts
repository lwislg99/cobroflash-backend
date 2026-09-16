// src/modules/reports/domain/cobrosPorCubo.ts — SCRUM-488 fase 2
//
// ═════════════════════════════════════════════════════════════════════════════════════════
// EL INFORME «CÓMO TE PAGAN» AGRUPABA POR EL VALOR CRUDO, Y POR ESO EL TOTAL DE TARJETA IBA
// PARTIDO EN DOS FILAS CON EL MISMO NOMBRE
//
// Medido en la fase 1 (`docs/master/SCRUM-488.md`): `reports.routes.ts:164` usaba
// `inv.charge?.method` tal cual como clave del mapa. `card` —la PREFERENCIA que elige el
// profesional— y `card:stripe` —el HECHO que escribe la pasarela— son dos claves distintas, así
// que el informe las contaba por separado; y las dos se etiquetan «💳 Tarjeta», porque las dos son
// un cobro con tarjeta y el guard de SCRUM-398 lo exige. Resultado en pantalla:
//
//     💳 Tarjeta    3.210,40 €   (9)
//     💳 Tarjeta    2.870,15 €   (7)
//
// Dos filas idénticas con importes distintos, en ninguna parte el total de lo cobrado con tarjeta,
// y la barra de comparación dibujada sobre `maxEur` — o sea comparando dos TROZOS de la tarjeta
// contra la transferencia ENTERA.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// LA CLAVE PASA A SER EL CUBO, Y EL CUBO YA EXISTÍA AL LADO
//
// `cuboDeCobro` (SCRUM-474 fase 2) es lo que hace que el filtro de Cobros funcione: dice que
// `card` y `card:stripe` caen en el mismo sitio. El informe tenía esa función en el módulo de al
// lado y no la usaba. Aquí se usa, y no se toca ni un rótulo.
//
// ⚠️ **Esto NO es «Informes compone como Cobros»**, que es lo que proponía la fase 1 y se descartó:
// Cobros cuenta COBROS INDIVIDUALES —ahí cabe el detalle, «Bizum · manual»— e Informes cuenta
// FAMILIAS —ahí manda el cubo, «📲 Bizum»—. Dos rótulos distintos para el mismo dato no son un
// choque de vocabulario cuando las dos pantallas cuentan unidades distintas. El choque estaba en la
// AGRUPACIÓN, y es lo único que se arregla.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// 🔴 LO QUE `cuboDeCobro` NO CLASIFICA SE QUEDA EXACTAMENTE COMO ESTÁ
//
// `cuboDeCobro` devuelve `CUBO_SIN_METODO` para dos cosas MUY distintas: los valores que declaran
// que no consta el método (`manual`, `desconocido`) y los que nadie reconoce (lo que escriba algún
// día un escritor fuera del conjunto cerrado, regla 22). Meterlos todos en una fila «otros» sería
// inventar un cubo que nadie ha aprobado y —peor— fundir en una sola línea cosas que no son la
// misma: el profesional vería un importe agregado sin saber de qué.
//
// Así que **lo no clasificado NO se agrupa**: su clave sigue siendo su valor crudo y su fila sale
// igual que hoy, con su rótulo de hoy. En particular `manual` —que no es un valor de la base, lo
// FABRICA la ruta al leer una factura pagada sin `Charge`— se queda intacto: dice «✍️ Marcado a
// mano» en Informes y «Método no registrado» en Cobros, y las dos son ciertas porque hablan de
// cosas distintas (el método y el registro). Eso es SCRUM-491 y no se toca aquí.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// POR QUÉ LA FILA VIAJA CON UN VALOR DE `PAID_VIA` Y NO CON LA CLAVE DEL CUBO
//
// La vista resuelve el texto con `etiquetaMetodoCobro(m.method)` (SCRUM-398), un DICCIONARIO cuyas
// claves son valores de `paid_via` — y su guard comprueba, sobre el fuente de la vista, que esa
// llamada sigue ahí. La clave del cubo `bizum` NO es un valor de `paid_via`: mandarla haría que el
// profesional leyera «⚠️ Método no reconocido (bizum)» en la fila más normal de su informe.
//
// Por eso cada fila agrupada viaja con el **REPRESENTANTE** de su cubo: el primer valor de
// `PAID_VIA` que cae en él. No es una lista nueva ni un rótulo nuevo — se deriva del conjunto
// cerrado, y el rótulo que acaba pintándose es el que la familia YA tiene hoy:
//
//     cubo `card`     → `card`        → «💳 Tarjeta»
//     cubo `bizum`    → `bizum_auto`  → «📲 Bizum»
//     cubo `transfer` → `transfer`    → «🏦 Transferencia»
//     cubo `cash`     → `cash`        → «💶 Efectivo»
//
// ⚠️ Que el representante salga del ORDEN de `PAID_VIA` es lo que lo hace derivado en vez de
// escrito a mano, pero también significa que reordenar el conjunto podría cambiar el nombre de una
// familia (`bizum_auto` → `bizum_manual` haría que la fila dijera «📲 Bizum (confirmado a mano)»,
// que es el nombre de UNA de las dos y no el de la familia). Eso lo ata el test de SCRUM-488, que
// exige que la etiqueta del representante sea la del CUBO.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// CÉNTIMOS ENTEROS, por el mismo motivo que `desgloseEmpleado.ts`
//
// El invariante que este módulo tiene que cumplir es EXACTO: el total de la familia es la SUMA de
// las filas que absorbió, sin «salvo un céntimo». `Invoice.total` es `Decimal(12,2)`, así que en
// céntimos enteros no se pierde nada y la suma cuadra por construcción — y el test puede exigir
// igualdad estricta en vez de una tolerancia, que es donde se esconden los fallos.
import { PAID_VIA } from '../../billing/domain/paidVia';
import { cuboDeCobro, CUBO_SIN_METODO, metodoDeUnCobro } from '../../billing/domain/metodoDeCobro';

/** Un cobro tal y como lo lee el informe: el método ya resuelto y el importe de la factura. */
export interface CobroDelInforme {
  /** El método resuelto por `metodoDelCobro`. Cadena vacía = **no consta**. */
  metodo: string;
  /** `Invoice.total` — Decimal de Prisma, string o number. */
  total: unknown;
}

/** Una fila del informe «Cómo te pagan». */
export interface FilaDelInforme {
  /**
   * Lo que la vista traduce con `etiquetaMetodoCobro` (SCRUM-398). Para una familia es el
   * REPRESENTANTE del cubo; para lo que no se clasificó, el valor crudo, igual que hoy.
   */
  method: string;
  /** Lo que devolvió `cuboDeCobro` para los métodos de esta fila. Viaja para que la fila diga de qué familia es. */
  cubo: string;
  /** Los valores que la fila absorbió, ordenados. Una fila sin agrupar trae exactamente uno. */
  metodos: string[];
  eur: number;
  count: number;
}

/**
 * CON QUÉ CLAVE SE AGRUPA UN COBRO.
 *
 * El cubo cuando `cuboDeCobro` sabe clasificarlo; **el valor crudo cuando no**, para que esa fila
 * salga exactamente como salía. No hay tercer caso, y en particular no hay cubo «otros».
 *
 * NO SE EXPORTA a propósito, igual que `metodoDeclarado` en `metodoDeCobro.ts` (SCRUM-441): la
 * superficie pública de este módulo es `agruparCobrosPorCubo`, que es lo que de verdad decide qué
 * fila ve el profesional. Exportar el ayudante añadiría una puerta que nadie de fuera usa —lo caza
 * el guard de SCRUM-411— y haría que su test midiera un trozo en vez del contrato.
 */
function claveDeAgrupacion(metodo: string): string {
  const cubo = cuboDeCobro(metodo);
  return cubo === CUBO_SIN_METODO ? metodo : cubo;
}

/**
 * EL VALOR DE `PAID_VIA` QUE REPRESENTA A UN CUBO — el primero del conjunto que cae en él.
 *
 * Devuelve `null` para lo que no es un cubo con familia detrás (empezando por `sin-metodo`, que no
 * es un método sino la ausencia de uno). El llamante entonces se queda con el valor crudo.
 *
 * Tampoco se exporta, por el mismo motivo que `claveDeAgrupacion`.
 */
function representanteDelCubo(clave: string): string | null {
  if (clave === CUBO_SIN_METODO) return null;
  for (const via of PAID_VIA) {
    if (cuboDeCobro(via) === clave) return via;
  }
  return null;
}

/**
 * LAS FILAS DEL INFORME, agrupadas por cubo y ordenadas por importe descendente.
 *
 * Función pura: ni red ni BD, para que el guard de SCRUM-488 pueda ejercer la agrupación de verdad
 * —la que corre— en vez de una copia escrita a mano en el test.
 *
 * NO SE EXPORTA desde SCRUM-491: la superficie pública del módulo es `filasDelInforme`, que es lo
 * que la ruta llama. El guard de SCRUM-411 lo cazó en cuanto dejó de tener importador de fuera, y
 * la lección es la misma que en SCRUM-441: el test entra por el contrato, no por una pieza.
 */
function agruparCobrosPorCubo(cobros: readonly CobroDelInforme[]): FilaDelInforme[] {
  const porClave = new Map<string, { cubo: string; metodos: Set<string>; centimos: number; count: number }>();
  for (const c of cobros) {
    const clave = claveDeAgrupacion(c.metodo);
    const fila = porClave.get(clave)
      ?? { cubo: cuboDeCobro(c.metodo), metodos: new Set<string>(), centimos: 0, count: 0 };
    fila.metodos.add(c.metodo);
    fila.centimos += Math.round(Number(c.total) * 100);
    fila.count += 1;
    porClave.set(clave, fila);
  }
  return [...porClave.entries()]
    .map(([clave, v]) => ({
      // El representante NO puede quedarse en `null` sin que la fila pierda su nombre: si algún día
      // un cubo se queda sin ningún valor de `PAID_VIA` dentro, se pinta la clave —que es lo que
      // había— antes que dejar la celda vacía.
      method: representanteDelCubo(v.cubo) ?? clave,
      cubo: v.cubo,
      metodos: [...v.metodos].sort(),
      eur: v.centimos / 100,
      count: v.count,
    }))
    .sort((a, b) => b.eur - a.eur);
}

// ═════════════════════════════════════════════════════════════════════════════════════════
// SCRUM-491 · EL MÉTODO SALE DE `Invoice.paidVia`, Y EL REGISTRO DEJA DE OCUPAR SU COLUMNA
// ═════════════════════════════════════════════════════════════════════════════════════════
//
// El informe fabricaba `'manual'` al leer una factura pagada SIN `Charge` (`inv.charge?.method ||
// 'manual'`) y lo metía en la columna del método, donde se pintaba «✍️ Marcado a mano». Eso NO
// contesta la pregunta de esa columna:
//
//   · **MÉTODO** — por dónde entró el dinero. Vive en `Charge.method` o, desde SCRUM-441, en
//     `Invoice.paidVia` cuando el profesional lo declara al marcar la factura cobrada.
//   · **REGISTRO** — quién lo apuntó. Que no haya `Charge` significa que lo marcó una persona.
//
// Son dos hechos distintos y los dos son CIERTOS; el defecto era que el segundo ocupaba el sitio
// del primero. El profesional elegía «Bizum» al marcar el cobro y su informe seguía diciéndole
// «Marcado a mano», que es la respuesta a una pregunta que no hizo.
//
// 🔴 SIN BACKFILL, y por eso hay un tercer caso. Las facturas marcadas a mano ANTES de que la
// columna existiera no tienen el dato, y **no se les inventa uno**: salen como «no consta». Un
// método por defecto —«suele ser transferencia»— es exactamente el bug que `paidVia.ts` cierra.
//
// ⚠️ `Charge.method` MANDA sobre `Invoice.paidVia` cuando están los dos. No es un empate: uno lo
// confirma un WEBHOOK y el otro lo dice una persona (`paidVia.ts:17`), y ante una inspección son
// dos cadenas de evidencia distintas. La del hecho consumado gana.

/** La ausencia de método, para el informe. Es lo que `etiquetaMetodoCobro` ya pinta «⚠️ Sin método». */
const METODO_NO_CONSTA = '';

/** Una factura cobrada, con lo que el informe necesita para leerle el método y el registro. */
export interface FacturaDelInforme {
  total: unknown;
  /** SCRUM-441 · lo que el profesional DECLARA al marcar la factura cobrada a mano. */
  paidVia?: string | null;
  charge?: { method: string | null } | null;
}

/** Lo que el informe cuenta aparte: cobros que apuntó una persona, no una pasarela. */
export interface RegistroAMano {
  count: number;
  eur: number;
}

/**
 * POR DÓNDE ENTRÓ EL DINERO en una factura cobrada. **Cadena vacía = no consta.**
 *
 * Nunca devuelve `'manual'`: eso no es un método, es cómo se registró el cobro — y contestarlo aquí
 * era el defecto de este ticket.
 */
function metodoDelCobro(factura: FacturaDelInforme): string {
  // 🔴 SCRUM-499 · la regla NO vive aquí: es la misma que leen Cobros y el paquete de disputa.
  // Este módulo solo la traduce a la clave de agrupación que necesita el informe (la ausencia es
  // una cadena, no un `null`, porque con ella se agrupa).
  return metodoDeUnCobro(factura) ?? METODO_NO_CONSTA;
}

/**
 * ¿LO APUNTÓ UNA PERSONA? Una factura pagada sin `Charge` se marcó a mano en el panel.
 *
 * 🔴 Este hecho NO SE BORRA aunque hoy no se pinte: es real y útil —dice qué parte de la caja no
 * pasó por ninguna pasarela— y el sitio donde se le enseña al profesional es microcopy, que aprueba
 * el asesor (regla 30). Hasta entonces viaja en la respuesta, contado y con su importe, para que
 * nadie tenga que volver a deducirlo.
 */
function seRegistroAMano(factura: FacturaDelInforme): boolean {
  return !factura.charge;
}

/**
 * LAS FILAS DEL INFORME desde las facturas cobradas, y el registro contado aparte.
 *
 * Una sola función para las dos cosas porque salen del MISMO recorrido: separar el método del
 * registro es un solo cambio de lectura, y partirlo en dos sitios es cómo uno de los dos se queda
 * atrás cuando alguien toque el otro.
 */
export function filasDelInforme(facturas: readonly FacturaDelInforme[]): {
  byMethod: FilaDelInforme[];
  marcadosAMano: RegistroAMano;
} {
  const cobros: CobroDelInforme[] = [];
  let centimosAMano = 0;
  let countAMano = 0;
  for (const f of facturas) {
    cobros.push({ metodo: metodoDelCobro(f), total: f.total });
    if (seRegistroAMano(f)) {
      centimosAMano += Math.round(Number(f.total) * 100);
      countAMano += 1;
    }
  }
  return {
    byMethod: agruparCobrosPorCubo(cobros),
    marcadosAMano: { count: countAMano, eur: centimosAMano / 100 },
  };
}
