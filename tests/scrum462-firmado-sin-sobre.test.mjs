// tests/scrum462-firmado-sin-sobre.test.mjs — SCRUM-462
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// EL HECHO QUE ABRE EL TICKET, MEDIDO EN PRODUCCIÓN POR EL FUNDADOR
//
// De **4** albaranes con `estado = 'firmado'` en producción, **3 no tienen sobre**
// (`evidencia_firma IS NULL`). No son sobres viejos sin versionar —`sobre_sin_v = 0`—: son
// documentos marcados como FIRMADOS sin nada que lo respalde.
//
//     merchant 22 · 2026-06-16 · sin sobre
//     merchant 18 · 2026-07-14 · sin sobre
//     merchant 22 · 2026-07-16 · sin sobre
//     merchant 22 · 2026-07-23 · v:1
//
// Hoy son de pruebas y el daño es cero. Lo que había que saber es si **el camino sigue abierto**.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// LA RESPUESTA: EL CAMINO ESTÁ CERRADO, Y LA HIPÓTESIS DE LAS FECHAS SE CONFIRMÓ
//
// `evidenciaFirma` se empieza a escribir el **22-jul-2026** (SCRUM-68, commit `2863836a`, medido
// con `git log -S` sobre `src/`). Los tres sin sobre son del 16-jun, 14-jul y 16-jul: **anteriores
// al mecanismo**. El primero con sobre es del 23-jul, un día después.
//
// ⚠️ Y eso NO se dio por bueno por la coincidencia de fechas —una ruta que marcara `firmado` sin
// construir sobre produciría exactamente los mismos datos—: se midió el código de HOY, en las DOS
// superficies, y las dos construyen el sobre antes de marcar.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// 🔴 POR QUÉ ESTE FICHERO EXISTE IGUALMENTE
//
// Que hoy esté cerrado no lo mantiene cerrado. **Nada impide que mañana alguien añada una tercera
// ruta que marque `firmado` sin sobre**, y el daño de esa ruta no se vería el día que se escribe:
// aparecería como un albarán firmado que el verificador declara `sin_evidencia` — un documento que
// dice estar firmado y no puede demostrarlo. Es el patrón de SCRUM-417: la medición se cierra CON
// el guard que la sostiene, no solo con el informe.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { fileURLToPath } from 'node:url';

import { escriturasDeAlbaran, funcionQueContiene, llamadaVaConCatch } from './_censo-escrituras-albaran.mjs';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

/** ¿Esta escritura MARCA el albarán como firmado? */
const marcaFirmado = (e) => /estado:\s*'firmado'/.test(e.data) || /\bestado\b/.test(e.indirecto || '');

// ── SUELO · TRES RECUENTOS, TRES ASSERTS ─────────────────────────────────────────────────

test('SCRUM-462 · SUELO: el censo ve el árbol, ve escrituras, y ve las que marcan firmado', () => {
  // Por separado a propósito: un suelo agregado puede tapar otro. Un escáner que leyera cuatro
  // ficheros y encontrara escrituras en ellos pasaría igual estando ciego para el resto.
  const { escrituras, ficheros } = escriturasDeAlbaran(RAIZ);

  assert.ok(ficheros > 100,
    `🔴 ESCÁNER CIEGO: solo ${ficheros} ficheros .ts recorridos en src/.`);
  assert.ok(escrituras.length >= 5,
    `🔴 ESCÁNER CIEGO: solo ${escrituras.length} escrituras de Albaran. Había OCHO al escribir esto.`);

  const firmantes = escrituras.filter(marcaFirmado);
  assert.ok(firmantes.length >= 1,
    '🔴 ESCÁNER CIEGO: CERO escrituras que marquen `estado: firmado`.\n\n' +
    '  Y sabemos que hay dos —el panel y la página pública—. «Ninguna ruta marca firmado» y «no\n' +
    '  supe encontrarlas» son el mismo número y significan lo contrario: con cero, el guard de\n' +
    '  abajo pasaría en verde sin comprobar nada, que es justo el defecto que persigue.');
});

// ── 🔴 EL GUARD ──────────────────────────────────────────────────────────────────────────

test('SCRUM-462 · 🔴 toda escritura que marca FIRMADO construye y guarda su SOBRE', () => {
  const { escrituras } = escriturasDeAlbaran(RAIZ);
  const firmantes = escrituras.filter(marcaFirmado);

  const sinSobre = [];
  for (const e of firmantes) {
    const guardaSobre = /\bevidenciaFirma\s*:/.test(e.data) || /\bevidenciaFirma\b/.test(e.indirecto || '');
    // Y no basta con que la clave esté: `evidenciaFirma: null` la tendría y sería EXACTAMENTE el
    // defecto. Se exige que el valor NO sea nulo y que la función construya el sobre de verdad.
    const nula = /\bevidenciaFirma\s*:\s*(null|undefined)\b/.test(e.data);
    const loConstruye = /buildFirmaEvidencia\s*\(/.test(funcionQueContiene(RAIZ, e.fichero, e.linea));
    if (!guardaSobre || nula || !loConstruye) {
      sinSobre.push(`${e.fichero}:${e.linea}` +
        (!guardaSobre ? ' · no guarda `evidenciaFirma`' : '') +
        (nula ? ' · la guarda a NULL' : '') +
        (!loConstruye ? ' · no llama a `buildFirmaEvidencia`' : ''));
    }
  }

  assert.deepEqual(sinSobre, [],
    '🔴 UNA RUTA MARCA UN ALBARÁN COMO FIRMADO SIN CONSTRUIR SU SOBRE DE EVIDENCIAS:\n' +
    sinSobre.map((s) => `   · ${s}`).join('\n') + '\n\n' +
    '  Eso deja un documento que DICE estar firmado y no puede demostrarlo: el verificador lo\n' +
    '  declarará `sin_evidencia` y no habrá nada contra lo que comparar. En producción ya hay\n' +
    '  TRES así —de antes de que el mecanismo existiera (SCRUM-68, 22-jul-2026)— y el trabajo de\n' +
    '  este ticket fue comprobar que el camino estaba cerrado. Esta ruta lo reabre.\n\n' +
    '  ⚠️ El daño NO se ve el día que se escribe. Se ve cuando alguien pide la prueba.\n\n' +
    '  Se arregla llamando a `buildFirmaEvidencia` y guardando su resultado en el MISMO `data`,\n' +
    '  como hacen las dos rutas que firman hoy — NO relajando este guard.');
});

test('SCRUM-462 · CONTROL POSITIVO, dentro del mismo test: las DOS superficies están clasificadas', () => {
  // Sin esto, el guard de arriba se cumpliría con un censo que no encuentra ninguna escritura de
  // firma: una lista vacía hace verdad cualquier «todas la construyen».
  //
  // Y son DOS superficies, no una: el panel del profesional y la página pública del cliente. Una
  // sola comprobada es media respuesta.
  const { escrituras } = escriturasDeAlbaran(RAIZ);
  const firmantes = escrituras.filter(marcaFirmado);

  const ficheros = [...new Set(firmantes.map((e) => e.fichero))];
  assert.ok(ficheros.some((f) => /albaranes\.routes\.ts$/.test(f)),
    `🔴 no se ve la firma del PANEL del profesional. Ficheros vistos: ${ficheros.join(', ')}`);
  assert.ok(ficheros.some((f) => /albaranPublic\.routes\.ts$/.test(f)),
    `🔴 no se ve la firma de la PÁGINA PÚBLICA del cliente. Ficheros vistos: ${ficheros.join(', ')}`);
  assert.equal(firmantes.length, 2,
    `🔴 hay ${firmantes.length} escrituras que marcan firmado y se conocían DOS. Si ha aparecido una ` +
    'tercera, no es un número que subir: es una superficie nueva que firma documentos y hay que ' +
    'mirarla una a una antes de dar por bueno este guard.');
});

test('SCRUM-462 · 🔴 CONTROL NEGATIVO: una escritura que NO marca firmado no hace caer el guard', () => {
  // Si el guard acusara a las otras seis —`pdfUrl`, token, `invoiceId`, emitir, el PATCH— se
  // desactivaría al primer roce. Ninguna de ellas firma nada, así que ninguna necesita sobre.
  const { escrituras } = escriturasDeAlbaran(RAIZ);
  const noFirmantes = escrituras.filter((e) => !marcaFirmado(e));

  assert.ok(noFirmantes.length >= 4,
    `🔴 solo se ven ${noFirmantes.length} escrituras que NO firman, y había seis: o el censo está ` +
    'corto, o el criterio se ha vuelto tan ancho que ya considera «firma» a todo.');
  for (const e of noFirmantes) {
    assert.ok(!/estado:\s*'firmado'/.test(e.data),
      `🔴 ${e.fichero}:${e.linea} marca firmado y está clasificada como que no: el criterio está roto.`);
  }
});

// ── LA MEDICIÓN, FIJADA PARA QUE NO SE PIERDA ────────────────────────────────────────────

test('SCRUM-462 · las dos rutas de firma construyen el sobre ANTES de marcar, y sin red de seguridad', () => {
  // El detalle que hace que el camino esté cerrado de verdad: `buildFirmaEvidencia` se llama con
  // `await` y SIN `.catch()`. Si lanzara, el `update` no llega a ejecutarse y el albarán se queda
  // sin firmar — que es lo correcto.
  //
  // 🔴 Un `.catch(() => null)` ahí sería el defecto entero, y parecería prudencia: la firma
  // «no fallaría», y quedaría un documento firmado sin nada que lo respalde.
  const { escrituras } = escriturasDeAlbaran(RAIZ);
  const firmantes = escrituras.filter(marcaFirmado);
  assert.ok(firmantes.length >= 2, '🔴 SUELO: se esperaban al menos las dos rutas de firma');

  for (const e of firmantes) {
    const fn = funcionQueContiene(RAIZ, e.fichero, e.linea);
    assert.match(fn, /const\s+evidencia\s*=\s*await\s+buildFirmaEvidencia\s*\(/,
      `🔴 ${e.fichero}:${e.linea} no construye el sobre con \`await buildFirmaEvidencia(\``);

    // ⚠️ Por AST, no por regex: `buildFirmaEvidencia(…)` y `ensureAlbaranPdf(…).catch(…)` viven en
    // la misma función, y una expresión golosa las confunde. El `.catch` del PDF ahí es CORRECTO
    // —si el PDF falla, la firma queda registrada y el GET lo regenera—; el de la evidencia no lo
    // sería. Distinguirlos es el trabajo.
    assert.equal(llamadaVaConCatch(RAIZ, e.fichero, 'buildFirmaEvidencia'), false,
      `🔴 ${e.fichero} envuelve \`buildFirmaEvidencia\` en un \`.catch\`. Parece prudencia y es el ` +
      'defecto: si el sobre falla, la firma NO puede seguir adelante. Un documento firmado sin ' +
      'evidencia es peor que una firma que no se completó.');
  }

  // 🔴 CONTROL NEGATIVO del detector de `.catch`, DENTRO del mismo test: el `.catch` que SÍ hay en
  // esas funciones —el del PDF— tiene que verse. Si el detector devolviera `false` siempre, el
  // assert de arriba pasaría sin comprobar nada.
  assert.equal(llamadaVaConCatch(RAIZ, firmantes[0].fichero, 'ensureAlbaranPdf'), true,
    '🔴 el detector no ve el `.catch` de `ensureAlbaranPdf`, que SÍ está y es correcto: entonces no ' +
    'distingue nada y su «no hay catch» de arriba no significa nada.');
});

// ── EL HUECO QUE EL CENSO DEJA, CUBIERTO ─────────────────────────────────────────────────

test('SCRUM-462 · 🔴 ningún albarán NACE firmado: las creaciones no pueden saltarse el sobre', () => {
  // El censo de arriba mira ACTUALIZACIONES. Si una creación pudiera poner `estado: 'firmado'`
  // directamente, se saltaría el guard entero sin que nadie lo notara — el albarán nacería firmado
  // y sin sobre, que es exactamente el defecto por otra puerta.
  //
  // Medido: hay DOS creaciones y ninguna marca firmado. Esto lo mantiene cierto.
  const RUTAS = ['src/modules/jobs/app/routes/albaranes.routes.ts', 'src/modules/jobs/app/routes/jobs.routes.ts'];
  let creaciones = 0;
  const nacenFirmados = [];

  for (const rel of RUTAS) {
    const src = fs.readFileSync(path.join(RAIZ, rel), 'utf8');
    const sf = ts.createSourceFile('x.ts', src, ts.ScriptTarget.Latest, true);
    const visitar = (n) => {
      if (ts.isCallExpression(n) && ts.isPropertyAccessExpression(n.expression) &&
          /^(create|createMany|upsert)$/.test(n.expression.name.text) &&
          /albaran$/i.test(n.expression.expression.getText(sf))) {
        creaciones += 1;
        const texto = n.getText(sf).replace(/\s+/g, ' ');
        if (/estado:\s*'firmado'/.test(texto)) {
          const { line } = sf.getLineAndCharacterOfPosition(n.getStart(sf));
          nacenFirmados.push(`${rel}:${line + 1}`);
        }
      }
      ts.forEachChild(n, visitar);
    };
    visitar(sf);
  }

  // SUELO propio: si no se encuentra ninguna creación, este test no vigila nada.
  assert.ok(creaciones >= 2,
    `🔴 ESCÁNER CIEGO: solo ${creaciones} creación(es) de albarán encontradas, y había DOS.`);

  assert.deepEqual(nacenFirmados, [],
    '🔴 UN ALBARÁN PUEDE NACER YA FIRMADO:\n' + nacenFirmados.map((s) => `   · ${s}`).join('\n') + '\n\n' +
    '  Eso se salta el guard de las actualizaciones por completo: el documento nace marcado como\n' +
    '  firmado y sin sobre de evidencias, y nadie lo mira. Un albarán nace en BORRADOR y se firma\n' +
    '  por su ruta, que es la que construye la prueba.');
});
