import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildRegistroAlta,
  buildRegistroAnulacion,
  construirCuerpoSoapRegFactu,
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
    const idx = xml.indexOf(`<sum1:${el}>`);
    assert.ok(idx > last, `${el} fuera de orden o ausente`);
    last = idx;
  }
  assert.ok(xml.includes('<sum1:PrimerRegistro>S</sum1:PrimerRegistro>'));
  assert.ok(xml.includes('<sum1:TipoHuella>01</sum1:TipoHuella>'));
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
  assert.ok(xml.includes('<sum1:TipoRectificativa>I</sum1:TipoRectificativa>'));
  assert.ok(xml.includes('<sum1:IDFacturaRectificada>'));
  assert.ok(xml.includes('<sum1:RegistroAnterior>'));
  assert.ok(xml.includes(`<sum1:Huella>${'B'.repeat(64)}</sum1:Huella>`));
});

test('anulación: campos *Anulada y encadenamiento', () => {
  const xml = buildRegistroAnulacion({
    idEmisorFacturaAnulada: 'B12345678', numSerieFacturaAnulada: '2026-CF-001',
    fechaExpedicionAnulada: '11-06-2026',
    encadenamiento: { primerRegistro: true },
    sistema, fechaHoraHusoGenRegistro: '2026-06-12T10:10:00+02:00', huella: 'C'.repeat(64),
  });
  assert.ok(xml.includes('<sum1:IDEmisorFacturaAnulada>B12345678</sum1:IDEmisorFacturaAnulada>'));
  assert.ok(xml.includes('<sum1:NumSerieFacturaAnulada>2026-CF-001</sum1:NumSerieFacturaAnulada>'));
  assert.ok(xml.includes('<sum1:FechaExpedicionFacturaAnulada>11-06-2026</sum1:FechaExpedicionFacturaAnulada>'));
});

// SCRUM-240: `buildRegFactuEnvelope` pasó a llamarse `construirCuerpoSoapRegFactu` (ahora dice
// de qué es el sobre) y sus dos casos límite adoptaron el comportamiento del camino de
// PRODUCCIÓN, que es el que gana.
test('cuerpo SOAP: cabecera con obligado, y los límites siguen al camino de producción', () => {
  const reg = buildRegistroAlta(base);
  const obligado = { nombreRazon: 'Demo ES S.L.', nif: 'B12345678' };
  const xml = construirCuerpoSoapRegFactu({ obligado, registrosXml: [reg] });
  assert.ok(xml.includes('<sum:RegFactuSistemaFacturacion'));
  assert.ok(xml.includes('<sum1:ObligadoEmision>'));

  // CERO registros → '' (como la exportación desde SCRUM-216). Antes lanzaba
  // `registros_fuera_de_rango`: era una TERCERA política para el mismo hecho.
  assert.equal(construirCuerpoSoapRegFactu({ obligado, registrosXml: [] }), '');

  // MÁS DE 1000 → el MISMO error que lanza la exportación, no uno propio.
  assert.throws(
    () => construirCuerpoSoapRegFactu({ obligado, registrosXml: new Array(1001).fill(reg) }),
    /verifactu_demasiados_registros:1001/,
  );
  // Justo en el límite NO lanza: el XSD admite 1000.
  assert.ok(construirCuerpoSoapRegFactu({ obligado, registrosXml: new Array(1000).fill(reg) }).length > 0);
});
