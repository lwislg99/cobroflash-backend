// SCRUM-130 (regla 23 + 18) — `cardChargeDecision`: la tarjeta va a la cuenta CONECTADA del
// merchant, o NADA; la cuenta de PLATAFORMA solo es legítima para el merchant demo. Función PURA
// (sin BD ni red) → corre en `npm test` normal, igual que la política demo V0-2 (whatsappPolicy).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cardChargeDecision } from '../dist/modules/billing/domain/cardCharge.js';

test('SCRUM-130: Connect activo → direct charge en la cuenta del merchant', () => {
  assert.equal(cardChargeDecision({ useConnect: true, isDemo: false }), 'connect');
  assert.equal(cardChargeDecision({ useConnect: true, isDemo: true }), 'connect'); // Connect gana siempre
});

test('SCRUM-130: sin Connect pero es el DEMO → cuenta de plataforma (regla 18, test/watermark)', () => {
  assert.equal(cardChargeDecision({ useConnect: false, isDemo: true }), 'demo_platform');
});

test('SCRUM-130: merchant REAL sin Connect → NADA (jamás cae a la cuenta de plataforma)', () => {
  assert.equal(cardChargeDecision({ useConnect: false, isDemo: false }), 'refuse');
});
