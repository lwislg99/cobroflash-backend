// tests/scrum677-vigilante-de-despliegue.test.mjs — SCRUM-677
//
// ═══════════════════════════════════════════════════════════════════════════════════════════════
// EL VIGILANTE DE DESPLIEGUE, EJERCITADO
//
// Producción estuvo NUEVE DÍAS sin desplegar y nadie se enteró: cuando un despliegue falla el
// healthcheck, Railway mantiene vivo el anterior. No hay caída ni alerta, y el síntoma es «no
// cambia nada» — indistinguible de un día tranquilo. Lo destapó el fundador preguntando.
//
// 🔴 POR QUÉ ESTE FICHERO EXISTE Y NO BASTA CON EL SCRIPT: *un vigilante que nadie ha visto
// saltar es exactamente el instrumento en el que no se puede confiar.* Hoy hubo TREINTA
// oportunidades de verlo saltar y no saltó ninguna. Aquí se le ve saltar, y se le ve NO saltar
// cuando no toca — que es la otra mitad.
//
// Todo es PURO: ni red, ni git, ni reloj de pared. El reloj se inyecta.
// ═══════════════════════════════════════════════════════════════════════════════════════════════
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  veredictoDeDespliegue, AL_DIA, ATRASADO, NO_SUPE_MIRAR,
  SALIDA_ATRASADO, SALIDA_NO_SUPE_MIRAR, MARGEN_HORAS_PROPUESTO,
} from '../scripts/_vigilante-de-despliegue.mjs';

const SHA_PROD = 'a'.repeat(40);
const SHA_MAIN = 'b'.repeat(40);
const AHORA = 1_800_000_000;
const H = 3600;

/** Un caso sano al que se le cambia una sola cosa por prueba. */
const base = (extra = {}) => ({
  versionDeProduccion: SHA_PROD, shaDeMain: SHA_MAIN,
  conoceElCommit: true, estaEnMain: true,
  commitsPorDelante: 0, epochDelPrimeroSinDesplegar: null,
  ahoraEpoch: AHORA, ...extra,
});

// ═══════════════════════════════════════════════════════════════════════════════════════════════
// 🔴 QUE SALTA — el incidente reproducido
// ═══════════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-677 · 🔴 nueve días por detrás: SALTA, y dice cuántas horas y cuántos commits', () => {
  const v = veredictoDeDespliegue(base({
    commitsPorDelante: 283, epochDelPrimeroSinDesplegar: AHORA - 222 * H,
  }));
  assert.equal(v.veredicto, ATRASADO, '🔴 nueve días sin desplegar y dice que todo bien.');
  assert.equal(v.salida, SALIDA_ATRASADO);
  assert.match(v.titulo, /222\.0 h de hueco/, '🔴 no dice cuánto lleva el hueco abierto.');
  assert.match(v.detalle, /283/, '🔴 no dice cuántos commits se han quedado fuera.');

  // 🔴 OBSERVA, NO AFIRMA (defecto nº 14). El título son las TRES LECTURAS —qué dice producción,
  // qué dice `main`, cuánto hueco hay— y no un juicio en presente sobre el mecanismo. «producción
  // está desplegada» no dice nada sobre si lo está; «producción dice X · main está en Y» sí.
  assert.match(v.titulo, /producción dice [0-9a-f]{8} · `main` está en [0-9a-f]{8}/,
    '🔴 el título AFIRMA en vez de observar: tiene que decir qué dice cada lado.');

  // Y lo que hace ACCIONABLE el aviso: dice que la web puede estar perfecta y aun así ser esto,
  // y adónde mirar. Sin eso, quien lo lea un lunes por la mañana no sabe qué hacer con él.
  assert.match(v.detalle, /LA WEB PUEDE ESTAR FUNCIONANDO/,
    '🔴 no avisa de que el síntoma es «no pasa nada»: es lo que hizo que durara nueve días.');
  assert.match(v.detalle, /schemaDrift/, '🔴 no dice dónde mirar primero.');
});

test('SCRUM-677 · 🔴 justo por encima del margen: salta. Justo por debajo: NO', () => {
  const conHoras = (h) => veredictoDeDespliegue(base({
    commitsPorDelante: 1, epochDelPrimeroSinDesplegar: AHORA - h * H,
  }));
  assert.equal(conHoras(MARGEN_HORAS_PROPUESTO + 0.5).veredicto, ATRASADO,
    '🔴 por encima del margen y no salta.');
  assert.equal(conHoras(MARGEN_HORAS_PROPUESTO - 0.5).veredicto, AL_DIA,
    '🔴 por debajo del margen y salta: un despliegue en curso daría alarma cada vez.');
  // El borde EXACTO cuenta como dentro: un vigilante que salta en el instante justo del límite
  // convierte cada despliegue lento en un incidente.
  assert.equal(conHoras(MARGEN_HORAS_PROPUESTO).veredicto, AL_DIA, '🔴 el borde exacto salta.');
});

test('SCRUM-677 · 🔴 producción corriendo algo que NO está en `main` no es «atraso»', () => {
  const v = veredictoDeDespliegue(base({ estaEnMain: false, commitsPorDelante: 5 }));
  assert.equal(v.veredicto, ATRASADO, '🔴 se traga una historia distinta.');
  assert.match(v.titulo, /NO ESTÁ EN `main`/,
    '🔴 lo llama retraso. Un commit fuera de la historia es otra cosa y se arregla de otra forma.');
});

// ═══════════════════════════════════════════════════════════════════════════════════════════════
// EL CONTROL NEGATIVO — lo que deliberadamente NO debe hacerlo saltar
// ═══════════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-677 · CONTROL NEGATIVO: al día no salta, y un despliegue en curso tampoco', () => {
  const alDia = veredictoDeDespliegue(base());
  assert.equal(alDia.veredicto, AL_DIA, '🔴 salta con producción al día.');
  assert.equal(alDia.salida, 0);

  // Un merge de hace diez minutos: el despliegue está en marcha. Saltar aquí sería enseñar a
  // todo el mundo a ignorar este aviso, que es la forma más segura de perder otros nueve días.
  const recien = veredictoDeDespliegue(base({
    commitsPorDelante: 3, epochDelPrimeroSinDesplegar: AHORA - 600,
  }));
  assert.equal(recien.veredicto, AL_DIA, '🔴 salta con un despliegue recién lanzado.');
  assert.equal(recien.salida, 0);
});

// ═══════════════════════════════════════════════════════════════════════════════════════════════
// 🔴 LOS SUELOS · «no supe mirar» NO es «al día», y cada ceguera tiene su motivo
// ═══════════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-677 · 🔴 SUELO: sin lectura de `/version` no hay veredicto', () => {
  for (const v of [null, undefined, '', '   ']) {
    const r = veredictoDeDespliegue(base({ versionDeProduccion: v }));
    assert.equal(r.veredicto, NO_SUPE_MIRAR, `🔴 con «${v}» se atreve a dar veredicto.`);
    assert.equal(r.salida, SALIDA_NO_SUPE_MIRAR,
      '🔴 la ceguera sale con el mismo código que un hallazgo: se leen igual desde fuera.');
    assert.match(r.detalle, /NO es «producción está al día»/,
      '🔴 no dice que no ha podido comprobar. Un cero mudo se lee como un verde.');
  }
});

test('SCRUM-677 · 🔴 SUELO: el FALLBACK de `env.ts` se reconoce, y es un caso REAL', () => {
  // `BUILD_ID = RAILWAY_GIT_COMMIT_SHA || String(Date.now())`. Si la variable no llega, producción
  // publica un NÚMERO. Compararlo contra `main` daría «no está en la historia» y se leería como
  // «va atrasadísima» — cuando lo que pasa es que no sabemos qué corre. No es lo mismo.
  const r = veredictoDeDespliegue(base({ versionDeProduccion: '1756800000000' }));
  assert.equal(r.veredicto, NO_SUPE_MIRAR,
    '🔴 trata un `Date.now()` como si fuera un commit: diría «atrasada» sobre una incógnita.');
  assert.match(r.detalle, /RAILWAY_GIT_COMMIT_SHA/, '🔴 no dice cuál es la causa probable.');

  // Y las otras formas de «no es un sha40», que también tienen que caer del mismo lado.
  for (const mala of ['abc', 'A'.repeat(40), 'g'.repeat(40), 'a'.repeat(39), 'a'.repeat(41)]) {
    assert.equal(veredictoDeDespliegue(base({ versionDeProduccion: mala })).veredicto, NO_SUPE_MIRAR,
      `🔴 «${mala}» pasa por sha válido.`);
  }
});

test('SCRUM-677 · 🔴 SUELO: un commit que este repo no conoce se DICE, no se adivina', () => {
  const r = veredictoDeDespliegue(base({ conoceElCommit: false }));
  assert.equal(r.veredicto, NO_SUPE_MIRAR, '🔴 opina sobre un commit que no tiene.');
  assert.match(r.detalle, /no está ese objeto/, '🔴 no explica qué le falta.');
});

test('SCRUM-677 · 🔴 SUELO: hay commits por delante y no se les pudo poner fecha', () => {
  const r = veredictoDeDespliegue(base({
    commitsPorDelante: 4, epochDelPrimeroSinDesplegar: null,
  }));
  assert.equal(r.veredicto, NO_SUPE_MIRAR,
    '🔴 con 4 commits sin fechar decide igualmente. «No sé desde cuándo» no es «desde hace poco».');
});

test('SCRUM-677 · 🔴 CONTROL del propio suelo: el detector NO declara ciego lo que sí puede leer', () => {
  // Sin esto, todos los `NO_SUPE_MIRAR` de arriba también saldrían con un detector roto que
  // siempre dijera «no sé».
  const r = veredictoDeDespliegue(base({
    commitsPorDelante: 1, epochDelPrimeroSinDesplegar: AHORA - 100 * H,
  }));
  assert.equal(r.veredicto, ATRASADO,
    '🔴 se declara ciego con todos los datos delante: sus «no supe mirar» no significarían nada.');
});

// ═══════════════════════════════════════════════════════════════════════════════════════════════
// EL MARGEN
// ═══════════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-677 · el margen es CONFIGURABLE, y el propuesto tiene su motivo medido', () => {
  assert.equal(MARGEN_HORAS_PROPUESTO, 6,
    '🔴 ha cambiado el margen propuesto sin cambiar el motivo medido que lo sostiene.');
  const datos = { commitsPorDelante: 1, epochDelPrimeroSinDesplegar: AHORA - 10 * H };
  assert.equal(veredictoDeDespliegue(base({ ...datos, margenHoras: 6 })).veredicto, ATRASADO);
  assert.equal(veredictoDeDespliegue(base({ ...datos, margenHoras: 24 })).veredicto, AL_DIA,
    '🔴 el margen no se aplica: el número sería decorativo.');
});

test('SCRUM-677 · 🔴 CONTROL NEGATIVO DURO: mismo sha con NUEVE DÍAS de silencio NO canta', () => {
  // Es la comprobación de que el margen se aplica a la MAGNITUD correcta. Si el vigilante midiera
  // «horas desde el último commit», un puente tranquilo cantaría sin que hubiera pasado nada — y
  // enseñar a la gente a ignorar este aviso es la forma más segura de perder otros nueve días.
  const v = veredictoDeDespliegue(base({
    commitsPorDelante: 0,
    epochDelPrimeroSinDesplegar: AHORA - 222 * H,   // ruido: no debe mirarse siquiera
  }));
  assert.equal(v.veredicto, AL_DIA,
    '🔴 canta con producción AL DÍA. El margen está aplicado a la magnitud equivocada: lo que se '
    + 'mide es el HUECO, no el silencio.');
  assert.equal(v.salida, 0);
  assert.equal(v.horas, 0, '🔴 le pone horas a un hueco que no existe.');
});
