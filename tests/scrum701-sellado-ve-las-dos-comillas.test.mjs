// tests/scrum701-sellado-ve-las-dos-comillas.test.mjs — SCRUM-701
//
// LA VÍCTIMA: el profesional con la cobertura de un sótano que se rebaja un fichero que ya tenía.
//
// `sellarReferencias` CORRE EN PRODUCCIÓN: reescribe el HTML del dashboard al servirlo y le pone
// `?v=<huella>` a cada estático. Su lector era una regex que sólo veía **comillas dobles** y que
// **no saltaba los comentarios**. Dos formas de equivocarse, y las dos en silencio:
//
//   · una referencia con comillas simples NO se sella → ese fichero se queda sin huella, y por
//     tanto sin `immutable`: se vuelve a bajar en cada despliegue;
//   · una etiqueta COMENTADA sí se contaba → producción reescribía texto muerto y el guard exigía
//     que un fichero comentado existiera en disco.
//
// ── LO QUE EL PASO 0 MIDIÓ, Y QUE MATIZA EL TICKET ──────────────────────────────────────────
// El defecto es real y estaba sin arreglar, pero HOY no rompe nada: el único documento que se
// sella es `public/dashboard/index.html`, y ahí hay 85 referencias, TODAS con comillas dobles y
// NINGUNA comentada —con 52 comentarios en el fichero, así que ese cero es una medición y no una
// ceguera—. Las comillas simples sí existen en el HTML de la casa (`login.html`, `register.html`),
// que es lo que hace que esto sea cuestión de tiempo y no de laboratorio.
//
// ── LA LISTA DE FORMAS SALE DEL ÁRBOL, NO DE MI CABEZA ──────────────────────────────────────
// Medido sobre los 9 HTML de `public/`: 163 con comillas dobles, 2 con simples, 0 sin comillas.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const RAIZ = path.resolve(import.meta.dirname, '..');
const PUBLIC_DIR = path.join(RAIZ, 'public');
const BASE_URL = '/dashboard/';

const { sellarReferencias, crearHuellas, referenciasDe, PARAM_HUELLA } =
  await import('../dist/core/http/huellaEstaticos.js');

const opts = () => ({
  publicDir: PUBLIC_DIR,
  baseUrl: BASE_URL,
  huellaDeFichero: crearHuellas(fs),
});

/** EL MECANISMO VIEJO, tal cual estaba: una sola forma de comilla y ciego a los comentarios. */
function sellarComoAntes(html, o) {
  return html.replace(/\b(src|href)\s*=\s*"([^"]*)"/gi, (completo, atributo, valor) => {
    const fichero = resolverComoAntes(valor, o);
    if (!fichero) return completo;
    const huella = o.huellaDeFichero(fichero);
    if (!huella) return completo;
    const separador = valor.includes('?') ? '&' : '?';
    return `${atributo}="${valor}${separador}${PARAM_HUELLA}=${huella}"`;
  });
}
// El resolutor no cambió en este ticket; se reusa el de producción a través de `referenciasDe`.
function resolverComoAntes(valor, o) {
  const [ref] = referenciasDe(`<x src="${valor}">`, o);
  return ref ? ref.fichero : null;
}

// ═══════════════════════════════════════════════════════════════════════════════════════════
// 🔴 EL ROJO QUE IMPORTA — los dos casos, corridos
// ═══════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-701 · 🔴 una referencia con COMILLAS SIMPLES se sella', () => {
  // `tokens.css` existe de verdad en `public/`; se escribe con comillas simples, como en
  // `login.html` y `register.html`.
  const html = "<link rel='stylesheet' href='../tokens.css'>";
  const sellado = sellarReferencias(html, opts());

  assert.match(sellado, new RegExp(`[?&]${PARAM_HUELLA}=[0-9a-f]{10}`),
    '🔴 una referencia con comillas simples NO se ha sellado. Ese estático se queda sin huella y '
    + 'sin `immutable`: se vuelve a bajar entero en cada despliegue, y lo paga quien tiene mala '
    + `cobertura. Salió: ${sellado}`);

  // 🔒 Y la comilla se conserva: normalizarla sería reescribir el HTML por gusto.
  assert.ok(sellado.includes("href='"),
    `🔴 se ha cambiado la comilla simple por otra cosa: ${sellado}`);
  assert.ok(!sellado.includes('href="'), `🔴 la comilla se normalizó a dobles: ${sellado}`);
});

test('SCRUM-701 · 🔴 una etiqueta COMENTADA no se toca ni se cuenta', () => {
  const html = '<!-- <script src="./js/api.js"></script> -->\n<script src="./js/api.js"></script>';
  const sellado = sellarReferencias(html, opts());

  const dentroDelComentario = sellado.slice(0, sellado.indexOf('-->'));
  assert.ok(!new RegExp(`[?&]${PARAM_HUELLA}=`).test(dentroDelComentario),
    '🔴 se ha sellado una etiqueta que está DENTRO de un comentario. El navegador no la pide: '
    + `producción está reescribiendo texto muerto. Salió: ${dentroDelComentario}`);

  // Y la de fuera sí se sella: el arreglo no puede apagar lo vivo.
  const fuera = sellado.slice(sellado.indexOf('-->'));
  assert.match(fuera, new RegExp(`[?&]${PARAM_HUELLA}=[0-9a-f]{10}`),
    `🔴 la etiqueta VIVA se ha quedado sin sellar: ${fuera}`);

  // Y el censo tampoco la cuenta.
  const refs = referenciasDe(html, { publicDir: PUBLIC_DIR, baseUrl: BASE_URL });
  assert.equal(refs.length, 1,
    `🔴 el extractor cuenta ${refs.length} referencias y sólo hay UNA viva; la otra está comentada.`);
});

test('SCRUM-701 · 🔴 Y CAE CON EL MECANISMO VIEJO: los dos casos, con la regex de antes', () => {
  // Si los casos no distinguieran los dos mecanismos, no probarían que el arreglo hacía falta.
  const conSimples = "<link rel='stylesheet' href='../tokens.css'>";
  assert.equal(sellarComoAntes(conSimples, opts()), conSimples,
    '🔴 el caso NO discrimina: con la regex vieja las comillas simples tenían que quedarse SIN '
    + 'sellar, y algo las ha sellado.');

  const comentada = '<!-- <script src="./js/api.js"></script> -->';
  const viejo = sellarComoAntes(comentada, opts());
  assert.notEqual(viejo, comentada,
    '🔴 el caso NO discrimina: con la regex vieja la etiqueta comentada tenía que sellarse.');
  assert.match(viejo, new RegExp(`[?&]${PARAM_HUELLA}=`),
    '🔴 el mecanismo viejo tenía que meter la huella dentro del comentario, y no lo ha hecho.');
});

// ═══════════════════════════════════════════════════════════════════════════════════════════
// CONTROL POSITIVO — apretar el lector no puede perder ni una referencia legítima
// ═══════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-701 · ✅ CONTROL POSITIVO: el documento REAL se sella EXACTAMENTE igual que antes', () => {
  const crudo = fs.readFileSync(path.join(PUBLIC_DIR, 'dashboard', 'index.html'), 'utf8');

  // 🔴 SUELO: si el extractor devolviera cero, comparar dos cadenas sin sellar daría verde.
  const refs = referenciasDe(crudo, { publicDir: PUBLIC_DIR, baseUrl: BASE_URL });
  assert.ok(refs.length >= 80,
    `🔴 CIEGO: sólo ${refs.length} referencias en el dashboard y hay 85 medidas. Con el extractor `
    + 'a medias, «se sella igual que antes» no significaría nada.');
  const locales = refs.filter((r) => r.fichero);
  assert.ok(locales.length >= 34,
    `🔴 CIEGO: sólo ${locales.length} referencias resuelven a fichero; el suelo del ticket son 34.`);

  const ahora = sellarReferencias(crudo, opts());
  const antes = sellarComoAntes(crudo, opts());
  assert.equal(ahora, antes,
    '🔴 EL DOCUMENTO REAL SE SELLA DISTINTO QUE ANTES. En este fichero no hay comillas simples ni '
    + 'etiquetas comentadas, así que el arreglo NO puede cambiar ni un byte de su salida. Si '
    + 'cambia, se ha perdido —o ganado— una referencia por el camino.');

  // Y enumerado: cada referencia local del documento sale con su huella.
  const sinSellar = referenciasDe(ahora, { publicDir: PUBLIC_DIR, baseUrl: BASE_URL })
    .filter((r) => r.fichero && !new RegExp(`[?&]${PARAM_HUELLA}=[0-9a-f]{10}`).test(r.valor))
    .map((r) => r.valor);
  assert.deepEqual(sinSellar, [],
    `🔴 ${sinSellar.length} referencia(s) local(es) del dashboard se han quedado sin huella:\n    `
    + sinSellar.join('\n    '));
});

test('SCRUM-701 · un comentario SIN CERRAR comenta hasta el final, como en el navegador', () => {
  const html = '<script src="./js/api.js"></script>\n<!-- <script src="./js/app.js"></script>';
  const refs = referenciasDe(html, { publicDir: PUBLIC_DIR, baseUrl: BASE_URL });
  assert.equal(refs.length, 1,
    `🔴 se cuentan ${refs.length}: lo que va tras un <!-- sin cerrar no lo pide nadie.`);
  assert.equal(refs[0].valor, './js/api.js');
});
