// scripts/_abrir-conceptos.mjs — SCRUM-915d · llegar al paso «Conceptos» del editor, como el profesional.
//
// Desde los pasos (v3 del editor), las líneas viven en el paso Conceptos, que se abre con «Continuar»
// desde el paso Cliente y sólo con un cliente elegido. Los guards de navegador que TECLEAN líneas
// (SCRUM-909 anchos, SCRUM-888 descuentos) tienen que hacer ese camino antes de teclear: sin él,
// escriben en un campo que no está a la vista, el total no se mueve y se declaran ciegos.
//
// Un solo sitio para el camino: si mañana cambia, cambia aquí y no en cada guard.

/** El cliente que las maquetas de `/admin/customers` sirven para poder elegir uno. */
export const CLIENTE_DE_PASO = { id: 7, name: 'Cliente QA', phone: '600111222' };

/**
 * Elige el cliente y pulsa «Continuar». Devuelve `null` si llega a Conceptos, o el motivo si no.
 * Juzga el ESTADO después de pulsar: que el concepto de la primera línea se vea.
 */
export async function abrirConceptos(pag) {
  const hay = await pag.waitForFunction(
    new Function(`var s = document.querySelector('select[name="customer_id"]'); return !!s && !!s.querySelector('option[value="${CLIENTE_DE_PASO.id}"]');`),
    { timeout: 10000 },
  ).then(() => true, () => false);
  if (!hay) return 'la lista de clientes no llegó al selector';
  await pag.select('select[name="customer_id"]', String(CLIENTE_DE_PASO.id));
  const pulsado = await pag.evaluate(new Function(`
    var bs = document.querySelectorAll('.quotes-left-card button');
    for (var i = 0; i < bs.length; i++) {
      var b = bs[i];
      if (b.textContent.trim() === 'Continuar' && b.checkVisibility() && !b.disabled) { b.click(); return true; }
    }
    return false;
  `));
  if (!pulsado) return 'no hay un «Continuar» habilitado en el paso Cliente';
  const abierto = await pag.waitForFunction(
    new Function(`var i = document.querySelector('.quote-line .quote-line__concept input'); return !!i && i.checkVisibility();`),
    { timeout: 5000 },
  ).then(() => true, () => false);
  return abierto ? null : '«Continuar» no abrió el paso Conceptos';
}
