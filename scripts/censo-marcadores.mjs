// scripts/censo-marcadores.mjs — el censo de marcadores de microcopy PENDIENTE, para aprobarlos.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// PARA QUÉ EXISTE, Y EN QUÉ SE DIFERENCIA DEL GUARD DE SCRUM-402
//
// `tests/scrum402-marcador-no-se-pinta.test.mjs` es un TRINQUETE: vigila que el número no suba.
// Para eso cuenta LITERALES que contienen la marca, y le sobra con eso.
//
// 🔴 Esto es otra pregunta: **¿cuántos rótulos VE un profesional?** Y no es el mismo número, ya
// medido en SCRUM-293 (③b): un bloque que factoriza la marca en una constante y la concatena tres
// veces cuenta UNO en el trinquete y pinta TRES en la pantalla. Aprobar microcopy con el número del
// trinquete dejaría textos sin aprobar fuera de la lista.
//
// Así que aquí se cuentan las DOS cosas por separado:
//   · MARCA ESCRITA  — un literal del código que contiene la marca.
//   · SUPERFICIE     — cada sitio donde ese texto acaba pintado. Una constante de marca no pinta
//                      nada por sí misma: pintan sus USOS.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// ALCANCE: TODO lo que un usuario puede ver, no solo el panel
//
// El trinquete mira `public/dashboard/js`. Aquí se barre además `public/` entero (landing, páginas
// legales, HTML suelto) y `src/` (correos, PDFs, respuestas de API), porque un marcador en el
// asunto de un correo lo lee un profesional igual que uno en un botón.
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

export const MARCA = '[PENDIENTE';

/** Las carpetas que se barren, con lo que significan para el censo. */
const AMBITOS = [
  { raiz: 'public/dashboard/js', ambito: 'panel', exts: ['.js'] },
  { raiz: 'public', ambito: 'publico', exts: ['.js', '.html'] },
  { raiz: 'src', ambito: 'servidor', exts: ['.ts'] },
];

function ficheros(dir, exts) {
  const salida = [];
  const recorrer = (d) => {
    let entradas;
    try { entradas = fs.readdirSync(d, { withFileTypes: true }); } catch { return; }
    for (const e of entradas) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) {
        if (e.name === 'node_modules' || e.name === '.git') continue;
        recorrer(p);
      } else if (exts.includes(path.extname(e.name))) {
        salida.push(p);
      }
    }
  };
  recorrer(dir);
  return salida.sort();
}

/** El nombre del contenedor sintáctico más cercano: da el CONTEXTO para clasificar el rótulo. */
function contenedor(nodo, sf) {
  let n = nodo.parent;
  while (n) {
    if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name)) return n.name.text;
    if (ts.isPropertyAssignment(n) && n.name && ts.isIdentifier(n.name)) return n.name.text;
    if ((ts.isFunctionDeclaration(n) || ts.isMethodDeclaration(n)) && n.name) return n.name.getText(sf) + '()';
    n = n.parent;
  }
  return '(suelto)';
}

/** La línea completa del fuente, recortada. Es lo que permite ver si es botón, título o cabecera. */
const lineaDe = (fuente, linea) => (fuente.split('\n')[linea - 1] ?? '').trim().slice(0, 200);

/**
 * Barrido de un fichero de código.
 * @returns {{marcas: Array, constantes: Map<string, object>}}
 */
function barrerCodigo(rutaRel, fuente) {
  const esTs = rutaRel.endsWith('.ts');
  const sf = ts.createSourceFile(path.basename(rutaRel), fuente, ts.ScriptTarget.Latest, true,
    esTs ? ts.ScriptKind.TS : ts.ScriptKind.JS);
  const marcas = [];
  const constantes = new Map(); // nombre → { linea } de las constantes cuyo valor ES la marca

  const visitar = (n) => {
    const trozos = ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)
      ? [n.text]
      : ts.isTemplateExpression(n)
        ? [n.head.text, ...n.templateSpans.map((s) => s.literal.text)]
        : [];
    for (const texto of trozos) {
      if (!texto.includes(MARCA)) continue;
      const linea = sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1;
      const soloLaMarca = /^\s*\[PENDIENTE[^\]]*\]\s*$/.test(texto);
      const nombre = contenedor(n, sf);

      // 🔴 «SOLO LA MARCA» NO SIGNIFICA «NO SE PINTA», y confundirlo fue mi primer error.
      //
      // Un literal que es únicamente la marca puede ser DOS cosas opuestas:
      //   · la CONSTANTE que otros concatenan  → no pinta nada por sí misma;
      //   · un `boton.textContent = '[PENDIENTE …]'` → pinta, y pinta A CIEGAS: el profesional ve
      //     un botón que no dice absolutamente nada de lo que hace.
      //
      // Lo decide el PADRE inmediato, no el nombre. Y la segunda es la urgente: con marca + texto
      // («[PENDIENTE …] Número») el rótulo al menos se puede leer y juzgar.
      const p = n.parent;
      const esDeclaracion = p && ts.isVariableDeclaration(p);
      const esAsignacionAPropiedad = p && ts.isBinaryExpression(p)
        && p.operatorToken.kind === ts.SyntaxKind.EqualsToken
        && ts.isPropertyAccessExpression(p.left);
      const clase = esDeclaracion ? 'constante'
        : soloLaMarca && esAsignacionAPropiedad ? 'pintado_a_ciegas'
          : soloLaMarca ? 'marca_sola_en_valor'
            : 'marca_con_texto';

      if (clase === 'constante') constantes.set(nombre, { linea });
      marcas.push({
        fichero: rutaRel,
        linea,
        contenedor: nombre,
        soloLaMarca,
        clase,
        propiedad: esAsignacionAPropiedad ? p.left.name.text : null,
        texto: texto.trim().slice(0, 160),
        codigo: lineaDe(fuente, linea),
      });
      break; // un nodo se cuenta una vez
    }
    ts.forEachChild(n, visitar);
  };
  visitar(sf);

  // ── Segunda pasada: los PRODUCTORES DE RÓTULO, y es TRANSITIVA a propósito ─────────────
  //
  // 🔴 EL NIVEL QUE SE ME ESCAPÓ AL PRIMER INTENTO, y lo destapó el Libro de emitidas: el fundador
  // ve el título, el subtítulo y TODAS las cabeceras marcadas, y el barrido contaba UNA superficie.
  // El motivo está en `libroRegistroView.js:43`:
  //
  //     function rotulo(t) { return MARCADOR + ' ' + t; }
  //
  // La constante no la pinta nadie directamente: la envuelve una FÁBRICA, y quien pinta son sus
  // llamadas. Contar solo las referencias a la constante da 1 donde hay una tabla entera.
  //
  // Así que «productor» se calcula por punto fijo: una constante o función es productora si su
  // valor o su cuerpo referencia a otra productora. Se itera hasta que deja de crecer.
  const productores = new Map([...constantes].map(([k, v]) => [k, v.linea]));
  for (let vuelta = 0; vuelta < 5; vuelta++) {
    const antes = productores.size;
    const mirar = (n) => {
      const declara = (nombre, nodo, linea) => {
        if (productores.has(nombre)) return;
        let tocado = false;
        const dentro = (x) => {
          if (ts.isIdentifier(x) && productores.has(x.text)) tocado = true;
          ts.forEachChild(x, dentro);
        };
        dentro(nodo);
        if (tocado) productores.set(nombre, linea);
      };
      const linea = () => sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1;
      if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && n.initializer) {
        declara(n.name.text, n.initializer, linea());
      }
      if (ts.isFunctionDeclaration(n) && n.name && n.body) declara(n.name.text, n.body, linea());
      ts.forEachChild(n, mirar);
    };
    mirar(sf);
    if (productores.size === antes) break;
  }

  // Una referencia es SUPERFICIE si no está dentro de la declaración de otro productor: ahí no
  // pinta, propaga. Se mide por línea de declaración, que basta para separar los dos casos.
  const lineasDeclaracion = new Set(productores.values());
  const usos = [];
  const visitarUsos = (n) => {
    if (ts.isIdentifier(n) && productores.has(n.text)) {
      const linea = sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1;
      if (!lineasDeclaracion.has(linea)) {
        usos.push({
          fichero: rutaRel, linea, productor: n.text,
          contenedor: contenedor(n, sf),
          codigo: lineaDe(fuente, linea),
        });
      }
    }
    ts.forEachChild(n, visitarUsos);
  };
  visitarUsos(sf);

  return { marcas, usos, productores: [...productores.keys()] };
}

/** Barrido de HTML: no hay AST, así que se busca la marca por línea. */
function barrerHtml(rutaRel, fuente) {
  const marcas = [];
  fuente.split('\n').forEach((linea, i) => {
    if (linea.includes(MARCA)) {
      marcas.push({
        fichero: rutaRel, linea: i + 1, contenedor: '(html)', soloLaMarca: false,
        texto: linea.trim().slice(0, 160), codigo: linea.trim().slice(0, 200),
      });
    }
  });
  return { marcas, usos: [] };
}

export function censar(raizProyecto) {
  const vistos = new Set();
  const marcas = [];
  const usos = [];
  let ficherosLeidos = 0;

  for (const { raiz, ambito, exts } of AMBITOS) {
    for (const abs of ficheros(path.join(raizProyecto, raiz), exts)) {
      const rel = path.relative(raizProyecto, abs).split(path.sep).join('/');
      if (vistos.has(rel)) continue;           // `public/dashboard/js` cae dentro de `public`
      vistos.add(rel);
      ficherosLeidos++;
      const fuente = fs.readFileSync(abs, 'utf8');
      if (!fuente.includes(MARCA)) continue;
      const r = rel.endsWith('.html') ? barrerHtml(rel, fuente) : barrerCodigo(rel, fuente);
      for (const m of r.marcas) marcas.push({ ...m, ambito });
      for (const u of r.usos) usos.push({ ...u, ambito });
    }
  }
  return { marcas, usos, ficherosLeidos };
}

// ── Salida ───────────────────────────────────────────────────────────────────────────────

const RAIZ = path.resolve(import.meta.dirname, '..');
const r = censar(RAIZ);

// 🔴 SUELO. Cero marcadores NO es «está todo aprobado»: es que el barrido se ha quedado ciego. El
// fundador acaba de ver varios con sus propios ojos, así que un cero aquí es un instrumento roto.
if (r.ficherosLeidos < 100) {
  console.error(`🔴 CIEGO: solo ${r.ficherosLeidos} ficheros leídos. El barrido no encuentra el árbol.`);
  process.exit(1);
}
if (r.marcas.length === 0) {
  console.error('🔴 CIEGO: CERO marcadores. Imposible — están a la vista en el producto. Arregla el barrido antes de creerte el cero.');
  process.exit(1);
}

const constantes = r.marcas.filter((m) => m.soloLaMarca);
const directas = r.marcas.filter((m) => !m.soloLaMarca);
const superficies = directas.length + r.usos.length;

console.log(JSON.stringify({
  resumen: {
    ficherosLeidos: r.ficherosLeidos,
    marcasEscritas: r.marcas.length,
    deEllasConstantes: constantes.length,
    deEllasDirectas: directas.length,
    usosDeConstantes: r.usos.length,
    superficiesPintadas: superficies,
    porAmbito: r.marcas.reduce((a, m) => ({ ...a, [m.ambito]: (a[m.ambito] ?? 0) + 1 }), {}),
    porFichero: r.marcas.reduce((a, m) => ({ ...a, [m.fichero]: (a[m.fichero] ?? 0) + 1 }), {}),
  },
  marcas: r.marcas,
  usos: r.usos,
}, null, 2));
