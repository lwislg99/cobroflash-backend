// scripts/_timeouts-tanda.mjs — SCRUM-265 · los límites de tiempo por hijo de la tanda gateada,
// y la lectura del override, en piezas PURAS que un test puede importar.
//
// Viven fuera de `test-staging-gated.mjs` por la misma razón que las de SCRUM-265 punto 3
// (`_margen-tanda.mjs`): ese fichero es un SCRIPT, e importarlo desde un test lanzaría una
// tanda entera contra staging. Sin poder importarlo no hay red posible, y un número que
// gobierna cuándo se mata a un hijo no puede estar sin red.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// PUNTO 1 · POR QUÉ EL BLOQUE PESADO PASA DE 30 A 45 MINUTOS
//
// El límite de 30 min se puso cuando el bloque QA tardaba ~10 (así lo decía su comentario, y
// así seguía diciéndolo hasta hoy: «~3× de margen»). Ya no. Medido en el recibo de una tanda
// real (`.claude/evidencia-tanda.json`, 2-ago-2026):
//
//     qa   1.769.715 ms / 1.800.000 ms  =  98,3 %  ← treinta segundos de margen
//     bot     68.722 ms /   300.000 ms  =  22,9 %
//     a55     25.526 ms /   300.000 ms  =   8,5 %
//     scrum180   229 ms /   300.000 ms  =   0,1 %
//
// Los tres ligeros sobran de margen y no se tocan. El pesado NO tenía margen: tenía ruido.
// La serie de tres tandas seguidas (medida por el fundador el 2-ago) lo dice mejor que el
// porcentaje — 1.825,4 s **MURIÓ contra el límite**, 1.792,8 s, 1.769,7 s. O sea que esto ya
// no es un riesgo teórico: **la tanda ya se ha muerto por el límite**, y una muerte por tiempo
// no es un rojo, es una tanda INVÁLIDA que hay que volver a correr entera.
//
// LA ASIMETRÍA ES LO QUE DECIDE EL NÚMERO, no el porcentaje:
//   · límite corto de más → el hijo muere por reloj, la tanda entera se tira y se repite.
//     Frecuente (ya pasó) y caro (~30 min), y pasa justo cuando más prisa hay.
//   · límite largo de más → un hijo REALMENTE colgado tarda 15 min más en detectarse.
//     Raro, y el coste está acotado por arriba.
//
// Y hay una razón que antes no existía: **desde SCRUM-265 punto 3 el margen va en el recibo**.
// El único argumento para tener el límite apretado era usarlo como detector de crecimiento —
// «si un día muere, es que ha crecido». Ese detector era pésimo (avisa matando) y ahora
// sobra: el porcentaje se ve en cada tanda, así que el próximo ajuste saldrá de un número que
// sube, no de un cadáver.
//
// 45 min deja el peor caso conocido en el ~66 % y **1,5× de crecimiento** antes de volver a
// rozar el límite. Se descartó subir más: el TTL del turno se DERIVA de este número
// (`ttlParaTanda` → 55 min), y cada minuto de más es un minuto que un turno huérfano bloquea
// a las demás sesiones.
//
// ⚠️ CONSECUENCIA DECLARADA, y por eso este ticket va DESPUÉS de SCRUM-266: con HEAVY a 45 el
// TTL derivado pasa de 45 a 55 min, o sea que la ventana `TTL derivado − 45 supuestos` deja de
// ser 0 y pasa a ser **10 minutos en la configuración por defecto, sin ningún override**. Antes
// de SCRUM-266 eso habría convertido un fallo ocasional en permanente: `turno:tomar` se habría
// llevado el turno de una tanda viva de forma rutinaria. Con 266 dentro, la vigencia se decide
// por el compromiso publicado y la ventana no existe. El orden de los dos tickets no era
// preferencia: era requisito.

/** Aislados (a55, bot-suite, scrum180): suelo generoso para CI en frío. Medidos ≤23 %. */
export const LIGHT_MS = 5 * 60 * 1000;

/** Bloque QA. Ver arriba: 30 min dejaba el 1,7 % de margen y ya mató una tanda. */
export const HEAVY_MS = 45 * 60 * 1000;

/** La variable de entorno que permite forzar el límite de TODOS los hijos (tuning/pruebas). */
export const VAR_OVERRIDE = 'GATED_CHILD_TIMEOUT_MS';

/**
 * PUNTO 2 · leer el override sin que un valor ilegible se convierta en silencio.
 *
 * Antes era una línea:
 *
 *     const OVERRIDE_MS = Number(process.env.GATED_CHILD_TIMEOUT_MS) || 0;
 *
 * y el `|| 0` tapaba TODO lo que no fuera un número: `GATED_CHILD_TIMEOUT_MS=treinta`,
 * `=60_000`, `=60000ms` o un espacio de más daban `NaN`, el `||` lo convertía en 0, y 0
 * significa exactamente «no hay override». Así que quien pedía un límite distinto se llevaba
 * el de por defecto **sin un solo aviso**, y encima el efecto es invisible: la tanda corre,
 * pasa, y solo se descubre si alguien se para a leer el límite anunciado por hijo.
 *
 * Es el patrón que este repo persigue desde SCRUM-217: un fail-open. El valor no se entiende
 * y en vez de parar se sigue con otra cosa que parece razonable.
 *
 * LAS TRES RESPUESTAS, y la tercera es la que faltaba:
 *   · AUSENTE            → `{ ok: true, ms: 0 }` — no hay override, se usa el defecto. Legítimo.
 *   · PRESENTE Y LEGIBLE → `{ ok: true, ms: <n> }`.
 *   · PRESENTE E ILEGIBLE→ `{ ok: false, motivo }` — el runner ABORTA. Pediste algo y no se
 *                          entiende: seguir con el defecto es responder a una pregunta que no
 *                          se hizo.
 *
 * VACÍO CUENTA COMO ILEGIBLE, y es decisión con coste: `GATED_CHILD_TIMEOUT_MS=` en la línea
 * de comandos es un dedazo tan probable como `=treinta`, y tratarlo como «ausente» devuelve el
 * fail-open por la puerta de atrás para el caso más fácil de cometer. Cuesta un `unset` cuando
 * se hace a propósito; a cambio ningún typo se traga en silencio.
 *
 * CERO Y NEGATIVOS TAMBIÉN: un límite de 0 ms mata a todos los hijos al nacer, y uno negativo
 * no significa nada. Ninguno de los dos es lo que quería quien lo escribió.
 */
export function resolverOverride(crudo) {
  if (crudo === undefined || crudo === null) {
    return { ok: true, ms: 0, presente: false };
  }

  const texto = String(crudo).trim();
  if (texto === '') {
    return {
      ok: false,
      presente: true,
      motivo: `${VAR_OVERRIDE} está puesta pero vacía. Si no quieres override, quítala del ` +
              'entorno; una variable vacía es un dedazo, no una petición.',
    };
  }

  const n = Number(texto);
  if (!Number.isFinite(n)) {
    return {
      ok: false,
      presente: true,
      motivo: `${VAR_OVERRIDE}=${JSON.stringify(texto)} no es un número de milisegundos. ` +
              'Ojo con los sufijos y los separadores: "60000ms", "60_000" y "30min" no lo son.',
    };
  }
  if (n <= 0) {
    return {
      ok: false,
      presente: true,
      motivo: `${VAR_OVERRIDE}=${texto} no es un límite utilizable: con 0 o menos, todos los ` +
              'hijos mueren nada más nacer. Quita la variable para usar los límites por defecto.',
    };
  }

  return { ok: true, ms: n, presente: true };
}

/** El límite efectivo de un hijo, con el override ya resuelto. */
export function limiteDe(hijo, overrideMs) {
  return overrideMs || (hijo?.pesado ? HEAVY_MS : LIGHT_MS);
}
