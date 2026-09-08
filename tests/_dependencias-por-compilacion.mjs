// tests/_dependencias-por-compilacion.mjs — SCRUM-664 · EL COMPILADOR COMO CENSO.
//
// ═════════════════════════════════════════════════════════════════════════════════════════
// QUÉ CONTESTA, Y POR QUÉ NO LO CONTESTA UN CENSO POR AST
//
// Pregunta: **¿quién depende de este símbolo?** No «quién lo nombra en esta llamada», que es lo
// que un recorrido sintáctico sabe contestar, sino quién se rompería si el símbolo dejara de
// existir — esté donde esté, y aunque el uso viva dentro de otra función.
//
// 🔴 NO ES UNA MEJORA TEÓRICA: ESTÁ MEDIDO, Y COSTÓ (SCRUM-646)
//
// Un censo por AST de las escrituras de IVA en el alta del catálogo devolvió **UN** sitio.
// Había **TRES**. El tercero era `tax: vat` dentro de un `.map`, así que la propiedad **no
// estaba sintácticamente dentro de la llamada a Prisma** y el recorrido no la alcanzaba.
//
// **Lo cazó el COMPILADOR**: al retirar la variable, `tsc` dijo «Cannot find name 'vat'».
//
// Es el reverso del defecto nº 8 de la casa: dos instrumentos que fallan en el mismo sentido se
// confirman falsamente; dos que fallan por motivos DISTINTOS se corrigen. El AST mira posición;
// el compilador resuelve ligaduras. Por eso el censo por AST no vuelve a usarse solo cuando el
// compilador puede opinar sobre lo mismo.
//
// ═════════════════════════════════════════════════════════════════════════════════════════
// 🔴 LOS DOS CÓDIGOS, Y POR QUÉ SON DOS — medido, no supuesto
//
// Al retirar `const vat`, el compilador NO usa un solo código para decir «ese nombre no existe»:
//
//     { name: 'x', vat }        → **18004**  «No value exists in scope for the shorthand
//                                             property 'vat'»
//     { name: 'y', vat: vat }   → **2304**   «Cannot find name 'vat'»
//     { tax: vat } (en `.map`)  → **2304**
//
// Un filtro que sólo mirara 2304 habría contado DOS de tres — y se habría perdido justo el
// ATAJO, que es la forma más corta de escribir la propiedad. Este instrumento habría nacido con
// el mismo punto ciego que existe para denunciar. Los dos códigos van declarados y atados.
// ═════════════════════════════════════════════════════════════════════════════════════════
import ts from 'typescript';

const VIRTUAL = 'archivo.ts';

/**
 * Los códigos con los que el compilador dice «ese nombre no existe». Son DOS: ver la cabecera.
 * No se derivan de nada — se midieron y se escriben aquí, y `scrum664` ata que sigan siendo dos.
 */
export const CODIGOS_NOMBRE_AUSENTE = Object.freeze([
  2304,  // Cannot find name 'X'.
  18004, // No value exists in scope for the shorthand property 'X'.
]);

/**
 * Compila UNA fuente en memoria y devuelve sus diagnósticos semánticos.
 *
 * `noLib` y `noResolve` a propósito: no se quiere type-checkear el proyecto, se quiere resolver
 * NOMBRES en este fichero. Eso produce ruido de otros códigos (`Property 'map' does not exist`),
 * y por eso todo lo de abajo filtra por CÓDIGO y por NOMBRE, nunca por «hay errores».
 */
function diagnosticosDe(fuente) {
  const sf = ts.createSourceFile(VIRTUAL, fuente, ts.ScriptTarget.Latest, true);
  const host = {
    getSourceFile: (n) => (n === VIRTUAL ? sf : undefined),
    getDefaultLibFileName: () => 'lib.d.ts',
    writeFile: () => {},
    getCurrentDirectory: () => '/',
    getDirectories: () => [],
    getCanonicalFileName: (f) => f,
    useCaseSensitiveFileNames: () => true,
    getNewLine: () => '\n',
    fileExists: (n) => n === VIRTUAL,
    readFile: (n) => (n === VIRTUAL ? fuente : undefined),
  };
  const programa = ts.createProgram([VIRTUAL], {
    noResolve: true, noLib: true, noEmit: true, types: [], target: ts.ScriptTarget.Latest,
  }, host);
  return { sf, diags: programa.getSemanticDiagnostics(sf) };
}

/** Los sitios donde el compilador echa en falta `simbolo`, con su línea y su código. */
function faltaEl(fuente, simbolo) {
  const { sf, diags } = diagnosticosDe(fuente);
  const out = [];
  for (const d of diags) {
    if (!CODIGOS_NOMBRE_AUSENTE.includes(d.code)) continue;
    const texto = ts.flattenDiagnosticMessageText(d.messageText, ' ');
    // El nombre va entre comillas simples en los dos mensajes. Se compara el NOMBRE, no se busca
    // la subcadena: `vat` casaría dentro de `defaultVat` y contaríamos de más.
    const m = /'([^']+)'/.exec(texto);
    if (!m || m[1] !== simbolo) continue;
    const { line } = sf.getLineAndCharacterOfPosition(d.start);
    out.push({ linea: line + 1, codigo: d.code, texto });
  }
  return out;
}

/** La sentencia completa que declara `simbolo` como variable, o `null`. Por AST, a cualquier profundidad. */
function sentenciaQueDeclara(fuente, simbolo) {
  const sf = ts.createSourceFile(VIRTUAL, fuente, ts.ScriptTarget.Latest, true);
  let hallada = null;
  const visita = (n) => {
    if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && n.name.text === simbolo) {
      const sentencia = ts.findAncestor(n, ts.isVariableStatement);
      if (sentencia && !hallada) hallada = { inicio: sentencia.getStart(sf), fin: sentencia.getEnd() };
    }
    ts.forEachChild(n, visita);
  };
  visita(sf);
  return hallada;
}

/**
 * ¿QUIÉN DEPENDE DE `simbolo` EN ESTA FUENTE? Se retira su declaración y se le pregunta al
 * compilador. Lo que conteste es la respuesta: el compilador no tiene opinión sobre dónde está
 * escrita la propiedad, sólo sobre si el nombre se resuelve.
 *
 * @returns {{
 *   declarado: boolean,   // ¿existía siquiera la declaración? `false` NO es «no hay usos».
 *   usos: {linea:number, codigo:number, texto:string}[],
 *   ciego: string|null,   // motivo por el que la respuesta NO es de fiar, o `null`.
 * }}
 */
export function dependenciasDe(fuente, simbolo) {
  // 🔴 SUELO. Si la fuente TAL CUAL ya se queja de ese nombre, lo que salga después de retirar la
  // declaración no se le puede atribuir a la retirada. «No hay dependencias» y «no supe mirar»
  // son el mismo cero con significados opuestos, así que aquí se separan.
  const previos = faltaEl(fuente, simbolo);
  if (previos.length) {
    return {
      declarado: false,
      usos: [],
      ciego: `la fuente SIN TOCAR ya echa en falta \`${simbolo}\` en ${previos.length} sitio(s) `
        + `(línea(s) ${previos.map((p) => p.linea).join(', ')}). No se puede atribuir nada a la retirada.`,
    };
  }

  const decl = sentenciaQueDeclara(fuente, simbolo);
  if (!decl) {
    return {
      declarado: false,
      usos: [],
      ciego: `no hay ninguna declaración de \`${simbolo}\` que retirar. Esto NO significa que no `
        + 'haya dependencias: significa que este instrumento no tiene por dónde empezar.',
    };
  }

  const sinDeclaracion = fuente.slice(0, decl.inicio) + fuente.slice(decl.fin);
  return { declarado: true, usos: faltaEl(sinDeclaracion, simbolo), ciego: null };
}

/**
 * El censo POR AST con el que se compara: propiedades `campo: <identificador>` que están
 * SINTÁCTICAMENTE dentro de una llamada `prisma.<lo que sea>.<create|createMany|update|upsert>`.
 *
 * No es un hombre de paja: es la clase de recorrido que devolvió UNO de los tres sitios. Vive
 * aquí para que la comparación entre los dos instrumentos se pueda ejecutar, no sólo contar.
 */
export function escriturasEnLlamadaPrisma(fuente, campos) {
  const sf = ts.createSourceFile(VIRTUAL, fuente, ts.ScriptTarget.Latest, true);
  const out = [];
  const dentroDePrisma = (n) => !!ts.findAncestor(n, (a) => {
    if (!ts.isCallExpression(a)) return false;
    return /^prisma\./.test(a.expression.getText(sf));
  });
  const visita = (n) => {
    const esAtajo = ts.isShorthandPropertyAssignment(n) && campos.includes(n.name.text);
    const esNormal = ts.isPropertyAssignment(n) && ts.isIdentifier(n.name) && campos.includes(n.name.text);
    if ((esAtajo || esNormal) && dentroDePrisma(n)) {
      const { line } = sf.getLineAndCharacterOfPosition(n.getStart(sf));
      out.push({ linea: line + 1, campo: esAtajo ? n.name.text : n.name.text });
    }
    ts.forEachChild(n, visita);
  };
  visita(sf);
  return out;
}
