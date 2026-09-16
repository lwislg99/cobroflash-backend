// tests/scrum375-recarga-no-es-escritura.test.mjs — SCRUM-375
//
// UN FALLO DE LECTURA NO SE PRESENTA COMO UN FALLO DE ESCRITURA.
//
// El `catch` del marcado en bloque envolvía también al `await reload()` que iba DESPUÉS del POST.
// Si la escritura salía bien y fallaba la recarga, la pantalla decía «No se han podido marcar como
// pagadas» **cuando sí se marcaron**: el profesional vuelve a pulsar sobre facturas ya pagadas, o
// se va creyendo que no ha cobrado. Es camino de dinero.
//
// ⚠️ EL TEST QUE DECIDE ES EL PRIMERO, y el segundo existe para que el primero signifique algo:
// un fichero que nunca dijera que algo falló pasaría el primero con matrícula. Los dos juntos son
// los que distinguen.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import ts from 'typescript';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const F_VISTA = path.join(RAIZ, 'public', 'dashboard', 'js', 'invoicesView.js');
const VISTA = fs.readFileSync(F_VISTA, 'utf8');
const { resultadoMarcadoEnBloque, COPY_BULK_PAGADAS, textoMarcadas } =
  createRequire(import.meta.url)(F_VISTA);

// ── ① 🔴 EL QUE DECIDE: escritura EN VERDE y recarga rota ────────────────────────────────

test('SCRUM-375 · ① 🔴 si SOLO falla la recarga, la pantalla NO puede decir que el marcado falló', () => {
  const r = resultadoMarcadoEnBloque({ escrituraOk: true, recargaOk: false, marcadas: 3 });

  assert.equal(r.seMarcaron, true,
    '🔴 con la escritura en verde, el resultado dice que NO se marcaron. Las facturas están ' +
    'pagadas en la base y la pantalla lo niega.');
  assert.notEqual(r.texto, COPY_BULK_PAGADAS.escrituraFallida,
    '🔴 LA PANTALLA DICE «no se han podido marcar como pagadas» Y SÍ SE MARCARON.\n\n' +
    '  Es el defecto exacto de este ticket: un fallo de LECTURA presentado como uno de ESCRITURA.\n' +
    '  El profesional vuelve a pulsar sobre facturas ya pagadas, o se va creyendo que no cobró.');
  assert.notEqual(r.tono, 'error',
    '🔴 el aviso sale en tono de error sobre una operación que salió bien');
  assert.equal(r.tono, 'warning', '🔴 se marcó pero la lista puede estar vieja: eso es un aviso, no un éxito mudo');
  assert.match(r.texto, /marcad/i, '🔴 el aviso de la recarga no dice que SÍ se marcaron');
});

// ── ② EL SIMÉTRICO: sin él, el primero no distingue nada ─────────────────────────────────

test('SCRUM-375 · ② si falla la ESCRITURA, la pantalla sí tiene que decirlo', () => {
  const r = resultadoMarcadoEnBloque({ escrituraOk: false, recargaOk: true, marcadas: 0 });
  assert.equal(r.seMarcaron, false);
  assert.equal(r.texto, COPY_BULK_PAGADAS.escrituraFallida,
    '🔴 la escritura ha fallado y no se dice con el texto firmado en SCRUM-373');
  assert.equal(r.tono, 'error');

  // Y el caso bueno, para que «no dice que falló» no pueda venir de no decir nunca nada.
  const ok = resultadoMarcadoEnBloque({ escrituraOk: true, recargaOk: true, marcadas: 3 });
  assert.equal(ok.tono, 'success');
  assert.equal(ok.texto, '✓ 3 facturas marcadas como pagadas.');

  // Los tres resultados son DISTINGUIBLES entre sí: si dos coincidieran, la pantalla no informaría.
  const textos = new Set([r.texto, ok.texto, resultadoMarcadoEnBloque({ escrituraOk: true, recargaOk: false, marcadas: 3 }).texto]);
  assert.equal(textos.size, 3, '🔴 dos de los tres desenlaces dicen lo mismo');
});

test('SCRUM-375 · el recuento no usa «(s)»: singular y plural son frases distintas', () => {
  assert.equal(textoMarcadas(1), '✓ 1 factura marcada como pagada.');
  assert.equal(textoMarcadas(3), '✓ 3 facturas marcadas como pagadas.');
  assert.equal(/\((s|es)\)/.test(textoMarcadas(1) + textoMarcadas(3)), false,
    '🔴 ha entrado un «(s)» en el recuento');
});

// ── ③ Y EN EL CÓDIGO: la recarga fuera del `try` de la escritura ─────────────────────────

/** El `try` que contiene el POST del marcado en bloque, leído del AST. */
function tryDeLaEscritura(fuente) {
  const sf = ts.createSourceFile('x.js', fuente, ts.ScriptTarget.Latest, true);
  let encontrado = null;
  const visita = (n) => {
    if (ts.isTryStatement(n)) {
      const texto = n.tryBlock.getText(sf);
      if (texto.includes('/admin/invoices/bulk-paid')) encontrado = texto;
    }
    ts.forEachChild(n, visita);
  };
  visita(sf);
  return encontrado;
}

test('SCRUM-375 · ③ el `reload()` NO vive dentro del try del POST', () => {
  const bloque = tryDeLaEscritura(VISTA);
  assert.ok(bloque,
    '🔴 ESCÁNER CIEGO: no encuentro el `try` que contiene el POST a `/admin/invoices/bulk-paid`. ' +
    'Si cambió de forma, el assert de abajo pasaría sobre un texto vacío.');
  assert.equal(/\breload\s*\(/.test(bloque), false,
    '🔴 EL `reload()` HA VUELTO DENTRO DEL TRY DE LA ESCRITURA.\n\n' +
    '  Con eso, un fallo de la recarga entra por el `catch` del POST y la pantalla vuelve a decir\n' +
    '  «no se han podido marcar como pagadas» sobre facturas que SÍ se marcaron. Es el defecto\n' +
    '  entero de este ticket, devuelto en una línea.');
  assert.match(bloque, /apiRequest\('\/admin\/invoices\/bulk-paid'/,
    '🔴 (suelo) el bloque leído no es el del POST');
});

test('SCRUM-375 · la microcopy nueva va con marcador; la firmada en SCRUM-373 no se toca', () => {
  assert.equal(COPY_BULK_PAGADAS.escrituraFallida, 'No se han podido marcar como pagadas. Vuelve a intentarlo.',
    '🔴 se ha reescrito un texto FIRMADO en SCRUM-373: eso es decisión del asesor');
  // 17-ago-2026 · FIRMADO. Lo que este test defiende sigue igual y por eso se comprueba el TEXTO y
  // no la ausencia de marcador: los DOS avisos tienen que seguir diciendo cosas distintas — uno es
  // «no se hizo» y el otro «se hizo pero no lo ves», y confundirlos es el defecto del ticket.
  assert.equal(COPY_BULK_PAGADAS.recargaFallida,
    'Se han marcado como pagadas, pero la lista no se ha podido actualizar. Recárgala para verla al día.',
    '🔴 se ha reescrito el aviso de recarga, que está FIRMADO desde el 17-ago-2026');
  assert.notEqual(COPY_BULK_PAGADAS.recargaFallida, COPY_BULK_PAGADAS.escrituraFallida,
    '🔴 los dos avisos dicen lo mismo: se pierde la diferencia entre «no se hizo» y «se hizo pero no lo ves».');
});
