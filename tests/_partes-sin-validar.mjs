// tests/_partes-sin-validar.mjs — SCRUM-747
//
// ═════════════════════════════════════════════════════════════════════════════════════════
// ¿QUIÉN CONSTRUYE UNA FECHA CON `Date.UTC` A PARTIR DE PARTES QUE NADIE HA VALIDADO?
//
// EL DEFECTO, medido en SCRUM-648: `Date.UTC` **normaliza en silencio**. El mes 13 de 2026 se
// convierte en enero de 2027 sin protestar, así que un `mesKey` corrupto no produce un valor
// ilegible —contra el que se podría programar una barrera— sino **un plazo plausible y
// equivocado**, que no tiene síntoma ninguno.
//
// ── POR QUÉ AST Y NO BARRIDO DE TEXTO ────────────────────────────────────────────────────
// La pregunta no es «¿aparece `Date.UTC`?» —aparece también en comentarios y en usos correctos—
// sino «¿sus argumentos vienen de trocear una cadena y convertirla a número, sin que nadie mire
// el resultado?». Eso es estructura: hay que ver la declaración de la variable, su inicializador
// y si entre medias hay una comprobación. Un `grep` no distingue nada de eso (SCRUM-203).
//
// ⚠️ LO QUE ESTE CENSO **NO** DICE: que cada sitio sea un defecto. Dice que **la entrada no se
// mira antes de normalizar**. Si el llamador ya garantiza la forma, el sitio es correcto — y esa
// distinción la hace quien lea el censo, no el censo.
// ═════════════════════════════════════════════════════════════════════════════════════════
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

/** Población DECLARADA: el código de producción. Los tests no construyen plazos. */
export const POBLACION = { dir: 'src', ext: '.ts' };

function ficheros(raiz) {
  const out = [];
  const abs = path.join(raiz, POBLACION.dir);
  (function anda(d) {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) anda(p);
      else if (e.name.endsWith(POBLACION.ext)) out.push(p);
    }
  })(abs);
  return out;
}

/** Formas de mirar un número antes de usarlo. Si alguna aparece sobre las partes, hay barrera. */
const VALIDA = /Number\.isInteger|Number\.isFinite|isNaN|isNarrow|<\s*1\b|>\s*12\b|throw |RangeError|\?\?|=== *undefined|== *null/;

/**
 * 🔴 EL CRITERIO, y se corrigió a mitad del ticket con una medición delante.
 *
 * La primera versión buscaba `Date.UTC` cuyos argumentos vinieran de un
 * `split().map(Number)` **en el mismo ámbito**. Dio **3** sitios… y había **5**:
 * `inicioDelDiaEn` y `finDelDiaEn` trocean en una función y construyen la fecha en OTRA
 * (`instanteDe`), así que el detector no cruzaba la llamada y los daba por limpios. Se comprobó
 * ejecutándolos: `2026-02-31` sale como **2 de marzo**.
 *
 * El criterio bueno no es dónde se construye la fecha: es **que se trocea una cadena a números y
 * no se mira el resultado antes de usarlo**. Eso se ve en la declaración, sin seguir llamadas.
 */
export function partesSinValidar(rel, código) {
  const sf = ts.createSourceFile(rel, código, ts.ScriptTarget.Latest, true);
  const usos = [];

  (function anda(n) {
    if (ts.isVariableDeclaration(n) && n.name && ts.isArrayBindingPattern(n.name) && n.initializer) {
      const ini = n.initializer.getText(sf);
      if (!/\.split\s*\(/.test(ini) || !/\.map\s*\(\s*Number\s*\)/.test(ini)) { ts.forEachChild(n, anda); return; }

      const partes = n.name.elements
        .filter((el) => ts.isBindingElement(el) && ts.isIdentifier(el.name))
        .map((el) => el.name.text);
      if (partes.length === 0) { ts.forEachChild(n, anda); return; }

      // ¿Hay una barrera en la MISMA función, después de trocear?
      let fn = n;
      while (fn && !ts.isFunctionDeclaration(fn) && !ts.isMethodDeclaration(fn)
             && !ts.isArrowFunction(fn) && !ts.isFunctionExpression(fn)) fn = fn.parent;
      const cuerpo = fn && fn.body ? fn.body.getText(sf) : '';
      const desde = cuerpo.indexOf(n.getText(sf));
      const despues = desde >= 0 ? cuerpo.slice(desde) : cuerpo;
      const validada = partes.some((p) => new RegExp(`\\b${p}\\b`).test(despues) && VALIDA.test(despues));

      const { line } = sf.getLineAndCharacterOfPosition(n.getStart(sf));
      if (!validada) {
        usos.push({
          fichero: rel,
          linea: line + 1,
          partes: [...partes].sort(),
          fn: fn && fn.name ? fn.name.getText(sf) : '(anónima)',
          texto: n.getText(sf).replace(/\s+/g, ' ').slice(0, 70),
        });
      }
    }
    ts.forEachChild(n, anda);
  })(sf);

  return usos;
}

export function censo(raiz) {
  const out = [];
  for (const f of ficheros(raiz)) {
    const rel = path.relative(raiz, f).split(path.sep).join('/');
    out.push(...partesSinValidar(rel, fs.readFileSync(f, 'utf8')));
  }
  return out;
}

export function tamanoPoblacion(raiz) {
  return ficheros(raiz).length;
}

// ── AUTOPRUEBA ───────────────────────────────────────────────────────────────────────────
export const CEBO = `
  const [y, m] = mesKey.split('-').map(Number);
  const a = new Date(Date.UTC(y, m, 0));          // DEBE contar
  const b = new Date(Date.UTC(2026, 3, 1));       // NO: literales, nada que validar
  const [p, q] = otra.split(':');                 // NO: sin .map(Number)
  const c = new Date(Date.UTC(p, q, 1));          // NO: sus partes no vienen de map(Number)
  const d = Date.UTC(y, m - 1, 16);               // DEBE contar (misma procedencia)
`;
export const CEBO_ESPERADO = 1;
