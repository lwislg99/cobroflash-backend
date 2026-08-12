// src/modules/fiscal/librosAeat/librosAeat.repo.ts — SCRUM-325 (E4).
//
// Junta el libro de A6 con los datos del destinatario. **Solo lectura**, y las dos consultas van
// acotadas al merchant (regla 2): en un documento que se le entrega a un tercero, colar la
// factura de otro no es una fuga de datos — es atribuirle a alguien actividad que no es suya.
//
// ⚠️ POR QUÉ EL NIF SE RESUELVE AQUÍ Y NO EN A6. `AsientoLibro` trae `clienteId`, no el NIF: el
// libro identifica al destinatario por su id porque eso es lo que necesita para cuadrar. Un libro
// de expedidas, en cambio, se lee de fuera y necesita el NIF y el nombre. Resolver un id contra
// `Customer` es ENTREGA, no cálculo — no suma, no reparte IVA y no toca un asiento. Por eso vive
// en este módulo y A6 no se toca (0.3 del encargo: si A6 no produce lo que necesitas, declara el
// hueco; aquí el hueco es un identificador que hay que resolver, y resolverlo no es recalcular).
import { leerLibroRegistro, type ClienteDelLibro } from '../../invoicing/domain/libroRegistro.repo';
import { leerLibroRecibidas, type ClienteDeGastos } from '../../invoicing/domain/libroRecibidas.repo'; // SCRUM-426
import { exigirLibroRecibidasLegible } from '../../invoicing/domain/libroRecibidas';
import { rangoTrimestre } from '../modelo303/modelo303';
import {
  exigirLibroLegible, filasLibroExpedidas, filasLibroRecibidas, avisosLibroRecibidas,
  type DatosDestinatario, type DatosProveedor, type FilaLibro,
} from './librosAeat';
import { criterioDelMerchantParaElLibro } from '../../invoicing/domain/criterioDelMerchant'; // SCRUM-294 fase C

export interface ClienteDeLibros extends ClienteDelLibro {
  customer: { findMany(args: any): Promise<any[]> };
}

/**
 * El libro de expedidas de UN trimestre, ya en filas.
 *
 * El rango sale de `rangoTrimestre` (SCRUM-295/A5) y NO se reimplementa: es la misma función que
 * usa el modelo 303, así que un asiento no puede caer en el 303 de un trimestre y en el libro de
 * otro. Dos definiciones de «trimestre» en el mismo producto son dos documentos oficiales que un
 * día se contradicen.
 */
export async function leerLibroExpedidasDelTrimestre(
  db: ClienteDeLibros,
  params: { merchantId: number; año: number; trimestre: number },
): Promise<{ filas: FilaLibro[]; miradas: number; desde: Date; hasta: Date }> {
  const { desde, hasta } = rangoTrimestre(params.año, params.trimestre);
  const { merchantId } = params;

  // SCRUM-294 (fase C) · el criterio de caja del merchant, igual que en el 303.
  const criterio = await criterioDelMerchantParaElLibro(db as never, merchantId);
  const libro = await leerLibroRegistro(db, { merchantId, desde, hasta, ...criterio });
  // El suelo va ANTES de mirar los asientos: si el libro no se pudo leer, no se resuelve ningún
  // cliente ni se emite nada. Ver `exigirLibroLegible`.
  exigirLibroLegible(libro);

  const ids = [...new Set(libro.asientos.map((a) => a.clienteId).filter((n): n is number => typeof n === 'number'))];
  const clientes = ids.length === 0 ? [] : await db.customer.findMany({
    where: { merchantId, id: { in: ids } },
    select: { id: true, name: true, legalName: true, taxId: true },
  });

  const destinatarios = new Map<number, DatosDestinatario>(
    clientes.map((c: any) => [c.id, {
      // La razón social manda sobre el nombre comercial: en un libro identifica a quien factura.
      nombre: c.legalName || c.name || null,
      nif: c.taxId || null,
    }]),
  );

  return { filas: filasLibroExpedidas(libro, destinatarios), miradas: libro.miradas, desde, hasta };
}

/**
 * El libro de RECIBIDAS de UN trimestre, ya en filas — SCRUM-426.
 *
 * Mismo `rangoTrimestre` que expedidas y que el 303: un asiento no puede caer en el 303 de un
 * trimestre y en el libro de otro.
 *
 * ⚠️ Aquí NO se construye el libro: se LLAMA a `leerLibroRecibidas` (A6) y se pinta lo que
 * devuelve. Resolver `proveedorId` → NIF y nombre es lo mismo que se hace arriba con `clienteId`,
 * y por el mismo motivo: resolver un id contra la ficha es ENTREGA, no cálculo.
 */
export async function leerLibroRecibidasDelTrimestre(
  db: ClienteDeLibros & ClienteDeGastos & { provider: { findMany(args: any): Promise<any[]> } },
  params: { merchantId: number; año: number; trimestre: number },
): Promise<{ filas: FilaLibro[]; miradas: number; avisos: string[]; desde: Date; hasta: Date }> {
  const { desde, hasta } = rangoTrimestre(params.año, params.trimestre);
  const { merchantId } = params;

  const libro = await leerLibroRecibidas(db, { merchantId, desde, hasta });
  // El suelo va ANTES de resolver nada: si el libro no se pudo leer, no se emite fichero.
  exigirLibroRecibidasLegible(libro);

  const ids = [...new Set(
    libro.asientos.map((a) => a.proveedorId).filter((n): n is number => typeof n === 'number'),
  )];
  const proveedores = ids.length === 0 ? [] : await db.provider.findMany({
    where: { merchantId, id: { in: ids } },
    select: { id: true, name: true, taxId: true },
  });

  const mapa = new Map<number, DatosProveedor>(
    proveedores.map((p: any) => [p.id, {
      // ⚠️ `Provider` no tiene `legalName` (pendiente de schema): esto es el nombre COMERCIAL, y
      // un libro identifica por razón social. Incompleto a sabiendas, nunca inventado.
      nombre: p.name || null,
      nif: p.taxId || null,
    }]),
  );

  return {
    filas: filasLibroRecibidas(libro, mapa),
    miradas: libro.miradas,
    // Los avisos VIAJAN con el entregable: lo excluido en silencio es un libro vacío pequeño.
    avisos: avisosLibroRecibidas(libro),
    desde,
    hasta,
  };
}
