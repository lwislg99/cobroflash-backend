// tests/scrum227-toda-via-deja-rastro.test.mjs — SCRUM-227 (RESEÑAS-1, carril B)
//
// REGLA: toda función de envío de WhatsApp registra su envío en WhatsAppMessage (recordWaMessage).
// Es TRAZABILIDAD, no telemetría: hoy una factura (sendWhatsAppDocument) o una petición de reseña
// (sendWhatsAppCtaUrl) se mandan sin que quede constancia de que salieron. Un documento fiscal que
// se envía tiene que constar.
//
// SIN ALLOWLIST — y a propósito. Un guard que llevara la lista de "las que sí registran" sería la
// lista-a-mano que SCRUM-199 vino a matar: el día que alguien añade sendWhatsAppLoQueSea y olvida el
// registro, una allowlist no se entera (no está en ella) y el guard pasa en falso. Aquí la
// pertenencia es ESTRUCTURAL y se lee del propio código: "toda función cuya firma empieza por
// sendWhatsApp es una vía de envío y TIENE que registrar". La firma es el criterio; no hay nombres
// escritos a mano. No hay excepciones porque PASO 0 las descartó: WhatsAppMessage.customerId es Int?
// (nullable), así que hasta sendWhatsAppButtons —cuyo destinatario es el PRO, no un cliente— cabe
// registrando con customerId null. Ninguna función queda fuera por "no encajar en el schema".
//
// SIN GATE: solo lee fuente (no BD, ni red, ni dist). leerFuente quita comentarios (SCRUM-193), así
// que este guard NO se caza a sí mismo con la prosa que explica la regla, y un `recordWaMessage`
// escrito dentro de un comentario NO cuenta como rastro (tiene que estar en código ejecutable).
//
// LIMITACIÓN CONOCIDA (declarada, no descubierta en un rojo raro): es un guard de PRESENCIA. Verifica
// que el cuerpo de cada vía menciona recordWaMessage en código, no que se ejecute en cada rama. El
// caso realista que defiende —una vía nueva que se olvida de registrar del todo— sí lo caza; el caso
// rebuscado —definir el helper y no llamarlo nunca— no. Cubrir eso pediría arrancar el módulo con un
// prisma falso; se deja fuera a conciencia, igual que _guard-texto.mjs declara lo que su filtro no ve.
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { leerFuente } from './_guard-texto.mjs';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const RUTA = path.join(RAIZ, 'src', 'integrations', 'whatsapp.ts');
const fuente = leerFuente(RUTA); // sin comentarios (SCRUM-193)

test('SCRUM-227 · toda sendWhatsApp* deja rastro en WhatsAppMessage (sin allowlist)', () => {
  // Enumera las vías por su FIRMA, no por una lista. downloadWhatsAppMedia / uploadWhatsAppMedia /
  // markInboundRead no casan (no empiezan por sendWhatsApp): no son envíos, no registran.
  const nombres = [...fuente.matchAll(/export async function (sendWhatsApp\w+)\s*\(/g)].map((m) => m[1]);

  // Suelo contra un guard VACÍO (no es allowlist: no nombra funciones). Si la enumeración devolviera
  // 0 —fichero movido, firma cambiada, regex rota— el bucle de abajo no miraría nada y el test
  // pasaría en falso. Hoy hay 8 vías; exigir ≥8 obliga a que el guard haya encontrado algo real.
  assert.ok(
    nombres.length >= 8,
    `esperaba ≥8 vías sendWhatsApp* y encontré ${nombres.length} (${nombres.join(', ') || 'ninguna'}); ` +
      `¿se movió src/integrations/whatsapp.ts o cambió la firma de las funciones de envío?`,
  );

  const sinRastro = nombres.filter((nombre) => {
    // Cuerpo de la función: desde su firma hasta el SIGUIENTE `export` (o el fin del fichero). Cada
    // slice contiene una sola función, así que el recordWaMessage de una no cuenta por otra.
    const ini = fuente.indexOf(`export async function ${nombre}`);
    const sig = fuente.indexOf('\nexport ', ini + 1);
    const cuerpo = fuente.slice(ini, sig === -1 ? undefined : sig);
    return !/recordWaMessage\s*\(/.test(cuerpo);
  });

  assert.deepEqual(
    sinRastro,
    [],
    `🔴 SCRUM-227: estas vías de envío NO dejan rastro (no llaman a recordWaMessage): ` +
      `${sinRastro.join(', ')}. Toda sendWhatsApp* registra en WhatsAppMessage — es trazabilidad de ` +
      `un envío (una factura o una reseña enviada tiene que constar), no telemetría opcional. Copia ` +
      `la forma de sendWhatsAppTemplate: recordWaMessage en el éxito Y en el fallo, todo .catch(()=>{}).`,
  );
});
