// tests/scrum172-tenencia-nullable.test.mjs — SCRUM-172 (tier 3)
//
// GUARD de tenencia NULLABLE. MODELOS_POR_MERCHANT es una lista a mano y, por el censo del
// ticket, 9 de 21 modelos no tienen FK detrás. El caso peligroso es la tenencia NULLABLE: el
// barrido por merchantId de limpiarMerchant no alcanza las filas `merchantId = null` y, sin FK,
// merchant.delete no protesta si quedan → basura huérfana, fallo MUDO. Es lo que SCRUM-174
// arregló para botSession (barrido por phone). Este guard exige que TODO modelo con merchantId
// nullable esté DECLARADO en TENENCIA_NULLABLE_CUBIERTA, para que un nullable nuevo sin cobertura
// sea un ROJO y no un silencio.
//
// Lee el SCHEMA (la fuente), no la lista a mano. Ungated: sin BD, sin gate — la garantía
// estructural no vive detrás de QA_DB_TEST (regla 3 del runbook). La parte del schema es
// INYECTABLE para poder VER el rojo sin tocar el fichero real.
//
// LÍMITE, dicho también aquí: verifica que la cobertura esté DECLARADA, NO que el mecanismo
// declarado exista ni funcione (un `{ x: 'barrido mágico' }` pasaría). Que el barrido por phone
// de botSession funciona lo prueba merchant-fixture.test.mjs (SCRUM-174), no esto. Callar ese
// límite lo convertiría en la próxima promesa falsa — el defecto que arregló SCRUM-186.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { TENENCIA_NULLABLE_CUBIERTA } from './_merchant-fixture.mjs';

const SCHEMA_REAL = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'prisma', 'schema.prisma');

// Sitio y forma que el mensaje de rojo entrega a quien lo lea (que no tenga que abrir el test).
const DONDE = '`TENENCIA_NULLABLE_CUBIERTA` en tests/_merchant-fixture.mjs';
const FORMA = "{ <modelo>: 'cómo se limpia — SCRUM-xxx' }  (ej.: botSession: 'barrido por phone — SCRUM-174')";

/**
 * Modelos con `merchantId Int?` (tenencia NULLABLE) de un texto de schema. Máquina de estados
 * línea a línea (mismo criterio que el censo del ticket, no un regex frágil de bloque).
 * camelCase para casar con la convención del cliente Prisma / MODELOS_POR_MERCHANT.
 */
export function modelosTenenciaNullable(schemaText) {
  const out = [];
  let modelo = null;
  let esNullable = false;
  for (const linea of schemaText.split('\n')) {
    const abre = linea.match(/^model\s+(\w+)\s*\{/);
    if (abre) { modelo = abre[1]; esNullable = false; continue; }
    if (modelo && /^\}/.test(linea)) {
      if (esNullable) out.push(modelo[0].toLowerCase() + modelo.slice(1));
      modelo = null;
      continue;
    }
    if (modelo && /^\s*merchantId\s+Int\?/.test(linea)) esNullable = true;
  }
  return out;
}

const sinDeclarar = (schemaText) => {
  const declarados = new Set(Object.keys(TENENCIA_NULLABLE_CUBIERTA));
  return modelosTenenciaNullable(schemaText).filter((mod) => !declarados.has(mod));
};

test('SCRUM-172: todo modelo con tenencia NULLABLE está cubierto EN DECLARACIÓN', () => {
  const schema = fs.readFileSync(SCHEMA_REAL, 'utf8');
  const huerfanos = sinDeclarar(schema);
  assert.equal(
    huerfanos.length, 0,
    `tenencia NULLABLE sin cobertura declarada: ${huerfanos.join(', ')}. `
    + `Para nullable, estar en MODELOS_POR_MERCHANT NO basta: el barrido por merchantId no toca las `
    + `filas null y, sin FK, merchant.delete no grita. DECLARA cómo se limpia en ${DONDE}, con la `
    + `forma ${FORMA}. (El guard comprueba la DECLARACIÓN, no que el mecanismo exista/funcione.)`,
  );
});

test('SCRUM-172 · el guard SE DISPARA: un nullable nuevo sin declarar sale ROJO nombrándolo', () => {
  // Schema sintético con un SEGUNDO modelo de tenencia nullable NO declarado (parte inyectable):
  // prueba que el guard lo detecta y lo NOMBRA, sin tocar el schema real. Es el fallo que dispara
  // el guard — «visto fallar», no descrito.
  const schemaFalso = [
    'model BotSession {', '  merchantId Int?', '}',
    'model NuevaCosaSinCubrir {', '  merchantId Int?', '}',
    'model Customer {', '  merchantId Int', '}',
  ].join('\n');
  assert.deepEqual(
    sinDeclarar(schemaFalso), ['nuevaCosaSinCubrir'],
    'el guard debe nombrar EXACTAMENTE el nullable no declarado (y no el declarado ni el requerido)',
  );
});

test('SCRUM-172 · sin declaración STALE: nada declarado que ya no sea nullable en el schema', () => {
  // La otra dirección: una entrada de TENENCIA_NULLABLE_CUBIERTA cuyo modelo ya no es nullable
  // (o no existe) es ruido que envejece y hace creer que cubre algo. Se nombra para quitarla.
  const schema = fs.readFileSync(SCHEMA_REAL, 'utf8');
  const nullables = new Set(modelosTenenciaNullable(schema));
  const stale = Object.keys(TENENCIA_NULLABLE_CUBIERTA).filter((mod) => !nullables.has(mod));
  assert.deepEqual(
    stale, [],
    `declaración STALE (ya no son nullable en el schema): ${stale.join(', ')}. Quítalas de ${DONDE}.`,
  );
});
