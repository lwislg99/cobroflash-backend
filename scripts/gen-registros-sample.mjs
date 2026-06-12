// S1-C — Genera registros de MUESTRA (alta F1, rectificativa R1 y anulación) con los
// builders reales + huellas reales, envueltos en RegFactuSistemaFacturacion, para
// validarlos contra el XSD oficial con scripts/validate-registros-xsd.ps1.
// Uso: npm run build && node scripts/gen-registros-sample.mjs  → tmp/registros-sample.xml
import fs from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);

const { buildRegistroAlta, buildRegistroAnulacion, buildRegFactuEnvelope } =
  require('../dist/modules/fiscal/verifactu/registro.builder.js');
const { computeVeriFactuHash, computeVeriFactuHashAnulacion } =
  require('../dist/modules/invoicing/domain/verifactu.service.js');

const sistema = {
  nombreRazonProductor: 'PRODUCTOR DEMO SL', // [PENDIENTE fundador: datos reales → S1-E]
  nifProductor: 'B12345678',
  nombreSistema: 'YaQu',
  idSistema: '01',
  version: '1.0.0',
  numeroInstalacion: '1',
  soloVerifactu: 'S',
  multiOT: 'S',
  indicadorMultiplesOT: 'S',
};

const nif = 'B12345678';
const ts1 = '2026-06-12T10:00:00+02:00';
const ts2 = '2026-06-12T10:05:00+02:00';
const ts3 = '2026-06-12T10:10:00+02:00';

// 1) Alta F1 (primer registro de la cadena)
const h1 = computeVeriFactuHash({
  nif, serie: '2026-CF-001', fecha: '11-06-2026', tipoFactura: 'F1',
  cuotaTotal: '73.50', importeTotal: '423.50', prevHash: '', timestamp: ts1,
});
const alta = buildRegistroAlta({
  idEmisorFactura: nif, numSerieFactura: '2026-CF-001', fechaExpedicion: '11-06-2026',
  nombreRazonEmisor: 'Demo ES S.L.', tipoFactura: 'F1',
  descripcionOperacion: 'Instalacion termo electrico 80L',
  destinatario: { nombreRazon: 'Cliente Test', nif: '12345678Z' },
  desglose: [{ claveRegimen: '01', calificacion: 'S1', tipoImpositivo: '21', baseImponible: '350.00', cuotaRepercutida: '73.50' }],
  cuotaTotal: '73.50', importeTotal: '423.50',
  encadenamiento: { primerRegistro: true },
  sistema, fechaHoraHusoGenRegistro: ts1, huella: h1,
});

// 2) Rectificativa R1 (encadenada a la anterior)
const h2 = computeVeriFactuHash({
  nif, serie: '2026-CF-R-001', fecha: '12-06-2026', tipoFactura: 'R1',
  cuotaTotal: '-73.50', importeTotal: '-423.50', prevHash: h1, timestamp: ts2,
});
const rect = buildRegistroAlta({
  idEmisorFactura: nif, numSerieFactura: '2026-CF-R-001', fechaExpedicion: '12-06-2026',
  nombreRazonEmisor: 'Demo ES S.L.', tipoFactura: 'R1', tipoRectificativa: 'I',
  rectifica: { numSerieFactura: '2026-CF-001', fechaExpedicion: '11-06-2026' },
  descripcionOperacion: 'Rectificacion de la factura 2026-CF-001',
  destinatario: { nombreRazon: 'Cliente Test', nif: '12345678Z' },
  desglose: [{ claveRegimen: '01', calificacion: 'S1', tipoImpositivo: '21', baseImponible: '-350.00', cuotaRepercutida: '-73.50' }],
  cuotaTotal: '-73.50', importeTotal: '-423.50',
  encadenamiento: { primerRegistro: false, anterior: { idEmisorFactura: nif, numSerieFactura: '2026-CF-001', fechaExpedicion: '11-06-2026', huella: h1 } },
  sistema, fechaHoraHusoGenRegistro: ts2, huella: h2,
});

// 3) Anulación (encadenada)
const h3 = computeVeriFactuHashAnulacion({
  nif, serie: '2026-CF-001', fecha: '11-06-2026', prevHash: h2, timestamp: ts3,
});
const anul = buildRegistroAnulacion({
  idEmisorFacturaAnulada: nif, numSerieFacturaAnulada: '2026-CF-001', fechaExpedicionAnulada: '11-06-2026',
  encadenamiento: { primerRegistro: false, anterior: { idEmisorFactura: nif, numSerieFactura: '2026-CF-R-001', fechaExpedicion: '12-06-2026', huella: h2 } },
  sistema, fechaHoraHusoGenRegistro: ts3, huella: h3,
});

const xml = `<?xml version="1.0" encoding="UTF-8"?>\n` + buildRegFactuEnvelope({
  obligado: { nombreRazon: 'Demo ES S.L.', nif },
  registrosXml: [alta, rect, anul],
});

fs.mkdirSync('tmp', { recursive: true });
fs.writeFileSync('tmp/registros-sample.xml', xml, 'utf8');
console.log('OK → tmp/registros-sample.xml (alta F1 + R1 + anulación, huellas reales encadenadas)');
