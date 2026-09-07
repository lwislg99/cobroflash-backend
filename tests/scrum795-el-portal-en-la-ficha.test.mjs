// tests/scrum795-el-portal-en-la-ficha.test.mjs — SCRUM-795
//
// Sin gate: AST sobre `public/dashboard/js/`. Ni BD, ni red, ni navegador.
//
// ═════════════════════════════════════════════════════════════════════════════════════════════
// LAS DOS PANTALLAS DEL MISMO CLIENTE NO DECÍAN LO MISMO
//
//   LISTA     → pinta «Portal» SIEMPRE; al pulsar llama a `/portal-url`, que CURA.
//   FICHA 360 → pintaba «🔗 Portal» SÓLO si `customer.portalUrl`, servido EN CRUDO por el
//               detalle (`customer.portalToken ? url : null`).
//
// Sin token **el botón no existía**. No fallaba el enlace: desaparecía el botón, sin decir nada.
// Medido el 6-sep-2026 en la base de desarrollo: los SIETE clientes del demo estaban así.
//
// ── EL ROJO, EN NAVEGADOR REAL (`npm run guard:portal-en-la-ficha`) ─────────────────────────
//     caso        LISTA    FICHA 360
//     SIN token   botón    NO EXISTE     ← el defecto
//     CON token   botón    botón         ← control positivo
// Tras el arreglo, las cuatro celdas dicen «botón».
//
// ── 🔴 Y LA MITAD QUE MÁS IMPORTA: NO SE HA AÑADIDO UNA ESCRITURA ───────────────────────────
// La otra salida —curar en el endpoint del detalle— se descartó porque metería una escritura
// dentro de un GET disparada sola al abrir la ficha. Sería feo caer en ello al arreglarlo, así
// que se MIDIÓ con el contador de consultas de SCRUM-58, contra desarrollo y por el camino real:
//
//     ① ABRIR la ficha  (GET /detail)      → 5 consultas · **0 escrituras**
//     ② PULSAR el botón (GET /portal-url)  → 4 consultas · **1 escritura** (UPDATE del token)
//
// ── QUÉ VIGILA ESTE FICHERO ─────────────────────────────────────────────────────────────────
// El navegador no corre en `npm test` (misma decisión que `guard:contraste` y compañía). Aquí se
// vigila el MECANISMO, que es lo que puede volver a romperse en un merge:
//   ① el botón de la ficha NO cuelga de una condición sobre `portalUrl`;
//   ② la llamada a `/portal-url` está DENTRO del manejador del clic, no en el render.
// ═════════════════════════════════════════════════════════════════════════════════════════════
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';   // SCRUM-730
import ts from 'typescript';
import { ejecutableDe } from './_guard-texto.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FICHA = 'public/dashboard/js/customerDetailView.js';
const LISTA = 'public/dashboard/js/customersView.js';
const ID_BOTON = 'btn-copy-portal-360';

const fuente = (rel) => fs.readFileSync(path.join(RAIZ, rel), 'utf8');
const arbol = (rel) => ts.createSourceFile(rel, fuente(rel), ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);

/** Las llamadas cuyo argumento menciona `trozo`, con su cadena de padres. */
function llamadasQueMencionan(sf, trozo) {
  const out = [];
  const rec = (n, pila) => {
    if (ts.isCallExpression(n) && n.arguments.some((a) => a.getText(sf).includes(trozo))) {
      out.push({ nodo: n, pila });
    }
    ts.forEachChild(n, (h) => rec(h, [...pila, n]));
  };
  ts.forEachChild(sf, (n) => rec(n, []));
  return out;
}

/** ¿Está el nodo dentro de una función asignada a `.onclick` o pasada a `addEventListener`? */
function dentroDeUnManejador(pila, sf) {
  for (let i = pila.length - 1; i >= 0; i--) {
    const n = pila[i];
    if (!(ts.isFunctionExpression(n) || ts.isArrowFunction(n))) continue;
    const padre = pila[i - 1];
    if (!padre) continue;
    if (ts.isBinaryExpression(padre) && padre.operatorToken.kind === ts.SyntaxKind.EqualsToken
        && padre.left.getText(sf).endsWith('.onclick')) return true;
    if (ts.isCallExpression(padre) && padre.expression.getText(sf).endsWith('addEventListener')) return true;
  }
  return false;
}

// ═════════════════════════════════════════════════════════════════════════════════════════════
// ① EL BOTÓN SE PINTA SIEMPRE
// ═════════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-795 · 🔴 el botón del portal de la FICHA 360 no cuelga de `portalUrl`', () => {
  // ⚠️ SOBRE CÓDIGO EJECUTABLE, y esto me cazó al primer disparo: la primera versión miraba el
  // fichero entero y salió ROJA contra MI PROPIO COMENTARIO, que cita `if (customer.portalUrl)`
  // para explicar por qué está prohibido. Es el defecto que documenta `_guard-texto.mjs` —
  // «cuanto mejor documentas la regla, más te bloquea el mecanismo que la defiende»— y van tres
  // veces que muerde en este repo desde que llevo yo la sesión.
  const src = ejecutableDe(fuente(FICHA), { donde: FICHA, ancla: ID_BOTON });

  // SUELO: si el botón ya no está, lo de abajo sería una negación sobre la nada.
  assert.ok(src.includes(ID_BOTON),
    `🔴 ESCÁNER CIEGO: no encuentro \`${ID_BOTON}\` en ${FICHA}. ¿Se renombró el botón?`);

  // 🔴 EL DEFECTO, CONGELADO POR SU FORMA: el botón dentro de un ternario sobre `portalUrl`.
  // No se persigue la palabra —este comentario la contiene— sino la CONSTRUCCIÓN: que entre una
  // condición sobre `portalUrl` y el id del botón no haya un `?` que los ate.
  const iCond = src.indexOf('customer.portalUrl ?');
  assert.equal(iCond, -1,
    '🔴 HA VUELTO EL BOTÓN CONDICIONAL. Con `customer.portalUrl ? … : \'\'` el botón NO EXISTE '
    + 'para un cliente sin token: no falla el enlace, desaparece el botón y sin decir nada. El '
    + 'detalle sirve esa URL en crudo, así que la condición es «¿tiene token ya?», no «¿se puede '
    + 'dar uno?».');

  // Y que el botón siga siendo alcanzable sin condición previa: el `querySelector` del manejador
  // no puede ir envuelto en un `if (customer.portalUrl)`.
  assert.equal(/if\s*\(\s*customer\.portalUrl\s*\)/.test(src), false,
    '🔴 el manejador del botón vuelve a estar dentro de un `if (customer.portalUrl)`: sin token '
    + 'el botón se pintaría muerto, que es peor que no pintarlo.');
});

test('SCRUM-795 · ✅ la LISTA sigue pintando el suyo sin condición (es el lado que ya estaba bien)', () => {
  const src = fuente(LISTA);
  assert.match(src, /createElement\("button", "btn-secondary btn-sm", "Portal"\)/,
    '🔴 la lista ha dejado de crear su botón «Portal» incondicionalmente. Este ticket puso la '
    + 'ficha de acuerdo con la lista: si cambia la lista, lo alineado deja de estarlo.');
  assert.match(src, /portal-url/,
    '🔴 la lista ya no pide el enlace al pulsar.');
});

// ═════════════════════════════════════════════════════════════════════════════════════════════
// ② LA LLAMADA ES DEL CLIC, NO DEL RENDER
// ═════════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-795 · 🔴 pedir el portal ocurre AL PULSAR, nunca al abrir la ficha', () => {
  const sf = arbol(FICHA);
  const llamadas = llamadasQueMencionan(sf, 'portal-url');

  // SUELO: sin llamada no hay nada que juzgar, y el botón sería decorativo.
  assert.ok(llamadas.length >= 1,
    '🔴 ESCÁNER CIEGO: la ficha no pide `/portal-url` en ningún sitio. El botón se pintaría '
    + 'siempre y no haría nada, que es un arreglo peor que el defecto.');

  const fuera = llamadas
    .filter((l) => !dentroDeUnManejador(l.pila, sf))
    .map((l) => sf.getLineAndCharacterOfPosition(l.nodo.getStart(sf)).line + 1);

  assert.deepEqual(fuera, [],
    '🔴 HAY UNA LLAMADA A `/portal-url` FUERA DEL MANEJADOR DEL CLIC (línea(s) '
    + fuera.join(', ') + ').\n\n'
    + '  `/portal-url` pasa por `ensurePortalToken`, que ESCRIBE. Llamarlo desde el render '
    + 'convierte ABRIR la ficha en una escritura, disparada sola y sin que nadie pulse nada — que '
    + 'es exactamente la salida que este ticket descartó, y con este argumento.\n'
    + '  Medido el 7-sep-2026 con el contador de SCRUM-58: abrir = 0 escrituras, pulsar = 1.');
});

test('SCRUM-795 · ✅ CONTROL POSITIVO: el detector SÍ ve una llamada puesta en el render', () => {
  // Un detector que nunca ha visto el caso malo no sirve. Se le enseña uno sintético.
  const malo = 'async function r(){ const x = await apiRequest(`/admin/customers/1/portal-url`); }';
  const sf = ts.createSourceFile('malo.js', malo, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  const l = llamadasQueMencionan(sf, 'portal-url');
  assert.equal(l.length, 1, '🔴 el detector no ve una llamada evidente.');
  assert.equal(dentroDeUnManejador(l[0].pila, sf), false,
    '🔴 el detector da por «dentro de un manejador» una llamada que está en el render: entonces '
    + 'su verde no significa nada.');

  // Y el CONTRARIO: dentro de un `onclick` sí cuenta como manejador.
  const bueno = 'b.onclick = async () => { await apiRequest(`/admin/customers/1/portal-url`); };';
  const sf2 = ts.createSourceFile('bueno.js', bueno, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  const l2 = llamadasQueMencionan(sf2, 'portal-url');
  assert.equal(l2.length, 1, '🔴 el detector no ve la llamada del caso bueno.');
  assert.equal(dentroDeUnManejador(l2[0].pila, sf2), true,
    '🔴 el detector NO reconoce un `onclick`: marcaría el caso bueno como defecto.');
});

// ═════════════════════════════════════════════════════════════════════════════════════════════
// LAS MUTACIONES QUE ME TUMBAN — las ejecuta `npm run meta:mutaciones`
// ═════════════════════════════════════════════════════════════════════════════════════════════
export const MUTACIONES_QUE_ME_TUMBAN = [
  {
    // ① El defecto original: el botón vuelve a colgar de `portalUrl` y desaparece sin token.
    fichero: 'public/dashboard/js/customerDetailView.js',
    de: '      <button class="btn-secondary btn-sm" id="btn-copy-portal-360" title="Copiar enlace del portal del cliente">',
    a: '      ${customer.portalUrl ? `<button class="btn-secondary btn-sm" id="btn-copy-portal-360" title="Copiar enlace del portal del cliente">',
    cae: 'SCRUM-795 · 🔴 el botón del portal de la FICHA 360 no cuelga de `portalUrl`',
  },
  {
    // ② La avería que este ticket descartó por argumento: pedir el portal AL ABRIR. Con eso,
    // mirar un cliente escribiría en la base sin que nadie pulse nada.
    fichero: 'public/dashboard/js/customerDetailView.js',
    de: '  header.querySelector(\'#btn-copy-portal-360\').onclick = async () => {',
    a: '  await apiRequest(`/admin/customers/${id}/portal-url`);\n  header.querySelector(\'#btn-copy-portal-360\').onclick = async () => {',
    cae: 'SCRUM-795 · 🔴 pedir el portal ocurre AL PULSAR, nunca al abrir la ficha',
  },
];
