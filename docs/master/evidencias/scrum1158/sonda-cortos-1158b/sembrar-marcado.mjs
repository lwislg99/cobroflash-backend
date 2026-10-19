// node sembrar-marcado.mjs <customersView.js de una COPIA extraída con `git archive`, nunca de un worktree>
// Siembra en la cabecera de Clientes (superficie del guard) un botón de 30 px dentro de un padre
// flex cuyo `align-items:center` va EN LÍNEA, junto a un hermano alto. Si el serializador pierde
// ese `align-items`, el botón se estira y pasa; si lo conserva, cae. Clase propia: ninguna
// excepción del guard la empareja.
import fs from 'node:fs';
const f = process.argv[2];
let t = fs.readFileSync(f, 'utf8');
const ancla = '  importBtn.title = "Importar clientes desde un fichero CSV o Excel";\n';
if (t.split(ancla).length !== 2) { console.error('🔴 ancla no única'); process.exit(2); }
t = t.replace(ancla, ancla + `  { const s = document.createElement('div'); s.innerHTML = '<div style="display:flex;align-items:center;gap:8px"><div><div>l0</div><div>l1</div><div>l2</div><div>l3</div><div>l4</div><div>l5</div></div><button class="btn-sm siembra-1158" type="button">SIEMBRA</button></div>'; headActions.appendChild(s); }
`);
fs.writeFileSync(f, t);
console.log('sembrado: ' + f);
