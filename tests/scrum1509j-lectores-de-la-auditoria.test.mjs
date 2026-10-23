// SCRUM-1509j · E — alarma ante LECTORES NUEVOS de la tabla de auditoría.
//
// Decisión del fundador «A + E» (SCRUM-1508 c.20470): `recordAudit` se llama sin esperar y se
// traga su error (`audit.service.ts`, carril S1, no se toca). Eso vale para dejar constancia,
// pero no para DECIDIR: el reintento de SCRUM-1404 contó esas filas como tope y, si la anotación
// fallaba, el reintento era infinito (SCRUM-1508). Este test no arregla nada: cae en cuanto
// alguien escribe un lector nuevo de `AuditLog`, para que decida a sabiendas si puede fiarse de
// una fila que pudo no escribirse.
//
// Cómo se mide: AST de TypeScript sobre todos los `.ts` de `src/`. Un lector es
//   · una llamada `<algo>.auditLog.<método de lectura>(…)` (con cualquier cliente: `prisma`,
//     `tx`, un parámetro), o
//   · un texto o plantilla que nombre la tabla física `audit_log` (SQL a mano).
// Se identifica por fichero + función que lo contiene (no por línea: la línea caduca).
//
// Si cae: el lector nuevo, o se añade a LECTORES_CONOCIDOS con su porqué (y quien lo añade ha
// mirado qué pasa si la fila no está), o se reescribe sin leer la auditoría. Si cae porque un
// lector conocido DESAPARECIÓ, se quita de la lista: la lista es el conjunto exacto, no un tope.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const METODOS_DE_LECTURA = new Set([
  'findMany', 'findFirst', 'findFirstOrThrow', 'findUnique', 'findUniqueOrThrow',
  'count', 'aggregate', 'groupBy',
]);

// fichero · función que lo contiene · cuántas lecturas · por qué puede fiarse de la fila
export const LECTORES_CONOCIDOS = [
  // `portabilidad_*` se escriben ESPERANDO la escritura (no por `recordAudit`), SCRUM-1508 c.18868.
  { fichero: 'src/modules/exports/domain/portabilidadRegistro.ts', funcion: 'solicitudesPendientes', lecturas: 2 },
  // `sellado_fallido` como tope del reintento: tiene un segundo cinturón que no depende de la
  // auditoría (SCRUM-1404 c.18857).
  { fichero: 'src/modules/invoicing/domain/reintentoSellado.ts', funcion: 'reintentarSelladosPendientes', lecturas: 1 },
];

function nombreDe(nodo) {
  for (let n = nodo.parent; n; n = n.parent) {
    if ((ts.isFunctionDeclaration(n) || ts.isMethodDeclaration(n)) && n.name) return n.name.getText();
    if ((ts.isArrowFunction(n) || ts.isFunctionExpression(n)) && ts.isVariableDeclaration(n.parent)) return n.parent.name.getText();
  }
  return '(módulo)';
}

/** Lectores de la auditoría en UN fuente. Devuelve { lectores: [{funcion, como}], nodos }. */
export function lectoresEn(texto, fichero = 'x.ts') {
  const sf = ts.createSourceFile(fichero, texto, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const lectores = [];
  let nodos = 0;
  const visitar = (n) => {
    nodos += 1;
    if (ts.isCallExpression(n) && ts.isPropertyAccessExpression(n.expression)) {
      const metodo = n.expression.name.text;
      const objeto = n.expression.expression;
      const modelo = ts.isPropertyAccessExpression(objeto) ? objeto.name.text
        : ts.isElementAccessExpression(objeto) && ts.isStringLiteralLike(objeto.argumentExpression) ? objeto.argumentExpression.text
          : null;
      if (modelo === 'auditLog' && METODOS_DE_LECTURA.has(metodo)) lectores.push({ funcion: nombreDe(n), como: `auditLog.${metodo}` });
    }
    if ((ts.isStringLiteralLike(n) || ts.isTemplateHead(n) || ts.isTemplateMiddle(n) || ts.isTemplateTail(n))
      && /\baudit_log\b/i.test(n.text)) lectores.push({ funcion: nombreDe(n), como: 'SQL audit_log' });
    ts.forEachChild(n, visitar);
  };
  visitar(sf);
  return { lectores, nodos };
}

function fuentesDeSrc() {
  const fuera = [];
  const andar = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) andar(p);
      else if (e.name.endsWith('.ts') && !e.name.endsWith('.d.ts')) fuera.push(p);
    }
  };
  andar(path.join(RAIZ, 'src'));
  return fuera;
}

const clave = (l) => `${l.fichero} · ${l.funcion}`;

test('POSITIVO sembrado: el detector ve las cuatro formas de leer la auditoría', () => {
  const { lectores } = lectoresEn([
    'async function a() { return prisma.auditLog.count({ where: {} }); }',
    'const b = async (tx) => tx.auditLog\n  .findFirst({ where: {} });',
    "async function c(cliente) { return cliente['auditLog'].groupBy({ by: ['action'] }); }",
    'async function d() { return prisma.$queryRaw`SELECT * FROM "audit_log" WHERE merchant_id = ${1}`; }',
  ].join('\n'));
  assert.deepEqual(lectores.map((l) => `${l.funcion}:${l.como}`).sort(),
    ['a:auditLog.count', 'b:auditLog.findFirst', 'c:auditLog.groupBy', 'd:SQL audit_log'],
    'el detector no ve una forma de lectura que sabemos que existe: un verde suyo no diría nada');
});

test('CERO: escribir en la auditoría, o leer otra tabla, no es leerla', () => {
  const { lectores, nodos } = lectoresEn([
    'async function a() { await prisma.auditLog.create({ data: {} }); }',
    'async function b() { return prisma.auditLogs.findMany({}); }',
    'async function c() { return prisma.invoice.findMany({ where: { auditLog: 1 } }); }',
  ].join('\n'));
  assert.ok(nodos > 20, `el fuente de control no se llegó a recorrer (${nodos} nodos)`);
  assert.deepEqual(lectores, [], 'el detector cuenta como lector algo que no lee la auditoría');
});

test('ALARMA: los lectores de AuditLog en src/ son exactamente los conocidos', () => {
  const ficheros = fuentesDeSrc();
  let nodos = 0;
  const vistos = new Map();
  for (const f of ficheros) {
    const r = lectoresEn(fs.readFileSync(f, 'utf8'), f);
    nodos += r.nodos;
    for (const l of r.lectores) {
      const k = clave({ fichero: path.relative(RAIZ, f).split(path.sep).join('/'), funcion: l.funcion });
      vistos.set(k, (vistos.get(k) || 0) + 1);
    }
  }
  // Población declarada: si no recorre src/, ni el verde ni el rojo valen.
  assert.ok(ficheros.length > 200 && nodos > 100000, `población: ${ficheros.length} ficheros, ${nodos} nodos — no recorrió src/`);
  const esperados = new Map(LECTORES_CONOCIDOS.map((l) => [clave(l), l.lecturas]));
  const nuevos = [...vistos].filter(([k, n]) => esperados.get(k) !== n);
  const idos = [...esperados].filter(([k]) => !vistos.has(k));
  assert.deepEqual({ nuevos, idos }, { nuevos: [], idos: [] },
    `Lectores de la auditoría sobre ${ficheros.length} ficheros y ${nodos} nodos de src/.\n` +
    '«nuevos»: alguien lee AuditLog y `recordAudit` no espera ni avisa si no escribe (SCRUM-1508): ' +
    'antes de añadirlo a LECTORES_CONOCIDOS, mide qué decide si la fila no está.\n' +
    '«idos»: un lector conocido ya no está: quítalo de la lista.');
});

export const MUTACIONES_QUE_ME_TUMBAN = [
  {
    // El detector deja de ver los recuentos.
    fichero: 'tests/scrum1509j-lectores-de-la-auditoria.test.mjs',
    de: "  'count', 'aggregate', 'groupBy',",
    a: "  'aggregate', 'groupBy',",
    cae: 'POSITIVO sembrado',
  },
  {
    // Un lector conocido sale de la lista: el que había pasa a ser «nuevo».
    fichero: 'tests/scrum1509j-lectores-de-la-auditoria.test.mjs',
    de: "funcion: 'reintentarSelladosPendientes', lecturas: 1 },",
    a: "funcion: 'reintentarSelladosPendientes', lecturas: 0 },",
    cae: 'ALARMA',
  },
];
