// tests/scrum1562c-trabajos-con-teclado.test.mjs — SCRUM-1562 (S4, 18-oct-2026)
//
// DESDE LA LISTA DE TRABAJOS, CON TECLADO, SE ABRE EL TRABAJO. Y CON RATÓN, IGUAL QUE ANTES.
//
// La fila (`TR.jobs-fila`) abre la ficha con un clic, pero un `<tr>` no recibe foco ni teclas.
// Medido con la sonda de S3 (`docs/master/evidencias/SCRUM-1562/sonda-div-clicables.mjs`): en la
// fila cuya acción es «Agendar» NINGÚN control nativo lleva a la ficha. En la de «+ Nuevo albarán»
// sí hay uno —ese botón navega a `jobs-detail`—, pero su rótulo promete otra cosa: quien quiere
// MIRAR el Trabajo no lo pulsa. Lo mismo pasa con «▶ Empezar» y «💰 Cobrar el resto», que
// ejecutan aquí, y con la fila de un técnico sin escalera, que no tiene botón.
//
// «Con teclado» se mide así: un control NATIVO (un `<button>`, o un `<a>` con `href`) recibe
// foco con el tabulador y el navegador lo activa con Intro y Espacio disparando su `click`. Eso
// lo da el navegador, no el banco; lo que el banco sí puede decir es qué hace ese `click`.
//
// 🔵 EL CONTROL QUE SUELE FALTAR: el ratón. Si el clic en la celda dejara de abrir la ficha, o
// el botón nuevo navegara DOS veces (el suyo y el de la fila, por la subida del evento), no
// habríamos arreglado nada: habríamos cambiado una cosa por otra.
//
// LO QUE NO SABE: el orden del tabulador ni el anillo de foco (CSS, a cualquier ancho), y si el
// lector de pantalla anuncia bien la fila. Eso se mira en navegador.
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cargarDashboard, pintarVista, todos } from './_banco-vistas.mjs';
import { datosDelCenso } from '../scripts/_datos-del-censo.mjs';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

const esNativo = (n) => n.tagName === 'BUTTON'
  || (n.tagName === 'A' && ((n.getAttribute && n.getAttribute('href') != null) || !!n.href));
const rotulo = (n) => todos(n).map((x) => x._texto || '').join(' ').replace(/\s+/g, ' ').trim();
const clase = (n) => String(n.className || '');

/** Monta la lista con los datos del censo y apunta cada navegación. */
async function montar() {
  const dc = datosDelCenso();
  dc.enVista('renderJobsView');
  const banco = cargarDashboard(RAIZ, { datos: dc.datos });
  const navegaciones = [];
  banco.ctx.renderAppView = (vista, args) => { navegaciones.push(JSON.parse(JSON.stringify({ vista, args }))); };
  const r = await pintarVista(banco, 'renderJobsView');
  const filas = r.contenedor ? todos(r.contenedor).filter((n) => n.tagName === 'TR' && /\bjobs-fila\b/.test(clase(n))) : [];
  return { r, filas, navegaciones };
}

/** La ficha a la que lleva la fila con RATÓN: clic en la celda del cliente, que no es un control. */
async function destinoConRaton(i) {
  const m = await montar();
  const celda = m.filas[i].hijos.find((h) => h.tagName === 'TD');
  celda.click();
  return m.navegaciones;
}

/**
 * Lo que hace el control POR SÍ MISMO: sólo sus oyentes, sin subir a la fila.
 *
 * ⚠️ En el navegador, la guarda de la fila (`e.target.closest('button, a, …')`) para la subida de
 * cualquier botón. En el banco NO: su `closest` parte el selector por espacios y una lista con
 * comas no casa nunca (devuelve `null`, que `closest` lee como «no»). Con `click()` a secas, en el
 * banco «Agendar» «abre la ficha» por la fila y «+ Nuevo albarán» la abre DOS veces: medido el
 * 18-oct-2026 sobre `origin/main` 32913b35. Por eso aquí se pulsa sin subir.
 */
function pulsarSinSubir(n) {
  const ev = { type: 'click', target: n, currentTarget: n, preventDefault() {}, stopPropagation() {} };
  for (const f of ((n._oyentes && n._oyentes.click) || []).slice()) f.call(n, ev);
}

/** Los controles nativos de la fila `i` que, pulsados, llevan a `destino` y a nada más. */
async function nativosQueAbren(i, destino) {
  const { filas } = await montar();
  const total = todos(filas[i]).filter(esNativo).length;
  const abren = [];
  for (let k = 0; k < total; k++) {
    // Montaje nuevo por control: «Agendar» abre una modal y «⋯» se despliega; uno no ensucia al otro.
    const m = await montar();
    const control = todos(m.filas[i]).filter(esNativo)[k];
    pulsarSinSubir(control);
    if (JSON.stringify(m.navegaciones) === JSON.stringify(destino)) abren.push(control);
  }
  return abren;
}

test('SCRUM-1562 · SUELO: la lista monta con dos filas de Trabajo y cada una abre su ficha con RATÓN', async () => {
  const m = await montar();
  assert.equal(m.r.error, null, `🔴 la lista revienta: ${m.r.error && m.r.error.message}`);
  assert.equal(m.filas.length, 2, `🔴 CIEGO: el censo trae dos Trabajos y salen ${m.filas.length} filas`);
  for (let i = 0; i < m.filas.length; i++) {
    const nav = await destinoConRaton(i);
    assert.equal(nav.length, 1, `🔴 fila ${i}: el clic en la celda navega ${nav.length} veces (con ratón tenía que abrir la ficha UNA)`);
    assert.equal(nav[0].vista, 'jobs-detail', `🔴 fila ${i}: el clic en la celda va a «${nav[0].vista}», no a la ficha del Trabajo`);
    assert.ok(nav[0].args && nav[0].args.jobId != null, `🔴 fila ${i}: navega sin jobId`);
  }
});

test('SCRUM-1562 · 🔴 cada fila tiene un control NATIVO que abre SU ficha, la misma que el ratón', async () => {
  const { filas } = await montar();
  for (let i = 0; i < filas.length; i++) {
    const destino = await destinoConRaton(i);
    const abren = await nativosQueAbren(i, destino);
    assert.ok(abren.length >= 1,
      `🔴 fila ${i} («${rotulo(filas[i]).slice(0, 50)}»): ningún botón ni enlace lleva a la ficha; con teclado no se abre`);
  }
});

test('SCRUM-1562 · 🔴 y ese control DICE que abre la ficha: «Ver detalle», el rótulo de Presupuestos', async () => {
  const { filas } = await montar();
  for (let i = 0; i < filas.length; i++) {
    const destino = await destinoConRaton(i);
    const abren = await nativosQueAbren(i, destino);
    const rotulos = abren.map(rotulo);
    assert.deepEqual(rotulos.filter((t) => t === 'Ver detalle'), ['Ver detalle'],
      `🔴 fila ${i}: los controles que abren la ficha dicen ${JSON.stringify(rotulos)}; falta UN «Ver detalle»`);
  }
});

// Aquí SÍ con `click()`, que sube a la fila: «Ver detalle» no puede depender de la guarda de la fila.
test('SCRUM-1562 · 🔵 control del ratón: «Ver detalle» navega UNA vez (la fila no repite el viaje)', async () => {
  const { filas } = await montar();
  for (let i = 0; i < filas.length; i++) {
    const destino = await destinoConRaton(i);
    const m = await montar();
    const [boton] = todos(m.filas[i]).filter((n) => esNativo(n) && rotulo(n) === 'Ver detalle');
    assert.ok(boton, `🔴 CIEGO: la fila ${i} no tiene «Ver detalle» que pulsar`);
    boton.click();
    assert.deepEqual(m.navegaciones, destino,
      `🔴 fila ${i}: «Ver detalle» hizo ${JSON.stringify(m.navegaciones)}; tenía que hacer lo mismo que el ratón, una vez`);
  }
});

test('SCRUM-1562 · la jerarquía de SCRUM-917c no cambia: «Ver detalle» no es primaria ni secundaria', async () => {
  const { filas } = await montar();
  for (const fila of filas) {
    const [boton] = todos(fila).filter((n) => esNativo(n) && rotulo(n) === 'Ver detalle');
    assert.ok(boton, '🔴 CIEGO: no hay «Ver detalle»');
    assert.match(clase(boton), /\bbtn-ghost\b/, `🔴 «Ver detalle» lleva «${clase(boton)}»: mirar no pesa como actuar`);
    assert.doesNotMatch(clase(boton), /\bbtn-(primary|secondary)\b/, '🔴 «Ver detalle» compite con la acción de la escalera');
  }
});

test('SCRUM-1562 · la fila sigue siendo una fila: sin `role` que la convierta en botón', async () => {
  const { filas } = await montar();
  for (const fila of filas) {
    assert.equal(fila.getAttribute('role'), null,
      '🔴 un `<tr>` con `role` deja de ser una fila de tabla para quien la oye; el teclado va por el botón de dentro');
  }
});
