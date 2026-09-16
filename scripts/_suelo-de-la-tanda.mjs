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
 *
 * ── 🔴 SCRUM-708 (8-sep-2026) · SUBIDO DE 4798 A 6246, Y LO QUE SE APRENDIÓ SUBIÉNDOLO ──────
 *
 * Estuvo en 4798 desde el 2-sep-2026. El 8-sep-2026 la tanda daba 6246: margen +1448 ese día. Se
 * podían perder mil cuatrocientos cuarenta y ocho tests y esto seguía verde. **Margen al declararlo
 * hoy: 0.**
 *
 * Y lo caro no es que estuviera rancio: es que **la compensación elegida para que no lo estuviera
 * era IMPRIMIR EL MARGEN** en cada ejecución — está escrito ahí arriba, «un suelo rancio tiene que
 * verse sin que nadie vaya a buscarlo». Llevaba seis días imprimiéndolo en CI y nadie lo subió. Y
 * el precedente que esa misma cabecera cita seguía igual el 8-sep-2026: el `SUELO_TOTAL` de
 * `_evidencia-tanda.mjs`, con la tanda por encima de seis mil.
 *
 * 🔒 IMPRIMIR NO ES UN MECANISMO. Un dato que sólo sirve si alguien lo lee depende de que alguien
 * se acuerde, que es justo lo que este número no podía permitirse.
 *
 * ── ✅ Y ESO YA NO DEPENDE DE QUE NADIE SE ACUERDE ──────────────────────────────────────────
 * No por ESTE número, que volverá a envejecer: por el de al lado. SCRUM-708 conectó la población
 * `tests-declarados` al registro de suelos DERIVADOS de SCRUM-810 (`scripts/_suelo-contra-main.mjs`,
 * usado desde `tests/scrum810b-los-suelos-derivados.test.mjs`), que compara contra la **base de
 * fusión con `main`** en vez de contra un número escrito: **no caduca**, porque main se mueve solo,
 * y **habla a la PRIMERA pérdida** en vez de esperar a que el margen se agote.
 *
 * Los dos números tienen trabajos distintos y ninguno sobra:
 *   · éste (declarado) → CEGUERA: un TAP a medias, una tanda que ni arrancó, media suite fuera.
 *   · el derivado      → PÉRDIDA: esta rama trae menos tests que la base de la que salió.
 *
 * Que éste se vuelva a quedar corto ya no deja la vigilancia en nada.
 *
 * ── ✅ Y DESDE SCRUM-736 YA NO HAY QUE SUBIRLO ──────────────────────────────────────────────
 * Donde antes decía «súbelo igual cuando lo veas» —un `console.log` con forma de tarea— ahora hay
 * una red que BLOQUEA: el suelo que rige es el mayor entre este número y el que se deriva de los
 * tests que el árbol DECLARA (ver `CUENTA_DEL_ARBOL_MINIMA` más abajo). Este 6246 se queda como
 * mínimo histórico y como respaldo para cuando el censo del árbol no se pueda hacer; **no hay que
 * mantenerlo, y dejarlo rancio ya no afloja nada.**
 */
export const SUELO_TESTS = 6246;

/** Contra qué se midió, para que el suelo no sea un número sin procedencia. */
export const MEDIDO_CONTRA = 'origin/main = fd290d4a · 2026-09-08';

export const SALIDA_POR_DEBAJO = 1;
export const SALIDA_NO_SUPE_MIRAR = 2;

/**
 * 🔴 SCRUM-736 · LA RED QUE BLOQUEA, PORQUE UN AVISO QUE NADIE ESTÁ OBLIGADO A MIRAR NO ES UN AVISO
 *
 * Lo de arriba acaba diciendo «súbelo igual cuando lo veas». Eso es un `console.log` en una tanda
 * de casi 7.000 tests: llevaba ocho días imprimiendo el margen y nadie lo subió — otra vez.
 *
 * ── LO QUE SE MIDIÓ ANTES DE ELEGIR NADA (16-sep-2026) ──────────────────────────────────────
 * `tests-declarados` en `origin/main`, un commit por día, con el MISMO censo del trinquete
 * derivado de SCRUM-810b: **3595 → 6756 en 14 pasos medidos. Suben 14, bajan 0.** Media **+226 al
 * día**, y un salto de **+647** en una sola jornada.
 *
 * 🔒 ESO REFUTA LAS DOS SALIDAS OBVIAS, y con números:
 *   · **una banda de margen no sirve.** Al ritmo medido, un 5% de holgura caduca en 1,5 días y un
 *     25% en 7,5. Cualquier banda convierte el suelo en un trinquete que hay que tocar cada pocos
 *     días — el trinquete a mano que se sube por inercia, sólo que con más ceremonia.
 *   · **y «subirlo al número de hoy» caduca mañana**: +226 al día.
 *
 * ── ENTONCES QUÉ, Y POR QUÉ ESTO NO ES «DERIVARLO DEL ÁRBOL» ────────────────────────────────
 * Derivar un suelo de la población que ese mismo suelo vigila lo borra: coincidiría siempre
 * consigo mismo y no podría caer nunca. **Aquí son DOS poblaciones independientes:**
 *
 *     lo que el ÁRBOL DECLARA (`test(`/`it(` por AST, SCRUM-708)   →  6756
 *     lo que la TANDA REGISTRÓ (`# tests` del TAP)                 →  6903
 *
 * Una tanda a medias hunde el segundo y **no toca el primero**. Por eso esta comparación SÍ puede
 * caer, y cae: está ejercida en `tests/scrum736-…`, quitando 441 tests del TAP.
 *
 * Y no es un patrón nuevo en la casa: es el del bloque ④b de `_evidencia-tanda.mjs`, que ya exige
 * «AL MENOS tantos ficheros como hay hoy en `tests/`» y lo llama, con estas palabras, **la versión
 * exacta del suelo, sin número mágico**. Lo que faltaba era aplicárselo al OTRO número, el de
 * tests, que se quedó a mano justo al lado.
 *
 * ── LA DECISIÓN QUE SIGUE SIENDO UNA DECISIÓN ───────────────────────────────────────────────
 * Ésta: **cuánta divergencia entre lo declarado y lo corrido se tolera.** Es una FRACCIÓN, y por
 * eso no envejece — no depende del tamaño de la suite, así que crece con ella sola.
 *
 * Se elige en 0,97 con la relación medida delante: hoy la tanda registra un **1,022×** lo que el
 * árbol declara (el TAP cuenta los subtests y los tests que nacen dentro de un bucle, que el AST
 * ve como una sola llamada). O sea que 0,97 deja **5 puntos por debajo de la relación observada**:
 * holgado para que un bucle de más no fabrique un rojo, y suficiente para cazar que la tanda deje
 * de dar cuenta del 3% de lo que el árbol declara. **No se escribe aquí a cuántos tests equivale
 * ese 3%**: sería una cifra que caduca mañana, y la calcula el propio veredicto en cada ejecución
 * (`sueloEfectivo`, y el título lo imprime). Que la frase no diga un número es el escalón ② de la
 * jerarquía de SCRUM-737, y es mejor que anclarlo: no hay nada que mantener.
 *
 * ⚠️ Y UN PUNTO ES UN PUNTO: la relación 1,022 está medida sobre UN árbol. Por eso el suelo del
 * guard exige que la relación observada caiga dentro de una banda ancha, y si se sale, lo DICE
 * en vez de callarse: una relación absurda significa que el censo por AST se ha roto, no que la
 * tanda esté mal.
 */
export const CUENTA_DEL_ARBOL_MINIMA = 0.97;

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
/**
 * El suelo que de verdad rige, y de dónde sale.
 *
 * 🔴 EL MAYOR DE LOS DOS, y el orden importa: el número declarado es un MÍNIMO histórico que no
 * baja, y el derivado es el que se mantiene solo. Mientras el árbol crezca, rige el derivado y
 * **nadie tiene que acordarse de nada**; si el censo por AST no se puede hacer, rige el declarado
 * y se DICE en el título — que es distinto de callarse y seguir con un número rancio.
 */
export function sueloEfectivo(suelo, declaradosEnElArbol) {
  if (!Number.isFinite(declaradosEnElArbol) || declaradosEnElArbol <= 0) {
    return { valor: suelo, de: 'declarado', derivado: null, medible: false };
  }
  const derivado = Math.ceil(declaradosEnElArbol * CUENTA_DEL_ARBOL_MINIMA);
  return derivado > suelo
    ? { valor: derivado, de: 'derivado', derivado, medible: true }
    : { valor: suelo, de: 'declarado', derivado, medible: true };
}

export function veredictoDelSuelo(textoTap, suelo = SUELO_TESTS, declaradosEnElArbol = null) {
  const total = totalDelTap(textoTap);
  const mudos = ficherosMudosDelTap(textoTap);
  const efectivo = sueloEfectivo(suelo, declaradosEnElArbol);

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

  // 🔴 DESDE SCRUM-736 el margen se mide contra el suelo EFECTIVO, no contra el declarado. Si se
  // midiera contra el declarado, el margen volvería a crecer solo y volveríamos a imprimirlo.
  const margen = total - efectivo.valor;

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
      ok: false, salida: SALIDA_POR_DEBAJO, total, suelo, margen, mudos, efectivo,
      titulo: `🔴 LA TANDA ESTÁ ${-margen} TEST(S) POR DEBAJO DEL SUELO: ${total} corridos, suelo `
        + `${efectivo.valor}` + (efectivo.de === 'derivado'
          ? ` (DERIVADO: el árbol declara ${declaradosEnElArbol} y se exige el ${Math.round(CUENTA_DEL_ARBOL_MINIMA * 100)}%).`
          : ` (declarado a mano; el censo del árbol no se pudo hacer).`),
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
        + '       SCRUM-708: eso YA NO hay que deducirlo de este número. `scrum708-el-fichero-que-\n'
        + '       no-corre` lo dice DIRECTAMENTE y nombra el fichero — cruza quién registra tests\n'
        + '       (por AST) con el patrón que `npm test` expande de verdad. Si ese guard está en\n'
        + '       verde, no es esto.\n'
        + '     · ¿se han borrado tests A PROPÓSITO? Entonces esto es correcto: BAJA el suelo\n'
        + '       conscientemente, en el mismo commit y diciendo cuántos y por qué.\n\n'
        + `   Suelo medido contra: ${MEDIDO_CONTRA}.`,
    };
  }

  return {
    ok: true, salida: 0, total, suelo, margen, mudos, efectivo,
    // El margen se sigue imprimiendo, pero ya NO es la protección: desde SCRUM-736 el suelo que
    // rige se mantiene solo, así que este número es información, no una tarea pendiente para
    // quien lo lea. Lo que protege está arriba, y bloquea.
    // ⚠️ EL ORDEN NO ES COSMÉTICO: `scrum672` exige las tres cifras SEGUIDAS
    // (`suelo N · total actual N · margen N`) porque su promesa es que un suelo rancio se VEA.
    // La procedencia va detrás para no romper ese contrato — se añade información, no se mueve
    // la que otro guard ya vigila.
    titulo: `✅ suelo ${efectivo.valor} · total actual ${total} · margen ${margen} · ${efectivo.de}`,
    detalle: efectivo.medible
      ? (efectivo.de === 'derivado'
        ? `   Sale del árbol: declara ${declaradosEnElArbol} tests y se exige el `
          + `${Math.round(CUENTA_DEL_ARBOL_MINIMA * 100)}%. No hay nada que subir a mano.`
        : `   Rige el declarado (${suelo}) porque va por encima del derivado `
          + `(${efectivo.derivado}, del ${Math.round(CUENTA_DEL_ARBOL_MINIMA * 100)}% de `
          + `${declaradosEnElArbol} declarados en el árbol).`)
      : '   ⚠️ SIN CENSO DEL ÁRBOL: rige el número declarado, que envejece. Esto no es «todo bien»:\n'
        + '      es que la mitad que se mantiene sola no se ha podido calcular.',
  };
}
