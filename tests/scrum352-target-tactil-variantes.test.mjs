// tests/scrum352-target-tactil-variantes.test.mjs — SCRUM-352, guard estructural, sin gate.
//
// EL CSS CUMPLE LO QUE PROMETE: UNA VARIANTE SUELTA MIDE LO MISMO QUE CON LA BASE.
//
// `styles.css:376-377` dice por escrito que `.btn-primary`/`.btn-secondary`/etc. «también
// funcionan solas». Hasta SCRUM-352 el bump táctil de móvil solo subía `.btn`, así que la frase
// era falsa para 185 sitios del front en 27 ficheros — censados, no estimados. La decisión del
// fundador fue que MANDA EL CSS: el comentario o se cumple o se borra, y borrarlo sería rebajar
// el documento para que cuadre con la implementación.
//
// ── POR QUÉ LA ASERCIÓN ES «SOLA == CON BASE» Y NO «TODAS ≥ 44» ──────────────
// Porque «todas ≥ 44» es falso (los `btn-sm` miden 30 a propósito) y además habría dado VERDE
// al error que casi se cuela: llevar el bump a las variantes sin `:not(.btn-sm)` hacía que
// `btn-primary btn-sm` midiera 44 y su gemelo `btn btn-primary btn-sm` siguiera en 30. Medido en
// navegador antes de escribir nada. La promesa del comentario es de SIMETRÍA, así que la
// simetría es lo que se vigila.
//
// ── LO QUE NO ES UN DEFECTO ─────────────────────────────────────────────────
// El escritorio a 36 px. `DESIGN.md` pide «≥44 px EN MÓVIL»; con ratón, 36 cumple. Que
// SCRUM-368 midiera 36 en escritorio y lo leyera como defecto global es la parte de ese ticket
// que esta medición corrige, y hay un control negativo que se pondría rojo si alguien
// «arreglara» el escritorio por error.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { censarTargetTactil, derivarFamilias, minHeightDe } from './_censo-target-tactil.mjs';
import { parsearReglas, censarClasesDeBoton } from './_censo-anillo-foco.mjs';
import { fuentesDeFront, censarUsosDeBoton, ficherosNoCubiertos } from './_censo-clases-de-boton.mjs';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.join(AQUI, '..');
const HOJA = fs.readFileSync(path.join(RAIZ, 'public/dashboard/css/styles.css'), 'utf8');

const MOVIL = 390;      // iPhone estándar, por debajo del breakpoint de 768
const ESCRITORIO = 1280;

const MOV = censarTargetTactil(HOJA, MOVIL);
const ESC = censarTargetTactil(HOJA, ESCRITORIO);

const REGLAS = parsearReglas(HOJA);
const CLASES = censarClasesDeBoton(REGLAS);
const FUENTES = fuentesDeFront(fs, path, RAIZ);
const USOS = censarUsosDeBoton(FUENTES, CLASES);

// ── 1. SUELOS ───────────────────────────────────────────────────────────────

test('SUELO: el CSS deriva variantes y modificadores', () => {
  const f = derivarFamilias(REGLAS);
  assert.ok(f.variantes.length >= 3, `variantes derivadas: ${JSON.stringify(f.variantes)}`);
  assert.ok(f.modificadores.includes('btn-sm'),
    `sin btn-sm entre los modificadores el guard no puede ver la asimetría: ${JSON.stringify(f.modificadores)}`);
  assert.ok(MOV.filas.length >= 8, `pocas combinaciones evaluadas: ${MOV.filas.length}`);
});

test('SUELO: toda combinación resuelve una altura (ninguna queda sin regla)', () => {
  const huerfanas = [...MOV.filas, ...ESC.filas].filter((f) => f.solaPx === null || f.conBasePx === null);
  assert.equal(huerfanas.length, 0,
    `combinaciones sin min-height resuelto — el simulador está ciego:\n${
      huerfanas.map((f) => `  ${f.combinacion} (sola=${f.solaPx}, conBase=${f.conBasePx})`).join('\n')}`);
});

test('SUELO: el censo del front encuentra sitios y cubre todos los ficheros', () => {
  assert.ok(USOS.conjuntos.length > 50, `el censo del front vio ${USOS.conjuntos.length} conjuntos: está ciego`);
  assert.ok(USOS.sinBase.length > 0, 'ni un solo sitio escribe la variante sin la base: revisa el analizador');
  assert.deepEqual(USOS.formas, ['atributo', 'classList', 'className', 'helper'],
    `una FORMA de escribir clases dejó de reconocerse: ${JSON.stringify(USOS.formas)}`);
  assert.deepEqual(
    ficherosNoCubiertos(FUENTES, CLASES, USOS), [],
    'hay ficheros que nombran una clase de botón y de los que el censo no sacó ni un conjunto: ' +
      'apareció una QUINTA forma de escribir clases y el analizador no la ve.',
  );
});

// ── 2. LO VIGILADO: la promesa del comentario ───────────────────────────────

test('MÓVIL: una variante suelta mide lo mismo que con la base, en toda combinación', () => {
  const rotas = MOV.filas.filter((f) => !f.simetrica);
  assert.equal(rotas.length, 0,
    `styles.css:376-377 promete que las variantes «también funcionan solas» y a ${MOVIL}px no se ` +
    `cumple en:\n${rotas.map((f) => `  ${f.combinacion}: sola=${f.solaPx}px [${f.solaSelector}] ` +
      `vs con .btn=${f.conBasePx}px [${f.conBaseSelector}]`).join('\n')}`);
});

test('ESCRITORIO: la simetría también se cumple (el bump no debe filtrarse)', () => {
  const rotas = ESC.filas.filter((f) => !f.simetrica);
  assert.equal(rotas.length, 0,
    `a ${ESCRITORIO}px:\n${rotas.map((f) => `  ${f.combinacion}: ${f.solaPx} vs ${f.conBasePx}`).join('\n')}`);
});

test('MÓVIL: la variante sin modificador de tamaño llega a 44px (DESIGN.md)', () => {
  const cortas = MOV.filas.filter((f) => f.modificador === null && f.solaPx < 44);
  assert.equal(cortas.length, 0,
    `DESIGN.md pide ≥44px en móvil:\n${cortas.map((f) => `  ${f.combinacion} = ${f.solaPx}px`).join('\n')}`);
});

// ── 3. CONTROL NEGATIVO ─────────────────────────────────────────────────────

test('CONTROL NEGATIVO: el escritorio a 36px NO se toca — no es un defecto', () => {
  // DESIGN.md pide ≥44 EN MÓVIL. Con ratón, 36 cumple. Si alguien sube el escritorio a 44
  // «para que cuadre», este test se pone rojo: sería un cambio de aspecto no pedido.
  const sueltas = ESC.filas.filter((f) => f.modificador === null);
  assert.ok(sueltas.length > 0);
  for (const f of sueltas) {
    assert.equal(f.solaPx, 36,
      `${f.combinacion} mide ${f.solaPx}px en escritorio; se esperaba 36 (el bump es SOLO de móvil)`);
  }
});

test('CONTROL NEGATIVO: los botones pequeños siguen pequeños en móvil', () => {
  // El bump no debe convertir un `btn-sm` en un botón normal: es la asimetría que se evitó.
  const sm = MOV.filas.filter((f) => f.modificador === 'btn-sm');
  assert.ok(sm.length > 0);
  for (const f of sm) {
    assert.equal(f.solaPx, 30, `${f.combinacion} pasó a ${f.solaPx}px: el bump se comió el tamaño pequeño`);
  }
});

test('OTRA CARA: la base .btn no cambia de altura en ningún ancho', () => {
  assert.equal(minHeightDe(REGLAS, ['btn'], MOVIL).px, 44, '.btn en móvil debe seguir en 44');
  assert.equal(minHeightDe(REGLAS, ['btn'], ESCRITORIO).px, 36, '.btn en escritorio debe seguir en 36');
  assert.equal(minHeightDe(REGLAS, ['btn', 'btn-sm'], MOVIL).px, 30, '.btn.btn-sm en móvil debe seguir en 30');
});

// ── 4. ROJO POR EL MECANISMO ────────────────────────────────────────────────

test('ROJO: si el bump vuelve a alcanzar solo a .btn, la simetría cae nombrando las clases', () => {
  // Se revierte la regla a como estaba en main, sobre una copia en memoria.
  const mutada = HOJA.replace(
    /\n?\s*\.btn,\r?\n\s*\.btn-primary:not\(\.btn-sm\),[\s\S]*?\{ min-height: 44px; \}/,
    '\n  .btn { min-height: 44px; }',
  );
  assert.notEqual(mutada, HOJA, 'la mutación no encontró la regla del bump: revisa el guard');

  const rotas = censarTargetTactil(mutada, MOVIL).filas.filter((f) => !f.simetrica);
  assert.ok(rotas.length > 0, 'revertido el bump, el guard siguió en verde: NO VIGILA NADA');
  for (const clase of ['btn-primary', 'btn-secondary', 'btn-danger', 'btn-ghost']) {
    assert.ok(rotas.some((f) => f.variante === clase && f.modificador === null),
      `el guard cayó pero sin nombrar ${clase}: ${JSON.stringify(rotas.map((f) => f.combinacion))}`);
  }
});

test('ROJO: si se cae el :not(.btn-sm), la asimetría de los pequeños se detecta', () => {
  // Es EXACTAMENTE el error que la medición en navegador evitó: sin el :not, un
  // `btn-primary btn-sm` salta a 44 mientras `btn btn-primary btn-sm` se queda en 30.
  const mutada = HOJA.replace(/:not\(\.btn-sm\)/g, '');
  assert.notEqual(mutada, HOJA, 'la mutación no encontró los :not(.btn-sm)');

  const censo = censarTargetTactil(mutada, MOVIL);
  const rotas = censo.filas.filter((f) => !f.simetrica);
  assert.ok(rotas.length > 0, 'quitado el :not, el guard siguió en verde: no ve la asimetría');
  assert.ok(rotas.every((f) => f.modificador === 'btn-sm'),
    `la asimetría debería ser SOLO de los btn-sm: ${JSON.stringify(rotas.map((f) => f.combinacion))}`);
  const uno = rotas[0];
  assert.equal(uno.conBasePx, 30, 'con base debe seguir en 30');
  assert.equal(uno.solaPx, 44, 'suelta se dispararía a 44: esa es la asimetría');
});
