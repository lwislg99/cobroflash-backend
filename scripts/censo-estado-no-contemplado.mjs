#!/usr/bin/env node
// scripts/censo-estado-no-contemplado.mjs — SCRUM-707
//
// ════════════════════════════════════════════════════════════════════════════════════
// ¿QUÉ PASA SI LLEGA UN ESTADO QUE EL PRODUCTO NO CONOCE?
//
// Hoy revienta: `destinoEfectivo` devuelve `undefined` y `cubos[undefined].push` lanza
// TypeError. Este censo NO arregla nada — mide las tres opciones para que la decisión del
// fundador se tome sobre números y no sobre preferencias.
//
// 🔴 EL NÚMERO QUE DECIDE: caer a un cubo por defecto no «esconde el problema». OFRECE
// acciones que están OCULTAS EN TODOS los estados conocidos — `btnAnular` en la factura,
// `btnEmitir`/`btnFirmarAqui` en el albarán—, justo en el estado que nadie ha vetado.
// ════════════════════════════════════════════════════════════════════════════════════
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const ley = require('../public/dashboard/js/patronDetalleAcciones.js');
const inv = require('../public/dashboard/js/invoiceActionsRegistry.js');
const alb = require('../public/dashboard/js/albaranActionsRegistry.js');

const CASOS = [
  ['FACTURA', inv.INVOICE_ACTION_REGISTRY, inv.INVOICE_STATES],
  ['ALBARÁN', alb.ALBARAN_ACTION_REGISTRY, alb.ALBARAN_STATES],
];
const DESCONOCIDO = 'estado-que-el-producto-no-conoce';

for (const [nombre, registro, estados] of CASOS) {
  console.log(`\n════════════════ ${nombre} · ${registro.length} acciones · estados ${estados.join(' ')} ════════════════`);

  // ── Referencia: qué se ofrece en un estado CONOCIDO ──────────────────────────────────
  for (const e of estados) {
    const d = registro.map((a) => ley.destinoEfectivo(a, e, {}));
    const visibles = registro.filter((a, i) => d[i] !== 'oculta' && d[i] !== 'seccion-propia');
    console.log(`  ${e.padEnd(12)} ofrece ${String(visibles.length).padStart(2)}: ${visibles.map((a) => a.id).join(', ')}`);
  }

  const d = registro.map((a) => ley.destinoEfectivo(a, DESCONOCIDO, {}));
  const indefinidos = d.filter((x) => x === undefined).length;
  console.log(`\n  🔴 con un estado NO CONTEMPLADO: ${indefinidos}/${registro.length} destinos \`undefined\``);

  // ── (a) caer a un cubo por defecto ───────────────────────────────────────────────────
  console.log('\n  (a) CAER A UN CUBO POR DEFECTO — qué quedaría OFRECIDO:');
  console.log(`      las ${registro.length} acciones, TODAS: ${registro.map((a) => a.id).join(', ')}`);
  const enAlgunEstadoOcultas = registro.filter((a) => estados.every((e) => {
    const x = ley.destinoEfectivo(a, e, {});
    return x === 'oculta' || x === 'seccion-propia';
  }));
  console.log(`      de ellas, ${enAlgunEstadoOcultas.length} están OCULTAS en TODOS los estados conocidos:`);
  console.log(`        ${enAlgunEstadoOcultas.map((a) => a.id).join(', ') || '(ninguna)'}`);
  const maxConocido = Math.max(...estados.map((e) => registro.filter((a) => {
    const x = ley.destinoEfectivo(a, e, {});
    return x !== 'oculta' && x !== 'seccion-propia';
  }).length));
  console.log(`      ⇒ se ofrecerían ${registro.length} acciones donde el máximo vetado es ${maxConocido}.`);

  // ── (b) no pintar nada ───────────────────────────────────────────────────────────────
  console.log('\n  (b) NO PINTAR LA FILA — qué quedaría:');
  console.log('      0 acciones. La pantalla de detalle abre y no ofrece NADA, sin decir por qué.');

  // ── (c) pintarla diciendo que no se reconoce ─────────────────────────────────────────
  console.log('\n  (c) DECIR QUE NO SE RECONOCE: 0 acciones + un aviso. Necesita rótulo del fundador.');
}

// ── Y la pregunta que ninguna de las tres contesta sola ────────────────────────────────
console.log('\n════════════════ ¿QUÉ ACCIONES SON PELIGROSAS? ════════════════');
for (const [nombre, registro] of CASOS) {
  const peligrosas = registro.filter((a) => /anular|emitir|borrar|elimin|firmar|cobrar|enviar/i.test(a.id));
  console.log(`  ${nombre}: ${peligrosas.map((a) => a.id).join(', ') || '(ninguna por nombre)'}`);
}
