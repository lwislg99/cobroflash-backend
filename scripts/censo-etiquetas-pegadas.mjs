#!/usr/bin/env node
// scripts/censo-etiquetas-pegadas.mjs — SCRUM-553
//
// ═════════════════════════════════════════════════════════════════════════════════════════
// EL DEFECTO, Y POR QUE UN CENSO Y NO UN BARRIDO
// ═════════════════════════════════════════════════════════════════════════════════════════
//
// Un extractor que busca `<section class="hero">` con el `>` PEGADO deja de encontrar la
// etiqueta en cuanto alguien le añade un `id`, un `aria-*` o una clase. El disparador es
// siempre benigno —marcado correcto— y el que asume de mas es el extractor.
//
// Paso cuatro veces en una semana. Las dos ultimas: `_cifras-heroe.mjs` buscando
// `<section class="hero">` (cayeron los 4 tests de SCRUM-331 declarandose ciegos, y eso
// estuvo BIEN) y `scrum331-heroe.test.mjs` buscando `<h1>` despues de que SCRUM-543 le
// pusiera `id="reg-hero"` — ese cayo por «no se pudo leer», que parece cambio de copy cuando
// es cambio de marcado. Ese es el peor modo.
//
// 🔴 LA MEDICION QUE DECIDE QUE SE HACE (20-ago-2026): son 32 en 21 ficheros, no cuatro. Y de
// las 32, NINGUNA da verde al no encontrar nada — todas se declaran ciegas o lanzan. O sea que
// el problema medido no es «hay guards mintiendo»: es «hay 27 ocurrencias leyendo marcado vivo
// que se van a romper una a una cada vez que alguien toque una pagina».
//
// Con esos numeros, un barrido de 27 sitios a mano es justo la clase de cambio que introduce
// el defecto numero 5. Lo que este fichero hace es un TRINQUETE: cuenta, y cae si el numero
// SUBE, nombrando la ocurrencia nueva. La quinta vez deja de ser silenciosa.
//
// ═════════════════════════════════════════════════════════════════════════════════════════
// 🔴 EL HALLAZGO QUE SALIO DE PROBARLO SOBRE DISCO, Y CORRIGE EL ENCUADRE DEL TICKET
// ═════════════════════════════════════════════════════════════════════════════════════════
//
// La pregunta era «¿cual de estos extractores DA VERDE cuando no encuentra nada?». Medido:
// NINGUNO. Todos se declaran ciegos o lanzan. Pero al inyectar el disparador real —añadir
// `defer` a UNA etiqueta `<script src>` de `public/dashboard/index.html`, que es marcado
// perfectamente correcto— sale el peligro de verdad, y no es el que se buscaba:
//
//   · perdida TOTAL (60 -> 0 etiquetas): los suelos SI disparan. `dashboard-colision` y
//     `scrum417` caen declarandose ciegos. Molesto y honesto.
//   · perdida de UNA (60 -> 59): **16/16 EN VERDE**. `jobCobroHuecos.js` deja de estar
//     vigilado por los dos guards y ninguno dice una palabra.
//
// EL MOTIVO, medido: los suelos son UMBRALES CON HOLGURA. `dashboard-colision` exige >= 25
// sobre 60 (35 de holgura) y `scrum417` exige >= 40 sobre 60 (20 de holgura). Un umbral con
// veinte de margen no puede ver que se ha perdido una etiqueta — y perder UNA es exactamente
// lo que produce el disparador benigno de este ticket.
//
// O sea que el `>` pegado no da verdes falsos por si solo: los da EN COMBINACION con un suelo
// de umbral. Cerrar eso es fijar el recuento EXACTO donde la poblacion es estable, en vez de
// un `>=` generoso. Es otro mecanismo y otro carril: queda REPORTADO, no construido aqui.
//
// LA FORMA CORRECTA cuando se arregla una, y es la convencion que ya dejo SCRUM-543:
//     ANTES:  /<h1>([\s\S]*?)<\/h1>/          ← el `>` pegado
//     DESPUES:/<h1[^>]*>([\s\S]*?)<\/h1>/     ← tolera atributos, y lo vigilado sigue siendo
//                                               el TEXTO del h1
// Aceptar `<h1 id="x">` NO puede convertirse en aceptar cualquier cosa: se tolera el hueco de
// los atributos y NADA MAS.
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
// SCRUM-567 · `typescript` YA es devDependency (es lo que compila el proyecto), asi que esto
// no es una dependencia nueva. Y es lo que manda la propia skill `cerebro-yaqu`: «para
// vigilar codigo, analisis estatico del arbol (AST), no `grep`».
import ts from 'typescript';

/** Nombres de etiqueta HTML: son las que alguien edita y a las que se les añaden atributos. */
export const ETIQUETAS_HTML = new Set(('html,head,body,title,meta,link,script,style,section,div,'
  + 'span,p,a,ul,ol,li,h1,h2,h3,h4,h5,h6,header,footer,nav,main,aside,article,figure,figcaption,'
  + 'table,thead,tbody,tfoot,tr,td,th,caption,form,input,button,label,select,option,textarea,'
  + 'fieldset,legend,img,svg,path,dialog,details,summary,strong,b,i,em,small,code,pre,blockquote,'
  + 'br,hr,iframe,canvas,video,audio,source,time,mark,sup,sub,output,progress,meter,template,'
  + 'picture,object').split(','));

const ETIQUETA = /<([a-z][a-z0-9]{0,12})((?:[^<>\n]){0,100}?)>/g;
/** Construcciones que YA dejan hueco a los atributos. */
const TOLERA = [/\[\^>\]/, /\.\*/, /\[\\s\\S\]/, /\\s\*/];

/* ══════════════════════════════════════════════════════════════════════════════════════════
   SCRUM-567 · SE DECIDE POR POSICION, NO POR LO QUE HAYA EN LA LINEA

   Un extractor BUSCA en un documento. Un fixture lo CONSTRUYE. Los dos escriben `<td>` igual,
   asi que mirar el texto no los distingue — y este censo alimenta un TRINQUETE, o sea que su
   ruido no solo ensucia el numero: **gasta el margen**, y cuando alguien arregle extractores de
   verdad el numero no bajara lo que deberia. La salida comoda seria subir el tope, y un
   trinquete que se ajusta cuando molesta deja de ser un trinquete.

   ── LAS DOS HEURISTICAS QUE HABIA, Y LAS DOS MENTIAN ────────────────────────────────────────
   ① `USO_EXTRACTOR` miraba si en la LINEA habia `.replace(` (o similar). Pero en
      `x.replace(A, B)` solo A busca: B es dato que se construye. Los literales del segundo
      argumento contaban como extractores. Es lo que S3 reporto tres veces.
   ② `enRegex` intentaba ver si el literal estaba dentro de una expresion regular con
      `/\/[^/\n]*<[a-z]/` sobre lo que iba delante. Eso se dispara con CUALQUIER etiqueta de
      cierre anterior en la linea: en `'<tr><td>Mano de obra</td><td>2.5</td>'` el `</td>` es
      `/` + texto + `<`, o sea que ocho fixtures de tabla pasaban por extractores.

   Medido: 29 aciertos = 16 extractores + 13 ruido. Las 29 lineas se abrieron UNA A UNA y la
   clasificacion del AST coincidio con la lectura en las 29. (Aviso de SCRUM-566: un criterio
   lexico sobre texto miente mas de lo que parece — por eso se verifico abriendo, no contando.)

   ── EL CRITERIO ─────────────────────────────────────────────────────────────────────────────
   El literal cuenta SOLO si esta en POSICION DE BUSQUEDA:
     · dentro de un literal de expresion regular, o
     · en el PRIMER argumento de un metodo cuyo primer argumento es la aguja, o
     · en el primer argumento de `new RegExp(...)`.
   Todo lo demas es dato. No hay lista de nombres que ignorar: el siguiente fixture no se cuela
   porque no esta en posicion de busqueda, no porque alguien se acuerde de apuntarlo.
   ══════════════════════════════════════════════════════════════════════════════════════════ */

/**
 * Metodos cuyo PRIMER argumento es la AGUJA.
 *
 * ⚠️ `test` NO esta, y no es un olvido: en `re.test(hay)` el primer argumento es el PAJAR.
 *    Incluirlo habria marcado el documento entero como «lo que se busca» y dado por extractor
 *    cualquier literal de esa llamada — el error contrario al que este ticket viene a quitar.
 */
export const BUSCADORES = new Set(['match', 'matchAll', 'includes', 'indexOf', 'lastIndexOf',
  'split', 'replace', 'replaceAll', 'search', 'startsWith', 'endsWith']);

/**
 * Los tramos del fuente que son POSICION DE BUSQUEDA, sacados del arbol.
 *
 * 🔴 SUELO: si el fichero no se puede parsear, se LANZA. Devolver «sin tramos» diria «aqui no
 *    hay extractores», que es la conclusion comoda y la contraria a la verdad.
 */
export function rangosDeBusqueda(fuente, rel) {
  const sf = ts.createSourceFile(rel, fuente, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);

  // 🔴 EL SUELO, Y NO ESTABA DONDE YO CREIA. `createSourceFile` **no lanza** ante un fichero
  //    roto: se recupera y devuelve un arbol PARCIAL. O sea que la version anterior de este
  //    suelo no existia — un fichero ilegible habria salido con cero tramos, y cero tramos se
  //    lee como «aqui no hay extractores», la conclusion comoda. Lo canto su propio control.
  //    El parser SI deja los errores en `parseDiagnostics`, y eso es lo que se mira.
  const errores = sf.parseDiagnostics || [];
  if (errores.length) {
    throw new Error('🔴 NO SUPE PARSEAR ' + rel + ': ' + ts.flattenDiagnosticMessageText(errores[0].messageText, ' ')
      + ' — un fichero que no se puede leer NO es un fichero limpio.');
  }

  const out = [];
  const anda = (n) => {
    if (ts.isRegularExpressionLiteral(n)) out.push([n.getStart(sf), n.getEnd()]);
    else if (ts.isCallExpression(n) && n.arguments.length) {
      const e = n.expression;
      const nombre = ts.isPropertyAccessExpression(e) ? e.name.text : null;
      if (nombre && BUSCADORES.has(nombre)) out.push([n.arguments[0].getStart(sf), n.arguments[0].getEnd()]);
    } else if (ts.isNewExpression(n) && ts.isIdentifier(n.expression) && n.expression.text === 'RegExp'
      && n.arguments && n.arguments.length) {
      out.push([n.arguments[0].getStart(sf), n.arguments[0].getEnd()]);
    }
    ts.forEachChild(n, anda);
  };
  anda(sf);
  // En `html.matchAll(/re/g)` el MISMO tramo entra dos veces —como literal de expresion regular
  // y como primer argumento de un buscador— y sin esto cada etiqueta se contaria dos veces.
  return [...new Map(out.map((r) => [r[0] + ':' + r[1], r])).values()];
}

/**
 * ¿Es este `>` el de la etiqueta?
 *
 * 🔴 NO SIEMPRE, Y ES LA TRAMPA DE ESTA MEDICION. En `<h3[^>]*>` el primer `>` esta DENTRO de
 * la clase negada, asi que el hueco capturado es `[^` y ninguna marca de TOLERA casa: la
 * primera version de este censo conto como «pegados» justo los patrones que YA toleran
 * atributos, e inflo el numero a 50. Si el hueco deja un `[` sin cerrar, ese `>` no es el de
 * la etiqueta.
 */
export function elMayorEsDeLaEtiqueta(hueco) {
  const abre = (hueco.match(/\[/g) || []).length;
  const cierra = (hueco.match(/\]/g) || []).length;
  return abre <= cierra;
}

/**
 * Ocurrencias de una etiqueta de apertura escrita con el `>` pegado EN POSICION DE BUSQUEDA.
 *
 * Se recorren los TRAMOS que el arbol dice que buscan, no las lineas. Los comentarios quedan
 * fuera solos —no son nodos— sin necesidad de la regla que los excluia a mano.
 */
export function pegadasEn(fuente, rel) {
  const out = [];
  const lineaDe = (off) => fuente.slice(0, off).split('\n').length;
  for (const [a, b] of rangosDeBusqueda(fuente, rel)) {
    const trozo = fuente.slice(a, b);
    for (const m of trozo.matchAll(ETIQUETA)) {
      if (!elMayorEsDeLaEtiqueta(m[2])) continue;
      if (TOLERA.some((re) => re.test(m[2]))) continue;
      const linea = lineaDe(a + m.index);
      out.push({
        fichero: rel, linea, tag: m[1], etiqueta: m[0].slice(0, 60),
        html: ETIQUETAS_HTML.has(m[1]),
        texto: (fuente.split('\n')[linea - 1] || '').trim().slice(0, 115),
      });
    }
  }
  return out;
}

function ficherosDe(dir) {
  const out = [];
  const anda = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) anda(p);
      else if (/\.(mjs|js)$/.test(e.name)) out.push(p);
    }
  };
  anda(dir);
  return out;
}

export const ZONAS = ['tests', 'scripts'];

/**
 * 🔴 LA TRAMPA DE AUTORREFERENCIA, que en este repo ya ha mordido cinco veces
 * (SCRUM-176/168/3/193 y ésta). Este censo y su test tienen que ESCRIBIR los patrones malos
 * para explicarlos y para probarse a sí mismos: el corpus sintético de
 * `pegadasEn('…/<section class="hero">/…')` es exactamente lo que el censo busca, así que se
 * contaba a sí mismo y subía el número de 29 a 40.
 *
 * Se excluyen los DOS ficheros del propio mecanismo, y sólo esos. No es una lista de
 * excepciones que pueda crecer: el test comprueba que son exactamente estos dos y que sin la
 * exclusión el número cambia — o sea que la exclusión ampara algo real y nada más.
 */
export const AUTORREFERENCIA = [
  'scripts/censo-etiquetas-pegadas.mjs',
  'tests/scrum553-etiquetas-pegadas.test.mjs',
];

export function censar(raiz, { incluirAutorreferencia = false } = {}) {
  const todas = [];
  let leidos = 0;
  for (const zona of ZONAS) {
    for (const abs of ficherosDe(path.join(raiz, zona))) {
      leidos += 1;
      const rel = path.relative(raiz, abs).replace(/\\/g, '/');
      if (!incluirAutorreferencia && AUTORREFERENCIA.includes(rel)) continue;
      todas.push(...pegadasEn(fs.readFileSync(abs, 'utf8'), rel));
    }
  }
  const html = todas.filter((h) => h.html);
  return {
    leidos,
    html,
    otros: todas.filter((h) => !h.html),
    ficheros: [...new Set(html.map((h) => h.fichero))].sort(),
  };
}

// ── CLI ──────────────────────────────────────────────────────────────────────────────────
if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  const r = censar(process.cwd());
  console.log('ficheros leídos ................... ' + r.leidos);
  console.log('🔴 etiquetas HTML con el `>` pegado  ' + r.html.length + '  en ' + r.ficheros.length + ' ficheros');
  console.log('   XML/otros (VeriFactu, etc.) ..... ' + r.otros.length);
  const porFichero = {};
  for (const h of r.html) (porFichero[h.fichero] ??= []).push(h);
  for (const [f, hs] of Object.entries(porFichero).sort((a, b) => b[1].length - a[1].length)) {
    console.log('   ' + String(hs.length).padStart(2) + '  ' + f);
    for (const h of hs) console.log('        :' + h.linea + '  ' + h.etiqueta);
  }
}
