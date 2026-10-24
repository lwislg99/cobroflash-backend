// Copia los guiones de 962c/962d desde un árbol en origin/main cambiando SÓLO el import del banco.
// Uso: node copiar.mjs <raiz-del-arbol>
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const raiz = process.argv[2];
const sha = (await import('node:child_process')).execSync('git rev-parse HEAD', { cwd: raiz }).toString().trim();
for (const [src, dst] of [['docs/master/evidencias/scrum962c/editor-recorrido.mjs', 'editor-recorrido-prod.mjs'], ['docs/master/evidencias/scrum962d/cabecera-viva.mjs', 'cabecera-viva-prod.mjs']]) {
  let t = fs.readFileSync(path.join(raiz, src), 'utf8');
  const a = "await imp('scripts/_banco-lista.mjs')";
  if (t.split(a).length !== 2) throw new Error('no casa una sola vez en ' + src);
  t = t.replace(a, "await import('./banco-prod.mjs')");
  t = `// COPIA de ${src} (${sha.slice(0, 9)}) con UN cambio: el banco es ./banco-prod.mjs (yaqu.app real).\n` + t;
  fs.writeFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), dst), t);
  console.log('ok', dst);
}
