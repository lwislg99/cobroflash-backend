// SCRUM-1610b · ¿LLEGÓ ENTERA LA SALIDA DEL HIJO? Un corte no es un rojo del test: es CIEGO.
//
// POR QUÉ. El 26-oct-2026 el obligatorio dio tres rojos falsos en ramas de solo docs (`scrum765` y
// `scrum1516c` ×2, SCRUM-1610 c.20951): el hijo acabó su trabajo con el código correcto y la COLA de su
// salida no llegó al padre. El test leyó media salida y cayó acusando al árbol. Un corte se lee igual que
// un defecto: la única forma de separarlos es el CENTINELA que el hijo ya imprime al final (`EXIT=N` en el
// censo de frontera, «MODO CENSO: NO se ha ejecutado ninguna mutación.» en el meta-guard).
//
// QUÉ HACE. Lanza el hijo; si terminó (sin error y con código) pero falta el centinela, lo relanza UNA vez.
// Si vuelve a faltar, `cortada` sale cierta y el test cae con `avisoDeCorte`, que empieza por
// «CIEGO · salida cortada». Cada corte queda en `cortes` (intento, bytes y líneas que llegaron) y el lector
// lo imprime: un relanzamiento que esconde el corte sería otra forma de no mirar.
// ⛔ No relaja nada: un corte doble sigue siendo un fallo, con su nombre verdadero; y una salida que NO se
// cortó se juzga entera, con las mismas aserciones de antes.
// Un hijo que no arrancó o no acabó (`error`, código null) NO es un corte: se devuelve tal cual, sin relanzar.

/** Bytes y líneas de lo que llegó: lo que se imprime de cada corte. */
export function medida(salida) {
  const s = String(salida ?? '');
  return { bytes: Buffer.byteLength(s), lineas: s.split('\n').length - (s.endsWith('\n') ? 1 : 0) };
}

/** ¿El hijo acabó y aun así falta su centinela? `entera(salida, r)` dice si llegó entera. */
export function cortada(r, entera) {
  if (r.error || r.codigo === null || r.codigo === undefined) return false;
  return !entera(r.salida, r);
}

/**
 * Lanza con `lanzar()` (devuelve o promete { codigo, salida, error? }) y relanza UNA vez si llegó cortada.
 * Devuelve el último resultado con `cortes` (uno por intento cortado) y `cortada` (si el último también).
 */
export async function sinCortar(lanzar, entera) {
  const cortes = [];
  let r = await lanzar();
  if (cortada(r, entera)) {
    cortes.push({ intento: 1, ...medida(r.salida) });
    r = await lanzar();
    if (cortada(r, entera)) cortes.push({ intento: 2, ...medida(r.salida) });
  }
  return { ...r, cortes, cortada: cortes.length === 2 };
}

/** La versión síncrona, para lectores con `execFileSync`. */
export function sinCortarSync(lanzar, entera) {
  const cortes = [];
  let r = lanzar();
  if (cortada(r, entera)) {
    cortes.push({ intento: 1, ...medida(r.salida) });
    r = lanzar();
    if (cortada(r, entera)) cortes.push({ intento: 2, ...medida(r.salida) });
  }
  return { ...r, cortes, cortada: cortes.length === 2 };
}

/** La línea de rastro: vacía si no hubo corte. */
export function rastroDeCortes(cortes) {
  if (!cortes.length) return '';
  return ' · cortes ' + cortes.length + ': ' + cortes.map((c) => `intento ${c.intento} (${c.bytes} B / ${c.lineas} líneas)`).join(', ')
    + (cortes.length === 1 ? ' → el relanzamiento llegó entero' : '');
}

/** El mensaje con el que cae un corte doble. Empieza SIEMPRE por «CIEGO · salida cortada». */
export function avisoDeCorte(quien, centinela, r) {
  const ult = r.cortes[r.cortes.length - 1] || medida(r.salida);
  return `CIEGO · salida cortada: ${quien} llegó dos veces sin su centinela final (${centinela}); `
    + `la última, ${ult.bytes} B / ${ult.lineas} líneas, código ${r.codigo}. NO es un defecto del árbol ni un verde: `
    + 'el hijo acabó y la cola de su salida no llegó (SCRUM-1610). Relanza el job; si se repite en el mismo blob, mídelo.'
    + rastroDeCortes(r.cortes);
}
