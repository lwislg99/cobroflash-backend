// src/modules/system/domain/etiquetadoMasivo.ts — SCRUM-1059 (CRM-17)
//
// AÑADIR/QUITAR UNA ETIQUETA A VARIOS CLIENTES A LA VEZ. La selección hoy solo cuenta
// (`filtroClientes.js`, SCRUM-582); esto es la primera acción en bloque.
//
// 🔴 UN CLIENTE QUE NO SE PUEDE ACTUALIZAR NO TUMBA A LOS DEMÁS (regla del ticket). Por eso
// `aplicarEtiquetaMasiva` es PURA y por-cliente: decide sin tocar la base, y el llamador escribe
// solo los que SÍ cambian. Un cliente con 20 etiquetas que intenta añadir la 21 se declara «ya
// tiene 20» y el resto de la selección sigue su camino.
//
// La MISMA decisión que el alta y la edición manual (`tagsDelCliente.ts`): límite 20×40,
// comparación sin distinguir mayúsculas, `ausente ≠ vacío`. No se reinventa aquí.
//
// SCRUM-411 · `aplicarEtiquetaMasiva` NO SE EXPORTA. Su único consumidor real está DENTRO de este
// fichero (`etiquetarSeleccion`); exportarla solo para que su test la llamara directo era un
// `export` que no le servía a nadie más — el trinquete de huérfanos lo cazó y tenía razón. Se mide
// por la SUPERFICIE PÚBLICA: `etiquetarSeleccion` recibe el `cliente` (Prisma o un doble) por
// PARÁMETRO, el mismo patrón que `importarClientes.service.ts` — así su test puede ejercer la
// decisión entera, incluida esta función, sin Postgres.
import { tagsDe, normalizarTags, tagsParaPrisma, LARGO_MAXIMO, MAXIMO_POR_CLIENTE } from '../tagsDelCliente';

export type AccionEtiqueta = 'add' | 'remove';

export interface ResultadoFila {
  id: number;
  actualizado: boolean;
  motivo?: string;
}

interface ClienteConTags {
  id: number;
  tags: unknown;
}

/**
 * Decide qué le pasa a UN cliente. Pura: no consulta ni escribe nada.
 *
 * `null` en `siguiente` cuando no hay que escribir nada (no actualizado). Cuando SÍ se actualiza,
 * `siguiente` es la traducción lista para Prisma (`tagsParaPrisma`), la MISMA que usan el alta y
 * la edición — no una segunda decisión sobre `DbNull` vs `[]`.
 */
function aplicarEtiquetaMasiva(
  cliente: ClienteConTags,
  accion: AccionEtiqueta,
  etiquetaBruta: string,
): { resultado: ResultadoFila; siguiente: ReturnType<typeof tagsParaPrisma> | null } {
  const etiqueta = String(etiquetaBruta ?? '').trim().slice(0, LARGO_MAXIMO);
  if (!etiqueta) {
    return { resultado: { id: cliente.id, actualizado: false, motivo: 'Etiqueta vacía' }, siguiente: null };
  }

  const actuales = tagsDe(cliente);
  const clave = etiqueta.toLocaleLowerCase('es');
  const yaLaTiene = actuales.some((t) => t.trim().toLocaleLowerCase('es') === clave);

  if (accion === 'add') {
    if (yaLaTiene) {
      return { resultado: { id: cliente.id, actualizado: false, motivo: 'Ya la tenía' }, siguiente: null };
    }
    if (actuales.length >= MAXIMO_POR_CLIENTE) {
      return {
        resultado: { id: cliente.id, actualizado: false, motivo: `Ya tiene ${MAXIMO_POR_CLIENTE} etiquetas` },
        siguiente: null,
      };
    }
    return {
      resultado: { id: cliente.id, actualizado: true },
      siguiente: tagsParaPrisma(normalizarTags([...actuales, etiqueta])),
    };
  }

  // accion === 'remove'
  if (!yaLaTiene) {
    return { resultado: { id: cliente.id, actualizado: false, motivo: 'No la tenía' }, siguiente: null };
  }
  const restantes = actuales.filter((t) => t.trim().toLocaleLowerCase('es') !== clave);
  return {
    resultado: { id: cliente.id, actualizado: true },
    // `restantes` puede quedar `[]`: `normalizarTags([])` ya lo traduce a `null` (ausente ≠ vacío).
    siguiente: tagsParaPrisma(normalizarTags(restantes)),
  };
}

export interface ResultadoEtiquetadoMasivo {
  actualizados: number;
  resultados: ResultadoFila[];
}

/**
 * Lo mínimo que `etiquetarSeleccion` necesita de Prisma — o de un doble en el test.
 *
 * `Function` y no una firma estricta, el mismo motivo que `ClienteMinimo` en
 * `importarClientes.service.ts`: fijar los tipos exactos de Prisma aquí ataría este contrato a la
 * forma exacta de sus argumentos, y lo único que este módulo necesita es que exista el método.
 */
export interface ClienteParaEtiquetadoMasivo {
  customer: { findMany: Function; updateMany: Function };
  $transaction: Function;
}

/**
 * Aplica la acción a la selección ENTERA de un merchant.
 *
 * TENENCIA (regla 2): se leen solo los clientes de `merchantId`, y se escriben con el mismo
 * `merchantId` en el `where`. Un id de la selección que no sea de este merchant (o no exista) se
 * declara «No encontrado» y no revela nada de a quién pertenece de verdad.
 *
 * `cliente` entra por PARÁMETRO (Prisma en la ruta, un doble en el test) — el mismo patrón que
 * `importarClientes.service.ts`. Así la decisión entera, incluida `aplicarEtiquetaMasiva`, se mide
 * sin Postgres, y la tenencia y la transacción de verdad se miden aparte, contra base real
 * (`scrum1059b-...-postgres.test.mjs`).
 */
export async function etiquetarSeleccion(
  merchantId: number,
  ids: number[],
  accion: AccionEtiqueta,
  etiqueta: string,
  cliente: ClienteParaEtiquetadoMasivo,
): Promise<ResultadoEtiquetadoMasivo> {
  const idsUnicos = [...new Set(ids)].filter((id) => Number.isInteger(id) && id > 0);
  if (idsUnicos.length === 0) return { actualizados: 0, resultados: [] };

  const clientes: ClienteConTags[] = await cliente.customer.findMany({
    where: { id: { in: idsUnicos }, merchantId },
    select: { id: true, tags: true },
  });
  const porId = new Map(clientes.map((c) => [c.id, c] as const));

  const resultados: ResultadoFila[] = [];
  const escrituras: { id: number; siguiente: ReturnType<typeof tagsParaPrisma> }[] = [];

  for (const id of idsUnicos) {
    const c = porId.get(id);
    if (!c) { resultados.push({ id, actualizado: false, motivo: 'No encontrado' }); continue; }
    const { resultado, siguiente } = aplicarEtiquetaMasiva(c, accion, etiqueta);
    resultados.push(resultado);
    if (resultado.actualizado) escrituras.push({ id, siguiente: siguiente! });
  }

  if (escrituras.length) {
    // Una transacción por escritura: cada cliente cambia a un valor DISTINTO (el suyo), así que
    // no se puede resolver con un solo `updateMany`. Van todas juntas para que la selección se
    // aplique de una vez y no a medias si algo falla a mitad.
    await cliente.$transaction(
      escrituras.map(({ id, siguiente }) =>
        cliente.customer.updateMany({ where: { id, merchantId }, data: { tags: siguiente } })),
    );
  }

  return { actualizados: escrituras.length, resultados };
}
