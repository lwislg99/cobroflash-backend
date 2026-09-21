// tests/scrum427-notas-internas-detalle.test.mjs — SCRUM-427 (G4)
//
// LA NOTA DEL TRABAJO SE VE Y SE ESCRIBE DESDE EL DETALLE, Y NO SE INVENTA OTRO SITIO DONDE VIVA.
//
// ── LO QUE MIDIÓ EL PASO 0, Y REENCUADRÓ EL TICKET ──────────────────────────────────────────
// El ticket decía «NOTAS INTERNAS no existe en el detalle del Trabajo». Medido antes de escribir
// una línea: **el almacenamiento ya existía, y estaba enchufado de punta a punta menos la
// pantalla.** `Job.notes` se persiste, la API lo devuelve (`jobs.routes.ts:250`), se escribe por
// `PATCH` con tope de 2.000 y gate POR CAMPO (SCRUM-120, que se lo da al operario a propósito), y
// hasta viaja al calendario dentro del `DESCRIPTION:` del `.ics`.
//
// Y ya había un editor: **en la LISTA de trabajos**. Así que el defecto real no era «no existen las
// notas», era que **la nota que escribes desde la lista es invisible desde la pantalla donde
// trabajas**, y quien abre el detalle no tiene forma de saber que existe.
//
// Por eso este guard vigila DOS cosas que se pueden romper por separado: que la sección esté, y que
// siga escribiendo en `Job.notes` en vez de en un sitio nuevo.
//
// Sin gate: lee los ficheros de la vista. Vanilla, sin navegador.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
// ⚠️ SIN COMENTARIOS. La primera versión de este guard SE CAZÓ A SÍ MISMA: la sección lleva escrito
// en su cabecera por qué NO toca `Quote.internalNotes`, y un guard de texto no distingue la
// prohibición de su explicación (SCRUM-203). Es la quinta vez que muerde en este repo.
import { soloEjecutable } from './_guard-texto.mjs';
import { lineasDeElTrabajo, textosDeElTrabajo } from './_composicion-detalle.mjs';

const RAIZ = path.resolve(import.meta.dirname, '..');
const VISTA = path.join(RAIZ, 'public/dashboard/js/jobDetailView.js');
const REPARTO = path.join(RAIZ, 'public/dashboard/js/jobDocsReparto.js');

function leer(p) {
  try {
    return fs.readFileSync(p, 'utf8');
  } catch (e) {
    assert.fail(
      `🔴 no se pudo leer ${p} (${e && e.code ? e.code : e}).\n\n`
      + '  «La sección está» y «no supe leer la vista» son el mismo verde.');
  }
}

test('SCRUM-427 · SUELO: se está leyendo el detalle del Trabajo de verdad', () => {
  // Sin esto, renombrar o vaciar el fichero dejaría todo lo de abajo pasando sobre una cadena
  // vacía, y «la sección de notas está» no significaría nada.
  const s = leer(VISTA);
  assert.ok(s.length > 20000, `🔴 la vista tiene ${s.length} caracteres: no es el detalle del Trabajo`);
  assert.match(s, /detail-section-title/, '🔴 esto no es la vista de detalle');
});

test('SCRUM-427 · la sección de notas se PINTA en el detalle', () => {
  const s = leer(VISTA);
  // ── RE-ANCLAJE (SCRUM-917g) ────────────────────────────────────────────────────────────
  // El ancla era `pintarNotasInternas(body, job)` y hoy la llamada es `pintarNotasInternas(
  // lineaNotas.cuerpo, job)`: se pinta DENTRO de la línea «Notas internas» de «El trabajo», no
  // en el cuerpo suelto. Peor: el ancla viejo seguía casando, pero con la DEFINICIÓN de la función
  // (`function pintarNotasInternas(body, job)`), no con ninguna llamada — es decir, este test llevaba
  // pasando por casualidad desde que la llamada cambió, y habría pasado también si nadie la llamara.
  // Se exige ahora una LLAMADA (cualquier primer argumento, que no sea la declaración) y se conserva
  // la otra mitad: la función existe.
  assert.match(s, /(?<!function )pintarNotasInternas\([\w.]+, job\)/,
    '🔴 la sección de notas no se llama desde el detalle (una LLAMADA, no la declaración).\n\n'
    + '  Declararla y no pintarla es peor que no tenerla: el contrato dice que existe y la pantalla\n'
    + '  no la enseña, que es exactamente lo que este ticket vino a arreglar.');
  assert.match(s, /function pintarNotasInternas/, '🔴 la función ya no existe');
  assert.match(s, /dataset\.seccion = 'notas'/,
    '🔴 la sección no se marca como `notas`: el reparto de secciones no puede encontrarla');
});

test('SCRUM-427 · escribe en `Job.notes`, NO en un almacenamiento nuevo', () => {
  // 🔴 EL TEST QUE JUSTIFICA HABER MEDIDO ANTES. Si alguien «arregla» esto creando un campo o una
  // tabla de notas, habrá dos verdades del mismo trabajo: la de la lista y la del detalle. Y la
  // que se vea dependerá de por dónde entres.
  const s = leer(VISTA);
  assert.match(s, /job\.notes/,
    '🔴 la sección no lee `job.notes`. Si lee otra cosa, se ha creado un segundo sitio donde viven '
    + 'las notas del mismo trabajo — y la lista seguirá enseñando la otra.');
  assert.match(s, /method: 'PATCH'[^\n]*notes: ta\.value|notes: ta\.value/,
    '🔴 no se guarda `notes` por el mismo camino que ya existe (`PATCH /admin/jobs/:id`)');
  // Y que NO haya aparecido un campo inventado.
  //
  // RESPALDO de la negación (SCRUM-237): antes de afirmar «aquí no aparece `internalNotes`» hay que
  // demostrar que el detector SABRÍA verlo. Se prueba sobre Presupuestos, que sí lo usa: si el
  // extractor no lo encuentra ahí, su silencio sobre el detalle no significa nada.
  const conNotasDeQuote = soloEjecutable(leer(path.join(RAIZ, 'public/dashboard/js/quotesDetailView.js')));
  assert.match(conNotasDeQuote, /internalNotes/,
    '🔴 el detector no encuentra `internalNotes` ni donde SÍ está (Presupuestos): está ciego, y '
    + 'entonces el «no aparece en el detalle» de abajo es un verde vacío');
  assert.ok(
    !/internalNotes/.test(soloEjecutable(s)),
    '🔴 el detalle del Trabajo está tocando `internalNotes`, que son las notas del PRESUPUESTO.\n\n'
    + '  Son otra cosa: dos trabajos del mismo presupuesto compartirían esa nota, y además esa\n'
    + '  pantalla es de otro carril.');
});

test('SCRUM-427 · no se guarda si la nota NO ha cambiado', () => {
  // Abrir el detalle y cerrarlo mandaría un PATCH por cada visita: escrituras que nadie pidió sobre
  // un campo que otra pantalla también toca. La lista ya lo hace así; hacerlo distinto aquí sería
  // que el mismo campo se comportara de dos maneras según por dónde entres.
  const s = leer(VISTA);
  assert.match(s, /if \(\(job\.notes \|\| ''\) === ta\.value\) return;/,
    '🔴 el guardado no comprueba si la nota cambió: cada visita al detalle escribiría en la base');
});

/**
 * El rótulo COMPLETO de la sección de notas de una pantalla.
 *
 * 🔴 SUELO, y aquí es fácil que muerda: **comparar dos cosas que no encontraste da igualdad
 * trivial**. Si el extractor devolviera `undefined` en las dos pantallas, `assert.equal` pasaría
 * tan contento y el guard diría «coinciden» sin haber leído ninguna. «Coinciden» y «no supe leer
 * uno de los dos» no pueden dar el mismo verde, así que esto LANZA en vez de devolver vacío.
 */
function rotuloDeNotas(fuente, dondeDice) {
  const m = /<h3[^>]*class="detail-section-title"[^>]*>([^<]*Notas[^<]*)</.exec(fuente);
  assert.ok(m, `🔴 CIEGO: no se encuentra el rótulo de la sección de notas en ${dondeDice}. Sin ` +
    'los dos rótulos no se puede afirmar que coincidan — comparar dos cosas que no se han leído ' +
    'da igualdad trivial, que es el verde más peligroso de este fichero.');
  return m[1].trim();
}

/**
 * SCRUM-917g · el rótulo de la línea de notas de la tarjeta «El trabajo», leído por el camino nuevo.
 * Mismo suelo que `rotuloDeNotas`: si no lo encuentra, LANZA — no devuelve vacío.
 */
function rotuloDeNotasDelTrabajo(fuenteVista) {
  const textos = textosDeElTrabajo(RAIZ);
  const notas = lineasDeElTrabajo(fuenteVista, textos).find((l) => l.clave === 'notas');
  assert.ok(notas && notas.rotulo,
    '🔴 CIEGO: no se encuentra la línea de notas en la tarjeta «El trabajo» del detalle. Sin los dos ' +
    'rótulos no se puede afirmar que coincidan — comparar dos cosas que no se han leído da igualdad ' +
    'trivial, que es el verde más peligroso de este fichero.');
  return notas.rotulo.trim();
}

test('SCRUM-427 · la microcopy es la MISMA que ya usa Presupuestos, literal', () => {
  // Regla 30: no se inventa microcopy. Aquí no hacía falta — la sección de notas ya existe en
  // Presupuestos con su rótulo, su píldora y su placeholder aprobados. Que las dos pantallas digan
  // lo mismo con las mismas palabras es la mitad del trabajo.
  const detalle = leer(VISTA);
  const presupuestos = leer(path.join(RAIZ, 'public/dashboard/js/quotesDetailView.js'));

  // ⚠️ EL RÓTULO NO SE COMPARA POR `includes` — SE EXTRAE DE LAS DOS PANTALLAS Y SE EXIGE IGUALDAD.
  //
  // 🔴 Y ésta es la parte que cierra el asunto, así que conviene entenderla entera:
  //
  // El guard original listaba el literal `'📝 Notas internas'` **con emoji** y lo exigía en las dos
  // pantallas. Cuando la microcopy aprobada dejó el rótulo del detalle en «Notas internas» a secas,
  // hubo que aflojar esa comparación a `'Notas internas'` para que pasara — y ahí quedó el agujero:
  //
  //     '📝 Notas internas'.includes('Notas internas')  →  true
  //
  // Con la lista aflojada, **una pantalla con emoji y la otra sin él PASAN LAS DOS**. Es decir, el
  // guard se relajó para dejar pasar un cambio y se quedó más ciego de lo que estaba. Restaurar la
  // lista no arregla eso: mientras se compare una SUBCADENA común, la divergencia del adorno es
  // invisible por construcción.
  //
  // Por eso ahora se saca el rótulo COMPLETO de cada fichero y se comparan entre sí. Es más
  // estricto que el guard original —él comparaba contra un literal escrito aquí; esto compara las
  // dos pantallas de verdad, una contra otra— y no hay literal que mantener: el día que la copy
  // cambie, cambia en los dos sitios o esto cae.
  // RE-ANCLAJE (SCRUM-917g): el rótulo del detalle ya no es un `<h3>` escrito en la vista, es la línea
  // «Notas internas» de «El trabajo»; se lee por el camino nuevo, con el mismo suelo.
  const rotuloDetalle = rotuloDeNotasDelTrabajo(detalle);
  const rotuloPresupuestos = rotuloDeNotas(presupuestos, 'Presupuestos');

  assert.equal(
    rotuloDetalle, rotuloPresupuestos,
    `🔴 LAS DOS PANTALLAS ROTULAN DISTINTO la misma sección.\n\n` +
    `   detalle del Trabajo : «${rotuloDetalle}»\n` +
    `   Presupuestos        : «${rotuloPresupuestos}»\n\n` +
    '   El mismo concepto con dos rótulos distintos se lee como dos cosas distintas, y la microcopy\n' +
    '   no se inventa (regla 30). Si uno de los dos tiene que cambiar, cambian LOS DOS — y con\n' +
    '   aprobación. ⚠️ Ojo con «arreglarlo» comparando sólo un trozo común: eso es exactamente lo\n' +
    '   que dejó pasar el emoji de más en una sola pantalla.');

  // Y el rótulo aprobado es ése, no cualquier par que coincida: dos pantallas pueden estar de
  // acuerdo en algo que nadie aprobó.
  assert.equal(rotuloDetalle, 'Notas internas',
    '🔴 el rótulo aprobado (10-ago-2026) es «Notas internas» a secas, sin emoji ni adornos.');

  // ── RE-ANCLAJE (SCRUM-917g) ──────────────────────────────────────────────────────────
  // Este bucle exigía DOS textos iguales en las dos pantallas: la píldora y el placeholder. Con la
  // tarjeta «El trabajo» cambian de sitio los dos, y uno de ellos cambia de TEXTO por una firma:
  //
  //   · LA PÍLDORA «Solo tú las ves» sigue siendo LA MISMA en las dos pantallas, pero en el detalle
  //     ya no vive en la vista: es el valor cerrado de la línea (`TEXTOS_EL_TRABAJO.notasPrivadas`).
  //     La igualdad se conserva, leyendo del sitio nuevo.
  //   · EL PLACEHOLDER ya NO es el de Presupuestos, A PROPÓSITO: el fundador firmó otro para esta
  //     pantalla (SCRUM-917, com. 15881; ficha `docs/microcopy/2026-09-21-SCRUM-917g-el-trabajo-
  //     plegable.md`). El principio de la regla 30 no se mueve —«ningún texto sin firma»— y por eso
  //     esta divergencia se DECLARA aquí, con su firma, en vez de quedar como una excepción muda:
  //     se exige que el literal del detalle sea EXACTAMENTE el firmado y que el viejo no siga en el
  //     código del detalle (dos marcadores en la misma pantalla serían uno sin firma).
  const textos = textosDeElTrabajo(RAIZ);
  assert.ok(presupuestos.includes('Solo tú las ves'),
    '🔴 PREMISA ROTA: «Solo tú las ves» ya no está en Presupuestos, así que este guard estaría comparando '
    + 'contra algo que se fue. Si la microcopy cambió allí, decide si cambia en los dos sitios.');
  assert.equal(textos.notasPrivadas, 'Solo tú las ves',
    '🔴 la píldora de privacidad del detalle no coincide con la de Presupuestos.\n\n'
    + '  El mismo concepto contado con dos palabras distintas en dos pantallas se lee como dos\n'
    + '  cosas distintas. Y la microcopy no se inventa (regla 30).');

  assert.equal(textos.marcadorNotas, 'Lo que necesites recordar de este trabajo.',
    '🔴 el placeholder de las notas del detalle no es el firmado (SCRUM-917 com. 15881). Si el texto '
    + 'cambia, cambia con firma: no se «vuelve» al de Presupuestos por comodidad.');
  assert.match(soloEjecutable(detalle), /ta\.placeholder = TEXTOS_EL_TRABAJO\.marcadorNotas/,
    '🔴 el detalle no lee su placeholder de la fuente única `TEXTOS_EL_TRABAJO.marcadorNotas`.');
  assert.ok(!soloEjecutable(detalle).includes('Anota detalles del trabajo, acuerdos verbales'),
    '🔴 ha vuelto al detalle el placeholder de Presupuestos: son dos marcadores en la misma pantalla y '
    + 'el que no es el firmado no tiene firma.');
  assert.ok(fs.existsSync(path.join(RAIZ, 'docs/microcopy/2026-09-21-SCRUM-917g-el-trabajo-plegable.md')),
    '🔴 falta la ficha de microcopy de SCRUM-917g (docs/microcopy/): el texto firmado no está registrado.');
});

test('SCRUM-427 · `notas` está declarada en el contrato de secciones, y la ÚLTIMA', () => {
  // El contrato es donde se mira qué secciones existen. Una sección que se pinta y no está
  // declarada es una sección que nadie sabe que está.
  const s = leer(REPARTO);
  const m = /const SECCIONES_CUERPO = \[([^\]]*)\]/.exec(s);
  assert.ok(m, '🔴 no se encuentra `SECCIONES_CUERPO`: el contrato se movió o se fue');
  const lista = m[1].split(',').map((x) => x.trim().replace(/^'|'$/g, ''));
  assert.ok(lista.includes('notas'), '🔴 `notas` no está declarada en el contrato de secciones');
  assert.equal(lista[lista.length - 1], 'notas',
    '🔴 `notas` no va la última. Las otras son pasos del ciclo del dinero —qué falta, entregado, '
    + 'facturado— y ésta no es un paso: es contexto. En medio rompe la lectura del ciclo.');
});
