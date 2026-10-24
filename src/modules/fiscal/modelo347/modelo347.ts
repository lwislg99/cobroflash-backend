// src/modules/fiscal/modelo347/modelo347.ts — SCRUM-1067 · el BORRADOR del modelo 347.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// QUÉ ES Y QUÉ NO
//
// Las operaciones del año con cada tercero —clientes de las facturas EXPEDIDAS y proveedores de
// los gastos del libro de RECIBIDAS—, sumadas por NIF y desglosadas por trimestre, y quiénes
// superan el umbral. Es un borrador para el asesor (D2, SCRUM-1066 c.16699, que nombra el 347):
// no presenta nada, no dice que se pueda presentar y no lleva texto de pantalla. Lo que no se
// puede atribuir a un NIF NO se atribuye al más probable: se SEÑALA, con su dinero.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// LAS REGLAS, CADA UNA CON SU CITA (BOE consolidado, descargado por `curl` el 24-oct-2026;
// el registro en `docs/master/SCRUM-1067.md` lleva el texto y el tamaño de cada fuente)
//
// · Umbral — RGAT (RD 1065/2007, https://www.boe.es/buscar/act.php?id=BOE-A-2007-15984),
//   art. 33.1: «…con quienes hayan efectuado operaciones que en su conjunto para cada una de
//   dichas personas o entidades hayan superado la cifra de 3.005,06 euros durante el año natural
//   correspondiente.» → «superado»: ESTRICTAMENTE mayor. 3.005,06 justos no entran.
// · Trimestres y dos sentidos — art. 33.1, párrafo 2.º: «…se suministrará desglosada
//   trimestralmente. A tales efectos, se computarán de forma separada las entregas y las
//   adquisiciones de bienes y servicios.» Y el anexo de la Orden EHA/3012/2008
//   (https://www.boe.es/buscar/act.php?id=BOE-A-2008-16973), clave de operación: «A Adquisiciones
//   de bienes y servicios superiores a 3.005,06 euros. B Entregas de bienes y prestaciones de
//   servicios superiores a 3.005,06 euros.» → un proveedor que también es cliente son DOS
//   entradas, cada una con su umbral.
// · Con IVA — art. 34.2.a): «…se declarará el importe total de las contraprestaciones, incluidas
//   las cuotas y recargos repercutidos o soportados por dicho impuesto.» → se suma el TOTAL.
// · Rectificativas — art. 34.4: «…se declarará neto de las devoluciones, descuentos y
//   bonificaciones concedidos y de las operaciones que queden sin efecto en el mismo año
//   natural.» Y art. 35.2: si ocurren en otro trimestre o año, «deberán ser consignados en el
//   apartado correspondiente al trimestre natural en que se hayan producido». → una R1 suma CON SU
//   SIGNO en el trimestre de su propia fecha.
// · Qué trimestre — art. 35.1: «…en el período en el que, de acuerdo con lo previsto en el
//   artículo 69 del Reglamento del Impuesto sobre el Valor Añadido, se debe realizar la anotación
//   registral…» → la fecha del ASIENTO de cada libro, con los bordes de `rangoTrimestre` (el
//   calendario español, el mismo del 303 y de los libros).
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// LO QUE NO SE DECIDE AQUÍ (va al asesor; detalle en el registro)
//
// · Exclusiones del art. 33.2 —sobre todo la i): lo ya declarado en otro modelo con contenido
//   coincidente (¿alquileres y profesionales con retención, que van al 180/190?)—: no se aplican.
// · Las anuladas: se apartan y se SEÑALAN (art. 34.4, «queden sin efecto»), pero el libro no trae
//   la fecha de la anulación, así que el caso del art. 35.2 (anulada en otro año) no se mide.
// · Arrendamiento de local (art. 34.1.d) y cobros en metálico > 6.000 € (art. 34.1.h): no se
//   desglosan. El 347 de quien tributa en módulos (art. 32.1.b): no se distingue.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// REGLA 38 · esto es LECTURA. No toca el camino de emisión: no compone, no sella, no escribe.
import type { LibroRegistro } from '../../invoicing/domain/libroRegistro';
import type { LibroRecibidas } from '../../invoicing/domain/libroRecibidas';
import { declarabilidadDe } from '../../invoicing/domain/tipoDocumento';
import { AVISO_ORIENTATIVO, rangoTrimestre } from '../modelo303/modelo303';

/** RGAT art. 33.1, en céntimos para comparar sin coma flotante. Procedencia: arriba. */
const UMBRAL_CENTIMOS = 300506;
const FUENTE_UMBRAL = 'RD 1065/2007 (RGAT), art. 33.1 · https://www.boe.es/buscar/act.php?id=BOE-A-2007-15984';
const FUENTE_ORDEN = 'Orden EHA/3012/2008, anexo (claves A y B) · https://www.boe.es/buscar/act.php?id=BOE-A-2008-16973';

const centimos = (n: number) => Math.round(n * 100);
const euros = (c: number) => c / 100;

/** Lo mínimo de un proveedor: el NIF sale de la FICHA (los gastos no congelan el suyo). */
export interface ProveedorPara347 {
  id: number;
  merchantId: number;
  name: string | null;
  legalName: string | null;
  taxId: string | null;
}

/**
 * El NIF como clave: sin espacios, guiones ni puntos, y en mayúsculas. «b-12.345.678» y
 * «B12345678» son el mismo tercero. Un prefijo de país («ES…») NO se quita: no consta que lo sea.
 * Vacío después de limpiar = no hay NIF.
 */
function claveNif(nif: string | null | undefined): string | null {
  if (typeof nif !== 'string') return null;
  const limpio = nif.replace(/[\s.\-]/g, '').toUpperCase();
  return limpio.length > 0 ? limpio : null;
}

export type MotivoSeñalada =
  | 'sin_nif'              // el tercero existe y no tiene NIF
  | 'nif_sin_congelar'     // factura anterior al escritor del destinatario (SCRUM-1058c): no hay NIF congelado
  | 'sin_proveedor'        // gasto sin proveedor: no hay a quién atribuirlo
  | 'importe_ilegible'     // el libro no supo leer el total
  | 'tipo_no_declarable'   // un tipo de documento que `declarabilidadDe` no declara
  | 'anulada';             // art. 34.4: queda sin efecto; la fecha de la anulación no consta

export interface OperacionSeñalada {
  sentido: 'entrega' | 'adquisicion';
  /** Nº de factura (expedidas) o nº de la factura del proveedor (recibidas; `null` si no consta). */
  referencia: string | null;
  terceroId: number | null;
  total: number | null;
  trimestre: number;
  motivo: MotivoSeñalada;
}

export interface Tercero347 {
  nif: string;
  nombre: string | null;
  /** Neto del año, IVA incluido (art. 34.2.a). */
  total: number;
  /** [1T, 2T, 3T, 4T], que suman `total`. */
  trimestres: [number, number, number, number];
  operaciones: number;
}

export interface Lado347 {
  /** Clave del anexo de la orden: A adquisiciones, B entregas. */
  clave: 'A' | 'B';
  /** Los que superan el umbral, por NIF. */
  declarados: Tercero347[];
  /** Cuántos terceros con NIF se quedan a 3.005,06 o por debajo. Se cuentan, no se listan. */
  porDebajo: number;
}

export interface BorradorModelo347 {
  año: number;
  desde: string;
  hasta: string;
  moneda: string;
  umbral: { importe: number; estricto: true; fuente: string };
  fuenteClaves: string;
  entregas: Lado347;
  adquisiciones: Lado347;
  /** Lo que no se pudo atribuir a un NIF, o no se sumó, con su motivo. Se señala, no se oculta. */
  señaladas: OperacionSeñalada[];
  /** Asientos examinados de cada libro. Un 347 vacío con `miradas` a 0 es un año sin operaciones. */
  miradas: { expedidas: number; recibidas: number };
  /**
   * Gastos que el libro de recibidas NO convirtió en asiento (sin `baseAmount`): no tienen total
   * fiable, así que tampoco entran aquí. Vienen del libro, con su importe.
   */
  gastosFueraDelLibro: { cuantos: number; importe: number };
  avisoObligatorio: string;
}

/** El trimestre (1-4) de una fecha del año, con los bordes de `rangoTrimestre`. 0 = fuera del año. */
function trimestreDe(fecha: string | Date | null, año: number): number {
  if (fecha === null || fecha === undefined) return 0;
  const t = new Date(fecha).getTime();
  if (!Number.isFinite(t)) return 0;
  for (let q = 1; q <= 4; q++) {
    const { desde, hasta } = rangoTrimestre(año, q);
    if (t >= desde.getTime() && t <= hasta.getTime()) return q;
  }
  return 0;
}

type Acumulado = { nombre: string | null; trimestres: [number, number, number, number]; operaciones: number };

function sumar(mapa: Map<string, Acumulado>, nif: string, nombre: string | null, trimestre: number, total: number) {
  const acc = mapa.get(nif) ?? { nombre, trimestres: [0, 0, 0, 0], operaciones: 0 };
  if (acc.nombre === null && nombre) acc.nombre = nombre;
  acc.trimestres[trimestre - 1] += centimos(total);
  acc.operaciones += 1;
  mapa.set(nif, acc);
}

function lado(clave: 'A' | 'B', mapa: Map<string, Acumulado>): Lado347 {
  const declarados: Tercero347[] = [];
  let porDebajo = 0;
  for (const [nif, acc] of mapa) {
    const totalC = acc.trimestres.reduce((a, b) => a + b, 0);
    if (totalC > UMBRAL_CENTIMOS) {
      declarados.push({
        nif, nombre: acc.nombre, total: euros(totalC),
        trimestres: acc.trimestres.map(euros) as [number, number, number, number],
        operaciones: acc.operaciones,
      });
    } else {
      porDebajo += 1;
    }
  }
  declarados.sort((a, b) => (a.nif < b.nif ? -1 : a.nif > b.nif ? 1 : 0));
  return { clave, declarados, porDebajo };
}

/**
 * Construye el borrador del 347 de UN merchant para UN año natural.
 *
 * Los dos libros tienen que venir ya acotados al año (lo hace `leerBorradorModelo347`): el de
 * expedidas pedido con `soloFacturas` (el libro son facturas y nada más, SCRUM-1232). Un asiento
 * con fecha fuera del año rompe: sería un segundo criterio de fechas. Un proveedor de otro
 * merchant también rompe (regla 2).
 */
export function construirModelo347(params: {
  libro: LibroRegistro;
  libroRecibidas: LibroRecibidas;
  proveedores: readonly ProveedorPara347[];
  merchantId: number;
  año: number;
}): BorradorModelo347 {
  const { año, merchantId } = params;
  const señaladas: OperacionSeñalada[] = [];
  const entregas = new Map<string, Acumulado>();
  const adquisiciones = new Map<string, Acumulado>();
  let moneda = 'EUR';

  const proveedores = new Map<number, ProveedorPara347>();
  for (const p of params.proveedores) {
    if (p.merchantId !== merchantId) {
      throw new Error(`🔴 SCRUM-1067 · un proveedor del merchant ${p.merchantId} ha llegado al 347 del ${merchantId} (regla 2).`);
    }
    proveedores.set(p.id, p);
  }

  for (const a of params.libro.asientos) {
    if (a.moneda) moneda = a.moneda;
    const trimestre = trimestreDe(a.fecha, año);
    if (trimestre === 0) throw new Error(`🔴 SCRUM-1067 · la factura ${a.numero} (${a.fecha}) no es del año ${año}.`);
    const señalar = (motivo: MotivoSeñalada) =>
      señaladas.push({ sentido: 'entrega', referencia: a.numero, terceroId: a.clienteId, total: a.total, trimestre, motivo });

    if (!declarabilidadDe(a.tipo).declara) { señalar('tipo_no_declarable'); continue; }
    if (a.estado === 'annulled') { señalar('anulada'); continue; }
    if (a.importeIlegible || a.total === null) { señalar('importe_ilegible'); continue; }
    if (a.clienteCongelado === null) { señalar('nif_sin_congelar'); continue; }
    const nif = claveNif(a.clienteCongelado.taxId);
    if (nif === null) { señalar('sin_nif'); continue; }
    sumar(entregas, nif, a.clienteCongelado.legalName || a.clienteCongelado.name, trimestre, a.total);
  }

  for (const g of params.libroRecibidas.asientos) {
    if (g.moneda) moneda = g.moneda;
    const trimestre = trimestreDe(g.fechaApunte, año);
    const referencia = g.numeroProveedor;
    if (trimestre === 0) throw new Error(`🔴 SCRUM-1067 · un gasto (${g.fechaApunte}) no es del año ${año}.`);
    const señalar = (motivo: MotivoSeñalada) =>
      señaladas.push({ sentido: 'adquisicion', referencia, terceroId: g.proveedorId, total: g.total, trimestre, motivo });

    if (g.total === null) { señalar('importe_ilegible'); continue; }
    if (g.proveedorId === null) { señalar('sin_proveedor'); continue; }
    const p = proveedores.get(g.proveedorId);
    const nif = claveNif(p?.taxId);
    if (!p || nif === null) { señalar('sin_nif'); continue; }
    sumar(adquisiciones, nif, p.legalName || p.name, trimestre, g.total);
  }

  const { desde } = rangoTrimestre(año, 1);
  const { hasta } = rangoTrimestre(año, 4);
  return {
    año,
    desde: desde.toISOString(),
    hasta: hasta.toISOString(),
    moneda,
    umbral: { importe: euros(UMBRAL_CENTIMOS), estricto: true, fuente: FUENTE_UMBRAL },
    fuenteClaves: FUENTE_ORDEN,
    entregas: lado('B', entregas),
    adquisiciones: lado('A', adquisiciones),
    señaladas,
    miradas: { expedidas: params.libro.miradas, recibidas: params.libroRecibidas.miradas },
    gastosFueraDelLibro: {
      cuantos: params.libroRecibidas.sinClasificar,
      importe: params.libroRecibidas.sinClasificarImporte,
    },
    avisoObligatorio: AVISO_ORIENTATIVO,
  };
}
