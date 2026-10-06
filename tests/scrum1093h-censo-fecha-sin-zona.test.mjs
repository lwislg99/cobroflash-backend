// tests/scrum1093h-censo-fecha-sin-zona.test.mjs — SCRUM-1093h
//
// ═════════════════════════════════════════════════════════════════════════════════════════════
// LA RED DE `scripts/_censo-fecha-sin-zona.mjs`: que siga viendo lo que promete ver, por TIPO y
// no por nombre, y que la clasificación de USO no deje pasar muda una llamada nueva.
// ═════════════════════════════════════════════════════════════════════════════════════════════
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import {
  RAIZ, censar, censarPrograma, programaDe, raizMedible, USO, RETIRADAS, clasifica, acusada, AGREGADO, NUMERA,
} from '../scripts/_censo-fecha-sin-zona.mjs';
import { temporal } from './_temporal.mjs';
import { casosEscritos } from './_casos-escritos.mjs';

const deGit = (sha, ruta) => execFileSync('git', ['show', `${sha}:${ruta}`], { cwd: RAIZ, encoding: 'utf8', maxBuffer: 1 << 24 });

// ═════════════════════════════════════════════════════════════════════════════════════════════
// ① SUELO — sobre el árbol de verdad, no fabricado. `guards:entrada` corre esto: tiene que ser
// rápido comparado con compilar 304 ficheros, así que aquí se mide el árbol REAL una sola vez.
// ═════════════════════════════════════════════════════════════════════════════════════════════

const REAL = censar('.');

test('SCRUM-1093h · SUELO: el censo ve población, ve familia y distingue (no acusa a todo)', () => {
  assert.ok(REAL.ficheros > 250, `🔴 población sospechosamente pequeña: ${REAL.ficheros} ficheros`);
  assert.ok(REAL.filas.length > 0, '🔴 CIEGO: cero llamadas de la familia sobre un árbol que las tiene.');
  const acusadas = REAL.filas.filter(acusada);
  const limpias = REAL.filas.filter((f) => !acusada(f));
  assert.ok(acusadas.length > 0, '🔴 CIEGO: cero acusadas — o el árbol se curó entero, o el detector no distingue.');
  assert.ok(limpias.length > 0, '🔴 acusa a TODO: si no hay ninguna AGREGADO, el detector no está mirando el uso.');
});

// ═════════════════════════════════════════════════════════════════════════════════════════════
// ② EL RATCHET — ninguna fila del censo real puede quedar SIN clasificar. Una identidad nueva
// que el `USO` no conoce es CIEGA para el mapa (aunque el TIPO la haya visto bien), y eso es
// justo lo que fuerza a alguien a mirarla y escribir su clase — no a que pase muda.
// ═════════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-1093h · 🔴 RATCHET: toda fila del censo real tiene una entrada en `USO`', () => {
  const sinClasificar = REAL.filas.filter((f) => clasifica(f) === null);
  assert.deepEqual(sinClasificar.map((f) => `${f.identidad} (${f.fichero}:${f.linea}, ${f.metodo})`), [],
    '🔴 LLAMADA NUEVA SIN CLASIFICAR — no numera ni guarda automáticamente por defecto: alguien '
    + 'tiene que decidir su clase en `USO` (NUMERA/GUARDA/IMPRIME/REFERIDO/AGREGADO) y escribir '
    + 'por qué. Si de verdad NUMERA o GUARDA: derivar el año/mes/día con `diaNaturalEn(fecha, '
    + 'zonaDelMerchant(merchant))` de `src/core/zonaDelMerchant.ts`, en la MISMA transacción que '
    + 'lee al merchant (patrón de SCRUM-1093/f/g).');
});

test('SCRUM-1093h · toda entrada `USO` con uso ≠ AGREGADO sigue viva en el censo, o está en `RETIRADAS`', () => {
  const vivas = new Set(REAL.filas.map((f) => f.identidad));
  const desaparecidas = [...USO.entries()]
    .filter(([id, v]) => v.uso !== AGREGADO && !vivas.has(id) && !RETIRADAS.has(id));
  assert.deepEqual(desaparecidas.map(([id]) => id), [],
    '🔴 Una identidad declarada como NUMERA/GUARDA/IMPRIME/REFERIDO ya no aparece en el censo y '
    + 'NO está en `RETIRADAS`. Si se arregló: mover la entrada a `RETIRADAS` con su commit '
    + '(regla 41 — mejorar se declara, no desaparece en silencio). Si no se arregló, el censo se '
    + 'ha quedado CIEGO para ella: sospechar del detector antes de sospechar del código.');
});

test('SCRUM-1093h · ninguna entrada de `RETIRADAS` ha vuelto a aparecer en el censo', () => {
  const vivas = new Set(REAL.filas.map((f) => f.identidad));
  const resucitadas = [...RETIRADAS].filter((id) => vivas.has(id));
  assert.deepEqual(resucitadas, [],
    '🔴 Una identidad RETIRADA (se declaró arreglada) ha vuelto a depender de la zona del '
    + 'proceso: o el arreglo se revirtió, o el censo la ve por un motivo distinto al que la hizo '
    + 'RETIRARSE. Cualquiera de los dos es un hallazgo, no un ruido a callar.');
});

// ═════════════════════════════════════════════════════════════════════════════════════════════
// ③ 🔴 CONTROLES POSITIVOS REALES — el código histórico de los tres arreglos de esta misma
// familia, leído de git tal cual existió, no reconstruido. Cada uno tiene que acusarse ANTES del
// arreglo (misma forma que las NUMERA vivas hoy) y quedar LIMPIO en HEAD (control negativo
// DERIVADO: el mismo fichero, el estado real de hoy — no un segundo texto que pueda divergir).
// ═════════════════════════════════════════════════════════════════════════════════════════════

const HISTORICOS = [
  {
    nombre: 'quoteNumber.service.ts (SCRUM-1093, a0f454f3)',
    ruta: 'src/modules/quotes/domain/quoteNumber.service.ts',
    antesDe: 'a0f454f3',
  },
  {
    nombre: 'albaranNumber.service.ts (SCRUM-1093f, f0ff43df)',
    ruta: 'src/modules/jobs/domain/albaranNumber.service.ts',
    antesDe: 'f0ff43df',
  },
  {
    nombre: 'partes.routes.ts (SCRUM-1093g, 5cb43c1c)',
    ruta: 'src/modules/jobs/app/routes/partes.routes.ts',
    antesDe: '5cb43c1c',
  },
];

const casoa = casosEscritos(HISTORICOS, (h) => `SCRUM-1093h · 🔴 ③ CONTROL POSITIVO REAL: ${h.nombre} se acusaba ANTES del arreglo`, (h) => {
  const abs = path.join(RAIZ, h.ruta);
  const viejo = deGit(`${h.antesDe}^`, h.ruta);
  const program = programaDe([abs], new Map([[abs, viejo]]));
  const filas = censarPrograma(program, [h.ruta]);
  assert.ok(filas.length > 0,
    `🔴 EL CENSO NO VE EL DEFECTO QUE LO ORIGINÓ en ${h.ruta}@${h.antesDe}^: esperaba al menos `
    + 'una llamada get*/set*/toLocale* sobre un receptor `Date`.');
  assert.ok(filas.some((f) => f.clase === 'GET_SET'),
    `🔴 esperaba un get*/set* (el patrón \`.getFullYear()\` del año de la serie), y salió: ${JSON.stringify(filas)}`);
});
const casob = casosEscritos(HISTORICOS, (h) => `SCRUM-1093h · CONTROL NEGATIVO DERIVADO: ${h.nombre} en HEAD ya no se acusa`, (h) => {
  const filas = REAL.filas.filter((f) => f.fichero === h.ruta);
  assert.deepEqual(filas, [],
    `🔴 FALSO POSITIVO sobre código ya arreglado: ${h.ruta} sigue dando llamadas de la familia `
    + `en HEAD: ${JSON.stringify(filas)}. El arreglo usa diaNaturalEn(fecha, zonaDelMerchant(m)) `
    + 'y no debería dejar ningún get*/set*/toLocale* sin zona sobre la fecha de la serie.');
});
test('SCRUM-1093h · 🔴 ③ CONTROL POSITIVO REAL: quoteNumber.service.ts (SCRUM-1093, a0f454f3) se acusaba ANTES del arreglo', casoa(0));
test('SCRUM-1093h · CONTROL NEGATIVO DERIVADO: quoteNumber.service.ts (SCRUM-1093, a0f454f3) en HEAD ya no se acusa', casob(0));
test('SCRUM-1093h · 🔴 ③ CONTROL POSITIVO REAL: albaranNumber.service.ts (SCRUM-1093f, f0ff43df) se acusaba ANTES del arreglo', casoa(1));
test('SCRUM-1093h · CONTROL NEGATIVO DERIVADO: albaranNumber.service.ts (SCRUM-1093f, f0ff43df) en HEAD ya no se acusa', casob(1));
test('SCRUM-1093h · 🔴 ③ CONTROL POSITIVO REAL: partes.routes.ts (SCRUM-1093g, 5cb43c1c) se acusaba ANTES del arreglo', casoa(2));
test('SCRUM-1093h · CONTROL NEGATIVO DERIVADO: partes.routes.ts (SCRUM-1093g, 5cb43c1c) en HEAD ya no se acusa', casob(2));
casoa.todos();
casob.todos();

// ═════════════════════════════════════════════════════════════════════════════════════════════
// ④ 🔴 EL FALSO POSITIVO REAL — `albaranPdf.service.ts:133`, un `toLocaleString` sobre un
// `number` (`v.toLocaleString('es-ES', { maximumFractionDigits: 2 })`). El censo de SCRUM-1093g
// lo encontró A MANO; este control lo deja escrito para que no haga falta volver a encontrarlo.
// ═════════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-1093h · 🔴 ④ NEGATIVO REAL: `fmtQty` (toLocaleString sobre un número) no se acusa', () => {
  const enElFichero = REAL.filas.filter((f) => f.fichero === 'src/modules/jobs/infra/albaranPdf.service.ts');
  const conNumero = enElFichero.filter((f) => f.linea >= 132 && f.linea <= 134);
  assert.deepEqual(conNumero, [],
    `🔴 FALSO POSITIVO: fmtQty(v: number) usa toLocaleString sobre un NÚMERO, no una fecha, y el `
    + `censo lo acusó igual — por NOMBRE de método en vez de por TIPO del receptor: ${JSON.stringify(conNumero)}`);
  // Y el control de que el propio fichero SÍ tiene familia real cerca (fmtDate, la línea de
  // arriba): si este negativo se cumpliera porque el censo dejó de ver el fichero ENTERO, sería
  // un cero que no ha ganado nada.
  assert.ok(enElFichero.length > 0,
    '🔴 CIEGO: albaranPdf.service.ts no dio NINGUNA fila — el negativo de fmtQty no vale nada si '
    + 'el censo tampoco ve fmtDate/generateAlbaranPdf, que sí son de la familia.');
});

// ═════════════════════════════════════════════════════════════════════════════════════════════
// ⑤ CONTROL POSITIVO FABRICADO + NEGATIVO DERIVADO — casos mínimos, con tipos reales (no un
// truco de texto): prueban que el detector reconoce la familia por SU CUENTA, sin depender de
// que el fichero real exista o siga teniendo esa forma.
// ═════════════════════════════════════════════════════════════════════════════════════════════

const FABRICADO_ABS = path.join(RAIZ, 'src', '__scrum1093h_fabricado__.ts');

const FABRICADO_GET_SET = [
  'export function anioDeLaSerie(fecha: Date): number {',
  '  return fecha.getFullYear();',
  '}',
].join('\n');

const FABRICADO_LOCALE_SIN_ZONA = [
  'export function fechaImpresa(fecha: Date): string {',
  "  return fecha.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' });",
  '}',
].join('\n');

const FABRICADO_LOCALE_CON_ZONA = [
  'export function fechaImpresaConZona(fecha: Date, zona: string): string {',
  "  return fecha.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', timeZone: zona });",
  '}',
].join('\n');

const FABRICADO_NUMERO = [
  'export function importeFormateado(v: number): string {',
  "  return v.toLocaleString('es-ES', { maximumFractionDigits: 2 });",
  '}',
].join('\n');

const FABRICADO_UTC = [
  'export function anioUtc(fecha: Date): number {',
  '  return fecha.getUTCFullYear();',
  '}',
].join('\n');

function censarFabricado(fuente) {
  const program = programaDe([FABRICADO_ABS], new Map([[FABRICADO_ABS, fuente]]));
  return censarPrograma(program, ['src/__scrum1093h_fabricado__.ts']);
}

test('SCRUM-1093h · 🔴 ⑤ FABRICADO positivo: `Date.getFullYear()` con tipo `Date` se acusa', () => {
  const filas = censarFabricado(FABRICADO_GET_SET);
  assert.equal(filas.length, 1, `🔴 no ve la llamada mínima: ${JSON.stringify(filas)}`);
  assert.equal(filas[0].metodo, 'getFullYear');
  assert.equal(filas[0].clase, 'GET_SET');
});

test('SCRUM-1093h · 🔴 ⑤ FABRICADO positivo: `toLocaleDateString` SIN `timeZone` se acusa', () => {
  const filas = censarFabricado(FABRICADO_LOCALE_SIN_ZONA);
  assert.equal(filas.length, 1, `🔴 no ve la llamada mínima: ${JSON.stringify(filas)}`);
  assert.equal(filas[0].clase, 'LOCALE');
});

test('SCRUM-1093h · ⑤ NEGATIVO DERIVADO: el MISMO `toLocaleDateString`, con `timeZone` inline, no se acusa', () => {
  assert.notEqual(FABRICADO_LOCALE_CON_ZONA, FABRICADO_LOCALE_SIN_ZONA);
  const filas = censarFabricado(FABRICADO_LOCALE_CON_ZONA);
  assert.deepEqual(filas, [],
    `🔴 sigue acusando con \`timeZone\` declarado en el propio sitio de la llamada: ${JSON.stringify(filas)}`);
});

test('SCRUM-1093h · ⑤ NEGATIVO DERIVADO: `getUTCFullYear` (explícito) no se acusa', () => {
  const filas = censarFabricado(FABRICADO_UTC);
  assert.deepEqual(filas, [], `🔴 acusa una llamada UTC explícita: ${JSON.stringify(filas)}`);
});

test('SCRUM-1093h · ⑤ NEGATIVO: `toLocaleString` sobre un `number` (mismo nombre, otro tipo) no se acusa', () => {
  const filas = censarFabricado(FABRICADO_NUMERO);
  assert.deepEqual(filas, [],
    `🔴 acusa por el NOMBRE del método en vez de por el TIPO del receptor: ${JSON.stringify(filas)}. `
    + 'Es exactamente el defecto que demuestra el control ④ sobre albaranPdf.service.ts, más arriba en '
    + 'este fichero.');
});

// ═════════════════════════════════════════════════════════════════════════════════════════════
// ⑥ 🔴 SCRUM-1377 · LA RAÍZ ES LA DEL ÁRBOL QUE SE MIDE — y si no se puede determinar, ROJO.
//
// Medido el 1-oct-2026: en un worktree con `node_modules` por junction, la raíz salía de dónde vive
// `typescript` (el árbol de OTRO), y `censar('.')` devolvía 312 ficheros, 0 filas y salida 0. En
// CI no pasa, porque allí `node_modules` es del propio árbol: por eso el caso se FABRICA aquí con
// un árbol que no es el del script, que es la misma situación vista desde el otro lado.
// ═════════════════════════════════════════════════════════════════════════════════════════════

const TSCONFIG_DE_LA_CASA = fs.readFileSync(path.join(RAIZ, 'tsconfig.json'), 'utf8');

/**
 * Un árbol mínimo, FUERA del repositorio. Todo lo que se crea, se crea AQUÍ y colgando a la vista
 * del `temporal()` (SCRUM-824): `tsconfig` es su texto o `null` para no ponerlo, `src` dice si existe
 * la carpeta, y `fuente` es el texto de `src/serie.ts` o `null` para dejarla vacía.
 */
function arbolFabricado({ fuente = null, tsconfig = TSCONFIG_DE_LA_CASA, src = true } = {}) {
  const dir = temporal('yaqu-1377-');
  if (tsconfig !== null) fs.writeFileSync(path.join(dir, 'tsconfig.json'), tsconfig);
  if (src) fs.mkdirSync(path.join(dir, 'src'));
  if (src && fuente !== null) fs.writeFileSync(path.join(dir, 'src', 'serie.ts'), fuente);
  return dir;
}

test('SCRUM-1377 · la raíz por defecto es el árbol donde vive el censo, no donde vive `typescript`', () => {
  assert.equal(path.resolve(RAIZ), path.resolve(import.meta.dirname, '..'),
    '🔴 la RAÍZ del censo no es la del árbol de este test: está midiendo otro árbol.');
  assert.equal(REAL.raiz, path.resolve('.'), '🔴 `censar(".")` no declara como raíz el árbol que se le pidió.');
});

test('SCRUM-1377 · 🔴 `censar(raiz)` mide ESE árbol: uno fabricado fuera del repo da su fila', () => {
  const dir = arbolFabricado({ fuente: FABRICADO_GET_SET });
  const r = censar(dir);
  assert.equal(r.raiz, path.resolve(dir));
  assert.equal(r.ficheros, 1, `población: ${r.ficheros}`);
  assert.deepEqual(r.filas.map((f) => f.identidad), ['src/serie.ts::anioDeLaSerie'],
    '🔴 CIEGO: el censo recibió una raíz y nombró los ficheros contra OTRA — es el defecto de SCRUM-1377: '
    + 'población 1 y cero filas sobre un árbol que tiene la llamada.');
});

test('SCRUM-1377 · NEGATIVO DERIVADO: el mismo árbol fabricado, con la llamada UTC, da cero filas CON población', () => {
  const r = censar(arbolFabricado({ fuente: FABRICADO_UTC }));
  assert.equal(r.ficheros, 1);
  assert.deepEqual(r.filas, []);
});

test('SCRUM-1377 · 🔴 una raíz que no se puede medir LANZA, nunca devuelve 0 filas', () => {
  const sinTsconfig = arbolFabricado({ fuente: FABRICADO_GET_SET, tsconfig: null });
  assert.throws(() => censar(sinTsconfig), /CIEGO.*tsconfig\.json/s);

  const sinSrc = arbolFabricado({ src: false });
  assert.throws(() => censar(sinSrc), /CIEGO.*ninguna de \[src\]/s);
  assert.throws(() => raizMedible(sinSrc), /CIEGO/);

  const srcVacio = arbolFabricado();
  assert.throws(() => censar(srcVacio), /CIEGO.*ni un fichero/s);

  const tsconfigRoto = arbolFabricado({ fuente: FABRICADO_GET_SET, tsconfig: '{ esto no es json' });
  assert.throws(() => censar(tsconfigRoto), /CIEGO.*no pude leer/s);
});

test('SCRUM-1377 · 🔴 un programa nombrado contra una raíz que NO es la suya LANZA (el 0 filas de antes)', () => {
  const dir = arbolFabricado({ fuente: FABRICADO_GET_SET });
  const program = programaDe([path.join(dir, 'src', 'serie.ts')], new Map(), dir);
  assert.equal(censarPrograma(program, null, dir).length, 1, 'control: con SU raíz, el programa da su fila.');
  assert.throws(() => censarPrograma(program, null, RAIZ), /CIEGO.*FUERA de la raíz/s,
    '🔴 un programa de otro árbol, nombrado contra la raíz de éste, devolvió un censo en vez de lanzar: '
    + 'así salían los 312 ficheros y 0 filas.');
});
