// src/modules/exports/domain/seleccionExport.ts — SCRUM-138 (export selectivo)
//
// QUÉ ES: la decisión PURA de "qué entra en el paquete", separada de cómo se arma el ZIP.
// Vive aparte para poder probarla sin BD, sin red y sin generar un solo PDF — que es
// justamente lo que hace falta cuando lo que se está probando es un GATE.
//
// ⚠️ LOS GATES DE SCRUM-25 NO SE RELAJAN. Elegir un dataset NO abre otro:
//   · El gate de ROL (admin-only) es anterior a esto y vive en el montaje del router.
//   · El XML VeriFactu sigue dependiendo de INVOICING_ES_ENABLED (regla 24/26, SCRUM-73).
//     Pedir "facturas" NO lo enciende: aquí solo se decide si CABE pedirlo, y el flag manda
//     igual. Por eso `xml` se calcula como AND del flag y de la selección, nunca como OR.
//   · La conservación fiscal (regla 16) y el criterio RGPD de los datos de cliente (S4) son
//     de la fuente de cada dataset, no de esta selección.
//
// FALLO SEGURO ELEGIDO: una selección vacía, ausente o ilegible = TODO (el comportamiento de
// SCRUM-25, que es el que el usuario tiene hoy). Nunca "nada": un ZIP vacío que parece
// correcto es peor que uno completo — el mismo criterio que ya rige el paquete incompleto.

export const DATASETS = ['clientes', 'facturas', 'cobros', 'trabajos', 'presupuestos', 'gastos'] as const;
export type Dataset = typeof DATASETS[number];

export interface SeleccionExport {
  datasets: Set<Dataset>;
  /** ¿Entran los PDF de factura? Solo si se pidieron las facturas. */
  pdfs: boolean;
  /** ¿Entra el XML VeriFactu? Solo si se pidieron facturas Y el flag lo permite. */
  xml: boolean;
  /** true si no se acotó nada: el paquete completo de siempre. */
  esCompleto: boolean;
}

/**
 * `incluir` viene del query param (`?incluir=facturas,gastos`). Se acepta lo que se entienda
 * y se IGNORA lo que no: un dataset mal escrito no puede tumbar la descarga entera de un
 * merchant que está preparando una inspección. Si no queda nada válido, se devuelve todo.
 *
 * `xmlPermitido` lo decide el llamante con el gate de SIEMPRE (flag + país + NIF): esta
 * función no consulta flags, solo los respeta.
 */
export function resolverSeleccion(incluir: unknown, xmlPermitido: boolean): SeleccionExport {
  const pedidos = String(incluir ?? '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter((s): s is Dataset => (DATASETS as readonly string[]).includes(s));

  const esCompleto = pedidos.length === 0;
  const datasets = new Set<Dataset>(esCompleto ? DATASETS : pedidos);

  // Los PDF y el XML son "de facturas": sin facturas en el paquete no pintan nada, y
  // meterlos igual haría que un export de "solo clientes" tardase lo que tarda renderizar
  // cien PDFs (el coste medido en SCRUM-83) sin que nadie los haya pedido.
  const conFacturas = datasets.has('facturas');

  return {
    datasets,
    pdfs: conFacturas,
    // AND, nunca OR: pedir facturas no puede encender el XML si el flag está OFF (regla 24).
    xml: conFacturas && xmlPermitido,
    esCompleto,
  };
}

/** Nombre de fichero de cada dataset dentro de `csv/`, para el LEEME y el propio ZIP. */
export const NOMBRE_CSV: Record<Dataset, string> = {
  clientes: 'clientes.csv',
  facturas: 'facturas.csv',
  cobros: 'cobros.csv',
  trabajos: 'trabajos.csv',
  presupuestos: 'presupuestos.csv',
  gastos: 'gastos.csv',
};
