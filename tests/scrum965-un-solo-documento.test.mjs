// tests/scrum965-un-solo-documento.test.mjs — SCRUM-965
//
// LA RED QUE CORRE SIEMPRE. El veredicto de verdad lo da `npm run guard:un-solo-presupuesto`, que
// cuenta los POST en un navegador; esto vigila el MECANISMO sobre el fuente, para que nadie lo
// desarme sin enterarse en una tanda normal.
//
// ── QUÉ SE VIGILA, Y POR QUÉ ESTAS TRES COSAS ───────────────────────────────────────────────────
// El arreglo es una huella del payload: si lo que se va a mandar es idéntico a lo que ya se mandó,
// se reabre la hoja de aquel presupuesto en vez de crear otro. Tres piezas, y quitar cualquiera lo
// deja mudo:
//   1. la huella se saca del MISMO objeto que viaja (`quotePayload`), no de una copia;
//   2. la comparación está ANTES de `createQuote`, o el POST ya habría salido;
//   3. al crear se GUARDA la huella, o la próxima vez no hay con qué comparar.
//
// 🔴 Y una cuarta, que es la que impide el arreglo que se pasa de frenada: la condición tiene que
// mirar la HUELLA, no sólo si «ya se creó algo». Un `if (presupuestoYaCreado)` a secas le negaría
// al profesional el segundo presupuesto cuando ha cambiado el precio, que es un defecto nuevo.
//
// Se lee el fuente SIN COMENTARIOS: el comentario que explica el arreglo contiene las mismas
// palabras que el arreglo, y un guard por texto que no los quite se lee a sí mismo (A23 #2).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const FICHERO = path.join(RAIZ, 'public', 'dashboard', 'js', 'quotesView.js');

/**
 * El fuente sin comentarios. Se parte por LÍNEAS (`/\r?\n/`) y no con `.*$`: en JS el punto no casa
 * `\r` y este repo tiene ficheros CRLF, así que un recorte por regex de línea no quitaría nada y el
 * guard volvería a leerse a sí mismo (A23 #3, SCRUM-406).
 */
function sinComentarios(txt) {
  const sinBloque = txt.replace(/\/\*[\s\S]*?\*\//g, ' ');
  return sinBloque
    .split(/\r?\n/)
    .map((l) => l.replace(/\/\/.*/, ''))
    .join('\n');
}

const FUENTE = sinComentarios(fs.readFileSync(FICHERO, 'utf8'));

test('SCRUM-965 · CONTROL: el recorte de comentarios funciona sobre este fichero', () => {
  const crudo = fs.readFileSync(FICHERO, 'utf8');
  assert.ok(crudo.length > FUENTE.length + 1000,
    `el recorte de comentarios quitó ${crudo.length - FUENTE.length} caracteres de un fichero de ${crudo.length}: ` +
    'no está quitando nada y todo lo de abajo estaría leyendo prosa, no código');
  assert.ok(!FUENTE.includes('EL PRESUPUESTO QUE YA SE CREÓ DESDE ESTE FORMULARIO'),
    'el título del comentario que explica el arreglo sigue en el fuente recortado: el recorte no sirve');
});

test('SCRUM-965 · la huella se calcula sobre el MISMO objeto que viaja al servidor', () => {
  assert.ok(/const\s+huellaDeEstePresupuesto\s*=\s*JSON\.stringify\(quotePayload\)/.test(FUENTE),
    'la huella tiene que salir de `JSON.stringify(quotePayload)`. Si se calcula sobre una copia o ' +
    'sobre otra lista de campos, serían dos sitios que tienen que decir lo mismo y uno se quedará atrás.');
});

test('SCRUM-965 · la comparación va ANTES del POST, o el presupuesto ya se habría creado', () => {
  const iHuella = FUENTE.indexOf('huellaDeEstePresupuesto');
  const iPost = FUENTE.indexOf('await createQuote(quotePayload)');
  assert.ok(iHuella > 0, 'no encuentro la huella en el fuente');
  assert.ok(iPost > 0, 'no encuentro la llamada a createQuote');
  assert.ok(iHuella < iPost,
    'la huella se usa DESPUÉS de createQuote: para cuando se comprueba, el segundo presupuesto ya existe');
});

test('SCRUM-965 · la condición mira la HUELLA, no sólo que ya se haya creado algo', () => {
  // Ésta es la que impide el arreglo que se pasa de frenada. Un `if (presupuestoYaCreado)` a secas
  // deja verde al guard del caso A y ROJO al caso C, y este test lo dice sin arrancar navegador.
  assert.ok(/if\s*\(\s*presupuestoYaCreado\s*&&\s*presupuestoYaCreado\.huella\s*===\s*huellaDeEstePresupuesto\s*\)/.test(FUENTE),
    'la condición tiene que comparar la huella. Sin esa comparación, cambiar el precio y volver a ' +
    'pulsar NO crearía el presupuesto nuevo que el profesional quiere: sería un defecto a cambio de otro.');
});

test('SCRUM-965 · al crear se guarda la huella y la hoja, o la próxima vez no hay con qué comparar', () => {
  assert.ok(/presupuestoYaCreado\s*=\s*\{\s*huella:\s*huellaDeEstePresupuesto,\s*hoja:/.test(FUENTE),
    'tras crear hay que guardar `{ huella, hoja }`. Sin guardarlo, la comparación de arriba nunca casa ' +
    'y el defecto vuelve entero, con el guard en verde porque el mecanismo «existe».');
});

test('SCRUM-965 · el camino corto reabre la MISMA hoja que se guardó, no una reconstruida', () => {
  assert.ok(/openQuoteModal\(presupuestoYaCreado\.hoja\)/.test(FUENTE),
    'el segundo clic tiene que reabrir `presupuestoYaCreado.hoja`. Reconstruir el objeto a mano sería ' +
    'una segunda fuente: el día que la hoja gane un campo, el camino corto enseñaría una hoja distinta.');
  assert.ok(/openQuoteModal\(hojaDeEstePresupuesto\)/.test(FUENTE),
    'y la primera vez tiene que abrir EXACTAMENTE el objeto que se guarda, por el mismo motivo');
});

test('SCRUM-965 · el documento suelto no entra en esto, y es a propósito', () => {
  // El justificante navega a su ficha al emitir (`renderAppView('invoice-detail')`) y sólo rearma el
  // botón en el `catch`: no tiene el agujero, así que no necesita huella. Si alguien le quitara la
  // navegación, el caso B del guard —hoy verde— se pondría rojo. Aquí se ancla la razón.
  assert.ok(/renderAppView\("invoice-detail",\s*\{\s*invoiceId:\s*idEmitido\s*\}\)/.test(FUENTE),
    'el documento suelto tiene que seguir navegando a su ficha tras emitir: es lo que impide que su ' +
    'botón se quede armado, y es el control positivo del guard de navegador.');
});
