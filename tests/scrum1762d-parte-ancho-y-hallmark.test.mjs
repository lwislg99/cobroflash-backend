// tests/scrum1762d-parte-ancho-y-hallmark.test.mjs — SCRUM-1762 (paraguas «lavado de cara»), pieza d · S4
//
// EL PARTE DE TRABAJO EN ESCRITORIO APROVECHA EL ANCHO + PASADA HALLMARK.
// Orden del fundador (20-nov-2026): «el parte en escritorio tiene demasiado espacio por los lados».
// Medido con la sonda (docs/master/evidencias/SCRUM-1762/d-parte/capturar-parte.mjs): a 1920 la hoja
// ocupaba 1120 px centrados, con 276 px muertos a cada lado. El patrón es el de la ficha del trabajo
// (SCRUM-1768): tope de 1680 sin centrar, principal fluida y una LATERAL con lo que cierra el documento.
//   ① la lateral existe en la ficha REAL pintada: firmas y salidas dentro, los datos fuera;
//   ② EL MÓVIL NO SE TOCA: fuera de `@media` el bloque solo disuelve la lateral (`display: contents`);
//   ③ desde 1200 la hoja deja de centrarse en 1120 y la casilla de la derecha es la lateral;
//   ④ desde 1500 la principal son dos columnas y la lateral pasa a la tercera pista;
//   ⑤ hallmark: las salidas a tamaño de botón normal y un solo verde de primario, con AA;
//   ⑥ hallmark: los botones del parte sin `transition: all` y con el foco instantáneo;
//   ⑦ SCRUM-915c: una sola definición de «este parte da para un presupuesto», la que usa el botón.
//
// Se lee el CSS EJECUTABLE (sin comentarios) y la ficha se pinta con el banco de vistas. Lo que una
// lectura de CSS no puede medir (cajas, pasillos, huella de función a 390/1280/1920) lo mide la sonda.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ejecutableDe } from './_guard-texto.mjs';
import { cargarDashboard } from './_banco-vistas.mjs';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const HOJA = '*:has(> header.parte-cabecera)';
// Suelo del filtro (SCRUM-1395): si el filtro de comentarios se comiera la hoja del parte, cae aquí.
const css = ejecutableDe(fs.readFileSync(path.join(RAIZ, 'public/dashboard/css/styles.css'), 'utf8'), {
  ancla: ['header.parte-cabecera', '[data-parte-firmar]'], almohadillaEsComentario: false,
});

/** Todas las reglas, en orden, con el `@media` que las envuelve (o `null`). */
function reglas(texto) {
  const out = [];
  const recorrer = (t, medio) => {
    let i = 0;
    while (i < t.length) {
      const abre = t.indexOf('{', i);
      if (abre < 0) break;
      const preludio = t.slice(i, abre).trim();
      let prof = 1, j = abre + 1;
      while (j < t.length && prof > 0) { if (t[j] === '{') prof++; else if (t[j] === '}') prof--; j++; }
      const cuerpo = t.slice(abre + 1, j - 1);
      if (preludio.startsWith('@media') || preludio.startsWith('@supports')) recorrer(cuerpo, preludio.replace(/\s+/g, ' '));
      else if (!preludio.startsWith('@')) out.push({ selectores: preludio.split(/,(?![^(]*\))/).map((s) => s.trim().replace(/\s+/g, ' ')), cuerpo: cuerpo.replace(/\s+/g, ' ').trim(), medio });
      i = j;
    }
  };
  recorrer(texto, null);
  return out;
}
const REGLAS = reglas(css);
const de = (sel, medio) => REGLAS.filter((r) => r.selectores.includes(sel) && r.medio === medio);
/** La última declaración de `prop` entre las reglas de `sel` en `medio` (gana la última, como en CSS). */
function valor(sel, medio, prop) {
  let v;
  for (const r of de(sel, medio)) {
    for (const trozo of r.cuerpo.split(';')) {
      const k = trozo.indexOf(':');
      if (k > 0 && trozo.slice(0, k).trim() === prop) v = trozo.slice(k + 1).trim();
    }
  }
  return v;
}
const DESDE_1200 = '@media (min-width: 1200px)';
const DESDE_1500 = '@media (min-width: 1500px)';

// ── La ficha REAL, pintada en el banco ──────────────────────────────────────────────────────────
const BASE = Object.freeze({
  id: 13, jobId: 79, customerId: 5, numero: 'PT-2026-013', clienteNombre: 'Cliente de prueba',
  fecha: '2026-11-10T08:00:00.000Z', obra: '', referencia: '', entrada: '09:00', salida: '11:00',
  desplazamientos: 0, kilometros: 0, tecnicos: [], tipo: 'averia',
  lineas: [
    { bloque: 'mano_obra', unds: 2, descripcion: 'Cambio de grifo' },
    { bloque: 'materiales', unds: 3, descripcion: 'Latiguillo 1/2' },
  ],
  notas: '', estado: 'borrador', firmoElCliente: false, firmoElTecnico: false,
  puedeEditarContenido: { ok: true, motivo: null }, puedeEditarPrecios: { ok: true, motivo: null },
});
const FIRMADO = {
  ...BASE, estado: 'firmado', firmoElCliente: true, firmoElTecnico: true, firmadoPorNombre: 'Ana', firmadoTecnicoNombre: 'Israel',
  puedeEditarContenido: { ok: false, motivo: 'firmado' },
};
const responder = (cuerpo) => ({
  ok: true, status: 200, headers: { get: () => 'application/json' },
  json: async () => cuerpo, blob: async () => ({}), text: async () => JSON.stringify(cuerpo),
});
const NAVEGADOR = { userAgent: 'banco', language: 'es-ES', onLine: true, serviceWorker: { register: async () => ({}) } };

async function pintarParte(parte) {
  const fetch = async (url) => (/\/admin\/partes\/13$/.test(String(url)) ? responder(parte) : responder({}));
  const banco = cargarDashboard(RAIZ, { red: { fetch, navigator: NAVEGADOR } });
  const w = banco.ctx.window;
  const navegaciones = [];
  w.renderAppView = (vista, datos) => { navegaciones.push({ vista, datos }); };
  const contenedor = banco.mk('div');
  banco.ctx.document.body.appendChild(contenedor);
  assert.equal(await w.renderParteDetailView(contenedor, 13), true, '🔴 CIEGO: la ficha del parte no se pintó en el banco');
  assert.ok(contenedor.querySelector('header.parte-cabecera'), '🔴 CIEGO: se pintó otra cosa que la ficha del parte');
  return { contenedor, w, navegaciones };
}
/** Qué lleva cada hija directa de `n`, por su marca. */
const marcas = (n) => Array.from(n.children).map((h) => (
  ['data-parte-firmas', 'data-parte-salida', 'data-parte-salida-presupuesto', 'data-parte-lateral']
    .find((a) => h.getAttribute && h.getAttribute(a) !== null) || String(h.className || h.tagName).split(' ')[0]
));

export const MUTACIONES_QUE_ME_TUMBAN = [
  {
    fichero: 'public/dashboard/js/parteDetailView.js',
    de: '\'<div class="parte-lateral" data-parte-lateral="1">\' +',
    a: '\'<div data-parte-lateral="1">\' +',
    cae: '1762d ① · la lateral existe en la ficha pintada: firmas y salidas dentro, los datos del parte fuera',
  },
  {
    fichero: 'public/dashboard/css/styles.css',
    de: '.parte-lateral { display: contents; }',
    a: '.parte-lateral { display: block; }',
    cae: '1762d ② · el móvil no se toca: fuera de @media, el bloque solo disuelve la lateral',
  },
  {
    fichero: 'public/dashboard/css/styles.css',
    de: '*:has(> header.parte-cabecera) { max-width: 1680px; margin-inline: 0; align-content: start; }',
    a: '*:has(> header.parte-cabecera) { align-content: start; }',
    cae: '1762d ③ · desde 1200 la hoja deja de centrarse en 1120 px y la casilla de la derecha es la lateral',
  },
  {
    fichero: 'public/dashboard/css/styles.css',
    de: '*:has(> header.parte-cabecera) > .parte-lateral { grid-column: 3; }',
    a: '*:has(> header.parte-cabecera) > .parte-lateral { grid-column: 2; }',
    cae: '1762d ④ · desde 1500 la principal son dos columnas y la lateral pasa a la tercera pista',
  },
  {
    fichero: 'public/dashboard/css/styles.css',
    de: '.parte-lateral [data-parte-volver-al-trabajo].btn-primary { background: var(--brand-tint-ink); }',
    a: '.parte-lateral [data-parte-volver-al-trabajo].btn-primary { background: var(--brand); }',
    cae: '1762d ⑤ · hallmark: las salidas a tamaño de botón normal y un solo verde de primario con AA',
  },
  {
    fichero: 'public/dashboard/css/styles.css',
    de: '  transition: background-color .12s, color .12s, border-color .12s, transform .12s; /* SCRUM-1762d:',
    a: '  transition: all .12s; /* SCRUM-1762d:',
    cae: '1762d ⑥ · hallmark: los botones del parte no animan `all` ni el anillo de foco',
  },
  {
    fichero: 'public/dashboard/js/parteDetailView.js',
    de: "if (!plantillaDelPresupuesto(parte)) return '';",
    a: "if (!tieneTrabajo(parte)) return '';",
    cae: '1762d ⑦ · SCRUM-915c: una sola definición de «da para un presupuesto», y es la que usa el botón',
  },
];

test('1762d ① · la lateral existe en la ficha pintada: firmas y salidas dentro, los datos del parte fuera', async () => {
  // Firmado: firmas → «Volver al trabajo» → «+ Nuevo presupuesto», las tres dentro y en ese orden.
  const f = await pintarParte(FIRMADO);
  const lateral = f.contenedor.querySelector('[data-parte-lateral]');
  assert.ok(lateral, '🔴 el parte firmado no tiene lateral');
  assert.ok(String(lateral.className).split(' ').includes('parte-lateral'), '🔴 la lateral no lleva la clase de la que cuelga su CSS');
  assert.equal(lateral.parentNode, f.contenedor, '🔴 la lateral no es hija directa de la hoja: la rejilla no la coloca');
  assert.deepEqual(marcas(lateral), ['data-parte-firmas', 'data-parte-salida', 'data-parte-salida-presupuesto']);
  // Orden de papel (SCRUM-1693): firmado, la lateral es lo ÚLTIMO de la hoja y los datos van antes.
  const hijasF = marcas(f.contenedor);
  assert.equal(hijasF[hijasF.length - 1], 'data-parte-lateral', `🔴 firmado: lo último ya no son las firmas: ${hijasF}`);
  assert.ok(hijasF.indexOf('parte-datos-del-parte') >= 0 && hijasF.indexOf('parte-datos-del-parte') < hijasF.indexOf('data-parte-lateral'));

  // Borrador: dentro solo las firmas (sin salidas), y los datos del parte DESPUÉS y fuera (SCRUM-1175 PR-C).
  const b = await pintarParte(BASE);
  const lateralB = b.contenedor.querySelector('[data-parte-lateral]');
  assert.deepEqual(marcas(lateralB), ['data-parte-firmas']);
  const hijasB = marcas(b.contenedor);
  assert.equal(hijasB[hijasB.length - 1], 'parte-datos-del-parte', `🔴 borrador: los datos ya no cierran la hoja: ${hijasB}`);
  assert.equal(hijasB[hijasB.length - 2], 'data-parte-lateral');
  // Una sola: la ficha no pinta dos laterales ni firmas fuera de ella.
  for (const r of [f, b]) {
    assert.equal(r.contenedor.querySelectorAll('[data-parte-lateral]').length, 1);
    assert.equal(r.contenedor.querySelectorAll('[data-parte-firmas]').length, 1);
    assert.equal(r.contenedor.querySelector('[data-parte-firmas]').parentNode, r.contenedor.querySelector('[data-parte-lateral]'));
  }
});

test('1762d ② · el móvil no se toca: fuera de @media, el bloque solo disuelve la lateral', () => {
  assert.equal(valor('.parte-lateral', null, 'display'), 'contents', '🔴 por debajo de 1200 px la lateral ya no se disuelve: el parte del móvil cambia');
  // Ninguna regla BASE (sin @media) nombra la lateral salvo esa: lo demás vive desde 1200 px.
  const base = REGLAS.filter((r) => r.medio === null && r.selectores.some((s) => s.includes('.parte-lateral')));
  assert.deepEqual(base.map((r) => `${r.selectores.join(', ')} { ${r.cuerpo} }`), ['.parte-lateral { display: contents; }']);
  // Y ningún @media por debajo de 1200 la nombra (control: sí la nombran los de 1200 y 1500).
  const medios = new Set(REGLAS.filter((r) => r.medio && r.selectores.some((s) => s.includes('.parte-lateral'))).map((r) => r.medio));
  assert.deepEqual([...medios].sort(), [DESDE_1200, DESDE_1500]);
  // La regla base de la hoja sigue siendo la del móvil (SCRUM-1722c): centrada, 720 px, con su ancho.
  assert.equal(valor(HOJA, null, 'max-width'), '720px');
  assert.equal(valor(HOJA, null, 'width'), '100%');
});

test('1762d ③ · desde 1200 la hoja deja de centrarse en 1120 px y la casilla de la derecha es la lateral', () => {
  assert.equal(valor(HOJA, DESDE_1200, 'max-width'), '1680px', '🔴 la hoja vuelve a tener tope estrecho en escritorio');
  assert.equal(valor(HOJA, DESDE_1200, 'margin-inline'), '0', '🔴 la hoja vuelve a centrarse: pasillos a los lados');
  assert.equal(valor(HOJA, DESDE_1200, 'align-content'), 'start', '🔴 la rejilla vuelve a repartir el alto que sobra entre sus filas');
  assert.equal(valor(HOJA, DESDE_1200, 'display'), 'grid');
  // La derecha es la LATERAL, no la tarjeta de firmas (que ya no es hija directa: su regla sería letra muerta).
  assert.equal(valor(`${HOJA} > .parte-lateral`, DESDE_1200, 'grid-column'), '2');
  assert.equal(valor(`${HOJA} > .parte-lateral`, DESDE_1200, 'position'), 'sticky');
  assert.equal(valor(`${HOJA} > .parte-lateral`, DESDE_1200, 'display'), 'block', '🔴 desde 1200 la lateral sigue disuelta: no hay columna');
  assert.deepEqual(REGLAS.filter((r) => r.selectores.includes(`${HOJA} > .parte-firmas`)), [], '🔴 queda una regla para `.parte-firmas` como hija directa de la hoja, que ya no existe');
  // Control positivo del lector: la cabecera sigue ocupando todo el ancho.
  assert.equal(valor(`${HOJA} > header.parte-cabecera`, DESDE_1200, 'grid-column'), '1 / -1');
});

test('1762d ④ · desde 1500 la principal son dos columnas y la lateral pasa a la tercera pista', () => {
  assert.equal(valor(HOJA, DESDE_1500, 'grid-template-columns'), 'minmax(0, 1fr) minmax(0, 1fr) 380px');
  assert.equal(valor(`${HOJA} > .parte-lateral`, DESDE_1500, 'grid-column'), '3', '🔴 la lateral se queda en la segunda pista, encima de los pasos');
  assert.equal(valor(`${HOJA} > header.parte-cabecera`, DESDE_1500, 'grid-column'), '1 / -1');
  // Lo que no es un paso ocupa las dos columnas; los pasos se emparejan en el orden del documento.
  assert.equal(valor(`${HOJA} > *`, DESDE_1500, 'grid-column'), '1 / 3');
  assert.equal(valor(`${HOJA} > :is(.parte-horas, .parte-dictado, .parte-bloque)`, DESDE_1500, 'grid-column'), 'auto');
  assert.equal(valor(`${HOJA} > .parte-datos-del-parte:not(:last-child)`, DESDE_1500, 'grid-column'), 'auto');
});

test('1762d ⑤ · hallmark: las salidas a tamaño de botón normal y un solo verde de primario con AA', () => {
  const salidas = '.parte-lateral :is([data-parte-volver-al-trabajo], [data-parte-presupuesto])';
  assert.equal(valor(salidas, DESDE_1200, 'min-height'), '44px', '🔴 las salidas bajan de 44 px en escritorio');
  assert.equal(valor(salidas, DESDE_1200, 'font-size'), '15px', '🔴 «Volver al trabajo» vuelve al primario grande (18,66 px)');
  assert.equal(valor(`${salidas}:focus-visible`, DESDE_1200, 'box-shadow'), 'var(--ring)');
  // Letra normal en blanco: --brand da 3,3:1; --brand-tint-ink, 5,48:1. La salida y la firma, el mismo verde.
  assert.equal(valor('.parte-lateral [data-parte-volver-al-trabajo].btn-primary', DESDE_1200, 'background'), 'var(--brand-tint-ink)');
  assert.equal(valor('.parte-lateral .parte-firma-caja [data-parte-firmar]:not([data-parte-firma-en-espera])', DESDE_1200, 'background'), 'var(--brand-tint-ink)');
  // Nada de esto sale del escritorio: en el móvil la firma sigue con su regla de siempre (SCRUM-1676 la mira).
  assert.equal(de(salidas, null).length, 0);
  assert.equal(valor('[data-parte-firmar]', null, 'background'), 'var(--brand)');
});

test('1762d ⑥ · hallmark: los botones del parte no animan `all` ni el anillo de foco', () => {
  const t = valor('[data-parte-firmar]', null, 'transition');
  assert.ok(t, '🔴 CIEGO: la regla común de los botones del parte ya no declara `transition`');
  assert.doesNotMatch(t, /\ball\b/, '🔴 `transition: all` anima también la maquetación y el foco');
  assert.doesNotMatch(t, /box-shadow/, '🔴 el anillo de foco (box-shadow) vuelve a aparecer con retardo');
  assert.match(t, /background-color/);
});

test('1762d ⑦ · SCRUM-915c: una sola definición de «da para un presupuesto», y es la que usa el botón', async () => {
  // Firmado con trabajo y líneas: la plantilla existe, y el botón navega EXACTAMENTE con ella.
  const f = await pintarParte(FIRMADO);
  assert.equal(typeof f.w.partePlantillaDelPresupuesto, 'function', '🔴 la definición no está al alcance de quien la necesita fuera del parte');
  const plantilla = JSON.parse(JSON.stringify(f.w.partePlantillaDelPresupuesto(FIRMADO)));
  assert.deepEqual(plantilla, {
    deTrabajo: { jobId: 79, customerId: 5 },
    lines: [{ concept: 'Cambio de grifo', qty: 2 }, { concept: 'Latiguillo 1/2', qty: 3 }],
  });
  const boton = f.contenedor.querySelector('[data-parte-presupuesto]');
  assert.ok(boton, '🔴 el parte firmado no ofrece hacer un presupuesto');
  assert.ok(boton.click() > 0);
  assert.equal(f.navegaciones.length, 1);
  assert.equal(f.navegaciones[0].vista, 'quotes-new');
  assert.deepEqual(JSON.parse(JSON.stringify(f.navegaciones[0].datos)), { template: plantilla });

  // Donde la definición dice que no, no hay botón: borrador, sin trabajo y sin líneas.
  const NO = [BASE, { ...FIRMADO, jobId: null }, { ...FIRMADO, lineas: [] }];
  for (const parte of NO) {
    const r = await pintarParte(parte);
    assert.equal(r.w.partePlantillaDelPresupuesto(parte), null, `🔴 da plantilla donde no toca: ${parte.estado} jobId=${parte.jobId} líneas=${parte.lineas.length}`);
    assert.equal(r.contenedor.querySelector('[data-parte-presupuesto]'), null, '🔴 el botón se pinta donde la definición dice que no');
  }
});
