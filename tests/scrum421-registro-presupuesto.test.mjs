// SCRUM-421 · EL REGISTRO DE ACCIONES DEL PRESUPUESTO, Y SU CONTRASTE CONTRA EL ÁRBOL.
//
// ─────────────────────────────────────────────────────────────────────────────────────────────
// POR QUÉ ESTE REGISTRO NECESITA UN GUARD QUE LOS OTROS TRES NO
//
// `Quote.status` es un **String libre con `@default("draft")`**: no hay enum, así que el modelo NO
// cierra el conjunto de estados. La tabla puede estar completa hoy y quedarse coja mañana sin que
// nada avise — un estado nuevo entraría por una escritura cualquiera.
//
// Por eso la tabla lleva su lista cerrada **más un censo que la contrasta con las escrituras
// reales**. Sin esa segunda mitad, «la ranura nunca queda vacía» es una promesa; con ella es
// aritmética.
//
// ⚠️ Y el censo tiene que ver las escrituras POR VARIABLE. La ruta principal de creación escribe
// `status: initialStatus` (`quotes.routes.ts`), no un literal: un escáner de texto no la ve y el
// guard nacería con el agujero dentro, dando verde mientras un estado se escapa.

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { censarEstadosDePresupuesto, censarFuente } from './_censo-estados-presupuesto.mjs';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const REGISTRO = path.join(RAIZ, 'public/dashboard/js/quoteActionsRegistry.js');

/** Lee la tabla del registro sin ejecutarla como módulo (es un script clásico, regla 4). */
function tabla() {
  const src = fs.readFileSync(REGISTRO, 'utf8');
  const estados = [...src.matchAll(/const QUOTE_STATES = \[([^\]]+)\]/g)]
    .flatMap((m) => [...m[1].matchAll(/'([a-z_]+)'/g)].map((x) => x[1]));
  const filas = [...src.matchAll(/\{\s*id:\s*'(\w+)',\s*destinos:\s*\{([^}]+)\}/g)].map((m) => ({
    id: m[1],
    destinos: Object.fromEntries(
      [...m[2].matchAll(/(\w+):\s*'(\w+)'/g)].map((d) => [d[1], d[2]]),
    ),
  }));
  return { estados, filas };
}

// ── EL SUELO, que aquí es media entrega ──────────────────────────────────────────────────────

test('SCRUM-421 · SUELO: el censo VE escrituras y las resuelve TODAS', () => {
  const r = censarEstadosDePresupuesto(RAIZ);
  assert.ok(r.escrituras.length >= 10,
    `🔴 CIEGO: el censo solo ve ${r.escrituras.length} escrituras de estado (se esperan ≥10). `
    + 'El contraste de abajo pasaría por no mirar.');
  // La diferencia entre «no hay estados fuera de la tabla» y «no supe leer tres escrituras».
  assert.deepEqual(r.sinResolver, [],
    '🔴 CIEGO: hay escrituras de `status` que el AST NO puede resolver:\n    '
    + r.sinResolver.map((s) => `${s.fichero}:${s.linea}  ${s.texto}`).join('\n    ')
    + '\n\n  Mientras exista una sola, el verde de este archivo NO significa «no hay estados\n'
    + '  fuera de la tabla»: significa «no supe mirar». Enséñale a resolverla o decláralo aquí.');
});

test('SCRUM-421 · el falso positivo del `res.json` no vuelve', () => {
  // `quotes.routes.ts` tiene un `status: quote.status` dentro de un `res.json`. Con la ventana de
  // 400 caracteres se contaba como escritura, y con él el suelo de arriba era imposible de exigir
  // sin mentir. Ahora se distingue por ESTRUCTURA: la primera llamada que envuelve al nodo.
  const r = censarFuente('falso.ts', [
    'async function h(req, res) {',
    "  const q = await prisma.quote.create({ data: { status: 'draft' } });",
    '  return res.json({ id: q.id, status: q.status });',
    '}',
  ].join('\n'));
  assert.equal(r.escrituras.length, 1,
    `🔴 el censo cuenta ${r.escrituras.length} escrituras donde solo hay UNA: el cuerpo de la `
    + 'respuesta se está contando como escritura a la tabla.');
  assert.deepEqual(r.escrituras[0].valores, ['draft']);
});

// ── EL CONTRASTE: la tabla contra el árbol ───────────────────────────────────────────────────

test('SCRUM-421 · 🔴 CONTRASTE: ningún estado escrito se queda fuera de la tabla', () => {
  const { estados } = tabla();
  const r = censarEstadosDePresupuesto(RAIZ);
  const escritos = new Set(r.escrituras.flatMap((e) => e.valores));
  const fuera = [...escritos].filter((v) => !estados.includes(v)).sort();
  assert.deepEqual(fuera, [],
    `🔴 EL ÁRBOL ESCRIBE ESTADOS QUE LA TABLA NO CONOCE: ${fuera.join(', ')}.\n\n`
    + '  `Quote.status` es un String libre: nada impide escribir un estado nuevo. Si no entra en\n'
    + '  el registro, ese estado se queda SIN ACCIÓN PRIMARIA — un callejón sin salida en el\n'
    + '  primer documento del ciclo.\n\n'
    + '  QUÉ HACER: añadirlo a `QUOTE_STATES` y darle su columna en cada fila del registro.');
});

test('SCRUM-421 · CONTROL NEGATIVO: un estado que SÍ está en la tabla no cae', () => {
  // Lo que separa este guard de uno que prohíbe escribir estados. Los seis conocidos pasan.
  const { estados } = tabla();
  const r = censarFuente('ok.ts', estados
    .map((e, i) => `await prisma.quote.update({ where: { id: ${i} }, data: { status: '${e}' } });`)
    .join('\n'));
  const escritos = new Set(r.escrituras.flatMap((x) => x.valores));
  const fuera = [...escritos].filter((v) => !estados.includes(v));
  assert.deepEqual(fuera, [], '🔴 el guard cae sobre estados que SÍ están en la tabla');
  assert.equal(escritos.size, estados.length,
    `🔴 el censo solo ve ${escritos.size} de los ${estados.length} estados escritos`);
});

test('SCRUM-421 · 🔴 ROJO POR EL MECANISMO: un estado nuevo cae, también POR VARIABLE', () => {
  const { estados } = tabla();

  // (a) literal
  const lit = censarFuente('nuevo.ts',
    "await prisma.quote.update({ where: { id: 1 }, data: { status: 'en_revision' } });");
  assert.ok(lit.escrituras.flatMap((x) => x.valores).includes('en_revision'),
    '🔴 el censo NO ve un estado nuevo escrito como literal');

  // (b) POR VARIABLE — el caso que se escapaba, y el que decide.
  const varr = censarFuente('nuevoVar.ts', [
    'async function crear(needs) {',
    "  const inicial = needs ? 'en_revision' : 'draft';",
    '  await prisma.quote.create({ data: { status: inicial } });',
    '}',
  ].join('\n'));
  const vistos = varr.escrituras.flatMap((x) => x.valores);
  assert.deepEqual(varr.sinResolver, [],
    '🔴 el AST no resuelve la escritura por variable: el guard nacería con el agujero dentro');
  assert.ok(vistos.includes('en_revision'),
    `🔴 el censo NO ve el estado escrito a través de una variable (vio: ${vistos.join(', ')}). `
    + 'Es exactamente el caso que `quotes.routes.ts` usa en la ruta principal de creación.');
  assert.ok(!estados.includes('en_revision'),
    '🔴 el control se ha invalidado: `en_revision` está en la tabla y ya no sirve de estado nuevo');
});

// ── LA PROPIEDAD DEL REGISTRO (SCRUM-402): complementarios por construcción ──────────────────

test('SCRUM-421 · 🔴 TODOS los estados tienen EXACTAMENTE UNA acción primaria', () => {
  const { estados, filas } = tabla();
  assert.ok(estados.length >= 6 && filas.length >= 4,
    `🔴 CIEGO: la tabla se lee con ${estados.length} estados y ${filas.length} filas`);

  const mal = [];
  for (const e of estados) {
    const primarias = filas.filter((f) => f.destinos[e] === 'primaria').map((f) => f.id);
    if (primarias.length !== 1) mal.push(`${e}: ${primarias.length} (${primarias.join(', ') || '—'})`);
  }
  assert.deepEqual(mal, [],
    '🔴 hay estados sin exactamente UNA acción primaria:\n    ' + mal.join('\n    ')
    + '\n\n  CERO es un callejón sin salida: la pantalla no ofrece qué hacer y el presupuesto se\n'
    + '  queda ahí. DOS rompe la regla: dos acciones compitiendo por el mismo hueco.');
});

test('SCRUM-421 · cada fila cubre TODOS los estados (la ranura no queda vacía por olvido)', () => {
  // La complementariedad de SCRUM-402: que sea aritmética de la tabla y no algo que recordar.
  const { estados, filas } = tabla();
  const huecos = [];
  for (const f of filas) {
    for (const e of estados) if (!(e in f.destinos)) huecos.push(`${f.id} no dice nada de '${e}'`);
  }
  assert.deepEqual(huecos, [],
    '🔴 la tabla tiene huecos:\n    ' + huecos.join('\n    ')
    + '\n\n  Una celda ausente no es «oculta»: es una decisión que nadie tomó.');
});

test('SCRUM-421 · los doce rótulos son EXACTAMENTE los aprobados (regla 30)', () => {
  // 17-ago-2026 · APROBADOS los doce. Este guard exigía el marcador «se aprueban antes de
  // encenderse»; ya están aprobados, así que pasa a exigir el TEXTO — no se borra, porque entonces
  // los doce rótulos se quedarían sin vigilar el día que por fin tienen texto.
  //
  // Tres cambiaron al aprobarse, y el criterio se conserva porque vale para el siguiente registro:
  // MISMA ACCIÓN, MISMAS PALABRAS que en el detalle de factura.
  const src = fs.readFileSync(REGISTRO, 'utf8');
  const APROBADOS = {
    btnEnviarAprobacion: 'Enviar a aprobación', btnEnviar: 'Enviar al cliente', btnAprobar: 'Aprobar',
    btnRecordar: 'Enviar recordatorio', btnCrearTrabajo: 'Crear trabajo', btnDuplicar: 'Duplicar',
    btnPdf: 'Descargar PDF', btnEditarLineas: 'Editar líneas', btnWhatsApp: 'Enviar por WhatsApp',
    btnVerCliente: 'Ver cliente', btnMarcarRechazado: 'Marcar como rechazado', btnBorrar: 'Borrar',
  };
  for (const [id, texto] of Object.entries(APROBADOS)) {
    assert.ok(src.includes(id + ':') && src.includes("'" + texto + "'"),
      `🔴 el rótulo de \`${id}\` no es el aprobado («${texto}»). Un renombre es microcopy nueva.`);
  }
  assert.ok(!/PENDIENTE microcopy oficial/.test(src),
    '🔴 queda un marcador en el registro: o hay una acción nueva sin aprobar, o se ha reintroducido.');
});
