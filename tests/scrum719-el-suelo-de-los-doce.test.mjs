// tests/scrum719-el-suelo-de-los-doce.test.mjs — SCRUM-719
//
// ═════════════════════════════════════════════════════════════════════════════════════════
// TRECE GUARDS AFIRMABAN NEGACIONES SIN RESPALDO: PASABAN IGUAL SOBRE UN FICHERO VACÍO.
//
//     const codigo = soloEjecutable(texto);
//     assert.doesNotMatch(codigo, /LO_PROHIBIDO/);   // ← con `codigo === ''` pasa siempre
//
// Medido el 4-sep-2026 rompiendo el filtro (`npm run censo:mudez`): de los **73 guards que lo
// llaman de verdad**, 60 se ponían rojos y **13 seguían en verde mirando la nada**.
//
// 🔴 Y LO QUE HAY QUE ENTENDER PARA ARREGLARLO BIEN: **casi todos tenían suelo ya**, y todos lo
// tenían apuntando UN PASO ANTES de la ceguera:
//
//   · `scrum374`  «he leído el sellador»            → `SELLADOR.length > 2000`, sobre el CRUDO
//   · `scrum394`  «he encontrado la rama»           → `assert.ok(bloque)`, ANTES de filtrar
//   · `scrum382`  «el nombre prohibido existe»      → sí, pero en OTRO fichero
//   · `scrum293`  ídem · `scrumD1` ídem · `scrum549` los marcadores, sobre el texto CRUDO
//   · `scrum372`  «he mirado 3.000 líneas»          → cuenta lo que ENTRA, no lo que sale
//
// Ninguno comprobaba lo único que respalda la negación: **que el texto registrado tenga
// sustancia**. El suelo estaba en la puerta de al lado.
//
// ── EL ARREGLO: UN ANCLA, NO UN NÚMERO ───────────────────────────────────────────────────
// El ancla es algo de lo que el guard YA depende: el símbolo que importa, la función que la
// pantalla publica, el marcador que el censo busca. Si desaparece, el guard estaba mirando otro
// fichero **y quiere enterarse**. No hay ningún número que mantener a mano — que es el defecto
// de SCRUM-402, donde un umbral escrito a mano nace para desactivarse.
// ═════════════════════════════════════════════════════════════════════════════════════════
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ejecutableDe, ejecutablesDe, leerFuente } from './_guard-texto.mjs';
import { soloCodigo } from './_solo-codigo.mjs';
import { analizarFiltro, clasificarFiltro, censoDelFiltro, FORMAS } from './_censo-filtro-sin-suelo.mjs'; // SCRUM-1395
import { casosEscritos } from './_casos-escritos.mjs'; // SCRUM-1415

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

/**
 * LOS TRECE, CON LO QUE LES DA EL SUELO. La columna de la derecha no es decorativa: es lo que
 * este trinquete exige que siga estando, y es distinta según qué afirme cada guard.
 *
 * · Los once primeros hacen UNA negación sobre UN texto → un ANCLA que tiene que sobrevivir.
 * · `scrum372` y `scrum458` BARREN muchos textos, donde no hay ancla común → el suelo es un
 *   RECUENTO DE LO FILTRADO, que es lo que su contador viejo no miraba.
 */
const LOS_TRECE = Object.freeze([
  ['scrum149-sin-lineas-no-sella', "ancla: 'listQuotesAdmin'"],
  ['scrum199-fuente-unica-hijos', "ancla: '_evidencia-tanda'"],
  ['scrum293-retencion-irpf', "ancla: 'TIPOS_RETENCION'"],
  ['scrum317-trabajo-por-su-nombre', "ancla: 'renderJobDetailView'"],
  ['scrum347-origen-de-la-factura', "ancla: 'allocateInvoiceNumber'"],
  ['scrum370-gastos-del-trabajo', "ancla: 'Gastos de este trabajo'"],
  ['scrum382-foto-duplicada', "ancla: 'huellaDeBytes'"],
  ['scrum394-plan-mudo', "ancla: 'skipped.push'"],
  ['scrum448-cobros-estado-de-carga', "ancla: 'renderCobrosView'"],
  ['scrum549-nada-publicable-sin-marcar', 'ancla: [...MARCADORES]'],
  ['scrumD1-puerta-serie', "'renderPuertaSerie'"],
  ['scrum372-un-dato-un-nombre', 'lineasConCodigo'],
  ['scrum458-paquete-de-precarga', 'sinCodigo'],
]);

// ═══ 🔴 EL TRINQUETE ══════════════════════════════════════════════════════════════════════

test('SCRUM-719 · 🔴 SUELO: los trece ficheros existen y se leen', () => {
  for (const [g] of LOS_TRECE) {
    const p = path.join(RAIZ, 'tests', `${g}.test.mjs`);
    assert.ok(fs.existsSync(p), `🔴 \`${g}\` ya no existe. Si se renombró, este trinquete está `
      + 'vigilando un fichero que no está y su verde no vale nada.');
    assert.ok(fs.readFileSync(p, 'utf8').length > 500, `🔴 \`${g}\` está casi vacío`);
  }
  assert.equal(LOS_TRECE.length, 13, '🔴 la lista ha cambiado de tamaño sin decir por qué');
});

test('SCRUM-719 · 🔴 los trece conservan su suelo', () => {
  // Se mira el CÓDIGO, no la prosa: el sitio natural donde se escribe «ancla» es el comentario
  // que explica el ancla. Un trinquete de texto que no filtre se cree su propia documentación
  // — la autorreferencia que este repo lleva media docena de tickets pagando (SCRUM-694).
  const sinSuelo = [];
  for (const [g, marca] of LOS_TRECE) {
    const codigo = soloCodigo(fs.readFileSync(path.join(RAIZ, 'tests', `${g}.test.mjs`), 'utf8'), g);
    if (!codigo.includes(marca)) sinSuelo.push(`${g} (falta \`${marca}\`)`);
  }
  assert.deepEqual(sinSuelo, [],
    `🔴 ${sinSuelo.length} de los trece han perdido su suelo:\n    ${sinSuelo.join('\n    ')}\n`
    + '  Sin él vuelven a afirmar una negación sobre un texto que puede estar vacío, y su verde\n'
    + '  deja de significar «no lo encuentro» para significar «no he mirado».\n'
    + '  `npm run censo:mudez` hace la comprobación completa, pero es MANUAL y no corre en ningún sitio\n'
    + '  (SCRUM-1179): la única red que bloquea es ESTA lista.');
});

// ═══ 🔴 EL ROJO, Y QUE CAE CON EL MECANISMO VIEJO ═════════════════════════════════════════

test('SCRUM-719 · 🔴 EL ROJO: sobre la nada, `ejecutableDe` NO devuelve; se declara ciego', () => {
  assert.throws(() => ejecutableDe('', { ancla: 'loQueSea', donde: 'vacío' }), /ESCÁNER CIEGO/,
    '🔴 sobre la cadena vacía tiene que LANZAR. Devolverla es lo que dejaba pasar a los trece.');

  // 🔴 Y CAE CON EL MECANISMO VIEJO, en una línea: sobre ese mismo texto vacío, la forma que
  // usaban los trece es CIERTA. No es que fallara el filtro — es que la pregunta era otra.
  //
  // ⚠️ Y ESTO SE ESCRIBE COMO AFIRMACIÓN POSITIVA SOBRE LA REGEX, no como `doesNotMatch('')`,
  // porque `scrum237` cazó esa primera versión Y TENÍA RAZÓN: era, literal, una negación sin
  // respaldo — el defecto que este fichero viene a cerrar, cometido en su propia demostración.
  // Lo que se afirma es idéntico; lo que cambia es que ahora se afirma algo, en vez de no
  // encontrar nada. No se ha tocado `scrum237`: se ha arreglado la frase.
  assert.equal(/LO_PROHIBIDO/.test(''), false,
    '📌 la prohibición de los trece, aplicada a la nada, daba «limpio»');
});

test('SCRUM-719 · 🔴 un ancla que NO sobrevive al filtro se declara ciega', () => {
  // El caso real: el fichero existe y tiene texto, pero es todo comentarios — o el recorte se
  // quedó con el trozo equivocado. La negación de después sería cierta por vacía.
  assert.throws(() => ejecutableDe('// listQuotesAdmin vive aquí\n', { ancla: 'listQuotesAdmin' }),
    /ESCÁNER CIEGO/,
    '🔴 el ancla estaba SOLO en un comentario y se ha dado por buena: es la autorreferencia justa');

  // Y sin ancla no se puede llamar: obligar a decir qué debe sobrevivir ES el mecanismo.
  assert.throws(() => ejecutableDe('const a = 1;', {}), /falta `ancla`/);
});

// ═══ ✅ CONTROL NEGATIVO — población pequeña PERO REAL sigue en verde ══════════════════════

test('SCRUM-719 · ✅ CONTROL NEGATIVO: un fuente MINÚSCULO pero real pasa', () => {
  // 🔴 EL RIESGO DE UN SUELO ES ÉSTE: que exija tamaño. Un ancla no lo hace —es binaria— y aquí
  // se comprueba, porque un guard que se pusiera rojo ante un módulo de una línea empujaría a
  // bajarle el listón, y un listón bajado es un guard apagado.
  const minusculo = "export const huellaDeBytes = (b) => b;\n";
  assert.equal(ejecutableDe(minusculo, { ancla: 'huellaDeBytes' }).includes('huellaDeBytes'), true,
    '🔴 un módulo de UNA línea, real y con su ancla, se está declarando ciego');

  // Y con comentarios alrededor: lo que se va es la prosa, no el código.
  const conProsa = `/** explica huellaDeBytes largamente */\n${minusculo}// y una coletilla\n`;
  assert.ok(ejecutableDe(conProsa, { ancla: 'huellaDeBytes' }).includes('huellaDeBytes'));
});

test('SCRUM-719 · ✅ CONTROL NEGATIVO: una ENTRADA vacía no es una SALIDA vaciada', () => {
  // Medido, y por eso está escrito: `src/` tiene SIETE ficheros `.ts` de CERO BYTES
  // (`src/api/routes.ts`, `src/core/http/types.ts`, cinco más). El primer suelo que escribí para
  // `scrum458` los marcaba a los siete y ponía el guard rojo sobre un hecho que no es su defecto.
  //
  // Son dos cosas distintas: un fichero vacío EN DISCO no deja hueca ninguna negación —no hay
  // nada que prohibir en él—; uno VACIADO POR EL FILTRO sí. El suelo compara entrada y salida.
  const vacios = ['src/api/routes.ts', 'src/core/http/types.ts']
    .filter((r) => fs.readFileSync(path.join(RAIZ, r), 'utf8').trim() === '');
  assert.equal(vacios.length, 2,
    '🔴 SUELO DEL CONTROL: esos dos ficheros ya no están vacíos, así que este control no está '
    + 'probando lo que dice. Reelígelos midiendo, no a ojo.');

  assert.deepEqual(ejecutablesDe([{ nombre: 'a.ts', texto: 'const a = 1;' }], { donde: 'control' })
    .map((x) => x.nombre), ['a.ts'], '🔴 un texto real de una línea se está rechazando');

  assert.throws(() => ejecutablesDe([{ nombre: 'b.ts', texto: '// sólo prosa\n' }], { donde: 'control' }),
    /SIN CÓDIGO/, '🔴 un texto que el filtro VACÍA tiene que declararse ciego');

  assert.throws(() => ejecutablesDe([], { donde: 'control' }), /ESCÁNER CIEGO/,
    '🔴 cero elementos no es «ninguno incumple»: es que no se ha mirado');
});

// ═══ 📌 EL CENSO, QUE ES LO QUE NO DEPENDE DE ESTA LISTA ══════════════════════════════════

test('SCRUM-719 · 📌 el censo de mudez NO puede quedarse ciego por su propia lista de nombres', () => {
  // 🔴 ESTO PASÓ DE VERDAD, y por eso es un test y no un comentario. Al migrar los trece, nueve
  // pasaron de importar `soloEjecutable` a importar `ejecutableDe` — y el censo, que buscaba el
  // nombre VIEJO, dejó de verlos: la población cayó de 82 a 73 y el veredicto pasó a «0 mudos»
  // EN PARTE POR NO MIRAR. El mismo defecto que el censo persigue, dentro del censo, causado por
  // su propio arreglo. Lo cazó que los candidatos bajaran exactamente en 9.
  const censo = soloCodigo(fs.readFileSync(path.join(RAIZ, 'scripts', 'censo-mudez.mjs'), 'utf8'), 'c.mjs');
  for (const nombre of ['soloEjecutable', 'ejecutableDe', 'ejecutablesDe', 'leerFuente']) {
    assert.ok(new RegExp(`\\|${nombre}\\||/${nombre}\\||\\|${nombre}/`).test(censo),
      `🔴 el censo no busca \`${nombre}\` en su población. Todo guard que lo use quedaría fuera `
      + 'del recuento, y el censo informaría «0 mudos» sin haberlos mirado.');
  }
  assert.match(censo, /NO APLICA/,
    '🔴 el censo ha perdido la puerta «NO APLICA», que es la que distingue un guard mudo de uno '
    + 'que nunca llamó al filtro. Sin ella vuelve a haber que separarlos a mano.');
});

test('SCRUM-719 · 📌 `leerFuente` sigue siendo el camino corto, y ahora admite ancla', () => {
  // El ancla es OPCIONAL aquí a propósito: por este camino también pasan tests que EXIGEN algo,
  // y a ésos el filtro no puede cegarlos —una afirmación positiva sobre la nada falla sola—.
  // Quien PROHÍBE es quien necesita el suelo, y ahora puede pedirlo sin cambiar de función.
  // ⚠️ 6-oct-2026 · SCRUM-1395: esa opcionalidad vale ya SÓLO para los heredados declarados en `tests/_filtro-sin-suelo-heredados.json`; para un test NUEVO el ancla es obligatoria (lo exige el caso ② de más abajo).
  const propio = path.join(RAIZ, 'tests', '_guard-texto.mjs');
  assert.ok(leerFuente(propio).includes('soloEjecutable'), '🔴 `leerFuente` sin ancla ha dejado de leer');
  assert.ok(leerFuente(propio, { ancla: 'export function soloEjecutable' }).length > 1000);
  assert.throws(() => leerFuente(propio, { ancla: 'NoExisteEsteSimbolo719' }), /ESCÁNER CIEGO/,
    '🔴 `leerFuente` acepta un ancla que no está: entonces no es un suelo');
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// 🔴 SCRUM-1395 · EL FILTRO SIN SUELO NO CRECE
//
// La lista de arriba vigila TRECE nombres. El 6-oct-2026 el censo de mudez miraba 119 ficheros, y
// el único mudo —`scrum589`— no era ninguno de los trece: nació el 6-sep, dos días después de
// esta lista, usando la forma vieja, y estuvo un mes en verde con la negación sin respaldo. La red
// que corre siempre vigilaba una lista cerrada; el desagüe estaba en los que nacen después.
//
// Lo que sigue lo cierra por donde se puede cerrar en milisegundos: un test NUEVO no llama al
// filtro por una forma que acepta la cadena vacía. Las formas con suelo LANZAN sobre la nada, así
// que quien las usa es vivo por construcción y no hace falta romper el filtro para saberlo.
//
// ⚠️ LO QUE ESTO NO HACE, DICHO: no mide mudez. Los heredados de
// `tests/_filtro-sin-suelo-heredados.json` siguen sin suelo; hoy son VIVOS porque tienen otra
// aserción que cae, y si alguien se la quita nada avisa hasta que alguien corra `censo:mudez` a
// mano. Ese fichero dice por qué se toleran y qué los retira.
// ═════════════════════════════════════════════════════════════════════════════════════════
const HEREDADOS_1395 = JSON.parse(fs.readFileSync(path.join(RAIZ, 'tests', '_filtro-sin-suelo-heredados.json'), 'utf8'));
const LISTA_1395 = [...HEREDADOS_1395.ficheros, ...Object.keys(HEREDADOS_1395.sinJuzgar)];

/**
 * 🔴 CUÁNTOS HEREDADOS HAY. Va aquí Y en el JSON a propósito: para añadir un nombre hay que tocar
 * DOS ficheros y este número, y eso se ve en cualquier diff. Si te encuentras subiéndolo, PARA:
 * un trinquete que salta pide una DECISIÓN (del orquestador de tu equipo, escrita en el registro
 * del ticket), no una lista más ancha. Sólo baja: cuando un heredado pasa a una forma con suelo.
 */
const TECHO_HEREDADOS_1395 = 85;

const CENSO_1395 = censoDelFiltro(RAIZ);
const SIN_SUELO_HOY = CENSO_1395.sinSuelo.map((x) => x.fichero);
const enLista1395 = (xs) => xs.map((x) => `   · ${x}`).join('\n');
const COMO_SE_ARREGLA_1395 = `
Cómo se arregla (no hace falta abrir Jira):

    import { ejecutableDe } from './_guard-texto.mjs';
    const codigo = ejecutableDe(texto, { ancla: 'algoQueTuTestYaNecesitaQueEste' });
    // o, leyendo de disco:  leerFuente(ruta, { ancla: '…' })

El ancla es algo de lo que tu test YA depende (el símbolo que importa, la función que mira). Si no
sobrevive al filtro, tu negación estaba mirando la nada y ahora lo dice. NO lo añadas a
tests/_filtro-sin-suelo-heredados.json: esa lista es de los que existían antes de SCRUM-1395.
`;

test('SCRUM-1395 · ① la línea sale SIEMPRE, con su población, y el censo del filtro no está ciego', (t) => {
  const nuevos = SIN_SUELO_HOY.filter((f) => !LISTA_1395.includes(f));
  const sinParsear = CENSO_1395.filas.filter((x) => x.motivo);
  const linea = `SCRUM-1395 · ${CENSO_1395.usan.length} guards llaman al filtro de comentarios · `
    + `${SIN_SUELO_HOY.length} sin suelo (${LISTA_1395.length} heredados declarados · ${nuevos.length} nuevos) · `
    + `${CENSO_1395.de(FORMAS.CON_SUELO).length} con suelo · ${CENSO_1395.de(FORMAS.NO_FILTRA).length} no filtran · `
    + `población: ${CENSO_1395.enDisco} ficheros *.test.mjs de tests/ leídos, ${sinParsear.length} sin parsear · `
    + `aparte: ${CENSO_1395.envoltorios.length} módulos de apoyo llaman al filtro y no se juzgan · `
    + '⚠️ esto NO mide mudez: «N mirados · K mudos» lo dicta `npm run censo:mudez`, a mano';
  t.diagnostic(linea);
  console.log(linea);

  assert.ok(CENSO_1395.enDisco > 1000, `🔴 CIEGO: sólo ${CENSO_1395.enDisco} ficheros en tests/. No es la suite.`);
  assert.equal(CENSO_1395.filas.length, CENSO_1395.enDisco, 'el censo tiene que haber mirado TODOS los *.test.mjs');
  assert.deepEqual(sinParsear.map((x) => x.fichero), [],
    '🔴 hay ficheros que el analizador no supo leer. No leerlo no es que esté limpio.');
  assert.ok(CENSO_1395.usan.length >= 50,
    `🔴 CIEGO: sólo ${CENSO_1395.usan.length} ficheros usan el filtro. El 6-oct-2026 eran 110: el censo ha dejado de seguir el import.`);

  // Los dos controles: uno de los trece (con suelo) y este mismo fichero, que llama a
  // `leerFuente(propio)` sin ancla unas líneas más arriba y por eso es un heredado.
  const clase = (f) => (CENSO_1395.filas.find((x) => x.fichero === f) || {}).clase;
  assert.equal(clase('scrum149-sin-lineas-no-sella.test.mjs'), FORMAS.CON_SUELO, '🔴 CIEGO: uno de los trece no sale «con suelo»');
  assert.equal(clase('scrum719-el-suelo-de-los-doce.test.mjs'), FORMAS.SIN_SUELO, '🔴 CIEGO: este fichero no sale «sin suelo»');
  assert.equal(clase('scrum9999-un-nombre-inventado.test.mjs'), undefined, 'un nombre que no existe no puede salir');
});

test('SCRUM-1395 · ② un test NUEVO no llama al filtro sin suelo (la lista de heredados no crece)', () => {
  const lista = new Set(LISTA_1395);
  assert.equal(lista.size, LISTA_1395.length, 'un nombre repetido en la lista de heredados');
  const nuevos = CENSO_1395.sinSuelo.filter((x) => !lista.has(x.fichero)).map((x) => {
    const sitios = x.sitios.filter((s) => s.forma !== FORMAS.CON_SUELO && s.forma !== FORMAS.NO_FILTRA)
      .map((s) => `${s.exportado} en la línea ${s.linea}${s.forma === FORMAS.SIN_JUZGAR ? ' (sin juzgar)' : ''}`);
    return `${x.fichero} → ${sitios.join(', ')}`;
  });
  assert.deepEqual(nuevos, [],
    `\n\n🔴 TEST QUE LLAMA AL FILTRO DE COMENTARIOS SIN SUELO (${nuevos.length}):\n${enLista1395(nuevos)}\n\n`
    + 'Con el filtro ciego esa llamada devuelve la cadena vacía, y una negación sobre la nada pasa\n'
    + `siempre. Así estuvo \`scrum589\` un mes.\n${COMO_SE_ARREGLA_1395}`);
});

test('SCRUM-1395 · ③ la lista de heredados no baja en silencio, y su número está escrito dos veces', () => {
  const hoy = new Set(SIN_SUELO_HOY);
  const deMas = LISTA_1395.filter((f) => !hoy.has(f));
  assert.deepEqual(deMas, [],
    `\n\n🔴 EN LA LISTA DE HEREDADOS Y YA NO LLAMA AL FILTRO SIN SUELO (${deMas.length}):\n${enLista1395(deMas)}\n\n`
    + 'O se ha pasado a una forma con suelo (bien: quítalo de tests/_filtro-sin-suelo-heredados.json y\n'
    + 'baja TECHO_HEREDADOS_1395, en este mismo commit), o se ha borrado o renombrado, o el censo ha\n'
    + 'dejado de verlo — y eso último es un instrumento roto, no una mejora.\n');
  assert.equal(LISTA_1395.length, TECHO_HEREDADOS_1395,
    `🔴 la lista tiene ${LISTA_1395.length} nombres y el techo escrito aquí dice ${TECHO_HEREDADOS_1395}. `
    + 'Si ha BAJADO, baja el techo. Si ha SUBIDO, no es un arreglo: es una decisión, y no es tuya.');
  for (const [f, motivo] of Object.entries(HEREDADOS_1395.sinJuzgar)) {
    assert.ok(typeof motivo === 'string' && motivo.length > 40, `🔴 \`${f}\` está «sin juzgar» sin decir qué se vio`);
  }
  for (const campo of ['medidoContra', 'porQueSeToleran', 'queLosRetira']) {
    assert.ok(typeof HEREDADOS_1395[campo] === 'string' && HEREDADOS_1395[campo].length > 30,
      `🔴 la lista de heredados ha perdido \`${campo}\`: una excepción sin motivo ni quién la retira es una promesa`);
  }
});

test('SCRUM-1395 · ④ `scrum589`, el que estuvo mudo, tiene suelo y NO es un heredado', () => {
  const fila = CENSO_1395.filas.find((x) => x.fichero === 'scrum589-nombre-por-documento.test.mjs');
  assert.ok(fila, '🔴 `scrum589` ya no existe o se renombró: este caso vigilaría un fichero que no está');
  assert.equal(fila.clase, FORMAS.CON_SUELO,
    '🔴 `scrum589` ha vuelto a llamar al filtro sin suelo. Es el guard que estuvo mudo del 6-sep al 6-oct-2026.');
  assert.equal(LISTA_1395.includes(fila.fichero), false, '🔴 `scrum589` se ha metido en la lista de heredados');
  // Y el mismo token, en positivo: la lista sí contiene a los que tiene que contener.
  assert.equal(LISTA_1395.includes('scrum719-el-suelo-de-los-doce.test.mjs'), true);
});

// ── el analizador VE cada forma (y no acusa a las que tienen suelo) ───────────────────────
const IMPORTA_1395 = (nombres) => `import { ${nombres} } from './_guard-texto.mjs';\n`;
const FORMAS_VISTAS_1395 = [
  ['`soloEjecutable(x)` directo', `${IMPORTA_1395('soloEjecutable')}const c = soloEjecutable(src);\n`, FORMAS.SIN_SUELO],
  ['`soloEjecutable` con alias', `${IMPORTA_1395('soloEjecutable as limpio')}const c = limpio(src);\n`, FORMAS.SIN_SUELO],
  ['`soloEjecutable` pasado sin llamar', `${IMPORTA_1395('soloEjecutable')}const cs = textos.map(soloEjecutable);\n`, FORMAS.SIN_SUELO],
  ['por `import * as`', "import * as g from './_guard-texto.mjs';\nconst c = g.soloEjecutable(src);\n", FORMAS.SIN_SUELO],
  ['por `await import()`', "const { soloEjecutable } = await import('./_guard-texto.mjs');\nconst c = soloEjecutable(src);\n", FORMAS.SIN_SUELO],
  ['`leerFuente(r)` sin opciones', `${IMPORTA_1395('leerFuente')}const c = leerFuente(ruta);\n`, FORMAS.SIN_SUELO],
  ['`leerFuente(r, {})` sin ancla', `${IMPORTA_1395('leerFuente')}const c = leerFuente(ruta, {});\n`, FORMAS.SIN_SUELO],
  ['`ejecutableDe` con `sinAncla`', `${IMPORTA_1395('ejecutableDe')}const c = ejecutableDe(src, { sinAncla: true });\n`, FORMAS.SIN_SUELO],
  ['opciones que no se pueden leer', `${IMPORTA_1395('leerFuente')}const c = leerFuente(ruta, opciones);\n`, FORMAS.SIN_JUZGAR],
  ['una con suelo y otra sin él', `${IMPORTA_1395('ejecutableDe, soloEjecutable')}ejecutableDe(a, { ancla: 'x' });\nsoloEjecutable(b);\n`, FORMAS.SIN_SUELO],
  ['✅ `ejecutableDe` con ancla', `${IMPORTA_1395('ejecutableDe')}const c = ejecutableDe(src, { ancla: 'x' });\n`, FORMAS.CON_SUELO],
  ['✅ `leerFuente` con ancla', `${IMPORTA_1395('leerFuente')}const c = leerFuente(ruta, { ancla: 'x' });\n`, FORMAS.CON_SUELO],
  ['✅ `ejecutablesDe`', `${IMPORTA_1395('ejecutablesDe')}const cs = ejecutablesDe(entradas, { donde: 'x' });\n`, FORMAS.CON_SUELO],
  ['✅ `leerFuente` con comentarios (no filtra)', `${IMPORTA_1395('leerFuente')}const c = leerFuente(ruta, { conComentarios: true });\n`, FORMAS.NO_FILTRA],
  ['✅ sólo lo nombra en un comentario', `${IMPORTA_1395('ejecutableDe')}// antes: soloEjecutable(src)\nconst c = ejecutableDe(src, { ancla: 'x' });\n`, FORMAS.CON_SUELO],
  ['✅ un `soloEjecutable` propio, que no viene del filtro', 'const soloEjecutable = (s) => s;\nconst c = soloEjecutable(src);\n', null],
];
// Un caso por fila, con el nombre ESCRITO (SCRUM-1415): con el bucle, el nombre se construía al
// ejecutar y la señal por nombres no podía decir que faltaba uno si la tanda lo perdía.
const clasifica1395 = casosEscritos(FORMAS_VISTAS_1395, ([nombre]) => `SCRUM-1395 · ⑤ el analizador clasifica · ${nombre}`, ([, fuente, esperada]) => {
  const a = analizarFiltro(fuente, 'caso.mjs');
  assert.equal(a.ok, true, 'el caso de prueba tiene que parsear');
  assert.equal(clasificarFiltro(a), esperada);
});
test('SCRUM-1395 · ⑤ el analizador clasifica · `soloEjecutable(x)` directo', clasifica1395(0));
test('SCRUM-1395 · ⑤ el analizador clasifica · `soloEjecutable` con alias', clasifica1395(1));
test('SCRUM-1395 · ⑤ el analizador clasifica · `soloEjecutable` pasado sin llamar', clasifica1395(2));
test('SCRUM-1395 · ⑤ el analizador clasifica · por `import * as`', clasifica1395(3));
test('SCRUM-1395 · ⑤ el analizador clasifica · por `await import()`', clasifica1395(4));
test('SCRUM-1395 · ⑤ el analizador clasifica · `leerFuente(r)` sin opciones', clasifica1395(5));
test('SCRUM-1395 · ⑤ el analizador clasifica · `leerFuente(r, {})` sin ancla', clasifica1395(6));
test('SCRUM-1395 · ⑤ el analizador clasifica · `ejecutableDe` con `sinAncla`', clasifica1395(7));
test('SCRUM-1395 · ⑤ el analizador clasifica · opciones que no se pueden leer', clasifica1395(8));
test('SCRUM-1395 · ⑤ el analizador clasifica · una con suelo y otra sin él', clasifica1395(9));
test('SCRUM-1395 · ⑤ el analizador clasifica · ✅ `ejecutableDe` con ancla', clasifica1395(10));
test('SCRUM-1395 · ⑤ el analizador clasifica · ✅ `leerFuente` con ancla', clasifica1395(11));
test('SCRUM-1395 · ⑤ el analizador clasifica · ✅ `ejecutablesDe`', clasifica1395(12));
test('SCRUM-1395 · ⑤ el analizador clasifica · ✅ `leerFuente` con comentarios (no filtra)', clasifica1395(13));
test('SCRUM-1395 · ⑤ el analizador clasifica · ✅ sólo lo nombra en un comentario', clasifica1395(14));
test('SCRUM-1395 · ⑤ el analizador clasifica · ✅ un `soloEjecutable` propio, que no viene del filtro', clasifica1395(15));
clasifica1395.todos();

test('SCRUM-1395 · ⑥ un fuente que no parsea sale SIN JUZGAR, nunca limpio', () => {
  const roto = analizarFiltro(`${IMPORTA_1395('soloEjecutable')}const c = soloEjecutable(src;\n`, 'roto.mjs');
  assert.equal(roto.ok, false, '🔴 un fuente con un paréntesis sin cerrar se ha dado por leído');
  assert.equal(clasificarFiltro(roto), FORMAS.SIN_JUZGAR);
  // El mismo fuente, bien cerrado, sí se juzga: lo que cambia el veredicto es el parseo.
  const sano = analizarFiltro(`${IMPORTA_1395('soloEjecutable')}const c = soloEjecutable(src);\n`, 'sano.mjs');
  assert.equal(sano.ok, true);
  assert.equal(clasificarFiltro(sano), FORMAS.SIN_SUELO);
});
