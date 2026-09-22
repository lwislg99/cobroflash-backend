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
import { prisma } from '../../../core/db/prisma';
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
export function aplicarEtiquetaMasiva(
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
 * Aplica la acción a la selección ENTERA de un merchant.
 *
 * TENENCIA (regla 2): se leen solo los clientes de `merchantId`, y se escriben con el mismo
 * `merchantId` en el `where`. Un id de la selección que no sea de este merchant (o no exista) se
 * declara «No encontrado» y no revela nada de a quién pertenece de verdad.
 */
export async function etiquetarSeleccion(
  merchantId: number,
  ids: number[],
  accion: AccionEtiqueta,
  etiqueta: string,
): Promise<ResultadoEtiquetadoMasivo> {
  const idsUnicos = [...new Set(ids)].filter((id) => Number.isInteger(id) && id > 0);
  if (idsUnicos.length === 0) return { actualizados: 0, resultados: [] };

  const clientes = await prisma.customer.findMany({
    where: { id: { in: idsUnicos }, merchantId },
    select: { id: true, tags: true },
  });
  const porId = new Map(clientes.map((c) => [c.id, c]));

  const resultados: ResultadoFila[] = [];
  const escrituras: { id: number; siguiente: ReturnType<typeof tagsParaPrisma> }[] = [];

  for (const id of idsUnicos) {
    const cliente = porId.get(id);
    if (!cliente) { resultados.push({ id, actualizado: false, motivo: 'No encontrado' }); continue; }
    const { resultado, siguiente } = aplicarEtiquetaMasiva(cliente, accion, etiqueta);
    resultados.push(resultado);
    if (resultado.actualizado) escrituras.push({ id, siguiente: siguiente! });
  }

  if (escrituras.length) {
    // Una transacción por escritura: cada cliente cambia a un valor DISTINTO (el suyo), así que
    // no se puede resolver con un solo `updateMany`. Van todas juntas para que la selección se
    // aplique de una vez y no a medias si algo falla a mitad.
    await prisma.$transaction(
      escrituras.map(({ id, siguiente }) =>
        prisma.customer.updateMany({ where: { id, merchantId }, data: { tags: siguiente } })),
    );
  }

  return { actualizados: escrituras.length, resultados };
}
