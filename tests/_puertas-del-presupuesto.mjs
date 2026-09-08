// tests/_puertas-del-presupuesto.mjs — SCRUM-734
//
// ═══════════════════════════════════════════════════════════════════════════════════════════════
// QUÉ CLAVES LLEVA CADA PUERTA DEL PDF DE PRESUPUESTO. Puro: recibe fuentes, devuelve el censo.
//
// ── POR QUÉ EXISTE, Y POR QUÉ ES UN SOLO SITIO ──────────────────────────────────────────────
//
// Cuatro tickets preguntan lo mismo —SCRUM-593c (los dos textos), SCRUM-602 (la dirección de la
// obra), SCRUM-731 (lo que explica el total) y SCRUM-734 (todo)— y hasta hoy cada uno se escribía
// su propio recorrido del AST. Los cuatro daban por hecho que la puerta arma un OBJETO LITERAL, y
// los cuatro se quedaron ciegos a la vez el día que las puertas pasaron a pedirle la carga a
// `paramsDePresupuestoParaPdf`. Cuatro censos con el mismo supuesto se rompen el mismo día: eso no
// es redundancia, es un solo punto de fallo escrito cuatro veces.
//
// 🔴 Y NO SE «ADAPTARON» PARA QUE SIGUIERAN EN VERDE. La propiedad que vigilan —«las tres puertas
// llevan este campo»— sigue siendo cierta y sigue importando; lo que cambió es CÓMO se comprueba.
// Un censo cuyo modelo se rompe tiene que fallar, y falló: los tres cayeron a la vez, que es la
// señal correcta. Esto les devuelve la pregunta, no el verde.
//
// ── EL SUELO ────────────────────────────────────────────────────────────────────────────────
//
// Si no encuentra puertas, o si una puerta delega en el constructor y del constructor no se
// pueden leer claves, **lanza**. «No supe mirar» y «esa puerta no lleva nada» son el mismo
// resultado con significados opuestos.
// ═══════════════════════════════════════════════════════════════════════════════════════════════
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const RAIZ = path.resolve(import.meta.dirname, '..');

export class CensoCiego extends Error {}

/** Los ficheros que generan el PDF del presupuesto. Declarados: añadir uno sin mirar CANTA. */
export const FUENTES_PRESUPUESTO = [
  'src/modules/quotes/app/routes/quotes.routes.ts',
  'src/modules/system/app/routes/quotesAdmin.routes.ts',
];

export const RUTA_CONSTRUCTOR = 'src/modules/quotes/domain/presupuestoParaPdf.ts';
export const NOMBRE_CONSTRUCTOR = 'paramsDePresupuestoParaPdf';

const leer = (rel, fuentes) => (fuentes && fuentes[rel] !== undefined ? fuentes[rel] : fs.readFileSync(path.join(RAIZ, rel), 'utf8'));
const arbol = (rel, txt) => ts.createSourceFile(rel, txt, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
const nombreDeClave = (p) => (p.name && (ts.isIdentifier(p.name) || ts.isStringLiteral(p.name)) ? p.name.text : null);

/** Las claves que produce el constructor. Lanza si no las encuentra: cero sería mentira. */
export function clavesDelConstructor(fuentes) {
  const txt = leer(RUTA_CONSTRUCTOR, fuentes);
  const sf = arbol(RUTA_CONSTRUCTOR, txt);
  let claves = null;
  const visitar = (n) => {
    if (ts.isFunctionDeclaration(n) && n.name && n.name.text === NOMBRE_CONSTRUCTOR) {
      const dentro = (m) => {
        if (ts.isReturnStatement(m) && m.expression && ts.isObjectLiteralExpression(m.expression)) {
          claves = m.expression.properties.map(nombreDeClave).filter(Boolean);
        }
        m.forEachChild(dentro);
      };
      dentro(n);
    }
    n.forEachChild(visitar);
  };
  visitar(sf);
  if (!claves || claves.length === 0) {
    throw new CensoCiego(
      `🔴 no consigo leer las claves de \`${NOMBRE_CONSTRUCTOR}\` en ${RUTA_CONSTRUCTOR}. Sin ellas, `
      + 'toda puerta que delegue en él parecería no llevar NADA — y eso se leería como un defecto '
      + 'enorme cuando lo que pasa es que no supe mirar.');
  }
  return claves;
}

/**
 * Cada llamada a `generateQuotePdf`, con las claves que EFECTIVAMENTE lleva.
 *
 *   · `forma: 'constructor'` → delega, y lleva todo lo que el constructor produce.
 *   · `forma: 'literal'`     → arma su objeto a mano; lleva lo que enumera.
 *   · `forma: 'otra'`        → ni una cosa ni la otra: se declara y no se adivina.
 */
export function censarPuertasDelPresupuesto(fuentes) {
  const delConstructor = clavesDelConstructor(fuentes);
  const puertas = [];
  for (const rel of FUENTES_PRESUPUESTO) {
    const txt = leer(rel, fuentes);
    const sf = arbol(rel, txt);
    const visitar = (n) => {
      if (ts.isCallExpression(n)) {
        const e = n.expression;
        const nom = ts.isIdentifier(e) ? e.text : (ts.isPropertyAccessExpression(e) ? e.name.text : null);
        if (nom === 'generateQuotePdf') {
          const a = n.arguments[0];
          const donde = `${rel}:${sf.getLineAndCharacterOfPosition(n.getStart()).line + 1}`;
          if (a && ts.isCallExpression(a) && ts.isIdentifier(a.expression) && a.expression.text === NOMBRE_CONSTRUCTOR) {
            puertas.push({ fichero: rel, donde, forma: 'constructor', props: new Set(delConstructor) });
          } else if (a && ts.isObjectLiteralExpression(a)) {
            puertas.push({
              fichero: rel, donde, forma: 'literal',
              props: new Set(a.properties.map(nombreDeClave).filter(Boolean)),
              spreads: a.properties.filter(ts.isSpreadAssignment).length,
            });
          } else {
            puertas.push({ fichero: rel, donde, forma: 'otra', props: new Set() });
          }
        }
      }
      n.forEachChild(visitar);
    };
    visitar(sf);
  }
  if (puertas.length === 0) {
    throw new CensoCiego('🔴 el censo no ha encontrado NI UNA llamada a `generateQuotePdf`. Cero '
      + 'puertas es un analizador roto, no un documento que no se genera.');
  }
  return puertas;
}

/** Las puertas a las que les falta alguno de `campos`, NOMBRADAS con lo que les falta. */
export function puertasSinLosCampos(campos, fuentes) {
  return censarPuertasDelPresupuesto(fuentes)
    .map((p) => ({ p, faltan: campos.filter((c) => !p.props.has(c)) }))
    .filter((x) => x.faltan.length > 0)
    .map((x) => `${x.p.donde} no conoce: ${x.faltan.join(', ')}`);
}
