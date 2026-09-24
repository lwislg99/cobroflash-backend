// docs/master/evidencias/scrum920/mutar-920j.mjs — SCRUM-920j
//
// Banco de mutación del guard de «el «?» de ayuda no tapa «Nuevo gasto»» (bloque J de `guard-lista-gastos.mjs`).
// Primero la BASE sin mutar (tiene que dar 0); después cada mutante sobre una COPIA de `public/` (nunca sobre el
// árbol de trabajo), con `GASTOS_PUBLICO` apuntando a la copia. Un mutante que NO da rojo es un hueco del guard.
//
//   node docs/master/evidencias/scrum920/mutar-920j.mjs
//
// Salida: una línea por corrida con el código de salida y los rojos que vio. Se comprueba además que cada mutación
// CAMBIÓ el fichero (una sustitución que no casa no es un mutante: es la base con otro nombre).
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');
const CSS = path.join('dashboard', 'css', 'styles.css');
const REGLA = '.gastos-barra { padding-right: 78px; }';
const BARRA = 'position: fixed; left: 0; right: 0; bottom: 0; z-index: 25; padding: 10px 16px calc(10px + env(safe-area-inset-bottom));';

const MUTANTES = [
  { id: 'M0', nombre: 'BASE sin mutar', muta: (s) => s },
  { id: 'M1', nombre: 'quitar la regla (el código de antes: sin hueco para el «?»)', muta: (s) => s.replace(REGLA, '') },
  { id: 'M2', nombre: 'hueco corto: 60 px en vez de 78 (el botón acaba en x=330 y el «?» empieza en x=322)', muta: (s) => s.replace(REGLA, '.gastos-barra { padding-right: 60px; }') },
  { id: 'M3', nombre: 'el hueco en el lado equivocado: padding-left en vez de padding-right', muta: (s) => s.replace(REGLA, '.gastos-barra { padding-left: 78px; }') },
  { id: 'M4', nombre: 'la regla ANTES del `padding:` abreviado, que la pisa (el orden importa)', muta: (s) => s.replace(REGLA, '').replace(BARRA, `padding-right: 78px; ${BARRA}`) },
];

let inesperados = 0;
for (const m of MUTANTES) {
  const copia = fs.mkdtempSync(path.join(os.tmpdir(), `mut-920j-${m.id}-`));
  try {
    fs.cpSync(path.join(RAIZ, 'public'), path.join(copia, 'public'), { recursive: true });
    const f = path.join(copia, 'public', CSS);
    const antes = fs.readFileSync(f, 'utf8');
    const despues = m.muta(antes);
    if (m.id !== 'M0' && despues === antes) { console.log(`${m.id} · ${m.nombre}: 🔴 LA SUSTITUCIÓN NO CASÓ (no es un mutante)`); inesperados += 1; continue; }
    if (despues !== antes) fs.writeFileSync(f, despues);
    const r = spawnSync(process.execPath, [path.join(RAIZ, 'scripts', 'guard-lista-gastos.mjs')], {
      cwd: RAIZ, encoding: 'utf8', env: { ...process.env, FORCE_COLOR: '0', GASTOS_PUBLICO: path.join(copia, 'public') }, timeout: 280000,
    });
    const rojos = (r.stderr || '').split('\n').filter((l) => l.includes('🔴') && !l.includes('hallazgos')).map((l) => l.trim());
    const esperado = m.id === 'M0' ? r.status === 0 : r.status === 1;
    if (!esperado) inesperados += 1;
    console.log(`${m.id} · ${m.nombre}: salida ${r.status} ${esperado ? '(como se esperaba)' : '🔴 NO ES LO ESPERADO'}`);
    for (const l of rojos) console.log(`      ${l}`);
  } finally {
    fs.rmSync(copia, { recursive: true, force: true });
  }
}
console.log(inesperados === 0 ? '\nBase verde y los cuatro mutantes en rojo: el guard los caza.' : `\n🔴 ${inesperados} resultado(s) inesperado(s).`);
process.exit(inesperados === 0 ? 0 : 1);
