// docs/master/evidencias/SCRUM-1527/1527h/interroga.mjs — SCRUM-1527h · el interrogatorio de s3-reproduce-hoy.mjs
//
//     node docs/master/evidencias/SCRUM-1527/1527h/interroga.mjs <instrumento.mjs>
//
// Corre el instrumento SIN RED sobre listas sembradas (--de-cache, con los logs ya en la carpeta, así
// que no baja nada) y compara su código de salida y su salida con lo que tiene que decir. El
// instrumento tiene que vivir a la profundidad de docs/master/evidencias/SCRUM-1527/ (busca tests/
// cuatro niveles arriba): para interrogar la versión vieja, se copia ahí con otro nombre.
//
// Rojo primero: contra la versión de main anterior a 1527h (c93f26a76) tienen que caer los casos
// del corte y del positivo; contra la nueva, ninguno. Sale 0 si todos cuadran, 1 si alguno no.
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const instrumento = resolve(process.argv[2] ?? '');
if (!process.argv[2]) { console.error('uso: interroga.mjs <instrumento.mjs>'); process.exit(2); }

const COLGADO = 119769715166; // el conocido del 22-oct, 10:21:15Z
const job = (id, creado, dur, paso = 'success') => ({ job: id, run: id, evento: 'pull_request', rama: `sembrado-${id}`, sha: 'x', creado, conclusion: paso, status: 'completed', paso, dur });
const relleno = 'x'.repeat(2000);
const logColgado = `${relleno}\n✔ uno (12ms)\n✔ dos (3ms)\n::error::TANDA SIN VEREDICTO · Lo último que llegó: «✔ SCRUM-615 · 🔴 el módulo no escribe (5ms)»\n`;
const logSano = `${relleno}\n✔ uno (12ms)\n✔ dos (3ms)\n`;

// Base: el colgado conocido, un sano largo antes del corte y otro después, y uno corto.
const BASE = [
  job(COLGADO, '2026-10-22T10:21:15Z', 1210, 'failure'),
  job(901, '2026-10-24T10:58:36Z', 748),
  job(902, '2026-10-28T12:00:00Z', 760),
  job(903, '2026-10-28T13:00:00Z', 400),
];
const LOGS = { [COLGADO]: logColgado, 901: logSano, 902: logSano };
const CORTE = '2026-10-27T13:09:00Z';

const casos = [
  { nombre: 'corte por nombre: parte la cuenta por la fecha dada', args: ['2026-10-22T00:00:00Z', '@', '--corte', CORTE, '--de-cache'],
    rc: 0, dice: [/corte 2026-10-27T13:09:00Z/, /antes del corte: 2 jobs con paso «Tests»/, /después del corte: 2 jobs con paso «Tests»/], noDice: [/corte --/] },
  { nombre: '--de-cache en el sitio del corte: no puede partir por «--de-cache»', args: ['2026-10-22T00:00:00Z', '@', '--de-cache'],
    rc: 0, noDice: [/corte --de-cache/] },
  { nombre: 'un tercer posicional (el «Cómo se repite» viejo) sale 2 a la vista', args: ['2026-10-22T00:00:00Z', '@', CORTE, '--de-cache'],
    rc: 2 },
  { nombre: '--corte que no es fecha sale 2', args: ['2026-10-22T00:00:00Z', '@', '--corte', 'ayer', '--de-cache'],
    rc: 2 },
  { nombre: 'ventana sin ningún colgado conocido: CIEGO, nunca 0', args: [CORTE, '@', '--de-cache'],
    rc: 2, dice: [/CIEGO/, /ningún colgado conocido cae en la ventana/] },
  { nombre: 'positivo en la ventana pero su log sin aviso: CIEGO', args: ['2026-10-22T00:00:00Z', '@', '--de-cache'], logs: { ...LOGS, [COLGADO]: logSano },
    rc: 2, dice: [/119769715166 .*no sale con su aviso/] },
  { nombre: 'positivo que la lista ha perdido: CIEGO (por fecha, no por figurar)', args: ['2026-10-22T00:00:00Z', '@', '--de-cache'], jobs: BASE.filter((x) => x.job !== COLGADO),
    rc: 2 },
  { nombre: '--umbral 900 deja fuera los sanos de 748/760 s y sigue viendo el colgado', args: ['2026-10-22T00:00:00Z', '@', '--umbral', '900', '--de-cache'],
    rc: 0, dice: [/candidatos \(paso «Tests» de 900 s o más\): 1/, /119769715166, 2026-10-22T10:21:15Z\): sale, con su aviso/] },
];

let malos = 0;
for (const c of casos) {
  const dir = mkdtempSync(join(tmpdir(), 's3-1527h-'));
  try {
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'jobs.json'), JSON.stringify(c.jobs ?? BASE));
    for (const [id, t] of Object.entries(c.logs ?? LOGS)) writeFileSync(join(dir, `job${id}.log`), t);
    let rc = 0; let salida = '';
    try { salida = execFileSync(process.execPath, [instrumento, ...c.args.map((a) => (a === '@' ? dir : a))], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }); }
    catch (e) { rc = e.status ?? -1; salida = `${e.stdout ?? ''}${e.stderr ?? ''}`; }
    const fallan = [];
    if (rc !== c.rc) fallan.push(`salida ${rc}, tenía que ser ${c.rc}`);
    for (const r of c.dice ?? []) if (!r.test(salida)) fallan.push(`no dice ${r}`);
    for (const r of c.noDice ?? []) if (r.test(salida)) fallan.push(`dice ${r}`);
    console.log(`${fallan.length ? '✖' : '✔'} ${c.nombre}${fallan.length ? ` → ${fallan.join(' · ')}` : ''}`);
    if (fallan.length) malos++;
  } finally { rmSync(dir, { recursive: true, force: true }); }
}
console.log(`interrogatorio de ${instrumento}: ${casos.length - malos} de ${casos.length} cuadran`);
process.exitCode = malos ? 1 : 0;
