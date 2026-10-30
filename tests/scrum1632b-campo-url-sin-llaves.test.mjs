// tests/scrum1632b-campo-url-sin-llaves.test.mjs — SCRUM-1632b
//
// El enlace de firma llegó roto el 18-oct (`/albaran/%7B%7B1%7D%7D<token>`, SCRUM-1236), igual que
// el del presupuesto y el del cobro en julio (P3-1, `docs/BUGS.md:1172`). Hasta el 29-oct nuestra
// spec mandaba escribir el campo URL del botón CON `{{1}}` («la URL base termina en `/{{1}}`»). Eso
// es lo que pide la API de Meta; las plantillas se dan de alta en el EDITOR, que según guías de
// terceros añade él el `{{1}}`. Uno escrito a mano queda literal delante del token.
//
// En julio se abrió el panel, se comparó con la spec, «parecía correcto», y volvió. Un arreglo que
// deja el camino por defecto como estaba vuelve a crear el defecto: por eso esto no es una nota,
// es un guard sobre la spec canónica (`docs/WHATSAPP_TEMPLATES.md`, la que la skill
// `yaqu-wa-templates` cita como «el detalle EXACTO»).
//
// Lo que exige:
//   ① ninguna línea de la spec (fuera de las citas `>`, que cuentan el porqué y citan la regla
//     vieja) enseña un campo URL de yaqu.app con `{{1}}` o `{{token}}` detrás, ni dice que la base
//     «termina en `/{{1}}`»;
//   ② las cuatro plantillas con enlace tienen su campo `https://yaqu.app/<ruta>/` en la tabla, y la
//     spec lleva escritas la regla del «UN SOLO `{{1}}`» y la prueba del móvil (`%7B%7B1%7D%7D`).
//
// ⛔ No dice qué hay puesto en Meta: eso sólo lo ve el fundador.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const SPEC = 'docs/WHATSAPP_TEMPLATES.md';

// Las cuatro que mandan un token en el botón (`urlButton`, `src/integrations/whatsappTemplates.ts`).
const CON_ENLACE = [
  ['albaran_para_firmar_es', 'albaran'],
  ['quote_decision_es', 'pay/quote'],
  ['payment_request_es', 'pay/invoice'],
  ['payment_confirmation_invoice_es', 'recibo'],
];

// Con dominio o sin él: §8 decía `/albaran/{{token}}` a secas, y la primera versión de este
// detector (sólo `yaqu.app/…`) no la veía. La mutación contra la spec de antes lo destapó.
const CAMPO_CON_LLAVES = /\/[\w-]+\/\{\{(?:1|token)\}\}|termina en `\/\{\{1\}\}`/;

/** Las líneas de la spec que instruyen: todo menos las citas `>`. */
function lineasQueInstruyen(texto) {
  return texto.split(/\r?\n/).map((l, i) => ({ n: i + 1, l })).filter(({ l }) => !/^\s*>/.test(l));
}

function acusadas(texto) {
  return lineasQueInstruyen(texto).filter(({ l }) => CAMPO_CON_LLAVES.test(l));
}

test('SCRUM-1632b · CONTROL: el detector caza la regla vieja y respeta las citas', () => {
  assert.equal(acusadas('- **Botones URL dinámica:** la URL base termina en `/{{1}}`; el código').length, 1);
  assert.equal(acusadas('  - URL base: `https://yaqu.app/pay/quote/{{1}}` → variable').length, 1);
  assert.equal(acusadas('- **Cuerpo — 3 variables** · **Botón URL dinámica** → `/albaran/{{token}}` · **Sin cabecera**.').length, 1);
  assert.equal(acusadas('  > Hasta ese día decía «la URL base termina en `/{{1}}`»').length, 0, 'una cita `>` cuenta el porqué, no instruye');
  assert.equal(acusadas('  | `quote_decision_es` | `https://yaqu.app/pay/quote/` | `/pay/quote/<token>` |').length, 0);
});

test('SCRUM-1632b · ① la spec no enseña a escribir `{{1}}` en el campo URL', () => {
  const texto = fs.readFileSync(path.join(RAIZ, SPEC), 'utf8');
  const lineas = lineasQueInstruyen(texto);
  assert.ok(lineas.length >= 200, `sólo ${lineas.length} líneas leídas de ${SPEC}: el lector no está mirando el fichero`);
  const malas = acusadas(texto);
  assert.deepEqual(
    malas.map(({ n, l }) => `${SPEC}:${n}: ${l.trim()}`), [],
    'el campo URL de un botón dinámico va SIN `{{1}}` (ver «Reglas comunes» de la spec y SCRUM-1632)',
  );
});

test('SCRUM-1632b · ② las cuatro con enlace tienen su campo, y la prueba del móvil está escrita', () => {
  const texto = fs.readFileSync(path.join(RAIZ, SPEC), 'utf8');
  for (const [plantilla, ruta] of CON_ENLACE) {
    const fila = texto.split(/\r?\n/).find((l) => l.startsWith(`  | \`${plantilla}\` |`));
    assert.ok(fila, `${plantilla}: falta su fila en la tabla de «Reglas comunes»`);
    assert.ok(fila.includes(`\`https://yaqu.app/${ruta}/\``), `${plantilla}: el campo de la tabla no es https://yaqu.app/${ruta}/ — ${fila}`);
  }
  assert.match(texto, /UN SOLO `\{\{1\}\}`, al final/, 'falta la regla «un solo `{{1}}`, al final»');
  assert.match(texto, /%7B%7B1%7D%7D/, 'falta la prueba que vale: el enlace copiado del botón en el móvil');
});
