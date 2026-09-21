// SCRUM-931 · ¿cambia alguna palabra de copy? Por AST, fichero por fichero, BASE vs ARREGLO.
// Se extraen TODOS los literales de texto (string y template) fuera de comentarios. En los
// templates, cada `${expr}` se sustituye por un marcador: IMPORTE si la expresión es un importe
// (o la pareja `${importe} ${currency}`), y `${·}` si no. Se comparan los MULTICONJUNTOS.
const { execFileSync } = require('child_process');
const path = require('path');
const WT = path.resolve(__dirname, '../..');
const ts = require(path.join(WT, 'node_modules/typescript'));
const BASE = '7340d33116c5ab168aa7c5a67abee02813014cf8';
const FIX = 'd7d83e048696454efce7eeceb41c674b36f88b76';
const FICHEROS = [
  'src/integrations/whatsappNotifications.ts',
  'src/integrations/whatsappTemplates.ts',
  'src/modules/billing/app/routes/mpWebhook.routes.ts',
  'src/modules/billing/app/routes/psp.routes.ts',
  'src/modules/billing/domain/invoiceReminder.service.ts',
  'src/modules/billing/domain/invoiceWhatsApp.service.ts',
  'src/modules/messaging/domain/email.service.ts',
  'src/modules/quotes/domain/reminder.service.ts',
  'src/modules/quotes/domain/sendQuote.service.ts',
  'src/modules/system/app/routes/invoicesAdmin.routes.ts',
];
const show = (rev, f) => execFileSync('git', ['-C', WT, 'show', `${rev}:${f}`], { encoding: 'utf8', maxBuffer: 1 << 26 });
const ES_IMPORTE = /\b(total|amount|amt|importe|amountWithCurrency|totalWithCurrency)\b|formatMoneyEs|toFixed/;
const ES_DIVISA = /currency|\bcur\b/;

function literales(src, f) {
  const sf = ts.createSourceFile(f, src, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const out = [];
  const visitar = (n) => {
    if (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) out.push(n.text);
    else if (ts.isTemplateExpression(n)) {
      const trozos = [n.head.text];
      for (const s of n.templateSpans) {
        const e = s.expression.getText(sf);
        trozos.push(ES_IMPORTE.test(e) ? '«IMPORTE»' : ES_DIVISA.test(e) ? '«DIVISA»' : '${·}');
        trozos.push(s.literal.text);
      }
      // `«IMPORTE» «DIVISA»` (la forma vieja) y `«IMPORTE»` (la nueva) son el MISMO hueco.
      out.push(trozos.join('').replace(/«IMPORTE» «DIVISA»/g, '«IMPORTE»'));
      for (const s of n.templateSpans) visitar(s.expression); // templates anidados
      return;
    }
    n.forEachChild(visitar);
  };
  visitar(sf);
  return out;
}
const multiconjunto = (arr) => arr.reduce((m, x) => m.set(x, (m.get(x) || 0) + 1), new Map());
const resta = (a, b) => { const r = []; for (const [k, v] of a) { const d = v - (b.get(k) || 0); for (let i = 0; i < d; i++) r.push(k); } return r; };

let total = 0, conDiferencia = 0;
for (const f of FICHEROS) {
  let fix = show(FIX, f);
  // CONTROL POSITIVO: con MUTAR=1 se cambia UNA palabra de copy al cliente; el instrumento tiene que verla.
  if (process.env.MUTAR === '1' && f.endsWith('whatsappNotifications.ts')) fix = fix.replace('Hemos confirmado tu pago de ${importe}', 'Confirmamos tu pago de ${importe}');
  const a = literales(show(BASE, f), f), b = literales(fix, f);
  total += a.length;
  const ma = multiconjunto(a), mb = multiconjunto(b);
  const quitados = resta(ma, mb), puestos = resta(mb, ma);
  console.log(`\n${f}  · literales base=${a.length} arreglo=${b.length}`);
  if (!quitados.length && !puestos.length) { console.log('  idénticos'); continue; }
  conDiferencia++;
  for (const q of quitados) console.log('  − ' + JSON.stringify(q));
  for (const p of puestos) console.log('  + ' + JSON.stringify(p));
}
console.log(`\nTESTIGO: ${FICHEROS.length} ficheros, ${total} literales en la base, ${conDiferencia} ficheros con alguna diferencia`);
