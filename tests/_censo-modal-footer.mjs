// tests/_censo-modal-footer.mjs — SCRUM-350: censo DERIVADO de los pies de modal que usan
// `.modal-footer`. Puro: recibe fuentes, devuelve el censo. Sin BD, sin red, sin navegador.
//
// ── POR QUÉ DERIVADO Y NO A MANO ─────────────────────────────────────────────
// `.modal-footer` es un contenedor COMPARTIDO. El arreglo de SCRUM-350 es una línea de CSS que
// alcanza a todos los modales del dashboard a la vez, así que la pregunta que decide si el
// cambio es seguro no es «¿se arregla el que se rompe?» sino «¿cuáles hay?». Una lista escrita
// a mano contesta la primera y falla en silencio la segunda: no avisa de lo que le falta.
//
// El defecto lo hizo visible SCRUM-289 con un rótulo provisional de 28 caracteres, pero el
// defecto NO es del rótulo: `.modal-footer` es `display:flex` sin `flex-wrap`, y los botones
// llevan `white-space:nowrap` (styles.css), así que ningún botón parte su texto y ninguna fila
// se parte en dos. Cuando la suma no cabe, se sale. El rótulo solo eligió QUIÉN se rompía primero.
//
// ── LAS TRES FORMAS DE ESCRIBIR UN PIE EN ESTE REPO, medidas sobre el árbol ───
//   1. `plantilla`      — HTML dentro de un template literal: `<div class="modal-footer">…`.
//                         (customerDetailView, homeView, productsView, expensesView, providersView)
//   2. `createElement`  — DOM a mano: `document.createElement('div')` + `.className='modal-footer'`.
//                         (nuevaFacturaModal, jobDetailView, quotesView ×2)
//   3. `helper`         — el `createElement(tag, clase, texto)` propio de la vista.
//                         (customersView)
//
// Si mañana aparece una CUARTA forma, este analizador no la verá — por eso el test que lo usa
// trae DOS suelos: uno por forma (si un detector deja de reconocer la suya, rojo) y un guard de
// COBERTURA que barre el repo entero buscando el token `modal-footer` y falla si aparece en un
// fichero que el censo no está mirando. Un cero de «no hay» y uno de «no supe mirar» son el
// mismo número y significan lo contrario.
import ts from 'typescript';

/** Recorre un subárbol aplicando `fn`. */
function recorrer(nodo, fn) {
  fn(nodo);
  nodo.forEachChild((h) => recorrer(h, fn));
}

const esLiteralTexto = (n) =>
  !!n && (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n));

const MARCA_DINAMICA = '⟪dinámico⟫';

/**
 * Resuelve una expresión al TEXTO MÁS LARGO que puede producir, que es el que decide si el pie
 * cabe. Un ternario aporta su rama larga; un identificador se busca entre las constantes del
 * fichero (sin esto, `NF_PENDIENTE` —el marcador de 28 caracteres de SCRUM-289— se vería como
 * «no es un literal» y el peor caso real quedaría fuera del censo).
 */
function textoMasLargo(n, constantes) {
  if (!n) return null;
  if (esLiteralTexto(n)) return n.text;
  if (ts.isIdentifier(n)) return constantes.get(n.text) ?? null;
  if (ts.isConditionalExpression(n)) {
    const a = textoMasLargo(n.whenTrue, constantes);
    const b = textoMasLargo(n.whenFalse, constantes);
    if (a == null) return b;
    if (b == null) return a;
    return a.length >= b.length ? a : b;
  }
  if (ts.isBinaryExpression(n) && n.operatorToken.kind === ts.SyntaxKind.PlusToken) {
    const a = textoMasLargo(n.left, constantes) ?? MARCA_DINAMICA;
    const b = textoMasLargo(n.right, constantes) ?? MARCA_DINAMICA;
    return a + b;
  }
  if (ts.isParenthesizedExpression(n)) return textoMasLargo(n.expression, constantes);
  // Llamada, propiedad, dato del merchant… no es copy: se marca en vez de inventarse.
  let masLargo = null;
  recorrer(n, (h) => {
    if (esLiteralTexto(h) && (masLargo == null || h.text.length > masLargo.length)) masLargo = h.text;
  });
  return masLargo ?? MARCA_DINAMICA;
}

/** Texto completo de una plantilla, con cada `${…}` resuelto a su rama más larga. */
function textoDePlantilla(n, constantes) {
  if (ts.isNoSubstitutionTemplateLiteral(n)) return n.text;
  if (!ts.isTemplateExpression(n)) return esLiteralTexto(n) ? n.text : null;
  let out = n.head.text;
  for (const s of n.templateSpans) {
    out += (textoMasLargo(s.expression, constantes) ?? MARCA_DINAMICA) + s.literal.text;
  }
  return out;
}

// ── Lector de fragmentos HTML ────────────────────────────────────────────────
// No hay parser de HTML en el repo (ni jsdom ni parse5) y no se añade una dependencia por esto
// (regla 36). Lo que hace falta es acotado: encontrar `<div class="…modal-footer…">`, cerrar por
// balance de `<div>`, y sacar los `<button>`/`<a>` de dentro con su texto y sus clases.

/** Todos los `<div …class="…modal-footer…">` de un fragmento, con su contenido balanceado. */
function piesEnHtml(html) {
  const fuera = [];
  const apertura = /<div\b([^>]*)>/gi;
  let m;
  while ((m = apertura.exec(html)) !== null) {
    if (!/\bclass\s*=\s*["'][^"']*\bmodal-footer\b/i.test(m[1])) continue;
    // Cierre por balance: desde el final de la etiqueta de apertura, contar <div> y </div>.
    const desde = apertura.lastIndex;
    const tags = /<div\b[^>]*>|<\/div\s*>/gi;
    tags.lastIndex = desde;
    let nivel = 1;
    let fin = html.length;
    let t;
    while ((t = tags.exec(html)) !== null) {
      nivel += t[0][1] === '/' ? -1 : 1;
      if (nivel === 0) { fin = t.index; break; }
    }
    fuera.push({
      atributos: m[1],
      interior: html.slice(desde, fin),
      indice: m.index,
      cerrado: nivel === 0,
    });
  }
  return fuera;
}

const atributo = (attrs, nombre) => {
  const m = new RegExp(`\\b${nombre}\\s*=\\s*["']([^"']*)["']`, 'i').exec(attrs || '');
  return m ? m[1] : '';
};

/** ¿Esta lista de clases es la del MODAL (no la de su cabecera, cuerpo o pie)? */
const esClaseDeModal = (c) =>
  (c || '').split(/\s+/).some((t) => t === 'modal' || /^[a-z0-9-]*-?modal$/i.test(t));

/**
 * Clase del modal que ENVUELVE a este pie: el ancestro ABIERTO más cercano cuya clase es la de
 * un modal. Importa porque hay modales con reglas propias (`.qq-modal` trae su bloque en
 * styles.css), y medir el pie sin su contenedor mediría otro modal distinto del real.
 *
 * Se resuelve con PILA, no cogiendo el último `<div…modal…>` que aparece antes: `modal-body`
 * abre y CIERRA por encima del pie, así que una búsqueda hacia atrás sin balance devolvía el
 * cuerpo como si fuera el contenedor.
 */
function claseDelModalQueEnvuelve(html, indice) {
  const re = /<div\b([^>]*?)(\/?)>|<\/div\s*>/gi;
  const pila = [];
  let m;
  while ((m = re.exec(html)) !== null && m.index < indice) {
    if (m[0][1] === '/') pila.pop();
    else if (m[2] !== '/') pila.push(atributo(m[1], 'class'));
  }
  for (let i = pila.length - 1; i >= 0; i--) if (esClaseDeModal(pila[i])) return pila[i];
  return '';
}

/**
 * Líneas donde ABRE cada `<div …class="…modal-footer…">` en el TEXTO CRUDO del fichero.
 * El censo resuelve los `${…}` para leer los rótulos, y eso altera el número de saltos de
 * línea: contar sobre el texto resuelto daba líneas desviadas (homeView salía en la 705 en vez
 * de la 723). Las líneas se sacan de la fuente tal cual está escrita.
 */
function lineasDePiesEnCrudo(fuente) {
  const out = [];
  const re = /<div\b[^>]*\bclass\s*=\s*["'][^"']*\bmodal-footer\b[^"']*["'][^>]*>/gi;
  let m;
  while ((m = re.exec(fuente)) !== null) {
    out.push(fuente.slice(0, m.index).split('\n').length);
  }
  return out;
}

/** `<button>`/`<a>` de un fragmento, con su rótulo (texto visible, sin etiquetas). */
function botonesEnHtml(html) {
  const out = [];
  const re = /<(button|a)\b([^>]*)>([\s\S]*?)<\/\1\s*>/gi;
  let m;
  while ((m = re.exec(html)) !== null) {
    const etiqueta = m[3].replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
    out.push({
      tag: m[1].toLowerCase(),
      clases: atributo(m[2], 'class'),
      estilo: atributo(m[2], 'style'),
      etiqueta,
    });
  }
  return out;
}

/**
 * Censa los pies de modal de un conjunto de fuentes.
 * @param {Array<{ruta:string, texto:string}>} fuentes
 * @returns {{pies:Array, porOrigen:Record<string,number>, ficheros:number}}
 */
export function censarPiesDeModal(fuentes) {
  const pies = [];

  for (const { ruta, texto } of fuentes) {
    const esHtml = /\.html?$/i.test(ruta);

    if (esHtml) {
      const lineas = lineasDePiesEnCrudo(texto);
      piesEnHtml(texto).forEach((p, i) => {
        pies.push({
          fichero: ruta,
          linea: lineas[i] ?? texto.slice(0, p.indice).split('\n').length,
          origen: 'plantilla',
          estiloDelPie: atributo(p.atributos, 'style'),
          clasesDelPie: atributo(p.atributos, 'class'),
          claseDelModal: claseDelModalQueEnvuelve(texto, p.indice),
          anidado: /<div\b/i.test(p.interior),
          botones: botonesEnHtml(p.interior),
        });
      });
      continue;
    }

    const sf = ts.createSourceFile(ruta, texto, ts.ScriptTarget.Latest, true);
    const linea = (n) => sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1;

    // Constantes de texto del fichero (para resolver identificadores como NF_PENDIENTE).
    const constantes = new Map();
    recorrer(sf, (n) => {
      if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && esLiteralTexto(n.initializer)) {
        constantes.set(n.name.text, n.initializer.text);
      }
    });

    // ── Ámbitos ───────────────────────────────────────────────────────────────
    // Una tabla plana por FICHERO mezcla variables homónimas de funciones distintas. En
    // quotesView.js hay dos modales y las dos funciones llaman `modal` a su contenedor: sin
    // ámbitos, el pie de la línea 163 salía con la clase del modal de la 1939 (`quote-ajustes-
    // modal`, que tiene otro `max-width`) y la medición se habría hecho sobre un modal que no
    // es. Cada variable se indexa por la FUNCIÓN QUE LA DECLARA, y las referencias se resuelven
    // subiendo la cadena — así `closeBtn`, declarado fuera y tocado dentro de `markDone`, sigue
    // siendo el mismo botón.
    const esFuncion = (n) =>
      ts.isFunctionDeclaration(n) || ts.isFunctionExpression(n) || ts.isArrowFunction(n) ||
      ts.isMethodDeclaration(n) || ts.isConstructorDeclaration(n);
    const cadenaDeAmbitos = (n) => {
      const cadena = [];
      for (let p = n; p; p = p.parent) if (esFuncion(p)) cadena.push(String(p.pos));
      cadena.push('modulo');
      return cadena;
    };
    /** Declaraciones: `ambito|nombre`. */
    const declaradas = new Set();
    recorrer(sf, (n) => {
      if ((ts.isVariableDeclaration(n) || ts.isParameter(n)) && ts.isIdentifier(n.name)) {
        declaradas.add(cadenaDeAmbitos(n)[0] + '|' + n.name.text);
      }
    });
    /** Clave estable de una variable vista desde `nodo`: su declaración, o el módulo. */
    const clave = (nodo, nombre) => {
      for (const a of cadenaDeAmbitos(nodo)) if (declaradas.has(a + '|' + nombre)) return a + '|' + nombre;
      return 'modulo|' + nombre;
    };

    // ── Tabla de elementos y de paternidad ────────────────────────────────────
    /** @type {Map<string,{tag:string, clases:Set<string>, etiquetas:string[], linea:number}>} */
    const elementos = new Map();
    const dame = (nombre, linea0) => {
      if (!elementos.has(nombre)) {
        elementos.set(nombre, { tag: null, clases: new Set(), etiquetas: [], linea: linea0 });
      }
      return elementos.get(nombre);
    };
    /** @type {Map<string,string[]>} padre → hijos, en orden de aparición. */
    const hijos = new Map();

    const registrarCreacion = (nombre, llamada) => {
      const el = dame(nombre, linea(llamada));
      const args = llamada.arguments;
      const tag = textoMasLargo(args[0], constantes);
      if (tag) el.tag = tag.toLowerCase();
      // Forma 3: helper propio `createElement(tag, clase, texto)`.
      const esHelper = ts.isIdentifier(llamada.expression) && llamada.expression.text === 'createElement';
      if (esHelper) {
        el.viaHelper = true;
        const clase = textoMasLargo(args[1], constantes);
        if (clase) for (const c of clase.split(/\s+/)) if (c) el.clases.add(c);
        const txt = args[2] ? textoMasLargo(args[2], constantes) : null;
        if (txt) el.etiquetas.push(txt);
      }
    };

    recorrer(sf, (n) => {
      // `const V = document.createElement('x')` | `const V = createElement('x', 'clase', 'texto')`
      if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && n.initializer &&
          ts.isCallExpression(n.initializer) && esLlamadaCreate(n.initializer)) {
        registrarCreacion(clave(n, n.name.text), n.initializer);
      }
      // `V = createElement(…)` sin declaración (variable de ámbito exterior).
      if (ts.isBinaryExpression(n) && n.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
          ts.isIdentifier(n.left) && ts.isCallExpression(n.right) && esLlamadaCreate(n.right)) {
        registrarCreacion(clave(n, n.left.text), n.right);
      }
      // `V.className = …` | `V.textContent = …` | `V.classList.add(…)`
      if (ts.isBinaryExpression(n) && n.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
          ts.isPropertyAccessExpression(n.left) && ts.isIdentifier(n.left.expression)) {
        const k = clave(n, n.left.expression.text);
        const prop = n.left.name.text;
        if (prop === 'className') {
          const v = textoMasLargo(n.right, constantes);
          if (v) for (const c of v.split(/\s+/)) if (c) dame(k, linea(n)).clases.add(c);
        } else if (prop === 'textContent' || prop === 'innerText') {
          const v = textoMasLargo(n.right, constantes);
          if (v) dame(k, linea(n)).etiquetas.push(v);
        }
      }
      // `V.style.maxWidth = '440px'` — estilo en línea del contenedor. Gana a la hoja de
      // estilos, así que un modal medido sin él se mide con otro ancho del que tiene.
      if (ts.isBinaryExpression(n) && n.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
          ts.isPropertyAccessExpression(n.left) &&
          ts.isPropertyAccessExpression(n.left.expression) &&
          ts.isIdentifier(n.left.expression.expression) &&
          n.left.expression.name.text === 'style') {
        const v = textoMasLargo(n.right, constantes);
        if (v) {
          const el = dame(clave(n, n.left.expression.expression.text), linea(n));
          const guion = n.left.name.text.replace(/[A-Z]/g, (c) => '-' + c.toLowerCase());
          el.estilo = (el.estilo ? el.estilo + ';' : '') + guion + ':' + v;
        }
      }
      if (ts.isCallExpression(n) && ts.isPropertyAccessExpression(n.expression) &&
          ts.isPropertyAccessExpression(n.expression.expression) &&
          ts.isIdentifier(n.expression.expression.expression) &&
          n.expression.expression.name.text === 'classList' && n.expression.name.text === 'add') {
        const el = dame(clave(n, n.expression.expression.expression.text), linea(n));
        for (const a of n.arguments) {
          const v = textoMasLargo(a, constantes);
          if (v) el.clases.add(v);
        }
      }
      // Paternidad: `P.appendChild(C)` | `P.append(C1, C2, …)` | `P.insertBefore(C, ref)`
      if (ts.isCallExpression(n) && ts.isPropertyAccessExpression(n.expression) &&
          ts.isIdentifier(n.expression.expression)) {
        const metodo = n.expression.name.text;
        if (metodo === 'appendChild' || metodo === 'append' || metodo === 'insertBefore') {
          const padre = clave(n, n.expression.expression.text);
          const args = metodo === 'insertBefore' ? n.arguments.slice(0, 1) : n.arguments;
          for (const a of args) {
            if (ts.isIdentifier(a)) {
              if (!hijos.has(padre)) hijos.set(padre, []);
              hijos.get(padre).push(clave(a, a.text));
            }
          }
        }
      }
    });

    // ── Los pies: elementos cuya clase incluye `modal-footer` ─────────────────
    /** hijo → padre, para saber DENTRO de qué modal cuelga cada pie. */
    const padreDe = new Map();
    for (const [padre, lista] of hijos) for (const h of lista) if (!padreDe.has(h)) padreDe.set(h, padre);

    for (const [nombre, el] of elementos) {
      if (!el.clases.has('modal-footer')) continue;
      // El pie no siempre cuelga del modal: en customersView cuelga de un `<form>` que a su vez
      // cuelga del modal. Se sube por la cadena hasta dar con el contenedor que ES el modal.
      let claseDelModal = '';
      let estiloDelModal = '';
      let sube = padreDe.get(nombre);
      for (let salto = 0; sube && salto < 6; salto++) {
        const anc = elementos.get(sube);
        const c = anc ? [...anc.clases].join(' ') : '';
        if (esClaseDeModal(c)) { claseDelModal = c; estiloDelModal = anc.estilo || ''; break; }
        sube = padreDe.get(sube);
      }
      const propios = hijos.get(nombre) || [];
      const botones = [];
      let otros = 0;
      for (const h of propios) {
        const hijo = elementos.get(h);
        if (!hijo) { otros++; continue; }
        const esBoton = hijo.tag === 'button' || hijo.tag === 'a';
        if (!esBoton) { otros++; continue; }
        // El rótulo que decide el ancho es el MÁS LARGO que ese botón llega a mostrar.
        const etiqueta = hijo.etiquetas.reduce((a, b) => (b.length > a.length ? b : a), '');
        botones.push({
          tag: hijo.tag,
          clases: [...hijo.clases].join(' '),
          estilo: '',
          etiqueta,
          variantes: hijo.etiquetas.slice(),
        });
      }
      pies.push({
        fichero: ruta,
        linea: el.linea,
        origen: el.viaHelper === true ? 'helper' : 'createElement',
        estiloDelPie: '',
        clasesDelPie: [...el.clases].join(' '),
        claseDelModal,
        estiloDelModal,
        anidado: otros > 0,
        variable: nombre.split('|').pop(),
        botones,
        otrosHijos: otros,
      });
    }

    // ── Pies escritos como HTML dentro de plantillas ──────────────────────────
    // Los rótulos salen del texto RESUELTO (para leer los `${isEdit ? … : …}`); las líneas
    // salen del texto CRUDO, en el mismo orden de aparición.
    const lineasCrudas = lineasDePiesEnCrudo(texto);
    let iPie = 0;
    recorrer(sf, (n) => {
      if (!ts.isTemplateExpression(n) && !ts.isNoSubstitutionTemplateLiteral(n) && !ts.isStringLiteral(n)) return;
      const t = textoDePlantilla(n, constantes);
      if (!t || !t.includes('modal-footer')) return;
      // Si la plantilla es el `innerHTML` de un elemento, ESE es el contenedor: el modal no
      // está escrito dentro del HTML (customerDetailView lo crea a mano y le pone la clase y
      // un `max-width` en línea antes de rellenarlo).
      let contenedor = null;
      if (n.parent && ts.isBinaryExpression(n.parent) &&
          n.parent.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
          ts.isPropertyAccessExpression(n.parent.left) &&
          n.parent.left.name.text === 'innerHTML' &&
          ts.isIdentifier(n.parent.left.expression)) {
        contenedor = elementos.get(clave(n, n.parent.left.expression.text)) || null;
      }
      for (const p of piesEnHtml(t)) {
        const dentroDelHtml = claseDelModalQueEnvuelve(t, p.indice);
        pies.push({
          fichero: ruta,
          linea: lineasCrudas[iPie++] ?? linea(n),
          origen: 'plantilla',
          estiloDelPie: atributo(p.atributos, 'style'),
          clasesDelPie: atributo(p.atributos, 'class'),
          claseDelModal: dentroDelHtml || (contenedor ? [...contenedor.clases].join(' ') : ''),
          estiloDelModal: dentroDelHtml ? '' : (contenedor?.estilo || ''),
          anidado: /<div\b/i.test(p.interior),
          botones: botonesEnHtml(p.interior),
        });
      }
    });
  }

  pies.sort((a, b) => a.fichero.localeCompare(b.fichero) || a.linea - b.linea);
  for (const p of pies) {
    p.nBotones = p.botones.length;
    p.rotuloMasLargo = p.botones.reduce((a, b) => (b.etiqueta.length > a.length ? b.etiqueta : a), '');
    p.caracteresTotales = p.botones.reduce((a, b) => a + b.etiqueta.length, 0);
  }
  const porOrigen = pies.reduce((acc, p) => ({ ...acc, [p.origen]: (acc[p.origen] || 0) + 1 }), {});
  return { pies, porOrigen, ficheros: fuentes.length };
}

function esLlamadaCreate(llamada) {
  const e = llamada.expression;
  if (ts.isIdentifier(e) && e.text === 'createElement') return true;   // helper de la vista
  return ts.isPropertyAccessExpression(e) && e.name.text === 'createElement'; // document.createElement
}

/**
 * Declaraciones de una regla CSS de PRIMER NIVEL —los `@media` se saltan enteros— como mapa
 * propiedad → valor.
 *
 * Se parsea en vez de buscar el texto por dos razones, y las dos han estado a punto de morder:
 *   · el COMENTARIO que explica el arreglo de SCRUM-350 contiene la palabra `flex-wrap` — un
 *     guard de texto se cazaría a sí mismo y daría verde con la regla vacía;
 *   · `flex-wrap` declarado en OTRA regla (o dentro de un `@media`) no arregla el componente
 *     compartido, y un `includes()` no distingue una cosa de la otra.
 */
export function declaracionesDeRegla(css, selector) {
  const limpio = css.replace(/\/\*[\s\S]*?\*\//g, '');
  let ini = 0;
  for (let i = 0; i < limpio.length; i++) {
    if (limpio[i] !== '{') continue;
    const sel = limpio.slice(ini, i).trim();
    const cierre = finDeBloque(limpio, i);
    // Un `@media` se SALTA entero: `flex-wrap` puesto solo dentro de una media query dejaría
    // sin arreglar el componente fuera de ella, y este guard no debe darlo por bueno.
    if (!sel.startsWith('@') && sel.split(',').map((s) => s.trim()).includes(selector)) {
      return Object.fromEntries(
        limpio.slice(i + 1, cierre).split(';')
          .map((d) => d.split(':'))
          .filter((par) => par.length >= 2 && par[0].trim())
          .map((par) => [par[0].trim(), par.slice(1).join(':').trim()]),
      );
    }
    i = cierre;
    ini = i + 1;
  }
  return null;
}

function finDeBloque(css, abre) {
  let n = 1;
  for (let i = abre + 1; i < css.length; i++) {
    if (css[i] === '{') n++;
    else if (css[i] === '}' && --n === 0) return i;
  }
  return css.length;
}

/** Ficheros que el censo debe mirar, DERIVADOS del árbol (no una lista a mano). */
export function fuentesDeFront(fs, path, raiz) {
  const out = [];
  const anda = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) { anda(p); continue; }
      if (!/\.(js|html?)$/i.test(e.name)) continue;
      out.push({ ruta: path.relative(raiz, p).replace(/\\/g, '/'), texto: fs.readFileSync(p, 'utf8') });
    }
  };
  anda(path.join(raiz, 'public'));
  return out;
}

/**
 * Guard de COBERTURA: ficheros de código del repo que nombran `modal-footer`. Si alguno cae
 * fuera de lo que el censo mira, el censo está incompleto y hay que decirlo, no descubrirlo
 * cuando el pie se rompa en un móvil.
 */
export function ficherosQueNombranElPie(fs, path, raiz) {
  const IGNORA = new Set(['node_modules', 'dist', '.git', 'docs', 'tests', '.claude', 'coverage', '.next']);
  const out = [];
  const anda = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      if (IGNORA.has(e.name)) continue;
      const p = path.join(dir, e.name);
      if (e.isDirectory()) { anda(p); continue; }
      if (!/\.(js|mjs|cjs|ts|tsx|html?|css)$/i.test(e.name)) continue;
      if (fs.readFileSync(p, 'utf8').includes('modal-footer')) {
        out.push(path.relative(raiz, p).replace(/\\/g, '/'));
      }
    }
  };
  anda(raiz);
  return out.sort();
}
