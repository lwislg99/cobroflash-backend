// Tests de i18n (getLocale): terminología y fiscalidad por país.
// Importante porque decide "Presupuesto" vs "Cotización" (idioma de plantillas
// WhatsApp/PDF) y la moneda/IVA por defecto. Runner integrado de Node.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as L from '../dist/core/i18n/locales.js';

test('getLocale: España (default y explícito)', () => {
  const es = L.getLocale('ES');
  assert.equal(es.quote, 'Presupuesto');
  assert.equal(es.currency, 'EUR');
  assert.equal(es.defaultVat, 0.21);
  assert.equal(es.vatName, 'IVA');
});

test('getLocale: case-insensitive y México', () => {
  const mx = L.getLocale('mx');
  assert.equal(mx.quote, 'Cotización');
  assert.equal(mx.quoteNew, 'Nueva cotización');
  assert.equal(mx.currency, 'MXN');
  assert.equal(mx.defaultVat, 0.16);
});

test('getLocale: Perú usa IGV', () => {
  const pe = L.getLocale('PE');
  assert.equal(pe.vatName, 'IGV');
  assert.equal(pe.currency, 'PEN');
  assert.equal(pe.defaultVat, 0.18);
});

test('getLocale: país desconocido / vacío → default España', () => {
  for (const v of [null, undefined, '', 'XX', 'us']) {
    const l = L.getLocale(v);
    assert.equal(l.quote, 'Presupuesto');
    assert.equal(l.currency, 'EUR');
  }
});

test('getLocaleJson: serializa todas las claves esperadas', () => {
  const j = L.getLocaleJson('CO');
  assert.equal(j.currency, 'COP');
  assert.equal(j.quote, 'Cotización');
  assert.deepEqual(
    Object.keys(j).sort(),
    ['currency', 'dateLocale', 'defaultVat', 'quote', 'quoteArticle', 'quoteNew', 'quotePlural', 'quoteVerb', 'vatName'].sort(),
  );
});
