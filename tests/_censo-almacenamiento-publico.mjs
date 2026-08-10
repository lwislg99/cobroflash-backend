// tests/_censo-almacenamiento-publico.mjs — SCRUM-336
//
// CENSO DERIVADO del almacenamiento persistente en la SUPERFICIE PÚBLICA, y de los enlaces
// internos al registro que tienen que llevar la atribución.
//
// ⚠️ AST, no `grep`: hay que distinguir `localStorage.setItem('x')` de la palabra «localStorage»
// escrita en un comentario que explica por qué ya no se usa — y este repo está lleno de esos
// comentarios justo después de SCRUM-336. Un guard de texto se cazaría a sí mismo.
//
// ⚠️ Y NINGUNA LISTA A MANO: ni de páginas, ni de enlaces. Se recorre `public/` entero. Una lista
// envejece el día que alguien añade una página con un CTA y nadie se entera de que ese camino ni
// atribuye ni está vigilado.
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

/**
 * QUÉ ES «SUPERFICIE PÚBLICA»: `public/` MENOS `public/dashboard/`.
 *
 * El panel es la app DESPUÉS de identificarse, con una relación ya establecida y un servicio
 * pedido; su almacenamiento (preferencias de vista, borradores) es otra conversación y no es de
 * este ticket. La landing, precios, login y registro los ve cualquiera sin haber pedido nada:
 * ahí es donde el art. 5.3 muerde.
 */
export const PANEL = 'public/dashboard/';
const DESTINO_REGISTRO = '/register.html';

const ALMACENES = ['localStorage', 'sessionStorage'];
const OPERACIONES = ['setItem', 'getItem', 'removeItem'];

function ficheros(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { ficheros(p, out); continue; }
    if (/\.(html|js)$/.test(e.name)) out.push(p);
  }
  return out;
}

/** Los `<script>` de un HTML, con el desplazamiento para poder dar la línea REAL del fichero. */
function trozosDeScript(html) {
  const out = [];
  for (const m of html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)) {
    out.push({ codigo: m[1], offsetLineas: html.slice(0, m.index).split('\n').length - 1 });
  }
  return out;
}

/**
 * Todos los accesos a almacenamiento del navegador en `public/`.
 * `cookie` incluida: `document.cookie = …` es almacenamiento en el terminal igual que `localStorage`
 * (el art. 5.3 no habla de la tecnología). Si algún día alguien lo usa para atribuir, el censo lo ve.
 */
export function censarAlmacenamiento(raizPublic, raizRepo) {
  const accesos = [];
  for (const abs of ficheros(raizPublic)) {
    const rel = path.relative(raizRepo, abs).replace(/\\/g, '/');
    const texto = fs.readFileSync(abs, 'utf8');
    const trozos = abs.endsWith('.html') ? trozosDeScript(texto) : [{ codigo: texto, offsetLineas: 0 }];

    for (const { codigo, offsetLineas } of trozos) {
      const sf = ts.createSourceFile('x.js', codigo, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
      const linea = (n) => offsetLineas + sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1;

      (function walk(n) {
        if (ts.isCallExpression(n) && ts.isPropertyAccessExpression(n.expression)) {
          const receptor = n.expression.expression.getText(sf);
          const op = n.expression.name.text;
          const almacen = ALMACENES.find((a) => new RegExp(`(^|\\.)${a}$`).test(receptor));
          if (almacen && OPERACIONES.includes(op)) {
            const clave = n.arguments[0] && ts.isStringLiteralLike(n.arguments[0])
              ? n.arguments[0].text : '(clave no literal)';
            accesos.push({
              fichero: rel, linea: linea(n), almacen, op, clave,
              escribe: op === 'setItem',
              enElPanel: rel.startsWith(PANEL),
              // SCRUM-457 · campo AÑADIDO, no sustituido: `clave` sigue diciendo exactamente lo que
              // decía. Ver `resolverClave` para qué es y por qué puede ser `null`.
              claveResuelta: resolverClave(n.arguments[0], sf),
              id: `${rel}::${almacen}.${op}('${clave}')`,
            });
          }
        }
        // `document.cookie = …`
        if (ts.isBinaryExpression(n) && n.operatorToken.kind === ts.SyntaxKind.EqualsToken
            && ts.isPropertyAccessExpression(n.left) && n.left.name.text === 'cookie') {
          accesos.push({
            fichero: rel, linea: linea(n), almacen: 'cookie', op: 'setItem', clave: '(cookie)',
            escribe: true, enElPanel: rel.startsWith(PANEL),
            id: `${rel}::document.cookie=`,
          });
        }
        ts.forEachChild(n, walk);
      })(sf);
    }
  }
  accesos.sort((a, b) => a.id.localeCompare(b.id));
  return accesos;
}

/**
 * SCRUM-457 · QUÉ CLAVE ES, cuando el argumento no es una cadena a secas.
 *
 * Hacía falta porque las dos claves que MÁS importan —el borrador y el catálogo con precios— se
 * escriben como `localStorage.setItem(draftKey(), …)`, y el censo de SCRUM-336 las daba por «clave
 * no literal». Para decidir si una clave está registrada hay que saber cómo empieza.
 *
 * Se resuelve UN salto, no más: literal, plantilla, o llamada a una función del MISMO fichero cuyo
 * `return` es una de esas dos cosas. Es lo que hay hoy y no se inventa un intérprete.
 *
 * 🔴 Y CUANDO NO SE SABE, DEVUELVE `null` — que el guard trata como CEGUERA y pone en rojo, no
 * como «no hay clave». Un `null` que se lee igual que «no existe» es lo que dejó dos vistas sin
 * medir en SCRUM-448.
 *
 * @returns {{tipo:'exacta'|'prefijo', valor:string}|null}
 */
function resolverClave(arg, sf) {
  if (!arg) return null;
  if (ts.isStringLiteralLike(arg) && !ts.isTemplateExpression(arg)) {
    return { tipo: 'exacta', valor: arg.text };
  }
  if (ts.isTemplateExpression(arg)) {
    // `pf_quote_draft_${mid}` → todo lo que hay ANTES del primer hueco. Si no hay nada antes, el
    // prefijo es vacío y eso no identifica nada: se declara ciego.
    return arg.head.text ? { tipo: 'prefijo', valor: arg.head.text } : null;
  }
  if (ts.isCallExpression(arg) && ts.isIdentifier(arg.expression)) {
    const nombre = arg.expression.text;
    let hallada = null;
    (function busca(n) {
      if (hallada) return;
      const esLaFuncion = (ts.isFunctionDeclaration(n) && n.name && n.name.text === nombre)
        || ((ts.isFunctionExpression(n) || ts.isArrowFunction(n)) && ts.isVariableDeclaration(n.parent)
            && ts.isIdentifier(n.parent.name) && n.parent.name.text === nombre);
      if (esLaFuncion && n.body) {
        (function buscaReturn(b) {
          if (hallada) return;
          if (ts.isReturnStatement(b) && b.expression) hallada = resolverClave(b.expression, sf);
          ts.forEachChild(b, buscaReturn);
        })(n.body);
      }
      ts.forEachChild(n, busca);
    })(sf);
    return hallada;
  }
  return null;
}

/**
 * Los enlaces internos al registro, derivados del DOM escrito (HTML) y del JS que inyecta HTML.
 * Sirven para el suelo: si el censo no ve NINGUNO, la comprobación de que la atribución viaja por
 * la URL no estaría comprobando nada.
 */
export function censarEnlacesAlRegistro(raizPublic, raizRepo) {
  const enlaces = [];
  for (const abs of ficheros(raizPublic)) {
    const rel = path.relative(raizRepo, abs).replace(/\\/g, '/');
    if (rel.startsWith(PANEL)) continue;
    fs.readFileSync(abs, 'utf8').split(/\r?\n/).forEach((l, i) => {
      for (const m of l.matchAll(/["'](\/register\.html[^"']*)["']/g)) {
        enlaces.push({ fichero: rel, linea: i + 1, destino: m[1] });
      }
    });
  }
  return enlaces;
}

export { DESTINO_REGISTRO };
