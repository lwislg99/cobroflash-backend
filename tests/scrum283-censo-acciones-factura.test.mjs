// SCRUM-283 (B2) · CENSO DERIVADO de las acciones de la vista de detalle de FACTURA.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// QUÉ ES Y QUÉ NO ES
//
// El censo ENUMERA las acciones que EXISTEN hoy en `renderInvoiceDetailView`, con su condición de
// aparición. NO las mapea a ninguna celda de la tabla de estados: esa tabla está en tensión
// declarada (un «Borrador» que hoy no existe, un «Anulada» que sí y no está en la tabla, acciones
// nombradas que aún no se han construido) y el mapeo lo decide el fundador. El censo enumera; el
// mapeo coloca. Esta es la mitad del ticket que NO depende de esas contradicciones.
//
// POR QUÉ DERIVADO Y NO UNA LISTA: el propio ticket contó 8 acciones donde el árbol tiene 9. Una
// lista escrita a mano no avisa de lo que le falta; un censo derivado de la estructura, sí — lo
// dijo solo (ver el test del recuento).
//
// LAS PRUEBAS QUE EXIGE EL TICKET:
//   · SUELO — si el censo deja de ver acciones, FALLA. «No hay defecto» y «no supe mirar» son el
//             mismo número; el suelo los distingue.
//   · ROJO POR EL MECANISMO — quitar una acción la borra del censo, y cae POR ESO, no por un
//             SyntaxError.
//   · CONTROL NEGATIVO — el toggle PAGADA/PENDIENTE es UNA acción en dos caras; el censo no la
//             cuenta dos veces (serían 10). Demuestra que distingue.
//   · LA TRAMPA DE LA CASA — los botones de `abrirModalAnular` viven en el MISMO fichero pero no
//             son acciones de la factura. El censo se ciñe al cuerpo de la vista, como nos enseñó
//             el job_without_quote que estaba en el fichero de albaranes pero era de collect-rest.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { censarAccionesFactura, FUNCION_VISTA } from './_censo-acciones-factura.mjs';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const VISTA = path.join(RAIZ, 'public', 'dashboard', 'js', 'invoiceDetailView.js');
const codigoReal = fs.readFileSync(VISTA, 'utf8');

// ═════════════════════════════════════════════════════════════════════════════════════════
// EL CENSO REAL — su salida es media respuesta a las cinco contradicciones
// ═════════════════════════════════════════════════════════════════════════════════════════
test('SCRUM-283 · el censo deriva 9 acciones del árbol (el ticket decía 8)', () => {
  const { acciones, navegacion, vistaEncontrada } = censarAccionesFactura(codigoReal);
  assert.ok(vistaEncontrada, `🔴 no encuentro ${FUNCION_VISTA}: si se renombró, el censo no mira nada`);

  const ids = acciones.map((a) => a.id).join(', ');
  assert.equal(
    acciones.length, 9,
    `🔴 el censo ya no ve 9 acciones sino ${acciones.length}. Una acción que APARECE o DESAPARECE es ` +
      `una decisión, no un descuido — cuéntala en el ticket. Ahora ve: ${ids}`,
  );

  // Cada acción trae su condición de aparición: no está «en la pantalla», está en ciertos estados.
  for (const a of acciones) {
    assert.ok(typeof a.texto === 'string' && a.texto.length > 0, `🔴 ${a.id} sin texto`);
    assert.ok(Array.isArray(a.condicion), `🔴 ${a.id} sin condición derivada`);
  }

  // `btnBack` («← Volver a facturas») es NAVEGACIÓN, no acción: no se coloca en primaria/secundaria/⋮.
  assert.deepEqual(
    navegacion.map((a) => a.id), ['btnBack'],
    '🔴 la clasificación acción/navegación cambió; revisa la cadena de appendChild (header = navegación)',
  );
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// SUELO — 0 acciones no es una pantalla sana, es un censo roto
// ═════════════════════════════════════════════════════════════════════════════════════════
test('SCRUM-283 · SUELO: si el censo no ve acciones, FALLA (no dice «0 sin sitio»)', () => {
  // Cegamos el detector con una vista sin botones y comprobamos que el censo devuelve 0 —
  // exactamente el número que un detector roto sobre el árbol real también daría. Por eso el suelo,
  // sobre el árbol real, exige > 0: si algún día el censo se queda ciego, esto lo caza en vez de
  // cantar «no hay defecto».
  const cegado = `function ${FUNCION_VISTA}(c, id) { const page = document.createElement('div'); c.appendChild(page); }`;
  assert.equal(censarAccionesFactura(cegado).acciones.length, 0, 'el detector puede dar 0 cuando no hay nada que ver');

  assert.ok(
    censarAccionesFactura(codigoReal).acciones.length > 0,
    '🔴 SUELO: el censo no ve NINGUNA acción en el árbol real. No es que no haya acciones — es que ' +
      'el detector dejó de mirar (¿se renombró la vista, cambió el patrón de botón?).',
  );
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// ROJO POR EL MECANISMO — el censo reacciona a que una acción desaparezca
// ═════════════════════════════════════════════════════════════════════════════════════════
test('SCRUM-283 · rojo por el mecanismo: quitar el appendChild de una acción la borra del censo', () => {
  // El censo cuenta lo que se APPENDEA. Si una reorganización quita `actions.appendChild(btnX)`, la
  // acción se cae de la pantalla — y el censo la echa en falta cayendo POR ESO (una acción menos),
  // no por un SyntaxError. Se prueba mutando el código EN MEMORIA, sin tocar el árbol.
  const conAccion = `function ${FUNCION_VISTA}(c) {
    const page = document.createElement('div'); c.appendChild(page);
    const actions = document.createElement('div'); page.appendChild(actions);
    const btnX = document.createElement('button'); btnX.textContent = 'Hacer algo'; actions.appendChild(btnX);
  }`;
  const sinAppend = conAccion.replace('actions.appendChild(btnX);', '');

  assert.equal(censarAccionesFactura(conAccion).acciones.length, 1, 'con el appendChild, el censo ve la acción');
  const despues = censarAccionesFactura(sinAppend);
  assert.ok(despues.vistaEncontrada, 'el código mutado sigue parseando (no es un SyntaxError lo que lo tumba)');
  assert.equal(
    despues.acciones.length, 0,
    '🔴 el censo NO reacciona a quitar el appendChild: sería ciego a la desaparición silenciosa que ' +
      'esta tarea existe para impedir.',
  );
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// CONTROL NEGATIVO — el toggle es UNA acción en dos caras, no dos
// ═════════════════════════════════════════════════════════════════════════════════════════
test('SCRUM-283 · control negativo: el toggle es UNA acción, no dos (9, no 10)', () => {
  // `btnTogglePaid` es la misma acción en sus dos caras (pagar / revertir), no dos acciones. Si el
  // censo la contara dos veces serían 10. Este control demuestra que el censo cuenta BOTONES, no
  // textos — es lo que NO debe hacerlo caer. Sus dos caras ya no viven en un ternario del rótulo
  // (que ahora es el marcador, regla 30): las decide el registro por estado (primaria en pending,
  // «⋮» en paid).
  const { acciones } = censarAccionesFactura(codigoReal);
  const toggle = acciones.filter((a) => a.id === 'btnTogglePaid');
  assert.equal(toggle.length, 1, '🔴 el toggle se cuenta dos veces: serían 10 acciones, no 9');
  assert.ok(toggle[0].texto.includes('[PENDIENTE microcopy oficial]'), '🔴 el rótulo del toggle no es el marcador (regla 30)');
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// LA TRAMPA DE LA CASA — solo cuenta lo del CUERPO de la vista de factura
// ═════════════════════════════════════════════════════════════════════════════════════════
test('SCRUM-283 · trampa de la casa: los botones de OTRA función del fichero no cuentan', () => {
  // Sobre el árbol real: toda acción cae dentro del rango de `renderInvoiceDetailView`. Los botones
  // de `abrirModalAnular` (confirmar/cancelar del modal) están en el MISMO fichero pero fuera de la
  // vista, y no se cuelan.
  const { acciones, rangoVista } = censarAccionesFactura(codigoReal);
  for (const a of acciones) {
    assert.ok(
      a.linea >= rangoVista.desde && a.linea <= rangoVista.hasta,
      `🔴 la acción ${a.id} (L${a.linea}) cae FUERA del cuerpo de la vista (${rangoVista.desde}-${rangoVista.hasta}): ` +
        'el censo está mirando otra función del fichero.',
    );
  }

  // Sintético: un botón en una función HERMANA no se cuenta como acción de la factura.
  const conHermana = `function ${FUNCION_VISTA}(c) {
      const page = document.createElement('div'); c.appendChild(page);
      const actions = document.createElement('div'); page.appendChild(actions);
      const btnReal = document.createElement('button'); actions.appendChild(btnReal);
    }
    function abrirModalAnular() {
      const modal = document.createElement('div'); document.body.appendChild(modal);
      const btnCancelarDelModal = document.createElement('button'); modal.appendChild(btnCancelarDelModal);
    }`;
  const ids = censarAccionesFactura(conHermana).acciones.map((a) => a.id);
  assert.deepEqual(ids, ['btnReal'], `🔴 se coló un botón de otra función: [${ids.join(', ')}]`);
});
