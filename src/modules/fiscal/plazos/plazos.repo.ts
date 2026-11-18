// src/modules/fiscal/plazos/plazos.repo.ts — SCRUM-1076d · lo que el calendario LEE y lo ÚNICO que escribe.
//
// Lee: el país y la zona del comercio, la visibilidad (§2 de SCRUM-1076 c.21876, con P1 de c.21877)
// y las marcas de `fiscal_plazo_estado`. Escribe: SOLO esa tabla (aceptación 6: ni documentos, ni
// libros, ni cálculo). Todo filtrado por `merchantId` (regla 2), con la clave a la vista.
//
// Visibilidad (aceptación 7):
//   · comercio que no es de España → ninguna fila (los modelos son españoles);
//   · 303, 390 y 130 → siempre (P1 de c.21877: «el 130 sale siempre»);
//   · 111 / 115 → si el borrador de retenciones de ESE trimestre tiene perceptores en ese modelo;
//   · 347 → si el borrador del año declara al menos un tercero (entregas o adquisiciones).
import { zonaDelMerchant, diaNaturalEn } from '../../../core/zonaDelMerchant';
import { leerBorradorRetenciones, type ClienteDeRetenciones } from '../retenciones/retencionesPracticadas.repo';
import { leerBorradorModelo347 } from '../modelo347/modelo347.repo';
import type { CodigoModelo, Periodo } from './citas';
import { construirCalendario, ESTADO_LLEVADO_ASESOR, validarClave, type FilaDelPlazo, type MarcaDelPlazo } from './plazos';

/** Lo mínimo del cliente Prisma para la tabla del estado. Por parámetro: un test lo apunta a lo que quiera. */
export interface ClienteDeMarcas {
  fiscalPlazoEstado: {
    findMany(args: any): Promise<any[]>;
    upsert(args: any): Promise<any>;
    deleteMany(args: any): Promise<{ count: number }>;
  };
}
export interface ClienteDelComercio {
  merchant: { findUnique(args: any): Promise<any> };
}
/** El cliente entero que necesita el calendario (los lectores de 347 y retenciones piden lo suyo). */
export type ClienteDePlazos = ClienteDeMarcas & ClienteDelComercio & ClienteDeRetenciones & Parameters<typeof leerBorradorModelo347>[0];

export async function leerMarcas(db: ClienteDeMarcas, params: { merchantId: number; ejercicio: number }): Promise<MarcaDelPlazo[]> {
  return db.fiscalPlazoEstado.findMany({
    where: { merchantId: params.merchantId, ejercicio: params.ejercicio },
    select: { modelo: true, ejercicio: true, periodo: true, estado: true },
  });
}

export async function leerCalendario(
  db: ClienteDePlazos,
  params: { merchantId: number; ejercicio?: number; ahora?: Date },
): Promise<{ ejercicio: number; hoy: string; filas: FilaDelPlazo[] }> {
  const merchant = await db.merchant.findUnique({ where: { id: params.merchantId }, select: { country: true, timezone: true } });
  const hoy = diaNaturalEn(params.ahora ?? new Date(), zonaDelMerchant(merchant));
  const ejercicio = params.ejercicio ?? Number(hoy.slice(0, 4));
  if (!merchant || merchant.country !== 'ES') return { ejercicio, hoy, filas: [] };

  const visibles = new Set<string>();
  for (const t of [1, 2, 3, 4]) {
    const b = await leerBorradorRetenciones(db, { merchantId: params.merchantId, año: ejercicio, trimestre: t });
    if (b.modelo111.actividadesEconomicasDinerarias.perceptores.valor > 0) visibles.add(`111|${t}T`);
    if (b.modelo115.perceptores.valor > 0) visibles.add(`115|${t}T`);
  }
  const b347 = await leerBorradorModelo347(db, { merchantId: params.merchantId, año: ejercicio });
  if (b347.entregas.declarados.length + b347.adquisiciones.declarados.length > 0) visibles.add('347|ANUAL');

  const esVisible = (modelo: CodigoModelo, periodo: Periodo) =>
    modelo === '303' || modelo === '390' || modelo === '130' || visibles.has(`${modelo}|${periodo}`);
  const marcas = await leerMarcas(db, { merchantId: params.merchantId, ejercicio });
  return { ejercicio, hoy, filas: construirCalendario({ ejercicio, hoy, esVisible, marcas }) };
}

/** Marca o desmarca UN plazo. «pendiente» borra la fila (no es un documento: regla 29 no aplica). */
export async function marcarPlazo(
  db: ClienteDeMarcas,
  params: { merchantId: number; modelo: string; ejercicio: number; periodo: string; estado: string; teamMemberId: number | null },
): Promise<{ ok: true; estado: string } | { ok: false; error: string }> {
  const v = validarClave(params.modelo, params.ejercicio, params.periodo);
  if (!v.ok) return v;
  const clave = { merchantId: params.merchantId, modelo: params.modelo, ejercicio: params.ejercicio, periodo: params.periodo };
  if (params.estado === 'pendiente') {
    await db.fiscalPlazoEstado.deleteMany({ where: clave });
    return { ok: true, estado: 'pendiente' };
  }
  if (params.estado !== ESTADO_LLEVADO_ASESOR) return { ok: false, error: 'estado_invalido' };
  await db.fiscalPlazoEstado.upsert({
    where: { merchantId_modelo_ejercicio_periodo: clave },
    create: { ...clave, estado: ESTADO_LLEVADO_ASESOR, marcadoPor: params.teamMemberId },
    update: { estado: ESTADO_LLEVADO_ASESOR, marcadoAt: new Date(), marcadoPor: params.teamMemberId },
  });
  return { ok: true, estado: ESTADO_LLEVADO_ASESOR };
}
