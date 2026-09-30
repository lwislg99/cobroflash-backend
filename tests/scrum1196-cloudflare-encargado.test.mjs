// tests/scrum1196-cloudflare-encargado.test.mjs — SCRUM-1196 (L3)
//
// CLOUDFLARE VE TODO EL TRÁFICO DE yaqu.app, Y LA POLÍTICA TIENE QUE DECIRLO.
//
// `yaqu.app` va detrás de Cloudflare: le pasan por delante las páginas de presupuesto, firma y pago
// que abren los clientes finales, y gestiona el correo de las direcciones @yaqu.app. Hasta este
// ticket el §5 de `public/privacidad.html` no lo nombraba: una lista de encargados que omite al que
// ve todo dice algo falso.
//
// El literal lo firmó el fundador (SCRUM-1196, comentario 17453). Este guard lo lee de su registro
// de aprobación en `docs/microcopy/` —no de una copia escrita aquí— y exige que la página lo
// contenga carácter a carácter, JUSTO DESPUÉS de la fila de Railway, que es donde se firmó.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { aprobacionesDeMicrocopy } from './_microcopy-aprobada.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PAGINA = path.join(RAIZ, 'public', 'privacidad.html');

/** Los títulos VISIBLES que acotan el §5 (los mismos que usa el guard de SCRUM-1154). */
const TITULO_ENCARGADOS = 'Con quién compartimos los datos';
const TITULO_SIGUIENTE = 'Conservación';
const FILA_RAILWAY = '<li><strong>Railway</strong>';

function seccionDeEncargados(html) {
  const desde = html.indexOf(TITULO_ENCARGADOS);
  assert.notEqual(desde, -1, `🔴 no aparece «${TITULO_ENCARGADOS}»: el guard no sabe dónde mirar.`);
  const hasta = html.indexOf(TITULO_SIGUIENTE, desde);
  assert.notEqual(hasta, -1, `🔴 no aparece «${TITULO_SIGUIENTE}»: el §5 no tiene final que acotar.`);
  return html.slice(desde, hasta);
}

/**
 * La ficha VIGENTE del texto de Cloudflare: por ticket Y ranura (SCRUM-1306). La primera versión la
 * elegía por ticket, y el `.find` se quedaba con la ficha MÁS ANTIGUA de SCRUM-1196 (el barrido va
 * por nombre y el nombre empieza por la fecha). Una firma nueva trae ranura nueva: se cambia AQUÍ.
 */
const FICHA_VIGENTE = { ticket: 'SCRUM-1196', ranura: 'encargado-cloudflare' };

/** El literal tal como lo FIRMÓ el fundador, leído de su registro de aprobación. */
function textoFirmadoDeCloudflare(opciones) {
  const registro = aprobacionesDeMicrocopy(opciones)
    .find((a) => a.ticket === FICHA_VIGENTE.ticket && a.ranura === FICHA_VIGENTE.ranura);
  assert.ok(registro, '🔴 no existe en `docs/microcopy/` un registro de SCRUM-1196 con la fila de Cloudflare.');
  assert.equal(registro.aprobada, true,
    `🔴 el registro de Cloudflare no cuenta como aprobado (firmante: ${registro.firmante}). `
    + 'Un texto legal publicado necesita la firma del fundador (regla 39).');
  return registro.literales.find((l) => l.includes('Cloudflare'));
}

/** La fila que sigue a la de Railway dentro del §5, o `null` si no hay Railway. */
function filaTrasRailway(seccion) {
  const i = seccion.indexOf(FILA_RAILWAY);
  if (i === -1) return null;
  const finRailway = seccion.indexOf('</li>', i);
  // La siguiente `<li …>`, con hueco para atributos (SCRUM-553: nada de `>` pegado a la etiqueta).
  const m = /<li(?:\s[^>]*)?>[\s\S]*?<\/li>/.exec(seccion.slice(finRailway));
  return m ? m[0] : null;
}

const html = fs.readFileSync(PAGINA, 'utf8');

test('SCRUM-1196 · SUELO: el §5 se acota y tiene la fila de Railway donde anclar', () => {
  const seccion = seccionDeEncargados(html);
  for (const esperado of ['Meta Platforms', 'Stripe', 'Resend', FILA_RAILWAY]) {
    assert.ok(seccion.includes(esperado), `🔴 el §5 acotado no contiene «${esperado}»: está mirando otra parte.`);
  }
  assert.ok(!seccion.includes(TITULO_SIGUIENTE), 'y el corte no se pasa a la sección siguiente');
});

test('SCRUM-1196 · L3: Cloudflare figura en el §5 con el texto FIRMADO, justo después de Railway', () => {
  const firmado = textoFirmadoDeCloudflare();
  const seccion = seccionDeEncargados(html);
  assert.ok(seccion.includes(firmado),
    '🔴 el §5 no contiene —carácter a carácter— el texto que el fundador firmó para Cloudflare '
    + '(SCRUM-1196, comentario 17453). Cloudflare ve todo el tráfico de yaqu.app.');
  assert.equal(filaTrasRailway(seccion), firmado,
    '🔴 la fila de Cloudflare no va justo después de la de Railway, que es donde se firmó.');
});

test('SCRUM-1196 · 🔴 CONTROLES: sin la fila, o con una coma cambiada, el guard lo ve', () => {
  const firmado = textoFirmadoDeCloudflare();
  const seccion = seccionDeEncargados(html);

  const sinFila = seccion.replace(firmado, '');
  assert.ok(!sinFila.includes(firmado), 'control: quitando la fila, el literal ya no está');
  assert.notEqual(filaTrasRailway(sinFila), firmado, 'control: y la fila tras Railway deja de ser la firmada');

  const retocada = seccion.replace(firmado, firmado.replace('(transferencia internacional)', '(transferencia internacional.)'));
  assert.ok(retocada.includes('Cloudflare'), 'el caso retocado sigue nombrando a Cloudflare: si no, no prueba nada');
  assert.ok(!retocada.includes(firmado), 'control: un literal retocado NO cuenta como el firmado');

  const movida = sinFila.replace('</ul>', `  ${firmado}\n    </ul>`);
  assert.ok(movida.includes(firmado), 'control: la fila movida al final sí está');
  assert.notEqual(filaTrasRailway(movida), firmado, 'control: pero no está tras Railway, y el guard lo distingue');
});

test('SCRUM-1306 · 🔴 CONTROL: con una ficha MÁS ANTIGUA del mismo ticket, el guard sigue leyendo la vigente', () => {
  // Carpeta temporal: escribir una ficha de mentira en docs/microcopy/ la vería cualquier guard que
  // corra en paralelo. La vigente se copia tal cual; la antigua lleva la misma firma y otro literal.
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'scrum1306-'));
  try {
    const vigente = aprobacionesDeMicrocopy()
      .find((a) => a.ticket === FICHA_VIGENTE.ticket && a.ranura === FICHA_VIGENTE.ranura);
    fs.copyFileSync(path.join(RAIZ, 'docs', 'microcopy', vigente.nombre), path.join(dir, vigente.nombre));
    const ANTIGUA = '2026-09-01-SCRUM-1196-version-anterior.md';
    const VIEJO = '<li><strong>Cloudflare</strong> — texto anterior, ya superado.</li>';
    fs.writeFileSync(path.join(dir, ANTIGUA), '# Versión anterior (control de SCRUM-1306)\n\n'
      + '**Aprobado por el fundador** el 1-sep-2026, en **SCRUM-1196**.\n\n'
      + '| Ranura | Texto aprobado |\n|---|---|\n| `anterior` | `' + VIEJO + '` |\n');
    const o = { dir };
    const todas = aprobacionesDeMicrocopy(o);
    assert.equal(todas.find((a) => a.ruta.includes('SCRUM-1196')).nombre, ANTIGUA,
      'el caso sí planta el problema: por ticket a secas, la primera ficha es la antigua');
    const antigua = todas.find((a) => a.nombre === ANTIGUA);
    assert.ok(antigua.aprobada && antigua.literales.includes(VIEJO),
      'y la antigua cuenta como firmada, con su literal: si no, el caso no prueba nada');
    assert.equal(textoFirmadoDeCloudflare(o), textoFirmadoDeCloudflare(),
      '🔴 con una ficha más antigua del mismo ticket, el guard ha pasado a leer la ANTIGUA. Tiene que '
      + 'elegir la ficha vigente por ticket y ranura (SCRUM-1306), no la primera del ticket.');
    assert.notEqual(textoFirmadoDeCloudflare(o), VIEJO, 'y el literal que devuelve no es el superado');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
