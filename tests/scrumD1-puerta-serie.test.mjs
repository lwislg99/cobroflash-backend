// SCRUM-D1 (bloque D) · LA PUERTA DE ÚLTIMA OPORTUNIDAD, LADO FRONT.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// EL DEFECTO
//
// El Paso 2 del asistente pregunta por la numeración, así que a quien se da de alta HOY sí se le
// pregunta. Lo que NO existía es la segunda oportunidad: quien ya pasó el onboarding no tenía
// dónde contestar — y es justo el perfil que importa, el que viene de otro programa con facturas
// ya emitidas.
//
// Medido antes de construir: `puertaSerieDisponible` se publicaba en `/admin/me` y había CERO
// ocurrencias en todo `public/`. El backend decía a quién le corresponde y nadie lo leía.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// LOS DOS CONTROLES, Y POR QUÉ HACEN FALTA LOS DOS
//
//   · NEGATIVO — quien ya emitió con nosotros NO la ve.
//   · POSITIVO — quien se saltó el asistente y no ha emitido, SÍ la ve.
//
// Sin el POSITIVO, una puerta que no se le enseña a NADIE pasaría el negativo tan campante: es el
// caso en el que el ticket se da por hecho y la pantalla no existe. Es el mismo par que en
// SCRUM-385 con los dos vacíos: cada uno solo, engañable; juntos, no.

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { debeOfrecerArranqueDeSerie, resumenSerieEmitida, bloqueoCambioDeSerie }
  from '../dist/core/validation/fiscalInput.js';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const require_ = createRequire(import.meta.url);
const puerta = require_(path.join(RAIZ, 'public/dashboard/js/puertaSerie.js'));

const ANIO = 2026;

// ═══════════════════════════════════════════════════════════════════════════════════════════
// ① EL VEREDICTO — el del servidor, ejercitado por los dos lados
// ═══════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-D1 · CONTROL NEGATIVO: quien YA EMITIÓ con nosotros no ve la puerta', () => {
  // Con facturas de la serie ya emitidas, la puerta no se ofrece pase lo que pase con el año:
  // la numeración de este año ya está en marcha y tocarla rompería la continuidad.
  const yaEmitio = debeOfrecerArranqueDeSerie({
    invoiceSeriesYear: 2025, año: ANIO, numerosDeLaSerie: ['2026-CF-001', '2026-CF-002'],
  });
  assert.equal(yaEmitio, false, '🔴 se le está ofreciendo cambiar el arranque a quien ya emitió');
  assert.equal(puerta.puertaSerieVisible(yaEmitio), false, '🔴 la pantalla la pintaría igualmente');
});

test('SCRUM-D1 · CONTROL POSITIVO: quien se saltó el asistente y NO ha emitido, SÍ la ve', () => {
  // 🔴 ESTE ES EL TEST QUE JUSTIFICA LA PANTALLA. Sin él, una puerta que no le sale a NADIE
  // dejaría el control negativo en verde y el ticket parecería hecho.
  const sePerdioElPaso = debeOfrecerArranqueDeSerie({
    invoiceSeriesYear: null, año: ANIO, numerosDeLaSerie: [],
  });
  assert.equal(sePerdioElPaso, true, '🔴 al que nunca contestó no se le vuelve a preguntar: no hay segunda oportunidad');
  assert.equal(puerta.puertaSerieVisible(true), true, '🔴 el veredicto es «sí» y la pantalla no la pinta');

  // Y el caso del cambio de año: contestó en 2025 y estamos en 2026, sin emitir todavía.
  assert.equal(
    debeOfrecerArranqueDeSerie({ invoiceSeriesYear: 2025, año: ANIO, numerosDeLaSerie: [] }),
    true,
    '🔴 en enero, al que declaró el año pasado hay que volver a preguntarle',
  );
});

test('SCRUM-D1 · quien YA contestó este año no vuelve a ver la puerta (y su campo NO se bloquea)', () => {
  // El tercer caso, que es el que distingue los dos motivos de «no»: contestó este año y no ha
  // emitido. No hay puerta —ya está contestado— pero el campo sigue siendo suyo.
  assert.equal(
    debeOfrecerArranqueDeSerie({ invoiceSeriesYear: ANIO, año: ANIO, numerosDeLaSerie: [] }),
    false,
  );
  assert.equal(puerta.motivoSerieBloqueada({ emitidas: 0, ejemplo: null }), null,
    '🔴 se le está bloqueando el campo a quien no ha emitido nada');
});

// ═══════════════════════════════════════════════════════════════════════════════════════════
// ② EL CAMPO SERIE, BLOQUEADO CON SU MOTIVO
// ═══════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-D1 · el motivo del bloqueo se DERIVA del servidor, y nombra el número', () => {
  const uno = puerta.motivoSerieBloqueada({ emitidas: 1, ejemplo: '2026-CF-001' });
  assert.match(uno, /1 factura\b/, '🔴 el singular no está cuidado: «1 facturas» se lee como un error');
  assert.match(uno, /2026-CF-001/, '🔴 el motivo no enseña CUÁL fue la última: sin el número no se puede comprobar');

  const varias = puerta.motivoSerieBloqueada({ emitidas: 7, ejemplo: '2026-CF-007' });
  assert.match(varias, /7 facturas/);
  assert.match(varias, /2026-CF-007/);
});

test('SCRUM-D1 · el ejemplo es el número MÁS ALTO, y lo dice UNA sola implementación', () => {
  // `resumenSerieEmitida` se extrajo de `bloqueoCambioDeSerie` para que el aviso de la pantalla y
  // el rechazo del servidor no puedan decir números distintos. Se comprueba que coinciden.
  const nums = ['2026-CF-001', '2026-CF-009', '2026-CF-004'];
  const resumen = resumenSerieEmitida(nums);
  assert.equal(resumen.ejemplo, '2026-CF-009');
  assert.equal(resumen.emitidas, 3);

  const rechazo = bloqueoCambioDeSerie({ prefijoActual: 'CF', prefijoNuevo: 'XX', numerosDeLaSerie: nums });
  assert.equal(rechazo.bloqueado, true);
  assert.equal(rechazo.ejemplo, resumen.ejemplo,
    '🔴 el aviso de la pantalla y el rechazo del servidor enseñan números distintos');
  assert.equal(rechazo.emitidas, resumen.emitidas);
});

// ═══════════════════════════════════════════════════════════════════════════════════════════
// ③ QUE LA PANTALLA CONSUMA EL FLAG, Y NO RECALCULE LA REGLA
// ═══════════════════════════════════════════════════════════════════════════════════════════

const APP_JS = fs.readFileSync(path.join(RAIZ, 'public/dashboard/js/app.js'), 'utf8');
const SETTINGS = fs.readFileSync(path.join(RAIZ, 'public/dashboard/js/settingsView.js'), 'utf8');
const PUERTA = fs.readFileSync(path.join(RAIZ, 'public/dashboard/js/puertaSerie.js'), 'utf8');

test('SCRUM-D1 · el front CONSUME el flag del servidor', () => {
  assert.match(APP_JS, /window\.appPuertaSerieDisponible = me\.puertaSerieDisponible === true;/,
    '🔴 nadie lee `puertaSerieDisponible` de /admin/me: el backend decide y la pantalla no se entera');
  assert.match(APP_JS, /window\.appSerieEmitida = me\.serieEmitida/,
    '🔴 no se recibe `serieEmitida`: el bloqueo del campo tendría que adivinarse');
  assert.match(SETTINGS, /window\.renderPuertaSerie\(/,
    '🔴 Configuración no pinta la puerta');
});

test('SCRUM-D1 · el front NO recalcula la condición (esa regla vive en el servidor)', () => {
  // La forma de la regla es `invoiceSeriesYear !== año`. Si aparece en el navegador, hay dos
  // sitios decidiendo lo mismo — el defecto de siempre, y el de fuera es el fácil de equivocar.
  for (const [nombre, codigo] of [['puertaSerie.js', PUERTA], ['settingsView.js', SETTINGS]]) {
    const sinComentarios = codigo.replace(/\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
    assert.doesNotMatch(
      sinComentarios, /invoiceSeriesYear/,
      `🔴 ${nombre} está mirando invoiceSeriesYear: la condición se reimplementó en el navegador`,
    );
  }
  // Respaldo de la negación (SCRUM-237): el nombre SÍ existe en el servidor, así que el que no
  // aparezca arriba significa algo.
  const FISCAL = fs.readFileSync(path.join(RAIZ, 'src/core/validation/fiscalInput.ts'), 'utf8');
  assert.match(FISCAL, /invoiceSeriesYear/, 'suelo: la regla tiene que existir en el servidor');
});

test('SCRUM-D1 · la vista previa se la pide al SERVIDOR, no la calcula', () => {
  // Sin previa la puerta no protege nada: el usuario no sabe qué confirma. Y calculándola aquí
  // diría un número y la factura otro.
  assert.match(PUERTA, /\/admin\/onboarding\/serie\/previa/,
    '🔴 la puerta no pide la vista previa: el usuario confirmaría a ciegas');
  assert.match(PUERTA, /\/admin\/onboarding\/serie'/,
    '🔴 la puerta no guarda por el mismo endpoint que el asistente');
});

test('SCRUM-D1 · el microcopy es el APROBADO del asistente, literal', () => {
  // Regla 30: reutilizar un rótulo aprobado no es redactarlo. Y que las dos pantallas digan lo
  // MISMO es parte del punto: quien vuelva a verla tiene que reconocerla.
  const ONB = fs.readFileSync(path.join(RAIZ, 'public/dashboard/js/onboardingView.js'), 'utf8');
  for (const frase of [
    'Seguimos por ahí para que tu numeración no tenga saltos.',
    'Compruébalo bien: cuando emitas esa factura, este número ya no se puede cambiar.',
    'No, empiezo ahora',
  ]) {
    assert.ok(ONB.includes(frase), `suelo: «${frase}» tiene que estar en el asistente`);
    assert.ok(PUERTA.includes(frase), `🔴 la puerta no usa el texto aprobado: «${frase}»`);
  }
});

test('SCRUM-D1 · el script está en el SHELL del service worker', () => {
  // `addAll` es ATÓMICO: un script del dashboard fuera del shell deja la app servida a medias.
  const SW = fs.readFileSync(path.join(RAIZ, 'public/sw.js'), 'utf8');
  assert.match(SW, /puertaSerie\.js/, '🔴 el script nuevo no está precacheado');
  const HTML = fs.readFileSync(path.join(RAIZ, 'public/dashboard/index.html'), 'utf8');
  assert.match(HTML, /puertaSerie\.js/, '🔴 el dashboard no carga el script');
});
