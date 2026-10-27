// scripts/_censo-rango-del-parte.mjs — SCRUM-1488
//
// ¿QUIÉN ESCRIBE `desplazamientos` Y `kilometros` DE UN PARTE, Y PASA POR EL RANGO?
//
// El rango de los dos campos se decide una vez (`src/modules/jobs/domain/parteRango.ts`). Este
// censo cuenta TODAS las escrituras de `ParteTrabajo` en `src/`, dice qué campos escribe cada una,
// y exige que quien escriba uno de los dos lo saque del lector: `x.valor`, con `x` salido de
// `leerDesplazamientos(…)` o `leerKilometros(…)` en esa misma función.
//
// Por AST, no por texto: un `grep` casa con el comentario que explica la regla y con
// `parte.desplazamientos` leído, que no escribe nada.
//
// ── ⛔ LO QUE NO VE, y por eso lo cuenta del lado malo ───────────────────────────────────────
//   · `data` con un spread, o construido por un camino que no sabe seguir → OPACO: no puede decir
//     que NO escribe los dos campos, así que falla.
//   · El delegado guardado en una variable (`const p = tx.parteTrabajo`) → ALIAS: falla.
//   · SQL en crudo sobre `partes_trabajo` (una cadena del código que nombre la tabla) → falla.
//   · Una escritura fuera de `src/`, o hecha a mano en la base: no es código de la aplicación.
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { fileURLToPath } from 'node:url';

export const RAIZ_REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const SALIDA_NO_MEDIDO = 2;
export const MODELO = 'parteTrabajo';
export const TABLA = 'partes_trabajo';
/** Campo → la función que decide su rango. */
export const LECTORES = { desplazamientos: 'leerDesplazamientos', kilometros: 'leerKilometros' };

const METODOS = new Set(['create', 'createMany', 'createManyAndReturn', 'update', 'updateMany', 'upsert']);
/** Dónde lleva los datos cada método (`upsert` los lleva en dos sitios). */
const DONDE = { upsert: ['create', 'update'] };

const sinEnvoltorio = (n) => {
  let x = n;
  while (x && (ts.isParenthesizedExpression(x) || ts.isAsExpression(x) || ts.isNonNullExpression(x) || ts.isSatisfiesExpression?.(x))) x = x.expression;
  return x;
};
const esFuncion = (n) => ts.isArrowFunction(n) || ts.isFunctionExpression(n) || ts.isFunctionDeclaration(n) || ts.isMethodDeclaration(n);
const funcionQueEnvuelve = (n) => { let x = n.parent; while (x && !esFuncion(x)) x = x.parent; return x ?? n.getSourceFile(); };
const nombreDe = (p) => (ts.isIdentifier(p) || ts.isStringLiteral(p) || ts.isNoSubstitutionTemplateLiteral(p) ? p.text : null);

function recorrer(raiz, visita) {
  const baja = (n) => { visita(n); ts.forEachChild(n, baja); };
  baja(raiz);
}

/** La declaración `const <nombre> = <init>` dentro de una función. */
function declaracionDe(funcion, nombre) {
  let hallada = null;
  recorrer(funcion, (n) => {
    if (!hallada && ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && n.name.text === nombre) hallada = n;
  });
  return hallada;
}

/** Las claves que recorre `for (const x of ['a', 'b'] as const)`, si `x` es eso. */
function clavesDelBucle(funcion, nombre) {
  const d = declaracionDe(funcion, nombre);
  const bucle = d?.parent?.parent;
  if (!bucle || !ts.isForOfStatement(bucle)) return null;
  const lista = sinEnvoltorio(bucle.expression);
  if (!ts.isArrayLiteralExpression(lista)) return null;
  const claves = lista.elements.map((e) => (ts.isStringLiteral(e) ? e.text : null));
  return claves.every((c) => c !== null) ? claves : null;
}

/** Suma a `campos` (clave → expresiones) lo que escribe un literal de objeto. */
function delLiteral(lit, campos, opaco) {
  for (const p of lit.properties) {
    if (ts.isPropertyAssignment(p)) {
      const k = nombreDe(p.name);
      if (k === null) opaco.push('clave calculada en el literal');
      else (campos[k] ??= []).push(p.initializer);
    } else if (ts.isShorthandPropertyAssignment(p)) (campos[p.name.text] ??= []).push(p.name);
    else opaco.push(ts.isSpreadAssignment(p) ? 'spread en los datos' : 'miembro que no es una propiedad');
  }
}

/** Qué campos escribe la expresión que va en `data`. */
function camposDe(expr, llamada, campos, opaco) {
  const e = sinEnvoltorio(expr);
  if (ts.isObjectLiteralExpression(e)) return delLiteral(e, campos, opaco);
  if (ts.isArrayLiteralExpression(e)) { for (const el of e.elements) camposDe(el, llamada, campos, opaco); return; }
  if (!ts.isIdentifier(e)) { opaco.push('los datos no son un literal ni una variable'); return; }
  // Una variable: su declaración y todo lo que se le asigna en la función que envuelve la llamada.
  const funcion = funcionQueEnvuelve(llamada);
  const decl = declaracionDe(funcion, e.text);
  const init = decl?.initializer ? sinEnvoltorio(decl.initializer) : null;
  if (!init || !ts.isObjectLiteralExpression(init)) { opaco.push(`«${e.text}» no nace de un literal en esta función`); return; }
  delLiteral(init, campos, opaco);
  recorrer(funcion, (n) => {
    if (ts.isBinaryExpression(n) && n.operatorToken.kind === ts.SyntaxKind.EqualsToken) {
      const izq = n.left;
      if (ts.isPropertyAccessExpression(izq) && ts.isIdentifier(izq.expression) && izq.expression.text === e.text) {
        (campos[izq.name.text] ??= []).push(n.right);
      } else if (ts.isElementAccessExpression(izq) && ts.isIdentifier(izq.expression) && izq.expression.text === e.text) {
        const arg = sinEnvoltorio(izq.argumentExpression);
        const claves = ts.isStringLiteral(arg) ? [arg.text] : ts.isIdentifier(arg) ? clavesDelBucle(funcion, arg.text) : null;
        if (!claves) opaco.push(`«${e.text}[…]» con una clave que no se puede leer`);
        else for (const k of claves) (campos[k] ??= []).push(n.right);
      } else if (ts.isIdentifier(izq) && izq.text === e.text) opaco.push(`«${e.text}» se reasigna entera`);
    }
    // `Object.assign(data, …)` y parecidos: la variable entregada a una función que puede escribirle.
    if (ts.isCallExpression(n) && n !== llamada && n.arguments.some((a) => ts.isIdentifier(a) && a.text === e.text)) {
      const quien = n.expression.getText();
      if (quien !== 'Object.keys') opaco.push(`«${e.text}» se entrega a ${quien}(…)`);
    }
  });
}

/** ¿`expr` es `x.valor`, con `x` salido de `<lector>(…)` en la función que envuelve la llamada? */
function vieneDelLector(expr, llamada, lector) {
  const e = sinEnvoltorio(expr);
  if (!ts.isPropertyAccessExpression(e) || e.name.text !== 'valor' || !ts.isIdentifier(e.expression)) return false;
  const init = declaracionDe(funcionQueEnvuelve(llamada), e.expression.text)?.initializer;
  const c = init ? sinEnvoltorio(init) : null;
  return Boolean(c && ts.isCallExpression(c) && ts.isIdentifier(c.expression) && c.expression.text === lector);
}

/**
 * Censa las escrituras de `ParteTrabajo` en unos ficheros.
 * @param {{nombre:string, texto:string}[]} ficheros
 */
export function censar(ficheros) {
  const escrituras = [];
  const fallos = [];
  for (const { nombre, texto } of ficheros) {
    const sf = ts.createSourceFile(nombre, texto, ts.ScriptTarget.Latest, true);
    const linea = (n) => sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1;
    recorrer(sf, (n) => {
      if ((ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n) || ts.isTemplateHead(n) || ts.isTemplateMiddle(n) || ts.isTemplateTail(n))
        && n.text.includes(TABLA)) {
        fallos.push(`${nombre}:${linea(n)} · una cadena nombra la tabla «${TABLA}»: SQL en crudo no pasa por el rango`);
      }
      if (!ts.isPropertyAccessExpression(n) || n.name.text !== MODELO) return;
      const padre = n.parent;
      const llamada = padre && ts.isPropertyAccessExpression(padre) && padre.expression === n && padre.parent
        && ts.isCallExpression(padre.parent) && padre.parent.expression === padre ? padre.parent : null;
      if (!llamada) {
        fallos.push(`${nombre}:${linea(n)} · ALIAS: «.${MODELO}» se usa sin llamar a un método; lo que se haga con él no se ve`);
        return;
      }
      const metodo = padre.name.text;
      if (!METODOS.has(metodo)) return; // lecturas, `delete`, `count`: no escriben los dos campos
      const campos = {};
      const opaco = [];
      const arg = llamada.arguments[0] ? sinEnvoltorio(llamada.arguments[0]) : null;
      if (!arg || !ts.isObjectLiteralExpression(arg)) opaco.push('el argumento no es un literal');
      else {
        let vistos = 0;
        for (const p of arg.properties) {
          if (ts.isSpreadAssignment(p)) { opaco.push('spread en el argumento'); continue; }
          const k = p.name ? nombreDe(p.name) : null;
          if (!(DONDE[metodo] ?? ['data']).includes(k)) continue;
          vistos += 1;
          camposDe(ts.isShorthandPropertyAssignment(p) ? p.name : p.initializer, llamada, campos, opaco);
        }
        if (vistos === 0) opaco.push('no se encuentran los datos');
      }
      const e = { fichero: nombre, linea: linea(n), metodo, campos: Object.keys(campos).sort(), opaco, escribe: [] };
      escrituras.push(e);
      const donde = `${nombre}:${e.linea} · ${MODELO}.${metodo}`;
      if (opaco.length) fallos.push(`${donde} · OPACO (${[...new Set(opaco)].join('; ')}): no se puede decir que no escriba ${Object.keys(LECTORES).join(' ni ')}`);
      for (const [campo, lector] of Object.entries(LECTORES)) {
        if (!campos[campo]) continue;
        e.escribe.push(campo);
        for (const expr of campos[campo]) {
          if (!vieneDelLector(expr, llamada, lector)) {
            fallos.push(`${donde} · escribe «${campo}» con «${expr.getText(sf).slice(0, 60)}», que no sale de ${lector}(…).valor`);
          }
        }
      }
    });
  }
  return { escrituras, fallos };
}

function ficherosDeSrc(raiz) {
  const fuera = new Set(['node_modules', 'dist', '.git', 'generated']);
  const salida = [];
  const baja = (dir) => {
    for (const d of fs.readdirSync(dir, { withFileTypes: true })) {
      if (d.isDirectory()) { if (!fuera.has(d.name)) baja(path.join(dir, d.name)); }
      else if (d.name.endsWith('.ts') && !d.name.endsWith('.d.ts')) salida.push(path.join(dir, d.name));
    }
  };
  baja(path.join(raiz, 'src'));
  return salida.sort();
}

/** No ha podido mirar. No es «no hay nada»: quien llama no puede leerlo como un cero. */
export class CensoCiego extends Error {}

/** El censo sobre el árbol real. Si no puede mirar, LANZA `CensoCiego`. */
export function medir(raiz = RAIZ_REPO) {
  let rutas;
  try { rutas = ficherosDeSrc(raiz); } catch (err) { throw new CensoCiego(`no se puede leer src/: ${err.message}`); }
  if (rutas.length === 0) throw new CensoCiego('src/ no tiene ningún .ts');
  const r = censar(rutas.map((f) => ({ nombre: path.relative(raiz, f).replace(/\\/g, '/'), texto: fs.readFileSync(f, 'utf8') })));
  if (r.escrituras.length === 0) throw new CensoCiego(`0 escrituras de ${MODELO} en ${rutas.length} ficheros: el censo ha dejado de verlas`);
  return { ficheros: rutas.length, escrituras: r.escrituras, fallos: r.fallos };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  let r;
  try { r = medir(); } catch (err) {
    if (!(err instanceof CensoCiego)) throw err;
    console.error(`NO MEDIDO · ${err.message}`);
    process.exit(SALIDA_NO_MEDIDO);
  }
  console.log(`población: ${r.ficheros} ficheros de src/ · ${r.escrituras.length} escrituras de ${MODELO} · ${r.escrituras.filter((e) => e.escribe.length).length} escriben ${Object.keys(LECTORES).join(' o ')}`);
  for (const e of r.escrituras) console.log(`  ${e.fichero}:${e.linea} · ${e.metodo} · ${e.escribe.length ? 'ESCRIBE ' + e.escribe.join(' + ') : 'no los escribe'} · campos: ${e.campos.join(', ')}`);
  for (const f of r.fallos) console.log(`  🔴 ${f}`);
  process.exit(r.fallos.length ? 1 : 0);
}
