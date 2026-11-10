// Ejecuta shouldApplyStatus TAL CUAL está en el fichero real (extraído por AST, sin copiarlo a mano)
const path = require('path'), fs = require('fs');
const raiz = path.resolve(process.argv[2]);
const ts = require(require.resolve('typescript', { paths: [raiz] }));
const f = path.join(raiz, 'src/modules/messaging/domain/whatsappLog.service.ts');
const sf = ts.createSourceFile(f, fs.readFileSync(f, 'utf8'), ts.ScriptTarget.Latest, true);
let trozos = [];
for (const s of sf.statements) {
  if (ts.isVariableStatement(s) && s.declarationList.declarations.some((d) => d.name.getText(sf) === 'STATUS_RANK')) trozos.push(s.getText(sf));
  if (ts.isFunctionDeclaration(s) && s.name && s.name.text === 'shouldApplyStatus') trozos.push(s.getText(sf).replace(/^export /, ''));
}
if (trozos.length !== 2) { console.log('CIEGO: no encontré los dos trozos, encontré', trozos.length); process.exit(1); }
const js = ts.transpileModule(trozos.join('\n') + '\nmodule.exports = shouldApplyStatus;', { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
const m = { exports: {} }; new Function('module', 'exports', js)(m, m.exports);
const fn = m.exports;
const desde = ['queued', 'sent', 'delivered', 'read', 'failed', 'received'];
const hacia = ['queued', 'sent', 'delivered', 'read', 'failed', 'received', 'deleted'];
console.log('desde\\hacia ' + hacia.join(' '));
for (const d of desde) console.log(d.padEnd(10) + ' ' + hacia.map((h) => (fn(d, h) ? 'SI' : '..').padEnd(h.length)).join(' '));
// control: queued->sent tiene que ser SI y read->delivered tiene que ser ..
console.log('CONTROL queued→sent', fn('queued', 'sent'), '· read→delivered', fn('read', 'delivered'));
