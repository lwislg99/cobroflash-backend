// tests/scrum471-node-modules-al-dia.test.mjs — SCRUM-471
//
// Que la suite se DECLARE CIEGA en vez de dar cinco rojos que parecen del producto.
//
// PASO 0 medido el 11-ago-2026 sobre los 200 árboles del repo:
//   · dependencias directas que main exige: 27
//   · 53 sin `node_modules` · 147 con (91 de ellos por junction)
//   · **3 al día · 144 desfasados**
//   · 🔴 y el que decide el tamaño: **el compartido de los junctions está DESFASADO** (le falta
//     `fake-indexeddb`). Los 91 enlazados NO están protegidos: arrastran el mismo hueco de golpe.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { avisoDeDesfase, diagnosticar, exigidasPorElLock, instalado } from './_desfase-node-modules.mjs';

const RAIZ = path.resolve(import.meta.dirname, '..');

// ── SUELO ────────────────────────────────────────────────────────────────────────────────────

test('SCRUM-471 · SUELO: el comprobador LEE el lock, y si no puede se declara ciego', () => {
  const exigidas = exigidasPorElLock(RAIZ);
  assert.ok(exigidas, '🔴 no se encuentra `package-lock.json`: el comprobador no puede mirar.');
  assert.ok(exigidas.size >= 10,
    `🔴 solo se han leído ${exigidas.size} dependencias directas del lock. «Todo al día» y «no supe ` +
    'leer el lock» dan el mismo verde, y el segundo te deja corriendo tests contra lo que sea.');

  // Control positivo del lector: una dependencia que SEGURO está.
  assert.ok(exigidas.has('typescript'),
    '🔴 el lector no ve `typescript` en el lock: está ciego y lo de abajo no mediría nada.');

  // Y el ciego, probado: un árbol sin lock tiene que DECIRLO, no pasar.
  const vacio = fs.mkdtempSync(path.join(RAIZ, '.tmp-471-'));
  try {
    fs.mkdirSync(path.join(vacio, 'node_modules'));
    const aviso = avisoDeDesfase(vacio);
    assert.ok(aviso && aviso.includes('NO SE PUEDE COMPROBAR'),
      '🔴 un árbol SIN `package-lock.json` no se declara ciego: pasa como si estuviera al día.');
  } finally {
    fs.rmSync(vacio, { recursive: true, force: true });
  }
});

// ── EL CONTROL NEGATIVO: nace VERDE ──────────────────────────────────────────────────────────

test('SCRUM-471 · 🔴 CONTROL NEGATIVO: un árbol AL DÍA no dice nada', () => {
  // Si saltara siempre, nacería rojo y entrenaría a la gente a ignorarlo — eso ya se rechazó dos
  // veces (SCRUM-412, SCRUM-446). El aviso solo vale si el silencio significa algo.
  const d = diagnosticar(RAIZ);
  assert.ok(!d.ciego, `🔴 el comprobador no puede mirar este árbol: ${d.ciego}`);
  assert.deepEqual(d.faltan, [],
    avisoDeDesfase(RAIZ) || '🔴 faltan dependencias en este árbol.');
  assert.deepEqual(d.distintas, [],
    avisoDeDesfase(RAIZ) || '🔴 hay versiones distintas de las que pide el lock.');
});

// ── EL ROJO POR EL MECANISMO ─────────────────────────────────────────────────────────────────

test('SCRUM-471 · 🔴 con una dependencia ausente, el aviso la NOMBRA', () => {
  // Se simula sobre un árbol de mentira —no se toca el `node_modules` de nadie— con el mismo lock
  // real: el caso exacto de `fake-indexeddb`, que produjo cinco rojos y un ticket inexistente.
  const falso = fs.mkdtempSync(path.join(RAIZ, '.tmp-471-'));
  try {
    fs.copyFileSync(path.join(RAIZ, 'package.json'), path.join(falso, 'package.json'));
    fs.copyFileSync(path.join(RAIZ, 'package-lock.json'), path.join(falso, 'package-lock.json'));
    fs.mkdirSync(path.join(falso, 'node_modules'));

    // Se instala TODO menos una: el árbol que teníamos hoy.
    const exigidas = exigidasPorElLock(falso);
    for (const [nombre, version] of exigidas) {
      if (nombre === 'fake-indexeddb') continue;
      const dir = path.join(falso, 'node_modules', ...nombre.split('/'));
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ name: nombre, version }));
    }

    const aviso = avisoDeDesfase(falso);
    assert.ok(aviso, '🔴 con una dependencia ausente el comprobador calla: es un verde permanente.');
    // `/i`: el aviso lo dice en MAYÚSCULAS y la primera versión de esta línea era sensible a
    // ellas. Fallaba el test, no el código — el mismo género que llevo cazando todo el día.
    assert.match(aviso, /anterior a este `package-lock\.json`/i,
      '🔴 el aviso no dice que el `node_modules` va por detrás del lock.');
    assert.match(aviso, /fake-indexeddb/,
      '🔴 EL AVISO NO NOMBRA LA DEPENDENCIA. Ése es el ticket entero: cinco fallos de tests no ' +
      'dicen «te falta un paquete», y dos sesiones los leyeron como «main está roja».');
    assert.doesNotMatch(aviso, /rmdir \/s [^—]*seguro/i);
  } finally {
    fs.rmSync(falso, { recursive: true, force: true });
  }
});

test('SCRUM-471 · una versión DISTINTA también cuenta, no solo la ausencia', () => {
  const falso = fs.mkdtempSync(path.join(RAIZ, '.tmp-471-'));
  try {
    fs.copyFileSync(path.join(RAIZ, 'package.json'), path.join(falso, 'package.json'));
    fs.copyFileSync(path.join(RAIZ, 'package-lock.json'), path.join(falso, 'package-lock.json'));
    fs.mkdirSync(path.join(falso, 'node_modules'));
    const exigidas = exigidasPorElLock(falso);
    for (const [nombre, version] of exigidas) {
      const dir = path.join(falso, 'node_modules', ...nombre.split('/'));
      fs.mkdirSync(dir, { recursive: true });
      // `typescript` se deja en una versión vieja: instalado, pero no el que el lock pide.
      fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ name: nombre, version: nombre === 'typescript' ? '4.0.0' : version }));
    }
    const aviso = avisoDeDesfase(falso);
    assert.ok(aviso, '🔴 una versión distinta de la del lock pasa desapercibida.');
    assert.match(aviso, /typescript` está en 4\.0\.0/,
      '🔴 el aviso no dice QUÉ versión hay ni cuál se pide: «desfasado» a secas obliga a adivinar.');
  } finally {
    fs.rmSync(falso, { recursive: true, force: true });
  }
});

test('SCRUM-471 · el aviso NO recomienda `rmdir /s`, que es lo que arrasó el compartido', () => {
  const falso = fs.mkdtempSync(path.join(RAIZ, '.tmp-471-'));
  try {
    fs.copyFileSync(path.join(RAIZ, 'package.json'), path.join(falso, 'package.json'));
    fs.copyFileSync(path.join(RAIZ, 'package-lock.json'), path.join(falso, 'package-lock.json'));
    fs.mkdirSync(path.join(falso, 'node_modules'));
    const aviso = avisoDeDesfase(falso);
    assert.ok(aviso.includes('npm ci'), '🔴 el aviso no dice cómo arreglarlo.');
    assert.ok(aviso.includes('/s`'),
      '🔴 el aviso no advierte de `rmdir /s`. Es lo único de esta zona que hace daño irreversible, ' +
      'y ya arrasó el `node_modules` compartido dos veces.');
  } finally {
    fs.rmSync(falso, { recursive: true, force: true });
  }
});
