// tests/scrum1408-asignar-no-es-un-permiso.test.mjs — SCRUM-1408
//
// EL GUARD QUE UN COMENTARIO PROMETÍA DESDE EL 7-SEP-2026 Y QUE NO EXISTÍA.
//
// `src/core/documentos/asignacionDeDocumento.ts` decía: «este fichero no exporta nada que responda
// "¿puede?", y hay un guard que lo comprueba». Medido el 7-oct-2026: ningún test nombraba el
// módulo, y el commit que escribió la frase (e69ec1537, SCRUM-597) no trajo ninguno estructural.
// Lo más parecido era el caso NEGATIVO de `scrum597` (seis acciones dan 403): comportamiento, no
// estructura. Un «¿puede?» nuevo en ese fichero no lo habría visto nadie.
//
// Lo que se vigila aquí son DOS propiedades (las formulaciones A y B de SCRUM-1408 c.18763):
//
//   A · el fichero exporta EXACTAMENTE lo declarado abajo, y ninguna función exportada contesta
//       sí o no. Un export nuevo cae: quien lo añada decide aquí, a la vista, qué es.
//   B · la asignación al documento sólo la tocan los ficheros de `QUIEN_TOCA_LA_ASIGNACION`, cada
//       uno con su papel. Dos de ellos DECIDEN, y sólo para VER (fundador, 1-oct-2026,
//       SCRUM-1390 c.17962; construido en SCRUM-1397 y SCRUM-1403). Un tercero cae.
//
// La frase original prometía más: «nadie lee `quote_assignees` para decidir un 403». Eso dejó de
// ser verdad a propósito el 2-oct, así que un guard con la propiedad literal nacería rojo. B es
// lo que queda de ella.
//
// LO QUE ESTE GUARD NO VE, y se dice:
//   · dentro de las dos puertas no distingue VER de EDITAR: si alguien reutiliza su `where` en
//     una ruta de escritura, calla. Eso es comportamiento, y lo más cercano sigue siendo `scrum597`.
//   · los dos ficheros de rutas reciben la lista de asignados para PINTARLA. Si un día la usan en
//     un `if`, calla: aquí se mira quién la pide, no qué hace con ella.
//   · un acceso con el nombre calculado (`prisma[nombre]`) no tiene literal que encontrar.
//   · `normalizarAsignados` se reexporta desde los Trabajos: aquí se mira su nombre, no su tipo.
//
// ⚠️ EL COMENTARIO DEL MÓDULO TODAVÍA NO NOMBRA ESTE FICHERO. `src/core/documentos/**` es carril
// de S1 (`docs/equipo/dos-equipos.md` §3.1) y este test lo escribió J2: el módulo se lee, no se
// edita. La frase que le falta está propuesta a su dueño en el registro `docs/master/SCRUM-1408.md`.
//
// Sólo LEE `src/`, por AST: un comentario que nombra la tabla no es un uso. No necesita `dist/`
// ni base.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const RAIZ = path.resolve(import.meta.dirname, '..');
const MODULO = 'src/core/documentos/asignacionDeDocumento.ts';
const ESTE_TEST = 'tests/scrum1408-asignar-no-es-un-permiso.test.mjs';

/**
 * Lo que exporta el módulo, por NOMBRE. Lista cerrada: se compara el conjunto, no la cuenta.
 * Añadir aquí una línea es DECIDIR que ese export no contesta «¿puede?»; si lo contesta, su
 * sitio es una de las dos puertas de abajo, no este fichero.
 */
const EXPORTA = [
  'ClienteDeAsignacionDeDocumento',
  'DOCUMENTOS_ASIGNABLES',
  'DocumentoAsignable',
  'escribirAsignadosDeDocumento',
  'leerAsignadosDeDocumento',
  'normalizarAsignados',
];

/**
 * Quién toca la asignación al documento en `src/`, y para qué. `usos` es lo que el lector de
 * abajo encuentra en el fichero:
 *   · `relacion` — filtra o trae la relación `asignados` de un presupuesto o una factura;
 *   · `modelo`   — nombra las tablas puente o sus modelos de Prisma;
 *   · `importa`  — importa el módulo.
 */
const QUIEN_TOCA_LA_ASIGNACION = {
  'src/core/documentos/accesoALaFactura.ts': {
    usos: ['relacion'],
    papel: 'DECIDE, y sólo VER: la puerta de las facturas (SCRUM-1397; firma en SCRUM-1390 c.17962)',
  },
  'src/core/documentos/accesoAlPresupuesto.ts': {
    usos: ['relacion'],
    papel: 'DECIDE, y sólo VER: la puerta de los presupuestos (SCRUM-1403)',
  },
  'src/core/documentos/asignacionDeDocumento.ts': {
    usos: ['modelo'],
    papel: 'escribe la asignación y devuelve la lista; no decide nada (propiedad A)',
  },
  'src/modules/system/app/routes/invoicesAdmin.routes.ts': {
    usos: ['importa'],
    papel: 'pinta los asignados en la ficha y los guarda desde una ruta sólo de admin',
  },
  'src/modules/system/app/routes/quotesAdmin.routes.ts': {
    usos: ['importa'],
    papel: 'pinta los asignados en la ficha y los guarda desde una ruta sólo de admin',
  },
  'src/modules/system/domain/borradoMerchant.ts': {
    usos: ['modelo'],
    papel: 'mapa de borrado del negocio: dice cómo se van las filas, no decide ningún acceso',
  },
};

// ── Los tres lectores. Reciben el TEXTO de un fuente, para poder probarlos con uno fabricado ──

const tieneExport = (n) => (ts.getModifiers?.(n) ?? n.modifiers ?? []).some((m) => m.kind === ts.SyntaxKind.ExportKeyword);
const analiza = (fuente) => ts.createSourceFile('fuente.ts', fuente, ts.ScriptTarget.Latest, true);

/** Los nombres que exporta un fuente. `export *` y `export default` salen con ese nombre. */
function exportacionesDe(fuente) {
  const out = [];
  for (const s of analiza(fuente).statements) {
    if (ts.isExportAssignment(s)) out.push('export default');
    else if (ts.isExportDeclaration(s)) {
      if (s.exportClause && ts.isNamedExports(s.exportClause)) for (const e of s.exportClause.elements) out.push(e.name.text);
      else out.push('export *');
    } else if (tieneExport(s)) {
      if (ts.isVariableStatement(s)) for (const d of s.declarationList.declarations) out.push(d.name.getText());
      else out.push(s.name ? s.name.text : 'export default');
    }
  }
  return out.sort();
}

/** ¿El tipo contesta sí o no? `boolean`, `true`/`false`, o un predicado (`x is T`), a cualquier profundidad. */
function contestaSiONo(tipo) {
  let si = false;
  const visita = (n) => {
    if (n.kind === ts.SyntaxKind.BooleanKeyword || n.kind === ts.SyntaxKind.TrueKeyword
      || n.kind === ts.SyntaxKind.FalseKeyword || ts.isTypePredicateNode(n)) si = true;
    ts.forEachChild(n, visita);
  };
  visita(tipo);
  return si;
}

/**
 * Las funciones exportadas de un fuente que contestan sí o no, o cuyo tipo de vuelta no está
 * escrito. Lo segundo también es un fallo: lo que no se puede mirar no se da por bueno.
 */
function funcionesQueContestan(fuente) {
  const out = [];
  const juzga = (nombre, fn) => {
    if (!fn.type) out.push(`${nombre}: sin tipo de vuelta escrito`);
    else if (contestaSiONo(fn.type)) out.push(`${nombre}: devuelve ${fn.type.getText()}`);
  };
  for (const s of analiza(fuente).statements) {
    if (!tieneExport(s)) continue;
    if (ts.isFunctionDeclaration(s)) juzga(s.name ? s.name.text : 'export default', s);
    if (ts.isVariableStatement(s)) {
      for (const d of s.declarationList.declarations) {
        if (d.initializer && (ts.isArrowFunction(d.initializer) || ts.isFunctionExpression(d.initializer))) juzga(d.name.getText(), d.initializer);
      }
    }
  }
  return out;
}

const MODELOS = ['quoteAssignee', 'invoiceAssignee', 'QuoteAssignee', 'InvoiceAssignee'];
const TABLAS = ['quote_assignees', 'invoice_assignees'];

/** Qué usos de la asignación al documento hay en un fuente. Código, no comentarios. */
function usosDeLaAsignacion(fuente) {
  const usos = new Set();
  const visita = (n) => {
    if (ts.isPropertyAssignment(n) && (ts.isIdentifier(n.name) || ts.isStringLiteral(n.name)) && n.name.text === 'asignados'
      && (ts.isObjectLiteralExpression(n.initializer) || n.initializer.kind === ts.SyntaxKind.TrueKeyword)) usos.add('relacion');
    if (ts.isIdentifier(n) && MODELOS.includes(n.text)) usos.add('modelo');
    if (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n) || ts.isTemplateHead(n) || ts.isTemplateMiddle(n) || ts.isTemplateTail(n)) {
      if ([...MODELOS, ...TABLAS].some((m) => n.text.includes(m))) usos.add('modelo');
      if (/(^|\/)asignacionDeDocumento(\.js|\.ts)?$/.test(n.text)) usos.add('importa');
    }
    ts.forEachChild(n, visita);
  };
  visita(analiza(fuente));
  return [...usos].sort();
}

/** Todos los `.ts` de `src/`, con barras de las de git. */
function fuentesDeSrc() {
  const out = [];
  const baja = (dir) => {
    for (const e of fs.readdirSync(path.join(RAIZ, dir), { withFileTypes: true })) {
      const rel = `${dir}/${e.name}`;
      if (e.isDirectory()) baja(rel);
      else if (e.name.endsWith('.ts')) out.push(rel);
    }
  };
  baja('src');
  return out.sort();
}

// ── Los lectores, probados con fuentes fabricados: el caso malo CAE y su gemelo sano NO ──────

test('SCRUM-1408 · CONTROL: el lector de exportaciones ve cada forma de exportar, y un «¿puede?» fabricado cae', () => {
  assert.deepEqual(exportacionesDe(`
    import { a } from './a';
    export { a };
    export const B = 1, C = 2;
    export type D = number;
    export interface E { x: number }
    export async function f(): Promise<void> {}
    function privada(): boolean { return true; }
    // export function comentada(): boolean { return true; }
  `), ['B', 'C', 'D', 'E', 'a', 'f']);
  assert.deepEqual(exportacionesDe(`export * from './a'; export default 3;`), ['export *', 'export default']);

  // El caso que el ticket pide ver caer: una exportación que contesta «¿puede?». Tres formas.
  assert.deepEqual(funcionesQueContestan(`export function puedeEditar(rol: string): boolean { return rol === 'admin'; }`),
    ['puedeEditar: devuelve boolean']);
  assert.deepEqual(funcionesQueContestan(`export const puedeEmitir = async (id: number): Promise<boolean> => id > 0;`),
    ['puedeEmitir: devuelve Promise<boolean>']);
  assert.deepEqual(funcionesQueContestan(`export function esSuyo(x: unknown): x is number { return true; }`),
    ['esSuyo: devuelve x is number']);
  // Sin tipo escrito no se puede juzgar, y eso no es un verde.
  assert.deepEqual(funcionesQueContestan(`export function leer(id: number) { return id; }`), ['leer: sin tipo de vuelta escrito']);
  // Los gemelos sanos: la MISMA función sin exportar, y una exportada que devuelve una lista.
  assert.deepEqual(funcionesQueContestan(`function puedeEditar(rol: string): boolean { return rol === 'admin'; }`), []);
  assert.deepEqual(funcionesQueContestan(`export async function leer(id: number): Promise<Array<{ id: number }>> { return [{ id }]; }`), []);
});

test('SCRUM-1408 · CONTROL: el lector de usos ve la relación, el modelo y el import, y no un comentario ni los asignados de un Trabajo', () => {
  assert.deepEqual(usosDeLaAsignacion(`const where = { OR: [{ asignados: { some: { teamMemberId: 7 } } }] };`), ['relacion']);
  assert.deepEqual(usosDeLaAsignacion(`const q = await prisma.quote.findMany({ include: { asignados: true } });`), ['relacion']);
  assert.deepEqual(usosDeLaAsignacion(`const filas = await prisma.invoiceAssignee.findMany({ where: { teamMemberId: 7 } });`), ['modelo']);
  assert.deepEqual(usosDeLaAsignacion('const filas = await prisma.$queryRaw`select 1 from quote_assignees where team_member_id = ${id}`;'), ['modelo']);
  assert.deepEqual(usosDeLaAsignacion(`import { leerAsignadosDeDocumento } from '../../../../core/documentos/asignacionDeDocumento';`), ['importa']);
  assert.deepEqual(usosDeLaAsignacion(`const m = await import('./asignacionDeDocumento.js');`), ['importa']);
  // Los gemelos sanos. Un comentario que nombra la tabla, y lo que hacen hoy los Trabajos y las
  // fichas con una variable que se llama igual: nada de eso es leer la asignación al documento.
  assert.deepEqual(usosDeLaAsignacion(`// si un día alguien lee \`quote_assignees\` o prisma.quoteAssignee para decidir un 403…\nconst x = 1;`), []);
  assert.deepEqual(usosDeLaAsignacion(`const asignados = [1, 2]; const cuerpo = { ok: true, asignados }; const t = { asignados: [7] };`), []);
  assert.deepEqual(usosDeLaAsignacion(`interface T { asignados?: readonly number[] } const EJES = ['asignados'] as const;`), []);
  assert.deepEqual(usosDeLaAsignacion(`router.patch('/:id/asignados', (req, res) => res.json({}));`), []);
});

// ── Las dos propiedades, sobre el árbol de verdad ─────────────────────────────────────────────────

test('SCRUM-1408 · A: `asignacionDeDocumento.ts` exporta exactamente lo declarado, y ninguna función exportada contesta sí o no', (t) => {
  const fuente = fs.readFileSync(path.join(RAIZ, MODULO), 'utf8');
  const exporta = exportacionesDe(fuente);
  t.diagnostic(`población: ${exporta.length} exportaciones leídas de ${MODULO}`);
  assert.deepEqual(exporta, [...EXPORTA].sort(),
    `🔴 ${MODULO} ya no exporta lo declarado en ${ESTE_TEST}. Si el export nuevo contesta «¿puede?», su sitio es una de las `
    + 'dos puertas (`accesoALaFactura.ts`, `accesoAlPresupuesto.ts`) y pide firma: asignar no es un permiso. Si no, se declara en EXPORTA.');
  assert.deepEqual(funcionesQueContestan(fuente), [],
    `🔴 ${MODULO} exporta una función que contesta sí o no (o cuyo tipo de vuelta no se puede leer). Asignar no es un permiso.`);
});

test('SCRUM-1408 · B: la asignación al documento sólo la tocan los ficheros declarados, y sólo dos DECIDEN con ella', (t) => {
  const fuentes = fuentesDeSrc();
  const hallado = {};
  for (const rel of fuentes) {
    const usos = usosDeLaAsignacion(fs.readFileSync(path.join(RAIZ, rel), 'utf8'));
    if (usos.length) hallado[rel] = usos;
  }
  t.diagnostic(`población: ${fuentes.length} ficheros .ts de src/ leídos · ${Object.keys(hallado).length} tocan la asignación al documento`);

  // SUELO: el recorrido llegó a los ficheros declarados. Si no, lo de abajo compararía contra nada.
  for (const rel of Object.keys(QUIEN_TOCA_LA_ASIGNACION)) {
    assert.ok(fuentes.includes(rel), `🔴 CIEGO: ${rel} está declarado y el recorrido de src/ no lo ha leído (¿se movió?)`);
  }

  const declarado = Object.fromEntries(Object.entries(QUIEN_TOCA_LA_ASIGNACION).map(([rel, d]) => [rel, [...d.usos].sort()]));
  assert.deepEqual(hallado, declarado,
    '🔴 lo que toca la asignación al documento en src/ no es lo declarado. Un fichero NUEVO: si decide un acceso con la '
    + 'asignación, eso lo firma el fundador (hoy sólo cuenta para VER, SCRUM-1390 c.17962); si no decide, se declara con su papel. '
    + 'Uno que YA NO está: se retira de la lista, que no se queda diciendo lo que no pasa.');

  // «Sólo dos deciden»: por la relación sólo se llega desde las dos puertas.
  const deciden = Object.keys(hallado).filter((rel) => hallado[rel].includes('relacion')).sort();
  assert.deepEqual(deciden, ['src/core/documentos/accesoALaFactura.ts', 'src/core/documentos/accesoAlPresupuesto.ts']);
});
