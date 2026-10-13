// docs/master/evidencias/scrum1500b/mutar.mjs — SCRUM-1500b
//
// EL BANCO QUE ENSEÑA EL TEST EN ROJO. Cada mutación cambia UN literal del instrumento
// (`docs/master/evidencias/scrum1500/cotejo.cjs`), corre el fichero de test y apunta qué casos caen.
//
//     node docs/master/evidencias/scrum1500b/mutar.mjs
//
// Antes de mutar corre la BASE (tiene que salir entera en verde: si no, un test inestable se leería
// como un mutante que muere). Cada literal tiene que aparecer UNA sola vez; si no, la fila es CIEGA.
// Al acabar restaura el fichero y comprueba su sha256; sale 1 si alguna mutación quedó MUDA o CIEGA.
// El hijo se lanza sin NODE_TEST_CONTEXT, NODE_OPTIONS ni FORCE_COLOR (SCRUM-1308).
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');
const SUJETO = path.join(RAIZ, 'docs', 'master', 'evidencias', 'scrum1500', 'cotejo.cjs');
const TEST = path.join('tests', 'scrum1500-el-cotejo-contra-el-master.test.mjs');

const MUTACIONES = [
  ['vuelve la pregunta vieja: el código se compara con el COMENTARIO, no con el máster',
    'const sobran = menos(D, M);\n  const faltan = menos(M, D);',
    'const sobran = menos(D, C || M);\n  const faltan = menos(C || M, D);'],
  ['se apaga «el código tiene un valor que el máster no»',
    'if (sobran.length > 0) return {',
    'if (false) return {'],
  ['lo que se para y no tiene excepción deja de nombrarse',
    'if (!e) { di(f.campo, f.veredicto, f.noExistePorque || f.porque); continue; }',
    'if (!e) { continue; }'],
  ['CODIGO_FUERA_DEL_MASTER deja de ser un veredicto que para',
    "const SE_PARA = new Set(['NO_EXISTE', 'CIEGO', 'CODIGO_FUERA_DEL_MASTER',",
    "const SE_PARA = new Set(['NO_EXISTE', 'CIEGO',"],
  ['la excepción ampara cualquier veredicto que pare',
    'if (f.veredicto !== e.veredicto) rota(',
    'if (false) rota('],
  ['la excepción ampara cualquier valor nuevo del código',
    'if (!mismos(f.D, e.D)) rota(',
    'if (false) rota('],
  ['la excepción ampara cualquier lista del máster',
    'if (!mismos(f.M, e.M)) rota(',
    'if (false) rota('],
  ['la excepción no comprueba que siga montada en src/',
    'if (f.cierre.length === 0 && f.sitios.length === 0) rota(',
    'if (false) rota('],
  ['la excepción no mira las líneas nuevas del máster que juntan sus valores',
    'if (sinLeer.length > 0) rota(',
    'if (false) rota('],
  ['una excepción que sobra no se dice',
    "if (e) { usadas.add(e); di(f.campo, 'EXCEPCION_SOBRANTE',",
    "if (e) { usadas.add(e); (() => {})(f.campo, 'EXCEPCION_SOBRANTE',"],
  ['una excepción huérfana no se dice',
    'for (const e of parados) if (!usadas.has(e)) di(',
    'for (const e of parados) if (false) di('],
  ['una excepción sin papeles no se dice',
    "if (!e[k] || !String(e[k]).trim()) di(e.campo, 'EXCEPCION_SIN_PAPELES',",
    "if (false) di(e.campo, 'EXCEPCION_SIN_PAPELES',"],
  ['«el máster no lo fija» se cree a ciegas',
    "if (f.rastro && f.rastro.juntas.length > 0) di(f.campo, 'POSIBLE_LISTA_EN_EL_MASTER',",
    "if (false) di(f.campo, 'POSIBLE_LISTA_EN_EL_MASTER',"],
  ['un comentario que deja de enumerar no se dice',
    "if (f.veredicto !== 'NO_EXISTE' && (f.C || []).length > 0 === f.sinLista) {",
    'if (false) {'],
  ['un control que sale mal no se dice',
    'if (f.veredicto !== f.control) di(',
    'if (false) di('],
  ['el comentario vuelve a localizarse por posición: siempre el bloque que empieza en la línea 1426',
    "if (c.comentario === 'cabecera') rango = bloqueSobre(abre[0]);",
    "if (c.comentario === 'cabecera') rango = [1420, 1425];"],
  ['un campo que no está en su modelo se da por existente',
    'if (suyas.length !== 1) return { existe: false,',
    'if (suyas.length > 1) return { existe: false,'],
];

const sha = (t) => crypto.createHash('sha256').update(t).digest('hex');
const entorno = { ...process.env };
for (const k of ['NODE_TEST_CONTEXT', 'NODE_OPTIONS', 'FORCE_COLOR']) delete entorno[k];

function corre() {
  const r = spawnSync(process.execPath, ['--test', '--test-reporter=tap', TEST], { cwd: RAIZ, env: entorno, encoding: 'utf8' });
  const lineas = `${r.stdout || ''}`.split(/\r?\n/);
  const pasan = lineas.filter((l) => /^ok \d+ - /.test(l)).map((l) => l.replace(/^ok \d+ - /, ''));
  const caen = lineas.filter((l) => /^not ok \d+ - /.test(l)).map((l) => l.replace(/^not ok \d+ - /, ''));
  return { pasan, caen, salida: r.status };
}

const original = fs.readFileSync(SUJETO, 'utf8');
const huella = sha(original);
const base = corre();
console.log(`POBLACION: ${MUTACIONES.length} mutaciones sobre ${path.relative(RAIZ, SUJETO).replace(/\\/g, '/')} · sha256 ${huella.slice(0, 16)}`);
console.log(`BASE sin mutar: ${base.pasan.length} pasan, ${base.caen.length} caen, salida ${base.salida}`);
if (base.caen.length > 0 || base.pasan.length === 0 || base.salida !== 0) { console.log('LA BASE NO ESTÁ EN VERDE: no se muta\nEXIT=2'); process.exit(2); }

let mudas = 0;
let ciegas = 0;
try {
  for (const [nombre, de, a] of MUTACIONES) {
    const veces = original.split(de).length - 1;
    if (veces !== 1) { ciegas += 1; console.log(`\nCIEGA · ${nombre}\n    el literal aparece ${veces} veces (tiene que ser 1)`); continue; }
    fs.writeFileSync(SUJETO, original.replace(de, a));
    const aplicada = sha(fs.readFileSync(SUJETO, 'utf8')) !== huella;
    const r = corre();
    fs.writeFileSync(SUJETO, original);
    if (!aplicada || r.pasan.length + r.caen.length === 0) { ciegas += 1; console.log(`\nCIEGA · ${nombre}\n    aplicada: ${aplicada} · casos corridos: ${r.pasan.length + r.caen.length}`); continue; }
    if (r.caen.length === 0) mudas += 1;
    console.log(`\n${r.caen.length > 0 ? 'VIVA ' : 'MUDA '}· ${nombre}\n    caen ${r.caen.length} de ${r.pasan.length + r.caen.length}${r.caen.map((c) => `\n      ✖ ${c}`).join('')}`);
  }
} finally {
  fs.writeFileSync(SUJETO, original);
}
const restaurado = sha(fs.readFileSync(SUJETO, 'utf8')) === huella;
console.log(`\nRESUMEN: ${MUTACIONES.length - mudas - ciegas} vivas · ${mudas} mudas · ${ciegas} ciegas · instrumento restaurado: ${restaurado ? 'sí, mismo sha256' : 'NO'}`);
const salida = restaurado && mudas === 0 && ciegas === 0 ? 0 : 1;
console.log(`EXIT=${salida}`);
process.exit(salida);
