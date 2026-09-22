// tests/_procedencia-aprobacion.mjs — SCRUM-921c (extraído de SCRUM-387, sin cambiarle nada)
//
// EL CENSO DE MARCAS DE APROBACIÓN EN COMENTARIOS DE CÓDIGO, PARAMETRIZABLE.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// POR QUÉ SE EXTRAE EN VEZ DE ESCRIBIR UN SEGUNDO CENSO
//
// SCRUM-921 midió que el caso conocido se le escapó a SCRUM-387 por DOS ejes a la vez: vivía en
// `tests/` (aquel sólo recorre `src` y `public`) y decía «el fundador DECIDE» (su marca es
// `aprobado por el fundador`). La fase c amplía los dos. La tentación era copiar su censo y
// tocarle los parámetros a la copia — y eso es justo la familia de defectos que esta casa
// persigue: dos censos del mismo hecho que se desincronizan en cuanto uno mejore.
//
// Es el mismo movimiento que ya hizo `_censo-escrituras-albaran.mjs` en SCRUM-878:
// `escriturasDeAlbaran` se quedó intacta en su firma y pasó a delegar en una versión general.
// Aquí igual: `scrum387-procedencia-aprobacion.test.mjs` sigue con SUS constantes y SU trinquete
// de 17, y lo único que ha cambiado es de dónde sale el código.
//
//     🔒 Un solo censo, dos preguntas.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// LO QUE ESTE MÓDULO NO PUEDE HACER, DICHO AQUÍ Y NO DESCUBIERTO EN UN ROJO RARO
//
// Lee comentarios con el parser de TypeScript, así que sólo sirve para `.ts`, `.js` y `.mjs`.
// **`docs/` queda fuera por construcción**: un `.md` no tiene comentarios que un AST pueda
// recoger. Esa mitad la cubre `_censo-firmas-autorizacion.mjs`, que lee texto por bloques.
// Son dos lectores porque son dos gramáticas, no por descuido.
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

/**
 * Los COMENTARIOS de un fuente, agrupados en bloques: `//` seguidos cuentan como uno solo.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────
 * 🔴 SE LEEN CON EL PARSER, NO CON `createScanner` A PELO — y no es una preferencia de estilo.
 *
 * SCRUM-814 (7-sep-2026) lo destapó al meter un `` tx.$executeRaw`… ${x} …` `` en
 * `quotesAdmin.routes.ts`. Un escáner suelto no sabe de gramática: ante un template literal CON
 * SUSTITUCIONES hace falta `reScanTemplateToken`, y sin eso se descarrila y deja de reconocer
 * los tokens siguientes. Medido sobre ese mismo fichero:
 *
 *     sin el template  → 143 comentarios vistos, 1 con marca de aprobación
 *     con el template  →  72 comentarios vistos, 0 con marca      ← CIEGO
 *
 * O sea: **toda marca de aprobación situada DESPUÉS del primer template con `${}` de su fichero
 * era invisible para este censo**. El modo de fallo es el peor posible: el número BAJA, y una
 * bajada se lee como una mejora. Lo cazó la mitad del trinquete que vigila las BAJADAS.
 *
 * El parser sí conoce la gramática. Se recogen los comentarios adheridos a cada nodo (delante y
 * detrás), deduplicando por posición.
 */
export function bloquesDeComentario(codigo, nombre) {
  const sf = ts.createSourceFile(nombre, codigo, ts.ScriptTarget.Latest, true);
  const porInicio = new Map();
  const recoger = (rangos) => {
    for (const r of rangos ?? []) {
      if (porInicio.has(r.pos)) continue;
      porInicio.set(r.pos, {
        texto: codigo.slice(r.pos, r.end),
        inicio: r.pos,
        fin: r.end,
        suelto: r.kind === ts.SyntaxKind.SingleLineCommentTrivia,
      });
    }
  };
  const visitar = (n) => {
    recoger(ts.getLeadingCommentRanges(codigo, n.getFullStart()));
    recoger(ts.getTrailingCommentRanges(codigo, n.getEnd()));
    // 🔴 sin `return`: `forEachChild` corta el recorrido en cuanto el callback devuelve truthy.
    ts.forEachChild(n, (h) => { visitar(h); });
  };
  visitar(sf);
  const trozos = [...porInicio.values()].sort((a, b) => a.inicio - b.inicio);
  // Unir los `//` consecutivos: la marca y su `(SCRUM-264)` suelen ir en líneas distintas del
  // mismo comentario, y separarlas convertiría una procedencia válida en un falso positivo.
  const bloques = [];
  for (const t of trozos) {
    const ult = bloques[bloques.length - 1];
    const entre = ult ? codigo.slice(ult.fin, t.inicio) : null;
    if (ult && ult.suelto && t.suelto && /^\s*$/.test(entre) && (entre.match(/\n/g) || []).length <= 1) {
      ult.texto += '\n' + t.texto; ult.fin = t.fin;
    } else {
      bloques.push({ ...t, fichero: nombre, linea: codigo.slice(0, t.inicio).split('\n').length });
    }
  }
  return bloques;
}

/** Los fuentes que este lector sabe leer, bajo `dir`. */
function ficheros(raiz, dir) {
  const out = [];
  const base = path.join(raiz, dir);
  if (!fs.existsSync(base)) return out;
  (function andar(d) {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) { if (e.name !== 'node_modules') andar(p); }
      else if (/\.(ts|js|mjs)$/.test(e.name)) out.push(p);
    }
  })(base);
  return out;
}

/**
 * @param {string} raiz
 * @param {{dirs:string[], marca:RegExp, procedencia:RegExp, excluir?:RegExp}} opciones
 * @returns {{conProcedencia:string[], sinProcedencia:string[], ficherosVistos:number, bloquesVistos:number}}
 */
export function censarProcedencia(raiz, { dirs, marca, procedencia, excluir }) {
  const conProcedencia = [];
  const sinProcedencia = [];
  let ficherosVistos = 0;
  let bloquesVistos = 0;
  for (const dir of dirs) {
    for (const f of ficheros(raiz, dir)) {
      const rel = path.relative(raiz, f).replace(/\\/g, '/');
      if (excluir?.test(rel)) continue;
      ficherosVistos += 1;
      const codigo = fs.readFileSync(f, 'utf8');
      if (!marca.test(codigo)) continue; // atajo barato; el parser solo corre donde puede haber algo
      for (const b of bloquesDeComentario(codigo, rel)) {
        bloquesVistos += 1;
        if (!marca.test(b.texto)) continue;
        const donde = `${b.fichero}:${b.linea}`;
        if (procedencia.test(b.texto)) conProcedencia.push(donde); else sinProcedencia.push(donde);
      }
    }
  }
  return { conProcedencia, sinProcedencia, ficherosVistos, bloquesVistos };
}

/**
 * LAS MARCAS, con su bloque y los literales que tienen debajo.
 *
 * `censarProcedencia` devuelve rutas y le basta. La fase c necesita además **el texto que la
 * marca dice aprobado**, porque el respaldo puede estar en el máster sin que el comentario lo
 * cite: para ir a buscarlo hace falta saber qué frase buscar. Los literales se toman de las
 * líneas siguientes al comentario, que es donde vive la constante que el comentario introduce.
 *
 * @returns {{fichero:string, linea:number, texto:string, literales:string[]}[]}
 */
export function marcasDe(raiz, { dirs, marca, excluir, literalesTras = 18 }) {
  const out = [];
  for (const dir of dirs) {
    for (const f of ficheros(raiz, dir)) {
      const rel = path.relative(raiz, f).replace(/\\/g, '/');
      if (excluir?.test(rel)) continue;
      const codigo = fs.readFileSync(f, 'utf8');
      if (!marca.test(codigo)) continue;
      const lineas = codigo.split(/\r?\n/);
      for (const b of bloquesDeComentario(codigo, rel)) {
        if (!marca.test(b.texto)) continue;
        const finBloque = codigo.slice(0, b.fin).split('\n').length;
        const trozo = lineas.slice(finBloque - 1, finBloque - 1 + literalesTras).join('\n');
        const literales = [];
        for (const re of [/'((?:[^'\\\n]|\\.){14,})'/g, /"((?:[^"\\\n]|\\.){14,})"/g, /`((?:[^`\\$]|\\.){14,})`/g]) {
          for (const m of trozo.matchAll(re)) literales.push(m[1].replace(/\\n/g, '\n').replace(/\\'/g, "'"));
        }
        out.push({ fichero: rel, linea: b.linea, texto: b.texto, literales: [...new Set(literales)] });
      }
    }
  }
  return out;
}
