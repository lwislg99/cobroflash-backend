// tests/_diagnostico-sello.mjs — SCRUM-438
//
// ¿POR QUÉ no cuadra este sello? Contesta NOMBRANDO LA VERSIÓN.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// DE DÓNDE SALE ESTO, Y POR QUÉ VIVE AQUÍ Y NO DENTRO DEL TEST
//
// Nació dentro de `scrum297-evidencias-postgres.test.mjs`. El rojo que precedió a aquel arreglo
// decía solo «hash_no_coincide», que es verdad y no sirve: manda a quien lo lee a sospechar del
// verificador, del contenido o de la fixture, sin distinguir cuál. Localizar que la causa era la
// VERSIÓN costó reconstruir el razonamiento entero.
//
// 🔴 SE SACA AQUÍ PORQUE ÉL MISMO SE ROMPIÓ, Y NADIE PUDO VERLO EN LOCAL. Al estrenar v:3, este
// diagnóstico empezó a LANZAR —pide `obra` para TODAS las versiones soportadas, y v:3 la toma de un
// bloque que estas fuentes no traen—. Vivía dentro de un test gateado por `LIBRO_PG_URL`, así que
// la tanda local lo saltaba y el CI fue lo primero que lo pisó.
//
// La lección es la de SCRUM-419: **el guard que vigila a los gateados no puede estar gateado él
// mismo.** Fuera del test, este diagnóstico se puede probar sin banco — y se prueba, en
// `scrum438-v3-sobre.test.mjs`.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// ⚠️ NO IMPORTA NADA DEL PRODUCTO: las tres funciones se INYECTAN.
//
// Es deliberado. Este módulo lo usan un test que corre contra Postgres y otro que corre sin banco;
// atarlo a `dist/` obligaría a los dos a compartir la misma forma de cargarlo. Y de paso permite
// probarlo con un recetario FALSO, que es como se demuestra que no vuelve a reventar cuando nazca
// una v:4.

/**
 * @param sobre     el sobre guardado (`{ v, contentHash }`)
 * @param fuentes   las fuentes con las que se recalcula
 * @param api       `{ versionesSoportadas, obraSegunVersion, computeAlbaranContentHash, versionActual }`
 * @returns {string} la explicación, en una frase, para meter en el mensaje de un assert
 */
export function porQueNoCuadra(sobre, fuentes, api) {
  const { versionesSoportadas, obraSegunVersion, computeAlbaranContentHash, versionActual } = api;
  const encajes = [];
  // 🔴 EL SUELO. Una versión que no se pudo probar NO es una versión que no encaja: son el mismo
  // silencio con significados opuestos. Sin esta lista, la última rama de abajo diría «no lo
  // reproduce NINGUNA versión soportada (v:1, v:2, v:3)» habiendo probado dos — y eso es una
  // mentira con forma de conclusión, que es la peor clase.
  const noProbadas = [];

  for (const v of versionesSoportadas()) {
    // Se prueba cada versión con las TRES resoluciones posibles de `obra`, no solo con la suya. El
    // fallo histórico sellaba en v:2 pero con la `obra` de v:1 (`Job.direccion` escrita a mano), así
    // que buscar únicamente «v:2 con su propia obra» NO lo habría reproducido y el diagnóstico se
    // habría rendido con un «el contenido no es el que se firmó» — verdad a medias que vuelve a
    // esconder la versión, que es justo lo que hay que dejar de esconder.
    let candidatas;
    try {
      candidatas = [
        ['la columna que manda en esa versión', obraSegunVersion(v, fuentes)],
        ['`Job.direccion` (la fuente de v:1)', fuentes.jobDireccion ?? null],
        ['`Albaran.lugarEntrega` (la fuente de v:2)', fuentes.lugarEntrega ?? null],
      ];
    } catch (e) {
      // Esa versión pide un dato que estas fuentes no tienen —v:3 pide el bloque congelado del
      // sobre—. No dice nada sobre este sello: se anota y se sigue. Es exactamente lo que hace el
      // bucle cruzado del verificador (`albaranVerificacion.ts`), y por el mismo motivo.
      noProbadas.push(`v:${v} (${e?.message || e})`);
      continue;
    }
    for (const [deDonde, obra] of candidatas) {
      let recalculado;
      try {
        recalculado = computeAlbaranContentHash({ ...fuentes, obra }, v);
      } catch (e) {
        noProbadas.push(`v:${v} (${e?.message || e})`);
        break;
      }
      if (recalculado === sobre.contentHash) encajes.push({ v, deDonde });
    }
  }

  // Se arrastra a TODAS las salidas: da igual cuál se dispare, quien lo lea tiene que saber si el
  // diagnóstico miró todo o solo una parte.
  const sinMirar = noProbadas.length
    ? `\n   ⚠️ NO SE PUDIERON PROBAR: ${[...new Set(noProbadas)].join(' · ')}. `
      + 'Esas versiones no dicen NADA sobre este sello — no son «no encaja», son «no se pudo mirar».'
    : '';
  const versiones = [...new Set(encajes.map((e) => e.v))];

  if (versiones.length && !versiones.includes(sobre.v)) {
    return `DISCREPANCIA DE VERSIÓN: el sobre DECLARA v:${sobre.v} pero su contentHash se SELLÓ `
      + `con v:${versiones.join(' o v:')} —tomando «obra» de ${encajes[0].deDonde}—, y el defecto `
      + `del sellador es hoy v:${versionActual}. El verificador está BIEN: `
      + `recalcula con la regla de la versión que el sobre declara (v:${sobre.v}). Lo que miente `
      + 'es la FIXTURE, que sella con una versión y declara otra. Se arregla en la fixture, '
      + 'JAMÁS relajando el verificador ni el despacho por versión.' + sinMirar;
  }
  if (versiones.includes(sobre.v)) {
    return `la versión NO es el problema: el SELLADOR sí reproduce este hash en v:${sobre.v} `
      + `tomando «obra» de ${encajes.find((e) => e.v === sobre.v).deDonde}, y aun así el `
      + 'VERIFICADOR dice que no cuadra. Los dos testigos discrepan sobre el mismo sobre, así '
      + 'que o el contenido que llega al verificador no es el que se selló, o alguien ha tocado '
      + `la receta de v:${sobre.v} —CONGELADA justo para que esto no pase—. Mira el diff de `
      + '`albaranVerificacion.ts` antes que nada.' + sinMirar;
  }
  const probadas = versionesSoportadas().filter((v) => !noProbadas.some((n) => n.startsWith(`v:${v} `)));
  return `el contentHash del sobre v:${sobre.v} no lo reproduce ninguna de las versiones que SÍ se `
    + `pudieron probar (v:${probadas.join(', v:')}) con ninguna de las dos fuentes de «obra»: `
    + 'aquí no hay discrepancia de versión, el contenido no es el que se firmó.' + sinMirar;
}
