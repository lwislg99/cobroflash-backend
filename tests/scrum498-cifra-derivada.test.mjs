// tests/scrum498-cifra-derivada.test.mjs — SCRUM-498 · el «21» se cuenta, y la prosa que lo escribe se ata.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// 🔴 QUÉ IMPIDE ESTO, Y TIENE FECHA
//
// `EmailMessage` lleva `merchantId` y entra en `schema.prisma` en cuanto se desbloquee SCRUM-497:
// está escrito en `scrum-475-schema-emailmessage` (`56a5e462`, 12-ago 11:05), esperando merge.
// **Ese día la población pasa de 21 a 22 y doce frases del árbol se vuelven falsas a la vez.** Hoy
// eso ocurriría en silencio: ningún guard mira esas frases.
//
// El test que decide es el ENSAYO DEL DÍA D: se inyecta ese modelo —el real, no uno inventado— y se
// comprueba que el mecanismo caza las frases NOMBRÁNDOLAS.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  modelosDelTexto, verificar, verificarEnMemoria, mensajeDeViejas, autoprueba,
  AFIRMACIONES, PENDIENTES_FUERA_DE_CARRIL, CAMPO,
} from './_afirmaciones-derivadas.mjs';

const RAIZ = path.resolve(import.meta.dirname, '..');
const SCHEMA = fs.readFileSync(path.join(RAIZ, 'prisma/schema.prisma'), 'utf8');

// La herramienta de la casa. Gana ella: ya existe, es inyectable y está probada.
const { modelosDelMerchant } = await import('../dist/modules/exports/domain/portabilidadCompleta.js');

const PorDmmf = modelosDelMerchant();
const PorTexto = modelosDelTexto(SCHEMA);
const DERIVADO = PorDmmf.length;

// ── 🔴 AUTOPRUEBA · antes de creerse ningún número ──────────────────────────────────────

test('SCRUM-498 · 🔴 AUTOPRUEBA: el contador y el guard, sobre fuente sintética', () => {
  const a = autoprueba();
  assert.ok(a.cuentaBien, '🔴 el contador de texto no cuenta bien un esquema de tres modelos.');
  assert.ok(a.noCuentaElQueNoTiene,
    `🔴 cuenta un modelo que NO tiene \`${CAMPO}\`: está midiendo la población equivocada.`);
  assert.ok(a.laCifraSube, '🔴 al entrar un modelo con `merchantId` la cifra no sube.');
  assert.ok(a.laFraseBuenaPasa, '🔴 una frase que dice la cifra correcta se marca como vieja.');
  assert.ok(a.laFraseViejaCae,
    '🔴 una frase que se quedó vieja NO cae. Es el día D en pequeño: si aquí no cae, tampoco caerá ' +
    'el día que entre `EmailMessage`.');
  assert.ok(a.laFraseReescritaSeDeclaraCiega,
    '🔴 una frase que cambió de redacción pasa en VERDE. «Ya no dice 21» y «no sé leer la frase» no ' +
    'pueden salir por la misma línea: la segunda deja el guard mirando a la pared.');
  assert.ok(a.sinModelosNoCuenta, '🔴 un esquema vacío no se declara como tal.');
});

// ── SUELO Y DOS INSTRUMENTOS ────────────────────────────────────────────────────────────

test('SCRUM-498 · 🔴 SUELO: cero modelos es CEGUERA, no un esquema limpio', () => {
  assert.ok(DERIVADO >= 15,
    `🔴 la derivación ve ${DERIVADO} modelos con \`${CAMPO}\`. Si el DMMF llega vacío —cliente sin ` +
    'generar, import roto— el contador daría CERO y todas las afirmaciones «no coincidirían» por el ' +
    'motivo equivocado. Regenera el cliente antes de creerte este número.');
  assert.ok(PorTexto.total >= 20,
    `🔴 el parseo de \`schema.prisma\` solo ve ${PorTexto.total} modelos: el formato cambió o el ` +
    'fichero se movió.');
});

test('SCRUM-498 · los DOS instrumentos dan la misma lista, o hay un cliente desparejado', () => {
  // ① el DMMF (el cliente generado) · ② el texto de `schema.prisma`. Si discrepan, lo que hay no es
  // una duda sobre el número: es un cliente que no corresponde al esquema, y este repo ya lo pagó.
  assert.deepEqual(PorDmmf.map((m) => m.modelo).sort(), PorTexto.conCampo,
    '🔴 el DMMF y el texto de `schema.prisma` NO ven los mismos modelos. No es que el número esté en ' +
    'duda: es que el cliente de Prisma no corresponde al esquema de este worktree. `npx prisma ' +
    'generate` antes de seguir.');
});

// ── CONTROL POSITIVO Y NEGATIVO ─────────────────────────────────────────────────────────

test('SCRUM-498 · 🔴 CONTROL POSITIVO: con el esquema tal cual, verde y ninguna frase vieja', (t) => {
  const r = verificar(RAIZ, DERIVADO);
  t.diagnostic(`derivado: ${DERIVADO} · afirmaciones atadas: ${r.filas.length} · viejas: ${r.viejas.length}`);
  assert.deepEqual(r.viejas.map((f) => `${f.fichero}:${f.linea}`), [],
    `🔴 HAY AFIRMACIONES QUE YA NO SON CIERTAS:\n\n${mensajeDeViejas(r)}\n\n` +
    '  Un número escrito en prosa no tiene fecha de caducidad visible, y el que lo lee no sabe que\n' +
    '  ya no vale. Corrige la frase con la cifra CONTADA, no con la que recuerdes.');
});

test('SCRUM-498 · 🔴 ninguna afirmación atada está CIEGA: si la frase cambió, se dice', () => {
  const r = verificar(RAIZ, DERIVADO);
  assert.deepEqual(r.ciegas.map((f) => `${f.fichero} — ${f.motivo}`), [],
    '🔴 el guard ha dejado de VER alguna de las frases que vigila.\n\n' +
    '  Eso NO es que la frase esté bien: es que el guard mira a la pared. Si has reescrito la frase,\n' +
    '  actualiza su patrón en `AFIRMACIONES`; si la has borrado, quita su entrada. Lo que no vale es\n' +
    '  que el registro apunte a un texto que ya no existe y siga dando verde.');
});

test('SCRUM-498 · CONTROL NEGATIVO: quitar un modelo SIN `merchantId` no mueve nada', () => {
  // Si tocar `Event` —que no tiene la columna— cambiara la cifra, estaríamos contando la población
  // equivocada: todos los modelos del esquema en vez de los del merchant.
  const sinEvent = SCHEMA.replace(/model Event \{[\s\S]*?\n\}/, '');
  const t = modelosDelTexto(sinEvent);
  assert.notEqual(t.total, PorTexto.total, '🔴 el control no ha quitado nada: `model Event` no se encontró.');
  assert.equal(t.conCampo.length, PorTexto.conCampo.length,
    `🔴 quitar \`Event\` (que NO tiene \`${CAMPO}\`) ha cambiado la cifra de ${PorTexto.conCampo.length} ` +
    `a ${t.conCampo.length}. Se está contando el total de modelos, no los del merchant.`);
});

// ── 🔴 EL ENSAYO DEL DÍA D ──────────────────────────────────────────────────────────────

test('SCRUM-498 · 🔴 EL ENSAYO DEL DÍA D: entra `EmailMessage` y las doce frases CAEN, nombradas', () => {
  // El modelo REAL de `scrum-475-schema-emailmessage` (56a5e462), no uno inventado: es el que va a
  // entrar. Se añade al TEXTO del esquema y se vuelve a contar — sin tocar `schema.prisma`, que es
  // de los fundadores.
  const EMAIL_MESSAGE = `
model EmailMessage {
  id         Int     @id @default(autoincrement())
  merchantId Int     @map("merchant_id")
  customerId Int?    @map("customer_id")
  kind       String
  toEmail    String  @map("to_email")
}
`;
  const crecido = modelosDelTexto(SCHEMA + EMAIL_MESSAGE);
  assert.equal(crecido.conCampo.length, DERIVADO + 1,
    '🔴 añadir `EmailMessage` —que lleva `merchantId`— no sube la cifra. El ensayo no ensaya nada.');

  const r = verificar(RAIZ, crecido.conCampo.length);
  assert.equal(r.ciegas.length, 0, '🔴 el guard está ciego: el ensayo no vale.');
  assert.equal(r.viejas.length, r.filas.length,
    `🔴 el día que entre \`EmailMessage\` solo caerían ${r.viejas.length} de ${r.filas.length} ` +
    'frases. Las que no caen se quedarían diciendo 21 para siempre, y nadie se enteraría — que es ' +
    'exactamente lo que pasa HOY con las doce.');

  const texto = mensajeDeViejas(r);
  // 🔴 SCRUM-497 · LAS CIFRAS DE ESTE ASERTO SE DERIVAN, y antes estaban escritas a mano
  // (`dice 21 y son 22`). El día D llegó —`EmailMessage` ya está en el esquema, así que las frases
  // dicen 22 y el ensayo cuenta 23— y este aserto se quedó viejo: **el mismo defecto que este
  // fichero existe para cazar, dentro de él**. Derivado del recuento, el ensayo vale en cualquier
  // árbol; la forma exigida —fichero, línea y «dice X y son Y»— no se relaja.
  const esperado = new RegExp(`src/app\\.ts:\\d+  dice ${DERIVADO} y son ${DERIVADO + 1}`);
  assert.match(texto, esperado,
    `🔴 el rojo no NOMBRA qué frase se quedó vieja ni dónde. Se esperaba ${esperado}. Dijo:\n${texto}`);
  for (const { fichero } of AFIRMACIONES) {
    assert.ok(texto.includes(fichero), `🔴 «${fichero}» no aparece en el rojo del día D.`);
  }
});

// ── QUE EL REGISTRO NO SE PUDRA ─────────────────────────────────────────────────────────

test('SCRUM-498 · el registro cubre los ocho ficheros del encargo, y dice cuál queda fuera', () => {
  const cubiertos = new Set(AFIRMACIONES.map((a) => a.fichero));
  for (const f of [
    'src/app.ts',
    'src/modules/exports/domain/portabilidadCompleta.ts',
    'src/modules/system/domain/barridoDemo.ts',
    'tests/_censo-merchant-de-la-url.mjs',
    'tests/scrum244-cobertura-portabilidad.test.mjs',
    'tests/scrum272-criterio-referencial.test.mjs',
    'tests/scrum314-wipedemo-derivado.test.mjs',
    'tests/scrum440-tenencia-supresion.test.mjs',
  ]) {
    assert.ok(cubiertos.has(f), `🔴 «${f}» tiene una afirmación de esta población y NO está atada.`);
  }
  // Y el hueco, DECLARADO: una ausencia sin explicar es indistinguible de un olvido.
  assert.equal(PENDIENTES_FUERA_DE_CARRIL.length, 1);
  assert.equal(PENDIENTES_FUERA_DE_CARRIL[0].fichero, 'tests/_merchant-fixture.mjs',
    '🔴 ha cambiado lo que queda fuera de carril. Si ya se puede entrar, átalo; si no, di por qué.');
});

test('SCRUM-498 · 🔴 el hueco declarado sigue existiendo, y no ha crecido', () => {
  // `_merchant-fixture.mjs` es zona de SCRUM-495/497. Sus frases dicen 21 y caerán el mismo día.
  // No se tocan aquí — pero si aparece una CUARTA, quiero enterarme.
  //
  // ⚠️ Se cuentan solo las líneas que hablan de ESTA población: un `\b21\b` a secas coge también
  // importes y fechas del fichero, y un trinquete que cuenta de más salta por motivos que no son.
  const texto = fs.readFileSync(path.join(RAIZ, 'tests/_merchant-fixture.mjs'), 'utf8');
  const cuantas = texto.split(/\r?\n/)
    .filter((l) => /\b21\b/.test(l) && /modelo|merchantId|deleteMany|merchant_id/i.test(l)).length;
  assert.ok(cuantas >= 1,
    '🔴 ya no hay ningún «21» en `_merchant-fixture.mjs`: o lo han atado (quita esta entrada de ' +
    '`PENDIENTES_FUERA_DE_CARRIL`) o la frase cambió y el hueco ya no es el que se declaró.');
  assert.ok(cuantas <= PENDIENTES_FUERA_DE_CARRIL[0].ocurrencias,
    `🔴 el hueco ha CRECIDO: ${cuantas} menciones y se declararon ` +
    `${PENDIENTES_FUERA_DE_CARRIL[0].ocurrencias}. Un hueco que crece deja de ser un hueco conocido.`);
});
