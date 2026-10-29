// SCRUM-1499 · censo por AST de lo que se ESCRIBE en WhatsAppMessage.type / .status
// Uso: node censo-wa.cjs <raiz-del-arbol> [--sin-semilla]
const path = require('path');
const fs = require('fs');
const raiz = path.resolve(process.argv[2]);
const sinSemilla = process.argv.includes('--sin-semilla');
const ts = require(require.resolve('typescript', { paths: [raiz] }));

const ESCRITURAS = new Set(['create', 'createMany', 'update', 'updateMany', 'upsert']);
const FUNCIONES = new Set(['recordWaMessage', 'updateWaMessageStatus']);

function ficheros(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) ficheros(p, out);
    else if (e.name.endsWith('.ts') && !e.name.endsWith('.d.ts')) out.push(p);
  }
  return out;
}

const hallazgos = [];
let sinParsear = 0;

function propsDe(nodo, sf, donde, via) {
  // todas las PropertyAssignment type/status bajo `nodo` (incluye ternarios y spreads)
  (function walk(n) {
    if (ts.isPropertyAssignment(n) && n.name && ['type', 'status'].includes(n.name.getText(sf))) {
      const init = n.initializer;
      const valor = ts.isStringLiteral(init) || ts.isNoSubstitutionTemplateLiteral(init)
        ? `'${init.text}'` : `EXPR ${init.getText(sf).replace(/\s+/g, ' ').slice(0, 80)}`;
      const linea = sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1;
      hallazgos.push({ campo: n.name.getText(sf), valor, fichero: donde, linea, via });
    }
    if (ts.isShorthandPropertyAssignment(n) && ['type', 'status'].includes(n.name.getText(sf))) {
      const linea = sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1;
      hallazgos.push({ campo: n.name.getText(sf), valor: 'SHORTHAND', fichero: donde, linea, via });
    }
    ts.forEachChild(n, walk);
  })(nodo);
}

function analiza(fuente, donde) {
  const sf = ts.createSourceFile(donde, fuente, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  if (sf.parseDiagnostics && sf.parseDiagnostics.length) sinParsear++;
  const alias = new Map(); // nombre local -> nombre original
  for (const f of FUNCIONES) alias.set(f, f);
  (function walk(n) {
    if (ts.isImportSpecifier(n)) {
      const orig = (n.propertyName || n.name).getText(sf);
      if (FUNCIONES.has(orig)) alias.set(n.name.getText(sf), orig);
    }
    ts.forEachChild(n, walk);
  })(sf);
  (function walk(n) {
    if (ts.isCallExpression(n)) {
      const c = n.expression;
      // ①  <algo>.whatsAppMessage.<escritura>({ data: … })
      if (ts.isPropertyAccessExpression(c) && ESCRITURAS.has(c.name.text)
          && ts.isPropertyAccessExpression(c.expression) && c.expression.name.text === 'whatsAppMessage') {
        const arg = n.arguments[0];
        if (arg && ts.isObjectLiteralExpression(arg)) {
          for (const p of arg.properties) {
            if (ts.isPropertyAssignment(p) && ['data', 'create', 'update'].includes(p.name.getText(sf))) {
              propsDe(p.initializer, sf, donde, `whatsAppMessage.${c.name.text}`);
            }
          }
        } else {
          const linea = sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1;
          hallazgos.push({ campo: '?', valor: 'ARG-NO-LITERAL', fichero: donde, linea, via: `whatsAppMessage.${c.name.text}` });
        }
      }
      // ②  llamadas a recordWaMessage / updateWaMessageStatus (o su alias)
      const nombre = ts.isIdentifier(c) ? c.text : ts.isPropertyAccessExpression(c) ? c.name.text : null;
      if (nombre && alias.has(nombre)) {
        const orig = alias.get(nombre);
        const linea = sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1;
        if (orig === 'recordWaMessage') {
          const arg = n.arguments[0];
          if (arg && ts.isObjectLiteralExpression(arg)) {
            const antes = hallazgos.length;
            propsDe(arg, sf, donde, 'recordWaMessage(arg)');
            const tieneStatus = hallazgos.slice(antes).some((h) => h.campo === 'status');
            if (!tieneStatus) hallazgos.push({ campo: 'status', valor: "OMITIDO → defecto de recordWaMessage", fichero: donde, linea, via: 'recordWaMessage(arg)' });
          } else {
            hallazgos.push({ campo: '?', valor: `ARG-NO-LITERAL ${arg ? arg.getText(sf).slice(0, 60) : ''}`, fichero: donde, linea, via: 'recordWaMessage(arg)' });
          }
        } else {
          const a = n.arguments[1];
          const valor = a && (ts.isStringLiteral(a) || ts.isNoSubstitutionTemplateLiteral(a)) ? `'${a.text}'` : `EXPR ${a ? a.getText(sf).slice(0, 60) : ''}`;
          hallazgos.push({ campo: 'status', valor, fichero: donde, linea, via: 'updateWaMessageStatus(_, status)' });
        }
      }
    }
    ts.forEachChild(n, walk);
  })(sf);
}

const lista = ficheros(path.join(raiz, 'src'));
for (const f of lista) analiza(fs.readFileSync(f, 'utf8'), path.relative(raiz, f).replace(/\\/g, '/'));

// SEMILLA (control positivo fabricado por el propio instrumento)
const SEMILLA = `import { recordWaMessage as rw } from './x';
await prisma.whatsAppMessage.create({ data: { type: 'SEMILLA_T1', status: 'SEMILLA_S1' } });
await rw({ type: 'SEMILLA_T2' });
await prisma.whatsAppMesage.create({ data: { type: 'NEGATIVO_T', status: 'NEGATIVO_S' } });`;
if (!sinSemilla) analiza(SEMILLA, '<semilla>');

const semilla = hallazgos.filter((h) => h.fichero === '<semilla>');
const reales = hallazgos.filter((h) => h.fichero !== '<semilla>');
console.log(`POBLACION: ${lista.length} ficheros .ts en src/ · sin parsear: ${sinParsear}`);
for (const h of reales) console.log(`${h.campo.padEnd(6)} ${h.valor.padEnd(46)} ${h.fichero}:${h.linea}  [${h.via}]`);
console.log(`TOTAL hallazgos reales: ${reales.length}`);
const esperado = ["type 'SEMILLA_T1'", "status 'SEMILLA_S1'", "type 'SEMILLA_T2'"];
const vistos = semilla.map((h) => `${h.campo} ${h.valor}`);
const okPos = esperado.every((e) => vistos.includes(e));
const negativos = semilla.filter((h) => h.valor.includes('NEGATIVO')).length;
if (sinSemilla) console.log('CONTROL POSITIVO: CIEGO (semilla quitada a propósito; no hay veredicto)');
else console.log(`CONTROL POSITIVO (semilla): ${okPos ? 'VISTO' : 'CIEGO'} · ${vistos.join(' | ')}`);
console.log(`CONTROL CERO (modelo mal escrito): ${negativos} (esperado 0)`);
process.exit(!sinSemilla && okPos && negativos === 0 && sinParsear === 0 ? 0 : 1);
