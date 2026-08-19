// src/modules/exports/domain/portabilidadCompleta.ts — SCRUM-244 (punto 2: COBERTURA)
//
// «DAME TODO LO MÍO» — y el «todo» NO se escribe a mano.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// POR QUÉ ESTO NO ES EL EXPORT QUE YA EXISTE
//
// `/admin/exports/datos.zip` contesta **«dame mi actividad»**: seis datasets de negocio, con
// rango de fechas, elegidos porque son los que un profesional mira. Está bien y no se toca.
//
// Esto contesta otra pregunta: **«dame TODO lo mío»** (art. 15 y 20 RGPD). Y la diferencia no
// es de tamaño, es de forma: en aquel, la lista de datasets es una DECISIÓN de producto; aquí
// una lista enumerada a mano es un DEFECTO, porque envejece el día que alguien declara un
// modelo nuevo y **nadie se entera de que el «todo» dejó de serlo**.
//
// Medido en este repo, y ya van dos de dos: las listas de modelos CON guard
// (`MODELOS_POR_MERCHANT`, `ORDEN_BORRADO_MERCHANT`) están completas; las dos SIN guard
// (`wipeDemo` y el `TABLES` del backup) han derivado las dos.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// DE DÓNDE SALE LA LISTA: DEL DMMF, QUE ES EL SCHEMA
//
// `Prisma.dmmf` es el schema compilado dentro del cliente generado — la misma fuente de la que
// derivan el guard de borrado (SCRUM-192) y el chequeo de arranque (SCRUM-222). Un modelo nuevo
// con `merchantId` aparece aquí **solo**, sin que nadie lo añada a ningún sitio.
//
// ⚠️ SE DERIVA POR EL NOMBRE DEL CAMPO (`merchantId`), NUNCA POR EL DE LA COLUMNA.
//
// Es la trampa que ya costó el backfill de SCRUM-205, y aquí muerde igual: **de los 22 modelos
// con `merchantId`, 19 mapean a `merchant_id` y DOS no** — `Quote` e `Invoice` guardan la
// columna en camelCase (`invoices.merchantId`). Medido contra el DMMF, no supuesto. Derivar la
// lista buscando una columna `merchant_id` perdería esos dos **en silencio**: un export de
// portabilidad al que le faltan las facturas y los presupuestos, sin ningún aviso.
//
// Como el filtro se hace con Prisma (`findMany({ where: { merchantId } })`), el nombre físico
// no entra en juego en ningún punto de este módulo. Y si algún día hiciera falta, sale del
// DMMF (`field.dbName ?? field.name`), jamás de una convención.
import { Prisma } from '@prisma/client';
import { csvRow } from './exportData';

/** El campo que marca la pertenencia a un merchant. Un solo sitio lo nombra. */
export const CAMPO_TENENCIA = 'merchantId';

/**
 * Modelos que NO entran en el paquete, cada uno con su motivo.
 *
 * Se DECLARAN en vez de omitirse: una ausencia sin explicación es indistinguible de un olvido
 * —el criterio de `FUERA_DEL_BARRIDO_GENERICO`— y el guard obliga a que todo modelo derivado
 * esté cubierto o esté aquí. Añadir uno se ve en el diff; olvidarlo, no.
 */
export const EXCLUIDOS: Readonly<Record<string, string>> = {
  // Tokens de sesión VIVOS. Exportarlos sería meter credenciales operativas en un ZIP que
  // viaja por correo: quien lo interceptara entraría en la cuenta. No son «datos del
  // interesado» en ningún sentido útil — son la llave, no el contenido.
  authSession: 'tokens de sesión vivos: exportarlos es entregar credenciales, no datos',
  // Registro fiscal del productor del SIF. Qué se conserva y qué se anonimiza está BLOQUEADO
  // por dictamen (SCRUM-244 punto 1b): sacarlo del paquete ahora no prejuzga esa decisión,
  // meterlo sí. Se revisa cuando el dictamen exista.
  auditLog: 'rastro fiscal: su tratamiento está bloqueado por dictamen (punto 1b)',
};

export type ModeloExportable = { modelo: string; delegado: string };

const camel = (m: string) => m.charAt(0).toLowerCase() + m.slice(1);

/**
 * Los modelos del merchant, DERIVADOS. `datamodel` inyectable para poder probar la derivación
 * con casos inventados y, sobre todo, para poder CEGARLA y comprobar que el suelo salta.
 *
 * Devuelve también el nombre del delegado de Prisma (`quoteTemplate`, no `QuoteTemplate`),
 * porque es lo que hace falta para consultar y calcularlo dos veces sería tener dos verdades.
 */
export function modelosDelMerchant(
  datamodel: { models: readonly any[] } = Prisma.dmmf.datamodel,
): ModeloExportable[] {
  return datamodel.models
    .filter((m) => m.fields.some((f: any) => f.name === CAMPO_TENENCIA))
    .map((m) => ({ modelo: m.name, delegado: camel(m.name) }))
    .sort((a, b) => a.modelo.localeCompare(b.modelo));
}

/** Los que de verdad se exportan: los derivados menos los declarados fuera. */
export function modelosAExportar(
  datamodel: { models: readonly any[] } = Prisma.dmmf.datamodel,
): ModeloExportable[] {
  return modelosDelMerchant(datamodel).filter((m) => !(m.delegado in EXCLUIDOS));
}

/**
 * Las columnas escalares de un modelo, del DMMF. Se excluyen las relaciones (`kind: 'object'`),
 * que no son columnas — mismo criterio que `schemaDrift.ts`, para que las dos derivaciones no
 * puedan discrepar sobre qué es un campo.
 */
export function camposDe(
  modelo: string,
  datamodel: { models: readonly any[] } = Prisma.dmmf.datamodel,
): string[] {
  const m = datamodel.models.find((x) => x.name === modelo);
  if (!m) return [];
  return m.fields.filter((f: any) => f.kind !== 'object').map((f: any) => f.name);
}

/**
 * SUELO ANTI-DERIVACIÓN-CIEGA. Es la mitad del valor de este módulo.
 *
 * Si el DMMF llega vacío —import roto, cliente sin generar, un `datamodel` que no es lo que
 * parece— la derivación devolvería CERO modelos y el paquete saldría **vacío y verde**: un ZIP
 * con un `LEEME` dentro y nada más, entregado como «todos tus datos». Eso es peor que fallar,
 * porque el profesional se lo cree.
 *
 * El número no se fija a 21 a propósito: un mínimo no estorba cuando alguien añade un modelo,
 * y un exacto obligaría a tocar esto en cada PR ajeno hasta que alguien lo desactive.
 */
export const MINIMO_MODELOS = 15;

export function comprobarDerivacion(
  datamodel: { models: readonly any[] } = Prisma.dmmf.datamodel,
): { ok: true } | { ok: false; motivo: string } {
  const derivados = modelosDelMerchant(datamodel);
  if (derivados.length < MINIMO_MODELOS) {
    return {
      ok: false,
      motivo:
        `la derivación ve ${derivados.length} modelos con \`${CAMPO_TENENCIA}\` y debería ver al ` +
        `menos ${MINIMO_MODELOS}. NO se entrega un paquete a medias: un export de portabilidad ` +
        'incompleto que se presenta como completo es peor que un error, porque nadie lo revisa.',
    };
  }
  return { ok: true };
}

export type Dataset = { modelo: string; fichero: string; filas: Record<string, unknown>[] };

/**
 * Construye el paquete completo. FALLA RUIDOSAMENTE si la derivación no ve lo que debe.
 *
 * `cliente` inyectado: los tests ejercitan esto con un doble, sin BD y sin gate.
 *
 * ⚠️ NO incluye los modelos que pertenecen a un merchant SIN tener su columna (`Event`,
 * `Reconciliation`, que cuelgan de `Charge`). Están declarados en `COLGADOS_DE_CHARGE`
 * (`system/domain/borradoMerchant.ts`) y entran en el paso siguiente junto con los adjuntos
 * binarios, que no son filas de CSV. Se dice aquí para que la ausencia no se lea como olvido.
 */
export async function construirPaquete(
  cliente: any,
  merchantId: number,
  datamodel: { models: readonly any[] } = Prisma.dmmf.datamodel,
): Promise<Dataset[]> {
  const suelo = comprobarDerivacion(datamodel);
  if (!suelo.ok) throw new Error(`portabilidad_derivacion_ciega: ${suelo.motivo}`);

  const out: Dataset[] = [];
  for (const { modelo, delegado } of modelosAExportar(datamodel)) {
    const delegate = cliente[delegado];
    if (!delegate?.findMany) {
      // Fallar, no saltar: un modelo derivado que el cliente no expone significa que la
      // derivación y el cliente miran schemas distintos, y entonces NADA de esto es fiable.
      throw new Error(`portabilidad_modelo_sin_delegado: ${modelo} (${delegado})`);
    }
    const filas = await delegate.findMany({ where: { [CAMPO_TENENCIA]: merchantId } });
    out.push({ modelo, fichero: `csv/${delegado}.csv`, filas });
  }
  return out;
}

/**
 * Un dataset a CSV. Las CABECERAS son los nombres de CAMPO del DMMF, no los de columna.
 *
 * Es deliberado y va en la dirección del art. 20 («de uso común y lectura mecánica»): quien
 * recibe el paquete lee `merchantId`, no `merchant_id` en unas tablas y `merchantId` en otras
 * según cuál llevara `@map`. Mezclar las dos convenciones en un mismo ZIP es exactamente lo que
 * hace ilegible un export automático.
 *
 * `null` y `undefined` salen vacíos; las fechas en ISO; los objetos (JSON de Prisma) en JSON.
 * Sin esto, un `Json` saldría como `[object Object]` — una columna presente y sin información,
 * que es peor que una ausente porque parece que está.
 */
export function datasetACsv(dataset: Dataset, campos: string[]): string {
  const valor = (v: unknown): unknown => {
    if (v == null) return '';
    if (v instanceof Date) return v.toISOString();
    if (typeof v === 'object') return JSON.stringify(v);
    return v;
  };
  // ⚠️ `csvRow` devuelve la fila SIN terminador — lo pone quien une, igual que en `sendCsv`.
  // Unir con '' pegaba la cabecera a la primera fila y dejaba el CSV entero en un renglón:
  // un fichero que se abre, no da error, y no significa nada. Lo cazó el test al primer intento.
  const lineas = [csvRow(campos)];
  for (const fila of dataset.filas) lineas.push(csvRow(campos.map((c) => valor(fila[c]))));
  return lineas.join('\r\n') + '\r\n';
}

/**
 * El aviso que acompaña al paquete (art. 15: finalidades, destinatarios, plazos).
 *
 * ⚠️ EL TEXTO VA EN BLANCO A PROPÓSITO — decisión del fundador. Es microcopy oficial y lo
 * aprueba él (regla 30). Que la pieza EXISTA vacía es mejor que no exista: el día que el texto
 * esté aprobado, ponerlo es una línea, y mientras tanto quien abra el ZIP ve que falta algo en
 * vez de no ver nada. Un hueco declarado es más honesto que una ausencia silenciosa.
 */
export const LEEME = [
  'Tus datos de YaQu',
  '=================',
  '',
  'Este ZIP contiene una copia de tus datos en YaQu, en ficheros CSV que puedes abrir con',
  'cualquier hoja de cálculo.',
  '',
  'Lo has descargado tú desde tu panel, y nadie más lo recibe.',
  '',
  'Dentro hay un CSV por cada tipo de dato. La primera fila de cada uno son los nombres de',
  'las columnas.',
  '',
  'Para qué usamos tus datos, quién los recibe y cuánto tiempo los guardamos, lo tienes',
  'explicado en nuestra política de privacidad: yaqu.app/privacidad',
  '',
].join('\n');
