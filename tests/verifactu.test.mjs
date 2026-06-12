import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  computeVeriFactuHash,
  buildVeriFactuQrUrl,
  formatFechaHoraHuso,
} from '../dist/modules/invoicing/domain/verifactu.service.js';

// ── S1-A: VECTOR DE PRUEBA OFICIAL del doc AEAT de especificaciones de huella ──
// Cadena: IDEmisorFactura=89890001K&NumSerieFactura=12345678/G33&FechaExpedicionFactura=01-01-2024
//   &TipoFactura=F1&CuotaTotal=12.35&ImporteTotal=123.45&Huella=&FechaHoraHusoGenRegistro=2024-01-01T19:20:30+01:00
test('huella: vector de prueba OFICIAL de la AEAT (primer registro, huella vacía)', () => {
  const hash = computeVeriFactuHash({
    nif: '89890001K',
    serie: '12345678/G33',
    fecha: '01-01-2024',
    tipoFactura: 'F1',
    cuotaTotal: '12.35',
    importeTotal: '123.45',
    prevHash: '', // primer registro → VACÍO (no '0')
    timestamp: '2024-01-01T19:20:30+01:00',
  });
  assert.equal(hash, '3C464DAF61ACB827C65FDA19F352A4E3BDC2C640E9E9FC4CC058073F38F12F60');
});

test('huella: 64 hex MAYÚSCULAS y sensible al encadenamiento', () => {
  const base = {
    nif: 'B12345678', serie: '2026-CF-001', fecha: '11-06-2026', tipoFactura: 'F1',
    cuotaTotal: '73.50', importeTotal: '423.50', timestamp: '2026-06-11T12:00:00+02:00',
  };
  const h1 = computeVeriFactuHash({ ...base, prevHash: '' });
  const h2 = computeVeriFactuHash({ ...base, prevHash: h1 });
  assert.match(h1, /^[0-9A-F]{64}$/);
  assert.notEqual(h1, h2, 'la huella anterior debe alterar la huella');
});

test('huella: los valores se recortan (trim) antes de concatenar', () => {
  const a = computeVeriFactuHash({
    nif: ' 89890001K ', serie: '12345678/G33', fecha: '01-01-2024', tipoFactura: 'F1',
    cuotaTotal: '12.35', importeTotal: '123.45', prevHash: '', timestamp: '2024-01-01T19:20:30+01:00',
  });
  assert.equal(a, '3C464DAF61ACB827C65FDA19F352A4E3BDC2C640E9E9FC4CC058073F38F12F60');
});

test('QR: URL de cotejo oficial con nif/numserie/fecha/importe codificados', () => {
  const url = buildVeriFactuQrUrl({ nif: '89890001K', serie: '12345678/G33', fecha: '01-01-2024', importe: '241.40' });
  assert.ok(url.startsWith('https://www2.agenciatributaria.gob.es/wlpl/TIKE-CONT/ValidarQR?'));
  assert.ok(url.includes('nif=89890001K'));
  assert.ok(url.includes('numserie=12345678%2FG33'), 'la serie va URL-encoded');
  assert.ok(url.includes('fecha=01-01-2024'));
  assert.ok(url.includes('importe=241.40'));
});

test('FechaHoraHusoGenRegistro: ISO 8601 con huso explícito', () => {
  const s = formatFechaHoraHuso(new Date(2026, 5, 11, 12, 0, 0));
  assert.match(s, /^2026-06-11T12:00:00[+-]\d{2}:\d{2}$/);
});
