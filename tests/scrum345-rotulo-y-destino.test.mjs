// tests/scrum345-rotulo-y-destino.test.mjs — SCRUM-345 · el rótulo tiene que decir lo que baja.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// EL DEFECTO, Y POR QUÉ ES EL CARO
//
// `plansView.js` ofrecía un enlace rotulado **«cobros»** que apuntaba a `/admin/exports/invoices.csv`
// — el CSV que el propio auditor llama `facturas.csv`. **No estaba roto**: bajaba un fichero REAL,
// se abría, y era otra cosa. El profesional se lo lleva a su gestoría creyendo que es lo que pidió.
//
// Un enlace ROTO se descubre solo (da 404). Un enlace que apunta a otro fichero real **no se
// descubre nunca**, y por eso llevaba escrito y sin decidir en DOS entradas de máster
// (`SCRUM-343.md:55-58` y `SCRUM-321.md:121`).
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// LO QUE VIGILA ESTE CENSO
//
// Cruza el **texto visible** de cada enlace de descarga con el **fichero que de verdad baja**. No
// prohíbe rótulos libres: exige que un rótulo que nombra un TIPO DE DATO conocido —cobros,
// facturas, presupuestos, gastos, clientes— apunte al CSV de ese tipo.
//
// ⚠️ LAS RUTAS SE DERIVAN DEL SERVIDOR, no se adivinan con un patrón. Hoy mismo mi censo dio
// `datos.zip/info` por huérfana **porque la regex no capturaba el segundo segmento** — el defecto
// era del instrumento, no de la ruta.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const RAIZ = path.resolve(import.meta.dirname, '..');
const DIR_JS = path.join(RAIZ, 'public/dashboard/js');

/** Las rutas de descarga que EXISTEN, derivadas de los routers. */
function rutasDelServidor() {
  const out = new Set();
  for (const [rel, prefijo] of [
    ['src/modules/exports/app/routes/exports.routes.ts', '/admin/exports'],
    ['src/modules/fiscal/librosAeat/librosAeat.routes.ts', '/admin/libros'],
  ]) {
    const p = path.join(RAIZ, rel);
    if (!fs.existsSync(p)) continue;
    for (const m of fs.readFileSync(p, 'utf8').matchAll(/router\.get\('([^']*)'/g)) {
      out.add((prefijo + m[1]).replace(/\/$/, ''));
    }
  }
  return out;
}

/**
 * Pares (rótulo, destino) de los enlaces de descarga del front.
 *
 * Se leen los `<a href="…">texto</a>` y los `makeExportBtn('texto', '/ruta')`, que son las dos
 * formas que hay hoy. Si mañana aparece una tercera, el SUELO de abajo lo canta: bajaría el número
 * de pares y el test cae antes de que nadie se fíe de un verde.
 */
function paresDelFront() {
  const out = [];
  for (const f of fs.readdirSync(DIR_JS).filter((n) => n.endsWith('.js'))) {
    const s = fs.readFileSync(path.join(DIR_JS, f), 'utf8');
    for (const m of s.matchAll(/<a[^>]*href="(\/admin\/(?:exports|libros)\/[^"?]+)[^"]*"[^>]*>([^<]+)<\/a>/g)) {
      out.push({ fichero: f, destino: m[1], rotulo: m[2].trim() });
    }
    for (const m of s.matchAll(/makeExportBtn\(\s*'([^']+)'\s*,\s*'(\/admin\/[^']+?)(?:\?[^']*)?'/g)) {
      out.push({ fichero: f, destino: m[2], rotulo: m[1].trim() });
    }
  }
  return out;
}

/**
 * Qué TIPO DE DATO nombra un rótulo, y qué tipo entrega un destino.
 *
 * El vocabulario es el del dominio y está a la vista: si un rótulo no nombra ninguno de estos
 * tipos (p. ej. «descargar todo»), el par no se juzga — el censo no inventa correspondencias.
 */
const TIPOS = [
  { tipo: 'cobros',        rotulo: /\bcobros?\b/i,                      fichero: /charges\.csv$/ },
  { tipo: 'facturas',      rotulo: /\bfacturas?\b/i,                    fichero: /(invoices\.csv|expedidas\.csv)$/ },
  { tipo: 'presupuestos',  rotulo: /\bpresupuestos?\b/i,                fichero: /quotes\.csv$/ },
  { tipo: 'gastos',        rotulo: /\bgastos?\b/i,                      fichero: /expenses\.csv$/ },
  { tipo: 'clientes',      rotulo: /\bclientes?\b/i,                    fichero: /customers\.csv$/ },
];

// ── SUELO ────────────────────────────────────────────────────────────────────────────────────

test('SCRUM-345 · SUELO: el censo LEE pares rótulo/destino', () => {
  const pares = paresDelFront();
  assert.ok(pares.length >= 6,
    `🔴 el censo solo ha leído ${pares.length} pares rótulo/destino. **«Ningún rótulo miente» y «no ` +
    'supe leer los rótulos» son el mismo verde**, y este ticket existe porque uno mintió durante ' +
    'días. Si el front cambió de forma de pintar enlaces, arregla el extractor ANTES de creerte nada.');
  assert.ok(pares.some((p) => /cobros/i.test(p.rotulo)), '🔴 no se lee el rótulo «cobros», que es el del caso.');
});

test('SCRUM-345 · SUELO: las rutas del servidor se derivan, no se adivinan', () => {
  const rutas = rutasDelServidor();
  assert.ok(rutas.size >= 8, `🔴 solo se han derivado ${rutas.size} rutas de descarga del servidor.`);
  assert.ok(rutas.has('/admin/exports/charges.csv'), '🔴 no se ve `charges.csv`, que es el destino correcto del caso.');
  // El fallo de hoy, congelado: la regex que no capturaba el segundo segmento daba esta ruta por
  // inexistente. Si vuelve a pasar, cae aquí.
  assert.ok(rutas.has('/admin/exports/datos.zip/info'),
    '🔴 el derivador no ve `datos.zip/info`. Es el fallo exacto de hoy: un patrón que no captura el ' +
    'segundo segmento convierte una ruta viva en «huérfana» — defecto del instrumento, no de la ruta.');
});

// ── EL CENSO ─────────────────────────────────────────────────────────────────────────────────

test('SCRUM-345 · 🔴 ningún rótulo nombra un tipo de dato que su destino NO entrega', () => {
  const mentiras = [];
  for (const p of paresDelFront()) {
    const dice = TIPOS.find((t) => t.rotulo.test(p.rotulo));
    if (!dice) continue;                       // rótulo que no nombra un tipo: no se juzga
    if (!dice.fichero.test(p.destino)) {
      mentiras.push(`${p.fichero}: «${p.rotulo}» → ${p.destino} (dice ${dice.tipo}, baja otra cosa)`);
    }
  }

  assert.deepEqual(mentiras, [],
    `🔴 HAY RÓTULOS QUE NO DICEN LO QUE BAJAN:\n   ${mentiras.join('\n   ')}\n\n` +
    '  Un enlace ROTO se descubre solo: da 404. Uno que apunta a otro fichero REAL **no se descubre\n' +
    '  nunca** — el profesional se lo lleva a su gestoría creyendo que es lo que pidió. Ése fue el\n' +
    '  caso de «cobros» → `invoices.csv`, escrito y sin decidir en dos entradas de máster.\n\n' +
    '  O el destino es el que corresponde al rótulo, o el rótulo tiene que decir otra cosa — y eso\n' +
    '  segundo es microcopy (regla 30) y lo aprueba el fundador.');
});

test('SCRUM-345 · el enlace de «cobros» baja COBROS', () => {
  // El caso del ticket, fijado por su nombre para que un refactor no lo pierda entre los demás.
  const par = paresDelFront().find((p) => p.fichero === 'plansView.js' && /cobros/i.test(p.rotulo));
  assert.ok(par, '🔴 ha desaparecido el enlace de cobros de la tarjeta de prueba caducada.');
  assert.match(par.destino, /charges\.csv$/,
    `🔴 «cobros» vuelve a apuntar a ${par.destino}. Decisión del fundador (10-ago-2026): se reapunta ` +
    'el enlace, NO se renombra el rótulo — quien lo pulsa quiere cobros, y renombrarlo dejaría esta ' +
    'pantalla sin acceso a ellos.');
});

test('SCRUM-345 · CONTROL POSITIVO: los demás rótulos siguen casando', () => {
  // Sin esto, «cero mentiras» daría igual de verde si el extractor dejara de leer pares o si el
  // vocabulario no casara con nada.
  const pares = paresDelFront();
  const juzgados = pares.filter((p) => TIPOS.some((t) => t.rotulo.test(p.rotulo)));
  assert.ok(juzgados.length >= 5,
    `🔴 solo ${juzgados.length} pares nombran un tipo conocido: el censo estaría aprobando por no ` +
    'entender lo que lee.');
  for (const t of ['presupuestos', 'gastos']) {
    assert.ok(juzgados.some((p) => new RegExp(t, 'i').test(p.rotulo)),
      `🔴 no se juzga ningún rótulo de «${t}»: el vocabulario ha dejado de casar.`);
  }
});
