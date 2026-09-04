// src/modules/jobs/domain/pendientesFacturar.service.ts — SCRUM-69 (FACT-1)
// Bandeja "Pendientes de facturar": albaranes firmados+VALORADOs sin factura, agrupados por
// cliente y mes natural (reusa el motor de rotura de SCRUM-17), con semáforo de plazo legal
// (art. 13 RD 1619/2012) e importe potencial. Diferenciador: nadie más avisa de este plazo.
import type { PrismaClient } from '@prisma/client';
import {
  groupByRotura,
  calcAlbaranTotales,
  type AlbaranConsolidable,
  type AlbaranLinea,
} from './albaran.service';
import { nombreParaDocumento } from '../../../core/documentos/nombreParaDocumento'; // SCRUM-577
// SCRUM-643: el calendario del merchant, resuelto en UN solo sitio. Ver el módulo para por qué
// no sale de aquí el impuesto.
import {
  ZONA_POR_DEFECTO, zonaDelMerchant, diaNaturalEn, diasEntre,
} from '../../../core/zonaDelMerchant';

export type TipoDestinatario = 'PARTICULAR' | 'EMPRESARIO';
export type Semaforo = 'verde' | 'ambar' | 'rojo';

// SCRUM-69: null = "cliente nunca clasificado" — se trata como PARTICULAR (el plazo MÁS
// CORTO, criterio seguro) SOLO para el cálculo; nunca se escribe ese valor de vuelta a la BD.
export function resolveTipoDestinatario(customer: { tipoDestinatario?: string | null }): TipoDestinatario {
  return customer.tipoDestinatario === 'EMPRESARIO' ? 'EMPRESARIO' : 'PARTICULAR';
}

/**
 * 🔴 SCRUM-747 · UN MES QUE NO EXISTE NO TIENE UN MES CORRECTO QUE ADIVINAR.
 *
 * `Date.UTC` **normaliza en silencio**: el mes 13 de 2026 se convierte en enero de 2027 sin
 * protestar. Medido en SCRUM-648: `'2026-13'` daba el plazo `2027-01-31` y el semáforo lo pintaba
 * **verde**, porque para él era un plazo perfectamente bueno — sólo que de otro mes.
 *
 * Y **eso es peor que un valor ilegible**: contra un ilegible se puede programar una barrera
 * porque es detectable; contra un plazo plausible no hay síntoma ninguno.
 *
 * ⛔ NO se repara con un valor por defecto. Un `mesKey` que no existe no tiene un mes correcto
 * que adivinar, y elegir uno convertiría un dato roto en un plazo legal inventado. Se **falla
 * nombrando el valor**, que es lo único que permite arreglar el origen.
 */
// 🔴 SIN `export`, y lo pidió el guard de SCRUM-411 con razón: su único consumidor está en
// ESTE fichero. Un export sin llamador de fuera es indistinguible de una función entregada, y así
// estuvo meses `borrarMerchant`. Se prueba por la SUPERFICIE PÚBLICA —`fechaLimiteRecapitulativa`
// y `avisoDeFacturacion`—, que es lo que de verdad usa alguien.
class MesKeyInvalidoError extends Error {
  constructor(public readonly mesKey: unknown) {
    super(
      `mesKey inválido: ${JSON.stringify(mesKey)}. Se esperaba «YYYY-MM» con mes entre 01 y 12. ` +
      'No se normaliza a un mes vecino: un plazo del art. 13.2 calculado sobre un mes que no ' +
      'existe sería un plazo inventado.',
    );
    this.name = 'MesKeyInvalidoError';
  }
}

/**
 * Las dos partes de un `mesKey`, **validadas antes de que nadie las normalice**.
 *
 * Un solo sitio, y no dos copias: `fechaLimiteRecapitulativa` y `avisoDeFacturacion` reciben el
 * MISMO `mesKey` y lo troceaban cada una por su cuenta. Dos validaciones acaban divergiendo.
 */
function partesDelMesKey(mesKey: string): { y: number; m: number } {
  if (typeof mesKey !== 'string' || !/^\d{4}-\d{2}$/.test(mesKey)) throw new MesKeyInvalidoError(mesKey);
  const [y, m] = mesKey.split('-').map(Number);
  if (!Number.isInteger(y) || !Number.isInteger(m) || m < 1 || m > 12) throw new MesKeyInvalidoError(mesKey);
  return { y, m };
}

/**
 * Fecha límite legal de la recapitulativa para un mes natural dado (art. 13.2 RD 1619/2012):
 * último día del mes si PARTICULAR; día 16 del mes SIGUIENTE si EMPRESARIO. `mesKey` = "YYYY-MM"
 * (mismo formato que mesNaturalKey/groupByRotura). El desbordamiento de año (diciembre → enero)
 * lo normaliza `Date` solo.
 *
 * 🔴 SCRUM-643 · DEVUELVE UN DÍA (`YYYY-MM-DD`), NO UN INSTANTE — y ése es el arreglo de raíz.
 *
 * Antes construía `new Date(y, m, 0)`, o sea medianoche EN EL RELOJ DEL PROCESO, y luego había
 * que formatearlo con cuidado (`toIsoDateLocal`) para que `toISOString()` no lo desplazara un
 * día. Ese cuidado era un vigilante: bastaba que alguien formateara «como se formatea todo» para
 * mover un PLAZO LEGAL.
 *
 * **Un plazo del art. 13.2 es un DÍA del calendario, no un instante.** En cuanto se representa
 * como día, el problema deja de existir en vez de quedar vigilado: no hay reloj que aplicarle, y
 * la aritmética del mes (último día / día 16 del siguiente) es pura y no depende de zona alguna.
 * Por eso esta función NO recibe zona: la zona hace falta para saber en qué día vive HOY, y eso
 * lo pone `calcularSemaforo`.
 */
export function fechaLimiteRecapitulativa(mesKey: string, tipo: TipoDestinatario): string {
  const { y, m } = partesDelMesKey(mesKey); // m = mes 1-indexado (marzo = 3)
  // `Date.UTC` normaliza el desbordamiento de año (diciembre → enero) solo, y en UTC no hay
  // desfase que pueda mover el día: aquí sólo se hace cuenta de calendario. Con el mes ya
  // validado, ese desbordamiento es el LEGÍTIMO (diciembre → enero) y ningún otro.
  const d = new Date(tipo === 'EMPRESARIO'
    ? Date.UTC(y, m, 16)   // día 16 del mes siguiente
    : Date.UTC(y, m, 0));  // día 0 del mes siguiente = último día del mes actual
  return d.toISOString().slice(0, 10);
}

/**
 * Semáforo por días hasta la fecha límite.
 * rojo: plazo YA vencido (< 0 días) · ámbar: 0-5 días · verde: > 5 días.
 *
 * 🔴 SCRUM-643 · LA ZONA ES LA DEL MERCHANT, NO LA DE LA MÁQUINA. Antes normalizaba las dos
 * fechas «a medianoche local» y local era el reloj del proceso: con el servidor en UTC y el pro
 * en la península, el 1 de abril a las 00:30 hora española el semáforo decía ÁMBAR con el plazo
 * del 31 de marzo YA VENCIDO. Ahora los dos extremos son días naturales resueltos en la zona
 * del merchant, y restarlos ya no depende de ningún reloj.
 */
export function calcularSemaforo(
  limiteISO: string,
  hoy: Date = new Date(),
  zona: string = ZONA_POR_DEFECTO,
): Semaforo {
  const diasHastaLimite = diasEntre(diaNaturalEn(hoy, zona), limiteISO);
  // ⚠️ CARACTERIZACIÓN, NO DESCUIDO: con un límite ilegible `diasEntre` da NaN, las dos
  // comparaciones son falsas y sale 'verde' — «no lo sé» pintado de «al día». Es el hallazgo de
  // SCRUM-622 y **se conserva tal cual a propósito**: arreglarlo aquí mezclaría dos cambios en
  // el mismo diff. Entra en su propio paso, ENCIMA de este código.
  if (diasHastaLimite < 0) return 'rojo';
  if (diasHastaLimite <= 5) return 'ambar';
  return 'verde';
}

/** SCRUM-171b: periodicidad PACTADA con el cliente. `NINGUNA` = sin aviso (lo de hoy). */
export type BillingPeriodicity = 'NINGUNA' | 'QUINCENAL' | 'MENSUAL';

export type MotivoAviso = 'plazo_legal' | 'periodicidad';

/**
 * SCRUM-171b · ¿HAY QUE AVISAR de que toca facturar este grupo?
 *
 * ⚠️ EL PLAZO LEGAL MANDA POR ENCIMA DE LA PERIODICIDAD, y no es un detalle de implementación:
 * es LA regla. La periodicidad es un ACUERDO COMERCIAL entre el pro y su cliente («te facturo a
 * mes vencido», «cada quince días»); la fecha límite del art. 13.2 RD 1619/2012 es LEY. Si
 * alguien pacta «quincenal» con un particular, el fin de mes natural sigue mandando; y si el
 * acuerdo dice «todavía no toca» pero el plazo se acaba, YaQu avisa IGUAL. Callar porque el
 * pacto dice que no toca sería sugerirle al pro facturar fuera de plazo por respetar un acuerdo
 * privado — exactamente lo que no puede pasar.
 *
 * Por eso el semáforo (que la bandeja ya calcula desde `tipoDestinatario`) se mira PRIMERO.
 *
 * NO dispara ningún envío: pinta un aviso y el pro decide. Un envío automático nuevo tendría que
 * pasar por la tabla J6 del máster (regla 28), y aquí esa regla no se toca.
 *
 * ⚠️ SCRUM-643 · ÉSTE ES UN CUARTO SITIO, y apareció al tirar del hilo. El encargo nombraba
 * tres cálculos; este cuarto usaba el mismo `startOfDay` del reloj del proceso y vive en el
 * MISMO fichero. Dejarlo habría sido colocar un lector del reloj de la máquina pegado al arreglo
 * que existe para quitarlo — el defecto de familia, reintroducido en el propio diff que lo cierra.
 * Recibe la zona como los otros tres. Es una ampliación mínima y va declarada.
 */
export function avisoDeFacturacion(
  periodicidad: BillingPeriodicity | string | null | undefined,
  semaforo: Semaforo,
  mesKey: string,
  hoy: Date = new Date(),
  zona: string = ZONA_POR_DEFECTO,
): { avisar: boolean; motivo: MotivoAviso | null } {
  // 1) La LEY primero, y con independencia de lo pactado — incluso con `NINGUNA`: el plazo corre
  //    igual, y ese aviso ya lo daba el semáforo de SCRUM-69.
  if (semaforo === 'rojo' || semaforo === 'ambar') return { avisar: true, motivo: 'plazo_legal' };

  const p = String(periodicidad || 'NINGUNA');
  if (p !== 'QUINCENAL' && p !== 'MENSUAL') return { avisar: false, motivo: null };

  // 2) El ACUERDO después: su ciclo se ha cerrado y hay partes esperando.
  //    MENSUAL   → el mes natural del grupo ya terminó.
  //    QUINCENAL → además, desde el día 16 del propio mes (cerrada la primera quincena).
  // 🔴 SCRUM-747 · LA MISMA PUERTA QUE ARRIBA, y era mi propio hueco declarado en SCRUM-648:
  // esta función recibe el MISMO `mesKey` y decide SI AVISAR. Con un mes fuera de rango, el
  // `dia16` salía como `2026-13-16` —ilegible— y `diasEntre` daba `NaN`: la comparación era falsa
  // y **el aviso quincenal se perdía en silencio**. Si el semáforo miente, este aviso también.
  const { y, m } = partesDelMesKey(mesKey);
  // Días del calendario, no instantes — igual que el plazo legal de arriba, y por lo mismo.
  const hoyDia = diaNaturalEn(hoy, zona);
  const finDeMes = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
  if (diasEntre(finDeMes, hoyDia) > 0) return { avisar: true, motivo: 'periodicidad' };
  if (p === 'QUINCENAL') {
    const dia16 = `${y}-${String(m).padStart(2, '0')}-16`;
    if (diasEntre(dia16, hoyDia) >= 0) return { avisar: true, motivo: 'periodicidad' };
  }
  return { avisar: false, motivo: null };
}

export interface GrupoPendienteFacturar {
  mesKey: string;
  mesLabel: string;
  albaranes: AlbaranConsolidable[];
  // jobId del primer albarán del grupo — enlaza el botón "Consolidar" al Job donde ya existe
  // ese flujo (jobDetailView.js). Un cliente con >1 Job simultáneo puede mezclar partes de
  // varios Jobs en el mismo mes; V1 enlaza al primero (edge case fuera de alcance, ver brief).
  jobId: number;
  importePotencial: { base: number; cuota: number; total: number };
  fechaLimite: string; // ISO date, solo fecha
  semaforo: Semaforo;
  // SCRUM-171b: aviso DERIVADO (el plazo legal por encima de la periodicidad pactada). Nadie lo
  // guarda: se calcula al leer, igual que el semáforo.
  avisar: boolean;
  motivoAviso: MotivoAviso | null;
}

export interface ClientePendienteFacturar {
  customerId: number;
  customerName: string;
  /** El tipo YA RESUELTO — con el que se ha calculado el plazo. Nunca es null (ver `resolveTipoDestinatario`). */
  tipoDestinatario: TipoDestinatario;
  /**
   * SCRUM-615 · LO QUE EL PROFESIONAL DECLARÓ DE VERDAD. `null` = no consta.
   *
   * 🔴 NO ES REDUNDANTE CON EL DE ARRIBA, y ésa es la razón de existir de este campo: aquél sale
   * de `resolveTipoDestinatario`, que convierte `null` en `PARTICULAR` sin dejar rastro. Con solo
   * aquél, **el cliente no puede distinguir «es un particular» de «nadie lo ha dicho»** — y esa
   * distinción es justo la que hace falta para poder preguntar.
   *
   * NO ES INFORMACIÓN NUEVA: el valor crudo de la columna YA se expone en
   * `GET /admin/customers` (`customerAdmin.ts`, `CUSTOMER_SELECT_NO_TOKEN`). Esto solo deja de
   * ocultarlo en esta respuesta, que era la única que lo pisaba con el resuelto.
   *
   * Un valor que no sea uno de los dos declarables viaja como `null`: la columna es `text` sin
   * `CHECK`, así que puede contener cualquier cosa, y una cadena que nadie reconoce **no es una
   * declaración**. Es el mismo lado prudente que ya toma `resolveTipoDestinatario`.
   */
  tipoDestinatarioDeclarado: TipoDestinatario | null;
  /** SCRUM-171b: lo PACTADO con este cliente. Solo alimenta el aviso; no factura nada solo. */
  billingPeriodicity: BillingPeriodicity;
  grupos: GrupoPendienteFacturar[];
}

/**
 * Consulta merchant-wide: NO existía ningún listado agregado de albaranes (todo lo previo era
 * por Job individual — consolidar-albaranes, jobs.routes.ts — o por albarán suelto). Mismos
 * filtros que validarConsolidacion (SCRUM-17): firmado + VALORADO + sin facturar + Job no
 * TRABAJO_UNICO (una obra única se factura al concluir, no se agrupa por mes).
 */
export async function getPendientesFacturar(
  merchantId: number,
  prisma: PrismaClient,
): Promise<ClientePendienteFacturar[]> {
  // Albaran.jobId es un Int plano (sin relación Prisma declarada hacia Job) — a diferencia de
  // consolidar-albaranes (jobs.routes.ts), que arranca DESDE el Job y no necesita este paso,
  // aquí se arranca desde Albaran y hay que resolver los Jobs elegibles primero.
  // SCRUM-643 · LA ZONA SE LEE UNA VEZ, AQUÍ, y se pasa hacia abajo. Los tres cálculos la
  // RECIBEN en vez de resolverla cada uno: si cada sitio la resolviera, el siguiente volvería a
  // leer el reloj del proceso, que es exactamente el defecto que este ticket cierra.
  const merchant = await prisma.merchant.findUnique({
    where: { id: merchantId },
    select: { timezone: true },
  });
  const zona = zonaDelMerchant(merchant);

  const jobs = await prisma.job.findMany({
    where: { merchantId, tipoOperacion: { not: 'TRABAJO_UNICO' } },
    select: { id: true, customerId: true },
  });
  if (!jobs.length) return [];
  const customerIdByJobId = new Map(jobs.map((j) => [j.id, j.customerId]));

  const albaranes = await prisma.albaran.findMany({
    where: {
      merchantId,
      estado: 'firmado',
      modoValoracion: 'VALORADO',
      invoiceId: null,
      jobId: { in: [...customerIdByJobId.keys()] },
    },
    select: {
      id: true, numero: true, fecha: true, estado: true, modoValoracion: true,
      invoiceId: true, lineas: true, jobId: true,
    },
    orderBy: { fecha: 'asc' },
  });

  if (!albaranes.length) return [];

  const porCliente = new Map<number, typeof albaranes>();
  for (const a of albaranes) {
    const customerId = customerIdByJobId.get(a.jobId)!;
    if (!porCliente.has(customerId)) porCliente.set(customerId, []);
    porCliente.get(customerId)!.push(a);
  }

  const customers = await prisma.customer.findMany({
    where: { id: { in: [...porCliente.keys()] } },
    select: { id: true, name: true, legalName: true, tipoDestinatario: true, billingPeriodicity: true }, // SCRUM-171b
  });
  const customerById = new Map(customers.map((c) => [c.id, c]));

  const hoy = new Date();
  const resultado: ClientePendienteFacturar[] = [];

  for (const [customerId, lista] of porCliente) {
    const customer = customerById.get(customerId);
    const tipo = resolveTipoDestinatario(customer ?? {});
    const periodicidad = ((customer as any)?.billingPeriodicity || 'NINGUNA') as BillingPeriodicity;
    const consolidables: AlbaranConsolidable[] = lista.map((a) => ({
      id: a.id, numero: a.numero, fecha: a.fecha, estado: a.estado,
      modoValoracion: a.modoValoracion, invoiceId: a.invoiceId, customerId,
    }));

    const grupos = groupByRotura(consolidables, zona).map((g) => {
      const albaranesOriginales = lista.filter((a) => g.albaranes.some((ga) => ga.id === a.id));
      const lineasGrupo = albaranesOriginales
        .flatMap((a) => (Array.isArray(a.lineas) ? (a.lineas as unknown as AlbaranLinea[]) : []));
      const fechaLimite = fechaLimiteRecapitulativa(g.mesKey, tipo);
      const semaforo = calcularSemaforo(fechaLimite, hoy, zona);
      // SCRUM-171b: el aviso se DERIVA aquí, con el plazo legal por delante de lo pactado.
      const aviso = avisoDeFacturacion(periodicidad, semaforo, g.mesKey, hoy, zona);
      return {
        mesKey: g.mesKey,
        mesLabel: g.mesLabel,
        albaranes: g.albaranes,
        jobId: albaranesOriginales[0].jobId,
        importePotencial: calcAlbaranTotales(lineasGrupo),
        fechaLimite, // SCRUM-643: ya viene como `YYYY-MM-DD`; `toIsoDateLocal` sobraba y se retiró
        semaforo,
        avisar: aviso.avisar,
        motivoAviso: aviso.motivo,
      };
    });

    // SCRUM-615: lo DECLARADO, sin resolver. Se calcula aquí y no en `resolveTipoDestinatario`
    // a propósito: esa función se queda EXACTAMENTE como está — es la red que sigue dando el
    // plazo más corto mientras nadie conteste, y vaciarla de casos es el trabajo de este ticket,
    // no borrarla.
    const declarado: TipoDestinatario | null =
      customer?.tipoDestinatario === 'EMPRESARIO' || customer?.tipoDestinatario === 'PARTICULAR'
        ? customer.tipoDestinatario
        : null;

    resultado.push({
      customerId,
      // SCRUM-577: el criterio sale del SITIO UNICO. Respaldo `'Cliente'` como antes.
      customerName: nombreParaDocumento(customer, 'Cliente'),
      tipoDestinatario: tipo,
      tipoDestinatarioDeclarado: declarado,
      billingPeriodicity: periodicidad,
      grupos,
    });
  }

  return resultado;
}
