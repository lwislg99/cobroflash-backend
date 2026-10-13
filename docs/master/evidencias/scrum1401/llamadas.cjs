// llamadas.cjs — SCRUM-1401: qué valores pasan los LLAMADORES a las funciones que escriben la fila.
//   node llamadas.cjs <raiz con src/> <ruta a typescript>
// Para cada [callee, propiedad]: todas las llamadas cuyo callee (identificador o .nombre) casa, y
// dentro de sus argumentos, a cualquier profundidad, la propiedad con ese nombre.
// Modo hermano: propiedad P en un objeto literal que TAMBIEN tiene la propiedad H.
const fs = require('node:fs');
const path = require('node:path');
const raiz = path.resolve(process.argv[2]);
const ts = require(path.resolve(process.argv[3]));

const POR_LLAMADA = [
  [/^recordCustomerEvent$/, 'type'],
  [/^recordWaMessage$/, 'type'],
  [/^recordWaMessage$/, 'status'],
  [/^recordWaMessage$/, 'relatedType'],
  [/^updateWaMessageStatus$/, '(arg1)'],
  [/WhatsApp|^sendWa|^enviarWa/, 'relatedType'],
  [/^recordCustomerEvent$/, 'campoQueNoExiste'], // control negativo
  [/^funcionQueNoExiste$/, 'type'],              // control negativo
];
const HERMANOS = [
  ['relatedType', 'kind'],
  ['campoQueNoExiste', 'kind'], // control negativo
];

function ficheros(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) ficheros(p, out);
    else if (e.name.endsWith('.ts') && !e.name.endsWith('.d.ts')) out.push(p);
  }
  return out;
}
const nombreDe = (e) => (ts.isIdentifier(e) ? e.text : ts.isPropertyAccessExpression(e) ? e.name.text : null);
const lista = ficheros(path.join(raiz, 'src'));
const res = POR_LLAMADA.map(() => ({ llamadas: 0, filas: [] }));
const herm = HERMANOS.map(() => []);
let sinParsear = 0;

for (const f of lista) {
  let sf;
  try { sf = ts.createSourceFile(f, fs.readFileSync(f, 'utf8'), ts.ScriptTarget.Latest, true); } catch { sinParsear += 1; continue; }
  const rel = path.relative(raiz, f).replace(/\\/g, '/');
  const linea = (n) => sf.getLineAndCharacterOfPosition(n.getStart()).line + 1;
  const txt = (n) => n.getText().replace(/\s+/g, ' ').slice(0, 120);
  (function ver(n, activos) {
    let a = activos;
    if (ts.isCallExpression(n)) {
      const nom = nombreDe(n.expression);
      if (nom) {
        POR_LLAMADA.forEach(([re, prop], i) => {
          if (!re.test(nom)) return;
          res[i].llamadas += 1;
          if (prop === '(arg1)') {
            const arg = n.arguments[1];
            res[i].filas.push(`${rel}:${linea(n)}  ${arg ? txt(arg) : '(sin arg)'}`);
          } else {
            a = [...a, i];
          }
        });
      }
    }
    if (ts.isObjectLiteralExpression(n)) {
      const nombres = new Map();
      for (const p of n.properties) if (p.name && (ts.isIdentifier(p.name) || ts.isStringLiteral(p.name))) nombres.set(p.name.text, p);
      HERMANOS.forEach(([p, h], i) => {
        if (nombres.has(p) && nombres.has(h)) {
          const nodo = nombres.get(p);
          const nk = nombres.get(h);
          herm[i].push(`${rel}:${linea(nodo)}  ${p}=${ts.isPropertyAssignment(nodo) ? txt(nodo.initializer) : '(abreviada)'}  ·  ${h}=${ts.isPropertyAssignment(nk) ? txt(nk.initializer) : '(abreviada)'}`);
        }
      });
    }
    if ((ts.isPropertyAssignment(n) || ts.isShorthandPropertyAssignment(n)) && n.name && ts.isIdentifier(n.name)) {
      for (const i of a) {
        if (POR_LLAMADA[i][1] === n.name.text) {
          res[i].filas.push(`${rel}:${linea(n)}  ${ts.isPropertyAssignment(n) ? txt(n.initializer) : '(abreviada)'}`);
        }
      }
    }
    ts.forEachChild(n, (h) => ver(h, a));
  })(sf, []);
}

console.log(`POBLACION: ${lista.length} ficheros .ts bajo src/ · ${sinParsear} sin parsear`);
POR_LLAMADA.forEach(([re, prop], i) => {
  console.log(`\n=== callee ${re} · propiedad ${prop} · ${res[i].llamadas} llamadas · ${res[i].filas.length} valores`);
  for (const l of res[i].filas) console.log(`  ${l}`);
});
HERMANOS.forEach(([p, h], i) => {
  console.log(`\n=== objeto con «${p}» y «${h}» · ${herm[i].length}`);
  for (const l of herm[i]) console.log(`  ${l}`);
});
const pos = res[0].filas.length;
const neg = res[6].filas.length + res[7].llamadas + herm[1].length;
const ok = lista.length > 0 && sinParsear === 0 && pos > 0 && neg === 0;
console.log(`\nCONTROLES: positivo=${pos} (>0) · negativos=${neg} (0)`);
console.log(ok ? 'EXIT=0' : 'CIEGO\nEXIT=2');
process.exit(ok ? 0 : 2);
