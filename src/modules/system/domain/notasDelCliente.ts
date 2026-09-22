// src/modules/system/domain/notasDelCliente.ts — SCRUM-1036 (CRM-08)
//
// LAS NOTAS DEL CLIENTE, CON FECHA Y AUTOR — cada nota es un `CustomerEvent` de `type: 'nota'`.
// CONFIRMADO antes de construir (el ticket lo exige, regla 3/A5): `CustomerEvent` ya tiene
// `type`/`title`/`detail`/`meta` (`schema.prisma`, modelo `CustomerEvent`) — CERO ALTER.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// POR QUÉ EL TEXTO VA EN `title` Y NO EN `detail`
//
// La ficha (`customerDetailView.js`) ya pinta `title` en negrita y `detail` como línea
// secundaria para el resto de eventos (presupuesto enviado, factura emitida…). La nota ES el
// contenido principal — no una descripción de un hecho del sistema — así que va en `title`, el
// sitio que ya se lee en negrita. No se inventa un tercer campo para lo mismo.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// 🔴 EL AUTOR SE CONGELA COMO TEXTO, NUNCA SE RESUELVE EN VIVO
//
// `meta.authorName` se guarda en el momento de escribir la nota, igual que el emisor/cliente
// congelados de las facturas (SCRUM-665/729): un técnico que se borra después no puede dejar sus
// notas antiguas sin autor. `meta.teamMemberId` viaja también, `null` = el propietario — la MISMA
// convención que `Job.operarioId`/`Expense.teamMemberId` (SCRUM-52/109), pero NO se usa para
// resolver el nombre después: sólo queda como referencia.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// 🔴 EL TEXTO ANTIGUO (`Customer.notes`) NO SE BORRA NI SE COPIA A `CustomerEvent`
//
// Copiarlo sería un backfill — y esta casa ya aprendió con SCRUM-729 que un backfill no es un
// relleno inocente: aquí escribiría una fecha de autor que NADIE declaró (¿de cuándo es ese
// texto? ¿quién lo escribió?). En vez de inventar esos dos datos, `listarNotas` lo SINTETIZA como
// la nota más antigua, con fecha y autor **ausentes** (`fecha: null`, `autor: null`) — «ausente ≠
// vacío»: no hay fecha porque nunca se supo, no porque valga cero. El literal «Nota fija» es el
// que el propio ticket ya declaró entre comillas (regla 39: propuesto por el fundador, no
// inventado aquí).
import { prisma } from '../../../core/db/prisma';

export interface NotaDelCliente {
  id: number | 'fija';
  texto: string;
  fecha: Date | null;
  autor: string | null;
  esFija: boolean;
}

/** Quién escribe, congelado como texto. `teamMemberId` es sólo referencia, nunca se resuelve después. */
export interface AutorDeNota {
  teamMemberId: number | null;
  authorName: string;
}

/**
 * Resuelve el nombre a congelar en el momento de escribir. `teamMemberId: null` es el propietario
 * — se usa el nombre del NEGOCIO, la MISMA convención que `desglosarPorEmpleado` (SCRUM-228).
 */
export async function resolverAutor(merchantId: number, teamMemberId: number | null): Promise<AutorDeNota> {
  if (teamMemberId === null) {
    const negocio = await prisma.merchant.findUnique({ where: { id: merchantId }, select: { name: true } });
    return { teamMemberId: null, authorName: negocio?.name ?? 'Propietario' };
  }
  const miembro = await prisma.teamMember.findFirst({ where: { id: teamMemberId, merchantId }, select: { name: true } });
  // Si no se encuentra (borrado a mitad de la petición, o id de otro merchant), no se inventa un
  // nombre: el hueco se declara. Es un caso de carrera, no el «ya no existe» de después —
  // ÉSE se congela bien porque el nombre ya quedó escrito ANTES de que el miembro se borrara.
  return { teamMemberId, authorName: miembro?.name ?? 'Desconocido' };
}

/**
 * Crea una nota. Rechaza el texto vacío (caso límite del ticket): una nota en blanco no aporta
 * nada y ensuciaría la ficha para siempre (una nota, a diferencia de un borrador, no se edita).
 *
 * SIN TOPE DE LARGO A PROPÓSITO: el ticket lo deja explícito — «el tope lo decide J2: preguntar,
 * no inventarlo» (regla 27, prohibido inventar). Inventar un `.max(500)` aquí sería exactamente
 * eso: una decisión de producto que nadie ha tomado.
 */
export async function crearNota(
  merchantId: number,
  customerId: number,
  texto: string,
  autor: AutorDeNota,
) {
  const limpio = String(texto ?? '').trim();
  if (!limpio) throw new Error('nota_vacia');

  // TENENCIA (regla 2): el cliente tiene que ser de este merchant. Sin esto, un id de otro
  // merchant colaría una nota en una ficha ajena.
  const cliente = await prisma.customer.findFirst({ where: { id: customerId, merchantId }, select: { id: true } });
  if (!cliente) throw new Error('customer_not_found');

  return prisma.customerEvent.create({
    data: {
      merchantId,
      customerId,
      type: 'nota',
      title: limpio,
      meta: { authorName: autor.authorName, teamMemberId: autor.teamMemberId },
    },
  });
}

/**
 * Lista las notas de un cliente, de la más nueva a la más antigua, con la «Nota fija» (el texto
 * heredado de `Customer.notes`) al FINAL — es la más antigua por construcción: existía antes que
 * ninguna nota con fecha pudiera existir.
 *
 * `null` si el cliente no es de este merchant (la ruta responde 404).
 */
export async function listarNotas(merchantId: number, customerId: number): Promise<NotaDelCliente[] | null> {
  const cliente = await prisma.customer.findFirst({
    where: { id: customerId, merchantId },
    select: { notes: true },
  });
  if (!cliente) return null;

  const eventos = await prisma.customerEvent.findMany({
    where: { merchantId, customerId, type: 'nota' },
    // Orden estable (caso límite: dos notas en el mismo segundo): `id` desempata porque
    // `autoincrement()` sí es estrictamente creciente aunque `createdAt` coincida al segundo.
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
  });

  const notas: NotaDelCliente[] = eventos.map((e) => {
    const meta = (e.meta as { authorName?: string } | null) ?? null;
    return { id: e.id, texto: e.title, fecha: e.createdAt, autor: meta?.authorName ?? null, esFija: false };
  });

  // El texto heredado se sintetiza SOLO si tiene contenido: un `notes` vacío no crea «Nota fija»
  // (caso límite explícito del ticket).
  const legado = (cliente.notes ?? '').trim();
  if (legado) {
    notas.push({ id: 'fija', texto: legado, fecha: null, autor: null, esFija: true });
  }

  return notas;
}
