// tests/scrum328-aviso-bizum-sin-telefono.test.mjs — SCRUM-328 (F1)
//
// UN FALLO MUDO, Y DE LOS PEORES: el profesional enciende Bizum, su cliente NO ve la opción, y él
// concluye que el producto está roto. Nadie le dice que le falta un teléfono.
//
// ── MEDIDO EN LOS DOS LADOS, ANTES DE TOCAR ────────────────────────────────────────────────
//   · EL CLIENTE — `payInvoice.routes.ts:69-71`: `hasBizum` exige flag **y** teléfono **y** ≤1000 €.
//     Sin teléfono la opción **no se pinta**. No hay error ni aviso: no está.
//   · EL PROFESIONAL — nada. Y peor: `homeView.js:309` da por HECHO «Configura cómo cobras» con
//     `iban || bizumPhone`, así que **quien puso solo el IBAN ve un ✅** y no tiene ningún motivo
//     para sospechar.
//
// ── EL CRITERIO ES EL MISMO QUE EL DEL CLIENTE, NO UNA COPIA ──────────────────────────────
// La página del cliente cae a `whatsappPhone`. Si el aviso mirara solo `bizumPhone`, avisaría a
// merchants **que están bien** — y un aviso que sale cuando no toca se aprende a ignorar, con lo
// que deja de proteger al que sí lo necesita.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { soloEjecutable } from './_guard-texto.mjs';
import { decidirAvisoBizum, hayQueAvisar } from '../dist/modules/billing/domain/avisoBizumSinTelefono.js';

const RAIZ = path.resolve(import.meta.dirname, '..');
const leer = (p) => {
  try {
    return fs.readFileSync(path.join(RAIZ, p), 'utf8');
  } catch (e) {
    assert.fail(`🔴 no se pudo leer ${p} (${e && e.code ? e.code : e}). «Avisa» y «no supe mirar» son el mismo verde.`);
  }
};

// ⚠️ Los telefonos de este fichero van en el RANGO IMPOSIBLE (34 + 0 + 8 digitos, SCRUM-262): un
// `+34 6XX` es un movil español ORDINARIO y puede ser de alguien que no ha pedido nada — y hay tres
// crons que mandan WhatsApp a telefonos guardados. Un dato de prueba no puede acabar en un movil.
//
// ── 1 · CONTROL NEGATIVO, PRIMERO ─────────────────────────────────────────────────────────

test('SCRUM-328 · 🔴 CONTROL NEGATIVO: un merchant CON teléfono no ve ningún aviso', () => {
  for (const caso of [
    { flagBizum: true, bizumPhone: '+34000000001', whatsappPhone: null },
    { flagBizum: true, bizumPhone: null, whatsappPhone: '+34000000001' }, // el fallback del cliente
    { flagBizum: true, bizumPhone: '  +34 000 000 001  ', whatsappPhone: null },
  ]) {
    assert.equal(decidirAvisoBizum(caso), 'no_aplica',
      `🔴 se avisaría a un merchant que ESTÁ BIEN (${JSON.stringify(caso)}). Un aviso que sale `
      + 'cuando no toca se aprende a ignorar, y entonces deja de proteger al que sí lo necesita.');
    assert.equal(hayQueAvisar(decidirAvisoBizum(caso)), false);
  }
});

test('SCRUM-328 · con el flag APAGADO no se avisa de nada', () => {
  // Hoy `BIZUM_MANUAL_ENABLED` está en false: nadie puede usar Bizum, así que avisar de que falta
  // un teléfono para algo que no está encendido es ruido.
  for (const flag of [false, undefined, null, 'true', 1]) {
    assert.equal(decidirAvisoBizum({ flagBizum: flag, bizumPhone: null, whatsappPhone: null }), 'no_aplica',
      `🔴 se avisa con el flag en ${JSON.stringify(flag)}. Solo el booleano true enciende: `
      + 'cualquier otra cosa es «no está encendido», y la CADENA "true" no es el flag.');
  }
});

// ── 2 · EL POSITIVO: el caso que hoy es mudo ──────────────────────────────────────────────

test('SCRUM-328 · 🔴 sin NINGUNO de los dos teléfonos, se avisa', () => {
  for (const caso of [
    { flagBizum: true, bizumPhone: null, whatsappPhone: null },
    { flagBizum: true, bizumPhone: '', whatsappPhone: '' },
    { flagBizum: true, bizumPhone: '   ', whatsappPhone: undefined },
  ]) {
    assert.equal(decidirAvisoBizum(caso), 'falta_telefono',
      `🔴 NO SE AVISA a un merchant SIN teléfono (${JSON.stringify(caso)}).\n\n`
      + '  Su cliente abre la página de pago, NO ve la opción Bizum, y él concluye que el producto\n'
      + '  está roto. Es el fallo mudo entero: el producto sabe exactamente qué falta y se lo calla.');
    assert.equal(hayQueAvisar(decidirAvisoBizum(caso)), true);
  }
});

// ── 3 · EL SUELO, EN EL PEOR SITIO POSIBLE ────────────────────────────────────────────────

test('SCRUM-328 · 🔴 SUELO: un teléfono ILEGIBLE no se degrada a «tiene teléfono»', () => {
  // `tiene teléfono` es justo el valor que HACE DESAPARECER el aviso. Degradar ahí sería el fallo
  // mudo con una capa más de silencio: el producto creería que ha avisado.
  for (const malo of [123456789, {}, [], true, { numero: '+34000000001' }]) {
    const r = decidirAvisoBizum({ flagBizum: true, bizumPhone: malo, whatsappPhone: null });
    assert.equal(r, 'no_se_pudo_leer',
      `🔴 «${JSON.stringify(malo)}» se ha leído como una respuesta válida. Un dato ilegible tiene `
      + 'que salir por su propia puerta, no por la que apaga el aviso.');
    assert.equal(hayQueAvisar(r), true, '🔴 «no se pudo leer» TIENE que avisar: callar es el defecto.');
  }
});

// ── 4 · EL AVISO ESTÁ DONDE SE ARREGLA, Y NO EN OTRO SITIO ────────────────────────────────

test('SCRUM-328 · 🔴 el aviso se pinta JUNTO AL CAMPO que lo arregla', () => {
  const vista = soloEjecutable(leer('public/dashboard/js/settingsView.js'));
  assert.match(vista, /appBizumSinTelefono/,
    '🔴 EL AVISO HA DESAPARECIDO DE CONFIGURACIÓN.\n\n'
    + '  Sin él, un merchant sin teléfono NO SE ENTERA: enciende Bizum, su cliente no ve la opción\n'
    + '  y él concluye que el producto está roto. El aviso tiene que salir donde puede arreglarlo\n'
    + '  —el campo «Móvil de Bizum»— y no en un log ni en una pantalla que no visita.');
  assert.match(vista, /fBizumPhone\.wrapper\.appendChild\(avisoBizum\)/,
    '🔴 el aviso ya no cuelga del campo del teléfono: si se pinta lejos, deja de decir QUÉ arreglar.');
  assert.match(vista, /falta_telefono[\s\S]{0,400}no_se_pudo_leer|no_se_pudo_leer[\s\S]{0,400}falta_telefono/,
    '🔴 el aviso ya no cubre los DOS estados: «no se pudo leer» también tiene que avisar.');
});

test('SCRUM-328 · el veredicto lo da el SERVIDOR, el navegador no lo reimplementa', () => {
  const app = soloEjecutable(leer('src/app.ts'));
  assert.match(app, /bizumSinTelefono: decidirAvisoBizum\(/,
    '🔴 `/admin/me` ya no manda el veredicto. Si el navegador vuelve a decidirlo, habrá DOS reglas '
    + 'para el mismo hecho y discreparán — avisando a quien no toca o callando a quien sí.');
  // 🔴 SE MIRA EL BLOQUE DEL AVISO, NO EL FICHERO ENTERO — y lo aprendí fallando aquí: la vista
  // contiene `bizumPhone` y `whatsappPhone` porque **son dos campos de su formulario**, así que un
  // barrido de todo el fichero acusa a código inocente. Otra vez el guard atado a la FORMA.
  const vista = soloEjecutable(leer('public/dashboard/js/settingsView.js'));
  const bloque = vista.slice(vista.indexOf('var estadoBizum'), vista.indexOf('appendChild(avisoBizum)'));
  assert.ok(bloque.length > 100, '🔴 no se encuentra el bloque del aviso');
  assert.ok(!/whatsappPhone/.test(bloque),
    '🔴 el bloque del aviso mira los teléfonos por su cuenta: eso es reimplementar el criterio del '
    + 'servidor, y dos reglas para el mismo hecho acaban discrepando.');
});

test('SCRUM-328 · la microcopy del aviso es un MARCADOR sin aprobar', () => {
  const vista = leer('public/dashboard/js/settingsView.js');
  const bloque = vista.slice(vista.indexOf('avisoBizum'), vista.indexOf('fBizumPhone.wrapper.appendChild(avisoBizum)'));
  // 17-ago-2026 · FIRMADOS los dos. Lo que este guard defiende NO cambia y por eso sigue exigiendo
  // DOS textos distintos: es lo único que separa «me falta rellenar un campo» de «esto no
  // funciona». Antes se exigían dos marcadores; ahora, los dos textos aprobados.
  for (const t of ['Sin este móvil, tu cliente no ve la opción de Bizum.',
    'No hemos podido comprobar tu móvil de Bizum. Revísalo antes de cobrar por ahí.']) {
    assert.ok(bloque.includes(t), `🔴 falta el aviso aprobado: «${t}»`);
  }
  assert.equal((bloque.match(/\[PENDIENTE microcopy oficial/g) || []).length, 0,
    '🔴 ha vuelto un marcador al aviso de Bizum: o hay un tercer caso sin aprobar, o se ha ' +
    'reintroducido. Si es un caso nuevo, su texto va al censo de SCRUM-402.');
});
