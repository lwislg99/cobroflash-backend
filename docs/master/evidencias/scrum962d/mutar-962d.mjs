// Mutaciones de SCRUM-962d. Cada una toca UN fichero, corre el test, y lo RESTAURA desde HEAD pase lo que pase.
// Se niega a correr con cambios sin comitar en los ficheros que muta (lo restaurado borraría trabajo).
// Uso (desde la raíz del worktree): node mutar-962d.mjs
import fs from 'node:fs';
import { execFileSync, spawnSync } from 'node:child_process';
const CSS = 'public/dashboard/css/styles.css', MH = 'public/dashboard/js/modalHeader.js';
const TEST = 'tests/scrum962d-cabecera-modal-44.test.mjs';
for (const f of [CSS, MH, TEST]) {
  if (execFileSync('git', ['status', '--porcelain', '--', f], { encoding: 'utf8' }).trim()) { console.error(`🔴 ${f} tiene cambios sin comitar: no muto.`); process.exit(2); }
}
const restaurar = (f) => fs.writeFileSync(f, execFileSync('git', ['show', `HEAD:${f}`]));
const MUT = [
  ['BASE: el CSS de ANTES del arreglo (HEAD~1)', CSS, () => execFileSync('git', ['show', `HEAD~1:${CSS}`], { encoding: 'utf8' })],
  ['sin position:relative', CSS, (s) => s.replace('.modal-header > .modal-close { position: relative; }', '.modal-header > .modal-close { }')],
  ['::before a 40 px', CSS, (s) => s.replace(/(\.modal-close::before \{[\s\S]*?)width: 44px;/, '$1width: 40px;')],
  ['el «×» crece hacia el «?» (right:0)', CSS, (s) => s.replace('.modal-header > .modal-close::before { left: 0; }', '.modal-header > .modal-close::before { right: 0; }')],
  ['sin acotar: .modal-close::before global', CSS, (s) => s.replace('.modal-header > .modal-close::before {\n  content', '.modal-close::before {\n  content').replace('.modal-header > .modal-ayuda::before,\n.modal-close::before', '.modal-header > .modal-ayuda::before,\n.modal-close::before')],
  ['la pieza envuelve los botones en un div', MH, (s) => s.replace("header.appendChild(ayuda);", "const env = document.createElement('div'); env.appendChild(ayuda); header.appendChild(env);")],
];
let vivos = 0;
for (const [nombre, f, mutar] of MUT) {
  const antes = fs.readFileSync(f, 'utf8');
  const despues = mutar(antes);
  if (despues === antes) { console.log(`⚠️  ${nombre}: la mutación NO CAMBIÓ NADA (el patrón no casa) — no cuenta`); vivos++; continue; }
  try {
    fs.writeFileSync(f, despues);
    const r = spawnSync(process.execPath, ['--test', '--test-reporter=dot', TEST], { encoding: 'utf8', env: { ...process.env, FORCE_COLOR: '' } });
    const muere = r.status !== 0;
    if (!muere) vivos++;
    console.log(`${muere ? '✅ muere' : '🔴 SOBREVIVE'}  ${nombre}`);
  } finally { restaurar(f); }
}
const limpio = !execFileSync('git', ['status', '--porcelain', '--', CSS, MH], { encoding: 'utf8' }).trim();
console.log(`\nmutaciones: ${MUT.length} · vivas: ${vivos} · ficheros restaurados: ${limpio ? 'sí' : '🔴 NO'}`);
process.exit(vivos || !limpio ? 1 : 0);
