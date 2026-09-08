// tests/scrum815-idempotencia-del-webhook.test.mjs — SCRUM-815 · BANCO DE MEDIDA
//
// ═════════════════════════════════════════════════════════════════════════════════════════
// ⛔ ESTE FICHERO NO ARREGLA NADA. Es el paso ① del ticket: **medir para decidir**. El arreglo
// necesita tabla o columnas nuevas, y en esta casa el orden es ① decisión → ② ALTER aditivo en
// las TRES bases → ③ PR. Aquí sólo se fija el defecto de HOY para que la decisión se tome sobre
// hechos y para que el arreglo tenga una línea base contra la que probarse.
//
// Lo que hace `isDuplicateStripeEvent` (`stripe.routes.ts:22-29`): **pregunta y MARCA en la misma
// llamada**, antes de que el trabajo empiece. Y el almacén es un `Set` en memoria del módulo con
// tope 500. De ahí salen TRES modos de pérdida, y el tercero no estaba en el encargo.
//
// ⛔ Ni una clave de Stripe, ni real ni de ejemplo: nada de esto la necesita. `isDuplicateStripeEvent`
// está exportada (A12.2) y es pura, así que los tres modos se miden sin montar la ruta ni firmar
// un evento. Lo que NO se puede medir así se declara abajo, no se simula por encima.
// ═════════════════════════════════════════════════════════════════════════════════════════
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import ts from 'typescript';
import { fileURLToPath } from 'node:url';
import { isDuplicateStripeEvent } from '../dist/modules/billing/app/routes/stripe.routes.js';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const RUTA = 'src/modules/billing/app/routes/stripe.routes.ts';

/**
 * OTRA INSTANCIA = OTRO PROCESO DE VERDAD.
 *
 * 🔴 La primera versión de este banco recargaba el módulo con un `?instancia=` en la URL,
 * contando con que Node tratara cada URL como un módulo distinto. **No vale aquí**: `dist/` se
 * compila a CommonJS, y ahí `import()` resuelve por RUTA y devuelve el mismo objeto de la caché
 * de `require`. El test salió rojo diciendo que la otra instancia SÍ conocía el evento — y el
 * defecto era del instrumento: no había segunda instancia.
 *
 * Se lanza un proceso hijo. Además de ser cierto, es exactamente el escenario ·②: otra réplica,
 * un reinicio, un deploy.
 */
function enOtroProceso(guion) {
  const r = spawnSync(process.execPath, ['-e', guion], { cwd: RAIZ, encoding: 'utf8' });
  assert.equal(r.status, 0,
    `🔴 SUELO: el proceso hijo no ha arrancado (${r.status}). Sin él no hay segunda instancia y `
    + `este fichero no mide nada. ${r.stderr || ''}`);
  return JSON.parse(String(r.stdout).trim().split('\n').pop());
}

const CARGAR = "const m = require('./dist/modules/billing/app/routes/stripe.routes.js');";

// ═══ 🔴 SUELO ═════════════════════════════════════════════════════════════════════════════

test('SCRUM-815 · 🔴 SUELO: el detector distingue un evento nuevo de uno ya visto', () => {
  // Sin esto, un detector que dijera siempre `false` pasaría el caso ② y uno que dijera siempre
  // `true` pasaría el ①. Se comprueba que hace las dos cosas antes de creerse nada de abajo.
  const id = `evt_suelo_${Date.now()}`;
  assert.equal(isDuplicateStripeEvent(id), false, '🔴 marca como duplicado un evento nunca visto');
  assert.equal(isDuplicateStripeEvent(id), true, '🔴 no reconoce un evento que acaba de ver');
});

// ═══ ① EL COBRO QUE SE PIERDE ═════════════════════════════════════════════════════════════

test('SCRUM-815 · 🔴 ① fallo A MITAD del trabajo → el reintento se DESCARTA', () => {
  // La secuencia real: llega el evento, `isDuplicateStripeEvent` lo MARCA (línea 25) y sólo
  // DESPUÉS empieza el trabajo (línea 47). Si el trabajo revienta, la ruta contesta 400 y Stripe
  // reintenta — bien, el 400 es lo que hace que reintente y no se toca. Pero el reintento
  // encuentra la marca ya puesta y se va por `duplicate: true` sin hacer nada.
  const id = `evt_${Date.now()}_uno`;

  assert.equal(isDuplicateStripeEvent(id), false, 'primera entrega: no es duplicado');
  // ── aquí el manejador reventaría: el `axios.post` a /webhooks/psp no llega, el cobro NO se aplica

  assert.equal(isDuplicateStripeEvent(id), true,
    '🔴 EL REINTENTO SE DESCARTA. El trabajo no se hizo y el evento consta como procesado: el '
    + 'cobro se pierde y Stripe ya no volverá a intentarlo porque le contestamos 200.');
});

// ═══ ② EL COBRO QUE SE APLICA DOS VECES ═══════════════════════════════════════════════════

test('SCRUM-815 · 🔴 ② proceso NUEVO → un evento ya procesado se REPROCESA', async () => {
  const id = `evt_${Date.now()}_dos`;

  assert.equal(isDuplicateStripeEvent(id), false, 'primera entrega en la instancia A');
  assert.equal(isDuplicateStripeEvent(id), true, 'la instancia A ya lo tiene');

  // El hijo ve el MISMO evento por primera vez: su `Set` nace vacío.
  const veredicto = enOtroProceso(
    `${CARGAR} console.log(JSON.stringify({ duplicado: m.isDuplicateStripeEvent(${JSON.stringify(id)}) }));`,
  );
  assert.equal(veredicto.duplicado, false,
    '🔴 OTRO PROCESO NO SABE NADA. El almacén es un `Set` en memoria del módulo, así que cada '
    + 'réplica, cada reinicio y cada deploy empieza de cero y vuelve a aplicar el trabajo de un '
    + 'evento que ya se procesó.');
});

// ═══ ③ EL TERCERO, QUE NO ESTABA EN EL ENCARGO ════════════════════════════════════════════

test('SCRUM-815 · 🔴 ③ con UNA sola instancia, el tope de 500 también lo olvida', async () => {
  // 🔴 Ni siquiera hace falta una segunda réplica: el LRU tira el más viejo al llegar a 500. Un
  // reintento de Stripe puede tardar horas —reintenta hasta 3 días— y en ese hueco caben de sobra
  // 500 eventos. El mismo modo de fallo que ②, sin necesidad de escalar.
  const r = enOtroProceso(`${CARGAR}
    const viejo = 'evt_el_primero_de_todos';
    const primera = m.isDuplicateStripeEvent(viejo);
    const marcado = m.isDuplicateStripeEvent(viejo);
    for (let i = 0; i < 500; i++) m.isDuplicateStripeEvent('evt_relleno_' + i);
    console.log(JSON.stringify({ primera, marcado, trasElRelleno: m.isDuplicateStripeEvent(viejo) }));`);

  assert.equal(r.primera, false, 'se ve por primera vez');
  assert.equal(r.marcado, true, 'y queda marcado');
  assert.equal(r.trasElRelleno, false,
    '🔴 EL TOPE DE 500 LO HA OLVIDADO. Con una sola instancia y sin reiniciar nada, un evento ya '
    + 'procesado vuelve a contar como nuevo. Stripe reintenta hasta 3 días: en ese hueco caben '
    + '500 eventos de sobra.');
});

// ═══ 📌 LA PREMISA DE LA DECISIÓN, FIJADA ═════════════════════════════════════════════════

test('SCRUM-815 · 📌 pregunta y marca siguen en la MISMA llamada, antes del trabajo', () => {
  // Si mañana alguien separa las dos cosas, esta decisión se tomó sobre otro código y hay que
  // releerla. Se mira el AST, no el texto: el comentario que explica el defecto lo nombra.
  const src = fs.readFileSync(path.join(RAIZ, RUTA), 'utf8');
  const sf = ts.createSourceFile('x.ts', src, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);

  let fn = null;
  (function walk(n) {
    if (ts.isFunctionDeclaration(n) && n.name?.getText(sf) === 'isDuplicateStripeEvent') fn = n;
    ts.forEachChild(n, walk);
  })(sf);
  assert.ok(fn, '🔴 SUELO: no encuentro `isDuplicateStripeEvent`. Sin ella no se mide nada.');

  const cuerpo = fn.body.getText(sf);
  assert.match(cuerpo, /\.has\(/, '🔴 ha dejado de PREGUNTAR');
  assert.match(cuerpo, /\.add\(/,
    '🔴 ha dejado de MARCAR dentro de la misma función. Si la marca se ha movido, el defecto de '
    + 'SCRUM-815 puede estar ya arreglado y esta medición ya no describe el código.');
  assert.ok(cuerpo.indexOf('.has(') < cuerpo.indexOf('.add('),
    '🔴 el orden ha cambiado dentro de la función');
});

test('SCRUM-815 · 📌 el censo de EFECTOS del manejador no crece sin decirlo', () => {
  // 🔴 De esta lista depende la decisión: qué es reversible y qué no. Si alguien añade un efecto
  // —otro correo, otra llamada fuera— la propuesta de columnas se queda corta y hay que rehacerla.
  // Se cuenta por AST desde donde empieza el trabajo, no por `grep`.
  const src = fs.readFileSync(path.join(RAIZ, RUTA), 'utf8');
  const sf = ts.createSourceFile('x.ts', src, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);

  const PUROS = /^(Number|String|Boolean|console\.|res\.|new Date|internalHeaders|\()/;
  const efectos = [];
  (function walk(n) {
    if (ts.isCallExpression(n)) {
      const t = n.expression.getText(sf).replace(/\s+/g, ' ');
      const linea = sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1;
      if (linea >= 47 && !PUROS.test(t) && !/\.(toUpperCase|toISOString|isInteger|catch)$/.test(t)) {
        efectos.push(t);
      }
    }
    ts.forEachChild(n, walk);
  })(sf);

  const censo = {};
  for (const e of efectos) censo[e] = (censo[e] || 0) + 1;

  assert.deepEqual(censo, {
    handleStripeDispute: 1,          // escribe en BD
    'axios.post': 3,                 // 🔴 FUERA DEL PROCESO: confirmado / fallido / expirado
    'prisma.merchant.update': 5,     // BD, idempotentes por valor
    rewardReferralOnFirstPayment: 1, // BD, guardada por `referralRewardedAt` — SIN cerrojo
    conConstancia: 1,                // 🔴 CORREO, y sin `await`
    sendFirstPaymentEmail: 1,        // el correo de dentro, guardado por `lifecycleEmailsSent`
  }, '🔴 HA CAMBIADO LO QUE HACE EL MANEJADOR. La decisión de SCRUM-815 se tomó sobre estos '
    + 'efectos: tres salidas fuera del proceso, cinco escrituras de plan, una recompensa y un '
    + 'correo. Si la lista cambia, la propuesta de columnas hay que releerla antes de aplicarla.');
});
