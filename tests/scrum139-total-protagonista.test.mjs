import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { leerFuente } from './_guard-texto.mjs'; // SCRUM-193

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = leerFuente(path.join(raiz, 'public', 'dashboard', 'js', 'quotesView.js'));
const css = leerFuente(path.join(raiz, 'public', 'dashboard', 'css', 'styles.css'));

/**
 * SCRUM-139 F3 — EL TOTAL, PROTAGONISTA.
 *
 * Guards estructurales (quotesView.js es un módulo de navegador, no importable). Cubren las
 * roturas que NO dan error en consola: el total sigue calculándose bien y sigue viéndose en
 * la página, solo que deja de estar donde el usuario lo necesita.
 */

test('SCRUM-139 F3: el total se pinta con el patrón Signature KPI (label arriba, cifra debajo)', () => {
  assert.ok(
    /quote-total-kpi__label/.test(src) && /quote-total-kpi__cifra/.test(src),
    'el total vuelve a ser una fila cualquiera: el patrón Signature KPI de DESIGN.md §5 es label MAYÚSCULAS arriba y cifra Display debajo'
  );
  assert.ok(
    /\.quote-total-kpi__cifra[\s\S]{0,400}?font-weight:\s*800/.test(css),
    'la cifra del total pierde el peso Display (800) de DESIGN.md §3'
  );
  assert.ok(
    /\.quote-total-kpi__cifra[\s\S]{0,400}?color:\s*var\(--ink/.test(css),
    'Regla del Importe (DESIGN.md): el dinero SIEMPRE en Tinta — ni verde (eso es de las acciones) ni gris apagado'
  );
  assert.ok(
    /\.quote-total-kpi__cifra[\s\S]{0,400}?tabular-nums/.test(css),
    'la cifra del total pierde tabular-nums: los importes bailan al recalcular'
  );
});

test('SCRUM-139 F3: el KPI cuelga de leftCard, que es lo único que permite anclarlo', () => {
  // LA ROTURA SILENCIOSA de esta fase. `position:sticky` se limita a la caja del PADRE: si
  // alguien devuelve el KPI dentro de `.quote-totals` (~145 px de alto) el anclaje deja de
  // servir para nada y NADIE se entera — la cifra se sigue viendo, solo que otra vez a
  // y=1.470 px, fuera de pantalla mientras se escribe. Medido en la QA de F3.
  assert.ok(
    /leftCard\.appendChild\(kpiBox\)/.test(src),
    'el bloque del total ya no cuelga de leftCard: el anclaje en móvil queda muerto sin dar ningún error'
  );
  assert.ok(
    !/totalsBox\.innerHTML[\s\S]{0,400}?quote-total-kpi\b/.test(src),
    'el KPI vuelve a pintarse DENTRO de la caja de totales: ahí no puede anclarse (el padre mide ~145 px)'
  );
});

test('SCRUM-139 F3: el total va anclado en móvil y NO en escritorio', () => {
  const movil = css.match(/@media\s*\(max-width:\s*767px\)\s*\{[\s\S]*?\n\}/g) || [];
  const conSticky = movil.some((b) => /\.quote-total-kpi\b[\s\S]*?position:\s*sticky/.test(b));
  assert.ok(
    conSticky,
    'se pierde el anclaje del total en móvil: medido, sin él la cifra cae a y=1.470 px en una pantalla de 844 px y no se ve mientras editas'
  );
  // En ≥768 px la cifra ya se ve sin scroll (medido: y=666 px); anclarla allí sería una barra
  // fija que no resuelve nada y come pantalla.
  const fueraDeMovil = css.replace(/@media\s*\(max-width:\s*767px\)\s*\{[\s\S]*?\n\}/g, '');
  assert.ok(
    !/\.quote-total-kpi\s*\{[^}]*position:\s*sticky/.test(fueraDeMovil),
    'el total se ancla también en escritorio: allí ya se ve sin scroll, y la barra fija solo quita sitio'
  );
});

test('SCRUM-139 F3: el CSS del total viejo no vuelve', () => {
  // `.quote-vat-calc` era el total anterior y `.quote-total-final` ya estaba muerta antes de
  // F3 (ningún fichero la emitía). CSS que nadie usa es CSS que el siguiente copia por error.
  assert.ok(!/\.quote-vat-calc\s*\{/.test(css), 'vuelve `.quote-vat-calc`: el total viejo compite con el KPI');
  assert.ok(!/\.quote-total-final\s*\{/.test(css), 'vuelve `.quote-total-final`, que ya estaba muerta antes de F3');
});
