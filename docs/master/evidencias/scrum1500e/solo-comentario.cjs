// Comprueba que entre dos versiones de un .ts SOLO cambian comentarios.
// Uso: node solo-comentario.cjs <raiz-del-repo> <ruta> <ref-base>
// Tres vias: (1) lineas, (2) tokens del escaner de TypeScript sin trivia, (3) JS emitido sin comentarios.
// Control positivo: una copia con UN token de codigo cambiado tiene que salir DISTINTA.
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const [raiz, ruta, ref] = process.argv.slice(2);
// el arbol anidado no trae node_modules: se resuelve hacia arriba y se DICE cual se uso
const dondeTs = require.resolve('typescript', { paths: [raiz] });
const ts = require(dondeTs);
console.log(`typescript ${ts.version} desde ${dondeTs}`);

const antes = execFileSync('git', ['-C', raiz, 'show', `${ref}:${ruta}`], { encoding: 'utf8' });
const despues = fs.readFileSync(path.join(raiz, ruta), 'utf8');

function tokens(src) {
  const sc = ts.createScanner(ts.ScriptTarget.Latest, /* skipTrivia */ true, ts.LanguageVariant.Standard, src);
  const out = [];
  for (let k = sc.scan(); k !== ts.SyntaxKind.EndOfFileToken; k = sc.scan()) out.push(`${k}:${sc.getTokenText()}`);
  return out;
}
function emitido(src) {
  return ts.transpileModule(src, { compilerOptions: { removeComments: true, target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS } }).outputText;
}

const la = antes.split(/\r?\n/);
const ld = despues.split(/\r?\n/);
const distintas = [];
for (let i = 0; i < Math.max(la.length, ld.length); i++) if (la[i] !== ld[i]) distintas.push(i + 1);

const ta = tokens(antes);
const td = tokens(despues);
const ea = emitido(antes);
const ed = emitido(despues);

// control positivo: mutar un token de codigo y ver que las dos vias lo ven
const mutada = despues.replace('getEmissionMode,', 'getEmissionModeZ,');
const ctrlMutada = mutada !== despues;
const ctrlTokens = JSON.stringify(tokens(mutada)) !== JSON.stringify(td);
const ctrlEmit = emitido(mutada) !== ed;

console.log(`fichero: ${ruta} · base ${ref}`);
console.log(`lineas: antes ${la.length} · despues ${ld.length} · distintas: [${distintas.join(', ')}]`);
console.log(`bytes: antes ${Buffer.byteLength(antes)} · despues ${Buffer.byteLength(despues)}`);
console.log(`CR: antes ${(antes.match(/\r/g) || []).length} · despues ${(despues.match(/\r/g) || []).length}`);
console.log(`tokens de codigo (sin comentarios): antes ${ta.length} · despues ${td.length} · identicos: ${JSON.stringify(ta) === JSON.stringify(td)}`);
console.log(`JS emitido sin comentarios: antes ${ea.length} B · despues ${ed.length} B · identico: ${ea === ed}`);
console.log(`las lineas distintas empiezan por //: ${distintas.every((n) => /^\s*\/\//.test(ld[n - 1]) && /^\s*\/\//.test(la[n - 1]))}`);
console.log(`control positivo (un token de codigo mutado): la mutacion se aplico ${ctrlMutada} · tokens lo ven ${ctrlTokens} · emitido lo ve ${ctrlEmit}`);

const ok = la.length === ld.length && ta.length > 0 && JSON.stringify(ta) === JSON.stringify(td) && ea === ed
  && distintas.length > 0 && ctrlMutada && ctrlTokens && ctrlEmit;
console.log(ok ? 'VEREDICTO: SOLO COMENTARIO' : 'VEREDICTO: NO SE PUEDE AFIRMAR');
process.exit(ok ? 0 : 1);
