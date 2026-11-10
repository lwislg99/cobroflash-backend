// Baja el styles.css que SIRVE yaqu.app, lo compara con el de un árbol y escribe variantes SIN un bloque.
// Uso: node css-de-prod.mjs <raiz> <salida-dir>
import fs from 'node:fs';
import path from 'node:path';
const [raiz, dir] = process.argv.slice(2);
const servido = await fetch('https://yaqu.app/dashboard/css/styles.css', { cache: 'no-store' }).then((r) => r.text());
const arbol = fs.readFileSync(path.join(raiz, 'public/dashboard/css/styles.css'), 'utf8');
const n = (s) => s.replace(/\r\n/g, '\n');
console.log('servido', servido.length, 'B · árbol', arbol.length, 'B · idénticos (sin CR):', n(servido) === n(arbol));
fs.writeFileSync(path.join(dir, 'styles-prod.css'), servido);
const quitar = (css, ini, fin, nombre) => {
  const i = css.indexOf(ini); const j = css.indexOf(fin, i); if (i < 0 || j < 0) throw new Error('no casa ' + nombre);
  const k = j + fin.length; const s = css.slice(0, i) + css.slice(k);
  fs.writeFileSync(path.join(dir, `styles-prod-sin-${nombre}.css`), s); console.log(nombre, 'quitados', css.length - s.length, 'B');
};
quitar(servido, '/* S2: ── SCRUM-962d', 'fin SCRUM-962d ─────────────────────────────────────────────────────────────────────── */', '962d');
