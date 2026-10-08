// SCRUM-1509c - a QUIEN se le pregunta el tope: censo por AST de las llamadas a los envios que
// acaban en una plantilla, y de que le pasan (`merchantId`, `log.customerId`).
// Uso: node censo-llamadas.cjs <raiz-del-repo> [nombre ...]
// Sin nombres, busca los dos envios que pueden mandar plantilla. Con un nombre inventado debe dar 0.
const fs = require('fs');
const path = require('path');
const { createRequire } = require('module');
const raiz = path.resolve(process.argv[2] || '.');
const ts = createRequire(path.join(raiz, 'src/app.ts'))('typescript');
const nombres = process.argv.slice(3).length ? process.argv.slice(3) : ['sendWhatsAppTemplate', 'sendWhatsAppWindowFirst'];

const ficheros = [];
(function andar(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) andar(p); else if (/\.ts$/.test(e.name) && !/\.d\.ts$/.test(e.name)) ficheros.push(p);
  }
})(path.join(raiz, 'src'));

let nodos = 0;
const llamadas = [];
for (const f of ficheros) {
  const sf = ts.createSourceFile(f, fs.readFileSync(f, 'utf8'), ts.ScriptTarget.Latest, true);
  (function ver(n) {
    nodos += 1;
    if (ts.isCallExpression(n)) {
      const c = n.expression;
      const nombre = ts.isIdentifier(c) ? c.text : (ts.isPropertyAccessExpression(c) ? c.name.text : null);
      if (nombre && nombres.includes(nombre)) {
        const a = n.arguments[0];
        let merchant = 'no-literal'; let cliente = 'no-literal';
        if (a && ts.isObjectLiteralExpression(a)) {
          const prop = (k) => a.properties.find((p) => p.name && p.name.getText(sf) === k);
          const hayEsparcido = a.properties.some((p) => ts.isSpreadAssignment(p));
          merchant = prop('merchantId') ? 'si' : (hayEsparcido ? 'esparcido' : 'NO');
          const log = prop('log');
          if (!log) cliente = hayEsparcido ? 'esparcido' : 'NO';
          else if (ts.isShorthandPropertyAssignment(log)) cliente = 'log-variable';
          else if (ts.isPropertyAssignment(log) && ts.isObjectLiteralExpression(log.initializer)) {
            cliente = log.initializer.properties.some((p) => p.name && p.name.getText(sf) === 'customerId') ? 'si' : 'NO';
          } else cliente = 'log-variable';
        }
        const { line } = sf.getLineAndCharacterOfPosition(n.getStart(sf));
        llamadas.push({ fichero: path.relative(raiz, f).replace(/\\/g, '/'), linea: line + 1, nombre, merchant, cliente });
      }
    }
    ts.forEachChild(n, ver);
  })(sf);
}
console.log('ficheros .ts en src: ' + ficheros.length + ' · nodos: ' + nodos + ' · nombres buscados: ' + nombres.join(', '));
console.log('llamadas: ' + llamadas.length);
for (const l of llamadas) console.log([l.nombre, l.fichero + ':' + l.linea, 'merchantId=' + l.merchant, 'cliente=' + l.cliente].join('\t'));
const cuenta = (k, v) => llamadas.filter((l) => l[k] === v).length;
console.log('RESUMEN cliente: si=' + cuenta('cliente', 'si') + ' NO=' + cuenta('cliente', 'NO') + ' log-variable=' + cuenta('cliente', 'log-variable') + ' esparcido=' + cuenta('cliente', 'esparcido') + ' no-literal=' + cuenta('cliente', 'no-literal'));
console.log('RESUMEN merchantId: si=' + cuenta('merchant', 'si') + ' NO=' + cuenta('merchant', 'NO') + ' esparcido=' + cuenta('merchant', 'esparcido') + ' no-literal=' + cuenta('merchant', 'no-literal'));
