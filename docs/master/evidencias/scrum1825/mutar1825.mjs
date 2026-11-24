// Mutaciones de SCRUM-1825: quita cada mitad de la cura por separado y corre el test nuevo.
// uso (desde la raíz del worktree): node mutar1825.mjs
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';

const BANCO = 'tests/_banco-vistas.mjs';
const PAGINA = 'scripts/_pagina-panel.mjs';
const TEST = 'tests/scrum1825-banco-dataset-es-el-atributo.test.mjs';
const orig = { [BANCO]: fs.readFileSync(BANCO, 'utf8'), [PAGINA]: fs.readFileSync(PAGINA, 'utf8') };

const MUTANTES = [
  ['M1 borrar por dataset NO toca _attrs', BANCO,
    'if (!/-[a-z]/.test(k)) delete n._attrs[aAtributo(k)];', '/* mutante */'],
  ['M2 poner por dataset NO toca _attrs', BANCO,
    "const poner = (k, v) => { n._attrs[aAtributo(k)] = String(v); reflejar(); return true; };",
    "const poner = (k, v) => { reflejar(); return true; };"],
  ['M3 serializar emite el dataset otra vez', PAGINA,
    'if (!Object.prototype.hasOwnProperty.call(attrs, nombre)) at.push', 'at.push'],
  ['M4 el espejo no se refresca (sólo inspección)', BANCO,
    'for (const k of claves()) espejo[k] = n._attrs[aAtributo(k)];', '/* mutante */'],
];

try {
  for (const [nombre, fich, de, a] of MUTANTES) {
    if (!orig[fich].includes(de)) throw new Error(`${nombre}: no encuentro el texto a mutar`);
    fs.writeFileSync(fich, orig[fich].replace(de, a));
    const r = spawnSync(process.execPath, ['--test', '--test-reporter=tap', TEST], { encoding: 'utf8' });
    const fallan = [...r.stdout.matchAll(/^not ok \d+ - (.*)$/gm)].map((m) => m[1]);
    console.log(`${nombre}: exit=${r.status} · caen ${fallan.length}${fallan.length ? ' → ' + fallan.join(' | ') : ''}`);
    fs.writeFileSync(fich, orig[fich]);
  }
} finally {
  for (const [f, t] of Object.entries(orig)) fs.writeFileSync(f, t);
}
