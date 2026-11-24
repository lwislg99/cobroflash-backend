// tests/scrum1641-portada-sin-validez-legal.test.mjs — SCRUM-1641
//
// La portada decía, en la tarjeta «Presupuestos y firma», «… y fírmalos por WhatsApp con validez
// legal.». Decisión del fundador (SCRUM-1641 c.22605): «Quitar la coletilla»: «Queda «fírmalos por
// WhatsApp», sin afirmar nada legal. Es lo más seguro mientras no haya dictamen.»
//
// Este test fija las dos cosas: que la portada no afirma «validez legal» en ningún sitio visible, y
// que el párrafo queda EXACTAMENTE con el texto firmado (ni una palabra nueva: regla 39).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORTADA = path.join(RAIZ, 'public', 'index.html');

const PROHIBIDO = 'validez legal';
const PARRAFO_FIRMADO = '<p>Créalos en 30 s del catálogo de tu oficio, con IA, y fírmalos por WhatsApp.</p>';

// Lo que ve quien visita: el HTML sin sus comentarios (un comentario no se publica).
const visible = (html) => html.replace(/<!--[\s\S]*?-->/g, '');
const afirmaValidezLegal = (html) => visible(html).toLowerCase().includes(PROHIBIDO);

test('SCRUM-1641 · 🔴 SUELO: la portada se lee y trae la tarjeta «Presupuestos y firma»', () => {
  const html = fs.readFileSync(PORTADA, 'utf8');
  assert.ok(html.length > 10_000, `🔴 public/index.html pesa ${html.length} B: sin portada legible esto no es un verde`);
  assert.ok(html.includes('Presupuestos y firma'),'🔴 no encuentro la tarjeta «Presupuestos y firma»: el guard no sabe qué mira');
});

test('SCRUM-1641 · CONTROL SEMBRADO: el detector ve «validez legal» en un HTML fabricado, y no en un comentario', () => {
  assert.equal(afirmaValidezLegal('<p>fírmalos por WhatsApp con validez legal.</p>'), true);
  assert.equal(afirmaValidezLegal('<p>Con VALIDEZ LEGAL</p>'), true);
  assert.equal(afirmaValidezLegal('<p>fírmalos por WhatsApp.</p>'), false);
  assert.equal(afirmaValidezLegal('<!-- antes: validez legal --><p>fírmalos por WhatsApp.</p>'), false);
});

test('SCRUM-1641 · 🔴 la portada NO afirma «validez legal» (c.22605: quitar la coletilla)', () => {
  const html = fs.readFileSync(PORTADA, 'utf8');
  const lineas = visible(html).split('\n')
    .map((l, i) => [i + 1, l]).filter(([, l]) => l.toLowerCase().includes(PROHIBIDO));
  assert.deepEqual(lineas.map(([n]) => n), [],
    `🔴 la portada vuelve a decir «${PROHIBIDO}»: el fundador decidió quitarlo mientras no haya dictamen (SCRUM-1641 c.22605)`);
});

test('SCRUM-1641 · el párrafo de la tarjeta es EXACTAMENTE el firmado, una sola vez', () => {
  const html = fs.readFileSync(PORTADA, 'utf8');
  assert.equal(html.split(PARRAFO_FIRMADO).length - 1, 1,
    '🔴 el párrafo de «Presupuestos y firma» no es el firmado en SCRUM-1641 c.22605 (o aparece más de una vez)');
});
