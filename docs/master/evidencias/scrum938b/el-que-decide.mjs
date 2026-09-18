// docs/master/evidencias/scrum938b/el-que-decide.mjs — SCRUM-938 fase b
//
// ═════════════════════════════════════════════════════════════════════════════════════════════
// 🔴 ¿LOS 8 CONFIRMADOS DE CLASE (a) SON FIXTURES ATADOS A LA LISTA, O GUARDS QUE FUNCIONAN?
//
// El censo de SCRUM-938 confirmaba un par cuando, al vaciar la lista en una copia, el test caía.
// Eso no separa dos cosas que se parecen mucho y significan lo contrario:
//
//   · EL DEFECTO — un caso SINTÉTICO cuya entrada se copió de la lista. Al vaciarla se queda sin
//     sujeto, y su fallo nombra el FIXTURE.
//   · EL GUARD FUNCIONANDO — un caso que mira el ÁRBOL REAL. Al vaciar la lista sin arreglar el
//     árbol, la excepción real queda sin declarar y el guard CAE NOMBRÁNDOLA. Eso es lo que tiene
//     que hacer: «arreglarlo» con un banco fabricado le quitaría el árbol real (regla 41).
//
// Así que aquí cada par lleva DECLARADO qué elemento REAL tiene que nombrar su fallo, y se
// comprueba corriendo. Si un fallo no lo nombra, el par NO se absuelve: sale en rojo.
//
// Y dos controles que al censo le faltaban:
//   ② LA COPIA IDÉNTICA — la sonda vive en `tests/`, que es el árbol que varios guards barren. Si
//     la copia SIN vaciar ya cae, el «confirmado» lo produce la sonda, no la lista.
//   ③ LA FORMA ③ SOBRE LA PROPIA DECLARACIÓN — `Object.freeze({ 'x': 1 })` pone una llamada encima
//     de los literales de la lista, y la forma ③ contaba cualquier literal con una llamada encima.
//
// ⛔ NO TOCA NINGUNA LISTA REAL NI NINGÚN TEST: todo se hace sobre copias en `tests/`, con el mismo
// prefijo de nombre que no acaba en `.test.mjs`, y se borran en `finally` con verificación.
//
//   node docs/master/evidencias/scrum938b/el-que-decide.mjs
//
// Salida: 0 lo medido cuadra con lo declarado · 1 algún par no nombra lo que debía · 2 CIEGO
// ═════════════════════════════════════════════════════════════════════════════════════════════
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { censar } from '../../../../scripts/censo-lista-como-fixture.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
const ts = createRequire(path.join(RAIZ, 'package.json'))('typescript');

/**
 * Los 8 pares confirmados como (a) el 18-sep-2026, y el elemento REAL que su fallo tiene que
 * nombrar al vaciar la lista. Sale de leer cada caso que cae; aquí se comprueba corriendo.
 */
const CLASE_A_Y_LO_QUE_NOMBRAN = [
  ['tests/scrum405-descarga-verificada.test.mjs', 'EXCEPCIONES', 'settingsView.js:', 'guard sobre el árbol real: el `.blob()` de settingsView queda sin amparo'],
  ['tests/scrum419-ci-declara-lo-que-no-corre.test.mjs', 'GATEADOS_DECLARADOS', '"scrum324-cadena-hasta-el-libro.test.mjs":2', 'trinquete (c): el inventario REAL de gateados contra el declarado'],
  ['tests/scrum491-metodo-y-registro.test.mjs', 'A_MANO_SIN_METODO', 'ESCÁNER CIEGO: sin facturas marcadas a mano SIN método', 'NO es una lista de excepciones: es un banco YA fabricado, y su suelo avisa de que está vacío'],
  ['tests/scrum497-dato-personal-no-sobrevive.test.mjs', 'FUERA_DE_ANONIMIZADO', 'product.name', 'guard sobre el esquema real: `product.name` queda sin clasificar'],
  ['tests/scrum497-dato-personal-no-sobrevive.test.mjs', 'SIN_DECIDIR', 'teamMember.name', 'guard sobre el esquema real + trinquete (c) de quince'],
  ['tests/scrum624b-guardado-vs-impreso.test.mjs', 'DIVERGENCIAS_DECLARADAS', 'IMPRESO EN EL PAPEL: 36,26', 'guard sobre el PDF real: la divergencia existe y queda sin declarar'],
  ['tests/scrum629-telefono-que-no-se-destruye.test.mjs', 'RECORTES_DECLARADOS', 'tests/scrum578-duplicados-identificador.test.mjs', 'guard sobre el árbol real: el recorte de scrum578 queda sin declarar'],
  ['tests/scrum644-trinquete-mensaje-crudo.test.mjs', 'CENSO_HEREDADO', 'public/dashboard/js/albaranDetailView.js:', 'trinquete (c) de techos sobre el dashboard real'],
];

const sonda = () => path.join(RAIZ, 'tests', `_938b-sonda-${process.pid}.mjs`);

/** Corre `contenido` como una copia en `tests/` —donde la pone el censo— y la borra. */
function correrCopia(contenido) {
  const copia = sonda();
  try {
    fs.writeFileSync(copia, contenido);
    const r = spawnSync(process.execPath, ['--test', '--test-force-exit', '--test-reporter=tap',
      path.relative(RAIZ, copia).replace(/\\/g, '/')], { cwd: RAIZ, encoding: 'utf8' });
    const total = Number((r.stdout.match(/^# tests (\d+)/m) || [])[1] || 0);
    const bloques = r.stdout.split(/\n(?=\s*(?:not )?ok \d+ - )/).filter((b) => /^\s*not ok/.test(b));
    const caen = bloques.map((b) => ({
      nombre: (b.match(/not ok \d+ - (.+)/) || [])[1] || '?',
      mensaje: ((b.match(/error: ([\s\S]*?)\n\s+code:/) || [])[1] || '').replace(/\s+/g, ' '),
    }));
    return { total, caen };
  } finally {
    try { fs.unlinkSync(copia); } catch { /* ya no está */ }
    if (fs.existsSync(copia)) console.error('🔴 NO SE PUDO BORRAR LA SONDA: ' + copia);
  }
}

/** La misma sustitución que `decidirVaciando`: el inicializador de la lista pasa a `[]`. */
function vaciar(fuente, nombre) {
  const sf = ts.createSourceFile('x.mjs', fuente, ts.ScriptTarget.Latest, true);
  let rango = null;
  const v = (n) => {
    if (!rango && ts.isVariableDeclaration(n) && n.name.getText() === nombre && n.initializer) {
      rango = { ini: n.initializer.getStart(), fin: n.initializer.getEnd() };
    }
    ts.forEachChild(n, v);
  };
  v(sf);
  return rango ? fuente.slice(0, rango.ini) + '[]' + fuente.slice(rango.fin) : null;
}

/** Líneas [inicio, fin] de la declaración de `nombre`. */
function lineasDeLaDeclaracion(fuente, nombre) {
  const sf = ts.createSourceFile('x.mjs', fuente, ts.ScriptTarget.Latest, true);
  let out = null;
  const v = (n) => {
    if (!out && ts.isVariableDeclaration(n) && n.name.getText() === nombre && n.initializer) {
      out = [n.getStart(), n.getEnd()].map((p) => sf.getLineAndCharacterOfPosition(p).line + 1);
    }
    ts.forEachChild(n, v);
  };
  v(sf);
  return out;
}

// ── POBLACIÓN ─────────────────────────────────────────────────────────────────────────────────
const censo = censar();
console.log('═══ SCRUM-938 fase b · EL QUE DECIDE ═══\n');
console.log(`POBLACIÓN · ${censo.listas} listas · ${censo.examinados} pares examinados · ${censo.acusados.length} candidatos`);
if (!censo.listas || !censo.acusados.length) {
  console.log('🔴 CIEGO · el censo no ve listas o no ve candidatos: nada de lo de abajo significaría algo.');
  process.exit(2);
}
const claseA = censo.acusados.filter((a) => a.clase === '(a) MIENTE');
console.log(`           ${claseA.length} candidatos de clase (a) según el censo\n`);

let fallosDeLoDeclarado = 0;
let noNombranLoReal = 0;

// ── ① CADA PAR DE CLASE (a): ¿QUÉ NOMBRA SU FALLO AL VACIAR LA LISTA? ────────────────────────
console.log('① AL VACIAR LA LISTA, ¿EL FALLO NOMBRA UN FIXTURE O UN ELEMENTO REAL?\n');
for (const [test, lista, debeNombrar, lectura] of CLASE_A_Y_LO_QUE_NOMBRAN) {
  const original = fs.readFileSync(path.join(RAIZ, test), 'utf8');
  const vaciado = vaciar(original, lista);
  if (!vaciado || vaciado === original) {
    console.log(`🔴 ${test} · \`${lista}\`: no se pudo vaciar — el par ya no es el que se leyó`);
    fallosDeLoDeclarado++;
    continue;
  }
  const r = correrCopia(vaciado);
  // A21: una cobaya que no se ejecuta da el mismo resultado que un arreglo perfecto.
  if (!r.total) {
    console.log(`🔴 ${test} · \`${lista}\`: la copia no ejecutó NI UN caso — no ha medido nada`);
    fallosDeLoDeclarado++;
    continue;
  }
  const nombra = r.caen.some((c) => c.mensaje.includes(debeNombrar));
  if (!nombra) { fallosDeLoDeclarado++; noNombranLoReal++; }
  console.log(`${nombra ? '✅' : '🔴'} ${test} · \`${lista}\` · caen ${r.caen.length} de ${r.total}`);
  console.log(`     ${nombra ? 'nombra' : 'NO NOMBRA'} ${JSON.stringify(debeNombrar)} → ${lectura}`);
  for (const c of r.caen) console.log(`       ✗ ${c.nombre.slice(0, 110)}`);
}

// ── ② LA COPIA IDÉNTICA: ¿CAE SIN VACIAR NADA? ───────────────────────────────────────────────
console.log('\n② LA COPIA IDÉNTICA · si cae sin vaciar nada, su «confirmado» lo produjo la sonda\n');
const decidibles = [...new Set(censo.acusados.filter((a) => a.declaradaEn === a.test).map((a) => a.test))];
const caenSinVaciar = [];
let sinCasos = 0;
for (const rel of decidibles) {
  const r = correrCopia(fs.readFileSync(path.join(RAIZ, rel), 'utf8'));
  if (!r.total) sinCasos++;
  if (r.caen.length) {
    caenSinVaciar.push(rel);
    console.log(`🔴 CAE SIN VACIAR  ${rel} (${r.caen.length} de ${r.total})`);
    console.log(`     └ ${(r.caen[0].mensaje || r.caen[0].nombre).slice(0, 170)}`);
  }
}
const paresAfectados = censo.acusados.filter((a) => caenSinVaciar.includes(a.test)).length;
console.log(`\n   ${decidibles.length} ficheros decidibles · ${decidibles.length - caenSinVaciar.length} copias limpias · `
  + `${caenSinVaciar.length} caen sin vaciar (${paresAfectados} pares) · ${sinCasos} sin ningún caso`);
if (sinCasos) {
  console.log('🔴 hay copias que no ejecutaron NI UN caso: ese «limpia» no ha medido nada.');
  fallosDeLoDeclarado++;
}

// ── ③ LA FORMA ③ SOBRE LA PROPIA DECLARACIÓN ─────────────────────────────────────────────────
console.log('\n③ ¿CUÁNTAS PRUEBAS DE LA FORMA ③ SON LITERALES DE LA PROPIA DECLARACIÓN?\n');
const autodeclaracion = (a) => {
  const tres = a.pruebas.filter((p) => p.startsWith('literal '));
  if (!tres.length || a.declaradaEn !== a.test) return null;
  const decl = lineasDeLaDeclaracion(fs.readFileSync(path.join(RAIZ, a.test), 'utf8'), a.lista);
  const lineas = tres.map((p) => Number((p.match(/línea (\d+)\)$/) || [])[1]));
  return { todas: !!decl && lineas.every((l) => l >= decl[0] && l <= decl[1]), decl, lineas };
};

// Control del propio detector, sobre dos pares cuya respuesta se conoce leyendo el fuente:
//   · scrum405 · EXCEPCIONES — su única ③ es el literal de la declaración (línea 50) → SÍ
//   · scrum413 · TIPOS_DECLARADOS — sus ③ son 'F1'/'R1' pasados a una llamada fuera → NO
const ctl = (test, lista) => censo.acusados.find((a) => a.test === test && a.lista === lista);
const positivo = ctl('tests/scrum405-descarga-verificada.test.mjs', 'EXCEPCIONES');
const negativo = ctl('tests/scrum413-tipo-factura-cerrado.test.mjs', 'TIPOS_DECLARADOS');
if (!positivo || !negativo || !autodeclaracion(positivo)?.todas || autodeclaracion(negativo)?.todas !== false) {
  console.log('🔴 CIEGO · el detector de autodeclaración no discrimina sus dos controles conocidos.');
  process.exit(2);
}
console.log('   control ✅ scrum405·EXCEPCIONES sale como autodeclaración · scrum413·TIPOS_DECLARADOS no\n');

let conTres = 0; let soloAuto = 0;
const cambios = {};
for (const a of censo.acusados) {
  if (!a.pruebas.some((p) => p.startsWith('literal '))) continue;
  conTres++;
  const d = autodeclaracion(a);
  if (!d?.todas) continue;
  soloAuto++;
  const resto = a.formas.filter((f) => !f.startsWith('③')).length;
  const sin = resto === 0 ? 'LIMPIO' : (resto >= 2 ? '(a) MIENTE' : '(b) DEGRADA');
  cambios[`${a.clase} → ${sin}`] = (cambios[`${a.clase} → ${sin}`] || 0) + 1;
}
console.log(`   ${censo.acusados.length} candidatos · ${conTres} con forma ③ · ${soloAuto} cuya ③ es SÓLO su propia declaración`);
for (const [k, n] of Object.entries(cambios)) console.log(`     al quitarla: ${k} · ${n}`);

// ── VEREDICTO ──────────────────────────────────────────────────────────────────────────────────
console.log('\nVEREDICTO');
console.log(`  pares (a) cuyo fallo nombra un elemento REAL o su propio banco: `
  + `${CLASE_A_Y_LO_QUE_NOMBRAN.length - noNombranLoReal} de ${CLASE_A_Y_LO_QUE_NOMBRAN.length}`);
console.log(`  fixtures de clase (a) que sustituir por banco fabricado: ${noNombranLoReal} de `
  + `${CLASE_A_Y_LO_QUE_NOMBRAN.length} (los que NO nombran lo real)`);
console.log(`  copias sin ningún caso: ${sinCasos} · pares cuyo «confirmado» lo produce la sonda: ${paresAfectados}`);
process.exit(fallosDeLoDeclarado ? 1 : 0);
