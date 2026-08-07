// src/modules/fiscal/modelo303/modelo303.ts — SCRUM-295 (A5) · el 303 SOBRE el libro de A6.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// NO HAY UN SEGUNDO AGREGADOR. ESTO SUMA EL LIBRO.
//
// El 303 no vuelve a leer facturas ni a llamar a `calcVatBreakdown`: recibe el `LibroRegistro`
// de SCRUM-296 y suma su `porTipo`. Si el 303 y el libro contasen por caminos distintos, un día
// dirían cifras distintas — y el profesional tendría **dos documentos oficiales contradictorios**
// sin saber cuál miente: uno se lo entrega a Hacienda y el otro a su asesor.
//
// El invariante que lo sostiene, y que un test comprueba AL CÉNTIMO:
//
//     libro.base  = Σ bases de las casillas + base sin clasificar
//     libro.cuota = casilla 27              + cuota sin clasificar
//
// No es una igualdad ciega: dice que **cada euro del libro está o en una casilla o declarado
// como no clasificable**. Nada se evapora por el camino.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// EL SUELO, Y AQUÍ PESA MÁS QUE EN EL LIBRO
//
// Un 303 con todo a cero **no se lee como «no encontré nada»: se lee como una declaración de que
// no facturaste**. Por eso el resultado lleva SIEMPRE `miradas` y `asientos`, y `motivosParaNoFiarse`
// grita cuando hay facturas miradas y ninguna casilla rellena. Cero con `miradas: 0` es un
// trimestre sin actividad; cero con `miradas: 40` es un mecanismo roto, y no pueden verse igual.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// ⚠️ REGLA 24 · SE CONSTRUYE, NO SE ENCIENDE. Y REGLA 38 · esto es LECTURA
//
// No toca el camino de emisión: no compone números, no sella, no escribe. Y no afirma nada
// fiscalmente: el aviso de «orientativo» viaja DENTRO del resultado (`avisoObligatorio`) para que
// ningún consumidor pueda pintar un 303 sin él.
import type { LibroRegistro } from '../../invoicing/domain/libroRegistro';
import { TRIPLETAS, CASILLA_TOTAL_CUOTA_DEVENGADA, tripletaDe } from './casillas';

const r2 = (n: number) => Math.round(n * 100) / 100;

export interface CasillaRellena {
  tipo: number;
  casillaBase: number;
  casillaTipo: number;
  casillaCuota: number;
  base: number;
  cuota: number;
}

export interface OperacionSinClasificar {
  numero: string;
  tipo: number;
  base: number;
  cuota: number;
  motivo: 'tipo_cero' | 'tipo_sin_casilla';
}

export interface CruceConCobros {
  /** Cuota devengada de asientos cuyo estado dice que están cobrados. */
  cuotaDeCobradas: number;
  /** Cuota devengada de asientos que NO constan cobrados. */
  cuotaDeNoCobradas: number;
  /** Cuántos asientos caen en cada lado, para que el número tenga tamaño. */
  asientosCobrados: number;
  asientosNoCobrados: number;
}

export interface Modelo303 {
  año: number;
  trimestre: number;
  desde: string;
  hasta: string;
  moneda: string;
  casillas: CasillaRellena[];
  /** La 27: total de cuota devengada en régimen general. */
  casillaTotalCuota: { casilla: number; valor: number };
  totalBase: number;
  sinClasificar: OperacionSinClasificar[];
  sinDesglose: string[];
  cruceConCobros: CruceConCobros;
  miradas: number;
  asientos: number;
  motivosParaNoFiarse: string[];
  avisoObligatorio: string;
}

/**
 * El aviso que el diseño (A5) declara OBLIGATORIO: «no somos asesores fiscales».
 *
 * ⚠️ Va marcado (regla 30): el texto exacto no está aprobado. Viaja dentro del resultado, no en
 * la pantalla, para que ningún consumidor pueda pintar un 303 sin él — un resumen fiscal sin ese
 * aviso es un claim fiscal, y la regla 24 dice que esto se construye pero no se enciende.
 */
export const AVISO_ORIENTATIVO =
  '[PENDIENTE microcopy oficial] Resumen orientativo — consúltalo con tu asesor fiscal.';

/**
 * El trimestre natural, **con sus bordes dentro**.
 *
 * ⚠️ Fechas LOCALES a propósito: el trimestre fiscal es del calendario español, no de UTC.
 * Construirlo con `new Date('2026-04-01T00:00:00Z')` mete la última hora del 31 de marzo en el
 * segundo trimestre cuando el servidor va en UTC+2 — un euro cambiado de declaración, y el error
 * solo se ve en abril.
 */
export function rangoTrimestre(año: number, trimestre: number): { desde: Date; hasta: Date } {
  const t = Math.min(4, Math.max(1, Math.trunc(trimestre) || 1));
  return {
    desde: new Date(año, (t - 1) * 3, 1, 0, 0, 0, 0),
    // Día 0 del mes siguiente al último = último día del trimestre. Con su último milisegundo:
    // una factura emitida a las 23:59:59.700 del 30 de junio es del segundo trimestre.
    hasta: new Date(año, t * 3, 0, 23, 59, 59, 999),
  };
}

/** ¿El asiento consta COBRADO? Se mira el estado del documento, y nada más. */
function constaCobrado(estado: string | null): boolean {
  return estado === 'paid';
}

/**
 * Construye el 303 de un trimestre a partir del libro de ese mismo trimestre.
 *
 * El `libro` tiene que venir YA acotado al periodo (lo hace `leerModelo303`): filtrar aquí sería
 * un segundo criterio de fechas, y dos criterios acaban discrepando.
 */
export function construirModelo303(params: {
  libro: LibroRegistro;
  año: number;
  trimestre: number;
}): Modelo303 {
  const { desde, hasta } = rangoTrimestre(params.año, params.trimestre);

  const acumulado = new Map<number, { base: number; cuota: number }>();
  const sinClasificar: OperacionSinClasificar[] = [];
  const sinDesglose: string[] = [];
  let moneda = 'EUR';

  let cuotaDeCobradas = 0;
  let cuotaDeNoCobradas = 0;
  let asientosCobrados = 0;
  let asientosNoCobrados = 0;

  for (const a of params.libro.asientos) {
    if (a.moneda) moneda = a.moneda;

    // Sin desglose no se puede declarar: no se estima, se DICE. Una factura antigua sin líneas
    // metida en una casilla con un tipo supuesto es exactamente la adivinanza que este ticket
    // prohíbe.
    if (a.porTipo.length === 0) {
      sinDesglose.push(a.numero);
      continue;
    }

    let cuotaDelAsiento = 0;
    for (const e of a.porTipo) {
      cuotaDelAsiento += e.cuota;
      const tripleta = tripletaDe(e.tipo);
      if (!tripleta) {
        // Tipo 0 → no se puede saber si es exenta, no sujeta o ISP (SCRUM-212): sin calificación
        // en la factura, cualquier casilla sería inventada.
        // Otro tipo (5 %, 2 %…) → no tiene tripleta en este mapeo; tampoco se fuerza a la vecina.
        sinClasificar.push({
          numero: a.numero,
          tipo: e.tipo,
          base: e.base,
          cuota: e.cuota,
          motivo: e.tipo === 0 ? 'tipo_cero' : 'tipo_sin_casilla',
        });
        continue;
      }
      const acc = acumulado.get(e.tipo) ?? { base: 0, cuota: 0 };
      acc.base += e.base;
      acc.cuota += e.cuota;
      acumulado.set(e.tipo, acc);
    }

    // El cruce con los cobros. AVISA, no afirma: ver `cruceConCobros` abajo.
    if (constaCobrado(a.estado)) {
      asientosCobrados += 1;
      cuotaDeCobradas += cuotaDelAsiento;
    } else {
      asientosNoCobrados += 1;
      cuotaDeNoCobradas += cuotaDelAsiento;
    }
  }

  // Se recorren las TRIPLETAS, no el acumulado: una casilla sin operaciones va a 0,00 y sale
  // igual. Un impreso al que le falta la fila del 10 % no es un impreso más corto: es uno del que
  // no se sabe si esa fila es cero o si se perdió.
  const casillas: CasillaRellena[] = TRIPLETAS.map((t) => {
    const v = acumulado.get(t.tipo) ?? { base: 0, cuota: 0 };
    return {
      tipo: t.tipo,
      casillaBase: t.base,
      casillaTipo: t.tipoCasilla,
      casillaCuota: t.cuota,
      base: r2(v.base),
      cuota: r2(v.cuota),
    };
  });

  const totalCuota = r2(casillas.reduce((a, c) => a + c.cuota, 0));

  const motivosParaNoFiarse: string[] = [];
  if (params.libro.miradas > 0 && params.libro.asientos.length === 0) {
    motivosParaNoFiarse.push(
      `se revisaron ${params.libro.miradas} facturas y no salió ningún asiento: el libro no cuadra`,
    );
  }
  if (params.libro.asientos.length > 0 && casillas.every((c) => c.base === 0 && c.cuota === 0)
      && sinClasificar.length === 0 && sinDesglose.length === 0) {
    motivosParaNoFiarse.push(
      `hay ${params.libro.asientos.length} asientos y TODAS las casillas salen a cero sin nada declarado aparte`,
    );
  }
  if (sinDesglose.length > 0) {
    motivosParaNoFiarse.push(`${sinDesglose.length} factura(s) sin desglose no se han podido declarar`);
  }
  if (sinClasificar.length > 0) {
    motivosParaNoFiarse.push(
      `${sinClasificar.length} operación(es) sin calificación fiscal (exenta / no sujeta / ISP) no entran en ninguna casilla`,
    );
  }
  if (params.libro.importesIlegibles.length > 0) {
    motivosParaNoFiarse.push(`${params.libro.importesIlegibles.length} importe(s) ilegibles en el libro`);
  }

  return {
    año: params.año,
    trimestre: Math.min(4, Math.max(1, Math.trunc(params.trimestre) || 1)),
    desde: desde.toISOString(),
    hasta: hasta.toISOString(),
    moneda,
    casillas,
    casillaTotalCuota: { casilla: CASILLA_TOTAL_CUOTA_DEVENGADA, valor: totalCuota },
    totalBase: r2(casillas.reduce((a, c) => a + c.base, 0)),
    sinClasificar,
    sinDesglose,
    // ⚠️ ESTO AVISA, NO AFIRMA. Tres de las cinco formas de cobro se marcan A MANO y `paidAt` se
    // pone con `new Date()` en todas partes, así que el estado dice «alguien lo dio por cobrado»,
    // no «el euro entró este día». Sirve para avisar de cuánta cuota se declara sin haber
    // cobrado; NO para liquidar por criterio de caja — eso es E5 y no está construido.
    cruceConCobros: {
      cuotaDeCobradas: r2(cuotaDeCobradas),
      cuotaDeNoCobradas: r2(cuotaDeNoCobradas),
      asientosCobrados,
      asientosNoCobrados,
    },
    miradas: params.libro.miradas,
    asientos: params.libro.asientos.length,
    motivosParaNoFiarse,
    avisoObligatorio: AVISO_ORIENTATIVO,
  };
}
