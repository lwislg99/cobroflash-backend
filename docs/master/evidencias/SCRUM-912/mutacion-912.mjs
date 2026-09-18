// docs/master/evidencias/SCRUM-912/mutacion-912.mjs — SCRUM-912 · ¿cada test mide lo suyo? Mutación sobre dist/.
//
// Cada mutante inyecta UN fallo real en el JS COMPILADO (no en src/: 14 compilaciones no aportan
// nada que no dé esto, porque el test corre contra dist/), corre el test de 912 y dice QUÉ tests
// cayeron. Se restaura SIEMPRE el fichero, y se comprueba al final que dist/ queda byte a byte
// como estaba. Uso: `npm run build` y después `node docs/master/evidencias/SCRUM-912/mutacion-912.mjs`.
//
// Un mutante que no encuentra su texto ABORTA (no «sobrevive»): un reemplazo que no se hizo se lee
// exactamente igual que un test que no lo caza.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';

const RAIZ = path.resolve(import.meta.dirname, '..', '..', '..', '..');
const D = (p) => path.join(RAIZ, 'dist', p);
const DOM = D('modules/expenses/domain/lecturaTicket.js');
const RUTA = D('modules/expenses/app/routes/expenses.routes.js');
const GEM = D('integrations/gemini.js');
const JUS = D('modules/expenses/domain/justificante.js');
const TEST = path.join(RAIZ, 'tests', 'scrum912-leer-ticket-gasto.test.mjs');

const MUTANTES = [
  { id: 'M1 respaldo de pago', f: DOM, de: 'const completar = deps.completar ?? gemini_1.geminiCompleteConModelo;',
    a: "const completar = deps.completar ?? (async (x) => { if (!require('../../../core/config/env').config.GEMINI_API_KEY) { await fetch('https://api.anthropic.com/v1/messages', { method: 'POST' }); return { texto: '{}', modelo: 'claude' }; } return gemini_1.geminiCompleteConModelo(x); });",
    cae: 'sin clave de Gemini' },
  { id: 'M13 cae a 2.5-flash', f: DOM, de: "'gemini-2.5-flash-lite',", a: "'gemini-2.5-flash-lite', 'gemini-2.5-flash',", cae: 'NUNCA cae a gemini-2.5-flash' },
  { id: 'M14 ignora la lista', f: DOM, de: 'models: [...exports.MODELOS_LECTURA],', a: '', cae: 'inline_data' },
  { id: 'M15 models ignorado', f: GEM, de: 'const models = params.models?.length', a: 'const models = false', cae: 'pasa al siguiente de ESA lista' },
  { id: 'M16 cuota sin leer', f: GEM, de: "429, cuotasDelError(bodyText));", a: '429);', cae: 'errores de Google' },
  { id: 'M17 diaria no manda', f: DOM, de: 'if (ids.some((q) => /PerDay/.test(q)))', a: 'if (false)', cae: 'la diaria manda' },
  { id: 'M2 la foto no viaja', f: GEM, de: 'const imagenes = (params.images ?? []).map(', a: 'const imagenes = ([]).map(', cae: 'inline_data' },
  { id: 'M3 sin temperatura 0', f: DOM, de: 'temperature: 0,', a: '', cae: 'inline_data' },
  { id: 'M4 tipo no entero', f: JUS, de: 'return Number.isInteger(tipo) && fiscalInput_1', a: 'return fiscalInput_1', cae: 'no cuadra se DESCARTA' },
  { id: 'M5 base sin cuadrar', f: JUS, de: 'return Math.abs(b + c - t) <= exports.TOLERANCIA_CENTIMOS;', a: 'return true;', cae: 'céntimo de tolerancia' },
  { id: 'M6 fecha futura', f: DOM, de: "descarta('date', 'fecha_futura');", a: 'fecha = s;', cae: 'no cuadra se DESCARTA' },
  { id: 'M7 NIF sin control', f: DOM, de: 'if (!(0, nifEspanol_1.validarNifEspanol)(nif).valido)', a: 'if (false)', cae: 'no cuadra se DESCARTA' },
  { id: 'M8 elige entre dos', f: DOM, de: 'if (casan.length === 1)', a: 'if (casan.length >= 1)', cae: 'UNA ficha del merchant' },
  { id: 'M9 sin merchantId', f: DOM, de: 'where: { merchantId: p.merchantId, taxId: { not: null } },', a: 'where: { taxId: { not: null } },', cae: 'UNA ficha del merchant' },
  { id: 'M10 IA confirma', f: DOM, de: 'vatDeducible: null,', a: 'vatDeducible: true,', cae: 'NUNCA da un ticket por deducible' },
  { id: 'M11 tope global', f: RUTA, de: '`leer-ticket:${req.merchantId}:', a: '`leer-ticket:', cae: 'tope diario' },
  { id: 'M12 log de lo leído', f: RUTA, de: 'return res.json({ ok: true, ...lectura });', a: 'console.log(JSON.stringify(lectura)); return res.json({ ok: true, ...lectura });', cae: 'acaban en el log' },
];

const originales = new Map([DOM, RUTA, GEM, JUS].map((f) => [f, fs.readFileSync(f)]));
const tap = path.join(os.tmpdir(), `mutantes-912-${process.pid}.tap`);

function correr() {
  if (fs.existsSync(tap)) fs.rmSync(tap); // un TAP del mutante anterior no puede leerse como de éste
  const env = { ...process.env };
  delete env.FORCE_COLOR;
  const r = spawnSync(process.execPath, ['--test', '--test-force-exit', '--test-reporter=tap', `--test-reporter-destination=${tap}`, TEST],
    { cwd: RAIZ, env, encoding: 'utf8' });
  const salida = fs.existsSync(tap) ? fs.readFileSync(tap, 'utf8') : '';
  const caidos = [...salida.matchAll(/^not ok \d+ - (.*)$/gm)].map((m) => m[1]);
  const pasan = [...salida.matchAll(/^ok \d+ - /gm)].length;
  return { status: r.status, caidos, pasan };
}

let fallos = 0;
try {
  const base = correr();
  console.log(`BASE: ${base.pasan} ok, ${base.caidos.length} caídos (status ${base.status})`);
  if (base.caidos.length !== 0 || base.pasan === 0) throw new Error('la BASE no está en verde: no hay nada que comparar');

  for (const m of MUTANTES) {
    const orig = originales.get(m.f).toString('utf8');
    const veces = orig.split(m.de).length - 1;
    if (veces !== 1) throw new Error(`${m.id}: el texto a mutar aparece ${veces} veces (tiene que ser 1)`);
    fs.writeFileSync(m.f, orig.replace(m.de, m.a));
    try {
      const r = correr();
      const cazado = r.caidos.some((t) => t.includes(m.cae));
      if (!cazado) fallos += 1;
      console.log(`${cazado ? 'MUERTO ' : 'VIVO   '} ${m.id.padEnd(22)} caen ${r.caidos.length}: ${r.caidos.map((t) => t.replace(/^SCRUM-912 · /, '').slice(0, 50)).join(' | ')}`);
    } finally {
      fs.writeFileSync(m.f, originales.get(m.f));
    }
  }
} finally {
  for (const [f, b] of originales) fs.writeFileSync(f, b);
  fs.rmSync(tap, { force: true });
  const intactos = [...originales].every(([f, b]) => fs.readFileSync(f).equals(b));
  console.log(`dist/ restaurado byte a byte: ${intactos}`);
  if (!intactos) process.exitCode = 2;
}
console.log(`${MUTANTES.length} mutantes, ${MUTANTES.length - fallos} muertos, ${fallos} vivos`);
if (fallos) process.exitCode = 1;
