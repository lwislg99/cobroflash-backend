// SCRUM-401 · Anular NO puede borrar el estado de cobro.
//
// Sin gate: lee la ruta por AST y por texto. Ni BD, ni red, ni navegador.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// EL VEREDICTO: EL DEFECTO **NO ES ALCANZABLE**, Y LO QUE FALTABA ERA ESTO
//
// El ticket decía: «Anular una factura BORRA si estaba cobrada: `annulled` y el estado de cobro
// comparten el mismo campo, y el dato se pierde».
//
// Medido: **una factura cobrada NO se puede anular.** `POST /admin/invoices/:id/annul` corta antes
// con `409 invoice_not_pending` — «Solo se anula una factura pendiente. Si ya se cobró, hay que
// rectificarla (R1), no anularla». Lo puso SCRUM-153 (`bae054a`). Y el `update` de la anulación
// **solo toca `status`**: `paidAt` no se borra ni aunque se llegara.
//
// 🔴 PERO NINGÚN TEST LO PROTEGÍA. Quitar ese `if` no rompía nada, y entonces el defecto que el
// ticket describe **sí sería real**: `paid → annulled` perdería para siempre que el dinero entró.
// Perder el estado de cobro de una factura anulada es perder CUÁNDO ENTRÓ UN EURO.
//
// Eso es lo que este fichero cierra: no reconstruye la guarda — la fija.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { soloEjecutable } from './_guard-texto.mjs';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const leer = (p) => fs.readFileSync(path.join(RAIZ, p), 'utf8');

const RUTA = 'src/modules/system/app/routes/invoicesAdmin.routes.ts';
const RUTA_TXT = leer(RUTA);
const RUTA_COD = soloEjecutable(RUTA_TXT, { almohadillaEsComentario: false });

// ── LA GUARDA QUE HACE EL DEFECTO INALCANZABLE ──────────────────────────────────────────

test('SCRUM-401 · una factura COBRADA no se puede anular', () => {
  assert.match(
    RUTA_COD, /if \(invoice\.status !== 'pending'\) \{/,
    '🔴 HA DESAPARECIDO LA GUARDA QUE HACE INALCANZABLE EL DEFECTO.\n\n' +
      '  Sin ella, una factura `paid` puede pasar a `annulled` — y como los dos ejes comparten el\n' +
      '  campo `status`, se pierde para siempre que el dinero había entrado. Perder el estado de\n' +
      '  cobro de una anulada es perder CUÁNDO ENTRÓ UN EURO.\n\n' +
      '  Si de verdad hay que permitir anular una cobrada, primero hay que separar los dos ejes\n' +
      '  (cambio de modelo), no quitar el `if`.',
  );
  assert.match(
    RUTA_COD, /error: 'invoice_not_pending'/,
    '🔴 la guarda ya no devuelve `invoice_not_pending`: quien la consuma no sabrá por qué se negó.',
  );
});

test('SCRUM-401 · la guarda va ANTES de escribir el estado', () => {
  // Un `if` correcto colocado después del `update` no protege nada.
  const iGuarda = RUTA_COD.indexOf("if (invoice.status !== 'pending')");
  const iEscritura = RUTA_COD.indexOf("data: { status: 'annulled' }");
  assert.ok(iGuarda > 0, '🔴 ESCÁNER CIEGO: no se encuentra la guarda');
  assert.ok(iEscritura > 0, '🔴 ESCÁNER CIEGO: no se encuentra la escritura de `annulled`');
  assert.ok(
    iGuarda < iEscritura,
    '🔴 la guarda está DESPUÉS de escribir `annulled`: no impide nada.',
  );
});

// ── Y AUNQUE SE LLEGARA: `paidAt` NO SE TOCA ────────────────────────────────────────────

test('SCRUM-401 · el `update` de la anulación NO borra `paidAt`', () => {
  // Segunda red, por si algún día se permite anular una cobrada: la fecha de cobro es el rastro
  // de cuándo entró el dinero y no se limpia «de paso».
  const sf = ts.createSourceFile('r.ts', RUTA_TXT, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const updates = [];
  const visita = (n) => {
    if (ts.isCallExpression(n) && /invoice\.update$/.test(n.expression.getText(sf))) {
      const txt = n.getText(sf);
      if (txt.includes("'annulled'")) updates.push(txt.replace(/\s+/g, ' '));
    }
    ts.forEachChild(n, visita);
  };
  visita(sf);

  assert.equal(
    updates.length, 1,
    `🔴 ESCÁNER CIEGO: se encontraron ${updates.length} updates que escriben \`annulled\` y debía ` +
      'haber 1. Si hay más de uno, hay más de un sitio que anula y esta comprobación no los cubre.',
  );
  // ⚠️ HERMANO POSITIVO de la negación (SCRUM-237). Sin él, `!/paidAt/` pasaría por vacío si el
  // token no existiera en ninguna parte — y un guard que no puede ver lo que prohíbe siempre está
  // verde. Primero se comprueba que `paidAt` ES un token real de esta ruta y que el detector lo
  // vería si estuviera dentro del update.
  assert.match(
    RUTA_TXT, /paidAt/,
    '🔴 ESCÁNER CIEGO: `paidAt` no aparece en la ruta. O cambió de nombre —y entonces la negación ' +
      'de abajo no protege nada— o este guard está mirando el fichero equivocado.',
  );
  const updateFalso = "tx.invoice.update({ where: { id }, data: { status: 'annulled', paidAt: null } })";
  assert.ok(
    /paidAt/.test(updateFalso),
    '🔴 ESCÁNER CIEGO: el detector no reconocería un update que sí borra `paidAt`.',
  );

  assert.ok(
    !/paidAt/.test(updates[0]),
    `🔴 el update de la anulación toca \`paidAt\`: ${updates[0]}\n\n` +
      '  La fecha de cobro es el rastro de cuándo entró el dinero. Limpiarla al anular borra un\n' +
      '  hecho que ocurrió (regla 29).',
  );
});

// ── UN SOLO SITIO ANULA ─────────────────────────────────────────────────────────────────

test('SCRUM-401 · SUELO: `annulled` se ESCRIBE desde un único sitio', () => {
  // La guarda vive en la ruta, no en el modelo. Eso solo basta mientras la ruta sea el único
  // camino: un segundo sitio que escriba `annulled` se saltaría el `if` sin enterarse.
  const sf = ts.createSourceFile('r.ts', RUTA_TXT, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  let nodos = 0;
  const visita = (n) => { nodos += 1; ts.forEachChild(n, visita); };
  visita(sf);
  assert.ok(nodos > 1000, `🔴 ESCÁNER CIEGO: solo ${nodos} nodos recorridos en la ruta`);

  // Barrido de TODO `src/`: solo la ruta de anular puede escribirlo en base de datos.
  const escritores = [];
  const ficheros = [];
  (function walk(d) {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const f = path.join(d, e.name);
      if (e.isDirectory()) { walk(f); continue; }
      if (f.endsWith('.ts')) ficheros.push(f);
    }
  })(path.join(RAIZ, 'src'));
  assert.ok(ficheros.length > 150, `🔴 ESCÁNER CIEGO: solo ${ficheros.length} ficheros barridos`);

  for (const f of ficheros) {
    const src = fs.readFileSync(f, 'utf8');
    if (!src.includes("'annulled'")) continue;
    const sfx = ts.createSourceFile('x.ts', src, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
    const v = (n) => {
      if (ts.isCallExpression(n) && /invoice\.update(Many)?$/.test(n.expression.getText(sf))) {
        if (n.getText(sfx).includes("'annulled'")) {
          escritores.push(path.relative(RAIZ, f).split(path.sep).join('/'));
        }
      }
      ts.forEachChild(n, v);
    };
    v(sfx);
  }

  assert.deepEqual(
    [...new Set(escritores)], [RUTA],
    '🔴 HAY MÁS DE UN SITIO QUE ESCRIBE `annulled` EN BASE DE DATOS:\n' +
      [...new Set(escritores)].map((f) => `    ${f}`).join('\n') + '\n\n' +
      '  La guarda de «solo pendiente» vive en la ruta, no en el modelo. Un segundo camino se la\n' +
      '  salta sin enterarse, y ahí el defecto del ticket vuelve a ser real.',
  );
});

// ── EL RESIDUO, DECLARADO ───────────────────────────────────────────────────────────────

test('SCRUM-401 · el residuo del campo compartido sigue DECLARADO, no disimulado', () => {
  // Los dos ejes siguen compartiendo `status`. Hoy no hace daño porque la transición peligrosa
  // está cerrada, pero el libro lo dice en vez de rellenarlo: para una anulada, la celda de cobro
  // va VACÍA — «no se sabe» — en vez de «Pendiente», que sería afirmar que no se cobró.
  const libro = leer('src/modules/fiscal/librosAeat/librosAeat.ts');
  assert.match(
    libro, /annulled: \{ cobro: '', anulada: 'Sí' \}/,
    '🔴 el libro ha dejado de declarar el hueco de la anulada. Si ahora escribe «Pendiente», está ' +
      'AFIRMANDO que no se cobró — y eso no consta. Un hueco dice «no se sabe»; una palabra afirma.',
  );
});
