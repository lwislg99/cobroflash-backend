// tests/scrum696-censo-del-arbol.test.mjs — SCRUM-696
//
// ═════════════════════════════════════════════════════════════════════════════════════════
// EL CENSO: ¿`soloCodigo()` CIEGA CÓDIGO EN ALGÚN FICHERO DEL ÁRBOL?
//
// `scrum693` prueba el mecanismo contra un puñado de fuentes escritos a mano, y eso tiene un
// límite conocido: sólo encuentra las formas que a alguien se le ocurrió escribir. Estaba VERDE
// sobre un mecanismo que fallaba en 783 de 1.111 ficheros del árbol, porque su corpus no tenía ni
// una plantilla interpolada. Este fichero cubre justo eso: el corpus es EL ÁRBOL, así que la
// forma que rompa no depende de que alguien la imagine — basta con que alguien la escriba.
//
// ── CÓMO SE SABE QUE UN FICHERO «CIEGA» SIN TENER UNA SEGUNDA COPIA DEL FILTRO ───────────
//
// Con un motor DISTINTO del que se audita. `soloCodigo()` conduce el SCANNER a mano; aquí se usa
// el PARSER completo (`createSourceFile`), que es quien decide de verdad dónde empieza y acaba
// cada literal —plantillas y expresiones regulares incluidas—. El invariante es corto:
//
//     🔴 dentro de un literal NO PUEDE HABER UN COMENTARIO, así que `soloCodigo()` no tiene
//        ningún motivo legítimo para cambiar ni un carácter de esos tramos.
//
// Si el texto de un literal sale distinto de como entró, el filtro se ha comido código real. No
// es una heurística ni un umbral: es una igualdad, y por eso puede exigirse CERO.
//
// ── LO QUE ESTE CENSO ENCONTRÓ, Y QUE LOS CASOS A MANO NO VIERON ─────────────────────────
//
// Tras arreglar las plantillas quedaban 83 ficheros ciegos por OTRA causa de la misma familia:
// `scan()` tampoco devuelve una expresión regular por su cuenta. El sitio real es
// `src/core/validation/schemas.ts:300`, con `!/^https?:\/\//i.test(v)`: las dos últimas barras
// quedan pegadas, el scanner leía un comentario y se llevaba el resto de la línea. Los dos
// arreglos están en `_solo-codigo.mjs` y este censo es lo que impide que vuelva un tercero.
// ═════════════════════════════════════════════════════════════════════════════════════════
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { soloCodigo } from './_solo-codigo.mjs';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const CARPETAS = ['src', 'public', 'tests', 'scripts'];

/**
 * EL FILTRO INGENUO, que es la TRAMPA de este censo y no un adorno: es el regex que
 * `_solo-codigo.mjs` existe para no ser. Corta en el primer `//` sin mirar si va dentro de una
 * cadena, de una plantilla o de un regex. Si el censo no lo caza, el censo no sirve.
 */
const filtroIngenuo = (fuente) => fuente.replace(/\/\/[^\n]*/g, (m) => ' '.repeat(m.length));

function ficherosDelArbol() {
  const salida = [];
  const anda = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      if (e.name === 'node_modules' || e.name === 'dist' || e.name.startsWith('.')) continue;
      const p = path.join(dir, e.name);
      if (e.isDirectory()) anda(p);
      else if (/\.(ts|js|mjs)$/.test(e.name)) salida.push(p);
    }
  };
  for (const c of CARPETAS) anda(path.join(RAIZ, c));
  return salida;
}

/** Los tramos de TEXTO de un fuente, según el PARSER: cadenas, trozos de plantilla y regex. */
function tramosDeTexto(fuente, nombre) {
  const sf = ts.createSourceFile(nombre, fuente, ts.ScriptTarget.Latest, false);
  const tramos = [];
  const visitar = (n) => {
    if (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n) || ts.isTemplateHead(n)
        || ts.isTemplateMiddle(n) || ts.isTemplateTail(n) || ts.isRegularExpressionLiteral(n)) {
      tramos.push([n.getStart(sf), n.getEnd()]);
    }
    ts.forEachChild(n, visitar);
  };
  visitar(sf);
  return tramos;
}

// Una sola pasada por el árbol, y los dos filtros medidos con los MISMOS tramos: así el control
// positivo no cuesta un segundo recorrido y, sobre todo, compara peras con peras.
const CENSO = (() => {
  const ficheros = ficherosDelArbol();
  let tramos = 0;
  const ciegosDelBueno = [];
  const ciegosDelIngenuo = [];
  for (const f of ficheros) {
    const src = fs.readFileSync(f, 'utf8');
    const rel = f.slice(RAIZ.length + 1).split(path.sep).join('/');
    const bueno = soloCodigo(src, path.basename(f));
    const malo = filtroIngenuo(src);
    if (bueno.length !== src.length) ciegosDelBueno.push([rel, 'CAMBIA LA LONGITUD']);
    let t;
    try { t = tramosDeTexto(src, path.basename(f)); } catch { continue; }
    tramos += t.length;
    for (const [a, b] of t) {
      const original = src.slice(a, b);
      if (bueno.slice(a, b) !== original) ciegosDelBueno.push([rel, original.slice(0, 70)]);
      if (malo.slice(a, b) !== original) { ciegosDelIngenuo.push(rel); break; }
    }
  }
  return { ficheros: ficheros.length, tramos, ciegosDelBueno, ciegosDelIngenuo: new Set(ciegosDelIngenuo) };
})();

// ═════════════════════════════════════════════════════════════════════════════════════════
// SUELO · un cero de un censo ciego es el mismo número que un cero de verdad
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-696 · SUELO: el censo ha leído un árbol de verdad', () => {
  assert.ok(CENSO.ficheros > 800,
    `🔴 sólo ${CENSO.ficheros} ficheros: el censo no está recorriendo el árbol, así que su cero no `
    + 'significa «no hay ceguera» sino «no supe mirar».');
  assert.ok(CENSO.tramos > 50000,
    `🔴 sólo ${CENSO.tramos} tramos de texto examinados: el parser no está encontrando literales y `
    + 'el invariante no se estaría comprobando en ninguna parte.');
});

test('SCRUM-696 · 🔴 SUELO: el censo SABE encontrar ceguera — caza al filtro ingenuo', () => {
  // Sin esto, el cero de abajo podría venir de un detector que no distingue nada. La trampa es el
  // defecto REAL —el regex que corta en `//`—, no una cadena inventada para la ocasión.
  assert.ok(CENSO.ciegosDelIngenuo.size > 50,
    `🔴 el censo sólo caza ${CENSO.ciegosDelIngenuo.size} ficheros con el FILTRO INGENUO puesto. `
    + 'Ese filtro se come código real en decenas de ficheros de este árbol: si el censo no lo ve, '
    + 'no está midiendo el invariante y su cero no vale nada.');
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// LO QUE DECIDE
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-696 · 🔴 NINGÚN fichero del árbol pierde código al pasar por `soloCodigo()`', () => {
  const muestra = CENSO.ciegosDelBueno.slice(0, 10)
    .map(([f, t]) => `   ${f}\n      se ha comido: ${JSON.stringify(t)}`).join('\n');
  assert.deepEqual(
    CENSO.ciegosDelBueno, [],
    `🔴 ${CENSO.ciegosDelBueno.length} tramo(s) de texto salen alterados de \`soloCodigo()\`. Dentro `
    + 'de un literal no puede haber un comentario, así que esto es CÓDIGO REAL que el filtro se ha '
    + 'comido: todo guard que audite estos ficheros ha dejado de vigilar ese trozo, y lo hará en '
    + `verde.\n${muestra}`,
  );
});
