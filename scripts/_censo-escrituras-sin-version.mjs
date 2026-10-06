// scripts/_censo-escrituras-sin-version.mjs — SCRUM-1285 (parte S3) · ¿QUÉ ESCRITURAS REEMPLAZAN UN
// REGISTRO SIN COMPROBAR CONTRA QUÉ VERSIÓN ESCRIBEN?
//
// Uso:  node scripts/_censo-escrituras-sin-version.mjs [--json]
//
// ── EL MECANISMO, VISTO DOS VECES EL MISMO DÍA (29-sep-2026) ─────────────────────────────────────
// SCRUM-1276: una ruta LEÍA el presupuesto, comprobaba su estado y después hacía
// `update({ where: { id } })`. Entre la lectura y la escritura cabía otra petición, y un presupuesto
// aceptado se podía rechazar después. Se arregló metiendo la condición DENTRO del `where`
// (`where: { id, status: { in: ESTADOS_DECIDIBLES } }`), que es lo único que la base comprueba en el
// mismo instante en que escribe.
// SCRUM-1285: `quotesAdmin.routes.ts` (PATCH billing-plan) lee, valida y reemplaza con
// `where: { id }`. Dos PATCH desordenados y gana el viejo.
//
// Dos casos no dicen cuántos hay. Este censo los cuenta.
//
// ── QUÉ SE MIDE, POR AST (TypeScript), NUNCA POR TEXTO ──────────────────────────────────────────
// Toda llamada `<algo>.<modelo>.update | updateMany | upsert(...)` en `src/**/*.ts`, donde <modelo>
// es un modelo de `prisma/schema.prisma` (el receptor da igual: `prisma`, `tx`, `(prisma as any)`).
// Cada una cae en UNA clase:
//
//   LEE-Y-DECIDE ... el `where` solo trae claves de IDENTIDAD, el `data` reemplaza, y ANTES en la
//                    misma función hay un `findUnique/findFirst` del MISMO modelo. Es la forma exacta
//                    de 1276 y de 1285: se decide sobre una lectura que puede estar vieja al escribir.
//   A-CIEGAS ....... `where` de identidad y `data` que reemplaza, sin lectura previa del modelo en la
//                    función. Gana el último que llega; no hay decisión que se cuele por detrás.
//   CONDICIONADO ... el `where` lleva alguna clave que NO es de identidad (estado, versión, fecha…):
//                    la base comprueba algo al escribir. Es la forma del arreglo de 1276.
//   ATÓMICO ........ todo el `data` son operadores atómicos (`increment`, `decrement`…).
//   OPACO .......... el argumento, el `where` o el `data` no son un literal (variable, spread): el
//                    censo no puede decidir y lo DICE. Cuenta aparte; nunca como limpio.
//
// IDENTIDAD se DERIVA del esquema, no se escribe a mano: por modelo, sus campos `@id` y `@unique`, los
// nombres de sus `@@id`/`@@unique` compuestos, y `merchantId` (el filtro de tenencia, regla 2).
//
// ── LO QUE NO VE (dicho, no escondido) ──────────────────────────────────────────────────────────
// · Una lectura en OTRA función (un servicio que lee y la ruta que escribe) no cuenta como «lee y
//   decide»: esa escritura sale como A-CIEGAS. La clase A-CIEGAS es donde buscar ese caso.
// · `$executeRaw` y SQL a mano no se miran.
// · `create` no es reemplazo y no entra.
//
// ── CONTROL POSITIVO, EN CADA PASADA ────────────────────────────────────────────────────────────
// Antes de fiarse del árbol se censan dos rutas sintéticas sobre un modelo real del esquema: una con
// el defecto (lee, comprueba el estado y escribe con `where: { id }`) TIENE que salir LEE-Y-DECIDE, y
// la misma con la condición en el `where` TIENE que salir CONDICIONADO. Si no, sale 2.
//
// 🔴 SOLO LEE (regla 40). Recorre también el camino de emisión fiscal, como texto y AST; no importa,
//    ni ejecuta, ni modifica nada de él.
//
// SALIDA: 0 medido (el recuento es el dato; no juzga) · 2 no medido (sin esquema, sin modelos, cero
//         escrituras encontradas, un fichero que no parsea, o el control positivo falló).
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

// LA RAÍZ ES LA DEL ÁRBOL QUE SE MIDE: la de este fichero, no la de donde esté instalada una
// dependencia. Con `node_modules` en junction hacia otro checkout, derivarla de `typescript` medía
// aquel otro árbol y devolvía cero filas.
export const RAIZ_REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export const SALIDA_NO_MEDIDO = 2;
export const CLASES = ['LEE-Y-DECIDE', 'LEE-Y-RELLENA', 'LEE-SIN-DECIDIR', 'A-CIEGAS', 'CONDICIONADO', 'ATÓMICO', 'OPACO'];
const METODOS = new Set(['update', 'updateMany', 'upsert']);
const LECTURAS = new Set(['findUnique', 'findFirst', 'findUniqueOrThrow', 'findFirstOrThrow']);
const ATOMICOS = new Set(['increment', 'decrement', 'multiply', 'divide', 'push']);
const COMBINADORES = new Set(['AND', 'OR', 'NOT']);

function cargarTs(raiz) {
  try {
    return createRequire(path.join(raiz, 'package.json'))('typescript');
  } catch {
    return createRequire(path.join(RAIZ_REPO, 'package.json'))('typescript');
  }
}

/** Modelos del esquema → { accesor: Set(claves de identidad) }. */
export function identidadesDelEsquema(textoEsquema) {
  const modelos = new Map();
  const re = /^model\s+(\w+)\s*\{([\s\S]*?)^\}/gm;
  let m;
  while ((m = re.exec(textoEsquema))) {
    const [, nombre, cuerpo] = m;
    const ids = new Set(['merchantId']);
    for (const linea of cuerpo.split('\n')) {
      const t = linea.trim();
      if (!t || t.startsWith('//')) continue;
      const compuesto = t.match(/^@@(?:id|unique)\s*\(\s*\[([^\]]*)\]\s*(?:,\s*name\s*:\s*"(\w+)")?/);
      if (compuesto) {
        const campos = compuesto[1].split(',').map((s) => s.trim().replace(/\(.*$/, '')).filter(Boolean);
        ids.add(compuesto[2] || campos.join('_'));
        continue;
      }
      const campo = t.match(/^(\w+)\s+\S+.*?@(id|unique)\b/);
      if (campo) ids.add(campo[1]);
    }
    modelos.set(nombre.charAt(0).toLowerCase() + nombre.slice(1), ids);
  }
  return modelos;
}

function ficherosTs(dir) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...ficherosTs(p));
    else if (e.name.endsWith('.ts') && !e.name.endsWith('.d.ts')) out.push(p);
  }
  return out;
}

function censarFuente(ts, modelos, nombre, texto) {
  const sf = ts.createSourceFile(nombre, texto, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  if (sf.parseDiagnostics && sf.parseDiagnostics.length) return { error: `${nombre} no parsea` };
  const filas = [];
  const pelar = (n) => {
    while (n && (ts.isParenthesizedExpression(n) || ts.isAsExpression(n) || ts.isNonNullExpression(n) || ts.isTypeAssertionExpression?.(n))) n = n.expression;
    return n;
  };
  const nombreProp = (p) => (p.name && (ts.isIdentifier(p.name) || ts.isStringLiteral(p.name)) ? p.name.text : null);
  const prop = (obj, clave) => obj.properties.find((p) => (ts.isPropertyAssignment(p) || ts.isShorthandPropertyAssignment(p)) && nombreProp(p) === clave);
  const valor = (p) => (ts.isShorthandPropertyAssignment(p) ? p.name : pelar(p.initializer));

  // Claves del `where`, bajando por AND/OR/NOT. null = no se puede decidir (spread, no literal).
  const clavesDelWhere = (n) => {
    n = pelar(n);
    if (ts.isArrayLiteralExpression(n)) {
      const todas = [];
      for (const e of n.elements) { const k = clavesDelWhere(e); if (k === null) return null; todas.push(...k); }
      return todas;
    }
    if (!ts.isObjectLiteralExpression(n)) return null;
    const claves = [];
    for (const p of n.properties) {
      if (!(ts.isPropertyAssignment(p) || ts.isShorthandPropertyAssignment(p))) return null;
      const k = nombreProp(p);
      if (k === null) return null;
      if (COMBINADORES.has(k)) { const sub = clavesDelWhere(valor(p)); if (sub === null) return null; claves.push(...sub); }
      else claves.push(k);
    }
    return claves;
  };
  const esAtomico = (data) => {
    data = pelar(data);
    if (!ts.isObjectLiteralExpression(data) || !data.properties.length) return false;
    return data.properties.every((p) => {
      if (!ts.isPropertyAssignment(p)) return false;
      const v = pelar(p.initializer);
      return ts.isObjectLiteralExpression(v) && v.properties.length > 0
        && v.properties.every((q) => ts.isPropertyAssignment(q) && ATOMICOS.has(nombreProp(q)));
    });
  };
  const funcionQueEncierra = (n) => {
    let a = n.parent;
    while (a && !ts.isFunctionLike(a)) a = a.parent;
    return a || sf;
  };
  const llamadaAModelo = (n) => {
    if (!ts.isCallExpression(n)) return null;
    const c = pelar(n.expression);
    if (!ts.isPropertyAccessExpression(c)) return null;
    const obj = pelar(c.expression);
    if (!ts.isPropertyAccessExpression(obj)) return null;
    const modelo = obj.name.text;
    if (!modelos.has(modelo)) return null;
    return { modelo, metodo: c.name.text };
  };
  // Lecturas del MISMO modelo antes de la escritura, con la variable que las recibe (o null).
  const lecturasAntes = (fn, modelo, pos) => {
    const out = [];
    const visitar = (n) => {
      if (n.getStart(sf) >= pos) return;
      const l = llamadaAModelo(n);
      if (l && l.modelo === modelo && LECTURAS.has(l.metodo)) {
        let a = n.parent;
        while (a && (ts.isAwaitExpression(a) || ts.isParenthesizedExpression(a) || ts.isAsExpression(a) || ts.isNonNullExpression(a))) a = a.parent;
        let nombreVar = null;
        if (a && ts.isVariableDeclaration(a) && ts.isIdentifier(a.name)) nombreVar = a.name.text;
        else if (a && ts.isBinaryExpression(a) && a.operatorToken.kind === ts.SyntaxKind.EqualsToken && ts.isIdentifier(a.left)) nombreVar = a.left.text;
        out.push({ nombreVar, pos: n.getEnd() });
      }
      ts.forEachChild(n, visitar);
    };
    visitar(fn);
    return out;
  };

  // ¿La escritura DECIDE sobre lo leído? Sí, si entre la lectura y la escritura hay una condición
  // (`if`, ternario, `switch`) que depende de un campo leído —directamente (`q.status`) o por una
  // variable derivada (`const val = validar(q.plan)` → `if (!val.ok)`)— y ESE campo se escribe; o si
  // un campo escrito se calcula a partir de sí mismo leído (`n: q.n + 1`). Devuelve el campo, o null.
  const decide = (fn, lecturas, pos, data) => {
    const leidas = new Set(lecturas.map((l) => l.nombreVar).filter(Boolean));
    if (!leidas.size) return null;
    const desde = Math.min(...lecturas.map((l) => l.pos));
    const deps = new Map(); // alias → Set(campos leídos de los que depende)
    const camposDe = (expr) => {
      const campos = new Set();
      const ver = (n) => {
        const p = pelar(n);
        if (p && ts.isPropertyAccessExpression(p)) {
          const base = pelar(p.expression);
          if (ts.isIdentifier(base) && leidas.has(base.text)) campos.add(p.name.text);
        }
        if (ts.isIdentifier(n) && deps.has(n.text)) for (const c of deps.get(n.text)) campos.add(c);
        ts.forEachChild(n, ver);
      };
      ver(expr);
      return campos;
    };
    // Campo → ¿alguna condición mira su VALOR (y no solo si existe)? `!q.pdfUrl`, `q.pdfUrl &&`,
    // `q.x == null` solo preguntan si está; `q.status !== 'sent'` o `validar(q.plan)` miran el valor.
    const condiciones = new Map();
    const soloExistencia = (acceso) => {
      let hijo = acceso;
      let p = hijo.parent;
      while (p && (ts.isParenthesizedExpression(p) || ts.isNonNullExpression(p))) { hijo = p; p = p.parent; }
      if (!p) return true;
      if (ts.isPrefixUnaryExpression(p) && p.operator === ts.SyntaxKind.ExclamationToken) return true;
      if (ts.isIfStatement(p) || ts.isConditionalExpression(p) && p.condition === hijo) return true;
      if (ts.isBinaryExpression(p)) {
        const op = p.operatorToken.kind;
        if (op === ts.SyntaxKind.AmpersandAmpersandToken || op === ts.SyntaxKind.BarBarToken) return true;
        const otro = p.left === hijo ? p.right : p.left;
        const nulo = otro.kind === ts.SyntaxKind.NullKeyword || (ts.isIdentifier(otro) && otro.text === 'undefined');
        const igualdad = [ts.SyntaxKind.EqualsEqualsToken, ts.SyntaxKind.EqualsEqualsEqualsToken, ts.SyntaxKind.ExclamationEqualsToken, ts.SyntaxKind.ExclamationEqualsEqualsToken].includes(op);
        return igualdad && nulo;
      }
      return false;
    };
    const anotarCondicion = (expr) => {
      const ver = (n) => {
        const p = pelar(n);
        if (p && ts.isPropertyAccessExpression(p)) {
          const base = pelar(p.expression);
          if (ts.isIdentifier(base) && leidas.has(base.text)) {
            const campo = p.name.text;
            const deValor = !soloExistencia(n);
            condiciones.set(campo, (condiciones.get(campo) || false) || deValor);
          }
        }
        if (ts.isIdentifier(n) && deps.has(n.text)) for (const c of deps.get(n.text)) condiciones.set(c, true);
        ts.forEachChild(n, ver);
      };
      ver(expr);
    };
    const recorrer = (n) => {
      const ini = n.getStart(sf);
      if (ini >= pos) return;
      if (ts.isVariableDeclaration(n) && n.initializer && ini >= desde) {
        if (ts.isIdentifier(n.name)) {
          const c = camposDe(n.initializer);
          if (c.size) deps.set(n.name.text, c);
        } else if (ts.isObjectBindingPattern(n.name)) {
          const base = pelar(n.initializer);
          if (ts.isIdentifier(base) && leidas.has(base.text)) {
            for (const e of n.name.elements) {
              if (!ts.isIdentifier(e.name)) continue;
              const campo = e.propertyName && ts.isIdentifier(e.propertyName) ? e.propertyName.text : e.name.text;
              deps.set(e.name.text, new Set([campo]));
            }
          }
        }
      }
      if (ini >= desde) {
        const cond = ts.isIfStatement(n) ? n.expression
          : ts.isConditionalExpression(n) ? n.condition
          : ts.isSwitchStatement(n) ? n.expression : null;
        if (cond) anotarCondicion(cond);
      }
      ts.forEachChild(n, recorrer);
    };
    recorrer(fn);
    data = pelar(data);
    if (!ts.isObjectLiteralExpression(data)) return null;
    let relleno = null;
    for (const p of data.properties) {
      const k = nombreProp(p);
      if (!k) continue;
      if (ts.isPropertyAssignment(p) && camposDe(p.initializer).has(k)) return { campo: k, deValor: true };
      if (condiciones.has(k)) {
        if (condiciones.get(k)) return { campo: k, deValor: true };
        relleno = relleno || { campo: k, deValor: false };
      }
    }
    return relleno;
  };

  // La ruta que encierra la escritura: el primer literal de `router.<verbo>('…', …)`.
  const rutaQueEncierra = (n) => {
    for (let a = n.parent; a; a = a.parent) {
      if (ts.isCallExpression(a) && ts.isPropertyAccessExpression(a.expression)
        && /^(get|post|put|patch|delete|all)$/.test(a.expression.name.text)
        && a.arguments[0] && ts.isStringLiteralLike(a.arguments[0])) {
        return `${a.expression.name.text.toUpperCase()} ${a.arguments[0].text}`;
      }
    }
    return null;
  };

  // SCRUM-1381 · la función con nombre que encierra la escritura (para decir QUIÉN escribe cuando no
  // hay ruta): declaración, método, o `const f = () => …`. null si es del cuerpo del módulo.
  const funcionConNombre = (n) => {
    for (let a = n.parent; a; a = a.parent) {
      if ((ts.isFunctionDeclaration(a) || ts.isMethodDeclaration(a) || ts.isFunctionExpression(a)) && a.name) return a.name.getText(sf);
      if (ts.isVariableDeclaration(a) && ts.isIdentifier(a.name) && a.initializer
        && (ts.isArrowFunction(a.initializer) || ts.isFunctionExpression(a.initializer))) return a.name.text;
    }
    return null;
  };
  // SCRUM-1381 · los campos que el `data` escribe. null = no se pueden leer (no es un literal, o
  // lleva un spread o una clave calculada): ese escritor es OPACO para el recuento, nunca «no toca».
  const camposDelData = (data) => {
    data = data && pelar(data);
    if (!data || !ts.isObjectLiteralExpression(data)) return null;
    const campos = [];
    for (const p of data.properties) {
      if (!(ts.isPropertyAssignment(p) || ts.isShorthandPropertyAssignment(p))) return null;
      const k = nombreProp(p);
      if (k === null) return null;
      campos.push(k);
    }
    return campos;
  };

  const visitar = (n) => {
    const l = llamadaAModelo(n);
    if (l && METODOS.has(l.metodo)) {
      const linea = sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1;
      const ruta = rutaQueEncierra(n);
      const fila = {
        fichero: nombre, linea, modelo: l.modelo, metodo: l.metodo, ruta, clase: 'OPACO', motivo: '', claves: [],
        sitio: `${nombre}::${ruta || funcionConNombre(n) || '(módulo)'}`, campos: null, campoDecidido: null,
      };
      const arg = n.arguments[0] && pelar(n.arguments[0]);
      if (!arg || !ts.isObjectLiteralExpression(arg)) fila.motivo = 'el argumento no es un literal';
      else {
        const w = prop(arg, 'where');
        const d = prop(arg, l.metodo === 'upsert' ? 'update' : 'data');
        fila.campos = d ? camposDelData(valor(d)) : null;
        const claves = w ? clavesDelWhere(valor(w)) : null;
        if (claves === null) fila.motivo = w ? 'el where no es un literal' : 'sin where';
        else if (!d) fila.motivo = 'sin data';
        else {
          fila.claves = claves;
          const ids = modelos.get(l.modelo);
          // Sin la tenencia, UNA clave de identidad localiza el registro; cualquier otra —aunque sea
          // única, como `portalToken: null`— fija un valor que tiene que seguir ahí: es condición.
          const selectoras = claves.filter((k) => k !== 'merchantId');
          const identidad = selectoras.find((k) => ids.has(k));
          const condicion = selectoras.filter((k) => k !== identidad);
          const fn = funcionQueEncierra(n);
          const pos = n.getStart(sf);
          if (condicion.length) { fila.clase = 'CONDICIONADO'; fila.motivo = `where con ${condicion.join(', ')}`; }
          else if (esAtomico(valor(d))) { fila.clase = 'ATÓMICO'; fila.motivo = 'data solo con operadores atómicos'; }
          else if (!ts.isObjectLiteralExpression(valor(d))) { fila.motivo = 'el data no es un literal'; }
          else {
            const lecturas = lecturasAntes(fn, l.modelo, pos);
            const dec = lecturas.length ? decide(fn, lecturas, pos, valor(d)) : null;
            if (dec && dec.deValor) fila.campoDecidido = dec.campo;
            if (dec && dec.deValor) { fila.clase = 'LEE-Y-DECIDE'; fila.motivo = `decide sobre el valor de «${dec.campo}» leído antes y lo escribe; where solo {${claves.join(', ')}}`; }
            else if (dec) { fila.clase = 'LEE-Y-RELLENA'; fila.motivo = `rellena «${dec.campo}» si faltaba al leer; where solo {${claves.join(', ')}}`; }
            else if (lecturas.length) { fila.clase = 'LEE-SIN-DECIDIR'; fila.motivo = `lee ${l.modelo} antes, pero lo que escribe no depende de una decisión sobre lo leído; where solo {${claves.join(', ')}}`; }
            else { fila.clase = 'A-CIEGAS'; fila.motivo = `where solo {${claves.join(', ')}}`; }
          }
        }
      }
      filas.push(fila);
    }
    ts.forEachChild(n, visitar);
  };
  visitar(sf);
  return { filas };
}

/** El control positivo: dos rutas sintéticas que el censo TIENE que distinguir. */
function control(ts, modelos) {
  const modelo = modelos.has('quote') ? 'quote' : [...modelos.keys()][0];
  if (!modelo || modelos.get(modelo).has('status')) return { ok: false, motivo: 'no hay un modelo del esquema donde `status` no sea identidad para montar el control' };
  const ruta = (where) => `
    router.patch('/x/:id', async (req, res) => {
      const q = await prisma.${modelo}.findUnique({ where: { id: Number(req.params.id) } });
      if (!q || q.status !== 'sent') return res.status(409).end();
      await prisma.${modelo}.update({ where: ${where}, data: { status: 'accepted' } });
      return res.json({ ok: true });
    });`;
  // La forma del PATCH billing-plan (SCRUM-1285): la decisión va por una variable DERIVADA de lo leído.
  const plan = `
    router.patch('/x/:id/plan', async (req, res) => {
      const q = await prisma.${modelo}.findFirst({ where: { id: 1 } });
      const val = validar(q.customBillingPlan, req.body.plan);
      if (!val.ok) return res.status(409).end();
      await prisma.${modelo}.update({ where: { id: q.id }, data: { customBillingPlan: req.body.plan } });
    });`;
  // Y la NEGATIVA: lee, pero lo que escribe no depende de ninguna decisión sobre lo leído.
  const derivado = `
    router.post('/x/:id/pdf', async (req, res) => {
      const q = await prisma.${modelo}.findUnique({ where: { id: 1 } });
      if (!q) return res.status(404).end();
      await prisma.${modelo}.update({ where: { id: q.id }, data: { pdfUrl: hacerPdf(q) } });
    });`;
  const casos = [
    ['la ruta sintética CON el defecto de 1276', ruta('{ id: q.id }'), 'LEE-Y-DECIDE'],
    ['la misma con la condición en el where (el arreglo de 1276)', ruta("{ id: q.id, status: { in: ['sent'] } }"), 'CONDICIONADO'],
    ['la forma del plan de cobro de 1285 (decide por una variable derivada)', plan, 'LEE-Y-DECIDE'],
    ['una que lee y escribe un derivado sin decidir sobre él', derivado, 'LEE-SIN-DECIDIR'],
    ['una que solo rellena el campo si faltaba', derivado.replace('if (!q)', 'if (!q || q.pdfUrl)'), 'LEE-Y-RELLENA'],
  ];
  for (const [que, fuente, esperada] of casos) {
    const r = censarFuente(ts, modelos, '__control.ts', fuente);
    const clase = r.filas && r.filas[0] && r.filas[0].clase;
    if (clase !== esperada) return { ok: false, motivo: `${que} salió «${clase}», no ${esperada}` };
  }
  return { ok: true, modelo };
}

// ═════════════════════════════════════════════════════════════════════════════════════════════════
// SCRUM-1381 · ¿CUÁNTOS ESCRITORES TIENE LA FILA? — «el `updatedAt` de una fila no es la versión de
// un trozo de esa fila».
//
// El arreglo de 1285 mete el `updatedAt` de la fila en el `where`. Vale si la fila tiene UN escritor.
// Si otro sitio escribe OTRO campo de la misma fila, Prisma mueve el `updatedAt` igual, y el que
// guardaba su trozo recibe un 409 por un cambio que no le toca. Medido por S2 en producción: las
// notas internas del presupuesto se autoguardan, y «Guardar plan» devolvía 409 por la propia nota.
//
// Para cada CANDIDATA —una escritura LEE-Y-DECIDE (a la que se le querría poner el patrón) o una
// CONDICIONADO cuya condición ya es el `updatedAt` (la que ya lo lleva)— se cuentan los OTROS sitios
// que escriben el mismo modelo, y se parten en tres:
//   coinciden .. tocan alguno de los campos protegidos: un cambio suyo SÍ debe invalidar la versión.
//   ajenos ..... sus campos se leen y NO tocan ninguno protegido: mueven el `updatedAt` sin motivo.
//   opacos ..... su `data` no se puede leer. No se cuentan como ajenos ni como inocuos.
// Veredicto, de TRES valores (más el que no aplica), nunca dos:
//   VALE ............ ningún ajeno y ningún opaco.
//   NO-VALE ......... al menos un ajeno: el falso 409 es posible.
//   NO-SE ........... ningún ajeno a la vista, pero hay opacos (o no se sabe qué protege).
//   SIN-UPDATEDAT ... el modelo no tiene campo `@updatedAt`: el patrón ni siquiera se puede copiar.
//
// LO QUE NO VE: «un sitio» es fichero + ruta (o función). Un escritor que vive en un servicio llamado
// desde la MISMA ruta cuenta como otro sitio. Y escribir el mismo modelo no es escribir la misma
// FILA: dos sitios que nunca coinciden sobre un registro salen igual. Sobrecuenta, no infracuenta.
// ═════════════════════════════════════════════════════════════════════════════════════════════════
export const VEREDICTOS = ['VALE', 'NO-VALE', 'NO-SE', 'SIN-UPDATEDAT'];

/** Modelos del esquema → nombre de su campo `@updatedAt` (los que no lo tienen, no están). */
export function camposUpdatedAt(textoEsquema) {
  const out = new Map();
  const re = /^model\s+(\w+)\s*\{([\s\S]*?)^\}/gm;
  let m;
  while ((m = re.exec(textoEsquema))) {
    for (const linea of m[2].split('\n')) {
      const t = linea.trim();
      if (!t || t.startsWith('//')) continue;
      const campo = t.match(/^(\w+)\s+\S+.*?@updatedAt\b/);
      if (campo) out.set(m[1].charAt(0).toLowerCase() + m[1].slice(1), campo[1]);
    }
  }
  return out;
}

/** Una fila por candidata, con sus escritores partidos en tres y su veredicto. */
export function escritoresPorFila(filas, updatedAtPorModelo) {
  const out = [];
  for (const f of filas) {
    const campoVersion = updatedAtPorModelo.get(f.modelo) || null;
    const yaLaLleva = f.clase === 'CONDICIONADO' && campoVersion !== null && f.claves.includes(campoVersion);
    if (f.clase !== 'LEE-Y-DECIDE' && !yaLaLleva) continue;
    const protegidos = yaLaLleva ? f.campos : [f.campoDecidido];
    const otros = filas.filter((o) => o.modelo === f.modelo && o.sitio !== f.sitio);
    const sitios = (lista) => [...new Set(lista.map((o) => o.sitio))].sort();
    const opacos = otros.filter((o) => o.campos === null);
    const legibles = otros.filter((o) => o.campos !== null);
    const toca = (o) => protegidos !== null && o.campos.some((c) => protegidos.includes(c));
    const ajenos = protegidos === null ? [] : legibles.filter((o) => !toca(o));
    const coinciden = protegidos === null ? [] : legibles.filter(toca);
    let veredicto;
    if (campoVersion === null) veredicto = 'SIN-UPDATEDAT';
    else if (ajenos.length) veredicto = 'NO-VALE';
    else if (opacos.length || protegidos === null) veredicto = 'NO-SE';
    else veredicto = 'VALE';
    // SCRUM-1381b: la clase es de la LÍNEA, no del sitio. Un sitio con una línea ajena y otra opaca
    // cuenta en las dos clases, así que los sitios por clase pueden sumar más que `otros`; las
    // líneas no: cada una está en una clase y sólo en una, y eso es lo que tiene que cuadrar.
    const sinClasificar = protegidos === null ? legibles : [];
    const porSitio = (lista) => Object.fromEntries(sitios(lista).map((s) => [s, lista.filter((o) => o.sitio === s).map((o) => o.linea).sort((a, b) => a - b)]));
    const clasesDe = new Map();
    for (const [clase, lista] of [['suyo', coinciden], ['ajeno', ajenos], ['opaco', opacos], ['sin clasificar', sinClasificar]]) {
      for (const s of sitios(lista)) clasesDe.set(s, [...(clasesDe.get(s) ?? []), clase]);
    }
    out.push({
      sitio: f.sitio, fichero: f.fichero, linea: f.linea, modelo: f.modelo, ruta: f.ruta, clase: f.clase,
      yaLaLleva, protegidos, veredicto,
      otros: sitios(otros).length, coinciden: sitios(coinciden), ajenos: sitios(ajenos), opacos: sitios(opacos),
      // La UNIDAD, dicha: un SITIO es fichero + ruta (o función); una LÍNEA es una llamada a prisma.
      // Un sitio puede tener varias líneas: los dos recuentos no coinciden y los dos son ciertos.
      lineasOtras: otros.length, lineasAjenas: ajenos.length,
      lineasSuyas: coinciden.length, lineasOpacas: opacos.length, lineasSinClasificar: sinClasificar.length,
      lineasPorClase: { suyo: porSitio(coinciden), ajeno: porSitio(ajenos), opaco: porSitio(opacos), 'sin clasificar': porSitio(sinClasificar) },
      mixtos: [...clasesDe].filter(([, c]) => c.length > 1).map(([s, c]) => `${s} (${c.join(' + ')})`).sort(),
      lineasDe: Object.fromEntries(sitios(otros).map((s) => [s, otros.filter((o) => o.sitio === s).map((o) => o.linea).sort((a, b) => a - b)])),
    });
  }
  return out;
}

/** El control positivo del recuento de escritores: tres árboles sintéticos, tres veredictos. */
function controlEscritores(ts, modelos, updatedAtPorModelo) {
  const modelo = [...updatedAtPorModelo.keys()].find((m) => modelos.has(m));
  if (!modelo) return { ok: false, motivo: 'ningún modelo del esquema tiene `@updatedAt` para montar el control de escritores' };
  const v = updatedAtPorModelo.get(modelo);
  const plan = `router.patch('/c/:id/plan', async (req, res) => {
      await prisma.${modelo}.update({ where: { id: 1, ${v}: req.body.version }, data: { campoPlan: req.body.plan } });
    });`;
  const notas = `router.patch('/c/:id/notas', async (req, res) => {
      await prisma.${modelo}.update({ where: { id: 1 }, data: { campoNotas: req.body.notas } });
    });`;
  const mismoCampo = `router.post('/c/:id/reset', async (req, res) => {
      await prisma.${modelo}.update({ where: { id: 1 }, data: { campoPlan: null } });
    });`;
  const opaco = `router.patch('/c/:id', async (req, res) => {
      await prisma.${modelo}.update({ where: { id: 1 }, data: cambios });
    });`;
  const casos = [
    ['el plan condicionado por la versión de la fila, con las notas escribiendo al lado', [plan, notas], 'NO-VALE'],
    ['el mismo plan, solo en la fila', [plan], 'VALE'],
    ['el mismo plan, con otro escritor que toca SU campo', [plan, mismoCampo], 'VALE'],
    ['el mismo plan, con un escritor que no se puede leer', [plan, opaco], 'NO-SE'],
  ];
  for (const [que, fuentes, esperado] of casos) {
    const r = censarFuente(ts, modelos, '__control-escritores.routes.ts', fuentes.join('\n'));
    const cand = r.filas ? escritoresPorFila(r.filas, updatedAtPorModelo).filter((c) => c.ruta === 'PATCH /c/:id/plan') : [];
    if (cand.length !== 1 || cand[0].veredicto !== esperado) {
      return { ok: false, motivo: `escritores · ${que}: salió «${cand.map((c) => c.veredicto).join(', ') || 'sin candidata'}», no ${esperado}` };
    }
  }
  return { ok: true, modelo };
}

// Anclas en el ÁRBOL REAL, las dos que ya conocemos. La que se arregló esta mañana (1276) NO puede
// salir LEE-Y-DECIDE; si saliera, el censo no distingue arreglado de roto. La del plan de cobro
// (1285) tiene que estar: LEE-Y-DECIDE mientras siga rota, CONDICIONADO cuando S1 la arregle.
// Cualquier otra cosa —que no aparezca, que salga OPACO— es no saber medir.
export const ANCLAS = [
  { fichero: 'src/modules/quotes/app/routes/quotes.routes.ts', ruta: 'POST /:token/decision', arreglada: true },
  { fichero: 'src/modules/system/app/routes/quotesAdmin.routes.ts', ruta: 'PATCH /:id/billing-plan', arreglada: false },
];
function comprobarAnclas(filas) {
  const informe = [];
  for (const a of ANCLAS) {
    const suyas = filas.filter((f) => f.fichero === a.fichero && f.ruta === a.ruta);
    if (!suyas.length) return { ok: false, motivo: `el ancla «${a.ruta}» (${a.fichero}) no tiene ninguna escritura censada` };
    if (a.arreglada) {
      const mal = suyas.filter((f) => f.clase === 'LEE-Y-DECIDE');
      if (mal.length) return { ok: false, motivo: `la ruta ARREGLADA «${a.ruta}» sale LEE-Y-DECIDE en :${mal.map((f) => f.linea).join(', :')}: el censo no distingue arreglado de roto` };
      if (!suyas.some((f) => f.clase === 'CONDICIONADO')) return { ok: false, motivo: `la ruta ARREGLADA «${a.ruta}» no tiene su escritura CONDICIONADO` };
    } else if (!suyas.some((f) => f.clase === 'LEE-Y-DECIDE' || f.clase === 'CONDICIONADO')) {
      return { ok: false, motivo: `la ruta conocida «${a.ruta}» no sale ni LEE-Y-DECIDE ni CONDICIONADO (${suyas.map((f) => f.clase).join(', ')})` };
    }
    informe.push(`${a.ruta} → ${suyas.map((f) => `:${f.linea} ${f.clase}`).join(', ')}`);
  }
  return { ok: true, informe };
}

/** Censa solo unas piezas sueltas contra el esquema del árbol (para casos fabricados, sin pagar el árbol entero). */
export function censarPiezas(piezas, raiz = RAIZ_REPO) {
  const modelos = identidadesDelEsquema(fs.readFileSync(path.join(raiz, 'prisma/schema.prisma'), 'utf8'));
  const ts = cargarTs(raiz);
  return piezas.flatMap((p) => {
    const r = censarFuente(ts, modelos, p.nombre, p.texto);
    if (r.error) throw new Error(r.error);
    return r.filas.map((f) => ({ ...f, enRuta: /(^|\/)routes\/|\.routes\.ts$/.test(f.fichero) }));
  });
}

export function medir({ raiz = RAIZ_REPO, piezasExtra = [] } = {}) {
  const esquema = path.join(raiz, 'prisma/schema.prisma');
  if (!fs.existsSync(esquema)) return { noMedido: `no existe ${path.relative(raiz, esquema)}` };
  const modelos = identidadesDelEsquema(fs.readFileSync(esquema, 'utf8'));
  if (!modelos.size) return { noMedido: 'el esquema no trae ningún modelo legible' };
  const ts = cargarTs(raiz);
  const ctl = control(ts, modelos);
  if (!ctl.ok) return { noMedido: `CONTROL POSITIVO FALLIDO: ${ctl.motivo}` };
  const updatedAtPorModelo = camposUpdatedAt(fs.readFileSync(esquema, 'utf8'));
  const ctlEscritores = controlEscritores(ts, modelos, updatedAtPorModelo);
  if (!ctlEscritores.ok) return { noMedido: `CONTROL POSITIVO FALLIDO: ${ctlEscritores.motivo}` };

  const filas = [];
  const ficheros = ficherosTs(path.join(raiz, 'src'));
  if (!ficheros.length) return { noMedido: 'cero ficheros .ts bajo src/' };
  const piezas = [
    ...ficheros.map((f) => ({ nombre: path.relative(raiz, f).replace(/\\/g, '/'), texto: fs.readFileSync(f, 'utf8') })),
    ...piezasExtra,
  ];
  for (const p of piezas) {
    const r = censarFuente(ts, modelos, p.nombre, p.texto);
    if (r.error) return { noMedido: r.error };
    for (const f of r.filas) {
      f.enRuta = /(^|\/)routes\/|\.routes\.ts$/.test(f.fichero);
      filas.push(f);
    }
  }
  if (!filas.length) return { noMedido: 'cero escrituras update/updateMany/upsert en src/: el censo no encontró su población' };
  const anclas = comprobarAnclas(filas);
  if (!anclas.ok) return { noMedido: `ANCLA EN EL ÁRBOL REAL: ${anclas.motivo}` };
  const cuenta = Object.fromEntries(CLASES.map((c) => [c, filas.filter((f) => f.clase === c).length]));
  const escritores = escritoresPorFila(filas, updatedAtPorModelo);
  const cuentaEscritores = Object.fromEntries(VEREDICTOS.map((v) => [v, escritores.filter((e) => e.veredicto === v).length]));
  return {
    filas, cuenta, ficheros: ficheros.length, modelos: modelos.size, control: ctl.modelo, anclas: anclas.informe,
    escritores, cuentaEscritores, modelosConUpdatedAt: updatedAtPorModelo.size,
  };
}

/** Las que YA condicionan por el `updatedAt` de la fila y no pueden fiarse de él. Es lo que el trinquete vigila. */
export function versionDeFilaDudosa(escritores) {
  return escritores.filter((e) => e.yaLaLleva && e.veredicto !== 'VALE');
}

const esPrincipal = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (esPrincipal) {
  const r = medir();
  if (r.noMedido) {
    console.error(`🔴 NO MEDIDO — ${r.noMedido}. Esto NO es «no hay escrituras sin versión».`);
    process.exit(SALIDA_NO_MEDIDO);
  }
  if (process.argv.includes('--json')) {
    console.log(JSON.stringify(r, null, 2));
    process.exit(0);
  }
  console.log(`Escrituras sin versión (SCRUM-1285) · población: ${r.filas.length} escrituras en ${r.ficheros} ficheros de src/ · ${r.modelos} modelos · control positivo cazado (modelo ${r.control})`);
  console.log(CLASES.map((c) => `${c} ${r.cuenta[c]}`).join(' · '));
  console.log(`anclas: ${r.anclas.join(' · ')}`);
  if (process.argv.includes('--escritores')) {
    console.log(`\nEscritores por fila (SCRUM-1381) · población: ${r.escritores.length} candidatas `
      + `(${r.escritores.filter((e) => e.yaLaLleva).length} ya condicionan por el updatedAt de la fila, `
      + `${r.escritores.filter((e) => !e.yaLaLleva).length} LEE-Y-DECIDE) · ${r.modelosConUpdatedAt} de ${r.modelos} modelos tienen @updatedAt`);
    console.log(VEREDICTOS.map((v) => `${v} ${r.cuentaEscritores[v]}`).join(' · '));
    console.log('unidad: un SITIO es fichero + ruta o función; una LÍNEA es una llamada a prisma. Un sitio puede tener varias líneas.');
    for (const v of VEREDICTOS) {
      const suyas = r.escritores.filter((e) => e.veredicto === v);
      if (!suyas.length) continue;
      console.log(`\n── ${v} (${suyas.length}) ──`);
      for (const e of suyas) {
        console.log(`  ${e.yaLaLleva ? 'YA LA LLEVA' : 'candidata  '} ${e.fichero}:${e.linea} · ${e.modelo}${e.ruta ? ` · ${e.ruta}` : ''} · protege {${(e.protegidos || ['?']).join(', ')}} · `
          + `otros escritores: ${e.otros} sitios en ${e.lineasOtras} líneas → ${e.coinciden.length} sitios tocan lo suyo (${e.lineasSuyas} líneas), `
          + `${e.ajenos.length} sitios ajenos (${e.lineasAjenas} líneas), ${e.opacos.length} sitios opacos (${e.lineasOpacas} líneas)`
          + (e.lineasSinClasificar ? `, ${e.lineasSinClasificar} líneas sin clasificar (no se sabe qué protege)` : '')
          + (e.mixtos.length ? ` · ${e.mixtos.length} sitios cuentan en más de una clase` : ''));
        if (process.argv.includes('--todo')) {
          // Cada clase lista SUS líneas, no todas las del sitio: la lista tiene que sumar lo que dice el resumen.
          for (const [clase, porSitio] of Object.entries(e.lineasPorClase)) {
            for (const [s, lineas] of Object.entries(porSitio)) console.log(`        ${clase}: ${s} (:${lineas.join(', :')})`);
          }
          for (const m of e.mixtos) console.log(`        en más de una clase: ${m}`);
        }
      }
    }
    process.exit(0);
  }
  const verTodo = process.argv.includes('--todo');
  for (const c of verTodo ? CLASES : ['LEE-Y-DECIDE', 'OPACO']) {
    const fs_ = r.filas.filter((f) => f.clase === c);
    if (!fs_.length) continue;
    console.log(`\n── ${c} (${fs_.length}) ──`);
    for (const f of fs_) console.log(`  ${f.enRuta ? 'ruta    ' : 'servicio'} ${f.fichero}:${f.linea} · ${f.modelo}.${f.metodo}${f.ruta ? ` · ${f.ruta}` : ''} · ${f.motivo}`);
  }
  if (!verTodo) console.log('\n(el resto de clases, con --todo)');
  process.exit(0);
}
