// src/core/utils/concurrencia.ts — SCRUM-83
//
// Recorrer una lista con N tareas en vuelo como mucho, devolviendo los resultados EN EL ORDEN
// DE ENTRADA. Nace del export ZIP, donde el orden no es cosmético: los PDF entran al paquete
// en orden de factura y la lista de fallidos se le enseña al merchant.
//
// POR QUÉ NO `Promise.all` A SECAS: lanzaría las N tareas de golpe. En el export eso son N
// llamadas simultáneas a `ensureInvoicePdf`, cada una con sus consultas — con 100 facturas se
// agota el pool de conexiones de Prisma y el remedio sale peor que la enfermedad. El límite es
// la mitad del mecanismo, no un detalle de implementación.
//
// POR QUÉ NO UNA DEPENDENCIA (`p-limit` y compañía): son 15 líneas y este repo mantiene el
// árbol de dependencias corto a propósito.

/**
 * Aplica `fn` a cada elemento con como mucho `limite` tareas en vuelo.
 *
 * · El resultado sale SIEMPRE en el orden de `items`, pase lo que pase con los tiempos.
 * · Si `fn` rechaza, el rechazo se propaga (como `Promise.all`). Quien necesite tolerar
 *   fallos por elemento —el export lo necesita— captura dentro de `fn` y devuelve un
 *   resultado etiquetado. Se deja así a propósito: un helper que se traga excepciones en
 *   silencio es justo el que hace desaparecer errores que nadie pidió esconder.
 */
export async function mapearConLimite<T, R>(
  items: readonly T[],
  limite: number,
  fn: (item: T, indice: number) => Promise<R>,
): Promise<R[]> {
  const total = items.length;
  const salida = new Array<R>(total);
  if (total === 0) return salida;

  // Nunca más trabajadores que elementos (no sirven de nada) ni menos de uno (con `limite`
  // 0 o negativo el bucle no arrancaría y la función colgaría para siempre en silencio —
  // peor que ir lento).
  const trabajadores = Math.max(1, Math.min(Math.trunc(limite) || 1, total));

  let siguiente = 0;
  const trabajador = async (): Promise<void> => {
    for (;;) {
      const i = siguiente++;
      if (i >= total) return;
      salida[i] = await fn(items[i], i); // el índice conserva el orden de entrada
    }
  };

  await Promise.all(Array.from({ length: trabajadores }, trabajador));
  return salida;
}
