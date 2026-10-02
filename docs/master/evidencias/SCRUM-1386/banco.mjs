#!/usr/bin/env node
// docs/master/evidencias/SCRUM-1386/banco.mjs — SCRUM-1386
//
// ¿QUÉ DICE `guards:entrada` CUANDO A SU RUNNER LO MATAN A MITAD?
//
// La puerta corre TAL CUAL está en el árbol que se le pasa (ni copia ni parche). Lo que se fabrica es
// la muerte: otro proceso (`matar.ps1`) busca al `node --test` hijo de la puerta y lo mata desde fuera.
// Por eso este banco es de Windows: es la plataforma donde un kill llega como un estado corriente.
//
//   node docs/master/evidencias/SCRUM-1386/banco.mjs <raíz del árbol a medir> [caso …]
//
// No escribe ningún fichero: todo va por stdout. Cada caso con muerte lleva TESTIGO (A21): sin la
// línea del que mata, o si el objetivo no estaba vivo antes y muerto después, el caso NO VALE y el
// banco sale 1.
//
// ⚠️ El caso `KR-rojo-y-matado` ENSUCIA el árbol que mide: escribe un registro sin ancla
// (`docs/master/SCRUM-99986.md`, que `scrum267` y `scrum273` cazan) y lo borra al acabar, en un
// `finally`. Comprueba después que no queda. Si matan a ESTE banco a mitad, queda: bórralo a mano.
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.resolve(process.argv[2] || '');
const PUERTA = path.join(RAIZ, 'scripts', 'guards-entrada.mjs');
if (!process.argv[2] || !fs.existsSync(PUERTA)) { console.error('BANCO=CIEGO · no hay puerta en ' + PUERTA); process.exit(2); }
if (process.platform !== 'win32') { console.error('BANCO=CIEGO · este banco mata con taskkill: sólo mide en Windows.'); process.exit(2); }

// El entorno del sujeto, a mano (A21): ni el color del chat, ni NODE_OPTIONS, ni CI.
const ENV = {};
for (const k of ['PATH', 'Path', 'SystemRoot', 'SYSTEMROOT', 'TEMP', 'TMP', 'HOME', 'USERPROFILE', 'LOCALAPPDATA', 'APPDATA', 'ComSpec', 'PATHEXT']) {
  if (process.env[k] !== undefined) ENV[k] = process.env[k];
}

const CEBO = path.join(RAIZ, 'docs', 'master', 'SCRUM-99986.md');
const CASOS = {
  'K0-control': { modo: null, titulo: 'CONTROL · nadie mata a nadie' },
  'KA-arbol-pronto': { modo: 'runner-arbol', espera: 0, titulo: 'runner y sus hijos matados nada más aparecer (taskkill /F /T)' },
  'KA-arbol-mitad': { modo: 'runner-arbol', espera: 4000, titulo: 'runner y sus hijos matados a los 4 s (taskkill /F /T)' },
  'KA-arbol-tarde': { modo: 'runner-arbol', espera: 7000, titulo: 'runner y sus hijos matados a los 7 s (taskkill /F /T), con resultados ya escritos' },
  'KA-solo-mitad': { modo: 'runner-solo', espera: 4000, titulo: 'SÓLO el runner matado a los 4 s (taskkill /F); sus hijos quedan huérfanos' },
  'KA-stop-mitad': { modo: 'runner-stop', espera: 4000, titulo: 'runner matado a los 4 s con Stop-Process -Force (otro código de salida)' },
  'KB-nieto': { modo: 'nieto', espera: 1500, casa: 'scrum237', titulo: 'UN proceso por fichero (scrum237) matado a los 1,5 s; el runner sigue vivo' },
  'R0-rojo-control': { modo: null, cebo: true, titulo: 'POSITIVO · un rojo de verdad (un registro sin ancla) y nadie mata a nadie' },
  'KR-rojo-y-matado': { modo: 'runner-arbol', espera: 7000, cebo: true, titulo: 'un rojo de verdad, y el runner matado a los 7 s, DESPUÉS de escribir sus ✖' },
};

function correr(cmd, args, opts, alArrancar) {
  return new Promise((resolve) => {
    const h = spawn(cmd, args, opts);
    let out = ''; let err = '';
    h.stdout.on('data', (d) => { out += d; });
    h.stderr.on('data', (d) => { err += d; });
    h.on('error', (e) => resolve({ status: null, signal: null, out, err, error: e.code || String(e) }));
    h.on('close', (status, signal) => resolve({ status, signal, out, err }));
    if (alArrancar) alArrancar(h);
  });
}

const ANSI = new RegExp(String.fromCharCode(27) + '\\[[0-9;]*[A-Za-z]', 'g');
const pedidos = process.argv.slice(3);
const lista = pedidos.length ? pedidos : Object.keys(CASOS);
// De la raíz se dice el nombre de la carpeta, no la ruta: la ruta es de la máquina donde se midió.
console.log('BANCO SCRUM-1386 (runner matado) · plataforma ' + process.platform + ' · node ' + process.version + ' · árbol medido: ' + path.basename(RAIZ));
console.log('POBLACIÓN: ' + lista.length + ' caso(s) — ' + lista.join(', '));

let validos = 0;
for (const nombre of lista) {
  const c = CASOS[nombre];
  if (!c) { console.log('\nCASO ' + nombre + ' · DESCONOCIDO'); continue; }
  const t0 = Date.now();
  let matador = Promise.resolve(null);
  let r; let m;
  try {
    if (c.cebo) fs.writeFileSync(CEBO, '# SCRUM-99986 · cebo del banco de SCRUM-1386\n\nUn registro sin su ancla de medición: lo que caza scrum267.\n');
    r = await correr(process.execPath, [PUERTA], { cwd: RAIZ, env: ENV }, (h) => {
      if (!c.modo) return;
      matador = correr('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', path.join(AQUI, 'matar.ps1'),
        '-Puerta', String(h.pid), '-Modo', c.modo, '-EsperaMs', String(c.espera || 0), '-Casa', c.casa || ''], { env: process.env });
    });
    m = await matador;
  } finally {
    if (c.cebo) fs.rmSync(CEBO, { force: true });
  }
  const ms = Date.now() - t0;
  const testigo = m ? (m.out.split(/\r?\n/).find((l) => l.startsWith('TESTIGO')) || 'TESTIGO=AUSENTE (rc ' + m.status + ') ' + m.err.trim().slice(0, 300)) : '(sin matador)';
  const limpio = r.out.replace(ANSI, '');
  // Los ✖ de ANTES del resumen: después, el runner los repite en «failing tests» y se contarían dos veces.
  const finDeResultados = limpio.search(/^[^\n]*\btests\s+\d+\s*$/m);
  const caidos = (finDeResultados === -1 ? limpio : limpio.slice(0, finDeResultados)).split(/\r?\n/).filter((l) => /^\s*(?:✖|not ok\b)/.test(l));
  let vale = !m || /objetivo_vivo_antes=1 objetivo_sigue_vivo=0/.test(testigo);
  // «Vivo antes, muerto después» NO basta para el runner: si la máquina va rápida, el runner termina
  // por su pie justo antes del kill y el testigo sale igual. Pasó en una pasada de este banco (salida
  // 0, 132 en verde, y el caso «valía»). Un runner que dejó su resumen NO fue matado a mitad.
  if (c.modo && c.modo.startsWith('runner-') && finDeResultados !== -1) vale = false;
  // El caso del rojo-y-matado sólo dice algo si el ✖ YA estaba escrito cuando se mató al runner.
  if (nombre === 'KR-rojo-y-matado' && caidos.length === 0) vale = false;
  if (c.cebo && fs.existsSync(CEBO)) vale = false;
  if (vale) validos += 1;
  console.log('\n' + '█'.repeat(100));
  console.log('CASO ' + nombre + ' · ' + c.titulo);
  console.log('█'.repeat(100));
  console.log(testigo);
  if (c.cebo) console.log('cebo retirado del árbol: ' + (fs.existsSync(CEBO) ? 'NO — BÓRRALO A MANO: ' + CEBO : 'sí'));
  console.log('VALE=' + (vale ? 'sí' : 'NO — sin testigo, este caso no dice nada'));
  console.log('EXIT de la puerta=' + r.status + (r.signal ? ' · señal ' + r.signal : '') + ' · ' + (ms / 1000).toFixed(1) + ' s');
  console.log('lo que el runner dejó escrito: ✔=' + (limpio.match(/^\s*(?:✔|ok \d)/gm) || []).length
    + ' · ✖=' + caidos.length
    + ' · resumen «tests N»=' + ((/^[^\n]*\btests\s+(\d+)\s*$/m.exec(limpio) || [])[1] ?? 'NO HAY')
    + ' · «fail N»=' + ((/^[^\n]*\bfail\s+(\d+)\s*$/m.exec(limpio) || [])[1] ?? 'NO HAY'));
  console.log('── lo que la puerta dice (su stderr, sin lo que reenvía del runner) ──');
  const propio = r.err.replace(ANSI, '').split(RAIZ).join('<raíz>').split(/\r?\n/);
  const desde = propio.findIndex((l) => /^(?:🔴|⬜)/.test(l.trim()));
  for (const l of (desde >= 0 ? propio.slice(desde) : []).filter((x) => x.trim()).slice(0, 14)) console.log('   ' + l.slice(0, 230));
  console.log('   [stdout, última] ' + limpio.split(/\r?\n/).filter((l) => l.trim()).slice(-1)[0]);
}
console.log('\n' + '═'.repeat(100));
console.log('CASOS CORRIDOS=' + lista.length + ' · VÁLIDOS=' + validos + ' · BANCO=' + (validos === lista.length ? 0 : 1));
process.exitCode = validos === lista.length ? 0 : 1;
