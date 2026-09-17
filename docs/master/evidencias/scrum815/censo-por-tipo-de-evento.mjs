// SCRUM-815b · ¿CUANTOS TIPOS DE EVENTO maneja el webhook, y cuales NO son idempotentes?
//
// El expediente de main censa por CLASE DE EFECTO (6). El encargo pregunta otra cosa: por TIPO
// de evento de Stripe. No es lo mismo — un tipo puede disparar varios efectos, y la idempotencia
// se decide por lo que hace CADA tipo.
//
// AST, nunca grep (SCRUM-203): `event.type` aparece tambien en console.log y comentarios.
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const RAIZ = new URL('../../../../', import.meta.url);
// Acepta una ruta por argv para poder PROBAR EL SUELO contra un fichero sin tipos de evento.
const RUTA = process.argv[2] || fileURLToPath(new URL('src/modules/billing/app/routes/stripe.routes.ts', RAIZ));
const codigo = fs.readFileSync(RUTA, 'utf8');
const sf = ts.createSourceFile(RUTA, codigo, ts.ScriptTarget.Latest, true);

// ── ① los TIPOS comparados contra `event.type` ────────────────────────────────────────────
const tipos = new Map(); // tipo -> linea
(function r(n) {
  if (ts.isBinaryExpression(n)
    && (n.operatorToken.kind === ts.SyntaxKind.EqualsEqualsEqualsToken
      || n.operatorToken.kind === ts.SyntaxKind.EqualsEqualsToken)) {
    const izq = n.left.getText().replace(/\s+/g, '');
    const der = n.right;
    if (/(^|\.)event\.type$/.test(izq) && ts.isStringLiteral(der)) {
      const { line } = sf.getLineAndCharacterOfPosition(n.getStart());
      if (!tipos.has(der.text)) tipos.set(der.text, line + 1);
    }
  }
  // `['a','b'].includes(event.type)` — la otra forma de despachar
  if (ts.isCallExpression(n) && ts.isPropertyAccessExpression(n.expression)
    && n.expression.name.getText() === 'includes'
    && n.arguments[0] && /(^|\.)event\.type$/.test(n.arguments[0].getText().replace(/\s+/g, ''))
    && ts.isArrayLiteralExpression(n.expression.expression)) {
    const { line } = sf.getLineAndCharacterOfPosition(n.getStart());
    for (const el of n.expression.expression.elements) {
      if (ts.isStringLiteral(el) && !tipos.has(el.text)) tipos.set(el.text, line + 1);
    }
  }
  ts.forEachChild(n, r);
})(sf);

// ── SUELO: si no ve ningun tipo, esta CIEGO ───────────────────────────────────────────────
if (tipos.size === 0) {
  console.log('🔴 CENSO CIEGO: cero tipos de evento. No es "no maneja ninguno".');
  process.exit(3);
}

console.log('TIPOS DE EVENTO DE STRIPE QUE EL WEBHOOK DESPACHA: ' + tipos.size);
for (const [t, l] of [...tipos].sort((a, b) => a[1] - b[1])) console.log(`  src/modules/billing/app/routes/stripe.routes.ts:${l}  ${t}`);

// ── ② por cada tipo, QUE EFECTOS dispara ──────────────────────────────────────────────────
// Se toma el bloque `then` de cada `if` que compara con ese tipo y se listan sus llamadas.
const EFECTOS = {
  'axios.post': 'SALIDA HTTP fuera del proceso',
  'prisma.merchant.update': 'escritura de plan',
  'prisma.merchant.updateMany': 'escritura de plan',
  handleStripeDispute: 'escritura en BD (disputa)',
  rewardReferralOnFirstPayment: 'recompensa de referido',
  sendFirstPaymentEmail: 'CORREO (no reversible)',
  conConstancia: 'envoltorio de correo',
};
console.log('');
console.log('EFECTOS POR TIPO:');
(function r(n) {
  if (ts.isIfStatement(n)) {
    const txt = n.expression.getText().replace(/\s+/g, '');
    const m = [...tipos.keys()].filter((t) => txt.includes(`'${t}'`) || txt.includes(`"${t}"`));
    if (m.length) {
      const llamadas = new Set();
      (function q(x) {
        if (ts.isCallExpression(x)) {
          const nom = x.expression.getText().replace(/\s+/g, '');
          for (const k of Object.keys(EFECTOS)) if (nom === k || nom.endsWith('.' + k) || nom.includes(k)) llamadas.add(k);
        }
        ts.forEachChild(x, q);
      })(n.thenStatement);
      const { line } = sf.getLineAndCharacterOfPosition(n.getStart());
      console.log(`  [:${line + 1}] ${m.join(' | ')}`);
      if (!llamadas.size) console.log('       (sin efectos de la lista)');
      for (const c of llamadas) console.log(`       · ${c} — ${EFECTOS[c]}`);
    }
  }
  ts.forEachChild(n, r);
})(sf);

// ── CONTROL POSITIVO del extractor de efectos ─────────────────────────────────────────────
const SINTETICO = `if (event.type === 'x.y') { await axios.post('/z'); await prisma.merchant.update({}); }`;
const sfS = ts.createSourceFile('s.ts', SINTETICO, ts.ScriptTarget.Latest, true);
let vistos = 0;
(function r(n) {
  if (ts.isCallExpression(n)) {
    const nom = n.expression.getText().replace(/\s+/g, '');
    for (const k of Object.keys(EFECTOS)) if (nom === k || nom.includes(k)) vistos++;
  }
  ts.forEachChild(n, r);
})(sfS);
console.log('');
console.log('CONTROL POSITIVO del extractor (fuente sintetica con 2 efectos): ve ' + vistos
  + (vistos >= 2 ? ' ✅' : ' 🔴 CIEGO'));
