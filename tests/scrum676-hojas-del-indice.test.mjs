// tests/scrum676-hojas-del-indice.test.mjs — SCRUM-676 · las hojas del índice, con UN solo lector.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// 🔴 QUÉ IMPIDE ESTO, Y ESTÁ MEDIDO
//
// Los `<link>` eran la última población de `index.html` sin extractor único. Había TRES lecturas,
// y sobre el índice real las tres daban lo mismo: `/tokens.css` y `./css/styles.css`.
//
// **Ese acuerdo no valía nada**, y es la lección de SCRUM-670 repetida: tres instrumentos que
// coinciden porque el caso fácil no los distingue. Medido sobre las formas que hoy NO están:
//
//   caso                    recursosDe   _banco-vistas   sellado (producción)
//   comillas SIMPLES            1             0                0
//   `<link>` COMENTADA          0             1                1
//   `?v=` en el href            0             1                1
//   `href` antes de `rel`       1             0                1
//   `rel="preload"`             1             0                1
//
// Ninguna columna está bien entera. Y el índice real TIENE una `<link>` con `href` antes de `rel`
// —la hoja remota de fuentes—, así que el caso no es hipotético: está en el fichero hoy.
//
// LO QUE COSTABA: una hoja que el extractor no vea queda fuera de lo que se afirme sobre ella; y
// al revés, una comentada contada como real hace exigir un fichero que la página no pide.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import {
  hojasDeLaPagina, cegueraDeLasHojas, cegueraDelExtractor, sinComentarios,
} from './_scripts-de-la-pagina.mjs';

const RAIZ = path.resolve(import.meta.dirname, '..');
const INDICE = path.join(RAIZ, 'public/dashboard/index.html');
const HTML = fs.readFileSync(INDICE, 'utf8');

/** Un marcado de mentira alrededor de un fragmento. Las formas se prueban en corpus, no en el índice. */
const pagina = (...frags) => '<html><head>\n' + frags.join('') + '</head><body>x</body></html>';
const HOJA = '  <link rel="stylesheet" href="/tokens.css"/>\n';

// ── EL ÍNDICE REAL ──────────────────────────────────────────────────────────────────────

test('SCRUM-676 · el índice declara DOS hojas locales, y son las dos que se esperan', () => {
  const r = hojasDeLaPagina(HTML);
  assert.deepEqual(r.locales, ['/tokens.css', './css/styles.css'],
    '🔴 las hojas locales del índice han cambiado. Si es a propósito, actualiza esta lista; si no,\n' +
    '   el marcado cambió de forma y hay que mirarlo.');
  assert.equal(r.ilegibles.length, 0,
    '🔴 hay `<link>` en el índice que el extractor no sabe leer:\n    ' + r.ilegibles.join('\n    '));
});

test('SCRUM-676 · 🔴 la hoja REMOTA de fuentes se ve, y NO se mete con las locales', () => {
  // El agravante propio del CSS (SCRUM-666): el índice carga dos hojas locales más UNA remota.
  // Un extractor que no las separe mete la de Google en una población donde no pinta nada — y
  // `_banco-vistas` NI SIQUIERA LA VEÍA, porque esa etiqueta lleva `href` antes de `rel`.
  const r = hojasDeLaPagina(HTML);
  assert.equal(r.remotas.length, 1, `🔴 esperaba UNA hoja remota y veo ${r.remotas.length}.`);
  assert.match(r.remotas[0], /^https:\/\/fonts\.googleapis\.com\//,
    '🔴 la hoja remota del índice ya no es la de fuentes de Google.');
  for (const l of r.locales) {
    assert.doesNotMatch(l, /^https?:|^\/\//, `🔴 «${l}» es remota y está en las LOCALES.`);
  }
});

test('SCRUM-676 · el índice tiene `<link>` que NO son hojas, y se clasifican aparte', () => {
  // `icon`, `manifest`, `preconnect`, `apple-touch-icon`. Contarlas como hojas sería exigir CSS
  // donde hay un PNG.
  const r = hojasDeLaPagina(HTML);
  assert.ok(r.otras.length >= 4,
    `🔴 SUELO: veo ${r.otras.length} <link> que no son hojas y en el índice hay al menos cuatro. ` +
    'Si salen cero, el extractor no está viendo las etiquetas, no es que no existan.');
  const rels = r.otras.map((o) => String(o.rel || '').toLowerCase());
  for (const esperado of ['icon', 'manifest']) {
    assert.ok(rels.some((x) => x.split(/\s+/).includes(esperado)),
      `🔴 no veo ningún <link rel="${esperado}"> entre las «otras», y el índice lo tiene.`);
  }
});

// ── LAS FORMAS QUE HOY NO ESTÁN, QUE SON LAS QUE HACEN DAÑO ─────────────────────────────

test('SCRUM-676 · 🔴 comillas SIMPLES: se sigue viendo (dos lecturas daban CERO)', () => {
  const r = hojasDeLaPagina(pagina("  <link rel='stylesheet' href='/tokens.css'/>\n"));
  assert.deepEqual(r.locales, ['/tokens.css'],
    '🔴 unas comillas simples dejan la población a cero. Es EXACTAMENTE el defecto de SCRUM-670:\n' +
    '   devolver un número menor y callarse. Si no se sabe leer, va a `ilegibles`.');
});

test('SCRUM-676 · 🔴 `<link>` partida en DOS líneas: se sigue viendo', () => {
  const r = hojasDeLaPagina(pagina('  <link rel="stylesheet"\n        href="/tokens.css"/>\n'));
  assert.deepEqual(r.locales, ['/tokens.css'],
    '🔴 una etiqueta repartida en dos líneas deja de verse. El navegador la carga igual.');
});

test('SCRUM-676 · 🔴 `<link>` COMENTADA: NO se cuenta (dos lecturas la contaban)', () => {
  const r = hojasDeLaPagina(pagina('  <!-- <link rel="stylesheet" href="/tokens.css"/> -->\n'));
  assert.deepEqual(r.locales, [],
    '🔴 una hoja COMENTADA se está contando como cargada. El navegador no la pide, así que todo\n' +
    '   lo que se exija de ella —que exista, que se selle, que se precachee— es exigir de más.');
  assert.deepEqual(r.otras, [], '🔴 la comentada se ha colado en «otras».');
});

test('SCRUM-676 · 🔴 atributos de más (`media`, `crossorigin`): se sigue viendo', () => {
  const r = hojasDeLaPagina(pagina('  <link rel="stylesheet" href="/tokens.css" media="all" crossorigin/>\n'));
  assert.deepEqual(r.locales, ['/tokens.css'],
    '🔴 un atributo de más deja la etiqueta invisible.');
});

test('SCRUM-676 · 🔴 `?v=` en el href: se sigue viendo (la lectura vieja daba CERO)', () => {
  // No es un caso inventado: el SELLADO de producción añade `?v=<huella>` a cada referencia local.
  // La regex que vivía en `recursosDe` exigía que el href ACABARA en `.css`, así que sobre un
  // marcado ya sellado habría contado CERO hojas y no habría dicho nada.
  const r = hojasDeLaPagina(pagina('  <link rel="stylesheet" href="/tokens.css?v=abc123"/>\n'));
  assert.deepEqual(r.locales, ['/tokens.css?v=abc123'],
    '🔴 un href con query deja la hoja fuera de la población.');
});

test('SCRUM-676 · 🔴 `href` ANTES de `rel`: se sigue viendo (y el índice tiene una así)', () => {
  const r = hojasDeLaPagina(pagina('  <link href="/tokens.css" rel="stylesheet"/>\n'));
  assert.deepEqual(r.locales, ['/tokens.css'],
    '🔴 el orden de los atributos no cambia lo que hace el navegador, y aquí sí cambiaba la\n' +
    '   población. Era el defecto de `_banco-vistas`, y el índice real tiene una etiqueta así.');
});

test('SCRUM-676 · valor SIN comillas: HTML válido, y se ve', () => {
  const r = hojasDeLaPagina(pagina('  <link rel=stylesheet href=/tokens.css>\n'));
  assert.deepEqual(r.locales, ['/tokens.css'], '🔴 un valor sin comillas es HTML válido.');
});

test('SCRUM-676 · `rel` es una LISTA de fichas: `preload stylesheet` es una hoja', () => {
  const r = hojasDeLaPagina(pagina('  <link rel="preload stylesheet" href="/tokens.css"/>\n'));
  assert.deepEqual(r.locales, ['/tokens.css'],
    '🔴 `rel` admite varias fichas y una de ellas es `stylesheet`: el navegador la carga.');
});

test('SCRUM-676 · 🔴 `rel="preload"` a secas NO es una hoja cargada', () => {
  // La lectura vieja de `recursosDe` la contaba, porque sólo miraba que el href acabara en `.css`.
  const r = hojasDeLaPagina(pagina('  <link rel="preload" as="style" href="/tokens.css"/>\n'));
  assert.deepEqual(r.locales, [],
    '🔴 un `preload` se está contando como hoja aplicada. Precargar no es aplicar: la página no\n' +
    '   tiene esos estilos hasta que además hay un `rel="stylesheet"`.');
  assert.equal(r.otras.length, 1, '🔴 el `preload` tiene que quedar registrado en «otras», no perdido.');
});

// ── SUELO E ILEGIBLES: «no hay» y «no supe mirar» no pueden salir por la misma línea ────

test('SCRUM-676 · 🔴 SUELO: cero `<link>` es CEGUERA, no una página sin estilos', () => {
  const vacio = hojasDeLaPagina('<html><head><title>x</title></head><body>nada</body></html>');
  assert.deepEqual(vacio.locales, [], 'el corpus no tiene hojas: eso es lo que se está montando');
  const msg = cegueraDeLasHojas(vacio, 2, 'una página de mentira');
  assert.match(msg || '', /EXTRACTOR CIEGO/,
    '🔴 con cero hojas y un mínimo de dos, el ayudante tiene que DECIRLO. Si devolviera `null`,\n' +
    '   «no hay hojas» y «no supe leer el marcado» saldrían por la misma línea.');
  assert.match(msg || '', /significados opuestos/, '🔴 el mensaje no explica por qué importa.');
});

test('SCRUM-676 · 🔴 CONTROL DEL SUELO: sobre el índice real NO se declara ciego', () => {
  // Sin esto, un `cegueraDeLasHojas` que devolviera siempre un mensaje daría rojo permanente y
  // el test de arriba pasaría igual: estaría aprobando un instrumento roto.
  assert.equal(cegueraDeLasHojas(hojasDeLaPagina(HTML), 2, 'dashboard/index.html'), null,
    '🔴 el índice tiene dos hojas locales y el ayudante lo llama ciego.');
});

test('SCRUM-676 · 🔴 lo que no se sabe leer va a ILEGIBLES, no se cuenta de menos', () => {
  const sinValor = hojasDeLaPagina('<link href>');
  assert.equal(sinValor.ilegibles.length, 1,
    '🔴 un `<link>` que MENCIONA href y no deja leerlo tiene que declararse, no desaparecer.');
  const relRaro = hojasDeLaPagina('<link href="/a.css" rel>');
  assert.equal(relRaro.ilegibles.length, 1,
    '🔴 sin poder leer `rel` no se puede clasificar. Meterla en «otras» sería decidir que NO es\n' +
    '   una hoja sin haberlo leído: un verde por la puerta de atrás.');
  assert.equal(relRaro.locales.length, 0, '🔴 y desde luego no se cuenta como hoja.');
  assert.match(cegueraDeLasHojas(relRaro, 0, 'x') || '', /NO SABE LEER/,
    '🔴 con ilegibles, el ayudante tiene que gritar aunque la población supere el mínimo.');
});

test('SCRUM-676 · un `<link>` SIN href no es ilegible: es que no pide nada', () => {
  // El otro lado del mismo filo: si «no tiene href» también fuera ilegible, el guard gritaría por
  // etiquetas correctas y acabaría ignorándose.
  const r = hojasDeLaPagina('<link rel="stylesheet">');
  assert.deepEqual(r.ilegibles, [], '🔴 una etiqueta sin `href` no es ilegible: no pide recurso.');
  assert.deepEqual(r.locales, [], '🔴 y tampoco es una hoja.');
});

// ── CONTROL NEGATIVO ────────────────────────────────────────────────────────────────────

test('SCRUM-676 · CONTROL NEGATIVO: reordenar las `<link>` no cambia la población', () => {
  // ⚠️ SE REORDENA SOBRE EL MARCADO SIN COMENTARIOS, y el motivo está medido en SCRUM-670: si se
  // mueven líneas del HTML crudo, una etiqueta que estaba DENTRO de un comentario puede salir de
  // él, y entonces la población cambia DE VERDAD. El control caería acusando de nada.
  const limpio = sinComentarios(HTML);
  const original = hojasDeLaPagina(limpio);
  assert.ok(original.locales.length >= 2,
    `🔴 SUELO del propio control: veo ${original.locales.length} hojas y con menos de dos ` +
    'reordenar no prueba nada — dos listas vacías también son iguales.');

  // ⚠️ La línea se busca por CADENA y no con una regex, y no es capricho: el censo de más abajo
  // cuenta las regex que leen `<link>` en `tests/`, y una escrita aquí lo dejaría contando DOS —
  // el guard cazándose a sí mismo, que en esta casa ya ha pasado cuatro veces.
  const lineas = limpio.split('\n');
  const esLink = (l) => l.toLowerCase().includes('<link');
  const iLinks = lineas.map((l, i) => (esLink(l) ? i : -1)).filter((i) => i >= 0);
  assert.ok(iLinks.length >= 3, `🔴 SUELO: sólo veo ${iLinks.length} líneas con <link> para barajar.`);
  const alReves = [...iLinks].reverse();
  const copia = [...lineas];
  iLinks.forEach((destino, k) => { copia[destino] = lineas[alReves[k]]; });

  const reordenado = hojasDeLaPagina(copia.join('\n'));
  assert.deepEqual([...reordenado.locales].sort(), [...original.locales].sort(),
    '🔴 el CONJUNTO de hojas cambia al reordenar las etiquetas. El orden importa para la cascada,\n' +
    '   pero no para QUÉ hojas carga la página, que es lo que este extractor contesta.');
  assert.equal(reordenado.remotas.length, original.remotas.length, '🔴 y las remotas tampoco.');
});

test('SCRUM-676 · CONTROL NEGATIVO: un `<script>` de más no mueve las hojas', () => {
  const con = hojasDeLaPagina(pagina(HOJA, '  <script src="./js/x.js"></script>\n'));
  const sin = hojasDeLaPagina(pagina(HOJA));
  assert.deepEqual(con.locales, sin.locales, '🔴 los scripts no son población de este extractor.');
});

// ── EL TRINQUETE: UN SOLO LECTOR, Y QUE SIGA SIENDO UNO ─────────────────────────────────

/** Las regex literales de un fichero, por AST: no se busca texto, se enumera sintaxis. */
function regexDe(fichero) {
  const src = fs.readFileSync(fichero, 'utf8');
  const sf = ts.createSourceFile(fichero, src, ts.ScriptTarget.Latest, true);
  const out = [];
  const v = (n) => {
    if (n.kind === ts.SyntaxKind.RegularExpressionLiteral) out.push(n.text);
    ts.forEachChild(n, v);
  };
  v(sf);
  return out;
}

test('SCRUM-676 · 🔴 en `tests/` hay UNA sola regex que lee `<link>`, y vive en el extractor', () => {
  const dir = path.join(RAIZ, 'tests');
  const ficheros = fs.readdirSync(dir).filter((f) => f.endsWith('.mjs')).map((f) => path.join(dir, f));
  assert.ok(ficheros.length > 100,
    `🔴 CENSO CIEGO: sólo veo ${ficheros.length} ficheros en tests/. Con un recorrido vacío, ` +
    '«no hay lectores duplicados» sale verde por no haber mirado.');

  let regexTotales = 0;
  const lectores = [];
  for (const f of ficheros) {
    for (const re of regexDe(f)) {
      regexTotales++;
      // Por CADENA, no con una regex: una regex aquí se contaría a sí misma y el censo diría dos
      // lectores donde hay uno. El propio guard sería el segundo — ya pasó al escribirlo.
      if (re.toLowerCase().includes('<link')) lectores.push(path.basename(f) + '  ' + re);
    }
  }
  assert.ok(regexTotales > 500,
    `🔴 CENSO CIEGO: sólo ${regexTotales} regex vistas en tests/; el analizador no está leyendo.`);

  assert.deepEqual(lectores.length, 1,
    '🔴 HAY MÁS DE UNA LECTURA DE `<link>` EN tests/:\n    ' + lectores.join('\n    ') +
    '\n\n  Antes de SCRUM-676 había tres, y sobre el índice real las tres coincidían: el acuerdo\n' +
    '  no es confirmación cuando fallan por motivos distintos en los casos que no se dan hoy.\n' +
    '  Deriva de `hojasDeLaPagina` y, si le falta una forma, enséñasela A ELLA.');
  assert.match(lectores[0], /^_scripts-de-la-pagina\.mjs/,
    '🔴 la única lectura de `<link>` ya no vive en el extractor único.');
});

test('SCRUM-676 · los DOS ayudantes de ceguera existen y cada uno nombra SU población', () => {
  // Una copia inevitable necesita trinquete: `cegueraDeLasHojas` no se fusionó con su hermana
  // porque tres guards afirman sobre el texto de aquélla. Que sean dos es la decisión; que una
  // se coma a la otra en silencio, no.
  assert.equal(typeof cegueraDelExtractor, 'function');
  assert.equal(typeof cegueraDeLasHojas, 'function');
  const deScripts = cegueraDelExtractor({ clasicos: [], ilegibles: [] }, 5, 'x') || '';
  const deHojas = cegueraDeLasHojas({ locales: [], ilegibles: [] }, 5, 'x') || '';
  // ⚠️ El ancla va SIN el `>` final, y no es cosmética: el trinquete de SCRUM-553 cuenta las
  // búsquedas de etiquetas con el `>` PEGADO, y este fichero lo hizo subir de 20 a 21 al
  // escribirlo — primero con una regex, y después con el mismo literal dentro de un `includes`,
  // que también es un buscador. El arreglo es quitar el `>`, NO subir el tope: ese número sólo
  // puede bajar. Y aquí quitarlo no pierde nada: lo que se comprueba es que el mensaje nombra su
  // población, no que la etiqueta esté cerrada.
  assert.ok(deScripts.includes('<script src'), '🔴 el ayudante de scripts ya no nombra su población.');
  assert.ok(deHojas.includes('hojas LOCALES'), '🔴 el ayudante de hojas ya no nombra su población.');
  assert.notEqual(deScripts, deHojas, '🔴 los dos mensajes son el mismo: uno de los dos miente.');
});
