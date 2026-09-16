// tests/scrum703-rotulos-del-tipo.test.mjs — SCRUM-703
//
// LA VÍCTIMA: el profesional que abre un trabajo y elige mal el tipo de intervención porque
// alguien cambió un rótulo firmado y nadie se enteró. El tipo viaja al parte y acaba en el papel.
//
// Estos rótulos los FIRMÓ el fundador el 3-sep-2026 —la etiqueta y los tres valores literales del
// papel de Tecnosel— y hasta hoy no los sujetaba NADA: ningún test llamaba a
// `tiposIntervencionParaUI()`. Se comparan con `===`, no con `match`: una coma, una tilde o una
// minúscula distinta ES un rótulo distinto.
//
// 🔴 Y CAE CON EL MECANISMO VIEJO está garantizado porque HOY NO CAE NADA: antes de este fichero,
// cambiar «Reparación / Asistencia técnica» por cualquier otra cosa dejaba la suite entera en
// verde. Ése es el contraste, y no hace falta simularlo.
//
// ⚠️ AQUÍ NO SE ESCRIBE EL VOCABULARIO. Los tres identificadores viven en UNA sola fuente
// (`src/modules/jobs/domain/tipoIntervencion.ts`) y el guard de SCRUM-651 cae si alguien los
// vuelve a listar. Se importan y se emparejan POR SU ORDEN. Lo que sí se fija aquí es el COPY
// aprobado, que es lo que este fichero existe para proteger.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { tiposIntervencionParaUI, TIPOS_INTERVENCION } =
  await import('../dist/modules/jobs/domain/tipoIntervencion.js');

// El copy firmado, LITERAL y en el orden del vocabulario. Cambiar algo aquí es cambiar copy
// aprobado (regla 30): se propone, no se edita.
const ROTULOS_FIRMADOS = Object.freeze([
  'Reparación / Asistencia técnica',
  'Mantenimiento',
  'Instalación',
]);
const ETIQUETA_FIRMADA = 'Tipo de intervención';
const MARCADOR = '[PENDIENTE microcopy oficial]';

// ── SUELO ────────────────────────────────────────────────────────────────────────────────
// Si la función dejara de devolver rótulos, comparar cero con cero daría verde. «Cero» y «no
// supe mirar» no son el mismo número.
test('SCRUM-703 · SUELO: la función devuelve los TRES tipos, con valor y rótulo', () => {
  assert.equal(typeof tiposIntervencionParaUI, 'function', '🔴 el módulo ya no exporta la función');
  const l = tiposIntervencionParaUI();
  assert.ok(Array.isArray(l), '🔴 no devuelve una lista');
  assert.equal(l.length, ROTULOS_FIRMADOS.length,
    `🔴 se esperaban ${ROTULOS_FIRMADOS.length} tipos y llegaron ${l.length}. El vocabulario es`
    + ' CERRADO: si entra o sale uno, su rótulo hay que FIRMARLO antes de enseñarlo.');
  assert.equal(l.length, TIPOS_INTERVENCION.length,
    '🔴 la lista para la UI y el vocabulario ya no tienen el mismo tamaño');
  for (const t of l) {
    assert.equal(typeof t.valor, 'string', '🔴 falta `valor`');
    assert.ok(t.rotulo && t.rotulo.length > 0, `🔴 «${t.valor}» viene sin rótulo`);
  }
});

// ── EL CONTROL QUE DECIDE ────────────────────────────────────────────────────────────────
test('SCRUM-703 · 🔴 cada rótulo es EXACTAMENTE el que se firmó, y el rojo lo NOMBRA', () => {
  const lista = tiposIntervencionParaUI();
  lista.forEach((t, i) => {
    // El emparejamiento es POR ORDEN contra la fuente: si alguien reordena el vocabulario
    // cerrado, este rojo lo dice, y reordenarlo también merece una mirada.
    assert.strictEqual(t.valor, TIPOS_INTERVENCION[i],
      `🔴 el orden del vocabulario cambió en la posición ${i}: era «${TIPOS_INTERVENCION[i]}»`
      + ` y la UI enseña «${t.valor}». Revisa el emparejamiento con el copy firmado.`);
    assert.strictEqual(t.rotulo, ROTULOS_FIRMADOS[i],
      `🔴 EL RÓTULO DE «${t.valor}» YA NO ES EL FIRMADO.\n`
      + `      firmado: ${JSON.stringify(ROTULOS_FIRMADOS[i])}\n`
      + `      ahora  : ${JSON.stringify(t.rotulo)}\n`
      + '    Lo aprobó el fundador el 3-sep-2026 con los literales del papel de Tecnosel.'
      + ' Cambiarlo es cambiar copy aprobado (regla 30): se propone, no se edita.');
  });
});

test('SCRUM-703 · 🔴 ni un marcador vuelve a colarse en un rótulo ya firmado', () => {
  for (const { valor, rotulo } of tiposIntervencionParaUI()) {
    assert.ok(!rotulo.includes(MARCADOR),
      `🔴 «${valor}» ha vuelto a salir marcado: ${JSON.stringify(rotulo)}`);
  }
});

test('SCRUM-703 · 🔴 la etiqueta del desplegable sigue firmada y SIN marca en la pantalla', () => {
  const js = fs.readFileSync(
    path.join(RAIZ, 'public', 'dashboard', 'js', 'jobNuevoModal.js'), 'utf8');
  assert.ok(js.includes(ETIQUETA_FIRMADA),
    `🔴 la etiqueta firmada «${ETIQUETA_FIRMADA}» ya no aparece en el modal`);
  // Y no vale volver a marcarla: el resto del modal sigue sin firmar, pero ÉSTA no.
  assert.ok(!js.includes("MARCA_651 + ' " + ETIQUETA_FIRMADA),
    `🔴 «${ETIQUETA_FIRMADA}» ha vuelto a salir con marcador, y está FIRMADA desde el 3-sep-2026`);
});

// ── Y QUE LLEGUE ─────────────────────────────────────────────────────────────────────────
// Los rótulos viven en el servidor a propósito: el navegador no puede tener una segunda lista
// del vocabulario cerrado. Si el servidor deja de mandarlos, el desplegable se queda vacío.
test('SCRUM-703 · los rótulos SALEN hacia el navegador, no se quedan en el módulo', () => {
  const app = fs.readFileSync(path.join(RAIZ, 'src', 'app.ts'), 'utf8');
  assert.match(app, /tiposIntervencion:\s*tiposIntervencionParaUI\(\)/,
    '🔴 el servidor ya no manda los tipos: el desplegable se queda sin opciones');
  const modal = fs.readFileSync(
    path.join(RAIZ, 'public', 'dashboard', 'js', 'jobNuevoModal.js'), 'utf8');
  assert.match(modal, /window\.appTiposIntervencion/,
    '🔴 el modal ya no lee los tipos que manda el servidor');
});
