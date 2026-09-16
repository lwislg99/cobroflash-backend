// tests/scrum373-avisos-facturas.test.mjs — SCRUM-373
//
// ANTE EL MISMO FALLO, UNA PANTALLA DABA UNA SALIDA Y LA OTRA UN DIAGNÓSTICO. Medido al cerrar
// SCRUM-301: la lista de albaranes decía «No se han podido cargar los albaranes. Vuelve a
// intentarlo.» y la de facturas, ante el mismo fallo, «Error cargando facturas.» — el profesional
// leía un diagnóstico y no sabía si se arregla solo, si tiene que recargar o si ha perdido algo.
//
// Aquí viven las TRES ranuras de aviso de `invoicesView.js` con su texto firmado por el asesor.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// POR QUÉ ESTE GUARD LEE RANURAS Y NO BUSCA TEXTOS (y aquí importa más que en SCRUM-301)
//
// Las tres frases se parecen MUCHO entre ellas: las tres empiezan igual y las tres terminan en
// «Vuelve a intentarlo.». Un guard que comprobara «¿está esta cadena en el fichero?» daría verde
// con dos de ellas INTERCAMBIADAS — y entonces, al fallar el marcado en bloque, la pantalla diría
// «no se han podido cargar las facturas», que es otra cosa y manda a recargar en vez de a reintentar
// la acción.
//
// Por eso cada texto se lee DEL AST, dentro del `catch` que lo pinta, y cada `catch` se identifica
// por algo que solo él tiene: su `console.error` con etiqueta, o estar dentro del listener del
// botón de marcar en bloque.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// LO QUE ESTE FICHERO **NO** VIGILA, dicho aquí y no descubierto en un rojo raro
//
//  · `'Cargando…'` — es COMPARTIDA (tres sitios de esta vista, y la misma cadena que usa
//    `albaranesView.js`). Decisión del asesor: se queda fuera; someterla aquí la convertiría en
//    texto oficial de pantallas que este ticket no toca.
//  · Los dos `throw new Error('Error cargando…')` de `fetchInvoices`/`fetchPendientesFacturar`
//    (:13 y :21). MEDIDO: su mensaje NO llega a ninguna pantalla — `err.message` no se pinta en
//    ningún sitio de esta vista; solo alimenta `console.error`. Son diagnóstico para quien mira la
//    consola, no copy para el profesional.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const F_VISTA = path.join(RAIZ, 'public', 'dashboard', 'js', 'invoicesView.js');
const VISTA = fs.readFileSync(F_VISTA, 'utf8');

/** Los tres textos FIRMADOS por el asesor (SCRUM-373). Cambiarlos es decisión suya. */
const COPY_FIRMADA = {
  cargarListado: 'No se han podido cargar las facturas. Vuelve a intentarlo.',
  cargarPendientes: 'No se han podido cargar los pendientes de facturar. Vuelve a intentarlo.',
  marcarPagadas: 'No se han podido marcar como pagadas. Vuelve a intentarlo.',
};

/**
 * Lee el aviso de cada `catch` y lo ata a SU ranura.
 *
 * Identificar por el nombre de la variable no vale: `statusBox.textContent` se asigna en TRES
 * sitios de esta vista (el éxito del marcado, el error del marcado y el error de carga). Lo que
 * distingue a cada `catch` es su contexto:
 *
 *   · `console.error('[renderInvoicesView] error', …)`            → cargar el listado
 *   · `console.error('[renderInvoicesView] pendientes error', …)` → cargar los pendientes
 *   · estar DENTRO del listener de `#bulk-paid-btn`               → marcar como pagadas
 */
function ranurasDeAviso(fuente) {
  const sf = ts.createSourceFile('x.js', fuente, ts.ScriptTarget.Latest, true);

  // SCRUM-375: el aviso del marcado en bloque dejó de ser un literal en el `catch` y pasó a una
  // constante con nombre (`COPY_BULK_PAGADAS.escrituraFallida`), porque ese camino se partió en dos
  // -escritura y recarga- y cada mitad tiene su mensaje. El guard sigue atado a LA RANURA: lo que
  // cambia es que ahora resuelve la constante en vez de exigir el literal pegado ahí.
  const constantes = new Map();
  const recogeConstantes = (n) => {
    if (ts.isPropertyAssignment(n) && (ts.isIdentifier(n.name) || ts.isStringLiteral(n.name)) &&
        (ts.isStringLiteral(n.initializer) || ts.isNoSubstitutionTemplateLiteral(n.initializer))) {
      constantes.set(n.name.text, n.initializer.text);
    }
    ts.forEachChild(n, recogeConstantes);
  };
  recogeConstantes(sf);

  const texto = (n) => {
    if (!n) return null;
    if (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) return n.text;
    // `X.propiedad` → el literal con el que se declaró esa propiedad.
    if (ts.isPropertyAccessExpression(n) && constantes.has(n.name.text)) return constantes.get(n.name.text);
    return null;
  };

  // 1) El rango del callback del botón «marcar como pagadas».
  let rangoBulk = null;
  const buscaBulk = (n) => {
    if (ts.isCallExpression(n) && ts.isPropertyAccessExpression(n.expression) &&
        n.expression.name.text === 'addEventListener' &&
        /['"]#bulk-paid-btn['"]/.test(n.expression.expression.getText(sf))) {
      const cb = n.arguments[1];
      if (cb) rangoBulk = [cb.getStart(sf), cb.getEnd()];
    }
    ts.forEachChild(n, buscaBulk);
  };
  buscaBulk(sf);

  // 2) Cada `catch`: su aviso pintado y su sello.
  const ranuras = {};
  const visita = (n) => {
    if (ts.isCatchClause(n)) {
      const avisos = [];
      const sellos = [];
      const dentro = (m) => {
        if (ts.isBinaryExpression(m) && m.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
            ts.isPropertyAccessExpression(m.left) && m.left.name.text === 'textContent') {
          const t = texto(m.right);
          if (t !== null) avisos.push({ destino: m.left.expression.getText(sf), texto: t });
        }
        if (ts.isCallExpression(m) && /console\.error$/.test(m.expression.getText(sf))) {
          const t = texto(m.arguments[0]);
          if (t !== null) sellos.push(t);
        }
        ts.forEachChild(m, dentro);
      };
      dentro(n.block);

      const enBulk = rangoBulk && n.getStart(sf) > rangoBulk[0] && n.getEnd() < rangoBulk[1];
      // El aviso es el que se pinta en una caja de estado, no el rótulo que se restaura al botón.
      const aviso = avisos.find((a) => /statusBox$/i.test(a.destino));
      if (!aviso) return ts.forEachChild(n, visita);

      if (sellos.some((s) => s.includes('pendientes error'))) ranuras.cargarPendientes = aviso.texto;
      else if (sellos.some((s) => s.includes('[renderInvoicesView] error'))) ranuras.cargarListado = aviso.texto;
      else if (enBulk) ranuras.marcarPagadas = aviso.texto;
    }
    ts.forEachChild(n, visita);
  };
  visita(sf);
  return ranuras;
}

// ── SUELO ────────────────────────────────────────────────────────────────────────────────

test('SCRUM-373 · SUELO: el lector encuentra LAS TRES ranuras, cada una por su contexto', () => {
  const r = ranurasDeAviso(VISTA);
  const ausentes = Object.keys(COPY_FIRMADA).filter((k) => typeof r[k] !== 'string');
  assert.deepEqual(ausentes, [],
    '🔴 el lector no ha encontrado: ' + ausentes.join(', ') +
    '\n\n  O la vista cambió de forma, o el lector dejó de mirar donde debía. Sin las tres, los\n' +
    '  asserts de abajo compararían `undefined` y este fichero sería un verde vacío.');
  assert.equal(new Set(Object.values(r)).size, 3,
    '🔴 dos ranuras están leyendo el MISMO texto: el lector no las distingue');
});

// ── EL TEXTO FIRMADO, RANURA A RANURA ────────────────────────────────────────────────────

test('SCRUM-373 · cada aviso dice su texto FIRMADO, y ninguno empieza por «Error»', () => {
  const r = ranurasDeAviso(VISTA);
  for (const [ranura, firmado] of Object.entries(COPY_FIRMADA)) {
    assert.equal(r[ranura], firmado,
      `🔴 LA RANURA «${ranura}» YA NO DICE SU TEXTO FIRMADO.\n` +
      `     firmado:  ${JSON.stringify(firmado)}\n` +
      `     y ahora:  ${JSON.stringify(r[ranura])}\n\n` +
      '  Lo firmó el asesor: cambiarlo —aunque sea una letra— es decisión suya.');
  }

  // La forma es la que separa una salida de un diagnóstico, y es lo que este ticket vino a igualar.
  for (const [ranura, t] of Object.entries(r)) {
    assert.equal(/^Error\b/.test(t), false,
      `🔴 «${ranura}» vuelve a empezar por «Error»: eso es un diagnóstico, no una salida.`);
    assert.ok(t.endsWith('Vuelve a intentarlo.'),
      `🔴 «${ranura}» no le dice al profesional qué hacer. El patrón es nombrar lo que falló y dar ` +
      'salida — es lo que hace que las dos pantallas hermanas respondan igual al mismo fallo.');
  }
});

test('SCRUM-373 · el verbo es el de LA ACCIÓN QUE FALLÓ, no un genérico', () => {
  const r = ranurasDeAviso(VISTA);
  // Medido en el handler antes de escribir el texto: el botón `#bulk-paid-btn` llama a
  // `POST /admin/invoices/bulk-paid`, y esa ruta hace `updateMany({ status: 'paid', paidAt })`. La
  // acción que falla es MARCAR COMO PAGADAS — no «actualizar las facturas», que no dice qué se
  // intentó, ni «cargar», que es de otra ranura.
  assert.match(r.marcarPagadas, /marcar como pagadas/,
    '🔴 el aviso del marcado en bloque no nombra la acción que falló');
  assert.equal(/cargar/.test(r.marcarPagadas), false,
    '🔴 el aviso de una ESCRITURA fallida habla de cargar: manda a recargar cuando lo que hay que ' +
    'hacer es reintentar la acción.');
  assert.match(r.cargarListado, /cargar las facturas/);
  assert.match(r.cargarPendientes, /cargar los pendientes de facturar/);
});

// ── 🔴 EL SABOTAJE QUE DECIDE: LAS TRES SE PARECEN DEMASIADO ─────────────────────────────

test('SCRUM-373 · 🔴 el guard vigila LA RANURA: intercambiar dos avisos sale rojo', () => {
  // Las tres frases empiezan igual y acaban igual. Un guard que buscara las cadenas por el fuente
  // daría verde con dos intercambiadas, porque las dos siguen escritas — y en pantalla, al fallar
  // el marcado en bloque, el profesional leería «no se han podido cargar las facturas» y se pondría
  // a recargar en vez de reintentar la acción.
  const cruzada = VISTA
    .replace(`'${COPY_FIRMADA.marcarPagadas}'`, '«HUECO»')
    .replace(`'${COPY_FIRMADA.cargarListado}'`, `'${COPY_FIRMADA.marcarPagadas}'`)
    .replace('«HUECO»', `'${COPY_FIRMADA.cargarListado}'`);
  assert.notEqual(cruzada, VISTA, '🔴 el sabotaje no ha cambiado nada');

  // Las dos cadenas SIGUEN en el fichero, palabra por palabra: por eso una búsqueda daría verde.
  assert.ok(cruzada.includes(COPY_FIRMADA.marcarPagadas) && cruzada.includes(COPY_FIRMADA.cargarListado),
    '🔴 el sabotaje ha borrado una de las dos: entonces no prueba lo que dice probar');

  const r = ranurasDeAviso(cruzada);
  assert.equal(r.marcarPagadas, COPY_FIRMADA.cargarListado,
    '🔴 EL LECTOR NO DISTINGUE LAS RANURAS: con los dos avisos intercambiados sigue leyendo lo ' +
    'mismo en cada una, así que este guard solo comprueba que unas palabras están escritas en ' +
    'alguna parte del fichero.');
  assert.equal(r.cargarListado, COPY_FIRMADA.marcarPagadas);
});

test('SCRUM-373 · los `throw` internos NO son copy, y se quedan como están', () => {
  // Están fuera del alcance a propósito (ver cabecera): su mensaje no llega a ninguna pantalla.
  // Este test lo deja MEDIDO en vez de supuesto — si algún día alguien pinta `err.message`, esas
  // dos cadenas pasarían a ser copy y habría que someterlas.
  assert.equal(/\berr\.message\b|\be\.message\b/.test(VISTA), false,
    '🔴 esta vista ha empezado a PINTAR el mensaje de la excepción. Entonces los `throw` de ' +
    '`fetchInvoices`/`fetchPendientesFacturar` («Error cargando facturas») ya son texto que lee el ' +
    'profesional, y vuelven a estar sin aprobar: hay que someterlos al asesor.');
});
