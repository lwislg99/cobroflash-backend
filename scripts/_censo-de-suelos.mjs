// scripts/_censo-de-suelos.mjs — SCRUM-940
//
// ═════════════════════════════════════════════════════════════════════════════════════════════
// 🔴 ¿CUÁNTOS SUELOS DE ESTA CASA PUEDEN DISPARARSE TODAVÍA?
//
// Un SUELO es la comprobación que protege la CONCLUSIÓN de un instrumento: si la población que ha
// mirado es demasiado pequeña, su cero no significa «está limpio» sino «no he mirado». Su fallo
// dice *no me fío de mi propia medida*, no *el sujeto está mal*.
//
// El problema que abre SCRUM-940 es que un suelo se escribe UNA VEZ, con la población de ese día,
// y la población crece. `SUELO_GUARDS = 20` se midió el 6-sep-2026 sobre 20 guards; hoy hay 83.
// Para que ese suelo hable habría que perder tres de cada cuatro. Ya no protege: acompaña.
//
// ⚠️ **ESTO NO AFIRMA QUE SEA UN PATRÓN.** Son dos casos conocidos y en el mismo fichero. Puede
// salir que la mayoría estén vivos, y ése sería el resultado. Se mide porque no se sabe.
//
// ── CÓMO SE RECONOCE UN SUELO · POR FORMA, NO POR NOMBRE ─────────────────────────────────────
//
// La forma es: **una MAGNITUD comparada contra un MÍNIMO, dentro de algo que aborta**. Pero eso
// solo, medido sobre el árbol, da 1.766 coincidencias — y ahí dentro está `buf.length > minBytes`
// y `html.length > 0`, que no protegen ninguna conclusión. Hace falta lo que distingue a un suelo
// de una aserción cualquiera sobre una longitud, y es SU SENTIDO. Se reconoce por CUALQUIERA de:
//
//   ① el mínimo es una constante declarada como suelo (`SUELO_*`, `MINIMO_*`, `*_MIN`, `PISO_*`);
//   ② su mensaje declara ceguera — «CIEGO», «no ha mirado», «no está midiendo», «no significa
//      nada», «no me fío», «no supe»… Es SEMÁNTICA declarada por quien lo escribió, no el nombre
//      de la variable;
//   ③ la comparación está en un `if` cuyo efecto es ABORTAR (`throw`, `process.exit(n≠0)`).
//
// El ① es una de tres señales, nunca la única: `if (n < 3) throw` no lleva constante y es un
// suelo, y `assert.ok(pobl.length > 0, '…CIEGO…')` tampoco.
//
// ⛔ NO EJECUTA NADA y no toca ningún suelo. Lo que mide el valor REAL va aparte, porque eso sí
//    exige correr (`docs/master/evidencias/scrum940/`).
// ═════════════════════════════════════════════════════════════════════════════════════════════
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const ts = require('typescript');

const EXT = new Set(['.mjs', '.js']);
const FUERA = new Set(['node_modules', '.git', 'dist', 'coverage', 'storage']);

/** Dónde se buscan instrumentos. `docs/` queda fuera: sus actas no protegen ninguna tanda. */
export const CARPETAS = ['tests', 'scripts'];

/**
 * Una magnitud: lo que un instrumento cuenta de su propia población.
 *
 * 🔴 NO BASTA CON EL SUFIJO `.length`, Y LO CAZÓ EL CONTROL POSITIVO. La primera versión exigía
 * que la magnitud acabara en `.length`/`.size`/…, y con eso `SUELO_GUARDS` —el caso conocido— NO
 * SALÍA: su comparación es `guards >= SUELO_GUARDS`, donde `guards` ya es el recuento, una
 * variable a secas. Un detector que sólo ve la forma larga pierde justo los suelos de los
 * instrumentos que ya contaron antes de comparar.
 *
 * Así que la magnitud es «el otro lado», y quien decide que esto es un suelo es el TOPE y el
 * sentido del mensaje, no cómo se llame la variable contada.
 */
const MAGNITUD_EVIDENTE = /\.(length|size|poblacion|total|ficheros|modulos|count|filas|lineas|casos|vistos|mirados)$/;

/** ① El mínimo viene de una constante que se declara como suelo. */
const NOMBRE_DE_SUELO = /^(SUELO|MINIMO|MIN|PISO)_|_(MINIMO|MIN|SUELO)$/;

/**
 * ② El mensaje declara CEGUERA: lo que separa «no me fío de mi medida» de «el sujeto está mal».
 *
 * 🔴 AFINADA TRAS MEDIR: la primera versión incluía la palabra «SUELO» suelta y «no vale nada», y
 * reconocía 749 de 759 — casi todo, porque ése es el vocabulario corriente de los mensajes de
 * esta casa. Un criterio que dice que sí a casi todo no separa nada. Se queda con los marcadores
 * que afirman que el INSTRUMENTO no ha podido mirar.
 */
const DICE_CEGUERA = /CIEGO|no ha mirado|no está mirando|no esta mirando|no está midiendo|no esta midiendo|no significa nada|no me fío|no me fio|no supe mirar|NO SUPE|no sabe mirar|no ha visto nada|no está leyendo|no esta leyendo|no llega al árbol|no llega al arbol|no está recorriendo|no esta recorriendo/i;

function ficherosDe(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (FUERA.has(e.name)) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) ficherosDe(p, out);
    else if (EXT.has(path.extname(e.name))) out.push(p);
  }
  return out;
}

/**
 * Las listas DECLARADAS A MANO del fichero (`const CONOCIDOS_AL_MEDIR = [...]`).
 *
 * 🔴 HACEN FALTA PARA NO ACUSAR EN FALSO, y lo cazó revisar a mano. Un suelo sobre
 * `CONOCIDOS_AL_MEDIR.length >= CENSO_MIN` con 7 contra 7 parece «AJUSTADO» —pegadísimo al real—
 * y NO es un defecto: esa magnitud no es una población que crezca con el árbol, es una lista que
 * alguien escribió, y estar pegado es justo el diseño («sólo se baja si un fichero se borró de
 * verdad, a propósito y con el motivo»). Tres de once de la primera muestra eran esto.
 *
 * Un suelo de población envejece solo; un trinquete sobre una lista fija, no.
 */
function listasFijasDe(sf) {
  const s = new Set();
  const rec = (n) => {
    if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && n.initializer) {
      const ini = n.initializer;
      const esLista = ts.isArrayLiteralExpression(ini)
        || (ts.isNewExpression(ini) && /^(Set|Map)$/.test(ini.expression.getText(sf)))
        || (ts.isCallExpression(ini) && /freeze$/.test(ini.expression.getText(sf)));
      if (esLista) s.add(n.name.text);
    }
    ts.forEachChild(n, rec);
  };
  ts.forEachChild(sf, rec);
  return s;
}

/** Las constantes numéricas del fichero, para resolver un mínimo que no es literal. */
function constantesDe(sf) {
  const m = new Map();
  const rec = (n) => {
    if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && n.initializer
      && ts.isNumericLiteral(n.initializer)) m.set(n.name.text, Number(n.initializer.text));
    ts.forEachChild(n, rec);
  };
  ts.forEachChild(sf, rec);
  return m;
}

/**
 * Los suelos de UNA fuente.
 *
 * @param {string} rel     con qué nombre se etiqueta el resultado (un literal vale: así se le
 *                         puede poner delante un caso conocido, SCRUM-846).
 * @param {string} fuente  el código, como texto.
 */
export function suelosDeFuente(rel, fuente, importadas = new Map()) {
  const sf = ts.createSourceFile(rel, fuente, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  const consts = constantesDe(sf);
  const listasFijas = listasFijasDe(sf);
  const hallados = [];

  const rec = (n) => {
    if (ts.isBinaryExpression(n)) {
      const op = n.operatorToken.kind;
      const MAYOR = [ts.SyntaxKind.GreaterThanEqualsToken, ts.SyntaxKind.GreaterThanToken];
      const MENOR = [ts.SyntaxKind.LessThanToken, ts.SyntaxKind.LessThanEqualsToken];
      if ([...MAYOR, ...MENOR].includes(op)) {
        // El TOPE es el lado que fija el mínimo: un número, o una constante (de aquí o importada).
        // La MAGNITUD es el otro, sea `x.length` o una variable ya contada.
        const esTope = (x) => ts.isNumericLiteral(x)
          || (ts.isIdentifier(x) && (consts.has(x.text) || NOMBRE_DE_SUELO.test(x.text)
            || importadas.has(x.text)));
        const izqTope = esTope(n.left) && !MAGNITUD_EVIDENTE.test(n.left.getText(sf));
        const derTope = esTope(n.right) && !MAGNITUD_EVIDENTE.test(n.right.getText(sf));
        if (izqTope !== derTope) {
          const tope = izqTope ? n.left : n.right;
          const magnitud = izqTope ? n.right : n.left;
          const izqMag = !izqTope;
          const nombreTope = ts.isIdentifier(tope) ? tope.text : null;
          const valor = ts.isNumericLiteral(tope) ? Number(tope.text)
            : nombreTope && consts.has(nombreTope) ? consts.get(nombreTope)
              : nombreTope && importadas.has(nombreTope) ? importadas.get(nombreTope) : null;

          // ── el contexto: ¿esto aborta algo, y qué dice al abortar? ──────────────────────
          let contexto = null, texto = '', abortaDuro = false;
          for (let q = n.parent; q; q = q.parent) {
            if (ts.isCallExpression(q) && /^assert/.test(q.expression.getText(sf))) {
              contexto = 'assert'; texto = q.getText(sf); break;
            }
            if (ts.isIfStatement(q)) {
              contexto = 'if'; texto = q.getText(sf);
              abortaDuro = /\bthrow\b|process\.exit\(\s*[1-9]/.test(texto);
              break;
            }
          }
          if (contexto) {
            const porNombre = !!(nombreTope && NOMBRE_DE_SUELO.test(nombreTope));
            const porMensaje = DICE_CEGUERA.test(texto);
            const porAborto = contexto === 'if' && abortaDuro;
            // Un reloj o una báscula tienen esta misma forma y no envejecen con el árbol.
            const esRelojOBascula = (nombreTope && ES_TIEMPO_O_TAMANO.test(nombreTope))
              || ES_TIEMPO_O_TAMANO.test(magnitud.getText(sf))
              || MAGNITUD_NO_CENSADA.test(magnitud.getText(sf));
            if ((porNombre || porMensaje || porAborto) && !esRelojOBascula) {
              const { line } = sf.getLineAndCharacterOfPosition(n.getStart(sf));
              hallados.push({
                fichero: rel,
                linea: line + 1,
                // El sentido: `poblacion >= MIN` exige un mínimo; `poblacion < MIN` lo niega.
                exigeMinimo: izqMag ? MAYOR.includes(op) : MENOR.includes(op),
                magnitud: magnitud.getText(sf).replace(/\s+/g, ' ').slice(0, 60),
                tope: nombreTope,
                declarado: valor,
                contexto,
                porNombre,
                porMensaje,
                porAborto,
                // Un suelo de `> 0` no declara cuánta población esperaba: sólo que hubiera alguna.
                esCeroEstricto: valor === 0,
                // ¿la magnitud es una LISTA ESCRITA A MANO? Entonces estar pegado no es defecto.
                // 🔴 SCRUM-940: `'\b'` DENTRO DE UNA CADENA es el escape de RETROCESO (0x08), no
                // `\`+`b`. Con eso la regex buscaba un carácter de control que ningún nombre lleva
                // y nunca casaba: la clase LISTA_FIJA no se alcanzaba nunca vía este detector. El
                // límite de palabra se escribe con `\\b` (dos caracteres) para que llegue como
                // `\b` al motor de regex.
                magnitudDeListaFija: [...listasFijas].some((n) => new RegExp('\\b' + n + '\\b').test(magnitud.getText(sf))),
              });
            }
          }
        }
      }
    }
    ts.forEachChild(n, rec);
  };
  ts.forEachChild(sf, rec);
  return hallados;
}

/**
 * 🔴 LO QUE NO ES UN SUELO DE POBLACIÓN, AUNQUE TENGA LA MISMA FORMA.
 *
 * Un tope de 20.000 junto a `.length` parece un suelo enorme y es un TIMEOUT en milisegundos; uno
 * de 5.000 es el tamaño de un PDF en bytes. Los cazó medir: en la primera muestra salieron suelos
 * «declarado=20000» que eran relojes y básculas. Ninguno envejece con la población del árbol, que
 * es el defecto de este ticket, así que no son el sujeto — y contarlos habría inflado el censo con
 * comparaciones que no pueden estar muertas porque nunca midieron una población.
 */
const ES_TIEMPO_O_TAMANO = /(TIMEOUT|TOPE_MS|_MS\b|MILIS|SEGUNDOS|BYTES|TAMANO|TAMAÑO|PESO|ANCHO|ALTO|_PX|PIXEL|DURACION|LATENCIA|CLS|LCP|FCP)/i;
/** Y por el lado de la magnitud: un búfer, un reloj o una medida de pantalla no son población. */
const MAGNITUD_NO_CENSADA = /^(buf|buffer|html|texto|cuerpo|contenido|body|svg|css|json|xml|raw|salida|stdout|stderr)\b|Date\.now|performance\.|\.width|\.height|duracion|elapsed|ms\b/i;

/** ¿Este fichero es un INSTRUMENTO? Lee un sujeto y produce un agregado (criterio de SCRUM-927). */
function esInstrumento(fuente) {
  return /readdirSync|readFileSync|globSync|execFileSync\(\s*['"]git/.test(fuente)
    && /\.length|\.size|reduce\(|filter\(|new Map\(|new Set\(/.test(fuente);
}

/**
 * Censa los suelos del árbol. Devuelve LAS DOS CIFRAS —instrumentos mirados y cuántos tienen
 * suelo— y la tercera categoría, que es la que nadie cuenta:
 *
 *   🔒 Un instrumento sin suelo no está mal calibrado: está desnudo.
 */
export function censarSuelos(raiz) {
  const abs = path.resolve(raiz);
  const rel = (p) => path.relative(abs, p).split(path.sep).join('/');
  const todos = CARPETAS.flatMap((c) => ficherosDe(path.join(abs, c)));

  // 🔴 Las constantes de TODO el árbol, para resolver un tope que vive en otro módulo.
  // `SUELO_DECLARACIONES` se declara en `scripts/meta-guard-mutaciones.mjs` y se usa en dos tests
  // que lo importan: sin esto salía con `declarado: null` —o sea NO DECIDIBLE— siendo uno de los
  // dos casos que este ticket viene a confirmar. Lo cazó el control positivo.
  const globales = new Map();
  const fuentes = new Map();
  for (const p of todos) {
    const fuente = fs.readFileSync(p, 'utf8');
    fuentes.set(p, fuente);
    const sf = ts.createSourceFile(rel(p), fuente, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
    for (const [k, v] of constantesDe(sf)) {
      // 🔴 SÓLO MAYÚSCULAS. Meter aquí cualquier `const guards = 5` de cualquier fichero hacía que
      // en `guards >= SUELO_GUARDS` **los dos lados** parecieran tope, y la comparación se
      // descartaba: por eso `SUELO_GUARDS` —uno de los dos casos conocidos— no salía. Un tope de
      // gobierno se escribe en mayúsculas en esta casa; una variable contada, no.
      if (k !== k.toUpperCase()) continue;
      // Si dos módulos declaran el mismo nombre con valores distintos, no se puede resolver a
      // ciegas: se marca como ambiguo y cae del lado malo (NO DECIDIBLE).
      if (globales.has(k) && globales.get(k) !== v) globales.set(k, null);
      else if (!globales.has(k)) globales.set(k, v);
    }
  }

  const suelos = [];
  const instrumentos = [];
  for (const p of todos) {
    const fuente = fuentes.get(p);
    const r = rel(p);
    const s = suelosDeFuente(r, fuente, globales);
    if (s.length) suelos.push(...s);
    if (esInstrumento(fuente)) instrumentos.push({ fichero: r, suelos: s.length });
  }
  return {
    ficheros: todos.length,
    instrumentos: instrumentos.length,
    conSuelo: instrumentos.filter((i) => i.suelos > 0).length,
    desnudos: instrumentos.filter((i) => i.suelos === 0),
    suelos,
    // Los que declaran un mínimo concreto (>0) son los únicos cuyo cociente se puede juzgar.
    conMinimoConcreto: suelos.filter((s) => s.declarado !== null && s.declarado > 0),
    soloExigenAlguno: suelos.filter((s) => s.esCeroEstricto),
    sinValorResoluble: suelos.filter((s) => s.declarado === null),
  };
}

/**
 * 🔴 EL SUELO DEL PROPIO CENSO. Hay al menos dos suelos medidos en esta casa (`SUELO_GUARDS` y
 * `SUELO_DECLARACIONES`): si este barrido no encuentra ninguno, no está mirando el árbol.
 */
export function motivosParaNoFiarse(censo) {
  const m = [];
  if (!censo.ficheros) m.push('CERO ficheros: no hay población que mirar.');
  if (!censo.suelos.length) {
    m.push('CERO suelos en todo el árbol. Hay al menos dos medidos (`SUELO_GUARDS`, '
      + '`SUELO_DECLARACIONES`): si no se ven, el detector no reconoce la forma que busca.');
  } else if (!censo.conMinimoConcreto.length) {
    m.push('NINGÚN suelo con un mínimo concreto: sin eso no hay cociente que juzgar.');
  }
  return m;
}

/**
 * La clasificación, dado el valor REAL de hoy. El cociente decide, no el valor suelto.
 *
 *   · VIVO ......... el real está dentro del alcance del suelo: un borrado grande lo dispara.
 *   · MUERTO ....... el real es tan alto que habría que perder media población o más.
 *   · AJUSTADO ..... el real está tan pegado al declarado que salta con el primer borrado
 *                    legítimo. **Es el defecto CONTRARIO, y también es un defecto**: un guard que
 *                    salta sin motivo se acaba apagando.
 *   · NO_DECIDIBLE . no se pudo obtener el real. No es «está bien»: es que no se sabe.
 */
export function clasificar(declarado, real, magnitudDeListaFija = false) {
  if (real === null || real === undefined || declarado === null) return 'NO_DECIDIBLE';
  if (real <= 0) return 'NO_DECIDIBLE';
  const cociente = declarado / real;
  // Un trinquete sobre una lista escrita a mano está pegado A PROPÓSITO: no es un suelo ajustado.
  if (cociente >= 0.9) return magnitudDeListaFija ? 'LISTA_FIJA' : 'AJUSTADO';
  if (cociente <= 0.5) return 'MUERTO';
  return 'VIVO';
}
