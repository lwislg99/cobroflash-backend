// scripts/_censo-convenio-microcopy.mjs — SCRUM-1157
//
// ═════════════════════════════════════════════════════════════════════════════════════════════
// 🔴 ¿QUÉ TEXTO DEL PANEL ESTÁ SIN FIRMAR, AUNQUE NADIE LO HAYA MARCADO EN PANTALLA?
//
// El guard de marcadores (SCRUM-722) busca `[PENDIENTE microcopy oficial]` en lo que se PINTA.
// El caso que lo destapó, `settingsView.js` → `QR_COPY`: seis textos («Formato», «Negro»…) que su
// propio comentario da por «aún sin aprobar», pero el marcador vive en el COMENTARIO del fuente y
// no en el valor, así que en pantalla sale una palabra normal y ningún guard la acusa. El sistema
// medía la diligencia de quien escribió el texto, no el estado del texto.
//
// La casa ya tiene la convención: en un objeto-registro de copy, cada literal va BAJO un comentario
// `APROBADO(S)/APROBADA(S)` (con quién y cuándo) o bajo `[PENDIENTE microcopy oficial]`. Este censo
// la lee por AST (no por texto: un `grep` no sabe a qué propiedad gobierna un comentario) y
// clasifica cada HOJA de texto de cada objeto que la usa:
//
//   APROBADO        su comentario gobernante dice APROBAD… y no PENDIENTE
//   PENDIENTE       su comentario gobernante dice PENDIENTE microcopy oficial   → ACUSADO
//   SIN_COMENTARIO  vive en un objeto que usa la convención, pero ningún
//                   comentario la gobierna — el agujero que era invisible       → ACUSADO
//
// ── QUÉ GOBIERNA A UNA PROPIEDAD (la regla, entera) ─────────────────────────────────────────────
//   Firma = `APROBAD[OA]S?` en MAYÚSCULAS, o `FIRMAD[OA]S?` en mayúsculas SI dice quién/dónde en
//   los 60 caracteres siguientes (fundador, asesor, orquestador, delegación, comentario, SCRUM-N):
//   «un albarán FIRMADO» es un estado, no una firma. Negada («SIN FIRMAR», «NO APROBADO») → AMBIGUO.
//   1. Un comentario de convención en SU MISMA LÍNEA, detrás (`k: 'x', // APROBADO`): sólo a ella.
//   2. Si no, un comentario de convención ENCIMA de ella dentro del mismo objeto:
//      · PENDIENTE gobierna al grupo que sigue hasta el siguiente comentario de convención (así se
//        lee `QR_COPY`). Acusar de más es la dirección segura.
//      · APROBADO en SINGULAR firma sólo esa clave. En PLURAL gobierna al grupo que sigue, y si
//        CUENTA («los dos literales están FIRMADOS») gobierna a esos N y ni uno más.
//   3. Si no, la CABECERA del objeto: el comentario de la sentencia que lo declara
//      (`// … APROBADOS …` encima de `const X = {`), con la misma cuenta si la dice; si está
//      anidado, lo que gobierna a la propiedad que lo contiene.
//   4. Si no, SIN_COMENTARIO.
//   Todas las dudas de lectura caen hacia ACUSAR: un falso SIN_COMENTARIO cuesta una línea en el
//   JSON de declarados; un falso APROBADO es el agujero que este ticket viene a cerrar.
//   Un objeto ENTRA en el censo si su cabecera o alguno de sus comentarios internos es de
//   convención, o si cuelga de uno que entra. Los comentarios de convención que NO caen dentro de
//   ningún objeto (texto suelto, `textContent = '…' // APROBADO`) quedan FUERA DE ALCANCE y se
//   CUENTAN en la población: este censo no afirma nada de ellos (SCRUM-1157, «lo que no resuelve»).
//
// ── FAIL-CLOSED (la familia de «no pude mirar» = «no hay nada», 26-sep) ─────────────────────────
//   Lo que la sonda no sabe clasificar sale como CIEGO, y un censo con un solo CIEGO NO devuelve
//   hojas: devuelve `estado: 'CIEGO'` y sus motivos. Nunca un resultado parcial. CIEGO es:
//     · un fichero que no se puede leer o que no parsea limpio (diagnósticos de sintaxis);
//     · un comentario que dice a la vez APROBAD… y PENDIENTE (prosa del tipo «ya no lleva el
//       marcador…») y NO está resuelto por identidad en `AMBIGUOS` del JSON de declarados;
//     · un `...spread` dentro de un objeto del censo (trae hojas que el AST de aquí no ve);
//     · dos hojas con la MISMA identidad y distinta clase (la identidad no las separa);
//     · una entrada de `AMBIGUOS` que ya no casa con nada (resolución caducada: se retira).
//   La población se declara SIEMPRE (ficheros, comentarios de convención dentro/fuera, objetos,
//   hojas): un cero sin «sobre cuántos» no es un verde (A3).
//
// ── IDENTIDAD, nunca la línea (SCRUM-710b) ──────────────────────────────────────────────────────
//   `<fichero> · <ruta>` con ruta = nombre de la variable (o `función()` que lo envuelve si el
//   objeto no tiene nombre) + claves (`QR_COPY.formato`; un objeto dentro de un array suma `[]`).
//   Dos hojas iguales con la misma clase se cuentan juntas (`n`).
//
// ⛔ NO EJECUTA NADA DEL PRODUCTO. Sólo el parser de `typescript` (ya en el árbol) sobre el fuente.
//    No hace falta `ts.Program` ni `TypeChecker`: aquí no se pregunta por TIPOS sino por qué
//    comentario gobierna a qué propiedad, y eso lo da el árbol sintáctico con sus rangos.
// ═════════════════════════════════════════════════════════════════════════════════════════════
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require_ = createRequire(import.meta.url);
const ts = require_('typescript');

export const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
/** Dónde se censa: todo el JavaScript que sirve `public/` (el panel y lo público). */
export const CARPETA = 'public';
export const DECLARADOS_JSON = 'scripts/_censo-convenio-microcopy-declarados.json';

// El convenio se escribe en MAYÚSCULAS a propósito: «está aprobado» en prosa no es una firma, y
// un texto que sólo lo dice en minúsculas sale SIN_COMENTARIO (acusado): la dirección segura.
const RE_QUIEN_FIRMA = /fundador|FUNDADOR|asesor|ASESOR|orquestador|ORQUESTADOR|delegaci|DELEGACI|comentario|com\.|SCRUM-\d/;
/** NINGUNA = el comentario habla del convenio pero no gobierna nada (cuenta una historia). */
const CLASES_DECLARABLES = new Set(['APROBADO', 'PENDIENTE', 'NINGUNA']);
const RE_PENDIENTE = /PENDIENTE microcopy oficial/;

// El marcador DECLARA cuando abre la línea del comentario (`// [PENDIENTE microcopy oficial] — …`,
// que es la forma de `QR_COPY`). En mitad de una frase casi siempre CUENTA algo («caía al marcador
// `[PENDIENTE…]`», «ya no lleva…»), y eso la sonda no sabe leerlo: AMBIGUO.
const RE_PENDIENTE_DECLARA = /(^|\n)\s*(\/\/+|\/\*+|\*)\s*\[PENDIENTE microcopy oficial\]/;
// «NO APROBADO», «SIN APROBAR»… en mayúsculas: la palabra está, la firma no.
const RE_APROBADO_NEGADO = /\b(NO|SIN|NI)\s+(EST[AÁ]N?\s+)?(APROBAD|APROBAR|FIRMAD|FIRMAR)/;

/**
 * Clase de un bloque de comentarios: null (no es de convención), APROBADO, PENDIENTE o AMBIGUO.
 * AMBIGUO no se adivina: se resuelve por identidad en `ambiguos` del JSON, o el censo sale CIEGO.
 */
export function claseDeComentario(texto) {
  const a = firmas(texto).length > 0;
  const p = RE_PENDIENTE.test(texto);
  // Una negación en mayúsculas («SIN APROBAR») habla del convenio aunque no firme: no se ignora.
  if (RE_APROBADO_NEGADO.test(llano(texto))) return 'AMBIGUO';
  if (!a && !p) return null;
  if (a && p) return 'AMBIGUO';
  if (p) return RE_PENDIENTE_DECLARA.test(texto) ? 'PENDIENTE' : 'AMBIGUO';
  return 'APROBADO';
}

/** El comentario sin sus `//`, `/*`, `*` de margen, en una sola línea (una firma parte líneas). */
function llano(texto) {
  return texto.split('\n').map((l) => l.replace(/^\s*(\/\/+|\/\*+|\*+\/?|\*)?/, '').replace(/\*\/\s*$/, '')).join(' ');
}

/**
 * Las palabras de firma del comentario. `APROBAD…` vale siempre. `FIRMAD…` sólo si dice QUIÉN o
 * DÓNDE se firmó en los 60 caracteres siguientes: «un albarán FIRMADO» es un ESTADO, y «el
 * contenido FIRMADO por el cliente» también — confundirlos con una firma de copy es justo la
 * dirección peligrosa (un texto sin firmar pasaría por firmado).
 */
function firmas(texto) {
  const t = llano(texto);
  const out = [];
  for (const m of t.matchAll(/\b(APROBAD|FIRMAD)([OA]S?)\b/g)) {
    if (m[1] === 'FIRMAD' && !RE_QUIEN_FIRMA.test(t.slice(m.index + m[0].length, m.index + m[0].length + 60))) continue;
    out.push(m[0]);
  }
  return out;
}

const NUMERALES = { dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9, diez: 10, once: 11, doce: 12 };
const RE_CUENTA = /\b(dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|once|doce|\d{1,2})\s+(?:\S+\s+)?(literales|textos|r[óo]tulos|ranuras|mensajes|etiquetas|cabeceras|frases|avisos)\b/gi;

/**
 * Cuántos textos dice firmar un comentario («los dos literales están FIRMADOS» → 2). Sin cuenta,
 * Infinity (gobierna al grupo entero). Con varias cuentas distintas, la MENOR: firmar de menos
 * acusa de más, que es la dirección segura.
 */
export function cuantosDice(texto) {
  let n = Infinity;
  for (const m of llano(texto).matchAll(RE_CUENTA)) {
    const w = m[1].toLowerCase();
    const k = /^\d+$/.test(w) ? Number(w) : NUMERALES[w];
    if (k < n) n = k;
  }
  return n;
}

function ficherosDe(dirAbs, out = []) {
  for (const e of fs.readdirSync(dirAbs, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name.startsWith('.')) continue;
    const p = path.join(dirAbs, e.name);
    if (e.isDirectory()) ficherosDe(p, out);
    else if (e.isFile() && e.name.endsWith('.js')) out.push(p);
  }
  return out;
}

export function leerDeclarados(raiz = RAIZ) {
  return JSON.parse(fs.readFileSync(path.join(raiz, DECLARADOS_JSON), 'utf8'));
}

function nombreDePropiedad(p, sf) {
  const n = p.name;
  if (!n) return '?';
  if (ts.isIdentifier(n) || ts.isPrivateIdentifier(n)) return n.text;
  if (ts.isStringLiteral(n) || ts.isNumericLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) return n.text;
  if (ts.isComputedPropertyName(n)) return '[' + n.expression.getText(sf) + ']';
  return n.getText(sf);
}

function contieneTexto(nodo) {
  let si = false;
  (function mira(n) {
    if (si) return;
    if (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n) || ts.isTemplateExpression(n)) { si = true; return; }
    ts.forEachChild(n, mira);
  })(nodo);
  return si;
}

/** Ruta de nombre del objeto `obj` (sin la clave de la hoja): de dónde cuelga. */
function raizDeObjeto(obj, sf) {
  const partes = [];
  let n = obj;
  for (;;) {
    const padre = n.parent;
    if (!padre) break;
    if (ts.isParenthesizedExpression(padre) || ts.isAsExpression(padre) || ts.isSatisfiesExpression?.(padre)) { n = padre; continue; }
    if (ts.isCallExpression(padre) && padre.expression.getText(sf) === 'Object.freeze') { n = padre; continue; }
    if (ts.isVariableDeclaration(padre) && padre.initializer === n) { partes.unshift(padre.name.getText(sf)); break; }
    if (ts.isPropertyAssignment(padre) && padre.initializer === n && ts.isObjectLiteralExpression(padre.parent)) {
      partes.unshift(nombreDePropiedad(padre, sf)); n = padre.parent; continue;
    }
    if (ts.isArrayLiteralExpression(padre)) { partes.unshift('[]'); n = padre; continue; }
    if (ts.isBinaryExpression(padre) && padre.right === n && padre.operatorToken.kind === ts.SyntaxKind.EqualsToken) {
      partes.unshift(padre.left.getText(sf)); break;
    }
    if (ts.isExportAssignment(padre)) { partes.unshift('export default'); break; }
    // Sin nombre propio (argumento, `return {…}`…): la función que lo envuelve.
    let f = padre;
    while (f && !(ts.isFunctionDeclaration(f) || ts.isMethodDeclaration(f) || ((ts.isArrowFunction(f) || ts.isFunctionExpression(f)) && ts.isVariableDeclaration(f.parent)))) f = f.parent;
    const nombreF = !f ? '(módulo)' : (f.name ? f.name.getText(sf) : f.parent.name.getText(sf)) + '()';
    partes.unshift(nombreF + ' → {}');
    break;
  }
  return partes.join('.').replace(/\.\[\]/g, '[]');
}

/**
 * Censa un fichero. Devuelve { hojas, ciegos, comentariosConvenio, comentariosEnObjetos, objetos }.
 * `rel` es la ruta relativa con `/` (identidad estable entre sistemas).
 */
export function censarFuente(rel, texto, ambiguos = {}) {
  const ciegos = [];
  const hojas = [];
  const sf = ts.createSourceFile(rel, texto, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  const diag = sf.parseDiagnostics || [];
  if (diag.length) {
    ciegos.push({ id: rel, motivo: `no parsea limpio (${diag.length} diagnóstico(s) de sintaxis): ${ts.flattenDiagnosticMessageText(diag[0].messageText, ' ')}` });
    return { hojas, ciegos, comentariosConvenio: 0, comentariosEnObjetos: 0, objetos: 0, ambiguosUsados: new Set() };
  }
  const lineaDe = (pos) => sf.getLineAndCharacterOfPosition(pos).line;
  const bloque = (rangos) => (rangos || []).map((r) => texto.slice(r.pos, r.end)).join('\n');
  const ambiguosUsados = new Set();

  // Todos los comentarios de convención del fichero, por posición (para declarar la población).
  // Se cuentan por BLOQUE (los comentarios seguidos delante de un nodo), con la clave en su primer
  // rango — la misma unidad con la que se clasifica.
  const convenio = new Map(); // pos del primer rango → clase
  const anota = (rangos) => {
    const c = rangos && rangos.length ? claseDeComentario(bloque(rangos)) : null;
    if (c) convenio.set(rangos[0].pos, c);
  };
  (function todos(n) {
    anota(ts.getLeadingCommentRanges(texto, n.getFullStart()));
    ts.forEachChild(n, todos);
  })(sf);
  anota(ts.getLeadingCommentRanges(texto, sf.endOfFileToken.getFullStart()));
  const enObjetos = new Set();

  /** Resuelve un bloque (lista de rangos) a una clase, usando `AMBIGUOS` por identidad. */
  function claseDeBloque(rangos, idDueno) {
    // El bloque se lee ENTERO: una firma parte líneas («FIRMADO el 16-sep-2026 por / el fundador»).
    const c = claseDeComentario(bloque(rangos));
    if (!c) return null;
    if (c === 'AMBIGUO') {
      const id = `${rel} · ${idDueno}`;
      const res = ambiguos[id];
      if (res && CLASES_DECLARABLES.has(res.clase) && res.motivo) {
        ambiguosUsados.add(id);
        return res.clase === 'NINGUNA' ? null : res.clase;
      }
      ciegos.push({
        id,
        motivo: 'comentario AMBIGUO (APROBAD… y PENDIENTE a la vez, el marcador citado en prosa, o APROBADO negado): ' +
          `léelo y resuélvelo por identidad en «ambiguos» de ${DECLARADOS_JSON} con clase APROBADO | PENDIENTE | NINGUNA y su motivo`,
      });
      return 'CIEGO';
    }
    return c;
  }

  /** ¿Un bloque APROBADO habla de un GRUPO? Sólo si lo dice en plural, o si su resolución lo declara. */
  function esGrupo(rangos, idDueno) {
    const res = ambiguos[`${rel} · ${idDueno}`];
    if (res && res.alcance) return res.alcance === 'grupo';
    return firmas(bloque(rangos)).some((w) => w.endsWith('S'));
  }

  const visitados = new Set();
  let objetos = 0;

  /** Recorre un objeto que ENTRA en el censo con la clase heredada `heredada`. */
  function censarObjeto(obj, heredada, rutaBase, limiteHeredado = Infinity) {
    visitados.add(obj);
    objetos++;
    const props = obj.properties;
    // Rangos de comentario entre elementos, asignados a su dueño.
    const leading = props.map(() => []);
    const trailing = props.map(() => []);
    const cierre = obj.getEnd() - 1; // la llave de cierre
    for (let i = 0; i <= props.length; i++) {
      const desde = i === 0 ? obj.getStart(sf) + 1 : props[i - 1].getEnd();
      // Detrás de la coma, si la hay.
      let pos = desde;
      const resto = texto.slice(pos, i < props.length ? props[i].getStart(sf) : cierre);
      const coma = resto.search(/[^\s]/);
      if (coma >= 0 && resto[coma] === ',') pos = pos + coma + 1;
      const rangos = [
        ...(i > 0 ? ts.getTrailingCommentRanges(texto, desde) || [] : []),
        ...(ts.getLeadingCommentRanges(texto, pos) || []),
      ];
      const vistos = new Set();
      for (const r of rangos) {
        if (vistos.has(r.pos)) continue;
        vistos.add(r.pos);
        if (convenio.has(r.pos)) enObjetos.add(r.pos);
        const mismaLineaQueElAnterior = i > 0 && lineaDe(r.pos) === lineaDe(props[i - 1].getEnd());
        if (mismaLineaQueElAnterior) trailing[i - 1].push(r);
        else if (i < props.length) leading[i].push(r);
        // Los que quedan antes de la `}` sin propiedad detrás no gobiernan nada.
      }
    }
    let actual = heredada;
    let restantes = heredada === 'APROBADO' ? limiteHeredado : Infinity;
    props.forEach((p, i) => {
      const clave = ts.isSpreadAssignment(p) ? '...' + p.expression.getText(sf) : nombreDePropiedad(p, sf);
      const ruta = `${rutaBase}.${clave}`;
      const encima = claseDeBloque(leading[i], ruta);
      // PENDIENTE gobierna al grupo (acusar de más es la dirección segura). APROBADO sólo gobierna
      // al grupo si lo dice en PLURAL; en singular es la firma de ESA clave y no se hereda. Y si el
      // plural CUENTA («los dos literales están FIRMADOS»), gobierna a esos N y ni uno más.
      let soloEsta = null;
      if (encima === 'APROBADO' && !esGrupo(leading[i], ruta)) soloEsta = encima;
      else if (encima) {
        actual = encima;
        restantes = encima === 'APROBADO' ? cuantosDice(bloque(leading[i])) : Infinity;
      }
      if (!soloEsta && actual === 'APROBADO') {
        if (restantes <= 0) actual = null;
        else restantes--;
      }
      const propia = claseDeBloque(trailing[i], ruta) || soloEsta || actual || 'SIN_COMENTARIO';
      if (ts.isSpreadAssignment(p)) {
        ciegos.push({ id: `${rel} · ${ruta}`, motivo: '`...spread` dentro de un objeto del censo: trae hojas que este AST no ve' });
        return;
      }
      const valor = ts.isPropertyAssignment(p) ? p.initializer : p;
      let v = valor;
      while (v && (ts.isParenthesizedExpression(v) || ts.isAsExpression(v))) v = v.expression;
      if (v && ts.isObjectLiteralExpression(v)) { censarObjeto(v, propia, ruta); return; }
      if (v && ts.isArrayLiteralExpression(v) && v.elements.some((e) => ts.isObjectLiteralExpression(e))) {
        for (const e of v.elements) {
          if (ts.isObjectLiteralExpression(e)) censarObjeto(e, propia, ruta + '[]');
        }
        if (!v.elements.every((e) => ts.isObjectLiteralExpression(e) || !contieneTexto(e))) {
          hojas.push({ id: `${rel} · ${ruta}`, clase: propia });
        }
        return;
      }
      if (!ts.isShorthandPropertyAssignment(p) && contieneTexto(valor)) {
        hojas.push({ id: `${rel} · ${ruta}`, clase: propia });
      }
    });
  }

  // Busca los objetos RAÍZ que entran (no anidados en otro objeto del censo).
  (function busca(n) {
    if (ts.isObjectLiteralExpression(n) && !visitados.has(n)) {
      const decl = cabeceraRangos(n);
      const cab = claseDeComentario(bloque(decl));
      let interno = false;
      for (const p of n.properties) {
        if (claseDeComentario(bloque(ts.getLeadingCommentRanges(texto, p.getFullStart())))) { interno = true; break; }
        if (claseDeComentario(bloque(ts.getTrailingCommentRanges(texto, p.getEnd())))) { interno = true; break; }
      }
      const base = cab || interno ? raizDeObjeto(n, sf) : null;
      // La cabecera gobierna al objeto entero, se escriba en singular o en plural. Si se resolvió
      // como NINGUNA (cuenta una historia), el objeto sólo entra si lleva convenio DENTRO.
      const heredada = cab ? claseDeBloque(decl, base + ' (cabecera)') : null;
      if (heredada || interno) {
        if (heredada) for (const r of decl) if (convenio.has(r.pos)) enObjetos.add(r.pos);
        censarObjeto(n, heredada, base, heredada === 'APROBADO' ? cuantosDice(bloque(decl)) : Infinity);
        return;
      }
    }
    ts.forEachChild(n, busca);
  })(sf);

  function cabeceraRangos(obj) {
    let n = obj;
    while (n.parent && (ts.isParenthesizedExpression(n.parent) || ts.isAsExpression(n.parent) ||
      (ts.isCallExpression(n.parent) && n.parent.expression.getText(sf) === 'Object.freeze'))) n = n.parent;
    const padre = n.parent;
    let decl = null;
    if (padre && ts.isVariableDeclaration(padre) && padre.initializer === n) {
      decl = padre.parent?.parent; // VariableDeclarationList → VariableStatement
      if (decl && !ts.isVariableStatement(decl)) decl = null;
    } else if (padre && ts.isExportAssignment(padre)) decl = padre;
    else if (padre && ts.isBinaryExpression(padre) && padre.right === n && ts.isExpressionStatement(padre.parent)) decl = padre.parent;
    if (!decl) return [];
    return ts.getLeadingCommentRanges(texto, decl.getFullStart()) || [];
  }

  return { hojas, ciegos, comentariosConvenio: convenio.size, comentariosEnObjetos: enObjetos.size, objetos, ambiguosUsados };
}

/**
 * El censo entero. `textos` (Map rel→fuente) sustituye a leer `public/` — lo usan los tests para
 * los controles sin escribir en el árbol. Devuelve SIEMPRE la población; las hojas, SÓLO si no hay
 * ningún CIEGO.
 */
export function censar({ raiz = RAIZ, textos = null, ambiguos = null } = {}) {
  const ciegos = [];
  let fuentes;
  if (textos) fuentes = [...textos.entries()];
  else {
    const dir = path.join(raiz, CARPETA);
    let lista = [];
    try { lista = ficherosDe(dir); } catch (e) { ciegos.push({ id: CARPETA, motivo: `no se puede listar: ${e.message}` }); }
    fuentes = [];
    for (const abs of lista) {
      const rel = path.relative(raiz, abs).split(path.sep).join('/');
      try { fuentes.push([rel, fs.readFileSync(abs, 'utf8')]); } catch (e) { ciegos.push({ id: rel, motivo: `no se puede leer: ${e.message}` }); }
    }
  }
  if (!fuentes.length) ciegos.push({ id: CARPETA, motivo: 'población VACÍA: cero ficheros .js — un censo sobre nada no es un verde' });
  if (!ambiguos) {
    try { ambiguos = leerDeclarados(raiz).ambiguos || {}; } catch (e) {
      ciegos.push({ id: DECLARADOS_JSON, motivo: `no se puede leer: ${e.message}` });
      ambiguos = {};
    }
  }
  const poblacion = { ficheros: fuentes.length, comentariosConvenio: 0, comentariosEnObjetos: 0, objetos: 0, hojas: 0 };
  const porId = new Map();
  const usados = new Set();
  for (const [rel, texto] of fuentes) {
    const r = censarFuente(rel, texto, ambiguos);
    ciegos.push(...r.ciegos);
    poblacion.comentariosConvenio += r.comentariosConvenio;
    poblacion.comentariosEnObjetos += r.comentariosEnObjetos;
    poblacion.objetos += r.objetos;
    for (const u of r.ambiguosUsados) usados.add(u);
    for (const h of r.hojas) {
      poblacion.hojas++;
      const prev = porId.get(h.id);
      if (!prev) porId.set(h.id, { id: h.id, clase: h.clase, n: 1 });
      else if (prev.clase === h.clase) prev.n++;
      else ciegos.push({ id: h.id, motivo: `dos hojas con la misma identidad y distinta clase (${prev.clase} / ${h.clase})` });
    }
  }
  for (const id of Object.keys(ambiguos)) {
    if (!usados.has(id)) ciegos.push({ id, motivo: 'resolución en «ambiguos» que ya no casa con ningún comentario: retírala' });
  }
  poblacion.comentariosFueraDeAlcance = poblacion.comentariosConvenio - poblacion.comentariosEnObjetos;
  if (ciegos.length) return { estado: 'CIEGO', ciegos, poblacion };
  const hojas = [...porId.values()].sort((a, b) => a.id.localeCompare(b.id));
  const acusadas = hojas.filter((h) => h.clase !== 'APROBADO');
  return { estado: 'OK', ciegos: [], poblacion, hojas, acusadas };
}

/**
 * El trinquete, con sus DOS mitades: lo acusado que no está declarado (texto nuevo sin firma
 * legible) y lo declarado que ya no sale acusado (se firmó o se borró, y hay que retirarlo con su
 * motivo). Compara CONJUNTOS de identidad+clase+n, nunca cuentas.
 */
export function compararConDeclarados(r, declarados) {
  const decl = declarados.acusadas || {};
  const nuevas = [];
  const sobran = [];
  const vistas = new Set();
  for (const h of r.acusadas) {
    vistas.add(h.id);
    const d = decl[h.id];
    if (!d || d.clase !== h.clase || (d.n || 1) !== h.n) nuevas.push(h);
  }
  for (const [id, d] of Object.entries(decl)) {
    if (!vistas.has(id)) sobran.push({ id, ...d });
    if (!d.motivo) nuevas.push({ id, clase: d.clase, n: d.n || 1, sinMotivo: true });
  }
  return { nuevas, sobran };
}

export const QUE_HACER_NUEVA =
  'texto del panel sin firma legible en el fuente. Mándalo a firmar (S4, regla 39) — y si YA está ' +
  'firmado, escribe encima `// APROBADO por <quién> el <fecha> (<referencia>)`, que es lo que lo ' +
  `saca de aquí. Sólo si de verdad queda pendiente, decláralo en «acusadas» de ${DECLARADOS_JSON} con su motivo.`;
export const QUE_HACER_SOBRA =
  `ya no sale acusado (se firmó o se borró): muévelo de «acusadas» a «retiradas» en ${DECLARADOS_JSON}, ` +
  'con el motivo y la referencia de la firma. No se borra sin más: la bajada se declara.';

// ── CLI ──────────────────────────────────────────────────────────────────────────────────────────
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const iRaiz = process.argv.indexOf('--raiz');
  const raiz = iRaiz > 0 ? path.resolve(process.argv[iRaiz + 1]) : RAIZ;
  const r = censar({ raiz });
  const p = r.poblacion;
  const linea = `población: ${p.ficheros} ficheros .js en ${CARPETA}/ · ${p.comentariosConvenio} comentarios de convención ` +
    `(${p.comentariosEnObjetos} en objetos del censo, ${p.comentariosFueraDeAlcance} FUERA DE ALCANCE) · ${p.objetos} objetos · ${p.hojas} hojas de texto`;
  if (r.estado === 'CIEGO') {
    // Sin nada parcial: sólo la población y por qué no se puede afirmar.
    console.error(`CIEGO — el censo NO afirma nada (${r.ciegos.length} motivo(s)).`);
    console.error(linea);
    for (const c of r.ciegos) console.error(`  CIEGO  ${c.id}\n         ${c.motivo}`);
    process.exit(2);
  }
  console.log(linea);
  const cuenta = (k) => r.hojas.filter((h) => h.clase === k).reduce((s, h) => s + h.n, 0);
  console.log(`APROBADO ${cuenta('APROBADO')} · PENDIENTE ${cuenta('PENDIENTE')} · SIN_COMENTARIO ${cuenta('SIN_COMENTARIO')}`);
  for (const h of r.acusadas) console.log(`  ${h.clase.padEnd(15)} ${h.id}${h.n > 1 ? `  (×${h.n})` : ''}`);
  const { nuevas, sobran } = compararConDeclarados(r, leerDeclarados(raiz));
  for (const h of nuevas) console.log(`NUEVA  ${h.id}\n       ${h.sinMotivo ? 'declarada SIN motivo' : QUE_HACER_NUEVA}`);
  for (const h of sobran) console.log(`SOBRA  ${h.id}\n       ${QUE_HACER_SOBRA}`);
  console.log(`trinquete: ${nuevas.length} nuevas · ${sobran.length} que sobran · ${r.acusadas.length} acusadas declaradas`);
  if (nuevas.length || sobran.length) process.exit(1);
}
