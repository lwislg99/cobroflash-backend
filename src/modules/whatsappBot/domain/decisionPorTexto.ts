// src/modules/whatsappBot/domain/decisionPorTexto.ts
// SCRUM-1322 · QUÉ ENTIENDE EL BOT cuando el cliente contesta por escrito a un presupuesto.
// Módulo PURO (sin prisma, sin envíos): sale de `whatsappIncoming.routes.ts` para poder probarlo
// con la función de verdad y no con una copia de su expresión.
//
// LO QUE HABÍA, medido el 1-oct-2026: una expresión que buscaba la palabra EN CUALQUIER PARTE del
// mensaje y que cerraba con `\b` detrás de la raíz. Tres defectos, del mismo sitio:
//   · «Acepto» —la palabra que el propio bot pide escribir— no casaba: sólo casaba `acept` suelta.
//   · «sí» con tilde tampoco: sin modo unicode, `\b` no ve frontera detrás de «í».
//   · y lo peor: «no sé» RECHAZABA el presupuesto y «¿va con IVA?» lo ACEPTABA, porque `no` y `va`
//     aparecían dentro del mensaje.
//
// LA REGLA DE AHORA: sólo decide el mensaje que ENTERO es una decisión. Se parte en palabras, y
// cada una tiene que ser de aceptar, de rechazar, o de la lista BLANCA de cortesía. Una sola
// palabra que no esté en ninguna de las tres → `unknown`. Acepta Y rechaza a la vez → `unknown`.
// Lleva un signo de pregunta → `unknown`. Se falla hacia «no he entendido», que no mueve el
// presupuesto, y nunca hacia una decisión que el cliente no ha tomado.
//
// ⚠️ Las listas son CERRADAS y `tests/scrum1322-el-bot-entiende-lo-que-pide.test.mjs` las
// enumera enteras (las lee de este fuente, no se exportan): añadir una entrada es cambiar el test
// a propósito. Van ya normalizadas (minúsculas, sin tildes), que es como se compara.
//
// SCRUM-1326: hay una cuarta respuesta, `ask`. Ocho palabras que aceptaban —las de `PREGUNTA`—
// pueden ser sólo «recibido», y aceptar crea el Trabajo y avisa al profesional. Sueltas ya no
// aceptan: quien llama pregunta al cliente, y el presupuesto no se mueve.

import { sinTildes } from '../../../core/texto/sinTildes';

export type Decision = 'accept' | 'reject' | 'ask' | 'unknown';

/** Lo que acepta. Una entrada de varias palabras sólo casa con esas palabras seguidas. */
const ACEPTA: readonly string[] = [
  // la que el bot pide, y sus formas
  'acepto', 'aceptar', 'aceptado', 'aceptamos', 'lo acepto', 'acepto el presupuesto',
  'si', 'claro que si',
  'confirmo', 'confirmar', 'confirmado', 'confirmamos', 'lo confirmo',
  // lo que ya se entendía suelto antes de SCRUM-1322 (las raíces, tal cual, incluidas)
  'acept', 'confirm', 'dale', 'adelante', 'de acuerdo',
  'me interesa', 'quiero', 'lo quiero', 'sale',
];

/**
 * 🔴 SCRUM-1326 · Las que NO aceptan solas: el bot pregunta. Son las ocho que firmó el fundador
 * (comentarios 17692 y 17802), ni una más: `tests/scrum1326-vale-pregunta-una-vez.test.mjs` las
 * enumera. El criterio firmado: un acuse de recibo pregunta; una autorización o un deseo, acepta.
 * `okay` y `okey` van con `ok`; `va` es «vale» abreviado. `sale` ACEPTA: lo decidió el fundador.
 * Junto a una entrada de `ACEPTA` («sí, vale») no añaden un paso; junto a una de `RECHAZA`, el
 * mensaje no decide nada, igual que antes.
 */
const PREGUNTA: readonly string[] = ['vale', 'ok', 'okay', 'okey', 'perfecto', 'listo', 'claro', 'va'];

/** Lo que rechaza. Las que niegan una palabra de aceptar («no acepto») van aquí ENTERAS. */
const RECHAZA: readonly string[] = [
  'no',
  'rechazo', 'rechazar', 'rechazado', 'rechazamos', 'lo rechazo', 'rechazo el presupuesto',
  'cancelo', 'cancelar', 'cancelado', 'cancelamos',
  'no acepto', 'no lo acepto', 'no me interesa', 'no quiero', 'no lo quiero', 'claro que no',
  // lo que ya se entendía suelto antes de este ticket
  'rechaz', 'cancel', 'paso', 'mejor no', 'negativo', 'nel',
];

/**
 * 🔴 LISTA BLANCA de cortesía: lo ÚNICO que puede acompañar a una decisión sin estropearla. Sola no
 * decide nada. Cada entrada con su motivo, porque cada una ensancha lo que cuenta como decisión:
 * si aquí cabe cualquier palabra «inofensiva», vuelve el «busca en cualquier parte del mensaje».
 */
const CORTESIA: Readonly<Record<string, string>> = {
  'gracias': 'es como se cierra una respuesta: «vale, gracias», «no, gracias»',
  'muchas gracias': 'la misma, entera: «muchas» suelta no entra',
  'hola': 'el saludo delante de la decisión: «hola, acepto»',
  'por favor': '«sí, por favor»; ni «por» ni «favor» entran sueltas',
};

type Clase = 'accept' | 'reject' | 'ask' | 'cortesia';

const CLASE_DE = new Map<string, Clase>([
  ...ACEPTA.map((e): [string, Clase] => [e, 'accept']),
  ...PREGUNTA.map((e): [string, Clase] => [e, 'ask']),
  ...RECHAZA.map((e): [string, Clase] => [e, 'reject']),
  ...Object.keys(CORTESIA).map((e): [string, Clase] => [e, 'cortesia']),
]);
const PALABRAS_DE_LA_MAS_LARGA = Math.max(...[...CLASE_DE.keys()].map((e) => e.split(' ').length));

/**
 * El mensaje, en TRAMOS de palabras. Un signo de puntuación parte el tramo, y una entrada de varias
 * palabras no cruza de un tramo a otro: «no, acepto» son dos cosas y «no acepto» es una.
 * Los asteriscos de la negrita y los emojis no son palabras ni parten nada.
 */
function tramos(texto: string): string[][] {
  return sinTildes(texto)
    .split(/[,.;:!¡()\n]+/)
    .map((tramo) => tramo.match(/[\p{L}\p{N}]+/gu) ?? [])
    .filter((palabras) => palabras.length > 0);
}

export function parseDecision(text: string): Decision {
  // Quien pregunta no está decidiendo: «¿vale?», «acepto?».
  if (/[?¿]/.test(text)) return 'unknown';

  let acepta = false;
  let rechaza = false;
  let pregunta = false;
  for (const palabras of tramos(text)) {
    let i = 0;
    while (i < palabras.length) {
      // La entrada MÁS LARGA que empiece aquí: «no me interesa» antes que «no» + «me interesa».
      let clase: Clase | undefined;
      let largo = Math.min(PALABRAS_DE_LA_MAS_LARGA, palabras.length - i);
      for (; largo >= 1; largo--) {
        clase = CLASE_DE.get(palabras.slice(i, i + largo).join(' '));
        if (clase) break;
      }
      if (!clase) return 'unknown'; // una palabra que no es de ninguna lista: no es una decisión
      if (clase === 'accept') acepta = true;
      if (clase === 'reject') rechaza = true;
      if (clase === 'ask') pregunta = true;
      i += largo;
    }
  }
  if ((acepta || pregunta) === rechaza) return 'unknown'; // ni una ni otra, o las dos
  if (rechaza) return 'reject';
  return acepta ? 'accept' : 'ask'; // sin una aceptación clara al lado, «vale» no acepta: se pregunta
}
