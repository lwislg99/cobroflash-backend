// docs/master/evidencias/scrum1500h/en-sitio.cjs — SCRUM-1500h
//
// Comprueba, por BYTES y contra el ancestro común con `origin/main`, que las correcciones
// quedaron EN SITIO: mismas líneas, sin retornos de carro ni BOM nuevos, las dos copias de la
// skill idénticas, el código de los ficheros de código intacto (sólo cambian comentarios) y la
// cita del asesor literal respecto al comentario que cita. Cada recuento lleva su control
// sembrado: un caso fabricado aquí que TIENE que salir distinto.
//
//   node docs/master/evidencias/scrum1500h/en-sitio.cjs      (sale 1 si algo no cuadra)
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');

const RAIZ = path.resolve(__dirname, '..', '..', '..', '..');
const git = (...a) => execFileSync('git', a, { cwd: RAIZ, maxBuffer: 1 << 28 });
const BASE = git('merge-base', 'HEAD', 'origin/main').toString().trim();
const sha = (b) => crypto.createHash('sha256').update(b).digest('hex');
const cuenta = (buf, byte) => { let n = 0; for (const x of buf) if (x === byte) n++; return n; };
const tieneBom = (b) => b[0] === 0xef && b[1] === 0xbb && b[2] === 0xbf;

/** Las líneas que el encargo permite tocar en cada fichero. Ni una más. */
const ESPERADO = {
  '.claude/skills/yaqu-verifactu-sif/SKILL.md': [51, 64, 83],
  '.agents/skills/yaqu-verifactu-sif/SKILL.md': [51, 64, 83],
  '.claude/skills/verifactu/SKILL.md': [46, 48, 51, 52],
  'src/modules/invoicing/domain/modoVisible.ts': [21, 22],
  'tests/scrum298-modo-visible.test.mjs': [9],
  'tests/scrum1127-sif-cola.test.mjs': [3],
  'public/dashboard/js/settingsView.js': [195],
  'docs/legal/PREGUNTAS_ASESOR.md': [461, 463],
  'docs/legal/AUDITLOG_FISCAL_CONTRATO.md': [300, 301, 777],
  'docs/legal/SEMAFORO_MAPA_EMISION.md': [295, 296, 302],
  'docs/legal/SEMAFORO_CALIBRACION.md': [199],
  'docs/legal/AUDITORIA_CAMINO_EMISION.md': [151, 225],
  'docs/legal/INVENTARIO_AFIRMACIONES_VERIFACTU.md': [107, 411, 416],
  'docs/legal/INVENTARIO_AFIRMACIONES_SKILLS.md': [143, 229],
  'docs/RUNBOOKS.md': [76],
  'docs/equipo/puesto-j1.md': [16],
  'docs/SIF_SPEC_NOTES.md': [77, 78],
  'docs/sql/scrum-825-borrado-de-documentos-de-prueba.sql': [14],
};
const CODIGO = ['src/modules/invoicing/domain/modoVisible.ts', 'tests/scrum298-modo-visible.test.mjs',
  'tests/scrum1127-sif-cola.test.mjs', 'public/dashboard/js/settingsView.js'];

const malas = [];
const mal = (m) => { malas.push(m); console.log('  ✗ ' + m); };
console.log(`BASE (ancestro común con origin/main): ${BASE}`);

// ① Qué ficheros cambian contra la base, fuera del registro y de estas evidencias.
const cambiados = git('diff', '--name-only', BASE, '--').toString().split('\n').filter(Boolean)
  .filter((f) => !f.startsWith('docs/master/'));
const esperados = Object.keys(ESPERADO);
console.log(`\n① POBLACION: ${cambiados.length} ficheros cambian fuera de docs/master · se esperan ${esperados.length}`);
for (const f of cambiados) if (!esperados.includes(f)) mal(`cambia un fichero que no está en la lista: ${f}`);
for (const f of esperados) if (!cambiados.includes(f)) mal(`no cambia un fichero de la lista: ${f}`);
for (const zona of ['src/', 'prisma/', 'public/']) {
  console.log(`   en ${zona}: ${cambiados.filter((f) => f.startsWith(zona)).length}`);
}

// ② Líneas, retornos de carro y BOM, fichero a fichero.
console.log('\n② EN SITIO · fichero · líneas antes → después · líneas distintas · CR antes/después · BOM');
for (const f of esperados) {
  const antes = git('show', `${BASE}:${f}`);
  const ahora = fs.readFileSync(path.join(RAIZ, f));
  const a = antes.toString('utf8').split('\n');
  const d = ahora.toString('utf8').split('\n');
  const distintas = [];
  for (let i = 0; i < Math.max(a.length, d.length); i++) if (a[i] !== d[i]) distintas.push(i + 1);
  console.log(`   ${f} · ${a.length} → ${d.length} · ${distintas.join(', ')} · CR ${cuenta(antes, 13)}/${cuenta(ahora, 13)} · BOM ${tieneBom(antes)}/${tieneBom(ahora)}`);
  if (a.length !== d.length) mal(`${f}: cambia el número de líneas`);
  if (distintas.join() !== ESPERADO[f].join()) mal(`${f}: líneas distintas ${distintas.join()} ≠ esperadas ${ESPERADO[f].join()}`);
  if (cuenta(antes, 13) !== cuenta(ahora, 13)) mal(`${f}: cambian los retornos de carro`);
  if (tieneBom(antes) !== tieneBom(ahora)) mal(`${f}: cambia el BOM`);
}

// ③ Las dos copias de la skill, por bytes.
const [c1, c2] = ['.claude', '.agents'].map((d) => fs.readFileSync(path.join(RAIZ, d, 'skills/yaqu-verifactu-sif/SKILL.md')));
console.log(`\n③ SKILL · ${c1.length} B y ${c2.length} B · sha256 ${sha(c1).slice(0, 16)}… / ${sha(c2).slice(0, 16)}…`);
if (sha(c1) !== sha(c2)) mal('las dos copias de la skill NO son idénticas');
const sembrada = Buffer.concat([c2, Buffer.from(' ')]);
console.log(`   control sembrado (un byte de más): ${sha(c1) === sha(sembrada) ? 'CIEGO' : 'lo ve'}`);
if (sha(c1) === sha(sembrada)) mal('el control de la skill está CIEGO');

// ④ El código de los ficheros de código: los mismos tokens, sin contar comentarios.
const ts = require('typescript');
const tokens = (texto) => {
  const s = ts.createScanner(ts.ScriptTarget.Latest, /* skipTrivia */ true, ts.LanguageVariant.Standard, texto);
  const out = [];
  for (let k = s.scan(); k !== ts.SyntaxKind.EndOfFileToken; k = s.scan()) out.push(k + ':' + s.getTokenText());
  return out;
};
console.log('\n④ CÓDIGO · fichero · tokens antes / después');
for (const f of CODIGO) {
  const a = tokens(git('show', `${BASE}:${f}`).toString('utf8'));
  const d = tokens(fs.readFileSync(path.join(RAIZ, f), 'utf8'));
  console.log(`   ${f} · ${a.length} / ${d.length} · ${a.join('\u0001') === d.join('\u0001') ? 'idénticos' : 'DISTINTOS'}`);
  if (a.length === 0) mal(`${f}: 0 tokens: el lector está ciego`);
  if (a.join('\u0001') !== d.join('\u0001')) mal(`${f}: cambia el código, no sólo el comentario`);
}
{
  const f = CODIGO[0];
  const a = tokens(git('show', `${BASE}:${f}`).toString('utf8'));
  const d = tokens(fs.readFileSync(path.join(RAIZ, f), 'utf8') + '\nconst sembrado = 1;');
  const lo_ve = a.join('\u0001') !== d.join('\u0001');
  console.log(`   control sembrado (una sentencia de más): ${lo_ve ? 'lo ve' : 'CIEGO'}`);
  if (!lo_ve) mal('el control de tokens está CIEGO');
}

// ⑤ La cita del asesor es literal respecto al comentario de modoVisible.ts.
const mv = fs.readFileSync(path.join(RAIZ, CODIGO[0]), 'utf8').split('\n');
const asesor = fs.readFileSync(path.join(RAIZ, 'docs/legal/PREGUNTAS_ASESOR.md'), 'utf8').split('\n')[462];
const fin = mv[21].indexOf(' `applyVeriFactu`');
const corchetes = mv[21].slice('// la AEAT. '.length, fin).replace(/\r$/, '');
const cola21 = mv[20].slice(mv[20].indexOf('Nada envía a'));
console.log(`\n⑤ CITA · corchetes del comentario: ${corchetes.length} caracteres · empiezan «${corchetes.slice(0, 30)}»`);
if (corchetes.length < 500 || !corchetes.startsWith('[Corregido el 13-oct-2026')) mal('no encuentro los corchetes en modoVisible.ts:22');
if (!cola21.startsWith('Nada envía a')) mal('modoVisible.ts:21 no acaba en «Nada envía a»');
const literal = asesor.includes('Nada envía a la AEAT. ' + corchetes);
console.log(`   la línea 463 del asesor los lleva literales: ${literal}`);
if (!literal) mal('la cita del asesor NO es literal');
const sembrado5 = asesor.replace('538 líneas', '539 líneas').includes('Nada envía a la AEAT. ' + corchetes);
console.log(`   control sembrado (una cifra cambiada en la cita): ${sembrado5 ? 'CIEGO' : 'lo ve'}`);
if (sembrado5) mal('el control de la cita está CIEGO');

// ⑥ Lo que el comentario afirma del cliente, releído del árbol.
const cliente = fs.readFileSync(path.join(RAIZ, 'src/modules/fiscal/verifactu/sif.client.ts'), 'utf8').split('\n');
const lineasCliente = cliente[cliente.length - 1] === '' ? cliente.length - 1 : cliente.length;
const red = cliente.map((l, i) => (/\)\.request\(/.test(l) ? i + 1 : 0)).filter(Boolean);
console.log(`\n⑥ CLIENTE · sif.client.ts: ${lineasCliente} líneas · llamadas de red (\`).request(\`) en: ${red.join(', ')}`);
if (lineasCliente !== 538) mal(`sif.client.ts tiene ${lineasCliente} líneas, y lo escrito dice 538`);
if (red.length !== 1) mal(`sif.client.ts tiene ${red.length} llamadas de red, y lo escrito dice una`);

// ⑦ El relevo (SCRUM-1500 c.19155): la línea 88 de la skill vuelve a ser la del ancestro —la
//    nota ensanchaba el permiso— y `verifactu/SKILL.md:52` dice del cliente lo MISMO que el
//    comentario de modoVisible.ts, letra a letra.
const es88DelAncestro = (antes, ahora) => antes === ahora && !/\[Nota del/.test(ahora);
console.log('\n⑦ RELEVO · la línea 88 de la skill, contra el ancestro · y la 52 de la otra skill, contra el comentario');
for (const d of ['.claude', '.agents']) {
  const f = `${d}/skills/yaqu-verifactu-sif/SKILL.md`;
  const antes88 = git('show', `${BASE}:${f}`).toString('utf8').split('\n')[87];
  const ahora88 = fs.readFileSync(path.join(RAIZ, f), 'utf8').split('\n')[87];
  console.log(`   ${f}:88 · ${Buffer.byteLength(antes88)} B / ${Buffer.byteLength(ahora88)} B · ${antes88 === ahora88 ? 'idéntica' : 'DISTINTA'}`);
  if (!antes88.includes('hay envío, y el documento')) mal(`${f}:88 del ancestro no es la línea que se esperaba: el lector está ciego`);
  if (!es88DelAncestro(antes88, ahora88)) mal(`${f}:88 no es la del ancestro, o sigue llevando una nota`);
}
{
  const base88 = git('show', `${BASE}:.claude/skills/yaqu-verifactu-sif/SKILL.md`).toString('utf8').split('\n')[87];
  const conNota = base88.replace('hay envío,', 'hay envío [Nota del 13-oct-2026],');
  const lo_ve = es88DelAncestro(base88, base88) && !es88DelAncestro(base88, conNota);
  console.log(`   control sembrado (la nota, puesta otra vez): ${lo_ve ? 'lo ve' : 'CIEGO'}`);
  if (!lo_ve) mal('el control de la línea 88 está CIEGO');
}
{
  const l51 = fs.readFileSync(path.join(RAIZ, '.claude/skills/verifactu/SKILL.md'), 'utf8').split('\n')[50];
  const l52 = fs.readFileSync(path.join(RAIZ, '.claude/skills/verifactu/SKILL.md'), 'utf8').split('\n')[51];
  // `corchetes` trae DOS corchetes (el del cliente y el de la cola): lo del cliente acaba en el primer «Railway.]».
  const desde = corchetes.indexOf('Medido en SCRUM-1500g');
  const medido = corchetes.slice(desde, corchetes.indexOf('Railway.]', desde) + 'Railway.]'.length);
  console.log(`   verifactu/SKILL.md:51 acaba en «Nada envía a la»: ${l51.endsWith('Nada envía a la')} · la 52 lleva literales los ${medido.length} caracteres de lo medido y lo NO medido: ${l52.includes(medido)}`);
  if (medido.length < 300 || !medido.endsWith('Railway.]')) mal('no encuentro lo medido del cliente en modoVisible.ts:22');
  if (!l51.endsWith('Nada envía a la')) mal('verifactu/SKILL.md:51 no acaba en «Nada envía a la»');
  if (!l52.includes(medido)) mal('verifactu/SKILL.md:52 NO dice del cliente lo mismo que modoVisible.ts:22');
  if (/ni una sola llamada del código hacia la$/.test(l51)) mal('verifactu/SKILL.md:51 sigue diciendo «ni una sola llamada»');
  const sembrado7 = l52.replace('538 líneas', '539 líneas').includes(medido);
  console.log(`   control sembrado (una cifra cambiada en la 52): ${sembrado7 ? 'CIEGO' : 'lo ve'}`);
  if (sembrado7) mal('el control de la línea 52 está CIEGO');
}

console.log(`\n${malas.length ? 'NO CUADRA: ' + malas.length : 'TODO CUADRA'}`);
console.log(`EXIT=${malas.length ? 1 : 0}`);
process.exit(malas.length ? 1 : 0);
