// scripts/censo-abiertos-vs-guards.mjs — SCRUM-804
//
// ╔══════════════════════════════════════════════════════════════════════════════════════════╗
// ║ EL TABLERO CONTRA EL ÁRBOL · ¿qué ticket abierto está en realidad construido y vigilado?  ║
// ╚══════════════════════════════════════════════════════════════════════════════════════════╝
//
// El hermano `censo-tablero-vs-arbol.mjs` (SCRUM-738) responde OTRA pregunta: saca su población
// del ÁRBOL —ramas, entradas de máster, commits— y dice qué rastro dejó cada número. Aquí la
// población viene del TABLERO, y la pregunta es la del encargo: ¿el comportamiento está en main
// Y hay guard que lo vigila? Por eso este fichero no lo sustituye: lo complementa.
//
// ── LA TRAMPA QUE ESTE CENSO TIENE QUE ESQUIVAR (regla 23) ────────────────────────────────
// «Existe tests/scrumNNN-*.test.mjs» NO ES PRUEBA de nada: un fichero con el número puesto
// puede vigilar otra cosa —medido: `scrum727-constancia-del-vigia.test.mjs` vigila el vigía del
// despliegue, no la lista de Trabajos que su ticket describe—. La prueba que sí vale es que el
// test ASEVERE sobre código de PRODUCTO y PASE en una tanda de 0 fallos: si el comportamiento
// aseverado no estuviera en main, ese test estaría rojo.
//
// ── EL PUNTO CIEGO QUE COSTÓ NUEVE TICKETS ────────────────────────────────────────────────
// La primera versión sólo miraba literales pegados al lector (`readFileSync('src/x.ts')`) y dio
// NO HECHO al SCRUM-806, que es control positivo. La casa NO escribe así: arma la ruta antes
// (`const P = path.join(RAIZ, 'src/…')`) y lee la VARIABLE. Con el armador dentro, el censo pasó
// de 45 a 54 candidatos. Un literal armado sólo cuenta si el fichero ADEMÁS lee de verdad: si no,
// mencionar una ruta bastaría para aprobar (mismo error que el `'dist'` suelto de SCRUM-763).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url'; // NUNCA `new URL().pathname`: no decodifica (SCRUM-730)
import ts from 'typescript';
import { ejecutadoDirectamente } from './_puerta-de-entrada.mjs'; // SCRUM-765

const PRODUCTO = /^(src|dist|public|scripts|docs|prisma|[.]github|migrations)\//;
const LECTORES = new Set(['readFileSync', 'readdirSync', 'existsSync', 'statSync', 'lstatSync', 'readFile']);
const ARMADORES = new Set(['join', 'resolve', 'normalize']);
const BARRA = String.fromCharCode(92);

/** Qué código de PRODUCTO asevera un fichero de test. Por AST, nunca por grep (SCRUM-203). */
export function aseveraSobreProducto(codigo, nombre = 'x.test.mjs') {
  const sf = ts.createSourceFile(nombre, codigo, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  const pruebas = [];
  let hayLector = false; // una ruta ARMADA sólo prueba algo si el fichero LEE de verdad
  const literales = (n, out = []) => {
    if (!n) return out;
    if (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) out.push(n.text);
    else if (ts.isTemplateExpression(n)) {
      out.push(n.head.text);
      for (const sp of n.templateSpans) out.push(sp.literal.text);
    } else n.forEachChild((h) => literales(h, out));
    return out;
  };
  const apunta = (t) => PRODUCTO.test(t.split(BARRA).join('/').replace(/^(\.\.?\/)+/, ''));
  const linea = (n) => sf.getLineAndCharacterOfPosition(n.getStart()).line + 1;
  const visita = (n) => {
    const espec = ts.isImportDeclaration(n) ? n.moduleSpecifier
      : (ts.isCallExpression(n) && n.expression.kind === ts.SyntaxKind.ImportKeyword ? n.arguments[0] : null);
    if (espec) for (const t of literales(espec)) if (apunta(t)) pruebas.push({ via: 'import', a: t, linea: linea(n) });
    if (ts.isCallExpression(n)) {
      const c = n.expression;
      const nom = ts.isIdentifier(c) ? c.text : (ts.isPropertyAccessExpression(c) ? c.name.text : null);
      if (nom && (LECTORES.has(nom) || ARMADORES.has(nom))) {
        for (const a of n.arguments) {
          for (const t of literales(a)) if (apunta(t)) pruebas.push({ via: nom, a: t, linea: linea(n) });
        }
      }
      if (nom && LECTORES.has(nom)) hayLector = true;
    }
    n.forEachChild(visita);
  };
  visita(sf);
  return pruebas.filter((p) => p.via === 'import' || LECTORES.has(p.via) || hayLector);
}

// ── EL PARTE POR FICHERO ───────────────────────────────────────────────────────────────────
// MEDIDO el 7-sep-2026: el reporter `tap` de node NO atribuye los tests a su fichero. Con 300+
// ficheros en una sola invocación la salida es PLANA: 5.749 subtests en columna 0 y CERO líneas
// `# Subtest: tests/…`. Los EVENTOS del runner sí llevan `data.file`, y por ahí sale exacto.
// Reporter de una línea: yield JSON.stringify({f: d.file, n: d.name, ok, skip}) por test.
export function parteDeLaTanda(jsonl) {
  const porFichero = new Map();
  for (const linea of jsonl.trim().split('\n')) {
    if (!linea) continue;
    const e = JSON.parse(linea);
    const f = e.f ? path.basename(String(e.f).split(BARRA).join('/')) : '(sin fichero)';
    if (!porFichero.has(f)) porFichero.set(f, { ok: 0, saltados: 0, fallos: 0, nombres: [] });
    const t = porFichero.get(f);
    if (e.skip || e.todo) t.saltados++;
    else if (e.ok) { t.ok++; if (t.nombres.length < 4) t.nombres.push(e.n); }
    else t.fallos++;
  }
  return porFichero;
}

/**
 * El veredicto de UN ticket. Tres cubos que deben sumar la población.
 * - `noMedible`: épica o bloque paraguas — no describe comportamiento comprobable por el árbol.
 * - `decl`: mutaciones declaradas para su número (el arnés NOMBRA el test que cae).
 * - `guardsVivos`: tests suyos que aseveran sobre producto y pasan sin saltar.
 * - `aterrizo`: rama enteramente dentro de main, o entrada de máster suya. Sin aterrizaje, un
 *   guard verde no dice que el trabajo llegara: dice que alguien escribió un test.
 * - `noConstruye`: la propia entrada declara que no se construyó («cero construcción»).
 */
export function veredictoDe({ noMedible, decl = [], guardsVivos = [], aterrizo = false, noConstruye = false }) {
  if (noMedible) return 'NO MEDIBLE';
  if (noConstruye) return 'NO HECHO';
  if (decl.length > 0) return 'HECHO';
  if (guardsVivos.length > 0 && aterrizo) return 'HECHO';
  return 'NO HECHO';
}

const sinAdorno = (t) => String(t).replace(/^[^A-Za-z0-9]+/, '');
/** Épicas y bloques paraguas: por encargo, NO MEDIBLE. */
export function esParaguas(titulo) {
  return /^BLOQUE\b/i.test(sinAdorno(titulo)) || /\blote aprobado\b/i.test(titulo) || /\(\d+ tickets\)/.test(titulo);
}

if (ejecutadoDirectamente(import.meta.url)) {
  const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'tests');
  let n = 0;
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.test.mjs'))) {
    if (aseveraSobreProducto(fs.readFileSync(path.join(dir, f), 'utf8'), f).length) n++;
  }
  console.log(`tests que aseveran sobre codigo de producto: ${n}`);
}
