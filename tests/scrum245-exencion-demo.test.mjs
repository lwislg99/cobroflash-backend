// SCRUM-245 FASE 3 · EL DEMO RESPONDE A CUALQUIERA PORQUE ESTÁ DECIDIDO, NO PORQUE SE OLVIDÓ.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// QUÉ SE ARREGLA, Y NO ES SOLO TRAZABILIDAD
//
// Requisito de producto del fundador: el bot del demo tiene que **contestar a cualquier
// número**. Hoy eso se cumple, pero **por accidente**: las llamadas del bot no pasaban
// `merchantId`, y `demoSendBlocked` abre con `if (merchantId !== DEMO_MERCHANT_ID) return false`.
// O sea, exentas porque faltaba un argumento — comportamiento correcto por la razón equivocada.
//
// El peligro no era el de hoy: era el de mañana. El día que alguien pasara el `merchantId` «para
// arreglar la trazabilidad» —literalmente este ticket—, las demos se habrían apagado y **nadie
// habría relacionado las dos cosas**: el commit habla de logs, el síntoma es que el bot no
// contesta.
//
// Ahora el `merchantId` SÍ se pasa (hay rastro) y la exención está ESCRITA, con su motivo.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// DÓNDE SE PUEDE DECLARAR, Y POR QUÉ AHÍ
//
// Solo en `sendWhatsAppText`, y solo cuando el destino es **quien acaba de escribir**. Las dos
// mitades importan:
//
//   · SOLO TEXTO LIBRE. Una plantilla la inicia el negocio por definición, así que no puede ser
//     una respuesta. Y no puede ni intentarlo: `exentoDelDemo` **no existe** en la firma de
//     `sendWhatsAppTemplate`. Eso no es disciplina, es el compilador.
//   · SOLO AL REMITENTE. Dos envíos del bot van al PRO (`to: mPhone`), no a quien escribió: esos
//     NO se eximen, porque el pro no ha escrito nada. Se quedaron fuera a propósito.
//
// Y no se deduce de la ventana de 24 h de A5.2: `isServiceWindowOpen` exige `customerId`, y
// `recordInboundWaMessage` hace `return` temprano si el número no es cliente de nadie — que es
// justo el caso del demo, donde quien escribe es un desconocido. El llamador que procesa el
// entrante lo SABE; la BD no puede saberlo.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { fileURLToPath } from 'node:url';
import { demoSendBlocked } from '../dist/integrations/whatsappPolicy.js';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DEMO = 1;
const CUALQUIERA = '34655443322'; // un número que NO está en ninguna lista

// ═════════════════════════════════════════════════════════════════════════════════════════
// EL COMPORTAMIENTO · lo que el fundador pidió, y lo que sigue protegido
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-245 · el demo RESPONDE a cualquier número cuando la exención está declarada', () => {
  // El requisito, hecho test. Lista vacía a propósito: ni siquiera hace falta que el número
  // esté en DEMO_SAFE_NUMBERS, porque responder no depende de una lista.
  assert.equal(demoSendBlocked(DEMO, CUALQUIERA, [], 'respuesta-a-entrante'), false,
    '🔴 EL DEMO HA DEJADO DE CONTESTAR. Es el requisito de producto del fundador: el bot del ' +
    'demo responde a cualquiera. Si esto falla, las demos están rotas.');
});

test('SCRUM-245 · SIN la exención, el freno sigue exactamente igual', () => {
  // La otra mitad: esto no es «quitar el guard». Sin declarar nada, el demo sigue sin poder
  // escribir a quien no está en la lista.
  assert.equal(demoSendBlocked(DEMO, CUALQUIERA, []), true,
    '🔴 el freno del demo ha dejado de frenar: eso NO es lo que se aprobó');
  assert.equal(demoSendBlocked(DEMO, CUALQUIERA, [CUALQUIERA]), false, 'la lista sigue mandando');
  assert.equal(demoSendBlocked(2, CUALQUIERA, []), false, 'y solo aplica al merchant demo');
});

test('SCRUM-245 · la exención NO afecta a un merchant que no sea el demo', () => {
  assert.equal(demoSendBlocked(2, CUALQUIERA, [], 'respuesta-a-entrante'), false);
  assert.equal(demoSendBlocked(null, CUALQUIERA, [], 'respuesta-a-entrante'), false);
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// LOS LÍMITES, ESTRUCTURALES · lo que NO se puede eximir, no se puede ni escribir
// ═════════════════════════════════════════════════════════════════════════════════════════

const FUENTE_WA = fs.readFileSync(path.join(RAIZ, 'src', 'integrations', 'whatsapp.ts'), 'utf8');

/** Firma de una vía: desde `export async function <nombre>(` hasta el siguiente `export`. */
function firmaDe(nombre) {
  const ini = FUENTE_WA.indexOf(`export async function ${nombre}`);
  if (ini === -1) return '';
  const sig = FUENTE_WA.indexOf('\nexport ', ini + 1);
  return FUENTE_WA.slice(ini, sig === -1 ? undefined : sig);
}

test('SCRUM-245 · SOLO el texto libre puede eximirse; las plantillas NO', () => {
  // Decisión del fundador (2-ago-2026): el demo es una cuenta pública y sus clientes sembrados
  // llevan teléfonos del rango de móvil español real (SCRUM-180). Una plantilla sale sin que
  // nadie la haya pedido, así que el freno conserva ahí todo su sentido.
  assert.match(firmaDe('sendWhatsAppText'), /exentoDelDemo/,
    'la vía de texto libre tiene que poder declararlo');
  for (const via of ['sendWhatsAppTemplate', 'sendWhatsAppCtaUrl', 'sendWhatsAppButtons',
                     'sendWhatsAppList', 'sendWhatsAppDocument', 'sendWhatsAppLocationRequest',
                     'sendWhatsAppWindowFirst']) {
    const f = firmaDe(via);
    assert.ok(f.length > 0, `no encuentro ${via}: ¿se renombró?`);
    assert.doesNotMatch(f, /exentoDelDemo/,
      `🔴 ${via} acepta la exención del demo. Solo un texto libre puede ser una RESPUESTA; lo ` +
      'demás lo inicia el negocio y el freno de V0-2 tiene que seguir aplicando.');
  }
});

test('SCRUM-245 · la exención SOLO se declara enviando a quien acaba de escribir', () => {
  // Dos envíos del bot van al PRO (`to: mPhone`). Exentarlos sería colar, bajo la palabra
  // «respuesta», un mensaje que el destinatario no ha pedido. Se comprueba por AST: cada llamada
  // con `exentoDelDemo` tiene que ir a `from` o `phone`.
  const malos = [];
  for (const rel of ['src/modules/whatsappBot/domain/botFlow.service.ts',
                     'src/modules/whatsappBot/app/routes/whatsappIncoming.routes.ts']) {
    const ruta = path.join(RAIZ, rel);
    const src = ts.createSourceFile(ruta, fs.readFileSync(ruta, 'utf8'), ts.ScriptTarget.Latest, true);
    const visit = (n) => {
      if (ts.isObjectLiteralExpression(n)) {
        const exento = n.properties.find((p) => p.name?.getText?.(src) === 'exentoDelDemo');
        if (exento) {
          const to = n.properties.find((p) => p.name?.getText?.(src) === 'to');
          const destino = to && ts.isPropertyAssignment(to) ? to.initializer.getText(src) : '(sin to)';
          if (!/^(from|phone)$/.test(destino)) {
            malos.push(`${rel}:${src.getLineAndCharacterOfPosition(n.getStart(src)).line + 1} → to=${destino}`);
          }
        }
      }
      ts.forEachChild(n, visit);
    };
    visit(src);
  }
  assert.deepEqual(malos, [],
    '🔴 hay una exención «respuesta-a-entrante» cuyo destino NO es quien escribió:\n' +
    malos.map((m) => `    ${m}`).join('\n') +
    '\n  Responder es contestar a quien te ha escrito. Mandarle algo a un tercero no se acoge a esto.');
});

test('SCRUM-245 · SUELO: las exenciones existen y son las esperadas', () => {
  // Si el barrido no encontrara ninguna, el test de arriba pasaría por vacuidad — verde sin
  // haber mirado, que es el defecto que persigue este carril entero.
  const n = ['src/modules/whatsappBot/domain/botFlow.service.ts',
             'src/modules/whatsappBot/app/routes/whatsappIncoming.routes.ts']
    .reduce((acc, rel) => acc + (fs.readFileSync(path.join(RAIZ, rel), 'utf8')
      .match(/exentoDelDemo/g) || []).length, 0);
  assert.ok(n >= 15, `🔴 solo ${n} exenciones declaradas: el barrido no está viendo el bot`);
});

test('SCRUM-245 · el motivo es un tipo CERRADO, no una cadena libre', () => {
  // Una cadena libre convierte la exención en un campo de texto donde cabe cualquier excusa.
  const politica = fs.readFileSync(path.join(RAIZ, 'src', 'integrations', 'whatsappPolicy.ts'), 'utf8');
  assert.match(politica, /export type MotivoExencionDemo\s*=/);
  const motivos = (politica.match(/'[a-z-]+';/g) || []).filter((m) => m.includes('respuesta-a-entrante'));
  assert.equal(motivos.length, 1, '🔴 el tipo de motivos ha crecido: cada motivo nuevo es una puerta nueva');
});
