// src/modules/jobs/domain/parteDictado.ts — SCRUM-683
//
// EL DICTADO DEL TÉCNICO → DOS LISTAS PROPUESTAS. Puro: sin BD, sin red, sin Express.
//
// ═════════════════════════════════════════════════════════════════════════════════════════
// 🔴 LA DIFERENCIA CON EL MOTOR QUE YA EXISTE, Y ES UNA DECISIÓN INVERTIDA
//
// `sanearLineasAlbaran` (`ai.service.ts:208`) ya convierte un dictado en líneas, ya aguanta
// muletillas y ya sabe no copiar precios en `SIN_VALORAR`. Este fichero NO lo reescribe: cambia
// **una** decisión, y por eso no puede reutilizarlo tal cual.
//
// Aquella pasa la cantidad por `cantidadUtilizable` (`lineasSugeridas.ts:42`), que devuelve **1**
// para todo lo que no sea un número positivo, y su prompt lo pide explícitamente
// (`ai.service.ts:244`: «Si no se dice, 1»). En un presupuesto eso es correcto y el fundador lo
// decidió así el 2-ago-2026: el número raro se ve, el profesional lo corrige y sigue.
//
// **En el parte no.** El parte se firma en obra y la oficina lo factura después: una cantidad
// inventada se convierte en una cantidad FACTURADA a un cliente que no la pidió. Aquí la regla es
// la contraria y no admite matiz:
//
//     UNA CANTIDAD QUE EL TEXTO NO DICE, NO APARECE. Ni 1, ni deducida, ni «probablemente 2».
//
// ═════════════════════════════════════════════════════════════════════════════════════════
// 🔴 Y ESO ES UN MECANISMO, NO UNA PETICIÓN AL MODELO
//
// Se le puede pedir al modelo que no invente. Un prompt es una PETICIÓN: si el modelo se despista,
// cambia de versión o alguien edita el texto, la petición deja de cumplirse **en silencio**. Es la
// lección que ya está escrita en `sanearLineasAlbaran`: «ES EL MECANISMO, NO EL PROMPT».
//
// El mecanismo aquí es comprobable sin red y sin modelo: **la cantidad propuesta tiene que APARECER
// EN EL TEXTO DICTADO**, en cifra o en palabra. Si el técnico no dijo un número, no hay número que
// encontrar, y da igual lo que devuelva el modelo. No decide una petición: decide el dictado.
//
// ⚠️ Esto NO garantiza que el número sea el correcto —«cable UTP cat 6» tiene un 6 que no es una
// cantidad—, y no pretende garantizarlo: **lo extraído se PROPONE y el técnico confirma**. Lo que
// sí garantiza es que no salga de la nada, que es donde nacen las facturas mal puestas.
//
// ⛔ AQUÍ NO SE TOCAN IMPORTES. El técnico no los conoce y no le corresponden: en el parte real
// firmado la columna IMPORTE va vacía. Este fichero no lee ni escribe `precioUnitario` ni `tipoIva`.
import type { BloqueParte, LineaParte } from './parteTrabajo';

/**
 * Una línea propuesta por el dictado.
 *
 * `unds` es OPCIONAL y ésa es la mitad del fichero: ausente significa «el técnico no lo dijo», y
 * es distinto de cero. No se rellena jamás.
 *
 * ⚠️ La línea NO lleva su bloque: **el bloque es la lista en la que está**. Es la misma decisión
 * que `parteTrabajo.ts` ya tomó para los dos bloques del papel («no son una etiqueta de la línea:
 * son su sitio»), y mantenerla evita que una línea pueda decir que es de un bloque y estar en otro.
 */
export interface LineaPropuesta {
  descripcion: string;
  unds?: number;
}

/** Una cantidad que el modelo propuso y el dictado NO respalda. No se aplica; se enseña. */
export interface CantidadRetirada {
  descripcion: string;
  /** Lo que el modelo dijo. Se conserva para poder explicar por qué no está. */
  propuesta: number;
}

/**
 * El resultado del dictado: las DOS listas del papel, y lo que no se pudo colocar.
 *
 * `sinBloque` existe para que **nada desaparezca en silencio**: si el modelo devuelve un bloque que
 * no es ninguno de los dos cerrados, la línea no se tira —el técnico hizo ese trabajo— pero tampoco
 * se adivina su sitio. Se propone aparte para que él la coloque.
 */
export interface PropuestaDelDictado {
  mano_obra: LineaPropuesta[];
  materiales: LineaPropuesta[];
  sinBloque: LineaPropuesta[];
  cantidadesRetiradas: CantidadRetirada[];
  /** Sin ni una línea. El parte se queda EN BLANCO y quien pinte esto tiene que DECIRLO. */
  vacia: boolean;
  /** Código, no texto de pantalla. La frase visible, APROBADA, está en `AVISOS_DEL_DICTADO`. */
  motivo: 'dictado_vacio' | 'sin_lineas_reconocidas' | null;
}

/**
 * ✅ MICROCOPY APROBADA por el fundador el 2-sep-2026 (regla 30). LITERAL: raya larga `—` de un
 * solo carácter, sin corchete de marcador.
 *
 * Está aquí, junto al código que la produce, para que la pantalla la COPIE de un sitio en vez de
 * volver a escribirla. Un texto aprobado que se reteclea en cada pantalla deja de ser el aprobado
 * sin que nadie lo decida — es el defecto que persigue `docs/MICROCOPY_APROBADA_SIN_APLICAR.md`.
 *
 * ⚠️ Las dos suenan parecidas y NO lo son, y por eso terminan en acciones distintas: en la primera
 * el dictado no se entendió y **volver a dictar puede funcionar**; en la segunda se entendió y aun
 * así no salió ninguna línea, así que repetir no arregla nada y la salida es escribirlas.
 *
 * 🔴 FALTA LA TERCERA, la de `cantidadesRetiradas`, y falta A PROPÓSITO: ver la nota de abajo.
 */
export const AVISOS_DEL_DICTADO: Record<'dictado_vacio' | 'sin_lineas_reconocidas', string> = {
  dictado_vacio: 'No se ha entendido el dictado — vuelve a dictar o escríbelo a mano',
  sin_lineas_reconocidas: 'No se ha podido sacar ninguna línea — escríbelas tú',
};

// 🔴 `cantidadesRetiradas` NO TIENE TEXTO APLICADO, y no es un olvido.
//
// El fundador aprobó «Faltan las cantidades — ponlas tú» en PLURAL, dando por hecho que el aviso es
// un resumen, y pidió parar si se pinta por línea. Medido: `cantidadesRetiradas` es un array con
// UNA ENTRADA POR LÍNEA, cada una con su `descripcion`, y **puede traer exactamente una**
// (comprobado ejecutándolo). Con una sola línea, el plural no concuerda ni siquiera como resumen.
//
// No se elige por él ni se inventa un singular: la concordancia es suya, no del que cablea. Queda
// declarado en `docs/MICROCOPY_APROBADA_SIN_APLICAR.md` como aprobado y NO aplicado, con el motivo.

// ─────────────────────────────────────────────────────────────────────────────────────────
// ① ¿EL TEXTO DICE ESA CANTIDAD?
// ─────────────────────────────────────────────────────────────────────────────────────────

/**
 * Los números en palabra que un técnico dice en obra. Cerrado a propósito: una lista abierta
 * («parsear cualquier numeral») acaba aceptando «un» de «un momento» como la cantidad 1.
 *
 * `medio`/`media` valen 0,5 porque «media hora» es normal en mano de obra y `unds` admite fracción.
 */
const NUMEROS_EN_PALABRA: Record<string, number> = {
  medio: 0.5, media: 0.5,
  dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9, diez: 10,
  once: 11, doce: 12, trece: 13, catorce: 14, quince: 15, dieciseis: 16, diecisiete: 17,
  dieciocho: 18, diecinueve: 19, veinte: 20, treinta: 30, cuarenta: 40, cincuenta: 50,
  sesenta: 60, setenta: 70, ochenta: 80, noventa: 90, cien: 100, ciento: 100,
};

// ⚠️ `uno`/`una` NO están en la tabla, y es deliberado: son las palabras más frecuentes del
// castellano hablado («una cámara», pero también «una vez», «uno de los puntos»). Aceptarlas
// reintroduciría por la puerta de atrás justo el 1 que este fichero existe para impedir. Un «1»
// EN CIFRA sí se acepta: nadie dicta «uno» en cifra por casualidad.

/** El texto, sin tildes y en minúsculas, para comparar palabras como se pronuncian. */
function normalizar(texto: string): string {
  return String(texto ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}

/**
 * 🔴 EL CONTROL QUE DECIDE EL TICKET: la cantidad sólo sobrevive si el dictado la contiene.
 *
 * Devuelve `undefined` —ausente, no cero— cuando el número no es utilizable o cuando el texto no
 * lo respalda. Cero y negativo son la misma clase de basura de dictado y reciben la misma
 * respuesta que lo inventado: no hay cantidad.
 */
export function cantidadRespaldadaPorElTexto(bruto: unknown, dictado: string): number | undefined {
  const n = Number(bruto);
  if (!Number.isFinite(n) || n <= 0) return undefined;

  const texto = normalizar(dictado);
  if (texto.trim() === '') return undefined;

  // (a) En cifra. Se acepta la coma o el punto decimal, como se escribe en España.
  //     Se exige que no esté pegado a otro dígito: en «cat 6» el 6 vale, pero un 2 no se saca
  //     de «2026». `\b` no sirve con decimales, así que se acota a mano.
  const enCifra = new RegExp(
    `(?<![\\d.,])${String(n).replace('.', '[.,]').replace(/[.*+?^${}()|[\\]\\\\]/g, (m) => (m === '[.,]' ? m : `\\${m}`))}(?![\\d.,])`,
  );
  try {
    if (enCifra.test(texto)) return n;
  } catch {
    // Un número que no produce una expresión válida no se da por bueno: se cae al lado seguro.
  }

  // (b) En palabra, y sólo palabra COMPLETA: «seis» no se encuentra dentro de «seiscientos».
  for (const [palabra, valor] of Object.entries(NUMEROS_EN_PALABRA)) {
    if (valor !== n) continue;
    if (new RegExp(`(?<![a-z])${palabra}(?![a-z])`).test(texto)) return n;
  }

  return undefined;
}

// ─────────────────────────────────────────────────────────────────────────────────────────
// ② EL SANEADO
// ─────────────────────────────────────────────────────────────────────────────────────────

const BLOQUES: Record<string, BloqueParte> = {
  mano_obra: 'mano_obra', manoobra: 'mano_obra', mano: 'mano_obra', obra: 'mano_obra',
  trabajo: 'mano_obra', horas: 'mano_obra',
  materiales: 'materiales', material: 'materiales', piezas: 'materiales', pieza: 'materiales',
};

/** El bloque que dijo el modelo, o `null` si no es ninguno de los dos cerrados. No se adivina. */
function bloqueLegible(bruto: unknown): BloqueParte | null {
  const clave = normalizar(String(bruto ?? '')).replace(/[\s.-]/g, '');
  return BLOQUES[clave] ?? BLOQUES[clave.replace(/_/g, '')] ?? null;
}

/**
 * Convierte lo que devolvió el modelo en las dos listas propuestas.
 *
 * Recibe el `dictado` ORIGINAL porque sin él no se puede comprobar nada: es contra ese texto contra
 * el que se valida cada cantidad. Una versión que sólo mirase la respuesta del modelo estaría
 * confiando en el prompt, que es exactamente lo que este fichero no hace.
 */
export function sanearDictadoDelParte(crudo: unknown, dictado: string): PropuestaDelDictado {
  const vacio: PropuestaDelDictado = {
    mano_obra: [], materiales: [], sinBloque: [], cantidadesRetiradas: [],
    vacia: true, motivo: 'dictado_vacio',
  };

  if (String(dictado ?? '').trim() === '') return vacio;
  if (!Array.isArray(crudo)) return { ...vacio, motivo: 'sin_lineas_reconocidas' };

  const salida: PropuestaDelDictado = {
    mano_obra: [], materiales: [], sinBloque: [], cantidadesRetiradas: [],
    vacia: false, motivo: null,
  };

  for (const bruto of crudo as any[]) {
    const l = bruto as any;
    const descripcion = String(l?.descripcion ?? l?.concepto ?? l?.concept ?? '').trim();
    if (!descripcion) continue; // una línea sin descripción no dice qué se hizo

    const propuestaCruda = Number(l?.unds ?? l?.cantidad ?? l?.qty);
    const unds = cantidadRespaldadaPorElTexto(l?.unds ?? l?.cantidad ?? l?.qty, dictado);

    // Si el modelo propuso una cantidad utilizable y el texto NO la respalda, se retira — y se
    // dice cuál era. Retirarla en silencio dejaría al técnico sin saber que hubo un número.
    if (unds === undefined && Number.isFinite(propuestaCruda) && propuestaCruda > 0) {
      salida.cantidadesRetiradas.push({ descripcion, propuesta: propuestaCruda });
    }

    const linea: LineaPropuesta = unds === undefined ? { descripcion } : { descripcion, unds };
    const bloque = bloqueLegible(l?.bloque);
    if (bloque === 'mano_obra') salida.mano_obra.push(linea);
    else if (bloque === 'materiales') salida.materiales.push(linea);
    else salida.sinBloque.push(linea);
  }

  const cuantas = salida.mano_obra.length + salida.materiales.length + salida.sinBloque.length;
  if (cuantas === 0) return { ...salida, vacia: true, motivo: 'sin_lineas_reconocidas' };
  return salida;
}

// ─────────────────────────────────────────────────────────────────────────────────────────
// ③ LA PUERTA: NADA PASA AL PARTE SIN QUE EL TÉCNICO LO CONFIRME
// ─────────────────────────────────────────────────────────────────────────────────────────

/**
 * 🔴 Una propuesta NO es una línea del parte, y esta función es el único paso entre las dos.
 *
 * Exige la cantidad CONFIRMADA por el técnico y **lanza** si no la hay, nombrando la línea. No es
 * una comprobación de más: sin ella, una `LineaPropuesta` sin `unds` se colaría como `LineaParte`
 * con `unds` a `undefined`, y lo que se firma acabaría llevando una cantidad que nadie puso.
 *
 * Lanza en vez de devolver un resultado ignorable por lo mismo que `contenidoCanonicoParte` lanza
 * ante una versión desconocida: lo que no se puede decidir bien no se decide a medias.
 */
export function aLineaDelParte(
  bloque: BloqueParte,
  propuesta: LineaPropuesta,
  undsConfirmadas: unknown,
): LineaParte {
  const n = Number(undsConfirmadas);
  if (!Number.isFinite(n) || n <= 0) {
    throw new Error(
      `parteDictado: «${propuesta.descripcion}» no lleva cantidad confirmada por el técnico. ` +
      'Lo que propone el dictado se PROPONE: una cantidad que nadie ha confirmado no entra en un ' +
      'parte que se firma y se factura.',
    );
  }
  return { bloque, unds: n, descripcion: propuesta.descripcion };
}

// ─────────────────────────────────────────────────────────────────────────────────────────
// ④ LA INSTRUCCIÓN PARA EL MODELO — PROPUESTA, PENDIENTE DEL FUNDADOR (regla 30)
// ─────────────────────────────────────────────────────────────────────────────────────────

/**
 * ✅ APROBADO por el fundador el 2-sep-2026 (regla 30), con la línea de «no completes marcas».
 *
 * 🔴 Y nada del mecanismo depende de estas palabras: si este prompt desapareciera o el modelo lo
 * ignorase, `sanearDictadoDelParte` seguiría retirando toda cantidad que el dictado no respalde.
 * Por eso se pide «null» y no «1»: es coherente con el mecanismo, no su sustituto.
 *
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * 🔴 LAS DOS MITADES NO ESTÁN PROTEGIDAS IGUAL, Y HAY QUE SABERLO ANTES DE LEER ESTE PROMPT
 *
 * Este texto prohíbe inventar trabajos y prohíbe inventar cantidades. Lo que NO prohibía —y por eso
 * se le añade una línea— es **COMPLETAR**: el técnico dice «dos cámaras» y el modelo devuelve «dos
 * cámaras minidomo Uniview», porque en un dictado de obra esas marcas aparecen. No es inventar de
 * cero, es **ENRIQUECER**, y acaba igual en una factura a un instituto público.
 *
 *     LA CANTIDAD    está protegida por MECANISMO: tiene que aparecer en el texto dictado
 *                    (`cantidadRespaldadaPorElTexto`), y da igual lo que devuelva el modelo.
 *
 *     LA DESCRIPCIÓN NO puede estarlo, y no es un descuido: **reformular es justo lo que se le
 *                    pide al modelo**. Un mecanismo que exigiera que cada palabra apareciera en el
 *                    dictado prohibiría lo que el modelo viene a hacer. Lo que la protege es que
 *                    **EL TÉCNICO CONFIRMA**, y nada más.
 *
 * ⚠️ Por eso la línea nueva de aquí abajo **es un consejo, no un mecanismo**. Una regla escrita
 * dentro de un prompt se cumple mientras el modelo quiera: no la lea nadie como una garantía.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */
export const PROMPT_PARTE_APROBADO = `Eres un asistente para técnicos de instalaciones y \
mantenimiento en España. Recibes lo que el técnico ha DICTADO en obra con el teclado de su móvil.

Tu tarea: ordenar ese texto en las líneas de un PARTE DE TRABAJO, en DOS bloques separados.

Reglas:
- bloque: "mano_obra" (lo que se hizo: horas, desplazamientos, trabajo) o "materiales" (lo que se
  puso: aparatos, cable, piezas). Si no lo tienes claro, omite el campo; NO lo adivines.
- descripcion: lo que se hizo o se puso, específico y en su orden.
- unds: SOLO si el técnico la dice. Si no la dice, devuelve null. NUNCA pongas 1 por defecto.
- NUNCA añadas trabajos que no se hayan mencionado.
- NUNCA completes marcas, modelos ni referencias que el técnico no haya dicho. Si dijo «cámara», es «cámara».
- NO devuelvas precios ni IVA. El técnico no los conoce y no le corresponden.

El texto viene de voz: puede llegar sin puntuación, con muletillas (eh, mira, apúntame, o sea) y
con marcas mal escritas. Ignora las muletillas: NUNCA las conviertas en descripciones.

Formato — SOLO el JSON array, sin texto alrededor:
[{"bloque":"mano_obra|materiales","descripcion":"string","unds":number|null}]`;
