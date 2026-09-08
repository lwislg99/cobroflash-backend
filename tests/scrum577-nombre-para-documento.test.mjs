// tests/scrum577-nombre-para-documento.test.mjs — SCRUM-577 (CONT-04)
//
// QUÉ NOMBRE DEL CLIENTE SALE EN UN DOCUMENTO, y sobre todo: QUE NO CAMBIE PARA NADIE.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// 🔴 EL CONTROL QUE MANDA, Y ES EL PRIMERO
//
// Esto toca el CAMINO DE EMISIÓN: `generateInvoicePdf` imprime lo que va en una factura, y una
// factura emitida no se edita (regla 29). Así que el control que decide no es «ahora sale la
// razón social» — es **un cliente SIN razón social imprime EXACTAMENTE lo mismo que antes**.
//
// Y hay un número detrás, medido el 24-ago-2026 sobre las dos bases disponibles: **0 de 15
// clientes tienen `legalName` relleno** (staging 0/4, dev 0/11). O sea que HOY este cambio **no
// puede alterar ni una sola factura**. Es la diferencia entre un cambio arriesgado y uno inerte,
// y por eso va escrito y no supuesto.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
// SCRUM-694: el scanner de TypeScript, no un filtro por lineas.
import { soloCodigo } from './_solo-codigo.mjs';

const RAIZ = path.resolve(import.meta.dirname, '..');
const { nombreParaDocumento } = await import('../dist/core/documentos/nombreParaDocumento.js');

// ── SUELO ────────────────────────────────────────────────────────────────────────────────

test('SCRUM-577 · SUELO: la función responde y DISTINGUE los dos nombres', () => {
  assert.equal(typeof nombreParaDocumento, 'function');
  // Si devolviera siempre lo mismo, todo lo de abajo pasaría sin medir nada.
  assert.notEqual(
    nombreParaDocumento({ name: 'Comercial', legalName: 'Legal SL' }, '—'),
    nombreParaDocumento({ name: 'Comercial' }, '—'),
    '🔴 la función no distingue: da igual tener razón social que no tenerla',
  );
});

// ── 🔴 EL CONTROL NEGATIVO ───────────────────────────────────────────────────────────────

test('SCRUM-577 · 🔴 SIN razón social se imprime EXACTAMENTE lo de antes', () => {
  // Las cuatro formas del «no hay razón social». Ninguna puede cambiar lo impreso.
  for (const cliente of [
    { name: 'Fontanería Pérez' },
    { name: 'Fontanería Pérez', legalName: null },
    { name: 'Fontanería Pérez', legalName: '' },
    { name: 'Fontanería Pérez', legalName: '   ' },
  ]) {
    assert.equal(
      nombreParaDocumento(cliente, cliente.name), 'Fontanería Pérez',
      `🔴 REGRESIÓN EN EL CAMINO DE EMISIÓN: cambia lo impreso con ${JSON.stringify(cliente)}`,
    );
  }
});

test('SCRUM-577 · con razón social, es ELLA la que sale', () => {
  assert.equal(
    nombreParaDocumento({ name: 'Fontanería Pérez', legalName: 'Pérez e Hijos SL' }, '—'),
    'Pérez e Hijos SL',
  );
});

test('SCRUM-577 · CADA documento conserva SU respaldo — unificarlo cambiaría lo impreso', () => {
  // El PDF usaba `'—'`, el libro y el albarán `null`, la bandeja `'Cliente'`. Son distintos a
  // propósito y el módulo NO los unifica: hacerlo sería cambiar lo que se ve en tres documentos.
  assert.equal(nombreParaDocumento(null, '—'), '—');
  assert.equal(nombreParaDocumento(null, null), null);
  assert.equal(nombreParaDocumento({}, 'Cliente'), 'Cliente');
  assert.equal(nombreParaDocumento({ name: '', legalName: '' }, null), null);
});

test('SCRUM-577 · se recorta el espacio en blanco, pero no se toca nada más', () => {
  assert.equal(nombreParaDocumento({ name: '  Pérez  ' }, '—'), 'Pérez');
  assert.equal(nombreParaDocumento({ name: 'X', legalName: '  Pérez SL ' }, '—'), 'Pérez SL');
});

// ── QUE EL SITIO ÚNICO SE USE DE VERDAD ──────────────────────────────────────────────────

const leer = (rel) => fs.readFileSync(path.join(RAIZ, rel), 'utf8');
// Solo el código: sin esto, los guards de abajo se cazarían en los comentarios que explican la
// regla — el error que ya cometí en SCRUM-574 y en SCRUM-578.
// SCRUM-694 · lo hace el scanner de TypeScript (`tests/_solo-codigo.mjs`). Éste era de los
// «completos» —quitaba `//`, `*` y `/*`— y aun así fallaba en el sentido caro: el
// `.replace(/\s*\/\/.*$/)` cortaba en el `//` de una URL dentro de una cadena y se llevaba por
// delante código real, que dejaba de vigilarse SIN que nadie lo notara.

test('SCRUM-577 · SUELO: los ficheros que se auditan existen y son los que creo', () => {
  const pdf = leer('src/modules/invoicing/infra/pdf/pdf.service.ts');
  assert.ok(pdf.length > 5000, '🔴 no he leído pdf.service.ts');
  assert.ok(pdf.includes('generateInvoicePdf') && pdf.includes('generateQuotePdf'), '🔴 no es el fichero que creo');
});

test('SCRUM-577 · las CUATRO copias unificables usan el sitio único', () => {
  for (const f of [
    'src/modules/invoicing/infra/pdf/pdf.service.ts',       // factura Y presupuesto
    'src/modules/fiscal/librosAeat/librosAeat.repo.ts',
    'src/modules/jobs/domain/pendientesFacturar.service.ts',
  ]) {
    assert.ok(soloCodigo(leer(f)).includes('nombreParaDocumento('), `🔴 ${f} no usa el sitio único`);
  }
});

test('SCRUM-577 · 🔴 la QUINTA copia NO se unifica, y es un hallazgo — no una excepción', () => {
  // `albaran.service.ts` es FUENTE DEL SELLADOR: SCRUM-371 exige que el barrido y el sellador la
  // resuelvan con el MISMO TEXTO, porque el hash de los sobres v:1 y v:2 se recalcula con esas
  // fuentes vivas. Se intentó unificarla y ese guard la cazó. Cambiar sólo un lado haría que el
  // barrido dijera «no coincide» sobre albaranes INTACTOS y sobre la población entera a la vez.
  //
  // Este test fija que sigue SIN unificar. Si alguien lo «arregla» de paso, cae aquí y lee por qué.
  const codigo = soloCodigo(leer('src/modules/jobs/domain/albaran.service.ts'));
  assert.ok(
    codigo.includes("customer?.legalName || customer?.name || null"),
    '🔴 la fuente del sellador ha cambiado de forma. SCRUM-371 la sujeta al barrido: si la unificas, hay que mover LAS DOS a la vez.',
  );
  assert.equal(
    codigo.includes('nombreParaDocumento('), false,
    '🔴 se ha unificado la copia del SELLADOR: el barrido dirá «no coincide» sobre albaranes intactos',
  );
});

test('SCRUM-577 · 🔴 la factura recibe `legalName` — antes NO viajaba', () => {
  // El defecto medido: `generateInvoicePdf` no lo tenía en su tipo y `invoicing.ts` no se lo
  // pasaba, así que la preferencia era inalcanzable por ese camino.
  const pdf = soloCodigo(leer('src/modules/invoicing/infra/pdf/pdf.service.ts'));
  assert.ok(
    /customer:\s*\{\s*name:\s*string;\s*legalName\?/.test(pdf),
    '🔴 el tipo de `customer` de la factura ha vuelto a quedarse sin `legalName`',
  );
  const inv = soloCodigo(leer('src/lib/invoicing.ts'));
  const conLegal = (inv.match(/customer:\s*\{[^}]*legalName/g) || []).length;
  assert.equal(conLegal, 2, `🔴 sólo ${conLegal} de los 2 caminos de la factura pasan legalName`);
});
