// tests/scrum597-las-dos-secciones-conviven.test.mjs — SCRUM-597 (DOC-07)
//
// ═════════════════════════════════════════════════════════════════════════════════════════════
// LAS DOS SECCIONES DE LA FICHA DE FACTURA CONVIVEN — y esto se EJECUTA, no se lee.
//
// ── QUÉ VIENE A IMPEDIR ─────────────────────────────────────────────────────────────────────
// SCRUM-595 («Etiquetas del documento») y SCRUM-597 («Quién lleva este documento») añaden un
// bloque en el MISMO sitio de `invoiceDetailView.js`: después de «Datos» y antes de «Acciones».
// Al mezclar, git marcó las dos como el mismo conflicto, y la resolución fácil —quedarse con un
// lado— habría hecho desaparecer una sección entera del producto sin que nada se pusiera rojo:
// las dos son `page.appendChild(...)` sueltos, sin variables compartidas, así que la que faltara
// no rompería nada. Simplemente no estaría.
//
// 🔴 POR ESO NO SE COMPRUEBA LEYENDO EL FICHERO. Un guard de texto que busque las dos cadenas
// diría «están» sobre un fichero que no llega a ejecutar ninguna. Aquí se EJECUTA la región de
// la unión con un DOM de juguete y se exige que las DOS se monten de verdad.
//
// ── LO QUE ESTO NO ES ───────────────────────────────────────────────────────────────────────
// No monta `renderInvoiceDetailView` entero: eso pide navegador y red (`apiRequest`), y esta
// tanda no levanta ninguno de los dos. Lo que se ejecuta es EXACTAMENTE el trozo de fuente que
// el merge tocó, con sus condiciones reales. Si mañana una de las dos secciones se cae de ese
// trozo, este caso lo dice; si lo que se rompe es el render de alrededor, no — y queda escrito
// para que nadie lea de más.
//
// Patrón de la casa: fuente + `new Function` + DOM de juguete, como `scrum650d` y `scrum655`.
// Ni navegador, ni red, ni dependencias nuevas.
// ═════════════════════════════════════════════════════════════════════════════════════════════
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const VISTA = path.join(RAIZ, 'public/dashboard/js/invoiceDetailView.js');

/** El DOM mínimo que usa la región: crear nodos y colgarlos. */
function documentoDeJuguete() {
  const crear = (tag) => ({
    tag, className: '', textContent: '', innerHTML: '', hijos: [], dataset: {}, style: {},
    appendChild(n) { this.hijos.push(n); return n; },
    setAttribute() {},
  });
  return { createElement: crear };
}

/**
 * La región que el merge tocó: de la cabecera de «etiquetas» hasta la de «acciones».
 *
 * 🔴 SUELO: si no se encuentra, esto FALLA en vez de ejecutar el vacío. Un «las dos se montan»
 * sobre cero líneas sería verde y no significaría nada — y ése es justo el error que este
 * fichero existe para no repetir.
 */
function regionDeLaUnion() {
  const fuente = fs.readFileSync(VISTA, 'utf8');
  const ini = fuente.indexOf('// --- Sección: etiquetas (SCRUM-595');
  const fin = fuente.indexOf('// --- Sección: acciones');
  assert.ok(ini >= 0,
    '🔴 CIEGO: no encuentro la cabecera de la sección de ETIQUETAS (SCRUM-595) en '
    + '`invoiceDetailView.js`. O se ha ido, o cambió de rótulo: en los dos casos hay que mirarlo '
    + 'antes de fiarse de nada de lo de abajo.');
  assert.ok(fin > ini,
    '🔴 CIEGO: no encuentro la cabecera de la sección de ACCIONES, que es donde acaba la región '
    + 'que este caso ejecuta.');
  const region = fuente.slice(ini, fin);
  assert.ok(region.length > 200,
    `🔴 CIEGO: la región de la unión son ${region.length} caracteres. Con eso no hay nada que ejecutar.`);
  return region;
}

/** Ejecuta la región con dobles, y devuelve qué se montó. */
function montarLaRegion() {
  const doc = documentoDeJuguete();
  const page = doc.createElement('div');
  const invoice = { id: 900, number: '2026-0007', asignados: [] };
  const llamadas = { etiquetas: 0, asignados: 0 };

  const win = {
    appUserRole: 'admin',
    montarEtiquetasDelDocumento(destino, factura, ruta) {
      llamadas.etiquetas += 1;
      llamadas.rutaEtiquetas = ruta;
      const sec = doc.createElement('div');
      sec.dataset.seccion = 'etiquetas';
      destino.appendChild(sec);
    },
  };
  const cablearAsignadosDeDocumento = (d, opts) => {
    llamadas.asignados += 1;
    llamadas.docAsignados = opts.doc;
    llamadas.idAsignados = opts.documentoId;
  };

  // Se ejecuta el trozo REAL, con sus condiciones reales. Nada de reimplementarlo aquí.
  const fn = new Function(
    'document', 'page', 'invoice', 'window', 'cablearAsignadosDeDocumento', 'apiRequest', 'setStatus',
    regionDeLaUnion(),
  );
  fn(doc, page, invoice, win, cablearAsignadosDeDocumento, () => {}, () => {});
  return { page, llamadas };
}

// ═════════════════════════════════════════════════════════════════════════════════════════════
// ✅ EL CONTROL QUE DECIDE: las DOS, no una
// ═════════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-597 · ✅ la ficha de factura monta LAS DOS secciones: etiquetas (595) y asignados (597)', () => {
  const { page, llamadas } = montarLaRegion();

  assert.equal(llamadas.etiquetas, 1,
    '🔴 NO SE MONTA la sección de ETIQUETAS (SCRUM-595). Si esto cae después de un merge, alguien '
    + 'resolvió el conflicto quedándose con un lado: la sección desaparece del producto y nada '
    + 'más se pone rojo, porque los dos bloques son `appendChild` sueltos sin nada compartido.');
  assert.equal(llamadas.asignados, 1,
    '🔴 NO SE MONTA la sección de ASIGNADOS (SCRUM-597). Mismo caso que arriba, por el otro lado.');

  // Y que cada una monta LO SUYO, no dos veces lo mismo.
  assert.equal(llamadas.docAsignados, 'invoice',
    '🔴 la sección de asignados de la FACTURA se ha montado como si fuera otro documento');
  assert.equal(llamadas.idAsignados, 900, '🔴 la sección de asignados no recibe la factura que se está viendo');
  assert.match(String(llamadas.rutaEtiquetas), /\/admin\/invoices\/900\/tags/,
    '🔴 la sección de etiquetas apunta a otra ruta');

  const secciones = page.hijos.map((h) => h.dataset && h.dataset.seccion).filter(Boolean);
  assert.ok(secciones.includes('etiquetas'), `🔴 la sección de etiquetas no cuelga de la ficha: ${JSON.stringify(secciones)}`);
  assert.ok(secciones.includes('asignados'), `🔴 la sección de asignados no cuelga de la ficha: ${JSON.stringify(secciones)}`);
});

// ═════════════════════════════════════════════════════════════════════════════════════════════
// ✅ Y EL ORDEN, que no es capricho: las dos son datos de la FICHA, no acciones
// ═════════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-597 · las dos van DESPUÉS de «Datos» y ANTES de «Acciones»', () => {
  const fuente = fs.readFileSync(VISTA, 'utf8');
  const datos = fuente.indexOf('// --- Sección: datos ---');
  const etiquetas = fuente.indexOf('// --- Sección: etiquetas (SCRUM-595');
  const asignados = fuente.indexOf('// ── SCRUM-597 (DOC-07) · QUIÉN LLEVA ESTE DOCUMENTO');
  const acciones = fuente.indexOf('// --- Sección: acciones');

  assert.ok(datos >= 0 && etiquetas >= 0 && asignados >= 0 && acciones >= 0,
    '🔴 CIEGO: falta alguna de las cuatro cabeceras que fijan el orden — '
    + JSON.stringify({ datos, etiquetas, asignados, acciones }));
  assert.ok(datos < etiquetas && etiquetas < asignados && asignados < acciones,
    '🔴 EL ORDEN SE HA ROTO. Las dos secciones son datos de la ficha, no acciones sobre el '
    + 'documento, y por eso van entre «Datos» y «Acciones» — lo dice el comentario de 595 y se '
    + 'respetó al unir: primero 595 (venía de main), después 597.');
});
