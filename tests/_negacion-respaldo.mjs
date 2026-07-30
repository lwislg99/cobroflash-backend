// tests/_negacion-respaldo.mjs — SCRUM-237
//
// Analizador AST: para cada NEGACIÓN de un test (una aserción de que un token NO aparece),
// decide si tiene RESPALDO — o sea, si comprueba algo de verdad o es verde permanente.
//
// POR QUÉ EXISTE: scrum73 tenía un `assert.doesNotMatch(bodyOff, /RegistroFacturacionAltaType/)`
// que llevaba quién sabe cuánto saliendo VERDE sin comprobar nada, porque ese token es el nombre
// del TIPO del XSD y NO aparece JAMÁS en el XML (el ELEMENTO es `RegistroAlta`). Una negación
// sobre un token imposible pasa siempre. Este guard es preventivo: caza esa clase antes de que
// vuelva. El bug de scrum73 fue ÚNICO (14 negaciones de salida revisadas a mano, 0 de su clase);
// esto es la red para que siga siendo cero.
//
// LAS TRES FORMAS DE RESPALDO VÁLIDAS (aprobadas por el fundador), en orden de fuerza:
//   1 · HERMANO DEL TOKEN (FUERTE) — un positivo (`assert.match`/`ok(includes)`) del MISMO token
//       en el MISMO fichero. Prueba que el token es REAL (aparece cuando debe). Es lo ÚNICO que
//       mata scrum73: si el token apareciera en un positivo, no sería imposible.
//   2 · SUJETO VERIFICADO (MEDIO) — un positivo de CONTENIDO sobre el MISMO sujeto (mismo texto).
//       Ni status ni truthy: `assert.match(subj,…)`, `ok(subj.includes(…))` o `equal(subj,"lit")`.
//       Prueba que el sujeto es real y con contenido comprobado, pero **NO prueba que el token sea
//       real** — el propio scrum73 tenía el sujeto (bodyOff) verificable y el token equivocado. Por
//       eso backing-2 es MEDIO, no FUERTE, y por eso no basta para descartar la clase de scrum73.
//   3 · MUTATION-TEST / ESTRUCTURAL (ESTRUCTURAL) — el sujeto es FUENTE leída (`leerFuente`,
//       `readFileSync`, `codigo(...)`, `sinComentarios(...)`), directa o TRANSITIVA (una var que se
//       deriva de otra fuente, p.ej. `const bloque = css.slice(...)`). Su respaldo es la mutation-
//       test que demuestra que el guard cae. **Este analizador NO puede verificar que esa mutation-
//       test se corrió en rojo** (vive en el proceso/commit, no en el árbol): lo DECLARA, no lo finge.
//
// CRITERIO DURO DEL FUNDADOR: ante la duda, FALLAR EN MENOS CASOS y DECLARARLO, no en muchos y que
// la gente lo silencie con excepciones. Un guard que se silencia de rutina es peor que no tenerlo.
// Por eso NINGUNO (rojo duro) solo se dispara con un token CONCRETO (una cadena literal específica,
// tipo `RegistroFacturacionAltaType`) que NO aparece en NINGÚN positivo de la suite (ni su fichero
// ni ningún otro), SIN sujeto verificado y que NO sea fuente. Eso es exactamente scrum73: un token
// que no existe en ningún sitio. Todo lo ambiguo —token dinámico, char-class, o token cuyo hermano
// vive en OTRO fichero— cae en DÉBIL: se ACEPTA y se DECLARA.
import ts from 'typescript';
import fs from 'node:fs';

const norm = (s) => s.replace(/\s+/g, ' ').trim();

// Nombres que, en el sujeto o en la inicialización de su variable, significan "esto es FUENTE leída".
const LECTORES_FUENTE = ['leerFuente', 'readFileSync', 'sinComentarios', 'codigo'];

// ── Token: forma canónica de lo que la negación busca ────────────────────────────────
function tokenDeArg(arg, sf) {
  if (!arg) return null;
  if (ts.isRegularExpressionLiteral(arg)) {
    const m = arg.text.match(/^\/([\s\S]*)\/[a-z]*$/);
    return { tipo: 'regex', texto: m ? m[1] : arg.text };
  }
  if (ts.isStringLiteral(arg) || ts.isNoSubstitutionTemplateLiteral(arg)) {
    return { tipo: 'string', texto: arg.text };
  }
  if (ts.isNewExpression(arg) && arg.expression.getText(sf) === 'RegExp') {
    const a0 = arg.arguments && arg.arguments[0];
    if (a0 && ts.isStringLiteral(a0)) return { tipo: 'regex', texto: a0.text };
    return { tipo: 'dinamico', texto: norm(arg.getText(sf)) };
  }
  return { tipo: 'dinamico', texto: norm(arg.getText(sf)) };
}

// Ramas de un token de texto: parte la alternación de nivel superior por `|` y quita anclas.
function ramasDeToken(texto) {
  const sinGrupos = !/[()]/.test(texto);
  const ramas = sinGrupos ? texto.split('|') : [texto];
  return ramas.map((r) => r.replace(/^\^/, '').replace(/\$$/, '').replace(/^\\b|\\b$/g, '').trim()).filter(Boolean);
}

const desescapar = (s) => s.replace(/\\\//g, '/');
// ¿El positivo `pTexto` contiene la rama `r` (comparación literal, tras des-escapar `\/`)?
const contieneRama = (pTexto, r) => desescapar(pTexto).includes(desescapar(r));

// ¿Un token de texto es "CONCRETO" (elegible para NINGUNO)? Una cadena específica, no una char-class
// ni un patrón corto/regex-y. `RegistroFacturacionAltaType` sí; `['@ ]` no; `\d+` no.
function esTokenConcreto(tk) {
  if (!tk || tk.tipo === 'dinamico') return false;
  const t = tk.texto;
  if (t.length < 6) return false;
  if (/[[\]{}()+*?^$\\]/.test(t)) return false;
  return true;
}

// ── Recolección: negaciones y positivos de un fichero ────────────────────────────────
export function analizarFuente(texto, nombre = 'x.mjs') {
  let sf;
  try {
    sf = ts.createSourceFile(nombre, texto, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  } catch (e) {
    return { negaciones: [], positivos: [], varsFuente: new Set(), parseError: e?.message || String(e) };
  }
  const negaciones = [];
  const positivos = [];
  const varInit = new Map(); // nombre de variable → texto de su initializer

  const linea = (node) => sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1;
  const nombreLlamada = (node) => {
    const e = node.expression;
    if (ts.isPropertyAccessExpression(e)) return norm(e.expression.getText(sf)) + '.' + e.name.text;
    if (ts.isIdentifier(e)) return e.text;
    return null;
  };
  const busquedaDeToken = (node) => {
    if (!ts.isCallExpression(node) || !ts.isPropertyAccessExpression(node.expression)) return null;
    const metodo = node.expression.name.text;
    const obj = node.expression.expression;
    const a0 = node.arguments && node.arguments[0];
    if ((metodo === 'includes' || metodo === 'match') && a0) return { subject: norm(obj.getText(sf)), token: tokenDeArg(a0, sf) };
    if (metodo === 'test' && a0) return { subject: norm(a0.getText(sf)), token: tokenDeArg(obj, sf) };
    return null;
  };

  const visit = (node) => {
    if (ts.isVariableDeclaration(node) && node.initializer && ts.isIdentifier(node.name)) {
      varInit.set(node.name.text, norm(node.initializer.getText(sf)));
    }
    if (ts.isCallExpression(node)) {
      const nom = nombreLlamada(node);
      const args = node.arguments;
      // NEGATIVOS
      if (nom === 'assert.doesNotMatch' && args[0] && args[1]) {
        negaciones.push({ linea: linea(node), subject: norm(args[0].getText(sf)), token: tokenDeArg(args[1], sf) });
      } else if ((nom === 'assert.ok' || nom === 'assert') && args[0] && ts.isPrefixUnaryExpression(args[0])
                 && args[0].operator === ts.SyntaxKind.ExclamationToken) {
        const b = busquedaDeToken(args[0].operand);
        if (b) negaciones.push({ linea: linea(node), subject: b.subject, token: b.token });
      }
      // POSITIVOS (de CONTENIDO)
      if (nom === 'assert.match' && args[0] && args[1]) {
        positivos.push({ subject: norm(args[0].getText(sf)), token: tokenDeArg(args[1], sf) });
      } else if ((nom === 'assert.equal' || nom === 'assert.strictEqual') && args[0] && args[1]
                 && (ts.isStringLiteral(args[1]) || ts.isNoSubstitutionTemplateLiteral(args[1]))) {
        positivos.push({ subject: norm(args[0].getText(sf)), token: { tipo: 'string', texto: args[1].text } });
      } else if ((nom === 'assert.ok' || nom === 'assert') && args[0] && !ts.isPrefixUnaryExpression(args[0])) {
        const b = busquedaDeToken(args[0]);
        if (b) positivos.push({ subject: b.subject, token: b.token });
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);

  // FUENTE TRANSITIVA (punto fijo): una var es fuente si su init llama a un lector, o si REFERENCIA
  // (por nombre) a otra var que ya es fuente — p.ej. `const bloque = css.slice(...)` con `css` fuente.
  const varsFuente = new Set();
  const refiere = (init, v) => new RegExp('\\b' + v.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b').test(init);
  for (const [nombre, init] of varInit) if (LECTORES_FUENTE.some((l) => init.includes(l + '('))) varsFuente.add(nombre);
  let cambio = true;
  while (cambio) {
    cambio = false;
    for (const [nombre, init] of varInit) {
      if (varsFuente.has(nombre)) continue;
      if ([...varsFuente].some((v) => refiere(init, v))) { varsFuente.add(nombre); cambio = true; }
    }
  }
  return { negaciones, positivos, varsFuente, parseError: null };
}

// ¿El sujeto de una negación es FUENTE? (llamada directa a un lector, var-fuente, o referencia a una)
function sujetoEsFuente(subject, varsFuente) {
  if (LECTORES_FUENTE.some((l) => subject.includes(l + '('))) return true;
  if (varsFuente.has(subject)) return true;
  return [...varsFuente].some((v) => new RegExp('\\b' + v.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b').test(subject));
}

// ── Clasificación de UNA negación ────────────────────────────────────────────────────
// `tokensGlobal` = todos los tokens de positivos de TODA la suite (para el respaldo cross-file).
export function clasificar(neg, positivos, varsFuente, tokensGlobal = []) {
  const t = neg.token;
  // backing-1 · HERMANO DEL TOKEN en el MISMO fichero (FUERTE)
  if (t && t.tipo !== 'dinamico') {
    const ramas = ramasDeToken(t.texto);
    if (ramas.length) {
      const tienePos = (r) => positivos.some((p) => p.token && p.token.tipo !== 'dinamico' && contieneRama(p.token.texto, r));
      if (ramas.every(tienePos)) return { nivel: 'FUERTE', motivo: 'hermano del token (positivo del mismo token en el fichero)' };
    }
  }
  // backing-2 · SUJETO VERIFICADO por contenido, mismo fichero (MEDIO)
  if (positivos.some((p) => p.subject === neg.subject)) {
    return { nivel: 'MEDIO', motivo: 'sujeto verificado por contenido en el fichero (NO prueba que el token sea real — backing-2 no mata scrum73)' };
  }
  // backing-3 · ESTRUCTURAL: el sujeto es FUENTE leída (mutation-test declarada, no verificada)
  if (sujetoEsFuente(neg.subject, varsFuente)) {
    return { nivel: 'ESTRUCTURAL', motivo: 'sujeto = fuente leída; respaldo = mutation-test (este guard NO la verifica, la DECLARA)' };
  }
  // Ambiguos → DÉBIL (aceptar + declarar), nunca marcar en falso (criterio fallar-menos):
  if (t && t.tipo === 'dinamico') return { nivel: 'DEBIL', motivo: 'token dinámico (new RegExp(var)) sin sujeto verificado: no comprobable estáticamente' };
  if (t && !esTokenConcreto(t)) return { nivel: 'DEBIL', motivo: 'token no concreto (char-class/regex) sin respaldo: guard de patrón prohibido, aceptado y declarado' };
  // Sujeto en MAYÚSCULAS = constante/estructura de datos (una lista, un mapa), no salida generada.
  // `!ORDEN_BORRADO_MERCHANT.includes('botSession')` es un invariante de MEMBRESÍA, no una búsqueda de
  // token en un XML/respuesta — no es la clase de scrum73 (donde el riesgo es un token nunca emitido).
  // ⚠️ HEURÍSTICA SINTÁCTICA, NO GARANTÍA: reconoce la constante por el NOMBRE (MAYÚSCULAS), no por lo
  // que ES. Acierta hoy; una variable mal nombrada en MAYÚSCULAS la engañaría. Es una aproximación
  // DELIBERADA del lado de fallar-menos, no una verdad — misma disciplina que el límite del guard de 227.
  if (/^[A-Z][A-Z0-9_]+$/.test(neg.subject)) return { nivel: 'DEBIL', motivo: 'sujeto = constante/estructura de datos (heurística SINTÁCTICA por MAYÚSCULAS, no garantía): guard de membresía, no salida generada' };
  // ¿El token aparece en un positivo de OTRO fichero? Entonces es REAL (no imposible como scrum73):
  // hermano cross-file → DÉBIL, no NINGUNO. La diferencia con scrum73 es que aquél no existía en NINGÚN sitio.
  if (t && tokensGlobal.some((pt) => contieneRama(pt, t.texto))) {
    return { nivel: 'DEBIL', motivo: 'hermano del token en OTRO fichero (respaldo cross-file, débil): el token es real, no imposible' };
  }
  // NINGUNO (rojo duro): token concreto que no aparece en NINGÚN positivo, sujeto sin verificar, no fuente = scrum73
  return { nivel: 'NINGUNO', motivo: `token concreto "${t ? t.texto : '?'}" que NO aparece en ningún positivo de la suite, sujeto SIN verificar, no es fuente — patrón scrum73 (verde permanente)` };
}

// ── Corpus completo (dos pasadas: primero los positivos globales, luego clasificar) ──
export function analizarCorpus(rutas) {
  const items = [];
  const parseErrors = [];
  let totalNeg = 0, totalPos = 0;
  const stats = { FUERTE: 0, MEDIO: 0, ESTRUCTURAL: 0, DEBIL: 0, NINGUNO: 0 };
  const porFichero = [];
  const tokensGlobal = [];
  for (const ruta of rutas) {
    const r = analizarFuente(fs.readFileSync(ruta, 'utf8'), ruta);
    if (r.parseError) { parseErrors.push({ ruta, parseError: r.parseError }); continue; }
    porFichero.push({ ruta, ...r });
    totalPos += r.positivos.length;
    for (const p of r.positivos) if (p.token && p.token.tipo !== 'dinamico') tokensGlobal.push(p.token.texto);
  }
  for (const { ruta, negaciones, positivos, varsFuente } of porFichero) {
    for (const neg of negaciones) {
      totalNeg++;
      const { nivel, motivo } = clasificar(neg, positivos, varsFuente, tokensGlobal);
      stats[nivel]++;
      items.push({ ruta, linea: neg.linea, nivel, motivo, token: neg.token ? neg.token.texto : '?' });
    }
  }
  return { items, stats, parseErrors, totalNeg, totalPos };
}
