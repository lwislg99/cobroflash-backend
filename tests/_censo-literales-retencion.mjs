// tests/_censo-literales-retencion.mjs — SCRUM-293 (③b): CERO literales de porcentaje de
// retención en el front. Puro: recibe un directorio y los tipos del cubo, devuelve el censo.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// QUÉ SE VIGILA Y POR QUÉ, que está escrito en el dominio y aquí solo se ejecuta
//
// `retencionIrpf.ts` lo dice en su cabecera: «un `<option>` escrito a mano en el front es un
// número suelto que nadie relaciona con esta lista: el día que se añada o se quite un tipo, la
// pantalla se queda diciendo lo de antes y **nada avisa**». El selector de ③a se pinta
// RECORRIENDO el cubo, así que hoy ese literal no existe. Esto impide que vuelva.
//
// Es un fallo MUDO de manual: una pantalla que ofrece un tipo retirado no da ningún síntoma —
// sale, se guarda y el descuadre aparece en el 111 meses después.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// 🔴 POR AST Y SOLO SOBRE LITERALES — y no es una preferencia de estilo
//
// Un guard de TEXTO se caza a sí mismo en el comentario que explica la prohibición: este mismo
// fichero tiene que poder escribir «15 %» para decir qué prohíbe. Con AST los comentarios no son
// nodos de literal, así que quedan fuera **por construcción** y no por una lista de excepciones.
// Mismo mecanismo que `scrum402-marcador-no-se-pinta`.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// 🔴 EL PATRÓN SE DERIVA DEL CUBO, Y LA FRONTERA IZQUIERDA ES LA MITAD DEL TRABAJO
//
// Los tipos NO se escriben aquí: entran por parámetro desde `tiposDeRetencionOrdenados()`. Si
// mañana el cubo estrena un tipo, esta vigilancia lo cubre sola — una lista a mano se habría
// quedado atrás justo el día que importa, que es el defecto que el cubo existe para impedir.
//
// Y el `(?<![\d.,])` no es adorno. MEDIDO sobre los 60 ficheros de `public/dashboard/js`: hay 63
// literales con forma «N %» y ninguno es una retención — pero **«IVA 21 %» contiene «1 %»**, y
// «0,15 %» contendría «15 %». Sin frontera izquierda, el guard nacería acusando al IVA: un rojo
// en falso el primer día es un guard que alguien apaga en una hora.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import ts from 'typescript';

/**
 * El patrón que prohíbe UN tipo. Acepta «15 %» y «15%» — quien lo escriba a mano puede poner el
 * espacio o no, y las dos formas pintan lo mismo en pantalla.
 *
 * La frontera DERECHA no hace falta: el `%` ya la pone. La IZQUIERDA sí, y excluye dígito y
 * separador decimal para que «21 %» no cuente como «1 %».
 */
export function patronDe(tipo) {
  return new RegExp(`(?<![\\d.,])${tipo}\\s*%`);
}

/** Los `.js` de un directorio, en orden estable. `[]` si el directorio no existe. */
function ficherosJs(dir) {
  let entradas;
  try {
    entradas = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return null; // no existe: es distinto de «existe y está vacío», y se distingue arriba
  }
  return entradas.filter((e) => e.isFile() && e.name.endsWith('.js')).map((e) => e.name).sort();
}

/**
 * Censo de literales de porcentaje de retención.
 *
 * @param {string} dir     directorio a recorrer (plano, `.js`)
 * @param {number[]} tipos los tipos del CUBO — no se escriben aquí
 * @returns {{hallazgos:Array, ficherosLeidos:number, ficheros:string[], sinDirectorio:boolean}}
 *
 * ⚠️ Devuelve CEROS MARCADOS en vez de reventar cuando no hay nada que mirar. Un analizador que
 * lanza dentro de la suite hace caer un test con un error que NO nombra el problema real; y uno
 * que devuelve un cero pelado deja «no hay literales» y «no supe mirar» con el mismo aspecto.
 * Quien convierte ese cero en rojo es el SUELO del test, no esta función.
 */
export function censarLiteralesDeRetencion(dir, tipos) {
  const nombres = ficherosJs(dir);
  if (nombres === null) {
    return { hallazgos: [], ficherosLeidos: 0, ficheros: [], sinDirectorio: true };
  }
  const patrones = tipos.map((t) => ({ tipo: t, re: patronDe(t) }));
  const hallazgos = [];

  for (const nombre of nombres) {
    const fuente = fs.readFileSync(path.join(dir, nombre), 'utf8');
    const sf = ts.createSourceFile(nombre, fuente, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
    const visitar = (n) => {
      // Los tres sabores de literal de texto. Una plantilla se mira por TROZOS: el `%` puede
      // quedar pegado a una interpolación y el texto entero no existe como una sola cadena.
      const trozos = ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)
        ? [n.text]
        : ts.isTemplateExpression(n)
          ? [n.head.text, ...n.templateSpans.map((s) => s.literal.text)]
          : [];
      for (const texto of trozos) {
        for (const { tipo, re } of patrones) {
          if (re.test(texto)) {
            hallazgos.push({
              fichero: nombre,
              linea: sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1,
              tipo,
              // Recortado: un literal puede ser una plantilla de 200 líneas y el rojo tiene que
              // caber en una pantalla para que se lea.
              fragmento: texto.trim().slice(0, 80),
            });
            break; // un literal se nombra UNA vez aunque cumpla dos patrones
          }
        }
      }
      ts.forEachChild(n, visitar);
    };
    visitar(sf);
  }

  return { hallazgos, ficherosLeidos: nombres.length, ficheros: nombres, sinDirectorio: false };
}

/**
 * AUTOPRUEBA sobre fuente SINTÉTICA, con la respuesta conocida de antemano.
 *
 * Un censo medido solo contra el repo real no distingue «no hay literales» de «me he quedado
 * ciego»: las dos salen como una lista vacía. Así que primero se le da un árbol con trampas
 * puestas a mano y se comprueba que acierta EXACTO — incluidos los negativos, que aquí son lo
 * caro: el corpus real está lleno de `width:100%` y de `IVA 21 %`.
 */
export function autoprueba() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'yaqu-ret-'));
  try {
    fs.writeFileSync(path.join(dir, 'cazado.js'), [
      'const op = document.createElement("option");',
      'op.textContent = "15 %";',              // ← 3 · el caso exacto del ticket
      'const pegado = "7%";',                  // ← 4 · sin espacio, misma pantalla
      'const plantilla = `IRPF ${x} al 2 %`;', // ← 5 · dentro de una plantilla
    ].join('\n'), 'utf8');
    fs.writeFileSync(path.join(dir, 'inocente.js'), [
      'const css = "width:100%";',             // el caso más común del corpus real
      'const iva = "IVA 21 %";',               // ← contiene «1 %» y NO puede caer
      'const comision = "0,9 %";',
      'const tramo = "50% al aceptar, 50% al finalizar";',
      'const cien = "Pago 100% al aceptar";',
      '// aquí se explica que no puede haber un 15 % escrito a mano',  // comentario: NO es literal
      'const numero = 15;',                    // numérico suelto: 230 en el repo real, no se tocan
    ].join('\n'), 'utf8');

    const r = censarLiteralesDeRetencion(dir, [15, 7, 2, 1]);
    const enCazado = r.hallazgos.filter((h) => h.fichero === 'cazado.js');
    return {
      cazaElRotulo: enCazado.some((h) => h.tipo === 15 && h.linea === 2),
      cazaSinEspacio: enCazado.some((h) => h.tipo === 7),
      cazaEnPlantilla: enCazado.some((h) => h.tipo === 2),
      nombraLinea: enCazado.every((h) => Number.isInteger(h.linea) && h.linea > 0),
      // 🔴 LOS NEGATIVOS: si alguno de estos cae, el guard nace en rojo en falso.
      noCazaAlInocente: r.hallazgos.every((h) => h.fichero !== 'inocente.js'),
      leyoLosDos: r.ficherosLeidos === 2,
      hallazgos: r.hallazgos,
    };
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}
