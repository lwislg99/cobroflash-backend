import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildRegistroAlta,
  buildRegistroAnulacion,
  buildRegFactuEnvelope,
} from '../dist/modules/fiscal/verifactu/registro.builder.js';

const sistema = {
  nombreRazonProductor: 'PRODUCTOR DEMO SL', nifProductor: 'B12345678',
  nombreSistema: 'YaQu', idSistema: '01', version: '1.0.0', numeroInstalacion: '1',
  soloVerifactu: 'S', multiOT: 'S', indicadorMultiplesOT: 'S',
};

const base = {
  idEmisorFactura: 'B12345678', numSerieFactura: '2026-CF-001', fechaExpedicion: '11-06-2026',
  nombreRazonEmisor: 'Demo & Cía <SL>', tipoFactura: 'F1',
  descripcionOperacion: 'Instalación',
  destinatario: { nombreRazon: 'Cliente', nif: '12345678Z' },
  desglose: [{ claveRegimen: '01', calificacion: 'S1', tipoImpositivo: '21', baseImponible: '350.00', cuotaRepercutida: '73.50' }],
  cuotaTotal: '73.50', importeTotal: '423.50',
  encadenamiento: { primerRegistro: true },
  sistema, fechaHoraHusoGenRegistro: '2026-06-12T10:00:00+02:00', huella: 'A'.repeat(64),
};

test('alta: orden del XSD y campos obligatorios presentes', () => {
  const xml = buildRegistroAlta(base);
  // El orden de la sequence importa para el XSD: verificar posiciones relativas
  const order = ['IDVersion', 'IDFactura', 'NombreRazonEmisor', 'TipoFactura',
    'DescripcionOperacion', 'Destinatarios', 'Desglose', 'CuotaTotal', 'ImporteTotal',
    'Encadenamiento', 'SistemaInformatico', 'FechaHoraHusoGenRegistro', 'TipoHuella', 'Huella'];
  let last = -1;
  for (const el of order) {
    const idx = xml.indexOf(`<sf:${el}>`);
    assert.ok(idx > last, `${el} fuera de orden o ausente`);
    last = idx;
  }
  assert.ok(xml.includes('<sf:PrimerRegistro>S</sf:PrimerRegistro>'));
  assert.ok(xml.includes('<sf:TipoHuella>01</sf:TipoHuella>'));
});

test('alta: escapa XML peligroso (emisor con & y <>)', () => {
  const xml = buildRegistroAlta(base);
  assert.ok(xml.includes('Demo &amp; Cía &lt;SL&gt;'));
  assert.ok(!xml.includes('<SL>'));
});

test('R1: TipoRectificativa + FacturasRectificadas con la factura original', () => {
  const xml = buildRegistroAlta({
    ...base, tipoFactura: 'R1', tipoRectificativa: 'I',
    rectifica: { numSerieFactura: '2026-CF-001', fechaExpedicion: '11-06-2026' },
    numSerieFactura: '2026-CF-R-001',
    encadenamiento: { primerRegistro: false, anterior: { idEmisorFactura: 'B12345678', numSerieFactura: '2026-CF-001', fechaExpedicion: '11-06-2026', huella: 'B'.repeat(64) } },
  });
  assert.ok(xml.includes('<sf:TipoRectificativa>I</sf:TipoRectificativa>'));
  assert.ok(xml.includes('<sf:IDFacturaRectificada>'));
  assert.ok(xml.includes('<sf:RegistroAnterior>'));
  assert.ok(xml.includes(`<sf:Huella>${'B'.repeat(64)}</sf:Huella>`));
});

test('anulación: campos *Anulada y encadenamiento', () => {
  const xml = buildRegistroAnulacion({
    idEmisorFacturaAnulada: 'B12345678', numSerieFacturaAnulada: '2026-CF-001',
    fechaExpedicionAnulada: '11-06-2026',
    encadenamiento: { primerRegistro: true },
    sistema, fechaHoraHusoGenRegistro: '2026-06-12T10:10:00+02:00', huella: 'C'.repeat(64),
  });
  assert.ok(xml.includes('<sf:IDEmisorFacturaAnulada>B12345678</sf:IDEmisorFacturaAnulada>'));
  assert.ok(xml.includes('<sf:NumSerieFacturaAnulada>2026-CF-001</sf:NumSerieFacturaAnulada>'));
  assert.ok(xml.includes('<sf:FechaExpedicionFacturaAnulada>11-06-2026</sf:FechaExpedicionFacturaAnulada>'));
});

test('envelope: cabecera con obligado y límite de 1000 registros', () => {
  const reg = buildRegistroAlta(base);
  const xml = buildRegFactuEnvelope({ obligado: { nombreRazon: 'Demo ES S.L.', nif: 'B12345678' }, registrosXml: [reg] });
  assert.ok(xml.includes('<sfLR:RegFactuSistemaFacturacion'));
  assert.ok(xml.includes('<sf:ObligadoEmision>'));
  assert.throws(() => buildRegFactuEnvelope({ obligado: { nombreRazon: 'x', nif: 'y' }, registrosXml: [] }), /registros_fuera_de_rango/);
  assert.throws(() => buildRegFactuEnvelope({ obligado: { nombreRazon: 'x', nif: 'y' }, registrosXml: new Array(1001).fill(reg) }), /registros_fuera_de_rango/);
});
