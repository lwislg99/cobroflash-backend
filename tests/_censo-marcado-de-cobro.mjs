// tests/_censo-marcado-de-cobro.mjs — SCRUM-397
//
// DOS CENSOS DERIVADOS SOBRE `src/`, las dos caras del mismo instante:
//
//   A · QUIÉN MARCA UN COBRO PAGADO — y si la columna y el evento salen del MISMO generador.
//   B · QUIÉN LEE «cuándo se pagó» — y si alguien vuelve a leerlo de `updatedAt`.
//
// Viven juntos porque el defecto de SCRUM-397 era exactamente que las dos caras no coincidían:
// el instante se escribía en un sitio (el evento) y se leía de tres, con tres criterios distintos.
//
// ⚠️ AST, NUNCA `grep`. Este fichero está lleno de las palabras que vigila —el estado `paid`, el
// nombre del generador, `updatedAt`— porque son las que hay que escribir para explicar qué mide. Un
// guard de texto se caza a sí mismo en su propia explicación (SCRUM-203, y ya van ocho).
//
// ⚠️ Y NUNCA UNA LISTA A MANO de rutas: se recorre `src/` entero. Una lista no avisa de lo que le
// falta, y el propio encargo de este ticket traía un censo corto (tres sitios donde había cinco).
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

export const GENERADOR = 'datosDeCobroPagado';
export const LECTOR = 'fechaDeCobroDeCharge';
export const RAIZ = path.resolve(import.meta.dirname, '..');

function ficherosTs(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) ficherosTs(p, out);
    else if (e.name.endsWith('.ts')) out.push(p);
  }
  return out;
}

const rel = (p) => path.relative(RAIZ, p).replace(/\\/g, '/');

/** ¿El objeto literal declara `status: 'paid'`? (la marca de «este cobro pasa a pagado»). */
function declaraPagado(obj) {
  return obj.properties.some(
    (p) => ts.isPropertyAssignment(p)
      && (ts.isIdentifier(p.name) || ts.isStringLiteral(p.name))
      && p.name.text === 'status'
      && ts.isStringLiteralLike(p.initializer)
      && p.initializer.text === 'paid',
  );
}

/** ¿El objeto literal se construye esparciendo el generador? (`...datosDeCobroPagado(...)`). */
function vieneDelGenerador(obj) {
  return obj.properties.some(
    (p) => ts.isSpreadAssignment(p)
      && ts.isCallExpression(p.expression)
      && ts.isIdentifier(p.expression.expression)
      && p.expression.expression.text === GENERADOR,
  );
}

/** ¿El objeto literal crea a mano un evento de tipo `paid`? */
function creaEventoPagado(obj) {
  let visto = false;
  (function walk(n) {
    if (ts.isPropertyAssignment(n)
        && (ts.isIdentifier(n.name) || ts.isStringLiteral(n.name))
        && n.name.text === 'type'
        && ts.isStringLiteralLike(n.initializer)
        && n.initializer.text === 'paid') {
      visto = true;
    }
    ts.forEachChild(n, walk);
  })(obj);
  return visto;
}

/**
 * CENSO A · cada `prisma.charge.update|create` cuyo `data` pone el cobro en `paid`.
 *
 * El límite lo pone la estructura, no una lista: es «una llamada de escritura al modelo `charge`
 * cuyo `data` declara ese estado». Si mañana aparece una sexta ruta, entra sola.
 */
export function censarMarcadores() {
  const salida = [];
  for (const fichero of ficherosTs(path.join(RAIZ, 'src'))) {
    const codigo = fs.readFileSync(fichero, 'utf8');
    const sf = ts.createSourceFile(path.basename(fichero), codigo, ts.ScriptTarget.Latest, true);
    (function walk(n) {
      if (ts.isCallExpression(n)
          && ts.isPropertyAccessExpression(n.expression)
          && ['update', 'create', 'updateMany', 'upsert'].includes(n.expression.name.text)
          && ts.isPropertyAccessExpression(n.expression.expression)
          && n.expression.expression.name.text === 'charge'
          && n.arguments.length
          && ts.isObjectLiteralExpression(n.arguments[0])) {
        const data = n.arguments[0].properties.find(
          (p) => ts.isPropertyAssignment(p) && ts.isIdentifier(p.name) && p.name.text === 'data'
            && ts.isObjectLiteralExpression(p.initializer),
        );
        if (data) {
          const obj = data.initializer;
          const generador = vieneDelGenerador(obj);
          if (declaraPagado(obj) || generador) {
            salida.push({
              fichero: rel(fichero),
              linea: sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1,
              porGenerador: generador,
              // 🔴 la marca del defecto: fecha del evento y columna escritas por separado.
              eventoAMano: !generador && creaEventoPagado(obj),
            });
          }
        }
      }
      ts.forEachChild(n, walk);
    })(sf);
  }
  return salida;
}

/**
 * CENSO B · quién responde «cuándo se pagó este cobro».
 *
 * Se busca por el HECHO, no por el nombre de una variable: cualquier lectura de `.paidAt`, de un
 * evento de tipo `paid`, o de `updatedAt` sobre algo que se llame como un cobro. Lo que importa de
 * cada uno es si pasa por el lector común.
 */
export function censarLectores() {
  const salida = [];
  for (const fichero of ficherosTs(path.join(RAIZ, 'src'))) {
    if (rel(fichero).includes('billing/domain/instanteDeCobro')) continue; // es el lector
    const codigo = fs.readFileSync(fichero, 'utf8');
    const sf = ts.createSourceFile(path.basename(fichero), codigo, ts.ScriptTarget.Latest, true);
    let usaLector = false;
    const sospechas = [];
    (function walk(n) {
      if (ts.isCallExpression(n) && ts.isIdentifier(n.expression) && n.expression.text === LECTOR) {
        usaLector = true;
      }
      // `ch.updatedAt` / `charge.updatedAt` — la fecha equivocada, leída del sitio equivocado.
      if (ts.isPropertyAccessExpression(n) && n.name.text === 'updatedAt') {
        const base = n.expression.getText(sf);
        if (/^(ch|charge|cobro|c)\b/.test(base)) {
          sospechas.push({ que: `${base}.updatedAt`, linea: sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1 });
        }
      }
      ts.forEachChild(n, walk);
    })(sf);
    if (usaLector || sospechas.length) salida.push({ fichero: rel(fichero), usaLector, sospechas });
  }
  return salida;
}
