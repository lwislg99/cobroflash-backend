// tests/scrum388-centinela-main.test.mjs — SCRUM-388
//
// EL CENTINELA: el censo corriendo contra `main` DE VERDAD.
//
// ═════════════════════════════════════════════════════════════════════════════════════════
// 🔴 ESTE FICHERO NO FIJA NINGÚN VEREDICTO, Y ESA ES LA DECISIÓN
//
// La primera versión fijaba los de cuatro tickets reales (298, 293, 294, 354). Se retiró, y no por
// gusto: **un test que fija el estado actual convierte un defecto en un requisito.** «SCRUM-354 →
// NADA» se pondría rojo el día que alguien construya A9 —o sea, el día que se hace el trabajo
// BIEN— y quien lo encontrara tendría delante un test exigiéndole que A9 siga sin empezar. Ya nos
// pasó con el test que falló cuando el import se ARREGLÓ.
//
// Que el censo sepa CLASIFICAR lo prueba `scrum388-censo-mecanismo.test.mjs` contra fixtures
// congelados. Eso no caduca.
//
// Lo que queda aquí es lo único que `main` puede aportar sin caducar: **que el mecanismo siga
// sabiendo leer este repositorio**. Es una prueba de humo, no un inventario.
//
//   · Si `docs/master/` se mueve, si cambia el formato de los mensajes de commit, si la convención
//     de ramas deja de ser `scrum-<n>-<slug>` → el censo se queda ciego y ESTO lo dice.
//   · Si alguien construye un ticket que antes no tenía nada → esto **NO** se pone rojo. Es una
//     buena noticia, y una buena noticia no puede romper la suite.
//
// ⚠️ SI ESTE FICHERO CAE: **RE-MIDE, NO ARREGLES EL TEST.** Lo que ha cambiado es cómo se puede
// leer el repositorio, y el censo mide sobre esa lectura. Ajustar el umbral para que vuelva a
// pasar es apagar la alarma en vez de mirar el fuego.
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { censarTicket, capacidadDeMedir } from './_censo-tickets.mjs';

const RAIZ = path.resolve(import.meta.dirname, '..');

// ⚠️ AQUÍ HABÍA UN TEST que exigía `comprobarSuelo` limpio, y se ha RETIRADO. Era de la versión
// anterior, cuando el centinela daba por hecho que el mundo real se parece a un portátil: exigía
// historia completa y refs remotos, así que en CI fallaba por el ENTORNO y no por un hallazgo — la
// confusión exacta que este ticket vino a deshacer.
//
// Lo que hacía de útil lo cubre mejor el test de abajo, que pregunta fuente por fuente si se puede
// mirar antes de exigirle nada. `comprobarSuelo` sigue existiendo y sigue usándose donde tiene
// sentido: en el banco de fixtures, donde el entorno lo fabricamos nosotros y sí debe estar
// completo.

test('SCRUM-388 · CENTINELA: cada fuente, o encuentra evidencia, o declara que NO PUDO MIRAR', () => {
  // ═════════════════════════════════════════════════════════════════════════════════════════
  // 🔴 «NO HE PODIDO MEDIR» ≠ «NO ENCUENTRO EVIDENCIA»
  //
  // La primera versión no distinguía las dos cosas, y **reventó en CI**: `actions/checkout` clona
  // superficial y sin refs remotos, así que `git log origin/main` murió con `unknown revision`
  // (status 128). Y eso fue SUERTE. **Si git hubiera devuelto vacío en vez de error, este test
  // habría dicho «la fuente ramas no encuentra evidencia en NINGÚN ticket» — una falsa alarma
  // idéntica a un hallazgo real.**
  //
  // Y no era hipotético: la fuente de RAMAS hace exactamente eso. Medido en un clon
  // `--depth 1 --single-branch`: `for-each-ref` no falla, devuelve 1 ref de ~90.
  //
  // Así que primero se pregunta si el entorno PERMITE mirar, y solo se exige evidencia a las
  // fuentes que sí. Las demás se declaran no medidas, con su motivo, y no se inventan un hallazgo.
  const capacidad = capacidadDeMedir({ raiz: RAIZ });
  const porFuente = {
    commits: capacidad.commits, 'docs/master': capacidad.doc, ramas: capacidad.ramas,
  };

  const medibles = Object.entries(porFuente).filter(([, c]) => c.puede).map(([f]) => f);
  const noMedibles = Object.entries(porFuente).filter(([, c]) => !c.puede);

  // Las que no se pueden mirar se DECLARAN, en voz alta y sin fallar. Es información del entorno,
  // no un hallazgo sobre el repositorio.
  for (const [fuente, c] of noMedibles) {
    console.log(`ℹ️  NO PUDE MEDIR la fuente «${fuente}»: ${c.motivo}`);
  }

  // SUELO, y es la otra mitad del principio del fundador: «un centinela que se salta en todos los
  // sitios donde de verdad corre no es un centinela; saltarse siempre y no existir son lo mismo».
  // Si NINGUNA fuente es mirable, el entorno no sirve para esto y hay que arreglarlo —no callarlo.
  assert.ok(medibles.length > 0,
    '🔴 NO SE PUEDE MIRAR NINGUNA FUENTE EN ESTE ENTORNO:\n   · ' +
    noMedibles.map(([f, c]) => `${f}: ${c.motivo}`).join('\n   · ') +
    '\n\n  ⚠️ Esto NO dice «no hay trabajo pendiente»: dice que el censo está ciego. En CI se\n' +
    '  arregla con `fetch-depth: 0` en `actions/checkout` (ya lo usa `zona-roja.yml` por el mismo\n' +
    '  motivo). Un centinela que no puede mirar nada y calla es peor que no tenerlo.');

  // Y a las que SÍ se pueden mirar se les exige que encuentren algo. El barrido va sobre un rango
  // amplio a propósito: cualquier ticket sirve de testigo, así que ninguno en particular puede
  // hacer caer esto al avanzar su estado.
  const vistas = new Set();
  for (let n = 280; n <= 400; n++) {
    for (const f of censarTicket(n, { raiz: RAIZ }).fuentes) vistas.add(f);
    if (vistas.size === medibles.length) break;
  }
  for (const fuente of medibles) {
    assert.ok(vistas.has(fuente),
      `🔴 la fuente «${fuente}» SÍ se podía mirar en este entorno y no encuentra evidencia en\n` +
      '  NINGÚN ticket del rango 280-400.\n\n' +
      '  ⚠️ RE-MIDE, NO ARREGLES EL TEST. No significa que no haya trabajo: significa que ese\n' +
      '  buscador ha dejado de reconocer lo que mira. Los sospechosos, por orden: la convención de\n' +
      '  ramas (`scrum-<n>-<slug>`), el ticket en el ASUNTO del commit, o la ruta `docs/master/`.\n' +
      `  Fuentes que sí responden: [${[...vistas].join(', ')}] · medibles aquí: [${medibles.join(', ')}]`);
  }
});

test('SCRUM-388 · CENTINELA: un veredicto NUNCA dice «NADA» sobre fuentes que no pudo mirar', () => {
  // El principio, comprobado sobre el propio `censarTicket`: si alguna fuente no era mirable, el
  // resultado tiene que ARRASTRAR ese hecho. Un `NADA` limpio, sin nota, solo puede salir de un
  // entorno donde se miraron las tres.
  const r = censarTicket(99999, { raiz: RAIZ });
  const cap = capacidadDeMedir({ raiz: RAIZ });
  const todasMirables = cap.commits.puede && cap.doc.puede && cap.ramas.puede;
  assert.ok(Array.isArray(r.noMedibles), '🔴 el resultado no declara qué fuentes no se pudieron mirar');
  if (todasMirables) {
    assert.equal(r.veredicto, 'NADA');
    assert.deepEqual(r.noMedibles, [],
      '🔴 se miraron las tres fuentes y aun así el resultado dice que alguna no era medible');
  } else {
    assert.ok(r.noMedibles.length > 0,
      '🔴 hay fuentes no mirables y el veredicto no lo arrastra: eso es emitir «no hay evidencia» ' +
      'sobre un mundo que no se llegó a mirar');
  }
});

test('SCRUM-388 · CENTINELA: medir `main` no revienta ni con huecos del rango', () => {
  // Barrido de humo: números que existen, que no existen y de longitudes distintas. Lo que se
  // sostiene es que ninguno lanza y que todos devuelven un veredicto del conjunto cerrado.
  // `NO_MEDIBLE` es el cuarto y es de otra clase: los tres primeros hablan del TICKET, éste habla
  // del ENTORNO. Está en la lista porque un entorno capado es un resultado legítimo del censo —
  // lo que no es legítimo es que ese caso salga disfrazado de `NADA`.
  const VALIDOS = ['ENTERO', 'PARCIAL', 'NADA', 'NO_MEDIBLE'];
  for (const n of [1, 42, 298, 354, 388, 999, 99999]) {
    const r = censarTicket(n, { raiz: RAIZ });
    assert.ok(VALIDOS.includes(r.veredicto),
      `🔴 SCRUM-${n} devolvió «${r.veredicto}», que no es uno de los tres veredictos`);
    assert.ok(typeof r.porque === 'string' && r.porque.length > 0,
      `🔴 SCRUM-${n} devolvió un veredicto sin motivo: un veredicto sin su evidencia es una opinión`);
  }
});
