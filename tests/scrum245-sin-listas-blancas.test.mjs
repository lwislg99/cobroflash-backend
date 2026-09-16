// tests/scrum245-sin-listas-blancas.test.mjs — SCRUM-245 (re-derivado en SCRUM-410/245)
//
// REQUISITO J0, y está en el máster porque se perdió TRES veces:
//
//   «El producto debe poder enviar WhatsApp a cualquier número que el profesional introduzca
//    como cliente. Las listas blancas de teléfonos están prohibidas.»
//
// ── POR QUÉ ESTE FICHERO SE RE-DERIVÓ EN VEZ DE TRAERSE ─────────────────────────────────────
// El guard original quedó huérfano en su rama (SCRUM-391) y, al correrlo contra `main`, **falló
// por tres sitios y ninguno era una violación**:
//
//   · `DEMO_SAFE_NUMBERS` y `demoSendBlocked` → son **V0-2 DELIBERADO** (máster U1.1, regla 8):
//     el merchant demo solo envía a números seguros. Es la regla, no su incumplimiento.
//   · `huecosDeLaSerie(numeros, …)` → es de **series de factura**. Falso positivo puro.
//
// **La regla seguía siendo buena; el detector estaba caducado.** Y la salida NO podía ser una
// lista de exenciones: una excepción que hay que mantener es una excepción que alguien acaba
// ampliando. Así que los dos falsos positivos tenían que desaparecer **por construcción**.
//
// ── LAS TRES DERIVACIONES QUE LO CONSIGUEN ─────────────────────────────────────────────────
//
// 1 · **EL ÁMBITO ES EL CAMINO DE ENVÍO**, derivado de quién importa la puerta única de WhatsApp
//     (regla 1: todo WhatsApp pasa por `integrations/whatsapp.ts`). `huecosSerie.ts` vive en
//     `invoicing` y no importa esa puerta, así que **sale solo**: nadie lo exime, es que no
//     participa de ningún envío.
//
// 2 · **UNA LISTA BLANCA BLOQUEA CUANDO EL DESTINO *NO* ESTÁ.** Ése es el discriminante que
//     separa lo prohibido de lo legítimo, y es puramente estructural:
//       · `!allowed.includes(dest)` → **lista BLANCA**: solo pasan los de la lista. Es J0.
//       · `optedOut.some(c => … === to)` → **lista de BLOQUEO**: el opt-out por consentimiento,
//         que es legal y obligatorio. Pertenencia POSITIVA.
//     Sin esta distinción el detector marcaba `isWaOptedOut` y `esProcesoDeTest`, que no tienen
//     nada que ver.
//
// 3 · **LA LISTA VIENE DE FUERA, NO DE UNA CONSTANTE.** Un `!['accept','reject'].includes(x)` es
//     validación de un enum cerrado, no una lista blanca de teléfonos. Una lista de destinos
//     llega en **tiempo de ejecución** —un parámetro, `config.*` o `process.env.*`—; un enum se
//     escribe en el módulo. Esto quita los tres últimos falsos positivos sin nombrar ninguno.
//
// ── LO QUE HACE LEGÍTIMO AL FRENO DEL DEMO, Y TAMBIÉN SE DERIVA ─────────────────────────────
// `demoSendBlocked` SÍ es una lista blanca de teléfonos. Es legítima porque **su decisión está
// condicionada al merchant demo**: `if (merchantId !== DEMO_MERCHANT_ID) return false;` ANTES de
// comparar. Una lista que pueda frenar el envío de un profesional REAL es la violación.
//
// Así que la regla final no exime a nadie: **en el camino de envío, una lista blanca de destinos
// solo puede decidir un bloqueo si esa decisión cuelga de la comparación con el demo.**
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const RAIZ = path.resolve(import.meta.dirname, '..');
const PUERTA = 'src/integrations/whatsapp.ts';
const POLITICA = 'src/integrations/whatsappPolicy.ts';
const rel = (p) => path.relative(RAIZ, p).split(path.sep).join('/');

/** El camino de envío: la puerta única + su política + todo el que las importa. DERIVADO. */
function caminoDeEnvio() {
  const importan = [];
  (function andar(d) {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) andar(p);
      else if (p.endsWith('.ts') && /from '[^']*integrations\/whatsapp(Policy)?'/.test(fs.readFileSync(p, 'utf8'))) {
        importan.push(rel(p));
      }
    }
  })(path.join(RAIZ, 'src'));
  return [...new Set([PUERTA, POLITICA, ...importan])].filter((f) => fs.existsSync(path.join(RAIZ, f)));
}

/**
 * ¿El operando de la pertenencia llega de FUERA (parámetro, config, env) o es una constante?
 *
 * 🔴 RESUELVE UN SALTO, Y LO PIDIÓ EL SUELO. La primera versión miraba solo el identificador
 * inmediato y **no encontraba `demoSendBlocked`**, porque su lista es un local:
 *
 *     const allowed = safeNumbers.map(…);   ← `safeNumbers` ES el parámetro
 *     return !allowed.includes(dest);
 *
 * O sea que habría dicho «ninguna lista blanca» sobre un árbol que tiene una. El suelo lo cazó en
 * vez de dejarlo pasar en verde, que es exactamente para lo que está.
 */
function vieneDeFuera(nodoLista, params, sf, locales) {
  const t = nodoLista.getText(sf);
  if (ts.isArrayLiteralExpression(nodoLista)) return false;        // ['accept','reject'] → enum
  if (/^(config|process\.env)\b/.test(t)) return true;             // config.DEMO_SAFE_NUMBERS
  const raiz = t.replace(/[.[(].*$/, '').trim();
  if (params.includes(raiz)) return true;                           // parámetro de la función
  const ini = locales.get(raiz);                                    // un salto: local ← parámetro
  if (!ini) return false;
  if (/^(config|process\.env)\b/.test(ini)) return true;
  return params.some((p) => new RegExp(`\\b${p}\\b`).test(ini));
}

/** Listas BLANCAS (pertenencia NEGADA) que deciden algo, dentro de una función. */
function listasBlancasDe(fn, sf) {
  const params = fn.parameters.map((p) => p.name.getText(sf));
  // Los `const` locales con el TEXTO de su inicializador, para resolver el salto de arriba.
  const locales = new Map();
  (function recoger(n) {
    if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && n.initializer) {
      locales.set(n.name.text, n.initializer.getText(sf));
    }
    ts.forEachChild(n, recoger);
  })(fn.body);
  const out = [];
  const mirar = (n) => {
    let lista = null;
    if (ts.isPrefixUnaryExpression(n) && n.operator === ts.SyntaxKind.ExclamationToken
      && ts.isCallExpression(n.operand) && ts.isPropertyAccessExpression(n.operand.expression)
      && /^(includes|some)$/.test(n.operand.expression.name.text)) {
      lista = n.operand.expression.expression;
    }
    if (ts.isBinaryExpression(n)
      && [ts.SyntaxKind.EqualsEqualsEqualsToken, ts.SyntaxKind.LessThanToken].includes(n.operatorToken.kind)
      && ts.isCallExpression(n.left) && ts.isPropertyAccessExpression(n.left.expression)
      && n.left.expression.name.text === 'indexOf') {
      lista = n.left.expression.expression;
    }
    if (lista && vieneDeFuera(lista, params, sf, locales)) out.push(n.getText(sf).slice(0, 70));
    ts.forEachChild(n, mirar);
  };
  mirar(fn.body);
  return out;
}

function censar() {
  const camino = caminoDeEnvio();
  const conLista = [];
  for (const f of camino) {
    const codigo = fs.readFileSync(path.join(RAIZ, f), 'utf8');
    const sf = ts.createSourceFile(f, codigo, ts.ScriptTarget.Latest, true);
    (function v(n) {
      if ((ts.isFunctionDeclaration(n) || ts.isMethodDeclaration(n) || ts.isArrowFunction(n)) && n.body) {
        const listas = listasBlancasDe(n, sf);
        if (listas.length) {
          conLista.push({
            fichero: f,
            nombre: n.name ? n.name.getText(sf) : '(anónima)',
            listas,
            // La decisión cuelga del demo: es lo que hace legítima a la única lista blanca viva.
            gateDemo: /DEMO_MERCHANT_ID|isDemoMerchant/.test(n.getText(sf)),
          });
        }
      }
      ts.forEachChild(n, v);
    })(sf);
  }
  return { camino, conLista };
}

// ═══════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-245 · SUELO: el detector encuentra el camino de envío y SÍ ve una lista blanca', () => {
  const { camino, conLista } = censar();
  assert.ok(camino.length >= 10,
    `🔴 solo ${camino.length} ficheros en el camino de envío: el derivador no está mirando. «Ninguna lista blanca» y «no miré» son el mismo verde`);
  assert.ok(camino.includes(PUERTA) && camino.includes(POLITICA),
    '🔴 el camino no incluye la puerta única ni su política: el detector no puede estar viendo los envíos');
  // Y el suelo que de verdad importa: tiene que ENCONTRAR la lista blanca que sí existe. Si no ve
  // la del demo —que está ahí, medida—, tampoco vería una nueva.
  assert.ok(conLista.length > 0,
    '🔴 el detector no encuentra NI UNA lista blanca, y `demoSendBlocked` es una: está roto, no es que el árbol esté limpio');
});

test('SCRUM-245 · el falso positivo de las series sale POR CONSTRUCCIÓN, no por exención', () => {
  // `huecosDeLaSerie` hacía fallar al guard original. No se exime: es que `invoicing` no importa
  // la puerta de WhatsApp, así que no participa de ningún envío y el ámbito no lo alcanza.
  const { camino } = censar();
  assert.ok(!camino.some((f) => /huecosSerie|invoicing\/domain\/huecos/.test(f)),
    '🔴 el ámbito ha dejado de derivarse del camino de envío: si alcanza a `invoicing`, volverán los falsos positivos de series');
});

test('SCRUM-245 · el opt-out (pertenencia POSITIVA) no se confunde con una lista blanca', () => {
  // `isWaOptedOut` bloquea cuando el destino SÍ está en la lista: es consentimiento, legal y
  // obligatorio. Marcarlo sería pedir que se retire el opt-out.
  const { conLista } = censar();
  assert.ok(!conLista.some((c) => c.nombre === 'isWaOptedOut'),
    '🔴 el detector marca el opt-out: bloquear a quien PIDIÓ no recibir no es una lista blanca');
});

test('SCRUM-245 · J0: ninguna lista blanca de destinos decide un envío sin estar condicionada al demo', () => {
  const { conLista } = censar();
  const culpables = conLista
    .filter((c) => !c.gateDemo)
    .map((c) => `${c.fichero} → ${c.nombre}: ${c.listas[0]}`);

  assert.deepEqual(
    culpables, [],
    '🔴 HA VUELTO UNA LISTA BLANCA DE TELÉFONOS:\n    ' + culpables.join('\n    ')
    + '\n\n  Requisito J0 del máster, y va en el máster porque se perdió TRES veces:\n'
    + '    «El producto debe poder enviar WhatsApp a cualquier número que el profesional\n'
    + '     introduzca como cliente. Las listas blancas de teléfonos están prohibidas.»\n\n'
    + '  La ÚNICA legítima es el freno del demo (V0-2, regla 8), y lo es porque su decisión\n'
    + '  cuelga de `merchantId !== DEMO_MERCHANT_ID`. Una lista que pueda frenar el envío de un\n'
    + '  profesional REAL es la violación, se llame como se llame.\n\n'
    + '  No hay lista de exenciones y no se va a añadir: una excepción que hay que mantener es\n'
    + '  una excepción que alguien acaba ampliando.');
});

test('SCRUM-245 · CONTROL POSITIVO: el freno del demo sigue existiendo y sigue condicionado', () => {
  // Si mañana alguien le quita el `merchantId !== DEMO_MERCHANT_ID`, el demo podría escribir a
  // cualquiera — y este guard lo vería como una violación de J0, que es exactamente lo que sería.
  const { conLista } = censar();
  const demo = conLista.find((c) => c.nombre === 'demoSendBlocked');
  assert.ok(demo, '🔴 `demoSendBlocked` ya no compara el destino contra la lista: el freno del demo ha desaparecido (V0-2, regla 8)');
  assert.ok(demo.gateDemo, '🔴 el freno del demo ya no está condicionado al merchant demo: ahora puede frenar a un profesional real');
});
