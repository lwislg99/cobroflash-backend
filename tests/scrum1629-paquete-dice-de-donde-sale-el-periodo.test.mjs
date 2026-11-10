// tests/scrum1629-paquete-dice-de-donde-sale-el-periodo.test.mjs — SCRUM-1629
//
// LA TARJETA «PAQUETE DEL TRIMESTRE» DICE DE DÓNDE SALE EL PERIODO.
//
// No tiene selector propio (SCRUM-1602): descarga el año y el trimestre de «Facturas emitidas», la
// tarjeta de encima. Sin decirlo, un profesional podía llevarle al asesor otro trimestre. Literal:
// SCRUM-1629 c.21194, elegido por el orquestador por delegación del fundador (no firmado por él).
// Se mide en el banco de vistas, como 1602: la vista se pinta con cada modo y se mira la tarjeta.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cargarDashboard, pintarVista } from './_banco-vistas.mjs';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const VISTA = path.join(RAIZ, 'public/dashboard/js/exportView.js');

const PERIODO = 'Usa el año y el trimestre seleccionados arriba.';

export const MUTACIONES_QUE_ME_TUMBAN = [
  {
    // La línea sale de la tarjeta: vuelve el hueco del ticket.
    fichero: 'public/dashboard/js/exportView.js',
    de: '<p class="paquete-trimestre__texto" id="paquete-trimestre-periodo">Usa el año y el trimestre seleccionados arriba.</p>',
    a: '',
    cae: 'SCRUM-1629 · en modo `fiscal` la tarjeta dice, ANTES del botón, que el periodo es el de arriba',
  },
];

async function montar(modo) {
  const fetch = async () => ({ ok: true, status: 200, headers: { get: () => 'application/json' }, json: async () => ({}), text: async () => '' });
  const banco = cargarDashboard(RAIZ, { red: { fetch } });
  banco.ctx.appModoEmision = modo;
  banco.ctx.showToast = () => {};
  const r = await pintarVista(banco, 'renderExportView');
  return { r, el: (id) => banco.reg.porId.get(id) };
}

const marcadoDeLaTarjeta = () => {
  const m = /const TARJETA_PAQUETE_TRIMESTRE = `([\s\S]*?)`;/.exec(fs.readFileSync(VISTA, 'utf8'));
  assert.ok(m, '🔴 CIEGO: no encuentro el marcado de la tarjeta');
  return m[1];
};

test('SCRUM-1629 · en modo `fiscal` la tarjeta dice, ANTES del botón, que el periodo es el de arriba', async () => {
  const { r, el } = await montar('fiscal');
  assert.equal(r.error, null, `🔴 la vista revienta al abrirse: ${r.error && r.error.message}`);
  assert.ok(el('paquete-trimestre-card'), '🔴 NO PUDE MIRAR: en modo fiscal no se pinta la tarjeta');
  assert.ok(el('paquete-trimestre-periodo'),
    '🔴 la tarjeta del paquete no dice de dónde sale el periodo: se descarga el de «Facturas emitidas» sin avisar');
  // El literal, tal cual, DENTRO de la plantilla (como T1–T7 de 1602; interpolado, el censo de
  // SCRUM-601 dejaba de ver que la tarjeta sólo existe en `fiscal`).
  const marcado = marcadoDeLaTarjeta();
  assert.ok(marcado.includes(`id="paquete-trimestre-periodo">${PERIODO}</p>`),
    `🔴 la línea del periodo no dice «${PERIODO}» (SCRUM-1629 c.21194)`);
  // Y su procedencia escrita como DELEGACIÓN, no como firma (c.21194), justo encima de la plantilla.
  const fuente = fs.readFileSync(VISTA, 'utf8');
  const cabecera = fuente.slice(Math.max(0, fuente.indexOf('const TARJETA_PAQUETE_TRIMESTRE') - 900), fuente.indexOf('const TARJETA_PAQUETE_TRIMESTRE'));
  assert.ok(cabecera.includes(PERIODO) && /SCRUM-1629 c\.21194/.test(cabecera),
    '🔴 el literal no cita su procedencia (SCRUM-1629 c.21194) junto a la plantilla');
  assert.match(cabecera, /delegaci[oó]n del fundador/, '🔴 la cita no dice que es una DELEGACIÓN');
  assert.doesNotMatch(cabecera.replace(/no firmó el literal/g, ''), /aprobado por el fundador/i,
    '🔴 c.21194: este literal NO puede marcarse como «aprobado por el fundador»');
  // Se lee antes de pulsar: va antes del botón.
  const iPeriodo = marcado.indexOf('id="paquete-trimestre-periodo"');
  const iBoton = marcado.indexOf('id="btn-paquete-trimestre"');
  assert.ok(iPeriodo >= 0 && iBoton > iPeriodo, '🔴 la línea del periodo no va antes del botón');
});

test('SCRUM-1629 · «arriba» es VERDAD: «Facturas emitidas» se pinta antes que la tarjeta del paquete', () => {
  const fuente = fs.readFileSync(VISTA, 'utf8');
  const iEmitidas = fuente.indexOf('id="libro-emitidas-card"');
  const iPaquete = fuente.indexOf('${conPaquete ? TARJETA_PAQUETE_TRIMESTRE');
  assert.ok(iEmitidas >= 0 && iPaquete >= 0, '🔴 CIEGO: no encuentro las dos tarjetas en el marcado de la vista');
  assert.ok(iEmitidas < iPaquete,
    '🔴 la tarjeta del paquete ya no va debajo de «Facturas emitidas»: «seleccionados arriba» mentiría');
});

test('SCRUM-1629 · CONTROL: fuera de `fiscal` la línea tampoco existe (no hay tarjeta)', async () => {
  for (const modo of ['receipt', 'demo', null]) {
    const { r, el } = await montar(modo);
    assert.equal(r.error, null, `🔴 con modo ${String(modo)} la vista revienta`);
    assert.equal(el('paquete-trimestre-periodo'), undefined, `🔴 con modo ${String(modo)} se pinta la línea del periodo`);
    assert.ok(el('btn-libro-emitidas'), `🔴 NO PUDE MIRAR: con modo ${String(modo)} no se pinta «Facturas emitidas»`);
  }
});
