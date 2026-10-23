// Censo: ficheros de scripts/ y tests/ que montan una página con la hoja del panel o tokens.css
// (link a /dashboard/css/styles.css o /tokens.css) y si el MISMO fichero enlaza /fonts/inter.css.
// Población declarada; positivo sembrado: un fichero fabricado con link a styles.css y sin inter.css.
import fs from 'node:fs';
import path from 'node:path';
const raiz = process.argv[2];
const sembrar = !process.argv.includes('--sin-semilla');
const dirs = ['scripts', 'tests'];
const ficheros = [];
for (const d of dirs) {
  const walk = (p) => {
    for (const e of fs.readdirSync(p, { withFileTypes: true })) {
      const q = path.join(p, e.name);
      if (e.isDirectory()) { if (e.name !== 'node_modules') walk(q); }
      else if (/\.(mjs|js|cjs|ts)$/.test(e.name)) ficheros.push(q);
    }
  };
  walk(path.join(raiz, d));
}
const filas = ficheros.map((f) => ({ f: path.relative(raiz, f).replace(/\\/g, '/'), t: fs.readFileSync(f, 'utf8') }));
if (sembrar) filas.push({ f: '__SEMILLA__', t: '<link rel="stylesheet" href="/dashboard/css/styles.css">' });
const reHoja = /href=["']\/(dashboard\/css\/styles\.css|tokens\.css)["']/;
const reInter = /\/fonts\/inter\.css/;
const conHoja = filas.filter((x) => reHoja.test(x.t));
const sin = conHoja.filter((x) => !reInter.test(x.t));
const con = conHoja.filter((x) => reInter.test(x.t));
console.log(`población: ${filas.length} ficheros (scripts/ + tests/${sembrar ? ' + 1 semilla' : ''})`);
console.log(`montan página con styles.css/tokens.css: ${conHoja.length}`);
console.log(`  · enlazan también /fonts/inter.css: ${con.length}`);
for (const x of con) console.log('      ' + x.f);
console.log(`  · NO la enlazan: ${sin.length}`);
for (const x of sin) console.log('      ' + x.f);
const semillaVista = sin.some((x) => x.f === '__SEMILLA__');
if (sembrar && !semillaVista) { console.log('CIEGO: la semilla no sale'); process.exit(2); }
// Sin la semilla no hay control positivo propio: el recuento no se da por bueno (cicatriz ② del equipo).
if (!sembrar) { console.log('CIEGO: sin semilla no hay control positivo; las cifras de arriba no valen'); process.exit(2); }
console.log('semilla: VISTA');
