// mutar.mjs — SCRUM-1392 · EL TEST, VISTO EN ROJO.
//
//   node docs/master/evidencias/scrum1392/mutar.mjs
//
// Primero la BASE sin mutar (A3): tiene que salir 0. Después, una mutación cada vez: se cambia UNA
// cosa del arreglo, se corre `tests/scrum1392-…` y se mira QUÉ caso cae. El fichero mutado se
// devuelve byte a byte y se comprueba, pase lo que pase.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');
const TEST = 'tests/scrum1392-un-hallazgo-visto-no-caduca.test.mjs';
const PIEZA = 'scripts/_hallazgos-y-ciegos.mjs';

const MUTACIONES = [
  { nombre: 'la pieza deja de conservar lo entregado cuando el caso lanza (el defecto del ticket)', f: PIEZA,
    de: '      hallazgos.push(...suyas.hallazgos);\n      ciegos.push(...suyas.ciegos);\n      ciegos.push(nombre +', a: '      ciegos.push(nombre +', cae: '① un caso que apunta en las listas ENTREGADAS' },
  { nombre: 'todo lanzamiento se vuelve hallazgo (lo que rompería el ciego)', f: PIEZA,
    de: "      ciegos.push(nombre + ': no se pudo medir — '", a: "      hallazgos.push(nombre + ': no se pudo medir — '", cae: '② EL POSITIVO' },
  { nombre: 'la línea sólo sale si alguien lanzó con hallazgos', f: PIEZA,
    de: '  decir(linea);', a: '  if (lanzaronConHallazgos > 0) decir(linea);', cae: '③ la línea del recorrido sale SIEMPRE' },
  { nombre: 'lo entregado se cuenta dos veces', f: PIEZA,
    de: '    if (devueltos !== suyas.hallazgos) hallazgos.push(...suyas.hallazgos);', a: '    hallazgos.push(...suyas.hallazgos);', cae: '① lo entregado no se cuenta dos veces' },
  { nombre: '`guard-duplicar-926` vuelve a llevar los errores de página en la mano', f: 'scripts/guard-duplicar-926.mjs',
    de: 'const abrirEditorDuplicando = async (nav, c, errores) => {\n  caso = c;\n  const pag = await nav.newPage();\n',
    a: 'const abrirEditorDuplicando = async (nav, c) => {\n  caso = c;\n  const pag = await nav.newPage();\n  const errores = [];\n', cae: '④ ningún guard de scripts/ lleva' },
  { nombre: '`guard-portal-en-la-ficha` vuelve a su lista propia', f: 'scripts/guard-portal-en-la-ficha.mjs',
    de: '    const suyos = suyas.hallazgos;', a: '    const suyos = [];', cae: '④ ningún guard de scripts/ lleva' },
];

const entorno = { ...process.env };
for (const k of ['FORCE_COLOR', 'NODE_OPTIONS', 'NODE_TEST_CONTEXT']) delete entorno[k];
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'yaqu-1392-mut-'));
process.on('exit', () => {
  fs.rmSync(TMP, { recursive: true, force: true });
});

function correr(etiqueta) {
  const tap = path.join(TMP, etiqueta + '.tap');
  const r = spawnSync(process.execPath, ['--test', '--test-force-exit', '--test-reporter=tap', '--test-reporter-destination=' + tap, TEST],
    { cwd: RAIZ, env: entorno, encoding: 'utf8', timeout: 240000 });
  const texto = fs.existsSync(tap) ? fs.readFileSync(tap, 'utf8') : '';
  const lineas = texto.split('\n');
  const caidos = lineas.filter((l) => /^not ok \d+ - /.test(l)).map((l) => l.replace(/^not ok \d+ - /, '').trim());
  const pasan = lineas.filter((l) => /^ok \d+ - /.test(l)).length;
  return { codigo: r.status, senal: r.signal, pasan, caidos, hayTap: texto.length > 0 };
}

const base = correr('base');
console.log(`BASE sin mutar: salida ${base.codigo} · ${base.pasan} pasan · ${base.caidos.length} caen`);
if (base.codigo !== 0 || !base.hayTap || base.pasan === 0 || base.caidos.length) {
  console.log('CIEGO: la base no sale limpia. Ninguna mutación se puede leer.');
  console.log('EXIT=2');
  process.exit(2);
}

console.log(`POBLACIÓN: ${MUTACIONES.length} mutaciones, una cada vez, sobre ${base.pasan} casos`);
let vivas = 0;
let ciegas = 0;
for (const [i, m] of MUTACIONES.entries()) {
  const abs = path.join(RAIZ, m.f);
  const original = fs.readFileSync(abs);
  const texto = original.toString('utf8');
  const crlf = texto.includes('\r\n');
  const de = crlf ? m.de.split('\n').join('\r\n') : m.de;
  const a = crlf ? m.a.split('\n').join('\r\n') : m.a;
  const veces = texto.split(de).length - 1;
  let r = null;
  if (veces === 1) {
    try {
      fs.writeFileSync(abs, texto.split(de).join(a));
      r = correr('m' + i);
    } finally {
      fs.writeFileSync(abs, original);
    }
  }
  const devuelto = Buffer.compare(fs.readFileSync(abs), original) === 0;
  let dictamen;
  if (veces !== 1) { dictamen = `CIEGA — la mutación NO se aplicó («${m.de.slice(0, 40)}…» aparece ${veces} veces)`; ciegas += 1; }
  else if (!devuelto) { dictamen = 'CIEGA — el fichero NO volvió a su original'; ciegas += 1; }
  else if (!r.hayTap || r.pasan + r.caidos.length === 0) { dictamen = 'CIEGA — el test no dejó informe'; ciegas += 1; }
  else if (r.caidos.some((c) => c.includes(m.cae))) { dictamen = `VIVA — cae «${r.caidos.find((c) => c.includes(m.cae)).slice(0, 90)}» (caen ${r.caidos.length} de ${r.pasan + r.caidos.length})`; vivas += 1; }
  else if (r.caidos.length) { dictamen = `CAE OTRO, no el esperado («${m.cae}»): ${r.caidos.map((c) => c.slice(0, 60)).join(' | ')}`; }
  else dictamen = 'MUDA — el test sigue verde con la mutación puesta';
  console.log(`  ${i + 1}. ${m.nombre}\n     ${m.f} → ${dictamen}`);
}
console.log(`RESULTADO: ${vivas} VIVAS de ${MUTACIONES.length} · ${ciegas} ciegas`);
const codigo = ciegas ? 2 : (vivas === MUTACIONES.length ? 0 : 1);
console.log('EXIT=' + codigo);
process.exitCode = codigo;
