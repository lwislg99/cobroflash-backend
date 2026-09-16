// src/modules/system/domain/identificadoresDuplicados.ts — SCRUM-578 (CONT-05)
//
// ¿ESTE VALOR YA LO USA OTRO CLIENTE? — el aviso de duplicado, en UN solo sitio.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// LA LISTA DE CAMPOS IDENTIFICADORES ES **UNA**, Y ESO ES EL DISEÑO
//
// No es una condición repetida por el código: es `IDENTIFICADORES`, aquí abajo. El día que
// SCRUM-590 (CONT-19) añada el segundo teléfono, **tiene que ser añadir una entrada a este
// array**, no buscar dónde se compara. Es la lección de `_navegador.mjs`: la regla en un sitio,
// y quien la use que la importe.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// LAS TRES PRECISIONES DEL FUNDADOR (P-CONT-3), Y DÓNDE VIVE CADA UNA
//
//  1. ES AVISO, NO BLOQUEO. Este módulo **sólo devuelve coincidencias**: no lanza, no rechaza y
//     no impide guardar. Hay casos legítimos —marido y mujer con el mismo móvil, dos comunidades
//     del mismo administrador con el mismo email— y bloquearlos sería peor que el duplicado.
//  2. NUNCA EL NOMBRE. No está en `IDENTIFICADORES` y no puede estar: «María García» saltaría
//     constantemente y el aviso se volvería ruido que nadie lee. El guard de la suite lo fija.
//  3. SE COMPARA EL VALOR **NORMALIZADO**, no el texto tecleado. Es el defecto del ticket:
//     `+34 662629419` y `662629419` se guardaron como dos clientes.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// 🔴 POR QUÉ HAY UNA FORMA CANÓNICA ADEMÁS DE `normalizePhone`, Y POR QUÉ NO ES UNA SEGUNDA
//    NORMALIZACIÓN
//
// Medido ejecutando la función, no leyéndola: **`normalizePhone` NO colapsa el caso de la
// evidencia.** Normaliza el formato (espacios, guiones, `+`, `00`) pero **no resuelve el prefijo
// de país**: `+34 662629419` → `34662629419` y `662629419` → `662629419`, que son distintos. Y
// está fijado así a propósito en `tests/utils.test.mjs:19`.
//
// `normalizePhone` NO SE TOCA, y no es cautela: tiene ~40 llamadores —`whatsapp.ts`,
// `whatsappPolicy`, `invoiceWhatsApp`, `sendQuote`, `botFlow`, `whatsappIncoming`, `maintenance`—
// y es **el número al que se envía el WhatsApp**. Cambiar lo que devuelve cambia a dónde se manda
// un mensaje.
//
// Así que `canonParaComparar` **no sustituye ni duplica** a `normalizePhone`: la LLAMA y le añade
// un paso que sólo tiene sentido comparando. Y vive **en memoria y sólo para comparar**: no
// escribe en ninguna fila, así que la decisión (d) —los duplicados que ya existen no se tocan— se
// respeta entera.
import { normalizePhone } from '../../../core/utils/utils';
import { normalizarNif } from '../../../core/validation/nifEspanol'; // SCRUM-575: UNA normalización

// ⚠️ ESTOS TRES NO SE EXPORTAN, y no es descuido: fuera de este módulo nadie los consume salvo su
// test, y el guard de SCRUM-411 lo caza. Se prueban por la SUPERFICIE PÚBLICA —`buscarCoincidencias`—
// que es lo que de verdad usa el producto. Exportar para poder testear infla la superficie y deja
// export huérfano; si algún día un consumidor real los necesita, se exportan ENTONCES.

/** El prefijo que se supone cuando un número viene sin él. España-first (máster). */
const PREFIJO_POR_DEFECTO = '34';

/**
 * 🔴 LA FORMA CANÓNICA, **SÓLO PARA COMPARAR**. Nunca se guarda.
 *
 * Un número de 9 dígitos es un nacional sin prefijo, y se le supone el del país por defecto. Ésa
 * suposición es la que hace que el caso del ticket colapse.
 *
 * ⚠️ Y ES UNA SUPOSICIÓN, con su riesgo declarado: un móvil francés o portugués también tiene 9
 * dígitos, así que guardado a pelo se canonizaría como español y podría chocar con uno. Medido
 * sobre las dos bases disponibles el 24-ago-2026: **0 clientes de 15 tienen un teléfono de 9
 * dígitos sin prefijo**, o sea 0 filas en riesgo hoy. Y el selector de prefijo de este mismo
 * ticket hace que no puedan aparecer más de aquí en adelante.
 */
function canonParaComparar(valor: string | null | undefined, prefijo = PREFIJO_POR_DEFECTO): string {
  const n = normalizePhone(valor);
  if (!n) return '';
  return n.length === 9 ? prefijo + n : n;
}

/** Email: minúsculas y sin espacios alrededor. Dos personas no escriben su correo igual. */
export function canonEmail(valor: string | null | undefined): string {
  return String(valor ?? '').trim().toLowerCase();
}

/**
 * NIF/CIF: mayúsculas y sin separadores — `B-12345678` y `b12345678` son el mismo documento.
 *
 * 🔴 DELEGA en `normalizarNif` (SCRUM-575) en vez de tener su propia copia. Dos normalizaciones
 * del mismo dato son dos sitios donde divergir, que es exactamente el defecto que este ticket
 * documentó con los teléfonos: no se comete otra vez con los NIF.
 */
export function canonNif(valor: string | null | undefined): string {
  return normalizarNif(valor);
}

export interface CampoIdentificador {
  /** El campo del modelo `Customer`. */
  campo: 'phone' | 'email' | 'taxId';
  /** A forma comparable. */
  canon: (v: string | null | undefined) => string;
}

/**
 * 🔴 EL SITIO ÚNICO. Añadir un identificador es añadir una entrada AQUÍ.
 *
 * NO está `name`, y no es un olvido: es la precisión 2 del fundador.
 *
 * ⏳ PENDIENTE DE SCRUM-590 (CONT-19): ese ticket parte el teléfono en dos campos —Teléfono y
 * Móvil— y el criterio para ellos YA está decidido (P-CONT-3): «mismo VALOR en CUALQUIER campo
 * identificador», así que un valor guardado como móvil que ya exista como fijo en otro cliente
 * también avisa. **Aquí no se construye ni se prueba porque el segundo campo no existe todavía**
 * — se comprobó sobre el modelo `Customer` completo. Cuando 590 lo cree, el cruce sale solo:
 * basta añadir `{ campo: 'mobile', canon: canonParaComparar }` a este array, porque la búsqueda
 * de abajo ya compara TODOS contra TODOS.
 */
const IDENTIFICADORES: readonly CampoIdentificador[] = Object.freeze([
  { campo: 'phone', canon: canonParaComparar },
  { campo: 'email', canon: canonEmail },
  { campo: 'taxId', canon: canonNif },
]);

export interface ClienteComparable {
  id: number;
  phone?: string | null;
  email?: string | null;
  taxId?: string | null;
}

export interface Coincidencia {
  /** El campo del cliente que se está dando de alta o editando. */
  campo: CampoIdentificador['campo'];
  /** El campo del OTRO cliente donde ese mismo valor ya estaba. Puede ser distinto: es el cruce. */
  campoExistente: CampoIdentificador['campo'];
  customerId: number;
}

/**
 * Busca, entre `existentes`, qué identificadores de `candidato` ya están en uso.
 *
 * CRUZA TODOS CONTRA TODOS a propósito: el criterio del fundador es «MISMO VALOR, EN CUALQUIER
 * CAMPO IDENTIFICADOR», no «mismo campo, mismo valor». Hoy el cruce phone↔email↔taxId casi nunca
 * dispara —son formas distintas— pero la estructura es la que 590 necesita, y montarla ahora
 * cuesta lo mismo que montarla mal.
 *
 * 🔴 EL VACÍO NO CUENTA, y es el falso positivo que más daño haría: `canon(null)` es `''`, así que
 * sin este descarte **todo cliente sin teléfono sería duplicado de todos los demás sin teléfono**.
 * Un aviso que salta siempre es exactamente el ruido que la precisión 2 quiere evitar.
 *
 * Se excluye al propio cliente por `id`: editar a alguien no puede avisar de que choca consigo mismo.
 */
export function buscarCoincidencias(
  candidato: ClienteComparable,
  existentes: ClienteComparable[],
): Coincidencia[] {
  const fuera: Coincidencia[] = [];

  for (const propio of IDENTIFICADORES) {
    const valor = propio.canon(candidato[propio.campo]);
    if (!valor) continue; // el vacío nunca coincide con nada

    for (const otro of existentes) {
      if (otro.id === candidato.id) continue; // no choca consigo mismo
      for (const ajeno of IDENTIFICADORES) {
        if (ajeno.canon(otro[ajeno.campo]) === valor) {
          fuera.push({ campo: propio.campo, campoExistente: ajeno.campo, customerId: otro.id });
        }
      }
    }
  }
  return fuera;
}

/**
 * Las formas en que un mismo número puede estar GUARDADO hoy, para poder buscarlo por índice en
 * vez de leerse la tabla entera.
 *
 * Hace falta porque la canonización vive en memoria y la base guarda lo que le escribieron: un
 * `34012345678` nuevo tiene que encontrar a un `012345678` viejo. Se generan las dos formas —con
 * prefijo y sin él— más el texto tal cual, por si nunca pasó por ninguna normalización.
 */
export function formasBuscables(valor: string | null | undefined, prefijo = PREFIJO_POR_DEFECTO): string[] {
  const crudo = String(valor ?? '').trim();
  const n = normalizePhone(valor);
  const formas = new Set<string>();
  if (crudo) formas.add(crudo);
  if (n) {
    formas.add(n);
    formas.add(`+${n}`);
    if (n.startsWith(prefijo) && n.length === prefijo.length + 9) formas.add(n.slice(prefijo.length));
    if (n.length === 9) formas.add(prefijo + n);
  }
  return [...formas];
}
