// Lee los workflows del árbol y saca: disparadores (bloque `on:`), cron, concurrencia y qué
// instrumento de vigilancia invoca cada uno. Sólo lee. Uso: node disparos.mjs <raiz del arbol>
import fs from 'node:fs';
import path from 'node:path';

const raiz = process.argv[2];
const dir = path.join(raiz, '.github', 'workflows');
const INSTR = /vigia-silencio-de-main|vigia-pasada|vigilante-de-despliegue|vigia-despliegue-aviso|ci-de-la-rama|latido|puerta-avisador-rojo|vigia-atascados\.mjs|vigia-sesiones|ritmo-de-despliegue|ZZZ-NO-EXISTE/;
const ficheros = fs.readdirSync(dir).filter((f) => f.endsWith('.yml')).sort();
console.log(`POBLACION workflows=${ficheros.length} en ${dir}`);
let invocaciones = 0;
let cebo = 0;
for (const f of ficheros) {
  const t = fs.readFileSync(path.join(dir, f), 'utf8').split(/\r?\n/);
  const out = [];
  let on = false;
  t.forEach((l, i) => {
    const sinComentario = l.replace(/\s+#.*$/, '');
    if (/^\s*#/.test(l)) return;
    if (/^on:/.test(l)) { on = true; out.push(`${i + 1}: ${l}`); return; }
    if (on) {
      if (/^[a-zA-Z]/.test(l)) on = false;
      else if (l.trim()) { out.push(`${i + 1}: ${sinComentario}`); return; }
    }
    if (/^\s*(cancel-in-progress|group):/.test(l) || /^concurrency:/.test(l)) out.push(`${i + 1}: ${sinComentario.slice(0, 160)}`);
    if (INSTR.test(sinComentario)) {
      out.push(`${i + 1}: >> ${sinComentario.trim().slice(0, 190)}`);
      invocaciones++;
      if (/ZZZ-NO-EXISTE/.test(sinComentario)) cebo++;
    }
  });
  console.log(`=== ${f} (${t.length} lineas)`);
  console.log(out.join('\n'));
}
console.log(`TOTAL lineas que nombran un instrumento=${invocaciones} · control a cero (ZZZ-NO-EXISTE)=${cebo}`);
