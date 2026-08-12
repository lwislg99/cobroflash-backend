// tests/scrum494-export-que-sobra.test.mjs — SCRUM-494 · el guard deja de aconsejar mal.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// 🔴 QUÉ IMPIDE ESTO
//
// El fichero de declaraciones se llena de ayudantes de test **porque el guard lo aconseja**, y
// entonces deja de señalar lo que importa. El caso real: el trinquete cazó `metodoDeclarado`
// minutos después de nacer —la detección es buena y NO se toca— y le dijo que lo DECLARARA. La
// respuesta correcta era **quitarle el `export`**: su consumidor real estaba dentro de su módulo y
// de fuera solo entraba su test.
//
// El mensaje de un guard no es documentación: **es la instrucción que la siguiente persona va a
// ejecutar.** Un guard que caza bien y aconseja mal convierte su acierto en deuda.
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {
  censar, clasificador, consejoPara, autoprueba, SUBCATEGORIA, ORDEN_DE_PREGUNTAS,
} from './_export-que-sobra.mjs';
import { paresDeclarados } from './_huerfanos-declarados.mjs';

const RAIZ = path.resolve(import.meta.dirname, '..');
const PARES = [...paresDeclarados().keys()];
const C = censar(RAIZ, PARES);

// ── 🔴 AUTOPRUEBA · antes de creerse ningún número ──────────────────────────────────────

test('SCRUM-494 · 🔴 AUTOPRUEBA: el discriminante separa los cuatro casos sobre fuente sintética', () => {
  const a = autoprueba();
  assert.ok(a.caeElQueSobra,
    '🔴 un export con USO INTERNO cuyo único importador de fuera es su test NO cae en la ' +
    'sub-categoría. Ése es exactamente el caso de `metodoDeclarado`, y es el que este ticket existe ' +
    'para saber aconsejar.');
  assert.ok(a.noCaeElDeProduccion,
    '🔴 cae un export que SÍ importa producción. Aconsejar quitarle el `export` rompería el build: ' +
    'es el error más caro que puede cometer este guard.');
  assert.ok(a.noCaeElMotorEnEspera,
    '🔴 cae un export SIN uso interno cuyo único importador es su test. Ésos suelen ser MOTORES ' +
    'ESPERANDO CABLE —`avanzar` está declarado así, con esas palabras, en `docs/master/SCRUM-475.md` ' +
    '§6— y quitarles el `export` les cerraría la puerta.');
  assert.ok(a.noCaeElQueNoUsaNadie,
    '🔴 cae un export que no usa su módulo y no importa nadie. Ése no tiene test que lo sostenga: ' +
    'por qué existe es una pregunta del otro eje, no de éste.');
});

test('SCRUM-494 · 🔴 AUTOPRUEBA DEL ORDEN: la clasificación DEPENDE del orden, y el orden es un dato', () => {
  // CANON: en una taxonomía, lo que cumple dos criterios cae en el primero que se pregunte. Si al
  // invertir las preguntas la clasificación NO cambiara, el orden no sería parte de la definición
  // y la decisión de los fundadores no estaría implementada, solo escrita.
  const a = autoprueba();
  assert.equal(a.conOrdenCanonico, 'USO_INTERNO',
    '🔴 con el orden canónico, un export que cumple LOS DOS criterios tiene que caer en ' +
    '«uso interno»: es lo que decidieron los fundadores el 12-ago-2026, y es lo que hace que ' +
    '`metodoDeclarado` no acabe clasificado como motor en espera.');
  assert.equal(a.conOrdenInvertido, 'SOLO_SU_TEST',
    '🔴 invirtiendo las dos preguntas tendría que caer en la otra casilla.');
  assert.ok(a.elOrdenMandaDeVerdad,
    '🔴 LA CLASIFICACIÓN NO DEPENDE DEL ORDEN, y tiene que depender. Si sale lo mismo preguntando ' +
    'en cualquier orden, `ORDEN_DE_PREGUNTAS` es decorativo y el siguiente refactor lo cambiará sin ' +
    'que nadie se entere — que es justo lo que este array de datos existe para impedir.');
});

test('SCRUM-494 · el orden vive como DATO, con su motivo escrito', () => {
  assert.deepEqual(ORDEN_DE_PREGUNTAS.map((q) => q.id),
    ['CON_PRODUCCION', 'USO_INTERNO', 'SOLO_SU_TEST', 'SIN_NADIE'],
    '🔴 ha cambiado el orden de las preguntas. Es parte de la DEFINICIÓN de la taxonomía, no un ' +
    'detalle de implementación: cambiarlo reclasifica exports en silencio.');
  for (const q of ORDEN_DE_PREGUNTAS) {
    assert.ok(q.porQue && q.porQue.length >= 40,
      `🔴 la pregunta «${q.id}» no dice POR QUÉ va donde va. Un orden sin motivo se reordena en el ` +
      'primer refactor que lo vea raro.');
  }
});

// ── 🔴 EL SUELO ─────────────────────────────────────────────────────────────────────────

test('SCRUM-494 · 🔴 SUELO: cero casos es CEGUERA, no limpieza', (t) => {
  t.diagnostic(`${C.total} declarados · grupos ${JSON.stringify(C.porGrupo)} · sobran ${C.sobran.length}`);
  assert.ok(C.sobran.length > 0,
    '🔴 CERO exports en la sub-categoría. El 12-ago-2026 eran 124 sobre 160 con uso interno. Un ' +
    'cero aquí no es que se hayan limpiado: es que el discriminante ha dejado de responder — y ' +
    'entonces el guard vuelve a aconsejar «declara» a todo el mundo sin que nadie lo note.');
  assert.ok(C.sobran.length >= 50,
    `🔴 solo ${C.sobran.length} y se midieron 124. Una caída así no se explica por limpieza en un día.`);
  assert.equal(C.total, PARES.length,
    '🔴 el censo no cubre todos los huérfanos declarados.');
});

test('SCRUM-494 · los grupos SUMAN el total: un censo cuyas partes no suman no es un censo', () => {
  const suma = Object.values(C.porGrupo).reduce((a, b) => a + b, 0);
  assert.equal(suma, C.total,
    `🔴 los grupos suman ${suma} y el censo tiene ${C.total}. Con un orden de preguntas, cada export ` +
    'cae en UNA casilla y solo una: si no suman, hay un export que no responde a ninguna pregunta ' +
    'o que responde a dos.');
});

// ── CONTROL NEGATIVO Y POSITIVO SOBRE EL ÁRBOL REAL ─────────────────────────────────────

test('SCRUM-494 · 🔴 CONTROL NEGATIVO: `avanzar` NO cae — es una puerta declarada, no un ayudante', () => {
  // `docs/master/SCRUM-475.md` §6 lo declara con esas palabras: «La función `avanzar()` está probada
  // y sin llamador — es deliberado, y se dice». Si cayera aquí, el guard mandaría cerrar esa puerta.
  const cae = C.sobran.find((f) => f.nombre === 'avanzar');
  assert.equal(cae, undefined,
    '🔴 `avanzar` cae en la sub-categoría y el guard mandaría QUITARLE EL `export`. Es el motor del ' +
    'embudo de correo, declarado a propósito sin llamador a la espera de su webhook: des-exportarlo ' +
    'cerraría una puerta que alguien dejó abierta con su motivo escrito.');
  const f = C.filas.find((x) => x.nombre === 'avanzar');
  assert.equal(f?.grupo, 'SOLO_SU_TEST',
    `🔴 «avanzar» ha cambiado de grupo (${f?.grupo}). Sin uso interno y con su test como único ` +
    'importador: ésa es la forma de un motor esperando cable.');
});

test('SCRUM-494 · CONTROL POSITIVO: un export con consumidor de PRODUCCIÓN nunca cae', () => {
  const conProduccion = C.filas.filter((f) => f.grupo === 'CON_PRODUCCION');
  assert.ok(conProduccion.length > 0, '🔴 el censo no ve ni un export con importador de producción.');
  for (const f of conProduccion) {
    assert.equal(f.sobra, false,
      `🔴 ${f.modulo}::${f.nombre} tiene importador de producción (${f.produccion.join(', ')}) y aun ` +
      'así se aconseja des-exportarlo. Eso rompe el build.');
  }
});

// ── 🔴 EL CONSEJO, QUE ES LO QUE SE EJECUTA ─────────────────────────────────────────────

test('SCRUM-494 · 🔴 para la sub-categoría el consejo es RETIRAR EL `export`, no declararlo', () => {
  const f = C.sobran[0];
  const consejo = consejoPara(f);
  assert.match(consejo, /QUÍTALE EL `export`/,
    `🔴 EL GUARD ESTÁ MANDANDO DECLARAR ALGO CUYO \`export\` SOBRA (${f.modulo}::${f.nombre}).\n\n` +
    '  Su consumidor real ya está DENTRO de su módulo y de fuera solo entra su test. Declararlo\n' +
    '  mete un ayudante de test en el registro, y el registro deja de señalar lo que importa —\n' +
    '  que es exactamente la avería que este ticket viene a cerrar.\n\n' +
    `  Dijo: «${consejo}»`);
  assert.doesNotMatch(consejo, /DECLÁRALO/,
    '🔴 el consejo dice las dos cosas a la vez. Una instrucción ambigua es peor que la equivocada: ' +
    'la siguiente persona elige la cómoda.');
});

test('SCRUM-494 · 🔴 y NO se queda ahí: dice CÓMO se sigue probando sin el `export`', () => {
  // Un consejo que manda des-exportar sin decir cómo se sigue probando manda a la siguiente persona
  // a un callejón: quita el `export` y el test deja de compilar. El patrón existe en la casa —lo
  // escribió quien resolvió `metodoDeclarado`— y no estaba en ninguna guía.
  const consejo = consejoPara(C.sobran[0]);
  assert.match(consejo, /SUPERFICIE PÚBLICA/,
    '🔴 el consejo manda quitar el `export` y no dice cómo se sigue probando. La siguiente persona ' +
    'lo quita, el test deja de compilar, y lo vuelve a poner: el guard habrá gastado un rojo para nada.');
  assert.match(consejo, /scrum441-metodo-declarado/,
    '🔴 no señala el fichero donde está el patrón. «Mide por la superficie pública» sin un ejemplo ' +
    'delante es una frase, no una instrucción.');
});

test('SCRUM-494 · para un motor esperando cable el consejo es el CONTRARIO, y lo dice', () => {
  const motor = C.filas.find((f) => f.grupo === 'SOLO_SU_TEST');
  assert.ok(motor, '🔴 el censo no ve ningún motor esperando cable.');
  const consejo = consejoPara(motor);
  assert.match(consejo, /DECLÁRALO/, `🔴 a un motor en espera hay que decirle que se declare.`);
  assert.match(consejo, /NO le quites el `export`/,
    '🔴 el consejo no AVISA de que aquí no hay que des-exportar. Sin ese aviso, quien acaba de leer ' +
    'el consejo de la sub-categoría aplicará lo mismo a éste y cerrará una puerta.');
});

test('SCRUM-494 · la sub-categoría se llama por su nombre y cuelga de USO_INTERNO', () => {
  assert.equal(SUBCATEGORIA, 'EXPORTADO_SOLO_PARA_EL_TEST');
  for (const f of C.sobran) {
    assert.equal(f.grupo, 'USO_INTERNO',
      `🔴 ${f.modulo}::${f.nombre} está en la sub-categoría pero su grupo es «${f.grupo}». La ` +
      'sub-categoría cuelga de «uso interno» y solo de ahí: fuera de ese grupo, quitar el `export` ' +
      'no es la respuesta.');
      assert.equal(f.subcategoria, SUBCATEGORIA);
  }
});

test('SCRUM-494 · el clasificador funciona export por export, no solo sobre la lista', () => {
  // El guard tiene que poder aconsejar sobre un huérfano NUEVO, que por definición no está en
  // ninguna lista todavía. Si solo supiera clasificar lo ya declarado, no serviría para nada.
  const clasificar = clasificador(RAIZ);
  const f = clasificar('src/modules/messaging/domain/constanciaCorreo.ts', 'avanzar');
  assert.equal(f.grupo, 'SOLO_SU_TEST');
  assert.equal(f.sobra, false);
});
