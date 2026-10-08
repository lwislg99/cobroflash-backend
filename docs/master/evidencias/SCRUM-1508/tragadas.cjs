// SCRUM-1508 - toda escritura prisma de un arbol, clasificada por si su fallo puede llegar al llamador.
const fs = require('fs'), path = require('path'), ts = require(process.env.TS_LIB);
const raiz = path.resolve(process.argv[2]);
const ESCR = new Set(['create','createMany','update','updateMany','upsert','delete','deleteMany','createManyAndReturn']);
const LECT = new Set(['findMany','findFirst','findUnique','findFirstOrThrow','findUniqueOrThrow','count','groupBy','aggregate']);
const modo = process.argv[3] || 'escrituras';
const soloModelo = process.argv[4] || null;
function* andar(d){ for (const e of fs.readdirSync(d,{withFileTypes:true})) { if (['node_modules','dist','.git'].includes(e.name)) continue; const p=path.join(d,e.name); if (e.isDirectory()) yield* andar(p); else if (/\.(ts|mjs|js|cjs)$/.test(e.name)) yield p; } }
const fich = fs.statSync(raiz).isDirectory() ? [...andar(raiz)] : [raiz];
const esFn = (p) => ts.isFunctionDeclaration(p)||ts.isArrowFunction(p)||ts.isFunctionExpression(p)||ts.isMethodDeclaration(p);
function nombreFn(p){ if (ts.isFunctionDeclaration(p)&&p.name) return p.name.text; if (p.parent&&ts.isVariableDeclaration(p.parent)&&ts.isIdentifier(p.parent.name)) return p.parent.name.text; if (ts.isMethodDeclaration(p)) return p.name.getText(); return null; }
function tiene(n, pred){ let t=false; (function v(x){ if (t) return; if (x!==n && esFn(x)) return; if (pred(x)) { t=true; return; } ts.forEachChild(x,v); })(n); return t; }
const out=[]; let nF=0, nEscr=0;
for (const f of fich) {
  const sf = ts.createSourceFile(f, fs.readFileSync(f,'utf8'), ts.ScriptTarget.Latest, true, f.endsWith('.ts')?ts.ScriptKind.TS:ts.ScriptKind.JS); nF++;
  (function v(n){
    if (ts.isCallExpression(n) && ts.isPropertyAccessExpression(n.expression) && ts.isPropertyAccessExpression(n.expression.expression)) {
      const met = n.expression.name.text, modelo = n.expression.expression.name.text;
      const esE = ESCR.has(met), esL = LECT.has(met);
      if ((modo==='escrituras'&&esE) || (modo==='lecturas'&&esL)) {
        if (!soloModelo || soloModelo===modelo) {
          nEscr++;
          // subir hasta la funcion: try con catch sin throw? cadena .catch sin throw?
          let clase='PROPAGA', fn='(modulo/handler)', senal='';
          let c=n;
          for (let p=n.parent; p; c=p, p=p.parent) {
            if (ts.isCallExpression(p) && ts.isPropertyAccessExpression(p.expression) && p.expression.name.text==='catch' && p.expression===c) {
              const h=p.arguments[0]; if (!h || !tiene(h, ts.isThrowStatement)) { clase='TRAGA(.catch)'; }
            }
            if (ts.isTryStatement(p) && p.tryBlock===c && p.catchClause && clase==='PROPAGA') {
              if (!tiene(p.catchClause.block, ts.isThrowStatement)) {
                clase='TRAGA(try)';
                const ret = tiene(p.catchClause.block, (x)=>ts.isReturnStatement(x)&&!!x.expression);
                const usaRes = /res\.(status|json|send)|next\(/.test(p.catchClause.block.getText(sf));
                senal = usaRes ? 'responde-http' : (ret ? 'devuelve-valor' : 'sin-senal');
              }
            }
            if (esFn(p)) { const nm=nombreFn(p); if (nm) { fn=nm; break; } }
          }
          const l = sf.getLineAndCharacterOfPosition(n.getStart(sf)).line+1;
          out.push([modelo, met, clase, senal, path.relative(raiz,f).split(path.sep).join('/')+':'+l, fn]);
        }
      }
    }
    ts.forEachChild(n,v);
  })(sf);
}
if (process.argv.includes('--resumen')) {
  const m={}; for (const r of out){ const k=r[0]; m[k]=m[k]||{PROPAGA:0,'TRAGA(try)':0,'TRAGA(.catch)':0,sin:0}; m[k][r[2]]++; if (r[3]==='sin-senal'||r[2]==='TRAGA(.catch)') m[k].sin++; }
  for (const [k,v] of Object.entries(m).sort((a,b)=>b[1].sin-a[1].sin)) console.log(k.padEnd(28), 'propaga', String(v.PROPAGA).padStart(3), ' traga-try', String(v['TRAGA(try)']).padStart(3), ' traga-catch', String(v['TRAGA(.catch)']).padStart(3), ' SIN-SENAL', String(v.sin).padStart(3));
} else for (const r of out) console.log(r.join(' | '));
console.error(`# poblacion: ${nF} ficheros, ${nEscr} llamadas (${modo}${soloModelo?' modelo='+soloModelo:''})`);
