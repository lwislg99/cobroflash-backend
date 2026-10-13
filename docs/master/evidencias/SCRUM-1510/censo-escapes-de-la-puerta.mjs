// docs/master/evidencias/SCRUM-1510/censo-escapes-de-la-puerta.mjs — SCRUM-1510, pregunta ①
//
// ¿CUÁNTOS LLAMADORES DE LA PUERTA (`sellarTrasEmision`) ESCAPAN HOY AL PUNTO CIEGO ③ de
// `tests/scrum205-fallo-de-sellado-no-entrega.test.mjs`?  Por ALIAS, y por «recojo el resultado y no
// le hago caso». Sólo LEE `src/`. No toca el guard ni el camino de emisión.
//
//   node docs/master/evidencias/SCRUM-1510/censo-escapes-de-la-puerta.mjs
//
// QUÉ MIRA, y con qué regla (AST sintáctico, fichero a fichero; NO usa el comprobador de tipos):
//   · toda aparición del nombre de la puerta como IDENTIFICADOR, clasificada por su sitio: declaración,
//     import/export, tipo, LLAMADA (la única forma que ve el guard) o VALOR SIN LLAMAR (semilla de alias);
//   · los imports que la renombran (`import { puerta as otra }`) y las llamadas por ese otro nombre;
//   · toda forma de traer el módulo que la declara que no sea un import con nombres (espacio de
//     nombres, `require`, `import()`, `export * from`): por ahí se llegaría a ella sin escribirla;
//   · el nombre escrito como CADENA (acceso dinámico);
//   · la propiedad tipada con `typeof puerta` (el doble inyectable): quién la rellena y quién la llama;
//   · de cada llamada directa: adónde va el resultado, y si la variable que lo recoge se lee, y dónde.
//
// DOS CONTROLES, los dos obligatorios (normas del 8-oct, ① y ①ter):
//   · A CERO: el mismo censo con un nombre DERIVADO que no puede estar en el árbol (lleva dentro el
//     sha256 del propio `src/`). Todo tiene que dar 0.
//   · POSITIVO: (a) la declaración aparece 1 vez y las llamadas directas son las mismas que contó la
//     medición anterior (se LEE de su salida, no se escribe aquí); (b) sobre un ESPEJO de `src/`
//     dentro de `dist/`, cuatro siembras —alias, import renombrado, recoger y no leer, leer y
//     entregar igual— y el censo tiene que ver CADA UNA. El árbol se coteja por sha256 antes y después.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import ts from 'typescript';

const RAIZ = path.resolve(import.meta.dirname, '../../../..');
const PUERTA = 'sellarTrasEmision';
const MODULO = 'selladoEstado';
const PRODUCE_BYTES = ['generateInvoicePdf', 'ensureInvoicePdf', 'createReadStream']; // los del guard
const PORTEROS = ['exigirDocumentoEmitible', 'puedeProducirDocumento']; // los del guard
const REINTENTO = 'modules/invoicing/domain/reintentoSellado.ts';

const sha = (b) => crypto.createHash('sha256').update(b).digest('hex');
const fuentes = (dir, out = []) => {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) fuentes(p, out);
    else if (e.name.endsWith('.ts')) out.push(p);
  }
  return out.sort();
};
const esFuncion = (n) =>
  ts.isFunctionDeclaration(n) || ts.isFunctionExpression(n) || ts.isArrowFunction(n) || ts.isMethodDeclaration(n);
const nombreDeLlamada = (n) => {
  const c = n.expression;
  return ts.isPropertyAccessExpression(c) ? c.name.text : ts.isIdentifier(c) ? c.text : null;
};
const contiene = (nodo, nombres) => {
  let visto = false;
  const v = (n) => { if (ts.isCallExpression(n) && nombres.includes(nombreDeLlamada(n))) visto = true; ts.forEachChild(n, v); };
  ts.forEachChild(nodo, v);
  return visto;
};
const dentroDeTipo = (n) => { for (let p = n.parent; p; p = p.parent) if (ts.isTypeNode(p)) return true; return false; };
const funcionesQueEnvuelven = (n) => { const o = []; for (let p = n.parent; p; p = p.parent) if (esFuncion(p)) o.push(p); return o; };

/** Dónde se LEE una variable: ¿decide algo (condición, return, throw) o sólo se enseña? */
function sitioDeLectura(id) {
  let hijo = id;
  for (let p = id.parent; p; hijo = p, p = p.parent) {
    if (ts.isIfStatement(p) && p.expression === hijo) return 'condición';
    if (ts.isConditionalExpression(p) && p.condition === hijo) return 'condición';
    if (ts.isBinaryExpression(p) && [ts.SyntaxKind.AmpersandAmpersandToken, ts.SyntaxKind.BarBarToken].includes(p.operatorToken.kind) && p.left === hijo) return 'condición';
    if (ts.isReturnStatement(p)) return 'return';
    if (ts.isThrowStatement(p)) return 'throw';
    if (ts.isVariableDeclaration(p) && p.initializer === hijo && ts.isIdentifier(p.name)) return `deriva:${p.name.text}`;
    if (ts.isStatement(p)) return 'otra';
  }
  return 'otra';
}
/** Lecturas de la variable `nombre` dentro de `ambito`, después de `desde`. Sigue UN salto de derivadas. */
function lecturasDe(nombre, ambito, desde, salto = 0) {
  const sitios = [];
  const v = (n) => {
    if (ts.isIdentifier(n) && n.text === nombre && n.getStart() > desde
      && !(ts.isVariableDeclaration(n.parent) && n.parent.name === n)
      && !(ts.isPropertyAccessExpression(n.parent) && n.parent.name === n)
      && !(ts.isPropertyAssignment(n.parent) && n.parent.name === n)) {
      const s = sitioDeLectura(n);
      if (s.startsWith('deriva:') && salto < 2) sitios.push(...lecturasDe(s.slice(7), ambito, n.getStart(), salto + 1).map((x) => `${s.slice(7)}→${x}`));
      else sitios.push(s);
    }
    ts.forEachChild(n, v);
  };
  v(ambito);
  return sitios;
}

export function censar(raizSrc, puerta = PUERTA, modulo = MODULO) {
  const c = {
    ficheros: 0, identificadores: 0, textoBruto: 0, declaraciones: [], imports: [], reexportes: [], tipos: [],
    llamadas: [], valoresSinLlamar: [], renombrados: [], llamadasPorOtroNombre: [], cadenas: [],
    modulosNoNombrados: [], propiedadesDoble: [], rellenanElDoble: [], llamanAlDoble: [],
  };
  const arboles = [];
  for (const p of fuentes(raizSrc)) {
    const texto = fs.readFileSync(p, 'utf8');
    const arbol = ts.createSourceFile(p, texto, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
    arboles.push([p, arbol]);
    c.ficheros += 1;
    c.textoBruto += texto.split(puerta).length - 1;
  }
  const r = (p) => path.relative(raizSrc, p).split(path.sep).join('/');
  const ref = (p, arbol, n) => `${r(p)}:${arbol.getLineAndCharacterOfPosition(n.getStart(arbol)).line + 1}`;

  for (const [p, arbol] of arboles) {
    const otrosNombres = new Set(); // nombres locales que SON la puerta sin llamarse como ella
    // ── cómo entra el módulo en este fichero ──
    const verModulo = (n) => {
      const espec = (ts.isImportDeclaration(n) || ts.isExportDeclaration(n)) && n.moduleSpecifier && ts.isStringLiteral(n.moduleSpecifier) ? n.moduleSpecifier.text : null;
      if (espec && espec.split('/').pop() === modulo) {
        if (ts.isImportDeclaration(n)) {
          const cl = n.importClause;
          const nb = cl?.namedBindings;
          if (cl?.name) c.modulosNoNombrados.push(`${ref(p, arbol, n)} · import por defecto`);
          if (nb && ts.isNamespaceImport(nb)) c.modulosNoNombrados.push(`${ref(p, arbol, n)} · espacio de nombres «${nb.name.text}»`);
          if (nb && ts.isNamedImports(nb)) for (const e of nb.elements) {
            if ((e.propertyName?.text ?? e.name.text) === puerta && e.name.text !== puerta) { otrosNombres.add(e.name.text); c.renombrados.push(`${ref(p, arbol, e)} · como «${e.name.text}»`); }
          }
        } else if (!n.exportClause) c.modulosNoNombrados.push(`${ref(p, arbol, n)} · export * from`);
        else if (ts.isNamedExports(n.exportClause)) for (const e of n.exportClause.elements) {
          if ((e.propertyName?.text ?? e.name.text) === puerta) c.reexportes.push(`${ref(p, arbol, e)} · como «${e.name.text}»`);
        } else c.modulosNoNombrados.push(`${ref(p, arbol, n)} · export * as`);
      }
      if (ts.isCallExpression(n) && n.arguments.length && ts.isStringLiteralLike(n.arguments[0]) && n.arguments[0].text.split('/').pop() === modulo
        && (n.expression.kind === ts.SyntaxKind.ImportKeyword || (ts.isIdentifier(n.expression) && n.expression.text === 'require'))) {
        c.modulosNoNombrados.push(`${ref(p, arbol, n)} · ${n.expression.kind === ts.SyntaxKind.ImportKeyword ? 'import()' : 'require()'}`);
      }
      ts.forEachChild(n, verModulo);
    };
    verModulo(arbol);

    const ver = (n) => {
      if (ts.isStringLiteralLike(n) && n.text === puerta) c.cadenas.push(ref(p, arbol, n));
      if (ts.isIdentifier(n) && (n.text === puerta || otrosNombres.has(n.text))) {
        const propio = n.text === puerta;
        if (propio) c.identificadores += 1;
        const pa = n.parent;
        const esNombreDePropiedad = ts.isPropertyAccessExpression(pa) && pa.name === n;
        const expr = esNombreDePropiedad ? pa : n;
        if (ts.isFunctionDeclaration(pa) && pa.name === n) c.declaraciones.push(ref(p, arbol, n));
        else if (ts.isImportSpecifier(pa)) { if (propio) c.imports.push(ref(p, arbol, n)); }
        else if (ts.isExportSpecifier(pa)) { /* contado arriba */ }
        else if (dentroDeTipo(n)) {
          c.tipos.push(ref(p, arbol, n));
          // ¿tipa una propiedad? Ése es el hueco por el que se inyecta un doble.
          for (let q = n.parent; q; q = q.parent) if (ts.isPropertySignature(q) && ts.isIdentifier(q.name)) { c.propiedadesDoble.push({ nombre: q.name.text, ref: ref(p, arbol, q) }); break; }
        } else if (ts.isCallExpression(expr.parent) && expr.parent.expression === expr) {
          const ll = expr.parent;
          if (!propio) c.llamadasPorOtroNombre.push(`${ref(p, arbol, ll)} · «${n.text}(…)»`);
          else c.llamadas.push(describirLlamada(p, arbol, ll, ref));
        } else {
          // VALOR SIN LLAMAR: la semilla de un alias. ¿A qué nombre va a parar, y se llama por él?
          let q = expr.parent;
          while (q && !ts.isVariableDeclaration(q) && !ts.isStatement(q) && !ts.isPropertyAssignment(q) && !ts.isCallExpression(q)) q = q.parent;
          const alias = q && ts.isVariableDeclaration(q) && ts.isIdentifier(q.name) ? q.name.text : null;
          let porAlias = 0;
          if (alias) { const w = (m) => { if (ts.isCallExpression(m) && ts.isIdentifier(m.expression) && m.expression.text === alias) porAlias += 1; ts.forEachChild(m, w); }; w(arbol); }
          const forma = !q ? 'suelto' : ts.isVariableDeclaration(q) ? `variable «${alias ?? '?'}»` : ts.isPropertyAssignment(q) ? `propiedad «${q.name.getText(arbol)}»` : ts.isCallExpression(q) ? `argumento de «${q.expression.getText(arbol).slice(0, 40)}»` : ts.SyntaxKind[q.kind];
          c.valoresSinLlamar.push({ ref: ref(p, arbol, n), forma, llamadasPorAlias: porAlias, texto: (q ?? expr.parent).getText(arbol).replace(/\s+/g, ' ').slice(0, 110) });
        }
      }
      ts.forEachChild(n, ver);
    };
    ver(arbol);
  }

  // ── el doble inyectable: quién rellena la propiedad y quién la llama (en todo `src/`) ──
  const nombresDoble = [...new Set(c.propiedadesDoble.map((d) => d.nombre))];
  for (const [p, arbol] of arboles) {
    const ver = (n) => {
      if ((ts.isPropertyAssignment(n) || ts.isShorthandPropertyAssignment(n)) && ts.isIdentifier(n.name) && nombresDoble.includes(n.name.text)) c.rellenanElDoble.push(`${ref(p, arbol, n)} · ${n.getText(arbol).replace(/\s+/g, ' ').slice(0, 70)}`);
      if (ts.isCallExpression(n) && ts.isPropertyAccessExpression(n.expression) && nombresDoble.includes(n.expression.name.text)) c.llamanAlDoble.push(`${ref(p, arbol, n)} · ${n.expression.getText(arbol)}(…)`);
      ts.forEachChild(n, ver);
    };
    if (nombresDoble.length) ver(arbol);
  }
  return c;
}

/** De una llamada directa: adónde va lo que devuelve, y qué se hace con ello. */
function describirLlamada(p, arbol, ll, ref) {
  // la regla del guard, tal cual, para saber qué ve ÉL
  let sub = ll.parent;
  if (sub && ts.isAwaitExpression(sub)) sub = sub.parent;
  const descartadoSegunGuard = !!sub && ts.isExpressionStatement(sub);
  const fns = funcionesQueEnvuelven(ll);
  const produce = fns.some((fn) => contiene(fn, PRODUCE_BYTES));
  const portero = fns.some((fn) => contiene(fn, PORTEROS));
  // subir hasta el sitio que recibe el valor
  let hijo = ll;
  let q = ll.parent;
  const camino = [];
  while (q && (ts.isAwaitExpression(q) || ts.isParenthesizedExpression(q) || ts.isPropertyAccessExpression(q) || ts.isBinaryExpression(q) || ts.isConditionalExpression(q) || ts.isNonNullExpression(q) || ts.isAsExpression(q))) {
    if (ts.isPropertyAccessExpression(q)) camino.push(`.${q.name.text}`);
    if (ts.isBinaryExpression(q)) camino.push(q.operatorToken.getText(arbol));
    if (ts.isConditionalExpression(q)) camino.push(q.condition === hijo ? '?cond' : '?rama');
    hijo = q; q = q.parent;
  }
  let destino; let lecturas = null; let variable = null;
  if (q && ts.isVariableDeclaration(q) && ts.isIdentifier(q.name)) {
    variable = q.name.text;
    const ambito = fns[0] ?? arbol;
    lecturas = lecturasDe(variable, ambito, q.getEnd());
    destino = `variable «${variable}»`;
  } else if (q && ts.isExpressionStatement(q)) destino = 'NADIE (sentencia suelta)';
  else if (q && ts.isReturnStatement(q)) destino = 'return';
  else if (q && ts.isIfStatement(q)) destino = 'condición de un if';
  else destino = q ? ts.SyntaxKind[q.kind] : '?';
  const condiciona = (s) => /(^|→)(condición|throw)$/.test(s);
  const sale = (s) => /(^|→)return$/.test(s);
  let veredicto;
  if (descartadoSegunGuard) veredicto = 'DESCARTA (lo ve el guard)';
  else if (variable && lecturas.length === 0) veredicto = 'RECOGE Y NO LEE';
  else if (variable && !lecturas.some(condiciona) && !lecturas.some(sale)) veredicto = 'LEE SIN DECIDIR';
  else if (variable && !lecturas.some(condiciona)) veredicto = 'SÓLO LO DEVUELVE';
  else veredicto = 'LO LEE EN UNA CONDICIÓN';
  return { ref: ref(p, arbol, ll), fichero: ref(p, arbol, ll).split(':')[0], descartadoSegunGuard, produce, portero, destino, camino: camino.join(' '), variable, lecturas, veredicto };
}

function resumen(c) {
  const escapaAlias = c.valoresSinLlamar.length + c.llamadasPorOtroNombre.length + c.renombrados.length + c.modulosNoNombrados.length + c.reexportes.length + c.cadenas.length;
  const noHaceCaso = c.llamadas.filter((l) => l.veredicto === 'RECOGE Y NO LEE' || l.veredicto === 'LEE SIN DECIDIR');
  const leeYProduceSinPortero = c.llamadas.filter((l) => !l.descartadoSegunGuard && l.produce && !l.portero);
  return { escapaAlias, noHaceCaso, leeYProduceSinPortero };
}

function imprimir(titulo, c) {
  const s = resumen(c);
  console.log(`\n══ ${titulo}`);
  console.log(`ficheros .ts leídos: ${c.ficheros} · el nombre en el texto bruto: ${c.textoBruto} veces · como identificador: ${c.identificadores}`);
  console.log(`declaraciones: ${c.declaraciones.length} ${c.declaraciones.join(', ')}`);
  console.log(`imports con su nombre: ${c.imports.length} · en posición de tipo: ${c.tipos.length} ${c.tipos.join(', ')}`);
  console.log(`LLAMADAS DIRECTAS (lo que ve el guard): ${c.llamadas.length} en ${new Set(c.llamadas.map((l) => l.fichero)).size} ficheros`);
  for (const l of c.llamadas) console.log(`  · ${l.ref} · ${l.veredicto} · va a ${l.destino}${l.camino ? ` [${l.camino}]` : ''}${l.lecturas ? ` · lecturas ${l.lecturas.length}: ${l.lecturas.join(', ')}` : ''} · produce bytes ${l.produce ? 'SÍ' : 'no'} · portero ${l.portero ? 'sí' : 'no'}`);
  console.log('POR ALIAS (lo que el guard NO ve):');
  console.log(`  valor sin llamar (semilla de alias): ${c.valoresSinLlamar.length}`);
  for (const v of c.valoresSinLlamar) console.log(`    · ${v.ref} · ${v.forma} · llamadas por ese alias: ${v.llamadasPorAlias} · ${v.texto}`);
  console.log(`  import renombrado: ${c.renombrados.length} ${c.renombrados.join(' | ')}`);
  console.log(`  llamadas por el otro nombre: ${c.llamadasPorOtroNombre.length} ${c.llamadasPorOtroNombre.join(' | ')}`);
  console.log(`  módulo traído sin nombrar (namespace/require/import()/export *): ${c.modulosNoNombrados.length} ${c.modulosNoNombrados.join(' | ')}`);
  console.log(`  re-exportada desde otro fichero: ${c.reexportes.length} ${c.reexportes.join(' | ')}`);
  console.log(`  el nombre como cadena: ${c.cadenas.length} ${c.cadenas.join(' | ')}`);
  console.log(`  → ESCAPAN POR ALIAS: ${s.escapaAlias}`);
  console.log(`EL DOBLE INYECTABLE (propiedad tipada con typeof la puerta): ${c.propiedadesDoble.map((d) => `«${d.nombre}» ${d.ref}`).join(', ') || 'ninguna'}`);
  console.log(`  la rellenan en src/: ${c.rellenanElDoble.length} ${c.rellenanElDoble.join(' | ')}`);
  console.log(`  la llaman en src/: ${c.llamanAlDoble.length} ${c.llamanAlDoble.join(' | ')}`);
  console.log(`«RECOJO Y NO HAGO CASO»: no lee o lee sin decidir: ${s.noHaceCaso.length} ${s.noHaceCaso.map((l) => l.ref).join(', ')}`);
  console.log(`  de los que recogen: lo leen en una condición ${c.llamadas.filter((l) => l.veredicto === 'LO LEE EN UNA CONDICIÓN').length} · sólo lo devuelven a quien llamó ${c.llamadas.filter((l) => l.veredicto === 'SÓLO LO DEVUELVE').length} (qué hace la condición NO lo juzga este censo: se lee a mano)`);
  console.log(`  recogen el resultado, producen bytes y NO pasan por portero (a leer a mano): ${s.leeYProduceSinPortero.length} ${s.leeYProduceSinPortero.map((l) => l.ref).join(', ')}`);
  return s;
}

// ───────────────────────────────────────────────────────────────────────────────────────────────
if (process.argv[1] && path.resolve(process.argv[1]) === import.meta.filename) {
  const SRC = path.join(RAIZ, 'src');
  const huella = () => sha(fuentes(SRC).map((p) => sha(fs.readFileSync(p))).join('\n'));
  const antes = huella();
  let mal = 0;

  // ── CONTROL A CERO, antes del número ──
  const fantasma = `${PUERTA}_${antes.slice(0, 10)}`;
  const cero = censar(SRC, fantasma, `${MODULO}_${antes.slice(0, 10)}`);
  const sumaCero = cero.textoBruto + cero.identificadores + cero.declaraciones.length + cero.llamadas.length + cero.valoresSinLlamar.length + cero.renombrados.length + cero.modulosNoNombrados.length + cero.cadenas.length + cero.tipos.length;
  console.log(`CONTROL A CERO · nombre derivado «${fantasma}» · ficheros leídos ${cero.ficheros} · todo lo que encuentra: ${sumaCero} ${sumaCero === 0 && cero.ficheros > 0 ? '(bien: 0, y con ficheros leídos)' : '🔴 NO DA CERO o no leyó nada'}`);
  if (sumaCero !== 0 || !(cero.ficheros > 0)) mal += 1;

  // ── EL CENSO ──
  const c = censar(SRC);
  const s = imprimir(`EL ÁRBOL · src/ · huella ${antes.slice(0, 12)}`, c);

  // ── POSITIVO (a): contra la medición anterior, LEÍDA de su salida ──
  const anterior = path.join(RAIZ, 'docs/master/evidencias/SCRUM-1404/salida-censo-scrum205-por-efecto.txt');
  const m = fs.existsSync(anterior) ? /LLAMADAS A LA PUERTA, mi lectura: (\d+) en (\d+) ficheros/.exec(fs.readFileSync(anterior, 'utf8')) : null;
  const okA = c.declaraciones.length === 1 && !!m && Number(m[1]) === c.llamadas.length && Number(m[2]) === new Set(c.llamadas.map((l) => l.fichero)).size && c.llamadas.some((l) => l.fichero === REINTENTO);
  console.log(`\nPOSITIVO (a) · declaración ${c.declaraciones.length} (espero 1) · llamadas ${c.llamadas.length} en ${new Set(c.llamadas.map((l) => l.fichero)).size} ficheros, la medición anterior leyó ${m ? `${m[1]} en ${m[2]}` : 'NO ENCUENTRO SU SALIDA'} · la del reintento dentro: ${c.llamadas.some((l) => l.fichero === REINTENTO) ? 'sí' : 'NO'} → ${okA ? 'CUADRA' : '🔴 NO CUADRA'}`);
  if (!okA) mal += 1;

  // ── POSITIVO (b): cuatro siembras sobre un ESPEJO; el censo tiene que ver cada una ──
  const ESPEJO = path.join(RAIZ, 'dist', `_espejo-1510-${process.pid}`);
  const LLAMADA = '      const r = opciones.sellar\n';
  const IMPORT = "import { sellarTrasEmision, SELLADO_PENDIENTE, SELLADO_HECHO, SELLADO_NO_APLICA } from './selladoEstado';";
  const SIEMBRAS = [
    { id: 'S1', que: 'alias: `const puerta = sellarTrasEmision; await puerta(…)` y entrega', ancla: LLAMADA, cambio: `      const puerta = sellarTrasEmision; await puerta(factura, f.merchant ?? {}, prisma); await ensureInvoicePdf(f.id);\n${LLAMADA}`, ve: (x, b) => x.valoresSinLlamar.length === b.valoresSinLlamar.length + 1 && x.valoresSinLlamar.some((v) => v.llamadasPorAlias === 1) },
    { id: 'S2', que: 'import renombrado y llamada por el otro nombre', ancla: IMPORT, cambio: `${IMPORT}\nimport { sellarTrasEmision as otraPuerta } from './selladoEstado';\nexport const _siembra = async (a: any, b: any, c: any) => { await otraPuerta(a, b, c); };`, ve: (x, b) => x.renombrados.length === b.renombrados.length + 1 && x.llamadasPorOtroNombre.length === b.llamadasPorOtroNombre.length + 1 },
    { id: 'S3', que: 'recoge el resultado, no lo lee, y entrega', ancla: LLAMADA, cambio: `      const tirado = await sellarTrasEmision(factura, f.merchant ?? {}, prisma); await ensureInvoicePdf(f.id);\n${LLAMADA}`, ve: (x) => x.llamadas.some((l) => l.veredicto === 'RECOGE Y NO LEE' && l.produce && !l.portero) },
    { id: 'S4', que: 'lee el resultado y con «sigue pendiente» entrega igual (la C4 de SCRUM-1404)', ancla: 'else parte.siguenPendientes.push(nombrada);', cambio: 'else { await ensureInvoicePdf(f.id); parte.siguenPendientes.push(nombrada); }', ve: (x, b) => resumen(x).leeYProduceSinPortero.length === resumen(b).leeYProduceSinPortero.length + 1 },
    { id: 'S5', que: 'espacio de nombres: `import * as s from …selladoEstado`', ancla: IMPORT, cambio: `${IMPORT}\nimport * as todoElModulo from './selladoEstado';\nexport const _siembra = todoElModulo;`, ve: (x, b) => x.modulosNoNombrados.length === b.modulosNoNombrados.length + 1 },
  ];
  try {
    fs.mkdirSync(path.join(RAIZ, 'dist'), { recursive: true });
    fs.cpSync(SRC, path.join(ESPEJO, 'src'), { recursive: true });
    const base = censar(path.join(ESPEJO, 'src'));
    const igual = JSON.stringify(base) === JSON.stringify(c);
    console.log(`\nPOSITIVO (b) · ESPEJO de src/ en dist/ · su censo sin sembrar es idéntico al del árbol: ${igual ? 'sí' : '🔴 NO'}`);
    if (!igual) mal += 1;
    const destino = path.join(ESPEJO, 'src', REINTENTO);
    const original = fs.readFileSync(destino, 'utf8');
    let vistas = 0;
    for (const sb of SIEMBRAS) {
      const veces = original.split(sb.ancla).length - 1;
      if (veces !== 1) { console.log(`  CIEGA   · ${sb.id} · ${sb.que} · el ancla casa ${veces} veces`); mal += 1; continue; }
      fs.writeFileSync(destino, original.replace(sb.ancla, sb.cambio));
      const x = censar(path.join(ESPEJO, 'src'));
      fs.writeFileSync(destino, original);
      const ok = sb.ve(x, base);
      if (ok) vistas += 1; else mal += 1;
      console.log(`  ${ok ? 'LA VE   ' : '🔴 NO LA VE'} · ${sb.id} · ${sb.que}`);
    }
    console.log(`  siembras: ${SIEMBRAS.length} · vistas: ${vistas}`);
  } finally {
    fs.rmSync(ESPEJO, { recursive: true, force: true });
  }
  const despues = huella();
  console.log(`\nÁRBOL DE VERDAD · huella sha256 de los ${c.ficheros} .ts de src/ antes y después: ${antes === despues ? 'IGUAL' : '🔴 MOVIDA'} · espejo borrado: ${fs.existsSync(ESPEJO) ? 'NO' : 'sí'}`);
  if (antes !== despues) mal += 1;

  console.log(`\nRESULTADO · escapan por ALIAS: ${s.escapaAlias} · «recojo y no hago caso»: ${s.noHaceCaso.length} · recogen + producen bytes sin portero: ${s.leeYProduceSinPortero.length}`);
  console.log(`controles que fallan: ${mal}`);
  console.log(`EXIT=${mal ? 1 : 0}`);
  process.exit(mal ? 1 : 0);
}
