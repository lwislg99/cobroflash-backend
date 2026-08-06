// tests/scrum296-lector-tenencia.test.mjs — SCRUM-296 (A6) · el lector del libro, por AST.
//
// ⚠️ ESTE GUARD NO NECESITA BASE Y POR ESO EXISTE.
//
// La medición de verdad —dos merchants contra Postgres— vive en `scrum296-libro-postgres`, y
// está GATEADA: sin base no corre. Un ticket cuyo único guard de tenencia esté detrás de un gate
// es un ticket cuyo guard el CI no ejecuta nunca. Éste corre siempre, en `npm test`, y comprueba
// por ESTRUCTURA lo que el otro comprueba por comportamiento: que las tres consultas del lector
// llevan `merchantId`.
//
// Por AST y no por `grep`: un guard de texto se caza a sí mismo en el comentario que explica la
// prohibición, y además `grep merchantId` daría verde con el `merchantId` de OTRA consulta. Aquí
// se pregunta por el `where` de CADA `findMany`, que es la pregunta de verdad.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const RAIZ = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const LECTOR = 'src/modules/invoicing/domain/libroRegistro.repo.ts';

function arbol(rel) {
  const ruta = path.join(RAIZ, rel);
  assert.ok(fs.existsSync(ruta),
    `🔴 no existe ${rel}: el guard no puede obtener su referencia. Un guard que no puede mirar ` +
    'FALLA y lo dice; nunca pasa por no poder mirar.');
  const codigo = fs.readFileSync(ruta, 'utf8');
  return ts.createSourceFile(ruta, codigo, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
}

/** Todas las llamadas `algo.findMany({...})` del fichero, con el modelo al que se piden. */
function consultasFindMany(sf) {
  const out = [];
  const visitar = (n) => {
    if (
      ts.isCallExpression(n) &&
      ts.isPropertyAccessExpression(n.expression) &&
      n.expression.name.text === 'findMany'
    ) {
      // `db.invoice.findMany` → el modelo es el segmento de en medio.
      const objeto = n.expression.expression;
      const modelo = ts.isPropertyAccessExpression(objeto) ? objeto.name.text : '(desconocido)';
      const arg = n.arguments[0];
      out.push({ modelo, arg, linea: sf.getLineAndCharacterOfPosition(n.getStart()).line + 1 });
    }
    ts.forEachChild(n, visitar);
  };
  visitar(sf);
  return out;
}

/** ¿El objeto `where` de esa llamada tiene una propiedad `merchantId`? */
function whereConMerchant(arg) {
  if (!arg || !ts.isObjectLiteralExpression(arg)) return false;
  const where = arg.properties.find(
    (p) => ts.isPropertyAssignment(p) && p.name && p.name.getText() === 'where',
  );
  if (!where || !ts.isPropertyAssignment(where) || !ts.isObjectLiteralExpression(where.initializer)) {
    return false;
  }
  return where.initializer.properties.some(
    (p) => ts.isPropertyAssignment(p) && p.name && p.name.getText() === 'merchantId',
  );
}

test('SCRUM-296 · SUELO: hay consultas que auditar en el lector', () => {
  const consultas = consultasFindMany(arbol(LECTOR));
  assert.ok(consultas.length >= 3,
    `🔴 el AST solo ha encontrado ${consultas.length} \`findMany\` en el lector, y son 3 ` +
    '(facturas, presupuestos firmados, albaranes).\n\n' +
    '  «No hay consultas sin filtrar» y «no supe encontrar las consultas» son el mismo número: ' +
    'cero.\n  Si el lector cambió de forma, arregla el extractor ANTES de creerte su verde.');
});

test('SCRUM-296 · TODAS las consultas del lector filtran por merchantId', () => {
  const sinFiltro = consultasFindMany(arbol(LECTOR))
    .filter((c) => !whereConMerchant(c.arg))
    .map((c) => `${c.modelo}.findMany (línea ${c.linea})`);

  assert.deepEqual(sinFiltro, [],
    `🔴 estas consultas del libro NO filtran por merchantId: ${sinFiltro.join(', ')}.\n\n` +
    '  En un libro de registro, colar la factura de otro no es una fuga de datos: es DECLARAR\n' +
    '  COMO PROPIA LA FACTURACIÓN DE UN TERCERO. El filtro va en la consulta, no solo en el\n' +
    '  constructor — el constructor es la segunda cerradura, no la primera.');
});

test('SCRUM-296 · el lector NO escribe (regla 38: leer el camino de emisión no es tocarlo)', () => {
  const sf = arbol(LECTOR);
  const PROHIBIDOS = ['create', 'createMany', 'update', 'updateMany', 'upsert', 'delete', 'deleteMany',
    '$executeRaw', '$executeRawUnsafe', 'allocateInvoiceNumber'];
  const encontrados = [];
  const visitar = (n) => {
    if (ts.isCallExpression(n) && ts.isPropertyAccessExpression(n.expression)) {
      const m = n.expression.name.text;
      if (PROHIBIDOS.includes(m)) {
        encontrados.push(`${m} (línea ${sf.getLineAndCharacterOfPosition(n.getStart()).line + 1})`);
      }
    }
    ts.forEachChild(n, visitar);
  };
  visitar(sf);

  assert.deepEqual(encontrados, [],
    `🔴 el lector del libro ESCRIBE: ${encontrados.join(', ')}.\n\n` +
    '  Leer el camino de emisión no es STOP; escribir en él sí (regla 38), y un libro de\n' +
    '  registro no tiene ningún motivo para modificar lo que solo tiene que enseñar.');
});

test('SCRUM-296 · la firma del cliente NO viaja al libro', () => {
  // `Quote.signatureUrl` es un data-URI con el trazo: dato personal, y decenas de KB por fila.
  // El libro necesita SABER si existe, no tenerlo. El filtro se resuelve en Postgres.
  const sf = arbol(LECTOR);
  const selects = [];
  const visitar = (n) => {
    if (ts.isPropertyAssignment(n) && n.name.getText() === 'select' && ts.isObjectLiteralExpression(n.initializer)) {
      for (const p of n.initializer.properties) {
        if (ts.isPropertyAssignment(p) && p.name) selects.push(p.name.getText());
      }
    }
    ts.forEachChild(n, visitar);
  };
  visitar(sf);

  assert.ok(selects.length > 0, '🔴 el extractor no ha encontrado ningún `select`: no está midiendo nada.');
  assert.ok(!selects.includes('signatureUrl'),
    '🔴 el lector se trae `signatureUrl`. Es el trazo del cliente (dato personal) y pesa: al ' +
    'libro solo le hace falta el HECHO de que existe, y eso se resuelve con el `where`.');
});
