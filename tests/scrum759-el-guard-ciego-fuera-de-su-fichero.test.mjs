// tests/scrum759-el-guard-ciego-fuera-de-su-fichero.test.mjs — SCRUM-759
//
// ═════════════════════════════════════════════════════════════════════════════════════════════
// UN GUARD POR AST ANCLADO A UN FICHERO ES FUERTE DONDE MIRA Y CIEGO DONDE NO,
// Y SU VERDE NO DISTINGUE LAS DOS COSAS.
//
//   · su población  es UN FICHERO
//   · su afirmación es SOBRE EL PRODUCTO ENTERO
//   · y el rótulo   no dice cuál de las dos mide
//
// EL CASO MEDIDO: el guard de SCRUM-303 existe para impedir que haya MÁS DE UNA PUERTA DE ALTA
// DE ALBARÁN, y lee SÓLO `jobDetailView.js`. Una sesión escribió una segunda alta en otro
// fichero —exactamente lo que ese guard existe para impedir— y SCRUM-303 SE QUEDÓ VERDE. Está
// anotado en el propio SCRUM-606 (mutación M5): «con la MISMA mutación puesta,
// `tests/scrum303-albaran-una-pantalla.test.mjs` se quedó VERDE».
//
// ── LO QUE ESTE FICHERO NO HACE ─────────────────────────────────────────────────────────────
// ⛔ NO vuelve a censar las altas de albarán del dashboard. Eso lo hace SCRUM-606 (d), con su
//    suelo, sobre los ~74 ficheros, y está bien. Aquí no se rehace ni se toca: escribir un
//    segundo censo del mismo hecho es la familia de defectos que esta casa persigue.
// ⛔ NO reescribe guards en masa. El censo va primero y el número decide; las decisiones tomadas
//    están escritas una a una en `docs/master/SCRUM-759.md`.
//
// ── QUÉ HACE ────────────────────────────────────────────────────────────────────────────────
//   ① 🔴 EL QUE DECIDE · repite la prueba que salió VERDE, y la deja permanente: con el MISMO
//      criterio y la MISMA violación, la POBLACIÓN decide si se ve o no. Sobre banco propio, sin
//      tocar el árbol: la mutación de SCRUM-606 se corrió a mano una vez y no dejó nada que
//      volviera a correrla.
//   ② EL CENSO · quién tiene esta forma en el árbol, derivado del AST y con la población delante.
//   ③ LA MECANIZACIÓN (obligación 3) · un guard puede DECLARAR su población igual que declara sus
//      mutaciones, y entonces el rótulo se DERIVA de ella: la divergencia entre lo que se mira y
//      lo que se dice deja de estar vigilada y pasa a ser IMPOSIBLE.
// ═════════════════════════════════════════════════════════════════════════════════════════════
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import ts from 'typescript';
import { fileURLToPath } from 'node:url';
import {
  censoDeGuards, ancladosQueAfirmanTotal, ciegos, adoptantes, divergenciasDePoblacion,
  poblacionDeclarada, censarEnPoblacion, contarAdoptantes, CLAVE_POBLACION,
} from './_censo-poblacion-de-guards.mjs';
import {
  arbolDeLaBase, poblacionesContraLaBase, sueloDerivado, RAMA_DE_REFERENCIA,
} from '../scripts/_suelo-contra-main.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// 🔴 MUTACIONES_QUE_ME_TUMBAN · SCRUM-745. Cada una imita el defecto que su test promete cazar.
// Se ejecutan con `npm run meta:mutaciones`: aplica, exige el ROJO, restaura y compara bytes.
export const MUTACIONES_QUE_ME_TUMBAN = [
  // El defecto del ticket, por su cara mecanizable: el rótulo vuelve a escribirse a mano y a
  // nombrar una superficie que el guard no lee.
  {
    fichero: 'tests/scrum303-albaran-una-pantalla.test.mjs',
    de: 'altas de albarán en ${DONDE_MIRO}',
    a: 'altas de albarán en el front',
    cae: 'el rótulo de un adoptante está DERIVADO',
  },
  // El guard empieza a mirar OTRO fichero y su declaración no se entera.
  {
    fichero: 'tests/scrum303-albaran-una-pantalla.test.mjs',
    de: "const FRONT = fs.readFileSync(RUTA_FRONT, 'utf8');",
    a: "const FRONT = fs.readFileSync(RUTA_FRONT, 'utf8');\nfs.readFileSync(path.join(RAIZ, 'public/dashboard/js/albaranesView.js'), 'utf8');",
    cae: 'lo declarado cuadra con lo leído',
  },
  // El censo se calla cuando no sabe de dónde lee un guard: un cero que en realidad es «no vi».
  {
    fichero: 'tests/_censo-poblacion-de-guards.mjs',
    de: 'else noResueltas.push(r.texto);',
    a: 'else { /* se descarta en silencio */ }',
    cae: 'no confunde «no hay» con «no vi»',
  },
  // El detector de afirmaciones de total deja de ver ninguna: el censo devuelve cero candidatos
  // y el suelo tiene que declararse CIEGO en vez de pasar en verde.
  {
    fichero: 'tests/_censo-poblacion-de-guards.mjs',
    de: 'return { censadoras: [...censadoras], totales };',
    a: 'return { censadoras: [...censadoras], totales: [] };',
    cae: 'SUELO del censo',
  },
];

// ═════════════════════════════════════════════════════════════════════════════════════════
// ① 🔴 EL QUE DECIDE · la misma violación, dos poblaciones, dos veredictos
// ═════════════════════════════════════════════════════════════════════════════════════════

/**
 * El criterio, escrito UNA vez: un `apiRequest` de alta —POST a una ruta que TERMINA en
 * `/albaranes`—. Es el mismo que usan SCRUM-303 y SCRUM-606; aquí no censa el árbol, sólo el
 * banco, porque el árbol ya lo censa SCRUM-606 (d) y no se rehace.
 */
const ES_UN_ALTA = (n, sf) => ts.isCallExpression(n) && ts.isIdentifier(n.expression)
  && n.expression.text === 'apiRequest'
  && /[/]albaranes`$/.test((n.arguments[0]?.getText(sf) ?? '').trim())
  && /'POST'/.test(n.arguments[1]?.getText(sf) ?? '');

const ALTA = 'apiRequest(`/admin/jobs/${id}/albaranes`, { method: \'POST\', body });';

/**
 * Un banco con la geometría del caso real: el fichero VIGILADO con su alta legítima, y otro
 * fichero del mismo dashboard que puede llevar —o no— una segunda.
 */
function banco({ segundaAltaFuera = false, segundaAltaDentro = false } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'scrum759-'));
  fs.writeFileSync(path.join(dir, 'vigilado.js'), [
    'function openAlbCrearSheet(ctx) {',
    `  ${ALTA}`,
    '}',
    segundaAltaDentro ? `function atajoNuevo(id) { ${ALTA} }` : 'function atajoNuevo(id) { abrirAltaAlbaran(id); }',
  ].join('\n'));
  fs.writeFileSync(path.join(dir, 'otroFichero.js'), [
    'function pintarLista(filas) { return filas.length; }',
    segundaAltaFuera ? `function nuevoDesdeLaLista(id) { ${ALTA} }` : '',
  ].join('\n'));
  return {
    dir,
    anclada: [path.join(dir, 'vigilado.js')],
    entera: fs.readdirSync(dir).map((f) => path.join(dir, f)),
    limpia: () => fs.rmSync(dir, { recursive: true, force: true }),
  };
}

test('SCRUM-759 · 🔴 EL QUE DECIDE: la violación escrita FUERA del fichero vigilado', () => {
  const b = banco({ segundaAltaFuera: true });
  try {
    const anclado = censarEnPoblacion(b.anclada, ES_UN_ALTA);
    const amplio = censarEnPoblacion(b.entera, ES_UN_ALTA);

    // SUELO: los dos han leído algo y los dos ven el alta legítima. Sin esto, «el anclado no ve
    // la segunda» y «el anclado no ve nada» serían el mismo verde con significados opuestos.
    assert.ok(anclado.leidos === 1 && amplio.leidos === 2,
      `🔴 ESCÁNER CIEGO: leídos anclado=${anclado.leidos}, amplio=${amplio.leidos}`);
    assert.equal(anclado.hallazgos.length, 1, '🔴 el censo anclado no ve ni el alta legítima');

    // 🔴 LA CEGUERA, DEMOSTRADA: el anclado sigue diciendo «hay UNA» con DOS puestas.
    assert.deepEqual(
      anclado.hallazgos.filter((h) => h.fichero !== 'vigilado.js'), [],
      '🔴 el banco no reproduce el caso: el censo anclado estaría viendo fuera de su fichero.',
    );

    // 🔴 Y ESTO ES EL ROJO QUE ESTE TICKET DEJA PUESTO: con la población que su afirmación
    // abarca, la segunda alta SE VE. Es la prueba que se corrió una vez a mano (SCRUM-606, M5) y
    // salió verde en SCRUM-303 sin que quedara nada que volviera a correrla.
    assert.equal(
      amplio.hallazgos.length, 2,
      '🔴 AMPLIAR LA POBLACIÓN NO CAZA LA SEGUNDA ALTA.\n\n'
      + '  La violación está escrita FUERA del fichero vigilado y el censo que abarca el conjunto\n'
      + '  entero tendría que verla. Si no la ve, el arreglo del punto ciego no arregla nada y\n'
      + `  volvemos a donde estábamos. Hallazgos: ${JSON.stringify(amplio.hallazgos)}`,
    );
    assert.ok(amplio.hallazgos.some((h) => h.fichero === 'otroFichero.js'),
      '🔴 ve dos altas pero ninguna en el otro fichero: no está midiendo lo que se cree.');
  } finally { b.limpia(); }
});

test('SCRUM-759 · ✅ POSITIVO: la violación DENTRO la sigue cazando la población anclada', () => {
  // «Si al ampliar la población el guard deja de cazar el caso original, se ha roto.»
  const b = banco({ segundaAltaDentro: true });
  try {
    const anclado = censarEnPoblacion(b.anclada, ES_UN_ALTA);
    const amplio = censarEnPoblacion(b.entera, ES_UN_ALTA);
    assert.equal(anclado.hallazgos.length, 2,
      '🔴 el censo ANCLADO ha dejado de cazar la segunda alta escrita DENTRO de su propio '
      + 'fichero. Eso no es un punto ciego: es el guard roto.');
    assert.equal(amplio.hallazgos.length, 2,
      '🔴 la población entera ve MENOS que la anclada: ampliar habría perdido el caso original.');
  } finally { b.limpia(); }
});

test('SCRUM-759 · SUELO del instrumento: cero hallazgos sobre cero ficheros no es «no hay»', () => {
  const b = banco({ segundaAltaFuera: true });
  try {
    const inventado = censarEnPoblacion([path.join(b.dir, 'no-existe.js')], ES_UN_ALTA);
    assert.equal(inventado.hallazgos.length, 0);
    assert.equal(inventado.leidos, 0, '🔴 dice haber leído un fichero que no existe');
    assert.equal(inventado.ilegibles.length, 1,
      '🔴 UN FICHERO QUE NO SE PUDO ABRIR NO SE APUNTA. Entonces «0 hallazgos» se lee igual que '
      + '«no hay violaciones», y son cosas distintas: la segunda es una medida, la primera es un '
      + 'censo que no miró.');
  } finally { b.limpia(); }
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// ② EL CENSO · quién tiene esta forma, con la población delante
// ═════════════════════════════════════════════════════════════════════════════════════════

const CENSO = censoDeGuards();

test('SCRUM-759 · SUELO del censo: la población va delante y los ciegos van con nombre', () => {
  // La población NO es «los guards que encontré»: es el conjunto que se ha mirado. Sin ella, un
  // «0 anclados» no se distingue de un censo que no encontró qué leer.
  assert.ok(CENSO.poblacion >= 600,
    `🔴 ESCÁNER CIEGO: sólo he mirado ${CENSO.poblacion} ficheros \`tests/*.test.mjs\`. El árbol `
    + 'tiene cientos: o el directorio no es el que creo, o el filtro dejó de casar.');
  assert.ok(CENSO.conAST >= 100,
    `🔴 ESCÁNER CIEGO: sólo ${CENSO.conAST} de ${CENSO.poblacion} guards usan el AST, y medidos `
    + 'el 7-sep-2026 eran 162. Si el detector de `ts.createSourceFile` dejó de casar, todo lo de '
    + 'abajo mide un subconjunto que nadie ha elegido.');

  const conLaForma = ancladosQueAfirmanTotal(CENSO);
  assert.ok(
    conLaForma.length >= 1,
    '🔴 CIEGO: el censo devuelve CERO guards anclados a fichero concreto que afirmen un total, y '
    + 'hay AL MENOS UNO medido (`scrum303-albaran-una-pantalla.test.mjs`, y con él '
    + '`scrum302-sin-callejones.test.mjs`).\n\n'
    + '  Un cero aquí no es «ya no queda ninguno»: es que el detector de población, el de censos '
    + 'o el de afirmaciones de total ha dejado de ver. Mira los ciegos antes de creerte el cero: '
    + `${ciegos(CENSO).length} guards con alguna lectura sin resolver.`,
  );
});

test('SCRUM-759 · el censo distingue ANCLADA de BARRIDO sobre los dos casos medidos', () => {
  // ✅ CONTROL POSITIVO y ✅ CONTROL NEGATIVO. Sin los dos, un censo que clasificara TODO igual
  // pasaría en verde: «todos anclados» y «todos barrido» son el mismo verde con significados
  // opuestos. No son una población cableada — son las dos anclas de calibración del instrumento.
  const de = (n) => CENSO.guards.find((g) => g.guard === n);

  const anclado = de('scrum303-albaran-una-pantalla.test.mjs');
  assert.ok(anclado, '🔴 ESCÁNER CIEGO: el censo no ve el guard de SCRUM-303. ¿Se renombró?');
  assert.equal(anclado.tipo, 'ANCLADA',
    `🔴 SCRUM-303 sale «${anclado.tipo}» y su censo lee UN fichero concreto: el clasificador no `
    + 'distingue, y entonces la lista de candidatos no significa nada.');
  assert.ok(anclado.ficheros.includes('public/dashboard/js/jobDetailView.js'),
    `🔴 el censo no resuelve la ruta que SCRUM-303 lee: ${JSON.stringify(anclado.ficheros)}`);

  const barrido = de('scrum606-albaran-desde-presupuesto.test.mjs');
  assert.ok(barrido, '🔴 ESCÁNER CIEGO: el censo no ve el guard de SCRUM-606.');
  assert.equal(barrido.tipo, 'BARRIDO',
    '🔴 SCRUM-606 sale ANCLADO y recorre la lista de scripts del dashboard entera. Si el censo no '
    + 've la diferencia entre leer un fichero y recorrer un conjunto, no mide la forma del defecto.');
});

test('SCRUM-759 · el censo no confunde «no hay» con «no vi»', () => {
  // Un guard que lee de una ruta que este censo NO sabe resolver tiene que salir señalado, no
  // clasificado como si se hubiera entendido. El árbol tiene casos reales (rutas que vienen de
  // otro módulo, de una función, de un `...spread`), y ninguno puede desaparecer en silencio.
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'scrum759-ciego-'));
  try {
    fs.writeFileSync(path.join(dir, 'guardz.test.mjs'), [
      "import fs from 'node:fs';",
      "import ts from 'typescript';",
      "import { RUTA_DE_OTRO_SITIO } from './_de-otro-modulo.mjs';",
      "const codigo = fs.readFileSync(RUTA_DE_OTRO_SITIO, 'utf8');",
      "ts.createSourceFile('x.js', codigo, ts.ScriptTarget.Latest, true);",
    ].join('\n'));
    const censo = censoDeGuards(dir);
    assert.equal(censo.conAST, 1, '🔴 el banco no produce ni un guard con AST');
    const marcados = ciegos(censo);
    assert.equal(marcados.length, 1,
      '🔴 UNA LECTURA QUE NO SE HA SABIDO RESOLVER SE HA TRAGADO EN SILENCIO. El guard sale '
      + 'clasificado como si su población se conociera, y el recuento de anclados —o su cero— '
      + 'pasa a ser una afirmación sobre lo que no se miró.');
    assert.deepEqual(marcados[0].noResueltas, ['RUTA_DE_OTRO_SITIO'],
      '🔴 se marca como ciego pero no dice QUÉ no supo resolver: sin eso, quien lo lea no puede '
      + 'ni arreglar el censo ni descartar el caso.');
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// ③ LA MECANIZACIÓN · ¿puede un guard DECLARAR su población, como declara sus mutaciones?
// ═════════════════════════════════════════════════════════════════════════════════════════

/** Un guard de mentira que declara su población y lee lo que se le diga. */
function guardDeclarando(dir, { declara, lee }) {
  fs.writeFileSync(path.join(dir, 'guarda.test.mjs'), [
    "import fs from 'node:fs';",
    "import path from 'node:path';",
    "import ts from 'typescript';",
    `const RAIZ = path.resolve(import.meta.dirname, '..');`,
    `export const ${CLAVE_POBLACION} = [${declara.map((d) => `'${d}'`).join(', ')}];`,
    ...lee.map((l, i) => `const c${i} = fs.readFileSync(path.join(RAIZ, '${l}'), 'utf8');`),
    "ts.createSourceFile('x.js', c0, ts.ScriptTarget.Latest, true);",
  ].join('\n'));
  return censoDeGuards(dir);
}

test('SCRUM-759 · una población declarada que NO cuadra con la leída se denuncia, y en los dos sentidos', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'scrum759-decl-'));
  try {
    // ✅ CONTROL POSITIVO: cuando cuadra, CALLA. Un detector que salta siempre no distingue nada.
    const bien = guardDeclarando(dir, { declara: ['src/a.ts'], lee: ['src/a.ts'] });
    assert.equal(divergenciasDePoblacion(bien).length, 0,
      '🔴 acusa a una declaración que cuadra: un guard que salta con todo se silencia.');

    // Declara de MÁS: dice mirar un fichero que no abre. El rótulo prometería cobertura que no hay.
    const deMas = guardDeclarando(dir, { declara: ['src/a.ts', 'src/b.ts'], lee: ['src/a.ts'] });
    assert.deepEqual(divergenciasDePoblacion(deMas)[0]?.sobran, ['src/b.ts'],
      '🔴 no caza la declaración que abarca MÁS de lo que el guard lee. Ése es literalmente el '
      + 'defecto del ticket, escrito en la declaración en vez de en la prosa.');

    // Declara de MENOS: lee un fichero que no ha declarado. La cobertura existe y nadie la sabe.
    const deMenos = guardDeclarando(dir, { declara: ['src/a.ts'], lee: ['src/a.ts', 'src/b.ts'] });
    assert.deepEqual(divergenciasDePoblacion(deMenos)[0]?.faltan, ['src/b.ts'],
      '🔴 no caza que el guard haya empezado a leer un fichero que su declaración no menciona.');
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('SCRUM-759 · lo que no se sabe evaluar de una declaración se DENUNCIA, no se descarta', () => {
  // La lección de SCRUM-757, aplicada a esta declaración desde el primer día en vez de dentro de
  // tres sesiones: una entrada que no sea un literal no puede caerse del recuento en silencio.
  const codigo = `export const ${CLAVE_POBLACION} = ['src/a.ts', 'src/' + 'b.ts'];`;
  const { declarada, ilegibles } = poblacionDeclarada(codigo, 'g.test.mjs');
  assert.deepEqual(declarada, ['src/a.ts']);
  assert.equal(ilegibles.length, 1,
    '🔴 la entrada concatenada se ha descartado EN SILENCIO: la población declarada baja de N a '
    + 'N−1 y la comparación contra lo leído pasa a acusar en falso o a callar de más.');
  assert.equal(ilegibles[0].forma, 'BinaryExpression',
    '🔴 dice que hay algo ilegible pero no QUÉ FORMA tiene: quien lo lea no sabe qué arreglar.');
  assert.ok(ilegibles[0].linea > 0, '🔴 la denuncia no dice EN QUÉ LÍNEA.');
});

test('SCRUM-759 · 🔴 los adoptantes: lo declarado cuadra con lo leído', () => {
  const adopt = adoptantes(CENSO);
  assert.ok(adopt.length >= 1,
    '🔴 CIEGO: nadie declara su población, así que el test de abajo compararía el vacío. La '
    + `adopción se hace guard a guard y el mecanismo es \`${CLAVE_POBLACION}\`.`);

  const divergen = divergenciasDePoblacion(CENSO);
  assert.deepEqual(
    divergen.map((d) => d.guard), [],
    '🔴 UN GUARD DICE MIRAR UNA POBLACIÓN Y LEE OTRA:\n'
    + divergen.map((d) => `      ${d.guard} · declara de más: [${d.sobran}] · lee sin declarar: `
      + `[${d.faltan}] · ilegibles: ${d.ilegibles.length}`).join('\n')
    + '\n\n  «Declara de más» es el defecto de este ticket con nombre y línea: el rótulo abarca\n'
    + '  una superficie que el guard no abre. «Lee sin declarar» es el otro lado: hay cobertura\n'
    + '  que nadie sabe que existe, y el día que se retire nadie la echará de menos.',
  );
});

test('SCRUM-759 · 🔴 el rótulo de un adoptante está DERIVADO de su población', () => {
  // ── EL ESCALÓN DE ARRIBA ────────────────────────────────────────────────────────────────
  // Comparar el rótulo con la población sería vigilar la divergencia. DERIVARLO la hace
  // imposible: el nombre de la superficie lo pone la población, así que un guard no puede decir
  // «el front» mientras lee un fichero. Lo que se comprueba aquí no es la prosa —eso no se puede
  // mecanizar— sino DE DÓNDE SALE: por AST, que el mensaje use el identificador de la población.
  const sinDerivar = [];
  for (const g of adoptantes(CENSO)) {
    for (const t of g.totales) if (!t.derivado) sinDerivar.push(`${g.guard}:${t.linea} · ${t.sujeto}`);
  }
  const conTotales = adoptantes(CENSO).reduce((n, g) => n + g.totales.length, 0);
  assert.ok(conTotales >= 1,
    '🔴 CIEGO: ningún adoptante tiene afirmaciones de total, así que este test no compara nada. '
    + 'O el detector de afirmaciones dejó de verlas, o la adopción se hizo en guards a los que no '
    + 'les aplica.');
  assert.deepEqual(
    sinDerivar, [],
    '🔴 HAY UNA AFIRMACIÓN DE TOTAL CUYO RÓTULO SE ESCRIBE A MANO:\n      '
    + sinDerivar.join('\n      ')
    + '\n\n  Un rótulo escrito a mano puede nombrar una superficie que el guard no lee, y su verde\n'
    + `  no distingue las dos cosas. Derívalo de \`${CLAVE_POBLACION}\` y la divergencia deja de\n`
    + '  ser posible en vez de quedar vigilada.',
  );
});

const BASE = arbolDeLaBase(RAIZ);

test('SCRUM-759 · SUELO derivado: la adopción no encoge contra la base de fusión', {
  skip: BASE ? false : 'no pude materializar la base de fusión con origin/main · git fetch origin main',
}, () => {
  // El suelo NO es un número escrito aquí —eso caduca el día que se escribe (SCRUM-810)—: se
  // deriva de la base de fusión con `main`. Crecer es gratis; perder habla a la primera.
  const medida = poblacionesContraLaBase(
    'adoptantes-de-la-poblacion-declarada',
    (raiz) => contarAdoptantes(path.join(raiz, 'tests')),
    RAIZ,
  );
  assert.ok(medida.medible,
    `🔴 CIEGO: no se ha podido medir contra ${RAMA_DE_REFERENCIA} · ${medida.motivo}`);
  assert.equal(sueloDerivado(medida), null,
    `se ha retirado la declaración de población de algún guard (${medida.antes} → ${medida.ahora}).`);
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// ④ EL DATO QUE CONTESTA LA OBLIGACIÓN 3 · cuántos PODRÍAN declararla de forma comprobable
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-759 · la declaración es COMPROBABLE en la mayoría del árbol, y donde no, se dice', () => {
  // La pregunta del encargo es si esto se puede mecanizar. La respuesta con la medida delante:
  // una declaración sólo sirve si se puede CONTRASTAR con lo que el guard lee de verdad, y eso
  // depende de que la población se sepa derivar. Aquí se fija el hecho para que no se degrade en
  // silencio: la parte contrastable del árbol no puede encogerse sin que nada lo diga.
  const contrastables = CENSO.guards.filter((g) => g.noResueltas.length === 0);
  assert.ok(CENSO.conAST > 0, '🔴 ESCÁNER CIEGO: ningún guard con AST');
  const porcentaje = Math.round((contrastables.length / CENSO.conAST) * 100);
  assert.ok(
    porcentaje >= 75,
    `🔴 la población sólo se sabe derivar en ${contrastables.length} de ${CENSO.conAST} guards `
    + `(${porcentaje}%), y el 7-sep-2026 eran 140 de 162 (86%). Por debajo de ahí, «declarar la `
    + 'población» deja de ser mecanizable: la mitad de las declaraciones no se podrían contrastar '
    + 'con nada, y una declaración que nadie contrasta es un comentario.',
  );
});
