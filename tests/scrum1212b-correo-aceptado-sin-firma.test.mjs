// tests/scrum1212b-correo-aceptado-sin-firma.test.mjs — SCRUM-1212 (firma 1, c.17355)
//
// El correo «presupuesto aceptado» al profesional decía «El cliente ha firmado digitalmente el
// presupuesto.», y el único camino que lo manda —el bot, aceptación POR TEXTO— nunca tiene firma.
// Texto firmado: «El cliente ha aceptado el presupuesto.» UNO solo: la variante «ha firmado» se
// descartó porque ningún camino que manda este correo puede traer trazo (rama muerta).
//
// 🔴 EL CINTURÓN, que es la mitad que importa: ningún camino que llame a
// `sendMerchantQuoteAcceptedEmail` puede conocer una firma (`signatureUrl` / `signatureData`). Si
// mañana alguien engancha uno que sí la trae —p. ej. `/decision`—, esto se pone ROJO y obliga a
// volver a decidir el texto en vez de mandar una mentira en silencio.
//
// Se mide por AST (identificadores de código, nunca comentarios) sobre `src/`. Control positivo: el
// MISMO detector ve la firma en el handler de `POST /quote/:token/decision`, que sí la tiene.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const RAIZ = path.resolve(import.meta.dirname, '..');
const EMISOR = 'sendMerchantQuoteAcceptedEmail';
const DE_FIRMA = new Set(['signatureUrl', 'signatureData']);

function ficherosTs(dir) {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...ficherosTs(p));
    else if (e.name.endsWith('.ts') && !e.name.endsWith('.d.ts')) out.push(p);
  }
  return out;
}

const esFuncion = (n) => ts.isFunctionDeclaration(n) || ts.isFunctionExpression(n)
  || ts.isArrowFunction(n) || ts.isMethodDeclaration(n);

/** La función MÁS EXTERNA que envuelve al nodo: el camino entero (handler o función del bot). */
function caminoDe(nodo) {
  let camino = null;
  for (let p = nodo.parent; p; p = p.parent) if (esFuncion(p)) camino = p;
  return camino;
}

function conoceLaFirma(fn) {
  let si = false;
  const ver = (n) => {
    if (si) return;
    if (ts.isIdentifier(n) && DE_FIRMA.has(n.text)) { si = true; return; }
    ts.forEachChild(n, ver);
  };
  ver(fn);
  return si;
}

function llamadasAlEmisor() {
  const caminos = [];
  for (const f of ficherosTs(path.join(RAIZ, 'src'))) {
    const texto = fs.readFileSync(f, 'utf8');
    if (!texto.includes(EMISOR)) continue;
    const sf = ts.createSourceFile(f, texto, ts.ScriptTarget.Latest, true);
    const ver = (n) => {
      if (ts.isCallExpression(n) && ts.isIdentifier(n.expression) && n.expression.text === EMISOR) {
        const fn = caminoDe(n);
        const linea = sf.getLineAndCharacterOfPosition(n.getStart()).line + 1;
        caminos.push({ donde: `${path.relative(RAIZ, f).replace(/\\/g, '/')}:${linea}`, fn });
      }
      ts.forEachChild(n, ver);
    };
    ver(sf);
  }
  return caminos;
}

test('SCRUM-1212 · el correo dice «ha aceptado», no «ha firmado digitalmente»', () => {
  const src = fs.readFileSync(path.join(RAIZ, 'src/modules/messaging/domain/merchantNotifications.ts'), 'utf8');
  assert.ok(src.includes('El cliente ha aceptado el presupuesto.'), '🔴 falta el texto firmado (c.17355)');
  assert.ok(!src.includes('firmado digitalmente'), '🔴 vuelve la afirmación de una firma que no existe');
});

test('🔴 SCRUM-1212 · NINGÚN camino que manda este correo conoce una firma', () => {
  const caminos = llamadasAlEmisor();
  assert.ok(caminos.length >= 1, '🔴 CIEGO: no se encuentra ninguna llamada al emisor; el cero de abajo no mediría nada');
  for (const c of caminos) assert.ok(c.fn, `🔴 ${c.donde}: llamada fuera de una función, no sé qué camino es`);
  const conFirma = caminos.filter((c) => conoceLaFirma(c.fn)).map((c) => c.donde);
  assert.deepEqual(conFirma, [],
    '🔴 un camino que CONOCE la firma manda el correo «ha aceptado». Si el cliente firmó, el texto se '
    + 'queda corto: vuelve a SCRUM-1212 y decide el texto con el orquestador antes de enchufarlo.');
});

test('SCRUM-1212 · CONTROL POSITIVO: el detector SÍ ve la firma en el handler de /decision', () => {
  const f = path.join(RAIZ, 'src/modules/quotes/app/routes/quotes.routes.ts');
  const sf = ts.createSourceFile(f, fs.readFileSync(f, 'utf8'), ts.ScriptTarget.Latest, true);
  let handler = null;
  const ver = (n) => {
    if (handler) return;
    if (ts.isCallExpression(n) && n.arguments.length >= 2 && ts.isStringLiteral(n.arguments[0])
      && n.arguments[0].text === '/:token/decision') {
      handler = n.arguments[n.arguments.length - 1];
      return;
    }
    ts.forEachChild(n, ver);
  };
  ver(sf);
  assert.ok(handler && esFuncion(handler), '🔴 no encuentro el handler de /decision: el control no vale');
  assert.ok(conoceLaFirma(handler), '🔴 el detector no ve `signatureUrl` donde SÍ está: su «nadie la conoce» no significa nada');
});
