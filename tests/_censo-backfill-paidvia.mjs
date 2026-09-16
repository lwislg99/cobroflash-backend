// tests/_censo-backfill-paidvia.mjs — SCRUM-441
//
// ═════════════════════════════════════════════════════════════════════════════════════════
// EL DETECTOR: ¿alguien rellena `Invoice.paid_via` COPIÁNDOLO de `Charge.method`?
//
// `Charge.method` guardó durante meses DOS COSAS que no son sinónimos: la intención (`card`, la
// preferencia que elige el profesional) y el hecho (`card:stripe`, lo que escribió la pasarela).
// Eso es el defecto que SCRUM-473/474 acotó, y **no se puede saber, mirando una fila, cuál de las
// dos guardó**.
//
// Por eso la columna nueva de `invoices` entra VACÍA. Un backfill desde `Charge` no movería el
// problema: lo DUPLICARÍA, y encima de forma irreversible — copiadas las filas, ya no hay manera de
// distinguir cuáles se copiaron. `NULL` dice «no consta», que es la verdad, y el lector ya lo trata
// bien (cae en «Método no registrado», sin inventarse nada).
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// POR QUÉ ESTO NO ES UN `grep`
//
// Un guard de texto se caza a sí mismo en el comentario que explica la prohibición — le ha pasado
// cuatro veces a esta casa. Aquí:
//   · el código TypeScript se mira por **AST**, que no ve comentarios;
//   · el SQL, que no tiene AST a mano, se mira **después de quitarle los comentarios**.
//
// Y el detector NO lee de disco por su cuenta: recibe `{ruta, texto}`. Así el test puede darle una
// fixture con un backfill de verdad y comprobar que **sabe verlo** antes de creerse su silencio.
import ts from 'typescript';

/**
 * Excepciones declaradas. Vacía a propósito: **hoy no hay ningún caso legítimo**.
 *
 * Si algún día lo hay, entra aquí CON SU MOTIVO ESCRITO y se ve en el diff. Una excepción silenciosa
 * —un `if` dentro del detector, un fichero que se salta— es como esto se apaga sin que nadie lo note.
 */
export const ALLOWLIST = Object.freeze([]);

/** Los nombres de la columna, en los dos vocabularios: el de Prisma y el de la tabla. */
const CAMPOS = ['paidVia', 'paid_via'];

/** ¿El texto de una expresión huele a que el valor viene de `Charge`? */
function vieneDeCharge(texto) {
  return /\bcharge/i.test(texto) || /\bmethod\b/.test(texto);
}

function quitarComentariosSql(sql) {
  return sql
    .replace(/\/\*[\s\S]*?\*\//g, ' ')   // /* … */
    .replace(/--[^\n]*/g, ' ');          // -- hasta fin de línea
}

/**
 * Busca backfills en las entradas dadas.
 *
 * @param entradas `[{ ruta, texto }]` — la ruta solo se usa para nombrar el hallazgo y para
 *                 decidir cómo se lee el contenido (`.sql` o código).
 * @returns `[{ ruta, linea, que, detalle }]`
 */
export function buscarBackfill(entradas) {
  const hallazgos = [];

  for (const { ruta, texto } of entradas) {
    if (ALLOWLIST.includes(ruta)) continue;

    if (ruta.endsWith('.sql')) {
      const limpio = quitarComentariosSql(texto);
      // Se parte por sentencia: un fichero que toque `paid_via` en un sitio y `charges` en otro,
      // sin relación entre ellos, no es un backfill.
      let desplazamiento = 0;
      for (const trozo of limpio.split(';')) {
        const tocaColumna = CAMPOS.some((c) => new RegExp(`\\b${c}\\b`, 'i').test(trozo));
        const tocaCharge = /\bcharges?\b/i.test(trozo) || /\bmethod\b/i.test(trozo);
        const escribe = /\b(UPDATE|INSERT|SET)\b/i.test(trozo);
        if (tocaColumna && tocaCharge && escribe) {
          const linea = limpio.slice(0, desplazamiento).split('\n').length;
          hallazgos.push({
            ruta,
            linea,
            que: 'SQL',
            detalle: trozo.trim().replace(/\s+/g, ' ').slice(0, 160),
          });
        }
        desplazamiento += trozo.length + 1;
      }
      continue;
    }

    const src = ts.createSourceFile(ruta, texto, ts.ScriptTarget.Latest, true);
    const linea = (n) => src.getLineAndCharacterOfPosition(n.getStart()).line + 1;

    (function anda(n) {
      // ① `{ paidVia: <algo que viene de Charge> }` — el backfill escrito en TypeScript.
      if ((ts.isPropertyAssignment(n) || ts.isShorthandPropertyAssignment(n)) && n.name) {
        const nombre = ts.isIdentifier(n.name) || ts.isStringLiteral(n.name) ? n.name.text : '';
        if (CAMPOS.includes(nombre)) {
          const valor = ts.isPropertyAssignment(n) ? n.initializer.getText() : nombre;
          if (vieneDeCharge(valor)) {
            hallazgos.push({
              ruta, linea: linea(n), que: 'asignación',
              detalle: `${nombre}: ${valor.replace(/\s+/g, ' ').slice(0, 120)}`,
            });
          }
        }
      }
      // ② El SQL crudo metido en un `$executeRaw`/`$queryRaw` o en cualquier cadena. El AST ve el
      //    literal; el comentario de al lado, no — que es justo lo que se quiere.
      if (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n) || ts.isTemplateExpression(n)) {
        const t = n.getText();
        const tocaColumna = CAMPOS.some((c) => new RegExp(`\\b${c}\\b`, 'i').test(t));
        if (tocaColumna && /\b(UPDATE|INSERT|SET)\b/i.test(t) && vieneDeCharge(t)) {
          hallazgos.push({
            ruta, linea: linea(n), que: 'SQL crudo',
            detalle: t.replace(/\s+/g, ' ').slice(0, 160),
          });
        }
      }
      ts.forEachChild(n, anda);
    })(src);
  }

  return hallazgos;
}

/** Cómo se lee un hallazgo en el mensaje de un rojo. */
export function describir(h) {
  return `${h.ruta}:${h.linea} · ${h.que} · ${h.detalle}`;
}
