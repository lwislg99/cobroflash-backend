// tests/scrum1257-p8-detalle-receipt-sin-justificantes.test.mjs — SCRUM-1257 (P8)
//
// EL DETALLE DEL MODO `receipt` EN AJUSTES DEJA DE NOMBRAR EL JUSTIFICANTE. Decía «Por ahora, YaQu no
// genera facturas ni justificantes desde tu cuenta.». Era cierto, pero nombraba una figura que ya no
// se puede crear: ninguna petición puede escribir hoy un documento de tipo justificante (medido el
// 1-oct-2026, registro en `docs/master/SCRUM-1257.md`, sección SCRUM-1257d).
//
// El texto nuevo NO afirma nada sobre justificantes: solo deja de mencionarlos. Es, carácter a
// carácter, el P2 que ya se pinta en el vacío de Facturas (firmado en SCRUM-1257 comentario 17444).
//
// 🔴 LO QUE ESTE FICHERO VIGILA ADEMÁS DEL LITERAL: que al quitar la palabra de UN sitio no se haya ido
// de más. El censo de la casa (`tests/banco-scrum1257/`) tiene que seguir viendo los cinco rótulos de
// los documentos `J-` antiguos, que NO se renombran (regla 29, SCRUM-1252). Sin ese positivo, «ya no
// sale la palabra» sería cierto también si alguien los hubiera borrado.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import ts from 'typescript';
import { constaAprobado } from './_microcopy-aprobada.mjs';

const RAIZ = path.resolve(import.meta.dirname, '..');
const JS = (f) => path.join(RAIZ, 'public/dashboard/js', f);
const CENSO = path.join(RAIZ, 'tests/banco-scrum1257/censo-vocabulario-justificante.mjs');

const P8 = 'Por ahora, YaQu no genera facturas desde tu cuenta.';
const VIEJO = 'Por ahora, YaQu no genera facturas ni justificantes desde tu cuenta.';
const REGISTRO_P8 = '2026-10-01-SCRUM-1257-detalle-modo-receipt.md';

function arbol(fuente, nombre = 'x.js') {
  return ts.createSourceFile(nombre, fuente, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
}

/** Los literales de una fuente (no sus comentarios: el código cita ahí el texto viejo, con su motivo). */
function literalesDe(fuente) {
  const out = new Set();
  (function v(n) {
    if (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) out.add(n.text);
    ts.forEachChild(n, v);
  })(arbol(fuente));
  return out;
}

/** El valor literal de `const <objeto> = { …, <clave>: '…' }`; `null` si no lo encuentra. */
function valorDe(fuente, objeto, clave) {
  let valor = null;
  const sf = arbol(fuente);
  (function v(n) {
    if (ts.isVariableDeclaration(n) && n.name.getText(sf) === objeto
      && n.initializer && ts.isObjectLiteralExpression(n.initializer)) {
      for (const p of n.initializer.properties) {
        if (ts.isPropertyAssignment(p) && p.name.getText(sf) === clave && ts.isStringLiteral(p.initializer)) {
          valor = p.initializer.text;
        }
      }
    }
    ts.forEachChild(n, v);
  })(sf);
  return valor;
}

/**
 * El censo de la casa, EJECUTADO sobre este árbol. Devuelve `{ total, filas: ['fichero\ttexto'] }`.
 * La fila se identifica por fichero y TEXTO, no por línea: una línea se mueve con cualquier edición.
 *
 * El hijo es un `node` suelto, no un `node --test`, pero su entorno se construye a mano igual
 * (SCRUM-1308): con el `NODE_OPTIONS` del CI heredado, un hijo escribe en el TAP de la tanda.
 */
function censo() {
  const env = { ...process.env };
  delete env.NODE_TEST_CONTEXT;
  delete env.NODE_OPTIONS;
  delete env.FORCE_COLOR;
  const r = spawnSync(process.execPath, [CENSO, RAIZ, RAIZ], { encoding: 'utf8', env });
  assert.equal(r.status, 0, `🔴 CIEGO: el censo no arrancó (status ${r.status})\n${r.stderr}`);
  const lineas = r.stdout.split(/\r?\n/).filter(Boolean);
  const cabecera = /^literales: (\d+) · comentarios: (\d+)$/.exec(lineas[0] ?? '');
  assert.ok(cabecera, `🔴 CIEGO: el censo no imprimió su cabecera: «${lineas[0]}»`);
  const filas = lineas.slice(1).map((l) => {
    const [sitio, texto] = l.split('\t');
    return `${sitio.replace(/:\d+$/, '')}\t${texto}`;
  });
  assert.equal(filas.length, Number(cabecera[1]), '🔴 CIEGO: el censo dice un total y lista otro');
  return { total: Number(cabecera[1]), filas };
}

// Los cinco que NO se renombran (grupo D del censo): solo se ven con documentos `J-` antiguos.
const NO_SE_RENOMBRAN = [
  'cobrosView.js\tNo se pudo enviar el justificante al cliente por email.',
  'invoiceDetailView.js\tJustificante de cobro',
  'invoiceDetailView.js\tDetalle y acciones del justificante.',
  'invoiceDetailView.js\tJUSTIFICANTE',
  'jobDetailView.js\tJustificante',
];
// Las dos ramas `J-` de P6 y P7 (mismo criterio que los cinco) y los tres valores de código que
// comparan la palabra: no son rótulos.
const EL_RESTO = [
  'invoiceDetailView.js\tPresupuesto firmado + evidencia de aceptación + justificante + registro de mensajes, listo para responder al banco',
  'quotesDetailView.js\t🧾 Ver justificante',
  'invoicesView.js\tjustificante',
  'jobDocsReparto.js\tjustificante',
  'jobRailBlocks.js\tjustificante',
];

test('SCRUM-1257 P8 · control: los dos detectores ven lo que tienen que ver en una fuente sintética', () => {
  const fuente = `// ${P8}\nconst DETALLE = { fiscal: 'a', receipt: '${VIEJO}' };`;
  assert.equal(valorDe(fuente, 'DETALLE', 'receipt'), VIEJO);
  assert.equal(valorDe(fuente, 'DETALLE', 'otra'), null);
  assert.equal(literalesDe(fuente).has(VIEJO), true);
  // P8 solo está en el COMENTARIO de la fuente sintética: no es un literal.
  assert.equal(literalesDe(fuente).has(P8), false);
});

test('SCRUM-1257 P8 · el detalle de `receipt` en Ajustes es el texto firmado', () => {
  const fuente = fs.readFileSync(JS('settingsView.js'), 'utf8');
  assert.equal(valorDe(fuente, 'DETALLE_MODO_EMISION', 'receipt'), P8);
  // Y las otras dos ramas siguen ahí: no se ha tocado más que una.
  assert.equal(typeof valorDe(fuente, 'DETALLE_MODO_EMISION', 'fiscal'), 'string');
  assert.equal(typeof valorDe(fuente, 'DETALLE_MODO_EMISION', 'demo'), 'string');
});

test('SCRUM-1257 P8 · el texto viejo ya no es un literal de Ajustes', () => {
  const lits = literalesDe(fs.readFileSync(JS('settingsView.js'), 'utf8'));
  assert.equal(lits.has(VIEJO), false, `🔴 settingsView.js sigue pintando «${VIEJO}»`);
  // Control positivo: el mismo detector SÍ encuentra un literal que sigue en el fichero.
  assert.equal(lits.has('Aún no se emiten documentos'), true);
});

test('SCRUM-1257 P8 · el censo baja a 10, Ajustes sale de él y los cinco de la regla 29 SIGUEN', () => {
  const { total, filas } = censo();
  for (const f of NO_SE_RENOMBRAN) {
    assert.equal(filas.includes(f), true,
      `🔴 el censo ya no ve «${f.replace('\t', ' · ')}». Es un rótulo de un documento J- ya emitido:\n`
      + '  no se renombra ni se quita sin la decisión de SCRUM-1252 (regla 29).');
  }
  assert.equal(filas.some((f) => f.startsWith('settingsView.js\t')), false,
    '🔴 Ajustes sigue en el censo del «justificante»');
  // El conjunto entero, por identidad. Si cambia NO es un fallo del test: es que alguien ha añadido o
  // quitado un texto con la palabra, y eso se decide (texto de usuario, regla 39) y se escribe aquí.
  assert.deepEqual([...filas].sort(), [...NO_SE_RENOMBRAN, ...EL_RESTO].sort());
  assert.equal(total, 10);
});

test('SCRUM-1257 P8 · la firma de ESTA ranura consta en su propio registro', () => {
  const donde = constaAprobado(P8);
  assert.equal(donde.some((r) => r.endsWith(REGISTRO_P8)), true,
    `🔴 «${P8}» no consta firmado para Ajustes en ${REGISTRO_P8} (consta en: ${donde.join(', ') || 'ninguno'})`);
});
