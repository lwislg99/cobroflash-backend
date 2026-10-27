// docs/master/evidencias/SCRUM-1537/escrituras-opacas.cjs — SCRUM-1537
//
// ¿CUÁNTAS ESCRITURAS DE VERDAD, EN `src/`, CAEN EN LO QUE `cotejo.cjs` NO VE?
//
//     node docs/master/evidencias/SCRUM-1537/escrituras-opacas.cjs
//
// `siembra-literal.cjs` dice QUÉ formas no ve. Esto cuenta CUÁNTAS hay hoy en el árbol, por delegado
// de Prisma, para los delegados de la tabla CAMPOS del instrumento. Una escritura es:
//   ABIERTA   su `data` (o `create`/`update` de un upsert) es un objeto literal sin derrames: el
//             instrumento puede leer qué campos lleva
//   OPACA     su `data` es una variable, una llamada o lleva un `...derrame`: el instrumento no sabe
//             si escribe el campo, ni con qué valor, y NO deja rastro
// No dice que una opaca escriba el campo: dice que no se puede saber leyendo la llamada.
//
// CONTROLES, sembrados sobre una fuente suelta (no sobre el árbol): una abierta, una con variable y
// una con derrame tienen que salir 1 · 1 · 1.
const fs = require('node:fs');
const path = require('node:path');

const RAIZ = path.resolve(__dirname, '..', '..', '..', '..');
const ts = require(require.resolve('typescript', { paths: [RAIZ, process.cwd()] }));
const { CAMPOS } = require('../scrum1500/cotejo.cjs');

const ESCRIBE = new Set(['create', 'update', 'upsert', 'createMany', 'updateMany', 'createManyAndReturn']);
const DATOS = new Set(['data', 'create', 'update']);
const desnuda = (e) => { let x = e; while (x && (ts.isAsExpression(x) || ts.isParenthesizedExpression(x) || ts.isNonNullExpression(x))) x = x.expression; return x; };

/** Las escrituras de un fichero: { delegado, linea, clase: 'abierta' | 'opaca', porque }. */
function escriturasDe(sf) {
  const o = [];
  (function ver(n) {
    if (ts.isCallExpression(n) && ts.isPropertyAccessExpression(n.expression) && ESCRIBE.has(n.expression.name.text)
      && ts.isPropertyAccessExpression(n.expression.expression)) {
      const delegado = n.expression.expression.name.text;
      const linea = sf.getLineAndCharacterOfPosition(n.getStart()).line + 1;
      const arg = desnuda(n.arguments[0]);
      let porque = null;
      if (!arg || !ts.isObjectLiteralExpression(arg)) porque = 'el argumento no es un objeto literal';
      else {
        const datos = arg.properties.filter((p) => p.name && ts.isIdentifier(p.name) && DATOS.has(p.name.text));
        if (arg.properties.some((p) => ts.isSpreadAssignment(p))) porque = 'el argumento lleva un derrame';
        else if (datos.length === 0) porque = 'no encuentro data/create/update';
        for (const p of datos) {
          const v = ts.isPropertyAssignment(p) ? desnuda(p.initializer) : null;
          const lista = v && ts.isArrayLiteralExpression(v) ? v.elements.map(desnuda) : [v];
          for (const x of lista) {
            if (!x || !ts.isObjectLiteralExpression(x)) porque = porque || `«${p.name.text}» no es un objeto literal`;
            else if (x.properties.some((q) => ts.isSpreadAssignment(q))) porque = porque || `«${p.name.text}» lleva un derrame`;
          }
        }
      }
      o.push({ delegado, linea, clase: porque ? 'opaca' : 'abierta', porque });
    }
    ts.forEachChild(n, ver);
  })(sf);
  return o;
}

function ficherosTs(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) ficherosTs(p, out);
    else if (e.name.endsWith('.ts') && !e.name.endsWith('.d.ts')) out.push(p);
  }
  return out;
}

const out = [];
const di = (s) => out.push(s);

// Los controles, antes que nada.
const suelta = ts.createSourceFile('suelta.ts', [
  'await prisma.sembrado.update({ where: { id }, data: { a: 1 } });',
  'await prisma.sembrado.update({ where: { id }, data: datos });',
  'await prisma.sembrado.update({ where: { id }, data: { ...datos, a: 1 } });',
].join('\n'), ts.ScriptTarget.Latest, true);
const c = escriturasDe(suelta);
const controles = `${c.filter((x) => x.clase === 'abierta').length} · ${c.filter((x) => x.porque && x.porque.includes('no es un objeto literal')).length} · ${c.filter((x) => x.porque && x.porque.includes('derrame')).length}`;
di(`CONTROLES sembrados (abierta · variable · derrame): ${controles} (tiene que ser 1 · 1 · 1)`);

const lista = ficherosTs(path.join(RAIZ, 'src'));
let sinParsear = 0;
const todas = [];
for (const f of lista) {
  let sf;
  try { sf = ts.createSourceFile(f, fs.readFileSync(f, 'utf8'), ts.ScriptTarget.Latest, true); } catch { sinParsear += 1; continue; }
  const rel = path.relative(RAIZ, f).replace(/\\/g, '/');
  for (const e of escriturasDe(sf)) todas.push({ ...e, sitio: `${rel}:${e.linea}` });
}
di(`POBLACION: ${lista.length} ficheros .ts bajo src/ (${sinParsear} sin parsear) · ${todas.length} llamadas de escritura de Prisma · ${todas.filter((x) => x.clase === 'opaca').length} opacas`);
di('');
di('POR CAMPO DE LA TABLA del instrumento (sin cierre = D sale sólo de las escrituras):');
for (const campo of CAMPOS) {
  const suyas = todas.filter((x) => x.delegado === campo.escribe[0]);
  const opacas = suyas.filter((x) => x.clase === 'opaca');
  di(`  ${(campo.etiqueta || campo.campo).padEnd(42)} ${campo.cierre ? 'con cierre' : 'SIN CIERRE'} · escrituras de «${campo.escribe[0]}»: ${String(suyas.length).padStart(3)} · opacas: ${String(opacas.length).padStart(2)}`);
  if (!campo.cierre) for (const x of opacas) di(`        ${x.sitio} · ${x.porque}`);
}
const salida = controles === '1 · 1 · 1' && sinParsear === 0 && lista.length > 0 ? 0 : 2;
di('');
di(`EXIT=${salida}`);
console.log(out.join('\n'));
process.exit(salida);
