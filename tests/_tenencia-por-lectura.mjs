// tests/_tenencia-por-lectura.mjs — SCRUM-348 · LA COBERTURA SE DECIDE POR LECTURA, NO POR FUNCIÓN.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// EL AGUJERO QUE CIERRA
//
// El censo de SCRUM-243 marca una lectura como cubierta si **la función que la envuelve menciona
// `merchantId` en algún sitio** (`mencionaMerchantId(fn)`). Eso da por buena una lectura sin
// filtro por cosas que no la protegen:
//
//     · el `merchantId` de OTRA consulta del mismo handler;
//     · un `merchantId` dentro de un `select`, de un `data` de escritura o de un `orderBy`;
//     · un `const { merchantId } = req` que luego no se usa en ese `where`.
//
// Y el agujero **crece solo**: cuanto más grande es un handler, más probable es que contenga un
// `merchantId` en cualquier parte, así que las lecturas nuevas nacen «cubiertas» sin que nadie
// mire. Por eso en SCRUM-296 (A6) y SCRUM-297 (A7) me negué a apoyarme en ese guard y monté los
// controles negativos contra Postgres a mano.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// EL CRITERIO NUEVO: LA LECTURA SE DEFIENDE SOLA
//
// Una lectura está CUBIERTA si su **propio `where`** filtra por merchant. Y para no repetir el
// error contrario —el de SCRUM-243, que sobrecontaba porque no sabía resolver `where:
// whereRango(...)`— aquí la indirección **se resuelve**:
//
//   · `where: { merchantId }`                    → CUBIERTA (literal)
//   · `where: { AND: [{ merchantId }, …] }`      → CUBIERTA (anidado)
//   · `where: base` con `const base = { merchantId… }` en la misma función → CUBIERTA (resuelta)
//   · `where: whereRango(merchantId, …)`         → **NO_RESOLUBLE**, y `merchantId` viaja como
//                                                   argumento → se declara aparte, no se cuenta
//                                                   como agujero ni como cubierta
//   · literal sin merchantId, o sin `where`      → **SIN FILTRO**
//
// ⚠️ «No pude resolverlo» NO es «filtra» y tampoco es «no filtra». Son tres cubos, y confundir
// dos de ellos es lo que hace inútil una medición de seguridad: uno inflado no se puede atender y
// uno corto tranquiliza.
import ts from 'typescript';
import fs from 'node:fs';
import path from 'node:path';
import { LECTURAS, modelosConMerchant, montajes, esMontajeAutenticado } from './_tenencia-lectura.mjs';

export { LECTURAS, modelosConMerchant, montajes, esMontajeAutenticado };

/** ¿Este nodo contiene un identificador `merchantId` (a cualquier profundidad)? */
function llevaMerchantId(nodo) {
  let visto = false;
  const v = (x) => {
    if (visto || !x) return;
    if (ts.isIdentifier(x) && /^merchantId$/.test(x.text)) visto = true;
    else ts.forEachChild(x, v);
  };
  v(nodo);
  return visto;
}

function funcionQueEnvuelve(nodo) {
  let p = nodo.parent;
  while (p) {
    if (ts.isFunctionDeclaration(p) || ts.isFunctionExpression(p) || ts.isArrowFunction(p) ||
        ts.isMethodDeclaration(p)) return p;
    p = p.parent;
  }
  return null;
}

/**
 * Busca la declaración de `nombre` DENTRO de la función que envuelve a la lectura y devuelve su
 * inicializador. Es lo que permite resolver `const where = { merchantId }; …findMany({ where })`
 * sin dar por bueno cualquier `merchantId` suelto del handler.
 */
function declaracionEnLaFuncion(fn, nombre) {
  if (!fn) return null;
  let encontrado = null;
  const v = (x) => {
    if (encontrado || !x) return;
    if (ts.isVariableDeclaration(x) && ts.isIdentifier(x.name) && x.name.text === nombre && x.initializer) {
      encontrado = x.initializer;
      return;
    }
    ts.forEachChild(x, v);
  };
  v(fn);
  return encontrado;
}

/** El `where` de una llamada, con su forma. */
function whereDe(arg) {
  if (!arg || !ts.isObjectLiteralExpression(arg)) return { tipo: 'sin-args', nodo: null, nombre: null };
  for (const p of arg.properties) {
    if (ts.isPropertyAssignment(p) && p.name.getText() === 'where') {
      const i = p.initializer;
      if (ts.isObjectLiteralExpression(i)) return { tipo: 'literal', nodo: i, nombre: null };
      if (ts.isIdentifier(i)) return { tipo: 'variable', nodo: i, nombre: i.text };
      if (ts.isCallExpression(i)) return { tipo: 'llamada', nodo: i, nombre: null };
      return { tipo: 'otro', nodo: i, nombre: null };
    }
    if (ts.isShorthandPropertyAssignment(p) && p.name.getText() === 'where') {
      return { tipo: 'variable', nodo: p, nombre: p.name.text };
    }
  }
  return { tipo: 'sin-where', nodo: null, nombre: null };
}

export const CUBOS = Object.freeze({
  CUBIERTA: 'cubierta',
  SIN_FILTRO: 'sin_filtro',
  NO_RESOLUBLE: 'no_resoluble',
});

/**
 * Analiza UN fichero y devuelve una entrada POR LECTURA.
 *
 * Exportado aparte para poder probar el analizador con código sintético — que es la única forma
 * de demostrar que sabe encontrar una lectura desprotegida cuando en el árbol real no haya
 * ninguna. Un censo que no encuentra nada y no puede demostrar que sabría encontrarlo es
 * indistinguible de uno ciego.
 */
export function analizarFuente(codigo, ruta, conMerchant) {
  const sf = ts.createSourceFile(ruta, codigo, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const out = [];
  const visitar = (n) => {
    if (ts.isCallExpression(n) && ts.isPropertyAccessExpression(n.expression)) {
      const metodo = n.expression.name.text;
      if (LECTURAS.has(metodo) && ts.isPropertyAccessExpression(n.expression.expression)) {
        const modelo = n.expression.expression.name.text;
        if (conMerchant.has(modelo)) {
          const w = whereDe(n.arguments[0]);
          const fn = funcionQueEnvuelve(n);

          let cubo;
          let comoSeResolvio = w.tipo;
          if (w.tipo === 'literal') {
            cubo = llevaMerchantId(w.nodo) ? CUBOS.CUBIERTA : CUBOS.SIN_FILTRO;
          } else if (w.tipo === 'variable') {
            // Se resuelve la variable DENTRO de la función: es indirección, no un cheque en blanco.
            const decl = declaracionEnLaFuncion(fn, w.nombre);
            if (decl && ts.isObjectLiteralExpression(decl)) {
              cubo = llevaMerchantId(decl) ? CUBOS.CUBIERTA : CUBOS.SIN_FILTRO;
              comoSeResolvio = 'variable-resuelta';
            } else if (decl) {
              cubo = llevaMerchantId(decl) ? CUBOS.CUBIERTA : CUBOS.NO_RESOLUBLE;
              comoSeResolvio = 'variable-no-literal';
            } else {
              cubo = CUBOS.NO_RESOLUBLE;
            }
          } else if (w.tipo === 'llamada') {
            // `whereRango(merchantId, …)`: el merchant viaja como ARGUMENTO. Se declara, no se
            // da por cubierta — quien construye ese `where` puede dejárselo.
            cubo = llevaMerchantId(w.nodo) ? CUBOS.NO_RESOLUBLE : CUBOS.SIN_FILTRO;
            comoSeResolvio = llevaMerchantId(w.nodo) ? 'llamada-con-merchant' : 'llamada-sin-merchant';
          } else {
            // Sin `where` ninguno, o sin argumentos: no hay nada que filtre.
            cubo = CUBOS.SIN_FILTRO;
          }

          out.push({
            ruta,
            linea: sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1,
            modelo,
            metodo,
            cubo,
            comoSeResolvio,
            /**
             * ⚠️ EL DATO QUE ROMPE EL AGUJERO DE 243, guardado A PROPÓSITO para poder medir la
             * diferencia: ¿la función menciona `merchantId` en cualquier sitio? Con el criterio
             * viejo eso bastaba para dar la lectura por cubierta. Aquí no cubre nada — solo
             * permite contar cuántas lecturas se estaban dando por buenas por esa vía.
             */
            funcionMencionaMerchant: fn ? llevaMerchantId(fn) : false,
          });
        }
      }
    }
    ts.forEachChild(n, visitar);
  };
  ts.forEachChild(sf, visitar);
  return out;
}

/** Recorre `src/` entero y añade el montaje de cada fichero. */
export function analizarArbol(raiz) {
  const conMerchant = modelosConMerchant(raiz);
  const mont = montajes(raiz);
  const out = [];
  const andar = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) { andar(p); continue; }
      if (!e.name.endsWith('.ts') || e.name.endsWith('.d.ts')) continue;
      const rel = path.relative(raiz, p).split(path.sep).join('/');
      for (const h of analizarFuente(fs.readFileSync(p, 'utf8'), rel, conMerchant)) {
        const m = mont.get(rel) ?? null;
        out.push({ ...h, montaje: m, autenticada: m ? esMontajeAutenticado(m) : null });
      }
    }
  };
  andar(path.join(raiz, 'src'));
  return out;
}

/** Clave estable de una lectura, para congelarla en un censo sin depender del número de línea. */
export function clave(h) {
  return `${h.ruta}::${h.modelo}.${h.metodo}`;
}
