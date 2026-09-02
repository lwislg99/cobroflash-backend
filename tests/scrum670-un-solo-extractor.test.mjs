// tests/scrum670-un-solo-extractor.test.mjs — SCRUM-670
//
// ═════════════════════════════════════════════════════════════════════════════════════════
// UN SOLO EXTRACTOR DE LOS `<script>` DEL ÍNDICE
//
// SCRUM-662 unificó la LISTA —quiénes son los scripts del dashboard— y cerró una clase entera de
// conflictos de merge. Debajo seguían **seis regex distintas leyendo el mismo `index.html`**, cada
// una con su idea de qué es un `<script>`. Mientras haya seis lecturas, la lista de uno no es la
// lista de otro y el problema sólo cambia de forma.
//
// LA VÍCTIMA no es un profesional de hoy: es la próxima vista que alguien añada. Un `<script>` con
// `defer` quedaba FUERA del banco de vistas y del guard de colisiones —sin cargarse y sin
// vigilancia, en silencio— y DENTRO del guard del shell, que lo exigía en `sw.js`. Y no es
// hipótesis: SCRUM-559 midió que `defer` en UNO solo dejaba 16/16 en verde con ese fichero fuera
// de toda vigilancia. Aquel ticket arregló el síntoma (umbral → recuento exacto); esto es la causa.
//
// Este fichero vigila las tres cosas que el extractor único tiene que cumplir:
//   ① VE lo que el navegador carga        — `defer`, atributos, dos líneas, comillas simples.
//   ② NO ve lo que el navegador no carga  — comentado, inline; y separa `module` y remoto.
//   ③ NO SE CALLA lo que no sabe leer     — se declara ILEGIBLE en vez de contar de menos.
// Más el NEGATIVO (reordenar no toca la población) y el TRINQUETE (no vuelven las seis regex).
//
// Sin gate: lee ficheros y escribe en un temporal del sistema. Ni BD, ni red, ni servidor.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { scriptsDeLaPagina, rutaDelDashboard, cegueraDelExtractor, sinComentarios } from './_scripts-de-la-pagina.mjs';
import { scriptsDelDashboard, SCRIPTS_DEL_DASHBOARD } from './_banco-vistas.mjs';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const INDICE = path.join(RAIZ, 'public', 'dashboard', 'index.html');
const MINIMO = 45;

/** Escribe un índice sintético en una raíz temporal y devuelve esa raíz. */
function raizCon(html) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'scrum670-'));
  fs.mkdirSync(path.join(dir, 'public', 'dashboard'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'public', 'dashboard', 'index.html'), html);
  return dir;
}

// ═══ ① VE LO QUE EL NAVEGADOR CARGA ══════════════════════════════════════════════════════
//
// Las cuatro filas de la tabla en las que los extractores viejos daban 0 y el navegador da 1.
// Van con corpus SINTÉTICO a propósito: hoy el índice no tiene ninguna de estas formas, así que
// medirlo contra el índice real diría «las veo todas» sobre un conjunto que no las contiene — el
// verde hueco que este repo lleva tickets desterrando.

test('SCRUM-670 · ① ve las formas que los extractores viejos perdían', () => {
  const casos = [
    ['normal', '<script src="./js/a.js"></script>', 'js/a.js'],
    ['defer detrás', '<script src="./js/b.js" defer></script>', 'js/b.js'],
    ['defer delante', '<script defer src="./js/c.js"></script>', 'js/c.js'],
    ['un atributo de más', '<script src="./js/d.js" data-x="1"></script>', 'js/d.js'],
    ['espacio antes del >', '<script src="./js/e.js" ></script>', 'js/e.js'],
    ['partida en dos líneas', '<script\n    src="./js/f.js"></script>', 'js/f.js'],
    ['comillas simples', "<script src='./js/g.js'></script>", 'js/g.js'],
    ['sin comillas', '<script src=./js/h.js></script>', 'js/h.js'],
  ];
  for (const [etq, html, esperado] of casos) {
    const { clasicos, ilegibles } = scriptsDeLaPagina(html);
    assert.deepEqual(ilegibles, [], `🔴 «${etq}» se declaró ilegible y es una forma corriente.`);
    assert.deepEqual(clasicos.map(rutaDelDashboard), [esperado],
      `🔴 «${etq}»: el extractor no lo ve. El navegador SÍ lo carga, así que esa vista se quedaría ` +
      'sin cargar en el banco y sin vigilar en el guard de colisiones, en silencio.');
  }
});

test('SCRUM-670 · 🔴 ROJO 1 y 2 POR EL MECANISMO: con `defer` y partido, el BANCO los sigue viendo', () => {
  // End-to-end sobre el consumidor de verdad —`scriptsDelDashboard`, que es quien carga las
  // vistas— y no sólo sobre la función pura. Con la regex anterior este test daba 0 de 3.
  const raiz = raizCon([
    '<html><body>',
    '  <script src="./js/api.js"></script>',
    '  <script src="./js/conDefer.js" defer></script>',
    '  <script',
    '      src="./js/partido.js"></script>',
    '</body></html>',
  ].join('\n'));
  assert.deepEqual(scriptsDelDashboard(raiz),
    ['js/api.js', 'js/conDefer.js', 'js/partido.js'],
    '🔴 el banco de vistas pierde un `<script>` por llevar `defer` o por estar partido en dos ' +
    'líneas. Es EL defecto de este ticket: SCRUM-559 midió que uno solo así dejaba 16/16 en verde.');
});

test('SCRUM-670 · 🔴 ROJO 3: comillas simples — o se cuentan, o el guard CAE; nunca un total menor y callado', () => {
  const html = "<script src='./js/uno.js'></script><script src='./js/dos.js'></script>";
  const res = scriptsDeLaPagina(html);
  assert.deepEqual(res.clasicos.map(rutaDelDashboard), ['js/uno.js', 'js/dos.js'],
    '🔴 las comillas simples se pierden. Tres extractores daban CERO a la vez ante esta forma, y ' +
    'un cero unánime parece una confirmación cuando es el síntoma.');

  // Y la otra mitad de la promesa: lo que NO se sepa leer se declara. Aquí una forma que este
  // extractor no sabe resolver, para que el mecanismo de la ceguera se ejercite de verdad.
  const raro = scriptsDeLaPagina('<script src></script>');
  assert.equal(raro.clasicos.length, 0);
  assert.equal(raro.inline, 0, '🔴 una etiqueta con `src` se ha contado como inline: eso es ' +
    'exactamente confundir «no tiene src» con «no sé leer su src».');
  assert.deepEqual(raro.ilegibles, ['<script src>']);
  assert.match(cegueraDelExtractor(raro, 0, 'corpus'), /NO SABE LEER/,
    '🔴 el guard no CAE ante una etiqueta ilegible: entonces devolvería un total menor y se ' +
    'callaría, que es justo lo que este ticket prohíbe.');
});

// ═══ ② NO VE LO QUE EL NAVEGADOR NO CARGA ════════════════════════════════════════════════

test('SCRUM-670 · ② un `<script>` COMENTADO no es población — cuatro de los seis lo contaban', () => {
  const html = '<script src="./js/vivo.js"></script>\n<!-- <script src="./js/muerto.js"></script> -->';
  const { clasicos } = scriptsDeLaPagina(html);
  assert.deepEqual(clasicos.map(rutaDelDashboard), ['js/vivo.js'],
    '🔴 se está contando un `<script>` comentado. El navegador no lo carga: el banco intentaría ' +
    'ejecutar un fichero que nadie pide y el guard del shell lo exigiría en el precache. ' +
    'SCRUM-301 ya lo midió en rojo por su cuenta — «comentar la etiqueta la dejaba en verde».');
});

test('SCRUM-670 · ② inline, remoto y `type=module` van cada uno a su cubo', () => {
  const html = [
    '<script src="./js/clasico.js"></script>',
    '<script type="module" src="./js/moderno.js"></script>',
    '<script src="https://cdn.ejemplo.test/x.js"></script>',
    '<script>arranca()</script>',
  ].join('\n');
  const r = scriptsDeLaPagina(html);
  assert.deepEqual(r.clasicos, ['./js/clasico.js']);
  assert.deepEqual(r.modulos, ['./js/moderno.js'],
    '🔴 un `type="module"` ha entrado en los clásicos. NO comparte ámbito global: el guard de ' +
    'colisiones lo acusaría en falso, y un guard que acusa en falso no se corrige — se desactiva.');
  assert.deepEqual(r.remotos, ['https://cdn.ejemplo.test/x.js'],
    '🔴 un script remoto ha entrado en la población local: ni se carga en el banco ni se precachea.');
  assert.equal(r.inline, 1);
  assert.deepEqual(r.ilegibles, []);
});

test('SCRUM-670 · ② `defer` y `async` se ANOTAN: el banco no sabe simular su orden', () => {
  // No cambian la población —el navegador los carga— pero sí CUÁNDO se ejecutan: van después del
  // documento, y el banco los ejecutaría en su sitio del índice. Se declara en vez de fingir.
  const r = scriptsDeLaPagina('<script src="./js/a.js"></script><script src="./js/b.js" async></script>');
  assert.deepEqual(r.aplazados, ['./js/b.js']);
  assert.equal(r.clasicos.length, 2, '🔴 anotarlo no puede sacarlo de la población: el navegador lo carga.');
});

// ═══ ③ SUELOS ════════════════════════════════════════════════════════════════════════════

test('SCRUM-670 · 🔴 SUELO: cero población se declara CIEGO, no se contesta', () => {
  const vacio = scriptsDeLaPagina('<html><body>sin scripts</body></html>');
  assert.equal(vacio.clasicos.length, 0);
  const msg = cegueraDelExtractor(vacio, MINIMO, 'una página de mentira');
  assert.match(msg, /EXTRACTOR CIEGO/,
    '🔴 con CERO scripts el extractor no se declara ciego. «No hay defecto» y «no supe mirar» son ' +
    'el mismo número con significados opuestos, y aquí el cero se leería como lo primero.');
  assert.match(msg, /45/, '🔴 el aviso no dice cuántos esperaba.');
});

test('SCRUM-670 · 🔴 SUELO DEL SUELO: con la población buena NO acusa', () => {
  // Sin esto, un `cegueraDelExtractor` que devolviera siempre un mensaje haría rojo permanente y
  // uno que devolviera siempre null haría verdes todos los suelos del repo.
  const r = scriptsDeLaPagina(fs.readFileSync(INDICE, 'utf8'));
  assert.equal(cegueraDelExtractor(r, MINIMO, 'dashboard/index.html'), null);
  assert.ok(r.clasicos.length >= MINIMO,
    `🔴 el índice real tiene ${r.clasicos.length} scripts y el suelo es ${MINIMO}.`);
});

test('SCRUM-670 · el índice real: la población que ve el extractor es la DECLARADA (SCRUM-662)', () => {
  const leidos = scriptsDelDashboard(RAIZ).map((s) => s.replace(/^js\//, '')).sort();
  assert.deepEqual(leidos, [...SCRIPTS_DEL_DASHBOARD].sort(),
    '🔴 lo que el extractor lee del índice y lo que declara `SCRIPTS_DEL_DASHBOARD` han dejado de ' +
    'coincidir. Cambiar el extractor NO puede cambiar la población en silencio: si esto cae con ' +
    'este ticket dentro, el extractor nuevo ve de más o de menos que el viejo.');
});

test('SCRUM-670 · hoy el índice no tiene aplazados, ni módulos, ni remotos, ni ilegibles', () => {
  // Se afirma el estado de HOY para que el día que entre el primero haya que venir aquí a decirlo,
  // con su motivo, en vez de que se cuele y cambie lo que miden tres guards a la vez.
  const r = scriptsDeLaPagina(fs.readFileSync(INDICE, 'utf8'));
  assert.deepEqual(r.aplazados, [],
    '🔴 ha entrado un `<script defer|async>`. El banco lo ejecuta en su posición del documento, y ' +
    'el navegador NO: lo que mida sobre esa vista deja de ser fiel.');
  assert.deepEqual(r.modulos, [],
    '🔴 ha entrado un `type="module"`. No comparte ámbito global: el guard de colisiones deja de ' +
    'aplicarle su premisa, y hay que decidir qué se hace con él.');
  assert.deepEqual(r.remotos, [],
    '🔴 el índice carga un script de fuera: ni se precachea ni se puede cargar en el banco.');
  assert.deepEqual(r.ilegibles, []);
  assert.equal(r.inline, 1, '🔴 el número de `<script>` inline del índice ha cambiado (era 1: el ' +
    'registro del service worker). No es un fallo, pero que conste.');
});

// ═══ 🔴 NEGATIVO: EL ORDEN NO ES ASUNTO DE LA POBLACIÓN ══════════════════════════════════
//
// Si reordenar tumbara esto, se habría cambiado un defecto silencioso por un rojo en cada
// reordenación legítima — y un guard que acusa a quien no ha roto nada acaba desactivado. El orden
// de EJECUCIÓN lo fijan las dependencias declaradas del índice, y eso es otra pregunta.

test('SCRUM-670 · 🔴 NEGATIVO: reordenar los `<script>` NO cambia la población', () => {
  const crudo = fs.readFileSync(INDICE, 'utf8');
  const original = scriptsDeLaPagina(crudo).clasicos;
  assert.ok(original.length >= MINIMO, '🔴 sin población real este control no prueba nada.');

  // Se reordena el marcado DE VERDAD, no una lista en memoria: cada etiqueta se sustituye por la
  // de la posición simétrica. Es la mutación que haría un PR de reordenación — y las etiquetas no
  // son contiguas en el índice (hay comentarios y líneas en blanco entre medias), así que no vale
  // con recortar un bloque y darle la vuelta.
  //
  // 🔴 SOBRE EL MARCADO SIN COMENTARIOS, y lo digo porque me mordió al probarlo: reordenando el
  // HTML crudo, una etiqueta COMENTADA entra en el baile y sale de dentro del comentario —
  // entonces la población sí cambia y este control caería acusando de algo que no ha pasado. Un
  // negativo que se rompe con un `<!-- -->` en el índice es un futuro rojo por nada.
  const html = sinComentarios(crudo);
  const ETIQUETA = /<script\b[^>]*\bsrc\b[^>]*>\s*<\/script>/g;
  const etiquetas = html.match(ETIQUETA) || [];
  assert.ok(etiquetas.length >= MINIMO,
    `🔴 el reordenador sólo ha sabido mover ${etiquetas.length} etiquetas: no está reordenando el ` +
    'índice de verdad y el negativo pasaría por el motivo equivocado.');
  let i = 0;
  const alReves = html.replace(ETIQUETA, () => etiquetas[etiquetas.length - 1 - i++]);
  assert.ok(alReves !== html, '🔴 la reordenación no ha cambiado el marcado.');

  const reordenado = scriptsDeLaPagina(alReves).clasicos;
  assert.deepEqual([...reordenado].sort(), [...original].sort(),
    '🔴 reordenar los `<script>` ha cambiado la POBLACIÓN. La lista es de quiénes, no de en qué ' +
    'orden: mezclar las dos cosas convierte esto en un generador de rojos por reordenaciones ' +
    'legítimas, y así es como muere un guard.');
  assert.notDeepEqual(reordenado, original,
    '🔴 el control no ha reordenado nada: entonces «reordenar no rompe» es cierto por vacío.');
});

// ═══ 🔴 TRINQUETE: NO VUELVEN LAS SEIS REGEX ═════════════════════════════════════════════

test('SCRUM-670 · 🔴 TRINQUETE: nadie más vuelve a leer un `<script>` con regex propia', () => {
  // Por AST, no por texto: este fichero contiene el literal en cadenas y con `grep` se cazaría a
  // sí mismo (SCRUM-176/168). Sólo cuentan las expresiones regulares LITERALES.
  const AGUJA = '<script';
  const CANONICO = 'tests/_scripts-de-la-pagina.mjs';
  const VIGILADOS = [
    'tests/_banco-vistas.mjs',
    'tests/_carga-de-pagina.mjs',
    'tests/dashboard-colision-declaraciones.test.mjs',
    'tests/scrum274-shell-alineado.test.mjs',
    'tests/scrum274-huella-estaticos.test.mjs',
    'tests/scrum301-albaranes-seccion.test.mjs',
  ];

  function regexDeScript(rel) {
    const codigo = fs.readFileSync(path.join(RAIZ, rel), 'utf8');
    const sf = ts.createSourceFile(rel, codigo, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
    const out = [];
    (function walk(n) {
      if (n.kind === ts.SyntaxKind.RegularExpressionLiteral && n.getText().includes(AGUJA)) out.push(n.getText());
      n.forEachChild(walk);
    })(sf);
    return out;
  }

  // SUELO: el detector tiene que encontrar las del canónico. Si no ve NINGUNA en ningún sitio, su
  // «nadie la duplica» no es un hallazgo: es que no sabe mirar.
  assert.ok(regexDeScript(CANONICO).length >= 1,
    `🔴 DETECTOR CIEGO: no encuentro ninguna regex de \`${AGUJA}\` en ${CANONICO}, y ahí viven las ` +
    'únicas que debe haber. Entonces «nadie la duplica» sería cierto por ceguera.');

  for (const rel of VIGILADOS) {
    const halladas = regexDeScript(rel);
    assert.deepEqual(halladas, [],
      `🔴 ${rel} ha vuelto a leer un \`<script>\` con su propia regex:\n    ` + halladas.join('\n    ') +
      '\n\n  Eran SEIS, y cada una tenía una idea distinta de qué es un `<script>`: unas perdían\n' +
      '  el `defer`, otras contaban los comentados. Deriva de `scriptsDeLaPagina` y, si le falta\n' +
      '  una forma, ensánchala AHÍ — que es lo que hace que las seis no puedan volver a discrepar.');
  }
});
