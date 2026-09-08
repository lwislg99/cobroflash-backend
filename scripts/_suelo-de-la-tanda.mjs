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
//
// ── ⚠️ Y ESO NO PROHÍBE BAJARLO A PROPÓSITO (SCRUM-695) ───────────────────────────────────────
// La regla de arriba resuelve **un choque entre dos ramas**. No dice que el número no pueda bajar
// nunca: **retirar tests con su motivo escrito es legítimo**, y entonces bajar el suelo es la
// operación correcta, no una trampa.
//
// Está medido, no supuesto. SCRUM-695 investigó la única bajada del total que hubo en 25 merges
// —cuatro tests menos en `tests/scrum498-cifra-derivada.test.mjs`— y resultó ser una retirada
// CORRECTA: SCRUM-680 dejó esos cuatro sin sujeto, y resucitarlos contra el registro de hoy da
// dos verdes huecos y dos rojos permanentes. Mantenerlos habría sido peor que retirarlos.
//
// **Este guard habría llorado igual.** Es su diseño y está bien: es un SUELO, no un juez — no sabe
// distinguir una retirada documentada de una pérdida silenciosa, y por eso avisa siempre y deja la
// decisión a quien mira. Lo que se le pide a quien la tome es lo mismo que hizo SCRUM-680: que el
// motivo quede ESCRITO donde alguien lo buscaría. Bajar el número para desatascar un rojo que no
// se ha mirado sigue siendo lo prohibido.
// ═════════════════════════════════════════════════════════════════════════════════════════════

/**
 * 🔴 EL SUELO. Es un MÍNIMO, no una igualdad.
 *
 * Medido el 2-sep-2026 sobre `origin/main` = `a464d978`: la tanda dio **4766** tests
 * — y SUBIDO a **4798** el 2-sep-2026 sobre `origin/main` = `80db312b` (rama scrum-584, con main
 * mergeado dentro), que es lo que la regla de abajo dice que hay que hacer cuando la tanda crece:
 * 4798 tests, 4714 en verde, 0 fallos, 84 saltadas. No se sube "por si acaso": es lo MEDIDO.
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
export const SUELO_TESTS = 4798;

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
 * 🔴 SCRUM-702 · LOS FICHEROS MUDOS — el defecto MISMO, sin pasar por el total.
 *
 * Medido: cuando un fichero de `tests/` **carga bien pero no registra ni un test** —un `import`
 * de namespace cuya propiedad ya no existe, un `if` que dejó de cumplirse—, `node --test` NO
 * calla: emite una entrada con EL NOMBRE DEL FICHERO. Y lo hace **en verde**, contando como un
 * test. Comprobado en laboratorio con dos ficheros:
 *
 *     con sus 3 tests   →  ok 1 - lab A1 · ok 2 - lab A2 · ok 3..5 (los de b)   # tests 5
 *     fichero mudo      →  ok 1 - lab A1 · ok 2 - lab A2 · **ok 3 - b.test.mjs**  # tests 3
 *
 * O sea que el defecto que persigue SCRUM-672 **deja una firma exacta en el TAP**, y hasta hoy
 * sólo se detectaba de refilón: por el total, que además baja sólo 2 en vez de 3 porque la
 * entrada del fichero suma uno. Un test de verdad NUNCA se llama `algo.test.mjs`.
 *
 * 🔴 POR QUÉ ESTO IMPORTA MÁS QUE EL TOTAL: sale del MISMO TAP que se está evaluando. No se
 * compara con ningún número declarado en otro sitio y en otro momento, así que no puede
 * equivocarse por haberse medido sobre otro árbol — que es exactamente lo que le pasó al suelo.
 */
export function ficherosMudosDelTap(texto) {
  const mudos = [];
  for (const linea of String(texto || '').split('\n')) {
    const m = linea.match(/^\s*(?:not )?ok \d+ - (\S+\.test\.mjs)\s*$/);
    if (m) mudos.push(m[1]);
  }
  return mudos;
}

/**
 * El veredicto. **PURO**: entra el texto del TAP y el suelo, sale qué decir y con qué código.
 *
 * Separarlo del disco es lo que permite ejercitar el rojo, el control negativo y el mensaje del
 * margen en milisegundos, sin correr la tanda dentro de la tanda.
 */
export function veredictoDelSuelo(textoTap, suelo = SUELO_TESTS) {
  const total = totalDelTap(textoTap);
  const mudos = ficherosMudosDelTap(textoTap);

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

  // ── 🔴 PRIMERO LO QUE ES SEGURO, Y LUEGO LO QUE ES UN INDICIO ───────────────────────────
  // El fichero mudo se decide con el TAP en la mano: es el defecto, visto. El margen negativo
  // es sólo una SOSPECHA, porque compara con un número que se declaró en otro árbol. Si se
  // dieran los dos a la vez y mandara el margen, el mensaje acusaría al árbol de un defecto que
  // está localizado y con nombre y apellidos.
  if (mudos.length) {
    return {
      ok: false, salida: SALIDA_POR_DEBAJO, total, suelo, margen, mudos,
      titulo: `🔴 ${mudos.length} FICHERO(S) DE TEST NO REGISTRARON NI UN TEST: ${mudos.join(', ')}.`,
      detalle: '   No es una sospecha por el recuento: está en el TAP. `node --test` emite una entrada\n'
        + '   con el NOMBRE DEL FICHERO cuando el fichero carga y no registra nada — y la emite EN\n'
        + '   VERDE, contando como un test, así que el total baja menos de lo que se ha perdido y\n'
        + '   el porcentaje de verdes hasta mejora.\n\n'
        + '   Un test de verdad nunca se llama `algo.test.mjs`. Qué mirar:\n'
        + '     · un `import * as X` cuya propiedad ya no existe: da `undefined`, no error, y el\n'
        + '       `if` que envuelve los tests deja de cumplirse en silencio;\n'
        + '     · una condición de guarda que dejó de darse en este entorno;\n'
        + '     · un fichero vaciado a medias.',
    };
  }

  if (margen < 0) {
    return {
      ok: false, salida: SALIDA_POR_DEBAJO, total, suelo, margen, mudos,
      titulo: `🔴 LA TANDA ESTÁ ${-margen} TEST(S) POR DEBAJO DEL SUELO: ${total} corridos, suelo ${suelo}.`,
      detalle: '   Un test que desaparece no es un test que falla: no grita, el recuento baja y el\n'
        + '   porcentaje de verdes puede incluso MEJORAR. Por eso esto se mira aparte del `fail`.\n\n'
        + '   🔴 Y ANTES DE BUSCAR UN TEST PERDIDO, DESCARTA QUE SEA OTRO ÁRBOL. Esto compara un\n'
        + '   número DECLARADO en un commit con uno MEDIDO en otro, y `main` se mueve deprisa:\n'
        + '   medido el 2-sep-2026 subió 4805 → 4812 → 4832 → 4841 en cuarenta minutos. Una rama\n'
        + '   que declaró el suelo con SUS tests dentro deja por debajo a toda rama hermana que no\n'
        + '   los tenga, y ninguna ha perdido nada. Pasó: `deeb89a9` declaró 4814 mientras su\n'
        + '   propio CI medía 4805.\n\n'
        + '   No es cosa del sistema operativo: medido sobre el MISMO árbol, Windows y Ubuntu dan\n'
        + '   el mismo `# tests` (4812 y 4812 en `c71635ce`; 4928 y 4928 en `4e9e114d`, nombre a\n'
        + '   nombre). Lo que sí cambia entre los dos es `# skipped`, que no entra en este número.\n\n'
        + '   Qué mirar, en este orden:\n'
        + '     · ¿tu rama sale de un `main` ANTERIOR al que declaró este suelo? Entonces no falta\n'
        + '       nada: mezcla `main` y vuelve a mirar.\n'
        + '     · ¿se ha renombrado o movido un fichero de `tests/` y ya no casa con el patrón?\n'
        + '       (ése es el único caso que este número ve y los ficheros mudos no.)\n'
        + '     · ¿se han borrado tests A PROPÓSITO? Entonces esto es correcto: BAJA el suelo\n'
        + '       conscientemente, en el mismo commit y diciendo cuántos y por qué.\n\n'
        + `   Suelo medido contra: ${MEDIDO_CONTRA}.`,
    };
  }

  return {
    ok: true, salida: 0, total, suelo, margen, mudos,
    // 🔴 EL MARGEN SE IMPRIME SIEMPRE, no sólo cuando falla. Es la compensación de haber elegido
    // un suelo y no un espejo: sin esto, un suelo rancio no se ve hasta que ya no vigila nada.
    titulo: `✅ suelo ${suelo} · total actual ${total} · margen ${margen}`,
    detalle: margen === 0 ? '' : `   Subir el suelo a ${total} es una línea, y lo puede hacer cualquier sesión.`,
  };
}
