// SCRUM-221 (A9) · UN EXPORT FISCAL NO PUEDE SALIR SIN SU FILA — NI CON ELLA EN MAL ORDEN.
//
// POR QUÉ EXISTE
//
// El pack fiscal (XML RRSIF suelto, y el ZIP que lo lleva dentro) es la acción por la que los
// registros SALEN del sistema hacia una gestoría o una inspección. Hasta hoy: el XML no dejaba
// NINGUNA fila, y el ZIP solo dejaba un `datos_exportados` genérico por la puerta fire-safe —
// que si falla se traga con un `console.error` y el paquete sale igual. O sea que en un camino
// no había rastro y en el otro había un rastro que puede perderse en silencio, que es peor
// porque PARECE cobertura.
//
// LO QUE VIGILA, y son dos cosas distintas:
//
//   ① PRESENCIA — cada ruta que entrega registro fiscal escribe `exportacion_fiscal` por la
//     puerta que PROPAGA (`recordAuditOrThrow`). La puerta fire-safe ya la impide el TIPO
//     (`exportacion_fiscal` ∈ ACCIONES_BLOQUEANTES ⇒ `recordAudit` no compila), así que aquí
//     no se re-comprueba lo que `tsc` garantiza: se comprueba que la llamada EXISTE.
//   ② ORDEN — y esta es la que de verdad protege. Una fila escrita DESPUÉS de `res.send` o de
//     `archive.pipe` no bloquea nada: para cuando fallara, los bytes ya habrían salido. El
//     registro tiene que preceder al primer byte. Un guard que solo mirase «¿está la llamada?»
//     daría verde con el orden invertido, que es exactamente el bug que no queremos.
//
// ⚠️ AST, NO `grep`. Este fichero está lleno de los nombres que vigila (`exportacion_fiscal`,
// `recordAudit`, `res.send`) porque son los que hay que escribir para explicar la regla. Un
// guard de texto se cazaría a sí mismo — SCRUM-176/168/3/193.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { ACCIONES_BLOQUEANTES } from '../dist/modules/system/audit.service.js';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.join(AQUI, '..');
const RUTAS = path.join(RAIZ, 'src', 'modules', 'exports', 'app', 'routes', 'exports.routes.ts');
const ACCION = 'exportacion_fiscal';

/** Las rutas que entregan registro fiscal. El ZIP cuenta: lleva los XML RRSIF dentro. */
const RUTAS_FISCALES = ['/verifactu.xml', '/datos.zip'];

/** Lo que hace salir bytes. A partir de aquí, «bloquear» ya no significa nada. */
const EMISORES_DE_BYTES = [
  ['res', 'setHeader'],
  ['res', 'send'],
  ['archive', 'pipe'],
];

const sf = ts.createSourceFile(RUTAS, fs.readFileSync(RUTAS, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
const linea = (n) => sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1;

/** Cuerpo del handler de `router.get('<path>', …, handler)`. */
function handlerDe(rutaPath) {
  let encontrado = null;
  const visitar = (n) => {
    if (encontrado) return;
    if (ts.isCallExpression(n)
      && ts.isPropertyAccessExpression(n.expression)
      && n.expression.name.text === 'get'
      && n.arguments.length > 0
      && ts.isStringLiteral(n.arguments[0])
      && n.arguments[0].text === rutaPath) {
      encontrado = n.arguments[n.arguments.length - 1];
      return;
    }
    ts.forEachChild(n, visitar);
  };
  ts.forEachChild(sf, visitar);
  return encontrado;
}

/** ¿Es `a.b(...)` con este par? */
function esLlamadaA(n, [obj, metodo]) {
  return ts.isCallExpression(n)
    && ts.isPropertyAccessExpression(n.expression)
    && n.expression.name.text === metodo
    && ts.isIdentifier(n.expression.expression)
    && n.expression.expression.text === obj;
}

/** Llamadas a `recordAuditOrThrow` cuyo objeto de params declara `action: '<ACCION>'`. */
function llamadasDeAuditoria(cuerpo) {
  const out = [];
  const visitar = (n) => {
    if (ts.isCallExpression(n)
      && ts.isIdentifier(n.expression)
      && n.expression.text === 'recordAuditOrThrow') {
      const texto = n.getText(sf);
      if (texto.includes(`'${ACCION}'`)) out.push({ pos: n.getStart(sf), linea: linea(n), texto, nodo: n });
    }
    ts.forEachChild(n, visitar);
  };
  visitar(cuerpo);
  return out;
}

/**
 * ¿Este subárbol asigna una PROPIEDAD con este nombre? (`{ … nombre: valor … }`).
 *
 * Se mira la propiedad en el ÁRBOL y no el texto de la llamada a propósito: el texto incluye
 * los comentarios de dentro, y el comentario que explica por qué el campo NO va contiene el
 * nombre del campo. Con `match` sobre el texto, este guard salía ROJO contra su propia prosa —
 * pasó al escribirlo, que es la cuarta vez que muerde en este repo (SCRUM-176/168/3/193).
 * Un comentario no es un nodo; una `PropertyAssignment` sí.
 */
function asignaPropiedad(nodo, nombre) {
  let visto = false;
  const visitar = (n) => {
    if (visto) return;
    if ((ts.isPropertyAssignment(n) || ts.isShorthandPropertyAssignment(n))
      && ts.isIdentifier(n.name) && n.name.text === nombre) {
      visto = true;
      return;
    }
    ts.forEachChild(n, visitar);
  };
  visitar(nodo);
  return visto;
}

/** El PRIMER punto del handler donde salen bytes. */
function primerByte(cuerpo) {
  let min = null;
  const visitar = (n) => {
    for (const par of EMISORES_DE_BYTES) {
      if (esLlamadaA(n, par)) {
        const p = n.getStart(sf);
        if (min === null || p < min.pos) min = { pos: p, linea: linea(n), que: par.join('.') };
      }
    }
    ts.forEachChild(n, visitar);
  };
  visitar(cuerpo);
  return min;
}

// ── 0 · EL TIPO YA LO IMPIDE: ratchet de la lista ─────────────────────────────────────────
test('SCRUM-221 · `exportacion_fiscal` sigue en ACCIONES_BLOQUEANTES', () => {
  assert.ok(
    ACCIONES_BLOQUEANTES.includes(ACCION),
    `🔴 SE HA SACADO \`${ACCION}\` DE ACCIONES_BLOQUEANTES.\n\n` +
      '  Esa lista es lo que hace que `recordAudit` (fire-safe) NO COMPILE para esta acción.\n' +
      '  Sin ella, cualquiera puede registrar el export por la puerta que se traga los fallos, y\n' +
      '  un pack de inspección volvería a poder salir sin rastro — el ticket entero.\n\n' +
      '  La lista es CERRADA: sacar una acción es decisión del fundador, no de una sesión.',
  );
});

// ── 1 · SUELO: el analizador encuentra las rutas ──────────────────────────────────────────
// Sin esto, el día que una ruta se renombre el barrido devolvería null y los asserts de abajo
// no comprobarían nada. Un verde hueco es peor que un rojo.
test('SCRUM-221 · el analizador localiza las dos rutas fiscales (suelo)', () => {
  for (const r of RUTAS_FISCALES) {
    assert.ok(handlerDe(r), `🔴 ESCÁNER CIEGO: no encuentro el handler de ${r} — ¿cambió el path?`);
  }
});

// ── 2 · PRESENCIA ────────────────────────────────────────────────────────────────────────
test('SCRUM-221 · cada ruta que entrega registro fiscal escribe su fila', () => {
  for (const r of RUTAS_FISCALES) {
    const llamadas = llamadasDeAuditoria(handlerDe(r));
    assert.ok(
      llamadas.length > 0,
      `🔴 ${r} PUEDE ENTREGAR REGISTRO FISCAL SIN DEJAR FILA.\n\n` +
        `  Falta un \`recordAuditOrThrow\` con action '${ACCION}'. Es la acción por la que los\n` +
        '  registros salen hacia una gestoría o una inspección: sin ella no consta ni quién, ni\n' +
        '  cuándo, ni con qué alcance.',
    );
  }
});

// ── 3 · ORDEN · la que de verdad protege ─────────────────────────────────────────────────
test('SCRUM-221 · la fila se escribe ANTES del primer byte', () => {
  for (const r of RUTAS_FISCALES) {
    const cuerpo = handlerDe(r);
    const audit = llamadasDeAuditoria(cuerpo)[0];
    const bytes = primerByte(cuerpo);

    assert.ok(bytes, `🔴 ${r}: no encuentro dónde salen los bytes; el guard no puede ordenar nada`);
    assert.ok(
      audit.pos < bytes.pos,
      `🔴 ${r}: LA FILA SE ESCRIBE DESPUÉS DE EMPEZAR A ENVIAR.\n\n` +
        `    registro  → línea ${audit.linea}\n` +
        `    ${bytes.que.padEnd(9)} → línea ${bytes.linea}  ← los bytes empiezan aquí\n\n` +
        '  Con este orden el registro NO bloquea nada: para cuando fallara, el pack ya habría\n' +
        '  salido. `recordAuditOrThrow` solo protege si precede al primer byte — que es la única\n' +
        '  diferencia entre «queda constancia» y «se intentó dejar constancia».',
    );
  }
});

// ── 4 · NO VUELVE EL DATO AUTODECLARADO ──────────────────────────────────────────────────
// El contrato proponía `destinatarioDeclarado` (texto libre: «para quién se pide el export») y
// el fundador lo DESCARTÓ el 29-jul-2026. El motivo es el que este proyecto lleva el día entero
// cerrando: un campo que el usuario rellena a botonazo **no prueba nada y parece que sí**.
// Dentro de dos años alguien lee «Mi gestoría» en un registro de auditoría y lo toma por
// evidencia de entrega, cuando solo acredita qué botón pulsó alguien con prisa. Metido donde
// todo lo demás es verificable, es cobertura aparente.
//
// Este test es el ratchet de esa decisión: no impide registrar un destinatario que algún día
// sea VERIFICABLE (un envío real a una dirección, con su acuse) — impide que vuelva a colarse
// como texto que el profesional teclea.
test('SCRUM-221 · no reaparece un destinatario AUTODECLARADO en la fila', () => {
  for (const r of RUTAS_FISCALES) {
    const audit = llamadasDeAuditoria(handlerDe(r))[0];
    assert.equal(
      asignaPropiedad(audit.nodo, 'destinatarioDeclarado'), false,
      `🔴 ${r}: ha vuelto \`destinatarioDeclarado\`.\n\n` +
        '  Es un dato AUTODECLARADO en un registro donde todo lo demás es verificable: no\n' +
        '  prueba a quién se entregó el pack, solo qué escribió quien lo descargó. Su presencia\n' +
        '  hace que la fila parezca acreditar una entrega que nadie ha comprobado.\n\n' +
        '  Lo que la norma pide —quién, cuándo y qué periodo— ya está en la fila y es\n' +
        '  verificable. Decisión del fundador (29-jul-2026): no se le pregunta al profesional.',
    );
  }
});
