import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = fs.readFileSync(path.join(raiz, 'public', 'dashboard', 'js', 'quotesView.js'), 'utf8');
const css = fs.readFileSync(path.join(raiz, 'public', 'dashboard', 'css', 'styles.css'), 'utf8');

/**
 * Código SIN comentarios. Un guard que prohíbe un patrón tiene que mirar el CÓDIGO, no la
 * prosa: el comentario que explica por qué se retiró el patrón CONTIENE el patrón, así que
 * un guard ingenuo se dispara contra su propia documentación. Es la trampa de
 * auto-referencia de SCRUM-129 — aquí ya ha mordido tres veces en el mismo ticket.
 */
const codigo = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|\s)\/\/.*$/gm, '$1');

/**
 * SCRUM-139 F4 — MARGEN E IVA A LA HOJA INFERIOR.
 *
 * Guards estructurales (quotesView.js es un módulo de navegador). Todos cubren roturas que NO
 * dan error: la pantalla sigue pintándose y el presupuesto sigue guardándose, solo que con
 * números que no son los que el usuario escribió.
 */

test('SCRUM-139 F4: los inputs de la hoja son LOS DE LA LÍNEA, no copias', () => {
  // Si alguien crea inputs nuevos dentro de la hoja (o clona los de la línea), habría DOS
  // fuentes de verdad: el usuario cambiaría el IVA en la hoja y el payload seguiría enviando
  // el viejo, porque `lineObj.vatInput` apuntaría al original. Silencioso y con dinero dentro.
  assert.ok(
    /ajustesCampos\.appendChild\(markupTd\)/.test(src) && /ajustesCampos\.appendChild\(vatTd\)/.test(src),
    'margen e IVA ya no van al contenedor que viaja a la hoja: revisa que no se hayan duplicado'
  );
  assert.ok(
    !/cloneNode/.test(src),
    'aparece cloneNode en el editor: un input clonado es una segunda fuente de verdad para un número que va en el presupuesto'
  );
  for (const clave of ['markupInput,', 'vatInput,']) {
    assert.ok(
      src.includes('      ' + clave),
      `lineObj pierde ${clave.replace(',', '')}: es el contrato que consumen payload, borrador, plantillas, IA y autocompletado`
    );
  }
});

test('SCRUM-139 F4: al cerrar la hoja, los campos se RECUPERAN antes de tirarla', () => {
  // LA ROTURA GRAVE de esta fase. Los inputs viven dentro del overlay mientras la hoja está
  // abierta: si se hace `overlay.remove()` sin sacarlos antes, se van con él. La línea se
  // queda sin margen ni IVA, `lineObj.markupInput` apunta a un nodo muerto y el presupuesto
  // se envía con lo que hubiera. Nadie ve un error.
  const cuerpo = src.slice(src.indexOf('function cerrarHoja()'));
  const iCampos = cuerpo.indexOf('ajustesCampos.remove()');
  const iOverlay = cuerpo.indexOf('overlay.remove()');
  assert.ok(iCampos !== -1, 'cerrarHoja ya no devuelve los campos de la línea: se destruyen con la hoja');
  assert.ok(iOverlay !== -1, 'cerrarHoja ya no retira la hoja');
  assert.ok(
    iCampos < iOverlay,
    'la hoja se retira ANTES de recuperar los campos: margen e IVA de esa línea se van con ella'
  );
});

test('SCRUM-139 F4: la hoja reutiliza .modal-overlay de AB3, sin componente nuevo', () => {
  const hoja = src.slice(src.indexOf('function abrirHojaAjustes'), src.indexOf('function campoLinea'));
  assert.ok(/className = "modal-overlay"/.test(hoja), 'la hoja deja de usar .modal-overlay: es lo que la hace hoja inferior en móvil y modal en escritorio');
  assert.ok(/aria-modal/.test(hoja) && /role", "dialog/.test(hoja), 'la hoja pierde su rol de diálogo accesible');
  assert.ok(/Escape/.test(hoja), 'la hoja ya no se cierra con Esc');
});

test('SCRUM-139 F4 (P3-13): el aviso "Final:" no vuelve a colgar debajo del input', () => {
  // Colgando bajo el input hacía la celda de PRECIO más alta y `align-items:end` le subía el
  // input ~15 px respecto a Cantidad y Total. Medido tras el arreglo: descuadre 0 px en ≥768.
  assert.ok(
    /priceTd\.querySelector\("\.quote-line__label"\)\.appendChild\(priceHint\)/.test(src),
    'el aviso "Final: X €" vuelve a colgar bajo el input: reabre el descuadre de PRECIO (BUGS.md P3-13)'
  );
  assert.ok(
    !/priceTd\.appendChild\(priceHint\)/.test(src),
    'el aviso "Final: X €" se vuelve a añadir directamente a la celda de precio'
  );
});

test('SCRUM-139 F4: no vuelven los selectores de tabla que F1 dejó muertos', () => {
  // El salto de foco a Cantidad tras elegir del autocompletado llevaba muerto desde F1:
  // buscaba closest("tr") y td:nth-child(2), que ya no existen, y el try se lo tragaba.
  assert.ok(!/closest\(["']tr["']\)/.test(codigo), 'vuelve closest("tr"): desde F1 la línea es una tarjeta de divs, no una fila de tabla');
  assert.ok(!/td:nth-child/.test(codigo), 'vuelve un selector td:nth-child: no hay celdas de tabla que contar desde F1');
  // Guarda de presencia: el salto de foco tiene que seguir EXISTIENDO, no solo estar bien
  // escrito. Un guard que solo prohíbe el patrón viejo se queda en verde si alguien borra el
  // bloque entero — y el foco dejaría de saltar igual que llevaba haciendo desde F1.
  assert.ok(
    /closest\("\.quote-line"\)/.test(codigo) && /\.quote-line__qty input/.test(codigo),
    'desaparece el salto de foco a Cantidad tras elegir del autocompletado'
  );
});

test('SCRUM-139 F4: el disparador dice lo que esconde y no se disfraza de "crear"', () => {
  assert.ok(/quote-line__ajustes/.test(src), 'desaparece el disparador de la hoja: margen e IVA quedarían inalcanzables');
  assert.ok(
    /resumen\.push\("Margen/.test(src) && /"IVA " \+ safeVat/.test(src),
    'el disparador deja de resumir IVA y margen: obligaría a abrir la hoja línea por línea solo para consultarlos'
  );
  const chip = css.slice(css.indexOf('.quote-line__ajustes {'), css.indexOf('.quote-line__ajustes:hover'));
  assert.ok(
    !/border:\s*1px dashed/.test(chip),
    'el disparador vuelve al borde discontinuo, que en F2 quedó RESERVADO a "+ Añadir línea" (crear): dos cosas distintas con el mismo idioma visual'
  );
});
