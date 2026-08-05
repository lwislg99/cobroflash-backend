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

// ── ② Mapeo propuesto ────────────────────────────────────────────────────────

/** Los campos de Cliente que este importador sabe rellenar. */
export const CAMPOS_CLIENTE = ['name', 'phone', 'email', 'notes'] as const;
export type CampoCliente = (typeof CAMPOS_CLIENTE)[number];

/** Etiqueta humana de cada campo, para la pantalla de mapeo. */
export const ETIQUETA_CAMPO: Record<CampoCliente, string> = {
  name: 'Nombre',
  phone: 'Teléfono',
  email: 'Email',
  notes: 'Notas',
};

/**
 * Sinónimos por campo. El Excel de un fontanero trae `NOMBRE`, `TELEFONO`, `MOVIL`, `DIRECCION`
 * en cualquier orden y con tildes o sin ellas — por eso la comparación va sobre el nombre
 * NORMALIZADO (minúsculas, sin tildes, sin separadores).
 */
const SINONIMOS: Record<CampoCliente, string[]> = {
  name: ['nombre', 'name', 'cliente', 'razonsocial', 'nombrecompleto', 'contacto'],
  phone: ['telefono', 'phone', 'tel', 'movil', 'mobile', 'celular', 'telefono1', 'tlf'],
  email: ['email', 'correo', 'mail', 'correoelectronico', 'e-mail'],
  notes: ['notas', 'notes', 'nota', 'observaciones', 'comentarios', 'obs'],
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

    const phone = leer(celdas, 'phone') || null;
    const email = (leer(celdas, 'email') || '').toLowerCase() || null;
    const notes = leer(celdas, 'notes') || null;

    try {
      // Dedup por teléfono o email, SIEMPRE dentro del merchant (regla 2).
      if (phone || email) {
        const existente = await cliente.findFirst({
          where: {
            merchantId,
            OR: [...(phone ? [{ phone }] : []), ...(email ? [{ email }] : [])],
          },
        });
        if (existente) { base.omitidos++; continue; }
      }
      await cliente.create({ data: { merchantId, name, phone, email, notes } });
      base.creados++;
    } catch (e: any) {
      // 🔴 EL MENSAJE DE LA BASE VA AL LOG, NUNCA A LA PANTALLA.
      //
      // Antes esto ponía `e.message` en el informe, así que el pro leía cosas como
      // «Unique constraint failed on the fields: (`merchantId`,`email`)». Eso no le dice qué
      // hacer, y sí le dice cómo está montada nuestra base. Es la misma regla que sostiene
      // SCRUM-275: una respuesta sin texto humano acaba enseñando un identificador interno.
      console.error('[importarClientes] fila %d:', numeroDeFila, e?.message ?? e);
      base.rechazos.push({
        fila: numeroDeFila,
        motivo: 'No hemos podido guardar esta fila.', // copy aprobada (regla 30)
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
