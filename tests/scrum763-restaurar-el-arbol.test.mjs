// tests/scrum763-restaurar-el-arbol.test.mjs — SCRUM-763
//
// ═════════════════════════════════════════════════════════════════════════════════════════════
// RESTAURAR EL FUENTE NO ES RESTAURAR EL ÁRBOL.
//
// La casa verifica sus restauraciones por BYTES DEL FUENTE (`Buffer.compare(disco, ORIGINAL)`,
// SCRUM-570). Es el método correcto y ha funcionado decenas de veces. **Y es incompleto en
// cuanto hay compilación**, porque el árbol que ejecutan los tests no es el fuente: es `dist/`,
// y `dist/` no lo toca ninguna restauración del fuente.
//
// ── EL CASO, REPRODUCIDO EL 6-sep-2026 (`src/core/utils/utils.ts`, `tests/utils.test.mjs`) ──
//   1. muto el `.ts` · 2. `npm run build` (exit 0) · 3. tests → exit 1, dist lleva la mutación
//   4. restauro SÓLO el fuente:
//         Buffer.compare(fuente, ORIGINAL) = 0   ← VERDE. «Restauración verificada.»
//         scripts/frontera-dist.mjs              ← 🔴 ROJO: 268 corresponden, 1 NO
//         tests                                  ← exit 1: siguen ejecutando el código mutado
//   5. control positivo: recompilo → frontera 269/269 y tests exit 0.
//
// El paso 4 es el defecto entero: la comprobación no miente sobre lo que mide —el fuente **está**
// restaurado— miente sobre lo que se cree que mide. Con esa foto, una sesión estuvo a punto de
// publicar la conclusión CONTRARIA a la real.
//
// LO QUE VIGILA ESTE GUARD:
//   ① que el detector de la frontera exista y VEA (con su rojo provocado, no leído);
//   ② el CONTRASTE que el ticket exige: un `.mjs` no paga compilación, porque no tiene ninguna;
//   ③ el censo de qué declaraciones del árbol están expuestas, con su población delante.
//
// ⚠️ HUECO DECLARADO: esto contesta «¿`dist/` corresponde al fuente?», NO «¿el fuente compila?».
// Medido el 6-sep: con un TS2353 metido a propósito, `npm run build` sale con **exit 2 y aun así
// escribe `dist/`** (`noEmitOnError` está desactivado), o sea que la frontera muerde también por
// ese lado y el único aviso es el código de salida del build.
// ═════════════════════════════════════════════════════════════════════════════════════════════
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  censoDeLaFrontera, correspondencia, destinoEnDist, emitirDesdeFuente,
} from '../scripts/frontera-dist.mjs';
import { SUELO_DECLARACIONES, censoDeExposicionATypeScript } from '../scripts/meta-guard-mutaciones.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// ─────────────────────────────────────────────────────────────────────────────────────────────
// ① ¿QUÉ TIENE ÁRBOL EJECUTABLE DETRÁS, Y QUÉ NO?
//
// 🔴 ESTE ES EL CONTRASTE QUE PIDE EL TICKET, y no es un detalle de rendimiento: si el arreglo
// obligara a compilar donde no hace falta, encarecería TODAS las mutaciones de la casa por un
// caso que no aplica. De las 39 declaraciones de hoy, 34 son sobre ficheros sin compilación.
// ─────────────────────────────────────────────────────────────────────────────────────────────
test('SCRUM-763 · sólo se compila lo que se compila', () => {
  // SÍ: un `.ts` bajo el `rootDir` del proyecto.
  assert.equal(destinoEnDist('src/core/utils/utils.ts', RAIZ), 'dist/core/utils/utils.js');
  assert.equal(destinoEnDist('src/index.ts', RAIZ), 'dist/index.js');

  // NO, y cada «no» por su motivo:
  assert.equal(destinoEnDist('tests/utils.test.mjs', RAIZ), null, 'un test .mjs no se compila');
  assert.equal(destinoEnDist('public/dashboard/js/api.js', RAIZ), null, 'el front vanilla no se compila');
  assert.equal(destinoEnDist('scripts/meta-guard-mutaciones.mjs', RAIZ), null, 'un script no se compila');
  assert.equal(destinoEnDist('src/tipos.d.ts', RAIZ), null, 'un .d.ts no emite nada');

  // Un `.ts` FUERA del `rootDir` tampoco: no lo cubre este tsconfig.
  assert.equal(destinoEnDist('scripts/algo.ts', RAIZ), null);
});

// ─────────────────────────────────────────────────────────────────────────────────────────────
// ② EL DETECTOR · con el rojo PROVOCADO
//
// El defecto se inyecta EN MEMORIA (`correspondencia` acepta el texto del fuente), así que este
// guard no escribe un byte en el árbol. Un guard que muta el árbol para probarse deja abierta la
// pregunta de si lo restauró — y es justo la pregunta de este ticket.
// ─────────────────────────────────────────────────────────────────────────────────────────────
const TESTIGO = 'src/core/utils/utils.ts';

test('SCRUM-763 · el detector caza el desajuste entre el fuente y el árbol ejecutable', () => {
  const abs = path.join(RAIZ, TESTIGO);
  const texto = fs.readFileSync(abs, 'utf8');

  // CONTROL POSITIVO: con el árbol al día, corresponde. Sin esto, un detector que dijera «no
  // corresponde» siempre pasaría el rojo de abajo sin significar nada.
  assert.equal(correspondencia(TESTIGO, RAIZ, texto).estado, 'corresponde',
    `🔴 \`${TESTIGO}\` no corresponde con su dist. O el árbol está sin compilar (\`npm run build\`) `
    + 'o el detector está roto: mira `npm run frontera:dist`.');

  // 🔴 EL ROJO: el mismo fichero con UN carácter cambiado ya no corresponde.
  const mutado = texto.replace("'<':'&lt;'", "'<':'&LT;'");
  assert.notEqual(mutado, texto, '🔴 el ancla de la mutación caducó: este test no probaba nada.');
  assert.equal(correspondencia(TESTIGO, RAIZ, mutado).estado, 'no-corresponde',
    '🔴 el detector NO ve un fuente que ya no es su dist. Es exactamente el verde falso del '
    + 'ticket: `Buffer.compare` sobre el fuente da 0 mientras los tests ejecutan otra cosa.');

  // Y para lo que no se compila, la respuesta es «no aplica», no un falso «corresponde».
  assert.equal(correspondencia('public/dashboard/js/api.js', RAIZ).estado, 'no-aplica');
});

test('SCRUM-763 · lo que emite el detector son los MISMOS bytes que emitió el compilador', () => {
  // Es lo que hace legítimo mutar `dist/` transpilando en vez de lanzar un `npm run build` de
  // ~16-32 s por mutación. Medido sobre los 269 `.ts` del árbol: 269 de 269 iguales byte a byte.
  const abs = path.join(RAIZ, TESTIGO);
  const emitido = Buffer.from(emitirDesdeFuente(abs, fs.readFileSync(abs, 'utf8'), RAIZ), 'utf8');
  const enDisco = fs.readFileSync(path.join(RAIZ, destinoEnDist(TESTIGO, RAIZ)));
  assert.equal(Buffer.compare(emitido, enDisco), 0,
    '🔴 transpilar y compilar ya no dan lo mismo. Entonces escribir `dist/` transpilando mete un '
    + 'cambio que nadie pidió, y el meta-guard mediría un árbol que el build no produciría.');
});

test('SCRUM-763 · SUELO: el censo de la frontera tiene población, y un cero suyo significa algo', () => {
  const c = censoDeLaFrontera(RAIZ);

  // 🔴 CERO SOBRE POBLACIÓN VACÍA NO ES UN CERO. Sin este suelo, un recorrido que no encontrara
  // ficheros diría «0 desajustes» con la misma cara que un árbol sano.
  assert.ok(c.poblacion > 200,
    `🔴 el censo sólo ha visto ${c.poblacion} ficheros: su cero no es medible.`);
  assert.equal(c.noCorresponden.length, 0,
    '🔴 el árbol ejecutable NO es el fuente en:\n  · '
    + c.noCorresponden.map((r) => r.fuente).join('\n  · ')
    + '\n\nCualquier medición sobre este árbol mide un código que no es el que hay escrito.');
  assert.equal(c.sinDist.length, 0,
    '🔴 hay fuentes sin compilar:\n  · ' + c.sinDist.map((r) => r.fuente).join('\n  · '));
});

// ─────────────────────────────────────────────────────────────────────────────────────────────
// ③ EL CENSO DE EXPOSICIÓN (punto 3 del ticket)
//
// «Censar qué mutaciones declaradas hoy tocan TypeScript, y por tanto están expuestas. Si el
// censo da cero, falla declarándose ciego.» Se lee con la regla de la casa: un cero sólo es un
// dato con su POBLACIÓN al lado. Aquí la población son las 31 declaraciones del árbol.
//
// 📌 Y CORRIGE LA PREMISA DEL TICKET, que decía «hasta ahora las mutaciones documentadas han sido
// sobre .mjs/.js». Medido el 6-sep-2026 tras mezclar main: **5 de 39 tocan TypeScript**
// (scrum596 ×2, scrum631 ×2, scrum641 ×1). La exposición no era hipotética: ya estaba.
// ─────────────────────────────────────────────────────────────────────────────────────────────
test('SCRUM-763 · el censo de exposición sabe cuántas declaraciones pisan la frontera', () => {
  const censo = censoDeExposicionATypeScript();

  // SUELO: sin declaraciones que clasificar, «0 expuestas» sería «no supe mirar».
  assert.ok(censo.poblacion >= SUELO_DECLARACIONES,
    `🔴 CIEGO: el censo sólo ha visto ${censo.poblacion} declaraciones. Un cero sobre esta `
    + 'población no sería un cero: sería que no he sabido mirar.');

  // CONTROL POSITIVO: el censo encuentra las que hay. Si algún día no quedara ninguna, este rojo
  // obliga a decirlo a mano en vez de dejar pasar un «0 expuestas» indistinguible de un fallo.
  assert.ok(censo.expuestas.length >= 1,
    '🔴 CIEGO: ninguna declaración toca código compilado. O el árbol cambió de verdad —y hay que '
    + 'decirlo en el commit— o `destinoEnDist` ha dejado de reconocer los fuentes de `src/`.');

  // Y la clasificación es EXCLUYENTE: cada declaración cae en un lado y sólo en uno.
  assert.equal(censo.expuestas.length + censo.noExpuestas.length, censo.poblacion);
  for (const e of censo.expuestas) {
    assert.ok(e.destino && e.destino.startsWith('dist/'),
      `🔴 ${e.guard} se ha clasificado como expuesta sin destino en dist: ${e.fichero}`);
  }
  for (const n of censo.noExpuestas) {
    assert.equal(n.destino, null,
      `🔴 ${n.guard} se ha clasificado como NO expuesta teniendo destino en dist: ${n.fichero}`);
  }
});

// ═════════════════════════════════════════════════════════════════════════════════════════════
// LA MUTACIÓN QUE ME TUMBA (SCRUM-745)
// ═════════════════════════════════════════════════════════════════════════════════════════════
export const MUTACIONES_QUE_ME_TUMBAN = [
  {
    // El detector deja de comparar y contesta que sí a todo: es el verde falso de este ticket,
    // metido dentro del propio instrumento que vino a cerrarlo.
    fichero: 'scripts/frontera-dist.mjs',
    de: "    estado: Buffer.compare(emitido, enDisco) === 0 ? 'corresponde' : 'no-corresponde',",
    a: "    estado: 'corresponde',",
    cae: 'el detector caza el desajuste entre el fuente y el árbol ejecutable',
  },
  {
    // Que todo parezca sin compilar: la frontera desaparece, y con ella el CONTRASTE — todas las
    // mutaciones de la casa volverían a medir el árbol de antes sin que nada lo dijera.
    fichero: 'scripts/frontera-dist.mjs',
    de: "  if (!rel.endsWith('.ts') || rel.endsWith('.d.ts')) return null;",
    a: '  return null;',
    cae: 'sólo se compila lo que se compila',
  },
];
