// scripts/_hallazgos-y-ciegos.mjs — SCRUM-1320
//
// EL VEREDICTO DE UN GUARD QUE PUEDE ENCONTRAR Y QUEDARSE CIEGO A LA VEZ.
//
// ── LO QUE PASABA, medido y no razonado ──────────────────────────────────────────────────────
// Corriendo el control de SCRUM-1313 que rompe el editor a mano para ver caer los guards,
// `guard-915g-ajustes-del-justificante.mjs` imprimió esto y salió con el código del ciego:
//
//     🔴 HALLAZGOS 5: …
//     ⬜ NO SUPE MEDIR 1: …
//     EXIT=2
//
// Cinco defectos reales, y el código de «no supe medir». La puerta (`guards-visuales.mjs`) sólo
// ve ese número: lo contó entre los CIEGOS, y un ciego se atribuye al arnés y se aparca.
//
// La causa no es un despiste de ese guard. Es la cola de la FAMILIA: «si hay ciegos salgo con 2;
// y si no, miro los hallazgos». Eso trata dos estados como EXCLUYENTES, y no lo son: un guard
// juzga varios casos, y puede quedarse ciego en uno habiendo encontrado defectos en los demás.
//
// ── POR QUÉ NO BASTA CON DARLE LA VUELTA AL ORDEN ───────────────────────────────────────────
// «Si hay hallazgos salgo con 1; y si no, miro los ciegos» es el mismo defecto cambiado de
// sitio: ahora es el ciego el que desaparece, y un «5 hallazgos» se lee como la lista completa
// cuando hay un caso del que no se ha juzgado nada. Por eso aquí no hay orden que elegir:
//
//   · el CÓDIGO lo da el hallazgo, que es el que obliga a mirar y el que no se arregla relanzando;
//   · la LÍNEA dice SIEMPRE las dos cuentas, también cuando alguna es cero.
//
// No era la primera vez: SCRUM-904 lo arregló en UN guard (`guard-completar-lleva-al-campo.mjs`)
// con la regla escrita encima, y los demás siguieron igual porque la regla vivía en ese fichero.
// Aquí vive en un sitio del que se importa, y `tests/scrum1320-…` censa quién decide por su cuenta.

export const SALIDA_VERDE = 0;
export const SALIDA_HALLAZGO = 1;
export const SALIDA_NO_SUPE_MEDIR = 2;

/** La marca de la línea del veredicto: es lo que la puerta lee para decir las dos cuentas en su tabla. */
export const MARCA_VEREDICTO = '⟦veredicto⟧';

function cuenta(valor, nombre) {
  const n = Array.isArray(valor) ? valor.length : (valor === true ? 1 : (valor === false ? 0 : valor));
  if (!Number.isInteger(n) || n < 0) {
    // Un recuento que no es un número no es un cero: `undefined > 0` es `false`, y ese `false`
    // se leería como «ningún hallazgo».
    throw new TypeError(`veredictoDe: «${nombre}» no es un recuento (${String(valor)}). Un veredicto sobre algo que no se ha contado no es un verde.`);
  }
  return n;
}

/**
 * El veredicto de un guard a partir de sus DOS cuentas. PURA: ni imprime ni sale.
 *
 *   hallazgos > 0 ............ 1, haya ciegos o no. Y si los hay, se DICE que la lista no es completa.
 *   0 hallazgos y ciegos > 0 .. 2. Es el único caso en que un «0 hallazgos» podría estar mintiendo.
 *   0 y 0 .................... 0.
 *
 * Cada cuenta admite un número, una lista (cuenta su largo) o un booleano (los guards que sólo
 * apuntan «hubo un ciego»).
 */
export function veredictoDe({ hallazgos, ciegos }) {
  const h = cuenta(hallazgos, 'hallazgos');
  const c = cuenta(ciegos, 'ciegos');
  const cuentas = h + (h === 1 ? ' hallazgo' : ' hallazgos') + ' · ' + c + (c === 1 ? ' ciego' : ' ciegos');
  if (h > 0) {
    return {
      codigo: SALIDA_HALLAZGO, estado: c > 0 ? 'HALLAZGO Y CIEGO' : 'HALLAZGO', hallazgos: h, ciegos: c,
      linea: MARCA_VEREDICTO + ' ' + cuentas + ' → salida ' + SALIDA_HALLAZGO + ' (hallazgo)'
        + (c > 0 ? ' · ⚠️ lo que no se pudo medir sigue sin juzgar: ésta NO es la lista completa de defectos' : ''),
    };
  }
  if (c > 0) {
    return {
      codigo: SALIDA_NO_SUPE_MEDIR, estado: 'CIEGO', hallazgos: h, ciegos: c,
      linea: MARCA_VEREDICTO + ' ' + cuentas + ' → salida ' + SALIDA_NO_SUPE_MEDIR + ' (no supe medir) · un ciego no es un verde',
    };
  }
  return { codigo: SALIDA_VERDE, estado: 'VERDE', hallazgos: h, ciegos: c, linea: MARCA_VEREDICTO + ' ' + cuentas };
}

/**
 * Lo que la puerta lee de la salida de un guard: sus dos cuentas, o `null` si no las dijo.
 * La ÚLTIMA marca manda, como en `leerArranque` (SCRUM-673): el desenlace es lo último emitido.
 */
export function leerVeredicto(salida) {
  const lineas = String(salida || '').split(String.fromCharCode(10)).filter((l) => l.includes(MARCA_VEREDICTO));
  if (!lineas.length) return null;
  const m = lineas[lineas.length - 1].match(/(\d+) hallazgos? · (\d+) ciegos?/);
  return m ? { hallazgos: Number(m[1]), ciegos: Number(m[2]) } : null;
}

// ═════════════════════════════════════════════════════════════════════════════════════════════
// SCRUM-1327 · EL RECORRIDO: UN CASO CIEGO NO CORTA LOS DEMÁS.
//
// `veredictoDe` decide bien con las dos cuentas… si le llegan enteras. Tres guards no se las daban:
// al primer caso que no sabían medir SALÍAN (`noSupeMirar()` → `process.exit(2)`, o un `break`), y
// los casos de después no se medían. No era un hallazgo mal rotulado: era un hallazgo que no llegaba
// a existir. Visto ocurrir, con el navegador de verdad (docs/master/SCRUM-1327.md): un caso ciego a
// 929 px y, detrás, un rótulo que no cabe a 390 px → salida 2 y ni una palabra del que no cabe.
//
// Por eso el bucle vive AQUÍ y no en cada guard: quien lo escribe a mano elige cuándo dejar de mirar.
// ═════════════════════════════════════════════════════════════════════════════════════════════

function listaDe(valor, nombre, caso) {
  if (!Array.isArray(valor)) {
    // Un caso que no dice sus cuentas no es un caso limpio (misma regla que `cuenta`, arriba).
    throw new TypeError(`recorrerCasos: el caso «${caso}» no devolvió la lista «${nombre}» (${String(valor)}). Un caso sin cuentas no es un verde.`);
  }
  return valor;
}

// ═════════════════════════════════════════════════════════════════════════════════════════════
// SCRUM-1392 · LO QUE UN CASO YA HABÍA VISTO NO CADUCA PORQUE EL CASO REVIENTE DESPUÉS.
//
// El recorrido sumaba lo que cada caso DEVOLVÍA. Un caso que apuntaba un hallazgo en una lista suya
// y después lanzaba no llegaba a devolverla: salía 2 («no supe medir») con el defecto ya visto.
// Visto ocurrir con el navegador de verdad en `guard-duplicar-926` (docs/master/SCRUM-1392.md): un
// error de página y, detrás, una lectura que lanza → «0 hallazgos · 4 ciegos» y del error ni una palabra.
//
// Por eso las dos listas del caso las pone AQUÍ el recorrido y se las entrega: lo que el caso apunta
// en ellas ya está fuera de él cuando lanza. Lanzar con las manos vacías sigue siendo un ciego y
// nada más: eso sí es no haber podido medir.
// ═════════════════════════════════════════════════════════════════════════════════════════════

/** La marca de la línea del recorrido. Sale SIEMPRE, también con ceros: su ausencia no puede significar «ninguno». */
export const MARCA_RECORRIDO = '⟦recorrido⟧';

/**
 * Recorre TODOS los casos y junta sus dos cuentas. `juzgarCaso(caso, suyas)` devuelve
 * `{ hallazgos, ciegos }` (dos listas) de ESE caso; puede ser asíncrona. `suyas` son las dos listas
 * de ese caso, puestas por el recorrido: lo que se apunta en ellas se conserva aunque el caso lance.
 *
 *   · un caso ciego NO corta el recorrido: los de después se miden igual;
 *   · un caso que LANZA es un caso que no se pudo medir: se apunta como ciego, con su motivo, y se
 *     sigue — y lo que ya había apuntado en `suyas` cuenta igual;
 *   · cero casos es un ciego, no un verde: «0 hallazgos» sobre nada no es una medición.
 *
 * Lo que devuelve se le pasa tal cual a `veredictoDe`. `decir` recibe la línea del recorrido.
 */
export async function recorrerCasos(casos, juzgarCaso, nombrar = (caso) => String(caso), decir = (linea) => console.log(linea)) {
  const hallazgos = [];
  const ciegos = [];
  let recorridos = 0;
  let lanzaron = 0;
  let lanzaronConHallazgos = 0;
  for (const caso of casos) {
    recorridos += 1;
    const nombre = nombrar(caso);
    const suyas = { hallazgos: [], ciegos: [] };
    let suyo;
    try {
      suyo = await juzgarCaso(caso, suyas);
    } catch (e) {
      lanzaron += 1;
      if (suyas.hallazgos.length) lanzaronConHallazgos += 1;
      hallazgos.push(...suyas.hallazgos);
      ciegos.push(...suyas.ciegos);
      ciegos.push(nombre + ': no se pudo medir — ' + String((e && e.message) || e));
      continue;
    }
    const devueltos = listaDe(suyo && suyo.hallazgos, 'hallazgos', nombre);
    const devueltosCiegos = listaDe(suyo && suyo.ciegos, 'ciegos', nombre);
    // Lo apuntado en las listas entregadas cuenta aunque el caso devuelva otras; si devuelve las
    // mismas, una sola vez.
    if (devueltos !== suyas.hallazgos) hallazgos.push(...suyas.hallazgos);
    if (devueltosCiegos !== suyas.ciegos) ciegos.push(...suyas.ciegos);
    hallazgos.push(...devueltos);
    ciegos.push(...devueltosCiegos);
  }
  if (recorridos === 0) ciegos.push('no se recorrió ni un solo caso: «0 hallazgos» sobre nada no es una medición');
  const linea = MARCA_RECORRIDO + ' ' + recorridos + (recorridos === 1 ? ' caso recorrido' : ' casos recorridos')
    + ' · ' + lanzaron + (lanzaron === 1 ? ' lanzó' : ' lanzaron')
    + ' · ' + lanzaronConHallazgos + ' de ésos ' + (lanzaronConHallazgos === 1 ? 'traía' : 'traían') + ' hallazgos';
  decir(linea);
  return { hallazgos, ciegos, recorridos, lanzaron, lanzaronConHallazgos, linea };
}
