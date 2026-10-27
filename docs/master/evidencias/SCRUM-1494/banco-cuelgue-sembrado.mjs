// SCRUM-1494b · banco del caso SEMBRADO (solo medida; no toca el repo).
//
//   node docs/master/evidencias/SCRUM-1494/banco-cuelgue-sembrado.mjs [ruta del hijo]
//
// Siembra en un temporal FUERA del árbol tres ficheros de test que no terminan de tres maneras, y lanza
// contra ellos el hijo de zona (`scripts/_trinquete-de-zona-hijo.mjs`) en tres variantes:
//   antes   · el hijo tal cual está
//   timeout · + `timeout` en `run()` (la propuesta del ticket)
//   senal   · + `timeout` y un `signal` de pared en `run()`
// Cada variante se construye en el temporal sustituyendo UNA línea, y el banco ABORTA si la sustitución
// no cambió nada (una variante que no se aplicó daría el mismo resultado que «antes»).
// Un tope de pared mata al hijo si no acaba: «TOPE» es el cuelgue que se come el techo del job.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const LIMITE_MS = 5000;
const TOPE_S = 30;
const hijoRepo = path.resolve(process.argv[2] ?? 'scripts/_trinquete-de-zona-hijo.mjs');
const base = fs.mkdtempSync(path.join(os.tmpdir(), 'scrum1494-'));
// Se borra al salir pase lo que pase (también con `process.exit` y si algo revienta): guard de SCRUM-864c.
process.on('exit', () => fs.rmSync(base, { recursive: true, force: true }));
const raiz = path.join(base, 'raiz');
fs.mkdirSync(path.join(raiz, 'tests'), { recursive: true });

const SEMILLAS = {
  'sano.test.mjs': "import test from 'node:test';\ntest('sano', () => {});\n",
  'colgado-en-test.test.mjs': "import test from 'node:test';\ntest('no acaba', async () => { setInterval(() => {}, 1000); await new Promise(() => {}); });\n",
  'colgado-al-cargar.test.mjs': "import test from 'node:test';\nsetInterval(() => {}, 1000);\nawait new Promise(() => {});\ntest('nunca llega', () => {});\n",
  'handle-vivo.test.mjs': "import test from 'node:test';\ntest('acaba y deja un temporizador', () => { setInterval(() => {}, 1000); });\n",
};
for (const [f, src] of Object.entries(SEMILLAS)) fs.writeFileSync(path.join(raiz, 'tests', f), src);

const original = fs.readFileSync(hijoRepo, 'utf8');
const LINEA = 'forceExit: true, concurrency: CONCURRENCIA });';
const variantes = {
  antes: original,
  timeout: original.replace(LINEA, `forceExit: true, concurrency: CONCURRENCIA, timeout: ${LIMITE_MS} });`),
  senal: original.replace(LINEA, `forceExit: true, concurrency: CONCURRENCIA, timeout: ${LIMITE_MS}, signal: AbortSignal.timeout(${LIMITE_MS * 2}) });`),
};
for (const [n, src] of Object.entries(variantes)) {
  if (n !== 'antes' && src === original) { console.log(`ABORTO: la variante «${n}» no se aplicó (no encuentro la línea de run()). EXIT=2`); process.exit(2); }
  fs.writeFileSync(path.join(base, `hijo-${n}.mjs`), src);
}

const lanzar = (variante, fichero) => new Promise((ok) => {
  const lista = path.join(base, 'lista.json');
  const destino = path.join(base, 'medida.json');
  fs.rmSync(destino, { force: true });
  fs.writeFileSync(lista, JSON.stringify([path.join(raiz, 'tests', 'sano.test.mjs'), path.join(raiz, 'tests', fichero)]));
  const env = { PATH: process.env.PATH, SystemRoot: process.env.SystemRoot, TZ: 'Pacific/Kiritimati' };
  const t0 = Date.now();
  const p = spawn(process.execPath, [path.join(base, `hijo-${variante}.mjs`), lista, destino, raiz], { stdio: 'ignore', env });
  let tope = false;
  const reloj = setTimeout(() => { tope = true; p.kill(); }, TOPE_S * 1000);
  p.on('exit', (code) => {
    clearTimeout(reloj);
    const s = ((Date.now() - t0) / 1000).toFixed(1);
    const medida = fs.existsSync(destino) ? JSON.parse(fs.readFileSync(destino, 'utf8')) : null;
    const v = medida ? medida.veredictos.filter(([k]) => !k.startsWith('tests/sano')).map(([k, r]) => `${r}:${k.split('::')[1].split(/[\\/]/).pop()}`).join(' ') : '—';
    const sano = medida ? (medida.veredictos.find(([k]) => k.startsWith('tests/sano'))?.[1] ?? 'AUSENTE') : '—';
    ok({ variante, fichero, s, code, tope, sano, v });
  });
});

console.log(`POBLACION=${Object.keys(variantes).length} variantes × ${Object.keys(SEMILLAS).length - 1} semillas (+ sano.test.mjs en cada pasada) · hijo=${hijoRepo} · limite=${LIMITE_MS} ms · tope de pared=${TOPE_S} s · node ${process.version}`);
const filas = [];
for (const variante of Object.keys(variantes)) {
  for (const fichero of Object.keys(SEMILLAS).filter((f) => f !== 'sano.test.mjs')) {
    const r = await lanzar(variante, fichero);
    filas.push(r);
    console.log(`${r.variante.padEnd(8)} ${r.fichero.padEnd(28)} ${r.tope ? 'TOPE ' : 'acaba'} ${r.s.padStart(5)} s · code=${r.code} · sano=${r.sano} · semilla=${r.v}`);
  }
}
// El control: «antes» TIENE que colgarse con alguna semilla; si no, el banco no ve el defecto.
const control = filas.some((r) => r.variante === 'antes' && r.tope);
console.log(control ? 'CONTROL · «antes» se cuelga con una semilla: el banco ve el defecto' : 'CONTROL FALLIDO · «antes» no se colgó con ninguna semilla: el banco es ciego');
console.log(`EXIT=${control ? 0 : 1}`);
process.exit(control ? 0 : 1);
