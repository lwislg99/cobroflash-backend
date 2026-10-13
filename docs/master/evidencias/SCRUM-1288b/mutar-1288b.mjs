// SCRUM-1288b · auditoría por mutación del censo: BASE sin mutar primero, y cada mutante tiene que
// tumbar el caso que dice guardarlo. Rutas ABSOLUTAS; se comprueba que la mutación ENTRÓ (numstat) y
// que el árbol queda limpio después de cada una.
// Uso: node mutar-1288b.mjs <raíz del árbol>   (el árbol tiene que estar LIMPIO y con todo comiteado)
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const raiz = path.resolve(process.argv[2]);
const CENSO = path.join(raiz, 'scripts', '_censo-gemelo-crudo.mjs');
const TESTS = ['tests/scrum1452-gemelo-crudo.test.mjs', 'tests/scrum1288b-el-importe-pegado-a-la-moneda.test.mjs'];
const git = (...a) => spawnSync('git', a, { cwd: raiz, encoding: 'utf8' }).stdout.trim();
const env = { PATH: process.env.PATH, Path: process.env.Path, SystemRoot: process.env.SystemRoot, TEMP: process.env.TEMP, TMP: process.env.TMP, USERPROFILE: process.env.USERPROFILE };

function correr() {
  const r = spawnSync(process.execPath, ['--test', '--test-reporter=tap', ...TESTS], { cwd: raiz, encoding: 'utf8', env });
  const tap = r.stdout;
  const cifra = (k) => Number((tap.match(new RegExp(`^# ${k} (\\d+)`, 'm')) ?? [])[1] ?? NaN);
  const caidos = [...tap.matchAll(/^not ok \d+ - (.*)$/gm)].map((m) => m[1]);
  return { exit: r.status, tests: cifra('tests'), pass: cifra('pass'), fail: cifra('fail'), caidos };
}

if (git('status', '--porcelain') !== '') { console.log('🔴 el árbol no está limpio: no muto nada'); process.exit(2); }
const original = fs.readFileSync(CENSO, 'utf8');
console.log(`POBLACION · árbol ${raiz} · HEAD ${git('rev-parse', 'HEAD')} · ${TESTS.length} ficheros de test`);
const base = correr();
console.log(`BASE sin mutar · exit ${base.exit} · tests ${base.tests} · pass ${base.pass} · fail ${base.fail}`);
if (base.exit !== 0 || !(base.tests > 0) || base.fail !== 0) { console.log('🔴 la base no está verde o es ciega: no hay auditoría'); process.exit(2); }

const MUTANTES = [
  { nombre: 'M1 · la forma apagada (nunca hay moneda detrás)', de: '      if (!detras) continue;', a: '      continue;',
    espera: ['SCRUM-1288b · SUELO', 'los tres correos', 'PARÁMETRO', 'por una variable', 'ninguna entrada declarada ha BAJADO', 'fichero nuevo'] },
  { nombre: 'M2 · las envolturas dejan de mirarse por dentro', de: "const ENVOLTURAS = new Set(['esc', 'escEmail', 'escText', 'escapeHtml', 'String']);", a: 'const ENVOLTURAS = new Set([]);',
    espera: ['con el formateador de la casa no se acusa'] },
  { nombre: 'M3 · un parámetro ya no tapa al const de fuera', de: '    if (ts.isFunctionLike(b) && b.parameters.some((p) => declara(p.name, nombre))) return null;\n', a: '',
    espera: ['se sigue por ÁMBITO'] },
  { nombre: 'M4 · a `fmt` se le cree por el nombre', de: "  'fmtMoneyAlbaran',\n]);", a: "  'fmtMoneyAlbaran',\n  'fmt',\n]);",
    espera: ['formateador LOCAL no se le cree'] },
  { nombre: 'M5 · el toFixed(2) pegado a la moneda se acusa dos veces', de: '      if (esToFixedDos(sinEnvolturas(p.expr))) continue;\n', a: '',
    espera: ['UNA fila IMPORTE, no dos'] },
  { nombre: 'M6 · un `let` libra igual que un `const`', de: '        if (!esConst || !ts.isIdentifier(d.name) || !d.initializer) return null;', a: '        if (!ts.isIdentifier(d.name) || !d.initializer) return null;',
    espera: ['se sigue por ÁMBITO'] },
  { nombre: 'M7 · cualquier llamada libra (no se mira qué devuelve la función local)', de: '    return es?.funcion !== undefined && soloDevuelveUnFormateador(es.funcion, saltos - 1);', a: '    return es?.funcion !== undefined;',
    espera: ['formateador LOCAL no se le cree'] },
  { nombre: 'M8 · un registro interno se acusa (se pierde DENTRO para la forma)', de: '      fila(SIN_FORMATEAR, p.expr, top, p.expr);', a: "      fila(SIN_FORMATEAR, p.expr, top, p.expr, { destino: NO_DECIDIBLE });",
    espera: ['un registro interno es DENTRO'] },
  { nombre: 'M9 · uno de los tres correos pasa a LEGITIMO', de: "sendTechQuoteApprovedEmail`, { n: 1, clase: DEUDA, retira: 'S1', motivo: 'correo «presupuesto aprobado»", a: "sendTechQuoteApprovedEmail`, { n: 1, clase: LEGITIMO, retira: null, motivo: 'correo «presupuesto aprobado»",
    espera: ['los tres correos'] },
  { nombre: 'M10 · uno de los tres correos se borra de DECLARADOS', de: /^.*SIN_FORMATEAR\|\$\{M\}messaging\/domain\/merchantNotifications\.ts::sendMerchantPaymentEmail.*\n/m, a: '',
    espera: ['ningún sitio NUEVO', 'los tres correos'] },
  { nombre: 'M11 · «euros» casa aunque siga la palabra (sin frontera)', de: 'EUR\\b|euros?\\b)/i;\nconst SOLO_UN_ESPACIO', a: 'EUR|euros?)/i;\nconst SOLO_UN_ESPACIO',
    espera: ['lo que no es un importe pegado a una moneda no se acusa'] },
];

let mal = 0;
for (const m of MUTANTES) {
  const mutado = original.replace(m.de, m.a);
  if (mutado === original) { console.log(`🔴 CIEGO · ${m.nombre}: la mutación NO se aplicó (el ancla no casa)`); mal++; continue; }
  fs.writeFileSync(CENSO, mutado);
  const numstat = git('diff', '--numstat');
  const r = correr();
  fs.writeFileSync(CENSO, original);
  const limpio = git('status', '--porcelain') === '';
  const faltan = m.espera.filter((e) => !r.caidos.some((c) => c.includes(e)));
  const ok = r.exit !== 0 && r.fail > 0 && faltan.length === 0 && limpio && r.tests === base.tests;
  if (!ok) mal++;
  console.log(`${ok ? 'MUERE ' : '🔴 VIVE'} · ${m.nombre} · numstat [${numstat.replace(/\s+/g, ' ')}] · tests ${r.tests} · fail ${r.fail} · caídos esperados que faltan: ${faltan.length ? faltan.join(' | ') : 'ninguno'} · árbol limpio después: ${limpio}`);
  for (const c of r.caidos) console.log(`     ✖ ${c.slice(0, 120)}`);
}
const fin = correr();
console.log(`BASE al acabar · exit ${fin.exit} · tests ${fin.tests} · pass ${fin.pass} · fail ${fin.fail} · árbol limpio: ${git('status', '--porcelain') === ''}`);
console.log(`RECUENTO · ${MUTANTES.length - mal} de ${MUTANTES.length} mutantes mueren donde se esperaba`);
process.exitCode = mal || fin.exit !== 0 ? 1 : 0;
