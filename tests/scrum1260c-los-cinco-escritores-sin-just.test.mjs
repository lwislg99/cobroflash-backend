// SCRUM-1260c · los otros cinco escritores de `type: 'JUST'` ya no lo escriben.
//
// Sin gate: `tx` falsa y AST. Ni BD, ni red, ni navegador.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// QUÉ SE RETIRA Y CON QUÉ FIRMA
//
// Cinco sitios creaban la factura con `type: isReceiptNumber(<nº>) ? 'JUST' : 'F1'`:
// `ensureInvoiceForCharge` (lib/invoicing.ts), el cierre de un trabajo (jobs.routes.ts), la firma
// del presupuesto por el cliente (quotes.routes.ts) y los dos de quotesAdmin.routes.ts. El de
// `emitInvoice` es el sexto, y lo retiró SCRUM-1260b (`scrum1260b-…`).
//
// El fundador: «Sí los 6» (SCRUM-1260, comentario 20148, GO de la regla 40 que amplía el 20143).
// Alcance: SÓLO la rama que escribe el tipo, con sus consecuencias mecánicas (el import de
// `isReceiptNumber` que se queda sin uso). Nada más del camino de emisión.
//
// ⛔ Lo que NO se retira (regla 29): `isReceiptNumber`, `RECEIPT_NUMBER_PREFIX` y `'JUST'` como
// DATO — las filas ya emitidas se siguen leyendo. Lo sujeta `scrum1027`.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// POR QUÉ ERA INALCANZABLE, Y LAS TRES PARTES
//
// En los cinco el número es un `const` cuyo ÚNICO valor es `await allocateInvoiceNumber(…)`, sin
// `rectifying`. Así que lo que llega a la rama es exactamente lo que devuelve el reservador.
//
// ① EL CABLEADO, por AST: cada `allocateInvoiceNumber(` de los cinco ficheros inicializa un
//    `const`, sin `rectifying`, y ese `const` es el `number` del objeto que lleva el `type`. Si
//    alguien mete otra fuente de número, ① deja de valer y lo dice.
// ② EL ALCANCE, entrando por `allocateInvoiceNumber` de verdad (el compilado): cuatro comercios
//    (los tres modos), cinco prefijos de serie (tres hostiles, con `J-`) y dos fechas (antes y
//    después del corte al formato F). Ningún número sale `J-`. Sale VERDE con la rama y sin ella:
//    es lo que prueba que retirarla no le quita nada a nadie.
// ③ EL TEXTO, por AST: en los cinco el `type` es el literal `'F1'`, y ningún fichero nombra
//    `isReceiptNumber` ni el literal `'JUST'`. Éste es el que cae si una rama vuelve.
//
// ⚠️ No se entra por las RUTAS HTTP: ① es lo que ata la ruta al reservador, y ② mide el reservador.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import {
  allocateInvoiceNumber, isReceiptNumber, CORTE_FORMATO_F,
} from '../dist/modules/invoicing/domain/invoiceNumber.service.js';
import { getEmissionMode } from '../dist/modules/invoicing/domain/emission.service.js';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

// Los cinco, como los midió el PASO 0 (git grep sobre fe65a8b7, SCRUM-1260 c.20148): fichero →
// cuántas reservas tiene. Si cambia, alguien ha añadido o quitado un camino y hay que re-leerlo.
const ESCRITORES = {
  'src/lib/invoicing.ts': 1,
  'src/modules/jobs/app/routes/jobs.routes.ts': 1,
  'src/modules/quotes/app/routes/quotes.routes.ts': 1,
  'src/modules/system/app/routes/quotesAdmin.routes.ts': 2,
};

function fuente(rel) {
  const texto = fs.readFileSync(path.join(RAIZ, rel), 'utf8');
  return ts.createSourceFile(rel, texto, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
}

function recorrer(nodo, visita) {
  visita(nodo);
  ts.forEachChild(nodo, (h) => recorrer(h, visita));
}

const nombreDe = (p) => (p.name && (ts.isIdentifier(p.name) || ts.isStringLiteral(p.name)) ? p.name.text : null);

/** Cada reserva del fichero: el `const` que la recibe y el objeto que lleva su `number`. */
function reservasDe(sf) {
  const reservas = [];
  recorrer(sf, (n) => {
    if (!ts.isCallExpression(n) || !ts.isIdentifier(n.expression) || n.expression.text !== 'allocateInvoiceNumber') return;
    let p = n.parent;
    if (p && ts.isAwaitExpression(p)) p = p.parent;
    const decl = p && ts.isVariableDeclaration(p) && p.initializer && ts.isIdentifier(p.name) ? p : null;
    const esConst = !!decl && !!(decl.parent.flags & ts.NodeFlags.Const);
    const opciones = n.arguments[2];
    const conRect = !!opciones && ts.isObjectLiteralExpression(opciones) &&
      opciones.properties.some((q) => nombreDe(q) === 'rectifying');
    // El objeto que usa el `const` como `number` (`number: x` o `number` a secas), en el mismo
    // bloque de función.
    let fn = n.parent;
    while (fn && !ts.isFunctionLike(fn)) fn = fn.parent;
    const objetos = [];
    if (decl && fn) {
      const id = decl.name.text;
      recorrer(fn, (o) => {
        if (!ts.isObjectLiteralExpression(o)) return;
        const num = o.properties.find((q) => nombreDe(q) === 'number');
        if (!num) return;
        const usa = (ts.isPropertyAssignment(num) && ts.isIdentifier(num.initializer) && num.initializer.text === id) ||
          (ts.isShorthandPropertyAssignment(num) && num.name.text === id);
        if (!usa) return;
        const tipo = o.properties.find((q) => nombreDe(q) === 'type');
        if (tipo && ts.isPropertyAssignment(tipo)) objetos.push(tipo.initializer);
      });
    }
    reservas.push({ id: decl ? decl.name.text : null, esConst, conRect, tipos: objetos, linea: sf.getLineAndCharacterOfPosition(n.getStart()).line + 1 });
  });
  return reservas;
}

test('SCRUM-1260c · ① en los cinco, el número es un `const` del reservador, sin rectifying, y es el `number` de la fila con `type`', () => {
  let total = 0;
  for (const [rel, esperadas] of Object.entries(ESCRITORES)) {
    const reservas = reservasDe(fuente(rel));
    assert.equal(reservas.length, esperadas,
      `🔴 ${rel} tiene ${reservas.length} llamadas a allocateInvoiceNumber y se midieron ${esperadas}: ` +
        'hay un camino nuevo o uno menos, y la población de SCRUM-1260c ya no es la firmada.');
    for (const r of reservas) {
      const donde = `${rel}:${r.linea}`;
      assert.ok(r.id && r.esConst, `🔴 ${donde}: el número no es un const que recibe la reserva: puede llegar otro valor.`);
      assert.equal(r.conRect, false, `🔴 ${donde}: la reserva pasa rectifying: ② no mide esa serie.`);
      assert.equal(r.tipos.length, 1,
        `🔴 ${donde}: ${r.tipos.length} objetos usan «${r.id}» como number con un type, y se esperaba uno.`);
      total++;
    }
  }
  assert.equal(total, 5, `🔴 CIEGO o fuera de población: ${total} escritores leídos de 5.`);
});

const ACTOR = { tipo: 'pro_propietario', teamMemberId: null };
const COMERCIOS = [
  { nombre: 'ES con el flag ON', modo: 'fiscal', m: { id: 7, country: 'ES', flags: { INVOICING_ES_ENABLED: true } } },
  { nombre: 'fuera de España', modo: 'fiscal', m: { id: 8, country: 'PT', flags: {} } },
  { nombre: 'demo', modo: 'demo', m: { id: 1, country: 'ES', flags: {} } },
  { nombre: 'ES con el flag OFF', modo: 'receipt', m: { id: 9, country: 'ES', flags: {} } },
];
const PREFIJOS = ['CF', 'FG', 'J-', ' J-', 'j-'];
// Una fecha a cada lado del corte, DERIVADAS de él: si el corte se mueve, siguen a cada lado.
const DIA = 24 * 3600 * 1000;
const FECHAS = [
  new Date(CORTE_FORMATO_F.desde.getTime() - 30 * DIA),
  new Date(CORTE_FORMATO_F.desde.getTime() + 30 * DIA),
];

function fakeTx(m, prefijo, ahora) {
  return {
    $executeRaw: async () => 0,
    merchant: {
      findUnique: async () => ({
        ...m, email: 'pro@fontaneria.es', timezone: 'Europe/Madrid', invoiceSeriesPrefix: prefijo,
        nextInvoiceNumber: 1, nextRectInvoiceNumber: 1, invoiceSeriesYear: ahora.getUTCFullYear(),
        invoiceStartSeq: null, invoiceStartYear: null,
      }),
      update: async () => ({}),
    },
    auditLog: { create: async () => ({}) },
    invoice: { findMany: async () => [], findUnique: async () => null },
  };
}

test('SCRUM-1260c · el detector ve un J- sembrado (si no, ② sería verde sobre nada)', () => {
  assert.equal(isReceiptNumber('J-20260304-AB12'), true, '🔴 el detector no ve un número de justificante.');
  assert.equal(isReceiptNumber('F260001'), false, '🔴 el detector marca una factura F.');
  assert.equal(isReceiptNumber('2026-CF-001'), false, '🔴 el detector marca una factura de la serie vieja.');
});

test('SCRUM-1260c · ② por `allocateInvoiceNumber` real, ningún modo, prefijo ni fecha da un número J-', async () => {
  const numeros = [];
  let rechazadas = 0;
  const modos = new Set();
  for (const c of COMERCIOS) {
    assert.equal(getEmissionMode(c.m), c.modo,
      `🔴 «${c.nombre}» da modo ${getEmissionMode(c.m)} y se esperaba ${c.modo}: la población no es la declarada.`);
    modos.add(c.modo);
    for (const prefijo of PREFIJOS) for (const ahora of FECHAS) {
      try {
        numeros.push(await allocateInvoiceNumber(fakeTx(c.m, prefijo, ahora), c.m.id, { camino: 'C6', actor: ACTOR }, ahora));
      } catch (e) {
        assert.equal(e.message, 'invoicing_es_disabled',
          `🔴 «${c.nombre}» / «${prefijo}» lanzó «${e.message}»: no es el rechazo de SCRUM-1027.`);
        assert.equal(c.modo, 'receipt', `🔴 «${c.nombre}» rechazó y sólo el modo receipt rechaza.`);
        rechazadas++;
      }
    }
  }
  const porComercio = PREFIJOS.length * FECHAS.length;
  assert.deepEqual([...modos].sort(), ['demo', 'fiscal', 'receipt']);
  assert.equal(numeros.length, 3 * porComercio, `🔴 salieron ${numeros.length} números y debían ser ${3 * porComercio}`);
  assert.equal(rechazadas, porComercio, `🔴 se rechazaron ${rechazadas} y debían ser ${porComercio}`);
  // Las dos formas de número se han ejercitado: la vieja y la F.
  assert.ok(numeros.some((n) => /^\d{4}-/.test(n)), '🔴 CIEGO: ningún número de la serie vieja.');
  assert.ok(numeros.some((n) => /^F\d{6}$/.test(n)), '🔴 CIEGO: ningún número del formato F.');
  const malos = numeros.filter((n) => isReceiptNumber(n));
  assert.equal(malos.length, 0, `🔴 ${malos.length} de ${numeros.length} números son J-: ${malos.slice(0, 3).join(', ')}`);
});

test('SCRUM-1260c · ③ en los cinco el type es el literal F1, y ningún fichero escribe JUST ni consulta el reconocedor', () => {
  let tipos = 0;
  for (const rel of Object.keys(ESCRITORES)) {
    const sf = fuente(rel);
    for (const r of reservasDe(sf)) for (const t of r.tipos) {
      tipos++;
      assert.ok(ts.isStringLiteral(t) && t.text === 'F1',
        `🔴 ${rel}:${r.linea}: el type es «${t.getText(sf)}» y no 'F1'. La rama JUST se retiró con firma ` +
          'del fundador (SCRUM-1260, comentario 20148): devolverla necesita otra.');
    }
    const prohibidos = [];
    recorrer(sf, (n) => {
      if (ts.isIdentifier(n) && n.text === 'isReceiptNumber') prohibidos.push(`isReceiptNumber (línea ${sf.getLineAndCharacterOfPosition(n.getStart()).line + 1})`);
      if (ts.isStringLiteral(n) && n.text === 'JUST') prohibidos.push(`'JUST' (línea ${sf.getLineAndCharacterOfPosition(n.getStart()).line + 1})`);
    });
    assert.deepEqual(prohibidos, [], `🔴 ${rel} vuelve a nombrar: ${prohibidos.join(', ')}`);
  }
  assert.equal(tipos, 5, `🔴 CIEGO: ${tipos} type leídos de 5.`);
});
