// src/modules/fiscal/librosAeat/librosAeat.ts — SCRUM-325 (E4).
//
// ENTREGA por periodo el libro que CONSTRUYE A6 (SCRUM-296). No lo recalcula.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// LA FRONTERA DE ESTE FICHERO, y es la razón de que exista aparte
//
// A6 decide QUÉ es un asiento (base, cuota, desglose por tipo, enlaces). Aquí solo se decide
// CÓMO SALE: qué columnas, en qué orden, con qué formato y de qué periodo. Si algún día una
// cifra de aquí no cuadra con el libro, el defecto está en este fichero — nunca al revés,
// porque aquí no se suma nada.
//
// Por eso NO se importa `calcVatBreakdown` ni se toca el camino de emisión (regla 38): este
// módulo recibe el libro ya construido y lo formatea.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// 🔴 LO QUE ESTE FICHERO **NO** ENTREGA, Y HAY QUE DECIRLO ANTES QUE NADA
//
// **NO hay libro de facturas RECIBIDAS, y no se puede construir hoy.** No es una omisión de
// alcance: el dato no existe. Medido en SCRUM-321 (E0, Q2) sobre el DMMF, de los ocho datos
// que pide un asiento de compra hay **dos completos, uno a medias y cinco que no existen**:
//
//   · NIF del proveedor ....... NO (`Provider` no tiene ningún campo fiscal)
//   · Base imponible .......... NO (`Expense` solo tiene `amount`, y nada dice si es base o total)
//   · Tipo de IVA ............. NO
//   · Cuota de IVA ............ NO
//   · ¿Deducible? ............. NO
//   · Nº y serie del proveedor. NO
//
// Un gasto de YaQu hoy es **un apunte de caja para calcular margen, no un asiento**. Rellenar
// esas columnas con `amount` y un IVA supuesto sería inventar los datos fiscales de alguien y
// entregárselos a Hacienda con su nombre encima. Se declara el hueco y se entrega lo que sí hay.
//
// ⚠️ Por eso `LIBROS_DISPONIBLES` tiene UN elemento y no dos. El día que `Expense` gane esos
// campos, se añade aquí — y hasta entonces la ausencia se ve, en vez de salir un libro de
// recibidas vacío que se lee como «este trimestre no compré nada».
import type { LibroRegistro, AsientoLibro } from '../../invoicing/domain/libroRegistro';

/**
 * ⚠️ MICROCOPY SIN APROBAR (regla 30). Los rótulos van con marcador Y con la propuesta porque un
 * fichero con doce cabeceras idénticas no se puede ni revisar. Nada de esto llega al profesional
 * sin que el fundador apruebe el texto: mientras el marcador esté, el fichero se ve provisional
 * de un vistazo, que es justo lo que se quiere.
 *
 * 🔴 Y NO se llama «Libro Registro de la AEAT» en ninguna parte del código ni de la UI. Ese
 * nombre es una PROMESA (regla 7 y el propio ticket: «la palabra es la promesa»), y no hay en
 * este árbol ningún documento oficial contra el que se haya contrastado el formato. Las columnas
 * son las del libro de A6, ordenadas como las pide un libro de expedidas; declararlo conforme es
 * una decisión del fundador, no de este fichero.
 */
export const MARCA_PENDIENTE = '[PENDIENTE]';

/**
 * Las columnas, con su CLAVE estable (la que usan los tests y no cambia al aprobar el texto) y su
 * rótulo provisional. Separar las dos cosas es lo que permite aprobar microcopy sin tocar ni un
 * test: el vector congelado de R1 se ancla en las claves.
 */
export const COLUMNAS_EXPEDIDAS = Object.freeze([
  { clave: 'fechaExpedicion', rotulo: 'Fecha de expedición' },
  { clave: 'serieNumero', rotulo: 'Serie y número' },
  { clave: 'tipoFactura', rotulo: 'Tipo de factura' },
  { clave: 'nifDestinatario', rotulo: 'NIF del destinatario' },
  { clave: 'nombreDestinatario', rotulo: 'Nombre del destinatario' },
  { clave: 'baseImponible', rotulo: 'Base imponible' },
  { clave: 'tipoIva', rotulo: 'Tipo de IVA (%)' },
  { clave: 'cuotaIva', rotulo: 'Cuota de IVA' },
  { clave: 'totalFactura', rotulo: 'Total de la factura' },
  /**
   * 🔴 LA ÚNICA SIN APROBAR, y su motivo está MEDIDO (7-ago-2026).
   *
   * Esta celda es `Invoice.status` VERBATIM (`libroRegistro.ts:216`), y ese campo mezcla DOS ejes
   * en una sola palabra. Medido sobre lo que de verdad se escribe en él:
   *
   *   · COBRO ....... `pending` (el default del schema) → `paid`
   *   · ANULACIÓN ... `annulled`
   *
   * No hay estado de EMISIÓN: una factura con número está emitida por definición, el número ES la
   * identidad fiscal. Así que «Estado» a secas no describe una cosa, describe dos — y en un
   * documento que sale de casa eso se lee mal en la dirección peor: alguien puede entender
   * «pendiente de emitir» donde pone «pendiente de cobro».
   *
   * ⚠️ `already_paid` NO es un valor de este campo: es un campo de RESPUESTA de la API
   * (`invoice.routes.ts:88`). Se anota porque aparece en un grep y se lee como si lo fuera.
   *
   * Se queda con marcador a propósito: un marcador es mejor que una cabecera ambigua.
   */
  { clave: 'estado', rotulo: `${MARCA_PENDIENTE} Estado` },
] as const);

/** Lo único que hoy se puede entregar. Ver el bloque 🔴 de arriba para por qué no hay recibidas. */
export const LIBROS_DISPONIBLES = Object.freeze([
  { clave: 'expedidas', rotulo: 'Facturas emitidas', columnas: COLUMNAS_EXPEDIDAS },
]);

/** Lo que hace falta saber del cliente para el libro. Se RESUELVE, no se calcula. */
export interface DatosDestinatario {
  nombre: string | null;
  nif: string | null;
}

export interface FilaLibro {
  [clave: string]: string | number | null;
}

/**
 * 🔴 EL SUELO, y en este módulo es el asunto entero.
 *
 * Un periodo sin asientos y un lector que no supo mirar producen **el mismo fichero en blanco**, y
 * significan lo contrario: el primero es correcto y el segundo se le manda a Hacienda diciendo que
 * no facturaste. `LibroRegistro.miradas` es lo que los separa —A6 lo expone justo para esto— así
 * que aquí se EXIGE: sin ese número no se emite fichero, se lanza.
 *
 * No se «arregla» devolviendo cero filas: cero filas es una respuesta legítima y por eso no puede
 * ser también la respuesta al fallo.
 */
export function exigirLibroLegible(libro: unknown): asserts libro is LibroRegistro {
  const l = libro as LibroRegistro | null | undefined;
  if (!l || typeof l !== 'object' || !Array.isArray(l.asientos) || typeof l.miradas !== 'number') {
    throw new Error(
      '🔴 NO SE PUDO LEER EL LIBRO DE REGISTRO (`leerLibroRegistro`, SCRUM-296/A6). No se emite ' +
        'fichero.\n\n' +
        '  Un periodo SIN facturas y un libro que no se pudo leer dan el MISMO fichero vacío, y ' +
        'significan lo contrario: el primero es correcto, el segundo declara ante un tercero que ' +
        'no se facturó. `miradas` es lo que los distingue (cuántas facturas se examinaron), así ' +
        'que si no viene, no hay nada que entregar.',
    );
  }
}

/** ¿Entra el asiento en el periodo? La comparación es por INSTANTE, con los dos extremos dentro. */
export function entraEnPeriodo(fechaIso: string | null, desde: Date, hasta: Date): boolean {
  if (!fechaIso) return false;
  const t = new Date(fechaIso).getTime();
  if (!Number.isFinite(t)) return false;
  return t >= desde.getTime() && t <= hasta.getTime();
}

/**
 * Una fila por TIPO DE IVA, no por factura: un libro de expedidas desglosa por tipo, y una factura
 * con 21 % y 10 % son dos apuntes. El desglose lo trae A6 en `porTipo` — aquí no se recalcula.
 *
 * ⚠️ Una factura con el importe ILEGIBLE (`importeIlegible`) no sale como `0,00`: sale con las
 * celdas de importe VACÍAS. Un cero es una afirmación —«facturó cero»— y aquí no se sabe.
 */
export function filasDeAsiento(a: AsientoLibro, destinatario: DatosDestinatario): FilaLibro[] {
  const comun = {
    fechaExpedicion: a.fecha ? String(a.fecha).slice(0, 10) : null,
    serieNumero: a.numero,
    tipoFactura: a.tipo,
    nifDestinatario: destinatario.nif,
    nombreDestinatario: destinatario.nombre,
    estado: a.estado,
  };

  if (a.importeIlegible) {
    return [{ ...comun, baseImponible: null, tipoIva: null, cuotaIva: null, totalFactura: null }];
  }

  const porTipo = Array.isArray(a.porTipo) ? a.porTipo : [];
  if (porTipo.length === 0) {
    return [{ ...comun, baseImponible: a.base, tipoIva: null, cuotaIva: a.cuota, totalFactura: a.total }];
  }

  // El total va SOLO en la primera fila del desglose: repetirlo en cada tipo haría que una suma
  // de la columna diera el total multiplicado por el número de tipos.
  return porTipo.map((t, i) => ({
    ...comun,
    baseImponible: t.base,
    tipoIva: t.tipo,
    cuotaIva: t.cuota,
    totalFactura: i === 0 ? a.total : null,
  }));
}

/**
 * El libro de expedidas del periodo, ya en filas. `destinatarios` resuelve `clienteId` → NIF y
 * nombre; lo que no se pueda resolver sale VACÍO, nunca inventado ni rellenado con el id.
 */
export function filasLibroExpedidas(
  libro: LibroRegistro,
  destinatarios: Map<number, DatosDestinatario>,
  periodo?: { desde: Date; hasta: Date },
): FilaLibro[] {
  exigirLibroLegible(libro);
  const dentro = periodo
    ? libro.asientos.filter((a) => entraEnPeriodo(a.fecha, periodo.desde, periodo.hasta))
    : libro.asientos;

  return dentro.flatMap((a) => {
    const d = (a.clienteId != null ? destinatarios.get(a.clienteId) : null) ?? { nombre: null, nif: null };
    return filasDeAsiento(a, d);
  });
}
