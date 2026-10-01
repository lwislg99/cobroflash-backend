// mutar.mjs — SCRUM-1340 · ¿EL GUARD DE LA SKILL CAE CUANDO EL DEFECTO VUELVE?
//
//   node docs/master/evidencias/scrum1340/mutar.mjs <raiz ABSOLUTA del arbol> <fichero de salida .json>
//
// Primero la BASE sin mutar (A3): si no sale entera en verde, el banco se declara CIEGO y no muta
// nada. Despues, una mutacion cada vez: sustituye contando (si el ancla no aparece EXACTAMENTE una
// vez, esa fila es CIEGA y no cuenta como cazada), corre el fichero del guard, deshace
// reescribiendo el contenido original y comprueba por sha256 que el fichero volvio a su sitio.
//
// El veredicto de cada fila lo da el NOMBRE del test que tenia que caer (`cae`), no «cayo algo»:
//   CAZADA ... cayo el test declarado.      OTRA ... cayo algo, pero no el declarado.
//   MUDA ..... no cayo nada: el defecto volveria sin que nadie se entere.
//   CIEGA .... el ancla no estaba una sola vez, o la pasada no ejecuto ningun test.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';

const [RAIZ, SALIDA] = process.argv.slice(2);
if (!RAIZ || !path.isAbsolute(RAIZ) || !SALIDA) {
  console.error('uso: node mutar.mjs <raiz ABSOLUTA> <salida.json>');
  process.exit(2);
}
const TEST = 'tests/scrum811c-skill-ui-declarada.test.mjs';
const MOTOR = 'tests/_skill-ui-por-efecto.mjs';
const REGISTRO_REAL = 'docs/master/SCRUM-910.md';
const NL = String.fromCharCode(10);

const MUTACIONES = [
  // ── el motor: quien decide que es interfaz y de quien es cada entrada ──
  { id: 'M1', que: 'un .html deja de contar como interfaz', f: MOTOR,
    de: 'export const RE_UI = /^public\\/.+\\.(js|css|html)$/;', a: 'export const RE_UI = /^public\\/.+\\.(js|css)$/;',
    cae: 'DE PUNTA A PUNTA' },
  { id: 'M2', que: 'tocar la interfaz ya no obliga a nada (el defecto del ticket, entero)', f: MOTOR,
    de: "if (!unidad.ui.length) return { veredicto: 'NO_ES_INTERFAZ'", a: "if (unidad.ui.length < 99) return { veredicto: 'NO_ES_INTERFAZ'",
    cae: 'EL CASO QUE SE VIO' },
  { id: 'M3', que: 'un clon somero se mide como si trajera la cadena', f: MOTOR,
    de: "if (somero !== 'false') {", a: "if (somero === 'nunca') {",
    cae: 'DE PUNTA A PUNTA' },
  { id: 'M4', que: 'la declaracion de una entrada ajena que el PR solo rozo lo salva', f: MOTOR,
    de: "return nacidas.length ? { entradas: nacidas, como: 'nacidas' } : { entradas: tocadas, como: 'tocadas' };",
    a: "return { entradas: [...nacidas, ...tocadas], como: 'nacidas' };",
    cae: 'a un PR lo salvan SUS entradas' },
  { id: 'M5', que: 'una linea en blanco basta para atribuir una entrada', f: MOTOR,
    de: 'const LARGA = 30;', a: 'const LARGA = 0;',
    cae: 'lo que no sé clasificar CAE' },
  { id: 'M6', que: 'el corte deja de aplicarse: entra toda la historia', f: MOTOR,
    de: '`--since-as-filter=${corteInstante}`];', a: "'--since-as-filter=2000-01-01T00:00:00Z'];",
    cae: 'DE PUNTA A PUNTA' },
  { id: 'M7', que: 'lo que aun no esta rastreado no cuenta como cambio de la rama', f: MOTOR,
    de: 'const todos = [...new Set([...cambiados, ...sueltos])];', a: 'const todos = [...new Set(cambiados)];',
    cae: 'DE PUNTA A PUNTA' },
  { id: 'M8', que: 'el lector de parches no sale nunca de la cabecera: no lee ninguna linea', f: MOTOR,
    de: 'enCabecera = false;', a: 'enCabecera = true;',
    cae: 'AUTOPRUEBA: los lectores' },
  { id: 'M9', que: 'tienen que declarar TODAS las entradas del PR, no una', f: MOTOR,
    de: 'entradas.some((e) => declara(e.cuerpo))', a: 'entradas.every((e) => declara(e.cuerpo))',
    cae: 'a un PR lo salvan SUS entradas' },
  { id: 'M10', que: 'sin base resuelta se sigue adelante (y con base, se declara ciego)', f: MOTOR,
    de: '  if (!base) {', a: '  if (base) {',
    cae: 'SUELO: la cadena de primer padre' },
  // ── el juicio: la lista cerrada ──
  { id: 'J1', que: 'la lista admite altas posteriores al techo (la escapatoria)', f: TEST,
    de: 'posicion.get(sha) < posicion.get(techo)', a: 'posicion.get(sha) > 9e9',
    cae: 'la lista de heredadas no admite altas' },
  { id: 'J2', que: 'la lista puede pasar de su tope', f: TEST,
    de: 'if (heredadas.length > tope) {', a: 'if (heredadas.length > tope + 99) {',
    cae: 'la lista de heredadas no admite altas' },
  { id: 'J3', que: 'una heredada que ya declara se queda en la lista sin que nadie lo diga', f: TEST,
    de: "if (u.v.veredicto === 'SIN_DECLARAR') { vivas++; continue; }", a: "if (u.v.veredicto !== 'NO_SE') { vivas++; continue; }",
    cae: 'la lista de heredadas no admite altas' },
  { id: 'J4', que: 'lo que no declara y esta fuera de la lista deja de acusarse', f: TEST,
    de: "u.v.veredicto === 'SIN_DECLARAR' && !enLista.has(u.id)", a: "u.v.veredicto === 'SIN_DECLARAR' && enLista.has(u.id)",
    cae: 'la lista de heredadas no admite altas' },
  { id: 'J5', que: 'lo que cambia la rama deja de juzgarse', f: TEST,
    de: "const enCurso = pendiente && pendiente.v.veredicto !== 'NO_ES_INTERFAZ' ? [pendiente] : [];", a: 'const enCurso = [];',
    cae: 'la lista de heredadas no admite altas' },
  { id: 'J6', que: 'la linea de la cuenta cambia N por M', f: TEST,
    de: 'exigí la skill a ${j.N} de ${j.M} registros', a: 'exigí la skill a ${j.M} de ${j.N} registros',
    cae: 'la línea de la cuenta sale SIEMPRE' },
  // ── sobre el ARBOL REAL: el que decide ──
  { id: 'A1', que: 'un PR real de interfaz que no declara, FUERA de la lista (la violacion de verdad)', f: TEST,
    de: "  'a5b62893c7616ddd19626afe5921eec67c691e9e', // 2026-10-01 · SCRUM-1102.md" + NL, a: '',
    cae: 'todo PR que cambia public/ declara la skill' },
  { id: 'A2', que: 'un registro real de la lista pasa a declarar: la lista tiene que encoger diciendolo', f: REGISTRO_REAL,
    de: '# SCRUM-910c · ① decidido (B) y aplicado — J2, traspaso de Luis' + NL,
    a: '# SCRUM-910c · ① decidido (B) y aplicado — J2, traspaso de Luis' + NL + NL + '**Skill UI:** cargada' + NL,
    cae: 'todo PR que cambia public/ declara la skill' },
];

const sha = (t) => crypto.createHash('sha256').update(t).digest('hex');
const abs = (rel) => path.join(RAIZ, rel);

/** Corre el fichero del guard con el entorno limpio (SCRUM-1308) y devuelve los tests caidos. */
function correr() {
  const tap = path.join(os.tmpdir(), `scrum1340-mutar-${process.pid}.tap`);
  try { fs.rmSync(tap, { force: true }); } catch { /* no estaba */ }
  const env = { ...process.env };
  for (const k of ['NODE_TEST_CONTEXT', 'NODE_OPTIONS', 'FORCE_COLOR']) delete env[k];
  const r = spawnSync(process.execPath, ['--test', '--test-force-exit', '--test-reporter=tap',
    `--test-reporter-destination=${tap}`, TEST], { cwd: RAIZ, env, encoding: 'utf8' });
  const texto = fs.existsSync(tap) ? fs.readFileSync(tap, 'utf8') : '';
  fs.rmSync(tap, { force: true });
  const lineas = texto.split(NL);
  const pasan = lineas.filter((l) => /^ok \d+ /.test(l)).length;
  const caidos = lineas.filter((l) => /^not ok \d+ /.test(l)).map((l) => l.replace(/^not ok \d+ - /, ''));
  return { salida: r.status, pasan, caidos };
}

const traza = [];
const decir = (l) => { traza.push(l); console.log(l); };

const base = correr();
decir(`BASE · salida ${base.salida} · pasan ${base.pasan} · caen ${base.caidos.length}`);
if (base.salida !== 0 || base.caidos.length || base.pasan === 0) {
  decir('CIEGO: la base no sale entera en verde. No se muta nada.');
  fs.writeFileSync(SALIDA, JSON.stringify({ ciego: true, base, traza }, null, 1));
  process.exit(2);
}

const filas = [];
for (const m of MUTACIONES) {
  const original = fs.readFileSync(abs(m.f), 'utf8');
  const veces = original.split(m.de).length - 1;
  if (veces !== 1) {
    filas.push({ id: m.id, que: m.que, veredicto: 'CIEGA', motivo: `el ancla aparece ${veces} veces en ${m.f}` });
    decir(`${m.id} · CIEGA · el ancla aparece ${veces} veces en ${m.f}`);
    continue;
  }
  const mutado = original.replace(m.de, () => m.a);
  let r;
  try {
    fs.writeFileSync(abs(m.f), mutado);
    r = correr();
  } finally {
    fs.writeFileSync(abs(m.f), original);
  }
  const vuelto = sha(fs.readFileSync(abs(m.f), 'utf8')) === sha(original);
  const cayoElDeclarado = r.caidos.some((n) => n.includes(m.cae));
  const veredicto = (r.pasan + r.caidos.length) === 0 ? 'CIEGA'
    : cayoElDeclarado ? 'CAZADA' : r.caidos.length ? 'OTRA' : 'MUDA';
  filas.push({ id: m.id, que: m.que, f: m.f, veredicto, cae: m.cae, pasan: r.pasan, caidos: r.caidos, cambio: mutado !== original, vuelto });
  decir(`${m.id} · ${veredicto} · pasan ${r.pasan} · caen ${r.caidos.length} · restaurado ${vuelto ? 'si' : 'NO'} · ${m.que}`);
  for (const c of r.caidos) decir(`      cae: ${c.slice(0, 150)}`);
  if (!vuelto) { decir('PARO: un fichero no ha vuelto a su contenido. Mira el arbol antes de seguir.'); break; }
}

const despues = correr();
decir(`BASE DESPUES · salida ${despues.salida} · pasan ${despues.pasan} · caen ${despues.caidos.length}`);
const cuenta = filas.reduce((a, f) => { a[f.veredicto] = (a[f.veredicto] || 0) + 1; return a; }, {});
decir(`TOTAL · ${filas.length} de ${MUTACIONES.length} mutaciones corridas · ${JSON.stringify(cuenta)}`);
fs.writeFileSync(SALIDA, JSON.stringify({ base, despues, cuenta, filas }, null, 1));
fs.writeFileSync(SALIDA.replace(/\.json$/, '-traza.txt'), traza.join(NL) + NL);
process.exit(filas.every((f) => f.veredicto === 'CAZADA') && filas.length === MUTACIONES.length && despues.salida === 0 ? 0 : 1);
