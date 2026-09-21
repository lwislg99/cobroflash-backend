// tests/scrum427-composicion-detalle.test.mjs — SCRUM-427 (tramo 2)
//
// EL ENUMERADOR: ¿tiene el detalle del Trabajo las secciones que el diseño de G dice, y sólo ésas?
//
// ═════════════════════════════════════════════════════════════════════════════════════════
// 🔴 ENUMERA, NO CUENTA — y ése es el ticket entero
//
// G4 «salía cuadrado» porque **4 + 5 = 9**: el número de secciones coincidía con el esperado y el
// CONTENIDO no. Un guard que compara longitudes da verde con la composición equivocada **y encima
// tranquiliza**, que es lo peor de las dos cosas. Aquí se comparan CONJUNTOS y el fallo dice las
// dos listas: qué FALTA y qué SOBRA, cada una con sus nombres.
//
// Las dos direcciones no son la misma pregunta:
//   · FALTA  → una promesa del diseño que la pantalla no cumple.
//   · SOBRA  → superficie que nadie diseñó. Puede ser un acierto posterior —y entonces se ENMIENDA
//              el diseño, con cita y fecha— o un descuido que nadie declaró. Las dos salidas son
//              legítimas; lo que no vale es que no se note.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  compararComposicion, seccionesDelDiseno, seccionesPintadas, normalizar,
  ENMIENDAS, SOBRANTES_SIN_DECIDIR, LARGO_MAX,
  lineasDeElTrabajo, textosDeElTrabajo,
} from './_composicion-detalle.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// ── SUELO ────────────────────────────────────────────────────────────────────────────────
//
// «Cero secciones» y «composición correcta» NO pueden dar el mismo verde: si el escáner deja de
// encontrar nada —porque cambia el marcado, porque el fichero se parte, porque el recuadro del
// diseño se reescribe—, un `faltan: [], sobran: []` sería técnicamente cierto y completamente
// hueco. Se exige que las dos fuentes tengan contenido ANTES de comparar nada.

test('SCRUM-427 · 🔴 SUELO: sin secciones que leer, el enumerador se declara CIEGO', () => {
  const diseno = seccionesDelDiseno(RAIZ);
  const pintadas = seccionesPintadas(RAIZ);

  assert.ok(diseno.length >= 3,
    `🔴 el diseño de G ha devuelto ${diseno.length} secciones. O el recuadro de §4 cambió de forma, ` +
    'o el extractor dejó de entenderlo. Comparar contra una lista vacía daría verde siempre.');
  assert.ok(pintadas.length >= 4,
    `🔴 sólo se han encontrado ${pintadas.length} secciones pintadas en jobDetailView.js. Un ` +
    'escáner que no ve la pantalla no puede afirmar que la pantalla está bien.');
});

test('SCRUM-427 · 🔴 SUELO: el escáner no se desborda y coge código por rótulo', () => {
  // Éste no es teórico: el primer patrón casó con la ASIGNACIÓN `h.className =
  // 'detail-section-title';` y se comió 300 líneas de código como si fueran el nombre de una
  // sección. Un escáner que devuelve basura ensucia el veredicto y sigue pareciendo que mide.
  for (const s of seccionesPintadas(RAIZ)) {
    assert.ok(s.length <= LARGO_MAX,
      `🔴 el rótulo «${s.slice(0, 60)}…» tiene ${s.length} caracteres: el patrón se ha desbordado ` +
      'y está capturando código, no títulos.');
  }
});

// ── EL ENUMERADOR ────────────────────────────────────────────────────────────────────────

test('SCRUM-427 · la composición del detalle CUADRA con el diseño de G — enumerando', () => {
  const r = compararComposicion(RAIZ);

  assert.deepEqual(r.faltan, [],
    `🔴 EL DISEÑO PIDE SECCIONES QUE LA PANTALLA NO TIENE: ${r.faltan.join(', ')}.\n\n` +
    `   diseño (§4): ${r.diseno.join(' · ')}\n` +
    `   pantalla   : ${r.pintadas.join(' · ')}\n\n` +
    '   O se construye lo que falta, o se enmienda el diseño diciendo por qué ya no se quiere.');

  assert.deepEqual(r.sobran, [],
    `🔴 LA PANTALLA PINTA SECCIONES QUE EL DISEÑO NO LISTA Y NADIE HA DECLARADO: ${r.sobran.join(', ')}.\n\n` +
    `   diseño (§4): ${r.diseno.join(' · ')}\n` +
    `   pantalla   : ${r.pintadas.join(' · ')}\n\n` +
    '   No es necesariamente un error —puede ser una decisión posterior y mejor—, pero tiene que\n' +
    '   estar DICHA: enmienda en `docs/diseno/bloque-g.md` §4 con su cita y su fecha, o entrada en\n' +
    '   `SOBRANTES_SIN_DECIDIR` mientras se decide. Lo que no vale es que aparezca en silencio.');
});

test('SCRUM-427 · CONTROL POSITIVO: las cuatro del diseño están, una a una', () => {
  // Sin esto, «faltan: []» podría venir de un diseño que no se supo leer. Se nombran las cuatro.
  const { diseno, pintadas } = compararComposicion(RAIZ);
  // SCRUM-917f: «que falta para cobrar» → «lo que falta». El rótulo viejo afirmaba algo falso en
  // un Trabajo PAGADO con un albarán sin firmar: la tarjeta contesta a DOS preguntas y sólo
  // nombraba una. Enmendado en `docs/diseno/bloque-g.md` §5 con su motivo, y firmado (com. 15881).
  // Esta lista está escrita a mano A PROPÓSITO: derivarla del diseño haría que un renombrado en el
  // documento se propagara solo y este control dejaría de controlar nada.
  for (const s of ['lo que falta', 'albaranes', 'gastos', 'notas internas']) {
    assert.ok(diseno.includes(s), `🔴 «${s}» ya no se lee del §4 del diseño.`);
    assert.ok(pintadas.some((p) => p.includes(s) || s.includes(p)), `🔴 «${s}» no se pinta.`);
  }
});

// ── SCRUM-917g · LAS LÍNEAS DE «EL TRABAJO» ───────────────────────────────────────────────

test('SCRUM-917g · CONTROL POSITIVO: las cinco líneas de «El trabajo» se leen de la vista, en su orden', () => {
  // Escrito a mano A PROPÓSITO (como el de arriba): derivar la lista esperada de la misma vista que se
  // juzga la haría cierta por construcción. El orden es el del prototipo aprobado.
  const js = fs.readFileSync(path.join(RAIZ, 'public/dashboard/js/jobDetailView.js'), 'utf8');
  const lineas = lineasDeElTrabajo(js, textosDeElTrabajo(RAIZ));
  assert.deepEqual(
    lineas.map((l) => normalizar(l.rotulo)),
    ['tipo de trabajo', 'nombre y direccion', 'quien lo ejecuta', 'notas internas', 'gastos de este trabajo'],
    '🔴 las líneas que la vista cuelga de la tarjeta «El trabajo» no son las cinco del prototipo, en su ' +
    'orden. Si falta una, o el escáner dejó de ver la tarjeta (`construirBloqueElTrabajo`) o se retiró una ' +
    'sección sin decisión; si sobra, hay una sección nueva sin declarar.');
  // Y todas caen bajo el enumerador: ninguna se queda fuera de `seccionesPintadas`.
  const pintadas = seccionesPintadas(RAIZ);
  for (const l of lineas) {
    assert.ok(pintadas.includes(normalizar(l.rotulo)),
      `🔴 la línea «${l.rotulo}» se cuelga de la tarjeta pero no entra en la composición enumerada.`);
  }
});

test('SCRUM-917g · el enumerador cuenta SÓLO las líneas que se cuelgan de la tarjeta', () => {
  // Fuente fabricada: dos líneas construidas, UNA colgada. La no colgada no se pinta y contarla sería
  // contar lo que nadie ve. Y sin tarjeta no hay líneas: el suelo de arriba lo declararía ciego.
  const textos = { rotuloA: 'Línea colgada', rotuloB: 'Línea suelta' };
  const fuente = [
    "const lineaA = construirLineaPlegable(document, { clave: 'a', rotulo: textosTrabajo.rotuloA });",
    "const lineaB = construirLineaPlegable(document, { clave: 'b', rotulo: textosTrabajo.rotuloB });",
    'body.appendChild(construirBloqueElTrabajo(document, [lineaA]));',
  ].join('\n');
  assert.deepEqual(lineasDeElTrabajo(fuente, textos), [{ clave: 'a', rotulo: 'Línea colgada' }],
    '🔴 el enumerador no distingue una línea colgada de una construida y suelta.');
  assert.deepEqual(lineasDeElTrabajo('const x = 1;', textos), [],
    '🔴 sin tarjeta debe devolver VACÍO, no inventar líneas.');
  // Un rótulo que el módulo de textos no tiene no se inventa: se descarta (y el suelo lo notaría).
  assert.deepEqual(lineasDeElTrabajo(fuente.replace('[lineaA]', '[lineaA, lineaB]'), { rotuloA: 'Línea colgada' }),
    [{ clave: 'a', rotulo: 'Línea colgada' }],
    '🔴 el enumerador inventa un rótulo que `TEXTOS_EL_TRABAJO` no tiene.');
});

// ── LAS EXCEPCIONES, VIGILADAS ───────────────────────────────────────────────────────────

test('SCRUM-427 · CADA enmienda está EN EL DISEÑO con su cita, no sólo tolerada aquí', () => {
  // Una excepción que sólo vive en el guard es invisible para quien lee el diseño. Tiene que estar
  // EN el documento, y esto lo comprueba leyéndolo — una por una, no «alguna».
  const md = fs.readFileSync(path.join(RAIZ, 'docs/diseno/bloque-g.md'), 'utf8');
  assert.match(md, /ENMIENDA/i, '🔴 el diseño no declara ninguna enmienda.');

  for (const [nombre, d] of Object.entries(ENMIENDAS)) {
    const ticket = /SCRUM-\d+/.exec(d.fuente);
    assert.ok(ticket, `🔴 la enmienda «${nombre}» no apunta a un ticket.`);
    assert.ok(md.includes(ticket[0]),
      `🔴 la enmienda de «${nombre}» cita ${ticket[0]} en el guard pero el diseño no lo menciona: ` +
      'quien lea el documento no sabrá por qué esa sección está ahí.');
    assert.ok(d.motivo && d.motivo.length > 30, `🔴 «${nombre}» no declara su motivo.`);
  }
});

test('SCRUM-427 · una enmienda con PREGUNTA ABIERTA no la da por zanjada', () => {
  // «Tipo de trabajo» se incluye en §4, pero su §7·5 —«qué es y qué gobierna»— sigue SIN
  // CONTESTAR. Enmendar sin arrastrar la pregunta la cerraría de tapadillo, y una pregunta cerrada
  // sin respuesta es peor que una abierta: nadie vuelve a mirarla.
  const abierta = ENMIENDAS['tipo de trabajo'];
  assert.ok(abierta, '🔴 «tipo de trabajo» ya no está enmendada.');
  assert.ok(abierta.preguntaAbierta && /§7/.test(abierta.preguntaAbierta),
    '🔴 la enmienda de «tipo de trabajo» ha perdido su pregunta abierta (§7·5).');

  const md = fs.readFileSync(path.join(RAIZ, 'docs/diseno/bloque-g.md'), 'utf8');

  // ⚠️ SE BUSCA DENTRO DEL BLOQUE DE LA ENMIENDA, no en el documento entero, y esto lo enseñó la
  // prueba de rojo: al quitar la cita del blockquote el test SEGUÍA VERDE, porque «§7·5» aparece
  // también en el §7 original y en la prosa de al lado. Un patrón que puede satisfacerse desde
  // cualquier otra parte del fichero no comprueba que la enmienda cite nada.
  const bloque = /## 🔴 ENMIENDA a §4[\s\S]*?(?=\n# )/.exec(md);
  assert.ok(bloque, '🔴 no se encuentra el bloque de la enmienda en el diseño.');
  const texto = bloque[0];

  assert.match(texto, /§7\s*·\s*5\.?\*\*/,
    '🔴 la ENMIENDA ya no cita §7·5. La pregunta tiene que seguir viva dentro de la enmienda: si ' +
    'sólo vive en el §7 original, quien lea por qué se incluyó la sección no verá que sigue abierta.');
  assert.match(texto, /qué gobierna/,
    '🔴 la enmienda no reproduce la pregunta literal del §7·5.');
  assert.match(texto, /FISCAL/,
    '🔴 la enmienda no dice que «Tipo de trabajo» gobierna un campo FISCAL, que es el motivo de ' +
    'fondo para no plegarla mientras la pregunta siga abierta.');
});

test('SCRUM-427 · TRINQUETE: nada esperando decisión sin que se note', () => {
  const r = compararComposicion(RAIZ);
  // Igualdad, no «≤». Hoy la lista está VACÍA porque las dos que aparecieron se enmendaron; el
  // mecanismo se queda montado para la siguiente. Si algo entra aquí y nadie lo mira, este test
  // sigue verde —es su sitio legítimo—, pero si aparece una sección que NO está ni enmendada ni
  // declarada, el enumerador de arriba cae. Los dos juntos no dejan hueco.
  assert.deepEqual(
    r.pendientesPresentes.sort(), Object.keys(SOBRANTES_SIN_DECIDIR).sort(),
    '🔴 la lista de sobrantes SIN DECIDIR ya no coincide con la realidad: si has retirado una ' +
    'sección, quítala de `SOBRANTES_SIN_DECIDIR` en el mismo commit — una excepción que sobrevive ' +
    'a lo que excepcionaba es una excepción que nadie retiró.');

  // Y si alguna vuelve a haber, tiene que decir de dónde sale y qué falta decidir.
  for (const [nombre, d] of Object.entries(SOBRANTES_SIN_DECIDIR)) {
    assert.ok(d.origen && d.origen.length > 30, `🔴 «${nombre}» no declara su origen.`);
    assert.ok(d.pendiente && d.pendiente.includes('?'), `🔴 «${nombre}» no dice qué hay que decidir.`);
  }
});

test('SCRUM-427 · una enmienda que autoriza algo que ya NO se pinta, se caza', () => {
  const r = compararComposicion(RAIZ);
  assert.deepEqual(r.enmendadasNoPintadas, [],
    `🔴 hay enmiendas que autorizan secciones inexistentes: ${r.enmendadasNoPintadas.join(', ')}. ` +
    'Una excepción que sobrevive a lo que excepcionaba deja de ser una decisión y pasa a ser ruido.');
});

// ── LA MICROCOPY APROBADA ────────────────────────────────────────────────────────────────

test('SCRUM-427 · el rótulo es «Notas internas», sin emoji', () => {
  // ── RE-ANCLAJE (SCRUM-917g) ────────────────────────────────────────────────────────────
  // Este test leía el rótulo de un `<h3 class="detail-section-title">Notas internas</h3>` escrito
  // en la vista. 917g mete «Notas internas» como LÍNEA de la tarjeta «El trabajo»: el rótulo ya no
  // es marcado, es `TEXTOS_EL_TRABAJO.rotuloNotas`, y la vista lo cuelga con `construirLineaPlegable`.
  // Desaparece una SUPERFICIE (el `<h3>`); el PRINCIPIO no: «el rótulo aprobado es «Notas internas»
  // a secas, sin emoji, y ninguna sección lo lleva». Se lee ahora por el camino nuevo —el AST de la
  // vista, que dice cuál es la línea de notas, y la fuente única, que dice su rótulo— y se conserva
  // la comprobación exacta. Se re-ancla, no se borra: borrarlo dejaría al rótulo sin vigilar.
  const js = fs.readFileSync(path.join(RAIZ, 'public/dashboard/js/jobDetailView.js'), 'utf8');
  const lineas = lineasDeElTrabajo(js, textosDeElTrabajo(RAIZ));
  const notas = lineas.find((l) => l.clave === 'notas');
  assert.ok(notas, '🔴 no se encuentra la línea de notas en la tarjeta «El trabajo».');
  assert.equal(notas.rotulo.trim(), 'Notas internas',
    '🔴 la microcopy aprobada (10-ago-2026) es «Notas internas» a secas. Entró con un 📝 delante y ' +
    'ninguna de las otras seis secciones del detalle lleva emoji: rompía el registro de la pantalla.');

  // Y ninguna sección del detalle lleva emoji en su título — la regla, no sólo este caso.
  for (const s of seccionesPintadas(RAIZ)) {
    assert.ok(!/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(s), `🔴 «${s}» lleva emoji en el título.`);
  }
});
