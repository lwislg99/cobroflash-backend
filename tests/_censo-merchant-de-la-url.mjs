// tests/_censo-merchant-de-la-url.mjs — SCRUM-440
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// EL HUECO QUE NINGÚN GUARD DE TENENCIA PODÍA VER, Y POR QUÉ
//
// Los censos de SCRUM-243 y SCRUM-348 miran **lecturas de modelos que tienen columna
// `merchantId`**. Están bien para lo que miran. Pero `merchant` es el modelo RAÍZ: **no tiene esa
// columna** (medido: 21 modelos la tienen, `merchant` no está entre ellos). Así que
//
//     prisma.merchant.findUnique({ where: { id: merchantId } })
//
// produce **CERO lecturas censables**, y los dos analizadores son ciegos a esta ruta *por
// construcción* — no por descuido. `POST /admin/supresion/:merchantId` no aparecía en ningún censo
// de tenencia, y su handler no mencionaba `req.merchantId` ni una vez.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// LO QUE MIRA ESTE CENSO, Y POR QUÉ ES POR MECANISMO Y NO POR MENCIÓN
//
// La pregunta no es «¿qué modelo lee?» sino **«¿de dónde saca el merchant sobre el que actúa?»**.
// Si sale de la PETICIÓN (`req.params` / `req.query` / `req.body`), es un dato que elige quien
// llama, y entonces la misma función tiene que compararlo con el del solicitante — el que inyecta
// `requireAuth` en `req.merchantId`.
//
// Se deriva del árbol: cualquier handler futuro con `:merchantId` en su ruta entra solo. **No hay
// lista de rutas que mantener**, que es justo lo que SCRUM-348 dejó escrito: un guard que da por
// cubierto lo que MENCIONA el merchant crece hacia el falso verde.
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

/** De dónde puede venir un identificador elegido por quien llama. */
const ORIGENES_DE_LA_PETICION = ['params', 'query', 'body'];

/** El nombre del campo que inyecta `requireAuth` y que manda de verdad. */
const CAMPO_DEL_SOLICITANTE = 'merchantId';

function nombreDePropiedad(nodo) {
  if (ts.isIdentifier(nodo) || ts.isStringLiteral(nodo)) return nodo.text;
  return null;
}

/** ¿Es `req.<origen>.merchantId` (o `.merchantId` con cualquier nombre de request)? */
function esMerchantDeLaPeticion(nodo) {
  if (!ts.isPropertyAccessExpression(nodo)) return false;
  if (nombreDePropiedad(nodo.name) !== CAMPO_DEL_SOLICITANTE) return false;
  const padre = nodo.expression;
  if (!ts.isPropertyAccessExpression(padre)) return false;
  return ORIGENES_DE_LA_PETICION.includes(nombreDePropiedad(padre.name));
}

/** ¿Es `req.merchantId` — el del solicitante, inyectado por `requireAuth`? */
function esMerchantDelSolicitante(nodo) {
  if (!ts.isPropertyAccessExpression(nodo)) return false;
  if (nombreDePropiedad(nodo.name) !== CAMPO_DEL_SOLICITANTE) return false;
  // `req.merchantId` sí; `req.params.merchantId` no (ahí el padre es otro acceso).
  return ts.isIdentifier(nodo.expression);
}

function contiene(nodo, predicado) {
  let encontrado = false;
  const visitar = (n) => {
    if (encontrado) return;
    if (predicado(n)) { encontrado = true; return; }
    ts.forEachChild(n, visitar);
  };
  visitar(nodo);
  return encontrado;
}

/**
 * Las funciones de UN fuente que toman el merchant de la petición, con si lo comparan o no.
 *
 * @returns {{linea:number, comparaConElSolicitante:boolean, fragmento:string}[]}
 */
export function tomasDeMerchantEn(nombre, fuente) {
  const sf = ts.createSourceFile(nombre, fuente, ts.ScriptTarget.ES2020, true, ts.ScriptKind.TS);
  const out = [];

  const esFuncion = (n) =>
    ts.isFunctionDeclaration(n) || ts.isFunctionExpression(n) || ts.isArrowFunction(n) || ts.isMethodDeclaration(n);

  const visitar = (nodo) => {
    if (esFuncion(nodo) && nodo.body && contiene(nodo.body, esMerchantDeLaPeticion)) {
      const { line } = sf.getLineAndCharacterOfPosition(nodo.getStart(sf));
      out.push({
        linea: line + 1,
        // La red: en la MISMA función tiene que aparecer el merchant del solicitante. No basta con
        // que el fichero lo mencione en otro sitio — ésa es exactamente la trampa de SCRUM-348.
        comparaConElSolicitante: contiene(nodo.body, esMerchantDelSolicitante),
        fragmento: nodo.getText(sf).slice(0, 110).replace(/\s+/g, ' '),
      });
      return;   // no se baja a las funciones anidadas: la de fuera ya responde por ellas
    }
    ts.forEachChild(nodo, visitar);
  };
  ts.forEachChild(sf, visitar);
  return out;
}

/** El censo de `src/` entero. `raiz` para poder correrlo contra otro árbol. */
export function censo(raiz) {
  const dir = path.join(raiz, 'src');
  const ficheros = [];
  const recorrer = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) recorrer(p);
      else if (e.name.endsWith('.ts')) ficheros.push(p);
    }
  };
  if (fs.existsSync(dir)) recorrer(dir);

  const tomas = [];
  for (const f of ficheros) {
    const rel = path.relative(raiz, f).replace(/\\/g, '/');
    for (const t of tomasDeMerchantEn(rel, fs.readFileSync(f, 'utf8'))) tomas.push({ fichero: rel, ...t });
  }
  return {
    ficherosMirados: ficheros.length,
    tomas,
    sinComparar: tomas.filter((t) => !t.comparaConElSolicitante),
  };
}
