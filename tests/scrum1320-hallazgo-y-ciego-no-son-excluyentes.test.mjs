// tests/scrum1320-hallazgo-y-ciego-no-son-excluyentes.test.mjs — SCRUM-1320
//
// Sin gate: ni BD, ni red, ni navegador. Lee `scripts/` y ejecuta dos funciones puras.
//
// ═══════════════════════════════════════════════════════════════════════════════════════════
// UN GUARD QUE ENCUENTRA DEFECTOS Y ADEMÁS SE QUEDA CIEGO NO PUEDE SALIR «NO MEDIDO»
//
// Visto ocurrir, no razonado (el control de SCRUM-1313 que rompe el editor a mano, 1-oct-2026):
// `guard-915g-ajustes-del-justificante.mjs` imprimió sus hallazgos, imprimió un ciego, y salió con
// el código del ciego. La puerta sólo ve el código: lo contó entre los que no midieron.
//
// La cola de la familia decía «si hay ciegos, salgo por ciego; y si no, miro los hallazgos». Trata
// como excluyentes dos estados que conviven. Y darle la vuelta al orden es el mismo defecto con el
// ciego de víctima. Lo que este fichero fija:
//
//   ① la regla, en sus cuatro cuadrantes: el hallazgo da el código y la línea dice las DOS cuentas;
//   ② el control positivo de lo que SCRUM-1313 ganó: sin hallazgos y con un ciego, sigue saliendo
//      por ciego — si todo lo ciego pasara a hallazgo se habría perdido la distinción entera;
//   ③ que la puerta lea esas dos cuentas y las diga en su recuento;
//   ④ el censo: qué guards deciden esto a mano. Los que quedan están DECLARADOS con su motivo, y la
//      lista tiene sus dos mitades — ni entra uno nuevo en silencio, ni se queda una entrada caduca.
// ═══════════════════════════════════════════════════════════════════════════════════════════
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  veredictoDe, leerVeredicto, MARCA_VEREDICTO, SALIDA_VERDE, SALIDA_HALLAZGO, SALIDA_NO_SUPE_MEDIR,
} from '../scripts/_hallazgos-y-ciegos.mjs';
import { recuento, veredicto, cuentasDeLaFila, llegoAMedir } from '../scripts/guards-visuales.mjs';
import { defectosDe } from './_salidas-de-guard.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIR_SCRIPTS = path.join(RAIZ, 'scripts');

// ── ① LA REGLA ─────────────────────────────────────────────────────────────────────────────────

test('SCRUM-1320 · el caso que se vio: hallazgos y un ciego a la vez sale por HALLAZGO y dice las dos cuentas', () => {
  // Las mismas cuentas que dio `guard-915g` con el editor roto. Antes del arreglo salía con el 2.
  const v = veredictoDe({ hallazgos: 5, ciegos: 1 });
  assert.equal(v.codigo, SALIDA_HALLAZGO, 'con hallazgos el código es el del hallazgo, haya ciegos o no');
  assert.equal(v.estado, 'HALLAZGO Y CIEGO');
  assert.match(v.linea, /5 hallazgos · 1 ciego\b/, 'la línea dice las DOS cuentas, no la que ganó');
  assert.match(v.linea, /NO es la lista completa/, 'y avisa de que lo ciego sigue sin juzgar');
});

test('SCRUM-1320 · CONTROL POSITIVO: sin hallazgos y con un ciego sigue saliendo por CIEGO', () => {
  const v = veredictoDe({ hallazgos: 0, ciegos: 1 });
  assert.equal(v.codigo, SALIDA_NO_SUPE_MEDIR, 'un ciego sin hallazgos NO se convierte en hallazgo: es lo que ganó SCRUM-1313');
  assert.equal(v.estado, 'CIEGO');
  assert.match(v.linea, /0 hallazgos · 1 ciego\b/);
  // Y la puerta lo sigue contando donde toca: ese código no es «llegó a medir».
  assert.equal(llegoAMedir(v.codigo), false);
  assert.equal(llegoAMedir(veredictoDe({ hallazgos: 5, ciegos: 1 }).codigo), true);
});

test('SCRUM-1320 · los otros dos cuadrantes: hallazgo limpio y verde', () => {
  const rojo = veredictoDe({ hallazgos: 2, ciegos: 0 });
  assert.equal(rojo.codigo, SALIDA_HALLAZGO);
  assert.equal(rojo.estado, 'HALLAZGO');
  assert.match(rojo.linea, /2 hallazgos · 0 ciegos/, 'el cero también se escribe: un «0 ciegos» dicho es una medición');
  const verde = veredictoDe({ hallazgos: 0, ciegos: 0 });
  assert.equal(verde.codigo, SALIDA_VERDE);
  assert.equal(verde.estado, 'VERDE');
});

test('SCRUM-1320 · admite las tres formas en que los guards llevan la cuenta: lista, número y bandera', () => {
  assert.equal(veredictoDe({ hallazgos: ['a', 'b'], ciegos: ['c'] }).linea, veredictoDe({ hallazgos: 2, ciegos: 1 }).linea);
  assert.equal(veredictoDe({ hallazgos: 0, ciegos: true }).codigo, SALIDA_NO_SUPE_MEDIR);
  assert.equal(veredictoDe({ hallazgos: 3, ciegos: true }).codigo, SALIDA_HALLAZGO);
  assert.equal(veredictoDe({ hallazgos: 0, ciegos: false }).codigo, SALIDA_VERDE);
});

test('SCRUM-1320 · una cuenta que no es una cuenta NO da verde: lanza', () => {
  // `undefined > 0` es `false`: sin esto, un guard que pasara una variable equivocada saldría con 0.
  for (const malo of [undefined, null, NaN, -1, 1.5, '3', {}]) {
    assert.throws(() => veredictoDe({ hallazgos: malo, ciegos: 0 }), TypeError, 'hallazgos = ' + String(malo));
    assert.throws(() => veredictoDe({ hallazgos: 0, ciegos: malo }), TypeError, 'ciegos = ' + String(malo));
  }
  // El control de que el `throws` no pasa por cualquier cosa: las formas buenas no lanzan.
  assert.equal(veredictoDe({ hallazgos: [], ciegos: 0 }).codigo, SALIDA_VERDE);
});

// ── ③ LA PUERTA ────────────────────────────────────────────────────────────────────────────────

test('SCRUM-1320 · lo que el guard escribe es lo que la puerta lee, y manda la ÚLTIMA marca', () => {
  for (const [h, c] of [[5, 1], [0, 1], [1, 0], [12, 30]]) {
    assert.deepEqual(leerVeredicto('ruido\n  ' + veredictoDe({ hallazgos: h, ciegos: c }).linea + '\nmás ruido'), { hallazgos: h, ciegos: c });
  }
  const dos = veredictoDe({ hallazgos: 1, ciegos: 0 }).linea + '\n' + veredictoDe({ hallazgos: 5, ciegos: 1 }).linea;
  assert.deepEqual(leerVeredicto(dos), { hallazgos: 5, ciegos: 1 });
  assert.equal(leerVeredicto('un guard que no dice sus cuentas'), null);
  assert.equal(leerVeredicto(MARCA_VEREDICTO + ' algo que no son cuentas'), null);
});

test('SCRUM-1320 · el recuento de la puerta: el guard del caso visto cuenta como ROJO y dice que dejó casos sin medir', () => {
  const fila = (g, codigo, estado, cuentas) => ({ g, codigo, estado, cuentas, ms: 0, arranque: null, marca: null, salida: '' });
  const visto = veredictoDe({ hallazgos: 5, ciegos: 1 });
  const soloCiego = veredictoDe({ hallazgos: 0, ciegos: 1 });

  const despues = [fila('guard:verde', 0, 'verde', null), fila('guard:ajustes', visto.codigo, 'rojo(1)', leerVeredicto(visto.linea))];
  const c = recuento(despues);
  assert.equal(c.linea, '1 verde · 0 CIEGOS · 1 rojo (1 con casos sin medir)');
  assert.deepEqual([c.verdes, c.ciegos, c.rojos, c.rojosConCiegos], [1, 0, 1, 1]);
  assert.equal(veredicto(despues).codigo, 1, 'la tanda sale por defecto, que es lo que obliga a mirar');

  // CONTROL: el que sólo estuvo ciego sigue en la columna de los ciegos, y la tanda sale por «no medido».
  const control = [fila('guard:verde', 0, 'verde', null), fila('guard:ajustes', soloCiego.codigo, 'CIEGO', leerVeredicto(soloCiego.linea))];
  assert.equal(recuento(control).linea, '1 verde · 1 CIEGO · 0 rojos');
  assert.equal(veredicto(control).codigo, SALIDA_NO_SUPE_MEDIR);

  // Un rojo sin casos ciegos no lleva la coletilla: no se dice de más.
  const limpio = [fila('guard:x', 1, 'rojo(1)', { hallazgos: 2, ciegos: 0 })];
  assert.equal(recuento(limpio).linea, '0 verdes · 0 CIEGOS · 1 rojo');

  assert.equal(cuentasDeLaFila('rojo(1)', { hallazgos: 5, ciegos: 1 }), ' · 5 hallazgos · 1 ciego');
  assert.equal(cuentasDeLaFila('verde', { hallazgos: 0, ciegos: 0 }), '');
  assert.equal(cuentasDeLaFila('rojo(1)', null), '');
});

// ── ④ EL CENSO ─────────────────────────────────────────────────────────────────────────────────

// Las colas, tal como eran y tal como quedan. Son el suelo del detector: si deja de distinguirlas,
// el censo de abajo no dice nada aunque salga limpio.
const COLA_DE_ANTES = `
const hallazgos = []; const ciegos = [];
if (ciegos.length) { console.error('no supe medir'); process.exit(SALIDA_NO_SUPE_MEDIR); }
if (hallazgos.length) { console.error('hallazgos'); process.exit(SALIDA_HALLAZGO); }
`;
const COLA_DE_ANTES_CON_NUMEROS = `
let fallos = 0; let ciego = 0;
if (ciego) { console.error('no supe mirar'); process.exit(2); }
process.exit(fallos === 0 ? 0 : 1);
`;
const COLA_ARREGLADA = `
import { veredictoDe } from './_hallazgos-y-ciegos.mjs';
const hallazgos = []; const ciegos = [];
if (!fs.existsSync('dist')) process.exit(SALIDA_NO_SUPE_MEDIR);
const veredictoFinal = veredictoDe({ hallazgos, ciegos });
if (veredictoFinal.codigo !== 0) process.exit(veredictoFinal.codigo);
`;
const EL_CIEGO_VUELVE_DELANTE = `
import { veredictoDe } from './_hallazgos-y-ciegos.mjs';
let fallos = 0; let ciego = 0;
if (ciego) { process.exit(2); }
const veredictoFinal = veredictoDe({ hallazgos: fallos, ciegos: ciego });
process.exit(veredictoFinal.codigo);
`;
const EL_ORDEN_INVERTIDO = `
import { veredictoDe } from './_hallazgos-y-ciegos.mjs';
const hallazgos = []; const ciegos = [];
if (hallazgos.length) process.exit(SALIDA_HALLAZGO);
const veredictoFinal = veredictoDe({ hallazgos, ciegos });
process.exit(veredictoFinal.codigo);
`;

test('SCRUM-1320 · el detector distingue las colas: caza la de antes, la invertida y el ciego que vuelve delante', () => {
  assert.equal(defectosDe(COLA_DE_ANTES).defectos.length, 1);
  assert.match(defectosDe(COLA_DE_ANTES).defectos[0], /decide a mano/);
  assert.match(defectosDe(COLA_DE_ANTES_CON_NUMEROS).defectos[0], /decide a mano/);
  // «Invertir el orden» no es el arreglo: el hallazgo sale antes de que nadie cuente los ciegos.
  assert.match(defectosDe(EL_ORDEN_INVERTIDO).defectos[0], /sale a mano con el hallazgo/);
  assert.match(defectosDe(EL_CIEGO_VUELVE_DELANTE).defectos[0], /bajo su propia cuenta de ciegos/);
  // Y no se queja de la buena, que conserva una salida de ciego legítima (no hay `dist/`: aún no midió nada).
  assert.deepEqual(defectosDe(COLA_ARREGLADA).defectos, []);
  assert.equal(defectosDe(COLA_ARREGLADA).usaVeredicto, true);
  // Un fichero que no se puede leer es un ciego del censo, no un guard sin defectos.
  assert.equal(typeof defectosDe('if (').ciego, 'string');
  assert.equal(defectosDe(COLA_ARREGLADA).ciego, null);
});

/**
 * Los guards que siguen eligiendo a mano entre «ciego» y «hallazgo», con su motivo y quién lo retira.
 * Uno por línea. No es una lista de permisos: es deuda con nombre, y el test de abajo la mantiene exacta.
 */
const DECIDEN_A_MANO = new Map([
  ['guard-completar-lleva-al-campo.mjs',
    'ORDEN BUENO, escrito a mano desde SCRUM-904 (hallazgo primero, y el ciego se imprime siempre); lo ancla `tests/scrum904`. Lo retira quien lo pase a `veredictoDe`.'],
  ['guard-caja-datos-del-cliente.mjs',
    'OTRA FORMA del mismo defecto, sin arreglar: `noSupeMirar()` ABORTA en el primer ciego y tira los hallazgos acumulados. Pide rehacer el bucle; reportado al orquestador en la entrega de SCRUM-1320 (1-oct-2026).'],
  ['guard-caja-documento-suelto.mjs',
    'OTRA FORMA del mismo defecto, sin arreglar: `noSupeMirar()` ABORTA en el primer ciego y tira los hallazgos acumulados. Reportado con el anterior.'],
  ['guard-portal-en-la-ficha.mjs',
    'OTRA FORMA del mismo defecto, sin arreglar: el primer caso ciego corta el bucle y los hallazgos se calculan después, así que un caso ya medido no se juzga. Reportado con los anteriores.'],
  ['guard-nombres-no-declarados.mjs',
    'NO ES EL DEFECTO: su salida de ciego es `noMedido` del instrumento ENTERO, antes de juzgar nada; no hay hallazgos que tapar. No es de navegador.'],
]);

test('SCRUM-1320 · censo: ningún guard decide a mano entre ciego y hallazgo fuera de los declarados', () => {
  const poblacion = fs.readdirSync(DIR_SCRIPTS).filter((f) => /^guard-.*\.mjs$/.test(f)).sort();
  const leidos = poblacion.map((f) => ({ f, ...defectosDe(fs.readFileSync(path.join(DIR_SCRIPTS, f), 'utf8'), f) }));
  const ilegibles = leidos.filter((r) => r.ciego);
  const conVeredicto = leidos.filter((r) => r.usaVeredicto);
  const conDefecto = leidos.filter((r) => r.defectos.length);
  const cabecera = 'POBLACIÓN: ' + poblacion.length + ' ficheros `scripts/guard-*.mjs`, ' + (leidos.length - ilegibles.length)
    + ' leídos · ' + conVeredicto.length + ' deciden con `veredictoDe` · ' + conDefecto.length + ' deciden a mano.';

  // SUELO: un censo que no ha podido leer no aprueba.
  assert.deepEqual(ilegibles.map((r) => r.f + ' → ' + r.ciego), [], cabecera);
  assert.ok(conVeredicto.some((r) => r.f === 'guard-915g-ajustes-del-justificante.mjs'),
    cabecera + '\n🔴 el detector no ve `veredictoDe` ni en el guard donde se vio el defecto: no está mirando.');

  // MITAD ①: no entra uno nuevo en silencio.
  const sinDeclarar = conDefecto.filter((r) => !DECIDEN_A_MANO.has(r.f));
  assert.deepEqual(sinDeclarar.map((r) => r.f + ' → ' + r.defectos.join(' | ')), [], cabecera
    + '\n🔴 Estos guards eligen ellos entre «no supe medir» y «hallazgo». Con hallazgos Y ciegos a la vez, uno de los dos'
    + '\n   estados desaparece (SCRUM-1320: cinco defectos reales salieron rotulados «no medido»).'
    + '\n   Se arregla sacando el código de `veredictoDe({ hallazgos, ciegos })` (`scripts/_hallazgos-y-ciegos.mjs`),'
    + '\n   que da el código del hallazgo y dice las dos cuentas. No se arregla cambiando el orden de los dos `if`.');

  // MITAD ②: no se queda una entrada que ya no hace falta.
  const caducas = [...DECIDEN_A_MANO.keys()].filter((f) => !conDefecto.some((r) => r.f === f));
  assert.deepEqual(caducas, [], cabecera
    + '\n🔴 Declarados que ya NO deciden a mano (o que ya no existen). Bórralos de DECIDEN_A_MANO: una entrada de más'
    + '\n   es holgura para que ese guard vuelva a la cola vieja sin que esto salte.');
});
