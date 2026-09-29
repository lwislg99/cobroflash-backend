// tests/scrum743-cantidad-una-sola-forma.test.mjs — SCRUM-743 (conexión de `formatNumeroEs`)
//
// 🔴 LA CANTIDAD DEL ALBARÁN, UNA SOLA FORMA EN LAS DOS CARAS DEL DOCUMENTO.
//
// El PDF la escribía con `toLocaleString('es-ES')` (no agrupa los enteros de cuatro cifras) y la
// pantalla pública de firma EN CRUDO: el cliente firmaba «2.5» y el papel decía «2,5»; «12345» y
// «12.345». Ahora las dos pasan por `formatNumeroEs`.
//
// Y lo que NO puede moverse: el SELLO. El `contentHash` es del contenido canónico, no del pintado.
// El hash de abajo se midió en `origin/main` = `7a94abae` ANTES de tocar nada (v:2, mismo fixture):
// si este cambio lo moviera, el formato habría entrado en el camino canónico y los albaranes ya
// firmados dejarían de verificar. ⛔ Sin red ni base.
import test from 'node:test';
import assert from 'node:assert/strict';

const { computeAlbaranContentHash } = await import('../dist/modules/jobs/domain/albaran.service.js');
const { renderLineasAlbaran, fmtCantidadAlbaran } = await import('../dist/modules/jobs/app/routes/albaranPublicVista.js');

const ALBARAN = {
  numero: 'ALB-2026-0743', fecha: new Date('2026-09-29T08:00:00.000Z'), modoValoracion: 'VALORADO',
  lineas: [
    { concepto: 'Mano de obra', cantidad: 2.5, unidad: 'h', precioUnitario: 35.4, tipoIva: 21 },
    { concepto: 'Tubo', cantidad: 1500, unidad: 'm', precioUnitario: 1.2, tipoIva: 21 },
  ],
  notas: null, jobDireccion: null, lugarEntrega: 'C/ Mayor 3', referenciaTrabajo: null,
  cliente: 'Cliente Prueba', emisor: 'Emisor Prueba', emisorNif: 'B00000000',
};

/** Medido en `origin/main` = `7a94abae`, antes del cambio. Literal a propósito: es la constancia. */
const HASH_V2_ANTES = '508319cde959d8c56015547dc758b9df5688779047d639bbe67ef9e2d86d33d4';

test('🔴 SCRUM-743 · el SELLO no se mueve: cambiar cómo se pinta la cantidad no toca el hash', () => {
  assert.equal(computeAlbaranContentHash(structuredClone(ALBARAN), 2), HASH_V2_ANTES,
    '🔴 EL HASH DE UN ALBARÁN HA CAMBIADO: el formato de la cantidad ha entrado en el contenido canónico. '
    + 'Los albaranes ya firmados dejarían de verificar. PARA.');
});

test('🔴 SCRUM-743 · la pantalla de firma escribe la cantidad en español, agrupada', () => {
  const celdasCantidad = [...renderLineasAlbaran(ALBARAN.lineas, 'SIN_VALORAR').matchAll(/<tr><td>[^<]*<\/td><td>([^<]*)<\/td>/g)]
    .map((m) => m[1]);
  assert.deepEqual(celdasCantidad, ['2,5', '1.500'], '🔴 la pantalla de firma no escribe la cantidad como el PDF');
});

test('SCRUM-743 · sin cantidad no se inventa un número; ilegible se deja como venía', () => {
  assert.equal(fmtCantidadAlbaran(null), '');
  assert.equal(fmtCantidadAlbaran(undefined), '');
  assert.equal(fmtCantidadAlbaran(''), '');
  assert.equal(fmtCantidadAlbaran('abc'), 'abc');
  assert.equal(fmtCantidadAlbaran(3), '3', '🔴 un entero no puede ganar decimales');
  assert.equal(fmtCantidadAlbaran('12.5'), '12,5');
});
