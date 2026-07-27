// SCRUM-180 — un proceso de test NO habla con la API de Meta (sin gate: corre en `npm test`,
// no toca BD ni red).
//
// QUÉ SE PROTEGE: los fixtures fabrican teléfonos tipo `34600` + id, y `+34 600 xxx xxx` no es
// un rango reservado para pruebas — es rango de móvil español ordinario, con números que
// pueden estar asignados a personas reales. Hasta ahora lo único que lo separaba de un envío
// de verdad era `process.env.WHATSAPP_DRY_RUN='1'` escrito dentro del propio fichero de test,
// antes del primer import de `dist`. Una línea, en un fichero editable, sin nadie que
// comprobara que seguía puesta en el momento del envío: protección de ORDEN DE EJECUCIÓN.
//
// ⚠️ ESTE FICHERO NO PONE WHATSAPP_DRY_RUN A PROPÓSITO. Es el único de la casa que se ejecuta
// con el dry-run APAGADO, porque lo que prueba es justo lo que pasa en ese estado. Es seguro
// porque no llama a ningún sender: llama a la función del guard y comprueba que LANZA. La
// verificación "visto abortar" del DoD se hace así, y no ejercitando un sender de verdad,
// porque un sender con el guard roto haría exactamente lo que hay que evitar — salir a Meta.
// Comprobar una salvaguarda no puede consistir en arriesgar el daño del que protege.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const FUENTE_SENDER = path.join(AQUI, '..', 'src', 'integrations', 'whatsapp.ts');

const { esProcesoDeTest, salidaAMetaBloqueada } = await import('../dist/integrations/whatsappPolicy.js');
const { asegurarSalidaAMetaPermitida } = await import('../dist/integrations/whatsapp.js');

// ── 1. VISTO ABORTAR — el DoD del ticket ─────────────────────────────────────────────────

test('SCRUM-180 · con el dry-run APAGADO y dentro de un proceso de test, la salida a Meta aborta', () => {
  assert.equal(
    process.env.WHATSAPP_DRY_RUN,
    undefined,
    'este fichero debe correr con el dry-run apagado: es el estado que prueba',
  );
  assert.throws(
    () => asegurarSalidaAMetaPermitida(),
    /SCRUM-180/,
    '🔴 EL FRENO NO ACTÚA. Un proceso de test con el dry-run apagado ha podido seguir hacia la ' +
      'API de Meta. El siguiente paso de ese camino es un WhatsApp real a un número fabricado ' +
      'de 34600xxxxxx, desde el número de negocio, a alguien que no lo ha pedido.',
  );
});

test('SCRUM-180 · el proceso actual SE RECONOCE como proceso de test', () => {
  assert.equal(
    esProcesoDeTest(),
    true,
    '🔴 Si el runner deja de reconocerse, el guard no salta y no lo nota nadie: el test seguiría ' +
      'verde porque nada falla. Por eso se asserta el reconocimiento aparte del bloqueo.',
  );
});

// ── 2. Las dos señales, cada una por su lado ─────────────────────────────────────────────
//
// Una sola señal no basta, y está comprobado en la máquina, no supuesto:
//   · `node --test`                        → NODE_TEST_CONTEXT='child-v8', execArgv sin `--test`
//   · `node --test --test-isolation=none`  → NODE_TEST_CONTEXT undefined, execArgv ['--test', …]
// Los dos modos son alcanzables desde la línea de órdenes, así que los dos tienen que cazarse.

test('SCRUM-180 · señal 1: NODE_TEST_CONTEXT (modo normal, hijo por proceso)', () => {
  assert.equal(esProcesoDeTest({ NODE_TEST_CONTEXT: 'child-v8' }, []), true);
});

test('SCRUM-180 · señal 2: execArgv con --test (modo --test-isolation=none)', () => {
  assert.equal(esProcesoDeTest({}, ['--test', '--test-isolation=none']), true);
  assert.equal(esProcesoDeTest({}, ['--test-concurrency=0']), true, 'las variantes --test-* tambien');
});

test('SCRUM-180 · producción NO se confunde con un proceso de test', () => {
  assert.equal(
    esProcesoDeTest({ NODE_ENV: 'production' }, []),
    false,
    '🔴 Un falso positivo aquí apaga TODOS los envíos de WhatsApp en producción: el producto ' +
      'entero. Es el lado caro de este guard y por eso tiene su propio caso.',
  );
  assert.equal(salidaAMetaBloqueada({ dryRun: false, env: { NODE_ENV: 'production' }, execArgv: [] }), false);
});

test('SCRUM-180 · en dry-run no se bloquea: los tests necesitan ejercitar el sender', () => {
  assert.equal(
    salidaAMetaBloqueada({ dryRun: true, env: { NODE_TEST_CONTEXT: 'child-v8' }, execArgv: ['--test'] }),
    false,
    'en dry-run el sender no llega a la red; bloquear ahí rompería la suite sin ganar nada',
  );
});

// ── 3. Ratchet: el punto de salida sigue siendo ÚNICO ────────────────────────────────────
//
// El guard vale lo que valga su cobertura. Si mañana alguien añade un sender con su propio
// `axios.post` al host de Meta, el guard no lo ve y no hay nada que lo delate — el test de
// arriba seguiría verde. Este ratchet es lo que convierte "todo pasa por metaHttp" de
// convención en mecanismo. Es el mismo razonamiento de SCRUM-128 con los endpoints de envío.
//
// (El literal del host no se escribe aquí a propósito: el guard hermano de SCRUM-124 r28
// barre TODO el repo buscándolo y solo se excusa a sí mismo y a dos rutas declaradas. Meter
// este fichero en su ALLOWED por una palabra en un comentario sería debilitar un guard bueno
// para acomodar prosa mía.)

test('SCRUM-180 · ratchet: ninguna llamada a Meta se salta el punto único', () => {
  const fuente = fs.readFileSync(FUENTE_SENDER, 'utf8');

  const sueltas = [...fuente.matchAll(/\baxios\.(get|post|put|patch|delete|request)\s*\(/g)];
  assert.equal(
    sueltas.length,
    0,
    `🔴 ${sueltas.length} llamada(s) de axios se saltan el interceptor de metaHttp ` +
      `(${sueltas.map((m) => m[0]).join(', ')}). Todo el tráfico hacia Meta tiene que pasar por ` +
      `metaHttp o el guard de SCRUM-180 no lo ve. Si de verdad hace falta una llamada aparte, ` +
      `lleva 'asegurarSalidaAMetaPermitida()' delante y explicado.`,
  );

  // El multipart usa `fetch` global, que no tiene interceptor: cada uno necesita el guard a mano.
  for (const m of fuente.matchAll(/\bfetch\s*\(/g)) {
    const antes = fuente.slice(Math.max(0, m.index - 500), m.index);
    assert.ok(
      antes.includes('asegurarSalidaAMetaPermitida()'),
      '🔴 hay un fetch() sin `asegurarSalidaAMetaPermitida()` delante: es una salida a Meta que ' +
        'el interceptor no cubre (no es axios) y que por tanto nadie está mirando.',
    );
  }
});
