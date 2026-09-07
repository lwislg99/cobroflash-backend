// tests/_unidades-de-microcopy.mjs — SCRUM-714
//
// ═════════════════════════════════════════════════════════════════════════════════════════
// CADA NÚMERO CON SU UNIDAD. NINGÚN INSTRUMENTO CAMBIA LO QUE CUENTA.
//
// 🔴 EL DEFECTO, Y NO ES QUE LOS NÚMEROS NO CUADREN. Varios instrumentos de esta casa cuentan
// «marcadores de microcopy» y dan cifras distintas. **Todas son correctas.** Miden poblaciones
// distintas y ninguna está mal. Lo que falta es que lo DIGAN.
//
// Medido sobre el árbol del 4-sep-2026, todo a la vez:
//
//   357  ficheros leídos            ← `scripts/censo-marcadores.mjs`
//    22  marcas ESCRITAS            ← el mismo censo (16 en constante + 6 directas)
//   162  usos de esas constantes    ← el mismo censo
//   168  superficies PINTADAS       ← el mismo censo
//    12  ficheros del panel         ← el `CENSO` de `tests/scrum402-…`
//    56  marcas de «aprobado»       ← `tests/scrum709-…`, otra población entera
//    13  citas a `docs/microcopy/`  ← el mismo 709
//
// «22» y «168» y «12» puestos uno al lado del otro parecen una contradicción y no lo son. «22
// marcas escritas», «168 superficies pintadas» y «12 ficheros del panel» son tres frases que
// nadie confunde. Ésa es toda la diferencia, y es la que este fichero existe para imponer.
//
// ⛔ PROHIBIDO usar esto para «armonizar»: si algún día un instrumento cambia lo que cuenta para
// cuadrar con otro, se habrá destruido la medición que ese instrumento daba. La respuesta a dos
// cifras distintas es leer sus dos unidades, nunca igualarlas.
//
// ── LA VÍCTIMA QUE ABRIÓ EL TICKET ──────────────────────────────────────────────────────────
// `exportView.js:328` decía «Microcopy PROPUESTA, sin aprobar» encima de un texto que el fundador
// firmó el 17-ago-2026 — y encima citaba OTRO texto, que no existe en el árbol. Quien lo pagaba
// no era el profesional: era la siguiente sesión que lo leyera y «corrigiera» un texto firmado.
// ═════════════════════════════════════════════════════════════════════════════════════════

/**
 * Las unidades en las que esta casa cuenta microcopy. Cada una con su nombre en singular y en
 * plural, y con la PREGUNTA que contesta — que es lo que de verdad la distingue de las demás.
 */
export const UNIDADES = Object.freeze({
  MARCAS_ESCRITAS: {
    singular: 'marca escrita',
    plural: 'marcas escritas',
    pregunta: '¿cuántos literales o constantes LLEVAN la marca en el código?',
  },
  SUPERFICIES_PINTADAS: {
    singular: 'superficie pintada',
    plural: 'superficies pintadas',
    pregunta: '¿cuántos sitios puede VER un profesional con un rótulo sin aprobar?',
  },
  FICHEROS_CON_MARCA: {
    singular: 'fichero con marca',
    plural: 'ficheros con marca',
    pregunta: '¿en cuántos FICHEROS queda al menos una marca?',
  },
  CITAS_A_APROBACION: {
    singular: 'cita a una aprobación',
    plural: 'citas a una aprobación',
    pregunta: '¿cuántos comentarios CITAN un registro de `docs/microcopy/`?',
  },
  MARCAS_DE_APROBADO: {
    singular: 'marca de «aprobado»',
    plural: 'marcas de «aprobado»',
    pregunta: '¿cuántos comentarios AFIRMAN que un texto está aprobado?',
  },
  FICHEROS_LEIDOS: {
    singular: 'fichero leído',
    plural: 'ficheros leídos',
    pregunta: '¿sobre cuántos ficheros se ha calculado? (el SUELO, no el hallazgo)',
  },
  // ── Las dos de abajo se separaron A MITAD DE ESTE TICKET, y merece quedar escrito ──────────
  // La primera versión del censo de instrumentos daba **53** y el ticket hablaba de **tres**. No
  // era que uno estuviera mal: son dos poblaciones, y yo las estaba llamando igual — el defecto
  // que vengo a cerrar, mordiéndome mientras lo cerraba. Un fichero que NOMBRA la marca (53) y
  // uno que PUBLICA UNA CIFRA sobre ella (4) no son lo mismo, y el segundo es el que importa.
  INSTRUMENTOS_QUE_TOCAN: {
    singular: 'instrumento que toca la marca',
    plural: 'instrumentos que tocan la marca',
    pregunta: '¿cuántos ficheros de `tests/` y `scripts/` USAN el literal de la marca?',
  },
  INSTRUMENTOS_QUE_CUENTAN: {
    singular: 'instrumento que publica una cifra',
    plural: 'instrumentos que publican una cifra',
    pregunta: '¿cuántos PUBLICAN un número de marcadores que otra sesión podría comparar?',
  },
});

/**
 * Un número CON su unidad, listo para meter en el mensaje de un guard.
 *
 * 🔴 Ésta es la pieza entera del ticket. `frase(22, 'MARCAS_ESCRITAS')` da «22 marcas escritas»,
 * y `frase(1, 'MARCAS_ESCRITAS')` da «1 marca escrita» — el singular importa porque el caso de
 * UNO es justo donde más se confunde una unidad con otra.
 */
export function frase(n, unidad) {
  const u = UNIDADES[unidad];
  if (!u) {
    throw new Error(`🔴 UNIDAD DESCONOCIDA: «${unidad}». Un número sin unidad es lo que este `
      + `ticket viene a quitar, así que no se deja pasar. Las que hay: ${Object.keys(UNIDADES).join(', ')}.`);
  }
  const cantidad = Number(n);
  if (!Number.isFinite(cantidad)) {
    throw new Error(`🔴 «${n}» no es un número, y una unidad sin número tampoco dice nada.`);
  }
  return `${cantidad} ${cantidad === 1 ? u.singular : u.plural}`;
}

/**
 * El mismo número, pero diciendo ADEMÁS qué pregunta contesta. Para cuando el mensaje va a
 * leerlo alguien que acaba de ver OTRA cifra distinta y necesita saber por qué no coinciden.
 */
export function fraseConPregunta(n, unidad) {
  return `${frase(n, unidad)} — ${UNIDADES[unidad].pregunta}`;
}

/**
 * ¿Este texto dice un número de marcadores SIN decir en qué unidad?
 *
 * Es el detector del defecto, y va aquí para que se pueda probar solo. Busca una cifra pegada a
 * una palabra del dominio («marcadores», «marcas», «microcopy») sin ninguna de las unidades
 * declaradas cerca.
 *
 * ⚠️ Deliberadamente CONSERVADOR: sólo mira la misma frase. Un detector agresivo sobre prosa
 * libre daría falsos positivos en cada comentario largo de esta casa, y un guard que grita por
 * nada se apaga en una semana — que es el mismo final que tiene un número sin unidad.
 */
export function numeroSinUnidad(texto) {
  const palabras = Object.values(UNIDADES).flatMap((u) => [u.singular, u.plural]);
  const frases = String(texto ?? '').split(/[.\n·|]/);
  const sospechosas = [];
  for (const f of frases) {
    if (!/\b\d+\b/.test(f)) continue;
    if (!/\b(marcadores?|marcas?|microcopy)\b/i.test(f)) continue;
    if (palabras.some((p) => f.includes(p))) continue;
    sospechosas.push(f.trim());
  }
  return sospechosas;
}
