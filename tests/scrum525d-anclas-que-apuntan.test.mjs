// ═════════════════════════════════════════════════════════════════════════════════════════════
// SCRUM-525d · UN ANCLA QUE RESUELVE Y APUNTA A OTRA COSA ES PEOR QUE UNA ROTA
//
// La rota se ve. Ésta se lee coherente y se cree.
//
// LO QUE ESTO MIDE, y no medía nadie: un guard de «resuelve» comprueba que el fichero existe y
// que la línea está dentro. Eso lo pasaban las 44 coordenadas de la auditoría fiscal en
// SCRUM-525b — y quince de ellas apuntaban a otro sitio. `prisma/schema.prisma:102-103` afirmaba
// `vf_hash`/`vf_prev_hash` y caía en un comentario sobre HUSOS HORARIOS, a 763 líneas. Quien
// fuera a comprobarla leía algo coherente, que no tenía nada que ver, y se lo creía.
//
// CÓMO SE MIDE SIN ADIVINAR: no se deduce qué dice la frase — deducirlo es lo que produjo un
// verde falso en la propia 525b. El ancla lleva su TESTIGO ESCRITO, con la notación que la
// auditoría ya usaba antes de este guard:
//
//     `src/modules/invoicing/domain/selladoEstado.ts:116` (`sellarTrasEmision`)
//
// El criterio vive en UN solo sitio, `scripts/_anclas-con-testigo.mjs`, y este fichero sólo lo
// ejerce. Las dos cifras se declaran SIEMPRE juntas — cuántas coordenadas hay y cuántas llevan
// testigo —: «0 desfasadas» sin «de cuántas comprobadas» es una frase, no una medida.
//
// NINGÚN UMBRAL ESCRITO A MANO (SCRUM-804): lo único congelado es un conjunto de IDENTIDADES
// (SCRUM-710b), y las únicas comparaciones numéricas son `> 0`, que no afirman una magnitud del
// árbol: dicen «hay población o estoy ciego».
// ═════════════════════════════════════════════════════════════════════════════════════════════
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import {
  analizar, coordenadasDe, veredictoDe, identidad, ficherosDe, dosCifras, POBLACION,
} from '../scripts/_anclas-con-testigo.mjs';
import { PARES_SIN_TESTIGO_CONGELADOS, TESTIGOS_PUESTOS } from '../scripts/_anclas-sin-testigo.congelado.mjs';

/** `documento # ruta # testigo`. La identidad de un testigo es el SÍMBOLO, nunca su línea. */
const triples = (c) => (c.testigo || []).map((t) => `${c.doc} # ${c.ruta} # ${t}`);

/** El par documento↔fichero citado. SIN la línea: es la lección de SCRUM-710b, que tumbó la
 *  primera versión de este guard por congelar identidades con la posición dentro. */
const par = (c) => `${c.doc} # ${c.ruta}`;

const RAIZ = path.resolve(import.meta.dirname, '..');
const YO = path.join(RAIZ, 'tests', 'scrum525d-anclas-que-apuntan.test.mjs');
const R = analizar(RAIZ);

/** Las que llevan testigo y NO apuntan a él, más las que llevan testigo y ni siquiera resuelven. */
const NO_APUNTAN = R.juzgadas.filter((c) => c.estado === 'DESFASADA'
  || (c.testigo && (c.estado === 'AUSENTE' || c.estado === 'FUERA')));

// ═══ ① SUELO — sin esto, un «0 desfasadas» podría ser «no he mirado» ═════════════════════════
test('SCRUM-525d · 🔴 SUELO: el censo ve ficheros, coordenadas y testigos', () => {
  assert.ok(R.ficheros.length > 0, `🔴 CIEGO: 0 ficheros en ${POBLACION}/`);
  assert.ok(R.vivas > 0, '🔴 CIEGO: 0 coordenadas. El extractor no está leyendo nada.');
  assert.ok(R.conTestigo > 0,
    '🔴 CIEGO: 0 coordenadas con testigo. Si nada lleva testigo, este guard no comprueba nada\n'
    + '   y su verde no significa nada. El detector de testigos está roto.');
  assert.ok(R.firmes.length > 0, '🔴 CIEGO: ninguna FIRME — el comprobador no sabe leer ficheros.');
  console.log(`    · POBLACIÓN: ${R.ficheros.length} ficheros de ${POBLACION}/ · ${dosCifras(R)}`);
  console.log(`    · ✅ firmes ${R.firmes.length} · 🔴 desfasadas ${R.desfasadas.length} `
    + `· ⚠️ sin testigo ${R.sinTestigo.length} · ⚠️ sin ruta ${R.sinRuta.length} `
    + `· 🔴 no resuelven ${R.noResuelven.length} · ~~tachadas~~ exentas ${R.tachadas}`);
});

// ═══ ② VERDE REAL — un ancla buena NO salta ═════════════════════════════════════════════════
test('SCRUM-525d · ✅ CONTROL POSITIVO: un ancla que SÍ apunta sale FIRME', () => {
  // Se identifica por TESTIGO, no por línea: el día que `sellarTrasEmision` se mueva, esto sigue
  // encontrándolo. Anclar el control a una posición sería el defecto que el control vigila.
  const buena = R.firmes.find((c) => c.testigo?.includes('sellarTrasEmision'));
  assert.ok(buena, '🔴 no encuentro el ancla de `sellarTrasEmision` entre las firmes.');
  console.log(`    · ✅ ${identidad(buena)} (\`${buena.testigo.join('`, `')}\`) apunta a lo que dice`);
});

// ═══ ③ ROJO REAL — el defecto HISTÓRICO, reproducido ════════════════════════════════════════
//
// No es un caso de laboratorio: hasta SCRUM-525c la auditoría decía `src/lib/invoicing.ts:97` y
// `:228` con testigo `exigirDocumentoEmitible`, y el testigo estaba en la 100 y la 236. El
// fundador lo señaló como control positivo de este bloque. Aquí se rebobina sobre una COPIA.
test('SCRUM-525d · 🔴 CONTROL POSITIVO: el defecto real de la 525b pone el guard en rojo', () => {
  // 🔴 LA FILA SE BUSCA POR SU TESTIGO, NO POR SU LÍNEA. Escribir aquí las coordenadas rotas que
  // tenía ayer («:97 y :228») sería anclar el control por POSICIÓN — el defecto que este mismo
  // fichero vigila, y el que SCRUM-710b prohíbe. Se derivan.
  const TESTIGO = 'exigirDocumentoEmitible';
  const rotas = R.firmes.filter((c) => c.testigo?.includes(TESTIGO));
  assert.ok(rotas.length > 0, `🔴 EL CONTROL NO SE PUEDE EJECUTAR: no hay ninguna fila con el `
    + `testigo \`${TESTIGO}\`. Si la auditoría dejó de tenerla, busca otra fila con DOS citas y el\n`
    + '   mismo testigo — NO borres el control: sin él este guard no prueba que sepa ponerse rojo.');

  const rel = rotas[0].doc;
  let txt = fs.readFileSync(path.join(RAIZ, rel), 'utf8');
  const cache = new Map();
  let mutadas = 0;
  for (const c of rotas) {
    // Un destino que NO lleva el testigo, buscado en el propio fichero citado: así el rojo que se
    // provoca es del mismo tipo que el real —ancla en el fichero bueno, línea que no lo dice—
    // sin que este test escriba ni un número.
    if (!cache.has(c.ruta)) cache.set(c.ruta, fs.readFileSync(path.join(RAIZ, c.ruta), 'utf8').split(/\r?\n/));
    const L = cache.get(c.ruta);
    const destino = L.findIndex((l) => !l.includes(TESTIGO)) + 1;
    assert.ok(destino > 0, `🔴 en ${c.ruta} TODAS las líneas llevan «${TESTIGO}»: no hay dónde mutar.`);
    // La auditoría escribe la segunda cita de una misma fila en forma ABREVIADA (`` `:236` ``),
    // así que hay que probar las dos formas. Que este control abortara al no encontrar la larga
    // es justo lo que se le pide: prefiere pararse a pasar en verde sin haber mutado.
    const larga = [`\`${c.ruta}:${c.a}\``, `\`${c.ruta}:${destino}\``];
    const corta = [`\`:${c.a}\``, `\`:${destino}\``];
    const forma = txt.split(larga[0]).length - 1 > 0 ? larga
      : (txt.split(corta[0]).length - 1 === 1 ? corta : null);
    if (!forma) continue; // escrita de una forma que no sé mutar sin ambigüedad: no se cuenta
    // 🔴 LA MUTACIÓN SE ASEGURA DE HABER MUTADO. En SCRUM-844 una sustitución no casó ni una vez,
    // el fichero quedó intacto y el test siguió verde diciendo que el control había pasado.
    const antes = txt;
    txt = txt.split(forma[0]).join(forma[1]);
    assert.notEqual(txt, antes, `🔴 LA MUTACIÓN NO CASA: ${forma[0]} no está en ${rel}.`);
    mutadas += 1;
  }
  assert.ok(mutadas > 0, '🔴 no se ha mutado ninguna.');

  const juzgadas = coordenadasDe(txt).filter((c) => !c.tachada).map((c) => veredictoDe(c, RAIZ));
  const caidas = juzgadas.filter((c) => c.estado === 'DESFASADA' && c.testigo?.includes(TESTIGO));
  assert.ok(caidas.length >= mutadas,
    `🔴 EL GUARD NO VE EL DEFECTO REAL. Se han movido ${mutadas} anclas de \`${TESTIGO}\` a líneas\n`
    + `   que NO lo contienen y sólo ha marcado ${caidas.length}. Así fue como quince anclas\n`
    + '   pasaron por buenas en SCRUM-525b.');
  console.log(`    · 🔴 ${mutadas} anclas de \`${TESTIGO}\` movidas a una línea que no lo dice `
    + `→ ${caidas.length} desfasadas`);
});

// ═══ ④ MUTACIÓN GENÉRICA — desplazar UNA línea basta para caer ══════════════════════════════
test('SCRUM-525d · 🔴 EL CONTROL QUE DECIDE: mover un ancla buena una línea la pone en rojo', () => {
  const buena = R.firmes.find((c) => c.b === c.a && c.ruta.includes('/'));
  assert.ok(buena, '🔴 no hay ninguna firme de una sola línea con la que mutar.');
  const rel = buena.doc;
  const txt = fs.readFileSync(path.join(RAIZ, rel), 'utf8');
  const viejo = `\`${buena.ruta}:${buena.a}\``;
  const nuevo = `\`${buena.ruta}:${buena.a + 1}\``;

  const veces = txt.split(viejo).length - 1;
  assert.ok(veces > 0, `🔴 LA MUTACIÓN NO CASA: ${viejo} no está en ${rel}. Control inútil.`);
  const mutado = txt.split(viejo).join(nuevo);
  assert.notEqual(mutado, txt, '🔴 la mutación no ha cambiado el texto.');

  const juzgadas = coordenadasDe(mutado).filter((c) => !c.tachada).map((c) => veredictoDe(c, RAIZ));
  const suya = juzgadas.filter((c) => c.ruta === buena.ruta && c.a === buena.a + 1 && c.testigo);
  assert.ok(suya.length > 0, '🔴 tras mutar no encuentro la coordenada desplazada.');
  assert.ok(suya.every((c) => c.estado === 'DESFASADA'),
    `🔴 ${buena.ruta}:${buena.a + 1} debería estar DESFASADA y el guard la da por buena.\n`
    + '   Un guard que no cae al mover el ancla una línea no está comprobando nada.');
  console.log(`    · 🔴 ${identidad(buena)} → :${buena.a + 1} cae, como debe`);
});

// ═══ ⑤ EL GUARD: ninguna coordenada con testigo apunta a otra cosa ══════════════════════════
test('SCRUM-525d · 🔴 toda coordenada CON TESTIGO apunta a lo que dice', () => {
  if (NO_APUNTAN.length) {
    const lista = NO_APUNTAN.map((c) => {
      const donde = c.donde
        ? Object.entries(c.donde).map(([t, n]) => `«${t}» está hoy en ${n.length ? n.join(', ') : 'ningún sitio'}`).join(' · ')
        : `no resuelve (${c.estado})`;
      return `    · ${c.doc}:${c.linea}\n        ${identidad(c)}\n        ${donde}`;
    }).join('\n');
    assert.fail(
      `\n🔴 ${NO_APUNTAN.length} ancla(s) RESUELVEN pero apuntan a otra cosa `
      + `(de ${dosCifras(R)}):\n\n${lista}\n\n`
      + '  CÓMO SE ARREGLA — por orden de coste:\n'
      + '  ① Si el testigo sólo se ha movido de línea, lleva la coordenada a donde está hoy.\n'
      + '     El mensaje de arriba te dice el número: no hay que buscarlo.\n'
      + '  ② Si el testigo aparece VARIAS veces, no es mecánico: decide a cuál apunta la frase\n'
      + '     y ánclalo ahí. El ancla apunta a lo que la frase AFIRMA, y el rango cubre TODO lo\n'
      + '     que afirma — no a lo que está cerca, ni al comentario que lo explica.\n'
      + '  ③ Si la afirmación ya no es cierta, NO se corrige el ancla: se corrige (o se jubila\n'
      + '     diciendo qué pasó) la afirmación. Eso es del autor del documento.\n\n'
      + '  ⛔ Lo que NO vale es borrar el testigo para que esto pase: sería la regla 41 del máster\n'
      + '     (`docs/YAQU_MASTER.md`) leída al revés — arreglar el guard en vez del código. El\n'
      + '     trinquete de abajo lo impide.\n',
    );
  }
  console.log(`    · ✅ 0 desfasadas sobre ${dosCifras(R)}`);
});

// ═══ ⑥ TRINQUETE — el testigo es OBLIGATORIO en lo nuevo ════════════════════════════════════
test('SCRUM-525d · 🔴 TRINQUETE: ninguna coordenada NUEVA sin testigo', () => {
  const sinTestigo = R.juzgadas.filter((c) => !c.testigo);
  assert.ok(sinTestigo.length > 0 || R.vivas === R.conTestigo,
    '🔴 CIEGO: el clasificador no distingue con y sin testigo.');

  const nuevos = [...new Set(sinTestigo.map(par))].filter((p) => !PARES_SIN_TESTIGO_CONGELADOS.has(p));
  if (nuevos.length) {
    const donde = nuevos.map((p) => {
      const c = sinTestigo.find((x) => par(x) === p);
      return `    · ${p}   (${c.doc}:${c.linea})`;
    }).join('\n');
    assert.fail(
      `\n🔴 ${nuevos.length} par(es) documento↔fichero NUEVOS que citan sin testigo en ${POBLACION}/:\n\n`
      + `${donde}\n\n`
      + '  Una coordenada sin testigo no se puede comprobar: resuelve, y nadie sabe si apunta a\n'
      + '  lo que dice. Ponle el testigo, que cuesta lo mismo que escribir la coordenada:\n\n'
      + '      `ruta/fichero.ts:NN` (`elSímboloQueLaFraseAfirma`)\n\n'
      + '  ⛔ Añadir la línea al conjunto congelado NO es la salida: ese conjunto SÓLO ENCOGE.\n'
      + '     Añadirle una entrada es declarar por escrito que la deuda crece.\n',
    );
  }

  // ── El otro lado del trinquete: si ha encogido, SE RECOGE EN EL MISMO COMMIT ──────────────
  //
  // 🔴 SCRUM-927b · HASTA HOY ESTO ERA UN `console.log` Y LA TANDA SEGUÍA VERDE.
  //
  // La intención estaba bien —el cálculo ya estaba escrito, y hasta explicaba cómo recogerlo—,
  // pero su consecuencia acababa en un aviso dentro de una tanda de más de siete mil tests.
  // Nadie lee eso. El censo de SCRUM-927 lo clasificó por lo que hace, no por lo que promete:
  //
  //     🔒 Contar no es avisar — y avisar no es exigir.
  //
  // Ahora lo exige. Lo que cambia NO es la regla —el conjunto sólo encoge, y eso ya estaba
  // escrito en la cabecera de `_anclas-sin-testigo.congelado.mjs`—: lo que cambia es que ahora
  // hay mecanismo detrás. Medido antes de convertir, contra `origin/main` = `a863416b`: cero
  // muertos, así que esto NO destapa deuda de nadie; nace en verde.
  const vivos = new Set(sinTestigo.map(par));
  const muertos = [...PARES_SIN_TESTIGO_CONGELADOS].filter((p) => !vivos.has(p));
  assert.deepEqual(muertos, [],
    `\n🔴 EL CONJUNTO CONGELADO ENCOGIÓ EN ${muertos.length}, Y SUS LÍNEAS SIGUEN DECLARADAS:\n\n`
    + muertos.map((p) => `    · ${p}`).join('\n') + '\n\n'
    + '  QUÉ SIGNIFICA\n'
    + '    Esos pares ya NO citan sin testigo: o se les puso el testigo, o el documento dejó de\n'
    + '    citarlos. Mientras sigan en el conjunto se les perdona una deuda que ya no tienen — y\n'
    + '    el día que alguien vuelva a citarlos sin testigo, el trinquete de arriba lo dejará\n'
    + '    pasar creyendo que es deuda vieja.\n\n'
    + '  CÓMO SE ARREGLA (una línea por par, en este mismo commit)\n'
    + '    Quita esas líneas de `PARES_SIN_TESTIGO_CONGELADOS`, en\n'
    + '    `scripts/_anclas-sin-testigo.congelado.mjs`. El conjunto SÓLO ENCOGE: así no pueden\n'
    + '    volver a entrar por la puerta de atrás.\n\n'
    + '  ⛔ Lo que NO vale es dejarlas «por si acaso»: una excepción que ya no excluye a nadie es\n'
    + '     una puerta abierta con la etiqueta de otro.\n');
  console.log(`    · ✅ 0 pares nuevos sin testigo · congelados ${PARES_SIN_TESTIGO_CONGELADOS.size}`);
});

// ═══ ⑥bis TRINQUETE DE COBERTURA — un testigo puesto NO se puede quitar ════════════════════
//
// 🔴 ESTA ES LA MITAD QUE FALTABA, y la señaló el fundador leyendo la entrega. El trinquete de
// arriba impide que la deuda suba; éste impide que la cobertura BAJE. Sin él, la forma barata de
// apagar un rojo de «esta ancla no apunta a lo que dice» es BORRAR EL TESTIGO: el ancla deja de
// ser comprobable, el guard calla, y el documento queda peor que antes con mejor cara.
//
// Y no es un trinquete de PROPORCIÓN, es de IDENTIDAD, que es más fuerte: una proporción se
// mantiene quitando un testigo aquí y poniendo otro allá, y eso no es lo mismo.
test('SCRUM-525d · 🔴 TRINQUETE DE COBERTURA: un testigo puesto no se quita', () => {
  const vivos = new Set(R.juzgadas.flatMap(triples));
  assert.ok(vivos.size > 0, '🔴 CIEGO: no veo ni un testigo vivo. El extractor está roto.');

  const desaparecidos = [...TESTIGOS_PUESTOS].filter((t) => !vivos.has(t));
  if (desaparecidos.length) {
    assert.fail(
      `\n🔴 ${desaparecidos.length} testigo(s) que estaban puestos han DESAPARECIDO:\n\n`
      + `${desaparecidos.map((t) => `    · ${t}`).join('\n')}\n\n`
      + '  Un testigo que se quita deja su ancla sin poder comprobarse: seguirá resolviendo, y\n'
      + '  nadie volverá a saber si apunta a lo que dice. Ese es el defecto entero de este ticket.\n\n'
      + '  ① Si el símbolo se RENOMBRÓ, pon el nombre nuevo en la cita y actualiza la línea de\n'
      + '     `scripts/_anclas-sin-testigo.congelado.mjs` en este mismo commit: es un cambio de\n'
      + '     nombre, no una pérdida de cobertura.\n'
      + '  ② Si la afirmación desapareció, quita también su línea de ese fichero, y dilo en el\n'
      + '     mensaje del commit.\n\n'
      + '  ⛔ Lo que NO vale es quitar el testigo para que el guard calle: sería arreglar el guard\n'
      + '     en vez del código, que es la regla 41 del máster (`docs/YAQU_MASTER.md`) al revés.\n',
    );
  }
  const nuevos = [...vivos].filter((t) => !TESTIGOS_PUESTOS.has(t));
  if (nuevos.length) {
    console.log(`    · ✅ la cobertura SUBIÓ en ${nuevos.length}: añade estas líneas a `
      + '`scripts/_anclas-sin-testigo.congelado.mjs` en este mismo commit — sólo crece, y así '
      + 'ya no se pueden quitar.');
    for (const t of nuevos.slice(0, 8)) console.log(`        · ${t}`);
  }
  // 🔴 Y LA PRUEBA DE QUE SABE DISPARARSE. Un trinquete sin mutación es una declaración de
  // intenciones: se borra un testigo real sobre una COPIA y se exige que su triple desaparezca.
  const victima = R.juzgadas.find((c) => c.testigo?.length === 1 && c.ruta.includes('/'));
  assert.ok(victima, '🔴 EL CONTROL NO SE PUEDE EJECUTAR: no hay ninguna cita con un solo testigo.');
  const txt = fs.readFileSync(path.join(RAIZ, victima.doc), 'utf8');
  const conTestigo = `(\`${victima.testigo[0]}\`)`;
  const antes = txt.split(conTestigo).length - 1;
  assert.ok(antes > 0, `🔴 LA MUTACIÓN NO CASA: ${conTestigo} no está en ${victima.doc}.`);
  const mutado = txt.split(conTestigo).join('');
  assert.notEqual(mutado, txt, '🔴 la mutación no ha cambiado el texto.');
  const tras = new Set(coordenadasDe(mutado).filter((c) => !c.tachada)
    .flatMap((c) => (c.testigo || []).map((t) => `${victima.doc} # ${c.ruta} # ${t}`)));
  assert.ok(!tras.has(`${victima.doc} # ${victima.ruta} # ${victima.testigo[0]}`),
    `🔴 se ha borrado el testigo \`${victima.testigo[0]}\` y el censo SIGUE viéndolo. Este\n`
    + '   trinquete no protegería nada.');
  console.log(`    · ✅ los ${TESTIGOS_PUESTOS.size} testigos puestos siguen puestos `
    + `· 🔴 borrar \`${victima.testigo[0]}\` lo haría caer`);
});

// ═══ ⑦ NINGÚN UMBRAL ESCRITO A MANO EN ESTE FICHERO (SCRUM-804) ═════════════════════════════
//
// 🔴 AST, NO `grep`: un guard de texto se caza a sí mismo en el párrafo que explica la
// prohibición — ahí arriba están escritos «763 líneas», «44 coordenadas» y «quince».
// El 0 es la única excepción: `x.length > 0` no afirma una magnitud del árbol, dice «hay
// población o estoy ciego».
test('SCRUM-525d · 🔴 NINGÚN UMBRAL DE ESTE FICHERO ESTÁ ESCRITO A MANO', () => {
  const ts = createRequire(import.meta.url)('typescript');
  const fuente = fs.readFileSync(YO, 'utf8');
  const arbol = ts.createSourceFile(YO, fuente, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  const RELACIONALES = new Set([
    ts.SyntaxKind.GreaterThanToken, ts.SyntaxKind.GreaterThanEqualsToken,
    ts.SyntaxKind.LessThanToken, ts.SyntaxKind.LessThanEqualsToken,
  ]);

  const escritos = [];
  let comparaciones = 0;
  const recorrer = (nodo) => {
    if (ts.isBinaryExpression(nodo) && RELACIONALES.has(nodo.operatorToken.kind)) {
      comparaciones += 1;
      for (const lado of [nodo.left, nodo.right]) {
        if (ts.isNumericLiteral(lado) && lado.text !== '0') {
          escritos.push(`${lado.text} en «${nodo.getText().slice(0, 60)}»`);
        }
      }
    }
    ts.forEachChild(nodo, recorrer);
  };
  recorrer(arbol);

  assert.ok(comparaciones > 0, '🔴 CIEGO: el AST no ve ni una comparación en este fichero.');
  assert.equal(escritos.length, 0,
    `🔴 UMBRAL ESCRITO A MANO (SCRUM-804): ${escritos.join(' · ')}\n`
    + '   Un número comparado a mano es una FOTO del árbol el día que se escribió. Lo que se\n'
    + '   congela aquí son IDENTIDADES, no cuentas (SCRUM-710b).');
  console.log(`    · ✅ ${comparaciones} comparaciones, ninguna contra un número escrito a mano`);
});
