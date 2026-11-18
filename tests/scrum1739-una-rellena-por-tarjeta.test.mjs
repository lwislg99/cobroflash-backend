// tests/scrum1739-una-rellena-por-tarjeta.test.mjs — SCRUM-1739 (+ la mitad-tarjeta de SCRUM-1749, S4)
//
// COMO MUCHO UNA RELLENA POR TARJETA, Y ES EL PASO QUE HACE AVANZAR EL TRABAJO HOY.
//
// Regla reconciliada por el orquestador (SCRUM-1739 c.22030, por la delegación general de
// SCRUM-1656 c.21978). Sustituye, PARA LA LISTA, a la letra de 917c C.1 (prototipo aprobado por el
// fundador, c.15876: «una sola primaria = el dinero; ▶ Empezar en secundaria»), que dejó de
// describir la lista cuando N1 (SCRUM-1700, c.21470) puso «Abrir parte» rellena en EN CURSO:
//   · AGENDADO PARA HOY → «▶ Empezar» rellena;
//   · EN CURSO → «Abrir parte» rellena (ya estaba: control positivo);
//   · SIN AGENDAR → «Agendar» SECUNDARIA (los doce verdes que midió 917c: su argumento sigue en pie);
//   · TERMINADO con importe → «💰 Cobrar el resto» rellena (el corazón de 917c, intacto).
// Y la rellena va PRIMERA en su tarjeta (aceptación de SCRUM-1739), en el DOM y no con `order`.
//
// Lo que NO fija este fichero: que «▶ Empezar» escriba `en_curso` sin navegar (guard:lista-trabajos-917,
// C.1) ni que la lista y la ficha propongan la misma acción (guard:escalera-por-estado). Esos dos
// guards corren en navegador, fuera de la tanda.
//
// Monta la vista REAL en el banco (sin navegador), con seis Trabajos fabricados sobre el del censo.
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cargarDashboard, pintarVista, todos } from './_banco-vistas.mjs';
import { datosDelCenso } from '../scripts/_datos-del-censo.mjs';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

const clase = (n) => String((n && n.className) || '');
const tiene = (n, c) => new RegExp(`(^|\\s)${c}(\\s|$)`).test(clase(n));
const rotulo = (n) => todos(n).map((x) => x._texto || '').join(' ').replace(/\s+/g, ' ').trim();
const esBoton = (n) => n.tagName === 'BUTTON';

/** A mediodía de HOY más `dias`: lejos de la medianoche, para que «hoy» no dependa de la hora de la tanda. */
const aMediodia = (dias) => { const d = new Date(); d.setDate(d.getDate() + dias); d.setHours(12, 0, 0, 0); return d.toISOString(); };

// Uno por caso. La clave va en el título propio para encontrar la fila por IDENTIDAD, no por posición.
const CASOS = [
  { clave: 'SIN-AGENDAR', status: 'pendiente_agendar', scheduledAt: null },
  { clave: 'AGENDADO-HOY', status: 'agendado', scheduledAt: aMediodia(0) },
  { clave: 'AGENDADO-OTRO-DIA', status: 'agendado', scheduledAt: aMediodia(3) },
  { clave: 'EN-CURSO', status: 'en_curso', scheduledAt: aMediodia(0) },
  { clave: 'TERMINADO-CON-IMPORTE', status: 'terminado', scheduledAt: aMediodia(-1), remaining: { amount: 740, currency: 'EUR' } },
  { clave: 'TERMINADO-SIN-IMPORTE', status: 'terminado', scheduledAt: aMediodia(-1), remaining: { amount: 0, currency: 'EUR' } },
];

async function montar({ rol = 'admin', puedeFacturar = true } = {}) {
  const dc = datosDelCenso();
  dc.enVista('renderJobsView');
  const datos = (url, opts) => {
    const p = new URL(String(url), 'https://yaqu.app').pathname;
    if (p === '/admin/jobs') {
      const base = dc.datos('/admin/jobs')[0];
      return CASOS.map((c, i) => ({ ...structuredClone(base), id: 201 + i, titulo: c.clave, tituloPropio: c.clave, remaining: { amount: 0, currency: 'EUR' }, ...c }));
    }
    return dc.datos(url, opts);
  };
  const banco = cargarDashboard(RAIZ, { datos });
  banco.ctx.renderAppView = () => {};
  banco.ctx.appUserRole = rol;
  // El cobro en la fila pide que el profesional pueda facturar (SCRUM-1205). Se FIJA aquí, en los dos
  // sentidos, para no heredar lo que el banco diga hoy por defecto.
  banco.ctx.facturaFiscalDisponible = () => puedeFacturar;
  const r = await pintarVista(banco, 'renderJobsView');
  assert.equal(r.error, null, `🔴 la lista revienta: ${r.error && r.error.message}`);
  const filas = r.contenedor ? todos(r.contenedor).filter((n) => n.tagName === 'TR' && tiene(n, 'jobs-fila')) : [];
  assert.equal(filas.length, CASOS.length, `🔴 CIEGO: pedí ${CASOS.length} Trabajos y salen ${filas.length} filas`);
  const fila = {};
  for (const c of CASOS) {
    // `includes` no vale: «TERMINADO-CON-IMPORTE» y «TERMINADO-SIN-IMPORTE» no se contienen, pero un
    // prefijo sí lo haría. Se exige UNA fila por clave.
    const suyas = filas.filter((f) => todos(f).some((n) => (n._texto || '').trim() === c.clave));
    assert.equal(suyas.length, 1, `🔴 CIEGO: ${suyas.length} filas para «${c.clave}»`);
    fila[c.clave] = suyas[0];
  }
  return { fila, filas };
}

/** Los controles de la celda de acciones, en el ORDEN DEL DOM (que es el del foco y el que se ve). */
function controles(tr) {
  const celda = todos(tr).find((n) => tiene(n, 'jobs-celda-acciones'));
  assert.ok(celda, '🔴 CIEGO: la fila no tiene `.jobs-celda-acciones`');
  return todos(celda).filter(esBoton).map((b) => ({ nodo: b, rotulo: rotulo(b), rellena: tiene(b, 'btn-primary'), secundaria: tiene(b, 'btn-secondary') }));
}
const pinta = (cs) => cs.map((c) => `${c.rellena ? '■' : '□'}${c.rotulo}`).join(' · ');

test('SCRUM-1739 · SUELO: el banco pinta los seis casos con su botón (si no, todo lo demás sería cierto por vacío)', async () => {
  const { fila } = await montar();
  const esperado = {
    'SIN-AGENDAR': 'Agendar',
    'AGENDADO-HOY': '▶ Empezar',
    'AGENDADO-OTRO-DIA': '▶ Empezar',
    'EN-CURSO': 'Abrir parte',
    'TERMINADO-CON-IMPORTE': '💰 Cobrar el resto',
  };
  for (const [clave, boton] of Object.entries(esperado)) {
    const cs = controles(fila[clave]);
    assert.equal(cs.filter((c) => c.rotulo.startsWith(boton)).length, 1, `🔴 CIEGO: «${clave}» no trae UN «${boton}»: ${pinta(cs)}`);
  }
  for (const clave of Object.keys(fila)) {
    const cs = controles(fila[clave]);
    assert.equal(cs.filter((c) => c.rotulo === 'Ver detalle').length, 1, `🔴 CIEGO: «${clave}» sin «Ver detalle»: ${pinta(cs)}`);
    assert.equal(cs.filter((c) => c.rotulo === '⋯').length, 1, `🔴 CIEGO: «${clave}» sin «⋯»: ${pinta(cs)}`);
  }
});

test('SCRUM-1739 · como mucho UNA rellena por tarjeta, y es la del paso de HOY (c.22030)', async () => {
  const { fila } = await montar();
  const esperada = {
    'SIN-AGENDAR': null,
    'AGENDADO-HOY': '▶ Empezar',
    'AGENDADO-OTRO-DIA': null,
    'EN-CURSO': 'Abrir parte',
    'TERMINADO-CON-IMPORTE': '💰 Cobrar el resto',
    'TERMINADO-SIN-IMPORTE': null,
  };
  assert.deepEqual(Object.keys(esperada).sort(), CASOS.map((c) => c.clave).sort(), '🔴 la tabla de este test no cubre los mismos casos que monta');
  for (const [clave, boton] of Object.entries(esperada)) {
    const cs = controles(fila[clave]);
    const rellenas = cs.filter((c) => c.rellena);
    if (boton === null) {
      assert.equal(rellenas.length, 0, `🔴 «${clave}» no lleva paso de hoy y sale con rellena: ${pinta(cs)}`);
    } else {
      assert.equal(rellenas.length, 1, `🔴 «${clave}» lleva ${rellenas.length} rellenas (c.22030: como mucho UNA): ${pinta(cs)}`);
      assert.ok(rellenas[0].rotulo.startsWith(boton), `🔴 la rellena de «${clave}» es «${rellenas[0].rotulo}», no «${boton}»`);
    }
  }
});

test('SCRUM-1739 · «Agendar» y el «▶ Empezar» de OTRO día siguen SECUNDARIAS (los doce verdes de 917c)', async () => {
  const { fila } = await montar();
  for (const [clave, boton] of [['SIN-AGENDAR', 'Agendar'], ['AGENDADO-OTRO-DIA', '▶ Empezar']]) {
    const [b] = controles(fila[clave]).filter((c) => c.rotulo === boton);
    assert.ok(b.secundaria && !b.rellena, `🔴 «${boton}» de «${clave}» es «${clase(b.nodo)}»: c.22030 lo deja en secundaria`);
  }
});

test('SCRUM-1739 · la rellena va PRIMERA en su tarjeta, «Ver detalle» detrás y el «⋯» cierra', async () => {
  const { fila } = await montar();
  for (const clave of ['AGENDADO-HOY', 'EN-CURSO', 'TERMINADO-CON-IMPORTE']) {
    const cs = controles(fila[clave]);
    assert.ok(cs[0].rellena, `🔴 «${clave}»: lo primero de la tarjeta es «${cs[0].rotulo}», no su rellena: ${pinta(cs)}`);
    assert.equal(cs[1].rotulo, 'Ver detalle', `🔴 «${clave}»: detrás de la rellena va «${cs[1].rotulo}»: ${pinta(cs)}`);
    assert.equal(cs.at(-1).rotulo, '⋯', `🔴 «${clave}»: el «⋯» ya no cierra la tarjeta: ${pinta(cs)}`);
  }
  // …y donde NO hay rellena de la escalera, nada se mueve: «Ver detalle» delante, como en Presupuestos.
  for (const clave of ['SIN-AGENDAR', 'AGENDADO-OTRO-DIA', 'TERMINADO-SIN-IMPORTE']) {
    const cs = controles(fila[clave]);
    assert.equal(cs[0].rotulo, 'Ver detalle', `🔴 «${clave}» no tiene rellena y ha cambiado de orden: ${pinta(cs)}`);
    assert.equal(cs.at(-1).rotulo, '⋯', `🔴 «${clave}»: el «⋯» ya no cierra la tarjeta: ${pinta(cs)}`);
  }
});

test('SCRUM-1739 · mover la caja no parte la escalera: UNA `.jobs-acciones` por fila, su acción es hija DIRECTA y «Ver detalle» sigue fuera', async () => {
  const { fila } = await montar();
  for (const [clave, tr] of Object.entries(fila)) {
    const cajas = todos(tr).filter((n) => tiene(n, 'jobs-acciones'));
    assert.equal(cajas.length, 1, `🔴 «${clave}»: ${cajas.length} \`.jobs-acciones\` (guard:escalera-por-estado lee \`.jobs-acciones > button\`)`);
    const [detalle] = controles(tr).filter((c) => c.rotulo === 'Ver detalle');
    assert.notEqual(detalle.nodo._padre, cajas[0], `🔴 «${clave}»: «Ver detalle» ha entrado en \`.jobs-acciones\` (SCRUM-1562f)`);
  }
  for (const [clave, boton] of [['AGENDADO-HOY', '▶ Empezar'], ['AGENDADO-OTRO-DIA', '▶ Empezar'], ['SIN-AGENDAR', 'Agendar'], ['TERMINADO-CON-IMPORTE', '💰 Cobrar el resto']]) {
    const [b] = controles(fila[clave]).filter((c) => c.rotulo.startsWith(boton));
    assert.ok(tiene(b.nodo._padre, 'jobs-acciones'), `🔴 «${boton}» de «${clave}» cuelga de «${clase(b.nodo._padre)}», no de \`.jobs-acciones\`: la ficha dejaría de compararse con él`);
  }
});

test('SCRUM-1739 · sin poder facturar no hay cobro en la fila, y entonces el terminado se queda SIN rellena (regla 24)', async () => {
  const { fila } = await montar({ puedeFacturar: false });
  const cs = controles(fila['TERMINADO-CON-IMPORTE']);
  assert.equal(cs.filter((c) => c.rotulo.startsWith('💰 Cobrar el resto')).length, 0, `🔴 la fila ofrece cobrar sin poder facturar: ${pinta(cs)}`);
  assert.equal(cs.filter((c) => c.rellena).length, 0, `🔴 otra acción ha heredado el relleno del cobro: ${pinta(cs)}`);
  // Control: lo demás no depende de facturar.
  assert.ok(controles(fila['AGENDADO-HOY'])[0].rellena, '🔴 «▶ Empezar» de hoy ha dejado de ser rellena al no poder facturar');
});

test('SCRUM-1739 · el OPERARIO ve lo mismo: «▶ Empezar» de hoy rellena y primera (es quien lo midió en el recorrido H6)', async () => {
  const { fila } = await montar({ rol: 'tecnico' });
  const cs = controles(fila['AGENDADO-HOY']);
  assert.ok(cs[0].rellena && cs[0].rotulo === '▶ Empezar', `🔴 tarjeta de hoy del operario: ${pinta(cs)}`);
  assert.equal(cs.filter((c) => c.rellena).length, 1, `🔴 el operario ve ${cs.filter((c) => c.rellena).length} rellenas en la tarjeta de hoy`);
});
