// src/modules/system/domain/importarClientes.service.ts — SCRUM-312 (D1)
//
// EL IMPORTADOR DE CLIENTES, EN EL SERVIDOR.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// QUÉ CAMBIA Y POR QUÉ
//
// Antes el CSV lo parseaba el NAVEGADOR (`csvImport.js`) y mandaba JSON ya troceado. Eso dejaba
// dos parseos vivos del mismo formato —el del navegador y el de productos (SCRUM-339)— que
// además NO eran equivalentes: el del navegador no honraba `""` ni quitaba el BOM. El mismo
// fichero se leía distinto según por dónde entrara.
//
// Ahora el CSV crudo llega aquí y se parsea con las primitivas compartidas (`core/csv/csv.ts`),
// las MISMAS que usa productos. Un solo parseo.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// LOS TRES INNEGOCIABLES DEL TICKET, Y DÓNDE VIVE CADA UNO
//
//   ① CSV ESPAÑOL — `;` lo resuelve `detectarSeparador`. La CODIFICACIÓN la resuelve
//      `decodificarCsv`, y su punto fino es que **no se adivina en silencio**: se devuelve la
//      primera fila ya decodificada para que la juzgue una persona. Un fontanero no sabe qué es
//      Windows-1252; sí sabe si su cliente se llama José o Jos<?>.
//   ② PROPONER el mapeo — `proponerMapeo` lee la cabecera y propone, con su CONFIANZA. No
//      exige plantilla y no adivina a ciegas: lo que no reconoce lo dice.
//   ③ NADA EN SILENCIO — `importarClientes` devuelve TODAS las filas rechazadas con su motivo y
//      su número de fila, sin capar. `csvDeRechazos` las reescribe para que el usuario las
//      corrija y las vuelva a importar.
//
// TENENCIA: `merchantId` entra por parámetro y viene de `req.merchantId`, nunca del cuerpo. Un
// import no puede meter clientes en el merchant de otro.

import { trocearCsv, celdaCsv } from '../../../core/csv/csv';
// SCRUM-1022: lectura de .xlsx, solo en el PUNTO DE ENTRADA. Dependencia nueva autorizada por el
// fundador (regla 36, comentario 16597 de SCRUM-1022) tras la comparativa medida en ese ticket.
// `readSheet` (no el export por defecto, que en la 9.x devuelve TODAS las hojas) da las filas de
// UNA sola hoja — la primera si no se indica otra — que es lo único que hace falta aquí.
import { readSheet } from 'read-excel-file/node';
// SCRUM-884: el teléfono con la MISMA regla que el alta — las dos piezas que ya existen, no otra.
import { normalizarIdentificadores } from '../customerAdmin';
import { formasBuscables } from './identificadoresDuplicados';
// SCRUM-1046: el NIF con la MISMA validación que el alta manual — un solo sitio, `nifEspanol.ts`.
import { validarNifEspanol, normalizarNif } from '../../../core/validation/nifEspanol';
// SCRUM-580: las etiquetas con la MISMA decisión que el alta y la edición (límite 20×40, ausente ≠ vacío).
import { tagsParaPrisma } from '../tagsDelCliente';

// ── ① Codificación ───────────────────────────────────────────────────────────

export type Codificacion = 'utf-8' | 'windows-1252';

/**
 * Decodifica los bytes del fichero y dice CON QUÉ lo ha hecho.
 *
 * La detección es determinista y no una corazonada: UTF-8 en modo `fatal` **lanza** ante bytes
 * que no son UTF-8 válido, y un CSV de Excel español (cp1252) los tiene en cuanto aparece una
 * tilde. Si UTF-8 estricto pasa, es UTF-8; si lanza, es Windows-1252.
 *
 * ⚠️ QUEDA UN CASO QUE NINGUNA HEURÍSTICA RESUELVE: un fichero SOLO-ASCII es idéntico en las
 * dos, y uno cp1252 puede ser UTF-8 válido por casualidad. Por eso esto NO decide solo: el
 * llamador enseña `primeraFila` y una persona lo juzga. «Si no se puede determinar, se
 * pregunta» — y aquí no se puede determinar SIEMPRE, así que se pregunta siempre.
 */
export function decodificarCsv(
  bytes: Uint8Array,
  forzar?: Codificacion,
): { texto: string; codificacion: Codificacion; alternativa: Codificacion; primeraFila: string } {
  const codificacion: Codificacion = forzar ?? (esUtf8Valido(bytes) ? 'utf-8' : 'windows-1252');
  const texto = new TextDecoder(codificacion).decode(bytes);
  return {
    texto,
    codificacion,
    alternativa: codificacion === 'utf-8' ? 'windows-1252' : 'utf-8',
    // La primera línea NO vacía: es la que el usuario va a mirar para decidir.
    primeraFila: texto.split(/\r?\n/).find((l) => l.trim() !== '') ?? '',
  };
}

function esUtf8Valido(bytes: Uint8Array): boolean {
  try {
    new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    return true;
  } catch {
    return false;
  }
}

// ── ①b .xlsx (SCRUM-1022) ────────────────────────────────────────────────────

const FIRMA_ZIP = Buffer.from([0x50, 0x4b, 0x03, 0x04]); // 'PK\x03\x04': todo OOXML (.xlsx incluido) es un ZIP

/** ¿Son estos bytes un .xlsx (o cualquier Office moderno)? Se mira la firma, no la extensión. */
export function pareceXlsx(bytes: Uint8Array): boolean {
  return bytes.length >= 4 && Buffer.from(bytes.subarray(0, 4)).equals(FIRMA_ZIP);
}

/**
 * Lee la primera hoja de un .xlsx y la reescribe como texto CSV (mismo separador `;` que usa el
 * resto del importador), para que tenga la MISMA forma que `decodificarCsv(...).texto`. Con eso,
 * `trocearCsv`, `proponerMapeo` e `importarClientes` no saben ni les importa de dónde vino el
 * texto: no cambian ni una línea.
 *
 * Un .xlsx no tiene la ambigüedad de codificación de un CSV (la resuelve la librería sobre el XML
 * interno), así que esto sustituye a `decodificarCsv`, no lo envuelve.
 */
export async function xlsxATextoCsv(bytes: Buffer): Promise<string> {
  const filas = await readSheet(bytes);
  return filas.map((fila) => fila.map((celda) => celdaCsv(celdaXlsxATexto(celda), ';')).join(';')).join('\r\n');
}

function celdaXlsxATexto(valor: unknown): string {
  if (valor == null) return '';
  if (valor instanceof Date) return valor.toISOString().slice(0, 10);
  return String(valor);
}

// ── ② Mapeo propuesto ────────────────────────────────────────────────────────

/**
 * Los campos de Cliente que este importador sabe rellenar.
 *
 * SCRUM-1046: se añaden NIF, móvil, etiquetas y dirección fiscal — el CSV de hoy sólo traía los
 * cuatro primeros. Un CSV de 4 columnas como el de siempre sigue funcionando igual: todo lo nuevo
 * es opcional y `mapeo` es `Partial`.
 *
 * 🔴 `movil` SALE DE LOS SINÓNIMOS DE `phone`. Antes «MOVIL»/«MOBILE»/«CELULAR» se reconocían como
 * `phone` porque no existía otro sitio donde ponerlos. Ahora que `Customer.mobile` es un campo
 * propio (SCRUM-590), dejarlos en los dos sitios haría que quien gane dependa del ORDEN de
 * `CAMPOS_CLIENTE` — y es exactamente el defecto que el guard ② ya vigila para dos columnas del
 * mismo campo. `phone` se queda con las formas de teléfono FIJO.
 */
export const CAMPOS_CLIENTE = [
  'name', 'phone', 'mobile', 'email', 'notes', 'taxId', 'tags',
  'billingAddress', 'billingCity', 'billingPostalCode', 'billingProvince', 'billingCountry',
] as const;
export type CampoCliente = (typeof CAMPOS_CLIENTE)[number];

/** Etiqueta humana de cada campo, para la pantalla de mapeo. */
export const ETIQUETA_CAMPO: Record<CampoCliente, string> = {
  name: 'Nombre',
  phone: 'Teléfono',
  mobile: 'Móvil',
  email: 'Email',
  notes: 'Notas',
  taxId: 'NIF/CIF',
  tags: 'Etiquetas',
  billingAddress: 'Dirección fiscal',
  billingCity: 'Ciudad',
  billingPostalCode: 'Código postal',
  billingProvince: 'Provincia',
  billingCountry: 'País (ISO, ej. ES)',
};

/**
 * Sinónimos por campo. El Excel de un fontanero trae `NOMBRE`, `TELEFONO`, `MOVIL`, `DIRECCION`
 * en cualquier orden y con tildes o sin ellas — por eso la comparación va sobre el nombre
 * NORMALIZADO (minúsculas, sin tildes, sin separadores).
 */
const SINONIMOS: Record<CampoCliente, string[]> = {
  name: ['nombre', 'name', 'cliente', 'razonsocial', 'nombrecompleto', 'contacto'],
  phone: ['telefono', 'phone', 'tel', 'telefono1', 'tlf', 'fijo'],
  mobile: ['movil', 'mobile', 'celular', 'telefonomovil'],
  email: ['email', 'correo', 'mail', 'correoelectronico', 'e-mail'],
  notes: ['notas', 'notes', 'nota', 'observaciones', 'comentarios', 'obs'],
  taxId: ['nif', 'cif', 'dni', 'nie', 'taxid', 'identificacionfiscal', 'nifcif'],
  tags: ['etiquetas', 'etiqueta', 'tags', 'tag'],
  billingAddress: ['direccion', 'direccionfiscal', 'domicilio', 'calle', 'address'],
  billingCity: ['ciudad', 'localidad', 'poblacion', 'city'],
  billingPostalCode: ['codigopostal', 'cp', 'postal', 'postalcode', 'zip'],
  billingProvince: ['provincia', 'province'],
  billingCountry: ['pais', 'country', 'paisiso'],
};

export function normalizarCabecera(s: string): string {
  return String(s ?? '')
    .trim().toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '') // tildes fuera
    .replace(/[^a-z0-9]/g, '');                       // espacios, guiones, puntos
}

export type ColumnaPropuesta = {
  indice: number;
  columna: string;                 // el nombre TAL CUAL viene en el fichero
  campo: CampoCliente | null;      // null = no se ha reconocido
  confianza: 'exacta' | 'sinonimo' | 'ninguna';
};

/**
 * Propone un mapeo leyendo la cabecera. NO exige plantilla y NO adivina a ciegas: lo que no
 * reconoce lo devuelve con `campo: null`, para que la pantalla lo diga y el usuario elija.
 *
 * Un campo no se propone DOS veces: si el fichero trae `TELEFONO` y `MOVIL`, gana la primera y
 * la segunda queda sin reconocer. Repartir el mismo campo entre dos columnas es peor que
 * preguntar, porque una de las dos se perdería sin que se note.
 */
export function proponerMapeo(cabecera: string[]): ColumnaPropuesta[] {
  const usados = new Set<CampoCliente>();
  return cabecera.map((columna, indice) => {
    const norm = normalizarCabecera(columna);
    for (const campo of CAMPOS_CLIENTE) {
      if (usados.has(campo)) continue;
      if (norm === campo) { usados.add(campo); return { indice, columna, campo, confianza: 'exacta' as const }; }
    }
    for (const campo of CAMPOS_CLIENTE) {
      if (usados.has(campo)) continue;
      if (SINONIMOS[campo].includes(norm)) { usados.add(campo); return { indice, columna, campo, confianza: 'sinonimo' as const }; }
    }
    return { indice, columna, campo: null, confianza: 'ninguna' as const };
  });
}

// ── ③ La importación, sin descartar nada en silencio ─────────────────────────

export type FilaRechazada = { fila: number; motivo: string; celdas: string[] };
export type ResultadoImport = {
  creados: number;
  omitidos: number;               // duplicados: ya existían, no es un error
  rechazos: FilaRechazada[];      // TODAS, sin capar
  cabecera: string[];
  separador: string;
};

type ClienteMinimo = { findFirst: Function; create: Function };

/**
 * Importa. `mapeo` es campo → índice de columna, ya CONFIRMADO por el usuario en la pantalla de
 * mapeo — aquí no se adivina nada.
 *
 * 🔴 SIN `name` NO SE IMPORTA, y se dice: antes el navegador devolvía `[]` cuando no encontraba
 * la columna de nombre, así que el usuario veía «0 importados» sin saber por qué. Ahora eso no
 * puede pasar en silencio.
 */
export async function importarClientes(
  merchantId: number,
  csv: string,
  mapeo: Partial<Record<CampoCliente, number>>,
  cliente: ClienteMinimo,
): Promise<ResultadoImport> {
  const { cabecera, filas, separador } = trocearCsv(csv);
  const base: ResultadoImport = { creados: 0, omitidos: 0, rechazos: [], cabecera, separador };

  if (mapeo.name == null) {
    throw new Error('sin_columna_nombre');
  }

  const leer = (celdas: string[], campo: CampoCliente): string => {
    const i = mapeo[campo];
    if (i == null || i < 0 || i >= celdas.length) return '';
    return String(celdas[i] ?? '').trim();
  };

  for (let f = 0; f < filas.length; f++) {
    const celdas = filas[f];
    // Número de fila TAL COMO LO VE EL USUARIO en su hoja: +1 por la cabecera, +1 porque las
    // hojas empiezan en 1. Un «fila 14» que no coincide con su Excel no sirve para corregir.
    const numeroDeFila = f + 2;

    const name = leer(celdas, 'name');
    if (!name) {
      base.rechazos.push({ fila: numeroDeFila, motivo: 'Falta el nombre', celdas });
      continue;
    }

    // 🔴 SCRUM-884 · el teléfono y el móvil se GUARDAN como los guarda el alta
    // (`normalizarIdentificadores`), y se BUSCAN por sus formas (`formasBuscables`), como el aviso
    // de duplicado del alta. Hacen falta las dos: `normalizePhone` sola da `612345678` y
    // `34612345678` para el mismo cliente, porque no resuelve el prefijo de país — y guardar CON
    // prefijo supuesto no es decisión de este ticket.
    const telefonoDelCsv = leer(celdas, 'phone') || null;
    const movilDelCsv = leer(celdas, 'mobile') || null;
    const { phone, mobile } = normalizarIdentificadores({ phone: telefonoDelCsv, mobile: movilDelCsv });
    const email = (leer(celdas, 'email') || '').toLowerCase() || null;
    const notes = leer(celdas, 'notes') || null;

    // SCRUM-1046 · el NIF con la MISMA validación que el alta manual (forma + dígito de control;
    // vacío sigue siendo válido). Una fila con NIF mal formado se rechaza con su motivo — no se
    // importa el resto de la fila con un NIF roto en silencio.
    const taxIdDelCsv = leer(celdas, 'taxId') || null;
    if (taxIdDelCsv && !validarNifEspanol(taxIdDelCsv).valido) {
      base.rechazos.push({ fila: numeroDeFila, motivo: 'NIF/CIF con formato incorrecto', celdas });
      continue;
    }

    // El país viaja en ISO-3166-1 alfa-2, como `Merchant.country` y como pide el esquema
    // (`billingCountry` es `@db` de 2 caracteres). Un Excel con «España» completa no se adivina a
    // «ES» — sería inventar un dato que el fontanero no escribió con esa forma — así que se
    // rechaza la fila y se dice, en vez de guardar un país que nadie tecleó.
    const paisDelCsv = leer(celdas, 'billingCountry') || null;
    if (paisDelCsv && !/^[A-Za-z]{2}$/.test(paisDelCsv)) {
      base.rechazos.push({ fila: numeroDeFila, motivo: 'País debe ser el código ISO de 2 letras (ej. ES)', celdas });
      continue;
    }
    const billingCountry = paisDelCsv ? paisDelCsv.toUpperCase() : null;

    // SCRUM-580 (CONT-07) · las etiquetas, separadas por `;` DENTRO de la celda ya trocedada — el
    // `;` del separador del CSV lo resuelve `trocearCsv` antes de llegar aquí, así que partir esta
    // cadena no puede desplazar ninguna otra columna. `tagsParaPrisma` aplica el límite 20×40 y la
    // traducción a `Prisma.DbNull`, la MISMA que usan el alta y la edición manuales.
    const etiquetasDelCsv = leer(celdas, 'tags');
    const tagsBrutas = etiquetasDelCsv ? etiquetasDelCsv.split(';').map((t) => t.trim()).filter(Boolean) : undefined;
    const tags = tagsParaPrisma(tagsBrutas);

    const billingAddress = leer(celdas, 'billingAddress') || null;
    const billingCity = leer(celdas, 'billingCity') || null;
    const billingPostalCode = leer(celdas, 'billingPostalCode') || null;
    const billingProvince = leer(celdas, 'billingProvince') || null;

    try {
      // Dedup por teléfono, móvil, NIF o email, SIEMPRE dentro del merchant (regla 2). Las formas
      // de teléfono/móvil salen de la CELDA, no del número ya limpio: incluyen el texto tal cual,
      // así que una fila vieja guardada sin normalizar se sigue encontrando con el mismo texto,
      // como antes de este ticket.
      //
      // ⚠️ El NIF se compara SIN DISTINGUIR MAYÚSCULAS (`mode: 'insensitive'`) y con la forma que
      // da `normalizarNif` (sin espacios/puntos/guiones) además de la tal cual — eso resuelve
      // `b58818501` (CSV) contra `A58818501` (guardado). NO resuelve una diferencia de SEPARADORES
      // en el lado ya guardado (`A-5881850-1` en la base no lo encontraría un `A58818501` del
      // CSV): el alta manual no normaliza `taxId` al guardar, así que no hay un único formato del
      // que partir. Cerrar eso es del alta, no de este importador.
      const formasNif = taxIdDelCsv
        ? [...new Set([taxIdDelCsv.trim(), normalizarNif(taxIdDelCsv)])]
        : [];
      const or = [
        ...formasBuscables(telefonoDelCsv).map((forma) => ({ phone: forma })),
        ...formasBuscables(movilDelCsv).map((forma) => ({ mobile: forma })),
        ...(email ? [{ email }] : []),
        ...formasNif.map((forma) => ({ taxId: { equals: forma, mode: 'insensitive' as const } })),
      ];
      if (or.length) {
        const existente = await cliente.findFirst({ where: { merchantId, OR: or } });
        if (existente) { base.omitidos++; continue; }
      }
      await cliente.create({
        data: {
          merchantId, name, phone, mobile, email, notes,
          taxId: taxIdDelCsv, tags,
          billingAddress, billingCity, billingPostalCode, billingProvince, billingCountry,
        },
      });
      base.creados++;
    } catch (e: any) {
      base.rechazos.push({
        fila: numeroDeFila,
        motivo: String(e?.message ?? e).slice(0, 120),
        celdas,
      });
    }
  }

  return base;
}

/**
 * Reescribe las filas rechazadas como CSV, con su cabecera original y una columna de MOTIVO al
 * final. Es lo que se descarga para corregir y volver a importar — el ticket lo pide explícito:
 * «las filas que no entran se listan con su motivo y se pueden descargar».
 *
 * Sale con BOM y `;` cuando el original venía así: si se descarga algo que Excel abre mal, el
 * usuario no puede corregir nada.
 */
export function csvDeRechazos(r: ResultadoImport): string {
  const sep = r.separador || ';';
  const cabecera = [...r.cabecera, 'MOTIVO'].map((c) => celdaCsv(c, sep)).join(sep);
  const filas = r.rechazos.map((x) => [...x.celdas, x.motivo].map((c) => celdaCsv(c, sep)).join(sep));
  return '﻿' + [cabecera, ...filas].join('\r\n') + '\r\n';
}
