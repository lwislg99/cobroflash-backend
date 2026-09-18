// SCRUM-917d · GET /admin/jobs trae el nombre PROPIO del Trabajo, a secas (`tituloPropio`).
//
// La lista de Trabajos (S2b, 917c) pinta el cliente en su propia columna. Con `titulo` sólo —que
// ya llega DERIVADO: «Presupuesto #5 · María López» cuando nadie le puso nombre— no podía saber si
// ese texto lo escribió alguien, y repetía el cliente. Medido en staging el 18-sep-2026 sobre
// origin/main 27a7fb8b: 15 trabajos, 12 sin `Job.titulo`, y ninguna clave de la fila con el crudo.
//
// Tres cosas, y cada una cae por lo suyo (verificado en rojo, ver docs/master/SCRUM-917.md):
//   1. qué devuelve (el crudo o null),
//   2. que su criterio de «tiene nombre» es el MISMO que el de `tituloDeTrabajo`,
//   3. que `serializeJob` —el que sirven la lista y el detalle— lo lleva, leído por AST.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { tituloDeTrabajo, tituloPropioDeTrabajo } from '../dist/modules/jobs/domain/trabajoDirecto.js';

const RAIZ = path.resolve(import.meta.dirname, '..');
const RUTAS = 'src/modules/jobs/app/routes/jobs.routes.ts';

test('SCRUM-917d · el nombre propio es Job.titulo tal cual, o null si no hay', () => {
  assert.equal(tituloPropioDeTrabajo({ titulo: 'Avería cocina' }), 'Avería cocina');
  assert.equal(tituloPropioDeTrabajo({ titulo: null }), null);
  assert.equal(tituloPropioDeTrabajo({ titulo: '' }), null, '🔴 una cadena vacía no es un nombre: tiene que viajar null');
  assert.equal(tituloPropioDeTrabajo({}), null);
});

test('SCRUM-917d · 🔴 el MISMO criterio que tituloDeTrabajo: si hay nombre propio, es el título', () => {
  const casos = [
    { titulo: 'Avería cocina', quote: null, customer: { name: 'Bar Paco' }, jobId: 12 },
    { titulo: 'Avería cocina', quote: { quoteNumber: 34, id: 9 }, customer: { name: 'Bar Paco' }, jobId: 12 },
    { titulo: null, quote: { quoteNumber: 34, id: 9 }, customer: { name: 'Bar Paco' }, jobId: 12 },
    { titulo: '', quote: null, customer: { name: 'Bar Paco' }, jobId: 12 },
    { titulo: null, quote: null, customer: null, jobId: 12 },
  ];
  let conNombre = 0;
  let sinNombre = 0;
  for (const c of casos) {
    const propio = tituloPropioDeTrabajo(c);
    const derivado = tituloDeTrabajo(c);
    if (propio !== null) {
      conNombre++;
      assert.equal(derivado, propio, `🔴 hay nombre propio (${JSON.stringify(propio)}) y el título dice otra cosa (${JSON.stringify(derivado)})`);
    } else {
      sinNombre++;
      // Sin nombre propio el título es DERIVADO, y no puede ser el crudo vacío.
      assert.ok(derivado && derivado !== c.titulo, `🔴 sin nombre propio el título tenía que derivarse: ${JSON.stringify(derivado)}`);
    }
  }
  // Suelo: el barrido ve las dos ramas; si no, «todos coinciden» sería sobre la mitad.
  assert.equal(conNombre, 2);
  assert.equal(sinNombre, 3);
});

/** Las propiedades del objeto que DEVUELVE `serializeJob`, por AST: nombre → inicializador. */
function propiedadesDeSerializeJob() {
  const fuente = fs.readFileSync(path.join(RAIZ, RUTAS), 'utf8');
  const sf = ts.createSourceFile('r.ts', fuente, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  let fn = null;
  (function busca(n) {
    if (ts.isFunctionDeclaration(n) && n.name?.text === 'serializeJob') fn = n;
    else ts.forEachChild(n, busca);
  })(sf);
  assert.ok(fn, `🔴 no encuentro la función serializeJob en ${RUTAS}: este test está ciego`);
  const props = new Map();
  for (const st of fn.body.statements) {
    if (ts.isReturnStatement(st) && st.expression && ts.isObjectLiteralExpression(st.expression)) {
      for (const p of st.expression.properties) {
        if (ts.isPropertyAssignment(p) && p.name && ts.isIdentifier(p.name)) props.set(p.name.text, p.initializer);
      }
    }
  }
  return props;
}

const llamadaA = (nodo, nombre) =>
  !!nodo && ts.isCallExpression(nodo) && ts.isIdentifier(nodo.expression) && nodo.expression.text === nombre;

test('SCRUM-917d · 🔴 serializeJob (lista Y detalle) lleva tituloPropio = tituloPropioDeTrabajo(job)', () => {
  const props = propiedadesDeSerializeJob();
  // CONTROL POSITIVO: el recorrido ve el objeto devuelto — `titulo` sale de `tituloDeTrabajo`.
  assert.ok(llamadaA(props.get('titulo'), 'tituloDeTrabajo'),
    `🔴 el AST no ve \`titulo: tituloDeTrabajo(...)\` en el return de serializeJob (${props.size} propiedades): el test no está mirando`);
  const init = props.get('tituloPropio');
  assert.ok(init, '🔴 GET /admin/jobs ya no trae `tituloPropio`: la lista vuelve a no poder separar el nombre del cliente');
  assert.ok(llamadaA(init, 'tituloPropioDeTrabajo'), '🔴 `tituloPropio` no sale de tituloPropioDeTrabajo: sería un segundo criterio');
  const [arg] = init.arguments;
  assert.ok(arg && ts.isIdentifier(arg) && arg.text === 'job', '🔴 `tituloPropio` tiene que leerse del propio Job');
});
