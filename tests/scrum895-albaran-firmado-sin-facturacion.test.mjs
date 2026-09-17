// tests/scrum895-albaran-firmado-sin-facturacion.test.mjs — SCRUM-895
//
// EL ALBARÁN FIRMADO OFRECÍA UN BOTÓN QUE SÓLO SABÍA FALLAR.
//
// Medido en staging (17-sep-2026, 390 px, `018d1807`, Sesión 5; repetido por la Sesión 4 contra
// `25462801` a las 09:36:22Z con el mismo resultado), merchant con `modoEmision: 'receipt'`
// —`INVOICING_ES_ENABLED` apagado, como los negocios ES reales—: la primaria de AB260001 (firmado,
// sin precios, con presupuesto) era `btnConvertirFactura`, pintada con el marcador de microcopy
// porque no tiene rótulo firmado. Al pulsarla, `POST …/convertir-en-factura` → **409**
// `facturacion_no_disponible`, y franja roja con el mismo marcador. Ése era el único siguiente paso
// que ofrecía.
//
// La causa no es el rótulo: es que el CONTEXTO que decide la primaria no miraba el modo de emisión.
// Las dos rutas de facturar un albarán rechazan `receipt` ANTES de hacer nada, así que con el flag
// apagado ninguna de las dos primarias contextuales de `firmado` puede funcionar:
//   · `btnConvertirFactura` → `convertir-en-factura` → 409;
//   · `btnFacturar`         → la hoja de `facturar-parcial` en el Trabajo → 409.
//
// DECIDIDO (orquestador, en el ticket): un botón que con el flag apagado no puede funcionar NO se
// muestra. Lo demás de un albarán firmado SÍ funciona con el flag apagado —medido: PDF 200,
// WhatsApp 200— y sigue.

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';
import { fileURLToPath } from 'node:url';
import { cargarDashboard, pintarVista, todos } from './_banco-vistas.mjs';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const leer = (p) => fs.readFileSync(path.join(RAIZ, p), 'utf8');

const PATRON = leer('public/dashboard/js/patronDetalleAcciones.js');
const REGISTRO = leer('public/dashboard/js/albaranActionsRegistry.js');
const ACCION = leer('public/dashboard/js/albaranAccion.js');

/** El resolutor de verdad, con el modo de emisión que `app.js` deja en el global tras `/admin/me`. */
function resolutorCon(appModoEmision) {
  const ctx = { window: { appModoEmision } };
  vm.createContext(ctx);
  vm.runInContext(PATRON, ctx);
  vm.runInContext(REGISTRO, ctx);
  vm.runInContext(ACCION, ctx);
  return ctx.window;
}

// Los dos albaranes firmados que tienen siguiente paso de facturación, uno por primaria contextual.
const SIN_VALORAR = { estado: 'firmado', modoValoracion: 'SIN_VALORAR', quote: { id: 1 }, estadoFacturacion: 'sin_facturar' };
const VALORADO = { estado: 'firmado', modoValoracion: 'VALORADO', quote: null, estadoFacturacion: 'parcial' };

// ═══ ① ROJO · con el flag apagado no se ofrece facturar ═════════════════════════════════════

test('SCRUM-895 · 🔴 con `receipt` un albarán firmado NO ofrece un facturar que da 409', () => {
  const { primariaDeAlbaran } = resolutorCon('receipt');
  assert.equal(
    primariaDeAlbaran(SIN_VALORAR)?.id ?? null, null,
    '🔴 con INVOICING_ES_ENABLED apagado la primaria del albarán firmado sin precios es\n' +
    '  `btnConvertirFactura`: se pinta con el marcador y `convertir-en-factura` responde 409\n' +
    '  `facturacion_no_disponible`. Un botón que sólo sabe fallar no se muestra.',
  );
  assert.equal(
    primariaDeAlbaran(VALORADO)?.id ?? null, null,
    '🔴 con INVOICING_ES_ENABLED apagado se ofrece «Facturar lo entregado», que lleva a la hoja\n' +
    '  de `facturar-parcial` — y esa ruta también responde 409 en `receipt`.',
  );
});

test('SCRUM-895 · 🔴 modo desconocido = no se ofrece (falla cerrado, como `app.js`)', () => {
  // `app.js` deja `appModoEmision` a `null` cuando `/admin/me` no trae un modo del contrato. No
  // saber el modo no autoriza a ofrecer un documento fiscal.
  for (const modo of [null, undefined, 'fiscalish']) {
    const { primariaDeAlbaran } = resolutorCon(modo);
    assert.equal(primariaDeAlbaran(SIN_VALORAR), null, `🔴 con modo ${String(modo)} se ofrece convertir en factura`);
    assert.equal(primariaDeAlbaran(VALORADO), null, `🔴 con modo ${String(modo)} se ofrece facturar lo entregado`);
  }
});

// ═══ ② POSITIVO · con el flag encendido (o en demo) el botón sigue ══════════════════════════

test('SCRUM-895 · con `demo` y con `fiscal` las dos primarias de facturar SIGUEN', () => {
  for (const modo of ['demo', 'fiscal']) {
    const { primariaDeAlbaran } = resolutorCon(modo);
    assert.equal(primariaDeAlbaran(SIN_VALORAR)?.id, 'btnConvertirFactura',
      `🔴 en «${modo}» desaparece convertir en factura: el arreglo esconde de más.`);
    assert.equal(primariaDeAlbaran(VALORADO)?.id, 'btnFacturar',
      `🔴 en «${modo}» desaparece facturar lo entregado: el arreglo esconde de más.`);
  }
});

test('SCRUM-895 · el modo NO toca lo que no es facturar (borrador, emitido, ya facturado)', () => {
  // Control de alcance: si el modo gobernara algo más que las dos primarias de facturar, `receipt`
  // dejaría a un borrador sin «Emitir» — y eso sí funciona con el flag apagado.
  const receipt = resolutorCon('receipt');
  const demo = resolutorCon('demo');
  for (const alb of [
    { ...SIN_VALORAR, estado: 'borrador' },
    { ...SIN_VALORAR, estado: 'emitido' },
    { ...VALORADO, estadoFacturacion: 'facturado' },
  ]) {
    assert.equal(receipt.primariaDeAlbaran(alb)?.id ?? null, demo.primariaDeAlbaran(alb)?.id ?? null,
      `🔴 el modo cambia la primaria de un albarán ${alb.estado}/${alb.estadoFacturacion}, que no factura.`);
  }
  assert.equal(receipt.primariaDeAlbaran({ ...SIN_VALORAR, estado: 'borrador' })?.id, 'btnEmitir',
    '🔴 ESCÁNER CIEGO: el borrador no da «Emitir»; la comparación de arriba sería cierta por vacío.');
});

// ═══ ③ LAS TRES SUPERFICIES DECIDEN CON EL MISMO CONTEXTO ═══════════════════════════════════
//
// El detalle del albarán llevaba su PROPIA copia del contexto (un literal con las dos claves). Si
// el arreglo entra en la compartida y el detalle conserva la suya, la lista y la fila del Trabajo
// quedan bien y la pantalla del ticket sigue enseñando el botón. Se mira por AST, no por texto: los
// comentarios que explican esto nombran las dos claves.

function fuenteAst(rel) {
  return ts.createSourceFile(rel, leer(rel), ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
}
function recorrer(nodo, visita) {
  visita(nodo);
  ts.forEachChild(nodo, (h) => { recorrer(h, visita); });
}
const CLAVES_CTX = new Set(['valorado-con-pendiente', 'sin-valorar-convertible']);

for (const rel of [
  'public/dashboard/js/albaranDetailView.js',
  'public/dashboard/js/jobDetailView.js',
  'public/dashboard/js/albaranesView.js',
]) {
  test(`SCRUM-895 · ${path.basename(rel)} no construye su propio contexto de facturar`, () => {
    const sf = fuenteAst(rel);
    const copias = [];
    let llamaAlCompartido = false;
    recorrer(sf, (n) => {
      if (ts.isPropertyAssignment(n) && n.name && ts.isStringLiteral(n.name) && CLAVES_CTX.has(n.name.text)) {
        copias.push(`${n.name.text} (línea ${sf.getLineAndCharacterOfPosition(n.getStart()).line + 1})`);
      }
      if (ts.isCallExpression(n)) {
        const e = n.expression;
        const nombre = ts.isIdentifier(e) ? e.text : (ts.isPropertyAccessExpression(e) ? e.name.text : '');
        if (nombre === 'ctxAlbaranDeFila' || nombre === 'primariaDeAlbaran') llamaAlCompartido = true;
      }
    });
    assert.deepEqual(copias, [],
      `🔴 ${rel} declara su propia copia del contexto: ${copias.join(', ')}. La regla del modo de\n` +
      '  emisión vive en `ctxAlbaranDeFila` (albaranAccion.js); una copia aquí no la ve.');
    assert.ok(llamaAlCompartido,
      `🔴 ESCÁNER CIEGO: ${rel} no llama ni a \`ctxAlbaranDeFila\` ni a \`primariaDeAlbaran\`.`);
  });
}

// ═══ ④ SUELO · el front espeja lo que el servidor rechaza (SÓLO LECTURA, regla 38) ═══════════
//
// El front no calcula el modo —lo recibe de `/admin/me`—, pero sí decide que `receipt` no factura.
// Eso es verdad mientras las dos rutas rechacen EXACTAMENTE `receipt`. Se LEE la ruta por AST; no se
// modifica nada del camino de emisión.

test('SCRUM-895 · SUELO: las dos rutas de facturar un albarán rechazan exactamente `receipt`', () => {
  const rel = 'src/modules/jobs/app/routes/albaranes.routes.ts';
  const sf = ts.createSourceFile(rel, leer(rel), ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const rutas = new Map();
  recorrer(sf, (n) => {
    if (!ts.isCallExpression(n) || !ts.isPropertyAccessExpression(n.expression)) return;
    if (n.expression.name.text !== 'post' || !ts.isIdentifier(n.expression.expression) || n.expression.expression.text !== 'router') return;
    const ruta = n.arguments[0];
    if (!ruta || !ts.isStringLiteral(ruta)) return;
    if (ruta.text !== '/:id/convertir-en-factura' && ruta.text !== '/:id/facturar-parcial') return;
    const comparaciones = [];
    recorrer(n, (m) => {
      if (!ts.isBinaryExpression(m)) return;
      const op = m.operatorToken.kind;
      if (op !== ts.SyntaxKind.EqualsEqualsEqualsToken && op !== ts.SyntaxKind.ExclamationEqualsEqualsToken) return;
      const izq = m.left;
      if (ts.isCallExpression(izq) && ts.isIdentifier(izq.expression) && izq.expression.text === 'getEmissionMode') {
        comparaciones.push(`${ts.tokenToString(op)} ${m.right.getText(sf)}`);
      }
    });
    rutas.set(ruta.text, comparaciones);
  });
  assert.equal(rutas.size, 2, `🔴 ESCÁNER CIEGO: encuentro ${rutas.size} de las 2 rutas de facturar un albarán.`);
  for (const [ruta, comparaciones] of rutas) {
    assert.deepEqual(comparaciones, ["=== 'receipt'"],
      `🔴 ${ruta} ya no rechaza exactamente \`receipt\` (compara: ${JSON.stringify(comparaciones)}).\n` +
      '  `ctxAlbaranDeFila` ofrece facturar sólo en `fiscal` y `demo`: revísalo con la ruta delante.');
  }
});

// ═══ ⑤ LA PANTALLA · el detalle real del albarán, pintado con el dashboard entero ═══════════════
//
// El resolutor de arriba puede estar bien y la pantalla seguir mal (es lo que pasaba: el detalle
// llevaba su copia del contexto). Esto pinta `renderAlbaranDetailView` con los scripts reales en el
// orden de `index.html` y mira los botones que salen.

const AB260001 = {
  id: 1634, numero: 'AB260001', estado: 'firmado', modoValoracion: 'SIN_VALORAR', estadoFacturacion: 'sin_facturar',
  quote: { id: 1878, quoteNumber: 1 }, job: { id: 1, titulo: 'Reforma baño' }, lineas: [], invoiceId: null,
  firmadoPorNombre: 'Ana Ruiz', firmadoEn: '2026-09-16T10:00:00.000Z',
};

function redDelAlbaran(alb) {
  const resp = (status, data) => ({
    ok: status >= 200 && status < 300, status, statusText: String(status),
    headers: { get: () => 'application/json' },
    json: async () => data, blob: async () => ({}), text: async () => JSON.stringify(data),
  });
  return {
    fetch: async (url, o) => {
      const metodo = (o && o.method) || 'GET';
      if (metodo === 'GET' && String(url).includes('/admin/albaranes/' + alb.id)) return resp(200, alb);
      return resp(200, {});
    },
    navigator: { userAgent: 'banco', language: 'es-ES', onLine: true, serviceWorker: { register: async () => ({}) } },
  };
}

async function botonesDelDetalle(modo) {
  const banco = cargarDashboard(RAIZ, { red: redDelAlbaran(AB260001) });
  banco.ctx.appModoEmision = modo;
  const r = await pintarVista(banco, 'renderAlbaranDetailView', AB260001.id);
  assert.ok(!r.error, `🔴 SUELO: el detalle no se ha pintado: ${r.error && r.error.message}`);
  const botones = todos(r.contenedor).filter((n) => n.tagName === 'BUTTON');
  return {
    acciones: botones.map((b) => b.dataset.accion).filter(Boolean),
    textos: botones.map((b) => b.textContent),
    marcador: banco.ctx.MICROCOPY_PENDIENTE || '[PENDIENTE microcopy oficial]',
  };
}

test('SCRUM-895 · 🔴 PANTALLA: con `receipt` el albarán firmado no enseña el marcador ni el botón de convertir', async () => {
  const d = await botonesDelDetalle('receipt');
  assert.ok(d.acciones.includes('btnPdf'), '🔴 SUELO: el detalle no pinta ni «Descargar PDF»; no he mirado la pantalla de verdad');
  assert.ok(!d.acciones.includes('btnConvertirFactura'),
    '🔴 con INVOICING_ES_ENABLED apagado el detalle sigue ofreciendo convertir en factura (409 seguro). Botones: ' + JSON.stringify(d.acciones));
  assert.ok(!d.textos.some((t) => String(t).includes('[PENDIENTE')),
    '🔴 un marcador interno a la vista en el albarán firmado: ' + JSON.stringify(d.textos));
});

test('SCRUM-895 · ✅ PANTALLA: con `demo` el botón de convertir SIGUE', async () => {
  const d = await botonesDelDetalle('demo');
  assert.ok(d.acciones.includes('btnConvertirFactura'),
    '🔴 en demo ha desaparecido convertir en factura: el arreglo esconde de más. Botones: ' + JSON.stringify(d.acciones));
});
