// tests/_evidencia.mjs — SCRUM-270: reportar lo que YA se midió, en vez de tirarlo.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// LA REGLA, textual del ticket
//
//   «Un assert que ya tiene N resultados en la mano no debe morir en el primero.
//    Que falle, sí — pero después de reportar los N.»
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// POR QUÉ ESTO EXISTE, con el coste medido
//
// Dos rojos de esta semana se cerraron como irrecuperables por esta causa: la evidencia que los
// explicaba **se obtuvo dentro de la propia corrida** y no se imprimió, porque el primer assert
// mató el proceso. Y el dato tirado era justo el que decidía el diagnóstico:
//
//   · `scrum127` hace las CUATRO peticiones y las espera todas. Si falla **solo** una, la cadena
//     de middlewares queda descartada; si fallan **las cuatro**, apunta a algo compartido (sesión,
//     tenencia, la fila del merchant). La corrida tenía la respuesta y el test la tiró.
//   · `tenancy-permisos` mira «¿veo lo mío?» y «¿veo lo ajeno?» — dos diagnósticos OPUESTOS — y
//     el segundo no llega a ejecutarse si el primero cae.
//
// El coste no es el rojo: es la ronda de diagnóstico y **la tanda que hay que volver a gastar**.
// Con un turno de staging único compartido por cuatro máquinas, cada re-corrida son ~40 minutos de
// un recurso serializado. Y peor: **invita a re-correr**, que es lo que SCRUM-161 prohíbe.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// LO QUE ESTE MÓDULO **NO** ES
//
// No es un marco de aserciones. Sale de DOS casos reales y cubre lo que ellos piden; un marco
// construido antes de ver casos acaba siendo el marco de un caso imaginario. Si aparece un tercer
// patrón, se añade cuando exista — no antes.

/** Cuánto cuerpo se guarda de una respuesta. Suficiente para distinguir JSON de texto de HTML. */
export const MAX_CUERPO = 300;

/**
 * Observa una respuesta HTTP **entera**: estado Y cuerpo.
 *
 * 🔑 EL CUERPO NO ES UN EXTRA. Un `200` esperado que llega como `404` puede venir de tres sitios
 * distintos y **los cuerpos los distinguen sin discutir**: el handler responde `{"error":"..."}`
 * (JSON), `requireInternalSecret` responde `Not found` (texto plano), y Express sin ruta responde
 * HTML. Assertear solo el número deja esa pregunta abierta y obliga a otra corrida.
 *
 * BEST-EFFORT: leer el cuerpo JAMÁS puede tumbar el test con una excepción distinta de la que se
 * está diagnosticando. Si falla, se anota como tal — «no pude leerlo» es un dato, no un hueco.
 */
export async function observarRespuesta(nombre, res, { maxCuerpo = MAX_CUERPO } = {}) {
  if (!res || typeof res.status !== 'number') {
    return { nombre, status: null, cuerpo: '(sin respuesta: la petición no llegó a devolver)' };
  }
  let cuerpo;
  try {
    const txt = await res.text();
    cuerpo = txt.length > maxCuerpo ? `${txt.slice(0, maxCuerpo)}… (+${txt.length - maxCuerpo} car.)` : txt;
    if (!txt) cuerpo = '(cuerpo vacío)';
  } catch (e) {
    cuerpo = `(cuerpo ILEGIBLE: ${e?.message ?? e})`;
  }
  return { nombre, status: res.status, cuerpo };
}

/** La tabla que se imprime en el fallo: TODAS las observaciones, marcando las que fallaron. */
export function tablaDeEvidencia(observaciones, fallidas = new Set()) {
  return observaciones
    .map((o) => {
      const marca = fallidas.has(o.nombre) ? '✗' : '·';
      const estado = o.status === null ? '—' : o.status;
      const cuerpo = o.cuerpo === undefined ? '' : ` ${String(o.cuerpo).replace(/\s+/g, ' ')}`;
      return `     ${marca} ${o.nombre}: ${estado}${cuerpo}`;
    })
    .join('\n');
}

/**
 * Comprueba las N observaciones y, si alguna falla, lanza **UNA vez** con las N delante.
 *
 * `comprobar(o)` devuelve `null` si la observación está bien, o un texto con el problema. Se
 * eligió texto y no un booleano para que el fallo diga qué esperaba cada una sin repetirlo fuera.
 *
 * ⚠️ SE EVALÚAN TODAS ANTES DE FALLAR. Es todo el ticket: recorrer y `assert` dentro del bucle
 * es exactamente el defecto —el primer fallo se lleva por delante lo que ya estaba medido—, así
 * que aquí se separan las dos fases a propósito. Si `comprobar` lanza sobre una observación, ese
 * error se anota como su problema y el recorrido SIGUE: una comprobación rota no puede volver a
 * esconder las demás.
 */
export function exigirTodas(observaciones, comprobar, porque) {
  if (!Array.isArray(observaciones) || observaciones.length === 0) {
    throw new Error('SCRUM-270: exigirTodas sin observaciones — no se está comprobando nada.');
  }

  const problemas = new Map();
  for (const o of observaciones) {
    let veredicto;
    try {
      veredicto = comprobar(o);
    } catch (e) {
      veredicto = `la comprobación lanzó: ${e?.message ?? e}`;
    }
    if (veredicto) problemas.set(o.nombre, veredicto);
  }
  if (problemas.size === 0) return;

  const cuantas = `${problemas.size} de ${observaciones.length}`;
  const detalle = [...problemas].map(([n, p]) => `     ✗ ${n}: ${p}`).join('\n');
  throw new Error(
    `${porque}\n\n  FALLAN ${cuantas}:\n${detalle}\n\n` +
      `  TODO lo que esta corrida ya tenía medido:\n${tablaDeEvidencia(observaciones, new Set(problemas.keys()))}\n\n` +
      '  (SCRUM-270: se imprimen las ' + observaciones.length + ' porque «falla una» y «fallan ' +
      'todas» son diagnósticos distintos, y la diferencia decide dónde mirar.)',
  );
}
