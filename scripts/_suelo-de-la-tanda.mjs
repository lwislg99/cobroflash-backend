// scripts/_suelo-de-la-tanda.mjs — SCRUM-672
//
// ═════════════════════════════════════════════════════════════════════════════════════════════
// UN TEST QUE DESAPARECE NO ES UN TEST QUE FALLA
//
// ── EL DEFECTO, medido el 2-sep-2026 como efecto colateral de otro instrumento ──────────────
// Al romper un `import` a propósito para censar consumidores, la tanda pasó de **4391 a 4377**
// con `fail 2`: **catorce tests DESAPARECIERON del total**. Aquella vez hubo señal porque el
// import roto produjo rojos. Pero cualquier camino que saque un fichero de la tanda **sin
// producir un rojo** —un fichero renombrado y no re-referenciado, un patrón de descubrimiento que
// deja de casar, un `import` que se resuelve a vacío— se lleva sus tests y **nadie se entera**.
//
// 🔴 ES LA CLASE CARA: produce VERDES FALSOS, no rojos falsos. Un test que falla grita; uno que
// deja de existir no dice nada, el recuento baja y el porcentaje de verdes puede incluso MEJORAR.
// Ya pasó en otra población: SCRUM-559, donde un `defer` en UN `<script>` dejaba 16/16 en verde
// con ese fichero fuera de toda vigilancia. **La pérdida PARCIAL pasa por debajo de todos los
// umbrales.**
//
// ── ES UN SUELO, NO UN ESPEJO ──────────────────────────────────────────────────────────────
// El número declarado es un **MÍNIMO**: la tanda cae si el total queda POR DEBAJO. Subir es
// normal y no obliga a tocar nada.
//
// El motivo es de coordinación real: hay varias ramas en vuelo añadiendo tests a la vez, y un
// número que hubiera que actualizar en cada PR sería una fábrica de conflictos — exactamente el
// problema del contador de SCRUM-662, un nivel más arriba.
//
// **Contrapartida asumida, y por eso se compensa:** un suelo viejo deja margen para perder tests
// sin que salte. Y no es hipotético — está medido en esta misma casa: `SUELO_TOTAL` de
// `_evidencia-tanda.mjs` sigue en **646** mientras la tanda real va por más de 4.700. Ese suelo ya
// no separa «tanda completa» de «media suite borrada». Por eso este guard **IMPRIME EL MARGEN EN
// CADA EJECUCIÓN**: un suelo rancio tiene que verse sin que nadie vaya a buscarlo.
//
// ── ⚠️ SI DOS RAMAS CAMBIAN ESTE NÚMERO A LA VEZ: SE QUEDA EL MÁS ALTO ─────────────────────
// **Nunca el más bajo, y nunca «el de mi rama».** Un merge que elija el menor baja el suelo en
// silencio — que es el defecto que este fichero viene a cerrar, entrando por la puerta de atrás.
// Si al resolver el conflicto dudas, quédate con el mayor: como mucho obliga a subirlo otra vez;
// el otro error deja de vigilar sin decirlo.
// ═════════════════════════════════════════════════════════════════════════════════════════════

/**
 * 🔴 EL SUELO. Es un MÍNIMO, no una igualdad.
 *
 * Medido el 2-sep-2026 sobre `origin/main` = `bdce57dc`: la tanda dio **4766** tests
 * (`# tests` del reporter TAP, dos ejecuciones seguidas con el mismo número). Se declara ese
 * mismo valor, **sin tolerancia**: un margen «por si acaso» convertiría esto en el umbral con
 * holgura que SCRUM-559 tuvo que retirar.
 *
 * SUBIRLO ES UNA LÍNEA y lo puede hacer cualquier sesión: si la tanda crece, se sube y ya. Lo que
 * NO se hace es bajarlo para desatascar — para eso está el mensaje, que obliga a decir cuántos
 * tests se han perdido y a decidirlo a la vista del número.
 *
 * ⚠️ CONFLICTO ENTRE RAMAS: **se queda el MÁS ALTO** (ver la cabecera).
 */
export const SUELO_TESTS = 4792;

/** Contra qué se midió, para que el suelo no sea un número sin procedencia. */
export const MEDIDO_CONTRA = 'origin/main = 80db312b · 2026-09-02';

export const SALIDA_POR_DEBAJO = 1;
export const SALIDA_NO_SUPE_MIRAR = 2;

/**
 * El total de una salida TAP. `null` si no se pudo leer — que **no** es cero.
 *
 * 🔴 SE LEE DEL TAP Y NO DE LA SALIDA `spec`, y está medido: con el reporter TAP activo, la línea
 * `ℹ tests N` de `spec` **no existe**. O sea que el número que imprime la consola depende de qué
 * reporter esté puesto, y un guard colgado de eso se queda ciego cuando alguien cambia los
 * reporters. El `# tests N` del TAP lo emite el propio reporter, siempre y en el mismo formato.
 *
 * Se toma la ÚLTIMA aparición: un TAP con subtests anidados puede llevar resúmenes intermedios, y
 * el del final es el de la tanda entera.
 */
export function totalDelTap(texto) {
  const todas = String(texto || '').split('\n').filter((l) => /^#\s+tests\s+\d+\s*$/.test(l.trim()));
  if (!todas.length) return null;
  const m = todas[todas.length - 1].trim().match(/^#\s+tests\s+(\d+)$/);
  return m ? Number(m[1]) : null;
}

/**
 * El veredicto. **PURO**: entra el texto del TAP y el suelo, sale qué decir y con qué código.
 *
 * Separarlo del disco es lo que permite ejercitar el rojo, el control negativo y el mensaje del
 * margen en milisegundos, sin correr la tanda dentro de la tanda.
 */
export function veredictoDelSuelo(textoTap, suelo = SUELO_TESTS) {
  const total = totalDelTap(textoTap);

  // ── 🔴 SUELO DEL PROPIO GUARD ───────────────────────────────────────────────────────────
  // Sin total no hay veredicto. «No supe leer el TAP» y «la tanda no tiene tests» son el mismo
  // hueco con significados opuestos, y el segundo disfrazado del primero es cómo se pierde la
  // vigilancia entera: si esto devolviera 0 y comparara, saltaría siempre y alguien lo apagaría.
  if (total === null) {
    return {
      ok: false, salida: SALIDA_NO_SUPE_MIRAR, total: null, suelo, margen: null,
      titulo: '⚠️ NO SUPE MIRAR: no encontré la línea `# tests N` en el TAP.',
      detalle: '   Esto NO es «la tanda está bien»: es que no se ha podido comprobar.\n'
        + '   ¿Se ha quitado el reporter TAP, o el fichero está vacío porque la tanda ni arrancó?',
    };
  }

  const margen = total - suelo;

  if (margen < 0) {
    return {
      ok: false, salida: SALIDA_POR_DEBAJO, total, suelo, margen,
      titulo: `🔴 LA TANDA HA PERDIDO ${-margen} TEST(S): ${total} corridos, suelo ${suelo}.`,
      detalle: '   Un test que desaparece no es un test que falla: no grita, el recuento baja y el\n'
        + '   porcentaje de verdes puede incluso MEJORAR. Por eso esto se mira aparte del `fail`.\n\n'
        + '   Qué mirar, en este orden:\n'
        + '     · ¿se ha renombrado o movido un fichero de `tests/` y ya no casa con el patrón?\n'
        + '     · ¿hay un `import` que se resuelve a vacío y se ha llevado su fichero entero?\n'
        + '     · ¿se han borrado tests A PROPÓSITO? Entonces esto es correcto: BAJA el suelo\n'
        + '       conscientemente, en el mismo commit y diciendo cuántos y por qué.\n\n'
        + `   Suelo medido contra: ${MEDIDO_CONTRA}.`,
    };
  }

  return {
    ok: true, salida: 0, total, suelo, margen,
    // 🔴 EL MARGEN SE IMPRIME SIEMPRE, no sólo cuando falla. Es la compensación de haber elegido
    // un suelo y no un espejo: sin esto, un suelo rancio no se ve hasta que ya no vigila nada.
    titulo: `✅ suelo ${suelo} · total actual ${total} · margen ${margen}`,
    detalle: margen === 0 ? '' : `   Subir el suelo a ${total} es una línea, y lo puede hacer cualquier sesión.`,
  };
}
