// tests/_tx-poblacion.mjs — SCRUM-219 · ¿QUIÉN espera una transacción? Derivado de la
// ESTRUCTURA, no de una lista de nombres.
//
// ── QUÉ AÑADE ESTO SOBRE SCRUM-207 ───────────────────────────────────────────────────────
//
// `_misma-tx.mjs` ya sabe comprobar un call site: `analizarDelegacion(raiz, delegadas)` mira
// cada llamada y exige que el receptor sea transaccional de verdad —el parámetro de un
// `$transaction`, o un parámetro cuyo TIPO declare `TransactionClient`—, y trata como fuga
// todo lo que no pueda declarar. Esa lógica no se reescribe aquí: se reutiliza entera.
//
// Lo que le falta es a QUIÉN se la aplica. Hoy la población está cableada a un nombre
// (`EMBUDO = 'allocateInvoiceNumber'`) más una delegada suelta, y eso deja fuera
// `allocateQuoteNumber` y `allocateAlbaranNumber`, que dependen del rollback exactamente
// igual: un fallo tras reservar el número deja un hueco en la serie de presupuestos o de
// albaranes. Este módulo calcula la población: **toda función cuyo parámetro esté tipado
// `Prisma.TransactionClient`**. Si mañana alguien escribe la quinta, entra sola.
//
// ── POR QUÉ NO BASTA CON EL TIPO, QUE ES LA RAZÓN DE SER DEL TICKET ──────────────────────
//
// `Prisma.TransactionClient` es `Omit<PrismaClient, "$connect" | "$disconnect" | "$on" |
// "$transaction" | "$extends">`: le FALTAN miembros respecto al cliente global. Y por tipado
// estructural, tener miembros de más no impide la asignación — así que pasar el cliente
// global donde se espera una transacción COMPILA LIMPIO (medido con `tsc`, con control
// negativo). Marcar el tipo (*branded type*) tampoco sirve: rechaza igual el `tx` REAL que
// entrega `$transaction`, así que obligaría a castear en las 29 fronteras de `src/` — o sea
// a modificar el camino de emisión, que es STOP. El tipo no puede; esto sí.
//
// ── Y LO QUE SE JUEGA, que no es higiene ────────────────────────────────────────────────
//
// Lo único que hoy impide un hueco en la numeración FISCAL es que la reserva del número y la
// creación de la factura vivan en la MISMA transacción: el rollback deshace el incremento de
// `nextInvoiceNumber` junto con el `insert`. Reservar en una transacción y crear en otra
// convierte el hueco de imposible en real, y un salto en la serie hay que justificarlo ante
// Hacienda (medido por la sesión 2 en SCRUM-234; regla 29).
//
// AST y no `grep`: este fichero está lleno de las palabras que vigila (regla 38 — solo LEE el
// camino de emisión, no lo toca).
import ts from 'typescript';
import fs from 'node:fs';
import path from 'node:path';

/** El tipo que declara «esto tiene que ser una transacción». */
const TIPO_TX = /TransactionClient/;

/** ¿Alguno de los parámetros está tipado como transacción? Devuelve su índice, o -1. */
function indiceDelParamTx(parametros) {
  if (!parametros) return -1;
  for (let i = 0; i < parametros.length; i++) {
    const texto = parametros[i].type?.getText?.() ?? '';
    if (TIPO_TX.test(texto)) return i;
  }
  return -1;
}

/**
 * Las funciones CON NOMBRE de un fichero que esperan una transacción.
 *
 * Solo con nombre, y a propósito: una arrow anónima dentro de `$transaction(async (tx) => …)`
 * también lleva el parámetro tipado, pero no es una función a la que nadie pueda llamar mal —
 * es el sitio donde NACE la transacción. Incluirla sería vigilarse a sí misma.
 */
export function poblacionEnFuente(codigo, ruta = 'anonimo.ts') {
  const sf = ts.createSourceFile(ruta, codigo, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const out = [];
  const anotar = (nombre, parametros, nodo) => {
    const indiceParam = indiceDelParamTx(parametros);
    if (indiceParam === -1) return;
    out.push({
      fnNombre: nombre,
      indiceParam,
      ruta,
      linea: sf.getLineAndCharacterOfPosition(nodo.getStart(sf)).line + 1,
    });
  };

  const visitar = (n) => {
    // `function nombre(tx: Prisma.TransactionClient, …)`
    if (ts.isFunctionDeclaration(n) && n.name) anotar(n.name.text, n.parameters, n);
    // `const nombre = (tx: Prisma.TransactionClient, …) => …`
    else if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && n.initializer &&
             (ts.isArrowFunction(n.initializer) || ts.isFunctionExpression(n.initializer))) {
      anotar(n.name.text, n.initializer.parameters, n);
    }
    // `nombre(tx: Prisma.TransactionClient, …) { … }` dentro de una clase u objeto
    else if (ts.isMethodDeclaration(n) && ts.isIdentifier(n.name)) anotar(n.name.text, n.parameters, n);
    ts.forEachChild(n, visitar);
  };
  ts.forEachChild(sf, visitar);
  return out;
}

/** Recorre `raiz` (normalmente `src/`) y devuelve toda la población. */
export function poblacionTx(raiz) {
  const out = [];
  const andar = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) { andar(p); continue; }
      if (!e.name.endsWith('.ts') || e.name.endsWith('.d.ts')) continue;
      const codigo = fs.readFileSync(p, 'utf8');
      // Filtro barato antes de parsear. No es la regla: la regla es el AST de abajo.
      if (!TIPO_TX.test(codigo)) continue;
      out.push(...poblacionEnFuente(codigo, p.replace(/\\/g, '/')));
    }
  };
  andar(raiz);
  return out;
}
