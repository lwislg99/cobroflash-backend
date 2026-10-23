// mutar-1449b.mjs — SCRUM-1449b · cada pieza del arreglo, quitada de una en una, tiene que tumbar el test.
// Uso (desde la raíz del repo, con el TypeScript del checkout al que cuelga este árbol):
//   node docs/master/evidencias/SCRUM-1449/mutar-1449b.mjs <ruta a typescript/bin/tsc>
// Muta `src/.../payMp.routes.ts`, compila con --noCheck, corre el test y RESTAURA en `finally`.
// Primero la BASE sin mutar (A3): si la base no sale verde, todo es CIEGO.
import { readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const TSC = process.argv[2];
const F = 'src/modules/billing/app/routes/payMp.routes.ts';
const TEST = 'tests/scrum1449b-la-pagina-de-mercado-pago.test.mjs';
const original = readFileSync(F, 'utf8');
const entorno = { ...process.env }; delete entorno.NODE_TEST_CONTEXT; delete entorno.NODE_OPTIONS;

function correr() {
  const c = spawnSync(process.execPath, [TSC, '--noCheck', '-p', '.'], { encoding: 'utf8', env: entorno });
  if (c.status !== 0) return { veredicto: 'CIEGO (no compila)' };
  const t = spawnSync(process.execPath, ['--test', '--test-force-exit', '--test-reporter=tap', TEST], { encoding: 'utf8', env: entorno });
  const n = (k) => Number((new RegExp(`^# ${k} (\\d+)$`, 'm').exec(t.stdout) || [])[1]);
  const total = n('tests'), pass = n('pass'), fail = n('fail');
  if (!(total > 0) || pass + fail !== total) return { veredicto: `CIEGO (tests=${total} pass=${pass} fail=${fail})` };
  const caidos = [...t.stdout.matchAll(/^not ok \d+ - (.*)$/gm)].map((m) => m[1]);
  return { veredicto: fail ? 'ROJO' : 'VERDE', total, pass, fail, caidos };
}

const MUTANTES = [
  ['503 sin cabecera HTML', `    res.setHeader('Content-Type', 'text/html; charset=utf-8');\n    return res.status(503)`, `    return res.status(503)`],
  ['502 sin cabecera HTML', `    res.setHeader('Content-Type', 'text/html; charset=utf-8');\n    return res.status(502)`, `    return res.status(502)`],
  ['503 vuelve al texto plano', 'res.status(503).send(avisoMpHtml(MSG_MP_NO_DISPONIBLE))', 'res.status(503).send(MSG_MP_NO_DISPONIBLE)'],
  ['503 con «merchant» de vuelta', "'Ahora mismo no se puede pagar con Mercado Pago. Contacta con el profesional.'", "'Mercado Pago no está configurado para este merchant.'"],
  ['502 con una tilde menos', "'Error al conectar con Mercado Pago. Inténtalo de nuevo.'", "'Error al conectar con Mercado Pago. Intentalo de nuevo.'"],
  ['pendiente vuelve a prometer', "msg: 'Tu pago está siendo procesado.',", "msg: 'Tu pago está siendo procesado. Te notificaremos pronto.',"],
  ['sin token llama igual a Mercado Pago (cambia la decisión)', '  if (!accessToken) {\n', '  if (!accessToken && false) {\n'],
];

const filas = [];
try {
  const base = correr();
  filas.push(['BASE sin mutar', base]);
  if (base.veredicto !== 'VERDE') throw new Error('la base no sale verde: todo lo demás sería CIEGO');
  for (const [nombre, de, a] of MUTANTES) {
    if (!original.includes(de)) { filas.push([nombre, { veredicto: 'CIEGO (el trozo a mutar no está)' }]); continue; }
    writeFileSync(F, original.replace(de, a));
    filas.push([nombre, correr()]);
    writeFileSync(F, original);
  }
} finally {
  writeFileSync(F, original);
  spawnSync(process.execPath, [TSC, '--noCheck', '-p', '.'], { env: entorno });
}
for (const [nombre, r] of filas) console.log(`${r.veredicto.padEnd(8)} · ${nombre}${r.total ? ` · ${r.fail}/${r.total} caen` : ''}${r.caidos?.length ? ` · ${r.caidos.join(' | ')}` : ''}`);
const vivos = filas.slice(1).filter(([, r]) => r.veredicto !== 'ROJO').length;
console.log(`POBLACION: ${MUTANTES.length} mutantes + base · vivos o ciegos = ${vivos} · restaurado = ${readFileSync(F, 'utf8') === original}`);
process.exit(vivos ? 1 : 0);
