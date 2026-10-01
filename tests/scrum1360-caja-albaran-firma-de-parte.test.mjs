// tests/scrum1360-caja-albaran-firma-de-parte.test.mjs — SCRUM-1360
//
// LA FIRMA EN COLA DE UN PARTE NO ES LA DE UN ALBARÁN CON SU MISMO NÚMERO.
//
// La cola guarda firmas de albarán y, desde SCRUM-652, también de parte — y el id del documento va
// en el MISMO campo (`albaranId`, que conserva su nombre para no dejar huérfanas las colas que ya
// hay en los móviles). Lo que las distingue es `tipo`. La caja del detalle del albarán preguntaba
// sólo por el id: con la firma del parte 7 esperando, el albarán 7 —firmado y confirmado por el
// servidor— se pintaba «solo en este móvil».
//
// Se encola con las funciones REALES (`encolarFirma`, el almacén del banco) y con los mismos tipos
// que manda `parteDetailView.js`; no se fabrica la entrada a mano, porque el defecto era
// precisamente no saber qué lleva dentro.
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { montarAlmacen, porQueEstariaCiego } from './_banco-almacen-local.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ID = 7;
const CUERPO = Object.freeze({ signatureData: 'data:image/png;base64,AAAA', firmadoPorNombre: 'Aurora Benítez' });

/** La cola tras encolar `tipo` (undefined = albarán, como llama `albaranDetailView.js`). */
async function colaCon(id, tipo) {
  const b = montarAlmacen(RAIZ);
  const r = await b.ctx.encolarFirma(id, CUERPO, tipo);
  assert.equal(r.estado, b.ctx.GUARDADO, '🔴 la firma no se encoló: lo de abajo mediría una cola vacía.');
  const cola = await b.ctx.leerFirmasPendientes();
  assert.equal(cola.firmas.length, 1, '🔴 la cola no tiene la entrada sembrada.');
  return { b, firmas: cola.firmas };
}

test('SCRUM-1360 · 🔴 SUELO: el banco monta la cola y el modelo de estados', () => {
  const b = montarAlmacen(RAIZ);
  assert.equal(porQueEstariaCiego(b, RAIZ), null, '🔴 BANCO CIEGO (almacén).');
  for (const n of ['encolarFirma', 'leerFirmasPendientes', 'hayFirmaEnColaDe', 'estadoDeLaFirmaDelAlbaran']) {
    assert.equal(typeof b.ctx[n], 'function', `🔴 no está publicada \`${n}\`.`);
  }
});

test('SCRUM-1360 · 🔴 SUELO: la firma de un parte se guarda con el id en `albaranId` y su `tipo`', async () => {
  // Si esto deja de ser verdad, los tests de abajo pasan sin medir nada: se dice aquí.
  for (const tipo of ['parte', 'parte-tecnico']) {
    const { firmas } = await colaCon(ID, tipo);
    assert.equal(String(firmas[0].albaranId), String(ID), `🔴 la firma de «${tipo}» ya no lleva su id en \`albaranId\`.`);
    assert.equal(firmas[0].tipo, tipo, `🔴 la firma de «${tipo}» no lleva su tipo.`);
  }
});

test('SCRUM-1360 · ✅ CONTROL POSITIVO: la firma del ALBARÁN en cola degrada su caja a ①', async () => {
  const { b, firmas } = await colaCon(ID, undefined);
  assert.equal(b.ctx.estadoDeLaFirmaDelAlbaran(ID, true, firmas), b.ctx.FIRMA_SOLO_EN_ESTE_MOVIL,
    '🔴 el albarán se pinta «A salvo» con su propia firma todavía en la cola.');
});

test('SCRUM-1360 · ✅ una entrada VIEJA, sin `tipo`, sigue siendo de su albarán', () => {
  // Las colas anteriores a SCRUM-652 no llevan `tipo`. El que sube las trata como albarán
  // (`colaDeFirmas.js`, `firma.tipo || 'albaran'`); la caja tiene que leerlas igual.
  const b = montarAlmacen(RAIZ);
  const vieja = [{ claveIdempotencia: `firma:albaran:${ID}`, albaranId: ID, signatureData: CUERPO.signatureData }];
  assert.equal(b.ctx.estadoDeLaFirmaDelAlbaran(ID, true, vieja), b.ctx.FIRMA_SOLO_EN_ESTE_MOVIL,
    '🔴 una firma de albarán encolada antes de que existiera `tipo` ha dejado de degradar su caja.');
});

for (const tipo of ['parte', 'parte-tecnico']) {
  test(`SCRUM-1360 · 🔴 la firma en cola de «${tipo}» ${ID} NO degrada la caja del albarán ${ID} firmado`, async () => {
    const { b, firmas } = await colaCon(ID, tipo);
    assert.equal(b.ctx.hayFirmaEnColaDe(ID, firmas), false,
      `🔴 la firma del ${tipo} ${ID} se cuenta como firma del ALBARÁN ${ID}: comparten número, no documento.`);
    assert.equal(b.ctx.estadoDeLaFirmaDelAlbaran(ID, true, firmas), b.ctx.FIRMA_A_SALVO,
      '🔴 EL ALBARÁN FIRMADO SE PINTA «SOLO EN ESTE MÓVIL» POR LA FIRMA DE UN PARTE. El servidor ya ' +
      'tiene esa firma; la que espera en la cola es de otro documento.');
  });
}

test('SCRUM-1360 · ✅ parte y albarán con el mismo id EN LA MISMA COLA: manda la del albarán', async () => {
  const b = montarAlmacen(RAIZ);
  await b.ctx.encolarFirma(ID, CUERPO, 'parte');
  await b.ctx.encolarFirma(ID, CUERPO);
  const cola = await b.ctx.leerFirmasPendientes();
  assert.equal(cola.firmas.length, 2, '🔴 una firma ha pisado a la otra: la clave ya no lleva el tipo.');
  assert.equal(b.ctx.estadoDeLaFirmaDelAlbaran(ID, true, cola.firmas), b.ctx.FIRMA_SOLO_EN_ESTE_MOVIL);
});
