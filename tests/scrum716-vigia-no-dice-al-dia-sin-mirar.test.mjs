// tests/scrum716-vigia-no-dice-al-dia-sin-mirar.test.mjs — SCRUM-716.
//
// ═════════════════════════════════════════════════════════════════════════════════════════
// 🔴 EL DEFECTO, MEDIDO EL 3-SEP-2026 Y VIVO EL 4
//
//     conoceElCommit: true,  shaDeMain: null   (origin/main no resuelve)
//     → veredicto: al-dia    salida: 0
//       «producción dice 2d826de6 · `main` está en ? · sin hueco»
//
// Sale VERDE habiendo impreso «`main` está en ?». Y el propio fichero lo prohíbe por escrito:
// «Esto NO es "producción está al día": es que no se ha podido comprobar. Un vigilante que
// confunde las dos cosas es peor que ninguno.»
//
// 🔒 El guard construido para que no vuelvan a pasar NUEVE DÍAS sin desplegar puede decir «al
// día» cuando no ha sabido mirar. Y como sale exit 0, **ni siquiera aparecería en rojo**.
//
// ── LA CAUSA, EN UNA LÍNEA ────────────────────────────────────────────────────────────────
// `if (!commitsPorDelante)` trata `null` (no se pudo contar) igual que `0` (no hay hueco). Es
// la confusión de la casa entre «no medido» y «cero», esta vez dentro del propio vigilante.
//
// ── LO QUE FIJA ESTE FICHERO ──────────────────────────────────────────────────────────────
// La comparación necesita DOS PUNTAS: lo que dice producción y lo que dice `main`. Ningún
// camino puede emitir veredicto NO CIEGO sin tener las dos resueltas. No se comprueba un
// camino: se ENUMERAN todos.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  veredictoDeDespliegue, AL_DIA, ATRASADO, NO_SUPE_MIRAR,
  SALIDA_ATRASADO, SALIDA_NO_SUPE_MIRAR, MARGEN_HORAS_PROPUESTO,
} from '../scripts/_vigilante-de-despliegue.mjs';

const SHA_A = 'a'.repeat(40);
const SHA_B = 'b'.repeat(40);
const AHORA = 1_757_000_000;

const v = (datos) => veredictoDeDespliegue({
  ahoraEpoch: AHORA, margenHoras: MARGEN_HORAS_PROPUESTO, ...datos,
});

/**
 * LAS DOS PUNTAS. La comparación es entre dos commits; sin los dos, no hay comparación.
 * Se declara aquí para que el enumerado de abajo no las adivine.
 */
const tieneLasDosPuntas = (d) =>
  typeof d.versionDeProduccion === 'string' && /^[0-9a-f]{40}$/.test(d.versionDeProduccion)
  && typeof d.shaDeMain === 'string' && /^[0-9a-f]{40}$/.test(d.shaDeMain)
  && d.conoceElCommit === true;

// ─────────────────────────────────────────────────────────────────────────────────────────
// EL ENUMERADO · un veredicto por combinación, contado y no supuesto
// ─────────────────────────────────────────────────────────────────────────────────────────

/**
 * Cada entrada es un estado en el que el vigilante puede encontrarse. Se recorren TODAS y se
 * exige la misma regla a todas: sin las dos puntas, el veredicto es CIEGO.
 */
const CAMINOS = [
  ['producción no responde',
   { versionDeProduccion: null, shaDeMain: SHA_A, conoceElCommit: null,
     estaEnMain: null, commitsPorDelante: null, epochDelPrimeroSinDesplegar: null }],

  ['producción responde vacío',
   { versionDeProduccion: '   ', shaDeMain: SHA_A, conoceElCommit: null,
     estaEnMain: null, commitsPorDelante: null, epochDelPrimeroSinDesplegar: null }],

  ['/version devuelve algo que no es un sha de 40 (el fallback de env.ts)',
   { versionDeProduccion: '1757000000', shaDeMain: SHA_A, conoceElCommit: null,
     estaEnMain: null, commitsPorDelante: null, epochDelPrimeroSinDesplegar: null }],

  ['el clon no conoce el commit de producción',
   { versionDeProduccion: SHA_A, shaDeMain: SHA_B, conoceElCommit: false,
     estaEnMain: null, commitsPorDelante: null, epochDelPrimeroSinDesplegar: null }],

  // 🔴 EL DEFECTO DEL TICKET: `origin/main` no resuelve. Producción se leyó bien, el commit
  // está en el clon, pero NO HAY CONTRA QUÉ COMPARAR.
  ['origin/main NO se resuelve',
   { versionDeProduccion: SHA_A, shaDeMain: null, conoceElCommit: true,
     estaEnMain: null, commitsPorDelante: null, epochDelPrimeroSinDesplegar: null }],

  ['origin/main resuelve a algo vacío',
   { versionDeProduccion: SHA_A, shaDeMain: '', conoceElCommit: true,
     estaEnMain: null, commitsPorDelante: null, epochDelPrimeroSinDesplegar: null }],

  // Las dos puntas resueltas pero el conteo no se pudo hacer: tampoco es «sin hueco».
  ['las dos puntas, pero no se pudo contar el hueco',
   { versionDeProduccion: SHA_A, shaDeMain: SHA_B, conoceElCommit: true,
     estaEnMain: true, commitsPorDelante: null, epochDelPrimeroSinDesplegar: null }],

  ['las dos puntas, hay hueco, pero no se pudo fechar el commit más antiguo',
   { versionDeProduccion: SHA_A, shaDeMain: SHA_B, conoceElCommit: true,
     estaEnMain: true, commitsPorDelante: 3, epochDelPrimeroSinDesplegar: null }],

  // ── Con las dos puntas: aquí SÍ se puede opinar ──────────────────────────────────────
  ['las dos puntas · producción corre algo que no está en main',
   { versionDeProduccion: SHA_A, shaDeMain: SHA_B, conoceElCommit: true,
     estaEnMain: false, commitsPorDelante: null, epochDelPrimeroSinDesplegar: null }],

  ['las dos puntas · sin hueco',
   { versionDeProduccion: SHA_A, shaDeMain: SHA_A, conoceElCommit: true,
     estaEnMain: true, commitsPorDelante: 0, epochDelPrimeroSinDesplegar: null }],

  ['las dos puntas · hueco dentro del margen',
   { versionDeProduccion: SHA_A, shaDeMain: SHA_B, conoceElCommit: true,
     estaEnMain: true, commitsPorDelante: 2, epochDelPrimeroSinDesplegar: AHORA - 2 * 3600 }],

  ['las dos puntas · hueco PASADO el margen',
   { versionDeProduccion: SHA_A, shaDeMain: SHA_B, conoceElCommit: true,
     estaEnMain: true, commitsPorDelante: 9, epochDelPrimeroSinDesplegar: AHORA - 30 * 3600 }],
];

test('SCRUM-716 · 🔴 SUELO: el enumerado ve más de un camino', () => {
  // Si el enumerado devolviera uno solo, la regla de abajo se cumpliría por no encontrar nada.
  assert.ok(CAMINOS.length >= 8,
    `🔴 el enumerado sólo tiene ${CAMINOS.length} caminos. El vigilante tiene siete puntos de ` +
    'salida: si aquí hay uno, el barrido está roto y todo lo demás pasa por no mirar.');

  // Y que los veredictos NO sean todos el mismo: un enumerado que siempre da CIEGO tampoco mide.
  const distintos = new Set(CAMINOS.map(([, d]) => v(d).veredicto));
  assert.ok(distintos.size >= 3,
    `🔴 el enumerado sólo produce ${distintos.size} veredicto(s) distintos: ${[...distintos]}. ` +
    'O el vigilante responde lo mismo a todo, o los casos no son distintos de verdad.');
});

test('SCRUM-716 · 🔴 SIN LAS DOS PUNTAS, NUNCA «al día»', () => {
  const verdesCiegos = [];
  for (const [etiqueta, datos] of CAMINOS) {
    if (tieneLasDosPuntas(datos)) continue;
    const r = v(datos);
    if (r.veredicto === AL_DIA || r.salida === 0) {
      verdesCiegos.push(`${etiqueta}  →  ${r.veredicto} · salida ${r.salida} · ${r.titulo}`);
    }
  }
  assert.deepEqual(verdesCiegos, [],
    '🔴 HAY CAMINOS QUE DICEN «AL DÍA» SIN HABER PODIDO MIRAR:\n   ' + verdesCiegos.join('\n   ') +
    '\n\n   La comparación necesita DOS commits: el que dice producción y el que dice `main`.\n' +
    '   Sin los dos no hay comparación, y «no se pudo comprobar» NO es «está al día».\n' +
    '   Y como sale exit 0, esto ni siquiera aparecería en rojo: el guard que existe para que\n' +
    '   no vuelvan a pasar nueve días sin desplegar callaría precisamente cuando no sabe.');
});

test('SCRUM-716 · 🔴 sin las dos puntas, el veredicto es CIEGO y lo dice', () => {
  for (const [etiqueta, datos] of CAMINOS) {
    if (tieneLasDosPuntas(datos)) continue;
    const r = v(datos);
    assert.equal(r.veredicto, NO_SUPE_MIRAR, `🔴 «${etiqueta}» da ${r.veredicto} en vez de ciego`);
    assert.equal(r.salida, SALIDA_NO_SUPE_MIRAR,
      `🔴 «${etiqueta}» sale con ${r.salida}: un vigía ciego tiene que poder verse`);
    assert.match(r.detalle, /no se ha podido comprobar/,
      `🔴 «${etiqueta}» no explica que no se pudo comprobar`);
  }
});

// ─────────────────────────────────────────────────────────────────────────────────────────
// LOS CONTROLES · que apretar la ceguera no mate la detección
// ─────────────────────────────────────────────────────────────────────────────────────────

test('SCRUM-716 · 🔴 con las DOS puntas pero sin poder CONTAR, tampoco es «sin hueco»', () => {
  // La misma familia: `null` (no se pudo contar) salía por la misma línea que `0` (no hay
  // hueco), porque `!commitsPorDelante` es verdadero para los dos.
  const r = v({ versionDeProduccion: SHA_A, shaDeMain: SHA_B, conoceElCommit: true,
                estaEnMain: true, commitsPorDelante: null, epochDelPrimeroSinDesplegar: null });
  assert.equal(r.veredicto, NO_SUPE_MIRAR,
    '🔴 no se pudo contar el hueco y aun así dice ' + r.veredicto + '. «No medido» y «cero» no ' +
    'son lo mismo, y aquí la diferencia es entre avisar y callarse.');
  assert.equal(r.salida, SALIDA_NO_SUPE_MIRAR);
});

test('SCRUM-716 · ✅ CONTROL POSITIVO: con las dos puntas y sin hueco, sigue diciendo «al día»', () => {
  // Un vigía que se pone ciego SIEMPRE es tan inútil como uno que se pone verde siempre — y se
  // desactiva antes, porque molesta todos los días.
  const r = v({ versionDeProduccion: SHA_A, shaDeMain: SHA_A, conoceElCommit: true,
                estaEnMain: true, commitsPorDelante: 0, epochDelPrimeroSinDesplegar: null });
  assert.equal(r.veredicto, AL_DIA, '🔴 el caso bueno ya no sale al día: el guard se ha vuelto ciego de todo');
  assert.equal(r.salida, 0);
  assert.match(r.titulo, /sin hueco/);
  assert.ok(!/\?/.test(r.titulo),
    '🔴 el título dice «al día» y lleva una interrogación dentro: si hay un `?`, es que faltaba un dato');
});

test('SCRUM-716 · ✅ CONTROL POSITIVO: hueco dentro del margen sigue siendo verde', () => {
  const r = v({ versionDeProduccion: SHA_A, shaDeMain: SHA_B, conoceElCommit: true,
                estaEnMain: true, commitsPorDelante: 2, epochDelPrimeroSinDesplegar: AHORA - 2 * 3600 });
  assert.equal(r.salida, 0, '🔴 un despliegue en curso dentro del margen ya canta: sería ruido diario');
});

test('SCRUM-716 · ✅ CONTROL NEGATIVO: con hueco de verdad, lo dice y con su tamaño', () => {
  const r = v({ versionDeProduccion: SHA_A, shaDeMain: SHA_B, conoceElCommit: true,
                estaEnMain: true, commitsPorDelante: 9, epochDelPrimeroSinDesplegar: AHORA - 30 * 3600 });
  assert.equal(r.veredicto, ATRASADO,
    '🔴 apretar la ceguera se ha comido la DETECCIÓN: con 30 h de hueco ya no canta.');
  assert.equal(r.salida, SALIDA_ATRASADO);
  assert.match(r.titulo, /30\.0 h de hueco/, '🔴 no dice cuánto hueco hay');
  assert.match(r.detalle, /9/, '🔴 no dice cuántos commits faltan');
});

test('SCRUM-716 · ✅ CONTROL NEGATIVO: producción fuera de main sigue cantando', () => {
  const r = v({ versionDeProduccion: SHA_A, shaDeMain: SHA_B, conoceElCommit: true,
                estaEnMain: false, commitsPorDelante: null, epochDelPrimeroSinDesplegar: null });
  assert.equal(r.veredicto, ATRASADO,
    '🔴 producción corriendo un commit que no está en `main` ha dejado de cantar. Ese caso NO es ' +
    'ceguera: se sabe exactamente lo que pasa, y es peor que un atraso.');
  assert.equal(r.salida, SALIDA_ATRASADO);
});
