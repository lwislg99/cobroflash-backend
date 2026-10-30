// src/modules/fiscal/modelo390/modelo390.repo.ts — SCRUM-1077 · el lector del borrador del 390.
//
// No lee nada por su cuenta: llama cuatro veces al lector del 303 (`leerModelo303`), una por
// trimestre, y le pasa los cuatro a `construirModelo390`. El filtro por merchant (regla 2), el de
// fechas y el criterio de caja son los del 303: un solo camino a la base.
// Sin ruta: hoy no lo llama nadie, y montarla es una pantalla que pide texto firmado (regla 39).
import { leerModelo303 } from '../modelo303/modelo303.repo';
import type { ClienteDelLibro } from '../../invoicing/domain/libroRegistro.repo';
import type { ClienteDeGastos } from '../../invoicing/domain/libroRecibidas.repo';
import type { Modelo303 } from '../modelo303/modelo303';
import { construirModelo390, type Modelo390 } from './modelo390';

export async function leerModelo390(
  db: ClienteDelLibro & ClienteDeGastos,
  params: { merchantId: number; año: number; ahora?: Date },
): Promise<Modelo390> {
  // Uno detrás de otro, no en paralelo: son cuatro lecturas del libro, y no hay prisa que lo pida.
  const trimestres: Modelo303[] = [];
  for (const trimestre of [1, 2, 3, 4]) {
    trimestres.push(await leerModelo303(db, { merchantId: params.merchantId, año: params.año, trimestre }));
  }
  return construirModelo390({ año: params.año, trimestres, ahora: params.ahora ?? new Date() });
}
