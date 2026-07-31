// tests/_tenencia-lectura.mjs — SCRUM-243 · ¿QUIÉN LEE DATOS DE OTRO MERCHANT?
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// EL HUECO
//
// El aislamiento entre merchants en ESCRITURA tiene mecanismo. En LECTURA es disciplina: nada
// impide que una consulta se deje el `merchantId` y devuelva datos de otro profesional. La
// regla 2 («toda query filtra por `req.merchantId`») está escrita en CLAUDE.md y no existe en
// ningún sitio que una máquina pueda comprobar.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// POR QUÉ UN GUARD Y NO UN MIDDLEWARE, decidido con la medición delante
//
// **69 ficheros distintos** contienen lecturas de modelos con `merchantId`. No hay embudo: cada
// ruta consulta por su cuenta. Un middleware exigiría o refactorizar los 69, o un cliente Prisma
// extendido con `AsyncLocalStorage` para inyectar el filtro — eso es arquitectura, no un ticket.
// Y la urgencia no lo pide: el número que la justificaría es **CERO** (ver abajo).
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// TRES CUBOS, PORQUE «NO PUDE VERLO» NO ES «NO FILTRA»
//
// La primera medición dio 129 lecturas «sin filtro» y SOBRECONTABA: `where: whereRango(merchantId,
// rango)` filtra perfectamente, pero el `where` es una LLAMADA y no un literal, así que el
// analizador no encontraba la propiedad. Contar eso como agujero infla el problema, y un número
// inflado en una medición de seguridad es tan inútil como uno corto. De ahí los tres cubos:
//   · FILTRA     — el `where` es un literal y menciona `merchantId`
//   · INDIRECTO  — el `where` es una variable o una llamada: no se puede afirmar desde aquí
//   · SIN FILTRO — literal sin `merchantId`, o sin `where` ninguno
//
// Y una cuarta dimensión, que es la que decide si algo es un agujero de verdad: ¿la FUNCIÓN que
// envuelve la consulta menciona `merchantId` en algún sitio? Si no lo menciona, no hay ni
// siquiera una comprobación aparte. A eso se le llama aquí «SIN RED».
//
// ⚠️ AST y no `grep`: un `merchantId` en un comentario, en un `select` o en el `data` de una
// escritura no es un filtro, y contarlo como tal daría un verde falso justo en la pregunta.
import ts from 'typescript';
import fs from 'node:fs';
import path from 'node:path';

export const LECTURAS = new Set([
  'findMany', 'findFirst', 'findUnique', 'findUniqueOrThrow', 'findFirstOrThrow',
  'count', 'aggregate', 'groupBy',
]);

/** Modelos con `merchantId`, leídos del SCHEMA y no de una lista a mano. */
export function modelosConMerchant(raiz) {
  const schema = fs.readFileSync(path.join(raiz, 'prisma', 'schema.prisma'), 'utf8');
  const out = new Set();
  for (const m of schema.matchAll(/^model\s+(\w+)\s*\{([\s\S]*?)^\}/gm)) {
    if (/^\s*merchantId\s/m.test(m[2])) out.add(m[1].charAt(0).toLowerCase() + m[1].slice(1));
  }
  return out;
}

/**
 * Cómo se monta cada router, leído de `app.ts`. Es lo que distingue «ruta que alcanza un
 * profesional con sesión» de «ruta pública por token» o «endpoint interno», y sin ese dato el
 * censo no puede decir si un agujero es alcanzable.
 */
export function montajes(raiz) {
  const appTs = fs.readFileSync(path.join(raiz, 'src', 'app.ts'), 'utf8');
  const porVar = new Map();
  for (const l of appTs.split(/\r?\n/)) {
    const m = /^\s*(?:app\.use|mountAdmin)\s*\(\s*(?:app\s*,\s*)?'([^']+)'\s*,?\s*(.*)$/.exec(l);
    if (!m) continue;
    for (const v of m[2].matchAll(/\b(\w+Router)\b/g)) porVar.set(v[1], l.trim());
  }
  const porFichero = new Map();
  for (const m of appTs.matchAll(/import\s+(\w+Router)\s+from\s+'\.\/(.+?)'/g)) {
    const f = 'src/' + m[2] + '.ts';
    if (porVar.has(m[1])) porFichero.set(f, porVar.get(m[1]));
  }
  return porFichero;
}

/** Un montaje es AUTENTICADO si pasa por la sesión del profesional. */
export const esMontajeAutenticado = (linea) => /requireAuth|requireRole|mountAdmin/.test(linea);

function mencionaMerchantId(nodo) {
  let visto = false;
  const v = (x) => {
    if (visto || !x) return;
    if (ts.isIdentifier(x) && /merchantId/.test(x.text)) visto = true;
    else ts.forEachChild(x, v);
  };
  v(nodo);
  return visto;
}

function whereDe(arg) {
  if (!arg || !ts.isObjectLiteralExpression(arg)) return { tipo: 'sin-args', nodo: null };
  for (const p of arg.properties) {
    if (ts.isPropertyAssignment(p) && p.name.getText() === 'where') {
      const i = p.initializer;
      if (ts.isObjectLiteralExpression(i)) return { tipo: 'literal', nodo: i };
      return { tipo: ts.isCallExpression(i) ? 'llamada' : 'variable', nodo: i };
    }
    if (ts.isShorthandPropertyAssignment(p) && p.name.getText() === 'where') {
      return { tipo: 'variable', nodo: p };
    }
  }
  return { tipo: 'sin-where', nodo: null };
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

/** Analiza UN fichero. Exportado aparte para poder probar el analizador con código sintético. */
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
          const filtra = w.tipo === 'literal' && mencionaMerchantId(w.nodo);
          const cubo = filtra ? 'filtra' : (w.tipo === 'llamada' || w.tipo === 'variable') ? 'indirecto' : 'sin-filtro';
          out.push({
            ruta, linea: sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1,
            modelo, metodo, cubo,
            // SIN RED = ni filtra en el where, ni su función menciona merchantId en ningún sitio.
            sinRed: !filtra && !(fn ? mencionaMerchantId(fn) : false),
          });
        }
      }
    }
    ts.forEachChild(n, visitar);
  };
  ts.forEachChild(sf, visitar);
  return out;
}

/** Recorre `src/` entero. */
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
