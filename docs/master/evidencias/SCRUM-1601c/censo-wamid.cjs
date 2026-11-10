// SCRUM-1601c · Censo por AST: toda escritura de WhatsAppMessage y toda llamada a sus
// escritores, con el `status` y si lleva `waMessageId`. Uso: node censo-wamid.cjs <raiz> [<fichero extra>...]
const ts = require(require.resolve('typescript', { paths: [process.cwd()] }));
const fs = require('fs');
const path = require('path');

const raiz = process.argv[2];
const extra = process.argv.slice(3);
const ficheros = [];
(function walk(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p);
    else if (/\.(ts|mts|cts|js|mjs)$/.test(e.name)) ficheros.push(p);
  }
})(raiz);
ficheros.push(...extra);

const ESCRITURAS = new Set(['create', 'createMany', 'update', 'updateMany', 'upsert']);
const LLAMADAS = new Set(['recordWaMessage', 'resolverReservaDePlantilla']);
const filas = [];
let rawSql = 0;

function claves(obj, sf) {
  const out = { status: '(ausente)', waMessageId: false, spreads: [] };
  if (!obj || !ts.isObjectLiteralExpression(obj)) return { status: '(no literal)', waMessageId: '?', spreads: [] };
  for (const p of obj.properties) {
    if (ts.isSpreadAssignment(p)) {
      out.spreads.push(p.expression.getText(sf).replace(/\s+/g, ' ').slice(0, 140));
      continue;
    }
    const n = p.name && p.name.getText(sf);
    if (n === 'status') out.status = ts.isPropertyAssignment(p) ? p.initializer.getText(sf) : n;
    if (n === 'waMessageId') out.waMessageId = ts.isPropertyAssignment(p) ? p.initializer.getText(sf) : 'shorthand';
  }
  return out;
}

for (const f of ficheros) {
  const txt = fs.readFileSync(f, 'utf8');
  const sf = ts.createSourceFile(f, txt, ts.ScriptTarget.Latest, true);
  (function visit(n) {
    if (ts.isTaggedTemplateExpression(n) || ts.isNoSubstitutionTemplateLiteral(n) || ts.isStringLiteral(n)) {
      if (/whatsapp_messages|wa_message_id/.test(n.getText(sf)) && /UPDATE|INSERT/i.test(n.getText(sf))) rawSql++;
    }
    if (ts.isCallExpression(n)) {
      const c = n.expression;
      const linea = sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1;
      const donde = `${path.relative(process.cwd(), f)}:${linea}`;
      if (ts.isPropertyAccessExpression(c) && ESCRITURAS.has(c.name.text) &&
          ts.isPropertyAccessExpression(c.expression) && c.expression.name.text === 'whatsAppMessage') {
        const arg = n.arguments[0];
        let data = null;
        if (arg && ts.isObjectLiteralExpression(arg)) {
          for (const p of arg.properties) if (p.name && p.name.getText(sf) === 'data' && ts.isPropertyAssignment(p)) data = p.initializer;
        }
        if (data && ts.isCallExpression(data)) data = null; // data: lista.map(...) → se mira a mano
        filas.push({ donde, que: `whatsAppMessage.${c.name.text}`, ...claves(data, sf), dataTxt: data ? '' : (arg ? arg.getText(sf).replace(/\s+/g, ' ').slice(0, 160) : '') });
      }
      const nombre = ts.isIdentifier(c) ? c.text : null;
      if (nombre && LLAMADAS.has(nombre)) {
        const arg = nombre === 'recordWaMessage' ? n.arguments[0] : n.arguments[2];
        filas.push({ donde, que: nombre, ...claves(arg, sf), dataTxt: '' });
      }
    }
    ts.forEachChild(n, visit);
  })(sf);
}

console.log(`ficheros leídos: ${ficheros.length} · llamadas censadas: ${filas.length} · SQL crudo que escribe la tabla: ${rawSql}`);
for (const r of filas) {
  console.log(`${r.donde} · ${r.que} · status=${r.status} · waMessageId=${r.waMessageId}` +
    (r.spreads.length ? ` · spreads=[${r.spreads.join(' | ')}]` : '') + (r.dataTxt ? ` · arg=${r.dataTxt}` : ''));
}
const malas = filas.filter((r) => /queued/.test(r.status) && r.waMessageId && r.waMessageId !== false);
console.log(`queued CON waMessageId en la misma escritura: ${malas.length}`);
for (const r of malas) console.log('  ⚠️ ' + r.donde);
