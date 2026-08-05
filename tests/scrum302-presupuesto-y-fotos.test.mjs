// tests/scrum302-presupuesto-y-fotos.test.mjs — SCRUM-302 (C2), las dos piezas que faltaban.
//
// ═══════════════════════════════════════════════════════════════════════════════════════════
// 🔴 POR QUÉ ESTE GUARD MIDE LA **POSICIÓN** Y NO LAS PALABRAS
// ═══════════════════════════════════════════════════════════════════════════════════════════
//
// El albarán enseña un enlace a su presupuesto de origen. El enlace es del **DOCUMENTO**: sale de
// `Job.quoteId`, y esa relación es verdad SIEMPRE que exista.
//
// Lo que NO es verdad siempre es la relación línea a línea. `AlbaranLinea.quoteLineIndex` existe
// desde SCRUM-367, pero:
//   · no lo hay en modo `SIN_VALORAR`,
//   · solo lo escribe el prellenado (un albarán rellenado a mano no lo tiene),
//   · y el índice NO dice de qué presupuesto es.
//
// Así que un enlace colocado **junto a la tabla de líneas** afirma algo que es cierto solo a
// veces: que esas líneas salen de ese presupuesto. Y aquí está el punto que hace que este fichero
// no sea un guard de texto:
//
//   > **LA QUE AFIRMA ES LA PROXIMIDAD, NO EL RÓTULO.** Un enlace metido en la cabecera de la
//   > tabla de líneas se lee como procedencia de las líneas aunque su texto diga «del documento».
//   > Cambiarle las palabras no lo arregla; moverlo, sí.
//
// Por eso lo vigilado es DÓNDE CUELGA en el árbol del DOM, derivado del grafo de `appendChild`
// del propio fichero (AST — no `grep`, que casaría el comentario que explica la prohibición;
// SCRUM-203 y `_guard-texto.mjs`). Y son DOS hechos, porque uno solo tiene un agujero:
//
//   (1) el enlace cuelga del RAIL, y
//   (2) las líneas del albarán NO se pintan dentro del rail.
//
// Sin (2), alguien mete mañana la tabla de líneas en el propio rail, (1) sigue verde y el enlace
// vuelve a estar pegado a ellas. Con los dos, «lejos» es una propiedad comprobada, no un deseo.
//
// ═══════════════════════════════════════════════════════════════════════════════════════════
// LAS FOTOS · SE COPIA UN CAMINO QUE YA FUNCIONA, Y EL GUARD ATA LOS DOS EXTREMOS
// ═══════════════════════════════════════════════════════════════════════════════════════════
//
// Nada de esto es camino nuevo: `GET /:id/fotos` lista y `GET /admin/attachments/:id` sirve el
// binario, y la fila del Trabajo lleva meses pintándolas así. El guard exige que el `src` del
// `<img>` siga apuntando a la ruta REAL montada en `src/app.ts`: si alguien renombra el montaje,
// esta página se queda con marcos rotos y ningún 500 lo cuenta.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { fileURLToPath, pathToFileURL } from 'node:url';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = pathToFileURL(path.join(RAIZ, 'dist')).href + '/';
const RUTA_PAGINA = path.join(RAIZ, 'public', 'dashboard', 'js', 'albaranDetailView.js');
const PAGINA = fs.readFileSync(RUTA_PAGINA, 'utf8');
const APP_TS = fs.readFileSync(path.join(RAIZ, 'src', 'app.ts'), 'utf8');

const sf = ts.createSourceFile('albaranDetailView.js', PAGINA, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
const recorrer = (n, fn) => { fn(n); n.forEachChild((h) => recorrer(h, fn)); };
const linea = (n) => sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1;

/** Identificador base: `fila.dataset` → `fila`. */
function baseDe(expr) {
  let n = expr;
  while (n && ts.isPropertyAccessExpression(n)) n = n.expression;
  return n && ts.isIdentifier(n) ? n.text : null;
}

const esTextoLiteral = (n) => !!n && (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n));

// ═══════════════════════════════════════════════════════════════════════════════════════════
// EL GRAFO DEL DOM, derivado del fichero
// ═══════════════════════════════════════════════════════════════════════════════════════════

/** hijo → Set(padres). Se guardan TODOS: un elemento appendeado en dos sitios no puede colarse. */
const padresDe = new Map();
recorrer(sf, (n) => {
  if (!ts.isCallExpression(n) || !ts.isPropertyAccessExpression(n.expression)) return;
  if (n.expression.name.text !== 'appendChild') return;
  const padre = baseDe(n.expression.expression);
  const hijo = baseDe(n.arguments[0]);
  if (!padre || !hijo) return;
  if (!padresDe.has(hijo)) padresDe.set(hijo, new Set());
  padresDe.get(hijo).add(padre);
});

/** variable → className literal que se le asigna. */
const claseDe = new Map();
recorrer(sf, (n) => {
  if (!ts.isBinaryExpression(n) || n.operatorToken.kind !== ts.SyntaxKind.EqualsToken) return;
  if (!ts.isPropertyAccessExpression(n.left) || n.left.name.text !== 'className') return;
  if (!ts.isIdentifier(n.left.expression) || !esTextoLiteral(n.right)) return;
  claseDe.set(n.left.expression.text, n.right.text);
});

/** El rail, DERIVADO por su clase — no un nombre de variable escrito aquí a mano. */
const RAIL = [...claseDe.entries()]
  .filter(([, c]) => c.split(/\s+/).includes('detail-rail'))
  .map(([v]) => v)[0] ?? null;

/** El enlace al presupuesto: quien escucha un clic que navega a `quotes-detail`. */
const ENLACE_QUOTE = (() => {
  let hallado = null;
  recorrer(sf, (n) => {
    if (hallado) return;
    if (!ts.isCallExpression(n) || !ts.isPropertyAccessExpression(n.expression)) return;
    if (n.expression.name.text !== 'addEventListener') return;
    let navega = false;
    recorrer(n, (x) => {
      if (!ts.isCallExpression(x) || !x.expression.getText(sf).endsWith('renderAppView')) return;
      const a0 = x.arguments[0];
      if (a0 && ts.isStringLiteral(a0) && a0.text === 'quotes-detail') navega = true;
    });
    if (navega) hallado = { nombre: baseDe(n.expression.expression), nodo: n };
  });
  return hallado;
})();

/** Sube por el grafo: todos los ancestros alcanzables de un nodo. */
function ancestros(nombre) {
  const vistos = new Set();
  const cola = [nombre];
  while (cola.length) {
    for (const p of padresDe.get(cola.shift()) || []) {
      if (vistos.has(p)) continue;
      vistos.add(p);
      cola.push(p);
    }
  }
  return vistos;
}

/** Baja por el grafo: todo lo que cuelga del rail, a cualquier profundidad. */
function descendientes(raiz) {
  const dentro = new Set([raiz]);
  let cambio = true;
  while (cambio) {
    cambio = false;
    for (const [hijo, padres] of padresDe) {
      if (dentro.has(hijo)) continue;
      if ([...padres].some((p) => dentro.has(p))) { dentro.add(hijo); cambio = true; }
    }
  }
  return dentro;
}

/** ¿Esta expresión toca las LÍNEAS del albarán (o su vínculo con el presupuesto)? */
function tocaLasLineas(nodo) {
  let si = false;
  recorrer(nodo, (n) => {
    if (ts.isPropertyAccessExpression(n) && (n.name.text === 'lineas' || n.name.text === 'quoteLineIndex')) si = true;
  });
  return si;
}

/** ¿Este nodo vive dentro de un bucle que RECORRE las líneas? (la tabla de líneas del futuro) */
function dentroDeIteracionDeLineas(nodo) {
  for (let p = nodo; p; p = p.parent) {
    if (ts.isForOfStatement(p) && /\blineas\b/.test(p.expression.getText(sf))) return true;
    if (ts.isCallExpression(p) && ts.isPropertyAccessExpression(p.expression)
        && ['map', 'forEach'].includes(p.expression.name.text)
        && /\blineas\b/.test(p.expression.expression.getText(sf))) return true;
  }
  return false;
}

// ═══════════════════════════════════════════════════════════════════════════════════════════
// SUELO · un detector que no encuentra nada daría verde para siempre
// ═══════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-302 · SUELO: el detector ve el rail, el enlace y el grafo del DOM', () => {
  assert.ok(padresDe.size > 0,
    '🔴 DETECTOR CIEGO: cero `appendChild` derivados de una página que construye su DOM así. '
    + 'No es que la página esté limpia: es que no se ha mirado nada.');
  assert.notEqual(RAIL, null,
    '🔴 DETECTOR CIEGO: no encuentro ningún elemento con la clase `detail-rail`. Si el rail se '
    + 'renombró, este fichero entero deja de vigilar dónde cuelga el enlace — y se enteraría '
    + 'nadie, porque los tests de abajo pasarían a medir el vacío.');
  assert.notEqual(ENLACE_QUOTE, null,
    '🔴 no hay ningún enlace que navegue a `quotes-detail`: falta el PRESUPUESTO ORIGEN, que es '
    + 'la pieza ① de lo que quedaba de SCRUM-302.');
  assert.notEqual(ENLACE_QUOTE.nombre, null,
    '🔴 DETECTOR CIEGO: encuentro la navegación a `quotes-detail` pero no de qué elemento cuelga.');
});

// ═══════════════════════════════════════════════════════════════════════════════════════════
// ① PRESUPUESTO ORIGEN
// ═══════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-302 · ① el enlace al presupuesto cuelga del RAIL', () => {
  const arriba = ancestros(ENLACE_QUOTE.nombre);
  assert.ok(
    arriba.has(RAIL),
    `🔴 el enlace al presupuesto (\`${ENLACE_QUOTE.nombre}\`, línea ${linea(ENLACE_QUOTE.nodo)}) ya no `
    + `cuelga de \`${RAIL}\`: sube por [${[...arriba].join(' → ') || 'ningún padre'}].\n`
    + 'Este enlace es del DOCUMENTO (`Job.quoteId`), no de las líneas. Fuera del rail —y sobre '
    + 'todo cerca de la tabla de líneas— se lee como que CADA línea sale de ese presupuesto, y eso '
    + 'es falso en modo SIN_VALORAR y en todo albarán que no venga del prellenado. '
    + 'La proximidad afirma: devuélvelo al rail.',
  );
});

test('SCRUM-302 · ① el enlace se construye con el presupuesto del DOCUMENTO, nunca con datos de línea', () => {
  // La fila entera del enlace: el enlace y todo lo que cuelga con él de su padre inmediato.
  const padre = [...(padresDe.get(ENLACE_QUOTE.nombre) || [])][0];
  const familia = new Set([ENLACE_QUOTE.nombre, padre].filter(Boolean));

  const sospechas = [];
  recorrer(sf, (n) => {
    let receptor = null;
    if (ts.isBinaryExpression(n) && n.operatorToken.kind === ts.SyntaxKind.EqualsToken
        && ts.isPropertyAccessExpression(n.left)) receptor = baseDe(n.left.expression);
    else if (ts.isCallExpression(n) && ts.isPropertyAccessExpression(n.expression)) receptor = baseDe(n.expression.expression);
    if (!receptor || !familia.has(receptor)) return;
    if (tocaLasLineas(n)) sospechas.push(`${receptor} (línea ${linea(n)})`);
  });

  assert.deepEqual(
    sospechas, [],
    '🔴 el enlace del presupuesto se está construyendo a partir de las LÍNEAS '
    + `(${sospechas.join(', ')}). \`quoteLineIndex\` no cubre todos los casos —no existe en `
    + 'SIN_VALORAR, solo lo pone el prellenado, y no sabe de qué presupuesto es—, así que un '
    + 'enlace derivado de una línea afirma una procedencia que a veces no es cierta. '
    + 'El origen del enlace es `Job.quoteId`, y solo ése.',
  );
});

test('SCRUM-302 · ① las LÍNEAS del albarán no se pintan dentro del rail (el «lejos» del enlace)', () => {
  const dentroDelRail = descendientes(RAIL);
  const hallazgos = [];

  recorrer(sf, (n) => {
    // (a) contenido volcado sobre un nodo del rail que se deriva de las líneas
    if (ts.isBinaryExpression(n) && n.operatorToken.kind === ts.SyntaxKind.EqualsToken
        && ts.isPropertyAccessExpression(n.left)
        && ['innerHTML', 'textContent', 'innerText'].includes(n.left.name.text)) {
      const receptor = baseDe(n.left.expression);
      if (receptor && dentroDelRail.has(receptor) && tocaLasLineas(n.right)) {
        hallazgos.push(`${receptor}.${n.left.name.text} (línea ${linea(n)})`);
      }
    }
    // (b) algo que se inserta en el rail desde dentro de un recorrido de las líneas
    if (ts.isCallExpression(n) && ts.isPropertyAccessExpression(n.expression)
        && n.expression.name.text === 'appendChild') {
      const receptor = baseDe(n.expression.expression);
      if (receptor && dentroDelRail.has(receptor)
          && (tocaLasLineas(n.arguments[0]) || dentroDeIteracionDeLineas(n))) {
        hallazgos.push(`appendChild sobre ${receptor} (línea ${linea(n)})`);
      }
    }
  });

  assert.deepEqual(
    hallazgos, [],
    '🔴 LAS LÍNEAS DEL ALBARÁN HAN ENTRADO EN EL RAIL: ' + hallazgos.join(', ') + '.\n'
    + 'El enlace al presupuesto vive en el rail justamente para estar LEJOS de ellas. Si las '
    + 'líneas se pintan aquí, el enlace vuelve a quedar pegado a la tabla y se lee otra vez como '
    + 'procedencia de cada línea —que es falso a menudo—, esta vez sin que el guard de posición '
    + 'se entere. Las líneas van fuera del rail.',
  );
});

// ═══════════════════════════════════════════════════════════════════════════════════════════
// ② FOTOS · el camino que ya existía, copiado y atado por los dos extremos
// ═══════════════════════════════════════════════════════════════════════════════════════════

/** El `<img>` de las fotos: el elemento al que se le asigna un `src` de adjuntos. */
const IMG_FOTO = (() => {
  let hallado = null;
  recorrer(sf, (n) => {
    if (hallado) return;
    if (!ts.isBinaryExpression(n) || n.operatorToken.kind !== ts.SyntaxKind.EqualsToken) return;
    if (!ts.isPropertyAccessExpression(n.left) || n.left.name.text !== 'src') return;
    const texto = n.right.getText(sf);
    if (/\/admin\/attachments\//.test(texto)) hallado = { nombre: baseDe(n.left.expression), nodo: n, texto };
  });
  return hallado;
})();

test('SCRUM-302 · ② SUELO: la página pide las fotos y pinta un <img> de adjuntos', () => {
  let pide = false;
  recorrer(sf, (n) => {
    if (!ts.isCallExpression(n) || !n.expression.getText(sf).endsWith('apiRequest')) return;
    const a0 = n.arguments[0];
    if (a0 && /\/fotos`?$/.test(a0.getText(sf).trim())) pide = true;
  });
  assert.ok(pide,
    '🔴 la página no llama a `GET /admin/albaranes/:id/fotos`. El endpoint EXISTE '
    + '(`albaranes.routes.ts`), así que unas fotos que no se ven aquí no son un hueco del '
    + 'backend: son la pieza ② de SCRUM-302 sin construir.');
  assert.notEqual(IMG_FOTO, null,
    '🔴 no hay ningún `<img>` servido desde `/admin/attachments/`: las fotos se listan pero no se '
    + 'pintan, o se está sirviendo el binario por un camino nuevo.');
});

test('SCRUM-302 · ② las fotos cuelgan del RAIL', () => {
  assert.ok(
    ancestros(IMG_FOTO.nombre).has(RAIL),
    `🔴 el \`<img>\` de las fotos (\`${IMG_FOTO.nombre}\`, línea ${linea(IMG_FOTO.nodo)}) no cuelga `
    + `de \`${RAIL}\`. El rail es donde vive el contexto de solo lectura de esta página.`,
  );
});

test('SCRUM-302 · ② el binario se sirve por la ruta REAL montada en app.ts (nada de camino nuevo)', () => {
  // Los dos extremos atados: si el montaje se renombra, esta página se llena de marcos rotos y
  // no hay ningún 500 que lo cuente — el navegador se come el 404 de una imagen en silencio.
  assert.match(
    APP_TS, /mountAdmin\(app,\s*'\/admin\/attachments'/,
    '🔴 `/admin/attachments` ya no se monta en `src/app.ts` con ese prefijo. La página del albarán '
    + 'sirve sus fotos desde ahí: renombrar el montaje deja las miniaturas rotas, y una imagen que '
    + 'no carga no levanta ningún error que alguien vaya a ver.',
  );
});

// ═══════════════════════════════════════════════════════════════════════════════════════════
// ③ EL BACKEND · handler REAL con `prisma` de doble (patrón SCRUM-263 / SCRUM-257b / 302-duplicar)
// ═══════════════════════════════════════════════════════════════════════════════════════════

const moduloPrisma = await import(DIST + 'core/db/prisma.js');
const routerDe = (mod) => mod.default?.default ?? mod.default;

const ALBARAN = {
  id: 7, merchantId: 1, jobId: 42, numero: 'ALB-2026-0003',
  fecha: new Date('2026-07-20T10:00:00Z'), modoValoracion: 'VALORADO',
  lineas: [{ concepto: 'Bajante PVC 110', cantidad: 3, unidad: 'm', precio: 18, iva: 21 }],
  estado: 'firmado', version: 4, notas: '', invoiceId: null,
  createdAt: new Date('2026-07-19T08:00:00Z'), updatedAt: new Date('2026-07-20T18:30:00Z'),
};

/** Invoca GET /:id de verdad. `job` permite probar el Trabajo sin presupuesto. */
async function invocarDetalle({ job, quote }) {
  const wheres = [];
  moduloPrisma.prisma.albaran = { findFirst: async () => ALBARAN };
  moduloPrisma.prisma.job = { findFirst: async () => job };
  moduloPrisma.prisma.customer = { findFirst: async () => ({ id: 5, name: 'Comunidad Los Olivos' }) };
  moduloPrisma.prisma.albaranLineaFacturada = { findMany: async () => [] };
  moduloPrisma.prisma.quote = {
    findFirst: async (args) => { wheres.push(args?.where ?? null); return quote; },
  };

  const router = routerDe(await import(DIST + 'modules/jobs/app/routes/albaranes.routes.js'));
  const capa = router.stack.find((l) => l.route?.path === '/:id' && l.route?.methods?.get);
  assert.ok(capa, '🔴 NO EXISTE GET /admin/albaranes/:id — la página no puede cargarse sola.');

  let salida = null;
  const res = {
    status(c) { this._c = c; return this; },
    json(b) { salida = { code: this._c ?? 200, body: b }; return this; },
    setHeader() { return this; },
  };
  const hs = capa.route.stack;
  await hs[hs.length - 1].handle({ params: { id: '7' }, body: {}, merchantId: 1, query: {}, headers: {} }, res, () => {});
  return { salida, wheres };
}

test('SCRUM-302 · ③ el detalle trae el presupuesto del DOCUMENTO', async () => {
  const { salida } = await invocarDetalle({
    job: { id: 42, titulo: 'Reforma baño', direccion: 'C/ Mayor 3', customerId: 5, quoteId: 88 },
    quote: { id: 88, quoteNumber: 12 },
  });
  assert.equal(salida?.code ?? 200, 200, `🔴 el detalle no responde 200: ${JSON.stringify(salida)}`);
  assert.deepEqual(
    salida.body.quote, { id: 88, number: 12 },
    '🔴 el detalle no devuelve el presupuesto de origen. Sin él, el rail no puede enlazarlo — y '
    + 'la vista NO debe deducirlo de las líneas, que es justo lo que este ticket prohíbe.',
  );
});

test('SCRUM-302 · ③ MULTI-TENANT: el presupuesto se lee filtrando por `merchantId` (regla 2)', async () => {
  const { wheres } = await invocarDetalle({
    job: { id: 42, titulo: 'Reforma baño', direccion: 'C/ Mayor 3', customerId: 5, quoteId: 88 },
    quote: { id: 88, quoteNumber: 12 },
  });
  assert.equal(wheres.length, 1, '🔴 el presupuesto no se consultó exactamente una vez');
  assert.equal(
    wheres[0]?.merchantId, 1,
    '🔴 la consulta del presupuesto NO filtra por `merchantId`: con solo el `id`, un albarán '
    + 'podría enlazar —y nombrar— el presupuesto de OTRO merchant. Regla 2, y aquí además el '
    + 'número del presupuesto ajeno se pintaría en pantalla.',
  );
});

test('SCRUM-302 · ③ un Trabajo SIN presupuesto devuelve `null`, no un enlace roto', async () => {
  const { salida, wheres } = await invocarDetalle({
    job: { id: 42, titulo: 'Aviso urgente', direccion: null, customerId: 5, quoteId: null },
    quote: null,
  });
  assert.equal(salida.body.quote, null,
    '🔴 `Job.quoteId` es nullable (hay Trabajos que nacen sin presupuesto): el detalle tiene que '
    + 'decir `null` para que el rail OMITA la fila, en vez de pintar un enlace que no lleva a '
    + 'ningún sitio.');
  assert.equal(wheres.length, 0,
    '🔴 se consultó un presupuesto para un Trabajo que no tiene: una consulta de más por cada '
    + 'albarán abierto, y con `id: null` el `findFirst` puede devolver CUALQUIER presupuesto.');
});
