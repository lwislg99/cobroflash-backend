// SCRUM-489 · EL WEBHOOK DE MERCADOPAGO DEJA DE TIRAR EL TRADUCTOR QUE YA LLAMA.
//
// Sin gate: AST sobre `src/`. Ni BD, ni red.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// 🔴 EL DEFECTO
//
// `mpWebhook.routes.ts` pide el pago a MercadoPago —`getMpPayment(...)`— y esa función YA devuelve
// el método traducido al vocabulario de la casa (`mercadopago.ts` → `metodoDesdeMercadoPago`).
// Tres líneas después, el `update` que marca el cobro como **pagado** ignoraba ese valor y escribía
// `method: 'mp'` a fuego.
//
// `'mp'` no está en `PAID_VIA`. Y no es una preferencia: es un `update` **en el momento del pago**,
// así que el `paid_via` que queda registrado es falso. Es la familia de SCRUM-191 —atribución
// falsa, que es peor que la ausencia: el dato existe, parece bueno y miente— sobre la columna que
// viaja al CSV del asesor.
//
// SCRUM-474 arregló el TRADUCTOR y no a su CONSUMIDOR. El traductor llevaba desde entonces
// devolviendo el valor correcto para que nadie lo mirara.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// LA INVARIANTE, Y NO ES «TIENE QUE SER VÁLIDO»
//
// `esMetodoValido('desconocido')` es **false** a propósito: el desconocido declarado vive FUERA del
// conjunto cerrado. Así que lo que se exige aquí es más fino:
//
//     o un método del conjunto (`<paid_via>[:pasarela]`), o el DESCONOCIDO DECLARADO. Nada más.
//
// Un `'mp'` inventado y un `'desconocido'` declarado están los dos fuera de `PAID_VIA` y son cosas
// opuestas: uno afirma un método que nadie ha visto, el otro dice que no consta.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { fileURLToPath } from 'node:url';
import { PAID_VIA } from '../dist/modules/billing/domain/paidVia.js';
import { METODO_DESCONOCIDO, esMetodoValido, metodoDesdeMercadoPago } from '../dist/modules/billing/domain/metodoDeCobro.js';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const WEBHOOK = 'src/modules/billing/app/routes/mpWebhook.routes.ts';
const leer = (p) => fs.readFileSync(path.join(RAIZ, p), 'utf8');

/**
 * Toda escritura de `Charge` del árbol con el TEXTO de su `method` — en sus DOS formas.
 *
 * ⚠️ La forma ABREVIADA (`method,`) se mira igual que la explícita. Un censo que solo veía
 * `method: <expr>` sumaba bien y clasificaba mal: dejaba fuera justo la línea que abría SCRUM-486.
 * **La suma cuadra y la lista miente.**
 */
function escriturasDeCharge() {
  const out = [];
  let ficheros = 0;
  const visitarDir = (dir) => {
    for (const e of fs.readdirSync(path.join(RAIZ, dir), { withFileTypes: true })) {
      const p = `${dir}/${e.name}`;
      if (e.isDirectory()) { if (!/node_modules|\.git|dist/.test(e.name)) visitarDir(p); continue; }
      if (!/\.(ts|mjs|js)$/.test(e.name)) continue;
      ficheros += 1;
      const src = fs.readFileSync(path.join(RAIZ, p), 'utf8');
      if (!/charge\.(create|update|updateMany|upsert)/.test(src)) continue;
      const sf = ts.createSourceFile('x.ts', src, ts.ScriptTarget.Latest, true);
      const visitar = (n) => {
        if (ts.isCallExpression(n) && ts.isPropertyAccessExpression(n.expression)
            && /^(create|update|updateMany|upsert)$/.test(n.expression.name.text)
            && /charge$/i.test((n.expression.expression.getText(sf).split('.').pop() || ''))) {
          const arg = n.arguments[0];
          if (arg && ts.isObjectLiteralExpression(arg)) {
            const data = arg.properties.find((q) => q.name && q.name.getText(sf) === 'data');
            let metodo = null;
            if (data && ts.isPropertyAssignment(data) && ts.isObjectLiteralExpression(data.initializer)) {
              for (const q of data.initializer.properties) {
                if (!q.name || q.name.getText(sf) !== 'method') continue;
                if (ts.isPropertyAssignment(q)) metodo = q.initializer.getText(sf).replace(/\s+/g, ' ');
                else if (ts.isShorthandPropertyAssignment(q)) metodo = '<abreviada>';
              }
            }
            const { line } = sf.getLineAndCharacterOfPosition(n.getStart(sf));
            out.push({ fichero: p, linea: line + 1, metodo });
          }
        }
        ts.forEachChild(n, visitar);
      };
      visitar(sf);
    }
  };
  visitarDir('src');
  visitarDir('scripts');
  return { escrituras: out, ficheros };
}

// ── 🔴 EL CONTROL NEGATIVO VA PRIMERO — protege el dinero ────────────────────────────────

test('SCRUM-489 · 🔴 CONTROL NEGATIVO: el cobro sigue marcándose PAGADO, con su fecha y su importe', () => {
  // Va el primero a propósito. Un arreglo del `method` que pueda dejar un cobro sin marcar como
  // pagado es PEOR que el defecto que arregla: el defecto registra mal un cobro que existe; el
  // arreglo malo haría desaparecer el cobro.
  const src = leer(WEBHOOK);
  const sf = ts.createSourceFile('x.ts', src, ts.ScriptTarget.Latest, true);

  let update = null;
  const visitar = (n) => {
    if (ts.isCallExpression(n) && /charge\.update$/.test(n.expression.getText(sf))
        && n.arguments[0] && ts.isObjectLiteralExpression(n.arguments[0])) {
      const data = n.arguments[0].properties.find((p) => p.name && p.name.getText(sf) === 'data');
      if (data && ts.isPropertyAssignment(data) && /datosDeCobroPagado/.test(data.initializer.getText(sf))) {
        update = data.initializer.getText(sf);
      }
    }
    ts.forEachChild(n, visitar);
  };
  visitar(sf);

  assert.ok(update,
    '🔴 NO HAY NINGÚN `update` QUE MARQUE EL COBRO COMO PAGADO CON `datosDeCobroPagado(...)`.\n\n'
    + '  Dos lecturas y las dos exigen mirar: o el webhook ha dejado de marcar el pago —y entonces\n'
    + '  un cobro real de MercadoPago no consta como cobrado, que es MUCHO peor que registrar mal\n'
    + '  su método—, o este guard ha dejado de saber dónde mirar. Ninguna de las dos se pasa por\n'
    + '  alto: son dinero.');
  assert.match(update, /\.\.\.datosDeCobroPagado\(new Date\(\)/,
    '🔴 EL COBRO YA NO SE MARCA COMO PAGADO CON SU INSTANTE.\n\n'
    + '  `datosDeCobroPagado(...)` es lo que pone `status: paid` y `paidAt` en UN solo instante\n'
    + '  (SCRUM-397). Si este arreglo lo toca, un pago real de MercadoPago deja de constar como\n'
    + '  cobrado — y eso es peor que registrar mal el método.');
  assert.match(update, /reference: mpPaymentId/,
    '🔴 se ha perdido la referencia del pago de MercadoPago.');
  assert.match(update, /reconciliations/,
    '🔴 se ha perdido la conciliación del pago.');
});

// ── SUELO ────────────────────────────────────────────────────────────────────────────────

test('SCRUM-489 · SUELO: el censo ve las escrituras de Charge, en sus dos formas', () => {
  const { escrituras, ficheros } = escriturasDeCharge();
  assert.ok(ficheros > 100, `🔴 ESCÁNER CIEGO: solo ${ficheros} ficheros recorridos.`);
  assert.ok(escrituras.length >= 10,
    `🔴 ESCÁNER CIEGO: ${escrituras.length} escrituras de Charge y eran ONCE (medido el 2026-08-12).`);
  const conMetodo = escrituras.filter((e) => e.metodo !== null);
  assert.ok(conMetodo.length >= 5,
    `🔴 solo ${conMetodo.length} escriben \`method\` y eran SEIS. Si el censo deja de ver alguna, `
    + 'su silencio no vale nada.');
  // La suma cuadra Y la forma abreviada se ve. Lo segundo no lo garantiza lo primero.
  assert.ok(conMetodo.some((e) => e.metodo === '<abreviada>'),
    '🔴 EL CENSO NO VE LA FORMA ABREVIADA (`method,`). Sumaría igual y clasificaría mal — es el '
    + 'defecto exacto de mi primer censo en SCRUM-486: la suma cuadra y la lista miente.');
});

// ── 🔴 EL VECTOR ─────────────────────────────────────────────────────────────────────────

test('SCRUM-489 · 🔴 el webhook de MP escribe lo que el traductor devuelve, no un literal', () => {
  const src = leer(WEBHOOK);
  const sf = ts.createSourceFile('x.ts', src, ts.ScriptTarget.Latest, true);
  let metodoEscrito = null;
  let linea = null;
  const visitar = (n) => {
    if (ts.isCallExpression(n) && /charge\.update$/.test(n.expression.getText(sf))
        && n.arguments[0] && ts.isObjectLiteralExpression(n.arguments[0])) {
      const data = n.arguments[0].properties.find((p) => p.name && p.name.getText(sf) === 'data');
      if (data && ts.isPropertyAssignment(data) && ts.isObjectLiteralExpression(data.initializer)) {
        for (const q of data.initializer.properties) {
          if (q.name && q.name.getText(sf) === 'method' && ts.isPropertyAssignment(q)) {
            metodoEscrito = q.initializer.getText(sf).replace(/\s+/g, ' ');
            linea = sf.getLineAndCharacterOfPosition(q.getStart(sf)).line + 1;
          }
        }
      }
    }
    ts.forEachChild(n, visitar);
  };
  visitar(sf);

  assert.ok(metodoEscrito, '🔴 el `update` del pago ya no escribe `method`: guard ciego o cambio de forma.');

  // 🔴 Un LITERAL aquí es el defecto: al cerrar un cobro no se afirma un método a mano.
  const literal = (metodoEscrito.match(/^'([^']*)'$/) || [])[1];
  assert.equal(
    literal, undefined,
    `🔴 EL WEBHOOK DE MERCADOPAGO ESCRIBE UN MÉTODO A FUEGO: «${literal}» en ${WEBHOOK}:${linea}.\n\n`
    + '  Tres líneas antes, `getMpPayment(...)` YA devuelve el método traducido al vocabulario de\n'
    + '  la casa (`metodoDesdeMercadoPago`). Escribir un literal aquí es tirar ese valor y afirmar\n'
    + '  un `paid_via` que nadie ha observado — sobre un cobro que en esta misma línea pasa a\n'
    + `  PAGADO. Escribe \`payment.method\`; si el traductor no puede determinarlo, él ya devuelve\n`
    + `  «${METODO_DESCONOCIDO}», que dice que no consta en vez de adivinar.`,
  );
  assert.match(metodoEscrito, /payment\.method/,
    `🔴 el método no sale del pago consultado (${metodoEscrito}).`);
});

test('SCRUM-489 · 🔴 ninguna escritura de Charge afirma un método inventado', () => {
  // La invariante: o del conjunto cerrado, o el DESCONOCIDO DECLARADO. Nada más.
  const { escrituras } = escriturasDeCharge();
  const inventados = [];
  for (const e of escrituras) {
    const lit = (String(e.metodo || '').match(/^'([^']*)'$/) || [])[1];
    if (lit === undefined) continue;                    // no es un literal: lo miran otros tests
    if (esMetodoValido(lit) || lit === METODO_DESCONOCIDO) continue;
    inventados.push(`${e.fichero}:${e.linea} → '${lit}'`);
  }
  assert.deepEqual(inventados, [],
    `🔴 HAY UNA ESCRITURA QUE AFIRMA UN MÉTODO QUE NO EXISTE:\n    ${inventados.join('\n    ')}\n\n`
    + `  Los válidos son \`<metodo>[:<pasarela>]\` con metodo en PAID_VIA (${PAID_VIA.join(', ')}),\n`
    + `  y el único valor fuera del conjunto que se admite es «${METODO_DESCONOCIDO}», que declara\n`
    + '  que no consta. Un valor inventado no es un hueco: es una atribución falsa, y viaja al CSV\n'
    + '  del asesor pareciendo un dato bueno (SCRUM-191).');
});

// ── CONTROL POSITIVO DEL CRITERIO ────────────────────────────────────────────────────────

test('SCRUM-489 · el traductor ya resuelve el caso difícil: no consta ≠ inventado', () => {
  // Sin esto, «ninguna escritura inventa» se cumpliría también con un traductor que devolviera
  // cualquier cosa. Lo que hace legítimo escribir su salida es que su salida es honesta.
  assert.equal(metodoDesdeMercadoPago('credit_card'), 'card:mercadopago');
  assert.equal(metodoDesdeMercadoPago('bank_transfer'), 'transfer:mercadopago');
  assert.equal(metodoDesdeMercadoPago('un_tipo_nuevo_de_mp'), METODO_DESCONOCIDO,
    '🔴 un tipo que no conocemos tiene que salir como DESCONOCIDO DECLARADO, no aproximado al '
    + 'vecino ni convertido en «mp».');
  assert.equal(metodoDesdeMercadoPago(null), METODO_DESCONOCIDO);
  // Y el desconocido NO es un método válido: son cosas distintas y el guard de arriba lo respeta.
  assert.equal(esMetodoValido(METODO_DESCONOCIDO), false,
    '🔴 el desconocido declarado ha entrado en el conjunto cerrado. Si «no consta» pasa a ser un '
    + 'método, deja de poder distinguirse de un método real.');
  // CONTROL NEGATIVO del propio criterio: los cinco legítimos siguen siendo válidos, sin fricción.
  for (const v of PAID_VIA) {
    assert.equal(esMetodoValido(v), true, `🔴 «${v}» ha dejado de ser un método válido.`);
    assert.equal(esMetodoValido(`${v}:mercadopago`), true, `🔴 «${v}:mercadopago» rechazado.`);
  }
});
