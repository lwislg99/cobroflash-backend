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

// ─────────────────────────────────────────────────────────────────────────────────────────
// 🔴 SCRUM-680 · CUATRO PRUEBAS DE ESTE FICHERO SE RETIRARON, Y AQUÍ ESTÁ POR QUÉ
//
// Se fueron las que vigilaban el REGISTRO de afirmaciones: «CONTROL POSITIVO con el esquema tal
// cual», «ninguna afirmación atada está CIEGA», «EL ENSAYO DEL DÍA D» y «el registro cubre los
// ocho ficheros». No se retiraron porque estorbaran: **se quedaron sin sujeto**.
//
// Este guard ataba las DOCE frases del árbol que escribían a mano el tamaño de la población de
// modelos con `merchantId`, para que no envejecieran en silencio. Y funcionó — cazó una que
// decía «de los 23 modelos, 19 mapean y DOS no», que además de vieja **no sumaba** (19+2=21) y
// vivía en `portabilidadCompleta.ts`, el camino del export de RGPD.
//
// En SCRUM-680 las doce frases **dejaron de decir un número**: donde hacía falta saber CUÁLES se
// nombran (`Quote` e `Invoice`), y una frase sin número no se desincroniza. Sin frases atadas, el
// ensayo no tiene qué hacer caer y su verde sería hueco.
//
// ⚠️ EL HECHO NO SE QUEDA SIN GUARDIÁN, solo sin ÉSTE. Que un modelo nuevo con `merchantId` no se
// olvide lo sostienen dos guards que DERIVAN DEL SCHEMA, no de la prosa:
//
//   · `tests/scrum172-cobertura-tenancy.test.mjs` → cae NOMBRANDO el modelo que nadie barre.
//     Comprobado ejecutándolo en SCRUM-680: con un `CuadernoDeObra` inyectado dice «Modelo(s)
//     con `merchantId` que NADIE barre: · cuadernoDeObra».
//   · SCRUM-192 → `ORDEN_BORRADO_MERCHANT`, la otra mitad (supresión, no portabilidad).
//
// Lo que SIGUE VIVO aquí, porque sigue midiendo algo: la autoprueba del detector sobre fuente
// sintética, el suelo de ceguera (cero modelos es no-supe-mirar), la comparación de los DOS
// instrumentos —texto del esquema contra DMMF, que caza un cliente desparejado— y el hueco
// declarado de `PENDIENTES_FUERA_DE_CARRIL`.
// ─────────────────────────────────────────────────────────────────────────────────────────
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


// ── QUE EL REGISTRO NO SE PUDRA ─────────────────────────────────────────────────────────


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
